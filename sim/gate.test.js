// 看門的、迷羊腳印、關卡欄位（rest／startFood／maxUnits）與快照：node --test sim/*.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const D = require(path.join(__dirname, '..', 'data.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));
const { ROWS, COLS, LEVELS } = D;
const toasts = G => G.events.filter(e => e.t === 'toast').map(e => e.msg);

test('看門的：第一隻漏到門口的被整排趕出去、不算輸；同排第二次漏就輸', () => {
  const G = E.create(1, 'calm', () => 0.5); G.started = true; G.phase = 'wave'; G.wave = 1; G.holdWaves = true;
  assert.deepStrictEqual(G.gates, [0, 1, 2, 3, 4]);
  E.dev.spawn(G, 'wolf', 2, -0.55); E.dev.spawn(G, 'wolf', 2, 3); E.dev.spawn(G, 'wolf', 1, 3);
  for (let i = 0; i < 5; i++) E.step(G, 0.1); // 走過 -0.6 的門檻
  assert.ok(!G.over, '不應該輸');
  assert.deepStrictEqual(G.gates, [0, 1, 3, 4], '第 2 排的門用掉');
  assert.strictEqual(G.enemies.filter(e => e.r === 2).length, 0, '第 2 排清空');
  assert.strictEqual(G.enemies.filter(e => e.r === 1).length, 1, '別排不受影響');
  assert.ok(G.events.some(e => e.t === 'fx' && e.kind === 'gate' && e.r === 2));
  assert.ok(toasts(G).some(m => m.includes('看門的')));
  E.dev.spawn(G, 'wolf', 2, -0.55); for (let i = 0; i < 5; i++) E.step(G, 0.1);
  assert.ok(G.over && !G.result.win && G.result.reason === 'wolf', '同排再漏就輸');
});

test('看門的不擋飛的；叼著迷羊的被趕出去時羊放下', () => {
  const G = E.create(5, 'calm', () => 0.5); G.started = true; G.phase = 'wave'; G.wave = 1; G.holdWaves = true;
  E.dev.spawn(G, 'bird', 2, -0.55); for (let i = 0; i < 6; i++) E.step(G, 0.1);
  assert.ok(G.over && G.result.reason === 'bird', '鷙鳥照舊直接輸');
  const H = E.create(10, 'calm', () => 0.5); H.started = true; H.phase = 'wave'; H.wave = 1; H.holdWaves = true;
  E.dev.spawn(H, 'wolf', 3, 4); const w = H.enemies[0]; w.carrying = true; w.carryStray = true;
  E.dev.spawn(H, 'wolf', 3, -0.55); for (let i = 0; i < 5; i++) E.step(H, 0.1);
  assert.ok(!H.over); assert.strictEqual(H.strays.filter(s => !s.dead).length, 1, '羊落地繼續走');
});

test('關卡欄位：rest 覆寫休息秒數、startFood 開局糧、maxUnits 數量上限', () => {
  const G = E.create(19, 'calm', () => 0.5);
  assert.strictEqual(E.restOf(G), 3);
  G.started = true; G.phase = 'wave'; G.wave = 1; G.enemies = []; G.queue = []; G.spawnTimer = 99; E.step(G, 0.1);
  assert.strictEqual(G.phase, 'rest'); assert.strictEqual(G.timer, 3);
  assert.strictEqual(E.restOf(E.create(1, 'calm')), D.WAVE_REST);
  const H = E.create(20, 'calm', () => 0.5); H.started = true;
  assert.strictEqual(H.food, 100);
  H.food = 999;
  for (let r = 0; r < 3; r++) assert.ok(E.place(H, r, 0, 'shepherd').ok);
  const fourth = E.place(H, 3, 0, 'shepherd');
  assert.strictEqual(fourth.ok, false); assert.ok(fourth.msg.includes('最多 3'));
  assert.ok(E.place(H, 3, 0, 'slinger').ok, '別的單位不受上限影響');
  assert.strictEqual(E.create(1, 'calm').food, D.START_FOOD);
});

test('迷羊進場前 3 秒先印 🐑 腳印，之後從那排進來', () => {
  const G = E.create(18, 'calm', () => 0.3); G.started = true; G.phase = 'rest'; G.timer = 99; G.wave = 1;
  G.strayQueue = [5]; G.waveT = 0;
  for (let i = 0; i < 10; i++) E.step(G, 0.1); // waveT 1.0，距進場 4 秒
  assert.strictEqual(G.strayNextRow, null, '還早，不印');
  assert.ok(!G.events.some(e => e.t === 'strayMark'));
  for (let i = 0; i < 12; i++) E.step(G, 0.1); // waveT 2.2，距進場 2.8 秒 → 印
  const mark = G.events.find(e => e.t === 'strayMark' && e.r !== null);
  assert.ok(mark, '有印腳印'); assert.strictEqual(G.strayNextRow, mark.r);
  assert.strictEqual(G.strays.length, 0, '羊還沒進來');
  for (let i = 0; i < 30; i++) E.step(G, 0.1); // waveT 5.2 → 進場
  const s = G.strays[0];
  assert.ok(s && s.r === mark.r, '羊從腳印那排進來');
  assert.strictEqual(G.strayNextRow, null);
  assert.ok(G.events.some(e => e.t === 'strayMark' && e.r === null), '腳印收掉');
});

