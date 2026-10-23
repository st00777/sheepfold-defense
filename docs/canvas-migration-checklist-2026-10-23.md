# 棋盤改 PixiJS canvas：盤點清單（2026-10-23）

範圍：把 `index.html` 裡「畫在棋盤上或跟棋盤互動」的部分，從 DOM 搬到 PixiJS canvas。
依據：完整讀過 `index.html`（1701 行）與 `proto/canvas-board.html`（618 行）。沒讀 `engine.js`、`data.js`、`sound.js`，所以敵人 `cls` 組合、引擎事件欄位是從呼叫處推的。
估工標準：一個熟 Pixi 的人、畫面與手感不退步。「已做」的條目仍算整合進 `index.html` 的小時數，因為原型是獨立檔、全域變數、沒有音效與暫停。
行號指 `index.html` 目前版本。「CSS」是樣式區，其餘是 JS。

## A 格子與單位

| # | 功能 | index.html 位置 | 原型已做？ | 搬進 canvas 的做法一句話 | 風險 | 估工 |
|---|---|---|---|---|---|---|
| A1 | 棋盤底圖 ground.webp（cover） | CSS #board 114-116 | 已做 | 一張 Sprite 鋪底，縮放為 cover | 低：純貼圖 | 0.5 |
| A2 | 格子底色、交錯色、淡格線 | CSS .cell/.cell.alt 119-120、buildBoard 631-648 | 已做 | Graphics 畫 35 格半透明矩形，尺寸變就重畫 | 低 | 1 |
| A3 | 石頭格（灰底＋🪨 圖 opacity .7） | CSS .cell.rock 121,132；startGame 1343 | 部分 | 原型只填灰色，補一張 rock 圖 Sprite 疊上去 | 低 | 0.5 |
| A4 | 單位本體底色與各型態樣式：elder 金框＋變暗、thorns 虛線圓、staff 邊框、dog/patrol 半透明記號、healer/horn 升級金框、cradle、fear 灰階 | CSS 142-152,159；renderUnit 890-906 | 部分（只有底色、elder 框、fear 藍框） | 每型態一個 draw 函式；灰階用 ColorMatrixFilter；虛線圓需自己切弧段（Pixi 沒有 dash） | 中：約 8 種外觀逐一對照，filter 會增加 draw call | 4 |
| A5 | 單位圖示（Fluent 圖；狗窩用 🦴、巡夜崗位用 🪵） | renderUnit 900；ICON_IMG 617-624 | 已做 | 同原型：Sprite＋貼圖表 | 低 | 0.5 |
| A6 | 「人」待機呼吸（依格子錯開相位） | CSS .unit.shepherd .ico… 172、breathe 188 | 已做 | 正弦縮放；speed>1 時停 | 低 | 0.5 |
| A7 | 火盆／油燈火光晃動（scale＋opacity 閃） | CSS 173-174 flicker | 部分（原型用光暈 Sprite 閃，圖示本身沒晃） | 補圖示的縮放／透明度閃爍，光暈沿用 | 低 | 1.5 |
| A8 | 升級角標 .badge（🦂、🫗） | renderUnit 901；CSS 160 | 已做 | 單位容器內加小 Sprite | 低 | 0.5 |
| A9 | 單位血條（紅綠色分界、1 血單位不畫、狗不畫） | renderUnit 902；CSS 157-158 | 部分（原型有，且只在血量變時重畫） | Graphics 兩段矩形；修補後要即時更新 | 低 | 1 |
| A10 | 吹角手／銀號冷卻條（填滿、滿了發亮 ready） | renderUnit 903；draw 1224-1232；CSS 154-156 | 沒做 | 每幀依 u.timer 畫金條，ready 時加 add 混合光暈 | 低 | 1.5 |
| A11 | 「可升級／修補」金色角標 .up（糧夠才出現、彈跳 4 下） | draw 1241-1248；CSS 162-163 | 沒做 | Pixi.Text＋圓角底，依 Engine.tapHint 長出／移除，bob 用 tween | 中：每幀對全部單位查 tapHint，文字物件要池化 | 2 |
| A12 | 升級／修補後重畫（引擎換新 unit 物件） | flushEvents case 'unit' 1085 | 已做 | 沿用原型「u !== v.u 就重畫」 | 低 | 0.5 |
| A13 | 鏟除模式：有單位的格亮紅色虛線框 | markHints 836；CSS 94,133 | 沒做 | 同 A14 的框線繪製，換紅色 | 低 | 1 |
| A14 | 拿卡時可放置格的金色虛線框（空地、非石頭） | markHints 832-842；CSS .cell.hint 133 | 沒做 | Graphics 逐格畫虛線框（手切線段）；單位數變時要重算（draw 1235） | 中：虛線要自己畫，重算時機容易漏 | 2.5 |
| A15 | 換卡提示：可直接換掉的單位亮金色實線框 | markHints 837-839；CSS .swap 95 | 沒做 | 同 A14，用實線；依 Engine.canSwap | 低 | 1 |
| A16 | 範圍預覽 .range（滑過／按住／放下後 1.3 秒，淡金鋪色，不蓋住單位） | rangeCells/showRange/clearRange 852-871；CSS 135 | 沒做 | rangeCells 是純邏輯可直接用；畫在單位層下方的半透明矩形 | 低 | 2.5 |
| A17 | 教學高亮：目標格金框＋內發光閃 | tutShow 1555-1561；CSS .cell.teach 101-102 | 沒做 | 金框＋內發光 Sprite 做 alpha 往返；reduced-motion 時固定 .8 | 低 | 2 |
| A18 | 開局／續玩直接畫出場上既有單位（不播放置動畫） | startGame 1343-1346 | 部分 | 從 G.units 一次建好；注意要清掉重複的 'unit' 事件 | 低 | 1 |

