// 2026-11-14：PWA 樣品（加到主畫面＋離線）。說明在 docs/pwa-sample-2026-11-14.md。
// 藍圖 §4 的通過標準是「更新後無痕與舊快取都拿到新版」，所以這裡把 sw.js 放進假的瀏覽器環境真的跑：
// 開頁先問網路、斷線用存的、網路卡住 3 秒用存的、?v= 換號拿新檔並丟舊檔、沒版本號的檔下次開就是新的。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const html = src('index.html'), swSrc = src('sw.js');
const ROOT = 'https://game.test/sheepfold-defense/';

// 假的回應：只要 ok、內容、clone、text 四樣
const res = (body, ok = true) => ({ ok, body, clone() { return res(body, ok); }, text: async () => body });

// 假的瀏覽器：net 是「網路上現在有什麼」（網址 → 內容；值是 Error 就是斷線，'HANG' 就是卡住不回）
function boot(net) {
  const store = new Map(), handlers = {}, calls = [], how = [];
  const cache = {
    match: async k => (store.has(k) ? res(store.get(k)) : undefined),
    put: async (k, r) => { store.set(k, r.body); },
    keys: async () => [...store.keys()].map(url => ({ url })),
    delete: async k => store.delete(k.url || k),
  };
  const ctx = {
    URL, Set, Promise, Array,
    // 3 秒的等待縮成 20 毫秒，測試不用真的等
    setTimeout: (fn, ms) => setTimeout(fn, ms > 100 ? 20 : ms),
    caches: { open: async () => cache, keys: async () => ['sheepfold-v0', 'sheepfold-v1', 'other'], delete: async n => { calls.push('drop ' + n); } },
    fetch: (u, opt) => {
      const url = typeof u === 'string' ? u : u.url;
      calls.push(url);
      // how：這一趟有沒有要求「一定跟伺服器對過」
      how.push([url, (opt && opt.cache) || 'default']);
      // 真的伺服器不管 ?all&dev 這些參數，index.html 跟根網址也是同一頁
      const v = net.get(url.replace(/\?(all|dev|sw)(&(all|dev|sw))*$/, '').replace(/\/index\.html$/, '/'));
      if (v === 'HANG') return new Promise(() => {});
      // 值是 { moved: 內容 }：這個檔被轉址到別的網域。<img> 那種請求（傳進來的是請求物件）拿到看不到內容的回應，用網址字串抓才看得到
      if (v && v.moved) return Promise.resolve(typeof u === 'string' ? res(v.moved) : Object.assign(res('', false), { type: 'opaque' }));
      if (v instanceof Error) return Promise.reject(v);
      return Promise.resolve(v === undefined ? res('', false) : res(v));
    },
    self: {
      location: new URL(ROOT + 'sw.js'),
      addEventListener: (t, fn) => { handlers[t] = fn; },
      skipWaiting: () => { calls.push('skipWaiting'); },
      clients: { claim: async () => { calls.push('claim'); } },
    },
  };
  vm.runInNewContext(swSrc, ctx);
  // 丟一個事件進去，等它全部做完，回傳它給頁面的回應（沒接手就是 undefined）
  const fire = async (type, init) => {
    const waits = []; let answer;
    const ev = Object.assign({ waitUntil: p => waits.push(p), respondWith: p => { answer = p; } }, init);
    handlers[type](ev);
    const out = answer === undefined ? undefined : await answer;
    await Promise.all(waits);
    return out;
  };
  const get = (url, mode = 'no-cors') => fire('fetch', { request: { url, method: 'GET', mode } });
  return { store, calls, how, fire, get };
}

// 從真的 index.html 抓出它現在用的 js 網址，當成「網路上有的東西」
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
const liveNet = () => new Map([[ROOT, html], ...scripts.map(s => [ROOT + s, 'js:' + s]), [ROOT + 'img/icon-512.png', 'png'], [ROOT + 'img/icon-180.png', 'png'], [ROOT + 'manifest.json', '{}']]);

