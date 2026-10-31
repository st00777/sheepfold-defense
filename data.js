// 羊圈守夜 · 資料表。加單位、加敵人、加關卡都只改這裡。
// title：圖鑑角色頁的一句稱號（取自出處經文或角色定位，不進規則）。數值說明：cost 要花的糧；hp 能被咬幾下；every 幾秒做一次事；dmg 一下打多少；speed 每秒走幾格；bite 每秒咬掉多少血。
'use strict';

const ROWS = 5, COLS = 7;

// ====== 我方單位 ======
// kind：producer 產糧／shooter 射手／blocker 牆／dog 牧羊犬／floor 鋪地／instant 一次性／support 輔助／deflector 趕路（第二章）／patrol 巡夜（第二章）
// 第二章欄位：light 油燈照亮上下幾排（腳印預告回來）；lanes 射手同時打上下幾排；deflect 每趕一隻自己掉多少血；cradle 本排及上下鄰排的迷羊走到他的欄位就安全；walk 巡夜人每走一排要幾秒、reach 打前方幾格
// upgrade：放下後「再點一下」花糧升級，欄位會蓋過原本的（牧人升老牧人、石牆修補是另外寫死的特例）；fromId＝在哪一夜（id）學會，engine.js 載入時換算成 from＝那一夜的位置（顯示編號），desc 裡的 {from} 一併填入
// heal 每秒回血／range 回血範圍幾格（1＝周圍八格、2＝5×5）／brave 獅子咆哮嚇不停
const UNITS = {
  shepherd: { name: '牧人', title: '羊圈的根基，糧從他手裡來',     ico: '🧑‍🌾', cost: 50,  hp: 60,  kind: 'producer', every: 7,   gives: 25,
              desc: '定時產糧。再點一下升級成老牧人，產糧更快', ref: '創 31:40' },
  slinger:  { name: '投石手', title: '甩石不差毫髮的便雅憫人',   ico: '🙋',   cost: 100, hp: 60,  kind: 'shooter', every: 1.3, dmg: 20, shot: 'stone',
              desc: '投石攻擊同一排的敵人', ref: '士 20:16' },
  wall:     { name: '石牆', title: '為羊群築的牆',     ico: '🧱',   cost: 50,  hp: 300, kind: 'blocker',
              desc: '高血量擋路。再點一下花 25 糧修補', ref: '民 32:16' },
  sling:    { name: '機弦手', title: '一顆石子，撂倒巨人',   ico: '🎯',   cost: 150, hp: 60,  kind: 'shooter', every: 3.2, dmg: 90, shot: 'sling',
              desc: '單發傷害高、攻擊間隔長，專打獅子和熊', ref: '撒上 17:40' },
  dog:      { name: '牧羊犬', title: '追賊的，不要命的',   ico: '🐕',   cost: 75,  hp: 220, kind: 'dog', dps: 10, hunt: 30, run: 1.6, rest: 10,
              desc: '抓賊的。追咬賊、偷羊人、狐狸、野狗；大傢伙也能拖幾秒。同排幾隻狗會分頭咬，敵人少就一起上。受傷回窩休息，不會死', ref: '伯 30:1' },
  hireling: { name: '雇工', title: '見狼來就撇下羊逃走',     ico: '🤾',   cost: 25,  hp: 40,  kind: 'shooter', every: 0.9, dmg: 10, shot: 'stone', range: 2.5, flees: 1.0,
              desc: '低費短射程投石手，敵人一靠近就逃跑', ref: '約 10:12' },
  tower:    { name: '守望樓', title: '葡萄園中的樓，賊也翻不過',   ico: '🗼',   cost: 125, hp: 600, kind: 'blocker', tall: true,
              desc: '高血量防線，賊也翻不過', ref: '賽 5:2' },
  archer:   { name: '弓箭手', title: '在曠野長大的弓箭手',   ico: '🏹',   cost: 125, hp: 60,  kind: 'shooter', every: 1.8, dmg: 26, shot: 'arrow', pierce: true, falloff: 0.8,
              desc: '箭矢穿透整排，每穿一隻傷害降低', ref: '創 21:20' },
  thorns:   { name: '荊棘', title: '用荊棘堵住她的道',     ico: '🌿',   cost: 75,  hp: 150, kind: 'floor', slow: 0.5, dps: 6, wear: 3,
              desc: '鋪地減速並持續傷害，踩久會損壞。放在射手前面最划算；第 {from} 夜起再點一下撒蠍子', ref: '何 2:6',
              // 升級：再點一下花糧撒蠍子進去，踩入的敵人中毒（from＝第幾夜起學會）；持續有效，每隻敵人同一片荊棘只叮一次
              upgrade: { name: '荊棘蠍窩', ico: '🦂', cost: 50, fromId: 5, poison: 8, desc: '撒蠍子進荊棘，踩入的敵人中毒，持續有效', ref: '申 8:15' } },
  brazier:  { name: '火盆', title: '夜間按著更次看守羊群',     ico: '🔥',   cost: 75,  hp: 100, kind: 'support', ignite: true,
              desc: '點燃穿過的石子與箭矢，燃燒會傳給隔壁敵人', ref: '路 2:8' },
  jar:      { name: '瓦瓶火把', title: '打破瓦瓶，火把一亮', ico: '🏺',   cost: 100, hp: 0,   kind: 'instant', dmg: 30, panic: 2.5,
              desc: '一次性。九格範圍傷害，並嚇退敵人', ref: '士 7:19' },
  horn:     { name: '吹角手', title: '吹角，你們就蒙記念',   ico: '📯',   cost: 100, hp: 60,  kind: 'support', every: 20, push: 1, stun: 2,
              desc: '每 20 秒吹角，同排敵人後退一格並暈眩。第 {from} 夜起再點一下換銀號，五排一起退', ref: '民 10:9',
              // 升級：銀號，吹一次五排地面敵人全部後退並暈眩（all＝全場）
              upgrade: { name: '銀號', ico: '🎺', cost: 75, fromId: 14, all: true, desc: '換成銀號，吹一次五排的地面敵人全部後退一格並暈眩', ref: '民 10:2' } },
  healer:   { name: '纏裹的牧人', title: '受傷的，我必纏裹', ico: '🩹', cost: 100, hp: 60,  kind: 'support', every: 1, heal: 8, range: 1, brave: true,
              desc: '不攻擊，持續回復周圍八格夥伴的血量，不怕獅子咆哮。第 {from} 夜起再點一下膏油，範圍擴大到 5×5、回復更多血量', ref: '結 34:16',
              // 升級：再點一下花糧膏油，範圍 1 格→2 格（5×5 共 24 格）、回血 8→12；brave＝獅子咆哮嚇不停它
              upgrade: { name: '膏油', ico: '🫗', cost: 50, fromId: 7, heal: 12, range: 2, desc: '膏油後周圍 5×5 共 24 格的夥伴每秒回復 12 血量，一位顧整條防線', ref: '詩 23:5' } },
  catapult: { name: '投石機', title: '巧匠所設計的機器',   ico: '🛞',   cost: 200, hp: 80,  kind: 'shooter', every: 4, dmg: 45, shot: 'lob', splash: 1.2,
              desc: '攻擊同排最遠的敵人，濺射傷害波及落點周圍。拋射飛得過山坡。第 {from} 夜起再點一下換巧匠的機器，裝填快一半、濺射更大', ref: '代下 26:15',
              // 升級（第三章）：巧匠的機器，裝填 4 秒→2.6 秒、濺射 1.2→1.5 格；every／splash 蓋過原本的
              upgrade: { name: '巧匠的機器', ico: '⚙️', cost: 100, fromId: 28, every: 2.6, splash: 1.5, desc: '裝填 4 秒變 2.6 秒、濺射 1.2 格變 1.5 格，斜坡上擠成串的狼一砸一片', ref: '代下 26:15' } },
  // ====== 第二章「另外的羊」 ======
  staff:    { name: '牧人杖', title: '你的杖、你的竿，都安慰我',   ico: '🦯',   cost: 50,  hp: 150, kind: 'deflector', deflect: 10, deflectCd: 4,
              desc: '不攻擊。地面敵人走到它面前就被趕到隔壁排，放在沒有射手的排，把敵人趕進有射手的那排。頭目趕不動', ref: '詩 23:4' },
  lamp:     { name: '油燈', title: '她的燈終夜不滅',     ico: '🪔',   cost: 50,  hp: 60,  kind: 'support', light: 1,
              desc: '不攻擊。照亮自己這排和上下兩排：光裡的敵人不換排（豺狼不繞路、豹不跳排、夜鴞不飄），無月夜裡那三排的腳印預告也會回來。放中間那排最划算', ref: '箴 31:18' },
  patrol:   { name: '巡夜人', title: '晝夜作我們的保障',   ico: '🚶',   cost: 125, hp: 140, kind: 'patrol', every: 0.8, dmg: 18, walk: 1.2, reach: 1.3,
              desc: '在本排與上下鄰排巡邏，空閒時優先趕往近戰範圍內受威脅的排；接敵後留在那排攻擊。站在哪排就擋哪排的狼；鄰排那格有東西就走不進去', ref: '撒上 25:16' },
  volley:   { name: '投石隊', title: '左右兩手都能甩石',   ico: '🥌',   cost: 175, hp: 60,  kind: 'shooter', every: 1.6, dmg: 14, shot: 'stone', lanes: 1,
              desc: '同時投石攻擊自己這排和上下兩排。放中間一次顧三排，夜鴞飄到哪排都打得到', ref: '代上 12:2' },
  cradle:   { name: '抱羊羔的牧人', title: '用膀臂聚集羊羔，抱在懷中', ico: '🫂', cost: 75, hp: 100, kind: 'support', cradle: true,
              desc: '不攻擊。本排與上下鄰排的迷羊走到他所在的那一欄，就立刻安全。放前面接得早，但仍需保護他', ref: '賽 40:11' },
  // ====== 第三章「諸山間」 ======
  // lobNear 拋最前面那隻（投石機是拋最遠的）；hillOnly 只能放坡上；rolls 被咬垮或點一下推倒會滾石（rollDmg 傷害、rollPush 退幾格、rollStun 暈幾秒）；norepair 不能修補
  // trap 困住第一隻踩進來的地面敵人幾秒、trapBoss 頭目幾秒（一次性）；healAll 倒在哪格，九格內的夥伴回滿血
  lobber:    { name: '拋石手', title: '拋擲石頭有時',  ico: '🪃',  cost: 125, hp: 60,  kind: 'shooter', every: 2.0, dmg: 28, shot: 'lob', lobNear: true, splash: 0.45,
               desc: '把石頭拋到同排最前面那隻敵人頭上。拋得過山坡，厚皮也全額；落點小，通常只中一隻', ref: '傳 3:5' },
  cairn:     { name: '石堆', title: '堆聚石頭有時',    ico: '⛰️',  cost: 50,  hp: 200, kind: 'blocker', hillOnly: true, rolls: true, norepair: true, rollDmg: 80, rollPush: 1, rollStun: 1,
               desc: '只能堆在斜坡那三格，是一道便宜的牆。被咬垮或自己點一下推倒，石頭就滾下坡：右邊的地面敵人受傷、退一格、暈一下。不能修補、推倒不退糧', ref: '傳 3:5' },
  pit:       { name: '陷坑', title: '他就被陷在坑裡',    ico: '🕳️',  cost: 75,  hp: 1,   kind: 'floor', trap: 4, trapBoss: 2.5,
               desc: '一次性。第一隻踩進來的地面敵人困住 4 秒（頭目 2.5 秒），坑就塌了。挖在斜坡第一格（第 5 格、牆前面），困住的敵人卡在坡緣，射手打得到', ref: '結 19:8' },
  waterskin: { name: '水袋', title: '一皮袋水，給夏甲',    ico: '🥛',  cost: 75,  hp: 0,   kind: 'instant', healAll: true,
               desc: '一次性。倒在哪一格，九格內的夥伴血量回滿、不再害怕。守望樓被撞到剩一口氣時用', ref: '創 21:14' },
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
const PICK_ORDER = ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'lobber', 'cairn', 'pit', 'volley', 'staff', 'lamp', 'tower', 'archer', 'brazier', 'horn', 'catapult', 'healer', 'waterskin', 'cradle', 'patrol', 'jar', 'thorns', 'hireling'];