## B 敵人與移動單位

| # | 功能 | index.html 位置 | 原型已做？ | 搬進 canvas 的做法一句話 | 風險 | 估工 |
|---|---|---|---|---|---|---|
| B1 | 敵人本體：圓／方圓、暗紅細圈、金圈（alpha/lion/leopard）、各 cls 底色與大小係數 k（fast .8、big 1.3、small 50%、swarm 45%…）、fast 的速度線、dig 的上下分色、light/sly/boar/owl | CSS 203-219；draw 1152-1158 | 部分（圓／方圓、金圈、部分顏色；沒有速度線、dig 分色、leopard/sly 色） | 把 CSS 規則整理成一張 cls→外觀表，Graphics 繪製；k 要用 CSS 同樣的疊乘規則而非原型的「最後一個勝出」 | 中：約 20 種 cls 組合，漏一個就看起來不同 | 4 |
| B2 | 走路搖擺（左右轉 ±3.5° 加起伏；fast/big/boar 變速，飛行改上下飄） | CSS 175-178,189-190 | 已做 | 正弦旋轉＋位移，起點隨機相位 | 低 | 1 |
| B3 | s-burn：橘色外發光 | CSS 233；draw 1160 | 部分（原型染色加火星，沒有外圈光） | 加一圈 add 混合光暈 Sprite | 低 | 1 |
| B4 | s-poison：偏黃綠色調 | CSS 237 | 部分（原型 tint 綠） | tint 或 ColorMatrixFilter（sepia＋hue）擇一對齊 | 低 | 0.5 |
| B5 | s-stun：半透明 .6、走路動畫暫停 | CSS 180,238 | 部分（暫停有，沒降透明度；多了轉星粒子） | 補 alpha .6 | 低 | 0.5 |
| B6 | s-crouch 蹲伏：縮 .8、下沉 12%、變暗 | CSS 220 | 部分（原型只降透明度） | scale＋y 偏移＋暗化（tint 或 filter） | 低 | 1 |
| B7 | s-dash 衝刺：亮度 1.25 | CSS 221 | 沒做 | Pixi tint 不能超過 1，要用 ColorMatrixFilter 或疊一層 add 混合 | 中：tint 做不到，需 filter | 1 |
| B8 | biting 啃咬：往前一下一下撲（加速也保留，因為是資訊） | CSS 179,186 | 已做 | 沿用，但 speed>1 時仍要保留 | 低 | 0.5 |
| B9 | underground 地下：完全透明（原型留 .3） | CSS 225 | 部分 | alpha 改回 0；確認土堆 mound（D16）接得上 | 低 | 0.5 |
| B10 | carry 叼羊：身上掛小羊 | CSS 229；draw 1165 | 已做 | 子 Sprite 依 e.carrying 增刪 | 低 | 0.5 |
| B11 | dying 倒下：220ms 縮 .85＋淡出，脫離管理（reduced-motion 只淡出） | dieFx 964-977；CSS 235 | 已做 | tween 後 destroy | 低 | 0.5 |
| B12 | 受擊閃白（90ms；蝗群不閃；飛禽閃淡） | flashHit 957-962 | 已做 | 疊 add 混合同圖 Sprite，alpha 衰減 | 低 | 0.5 |
| B13 | swing 巡夜人揮棒（往前 28%＋轉 14°，300ms；reduced-motion 改亮一下） | swingPatrol 933-936；CSS 140-141,402 | 沒做 | fx 事件帶 id → 對應 mover 做 tween | 低 | 1 |
| B14 | 敵人血條（紅條；alpha/big 加粗 5px） | CSS 157,230-231；draw 1166 | 部分（原型綠紅切換、沒加粗） | 依 cls 設高度，顏色對齊正式版 | 低 | 0.5 |
| B15 | 頭上狀態圖示 .st（😡😱💫🔥☠️，最多 2 個） | statusText 1131-1135；draw 1167；CSS 232 | 沒做 | 每隻一個 Text，字串變才更新 | 中：emoji 文字在各平台渲染不一，每隻敵人一個文字物件 | 1.5 |
| B16 | hpMul 放大（強化波的敵人 +20%×倍率） | draw 1155-1156；CSS --hs 204 | 已做 | 沿用原型 k 乘上 hpMul 係數 | 低 | 0.5 |
| B17 | 換排滑動（rv）、賊翻牆弧線（lift） | draw 1162-1163 | 已做 | 沿用 | 低 | 0.5 |
| B18 | 飛行敵人（fly/owl/swarm）：無身體底、上方對齊、腳下橢圓影、懸浮動畫；蝗群數量大 | CSS 178,226-228；draw | 部分（無底、有飄；無影子） | 補影子；蝗群用較便宜的繪法 | 中：蝗群一次幾十隻，要看效能 | 1.5 |
| B19 | 牧羊犬 .dog-run：圓底、血條、休息時半透明＋💤、走路搖 | draw 1177-1185；CSS 181-182,246-248 | 部分（無休息狀態） | 補 resting 的 alpha .55 與 💤 子 Sprite | 低 | 2 |
| B20 | 巡夜人 .patrol-run：方圓底、血條 | draw 1186-1193；CSS 223 | 部分（原型畫圓，正式版是圓角方） | 改圓角方 | 低 | 0.5 |
| B21 | 迷羊 .stray：白圓底＋金圈、走動搖（0.7s） | draw 1194-1199；CSS 224,184 | 部分（原型沒畫底圈） | 補白圓＋金框 | 低 | 0.5 |
| B22 | 敵人／投射物／移動單位的建立與回收（els Map、id 對應、離場移除） | draw 1146-1200 | 已做 | 原型已有 EN/MV/SH 三張表 | 低 | 0.5 |

