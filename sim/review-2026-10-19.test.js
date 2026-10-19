// 2026-10-19 小居多視角審查後修的三條：零血敵人不越線、舊檔續玩再存不被拒、狗休息狀態跟著存。node --test sim/*.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const D = require(path.join(__dirname, '..', 'data.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));

function setup(levelId = 1, rng = () => 0.5) {
  const G = E.create(levelId, 'calm', rng); G.food = 9999; G.started = true; G.phase = 'wave'; G.wave = 1; G.holdWaves = true;
  G.level = { ...G.level, units: Object.keys(D.UNITS) };
  return G;
}
function run(G, sec) { for (let i = 0; i < Math.round(sec * 30); i++) { E.step(G, 1 / 30); G.events.length = 0; } }
const unitAt = (G, r, c) => G.units[r + ',' + c];

test('同一步被打到零血的狼不再往前走，門口不會被零血的狼闖過', () => {
  const G = setup(1);
  E.dev.spawn(G, 'wolf', 2, -0.59); // 離門口只剩 0.01 格
  const w = G.enemies[0]; w.hp = 0; // 這一步剛被打死
  E.step(G, 0.05);
  assert.ok(!G.over, '不能輸');
  assert.strictEqual(G.gates.length, D.ROWS, '看門的不該被用掉');
  assert.strictEqual(G.enemies.length, 0, '屍體該被清掉');
});

test('零血的狼這一步不再咬牆', () => {
  const G = setup(1);
  assert.ok(E.place(G, 2, 3, 'wall').ok); const hp0 = unitAt(G, 2, 3).hp;
  E.dev.spawn(G, 'wolf', 2, 3.5); G.enemies[0].hp = 0;
  E.step(G, 0.05);
  assert.strictEqual(unitAt(G, 2, 3).hp, hp0, '牆不該掉血');
});

test('舊存檔（沒 unitsLost）續玩後再存，新的檢查點自己驗得過', () => {
  const G = setup(2); G.wave = 2;
  const legacy = E.snapshot(G); delete legacy.unitsLost;
  const G2 = E.create(2, 'calm', () => 0.5);
  assert.ok(E.restore(G2, legacy)); assert.strictEqual(G2.unitsLost, null);
  const again = JSON.parse(JSON.stringify(E.snapshot(G2)));
  assert.ok(!('unitsLost' in again), '不知道就不寫');
  assert.ok(E.checkSnapshot(again, 2), '續玩後存的檢查點不能被自己擋下');
  assert.ok(E.checkSnapshot({ ...again, unitsLost: null }, 2), '手上還有寫 null 的舊檔也放行');
  const G3 = E.create(2, 'calm', () => 0.5); assert.ok(E.restore(G3, again)); assert.strictEqual(G3.unitsLost, null);
});

test('狗在窩裡休息時存檔，續玩接著休息，不會帶著低血出動', () => {
  const G = setup(2); G.wave = 2;
  assert.ok(E.place(G, 1, 2, 'dog').ok);
  const dog = unitAt(G, 1, 2); dog.hp = 0; E.step(G, 1 / 30); // 咬倒→回窩休息
  assert.ok(dog.resting, '狗該在休息'); dog.restT = 4.2;
  const snap = JSON.parse(JSON.stringify(E.snapshot(G)));
  const s = snap.units.find(u => u.type === 'dog'); assert.strictEqual(s.rest, 4.2);
  assert.ok(E.checkSnapshot(snap, 2)); assert.ok(!E.checkSnapshot({ ...snap, units: [{ ...s, rest: -1 }] }, 2), '負的休息秒數擋下');
  const G2 = E.create(2, 'calm', () => 0.5); assert.ok(E.restore(G2, snap));
  const d2 = unitAt(G2, 1, 2); assert.ok(d2.resting, '續玩後還在休息'); assert.ok(Math.abs(d2.restT - 4.2) < 1e-9);
  G2.phase = 'wave'; G2.holdWaves = true; G2.started = true; E.dev.spawn(G2, 'wolf', 1, 5); run(G2, 1);
  assert.ok(d2.resting && !d2.holding, '休息中不出動'); run(G2, 4);
  assert.ok(!d2.resting && d2.hp === d2.maxHp, '休息完回滿血出動');
  const plain = { ...snap, units: snap.units.map(u => { const { rest, ...o } = u; return o; }) };
  const G3 = E.create(2, 'calm', () => 0.5); assert.ok(E.restore(G3, plain)); assert.ok(!unitAt(G3, 1, 2).resting, '舊檔沒 rest 欄＝沒在休息');
});

