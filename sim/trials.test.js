// 守夜試煉（新期 2，2026-10-31）：data.js TRIALS 每夜兩題（守望 w／烈火 f）、兩個新修飾詞（waveOverride／maxSheepLost）、解鎖＝那一夜暴風夜星全拿、今日推薦、每題建得起局且修飾詞乾淨、檢查點走自己的格子。node --test sim/*.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const D = require(path.join(__dirname, '..', 'data.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));
const SIM = require(path.join(__dirname, 'simulate.js'));
const { TRIALS, TRIAL_KINDS, LEVELS, COLS } = D;
const rng = () => 0.5;
const quiet = fn => { const e = console.error, w = console.warn; const got = []; console.error = console.warn = m => got.push(String(m)); try { return [fn(), got]; } finally { console.error = e; console.warn = w; } };
const run = (G, sec, dt = 0.1) => { for (let t = 0; t < sec; t += dt) { E.step(G, dt); G.events.length = 0; } };
const full = id => ({ cleared: { [id]: { storm: true } }, stars: { [id]: { noLoss: true, gates: true } } }); // 那一夜暴風三星
const WO = [{ list: [['wolf', 6]], gap: 2, rows: [1, 2, 3] }, { list: [['wolf', 8], ['fast', 4]], gap: 1, rows: [0, 1, 2, 3, 4], hpMul: 1.8, ordered: true, say: '來了' }];

test('資料：第一、二章各十夜各兩題（守望 w<夜>、烈火 f<夜>），validateTrials 乾淨，題目文字齊全，每題的敵人與卡都是那一夜以前見過的', () => {
  assert.strictEqual(TRIALS.length, 40);
  assert.deepStrictEqual(E.validateTrials(), []);
  const kinds = {}; for (const t of TRIALS) kinds[t.kind] = (kinds[t.kind] || 0) + 1;
  assert.deepStrictEqual(kinds, { watch: 20, fire: 20 });
  const ch12 = LEVELS.filter(l => (l.chapter || 1) <= 2).map(l => l.id);
  assert.strictEqual(ch12.length, 20);
  for (const id of ch12) { assert.ok(E.trialById('w' + id), 'w' + id); assert.ok(E.trialById('f' + id), 'f' + id); }
  for (const t of TRIALS) {
    assert.ok(TRIAL_KINDS[t.kind] && E.trialById(t.id) === t && t.diff === 'storm', t.id);
    for (const f of ['title', 'text', 'win']) assert.ok(typeof t[f] === 'string' && t[f].length >= 3, `${t.id} 缺 ${f}`);
    assert.deepStrictEqual(E.checkMods(t.levelId, t.mods), [], t.id);
    const seen = E.enemiesSeenBy(t.levelId), base = E.levelById(t.levelId);
    for (const w of t.mods.waveOverride) for (const [k] of w.list) assert.ok(seen.has(k), `${t.id} 的 ${k} 那一夜還沒出現`);
    if (t.mods.units) for (const k of t.mods.units) assert.ok(base.units.includes(k) && k !== 'shepherd', `${t.id} 的卡 ${k}`);
  }
  for (const k in TRIAL_KINDS) for (const f of ['name', 'ico', 'short', 'desc', 'lose']) assert.ok(typeof TRIAL_KINDS[k][f] === 'string' && TRIAL_KINDS[k][f].length >= 1, k + '.' + f);
  assert.strictEqual(E.trialById('t1'), null, '舊六題下架');
});

