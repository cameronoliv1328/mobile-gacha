/* =========================================================================
 * Last Wall — Enemy.js   (mirrors BP_EnemyBase) — Combat 2.0
 * Spline movement + bridge blocking, plus: status effects with combos
 * (burn / chill->frozen / wet / shock / oil, shatter & ignite & conduct),
 * elemental affinities (resolved in BattleManager.damageEnemy) and archetype
 * behaviours: flying, armored, shielded, healer, splitter, burrower,
 * berserker and bannerman aura.
 * ========================================================================= */
window.LW = window.LW || {};

LW.Enemy = class Enemy {
  constructor(battle, def, scale, lane) {
    this.battle = battle;
    this.def = def;
    // Lane assignment (which spline this enemy follows).
    this.lane = lane == null ? battle.blockLane : lane;
    this.spline = battle.lanes[this.lane];
    this.laneBlocked = this.lane === battle.blockLane; // only centre is blocked
    this.blockDist = battle.blockDistance;
    this.gateDist = battle.laneGate ? battle.laneGate[this.lane] : battle.gateDistance;
    this.endDist = this.spline.length;
    this.enemyId = def.id;
    this.spriteId = def.spriteId || def.id;
    this.maxHP = Math.round(def.hp * scale);
    this.hp = this.maxHP;
    this.baseAtk = Math.round(def.atk * scale);
    this.atk = this.baseAtk;
    this.attackInterval = def.attackInterval;
    this.baseSpeed = def.speed * (1 + 0.02 * (scale - 1));
    this.cityDamage = def.cityDamage;
    this.isBoss = !!def.isBoss;
    this.radius = def.radius;
    this.spriteH = def.radius * (def.isBoss ? 5 : 4);
    this.color = def.color;
    this.accent = def.accent;
    this.shape = def.shape;
    this.scale = scale;

    // Affinities.
    this.element = def.element || "Neutral";
    this.weakElement = def.weakElement || null;
    this.resistElement = def.resistElement || null;
    this.weakType = def.weakType || null;
    this.physResist = def.physResist || 0;
    this.magicResist = def.magicResist || 0;
    this.immune = new Set(def.statusImmune || []);
    // Immune to your own element's status (Fire shrugs burn, Ice shrugs chill...).
    const own = LW.Config.COMBAT.elementStatus[this.element];
    if (own) {
      this.immune.add(own);
      if (own === "chill") this.immune.add("frozen");
    }

    // Archetypes.
    this.flying = !!def.flying;
    this.armored = !!def.armored;
    this.shieldHP = def.shieldHP || 0;
    this.maxShieldHP = this.shieldHP;
    this.healer = def.healer || null;
    this.splitInto = def.splitInto || null;
    this.splitCount = def.splitCount || 0;
    this.burrower = !!def.burrower;
    this.berserker = def.berserker || null;
    this.bannerman = def.bannerman || null;

    // Status state.
    this.burnT = 0; this.burnDps = 0;
    this.slowFactor = 1; this.slowT = 0;
    this.chillStacks = 0;
    this.frozenT = 0;
    this.wetT = 0;
    this.shockT = 0;
    this.oilT = 0;

    this.splineDistance = 0;
    this.state = "move"; // move | blocked | reached | dead
    this.alive = true;
    this.attackCD = Math.random() * this.attackInterval;
    this.target = null;
    this.holdDistance = this.blockDist;
    this.t = Math.random() * 4;
    this.facing = -1;
    this.attackAnimT = 0;
    this.attackAnimDur = 0.28;
    this._buffSpeed = 1;
    this._buffAtk = 1;
    this.affixRegen = 0;
    this._healCD = this.healer ? this.healer.interval : 0;
    this.hover = this.flying ? this.radius * 2.4 : 0;

    const p = this.spline.pointAt(0);
    this.x = p.x;
    this.y = p.y;
  }

  /* ---- Queries -------------------------------------------------------- */

  get burrowed() {
    return this.burrower && this.splineDistance < this.gateDist - 90 && this.splineDistance > 60;
  }
  get targetable() {
    return this.alive && !this.burrowed;
  }
  get blockable() {
    return !this.flying && !this.burrowed;
  }

  /* ---- Status --------------------------------------------------------- */

  applyStatus(kind, hitDmg) {
    if (!this.alive || this.immune.has(kind)) return;
    const C = LW.Config.COMBAT.status;
    if (kind === "burn") {
      if (this.wetT > 0) { this.wetT = 0; return; } // wet douses fire
      this.burnDps = Math.max(this.burnDps, hitDmg * C.burn.dps);
      this.burnT = Math.max(this.burnT, C.burn.dur);
    } else if (kind === "chill") {
      this.chillStacks++;
      if (this.wetT > 0 || this.chillStacks >= C.chill.freezeStacks) {
        if (!this.immune.has("frozen")) { this.frozenT = Math.max(this.frozenT, C.frozen.dur); this.wetT = 0; }
        this.chillStacks = 0;
      } else {
        this.slowFactor = Math.min(this.slowFactor, C.chill.slow);
        this.slowT = Math.max(this.slowT, C.chill.dur);
      }
    } else if (kind === "wet") {
      this.wetT = Math.max(this.wetT, C.wet.dur);
      this.burnT = 0; this.burnDps = 0; // wet snuffs existing burn
    } else if (kind === "shock") {
      this.shockT = Math.max(this.shockT, C.shock.dur);
    } else if (kind === "oil") {
      this.oilT = Math.max(this.oilT, C.oil.dur);
    } else if (kind === "slow") {
      this.slowFactor = Math.min(this.slowFactor, C.chill.slow);
      this.slowT = Math.max(this.slowT, hitDmg || C.chill.dur);
    }
  }

  isFrozen() {
    return this.frozenT > 0;
  }

  applySlow(factor, dur) {
    if (!this.alive || this.immune.has("slow")) return;
    this.slowFactor = Math.min(this.slowFactor, factor);
    this.slowT = Math.max(this.slowT, dur);
  }
  applyBurn(dps, dur) {
    if (!this.alive || this.immune.has("burn") || this.wetT > 0) return;
    this.burnDps = Math.max(this.burnDps, dps);
    this.burnT = Math.max(this.burnT, dur);
  }

  /* ---- Per-frame ------------------------------------------------------ */

  update(dt) {
    if (!this.alive) return;
    this.t += dt;
    this.attackCD -= dt;
    if (this.attackAnimT > 0) this.attackAnimT -= dt;

    // Status timers.
    if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.slowFactor = 1; }
    if (this.frozenT > 0) this.frozenT -= dt;
    if (this.wetT > 0) this.wetT -= dt;
    if (this.shockT > 0) this.shockT -= dt;
    if (this.oilT > 0) this.oilT -= dt;
    if (this.burnT > 0) {
      this.hp -= this.burnDps * dt;
      this.burnT -= dt;
      if (this.hp <= 0) { this.die(); return; }
    }
    if (this.affixRegen && this.hp < this.maxHP) {
      this.hp = Math.min(this.maxHP, this.hp + this.maxHP * this.affixRegen * dt);
    }

    // Berserker scaling.
    if (this.berserker && this.hp / this.maxHP <= this.berserker.hpBelow) {
      this._buffAtk = Math.max(this._buffAtk, this.berserker.atkMult);
      this._buffSpeed = Math.max(this._buffSpeed, this.berserker.speedMult);
    }
    this.atk = Math.round(this.baseAtk * this._buffAtk);

    // Healer aura.
    if (this.healer && this.targetable) {
      this._healCD -= dt;
      if (this._healCD <= 0) {
        this._healCD = this.healer.interval;
        this.battle.healEnemiesNear(this.x, this.y, this.healer.radius, this.healer.heal, this);
      }
    }

    const eff = this.baseSpeed * this.slowFactor * this._buffSpeed * (this.isFrozen() ? 0 : 1);

    if (this.state === "blocked") {
      const diff = this.holdDistance - this.splineDistance;
      const step = eff * dt;
      if (Math.abs(diff) <= step) this.splineDistance = this.holdDistance;
      else this.splineDistance += Math.sign(diff) * step;
      this._syncPos();

      if (!this.target || !this.target.alive) {
        this.target = this.battle.nearestBlocker(this.x, this.y);
        if (!this.target) { this.state = "move"; return; }
      }
      const reach = this.radius + 30;
      if (!this.isFrozen() && LW.util.dist(this.x, this.y, this.target.x, this.target.y) <= reach) {
        this.facing = this.target.x >= this.x ? 1 : -1;
        if (this.attackCD <= 0) {
          this.target.applyDamage(this.atk, this);
          this.attackCD = this.attackInterval;
          this.attackAnimT = this.attackAnimDur;
          this.battle.addEffect(new LW.Effect("spark", { x: this.target.x, y: this.target.y - 18, color: "#ff6a4a", spread: 11, life: 0.2, seed: Math.random() * 6 }));
        }
      }
      return;
    }

    // Moving.
    let next = this.splineDistance + eff * dt;
    if (this.blockable && this.laneBlocked && this.battle.hasLivingBlocker() && next > this.blockDist) {
      next = this.blockDist;
    }
    this.splineDistance = next;
    this._syncPos();
    if (this.splineDistance >= this.endDist - 0.5) this.reachCity();
  }

  _syncPos() {
    const p = this.spline.pointAt(this.splineDistance);
    const prevX = this.x;
    this.x = p.x;
    this.y = p.y;
    const tan = this.spline.tangentAt(this.splineDistance);
    if (Math.abs(tan.x) > 0.05) this.facing = tan.x >= 0 ? 1 : -1;
    else if (this.x !== prevX) this.facing = this.x >= prevX ? 1 : -1;
  }

  applyDamage(amount, source) {
    if (!this.alive) return;
    this.hp -= amount;
    if (this.hp <= 0) this.die();
  }

  reachCity() {
    if (!this.alive) return;
    this.alive = false;
    this.state = "reached";
    this.battle.damageCity(this.cityDamage, this);
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.state = "dead";
    this.battle.onEnemyKilled(this);
    if (this.splitInto && this.splitCount > 0) {
      this.battle.spawnSplit(this, this.splitInto, this.splitCount);
    }
    this.battle.addEffect(
      new LW.Effect("spark", {
        x: this.x, y: this.y - this.radius, color: this.color,
        spread: this.isBoss ? 40 : 16, count: this.isBoss ? 16 : 7,
        size: this.isBoss ? 3.5 : 2.4, life: this.isBoss ? 0.6 : 0.35, seed: Math.random() * 6,
      })
    );
  }

  /* ---- Render --------------------------------------------------------- */

  render(ctx) {
    if (!this.alive) return;
    const depth = this.battle.map.depthScale(this.y);

    if (this.burrowed) {
      // A dust mound while tunnelling.
      ctx.save();
      ctx.fillStyle = "rgba(120,96,64,0.85)";
      ctx.beginPath();
      ctx.ellipse(this.x, this.y - 2, this.radius * 1.2 * depth, this.radius * 0.5 * depth, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "rgba(150,124,90,0.6)";
      for (let i = 0; i < 3; i++) ctx.fillRect(this.x - 8 + i * 6 + Math.sin(this.t * 10 + i) * 2, this.y - 6 - (i % 2) * 3, 2, 2);
      ctx.restore();
      return;
    }

    const img = LW.Sprites.spriteFor(this.spriteId);
    const hover = this.hover * depth * (1 + (this.flying ? Math.sin(this.t * 4) * 0.12 : 0));
    let topY, halfW;
    if (img) {
      const h = this.spriteH * depth;
      const tr = LW.Anim.enemyTransform({ t: this.t, facing: this.facing, moving: this.state === "move", attacking: this.attackAnimT > 0, attackT: this.attackAnimT, attackDur: this.attackAnimDur });
      LW.Sprites.drawSprite(ctx, img, { x: this.x, y: this.y - hover, shadowY: this.y, h, facing: this.facing, tr });
      halfW = (h * (img.width / img.height)) / 2;
      topY = this.y - hover - h - 4;
    } else {
      const s = depth * 1.15;
      LW.Sprites.enemy(ctx, { x: this.x, y: this.y - hover, scale: s, radius: this.radius, color: this.color, accent: this.accent, shape: this.shape, facing: this.facing, t: this.t });
      halfW = this.radius * s;
      topY = this.y - hover - (this.radius * 2.4 + 6) * s;
    }

    this._renderStatus(ctx, halfW, topY);

    // Shield arc.
    if (this.shieldHP > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = "#bcd0ff";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y - hover - halfW * 0.7, halfW * 1.05, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.restore();
    }
    // Bannerman pole.
    if (this.bannerman) {
      ctx.save();
      ctx.strokeStyle = "#caa15a"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(this.x + halfW * 0.7, this.y - hover); ctx.lineTo(this.x + halfW * 0.7, topY - 6); ctx.stroke();
      ctx.fillStyle = "#b03a52";
      const wv = Math.sin(this.t * 3) * 2;
      ctx.beginPath(); ctx.moveTo(this.x + halfW * 0.7, topY - 6); ctx.lineTo(this.x + halfW * 0.7 + 16 + wv, topY - 2); ctx.lineTo(this.x + halfW * 0.7, topY + 4); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    if (this.hp < this.maxHP || this.shieldHP > 0) {
      LW.Sprites.healthBar(ctx, this.x, topY, this.isBoss ? 54 : 24, this.hp / this.maxHP);
      if (this.maxShieldHP > 0) {
        const w = this.isBoss ? 54 : 24;
        ctx.fillStyle = "#bcd0ff";
        ctx.fillRect(this.x - w / 2, topY - 4, w * (this.shieldHP / this.maxShieldHP), 2.5);
      }
    }
  }

  _renderStatus(ctx, halfW, topY) {
    if (this.isFrozen()) {
      ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = "#9fe0ff";
      ctx.fillRect(this.x - halfW, topY, halfW * 2, this.y - topY); ctx.restore();
    } else if (this.slowT > 0) {
      ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = "#7fd0ff"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(this.x, this.y, halfW * 0.9, halfW * 0.36, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (this.wetT > 0) {
      ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = "#5aa0e0";
      ctx.beginPath(); ctx.ellipse(this.x, this.y, halfW * 0.8, halfW * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (this.oilT > 0) {
      ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = "#2a2233";
      ctx.beginPath(); ctx.ellipse(this.x, this.y, halfW * 0.85, halfW * 0.32, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (this.burnT > 0) {
      ctx.save(); ctx.globalAlpha = 0.85;
      const fx = this.x + halfW * 0.55, fy = topY + 6 + Math.sin(this.t * 18) * 1.5;
      ctx.fillStyle = "#ff7a2a"; ctx.beginPath(); ctx.ellipse(fx, fy, 2.6, 5.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffd24a"; ctx.beginPath(); ctx.ellipse(fx, fy + 1, 1.3, 2.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (this.shockT > 0) {
      ctx.save(); ctx.globalAlpha = 0.8; ctx.strokeStyle = "#cdb8ff"; ctx.lineWidth = 1.4;
      const sx = this.x - halfW * 0.5, sy = topY + 4;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 4, sy + 5); ctx.lineTo(sx, sy + 7); ctx.lineTo(sx + 5, sy + 12); ctx.stroke(); ctx.restore();
    }
  }
};
