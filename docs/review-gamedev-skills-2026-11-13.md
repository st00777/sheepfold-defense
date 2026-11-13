# 對照 gamedev-skills 塔防／手感／存檔文件（2026-11-11 報告、11-13 施工）

來源：awesome-gamedev-agent-skills（Apache-2.0，commit 0449791）的七份說明文件：tower-defense（＋balancing）、game-feel（＋feedback-recipes）、save-systems（＋versioning-and-migration）、itch-publish。只讀文件、沒裝 skill。James 要求：拿通用塔防經驗對照羊圈，數字不照搬、引擎專屬段落略過、注意程式 id 與畫面夜數的對應（id 14＝第 20 夜）。

## A. 羊圈已經做到的

- 波次、單位、敵人全是資料表（data.js）。
- 每種敵人剋一種懶打法：快狼剋慢射手、厚皮熊獅剋投石手、飛的剋牆、蝗群剋單發、狐狸閃避、賊翻牆、野狗鑽地、頭目血量跳級。
- 第一波永遠用舊工具守得住，新敵人一次一種、第一次單獨來（level-design 四條原則）；11/10 數據第 1 夜 8 局守 7。
- 射手自動打最靠近羊圈那隻（投射物沿排飛）＝文件的「first」模式；投石機拋最遠、拋石手拋最前。
- 二倍速；波間休息 6 秒；準備 18 秒且放下第一個單位才開始算。
- 波內血量每波約 1.15–1.5 倍再加隻數、難度 1.25 倍，與文件 1.12–1.18 同量級。
- 升級路線（老牧人＋八張卡的再點一下）讓「少而強」與「多而便宜」都能玩。
- 模擬器就是文件的曲線檢查而且更強：真的打 100 局、三難度、五套打法、印最近幾格。
- 擊中亮一下＋火花、倒下煙圈、糧數字跳、濺射震地；減少動態／省效能／2× 時收掉；時間走遊戲時鐘。
- 存檔幾乎全中：整數版本欄、每步一個遷移函式且舊步驟保留、新版存檔拒讀並說明、validate 查範圍與 id、備份接回、壞檔留原文並在首頁說、每波自動存檢查點、存檔碼帶校驗、匯入前另留一份、測試有各版夾具。

## B. 值得考慮的（依優先度）與處置

| # | 文件建議 | 羊圈現況（11/11） | 處置 |
|---|---|---|---|
| 1 | 提前一波秀下一波組成 | 只有文字提示、腳印提前 3 秒標排、新敵人一次性提示、頭目橫幅；新人第 3 夜輸在第 1 波 | **11/13 做了**：`#next-wave` 貼在棋盤上方，準備與休息時列種類圖示＋隻數（已乘難度），開打收起；無月夜照列（藏的是排不是種類） |
| 2 | 出貨附減少震動／閃光開關 | 只跟系統 prefers-reduced-motion；iOS 玩家佔三分之二 | **11/13 做了**：設定頁第八根蠟燭「減少動態」，存檔 v7 `prefs.motion`（null 跟系統／true／false）；CSS 改走 `html.reduce`、index.html 走 `reduceMotion()`、render.js 走 `Board.setReduce`，三邊一個來源 |
| 3 | 回饋分小中大級，頭目倒下算大級 | 獅子豹野牛倒下跟狼一樣 0.22 秒淡出 | **11/13 做了**：`boss: true` 的 die 走大級——render 金圈＋碎石、淡出 0.45 秒；index.html `bossDown` 外框抖（與登場共用 `frameShake`）＋金邊＋新音 `bossdown`；減少動態只留聲音。不做 hit-stop |
| 4 | 後期牆要血量與收入曲線一起調 | 第三章起風／暴風模擬 12–56%，已用 diffScale 0.45 砍波；真人只一位到第三章且 29、30 夜暴風三星 | **不動**。若真人反映太難，補收入側（山坡夜開局糧／牧人節奏），不再砍 diffScale |
| 5 | 每波壓力值 0.6–0.95，找牆與太鬆的連段 | 只印整局勝率與整局最近幾格 | **11/13 做了**：模擬每局多回 `waveMin`，run／compare 印「每波 a/b/c」（只算打到那一波的局） |
| 6 | 每張卡要有逼出它的敵人 | 油燈、巡夜人、抱羊羔 0 次，但第二章玩家只 2 人 | **不動**，等第二章玩家 ≥5 人再看；若仍 0 補「逼出它的波」而不是加數字 |

## C. 不適用

迷宮／A*／flow field、轉角掉距離（直線五排）；每塔目標模式（投射物沿排飛）；擊殺賞金／過波獎金／利息（糧來自牧人，PvZ 原型；迷羊 +25 是唯一例外）；提早叫波換獎金（糧是時間產的，等於自罰，已有 2×）；命數制（漏一隻就輸＋看門的，10/18 拍板）；鏟子退糧區間（50% 在區間內）；傷害數字跳（手機格子小）；波內衝喘交替（每夜 3–5 波，喘息在夜與夜之間）；temp＋rename／fsync／Steam Cloud（localStorage 單 key 原子）；Godot／Unity 程式碼。

## itch.io 若要上架

頁面先建、種類 HTML、勾「在瀏覽器裡玩」、設嵌入尺寸與手機可玩；上傳整個資料夾排除 docs／sim／scripts／proto（index.html 在根目錄、路徑全相對、約 204 檔 17 MB）；人物圖是 ChatGPT 生的，AI 揭露一定要勾。最要注意：itch 把遊戲放在另一個網域的 iframe 裡，iPhone Safari 可能擋掉或分區 localStorage，上架前真機試，存檔碼匯出入是備案；GA 加 hostname 區分來源。

## 11/13 施工紀錄

- 改動：index.html（CSS 五段減少動態改 `html.reduce`、`#next-wave`、`drawNextWave`、`applyMotion`、`frameShake`／`bossDown`、更新紀錄 2026.11.13）、render.js v32（`setReduce`、dieFx 頭目級）、save.js v8（VERSION 7、STEPS[6]、validate motion）、sound.js v11（`bossdown`）、sim/simulate.js（`waveMin`／`waveAvg`）。
- 測試：新 `sim/gamedev-skills-2026-11-13.test.js` 六條（含 v6→v7 真跑遷移與 validate 六種輸入）；舊測試改了釘住的字串（SF6→SF7、蠟燭 7→8、媒體查詢→html.reduce、REDUCE_MOTION.matches→reduceMotion()）。203 全綠。
- 本機 Chrome（第 3 夜暴風、?all&dev）：準備頁「下一波 狼 5」、開打收起、清場後「下一波 領頭狼 1 狼 6 快狼 2」；獅子血調 1 被射死 `bossDown` 觸發兩次、errCount 0、console 無錯誤；暫停面板點蠟燭 → `html.reduce`、存檔 motion true、火苗停；再點回關。靜態區標籤平衡。
- 已知取捨：窄或矮的視窗（`#scene.plain`，棋盤填滿場景沒有天空）預告會壓到第 0 排上緣一小條，`pointer-events: none` 不擋放單位，plain 時縮小貼上緣；手機直式有天空不會壓到。
