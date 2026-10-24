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
  // 第二章補夜＋看門的（2026-10-18）
  { ref: '詩 119:176', code: 'PSA', ch: 119, text: '我如亡羊走迷了路，求你尋找僕人' },
  { ref: '撒上 17:20', code: '1SA', ch: 17,  text: '將羊交託一個看守的人' },
  { ref: '創 47:3',   code: 'GEN', ch: 47,  text: '你僕人是牧羊的，連我們的祖宗也是牧羊的。' },
  { ref: '約 10:3',   code: 'JHN', ch: 10,  text: '看門的就給他開門' },
  // 2026-10-20 多視角審查改引文
  { ref: '約 10:1',   code: 'JHN', ch: 10,  text: '人進羊圈，不從門進去，倒從別處爬進去，那人就是賊，就是強盜。' },
  { ref: '約 10:12',  code: 'JHN', ch: 10,  text: '若是雇工，不是牧人，羊也不是他自己的，他看見狼來，就撇下羊逃走' },
  { ref: '撒上 17:37', code: '1SA', ch: 17,  text: '耶和華救我脫離獅子和熊的爪，也必救我脫離這非利士人的手。' },
  { ref: '創 29:11',  code: 'GEN', ch: 29,  text: '就放聲而哭' },
  { ref: '摩 3:12',   code: 'AMO', ch: 3,   text: '兩條羊腿或半個耳朵' },
  // 第三章提案（2026-10-24 驗，尚未實作在 data.js）
  { ref: '傳 3:5', code: 'ECC', ch: 3, text: '拋擲石頭有時' },
  { ref: '傳 3:5', code: 'ECC', ch: 3, text: '堆聚石頭有時' },
  { ref: '傳 3:5（outroWin 連句）', code: 'ECC', ch: 3, text: '拋擲石頭有時，堆聚石頭有時；' },
  { ref: '結 19:8', code: 'EZK', ch: 19, text: '捉在他們的坑中' },
  { ref: '創 21:14', code: 'GEN', ch: 21, text: '一皮袋水' },
  { ref: '代下 26:15', code: '2CH', ch: 26, text: '使巧匠做機器' },
  { ref: '代下 26:15（outroWin）', code: '2CH', ch: 26, text: '又在耶路撒冷使巧匠做機器，安在城樓和角樓上，用以射箭發石。' },
  { ref: '路 10:30', code: 'LUK', ch: 10, text: '落在強盜手中' },
  { ref: '伯 39:27', code: 'JOB', ch: 39, text: '大鷹上騰在高處搭窩' },
  { ref: '詩 22:12', code: 'PSA', ch: 22, text: '巴珊大力的公牛' },
  { ref: '詩 22:21 野牛的角', code: 'PSA', ch: 22, text: '野牛的角' },
  { ref: '詩 22:21（outroWin）', code: 'PSA', ch: 22, text: '救我脫離獅子的口；你已經應允我，使我脫離野牛的角。' },
  { ref: '創 31:23', code: 'GEN', ch: 31, text: '追了七日' },
  { ref: '創 31:44', code: 'GEN', ch: 31, text: '你我二人可以立約，作你我中間的證據。' },
  { ref: '撒上 24:2', code: '1SA', ch: 24, text: '野羊的磐石' },
  { ref: '結 34:6', code: 'EZK', ch: 34, text: '我的羊在諸山間、在各高岡上流離，在全地上分散，無人去尋，無人去找。' },
  { ref: '結 34:13', code: 'EZK', ch: 34, text: '我必從萬民中領出牠們，從各國內聚集牠們，引導牠們歸回故土，也必在以色列山上' },
  { ref: '撒上 25:18', code: '1SA', ch: 25, text: '二百餅，兩皮袋酒，五隻收拾好了的羊，五細亞烘好了的穗子' },
  { ref: '結 34:13 後半', code: 'EZK', ch: 34, text: '牧養牠們。' },
  { ref: '撒上 25:25', code: '1SA', ch: 25, text: '我主不要理這壞人拿八，他的性情與他的名相稱；' },
  { ref: '創 37:14', code: 'GEN', ch: 37, text: '看看你哥哥們平安不平安，群羊平安不平安' },
  { ref: '創 37:16-17', code: 'GEN', ch: 37, text: '我找我的哥哥們，求你告訴我，他們在何處放羊。那人說：他們已經走了，我聽見他們說要往多坍去。' },
  { ref: '撒上 16:11', code: '1SA', ch: 16, text: '還有個小的，現在放羊。' },
  { ref: '撒上 16:19', code: '1SA', ch: 16, text: '請你打發你放羊的兒子大衛到我這裡來' },
  { ref: '太 18:12-13', code: 'MAT', ch: 18, text: '一個人若有一百隻羊，一隻走迷了路，你們的意思如何？他豈不撇下這九十九隻，往山裏去找那隻迷路的羊嗎？若是找著了，我實在告訴你們，他為這一隻羊歡喜，比為那沒有迷路的九十九隻歡喜還大呢！' },
  { ref: '太 18:12', code: 'MAT', ch: 18, text: '他豈不撇下這九十九隻，往山裏去找那隻迷路的羊嗎？' },
  { ref: '詩 121:1-2', code: 'PSA', ch: 121, text: '我要向山舉目；我的幫助從何而來？我的幫助從造天地的耶和華而來。' },
  { ref: '詩 121:3-4', code: 'PSA', ch: 121, text: '他必不叫你的腳搖動；保護你的必不打盹！保護以色列的，也不打盹也不睡覺。' },
  { ref: '詩 121:5-6', code: 'PSA', ch: 121, text: '保護你的是耶和華；耶和華在你右邊蔭庇你。白日，太陽必不傷你；夜間，月亮必不害你。' },
  { ref: '詩 121:7-8', code: 'PSA', ch: 121, text: '耶和華要保護你，免受一切的災害；他要保護你的性命。你出你入，耶和華要保護你，從今時直到永遠。' },
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
