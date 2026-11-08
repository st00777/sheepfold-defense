# 審查四部奏：11/8 周邊 UI 小點綴（feat/ui-polish-2026-11-08）

範圍：c22ac67（相對 main 7ef9a1f），只動 index.html 與一個新測試。四路並行：內建 `/code-review`（high）、mattpocock `code-review`（Standards／Spec）、動畫 review（sonnet 子代理）、小居 Codex `codex review --base main`。每條都對過原始碼再處置。

## 結果表

| 條目 | 誰抓到 | 處置 |
|---|---|---|
| 尾聲 click 的 `sl.end` 分支排在 0.6 秒守門前，倒數第二頁連點兩下第二下把名單直接跳掉 | 內建 🔴、動畫 🔴 | **採納**：守門移到最前，再判 end |
| `.ep-after` 捲動期間 opacity 0 但按得到、Tab 得到，點畫面跳過會誤按「回首頁」直接關掉 | 內建、動畫、Spec、小居 P2（四路） | **採納**：改 `visibility: hidden`，JS 等 `animationend`（減少動態直接）或 skip 才加 `.on`；7 秒保險絲 |
| 複製先成功再失敗：`clearTimeout` 清了回復計時、失敗分支沒重設，卡在綠底「已複製」 | 內建、動畫、小居 P3 | **採納**：成功失敗都先清狀態、都 1.6 秒後回「複製」；失敗換字「沒複製到」（減少動態沒抖動也看得出，Spec 的缺口一起補） |
| `.ep-roll` 寫死 15.4em，名單加長或折行會被裁 | 內建、動畫 🟡 | **採納**：高度跟內容走（padding-bottom 1em），起點 `translateY(100%)` |
| 捲動跟 `.ep-body` 1 秒淡入同時起跑，前段看不到 | 內建、動畫 🟡 | **採納**：延遲 0.8 秒、時長 5.5 秒 |
| `.skip` 用 duration 0 在 Safari 不保險 | 動畫 🟡 | **採納**：改 `animation: none`（終點就是基礎樣式） |
| 最後一頁 `ep-hint` 空的，玩家不知道能點 | Spec | **採納**：「點一下直接看完」，現身後收掉 |
| 鍵盤 Enter／空白在最後一頁直接關 | 內建 | **採納**：名單還在捲先跳過，按鈕出來了才關 |
| 試煉勾 `aria-hidden`，讀屏唸不出「過了」 | 小居 P2 | **採納**：`CHECK_SVG(draw, label)`，試煉冊帶 `role="img" aria-label="過了"` |
| 複製回饋沒有 aria-live | 內建 | **採納**：`#set-copy-note` 加 `aria-live="polite"` |
| 高對比下關著的燭芯深褐配深底看不見 | 動畫 🟢 | **採納**：`html.contrast …cdl:not(.on)::after` 淺一點（`:not(.on)` 才不蓋火苗） |
| 大字模式火苗頂端貼到按鈕上緣 | 動畫 🟢（待驗） | **採納**：燭身與燭芯各下移 2px |
| `freshTrial` 沒經過試煉選夜會留到很久以後才畫 | 內建、Spec | **採納**：回首頁（buildLevels）也清掉 |
| `CHECK_SVG(' draw')` 要自己記得空格 | Standards | **採納**：改布林參數 |
| `@keyframes shake` 名字太泛 | Standards | **採納**：改 `copy-shake` |
| 減少動態下 `::after` 260ms transition 沒關 | Standards、動畫 | **採納**：加 `transition: none` |
| 火苗 background 純色→漸層不能插值、border-radius 瞬跳 | 動畫 🟢 | 不採納：影響很小，多疊一層不值得 |
| 試煉勾 120ms 延遲可能被選夜淡入吃掉 | 動畫 🟢 | 待真機看，沒問題就不動 |
| `pathLength="1"` | 動畫 🟢 | 不採納：現況終態完整 |
| 省效能（lite）時停火苗 | 動畫 🟢 | 不採納：html 沒有 lite class，且設定頁關著時 display none 不跑 |
| 複製成功加綠底是規格外 | Spec | 保留：按鈕本身要能一眼看出成功，這是目的 |

採納 16、不採納 4、待驗 1。

## 修正後驗證
- `node --test sim/*.test.js` 197 全綠（新測試擴到 5 條：守門順序、ep-after 藏著、animationend 現身、減少動態路徑、複製狀態清理、高對比選擇器）。
- 本機 Chrome：最後一頁 0.6 秒時 `.ep-after` visibility hidden、提示「點一下直接看完」；捲完 `.on`、提示收掉；倒數第二頁 0.5 秒後連點兩下：到了最後一頁但沒有 `.skip`、按鈕沒現身；再點一下 `.skip`＋`.on`；複製失敗（clipboard 與 execCommand 都擋掉）按鈕「沒複製到」＋shake、1.5 秒後回「複製」；高對比燭芯看得見。Board.errCount 0、console 無錯誤、靜態區標籤平衡。

## 待真機（James iPhone）
1. 尾聲名單：0.8 秒後起跑、5.5 秒捲到底，看節奏會不會太慢；點一下跳過。
2. 大字模式設定頁：火苗有沒有頂到按鈕上緣。
3. 試煉冊剛過一題回選夜：金勾有沒有畫出來（還是被淡入吃掉）。
