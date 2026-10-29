// 存檔（save.js）的測試：舊 key 搬移、壞主檔用備份、未來版本拒收、存檔碼來回、校驗碼、檢查點壞掉只丟那一份
// node --test sim/
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const D = require(path.join(__dirname, '..', 'data.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));
const Save = require(path.join(__dirname, '..', 'save.js'));
const { LEVELS, DIFFS } = D;

const OPTS = { check: E.checkSnapshot, diffs: Object.keys(DIFFS), now: '2026-10-30T00:00:00.000Z', nowFn: () => '2026-10-30T01:00:00.000Z' };
const lv2 = LEVELS.find(l => l.id === 2);
function realSnapshot() { const G = E.create(lv2.id, 'windy'); G.food = 300; assert.ok(E.place(G, 2, 0, 'shepherd').ok); G.wave = 1; return JSON.parse(JSON.stringify(E.snapshot(G))); }

// 10/29 以前一支手機上會長這樣的一堆 key
function legacyStore() {
  return Save.memoryStore({
    'sheepfold-progress-v3': JSON.stringify({ cleared: { 1: { calm: true, windy: true }, 2: { calm: true } }, best: { '1:calm': { score: 9, cleared: true, wave: 8 }, '2:calm': { score: 7, cleared: true, wave: 6 } }, stars: { 1: { noLoss: true, gates: false } }, migrated: true }),
    'sheepfold-best-v2': JSON.stringify({ storm: { score: 3, cleared: false, wave: 3 } }),
    'sheepfold-checkpoint-2': JSON.stringify(realSnapshot()),
    'sheepfold-checkpoint-9': JSON.stringify({ levelId: 9, diff: 'calm', wave: 'bad' }),
    'sheepfold-loadout': JSON.stringify({ 12: ['shepherd', 'slinger', 'wall'] }),
    'sheepfold-intro-seen': JSON.stringify(['1:shepherd', 'gate']),
    'sheepfold-seen-cards': JSON.stringify(['shepherd', 'dog']),
    'sheepfold-seen-enemies': JSON.stringify(['wolf']),
    'sheepfold-tutorial-done': '1',
    'sheepfold-diff': 'windy',
    'sheepfold-speed': '2',
    'sheepfold-bigtext': '1',
    'sheepfold-lite': '0',
    'sheepfold-sound': JSON.stringify({ sfx: true, amb: true, vol: 2 }),
    'sheepfold-lasterr': 'keep me',
  });
}

test('舊 key 全部搬進 sheepfold-save，搬成功後舊 key 刪掉、lasterr 留著', () => {
  const st = legacyStore();
  const S = Save.open(st, OPTS);
  assert.strictEqual(S.status, 'migrated');
  const d = S.data;
  assert.strictEqual(d.version, Save.VERSION);
  assert.deepStrictEqual(d.progress.cleared[1], { calm: true, windy: true });
  assert.strictEqual(d.progress.best['2:calm'].score, 7);
  assert.strictEqual(d.progress.best['1:storm'], undefined, 'progress-v3 已標 migrated，best-v2 不重搬');
  assert.strictEqual(d.progress.stars[1].noLoss, true);
  assert.strictEqual(d.checkpoints[2].levelId, 2, '好的檢查點搬過來');
  assert.strictEqual(d.checkpoints[9], undefined, '壞的檢查點丟掉');
  assert.ok(S.problems.some(p => p.includes('第 9 夜')), '壞檢查點有說明');
  assert.deepStrictEqual(d.loadouts[12], ['shepherd', 'slinger', 'wall']);
  assert.deepStrictEqual(d.seen, { intro: ['1:shepherd', 'gate'], cards: ['shepherd', 'dog'], enemies: ['wolf'] });
  assert.strictEqual(d.tutorial, true);
  assert.deepStrictEqual(d.prefs, { diff: 'windy', speed: 2, big: true, lite: false, sound: { sfx: true, amb: true, vol: 2 }, analytics: true });
  assert.ok(st.get(Save.KEY), '新檔已寫入');
  for (const k of Save.LEGACY) assert.strictEqual(st.get(k), null, k + ' 應已刪除');
  assert.strictEqual(st.get('sheepfold-checkpoint-2'), null);
  assert.strictEqual(st.get('sheepfold-lasterr'), 'keep me');
});

test('只有 best-v2（最舊的玩家）：第一關紀錄搬到 1:難度', () => {
  const st = Save.memoryStore({ 'sheepfold-best-v2': JSON.stringify({ calm: { score: 9, cleared: true, wave: 8 } }) });
  const S = Save.open(st, OPTS);
  assert.strictEqual(S.status, 'migrated');
  assert.strictEqual(S.data.progress.best['1:calm'].cleared, true);
  assert.deepStrictEqual(S.data.progress.cleared[1], { calm: true });
});

test('什麼都沒有：全新一份，不寫任何東西', () => {
  const st = Save.memoryStore();
  const S = Save.open(st, OPTS);
  assert.strictEqual(S.status, 'fresh');
  assert.strictEqual(st.get(Save.KEY), null, '全新玩家不急著寫');
  assert.ok(S.save());
  assert.strictEqual(JSON.parse(st.get(Save.KEY)).updated, '2026-10-30T01:00:00.000Z');
});

test('第二次開：status ok，並抄一份備份', () => {
  const st = legacyStore();
  Save.open(st, OPTS);
  const S = Save.open(st, OPTS);
  assert.strictEqual(S.status, 'ok');
  assert.strictEqual(st.get(Save.BAK), JSON.stringify(S.data));
});

test('主檔壞掉、有備份：用備份接回來，壞檔留在 -broken', () => {
  const st = legacyStore();
  Save.open(st, OPTS); Save.open(st, OPTS); // 第二次開才有備份
  st.set(Save.KEY, '{"version":4,"progress":{garbage');
  const S = Save.open(st, OPTS);
  assert.strictEqual(S.status, 'restored');
  assert.deepStrictEqual(S.data.progress.cleared[1], { calm: true, windy: true });
  assert.strictEqual(st.get(Save.BROKEN), '{"version":4,"progress":{garbage');
  assert.ok(S.problems[0].includes('備份'));
  assert.ok(st.get(Save.KEY).startsWith('{"version":5'), '接回來的立刻寫回主檔（升到現在的版本）');
});

test('主檔壞掉、沒備份：從頭開始、status broken、壞檔留著', () => {
  const st = Save.memoryStore({ [Save.KEY]: 'not json at all' });
  const S = Save.open(st, OPTS);
  assert.strictEqual(S.status, 'broken');
  assert.deepStrictEqual(S.data.progress.cleared, {});
  assert.strictEqual(st.get(Save.BROKEN), 'not json at all');
});

test('來自未來版本的主檔：唯讀、不寫任何東西（舊版遊戲快取不能把新存檔蓋掉）', () => {
  const text = JSON.stringify({ version: 99, progress: { cleared: { 30: { calm: true } } } });
  const st = Save.memoryStore({ [Save.KEY]: text });
  const S = Save.open(st, OPTS);
  assert.strictEqual(S.status, 'newer');
  assert.ok(S.problems.some(p => p.includes('更新')), S.problems.join('|'));
  assert.strictEqual(S.save(), false);
  assert.strictEqual(st.get(Save.KEY), text, '主檔原封不動');
  assert.strictEqual(st.get(Save.BROKEN), null); assert.strictEqual(st.get(Save.BAK), null);
});

test('replace 寫失敗：記憶體退回原狀；成功：匯入前那份留在 -before-import', () => {
  const st = Save.memoryStore();
  const S = Save.open(st, OPTS); S.data.tutorial = true; S.save();
  const other = Save.open(legacyStore(), OPTS).data;
  const realSet = st.set; st.set = () => { throw new Error('quota'); };
  assert.strictEqual(S.replace(other), false);
  assert.strictEqual(S.data.tutorial, true); assert.deepStrictEqual(S.data.progress.cleared, {});
  st.set = realSet;
  assert.ok(S.replace(other));
  assert.strictEqual(JSON.parse(st.get(Save.KEY + '-before-import')).tutorial, true);
});

test('validate 補齊缺欄、丟掉型別錯的，不會丟例外', () => {
  const r = Save.validate({ version: 4, progress: { cleared: { 3: { calm: true, storm: 0 } }, best: { x: 'nope', '3:calm': { score: 5 } } }, loadouts: { 4: 'nope', 5: ['a', 1, 'b'] }, prefs: { diff: 'nope', speed: 9, lite: 'yes', sound: { vol: 7 } }, playerKind: 'alien' }, OPTS);
  const d = r.data;
  assert.deepStrictEqual(d.progress.cleared[3], { calm: true });
  assert.strictEqual(d.progress.best.x, undefined);
  assert.deepStrictEqual(d.progress.best['3:calm'], { score: 5, cleared: false, wave: 0 });
  assert.strictEqual(d.loadouts[4], undefined);
  assert.deepStrictEqual(d.loadouts[5], ['a', 'b']);
  assert.deepStrictEqual(d.prefs, { diff: 'calm', speed: 1, big: false, lite: null, sound: { sfx: true, amb: false, vol: 1 }, analytics: true });
  assert.strictEqual(d.playerKind, '');
  assert.deepStrictEqual(d.seen, { intro: [], cards: [], enemies: [] });
  for (const bad of [null, 'x', 42, [1, 2]]) assert.strictEqual(Save.validate(bad, OPTS).data, null);
});

test('存檔碼來回：中文、檢查點都在，格式純 ASCII，貼進去帶換行空白也讀得回來', () => {
  const st = legacyStore();
  const S = Save.open(st, OPTS);
  S.data.loadouts[7] = ['牧人測試']; // 存檔裡出現中文也要能來回
  const code = Save.encode(S.data);
  assert.match(code, /^SF5\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/);
  const r = Save.decode(code.slice(0, 40) + '\n  ' + code.slice(40) + ' \n', OPTS);
  assert.ok(r.data, r.error);
  assert.deepStrictEqual(r.data.loadouts[7], ['牧人測試']);
  assert.deepStrictEqual(r.data.progress, S.data.progress);
  assert.strictEqual(r.data.checkpoints[2].levelId, 2);
});

test('存檔碼少字、改字、不是存檔碼、未來版本：各給一句人話', () => {
  const S = Save.open(legacyStore(), OPTS);
  const code = Save.encode(S.data);
  assert.match(Save.decode(code.slice(0, 20) + code.slice(24), OPTS).error, /少了字|改過/);
  const tampered = code.replace(/^SF5\.(.)/, (m, c) => 'SF5.' + (c === 'A' ? 'B' : 'A'));
  assert.match(Save.decode(tampered, OPTS).error, /少了字|改過/);
  assert.match(Save.decode('hello world', OPTS).error, /不是羊圈守夜/);
  assert.match(Save.decode('', OPTS).error, /還沒貼/);
  assert.match(Save.decode(code.replace(/^SF5/, 'SF9'), OPTS).error, /更新/);
});

test('replace 整份覆蓋後寫入；summary 算得出守過幾夜', () => {
  const st = Save.memoryStore();
  const S = Save.open(st, OPTS);
  const other = Save.open(legacyStore(), OPTS).data;
  assert.ok(S.replace(other));
  assert.deepStrictEqual(S.data.progress.cleared[2], { calm: true });
  assert.deepStrictEqual(Save.summary(S.data), { nights: 2, checkpoints: 1, trials: 0, trialCheckpoints: 0, updated: '2026-10-30T01:00:00.000Z', created: '2026-10-30T00:00:00.000Z' });
  assert.strictEqual(S.replace('garbage'), false);
});

test('寫不進去（配額滿）：save 回 false，不丟例外', () => {
  const st = Save.memoryStore();
  const S = Save.open(st, OPTS);
  st.set = () => { throw new Error('QuotaExceeded'); };
  assert.strictEqual(S.save(), false);
});

test('localStore 真的接得到 localStorage（假的全域物件）：舊 key 搬得動', () => {
  const m = new Map([['sheepfold-tutorial-done', '1'], ['sheepfold-diff', 'storm']]);
  globalThis.localStorage = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), get length() { return m.size; }, key: i => [...m.keys()][i] };
  try {
    const S = Save.open(Save.localStore(), OPTS);
    assert.strictEqual(S.status, 'migrated');
    assert.strictEqual(S.data.tutorial, true);
    assert.strictEqual(S.data.prefs.diff, 'storm');
    assert.ok(m.has(Save.KEY)); assert.ok(!m.has('sheepfold-diff'));
  } finally { delete globalThis.localStorage; }
});

