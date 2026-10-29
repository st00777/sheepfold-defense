// 守夜試煉（期 2，2026-10-29）：data.js TRIALS 六題、解鎖規則、今日推薦、每題建得起局且修飾詞乾淨、檢查點走自己的格子。node --test sim/*.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const D = require(path.join(__dirname, '..', 'data.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));
const SIM = require(path.join(__dirname, 'simulate.js'));
const { TRIALS, TRIAL_KINDS, LEVELS, UNITS } = D;
const rng = () => 0.5;
const chapterOf = L => L.chapter || 1;
const lastOf = ch => LEVELS.filter(l => chapterOf(l) === ch).pop();

test('六題：id 不重複、口味各 2、每題的夜與難度存在、修飾詞 checkMods 乾淨、題目文字齊全', () => {
  assert.strictEqual(TRIALS.length, 6);
  assert.deepStrictEqual(E.validateTrials(), []);
  const kinds = {}; for (const t of TRIALS) kinds[t.kind] = (kinds[t.kind] || 0) + 1;
  assert.deepStrictEqual(kinds, { puzzle: 2, conveyor: 2, budget: 2 });
  for (const t of TRIALS) {
    assert.ok(TRIAL_KINDS[t.kind], t.id);
    assert.ok(E.trialById(t.id) === t);
    for (const f of ['title', 'text', 'win']) assert.ok(typeof t[f] === 'string' && t[f].length >= 3, `${t.id} 缺 ${f}`);
    assert.deepStrictEqual(E.checkMods(t.levelId, t.mods), [], t.id);
  }
  assert.strictEqual(E.trialById('nope'), null);
});

test('trialLevel：套好修飾詞的夜（白名單、糧、波數、看門的、送卡、一筆糧），id 跟原夜一樣', () => {
  const L1 = E.trialLevel(E.trialById('t1'));
  assert.strictEqual(L1.id, 1); assert.deepStrictEqual(L1.units, ['slinger', 'wall']); assert.strictEqual(L1.startFood, 600); assert.strictEqual(L1.waves.length, 3); assert.strictEqual(L1.gates, false); assert.ok(L1.noShepherd && L1.noTrickle);
  const L3 = E.trialLevel(E.trialById('t3'));
  assert.ok(L3.conveyor && L3.conveyor.every === 12 && L3.conveyor.max === 6); assert.ok(!L3.units.includes('shepherd')); assert.deepStrictEqual(Object.keys(L3.conveyor.weights).sort(), ['archer', 'slinger', 'thorns', 'wall']);
  const L6 = E.trialLevel(E.trialById('t6'));
  assert.ok(!L6.units.includes('shepherd') && L6.units.length > D.MAX_CARDS, '第 6 題整副都開（沒牧人），要點兵'); assert.strictEqual(L6.startFood, 2000);
});

test('解鎖：那一夜所在的章守過最後一夜（任一難度）才開；前面的夜守過不算；全新存檔六題全鎖', () => {
  const t1 = E.trialById('t1'), t2 = E.trialById('t2'), t4 = E.trialById('t4');
  const ch1 = lastOf(1).id, ch2 = lastOf(2).id, ch3 = lastOf(3).id;
  for (const t of TRIALS) assert.ok(!E.isTrialUnlocked({}, t)); assert.ok(!E.isTrialUnlocked(undefined, t1)); assert.ok(!E.isTrialUnlocked({}, null));
  assert.ok(!E.isTrialUnlocked({ 1: { calm: true }, 2: { calm: true } }, t1), '第一章還沒打完');
  assert.ok(E.isTrialUnlocked({ [ch1]: { storm: true } }, t1), '任一難度都算');
  assert.ok(!E.isTrialUnlocked({ [ch1]: { calm: true } }, t2), '第一章打完不開第二章的題');
  assert.ok(E.isTrialUnlocked({ [ch2]: { calm: true } }, t2));
  assert.ok(E.isTrialUnlocked({ [ch3]: { calm: true } }, t4));
  assert.ok(!E.isTrialUnlocked({ [ch1]: {} }, t1), '空的難度表不算守過');
});

