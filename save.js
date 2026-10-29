// 羊圈守夜 · 存檔。整支手機的紀錄放在一份結構裡（版本欄、遷移鏈、匯出匯入），純邏輯、無 DOM，node 測試也能跑。
// 2026-10-30 期 0 之前是十幾個散放的 localStorage key（progress-v3、每關一份 checkpoint、loadout、seen-*、diff、speed、bigtext、lite、sound），
// 第一次開新版會全部搬進 `sheepfold-save`，搬成功才刪舊 key。
// 用法：const SAVE = Save.open(Save.localStore(), { check: Engine.checkSnapshot, diffs: Object.keys(DIFFS) });
//       SAVE.data.progress.cleared …改完叫 SAVE.save()（回傳有沒有真的寫進去）；Save.encode(SAVE.data) 出存檔碼；Save.decode(code, opts) 讀回來
'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Save = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const VERSION = 5;                  // 存檔結構版本。v1 best-v2（只有第一關）、v2 progress-v3、v3 檢查點每關一份：都是舊的散放 key；v4 起單一結構；v5 加 trials（守夜試煉，期 2）
  const KEY = 'sheepfold-save', BAK = KEY + '-bak', BROKEN = KEY + '-broken';
  const CP_RE = /^sheepfold-checkpoint-(\d+)$/;
  const LEGACY = ['sheepfold-progress-v3', 'sheepfold-best-v2', 'sheepfold-checkpoint', 'sheepfold-loadout', 'sheepfold-intro-seen', 'sheepfold-seen-cards', 'sheepfold-seen-enemies', 'sheepfold-tutorial-done', 'sheepfold-diff', 'sheepfold-speed', 'sheepfold-bigtext', 'sheepfold-lite', 'sheepfold-sound'];
  const DIFFS_DEFAULT = ['calm', 'windy', 'storm'];

  const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const strArr = a => (Array.isArray(a) ? a.filter(x => typeof x === 'string') : []);

  const emptyTrials = () => ({ cleared: {}, best: {}, checkpoints: {}, loadouts: {} });
  // 全新一份
  function empty(now) {
    return {
      version: VERSION, created: now, updated: now,
      progress: { cleared: {}, best: {}, stars: {} },   // cleared[夜 id][難度]=true；best['夜:難度']={score,cleared,wave}；stars[夜 id]={noLoss,gates}
      checkpoints: {},                                   // 夜 id → Engine.snapshot()
      loadouts: {},                                      // 夜 id → 帶的卡
      seen: { intro: [], cards: [], enemies: [] },       // 開場頁介紹過的、新卡閃光點過的、弱點提示跳過的
      tutorial: false,
      prefs: { diff: 'calm', speed: 1, big: false, lite: null, sound: { sfx: true, amb: false, vol: 1 }, analytics: true }, // lite null＝沒設過，由電腦是不是軟體繪圖決定
      trials: emptyTrials(),                             // 守夜試煉（v5）：cleared[題 id]=true、best[題 id]={wave,cleared,food}、checkpoints[題 id]=快照、loadouts[題 id]=帶的卡；跟故事模式分開，試煉打到一半不會蓋掉那一夜的檢查點
      announced: '',                                     // 看過哪一版的更新公告
      playerKind: '',                                    // 第一次接統計時：有通關紀錄＝returning、沒有＝new（之後不變）
    };
  }

  // ====== 舊的散放 key → v4 ======
  function fromLegacy(st, now) {
    const d = empty(now); let any = false;
    const raw = k => { const s = st.get(k); if (s === null || s === undefined) return undefined; any = true; return s; };
    const J = k => { const s = raw(k); if (s === undefined) return undefined; try { return JSON.parse(s); } catch (e) { return undefined; } };
    const p = J('sheepfold-progress-v3');
    if (isObj(p)) for (const f of ['cleared', 'best', 'stars']) if (isObj(p[f])) d.progress[f] = p[f];
    const old = J('sheepfold-best-v2'); // v1：只有第一關；progress-v3 自己搬過（migrated）就不重搬
    if (isObj(old) && !(isObj(p) && p.migrated)) for (const k in old) { if (!d.progress.best['1:' + k]) d.progress.best['1:' + k] = old[k]; if (old[k] && old[k].cleared) (d.progress.cleared[1] = d.progress.cleared[1] || {})[k] = true; }
    const cp0 = J('sheepfold-checkpoint'); if (isObj(cp0) && cp0.levelId) d.checkpoints[cp0.levelId] = cp0; // 更舊：只有一份
    for (const k of st.keys()) { const m = CP_RE.exec(k); if (m) { const c = J(k); if (isObj(c)) d.checkpoints[m[1]] = c; } }
    const lo = J('sheepfold-loadout'); if (isObj(lo)) d.loadouts = lo;
    d.seen.intro = strArr(J('sheepfold-intro-seen')); d.seen.cards = strArr(J('sheepfold-seen-cards')); d.seen.enemies = strArr(J('sheepfold-seen-enemies'));
    d.tutorial = raw('sheepfold-tutorial-done') === '1';
    const diff = raw('sheepfold-diff'); if (diff) d.prefs.diff = diff;
    if (Number(raw('sheepfold-speed')) === 2) d.prefs.speed = 2;
    const big = raw('sheepfold-bigtext'); if (big !== undefined) d.prefs.big = big === '1';
    const lite = raw('sheepfold-lite'); if (lite !== undefined) d.prefs.lite = lite === '1';
    const snd = J('sheepfold-sound'); if (isObj(snd)) d.prefs.sound = { sfx: snd.sfx !== false, amb: !!snd.amb, vol: [0, 1, 2].includes(snd.vol) ? snd.vol : 1 };
    return any ? d : null;
  }
  // 舊紀錄併進已有的新檔：進度取聯集（最高紀錄取分數高的）、檢查點／隊伍只補沒有的、看過的介紹取聯集、教學做過就算；設定以新檔為準，除非新檔完全沒玩過
  function mergeLegacy(d, leg) {
    const fresh = !Object.keys(d.progress.cleared).length && !Object.keys(d.progress.best).length;
    for (const id in leg.progress.cleared) d.progress.cleared[id] = Object.assign({}, leg.progress.cleared[id], d.progress.cleared[id] || {});
    for (const k in leg.progress.best) { const a = d.progress.best[k], b = leg.progress.best[k]; if (!a || !(a.score >= b.score)) d.progress.best[k] = b; }
    for (const id in leg.progress.stars) { const a = d.progress.stars[id] || {}, b = leg.progress.stars[id]; d.progress.stars[id] = { noLoss: !!(a.noLoss || b.noLoss), gates: !!(a.gates || b.gates) }; }
    for (const id in leg.checkpoints) if (!d.checkpoints[id]) d.checkpoints[id] = leg.checkpoints[id];
    for (const id in leg.loadouts) if (!d.loadouts[id]) d.loadouts[id] = leg.loadouts[id];
    for (const f of ['intro', 'cards', 'enemies']) for (const x of leg.seen[f]) if (!d.seen[f].includes(x)) d.seen[f].push(x);
    d.tutorial = d.tutorial || leg.tutorial;
    if (fresh) { d.prefs = Object.assign({}, leg.prefs, { analytics: d.prefs.analytics }); d.playerKind = Object.keys(leg.progress.cleared).length ? 'returning' : d.playerKind; }
    return d;
  }
  function removeLegacy(st) {
    for (const k of LEGACY) { try { st.remove(k); } catch (e) {} }
    for (const k of st.keys()) if (CP_RE.test(k)) { try { st.remove(k); } catch (e) {} }
  }

  // ====== 遷移鏈：STEPS[n] 把第 n 版改成第 n+1 版。v4 是第一個單一結構，之後改欄位就在這裡加一步 ======
  const STEPS = {};
  STEPS[4] = d => { if (!isObj(d.trials)) d.trials = emptyTrials(); }; // v4 → v5：多一欄 trials，其餘不動
  function migrate(d) { while (d.version < VERSION && STEPS[d.version]) { STEPS[d.version](d); d.version++; } return d; }

  // ====== 檢查與補齊：缺的欄位補預設、型別不對的丟掉；檢查點交給 opts.check（Engine.checkSnapshot）驗，壞的只丟那一份 ======
  // 回 { data, problems }；整份不能用（不是物件、來自更新版本）時 data 為 null
  function validate(input, opts = {}) {
    const problems = [];
    if (!isObj(input)) return { data: null, problems: ['存檔不是一份紀錄'] };
    if (Number.isFinite(input.version) && input.version > VERSION) return { data: null, problems: [`這份存檔來自更新的版本（v${input.version}），請先更新遊戲再匯入`] };
    const now = typeof opts.now === 'string' ? opts.now : new Date().toISOString();
    const d = empty(now);
    d.version = Number.isFinite(input.version) ? input.version : VERSION;
    if (typeof input.created === 'string') d.created = input.created;
    if (typeof input.updated === 'string') d.updated = input.updated;
    const P = isObj(input.progress) ? input.progress : {};
    if (isObj(P.cleared)) for (const id in P.cleared) if (isObj(P.cleared[id])) { const o = {}; for (const k in P.cleared[id]) if (P.cleared[id][k]) o[k] = true; d.progress.cleared[id] = o; }
    if (isObj(P.best)) for (const k in P.best) { const b = P.best[k]; if (isObj(b) && Number.isFinite(b.score)) d.progress.best[k] = { score: b.score, cleared: !!b.cleared, wave: Number.isFinite(b.wave) ? b.wave : 0 }; }
    if (isObj(P.stars)) for (const id in P.stars) if (isObj(P.stars[id])) d.progress.stars[id] = { noLoss: !!P.stars[id].noLoss, gates: !!P.stars[id].gates };
    if (isObj(input.checkpoints)) for (const id in input.checkpoints) {
      const c = input.checkpoints[id], lid = Number(id);
      if (!isObj(c)) continue;
      if (typeof opts.check === 'function' && !opts.check(c, lid)) { problems.push(`第 ${id} 夜的檢查點讀不出來，已丟掉（那一夜要從頭守）`); continue; }
      d.checkpoints[id] = c;
    }
    if (isObj(input.loadouts)) for (const id in input.loadouts) if (Array.isArray(input.loadouts[id])) d.loadouts[id] = strArr(input.loadouts[id]);
    if (isObj(input.trials)) { // 試煉：壞的檢查點只丟那一份；快照要指到合法的夜（opts.check 用它自己寫的 levelId 驗，是不是這一題的夜由遊戲開局時再對）
      const T = input.trials;
      if (isObj(T.cleared)) for (const id in T.cleared) if (T.cleared[id]) d.trials.cleared[id] = true;
      if (isObj(T.best)) for (const id in T.best) { const b = T.best[id]; if (isObj(b) && Number.isFinite(b.wave)) d.trials.best[id] = { wave: b.wave, cleared: !!b.cleared, ...(Number.isFinite(b.food) ? { food: b.food } : {}) }; }
      if (isObj(T.checkpoints)) for (const id in T.checkpoints) {
        const c = T.checkpoints[id];
        if (!isObj(c) || !Number.isInteger(c.levelId)) continue;
        if (typeof opts.check === 'function' && !opts.check(c, c.levelId)) { problems.push(`試煉 ${id} 的檢查點讀不出來，已丟掉（那一題要從頭打）`); continue; }
        d.trials.checkpoints[id] = c;
      }
      if (isObj(T.loadouts)) for (const id in T.loadouts) if (Array.isArray(T.loadouts[id])) d.trials.loadouts[id] = strArr(T.loadouts[id]);
    }
    if (isObj(input.seen)) for (const f of ['intro', 'cards', 'enemies']) d.seen[f] = strArr(input.seen[f]);
    d.tutorial = !!input.tutorial;
    const pr = isObj(input.prefs) ? input.prefs : {}, diffs = Array.isArray(opts.diffs) ? opts.diffs : DIFFS_DEFAULT;
    if (diffs.includes(pr.diff)) d.prefs.diff = pr.diff;
    if (pr.speed === 2) d.prefs.speed = 2;
    d.prefs.big = !!pr.big;
    d.prefs.lite = typeof pr.lite === 'boolean' ? pr.lite : null;
    if (isObj(pr.sound)) d.prefs.sound = { sfx: pr.sound.sfx !== false, amb: !!pr.sound.amb, vol: [0, 1, 2].includes(pr.sound.vol) ? pr.sound.vol : 1 };
    d.prefs.analytics = pr.analytics !== false;
    if (typeof input.announced === 'string') d.announced = input.announced;
    if (input.playerKind === 'new' || input.playerKind === 'returning') d.playerKind = input.playerKind;
    return { data: migrate(d), problems };
  }
  function parse(text, opts) {
    let obj; try { obj = JSON.parse(text); } catch (e) { return { data: null, problems: ['存檔不是正確的格式'] }; }
    return validate(obj, opts);
  }

  // ====== 開檔：主檔 → 壞了試備份 → 沒有主檔就搬舊 key → 都沒有就全新 ======
  // 回 { data, status, problems, save() }。status：ok／restored（備份接回）／broken（主檔壞、備份也沒救）／migrated（從舊 key 搬來）／fresh（全新）
  function open(st, opts = {}) {
    const now = typeof opts.now === 'string' ? opts.now : new Date().toISOString();
    const nowFn = typeof opts.nowFn === 'function' ? opts.nowFn : () => new Date().toISOString();
    let raw = null; try { raw = st.get(KEY); } catch (e) { raw = null; }
    let d = null, status = 'fresh', problems = [], bumped = false;
    if (raw !== null && raw !== undefined) {
      // 存檔來自更新的版本（這支瀏覽器快取到舊版遊戲）：不碰它、不寫任何東西，這一次當作唯讀的全新局（code review 10/30）
      let peek = null; try { peek = JSON.parse(raw); } catch (e) {}
      if (isObj(peek) && Number.isFinite(peek.version) && peek.version > VERSION) {
        const api = { data: empty(now), status: 'newer', problems: [`這支手機的存檔來自更新的版本（v${peek.version}），這個版本的遊戲讀不懂；請重新整理拿新版，這次玩的不會存`], KEY, save: () => false, replace: () => false };
        return api;
      }
      const r = parse(raw, opts);
      if (r.data) { d = r.data; status = 'ok'; problems = r.problems; bumped = isObj(peek) && Number.isFinite(peek.version) && peek.version < VERSION; } // 舊版結構：讀進來就升好，等一下寫回去
      else {
        try { st.set(BROKEN, raw); } catch (e) {} // 原文留著，之後還有機會救
        let bak = null; try { bak = st.get(BAK); } catch (e) {}
        const rb = bak ? parse(bak, opts) : null;
        if (rb && rb.data) { d = rb.data; status = 'restored'; problems = ['上次的紀錄讀不出來，已用前一次開遊戲時的備份接回來（最近一兩夜的紀錄可能不見）', ...rb.problems]; }
        else { status = 'broken'; problems = ['上次的紀錄讀不出來，備份也沒有，只好從頭開始；原本那份留在這支手機裡沒刪', ...r.problems]; }
      }
    } else {
      try { d = fromLegacy(st, now); } catch (e) { d = null; }
      if (d) { const r = validate(d, opts); d = r.data; problems = r.problems; status = 'migrated'; }
    }
    if (!d) d = empty(now);
    // 主檔已經有了、但舊 key 還在（例：第一次開到的是快取裡的舊版遊戲，它寫了一份空的新檔，之後就沒人去搬舊紀錄——10/30 James 真機）：把舊紀錄併進來，併成功才刪舊 key
    if (status === 'ok' || status === 'restored') {
      let leg = null; try { leg = fromLegacy(st, now); } catch (e) { leg = null; }
      if (leg) { const r = validate(leg, opts); if (r.data) { mergeLegacy(d, r.data); problems = [...problems, ...r.problems, '找回了這支手機原本的紀錄，已併進新存檔']; status = 'migrated'; } }
    }
    const api = { data: d, status, problems, KEY };
    api.save = function () {
      try { d.updated = nowFn(); const text = JSON.stringify(d); st.set(KEY, text); return st.get(KEY) === text; }
      catch (e) { return false; }
    };
    // 另存成一份給別支手機（整份覆蓋）；寫完讀回對一次
    api.replace = function (data) {
      const r = validate(data, opts); if (!r.data) return false;
      const before = JSON.stringify(d);
      try { st.set(KEY + '-before-import', before); } catch (e) {} // 匯入前那份另外留一份，匯錯了還救得回來
      Object.keys(d).forEach(k => delete d[k]); Object.assign(d, r.data);
      if (api.save()) return true;
      Object.keys(d).forEach(k => delete d[k]); Object.assign(d, JSON.parse(before)); // 寫不進去：記憶體也退回去，不然下一次 save 會把沒匯成的資料帶進去
      return false;
    };
    if (status === 'migrated') { if (api.save()) removeLegacy(st); }            // 搬成功才刪舊 key
    else if (status === 'restored' || status === 'broken' || bumped) api.save(); // 接回、從頭、或結構升了版：立刻寫回主檔
    if (status === 'ok' || status === 'restored') { try { st.set(BAK, JSON.stringify(d)); } catch (e) {} } // 每次開頁抄一份「上次好的」當備份，不是每次寫都抄
    return api;
  }

  // ====== 存檔碼：SF4.<base64url(JSON)>.<FNV-1a 8 碼>。純 ASCII，貼來貼去不會被改字；校驗碼擋少字、改字 ======
  function utf8ToB64(s) {
    if (typeof TextEncoder !== 'undefined' && typeof btoa === 'function') { const b = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]); return btoa(bin); }
    return Buffer.from(s, 'utf8').toString('base64');
  }
  function b64ToUtf8(b64) {
    if (typeof TextDecoder !== 'undefined' && typeof atob === 'function') { const bin = atob(b64); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return new TextDecoder().decode(b); }
    return Buffer.from(b64, 'base64').toString('utf8');
  }
  const toUrl = s => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const fromUrl = s => { const t = s.replace(/-/g, '+').replace(/_/g, '/'); return t + '='.repeat((4 - t.length % 4) % 4); };
  function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }
  function encode(d) { const body = toUrl(utf8ToB64(JSON.stringify(d))); return `SF${VERSION}.${body}.${fnv(body)}`; }
  // 回 { data, problems } 或 { error }
  function decode(code, opts = {}) {
    const s = String(code || '').replace(/\s+/g, '');
    const m = /^SF(\d+)\.([A-Za-z0-9_-]+)\.([0-9a-f]{8})$/.exec(s);
    if (!m) return { error: s ? '這不是羊圈守夜的存檔碼（開頭應該是 SF）' : '還沒貼上存檔碼' };
    if (Number(m[1]) > VERSION) return { error: `這份存檔來自更新的版本（v${m[1]}），請先更新遊戲再匯入` };
    if (fnv(m[2]) !== m[3]) return { error: '存檔碼少了字或被改過，請重新複製整段' };
    let text; try { text = b64ToUtf8(fromUrl(m[2])); } catch (e) { return { error: '存檔碼解不開' }; }
    const r = parse(text, opts);
    if (!r.data) return { error: r.problems[0] || '存檔碼解不開' };
    return r;
  }
  // 給匯入前的預覽：守過幾夜、幾份檢查點、過了幾題試煉、最後更新
  function summary(d) {
    const nights = Object.keys(d.progress.cleared).filter(id => Object.keys(d.progress.cleared[id]).length).length;
    const t = isObj(d.trials) ? d.trials : emptyTrials();
    return { nights, checkpoints: Object.keys(d.checkpoints).length, trials: Object.keys(t.cleared || {}).length, trialCheckpoints: Object.keys(t.checkpoints || {}).length, updated: d.updated, created: d.created };
  }

  // ====== 儲存介面：瀏覽器 localStorage；測試用記憶體版 ======
  function localStore() {
    const ls = () => globalThis.localStorage; // 工廠函式裡沒有 root，用 globalThis（10/30 真機抓到：舊 key 一個都沒搬，因為這裡丟了 ReferenceError 被 open 吞掉）
    return { get: k => ls().getItem(k), set: (k, v) => ls().setItem(k, v), remove: k => ls().removeItem(k), keys: () => { const a = []; for (let i = 0; i < ls().length; i++) a.push(ls().key(i)); return a; } };
  }
  function memoryStore(init = {}) {
    const m = new Map(Object.entries(init));
    return { get: k => (m.has(k) ? m.get(k) : null), set: (k, v) => { m.set(k, String(v)); }, remove: k => { m.delete(k); }, keys: () => [...m.keys()], _map: m };
  }

  return { VERSION, KEY, BAK, BROKEN, LEGACY, empty, fromLegacy, migrate, validate, open, encode, decode, summary, localStore, memoryStore };
});
