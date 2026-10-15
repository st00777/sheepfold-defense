// 羊圈守夜 · 引擎。純邏輯、不碰畫面，Node 可以直接跑來模擬。
// 用法：const G = Engine.create(levelId, diffKey, rng); Engine.place(G, r, c, key); Engine.step(G, dt)
// 每一步會把要畫的事放進 G.events（toast／pop／callout／fx／unit／win／lose），畫面層讀完就清掉。
'use strict';
(function (root) {
  const D = (typeof module !== 'undefined') ? require('./data.js') : root.DATA;
  const { ROWS, COLS, UNITS, ENEMIES, STATUS, DIFFS, LEVELS, ELDER_MUL, ELDER_COST, REPAIR_COST, REPAIR_HP, REPAIR_CD, PREP_TIME, WAVE_REST, FORESHADOW_LEAD, START_FOOD, TRICKLE } = D;

  const SHOT_SPEED = { stone: 6, arrow: 9, sling: 7 };
  const THICK_MUL = 0.35; // 厚皮敵人吃石子、箭的比例
  const LOB_TIME = 0.8;

  // 牧人送糧間隔：暴風夜拉長，但後面的關卡一樣打折
  function shepherdEvery(G) { const sc = G.level.diffScale ?? 0.6; return UNITS.shepherd.every + (DIFFS[G.diff].shepherdEvery - UNITS.shepherd.every) * sc; }

  function levelById(id) { return LEVELS.find(l => l.id === id) || LEVELS[0]; }

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

  function create(levelId, diffKey, rng) {
    const level = levelById(levelId);
    const waves = scaleWaves(level, diffKey);
    const G = {
      levelId: level.id, level, diff: diffKey, waves, rng: rng || Math.random,
      rocks: new Set((level.rocks || []).map(([r, c]) => r + ',' + c)),
      food: START_FOOD, trickle: 0,
      phase: 'prep', wave: 0, timer: level.prep || PREP_TIME,
      queue: [], spawnTimer: 0, spawnedTotal: 0, killed: 0,
      total: waves.reduce((n, w) => n + w.list.reduce((m, [, k]) => m + k, 0), 0),
      nextRow: null, nextType: null,
      units: {}, enemies: [], shots: [], fx: [],
      sheep: level.sheep || 0, sheepLost: 0,
      over: false, result: null, events: [], seen: new Set(),
      nextId: 1, time: 0,
    };
    return G;
  }

  const ev = (G, e) => G.events.push(e);
  const key = (r, c) => r + ',' + c;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.r - b.r);

  // ====== 放置／點擊 ======
  function canAfford(G, k) { return G.food >= UNITS[k].cost; }

  // 回傳 { ok, msg }
  function place(G, r, c, k) {
    if (G.over) return { ok: false };
    const def = UNITS[k];
    if (!def) return { ok: false };
    if (!G.level.units.includes(k)) return { ok: false, msg: '這一關還沒有這張卡' };
    if (G.rocks.has(key(r, c))) return { ok: false, msg: '這格是石頭' };
    if (G.units[key(r, c)]) return { ok: false, msg: '這格已經有人了' };
    if (G.food < def.cost) return { ok: false, msg: `糧不夠，${def.name}要 ${def.cost} 糧` };
    G.food -= def.cost;
    if (def.kind === 'instant') { useInstant(G, r, c, k); return { ok: true, msg: `${def.name}打破了` }; }
    const u = { id: G.nextId++, type: k, r, c, hp: def.hp, maxHp: def.hp, timer: def.every ? def.every * 0.6 : 0, fear: 0, elder: false };
    if (def.kind === 'dog') { u.x = c; u.holding = null; }
    if (def.kind === 'floor') { u.uses = def.uses || Infinity; u.stung = new Set(); }
    if (k === 'horn') u.timer = 6; // 剛放下不會馬上吹
    G.units[key(r, c)] = u;
    ev(G, { t: 'unit', r, c });
    return { ok: true, msg: `${def.name}就位` };
  }

  // 沒選卡時點已有的單位：牧人升級、牆修補
  function tapUnit(G, r, c) {
    if (G.over) return { ok: false };
    const u = G.units[key(r, c)];
    if (!u) return { ok: false, msg: '先點一張卡' };
    const def = UNITS[u.type];
    if (def.kind === 'producer' && !u.elder) {
      if (G.food < ELDER_COST) return { ok: false, msg: `升老牧人要 ${ELDER_COST} 糧` };
      G.food -= ELDER_COST; u.elder = true; u.timer = Math.min(u.timer, def.every * ELDER_MUL);
      ev(G, { t: 'unit', r, c }); ev(G, { t: 'pop', r, c, text: '老牧人' });
      return { ok: true, msg: '升成老牧人了，送糧更快' };
    }
    if (def.kind === 'blocker' && u.hp < u.maxHp) {
      if (G.food < REPAIR_COST) return { ok: false, msg: `修補要 ${REPAIR_COST} 糧` };
      if (u.repairAt && G.time < u.repairAt) return { ok: false, msg: '剛修過，等一下再修' };
      G.food -= REPAIR_COST; u.hp = Math.min(u.maxHp, u.hp + REPAIR_HP); u.repairAt = G.time + REPAIR_CD;
      ev(G, { t: 'unit', r, c }); ev(G, { t: 'pop', r, c, text: '修好了' });
      return { ok: true, msg: `${def.name}修補了` };
    }
    return { ok: false, msg: def.kind === 'producer' ? '已經是老牧人了' : def.kind === 'blocker' ? '牆還好好的' : '這格已經有人了' };
  }

  function useInstant(G, r, c, k) {
    const def = UNITS[k];
    ev(G, { t: 'fx', kind: 'blast', r, x: c });
    for (const e of G.enemies) {
      if (e.underground) continue;
      if (Math.abs(e.r - r) <= 1 && Math.abs(e.x + 0.5 - (c + 0.5)) <= 1.3) {
        hurt(G, e, def.dmg);
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
    G.spawnTimer = 0;
    ev(G, { t: 'toast', msg: w.say });
  }

  // 下一隻還沒出現，先決定牠走哪一排，畫面層印腳印（或牠的圖示）
  function foreshadow(G, i) {
    if (G.nextRow !== null) return;
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
    G.nextRow = rows[Math.floor(G.rng() * rows.length)];
    G.nextType = type;
    ev(G, { t: 'marker', r: G.nextRow, type });
  }

  function spawn(G, type) {
    const w = G.waves[G.wave - 1];
    const r = G.nextRow ?? w.rows[Math.floor(G.rng() * w.rows.length)];
    G.nextRow = null; G.nextType = null;
    ev(G, { t: 'marker', r: null });
    spawnAt(G, type, r, COLS, w.hpMul || 1);
    G.spawnedTotal++;
  }
  // 在指定位置放一隻敵人（波次用，開發者模式也用）
  function spawnAt(G, type, r, x, hpMul) {
    const def = ENEMIES[type];
    const hp = Math.round(def.hp * (hpMul || 1));
    const e = { id: G.nextId++, type, r, x, hp, maxHp: hp, st: {}, heldBy: null, biting: null,
      underground: !!def.digs, vaulted: false, vaulting: 0, carrying: false, enraged: false, abilityT: def.howl ? 3 : def.roar ? 4 : 0, dead: false };
    if (def.digs) { e.emergeX = 2 + Math.floor(G.rng() * 3); e.mound = false; }
    G.enemies.push(e);
    ev(G, { t: 'spawn', e });
    if (!G.seen.has(type)) { G.seen.add(type); if (def.tip) ev(G, { t: 'callout', type, tip: def.tip }); }
  }

  // ====== 傷害與狀態 ======
  function hurt(G, e, dmg) { e.hp -= dmg; }
  function release(G, e) {
    if (e.heldBy) { const d = findUnitById(G, e.heldBy); if (d) d.holding = null; e.heldBy = null; }
  }
  function findUnitById(G, id) { for (const k in G.units) if (G.units[k].id === id) return G.units[k]; return null; }
  function ignite(G, e) { if (!e.st.burn) { e.st.burn = STATUS.burn.t; ev(G, { t: 'fx', kind: 'ignite', r: e.r, x: e.x }); } }

  function speedOf(e) {
    const def = ENEMIES[e.type];
    if (e.underground) return def.digSpeed;
    let s = def.speed;
    if (e.st.slow) s *= STATUS.slow.mul;
    if (e.st.howl) s *= STATUS.howl.mul;
    if (e.enraged) s *= 2;
    return s;
  }
  function biteOf(e) {
    const def = ENEMIES[e.type];
    let b = def.bite;
    if (e.st.poison) b *= STATUS.poison.biteMul;
    if (e.enraged) b *= 2;
    return b;
  }
  const targetable = e => !e.underground && !e.dead;

  // ====== 每一步 ======
  function step(G, dt) {
    if (G.over) return;
    G.time += dt;

    // 糧慢慢來
    G.trickle += dt;
    if (G.trickle >= TRICKLE.every) { G.trickle -= TRICKLE.every; G.food += TRICKLE.gives; }

    // 波次節奏
    if (G.phase === 'prep' || G.phase === 'rest') {
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
        G.phase = 'rest'; G.timer = WAVE_REST;
        const next = G.waves[G.wave];
        ev(G, { t: 'toast', msg: G.wave >= G.waves.length ? '最後一隻跑了……' : (next.hint ? `${G.level.speaker || '牧人'}：${next.hint}` : `第 ${G.wave} 波擋住了，喘口氣`) });
      }
    }

    unitsAct(G, dt);
    shotsFly(G, dt);
    enemiesMove(G, dt);
    if (G.over) return;

    // 清掉死掉的
    G.enemies = G.enemies.filter(e => {
      if (e.hp <= 0 || e.dead) {
        release(G, e);
        if (e.carrying && !e.dead) ev(G, { t: 'toast', msg: '追上了，羊抱回來了 🐑' });
        G.killed++; // 逃走的偷羊人也算這一波結束了，進度條才會走滿
        ev(G, { t: 'die', e });
        return false;
      }
      return true;
    });
    G.shots = G.shots.filter(s => !s.dead);
    for (const k in G.units) { const u = G.units[k]; if (u.hp <= 0) removeUnit(G, u); }
  }

  function removeUnit(G, u) {
    if (u.holding) { const e = G.enemies.find(x => x.id === u.holding); if (e) e.heldBy = null; }
    delete G.units[key(u.r, u.c)];
    ev(G, { t: 'unit', r: u.r, c: u.c });
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
        if (def.flees && inRow.some(e => !ENEMIES[e.type].flying && e.x - u.c < def.flees && e.x > u.c - 0.5)) {
          for (const e of inRow) if (!ENEMIES[e.type].flying && e.x > u.c - 0.5) { e.st.distract = 3; release(G, e); }
          ev(G, { t: 'toast', msg: '雇工看見狼來，撇下羊逃走了' });
          ev(G, { t: 'fx', kind: 'flee', r: u.r, x: u.c });
          u.hp = 0; continue;
        }
        u.timer -= dt;
        if (u.timer > 0) continue;
        const range = def.range || COLS + 1;
        const targets = inRow.filter(e => e.x > u.c - 0.2 && e.x - u.c <= range);
        if (!targets.length) continue;
        u.timer = def.every;
        if (def.shot === 'lob') {
          const far = targets.reduce((a, b) => (a.x > b.x ? a : b));
          G.shots.push({ id: G.nextId++, kind: 'lob', r: u.r, x: u.c + 0.5, from: u.c + 0.5, landX: far.x + 0.5, t: 0, dmg: def.dmg, splash: def.splash });
        } else {
          G.shots.push({ id: G.nextId++, kind: def.shot, r: u.r, x: u.c + 0.6, dmg: def.dmg, pierce: !!def.pierce, falloff: def.falloff || 1, hit: new Set(), burn: false });
        }
      } else if (def.kind === 'dog') {
        dogAct(G, u, def, dt);
      } else if (def.kind === 'floor') {
        for (const e of G.enemies) {
          if (e.r !== u.r || !targetable(e) || ENEMIES[e.type].flying) continue;
          if (Math.abs(e.x - u.c) >= 0.5) continue;
          if (def.poison && !u.stung.has(e.id)) {
            u.stung.add(e.id); e.st.poison = def.poison; u.uses--;
            ev(G, { t: 'fx', kind: 'sting', r: e.r, x: e.x }); ev(G, { t: 'unit', r: u.r, c: u.c });
            if (u.uses <= 0) { u.hp = 0; }
          }
          if (def.slow) { e.st.slow = 0.15; hurt(G, e, def.dps * dt); u.hp -= def.wear * dt; if (G.rng() < dt * 3) ev(G, { t: 'unit', r: u.r, c: u.c }); if (u.hp <= 0) break; }
        }
        if (u.hp <= 0) ev(G, { t: 'unit', r: u.r, c: u.c });
      } else if (def.kind === 'support') {
        if (def.every) {
          u.timer -= dt;
          if (u.timer > 0) continue;
          if (def.heal) {
            u.timer = def.every;
            for (const k2 in G.units) { const v = G.units[k2]; if (v === u || Math.abs(v.r - u.r) > 1 || Math.abs(v.c - u.c) > 1) continue; if (v.hp < v.maxHp && v.maxHp > 1) { v.hp = Math.min(v.maxHp, v.hp + def.heal); ev(G, { t: 'unit', r: v.r, c: v.c }); } }
          } else if (def.push) {
            const ground = inRow.filter(e => !ENEMIES[e.type].flying);
            if (!ground.length) continue;
            u.timer = def.every;
            for (const e of ground) { e.x = Math.min(COLS + 0.2, e.x + def.push); e.st.stun = def.stun; release(G, e); }
            ev(G, { t: 'fx', kind: 'horn', r: u.r, x: u.c });
            ev(G, { t: 'toast', msg: '角聲一響，那排的狼退了一步' });
          }
        }
      }
    }
  }

  function dogAct(G, u, def, dt) {
    const held = u.holding ? G.enemies.find(e => e.id === u.holding) : null;
    if (held && targetable(held) && !held.st.panic) {
      u.x = held.x - 0.55;
      hurt(G, held, def.dps * dt);
      return;
    }
    if (held) { held.heldBy = null; }
    u.holding = null;
    const cands = G.enemies.filter(e => e.r === u.r && targetable(e) && !ENEMIES[e.type].flying && !e.heldBy && !e.st.panic && e.x > -0.3 && e.x < COLS + 0.2);
    if (cands.length) {
      const pr = e => (e.carrying ? 9 : (ENEMIES[e.type].prio || 1));
      const e = cands.reduce((a, b) => (pr(b) > pr(a) || (pr(b) === pr(a) && Math.abs(b.x - u.x) < Math.abs(a.x - u.x)) ? b : a));
      const goal = e.x - 0.55;
      const d = goal - u.x;
      if (Math.abs(d) < 0.12) { u.x = goal; u.holding = e.id; e.heldBy = u.id; ev(G, { t: 'fx', kind: 'bark', r: u.r, x: u.x }); }
      else u.x += Math.sign(d) * Math.min(Math.abs(d), def.run * dt);
    } else {
      const d = u.c - u.x;
      if (Math.abs(d) > 0.01) u.x += Math.sign(d) * Math.min(Math.abs(d), def.run * dt);
    }
  }

  // 投射物
  function shotsFly(G, dt) {
    for (const s of G.shots) {
      if (s.kind === 'lob') {
        s.t += dt / LOB_TIME;
        s.x = s.from + (s.landX - s.from) * Math.min(1, s.t);
        if (s.t >= 1) {
          s.dead = true;
          ev(G, { t: 'fx', kind: 'splash', r: s.r, x: s.landX - 0.5 });
          for (const e of G.enemies) if (e.r === s.r && targetable(e) && Math.abs(e.x + 0.5 - s.landX) < s.splash) hurt(G, e, s.dmg);
        }
        continue;
      }
      const prev = s.x;
      s.x += SHOT_SPEED[s.kind] * dt;
      // 穿過火盆就著火
      for (const k in G.units) { const u = G.units[k]; if (u.r === s.r && UNITS[u.type].ignite && prev < u.c + 0.5 && s.x >= u.c + 0.5) s.burn = true; }
      for (const e of G.enemies) {
        if (e.r !== s.r || !targetable(e) || s.hit.has(e.id)) continue;
        if (Math.abs(e.x + 0.5 - s.x) >= 0.35) continue;
        s.hit.add(e.id);
        const def = ENEMIES[e.type];
        if (def.dodge && G.rng() < def.dodge) { ev(G, { t: 'fx', kind: 'dodge', r: e.r, x: e.x }); continue; }
        hurt(G, e, (def.thick && (s.kind === 'stone' || s.kind === 'arrow')) ? s.dmg * THICK_MUL : s.dmg);
        if (s.burn) ignite(G, e);
        if (s.pierce) { s.dmg *= s.falloff; } else { s.dead = true; break; }
      }
      if (s.x > COLS + 1) s.dead = true;
    }
  }

  // 敵人走路、咬東西、特殊能力
  function enemiesMove(G, dt) {
    for (const e of G.enemies) {
      if (e.dead) continue;
      const def = ENEMIES[e.type];

      // 狀態倒數
      for (const k of ['burn', 'poison', 'slow', 'stun', 'panic', 'howl', 'distract']) if (e.st[k]) { e.st[k] -= dt; if (e.st[k] <= 0) delete e.st[k]; }
      if (e.st.burn) {
        hurt(G, e, STATUS.burn.dps * dt);
        for (const o of G.enemies) if (o !== e && o.r === e.r && targetable(o) && !o.st.burn && Math.abs(o.x - e.x) < 0.6) ignite(G, o);
      }
      if (e.st.poison) hurt(G, e, STATUS.poison.dps * dt);
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
            for (const k in G.units) { const u = G.units[k]; const d = Math.hypot(u.c - e.x, u.r - e.r); if (d <= 2 && !['floor', 'blocker', 'dog'].includes(UNITS[u.type].kind)) { u.fear = STATUS.fear.t; if (UNITS[u.type].flees) u.hp = 0; } }
            ev(G, { t: 'fx', kind: 'roar', r: e.r, x: e.x }); ev(G, { t: 'toast', msg: '獅子吼叫，附近的人都僵住了' });
          }
        }
      }

      // 鑽地：到了位置才冒出來；快到前先出土堆
      if (e.underground) {
        if (!e.mound && e.x - (e.emergeX + 0.5) < 0.7) { e.mound = true; ev(G, { t: 'fx', kind: 'mound', r: e.r, x: e.emergeX, id: e.id }); }
        if (e.x <= e.emergeX + 0.5) { e.underground = false; ev(G, { t: 'fx', kind: 'emerge', r: e.r, x: e.x, id: e.id }); }
        else { e.x -= speedOf(e) * dt; continue; }
      }

      // 驚慌：往右跑，不咬
      if (e.st.panic) { e.x = Math.min(COLS + 0.3, e.x + STATUS.panic.speed * dt); e.biting = null; continue; }
      if (e.st.stun || e.st.distract || e.heldBy) { e.biting = null; if (e.heldBy) biteDog(G, e, dt); continue; }
      if (e.vaulting > 0) { e.vaulting -= dt; if (e.vaulting <= 0) { e.x = e.vaultTo; e.vaulted = true; ev(G, { t: 'toast', msg: '賊翻過牆了！' }); } continue; }

      // 抱著羊往回跑
      if (e.carrying) {
        e.x += def.fleeSpeed * dt;
        if (e.x > COLS + 0.3) { e.dead = true; G.sheep--; G.sheepLost++; ev(G, { t: 'toast', msg: '一隻羊被抱走了 🐑' }); ev(G, { t: 'sheep' }); if (G.sheep <= 0) return lose(G, 'sheep'); }
        continue;
      }

      // 前面那格有沒有東西擋著（飛的直接飛過）
      let blocked = false;
      if (!def.flying) {
        const frontCol = Math.floor(e.x + 0.3);
        const b = G.units[key(e.r, frontCol)];
        if (b && e.x <= frontCol + 0.6 && ['blocker', 'producer', 'shooter', 'support'].includes(UNITS[b.type].kind)) {
          if (def.vaults && !e.vaulted && UNITS[b.type].kind === 'blocker' && !UNITS[b.type].tall) {
            e.vaulting = 1.2; e.vaultTo = frontCol - 0.45; ev(G, { t: 'fx', kind: 'vault', r: e.r, x: e.x }); continue;
          }
          blocked = true;
          const mul = (def.wallMul && UNITS[b.type].kind === 'blocker') ? def.wallMul : 1;
          b.hp -= biteOf(e) * mul * dt;
          e.biting = b.id;
          if (b.hp <= 0) { removeUnit(G, b); e.biting = null; if (def.wallMul && UNITS[b.type].kind === 'blocker') ev(G, { t: 'toast', msg: '獅子一口咬碎了牆' }); }
          else if (G.rng() < dt * 4) ev(G, { t: 'unit', r: e.r, c: frontCol });
        }
      }
      if (!blocked) { e.biting = null; e.x -= speedOf(e) * dt; }

      // 走到底
      if (e.x < -0.6) {
        if (def.steals && G.sheep > 0) { e.carrying = true; e.x = -0.5; ev(G, { t: 'toast', msg: '偷羊人抱起一隻羊往回跑了！' }); ev(G, { t: 'fx', kind: 'grab', r: e.r, x: 0 }); continue; }
        return lose(G, def.flying ? 'bird' : 'wolf');
      }
    }
  }

  function biteDog(G, e, dt) {
    const d = findUnitById(G, e.heldBy);
    if (!d) { e.heldBy = null; return; }
    d.hp -= biteOf(e) * dt;
    if (G.rng() < dt * 3) ev(G, { t: 'unit', r: d.r, c: d.c });
  }

  // ====== 勝負 ======
  function win(G) { G.over = true; G.result = { win: true }; ev(G, { t: 'win' }); }
  function lose(G, reason) { G.over = true; G.result = { win: false, reason }; ev(G, { t: 'lose', reason }); }

  // ====== 開發者模式 ======
  const dev = {
    spawn(G, type, r, c) { if (G.over || !ENEMIES[type]) return; const w = G.waves[G.wave - 1]; spawnAt(G, type, r, c, w ? w.hpMul : 1); G.total++; },
    clear(G) { for (const e of G.enemies) { release(G, e); e.dead = true; } G.total -= G.enemies.length; G.enemies = []; G.queue = []; G.nextRow = null; G.nextType = null; ev(G, { t: 'marker', r: null }); if (G.phase === 'wave') { G.phase = 'rest'; G.timer = WAVE_REST; } },
    nextWave(G) { if (G.over) return; if (G.phase === 'wave') { dev.clear(G); } G.timer = Math.min(G.timer, 0.5); },
    food(G, n) { G.food += n; },
    allCards(G) { G.level = { ...G.level, units: Object.keys(UNITS), fresh: [] }; },
  };

  const Engine = { create, place, tapUnit, step, canAfford, levelById, scaleWaves, dev };
  if (typeof module !== 'undefined') module.exports = Engine; else root.Engine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
