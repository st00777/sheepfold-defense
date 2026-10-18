# 塔防的重玩層與流失點研究（2026-10-18）

目的：給「羊圈守夜」作者做決定的材料。本文只整理證據，不下「該怎麼做」的結論。
查詢日：2026-10-18。Steam 解鎖率取自 Steam 官方成就頁與 Steam Web API（GetGlobalAchievementPercentagesForApp），是查詢當天的數字，會隨時間微動。

## 先講限制

- 解鎖率的分母是「所有買了遊戲的人」，包含買了沒打開的人。兩個成就相除時，這個影響大致互相抵消，所以相除的比例比單看解鎖率可靠。但相除仍只是**粗估**。
- 相除假設「碰重玩層的人，多半先打完主線」。有些重玩模式不必打完主線就能玩（例如無盡模式、Thronefall 的永恆試煉），這種比例會偏高。
- Steam 玩家比一般網頁玩家更偏向愛玩策略遊戲的人。教會朋友會比這些數字更輕度。
- 查不到的東西直接寫「未查到」。Reddit 這次無法存取（站方擋爬蟲），所以 r/TowerDefense、r/gamedesign 的討論**未查到**。GameAnalytics、deltaDNA 沒有找到塔防專屬的流失數據。

---

## 題一：重玩層的實際效果

### 一、各款遊戲的數字

「比例」＝重玩層成就解鎖率 ÷ 打完主線解鎖率（粗估）。

**Plants vs. Zombies GOTY（Steam app 3590）**
- 打完主線：Complete Adventure 48.7%
- 重玩層：
  - 無盡生存撐到 20 波 13.7%（比例 28%）
  - 打花瓶無盡連 15 次 8.9%（比例 18%）
  - 「我，殭屍」無盡連 10 次 8.5%（比例 17%）
  - 20 個小遊戲全過 23.0%（比例 47%）
- 中途里程碑：未查到明確標示「主線一半」的成就。
- 來源：https://steamcommunity.com/stats/3590/achievements

**Plants vs. Zombies Replanted（Steam app 3654560，新版，加看）**
- 打完主線 48.1%
- 重玩層：再打一輪主線（Second Life）13.8%（比例 29%）；生存無盡 40 旗 6.4%（比例 13%）；「我，殭屍」九個獎盃全拿 33.1%（比例 69%）；花瓶九個獎盃全拿 32.0%（比例 67%）；全部 20 小遊戲 21.5%（比例 45%）
- 來源：https://steamcommunity.com/stats/3654560/achievements

**Kingdom Rush（Steam app 246420）**
- 打完主線：Great Defender 51.4%
- 重玩層：
  - 拿到 45 顆星 37.0%（比例 72%）
  - 全部 Heroic 挑戰關 11.4%（比例 22%）
  - 全部 Iron 挑戰關 11.5%（比例 22%）
  - 用最高難度 Veteran 打完 12.2%（比例 24%）
- 中途里程碑：拿到 15 顆星 73.1%；30 顆星 58.3%；英雄練到 5 級 79.1%
- 來源：https://steamcommunity.com/stats/246420/achievements

**Bloons TD 6（Steam app 960090）**——沒有「打完主線」，無法算比例，改用「贏過第一張初級圖 86.1%」當基準
- 贏一張進階圖 44.4%（約 52%）；贏一場每日挑戰 43.1%（約 50%）；贏 10 場每日挑戰 16.1%（約 19%）
- 完成一次 Odyssey 30.3%（約 35%）；CHIMPS 模式通一張 28.3%（約 33%）；打贏一階 Boss 31.7%（約 37%）
- 中途：贏一張中級圖 59.5%
- 來源：https://steamcommunity.com/stats/960090/achievements

**Orcs Must Die! 2（Steam app 201790）**
- 主線：Act 1 打完 57.4%；Act 2（最後）打完 29.4%
- 重玩層（以 Act 2 為底）：無盡模式撐到第 25 波 23.8%（比例 81%，偏高，因無盡可能不用先打完）；第 50 波 4.5%（15%）；Act 1 噩夢難度 8.1%（28%）；Act 2 噩夢 4.6%（16%）
- 來源：https://steamcommunity.com/stats/201790/achievements