test('validateTrials 會抓：id 不照規矩、沒關看門的、有羊沒寫 maxSheepLost、用到那一夜以後的敵人、守望波數不對、烈火不是一波或缺一筆糧', () => {
  const saved = D.TRIALS.slice(); D.TRIALS.length = 0;
  try {
    const ok = { gates: 0, waveOverride: [{ list: [['wolf', 4]], gap: 2, rows: [1] }, { list: [['wolf', 4]], gap: 2, rows: [1] }, { list: [['wolf', 4]], gap: 2, rows: [1] }] };
    D.TRIALS.push({ id: 'w1', kind: 'watch', levelId: 1, diff: 'storm', title: 'x', text: 'x', win: 'x', mods: ok });
    assert.deepStrictEqual(E.validateTrials(), []);
    D.TRIALS[0] = { id: 'w9', kind: 'watch', levelId: 1, diff: 'storm', title: 'x', text: 'x', win: 'x', mods: ok };
    assert.ok(E.validateTrials().some(m => m.includes('id 要是 w1')));
    D.TRIALS[0] = { id: 'w1', kind: 'watch', levelId: 1, diff: 'storm', title: 'x', text: 'x', win: 'x', mods: { waveOverride: ok.waveOverride } };
    assert.ok(E.validateTrials().some(m => m.includes('gates: 0')));
    D.TRIALS[0] = { id: 'w1', kind: 'watch', levelId: 1, diff: 'storm', title: 'x', text: 'x', win: 'x', mods: { gates: 0, waveOverride: [ok.waveOverride[0], ok.waveOverride[1], { list: [['boar', 1]], gap: 2, rows: [1] }] } };
    assert.ok(E.validateTrials().some(m => m.includes('boar') && m.includes('還沒出現')));
    D.TRIALS[0] = { id: 'w1', kind: 'watch', levelId: 1, diff: 'storm', title: 'x', text: 'x', win: 'x', mods: { gates: 0, waveOverride: ok.waveOverride.slice(0, 2) } };
    assert.ok(E.validateTrials().some(m => m.includes('波數要跟原夜一樣')));
    D.TRIALS[0] = { id: 'w3', kind: 'watch', levelId: 3, diff: 'storm', title: 'x', text: 'x', win: 'x', mods: { gates: 0, waveOverride: E.levelById(3).waves.map(() => ok.waveOverride[0]) } };
    assert.ok(E.validateTrials().some(m => m.includes('maxSheepLost: 0')));
    D.TRIALS[0] = { id: 'f1', kind: 'fire', levelId: 1, diff: 'storm', title: 'x', text: 'x', win: 'x', mods: { gates: 0, waveOverride: ok.waveOverride.slice(0, 2), oneBudget: true, startFood: 500, units: ['slinger'] } };
    const bad = E.validateTrials(); assert.ok(bad.some(m => m.includes('只能一波')), bad.join());
    D.TRIALS[0] = { id: 'f1', kind: 'fire', levelId: 1, diff: 'storm', title: 'x', text: 'x', win: 'x', mods: { gates: 0, waveOverride: ok.waveOverride.slice(0, 1) } };
    assert.ok(E.validateTrials().some(m => m.includes('三樣齊')));
  } finally { D.TRIALS.length = 0; D.TRIALS.push(...saved); }
});

