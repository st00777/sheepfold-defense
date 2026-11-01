// 成就（期 4，2026-11-01）：資料規矩、九條規則各自成立／不成立、跟存檔裡已解鎖的比只回新的
// node --test sim/
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const D = require(path.join(__dirname, '..', 'data.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));
const { LEVELS, TRIALS, ACHIEVEMENTS, ACHIEVEMENT_GROUPS } = D;

const won = (ids, diff = 'calm') => { const c = {}; for (const id of ids) c[id] = { [diff]: true }; return c; };
const allIds = LEVELS.map(L => L.id);

test('資料：九條、三組各三條、validateAchievements 乾淨；經文都是 data.js 裡本來就有的句子（不新增出處）', () => {
  assert.strictEqual(ACHIEVEMENTS.length, 9);
  assert.deepStrictEqual(E.validateAchievements(), []);
  const g = {}; for (const a of ACHIEVEMENTS) g[a.group] = (g[a.group] || 0) + 1;
  assert.deepStrictEqual(g, { progress: 3, skill: 3, collect: 3 });
  for (const k in g) assert.ok(ACHIEVEMENT_GROUPS[k]);
  const src = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8');
  for (const a of ACHIEVEMENTS) {
    const core = a.verse.replace(/^「|」$/g, '');
    assert.ok(src.split(core).length >= 3, `${a.id} 的經文「${core}」在 data.js 只出現在成就表裡`);
    assert.ok(src.includes(a.ref), `${a.id} 的出處 ${a.ref} 在 data.js 找不到`);
  }
});

test('規則：全新存檔沒有；守過第 1 夜→第一夜；第一章全守過→哈蘭十夜；三十夜全守過→三十夜（任一難度都算）', () => {
  assert.deepStrictEqual(E.achievementsEarned({}, {}), []);
  assert.deepStrictEqual(E.achievementsEarned({ cleared: won([1], 'windy') }, {}), ['first_night']);
  const ch1 = LEVELS.filter(L => (L.chapter || 1) === 1).map(L => L.id);
  assert.deepStrictEqual(E.achievementsEarned({ cleared: won(ch1) }, {}), ['first_night', 'chapter_one']);
  assert.deepStrictEqual(E.achievementsEarned({ cleared: won(allIds) }, {}), ['first_night', 'chapter_one', 'thirty_nights', 'stars_30'], '三十夜各守過一次就是 30 顆星');
  assert.deepStrictEqual(E.achievementsEarned({ cleared: won([2, 3]) }, {}), [], '第 1 夜沒守過就沒有「第一夜」');
});

test('規則：一隻沒少要有羊的夜零損失；暴風夜滿星要 storm 守過＋那一夜的星全拿（沒看門的夜兩顆就夠）；烈火一題看試煉', () => {
  const sheepNight = LEVELS.find(L => L.sheep), dry = LEVELS.find(L => !L.sheep && L.id !== 1);
  assert.ok(sheepNight && dry);
  assert.ok(!E.achievementsEarned({ cleared: won([dry.id]), stars: { [dry.id]: { noLoss: true } } }, {}).includes('no_loss'), '沒羊的夜不算');
  assert.ok(E.achievementsEarned({ cleared: won([sheepNight.id]), stars: { [sheepNight.id]: { noLoss: true } } }, {}).includes('no_loss'));
  assert.ok(!E.achievementsEarned({ cleared: won([sheepNight.id]), stars: { [sheepNight.id]: { noLoss: false } } }, {}).includes('no_loss'));
  const three = LEVELS.find(L => E.starSlots(L) === 3), two = LEVELS.find(L => E.starSlots(L) === 2) || null; // 目前沒有 gates: false 的夜，two 多半是 null
  assert.ok(three);
  assert.ok(!E.achievementsEarned({ cleared: won([three.id], 'windy'), stars: { [three.id]: { noLoss: true, gates: true } } }, {}).includes('storm_full'), '起風夜滿星不算');
  assert.ok(!E.achievementsEarned({ cleared: won([three.id], 'storm'), stars: { [three.id]: { noLoss: true, gates: false } } }, {}).includes('storm_full'), '少一顆不算');
  assert.ok(E.achievementsEarned({ cleared: won([three.id], 'storm'), stars: { [three.id]: { noLoss: true, gates: true } } }, {}).includes('storm_full'));
  if (two) assert.ok(E.achievementsEarned({ cleared: won([two.id], 'storm'), stars: { [two.id]: { noLoss: true, gates: false } } }, {}).includes('storm_full'), '沒看門的夜兩顆就夠');
  assert.strictEqual(E.starsOfNight({ cleared: won([three.id]), stars: { [three.id]: { noLoss: true, gates: true } } }, three.id), 3);
  const fire = TRIALS.find(t => t.kind === 'fire'), watch = TRIALS.find(t => t.kind === 'watch');
  assert.ok(E.achievementsEarned({}, { cleared: { [fire.id]: true } }).includes('fire_one'));
  assert.ok(!E.achievementsEarned({}, { cleared: { [watch.id]: true } }).includes('fire_one'), '守望不算烈火');
});

test('規則：三十顆星、滿天星照 starsOfNight 加總（守過 1＋零損失 1＋看門的 1，沒看門的夜只有兩顆）；二十題看試煉過了幾題', () => {
  const stars = {}; for (const id of allIds) stars[id] = { noLoss: true, gates: true };
  const tot = LEVELS.reduce((a, L) => a + E.starSlots(L), 0);
  assert.strictEqual(allIds.reduce((a, id) => a + E.starsOfNight({ cleared: won(allIds), stars }, id), 0), tot);
  assert.strictEqual(E.starsOfNight({ cleared: {}, stars }, allIds[0]), 0, '沒守過就沒有星，就算星的旗子在');
  const all = E.achievementsEarned({ cleared: won(allIds), stars }, {});
  assert.ok(all.includes('stars_30') && all.includes('stars_all'));
  const ten = allIds.slice(0, 10), st10 = {}; for (const id of ten) st10[id] = { noLoss: true, gates: true }; // 十夜滿星＝第一章 30 顆上下（含兩顆的夜就不到）
  const got10 = ten.reduce((a, id) => a + E.starsOfNight({ cleared: won(ten), stars: st10 }, id), 0);
  const r10 = E.achievementsEarned({ cleared: won(ten), stars: st10 }, {});
  assert.strictEqual(r10.includes('stars_30'), got10 >= 30); assert.ok(!r10.includes('stars_all'));
  const t19 = {}, t20 = {}; TRIALS.slice(0, 19).forEach(t => (t19[t.id] = true)); TRIALS.slice(0, 20).forEach(t => (t20[t.id] = true));
  assert.ok(!E.achievementsEarned({}, { cleared: t19 }).includes('trials_20'));
  assert.ok(E.achievementsEarned({}, { cleared: t20 }).includes('trials_20'));
});

test('achievementsNew：跟存檔裡已解鎖的比只回新的，順序照成就表；壞的 have 當空', () => {
  const p = { cleared: won(allIds) };
  assert.deepStrictEqual(E.achievementsNew({ first_night: '2026-11-01' }, p, {}), ['chapter_one', 'thirty_nights', 'stars_30']);
  assert.deepStrictEqual(E.achievementsNew(null, p, {}), ['first_night', 'chapter_one', 'thirty_nights', 'stars_30']);
  assert.deepStrictEqual(E.achievementsNew({ first_night: '2026-11-01', chapter_one: 'x', thirty_nights: 'y', stars_30: 'z' }, p, {}), []);
});
