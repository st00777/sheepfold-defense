// 修飾詞（期 1，2026-10-30）：Engine.create 第四個參數。白名單、開局糧、看門數、波數、送卡／一筆糧開關、檢查點、模擬器：node --test sim/*.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const D = require(path.join(__dirname, '..', 'data.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));
const SIM = require(path.join(__dirname, 'simulate.js'));
const { UNITS, LEVELS } = D;
const rng = () => 0.5;
const quiet = fn => { const orig = console.error; const got = []; console.error = m => got.push(String(m)); try { return [fn(), got]; } finally { console.error = orig; } }; // 吞掉 create 印的修飾詞錯誤，順便拿來驗
const run = (G, sec, dt = 0.1) => { for (let t = 0; t < sec; t += dt) { E.step(G, dt); G.events.length = 0; } };

test('沒給修飾詞：跟以前一模一樣，快照也不多欄位', () => {
  const A = E.create(3, 'calm', rng), B = E.create(3, 'calm', rng, null), C = E.create(3, 'calm', rng, {});
  for (const G of [A, B, C]) { assert.strictEqual(G.mods, null); assert.deepStrictEqual(G.level, E.levelById(3)); }
  A.wave = 1; assert.ok(!('mods' in E.snapshot(A)));
});

test('units 白名單：只剩名單上的卡、可帶這一夜原本沒開的卡、fresh／must 跟著濾；坡上限定卡在沒坡的夜被丟掉', () => {
  const G = E.create(3, 'calm', rng, { units: ['shepherd', 'slinger', 'lobber', 'slinger'] });
  assert.deepStrictEqual(G.level.units, ['shepherd', 'slinger', 'lobber'], '去重、照給的順序');
  assert.deepStrictEqual(G.level.fresh, E.levelById(3).fresh.filter(k => G.level.units.includes(k)));
  assert.ok((G.level.must || []).every(k => G.level.units.includes(k)));
  assert.ok(E.place(G, 2, 1, 'lobber').ok, '第 3 夜本來沒有拋石手，白名單給了就能放');
  assert.ok(!E.place(G, 2, 2, 'wall').ok, '石牆不在名單上');
  assert.ok(E.validateLevels().length === 0, '原關卡表沒被改到');
  assert.deepStrictEqual(E.levelById(3).units, LEVELS.find(l => l.id === 3).units);
  const [H, errs] = quiet(() => E.create(3, 'calm', rng, { units: ['shepherd', 'cairn', 'slinger'] }));
  assert.deepStrictEqual(H.level.units, ['shepherd', 'slinger']);
  assert.ok(errs.some(m => m.includes('石堆') && m.includes('沒有坡')));
  const K = E.create(24, 'calm', rng, { units: ['shepherd', 'cairn', 'slinger'] });
  assert.ok(K.level.units.includes('cairn'), '有坡的夜石堆留著');
  assert.deepStrictEqual(E.checkMods(3, { units: ['xx'] }), ['units 裡有不認識的卡 xx，略過', 'units 沒有任何可用的卡，略過']);
});

test('startFood 寫多少就多少（一筆糧的夜不再乘難度 budgetMul）；gates 數字照表挑排、陣列照給、0 等於關掉', () => {
  assert.strictEqual(E.create(25, 'windy', rng).food, 1600 * 1.25, '原本：第 25 夜起風乘 1.25');
  assert.strictEqual(E.create(25, 'windy', rng, { startFood: 1000 }).food, 1000);
  assert.strictEqual(E.create(3, 'calm', rng, { startFood: 0 }).food, 0);
  const g2 = E.create(3, 'calm', rng, { gates: 2 });
  assert.deepStrictEqual(g2.gateRows, [1, 3]); assert.deepStrictEqual(g2.gates, [1, 3]); assert.strictEqual(E.starSlots(g2.level), 3);
  assert.deepStrictEqual(E.create(3, 'storm', rng, { gates: 5 }).gateRows, [0, 1, 2, 3, 4], '修飾詞蓋過難度表');
  assert.deepStrictEqual(E.create(3, 'calm', rng, { gates: [4, 0] }).gateRows, [0, 4]);
  const g0 = E.create(3, 'calm', rng, { gates: 0 });
  assert.deepStrictEqual(g0.gateRows, []); assert.strictEqual(g0.level.gates, false); assert.strictEqual(E.starSlots(g0.level), 2);
  assert.deepStrictEqual(E.create(3, 'calm', rng, { gates: false }).gateRows, []);
  assert.ok(E.checkMods(3, { gates: 6 })[0].startsWith('gates'));
  assert.ok(E.checkMods(3, { gates: [1, 1] })[0].startsWith('gates'));
});