test('今日推薦：只在已開的題裡輪，同一天同一題、隔天換、輪一圈回頭；一題都沒開就沒有推薦；不隨機', () => {
  const day = d => new Date(`2026-11-${String(d).padStart(2, '0')}T12:00:00`);
  const all = Object.fromEntries(LEVELS.map(l => [l.id, { calm: true }]));
  const a = E.dailyTrial(day(1), all), b = E.dailyTrial(new Date('2026-11-01T23:30:00'), all);
  assert.ok(a && a === b, '同一天不變');
  const seq = [1, 2, 3, 4, 5, 6].map(d => E.dailyTrial(day(d), all).id);
  assert.strictEqual(new Set(seq).size, 6, '六天各不同：' + seq.join(' '));
  assert.strictEqual(E.dailyTrial(day(7), all).id, seq[0], '第七天回到第一題');
  const ch1 = { [lastOf(1).id]: { calm: true } }, ids1 = TRIALS.filter(t => chapterOf(E.levelById(t.levelId)) === 1).map(t => t.id);
  for (let d = 1; d <= 6; d++) assert.ok(ids1.includes(E.dailyTrial(day(d), ch1).id), '只有第一章開：只推第一章的題');
  assert.strictEqual(E.dailyTrial(day(1), {}), null); assert.strictEqual(E.dailyTrial(day(1), null), null);
});

test('trialGate：回那一題要守過的夜（該章最後一夜）；題目指到不存在的夜回 null、isTrialUnlocked 回 false 不丟例外；每種口味都有輸局那句', () => {
  assert.strictEqual(E.trialGate(E.trialById('t1')).id, lastOf(1).id); assert.strictEqual(E.trialGate(E.trialById('t6')).id, lastOf(2).id); assert.strictEqual(E.trialGate(E.trialById('t4')).id, lastOf(3).id);
  assert.strictEqual(E.trialGate({ id: 'x', levelId: 999 }), null); assert.strictEqual(E.isTrialUnlocked({ 7: { calm: true } }, { id: 'x', levelId: 999 }), false); assert.strictEqual(E.trialGate(null), null);
  for (const k in TRIAL_KINDS) assert.ok(typeof TRIAL_KINDS[k].lose === 'string' && TRIAL_KINDS[k].lose.length >= 3, k);
  assert.ok(E.sameMods(null, undefined) && E.sameMods({ a: 1 }, { a: 1 }) && !E.sameMods({ a: 1 }, { a: 2 }));
});

test('每題用模擬器的 good 玩家跑 10 局都能建局、打得完（不卡在超時），一筆糧與解謎的局沒有牧人、送卡的局沒有糧', () => {
  for (const t of TRIALS) {
    const G = E.create(t.levelId, t.diff, rng, t.mods);
    assert.deepStrictEqual(G.mods, E.normalizeMods(E.levelById(t.levelId), t.mods).mods);
    if (t.kind === 'conveyor') { assert.ok(G.level.conveyor); assert.strictEqual(G.hand.length, 3, '開局三張'); }
    else { assert.ok(G.level.noShepherd); assert.strictEqual(G.food, t.mods.startFood); assert.ok(!G.level.units.includes('shepherd')); }
    let timeouts = 0;
    for (let i = 0; i < 10; i++) { const r = SIM.play(t.levelId, t.diff, 1000 + i, 'good', t.mods); if (r.reason === 'timeout') timeouts++; }
    assert.strictEqual(timeouts, 0, `${t.id} 有局超時`);
  }
});

test('檢查點：試煉的快照帶修飾詞，同一題接得回來；拿故事模式同一夜的檢查點來接會被拒；拿試煉的去接故事也不行', () => {
  const t = E.trialById('t2');
  const G = E.create(t.levelId, t.diff, rng, t.mods);
  assert.ok(E.place(G, 2, 1, 'slinger').ok); G.wave = 2;
  const snap = JSON.parse(JSON.stringify(E.snapshot(G)));
  assert.ok(snap.mods && snap.mods.startFood === 950);
  assert.ok(E.checkSnapshot(snap, t.levelId));
  const again = E.create(t.levelId, t.diff, rng, t.mods); assert.ok(E.restore(again, snap)); assert.strictEqual(again.wave, 2); assert.ok(again.units['2,1']);
  const story = E.create(t.levelId, 'calm', rng); assert.ok(!E.restore(story, snap), '試煉的檔不能接故事那一夜');
  const sg = E.create(t.levelId, 'calm', rng); assert.ok(E.place(sg, 2, 0, 'shepherd').ok); sg.wave = 1;
  const ss = JSON.parse(JSON.stringify(E.snapshot(sg)));
  assert.ok(!E.restore(E.create(t.levelId, t.diff, rng, t.mods), ss), '故事的檔不能接試煉');
});
