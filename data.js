// 羊圈守夜 · 資料表。加單位、加敵人、加關卡都只改這裡。
// 數值說明：cost 要花的糧；hp 能被咬幾下；every 幾秒做一次事；dmg 一下打多少；speed 每秒走幾格；bite 每秒咬掉多少血。
'use strict';

const ROWS = 5, COLS = 7;

// ====== 我方單位 ======
// kind：producer 產糧／shooter 射手／blocker 牆／dog 牧羊犬／floor 鋪地／instant 一次性／support 輔助／deflector 趕路（第二章）／patrol 巡夜（第二章）
// 第二章欄位：light 油燈照亮上下幾排（腳印預告回來）；lanes 射手同時打上下幾排；deflect 每趕一隻自己掉多少血；cradle 迷羊走到他那格就安全；walk 巡夜人每走一排要幾秒、reach 打前方幾格
// upgrade：放下後「再點一下」花糧升級，欄位會蓋過原本的（牧人升老牧人、石牆修補是另外寫死的特例）；fromId＝在哪一夜（id）學會，engine.js 載入時換算成 from＝那一夜的位置（顯示編號），desc 裡的 {from} 一併填入
// heal 每秒回血／range 回血範圍幾格（1＝周圍八格、2＝5×5）／brave 獅子咆哮嚇不停
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
  thorns:   { name: '荊棘',     ico: '🌿',   cost: 75,  hp: 150, kind: 'floor', slow: 0.5, dps: 6, wear: 3,
              desc: '鋪地減速並持續傷害，踩久會損壞。放在射手前面最划算；第 {from} 夜起再點一下撒蠍子', ref: '何 2:6',
              // 升級：再點一下花糧撒蠍子進去，踩入的敵人中毒（from＝第幾夜起學會）；持續有效，每隻敵人同一片荊棘只叮一次
              upgrade: { name: '荊棘蠍窩', ico: '🦂', cost: 50, fromId: 5, poison: 8, desc: '撒蠍子進荊棘，踩入的敵人中毒，持續有效', ref: '申 8:15' } },
  brazier:  { name: '火盆',     ico: '🔥',   cost: 75,  hp: 100, kind: 'support', ignite: true,
              desc: '點燃穿過的石子與箭矢，燃燒會傳給隔壁敵人', ref: '路 2:8' },
  jar:      { name: '瓦瓶火把', ico: '🏺',   cost: 100, hp: 0,   kind: 'instant', dmg: 30, panic: 2.5,
              desc: '一次性。九格範圍傷害，並嚇退敵人', ref: '士 7:19' },
  horn:     { name: '吹角手',   ico: '📯',   cost: 100, hp: 60,  kind: 'support', every: 20, push: 1, stun: 2,
              desc: '每 20 秒吹角，同排敵人後退一格並暈眩。第 {from} 夜起再點一下換銀號，五排一起退', ref: '民 10:9',
              // 升級：銀號，吹一次五排地面敵人全部後退並暈眩（all＝全場）
              upgrade: { name: '銀號', ico: '🎺', cost: 75, fromId: 14, all: true, desc: '換成銀號，吹一次五排的地面敵人全部後退一格並暈眩', ref: '民 10:2' } },
  healer:   { name: '纏裹的牧人', ico: '🩹', cost: 100, hp: 60,  kind: 'support', every: 1, heal: 8, range: 1, brave: true,
              desc: '不攻擊，持續回復周圍八格夥伴的血量，不怕獅子咆哮。第 {from} 夜起再點一下膏油，範圍擴大到 5×5、回復更多血量', ref: '結 34:16',
              // 升級：再點一下花糧膏油，範圍 1 格→2 格（5×5 共 24 格）、回血 8→12；brave＝獅子咆哮嚇不停它
              upgrade: { name: '膏油', ico: '🫗', cost: 50, fromId: 7, heal: 12, range: 2, desc: '膏油後周圍 5×5 共 24 格的夥伴每秒回復 12 血量，一位顧整條防線', ref: '詩 23:5' } },
  catapult: { name: '投石機',   ico: '🛞',   cost: 200, hp: 80,  kind: 'shooter', every: 4, dmg: 45, shot: 'lob', splash: 1.2,
              desc: '攻擊同排最遠的敵人，濺射傷害波及落點周圍', ref: '代下 26:15' },
  // ====== 第二章「另外的羊」 ======
  staff:    { name: '牧人杖',   ico: '🦯',   cost: 50,  hp: 150, kind: 'deflector', deflect: 10, deflectCd: 4,
              desc: '不攻擊。地面敵人走到它面前就被趕到隔壁排，放在沒有射手的排，把敵人趕進有射手的那排。頭目趕不動', ref: '詩 23:4' },
  lamp:     { name: '油燈',     ico: '🪔',   cost: 50,  hp: 60,  kind: 'support', light: 1,
              desc: '不攻擊。照亮自己這排和上下兩排：光裡的敵人不換排（豺狼不繞路、豹不跳排、夜鴞不飄），無月夜裡那三排的腳印預告也會回來。放中間那排最划算', ref: '箴 31:18' },
  patrol:   { name: '巡夜人',   ico: '🚶',   cost: 125, hp: 140, kind: 'patrol', every: 0.8, dmg: 18, walk: 1.2, reach: 1.3,
              desc: '在自己這排和上下兩排之間來回走，近戰打前方一格的敵人。放中間那排，幫狗看著隔壁', ref: '撒上 25:16' },
  volley:   { name: '投石隊',   ico: '🥌',   cost: 175, hp: 60,  kind: 'shooter', every: 1.6, dmg: 14, shot: 'stone', lanes: 1,
              desc: '同時投石攻擊自己這排和上下兩排。放中間一次顧三排，夜鴞飄到哪排都打得到', ref: '代上 12:2' },
  cradle:   { name: '抱羊羔的牧人', ico: '🫂', cost: 75, hp: 100, kind: 'support', cradle: true,
              desc: '不攻擊。迷羊走到他那一格就立刻安全，不必走到最左邊。放前面一點羊回來得快，但他自己會先被咬', ref: '賽 40:11' },
};
const ELDER_MUL = 0.6;    // 老牧人送糧間隔倍數
const ELDER_COST = 75;
const REPAIR_COST = 25, REPAIR_HP = 120, REPAIR_CD = 8; // 修補一次要隔 8 秒，不能一直點
const REPAIR_HINT = 0.7;  // 牆血低於這個比例（且糧夠）才掛「修補」角標；點了任何受傷的牆都修得了
const MAX_CARDS = 8;      // 一關最多帶幾張卡上場，超過就要點兵
const MIN_CARDS = 4;      // 點兵至少要帶幾張（只帶牧人等於沒得打）
const SELL_RATE = 0.5;    // 鏟子拆掉單位退幾成糧（含升老牧人花的）
// 拿著卡直接點同類單位＝一次完成「鏟掉＋放下」（James 2026-10-18：佈陣時石牆原地換守望樓，省掉四個動作）
// 只開牆類與投手類；輔助類（油燈／火盆／吹角手…）各做各的事不互換。只能換成更貴的，守望樓換回石牆這種「倒拿糧又回滿血」先擋掉
const SWAP_KINDS = ['blocker', 'shooter'];
// 預設帶卡的先後：這關新開的一定帶、牧人一定帶，其餘依這個順序補滿
const PICK_ORDER = ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'volley', 'staff', 'lamp', 'tower', 'archer', 'brazier', 'horn', 'catapult', 'healer', 'cradle', 'patrol', 'jar', 'thorns', 'hireling'];

