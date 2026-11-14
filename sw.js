// 羊圈守夜 service worker（PWA 樣品，2026-11-14；說明在 docs/pwa-sample-2026-11-14.md）
//
// 白話：這支小程式住在瀏覽器裡，幫遊戲把檔案存一份在手機上。
// 這樣把遊戲「加到主畫面」之後，沒網路也開得起來。
//
// 最怕的事：存了舊檔，上了新版玩家卻一直拿到舊的（跟 ?v= 版本號打架）。
// 所以只有三條規則：
//   1. 開頁（index.html）永遠先問網路，拿到的就是最新版；沒網路、或 3 秒沒回，才用上次存的那份。
//   2. 其他檔（js、圖）先給存的那份，同時在背景再抓一次；有新的就換掉，下次開就是新的。
//      背景那一趟一定要跟伺服器對過（no-cache），不能拿瀏覽器自己留的舊檔來充數。
//   3. 帶 ?v= 的檔（data.js?v=29 這種）網址變了就是新檔，存新的時候順手把同名舊版丟掉。
//
// 這支檔裡「沒有」任何版本號清單。要先存哪些 js，是安裝當下去讀 index.html 抓出來的。
// 所以上版流程不變：照舊改 index.html 裡的 ?v= 就好，不用回來改這支檔。
// 只有改了「這支檔自己的規則」才需要動 CACHE 的名字（換名字＝整包舊快取丟掉重來）。

const CACHE = 'sheepfold-v1';
// 開頁等網路最多等幾毫秒，超過就先用存的那份（網路很慢的地方不會卡在白畫面）
const NAV_TIMEOUT = 3000;
// 這個網站的根網址（正式站是 …/sheepfold-defense/，測試站是 githack 的分支網址）
const ROOT = new URL('./', self.location).href;
// 這一輪（開一次頁算一輪）已經在背景重抓過的網址，不重複抓；每次開頁清空重算
const fresh = new Set();

// 是不是「這個網站自己的檔」：別的網域（GA 統計等）一律不碰
function mine(u) {
  return u.origin === self.location.origin && u.href.startsWith(ROOT);
}

// 是不是「開頁」：只管根網址與 index.html（後面帶 ?all 之類的參數也算），proto／sim 底下的頁面不管
function isHome(u) {
  const root = new URL(ROOT).pathname;
  return u.pathname === root || u.pathname === root + 'index.html';
}

// 從 index.html 的文字裡，抓出它用到的自家 js 與圖示網址（連 ?v= 一起）
function shellUrls(html) {
  const out = new Set();
  const re = /<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    let u;
    try { u = new URL(m[1], ROOT); } catch (_) { continue; }
    if (mine(u) && u.href !== ROOT) out.add(u.href);
  }
  return [...out];
}

// 存一個檔；如果它帶 ?v=，把同一個檔名的其他版本丟掉（data.js?v=29 進來，data.js?v=28 就走）
async function put(cache, href, res) {
  await cache.put(href, res);
  const u = new URL(href);
  if (!u.search) return;
  const keys = await cache.keys();
  await Promise.all(keys.filter((k) => {
    const ku = new URL(k.url);
    return ku.pathname === u.pathname && ku.href !== u.href;
  }).map((k) => cache.delete(k)));
}

// 安裝：抓一份最新的 index.html 存起來，再把它用到的 js 與圖示也存起來
async function precache() {
  const cache = await caches.open(CACHE);
  const res = await fetch(ROOT, { cache: 'no-cache' });
  if (!res.ok) return;
  const html = await res.clone().text();
  await cache.put(ROOT, res);
  await Promise.all(shellUrls(html).map((href) =>
    fetch(href, { cache: 'no-cache' }).then((r) => (r.ok ? put(cache, href, r) : null)).catch(() => null)));
}

// 規則 1：開頁先問網路
async function homeFirst(event) {
  // 開頁＝新的一輪，這一頁用到的檔都可以再跟伺服器對一次
  fresh.clear();
  const cache = await caches.open(CACHE);
  const net = fetch(event.request.url, { cache: 'no-cache' }).then(async (res) => {
    if (res.ok) await cache.put(ROOT, res.clone());
    return res;
  });
  // 就算等不及先回了存的那份，背景這一趟也讓它跑完，下次開才是新的
  event.waitUntil(net.catch(() => null));
  const saved = await cache.match(ROOT);
  // 第一次來、手上沒有存的：只能等網路
  if (!saved) return net;
  const timer = new Promise((done) => setTimeout(() => done(null), NAV_TIMEOUT));
  const res = await Promise.race([net.catch(() => null), timer]);
  return res && res.ok ? res : saved;
}

// 規則 2：其他檔先給存的，背景更新
async function savedThenRefresh(event) {
  const req = event.request;
  const cache = await caches.open(CACHE);
  const saved = await cache.match(req.url);
  if (saved) {
    if (!fresh.has(req.url)) {
      fresh.add(req.url);
      // no-cache：一定問伺服器「有沒有變」。沒變只回一行（304），不會整個檔重抓
      event.waitUntil(fetch(req.url, { cache: 'no-cache' }).then((r) => (r.ok ? put(cache, req.url, r) : null)).catch(() => null));
    }
    return saved;
  }
  const res = await fetch(req);
  if (res.ok) {
    fresh.add(req.url);
    event.waitUntil(put(cache, req.url, res.clone()).catch(() => null));
  } else if (res.type === 'opaque' && !fresh.has(req.url)) {
    // 測試站（githack）會把圖轉址到別的網域，<img> 拿到的是「看不到內容」的回應，存不了。
    // 背景再用看得到內容的方式抓一次存起來。正式站沒有轉址，走不到這裡。
    fresh.add(req.url);
    event.waitUntil(fetch(req.url).then((r) => (r.ok ? put(cache, req.url, r) : null)).catch(() => null));
  }
  return res;
}

// 頁面第一次開的時候，檔案是在這支程式上工「之前」載的，沒經過它。
// 頁面會把「我剛剛載過哪些檔」傳過來，這裡補存一份（瀏覽器自己還留著，幾乎不花流量）。
async function warm(urls) {
  const cache = await caches.open(CACHE);
  for (const href of urls.slice(0, 400)) {
    try {
      const u = new URL(href);
      if (!mine(u) || isHome(u) || u.pathname.endsWith('/sw.js')) continue;
      if (await cache.match(u.href)) continue;
      const r = await fetch(u.href);
      if (r.ok) await put(cache, u.href, r);
    } catch (_) { /* 抓不到就算了，下次用到再存 */ }
  }
}

self.addEventListener('install', (event) => {
  // 存不成（例如剛好斷線）也讓它裝起來，之後邊用邊存
  event.waitUntil(precache().catch(() => null).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  // 換了 CACHE 名字之後，把舊名字的整包丟掉；然後馬上接手已經開著的頁面
  event.waitUntil(caches.keys()
    .then((names) => Promise.all(names.filter((n) => n.startsWith('sheepfold-') && n !== CACHE).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (!mine(u) || u.pathname.endsWith('/sw.js')) return;
  if (req.mode === 'navigate') {
    if (isHome(u)) event.respondWith(homeFirst(event));
    return;
  }
  event.respondWith(savedThenRefresh(event));
});

self.addEventListener('message', (event) => {
  const d = event.data;
  if (d && d.type === 'warm' && Array.isArray(d.urls)) event.waitUntil(warm(d.urls));
});
