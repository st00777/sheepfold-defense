// 拿著卡直接點同類單位＝鏟掉＋放下：要有全價才能點、實付＝全價－退一半；只開牆類／投手類、只能往貴的換
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const D = require(path.join(__dirname, '..', 'data.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));

function setup(level = 7, food = 9999) {
  const G = E.create(level, 'calm', () => 0.5); G.food = food; G.started = true; G.phase = 'rest'; G.timer = 999; G.holdWaves = true;
  G.level = { ...G.level, units: Object.keys(D.UNITS) }; // 測試開全卡
  return G;
}

test('石牆換守望樓：扣 125－25＝100，原地變成全血守望樓', () => {
  const G = setup(7, 300);
  assert.ok(E.place(G, 2, 4, 'wall').ok); G.units['2,4'].hp = 80; // 被咬過也照退一半
  assert.ok(E.canSwap(G, 2, 4, 'tower'));
  const res = E.swap(G, 2, 4, 'tower');
  assert.ok(res.ok, res.msg);
  assert.strictEqual(G.food, 300 - 50 - 100);
  assert.strictEqual(G.units['2,4'].type, 'tower');
  assert.strictEqual(G.units['2,4'].hp, D.UNITS.tower.hp);
  assert.match(res.msg, /退 25 糧、實付 100/);
});

test('要有新卡全價才能換：110 糧換守望樓不行，雖然實付只要 100', () => {
  const G = setup(7, 160);
  assert.ok(E.place(G, 2, 4, 'wall').ok); // 剩 110
  const res = E.swap(G, 2, 4, 'tower');
  assert.strictEqual(res.ok, false); assert.match(res.msg, /糧不夠/);
  assert.strictEqual(G.units['2,4'].type, 'wall');
});

test('同種擋掉、往便宜換擋掉、跨類擋掉、輔助類不開', () => {
  const G = setup();
  E.place(G, 1, 1, 'wall'); E.place(G, 1, 2, 'tower'); E.place(G, 1, 3, 'slinger'); E.place(G, 1, 4, 'lamp');
  assert.strictEqual(E.swap(G, 1, 1, 'wall').ok, false);          // 石牆換石牆
  assert.strictEqual(E.swap(G, 1, 2, 'wall').ok, false);          // 守望樓換回石牆
  assert.strictEqual(E.swap(G, 1, 1, 'slinger').ok, false);       // 牆換投手
  assert.strictEqual(E.swap(G, 1, 4, 'horn').ok, false);          // 油燈換吹角手（輔助類不開）
  assert.strictEqual(E.swap(G, 1, 3, 'hireling').ok, false);      // 投石手換雇工（便宜）
  assert.ok(!E.canSwap(G, 1, 4, 'horn') && !E.canSwap(G, 1, 2, 'wall') && !E.canSwap(G, 0, 0, 'tower'));
  for (const k of ['wall', 'tower', 'slinger', 'lamp']) assert.ok(Object.values(G.units).some(u => u.type === k), k + ' 還在');
});

test('投手類往上換：投石手換投石隊，扣 175－50', () => {
  const G = setup(7, 500);
  E.place(G, 3, 2, 'slinger');
  const res = E.swap(G, 3, 2, 'volley'); assert.ok(res.ok, res.msg);
  assert.strictEqual(G.food, 500 - 100 - 125);
  assert.strictEqual(G.units['3,2'].type, 'volley');
});

test('送卡夜：用手上的卡換，沒被咬過的舊單位退回手上；被咬過的收不回來', () => {
  const G = setup(11);
  G.hand = ['wall']; assert.ok(E.place(G, 2, 4, 'wall').ok);
  G.hand = ['tower'];
  const res = E.swap(G, 2, 4, 'tower'); assert.ok(res.ok, res.msg);
  assert.deepStrictEqual(G.hand, ['wall']);
  assert.strictEqual(G.units['2,4'].type, 'tower');
  assert.strictEqual(E.swap(G, 2, 4, 'catapult').ok, false); // 卡不在手上
  G.hand = ['wall']; assert.ok(E.place(G, 2, 5, 'wall').ok); G.units['2,5'].hp = 10; G.hand = ['tower'];
  const res2 = E.swap(G, 2, 5, 'tower'); assert.ok(res2.ok, res2.msg);
  assert.deepStrictEqual(G.hand, []); assert.match(res2.msg, /被咬過的收不回來/);
});