test('修飾詞 waveOverride：換掉整張波表、數字照寫不乘難度倍率（diffScale 0）、rows 排序、say 可不給；壞的一波整個略過；跟 waves 一起給時 waves 略過', () => {
  const base = E.levelById(1);
  const nm = E.normalizeMods(base, { waveOverride: WO, waves: 2 });
  assert.deepStrictEqual(nm.problems.filter(p => !p.includes('waves 略過')), []); assert.ok(nm.problems.some(p => p.includes('waves 略過')));
  assert.strictEqual(nm.mods.waves, undefined); assert.strictEqual(nm.mods.waveOverride.length, 2); assert.strictEqual(nm.mods.waveOverride[0].hpMul, 1); assert.strictEqual(nm.mods.waveOverride[0].say, undefined); assert.strictEqual(nm.mods.waveOverride[1].say, '來了');
  for (const diff of ['calm', 'storm']) {
    const [G] = quiet(() => E.create(1, diff, rng, { waveOverride: WO }));
    assert.strictEqual(G.waves.length, 2); assert.deepStrictEqual(G.waves[1].list, [['wolf', 8], ['fast', 4]]); assert.strictEqual(G.waves[1].hpMul, 1.8); assert.strictEqual(G.waves[1].gap, 1, diff + ' 不乘倍率');
    assert.strictEqual(G.total, 18); assert.strictEqual(G.level.diffScale, 0);
  }
  const story = E.create(1, 'storm', rng); assert.notStrictEqual(story.waves[1].gap, 2.6, '沒給修飾詞的暴風夜照常乘倍率');
  const Gs = E.create(1, 'storm', rng, { waveOverride: WO }); assert.strictEqual(Gs.level.shepherdScale, 1, '牧人產糧的難度折扣照原夜（第 1 夜 diffScale 1），不跟著 diffScale 歸 0'); assert.strictEqual(E.create(8, 'storm', rng, { waveOverride: WO }).level.shepherdScale, 0.6);
  for (const bad of [[{ list: [['boar', 2]], gap: 1, rows: [9] }], [{ list: [], gap: 1, rows: [1] }], [{ list: [['nope', 1]], gap: 1, rows: [1] }], [{ list: [['wolf', 1]], gap: 0, rows: [1] }], [], 'x', [{ list: [['wolf', 1]], gap: 1, rows: [1], hpMul: 99 }]]) {
    const r = E.normalizeMods(base, { waveOverride: bad }); assert.strictEqual(r.mods, null, JSON.stringify(bad)); assert.ok(r.problems.some(p => p.includes('waveOverride')));
  }
  const [G2] = quiet(() => E.create(1, 'calm', rng, { waveOverride: WO }));
  run(G2, 25); assert.ok(!G2.events.some(e => e.t === 'toast' && e.msg === undefined), '第 1 波沒 say 不丟空 toast');
});

test('修飾詞 waveOverride 帶 strays／give（期 2c）：合規的留到關卡波表，迷羊照秒數進場、送卡夜照波送；壞的 strays 或不認識的 give 讓整張波表略過', () => {
  const sheepNight = LEVELS.find(l => l.sheep && l.chapter === 2).id, giveNight = LEVELS.find(l => l.conveyor).id;
  const ok = E.normalizeMods(E.levelById(sheepNight), { gates: 0, maxSheepLost: 0, waveOverride: [{ list: [['wolf', 2]], gap: 2, rows: [0, 1, 2, 3, 4], strays: [3, 9] }] });
  assert.deepStrictEqual(ok.problems, []); assert.deepStrictEqual(ok.mods.waveOverride[0].strays, [3, 9]);
  const G = E.create(sheepNight, 'storm', rng, ok.mods); assert.deepStrictEqual(G.waves[0].strays, [3, 9]);
  E.dev.nextWave(G); run(G, 2); // 直接開第 1 波，這一波的迷羊秒數進佇列（3 秒那隻可能已經在場上）
  assert.ok(G.strays.length + G.strayQueue.length >= 1, '迷羊排進佇列或已進場');
  const gv = E.normalizeMods(E.levelById(giveNight), { gates: 0, waveOverride: [{ list: [['wolf', 2]], gap: 2, rows: [0, 1, 2, 3, 4], give: 'dog' }] });
  assert.deepStrictEqual(gv.problems, []); assert.strictEqual(gv.mods.waveOverride[0].give, 'dog');
  for (const bad of [{ strays: 'x' }, { strays: [-1] }, { strays: [700] }, { give: 'nope' }, { give: 3 }]) {
    const r = E.normalizeMods(E.levelById(sheepNight), { gates: 0, maxSheepLost: 0, waveOverride: [{ list: [['wolf', 2]], gap: 2, rows: [0, 1, 2, 3, 4], ...bad }] });
    assert.ok(r.problems.some(m => m.includes('waveOverride')) && r.mods.waveOverride === undefined, JSON.stringify(bad));
  }
  const empty = E.normalizeMods(E.levelById(sheepNight), { gates: 0, maxSheepLost: 0, waveOverride: [{ list: [['wolf', 2]], gap: 2, rows: [0, 1, 2, 3, 4], strays: [] }] });
  assert.strictEqual(empty.mods.waveOverride[0].strays, undefined, '空陣列不留');
});

