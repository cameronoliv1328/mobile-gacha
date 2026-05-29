/* =========================================================================
 * Last Wall — SupportUnit.js   (mirrors BP_SupportUnitBase)
 * A matching squad member spawned with (and themed after) a hero. Stats are
 * derived from the parent hero; the unit despawns when its hero dies.
 * ========================================================================= */
window.LW = window.LW || {};

LW.SupportUnit = class SupportUnit extends LW.Combatant {
  constructor(battle, o) {
    super(battle, {
      x: o.x,
      y: o.y,
      cls: o.cls,
      maxHP: o.maxHP,
      atk: o.atk,
      attackInterval: o.attackInterval,
      range: o.range,
      splash: o.splash || 0,
      blocks: o.blocks,
      isHero: false,
      scale: 0.92,
      primary: o.theme.primary,
      secondary: o.theme.secondary,
      trim: o.theme.trim,
      projColor: o.theme.trim,
    });
    this.parent = o.parent;
    this.role = o.cls === "Fighter" ? "Blocker" : "Support";
  }

  // Re-derive stats when the parent hero is buffed mid-battle.
  refresh(parentMaxHP, parentATK) {
    const C = LW.Config;
    const ratio = this.maxHP > 0 ? this.hp / this.maxHP : 1;
    this.maxHP = Math.max(1, Math.round(parentMaxHP * C.SUPPORT_HP_PCT));
    this.atk = Math.max(1, Math.round(parentATK * C.SUPPORT_ATK_PCT));
    this.hp = Math.round(this.maxHP * ratio);
  }

  despawn() {
    if (!this.alive) return;
    this.alive = false;
    this.battle.addEffect(
      new LW.Effect("spark", { x: this.x, y: this.y - 14, color: this.primary, spread: 10, count: 5, life: 0.3, seed: Math.random() * 6 })
    );
  }
};
