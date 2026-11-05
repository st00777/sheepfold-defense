# pixelfx 研究筆記與對照（2026-11-05）

James 11/5 看到 https://github.com/patch-gg/pixelfx，要求整理進知識庫並對照我們能試什麼。本篇只讀 README、package.json、skill 說明與四個特效原始碼（fireflies、halo、poof、god-rays），沒有實際跑過。

## 1. 它是什麼

- Patch（patch.gg）開源的**像素風特效程式庫**：244 個特效，每個是一支獨立 JS 檔，用程式把像素畫進一個 `ImageData` 緩衝，再貼到 2D canvas 放大顯示。沒有圖檔，所以能換色、翻面、換種子、匯成 sprite sheet。
- 方法來自 Hugo Duprez 的「code is clay」：讓 AI 先出草稿、渲染成圖、用眼睛看、再改。附一個 Claude Code skill（`skills/pixelfx`）就是在教這套流程。
- 數據：約 5,000 星、669 fork、v0.3.0、最近推送 2026-10-31、MIT（字型除外）。沒有相依套件，工具要 Node 18。
- 展示站：https://patch-gg.github.io/pixelfx/

## 2. 它怎麼運作（跟我們有關的部分）

- **兩個緩衝**：color（不透明／抖色／半透明的像素）＋ light（加法混色的光暈），`composite()` 合在一起。我們棋盤的 `L.glow` 層也是加法混色，概念一樣。
- **全部可重現**：亂數都吃 seed，粒子模擬固定 120 Hz，跟畫面幀率無關。
- **效果分前後層**：`draw(frame, "back")` 畫在角色後面、`"front"` 畫在前面。
- **Acting**：61 個效果附一個 24×38 的灰色假人，12 個「招式」帶起手、命中定格、後搖、震動。對塔防用不到。
- **匯出**：`node tools/render.mjs <id> --sheet` 出透明 PNG 格子＋ Aseprite 格式 JSON（幀框、時長、fps、pivot）。
- **API 核心**（原文）：

```js
import { createFrame, clearFrame, createFx, composite } from "pixelfx";
import * as frostNova from "pixelfx/fx/ice/frost-nova";
const frame = createFrame(320, 180);
const fx = createFx(frostNova, { x: 160, y: 140 });   // flip, angle, seed, palette, light...
function tick(dt) {
  fx.update(dt); clearFrame(frame);
  fx.draw(frame, "back"); drawCharacters(); fx.draw(frame, "front");
  composite(frame, img.data, backgroundColor);
  ctx.putImageData(img, 0, 0);   // 再用 image-rendering: pixelated 放大
}
```

- 原始碼風格：一個特效 80–150 行，`meta` 寫名字、尺寸、長度、調色盤；`create(o)` 建粒子，`draw(p, t, o)` 每幀畫。像素座標直接 `q.px(x, y, color)`、`q.glow(x, y, r, color, a)`。

## 3. 跟羊圈守夜的根本差異

| | pixelfx | 羊圈守夜 |
|---|---|---|
| 美術 | 像素風，320×180 這種解析度放大 | 3D 黏土感插畫（封面與 43 張角色圖），不是像素 |
| 繪圖 | 軟體畫進 ImageData，CPU | PixiJS WebGL，Graphics＋貼圖＋粒子 |
| 座標 | 固定像素格 | 格子大小隨螢幕變，手機一格約 40–50px |
| 效能 | 每幀整張 putImageData | 已有省效能模式（lite）：解析度 1、粒子減量、離屏圖隔幀重畫 |
| 無障礙 | 無 | `prefers-reduced-motion` 時粒子全關 |

**結論：不能直接拿來用。**像素風效果疊在黏土風角色上會打架（風格混用是美術總監 10/23 審查最忌諱的事），而且每幀 putImageData 一整張再疊到 Pixi 上，等於在 WebGL 棋盤上多跑一個軟體繪圖層，James 的電腦 10/28 已經會卡。

## 4. 三條可行的用法

**A. 當「算法參考書」抄進 render.js（推薦）**
每個特效就是一支看得懂的 JS，粒子數、速度、拖曳、生命期、顏色階都寫死在裡面。我們的 `spark()`／`burst()`／`ring()`／`tween()` 可以照它的數字重排，畫成柔邊圓點（dotTex）而不是像素，風格就對了。成本：一個效果半天內。

**B. 匯 sprite sheet 當小貼圖（限小尺寸）**
像素圖縮到一格 40px 以內、再加一點模糊，像素感會消失，看起來像一團柔光。適合「只閃 0.3 秒的小爆點」，不適合占半個棋盤的大效果。要試再說。

