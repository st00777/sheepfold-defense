'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const D = require('../data.js');

function setup() {
  const G = E.create(14, 'calm', () => 0.5);
  G.level = { ...G.level, units: ['patrol', 'cradle'] };
  G.food = 1000; G.started = true; G.phase = 'rest'; G.wave = 1; G.timer = 999; G.holdWaves = true;
  return G;
}
function run(G, seconds) {
  for (let i = 0; i < Math.round(seconds * 30); i++) E.step(G, 1 / 30);
}
function spawn(G, type, row, x) {
  E.dev.spawn(G, type, row, x);
  const enemy = G.enemies[G.enemies.length - 1];
  enemy.st.stun = 99;
  return enemy;
}

test('巡夜人能轉向上下鄰排接敵，不再先走向空排', () => {
  for (const row of [1, 3]) {
    const G = setup(); E.place(G, 2, 3, 'patrol');
    const enemy = spawn(G, 'boar', row, 4.1), hp = enemy.hp;
    const unit = G.units['2,3'], before = unit.rv;
    E.step(G, 1 / 30);
    assert.ok(Math.abs(unit.rv - before) <= 1 / 30 / D.UNITS.patrol.walk + 1e-9, '仍按原速度走，不瞬移');
    assert.equal(Math.sign(unit.rv - before), Math.sign(row - before));
    run(G, 1.5);
    assert.ok(enemy.hp < hp, '鄰排敵人應及時受到攻擊');
  }
});

test('巡夜人優先走向更靠近羊圈的可接敵排', () => {
  const G = setup(); E.place(G, 2, 3, 'patrol');
  spawn(G, 'boar', 1, 3.5); spawn(G, 'boar', 3, 4.1);
  E.step(G, 1 / 30);
  assert.ok(G.units['2,3'].rv < 2);
});

test('巡夜人不追飛行、地下、已死、過遠或巡邏範圍外的敵人', () => {
  for (const [type, row, x, mutate] of [
    ['bird', 1, 4, () => {}], ['wolf', 0, 4, () => {}], ['wolf', 1, 5.5, () => {}],
    ['wolf', 1, 2, () => {}], ['wolf', 1, 4, e => { e.hp = 0; }],
    ['wolf', 1, 4, e => { e.underground = true; }],
  ]) {
    const G = setup(); E.place(G, 2, 3, 'patrol');
    mutate(spawn(G, type, row, x)); E.step(G, 1 / 30);
    assert.ok(G.units['2,3'].rv > 2, '無有效目標時維持原巡邏方向');
  }
});

test('巡夜人已在交戰時不離開，無敵時仍巡遍三排', () => {
  const G = setup(); E.place(G, 2, 3, 'patrol');
  spawn(G, 'boar', 2, 4.1); spawn(G, 'boar', 1, 3.5);
  run(G, 1); assert.equal(G.units['2,3'].rv, 2);
  const empty = setup(); E.place(empty, 2, 3, 'patrol');
  const rows = new Set();
  for (let i = 0; i < 150; i++) { E.step(empty, 1 / 30); rows.add(Math.round(empty.units['2,3'].rv)); }
  assert.deepEqual([...rows].sort(), [1, 2, 3]);
});

test('抱羊牧人在同一縱向位置接回本排與上下鄰排的羊，先於敵人叼羊', () => {
  for (const row of [1, 2, 3]) {
    const G = setup(); E.place(G, 2, 3, 'cradle');
    const sheep = G.sheep, food = G.food;
    E.dev.stray(G, row, 3.1); spawn(G, 'wolf', row, 3.55);
    E.step(G, 1 / 30);
    assert.equal(G.sheep, sheep + 1);
    assert.equal(G.food, food + D.STRAY.reward);
    assert.equal(G.strays.length, 0);
    assert.ok(G.enemies.every(e => !e.carryStray));
  }
});

test('接羊範圍不延伸至兩排外或尚未走近的位置，沒有牧人也不自動接回', () => {
  for (const [row, x, receiver] of [[0, 3.1, true], [1, 4, true], [1, 3.1, false]]) {
    const G = setup(); if (receiver) E.place(G, 2, 3, 'cradle');
    const sheep = G.sheep;
    E.dev.stray(G, row, x); E.step(G, 1 / 30);
    assert.equal(G.sheep, sheep); assert.equal(G.strays.length, 1);
  }
});

test('接羊範圍重疊不重複發獎，邊排牧人只接有效鄰排', () => {
  const G = setup(); E.place(G, 1, 3, 'cradle'); E.place(G, 2, 3, 'cradle');
  const sheep = G.sheep, food = G.food;
  E.dev.stray(G, 1, 3.1); E.step(G, 1 / 30);
  assert.equal(G.sheep, sheep + 1); assert.equal(G.food, food + D.STRAY.reward);
  const edge = setup(); E.place(edge, 0, 3, 'cradle');
  const before = edge.sheep;
  E.dev.stray(edge, 1, 3.1); E.dev.stray(edge, 4, 3.1); E.step(edge, 1 / 30);
  assert.equal(edge.sheep, before + 1); assert.equal(edge.strays.length, 1);
});