test('PWA：安裝時讀 index.html，把它用到的自家 js（連 ?v=）存起來；別的網域不存；sw.js 自己不寫版本號', async () => {
  const sw = boot(liveNet());
  await sw.fire('install', {});
  assert.ok(sw.store.has(ROOT), '首頁要存');
  assert.ok(scripts.length >= 6 && scripts.some(s => /\?v=\d+/.test(s)), 'index.html 應該有帶 ?v= 的 js');
  for (const s of scripts) assert.strictEqual(sw.store.get(ROOT + s), 'js:' + s, s + ' 要存');
  assert.ok(sw.store.has(ROOT + 'manifest.json'));
  assert.ok([...sw.store.keys()].every(k => k.startsWith(ROOT)), '只存自家的檔');
  assert.ok(sw.calls.includes('skipWaiting'));
  // 去掉註解之後，sw.js 不能出現任何 ?v=——版本號只有 index.html 一個來源
  const code = swSrc.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  assert.ok(!/\?v=/.test(code), 'sw.js 不可寫死版本號');
  await sw.fire('activate', {});
  assert.deepStrictEqual(sw.calls.filter(c => c.startsWith('drop')), ['drop sheepfold-v0'], '只丟自己的舊快取');
  assert.ok(sw.calls.includes('claim'));
});

test('PWA：開頁永遠先問網路——存著舊版也拿到新版；帶 ?all&dev 也一樣；斷線與卡住才用存的', async () => {
  const net = liveNet(), sw = boot(net);
  await sw.fire('install', {});
  net.set(ROOT, 'NEW HOME');
  assert.strictEqual((await sw.get(ROOT, 'navigate')).body, 'NEW HOME');
  assert.strictEqual(sw.store.get(ROOT), 'NEW HOME', '存的那份也換新');
  net.set(ROOT, 'NEWER HOME');
  assert.strictEqual((await sw.get(ROOT + 'index.html?all&dev', 'navigate')).body, 'NEWER HOME');
  // 斷線
  net.set(ROOT, new Error('offline'));
  assert.strictEqual((await sw.get(ROOT, 'navigate')).body, 'NEWER HOME');
  // 伺服器壞掉（回 404／500）也用存的
  net.delete(ROOT);
  assert.strictEqual((await sw.get(ROOT, 'navigate')).body, 'NEWER HOME');
  // 第一次來、沒有存的、又斷線：照實失敗，不假裝
  const cold = boot(new Map([[ROOT, new Error('offline')]]));
  await assert.rejects(cold.get(ROOT, 'navigate'));
});

test('PWA：網路卡住不回，等一下就先用存的那份（不卡白畫面）', async () => {
  const net = liveNet(), sw = boot(net);
  await sw.fire('install', {});
  net.set(ROOT, 'HANG');
  // 卡住的那趟永遠不會結束，所以這裡不等 waitUntil，只看回應
  let answer;
  sw.fire('fetch', { request: { url: ROOT, method: 'GET', mode: 'navigate' }, respondWith: p => { answer = p; }, waitUntil: () => {} });
  await new Promise(r => setImmediate(r));
  assert.strictEqual((await answer).body, html);
});

test('PWA：?v= 換號就是新檔——直接拿到新的，同名舊版丟掉；跟版本號策略不打架', async () => {
  const net = liveNet(), sw = boot(net);
  await sw.fire('install', {});
  const old = scripts.find(s => /^data\.js\?v=\d+$/.test(s));
  assert.ok(old, 'index.html 應該有 data.js?v=N');
  const next = 'data.js?v=' + (Number(old.split('=')[1]) + 1);
  net.set(ROOT + next, 'js:NEW DATA');
  assert.strictEqual((await sw.get(ROOT + next)).body, 'js:NEW DATA');
  assert.ok(sw.store.has(ROOT + next) && !sw.store.has(ROOT + old), '新版存進來、舊版丟掉');
  // 斷線後新版還在
  net.set(ROOT + next, new Error('offline'));
  assert.strictEqual((await sw.get(ROOT + next)).body, 'js:NEW DATA');
});