test('waves 只打前幾波：波表、總隻數、打完就天亮', () => {
  const L = E.levelById(3), G = E.create(3, 'calm', rng, { waves: 2 });
  assert.strictEqual(G.waves.length, 2);
  assert.strictEqual(G.total, G.waves.reduce((n, w) => n + w.list.reduce((m, [, k]) => m + k, 0), 0));
  assert.deepStrictEqual(G.waves[0].list, L.waves[0].list);
  G.started = true; G.phase = 'rest'; G.wave = 2; G.timer = 0.05; E.step(G, 0.1);
  assert.ok(G.over && G.result.win, '第 2 波清完休息結束就天亮');
  assert.ok(E.checkMods(3, { waves: L.waves.length + 1 })[0].includes(`1 到 ${L.waves.length}`));
  assert.deepStrictEqual(E.checkMods(3, { waves: L.waves.length }), []);
});

test('conveyor true：一般夜變送卡夜（沒有糧、牧人拿掉、開局三張、權重均等、點名的卡只送白名單上的）；false：第 11 夜變回有糧', () => {
  const G = E.create(3, 'calm', rng, { conveyor: true, units: ['shepherd', 'slinger', 'wall', 'dog'] });
  assert.strictEqual(G.food, 0); assert.ok(!G.level.units.includes('shepherd')); assert.strictEqual(G.hand.length, 3);
  assert.deepStrictEqual(Object.keys(G.level.conveyor.weights).sort(), ['dog', 'slinger', 'wall']);
  assert.strictEqual(G.level.conveyor.every, 7); assert.strictEqual(G.level.conveyor.max, 6);
  assert.ok(!E.place(G, 2, 1, 'wall').ok || G.hand.includes('wall'), '手上沒有就放不下');
  const C = E.create(3, 'calm', rng, { conveyor: { every: 3, max: 4, start: ['slinger', 'slinger'], weights: { wall: 1 } } });
  assert.deepStrictEqual(C.hand, ['slinger', 'slinger']); assert.strictEqual(C.level.conveyor.every, 3);
  assert.ok(E.place(C, 2, 1, 'slinger').ok); run(C, 3.2); assert.ok(C.hand.includes('wall'), '3 秒後抽到唯一有權重的牆');
  // 第 11 夜第 2 波點名送牧人杖；白名單沒有杖就不送
  const N = E.create(11, 'calm', rng, { units: ['slinger', 'wall'] });
  N.started = true; N.phase = 'rest'; N.wave = 1; N.timer = 0.01; E.step(N, 0.1);
  assert.strictEqual(N.wave, 2); assert.ok(!N.hand.includes('staff'));
  const N0 = E.create(11, 'calm', rng); N0.started = true; N0.phase = 'rest'; N0.wave = 1; N0.timer = 0.01; E.step(N0, 0.1);
  assert.ok(N0.hand.includes('staff'), '沒白名單照舊送');
  const F = E.create(11, 'calm', rng, { conveyor: false, units: ['shepherd', 'slinger', 'wall'] });
  assert.strictEqual(F.food, D.START_FOOD); assert.ok(!F.level.conveyor); assert.deepStrictEqual(F.hand, []);
  assert.ok(E.place(F, 2, 0, 'shepherd').ok, '有糧就能花糧放');
  const before = F.food; run(F, 5.2); assert.ok(F.food > before, '糧會滴');
  assert.deepStrictEqual(E.checkMods(11, { startFood: 100, oneBudget: true }), ['送卡模式沒有糧，oneBudget 沒作用', '送卡模式沒有糧，startFood 沒作用']);
  assert.ok(E.checkMods(3, { conveyor: { every: 0 } })[0].startsWith('conveyor'));
});

test('oneBudget true：糧不滴、沒有牧人；false：第 25 夜糧又會滴；沒給 startFood 會提醒', () => {
  const G = E.create(3, 'calm', rng, { oneBudget: true, startFood: 500 });
  assert.ok(G.level.noTrickle && G.level.noShepherd && !G.level.units.includes('shepherd') && G.taughtElder);
  assert.ok(E.place(G, 2, 1, 'slinger').ok); const f = G.food; run(G, 10.5); assert.strictEqual(G.food, f, '糧不會自己來');
  const F = E.create(25, 'calm', rng, { oneBudget: false });
  assert.ok(!F.level.noTrickle); assert.ok(E.place(F, 2, 1, 'slinger').ok); const f2 = F.food; run(F, 5.2); assert.ok(F.food > f2);
  assert.deepStrictEqual(E.checkMods(3, { oneBudget: true }), [`一筆糧的夜糧不會再來，建議給 startFood（現在只有 ${D.START_FOOD}）`]);
  assert.deepStrictEqual(E.checkMods(3, { oneBudget: true, startFood: 800 }), []);
  assert.deepStrictEqual(E.checkMods(25, { oneBudget: true }), [], '本來就是一筆糧的夜不囉嗦');
});

