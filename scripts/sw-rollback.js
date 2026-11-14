// 退路程式（2026-11-14 備著，平常用不到）
//
// 白話：萬一 sw.js 出事（例如玩家一直拿到舊版、或開不起來），用這支把它拆掉。
// 用法：把這支檔的內容整個蓋到根目錄的 sw.js，推上正式站。
//       玩家下次開頁，瀏覽器會發現 sw.js 變了、換上這支；它一上工就清掉存的檔、把自己拆掉。
//       再下一次開頁，就回到「沒有 sw.js」的狀態，檔案全部直接跟伺服器拿。
//       index.html 結尾註冊 sw.js 的那一段可以同時拿掉；沒拿掉也不會壞，只是每次開頁白裝白拆一次。
//
// 這支故意不攔任何請求，也不叫頁面重新整理（叫了會跟註冊那段打轉、頁面一直重整）。

self.addEventListener('install', function () { self.skipWaiting(); });

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys()
    .then(function (names) {
      return Promise.all(names.filter(function (n) { return n.indexOf('sheepfold-') === 0; }).map(function (n) { return caches.delete(n); }));
    })
    .then(function () { return self.registration.unregister(); }));
});