test('主檔已有（空的，舊版快取寫的）但舊 key 還在：舊紀錄併進來、舊 key 刪掉、老玩家標回 returning', () => {
  const st = legacyStore();
  const blank = Save.empty('2026-10-29T00:00:00.000Z'); blank.playerKind = 'new'; blank.announced = 'x'; blank.prefs.analytics = false;
  st.set(Save.KEY, JSON.stringify(blank));
  const S = Save.open(st, OPTS);
  assert.strictEqual(S.status, 'migrated');
  assert.deepStrictEqual(S.data.progress.cleared[1], { calm: true, windy: true });
  assert.strictEqual(S.data.progress.best['2:calm'].score, 7);
  assert.strictEqual(S.data.checkpoints[2].levelId, 2);
  assert.deepStrictEqual(S.data.prefs.sound, { sfx: true, amb: true, vol: 2 }, '新檔沒玩過：設定用舊的');
  assert.strictEqual(S.data.prefs.analytics, false, '統計開關維持新檔的');
  assert.strictEqual(S.data.playerKind, 'returning');
  assert.strictEqual(S.data.announced, 'x');
  assert.ok(S.problems.some(p => p.includes('找回')));
  assert.strictEqual(st.get('sheepfold-progress-v3'), null);
  assert.ok(JSON.parse(st.get(Save.KEY)).progress.cleared[1].windy);
});