// ====== 敵人 ======
// 特殊欄位：flying 飛的／dodge 閃避率／digs 鑽地／vaults 翻牆／steals 偷羊／enrage 狂暴／howl 嚎叫秒數／roar 咆哮秒數
// 偷雞摸狗的（dodge／vaults／steals／digs 任一）＝狗的獵物，狗對牠們用 hunt 傷害
// boss 頭目：腳印預告用牠的圖示並放大；同一波第二隻頭目走不同排
// thick 厚皮：石子和箭只打 THICK_MUL（35%），機弦、投石機、火、毒全額（所以「石子打不痛牠」）；prio 狗優先咬誰（越大越先）
const ENEMIES = {
  // ref：經文出處（圖鑑敵方頁顯示；正本對照表在 docs/roster.md）
  wolf:    { name: '狼',     ico: '🐺', hp: 60,  speed: 0.22, bite: 12, ref: '創 31:39' },
  fast:    { name: '快狼',   ico: '🐺', hp: 40,  speed: 0.40, bite: 10, cls: 'fast', ref: '哈 1:8' },
  alpha:   { name: '領頭狼', ico: '🐺', hp: 200, speed: 0.20, bite: 15, cls: 'alpha', howl: 8, prio: 4, boss: true, ref: '哈 1:8',
             tip: '嚎叫讓附近狼群加速。派牧羊犬咬住牠' },
  bear:    { name: '母熊',   ico: '🐻', hp: 420, speed: 0.15, bite: 25, cls: 'big', enrage: 0.5, thick: true, prio: 2, boss: true, ref: '撒下 17:8',
             tip: '血量高，半血狂暴。石子傷害低，改用機弦手' },
  lion:    { name: '獅子',   ico: '🦁', hp: 600, speed: 0.15, bite: 30, cls: 'big lion', roar: 12, wallMul: 4, thick: true, prio: 2, boss: true, ref: '摩 3:8',
             tip: '咆哮讓附近夥伴停手，拆牆很快。狗拖住，機弦手集中攻擊' },
  thief:   { name: '賊',     ico: '🥷', hp: 70,  speed: 0.25, bite: 10, cls: 'human', vaults: true, prio: 3, ref: '約 10:1',
             tip: '會翻過石牆，改用守望樓攔截' },
  rustler: { name: '偷羊人', ico: '🧔', hp: 90,  speed: 0.30, bite: 4,  cls: 'human light', steals: true, fleeSpeed: 0.45, prio: 5, ref: '創 31:39',
             tip: '不攻擊，走到底就抱羊逃跑。派牧羊犬追捕救羊' },
  fox:     { name: '小狐狸', ico: '🦊', hp: 30,  speed: 0.35, bite: 6,  cls: 'small', dodge: 0.7, prio: 3, ref: '歌 2:15',
             tip: '十顆石子閃掉七顆。改用牧羊犬或荊棘' },
  locust:  { name: '蝗群',   ico: '🦗', hp: 8,   speed: 0.30, bite: 2,  cls: 'swarm', ref: '箴 30:27',
             tip: '成群出現，用弓箭手穿透，一箭打多隻' },
  digger:  { name: '野狗',   ico: '🐕‍🦺', hp: 80, speed: 0.22, bite: 12, cls: 'dig', digs: true, digSpeed: 0.35, ref: '瑪 1:3',
             tip: '鑽地繞過前排。土堆是牠冒出來的地方，在土堆左邊放牆或狗' },
  bird:    { name: '鷙鳥',   ico: '🦅', hp: 50,  speed: 0.20, bite: 0,  cls: 'fly', flying: true, ref: '創 15:11',
             tip: '飛越牆與狗，射手的投射和瓦瓶火把才打得到' },
  // ====== 第二章「另外的羊」 ======
  // detour 繞路：前面是牆、隔壁排同一格沒牆就跳過去（冷卻秒數）；slam 撞牆第一下傷害、slamStun 撞完自己暈幾秒、trample 踩爛荊棘
  // drift 在上下幾排之間飄、driftT 飄一圈幾秒；shiftEvery 每幾秒換一排；crouchAt 走到第幾格蹲、crouch 蹲幾秒、dash 之後衝幾格
  jackal:  { name: '豺狼',   ico: '🐺', hp: 70,  speed: 0.26, bite: 12, cls: 'sly', detour: 6, prio: 3, ref: '耶 5:6',
             tip: '碰到牆就繞到隔壁排。光靠牆攔不住，派牧羊犬咬住牠' },
  boar:    { name: '野豬',   ico: '🐗', hp: 320, speed: 0.30, bite: 20, cls: 'big boar', slam: 100, slamStun: 1.5, trample: true, prio: 2, ref: '詩 80:13',
             tip: '撞牆第一下很重，還會踩爛荊棘。守望樓擋得住，機弦手打得快' },
  owl:     { name: '夜鴞',   ico: '🦉', hp: 60,  speed: 0.18, bite: 0,  cls: 'fly owl', flying: true, drift: 1, driftT: 4, ref: '詩 102:6',
             tip: '在排與排之間飄，單排射手常打空。投石隊一次打三排' },
  leopard: { name: '豹',     ico: '🐆', hp: 650, speed: 0.28, bite: 28, cls: 'big leopard', thick: true, vaults: true, shiftEvery: 7, crouchAt: 5, crouch: 2, dash: 2, prio: 2, boss: true, ref: '耶 5:6',
             tip: '跳過牆、每隔幾秒換一排走，蹲下來就要衝了。牧羊犬咬住牠，投石隊三排盯著' },
};

// 迷羊（中立，不是敵人）：從右邊走進來往羊圈走，走到最左邊或抱羊羔的牧人那格就回圈；地面敵人碰到就叼走
const STRAY = { name: '迷羊', ico: '🐑', speed: 0.15, reward: 25, ref: '路 15:4' };

const THICK_MUL = 0.35; // 厚皮敵人吃石子、箭的比例（圖鑑「效果」頁也讀這個）

// 圖鑑把移動速度翻成快／慢的門檻（每秒走幾格）
const SPEED_FAST = 0.35, SPEED_SLOW = 0.15;

// ====== 狀態效果（秒數與強度） ======
const STATUS = {
  burn:   { t: 5,   dps: 4 },        // 燃燒：每秒掉血，碰到隔壁沒燒的會傳火
  poison: { t: 8,   dps: 4, biteMul: 0.6 },
  slow:   { mul: 0.5 },
  howl:   { t: 5,   mul: 1.5 },
  fear:   { t: 3 },                  // 掛在我方單位
  panic:  { speed: 1.0 },            // 驚慌：往右跑
  hop:    { t: 0.6 },                // 換排：從這排滑到隔壁排要幾秒（畫面用，引擎的排號是立刻換）
  dash:   { mul: 2.5 },              // 豹蹲完衝刺的速度倍數
};

// ====== 難度（對每一關都有效；只影響第二波起） ======
// gates：這個難度哪幾排門口有看門的（2026-10-20：寧靜夜五位、起風夜中間三位、暴風夜第 2、4 排兩位；關卡 gates: false 一律沒有）
const DIFFS = {
  calm:  { name: '寧靜夜', hint: '敵人較少，先熟悉怎麼守',  shepherdEvery: 7,  countMul: 1,   hpMul: 1,    gapMul: 1,    gates: [0, 1, 2, 3, 4] },
  windy: { name: '起風夜', hint: '敵人更多、血量更高，看門的只剩中間三排', shepherdEvery: 7,  countMul: 1.3, hpMul: 1.25, gapMul: 0.77, gates: [1, 2, 3] },
  storm: { name: '暴風夜', hint: '產糧較慢，敵人又多又壯，看門的只剩兩位',  shepherdEvery: 10, countMul: 1.3, hpMul: 1.25, gapMul: 0.77, gates: [1, 3] },
};