test('檢查點：快照帶修飾詞，同一組才能接；沒修飾詞、另一組、被改過的都不收', () => {
  const mods = { waves: 3, gates: 2, units: ['shepherd', 'slinger', 'wall'], startFood: 400 };
  const G = E.create(3, 'calm', rng, mods); assert.ok(E.place(G, 2, 1, 'slinger').ok); G.wave = 1; run(G, 1);
  const snap = JSON.parse(JSON.stringify(E.snapshot(G)));
  assert.deepStrictEqual(snap.mods, { units: ['shepherd', 'slinger', 'wall'], startFood: 400, gates: [1, 3], waves: 3 }, '存的是整理後的那份，鍵順序固定');
  assert.ok(E.checkSnapshot(snap, 3));
  const same = E.create(3, 'calm', rng, { startFood: 400, gates: [3, 1], waves: 3, units: ['shepherd', 'slinger', 'wall'] }); // 同一組、寫法不同
  assert.ok(E.restore(same, snap)); assert.strictEqual(same.wave, 1); assert.ok(same.units['2,1']);
  assert.ok(!E.restore(E.create(3, 'calm', rng), snap), '沒修飾詞的局不接');
  assert.ok(!E.restore(E.create(3, 'calm', rng, { ...mods, startFood: 401 }), snap), '另一組不接');
  const plain = E.create(3, 'calm', rng); assert.ok(E.place(plain, 2, 1, 'slinger').ok); plain.wave = 1;
  const ps = JSON.parse(JSON.stringify(E.snapshot(plain)));
  assert.ok(!E.restore(E.create(3, 'calm', rng, mods), ps), '沒修飾詞的檢查點不能拿來接有修飾詞的局');
  assert.ok(E.restore(E.create(3, 'calm', rng), ps), '沒修飾詞照舊能接');
  const bad = JSON.parse(JSON.stringify(snap)); bad.mods.startFood = -5; assert.ok(!E.checkSnapshot(bad, 3), '被改壞的修飾詞不收');
  const bad2 = JSON.parse(JSON.stringify(snap)); bad2.mods.foo = 1; assert.ok(!E.checkSnapshot(bad2, 3), '多了不認識的欄位不收');
  const bad3 = JSON.parse(JSON.stringify(snap)); bad3.wave = 3; assert.ok(!E.checkSnapshot(bad3, 3), '波數超過修飾詞的波數不收');
});

test('修飾詞不認識的欄位、壞值：印錯誤後略過，其餘照套', () => {
  const [G, errs] = quiet(() => E.create(3, 'calm', rng, { startFood: 'abc', waves: 2, foo: 1 }));
  assert.strictEqual(G.waves.length, 2); assert.strictEqual(G.food, D.START_FOOD);
  assert.strictEqual(errs.length, 2); assert.ok(errs.every(m => m.startsWith('第 3 夜的修飾詞：')));
  assert.deepStrictEqual(E.checkMods(3, 'nope'), ['修飾詞要是物件']);
  assert.deepStrictEqual(E.checkMods(3, undefined), []);
  assert.strictEqual(E.normalizeMods(E.levelById(3), { startFood: 'abc' }).mods, null, '全壞就等於沒有修飾詞');
});