test('PWA：沒帶版本號的檔（圖、pixi）先給存的、背景更新——換了圖，下一次開就是新的；忘了加 ?v= 也會自己好', async () => {
  const net = liveNet(), img = ROOT + 'img/ground.webp';
  net.set(img, 'OLD IMG');
  const sw = boot(net);
  assert.strictEqual((await sw.get(img)).body, 'OLD IMG');
  net.set(img, 'NEW IMG');
  // 換一個新的 sw.js 生命週期（手機關掉再開），沿用同一份快取
  const sw2 = boot(net);
  for (const [k, v] of sw.store) sw2.store.set(k, v);
  assert.strictEqual((await sw2.get(img)).body, 'OLD IMG', '這一次先給存的');
  assert.strictEqual(sw2.store.get(img), 'NEW IMG', '背景已經換成新的');
  const sw3 = boot(net);
  for (const [k, v] of sw2.store) sw3.store.set(k, v);
  assert.strictEqual((await sw3.get(img)).body, 'NEW IMG', '下一次開就是新的');
  // 同一輪不重複在背景抓同一個檔
  const before = sw3.calls.filter(c => c === img).length;
  await sw3.get(img);
  assert.strictEqual(sw3.calls.filter(c => c === img).length, before);
});

test('PWA：不該管的不管——別的網域、非 GET、sw.js 自己、proto 底下的頁面', async () => {
  const sw = boot(liveNet());
  assert.strictEqual(await sw.get('https://www.googletagmanager.com/gtag/js?id=G-X'), undefined);
  assert.strictEqual(await sw.get('https://game.test/other-site/a.js'), undefined);
  assert.strictEqual(await sw.get(ROOT + 'sw.js'), undefined);
  assert.strictEqual(await sw.get(ROOT + 'proto/canvas.html', 'navigate'), undefined);
  assert.strictEqual(await sw.fire('fetch', { request: { url: ROOT + 'data.js', method: 'POST', mode: 'cors' } }), undefined);
  assert.deepStrictEqual(sw.calls, [], '這些請求 sw.js 一個都沒碰');
});

test('PWA：頁面第一次開時載過的檔，交給 sw.js 補存（只收自家的、已經有的不重抓）', async () => {
  const net = liveNet();
  net.set(ROOT + 'img/ico/a.webp', 'A');
  const sw = boot(net);
  await sw.fire('install', {});
  const n = sw.calls.length;
  await sw.fire('message', { data: { type: 'warm', urls: [ROOT + 'img/ico/a.webp', ROOT + scripts[0], 'https://evil.test/x.js', ROOT, 'not a url'] } });
  assert.strictEqual(sw.store.get(ROOT + 'img/ico/a.webp'), 'A');
  assert.deepStrictEqual(sw.calls.slice(n), [ROOT + 'img/ico/a.webp'], '只抓了缺的那一個');
  await sw.fire('message', { data: { type: 'other' } });
  await sw.fire('message', { data: null });
});