## C 投射物

| # | 功能 | index.html 位置 | 原型已做？ | 搬進 canvas 的做法一句話 | 風險 | 估工 |
|---|---|---|---|---|---|---|
| C1 | 石子（預設）／投石 sling／投石機 lob 三種大小與顏色 | CSS 266-269；draw 1169-1176 | 已做 | 原型已有 | 低 | 1 |
| C2 | 箭 arrow（細長、朝右） | CSS 267 | 已做 | 線段 Graphics | 低 | 0.5 |
| C3 | burn 帶火（橘色發光） | CSS 270；draw 1173 | 已做 | add 混合光暈＋火星 | 低 | 0.5 |
| C4 | lob 拋物線（高 .6 格）加地面影子 | draw 1174 | 已做 | 原型已有影子（正式版沒有） | 低 | 0.5 |
| C5 | 石子灰塵拖尾、燃燒拖火（原型新增，正式版沒有） | proto drawShots | 已做 | 保留與否是設計決定；要量效能 | 低 | 0.5 |
| C6 | 生成時觸發射手後退（recoil）與射擊音 | draw 1172 | 部分（recoil 有，音效無） | 建立投射物時呼叫 recoil 與 Sound.play('shot') | 低 | 0.5 |
| C7 | 座標由格子換算成像素、隨棋盤大小變 | draw 1137,1175；boardSize 550-551 | 部分（原型用 cw/ch，但已建立物件的尺寸不會跟著縮放） | 尺寸變時重設所有 Sprite 大小（見 G7） | 中：與 resize 綁在一起 | 0.5 |

## D 一次性效果

fx 的每一種 kind 對照 `FX` 表（909）與 `fx()`（913-924）。原型的 `fx()` 不是逐種對照，部分用「粒子爆發」取代原本的 emoji 飄字，視覺不同。

| # | 功能 | index.html 位置 | 原型已做？ | 搬進 canvas 的做法一句話 | 風險 | 估工 |
|---|---|---|---|---|---|---|
| D1 | blast 💥 | FX 909；FX_SFX 911 | 已做（改成圓環＋火花＋震動） | 沿用原型 | 低 | 0.5 |
| D2 | splash 💥 | 909 | 已做（圓環＋粒子） | 沿用 | 低 | 0.3 |
| D3 | slam 💥 | 909 | 已做 | 沿用 | 低 | 0.3 |
| D4 | ignite 🔥 | 909 | 已做（火星） | 沿用 | 低 | 0.3 |
| D5 | sting ☠️ | 909 | 已做（飄字） | 沿用 | 低 | 0.3 |
| D6 | flee 💨 | 909 | 部分（原型是塵煙，正式版有 💨 字） | 補飄字 | 低 | 0.5 |
| D7 | emerge 💨（並移除土堆） | 909、fx 915 | 已做 | 沿用 | 低 | 0.3 |
| D8 | trample 💨 | 909 | 已做（塵煙） | 沿用 | 低 | 0.3 |
| D9 | horn 📯（定點 emoji）＋吹角音波 | 909；flushEvents 1086 | 部分（原型改成橫掃音波，沒有 📯） | 決定保留哪種；與 E4 一起做 | 低 | 1 |
| D10 | grab 🐑 | 909 | 已做 | 沿用 | 低 | 0.3 |
| D11 | enrage 😡 | 909 | 已做 | 沿用 | 低 | 0.3 |
| D12 | rest 💤 | 909 | 已做 | 沿用 | 低 | 0.3 |
| D13 | home 💛 | 909 | 已做 | 沿用 | 低 | 0.3 |
| D14 | crouch 👁 | 909 | 已做 | 沿用 | 低 | 0.3 |
| D15 | strike ✦（放大描金）＋巡夜人揮棒 | fx 922；CSS .fx.strike 139 | 部分（火花，沒有 ✦ 字，也沒有揮棒） | 補金色 ✦ 字＋與 B13 連動 | 低 | 1 |
| D16 | mound 🕳️ 土堆（常駐閃爍，emerge 時移除） | fx 914-915；CSS .fx.stay 274 | 部分（原型畫棕色橢圓，不閃） | 補 alpha 閃爍，id 管理 | 低 | 1 |
| D17 | howl／roar 波紋（雙環，第二環延遲 .25s，擴 2.6 倍） | ripple 943-947；CSS 242-245 | 部分（單環） | 補第二環 | 低 | 0.5 |
| D18 | bark／hop：刻意不畫（維持） | fx 918-919 | 已做 | 不用動 | 低 | 0 |
| D19 | dodge 狐狸閃避殘影（身體側移 40%、淡到 .4，350ms） | flashDodge 948-952；CSS 239-240 | 沒做 | 對應敵人 body 做 tween | 低 | 1.5 |
| D20 | gateSweep：人影從門口掃到右邊，拖金色光尾（0.9s） | gateSweep 938-942；CSS 258-261 | 部分（只有金帶，沒有人影，沒有 Sound） | 補 🧍 Sprite 位移＋光尾；呼叫 horn 音 | 低 | 1 |
| D21 | catchFx 接回：他那格浮「接回 🐑」金色小牌子＋牧人跳一下 | catchFx 926-931；CSS .fx.label 137 | 沒做 | 圓角底＋Text，tween 上飄；對應單位 hop | 低 | 1.5 |
| D22 | dust 倒下塵（同時最多 4 朵） | dieFx 971-976；CSS 236 | 已做（粒子，無上限 4） | 加 4 朵上限 | 低 | 0.5 |
| D23 | pop 飄字（+N 金色；位置 c+.3、r+.2） | pop 1051-1055；CSS 271,275 | 已做 | 沿用 | 低 | 0.5 |
| D24 | 文字渲染：所有 pop／fx／標籤用 Pixi.Text，含 emoji、中文 | popText proto 538 | 部分 | 做文字池，避免每次新建；確認 iOS／Android 的 emoji 與中文字型 | 中：Pixi.Text 要產生貼圖，頻繁新建會卡，各平台 emoji 顏色不一 | 2 |

