// 羊圈守夜 · 音效與音樂。全部用 Web Audio 現場合成，沒有音檔、沒有授權問題。
// 期 5（2026-11-01）：背景音樂也是生成式——三章各一套音階與和弦，慢慢鋪的墊底和弦＋稀疏的五聲音階旋律，跟音效分軌（prefs.music 開關）
// 用法：Sound.unlock() 在第一次點擊時叫（iOS 要有手勢才出聲）；Sound.play('howl')；Sound.set('vol', 2)
// 設定 { sfx 音效開關, amb 蟲鳴開關, music 背景音樂開關, vol 音量 0 小 1 中 2 大 } 住在存檔裡（save.js 的 prefs.sound）：頁面開好後叫 Sound.attach(存檔裡那個物件, 寫回存檔的函式)；attach 之前用預設值（2026-10-29 期 0 以前自己存 localStorage 'sheepfold-sound'）
'use strict';
(function (root) {
  const VOLS = [0.35, 0.6, 1.0];
  let ctx = null, master = null, amb = null, ambWanted = false;
  const lastAt = {};  // 每種音效上次播放的時間，太密就不重播（咬牆、石子每幀都在發生）
  const GAP = { shot: 0.08, bite: 0.45, die: 0.12, ignite: 0.25, food: 0.05, place: 0.05, hit: 0.1, whine: 0.3, grab: 0.2, sheep: 0.2, overfly: 0.5, throw: 0.1, roll: 0.3 }; // 咻：一排五個射手一起射也只響一聲

  const prefs = { sfx: true, amb: false, music: true, vol: 1 };
  let mgain = null, comp = null; // 音樂自己的音量節點（跟音效分軌），一起進壓縮器
  let store = null, onChange = null; // 存檔裡的那個物件、改了要叫誰寫回
  function attach(obj, fn) {
    store = obj || null; onChange = typeof fn === 'function' ? fn : null;
    if (store) { prefs.sfx = store.sfx !== false; prefs.amb = !!store.amb; prefs.music = store.music !== false; prefs.vol = [0, 1, 2].includes(store.vol) ? store.vol : 1; }
    if (master) master.gain.setValueAtTime(prefs.sfx ? VOLS[prefs.vol] : 0, ctx.currentTime);
    if (mgain) mgain.gain.setValueAtTime(prefs.music ? VOLS[prefs.vol] * MUSIC_LEVEL : 0, ctx.currentTime);
  }
  function save() { if (store) Object.assign(store, prefs); if (onChange) try { onChange(); } catch (e) {} }

  function ensure() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    master = ctx.createGain(); master.gain.value = prefs.sfx ? VOLS[prefs.vol] : 0;
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 6; // 好幾個音疊在一起不爆音
    master.connect(comp); comp.connect(ctx.destination);
    mgain = ctx.createGain(); mgain.gain.value = prefs.music ? VOLS[prefs.vol] * MUSIC_LEVEL : 0; mgain.connect(ctx.destination); // 音樂不進壓縮器：鋪底和弦疊起來會把壓縮器一直壓著，音效一響整個鋪底就「抽一下」（動畫 review 11/1）
    return ctx;
  }
  // context 沒在跑就叫它跑（iOS 第一次手勢後是 suspended；來電、Siri 之後是 interrupted）
  function wake() { if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().then(() => { if (ambWanted) startAmb(); if (musicWanted) startMusic(); }).catch(() => {}); }
  // 第一次手勢時叫：建好 context 並解除 iOS 的靜音狀態
  function unlock() { if (!ensure()) return; wake(); if (ambWanted) startAmb(); if (musicWanted) startMusic(); }
  const now = () => ctx.currentTime;

  // ====== 合成積木 ======
  // 一個音：type 波形、f0→f1 頻率滑動、dur 秒、g 音量、a 起音秒數、lp 低通濾波頻率、vib 顫音 [Hz, 深度]
  function tone({ type = 'sine', f0 = 440, f1, dur = 0.2, g = 0.3, a = 0.005, lp, vib, at = 0, out, detune = 0 }) {
    const t = now() + at;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (detune) o.detune.value = detune;
    if (f1 !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const env = ctx.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(g, t + a); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); node = f; }
    if (vib) { const l = ctx.createOscillator(); l.frequency.value = vib[0]; const lg = ctx.createGain(); lg.gain.value = vib[1]; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
    node.connect(env); env.connect(out || master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  let noiseBuf = null;
  function noiseBuffer() {
    if (noiseBuf) return noiseBuf;
    const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return (noiseBuf = b);
  }
  // 一段噪音：filt 濾波種類、f0→f1 濾波頻率、q 共鳴、dur、g、a
  function noise({ filt = 'lowpass', f0 = 1000, f1, q = 1, dur = 0.1, g = 0.3, a = 0.003, at = 0 }) {
    const t = now() + at;
    const s = ctx.createBufferSource(); s.buffer = noiseBuffer(); s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = filt; f.Q.value = q; f.frequency.setValueAtTime(f0, t);
    if (f1 !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const env = ctx.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(g, t + a); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(env); env.connect(master);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); // 每次從不同位置開始，石子聲才不會一模一樣
  }

  // ====== 音效表：名稱 → 怎麼合成 ======
  const SFX = {
    place:  () => { tone({ f0: 180, f1: 110, dur: 0.09, g: 0.35 }); noise({ f0: 1200, dur: 0.03, g: 0.15 }); },        // 放下單位：軟軟的「噗」
    food:   () => { tone({ f0: 880, dur: 0.07, g: 0.12 }); tone({ f0: 1320, dur: 0.09, g: 0.12, at: 0.06 }); },     // 糧：兩聲叮
    shot:   () => noise({ filt: 'bandpass', f0: 3000, q: 2, dur: 0.03, g: 0.18 }),                                  // 石子／箭射出
    hit:    () => noise({ filt: 'bandpass', f0: 900, q: 1.5, dur: 0.04, g: 0.12 }),                                 // 打中
    bite:   () => noise({ f0: 420, dur: 0.07, g: 0.22 }),                                                           // 咬牆、咬人
    die:    () => noise({ filt: 'bandpass', f0: 700, q: 1, dur: 0.09, g: 0.14 }),                                   // 敵人倒下
    wave:   () => { tone({ f0: 90, f1: 38, dur: 0.45, g: 0.5 }); noise({ f0: 300, dur: 0.35, g: 0.18, a: 0.05 }); }, // 波開始：低鼓＋風
    clear:  () => { [523, 659, 784].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.16, g: 0.2, at: i * 0.1 })); },
    dawn:   () => { [392, 494, 587, 784, 988].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 1.4 - i * 0.1, g: 0.16, a: 0.03, at: i * 0.17 })); }, // 天亮：五聲上行和弦
    lose:   () => { tone({ f0: 220, f1: 110, dur: 1.2, g: 0.3, a: 0.02 }); tone({ type: 'triangle', f0: 165, f1: 82, dur: 1.3, g: 0.18, a: 0.05 }); },
    howl:   () => tone({ type: 'sawtooth', f0: 650, f1: 300, dur: 0.9, g: 0.14, a: 0.08, lp: 1800, vib: [6, 25] }),  // 領頭狼嚎叫
    roar:   () => { tone({ type: 'sawtooth', f0: 170, f1: 90, dur: 1.0, g: 0.26, a: 0.03, lp: 900, vib: [28, 20] }); noise({ f0: 500, f1: 150, dur: 0.9, g: 0.18, a: 0.03 }); }, // 獅子
    growl:  () => tone({ type: 'sawtooth', f0: 230, f1: 170, dur: 0.6, g: 0.18, a: 0.03, lp: 1000, vib: [32, 40] }),  // 熊狂暴／豹低吼
    boar:   () => { tone({ f0: 75, f1: 50, dur: 0.25, g: 0.5 }); noise({ f0: 250, dur: 0.18, g: 0.3 }); },           // 野豬撞牆
    owl:    () => { tone({ f0: 430, f1: 400, dur: 0.22, g: 0.18, a: 0.04, lp: 900 }); tone({ f0: 410, f1: 380, dur: 0.3, g: 0.18, a: 0.04, lp: 900, at: 0.3 }); }, // 夜鴞：呼—呼
    horn:   () => { tone({ type: 'sawtooth', f0: 330, dur: 0.5, g: 0.16, a: 0.04, lp: 2200 }); tone({ type: 'sawtooth', f0: 440, dur: 0.6, g: 0.16, a: 0.04, lp: 2200, at: 0.3 }); }, // 吹角：兩個音
    blast:  () => { noise({ f0: 1500, f1: 120, dur: 0.45, g: 0.55 }); tone({ f0: 120, f1: 40, dur: 0.3, g: 0.35 }); },  // 瓦瓶打破
    ignite: () => noise({ filt: 'highpass', f0: 2500, dur: 0.15, g: 0.14 }),
    emerge: () => noise({ f0: 450, f1: 200, dur: 0.3, g: 0.25, a: 0.02 }),                                          // 野狗出土
    sheep:  () => tone({ type: 'sawtooth', f0: 620, f1: 540, dur: 0.38, g: 0.14, a: 0.03, lp: 1600, vib: [9, 30] }),   // 羊叫
    grab:   () => tone({ type: 'sawtooth', f0: 760, f1: 620, dur: 0.25, g: 0.14, a: 0.02, lp: 1700, vib: [11, 30] }),  // 羊被抱走：短而急
    whine:  () => tone({ f0: 900, f1: 600, dur: 0.3, g: 0.12, a: 0.03 }),                                           // 狗受傷回窩
    tap:    () => noise({ filt: 'bandpass', f0: 1800, q: 3, dur: 0.02, g: 0.08 }),                                  // 介面輕點
    // ====== 第三章「諸山間」 ======
    overfly: () => noise({ filt: 'bandpass', f0: 4200, f1: 2600, q: 3, dur: 0.12, g: 0.12 }),                       // 石子從頭頂飛過：短高頻「咻」
    roll:    () => { noise({ f0: 220, f1: 90, dur: 0.55, g: 0.45, a: 0.02 }); tone({ f0: 70, f1: 45, dur: 0.5, g: 0.3 }); }, // 滾石：低頻隆隆半秒
    pit:     () => { tone({ f0: 140, f1: 60, dur: 0.22, g: 0.4 }); noise({ f0: 300, dur: 0.15, g: 0.2, a: 0.01 }); }, // 陷坑：悶的「咚」
    water:   () => { noise({ filt: 'bandpass', f0: 1400, f1: 600, q: 1.2, dur: 0.35, g: 0.25, a: 0.02 }); tone({ type: 'triangle', f0: 520, f1: 780, dur: 0.18, g: 0.08, at: 0.05 }); }, // 水袋：水花
    eagle:   () => { tone({ type: 'sawtooth', f0: 1500, f1: 900, dur: 0.28, g: 0.12, a: 0.02, lp: 3200 }); tone({ type: 'sawtooth', f0: 1600, f1: 1000, dur: 0.32, g: 0.12, a: 0.02, lp: 3200, at: 0.3 }); }, // 大鷹：兩聲尖嘯（飛進來時打不到，先聽到）
    aurochs: () => { tone({ type: 'sawtooth', f0: 110, f1: 60, dur: 0.8, g: 0.28, a: 0.04, lp: 700, vib: [14, 12] }); [0, 0.18, 0.36, 0.54].forEach(t => noise({ f0: 160, dur: 0.08, g: 0.3, at: t })); }, // 野牛：低吼＋四下蹄聲
    throw:   () => noise({ filt: 'bandpass', f0: 2200, q: 2, dur: 0.04, g: 0.16 }),                                 // 強盜丟石：跟石子射出同款、音高低一點
    // ====== 期 4：成就解鎖——四聲上行琶音＋高處一聲長鈴＋一點閃光噪音 ======
    achieve: () => { [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.5, g: 0.18, a: 0.01, at: i * 0.11 })); tone({ f0: 2093, dur: 1.2, g: 0.08, a: 0.02, at: 0.45 }); noise({ filt: 'highpass', f0: 6000, dur: 0.4, g: 0.05, a: 0.05, at: 0.45 }); },
  };

  function play(name) {
    if (!prefs.sfx || !SFX[name]) return;
    const c = ensure(); if (!c || c.state === 'closed') return;
    if (c.state !== 'running') wake(); // 排進去的音會等 context 醒來再出，不會掉
    const t = c.currentTime, gap = GAP[name] || 0;
    if (gap && lastAt[name] !== undefined && t - lastAt[name] < gap) return;
    lastAt[name] = t;
    try { SFX[name](); } catch (e) {}
  }

  // ====== 環境音：蟲鳴（高頻噪音＋快速顫動，循環） ======
  function startAmb() {
    if (!prefs.amb || !prefs.sfx || amb) return;
    const c = ensure(); if (!c || c.state === 'closed') return;
    if (c.state !== 'running') { wake(); return; } // 醒來後 wake 會再叫一次
    const s = c.createBufferSource(); s.buffer = noiseBuffer(); s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 4300; f.Q.value = 9;
    const g = c.createGain(); g.gain.value = 0.0001;
    const lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 17; // 每秒十幾下的「唧唧」
    const depth = c.createGain(); depth.gain.value = 0.05;
    const slow = c.createOscillator(); slow.frequency.value = 0.4; const sd = c.createGain(); sd.gain.value = 0.02; // 慢慢起伏，像遠近不同的蟲
    lfo.connect(depth); depth.connect(g.gain); slow.connect(sd); sd.connect(g.gain);
    s.connect(f); f.connect(g); g.connect(master);
    g.gain.setTargetAtTime(0.055, c.currentTime, 1.2);
    s.start(); lfo.start(); slow.start();
    amb = { s, lfo, slow, g };
  }
  function stopAmb() {
    if (!amb) return;
    const a = amb; amb = null;
    try { a.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3); setTimeout(() => { try { a.s.stop(); a.lfo.stop(); a.slow.stop(); } catch (e) {} }, 800); } catch (e) {}
  }
  // 對局開始／結束叫這個：想要蟲鳴就放，離開對局就收
  function ambient(on) { ambWanted = on; if (on) startAmb(); else stopAmb(); }

  // ====== 背景音樂（期 5）：生成式，三章各一套 ======
  // 每一「小節」（bar 秒）換一個和弦：三個略微失諧的三角波經低通慢慢推上來、慢慢收；旋律每 1.5–3 秒有六成機率從五聲音階裡挑一個音，短而輕
  // 不用音檔：沒有授權問題、檔案 0 KB；想換真曲子的話在這裡換成 AudioBufferSource 就好
  const MUSIC_LEVEL = 0.45; // 音樂相對音效的比例（音效 1.0）；不進壓縮器所以壓低一點
  const MUSIC = {
    1: { root: 146.83, scale: [0, 3, 5, 7, 10], chords: [[0, 3, 7], [3, 7, 10], [7, 10, 14], [10, 14, 17]], bar: 6, lp: 700, pad: 0.11, mel: 0.6, note: 1.4 },   // 守夜：D 小調五聲，溫的
    2: { root: 123.47, scale: [0, 3, 5, 8, 10], chords: [[0, 3, 7], [0, 3, 7, 10], [5, 8, 12], [3, 7, 10]], bar: 7, lp: 450, pad: 0.12, mel: 0.4, note: 1.8 }, // 另外的羊：更低、更暗、旋律更少
    3: { root: 164.81, scale: [0, 2, 4, 7, 9], chords: [[0, 7, 12], [5, 12, 17], [7, 14, 19], [0, 7, 12]], bar: 5.5, lp: 900, pad: 0.1, mel: 0.7, note: 1.2 },  // 諸山間：空五度、大調五聲，開闊
  };
  let music = null; // { cfg, timers, bar, seed, out }：out 是這一局音樂自己的 gain，停的時候淡出再斷線，已經排出去的和弦尾巴才不會拖進結算頁（小居 11/1）
  const semi = (root, n) => root * Math.pow(2, n / 12);
  function musicRng() { music.seed = (music.seed * 1664525 + 1013904223) >>> 0; return music.seed / 4294967296; }
  function padChord(cfg, chord) {
    const t = now(), dur = cfg.bar + 2.5;
    for (const n of chord) for (const d of [-6, 0, 7]) tone({ type: 'triangle', f0: semi(cfg.root, n), dur, g: cfg.pad / 3, a: 2.2, lp: cfg.lp, out: music.out, detune: d });
  }
  function melNote(cfg) {
    const n = cfg.scale[Math.floor(musicRng() * cfg.scale.length)] + (musicRng() < 0.5 ? 12 : 24);
    tone({ type: 'sine', f0: semi(cfg.root, n), dur: cfg.note, g: 0.07, a: 0.04, out: music.out });
    tone({ type: 'triangle', f0: semi(cfg.root, n), dur: cfg.note * 0.6, g: 0.03, a: 0.04, lp: 1800, out: music.out });
  }
  function musicTick() {
    if (!music) return;
    const cfg = music.cfg; const c = ctx;
    if (c.state !== 'running') { music.timers.push(setTimeout(musicTick, 800)); return; } // 背景被暫停：等醒來再接
    padChord(cfg, cfg.chords[music.bar % cfg.chords.length]); music.bar++;
    music.timers.push(setTimeout(musicTick, cfg.bar * 1000));
  }
  function melTick() {
    if (!music) return;
    const cfg = music.cfg;
    if (ctx.state === 'running' && musicRng() < cfg.mel) melNote(cfg);
    music.timers.push(setTimeout(melTick, (1500 + musicRng() * 1500)));
  }
  // 對局開始叫 Sound.music(章號)、離開叫 Sound.music(null)。關著音樂時只記得「想放哪一章」，之後打開就接上
  let musicWanted = null;
  function startMusic() {
    if (music || !musicWanted || !prefs.music) return;
    const c = ensure(); if (!c || c.state === 'closed') return;
    if (c.state !== 'running') wake();
    const out = c.createGain(); out.gain.value = 1; out.connect(mgain);
    music = { cfg: MUSIC[musicWanted] || MUSIC[1], timers: [], bar: 0, seed: 7 + musicWanted * 131, out };
    musicTick(); music.timers.push(setTimeout(melTick, 2500));
  }
  function stopMusic() {
    if (!music) return;
    const m = music; music = null; for (const t of m.timers) clearTimeout(t);
    try { m.out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3); setTimeout(() => { try { m.out.disconnect(); } catch (e) {} }, 1500); } catch (e) {} // 淡出一秒再斷線：已排出去的振盪器跟著這個節點一起沒聲音
  }
  function setMusic(ch) { musicWanted = ch || null; if (musicWanted) { if (music && music.cfg !== (MUSIC[musicWanted] || MUSIC[1])) stopMusic(); startMusic(); } else stopMusic(); }

  // ====== 設定 ======
  function set(k, v) {
    if (k === 'sfx') prefs.sfx = !!v; else if (k === 'amb') prefs.amb = !!v; else if (k === 'music') prefs.music = !!v; else if (k === 'vol') prefs.vol = [0, 1, 2].includes(v) ? v : 1; else return;
    save();
    if (master) master.gain.setValueAtTime(prefs.sfx ? VOLS[prefs.vol] : 0, ctx.currentTime); // 立刻生效，切回來那一下的確認音才聽得到
    if (mgain) mgain.gain.setValueAtTime(prefs.music ? VOLS[prefs.vol] * MUSIC_LEVEL : 0, ctx.currentTime);
    if (k === 'sfx' || k === 'amb') { if (prefs.amb && prefs.sfx && ambWanted) startAmb(); else stopAmb(); }
    if (k === 'music') { if (prefs.music) startMusic(); else stopMusic(); }
  }
  // 切到背景整個停掉（省電、也不會在口袋裡叫），回來再接上
  function suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); }
  function resume() { wake(); }

  root.Sound = { unlock, play, ambient, music: setMusic, set, suspend, resume, attach, prefs, names: Object.keys(SFX), state: () => (ctx ? ctx.state : 'none') };
})(typeof window !== 'undefined' ? window : globalThis);
