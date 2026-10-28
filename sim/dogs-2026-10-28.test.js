// 2026-10-28 James 拍板：迷羊最右邊 1.5 格安全區；牧羊犬分工＋合咬（一敵一狗、新敵人由最晚盯上的狗轉去、敵人少就合咬、手上的死了去幫忙、叼羊的優先、閒狗輪流跟羊）
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const D = require(path.join(__dirname, '..', 'data.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));
const { COLS, STRAY } = D;

function setup(levelId = 14, rng = () => 0.5) {
  const G = E.create(levelId, 'calm', rng); G.food = 9999; G.started = true; G.phase = 'rest'; G.timer = 999; G.holdWaves = true;
  G.level = { ...G.level, units: Object.keys(D.UNITS), moonless: 0 };
  return G;
}
function run(G, sec) { for (let i = 0; i < Math.round(sec * 30); i++) { E.step(G, 1 / 30); G.events.length = 0; } }
function spawn(G, type, r, x) { E.dev.spawn(G, type, r, x); return G.enemies[G.enemies.length - 1]; }
const dogAt = (G, r, c) => G.units[r + ',' + c];

test('迷羊安全區：還在最右邊 1.5 格內的羊，同格出生的狼叼不到；走進第 6 格才叼得到', () => {
  const G = setup();
  const s = E.dev.stray(G, 2, COLS + 0.2); const w = spawn(G, 'wolf', 2, COLS);
  run(G, 2);
  assert.ok(!w.carrying && !s.dead, '剛進場貼著狼也沒被叼');
  assert.ok(s.x > COLS - STRAY.safe, '還在安全區');
  // 狼比羊快，會先走過去；之後羊走出安全區，後面沒狼了就一路平安
  run(G, 12);
  assert.ok(!s.dead && s.x < COLS - STRAY.safe, '走出安全區了還活著');
  const G2 = setup();
  const s2 = E.dev.stray(G2, 2, 5.0); const w2 = spawn(G2, 'wolf', 2, 5.1); run(G2, 0.5);
  assert.ok(w2.carrying && s2.dead, '第 6 格裡貼著狼就被叼');
});

test('合咬：同排兩隻狗、一隻狼，兩隻都咬上去，傷害疊加，狼只咬主咬手', () => {
  const G = setup();
  assert.ok(E.place(G, 2, 1, 'dog').ok); assert.ok(E.place(G, 2, 2, 'dog').ok);
  const d1 = dogAt(G, 2, 1), d2 = dogAt(G, 2, 2);
  const w = spawn(G, 'wolf', 2, 4.5); w.hp = w.maxHp = 1000;
  run(G, 3);
  assert.strictEqual(d1.holding, w.id); assert.strictEqual(d2.holding, w.id);
  assert.ok(d1.gripping && d2.gripping, '兩隻都咬住');
  assert.ok(w.heldBy === d1.id || w.heldBy === d2.id, '主咬手是其中一隻');
  assert.ok(Math.abs(d1.x - d2.x) > 0.2, '兩隻狗不疊在同一點');
  const hp0 = w.hp; const x0 = w.x; run(G, 1);
  assert.ok(Math.abs((hp0 - w.hp) - 2 * D.UNITS.dog.dps) < 1.5, `兩隻狗一秒合咬約 ${2 * D.UNITS.dog.dps}，實際 ${(hp0 - w.hp).toFixed(1)}`);
  assert.strictEqual(w.x, x0, '被咬住不動');
  const bitten = [d1, d2].filter(d => d.hp < d.maxHp);
  assert.strictEqual(bitten.length, 1, '只有主咬手在掉血');
});

test('分工：第二隻狼進來，最晚盯上的狗轉過去；手上的死了再回來幫忙', () => {
  const G = setup();
  assert.ok(E.place(G, 2, 1, 'dog').ok); assert.ok(E.place(G, 2, 2, 'dog').ok);
  const d1 = dogAt(G, 2, 1), d2 = dogAt(G, 2, 2);
  const a = spawn(G, 'wolf', 2, 4.5); a.hp = a.maxHp = 1000; run(G, 3);
  assert.ok(d1.gripping && d2.gripping && d1.holding === a.id && d2.holding === a.id);
  const b = spawn(G, 'wolf', 2, 6.5); b.hp = b.maxHp = 1000; run(G, 2);
  const onA = [d1, d2].filter(d => d.holding === a.id), onB = [d1, d2].filter(d => d.holding === b.id);
  assert.strictEqual(onA.length, 1, '一隻留在第一隻狼'); assert.strictEqual(onB.length, 1, '一隻轉去第二隻狼');
  assert.ok(onA[0].id < onB[0].id, '先盯上的（id 小）留下，後盯上的轉去');
  assert.ok(onA[0].gripping && a.heldBy === onA[0].id, '留下的接著當主咬手');
  assert.ok(onB[0].gripping && b.heldBy === onB[0].id, '轉去的已經咬住第二隻');
  a.hp = 0; run(G, 2);
  assert.ok(d1.holding === b.id && d2.holding === b.id && d1.gripping && d2.gripping, '第一隻死了，兩隻一起咬第二隻');
});

test('叼羊優先：咬著狼的狗看到別隻狼叼著羊跑，放手去追', () => {
  const G = setup();
  assert.ok(E.place(G, 2, 2, 'dog').ok); const d = dogAt(G, 2, 2);
  const a = spawn(G, 'wolf', 2, 3.5); a.hp = a.maxHp = 1000; run(G, 2);
  assert.ok(d.gripping && d.holding === a.id);
  E.dev.stray(G, 2, 1.0); const b = spawn(G, 'wolf', 2, 1.2); run(G, 0.2);
  assert.ok(b.carrying, '第二隻狼叼走了羊');
  run(G, 2);
  assert.strictEqual(d.holding, b.id, '狗放開第一隻去追叼羊的');
  assert.ok(d.gripping && b.heldBy === d.id, '追上咬住了');
  assert.ok(!a.heldBy, '第一隻狼被放開了');
});

test('主咬手被咬倒：換另一隻咬住的狗接手，狼還是不能走', () => {
  const G = setup();
  assert.ok(E.place(G, 2, 1, 'dog').ok); assert.ok(E.place(G, 2, 2, 'dog').ok);
  const d1 = dogAt(G, 2, 1), d2 = dogAt(G, 2, 2);
  const w = spawn(G, 'wolf', 2, 4.5); w.hp = w.maxHp = 1000; run(G, 3);
  const main = w.heldBy === d1.id ? d1 : d2, other = main === d1 ? d2 : d1;
  main.hp = 0; run(G, 0.1);
  assert.ok(main.resting && !main.holding, '主咬手回窩休息');
  assert.strictEqual(w.heldBy, other.id, '另一隻接手當主咬手');
  const x0 = w.x; run(G, 1); assert.strictEqual(w.x, x0, '狼還是被咬住不動');
});

test('閒狗輪流跟羊：兩隻狗兩隻羊，一狗跟一羊', () => {
  const G = setup();
  assert.ok(E.place(G, 2, 1, 'dog').ok); assert.ok(E.place(G, 2, 2, 'dog').ok);
  const d1 = dogAt(G, 2, 1), d2 = dogAt(G, 2, 2);
  const sA = E.dev.stray(G, 2, 5.0), sB = E.dev.stray(G, 2, 3.0);
  run(G, 3);
  assert.ok(Math.abs(d1.x - (sA.x + 0.6)) < 0.15, '第一隻狗跟第一隻羊');
  assert.ok(Math.abs(d2.x - (sB.x + 0.6)) < 0.15, '第二隻狗跟第二隻羊');
});