## E 儀式型效果

| # | 功能 | index.html 位置 | 原型已做？ | 搬進 canvas 的做法一句話 | 風險 | 估工 |
|---|---|---|---|---|---|---|
| E1 | recoil 射手後退 3px（90ms；加速、reduced-motion 不做） | recoilUnit 989-993 | 已做 | 沿用 | 低 | 0.5 |
| E2 | hop 產糧小跳（只對產糧單位） | hopUnit 995-1000；pop 事件 1084 | 已做 | 沿用 | 低 | 0.5 |
| E3 | squash 放置回彈（樞紐在腳底 50% 90%；只在玩家放下時；reduced-motion 不做） | squashUnit 979-984；tapCell 882 | 部分（原型樞紐在中心，任何新單位都會觸發） | 把 pivot 移到腳底；只在 tapCell 成功時觸發 | 低 | 1 |
| E4 | hornShove 吹角頓挫：吹的人回彈，被推的敵人從原位滑到新位（引擎已更新位置，視覺疊加位移） | hornShove 1002-1011 | 沒做 | 每隻 moved 敵人加一個 offset tween，疊在引擎位置上 | 中：WAAPI 的 composite:add 要改成自己維護的 offset，漏了會跳位 | 2 |
| E5 | bossEnter 頭目登場：外框震 2px／350ms＋金邊光暈閃（700ms） | bossEnter 1013-1017 | 部分（震動與金邊有，但連看門的一起震；沒有光暈） | 外框獨立一層；加外發光 | 低 | 1 |
| E6 | dusk 入夜：暖橘罩（漸層橘到紫）4 秒退成夜色；續玩不做 | dusk 1019-1024；CSS 193-195 | 部分（原型單色，且續玩也會播） | 漸層貼圖＋alpha tween；續玩略過 | 低 | 1 |
| E7 | dawn 天亮：金光漸層罩（.9s）、無月夜暗罩 2 秒退掉、看門的發光 | dawn 1026-1032；CSS 196,202 | 部分（只有單色金罩，沒有暗罩退場、沒有看門的發光） | 補漸層、暗罩 alpha tween、gate 發光 | 低 | 2 |
| E8 | 守過跳一下：看門的由上到下跳、場上單位由左到右跳（延遲 70ms／55ms 遞增） | dawn 1030-1031 | 沒做 | 一組帶延遲的 tween | 低 | 1.5 |
| E9 | lose 失守冷罩（同 dawn 格式，.9s） | nightfall 1034；CSS 197 | 部分（原型用單色） | 補漸層 | 低 | 0.5 |
| E10 | lightning 閃電（暴風夜、波開始時 35% 機率；無月夜／加速／reduced-motion 不閃） | lightning 1041-1044；tick 1110 | 已做（機率 .5，且沒擋 reduced-motion 與加速） | 對齊條件與機率 | 低 | 0.5 |
| E11 | 火盆／油燈點亮（放下時縮小冒出、閃暖光 520ms） | igniteUnit 1036-1040；tapCell 882 | 沒做 | 圖示 Sprite 的 scale＋光暈 tween | 低 | 1 |
| E12 | 棋盤特效與結算頁的時序（先看到天亮／冷罩，0.9 秒後才出結算頁；reduced-motion 立刻） | onWin 1288-1297、onLose 1315 | 沒做（原型自己畫「天亮了」字） | 維持 setTimeout 0.9s；canvas 只負責罩色，結算字樣仍用 DOM | 低 | 0.5 |

## F 環境

