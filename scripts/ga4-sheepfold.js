// scripts/ga4-sheepfold.js ── 羊圈守夜的玩家數據（GA4 Data API，直接打 REST，不裝 SDK）
//
// 用法：node scripts/ga4-sheepfold.js [天數]      預設 14 天（本期）＋六週週別表
//      node scripts/ga4-sheepfold.js 30
//
// 認證：沿用靈修冒險的 service account 金鑰（Bible-game/ga4-key.json，屬性檢視者＋analytics.readonly）。
//   金鑰不複製進這個公開 repo；路徑可用環境變數 GA4_KEY 蓋掉。
// 口徑：
//   ・只算正式站：hostName = st00777.github.io 且 pagePath 以 /sheepfold-defense 開頭。
//     githack 測試站、本機 127.0.0.1 都是 James 與 CC 在測，一律排除（最後一區會印排除掉多少）。
//   ・兩款遊戲共用同一個 GA4 資源（property 534159832），靠 pagePath 分開，不靠事件名。
//   ・自訂維度（夜數／結果／星數／卡片…）2026-11-02 才在 GA 後台登記，之前的局只有事件計數，沒有夜數與輸贏。
//   ・人數是 GA 的 totalUsers（同一支手機換瀏覽器會算兩個人），當趨勢看，不當精確值。

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROPERTY_ID = '534159832';
const KEY_PATH = process.env.GA4_KEY || path.join(__dirname, '..', '..', 'Bible-game', 'ga4-key.json');
const DATA_API = `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`;
const PROD_HOST = 'st00777.github.io';
const PROD_PATH = '/sheepfold-defense';
const CUSTOM_DIMS_SINCE = '2026-11-02'; // 自訂維度登記日，之前的資料沒有夜數／輸贏

const DATA = require(path.join(__dirname, '..', 'data.js')); // 卡片、關卡、試煉、成就的名字
const DAYS = Math.max(1, parseInt(process.argv[2] || '14', 10) || 14);