// ====== 敵人 ======
// 特殊欄位：flying 飛的／dodge 閃避率／digs 鑽地／vaults 翻牆／steals 偷羊／enrage 狂暴／howl 嚎叫秒數／roar 咆哮秒數
// 偷雞摸狗的（dodge／vaults／steals／digs 任一）＝狗的獵物，狗對牠們用 hunt 傷害
// boss 頭目：腳印預告用牠的圖示並放大；同一波第二隻頭目走不同排
// thick 厚皮：石子和箭只打 THICK_MUL（35%），機弦、投石機、火、毒全額（所以「石子打不痛牠」）；prio 狗優先咬誰（越大越先）
const ENEMIES = {
  // ref：經文出處（圖鑑敵方頁顯示；正本對照表在 docs/roster.md）
  // img：跟別的敵人共用同一個 emoji 時，自己那套圖的鍵（index.html 的 ICON_IMG／CHAR_KEYS 有對應）；ico 仍是文字備援與提示用的 emoji（10/28）
  wolf:    { name: '狼', title: '夜裡來撕裂的',     ico: '🐺', hp: 60,  speed: 0.22, bite: 12, ref: '創 31:39' },
  fast:    { name: '快狼', title: '比晚上的豺狼更猛',   ico: '🐺', img: 'fastwolf', hp: 40,  speed: 0.40, bite: 10, cls: 'fast', ref: '哈 1:8' },
  alpha:   { name: '領頭狼', title: '一聲長嚎，狼群齊奔', ico: '🐺', img: 'alphawolf', hp: 200, speed: 0.20, bite: 15, cls: 'alpha', howl: 8, prio: 4, boss: true, ref: '哈 1:8',
             tip: '嚎叫讓附近狼群加速。派牧羊犬咬住牠' },
  bear:    { name: '母熊', title: '田野裡丟崽子的母熊',   ico: '🐻', hp: 420, speed: 0.15, bite: 25, cls: 'big', enrage: 0.5, thick: true, prio: 2, boss: true, ref: '撒下 17:8',
             tip: '血量高，半血狂暴。石子傷害低，改用機弦手' },
  lion:    { name: '獅子', title: '獅子吼叫，誰不懼怕',   ico: '🦁', hp: 600, speed: 0.15, bite: 30, cls: 'big lion', roar: 12, wallMul: 4, thick: true, prio: 2, boss: true, ref: '摩 3:8',
             tip: '咆哮讓附近夥伴停手，拆牆很快。狗拖住，機弦手集中攻擊' },
  thief:   { name: '賊', title: '從別處爬進去的',     ico: '🥷', hp: 70,  speed: 0.25, bite: 10, cls: 'human', vaults: true, prio: 3, ref: '約 10:1',
             tip: '會翻過石牆，改用守望樓攔截' },
  rustler: { name: '偷羊人', title: '抱了羊就跑', ico: '🧔', hp: 90,  speed: 0.30, bite: 4,  cls: 'human light', steals: true, fleeSpeed: 0.45, prio: 5, ref: '創 31:39',
             tip: '不攻擊，走到底就抱羊逃跑。派牧羊犬追捕救羊' },
  fox:     { name: '小狐狸', title: '毀壞葡萄園的小狐狸', ico: '🦊', hp: 30,  speed: 0.35, bite: 6,  cls: 'small', dodge: 0.7, prio: 3, ref: '歌 2:15',
             tip: '十顆石子閃掉七顆。改用牧羊犬或荊棘' },
  locust:  { name: '蝗群', title: '沒有君王，卻分隊而出',   ico: '🦗', hp: 8,   speed: 0.30, bite: 2,  cls: 'swarm', ref: '箴 30:27',
             tip: '成群出現，用弓箭手穿透，一箭打多隻' },
  digger:  { name: '野狗', title: '曠野的野狗',   ico: '🐕‍🦺', hp: 80, speed: 0.22, bite: 12, cls: 'dig', digs: true, digSpeed: 0.35, ref: '瑪 1:3',
             tip: '鑽地繞過前排。土堆是牠冒出來的地方，在土堆左邊放牆或狗' },
  bird:    { name: '鷙鳥', title: '鷙鳥下來落在祭物上',   ico: '🦅', img: 'bird', hp: 50,  speed: 0.20, bite: 0,  cls: 'fly', flying: true, ref: '創 15:11',
             tip: '飛越牆與狗，射手的投射和瓦瓶火把才打得到' },
  // ====== 第二章「另外的羊」 ======
  // detour 繞路：前面是牆、隔壁排同一格沒牆就跳過去（冷卻秒數）；slam 撞牆第一下傷害、slamStun 撞完自己暈幾秒、trample 踩爛荊棘
  // drift 在上下幾排之間飄、driftT 飄一圈幾秒；shiftEvery 每幾秒換一排；crouchAt 走到第幾格蹲、crouch 蹲幾秒、dash 之後衝幾格
  jackal:  { name: '豺狼', title: '曠野的豺狼',   ico: '🐺', img: 'jackal', hp: 70,  speed: 0.26, bite: 12, cls: 'sly', detour: 6, prio: 3, ref: '耶 5:6',
             tip: '碰到牆就繞到隔壁排。光靠牆攔不住，派牧羊犬咬住牠' },
  boar:    { name: '野豬', title: '林中出來的野豬',   ico: '🐗', hp: 320, speed: 0.30, bite: 20, cls: 'big boar', slam: 100, slamStun: 1.5, trample: true, prio: 2, ref: '詩 80:13',
             tip: '撞牆第一下很重，還會踩爛荊棘。守望樓擋得住，機弦手打得快' },
  owl:     { name: '夜鴞', title: '荒場的鴞鳥',   ico: '🦉', hp: 60,  speed: 0.18, bite: 0,  cls: 'fly owl', flying: true, drift: 1, driftT: 4, ref: '詩 102:6',
             tip: '在排與排之間飄，單排射手常打空。投石隊一次打三排' },
  leopard: { name: '豹', title: '窺伺城邑的豹子',     ico: '🐆', hp: 650, speed: 0.28, bite: 28, cls: 'big leopard', thick: true, vaults: true, shiftEvery: 7, crouchAt: 5, crouch: 2, dash: 2, prio: 2, boss: true, ref: '耶 5:6',
             tip: '跳過牆、每隔幾秒換一排走，蹲下來就要衝了。牧羊犬咬住牠，投石隊三排盯著' },
  // ====== 第三章「諸山間」 ======
  // throws 強盜：走到第 at 格就站住，每 every 秒朝這排最前面的夥伴丟一顆石頭（dmg）；這排沒夥伴了才繼續走
  // high 大鷹：飛進來時飛得高，投射物與瓦瓶都打不到；守望樓那一排飛不高；抓了羊往回飛就一直低
  // heavy 野牛：推不動（角聲、瓦瓶、滾石只傷不推、不暈）、狗不理、斜坡上不減速、荊棘減得慢；陷坑照 trapBoss 困得住
  robber:  { name: '強盜', title: '落在強盜手中',   ico: '🧔‍♂️', hp: 80,  speed: 0.25, bite: 10, cls: 'human', throws: { at: 5, every: 1.5, dmg: 10 }, prio: 3, ref: '路 10:30',
             tip: '站在斜坡上丟石頭，專丟最前面的夥伴，直射打不到牠。派狗咬牠、拋石手砸、或推倒石堆' },
  eagle:   { name: '大鷹', title: '大鷹上騰，在高處搭窩',   ico: '🦅', hp: 90,  speed: 0.25, bite: 0,  cls: 'fly eagle', flying: true, high: true, steals: true, fleeSpeed: 0.45, ref: '伯 39:27',
             tip: '飛得高，投射物打不到，只有守望樓那排牠飛不高。抓了羊往回飛就低了，飛出場前打下來' },
  aurochs: { name: '野牛', title: '救我脫離野牛的角',   ico: '🐂', hp: 900, speed: 0.14, bite: 30, cls: 'big aurochs', thick: true, heavy: true, boss: true, slam: 150, slamStun: 1.0, wallMul: 2, ref: '詩 22:21',
             tip: '撞牆很重，推不動、狗咬不住、在斜坡上也不慢。陷坑困住牠 2.5 秒，所有人一起打' },
};

// 迷羊（中立，不是敵人）：從右邊走進來往羊圈走，走到最左邊或抱羊羔的牧人那格就回圈；地面敵人碰到就叼走
const STRAY = { name: '迷羊', ico: '🐑', speed: 0.15, reward: 25, safe: 1.5, ref: '路 15:4' }; // safe：從右邊界算起幾格內狼叼不到（走進玩家看到的第 6 格才叼得到；2026-10-28 James：剛進場就被出生的狼叼走，玩家無從應對）

const THICK_MUL = 0.35; // 厚皮敵人吃石子、箭的比例（圖鑑「效果」頁也讀這個）

// 圖鑑把移動速度翻成快／慢的門檻（每秒走幾格）
const SPEED_FAST = 0.35, SPEED_SLOW = 0.15;

// ====== 狀態效果（秒數與強度） ======
const STATUS = {
  burn:   { t: 5,   dps: 4 },        // 燃燒：每秒掉血，碰到隔壁沒燒的會傳火
  poison: { t: 8,   dps: 4, biteMul: 0.6 },
  slow:   { mul: 0.5, heavyMul: 0.75 },  // heavyMul：野牛被荊棘減得慢
  howl:   { t: 5,   mul: 1.5 },
  fear:   { t: 3 },                  // 掛在我方單位
  panic:  { speed: 1.0 },            // 驚慌：往右跑
  hop:    { t: 0.6 },                // 換排：從這排滑到隔壁排要幾秒（畫面用，引擎的排號是立刻換）
  dash:   { mul: 2.5 },              // 豹蹲完衝刺的速度倍數
};

// ====== 難度（對每一關都有效；只影響第二波起） ======
// gates：這個難度哪幾排門口有看門的（2026-10-20：寧靜夜五位、起風夜中間三位、暴風夜第 2、4 排兩位；關卡 gates: false 一律沒有）
// budgetMul：一筆糧的夜（第 25 夜）開局糧的倍數——敵人多了三成、糧也要跟著多，不然起風夜等於雙重懲罰（10/24 模擬：固定 1600 起風 32%、暴風 16%）
const DIFFS = {
  calm:  { name: '寧靜夜', hint: '敵人較少，先熟悉怎麼守',  shepherdEvery: 7,  countMul: 1,   hpMul: 1,    gapMul: 1,    gates: [0, 1, 2, 3, 4], budgetMul: 1 },
  windy: { name: '起風夜', hint: '敵人更多、血量更高，看門的只剩中間三排', shepherdEvery: 7,  countMul: 1.3, hpMul: 1.25, gapMul: 0.77, gates: [1, 2, 3], budgetMul: 1.25 },
  storm: { name: '暴風夜', hint: '產糧較慢，敵人又多又壯，看門的只剩兩位',  shepherdEvery: 10, countMul: 1.3, hpMul: 1.25, gapMul: 0.77, gates: [1, 3], budgetMul: 1.4 },
};

const PREP_TIME = 18;      // 第一波來之前的準備秒數（關卡可覆寫）
const WAVE_REST = 6;       // 清完一波後休息幾秒
const FORESHADOW_LEAD = 3; // 倒數剩幾秒先印腳印
const START_FOOD = 150;
const TRICKLE = { every: 5, gives: 5 }; // 沒放牧人也會慢慢有糧
const HILL_SLOW = 0.85;    // 第三章：地面敵人在斜坡上走得慢的倍數（模擬無差就改 1）
const HILL_DROP = 1;       // 第三章畫面：高地的排整排往下沉幾排（有坡的夜棋盤多這麼多排高；引擎不用，index.html 排版與 render.js 共用，兩邊才對得齊）
const HILL_EDGE = 0.3;     // 第三章：敵人 x 超過 hill + 這個值才算「在斜坡上」（剛掉進坡緣陷坑的 x≈hill 算卡在坡緣、打得到；咬斜坡第一格牆的 x≈hill+0.6 打不到）

