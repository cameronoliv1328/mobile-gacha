/* =========================================================================
 * Last Wall — Turret.js   (mirrors BP_TurretBase)
 * Wall-mounted auto-cannon. Fires at the most advanced enemies in range and
 * gains damage / fire-rate / extra projectiles / splash as it is upgraded.
 * ========================================================================= */
window.LW = window.LW || {};

LW.Turret = class Turret {
  constructor(battle, anchor) {
    const C = LW.Config.TURRET;
    this.battle = battle;
    this.x = anchor.x;
    this.y = anchor.y;
    this.level = 1;
    this.damage = C.baseDamage;
    this.attackInterval = C.baseInterval;
    this.range = C.range;
    this.projectiles = C.projectiles;
    this.splash = C.splash;
    this.cd = 0.4;
    this.aimAngle = -Math.PI / 2; // point up the field by default
    this.recoil = 0;
  }

  update(dt) {
    if (this.cd > 0) this.cd -= dt;
    if (this.recoil > 0) this.recoil -= dt * 4;

    const targets = this.battle.bestTargetsInRange(this.x, this.y, this.range, this.projectiles);
    if (targets.length) {
      const primary = targets[0];
      this.aimAngle = Math.atan2(primary.y - this.y, primary.x - this.x);
      if (this.cd <= 0) {
        for (const t of targets) this._fire(t);
        this.cd = this.attackInterval;
        this.recoil = 1;
      }
    }
  }

  _fire(target) {
    this.battle.spawnProjectile({
      x: this.x + Math.cos(this.aimAngle) * 16,
      y: this.y + Math.sin(this.aimAngle) * 16,
      target,
      aimX: target.x,
      aimY: target.y - (target.radius || 10),
      speed: 520,
      damage: this.damage,
      splash: this.splash,
      style: "cannon",
      color: "#ffce6b",
      r: 5 + this.level * 0.4,
    });
    this.battle.addEffect(
      new LW.Effect("flash", { x: this.x + Math.cos(this.aimAngle) * 18, y: this.y + Math.sin(this.aimAngle) * 18, radius: 7, color: "#fff0c0", life: 0.12 })
    );
  }

  upgrade() {
    const U = LW.Config.UPGRADE.turret;
    this.level += 1;
    this.damage = Math.round(this.damage * (1 + U.dmgPct));
    this.attackInterval = Math.max(0.32, +(this.attackInterval - U.cdReduce).toFixed(3));
    if (this.level >= U.splashAt && this.splash < 50) this.splash = 56;
    if (this.level >= U.projAt) this.projectiles = 2;
    if (this.level >= U.projAt + 2) this.projectiles = 3;
  }

  render(ctx) {
    const S = LW.Sprites;
    ctx.save();
    ctx.translate(this.x, this.y);
    // Stone mount
    ctx.fillStyle = "#6a6a72";
    S.roundRect(ctx, -13, -10, 26, 18, 4);
    ctx.fill();
    ctx.fillStyle = "#4f4f57";
    S.roundRect(ctx, -13, 2, 26, 6, 3);
    ctx.fill();
    // Rotating barrel
    ctx.save();
    ctx.rotate(this.aimAngle);
    const rec = this.recoil > 0 ? this.recoil * 4 : 0;
    ctx.fillStyle = "#3a3f48";
    S.roundRect(ctx, -6 - rec, -5, 22, 10, 3);
    ctx.fill();
    ctx.fillStyle = "#23262d";
    ctx.fillRect(14 - rec, -3.5, 4, 7);
    // hub
    ctx.fillStyle = "#8a8a92";
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // level pips
    ctx.fillStyle = "#ffce6b";
    for (let i = 0; i < Math.min(this.level, 6); i++) ctx.fillRect(-12 + i * 4, -14, 3, 2);
    ctx.restore();
  }
};
