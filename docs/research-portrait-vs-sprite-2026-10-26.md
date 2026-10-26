# 研究：遊戲內小圖 vs 圖鑑大立繪

日期：2026-10-26
問題：棋盤格子裡角色只有約 30-40px 看不清；圖鑑也只是小圖。(1) 其他塔防／手遊怎麼分工遊戲內小圖與圖鑑大立繪？(2)「圖鑑完整立繪＋遊戲內 Q 版」常見嗎？成本？(3) 圖鑑點擊放大的 UI 慣例？

**先講誠實的話**：這次搜尋額度只有 12 次，且多個 wiki（PvZ、Fire Emblem Heroes）抓取被擋（HTTP 402），搜尋結果也沒給出各遊戲「兩套圖是否分開畫」的一手說明。所以下面凡標「未找到一手來源」的，都是依常識的二手推論，請當參考，不要當定論。

---

## 問題 1：遊戲內小圖與圖鑑大圖怎麼分工？

**結論：多數有大立繪的手遊，確實是「兩套資產」；但我這次沒找到官方說明，只有社群 wiki 的間接佐證。**

- 明日方舟（Arknights）社群 wiki 的幹員頁把「Sprites（遊戲內小人）」和概念圖、宣傳立繪分成不同區塊。佐證兩者是分開的資產。來源：[Arknights Terra Wiki 幹員圖庫範例（Yato）](https://arknights.wiki.gg/wiki/Yato/Gallery)
- 同一 wiki 的趣聞頁提到，某幹員的機械手在「遊戲內 Q 版」比在立繪更明顯。表示小人是重新設計、會強調辨識特徵，而不是把立繪縮小。來源：[Raidian 趣聞](https://arknights.wiki.gg/wiki/Raidian/Trivia)
- 立繪由外包插畫家與內部美術畫，wiki 另列遊戲內美術師。來源：[Illustrators](https://arknights.wiki.gg/wiki/Illustrators)
- Fire Emblem 系列：同人改作社群的資源庫把「肖像」和「戰鬥動畫／小人」當不同資源管理。來源：[FEUniverse 資源庫](https://feuniverse.us/t/fire-emblem-resource-repository-battle-animations-portraits-music-etc/3326/4495)。注意這是同人改作，不是 Fire Emblem Heroes 官方。
- Kingdom Rush、Clash Royale、Bloons TD 6、Brawl Stars、PvZ：**未找到一手來源**，以下是二手推論：它們遊戲內都是單一卡通風格的小圖，圖鑑／卡片頁多半是同風格的放大版或另畫的較精緻版，我無法確認是同一張縮放還是分開畫。（PvZ 圖鑑僅查到有屬性、功能、短介紹，沒查到圖片規格：[StrategyWiki](https://strategywiki.org/wiki/Plants_vs._Zombies/Suburban_Almanac)）

---

## 問題 2：「圖鑑完整立繪＋遊戲內 Q 版」常見嗎？優缺點與成本

**結論：在有「角色收集」賣點的手遊很常見；對獨立開發者是「畫兩次」的成本，一套圖兩用可行，但小圖要特別處理。**

證據（皆為二手，未找到獨立開發者談「同一張立繪縮小當 sprite」的第一手經驗）：

- 縮小時眼睛等細節會被縮到看不見，美術會刻意把頭、眼睛畫大；Q 版（大頭）在 32x32、64x64 這種小尺寸比較好辨識。來源：[itch.io 討論串：把圖轉像素圖](https://itch.io/t/1644999/focus-on-turning-art-into-pixel-art)
- 先顧輪廓：縮到最終格子大小時，玩家仍要認得出身形與朝向。固定格子大小與色盤後再縮，否則像模糊縮圖。來源：[Sorceress 圖轉 sprite 流程](https://sorceress.games/blog/convert-image-to-pixel-art-game-sprite-pipeline)
- 「加粗輪廓」這條原則：**未找到一手來源**，屬常識推論（縮小後細線會消失，粗線較耐縮）。

優缺點（推論）：

- 兩套分開：優點是兩邊都最好看；缺點是資產量約 x2，風格容易不一致。
- 一套兩用：最省，但縮小後易糊、細節丟失。

---

## 問題 3：圖鑑點擊放大，全頁還是彈窗？

**結論：兩者都常見。簡單「看大圖＋幾行字」用彈窗／底部面板；內容多或要沉浸時用全螢幕詳情頁。羊圈守夜這種單一角色一張圖加數值，彈窗足夠。**

- Apple HIG：Modality 頁的摘要說，模態會打斷流程，應留給專注的單一任務；內容要簡單，並提供明確、容易的關閉方式；有些內容適合全螢幕。來源：[Apple HIG Modality](https://developer.apple.com/design/human-interface-guidelines/modality)（抓取只拿到摘要，非全文）
- Apple HIG Sheets：sheet 會擋住底下畫面直到關閉；影片、照片這類內容或多步驟任務，建議考慮全螢幕模態。來源：[Apple HIG Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets.md)
- Material Design（舊版 M1 說法，經二手轉述）：全螢幕對話框僅限手機，適合複雜、多步驟任務；對話框本來就是刻意打斷，應少用。來源：[Material 對話框（M2）](https://m2.material.io/components/dialogs)、[M1 對話框](https://m1.material.io:443/components/dialogs.html)。M3 原文頁未抓到。
- 手遊圖鑑實作：我只確認 PvZ 圖鑑有屬性＋介紹的詳情形式（見上）。第二款手遊的圖鑑描述：**未找到一手來源**。

---

## 對羊圈守夜的建議（由便宜到貴）

**A. 現有 256px webp 直接在圖鑑做「點擊放大彈窗」（最便宜，建議先做）**
成本：只改前端，不用新圖。256px 在手機放大到約 200-300px 顯示仍清楚。彈窗放圖、名字、數值、經文；點背景或叉叉關閉。

**B. 圖鑑卡片本身放大**
成本：低。圖鑑列表從小圖改兩欄大卡，不用彈窗也能看清楚。可和 A 一起做。

**C. 遊戲內加強辨識度，不改美術**
成本：低到中。選取單位時顯示放大浮動提示（頭像加名字）；棋盤角色加深色描邊或底圈，用程式處理。

**D. 遊戲內改 Q 版頭像／大頭比例**
成本：中到高。45 張要重生，風格要與現有圖一致。

**E. 另生一套高解析全身立繪給圖鑑**
成本：最高（約 45 張再做一輪，加上生圖與去背流程）。只有在確定要走「收集立繪」路線時才值得。

**建議順序**：A + B 先做，看手機實測夠不夠；不夠再做 C；D、E 視擁有者想要的遊戲風格再決定。