test('修飾詞 maxSheepLost：失一隻羊就輸（reason sheepLost，羊還在），沒羊的夜只提醒；快照帶著、同一題接得回', () => {
  const base = E.levelById(3);
  assert.deepStrictEqual(E.normalizeMods(base, { maxSheepLost: 0 }).mods, { maxSheepLost: 0 });
  assert.ok(E.normalizeMods(base, { maxSheepLost: -1 }).problems.length && E.normalizeMods(base, { maxSheepLost: 1.5 }).problems.length);
  assert.ok(E.normalizeMods(E.levelById(1), { maxSheepLost: 0 }).notes.some(n => n.includes('沒有羊')));
  const G = E.create(3, 'calm', rng, { maxSheepLost: 0, gates: 0 });
  assert.strictEqual(G.level.maxSheepLost, 0);
  assert.ok(E.place(G, 2, 1, 'slinger').ok); run(G, 24); // 放第一個人手才算開局；準備 18 秒後第一波開始出狼
  const e = G.enemies.find(x => !x.dead); assert.ok(e, '該有敵人了');
  e.carrying = true; e.x = COLS + 0.4; // 當牠抱著羊跑出右邊界（引擎判 x > COLS + 0.3）
  E.step(G, 0.1);
  assert.ok(G.over && G.result && !G.result.win && G.result.reason === 'sheepLost', JSON.stringify(G.result));
  assert.strictEqual(G.sheepLost, 1); assert.strictEqual(G.sheep, 2, '羊還有兩隻，是題目規定失一隻就輸');
  const G1 = E.create(3, 'calm', rng, { maxSheepLost: 1 }); E.place(G1, 2, 1, 'slinger'); run(G1, 24);
  const e1 = G1.enemies.find(x => !x.dead); e1.carrying = true; e1.x = COLS + 0.4; E.step(G1, 0.1);
  assert.ok(!G1.over && G1.sheepLost === 1, '准失一隻：第一隻不輸');
  const G0 = E.create(3, 'calm', rng); E.place(G0, 2, 1, 'slinger'); run(G0, 24); const e0 = G0.enemies.find(x => !x.dead); e0.carrying = true; e0.x = COLS + 0.4; E.step(G0, 0.1);
  assert.ok(!G0.over, '沒修飾詞：失一隻照舊只扣羊');
});

test('trialLevel：守望套了自帶波表、沒看門的；烈火一波、一筆糧、限卡、開局糧照題目；有羊的夜帶 maxSheepLost 0', () => {
  const W = E.trialLevel(E.trialById('w3')), F = E.trialLevel(E.trialById('f1'));
  assert.strictEqual(W.id, 3); assert.strictEqual(W.waves.length, E.levelById(3).waves.length); assert.strictEqual(W.gates, false); assert.strictEqual(W.maxSheepLost, 0); assert.strictEqual(W.diffScale, 0); assert.ok(W.units.includes('shepherd'));
  assert.strictEqual(F.id, 1); assert.strictEqual(F.waves.length, 1); assert.deepStrictEqual(F.units, ['slinger', 'wall']); assert.ok(F.noShepherd && F.noTrickle); assert.strictEqual(F.startFood, 900); assert.strictEqual(F.gates, false);
  const G = E.create(1, 'storm', rng, E.trialById('f1').mods); assert.strictEqual(G.food, 900, '烈火開局糧不乘 budgetMul'); assert.deepStrictEqual(G.gates, []);
});

