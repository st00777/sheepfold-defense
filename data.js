// 羊圈守夜 · 資料表。加單位、加敵人、加關卡都只改這裡。
// 數值說明：cost 要花的糧；hp 能被咬幾下；every 幾秒做一次事；dmg 一下打多少；speed 每秒走幾格；bite 每秒咬掉多少血。
'use strict';

const ROWS = 5, COLS = 7;

// ====== 我方單位 ======
// kind：producer 產糧／shooter 射手／blocker 牆／dog 牧羊犬／floor 鋪地／instant 一次性／support 輔助
const UNITS = {
  shepherd: { name: '牧人',     ico: '🧑‍🌾', cost: 50,  hp: 60,  kind: 'producer', every: 7,   gives: 25,
              desc: '定時產糧。再點一下升級成老牧人，產糧更快', ref: '創 31:40' },
  slinger:  { name: '投石手',   ico: '🪨',   cost: 100, hp: 60,  kind: 'shooter', every: 1.3, dmg: 20, shot: 'stone',
              desc: '投石攻擊同一排的敵人', ref: '士 20:16' },
  wall:     { name: '石牆',     ico: '🧱',   cost: 50,  hp: 300, kind: 'blocker',
              desc: '高血量擋路。再點一下花 25 糧修補', ref: '民 32:16' },
  sling:    { name: '機弦手',   ico: '🎯',   cost: 150, hp: 60,  kind: 'shooter', every: 3.2, dmg: 90, shot: 'sling',
              desc: '單發傷害高、攻擊間隔長，專打獅子和熊', ref: '撒上 17:40' },
  dog:      { name: '牧羊犬',   ico: '🐕',   cost: 75,  hp: 220, kind: 'dog', dps: 10, hunt: 30, run: 1.6, rest: 10,
              desc: '抓賊的。追咬賊、偷羊人、狐狸、野狗；大傢伙也能拖幾秒。受傷回窩休息，不會死', ref: '伯 30:1' },
  hireling: { name: '雇工',     ico: '🤾',   cost: 25,  hp: 40,  kind: 'shooter', every: 0.9, dmg: 10, shot: 'stone', range: 2.5, flees: 1.0,
              desc: '低費短射程投石手，敵人一靠近就逃跑', ref: '約 10:12' },
  tower:    { name: '守望樓',   ico: '🗼',   cost: 125, hp: 600, kind: 'blocker', tall: true,
              desc: '高血量防線，賊也翻不過', ref: '賽 5:2' },
  archer:   { name: '弓箭手',   ico: '🏹',   cost: 125, hp: 60,  kind: 'shooter', every: 1.8, dmg: 26, shot: 'arrow', pierce: true, falloff: 0.8,
              desc: '箭矢穿透整排，每穿一隻傷害降低', ref: '創 21:20' },
  scorpion: { name: '蠍窩',     ico: '🦂',   cost: 50,  hp: 1,   kind: 'floor', uses: 8, poison: 8,
              desc: '鋪地施毒，可觸發 8 次。專治狐狸和冒出來的野狗', ref: '申 8:15' },
  thorns:   { name: '荊棘',     ico: '🌿',   cost: 75,  hp: 150, kind: 'floor', slow: 0.5, dps: 6, wear: 3,
              desc: '鋪地減速並持續傷害，踩久會損壞。放在射手前面最划算', ref: '何 2:6' },
  brazier:  { name: '火盆',     ico: '🔥',   cost: 75,  hp: 100, kind: 'support', ignite: true,
              desc: '點燃穿過的石子與箭矢，燃燒會傳給隔壁敵人', ref: '路 2:8' },
  jar:      { name: '瓦瓶火把', ico: '🏺',   cost: 100, hp: 0,   kind: 'instant', dmg: 30, panic: 2.5,
              desc: '一次性。九格範圍傷害，並嚇退敵人', ref: '士 7:19' },
  horn:     { name: '吹角手',   ico: '📯',   cost: 100, hp: 60,  kind: 'support', every: 20, push: 1, stun: 2,
              desc: '每 20 秒吹角，同排敵人後退一格並暈眩', ref: '民 10:9' },
  healer:   { name: '纏裹的牧人', ico: '🩹', cost: 100, hp: 60,  kind: 'support', every: 1, heal: 5,
              desc: '不攻擊，持續回復周圍八格夥伴的血量', ref: '結 34:16' },
  catapult: { name: '投石機',   ico: '🛞',   cost: 200, hp: 80,  kind: 'shooter', every: 4, dmg: 45, shot: 'lob', splash: 1.2,
              desc: '攻擊同排最遠的敵人，濺射傷害波及落點周圍', ref: '代下 26:15' },
};
const ELDER_MUL = 0.6;    // 老牧人送糧間隔倍數
const ELDER_COST = 75;
const REPAIR_COST = 25, REPAIR_HP = 120, REPAIR_CD = 8; // 修補一次要隔 8 秒，不能一直點
const MAX_CARDS = 8;      // 一關最多帶幾張卡上場，超過就要點兵
const MIN_CARDS = 4;      // 點兵至少要帶幾張（只帶牧人等於沒得打）
const SELL_RATE = 0.5;    // 鏟子拆掉單位退幾成糧（含升老牧人花的）
// 預設帶卡的先後：這關新開的一定帶、牧人一定帶，其餘依這個順序補滿
const PICK_ORDER = ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'tower', 'archer', 'brazier', 'horn', 'catapult', 'healer', 'jar', 'scorpion', 'thorns', 'hireling'];

