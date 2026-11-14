// 11/8 周邊 UI 小點綴（蠟燭開關、複製打勾、試煉金勾、尾聲名單捲動）＋同日審查四部奏的修正：讀 index.html 原始碼守住幾個容易被改掉的點。
// 視覺本身在本機 Chrome 看過；這裡只守「東西還接著」。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('更新紀錄第一筆是 2026.11.08，首頁一句話也換了', () => {
  assert.match(html, /const CHANGELOG = \[\s*\{ ver: '2026\.11\.14'/); // 11/13、11/14 各又加了一筆在最前面
  assert.match(html, /const HOME_UPDATE = '最近更新 11\/14/);
  assert.match(html, /\{ ver: '2026\.11\.08', notes: \[/);
});

test('設定頁八個開關都掛了蠟燭（大字、省效能、高對比、減少動態、音樂、音效、蟲鳴、使用統計），音量與存檔碼不掛', () => {
  assert.strictEqual((html.match(/<button class="cdl"/g) || []).length, 8); // 11/13 加了「減少動態」
  assert.doesNotMatch(html, /<button class="cdl" data-vol/);
  assert.doesNotMatch(html, /<button class="cdl" id="set-(export|import)"/);
  assert.match(html, /\.snd-row button\.cdl\.on::after \{[^}]*animation: candle-flicker/);
  assert.match(html, /html\.reduce \.snd-row button\.cdl\.on::after \{ animation: none; \}\s*html\.reduce \.snd-row button\.cdl::after \{ transition: none; \}/); // 11/13 起減少動態走 html.reduce 類別，不是媒體查詢
  assert.match(html, /html\.contrast \.snd-row button\.cdl:not\(\.on\)::after/, '高對比只改關著的燭芯，不能蓋掉火苗');
});

test('畫勾的 SVG 只定義一次，複製成功與試煉過關都用它；剛過的題才畫、畫過就清掉，回首頁也清掉；讀屏唸得到「過了」', () => {
  assert.strictEqual((html.match(/const CHECK_SVG = \(draw = false, label = ''\)/g) || []).length, 1);
  assert.match(html, /btn\.innerHTML = ok \? `\$\{CHECK_SVG\(true\)\} 已複製` : '沒複製到'/);
  assert.match(html, /done \? CHECK_SVG\(T\.id === freshTrial, '過了'\)/);
  assert.match(html, /if \(!T\.cleared\[trial\.id\]\) freshTrial = trial\.id;/);
  assert.match(html, /if \(!story\) freshTrial = null;/);
  assert.match(html, /function buildLevels\(\) \{\s*freshTrial = null;/);
  assert.doesNotMatch(html, /done \? '✅'/, '試煉列表不該再用 ✅ 表情');
});

test('複製按鈕：成功／失敗都先清掉上一次的狀態、都會在 1.6 秒後回到「複製」（先成功再失敗不能卡在綠底）', () => {
  assert.match(html, /btn\.classList\.remove\('shake', 'done'\);/);
  assert.match(html, /copyTimer = setTimeout\(\(\) => \{ btn\.classList\.remove\('done'\); btn\.textContent = '複製'; \}, 1600\);/);
  assert.match(html, /#set-copy\.shake \{ animation: copy-shake 320ms; \}/);
  assert.match(html, /html\.reduce \.ck\.draw, html\.reduce \.ck\.draw path, html\.reduce #set-copy\.shake \{ animation: none; \}/, '減少動態要關掉勾與抖動');
  assert.match(html, /id="set-copy-note" aria-live="polite"/);
});

test('尾聲最後一頁：名單包 ep-roll 往上捲（高度跟內容走）、尾句與按鈕包 ep-after 平常藏著、捲完或跳過才現身；0.6 秒守門在 skip 之前', () => {
  assert.match(html, /<div class="ep-small\$\{sl\.end \? ' ep-roll' : ''\}"><div>/);
  assert.match(html, /\$\{sl\.end \? `<div class="ep-after">\$\{tail\}<button class="btn" id="ep-done">/);
  assert.match(html, /#epilogue \.ep-roll \{ overflow: hidden; padding-bottom: 1em;/);
  assert.doesNotMatch(html, /#epilogue \.ep-roll \{ height: \d/, '框高不能寫死，名單加長會被裁');
  assert.match(html, /@keyframes ep-roll \{ from \{ transform: translateY\(100%\); \}/);
  assert.match(html, /#epilogue \.ep-after \{ visibility: hidden; opacity: 0;/);
  assert.match(html, /#epilogue \.ep-after\.on \{ visibility: visible; opacity: 1;/);
  assert.match(html, /roll\.addEventListener\('animationend', epReveal, \{ once: true \}\)/);
  assert.match(html, /if \(!roll \|\| reduceMotion\(\)\) epReveal\(\);/, '減少動態沒有 animationend，要直接現身');
  assert.match(html, /if \(!sl \|\| performance\.now\(\) - epShown < 600\) return; if \(sl\.end\) \{ epSkip\(\); return; \}/);
  assert.match(html, /function epSkip\(\) \{ \$\('#epilogue \.ep'\)\.classList\.add\('skip'\); epReveal\(\); \}/);
  assert.match(html, /function openEpilogue\(from\) \{[^\n]*classList\.remove\('skip'\)/);
  assert.match(html, /#epilogue \.ep\.skip \.ep-roll > div \{ animation: none; \}/);
  assert.match(html, /#epilogue \.ep-roll > div \{ animation: none; \}/, '減少動態要整頁靜態');
  assert.match(html, /else if \(act && sl && sl\.end\) \{ ev\.preventDefault\(\); epSkip\(\); \}/, '鍵盤 Enter／空白在名單還在捲時是跳過不是關');
});
