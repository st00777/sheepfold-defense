// 解鎖與編號的測試：node --test sim/*.test.js
// id 永遠不動、顯示編號看位置；老玩家的存檔不能被中途插進來的新夜鎖住
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const D = require(path.join(__dirname, '..', 'data.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));
const { LEVELS } = D;
const ids = () => LEVELS.map(l => l.id);
const clearedOf = list => Object.fromEntries(list.map(id => [id, { calm: true }]));

test('posOf／nextOf 照 LEVELS 順序，不照 id', () => {
  assert.strictEqual(E.posOf(LEVELS[0].id), 1);
  assert.strictEqual(E.posOf(LEVELS[LEVELS.length - 1].id), LEVELS.length);
  assert.strictEqual(E.posOf(9999), 0);
  assert.strictEqual(E.nextOf(LEVELS[0].id), LEVELS[1]);
  assert.strictEqual(E.nextOf(LEVELS[LEVELS.length - 1].id), null);
  assert.strictEqual(E.nextOf(9999), null);
});

test('新玩家只開第一夜；守過一夜開下一夜', () => {
  assert.ok(E.isUnlocked({}, LEVELS[0].id));
  assert.ok(!E.isUnlocked({}, LEVELS[1].id));
  assert.ok(!E.isUnlocked(undefined, LEVELS[1].id));
  const c = clearedOf([LEVELS[0].id]);
  assert.ok(E.isUnlocked(c, LEVELS[1].id));
  assert.ok(!E.isUnlocked(c, LEVELS[2].id));
});

test('守過後面的夜，前面所有夜都算開（老玩家）', () => {
  const last = LEVELS[LEVELS.length - 1].id;
  const c = clearedOf([last]);
  for (const id of ids()) assert.ok(E.isUnlocked(c, id), 'id ' + id);
  assert.ok(!E.isUnlocked(c, 9999));
});

test('中途插一夜：老檔的進度不被鎖、顯示編號跟著位置走', () => {
  // 模擬在 id 7 後面再插一個新夜 id 99：老玩家已守過 id 1-14（位置用算的，不寫死，因為第一章已經插過夜）
  const i = LEVELS.findIndex(l => l.id === 7);
  const fake = { id: 99, name: '測試用新夜', units: ['shepherd'], fresh: [], waves: [] };
  const pos8Before = E.posOf(8);
  LEVELS.splice(i + 1, 0, fake);
  try {
    const c = clearedOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    assert.ok(E.isUnlocked(c, 99), '新夜：前一夜守過就開');
    assert.ok(E.isUnlocked(c, 8), '老第 8 夜：本夜已守過');
    assert.ok(E.isUnlocked(c, 14), '老最後一夜：本夜已守過，後面沒有夜也不鎖');
    assert.strictEqual(E.posOf(99), i + 2);
    assert.strictEqual(E.posOf(8), pos8Before + 1, '老 id 8 的顯示編號往後挪一格');
    assert.strictEqual(E.nextOf(7).id, 99);
    assert.strictEqual(E.nextOf(99).id, 8);
    // 只破第一章（含已插的 15-17）的玩家：新夜開、老第 8 夜要等新夜守過才開
    const c1 = clearedOf([1, 15, 2, 3, 16, 4, 5, 6, 17, 7]);
    assert.ok(E.isUnlocked(c1, 99));
    assert.ok(!E.isUnlocked(c1, 8));
    // 半途（破到 id 10）：新夜與 8-10 都開，11 開（前一夜 10 守過）、12 不開
    const c2 = clearedOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.ok(E.isUnlocked(c2, 99)); assert.ok(E.isUnlocked(c2, 11)); assert.ok(!E.isUnlocked(c2, 12));
    // 老玩家只破舊 1-7（沒碰過新插的 15-17）：新夜 15 開（前一夜 1 守過）、舊 2 開（本夜守過）、第二章第一夜開（前一夜 7 守過）
    const c3 = clearedOf([1, 2, 3, 4, 5, 6, 7]);
    assert.ok(E.isUnlocked(c3, 15)); assert.ok(E.isUnlocked(c3, 2)); assert.ok(E.isUnlocked(c3, 99)); assert.ok(!E.isUnlocked(c3, 8));
  } finally { LEVELS.splice(i + 1, 1); }
  assert.strictEqual(E.posOf(8), pos8Before, '還原後位置回來');
});

test('第一章已插的三夜在正確位置、第 7 夜的預設隊伍仍含纏裹的牧人與投石機', () => {
  assert.deepStrictEqual(LEVELS.slice(0, 10).map(l => l.id), [1, 15, 2, 3, 16, 4, 5, 6, 17, 7]);
  assert.strictEqual(E.posOf(7), 10);
  const pick = E.defaultPick(LEVELS.find(l => l.id === 7));
  assert.ok(pick.includes('healer') && pick.includes('catapult'), pick.join(','));
  assert.deepStrictEqual(LEVELS.find(l => l.id === 2).fresh, ['sling']);
  assert.deepStrictEqual(LEVELS.find(l => l.id === 15).fresh, ['dog']);
});

test('升級開放夜比的是位置：膏油在第 7 位之後才行', () => {
  // 現在 id 與位置相同，先確認基準；日後插夜後 from 值要跟著位置改
  const up = D.UNITS.healer.upgrade;
  assert.strictEqual(up.from, E.posOf(7));
  const G = E.create(7, 'calm', () => 0.5); G.food = 9999; G.started = true;
  assert.ok(E.place(G, 2, 3, 'healer').ok);
  assert.ok(E.tapUnit(G, 2, 3).ok, '第 7 位可以膏油');
});
