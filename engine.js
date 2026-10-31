// 羊圈守夜 · 引擎。純邏輯、不碰畫面，Node 可以直接跑來模擬。
// 用法：const G = Engine.create(levelId, diffKey, rng); Engine.place(G, r, c, key); Engine.step(G, dt)
// 每一步會把要畫的事放進 G.events（toast／pop／callout／fx／unit／win／lose），畫面層讀完就清掉。
'use strict';
(function (root) {
  const D = (typeof module !== 'undefined') ? require('./data.js') : root.DATA;
  const { ROWS, COLS, UNITS, ENEMIES, STATUS, DIFFS, LEVELS, ELDER_MUL, ELDER_COST, REPAIR_COST, REPAIR_HP, REPAIR_CD, MAX_CARDS, MIN_CARDS, SELL_RATE, SWAP_KINDS, PICK_ORDER, PREP_TIME, WAVE_REST, FORESHADOW_LEAD, START_FOOD, TRICKLE } = D;

  const STRAY = D.STRAY; // 迷羊（第二章的中立角色）
  const SHOT_SPEED = { stone: 6, arrow: 9, sling: 7 };
  const THICK_MUL = D.THICK_MUL ?? 0.35; // 厚皮敵人吃石子、箭的比例（正本在 data.js）
  const LOB_TIME = 0.8;
  const VAULT_TIME = 1.2; // 賊翻牆要幾秒：這段時間牠連續越過牆，畫面層用 lift 畫弧線
  const HILL_SLOW = D.HILL_SLOW ?? 0.85; // 第三章：地面敵人在坡下走得慢的倍數（野牛 heavy 例外）

  // ====== 第三章：山坡 ======
  // level.hill＝坡從第幾格起（程式欄號，第三章是 4：右邊三格是下坡）。沒設就沒有坡，前兩章完全不受影響
  const hillOf = G => (G.level.hill === undefined || G.level.hill === null ? null : G.level.hill);
  const onHillCell = (G, c) => { const h = hillOf(G); return h !== null && c >= h; }; // 這一格在坡上
  // 這隻敵人站在坡下：身體已經過了坡頂那條線（HILL_EDGE，正本在 data.js）。剛掉進坡頂陷坑的（x≈hill）算卡在坡緣，坡上的射手打得到；咬坡上第一格牆的站 x≈hill+0.6，打不到。走路減速也用這條線
  const HILL_EDGE = D.HILL_EDGE ?? 0.3;
  const downhill = (G, e) => { const h = hillOf(G); return h !== null && e.x > h + HILL_EDGE; };
  const hillCells = G => COLS - hillOf(G); // 坡上有幾格（文案用）
  // 這一排有沒有還站著的守望樓（高的牆）：有的話大鷹在這排飛不高（James 2026-10-24 拍板：守望樓兼職剋大鷹）
  function rowHasTall(G, r) { for (const k in G.units) { const u = G.units[k]; if (u.r === r && u.hp > 0 && UNITS[u.type].tall) return true; } return false; }
  // 升級後的欄位蓋過原本的（投石機→巧匠的機器、荊棘→蠍窩、纏裹的牧人→膏油共用這一條）
  const effOf = (u, def) => (u.upgraded && def.upgrade ? { ...def, ...def.upgrade } : def);

  // 牧人送糧間隔：暴風夜拉長，但後面的關卡一樣打折
  function shepherdEvery(G) { const sc = G.level.shepherdScale ?? G.level.diffScale ?? 0.6; return UNITS.shepherd.every + (DIFFS[G.diff].shepherdEvery - UNITS.shepherd.every) * sc; } // shepherdScale：只調產糧的折扣（歌珊的夜）

  function levelById(id) { return LEVELS.find(l => l.id === id) || LEVELS[0]; }
  // 這一夜、這個難度哪幾排門口有看門的：關卡 gates: false 一律沒有；否則看難度表（2026-10-20：寧靜五、起風三、暴風二），難度表沒寫就五位都在
  // 關卡 gates 若是陣列（修飾詞指定哪幾排）就照它、不看難度
  function gateRows(level, diffKey) { if (level.gates === false) return []; if (Array.isArray(level.gates)) return level.gates.slice(); const d = DIFFS[diffKey]; return (d && Array.isArray(d.gates) ? d.gates : Array.from({ length: ROWS }, (_, r) => r)).slice(); }
  const idxOf = id => LEVELS.findIndex(l => l.id === id); // 這一夜在 LEVELS 裡的位置（0 起算；找不到 -1）
  const STRAY_LEAD = 3;                                   // 迷羊進場前幾秒先印 🐑 腳印（跟敵人腳印一樣提前量）
  const restOf = G => G.level.rest ?? WAVE_REST;          // 波間休息秒數，關卡可覆寫（第二章「交託的羊」只歇 3 秒）
  // 升級開放夜：data.js 寫 fromId（在哪一夜學會），這裡換算成 from（那一夜的顯示編號＝位置），卡片說明的 {from} 一併填入。只做一次
  for (const u of Object.values(UNITS)) if (u.upgrade && u.upgrade.fromId && u.upgrade.from === undefined) {
    u.upgrade.from = posOf(u.upgrade.fromId);
    if (!u.upgrade.from) { console.error(`${u.name} 的升級 fromId ${u.upgrade.fromId} 不是任何一夜的 id`); u.upgrade.from = 999; } // 打錯 id 寧可永遠學不會，也不要第 1 夜就全開
    u.desc = u.desc.replace('{from}', u.upgrade.from);
  }
  // 場上某種單位有幾個（maxUnits 上限用；畫面層壓暗卡片也用這條）
  function countUnits(G, k) { let n = 0; for (const key in G.units) if (G.units[key].type === k) n++; return n; }
  // 夜的「顯示編號」＝在 LEVELS 裡的位置（1 起算）。id 永遠不動、只當存檔的 key；中途插新夜時顯示編號會變、id 不變
  function posOf(id) { const i = idxOf(id); return i < 0 ? 0 : i + 1; }
  function nextOf(id) { const i = idxOf(id); return i < 0 ? null : LEVELS[i + 1] || null; }
  // 解鎖規則：第一夜、本夜已守過、前一夜已守過、或任何更後面的夜已守過。
  // 最後一條是給老玩家的：他已經破到第二章，後來插進第一章的新夜不能把他擋在門外；「本夜已守過」則是最後一夜前面變成新夜、後面又沒有夜時的保險
  function isUnlocked(cleared, id) {
    const i = idxOf(id); if (i < 0) return false;
    if (i === 0 || (cleared && cleared[id])) return true;
    if (cleared && cleared[LEVELS[i - 1].id]) return true;
    return LEVELS.slice(i + 1).some(l => !!(cleared && cleared[l.id]));
  }

  // ====== 守夜試煉（期 2）：題目在 data.js TRIALS；解鎖＝那一夜所在的章守過最後一夜（任一難度，不看星）======
  const TRIALS = D.TRIALS;
  const chapterOf = L => L.chapter || 1;
  function trialById(id) { return TRIALS.find(t => t.id === id) || null; }
  // 這一題要守過哪一夜才開：就是題目取材的那一夜（新期 2：該夜暴風夜三星，守望與烈火同時開）；題目指到不存在的夜就回 null（鎖著，不讓畫面炸）
  function trialGate(trial) {
    if (!trial) return null;
    return LEVELS.find(l => l.id === trial.levelId) || null;
  }
  // 暴風夜守過，而且那一夜的星全拿（星不分難度、整夜一份：noLoss 零損失＋gates 看門的都在；沒看門的夜只有兩顆）
  // progress ＝ 存檔的 progress（{ cleared, stars }）；只給 cleared 的舊呼叫法當作沒有星
  function isTrialUnlocked(progress, trial) {
    const gate = trialGate(trial); if (!gate || !progress) return false;
    const cleared = progress.cleared || progress, st = (progress.stars && progress.stars[gate.id]) || {};
    if (!(cleared[gate.id] && cleared[gate.id].storm)) return false;
    return !!(st.noLoss && (st.gates || starSlots(gate) === 2));
  }
  // 到這一夜為止（含這一夜）故事裡出現過的敵人種類：守望／烈火只准用這些（James 10/31：不把後面的敵人提前）
  function enemiesSeenBy(levelId) {
    const i = idxOf(levelId), seen = new Set();
    for (let j = 0; j <= i; j++) for (const w of LEVELS[j].waves) for (const [t] of w.list) seen.add(t);
    return seen;
  }
  // 這一題實際打的那一夜（套好修飾詞的關卡物件；id 跟原夜一樣，存檔要用 trial.id 另開一格）
  function trialLevel(trial) { const base = levelById(trial.levelId); return applyMods(base, normalizeMods(base, trial.mods).mods); }
  // 「今日推薦一題」：日期取模，不隨機。只在已開的題裡輪（審查 10/29：推薦一題鎖著的沒有用）；一題都沒開就回 null
  function dailyTrial(now = new Date(), progress = null) {
    const pool = TRIALS.filter(t => isTrialUnlocked(progress, t)); if (!pool.length) return null;
    const day = Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
    return pool[((day % pool.length) + pool.length) % pool.length];
  }
  function validateTrials() {
    const bad = [], seen = new Set();
    for (const t of TRIALS) {
      if (!t.id || seen.has(t.id)) bad.push(`試煉 ${t.id} 的 id 重複或沒有`); seen.add(t.id);
      if (!LEVELS.some(l => l.id === t.levelId)) { bad.push(`試煉 ${t.id} 指到不存在的夜 ${t.levelId}`); continue; }
      if (!DIFFS[t.diff]) bad.push(`試煉 ${t.id} 的難度 ${t.diff} 不認識`);
      if (!D.TRIAL_KINDS[t.kind]) bad.push(`試煉 ${t.id} 的口味 ${t.kind} 不認識`);
      for (const p of checkMods(t.levelId, t.mods)) bad.push(`試煉 ${t.id}：${p}`);
      // 新期 2 的規矩（James 10/31）：守望 w<夜 id>、烈火 f<夜 id>；都沒看門的、有羊的夜失一隻即輸；敵人與卡只用到那一夜為止見過的；守望波數同原夜、烈火就一大波＋一筆糧＋限卡
      const base = levelById(t.levelId), m = normalizeMods(base, t.mods).mods || {}, pre = { watch: 'w', fire: 'f' }[t.kind];
      if (pre && t.id !== pre + t.levelId) bad.push(`試煉 ${t.id} 的 id 要是 ${pre}${t.levelId}`);
      if (!(m.gates && m.gates.length === 0)) bad.push(`試煉 ${t.id} 要用 gates: 0 關掉看門的`);
      if (base.sheep && m.maxSheepLost !== 0) bad.push(`試煉 ${t.id} 的夜有羊，要寫 maxSheepLost: 0`);
      if (m.units) for (const k of m.units) if (!base.units.includes(k)) bad.push(`試煉 ${t.id} 的卡 ${k} 那一夜還沒學`);
      if (!m.waveOverride) bad.push(`試煉 ${t.id} 要自帶波表 waveOverride`);
      else {
        const seen = enemiesSeenBy(t.levelId);
        for (const w of m.waveOverride) for (const [k] of w.list) if (!seen.has(k)) bad.push(`試煉 ${t.id} 的敵人 ${k} 到那一夜還沒出現過`);
        if (t.kind === 'watch' && m.waveOverride.length !== base.waves.length) bad.push(`守望 ${t.id} 的波數要跟原夜一樣（${base.waves.length} 波）`);
        if (t.kind === 'fire' && m.waveOverride.length !== 1) bad.push(`烈火 ${t.id} 只能一波`);
      }
      if (t.kind === 'fire' && !(m.oneBudget === true && m.startFood !== undefined && m.units)) bad.push(`烈火 ${t.id} 要 oneBudget: true、startFood、units 三樣齊`);
      if (t.kind === 'watch' && m.oneBudget) bad.push(`守望 ${t.id} 不用一筆糧`);
    }
    return bad;
  }

  // ====== 點兵 ======
  // 這一關卡太多時預設帶哪幾張：牧人、新開的卡、關卡指定的 must 一定帶，其餘照 PICK_ORDER 補到上限
  function defaultPick(level) {
    const p = level.units.includes('shepherd') ? ['shepherd'] : []; // 一筆糧的夜（第 25 夜）沒有牧人這張卡
    for (const k of [...level.fresh, ...(level.must || [])]) if (!p.includes(k) && level.units.includes(k)) p.push(k);
    for (const k of PICK_ORDER) if (p.length < MAX_CARDS && level.units.includes(k) && !p.includes(k)) p.push(k);
    return p;
  }
  // 存起來的名單還能不能用（關卡改過卡、少了牧人、太少、太多、重複都不算）
  function validPick(level, s) {
    return Array.isArray(s) && s.length >= MIN_CARDS && s.length <= MAX_CARDS && new Set(s).size === s.length && (s.includes('shepherd') || !level.units.includes('shepherd')) && s.every(k => level.units.includes(k));
  }
  // 讓這一局只用名單上的卡
  function applyPick(G, keys) { G.level = { ...G.level, units: keys, fresh: G.level.fresh.filter(k => keys.includes(k)) }; }

  // ====== 修飾詞（期 1，2026-10-29）：建局時套在關卡上的一層，試煉冊、今日推薦、模擬器都用這一條 ======
  // 六個欄位，沒寫的就照關卡原樣：
  //   units      可用卡白名單（任何卡都行，不限這一夜原本開的；順序＝卡片順序；fresh／must 只留名單上的）
  //   startFood  開局糧，寫多少就多少（不乘一筆糧的 budgetMul）
  //   gates      看門的：數字 0–5（照 GATE_SETS 挑排）或排號陣列；0／[] 等於關掉
  //   waves      只打前幾波（1 到這一夜的波數）
  //   conveyor   true＝送卡模式（沒有糧、卡定時送；預設 7 秒一張、手上最多 6 張、開局隨機 3 張、權重均等）、物件＝自己給 every／max／start／weights、false＝關掉這一夜的送卡
  //   oneBudget  true＝一筆糧（糧不滴、沒有牧人）、false＝關掉這一夜的一筆糧
  // 新期 2（2026-10-31，守望／烈火試煉）再加兩個：
  //   waveOverride 自帶波表（陣列，格式跟關卡 waves 一樣：list／gap／rows／hpMul／ordered／say／hint）。寫的是最終數字：套了這個，難度倍率不再乘（diffScale 0），作者寫幾隻就幾隻
  //   maxSheepLost 最多能失幾隻羊，超過就輸（0＝失一隻即輸；只有有羊的夜有意義，沒羊的夜寫了沒作用）
  // normalizeMods 把它整理成固定形狀（鍵固定順序、值已驗過），壞的欄位丟掉並寫進 problems；整理後的那份存進 G.mods 與檢查點，續玩時必須一模一樣
  const GATE_SETS = { 0: [], 1: [2], 2: [1, 3], 3: [1, 2, 3], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4] };
  const isCard = k => typeof k === 'string' && Object.prototype.hasOwnProperty.call(UNITS, k); // 不能用 UNITS[k] 真假判斷：'constructor' 這種原型鏈上的名字會混進來
  const isCardList = a => Array.isArray(a) && a.length > 0 && a.every(k => typeof k === 'string');
  function normalizeMods(level, mods) {
    const out = {}, problems = [], notes = [];
    if (mods === undefined || mods === null) return { mods: null, problems, notes };
    if (typeof mods !== 'object' || Array.isArray(mods)) return { mods: null, problems: ['修飾詞要是物件'], notes };
    for (const k of Object.keys(mods)) if (!['units', 'startFood', 'gates', 'waves', 'conveyor', 'oneBudget', 'waveOverride', 'maxSheepLost'].includes(k)) problems.push(`不認識的修飾詞 ${k}，略過`);
    if (mods.units !== undefined) {
      if (!isCardList(mods.units)) problems.push('units 要是卡片名稱的陣列，略過');
      else {
        const seen = new Set(), list = [];
        const noHill = level.hill === undefined || level.hill === null;
        for (const k of mods.units) { if (!isCard(k)) problems.push(`units 裡有不認識的卡 ${k}，略過`); else if (UNITS[k].hillOnly && noHill) problems.push(`${UNITS[k].name}只能放坡上，這一夜沒有坡，略過`); else if (!seen.has(k)) { seen.add(k); list.push(k); } }
        if (list.length) out.units = list; else problems.push('units 沒有任何可用的卡，略過');
      }
    }
    if (mods.startFood !== undefined) {
      if (Number.isFinite(mods.startFood) && mods.startFood >= 0 && mods.startFood <= 99999) out.startFood = Math.floor(mods.startFood);
      else problems.push('startFood 要是 0 到 99999 的數字，略過');
    }
    if (mods.gates !== undefined) {
      const g = mods.gates === false ? 0 : mods.gates;
      if (Number.isInteger(g) && GATE_SETS[g]) out.gates = GATE_SETS[g].slice();
      else if (Array.isArray(g) && g.every(r => Number.isInteger(r) && r >= 0 && r < ROWS) && new Set(g).size === g.length) out.gates = g.slice().sort((a, b) => a - b);
      else problems.push('gates 要是 0 到 5 的數字或不重複的排號陣列，略過');
    }
    if (mods.waves !== undefined) {
      if (Number.isInteger(mods.waves) && mods.waves >= 1 && mods.waves <= level.waves.length) out.waves = mods.waves;
      else problems.push(`waves 要是 1 到 ${level.waves.length} 的整數，略過`);
    }
    if (mods.conveyor !== undefined) {
      const cv = mods.conveyor;
      if (cv === false || cv === true) out.conveyor = cv;
      else if (cv && typeof cv === 'object' && !Array.isArray(cv)) {
        const c = {}; let bad = false;
        if (cv.every !== undefined) { if (Number.isFinite(cv.every) && cv.every > 0 && cv.every <= 60) c.every = cv.every; else bad = true; }
        if (cv.max !== undefined) { if (Number.isInteger(cv.max) && cv.max >= 1 && cv.max <= 12) c.max = cv.max; else bad = true; }
        if (cv.start !== undefined) { if ((Number.isInteger(cv.start) && cv.start >= 0 && cv.start <= 12) || (Array.isArray(cv.start) && cv.start.every(isCard))) c.start = Array.isArray(cv.start) ? cv.start.slice() : cv.start; else bad = true; }
        if (cv.weights !== undefined) { // 鍵照字母排，同一張表不同寫法才會是同一組（sameMods 比字串）
          if (cv.weights && typeof cv.weights === 'object' && !Array.isArray(cv.weights) && Object.entries(cv.weights).every(([k, w]) => isCard(k) && Number.isFinite(w) && w > 0)) { c.weights = {}; for (const k of Object.keys(cv.weights).sort()) c.weights[k] = cv.weights[k]; }
          else bad = true;
        }
        if (bad) problems.push('conveyor 的 every／max／start／weights 有不合規的值，整個略過'); else out.conveyor = c;
      } else problems.push('conveyor 要是 true／false 或設定物件，略過');
    }
    if (mods.oneBudget !== undefined) {
      if (typeof mods.oneBudget === 'boolean') out.oneBudget = mods.oneBudget; else problems.push('oneBudget 要是 true／false，略過');
    }
    if (mods.waveOverride !== undefined) { // 自帶波表：逐波驗，一波壞整個略過（半套波表比沒有更糟）
      const W = mods.waveOverride, isEnemy = k => typeof k === 'string' && Object.prototype.hasOwnProperty.call(ENEMIES, k);
      const okWave = w => w && typeof w === 'object' && !Array.isArray(w)
        && Array.isArray(w.list) && w.list.length > 0 && w.list.every(x => Array.isArray(x) && x.length === 2 && isEnemy(x[0]) && Number.isInteger(x[1]) && x[1] >= 1 && x[1] <= 99)
        && Number.isFinite(w.gap) && w.gap >= 0.1 && w.gap <= 60
        && Array.isArray(w.rows) && w.rows.length > 0 && w.rows.every(r => Number.isInteger(r) && r >= 0 && r < ROWS) && new Set(w.rows).size === w.rows.length
        && (w.hpMul === undefined || (Number.isFinite(w.hpMul) && w.hpMul > 0 && w.hpMul <= 20))
        && (w.ordered === undefined || typeof w.ordered === 'boolean')
        && (w.say === undefined || typeof w.say === 'string') && (w.hint === undefined || typeof w.hint === 'string');
      if (!Array.isArray(W) || !W.length || W.length > 12 || !W.every(okWave)) problems.push('waveOverride 要是 1 到 12 波的陣列，每波 list／gap／rows 合規（hpMul／ordered／say／hint 可不給），略過');
      else {
        out.waveOverride = W.map(w => { const o = { list: w.list.map(x => [x[0], x[1]]), gap: w.gap, rows: w.rows.slice().sort((a, b) => a - b), hpMul: w.hpMul === undefined ? 1 : w.hpMul }; if (w.ordered) o.ordered = true; if (w.say) o.say = w.say; if (w.hint) o.hint = w.hint; return o; });
        if (out.waves !== undefined) { delete out.waves; problems.push('有 waveOverride 就不用 waves（波數就是自帶波表的長度），waves 略過'); }
      }
    }
    if (mods.maxSheepLost !== undefined) {
      if (Number.isInteger(mods.maxSheepLost) && mods.maxSheepLost >= 0 && mods.maxSheepLost <= 99) out.maxSheepLost = mods.maxSheepLost;
      else problems.push('maxSheepLost 要是 0 到 99 的整數，略過');
      if (out.maxSheepLost !== undefined && !level.sheep) notes.push('這一夜沒有羊，maxSheepLost 沒作用');
    }
    // 互相打架的組合只提醒（notes），欄位照留：送卡模式沒有糧，一筆糧與開局糧都沒意義
    const cvOn = out.conveyor === undefined ? !!level.conveyor : out.conveyor !== false;
    if (cvOn && out.oneBudget === true) notes.push('送卡模式沒有糧，oneBudget 沒作用');
    if (cvOn && out.startFood !== undefined) notes.push('送卡模式沒有糧，startFood 沒作用');
    const budget = out.oneBudget === undefined ? !!level.noTrickle : out.oneBudget;
    if (!cvOn && budget && out.startFood === undefined && !level.noTrickle) notes.push(`一筆糧的夜糧不會再來，建議給 startFood（現在只有 ${level.startFood ?? START_FOOD}）`);
    if (out.oneBudget === false && level.noTrickle && !(out.units || []).includes('shepherd')) notes.push('關掉一筆糧後這一夜還是沒有牧人這張卡，要用 units 補');
    // 送卡夜與一筆糧的夜都沒有牧人的事：白名單只剩牧人就等於沒有卡
    if (out.units && (cvOn || budget) && !out.units.some(k => k !== 'shepherd')) { problems.push('白名單拿掉牧人後沒有卡（送卡夜與一筆糧的夜用不到牧人），units 略過'); delete out.units; }
    // 送卡的權重表要跟白名單有交集，不然一張都抽不到（第 11 夜自己的權重表也算）
    if (cvOn && out.conveyor !== false) {
      const w = (out.conveyor && out.conveyor.weights) || (level.conveyor && level.conveyor.weights);
      const u = out.units || level.units;
      if (w && !Object.keys(w).some(k => u.includes(k) && k !== 'shepherd')) notes.push('送卡權重表跟白名單沒有交集，改成白名單均等抽');
    }
    return { mods: Object.keys(out).length ? out : null, problems, notes };
  }
  // 關卡的卡表只留 allow 說可以的（units／fresh／must 三欄一起）
  const restrict = (L, allow) => ({ ...L, units: L.units.filter(allow), fresh: (L.fresh || []).filter(allow), must: (L.must || []).filter(allow) });
  // 把整理好的修飾詞套到關卡上，回傳新的關卡物件（原關卡不動）
  function applyMods(level, m) {
    if (!m) return level;
    let L = { ...level };
    if (m.units) L = { ...L, units: m.units.slice(), fresh: (level.fresh || []).filter(k => m.units.includes(k)), must: (level.must || []).filter(k => m.units.includes(k)) };
    if (m.startFood !== undefined) L.startFood = m.startFood;
    if (m.gates !== undefined) L.gates = m.gates.length ? m.gates.slice() : false;
    if (m.waves !== undefined) L.waves = level.waves.slice(0, m.waves);
    if (m.waveOverride) { // 自帶波表寫的是最終數字，難度倍率不再乘；但牧人產糧的難度折扣照原夜（shepherdEvery 也讀 diffScale，code-review 10/31 抓到）
      L.waves = m.waveOverride.map(w => ({ ...w, list: w.list.map(x => [...x]), rows: w.rows.slice() }));
      L.shepherdScale = level.shepherdScale ?? level.diffScale ?? 0.6; L.diffScale = 0;
    }
    if (m.maxSheepLost !== undefined) L.maxSheepLost = m.maxSheepLost;
    if (m.conveyor === false) delete L.conveyor;
    else if (m.conveyor) {
      L = restrict(L, k => k !== 'shepherd'); // 送卡夜沒有糧，牧人沒事做
      const cv = m.conveyor === true ? { ...(level.conveyor || {}) } : { ...(level.conveyor || {}), ...m.conveyor };
      if (cv.every === undefined) cv.every = 7; if (cv.max === undefined) cv.max = 6; // 跟第 11 夜一樣的節奏
      L.conveyor = cv;
    }
    if (L.conveyor) { // 權重表只留白名單上的（第 11 夜自己的表也一樣）；沒給或沒交集就白名單均等抽
      const w = {}; for (const k of Object.keys(L.conveyor.weights || {})) if (L.units.includes(k)) w[k] = L.conveyor.weights[k];
      if (!Object.keys(w).length) for (const k of L.units) w[k] = 1;
      L.conveyor = { ...L.conveyor, weights: w };
    }
    if (m.oneBudget === true && !L.conveyor) { L = restrict(L, k => k !== 'shepherd'); L.noTrickle = true; L.noShepherd = true; }
    else if (m.oneBudget === false) { delete L.noTrickle; delete L.noShepherd; if (m.startFood === undefined) delete L.startFood; } // 一筆糧關掉，那一夜為一筆糧配的大額開局糧也不算，回到預設
    return L;
  }
  function checkMods(levelId, mods) { const nm = normalizeMods(levelById(levelId), mods); return [...nm.problems, ...nm.notes]; } // 給試煉作者與測試用：空陣列＝乾淨
  const sameMods = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null); // normalizeMods 的鍵順序固定，字串相等就是同一組

  // 把關卡的波次依難度換算（只動第二波起）
  function scaleWaves(level, diff) {
    const d = DIFFS[diff];
    // 後面的關卡本身就在加壓，難度倍數要打折（diffScale），不然會疊到守不住
    const sc = level.diffScale ?? 0.6;
    const soft = m => 1 + (m - 1) * sc;
    return level.waves.map((w, i) => {
      if (i === 0) return { ...w, list: w.list.map(x => [...x]) };
      return {
        ...w,
        list: w.list.map(([t, n]) => [t, n === 1 ? 1 : Math.round(n * soft(d.countMul))]), // 只有一隻的頭目不加量
        gap: w.gap * soft(d.gapMul),
        hpMul: (w.hpMul || 1) * soft(d.hpMul),
      };
    });
  }

  // mods：修飾詞（見 normalizeMods），沒給就是原本的那一夜。壞欄位印錯誤後略過，要事先驗就叫 checkMods
  function create(levelId, diffKey, rng, mods) {
    const base = levelById(levelId);
    const nm = normalizeMods(base, mods);
    for (const p of nm.problems) console.error(`第 ${base.id} 夜的修飾詞：${p}`);
    for (const p of nm.notes) console.warn(`第 ${base.id} 夜的修飾詞：${p}`); // 提醒不是錯誤，壓低一級
    const level = applyMods(base, nm.mods);
    const waves = scaleWaves(level, diffKey);
    const G = {
      levelId: level.id, level, diff: diffKey, waves, rng: rng || Math.random, mods: nm.mods,
      rocks: new Set((level.rocks || []).map(([r, c]) => r + ',' + c)),
      // startFood：關卡可覆寫開局糧（歌珊的夜 100）；一筆糧的夜依難度乘 budgetMul；修飾詞給的開局糧寫多少就多少
      food: nm.mods && nm.mods.startFood !== undefined ? nm.mods.startFood : (level.startFood ?? START_FOOD) * (level.noTrickle ? (DIFFS[diffKey].budgetMul ?? 1) : 1), trickle: 0,
      phase: 'prep', wave: 0, timer: level.prep || PREP_TIME,
      queue: [], spawnTimer: 0, spawnedTotal: 0, killed: 0,
      total: waves.reduce((n, w) => n + w.list.reduce((m, [, k]) => m + k, 0), 0),
      nextRow: null, nextType: null,
      units: {}, enemies: [], shots: [], fx: [],
      sheep: level.sheep || 0, sheepLost: 0, sheepSaved: 0, unitsLost: 0, // sheepSaved：這局接回圈的迷羊數（結語用）；unitsLost：這局被敵人咬倒／撞垮／嚇跑的單位數（星級「零損失」用；鏟除、換卡、荊棘與杖自己磨損不算）
      over: false, result: null, events: [], seen: new Set(), started: false, holdWaves: false, // holdWaves：教學中先不放狼
      nextId: 1, time: 0,
      // 第二章：nextVisible 無月夜時腳印看不看得見；strays 場上的迷羊、strayQueue 這波還沒出來的迷羊（秒）；hand 送卡模式手上的卡
      nextVisible: true, strays: [], strayQueue: [], waveT: 0, hand: [], convT: 0,
      // 看門的（約 10:3）：每排門口一位，第一隻走到門口的地面敵人被他擋下、整排趕出場，用過就沒了；gates 存還在的排。關卡 gates: false 可關掉
      gates: gateRows(level, diffKey).slice(),
      gateRows: gateRows(level, diffKey), // 這一局一開始哪幾排有看門的（星級「看門的都在」與畫面用；用掉的從 gates 拿掉、這裡不動）
      strayNextRow: null, // 下一隻迷羊要從哪排來（提前 STRAY_LEAD 秒決定並印腳印）
    };
    if (level.noShepherd) G.taughtElder = true; // 一筆糧的夜：沒有牧人，不教升老牧人
    if (level.conveyor) { // 沒有糧：不教升級修補；開局先給固定幾張（至少有一個射手），之後才抽
      G.food = 0; G.taughtElder = G.taughtRepair = true;
      const st = level.conveyor.start;
      if (Array.isArray(st)) { for (const k of st) if (UNITS[k] && level.units.includes(k)) G.hand.push(k); } else for (let i = 0; i < (st ?? 3); i++) dealCard(G); // 白名單沒有的開局卡不發（期 1）
      if (!G.hand.length) dealCard(G); // 手上一張都沒有就開不了局（放下第一張才開始送卡），至少抽一張；start: 0 或開局卡全被白名單濾掉都走這條
    }
    return G;
  }

  // ====== 送卡模式（送卡夜「拉班的工價」，id 11）：卡片定時送到手上，費用 0，不能自己選 ======
  function dealCard(G) {
    const cv = G.level.conveyor; if (!cv || G.hand.length >= (cv.max || 6)) return false;
    const pool = Object.entries(cv.weights).filter(([k]) => UNITS[k] && G.level.units.includes(k));
    const tot = pool.reduce((n, [, w]) => n + w, 0); let x = G.rng() * tot;
    for (const [k, w] of pool) { x -= w; if (x <= 0) { G.hand.push(k); ev(G, { t: 'hand' }); return true; } }
    return false;
  }
  // 這一波提示點名的卡一定先送到（沒有才補）
  function dealNamed(G, k) { const cv = G.level.conveyor; if (!cv || !UNITS[k] || !G.level.units.includes(k) || G.hand.includes(k)) return; G.hand.push(k); ev(G, { t: 'hand' }); } // 手滿也照送（暫時多一張），不丟玩家手上的卡；白名單沒有的卡不送（送了也放不下去）
  // 送卡間隔：難度越高送得越慢（之前反過來，難度一高補給也多，三種難度模擬都 100%）
  function conveyorEvery(G) { const cv = G.level.conveyor; return (cv.every || 5.5) * (G.diff === 'calm' ? 1 : G.diff === 'windy' ? 1.1 : 1.2); }

  const ev = (G, e) => G.events.push(e);
  const key = (r, c) => r + ',' + c;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.r - b.r);

  // ====== 放置／點擊 ======
  function canAfford(G, k) { return G.level.conveyor ? G.hand.includes(k) : G.food >= UNITS[k].cost; }

  // 回傳 { ok, msg }
  function place(G, r, c, k) {
    if (G.over) return { ok: false };
    const def = UNITS[k];
    if (!def) return { ok: false };
    if (!G.level.units.includes(k)) return { ok: false, msg: '這一關還沒有這張卡' };
    if (G.rocks.has(key(r, c))) return { ok: false, msg: '這格是石頭' };
    if (G.units[key(r, c)] && !def.healAll) return { ok: false, msg: '這格已經有人了' }; // 只有水袋可以直接倒在有人的格子上（它就是要倒在受傷的守望樓上）；瓦瓶照舊要空格，前兩章行為不變
    if (def.hillOnly && !onHillCell(G, c)) return { ok: false, msg: hillOnlyMsg(G) };
    const cap = G.level.maxUnits && G.level.maxUnits[k]; // 關卡對某種單位的數量上限（歌珊的夜：牧人最多 3 位）
    if (cap !== undefined && countUnits(G, k) >= cap) return { ok: false, msg: `${def.name}今晚最多 ${cap} 位` };
    if (G.level.conveyor) {
      const i = G.hand.indexOf(k); if (i < 0) return { ok: false, msg: `${def.name}還沒送到手上` };
      G.hand.splice(i, 1); ev(G, { t: 'hand' }); // 送來的卡不花糧，用掉就沒了
    } else {
      if (G.food < def.cost) return { ok: false, msg: `糧不夠，${def.name}要 ${def.cost} 糧` };
      G.food -= def.cost;
    }
    if (def.kind === 'instant') { useInstant(G, r, c, k); return { ok: true, msg: def.healAll ? `${def.name}倒了，九格內的夥伴回滿血` : `${def.name}打破了` }; }
    makeUnit(G, r, c, k);
    // 第一次放牧人／石牆，順便教「再點一下」
    if (def.kind === 'producer' && !G.taughtElder) { G.taughtElder = true; return { ok: true, msg: `牧人就位。糧夠 ${ELDER_COST} 時再點牧人一下，升老牧人送糧更快` }; }
    if (def.rolls) return { ok: true, msg: `${def.name}堆好了。被咬垮或自己點它一下推倒，石頭就滾下坡` };
    if (def.kind === 'blocker' && !G.taughtRepair) { G.taughtRepair = true; return { ok: true, msg: `${def.name}就位。被咬壞時點它一下，花 ${REPAIR_COST} 糧修補` }; }
    if (def.light !== undefined) { const lo = Math.max(0, r - def.light) + 1, hi = Math.min(ROWS - 1, r + def.light) + 1; return { ok: true, msg: `${def.name}就位，照亮第 ${lo} 到 ${hi} 排。沒有月亮時這幾排的腳印預告會回來` }; }
    return { ok: true, msg: `${def.name}就位` };
  }

  const hillOnlyMsg = G => (hillOf(G) === null ? '這一夜沒有山坡，石堆沒處堆' : `石堆只能堆在斜坡那 ${hillCells(G)} 格`);
  // 真的把單位放上場（place 與檢查點還原共用）
  function makeUnit(G, r, c, k) {
    const def = UNITS[k];
    const u = { id: G.nextId++, type: k, r, c, hp: def.hp, maxHp: def.hp, timer: def.every ? def.every * 0.6 : 0, fear: 0, elder: false };
    if (def.kind === 'dog') { u.x = c; u.holding = null; u.gripping = false; u.holdT = 0; } // holding：盯上哪隻（跑過去的路上就算）；gripping：真的咬住了；holdT：幾秒時盯上的（同一隻敵人上誰先誰後）
    if (def.kind === 'patrol') { u.rv = r; u.dir = 1; }   // rv：巡夜人現在走到哪一排（小數），dir 往上或往下
    if (def.kind === 'deflector') u.flip = false;        // 中間排的杖上下輪流趕
    if (def.kind === 'floor') u.stung = new Set(); // 記住叮過誰，同一隻只中一次毒
    if (k === 'horn') { u.timer = 6; u.cdLen = 6; } // 剛放下不會馬上吹；cdLen＝這段冷卻全長，畫面冷卻條用它算比例
    G.units[key(r, c)] = u;
    ev(G, { t: 'unit', r, c });
    return u;
  }

  // ====== 檢查點：每清完一波存一次，只存場上單位與糧，不存敵人，所以永遠從下一波的開頭接 ======
  function snapshot(G) {
    return { levelId: G.levelId, diff: G.diff, wave: G.wave, food: Math.floor(G.food), sheep: G.sheep, sheepLost: G.sheepLost, sheepSaved: G.sheepSaved || 0, unitsLost: G.unitsLost ?? undefined, seen: [...G.seen], hand: G.hand.slice(),
      ...(G.mods ? { mods: JSON.parse(JSON.stringify(G.mods)) } : {}), // 修飾詞：續玩時要用同一組建局；沒有修飾詞的局不多這一欄（舊檔長相不變）
      gates: G.gates.slice(), // 還在的看門的
      strays: G.strays.filter(s => !s.dead).map(s => ({ r: s.r, x: Math.round(s.x * 10) / 10, ...(s.own ? { own: true } : {}) })), // 還在路上的迷羊（own＝被大鷹抓走又打下來的自己的羊）
      strayQueue: G.strayQueue.map(t => Math.max(0, Math.round((t - G.waveT) * 10) / 10)),       // 還沒出來的迷羊（距現在幾秒）
      units: Object.values(G.units).map(u => ({ type: u.type, r: u.r, c: u.c, hp: Math.round(u.hp), elder: !!u.elder, upgraded: !!u.upgraded,
        cd: u.repairAt ? Math.max(0, Math.round((u.repairAt - G.time) * 10) / 10) : 0,
        rest: u.resting ? Math.max(0.1, Math.round(u.restT * 10) / 10) : 0,
        t: Math.max(0, Math.round((u.timer || 0) * 10) / 10),
        ...(UNITS[u.type].push ? { cdLen: u.cdLen || UNITS[u.type].every } : {}) })) };
  }
  // 存檔長得對不對：關卡、難度、波數、糧、每個單位的種類與座標都要在範圍內（localStorage 可能被改壞或版本變了）
  const isInt = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
  function checkSnapshot(snap, levelId) {
    if (!snap || typeof snap !== 'object' || snap.levelId !== levelId) return false;
    const level = LEVELS.find(l => l.id === levelId); if (!level) return false;
    if (!DIFFS[snap.diff] || !isInt(snap.wave, 1, level.waves.length - 1) || !Number.isFinite(snap.food) || snap.food < 0) return false;
    if (snap.mods !== undefined && snap.mods !== null) { // 修飾詞要整理得過、而且整理前後一樣（存檔被改過就不收）
      const nm = normalizeMods(level, snap.mods);
      if (!nm.mods || nm.problems.length || !sameMods(nm.mods, snap.mods)) return false;
      if (nm.mods.waves !== undefined && snap.wave >= nm.mods.waves) return false;
      if (nm.mods.waveOverride && snap.wave >= nm.mods.waveOverride.length) return false; // 自帶波表的波數跟原夜不同（烈火只有一波：沒有波間檢查點）
      if (nm.mods.maxSheepLost !== undefined && (snap.sheepLost || 0) > nm.mods.maxSheepLost) return false; // 失羊已經超過題目准的：這局早該輸了，不接
    }
    if (snap.sheep !== undefined && !isInt(snap.sheep, 0, 99)) return false;
    if (snap.sheepLost !== undefined && !isInt(snap.sheepLost, 0, 99)) return false;
    if (snap.sheepSaved !== undefined && !isInt(snap.sheepSaved, 0, 99)) return false;
    if (snap.unitsLost !== undefined && snap.unitsLost !== null && !isInt(snap.unitsLost, 0, 999)) return false; // null＝舊檔續玩後不知道，放行
    if (snap.seen !== undefined && !Array.isArray(snap.seen)) return false;
    if (snap.hand !== undefined && !(Array.isArray(snap.hand) && snap.hand.length <= 12 && snap.hand.every(k => UNITS[k]))) return false;
    if (snap.gates !== undefined && !(Array.isArray(snap.gates) && snap.gates.length <= ROWS && snap.gates.every(r => isInt(r, 0, ROWS - 1)))) return false;
    if (snap.strays !== undefined && !(Array.isArray(snap.strays) && snap.strays.length <= 20 && snap.strays.every(s => s && isInt(s.r, 0, ROWS - 1) && Number.isFinite(s.x) && s.x >= -1 && s.x <= COLS + 1 && (s.own === undefined || typeof s.own === 'boolean')))) return false;
    if (snap.strayQueue !== undefined && !(Array.isArray(snap.strayQueue) && snap.strayQueue.length <= 20 && snap.strayQueue.every(t => Number.isFinite(t) && t >= 0 && t <= 600))) return false;
    if (!Array.isArray(snap.units) || snap.units.length > ROWS * COLS) return false;
    return snap.units.every(s => s && UNITS[s.type] && isInt(s.r, 0, ROWS - 1) && isInt(s.c, 0, COLS - 1)
      && (s.hp === undefined || Number.isFinite(s.hp)) && (s.uses === undefined || isInt(s.uses, 0, 99)) && (s.cd === undefined || (Number.isFinite(s.cd) && s.cd >= 0)) && (s.rest === undefined || (Number.isFinite(s.rest) && s.rest >= 0 && s.rest <= 600)) && (s.t === undefined || (Number.isFinite(s.t) && s.t >= 0 && s.t <= 600))
      && (s.cdLen === undefined || (Number.isFinite(s.cdLen) && s.cdLen > 0 && s.cdLen <= 600)));
  }
  function restore(G, snap) {
    if (!checkSnapshot(snap, G.levelId) || snap.diff !== G.diff || snap.wave >= G.waves.length) return false;
    if (!sameMods(snap.mods, G.mods)) return false; // 檢查點是另一組修飾詞（或沒有修飾詞）打出來的，不能接
    for (const s of snap.units) {
      if (G.units[key(s.r, s.c)] || G.rocks.has(key(s.r, s.c))) continue;
      if (G.mods && !G.level.units.includes(s.type)) continue; // 有修飾詞的局：白名單外的卡不還原（被改過的存檔）；故事模式照舊，玩家換過隊伍的舊檢查點不能丟
      const def = UNITS[s.type];
      const u = makeUnit(G, s.r, s.c, s.type);
      if (s.elder && def.every) { u.elder = true; u.timer = Math.min(u.timer, def.every * ELDER_MUL); }
      if (typeof s.t === 'number' && s.t >= 0 && def.every) {
        const interval = (s.type === 'shepherd' ? shepherdEvery(G) : def.every) * (u.elder ? ELDER_MUL : 1);
        // 快照以 0.1 秒四捨五入，保留合法間隔的同等精度。
        u.timer = Math.min(s.t, Math.round(interval * 10) / 10);
        if (def.push) {
          const full = Number.isFinite(s.cdLen) && s.cdLen > 0 ? s.cdLen : def.every;
          u.cdLen = Math.min(def.every, Math.max(u.timer, full));
        }
      } // 舊檔沒計時器＝剛放下的第一輪冷卻
      if (s.upgraded && def.upgrade) { u.upgraded = true; if (def.upgrade.hp && def.upgrade.hp > u.maxHp) u.maxHp = def.upgrade.hp; } // 升級過的血量上限（講定工價 60）要先補上，下一行的 hp 才不會被壓回 40
      if (typeof s.cd === 'number' && s.cd > 0) u.repairAt = G.time + s.cd;
      if (def.kind === 'dog' && typeof s.rest === 'number' && s.rest > 0) { u.resting = true; u.restT = Math.min(def.rest, s.rest); } // 存檔時狗在休息，續玩接著休息，不會帶著低血直接出動
      u.hp = Math.min(u.maxHp, Math.max(1, Number.isFinite(s.hp) ? s.hp : u.maxHp));
    }
    G.food = Math.max(0, snap.food); if (G.level.sheep) G.sheep = Math.max(1, Math.min(99, Number.isInteger(snap.sheep) ? snap.sheep : G.sheep)); // 迷羊回圈後會超過開局的隻數，不壓回去
    if (G.level.conveyor && Array.isArray(snap.hand)) { G.hand = snap.hand.filter(k => UNITS[k] && G.level.units.includes(k)); ev(G, { t: 'hand' }); } // 送卡模式：手牌跟著存，續玩不會重發開局三張
    G.sheepLost = Number.isInteger(snap.sheepLost) ? snap.sheepLost : 0;
    G.sheepSaved = Number.isInteger(snap.sheepSaved) ? snap.sheepSaved : 0;
    G.unitsLost = Number.isInteger(snap.unitsLost) ? snap.unitsLost : null; // 舊存檔沒這欄：這局不知道有沒有損失，「零損失」那顆星不給
    if (Array.isArray(snap.seen)) for (const t of snap.seen) if (ENEMIES[t]) G.seen.add(t);
    if (Array.isArray(snap.gates)) G.gates = snap.gates.filter(r => G.gateRows.includes(r)); // 舊存檔沒這欄：這個難度該有的都在；存檔裡多出這難度沒有的排就丟掉
    if (Array.isArray(snap.strays) && snap.strays.length) { G.toldStray = true; for (const s of snap.strays) spawnStray(G, s.r, s.x, s.own); }
    if (Array.isArray(snap.strayQueue)) { G.strayQueue = snap.strayQueue.slice().sort((a, b) => a - b); G.waveT = 0; G.strayNextRow = null; }
    G.wave = snap.wave;
    G.phase = 'rest'; G.timer = restOf(G) + 4; G.started = true; G.taughtElder = G.taughtRepair = true;
    G.killed = G.waves.slice(0, G.wave).reduce((n, w) => n + w.list.reduce((m, [, k]) => m + k, 0), 0);
    return true;
  }

  // 沒選卡時點已有的單位：牧人升級、牆修補
  function tapUnit(G, r, c) {
    if (G.over) return { ok: false };
    const u = G.units[key(r, c)];
    if (!u) return { ok: false, msg: '先點一張卡' };
    const def = UNITS[u.type];
    // 石堆：點一下＝推倒，石頭滾下坡（不退糧、不算損失）。排在送卡模式的擋門前：推倒不花糧。
    // 右邊沒有地面敵人時不推（手機上點一下想看它，50 糧的牆就沒了；跟 tapHint 掛「推倒」角標同一個條件）
    if (def.rolls) {
      if (!rollTargets(G, u).length) return { ok: false, msg: '石堆好好的。右邊有敵人時再點它推倒，石頭會滾下去撞牠們' };
      rollStones(G, u); removeUnit(G, u, false); return { ok: true, msg: '石堆推倒了，石頭滾下坡' };
    }
    if (G.level.conveyor) return { ok: false, msg: '今晚沒有糧，不能升級也不能修補' };
    if (def.kind === 'producer' && !u.elder) {
      if (G.food < ELDER_COST) return { ok: false, msg: `升老牧人要 ${ELDER_COST} 糧` };
      G.food -= ELDER_COST; u.elder = true; u.timer = Math.min(u.timer, def.every * ELDER_MUL);
      ev(G, { t: 'unit', r, c }); ev(G, { t: 'pop', r, c, text: '老牧人' });
      return { ok: true, msg: '升成老牧人了，送糧更快' };
    }
    // 通用升級排在修補前：目前荊棘（撒蠍子）與纏裹的牧人（膏油）有 upgrade；日後若牆也能升級，受傷時要先修補再升級，這裡要調順序
    if (def.upgrade && !u.upgraded) {
      const up = def.upgrade;
      if (u.hp <= 0) return { ok: false, msg: `${def.name}已經倒了` }; // 倒了等著被收走的那一幀點到，不能花糧把他救回來（code-review 10/30）
      if (posOf(G.level.id) < up.from) return { ok: false, msg: `第 ${up.from} 夜起才學會${up.name}` }; // from 是夜的位置，不是 id
      if (G.food < up.cost) return { ok: false, msg: `${up.name}要 ${up.cost} 糧` };
      G.food -= up.cost; u.upgraded = true;
      if (up.every && u.timer > up.every) u.timer = up.every; // 升級後裝填變快（巧匠的機器），正在數的冷卻也跟著縮
      if (up.hp && up.hp > u.maxHp) { u.hp += up.hp - u.maxHp; u.maxHp = up.hp; } // 升級後血量上限變高（講定工價 40→60），多出來的那段直接補上
      ev(G, { t: 'unit', r, c }); ev(G, { t: 'pop', r, c, text: up.name });
      return { ok: true, msg: `${up.name}好了，${up.desc}` };
    }
    if (def.kind === 'blocker' && u.hp < u.maxHp && !def.norepair) {
      if (G.food < REPAIR_COST) return { ok: false, msg: `修補要 ${REPAIR_COST} 糧` };
      if (u.repairAt && G.time < u.repairAt) return { ok: false, msg: '剛修過，等一下再修' };
      G.food -= REPAIR_COST; u.hp = Math.min(u.maxHp, u.hp + REPAIR_HP); u.repairAt = G.time + REPAIR_CD;
      ev(G, { t: 'unit', r, c }); ev(G, { t: 'pop', r, c, text: '修好了' });
      return { ok: true, msg: `${def.name}修補了` };
    }
    return { ok: false, msg: def.kind === 'producer' ? '已經是老牧人了' : def.kind === 'blocker' ? '牆還好好的' : u.upgraded ? '已經升級過了' : '這格已經有人了' };
  }

  // 單位角標：糧夠了才提示「升級」或「修補」。規則放這裡，畫面層只負責畫（跟 tapUnit 同一套條件；修補的提示門檻 REPAIR_HINT 在 data.js，點了任何受傷的牆都修得了，角標只在傷到那個比例以下才掛）
  function tapHint(G, u) {
    if (G.level.conveyor) return '';
    const def = UNITS[u.type], f = Math.floor(G.food);
    if (def.rolls) return rollTargets(G, u).length ? '推倒' : ''; // 石堆：右邊有地面敵人時提示推倒
    if (def.kind === 'producer' && !u.elder && f >= ELDER_COST) return '升級';
    if (def.kind === 'blocker' && !def.norepair && u.hp < u.maxHp * (D.REPAIR_HINT ?? 0.7) && f >= REPAIR_COST && !(u.repairAt && G.time < u.repairAt)) return '修補';
    if (def.upgrade && !u.upgraded && posOf(G.level.id) >= def.upgrade.from && f >= def.upgrade.cost) return '升級';
    return '';
  }

  // 鏟掉一個單位能退多少糧（含升老牧人、升級花的）；鏟子與直接換都用這條
  function refundOf(u) { const def = UNITS[u.type]; return Math.round((def.cost + (u.elder ? ELDER_COST : 0) + (u.upgraded ? def.upgrade.cost : 0)) * SELL_RATE); }

  // 送卡模式拆單位：沒被咬過的退回手上（手滿了就沒了）；被咬過的收不回來，不然等於免費修補。回傳退回了沒＋原因
  function removeToHand(G, u) {
    const whole = u.hp >= u.maxHp, full = G.hand.length >= (G.level.conveyor.max || 6);
    removeUnit(G, u);
    if (whole && !full) { G.hand.push(u.type); ev(G, { t: 'hand' }); return { back: true, why: '退回手上' }; }
    return { back: false, why: !whole ? '被咬過的收不回來' : '手上滿了收不回來' };
  }

  // 鏟子：拆掉自己放的單位，退一半糧（含升老牧人花的）
  function sell(G, r, c) {
    if (G.over) return { ok: false };
    const u = G.units[key(r, c)];
    if (!u) return { ok: false, msg: '這格沒東西可拆' };
    const def = UNITS[u.type];
    if (G.level.conveyor) { const h = removeToHand(G, u); return { ok: true, msg: `${def.name}拆了，${h.why}` }; }
    const back = refundOf(u);
    removeUnit(G, u); G.food += back;
    ev(G, { t: 'pop', r, c, text: `+${back}` });
    return { ok: true, msg: `${def.name}拆了，退 ${back} 糧` };
  }

  // 這格的單位能不能拿 k 這張卡直接換掉（同類、更貴）。畫面層用它亮格子，swap 用它守門
  function canSwap(G, r, c, k) {
    { const cap = G.level.maxUnits && G.level.maxUnits[k]; if (cap !== undefined && countUnits(G, k) >= cap) return false; } // 數量上限：換卡也算放
    const u = G.units[key(r, c)], def = UNITS[k];
    if (!u || !def) return false;
    const old = UNITS[u.type];
    if (def.hillOnly && !onHillCell(G, c)) return false; // 石堆只能換到坡上（swap 同一條）
    return SWAP_KINDS.includes(def.kind) && old.kind === def.kind && u.type !== k && def.cost > old.cost;
  }

  // 拿著卡點有人的格子：一次完成「鏟掉＋放下」。算法跟鏟子一樣：要有新卡全價才能點，實付＝全價－舊單位退的一半
  function swap(G, r, c, k) {
    if (G.over) return { ok: false };
    const u = G.units[key(r, c)], def = UNITS[k];
    if (!u || !def) return { ok: false };
    const old = UNITS[u.type];
    if (!G.level.units.includes(k)) return { ok: false, msg: '這一關還沒有這張卡' };
    if (u.type === k) return { ok: false, msg: old.kind === 'blocker' && u.hp < u.maxHp ? `已經是${old.name}了，被咬壞的空手點它修補` : `這格已經是${old.name}了` };
    if (!SWAP_KINDS.includes(def.kind) || old.kind !== def.kind) return { ok: false, msg: `${old.name}不能直接換成${def.name}，要先用鏟子拆` };
    if (def.cost <= old.cost) return { ok: false, msg: `${def.name}沒有比${old.name}貴，要換請先用鏟子拆` };
    if (def.hillOnly && !onHillCell(G, c)) return { ok: false, msg: hillOnlyMsg(G) };
    if (G.level.conveyor) {
      const i = G.hand.indexOf(k); if (i < 0) return { ok: false, msg: `${def.name}還沒送到手上` };
      G.hand.splice(i, 1); ev(G, { t: 'hand' });
      const h = removeToHand(G, u); makeUnit(G, r, c, k);
      return { ok: true, msg: `${old.name}換成${def.name}，${old.name}${h.why}` };
    }
    if (G.food < def.cost) return { ok: false, msg: `糧不夠，${def.name}要 ${def.cost} 糧` };
    const back = refundOf(u), pay = def.cost - back;
    G.food -= pay; removeUnit(G, u); makeUnit(G, r, c, k);
    ev(G, { t: 'pop', r, c, text: `+${back}` });
    return { ok: true, msg: `${old.name}換成${def.name}，退 ${back} 糧、實付 ${pay}` };
  }

  function useInstant(G, r, c, k) {
    const def = UNITS[k];
    if (def.healAll) { // 水袋：九格內的夥伴血量回滿、不再害怕。休息中的狗不算（牠在窩裡自己養傷）
      ev(G, { t: 'fx', kind: 'water', r, x: c });
      for (const k2 in G.units) { const v = G.units[k2]; if (Math.abs(v.r - r) > 1 || Math.abs(v.c - c) > 1 || v.resting) continue; if (v.hp < v.maxHp || v.fear > 0) { v.hp = v.maxHp; v.fear = 0; ev(G, { t: 'unit', r: v.r, c: v.c }); } }
      return;
    }
    ev(G, { t: 'fx', kind: 'blast', r, x: c });
    for (const e of G.enemies) {
      if (e.underground || e.high) continue; // 飛得高的大鷹，瓦瓶炸不到
      if (Math.abs(e.r - r) <= 1 && Math.abs(e.x + 0.5 - (c + 0.5)) <= 1.3) {
        hurt(G, e, def.dmg);
        if (ENEMIES[e.type].heavy) continue; // 野牛：只受傷，嚇不跑、推不動
        dropSheep(G, e, '被嚇到');
        e.st.panic = def.panic;
        release(G, e);
      }
    }
  }

  // ====== 波次 ======
  // 這一波的出場順序在預告前就決定好，預告圖示才會跟真正第一隻一致
  function buildQueue(G, i) {
    if (G.builtWave === i) return G.built;
    const w = G.waves[i], q = [];
    for (const [type, n] of w.list) for (let k = 0; k < n; k++) q.push(type);
    if (!w.ordered) for (let k = q.length - 1; k > 0; k--) { const j = Math.floor(G.rng() * (k + 1)); [q[k], q[j]] = [q[j], q[k]]; }
    G.builtWave = i; G.built = q;
    return q;
  }
  function startWave(G, i) {
    const w = G.waves[i];
    G.wave = i + 1; G.phase = 'wave'; G.queue = buildQueue(G, i).slice();
    G.spawnTimer = 0; G.bossRows = {};
    // 迷羊：這波開始後第幾秒走進來；上一波還沒出來的照原本的間隔接在前面，不會因為清場快就少了
    const left = G.strayQueue.map(t => Math.max(0, t - G.waveT));
    G.waveT = 0; G.strayQueue = [...left, ...(w.strays || [])].sort((a, b) => a - b);
    if (w.give) dealNamed(G, w.give);
    if (w.say) ev(G, { t: 'toast', msg: w.say }); // 自帶波表（新期 2）可以不寫台詞
  }

  // 無月夜：這一波起腳印預告看不見，除非那排在油燈照得到的範圍
  function rowLit(G, r) {
    for (const k in G.units) { const u = G.units[k], d = effOf(u, UNITS[u.type]); if (d.light !== undefined && u.hp > 0 && Math.abs(u.r - r) <= d.light) return true; } // 燈臺（升級）light 2
    return false;
  }
  function markerVisible(G, i, r) { const m = G.level.moonless; return !m || i + 1 < m || rowLit(G, r); }

  // 下一隻還沒出現，先決定牠走哪一排，畫面層印腳印（或牠的圖示）
  function foreshadow(G, i) {
    if (G.nextRow !== null) { // 已經決定好那排：只重判看不看得見（油燈剛放下就補出腳印、被咬掉就收回）
      const v = markerVisible(G, i, G.nextRow);
      if (v !== G.nextVisible) { G.nextVisible = v; ev(G, { t: 'marker', r: v ? G.nextRow : null, type: G.nextType }); }
      return;
    }
    const w = G.waves[i];
    const type = G.phase === 'wave' ? G.queue[0] : buildQueue(G, i)[0];
    let rows = w.rows;
    // 鷙鳥專挑「有牆沒射手」的排，教玩家牆擋不住天上的
    if (type === 'bird') {
      const weak = w.rows.filter(r => {
        let wall = false, shooter = false;
        for (let c = 0; c < COLS; c++) { const u = G.units[key(r, c)]; if (!u) continue; const k = UNITS[u.type].kind; if (k === 'blocker') wall = true; if (k === 'shooter') shooter = true; }
        return wall && !shooter;
      });
      if (weak.length) rows = weak;
    }
    // 會飄的（夜鴞）以中間幾排為軸，預告排先夾進牠真的會出生的範圍，腳印才不會指錯排
    if (ENEMIES[type].drift) { const d = ENEMIES[type].drift, inside = rows.filter(r => r >= d && r <= ROWS - 1 - d); rows = inside.length ? inside : [Math.max(d, Math.min(ROWS - 1 - d, rows[0]))]; }
    // 同一波第二隻頭目走不同排（例：最後一夜的兩隻獅子），兩邊都要顧
    if (ENEMIES[type].boss && G.bossRows && G.bossRows[type] !== undefined && rows.length > 1) { const other = rows.filter(r => r !== G.bossRows[type]); if (other.length) rows = other; }
    G.nextRow = rows[Math.floor(G.rng() * rows.length)];
    G.nextType = type;
    G.nextVisible = markerVisible(G, i, G.nextRow);
    ev(G, { t: 'marker', r: G.nextVisible ? G.nextRow : null, type });
  }

  function spawn(G, type) {
    const w = G.waves[G.wave - 1];
    const r = G.nextRow ?? w.rows[Math.floor(G.rng() * w.rows.length)];
    G.nextRow = null; G.nextType = null;
    ev(G, { t: 'marker', r: null });
    if (ENEMIES[type].boss) (G.bossRows = G.bossRows || {})[type] = r;
    spawnAt(G, type, r, COLS, w.hpMul || 1);
    G.spawnedTotal++;
  }
  // 在指定位置放一隻敵人（波次用，開發者模式也用）
  function spawnAt(G, type, r, x, hpMul) {
    const def = ENEMIES[type];
    const hp = Math.round(def.hp * (hpMul || 1));
    const e = { id: G.nextId++, type, r, x, hp, maxHp: hp, st: {}, heldBy: null, biting: null,
      high: !!def.high, throwT: def.throws ? def.throws.every * 0.5 : 0, carryOwn: false, // high：大鷹飛得高（投射物、瓦瓶都打不到）；throwT：強盜丟石倒數；carryOwn：叼的是圈內自己的羊（救回不算新羊、不給糧）
      underground: !!def.digs, vaulted: false, vaulting: 0, vaultFrom: 0, vaultTo: 0, lift: 0, carrying: false, enraged: false, abilityT: def.howl ? 3 : def.roar ? 4 : 0, dead: false,
      rv: r, deflectCd: 0, detourCd: 0, deflectFrom: -1, shiftT: def.shiftEvery ? def.shiftEvery * 0.5 : 0, crouchT: 0, crouched: false, dashLeft: 0, slamTarget: null, carryStray: false }; // rv：畫面上的排（換排時從舊排滑過去）
    if (def.drift) { e.r0 = Math.max(def.drift, Math.min(ROWS - 1 - def.drift, r)); e.r = e.rv = e.r0; e.driftT = G.rng() < 0.5 ? 0 : def.driftT / 2; } // 夜鴞：以中間幾排為軸飄，不會飄出棋盤；相位取正弦為 0 的點，出生那一幀不會跳排
    G.enemies.push(e);
    ev(G, { t: 'spawn', e });
    // 野狗：一出生就把土堆印在牠要冒出來的格子，玩家才有時間在旁邊放東西
    if (def.digs) { e.emergeX = Math.max(1, Math.min(2 + Math.floor(G.rng() * 3), Math.floor(x) - 1)); e.mound = true; ev(G, { t: 'fx', kind: 'mound', r, x: e.emergeX, id: e.id }); }
    if (!G.seen.has(type)) { G.seen.add(type); if (def.tip) ev(G, { t: 'callout', type, tip: def.tip }); }
  }

  // ====== 傷害與狀態 ======
  function hurt(G, e, dmg) { e.hp -= dmg; }
  // 這隻敵人身上所有的狗都放開（牠死了、換排了、被嚇跑了）
  function release(G, e) {
    for (const d of dogHolders(G, e)) { d.holding = null; d.gripping = false; }
    e.heldBy = null;
  }
  // 盯著／咬著這隻敵人的狗（含還在跑過去的）
  function dogHolders(G, e) { const a = []; for (const k in G.units) { const d = G.units[k]; if (UNITS[d.type].kind === 'dog' && d.holding === e.id) a.push(d); } return a; }
  // 一隻狗放手：牠是主咬手（敵人正在咬牠的那隻）就換下一隻已咬住的狗接手，沒有就解除咬住、敵人繼續走
  function unhold(G, u) {
    if (!u.holding) return;
    const e = G.enemies.find(x => x.id === u.holding); u.holding = null; u.gripping = false;
    if (e && e.heldBy === u.id) { const nx = dogHolders(G, e).find(d => d.gripping); e.heldBy = nx ? nx.id : null; }
  }
  function findUnitById(G, id) { for (const k in G.units) if (G.units[k].id === id) return G.units[k]; return null; }
  // 敵人換排：排號立刻換（命中判定用），畫面上的 rv 之後自己滑過去；被狗咬住的先放開
  function moveRow(G, e, r2) {
    if (r2 < 0 || r2 >= ROWS || r2 === e.r) return false;
    release(G, e); e.r = r2; e.biting = null;
    e.hopFrom = e.rv; e.hopT = 0; // 畫面從舊排滑過去（先加速再減速）
    ev(G, { t: 'fx', kind: 'hop', r: r2, x: e.x, id: e.id });
    return true;
  }
  // 牧人杖把敵人趕去哪一排：最上／最下排往中間趕，中間三排上下輪流
  function deflectRow(u) {
    if (u.r === 0) return 1; if (u.r === ROWS - 1) return ROWS - 2;
    u.flip = !u.flip; return u.r + (u.flip ? 1 : -1);
  }
  function ignite(G, e) { if (!e.st.burn) { e.st.burn = STATUS.burn.t; ev(G, { t: 'fx', kind: 'ignite', r: e.r, x: e.x }); } }
  // 抱著羊的被嚇到、被角聲推到就丟下羊：迷羊落地繼續走，偷羊人的羊留在原地（不會再被抱走一次，除非牠再走到底）
  function dropSheep(G, e, why) {
    if (!e.carrying) return;
    e.carrying = false;
    if (e.carryStray) { e.carryStray = false; spawnStray(G, e.r, Math.min(COLS, e.x), e.carryOwn); e.carryOwn = false; }
    ev(G, { t: 'toast', msg: `${ENEMIES[e.type].name}${why}，把羊丟下了 🐑` });
  }

  function speedOf(e, G) {
    const def = ENEMIES[e.type];
    if (e.underground) return def.digSpeed;
    let s = def.speed;
    if (e.st.slow) s *= def.heavy ? (STATUS.slow.heavyMul ?? STATUS.slow.mul) : STATUS.slow.mul; // 野牛：荊棘減得慢
    if (G && !def.flying && !def.heavy && downhill(G, e)) s *= HILL_SLOW; // 坡下爬得慢；野牛不受影響
    if (e.st.howl) s *= STATUS.howl.mul;
    if (e.enraged) s *= 2;
    if (e.dashLeft > 0) s *= STATUS.dash.mul; // 豹蹲完衝刺
    return s;
  }
  function biteOf(e) {
    const def = ENEMIES[e.type];
    let b = def.bite;
    if (e.st.poison) b *= STATUS.poison.biteMul;
    if (e.enraged) b *= 2;
    return b;
  }
  const targetable = e => !e.underground && !e.dead && e.hp > 0; // 零血的（這一步剛被打死、還沒清掉）不當目標：不吃石子、不被狗咬、不叼羊、不被嚎叫鼓舞
  // 偷雞摸狗的：狗專咬（翻牆、偷羊、閃避、鑽地）
  const sneaky = e => { const d = ENEMIES[e.type]; return !!(d.vaults || d.steals || d.dodge || d.digs || d.throws); }; // 強盜站著丟石頭，也算狗的獵物

  // ====== 每一步 ======
  function step(G, dt) {
    if (G.over) return;
    G.time += dt;
    // 放下第一個單位才開始倒數（新手還在看說明時不被吃掉準備時間）；糧也等到那時才滴
    if (!G.started) { if (Object.keys(G.units).length) G.started = true; else return; }

    // 糧慢慢來（送卡模式沒有糧，卡定時送）
    if (G.level.conveyor) {
      G.convT -= dt;
      if (G.convT <= 0) { dealCard(G); G.convT = conveyorEvery(G); }
    } else if (!G.level.noTrickle) { // 一筆糧的夜（第 25 夜）：糧不會自己滴
      G.trickle += dt;
      if (G.trickle >= TRICKLE.every) { G.trickle -= TRICKLE.every; G.food += TRICKLE.gives; }
    }

    // 波次節奏
    if (G.holdWaves) {
      // 教學中：糧照來、倒數不走
    } else if (G.phase === 'prep' || G.phase === 'rest') {
      G.timer -= dt;
      if (G.wave < G.waves.length && G.timer <= FORESHADOW_LEAD) foreshadow(G, G.wave);
      if (G.timer <= 0) {
        if (G.wave >= G.waves.length) return win(G);
        startWave(G, G.wave);
      }
    } else if (G.phase === 'wave') {
      if (G.queue.length) {
        foreshadow(G, G.wave - 1);
        G.spawnTimer -= dt;
        if (G.spawnTimer <= 0) { spawn(G, G.queue.shift()); G.spawnTimer = G.waves[G.wave - 1].gap; }
      } else if (!G.enemies.length) {
        G.phase = 'rest'; G.timer = restOf(G);
        ev(G, { t: 'waveclear', wave: G.wave }); // 畫面層拿去存檢查點
        const next = G.waves[G.wave];
        // 波間提醒一律由「牧人」說（2026-10-18 James 拍板：聖經人物只在開頭結尾說話）
        ev(G, { t: 'toast', msg: G.wave >= G.waves.length ? '最後一隻跑了……' : (next.hint ? `牧人：${next.hint}` : `第 ${G.wave} 波擋住了，喘口氣`) });
      }
    }

    // 迷羊照時間走進來，休息中也算（波次提早清完也不會少）
    if (G.phase !== 'prep' && !G.holdWaves) {
      G.waveT += dt;
      // 迷羊進場前 STRAY_LEAD 秒先決定排、印 🐑 腳印（不受無月夜影響：羊不是敵人），玩家來得及先放狗
      if (G.strayQueue.length && G.strayNextRow === null && G.strayQueue[0] - G.waveT <= STRAY_LEAD) { G.strayNextRow = pickStrayRow(G); ev(G, { t: 'strayMark', r: G.strayNextRow }); }
      while (G.strayQueue.length && G.strayQueue[0] <= G.waveT) { G.strayQueue.shift(); spawnStray(G, G.strayNextRow, COLS + 0.2); G.strayNextRow = null; ev(G, { t: 'strayMark', r: null }); }
    }

    unitsAct(G, dt);
    shotsFly(G, dt);
    enemiesMove(G, dt);
    if (G.over) return;
    straysMove(G, dt);
    if (G.over) return;

    // 清掉死掉的
    G.enemies = G.enemies.filter(e => {
      if (e.hp <= 0 || e.dead) {
        release(G, e);
        if (e.carrying && !e.dead) {
          if (e.carryStray) { spawnStray(G, e.r, Math.max(0, Math.min(COLS, e.x)), e.carryOwn); ev(G, { t: 'toast', msg: e.carryOwn ? '打下來了，羊落地往圈裡走 🐑' : '追上了，迷羊落地繼續走 🐑' }); } // 叼著羊的倒下，羊從那裡繼續走（大鷹抓的圈內羊也一樣）
          else ev(G, { t: 'toast', msg: '追上了，羊抱回來了 🐑' });
        }
        G.killed++; // 逃走的偷羊人也算這一波結束了，進度條才會走滿
        ev(G, { t: 'die', e });
        return false;
      }
      return true;
    });
    G.shots = G.shots.filter(s => !s.dead);
    for (const k in G.units) {
      const u = G.units[k]; if (u.hp > 0) continue;
      // 狗不會死：放開咬住的、跑回窩趴著休息，回滿血再出動
      if (UNITS[u.type].kind === 'dog') { unhold(G, u); u.hp = 1; u.resting = true; u.restT = UNITS[u.type].rest; ev(G, { t: 'toast', msg: '牧羊犬受傷了，回窩趴著休息' }); ev(G, { t: 'fx', kind: 'rest', r: u.r, x: u.x }); continue; }
      removeUnit(G, u, !u.worn); // 自己磨損掉的（荊棘）不算損失；被咬倒、踩爛、嚇跑的算
    }
  }

  // lost：這次移除算不算「損失」（星級零損失用）。只有敵人造成的才算：咬垮、撞垮、踩爛、雇工逃走
  function removeUnit(G, u, lost) {
    if (lost) G.unitsLost++;
    if (lost && UNITS[u.type].rolls) rollStones(G, u); // 石堆被咬垮、撞垮：石頭一樣滾下坡（鏟除、換樓不滾）
    if (u.holding) unhold(G, u);
    ev(G, { t: 'gone', r: u.r, c: u.c, why: lost ? 'down' : u.worn ? 'worn' : 'sold' }); // 畫面層照原因播離場動畫（嚇跑／踩爛的在這之前已另送 fx flee／trample）；sold＝鏟除、換卡，直接消失
    delete G.units[key(u.r, u.c)];
    ev(G, { t: 'unit', r: u.r, c: u.c });
  }

  // 石堆滾石會撞到誰：這排在它右邊（坡下）、站在地上的敵人（飛的、翻牆半空中的不算）
  const rollTargets = (G, u) => G.enemies.filter(e => e.r === u.r && targetable(e) && !ENEMIES[e.type].flying && !(e.vaulting > 0) && e.x >= u.c - 0.2);
  // 石堆滾石：撞到的各受傷、往後退一格、暈一下；野牛只受傷不退。叼著羊的丟下羊
  function rollStones(G, u) {
    const def = UNITS[u.type], moved = [];
    for (const e of rollTargets(G, u)) {
      hurt(G, e, def.rollDmg); ev(G, { t: 'hit', id: e.id });
      if (ENEMIES[e.type].heavy) continue;
      dropSheep(G, e, '被滾石撞到'); release(G, e);
      const x0 = e.x; e.x = Math.min(COLS + 0.2, e.x + def.rollPush); e.st.stun = Math.max(e.st.stun || 0, def.rollStun); e.biting = null;
      moved.push({ id: e.id, dx: e.x - x0 });
    }
    ev(G, { t: 'fx', kind: 'roll', r: u.r, x: u.c, moved });
    if (!G.toldRoll) { G.toldRoll = true; ev(G, { t: 'toast', msg: '石堆垮了，石頭滾下坡，把坡下的狼撞退一格' }); }
  }

  // 單位做事
  function unitsAct(G, dt) {
    const byRow = []; for (let r = 0; r < ROWS; r++) byRow.push([]);
    for (const e of G.enemies) if (targetable(e)) byRow[e.r].push(e);
    for (const k in G.units) {
      const u = G.units[k], def = UNITS[u.type];
      if (u.fear > 0) { u.fear -= dt; continue; }
      const inRow = byRow[u.r];

      if (def.kind === 'producer') {
        u.timer -= dt;
        if (u.timer <= 0) { u.timer = (u.type === 'shepherd' ? shepherdEvery(G) : def.every) * (u.elder ? ELDER_MUL : 1); G.food += def.gives; ev(G, { t: 'pop', r: u.r, c: u.c, text: `+${def.gives}` }); }
      } else if (def.kind === 'shooter') {
        // 雇工：狼靠近就逃走，該排的狼追牠停三秒
        const flees = u.upgraded && def.upgrade ? def.upgrade.flees : def.flees; // 講定工價後是 0＝不逃（不走 effOf，每幀每個射手都要算，省一次物件展開）
        if (flees && inRow.some(e => !ENEMIES[e.type].flying && !ENEMIES[e.type].heavy && e.x - u.c < flees && e.x > u.c - 0.5)) {
          for (const e of inRow) if (!ENEMIES[e.type].flying && !ENEMIES[e.type].heavy && e.x > u.c - 0.5) { e.st.distract = 3; release(G, e); } // 野牛不會為了追雇工停下來（只有陷坑困得住牠）
          ev(G, { t: 'toast', msg: '雇工看見狼來，撇下羊逃走了' });
          ev(G, { t: 'fx', kind: 'flee', r: u.r, x: u.c });
          u.hp = 0; continue;
        }
        u.timer -= dt;
        if (u.timer > 0) continue;
        const eff = effOf(u, def); // 投石機升級「巧匠的機器」：裝填與濺射讀升級值
        const range = eff.range || COLS + 1;
        // 直射（石子、箭、機弦）從坡上射出去，坡下的地面敵人在腳底下打不到：這顆投射物標記 fromHill，飛過坡緣後只打得到飛的
        const hillShot = !onHillCell(G, u.c) && hillOf(G) !== null;
        // 能瞄的：飛得高的大鷹不算（直射與拋射都打不到牠，也不能吸走拋石手的瞄準與冷卻）。
        // 坡下的地面敵人照瞄：坡上的射手會照常出手，石子從牠頭頂飛過去——玩家要親眼看到這一幕才學得會（PvZ 屋頂章的豌豆也是照射、撞屋頂）
        const canAim = e => !e.high;
        // 投石隊：自己這排和上下 lanes 排，有敵人的排各丟一顆
        if (def.lanes) {
          let fired = false;
          for (let rr = Math.max(0, u.r - def.lanes); rr <= Math.min(ROWS - 1, u.r + def.lanes); rr++) {
            if (!byRow[rr].some(e => canAim(e) && e.x > u.c - 0.2 && e.x - u.c <= range)) continue;
            G.shots.push({ id: G.nextId++, kind: def.shot, r: rr, x: u.c + 0.6, ur: u.r, uc: u.c, dmg: eff.dmg, pierce: false, falloff: 1, hit: new Set(), burn: false, fromHill: hillShot }); fired = true; // ur／uc：發射者的格子，畫面層做出手回彈用（不從投射物位置反推）
          }
          if (fired) u.timer = eff.every;
          continue;
        }
        const targets = inRow.filter(e => canAim(e) && e.x > u.c - 0.2 && e.x - u.c <= range);
        if (!targets.length) continue;
        u.timer = eff.every;
        if (def.shot === 'lob') {
          // 投石機拋最遠的（砸擠成串的尾巴）；拋石手拋最前面的（lobNear，坡下第一隻）
          const aim = targets.reduce((a, b) => ((def.lobNear ? b.x < a.x : b.x > a.x) ? b : a));
          G.shots.push({ id: G.nextId++, kind: 'lob', r: u.r, x: u.c + 0.5, ur: u.r, uc: u.c, from: u.c + 0.5, landX: aim.x + 0.5, t: 0, dmg: eff.dmg, splash: eff.splash });
        } else {
          G.shots.push({ id: G.nextId++, kind: def.shot, r: u.r, x: u.c + 0.6, ur: u.r, uc: u.c, dmg: eff.dmg, pierce: !!def.pierce, falloff: def.falloff || 1, hit: new Set(), burn: false, fromHill: hillShot });
        }
      } else if (def.kind === 'dog') {
        dogAct(G, u, def, dt);
      } else if (def.kind === 'patrol') {
        patrolAct(G, u, def, dt);
      } else if (def.kind === 'floor') {
        const eff = effOf(u, def);
        if (def.trap) { // 陷坑：第一隻踩進來的地面敵人困住幾秒（頭目短一點），坑就塌了。半空中（翻牆）的不算、迷羊不算
          const e = G.enemies.find(e => e.r === u.r && targetable(e) && !ENEMIES[e.type].flying && !(e.vaulting > 0) && Math.abs(e.x - u.c) < 0.3);
          if (e) {
            const sec = ENEMIES[e.type].boss ? def.trapBoss : def.trap;
            e.st.stun = Math.max(e.st.stun || 0, sec); e.biting = null; e.dashLeft = 0; dropSheep(G, e, '掉進坑裡');
            ev(G, { t: 'fx', kind: 'pit', r: u.r, x: u.c, id: e.id, sec }); ev(G, { t: 'hit', id: e.id });
            if (!G.toldPit) { G.toldPit = true; ev(G, { t: 'toast', msg: `${ENEMIES[e.type].name}掉進坑裡了，困住 ${sec} 秒，趁現在打` }); }
            u.hp = 0; u.worn = true; // 坑塌了：自己用掉的，不算損失
          }
          continue;
        }
        for (const e of G.enemies) {
          if (e.r !== u.r || !targetable(e) || ENEMIES[e.type].flying) continue;
          if (Math.abs(e.x - u.c) >= 0.5) continue;
          if (ENEMIES[e.type].trample) { u.hp = 0; ev(G, { t: 'fx', kind: 'trample', r: u.r, x: u.c }); ev(G, { t: 'toast', msg: '野豬把荊棘踩爛了' }); break; } // 野豬：踏過就爛
          if (eff.poison && !u.stung.has(e.id)) { // 蠍子不會用完，但同一隻只叮一次
            u.stung.add(e.id); e.st.poison = eff.poison;
            ev(G, { t: 'fx', kind: 'sting', r: e.r, x: e.x }); ev(G, { t: 'unit', r: u.r, c: u.c });
          }
          if (eff.slow) { e.st.slow = 0.15; hurt(G, e, def.dps * dt); u.hp -= def.wear * dt; if (G.rng() < dt * 3) ev(G, { t: 'unit', r: u.r, c: u.c }); if (u.hp <= 0) { u.worn = true; break; } }
        }
        if (u.hp <= 0) ev(G, { t: 'unit', r: u.r, c: u.c });
      } else if (def.kind === 'support') {
        if (def.every) {
          u.timer -= dt;
          if (u.timer > 0) continue;
          if (def.heal) {
            const eff = effOf(u, def); // 膏油後範圍與回血都用升級值
            const rg = eff.range || 1;
            u.timer = def.every;
            for (const k2 in G.units) { const v = G.units[k2]; if (v === u || Math.abs(v.r - u.r) > rg || Math.abs(v.c - u.c) > rg) continue; if (v.hp < v.maxHp && v.maxHp > 1) { v.hp = Math.min(v.maxHp, v.hp + eff.heal); ev(G, { t: 'unit', r: v.r, c: v.c }); } }
          } else if (def.push) {
            const all = u.upgraded && def.upgrade && def.upgrade.all; // 銀號：五排一起退
            const ground = (all ? G.enemies.filter(targetable) : inRow).filter(e => !ENEMIES[e.type].flying && !ENEMIES[e.type].heavy && !(e.vaulting > 0)); // 半空中的推不動；野牛推不動也嚇不暈
            if (!ground.length) continue;
            u.timer = def.every; u.cdLen = def.every;
            const moved = []; // 每隻實際被推了多遠（靠邊的會被夾住，推不到整格），畫面層照這個滑
            for (const e of ground) { dropSheep(G, e, '被角聲推回去'); const x0 = e.x; e.x = Math.min(COLS + 0.2, e.x + def.push); e.st.stun = def.stun; release(G, e); moved.push({ id: e.id, dx: e.x - x0 }); }
            ev(G, { t: 'fx', kind: 'horn', r: u.r, x: u.c, moved });
            ev(G, { t: 'toast', msg: all ? '銀號一響，五排的狼都退了一步' : '角聲一響，那排的狼退了一步' });
          }
        }
      }
    }
  }

  function dogAct(G, u, def, dt) {
    // 休息中：跑回窩，血慢慢回滿才再出動
    if (u.resting) {
      const d = u.c - u.x; if (Math.abs(d) > 0.01) u.x += Math.sign(d) * Math.min(Math.abs(d), def.run * dt);
      u.restT -= dt; u.hp = Math.min(u.maxHp, u.hp + u.maxHp / def.rest * dt);
      if (u.restT <= 0) { u.resting = false; u.hp = u.maxHp; ev(G, { t: 'pop', r: u.r, c: u.c, text: '汪！' }); }
      return;
    }
    // 2026-10-28 James 拍板的分工：同排的狗一隻敵人配一隻狗，先進來的敵人先有狗咬；新敵人進來、還沒狗盯時，由同一隻敵人上「最晚盯上的那隻狗」轉過去；
    // 敵人比狗少時多的狗一起上去合咬（傷害疊加）；手上那隻死了就去幫忙咬別隻。叼著羊跑的最優先，排上有迷羊時先咬離羊最近的
    const inRow = e => e.r === u.r && targetable(e) && !ENEMIES[e.type].flying && !ENEMIES[e.type].heavy && !e.st.panic && e.x > -0.3 && e.x < COLS + 0.2; // 野牛狗咬不住，直接不理
    let held = u.holding ? G.enemies.find(e => e.id === u.holding) : null;
    if (held && !inRow(held)) { unhold(G, u); held = null; } // 死了、驚慌跑了、換排了：放手
    const cands = G.enemies.filter(inRow);
    const nDogs = e => dogHolders(G, e).length;
    if (held) { // 要不要換目標：有敵人叼著羊沒狗追，或有新敵人沒狗盯而我不是手上這隻的第一隻狗
      const free = cands.filter(e => e !== held && nDogs(e) === 0);
      const first = dogHolders(G, held).reduce((a, b) => (b.holdT < a.holdT || (b.holdT === a.holdT && b.id < a.id) ? b : a)); // 同一幀一起盯上的，id 小的算先
      if (free.some(e => e.carrying) || (free.length && first !== u)) { unhold(G, u); held = null; }
    }
    if (!held && cands.length) {
      const stray = G.strays.find(s => s.r === u.r && !s.dead && s.x <= COLS - STRAY.safe); // 已經走進狼叼得到的範圍的迷羊
      const score = e => [e.carrying ? 1 : 0, -nDogs(e), stray ? -Math.abs(e.x - stray.x) : 0, ENEMIES[e.type].prio || 1, -Math.abs(e.x - u.x)];
      const better = (a, b) => { const sa = score(a), sb = score(b); for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sb[i] > sa[i]; return false; };
      held = cands.reduce((a, b) => (better(a, b) ? b : a));
      u.holding = held.id; u.holdT = G.time; u.gripping = false;
    }
    if (held) {
      const idx = dogHolders(G, held).sort((a, b) => a.holdT - b.holdT || a.id - b.id).indexOf(u); // 第幾隻：後到的站前一隻後面一點，不疊成一團
      const goal = held.x - 0.55 - 0.3 * idx;
      const d = goal - u.x;
      if (u.gripping || Math.abs(d) < 0.12) {
        if (!u.gripping) { u.gripping = true; ev(G, { t: 'fx', kind: 'bark', r: u.r, x: goal }); }
        if (!held.heldBy) held.heldBy = u.id; // 第一隻咬住的當主咬手：敵人停下來咬牠
        u.x = goal;
        hurt(G, held, (sneaky(held) ? def.hunt : def.dps) * dt);
      } else u.x += Math.sign(d) * Math.min(Math.abs(d), def.run * dt);
      return;
    }
    // 沒敵人時：同排有迷羊就走在牠右邊護送（幾隻閒狗輪流跟幾隻羊），不然回窩
    const strays = G.strays.filter(s => s.r === u.r && !s.dead);
    let goal = u.c;
    if (strays.length) {
      const idle = []; for (const k in G.units) { const v = G.units[k]; if (UNITS[v.type].kind === 'dog' && v.r === u.r && !v.resting && !v.holding) idle.push(v); }
      idle.sort((a, b) => a.c - b.c);
      const s = strays[Math.max(0, idle.indexOf(u)) % strays.length];
      goal = Math.min(COLS - 0.3, s.x + 0.6);
    }
    const d = goal - u.x;
    if (Math.abs(d) > 0.01) u.x += Math.sign(d) * Math.min(Math.abs(d), def.run * dt);
  }

  // ====== 巡夜人（2026-10-21 小居審查第 1 項：站位、攻擊排、碰撞排統一） ======
  // 一條規則：rv 是畫面上的位置（小數，走路動畫用）；「他站在哪一排」＝rv 四捨五入，攻擊與擋狼都看這一排。
  // 只有走到整數排才出手，不會停在兩排中間打人；鄰排他這一欄已經有別的單位或石頭就走不進去（繞不過，留在走得進的排）；
  // 他站著的鄰排那一格如果後來被放了東西，他讓出來走回家排。
  const patrolRow = u => Math.round(u.rv);
  const patrolArrived = u => Math.abs(u.rv - patrolRow(u)) < 1e-9;
  // 這一排走不走得進：家排一定可以；鄰排要他這一欄沒單位、沒石頭、也沒有別的巡夜人已經站在那
  function patrolCanStand(G, u, r) {
    if (r === u.r) return true;
    const k = key(r, u.c);
    if (G.units[k] || G.rocks.has(k)) return false;
    for (const k2 in G.units) { const v = G.units[k2]; if (v !== u && UNITS[v.type].kind === 'patrol' && v.c === u.c && patrolArrived(v) && patrolRow(v) === r) return false; }
    return true;
  }
  // 這一步每個巡夜人實際站的格子（走去鄰排時，那格在 G.units 裡是空的；敵人的碰撞要查這張表）
  function patrolMap(G) { const m = {}; for (const k in G.units) { const u = G.units[k]; if (UNITS[u.type].kind === 'patrol' && u.hp > 0) m[key(patrolRow(u), u.c)] = u; } return m; }
  // 敵人前面那格擋著的是誰：巡夜人只算他現在站的那排（家排的 🪵 崗位他不在時不擋）
  function blockerAt(G, pm, r, c) {
    const k = key(r, c);
    let b = G.units[k];
    if (b && UNITS[b.type].kind === 'patrol' && patrolRow(b) !== r) b = null;
    if (!b) b = pm[k];
    return b && b.hp > 0 ? b : null;
  }

  function patrolAct(G, u, def, dt) {
    const lo = Math.max(0, u.r - 1), hi = Math.min(ROWS - 1, u.r + 1);
    const row = patrolRow(u), arrived = patrolArrived(u);
    if (arrived) u.rv = row; // 差不到一根頭髮就算到了，站正
    const inReach = e => targetable(e) && !ENEMIES[e.type].flying && e.x > u.c - 0.2 && e.x - u.c <= def.reach;
    u.timer = Math.max(0, u.timer - dt); // 走路時也在蓄力，到了那排馬上能出手
    if (arrived) {
      const t = G.enemies.find(e => e.r === row && inReach(e));
      if (t) { // 接戰：留在這排打，不走
        if (u.timer <= 0) { u.timer = def.every; hurt(G, t, def.dmg); ev(G, { t: 'hit', id: t.id }); ev(G, { t: 'fx', kind: 'strike', r: row, x: t.x, id: u.id }); } // id 帶巡夜人：畫面讓他往前揮一下，看得出是他出的手
        return;
      }
    }
    let goal;
    if (!patrolCanStand(G, u, row)) goal = u.r; // 站著的那格被放了東西：讓出來，走回家排
    else {
      // 三排內最靠近羊圈、而且走得進去的敵人排；沒有就照原方向巡邏，走到頭折返
      const nearby = G.enemies.filter(e => e.r >= lo && e.r <= hi && inReach(e) && patrolCanStand(G, u, e.r));
      nearby.sort((a, b) => a.x - b.x || Math.abs(a.r - u.rv) - Math.abs(b.r - u.rv));
      if (nearby.length) goal = nearby[0].r;
      else {
        const edge = d => { const r = d > 0 ? hi : lo; return patrolCanStand(G, u, r) ? r : u.r; };
        goal = edge(u.dir);
        if (arrived && goal === row) { u.dir = -u.dir; goal = edge(u.dir); }
      }
    }
    const delta = goal - u.rv, stepLen = dt / def.walk;
    u.rv = Math.abs(delta) <= stepLen ? goal : u.rv + Math.sign(delta) * stepLen; // 到了就正好站在整數排（浮點數相加不會剛好落在整數上）
  }

  // ====== 迷羊 ======
  function pickStrayRow(G) { const w = G.waves[G.wave - 1]; const rows = (w && w.rows) || [0, 1, 2, 3, 4]; return rows[Math.floor(G.rng() * rows.length)]; }
  // own：這是圈內自己的羊（被大鷹抓走又打下來的）。牠的名額一直算在 sheep 裡，走回圈不加羊、不給糧；再被叼出場才算失落
  function spawnStray(G, r, x, own) {
    const s = { id: G.nextId++, r: r === null || r === undefined ? pickStrayRow(G) : r, x, dead: false, own: !!own };
    G.strays.push(s); ev(G, { t: 'stray', s });
    if (!own && !G.toldStray) { G.toldStray = true; ev(G, { t: 'toast', msg: '有一隻迷羊從東邊走過來了，走進第 6 格起狼就叼得到，狗先去等' }); }
    return s;
  }
  // 迷羊回圈：自己走到最左邊，或被抱羊羔的牧人接回（receiver）。接回的畫面要看得出是誰接的（2026-10-21 小居第 5 項）：
  // fx catch 落在牧人那一格（可能在迷羊的上下鄰排），id 帶牧人，畫面好找到他跳一下
  function strayHome(G, s, c, receiver) {
    s.dead = true;
    if (s.own) { ev(G, { t: 'fx', kind: 'home', r: s.r, x: Math.max(0, c) }); ev(G, { t: 'toast', msg: '被抓走的羊回圈了 🐑' }); return; } // 自己的羊回來：名額本來就在，不加羊、不給糧
    G.sheep++; G.sheepSaved = (G.sheepSaved || 0) + 1; G.food += STRAY.reward;
    ev(G, { t: 'sheep' }); ev(G, { t: 'pop', r: s.r, c: Math.max(0, c), text: `+${STRAY.reward}` });
    if (receiver) { ev(G, { t: 'fx', kind: 'catch', r: receiver.r, x: receiver.c, id: receiver.id }); ev(G, { t: 'toast', msg: `${UNITS[receiver.type].name}接回一隻迷羊 🐑` }); }
    else { ev(G, { t: 'fx', kind: 'home', r: s.r, x: Math.max(0, c) }); ev(G, { t: 'toast', msg: '一隻迷羊走回圈了 🐑' }); }
  }
  function straysMove(G, dt) {
    for (const s of G.strays) {
      if (s.dead) continue;
      s.x -= STRAY.speed * dt;
      const c = Math.round(s.x);
      const receiver = Object.values(G.units).find(u => UNITS[u.type].cradle && Math.abs(u.r - s.r) <= 1 && Math.abs(s.x - u.c) < 0.3);
      if (receiver || s.x < -0.4) { strayHome(G, s, receiver ? receiver.c : c, receiver); continue; }
      // 地面敵人碰到就叼走（被咬住、嚇退、暈眩、翻牆中的不會）；剛進場、還在最右邊 STRAY.safe 格內的羊叼不到（不然跟出生的狼同格，玩家無從應對）
      if (s.x > COLS - STRAY.safe) continue;
      for (const e of G.enemies) {
        if (e.r !== s.r || !targetable(e) || ENEMIES[e.type].flying || e.carrying || e.heldBy || e.st.panic || e.st.stun || e.vaulting > 0 || e.crouchT > 0) continue;
        if (Math.abs(e.x - s.x) < 0.45) { e.carrying = true; e.carryStray = true; e.carryOwn = !!s.own; s.dead = true; ev(G, { t: 'toast', msg: `${ENEMIES[e.type].name}叼走了一隻迷羊，追上去！` }); ev(G, { t: 'fx', kind: 'grab', r: s.r, x: s.x }); break; }
      }
    }
    G.strays = G.strays.filter(s => !s.dead);
  }

  // 投射物
  function shotsFly(G, dt) {
    for (const s of G.shots) {
      if (s.kind === 'lob') {
        s.t += dt / LOB_TIME;
        s.x = s.from + (s.landX - s.from) * Math.min(1, s.t);
        if (s.t >= 1) {
          s.dead = true;
          ev(G, { t: 'fx', kind: 'splash', r: s.r, x: s.landX - 0.5, splash: s.splash }); // 帶半徑給畫面：拋石手與投石機的落地圈要畫成不同大小
          for (const e of G.enemies) if (e.r === s.r && targetable(e) && !e.high && Math.abs(e.x + 0.5 - s.landX) < s.splash) { hurt(G, e, s.dmg); ev(G, { t: 'hit', id: e.id }); } // 飛得高的大鷹，石頭落地也砸不到
        }
        continue;
      }
      const prev = s.x;
      s.x += SHOT_SPEED[s.kind] * dt;
      // 穿過火盆就著火
      for (const k in G.units) { const u = G.units[k]; if (!UNITS[u.type].ignite) continue; const lanes = (u.upgraded && UNITS[u.type].upgrade && UNITS[u.type].upgrade.lanes) || 0; if (Math.abs(u.r - s.r) <= lanes && prev < u.c + 0.5 && s.x >= u.c + 0.5) s.burn = true; } // 壇上的火（升級）lanes 1：上下排的石子箭矢也點燃
      for (const e of G.enemies) {
        if (e.r !== s.r || !targetable(e) || s.hit.has(e.id) || e.high) continue; // 飛得高的大鷹，什麼投射物都打不到
        if (Math.abs(e.x + 0.5 - s.x) >= 0.35) continue;
        // 從坡上射的直射，飛到坡下只剩飛的打得到：地面敵人在腳底下，石子從頭頂飛過去（第一次冒「咻」＋提示）
        if (s.fromHill && !ENEMIES[e.type].flying && downhill(G, e)) {
          if (!s.overflew) { s.overflew = true; ev(G, { t: 'fx', kind: 'overfly', r: s.r, x: e.x, id: s.id }); if (!G.toldOverfly) { G.toldOverfly = true; ev(G, { t: 'toast', msg: `石子從${ENEMIES[e.type].name}的頭頂飛過去了。斜坡上的敵人在你腳底下，直射打不到` }); } }
          continue;
        }
        s.hit.add(e.id);
        const def = ENEMIES[e.type];
        if (def.dodge && G.rng() < def.dodge) { ev(G, { t: 'fx', kind: 'dodge', r: e.r, x: e.x }); continue; }
        hurt(G, e, (def.thick && (s.kind === 'stone' || s.kind === 'arrow')) ? s.dmg * THICK_MUL : s.dmg);
        ev(G, { t: 'hit', id: e.id }); // 畫面閃白用；持續傷害不發這個事件
        if (s.burn) ignite(G, e);
        if (s.pierce) { s.dmg *= s.falloff; } else { s.dead = true; break; }
      }
      if (s.x > COLS + 1) s.dead = true;
    }
  }

  // 敵人走路、咬東西、特殊能力
  function enemiesMove(G, dt) {
    const pm = patrolMap(G); // 巡夜人現在站哪格（擋狼用）
    for (const e of G.enemies) {
      if (e.dead || e.hp <= 0) continue; // 這一步剛被打死的也不走不咬（以前只跳 dead，零血的狼還能再走一小步越線）
      const def = ENEMIES[e.type];

      // 狀態倒數
      for (const k of ['burn', 'poison', 'slow', 'stun', 'panic', 'howl', 'distract']) if (e.st[k]) { e.st[k] -= dt; if (e.st[k] <= 0) delete e.st[k]; }
      if (e.deflectCd > 0) e.deflectCd -= dt; if (e.detourCd > 0) e.detourCd -= dt;
      // 換排的畫面位置：rv 朝 r 滑過去
      if (def.drift) { // 夜鴞：排號跟著飄；飄進油燈照到的排就停住（光裡的敵人不換排）
        if (rowLit(G, e.r)) { e.rv += (e.r - e.rv) * Math.min(1, dt * 4); e.r0 = Math.max(def.drift, Math.min(ROWS - 1 - def.drift, e.r)); e.driftT = 0; } // 軸心也夾在不會飄出棋盤的排：停在邊排時燈熄了，再飄會到第 -1 排（2026-10-31 模擬撞出）
        else { e.driftT += dt; e.rv = e.r0 + Math.sin(e.driftT / def.driftT * Math.PI * 2) * def.drift; const nr = Math.round(e.rv); if (nr !== e.r) { e.r = nr; } }
      }
      else if (e.rv !== e.r) { e.hopT = Math.min(1, (e.hopT || 0) + dt / STATUS.hop.t); const p = e.hopT * e.hopT * (3 - 2 * e.hopT); e.rv = e.hopT >= 1 ? e.r : (e.hopFrom ?? e.rv) + (e.r - (e.hopFrom ?? e.rv)) * p; }
      // 豹：每隔幾秒換一排（被咬住、翻牆中、蹲著的時候不換）
      if (def.shiftEvery && !e.heldBy && !e.vaulting && !e.crouchT && !e.st.stun && !e.carrying && !rowLit(G, e.r)) { // 油燈照到的排不換
        e.shiftT -= dt;
        if (e.shiftT <= 0 && e.x < COLS - 0.5) { e.shiftT = def.shiftEvery; const cand = [e.r - 1, e.r + 1].filter(r => r >= 0 && r < ROWS); moveRow(G, e, cand[Math.floor(G.rng() * cand.length)]); }
      }
      // 大鷹：守望樓那一排飛不高（樓還在就一直壓低、樓拆了就飛回去）；抓了羊往回飛就一直低
      if (def.high) e.high = !e.carrying && !rowHasTall(G, e.r);
      if (e.st.burn) {
        hurt(G, e, STATUS.burn.dps * dt);
        for (const o of G.enemies) if (o !== e && o.r === e.r && targetable(o) && !o.st.burn && !o.high && Math.abs(o.x - e.x) < 0.6) ignite(G, o); // 火傳不到天上飛高的
      }
      if (e.st.poison) hurt(G, e, STATUS.poison.dps * dt);
      if (e.hp <= 0) continue; // 被燒死、毒死的這一步也不走、不咬、不嚎叫（跟步首的零血檢查同一個道理）
      if (def.enrage && !e.enraged && e.hp < e.maxHp * def.enrage) { e.enraged = true; ev(G, { t: 'fx', kind: 'enrage', r: e.r, x: e.x }); ev(G, { t: 'toast', msg: '熊狂暴了！' }); }

      // 能力：嚎叫／咆哮
      if (def.howl || def.roar) {
        e.abilityT -= dt;
        if (e.abilityT <= 0 && !e.underground && e.x < COLS - 0.2) {
          e.abilityT = def.howl || def.roar;
          if (def.howl) {
            for (const o of G.enemies) if (o !== e && targetable(o) && dist(o, e) <= 2) o.st.howl = STATUS.howl.t;
            ev(G, { t: 'fx', kind: 'howl', r: e.r, x: e.x }); ev(G, { t: 'toast', msg: '領頭狼嚎叫，狼群衝過來了' });
          } else {
            let fled = 0; // 被吼跑的雇工數：要讓玩家看得出他是嚇跑的，不是被咬死的（10/29 James）
            for (const k in G.units) { const u = G.units[k]; const d = Math.hypot(u.c - e.x, u.r - e.r); if (d <= 2 && !['floor', 'blocker', 'dog'].includes(UNITS[u.type].kind) && !UNITS[u.type].brave) { u.fear = STATUS.fear.t; if (effOf(u, UNITS[u.type]).flees) { u.hp = 0; fled++; ev(G, { t: 'fx', kind: 'flee', r: u.r, x: u.c }); } } }
            ev(G, { t: 'fx', kind: 'roar', r: e.r, x: e.x }); ev(G, { t: 'toast', msg: fled ? '獅子吼叫，附近的人都僵住了，雇工嚇得撇下羊逃走' : '獅子吼叫，附近的人都僵住了' });
          }
        }
      }

      // 鑽地：到了位置才冒出來；快到前先出土堆
      if (e.underground) {
        if (e.x <= e.emergeX + 0.5) { e.underground = false; ev(G, { t: 'fx', kind: 'emerge', r: e.r, x: e.x, id: e.id }); }
        else { e.x -= speedOf(e, G) * dt; continue; }
      }

      // 翻牆中：已經跳起來就一定落地，定身／驚慌等落地後才算（不然會懸在半空或被推回去再彈回弧線）
      if (e.vaulting > 0) {
        e.vaulting -= dt;
        const p = Math.min(1, 1 - e.vaulting / VAULT_TIME);
        e.x = e.vaultFrom + (e.vaultTo - e.vaultFrom) * p; // 連續越過牆，不是瞬移
        e.lift = Math.sin(p * Math.PI);                     // 離地高度 0→1→0，畫面層畫弧線
        if (e.vaulting <= 0) { e.x = e.vaultTo; e.lift = 0; e.vaulted = true; ev(G, { t: 'toast', msg: '賊翻過牆了！' }); }
        continue;
      }

      // 驚慌：往右跑，不咬
      if (e.st.panic) { e.x = Math.min(COLS + 0.3, e.x + STATUS.panic.speed * dt); e.biting = null; continue; }
      if (e.st.stun || e.st.distract || e.heldBy) { e.biting = null; if (e.heldBy) biteDog(G, e, dt); continue; }
      // 豹：走到定點先蹲（有預兆），蹲完衝兩格
      if (def.crouchAt && !e.crouched && e.x <= def.crouchAt) { e.crouched = true; e.crouchT = def.crouch; ev(G, { t: 'fx', kind: 'crouch', r: e.r, x: e.x }); ev(G, { t: 'toast', msg: '豹蹲下來了，牠要衝了' }); }
      if (e.crouchT > 0) { e.crouchT -= dt; e.biting = null; if (e.crouchT <= 0) { e.crouchT = 0; e.dashLeft = def.dash; } continue; }
      // 抱著羊往回跑
      if (e.carrying) {
        e.x += (def.fleeSpeed || def.speed * 1.4) * dt;
        if (e.x > COLS + 0.3) { e.dead = true; G.sheep--; G.sheepLost++; ev(G, { t: 'toast', msg: e.carryOwn ? `一隻羊被${def.name}抓走了 🐑` : e.carryStray ? '迷羊被叼走了 🐑' : '一隻羊被抱走了 🐑' }); ev(G, { t: 'sheep' }); if (G.sheep <= 0) return lose(G, 'sheep'); if (G.level.maxSheepLost !== undefined && G.sheepLost > G.level.maxSheepLost) return lose(G, 'sheepLost'); } // sheepLost：試煉「失羊即輸」（新期 2），羊還有但超過題目准失的隻數
        continue;
      }
      // 強盜：走到坡下定點就站住，朝這排最前面的夥伴丟石頭；這排沒夥伴了才繼續走（被推回去就再走回來站好）
      if (def.throws && e.x <= def.throws.at) {
        const t = throwTarget(G, e);
        if (t) {
          e.biting = null; e.throwT -= dt;
          if (e.throwT <= 0) {
            e.throwT = def.throws.every; t.hp -= def.throws.dmg;
            ev(G, { t: 'fx', kind: 'throw', r: e.r, x: e.x, id: e.id, tc: t.c }); ev(G, { t: 'unit', r: t.r, c: t.c });
            if (!G.toldThrow) { G.toldThrow = true; ev(G, { t: 'toast', msg: `${def.name}站在斜坡上丟石頭，專丟最前面的夥伴。直射打不到牠，派狗咬、拋石手砸` }); }
          }
          continue;
        }
      }

      // 前面那格有沒有東西擋著（飛的直接飛過）
      let blocked = false;
      if (!def.flying) {
        const frontCol = Math.floor(e.x + 0.3);
        const b = blockerAt(G, pm, e.r, frontCol); // 巡夜人只擋他現在站的那排（含走去的鄰排），家排空著時從旁邊過
        const bk = b ? UNITS[b.type].kind : null;
        const solid = b && ['blocker', 'producer', 'shooter', 'support', 'deflector', 'patrol'].includes(bk);
        if (solid && e.x <= frontCol + 0.6) {
          if (def.vaults && !e.vaulted && bk === 'blocker' && !UNITS[b.type].tall) {
            e.vaulting = VAULT_TIME; e.vaultFrom = e.x; e.vaultTo = frontCol - 0.45; continue; // 動作本身就是說明，不飄符號
          }
          // 牧人杖：把地面的非頭目趕到隔壁排（同一隻 4 秒內不重複趕；頭目把它當普通牆咬）
          if (bk === 'deflector' && !def.boss && e.deflectCd <= 0) {
            const r2 = deflectRow(b);
            // 不趕回牠剛被趕來的那排（兩根杖之間不打乒乓；這根杖就當牆讓牠咬）
            if (r2 !== e.deflectFrom && moveRow(G, e, r2)) { e.deflectFrom = b.r; e.deflectCd = UNITS[b.type].deflectCd; b.hp -= UNITS[b.type].deflect; ev(G, { t: 'unit', r: b.r, c: b.c }); if (b.hp <= 0) removeUnit(G, b); continue; }
          }
          // 豺狼：前面是牆、隔壁排同一格空著就繞過去
          if (def.detour && bk === 'blocker' && e.detourCd <= 0 && rowLit(G, e.r)) { if (!G.toldLampLock) { G.toldLampLock = true; ev(G, { t: 'toast', msg: '豺狼被油燈照著，繞不了路，只能咬牆' }); } }
          else if (def.detour && bk === 'blocker' && e.detourCd <= 0) {
            const cand = [e.r - 1, e.r + 1].filter(r => r >= 0 && r < ROWS && !(G.units[key(r, frontCol)] && UNITS[G.units[key(r, frontCol)].type].kind === 'blocker') && !G.rocks.has(key(r, frontCol))); // 隔壁那格只要不是牆就繞得過去（有射手就直接撲上去咬）
            if (cand.length) { moveRow(G, e, cand[Math.floor(G.rng() * cand.length)]); e.detourCd = def.detour; if (!G.toldDetour) { G.toldDetour = true; ev(G, { t: 'toast', msg: '豺狼繞過牆，換到隔壁排了' }); } continue; }
          }
          // 野豬：撞上每道牆的第一下特別重，撞完自己暈一下
          if (def.slam && bk === 'blocker' && e.slamTarget !== b.id) {
            e.slamTarget = b.id; b.hp -= def.slam; e.st.stun = def.slamStun; e.dashLeft = 0;
            ev(G, { t: 'fx', kind: 'slam', r: e.r, x: frontCol }); ev(G, { t: 'unit', r: b.r, c: b.c });
            if (b.hp <= 0) { removeUnit(G, b, true); ev(G, { t: 'toast', msg: '野豬一撞，牆垮了' }); }
            continue;
          }
          blocked = true;
          const mul = (def.wallMul && UNITS[b.type].kind === 'blocker') ? def.wallMul : 1;
          b.hp -= biteOf(e) * mul * dt;
          e.biting = b.id;
          if (b.hp <= 0) { removeUnit(G, b, true); e.biting = null; if (def.wallMul && UNITS[b.type].kind === 'blocker') ev(G, { t: 'toast', msg: '獅子一口咬碎了牆' }); }
          else if (G.rng() < dt * 4) ev(G, { t: 'unit', r: e.r, c: frontCol });
        }
      }
      if (!blocked) { e.biting = null; const mv = speedOf(e, G) * dt; e.x -= mv; if (e.dashLeft > 0) e.dashLeft -= mv; }

      // 走到底
      if (e.x < -0.6) {
        const type = e.type;
        if (def.steals && G.sheep > 0) {
          e.carrying = true; e.x = -0.5;
          if (def.flying) { e.carryStray = true; e.carryOwn = true; e.high = false; } // 大鷹抓了羊就飛低了，打下來羊會落地自己走回來
          ev(G, { t: 'toast', msg: def.flying ? `${def.name}抓起一隻羊往回飛了！現在牠飛低了，打下來` : '偷羊人抱起一隻羊往回跑了！' }); ev(G, { t: 'fx', kind: 'grab', r: e.r, x: 0, type }); continue; // type：畫面層放誰的聲音（大鷹抓羊再尖嘯一聲）
        }
        if (!def.flying && G.gates.includes(e.r)) { useGate(G, e.r); continue; } // 看門的擋下：整排趕出去，這排的門用掉了。飛的不經過門
        return lose(G, def.flying ? 'bird' : 'wolf', e.type); // reason 分三類給結局文案與測試用；by 記是哪一種敵人，標題要寫牠的名字（以前夜鴞也寫成鷙鳥）
      }
    }
  }

  // 看門的（約 10:3）：第一隻走到門口的地面敵人觸發，整排地面敵人一起被趕出場；叼著迷羊的放下羊；用過這排就沒門了
  function useGate(G, r) {
    G.gates = G.gates.filter(x => x !== r);
    let n = 0;
    for (const e of G.enemies) {
      if (e.r !== r || e.dead || ENEMIES[e.type].flying) continue;
      release(G, e);
      if (e.carrying && e.carryStray) spawnStray(G, r, Math.max(0, Math.min(COLS, e.x)), e.carryOwn); // 自己的羊（大鷹抓走又落地的）放下來還是自己的羊，不會變成多一隻迷羊
      e.carrying = false; e.carryStray = false; e.dead = true; n++;
    }
    ev(G, { t: 'fx', kind: 'gate', r, x: 0 });
    ev(G, { t: 'toast', msg: `看門的把這一排的 ${n} 隻地面敵人全趕了出去。這排的門沒人看了，再漏一隻就守不住` });
  }

  // 強盜的靶：這排在牠前面（左邊）最前面那個夥伴。地板（荊棘、陷坑）不算靶；狗用窩的位置；巡夜人只在他正站在這排時算
  function throwTarget(G, e) {
    let best = null;
    for (const k in G.units) {
      const u = G.units[k], d = UNITS[u.type];
      if (u.hp <= 0 || d.kind === 'floor' || u.resting || u.c > e.x) continue; // 休息中的狗在窩裡養傷，不是靶（不然一顆石頭就讓牠重新趴回去）
      const row = d.kind === 'patrol' ? patrolRow(u) : u.r;
      if (row !== e.r) continue;
      if (!best || u.c > best.c) best = u;
    }
    return best;
  }

  function biteDog(G, e, dt) {
    const d = findUnitById(G, e.heldBy);
    if (!d) { e.heldBy = null; return; }
    d.hp -= biteOf(e) * dt;
    if (G.rng() < dt * 3) ev(G, { t: 'unit', r: d.r, c: d.c });
  }

  // ====== 勝負 ======
  function win(G) {
    // 天亮了：還在路上的、還沒走到的迷羊都算回圈
    for (const s of G.strays) if (!s.dead) { s.dead = true; if (!s.own) { G.sheep++; G.sheepSaved = (G.sheepSaved || 0) + 1; } } // 自己的羊（大鷹抓走又落地的）名額本來就在
    G.sheep += G.strayQueue.length; G.sheepSaved = (G.sheepSaved || 0) + G.strayQueue.length; G.strays = []; G.strayQueue = []; G.strayNextRow = null; ev(G, { t: 'strayMark', r: null });
    G.over = true; G.result = { win: true, stars: starsOf(G) }; ev(G, { t: 'win' });
  }
  // 星級：每夜三顆，自動累積、不解鎖任何東西。守過／零損失（沒失羊就算；2026-10-24 James 定：牆、射手被咬垮不算損失，unitsLost 只留著當統計）／五位看門的都在（關卡關掉看門的就只有兩顆）
  function starsOf(G) { return { win: true, noLoss: G.sheepLost === 0, gates: G.level.gates !== false && G.gates.length === G.gateRows.length }; }
  function starSlots(level) { return level.gates === false ? 2 : 3; }
  function lose(G, reason, by) { G.over = true; G.result = { win: false, reason, by }; ev(G, { t: 'strayMark', r: null }); ev(G, { t: 'lose', reason, by }); }

  // ====== 開發者模式 ======
  const dev = {
    spawn(G, type, r, c) { if (G.over || !ENEMIES[type]) return; const w = G.waves[G.wave - 1]; spawnAt(G, type, r, c, w ? w.hpMul : 1); G.total++; },
    clear(G) { for (const e of G.enemies) { release(G, e); e.dead = true; } G.total -= G.enemies.length; G.enemies = []; G.strays = []; G.strayQueue = []; G.strayNextRow = null; ev(G, { t: 'strayMark', r: null }); G.queue = []; G.nextRow = null; G.nextType = null; ev(G, { t: 'marker', r: null }); if (G.phase === 'wave') { G.phase = 'rest'; G.timer = restOf(G); } },
    nextWave(G) { if (G.over) return; G.started = true; G.holdWaves = false; if (G.phase === 'wave') { dev.clear(G); } G.timer = Math.min(G.timer, 0.5); },
    food(G, n) { G.food += n; },
    allCards(G) { G.level = { ...G.level, units: Object.keys(UNITS), fresh: [] }; if (G.level.conveyor) for (const k of Object.keys(UNITS)) if (!G.hand.includes(k)) G.hand.push(k); ev(G, { t: 'hand' }); },
    stray(G, r, x, own) { if (G.over) return null; return spawnStray(G, r, x, own); },
  };

  // 關卡資料守門：會抓羊的（大鷹、偷羊人）出現的夜一定要有 sheep；只能放坡上的卡出現的夜一定要有 hill。載入時印錯誤，測試也能叫
  function validateLevels() {
    const bad = [];
    for (const L of LEVELS) {
      const types = new Set(L.waves.flatMap(w => w.list.map(([t]) => t)));
      if ([...types].some(t => ENEMIES[t] && ENEMIES[t].steals) && !L.sheep) bad.push(`第 ${L.id} 夜有會抓羊的敵人卻沒有 sheep`);
      if (L.units.some(k => UNITS[k] && UNITS[k].hillOnly) && (L.hill === undefined || L.hill === null)) bad.push(`第 ${L.id} 夜有只能放坡上的卡卻沒有 hill`);
      for (const t of types) if (!ENEMIES[t]) bad.push(`第 ${L.id} 夜的波表有不認識的敵人 ${t}`);
      for (const k of L.units) if (!UNITS[k]) bad.push(`第 ${L.id} 夜的卡表有不認識的卡 ${k}`);
    }
    return bad;
  }
  for (const msg of validateLevels()) console.error(msg);
  for (const msg of validateTrials()) console.error(msg);

  const Engine = { create, gateRows, place, tapUnit, tapHint, sell, swap, canSwap, snapshot, checkSnapshot, restore, step, canAfford, levelById, posOf, nextOf, isUnlocked, restOf, countUnits, scaleWaves, defaultPick, validPick, applyPick, checkMods, normalizeMods, applyMods, trialById, trialGate, isTrialUnlocked, enemiesSeenBy, trialLevel, dailyTrial, validateTrials, sameMods, rowLit, starSlots, validateLevels, onHillCell, dev, effOf };
  if (typeof module !== 'undefined') module.exports = Engine; else root.Engine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
