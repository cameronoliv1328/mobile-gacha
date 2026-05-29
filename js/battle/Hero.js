/* =========================================================================
 * Last Wall — Hero.js   (mirrors BP_HeroBase)
 * A deployed hero at one of the 3 positions. Spawns 2 matching support
 * units, carries roster identity, and reapplies battle buffs (in-battle
 * hero upgrades + wall bastion bonus) without losing its HP fraction.
 * ========================================================================= */
window.LW = window.LW || {};

LW.Hero = class Hero extends LW.Combatant {
  constructor(battle, o) {
    const theme = o.def.theme;
    super(battle, {
      x: o.x,
      y: o.y,
      cls: o.def.class,
      maxHP: o.baseStats.maxHP,
      atk: o.baseStats.atk,
      attackInterval: o.baseStats.attackInterval,
      range: o.baseStats.range,
      splash: o.baseStats.splash || (o.def.class === "Fighter" ? 26 : 0),
      blocks: o.def.class === "Fighter",
      isHero: true,
      scale: 1.2,
      primary: theme.primary,
      secondary: theme.secondary,
      trim: theme.trim,
      projColor: theme.trim,
    });
    this.heroId = o.def.id;
    this.def = o.def;
    this.heroName = o.def.name;
    this.position = o.position; // 'bridge' | 'left' | 'right'
    this.baseStats = o.baseStats;
    this.supportUnits = [];
  }

  spawnSupportUnits(anchors) {
    const C = LW.Config;
    for (let i = 0; i < C.SUPPORT_PER_HERO; i++) {
      const a = anchors[i] || { x: this.x + (i ? 24 : -24), y: this.y + 18 };
      const u = new LW.SupportUnit(this.battle, {
        parent: this,
        x: a.x,
        y: a.y,
        cls: this.cls,
        maxHP: Math.max(1, Math.round(this.maxHP * C.SUPPORT_HP_PCT)),
        atk: Math.max(1, Math.round(this.atk * C.SUPPORT_ATK_PCT)),
        attackInterval: this.cls === "Archer" ? this.attackInterval * 0.92 : this.attackInterval,
        range: this.range * 0.92,
        splash: this.cls === "Mage" ? this.splash * 0.7 : 0,
        blocks: this.blocks,
        theme: this.def.theme,
      });
      this.supportUnits.push(u);
      this.battle.units.push(u);
    }
  }

  // Apply battle-wide buffs while preserving current HP fraction.
  applyBuffs(buffs, bastionBonus) {
    const onBastion = this.position === "left" || this.position === "right";
    const hpMult = buffs.heroHp * (onBastion ? 1 + bastionBonus : 1);
    const atkMult = buffs.heroAtk;
    const ratio = this.maxHP > 0 ? this.hp / this.maxHP : 1;
    this.maxHP = Math.max(1, Math.round(this.baseStats.maxHP * hpMult));
    this.hp = Math.max(1, Math.round(this.maxHP * ratio));
    this.atk = Math.max(1, Math.round(this.baseStats.atk * atkMult));
    for (const u of this.supportUnits) u.refresh(this.maxHP, this.atk);
  }

  healFull() {
    this.hp = this.maxHP;
    for (const u of this.supportUnits) if (u.alive) u.hp = u.maxHP;
  }

  die() {
    if (!this.alive) return;
    super.die();
    // Support units despawn with their hero (per design rule).
    for (const u of this.supportUnits) u.despawn();
  }
};
