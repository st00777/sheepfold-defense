'use strict';
// 小居 2026-10-21 審查第 1 項：巡夜人「站在哪排」一條規則——攻擊排＝碰撞排＝rv 四捨五入；只在整數排出手；鄰排那格有東西走不進去
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const D = require('../data.js');

function setup() {
  const G = E.create(14, 'calm', () => 0.5);
  G.level = { ...G.level, units: ['patrol', 'wall', 'shepherd'] };
  G.food = 1000; G.started = true; G.phase = 'rest'; G.wave = 1; G.timer = 999; G.holdWaves = true;
  return G;
}
const run = (G, s) => { for (let i = 0; i < Math.round(s * 30); i++) E.step(G, 1 / 30); };
const isInt = x => Math.abs(x - Math.round(x)) < 1e-9;

test('走到鄰排接敵後，那排的狼被他擋住並咬他；出手時一定站在整數排', () => {
  const G = setup(); E.place(G, 2, 3, 'patrol');
  const u = G.units['2,3'];
  E.dev.spawn(G, 'boar', 1, 4.2); const e = G.enemies[0];
  let bitten = false, hits = 0;
  for (let i = 0; i < 30 * 6 && !G.over; i++) {
    E.step(G, 1 / 30);
    for (const ev of G.events) if (ev.t === 'fx' && ev.kind === 'strike') { hits++; assert.ok(isInt(u.rv), '出手時不在兩排之間'); assert.equal(Math.round(u.rv), 1); }
    G.events.length = 0;
    if (e.biting === u.id) { bitten = true; assert.equal(Math.round(u.rv), 1); break; }
  }
  assert.ok(hits > 0, '有打到鄰排的敵人');
  assert.ok(bitten, '鄰排的敵人被他擋下、咬他，不是穿過去');
  assert.ok(u.hp < u.maxHp, '被咬掉血');
  assert.ok(e.x >= 3.0, '沒有穿過巡夜人那一格');
});

test('他走去鄰排時，家排空著：家排的狼從崗位直接走過，不會被看不見的人擋住', () => {
  const G = setup(); E.place(G, 2, 3, 'patrol');
  const u = G.units['2,3'];
  E.dev.spawn(G, 'boar', 1, 4.2); // 把他引去第 1 排（index 1）：一開始就在近戰範圍內
  run(G, 1.3); assert.equal(Math.round(u.rv), 1);
  G.enemies[0].st.stun = 99; // 把引他的敵人定在原地，他就留在第 1 排接戰
  E.dev.spawn(G, 'wolf', 2, 3.6); const w = G.enemies[1];
  run(G, 4);
  assert.ok(w.x < 2.9, '家排的狼走過了第 3 欄');
  assert.notEqual(w.biting, u.id);
});

test('鄰排他這一欄有牆：走不進去，只在走得進的排之間巡邏；敵人在那排也不去', () => {
  const G = setup(); E.place(G, 2, 3, 'patrol'); E.place(G, 1, 3, 'wall');
  const u = G.units['2,3'];
  const rows = new Set();
  for (let i = 0; i < 30 * 6; i++) { E.step(G, 1 / 30); rows.add(Math.round(u.rv)); assert.ok(u.rv >= 2 - 1e-9, '沒有走進有牆的那排'); }
  assert.deepEqual([...rows].sort(), [2, 3]);
  E.dev.spawn(G, 'boar', 1, 4.0); G.enemies[0].st.stun = 99;
  run(G, 3);
  assert.ok(u.rv >= 2 - 1e-9, '鄰排有敵人但那格有牆，還是不去');
});

test('他站著的鄰排那格被放了東西：讓出來走回家排，新單位擋狼', () => {
  const G = setup(); E.place(G, 2, 3, 'patrol');
  const u = G.units['2,3'];
  for (let i = 0; i < 60 && Math.abs(u.rv - 3) > 0.03; i++) E.step(G, 1 / 30); // 他到頭就折返，不停留；抓他站在第 3 排（index 3）那一刻
  assert.equal(Math.round(u.rv), 3, '巡到第 3 排（index 3）');
  assert.ok(E.place(G, 3, 3, 'wall').ok, '他站著的格子仍可放牆');
  run(G, 1.3);
  assert.ok(u.rv < 2.5, '讓出來往家排走');
  for (let i = 0; i < 30 * 5; i++) { E.step(G, 1 / 30); assert.ok(u.rv <= 2 + 1e-9, '之後不再走進有牆的那排'); }
  E.dev.spawn(G, 'wolf', 3, 3.6); const w = G.enemies[0];
  run(G, 1.5);
  assert.equal(w.biting, G.units['3,3'].id, '那排的狼咬的是牆');
});

test('存檔還原的巡夜人回到家排，規則不變', () => {
  const G = setup(); E.place(G, 2, 3, 'patrol');
  run(G, 1.3);
  const snap = E.snapshot(G);
  const G2 = E.create(14, 'calm', () => 0.5); G2.level = { ...G2.level, units: ['patrol', 'wall', 'shepherd'] };
  assert.ok(E.restore(G2, { ...snap, wave: 1 }));
  const u = G2.units['2,3']; assert.ok(u && u.rv === 2 && isInt(u.rv));
});