test('解鎖：那一夜暴風夜守過＋星全拿才開，守望與烈火同時；只打寧靜／起風不算、少一顆星不算；沒看門的夜兩顆就夠；全新存檔全鎖；舊呼叫法（只給 cleared）當沒星', () => {
  const w1 = E.trialById('w1'), f1 = E.trialById('f1'), w15 = E.trialById('w15');
  for (const t of TRIALS) assert.ok(!E.isTrialUnlocked({ cleared: {}, stars: {} }, t)); assert.ok(!E.isTrialUnlocked(undefined, w1)); assert.ok(!E.isTrialUnlocked({}, null));
  assert.ok(E.isTrialUnlocked(full(1), w1) && E.isTrialUnlocked(full(1), f1), '兩題同時開');
  assert.ok(!E.isTrialUnlocked(full(1), w15), '別夜的星不算');
  assert.ok(!E.isTrialUnlocked({ cleared: { 1: { calm: true, windy: true } }, stars: { 1: { noLoss: true, gates: true } } }, w1), '沒守過暴風');
  assert.ok(!E.isTrialUnlocked({ cleared: { 1: { storm: true } }, stars: { 1: { noLoss: true } } }, w1), '少看門的那顆');
  assert.ok(!E.isTrialUnlocked({ cleared: { 1: { storm: true } }, stars: { 1: { gates: true } } }, w1), '少零損失那顆');
  assert.ok(!E.isTrialUnlocked({ cleared: { 1: { storm: true } }, stars: {} }, w1), '沒星');
  assert.ok(!E.isTrialUnlocked({ 1: { storm: true } }, w1), '只給 cleared 當沒星');
  const noGate = { ...E.levelById(1), gates: false }; assert.strictEqual(E.starSlots(noGate), 2);
  const savedGates = LEVELS[0].gates; LEVELS[0].gates = false;
  try { assert.ok(E.isTrialUnlocked({ cleared: { 1: { storm: true } }, stars: { 1: { noLoss: true } } }, w1), '沒看門的夜兩顆就開'); } finally { if (savedGates === undefined) delete LEVELS[0].gates; else LEVELS[0].gates = savedGates; }
  assert.strictEqual(E.trialGate(w1).id, 1); assert.strictEqual(E.trialGate(w15).id, 15); assert.strictEqual(E.trialGate({ id: 'x', levelId: 999 }), null); assert.strictEqual(E.trialGate(null), null);
  assert.strictEqual(E.isTrialUnlocked(full(999), { id: 'x', levelId: 999 }), false);
});

test('今日推薦：只在已開的題裡輪，同一天同一題、隔天換、輪一圈回頭；一題都沒開就沒有推薦；不隨機', () => {
  const day = d => new Date(`2026-11-${String(d).padStart(2, '0')}T12:00:00`);
  const all = { cleared: Object.fromEntries(LEVELS.map(l => [l.id, { storm: true }])), stars: Object.fromEntries(LEVELS.map(l => [l.id, { noLoss: true, gates: true }])) };
  const a = E.dailyTrial(day(1), all), b = E.dailyTrial(new Date('2026-11-01T23:30:00'), all);
  assert.ok(a && a === b, '同一天不變');
  const N = TRIALS.length, dayN = i => new Date(day(1).getTime() + i * 86400000); // 題數幾題就幾天輪一圈（第一章 20、加第二章 40）
  const seq = Array.from({ length: N }, (_, i) => E.dailyTrial(dayN(i), all).id);
  assert.strictEqual(new Set(seq).size, N, `${N} 天各不同：` + seq.join(' '));
  assert.strictEqual(E.dailyTrial(dayN(N), all).id, seq[0], `第 ${N + 1} 天回到第一題`);
  for (let d = 1; d <= 6; d++) assert.ok(['w1', 'f1'].includes(E.dailyTrial(day(d), full(1)).id), '只有第 1 夜開：只推那兩題');
  assert.strictEqual(E.dailyTrial(day(1), { cleared: {}, stars: {} }), null); assert.strictEqual(E.dailyTrial(day(1), null), null);
});

test('enemiesSeenBy：到那一夜為止（含）出現過的敵人；第 1 夜只有狼與快狼，第 3 夜（大衛）有領頭狼、熊、獅子，第二章才有野豬', () => {
  assert.deepStrictEqual([...E.enemiesSeenBy(1)].sort(), ['fast', 'wolf']);
  const d = E.enemiesSeenBy(2); for (const k of ['alpha', 'bear', 'lion', 'wolf', 'fast']) assert.ok(d.has(k), k); assert.ok(!d.has('boar') && !d.has('thief'));
  assert.ok(!E.enemiesSeenBy(7).has('boar') && E.enemiesSeenBy(9).has('boar'));
});