**Defense Grid: The Awakening（Steam app 18500）**
- 打完主線：Complete the Story mode 24.7%
- 重玩層：Grinder 挑戰模式撐 100 波 14.2%（比例 57%）；腎上腺素挑戰模式拿金牌 17.0%（69%）；故事模式全關銀牌以上 8.1%（33%）；故事模式全關金牌 6.1%（25%）
- 中途里程碑：打完前 3 關 74.2%；拿過一面銀牌 91.1%；拿過一面金牌 74.4%
- 另：「讀取過檢查點存檔」43.8%（重打的人很多）
- 來源：https://steamcommunity.com/stats/18500/achievements

**Thronefall（Steam app 2239150）**——沒有一個明確的「通關」成就，改看各地圖勝利率的遞減曲線
- 贏各地圖：Nordfels 89.6% → Durststein 65.8% → Frostsee 52.3% → Uferwind 41.7% → Sturmklamm 32.2% → Wildbach 25.2% → Moorweg 19.7% → Freifort 15.8% → Totend 10.3%
- 「該圖全任務完成」（重玩層）相對於該圖勝利：Nordfels 40.1%（45%）、Durststein 14.4%（22%）、Frostsee 8.2%（16%）、Uferwind 5.8%（14%）、Sturmklamm 4.0%（12%）
- 永恆試煉第 1 階 17.6%（高於最後一張圖 Totend 的 10.3%，代表不必打完主線就能玩；Totend 是否為最後一張**未確認**）
- 來源：https://steamcommunity.com/stats/2239150/achievements

**Fieldrunners 2（Steam app 215710）**
- 「完成所有原版地圖」14.1%（不一定等於劇情通關）
- 全圖 2 星以上 8.4%（60%）；全圖 3 星 5.3%（38%）；生存撐 150 波 7.2%（51%）；Heroic 撐 200 波 5.8%（41%）
- 中途里程碑：累積 30 顆星 26.7%
- 來源：https://steamcommunity.com/stats/215710/achievements

### 二、開發者怎麼說

- **Hidden Path（Defense Grid）**：創意總監 Michael Austin 說設計目標是「做一款人人都能通關、但仍有大量深度的遊戲」；用「核心能量球」讓同一張圖兼顧新手（只剩一顆球也能自豪）與高手（一顆都不讓外星人碰），不必選難度。文章同時說這款遊戲有 20 關、多種獎牌與解鎖的挑戰模式，「用很少的設計工作量換來大量重玩」。（經驗談）來源：https://www.pcgamer.com/defense-grid-the-beer-game-that-changed-a-genre/
- **Grizzly Games（Thronefall）**：2025 年 2 月的大更新升級了無盡模式，媒體稱之為「玩家高度要求的功能」，並加了反向攻城模式與小遊戲。這是媒體轉述玩家需求，不是開發者談重玩數據。（單一轉述）來源：https://steamdeckhq.com/news/thronefall-has-sold-over-one-million-copies/
- **Ironhide（Kingdom Rush）**：公開內容談的是平衡、公測、教學，沒有談 Heroic／Iron 的遊玩比例。**未查到**。
- **Ninja Kiwi（BTD6）**：沒找到談「玩家最常玩哪種模式」或每日挑戰留存的訪談或 GDC。**未查到**。（曾有一個網站引用「Ninja Kiwi 首席設計師」的話，查不到出處，不採用。）
- **PopCap（PvZ）**：George Fan 的 GDC 資料多談教學與測試，沒找到談生存／小遊戲重玩比例的段落。**未查到**。

### 三、歸納（給作者的材料）

