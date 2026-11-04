// 11/4 James iPad Safari 回報：點棋盤「點兩下」升級會被當成雙擊放大、而且縮不回來。
// render.js 是 Pixi 畫面層，sim 跑不起來，這裡用讀原始碼的方式守住那兩道保險不被下次改版不小心拿掉
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'render.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('canvas 掛了空 click：iPad Safari 才會把棋盤當可點擊元件、尊重 touch-action', () => {
  assert.match(src, /app\.canvas\.addEventListener\('click'/);
});

test('canvas 的 touchend 擋掉預設動作，且監聽器不是 passive（passive 的 preventDefault 無效）', () => {
  const m = src.match(/app\.canvas\.addEventListener\('touchend',[^\n]*/);
  assert.ok(m, '找不到 touchend 監聽');
  assert.match(m[0], /preventDefault\(\)/);
  assert.match(m[0], /passive:\s*false/);
});

test('棋盤和 body 的 touch-action: manipulation 還在（第一層保險）', () => {
  assert.match(html, /#board\s*\{[^}]*touch-action:\s*manipulation/);
  assert.match(html, /body\s*\{[^}]*touch-action:\s*manipulation/);
});
