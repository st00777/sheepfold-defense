// 2026-11-06 晚上全遊戲審查四部奏（不只最近改動）採納的修正，一條一守。表在 docs/review-full-2026-11-06.md。node --test sim/*.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const D = require(path.join(__dirname, '..', 'data.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));
const Save = require(path.join(__dirname, '..', 'save.js'));
const { UNITS, DIFFS, COLS } = D;
const src = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const html = src('index.html'), render = src('render.js'), engine = src('engine.js'), data = src('data.js'), simSrc = src('sim/simulate.js');

function setup(levelId = 14, units = Object.keys(UNITS)) {
  const G = E.create(levelId, 'calm', () => 0.5); G.food = 9999; G.started = true; G.phase = 'rest'; G.timer = 999; G.holdWaves = true;
  G.level = { ...G.level, units, moonless: 0 };
  return G;
}
function run(G, sec) { for (let i = 0; i < Math.round(sec * 30); i++) { E.step(G, 1 / 30); G.events.length = 0; } }
function spawn(G, type, r, x) { E.dev.spawn(G, type, r, x); return G.enemies[G.enemies.length - 1]; }

test('單位離場事件 gone 有轉交給畫面層（10/29 做好的離場動畫一直沒接上）', () => {
  assert.match(html, /case 'gone': Board\.event\(e, G\); break;/);
  assert.match(render, /case 'gone': unitGone\(e\.r, e\.c, e\.why\)/);
});

test('牧羊犬咬豺狼用獵犬傷害（roster：狗用 hunt），不是一般 dps', () => {
  const G = setup(); assert.ok(E.place(G, 2, 3, 'dog').ok);
  const j = spawn(G, 'jackal', 2, 3.6); run(G, 1.5);
  assert.ok(j.heldBy, '狗咬住了');
  const hp0 = j.hp; run(G, 1);
  assert.ok(hp0 - j.hp > UNITS.dog.dps * 1.5, `一秒掉 ${(hp0 - j.hp).toFixed(1)} 血，應該接近 hunt ${UNITS.dog.hunt} 而不是 dps ${UNITS.dog.dps}`);
});

test('暈住的敵人被狗咬住時不反咬狗', () => {
  const G = setup(); assert.ok(E.place(G, 2, 3, 'dog').ok);
  const w = spawn(G, 'wolf', 2, 3.6); run(G, 1.5); assert.ok(w.heldBy, '狗咬住了');
  const dog = G.units['2,3']; w.st.stun = 10; const hp0 = dog.hp; run(G, 2);
  assert.strictEqual(dog.hp, hp0, '暈住 2 秒內狗沒掉血');
});

test('角聲的暈眩不會把陷坑更長的困住時間縮短', () => {
  assert.match(engine, /e\.st\.stun = Math\.max\(e\.st\.stun \|\| 0, def\.stun\); release\(G, e\);/);
});

test('巡夜人正在打的那格被放了東西，也要讓出來走回家排', () => {
  const G = setup(14, ['patrol', 'wall', 'shepherd']); assert.ok(E.place(G, 2, 3, 'patrol').ok);
  const u = G.units['2,3']; spawn(G, 'boar', 1, 4.2); run(G, 3);
  assert.strictEqual(Math.round(u.rv), 1, '先走到第 1 排接戰');
  assert.ok(E.place(G, 1, 3, 'wall').ok, '他站的那格本來就能放牆（他登記在家格）');
  run(G, 4);
  assert.strictEqual(Math.round(u.rv), 2, '讓出來、回家排');
});