| # | 功能 | index.html 位置 | 原型已做？ | 搬進 canvas 的做法一句話 | 風險 | 估工 |
|---|---|---|---|---|---|---|
| F1 | 無月夜暗化：整個棋盤降亮度 .78＋降飽和 .85，2 秒漸變；天亮後不再罩 | CSS #board.moonless 123-124；draw 1215-1216 | 部分（原型改用離屏貼圖蓋一層暗色，油燈用 erase 混合挖洞；沒有漸變） | 要決定：整層 filter（便宜但吃整個畫面）還是離屏暗罩（原型作法）。後者每幀重繪全螢幕貼圖 | 高：每幀離屏重繪＋erase 混合，低階手機與 context lost 後都容易出事 | 3 |
| F2 | 右側 22% 黑霧（每排一條，漸層，2 秒淡入） | CSS .fog 125-126；buildBoard 645 | 沒做（原型改用暗角） | 每排一個漸層 Sprite，alpha tween | 低 | 1.5 |
| F3 | 被燈照到的排：黑霧 .6s 散掉、草地轉暖亮 | CSS 128-131；draw 1218-1221 | 部分（原型用 erase 帶取代，沒有暖色） | 補暖色 tint 或疊 add 混合 | 低 | 1 |
| F4 | rowLit 判定與正式版一致 | draw 1219 Engine.rowLit | 部分（原型自己寫 litRow 與 ensureHole，可能與引擎判定不同） | 全部改用 Engine.rowLit | 中：判定不一致會讓腳印預告與亮區對不上 | 1 |
| F5 | 暴風 #weather 冷色罩（.14；疊無月夜時 .08） | CSS 198-200；tick | 已做（還多了雨絲） | 沿用；雨絲是否保留是設計決定 | 低 | 0.5 |
| F6 | #frame 外框：棋盤外推 3px、z 在最上、不吃點擊，頭目登場只震它 | CSS 118；#shell 433 | 部分（原型畫在畫布內側，且把看門的放在同層一起震） | canvas 比 board 大 3px，或框維持 DOM | 中：外推會影響 canvas 與 shell 尺寸計算 | 1.5 |
| F7 | 走道 #lane（漸層＋內陰影）與左側圍欄 .fence（9px 木紋） | CSS 113,201；buildBoard 647 | 部分（原型平色加 4 條線） | 漸層貼圖＋重複條紋 | 低 | 1.5 |
| F8 | 看門的 .gate 本體：一排一位、none 不畫、used 變灰縮 .85 | draw 1202-1212；CSS 252-257 | 部分（原型 used 只降 alpha） | 補灰階＋縮放＋陰影 | 低 | 2 |
| F9 | 用掉的轉場：門口閃紅 1.1s、往門內跨一步再退（520ms，reduced-motion 不跨） | draw 1207-1211；CSS 254-255 | 沒做 | 紅色矩形 alpha tween＋位移 tween | 低 | 1.5 |
| F10 | 點看門的跳說明 toast（GATE_TIP／已用掉） | draw 1204；GATE_TIP 569 | 沒做（原型忽略走道的點擊） | 走道範圍做 hit area，呼叫 toast | 低 | 0.7 |
| F11 | 敵人腳印 .mark：右緣、閃爍，special 加紅圈、boss 加金圈；無月夜可見性 | setMarker 1063-1072；CSS 249,263-265 | 部分（原型另外算可見性，正式版靠引擎事件） | 先確認引擎在看不見時是否送 r=null，再決定是否還要自己算 | 中：原型的可見性規則可能與正式版不同 | 1 |
| F12 | 迷羊腳印 .stray-mark（與敵人腳印錯開一格） | setStrayMark 1057-1062；CSS 250 | 部分（原型與敵人腳印同一位置，會疊） | x 往左位移一格 | 低 | 0.5 |
| F13 | #sky 圖層本身（漸層、z 序、過渡時間）；E6／E7／E9 共用 | CSS 193-197 | 部分 | 三組漸層貼圖共用一個 Sprite | 低 | 0.5 |

## G 互動

| # | 功能 | index.html 位置 | 原型已做？ | 搬進 canvas 的做法一句話 | 風險 | 估工 |
|---|---|---|---|---|---|---|
| G1 | 點格子放單位（含音效、回彈、點亮、範圍殘留 1.3 秒、取消選取、教學限定格） | tapCell 872-887 | 部分（原型只呼叫 Engine.place） | 在 stage 的 pointertap 換算 r,c 後走同一段邏輯 | 中：邏輯很多，容易漏分支 | 2 |
| G2 | 點單位升級／修補（沒選卡時） | tapCell 876 | 已做 | 沿用 | 低 | 0.5 |
| G3 | 鏟子模式（點單位拆掉） | tapShovel 824-830；tapCell 875 | 沒做 | 沿用邏輯，只需 canvas 提供 r,c 與 A13 的框線 | 低 | 1 |
| G4 | 換卡 swap（格子有人時走 Engine.swap） | tapCell 879 | 沒做 | 同 G1 | 低 | 1 |
| G5 | hover／按住的範圍預覽（pointerenter 顯示、pointerleave 清除） | buildBoard 639-640 | 沒做 | 在 canvas 上自己追蹤 pointermove／觸控按住，對應 A16 | 中：觸控的 enter／leave 語意與 DOM 不同 | 2 |
| G6 | 卡片選取狀態與棋盤同步（selected、markHints、clearSelection） | tapCard 809-823；clearSelection 843-848 | 沒做 | 抽一個 boardView.setHint／clear 介面，卡片列呼叫它，不再直接碰 cells 陣列 | 中：cells 陣列在 6 處被直接操作 | 1 |
| G7 | ResizeObserver、fitBoard、boardSize：棋盤大小變時，所有已建立物件重新縮放 | 551-563；draw 1137 | 部分（原型會重畫格線，但已建立的 Sprite 大小不會變） | 把「依 cw/ch 設定尺寸」集中成 resize 回呼，一次重設全部物件 | 中：旋轉手機、大字、提示列變高都會觸發；漏了就是尺寸錯 | 3 |
| G8 | 點擊座標換算（走道偏移 28px、DPR、7:5 比例） | proto onTap；fitBoard 552-560 | 部分（原型用 7.4:5 的近似比例） | 以實際 canvas 尺寸為準；maxWidth 公式要把走道算進去 | 低 | 1 |
| G9 | 教學期間的點擊限制（只能點亮著的那一格） | tapCell 877；tapCell 876 | 沒做 | 邏輯不變，只需 canvas 回傳 r,c | 低 | 0.5 |
| G10 | 開發者放敵人（devEnemy＋點格子） | tapCell 874 | 沒做 | 同 G1 的入口 | 低 | 0.5 |
| G11 | 觸控行為：touch-action、雙擊縮放、長按選單、:active 回饋 | 36,548；contextmenu 1676 | 沒做 | 在 canvas 元素上設 touch-action:manipulation 與 contextmenu 防呆 | 低 | 0.5 |
| G12 | 長按左上「糧」1.5 秒開開發者列 | 1673-1676 | 不適用 | 在 DOM 頂欄，不動 | 低 | 0 |

