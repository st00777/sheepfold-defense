// 第二章機制：無月夜與油燈、牧人杖、豺狼繞路、野豬撞牆踩荊棘、投石隊三排、夜鴞飄排、豹換排蹲伏、迷羊與抱羊羔的牧人、巡夜人、送卡模式、銀號
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const D = require(path.join(__dirname, '..', 'data.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));
const { COLS } = D;

function setup(levelId = 8, rng = () => 0.5) {
  const G = E.create(levelId, 'calm', rng); G.food = 9999; G.started = true; G.phase = 'rest'; G.timer = 999; G.holdWaves = true;
  G.level = { ...G.level, units: Object.keys(D.UNITS) }; // 測試不受點兵限制
  return G;
}
function run(G, sec) { for (let i = 0; i < Math.round(sec * 30); i++) { E.step(G, 1 / 30); G.events.length = 0; } }
function spawn(G, type, r, x) { E.dev.spawn(G, type, r, x); return G.enemies[G.enemies.length - 1]; }
const ev = (G, t) => G.events.filter(e => e.t === t);

test('無月夜：第二波起腳印看不見，油燈照到的三排看得見', () => {
  const G = setup(8);
  G.holdWaves = false; G.phase = 'rest'; G.wave = 0; G.timer = D.FORESHADOW_LEAD; // 第 1 波前
  E.step(G, 0.01);
  assert.ok(G.nextVisible && ev(G, 'marker')[0].r !== null, '第 1 波有腳印');
  G.events.length = 0; G.nextRow = null; G.wave = 1; G.timer = D.FORESHADOW_LEAD; G.builtWave = -1;
  E.step(G, 0.01);
  assert.strictEqual(G.nextVisible, false); assert.strictEqual(ev(G, 'marker')[0].r, null);
  // 油燈在第 2 排：第 1-3 排看得見
  G.events.length = 0; G.nextRow = null; G.builtWave = -1; G.timer = D.FORESHADOW_LEAD;
  assert.ok(E.place(G, 2, 1, 'lamp').ok);
  const lit = [0, 1, 2, 3, 4].map(r => E.rowLit(G, r));
  assert.deepStrictEqual(lit, [false, true, true, true, false]);
});

test('牧人杖：中間排上下輪流趕、邊排往中間趕、頭目趕不動、自己掉血', () => {
  const G = setup();
  assert.ok(E.place(G, 2, 3, 'staff').ok);
  const a = spawn(G, 'wolf', 2, 3.9); run(G, 1.5);
  assert.notStrictEqual(a.r, 2, '第一隻被趕走'); const first = a.r;
  const b = spawn(G, 'wolf', 2, 3.9); run(G, 1.5);
  assert.notStrictEqual(b.r, 2); assert.notStrictEqual(b.r, first, '第二隻趕去另一邊');
  assert.strictEqual(G.units['2,3'].hp, 150 - 20, '趕兩隻掉 20 血');
  assert.ok(E.place(G, 0, 3, 'staff').ok);
  const c = spawn(G, 'wolf', 0, 3.9); run(G, 1.5);
  assert.strictEqual(c.r, 1, '最上排往下趕');
  const bear = spawn(G, 'bear', 2, 3.9); run(G, 4);
  assert.strictEqual(bear.r, 2, '熊不被趕'); assert.ok(G.units['2,3'].hp < 130, '熊咬杖');
});

test('豺狼：前面是牆、隔壁空著就繞排；三排都有牆就咬', () => {
  const G = setup();
  assert.ok(E.place(G, 2, 4, 'wall').ok);
  const j = spawn(G, 'jackal', 2, 4.9); run(G, 1.5);
  assert.notStrictEqual(j.r, 2, '繞到隔壁');
  const G2 = setup();
  for (const r of [1, 2, 3]) assert.ok(E.place(G2, r, 4, 'wall').ok);
  const k = spawn(G2, 'jackal', 2, 4.9); run(G2, 2);
  assert.strictEqual(k.r, 2); assert.ok(G2.units['2,4'].hp < 300, '沒地方繞就咬牆');
});

test('野豬：撞牆第一下 100 並自暈；踩過荊棘直接爛', () => {
  const G = setup();
  assert.ok(E.place(G, 2, 4, 'wall').ok);
  const b = spawn(G, 'boar', 2, 4.9); run(G, 1.3);
  assert.ok(G.units['2,4'].hp <= 200 && G.units['2,4'].hp > 190, '撞一下 100：' + G.units['2,4'].hp);
  assert.ok(b.st.stun > 0, '撞完自己暈');
  assert.ok(E.place(G, 3, 5, 'thorns').ok);
  spawn(G, 'boar', 3, 5.8); run(G, 1.5);
  assert.ok(!G.units['3,5'], '荊棘被踩爛');
});

test('投石隊：有敵人的上下三排各丟一顆', () => {
  const G = setup();
  assert.ok(E.place(G, 2, 1, 'volley').ok);
  for (const r of [1, 2, 3, 4]) spawn(G, 'wolf', r, 5);
  run(G, 1.2);
  const rows = new Set(G.shots.map(s => s.r));
  assert.ok(rows.has(1) && rows.has(2) && rows.has(3), '三排都有石子 ' + [...rows]);
  assert.ok(!rows.has(4) && !rows.has(0), '第 4 排打不到');
});

test('夜鴞：以中間排為軸在三排之間飄，不飄出棋盤', () => {
  const G = setup(12, () => 0.1);
  const o = spawn(G, 'owl', 0, 6.5);
  assert.strictEqual(o.r0, 1, '最上排出生也以第 1 排為軸');
  const seen = new Set();
  for (let i = 0; i < 150; i++) { E.step(G, 1 / 30); G.events.length = 0; seen.add(o.r); }
  assert.ok(seen.size >= 2, '排號會變：' + [...seen]); assert.ok([...seen].every(r => r >= 0 && r <= 2));
});

test('豹：每 7 秒換排、走到第 5 格蹲 2 秒再衝、被狗咬住不換排', () => {
  const G = setup(13, () => 0.9);
  const l = spawn(G, 'leopard', 2, 6.4); run(G, 4);
  assert.notStrictEqual(l.r, 2, '第一次 3.5 秒就換排');
  const G2 = setup(13);
  const m = spawn(G2, 'leopard', 2, 5.3); run(G2, 1.5);
  assert.ok(m.crouchT > 0 && m.x <= 5 && m.x > 4.9, '蹲著不動 x=' + m.x);
  run(G2, 2.5);
  assert.ok(m.dashLeft > 0 || m.x < 4.3, '蹲完衝刺 x=' + m.x);
  const G3 = setup(13, () => 0.9);
  assert.ok(E.place(G3, 2, 2, 'dog').ok);
  const n = spawn(G3, 'leopard', 2, 3.2); run(G3, 6); // 狗撐不到 8 秒就回窩，6 秒內一定還咬著
  assert.strictEqual(n.r, 2, '被狗咬住就不換排'); assert.ok(n.heldBy);
});

test('迷羊：走到抱羊羔的牧人那格就回圈；被狼叼走，狼倒下羊落地', () => {
  const G = setup(10);
  assert.ok(E.place(G, 2, 3, 'cradle').ok);
  const sheep0 = G.sheep, food0 = G.food;
  E.dev.stray(G, 2, 4.2); run(G, 8);
  assert.strictEqual(G.strays.length, 0); assert.strictEqual(G.sheep, sheep0 + 1); assert.ok(G.food >= food0 + D.STRAY.reward && G.food <= food0 + D.STRAY.reward + 10, '糧 +25（含滴漏）');
  const G2 = setup(10);
  E.dev.stray(G2, 1, 5); const w = spawn(G2, 'wolf', 1, 5.2); run(G2, 1);
  assert.ok(w.carrying && w.carryStray, '狼叼走了'); assert.strictEqual(G2.strays.length, 0);
  run(G2, 1); assert.ok(w.x > 5.2, '叼著往右跑');
  w.hp = 0; run(G2, 0.1);
  assert.strictEqual(G2.strays.length, 1, '羊落地繼續走'); assert.strictEqual(G2.sheep, 3);
  // 叼出場算失落
  const G3 = setup(10);
  E.dev.stray(G3, 1, 6.5); const v = spawn(G3, 'wolf', 1, 6.6); run(G3, 6);
  assert.strictEqual(G3.sheep, 2); assert.strictEqual(G3.sheepLost, 1);
});

test('巡夜人：在三排之間來回走，走到那排就打前方的敵人', () => {
  const G = setup(10);
  assert.ok(E.place(G, 2, 2, 'patrol').ok);
  const u = G.units['2,2'];
  const rows = new Set(); for (let i = 0; i < 150; i++) { E.step(G, 1 / 30); G.events.length = 0; rows.add(Math.round(u.rv)); }
  assert.deepStrictEqual([...rows].sort(), [1, 2, 3]);
  const w = spawn(G, 'wolf', 1, 2.9); w.st.stun = 99; const hp0 = w.hp;
  run(G, 4);
  assert.ok(w.hp < hp0, '被打了 ' + w.hp);
});

test('送卡模式：手上有卡才能放、不花糧、定時補卡、每波點名的卡先送到', () => {
  const G = E.create(11, 'calm', () => 0.5); G.started = true; G.holdWaves = true; G.phase = 'rest'; G.timer = 999;
  assert.strictEqual(G.hand.length, 3); assert.strictEqual(G.food, 0);
  const k = G.hand[0];
  const miss = Object.keys(D.UNITS).find(x => !G.hand.includes(x) && G.level.units.includes(x));
  assert.ok(!E.place(G, 2, 0, miss).ok, '沒送到不能放');
  assert.ok(E.place(G, 2, 0, k).ok); assert.strictEqual(G.hand.length, 2); assert.strictEqual(G.food, 0);
  run(G, 30); assert.strictEqual(G.hand.length, 6, '補到上限');
  G.holdWaves = false; G.phase = 'rest'; G.wave = 1; G.timer = 0.01; run(G, 0.1);
  assert.ok(G.hand.includes('staff'), '第 2 波點名牧人杖');
});

test('銀號：吹一次五排都退', () => {
  const G = setup(14);
  assert.ok(E.place(G, 2, 0, 'horn').ok); G.units['2,0'].timer = 0.1;
  assert.ok(E.tapUnit(G, 2, 0).ok, '升級銀號');
  const a = spawn(G, 'wolf', 0, 4), b = spawn(G, 'wolf', 4, 4); run(G, 0.3);
  assert.ok(a.x > 4.5 && b.x > 4.5, '最上最下排都被推 ' + a.x + ' ' + b.x);
});

test('檢查點：第二章的單位種類能存能還原', () => {
  const G = setup(13);
  for (const [r, c, k] of [[2, 3, 'staff'], [2, 1, 'lamp'], [1, 2, 'patrol'], [3, 1, 'volley'], [0, 2, 'cradle']]) assert.ok(E.place(G, r, c, k).ok);
  G.wave = 2;
  const snap = E.snapshot(G);
  assert.ok(E.checkSnapshot(snap, 13));
  const G2 = E.create(13, 'calm', () => 0.5); G2.level = { ...G2.level, units: Object.keys(D.UNITS) };
  assert.ok(E.restore(G2, snap)); assert.strictEqual(Object.keys(G2.units).length, 5);
});

test('組合：牧人杖不打乒乓（趕過的狼不會被趕回原排）', () => {
  const G = setup();
  assert.ok(E.place(G, 0, 3, 'staff').ok); assert.ok(E.place(G, 1, 3, 'staff').ok);
  const w = spawn(G, 'wolf', 0, 3.9); run(G, 1.5);
  assert.strictEqual(w.r, 1, '先被趕到第 1 排');
  run(G, 6);
  assert.notStrictEqual(w.r, 0, '不會被第 1 排的杖趕回第 0 排'); assert.ok(G.units['1,3'].hp < 150, '改成咬那根杖');
});

test('組合：瓦瓶與銀號讓叼羊的丟下羊', () => {
  const G = setup(10);
  E.dev.stray(G, 1, 5); const w = spawn(G, 'wolf', 1, 5.2); run(G, 1);
  assert.ok(w.carrying);
  assert.ok(E.place(G, 1, 5, 'jar').ok); run(G, 0.1);
  assert.ok(!w.carrying && G.strays.length === 1, '瓦瓶一炸，羊落地');
  const G2 = setup(14);
  E.dev.stray(G2, 0, 5); const v = spawn(G2, 'wolf', 0, 5.2); run(G2, 1); assert.ok(v.carrying);
  assert.ok(E.place(G2, 2, 0, 'horn').ok); G2.units['2,0'].timer = 0.1; assert.ok(E.tapUnit(G2, 2, 0).ok); run(G2, 0.3);
  assert.ok(!v.carrying && G2.strays.length === 1, '銀號一吹，羊落地');
});

test('組合：送卡模式拆單位退回手上', () => {
  const G = E.create(11, 'calm', () => 0.5); G.started = true; G.holdWaves = true; G.phase = 'rest'; G.timer = 999;
  const k = G.hand[0]; assert.ok(E.place(G, 2, 0, k).ok); const n = G.hand.length;
  assert.ok(E.sell(G, 2, 0).ok); assert.strictEqual(G.hand.length, n + 1); assert.strictEqual(G.hand[G.hand.length - 1], k); assert.strictEqual(G.food, 0);
});

test('檢查點：送卡模式手牌跟著存、迷羊回圈後羊數不被壓回', () => {
  const G = E.create(11, 'calm', () => 0.5); G.started = true; G.holdWaves = true; G.phase = 'rest'; G.timer = 999;
  run(G, 20); G.wave = 2; const snap = E.snapshot(G);
  assert.ok(snap.hand.length >= 5); assert.ok(E.checkSnapshot(snap, 11));
  const G2 = E.create(11, 'calm', () => 0.5); assert.ok(E.restore(G2, snap)); assert.deepStrictEqual(G2.hand, snap.hand);
  const G3 = setup(10); G3.sheep = 5; G3.wave = 2; const s3 = E.snapshot(G3);
  const G4 = E.create(10, 'calm', () => 0.5); assert.ok(E.restore(G4, s3)); assert.strictEqual(G4.sheep, 5);
});

test('無月夜：油燈放下後舊腳印補出、夜鴞預告排不會指到邊排', () => {
  const G = setup(9);
  G.holdWaves = false; G.phase = 'rest'; G.wave = 1; G.timer = D.FORESHADOW_LEAD; G.builtWave = -1;
  E.step(G, 0.01); assert.strictEqual(G.nextVisible, false); G.events.length = 0;
  assert.ok(E.place(G, 2, 1, 'lamp').ok); E.step(G, 0.01);
  const m = ev(G, 'marker'); assert.ok(m.length && m[m.length - 1].r === G.nextRow, '放燈後腳印補出');
  const G2 = setup(12, () => 0.01); // rng 0.01 會挑第 0 排
  G2.holdWaves = false; G2.phase = 'rest'; G2.wave = 1; G2.timer = D.FORESHADOW_LEAD; G2.builtWave = -1; G2.waves[1].list = [['owl', 1]];
  E.step(G2, 0.01); assert.ok(G2.nextRow >= 1 && G2.nextRow <= 3, '夜鴞預告排 ' + G2.nextRow);
});

test('迷羊：波次提早清完也照時間來，天亮時還沒來的也算回圈', () => {
  const G = setup(10); G.holdWaves = false; G.phase = 'rest'; G.wave = 1; G.timer = 0.01; G.waves[1].list = [['wolf', 1]]; G.waves[1].strays = [1, 40];
  assert.ok(E.place(G, 2, 1, 'sling').ok); assert.ok(E.place(G, 1, 1, 'sling').ok); assert.ok(E.place(G, 3, 1, 'sling').ok);
  run(G, 8); // 一隻狼早就打完、進休息
  assert.strictEqual(G.phase, 'rest'); assert.strictEqual(G.strayQueue.length, 1, '40 秒那隻還排著');
  run(G, 3); assert.strictEqual(G.wave, 3); assert.strictEqual(G.strayQueue.length, 2, '下一波開始時把剩下的接上');
  const s0 = G.sheep; G.wave = G.waves.length; G.phase = 'rest'; G.timer = 0.01; run(G, 0.1);
  assert.ok(G.over && G.result.win); assert.ok(G.sheep >= s0 + 1, '沒來的迷羊天亮算回圈');
});