test('試煉續玩換了隊伍：檢查點裡題目白名單內的單位照還原（restore 看 pool，不看這次點的隊）', () => {
  const T = D.TRIALS.find(t => t.mods && t.mods.waveOverride && t.mods.waveOverride.length >= 2 && E.trialLevel(t).units.includes('archer') && E.trialLevel(t).units.length > 4); // 守望題：兩波以上才有檢查點可存（快照的 wave 要在 1 到最後一波之前）
  assert.ok(T, '有一題守望有弓箭手');
  const allow = E.trialLevel(T).units;
  const mk = () => E.create(T.levelId, T.diff, () => 0.5, T.mods);
  const G = mk(); G.food = 9999; assert.ok(E.place(G, 1, 2, 'archer').ok); G.started = true; G.wave = 1; // (2,2) 是石頭，放第 1 排
  const snap = JSON.parse(JSON.stringify(E.snapshot(G)));
  const G2 = mk(); E.applyPick(G2, allow.filter(k => k !== 'archer').slice(0, 8));
  assert.ok(E.restore(G2, snap), '接得回去');
  assert.ok(G2.units['1,2'] && G2.units['1,2'].type === 'archer', '沒點弓箭手，場上的弓箭手也要在');
  const G3 = mk(); E.applyPick(G3, allow.filter(k => k !== 'archer').slice(0, 8));
  const outside = Object.keys(UNITS).find(k => !allow.includes(k) && UNITS[k].kind !== 'instant');
  if (outside) { const bad = { ...snap, units: [{ ...snap.units[0], type: outside }] }; assert.ok(E.restore(G3, bad)); assert.ok(!G3.units['1,2'], '白名單外的卡（被改過的存檔）還是不還原'); }
});

test('偷羊人／大鷹：羊正被抱走時後到的找不到羊，空手跑掉，不再抱走同一隻羊', () => {
  const L = D.LEVELS.find(l => l.sheep); const G = setup(L.id); G.sheep = 1;
  const a = spawn(G, 'rustler', 2, -0.55), b = spawn(G, 'rustler', 3, -0.55); run(G, 0.2);
  assert.ok(a.carrying && !a.empty, '第一個抱到羊');
  assert.ok(b.carrying && b.empty, '第二個空手');
  a.hp = 0; run(G, 0.2); // 打倒抱羊的那個
  run(G, 40); // 空手的跑出場
  assert.ok(!G.over, '沒被判輸');
  assert.strictEqual(G.sheepLost, 0, '沒失羊');
  assert.ok(G.sheep >= 1, '羊還在（或正走回圈）');
});

test('三隻狗合咬一隻、新敵人進來時轉過去的是最晚盯上的那隻狗', () => {
  const G = setup(); for (const c of [1, 2, 3]) assert.ok(E.place(G, 2, c, 'dog').ok);
  const w1 = spawn(G, 'wolf', 2, 4.5); w1.hp = w1.maxHp = 9999; run(G, 3); // 血加厚：三隻狗 2.5 秒就咬死一隻普通狼
  const dogs = [1, 2, 3].map(c => G.units['2,' + c]);
  assert.ok(dogs.every(d => d.holding === w1.id), '三隻都咬同一隻');
  dogs[0].holdT = 0; dogs[1].holdT = 1; dogs[2].holdT = 2;
  const w2 = spawn(G, 'wolf', 2, 5.5); E.step(G, 1 / 30); G.events.length = 0;
  assert.strictEqual(dogs[2].holding, w2.id, '最晚盯上的轉去新敵人');
  assert.ok(dogs[0].holding === w1.id && dogs[1].holding === w1.id, '另外兩隻留著');
});

test('送卡夜快照存下一張卡的倒數，續玩不會第一幀就多發一張', () => {
  const L = D.LEVELS.find(l => l.conveyor); const G = E.create(L.id, 'calm', () => 0.5); G.started = true; G.wave = 1; G.convT = 3.3;
  const snap = JSON.parse(JSON.stringify(E.snapshot(G)));
  assert.strictEqual(snap.convT, 3.3);
  assert.ok(E.checkSnapshot(snap, L.id)); assert.ok(!E.checkSnapshot({ ...snap, convT: -1 }, L.id)); assert.ok(!E.checkSnapshot({ ...snap, convT: 999 }, L.id));
  const G2 = E.create(L.id, 'calm', () => 0.5); assert.ok(E.restore(G2, snap)); assert.strictEqual(G2.convT, 3.3);
  const n = G2.hand.length; E.step(G2, 0.1); assert.strictEqual(G2.hand.length, n, '第一幀沒多發');
  const G3 = E.create(L.id, 'calm', () => 0.5); const old = { ...snap }; delete old.convT; assert.ok(E.restore(G3, old)); assert.ok(G3.convT > 1, '舊快照沒這欄就從整段間隔重數');
});