## H 系統行為

| # | 功能 | index.html 位置 | 原型已做？ | 搬進 canvas 的做法一句話 | 風險 | 估工 |
|---|---|---|---|---|---|---|
| H1 | 暫停：停引擎，且所有動畫一起停（現在靠 .paused 與 WAAPI heldAnims 逐一暫停） | syncPause 1582-1587；tick 1105 | 沒做 | canvas 動畫全是自己算時間，暫停時不推進 dt 即可，比 DOM 簡單；但 Pixi ticker 要決定是否停 | 低 | 1.5 |
| H2 | speed>1 關裝飾（#board.fast）：呼吸、走路、火星、一次性回彈、塵煙 | setSpeed 1121-1126；CSS 185-186 | 部分（原型多數有擋，但 squash、hop、環形波紋沒擋） | 逐項檢查 speed 守門 | 低 | 1 |
| H3 | 結算靜止（#board.still）：結算頁底下的棋盤不再動、不白耗電 | endGame 1253；clearBoard 1323 | 部分（原型 over 後仍每幀渲染，雨絲仍在生成） | over 後停止粒子與雨，或停 ticker | 低 | 1 |
| H4 | reduced-motion：循環動畫全關（含啃咬） | CSS 394 `#board .ico` !important | 沒做 | 一個總開關讀 matchMedia，關掉呼吸／走路／閃爍／撲擊 | 低 | 0.7 |
| H5 | reduced-motion：.pop／.fx 改成只淡出 .5s，不位移；.fx.label 1.2s | CSS 400-401 | 沒做 | tween 依開關改曲線 | 低 | 0.5 |
| H6 | reduced-motion：gate-sweep 只淡出不位移 | CSS 398 | 沒做 | 同上 | 低 | 0.3 |
| H7 | reduced-motion：看門的用掉不縮、閃紅縮短為 .6s、不跨步 | CSS 396-397；draw 1210 | 沒做 | 同上 | 低 | 0.3 |
| H8 | reduced-motion：巡夜人揮棒改亮一下 | CSS 402 | 沒做 | 揮棒改 tint 閃 | 低 | 0.3 |
| H9 | reduced-motion：回彈類一次性動畫關（squash、recoil、hop、hornShove、點亮、接回跳） | JS 929,979,990,996,1003,1037 | 沒做 | 在各 tween 入口統一守門 | 低 | 0.5 |
| H10 | reduced-motion：天色類（入夜略過、閃電不閃、頭目登場不震只閃金邊、sky.fade 無過渡、守過不跳） | JS 1015,1021,1028,1042；CSS 395 | 沒做 | 同上 | 低 | 0.7 |
| H11 | reduced-motion：倒下只淡出不出塵；腳印／.fx.stay／.up 不閃；結算頁不延遲 | JS 966-970,1297,1315；CSS 393 | 沒做 | 同上 | 低 | 0.5 |
| H12 | 大字模式 bigtext：只放大 DOM 文字，間接讓提示列變高、棋盤縮小 | CSS 40-43；applyBig 1619 | 沒做（原型沒有此功能） | canvas 本身不受影響，但棋盤縮放要靠 G7 | 低 | 0.5 |
| H13 | visibilitychange 自動暫停＋回來後 dt 保護（last 重設） | 1602；resumeGame 1596 | 沒做 | 沿用 pauseGame；resume 時重設 Pixi ticker 的時間 | 低 | 0.5 |
| H14 | WebGL context lost／restore（iOS 切 app 回來常見）：離屏貼圖與所有貼圖需重建 | 無（DOM 版沒有此問題） | 沒做 | 監聽 contextlost／contextrestored，重載貼圖與 RenderTexture | 高：行為要實機測，原型的 darkRT 內容會直接消失 | 3 |
| H15 | icoFail：圖載失敗退回 emoji；ZWJ 組合字退替身 | icoFail 626；emojiFallback 1680-1689 | 沒做（原型 Assets.load 一次載全部，一張失敗整批失敗，畫面空白） | 逐張載入、失敗的用 Text emoji 補；ZWJ 邏輯保留 | 中：現在全有或全無，會變成整個棋盤不出現 | 2 |
| H16 | Pixi 本身的取得與相容：原型從 cdnjs 載入；v8 沒有 canvas 後援，WebGL 不能用就整個黑 | proto 49 | 沒做 | 自己託管 pixi.min.js（約 0.5MB）、偵測失敗給明確訊息；若要保留 DOM 版當後援，等於兩套維護 | 高：舊 Android WebView／省電模式 | 3 |
| H17 | 效能與耗電：DPR 2 的全螢幕離屏貼圖、粒子上限、雨絲、蝗群、低階手機實測與調整 | proto 84,580,385 | 沒做（原型只在桌機看過） | 加畫質降級開關（粒子、雨、離屏暗罩）；實機量 FPS | 高：沒有數據，正式版目前很省 | 4 |
| H18 | draw()／flushEvents 拆分：音效呼叫散在 draw 與 flushEvents，要抽出；tick 的例外處理要涵蓋 Pixi | flushEvents 1075-1099；draw 1172,1213；tick 1112-1118 | 沒做（原型沒有音效與例外處理） | 抽一個 boardView 介面，狀態同步與音效分離 | 中：index.html 是單檔，抽離時容易動到不相干邏輯 | 3 |
| H19 | 清場、重開、切關、回關卡時的資源回收，以及 overlay 開著時停止渲染 | clearBoard 1319-1328；backToLevels 1355-1362 | 部分（newGame 有清，沒處理 overlay） | destroy 子物件；overlay 開時暫停 ticker | 中：Pixi 物件沒 destroy 會慢慢漏記憶體 | 1.5 |