test('每題用模擬器的 good 玩家跑 10 局都能建局、打得完（不卡在超時）；烈火的局沒有牧人、糧照題目；守望的局有牧人', () => {
  for (const t of TRIALS) {
    const G = E.create(t.levelId, t.diff, rng, t.mods);
    assert.deepStrictEqual(G.mods, E.normalizeMods(E.levelById(t.levelId), t.mods).mods);
    assert.deepStrictEqual(G.gates, [], t.id + ' 沒看門的');
    if (t.kind === 'fire') { assert.ok(G.level.noShepherd); assert.strictEqual(G.food, t.mods.startFood); assert.ok(!G.level.units.includes('shepherd')); assert.strictEqual(G.waves.length, 1); }
    else { assert.ok(!G.level.noShepherd && (G.level.units.includes('shepherd') || G.level.conveyor), t.id + ' 守望有牧人（送卡夜除外）'); assert.strictEqual(G.waves.length, E.levelById(t.levelId).waves.length); }
    let timeouts = 0;
    for (let i = 0; i < 10; i++) { const r = SIM.play(t.levelId, t.diff, 1000 + i, 'good', t.mods); if (r.reason === 'timeout') timeouts++; }
    assert.strictEqual(timeouts, 0, `${t.id} 有局超時`);
  }
});

test('檢查點：試煉的快照帶修飾詞（含整張波表），同一題接得回來；拿故事模式同一夜的檢查點來接會被拒；拿試煉的去接故事也不行', () => {
  const t = E.trialById('w3');
  const G = E.create(t.levelId, t.diff, rng, t.mods);
  assert.ok(E.place(G, 2, 1, 'slinger').ok); G.wave = 2;
  const snap = JSON.parse(JSON.stringify(E.snapshot(G)));
  assert.ok(snap.mods && snap.mods.maxSheepLost === 0 && snap.mods.waveOverride.length === 4 && snap.mods.gates.length === 0);
  assert.ok(E.checkSnapshot(snap, t.levelId));
  const again = E.create(t.levelId, t.diff, rng, t.mods); assert.ok(E.restore(again, snap)); assert.strictEqual(again.wave, 2); assert.ok(again.units['2,1']); assert.strictEqual(again.level.maxSheepLost, 0); assert.strictEqual(again.waves.length, 4);
  const f = E.trialById('f3'), GF = E.create(f.levelId, f.diff, rng, f.mods); E.place(GF, 2, 1, 'slinger'); GF.wave = 1;
  assert.ok(!E.checkSnapshot(JSON.parse(JSON.stringify(E.snapshot(GF))), f.levelId), '烈火只有一波，沒有波間檢查點可接');
  const story = E.create(t.levelId, 'calm', rng); assert.ok(!E.restore(story, snap), '試煉的檔不能接故事那一夜');
  const sg = E.create(t.levelId, 'calm', rng); assert.ok(E.place(sg, 2, 0, 'shepherd').ok); sg.wave = 1;
  const ss = JSON.parse(JSON.stringify(E.snapshot(sg)));
  assert.ok(!E.restore(E.create(t.levelId, t.diff, rng, t.mods), ss), '故事的檔不能接試煉');
  const other = E.create(t.levelId, t.diff, rng, { ...t.mods, maxSheepLost: 1 }); assert.ok(!E.restore(other, snap), '同一夜、修飾詞差一個欄位也不能接');
  const over = { ...snap, sheepLost: 1 }; assert.ok(!E.checkSnapshot(over, t.levelId), '失羊已超過 maxSheepLost 的檔不接'); assert.ok(!E.restore(E.create(t.levelId, t.diff, rng, t.mods), over));
});