1. **「同一批內容、換個通關標準」的重玩層，碰的人最多。** 星級／獎牌類在打完主線者中的比例：Kingdom Rush 拿滿 45 星約 72%、Fieldrunners 2 全圖 2 星約 60%、Defense Grid 全關銀牌以上約 33%。這類不用學新規則、星星會自動累積。粗估，且 Kingdom Rush 的星星本來就跟過關綁在一起。（證據：多款遊戲的 Steam 數字）
2. **「更難」的重玩層，大約只剩四分之一到五分之一的主線通關者碰。** Kingdom Rush 的 Veteran／Heroic／Iron 約 22–24%；Orcs Must Die! 2 的噩夢難度約 16–28%；Fieldrunners 2 的 3 星約 38%。而且第二層比第一層再少一截（OMD2 Act 1 噩夢 28% → Act 2 噩夢 16%）。（證據：數據）
3. **無盡模式的結果差異很大。** PvZ 生存撐到 20 波約 28%，花瓶／我殭屍無盡約 17–18%；Replanted 的 40 旗約 13%；OMD2 第 25 波高達 81%（但可能不必先通關）、第 50 波 15%。波數門檻越高，人數掉得越快。PvZ 裡「有規則的小遊戲／解謎」（20 個小遊戲約 47%，九個獎盃約 67–69%）比純無盡高很多。（證據：數據）
4. **每日挑戰：BTD6 一款可查，約一半贏過一關的人碰過一次，但持續玩的人少。** 贏 1 場 43.1%、贏 10 場 16.1%。BTD6 是線上服務型遊戲、挑戰由系統每天推到選單，條件和單機小作品不同；其他六款沒有每日挑戰，**無法比較**。（證據：單一遊戲數據）
5. **「每張圖的額外任務」會隨進度快速冷掉。** Thronefall 第一張圖的全任務是該圖勝利者的 45%，到第五張圖降到 12%。重玩層的內容量若跟著主線關卡數成長，後段的人會少很多。同理，Defense Grid 靠「獎牌」與「核心球剩幾顆」讓同一關可重打，而讀取檢查點重打的人有 43.8%。（證據：數據＋一則開發者經驗談）
6. **最深的門檻幾乎沒人碰。** OMD2 每關最高難度滿分骷髏 4.7%、Fieldrunners 2 全程「24 小時內通所有關」2.0%（Heroic 版 1.1%）、Defense Grid 全關金牌 6.1%、Thronefall 40 王冠 3.3%。都低於 7%。（證據：數據）

（沒有找到任何一份談「小型作品該先做哪一種」的開發者說法，這條要靠作者自己權衡，本文不下結論。）

---

## 題二：塔防玩家的流失點

### 一、歸納（含證據強度）

**1. 早期關卡就掉人（前 3 關內）——證據：數據**
- Kingdom Rush 公測：Ironhide 追蹤到達各關的人數，「我們在第 3 關損失了一半玩家」；公測一週、超過 10,000 名測試者；調整後難度曲線變平滑。來源：Ironhide 簡報 https://www.slideshare.net/slideshow/kingdom-rush-behind-the-scenes/11930274
- Steam 成就的「進度漏斗」同方向：Defense Grid 前 3 關完成 74.2% → 通關 24.7%；Thronefall 第 1 張圖 89.6% → 第 4 張圖 41.7%；OMD2 Act 1 57.4% → Act 2 29.4%；Kingdom Rush 殺第一隻怪 94.9% → 通關 51.4%。網址同題一。（Steam 數字含買了沒打的人，只看相鄰里程碑的相對降幅較可靠。這些數字只說明「哪裡掉」，沒說明「為什麼」。）

**2. 規則一次給太多、教學沒人看——證據：多位開發者經驗**
- George Fan（PvZ）GDC 演講整理：新工具大約每 5 關才出現一次、第一次進商店只能買一樣、提示只在事件發生時才出現且不要求點擊、少用文字、用動手取代閱讀。來源：https://notes.hamatti.org/sources/talks/how-i-got-my-mom-to-play-through-plants-vs.-zombies
- Ironhide（Kingdom Rush）：測試者大多跳過原本的教學，所以改短、改成圖像式，重點放第一張，新機制出現時用遊戲內提示。同上簡報。
- Hidden Path（Defense Grid）：砍掉部分塔與敵人種類，目的是「不要讓玩家困惑」。來源：https://www.gamedeveloper.com/game-platforms/feature-how-i-defense-grid-i-went-from-bleak-to-beautiful
- Kapalka（PopCap）：「爛教學會讓簡單的遊戲看起來難很多」。注意：此條出自 Emanuele Feronato 對 Kapalka 2006 演講的改寫，作者說明有加入自己的內容，所以屬轉述。來源：https://emanueleferonato.com/?p=1390

