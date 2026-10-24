// 第三章機制：山坡（坡緣消失、坡上射手照打、拋射與飛的不受影響、坡下減速）、拋石手、石堆、陷坑、水袋、投石機升級、強盜、大鷹（高低切換＋羊的帳務）、野牛、一筆糧夜、關卡守門
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const D = require(path.join(__dirname, '..', 'data.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));
const { COLS } = D;

function setup(levelId = 21, rng = () => 0.5) {
  const G = E.create(levelId, 'calm', rng); G.food = 9999; G.started = true; G.phase = 'rest'; G.timer = 999; G.holdWaves = true;
  G.level = { ...G.level, units: Object.keys(D.UNITS) }; // 測試不受點兵限制
  return G;
}
function run(G, sec) { for (let i = 0; i < Math.round(sec * 30); i++) { E.step(G, 1 / 30); G.events.length = 0; } }
function spawn(G, type, r, x) { E.dev.spawn(G, type, r, x); return G.enemies[G.enemies.length - 1]; }
const ev = (G, t) => G.events.filter(e => e.t === t);
const fxOf = (G, kind) => G.events.filter(e => e.t === 'fx' && e.kind === kind);

test('山坡：坡上的直射飛到坡下只打飛的，地面敵人在腳底下打不到；第一次冒「咻」', () => {
  const G = setup();
  assert.ok(E.place(G, 2, 1, 'slinger').ok);
  const w = spawn(G, 'wolf', 2, 5.5); w.st.stun = 99; // 站在坡下不動
  const hp0 = w.hp;
  let overfly = 0; for (let i = 0; i < 90; i++) { E.step(G, 1 / 30); overfly += fxOf(G, 'overfly').length; G.events.length = 0; }
  assert.strictEqual(w.hp, hp0, '坡下的狼一顆都沒中');
  assert.ok(overfly >= 1, '石子飛過頭頂有「咻」');
  // 同一排坡下上空的鷙鳥照打
  const b = spawn(G, 'bird', 2, 5.5); b.st.stun = 99; const bh = b.hp;
  run(G, 3); assert.ok(b.hp < bh, '飛的打得到：' + b.hp);
});

test('山坡：敵人上了坡緣就打得到；坡上的射手跟敵人同一斜面，一切照舊', () => {
  const G = setup();
  assert.ok(E.place(G, 2, 1, 'slinger').ok);
  const w = spawn(G, 'wolf', 2, 3.5); w.st.stun = 99; const hp0 = w.hp;
  run(G, 2); assert.ok(w.hp < hp0, '坡緣上打得到');
  const G2 = setup();
  assert.ok(E.place(G2, 2, 4, 'slinger').ok); // 坡上第一格
  const v = spawn(G2, 'wolf', 2, 6); v.st.stun = 99; const vh = v.hp;
  run(G2, 2); assert.ok(v.hp < vh, '坡上的射手打坡下照打');
});

test('山坡：拋射不受影響（投石機、拋石手都砸得到坡下）；坡下地面敵人走得慢、野牛不受影響', () => {
  const G = setup();
  assert.ok(E.place(G, 2, 0, 'catapult').ok); assert.ok(E.place(G, 1, 0, 'lobber').ok);
  const a = spawn(G, 'wolf', 2, 6); a.st.stun = 99; const b = spawn(G, 'wolf', 1, 6); b.st.stun = 99;
  run(G, 4); assert.ok(a.hp < a.maxHp && b.hp < b.maxHp, '坡下都被砸到');
  const G2 = setup(), G1 = E.create(1, 'calm', () => 0.5); G1.started = true; G1.holdWaves = true; G1.phase = 'rest'; G1.timer = 999;
  const s = spawn(G2, 'wolf', 2, 6.5), t = spawn(G1, 'wolf', 2, 6.5); run(G2, 2); run(G1, 2);
  assert.ok(s.x > t.x + 0.05, `坡下走得慢 ${s.x.toFixed(2)} vs 平地 ${t.x.toFixed(2)}`);
  const u = spawn(G2, 'aurochs', 3, 6.5), x0 = u.x; run(G2, 2);
  assert.ok(Math.abs((x0 - u.x) - D.ENEMIES.aurochs.speed * 2) < 0.02, '野牛坡下不減速');
});

test('前兩章沒有坡：石子照打到最右邊', () => {
  const G = E.create(2, 'calm', () => 0.5); G.food = 9999; G.started = true; G.holdWaves = true; G.phase = 'rest'; G.timer = 999;
  assert.ok(E.place(G, 2, 1, 'slinger').ok);
  const w = spawn(G, 'wolf', 2, 5.5); w.st.stun = 99; run(G, 2);
  assert.ok(w.hp < w.maxHp);
});

test('拋石手：拋最前面那隻，不是最遠的；投石機升級後裝填變快、濺射變大', () => {
  const G = setup();
  assert.ok(E.place(G, 2, 0, 'lobber').ok);
  const near = spawn(G, 'wolf', 2, 3), far = spawn(G, 'wolf', 2, 6); near.st.stun = far.st.stun = 99;
  run(G, 3);
  assert.ok(near.hp < near.maxHp && far.hp === far.maxHp, `拋前面的 ${near.hp} / ${far.hp}`);
  const G2 = setup(28);
  assert.ok(E.place(G2, 2, 0, 'catapult').ok);
  assert.ok(E.tapUnit(G2, 2, 0).ok, '第 28 夜起能升級'); assert.ok(G2.units['2,0'].upgraded);
  spawn(G2, 'wolf', 2, 5).st.stun = 99; G2.units['2,0'].timer = 0; run(G2, 0.1);
  assert.ok(G2.shots[0] && Math.abs(G2.shots[0].splash - 1.5) < 1e-9 && Math.abs(G2.units['2,0'].timer - 2.6) < 0.1, '濺射 1.5、間隔 2.6');
  const G3 = setup(21); assert.ok(E.place(G3, 2, 0, 'catapult').ok); assert.ok(!E.tapUnit(G3, 2, 0).ok, '第 21 夜還不會升級');
});

test('石堆：只能放坡上；點一下推倒→右邊地面敵人受傷退一格暈住、不退糧不算損失；被咬垮也滾、鏟除不滾', () => {
  const G = setup();
  assert.ok(!E.place(G, 2, 3, 'cairn').ok, '坡緣不行'); assert.ok(E.place(G, 2, 4, 'cairn').ok);
  const G1 = E.create(1, 'calm', () => 0.5); G1.food = 9999; G1.started = true; G1.level = { ...G1.level, units: Object.keys(D.UNITS) };
  assert.ok(!E.place(G1, 2, 4, 'cairn').ok, '沒有坡的夜放不了');
  const a = spawn(G, 'wolf', 2, 5), b = spawn(G, 'wolf', 2, 6.2), c = spawn(G, 'wolf', 2, 2), fly = spawn(G, 'bird', 2, 5.5);
  const food = G.food, lost = G.unitsLost;
  assert.ok(E.tapUnit(G, 2, 4).ok); run(G, 0.05);
  assert.ok(!G.units['2,4'], '石堆沒了'); assert.strictEqual(G.food, food, '推倒不退糧'); assert.strictEqual(G.unitsLost, lost, '推倒不算損失');
  assert.ok(a.hp === a.maxHp - 80 && b.hp === b.maxHp - 80, '右邊兩隻各 80'); assert.strictEqual(c.hp, c.maxHp, '左邊的沒事'); assert.strictEqual(fly.hp, fly.maxHp, '飛的沒事');
  assert.ok(a.x > 5.9 && a.st.stun > 0, '退一格暈住 x=' + a.x);
  const G2 = setup(); assert.ok(E.place(G2, 2, 5, 'cairn').ok);
  const w = spawn(G2, 'wolf', 2, 5.6), far = spawn(G2, 'wolf', 2, 6.8); far.st.stun = 99; G2.units['2,5'].hp = 1; run(G2, 0.5);
  assert.ok(!G2.units['2,5'] && far.hp < far.maxHp && G2.unitsLost === 1, '咬垮也滾石，算損失');
  const G3 = setup(); assert.ok(E.place(G3, 2, 5, 'cairn').ok); const z = spawn(G3, 'wolf', 2, 6.5); z.st.stun = 99;
  assert.ok(E.sell(G3, 2, 5).ok); run(G3, 0.05); assert.strictEqual(z.hp, z.maxHp, '鏟除不滾');
  const G4 = setup(); assert.ok(E.place(G4, 2, 5, 'cairn').ok); G4.units['2,5'].hp = 100; assert.ok(!E.tapUnit(G4, 2, 5).msg.includes('修補'), '石堆點了是推倒不是修補');
  const u5 = setup(); assert.ok(E.place(u5, 2, 5, 'cairn').ok); const h = spawn(u5, 'aurochs', 2, 6.5); h.st.stun = 0; const hx = h.x; E.tapUnit(u5, 2, 5); run(u5, 0.05);
  assert.ok(h.hp === h.maxHp - 80 && Math.abs(h.x - hx) < 0.05, '野牛只受傷不退');
});

test('陷坑：第一隻踩進來的困住 4 秒、頭目 2.5 秒，坑塌不算損失；迷羊、飛的不觸發', () => {
  const G = setup(23);
  assert.ok(E.place(G, 2, 3, 'pit').ok);
  E.dev.stray(G, 2, 3.2); run(G, 1); assert.ok(G.units['2,3'], '迷羊不踩塌坑');
  G.strays = [];
  spawn(G, 'bird', 2, 3.1).st.stun = 0; run(G, 0.5); assert.ok(G.units['2,3'], '飛的不觸發');
  const w = spawn(G, 'wolf', 2, 3.6); run(G, 1.5);
  assert.ok(!G.units['2,3'], '坑塌了'); assert.ok(w.st.stun > 2.5 && w.st.stun <= 4, '困住約 4 秒：' + w.st.stun); assert.strictEqual(G.unitsLost, 0);
  const G2 = setup(23); assert.ok(E.place(G2, 1, 3, 'pit').ok);
  const bear = spawn(G2, 'bear', 1, 3.6); run(G2, 2.5); assert.ok(bear.st.stun > 1.5 && bear.st.stun <= 2.5, '熊是頭目，2.5 秒：' + bear.st.stun);
  const G3 = setup(23); assert.ok(E.place(G3, 1, 3, 'pit').ok);
  const au = spawn(G3, 'aurochs', 1, 3.6); run(G3, 3); assert.ok(au.st.stun > 0 && au.st.stun <= 2.5, '野牛困得住：' + au.st.stun);
});

test('水袋：倒在有人的格子上，九格內回滿血、解除恐懼；休息中的狗不算', () => {
  const G = setup(26);
  assert.ok(E.place(G, 2, 3, 'tower').ok); assert.ok(E.place(G, 1, 2, 'slinger').ok); assert.ok(E.place(G, 4, 3, 'wall').ok); assert.ok(E.place(G, 3, 4, 'dog').ok);
  G.units['2,3'].hp = 50; G.units['1,2'].hp = 10; G.units['1,2'].fear = 2; G.units['4,3'].hp = 10; G.units['3,4'].hp = 1; G.units['3,4'].resting = true; G.units['3,4'].restT = 5;
  const food = G.food;
  assert.ok(E.place(G, 2, 3, 'waterskin').ok, '可以倒在守望樓上'); run(G, 0.05);
  assert.strictEqual(G.units['2,3'].hp, 600); assert.strictEqual(G.units['1,2'].hp, 60); assert.strictEqual(G.units['1,2'].fear, 0);
  assert.strictEqual(G.units['4,3'].hp, 10, '第 4 排不在九格內'); assert.ok(G.units['3,4'].hp < 50, '休息中的狗不算');
  assert.strictEqual(G.food, food - 75); assert.ok(G.units['2,3'].type === 'tower', '守望樓還在');
});

test('強盜：走到坡下第 2 格就站住丟最前面的夥伴，地板不算靶；沒夥伴就繼續走；被咬住不丟', () => {
  const G = setup(22);
  assert.ok(E.place(G, 2, 1, 'slinger').ok); assert.ok(E.place(G, 2, 3, 'wall').ok); assert.ok(E.place(G, 2, 4, 'thorns').ok);
  const r = spawn(G, 'robber', 2, 6.5); run(G, 10);
  assert.ok(r.x <= 5 && r.x > 4.5, '站在 x≈5：' + r.x);
  assert.ok(G.units['2,3'].hp < 300, '牆被丟'); assert.strictEqual(G.units['2,1'].hp, 60, '後面的沒事'); assert.strictEqual(G.units['2,4'].hp, 150, '荊棘不是靶');
  assert.strictEqual(r.hp, r.maxHp, '坡上的投石手打不到牠');
  const G2 = setup(22); const q = spawn(G2, 'robber', 2, 6.5); run(G2, 15); assert.ok(q.x < 4, '沒夥伴就一直走：' + q.x);
  const G3 = setup(22); assert.ok(E.place(G3, 2, 2, 'dog').ok); assert.ok(E.place(G3, 2, 3, 'wall').ok);
  const p = spawn(G3, 'robber', 2, 5.2); run(G3, 4);
  assert.ok(p.heldBy, '狗咬住牠'); const hp = G3.units['2,3'].hp; run(G3, 3); assert.strictEqual(G3.units['2,3'].hp, hp, '被咬住不丟');
  assert.ok(p.hp < p.maxHp - 60, '狗用獵物傷害咬：' + p.hp);
});

test('大鷹：飛高時投射物與瓦瓶都打不到、不吸拋石手的瞄準；守望樓那排飛不高，樓拆了又飛高', () => {
  const G = setup(24);
  assert.ok(E.place(G, 2, 1, 'slinger').ok); assert.ok(E.place(G, 2, 0, 'lobber').ok);
  const e = spawn(G, 'eagle', 2, 6); e.st.stun = 99; const w = spawn(G, 'wolf', 2, 3); w.st.stun = 99;
  run(G, 3);
  assert.ok(e.high && e.hp === e.maxHp, '飛高打不到'); assert.ok(w.hp < w.maxHp, '拋石手改砸狼');
  assert.ok(E.place(G, 2, 3, 'jar').ok); run(G, 0.1); assert.strictEqual(e.hp, e.maxHp, '瓦瓶炸不到');
  assert.ok(E.place(G, 2, 4, 'tower').ok); run(G, 2);
  assert.ok(!e.high && e.hp < e.maxHp, '守望樓那排飛不高，打得到');
  E.sell(G, 2, 4); run(G, 0.1); assert.ok(e.high, '樓拆了又飛高');
});

test('大鷹羊的帳務：抓羊飛低；打下來羊落地走回圈不加羊不給糧；飛出場少一隻；落地的羊再被狼叼走才算失落', () => {
  const G = setup(24); G.food = 500;
  const e = spawn(G, 'eagle', 2, 0.2); run(G, 6);
  assert.ok(e.carrying && e.carryOwn && !e.high && e.x > 0, '抓了羊往回飛、飛低了');
  assert.strictEqual(G.sheep, 3, '抓走時名額還在');
  e.hp = 0; run(G, 0.1);
  assert.strictEqual(G.strays.length, 1); assert.ok(G.strays[0].own, '落地的是自己的羊');
  G.level = { ...G.level, noTrickle: true }; const food = G.food; run(G, 30);
  assert.strictEqual(G.strays.length, 0, '走回圈了'); assert.strictEqual(G.sheep, 3, '不加羊'); assert.strictEqual(G.sheepSaved, 0); assert.strictEqual(G.food, food, '不給糧（滴漏已關）');
  const G2 = setup(24); const f = spawn(G2, 'eagle', 1, 0.2); run(G2, 25);
  assert.strictEqual(G2.sheep, 2); assert.strictEqual(G2.sheepLost, 1); assert.ok(f.dead);
  const G3 = setup(24); E.dev.stray(G3, 1, 6.5, true); const wolf = spawn(G3, 'wolf', 1, 6.6); run(G3, 6);
  assert.strictEqual(G3.sheep, 2); assert.strictEqual(G3.sheepLost, 1, '自己的羊被叼出場才算失落');
  const G4 = setup(24); E.dev.stray(G4, 1, 3, true); G4.wave = 2; const snap = E.snapshot(G4);
  assert.ok(E.checkSnapshot(snap, 24) && snap.strays[0].own === true, '檢查點記得羊的來源');
  const G5 = setup(24); E.dev.stray(G5, 1, 3, true); G5.wave = G5.waves.length; G5.holdWaves = false; G5.phase = 'rest'; G5.timer = 0.01; run(G5, 0.1);
  assert.ok(G5.over && G5.result.win && G5.sheep === 3, '天亮時自己的羊不多算一隻');
});

test('野牛：推不動（角聲、瓦瓶）、狗不理、撞牆 150、咬牆兩倍；荊棘減得慢', () => {
  const G = setup(27);
  assert.ok(E.place(G, 2, 0, 'horn').ok); G.units['2,0'].timer = 0.1;
  const a = spawn(G, 'aurochs', 2, 4); a.st.stun = 0; const x0 = a.x; run(G, 0.3);
  assert.ok(Math.abs(a.x - x0) < 0.1 && !a.st.stun, '角聲推不動也不暈');
  assert.ok(E.place(G, 2, 4, 'jar').ok); run(G, 0.05); assert.ok(!a.st.panic && a.hp < a.maxHp, '瓦瓶只傷不嚇');
  const G2 = setup(27); assert.ok(E.place(G2, 2, 2, 'dog').ok); const b = spawn(G2, 'aurochs', 2, 3); run(G2, 2); assert.ok(!b.heldBy, '狗不理牠');
  const G3 = setup(27); assert.ok(E.place(G3, 2, 3, 'wall').ok); const c = spawn(G3, 'aurochs', 2, 3.65); run(G3, 1.2);
  assert.ok(G3.units['2,3'].hp <= 150 && G3.units['2,3'].hp > 140, '撞一下 150：' + G3.units['2,3'].hp);
  const G4 = setup(27); assert.ok(E.place(G4, 2, 5, 'thorns').ok); const d = spawn(G4, 'aurochs', 2, 5.2); run(G4, 0.5);
  assert.ok(d.st.slow); const sp = D.ENEMIES.aurochs.speed * D.STATUS.slow.heavyMul; const dx0 = d.x; run(G4, 1); assert.ok(Math.abs((dx0 - d.x) - sp) < 0.03, '荊棘上用 heavyMul');
});

test('一筆糧的夜：沒牧人也合規、不滴糧、預設隊伍沒牧人；舊隊伍帶牧人就不合規', () => {
  const L = E.levelById(25);
  assert.ok(!L.units.includes('shepherd')); const p = E.defaultPick(L); assert.ok(E.validPick(L, p) && !p.includes('shepherd'));
  assert.ok(!E.validPick(L, ['shepherd', 'slinger', 'wall', 'sling']), '帶牧人不合規');
  const G = E.create(25, 'calm', () => 0.5); assert.strictEqual(G.food, L.startFood); G.started = true; G.holdWaves = true; G.phase = 'rest'; G.timer = 999;
  run(G, 20); assert.strictEqual(G.food, L.startFood, '不滴糧'); assert.ok(G.taughtElder);
  assert.ok(!E.place(G, 2, 0, 'shepherd').ok, '這一夜沒有牧人這張卡');
});

test('關卡守門：有會抓羊的沒 sheep、有石堆沒 hill 都報', () => {
  assert.deepStrictEqual(E.validateLevels(), []);
  const L = D.LEVELS.find(l => l.id === 24); const s = L.sheep; delete L.sheep;
  assert.ok(E.validateLevels().some(m => m.includes('24')), '第 24 夜沒 sheep 要報'); L.sheep = s;
  const K = D.LEVELS.find(l => l.id === 22); const h = K.hill; delete K.hill;
  assert.ok(E.validateLevels().some(m => m.includes('22')), '第 22 夜沒 hill 要報'); K.hill = h;
  assert.deepStrictEqual(E.validateLevels(), []);
});

test('檢查點：第三章的單位種類能存能還原', () => {
  const G = setup(29);
  for (const [r, c, k] of [[2, 4, 'cairn'], [2, 1, 'lobber'], [1, 3, 'pit'], [3, 0, 'catapult']]) assert.ok(E.place(G, r, c, k).ok);
  G.wave = 2;
  const snap = E.snapshot(G);
  assert.ok(E.checkSnapshot(snap, 29));
  const G2 = E.create(29, 'calm', () => 0.5); G2.level = { ...G2.level, units: Object.keys(D.UNITS) };
  assert.ok(E.restore(G2, snap)); assert.strictEqual(Object.keys(G2.units).length, 4);
});
