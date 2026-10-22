'use strict';
// 小居 2026-10-21 審查第 5、6 項：接回事件帶接的人、巡夜人出手事件帶他的 id、救回羊數（sheepSaved）統計與存檔往返
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

function setup(units) {
  const G = E.create(14, 'calm', () => 0.5);
  G.level = { ...G.level, units };
  G.food = 1000; G.started = true; G.phase = 'rest'; G.wave = 1; G.timer = 999; G.holdWaves = true;
  return G;
}
// 跑 s 秒，每一步把事件交給 on 看過再清掉
const run = (G, s, on) => { for (let i = 0; i < Math.round(s * 30); i++) { E.step(G, 1 / 30); if (on) for (const ev of G.events) on(ev); G.events.length = 0; } };

test('抱羊羔的牧人接回：fx catch 落在牧人那格、帶他的 id；不再發 home；sheepSaved +1', () => {
  const G = setup(['cradle']);
  assert.ok(E.place(G, 2, 2, 'cradle').ok); const u = G.units['2,2'];
  E.dev.stray(G, 3, 3.5); // 鄰排的迷羊，走到第 2 欄就被接
  const sheep0 = G.sheep; let caught = null, home = 0;
  run(G, 20, ev => { if (ev.t === 'fx' && ev.kind === 'catch') caught = ev; if (ev.t === 'fx' && ev.kind === 'home') home++; });
  assert.ok(caught, '有接回事件');
  assert.equal(caught.r, 2); assert.equal(caught.x, 2); assert.equal(caught.id, u.id);
  assert.equal(home, 0, '被接回的不發 home');
  assert.equal(G.sheep, sheep0 + 1); assert.equal(G.sheepSaved, 1);
});

test('沒人接：迷羊自己走到最左邊發 home，也算救回一隻', () => {
  const G = setup(['wall']);
  E.dev.stray(G, 1, 1.5);
  let home = 0, caught = 0;
  run(G, 20, ev => { if (ev.t === 'fx' && ev.kind === 'home') home++; if (ev.t === 'fx' && ev.kind === 'catch') caught++; });
  assert.equal(home, 1); assert.equal(caught, 0); assert.equal(G.sheepSaved, 1);
});

test('巡夜人出手事件帶他的 id（畫面靠這個讓他揮一下）', () => {
  const G = setup(['patrol']);
  assert.ok(E.place(G, 2, 3, 'patrol').ok); const u = G.units['2,3'];
  E.dev.spawn(G, 'wolf', 2, 4.0);
  const ids = new Set(); let hits = 0;
  run(G, 3, ev => { if (ev.t === 'fx' && ev.kind === 'strike') { hits++; ids.add(ev.id); } });
  assert.ok(hits > 0, '有出手');
  assert.deepEqual([...ids], [u.id]);
});

test('sheepSaved 存檔往返；壞值拒收；舊存檔沒這欄當 0', () => {
  const G = setup(['cradle']); G.sheepSaved = 2;
  const snap = JSON.parse(JSON.stringify(E.snapshot(G)));
  assert.equal(snap.sheepSaved, 2);
  const H = E.create(14, 'calm', () => 0.5); assert.ok(E.restore(H, snap)); assert.equal(H.sheepSaved, 2);
  const bad = { ...snap, sheepSaved: -1 }; assert.equal(E.restore(E.create(14, 'calm', () => 0.5), bad), false);
  const old = { ...snap }; delete old.sheepSaved;
  const K = E.create(14, 'calm', () => 0.5); assert.ok(E.restore(K, old)); assert.equal(K.sheepSaved, 0);
});

test('天亮時還在路上的、還沒出來的迷羊都算救回', () => {
  const G = setup(['wall']);
  E.dev.stray(G, 1, 5); G.strayQueue = [50, 60]; G.waveT = 0;
  G.holdWaves = false; G.enemies = []; G.queue = []; G.wave = G.waves.length; G.phase = 'rest'; G.timer = 0.01;
  run(G, 0.2);
  assert.ok(G.over && G.result.win, '應該天亮');
  assert.equal(G.sheepSaved, 3);
});
