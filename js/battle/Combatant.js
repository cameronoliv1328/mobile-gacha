/* =========================================================================
 * Last Wall — Combatant.js
 * Shared base for friendly fighters: targeting, attack cadence, ranged vs.
 * melee resolution and damage handling. BP_HeroBase and BP_SupportUnitBase
 * both build on this so the auto-attack behaviour stays identical.
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
    this.facing = -1; // most enemies arrive from above; default face up-left
    this.attackCD = Math.random() * this.attackInterval; // desync openings
    this.swingTimer = 0;
    this.swingDur = 0.22;
    this.bobT = Math.random() * 6;
    this.target = null;
  }

  update(dt) {
    if (!this.alive) return;
    this.bobT += dt * 4;
    if (this.swingTimer > 0) this.swingTimer -= dt;
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
    if (this.ranged) {
      const ox = this.facing * 8;
      this.battle.spawnProjectile({
        x: this.x + ox,
        y: this.y - 22 * this.scale,
        target: t,
        aimX: t.x,
        aimY: t.y - (t.radius || 10),
        speed: this.cls === "Archer" ? 460 : 360,
        damage: this.atk,
        splash: this.splash,
        style: this.cls === "Archer" ? "arrow" : "magic",
        color: this.projColor,
      });
    } else {
      // Melee swing: hit the target plus a small cleave around it.
      this.battle.damageEnemy(t, this.atk, this);
      if (this.splash > 0) {
        this.battle.damageEnemiesInRadius(t.x, t.y, this.splash, this.atk * 0.6, this, t);
      }
      this.battle.addEffect(
        new LW.Effect("spark", { x: t.x, y: t.y - 8, color: this.trim, spread: 13, life: 0.22, seed: Math.random() * 6 })
      );
    }
  }

  applyDamage(dmg) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.battle.addEffect(new LW.Effect("flash", { x: this.x, y: this.y - 20 * this.scale, radius: 6, color: "#ff8a6a", life: 0.16 }));
    if (this.hp <= 0) this.die();
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
    // Health bar (skip full-HP support clutter a touch by always showing on damage)
    if (this.hp < this.maxHP) {
      LW.Sprites.healthBar(ctx, this.x, this.y - 46 * scale, this.isHero ? 30 : 22, this.hp / this.maxHP);
    }
  }
};