**3. 太難比太簡單更傷休閒玩家——證據：多位開發者經驗＋一項實驗**
- Kapalka 轉述：「從來沒有休閒遊戲因為太簡單而失敗，但有很多因為太難而失敗」；不要懲罰一開始亂點的新手，給他們時間實驗。同上 Feronato 文章（轉述）。
- 實驗：Schmierbach 等人（2014，Journal of Media Psychology，121 名大學生，玩一款網頁塔防）發現，被分配到較簡單模式的人「勝任感」較高，勝任感再透過「挑戰與能力平衡」提高享受。來源：https://pure.psu.edu/en/publications/no-one-likes-to-lose-the-effect-of-game-difficulty-on-competency-/ 。這是實驗室結果，只測享受度，沒測放棄。
- Hidden Path：核心球機制讓新手「只剩一顆球也能自豪」，不用選難度。經驗談。出處同題一。

**4. 玩家看不懂敵人為什麼打不死——證據：單一意見（但多串重複）**
- BTD6 的 Steam 討論串中，新手常以為塔壞了，回覆才指出是迷彩氣球／鉛氣球的特性；老手建議去沙盒或維基查每回合出什麼氣球。來源（多串，2019–2023，玩家意見）：https://steamcommunity.com/app/960090/discussions/0/596272651478029114 、https://steamcommunity.com/app/960090/discussions/0/5264192561400728391 。沒有流失數字。
- Hidden Path 的敵我外觀刻意分開（文章說明美術風格目的）。見上列 Game Developer 文章。

**5. 太簡單、沒決策，無聊而離開——證據：單一意見**
- itch.io 玩家評論（Battle of the Bastion: TD，Brackeys Game Jam 2023.1）：「撐到第 55 波，因為很無聊就退出了」「大約第 10 波之後一切太容易，錢多到花不完」。來源：https://itch.io/post/7354134 。這是遊戲展作品的單一玩家，只能當例子，不能當比例。
- 另有一則 itch.io 玩家說某作「難度暴增」，並未說放棄。https://itch.io/post/1929859 。

**6. 失敗的代價：重打一長關、從頭來——證據：多位開發者經驗（缺流失數字）**
- Kapalka 轉述清單把「讓玩家每關失敗五六次」與「卡死到無法繼續」列為壞設計。（轉述，見 Feronato 文章）
- Ironhide 在公測加入「重置升級」按鈕，讓早期錯誤決定不會把人鎖死。同上簡報。
- Defense Grid：核心球被搬走後還能搶回來，「給他們救贖的第二次機會」（PC Gamer，經驗談）。

**未找到證據的項目**
- 「關卡太長」：只有一則讀者留言（Shacknews 對 Kingdom Rush Origins 訪談下的留言者說舊作後段關卡比通勤還久），不是開發者、不是數據，**單一意見**，不列入歸納。
- 塔防專屬的流失數據（GameAnalytics、deltaDNA、學術）：**未查到**。GameAnalytics 的塔防文章只建議追蹤 D7 留存，沒有流失原因數字。網路上有「塔防 D1 40%、D7 15%」與「30% 流失者集中在 1–2 關」的說法，但前者出處不明、後者是廠商頁面且用模擬資料，**不採信**。
- 休閒玩家專屬的塔防數據：**未查到**。休閒相關內容只有上列 Kapalka（轉述）與 Fan 的演講整理。
- Reddit（r/TowerDefense、r/gamedesign）：本次無法存取，**未查到**。

---

## 主要來源清單

- Steam 成就頁：https://steamcommunity.com/stats/{3590, 3654560, 246420, 960090, 201790, 18500, 2239150, 215710}/achievements
- Ironhide 簡報：https://www.slideshare.net/slideshow/kingdom-rush-behind-the-scenes/11930274
- George Fan 演講整理：https://notes.hamatti.org/sources/talks/how-i-got-my-mom-to-play-through-plants-vs.-zombies
- PC Gamer（Defense Grid）：https://www.pcgamer.com/defense-grid-the-beer-game-that-changed-a-genre/
- Game Developer（Defense Grid）：https://www.gamedeveloper.com/game-platforms/feature-how-i-defense-grid-i-went-from-bleak-to-beautiful
- Feronato（Kapalka 轉述）：https://emanueleferonato.com/?p=1390
- Schmierbach 等人 2014：https://pure.psu.edu/en/publications/no-one-likes-to-lose-the-effect-of-game-difficulty-on-competency-/
- Steam Deck HQ（Thronefall）：https://steamdeckhq.com/news/thronefall-has-sold-over-one-million-copies/
- GameAnalytics 塔防指標：https://gameanalytics.com/blog/metrics-behind-successful-tower-defense-games/
