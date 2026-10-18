// 勝率模擬：node sim/simulate.js [關 1-14|all] [難度 calm|windy|storm|all] [局數] [玩家 good|basic]
// good＝會依敵人換新工具的玩家；basic＝只用牧人／投石手／石牆的玩家（驗證新敵人是否真的逼出新工具）
// 環境變數：SIM_BAN=卡,卡（隊伍裡拿掉）SIM_ADD=卡,卡（硬塞進隊伍，滿了擠掉名單最後一張）SIM_CRADLE_COL=格（抱羊羔的牧人放第幾格，預設 2）SIM_SHOW=1（印出隊伍）
'use strict';
const path = require('path');
const D = require(path.join(__dirname, '..', 'data.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));
const { ROWS, COLS, UNITS, ENEMIES, LEVELS, MAX_CARDS } = D;

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const BIG = Object.keys(D.ENEMIES).filter(k => D.ENEMIES[k].boss); // 頭目由 data.js 的 boss 標記決定
const key = (r, c) => r + ',' + c;

// 在那一排找一格空的，從 want 往外找
function freeCell(G, r, want) {
  for (let d = 0; d < COLS; d++) for (const c of [want + d, want - d]) {
    if (c < 0 || c >= COLS) continue;
    if (!G.units[key(r, c)] && !G.rocks.has(key(r, c))) return c;
  }
  return -1;
}
function has(G, r, pred) { for (let c = 0; c < COLS; c++) { const u = G.units[key(r, c)]; if (u && pred(u, c)) return true; } return false; }
const kindOf = u => UNITS[u.type].kind;
function tryPlace(G, r, c, k) { if (c < 0) return false; if (!G.level.units.includes(k)) return false; return E.place(G, r, c, k).ok; }

function decide(G, skill) {
  if (G.level.conveyor) return decideConveyor(G);
  const allowed = skill === 'basic' ? ['shepherd', 'slinger', 'wall'] : G.level.units;
  const can = k => allowed.includes(k) && G.level.units.includes(k) && G.food >= UNITS[k].cost;
  const count = k => Object.values(G.units).filter(u => u.type === k).length;
  const rowEnemies = r => G.enemies.filter(e => e.r === r && !e.dead);
  const threat = new Set(G.enemies.map(e => e.r)); if (G.nextRow !== null && G.nextVisible) threat.add(G.nextRow); // 無月夜看不見腳印就不能偷看
  for (const s of G.strays) threat.add(s.r);

  // 開局三牧人（James 的打法）
  if (count('shepherd') < (G.diff === 'storm' ? 4 : 3) && can('shepherd')) { for (const r of [2, 1, 3, 0]) if (!has(G, r, u => u.type === 'shepherd') && tryPlace(G, r, freeCell(G, r, 0), 'shepherd')) return; }
  // 第二章：無月夜先點燈（第 1、3 排各一盞就五排全亮）；邊排放牧人杖把狼趕進中間三排
  if (G.level.moonless && can('lamp') && count('lamp') < 2 && G.wave >= 1) { for (const r of [1, 3]) if (!has(G, r, u => u.type === 'lamp') && tryPlace(G, r, freeCell(G, r, 2), 'lamp')) return; }
  if (can('staff') && G.wave >= 1) { for (const r of [0, 4]) if (!has(G, r, u => u.type === 'staff' || kindOf(u) === 'shooter') && tryPlace(G, r, freeCell(G, r, 3), 'staff')) return; }
  // 吹角手升銀號、荊棘以外的升級
  for (const k in G.units) { const u = G.units[k]; if (u.type === 'horn' && !u.upgraded && UNITS.horn.upgrade && E.posOf(G.level.id) >= UNITS.horn.upgrade.from && G.food >= UNITS.horn.upgrade.cost && E.tapUnit(G, u.r, u.c).ok) return; }

  // 纏裹的牧人：糧夠就膏油（範圍 5×5）
  for (const k in G.units) { const u = G.units[k]; if (u.type === 'healer' && !u.upgraded && UNITS.healer.upgrade && E.posOf(G.level.id) >= UNITS.healer.upgrade.from && G.food >= UNITS.healer.upgrade.cost && E.tapUnit(G, u.r, u.c).ok) return; }

  // 修牆（那排已經有射手才修，不然先補射手）
  for (const k in G.units) { const u = G.units[k]; if (kindOf(u) === 'blocker' && u.hp < u.maxHp * 0.4 && G.food >= D.REPAIR_COST && has(G, u.r, v => kindOf(v) === 'shooter') && E.tapUnit(G, u.r, u.c).ok) return; }

  // 瓦瓶：找擠最多的 3x3
  if (can('jar')) {
    let best = null, bn = 2;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const n = G.enemies.filter(e => !e.underground && Math.abs(e.r - r) <= 1 && Math.abs(e.x - c) <= 1.3).length;
      if (n > bn && !G.units[key(r, c)] && !G.rocks.has(key(r, c))) { bn = n; best = [r, c]; }
    }
    if (best) { E.place(G, best[0], best[1], 'jar'); return; }
  }

  // 受威脅的排優先，依最靠近左邊的敵人排序
  const rows = [...threat].sort((a, b) => Math.min(...rowEnemies(a).map(e => e.x), 9) - Math.min(...rowEnemies(b).map(e => e.x), 9));
  for (const r of rows) {
    const es = rowEnemies(r);
    const types = new Set(es.map(e => e.type)); if (G.nextRow === r && G.nextType) types.add(G.nextType);
    // 投石隊顧上下三排：隔壁排有的也算這排有射手
    const volleyNear = [r - 1, r, r + 1].some(rr => rr >= 0 && rr < ROWS && has(G, rr, u => u.type === 'volley'));
    const hasShooter = has(G, r, u => kindOf(u) === 'shooter' && !UNITS[u.type].flees) || volleyNear;
    const hasSling = has(G, r, u => u.type === 'sling');
    const hasDog = has(G, r, u => u.type === 'dog' && !u.resting); // 休息中的狗不算，玩家會再放一隻
    const hasBlock = has(G, r, (u, c) => kindOf(u) === 'blocker' && c >= 3);
    const big = [...types].some(t => BIG.includes(t) || t === 'boar');
    const needArcher = types.has('locust');
    const strayHere = G.strays.some(s => s.r === r);

    if (!hasShooter) {
      if (needArcher && can('archer')) { if (tryPlace(G, r, freeCell(G, r, 1), 'archer')) return; }
      if ((r === 1 || r === 3 || types.has('owl')) && can('volley')) { if (tryPlace(G, r, freeCell(G, r, 1), 'volley')) return; }
      if (big && can('sling')) { if (tryPlace(G, r, freeCell(G, r, 1), 'sling')) return; }
      if (can('slinger')) { if (tryPlace(G, r, freeCell(G, r, 1), 'slinger')) return; }
    }
    if (big && !hasSling && can('sling')) { if (tryPlace(G, r, freeCell(G, r, 2), 'sling')) return; }
    if (!hasDog && can('dog') && (strayHere || (G.level.fresh.includes('dog') && types.has('fast')) || [...types].some(t => ['alpha', 'lion', 'bear', 'fox', 'rustler', 'thief', 'jackal', 'leopard'].includes(t)))) { if (tryPlace(G, r, freeCell(G, r, 3), 'dog')) return; }
    if (strayHere && can('cradle') && !has(G, r, u => u.type === 'cradle')) { if (tryPlace(G, r, freeCell(G, r, Number(process.env.SIM_CRADLE_COL || 2)), 'cradle')) return; }
    if (es.length >= 3 && r >= 1 && r <= 3 && can('patrol') && ![r - 1, r, r + 1].some(rr => has(G, rr, u => u.type === 'patrol'))) { if (tryPlace(G, r, freeCell(G, r, 2), 'patrol')) return; }
    if (needArcher && !has(G, r, u => u.type === 'archer') && can('archer')) { if (tryPlace(G, r, freeCell(G, r, 2), 'archer')) return; }
    if (types.has('digger') && can('thorns')) {
      const dg = es.find(e => e.type === 'digger' && e.underground);
      if (dg && !G.units[key(r, dg.emergeX)] && tryPlace(G, r, dg.emergeX, 'thorns')) return;
    }
    // 荊棘學會撒蠍子就升級
    for (let c = 0; c < COLS; c++) { const u = G.units[key(r, c)]; if (u && u.type === 'thorns' && !u.upgraded && E.posOf(G.level.id) >= UNITS.thorns.upgrade.from && G.food >= UNITS.thorns.upgrade.cost + 50) { E.tapUnit(G, r, c); return; } }
    if (types.has('bear') && can('thorns') && !has(G, r, u => u.type === 'thorns')) { if (tryPlace(G, r, freeCell(G, r, 4), 'thorns')) return; }
    if (es.length >= 4 && can('horn') && !has(G, r, u => u.type === 'horn')) { if (tryPlace(G, r, freeCell(G, r, 2), 'horn')) return; }
    if (es.length >= 4 && can('catapult') && !has(G, r, u => u.type === 'catapult')) { if (tryPlace(G, r, freeCell(G, r, 1), 'catapult')) return; }
    const near = es.some(e => !e.underground && !ENEMIES[e.type].flying && e.x < 5.2);
    if (near && !hasBlock) {
      if ((types.has('thief') || types.has('boar') || types.has('jackal')) && can('tower')) { if (tryPlace(G, r, freeCell(G, r, 4), 'tower')) return; }
      if (can('wall') && !types.has('lion')) { if (tryPlace(G, r, freeCell(G, r, 4), 'wall')) return; }
    }
    if (hasDog && can('healer') && !has(G, r, u => u.type === 'healer')) { const d = Object.values(G.units).find(u => u.type === 'dog' && u.r === r); if (d && d.hp < d.maxHp * 0.6) { if (tryPlace(G, r, freeCell(G, r, d.c - 1), 'healer')) return; } }
  }

  // 有閒糧：火盆、第二射手、更多牧人、升老牧人
  if (G.food >= 200) {
    if (can('brazier')) for (let r = 0; r < ROWS; r++) if (has(G, r, (u, c) => kindOf(u) === 'shooter' && c <= 1) && !has(G, r, u => u.type === 'brazier') && !G.units[key(r, 2)]) { if (tryPlace(G, r, 2, 'brazier')) return; }
    for (const r of [2, 1, 3, 0, 4]) if (!has(G, r, u => kindOf(u) === 'shooter' && !UNITS[u.type].flees) && can('slinger')) { if (tryPlace(G, r, freeCell(G, r, 1), 'slinger')) return; }
    if (count('shepherd') < 5 && can('shepherd')) { for (const r of [0, 4]) if (tryPlace(G, r, freeCell(G, r, 0), 'shepherd')) return; }
    if (G.food >= 250) for (const k in G.units) { const u = G.units[k]; if (u.type === 'shepherd' && !u.elder) { E.tapUnit(G, u.r, u.c); return; } }
    if (G.food >= 300) for (const r of [2, 1, 3, 0, 4]) if (Object.values(G.units).filter(u => u.r === r && kindOf(u) === 'shooter').length < 2 && can('slinger')) { if (tryPlace(G, r, freeCell(G, r, 2), 'slinger')) return; }
  }
}

// 送卡模式：手上有什麼放什麼，放的位置照卡的用途
function decideConveyor(G) {
  const rowEnemies = r => G.enemies.filter(e => e.r === r && !e.dead);
  const rows = [2, 1, 3, 0, 4].sort((a, b) => rowEnemies(b).length - rowEnemies(a).length);
  for (const k of G.hand.slice()) {
    const kind = UNITS[k].kind;
    const put = (r, want) => tryPlace(G, r, freeCell(G, r, want), k);
    if (kind === 'shooter') { for (const r of rows) if (!has(G, r, u => kindOf(u) === 'shooter') && put(r, 1)) return; for (const r of rows) if (Object.values(G.units).filter(u => u.r === r && kindOf(u) === 'shooter').length < 2 && put(r, 2)) return; }
    else if (kind === 'blocker') { for (const r of rows) if (!has(G, r, (u, c) => kindOf(u) === 'blocker' && c >= 3) && has(G, r, u => kindOf(u) === 'shooter') && put(r, 4)) return; }
    else if (kind === 'deflector') { for (const r of [0, 4]) if (!has(G, r, u => u.type === 'staff') && put(r, 3)) return; }
    else if (kind === 'dog') { for (const r of rows) if (!has(G, r, u => u.type === 'dog') && rowEnemies(r).some(e => ['jackal', 'alpha', 'boar'].includes(e.type)) && put(r, 3)) return; }
    else if (kind === 'support' && UNITS[k].light !== undefined) { for (const r of [2, 1, 3]) if (!has(G, r, u => u.type === 'lamp') && put(r, 2)) return; }
    else if (kind === 'floor') { for (const r of rows) if (!has(G, r, u => kindOf(u) === 'floor') && put(r, 4)) return; }
    else if (kind === 'patrol') { for (const r of [2, 1, 3]) if (!has(G, r, u => u.type === 'patrol') && put(r, 2)) return; }
    else if (kind === 'instant') {
      let best = null, bn = 2;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const n = G.enemies.filter(e => !e.underground && Math.abs(e.r - r) <= 1 && Math.abs(e.x - c) <= 1.3).length; if (n > bn && !G.units[key(r, c)]) { bn = n; best = [r, c]; } }
      if (best) { E.place(G, best[0], best[1], k); return; }
    }
  }
  // 手滿了（或還沒開局）還沒地方放：隨便找個空位放，別讓卡卡住
  if (!G.started || G.hand.length >= (G.level.conveyor.max || 6)) { const k = G.hand[0]; if (UNITS[k].kind !== 'instant') for (const r of rows) if (tryPlace(G, r, freeCell(G, r, 1), k)) return; }
}

