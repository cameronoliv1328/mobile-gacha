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

    this.spline = new LW.Spline(LW.Config.splinePoints);
    this.map = new LW.BattleMap(this);
    this.wall = new LW.CityWall();
    this.turret = new LW.Turret(this, this.map.getAnchor("Anchor_Turret_Main"));

    // Distances along the path used for blocking/queueing.
    this.gateDistance = this._distanceAtPoint(this.map.gate.x, this.map.gate.bottom - 10);
    this.blockDistance = this._distanceAtPoint(
      this.map.getAnchor("Anchor_Bridge_Hero").x,
      this.map.getAnchor("Anchor_Bridge_Hero").y + 6
    );

    this.heroes = [];
    this.heroesByPos = {};
    this.bridgeHero = null;
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
    this.phase = "prep";
    this.prepTimer = 1.1;
    this.emit("phase", this.phase);
  }

  _distanceAtPoint(px, py) {
    let best = 0;
    let bestD = Infinity;
    for (const s of this.spline.samples) {
      const d = LW.util.dist2(px, py, s.x, s.y);
      if (d < bestD) {
        bestD = d;
        best = s.d;
      }
    }
    return best;
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
      const ha = A[s.hero];
      const hero = new LW.Hero(this, { def, position: s.pos, x: ha.x, y: ha.y, baseStats: base });
      hero.unitAnchors = s.units.map((n) => A[n]);
      hero.spawnSupportUnits(hero.unitAnchors);
      hero.applyBuffs(this.runBuffs, this.wall.bastionBonus);
      this.heroes.push(hero);
      this.heroesByPos[s.pos] = hero;
      if (s.pos === "bridge") this.bridgeHero = hero;
    }
  }

  /* ---- Wave flow ------------------------------------------------------ */

  startWave(idx) {
    this.waveIndex = idx;
    const wave = LW.Levels.getWave(this.cityIndex, idx);
    this.waveScale = wave.scale;
    this.waveSpawns = wave.spawns;
    this.isBossWave = wave.isBoss;
    this.spawnCursor = 0;
    this.waveTimer = 0;

    // Revive + heal the squad and re-man each position with fresh units.
    for (const h of this.heroes) {
      h.alive = true;
      h.hp = h.maxHP;
      h.attackCD = Math.random() * h.attackInterval;
      for (const u of h.supportUnits) u.alive = false; // retire old squad quietly
      h.supportUnits = [];
      h.spawnSupportUnits(h.unitAnchors);
      h.applyBuffs(this.runBuffs, this.wall.bastionBonus);
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
    const reward = this.game.rewardWave(this.cityIndex, this.waveIndex);
    this.emit("reward", { kind: "wave", reward, wave: this.waveIndex + 1 });

    if (this.waveIndex >= LW.Config.WAVES_PER_CITY - 1) {
      const cityReward = this.game.completeCity(this.cityIndex);
      this.phase = "victory";
      this.emit("phase", this.phase);
      this.emit("victory", { waveReward: reward, cityReward });
    } else {
      this.phase = "upgrade";
      this.emit("phase", this.phase);
    }
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

  // Prefer the most advanced enemy (closest to breaching) within range.
  bestTargetInRange(x, y, range) {
    const r2 = range * range;
    let best = null;
    let bestAdv = -1;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (LW.util.dist2(x, y, e.x, e.y) > r2) continue;
      if (e.splineDistance > bestAdv) {
        bestAdv = e.splineDistance;
        best = e;
      }
    }
    return best;
  }

  bestTargetsInRange(x, y, range, n) {
    const r2 = range * range;
    const inRange = this.enemies.filter((e) => e.alive && LW.util.dist2(x, y, e.x, e.y) <= r2);
    inRange.sort((a, b) => b.splineDistance - a.splineDistance);
    return inRange.slice(0, n);
  }

  nearestEnemy(x, y, maxDist) {
    const m2 = maxDist * maxDist;
    let best = null;
    let bestD = m2;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = LW.util.dist2(x, y, e.x, e.y);
      if (d <= bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  damageEnemy(enemy, dmg, source) {
    if (!enemy || !enemy.alive) return;
    const amount = Math.max(1, Math.round(dmg));
    enemy.applyDamage(amount, source);
    this._damageText(enemy.x, enemy.y - enemy.radius * 2.4, amount);
  }

  damageEnemiesInRadius(cx, cy, radius, dmg, source, exclude) {
    const r2 = radius * radius;
    for (const e of this.enemies) {
      if (!e.alive || e === exclude) continue;
      if (LW.util.dist2(cx, cy, e.x, e.y) <= r2) this.damageEnemy(e, dmg, source);
    }
  }

  _damageText(x, y, amount) {
    this.effects.push(
      new LW.Effect("text", {
        x: x + (Math.random() * 10 - 5),
        y,
        text: String(amount),
        color: amount >= 60 ? "#ffd766" : "#ffffff",
        size: amount >= 60 ? 15 : 12,
        bold: amount >= 60,
        vy: -30,
        life: 0.6,
      })
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
    const queued = this.enemies.filter((e) => e.alive && e.splineDistance >= band);
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
        if (def) this.enemies.push(new LW.Enemy(this, def, this.waveScale));
      }
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
      for (const h of this.heroes) h.applyBuffs(this.runBuffs, this.wall.bastionBonus);
    } else if (type === "wall") {
      const extra = this.wall.upgrade();
      this.cityMaxHP += extra;
      this.cityHP += extra;
      for (const h of this.heroes) h.applyBuffs(this.runBuffs, this.wall.bastionBonus);
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
    };
  }
};
