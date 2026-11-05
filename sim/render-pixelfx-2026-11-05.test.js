// 11/5 試用 pixelfx 像素特效（分支 feat/pixelfx-trial）。render.js 是 Pixi 畫面層跑不進 sim，
// 這裡做兩件事：lib/pixelfx.js 打包真的能在 node 畫出像素；render.js 的開關與載入順序守住。
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'render.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const lib = fs.readFileSync(path.join(root, 'lib', 'pixelfx.js'), 'utf8');

function loadLib() { global.window = global.window || {}; return new Function(lib + ';return PixelFX')(); }

test('lib/pixelfx.js 打包：六個效果都在（日芒 11/5 James 看過拿掉）、煙圈與螢火蟲真的畫得出像素', () => {
  const P = loadLib();
  for (const k of ['createFrame', 'clearFrame', 'createFx', 'composite', 'poof', 'collect', 'hitSpark', 'splash', 'fireflies', 'fireball', 'groundSlam', 'fireRing', 'quake', 'thunderclap', 'dirtExplosion', 'poisonCloud', 'heart', 'clawSwipe']) assert.ok(P[k], k);
  // 每個打包進來的效果都要能在 node 畫出東西（不依賴瀏覽器），更新 0.4 秒後有像素
  for (const k of ['poof', 'collect', 'hitSpark', 'splash', 'fireball', 'groundSlam', 'fireRing', 'quake', 'thunderclap', 'dirtExplosion', 'poisonCloud', 'heart', 'clawSwipe']) { const fr = P.createFrame(320, 240), fx = P.createFx(P[k], { x: 160, y: 200 }); fx.update(.15); fx.draw(fr, "back"); fx.draw(fr, "front"); const o = new Uint8ClampedArray(320 * 240 * 4); P.composite(fr, o, null); let n = 0; for (let i = 3; i < o.length; i += 4) if (o[i]) n++; assert.ok(n > 30, k + ' 畫出 ' + n + ' 個像素'); }
  // 火球跟著投射物飛：改 options.x/y 要真的移動畫出來的位置（createFx 回的 options 跟 draw 用的是同一個物件）
  { const fr = P.createFrame(320, 100), fx = P.createFx(P.fireball, { x: 60, y: 50 }); fx.update(.2); fx.draw(fr, 'back'); fx.draw(fr, 'front'); const a = new Uint8ClampedArray(320 * 100 * 4); P.composite(fr, a, null); fx.options.x = 260; P.clearFrame(fr); fx.draw(fr, 'back'); fx.draw(fr, 'front'); const b = new Uint8ClampedArray(320 * 100 * 4); P.composite(fr, b, null); const left = (o) => { let n = 0; for (let y = 0; y < 100; y++) for (let x = 0; x < 160; x++) if (o[(y * 320 + x) * 4 + 3]) n++; return n; }; assert.ok(left(a) > 200 && left(b) < 50, '火球搬到右邊後左半邊不該還有像素：' + left(a) + '→' + left(b)); }
  assert.ok(!P.sunburst, '日芒不該再打包進來');
  assert.ok(!/pxPlay\('sunburst'/.test(src), 'render.js 不該再放日芒');
  const count = (mod, o, t) => { const fr = P.createFrame(320, 200), fx = P.createFx(mod, o); fx.update(t); P.clearFrame(fr); fx.draw(fr, 'back'); fx.draw(fr, 'front'); const out = new Uint8ClampedArray(320 * 200 * 4); P.composite(fr, out, null); let n = 0; for (let i = 3; i < out.length; i += 4) if (out[i]) n++; return n; };
  assert.ok(count(P.poof, { x: 160, y: 150 }, .3) > 500, '煙圈');
  assert.ok(count(P.fireflies, { x: 160, y: 220 }, 1.3) > 500, '螢火蟲');
  // 去草地版：原點放在畫面下緣外，畫面最底 3 排不該有整排的草
  const fr = P.createFrame(320, 200), fx = P.createFx(P.fireflies, { x: 160, y: 220 }); fx.update(2); fx.draw(fr, 'back'); fx.draw(fr, 'front');
  const out = new Uint8ClampedArray(320 * 200 * 4); P.composite(fr, out, null); let bottom = 0; for (let y = 197; y < 200; y++) for (let x = 0; x < 320; x++) if (out[(y * 320 + x) * 4 + 3]) bottom++;
  assert.ok(bottom < 60, '底排幾乎沒有草：' + bottom);
});

test('render.js：pixelfx 層在減少動態、省效能、加速時不出；清場與開省效能會把進行中的效果清掉', () => {
  assert.match(src, /function pxOk\(\) \{ return !!\(window\.PixelFX && app && !reduce\(\) && !lite\); \}/);
  assert.match(src, /function pxPlay\([^)]*\) \{[^\n]*\n\s*if \(!pxOk\(\) \|\| !PX\.layers\.length \|\| speed > 1\) return null;/);
  assert.match(src, /pxStopAll\(\);\n\s*setMarker\(null\)/, 'clear() 要清 pixelfx');
  assert.match(src, /setLite\(on\) \{ lite = !!on; if \(lite\) pxStopAll\(\);/);
  assert.match(src, /'fx', 'px', 'light'/, 'px 圖層在效果層之上、光照之下');
});

test('index.html：lib/pixelfx.js 在 render.js 之前載入，render.js 版本號有加', () => {
  const a = html.indexOf('lib/pixelfx.js?v='), m = html.match(/render\.js\?v=(\d+)/), b = m ? m.index : -1;
  assert.ok(a > 0 && b > a, '載入順序');
  assert.ok(m && +m[1] >= 29, 'render.js 版本號至少 29（11/5 晚上狗爪痕修正）');
});

// 11/5 晚上 James 真機：牧羊犬爪痕畫在狗的位置還翻了面、只出第一下。引擎 bark 事件只在剛咬住送一次，
// 所以畫面端要自己盯著咬住中的狗、每隔一下畫在敵人身上；這裡讀原始碼守住
test('render.js：狗爪痕由 dogClaw 週期畫在敵人身上，bark 事件不再直接放爪痕', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'render.js'), 'utf8');
  const bark = src.match(/case 'bark':[^\n]*/)[0];
  assert.ok(!bark.includes('pxPlay'), 'bark 不直接放爪痕');
  const fn = src.slice(src.indexOf('function dogClaw'), src.indexOf('function drawMovers'));
  assert.ok(fn.includes("pxPlay('clawSwipe'") && fn.includes('ev.cont.x') && fn.includes('EN.get(e.id)'), '爪痕放在敵人畫面位置');
  assert.ok(fn.includes('e.heldBy === u.id'), '只有主咬手畫');
  assert.ok(/v\.clawT = \.75/.test(fn) && fn.includes('v.clawT = (v.clawT || 0) - dt'), '每 0.75 秒重畫一次');
  assert.ok(/dogClaw\(u, dt\)/.test(src.slice(src.indexOf('function drawMovers'))), 'drawMovers 每幀呼叫');
});