function play(levelId, diff, seed, skill) {
  const G = E.create(levelId, diff, mulberry32(seed));
  if (!G.level.conveyor) { // 跟玩家一樣只帶 8 張；SIM_BAN=卡,卡 拿掉某幾張、SIM_ADD=卡,卡 硬塞進隊伍（滿了就擠掉名單最後一張）
    let pick = G.level.units.length > MAX_CARDS ? E.defaultPick(G.level) : G.level.units.slice();
    const ban = (process.env.SIM_BAN || '').split(',').filter(Boolean), add = (process.env.SIM_ADD || '').split(',').filter(Boolean);
    pick = pick.filter(k => !ban.includes(k));
    for (const k of add) if (G.level.units.includes(k) && !pick.includes(k)) { pick.push(k); if (pick.length > MAX_CARDS) { const drop = pick.filter(x => x !== 'shepherd' && !add.includes(x)).pop(); if (drop) pick.splice(pick.indexOf(drop), 1); else { pick.pop(); console.warn('SIM_ADD：沒有可擠掉的卡，捨棄 ' + k); } } }
    if ((process.env.SIM_BAN || process.env.SIM_ADD) && (!E.validPick || !E.validPick(G.level, pick))) console.warn('SIM_BAN／SIM_ADD 後的隊伍不合規（少於下限或沒牧人），結果僅供參考：' + pick.join(' '));
    if (seed === 1000 && process.env.SIM_SHOW) console.log('  隊伍：' + pick.join(' '));
    E.applyPick(G, pick);
  }
  const dt = 1 / 30; let acc = 0, minX = COLS;
  while (!G.over && G.time < 900) {
    E.step(G, dt); G.events.length = 0;
    for (const e of G.enemies) if (!e.dead && !e.carrying && !e.underground && e.x < minX) minX = e.x; // 敵人最靠近羊圈到哪（壓力指標，0 就差點輸）
    acc += dt; if (acc >= 0.5) { acc = 0; decide(G, skill); }
  }
  return { win: !!(G.result && G.result.win), wave: G.wave, reason: G.result ? G.result.reason : 'timeout', time: G.time, sheepLost: G.sheepLost, minX };
}