**C. 借它的工作法做我們自己的效果**
skill 的核心是「草稿→渲染成圖→用眼睛看→改」。我們本機 Chrome 截圖已經在做一樣的事，差別是它把每個效果獨立成檔、能單獨渲染一張 contact sheet 對照。這點可以學：之後棋盤特效改動，先在 sim 或獨立頁渲染靜態幀再進遊戲。

## 5. 逐項對照：我們已有的、它有而我們沒有的

### 已有、它也有（不用動）
| 我們 | pixelfx 對應 | 備註 |
|---|---|---|
| 火盆／油燈光暈晃動＋火星（render.js 299–302） | fire/brazier、fire/torch、fire/candle | 我們已有兩層呼吸正弦，夠了 |
| 燃燒冒火、中毒冒泡（447–449） | status/burning、status/poisoned | 同款 |
| 受擊亮一下＋三顆火星（flashHit） | impacts/hit-flash、impacts/hit-spark | 同款 |
| 雨絲、暴風暗幕、閃電＋全幕白閃（645–652） | weather/rain、weather/storm、lightning/lightning-strike | 同款 |
| 右緣黑霧、照亮的排退霧（107、365） | weather/fog | 同款 |
| 黃昏／天亮漸層天色（gradTex.dusk／dawn） | — | 它沒有 |
| 敵人倒下：縮 .85 淡出＋腳下塵（461） | spawn/poof、spawn/dissolve-burn | 它的 poof 是卡通煙圈＋星星，比我們熱鬧 |
| 投石濺射圓環、水袋水花、坑塌土圈（545–563） | impacts/ground-slam、water/splash | 同款 |

### 它有、我們沒有、**值得試**（照優先序）
1. **weather/fireflies（螢火蟲）**：寧靜夜的環境氛圍。它的做法：32 隻分三層深度、各自的亮暗節奏（快亮、停、慢暗）、近的拖四格光尾、照亮腳下草尖。我們只要「各自節奏＋三層亮度」那段，畫成 dotTex 加法混色。寧靜夜是給朋友與小孩的入口（11/2 報告第 5 節），多一點活氣不加難度。省效能模式與 reduce 關掉。
2. **weather/god-rays（天光）**：天亮那一刻（dawned）從右上掃進幾道斜光，3 秒淡掉。我們天亮只換天色漸層，缺一個「熬過了」的儀式感；James 的設計價值觀是里程碑要有視覺強調。
3. **holy/halo、holy/blessing（光環、祝福）**：成就解鎖卡（交集 B 已改成回選單再跳）與第 10／30 夜詩篇那一句。目前成就卡沒有棋盤層級的動畫。可以抄它「光環由內向外一圈圈淡出」的節奏做在 DOM 卡片上，不一定要進 Pixi。
4. **ui/level-up（升級）**：11/2 改成點兩下升級後，升級成功只有金色標籤（308 行）。抄它「一道光往上掃＋頂端小星」做在單位格上，玩家更確定自己「花糧成功了」。
5. **spawn/poof（倒下煙圈）**：領頭狼、熊、獅這些 boss 倒下用它的「白色爆點＋九顆煙球＋三顆星」，一般小怪維持現在的淡出。只給 boss 才不會每波都吵。
6. **status/slowed、status/stunned（減速、暈眩）**：我們坑塌、水袋、牧羊犬嚇跑的狀態字是 popText，沒有持續的狀態粒子。它的「頭上轉圈星星」「腳下慢字波紋」可以當減速與暈的持續提示，玩家才看得出效果還在。

### 它有、不建議
- 刀光、槍火、科幻、暗影、傳送門：世界觀不合。
- transitions（轉場）：我們頁面轉場是 DOM／CSS，不走 canvas。
- Acting／骨架：角色動畫的四條路在 plan-character-rig §8，首選 Pixi 網格變形，不混進像素假人。

## 6. 建議先做的一件

先試第 1 項螢火蟲，理由：寧靜夜最多人玩、純環境不碰數值、省效能與 reduce 現成開關可關、做壞了關掉就好。做法：
- 抄 fireflies.js 的 `fly()`（位置正弦漂移＋ pulse 節奏）成 render.js 一個 `fireflies()`，每幀畫 12–16 顆 dotTex 到 `L.glow`，手機 lite 模式 6 顆。
- 只在 `diff === 'calm'` 且天黑後出現，天亮淡掉。
- 本機 Chrome 截圖對照 pixelfx 展示站的 fireflies 看節奏像不像，再進 githack 測試站。

## 7. 參考連結
- Repo：https://github.com/patch-gg/pixelfx
- 展示站：https://patch-gg.github.io/pixelfx/
- 方法原文：https://www.spritefusion.com/blog/how-to-make-good-pixel-art-effects-with-claude
- 特效原始碼路徑：`src/fx/<category>/<name>.js`；核心：`src/core/`（painter、particles、color 的 PAL 調色盤有 fire、ember、holy、night 等現成階）