// ====== 敵人 ======
// 特殊欄位：flying 飛的／dodge 閃避率／digs 鑽地／vaults 翻牆／steals 偷羊／enrage 狂暴／howl 嚎叫秒數／roar 咆哮秒數
// 偷雞摸狗的（dodge／vaults／steals／digs 任一）＝狗的獵物，狗對牠們用 hunt 傷害
// thick 厚皮：石子和箭只打四成，機弦、投石機、火、毒全額（所以「石子打不痛牠」）；prio 狗優先咬誰（越大越先）
const ENEMIES = {
  wolf:    { name: '狼',     ico: '🐺', hp: 60,  speed: 0.22, bite: 12 },
  fast:    { name: '快狼',   ico: '🐺', hp: 40,  speed: 0.40, bite: 10, cls: 'fast' },
  alpha:   { name: '領頭狼', ico: '🐺', hp: 200, speed: 0.20, bite: 15, cls: 'alpha', howl: 8, prio: 4,
             tip: '嚎叫讓附近狼群加速。派牧羊犬咬住牠' },
  bear:    { name: '母熊',   ico: '🐻', hp: 420, speed: 0.15, bite: 25, cls: 'big', enrage: 0.5, thick: true, prio: 2,
             tip: '血量高，半血狂暴。石子傷害低，改用機弦手' },
  lion:    { name: '獅子',   ico: '🦁', hp: 600, speed: 0.15, bite: 30, cls: 'big lion', roar: 12, wallMul: 4, thick: true, prio: 2,
             tip: '咆哮讓附近夥伴停手，拆牆很快。狗拖住，機弦手集中攻擊' },
  thief:   { name: '賊',     ico: '🥷', hp: 70,  speed: 0.25, bite: 10, cls: 'human', vaults: true, prio: 3,
             tip: '會翻過石牆，改用守望樓攔截' },
  rustler: { name: '偷羊人', ico: '🧔', hp: 90,  speed: 0.30, bite: 4,  cls: 'human light', steals: true, fleeSpeed: 0.45, prio: 5,
             tip: '不攻擊，走到底就抱羊逃跑。派牧羊犬追捕救羊' },
  fox:     { name: '小狐狸', ico: '🦊', hp: 30,  speed: 0.35, bite: 6,  cls: 'small', dodge: 0.7, prio: 3,
             tip: '十顆石子閃掉七顆。改用牧羊犬、荊棘或蠍窩' },
  locust:  { name: '蝗群',   ico: '🦗', hp: 8,   speed: 0.30, bite: 2,  cls: 'swarm',
             tip: '成群出現，用弓箭手穿透，一箭打多隻' },
  digger:  { name: '野狗',   ico: '🐕‍🦺', hp: 80, speed: 0.22, bite: 12, cls: 'dig', digs: true, digSpeed: 0.35,
             tip: '鑽地繞過前排。土堆是牠冒出來的地方，在土堆左邊放牆或狗' },
  bird:    { name: '鷙鳥',   ico: '🦅', hp: 50,  speed: 0.20, bite: 0,  cls: 'fly', flying: true,
             tip: '飛越牆與狗，只有投射攻擊打得到' },
};

// ====== 狀態效果（秒數與強度） ======
const STATUS = {
  burn:   { t: 5,   dps: 4 },        // 燃燒：每秒掉血，碰到隔壁沒燒的會傳火
  poison: { t: 8,   dps: 4, biteMul: 0.6 },
  slow:   { mul: 0.5 },
  howl:   { t: 5,   mul: 1.5 },
  fear:   { t: 3 },                  // 掛在我方單位
  panic:  { speed: 1.0 },            // 驚慌：往右跑
};