// 第二輪（小居 10/19 複查）：火與毒的死亡時序、零血敵人吃石子、計時器跟著存
test('被荊棘毒死、火燒死的狼，同一步不再往前走', () => {
  for (const st of ['poison', 'burn']) {
    const G = setup(1);
    E.dev.spawn(G, 'wolf', 2, -0.59); const w = G.enemies[0]; w.hp = 0.001; w.st[st] = 2; // 這一步的毒／火就會把牠弄死
    E.step(G, 0.05);
    assert.ok(!G.over, st + '：不能輸'); assert.strictEqual(G.gates.length, D.ROWS, st + '：看門的不該被用掉'); assert.strictEqual(G.enemies.length, 0, st + '：屍體該清掉');
  }
});

test('被燒死的領頭狼同一步不嚎叫；零血的狼不吃石子、不被狗咬', () => {
  const G = setup(1);
  E.dev.spawn(G, 'alpha', 2, 3); const a = G.enemies[0]; a.hp = 0.001; a.st.burn = 1; a.abilityT = 0.01;
  E.dev.spawn(G, 'wolf', 2, 3.5); const w = G.enemies[1];
  E.step(G, 0.05);
  assert.ok(!w.st.howl, '死狼不該嚎叫鼓舞同伴');
  const G2 = setup(1);
  E.dev.spawn(G2, 'wolf', 2, 3); G2.enemies[0].hp = 0; E.dev.spawn(G2, 'wolf', 2, 3.15); const live = G2.enemies[1]; // 屍體在前、活狼緊貼在後，石子一步內兩隻都在命中範圍
  G2.shots.push({ kind: 'stone', r: 2, x: 3.3, dmg: 10, hit: new Set(), dead: false });
  E.step(G2, 1 / 30);
  assert.ok(live.hp < live.maxHp, '石子該穿過屍體打到後面活著的狼');
  const G3 = setup(1); assert.ok(E.place(G3, 2, 1, 'dog').ok); E.dev.spawn(G3, 'wolf', 2, 1.6); G3.enemies[0].hp = 0; E.step(G3, 1 / 30);
  assert.ok(!unitAt(G3, 2, 1).holding, '狗不咬屍體');
});

test('吹角手、牧人的計時器跟著存檔，續玩不重設；舊檔沒這欄照剛放下的算', () => {
  const G = setup(2); G.wave = 2;
  assert.ok(E.place(G, 2, 1, 'horn').ok); assert.ok(E.place(G, 1, 1, 'shepherd').ok);
  unitAt(G, 2, 1).timer = 14.3; unitAt(G, 1, 1).timer = 2.5;
  const snap = JSON.parse(JSON.stringify(E.snapshot(G)));
  assert.ok(E.checkSnapshot(snap, 2)); assert.ok(!E.checkSnapshot({ ...snap, units: [{ ...snap.units[0], t: -1 }] }, 2));
  const G2 = E.create(2, 'calm', () => 0.5); assert.ok(E.restore(G2, snap));
  assert.ok(Math.abs(unitAt(G2, 2, 1).timer - 14.3) < 1e-9, '吹角手冷卻接著算'); assert.ok(Math.abs(unitAt(G2, 1, 1).timer - 2.5) < 1e-9, '牧人產糧接著算');
  const big = { ...snap, units: snap.units.map(u => ({ ...u, t: 500 })) };
  const G3 = E.create(2, 'calm', () => 0.5); assert.ok(E.restore(G3, big)); assert.ok(unitAt(G3, 2, 1).timer <= D.UNITS.horn.every, '超過全長就壓回全長');
  const plain = { ...snap, units: snap.units.map(u => { const { t, ...o } = u; return o; }) };
  const G4 = E.create(2, 'calm', () => 0.5); assert.ok(E.restore(G4, plain)); assert.strictEqual(unitAt(G4, 2, 1).timer, 6, '舊檔＝剛放下的 6 秒');
});
