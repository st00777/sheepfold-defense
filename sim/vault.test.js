// 賊翻牆：要連續越過牆（中途有離地高度），不是定格後瞬移；守望樓翻不過
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const D = require(path.join(__dirname, '..', 'data.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));

function run(blockerKey) {
  const lv = D.LEVELS.find(l => l.units.includes(blockerKey) && l.waves.some(w => w.list.some(([t]) => t === 'thief')));
  const G = E.create(lv.id, 'calm'); G.food = 999; G.started = true; G.phase = 'wave';
  const r = 2, c = 3;
  G.rocks.delete(r + ',' + c);
  assert.ok(E.place(G, r, c, blockerKey).ok);
  E.dev.spawn(G, 'thief', r, c + 1.2);
  const e = G.enemies[0];
  let maxLift = 0, seenMid = false;
  for (let i = 0; i < 400 && !e.dead; i++) {
    E.step(G, 0.05);
    maxLift = Math.max(maxLift, e.lift || 0);
    if (e.vaulting > 0 && e.x > c - 0.4 && e.x < c + 0.4) seenMid = true; // 翻到牆上方的時候
    G.enemies = G.enemies.filter(x => x === e); // 不讓關卡自己的波次干擾
  }
  return { e, maxLift, seenMid, wall: G.units[r + ',' + c] };
}

test('石牆：賊走弧線翻過去', () => {
  const { e, maxLift, seenMid } = run('wall');
  assert.strictEqual(e.vaulted, true);
  assert.ok(e.x < 3 - 0.4, '翻到牆的另一側 x=' + e.x);
  assert.ok(maxLift > 0.9, '中途有離地 lift=' + maxLift);
  assert.ok(seenMid, '翻的過程有經過牆上方');
  assert.strictEqual(e.lift, 0, '落地後 lift 歸零');
});

test('守望樓：賊翻不過，只能咬', () => {
  const { e, maxLift, wall } = run('tower');
  assert.strictEqual(e.vaulted, false);
  assert.strictEqual(maxLift, 0);
  assert.ok(e.x > 3.4, '還在樓前面 x=' + e.x);
  assert.ok(wall.hp < wall.maxHp, '樓被咬了');
});
