// 試煉冊勝率掃描（新期 2，2026-10-31）：每一題用模擬器的每一套打法各跑 N 局，印一張表；烈火題可順便掃開局糧
// 用法：node sim/trials-scan.js [題 id,題 id|all|w|f] [局數=30]
//   SCAN_FOOD=400,600,800   烈火題（或任何一筆糧的題）額外用這幾個開局糧各跑一遍（只跑最強的那套打法），找「旋鈕」該轉到哪
//   SCAN_STRATS=good,line   只跑這幾套（預設全部）
// 讀法：某套打法 0% 不代表無解，只代表那套規則不會打；要看「最強的那套」落在哪一格。守望目標：最強打法 30–70%；烈火目標：定好的糧數下最強打法 30–60%
'use strict';
const path = require('path');
const D = require(path.join(__dirname, '..', 'data.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));
const SIM = require(path.join(__dirname, 'simulate.js'));

const [,, WHICH = 'all', N = '30'] = process.argv;
const n = Number(N);
const strats = (process.env.SCAN_STRATS || Object.keys(SIM.STRATS).join(',')).split(',').filter(k => SIM.STRATS[k]);
const pick = WHICH === 'all' ? D.TRIALS : WHICH === 'w' || WHICH === 'f' ? D.TRIALS.filter(t => t.id[0] === WHICH) : WHICH.split(',').map(id => E.trialById(id)).filter(Boolean);
if (!pick.length) { console.error(`沒有這些題：${WHICH}（有 ${D.TRIALS.map(t => t.id).join(' ')}）`); process.exit(1); }

const bad = E.validateTrials(); if (bad.length) { console.error('試煉資料有問題：\n  ' + bad.join('\n  ')); }

// 一題 × 一套打法 × n 局：勝率、平均撐到幾波、最近幾格
function cell(T, skill, food) {
  const old = process.env.SIM_FOOD; if (food !== undefined) process.env.SIM_FOOD = String(food); else delete process.env.SIM_FOOD;
  const res = []; for (let i = 0; i < n; i++) res.push(SIM.play(T.levelId, T.diff, 1000 + i, skill, T.mods));
  if (old !== undefined) process.env.SIM_FOOD = old; else delete process.env.SIM_FOOD;
  const wins = res.filter(r => r.win).length, avg = f => res.reduce((a, r) => a + f(r), 0) / n;
  return { win: wins / n, wave: avg(r => r.wave), minX: avg(r => r.minX), sheep: avg(r => r.sheepLost) };
}
const pct = x => String(Math.round(x * 100)).padStart(3) + '%';

for (const T of pick) {
  const base = E.levelById(T.levelId), L = E.trialLevel(T);
  const total = L.waves.reduce((a, w) => a + w.list.reduce((m, [, k]) => m + k, 0), 0);
  console.log(`\n${T.id} ${D.TRIAL_KINDS[T.kind].name}「${T.title}」 第 ${E.posOf(base.id)} 夜 ${base.name}  ${L.waves.length} 波共 ${total} 隻  卡 ${L.units.join(' ')}${L.noShepherd ? `  開局糧 ${L.startFood}` : ''}`);
  let best = null;
  for (const k of strats) {
    const c = cell(T, k);
    console.log(`  ${k.padEnd(6)} 勝率 ${pct(c.win)}  平均 ${c.wave.toFixed(2)} 波  最近 ${c.minX.toFixed(2)} 格${base.sheep ? `  失羊 ${c.sheep.toFixed(2)}` : ''}`);
    if (!best || c.win > best.win) best = { k, ...c };
  }
  console.log(`  最強：${best.k} ${pct(best.win)}`);
  if (process.env.SCAN_FOOD && L.noShepherd) {
    const foods = process.env.SCAN_FOOD.split(',').map(Number).filter(Number.isFinite);
    console.log('  掃糧（' + best.k + '）：' + foods.map(f => `${f}→${pct(cell(T, best.k, f).win).trim()}`).join('  '));
  }
}