test('快照帶著看門的、路上的迷羊、還沒出來的迷羊', () => {
  const G = E.create(18, 'calm', () => 0.5); G.started = true; G.phase = 'rest'; G.wave = 2; G.timer = 5;
  G.gates = [0, 1, 3]; E.dev.stray(G, 2, 4.2); G.strayQueue = [7, 19]; G.waveT = 2;
  const snap = JSON.parse(JSON.stringify(E.snapshot(G)));
  assert.deepStrictEqual(snap.gates, [0, 1, 3]);
  assert.deepStrictEqual(snap.strays, [{ r: 2, x: 4.2 }]);
  assert.deepStrictEqual(snap.strayQueue, [5, 17]);
  assert.ok(E.checkSnapshot(snap, 18));
  const H = E.create(18, 'calm', () => 0.5);
  assert.ok(E.restore(H, snap));
  assert.deepStrictEqual(H.gates, [0, 1, 3]);
  assert.strictEqual(H.strays.length, 1); assert.strictEqual(H.strays[0].r, 2);
  assert.deepStrictEqual(H.strayQueue, [5, 17]); assert.strictEqual(H.waveT, 0);
  assert.strictEqual(H.timer, E.restOf(H) + 4);
  // 舊存檔沒這三欄：門五位都在、沒有迷羊
  const old = { ...snap }; delete old.gates; delete old.strays; delete old.strayQueue;
  const K = E.create(18, 'calm'); assert.ok(E.restore(K, old)); assert.deepStrictEqual(K.gates, [0, 1, 2, 3, 4]); assert.strictEqual(K.strays.length, 0);
  // 壞欄位要擋
  assert.ok(!E.checkSnapshot({ ...snap, gates: [9] }, 18));
  assert.ok(!E.checkSnapshot({ ...snap, strays: [{ r: 2, x: 'x' }] }, 18));
  assert.ok(!E.checkSnapshot({ ...snap, strayQueue: [-1] }, 18));
});

test('第二章十夜在正確位置', () => {
  assert.deepStrictEqual(LEVELS.slice(10, 20).map(l => l.id), [8, 9, 10, 18, 11, 12, 19, 13, 20, 14]);
  assert.deepStrictEqual(LEVELS.slice(20).map(l => l.id), [21, 22, 23, 24, 25, 26, 27, 28, 29, 30]); // 第三章接在後面
  assert.strictEqual(LEVELS.length, 30);
  assert.strictEqual(E.posOf(14), 20); assert.strictEqual(D.UNITS.horn.upgrade.from, 20);
  assert.strictEqual(E.posOf(28), 28); assert.strictEqual(D.UNITS.catapult.upgrade.from, 28);
});

// 2026-10-20：看門的依難度——寧靜五位、起風中間三排、暴風第 2、4 排；星級「看門的都在」以這一局開局的人數為準
test('看門的依難度：人數、星級、存檔都跟著難度', () => {
  const C = E.create(1, 'calm'), W = E.create(1, 'windy'), S = E.create(1, 'storm');
  assert.deepStrictEqual(C.gates, [0, 1, 2, 3, 4]); assert.deepStrictEqual(W.gates, [1, 2, 3]); assert.deepStrictEqual(S.gates, [1, 3]);
  assert.deepStrictEqual(E.gateRows(E.levelById(1), 'storm'), [1, 3]);
  // 暴風夜第 0 排沒有看門的：狼走到門口直接輸
  E.dev.spawn(S, 'wolf', 0, 0.2); S.started = true; S.phase = 'wave'; S.queue = []; S.wave = 1;
  for (let i = 0; i < 200 && !S.over; i++) E.step(S, 0.05);
  assert.ok(S.over && S.result.reason === 'wolf');
  // 暴風夜兩位都在就有「看門的」那顆星；用掉一位就沒有
  const S2 = E.create(1, 'storm'); E.dev.spawn(S2, 'wolf', 3, 0.2); S2.started = true; S2.phase = 'wave'; S2.queue = []; S2.wave = 1;
  for (let i = 0; i < 200 && S2.enemies.length; i++) E.step(S2, 0.05);
  assert.deepStrictEqual(S2.gates, [1]);
  const snap = E.snapshot(S2); snap.wave = 1;
  const S3 = E.create(1, 'storm'); assert.ok(E.restore(S3, snap)); assert.deepStrictEqual(S3.gates, [1]);
  // 存檔裡寫了這個難度沒有的排（例如從寧靜夜的舊檔改難度）：丟掉，不會多出一位
  const S4 = E.create(1, 'storm'); assert.ok(E.restore(S4, { ...snap, gates: [0, 1, 3] })); assert.deepStrictEqual(S4.gates, [1, 3]);
});

test('失守回報闖進來的是哪一種敵人（標題要寫牠的名字，夜鴞不再翻成鷙鳥）', () => {
  for (const [type, reason] of [['owl', 'bird'], ['bear', 'wolf'], ['wolf', 'wolf']]) {
    const G = E.create(5, 'calm', () => 0.5); G.started = true; G.phase = 'wave'; G.wave = 1; G.holdWaves = true; G.gates = [];
    E.dev.spawn(G, type, 2, -0.55); for (let i = 0; i < 8; i++) E.step(G, 0.1);
    assert.ok(G.over && G.result.reason === reason && G.result.by === type, type + ' 要回報 reason=' + reason + '、by=' + type);
  }
});
