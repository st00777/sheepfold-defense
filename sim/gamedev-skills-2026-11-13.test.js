// 2026-11-13：對照 gamedev-skills（awesome-gamedev-agent-skills）塔防／手感文件後做的四項——下一波組成預告、減少動態開關、頭目倒下大級回饋、模擬器每波壓力。
// 報告在 docs/review-gamedev-skills-2026-11-13.md。視覺本機 Chrome 看過；這裡守「東西還接著」＋存檔 v7 的遷移與 validate 真的跑。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const src = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const html = src('index.html'), render = src('render.js'), sound = src('sound.js'), sim = src('sim/simulate.js');
const D = require('../data.js');
const Save = require('../save.js');
const OPTS = { levelIds: D.LEVELS.map(L => L.id), diffs: Object.keys(D.DIFFS), units: Object.keys(D.UNITS) };

test('下一波預告：#next-wave 在棋盤場景裡、draw 每幀呼叫、只在準備與休息且還有下一波時顯示、同一波不重排、換局會重畫', () => {
  assert.match(html, /<div id="scene"><div id="next-wave" hidden><\/div>/);
  assert.match(html, /#next-wave \{ position: absolute; left: 50%; top: 6px;[^}]*pointer-events: none;/, '貼在棋盤上方的天空、不擋點擊');
  assert.match(html, /`第 \$\{G\.wave\} \/ \$\{n\} 波`\);\s*drawNextWave\(\);/);
  assert.match(html, /const show = !G\.over && !G\.holdWaves && \(G\.phase === 'prep' \|\| G\.phase === 'rest'\) && G\.wave < G\.waves\.length;/);
  assert.match(html, /if \(nwG !== G\) \{ nwG = G; nwKey = ''; \}/, '新的一局要重畫，不能沿用上一局的內容');
  assert.match(html, /if \(key === nwKey\) return; nwKey = key;/);
  assert.match(html, /for \(const \[t, k\] of G\.waves\[G\.wave\]\.list\) sum\.set\(t, \(sum\.get\(t\) \|\| 0\) \+ k\);/, '同一種分兩段來的合成一筆');
  assert.match(html, /icoImg\(icoKey\(d\), d\.ico\)/, '取圖走 icoKey，快狼／領頭狼才不會畫成狼');
});

test('減少動態：存檔 v7 多 prefs.motion（null 跟系統），v6 升上來補 null，validate 只收明確的布林', () => {
  assert.strictEqual(Save.VERSION, 7);
  const v6 = { version: 6, created: '2026-11-01T00:00:00.000Z', updated: '2026-11-01T00:00:00.000Z', progress: { cleared: { 1: { calm: true } }, best: {}, stars: {} }, checkpoints: {}, loadouts: {}, seen: { intro: [], cards: [], enemies: [] }, tutorial: false, prefs: { diff: 'calm', speed: 1, big: false, lite: null, contrast: true, sound: { sfx: true, amb: false, music: true, vol: 1 }, analytics: true }, trials: { cleared: {}, best: {}, checkpoints: {}, loadouts: {} }, achievements: {}, announced: '', playerKind: '' };
  const st = Save.memoryStore({ [Save.KEY]: JSON.stringify(v6) });
  const S = Save.open(st, OPTS);
  assert.strictEqual(S.status, 'ok'); assert.strictEqual(S.data.version, 7);
  assert.strictEqual(S.data.prefs.motion, null); assert.strictEqual(S.data.prefs.contrast, true, '其餘原樣');
  assert.ok(st.get(Save.KEY).startsWith('{"version":7'));
  assert.strictEqual(st.get(Save.BAK), JSON.stringify(v6), '升版那一次的備份留著 v6 原文');
  for (const [input, want] of [[true, true], [false, false], [null, null], ['yes', null], [1, null], [undefined, null]]) {
    assert.strictEqual(Save.validate({ version: 7, prefs: { motion: input } }, OPTS).data.prefs.motion, want, `motion 輸入 ${String(input)}`);
  }
  assert.strictEqual(Save.empty().prefs.motion, null);
  const code = Save.encode(Save.empty()); assert.match(code, /^SF7\./);
});