test('牧人杖撥到斷：離場原因是磨損（worn）不是鏟除', () => {
  assert.match(engine, /if \(b\.hp <= 0\) \{ b\.worn = true; removeUnit\(G, b\); \}/);
});

test('檢查點的卡名用 isCard 驗，constructor 這種原型鏈名字進不來', () => {
  const G = E.create(2, 'calm', () => 0.5); G.food = 300; assert.ok(E.place(G, 2, 0, 'shepherd').ok); G.wave = 1;
  const snap = JSON.parse(JSON.stringify(E.snapshot(G)));
  assert.ok(E.checkSnapshot(snap, 2));
  assert.ok(!E.checkSnapshot({ ...snap, units: [{ type: 'constructor', r: 2, c: 2, hp: 50 }] }, 2));
  assert.ok(!E.checkSnapshot({ ...snap, hand: ['toString'] }, 2));
});

test('swap 也守數量上限（canSwap 有擋、swap 本身原本沒擋）', () => {
  const G = setup(); G.level = { ...G.level, maxUnits: { tower: 1 } };
  assert.ok(E.place(G, 2, 3, 'wall').ok); assert.ok(E.place(G, 3, 3, 'tower').ok);
  assert.ok(!E.canSwap(G, 2, 3, 'tower'));
  const r = E.swap(G, 2, 3, 'tower'); assert.ok(!r.ok && /最多 1 位/.test(r.msg), r.msg);
});

test('存檔：不認得的難度名丟掉、全 false 的夜不留空物件；舊版號沒有遷移步驟也數到現版；非整數版號當現版', () => {
  const opts = { check: E.checkSnapshot, diffs: Object.keys(DIFFS) };
  const r = Save.decode(Save.encode({ version: 6, progress: { cleared: { 1: { bogus: true, calm: false }, 2: { calm: true, storm: 1 } } } }), opts);
  assert.ok(r.data, r.problems.join(';'));
  assert.deepStrictEqual(r.data.progress.cleared, { 2: { calm: true, storm: true } });
  const v3 = Save.migrate(Save.validate({ version: 3 }, opts).data); assert.strictEqual(v3.version, Save.VERSION);
  assert.strictEqual(Save.validate({ version: 4.5 }, opts).data.version, Save.VERSION);
  assert.ok(Save.validate({ version: 99 }, opts).data === null, '未來版本仍拒收');
});

