// 羊圈守夜 · 資料表。加單位、加敵人、加關卡都只改這裡。
// 數值說明：cost 要花的糧；hp 能被咬幾下；every 幾秒做一次事；dmg 一下打多少；speed 每秒走幾格；bite 每秒咬掉多少血。
'use strict';

const ROWS = 5, COLS = 7;

// ====== 我方單位 ======
// kind：producer 產糧／shooter 射手／blocker 牆／dog 牧羊犬／floor 鋪地／instant 一次性／support 輔助
const UNITS = {
  shepherd: { name: '牧人',     ico: '🧑‍🌾', cost: 50,  hp: 60,  kind: 'producer', every: 7,   gives: 25,
              desc: '每隔一陣子送來糧。再點一下升成老牧人，送糧更快', ref: '創 31:40' },
  slinger:  { name: '投石手',   ico: '🪨',   cost: 100, hp: 60,  kind: 'shooter', every: 1.3, dmg: 20, shot: 'stone',
              desc: '朝同一排的狼丟石頭', ref: '士 20:16' },
  wall:     { name: '石牆',     ico: '🧱',   cost: 50,  hp: 300, kind: 'blocker',
              desc: '擋在前面，很耐咬。再點一下花 25 糧修補', ref: '民 32:16' },
  sling:    { name: '機弦手',   ico: '🎯',   cost: 150, hp: 60,  kind: 'shooter', every: 3.2, dmg: 90, shot: 'sling',
              desc: '一發重擊、裝填慢，專打獅子和熊', ref: '撒上 17:40' },
  dog:      { name: '牧羊犬',   ico: '🐕',   cost: 75,  hp: 150, kind: 'dog', dps: 10, run: 1.6,
              desc: '跑過去咬住狼不讓走，狼會先咬牠', ref: '伯 30:1' },
  hireling: { name: '雇工',     ico: '🧍',   cost: 25,  hp: 40,  kind: 'shooter', every: 0.9, dmg: 10, shot: 'stone', range: 2.5, flees: 1.0,
              desc: '便宜會打，但狼一靠近就逃走', ref: '約 10:12' },
  tower:    { name: '守望樓',   ico: '🗼',   cost: 125, hp: 600, kind: 'blocker', tall: true,
              desc: '又高又厚，賊翻不過去', ref: '賽 5:2' },
  archer:   { name: '弓箭手',   ico: '🏹',   cost: 125, hp: 60,  kind: 'shooter', every: 1.8, dmg: 26, shot: 'arrow', pierce: true, falloff: 0.8,
              desc: '一箭穿過整排，每穿一隻傷害變小', ref: '創 21:20' },
  scorpion: { name: '蠍窩',     ico: '🦂',   cost: 50,  hp: 1,   kind: 'floor', uses: 5, poison: 8,
              desc: '鋪在地上，踩過的狼中毒，五次用完', ref: '申 8:15' },
  thorns:   { name: '荊棘',     ico: '🌿',   cost: 75,  hp: 150, kind: 'floor', slow: 0.5, dps: 6, wear: 10,
              desc: '鋪在地上，踩上的狼變慢又掉血，會被踩爛', ref: '何 2:6' },
  brazier:  { name: '火盆',     ico: '🔥',   cost: 75,  hp: 100, kind: 'support', ignite: true,
              desc: '石子箭矢穿過它會變火，燒著的狼會把火傳給隔壁', ref: '路 2:8' },
  jar:      { name: '瓦瓶火把', ico: '🏺',   cost: 100, hp: 0,   kind: 'instant', dmg: 30, panic: 2.5,
              desc: '一次性。打破的地方周圍九格的狼受傷並嚇得往回跑', ref: '士 7:19' },
  horn:     { name: '吹角手',   ico: '📯',   cost: 100, hp: 60,  kind: 'support', every: 20, push: 1, stun: 2,
              desc: '每 20 秒吹一次，同一排的狼全部退一格並愣住', ref: '民 10:9' },
  healer:   { name: '纏裹的牧人', ico: '🩹', cost: 100, hp: 60,  kind: 'support', every: 1, heal: 5,
              desc: '不攻擊，讓周圍八格的夥伴慢慢回血', ref: '結 34:16' },
  catapult: { name: '投石機',   ico: '🛞',   cost: 200, hp: 80,  kind: 'shooter', every: 4, dmg: 45, shot: 'lob', splash: 1.2,
              desc: '拋到同一排最遠的狼，落點附近一起掉血', ref: '代下 26:15' },
};
const ELDER_MUL = 0.6;    // 老牧人送糧間隔倍數
const ELDER_COST = 75;
const REPAIR_COST = 25, REPAIR_HP = 120, REPAIR_CD = 8; // 修補一次要隔 8 秒，不能一直點

