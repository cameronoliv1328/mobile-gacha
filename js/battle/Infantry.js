/* =========================================================================
 * Last Wall — Infantry.js   (BP_GuardInfantry)
 * A blocking foot soldier spawned by a Guard Post tower. It marches from the
 * tower to a guard point on the path and body-blocks monsters there, fighting
 * whoever it has engaged. When killed it leaves a gap; the tower respawns it.
 * Reuses the Combatant melee/attack core but adds march-to-post movement.
 * ========================================================================= */
window.LW = window.LW || {};

LW.Infantry = class Infantry extends LW.Combatant {
  constructor(battle, o) {
    super(battle, {
      x: o.x,
      y: o.y,
      cls: "Fighter",
      maxHP: o.maxHP,
      atk: o.atk,
      attackInterval: o.attackInterval,
      range: 30,
      splash: 0,
      blocks: true,
      isHero: false,
      scale: 0.8,
      spriteId: null, // drawn via the procedural humanoid painter
      spriteH: 48,
      damageType: "physical",
      element: "Neutral",
      primary: "#6f7782", secondary: "#474d56", trim: "#cdd6e2",
    });
    this.tower = o.tower;
    this.role = "Blocker";
    this.guardX = o.guardX;
    this.guardY = o.guardY;
    this.speed = 70;
    this.engaged = null; // the enemy this unit is currently blocking
  }

  // Find a blockable monster very close to the guard post to body-block.
  _findBlockTarget() {
    let best = null, bestD = 34 * 34;
    for (const e of this.battle.enemies) {
      if (!e.alive || !e.blockable || !e.targetable) continue;
      const d = LW.util.dist2(this.guardX, this.guardY, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  update(dt) {
    if (!this.alive) return;
    this.bobT += dt * 4;
    this.animT += dt;
    if (this.swingTimer > 0) this.swingTimer -= dt;
    this.attackCD -= dt;

    // March to the guard post if not yet there.
    const dx = this.guardX - this.x, dy = this.guardY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 6) {
      const step = Math.min(dist, this.speed * dt);
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
      this.facing = dx >= 0 ? 1 : -1;
    }

    // Engage a monster at the post (melee). This also makes the unit a valid
    // "blocker" for BattleManager.nearestBlocker so monsters stop and fight.
    const tgt = this._findBlockTarget();
    this.target = tgt;
    if (tgt) {
      this.facing = tgt.x >= this.x ? 1 : -1;
      if (this.attackCD <= 0) {
        const atk = { type: this.damageType, element: this.element, status: this._status() };
        this.battle.damageEnemy(tgt, this.effATK(), this, atk);
        this.battle.addEffect(new LW.Effect("spark", { x: tgt.x, y: tgt.y - 8, color: this.trim, spread: 12, life: 0.2, seed: Math.random() * 6 }));
        this.attackCD = this.attackInterval;
        this.swingTimer = this.swingDur;
      }
    }
  }

  despawn() {
    if (!this.alive) return;
    this.alive = false;
    this.battle.addEffect(new LW.Effect("spark", { x: this.x, y: this.y - 12, color: this.primary, spread: 9, count: 4, life: 0.3, seed: Math.random() * 6 }));
  }
};
