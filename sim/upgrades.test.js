// 期 3 升級試作（2026-10-30）：雇工「講定工價」、火盆「壇上的火」、油燈「燈臺」。跑法：node --test sim/*.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const D = require(path.join(__dirname, '..', 'data.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));
const { UNITS } = D;
const rng = () => 0.5;
const run = (G, sec, dt = 0.05, onStep) => { for (let t = 0; t < sec; t += dt) { E.step(G, dt); if (onStep) onStep(G.events); G.events.length = 0; } };
const wolf = (G, r, x) => { E.dev.spawn(G, 'wolf', r, x); return G.enemies[G.enemies.length - 1]; };
const unitAt = (G, r, c) => G.units[r + ',' + c];

test('三條升級的 fromId 都換算成夜的位置，desc 的 {from} 也填進去了', () => {
  assert.strictEqual(UNITS.hireling.upgrade.from, 5);  // id 16 葡萄園的小狐狸
  assert.strictEqual(UNITS.brazier.upgrade.from, 9);   // id 17 烏西雅的牧場
  assert.strictEqual(UNITS.lamp.upgrade.from, 16);     // id 12 寬闊之地
  for (const k of ['hireling', 'brazier', 'lamp']) assert.ok(!UNITS[k].desc.includes('{from}'), k);
  assert.strictEqual(Object.values(UNITS).filter(u => u.upgrade).length, 7); // 荊棘、吹角手、纏裹、投石機＋這三張；老牧人與修補是特例不算
});

test('講定工價：還沒學會的夜點了不給升；學會後花 25 糧、血量 40→60 連現血一起補', () => {
  const early = E.create(3, 'calm', rng, { startFood: 500 }); // 第 4 夜雇工與賊：雇工剛開、還沒學會
  assert.ok(E.place(early, 2, 1, 'hireling').ok);
  const r0 = E.tapUnit(early, 2, 1);
  assert.strictEqual(r0.ok, false); assert.match(r0.msg, /第 5 夜/);
  const G = E.create(16, 'calm', rng, { startFood: 500 });
  assert.ok(E.place(G, 2, 1, 'hireling').ok);
  const u = unitAt(G, 2, 1); u.hp = 30; // 先咬掉一點，看升級是不是「上限多多少、現血就補多少」
  const f = G.food, r1 = E.tapUnit(G, 2, 1);
  assert.strictEqual(r1.ok, true);
  assert.strictEqual(G.food, f - 25);
  assert.strictEqual(u.upgraded, true); assert.strictEqual(u.maxHp, 60); assert.strictEqual(u.hp, 50);
  assert.strictEqual(E.tapUnit(G, 2, 1).ok, false); // 不能再升
  assert.strictEqual(E.tapHint(G, u), '');
});

test('講定工價：狼走到面前，沒付工價的逃了、付了的留下來打', () => {
  const mk = paid => { const G = E.create(16, 'calm', rng, { startFood: 500 }); E.place(G, 2, 1, 'hireling'); if (paid) assert.ok(E.tapUnit(G, 2, 1).ok); wolf(G, 2, 3); return G; };
  const A = mk(false), B = mk(true);
  let fledA = 0, fledB = 0;
  run(A, 12, 0.05, evs => { fledA += evs.filter(e => e.t === 'fx' && e.kind === 'flee').length; });
  run(B, 12, 0.05, evs => { fledB += evs.filter(e => e.t === 'fx' && e.kind === 'flee').length; });
  assert.strictEqual(fledA, 1, '沒付工價的雇工看見狼要逃');
  assert.strictEqual(fledB, 0, '付了工價的不逃');
  assert.ok(!unitAt(A, 2, 1), '逃走的格子空了');
  assert.ok(!B.enemies.length || B.enemies[0].hp < B.enemies[0].maxHp, '留下來的雇工有在打狼（12 秒內打死了就是空陣列）');
});

test('講定工價：獅子吼只讓他僵住，不會嚇跑', () => {
  const G = E.create(16, 'calm', rng, { startFood: 500 });
  E.place(G, 2, 1, 'hireling'); assert.ok(E.tapUnit(G, 2, 1).ok);
  E.dev.spawn(G, 'lion', 2, 2.5);
  let fled = 0; run(G, 6, 0.05, evs => { fled += evs.filter(e => e.t === 'fx' && e.kind === 'flee').length; });
  assert.strictEqual(fled, 0);
});

test('倒了的雇工（hp 0、還沒被收走）點一下不能升級、不扣糧', () => {
  const G = E.create(16, 'calm', rng, { startFood: 500 });
  E.place(G, 2, 1, 'hireling'); unitAt(G, 2, 1).hp = 0;
  const f = G.food, r = E.tapUnit(G, 2, 1);
  assert.strictEqual(r.ok, false); assert.strictEqual(G.food, f); assert.strictEqual(unitAt(G, 2, 1).upgraded, undefined);
});