// ====== 敵人 ======
// 特殊欄位：flying 飛的／dodge 閃避率／digs 鑽地／vaults 翻牆／steals 偷羊／enrage 狂暴／howl 嚎叫秒數／roar 咆哮秒數
// thick 厚皮：石子和箭只打四成，機弦、投石機、火、毒全額（所以「石子打不痛牠」）；prio 狗優先咬誰（越大越先）
const ENEMIES = {
  wolf:    { name: '狼',     ico: '🐺', hp: 60,  speed: 0.22, bite: 12 },
  fast:    { name: '快狼',   ico: '🐺', hp: 40,  speed: 0.40, bite: 10, cls: 'fast' },
  alpha:   { name: '領頭狼', ico: '🐺', hp: 200, speed: 0.20, bite: 15, cls: 'alpha', howl: 8, prio: 4,
             tip: '領頭狼一嚎叫，附近的狼就衝。叫狗咬住牠' },
  bear:    { name: '母熊',   ico: '🐻', hp: 420, speed: 0.15, bite: 25, cls: 'big', enrage: 0.5, thick: true, prio: 2,
             tip: '熊血厚，石子打不痛牠，換機弦手。血剩一半會狂暴' },
  lion:    { name: '獅子',   ico: '🦁', hp: 600, speed: 0.15, bite: 30, cls: 'big', roar: 12, wallMul: 4, thick: true, prio: 2,
             tip: '獅子一吼附近的人都停手，石牆一口就碎。狗拖住，機弦集火' },
  thief:   { name: '賊',     ico: '🥷', hp: 70,  speed: 0.25, bite: 10, cls: 'human', vaults: true, prio: 3,
             tip: '賊會翻過石牆，守望樓才擋得住' },
  rustler: { name: '偷羊人', ico: '🧔', hp: 90,  speed: 0.30, bite: 4,  cls: 'human', steals: true, fleeSpeed: 0.45, prio: 5,
             tip: '偷羊人不咬人，走到底就抱羊跑。追上牠羊就回來' },
  fox:     { name: '小狐狸', ico: '🦊', hp: 30,  speed: 0.35, bite: 6,  cls: 'small', dodge: 0.7, prio: 3,
             tip: '小狐狸會閃石子，狗、荊棘、蠍窩抓得到' },
  locust:  { name: '蝗群',   ico: '🦗', hp: 8,   speed: 0.30, bite: 2,  cls: 'small',
             tip: '蝗蟲一隊一隊來，一箭可以穿好幾隻' },
  digger:  { name: '野狗',   ico: '🐕‍🦺', hp: 80, speed: 0.22, bite: 12, cls: 'dig', digs: true, digSpeed: 0.35,
             tip: '野狗從地底鑽到中間才冒出來，前排的牆擋不到' },
  bird:    { name: '鷙鳥',   ico: '🦅', hp: 50,  speed: 0.20, bite: 0,  cls: 'fly', flying: true,
             tip: '鷙鳥飛過牆和狗，只有石子、箭、機弦打得到' },
};

// ====== 狀態效果（秒數與強度） ======
const STATUS = {
  burn:   { t: 5,   dps: 4 },        // 燃燒：每秒掉血，碰到隔壁沒燒的會傳火
  poison: { t: 8,   dps: 3, biteMul: 0.6 },
  slow:   { mul: 0.5 },
  howl:   { t: 5,   mul: 1.5 },
  fear:   { t: 3 },                  // 掛在我方單位
  panic:  { speed: 1.0 },            // 驚慌：往右跑
};