test('code-review 修正：start 0 張、權重表與白名單沒交集改均等、只剩牧人的白名單擋掉、原型鏈卡名不收、oneBudget:false 連大額開局糧一起關、權重鍵順序不影響同組', () => {
  assert.strictEqual(E.create(3, 'calm', rng, { conveyor: { start: 0 } }).hand.length, 1, 'start: 0 不再被當 3 張；手上空著開不了局，所以補抽一張');
  assert.strictEqual(E.create(3, 'calm', rng, { conveyor: { start: 2 } }).hand.length, 2);
  const [W, errs] = quiet(() => E.create(11, 'calm', rng, { units: ['lobber', 'slinger'] }));
  assert.deepStrictEqual(W.level.conveyor.weights, { slinger: 22 }, '第 11 夜自己的權重表只留白名單上的');
  const [W2] = quiet(() => E.create(11, 'calm', rng, { units: ['lobber'] }));
  assert.deepStrictEqual(W2.level.conveyor.weights, { lobber: 1 }, '沒交集就均等'); assert.ok(E.checkMods(11, { units: ['lobber'] }).some(m => m.includes('沒有交集')));
  W2.started = true; run(W2, 7.5); assert.ok(W2.hand.includes('lobber'), '抽得到卡');
  assert.ok(E.checkMods(5, { conveyor: true, units: ['shepherd'] }).some(m => m.includes('拿掉牧人後沒有卡')));
  const [S] = quiet(() => E.create(5, 'calm', rng, { conveyor: true, units: ['shepherd'] }));
  assert.ok(S.level.units.length > 1 && !S.mods.units, 'units 略過、其餘照套');
  assert.ok(E.checkMods(3, { oneBudget: true, startFood: 500, units: ['shepherd'] }).some(m => m.includes('拿掉牧人後沒有卡')));
  assert.deepStrictEqual(E.checkMods(3, { units: ['constructor', 'slinger'] }), ['units 裡有不認識的卡 constructor，略過']);
  assert.ok(E.checkMods(3, { conveyor: { start: ['toString'] } })[0].startsWith('conveyor'));
  assert.ok(E.checkMods(3, { conveyor: { weights: { hasOwnProperty: 1 } } })[0].startsWith('conveyor'));
  const F = E.create(25, 'calm', rng, { oneBudget: false });
  assert.strictEqual(F.food, D.START_FOOD, '一筆糧關掉，1600 也跟著回預設'); assert.ok(E.checkMods(25, { oneBudget: false }).some(m => m.includes('沒有牧人')));
  assert.strictEqual(E.create(25, 'calm', rng, { oneBudget: false, startFood: 700 }).food, 700);
  assert.deepStrictEqual(E.checkMods(25, { oneBudget: false, units: ['shepherd', 'slinger', 'wall'] }), []);
  const a = E.normalizeMods(E.levelById(3), { conveyor: { weights: { wall: 1, dog: 2 } } }).mods, b = E.normalizeMods(E.levelById(3), { conveyor: { weights: { dog: 2, wall: 1 } } }).mods;
  assert.strictEqual(JSON.stringify(a), JSON.stringify(b), '權重鍵照字母排');
  // 有修飾詞的局：檢查點裡白名單外的卡不還原；故事模式照舊
  const M = E.create(3, 'calm', rng, { units: ['shepherd', 'slinger'] }); assert.ok(E.place(M, 2, 1, 'slinger').ok); M.wave = 1;
  const snap = JSON.parse(JSON.stringify(E.snapshot(M))); snap.units.push({ type: 'wall', r: 2, c: 4, hp: 300 });
  const M2 = E.create(3, 'calm', rng, { units: ['shepherd', 'slinger'] }); assert.ok(E.restore(M2, snap)); assert.ok(!M2.units['2,4'] && M2.units['2,1']);
});

test('模擬器：play 帶修飾詞能打完一局，白名單真的只用那幾張；compare 第四個參數就是修飾詞', () => {
  assert.strictEqual(SIM.compare.length, 3, 'compare(levelId, diff, n, mods=ENV)：沒有 skill 佔位');
  const logs = []; const orig = console.log; console.log = m => logs.push(String(m));
  try { SIM.compare(1, 'calm', 1, { waves: 1 }); } finally { console.log = orig; }
  assert.ok(logs[0].includes('修飾詞') && logs[0].includes('"waves":1'));
  const r = SIM.play(1, 'calm', 1000, 'good', { waves: 1, units: ['shepherd', 'slinger', 'wall'] });
  assert.ok(r.wave <= 1 && (r.win || r.reason !== 'timeout'));
  const r2 = SIM.play(3, 'calm', 1001, 'good', { oneBudget: true, startFood: 900, gates: 0 });
  assert.ok(typeof r2.win === 'boolean' && r2.wave >= 1 && r2.reason !== 'timeout');
  assert.strictEqual(E.checkMods(3, { oneBudget: true, startFood: 900, gates: 0 }).length, 0);
  const allow = ['shepherd', 'slinger', 'wall'];
  const G = E.create(5, 'calm', SIM.mulberry32(7), { units: allow });
  let acc = 0; while (!G.over && G.time < 300) { E.step(G, 1 / 30); G.events.length = 0; acc += 1 / 30; if (acc >= 0.5) { acc = 0; SIM.decide(G, 'good'); } }
  const used = new Set(Object.values(G.units).map(u => u.type));
  assert.ok(used.size > 0 && [...used].every(k => allow.includes(k)), '場上只有白名單的卡：' + [...used].join(' '));
});
