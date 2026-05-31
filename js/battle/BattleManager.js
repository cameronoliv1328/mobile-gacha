/* =========================================================================
 * Last Wall — BattleManager.js   (mirrors BP_BattleManager)
 * Orchestrates a single city defense: scene setup, hero deployment with
 * support units, the 10-wave state machine, enemy spawning + spline blocking,
 * all combat queries, between-wave upgrades, rewards and win/lose.
 *
 * Phases: prep -> fighting -> (upgrade -> fighting)* -> victory | defeat
 * ========================================================================= */
window.LW = window.LW || {};

LW.BattleManager = class BattleManager extends LW.util.Emitter {
  constructor(game, cityIndex) {
    super();
    this.game = game;
    this.cityIndex = cityIndex;
    this.cityName = LW.Levels.cityName(cityIndex);

    this.lanes = LW.Config.lanes.map((l) => new LW.Spline(l.points));
    this.blockLane = LW.Config.blockLane;
    this.spline = this.lanes[this.blockLane]; // centre lane = the Fighter's lane
    this.map = new LW.BattleMap(this);
    this.wall = new LW.CityWall();
    this.turret = new LW.Turret(this, this.map.getAnchor("Anchor_Turret_Main"));

    // The Fighter blocks the centre lane; compute its choke distances. Side
    // lanes have no melee blocker and must be cleared by ranged + turret.
    const fa = this.map.getAnchor("Anchor_Bridge_Hero");
    this.blockDistance = this._distanceOn(this.spline, fa.x, fa.y + 4);
    this.gateDistance = Math.max(0, this.blockDistance - 150);
    this.laneGate = this.lanes.map((s) => this._gateDistOn(s, 690)); // for burrowers

    this.heroes = [];
    this.heroesByPos = {};
    this.bridgeHero = null;
    this.synergy = null;

    // Roguelite wave state.
    this.affix = LW.Config.AFFIXES[0]; // current wave modifier
    this.pendingAffix = null; // chosen for the next wave
    this.affixHeroRangeMult = 1;
    this.nextWaveData = null; // pre-generated next wave (drives the preview)
    this.waveOptions = []; // [{ affix }] offered between waves
    this.units = []; // support units
    this.enemies = [];
    this.projectiles = [];
    this.effects = [];

    this.runBuffs = { heroAtk: 1, heroHp: 1 };
    this.purchaseCounts = { hero: 0, wall: 0, turret: 0 };

    this.cityMaxHP = LW.Config.CITY_BASE_HP;
    this.cityHP = this.cityMaxHP;

    this.waveIndex = 0;
    this.waveSpawns = [];
    this.spawnCursor = 0;
    this.waveTimer = 0;
    this.killCount = 0;

    this.speed = 1;
    this.t = 0;
    this.phase = "prep";
    this.prepTimer = 1.1;
  }

  /* ---- Setup ---------------------------------------------------------- */

  start() {
    this._deployTeam();
    this.affix = LW.Config.AFFIXES[0];
    this.nextWaveData = LW.Levels.getWave(this.cityIndex, 0);
    this.phase = "prep";
    this.prepTimer = 1.1;
    this.emit("phase", this.phase);
  }

  _distanceAtPoint(px, py) {
    return this._distanceOn(this.spline, px, py);
  }

  // Arc-length distance of the sample nearest (px,py) on a given spline.
  _distanceOn(spline, px, py) {
    let best = 0;
    let bestD = Infinity;
    for (const s of spline.samples) {
      const d = LW.util.dist2(px, py, s.x, s.y);
      if (d < bestD) {
        bestD = d;
        best = s.d;
      }
    }
    return best;
  }

  // Distance of the sample whose Y is closest to a target (used for gates).
  _gateDistOn(spline, y) {
    let best = 0;
    let bestD = Infinity;
    for (const s of spline.samples) {
      const d = Math.abs(s.y - y);
      if (d < bestD) {
        bestD = d;
        best = s.d;
      }
    }
    return best;
  }

  // Which lane a spawn enters. Bosses take the centre (the Fighter's lane).
  pickLane(def) {
    if (def && def.isBoss) return this.blockLane;
    const w = LW.Config.laneWeights;
    let r = Math.random() * (w[0] + w[1] + w[2]);
    for (let i = 0; i < w.length; i++) {
      if (r < w[i]) return i;
      r -= w[i];
    }
    return this.blockLane;
  }

  _deployTeam() {
    const A = this.map.anchors;
    const team = this.game.heroes.getTeam();
    const slots = [
      { pos: "bridge", id: team.bridge, hero: "Anchor_Bridge_Hero", units: ["Anchor_Bridge_Unit_1", "Anchor_Bridge_Unit_2"] },
      { pos: "left", id: team.left, hero: "Anchor_Bastion_Left_Hero", units: ["Anchor_Bastion_Left_Unit_1", "Anchor_Bastion_Left_Unit_2"] },
      { pos: "right", id: team.right, hero: "Anchor_Bastion_Right_Hero", units: ["Anchor_Bastion_Right_Unit_1", "Anchor_Bastion_Right_Unit_2"] },
    ];
    for (const s of slots) {
      const def = LW.HeroData.byId(s.id);
      if (!def) continue;
      const base = this.game.heroes.computeStats(s.id);
      const am = this.game.heroes.abilityMods(s.id);
      const ha = A[s.hero];
      const hero = new LW.Hero(this, { def, position: s.pos, x: ha.x, y: ha.y, baseStats: base, abilityMods: am });
      hero.unitAnchors = s.units.map((n) => A[n]);
      hero.spawnSupportUnits(hero.unitAnchors);
      this.heroes.push(hero);
      this.heroesByPos[s.pos] = hero;
      if (s.pos === "bridge") this.bridgeHero = hero;
    }

    // Team synergy from deployed elements (potency scales with Attunement).
    const deployed = this.heroes.map((h) => ({ element: h.element, attuned: this.game.heroes.isAttuned(h.heroId) }));
    this.synergy = LW.Synergy.compute(deployed);
    for (const h of this.heroes) {
      h.synergyMods = this.synergy;
      h.applyBuffs();
    }
  }

  /* ---- Wave flow ------------------------------------------------------ */

  startWave(idx) {
    this.waveIndex = idx;
    this.affix = this.pendingAffix || LW.Config.AFFIXES[0];
    this.pendingAffix = null;
    this.affixHeroRangeMult = (this.affix.hero && this.affix.hero.rangeMult) || 1;

    const wave = this.nextWaveData || LW.Levels.getWave(this.cityIndex, idx);
    this.nextWaveData = null;
    this.waveScale = wave.scale;
    this.isBossWave = wave.isBoss;

    // Swarm affix: extra spawns interleaved.
    let spawns = wave.spawns.slice();
    if (this.affix.count && this.affix.count > 1) {
      const base = spawns.slice();
      const extra = Math.round(base.length * (this.affix.count - 1));
      let t = base.length ? base[base.length - 1].t : 1;
      for (let i = 0; i < extra; i++) {
        t += 0.28;
        spawns.push({ enemyId: base[i % base.length].enemyId, t });
      }
      spawns.sort((a, b) => a.t - b.t);
    }
    this.waveSpawns = spawns;
    this.spawnCursor = 0;
    this.waveTimer = 0;

    // Revive + heal the squad and re-man each position with fresh units.
    for (const h of this.heroes) {
      h.alive = true;
      h.hp = h.maxHP;
      h.attackCD = Math.random() * h.attackInterval;
      h.resetForWave();
      for (const u of h.supportUnits) u.alive = false; // retire old squad quietly
      h.supportUnits = [];
      h.spawnSupportUnits(h.unitAnchors);
      h.applyBuffs();
    }
    this._cleanup();

    this.phase = "fighting";
    this.emit("phase", this.phase);
    this.emit("wavestart", idx);
  }

  continueToNextWave() {
    if (this.phase !== "upgrade") return;
    this.startWave(this.waveIndex + 1);
  }

  _onWaveCleared() {
    const goldMult = this.affix.reward || 1;
    const bonusCrystals = goldMult >= 1.5 ? 1 : 0;
    const reward = this.game.rewardWave(this.cityIndex, this.waveIndex, goldMult, bonusCrystals);
    this.emit("reward", { kind: "wave", reward, wave: this.waveIndex + 1 });

    if (this.waveIndex >= LW.Config.WAVES_PER_CITY - 1) {
      const cityReward = this.game.completeCity(this.cityIndex);
      this.phase = "victory";
      this.emit("phase", this.phase);
      this.emit("victory", { waveReward: reward, cityReward });
    } else {
      // Pre-generate the next wave + offer affix options to choose from.
      this.nextWaveData = LW.Levels.getWave(this.cityIndex, this.waveIndex + 1);
      this.waveOptions = this._genWaveOptions(this.nextWaveData.isBoss);
      this.pendingAffix = this.waveOptions[0].affix; // default: Standard
      this.phase = "upgrade";
      this.emit("phase", this.phase);
    }
  }

  _genWaveOptions(isBoss) {
    const all = LW.Config.AFFIXES;
    const standard = all[0];
    const others = LW.util.shuffle(all.slice(1));
    return [{ affix: standard }, { affix: others[0] }, { affix: others[1] }];
  }

  chooseWaveOption(i) {
    if (this.waveOptions[i]) {
      this.pendingAffix = this.waveOptions[i].affix;
      this.emit("change");
    }
  }

  // Dominant enemy types in the upcoming wave (for the threat preview).
  threatPreview() {
    if (!this.nextWaveData) return [];
    const counts = {};
    for (const s of this.nextWaveData.spawns) counts[s.enemyId] = (counts[s.enemyId] || 0) + 1;
    return Object.keys(counts)
      .map((id) => ({ id, n: counts[id], def: LW.EnemyData.byId(id) }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 4);
  }

  _applyAffix(e) {
    const m = this.affix && this.affix.enemy;
    if (!m) return;
    if (m.speedMult) e.baseSpeed *= m.speedMult;
    if (m.physResist) e.physResist = Math.min(0.85, e.physResist + m.physResist);
    if (m.atkMult) { e.baseAtk = Math.round(e.baseAtk * m.atkMult); e.atk = e.baseAtk; }
    if (m.hpMult) { e.maxHP = Math.max(1, Math.round(e.maxHP * m.hpMult)); e.hp = e.maxHP; }
    if (m.regen) e.affixRegen = m.regen;
  }

  _defeat() {
    if (this.phase === "defeat") return;
    this.phase = "defeat";
    this.emit("phase", this.phase);
    this.emit("defeat", {});
  }

  /* ---- Combat queries (used by entities) ------------------------------ */

  spawnProjectile(opts) {
    this.projectiles.push(new LW.Projectile(this, opts));
  }

  addEffect(e) {
    this.effects.push(e);
  }

  hasLivingBlocker() {
    return !!(this.bridgeHero && this.bridgeHero.alive);
  }

  bridgeBlockers() {
    const out = [];
    const h = this.bridgeHero;
    if (h && h.alive) {
      out.push(h);
      for (const u of h.supportUnits) if (u.alive) out.push(u);
    }
    return out;
  }

  nearestBlocker(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const b of this.bridgeBlockers()) {
      const d = LW.util.dist2(x, y, b.x, b.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  // Find a target in range. opts: { melee (can't hit flyers), priority }.
  bestTargetInRange(x, y, range, opts) {
    opts = opts || {};
    const r2 = range * range;
    const cand = [];
    for (const e of this.enemies) {
      if (!e.alive || !e.targetable) continue;
      if (opts.melee && e.flying) continue;
      if (LW.util.dist2(x, y, e.x, e.y) <= r2) cand.push(e);
    }
    if (!cand.length) return null;
    return this._byPriority(cand, opts.priority);
  }

  _byPriority(cand, mode) {
    if (mode === "flying") { const p = cand.filter((e) => e.flying); if (p.length) cand = p; }
    else if (mode === "support") { const p = cand.filter((e) => e.healer || e.bannerman); if (p.length) cand = p; }
    else if (mode === "armored") { const p = cand.filter((e) => e.armored || e.shieldHP > 0); if (p.length) cand = p; }
    let best = cand[0];
    for (const e of cand) {
      if (mode === "strong") { if (e.maxHP > best.maxHP) best = e; }
      else if (mode === "weak") { if (e.hp < best.hp) best = e; }
      // default: whoever is closest to breaching (fraction of its lane done) —
      // this makes ranged heroes cover the unblocked side lanes.
      else if (this._progress(e) > this._progress(best)) best = e;
    }
    return best;
  }

  _progress(e) {
    return e.splineDistance / (e.endDist || 1);
  }

  bestTargetsInRange(x, y, range, n) {
    const r2 = range * range;
    const inRange = this.enemies.filter((e) => e.alive && e.targetable && LW.util.dist2(x, y, e.x, e.y) <= r2);
    inRange.sort((a, b) => this._progress(b) - this._progress(a));
    return inRange.slice(0, n);
  }

  nearestEnemy(x, y, maxDist) {
    const m2 = maxDist * maxDist;
    let best = null;
    let bestD = m2;
    for (const e of this.enemies) {
      if (!e.alive || !e.targetable) continue;
      const d = LW.util.dist2(x, y, e.x, e.y);
      if (d <= bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  /* Resolve a hit: affinity multipliers, shield, frozen-shatter, status combos.
   * atk = { type:'physical'|'magic', element, status:{slow,burn}, applyStatus }. */
  damageEnemy(enemy, rawDmg, source, atk) {
    if (!enemy || !enemy.alive) return;
    atk = atk || {};
    const C = LW.Config.COMBAT;
    const type = atk.type || "physical";
    const element = atk.element || "Neutral";
    let mult = type === "magic" ? 1 - (enemy.magicResist || 0) : 1 - (enemy.physResist || 0);
    let flavor = "normal";
    if (enemy.weakType === type) { mult *= C.weakTypeMult; flavor = "weak"; }
    if (element !== "Neutral") {
      if (enemy.weakElement === element) { mult *= C.weakMult; flavor = "weak"; }
      else if (enemy.resistElement === element) { mult *= C.resistMult; flavor = "resist"; }
    }
    if (enemy.isFrozen()) mult *= C.status.frozen.bonus;
    let shatter = false;
    if (enemy.isFrozen() && type === "physical") { mult *= C.shatter.mult; shatter = true; enemy.frozenT = 0; flavor = "shatter"; }

    let amount = Math.max(1, Math.round(rawDmg * mult));

    // Frontal shield absorbs first; magic half-pierces it.
    if (enemy.shieldHP > 0) {
      if (type === "magic") {
        const toShield = amount * 0.5;
        if (toShield >= enemy.shieldHP) { amount -= enemy.shieldHP * 2; enemy.shieldHP = 0; }
        else { enemy.shieldHP -= toShield; amount = Math.round(amount * 0.5); }
      } else {
        if (amount >= enemy.shieldHP) { amount -= enemy.shieldHP; enemy.shieldHP = 0; this.addEffect(new LW.Effect("ring", { x: enemy.x, y: enemy.y - enemy.radius, radius: 26, color: "#bcd0ff", width: 3, life: 0.3 })); }
        else { enemy.shieldHP -= amount; amount = 0; }
      }
      amount = Math.max(0, Math.round(amount));
    }

    if (amount > 0) {
      enemy.applyDamage(amount, source);
      this._damageText(enemy.x, enemy.y - enemy.radius * 2.4, amount, flavor);
    }
    if (!enemy.alive) return;

    if (shatter) this.addEffect(new LW.Effect("ring", { x: enemy.x, y: enemy.y - enemy.radius, radius: 30, color: "#bfe9ff", width: 3, life: 0.3 }));

    const ref = amount || Math.max(1, Math.round(rawDmg * mult));
    if (atk.applyStatus !== false && element !== "Neutral") this._applyElementStatus(enemy, element, ref, source);
    if (atk.status) {
      if (atk.status.slow) enemy.applySlow(atk.status.slow.factor, atk.status.slow.dur);
      if (atk.status.burn) enemy.applyBurn(ref * atk.status.burn.fraction, atk.status.burn.dur);
    }
  }

  // Element status application with combos (ignite, conduct chain).
  _applyElementStatus(enemy, element, hitDmg, source) {
    const C = LW.Config.COMBAT;
    if (element === "Fire" && enemy.oilT > 0) {
      enemy.oilT = 0;
      this.addEffect(new LW.Effect("flash", { x: enemy.x, y: enemy.y - enemy.radius, radius: C.ignite.radius, color: "#ff8a3a", life: 0.3 }));
      this.addEffect(new LW.Effect("ring", { x: enemy.x, y: enemy.y - enemy.radius, radius: C.ignite.radius, color: "#ff8a3a", width: 4, life: 0.35 }));
      this.damageEnemiesInRadius(enemy.x, enemy.y, C.ignite.radius, hitDmg * C.ignite.mult, source, null, { type: "magic", element: "Fire", applyStatus: false });
    }
    if (element === "Storm" && enemy.wetT > 0) {
      const ch = C.status.shock;
      this.damageEnemiesInRadius(enemy.x, enemy.y, ch.chainRadius, hitDmg * ch.chainMult, source, enemy, { type: "magic", element: "Storm", applyStatus: false });
      this.addEffect(new LW.Effect("ring", { x: enemy.x, y: enemy.y - enemy.radius, radius: ch.chainRadius, color: "#cdb8ff", width: 2, life: 0.25 }));
    }
    const status = C.elementStatus[element];
    if (status) enemy.applyStatus(status, hitDmg);
  }

  damageEnemiesInRadius(cx, cy, radius, dmg, source, exclude, atk) {
    const r2 = radius * radius;
    for (const e of this.enemies) {
      if (!e.alive || e === exclude || !e.targetable) continue;
      if (LW.util.dist2(cx, cy, e.x, e.y) <= r2) this.damageEnemy(e, dmg, source, atk);
    }
  }

  // Healer aura: restore HP to wounded allies nearby.
  healEnemiesNear(x, y, radius, frac, source) {
    const r2 = radius * radius;
    for (const e of this.enemies) {
      if (!e.alive || e === source) continue;
      if (e.hp < e.maxHP && LW.util.dist2(x, y, e.x, e.y) <= r2) {
        e.hp = Math.min(e.maxHP, e.hp + e.maxHP * frac);
        this.addEffect(new LW.Effect("text", { x: e.x, y: e.y - e.radius * 2.4, text: "+", color: "#8af0a8", size: 12, vy: -18, life: 0.5 }));
      }
    }
  }

  // Splitter: spawn smaller enemies where the parent died.
  spawnSplit(parent, defId, count) {
    const def = LW.EnemyData.byId(defId);
    if (!def) return;
    for (let i = 0; i < count; i++) {
      const e = new LW.Enemy(this, def, parent.scale, parent.lane);
      e.splineDistance = Math.max(0, parent.splineDistance - 6 - i * 4);
      e._syncPos();
      this.enemies.push(e);
    }
  }

  // Per-frame enemy buffs (bannerman aura). Berserker re-applies in Enemy.update.
  _enemySupportPass() {
    const banners = [];
    for (const e of this.enemies) {
      e._buffSpeed = 1;
      e._buffAtk = 1;
      if (e.alive && e.bannerman && e.targetable) banners.push(e);
    }
    if (!banners.length) return;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      for (const b of banners) {
        if (b === e) continue;
        if (LW.util.dist2(e.x, e.y, b.x, b.y) <= b.bannerman.radius * b.bannerman.radius) {
          e._buffSpeed = Math.max(e._buffSpeed, b.bannerman.speedMult);
          e._buffAtk = Math.max(e._buffAtk, b.bannerman.atkMult);
        }
      }
    }
  }

  _damageText(x, y, amount, flavor) {
    const col = flavor === "weak" ? "#ffd766" : flavor === "resist" ? "#9fb0c4" : flavor === "shatter" ? "#bfe9ff" : "#ffffff";
    const big = flavor === "weak" || flavor === "shatter" || amount >= 80;
    this.effects.push(
      new LW.Effect("text", { x: x + (Math.random() * 10 - 5), y, text: String(amount), color: col, size: big ? 15 : 12, bold: big, vy: -30, life: 0.6 })
    );
  }

  damageCity(amount, enemy) {
    this.cityHP = Math.max(0, this.cityHP - amount);
    this.addEffect(new LW.Effect("flash", { x: this.map.anchors.Anchor_CityDamagePoint.x, y: this.map.H - 30, radius: 26, color: "#ff5a5a", life: 0.4 }));
    this.addEffect(new LW.Effect("text", { x: this.map.W / 2, y: this.map.H - 60, text: "-" + amount + " City HP", color: "#ff8a8a", size: 15, bold: true, vy: -24, life: 0.9 }));
    this.emit("city", this.cityHP);
    if (this.cityHP <= 0) this._defeat();
  }

  onEnemyKilled(enemy) {
    this.killCount++;
  }

  /* ---- Blocking / queueing at the bridge ------------------------------ */

  _updateBlocking() {
    if (!this.hasLivingBlocker()) {
      for (const e of this.enemies) if (e.state === "blocked") e.state = "move";
      return;
    }
    const band = this.gateDistance - 16;
    // Only the centre lane has the Fighter; side lanes are never blocked.
    const queued = this.enemies.filter((e) => e.alive && e.blockable && e.laneBlocked && e.splineDistance >= band);
    queued.sort((a, b) => b.splineDistance - a.splineDistance);
    const spacing = 18;
    for (let i = 0; i < queued.length; i++) {
      const e = queued[i];
      e.state = "blocked";
      e.holdDistance = LW.util.clamp(this.blockDistance - i * spacing, this.gateDistance, this.blockDistance);
      e.lateral = ((i % 3) - 1) * 11;
      if (!e.target || !e.target.alive) e.target = this.nearestBlocker(e.x, e.y);
    }
  }

  /* ---- Active skills -------------------------------------------------- */

  castHeroSkill(pos, x, y) {
    const h = this.heroesByPos[pos];
    if (!h || !h.alive) return false;
    return h.castSkill(x, y);
  }

  knockbackEnemies(cx, cy, radius, amount) {
    const r2 = radius * radius;
    for (const e of this.enemies) {
      if (!e.alive || !e.blockable) continue; // can't knock flyers / burrowers
      if (LW.util.dist2(cx, cy, e.x, e.y) <= r2) {
        e.splineDistance = Math.max(0, e.splineDistance - amount);
        e.state = "move";
        e._syncPos();
      }
    }
  }

  // Snapshot of each deployed hero's skill (for the UI skill bar).
  heroSkills() {
    const out = [];
    for (const pos of ["bridge", "left", "right"]) {
      const h = this.heroesByPos[pos];
      if (!h || !h.skillDef) continue;
      const p = h.skillParams();
      out.push({ pos, heroId: h.heroId, name: h.skillDef.name, aim: p.aim, cooldown: p.cooldown, cd: Math.max(0, h.skillCD), ready: h.skillReady, alive: h.alive });
    }
    return out;
  }

  heroByPos(pos) {
    return this.heroesByPos[pos];
  }

  /* ---- Main loop ------------------------------------------------------ */

  setSpeed(mult) {
    this.speed = mult;
  }

  update(dtRaw) {
    const dt = Math.min(0.05, dtRaw) * this.speed;
    this.t += dt;
    this.map.update(dt);

    if (this.phase === "prep") {
      this.prepTimer -= dt;
      if (this.prepTimer <= 0) this.startWave(0);
    }

    if (this.phase === "fighting") {
      this.waveTimer += dt;
      while (this.spawnCursor < this.waveSpawns.length && this.waveSpawns[this.spawnCursor].t <= this.waveTimer) {
        const s = this.waveSpawns[this.spawnCursor++];
        const def = LW.EnemyData.byId(s.enemyId);
        if (def) {
          const e = new LW.Enemy(this, def, this.waveScale, this.pickLane(def));
          this._applyAffix(e);
          this.enemies.push(e);
        }
      }
      this._enemySupportPass();
      this._updateBlocking();
      for (const e of this.enemies) e.update(dt);
    }

    // Friendly units idle harmlessly when there are no enemies.
    for (const h of this.heroes) h.update(dt);
    for (const u of this.units) u.update(dt);
    this.turret.update(dt);
    for (const p of this.projectiles) p.update(dt);
    for (const e of this.effects) e.update(dt);

    this._cleanup();

    if (this.phase === "fighting") {
      const remaining = this.enemies.length;
      const spawnedAll = this.spawnCursor >= this.waveSpawns.length;
      if (spawnedAll && remaining === 0 && this.cityHP > 0) this._onWaveCleared();
    }
  }

  _cleanup() {
    this.enemies = this.enemies.filter((e) => e.alive);
    this.units = this.units.filter((u) => u.alive);
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    this.effects = this.effects.filter((e) => !e.dead);
  }

  /* ---- Upgrades (between-wave panel) ---------------------------------- */

  upgradeCost(type) {
    const u = LW.Config.UPGRADE[type];
    return u.baseCost + u.costStep * this.purchaseCounts[type];
  }

  canAfford(type) {
    return this.game.state.gold >= this.upgradeCost(type);
  }

  buyUpgrade(type) {
    const cost = this.upgradeCost(type);
    if (!this.game.spendGold(cost)) return { ok: false, cost };
    this.purchaseCounts[type]++;

    if (type === "hero") {
      const U = LW.Config.UPGRADE.hero;
      this.runBuffs.heroAtk *= 1 + U.atkPct;
      this.runBuffs.heroHp *= 1 + U.hpPct;
      for (const h of this.heroes) h.applyBuffs();
    } else if (type === "wall") {
      const extra = this.wall.upgrade();
      this.cityMaxHP += extra;
      this.cityHP += extra;
      for (const h of this.heroes) h.applyBuffs();
      this.emit("city", this.cityHP);
    } else if (type === "turret") {
      this.turret.upgrade();
    }

    this.emit("upgrade", { type, cost });
    return { ok: true, cost };
  }

  upgradeSummary(type) {
    if (type === "hero") {
      const lvl = this.purchaseCounts.hero;
      return "Heroes & units +" + Math.round((Math.pow(1.1, lvl + 1) - 1) * 100) + "% ATK / HP (next)";
    }
    if (type === "wall") {
      return "+" + LW.Config.UPGRADE.wall.cityHP + " City HP, +" + Math.round(LW.Config.UPGRADE.wall.bastionBonus * 100) + "% bastion HP";
    }
    if (type === "turret") {
      const t = this.turret;
      let s = "+15% dmg, faster fire";
      if (t.level + 1 >= LW.Config.UPGRADE.turret.splashAt && t.splash < 50) s += ", splash";
      if (t.level + 1 >= LW.Config.UPGRADE.turret.projAt) s += ", +projectile";
      return s;
    }
    return "";
  }

  /* ---- Render --------------------------------------------------------- */

  render(ctx) {
    this.map.renderBackground(ctx);

    // Ground-level VFX under the actors.
    for (const e of this.effects) if (e.kind === "ring" || e.kind === "flash") e.render(ctx);

    // Actors sorted by Y for a coherent 2.5D overlap.
    const actors = [];
    for (const e of this.enemies) if (e.alive) actors.push(e);
    for (const h of this.heroes) if (h.alive) actors.push(h);
    for (const u of this.units) if (u.alive) actors.push(u);
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) a.render(ctx);

    // Projectiles + turret + over-VFX.
    for (const p of this.projectiles) p.render(ctx);
    this.turret.render(ctx);
    for (const e of this.effects) if (e.kind === "spark" || e.kind === "text") e.render(ctx);

    this.map.renderForeground(ctx);
  }

  /* ---- HUD snapshot --------------------------------------------------- */

  hud() {
    return {
      cityName: this.cityName,
      cityIndex: this.cityIndex,
      wave: this.waveIndex + 1,
      totalWaves: LW.Config.WAVES_PER_CITY,
      gold: this.game.state.gold,
      cityHP: this.cityHP,
      cityMaxHP: this.cityMaxHP,
      phase: this.phase,
      isBoss: this.isBossWave,
      kills: this.killCount,
      synergy: this.synergy,
      affix: this.affix,
    };
  }
};