## 棋盤以外維持 DOM 的部分與棋盤的接點

下列都不搬：卡片列、頂欄（糧、羊、波次、⏩、🔊、⏸）、進度條與提示列 `#bottom`、暫停層、圖鑑與點兵、開場頁、關卡選單、結算頁、存檔、音效、開發者列。接點如下：

1. 卡片列：`selected` 狀態要通知棋盤畫提示框（G6）；`buildCards()` 與 `tapCard()` 目前直接改 `cells` 陣列的 class（`markHints`、`clearSelection`、`tutShow`、`startGame`），要換成對 boardView 的呼叫。教學的暗卡 `.dim` 留在卡片列。
2. 頂欄與進度條：只讀引擎狀態，與棋盤無關，不動。
3. 暫停：`paused` 旗標要讓 canvas 動畫不推進（H1）；暫停層疊在上面，z-index 10 蓋住 canvas，不需處理點擊。
4. 大字模式：只改字級，但會讓 `#bottom` 變高，連帶 `fitBoard` 縮小棋盤，所以 canvas 一定要能即時重新縮放（G7）。
5. 結算頁：`onWin` 先播天亮、0.9 秒後才顯示結算頁；顯示時棋盤要靜止（H3）。原型自己畫的「天亮了」字樣不要搬進來，結算字樣仍用 DOM。
6. 圖鑑、開場、關卡選單：這些畫面開著時 canvas 不用渲染（H19）。圖鑑裡的圖示用 `<img>`，與棋盤共用 `ICON_IMG` 表。
7. 存檔：`waveclear` 時 `Engine.snapshot`；續玩時 `Engine.restore` 後要從 `G.units` 重建全部單位（A18）。canvas 不存任何遊戲狀態。
8. 音效：`Sound.play` 目前寫在 `flushEvents` 與 `draw` 裡（射擊、咬、死亡、波次、糧），搬棋盤時要保留這些呼叫（H18）。
9. 提示列與看門的說明：點走道上的看門的會呼叫 `toast`（F10）。
10. 開發者列：`draw()` 被它直接呼叫（加糧、下一波、清場），boardView 要提供「立即同步」的入口（G10）。

## 總估

| 組 | 條數 | 小時 |
|---|---|---|
| A 格子與單位 | 18 | 24.0 |
| B 敵人與移動單位 | 22 | 20.5 |
| C 投射物 | 7 | 4.0 |
| D 一次性效果 | 24 | 14.8 |
| E 儀式型效果 | 12 | 12.0 |
| F 環境 | 13 | 16.2 |
| G 互動 | 12 | 13.0 |
| H 系統行為 | 19 | 24.8 |
| 合計 | 127 | 129.3 |

跨組的額外工作，沒有算在上面：

- 實機迴歸：iOS Safari、Android Chrome 各至少一台，跑 18 關 × 3 難度的代表場次，逐項對照舊版畫面，約 12 小時。
- 緩衝：視覺對照、Pixi 的細節問題、以及效能調整通常會超支，建議再加 25%，約 35 小時。

結論：核心約 130 小時，加上實機迴歸約 140 小時，含緩衝約 175 小時（一個人約 4 到 5 週）。

### 高風險條目

- F1 無月夜暗化：離屏貼圖每幀重繪＋erase 混合，低階手機吃力，也是 context lost 後最先壞的東西。
- H14 context lost／restore：DOM 版沒有這個問題，iOS 切 app 回來必須實測。
- H16 Pixi 取得與相容：v8 沒有 canvas 後援，WebGL 不可用就整個黑畫面；保留 DOM 後援等於維護兩套。
- H17 效能與耗電：原型沒有任何低階手機數據，正式版目前很省電。