function run(levelId, diff, n, skill) {
  const res = []; for (let i = 0; i < n; i++) res.push(play(levelId, diff, 1000 + i, skill));
  const wins = res.filter(r => r.win).length;
  const reasons = {}; for (const r of res) if (!r.win) reasons[r.reason + '@w' + r.wave] = (reasons[r.reason + '@w' + r.wave] || 0) + 1;
  const avgWave = (res.reduce((a, r) => a + r.wave, 0) / n).toFixed(2);
  const sheep = res.reduce((a, r) => a + r.sheepLost, 0) / n;
  const press = res.reduce((a, r) => a + r.minX, 0) / n; // 平均最近距離：越小越驚險
  console.log(`關 ${levelId} ${D.DIFFS[diff].name} ${skill}：勝率 ${(wins / n * 100).toFixed(0)}%（${n} 局）平均撐到 ${avgWave} 波 最近 ${press.toFixed(2)} 格 ${sheep ? `平均失羊 ${sheep.toFixed(2)} ` : ''}輸法 ${JSON.stringify(reasons)}`);
}

const [,, L = 'all', DF = 'all', N = '100', SK = 'good'] = process.argv;
const levels = L === 'all' ? LEVELS.map(l => l.id) : [Number(L)];
const diffs = DF === 'all' ? Object.keys(D.DIFFS) : [DF];
for (const l of levels) for (const d of diffs) run(l, d, Number(N), SK);