// ====== 難度（對每一關都有效；只影響第二波起） ======
const DIFFS = {
  calm:  { name: '寧靜夜', hint: '敵人較少，先熟悉怎麼守',  shepherdEvery: 7,  countMul: 1,   hpMul: 1,    gapMul: 1 },
  windy: { name: '起風夜', hint: '敵人更多、血量更高，守法自己想', shepherdEvery: 7,  countMul: 1.3, hpMul: 1.25, gapMul: 0.77 },
  storm: { name: '暴風夜', hint: '產糧較慢，敵人又多又壯',  shepherdEvery: 10, countMul: 1.3, hpMul: 1.25, gapMul: 0.77 },
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
    tips: ['🐾 腳印出現在哪一排，下一隻狼就從那排來', '第一波狼只走中間三排；狼走到最左邊就守夜失敗，撐過三波就天亮', '⛏️ 放錯位置可以用鏟子拆掉，退一半糧'],
    waves: [
      { list: [['wolf', 4]],               gap: 5.0, rows: [1, 2, 3],       hpMul: 1,   say: '第 1 波來了' },
      { list: [['wolf', 7], ['fast', 3]],  gap: 2.6, rows: [0, 1, 2, 3, 4], hpMul: 1.3, say: '第 2 波來了，狼開始從兩側繞過來', hint: '下一波上下兩排也會來狼，每排都要有射手' },
      { list: [['wolf', 10], ['fast', 6]], gap: 1.8, rows: [0, 1, 2, 3, 4], hpMul: 2,   say: '最後一波，這群狼更壯', hint: '最後一波血量更高，石牆放在射手前面' },
    ],
    outroWin: '羊一隻不少。雅各走過來數了一遍，點點頭，什麼也沒說，把水袋遞給你。',
    outroLose: { wolf: '雅各說：「被野獸撕裂的，我沒有帶來給你，是我自己賠上。」（創 31:39）明晚再來。記得讓石牆擋在射手前面。' },
  },
  {
    id: 2, name: '大衛的曠野', title: '伯利恆的曠野', ref: '取材：撒母耳記上 17 章，大衛在曠野為父親放羊',
    speaker: '大衛',
    intro: '我為父親放羊，有時來了獅子，有時來了熊，從群中叼一隻羊羔去，我就追上去打牠。今晚換你，狗和機弦都給你了。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog'], fresh: ['sling', 'dog'],
    tips: ['🐾 腳印換成牠的樣子，表示下一隻從那排來的不是普通的狼'],
    waves: [
      { list: [['wolf', 5]],                             gap: 4.5, rows: [1, 2, 3],       hpMul: 1,   say: '第 1 波，先是狼' },
      { list: [['alpha', 1], ['wolf', 6], ['fast', 2]],  gap: 2.4, rows: [0, 1, 2, 3, 4], hpMul: 1.2, ordered: true, say: '領頭狼來了', hint: '領頭狼要來了，嚎叫會讓狼群加速。先放牧羊犬' },
      { list: [['bear', 1], ['wolf', 5]],                gap: 3.0, rows: [0, 1, 2, 3, 4], hpMul: 1.3, ordered: true, say: '熊來了', hint: '聽見了嗎，是熊。石子傷害低，機弦手準備' },
      { list: [['lion', 1], ['wolf', 8], ['fast', 4]],   gap: 2.4, rows: [0, 1, 2, 3, 4], hpMul: 1.5, ordered: true, say: '獅子來了，最後一波', hint: '最後一波有獅子，拆牆很快。牧羊犬拖住，機弦手集中攻擊' },
    ],
    outroWin: '天亮了。大衛說：「耶和華救我脫離獅子和熊的爪，也必救我。」（撒上 17:37）',
    outroLose: { wolf: '大衛說：「有時來了獅子，有時來了熊。」碰上牠們，光靠牆撐不了多久，得讓機弦手多打幾發。明晚再來。' },
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
      { list: [['wolf', 8], ['fast', 3]],                 gap: 2.2, rows: [0, 1, 2, 3, 4], hpMul: 1.3, say: '狼多起來了', hint: '下一波狼更多，雇工遇敵會逃，別只靠他' },
      { list: [['thief', 1], ['wolf', 5], ['thief', 2]],  gap: 2.6, rows: [0, 1, 2, 3, 4], hpMul: 1.4, ordered: true, say: '有人翻牆', hint: '有賊混進來，石牆攔不住，改用守望樓' },
      { list: [['rustler', 1], ['fox', 3], ['wolf', 6], ['rustler', 2], ['fox', 3]], gap: 2.0, rows: [0, 1, 2, 3, 4], hpMul: 1.6, ordered: true, say: '偷羊的來了', hint: '偷羊人會抱羊逃跑，派牧羊犬追捕救羊' },
    ],
    outroWin: '天亮了，三隻羊都在。「我是好牧人；好牧人為羊捨命。」（約 10:11）',
    outroLose: {
      wolf: '狼闖進來了。雇工早已逃走，牆後沒人接應。明晚別只靠雇工。',
      sheep: '三隻羊都被抱走了。偷羊人抱起羊就跑，牆攔不住，得派牧羊犬追上去。',
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
      { list: [['locust', 18]],                          gap: 0.6, rows: [1, 3],          hpMul: 1,   say: '蝗群來了', hint: '聽，像風一樣的聲音。蝗群來了，用弓箭手穿透，一箭打多隻' },
      { list: [['digger', 1], ['wolf', 6], ['digger', 2]], gap: 2.6, rows: [0, 1, 2, 3, 4], hpMul: 1.4, ordered: true, say: '地在動', hint: '野狗會鑽地繞過前排。土堆出現後，在它左邊放牆或狗' },
      { list: [['locust', 20], ['wolf', 7], ['digger', 3], ['fast', 4]], gap: 1.2, rows: [0, 1, 2, 3, 4], hpMul: 1.7, say: '最後一波，全來了', hint: '最後一波全來了，弓箭手穿透、蠍窩施毒' },
    ],
    outroWin: '天亮了。摩西領著羊群往山那邊去，那山叫何烈山。（出 3:1）',
    outroLose: { wolf: '摩西說：這曠野大而可怕。地底來的，前排石牆攔不住，中間也得有人守。' },
  },
  {
    id: 5, name: '提哥亞的牧人', title: '誰不懼怕', ref: '取材：阿摩司書 1:1、3:8、5:19',
    speaker: '阿摩司',
    intro: '我是牧人，又是修理桑樹的，不是先知的門徒。獅子吼叫，誰不懼怕？今晚天上也要看著，鷙鳥會飛過牆。火盆給你，石子穿過火就會燒。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'scorpion', 'thorns', 'brazier'], fresh: ['thorns', 'brazier'],
    tips: ['🔥 火盆要放在射手前面，石子穿過才會變火', '🦅 鷙鳥飛過牆和狗，只有投射攻擊打得到'],
    waves: [
      { list: [['wolf', 6]],                                  gap: 4.0, rows: [1, 2, 3],       hpMul: 1,   say: '第 1 波，狼' },
      { list: [['bird', 1], ['wolf', 6], ['bird', 2]],        gap: 2.6, rows: [0, 1, 2, 3, 4], hpMul: 1.3, ordered: true, say: '天上有東西', hint: '抬頭。鷙鳥會飛過牆，每排都要有射手' },
      { list: [['wolf', 12], ['fast', 4]],                    gap: 1.2, rows: [2],             hpMul: 1.4, say: '狼擠在同一排', hint: '這波集中走中排，用火盆讓燃燒在狼群間蔓延' },
      { list: [['bear', 1], ['wolf', 8], ['bird', 3], ['bear', 1]], gap: 2.0, rows: [0, 1, 2, 3, 4], hpMul: 1.7, ordered: true, say: '躲避獅子又遇見熊', hint: '熊來了。荊棘減速，讓機弦手多打幾發' },
    ],
    outroWin: '天亮了。阿摩司說：「牧人怎樣從獅子口中搶回兩條羊腿或半個耳朵。」（摩 3:12）今晚搶回的不只這些。',
    outroLose: { wolf: '阿摩司說：「躲避獅子又遇見熊。」（摩 5:19）明晚再守。把火盆放在射手前面，讓石子穿過火。', bird: '鷙鳥飛過牆，闖進羊圈了。天上的敵人得靠射手攔下，每排都要有人。' },
  },
  {
    id: 6, name: '基甸的三百人', title: '瓶子、火把、角', ref: '取材：士師記 7 章',
    speaker: '基甸',
    intro: '三百人對一大群，多如蝗蟲。瓶子、火把、角，各人站在自己的地方。天亮前就見分曉。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'scorpion', 'thorns', 'brazier', 'jar', 'horn'], fresh: ['jar', 'horn'],
    tips: ['⏱ 今晚準備時間較短，先放產糧和防線'],
    prep: 12,
    waves: [
      { list: [['wolf', 8]],                                           gap: 1.0, rows: [2],             hpMul: 1,   say: '狼擠成一團' },
      { list: [['wolf', 10], ['fast', 6]],                             gap: 1.0, rows: [1, 3],          hpMul: 1.3, say: '兩排一起來', hint: '下一波上下兩排一起來，吹角能讓同排敵人後退' },
      { list: [['alpha', 2], ['locust', 20], ['wolf', 8]],             gap: 0.9, rows: [0, 1, 2, 3, 4], hpMul: 1.5, say: '多如蝗蟲', hint: '多如蝗蟲，還有兩隻領頭狼，留意嚎叫加速' },
      { list: [['alpha', 3], ['wolf', 14], ['fast', 8], ['locust', 20]], gap: 0.7, rows: [0, 1, 2, 3, 4], hpMul: 1.8, say: '最後一波，全都來了', hint: '最後一波。各守其位，留好瓦瓶火把應急' },
    ],
    outroWin: '天亮了。「他們在營的四圍各站各的地方。」（士 7:21）',
    outroLose: { wolf: '基甸說：人不夠，就得用好瓶子和角。下一次，等牠們擠成一團再打破瓶子。' },
  },
  {
    id: 7, name: '尋找我的羊', title: '最後一夜', ref: '取材：以西結書 34 章、詩篇 23 篇',
    speaker: null,
    intro: '「牧人在羊群四散的日子怎樣尋找他的羊，我必照樣尋找我的羊。」「失喪的，我必尋找；被逐的，我必領回；受傷的，我必纏裹；有病的，我必醫治。」（結 34:12、16）這是最後一夜。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'scorpion', 'thorns', 'brazier', 'jar', 'horn', 'healer', 'catapult'], fresh: ['healer', 'catapult'],
    tips: ['🦁 今晚共五波，最後一波有兩隻獅子'],
    sheep: 3,
    waves: [
      { list: [['wolf', 6], ['fast', 2]],                                   gap: 3.0, rows: [0, 1, 2, 3, 4], hpMul: 1.2, say: '第 1 波' },
      { list: [['wolf', 12], ['locust', 15]],                               gap: 1.0, rows: [1, 2, 3],       hpMul: 1.4, say: '擠成一串', hint: '下一波敵人密集，用投石機的濺射一砸一片' },
      { list: [['thief', 3], ['rustler', 2], ['fox', 4], ['digger', 3]],    gap: 2.0, rows: [0, 1, 2, 3, 4], hpMul: 1.5, say: '賊和偷羊的', hint: '賊、偷羊人、狐狸、野狗齊來，備好牧羊犬與守望樓' },
      { list: [['bear', 2], ['alpha', 2], ['bird', 4], ['wolf', 10]],       gap: 1.8, rows: [0, 1, 2, 3, 4], hpMul: 1.7, ordered: true, say: '熊和領頭狼', hint: '兩隻熊、兩隻領頭狼，還有鷙鳥，地面空中都要顧' },
      { list: [['lion', 1], ['wolf', 10], ['lion', 1], ['fast', 8], ['locust', 20]], gap: 1.5, rows: [0, 1, 2, 3, 4], hpMul: 2,   ordered: true, say: '兩隻獅子，最後一波', hint: '最後兩隻獅子。纏裹的牧人放狗旁邊，持續回血' },
    ],
    outroWin: '天亮了。',
    psalm: ['耶和華是我的牧者，我必不致缺乏。', '他使我躺臥在青草地上，領我在可安歇的水邊。', '他使我的靈魂甦醒，為自己的名引導我走義路。', '我雖然行過死蔭的幽谷，也不怕遭害，因為你與我同在；你的杖，你的竿，都安慰我。', '在我敵人面前，你為我擺設筵席；你用油膏了我的頭，使我的福杯滿溢。', '我一生一世必有恩惠慈愛隨著我；我且要住在耶和華的殿中，直到永遠。'],
    outroLose: {
      wolf: '「失喪的，我必尋找。」（結 34:16）天還沒亮，再守一夜。',
      sheep: '羊被抱走了。「被逐的，我必領回。」（結 34:16）再守一夜。',
      bird: '鷙鳥飛進羊圈了。下一次也留人守住天上。再守一夜。',
    },
  },
];

const DATA = { ROWS, COLS, UNITS, ENEMIES, STATUS, DIFFS, LEVELS, ELDER_MUL, ELDER_COST, REPAIR_COST, REPAIR_HP, REPAIR_CD, MAX_CARDS, MIN_CARDS, SELL_RATE, PICK_ORDER, PREP_TIME, WAVE_REST, FORESHADOW_LEAD, START_FOOD, TRICKLE };
if (typeof module !== 'undefined') module.exports = DATA; else window.DATA = DATA;