const PREP_TIME = 18;      // 第一波來之前的準備秒數（關卡可覆寫）
const WAVE_REST = 6;       // 清完一波後休息幾秒
const FORESHADOW_LEAD = 3; // 倒數剩幾秒先印腳印
const START_FOOD = 150;
const TRICKLE = { every: 5, gives: 5 }; // 沒放牧人也會慢慢有糧

// ====== 關卡 ======
// units：這一關能用的卡（順序＝卡片順序）；fresh：這一關新開的卡（會閃光）
// must：預設隊伍一定帶的卡（提示會教到的那幾張，免得玩家沒換隊就被指向沒帶的卡）
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
    id: 15, name: '哈蘭的第二夜', title: '狼也多了', ref: '取材：創世記 30:29-30，雅各替拉班看守的羊群增多',
    speaker: '雅各',
    intro: '拉班的羊群一年比一年多，狼也跟著多。今晚他把狗交給我，我交給你。狼衝過來的時候，狗會撲上去咬住牠。',
    units: ['shepherd', 'slinger', 'wall', 'dog'], fresh: ['dog'],
    tips: ['🐕 牧羊犬會撲上去咬住敵人，被咬住的敵人停下來改咬狗；狗受傷會回窩休息，不會死', '狼會從五排來，每排都要有射手，狗放在最吃緊的那排'],
    waves: [
      { list: [['wolf', 5]],              gap: 4.5, rows: [1, 2, 3],       hpMul: 1,   say: '第 1 波，狼' },
      { list: [['fast', 6], ['wolf', 4]], gap: 2.4, rows: [0, 1, 2, 3, 4], hpMul: 1.3, say: '快狼衝過來了', hint: '下一波有快狼，衝得快。牧羊犬撲上去咬住牠就停了，狗放在牆後面' },
      { list: [['wolf', 9], ['fast', 6]], gap: 2.0, rows: [0, 1, 2, 3, 4], hpMul: 1.6, say: '最後一波', hint: '最後一波狼更多更快。每排都要有射手，狗顧最吃緊的那排' },
    ],
    outroWin: '天亮了。雅各說：「我未來之先，你所有的很少，現今卻發大眾多」（創 30:30）。',
    outroLose: { wolf: '狼比羊多的時候，光靠牆不夠。放一隻狗在牆後面，牠會撲上去咬住敵人。' },
  },
  {
    id: 2, name: '大衛的曠野', title: '伯利恆的曠野', ref: '取材：撒母耳記上 17 章，大衛在曠野為父親放羊',
    speaker: '大衛',
    intro: '我為父親放羊，有時來了獅子，有時來了熊，從群中叼一隻羊羔去，我就追上去打牠。今晚換你，機弦給你了，狗也帶著。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog'], fresh: ['sling'],
    tips: ['🐾 腳印換成牠的樣子，表示下一隻從那排來的不是普通的狼'],
    waves: [
      { list: [['wolf', 5]],                             gap: 4.5, rows: [1, 2, 3],       hpMul: 1,   say: '第 1 波，先是狼' },
      { list: [['alpha', 1], ['wolf', 6], ['fast', 2]],  gap: 2.4, rows: [0, 1, 2, 3, 4], hpMul: 1.2, ordered: true, say: '領頭狼來了', hint: '領頭狼要來了，嚎叫會讓狼群加速。先放牧羊犬' },
      { list: [['bear', 1], ['wolf', 5]],                gap: 3.0, rows: [0, 1, 2, 3, 4], hpMul: 1.3, ordered: true, say: '熊來了', hint: '聽見了嗎，是熊。石子傷害低，機弦手準備' },
      { list: [['lion', 1], ['wolf', 8], ['fast', 4]],   gap: 2.4, rows: [0, 1, 2, 3, 4], hpMul: 1.5, ordered: true, say: '獅子來了，最後一波', hint: '最後一波有獅子，拆牆很快。牧羊犬拖住，機弦手集中攻擊' },
    ],
    outroWin: '天亮了。大衛說：「耶和華救我脫離獅子和熊的爪，也必救我脫離這非利士人的手。」（撒上 17:37）',
    outroLose: { wolf: '大衛說：「有時來了獅子，有時來了熊。」碰上牠們，光靠牆撐不了多久，得讓機弦手多打幾發。明晚再來。' },
  },
  {
    id: 3, name: '雇工與賊', title: '羊的門', ref: '取材：約翰福音 10 章',
    speaker: null,
    intro: '「人進羊圈，不從門進去，倒從別處爬進去，那人就是賊，就是強盜。」（約 10:1）「若是雇工，不是牧人，羊也不是他自己的，他看見狼來，就撇下羊逃走。」（約 10:12）今晚羊圈裡有三隻羊，被偷光就守不住了。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'hireling', 'tower'], fresh: ['hireling', 'tower'],
    tips: ['🐑 羊圈裡有三隻羊，偷羊人抱著羊往回跑時，追上牠羊就回來', '🗼 拿著守望樓的卡直接點石牆，原地換掉；石牆退一半糧，跟鏟子一樣'],
    sheep: 3,
    waves: [
      { list: [['wolf', 4]],                              gap: 5.0, rows: [1, 2, 3],       hpMul: 1,   say: '第 1 波，狼不多' },
      { list: [['wolf', 8], ['fast', 3]],                 gap: 2.2, rows: [0, 1, 2, 3, 4], hpMul: 1.3, say: '狼多起來了', hint: '下一波狼更多，雇工遇敵會逃，別只靠他' },
      { list: [['thief', 1], ['wolf', 5], ['thief', 2]],  gap: 2.6, rows: [0, 1, 2, 3, 4], hpMul: 1.4, ordered: true, say: '有人翻牆', hint: '有賊混進來，石牆攔不住，改用守望樓' },
      { list: [['rustler', 1], ['fox', 3], ['wolf', 6], ['rustler', 2], ['fox', 3]], gap: 2.0, rows: [0, 1, 2, 3, 4], hpMul: 1.6, ordered: true, say: '偷羊的來了', hint: '偷羊人會抱羊逃跑，派牧羊犬追捕救羊' },
    ],
    outroWin: '天亮了。耶穌說：「我是好牧人；好牧人為羊捨命。」（約 10:11）',
    outroLose: {
      wolf: '狼闖進來了。雇工早已逃走，牆後沒人接應。明晚別只靠雇工。',
      sheep: '三隻羊都被抱走了。偷羊人抱起羊就跑，牆攔不住，得派牧羊犬追上去。',
    },
  },
  {
    id: 16, name: '葡萄園的小狐狸', title: '擒拿狐狸', ref: '取材：雅歌 2:15，毀壞葡萄園的小狐狸',
    speaker: '葡萄園的守望者',
    intro: '葡萄正在開花，狐狸夜裡來咬藤。羊圈就在園子旁邊，今晚只有這幾個人手。狐狸常閃過石子，得靠狗追上去咬住。',
    units: ['shepherd', 'slinger', 'wall', 'dog', 'hireling'], fresh: [],
    tips: ['🐑 羊圈裡有五隻羊；偷羊人抱羊逃跑時，派牧羊犬追上救羊', '🦊 狐狸七成閃過石子，牧羊犬追上去才抓得到；每排一隻狗', '這一夜只有這五種卡，沒有機弦手和守望樓，賊翻過牆也交給狗'],
    sheep: 5,
    waves: [
      { list: [['fox', 4]],                                         gap: 3.5, rows: [1, 2, 3],       hpMul: 1,   say: '狐狸來了' },
      { list: [['thief', 1], ['fox', 6]],                           gap: 2.4, rows: [0, 1, 2, 3, 4], hpMul: 1.2, ordered: true, say: '有人翻牆', hint: '狐狸七成閃得過石子，狗抓得到。賊會翻過石牆，狗也追得上' },
      { list: [['rustler', 2], ['fox', 5], ['wolf', 3]],            gap: 2.2, rows: [0, 1, 2, 3, 4], hpMul: 1.3, ordered: true, say: '偷羊的來了', hint: '偷羊人抱著羊往回跑，狗追上去羊就回來。狼還是交給投石手' },
      { list: [['rustler', 3], ['fox', 8], ['thief', 2]],           gap: 1.8, rows: [0, 1, 2, 3, 4], hpMul: 1.5, ordered: true, say: '最後一波', hint: '最後一波狐狸最多，還有賊和偷羊人。每排放牧羊犬，雇工補上投石攻擊' },
    ],
    outroWin: '天亮了，羊群守住了。守望者說：「要給我們擒拿狐狸，就是毀壞葡萄園的小狐狸，因為我們的葡萄正在開花。」（歌 2:15）',
    outroLose: {
      sheep: '五隻羊都被抱走了。狐狸閃得掉石子，閃不掉狗。每排放一隻狗。',
      wolf: '狼闖進來了。狐狸交給狗，狼還是要靠投石手和牆。',
    },
  },
  {
    id: 4, name: '何烈山下', title: '大而可怕的曠野', ref: '取材：出埃及記 3:1、申命記 8:15',
    speaker: '摩西',
    intro: '葉忒羅的羊今晚在這曠野過夜。這曠野大而可怕，有火蛇、蠍子，地上盡是石頭。你守東邊，我守西邊。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'thorns'], fresh: ['archer', 'thorns'],
    tips: ['🪨 有石頭的格子不能放東西'],
    rocks: [[0, 3], [2, 2], [3, 5], [4, 1]],
    waves: [
      { list: [['wolf', 5]],                             gap: 4.5, rows: [1, 2, 3],       hpMul: 1,   say: '第 1 波，狼' },
      { list: [['locust', 18]],                          gap: 0.6, rows: [1, 3],          hpMul: 1,   say: '蝗群來了', hint: '聽，像風一樣的聲音。蝗群來了，用弓箭手穿透，一箭打多隻' },
      { list: [['digger', 1], ['wolf', 6], ['digger', 2]], gap: 2.6, rows: [0, 1, 2, 3, 4], hpMul: 1.4, ordered: true, say: '地在動', hint: '野狗會鑽地繞過前排。土堆出現後，在它左邊放牆或狗' },
      { list: [['locust', 20], ['wolf', 7], ['digger', 3], ['fast', 4]], gap: 1.2, rows: [0, 1, 2, 3, 4], hpMul: 1.7, say: '最後一波，全來了', hint: '最後一波全來了，弓箭手穿透、荊棘減速' },
    ],
    outroWin: '天亮了。摩西領著羊群往山那邊去，那山叫何烈山。（出 3:1）',
    outroLose: { wolf: '摩西說：這曠野大而可怕。地底來的，前排石牆攔不住，中間也得有人守。' },
  },
  {
    id: 5, name: '提哥亞的牧人', title: '誰不懼怕', ref: '取材：阿摩司書 1:1、3:8、5:19',
    speaker: '阿摩司',
    intro: '我是牧人，又是修理桑樹的，不是先知的門徒。獅子吼叫，誰不懼怕？今晚天上也要看著，鷙鳥會飛過牆。火盆給你，石子穿過火就會燒。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'thorns', 'brazier'], fresh: ['brazier'], must: ['thorns'],
    tips: ['🦂 荊棘學會新招：放下後再點一下花 50 糧撒蠍子，踩入的敵人中毒', '🔥 火盆要放在射手前面，石子穿過才會變火', '🦅 鷙鳥飛過牆和狗，只有投射攻擊打得到'],
    waves: [
      { list: [['wolf', 6]],                                  gap: 4.0, rows: [1, 2, 3],       hpMul: 1,   say: '第 1 波，狼' },
      { list: [['bird', 1], ['wolf', 6], ['bird', 2]],        gap: 2.6, rows: [0, 1, 2, 3, 4], hpMul: 1.3, ordered: true, say: '天上有東西', hint: '抬頭。鷙鳥會飛過牆，每排都要有射手' },
      { list: [['wolf', 12], ['fast', 4]],                    gap: 1.2, rows: [2],             hpMul: 1.4, say: '狼擠在同一排', hint: '這波集中走中排，用火盆讓燃燒在狼群間蔓延' },
      { list: [['bear', 1], ['wolf', 8], ['bird', 3], ['bear', 1]], gap: 2.0, rows: [0, 1, 2, 3, 4], hpMul: 1.7, ordered: true, say: '躲避獅子又遇見熊', hint: '熊來了。荊棘減速，讓機弦手多打幾發' },
    ],
    outroWin: '天亮了。阿摩司說，牧人從獅子口中只能搶回兩條羊腿或半個耳朵（摩 3:12）。今晚你搶回的是整群。',
    outroLose: { wolf: '阿摩司說：「躲避獅子又遇見熊。」（摩 5:19）明晚再守。把火盆放在射手前面，讓石子穿過火。', bird: '鷙鳥飛過牆，闖進羊圈了。天上的敵人得靠射手攔下，每排都要有人。' },
  },
  {
    id: 6, name: '基甸的三百人', title: '瓶子、火把、角', ref: '取材：士師記 7 章',
    speaker: '基甸',
    intro: '三百人對一大群，多如蝗蟲。瓶子、火把、角，各人站在自己的地方。天亮前就見分曉。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'thorns', 'brazier', 'jar', 'horn'], fresh: ['jar', 'horn'], must: ['archer'],
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
    id: 17, name: '烏西雅的牧場', title: '望樓與機器', ref: '取材：歷代志下 26:10、15，烏西雅的牧人與巧匠做的機器',
    speaker: '烏西雅的牧人',
    intro: '王在曠野建了望樓、挖了井，因為牲畜甚多。王的巧匠做的機器，也送了一台到這座望樓。今晚牆會被咬得很慘，纏裹的人也來了。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'thorns', 'brazier', 'jar', 'horn', 'healer', 'catapult'], fresh: ['healer', 'catapult'], must: ['sling'],
    tips: ['🩹 纏裹的牧人放在牆後一格；🛞 投石機專打擠成一串的狼'],
    waves: [
      { list: [['wolf', 6]],                                              gap: 4.0, rows: [1, 2, 3],       hpMul: 1,   say: '第 1 波，狼' },
      { list: [['wolf', 10], ['fast', 4]],                                gap: 1.6, rows: [0, 1, 2, 3, 4], hpMul: 1.3, say: '五排一起咬牆', hint: '下一波狼從五排來，會一直咬牆。纏裹的牧人放在牆後一格，周圍八格的夥伴每秒回復血量' },
      { list: [['wolf', 14], ['locust', 16]],                             gap: 0.8, rows: [2],             hpMul: 1.5, say: '擠成一串', hint: '這波擠在中排走成一串，投石機一砸一片' },
      { list: [['bear', 1], ['alpha', 1], ['bird', 4], ['wolf', 10], ['fast', 4]], gap: 1.8, rows: [0, 1, 2, 3, 4], hpMul: 1.8, ordered: true, say: '最後一波', hint: '熊和領頭狼一起來。機弦手打熊、狗咬住領頭狼，鷙鳥交給射手' },
    ],
    outroWin: '天亮了。「又在曠野與高原和平原，建築望樓，挖了許多井，因他的牲畜甚多」（代下 26:10）。',
    outroLose: { wolf: '狼把牆咬破了。下次把纏裹的牧人放在牆後一格，持續回復周圍八格夥伴的血量。', bird: '鷙鳥飛進羊圈了。天上的只有射手打得到，每排都要有人。' },
  },
  {
    id: 7, name: '尋找我的羊', title: '第一章最後一夜', ref: '取材：以西結書 34 章、詩篇 23 篇',
    speaker: null,
    intro: '「牧人在羊群四散的日子怎樣尋找他的羊，我必照樣尋找我的羊。」「失喪的，我必尋找；被逐的，我必領回；受傷的，我必纏裹；有病的，我必醫治。」（結 34:12、16）這是第一章的最後一夜。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'thorns', 'brazier', 'jar', 'horn', 'healer', 'catapult'], fresh: [], must: ['archer', 'healer', 'catapult'],
    tips: ['🦁 今晚共五波，最後一波有兩隻獅子', '🫗 纏裹的牧人放下後再點一下花 50 糧膏油，回血範圍擴大到 5×5，放中排就顧得到五條線'],
    sheep: 3,
    waves: [
      { list: [['wolf', 6], ['fast', 2]],                                   gap: 3.0, rows: [0, 1, 2, 3, 4], hpMul: 1.2, say: '第 1 波' },
      { list: [['wolf', 12], ['locust', 15]],                               gap: 1.0, rows: [1, 2, 3],       hpMul: 1.4, say: '擠成一串', hint: '下一波敵人密集，用投石機的濺射一砸一片' },
      { list: [['thief', 3], ['rustler', 2], ['fox', 4], ['digger', 3]],    gap: 2.0, rows: [0, 1, 2, 3, 4], hpMul: 1.5, say: '賊和偷羊的', hint: '賊、偷羊人、狐狸、野狗齊來，備好牧羊犬與守望樓' },
      { list: [['bear', 2], ['alpha', 2], ['bird', 4], ['wolf', 10]],       gap: 1.8, rows: [0, 1, 2, 3, 4], hpMul: 1.7, ordered: true, say: '熊和領頭狼', hint: '兩隻熊、兩隻領頭狼，還有鷙鳥，地面空中都要顧' },
      { list: [['lion', 1], ['wolf', 10], ['lion', 1], ['fast', 8], ['locust', 20]], gap: 1.5, rows: [0, 1, 2, 3, 4], hpMul: 2,   ordered: true, say: '兩隻獅子，最後一波', hint: '最後兩隻獅子。獅子交給狗和機弦手，纏裹的牧人膏油後顧住整排石牆' },
    ],
    outroWin: '天亮了。',
    psalmTitle: '詩篇二十三篇',
    psalm: ['耶和華是我的牧者，我必不致缺乏。', '他使我躺臥在青草地上，領我在可安歇的水邊。', '他使我的靈魂甦醒，為自己的名引導我走義路。', '我雖然行過死蔭的幽谷，也不怕遭害，因為你與我同在；你的杖，你的竿，都安慰我。', '在我敵人面前，你為我擺設筵席；你用油膏了我的頭，使我的福杯滿溢。', '我一生一世必有恩惠慈愛隨著我；我且要住在耶和華的殿中，直到永遠。'],
    outroLose: {
      wolf: '「失喪的，我必尋找。」（結 34:16）天還沒亮，再守一夜。',
      sheep: '羊被抱走了。「被逐的，我必領回。」（結 34:16）再守一夜。',
      bird: '鷙鳥飛進羊圈了。下一次也留人守住天上。再守一夜。',
    },
  },

  // ====== 第二章「另外的羊」（id 8-14）：無月夜＋跨路徑 ======
  // chapter：關卡選單分章；moonless：第幾波起看不見腳印（油燈照到的排例外）；strays：這波開始後第幾秒走進一隻迷羊
  // rest：波間休息秒數（預設 WAVE_REST）；startFood：開局糧（預設 START_FOOD）；maxUnits：{ 單位: 上限 } 這一夜某種單位最多放幾位；gates: false 關掉看門的（預設每排一位）；shepherdScale：暴風夜產糧拉長的折扣，只動產糧（預設跟 diffScale）
  // conveyor：送卡模式（卡定時送到手上、費用 0、沒有糧；start 開局先給哪幾張、every 幾秒送一張、max 手上最多幾張、weights 抽卡權重）；give：這波開始時一定先送到的卡
  {
    id: 8, chapter: 2, name: '井邊的夜', title: '別的牧人', ref: '取材：出埃及記 2:16-20，西坡拉姊妹在井邊',
    speaker: '西坡拉', moonless: 2,
    intro: '我們姊妹七個，天天來打水給父親的羊喝，別的牧人總把我們趕走。今天有一個埃及人站出來替我們打水。今晚羊群在井邊過夜，月亮快下山了，父親把杖交給你。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'thorns', 'brazier', 'jar', 'horn', 'healer', 'catapult', 'staff'], fresh: ['staff'], must: ['dog'],
    tips: ['🌑 月亮下山後看不到腳印預告，每排都要顧'],
    waves: [
      { list: [['wolf', 5]],                                   gap: 4.5, rows: [1, 2, 3],       hpMul: 1,   say: '第 1 波，狼' },
      { list: [['wolf', 8], ['fast', 3]],                      gap: 2.4, rows: [0, 1, 2, 3, 4], hpMul: 1.3, say: '月亮下山了', hint: '月亮快下山了，之後看不見腳印。狼會散開五排來，用牧人杖把牠們趕到同一排打' },
      { list: [['jackal', 1], ['wolf', 7], ['jackal', 2]],     gap: 2.4, rows: [0, 1, 2, 3, 4], hpMul: 1.45, ordered: true, say: '有東西繞過牆', hint: '豺狼碰到牆就繞到隔壁排，光靠牆不夠。派牧羊犬咬住牠' },
      { list: [['jackal', 4], ['wolf', 10], ['fast', 4]],      gap: 1.8, rows: [0, 1, 2, 3, 4], hpMul: 1.7, say: '最後一波', hint: '最後一波豺狼更多。杖把狼趕進一排、狗守豺狼' },
    ],
    outroWin: '羊一隻沒少。父親說：「那個人在哪裏？你們為甚麼撇下他呢？你們去請他來吃飯。」（出 2:20）今晚也請你。',
    outroLose: { wolf: '別的牧人趕走我們，狼也會趕走你。牧人杖放在沒有射手的那幾排，把狼趕過去打。' },
  },
  {
    id: 9, chapter: 2, name: '拉結的燈', title: '看得見才守得住', ref: '取材：創世記 29:9-11，拉結牧放父親的羊',
    speaker: '拉結', moonless: 2,
    intro: '父親的羊是我牧放的。今晚沒有月亮，井邊有野豬的腳印。燈給你，點著放在羊圈前面，看得見才守得住。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'thorns', 'brazier', 'jar', 'horn', 'healer', 'catapult', 'staff', 'lamp'], fresh: ['lamp'], must: ['sling', 'tower'],
    tips: ['🐗 野豬撞牆第一下很重，還會踩爛荊棘'],
    waves: [
      { list: [['wolf', 6]],                                               gap: 4.5, rows: [1, 2, 3],       hpMul: 1,   say: '第 1 波，狼' },
      { list: [['wolf', 8], ['fast', 4]],                                  gap: 2.2, rows: [0, 1, 2, 3, 4], hpMul: 1.2, say: '月亮下山了', hint: '沒有月亮了。油燈放中間，照亮三排，腳印就看得見，光裡的敵人也不會換排' },
      { list: [['boar', 1], ['wolf', 6]],                                  gap: 2.8, rows: [0, 1, 2, 3, 4], hpMul: 1.45, ordered: true, say: '聽，有東西在撞', hint: '是野豬。牠撞石牆第一下很重，還會踩爛荊棘。守望樓擋得住，機弦手打得快' },
      { list: [['boar', 2], ['wolf', 9], ['jackal', 3], ['fast', 3]],      gap: 1.8, rows: [0, 1, 2, 3, 4], hpMul: 1.7, say: '最後一波', hint: '兩頭野豬，看燈下的腳印決定機弦手放哪排' },
    ],
    outroWin: '天亮了，父親的羊一隻沒少。拉結說：那天雅各見到我，就放聲而哭。（創 29:11）',
    outroLose: { wolf: '拉結說：看不見的，就先點燈。油燈放中間那排，三排都亮。' },
  },
  {
    id: 10, chapter: 2, name: '迦密的夜', title: '未曾失落甚麼', ref: '取材：撒母耳記上 25:7、15-16，拿八的牧人在迦密',
    speaker: '迦密的牧人', moonless: 2, sheep: 3,
    intro: '我們在迦密放羊，大衛的少年人在田野與我們來往，晝夜作我們的保障，我們未曾失落甚麼。今晚山上有別人家的羊迷了路，會從東邊下來。牠們不是我們的羊，也一隻都不能少。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'thorns', 'brazier', 'jar', 'horn', 'healer', 'catapult', 'staff', 'lamp', 'patrol'], fresh: ['patrol'], must: ['dog', 'staff'],
    tips: ['🐑 迷羊從右邊走進來，狼碰到就叼走；走到最左邊就回圈，羊數加一。被叼出去就少一隻', ],
    waves: [
      { list: [['wolf', 6]],                                               gap: 4.5, rows: [1, 2, 3],       hpMul: 1,   say: '第 1 波，狼' },
      { list: [['wolf', 8]],                                               gap: 2.4, rows: [0, 1, 2, 3, 4], hpMul: 1.2, strays: [10, 25], say: '有羊迷路了', hint: '山上有別人的羊迷了路，會從右邊走過來，狼碰到就叼走。牧羊犬會護著牠走回來' },
      { list: [['wolf', 10], ['fast', 4], ['jackal', 2]],                  gap: 2.0, rows: [0, 1, 2, 3, 4], hpMul: 1.4, strays: [18], say: '狼多起來', hint: '巡夜人會在三排之間來回走，放中間排幫狗看著' },
      { list: [['boar', 1], ['jackal', 3], ['wolf', 10]],                  gap: 1.8, rows: [0, 1, 2, 3, 4], hpMul: 1.6, strays: [8, 30], say: '最後一波', hint: '最後兩隻迷羊會來。狼趕進一排，狗留在羊走的那排' },
    ],
    outroWin: '天亮了，羊圈裡比昨晚多了幾隻。「他們晝夜作我們的保障。」（撒上 25:16）今晚作保障的是你。',
    outroLose: {
      wolf: '狼進來了。巡夜人和牧人杖都是幫狗看著別排的，別把三排都壓給狗。',
      sheep: '迷羊被叼走了。牠們走哪排，狗就留哪排；狼走到羊前面之前就要打倒。',
    },
  },
  {
    id: 18, chapter: 2, name: '走迷的羊', title: '求你尋找僕人', ref: '取材：詩篇 119:176，我如亡羊走迷了路',
    speaker: null, moonless: 2, sheep: 3,
    intro: '「我如亡羊走迷了路，求你尋找僕人」（詩 119:176）。今晚山上有好幾隻走迷的羊要回來，狼也知道。羊圈裡只有三隻羊，帶回來的每一隻都算數。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'thorns', 'brazier', 'jar', 'horn', 'healer', 'catapult', 'staff', 'lamp', 'patrol'], fresh: [], must: ['dog', 'patrol'],
    tips: ['🐑 今晚有六隻迷羊會陸續從右邊走來；🐑 腳印出現在哪排，三秒後羊就從那排進來', '🐺 狼碰到迷羊就叼走，叼出場算失落一隻；羊圈只有三隻羊，別讓牠們被叼光', '🐕 牧羊犬沒事時會護送同排的迷羊；牧人杖把狼趕離羊走的那排'],
    waves: [
      { list: [['wolf', 5]],                                   gap: 4.5, rows: [1, 2, 3],       hpMul: 1,    say: '第 1 波，狼' },
      { list: [['wolf', 6], ['fast', 3]],                      gap: 2.4, rows: [0, 1, 2, 3, 4], hpMul: 1.25, strays: [6, 18, 30], say: '月亮下山了，羊也來了', hint: '月亮快下山了。這一波有三隻迷羊會陸續走來，看 🐑 腳印，狗先放那排' },
      { list: [['jackal', 2], ['wolf', 7], ['fast', 3]],       gap: 2.2, rows: [0, 1, 2, 3, 4], hpMul: 1.45, ordered: true, strays: [8, 22], say: '豺狼來了', hint: '豺狼會換排去追羊，巡夜人在三排之間來回走正好接得住' },
      { list: [['jackal', 4], ['wolf', 10], ['fast', 4]],      gap: 1.8, rows: [0, 1, 2, 3, 4], hpMul: 1.65, strays: [10], say: '最後一波', hint: '最後一波豺狼更多，還有一隻迷羊。巡夜人放中排，牧羊犬留在羊走的那排' },
    ],
    outroWin: '天亮了，羊圈守住了。「我如亡羊走迷了路，求你尋找僕人」（詩 119:176）。',
    outroLose: {
      wolf: '狼闖進羊圈了。顧迷羊的時候，自己的門也要守住，每排都要有射手。',
      sheep: '羊都被叼走了。迷羊從哪排進來，狗就先放那排；牧人杖把狼趕去別排。',
    },
  },
  {
    id: 11, chapter: 2, name: '拉班的工價', title: '給什麼用什麼', ref: '取材：創世記 30:31-32、31:7，拉班十次改了工價',
    speaker: '拉班', moonless: 2,
    intro: '我的羊，我的工價，我說了算；改十次也是我說了算。今晚我給你什麼人，你就用什麼人，不准挑。',
    units: ['slinger', 'wall', 'sling', 'dog', 'tower', 'thorns', 'jar', 'staff', 'lamp', 'patrol'], fresh: [],
    tips: ['🎁 今晚沒有糧也沒有牧人，卡片會定時送到手上，送來什麼就用什麼', '⛏️ 送來的卡沒花糧，拆掉也不退'],
    // 10/18 調平：7 秒一張（一晚約 26-29 張，之前 5 秒 36 張比棋盤格子還多）；比重壓平讓瓦瓶、守望樓真的抽得到
    conveyor: { every: 7.0, max: 6, start: ['slinger', 'wall', 'staff'],
      weights: { slinger: 22, wall: 14, sling: 12, dog: 10, staff: 10, thorns: 8, patrol: 7, lamp: 6, jar: 6, tower: 5 } },
    waves: [
      { list: [['wolf', 6]],                                               gap: 4.0, rows: [1, 2, 3],       hpMul: 1,   say: '第 1 波，狼', give: 'slinger' },
      { list: [['wolf', 8], ['jackal', 2], ['fast', 3]],                   gap: 2.4, rows: [0, 1, 2, 3, 4], hpMul: 1.35, give: 'staff', say: '豺狼混進來了', hint: '拉班送來什麼就先放下去，別等好卡；牧人杖把散開的狼趕進投石手那排' },
      { list: [['boar', 1], ['wolf', 8], ['fast', 4]],                     gap: 2.2, rows: [0, 1, 2, 3, 4], hpMul: 1.45, ordered: true, give: 'sling', say: '野豬來了', hint: '野豬要來了，機弦手送到就放在牠那排' },
      { list: [['alpha', 2], ['wolf', 12], ['jackal', 3], ['fast', 5]],    gap: 1.6, rows: [0, 1, 2, 3, 4], hpMul: 1.65, give: 'dog', say: '最後一波，全混在一起', hint: '最後一波有兩隻領頭狼。狗送到就放，嚎叫前咬住牠' },
    ],
    outroWin: '羊沒少。拉班數了兩遍，說：「工價的事，改天再談。」',
    outroLose: { wolf: '拉班說：給你什麼就用什麼，等好卡的人天亮前就沒羊了。' },
  },
  {
    id: 12, chapter: 2, name: '寬闊之地', title: '爭了就再挖一口井', ref: '取材：創世記 26:19-22，以撒的僕人挖井',
    speaker: '以撒', moonless: 2,
    intro: '我的僕人挖井，基拉耳人就來爭。爭了，我們就再挖一口。今晚夜鴞在井上飄，不走直線。投石隊左右兩手都能甩石，一次顧三排。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'thorns', 'brazier', 'jar', 'horn', 'healer', 'catapult', 'staff', 'lamp', 'patrol', 'volley'], fresh: ['volley'], must: ['tower'],
    tips: ['🦉 夜鴞在排與排之間飄，單排射手常打空'],
    waves: [
      { list: [['wolf', 6]],                                               gap: 4.0, rows: [1, 2, 3],       hpMul: 1,   say: '第 1 波，狼' },
      { list: [['owl', 1], ['wolf', 6], ['owl', 2]],                       gap: 2.6, rows: [0, 1, 2, 3, 4], hpMul: 1.3, ordered: true, say: '天上有東西在飄', hint: '夜鴞不走直線，單排射手打不準。投石隊一次打三排，放中間' },
      { list: [['wolf', 12], ['fast', 5], ['jackal', 3]],                  gap: 1.3, rows: [0, 1, 2, 3, 4], hpMul: 1.55, say: '五排一起來', hint: '狼散開五排來。兩隊投石隊放第 2、4 排就五排全蓋' },
      { list: [['owl', 5], ['boar', 2], ['wolf', 9], ['jackal', 3]],       gap: 1.6, rows: [0, 1, 2, 3, 4], hpMul: 1.9, say: '最後一波', hint: '地上野豬、天上夜鴞。守望樓擋豬，投石隊顧天上' },
    ],
    outroWin: '天亮了。以撒說：「耶和華現在給我們寬闊之地。」（創 26:22）',
    outroLose: {
      bird: '夜鴞飛進羊圈了。牠會飄到隔壁排，單排的射手等不到牠；投石隊放中間。',
      wolf: '以撒說：爭了就再挖一口井。再守一夜，投石隊放第 2、4 排。',
    },
  },
  {
    id: 19, chapter: 2, name: '交託的羊', title: '大衛去了戰場', ref: '取材：撒母耳記上 17:20，大衛將羊交託一個看守的人',
    speaker: '看守的人', moonless: 2, rest: 3,
    intro: '大衛早晨起來，把羊交託給我，就往戰場去了。今晚沒有月亮，野豬和豺狼一波接一波，中間幾乎沒得喘。羊是他的，一隻都不能少。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'thorns', 'brazier', 'jar', 'horn', 'healer', 'catapult', 'staff', 'lamp', 'patrol', 'volley'], fresh: [], must: ['sling', 'tower'],
    tips: ['⏱ 今晚波與波之間只歇 3 秒，先把牆和射手擺好，再想別的', '🐗 野豬撞牆第一下很重，守望樓擋得住；豺狼碰到牆就繞排'],
    waves: [
      { list: [['boar', 1], ['wolf', 5]],                                   gap: 3.0, rows: [1, 2, 3],       hpMul: 1,   ordered: true, say: '第 1 波，野豬打頭陣' },
      { list: [['jackal', 3], ['fast', 5]],                                 gap: 2.0, rows: [0, 1, 2, 3, 4], hpMul: 1.3, say: '月亮下山了', hint: '沒有月亮了，而且只歇 3 秒。油燈放中排，照亮三排' },
      { list: [['boar', 2], ['jackal', 2], ['owl', 1], ['wolf', 6]],        gap: 2.0, rows: [0, 1, 2, 3, 4], hpMul: 1.5, ordered: true, say: '兩頭野豬', hint: '兩頭野豬要來，守望樓擋第一下，機弦手傷害高；夜鴞交給投石隊' },
      { list: [['boar', 2], ['jackal', 4], ['wolf', 10], ['fast', 4]],      gap: 1.6, rows: [0, 1, 2, 3, 4], hpMul: 1.7, ordered: true, say: '最後一波', hint: '最後一波豺狼更多。牧羊犬咬住牠，石牆受傷就修補，別等牆倒了' },
    ],
    outroWin: '天亮了，羊一隻沒少。看守的人說：等他回來，照數交還他。',
    outroLose: { wolf: '歇息只有三秒，來不及擺的就擺不上了。開場先放牆和射手，牧人補在後面。', bird: '夜鴞飄進羊圈了。投石隊三排都打得到，放中排。' },
  },
  {
    id: 13, chapter: 2, name: '分開的羊群', title: '你向左，我就向右', ref: '取材：創世記 13:5-9，亞伯拉罕與羅得的牧人相爭',
    speaker: '亞伯拉罕', moonless: 2, sheep: 3,
    intro: '我的牧人和羅得的牧人相爭，兩家的羊在山裡混成一群。明天就要分開：你向左，我就向右。今晚先把走散的一隻隻帶回來。草叢裡有東西伏著，小心。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'thorns', 'brazier', 'jar', 'horn', 'healer', 'catapult', 'staff', 'lamp', 'patrol', 'volley', 'cradle'], fresh: ['cradle'], must: ['dog', 'volley'],
    tips: ['🐆 豹會跳過牆、每隔幾秒換一排走，蹲下來就是要衝了'],
    waves: [
      { list: [['wolf', 6], ['fast', 2]],                                  gap: 3.5, rows: [1, 2, 3],       hpMul: 1.1, say: '第 1 波' },
      { list: [['wolf', 8], ['jackal', 2]],                                gap: 2.2, rows: [0, 1, 2, 3, 4], hpMul: 1.3, strays: [6, 16, 28], say: '羊從山上下來了', hint: '羅得的羊會一隻隻下來。抱羊羔的牧人放前面一點，羊走到他那格就安全' },
      { list: [['owl', 3], ['wolf', 10], ['boar', 1]],                     gap: 1.8, rows: [0, 1, 2, 3, 4], hpMul: 1.5, strays: [12, 26], say: '天上地上都來', hint: '夜鴞和野豬一起來，投石隊顧天上、守望樓擋豬' },
      { list: [['leopard', 1], ['wolf', 8], ['fast', 4]],                  gap: 2.4, rows: [0, 1, 2, 3, 4], hpMul: 1.7, ordered: true, say: '草叢裡的東西出來了', hint: '是豹。牠會跳過牆、每隔幾秒換一排，蹲下來就要衝。牧羊犬咬住牠，投石隊三排盯著' },
    ],
    outroWin: '天亮了。亞伯拉罕說：「你向左，我就向右；你向右，我就向左。」（創 13:9）兩家的羊分開了，各走各的路。',
    outroLose: {
      wolf: '豹進來了。牠不走一條路，牆攔不住。狗咬住牠不讓牠換排，機弦手和投石隊一起打。',
      sheep: '迷羊被叼走了。抱羊羔的牧人放前面一點，羊早一步到他手上。',
      bird: '夜鴞飛進羊圈了。投石隊放中間，三排一起顧。',
    },
  },
  {
    id: 20, chapter: 2, name: '歌珊的夜', title: '剛到的一家人', ref: '取材：創世記 46:32-34、47:3-6，雅各一家到歌珊牧羊',
    speaker: '猶大', moonless: 2, startFood: 100, maxUnits: { shepherd: 3 }, shepherdScale: 0.3, // 牧人只能三位，暴風夜的產糧拉長再打更多折（只動產糧，敵人照一般 diffScale），不然雙重懲罰
    intro: '我們剛到歌珊，法老把最好的地給了我們，可是人手還沒到齊。今晚糧比平常少，牧人最多三位。羊是我們全家的本錢，守好牠們。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'thorns', 'brazier', 'jar', 'horn', 'healer', 'catapult', 'staff', 'lamp', 'patrol', 'volley', 'cradle'], fresh: [], must: ['sling', 'dog'],
    tips: ['🌾 今晚開局只有 100 糧，牧人最多三位；三位都升成老牧人，加快產糧', '🐆 豹會跳過石牆、每幾秒換一排，守望樓跳不過；狗咬住牠就不換排'],
    waves: [
      { list: [['wolf', 6]],                                                gap: 4.0, rows: [1, 2, 3],       hpMul: 1,    say: '第 1 波，狼' },
      { list: [['jackal', 1], ['wolf', 6], ['fast', 2]],                    gap: 2.4, rows: [0, 1, 2, 3, 4], hpMul: 1.2,  ordered: true, say: '月亮下山了', hint: '豺狼碰到牆會換排，派牧羊犬咬住牠；糧少，牧人記得升成老牧人' },
      { list: [['boar', 1], ['owl', 2], ['wolf', 8]],                       gap: 2.0, rows: [0, 1, 2, 3, 4], hpMul: 1.5,  ordered: true, say: '野豬和夜鴞', hint: '野豬撞牆、夜鴞飄排。守望樓擋豬，投石隊打鴞' },
      { list: [['leopard', 1], ['jackal', 3], ['wolf', 10], ['fast', 4]],   gap: 1.8, rows: [0, 1, 2, 3, 4], hpMul: 1.75, ordered: true, say: '豹來了，最後一波', hint: '豹又來了。守望樓擋牠，狗咬住牠就不換排，機弦手集中打' },
    ],
    outroWin: '天亮了。雅各的兒子們對法老說的話算數：「你僕人是牧羊的，連我們的祖宗也是牧羊的。」（創 47:3）',
    outroLose: { wolf: '糧少的時候，先放牧人再放射手，牆晚一點補。三位牧人都升成老牧人，產糧會更快。', bird: '夜鴞飄進羊圈了。投石隊三排都打得到，放中排。' },
  },
  {
    id: 14, chapter: 2, name: '合成一群', title: '另外的羊', ref: '取材：約翰福音 10:16、路加福音 15:4-6、以賽亞書 40:11',
    speaker: null, moonless: 2, sheep: 3,
    intro: '「我另外有羊，不是這圈裡的；我必須領他們來，他們也要聽我的聲音，並且要合成一群，歸一個牧人了。」（約 10:16）今晚山上還有羊沒回來，兩隻豹也在。',
    units: ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'thorns', 'brazier', 'jar', 'horn', 'healer', 'catapult', 'staff', 'lamp', 'patrol', 'volley', 'cradle'], fresh: [], must: ['horn', 'volley', 'dog'],
    tips: ['🎺 吹角手放下後再點一下花 75 糧換銀號，一吹五排敵人全退', '🐆 今晚共五波，最後一波兩隻豹走不同排'],
    waves: [
      { list: [['wolf', 7], ['fast', 2]],                                                   gap: 3.4, rows: [0, 1, 2, 3, 4], hpMul: 1.2, say: '第 1 波' },
      { list: [['jackal', 4], ['wolf', 10], ['boar', 1]],                                   gap: 1.8, rows: [0, 1, 2, 3, 4], hpMul: 1.5, say: '繞路的、撞牆的', hint: '豺狼和野豬一起來。吹角手換銀號，一吹五排都退一格' },
      { list: [['owl', 4], ['bird', 2], ['wolf', 10]],                                      gap: 1.6, rows: [0, 1, 2, 3, 4], hpMul: 1.6, strays: [10, 24], say: '天上滿了', hint: '夜鴞和鷙鳥都來，投石隊顧天上；迷羊會下來，狗留著' },
      { list: [['leopard', 1], ['alpha', 2], ['wolf', 10], ['boar', 2]],                    gap: 1.8, rows: [0, 1, 2, 3, 4], hpMul: 1.8, ordered: true, strays: [14, 30], say: '豹和領頭狼', hint: '一隻豹、兩隻領頭狼。狗咬豹，銀號留給嚎叫那一刻' },
      { list: [['leopard', 2], ['wolf', 12], ['fast', 8], ['jackal', 4], ['owl', 3]],       gap: 1.5, rows: [0, 1, 2, 3, 4], hpMul: 2.1, ordered: true, say: '兩隻豹，最後一波', hint: '最後一波兩隻豹走不同排。一隻狗一隻豹，投石隊放中間，銀號等牠們擠在一起' },
    ],
    outroWin: '天亮了。',
    psalm: ['「找著了，就歡歡喜喜地扛在肩上，回到家裡，就請朋友鄰舍來，對他們說：『我失去的羊已經找著了，你們和我一同歡喜吧！』」（路 15:5-6）', '「他必像牧人牧養自己的羊群，用膀臂聚集羊羔抱在懷中，慢慢引導那乳養小羊的。」（賽 40:11）'],
    outroLose: {
      wolf: '失去一隻，就撇下九十九隻去找。（路 15:4）再守一夜。',
      sheep: '羊被叼走了。再守一夜，抱羊羔的牧人放前面。',
      bird: '夜鴞飛進來了。投石隊放中間，天上三排一起顧。',
    },
  },
];

const DATA = { THICK_MUL, REPAIR_HINT, SPEED_FAST, SPEED_SLOW, ROWS, COLS, UNITS, ENEMIES, STRAY, STATUS, DIFFS, LEVELS, ELDER_MUL, ELDER_COST, REPAIR_COST, REPAIR_HP, REPAIR_CD, MAX_CARDS, MIN_CARDS, SELL_RATE, SWAP_KINDS, PICK_ORDER, PREP_TIME, WAVE_REST, FORESHADOW_LEAD, START_FOOD, TRICKLE };
if (typeof module !== 'undefined') module.exports = DATA; else window.DATA = DATA;
