// 11/8 周邊 UI 小點綴（蠟燭開關、複製打勾、試煉金勾、尾聲名單捲動）：讀 index.html 原始碼守住幾個容易被改掉的點。
// 視覺本身在本機 Chrome 看過；這裡只守「東西還接著」。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('更新紀錄第一筆是 2026.11.08，首頁一句話也換了', () => {
  assert.match(html, /const CHANGELOG = \[\s*\{ ver: '2026\.11\.08'/);
  assert.match(html, /const HOME_UPDATE = '最近更新 11\/8/);
});

test('設定頁七個開關都掛了蠟燭（大字、省效能、高對比、音樂、音效、蟲鳴、使用統計），音量與存檔碼不掛', () => {
  assert.strictEqual((html.match(/<button class="cdl"/g) || []).length, 7);
  assert.doesNotMatch(html, /<button class="cdl" data-vol/);
  assert.doesNotMatch(html, /<button class="cdl" id="set-(export|import)"/);
  assert.match(html, /\.snd-row button\.cdl\.on::after \{[^}]*animation: candle-flicker/);
  assert.match(html, /prefers-reduced-motion: reduce\) \{\s*\.snd-row button\.cdl\.on::after \{ animation: none; \}/);
});

test('畫勾的 SVG 只定義一次，複製成功與試煉過關都用它；剛過的題才帶 draw、畫過就清掉', () => {
  assert.strictEqual((html.match(/const CHECK_SVG = /g) || []).length, 1);
  assert.match(html, /btn\.innerHTML = `\$\{CHECK_SVG\(' draw'\)\} 已複製`/);
  assert.match(html, /done \? CHECK_SVG\(T\.id === freshTrial \? ' draw' : ''\)/);
  assert.match(html, /if \(!T\.cleared\[trial\.id\]\) freshTrial = trial\.id;/);
  assert.match(html, /if \(!story\) freshTrial = null;/);
  assert.doesNotMatch(html, /done \? '✅'/, '試煉列表不該再用 ✅ 表情');
});

test('尾聲最後一頁：名單包 ep-roll、尾句與按鈕包 ep-after；點畫面加 skip；重開尾聲會清 skip', () => {
  assert.match(html, /<div class="ep-small\$\{sl\.end \? ' ep-roll' : ''\}"><div>/);
  assert.match(html, /\$\{sl\.end \? '<div class="ep-after">' : ''\}/);
  assert.match(html, /if \(sl\.end\) \{ \$\('#epilogue \.ep'\)\.classList\.add\('skip'\); return; \}/);
  assert.match(html, /function openEpilogue\(from\) \{[^\n]*classList\.remove\('skip'\)/);
  assert.match(html, /#epilogue \.ep\.skip \.ep-roll > div, #epilogue \.ep\.skip \.ep-after \{ animation-duration: 0s; animation-delay: 0s; \}/);
  assert.match(html, /#epilogue \.ep-roll > div, #epilogue \.ep-after \{ animation: none; \}/, '減少動態要整頁靜態');
});
