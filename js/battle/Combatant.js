/* =========================================================================
 * Last Wall — Combatant.js
 * Shared base for friendly fighters: targeting, attack cadence, ranged vs.
 * melee resolution and damage handling. Also carries the ability/synergy
 * combat effects (slow/burn on hit, extra projectiles, reflect, survive-once)
 * that Hero.applyBuffs configures; support units inherit the on-hit effects.
 * ========================================================================= */
window.LW = window.LW || {};

LW.Combatant = class Combatant {
  constructor(battle, o) {
    this.battle = battle;
    this.x = o.x;
    this.y = o.y;
    this.cls = o.cls;
    this.ranged = o.cls !== "Fighter";
    this.maxHP = o.maxHP;
    this.hp = o.maxHP;
    this.atk = o.atk;
    this.attackInterval = o.attackInterval;
    this.range = o.range;
    this.splash = o.splash || 0;
    this.blocks = !!o.blocks;
    this.isHero = !!o.isHero;
    this.scale = o.scale || (this.isHero ? 1.0 : 0.82);

    this.primary = o.primary;
    this.secondary = o.secondary;
    this.trim = o.trim;
    this.projColor = o.projColor || o.trim;

    this.alive = true;
    this.facing = -1;
    this.attackCD = Math.random() * this.attackInterval;
    this.swingTimer = 0;
    this.swingDur = 0.22;
    this.bobT = Math.random() * 6;
    this.target = null;

    // Ability / synergy effects (configured by Hero.applyBuffs).
    this.slowOnHit = null; // { factor, dur }
    this.burnOnHit = null; // { fraction, dur }
    this.extraProjectiles = 0;
    this.reflect = 0; // fraction of melee damage reflected
    this.surviveOnce = false;
    this._survived = false;
    this.regen = 0; // fraction of maxHP / second
    this.ult = null; // { type, interval, radius, mult }
    this.ultCD = null;
    this.atkBuff = 1; // temporary multiplier (e.g. Unbreakable surge)
    this._atkBuffT = 0;
  }

  effATK() {
    return this.atk * (this.atkBuff || 1);
  }

  _status() {
    const s = {};
    if (this.slowOnHit) s.slow = this.slowOnHit;
    if (this.burnOnHit) s.burn = this.burnOnHit;
    return s;
  }

  update(dt) {
    if (!this.alive) return;
    this.bobT += dt * 4;
    if (this.swingTimer > 0) this.swingTimer -= dt;
    if (this._atkBuffT > 0) {
      this._atkBuffT -= dt;
      if (this._atkBuffT <= 0) this.atkBuff = 1;
    }
    this.attackCD -= dt;

    this.target = this.battle.bestTargetInRange(this.x, this.y, this.range);
    if (this.target) {
      this.facing = this.target.x >= this.x ? 1 : -1;
      if (this.attackCD <= 0) {
        this.performAttack();
        this.attackCD = this.attackInterval;
        this.swingTimer = this.swingDur;
      }
    }
  }

  performAttack() {
    const t = this.target;
    if (!t || !t.alive) return;
    const dmg = this.effATK();
    const status = this._status();

    if (this.ranged) {
      const targets =
        this.extraProjectiles > 0
          ? this.battle.bestTargetsInRange(this.x, this.y, this.range, 1 + this.extraProjectiles)
          : [t];
      for (const tg of targets) {
        this.battle.spawnProjectile({
          x: this.x + this.facing * 8,
          y: this.y - 22 * this.scale,
          target: tg,
          aimX: tg.x,
          aimY: tg.y - (tg.radius || 10),
          speed: this.cls === "Archer" ? 460 : 360,
          damage: dmg,
          splash: this.splash,
          style: this.cls === "Archer" ? "arrow" : "magic",
          color: this.projColor,
          slow: status.slow,
          burn: status.burn,
        });
      }
    } else {
      // Melee swing: hit the target plus a small cleave around it.
      this.battle.damageEnemy(t, dmg, this, status);
      if (this.splash > 0) {
        this.battle.damageEnemiesInRadius(t.x, t.y, this.splash, dmg * 0.6, this, t, status);
      }
      this.battle.addEffect(
        new LW.Effect("spark", { x: t.x, y: t.y - 8, color: this.trim, spread: 13, life: 0.22, seed: Math.random() * 6 })
      );
    }
  }

  applyDamage(dmg, source) {
    if (!this.alive) return;
    // Riposte: reflect a fraction of melee damage back to the attacker.
    if (this.reflect > 0 && source && source.alive && typeof source.applyDamage === "function") {
      this.battle.damageEnemy(source, dmg * this.reflect, this);
    }
    this.hp -= dmg;
    this.battle.addEffect(new LW.Effect("flash", { x: this.x, y: this.y - 20 * this.scale, radius: 6, color: "#ff8a6a", life: 0.16 }));

    if (this.hp <= 0) {
      // Unbreakable: cheat death once per wave, then surge.
      if (this.surviveOnce && !this._survived) {
        this._survived = true;
        this.hp = Math.max(1, Math.round(this.maxHP * 0.02));
        this.atkBuff = 1.4;
        this._atkBuffT = 6;
        this.battle.addEffect(new LW.Effect("ring", { x: this.x, y: this.y - 20, radius: 40, color: "#ffd766", width: 4, life: 0.5 }));
        this.battle.addEffect(new LW.Effect("text", { x: this.x, y: this.y - 50, text: "UNBREAKABLE!", color: "#ffd766", size: 13, bold: true, vy: -22, life: 0.9 }));
        return;
      }
      this.die();
    }
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this.battle.addEffect(new LW.Effect("spark", { x: this.x, y: this.y - 16, color: this.primary, spread: 18, count: 9, life: 0.4, seed: Math.random() * 6 }));
  }

  render(ctx) {
    if (!this.alive) return;
    const scale = this.scale * this.battle.map.depthScale(this.y);
    LW.Sprites.humanoid(ctx, {
      x: this.x,
      y: this.y,
      scale,
      cls: this.cls,
      primary: this.primary,
      secondary: this.secondary,
      trim: this.trim,
      facing: this.facing,
      attacking: this.swingTimer > 0,
      swing: (1 - Math.max(0, this.swingTimer) / this.swingDur) * Math.PI,
      isHero: this.isHero,
      bob: this.bobT,
    });
    if (this.hp < this.maxHP) {
      LW.Sprites.healthBar(ctx, this.x, this.y - 46 * scale, this.isHero ? 30 : 22, this.hp / this.maxHP);
    }
  }
};
