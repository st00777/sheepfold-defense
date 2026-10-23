# 棋盤改 canvas · 四步檢驗（2026-10-23）

> 範圍：分支 `feat/canvas-board`（render.js 新檔、index.html 拆掉 DOM 棋盤、lib/pixi.min.js 鎖版本）對 main。起因：James 真機回報「玩到中途會自己退回關卡選單」。
> 四步＝James 2026-10-18 指定的固定關卡（見 chapter-expansion-design §12）：內建 `/code-review`（high）、mattpocock `code-review`（Standards／Spec 兩軸）、動畫 review、小居（Codex）唯讀。這次四路並行，結論逐條對照檔案確認後才修。

## 0. 先修 James 回報的「閃退」（e8b53f6）

不是當機：index.html 的 `tick` 有保護網，畫面層一丟例外就停局回關卡。用 Chrome 自動玩全 20 夜（加速 harness、沿用原型的自動打法）找到兩個必現錯：

| 症狀 | 原因 | 修法 |
|---|---|---|
| 放牧羊犬那一幀就停局 | 狗／巡夜人／迷羊的 `bright` 欄位同時當「亮光精靈」和「剩餘秒數」，第一幀算成 NaN 再對 NaN 設屬性 | 計時改存 `brightT` |
| 荊棘撒蠍子後整頁凍住 | `drawUnits` 迭代 `UN` Map 途中 `renderUnit` 刪掉再放回同一把鑰匙，Map 會再訪問一次、條件又成立 → 無限迴圈 | 迭代中只記下要重建的格子，迴圈結束再重建；`renderUnit` 初始化三個 Was 欄位 |

同時：畫面層例外改在 render.js 內接住（每局 toast 一次、存 `sheepfold-lasterr`、遊戲照走；引擎例外仍回關卡且 toast 帶錯誤訊息）；ResizeObserver 回呼延一幀。

驗證：20 夜寧靜＋6 夜暴風＋2 夜起風自動玩零例外零凍結；`node --test` 81/81。

## 1. 四步結果與處置

| 步驟 | 結果 | 處置 |
|---|---|---|
| 內建 `/code-review`（high） | 10 條 | **採納 9**：放下壓扁樞紐沒補償（單位往上跳 0.4 格）、續玩／重來／下一夜沒擋棋盤未就緒、`init` 只包了 `app.init`（載圖或做貼圖失敗會留半套圖層）、暫停中重排沒畫一幀、無月夜亮排重排後不重畫、教學金框每幀把整張格子連石頭重畫、黑暗漸變不吃 dt 且暫停不停、鑽地敵人的圈畫到下半身矩形上（Pixi 的 stroke 只套最後一個形狀）、`dust` 計時在 clear 後減成負數、`hasText`／ripple 的 `t` 死碼。**不採納 0**。 |
| mattpocock `code-review` Standards 軸 | 無硬違規；判斷題 9 項 | 採納：`hasText` 死碼、`renderUnit` 區域變數 `marker` 遮蔽模組層 `marker`（改 `isMark`）、`k.split(',')` 五處抽成 `unkey`。**不採納**：把 UCOL／BODY_COL／KSIZE 外觀表與 `cls` 解析搬回 data.js（James 拍板 data.js 這條分支零改動；外觀表留畫面層，檔頭已註明換美術要兩邊改）、單行多句壓縮風格（沿用全專案慣例）、`Board.placed`／`ready` 命名。 |
| mattpocock `code-review` Spec 軸 | 缺 10、超出 4、疑似不對 10（事件 payload 逐項核對一致） | 採納：吹角手本人回彈（E4，改用壓扁回彈）、豹蹲伏飄 👁（D14）、土堆閃爍（D16）、WebGL context restored 重建貼圖與離屏黑暗（H14，**待實機**）、放下樞紐 bug、黑暗漸變 dt、土堆重排後位置。**不採納**：H3 結算頁底下停止渲染（結算頁停留短，收益小）、H17 畫質降級開關（還沒有實機證據需要）、A4 抱羊牧人專屬外觀（UCOL 有 cradle 色、呼吸名單也有，審查者看漏）、B7 衝刺亮度算法、(c)8 亮帶改全走 `rowLit`（燈血量為 0 的那一幀差異看不出）。超出規格 4 項（暗角、受擊火花／拖尾／拖火、`report()` 接例外、入夜 alpha .3）皆為原型階段 James 看過的畫面或這次的保護措施，保留。 |
| 動畫 review（子代理對照 research-art-effects-plan 與舊 DOM 版） | 🔴2 🟡11 🟢7 | **採納 17**：放下樞紐；天亮那一刻亮帶／亮排／黑霧跟黑暗一起淡（原本先全黑再亮）；暖亮草地改畫在格子層（不再把亮排的敵人染黃，alpha .35→.7）；雨絲壽命 .5→.85 秒（原本只下到棋盤七成）且只在最後四分之一淡；咬住撲頻率減半回 .45 秒＋縮放 1.06；腳印閃爍、教學金框、呼吸三個週期回舊版（`abs(sin)` 把週期砍半了）；減少動態下 blast／splash／slam／ignite／trample／emerge 改飄字、ring／ripple 不擴張只淡出、咬住改身體泛紅、閃避只變淡；敵人血條寬 .6→.8 格且移到身體下緣外；升級角標 7px→12px；吹角手壓扁；粒子直徑 1.6px→4px；升級／修補提示靠格子左緣對齊（第 0 欄不再被切）；油燈光暈暫停／加速時不再突然縮放；土堆閃；閃避只動本體不動血條；蹲伏下沉 .08→.12；黑霧 .6 秒淡。**不採納 3**：無月夜整體亮度 .32→.22（James 看過原型拍板的觀感，先不動，真機再說）、天色淡入改 ease-out（優先度低）、呼吸 x／y 一起縮（舊版只縮 y 的感覺 James 沒抱怨）。 |
| 小居（Codex `review --base main`，唯讀，約 4 分鐘） | 3 條 | 全部與內建 code-review 重疊（續玩入口沒擋、放下樞紐、亮排重排），已採納。跑完 `git status` 無變化。 |

備註：`codex review --base <分支>` 不能同時帶 prompt（互斥），要指定審查重點得改用 `codex exec`。

## 2. 修完的驗證

- Chrome 自動玩第 5（荊棘升級）、15（狗）、12、1、8 夜零例外；第 9 夜「拉結的燈」截圖：兩盞燈五排全亮、暖草色只染格子、狼的血條在身體下方。
- 重排：`#board-wrap` padding 改 80px 再改回，canvas 1140×814 → 778×556 → 1140×814，單位都在、零警告。
- `node --test sim/*.test.js` 81/81。

## 3. 還沒驗過、要 James 真機看的

1. 切去別的 App 再回來（H14 context restored 路徑只有程式碼，沒有實機證據）。
2. 無月夜整體亮度（動畫審查建議再亮一點，James 看過原型說好，由他定）。
3. 減少動態（iOS「減少動態效果」開啟）下整夜能不能看懂發生了什麼。
