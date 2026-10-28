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
  assert.ok(st.get(Save.KEY).startsWith('{"version":4'), '接回來的立刻寫回主檔');
});

test('主檔壞掉、沒備份：從頭開始、status broken、壞檔留著', () => {
  const st = Save.memoryStore({ [Save.KEY]: 'not json at all' });
  const S = Save.open(st, OPTS);
  assert.strictEqual(S.status, 'broken');
  assert.deepStrictEqual(S.data.progress.cleared, {});
  assert.strictEqual(st.get(Save.BROKEN), 'not json at all');
});

test('來自未來版本的主檔：不碰它當壞檔處理、不覆蓋原文', () => {
  const st = Save.memoryStore({ [Save.KEY]: JSON.stringify({ version: 99, progress: {} }) });
  const S = Save.open(st, OPTS);
  assert.strictEqual(S.status, 'broken');
  assert.ok(S.problems.some(p => p.includes('更新')), S.problems.join('|'));
  assert.ok(st.get(Save.BROKEN).includes('"version":99'));
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
  assert.match(code, /^SF4\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/);
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
  const tampered = code.replace(/^SF4\.(.)/, (m, c) => 'SF4.' + (c === 'A' ? 'B' : 'A'));
  assert.match(Save.decode(tampered, OPTS).error, /少了字|改過/);
  assert.match(Save.decode('hello world', OPTS).error, /不是羊圈守夜/);
  assert.match(Save.decode('', OPTS).error, /還沒貼/);
  assert.match(Save.decode(code.replace(/^SF4/, 'SF9'), OPTS).error, /更新/);
});

test('replace 整份覆蓋後寫入；summary 算得出守過幾夜', () => {
  const st = Save.memoryStore();
  const S = Save.open(st, OPTS);
  const other = Save.open(legacyStore(), OPTS).data;
  assert.ok(S.replace(other));
  assert.deepStrictEqual(S.data.progress.cleared[2], { calm: true });
  assert.deepStrictEqual(Save.summary(S.data), { nights: 2, checkpoints: 1, updated: '2026-10-30T01:00:00.000Z', created: '2026-10-30T00:00:00.000Z' });
  assert.strictEqual(S.replace('garbage'), false);
});

test('寫不進去（配額滿）：save 回 false，不丟例外', () => {
  const st = Save.memoryStore();
  const S = Save.open(st, OPTS);
  st.set = () => { throw new Error('QuotaExceeded'); };
  assert.strictEqual(S.save(), false);
});
