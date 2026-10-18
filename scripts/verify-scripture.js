// 經文引文逐字驗：正本＝hkbs CUNP1（新標點和合本神版），頁面必須含「CUNP1|新標點和合本」標記，HTTP 200 不算數。
// 用法：node scripts/verify-scripture.js            驗 QUOTES 全部
//       node scripts/verify-scripture.js --dump 1SA 25   印出那一章原文
// 比對規則：去空白與引號、裡／裏視為相同、節號數字忽略；引文要是原文的連續片段（可跨節，不可跨章）。
'use strict';

// 遊戲裡引號內、或標了出處的句子都列在這裡（第二章；第一章之前已驗過的不重列）
const QUOTES = [
  { ref: '出 2:20',   code: 'EXO', ch: 2,  text: '那個人在哪裏？你們為甚麼撇下他呢？你們去請他來吃飯。' },
  { ref: '創 29:11',  code: 'GEN', ch: 29, text: '放聲而哭' },
  { ref: '撒上 25:16', code: '1SA', ch: 25, text: '他們晝夜作我們的保障。' },
  { ref: '撒上 25:15', code: '1SA', ch: 25, text: '未曾失落甚麼' },
  { ref: '創 31:7',   code: 'GEN', ch: 31, text: '十次改了我的工價' },
  { ref: '創 26:22',  code: 'GEN', ch: 26, text: '耶和華現在給我們寬闊之地' },
  { ref: '創 13:7',   code: 'GEN', ch: 13, text: '亞伯蘭的牧人和羅得的牧人相爭' },
  { ref: '創 13:9',   code: 'GEN', ch: 13, text: '你向左，我就向右；你向右，我就向左。' },
  { ref: '約 10:16',  code: 'JHN', ch: 10, text: '我另外有羊，不是這圈裡的；我必須領他們來，他們也要聽我的聲音，並且要合成一群，歸一個牧人了。' },
  { ref: '路 15:4',   code: 'LUK', ch: 15, text: '不把這九十九隻撇在曠野、去找那失去的羊，直到找著呢？' },
  { ref: '路 15:5-6', code: 'LUK', ch: 15, text: '找著了，就歡歡喜喜地扛在肩上，回到家裡，就請朋友鄰舍來，對他們說：『我失去的羊已經找著了，你們和我一同歡喜吧！』' },
  { ref: '賽 40:11',  code: 'ISA', ch: 40, text: '他必像牧人牧養自己的羊群，用膀臂聚集羊羔抱在懷中，慢慢引導那乳養小羊的。' },
  { ref: '詩 23:4',   code: 'PSA', ch: 23, text: '你的杖，你的竿，都安慰我。' },
  { ref: '箴 31:18',  code: 'PRO', ch: 31, text: '她的燈終夜不滅' },
  { ref: '代上 12:2', code: '1CH', ch: 12, text: '能用左右兩手甩石射箭' },
  { ref: '民 10:2',   code: 'NUM', ch: 10, text: '你要用銀子做兩枝號' },
  { ref: '耶 5:6',    code: 'JER', ch: 5,  text: '晚上的豺狼必滅絕他們；豹子要在城外窺伺他們' },
  { ref: '詩 80:13',  code: 'PSA', ch: 80, text: '林中出來的野豬把它糟踏' },
  { ref: '詩 102:6',  code: 'PSA', ch: 102, text: '荒場的鴞鳥' },
  // 第一章補夜（2026-10-18）
  { ref: '創 30:30',  code: 'GEN', ch: 30, text: '我未來之先，你所有的很少，現今卻發大眾多' },
  { ref: '歌 2:15',   code: 'SNG', ch: 2,  text: '要給我們擒拿狐狸，就是毀壞葡萄園的小狐狸，因為我們的葡萄正在開花。' },
  { ref: '代下 26:10', code: '2CH', ch: 26, text: '又在曠野與高原和平原，建築望樓，挖了許多井，因他的牲畜甚多' },
];

async function fetchChapter(code, ch) {
  const url = `https://rcuv.hkbs.org.hk/CUNP1/${code}/${ch}/`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const html = await res.text();
  if (!html.includes('CUNP1') || !html.includes('新標點和合本')) throw new Error(`頁面缺 CUNP1 標記（HTTP 200 不算數）: ${url}`);
  return html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ');
}
const norm = t => t.replace(/裡/g, '裏').replace(/[\n\s「」『』]/g, '');
const normSource = t => norm(t).replace(/\d+/g, '');

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--dump') { console.log(await fetchChapter(args[1], Number(args[2]))); return; }
  const cache = new Map(); const bad = [];
  for (const q of QUOTES) {
    const k = q.code + '/' + q.ch;
    if (!cache.has(k)) { try { cache.set(k, normSource(await fetchChapter(q.code, q.ch))); } catch (e) { bad.push(`${q.ref}：${e.message}`); cache.set(k, null); continue; } }
    const src = cache.get(k); if (!src) { bad.push(`${q.ref}：章節抓不到`); continue; }
    const frag = norm(q.text).replace(/\d+/g, '');
    if (src.includes(frag)) console.log(`  ✔ ${q.ref}`); else { console.log(`  ✘ ${q.ref}`); bad.push(`${q.ref}：與 CUNP1 原文不符 →「${q.text}」`); }
  }
  if (bad.length) { console.log('\n有出入：'); for (const b of bad) console.log('  - ' + b); process.exit(1); }
  console.log(`\n全部 ${QUOTES.length} 條與 CUNP1 一致`);
}
main().catch(e => { console.error(e); process.exit(2); });