test('減少動態：三邊看同一個來源——CSS 走 html.reduce 不寫媒體查詢、index.html 走 reduceMotion()、render.js 走 setReduce；設定頁第八根蠟燭', () => {
  assert.strictEqual((html.match(/@media \(prefers-reduced-motion/g) || []).length, 0, 'CSS 不能再直接寫媒體查詢，不然自家開關管不到');
  assert.strictEqual((html.match(/REDUCE_MOTION\.matches/g) || []).length, 2, '只剩 reduceMotion() 與 applyMotion 裡「沒設過就跟系統」兩處直接讀系統');
  assert.ok((html.match(/reduceMotion\(\)/g) || []).length >= 9);
  assert.match(html, /const reduceMotion = \(\) => \(SD\.prefs\.motion === null \|\| SD\.prefs\.motion === undefined\) \? REDUCE_MOTION\.matches : !!SD\.prefs\.motion;/);
  assert.match(html, /document\.documentElement\.classList\.toggle\('reduce', on\); if \(Board\.setReduce\) Board\.setReduce\(unset \? null : !!v\);/);
  assert.match(html, /\$\('#motion-btn'\)\.addEventListener\('click', \(\) => \{ applyMotion\(!reduceMotion\(\)\);/);
  assert.match(html, /REDUCE_MOTION\.addEventListener\('change'/, '沒設過時系統設定中途變了要跟著變');
  assert.match(html, /<div class="snd-row"><span>減少動態<\/span><button class="cdl" id="motion-btn"/);
  for (const sel of ['html.reduce .snd-row button.cdl.on::after { animation: none; }', 'html.reduce #achv-card:not([hidden]) .dialog { animation: ach-fade 200ms both !important; }', 'html.reduce #epilogue .ep-roll > div { animation: none; }', 'html.reduce #epilogue .ep-bg, html.reduce #epilogue .ep-body { transition: none; }', 'html.reduce .card.new::after { animation: none; opacity: .8; }', 'html.reduce #stars .st, html.reduce #stars.full .st.on { animation: none; opacity: 1; }', 'html.reduce .dialog { transition: opacity 200ms; }', 'html.reduce :is(.card, .btn, .diff, .tab, .lv, .rc, #pause-btn, #snd-btn, .corner, .snd-row button, #tut-skip):active { transform: none; }']) {
    assert.ok(html.includes(sel), '五段減少動態 CSS 都要改成 html.reduce：' + sel);
  }
  assert.match(render, /let reducePref = null;[^\n]*\n\s*const reduce = \(\) => reducePref === null \? REDUCE\.matches : reducePref;/);
  assert.match(render, /setReduce\(v\) \{ reducePref = typeof v === 'boolean' \? v : null; \},/);
  assert.match(html, /<script src="save\.js\?v=8">/); assert.match(html, /<script src="render\.js\?v=32">/); assert.match(html, /<script src="sound\.js\?v=11">/);
});

test('頭目倒下：die 事件看 ENEMIES[type].boss 才走 bossDown（外框抖＋金邊＋bossdown 音）；render 的 dieFx 頭目多金圈與碎石、淡出 0.45 秒；外框抖動抽成 frameShake 登場倒下共用', () => {
  assert.match(html, /case 'die': Sound\.play\('die'\); if \(ENEMIES\[e\.e\.type\] && ENEMIES\[e\.e\.type\]\.boss\) bossDown\(\); Board\.event\(e, G\); break;/);
  assert.match(html, /function bossDown\(\) \{ Sound\.play\('bossdown'\); const f = \$\('#frame'\); if \(!f\) return; frameShake\(f\);/);
  assert.match(html, /function frameShake\(f\) \{ if \(!reduceMotion\(\) && speed <= 1\) f\.animate\(/, '減少動態或加速時不抖');
  assert.strictEqual((html.match(/frameShake\(f\);/g) || []).length, 2, '登場與倒下各呼叫一次');
  assert.match(sound, /\n\s*bossdown: \(\) => \{ tone\(\{ f0: 110, f1: 45/);
  assert.match(render, /const boss = !!\(ENEMIES\[e\.type\] && ENEMIES\[e\.type\]\.boss\);/);
  assert.match(render, /if \(boss\) \{ ring\(c\.x, c\.y, cw \* 1\.3, 0xffd166, \.55\); burst\(/);
  assert.match(render, /tween\(boss \? \.45 : \.22, k => \{ c\.alpha = 1 - k;/);
  const bosses = Object.keys(D.ENEMIES).filter(k => D.ENEMIES[k].boss);
  assert.ok(bosses.includes('lion') && bosses.includes('leopard') && bosses.includes('bear') && bosses.includes('alpha'), '頭目名單：' + bosses.join(' '));
});

test('模擬器：每局多回 waveMin（每波最近幾格），run 與 compare 都印「每波」；只算打到那一波的局', () => {
  assert.match(sim, /const waveMin = \[\];/);
  assert.match(sim, /const wi = G\.wave - 1; if \(wi >= 0 && \(waveMin\[wi\] === undefined \|\| e\.x < waveMin\[wi\]\)\) waveMin\[wi\] = e\.x;/);
  assert.match(sim, /sheepLost: G\.sheepLost, minX, waveMin \};/);
  assert.match(sim, /function waveAvg\(res\)/);
  assert.match(sim, /最近 \$\{press\.toFixed\(2\)\} 格 每波 \$\{waveAvg\(res\)\}/);
  assert.match(sim, /每波 \$\{waveAvg\(res\)\}  失羊/);
  const SIM = require('./simulate.js');
  const r = SIM.play ? SIM.play(1, 'calm', 1000, 'good') : null;
  if (r) { assert.ok(Array.isArray(r.waveMin) && r.waveMin.length >= 1 && r.waveMin.length <= 3, '第 1 夜三波：' + JSON.stringify(r.waveMin)); for (const x of r.waveMin) if (x !== undefined) assert.ok(x >= -1 && x <= 8); }
});

test('更新紀錄 2026.11.13 三條在最前面，首頁一句話也換了', () => {
  assert.match(html, /const CHANGELOG = \[\s*\{ ver: '2026\.11\.13', notes: \[/);
  assert.match(html, /const HOME_UPDATE = '最近更新 11\/13/);
  const block = html.slice(html.indexOf("{ ver: '2026.11.13'"), html.indexOf("{ ver: '2026.11.08'"));
  assert.strictEqual((block.match(/^\s+'/gm) || []).length, 3);
});
