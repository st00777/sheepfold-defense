'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const D = require('../data.js');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function game(diff = 'storm') {
  const G = E.create(2, diff, () => 0.5);
  G.food = 9999; G.started = true; G.phase = 'wave'; G.wave = 1; G.holdWaves = true;
  G.level = { ...G.level, units: [...G.level.units, 'horn'] };
  return G;
}

test('暴風夜一般與老牧人的實際產糧倒數，序列化續玩不被縮短', () => {
  for (const elder of [false, true]) {
    const G = game();
    assert.ok(E.place(G, 2, 0, 'shepherd').ok);
    if (elder) assert.ok(E.tapUnit(G, 2, 0).ok);
    G.units['2,0'].timer = 0.001;
    E.step(G, 0.01); // 讓實際產糧邏輯決定下一輪間隔
    const snap = JSON.parse(JSON.stringify(E.snapshot(G)));
    const saved = snap.units.find(u => u.type === 'shepherd').t;
    assert.ok(saved > (elder ? 4.2 : 7));
    const resumed = E.create(2, 'storm', () => 0.5);
    assert.ok(E.restore(resumed, snap));
    assert.ok(Math.abs(resumed.units['2,0'].timer - saved) <= 0.05,
      `剩餘 ${saved} 秒應保留，實際 ${resumed.units['2,0'].timer}`);
  }
});

test('吹角手首輪與吹過後的冷卻條全長都能序列化還原', () => {
  for (const [timer, full] of [[5, 6], [19, 20]]) {
    const G = game('calm');
    assert.ok(E.place(G, 2, 1, 'horn').ok);
    Object.assign(G.units['2,1'], { timer, cdLen: full });
    const snap = JSON.parse(JSON.stringify(E.snapshot(G)));
    const resumed = E.create(2, 'calm', () => 0.5);
    assert.ok(E.restore(resumed, snap));
    assert.equal(resumed.units['2,1'].timer, timer);
    assert.equal(resumed.units['2,1'].cdLen, full);
  }
});

test('舊檔沒有冷卻全長時，長於首輪的倒數仍使用完整冷卻條', () => {
  const G = game('calm');
  assert.ok(E.place(G, 2, 1, 'horn').ok);
  G.units['2,1'].timer = 19;
  const snap = JSON.parse(JSON.stringify(E.snapshot(G)));
  for (const u of snap.units) delete u.cdLen;
  const resumed = E.create(2, 'calm', () => 0.5);
  assert.ok(E.restore(resumed, snap));
  assert.equal(resumed.units['2,1'].cdLen, 20);
});

// UI 仍是原生單頁；直接執行實際的存檔訊息函式，儲存服務以記憶體替身提供。
const ui = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
// 期 2 起檢查點分格（cpSlot／cpKey）定義在 loadCheckpoint 前一行：一起抓，但 loadCheckpoint 本體跳過（下面用替身）
const storageCode = ui.slice(ui.indexOf('const cpSlot'), ui.indexOf('function loadCheckpoint(')) + ui.slice(ui.indexOf('function saveCheckpoint('), ui.indexOf('function clearCheckpoint('));
// 2026-10-29 期 0 起檢查點住在 save.js 的單一存檔裡：這裡用同一支 save.js 包住替身儲存，寫入失敗／讀不回來的判斷在 SAVE.save()
const Save = require('../save.js');
function storageContext(storage, cp) {
  const st = { get: k => (storage.getItem ? storage.getItem(k) : null), set: (k, v) => storage.setItem(k, v), remove: () => {}, keys: () => [] };
  const SAVE = Save.open(st, { check: E.checkSnapshot });
  const ctx = { SAVE, SD: SAVE.data, loadCheckpoint: () => cp, level: { id: 2 }, trial: null, Engine: E, DIFFS: D.DIFFS, validCp: c => !!c && E.checkSnapshot(c, 2) };
  vm.createContext(ctx); vm.runInContext(storageCode, ctx); return ctx;
}
test('沒有有效檢查點時，不承諾可以續玩', () => {
  for (const cp of [null, {}, { levelId: 2, diff: 'broken' }]) {
    assert.match(storageContext({}, cp).checkpointNote(), /沒有可用的檢查點/);
  }
  const G = game('calm'), cp = E.snapshot(G);
  assert.match(storageContext({}, cp).checkpointNote(), /第 2 波繼續/);
});
test('儲存被拒絕或無法讀回時會回傳失敗，不誤報保存成功', () => {
  const cp = E.snapshot(game('calm'));
  const denied = storageContext({ setItem() { throw Error('quota'); } }, null);
  assert.equal(denied.saveCheckpoint(cp), false);
  const missing = storageContext({ setItem() {}, getItem() { return null; } }, null);
  assert.equal(missing.saveCheckpoint(cp), false);
  const values = new Map();
  const ok = storageContext({ setItem(k, v) { values.set(k, v); }, getItem(k) { return values.get(k); } }, cp);
  assert.equal(ok.saveCheckpoint(cp), true);
});