test('講定工價：鏟掉退糧連工價一起算（(25+25)×0.5）', () => {
  const G = E.create(16, 'calm', rng, { startFood: 500 });
  E.place(G, 2, 1, 'hireling'); E.tapUnit(G, 2, 1);
  const f = G.food; assert.ok(E.sell(G, 2, 1).ok);
  assert.strictEqual(G.food - f, Math.round(50 * D.SELL_RATE));
});

test('壇上的火：升級前只點自己這排的石子，升級後上下排穿過那一欄的也點燃', () => {
  const mk = paid => {
    const G = E.create(17, 'calm', rng, { startFood: 900 });
    assert.ok(E.place(G, 2, 2, 'brazier').ok);
    if (paid) { const r = E.tapUnit(G, 2, 2); assert.strictEqual(r.ok, true, r.msg); }
    assert.ok(E.place(G, 1, 0, 'slinger').ok); // 上一排的射手，石子會穿過火盆那一欄
    wolf(G, 1, 6);
    return G;
  };
  const A = mk(false), B = mk(true);
  let igA = 0, igB = 0;
  run(A, 8, 0.05, evs => { igA += evs.filter(e => e.t === 'fx' && e.kind === 'ignite').length; });
  run(B, 8, 0.05, evs => { igB += evs.filter(e => e.t === 'fx' && e.kind === 'ignite').length; });
  assert.strictEqual(igA, 0, '升級前隔壁排的石子不會著火');
  assert.ok(igB >= 1, '升級後隔壁排的石子穿過火盆那欄就著火');
  assert.ok(!B.enemies.length || B.enemies.some(e => e.st.burn !== undefined || e.hp < e.maxHp), '狼有被燒到（燒死就是空陣列）');
});

test('壇上的火：火盆早於學會的夜點了不給升，訊息講第 9 夜', () => {
  const G = E.create(5, 'calm', rng, { startFood: 500 }); // 第 7 夜提哥亞：火盆剛開
  assert.ok(E.place(G, 2, 2, 'brazier').ok);
  const r = E.tapUnit(G, 2, 2); assert.strictEqual(r.ok, false); assert.match(r.msg, /第 9 夜/);
});

test('燈臺：升級前照三排、升級後照五排（rowLit）', () => {
  const G = E.create(12, 'calm', rng, { startFood: 500 }); // 第 16 夜寬闊之地（無月）
  assert.ok(E.place(G, 2, 2, 'lamp').ok);
  assert.deepStrictEqual([0, 1, 2, 3, 4].map(r => E.rowLit(G, r)), [false, true, true, true, false]);
  const r = E.tapUnit(G, 2, 2); assert.strictEqual(r.ok, true, r.msg);
  assert.deepStrictEqual([0, 1, 2, 3, 4].map(r => E.rowLit(G, r)), [true, true, true, true, true]);
  const G2 = E.create(12, 'calm', rng, { startFood: 500 });
  assert.ok(E.place(G2, 0, 2, 'lamp').ok); E.tapUnit(G2, 0, 2);
  assert.deepStrictEqual([0, 1, 2, 3, 4].map(r => E.rowLit(G2, r)), [true, true, true, false, false], '放邊排只照到第 3 排');
});

test('燈臺：第 12 夜（拉結的燈）油燈剛開，還不能升', () => {
  const G = E.create(9, 'calm', rng, { startFood: 500 });
  assert.ok(E.place(G, 2, 2, 'lamp').ok);
  const r = E.tapUnit(G, 2, 2); assert.strictEqual(r.ok, false); assert.match(r.msg, /第 16 夜/);
});

test('快照與還原：三種升級狀態都存得住', () => {
  const G = E.create(17, 'calm', rng, { startFood: 900 });
  E.place(G, 2, 1, 'hireling'); E.tapUnit(G, 2, 1);
  E.place(G, 2, 2, 'brazier'); E.tapUnit(G, 2, 2);
  G.wave = 1; // 檢查點只在第 1 波之後才算數
  const s = E.snapshot(G);
  const G2 = E.create(17, 'calm', rng, { startFood: 900 }); const ok = E.restore(G2, s); assert.ok(ok === undefined || ok === true || (ok && ok.ok !== false), JSON.stringify(ok));
  assert.strictEqual(unitAt(G2, 2, 1).upgraded, true); assert.strictEqual(unitAt(G2, 2, 1).maxHp, 60); assert.strictEqual(unitAt(G2, 2, 1).hp, 60, '還原後血量不能被壓回 40');
  assert.strictEqual(unitAt(G2, 2, 2).upgraded, true);
  assert.strictEqual(E.effOf(unitAt(G2, 2, 2), UNITS.brazier).lanes, 1);
});