// ── 認證：用 SA 金鑰簽 JWT 換 access token ──
const b64url = s => Buffer.from(s).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
async function getAccessToken() {
  if (!fs.existsSync(KEY_PATH)) throw new Error(`找不到 service account 金鑰：${KEY_PATH}（在 Bible-game 本機才有；或設環境變數 GA4_KEY）`);
  const key = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const input = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64url(JSON.stringify({
    iss: key.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const signer = crypto.createSign('RSA-SHA256'); signer.update(input); signer.end();
  const jwt = input + '.' + b64url(signer.sign(key.private_key));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt,
  });
  const j = await res.json();
  if (!j.access_token) throw new Error('換 token 失敗：' + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}

// ── 查詢小工具 ──
let TOKEN = '';
const f = (fieldName, value, matchType = 'EXACT') => ({ filter: { fieldName, stringFilter: { matchType, value } } });
const PROD = [f('hostName', PROD_HOST), f('pagePath', PROD_PATH, 'BEGINS_WITH')];
const and = (...exprs) => ({ andGroup: { expressions: exprs } });
const dims = (...names) => names.map(name => ({ name }));
const mets = (...names) => names.map(name => ({ name }));

async function report(body) {
  const res = await fetch(DATA_API, { method: 'POST', headers: { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await res.json();
  if (j.error) throw new Error((j.error.message || JSON.stringify(j.error)).slice(0, 300));
  return (j.rows || []).map(r => ({ d: (r.dimensionValues || []).map(x => x.value), m: (r.metricValues || []).map(x => Number(x.value)) }));
}
// 本期（最近 DAYS 天）＋ 正式站 ＋ 額外條件
function q(dimNames, metNames, extra = [], opts = {}) {
  return report({
    dateRanges: [{ startDate: opts.start || `${DAYS - 1}daysAgo`, endDate: opts.end || 'today' }],
    dimensions: dims(...dimNames), metrics: mets(...metNames),
    dimensionFilter: and(...PROD, ...extra), limit: opts.limit || 500,
  });
}
const sum = (rows, i = 0) => rows.reduce((a, r) => a + r.m[i], 0);
const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '–';
const pad = (s, n) => { s = String(s); const w = [...s].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 2 : 1), 0); return s + ' '.repeat(Math.max(0, n - w)); };
const line = (...cells) => console.log(cells.map((c, i) => pad(c, i === 0 ? 14 : 8)).join(''));
const nightName = n => { const lv = DATA.LEVELS[n - 1]; return lv ? lv.name : '?'; };
const cardName = id => (DATA.UNITS[id] && DATA.UNITS[id].name) || id;
const trialName = id => { const t = DATA.TRIALS.find(x => x.id === id); return t ? t.title : id; };
const achName = id => { const a = DATA.ACHIEVEMENTS.find(x => x.id === id); return a ? a.name : id; };
const isoWeekLabel = w => w ? `${w.slice(0, 4)}W${w.slice(4)}` : '?';

// ── 七個區塊 ──
async function block1_people() {
  console.log(`\n① 有多少人在玩（正式站，最近 ${DAYS} 天）`);
  const all = await q([], ['totalUsers', 'newUsers', 'sessions']);
  const played = await q([], ['totalUsers', 'eventCount'], [f('eventName', 'night_end')]);
  const u = all[0] ? all[0].m : [0, 0, 0];
  const p = played[0] ? played[0].m : [0, 0];
  console.log(`  開過遊戲 ${u[0]} 人（新面孔 ${u[1]}、之前來過 ${u[0] - u[1]}），${u[2]} 次進站；至少打完一夜 ${p[0]} 人，共 ${p[1]} 局`);
  console.log('  週別（ISO 週，最近六週）：');
  const wk = await report({
    dateRanges: [{ startDate: '41daysAgo', endDate: 'today' }], dimensions: dims('isoYearIsoWeek'),
    metrics: mets('totalUsers', 'newUsers'), dimensionFilter: and(...PROD), orderBys: [{ dimension: { dimensionName: 'isoYearIsoWeek' } }],
  });
  const wkPlayed = await report({
    dateRanges: [{ startDate: '41daysAgo', endDate: 'today' }], dimensions: dims('isoYearIsoWeek'),
    metrics: mets('totalUsers', 'eventCount'), dimensionFilter: and(...PROD, f('eventName', 'night_end')),
  });
  const pm = Object.fromEntries(wkPlayed.map(r => [r.d[0], r.m]));
  line('  週', '開過', '新面孔', '打過夜', '局數');
  for (const r of wk) line('  ' + isoWeekLabel(r.d[0]), r.m[0], r.m[1], (pm[r.d[0]] || [0, 0])[0], (pm[r.d[0]] || [0, 0])[1]);
}

async function block2_3_nights() {
  console.log(`\n② 玩家走到哪 ＆ ③ 哪一夜太難（故事模式，只有 ${CUSTOM_DIMS_SINCE} 起的局有夜數）`);
  const rows = await q(['customEvent:night', 'customEvent:result'], ['eventCount', 'totalUsers', 'customEvent:sheep_lost', 'customEvent:wave', 'customEvent:seconds'],
    [f('eventName', 'night_end'), f('customEvent:mode', 'story')]);
  const stars = await q(['customEvent:night', 'customEvent:stars'], ['eventCount'], [f('eventName', 'night_end'), f('customEvent:mode', 'story')]);
  const byNight = {};
  for (const r of rows) {
    const n = r.d[0]; if (n === '(not set)') continue;
    const o = byNight[n] || (byNight[n] = { plays: 0, users: 0, win: 0, lose: 0, quit: 0, lost: 0, loseWave: 0, sec: 0 });
    o.plays += r.m[0]; o.users = Math.max(o.users, r.m[1]); o.lost += r.m[2]; o.sec += r.m[4];
    // 結果三種：win 守住、lose 羊被叼光／牧人倒下、quit 中途按重來或回關卡。放棄要分開算：準備階段放棄 wave 是 0，混進「輸在波」會把平均拉到 0
    if (r.d[1] === 'win') o.win += r.m[0]; else if (r.d[1] === 'quit') o.quit += r.m[0]; else { o.lose += r.m[0]; o.loseWave += r.m[3]; }
  }
  for (const r of stars) { const n = r.d[0]; if (byNight[n]) { byNight[n].starSum = (byNight[n].starSum || 0) + Number(r.d[1]) * r.m[0]; } }
  const nights = Object.keys(byNight).map(Number).sort((a, b) => a - b);
  if (!nights.length) { console.log('  （還沒有帶夜數的局；自訂維度登記後的新局才會出現）'); return; }
  line('  夜', '人', '局', '守住', '輸', '放棄', '平均星', '均失羊', '輸在波', '均秒');
  for (const n of nights) {
    const o = byNight[n];
    line(`  ${n} ${nightName(n)}`.slice(0, 14), o.users, o.plays, o.win, o.lose, o.quit, ((o.starSum || 0) / o.plays).toFixed(1),
      (o.lost / o.plays).toFixed(1), o.lose ? (o.loseWave / o.lose).toFixed(1) : '–', Math.round(o.sec / o.plays));
  }
  const far = nights[nights.length - 1];
  const hard = nights.filter(n => byNight[n].plays >= 3).sort((a, b) => (byNight[b].lose / byNight[b].plays) - (byNight[a].lose / byNight[a].plays))[0];
  console.log(`  最遠有人打到第 ${far} 夜（${nightName(far)}）` + (hard ? `；輸最多的是第 ${hard} 夜 ${nightName(hard)}（${pct(byNight[hard].lose, byNight[hard].plays)} 輸，${byNight[hard].plays} 局）` : ''));
}

async function block4_content() {
  console.log('\n④ 內容有沒有人碰');
  const ev = await q(['eventName'], ['eventCount', 'totalUsers'], [{ filter: { fieldName: 'eventName', inListFilter: { values: ['open_trials', 'open_codex', 'achievement'] } } }]);
  const em = Object.fromEntries(ev.map(r => [r.d[0], r.m]));
  const g = k => em[k] || [0, 0];
  console.log(`  試煉冊開了 ${g('open_trials')[0]} 次（${g('open_trials')[1]} 人）；圖鑑開了 ${g('open_codex')[0]} 次（${g('open_codex')[1]} 人）；成就解鎖 ${g('achievement')[0]} 次（${g('achievement')[1]} 人）`);
  const trials = await q(['customEvent:trial_id', 'customEvent:result'], ['eventCount', 'totalUsers'], [f('eventName', 'night_end'), f('customEvent:mode', 'trial')]);
  const t = {}; for (const r of trials) { if (r.d[0] === '(not set)') continue; const o = t[r.d[0]] || (t[r.d[0]] = { plays: 0, win: 0 }); o.plays += r.m[0]; if (r.d[1] === 'win') o.win += r.m[0]; }
  const ids = Object.keys(t);
  console.log(`  試煉打過 ${ids.length}／${DATA.TRIALS.length} 題` + (ids.length ? '：' + ids.map(id => `${trialName(id)} ${t[id].win}/${t[id].plays}`).join('、') : ''));
  const from = await q(['customEvent:from'], ['eventCount'], [f('eventName', 'open_codex')]);
  if (from.length) console.log('  圖鑑從哪進：' + from.map(r => `${r.d[0]} ${r.m[0]}`).join('、'));
  const ach = await q(['customEvent:ids'], ['eventCount'], [f('eventName', 'achievement')]);
  if (ach.length) console.log('  解鎖的成就：' + ach.flatMap(r => r.d[0].split(',')).filter(x => x && x !== '(not set)').map(achName).join('、'));
}

async function block5_cards() {
  console.log('\n⑤ 卡片用量（card_used，每夜每張卡放了幾次；按放置總次數排）');
  const rows = await q(['customEvent:card'], ['customEvent:count', 'eventCount', 'totalUsers'], [f('eventName', 'card_used')]);
  const list = rows.filter(r => r.d[0] !== '(not set)').sort((a, b) => b.m[0] - a.m[0]);
  if (!list.length) { console.log('  （還沒有帶卡片名的資料）'); return; }
  console.log('  ' + list.map(r => `${cardName(r.d[0])} ${r.m[0]}`).join('、'));
  const used = new Set(list.map(r => r.d[0]));
  const never = Object.keys(DATA.UNITS).filter(id => !used.has(id)).map(cardName);
  if (never.length) console.log('  本期沒人放過：' + never.join('、'));
}

async function block6_health() {
  console.log('\n⑥ 技術健康');
  const ver = await q(['customEvent:ver'], ['totalUsers', 'eventCount'], [f('eventName', 'night_start')]);
  if (ver.length) console.log('  版本：' + ver.sort((a, b) => b.d[0].localeCompare(a.d[0])).map(r => `${r.d[0]} ${r.m[0]} 人`).join('、'));
  const dev = await q(['deviceCategory', 'operatingSystem'], ['totalUsers']);
  console.log('  裝置：' + dev.sort((a, b) => b.m[0] - a.m[0]).map(r => `${r.d[0]}/${r.d[1]} ${r.m[0]} 人`).join('、'));
  const se = await q(['eventName'], ['eventCount'], [{ filter: { fieldName: 'eventName', inListFilter: { values: ['night_start', 'night_end'] } } }]);
  const sm = Object.fromEntries(se.map(r => [r.d[0], r.m[0]]));
  const ns = sm.night_start || 0, ne = sm.night_end || 0;
  const resumed = await q(['customEvent:resumed'], ['eventCount'], [f('eventName', 'night_start')]);
  const rm = Object.fromEntries(resumed.map(r => [r.d[0], r.m[0]]));
  console.log(`  開了 ${ns} 夜、打完 ${ne} 夜，${Math.max(0, ns - ne)} 局開了沒打完；續玩的局 ${rm['1'] || 0}、從頭開的 ${rm['0'] || 0}`);
}

async function block7_scope() {
  console.log('\n⑦ 口徑');
  const hosts = await report({
    dateRanges: [{ startDate: `${DAYS - 1}daysAgo`, endDate: 'today' }], dimensions: dims('hostName'),
    metrics: mets('eventCount', 'totalUsers'), dimensionFilter: f('eventName', 'night_end'), // night_end 只有羊圈守夜會送，本機 127.0.0.1 的路徑沒有 sheepfold 字樣，所以不用 pagePath 篩
  });
  const prodRow = hosts.find(r => r.d[0] === PROD_HOST);
  const other = hosts.filter(r => r.d[0] !== PROD_HOST);
  console.log(`  排除掉的測試局：${other.map(r => `${r.d[0]} ${r.m[0]} 局`).join('、') || '無'}（正式站 ${prodRow ? prodRow.m[0] : 0} 局）`);
  console.log(`  夜數／輸贏／星數／卡片等自訂維度自 ${CUSTOM_DIMS_SINCE} 起才有；之前的局只有事件計數。`);
  console.log('  事件或參數改名要記在 docs/data-insights.md 的「口徑變更」。');
}

(async () => {
  TOKEN = await getAccessToken();
  console.log(`📊 羊圈守夜 玩家數據（正式站 ${PROD_HOST}${PROD_PATH}，最近 ${DAYS} 天，${new Date().toISOString().slice(0, 10)}）`);
  const blocks = [block1_people, block2_3_nights, block4_content, block5_cards, block6_health, block7_scope];
  for (const b of blocks) { try { await b(); } catch (e) { console.log(`  ⚠️ ${b.name} 失敗：${e.message}`); } }
})().catch(e => { console.error('❌', e.message); process.exit(1); });
