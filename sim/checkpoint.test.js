// 檢查點存檔／還原的測試：node --test sim/
// 存→轉成 JSON 再讀回→還原→再跑幾秒，不能炸；壞掉的存檔要被擋下
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const D = require(path.join(__dirname, '..', 'data.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));
const { ROWS, COLS, LEVELS, ELDER_MUL, UNITS } = D;

const key = (r, c) => r + ',' + c;
function freeCell(G, r) { for (let c = 0; c < COLS; c++) if (!G.units[key(r, c)] && !G.rocks.has(key(r, c))) return c; throw new Error('no free cell'); }

// 第 2 關（有牧人、投石手、石牆、狗）起風夜，擺好幾個單位、升級牧人、把牆打傷並修補過
function setup() {
  const lv = LEVELS.find(l => l.id === 2); // 用 id 找，插夜後 LEVELS[1] 可能變成別的夜
  const G = E.create(lv.id, 'windy');
  G.food = 999;
  const sc = freeCell(G, 2); assert.ok(E.place(G, 2, sc, 'shepherd').ok);
  assert.ok(E.tapUnit(G, 2, sc).ok, '牧人升級成老牧人');
  const wc = freeCell(G, 2); assert.ok(E.place(G, 2, wc, 'wall').ok);
  const dc = freeCell(G, 1); assert.ok(E.place(G, 1, dc, 'dog').ok);
  G.wave = 2; G.sheepLost = 1; G.seen.add('wolf'); G.time = 40;
  const wall = G.units[key(2, wc)];
  wall.hp = 10; assert.ok(E.tapUnit(G, 2, wc).ok, '修補石牆'); // 會寫 repairAt = 現在 + 8 秒
  return { G, lv, sc, wc, dc };
}

test('snapshot → JSON → restore 把場面接回來', () => {
  const { G, lv, sc, wc, dc } = setup();
  const snap = JSON.parse(JSON.stringify(E.snapshot(G)));
  assert.ok(E.checkSnapshot(snap, lv.id));
  const H = E.create(lv.id, 'windy');
  assert.strictEqual(E.restore(H, snap), true);
  assert.strictEqual(H.units[key(2, sc)].type, 'shepherd');
  assert.strictEqual(H.units[key(2, sc)].elder, true);
  assert.ok(H.units[key(2, sc)].timer <= UNITS.shepherd.every * ELDER_MUL, '老牧人節奏不回新手值');
  assert.strictEqual(H.units[key(2, wc)].type, 'wall');
  assert.strictEqual(H.units[key(2, wc)].hp, Math.round(G.units[key(2, wc)].hp));
  assert.ok(H.units[key(2, wc)].repairAt > H.time, '修補冷卻跟著回來');
  assert.strictEqual(H.units[key(1, dc)].type, 'dog');
  assert.strictEqual(H.food, 999 - UNITS.shepherd.cost - D.ELDER_COST - UNITS.wall.cost - UNITS.dog.cost - D.REPAIR_COST);
  assert.strictEqual(H.wave, 2);
  assert.strictEqual(H.sheepLost, 1);
  assert.ok(H.seen.has('wolf'));
  assert.strictEqual(H.phase, 'rest');
  const killed = H.waves.slice(0, 2).reduce((n, w) => n + w.list.reduce((m, [, k]) => m + k, 0), 0);
  assert.strictEqual(H.killed, killed);
  for (let i = 0; i < 400; i++) E.step(H, 0.05); // 再跑 20 秒：進第 3 波、放狼，不能炸
  assert.strictEqual(H.over, false);
  assert.ok(H.enemies.length + H.killed > killed, '第 3 波的狼有出來');
});

test('存檔不會被壞資料弄炸', () => {
  const { G, lv } = setup();
  const good = JSON.parse(JSON.stringify(E.snapshot(G)));
  const bad = (f) => { const s = JSON.parse(JSON.stringify(good)); f(s); return s; };
  const cases = {
    '座標超出棋盤': bad(s => { s.units[0].r = ROWS; }),
    '座標是負的': bad(s => { s.units[0].c = -1; }),
    '座標不是整數': bad(s => { s.units[0].r = 1.5; }),
    '不存在的單位': bad(s => { s.units[0].type = 'dragon'; }),
    '單位不是物件': bad(s => { s.units[0] = null; }),
    'units 不是陣列': bad(s => { s.units = 'x'; }),
    '糧不是數字': bad(s => { s.food = 'abc'; }),
    '糧是負的': bad(s => { s.food = -5; }),
    '波數是 0': bad(s => { s.wave = 0; }),
    '難度不存在': bad(s => { s.diff = 'hell'; }),
    '別關的存檔': bad(s => { s.levelId = lv.id + 1; }),
    '波數超過這關': bad(s => { s.wave = 99; }),
    '羊數不是整數': bad(s => { s.sheep = 'abc'; }),
    '丟羊數是物件': bad(s => { s.sheepLost = {}; }),
    '見過的敵人不是陣列': bad(s => { s.seen = 'wolf'; }),
    '單位血量不是數字': bad(s => { s.units[0].hp = 'full'; }),
    '單位次數是負的': bad(s => { s.units[0].uses = -1; }),
    '修補冷卻不是數字': bad(s => { s.units[0].cd = 'soon'; }),
  };
  for (const [name, s] of Object.entries(cases)) {
    assert.strictEqual(E.checkSnapshot(s, lv.id), false, name + ' 要被 checkSnapshot 擋下');
    assert.strictEqual(E.restore(E.create(lv.id, 'windy'), s), false, name + ' 要被 restore 擋下');
  }
  for (const junk of [null, undefined, 'x', 42, {}, [], { levelId: lv.id }]) {
    assert.strictEqual(E.checkSnapshot(junk, lv.id), false);
    assert.strictEqual(E.restore(E.create(lv.id, 'windy'), junk), false);
  }
  // 存檔長得對、但難度跟這一局不一樣：不能還原（波次表不同，殺敵數會對不上）
  assert.strictEqual(E.checkSnapshot(good, lv.id), true);
  assert.strictEqual(E.restore(E.create(lv.id, 'storm'), good), false);
});

// 預設隊伍：關卡用 must 指定「提示會教到的卡」一定帶，且不超過上限
test('defaultPick 帶上關卡指定的 must 卡', () => {
  for (const l of LEVELS) {
    const p = E.defaultPick(l);
    assert.ok(p.length <= D.MAX_CARDS && p.includes('shepherd'), `第 ${l.id} 關預設隊伍 ${p.length} 張`);
    for (const k of [...l.fresh, ...(l.must || [])]) assert.ok(p.includes(k), `第 ${l.id} 關預設沒帶 ${k}`);
  }
});