test('主檔已有進度、舊 key 也有：取聯集、最高紀錄取高分、設定以新檔為準', () => {
  const st = legacyStore();
  const mine = Save.empty('2026-10-29T00:00:00.000Z');
  mine.progress.cleared = { 2: { storm: true } }; mine.progress.best = { '2:calm': { score: 9, cleared: true, wave: 8 } }; mine.prefs.sound.vol = 0; mine.playerKind = 'new';
  st.set(Save.KEY, JSON.stringify(mine));
  const S = Save.open(st, OPTS);
  assert.deepStrictEqual(S.data.progress.cleared[2], { calm: true, storm: true });
  assert.deepStrictEqual(S.data.progress.cleared[1], { calm: true, windy: true });
  assert.strictEqual(S.data.progress.best['2:calm'].score, 9);
  assert.strictEqual(S.data.prefs.sound.vol, 0);
  assert.strictEqual(S.data.playerKind, 'new');
});

// ====== v5：守夜試煉（期 2，2026-10-30）======
test('v4 主檔升到 v5：多出 trials 四格，其餘原樣；SF4 存檔碼也讀得進來', () => {
  const v4 = { version: 4, created: '2026-10-29T00:00:00.000Z', updated: '2026-10-29T00:00:00.000Z', progress: { cleared: { 7: { calm: true } }, best: {}, stars: {} }, checkpoints: {}, loadouts: {}, seen: { intro: [], cards: [], enemies: [] }, tutorial: true, prefs: { diff: 'windy' }, announced: 'x', playerKind: 'returning' };
  const st = Save.memoryStore({ [Save.KEY]: JSON.stringify(v4) });
  const S = Save.open(st, OPTS);
  assert.strictEqual(S.status, 'ok'); assert.strictEqual(S.data.version, 5);
  assert.deepStrictEqual(S.data.trials, { cleared: {}, best: {}, checkpoints: {}, loadouts: {} });
  assert.deepStrictEqual(S.data.progress.cleared, { 7: { calm: true } }); assert.strictEqual(S.data.prefs.diff, 'windy');
  assert.ok(st.get(Save.KEY).startsWith('{"version":5'));
  // 舊版遊戲匯出的 SF4 碼：版本不比現在新，照收
  const body = Buffer.from(JSON.stringify(v4), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
  const r = Save.decode(`SF4.${body}.${fnv(body)}`, OPTS);
  assert.ok(r.data, r.error); assert.strictEqual(r.data.version, 5); assert.deepStrictEqual(r.data.trials.cleared, {});
});

test('trials 欄位：過關、紀錄、檢查點、隊伍都存得回來；壞的試煉檢查點只丟那一份並說一聲；垃圾型別丟掉', () => {
  const st = Save.memoryStore();
  const S = Save.open(st, OPTS);
  const T = D.TRIALS[0], G = E.create(T.levelId, T.diff, () => 0.5, T.mods); assert.ok(E.place(G, 2, 1, 'slinger').ok); G.wave = 1;
  const snap = JSON.parse(JSON.stringify(E.snapshot(G)));
  S.data.trials.cleared.t5 = true; S.data.trials.best.t5 = { wave: 4, cleared: true, food: 230 }; S.data.trials.best.t2 = { wave: 2, cleared: false };
  S.data.trials.checkpoints[T.id] = snap; S.data.trials.checkpoints.t9 = { levelId: 2, diff: 'calm', wave: 'bad' }; S.data.trials.checkpoints.t8 = 'junk';
  S.data.trials.loadouts.t6 = ['slinger', 'wall', 7];
  assert.ok(S.save());
  const S2 = Save.open(st, OPTS);
  assert.deepStrictEqual(S2.data.trials.cleared, { t5: true });
  assert.deepStrictEqual(S2.data.trials.best, { t5: { wave: 4, cleared: true, food: 230 }, t2: { wave: 2, cleared: false } });
  assert.deepStrictEqual(Object.keys(S2.data.trials.checkpoints), [T.id]);
  assert.deepStrictEqual(S2.data.trials.checkpoints[T.id].mods, snap.mods, '修飾詞跟著檢查點存');
  assert.ok(S2.problems.some(p => p.includes('試煉 t9')), S2.problems.join('；'));
  assert.deepStrictEqual(S2.data.trials.loadouts.t6, ['slinger', 'wall']);
  assert.deepStrictEqual(Save.summary(S2.data), { nights: 0, checkpoints: 0, trials: 1, trialCheckpoints: 1, updated: S2.data.updated, created: S2.data.created });
  // 存檔碼來回也帶著
  const r = Save.decode(Save.encode(S2.data), OPTS); assert.ok(r.data); assert.deepStrictEqual(r.data.trials.cleared, { t5: true });
  // trials 不是物件：當沒有
  const r2 = Save.validate({ version: 5, trials: 'nope' }, OPTS); assert.deepStrictEqual(r2.data.trials, { cleared: {}, best: {}, checkpoints: {}, loadouts: {} });
});
