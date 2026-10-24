// 星級：守過／零損失（只看失羊）／五位看門的都在；unitsLost 仍統計敵人造成的損失但不影響星；快照帶 unitsLost：node --test sim/*.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const D = require(path.join(__dirname, '..', 'data.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));
const { ROWS } = D;

function setup(levelId = 1, rng = () => 0.5) {
  const G = E.create(levelId, 'calm', rng); G.food = 9999; G.started = true; G.phase = 'wave'; G.wave = 1; G.holdWaves = true;
  G.level = { ...G.level, units: Object.keys(D.UNITS) }; // 測試不受點兵限制
  return G;
}
function run(G, sec) { for (let i = 0; i < Math.round(sec * 30); i++) { E.step(G, 1 / 30); G.events.length = 0; } }
function unitAt(G, r, c) { return G.units[r + ',' + c] || Object.values(G.units).find(u => u.r === r && u.c === c); }
function dawn(G) { G.holdWaves = false; G.enemies = []; G.queue = []; G.wave = G.waves.length; G.phase = 'rest'; G.timer = 0.01; run(G, 0.2); assert.ok(G.over && G.result.win, '應該天亮'); return G.result.stars; }

test('零損失：牆被咬垮算 1；鏟子拆掉不算；荊棘自己磨損不算；雇工逃走算', () => {
  const G = setup(1);
  assert.strictEqual(G.unitsLost, 0);
  assert.ok(E.place(G, 2, 1, 'wall').ok); unitAt(G, 2, 1).hp = 1;
  E.dev.spawn(G, 'wolf', 2, 1.6); run(G, 2);
  assert.ok(!unitAt(G, 2, 1), '牆該被咬垮'); assert.strictEqual(G.unitsLost, 1, '咬垮算損失');
  assert.ok(E.place(G, 0, 1, 'wall').ok); assert.ok(E.sell(G, 0, 1).ok); assert.strictEqual(G.unitsLost, 1, '鏟子不算');
  assert.ok(E.place(G, 4, 2, 'thorns').ok); unitAt(G, 4, 2).hp = 0.05;
  E.dev.spawn(G, 'wolf', 4, 2.2); run(G, 1);
  assert.ok(!unitAt(G, 4, 2), '荊棘該磨光'); assert.strictEqual(G.unitsLost, 1, '荊棘磨損不算');
  assert.ok(E.place(G, 1, 3, 'hireling').ok); E.dev.spawn(G, 'wolf', 1, 3.5); run(G, 0.5);
  assert.ok(!unitAt(G, 1, 3), '雇工該逃走'); assert.strictEqual(G.unitsLost, 2, '雇工逃走算損失');
});

test('天亮三顆星：乾淨守過全拿；牆被咬垮仍給零損失（2026-10-24 James 定）；失羊才掉；用過看門的掉第三顆', () => {
  const G = setup(1); assert.ok(E.place(G, 2, 1, 'wall').ok);
  assert.deepStrictEqual(dawn(G), { win: true, noLoss: true, gates: true });
  const G2 = setup(1); assert.ok(E.place(G2, 2, 1, 'wall').ok); unitAt(G2, 2, 1).hp = 1; E.dev.spawn(G2, 'wolf', 2, 1.6); run(G2, 2);
  assert.strictEqual(G2.unitsLost, 1, '統計仍計'); assert.deepStrictEqual(dawn(G2), { win: true, noLoss: true, gates: true });
  const G3 = setup(1); E.dev.spawn(G3, 'wolf', 3, -0.55); run(G3, 0.5);
  assert.strictEqual(G3.gates.length, ROWS - 1, '門用掉一個');
  assert.deepStrictEqual(dawn(G3), { win: true, noLoss: true, gates: false });
  const L = D.LEVELS.find(x => x.sheep); const G4 = setup(L.id); G4.sheepLost = 1;
  assert.deepStrictEqual(dawn(G4), { win: true, noLoss: false, gates: true });
});

test('快照帶 unitsLost；舊存檔沒這欄續玩是 null、零損失照給；壞值擋下', () => {
  const G = setup(1); assert.ok(E.place(G, 2, 1, 'wall').ok); unitAt(G, 2, 1).hp = 1; E.dev.spawn(G, 'wolf', 2, 1.6); run(G, 2);
  const snap = E.snapshot(G); assert.strictEqual(snap.unitsLost, 1);
  assert.ok(E.checkSnapshot(snap, 1)); assert.ok(!E.checkSnapshot({ ...snap, unitsLost: 'x' }, 1)); assert.ok(!E.checkSnapshot({ ...snap, unitsLost: -1 }, 1));
  const G2 = E.create(1, 'calm', () => 0.5); assert.ok(E.restore(G2, snap)); assert.strictEqual(G2.unitsLost, 1);
  const legacy = { ...snap }; delete legacy.unitsLost; delete legacy.gates;
  const G3 = E.create(1, 'calm', () => 0.5); assert.ok(E.restore(G3, legacy)); assert.strictEqual(G3.unitsLost, null);
  G3.level = { ...G3.level, units: Object.keys(D.UNITS) }; G3.holdWaves = true;
  assert.deepStrictEqual(dawn(G3), { win: true, noLoss: true, gates: true });
  assert.strictEqual(E.starSlots(D.LEVELS[0]), 3); assert.strictEqual(E.starSlots({ gates: false }), 2);
});
