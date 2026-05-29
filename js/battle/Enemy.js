/* =========================================================================
 * Last Wall — Enemy.js   (mirrors BP_EnemyBase)
 * Marches along the spline from the forest. When a living Fighter group holds
 * the bridge it queues up and attacks the blockers; if the bridge falls it
 * continues to the city point and deals City HP damage.
 * ========================================================================= */
window.LW = window.LW || {};

LW.Enemy = class Enemy {
  constructor(battle, def, scale) {
    this.battle = battle;
    this.def = def;
    this.enemyId = def.id;
    this.maxHP = Math.round(def.hp * scale);
    this.hp = this.maxHP;
    this.atk = Math.round(def.atk * scale);
    this.attackInterval = def.attackInterval;
    this.moveSpeed = def.speed * (1 + 0.02 * (scale - 1));
    this.cityDamage = def.cityDamage;
    this.isBoss = !!def.isBoss;
    this.radius = def.radius;
    this.spriteH = def.radius * (def.isBoss ? 5 : 4); // painted billboard height
    this.color = def.color;
    this.accent = def.accent;
    this.shape = def.shape;

    this.splineDistance = 0;
    this.state = "move"; // move | blocked | reached | dead
    this.alive = true;
    this.attackCD = Math.random() * this.attackInterval;
    this.target = null; // a blocker
    this.holdDistance = battle.blockDistance;
    this.t = Math.random() * 4;
    this.facing = -1;

    // Status effects (from mage Hex, Ice/Fire synergy, etc.).
    this.slowFactor = 1;
    this.slowT = 0;
    this.burnDps = 0;
    this.burnT = 0;

    const p = battle.spline.pointAt(0);
    this.x = p.x;
    this.y = p.y;
  }

  update(dt) {
    if (!this.alive) return;
    this.t += dt;
    this.attackCD -= dt;

    // Status effects.
    if (this.slowT > 0) {
      this.slowT -= dt;
      if (this.slowT <= 0) this.slowFactor = 1;
    }
    if (this.burnT > 0) {
      this.hp -= this.burnDps * dt;
      this.burnT -= dt;
      if (this.hp <= 0) {
        this.die();
        return;
      }
    }

    if (this.state === "blocked") {
      // Advance toward our queue slot, then attack the held blocker.
      const diff = this.holdDistance - this.splineDistance;
      const step = this.moveSpeed * this.slowFactor * dt;
      if (Math.abs(diff) <= step) this.splineDistance = this.holdDistance;
      else this.splineDistance += Math.sign(diff) * step;
      this._syncPos();

      if (!this.target || !this.target.alive) {
        this.target = this.battle.nearestBlocker(this.x, this.y);
        if (!this.target) {
          this.state = "move";
          return;
        }
      }
      const reach = this.radius + 30;
      if (LW.util.dist(this.x, this.y, this.target.x, this.target.y) <= reach) {
        this.facing = this.target.x >= this.x ? 1 : -1;
        if (this.attackCD <= 0) {
          this.target.applyDamage(this.atk, this);
          this.attackCD = this.attackInterval;
          this.battle.addEffect(
            new LW.Effect("spark", { x: this.target.x, y: this.target.y - 18, color: "#ff6a4a", spread: 11, life: 0.2, seed: Math.random() * 6 })
          );
        }
      }
      return;
    }

    // Moving along the path.
    let next = this.splineDistance + this.moveSpeed * this.slowFactor * dt;
    // Never walk through a held bridge.
    if (this.battle.hasLivingBlocker() && next > this.battle.blockDistance) {
      next = this.battle.blockDistance;
    }
    this.splineDistance = next;
    this._syncPos();

    if (this.splineDistance >= this.battle.spline.length - 0.5) {
      this.reachCity();
    }
  }

  _syncPos() {
    const p = this.battle.spline.pointAt(this.splineDistance);
    const prevX = this.x;
    this.x = p.x;
    this.y = p.y;
    const tan = this.battle.spline.tangentAt(this.splineDistance);
    if (Math.abs(tan.x) > 0.05) this.facing = tan.x >= 0 ? 1 : -1;
    else if (this.x !== prevX) this.facing = this.x >= prevX ? 1 : -1;
  }

  applyDamage(dmg, source) {
    if (!this.alive) return;
    this.hp -= dmg;
    if (this.hp <= 0) this.die();
  }

  applySlow(factor, dur) {
    if (!this.alive) return;
    this.slowFactor = Math.min(this.slowFactor, factor); // strongest slow wins
    this.slowT = Math.max(this.slowT, dur);
  }

  applyBurn(dps, dur) {
    if (!this.alive || dps <= 0) return;
    this.burnDps = Math.max(this.burnDps, dps);
    this.burnT = Math.max(this.burnT, dur);
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
    this.battle.addEffect(
      new LW.Effect("spark", {
        x: this.x,
        y: this.y - this.radius,
        color: this.color,
        spread: this.isBoss ? 40 : 16,
        count: this.isBoss ? 16 : 7,
        size: this.isBoss ? 3.5 : 2.4,
        life: this.isBoss ? 0.6 : 0.35,
        seed: Math.random() * 6,
      })
    );
  }

  render(ctx) {
    if (!this.alive) return;
    const depth = this.battle.map.depthScale(this.y);
    const img = LW.Sprites.spriteFor(this.enemyId);
    let topY, halfW;
    if (img) {
      const h = this.spriteH * depth;
      LW.Sprites.drawSprite(ctx, img, { x: this.x, y: this.y, h, facing: this.facing, bob: this.t * 7 });
      halfW = (h * (img.width / img.height)) / 2;
      topY = this.y - h - 4;
    } else {
      const scale = depth * 1.15;
      LW.Sprites.enemy(ctx, { x: this.x, y: this.y, scale, radius: this.radius, color: this.color, accent: this.accent, shape: this.shape, facing: this.facing, t: this.t });
      halfW = this.radius * scale;
      topY = this.y - (this.radius * 2.4 + 6) * scale;
    }
    // Status markers.
    if (this.slowT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = "#7fd0ff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, halfW * 0.9, halfW * 0.36, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (this.burnT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      const fx = this.x + halfW * 0.55;
      const fy = topY + 6 + Math.sin(this.t * 18) * 1.5;
      ctx.fillStyle = "#ff7a2a";
      ctx.beginPath();
      ctx.ellipse(fx, fy, 2.6, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffd24a";
      ctx.beginPath();
      ctx.ellipse(fx, fy + 1, 1.3, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (this.hp < this.maxHP) {
      LW.Sprites.healthBar(ctx, this.x, topY, this.isBoss ? 52 : 22, this.hp / this.maxHP);
    }
  }
};
