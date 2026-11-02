---
name: sheepfold-data
description: 羊圈守夜的玩家數據。用於「更新遊戲數據」「最近幾個人在玩」「哪一夜卡關」「哪張卡沒人用」——跑 scripts/ga4-sheepfold.js、把摘要寫進 docs/data-insights.md（不進 git）、回報第一句「幾個人在玩」。只看 GA4 匿名事件，沒有帳號、沒有人名；跟靈修冒險的 data-analyst（Firestore 人名、週出席、默想）是兩套，不要混用。
---

# 羊圈守夜 · 玩家數據

James 2026-11-02 定的：**想看才跑，不排程**；紀錄檔 **不進 git**；摘要第一句永遠是 **「幾個人在玩」**，其他當補充。

## 跟靈修冒險怎麼分
| | 靈修冒險 `data-analyst` | 羊圈守夜 `sheepfold-data`（本 skill） |
|---|---|---|
| 資料來源 | Firestore 帳號＋GA4 | 只有 GA4 匿名事件 |
| 核心句 | 本週幾人完成靈修（認人名） | 本期幾人在玩（只有人數，沒有人名） |
| 守門 | 默想字數、四週沒出現的人 | 卡關夜、少用卡、測試局排除 |
| 腳本 | Bible-game `npm run weekly/analyze/funnel/ga4` | `node scripts/ga4-sheepfold.js [天數]` |
| 紀錄 | Bible-game/data-insights.md | sheepfold-defense/docs/data-insights.md |

共用的只有 GA4 資源（property 534159832，兩款遊戲同一個）和 service account 金鑰 `../Bible-game/ga4-key.json`（金鑰不複製進這個公開 repo；路徑可用環境變數 `GA4_KEY` 蓋掉）。

## 口徑（判讀前先記住）
- **只算正式站**：hostName `st00777.github.io` 且 pagePath 以 `/sheepfold-defense` 開頭。githack 測試站、本機 127.0.0.1 都是 James 與 CC 在測，腳本已排除，第 ⑦ 區會印排除了幾局。
- 兩款遊戲靠 pagePath 分開，不靠事件名。
- 人數是 GA `totalUsers`：同一支手機換瀏覽器算兩個人、關掉統計的玩家看不到、廣告阻擋會擋。當趨勢看，不當精確值。
- **自訂維度 2026-11-02 才登記**（夜數／結果／星數／難度／模式／卡片／版本／關卡 id／試煉題／續玩／成就／圖鑑入口／新老玩家，指標：秒數／失羊／波數／放卡次數）。之前的局只有事件計數，②③⑤ 區那時會是空的，正常。
- GA 事件資料保留期目前 2 個月（James 未改成 14 個月）；探索式查詢看不到兩個月前的明細，週別表受影響時要註明。
- 六個事件：`night_start`、`night_end`、`card_used`、`open_trials`、`open_codex`、`achievement`。改名或改參數＝口徑變更，記進 data-insights.md 的「口徑變更」段並標從哪天起不可比。

## 固定流程：「更新遊戲數據」
1. `node scripts/ga4-sheepfold.js 14`（預設 14 天；James 說「這個月」就給 30）。輸出一頁內，直接在主對話跑，不用 subagent。
2. 讀 `docs/data-insights.md` 最近一期（格式範本）。檔案不存在就照下面的範本建。
3. 在最近一期**之前**插入新一期「## 📌 M/D 摘要」，結構固定：
   - **幾個人在玩**（第一句）：開過 N 人、打完至少一夜 M 人、新面孔 K 人、跟上期比。
   - 走到哪／卡在哪：最遠夜、輸最多的夜（局數 ≥3 才算）。
   - 內容：試煉打過幾題、圖鑑、成就。
   - 卡片：前三與沒人放過的。
   - 技術：版本、裝置、開了沒打完的局。
   - watch：上期 watch 逐條結案或延續。
   舊段落不動。檔案在 .gitignore，不 commit。
4. 回主對話 ≤20 行：第一句「幾個人在玩」、3–5 條判讀、看不到的就說看不到。

## 判讀原則
- 低用率不是問題，沒抱怨就是健康（James 的基準）；少用卡只當升級選卡的線索，不當砍卡理由。
- 卡關夜要先問「是玩家變了還是量法變了」；改過難度、改過事件的那幾天分開寫。
- 輸最多的夜拿去跟模擬器對照：`node sim/simulate.js <夜> all 100 compare`。
- 不推測玩家動機當事實，只能寫「與 X 一致」「待 Y 確認」。

## data-insights.md 範本
```
# 羊圈守夜 玩家數據（本檔不進 git）
口徑見 .claude/skills/sheepfold-data/SKILL.md。自訂維度 2026-11-02 起才有。

## 口徑變更
- 2026-10-29 接上 GA4（期 0）。2026-11-02 登記自訂維度與指標。

## 📌 11/2 摘要：…
```
