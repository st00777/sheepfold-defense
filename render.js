// 羊圈守夜 · 棋盤畫面（PixiJS）。2026-10-23 起棋盤從 DOM 格子改成 canvas 畫：光、火、粒子、天色都在這裡。
// 分工：index.html 管流程（關卡、卡片列、暫停、結算、存檔、音效、看門的走道與外框），這裡只管「棋盤裡面」怎麼畫、玩家點了哪一格。
// 引擎（engine.js）一行不動：這裡只讀 G 的狀態、聽 G.events 裡的事件。
// 讀這支檔的順序：Board 的對外介面（最下面）→ 每一幀 frame() → 各層的畫法。
'use strict';
const Board = (() => {
  // ====== 色票（跟 index.html 的 CSS 變數同值；之後換美術兩邊一起改）======
  const UCOL = { shepherd: 0x3d6ea8, slinger: 0xa8553d, sling: 0x8a3f2e, hireling: 0x7d7a6a, archer: 0x6b4e2e, wall: 0x777777, tower: 0x5c5c66, dog: 0xc9a24a, thorns: 0x4a7a3a,
    brazier: 0x6e3a1e, jar: 0x8a5a2e, horn: 0x7a6a2a, healer: 0x3d8a7a, catapult: 0x5a4a3a, staff: 0x8a6a3a, lamp: 0xb8862a, patrol: 0x4a5a7a, volley: 0xa8553d, cradle: 0x7a4a6a };
  const GOLD = 0xe6b84a, DANGER = 0xd9534f, OK = 0x7bc47f, TEXT = 0xf3ead8, ENEMY_RING = 0x8a2f2c;
  // 敵人身體：底色、大小係數 k、形狀（跟 index.html 的 .enemy.* 規則對齊：圓＝獸、方圓＝人、暗紅細圈＝敵、金粗圈＝頭目）
  const BODY_COL = { big: 0x5a3f2a, human: 0x3a3a30, light: 0xa89a7a, small: 0xb8682a, swarm: 0x4a6a28, dig: 0xa8843a, sly: 0x6b5a3a, boar: 0x4a3426, leopard: 0xa8862a };
  const KSIZE = { fast: .8, alpha: 1.2, big: 1.3, lion: 1.4, boar: 1.25, leopard: 1.35 };
  const BREATHERS = new Set(['shepherd', 'hireling', 'healer', 'cradle', 'horn']);
  const FX_TEXT = { blast: '💥', ignite: '🔥', sting: '☠️', flee: '💨', horn: '📯', emerge: '💨', grab: '🐑', splash: '💥', enrage: '😡', rest: '💤', slam: '💥', trample: '💨', home: '💛', strike: '✦', crouch: '👁' };
  const EASE = k => 1 - Math.pow(1 - k, 3); // 跟 CSS 的 cubic-bezier(.23,1,.32,1) 同一種「先快後慢」
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const key = (r, c) => r + ',' + c, unkey = k => k.split(',').map(Number); // 格子鑰匙 'r,c' 與拆回 [r, c]

  const REDUCE = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reduce = () => REDUCE.matches;

  // ====== 狀態 ======
  let app = null, el = null, ICONS = {}, tex = {}, radialTex, bandTex, vignetteTex, dotTex, rainTex, gradTex = {};
  let W = 0, H = 0, cw = 0, ch = 0, layoutN = 0; // layoutN：尺寸變了就 +1，畫面物件看到號碼不同就重建
  let G = null, diff = 'calm', speed = 1, paused = false, still = false, dawned = false, time = 0;
  let onTap = () => {}, onHover = () => {}, onError = () => {};
  const L = {};              // 圖層
  const UN = new Map();      // 單位：key → 畫面物件
  const EN = new Map();      // 敵人：id → 畫面物件
  const MV = new Map();      // 狗、巡夜人、迷羊：id → 畫面物件
  const SH = new Map();      // 投射物：id → 畫面物件
  const holes = new Map();   // 無月夜油燈挖出的亮帶：單位 key → 兩個 erase 精靈
  const mounds = new Map();  // 鑽地的土堆：敵人 id → 圖
  const particles = [], tweens = [];
  const state = { hints: new Map(), range: new Set(), teach: null, litRows: [false, false, false, false, false], dark: false, cellsDirty: true, dusk: 0, dawn: 0, lose: 0, flash: 0, bolt: null, dust: 0 };
  let marker = null, strayMark = null, rainAcc = 0, shake = 0;

  // ====== 啟動：載圖、建圖層 ======
  async function init(opts) {
    el = opts.el; ICONS = opts.icons || {}; onTap = opts.onTap || onTap; onHover = opts.onHover || onHover; onError = opts.onError || onError;
    if (typeof PIXI === 'undefined') return false;
    // 整段包起來：建 renderer、載圖、做貼圖任何一步丟例外都算「開不了」，app 歸零讓 index.html 顯示說明（不然 ready 會是 true、圖層卻只建一半）
    try {
      app = new PIXI.Application();
      await app.init({ resizeTo: el, backgroundAlpha: 0, antialias: true, autoStart: false, sharedTicker: false, preference: 'webgl', resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true });
      el.appendChild(app.canvas);
      // 圖一張一張載：哪張載不到就那張退回系統 emoji 文字，不會整批空白
      const files = new Set(Object.values(ICONS));
      await Promise.all([...files].map(f => PIXI.Assets.load({ alias: f, src: `img/ico/${f}.webp` }).then(t => { tex[f] = t; }, () => { tex[f] = null; })));
      await PIXI.Assets.load({ alias: 'ground', src: 'img/ground.webp' }).then(t => { tex.ground = t; }, () => { tex.ground = null; });
      makeTextures(); buildLayers(); bindPointer();
      // 盒子大小變了就重排並立刻畫一幀（暫停中沒有 tick，不畫會留白）；延到下一幀做，不然在回呼裡改 canvas 尺寸會被瀏覽器記一筆「ResizeObserver loop」警告
      if (typeof ResizeObserver !== 'undefined') { let queued = false; new ResizeObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; if (app) { app.resize(); frame(G, 0); } }); }).observe(el); }
      // iOS 切去別的 App 再回來常見 WebGL context lost：Pixi 會自己把一般貼圖重傳，這裡補上 generateTexture 做的兩張與離屏黑暗貼圖，並把會動的東西重建
      app.canvas.addEventListener('webglcontextrestored', () => { try { makeDotTextures(); for (const p of particles) p.s.destroy(); particles.length = 0; W = H = 0; layout(); frame(G, 0); } catch (e) { report(e); } });
      layout();
    } catch (e) { console.error(e); try { if (app) app.destroy(true); } catch (e2) {} app = null; return false; }
    return true;
  }
  // 程式畫的貼圖：柔光圓（燈、火、拖尾、受擊）、橫向亮帶（油燈照整排）、暗角、小圓點（粒子）、雨絲、三種天色漸層
  function makeTextures() {
    const cv = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return PIXI.Texture.from(c); };
    radialTex = cv(256, 256, (g, w, h) => { const r = g.createRadialGradient(128, 128, 0, 128, 128, 128); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.35, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
    bandTex = cv(16, 256, (g, w, h) => { const r = g.createLinearGradient(0, 0, 0, h); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(.18, 'rgba(255,255,255,1)'); r.addColorStop(.82, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
    vignetteTex = cv(512, 360, (g, w, h) => { const r = g.createRadialGradient(256, 180, 130, 256, 180, 330); r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
    const grad = (stops) => cv(8, 256, (g, w, h) => { const r = g.createLinearGradient(0, 0, 0, h); for (const [o, c] of stops) r.addColorStop(o, c); g.fillStyle = r; g.fillRect(0, 0, w, h); });
    gradTex.dusk = grad([[0, '#ffb45a'], [.55, '#ff7a3a'], [1, '#4a2a60']]);
    gradTex.dawn = grad([[0, '#fff3c0'], [.5, '#ffd98a'], [1, '#ffb45a']]);
    gradTex.lose = grad([[0, '#0b1020'], [.6, '#1a1030'], [1, '#06080f']]);
    gradTex.fog = cv(256, 8, (g, w, h) => { const r = g.createLinearGradient(0, 0, w, 0); r.addColorStop(0, 'rgba(10,12,20,0)'); r.addColorStop(1, 'rgba(10,12,20,.8)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
    makeDotTextures();
  }
  function makeDotTextures() { // 這兩張是用 renderer 畫出來的，WebGL context 掉了內容就沒了，恢復時要重做
    dotTex = app.renderer.generateTexture(new PIXI.Graphics().circle(8, 8, 8).fill(0xffffff));
    rainTex = app.renderer.generateTexture(new PIXI.Graphics().roundRect(0, 0, 2, 18, 1).fill(0xffffff));
  }
  function buildLayers() {
    // 由下往上：草地 → 格子底色與提示 → 圍欄 → 腳印與土堆 → 單位 → 火光（相加）→ 會動的（敵人、狗、投射物）→ 效果 → 黑暗 → 天氣 → 天色 → 飄字 → 暗角
    for (const n of ['ground', 'cells', 'marks', 'units', 'glow', 'movers', 'shots', 'fx', 'hints', 'dark', 'weather', 'sky', 'text', 'top']) { L[n] = new PIXI.Container(); app.stage.addChild(L[n]); }
    L.groundSpr = tex.ground ? new PIXI.Sprite(tex.ground) : new PIXI.Graphics(); L.ground.addChild(L.groundSpr);
    L.cellG = new PIXI.Graphics(); L.cells.addChild(L.cellG);
    L.hintG = new PIXI.Graphics(); L.cells.addChild(L.hintG);
    L.teachG = new PIXI.Graphics(); L.cells.addChild(L.teachG); // 教學金框自己一層：它每幀在呼吸，不能連累整張格子重畫
    L.fence = new PIXI.Graphics(); L.cells.addChild(L.fence);
    L.glow.blendMode = 'add';
    L.darkRT = null; L.darkSpr = new PIXI.Sprite(); L.dark.addChild(L.darkSpr);
    L.darkScene = new PIXI.Container(); L.darkFill = new PIXI.Graphics(); L.darkScene.addChild(L.darkFill);
    L.fogs = []; for (let r = 0; r < ROWS; r++) { const f = new PIXI.Sprite(gradTex.fog); L.darkScene.addChild(f); L.fogs.push(f); }
    L.darkHoles = new PIXI.Container(); L.darkScene.addChild(L.darkHoles);
    L.litG = new PIXI.Graphics(); L.cells.addChildAt(L.litG, 1); // 被照亮的排：草地轉暖亮——畫在格子底色之上、單位之下，才不會把亮排裡的敵人染黃
    L.stormRect = new PIXI.Graphics(); L.weather.addChild(L.stormRect);
    L.flashRect = new PIXI.Graphics(); L.weather.addChild(L.flashRect);
    L.skySpr = new PIXI.Sprite(gradTex.dusk); L.skySpr.alpha = 0; L.sky.addChild(L.skySpr);
    L.vig = new PIXI.Sprite(vignetteTex); L.top.addChild(L.vig);
  }
  function layout() {
    const w = app.screen.width, h = app.screen.height;
    if (!w || !h || (w === W && h === H)) return;
    W = w; H = h; cw = W / COLS; ch = H / ROWS; layoutN++;
    if (tex.ground) { const gs = L.groundSpr, s = Math.max(W / gs.texture.width, H / gs.texture.height); gs.scale.set(s); gs.x = (W - gs.texture.width * s) / 2; gs.y = (H - gs.texture.height * s) / 2; }
    else L.groundSpr.clear().rect(0, 0, W, H).fill(0x243a2a);
    L.vig.width = W; L.vig.height = H;
    L.skySpr.width = W; L.skySpr.height = H;
    // 左邊 9px 木圍欄（單位底下）
    L.fence.clear().rect(0, 0, 9, H).fill({ color: 0x8a6a3e, alpha: .92 }); for (let y = 10; y < H; y += 13) L.fence.rect(0, y, 9, 3).fill({ color: 0x000000, alpha: .33 }); L.fence.rect(9, 0, 3, H).fill({ color: 0x000000, alpha: .25 });
    if (L.darkRT) L.darkRT.destroy(true);
    L.darkRT = PIXI.RenderTexture.create({ width: W, height: H, resolution: app.renderer.resolution }); L.darkSpr.texture = L.darkRT;
    L.darkFill.clear().rect(0, 0, W, H).fill({ color: 0x060a16, alpha: .22 }); // .22＝舊 DOM 版 brightness(.78) 的暗度；原本 .32 James 真機說太暗（2026-10-23）
    L.fogs.forEach((f, r) => { f.x = W * .78; f.y = r * ch; f.width = W * .22; f.height = ch; });
    state.cellsDirty = state.rocksDirty = true; state.litRows.fill(null); // 照亮的排用舊格子尺寸畫的，填 null 讓 drawDark 下一幀重畫
    for (const [, g] of mounds) drawMound(g);
    // 尺寸變了：會動的東西全部重建（下一幀照新尺寸長回來），單位重畫
    for (const [, v] of EN) v.cont.destroy({ children: true }); EN.clear();
    for (const [, v] of MV) v.cont.destroy({ children: true }); MV.clear();
    for (const [, v] of SH) { v.cont.destroy({ children: true }); if (v.shadow) v.shadow.destroy(); } SH.clear();
    for (const [k] of holes) removeHole(k);
    if (G) { for (const k in G.units) renderUnit(G.units[k].r, G.units[k].c); for (const k of [...UN.keys()]) if (!G.units[k]) renderUnit(...unkey(k)); }
    if (marker) setMarker(marker.r, marker.type); if (strayMark) setStrayMark(strayMark.r);
  }
  // 點棋盤：算出是哪一格交給 index.html；滑過／按住則用來預覽範圍
  function bindPointer() {
    app.stage.eventMode = 'static'; app.stage.hitArea = app.screen;
    const cellAt = p => { const c = Math.floor(p.x / cw), r = Math.floor(p.y / ch); return (c >= 0 && c < COLS && r >= 0 && r < ROWS) ? [r, c] : null; };
    let hoverKey = '';
    app.stage.on('pointertap', e => { const rc = cellAt(e.global); if (rc) onTap(rc[0], rc[1]); });
    const hover = e => { const rc = cellAt(e.global); const k = rc ? key(rc[0], rc[1]) : ''; if (k === hoverKey) return; hoverKey = k; onHover(rc ? rc[0] : null, rc ? rc[1] : null); };
    app.stage.on('pointermove', hover); app.stage.on('pointerdown', hover);
    app.stage.on('pointerleave', () => { hoverKey = ''; onHover(null, null); }); app.stage.on('pointerup', () => { hoverKey = ''; onHover(null, null); });
    app.canvas.addEventListener('contextmenu', e => e.preventDefault()); // 手機長按棋盤（按住看範圍）會跳系統選單，擋掉；舊 DOM 版靠格子本身沒有可選內容，canvas 要明講
  }

  // ====== 每一幀：index.html 的 tick 呼叫；回報「有人在咬」與新出手數給它放音效 ======
  function frame(g, dt) {
    if (!app) return { biting: false, shots: 0 };
    G = g; layout();
    if (!paused) time += dt;
    const info = { biting: false, shots: 0 };
    if (!G) { app.render(); return info; }
    try {
      drawCells(); drawUnits(dt); info.biting = drawEnemies(dt); drawMovers(dt); info.shots = drawShots(dt); drawMarks();
      if (!paused) { updateParticles(dt); updateTweens(dt); drawSky(dt); drawWeather(dt); }
      drawDark(dt);
    } catch (err) { report(err); }
    app.render();
    return info;
  }
  // 畫面層自己出錯不該讓玩家被踢回關卡（引擎還好好的）：記下來、每局只通知一次，遊戲照走
  let errCount = 0, lastError = '';
  function report(err) {
    errCount++; lastError = String(err && err.stack || err);
    if (errCount === 1) { console.error(err); try { onError(lastError); } catch (e) {} }
  }

  // ====== 格子：底色、石頭、提示框、範圍、教學高亮、照亮的排 ======
  function drawCells() {
    // 教學金框每幀呼吸，畫在自己那層；底色、石頭、提示框只在變了的時候重畫
    const t = L.teachG.clear();
    if (state.teach) { const [r, c] = state.teach; const pulse = reduce() ? .8 : .5 + .5 * Math.abs(Math.sin(time * 1.75)); // 一呼吸 1.8 秒（跟 DOM 版 glowFade .9s alternate 同）
      t.rect(c * cw + 5, r * ch + 5, cw - 10, ch - 10).stroke({ width: 3, color: GOLD }); t.rect(c * cw + 2, r * ch + 2, cw - 4, ch - 4).stroke({ width: 8, color: GOLD, alpha: .35 * pulse }); }
    if (!state.cellsDirty) return; state.cellsDirty = false;
    const g = L.cellG.clear();
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const rock = G && G.rocks.has(key(r, c)), alt = (r + c) % 2;
      g.rect(c * cw, r * ch, cw, ch).fill(rock ? { color: 0x5a5650, alpha: 1 } : alt ? { color: 0x5f7f46, alpha: .72 } : { color: 0x4f6b3a, alpha: .80 });
      g.rect(c * cw + .5, r * ch + .5, cw - 1, ch - 1).stroke({ width: 1, color: 0xffffff, alpha: .06 });
    }
    // 石頭格畫一顆石頭
    if (state.rocksDirty) { state.rocksDirty = false; for (const sp of L.cells.children.filter(x => x.isRock)) sp.destroy();
    if (G) for (const k of G.rocks) { const [r, c] = unkey(k); const s = makeIcon('🪨', ch * .4); s.alpha = .7; s.x = (c + .5) * cw; s.y = (r + .5) * ch; s.isRock = true; L.cells.addChild(s); } }
    const h = L.hintG.clear();
    // 範圍預覽：淡金蓋底色
    for (const k of state.range) { const [r, c] = unkey(k); h.rect(c * cw, r * ch, cw, ch).fill({ color: GOLD, alpha: .23 }); }
    // 提示框：空地虛線金框、可直接換的金實線、鏟子時紅虛線
    for (const [k, kind] of state.hints) { const [r, c] = unkey(k); const x = c * cw + 4, y = r * ch + 4, w = cw - 8, hh = ch - 8;
      if (kind === 'swap') h.rect(x, y, w, hh).stroke({ width: 2, color: GOLD }); else dashRect(h, x, y, w, hh, kind === 'sell' ? DANGER : GOLD); }
  }
  function dashRect(g, x, y, w, h, color) { // Pixi 沒有虛線：自己一段一段畫
    const seg = 6, gap = 4; const edge = (x0, y0, x1, y1) => { const len = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(len / (seg + gap)); for (let i = 0; i <= n; i++) { const a = i * (seg + gap) / len, b = Math.min(1, (i * (seg + gap) + seg) / len); if (a >= 1) break; g.moveTo(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a).lineTo(x0 + (x1 - x0) * b, y0 + (y1 - y0) * b); } };
    edge(x, y, x + w, y); edge(x + w, y, x + w, y + h); edge(x + w, y + h, x, y + h); edge(x, y + h, x, y); g.stroke({ width: 2, color });
  }
  function setHints(map) { state.hints = map || new Map(); state.cellsDirty = true; }
  function setRange(list) { state.range = new Set((list || []).map(([r, c]) => key(r, c))); state.cellsDirty = true; }
  function setTeach(rc) { state.teach = rc || null; }

  // 圖示：有圖用圖，沒圖（載不到）退回系統 emoji 文字
  function makeIcon(emoji, size) {
    const f = ICONS[emoji], t = f && tex[f];
    if (t) { const s = new PIXI.Sprite(t); s.anchor.set(.5); s.width = s.height = size; return s; }
    const txt = new PIXI.Text({ text: emoji, style: { fontSize: size * .85, fontFamily: '-apple-system, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif' } }); txt.anchor.set(.5); return txt;
  }
  function makeText(text, size, fill, bold) {
    const t = new PIXI.Text({ text: String(text), style: { fontSize: size, fill, fontWeight: bold ? 'bold' : 'normal', fontFamily: '-apple-system, "PingFang TC", "Noto Sans TC", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif', stroke: { color: 0x000000, width: 3 } } });
    t.anchor.set(.5); return t;
  }
  function hpBar(g, w, y, f, color, thick) { g.clear().rect(-w / 2, y, w, thick ? 5 : 3).fill({ color: 0x000000, alpha: .4 }); if (f > 0) g.rect(-w / 2, y, w * f, thick ? 5 : 3).fill(color); }

  // ====== 單位（格子裡的）======
  function renderUnit(r, c) {
    const k = key(r, c), u = G && G.units[k];
    const old = UN.get(k);
    if (old) { old.cont.destroy({ children: true }); if (old.glow) old.glow.destroy(); if (old.up) old.up.destroy({ children: true }); removeHole(k); UN.delete(k); }
    if (!u) return;
    const def = UNITS[u.type];
    const cont = new PIXI.Container(); cont.x = (c + .5) * cw; cont.y = (r + .5) * ch; L.units.addChild(cont);
    const inner = new PIXI.Container(); cont.addChild(inner); // inner：放下壓扁、回彈、跳一下都動這層；cont 只放位置
    const bg = new PIXI.Graphics(); inner.addChild(bg);
    const icoEmoji = def.kind === 'dog' ? '🦴' : def.kind === 'patrol' ? '🪵' : def.ico; // 狗窩、巡夜人的崗位：人在外面走
    const isMark = def.kind === 'dog' || def.kind === 'patrol';
    const spr = makeIcon(icoEmoji, ch * (isMark ? .32 : .5)); spr.y = -ch * .04; inner.addChild(spr);
    const v = { cont, inner, bg, spr, u, def, hpLast: -1, phase: (r * COLS + c) % 8 * .6, recoil: 0, hop: 0, glow: null, cd: null, up: null, upText: '', ready: null, elderWas: u.elder, upWas: u.upgraded, fearWas: u.fear > 0 };
    if (isMark) inner.alpha = .35;
    // 升級角標（蠍子、銀號、膏油）：手機上要看得出是什麼，圖示約 12px
    if (u.upgraded && def.upgrade && def.upgrade.ico) { const b = new PIXI.Container(); b.addChild(new PIXI.Graphics().roundRect(-ch * .17, -ch * .14, ch * .34, ch * .28, 6).fill({ color: 0x000000, alpha: .65 })); const bi = makeIcon(def.upgrade.ico, ch * .26); b.addChild(bi); b.x = cw * .32; b.y = -ch * .32; inner.addChild(b); }
    if (def.push) { v.cd = new PIXI.Graphics(); inner.addChild(v.cd); }
    if (u.maxHp > 1 && def.kind !== 'dog') { v.hp = new PIXI.Graphics(); inner.addChild(v.hp); }
    if (u.type === 'brazier' || u.type === 'lamp') { const gl = new PIXI.Sprite(radialTex); gl.anchor.set(.5); gl.blendMode = 'add'; gl.tint = u.type === 'lamp' ? 0xffc46a : 0xff8a3a; gl.x = cont.x; gl.y = cont.y; L.glow.addChild(gl); v.glow = gl; }
    UN.set(k, v); drawUnitBg(v);
  }
  function drawUnitBg(v) {
    const u = v.u, t = u.type, w = cw * .8, h = ch * .8, g = v.bg.clear();
    if (t === 'thorns') { dashCircle(g, 0, 0, Math.min(w, h) / 2, u.upgraded ? 0xc9d46a : 0xf3ead8, u.upgraded ? 1 : .4); g.circle(0, 0, Math.min(w, h) / 2).fill({ color: 0xf3ead8, alpha: .13 }); }
    else if (t === 'staff') g.roundRect(-w / 2, -h / 2, w, h, 8).stroke({ width: 2, color: 0xc9a24a, alpha: .6 });
    else if (t === 'dog' || t === 'patrol') {} // 記號不畫底
    else { g.roundRect(-w / 2, -h / 2, w, h, 8).fill({ color: UCOL[t] || 0x888888, alpha: u.elder ? .85 : 1 });
      if (u.elder || (u.upgraded && (t === 'healer' || t === 'horn'))) g.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, 7).stroke({ width: 2, color: u.elder ? 0xd9a44a : GOLD }); } // 老牧人用暖銅，金色留給升級、提示框與頭目圈，少一種「金」
    v.spr.tint = u.fear > 0 ? 0x9a9a9a : 0xffffff; // 被嚇到：灰掉
  }
  function dashCircle(g, x, y, R, color, alpha) { const n = 14; for (let i = 0; i < n; i++) { const a0 = i / n * 6.283, a1 = (i + .55) / n * 6.283; g.moveTo(x + Math.cos(a0) * R, y + Math.sin(a0) * R); g.arc(x, y, R, a0, a1); } g.stroke({ width: 2, color, alpha }); }
  function drawUnits(dt) {
    const anim = !paused && !still && speed <= 1 && !reduce();
    // 要整格重建的先記下來、迴圈結束再做：迭代 Map 途中刪掉再放回同一把鑰匙，會被再訪問一次而繞不出來（2026-10-23 荊棘撒蠍子後整頁凍住）
    const rebuild = [];
    for (const [k, v] of UN) {
      const u = G.units[k]; if (!u || u !== v.u || u.upgraded !== v.upWas) { rebuild.push(k); continue; } // 單位沒了、引擎換了物件、升級了：整格重建
      if (u.elder !== v.elderWas || (u.fear > 0) !== v.fearWas) drawUnitBg(v); // 老牧人、被嚇：只重畫底色
      v.elderWas = u.elder; v.upWas = u.upgraded; v.fearWas = u.fear > 0;
      if (!paused) { v.recoil = Math.max(0, v.recoil - dt); v.hop = Math.max(0, v.hop - dt); }
      v.inner.x = v.recoil > 0 ? -3 * Math.sin(v.recoil / .09 * Math.PI) : 0;
      v.inner.y = v.inner.pivot.y + (v.hop > 0 ? -ch * .09 * Math.sin((1 - v.hop / .24) * Math.PI) : 0); // pivot.y：放下壓扁時樞紐移到腳底，位置要同量補回，不然那 200ms 整個人往上跳
      if (anim) {
        if (BREATHERS.has(u.type)) { const b = Math.sin((time + v.phase) * 1.3); v.spr.scale.y = v.spr.scale.x * (1 + b * .02); v.spr.y = -ch * .04 - (b + 1) / 2; } // 一次呼吸 4.8 秒（跟 DOM 版 2.4s alternate 同）
        if (v.glow) { const f = .9 + Math.sin(time * 13 + v.phase) * .06 + Math.sin(time * 31) * .04; v.glow.width = v.glow.height = (u.type === 'lamp' ? 2.6 : 1.9) * ch * f; v.glow.alpha = .5; v.spr.rotation = Math.sin(time * 9 + v.phase) * .03; v.spr.alpha = .9 + Math.sin(time * 11 + v.phase) * .1; // 火光晃：光暈大小、圖示微轉＋明暗
          if (Math.random() < dt * (u.type === 'brazier' ? 14 : 5)) spark(v.cont.x, v.cont.y - ch * .1, u.type === 'brazier' ? 0xffa040 : 0xffd080, 1, .03 * ch, -ch * .5, .7, 2.2); }
      } else if (v.glow) { v.glow.width = v.glow.height = (u.type === 'lamp' ? 2.6 : 1.9) * ch; v.glow.alpha = .5; v.spr.alpha = 1; } // 暫停／加速：停在平均大小，不要突然縮放
      if (v.hp && v.hpLast !== u.hp) { v.hpLast = u.hp; hpBar(v.hp, cw * .8, ch * .32, clamp(u.hp / u.maxHp, 0, 1), OK); }
      if (v.cd) { const ready = u.timer <= 0, len = u.cdLen || v.def.every, f = ready ? 1 : clamp(1 - u.timer / len, 0, 1); if (f !== v.cdLast || ready !== v.ready) { v.cdLast = f; v.ready = ready; const w = cw * .8, y = ch * .32 - 5; v.cd.clear().rect(-w / 2, y, w, 3).fill({ color: 0x000000, alpha: .4 }).rect(-w / 2, y, w * f, 3).fill({ color: GOLD, alpha: ready ? 1 : .85 }); if (ready) v.cd.rect(-w / 2 - 1, y - 1, w + 2, 5).stroke({ width: 1, color: GOLD, alpha: .6 }); } }
      // 可升級／修補角標：規則在引擎，這裡只畫；糧夠才出現，出現時跳 4 下
      const up = Engine.tapHint(G, u) || '';
      if (up !== v.upText) { v.upText = up; if (v.up) { v.up.destroy({ children: true }); v.up = null; }
        if (up) { const t = makeText(up, Math.max(10, ch * .17), 0x2b2a26, false); t.style.stroke = null; const b = new PIXI.Container(); b.addChild(new PIXI.Graphics().roundRect(-t.width / 2 - 4, -t.height / 2 - 1, t.width + 8, t.height + 2, 8).fill(GOLD)); b.addChild(t); b.x = v.cont.x - cw * .5 + 2 + t.width / 2 + 4; v.upBase = u.r === 0 ? -ch * .5 + (t.height + 2) / 2 + 4 : -ch * .42; b.y = v.cont.y + v.upBase; L.hints.addChild(b); v.up = b; v.upT = 0; } } // 靠格子左緣對齊，第 0 欄不會被切掉；掛在 hints 層（敵人之上）咬牆的狼才蓋不住「修補」；第 0 排往下挪免得貼頂被裁（美術總監 2026-10-23）
      if (v.up && !reduce()) { v.upT = (v.upT || 0) + (paused ? 0 : dt); v.up.y = v.cont.y + v.upBase - (v.upT < 2.8 ? 3 * Math.abs(Math.sin(v.upT / .7 * Math.PI)) : 0); }
      if (v.def.light !== undefined && keepDark()) ensureHole(k, v.cont.x, v.cont.y, v.def.light); else removeHole(k);
    }
    for (const k of rebuild) renderUnit(...unkey(k));
  }
  // 放下：先壓扁再彈回（200ms），樞紐在腳底；火盆油燈再「點亮」：縮小冒出來、閃一下暖光
  function placed(r, c, kind) {
    const v = UN.get(key(r, c)); if (!v || reduce()) return;
    v.inner.pivot.y = ch * .4; v.inner.y = ch * .4;
    tween(.2, k => { const e = EASE(k); v.inner.scale.set(1.12 + (1 - 1.12) * e, .86 + (1 - .86) * e); }, () => { v.inner.scale.set(1, 1); v.inner.pivot.y = 0; });
    if ((kind === 'brazier' || kind === 'lamp') && speed <= 1) { const s = v.spr, base = s.scale.x; tween(.52, k => { const e = k < .45 ? .6 + (1.3 - .6) * (k / .45) : 1.3 + (1 - 1.3) * EASE((k - .45) / .55); s.scale.set(base * e); if (v.glow) v.glow.alpha = .5 + (k < .45 ? k / .45 : 1 - (k - .45) / .55) * .5; }, () => s.scale.set(base)); }
  }
  function hopUnit(r, c) { const v = UN.get(key(r, c)); if (v && UNITS[v.u.type].kind === 'producer' && speed <= 1 && !reduce()) v.hop = .24; }
  function recoilUnit(r, c) { const v = UN.get(key(r, c)); if (v && speed <= 1 && !reduce()) v.recoil = .09; }
  function squashUnit(r, c) { placed(r, c, null); }

  // 無月夜：油燈照亮上下共 light 排（規則同引擎 rowLit）：黑暗擦掉一條橫跨棋盤的亮帶，燈附近再多擦一圈更亮
  function ensureHole(k, x, y, light) {
    let h = holes.get(k);
    if (!h) { const band = new PIXI.Sprite(bandTex); band.anchor.set(.5); band.blendMode = 'erase'; const near = new PIXI.Sprite(radialTex); near.anchor.set(.5); near.blendMode = 'erase'; h = { band, near }; L.darkHoles.addChild(band, near); holes.set(k, h); }
    const rows = light * 2 + 1;
    h.band.x = W / 2; h.band.y = y; h.band.width = W; h.band.height = ch * rows * 1.12; h.near.x = x; h.near.y = y; h.near.width = cw * 3.4; h.near.height = ch * rows * 1.25;
  }
  function removeHole(k) { const h = holes.get(k); if (h) { h.band.destroy(); h.near.destroy(); holes.delete(k); } }
  const keepDark = () => state.dark || (state.darkA || 0) > .02; // 「還算暗」：黑暗正在退的那一兩秒也算，亮帶與亮排跟著一起淡
  function drawDark(dt) {
    // 腳印消失的那一波起棋盤變暗（跟引擎 markerVisible 同一個時間點）；天亮後不再罩回去
    const dark = !!G && !dawned && !!G.level.moonless && G.wave + (G.phase === 'wave' ? 0 : 1) >= G.level.moonless;
    if (dark !== state.dark) { state.dark = dark; state.darkA = state.darkA || 0; }
    const target = dark ? 1 : 0; // 兩秒左右漸變：照 dt 走（不同 fps 一樣快），暫停時停住
    if (state.darkA === undefined) state.darkA = target; else if (!paused) state.darkA += (target - state.darkA) * Math.min(1, dt * 2.4);
    L.dark.visible = state.darkA > .01; L.litG.visible = L.dark.visible; if (!L.dark.visible) return;
    L.darkSpr.alpha = state.darkA;
    // 照亮的排：黑霧散掉（.6 秒淡）、草地轉暖亮（跟引擎 rowLit 同一套判定）。天亮後黑暗在退的那一兩秒，亮排跟著一起淡掉，不會先全黑再亮
    let changed = false;
    for (let r = 0; r < ROWS; r++) { const lit = keepDark() && !!Engine.rowLit(G, r); if (lit !== state.litRows[r]) { state.litRows[r] = lit; changed = true; } const f = L.fogs[r]; if (!paused) f.alpha += ((lit ? 0 : 1) - f.alpha) * Math.min(1, dt * 5); f.visible = f.alpha > .01; }
    if (changed) { const g = L.litG.clear(); for (let r = 0; r < ROWS; r++) if (state.litRows[r]) for (let c = 0; c < COLS; c++) g.rect(c * cw, r * ch, cw, ch).fill({ color: (r + c) % 2 ? 0x8a9847 : 0x7d8a3f, alpha: .7 }); }
    L.litG.alpha = state.darkA;
    app.renderer.render({ container: L.darkScene, target: L.darkRT, clear: true });
  }

  // ====== 敵人 ======
  function enemyVisual(e) {
    const def = ENEMIES[e.type], cls = (def.cls || '').split(' ').filter(Boolean);
    const cont = new PIXI.Container(); L.movers.addChild(cont);
    let k = 1; for (const c of cls) if (KSIZE[c]) k = KSIZE[c];
    const w = G.waves[G.wave - 1]; if (w && w.hpMul > 1.2) k *= 1 + (w.hpMul - 1) * .2; // 後面幾波血厚的狼大一點
    const fly = cls.includes('fly') || cls.includes('owl'), swarm = cls.includes('swarm'), human = cls.includes('human'), small = cls.includes('small'), dig = cls.includes('dig');
    const boss = cls.includes('alpha') || cls.includes('lion') || cls.includes('leopard');
    const bodyCol = cls.map(c => BODY_COL[c]).find(c => c !== undefined) ?? 0x44444f; // 預設狼灰與蝗蟲綠都調暗，跟草地 #4f6b3a 的明度拉開（美術總監 2026-10-23）
    const br = ch * (small ? .25 : swarm ? .22 : .35) * k;
    const body = new PIXI.Container(); cont.addChild(body);
    const bg = new PIXI.Graphics(); body.addChild(bg);
    if (!fly) {
      if (human) { bg.roundRect(-br, -br, br * 2, br * 2, br * .6).fill(bodyCol); bg.rotation = -.1; }
      else if (cls.includes('boar')) bg.roundRect(-br, -br, br * 2, br * 2, br * .84).fill(bodyCol);
      else bg.circle(0, 0, br).fill(bodyCol);
      if (boss) bg.stroke({ width: 3, color: GOLD }); else if (!swarm) bg.stroke({ width: 1.5, color: ENEMY_RING }); // 暗紅細圈＝敵人、金粗圈＝頭目（要緊接在身體後面：Pixi 的 stroke 只套用到最後一個形狀）
      if (dig) bg.rect(-br, br * .1, br * 2, br).fill(0x5a4a2a); // 鑽地的：上下分色
      if (cls.includes('fast')) bg.rect(br * .9, -2, br * 1.4, 4).fill({ color: 0xf3ead8, alpha: .8 }); // 快狼的速度線（4px、.8，跟一般狼一眼分得開）
    } else { const sh = new PIXI.Graphics().ellipse(0, ch * .36, cw * .18, 3).fill({ color: 0x000000, alpha: .32 }); cont.addChildAt(sh, 0); } // 飛的：腳下影子
    const burnGlow = new PIXI.Sprite(radialTex); burnGlow.anchor.set(.5); burnGlow.blendMode = 'add'; burnGlow.tint = 0xff8a3d; burnGlow.width = burnGlow.height = br * 3.2; burnGlow.alpha = 0; body.addChildAt(burnGlow, 0);
    const spr = makeIcon(def.ico, ch * (small ? .34 : swarm ? .3 : .46) * k); spr.y = fly ? -ch * .12 : -ch * .02; body.addChild(spr);
    const flash = makeIcon(def.ico, spr.width || ch * .46 * k); flash.y = spr.y; flash.blendMode = 'add'; flash.alpha = 0; body.addChild(flash);
    const hp = new PIXI.Graphics(); cont.addChild(hp);
    const st = makeText('', Math.max(9, ch * .16), TEXT, false); st.style.stroke = null; st.y = -ch * .42; cont.addChild(st);
    const v = { cont, body, bg, spr, flash, hp, st, stText: '', hpLast: -1, phase: Math.random() * 6.28, k, fly, swarm, boss, thick: boss || cls.includes('big'), flashT: 0, burnAcc: 0, poisonAcc: 0, shove: 0, dodge: 0, swing: 0, burnGlow, baseW: spr.width, br };
    EN.set(e.id, v); return v;
  }
  function statusText(e) { // 頭上最多兩個圖示，依重要性；緩速與嚎叫不顯示
    const list = []; if (e.enraged) list.push('😡'); if (e.st.panic) list.push('😱'); if (e.st.stun || e.st.distract) list.push('💫'); if (e.st.burn) list.push('🔥'); if (e.st.poison) list.push('☠️');
    return list.slice(0, 2).join('');
  }
  function drawEnemies(dt) {
    const alive = new Set(); let biting = false;
    const anim = !paused && !still && !reduce();
    for (const e of G.enemies) {
      if (e.dead) continue;
      alive.add(e.id); if (e.biting || e.heldBy) biting = true;
      const v = EN.get(e.id) || enemyVisual(e);
      const rv = e.rv === undefined ? e.r : e.rv; // 換排時從舊排滑到新排
      if (!paused) { v.shove = v.shove > 0 ? Math.max(0, v.shove - dt) : 0; v.dodge = Math.max(0, v.dodge - dt); v.swing = Math.max(0, v.swing - dt); }
      const shoveX = v.shove > 0 && v.shoveDx ? -v.shoveDx * cw * (1 - EASE(1 - v.shove / .18)) : 0; // 吹角：從原位滑到新位
      const dodgeK = v.dodge > 0 ? Math.sin((1 - v.dodge / .35) * Math.PI) : 0, dodgeX = reduce() ? 0 : cw * .4 * dodgeK; // 閃避：本體側滑＋變淡（血條不跟著跑）；減少動態只變淡
      v.cont.x = (e.x + .5) * cw + shoveX; v.cont.y = (rv + .5 - (e.lift || 0) * .6) * ch; // lift：賊翻牆的弧線
      const stunned = e.st.stun || e.st.distract, stillOne = stunned || e.underground || e.crouchT > 0;
      let rot = 0, bob = 0, lunge = 0, bite = 0;
      if (anim && speed <= 1 && !stillOne) { const f = v.fly || v.swarm ? 3 : v.k >= 1.2 ? 4 : e.type === 'fast' ? 8 : 5.7; if (v.fly || v.swarm) bob = Math.sin((time + v.phase) * f) * ch * .06; else { rot = Math.sin((time + v.phase) * f) * .061; bob = -Math.abs(Math.sin((time + v.phase) * f)) * ch * .025; } }
      if (e.biting && !stillOne && !paused && !still) { bite = Math.abs(Math.sin(time * 7 + v.phase)); if (!reduce()) lunge = -bite * cw * .14; } // 咬東西：每 .45 秒往前撲一下（加速也保留，是資訊；減少動態改身體泛紅）
      if (v.swing > 0) { lunge += cw * .28 * Math.sin((1 - v.swing / .3) * Math.PI); rot += .24 * Math.sin((1 - v.swing / .3) * Math.PI); }
      v.body.rotation = rot; v.body.y = bob; v.body.x = lunge + dodgeX;
      const crouch = e.crouchT > 0; v.body.scale.set(crouch ? .8 : 1 + (reduce() ? 0 : bite * .06)); if (crouch) v.body.y += ch * .12;
      v.cont.alpha = e.underground ? 0 : stunned ? .6 : 1; v.body.alpha = v.dodge > 0 ? .4 + .6 * (1 - dodgeK) : 1;
      const biteTint = reduce() && e.biting && bite > .5; // 減少動態：咬住時身體一下紅一下白，不位移
      v.spr.tint = e.st.poison ? (v.swarm ? 0xd8b0f0 : 0x9fe07a) : crouch ? 0xb0b0b0 : 0xffffff; v.bg.tint = e.st.poison ? (v.swarm ? 0xc8a0e8 : 0xa8d890) : crouch ? 0xb0b0b0 : biteTint ? 0xffb0a0 : 0xffffff;
      v.burnGlow.alpha = e.st.burn ? .75 : 0;
      v.flash.alpha = e.dashLeft > 0 ? .25 : 0; // 衝刺：亮一階
      if (v.flashT > 0) { if (!paused) v.flashT -= dt; v.flash.alpha = Math.max(0, v.flashT / .09) * (v.fly ? .45 : .85); }
      if (anim && speed <= 1) { // 狀態粒子：燃燒冒火、中毒冒泡
        if (e.st.burn) { v.burnAcc += dt; while (v.burnAcc > .07) { v.burnAcc -= .07; spark(v.cont.x + (Math.random() - .5) * cw * .3, v.cont.y, Math.random() < .5 ? 0xff8a30 : 0xffd060, 1, .03 * ch, -ch * .7, .5, 2); } }
        if (e.st.poison) { v.poisonAcc += dt; while (v.poisonAcc > .2) { v.poisonAcc -= .2; spark(v.cont.x + (Math.random() - .5) * cw * .4, v.cont.y - ch * .1, 0x8fe06a, .8, .012 * ch, -ch * .35, .7, 1.2); } }
      }
      if (v.hpLast !== e.hp) { v.hpLast = e.hp; hpBar(v.hp, v.swarm ? v.br * 2.4 : cw * .8, clamp(v.br + 3, ch * .38, ch * .46), clamp(e.hp / e.maxHp, 0, 1), DANGER, v.thick); } // 血條在身體下緣之外，大型敵人也不會被身體蓋住
      const txt = statusText(e); if (txt !== v.stText) { v.stText = txt; v.st.text = txt; }
      if (e.carrying && !v.carry) { v.carry = makeIcon('🐑', ch * .3); v.carry.x = cw * .22; v.carry.y = ch * .18; v.cont.addChild(v.carry); }
      if (!e.carrying && v.carry) { v.carry.destroy(); v.carry = null; }
    }
    for (const [id, v] of EN) if (!alive.has(id) && !v.dying) { v.cont.destroy({ children: true }); EN.delete(id); }
    return biting;
  }
  // 受擊：身體上疊一層白，90ms 線性退掉；蝗群不逐隻閃；加一點火花
  function flashHit(id) { const v = EN.get(id); if (!v || v.swarm) return; v.flashT = .09; if (speed <= 1 && !reduce()) for (let i = 0; i < 3; i++) spark(v.cont.x + (Math.random() - .5) * cw * .3, v.cont.y - ch * .05, 0xfff0c0, .9, .014 * ch, -ch * .3, .25, 2.5); }
  // 倒下：220ms 縮到 .85 並淡出（減少動態只淡出）；地面敵人腳下一朵塵（同時最多四朵；加速不出）
  function dieFx(e) {
    const v = EN.get(e.id); if (!v) return;
    EN.delete(e.id); v.dying = true; const c = v.cont, rd = reduce();
    tween(.22, k => { c.alpha = 1 - k; if (!rd) c.scale.set(1 - .15 * EASE(k)); }, () => c.destroy({ children: true }));
    if (rd || speed > 1 || e.underground || v.fly || state.dust >= 4) return;
    state.dust++; setTimeout(() => { state.dust = Math.max(0, state.dust - 1); }, 300); // clear() 可能已把它歸零，別減成負的
    for (let i = 0; i < 7; i++) spawnParticle(c.x + (Math.random() - .5) * cw * .3, c.y + ch * .2, (Math.random() - .5) * cw * .6, -ch * .5 * Math.random(), .26 + Math.random() * .1, 0xe8dcc4, (.04 + Math.random() * .03) * ch, ch * .8, .6, true);
  }
  // 吹角：被推的地面敵人從原位滑到新位（引擎已更新位置，這裡只疊視覺位移；靠右被夾住的只滑那一點）
  function hornShove(moved) { if (reduce() || speed > 1 || !moved) return; for (const m of moved) { if (!(m.dx > 0.01)) continue; const v = EN.get(m.id); if (v) { v.shove = .18; v.shoveDx = m.dx; } } }
  function flashDodge(r, x) { const e = G.enemies.find(o => o.r === r && Math.abs(o.x - x) < .3 && ENEMIES[o.type].dodge); const v = e && EN.get(e.id); if (v) v.dodge = .35; }
  function swingPatrol(id) { const v = MV.get(id); if (!v) return; if (reduce()) { v.brightT = .35; return; } v.swing = .3; }

  // ====== 狗、巡夜人、迷羊（格子外走的）======
  function moverVisual(id, emoji, kind) {
    const cont = new PIXI.Container(); L.movers.addChild(cont);
    const body = new PIXI.Container(); cont.addChild(body);
    const g = new PIXI.Graphics();
    if (kind === 'dog') g.circle(0, 0, ch * .33).fill(0xc9a24a);
    else if (kind === 'patrol') g.roundRect(-ch * .33, -ch * .33, ch * .66, ch * .66, 8).fill(UCOL.patrol);
    else g.circle(0, 0, ch * .28).fill(0xf3ead8).stroke({ width: 2, color: GOLD });
    body.addChild(g);
    const spr = makeIcon(emoji, ch * (kind === 'stray' ? .38 : .44)); spr.y = -ch * .02; body.addChild(spr);
    const bright = makeIcon(emoji, spr.width || ch * .44); bright.y = spr.y; bright.blendMode = 'add'; bright.alpha = 0; body.addChild(bright);
    const hp = new PIXI.Graphics(); cont.addChild(hp);
    const v = { cont, body, spr, bright, brightT: 0, hp, hpLast: -1, phase: Math.random() * 6, kind, swing: 0, zz: null }; MV.set(id, v); return v; // brightT：減少動態時巡夜人出手改用「亮一下」的剩餘秒數（跟 bright 精靈分開存，2026-10-23 混用過一次整局停掉）
  }
  function drawMovers(dt) {
    const alive = new Set(); const anim = !paused && !still && speed <= 1 && !reduce();
    const put = (id, emoji, kind, x, y, hpv, max, resting) => {
      alive.add(id); const v = MV.get(id) || moverVisual(id, emoji, kind);
      v.cont.x = x * cw; v.cont.y = y * ch;
      if (!paused) { v.swing = Math.max(0, v.swing - dt); v.brightT = Math.max(0, v.brightT - dt); }
      const sw = v.swing > 0 ? Math.sin((1 - v.swing / .3) * Math.PI) : 0;
      v.body.rotation = (anim && !resting ? Math.sin((time + v.phase) * (kind === 'dog' ? 8 : kind === 'patrol' ? 5.3 : 4.5)) * .061 : 0) + sw * .24; v.body.x = sw * cw * .28;
      v.bright.alpha = Math.min(.5, v.brightT);
      v.cont.alpha = resting ? .55 : 1;
      if (resting && !v.zz) { v.zz = makeText('💤', Math.max(10, ch * .18), TEXT, false); v.zz.style.stroke = null; v.zz.x = cw * .2; v.zz.y = -ch * .3; v.cont.addChild(v.zz); } if (!resting && v.zz) { v.zz.destroy(); v.zz = null; }
      if (max && v.hpLast !== hpv) { v.hpLast = hpv; hpBar(v.hp, cw * .8, ch * .38, clamp(hpv / max, 0, 1), OK); }
    };
    for (const k in G.units) { const u = G.units[k]; if (u.type === 'dog') put(u.id, '🐕', 'dog', u.x + .5, u.r + .5, u.hp, u.maxHp, !!u.resting); else if (u.type === 'patrol') put(u.id, UNITS.patrol.ico, 'patrol', u.c + .5, u.rv + .5, u.hp, u.maxHp, false); }
    for (const s of G.strays) if (!s.dead) put(s.id, STRAY.ico, 'stray', s.x + .5, s.r + .5, 0, 0, false);
    for (const [id, v] of MV) if (!alive.has(id)) { v.cont.destroy({ children: true }); MV.delete(id); }
  }

  // ====== 投射物：石子帶灰塵拖尾、箭是光痕、投石機拋物線有影子、燃燒的拖火 ======
  function drawShots(dt) {
    const alive = new Set(); let fresh = 0;
    for (const s of G.shots) {
      alive.add(s.id); let v = SH.get(s.id);
      if (!v) {
        fresh++;
        const cont = new PIXI.Container(); L.shots.addChild(cont);
        const glow = new PIXI.Sprite(radialTex); glow.anchor.set(.5); glow.blendMode = 'add'; glow.width = glow.height = ch * .5; glow.alpha = 0; cont.addChild(glow);
        const g = new PIXI.Graphics();
        if (s.kind === 'arrow') g.roundRect(-9, -1.5, 18, 3, 2).fill(0xd8c8a0);
        else { const R = s.kind === 'lob' || s.kind === 'sling' ? 7 : 5; g.circle(0, 0, R).fill(s.kind === 'lob' ? 0xa9a9a9 : s.kind === 'sling' ? 0xd0d0d0 : 0xe9e4d0).stroke({ width: 1, color: 0x000000, alpha: .35 }); }
        cont.addChild(g);
        let shadow = null; if (s.kind === 'lob') { shadow = new PIXI.Graphics().ellipse(0, 0, 7, 3).fill({ color: 0x000000, alpha: .35 }); L.shots.addChildAt(shadow, 0); }
        v = { cont, g, glow, shadow, acc: 0 }; SH.set(s.id, v);
        recoilUnit(s.ur === undefined ? s.r : s.ur, s.uc === undefined ? Math.floor(s.x) : s.uc);
      }
      const lift = s.kind === 'lob' ? Math.sin(Math.min(1, s.t) * Math.PI) * .6 : 0;
      const x = s.x * cw, y = (s.r + .5 - lift) * ch; v.cont.x = x; v.cont.y = y;
      if (v.shadow) { v.shadow.x = x; v.shadow.y = (s.r + .5) * ch + ch * .25; v.shadow.alpha = .35 - lift * .3; }
      if (s.burn) { v.glow.alpha = .8; v.glow.tint = 0xff8a3d; v.g.tint = 0xff8a3d; }
      if (!paused && speed <= 1 && !reduce()) { v.acc += dt; while (v.acc > .03) { v.acc -= .03; if (s.burn) spark(x - cw * .05, y, Math.random() < .5 ? 0xff8a30 : 0xffd060, .9, .016 * ch, -ch * .3, .3, 1.5); else if (s.kind !== 'arrow') spark(x - cw * .08, y + ch * .02, 0xd8d0c0, .35, .012 * ch, 0, .22, .4); } }
    }
    for (const [id, v] of SH) if (!alive.has(id)) { v.cont.destroy({ children: true }); if (v.shadow) v.shadow.destroy(); SH.delete(id); }
    return fresh;
  }

  // ====== 一次性效果 ======
  function fx(kind, r, x, id, ev) {
    const px = (x + .5) * cw, py = (r + .5) * ch;
    if (reduce() && ['blast', 'splash', 'slam', 'ignite', 'trample', 'emerge'].includes(kind)) popText(r, x, FX_TEXT[kind]); // 減少動態：粒子不出，改飄一個字讓人知道發生了什麼
    switch (kind) {
      case 'blast': ring(px, py, cw * 1.6, 0xffb060, .45); burst(px, py, 18, [0xff8a30, 0xffd060, 0x777777], ch * .9, .5); break;
      case 'splash': case 'slam': ring(px, py, cw * .9, 0xffe0a0, .3); burst(px, py, 8, [0xc9bda0, 0xffd060], ch * .5, .35); break;
      case 'ignite': burst(px, py, 10, [0xff8a30, 0xffd060], ch * .6, .5); break;
      case 'howl': ripple(px, py, 0xc9a0dc); break;
      case 'roar': ripple(px, py, GOLD); break;
      case 'horn': { if (speed <= 1) squashUnit(r, x); popText(r, x, FX_TEXT.horn); if (reduce()) break; const g = new PIXI.Graphics(); L.fx.addChild(g); tween(.45, k => { const e = EASE(k); g.clear().ellipse(px + e * W * .9, py, cw * .25, ch * .45).stroke({ width: 3, color: 0xffe28a, alpha: 1 - k }); }, () => g.destroy()); hornShove(ev && ev.moved); break; } // 吹的人回彈＋衝擊波＋被推的滑移
      case 'trample': case 'emerge': case 'flee': burst(px, py + ch * .2, 6, [0xc9bda0], ch * .4, .3); if (kind === 'flee') popText(r, x, FX_TEXT.flee); break;
      case 'gate': gateSweep(r); break;
      case 'strike': { burst(px, py, 6, [0xffe28a, 0xffffff], ch * .4, .25); const t = makeText('✦', Math.max(16, ch * .5), GOLD, true); t.x = px; t.y = py; L.text.addChild(t); tween(.45, k => { t.scale.set(1 + k * .4); t.alpha = 1 - k; }, () => t.destroy()); swingPatrol(id); break; }
      case 'mound': { const g = new PIXI.Graphics(); g.mr = r; g.mx = x; drawMound(g); L.marks.addChild(g); mounds.set(id, g); break; } // 鑽地的會從這裡冒出來：常駐、在 drawMarks 裡閃，emerge 時移除
      case 'catch': catchFx(r, x); break;
      case 'dodge': flashDodge(r, x); break;
      case 'crouch': popText(r, x, FX_TEXT.crouch, true); break; // 豹蹲伏：本體縮小變灰之外，頭上飄 👁（跟 DOM 版一樣，蹲著的要讓人注意到）
      case 'bark': case 'hop': break; // 狗咬住、換排：本體動作已看得到，不飄字
      default: if (FX_TEXT[kind]) popText(r, x, FX_TEXT[kind], kind === 'grab' || kind === 'home' || kind === 'rest' || kind === 'enrage' || kind === 'sting');
    }
    if (kind === 'emerge') { const g = mounds.get(id); if (g) { g.destroy(); mounds.delete(id); } }
  }
  function ring(x, y, R, color, dur) { const g = new PIXI.Graphics(); L.fx.addChild(g); const rd = reduce(); tween(dur, k => { const e = rd ? .7 : EASE(k); g.clear().circle(x, y, R * e).stroke({ width: 3 * (1 - k) + 1, color, alpha: 1 - k }); }, () => g.destroy()); } // 減少動態：圓環不擴張只淡出
  function drawMound(g) { g.clear().ellipse(0, 0, cw * .3, ch * .14).fill(0x6a4a2a).stroke({ width: 1, color: 0x000000, alpha: .3 }); g.x = (g.mx + .5) * cw; g.y = (g.mr + .5) * ch + ch * .25; }
  function ripple(x, y, color) { const rd = reduce(); const one = (delay) => { const g = new PIXI.Graphics(); L.fx.addChild(g); tweens.push({ t: 0, dur: 1 + delay, fn: k => { const kk = clamp((k * (1 + delay) - delay) / 1, 0, 1); g.clear().circle(x, y, cw * .35 * (1 + 1.6 * (rd ? .5 : kk))).stroke({ width: 2, color, alpha: 1 - kk }); }, done: () => g.destroy() }); }; one(0); if (!rd) one(.25); }
  function burst(x, y, n, cols, v, life) { if (reduce()) return; if (speed > 1) n = Math.ceil(n / 3); for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = v * (.4 + Math.random() * .8); spawnParticle(x, y, Math.cos(a) * s, Math.sin(a) * s - v * .3, life * (.6 + Math.random() * .6), cols[Math.floor(Math.random() * cols.length)], .04 * ch * (.6 + Math.random()), ch * 1.6, .8); } } // 粒子直徑約 4px，手機上才看得到
  // 飄字：+25 金色往上飄 1 秒；效果 emoji 0.8 秒；減少動態只淡出
  function popText(r, c, text, light) {
    const gold = String(text)[0] === '+';
    const t = makeText(text, gold ? Math.max(13, ch * .22) : Math.max(16, ch * .42), gold ? GOLD : TEXT, gold); if (!gold) t.style.stroke = { color: 0x000000, width: 2 };
    t.x = (c + (gold ? .3 : .5)) * cw; t.y = (r + (gold ? .25 : .5)) * ch; L.text.addChild(t);
    const y0 = t.y, rd = reduce(), dur = rd ? .5 : gold ? 1 : .8, dy = gold ? 24 : 12;
    tween(dur, k => { const e = EASE(k); if (!rd) t.y = y0 - dy * e; t.alpha = 1 - e; }, () => t.destroy());
  }
  // 接回：抱羊羔的牧人那格飄「接回」小牌子，人跳一下
  function catchFx(r, c) {
    const t = makeText('接回 🐑', Math.max(11, ch * .18), 0x2a2418, true); t.style.stroke = null;
    const b = new PIXI.Container(); b.addChild(new PIXI.Graphics().roundRect(-t.width / 2 - 8, -t.height / 2 - 2, t.width + 16, t.height + 4, 999).fill(GOLD)); b.addChild(t);
    b.x = (c + .5) * cw; b.y = (r + .2) * ch; L.text.addChild(b); const y0 = b.y, rd = reduce();
    tween(rd ? 1.2 : 1.3, k => { if (!rd) b.y = y0 - 12 * EASE(k); b.alpha = 1 - k * k; }, () => b.destroy({ children: true }));
    const v = UN.get(key(r, c)); if (v && speed <= 1 && !rd) tween(.32, k => { const s = Math.sin(k * Math.PI); v.inner.y = -ch * .12 * s; v.inner.scale.set(1 + .08 * s); }, () => { v.inner.y = 0; v.inner.scale.set(1); });
  }
  // 看門的掃排：人影從左邊門口衝到右邊，後面拖一道金光（減少動態：不位移，只淡出）
  function gateSweep(r) {
    const cont = new PIXI.Container(); L.fx.addChild(cont);
    const trail = new PIXI.Graphics().rect(-cw * 2.6, -ch * .12, cw * 2.6, ch * .24).fill({ color: GOLD, alpha: .45 }); cont.addChild(trail);
    const man = makeIcon('🧍', ch * .5); cont.addChild(man); cont.y = (r + .5) * ch;
    const rd = reduce(); cont.x = rd ? W * .5 : -cw * .3;
    tween(.9, k => { if (!rd) cont.x = -cw * .3 + k * (W + cw); cont.alpha = k < (rd ? .6 : .8) ? 1 : 1 - (k - (rd ? .6 : .8)) / (rd ? .4 : .2); }, () => cont.destroy({ children: true }));
  }

  // ====== 腳印預告：敵人的在右緣閃爍，special 加紅圈、頭目加金圈；迷羊的錯開一格 ======
  function setMarker(r, type) {
    if (marker) { marker.cont.destroy({ children: true }); marker = null; }
    if (r === null || r === undefined) return;
    const cont = new PIXI.Container(); L.marks.addChild(cont);
    const special = type && type !== 'wolf' && type !== 'fast';
    if (special) { const boss = !!ENEMIES[type].boss; cont.addChild(new PIXI.Graphics().circle(0, 0, ch * .3).fill({ color: 0x000000, alpha: .3 }).stroke({ width: boss ? 3 : 2, color: boss ? GOLD : ENEMY_RING })); }
    cont.addChild(makeIcon(special ? ENEMIES[type].ico : '🐾', ch * .38));
    cont.x = W - cw * .5; cont.y = (r + .5) * ch; marker = { cont, r, type };
  }
  function setStrayMark(r) {
    if (strayMark) { strayMark.cont.destroy({ children: true }); strayMark = null; }
    if (r === null || r === undefined) return;
    const cont = makeIcon('🐑', ch * .38); cont.x = W - cw * 1.5; cont.y = (r + .5) * ch; L.marks.addChild(cont); strayMark = { cont, r };
  }
  function drawMarks() { const a = reduce() ? .85 : .35 + .6 * Math.abs(Math.sin(time * 1.96)); if (marker) marker.cont.alpha = a; if (strayMark) strayMark.cont.alpha = reduce() ? .95 : a; for (const [, g] of mounds) g.alpha = reduce() ? .9 : .55 + .45 * Math.abs(Math.sin(time * 2.6)); } // 腳印一閃 1.6 秒（跟 DOM 版 blink .8s alternate 同）

  // ====== 天色與天氣：入夜暖橘退成夜色、天亮金光、失守冷罩；暴風夜冷色罩＋雨絲＋閃電 ======
  function drawSky(dt) {
    const s = L.skySpr;
    if (state.lose > 0) { s.texture = gradTex.lose; s.alpha = Math.min(.45, s.alpha + dt / .9 * .45); }
    else if (state.dawn > 0) { s.texture = gradTex.dawn; s.alpha = Math.min(.42, s.alpha + dt / .9 * .42); }
    else if (state.dusk > 0) { state.dusk -= dt; s.texture = gradTex.dusk; s.alpha = .3 * clamp(state.dusk / 4, 0, 1); }
    else s.alpha = 0;
  }
  function drawWeather(dt) {
    const storm = diff === 'storm';
    L.stormRect.clear(); if (storm) L.stormRect.rect(0, 0, W, H).fill({ color: 0x5a6a8a, alpha: state.dark ? .08 : .14 });
    if (storm && !still && !reduce()) { const gap = speed > 1 ? .024 : .012; rainAcc += dt; while (rainAcc > gap) { rainAcc -= gap; spawnParticle(Math.random() * (W + 40) - 20, -20, -ch * .6, ch * 7, .85, 0xcfd8ff, 1, 0, .28, true, rainTex); } } // 壽命 .85 秒：以 7 排／秒落下剛好穿過整張棋盤（5 排），不會下到一半消失。加速時雨量減半不停掉，暴風夜的氛圍留著（James 2026-10-23）
    if (state.flash > 0) { state.flash -= dt; L.flashRect.clear().rect(0, 0, W, H).fill({ color: 0xf4f0ff, alpha: .5 * clamp(state.flash / .18, 0, 1) }); if (state.flash <= 0) { L.flashRect.clear(); if (state.bolt) { state.bolt.destroy(); state.bolt = null; } } }
  }
  function lightning() {
    if (!app || reduce() || speed > 1 || state.dark) return; // 無月夜不閃電：那段本來就是「看不見」
    state.flash = .18;
    const g = new PIXI.Graphics(); let x = Math.random() * W, y = 0; g.moveTo(x, y);
    while (y < H * .55) { x += (Math.random() - .5) * cw * .8; y += ch * (.25 + Math.random() * .3); g.lineTo(x, y); }
    g.stroke({ width: 2.5, color: 0xffffff, alpha: .9 }); L.weather.addChild(g); state.bolt = g;
  }
  function dusk(on) { if (!app) return; state.dusk = on && !reduce() ? 4 : 0; state.dawn = 0; state.lose = 0; L.skySpr.alpha = 0; }
  // 天亮：金光罩上來、黑暗退掉；還在的人由左到右跳一下（儀式感，不帶數值）
  function dawn() {
    if (!app) return;
    dawned = true; state.dawn = 1; state.dusk = 0; L.skySpr.alpha = 0;
    if (reduce()) return;
    for (const [, v] of UN) { const u = v.u; tweens.push({ t: -(.12 + u.c * .055), dur: .36, fn: k => { v.inner.y = -ch * .08 * Math.sin(k * Math.PI); }, done: () => { v.inner.y = 0; } }); }
  }
  function lose() { if (!app) return; state.lose = 1; state.dusk = 0; L.skySpr.alpha = 0; }

  // ====== 粒子與補間（簡單的池）======
  function spawnParticle(x, y, vx, vy, life, color, size, grav, alpha, plain, t) {
    if (particles.length > 400) return;
    const s = new PIXI.Sprite(t || dotTex); s.anchor.set(.5); s.x = x; s.y = y; s.tint = color; s.alpha = alpha;
    if (t) { s.width = 2; s.height = 18; s.rotation = Math.atan2(vy, vx) - Math.PI / 2; } else s.width = s.height = size * 2;
    if (!plain && !t) s.blendMode = 'add';
    (t ? L.weather : L.fx).addChild(s);
    particles.push({ s, vx, vy, life, ttl: life, grav, a0: alpha, sz: size * 2, dot: !t });
  }
  // 火花：往上飄的小亮點（火盆、燃燒、受擊）
  function spark(x, y, color, alpha, size, vy, life, spread) { spawnParticle(x, y, (Math.random() - .5) * ch * .3 * spread, vy * (.6 + Math.random() * .8), life * (.7 + Math.random() * .6), color, size, -ch * .1, alpha); }
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.life -= dt;
      if (p.life <= 0 || p.s.y > H + 30) { p.s.destroy(); particles.splice(i, 1); continue; }
      p.vy += p.grav * dt; p.s.x += p.vx * dt; p.s.y += p.vy * dt;
      const k = p.life / p.ttl; p.s.alpha = p.a0 * (p.dot ? k : Math.min(1, k * 4)); if (p.dot) p.s.width = p.s.height = p.sz * (.5 + k * .5); // 雨絲只在最後四分之一淡掉，火花塵土一路變淡
    }
  }
  function tween(dur, fn, done) { tweens.push({ t: 0, dur, fn, done }); fn(0); }
  function updateTweens(dt) {
    for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i]; w.t += dt; if (w.t < 0) continue; const k = Math.min(1, w.t / w.dur); try { w.fn(k); } catch (e) {} if (k >= 1) { tweens.splice(i, 1); if (w.done) try { w.done(); } catch (e) {} } }
  }

  // ====== 開局、清場 ======
  function newGame(g, opts) {
    G = g; diff = opts.diff; speed = opts.speed || 1; dawned = false; still = false; paused = false; time = 0; errCount = 0;
    if (!app) return; // 棋盤開不起來：index.html 會擋住開始，這裡再守一道
    clear(false);
    state.cellsDirty = state.rocksDirty = true; state.dark = false; state.darkA = 0; L.fogs.forEach(f => { f.alpha = 1; }); state.litRows.fill(false); L.litG.clear();
    for (const k in G.units) renderUnit(G.units[k].r, G.units[k].c);
    dusk(!opts.resumed);
  }
  function clear(all = true) {
    if (!app) return;
    for (const [, v] of UN) { v.cont.destroy({ children: true }); if (v.glow) v.glow.destroy(); if (v.up) v.up.destroy({ children: true }); } UN.clear();
    for (const [, v] of EN) v.cont.destroy({ children: true }); EN.clear();
    for (const [, v] of MV) v.cont.destroy({ children: true }); MV.clear();
    for (const [, v] of SH) { v.cont.destroy({ children: true }); if (v.shadow) v.shadow.destroy(); } SH.clear();
    for (const [k] of holes) removeHole(k);
    for (const [, g] of mounds) g.destroy(); mounds.clear();
    for (const p of particles) p.s.destroy(); particles.length = 0;
    for (const w of tweens) if (w.done) try { w.done(); } catch (e) {} tweens.length = 0;
    for (const n of ['fx', 'hints', 'text']) L[n].removeChildren().forEach(c => c.destroy({ children: true }));
    if (state.bolt) { state.bolt.destroy(); state.bolt = null; } L.flashRect.clear(); state.flash = 0;
    setMarker(null); setStrayMark(null); setHints(null); setRange(null); setTeach(null);
    state.dust = 0;
    if (all) { still = true; G = null; app.render(); }
  }

  // ====== 對外介面 ======
  return {
    init, newGame, frame, clear,
    event(e, g) { // 引擎事件裡跟畫面有關的：index.html 的 flushEvents 每一件都丟過來，不認得的這裡略過
      G = g; if (!app) return;
      try {
        switch (e.t) {
          case 'die': dieFx(e.e); break;
          case 'hit': flashHit(e.id); break;
          case 'pop': popText(e.r, e.c, e.text); if (String(e.text)[0] === '+') hopUnit(e.r, e.c); break;
          case 'unit': renderUnit(e.r, e.c); break;
          case 'fx': fx(e.kind, e.r, e.x, e.id, e); break;
          case 'marker': setMarker(e.r, e.type); break;
          case 'strayMark': setStrayMark(e.r); break;
        }
      } catch (err) { report(err); }
    },
    setHints, setRange, setTeach, placed, squashUnit, lightning, dawn, lose,
    setSpeed(n) { speed = n; }, setPaused(p) { paused = p; }, setStill(s) { still = s; },
    get ready() { return !!app; },
    get lastError() { return lastError; }, get errCount() { return errCount; },
  };
})();
