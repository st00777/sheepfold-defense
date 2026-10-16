// 纏裹的牧人：回血會疊加；膏油後範圍 5×5、回血 12；獅子咆哮嚇不停它
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const D = require(path.join(__dirname, '..', 'data.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));

function setup() {
  const G = E.create(7, 'calm', () => 0.5); G.food = 9999; G.started = true; G.phase = 'rest'; G.timer = 999; G.holdWaves = true;
  return G;
}
function hurtWall(G, r, c, hp) { assert.ok(E.place(G, r, c, 'wall').ok); G.units[r + ',' + c].hp = hp; return G.units[r + ',' + c]; }
function run(G, sec) { for (let i = 0; i < Math.round(sec * 30); i++) { E.step(G, 1 / 30); G.events.length = 0; } }

test('基礎：周圍八格每秒 8，兩格外不補', () => {
  const G = setup();
  assert.ok(E.place(G, 2, 3, 'healer').ok);
  const near = hurtWall(G, 2, 4, 100), far = hurtWall(G, 2, 5, 100);
  run(G, 4);
  assert.ok(near.hp >= 100 + 8 * 3 && near.hp <= 100 + 8 * 5, 'near ' + near.hp);
  assert.strictEqual(far.hp, 100);
});

test('疊加：三隻相鄰各補一次', () => {
  const G = setup();
  for (const r of [1, 2, 3]) assert.ok(E.place(G, r, 3, 'healer').ok);
  const w = hurtWall(G, 2, 4, 100);
  run(G, 4);
  assert.ok(w.hp >= 100 + 24 * 3 && w.hp <= 100 + 24 * 5, 'stack ' + w.hp);
});

test('膏油：50 糧，範圍 2 格、每秒 12；只能升一次', () => {
  const G = setup();
  assert.ok(E.place(G, 2, 3, 'healer').ok);
  const food = G.food;
  assert.ok(E.tapUnit(G, 2, 3).ok);
  assert.strictEqual(food - G.food, 50);
  assert.ok(G.units['2,3'].upgraded);
  assert.strictEqual(E.tapUnit(G, 2, 3).ok, false);
  const far = hurtWall(G, 0, 5, 100), tooFar = hurtWall(G, 2, 6, 100);
  run(G, 4);
  assert.ok(far.hp >= 100 + 12 * 3 && far.hp <= 100 + 12 * 5, 'far ' + far.hp);
  assert.strictEqual(tooFar.hp, 100);
});

test('第 6 夜之前不能膏油', () => {
  const G = E.create(6, 'calm', () => 0.5); G.food = 9999; G.started = true;
  G.level.units = [...G.level.units, 'healer']; // 第 6 關本來沒這張卡，借來測 from 門檻
  assert.ok(E.place(G, 2, 3, 'healer').ok);
  assert.strictEqual(E.tapUnit(G, 2, 3).ok, false);
});

test('獅子咆哮嚇不停纏裹的牧人，但會嚇停投石手', () => {
  const G = setup(); G.phase = 'wave';
  assert.ok(E.place(G, 2, 3, 'healer').ok);
  assert.ok(E.place(G, 1, 3, 'slinger').ok);
  E.dev.spawn(G, 'lion', 2, 4.2);
  const lion = G.enemies[0];
  let feared = false, healerFeared = false;
  for (let i = 0; i < 30 * 20; i++) {
    E.step(G, 1 / 30); G.events.length = 0;
    G.enemies = G.enemies.filter(x => x === lion);
    if (G.units['1,3'] && G.units['1,3'].fear > 0) feared = true;
    if (G.units['2,3'] && G.units['2,3'].fear > 0) healerFeared = true;
    if (feared) break;
  }
  assert.ok(feared, '投石手應被嚇到');
  assert.strictEqual(healerFeared, false);
});