中風險（不到高，但容易超支）：B1（約 20 種 cls 外觀）、B7（tint 做不到亮度 1.25）、D24（Pixi.Text 池化與 emoji）、E4（hornShove 疊加位移）、F4 與 F11（引擎規則重複實作）、G5（觸控 enter／leave 語意）、G7（resize 後所有物件重新縮放）、H15（圖載失敗不能整批失敗）、H18（單檔拆分）、H19（物件回收）。

### 原型完全沒碰到的功能

- 冷卻條（A10）、可升級／修補角標（A11）
- 鏟子模式（A13、G3）、換卡提示與換卡（A15、G4）、可放置虛線框（A14）、範圍預覽（A16、G5）、教學高亮與教學限制（A17、G9）
- 巡夜人揮棒（B13）、s-dash（B7）、頭上狀態圖示（B15）
- 狐狸閃避殘影（D19）、接回牌子（D21）
- 吹角敵人滑移（E4）、守過跳一下（E8）、火盆／油燈點亮（E11）
- 右側黑霧（F2）、看門的用掉轉場（F9）、點看門的說明（F10）
- 暫停（H1）、reduced-motion 全部（H4 到 H11）、大字（H12）、visibilitychange（H13）、context lost（H14）、圖載失敗退回（H15）、Pixi 載入失敗（H16）、overlay 與清場（H19）
- 開發者放敵人（G10）、觸控行為（G11）、音效整合與例外處理（H18）

### 原型與正式版不一致的地方（搬時要改）

1. 圖片載入一次全載，任何一張失敗整批失敗，畫面空白（H15）。
2. Sprite 大小只在建立時設定，棋盤縮放後不會跟著變（G7、C7）。
3. 迷羊腳印與敵人腳印在同一位置，會疊在一起；正式版錯開一格（F12）。
4. 腳印可見性原型自己算，正式版靠引擎事件（F11）。
5. 棋盤比例原型用 7.4:5 的近似，正式版是 7:5 加 28px 走道（G8）。
6. 原型自己畫「天亮了」「羊圈失守」字樣；正式版是 DOM 結算頁（E12）。
7. 閃電機率原型 50%，正式版 35%；原型也沒擋加速與 reduced-motion（E10）。
8. 原型的 flee 沒有 💨 字、horn 沒有 📯、strike 沒有 ✦（D6、D9、D15）。
9. 原型新增了正式版沒有的東西：暗角、雨絲、石子拖尾、拋物線影子、受擊火花。要保留哪些是設計決定，不算搬遷工作量。
10. 原型把看門的放在會震動的外框層，頭目登場時看門的跟著震；正式版不會（E5）。

## 逐條勾選（2026-10-23，對 feat/canvas-board 最新版）

子代理逐條對照 render.js／index.html／`git show main:index.html`，我再核對黃燈條目。行號指 render.js（R）與現版 index.html（I）。

**統計：✅ 120／🟡 2／❌ 0／⛔ 3／❓ 1／主責在 James 1**

| 判定 | 條目 |
|---|---|
| ✅ 已搬 | A1–A18、B2–B22、C1–C7、D1–D8、D10–D23、E1–E12、F1–F13、G1–G10、G11、H1–H2、H4–H13、H15–H16、H18–H19，加上 B1（見下） |
| ✅ B1 補充 | 清單原寫「k 要用 CSS 疊乘規則」是我寫錯：舊版 `--k` 是 CSS 自訂屬性，同權重規則後者覆蓋、不會相乘。data.js 現有的雙 cls 敵人只有 big lion／big leopard／big boar 三種，舊版 CSS 順序與 render.js 的 KSIZE 取值結果一致（1.4／1.35／1.25）。若日後新增「fast big」這類組合，render.js 依 cls 字串順序取最後一個，CSS 依樣式表順序，可能不同，加敵人時記得對一下 |
| 🟡 D9 | 吹角一般模式改成橫向衝擊波＋吹者壓扁回彈，沒有舊版的 📯 飄字（減少動態時才飄字）。這是原型階段 James 看過的設計取捨，要不要補 📯 由 James 定 |
| 🟡 D24 | 飄字每次 `new PIXI.Text`、沒有文字池。目前 Chrome 37 敵 61 fps 沒看出問題，等實機有卡頓證據再做 |
| ✅ G11 | 本次補：canvas 加 `contextmenu` 防呆，手機長按看範圍不再跳系統選單（R bindPointer） |
| ⛔ 刻意不做 | G12（糧數維持 DOM，清單原本就這樣寫）、H3（結算頁底下停止渲染，四步檢驗不採納）、H17（畫質降級開關，無實機證據） |
| ❓ 待實機 | H14 WebGL context restored：程式碼有（R:56），只有 James 切背景再回來才驗得到 |

另外兩處清單沒列、但要知道的差異：
- 油燈亮排判定走 `Engine.rowLit`，亮帶卻用 `def.light`，燈血量為 0 那一幀兩者可能差一格（四步檢驗 (c)8 已列不採納）。
- 無月夜黑暗在 render.js 自己算開始時間，沒用引擎的判定，註解說兩者是同一時間點；要改無月夜規則時兩邊一起改。