// ====== 難度（對每一關都有效；只影響第二波起） ======
const DIFFS = {
  calm:  { name: '寧靜夜', hint: '狼不多，先熟悉怎麼守',  shepherdEvery: 7,  countMul: 1,   hpMul: 1,    gapMul: 1 },
  windy: { name: '起風夜', hint: '狼更多更壯，守法自己想', shepherdEvery: 7,  countMul: 1.3, hpMul: 1.25, gapMul: 0.77 },
  storm: { name: '暴風夜', hint: '糧來得慢，狼又多又壯',  shepherdEvery: 10, countMul: 1.3, hpMul: 1.25, gapMul: 0.77 },
};

const PREP_TIME = 18;      // 第一波來之前的準備秒數（關卡可覆寫）
const WAVE_REST = 6;       // 清完一波後休息幾秒
const FORESHADOW_LEAD = 3; // 倒數剩幾秒先印腳印
const START_FOOD = 150;
const TRICKLE = { every: 5, gives: 5 }; // 沒放牧人也會慢慢有糧

// ====== 關卡 ======
// units：這一關能用的卡（順序＝卡片順序）；fresh：這一關新開的卡（會閃光）
// waves：list [[種類, 隻數]…]；gap 隔幾秒放一隻；rows 走哪幾排；hpMul 血量倍數；ordered 不洗牌（教學用，新敵人排在固定位置）
// say：這波開始時的一句；hint：上一波清完休息時的「牧人提醒」
// outroLose：依死因的失敗文案（wolf 狼闖入／bird 鷙鳥飛入／sheep 羊被偷光）
const LEVELS = [
  {
    id: 1, name: '雅各的夜', title: '羊圈守夜', ref: '取材：創世記 31 章，雅各替拉班看守羊群',
    speaker: '雅各', diffScale: 1,
    intro: '這群羊是拉班交給我的，二十年來我沒少過一隻。今晚換你守夜，狼從東邊來，擋住牠們，天亮前羊一隻都不能少。',
    units: ['shepherd', 'slinger', 'wall'], fresh: ['shepherd', 'slinger', 'wall'],
    tips: ['🐾 腳印出現在哪一排，下一隻狼就從那排來', '第一波狼只走中間三排；狼走到最左邊就守夜失敗，撐過三波就天亮'],
    waves: [
      { list: [['wolf', 4]],               gap: 5.0, rows: [1, 2, 3],       hpMul: 1,   say: '第 1 波來了' },
      { list: [['wolf', 7], ['fast', 3]],  gap: 2.6, rows: [0, 1, 2, 3, 4], hpMul: 1.3, say: '第 2 波來了，狼開始從兩側繞過來', hint: '下一波會從兩側繞過來，每排都要有人' },
      { list: [['wolf', 10], ['fast', 6]], gap: 1.8, rows: [0, 1, 2, 3, 4], hpMul: 2,   say: '最後一波，這群狼更壯', hint: '最後一波的狼更壯，石牆放前面一點' },
    ],
    outroWin: '羊一隻不少。雅各走過來數了一遍，點點頭，什麼也沒說，把水袋遞給你。',
    outroLose: { wolf: '雅各說：「被野獸撕裂的，我沒有帶來給你，是我自己賠上。」（創 31:39）明晚再來，先把石牆放前面一點。' },
  },
  {
    id: 2, name: '大衛的曠野', title: '伯利恆的曠野', ref: '取材：撒母耳記上 17 章，大衛在曠野為父親放羊',
    speaker: '大衛',
    intro: '我為父親放羊，有時來了獅子，有時來了熊，從群中叼一隻羊羔去，我就追上去打牠。今晚換你，狗和機弦都給你了。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog'], fresh: ['sling', 'dog'],
    tips: ['🐾 腳印換成牠的樣子，表示下一隻從那排來的不是普通的狼'],
    waves: [
      { list: [['wolf', 5]],                             gap: 4.5, rows: [1, 2, 3],       hpMul: 1,   say: '第 1 波，先是狼' },
      { list: [['alpha', 1], ['wolf', 6], ['fast', 2]],  gap: 2.4, rows: [0, 1, 2, 3, 4], hpMul: 1.2, ordered: true, say: '領頭狼來了', hint: '後面有一隻領頭狼，牠一嚎叫狼群就衝。先放狗' },
      { list: [['bear', 1], ['wolf', 5]],                gap: 3.0, rows: [0, 1, 2, 3, 4], hpMul: 1.3, ordered: true, say: '熊來了', hint: '聽見了嗎，是熊。石子打不痛牠，機弦手準備' },
      { list: [['lion', 1], ['wolf', 8], ['fast', 4]],   gap: 2.4, rows: [0, 1, 2, 3, 4], hpMul: 1.5, ordered: true, say: '獅子來了，最後一波', hint: '最後一波有獅子。牆擋不住牠，狗拖住、機弦集火' },
    ],
    outroWin: '天亮了。大衛說：「耶和華救我脫離獅子和熊的爪，也必救我。」（撒上 17:37）',
    outroLose: { wolf: '大衛說：「有時來了獅子，有時來了熊。」牠們不是狼，牆擋不住，要有人打得痛牠。明晚再來。' },
  },
  {
    id: 3, name: '雇工與賊', title: '羊的門', ref: '取材：約翰福音 10 章',
    speaker: null,
    intro: '「從門進去的，才是羊的牧人；從別處爬進去的，那人就是賊，就是強盜。」「雇工不是牧人，羊也不是他自己的，他看見狼來，就撇下羊逃走。」（約 10:1、12）今晚羊圈裡有三隻羊，被偷光就守不住了。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'hireling', 'tower'], fresh: ['hireling', 'tower'],
    tips: ['🐑 羊圈裡有三隻羊，偷羊人抱著羊往回跑時，追上牠羊就回來'],
    sheep: 3,
    waves: [
      { list: [['wolf', 4]],                              gap: 5.0, rows: [1, 2, 3],       hpMul: 1,   say: '第 1 波，狼不多' },
      { list: [['wolf', 8], ['fast', 3]],                 gap: 2.2, rows: [0, 1, 2, 3, 4], hpMul: 1.3, say: '狼多起來了', hint: '下一波狼多很多，雇工靠得住嗎' },
      { list: [['thief', 1], ['wolf', 5], ['thief', 2]],  gap: 2.6, rows: [0, 1, 2, 3, 4], hpMul: 1.4, ordered: true, say: '有人翻牆', hint: '有賊混在裡面，牠會翻過石牆' },
      { list: [['rustler', 1], ['fox', 3], ['wolf', 6], ['rustler', 2], ['fox', 3]], gap: 2.0, rows: [0, 1, 2, 3, 4], hpMul: 1.6, ordered: true, say: '偷羊的來了', hint: '偷羊人不咬人，走到底就抱羊跑。狗追得上' },
    ],
    outroWin: '天亮了，三隻羊都在。「我是好牧人；好牧人為羊捨命。」（約 10:11）',
    outroLose: {
      wolf: '狼闖進來了。雇工早就跑了，牆後面空空的。明晚別把羊交給雇工。',
      sheep: '三隻羊都被抱走了。偷羊人不咬人，所以牆攔不住他的腳，只有追上去才行。',
    },
  },
  {
    id: 4, name: '何烈山下', title: '大而可怕的曠野', ref: '取材：出埃及記 3:1、申命記 8:15',
    speaker: '摩西',
    intro: '葉忒羅的羊今晚在這曠野過夜。這曠野大而可怕，有火蛇、蠍子，地上盡是石頭。你守東邊，我守西邊。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'scorpion'], fresh: ['archer', 'scorpion'],
    tips: ['🪨 有石頭的格子不能放東西'],
    rocks: [[0, 3], [2, 2], [3, 5], [4, 1]],
    waves: [
      { list: [['wolf', 5]],                             gap: 4.5, rows: [1, 2, 3],       hpMul: 1,   say: '第 1 波，狼' },
      { list: [['locust', 18]],                          gap: 0.6, rows: [1, 3],          hpMul: 1,   say: '蝗群來了', hint: '聽，像風一樣的聲音。蝗蟲一隊一隊來，一箭能穿好幾隻' },
      { list: [['digger', 1], ['wolf', 6], ['digger', 2]], gap: 2.6, rows: [0, 1, 2, 3, 4], hpMul: 1.4, ordered: true, say: '地在動', hint: '野狗會從地底鑽到中間才冒出來，中段要有人' },
      { list: [['locust', 20], ['wolf', 7], ['digger', 3], ['fast', 4]], gap: 1.2, rows: [0, 1, 2, 3, 4], hpMul: 1.7, say: '最後一波，全來了', hint: '最後一波什麼都有，弓箭手和蠍窩一起上' },
    ],
    outroWin: '天亮了。摩西領著羊群往山那邊去，那山叫何烈山。（出 3:1）',
    outroLose: { wolf: '摩西說：這曠野大而可怕。地底來的，前排的牆擋不到，中間也要有人。' },
  },
  {
    id: 5, name: '提哥亞的牧人', title: '誰不懼怕', ref: '取材：阿摩司書 1:1、3:8、5:19',
    speaker: '阿摩司',
    intro: '我是牧人，又是修理桑樹的，不是先知的門徒。獅子吼叫，誰不懼怕？今晚天上也要看著，鷙鳥會飛過牆。火盆給你，石子穿過火就會燒。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'scorpion', 'thorns', 'brazier'], fresh: ['thorns', 'brazier'],
    tips: ['🔥 火盆要放在射手前面，石子穿過才會變火', '🦅 鷙鳥飛過牆和狗，只有投射打得到'],
    waves: [
      { list: [['wolf', 6]],                                  gap: 4.0, rows: [1, 2, 3],       hpMul: 1,   say: '第 1 波，狼' },
      { list: [['bird', 1], ['wolf', 6], ['bird', 2]],        gap: 2.6, rows: [0, 1, 2, 3, 4], hpMul: 1.3, ordered: true, say: '天上有東西', hint: '抬頭。鷙鳥會飛過牆，每排都要有人丟石頭' },
      { list: [['wolf', 12], ['fast', 4]],                    gap: 1.2, rows: [2],             hpMul: 1.4, say: '狼擠在同一排', hint: '這一波狼擠在中間那排，火會一隻傳一隻' },
      { list: [['bear', 1], ['wolf', 8], ['bird', 3], ['bear', 1]], gap: 2.0, rows: [0, 1, 2, 3, 4], hpMul: 1.7, ordered: true, say: '躲避獅子又遇見熊', hint: '熊來了。荊棘拖住牠，機弦多打兩下' },
    ],
    outroWin: '天亮了。阿摩司說：「牧人怎樣從獅子口中搶回兩條羊腿或半個耳朵。」（摩 3:12）今晚搶回的不只這些。',
    outroLose: { wolf: '阿摩司說：「躲避獅子又遇見熊。」（摩 5:19）明晚火盆放前面一點。', bird: '鷙鳥從牆上飛過去了。牆擋不住天上的東西，每排都要有人丟石頭。' },
  },
  {
    id: 6, name: '基甸的三百人', title: '瓶子、火把、角', ref: '取材：士師記 7 章',
    speaker: '基甸',
    intro: '三百人對一大群，多如蝗蟲。瓶子、火把、角，各人站在自己的地方。天亮前就見分曉。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'scorpion', 'thorns', 'brazier', 'jar', 'horn'], fresh: ['jar', 'horn'],
    tips: ['⏱ 準備時間比平常短'],
    prep: 12,
    waves: [
      { list: [['wolf', 8]],                                           gap: 1.0, rows: [2],             hpMul: 1,   say: '狼擠成一團' },
      { list: [['wolf', 10], ['fast', 6]],                             gap: 1.0, rows: [1, 3],          hpMul: 1.3, say: '兩排一起來', hint: '下一波兩排一起來，角一吹整排退' },
      { list: [['alpha', 2], ['locust', 20], ['wolf', 8]],             gap: 0.9, rows: [0, 1, 2, 3, 4], hpMul: 1.5, say: '多如蝗蟲', hint: '多如蝗蟲。兩隻領頭狼在後面' },
      { list: [['alpha', 3], ['wolf', 14], ['fast', 8], ['locust', 20]], gap: 0.7, rows: [0, 1, 2, 3, 4], hpMul: 1.8, say: '最後一波，全都來了', hint: '最後一波。各人站在自己的地方' },
    ],
    outroWin: '天亮了。「他們在營的四圍各站各的地方。」（士 7:21）',
    outroLose: { wolf: '基甸說：人不夠，就要靠瓶子和角。下一次，等牠們擠在一起再丟。' },
  },
  {
    id: 7, name: '尋找我的羊', title: '最後一夜', ref: '取材：以西結書 34 章、詩篇 23 篇',
    speaker: null,
    intro: '「牧人在羊群四散的日子怎樣尋找他的羊，我必照樣尋找我的羊。」「失喪的，我必尋找；被逐的，我必領回；受傷的，我必纏裹；有病的，我必醫治。」（結 34:12、16）這是最後一夜。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'scorpion', 'thorns', 'brazier', 'jar', 'horn', 'healer', 'catapult'], fresh: ['healer', 'catapult'],
    tips: ['🦁 今晚有五波，兩隻獅子'],
    sheep: 3,
    waves: [
      { list: [['wolf', 6], ['fast', 2]],                                   gap: 3.0, rows: [0, 1, 2, 3, 4], hpMul: 1.2, say: '第 1 波' },
      { list: [['wolf', 12], ['locust', 15]],                               gap: 1.0, rows: [1, 2, 3],       hpMul: 1.4, say: '擠成一串', hint: '下一波排成一串，投石機一砸一片' },
      { list: [['thief', 3], ['rustler', 2], ['fox', 4], ['digger', 3]],    gap: 2.0, rows: [0, 1, 2, 3, 4], hpMul: 1.5, say: '賊和偷羊的', hint: '賊、偷羊人、狐狸、野狗全來，狗和守望樓都要' },
      { list: [['bear', 2], ['alpha', 2], ['bird', 4], ['wolf', 10]],       gap: 1.8, rows: [0, 1, 2, 3, 4], hpMul: 1.7, ordered: true, say: '熊和領頭狼', hint: '兩隻熊、兩隻領頭狼、天上還有鷙鳥' },
      { list: [['lion', 1], ['wolf', 10], ['lion', 1], ['fast', 8], ['locust', 20]], gap: 1.5, rows: [0, 1, 2, 3, 4], hpMul: 2,   ordered: true, say: '兩隻獅子，最後一波', hint: '最後一波，兩隻獅子。纏裹的牧人放狗旁邊' },
    ],
    outroWin: '天亮了。',
    psalm: ['耶和華是我的牧者，我必不致缺乏。', '他使我躺臥在青草地上，領我在可安歇的水邊。', '他使我的靈魂甦醒，為自己的名引導我走義路。', '我雖然行過死蔭的幽谷，也不怕遭害，因為你與我同在；你的杖，你的竿，都安慰我。', '在我敵人面前，你為我擺設筵席；你用油膏了我的頭，使我的福杯滿溢。', '我一生一世必有恩惠慈愛隨著我；我且要住在耶和華的殿中，直到永遠。'],
    outroLose: {
      wolf: '「失喪的，我必尋找。」（結 34:16）天還沒亮，再守一夜。',
      sheep: '羊被抱走了。「被逐的，我必領回。」（結 34:16）再守一夜。',
      bird: '鷙鳥飛過去了。天上的也要有人看著。再守一夜。',
    },
  },
];

const DATA = { ROWS, COLS, UNITS, ENEMIES, STATUS, DIFFS, LEVELS, ELDER_MUL, ELDER_COST, REPAIR_COST, REPAIR_HP, REPAIR_CD, PREP_TIME, WAVE_REST, FORESHADOW_LEAD, START_FOOD, TRICKLE };
if (typeof module !== 'undefined') module.exports = DATA; else window.DATA = DATA;
