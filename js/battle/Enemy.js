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

    const p = battle.spline.pointAt(0);
    this.x = p.x;
    this.y = p.y;
  }

  update(dt) {
    if (!this.alive) return;
    this.t += dt;
    this.attackCD -= dt;

    if (this.state === "blocked") {
      // Advance toward our queue slot, then attack the held blocker.
      const diff = this.holdDistance - this.splineDistance;
      const step = this.moveSpeed * dt;
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
          this.target.applyDamage(this.atk);
          this.attackCD = this.attackInterval;
          this.battle.addEffect(
            new LW.Effect("spark", { x: this.target.x, y: this.target.y - 18, color: "#ff6a4a", spread: 11, life: 0.2, seed: Math.random() * 6 })
          );
        }
      }
      return;
    }

    // Moving along the path.
    let next = this.splineDistance + this.moveSpeed * dt;
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
    const scale = this.battle.map.depthScale(this.y) * 1.15;
    LW.Sprites.enemy(ctx, {
      x: this.x,
      y: this.y,
      scale,
      radius: this.radius,
      color: this.color,
      accent: this.accent,
      shape: this.shape,
      facing: this.facing,
      t: this.t,
    });
    if (this.hp < this.maxHP) {
      const w = this.isBoss ? 52 : 22;
      LW.Sprites.healthBar(ctx, this.x, this.y - (this.radius * 2.4 + 6) * scale, w, this.hp / this.maxHP);
    }
  }
};