// ====== 關卡 ======
// units：這一關能用的卡（順序＝卡片順序）；fresh：這一關新開的卡（會閃光）
// must：預設隊伍一定帶的卡（提示會教到的那幾張，免得玩家沒換隊就被指向沒帶的卡）
// waves：list [[種類, 隻數]…]；gap 隔幾秒放一隻；rows 走哪幾排；hpMul 血量倍數；ordered 不洗牌（教學用，新敵人排在固定位置）
// say：這波開始時的一句；hint：上一波清完休息時的「牧人提醒」
// outroLose：依死因的失敗文案（wolf 狼闖入／bird 鷙鳥飛入／sheep 羊被偷光）
// 第三章每一夜的底牌＝前兩章全部 19 張，再加本章已開的卡
const CH3 = ['shepherd', 'slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'thorns', 'brazier', 'jar', 'horn', 'healer', 'catapult', 'staff', 'lamp', 'patrol', 'volley', 'cradle'];
const ALL5 = [0, 1, 2, 3, 4];

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
    outroWin: '「他們晝夜作我們的保障。」（撒上 25:16）今晚作保障的是你。', // 羊多了幾隻由結算的羊數句子講（sheepSummary），這裡不重複
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
      { list: [['wolf', 8], ['jackal', 2]],                                gap: 2.2, rows: [0, 1, 2, 3, 4], hpMul: 1.3, strays: [6, 16, 28], say: '羊從山上下來了', hint: '羅得的羊會一隻隻下來。抱羊羔的牧人放中排前面一點，本排與上下鄰排的羊走到他的欄位就安全' },
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
      { list: [['leopard', 1], ['alpha', 2], ['wolf', 10], ['boar', 2]],                    gap: 1.8, rows: [0, 1, 2, 3, 4], hpMul: 1.8, ordered: true, strays: [14, 30], say: '豹和領頭狼', hint: '一隻豹、兩隻領頭狼。狗咬豹；銀號放後排、冷卻條滿了會自己響，五排一起退，狼群衝上來時正好推回去' },
      { list: [['leopard', 2], ['wolf', 12], ['fast', 8], ['jackal', 4], ['owl', 3]],       gap: 1.5, rows: [0, 1, 2, 3, 4], hpMul: 2.1, ordered: true, say: '兩隻豹，最後一波', hint: '最後一波兩隻豹走不同排。一隻狗一隻豹，投石隊放中間；銀號 20 秒響一次，顧不到的那排用狗擋' },
    ],
    outroWin: '天亮了。',
    psalm: ['「找著了，就歡歡喜喜地扛在肩上，回到家裡，就請朋友鄰舍來，對他們說：『我失去的羊已經找著了，你們和我一同歡喜吧！』」（路 15:5-6）', '「他必像牧人牧養自己的羊群，用膀臂聚集羊羔抱在懷中，慢慢引導那乳養小羊的。」（賽 40:11）'],
    outroLose: {
      wolf: '失去一隻，就撇下九十九隻去找。（路 15:4）再守一夜。',
      sheep: '羊被叼走了。再守一夜，抱羊羔的牧人放前面。',
      bird: '夜鴞飛進來了。投石隊放中間，天上三排一起顧。',
    },
  },

  // ====== 第三章「諸山間」（id 21-30）：山坡＋高低差 ======
  // hill：坡從第幾格起（程式欄號 4＝玩家看到的第 5 格起，右邊三格是斜坡）。高地的直射從坡緣起打不到斜坡上的地面敵人；拋射、飛的不受影響；坡下地面敵人走 HILL_SLOW 倍
  // noTrickle：糧不自己滴；noShepherd：沒有牧人這張卡（第 25 夜一筆糧，開局糧用 startFood）
  // diffScale 0.45（第 25、27-30 夜）：坡吃掉三格射程，起風／暴風的加壓再打折，不然暴風夜比第二章難一倍（10/24 模擬：27 夜暴風 20%、30 夜 4%，第二章 14 夜 88%）
  {
    id: 21, chapter: 3, hill: 4, name: '基列山的夜', title: '諸山間', ref: '取材：創世記 31:23-25、44，拉班在基列山追上雅各',
    speaker: '雅各',
    intro: '拉班追了七日，在基列山追上我們。今晚羊群在山上過夜，狼從山下爬上來。你站在高處，石子會從牠們頭頂飛過去；要打斜坡上的，得用拋的。',
    units: [...CH3, 'lobber'], fresh: ['lobber'], must: ['slinger', 'wall'],
    tips: ['⛰️ 左邊四格是高地（羊圈這邊），右邊三格（第 5-7 格）是斜坡。斜坡上的敵人在你腳底下，高地的直射打不到，石子從牠們頭頂飛過去', '🪃 拋石手把石頭拋到斜坡上，從後面也打得到', '🧱 牆放在坡緣（第 4 格），狼上了坡才咬得到牆，那時射手就打得到牠'],
    waves: [
      { list: [['wolf', 5]],                              gap: 4.5, rows: [1, 2, 3], hpMul: 1,    say: '第 1 波，狼從山下上來' },
      { list: [['wolf', 8], ['fast', 3]],                 gap: 2.4, rows: ALL5,      hpMul: 1.25, say: '五排都來了', hint: '狼會在斜坡上咬牆，高地的射手打不到牠。把牆退到坡緣，或放拋石手' },
      { list: [['jackal', 2], ['wolf', 8], ['fast', 3]],  gap: 2.2, rows: ALL5,      hpMul: 1.45, say: '豺狼來了', hint: '豺狼繞過牆就換排；牆退到坡緣後，隔壁排也要有牆' },
      { list: [['wolf', 11], ['fast', 5], ['jackal', 3]], gap: 1.8, rows: ALL5,      hpMul: 1.7,  say: '最後一波', hint: '最後一波更多。拋石手放中間三排，一路砸到牠們上來' },
    ],
    outroWin: '天亮了，羊一隻沒少。拉班說：「你我二人可以立約，作你我中間的證據。」（創 31:44）',
    outroLose: { wolf: '雅各說：山上的石子落不到山下。牆退到坡緣，狼上了坡才打得到。' },
  },
  {
    id: 22, chapter: 3, hill: 4, name: '拋擲有時，堆聚有時', title: '石頭滾下坡', ref: '取材：傳道書 3:5、創世記 31:46，雅各一家在基列山堆石',
    speaker: '基列的牧人',
    intro: '雅各一家走了，石堆還在山上。這山上石頭多，堆起來是牆，推倒了就滾下坡。拋擲有時，堆聚有時。今晚山下有人不急著上來，站在斜坡上丟石頭。',
    units: [...CH3, 'lobber', 'cairn'], fresh: ['cairn'], must: ['dog', 'lobber'],
    tips: ['⛰️ 石堆只能堆在斜坡那三格。被咬垮或自己點一下推倒，石頭就滾下坡撞退右邊的敵人', '🧔‍♂️ 強盜站在斜坡上丟石頭，直射打不到牠；狗跑過去咬、拋石手砸、或推倒石堆'],
    waves: [
      { list: [['wolf', 6]],                                           gap: 4.5, rows: [1, 2, 3], hpMul: 1,    say: '第 1 波，狼' },
      { list: [['wolf', 8], ['fast', 4]],                              gap: 2.2, rows: ALL5,      hpMul: 1.25, say: '狼多起來', hint: '斜坡上堆石堆當牆，狼擠在它前面的時候點一下推倒，整串一起滾下去' },
      { list: [['robber', 1], ['wolf', 7], ['robber', 2]],             gap: 2.6, rows: ALL5,      hpMul: 1.45, ordered: true, say: '有人站在斜坡上不走', hint: '是強盜。牠站在斜坡上丟石頭，直射打不到。派狗咬牠，或拋石手砸' },
      { list: [['robber', 3], ['wolf', 10], ['jackal', 3], ['fast', 4]], gap: 1.8, rows: ALL5,    hpMul: 1.7,  say: '最後一波', hint: '強盜專丟最前面的夥伴。牆前面堆石堆替它擋石頭，狗守強盜那排' },
    ],
    outroWin: '天亮了。「拋擲石頭有時，堆聚石頭有時；」（傳 3:5）今晚兩樣都有時。',
    outroLose: { wolf: '強盜站著丟石頭，你的牆就一直掉血。狗跑過去咬牠，比什麼都快。' },
  },
  {
    id: 23, chapter: 3, hill: 4, name: '野羊的磐石', title: '困在對的地方', ref: '取材：撒母耳記上 24:2，掃羅在野羊的磐石找大衛',
    speaker: '隱基底的牧人',
    intro: '大衛和跟隨他的人住在這山寨，掃羅的人在野羊的磐石那裡找他。熊也住這山上。熊走在斜坡上，你的機弦打不到牠；挖個坑在坡緣，牠掉進去就在你眼前了。',
    units: [...CH3, 'lobber', 'cairn', 'pit'], fresh: ['pit'], must: ['sling', 'tower', 'pit'],
    tips: ['🕳️ 陷坑一次性，第一隻踩進來的地面敵人困住 4 秒，熊這種頭目 2.5 秒。挖在斜坡第一格（第 5 格、牆前面），困住的敵人卡在坡緣，射手打得到。先別急著挖：普通狼也會踩掉它，等熊快到坡緣再挖在牠前面', '🐻 熊在斜坡上走得慢但打不到，拋石手先砸；走到坡緣掉進坑，機弦手趁那時打'],
    waves: [
      { list: [['wolf', 6]],                                                 gap: 4.5, rows: [1, 2, 3], hpMul: 1,    say: '第 1 波，狼' },
      { list: [['boar', 1], ['wolf', 7], ['fast', 3]],                       gap: 2.4, rows: ALL5,      hpMul: 1.3,  ordered: true, say: '野豬上山了', hint: '野豬撞牆第一下很重，牆放在斜坡上就白白被撞。守望樓放坡緣（第 4 格），坑挖它前面那格' },
      { list: [['bear', 1], ['wolf', 6], ['robber', 2]],                     gap: 2.8, rows: ALL5,      hpMul: 1.5,  ordered: true, say: '熊來了', hint: '熊在斜坡上走得慢，拋石手先砸；坑挖在牆前面，牠掉進去卡在坡緣的那兩秒半，機弦手別停' },
      { list: [['bear', 2], ['wolf', 9], ['jackal', 3], ['fast', 4]],        gap: 1.8, rows: ALL5,      hpMul: 1.75, ordered: true, say: '兩隻熊，最後一波', hint: '兩隻熊走不同排。兩個坑、兩個機弦手；拋石手只打自己這排，熊走哪排就放哪排' },
    ],
    outroWin: '天亮了。隱基底的牧人說：掃羅帶了三千人來找一個人（撒上 24:2），你一個人守住了一群羊。',
    outroLose: { wolf: '熊在斜坡上的時候你打不到牠，上了高地牠已經在咬牆。坑挖在坡緣，困住牠再打。' },
  },
  {
    id: 24, chapter: 3, hill: 4, name: '諸山間', title: '天上有東西在看', ref: '取材：以西結書 34:6、13',
    speaker: null, sheep: 3,
    intro: '「我的羊在諸山間、在各高岡上流離，在全地上分散，無人去尋，無人去找。」（結 34:6）今晚羊圈裡有三隻羊，天上也有東西在看。',
    units: [...CH3, 'lobber', 'cairn', 'pit'], fresh: [], must: ['volley', 'dog', 'tower'],
    tips: ['🦅 大鷹飛進來時飛得高，投射物打不到牠；只有守望樓那一排牠飛不高，一進場就打得到', '🐑 大鷹抓了羊往回飛就低了，直射拋射都打得到。在牠飛出場前打下來，羊會落地自己走回圈'],
    waves: [
      { list: [['wolf', 6]],                                                 gap: 4.5, rows: [1, 2, 3], hpMul: 1,    say: '第 1 波，狼' },
      { list: [['wolf', 8], ['jackal', 2]],                                  gap: 2.2, rows: ALL5,      hpMul: 1.3,  say: '狼和豺狼', hint: '守望樓放坡緣，牆被咬也擋得久；有守望樓的那排，天上來的東西也飛不高' },
      { list: [['eagle', 1], ['wolf', 8], ['fast', 4]],                      gap: 2.4, rows: ALL5,      hpMul: 1.5,  ordered: true, say: '天上有影子', hint: '大鷹來了。牠飛得高，只有守望樓那排打得到。沒守望樓的排，等牠抓了羊飛低再打，那排要有射手等著' },
      { list: [['eagle', 2], ['robber', 2], ['wolf', 10], ['jackal', 3]],    gap: 1.8, rows: ALL5,      hpMul: 1.75, ordered: true, say: '最後一波', hint: '兩隻鷹。投石隊放中間三排都顧到；鷹抓了羊飛出去前打下來' },
    ],
    outroWin: '天亮了。「我必從萬民中領出牠們，從各國內聚集牠們，引導牠們歸回故土，也必在以色列山上……牧養牠們。」（結 34:13）',
    outroLose: { wolf: '狼進來了。顧天上的時候，坡緣的牆也要守。', sheep: '羊都被抓走了。大鷹飛出去前那幾秒，那排要有射手；守望樓那排牠一進場就飛不高。' },
  },
  {
    id: 25, chapter: 3, hill: 4, diffScale: 0.45, name: '亞比該的禮物', title: '就這些了', ref: '取材：撒母耳記上 25:18、25，亞比該帶禮物見大衛',
    speaker: '亞比該', sheep: 3, startFood: 1600, noTrickle: true, noShepherd: true, // 10/24 模擬：1000→12%、1300→55%、1600→87%（好玩家寧靜夜），取 1600
    intro: '拿八的牧人在山上，大衛的人晝夜作他們的保障。拿八不領情，我領。這些是我帶來的：二百餅，五隻收拾好了的羊，五細亞烘好了的穗子。今晚就這些了，沒有再多。',
    units: [...CH3.filter(k => k !== 'shepherd'), 'lobber', 'cairn', 'pit'], fresh: [], must: ['cairn', 'pit', 'sling'],
    tips: ['🌾 今晚沒有牧人，糧也不會自己來。開局那筆用完就沒了，放之前想清楚', '⛏️ 放錯了用鏟子拆，退一半'],
    waves: [
      { list: [['wolf', 6], ['fast', 2]],                                                 gap: 3.5, rows: [1, 2, 3], hpMul: 1.1, say: '第 1 波' },
      { list: [['robber', 2], ['wolf', 8], ['jackal', 2]],                                gap: 2.2, rows: ALL5,      hpMul: 1.3, say: '強盜和豺狼', hint: '糧不會再來，石堆 50 糧最划算，推倒前讓狼先擠滿' },
      { list: [['eagle', 1], ['boar', 1], ['wolf', 8], ['fast', 4]],                      gap: 2.0, rows: ALL5,      hpMul: 1.5, ordered: true, say: '天上地上', hint: '鷹要來抓羊，留一個射手在牠飛出去的那排等著；守望樓那排牠飛不高' },
      { list: [['bear', 1], ['robber', 3], ['wolf', 10], ['jackal', 3], ['fast', 4]],     gap: 1.8, rows: ALL5,      hpMul: 1.7, ordered: true, say: '最後一波', hint: '最後一波有熊。坑留給牠，機弦手趁牠困住時打' },
    ],
    outroWin: '天亮了。亞比該說：「我主不要理這壞人拿八，他的性情與他的名相稱；」（撒上 25:25）羊守住了，餅也還有。',
    outroLose: { wolf: '糧用完了，牆也沒了。這一夜每一塊糧都要算：石堆 50、牆 50，射手留給中間三排。', sheep: '羊被抓走了。鷹飛出去的那排要有射手等著。' },
  },
  {
    id: 26, chapter: 3, hill: 4, name: '多坍的羊群', title: '平安不平安', ref: '取材：創世記 37:14、16-17，約瑟往多坍找哥哥們',
    speaker: '約瑟', sheep: 3,
    intro: '父親打發我來看哥哥們平安不平安，群羊平安不平安。他們離開示劍往多坍去了，羊群今晚在山上。這水袋是父親給我路上喝的，給你。',
    units: [...CH3, 'lobber', 'cairn', 'pit', 'waterskin'], fresh: ['waterskin'], must: ['lobber', 'tower'],
    tips: ['🥛 水袋一次性，倒在哪一格，九格內的夥伴血量回滿。守望樓被撞到剩一口氣的時候用', '🧔‍♂️ 強盜多的時候專丟最前面那個，牆前面堆石堆替它擋'],
    waves: [
      { list: [['wolf', 6]],                                                                gap: 4.0, rows: [1, 2, 3], hpMul: 1,    say: '第 1 波，狼' },
      { list: [['robber', 3], ['wolf', 8], ['fast', 3]],                                    gap: 2.2, rows: ALL5,      hpMul: 1.3,  ordered: true, say: '強盜三個一起', hint: '三個強盜站著丟，守望樓會慢慢被丟壞。水袋留給它' },
      { list: [['eagle', 1], ['leopard', 1], ['wolf', 8]],                                  gap: 2.4, rows: ALL5,      hpMul: 1.5,  ordered: true, say: '草叢裡的和天上的', hint: '豹跳過石牆、每幾秒換排；守望樓牠跳不過，狗咬住牠就不換排。鷹飛出去那排留射手' },
      { list: [['robber', 4], ['boar', 2], ['wolf', 10], ['jackal', 3], ['eagle', 1]],      gap: 1.8, rows: ALL5,      hpMul: 1.75, ordered: true, say: '最後一波', hint: '強盜和野豬一起來，守望樓撐不住就水袋。拋石手砸強盜' },
    ],
    outroWin: '天亮了，群羊平安。約瑟說：「我找我的哥哥們，求你告訴我，他們在何處放羊。」那人說：「他們已經走了，我聽見他們說要往多坍去。」（創 37:16-17）約瑟就往多坍去了。',
    outroLose: { wolf: '牆被丟壞了。強盜站著不走，狗咬牠最快；牆剩一口氣就用水袋。', sheep: '羊被抓走了。鷹飛出去那排要有射手。' },
  },
  {
    id: 27, chapter: 3, hill: 4, diffScale: 0.45, name: '野牛的角', title: '推不動的', ref: '取材：詩篇 22:12、21',
    speaker: '巴珊的牧人',
    intro: '巴珊的公牛大力，野牛更不用說。牠撞牆像撞土，狗撲上去牠一甩就飛了，角聲也趕不動牠。坑困得住牠，就那兩秒半。',
    units: [...CH3, 'lobber', 'cairn', 'pit', 'waterskin'], fresh: [], must: ['pit', 'sling', 'tower'],
    tips: ['🐂 野牛撞牆第一下很重，推不動、狗咬不住，在斜坡上也不減速。陷坑困住牠 2.5 秒，機弦手和投石機趁那時打；一個坑不夠就兩個', '🌿 荊棘減牠的速、蠍窩毒得到牠'],
    waves: [
      { list: [['wolf', 6], ['fast', 2]],                                      gap: 4.0, rows: [1, 2, 3], hpMul: 1.1,  say: '第 1 波' },
      { list: [['boar', 2], ['wolf', 8], ['robber', 2]],                       gap: 2.2, rows: ALL5,      hpMul: 1.3,  ordered: true, say: '野豬打頭陣', hint: '野豬撞牆、強盜丟石頭。守望樓放坡緣，石堆堆它前面擋' },
      { list: [['bear', 1], ['jackal', 3], ['wolf', 8], ['fast', 4]],          gap: 2.0, rows: ALL5,      hpMul: 1.5,  ordered: true, say: '熊來了', hint: '熊交給坑和機弦手。坑用掉就沒了，下一波還要一個' },
      { list: [['aurochs', 1], ['wolf', 10], ['fast', 4]],                     gap: 2.4, rows: ALL5,      hpMul: 1.75, ordered: true, say: '地在震，最後一波', hint: '是野牛。狗咬不住、角聲推不動，坑困住牠 2.5 秒，機弦手、投石機、拋石手全部對準牠' },
    ],
    outroWin: '天亮了。「救我脫離獅子的口；你已經應允我，使我脫離野牛的角。」（詩 22:21）',
    outroLose: { wolf: '野牛把牆撞穿了。坑挖在守望樓前面，牠掉進去的那 2.5 秒，所有人一起打；一個坑不夠就兩個。' },
  },
  {
    id: 28, chapter: 3, hill: 4, diffScale: 0.45, name: '巧匠的機器', title: '斜坡是靶場', ref: '取材：歷代志下 26:15，烏西雅使巧匠做機器',
    speaker: '烏西雅的牧人',
    intro: '王的巧匠又改了機器，裝得更快、砸得更遠。今晚狼群從山下擠著上來，斜坡正好是機器的靶場。',
    units: [...CH3, 'lobber', 'cairn', 'pit', 'waterskin'], fresh: [], must: ['catapult', 'lobber'],
    tips: ['⚙️ 投石機放下後再點一下花 100 糧換巧匠的機器，裝填快一半、濺射更大。拋射從哪裡都打得到斜坡上', '🐺 狼擠在斜坡上走得慢，正好一砸一片'],
    waves: [
      { list: [['wolf', 7]],                                                                  gap: 3.5, rows: [1, 2, 3], hpMul: 1,   say: '第 1 波，狼' },
      { list: [['wolf', 14], ['locust', 16]],                                                 gap: 0.9, rows: [2],       hpMul: 1.3, say: '擠成一串', hint: '這波擠在中排，投石機升級後一砸一片。斜坡上走得慢，砸得到更多' },
      { list: [['boar', 2], ['robber', 3], ['wolf', 10], ['fast', 4]],                        gap: 1.6, rows: ALL5,      hpMul: 1.5, say: '五排一起來', hint: '強盜站斜坡、野豬撞坡緣，投石機兩台放第 2、4 排' },
      { list: [['bear', 1], ['alpha', 1], ['wolf', 10], ['fast', 4], ['locust', 12]],         gap: 1.4, rows: ALL5,      hpMul: 1.5, ordered: true, say: '最後一波，全來了', hint: '熊和領頭狼帶著狼群擠上來。坑留給熊，嚎叫前狗咬住領頭狼，機器一直砸' }, // 10/24 模擬：原 bear2 alpha2 wolf12 fast6 @1.8 gap1.2 好玩家寧靜夜只 50%；bear2 alpha1 wolf10 @1.7 gap1.4 也只 67%
    ],
    outroWin: '天亮了。「又在耶路撒冷使巧匠做機器，安在城樓和角樓上，用以射箭發石。」（代下 26:15）今晚安在山上。',
    outroLose: { wolf: '狼擠成串上來，一顆一顆打不完。投石機升級，斜坡就是靶場。' },
  },
  {
    id: 29, chapter: 3, hill: 4, diffScale: 0.45, name: '放羊的兒子', title: '牠們不會等你', ref: '取材：撒母耳記上 16:11、19，掃羅召放羊的大衛',
    speaker: '耶西', sheep: 3, prep: 12, rest: 3,
    intro: '掃羅王打發人來，要我放羊的兒子去宮裡彈琴。他一走，山上的羊群就沒人守了。今晚你來，牠們不會等你擺好。',
    units: [...CH3, 'lobber', 'cairn', 'pit', 'waterskin'], fresh: [], must: ['lobber', 'pit', 'dog'],
    tips: ['⏱ 今晚準備 12 秒、波與波之間只歇 3 秒，先放牆和拋石手', '🐻🦅 熊、強盜、大鷹都會來，坑和水袋先留在手上'],
    waves: [
      // 10/24 模擬：這一夜只歇 3 秒本身就是壓力，波表照第 19 夜（第二章歇 3 秒的夜）的量級；原稿 w4 bear2 leopard wolf12 fast6 @1.85 好玩家寧靜夜只 23%
      { list: [['wolf', 6], ['fast', 2]],                                                  gap: 3.0, rows: [1, 2, 3], hpMul: 1.1,  say: '第 1 波' },
      { list: [['robber', 2], ['jackal', 3], ['wolf', 7]],                                 gap: 2.0, rows: ALL5, hpMul: 1.35, ordered: true, say: '強盜和豺狼，五排都來', hint: '只歇 3 秒，五排都會來。強盜那排狗先放，豺狼換排後隔壁要有牆' },
      { list: [['eagle', 2], ['boar', 1], ['wolf', 8], ['fast', 3]],                       gap: 1.8, rows: ALL5, hpMul: 1.5,  ordered: true, say: '天上地上', hint: '兩隻鷹，中間三排投石隊、守望樓那排牠飛不高；野豬撞坡緣的守望樓' },
      { list: [['bear', 1], ['leopard', 1], ['robber', 2], ['wolf', 9], ['fast', 4]],      gap: 1.7, rows: ALL5, hpMul: 1.55, ordered: true, say: '最後一波', hint: '熊和豹一起來。坑給熊、狗給豹、拋石手砸強盜。守不住的排推倒石堆' },
    ],
    outroWin: '天亮了。耶西說：「還有個小的，現在放羊。」（撒上 16:11）今晚放羊的是你。',
    outroLose: { wolf: '來不及擺的就擺不上了。開場先放牆和拋石手，坑和水袋留在手上。', sheep: '羊被抓走了。鷹飛出去那排要有射手等著。', bird: '鷙鳥飛進羊圈了。每排都要有射手。' },
  },
  {
    id: 30, chapter: 3, hill: 4, diffScale: 0.45, name: '往山裏去', title: '第三章最後一夜', ref: '取材：馬太福音 18:12-13、詩篇 121 篇',
    speaker: null, sheep: 3,
    intro: '「一個人若有一百隻羊，一隻走迷了路，你們的意思如何？他豈不撇下這九十九隻，往山裏去找那隻迷路的羊嗎？若是找著了，我實在告訴你們，他為這一隻羊歡喜，比為那沒有迷路的九十九隻歡喜還大呢！」（太 18:12-13）今晚山上的羊要一隻隻回來，野牛也在。',
    units: [...CH3, 'lobber', 'cairn', 'pit', 'waterskin'], fresh: [], must: ['catapult', 'pit', 'dog', 'lobber'],
    tips: ['🐂 今晚共五波，最後一波兩隻野牛走不同排，兩個坑先留著', '🐑 迷羊會從斜坡上來，狼在斜坡上叼走牠你打不到；狗護送、拋石手砸斜坡上的狼'],
    waves: [
      { list: [['wolf', 8], ['fast', 3]],                                                         gap: 3.0, rows: ALL5, hpMul: 1.3, say: '第 1 波' },
      { list: [['robber', 3], ['jackal', 4], ['wolf', 10], ['boar', 1]],                          gap: 1.8, rows: ALL5, hpMul: 1.5, ordered: true, say: '強盜、豺狼、野豬', hint: '強盜站著丟，狗跑過去；豺狼繞牆換排，隔壁排也要有牆。第 4 波山上的羊會回來，先留一隻狗' }, // 10/24 模擬：這波原有迷羊 2 隻，連第 4 波共 4 隻，好玩家寧靜夜 1/3 的局失羊輸；迷羊集中到第 4 波
      { list: [['eagle', 2], ['owl', 3], ['wolf', 10], ['locust', 16]],                           gap: 1.4, rows: ALL5, hpMul: 1.6, say: '天上滿了', hint: '大鷹和夜鴞一起來，投石隊三排盯著、守望樓那排鷹飛不高；蝗群交給弓箭手' },
      { list: [['bear', 2], ['leopard', 1], ['alpha', 2], ['wolf', 10]],                          gap: 1.6, rows: ALL5, hpMul: 1.8, ordered: true, strays: [12, 30], say: '熊、豹、領頭狼', hint: '兩隻熊兩個坑，豹交給狗和守望樓，銀號留給嚎叫那一刻' },
      { list: [['aurochs', 2], ['robber', 4], ['wolf', 12], ['fast', 8], ['eagle', 1]],           gap: 1.4, rows: ALL5, hpMul: 2.1, ordered: true, say: '兩隻野牛，最後一波', hint: '最後一波兩隻野牛走不同排。坑挖在守望樓前面，一隻野牛至少一個坑，機器和機弦手輪著打' },
    ],
    outroWin: '天亮了。',
    psalmTitle: '詩篇一百二十一篇',
    psalm: ['我要向山舉目；我的幫助從何而來？我的幫助從造天地的耶和華而來。', '他必不叫你的腳搖動；保護你的必不打盹！保護以色列的，也不打盹也不睡覺。', '保護你的是耶和華；耶和華在你右邊蔭庇你。白日，太陽必不傷你；夜間，月亮必不害你。', '耶和華要保護你，免受一切的災害；他要保護你的性命。你出你入，耶和華要保護你，從今時直到永遠。'],
    outroLose: {
      wolf: '「他豈不撇下這九十九隻，往山裏去找那隻迷路的羊嗎？」（太 18:12）再守一夜。',
      sheep: '羊被抓走了。再守一夜，鷹飛出去那排留射手。',
      bird: '夜鴞飛進來了。投石隊放中間，三排一起顧。',
    },
  },
];