test('PWA：manifest 欄位齊、圖示檔都在；index.html 掛了 manifest、iPhone 三行 meta、註冊 sw.js 且本機預設不裝', () => {
  const m = JSON.parse(src('manifest.json'));
  assert.strictEqual(m.name, '羊圈守夜');
  assert.strictEqual(m.display, 'standalone');
  // 網址一律相對：正式站在 /sheepfold-defense/ 底下，寫成 / 開頭會跑到別的地方
  assert.strictEqual(m.start_url, './');
  assert.strictEqual(m.scope, './');
  assert.ok(m.icons.some(i => i.sizes === '192x192') && m.icons.some(i => i.sizes === '512x512') && m.icons.some(i => i.purpose === 'maskable'));
  for (const i of m.icons) {
    assert.ok(!/^\//.test(i.src) && fs.existsSync(path.join(__dirname, '..', i.src)), i.src + ' 要在');
    // PNG 檔頭第 16–23 位元組是寬高，對一下跟寫的一樣
    const b = fs.readFileSync(path.join(__dirname, '..', i.src));
    assert.strictEqual(b.readUInt32BE(16) + 'x' + b.readUInt32BE(20), i.sizes, i.src + ' 尺寸');
  }
  const bg = html.match(/--bg:\s*(#[0-9a-f]{6})/)[1];
  assert.strictEqual(m.background_color, bg, '開啟畫面底色跟遊戲夜色底一樣');
  assert.ok(html.includes('<link rel="manifest" href="manifest.json">'));
  assert.ok(html.includes('<meta name="apple-mobile-web-app-capable" content="yes">'));
  assert.ok(html.includes('<meta name="apple-mobile-web-app-title" content="羊圈守夜">'));
  assert.ok(html.includes('<link rel="apple-touch-icon" sizes="180x180" href="img/icon-180.png">'));
  assert.ok(html.includes("navigator.serviceWorker.register('sw.js')"));
  assert.ok(/local && !\/\[\?&\]sw\\b\/\.test\(location\.search\)/.test(html), '本機沒帶 ?sw 不裝');
  assert.ok(html.includes("postMessage({ type: 'warm'"));
});

// 11/14 真瀏覽器驗出來的：背景更新那一趟沒要求跟伺服器對，被瀏覽器自己留的舊檔攔下，重新整理三次都還是舊的。
test('PWA：背景更新一定跟伺服器對過（no-cache）；每次開頁算新的一輪，同一個檔可以再對一次', async () => {
  const net = liveNet();
  net.set(ROOT + 'lib/pixi.min.js', 'pixi 1');
  const sw = boot(net);
  await sw.fire('install', {});
  // 安裝時抓的那幾個檔也要對過，不然裝進來的就可能是舊的
  assert.ok(sw.how.length > 3 && sw.how.every(([, c]) => c === 'no-cache'), '安裝時每一趟都要 no-cache');
  const pixi = ROOT + 'lib/pixi.min.js';
  const round = async () => {
    await sw.fire('fetch', { request: { url: ROOT, method: 'GET', mode: 'navigate' } });
    return (await sw.get(pixi)).body;
  };
  sw.how.length = 0;
  net.set(pixi, 'pixi 2');
  assert.strictEqual(await round(), 'pixi 1', '這一次開先給存的');
  assert.deepStrictEqual(sw.how.filter(([u]) => u === pixi), [[pixi, 'no-cache']], '背景那一趟要 no-cache');
  assert.strictEqual(await round(), 'pixi 2', '下一次開就是新的');
  // 又上了一版：不用等這支程式被瀏覽器重啟，再開兩次一樣拿得到
  net.set(pixi, 'pixi 3');
  assert.strictEqual(await round(), 'pixi 2');
  assert.strictEqual(await round(), 'pixi 3');
});

// 11/14 測試站驗出來的：githack 把圖 301 到別的網域，進局後才載的圖（h-gatekeeper）一直存不進去。
test('PWA：被轉址到別的網域的圖，第一次照給，背景另外抓一份存起來，下次就有', async () => {
  const net = liveNet();
  const pic = ROOT + 'img/ico/h-gatekeeper.webp';
  net.set(pic, { moved: 'webp' });
  const sw = boot(net);
  await sw.fire('install', {});
  const first = await sw.get(pic);
  assert.strictEqual(first.type, 'opaque', '第一次把原本的回應照給頁面');
  assert.strictEqual(sw.store.get(pic), 'webp', '背景抓到看得到內容的那份並存起來');
  const n = sw.calls.length;
  assert.strictEqual((await sw.get(pic)).body, 'webp', '第二次用存的');
  net.set(pic, new Error('offline'));
  await sw.fire('fetch', { request: { url: ROOT, method: 'GET', mode: 'navigate' } }).catch(() => null);
  assert.strictEqual((await sw.get(pic)).body, 'webp', '斷線也有');
  assert.ok(sw.calls.length > n);
});