test('index.html：送卡夜放下最後一張卡不再讀被清掉的 selected；Enter 讓按鈕自己動；開發者局整局不記；成就卡等星跳完；頭目橫幅跟著暫停與清場', () => {
  assert.match(html, /const sel = selected;[^\n]*\n\s*const res = G\.units\[r \+ ',' \+ c\] && !UNITS\[sel\]\.healAll \? Engine\.swap\(G, r, c, sel\) : Engine\.place\(G, r, c, sel\);/);
  assert.match(html, /if \(k === 'Enter' && cursor && tag !== 'BUTTON'\)/);
  assert.match(html, /if \(devUsed\) return true;[^\n]*\n\s*const k = level\.id \+ ':' \+ diff;/);
  assert.match(html, /setTimeout\(showAchvCard, 350 \+ Engine\.starSlots\(level\) \* 180 \+ 320 \+ 800\)/);
  assert.match(html, /\$\('#retry'\)\.addEventListener\('click', \(\) => afterAchv\(/);
  assert.match(html, /banner && banner\.getAnimations \? banner\.getAnimations\(\) : \[\]/);
  assert.match(html, /clearTimeout\(bannerTimer\); if \(bannerAnim\)[^\n]*\n\s*\$\('#result'\)\.hidden = true;/);
  assert.match(html, /performance\.now\(\) - epShown < 600/, '尾聲連點不跳頁');
  assert.match(html, /REDUCE_MOTION\.matches \? 1500 : 2600/, '減少動態結算留 1.5 秒');
  assert.ok(!/data-dep="sfx"><span>音量/.test(html), '音量列不跟著音效壓暗');
  assert.match(html, /SD\.announced = APP_VERSION; SAVE\.save\(\);/, '新玩家也存公告版本');
  assert.match(html, /MENU_IDS\.some\(m => !\$\(m\)\.hidden\) && \$\('#result'\)\.hidden && \$\('#settings'\)\.hidden/, '只在選單畫面才因別的分頁存檔而重載');
  assert.match(html, /nightStat\.sec = \(nightStat\.sec \|\| 0\) \+ dt/, '耗時只算在打的秒數');
  assert.match(html, /seconds: Math\.round\(nightStat\.sec \|\| 0\)/);
  assert.match(html, /err && err\.name === 'SecurityError' \?/, '只有 SecurityError 才說畫布被鎖');
});

test('render.js：重排不算出手、暫停不掛火球、獅吼紅橘、角標在 text 層、心不被上緣切、減少動態只淡出', () => {
  assert.match(render, /SH\.clear\(\); shRebuilt = true;/); assert.match(render, /if \(!shRebuilt\) fresh\+\+;/); assert.match(render, /shRebuilt = false; return fresh;/);
  assert.match(render, /if \(!v\.px\) \{ if \(!paused\) \{ const h = pxPlay\('fireball'/);
  assert.match(render, /case 'roar': pxPlay\('thunderclap', px, py \+ ch \* \.2, PX_RED/);
  assert.match(render, /L\.text\.addChild\(b\); v\.up = b;/);
  assert.match(render, /pxPlay\('heart', px, Math\.max\(py - ch \* \.5, 52 \* PX\.ps\), \{\}, 1\.4\); catchFx/);
  assert.match(render, /if \(pxCount\('quake'\) < 4\) pxPlay\('quake'/);
  assert.match(render, /if \(reduce\(\)\) \{ tween\(\.25, q => \{ cont\.alpha = 1 - q; \}, end\); return; \}/);
  assert.match(render, /try \{ w\.fn\(k\); \} catch \(e\) \{ tweenErrs\+\+;/, 'tween 的例外丟掉那條補間並另外記一筆');
  assert.match(render, /if \(e\.carrying && !e\.empty && !v\.carry\)/, '空手跑的不畫羊');
});

test('文案：回血→回復血量、機弦手傷害高、f21 說的是機弦手、第 20 夜飛的闖入不點名、圖鑑嚎叫寫敵人；模擬器無月夜不偷看', () => {
  assert.ok(!/回血範圍/.test(data)); assert.ok(!/打得快/.test(data)); assert.ok(!/打得快/.test(html));
  const f21 = D.TRIALS.find(t => t.id === 'f21'); assert.ok(f21.text.includes('沒有機弦手') && !f21.text.includes('沒有投石手')); assert.ok(f21.mods.units.includes('slinger') && !f21.mods.units.includes('sling'));
  const n14 = D.LEVELS.find(l => l.id === 14); assert.ok(!n14.outroLose.bird.includes('夜鴞'));
  assert.match(html, /2 格內的敵人速度/);
  assert.match(simSrc, /G\.nextRow === r && G\.nextType && G\.nextVisible/);
});

test('index.html 版本號：data 29、engine 29、save 7、render 31，版本 2026.11.06.1', () => {
  const v = n => +(html.match(new RegExp(n + '\\.js\\?v=(\\d+)')) || [])[1];
  assert.ok(v('data') >= 29 && v('engine') >= 29 && v('save') >= 7 && v('render') >= 31, JSON.stringify([v('data'), v('engine'), v('save'), v('render')]));
  assert.match(html, /\{ ver: '2026\.11\.06\.1'/);
});