// ====== 守夜試煉（期 2，2026-10-29）：一題＝某一夜的地圖＋一組修飾詞（engine.js normalizeMods），難度固定、不乘三檔 ======
// kind：puzzle 排陣解謎／conveyor 送卡護羊／budget 一筆糧。解鎖＝那一夜所在的章守過最後一夜（任一難度），規則在 Engine.isTrialUnlocked
// 勝率是 sim/simulate.js good 玩家 100 局（docs/phase-2-trials-draft-2026-10-29.md）；改 mods 要重跑：SIM_MODS='{…}' node sim/simulate.js <levelId> calm 100
// lose＝輸了之後結算頁那一句（依口味，不依題）
// 守夜試煉（新期 2，2026-10-31，James 10/31 定案；設計與勝率在 docs/phase-2b-plan-2026-10-31.md）：每夜兩題
//   守望試煉 w<夜 id>：同一夜、同一批敵人、同樣波數，但敵人表另寫（更密、五排、順序不同）、沒有看門的、有羊的夜失一隻即輸。難度要高於暴風夜
//   烈火試煉 f<夜 id>：一大波、一筆糧（沒有牧人）、限卡（拿掉那一夜的新卡與主答案）、沒有看門的、失羊即輸。旋鈕是開局糧
// 兩題都只用到那一夜為止玩家見過的敵人與學過的卡（引擎 validateTrials 會驗）。難度一律 storm（產糧較慢），waveOverride 寫的是最終數字、不再乘倍率
const ALL = [0, 1, 2, 3, 4];
const TRIAL_KINDS = {
  watch: { name: '守望試煉', ico: '🕯️', short: '敵人更密、沒有看門的', desc: '同一夜的敵人另排一張表：更密、五排一起來、沒有看門的；有羊的夜失一隻就輸', lose: '這一夜沒有人替你擋。回頭看哪一排先破，那一排要多一道牆或一個射手。' },
  fire: { name: '烈火試煉', ico: '🔥', short: '一大波、一筆糧、限卡', desc: '整夜的敵人一波來；沒有牧人，開局那一筆糧用到天亮；少了幾張慣用的卡，沒有看門的', lose: '一筆糧沒有第二次。先數這一波有幾隻、哪幾種，再想每一排要幾個人。' },
};
const TRIALS = [
  // ── 第 1 夜 雅各的夜 ──
  { id: 'w1', kind: 'watch', levelId: 1, diff: 'storm', title: '雅各的夜・守望',
    mods: { gates: 0, waveOverride: [
      { list: [['wolf', 6]], gap: 2.32, rows: ALL, hpMul: 1.66, say: '第 1 波，五排都有狼' },
      { list: [['fast', 6], ['wolf', 9]], gap: 1.16, rows: ALL, hpMul: 2.21, say: '快狼先到' },
      { list: [['wolf', 15], ['fast', 10]], gap: 0.8, rows: ALL, hpMul: 2.98, say: '最後一波，整群一起來' },
    ] },
    text: '同一片草地，但今晚門口沒有看門的。狼第一波就從五排來，比暴風夜更密、更壯。石牆要擋在每一排射手前面。',
    win: '沒有人替你擋，你也沒讓一隻進來。雅各說：「這二十年我就是這樣守的。」' },
  { id: 'f1', kind: 'fire', levelId: 1, diff: 'storm', title: '雅各的夜・烈火',
    mods: { units: ['slinger', 'wall'], oneBudget: true, startFood: 900, gates: 0, waveOverride: [
      { list: [['wolf', 21], ['fast', 9]], gap: 1.2, rows: ALL, hpMul: 2.0 },
    ] },
    text: '整夜的狼一波來：三十隻，沒有牧人、沒有看門的。手上 900 糧、兩種卡，開打前就要擺好。',
    win: '一筆糧擋下了一整夜。雅各把水袋遞給你，什麼也沒說。' },
  // ── 第 2 夜 哈蘭的第二夜 ──
  { id: 'w15', kind: 'watch', levelId: 15, diff: 'storm', title: '哈蘭的第二夜・守望',
    mods: { gates: 0, waveOverride: [
      { list: [['wolf', 9]], gap: 1.88, rows: ALL, hpMul: 1.9, say: '第 1 波' },
      { list: [['fast', 13], ['wolf', 8]], gap: 0.94, rows: ALL, hpMul: 2.5, ordered: true, say: '快狼成群衝過來' },
      { list: [['wolf', 17], ['fast', 14]], gap: 0.81, rows: ALL, hpMul: 3.47, say: '最後一波' },
    ] },
    text: '狼比昨夜多一倍，快狼成群先到。沒有看門的，狗撲住一隻的時候，其餘的還在跑。',
    win: '狗累得趴下，羊一隻不少。雅各說：「你所有的很少，現今卻發大眾多。」' },
  { id: 'f15', kind: 'fire', levelId: 15, diff: 'storm', title: '哈蘭的第二夜・烈火',
    mods: { units: ['slinger', 'wall'], oneBudget: true, startFood: 500, gates: 0, waveOverride: [
      { list: [['wolf', 18], ['fast', 12]], gap: 1.2, rows: ALL, hpMul: 1.6 },
    ] },
    text: '今晚沒有狗。三十隻狼一波來，500 糧、投石手和石牆，沒有牧人。快狼一半，牆要先放。',
    win: '沒有狗也守住了。雅各點點頭：「狗是幫手，不是倚靠。」' },
  // ── 第 3 夜 大衛的曠野 ──
  { id: 'w2', kind: 'watch', levelId: 2, diff: 'storm', title: '大衛的曠野・守望',
    mods: { gates: 0, waveOverride: [
      { list: [['wolf', 7], ['fast', 3]], gap: 2.3, rows: ALL, hpMul: 1.65, say: '第 1 波' },
      { list: [['alpha', 2], ['wolf', 8], ['fast', 4]], gap: 1.22, rows: ALL, hpMul: 2.04, ordered: true, say: '兩隻領頭狼' },
      { list: [['bear', 2], ['wolf', 7], ['fast', 4]], gap: 1.49, rows: ALL, hpMul: 2.17, ordered: true, say: '兩隻熊' },
      { list: [['lion', 2], ['alpha', 1], ['wolf', 10], ['fast', 7]], gap: 1.08, rows: ALL, hpMul: 2.56, ordered: true, say: '獅子，兩隻' },
    ] },
    text: '領頭狼兩隻、熊兩隻、獅子兩隻，沒有看門的。機弦手要在獅子到牆前就開始打。',
    win: '獅子和熊都倒在牆前。大衛說：「我追上去打牠，救出羊羔來。」' },
  { id: 'f2', kind: 'fire', levelId: 2, diff: 'storm', title: '大衛的曠野・烈火',
    mods: { units: ['slinger', 'wall', 'dog'], oneBudget: true, startFood: 1300, gates: 0, waveOverride: [
      { list: [['lion', 1], ['bear', 1], ['alpha', 1], ['wolf', 24], ['fast', 6]], gap: 1.2, rows: ALL, hpMul: 1.5, ordered: true },
    ] },
    text: '沒有機弦。獅子、熊、領頭狼和二十四隻狼一波來，只有投石手、石牆和狗。1300 糧，狗拖住，石子慢慢磨。',
    win: '沒有機弦也打倒了獅子。大衛說：「不是靠那把機弦。」' },
  // ── 第 4 夜 雇工與賊（羊 3）──
  { id: 'w3', kind: 'watch', levelId: 3, diff: 'storm', title: '雇工與賊・守望',
    mods: { gates: 0, maxSheepLost: 0, waveOverride: [
      { list: [['wolf', 9]], gap: 1.88, rows: ALL, hpMul: 1.9, say: '第 1 波' },
      { list: [['wolf', 14], ['fast', 8]], gap: 1, rows: ALL, hpMul: 2.5, say: '狼群' },
      { list: [['thief', 4], ['wolf', 11], ['thief', 4]], gap: 1.13, rows: ALL, hpMul: 2.8, ordered: true, say: '賊混在狼裡' },
      { list: [['rustler', 3], ['fox', 8], ['wolf', 12], ['rustler', 3], ['fox', 8]], gap: 0.88, rows: ALL, hpMul: 3.25, ordered: true, say: '偷羊人來了，一隻都不能被抱走' },
    ] },
    text: '賊和偷羊人更多，沒有看門的，一隻羊被抱走就算輸。守望樓要看得到五排。',
    win: '羊一隻沒少，賊一個沒進來。「我是好牧人，好牧人為羊捨命。」' },
  { id: 'f3', kind: 'fire', levelId: 3, diff: 'storm', title: '雇工與賊・烈火',
    mods: { units: ['slinger', 'wall', 'sling', 'dog'], oneBudget: true, startFood: 900, gates: 0, maxSheepLost: 0, waveOverride: [
      { list: [['rustler', 3], ['thief', 3], ['wolf', 23], ['fast', 3], ['fox', 6]], gap: 1.2, rows: ALL, hpMul: 1.6, ordered: true },
    ] },
    text: '沒有雇工、沒有守望樓。偷羊人先到，狼群跟在後面，一波三十八隻。900 糧，失一隻羊就輸。',
    win: '偷羊人空手逃了。雇工不在，你在。' },
  // ── 第 5 夜 葡萄園的小狐狸（羊 5）──
  { id: 'w16', kind: 'watch', levelId: 16, diff: 'storm', title: '葡萄園的小狐狸・守望',
    mods: { gates: 0, maxSheepLost: 0, waveOverride: [
      { list: [['fox', 8]], gap: 1.45, rows: ALL, hpMul: 2.1, say: '狐狸，五排都來' },
      { list: [['thief', 2], ['fox', 11]], gap: 0.94, rows: ALL, hpMul: 2.32, ordered: true, say: '賊帶著狐狸' },
      { list: [['rustler', 3], ['fox', 9], ['wolf', 6]], gap: 0.87, rows: ALL, hpMul: 2.54, ordered: true, say: '偷羊人，六個' },
      { list: [['rustler', 5], ['fox', 15], ['thief', 4]], gap: 0.73, rows: ALL, hpMul: 2.87, ordered: true, say: '最後一波，偷羊人最多' },
    ] },
    text: '小狐狸一波比一波多，偷羊人五個排在最後。沒有看門的，失一隻羊就輸。狗要放在偷羊人會走的排。',
    win: '葡萄園一粒沒少，羊也一隻沒少。「要給我們擒拿狐狸，就是毀壞葡萄園的小狐狸。」' },
  { id: 'f16', kind: 'fire', levelId: 16, diff: 'storm', title: '葡萄園的小狐狸・烈火',
    mods: { units: ['slinger', 'wall', 'hireling'], oneBudget: true, startFood: 850, gates: 0, maxSheepLost: 0, waveOverride: [
      { list: [['rustler', 5], ['fox', 23], ['thief', 3], ['wolf', 3]], gap: 1.2, rows: ALL, hpMul: 1.5, ordered: true },
    ] },
    text: '今晚沒有狗。狐狸二十三隻、偷羊人五個一波來，只有投石手、石牆和雇工。850 糧，雇工會跑，石牆不會。',
    win: '沒有狗，狐狸也沒進葡萄園。雇工這次沒跑。' },
  // ── 第 6 夜 何烈山下 ──
  { id: 'w4', kind: 'watch', levelId: 4, diff: 'storm', title: '何烈山下・守望',
    mods: { gates: 0, waveOverride: [
      { list: [['wolf', 7]], gap: 3.07, rows: ALL, hpMul: 1.49, say: '第 1 波' },
      { list: [['locust', 30]], gap: 0.47, rows: [0, 2, 4], hpMul: 1.49, say: '蝗群，從邊排和中排來' },
      { list: [['digger', 2], ['wolf', 8], ['digger', 2]], gap: 1.89, rows: ALL, hpMul: 2.15, ordered: true, say: '野狗從地底冒出來' },
      { list: [['locust', 25], ['wolf', 9], ['digger', 3], ['fast', 6]], gap: 0.94, rows: ALL, hpMul: 2.97, say: '最後一波，什麼都來' },
    ] },
    text: '蝗群換了排走，野狗更多，沒有看門的。石堆佔住的格子還在，弓箭手和荊棘的位置要先想好。',
    win: '蝗群過去了，草還在。摩西說：「你站的地方是聖地。」' },
  { id: 'f4', kind: 'fire', levelId: 4, diff: 'storm', title: '何烈山下・烈火',
    mods: { units: ['slinger', 'wall', 'sling', 'dog', 'hireling', 'tower'], oneBudget: true, startFood: 850, gates: 0, waveOverride: [
      { list: [['locust', 38], ['wolf', 18], ['digger', 6], ['fast', 4]], gap: 1.2, rows: ALL, hpMul: 1.4 },
    ] },
    text: '沒有弓箭手、沒有荊棘。蝗群三十八隻、野狗六隻和狼一波來，850 糧。石子一次只打一隻，想想怎麼補。',
    win: '沒有弓箭也擋下了蝗群。「我必與你同在。」' },
  // ── 第 7 夜 提哥亞的牧人 ──
  { id: 'w5', kind: 'watch', levelId: 5, diff: 'storm', title: '提哥亞的牧人・守望',
    mods: { gates: 0, waveOverride: [
      { list: [['wolf', 10]], gap: 1.88, rows: ALL, hpMul: 1.75, say: '第 1 波' },
      { list: [['bird', 3], ['wolf', 10], ['bird', 4]], gap: 1.25, rows: ALL, hpMul: 2.5, ordered: true, say: '鷙鳥飛過牆' },
      { list: [['wolf', 20], ['fast', 7]], gap: 0.63, rows: [1, 3], hpMul: 2.65, say: '兩排擠滿了狼' },
      { list: [['bear', 2], ['wolf', 14], ['bird', 7], ['bear', 2]], gap: 1, rows: ALL, hpMul: 3.1, ordered: true, say: '四隻熊' },
    ] },
    text: '鷙鳥十四隻、熊四隻，狼擠在第 2、4 排。沒有看門的。火盆的位置決定這一夜。',
    win: '熊在火前停住了。阿摩司說：「獅子吼叫，誰不懼怕呢？」' },
  { id: 'f5', kind: 'fire', levelId: 5, diff: 'storm', title: '提哥亞的牧人・烈火',
    mods: { units: ['slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer'], oneBudget: true, startFood: 1700, gates: 0, waveOverride: [
      { list: [['bear', 2], ['bird', 5], ['wolf', 32], ['fast', 4]], gap: 1.2, rows: ALL, hpMul: 1.7, ordered: true },
    ] },
    text: '沒有火盆、沒有荊棘。兩隻熊帶頭，鷙鳥五隻飛過牆，狼三十二隻。1700 糧，弓箭手顧天上、機弦顧熊。',
    win: '沒有火，熊也沒過牆。阿摩司收起牧杖：「我原是牧人。」' },
  // ── 第 8 夜 基甸的三百人 ──
  { id: 'w6', kind: 'watch', levelId: 6, diff: 'storm', title: '基甸的三百人・守望',
    mods: { gates: 0, waveOverride: [
      { list: [['wolf', 7]], gap: 0.9, rows: [1, 2, 3], hpMul: 1.36, say: '狼從中間三排湧進來' },
      { list: [['wolf', 9], ['fast', 5]], gap: 0.9, rows: [0, 2, 4], hpMul: 1.7, say: '換邊排了' },
      { list: [['alpha', 3], ['locust', 20], ['wolf', 7]], gap: 0.83, rows: ALL, hpMul: 1.99, say: '三隻領頭狼' },
      { list: [['alpha', 4], ['wolf', 14], ['fast', 7], ['locust', 20]], gap: 0.65, rows: ALL, hpMul: 2.41, say: '最後一波，四隻領頭狼' },
    ] },
    text: '狼先湧中間三排、再換邊排；領頭狼七隻。準備時間一樣短，沒有看門的。',
    win: '三百人夠了。基甸說：「不是靠人多。」' },
  { id: 'f6', kind: 'fire', levelId: 6, diff: 'storm', title: '基甸的三百人・烈火',
    mods: { units: ['slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'thorns', 'brazier'], oneBudget: true, startFood: 1500, gates: 0, waveOverride: [
      { list: [['alpha', 4], ['wolf', 32], ['fast', 14], ['locust', 40]], gap: 1.0, rows: ALL, hpMul: 1.6, ordered: true },
    ] },
    text: '沒有瓦瓶、沒有角、沒有弓箭手。領頭狼四隻帶著九十隻一波來，1500 糧。蝗群要靠荊棘和火盆。',
    win: '沒有瓦瓶也嚇退了他們。「耶和華和基甸的刀！」' },
  // ── 第 9 夜 烏西雅的牧場 ──
  { id: 'w17', kind: 'watch', levelId: 17, diff: 'storm', title: '烏西雅的牧場・守望',
    mods: { gates: 0, waveOverride: [
      { list: [['wolf', 9]], gap: 1.93, rows: ALL, hpMul: 1.84, say: '第 1 波' },
      { list: [['wolf', 14], ['fast', 5]], gap: 0.84, rows: ALL, hpMul: 2.54, say: '狼群' },
      { list: [['wolf', 19], ['locust', 23]], gap: 0.41, rows: [1, 3], hpMul: 2.83, say: '兩排擠滿了' },
      { list: [['bear', 2], ['alpha', 2], ['bird', 5], ['wolf', 14], ['fast', 5]], gap: 0.96, rows: ALL, hpMul: 3.32, ordered: true, say: '熊、領頭狼、鷙鳥，一起來' },
    ] },
    text: '第 3 波四十來隻擠進第 2、4 排，最後一波熊和領頭狼一起。沒有看門的，投石機要早放。',
    win: '牧場一夜無事。烏西雅說：「我喜愛農事。」' },
  { id: 'f17', kind: 'fire', levelId: 17, diff: 'storm', title: '烏西雅的牧場・烈火',
    mods: { units: ['slinger', 'wall', 'dog', 'hireling', 'tower', 'archer', 'thorns', 'brazier', 'jar', 'horn'], oneBudget: true, startFood: 1300, gates: 0, waveOverride: [
      { list: [['bear', 1], ['alpha', 1], ['bird', 4], ['wolf', 32], ['fast', 6], ['locust', 12]], gap: 1.2, rows: ALL, hpMul: 1.6, ordered: true },
    ] },
    text: '沒有投石機、沒有機弦、沒有包紮的人。熊和領頭狼帶頭，五十六隻一波來，1300 糧。火盆和荊棘是你的機弦。',
    win: '沒有投石機也守住了牧場。' },
  // ── 第 10 夜 尋找我的羊（羊 3）──
  { id: 'w7', kind: 'watch', levelId: 7, diff: 'storm', title: '尋找我的羊・守望',
    mods: { gates: 0, maxSheepLost: 0, waveOverride: [
      { list: [['wolf', 7], ['fast', 2]], gap: 2.25, rows: ALL, hpMul: 1.9, say: '第 1 波' },
      { list: [['wolf', 14], ['locust', 17]], gap: 0.75, rows: ALL, hpMul: 2.2, say: '蝗群和狼' },
      { list: [['thief', 3], ['rustler', 2], ['fox', 5], ['digger', 3]], gap: 1.5, rows: ALL, hpMul: 2.35, say: '賊、偷羊人、狐狸、野狗' },
      { list: [['bear', 3], ['alpha', 3], ['bird', 5], ['wolf', 11]], gap: 1.38, rows: ALL, hpMul: 2.65, ordered: true, say: '三隻熊、三隻領頭狼' },
      { list: [['lion', 2], ['wolf', 11], ['lion', 1], ['fast', 9], ['locust', 23]], gap: 1.13, rows: ALL, hpMul: 2.95, ordered: true, say: '最後一波，三隻獅子' },
    ] },
    text: '第一章的最後一夜，五波全部更密，獅子三隻。沒有看門的，失一隻羊就輸。',
    win: '找到了，一隻也沒少。「我的羊，我必親自尋找。」' },
  { id: 'f7', kind: 'fire', levelId: 7, diff: 'storm', title: '尋找我的羊・烈火',
    mods: { units: ['slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'thorns', 'brazier', 'jar', 'horn'], oneBudget: true, startFood: 2000, gates: 0, maxSheepLost: 0, waveOverride: [
      { list: [['lion', 1], ['bear', 1], ['alpha', 1], ['rustler', 2], ['thief', 2], ['wolf', 30], ['fast', 8], ['fox', 4], ['digger', 3], ['bird', 3], ['locust', 25]], gap: 1.1, rows: ALL, hpMul: 1.7, ordered: true },
    ] },
    text: '沒有弓箭手、投石機、包紮的人。第一章所有敵人一波來，八十隻，2000 糧。失一隻羊就輸。',
    win: '一夜，一筆糧，一隻不少。「失喪的，我必尋找；被逐的，我必領回。」' },
  // ══ 第二章（期 2c，2026-10-31）：十夜各兩題，數字與勝率在 docs/phase-2c-plan-2026-10-31.md ══
  // ── 第 11 夜 井邊的夜（id 8）──
  { id: 'w8', kind: 'watch', levelId: 8, diff: 'storm', title: '井邊的夜・守望',
    mods: { gates: 0, waveOverride: [
      { list: [['wolf', 7], ['jackal', 2]], gap: 2, rows: ALL, hpMul: 1.5, ordered: true, say: '第 1 波，豺狼跟在後面' },
      { list: [['fast', 8], ['wolf', 10]], gap: 1.2, rows: ALL, hpMul: 2, say: '月亮下山了' },
      { list: [['jackal', 6], ['wolf', 10], ['thief', 3]], gap: 1.3, rows: ALL, hpMul: 2.3, ordered: true, say: '繞牆的、翻牆的' },
      { list: [['jackal', 8], ['wolf', 14], ['fast', 6]], gap: 1, rows: ALL, hpMul: 2.6, say: '最後一波' },
    ] },
    text: '月亮下山得更早：第一波就五排都有，豺狼跟在狼後面繞牆，第三波連翻牆的賊也來了。沒有看門的，杖要把狼趕進有射手的那排。',
    win: '井邊一夜無事。父親說：「那個人在哪裏？請他來吃飯。」今晚也請你。' },
  { id: 'f8', kind: 'fire', levelId: 8, diff: 'storm', title: '井邊的夜・烈火',
    mods: { units: ['slinger', 'wall', 'sling', 'hireling', 'tower', 'archer', 'thorns', 'brazier', 'jar', 'horn', 'healer', 'catapult'], oneBudget: true, startFood: 1200, gates: 0, waveOverride: [
      { list: [['jackal', 8], ['wolf', 34], ['fast', 9]], gap: 1.15, rows: ALL, hpMul: 1.5, ordered: true },
    ] },
    text: '沒有牧人杖、沒有牧羊犬。整夜五十一隻一波來，豺狼打頭陣，1200 糧。繞牆的沒有狗咬，只能靠守望樓和射手。',
    win: '沒有狗也沒有杖，羊一隻沒少。七個姊妹替你打了水。' },
  // ── 第 12 夜 拉結的燈（id 9）──
  { id: 'w9', kind: 'watch', levelId: 9, diff: 'storm', title: '拉結的燈・守望',
    mods: { gates: 0, waveOverride: [
      { list: [['wolf', 8]], gap: 2, rows: ALL, hpMul: 1.58, say: '第 1 波，五排都有' },
      { list: [['boar', 1], ['wolf', 9], ['fast', 5]], gap: 1.3, rows: ALL, hpMul: 2.1, ordered: true, say: '這麼早就有東西在撞' },
      { list: [['boar', 2], ['jackal', 3], ['wolf', 9]], gap: 1.3, rows: ALL, hpMul: 2.42, ordered: true, say: '兩頭野豬' },
      { list: [['boar', 3], ['wolf', 14], ['jackal', 4], ['fast', 6]], gap: 1, rows: ALL, hpMul: 2.73, say: '最後一波，三頭' },
    ] },
    text: '野豬第二波就來撞，最後一波三頭。沒有看門的，燈還是要點，守望樓要早放。',
    win: '三頭野豬都倒在牆外。拉結說：「看得見，就守得住。」' },
  { id: 'f9', kind: 'fire', levelId: 9, diff: 'storm', title: '拉結的燈・烈火',
    mods: { units: ['slinger', 'wall', 'dog', 'hireling', 'archer', 'thorns', 'brazier', 'jar', 'horn', 'healer', 'catapult', 'staff'], oneBudget: true, startFood: 1800, gates: 0, waveOverride: [
      { list: [['boar', 3], ['wolf', 33], ['jackal', 4], ['fast', 9]], gap: 1.15, rows: ALL, hpMul: 1.5, ordered: true },
    ] },
    text: '沒有油燈、沒有機弦手、沒有守望樓。三頭野豬帶著四十九隻一波來，1800 糧。撞牆的第一下很重，牆後面要有人補。',
    win: '黑暗裡守住了。拉結把燈遞給你：今晚用不著了。' },
  // ── 第 13 夜 迦密的夜（id 10）──
  { id: 'w10', kind: 'watch', levelId: 10, diff: 'storm', title: '迦密的夜・守望',
    mods: { gates: 0, maxSheepLost: 0, waveOverride: [
      { list: [['wolf', 8]], gap: 2, rows: ALL, hpMul: 1.5, strays: [12], say: '第 1 波，羊已經在路上' },
      { list: [['wolf', 10], ['fast', 4]], gap: 1.4, rows: ALL, hpMul: 1.9, strays: [8, 20], say: '又有羊下來' },
      { list: [['rustler', 2], ['wolf', 12], ['jackal', 3]], gap: 1.3, rows: ALL, hpMul: 2.2, ordered: true, strays: [15], say: '偷羊人也來了' },
      { list: [['boar', 1], ['jackal', 5], ['wolf', 14], ['fast', 5]], gap: 1, rows: ALL, hpMul: 2.5, strays: [6, 24], say: '最後一波' },
    ] },
    text: '迷羊更早下來、更多隻，第三波混進兩個偷羊人。沒有看門的，失一隻羊就輸。',
    win: '「我們未曾失落甚麼。」（撒上 25:15）今晚也是。' },
  { id: 'f10', kind: 'fire', levelId: 10, diff: 'storm', title: '迦密的夜・烈火',
    mods: { units: ['slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'thorns', 'brazier', 'jar', 'horn', 'healer', 'catapult', 'lamp'], oneBudget: true, startFood: 1200, gates: 0, maxSheepLost: 0, waveOverride: [
      { list: [['boar', 1], ['jackal', 6], ['wolf', 39], ['fast', 5]], gap: 1.15, rows: ALL, hpMul: 1.5, ordered: true, strays: [20, 40] },
    ] },
    text: '沒有巡夜人、沒有牧人杖。五十一隻一波來，野豬打頭陣，兩隻迷羊會在半路走進來；1200 糧，失一隻羊就輸。',
    win: '一波過去，迷羊回了圈。今晚「晝夜作保障」的人是你。' },
  // ── 第 14 夜 走迷的羊（id 18）──
  { id: 'w18', kind: 'watch', levelId: 18, diff: 'storm', title: '走迷的羊・守望',
    mods: { gates: 0, maxSheepLost: 0, waveOverride: [
      { list: [['wolf', 6], ['jackal', 2]], gap: 2, rows: ALL, hpMul: 1.5, ordered: true, strays: [10, 20], say: '第 1 波，豺狼跟著羊' },
      { list: [['wolf', 9], ['fast', 5]], gap: 1.4, rows: ALL, hpMul: 1.9, strays: [6, 16, 26], say: '三隻羊一起下來' },
      { list: [['jackal', 4], ['wolf', 10], ['fast', 4]], gap: 1.3, rows: ALL, hpMul: 2.2, ordered: true, strays: [8, 20], say: '豺狼更多' },
      { list: [['jackal', 7], ['wolf', 14], ['fast', 6]], gap: 1, rows: ALL, hpMul: 2.5, strays: [12], say: '最後一波' },
    ] },
    text: '八隻迷羊，豺狼第一波就跟著羊來。沒有看門的，失一隻羊就輸。狗先放羊走的那排。',
    win: '八隻都回來了。「我如亡羊走迷了路，求你尋找僕人。」（詩 119:176）' },
  { id: 'f18', kind: 'fire', levelId: 18, diff: 'storm', title: '走迷的羊・烈火',
    mods: { units: ['slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'thorns', 'brazier', 'jar', 'horn', 'healer', 'catapult', 'lamp'], oneBudget: true, startFood: 1100, gates: 0, maxSheepLost: 0, waveOverride: [
      { list: [['jackal', 7], ['wolf', 32], ['fast', 13]], gap: 1.15, rows: ALL, hpMul: 1.5, ordered: true, strays: [15, 30, 45] },
    ] },
    text: '沒有巡夜人、沒有牧人杖。五十二隻一波來，三隻迷羊半路走進來，1100 糧，失一隻羊就輸。狗留在羊走的那排。',
    win: '一波裡接回三隻羊。走迷的，找著了。' },
  // ── 第 15 夜 拉班的工價（id 11）──
  { id: 'w11', kind: 'watch', levelId: 11, diff: 'storm', title: '拉班的工價・守望',
    mods: { gates: 0, waveOverride: [
      { list: [['wolf', 8]], gap: 2, rows: ALL, hpMul: 1.33, give: 'slinger', say: '第 1 波，五排都有' },
      { list: [['alpha', 1], ['wolf', 9], ['fast', 5], ['jackal', 2]], gap: 1.4, rows: ALL, hpMul: 1.71, ordered: true, give: 'dog', say: '領頭狼來得早' },
      { list: [['boar', 2], ['wolf', 10], ['fast', 5]], gap: 1.3, rows: ALL, hpMul: 1.9, ordered: true, give: 'sling', say: '兩頭野豬' },
      { list: [['alpha', 2], ['wolf', 15], ['jackal', 5], ['fast', 7]], gap: 1.1, rows: ALL, hpMul: 2.18, give: 'tower', say: '最後一波，全混在一起' },
    ] },
    text: '拉班照舊送卡，但送的順序改了，領頭狼第二波就來嚎。沒有看門的，送來什麼就放什麼。',
    win: '拉班數了三遍，一隻沒少。「工價的事，改天再談。」' },
  { id: 'f11', kind: 'fire', levelId: 11, diff: 'storm', title: '拉班的工價・烈火',
    mods: { conveyor: false, units: ['slinger', 'wall', 'dog', 'thorns', 'jar', 'staff', 'lamp', 'patrol'], oneBudget: true, startFood: 1500, gates: 0, waveOverride: [
      { list: [['alpha', 1], ['boar', 1], ['wolf', 34], ['jackal', 6], ['fast', 10]], gap: 1.15, rows: ALL, hpMul: 1.4, ordered: true },
    ] },
    text: '今晚拉班不送卡了，一次給 1500 糧自己買，沒有機弦手、沒有守望樓。領頭狼帶著五十二隻一波來，開打前就要擺好。',
    win: '一筆工價換一夜平安。拉班說：「這次不改了。」' },
  // ── 第 16 夜 寬闊之地（id 12）──
  { id: 'w12', kind: 'watch', levelId: 12, diff: 'storm', title: '寬闊之地・守望',
    mods: { gates: 0, waveOverride: [
      { list: [['owl', 2], ['wolf', 7]], gap: 2, rows: ALL, hpMul: 1.5, ordered: true, say: '第 1 波，天上先來' },
      { list: [['owl', 4], ['wolf', 9], ['fast', 4]], gap: 1.3, rows: ALL, hpMul: 2, say: '夜鴞多了' },
      { list: [['wolf', 16], ['fast', 8], ['jackal', 5]], gap: 0.8, rows: ALL, hpMul: 2.3, say: '五排擠滿' },
      { list: [['owl', 8], ['boar', 3], ['wolf', 12], ['jackal', 4]], gap: 1, rows: ALL, hpMul: 2.7, say: '最後一波，天上地上' },
    ] },
    text: '夜鴞第一波就在天上飄，第三波狼群把五排擠滿，最後八隻夜鴞和三頭野豬一起來。沒有看門的，投石隊放中間。',
    win: '天亮了。以撒說：「耶和華現在給我們寬闊之地。」（創 26:22）' },
  { id: 'f12', kind: 'fire', levelId: 12, diff: 'storm', title: '寬闊之地・烈火',
    mods: { units: ['slinger', 'wall', 'sling', 'dog', 'hireling', 'archer', 'thorns', 'brazier', 'jar', 'horn', 'healer', 'catapult', 'staff', 'lamp', 'patrol'], oneBudget: true, startFood: 1700, gates: 0, waveOverride: [
      { list: [['owl', 9], ['boar', 2], ['wolf', 38], ['fast', 6], ['jackal', 8]], gap: 1.15, rows: ALL, hpMul: 1.45, ordered: true },
    ] },
    text: '沒有投石隊、沒有守望樓。九隻夜鴞、兩頭野豬帶著六十三隻一波來，1700 糧。天上的只能靠單排射手等牠飄過來。',
    win: '爭了，就再挖一口井。這一口是你守住的。' },
  // ── 第 17 夜 交託的羊（id 19）──
  { id: 'w19', kind: 'watch', levelId: 19, diff: 'storm', title: '交託的羊・守望',
    mods: { gates: 0, waveOverride: [
      { list: [['boar', 1], ['wolf', 6]], gap: 2.2, rows: ALL, hpMul: 1.17, ordered: true, say: '第 1 波，野豬打頭陣' },
      { list: [['jackal', 5], ['fast', 7], ['owl', 2]], gap: 1.2, rows: ALL, hpMul: 1.8, say: '只歇三秒' },
      { list: [['boar', 2], ['jackal', 3], ['owl', 2], ['wolf', 7]], gap: 1.3, rows: ALL, hpMul: 2.07, ordered: true, say: '又兩頭野豬' },
      { list: [['boar', 2], ['jackal', 5], ['wolf', 13], ['fast', 5]], gap: 1, rows: ALL, hpMul: 2.34, ordered: true, say: '最後一波' },
    ] },
    text: '波與波之間只歇三秒，野豬第一波就打頭陣，第三、四波各來兩頭。沒有看門的，牆和射手要在開打前擺好。',
    win: '天亮了。看守的人說：「等他回來，照數交還他。」' },
  { id: 'f19', kind: 'fire', levelId: 19, diff: 'storm', title: '交託的羊・烈火',
    mods: { units: ['slinger', 'wall', 'dog', 'hireling', 'archer', 'thorns', 'brazier', 'jar', 'horn', 'healer', 'catapult', 'staff', 'lamp', 'patrol', 'volley'], oneBudget: true, startFood: 1500, gates: 0, waveOverride: [
      { list: [['boar', 3], ['jackal', 11], ['owl', 1], ['wolf', 26], ['fast', 11]], gap: 1.15, rows: ALL, hpMul: 1.4, ordered: true },
    ] },
    text: '沒有機弦手、沒有守望樓。三頭野豬帶著五十二隻一波來，1500 糧。撞牆的第一下很重，牆後面要有人補。',
    win: '大衛從戰場回來，羊一隻不少。' },
  // ── 第 18 夜 分開的羊群（id 13）──
  { id: 'w13', kind: 'watch', levelId: 13, diff: 'storm', title: '分開的羊群・守望',
    mods: { gates: 0, maxSheepLost: 0, waveOverride: [
      { list: [['wolf', 8]], gap: 2.3, rows: ALL, hpMul: 1.31, say: '第 1 波，五排都有' },
      { list: [['wolf', 10], ['jackal', 3]], gap: 1.3, rows: ALL, hpMul: 1.71, strays: [6, 14, 24], say: '羊從山上下來了' },
      { list: [['owl', 5], ['wolf', 11], ['boar', 2]], gap: 1.2, rows: ALL, hpMul: 1.89, strays: [10, 22], say: '天上地上都來' },
      { list: [['leopard', 2], ['wolf', 10], ['fast', 6], ['jackal', 3]], gap: 1.3, rows: ALL, hpMul: 2.16, ordered: true, say: '草叢裡出來兩隻豹' },
    ] },
    text: '羊從山上一隻隻下來，第三波天上地上一起，最後兩隻豹走不同排。沒有看門的，失一隻羊就輸。',
    win: '兩家的羊都回來了。「你向左，我就向右。」（創 13:9）' },
  { id: 'f13', kind: 'fire', levelId: 13, diff: 'storm', title: '分開的羊群・烈火',
    mods: { units: ['slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'thorns', 'brazier', 'jar', 'horn', 'healer', 'catapult', 'staff', 'lamp', 'patrol'], oneBudget: true, startFood: 1650, gates: 0, maxSheepLost: 0, waveOverride: [
      { list: [['leopard', 1], ['boar', 1], ['owl', 4], ['wolf', 36], ['fast', 7], ['jackal', 2]], gap: 1.15, rows: ALL, hpMul: 1.5, ordered: true, strays: [20, 40] },
    ] },
    text: '沒有抱羊羔的牧人、沒有投石隊。豹帶著五十一隻一波來，兩隻迷羊半路下來，1650 糧，失一隻羊就輸。狗咬住豹就不換排。',
    win: '豹倒在草叢邊，羊一隻不少。明天就分開了。' },
  // ── 第 19 夜 歌珊的夜（id 20）──
  { id: 'w20', kind: 'watch', levelId: 20, diff: 'storm', title: '歌珊的夜・守望',
    mods: { gates: 0, waveOverride: [
      { list: [['wolf', 6]], gap: 3, rows: ALL, hpMul: 1.15, say: '第 1 波，五排都有，糧少' },
      { list: [['jackal', 2], ['wolf', 7], ['fast', 3]], gap: 1.9, rows: ALL, hpMul: 1.5, ordered: true, say: '月亮下山了' },
      { list: [['boar', 1], ['owl', 3], ['wolf', 9]], gap: 1.6, rows: ALL, hpMul: 1.8, ordered: true, say: '野豬和夜鴞' },
      { list: [['leopard', 1], ['alpha', 1], ['jackal', 3], ['wolf', 11], ['fast', 5]], gap: 1.3, rows: ALL, hpMul: 2.1, ordered: true, say: '豹和領頭狼，最後一波' },
    ] },
    text: '還是 100 糧開局、牧人最多三位，但第一波就五排都有，最後一波豹和領頭狼一起來。沒有看門的，先放牧人。',
    win: '剛到歌珊的一家人守住了全家的本錢。「你僕人是牧羊的。」（創 47:3）' },
  { id: 'f20', kind: 'fire', levelId: 20, diff: 'storm', title: '歌珊的夜・烈火',
    mods: { units: ['slinger', 'wall', 'dog', 'hireling', 'tower', 'archer', 'thorns', 'brazier', 'jar', 'horn', 'healer', 'catapult', 'staff', 'lamp', 'patrol', 'cradle'], oneBudget: true, startFood: 1900, gates: 0, waveOverride: [
      { list: [['leopard', 1], ['boar', 1], ['owl', 2], ['jackal', 5], ['wolf', 34], ['fast', 7]], gap: 1.15, rows: ALL, hpMul: 1.6, ordered: true },
    ] },
    text: '法老一次給了 1900 糧，沒有機弦手、沒有投石隊。豹帶著五十隻一波來，開打前就要擺好。',
    win: '法老把最好的地給了你們，你守住了。' },
  // ── 第 20 夜 合成一群（id 14）──
  { id: 'w14', kind: 'watch', levelId: 14, diff: 'storm', title: '合成一群・守望',
    mods: { gates: 0, maxSheepLost: 0, waveOverride: [
      { list: [['wolf', 7], ['fast', 2], ['jackal', 1]], gap: 2.6, rows: ALL, hpMul: 1.19, say: '第 1 波' },
      { list: [['jackal', 4], ['boar', 1], ['wolf', 11]], gap: 1.4, rows: ALL, hpMul: 1.7, say: '繞路的、撞牆的' },
      { list: [['owl', 5], ['bird', 3], ['wolf', 11], ['fast', 4]], gap: 1.2, rows: ALL, hpMul: 1.87, strays: [8, 20], say: '天上滿了' },
      { list: [['leopard', 1], ['alpha', 2], ['wolf', 9], ['boar', 2], ['jackal', 3]], gap: 1.3, rows: ALL, hpMul: 2.04, ordered: true, strays: [12, 26], say: '豹和領頭狼' },
      { list: [['leopard', 3], ['wolf', 14], ['fast', 9], ['jackal', 5], ['owl', 4]], gap: 1, rows: ALL, hpMul: 2.47, ordered: true, say: '三隻豹，最後一波' },
    ] },
    text: '五波全部更密，第三波天上滿了，最後一波三隻豹走不同排。沒有看門的，失一隻羊就輸。',
    win: '「要合成一群，歸一個牧人了。」（約 10:16）一隻也沒少。' },
  { id: 'f14', kind: 'fire', levelId: 14, diff: 'storm', title: '合成一群・烈火',
    mods: { units: ['slinger', 'wall', 'sling', 'dog', 'hireling', 'tower', 'archer', 'thorns', 'brazier', 'jar', 'healer', 'catapult', 'staff', 'lamp', 'patrol', 'cradle'], oneBudget: true, startFood: 1900, gates: 0, maxSheepLost: 0, waveOverride: [
      { list: [['leopard', 2], ['alpha', 1], ['boar', 2], ['owl', 9], ['bird', 2], ['jackal', 10], ['wolf', 50], ['fast', 11]], gap: 1.15, rows: ALL, hpMul: 1.4, ordered: true, strays: [20, 45] },
    ] },
    text: '沒有吹角手、沒有投石隊。第二章的狼、豺狼、野豬、夜鴞、鷙鳥、領頭狼、豹一波來，八十七隻，兩隻豹帶頭，兩隻迷羊半路下來；1900 糧，失一隻羊就輸。',
    win: '一夜，一筆糧，另外的羊也進了圈。「找著了，就歡歡喜喜地扛在肩上。」（路 15:5）' },
];

const DATA = { THICK_MUL, REPAIR_HINT, SPEED_FAST, SPEED_SLOW, HILL_SLOW, HILL_EDGE, HILL_DROP, ROWS, COLS, UNITS, ENEMIES, STRAY, STATUS, DIFFS, LEVELS, TRIALS, TRIAL_KINDS, ELDER_MUL, ELDER_COST, REPAIR_COST, REPAIR_HP, REPAIR_CD, MAX_CARDS, MIN_CARDS, SELL_RATE, SWAP_KINDS, PICK_ORDER, PREP_TIME, WAVE_REST, FORESHADOW_LEAD, START_FOOD, TRICKLE };
if (typeof module !== 'undefined') module.exports = DATA; else window.DATA = DATA;
