/* =========================================================================
 * Last Wall — Projectile.js
 * A flying attack. Homes toward its (targetable) target while alive, else
 * flies to the captured aim point, then resolves damage carrying its damage
 * type, element and any on-hit status (for affinities + combos).
 * ========================================================================= */
window.LW = window.LW || {};

LW.Projectile = class Projectile {
  constructor(battle, opts) {
    this.battle = battle;
    this.x = opts.x;
    this.y = opts.y;
    this.target = opts.target || null;
    this.aimX = opts.aimX != null ? opts.aimX : opts.x;
    this.aimY = opts.aimY != null ? opts.aimY : opts.y;
    this.speed = opts.speed || 320;
    this.damage = opts.damage || 10;
    this.splash = opts.splash || 0;
    this.style = opts.style || "arrow"; // arrow | magic | cannon
    this.color = opts.color || "#fff";
    this.r = opts.r || 5;
    this.type = opts.type || "physical";
    this.element = opts.element || "Neutral";
    this.slow = opts.slow || null;
    this.burn = opts.burn || null;
    this.angle = 0;
    this.life = opts.life || 2.5;
    this.dead = false;
  }

  _atk() {
    return { type: this.type, element: this.element, status: { slow: this.slow, burn: this.burn } };
  }

  update(dt) {
    if (this.dead) return;
    const homing = this.target && this.target.alive && this.target.targetable;
    const tx = homing ? this.target.x : this.aimX;
    const ty = homing ? this.target.y - (this.target.radius || 10) : this.aimY;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 0.0001;
    this.angle = Math.atan2(dy, dx);
    const step = this.speed * dt;

    if (d <= step + 6) {
      this.x = tx;
      this.y = ty;
      this._resolve();
      this.dead = true;
      return;
    }
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;

    this.life -= dt;
    if (this.life <= 0) {
      this._resolve();
      this.dead = true;
    }
  }

  _resolve() {
    const b = this.battle;
    if (this.splash > 0) {
      b.damageEnemiesInRadius(this.x, this.y, this.splash, this.damage, this, null, this._atk());
      b.addEffect(new LW.Effect("ring", { x: this.x, y: this.y, radius: this.splash, color: this.color, width: 3, life: 0.32 }));
      b.addEffect(new LW.Effect("flash", { x: this.x, y: this.y, radius: this.splash * 0.5, color: this.color, life: 0.22 }));
    } else if (this.target && this.target.alive && this.target.targetable) {
      b.damageEnemy(this.target, this.damage, this, this._atk());
      b.addEffect(new LW.Effect("spark", { x: this.x, y: this.y, color: this.color, spread: 12, life: 0.25, seed: Math.random() * 6 }));
    } else {
      const e = b.nearestEnemy(this.x, this.y, 20);
      if (e) {
        b.damageEnemy(e, this.damage, this, this._atk());
        b.addEffect(new LW.Effect("spark", { x: this.x, y: this.y, color: this.color, spread: 12, life: 0.25, seed: Math.random() * 6 }));
      }
    }
  }

  render(ctx) {
    LW.Sprites.projectile(ctx, this);
  }
};
