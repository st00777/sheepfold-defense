// 11/2 收尾前多角色評估（docs/review-multiview-2026-11-02.md）交集 A：沒選卡點單位要「第一下只看、第二下才扣糧」。
// 畫面層靠 Engine.tapPreview 判斷第一下要預告什麼；這裡確認它跟 tapUnit 的條件一致、而且不會改到任何狀態
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const D = require(path.join(__dirname, '..', 'data.js'));
const Engine = require(path.join(__dirname, '..', 'engine.js'));

function game(id = 1, diff = 'calm') { const G = Engine.create(id, diff, () => 0.5); G.food = 9999; return G; }

test('tapPreview：空格、石堆、送卡模式回 null', () => {
  const G = game();
  assert.strictEqual(Engine.tapPreview(G, 2, 0), null);
  const G3 = game(21, 'calm'); G3.food = 9999; // 第三章有石堆
  if (D.UNITS.cairn && G3.level.units.includes('cairn')) { Engine.place(G3, 0, 5, 'cairn'); assert.strictEqual(Engine.tapPreview(G3, 0, 5), null); }
});

test('tapPreview：牧人預告升老牧人、不改狀態；tapUnit 才扣糧', () => {
  const G = game();
  assert.ok(Engine.place(G, 2, 0, 'shepherd').ok);
  const before = JSON.stringify(Engine.snapshot(G)), food = G.food;
  const pv = Engine.tapPreview(G, 2, 0);
  assert.deepStrictEqual(pv, { action: 'elder', cost: D.ELDER_COST, name: '老牧人' });
  assert.strictEqual(JSON.stringify(Engine.snapshot(G)), before, '預覽不能改狀態');
  assert.strictEqual(G.food, food);
  assert.ok(Engine.tapUnit(G, 2, 0).ok);
  assert.strictEqual(G.food, food - D.ELDER_COST);
  assert.strictEqual(Engine.tapPreview(G, 2, 0), null, '已經是老牧人就沒有第二下');
});

test('tapPreview：牆受傷才預告修補，剛修過（冷卻中）不預告', () => {
  const G = game();
  assert.ok(Engine.place(G, 2, 4, 'wall').ok);
  assert.strictEqual(Engine.tapPreview(G, 2, 4), null, '滿血的牆沒東西可做');
  const u = G.units['2,4']; u.hp = Math.floor(u.maxHp / 2);
  assert.deepStrictEqual(Engine.tapPreview(G, 2, 4), { action: 'repair', cost: D.REPAIR_COST, name: '修補' });
  assert.ok(Engine.tapUnit(G, 2, 4).ok);
  assert.strictEqual(Engine.tapPreview(G, 2, 4), null, '冷卻中 tapUnit 會拒絕，預覽也不該叫玩家再點');
});

test('tapPreview：通用升級要到學會那一夜才預告', () => {
  const early = game(1), late = game(D.LEVELS.find(L => L.units.includes('thorns') && Engine.posOf(L.id) >= D.UNITS.thorns.upgrade.from).id);
  late.food = 9999;
  if (early.level.units.includes('thorns')) { Engine.place(early, 2, 3, 'thorns'); assert.strictEqual(Engine.tapPreview(early, 2, 3), null); }
  assert.ok(Engine.place(late, 2, 3, 'thorns').ok);
  const pv = Engine.tapPreview(late, 2, 3);
  assert.deepStrictEqual(pv, { action: 'upgrade', cost: D.UNITS.thorns.upgrade.cost, name: D.UNITS.thorns.upgrade.name });
});

test('成就第一夜有 lead，驗證仍過；四夜有 who 身分行；章末兩篇詩有 psalmPick', () => {
  assert.strictEqual(Engine.validateAchievements().length, 0);
  const a = D.ACHIEVEMENTS.find(x => x.id === 'first_night'); assert.ok(a.lead && a.lead.endsWith('：'));
  for (const id of [5, 6, 17, 23]) assert.ok(D.LEVELS.find(L => L.id === id).who, `id ${id} 要有 who`);
  for (const night of [10, 30]) { const L = D.LEVELS.find(x => Engine.posOf(x.id) === night); assert.ok(L.psalm.length > 2 && L.psalmPick >= 0 && L.psalmPick < L.psalm.length, `第 ${night} 夜（id ${L.id}）`); } // 程式 id 不等於畫面夜數（第 10 夜是 id 7）
});

test('失敗結語開頭不再寫「狼闖進來了」這類指定是哪一隻（標題已經寫了）', () => {
  for (const L of D.LEVELS) if (L.outroLose && L.outroLose.wolf) assert.ok(!/^(狼|豹|野牛|熊)[^。]*(闖|進來|撞穿)[^。]*。/.test(L.outroLose.wolf), `id ${L.id}：${L.outroLose.wolf.slice(0, 20)}`);
});
