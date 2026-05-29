/* =========================================================================
 * Last Wall — Hero.js   (mirrors BP_HeroBase)
 * A deployed hero at one of the 3 positions. Spawns 2 matching support units,
 * folds in level/rarity stats + in-battle upgrades + duplicate abilities +
 * team synergy, and runs signature behaviours (ultimate, regen, survive-once).
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
      spriteId: o.def.id,
      spriteH: 78,
      primary: theme.primary,
      secondary: theme.secondary,
      trim: theme.trim,
      projColor: theme.trim,
    });
    this.heroId = o.def.id;
    this.def = o.def;
    this.heroName = o.def.name;
    this.element = o.def.element;
    this.position = o.position; // 'bridge' | 'left' | 'right'
    this.baseStats = o.baseStats;
    this.baseSplash = this.splash;
    this.abilityMods =
      o.abilityMods || { atkMult: 1, hpMult: 1, asMult: 1, rangeMult: 1, splashMult: 1, extraProjectiles: 0, reflect: 0, surviveOnce: false, attuned: false, slowOnHit: null, ult: null };
    this.synergyMods = null;
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
        attackInterval: this.attackInterval,
        range: this.range * 0.92,
        splash: this.cls === "Mage" ? this.splash * 0.7 : 0,
        blocks: this.blocks,
        theme: this.def.theme,
      });
      this.supportUnits.push(u);
      this.battle.units.push(u);
    }
  }

  // Recompute final stats from base * (in-battle buffs) * abilities * synergy,
  // preserving current HP fraction. Also configures effects + the squad.
  applyBuffs() {
    const am = this.abilityMods;
    const sm = this.synergyMods || {};
    const onBastion = this.position === "left" || this.position === "right";
    const run = this.battle.runBuffs;
    const bastionBonus = this.battle.wall.bastionBonus;

    const hpMult = run.heroHp * (onBastion ? 1 + bastionBonus : 1) * am.hpMult * (sm.hpMult || 1);
    const atkMult = run.heroAtk * am.atkMult * (sm.atkMult || 1);
    const asMult = (am.asMult || 1) * (sm.asMult || 1);

    const ratio = this.maxHP > 0 ? this.hp / this.maxHP : 1;
    this.maxHP = Math.max(1, Math.round(this.baseStats.maxHP * hpMult));
    this.hp = Math.max(1, Math.round(this.maxHP * ratio));
    this.atk = Math.max(1, Math.round(this.baseStats.atk * atkMult));
    this.attackInterval = this.baseStats.attackInterval / asMult;
    this.range = this.baseStats.range * (am.rangeMult || 1);
    this.splash = this.baseSplash * (am.splashMult || 1);

    this.extraProjectiles = am.extraProjectiles || 0;
    this.reflect = am.reflect || 0;
    this.surviveOnce = !!am.surviveOnce;
    this.regen = sm.regen || 0;
    this.slowOnHit = am.slowOnHit || sm.slowOnHit || null;
    this.burnOnHit = sm.burnOnHit || null;
    this.ult = am.ult || null;
    if (this.ult) {
      if (this.ultCD == null) this.ultCD = this.ult.interval * 0.6;
    } else {
      this.ultCD = null;
    }

    for (const u of this.supportUnits) {
      u.refresh(this.maxHP, this.atk);
      u.attackInterval = this.attackInterval * (this.cls === "Archer" ? 0.95 : 1);
      u.range = this.range * 0.92;
      u.splash = this.cls === "Mage" ? this.splash * 0.7 : 0;
      u.slowOnHit = this.slowOnHit;
      u.burnOnHit = this.burnOnHit;
    }
  }

  update(dt) {
    super.update(dt);
    if (!this.alive) return;

    // Verdant synergy: regenerate HP.
    if (this.regen > 0 && this.hp < this.maxHP) {
      this.hp = Math.min(this.maxHP, this.hp + this.maxHP * this.regen * dt);
    }

    // Tier-III signature ultimate (Rain of Arrows / Cataclysm).
    if (this.ult) {
      this.ultCD -= dt;
      if (this.ultCD <= 0) {
        const tgt = this.battle.bestTargetInRange(this.x, this.y, this.range);
        if (tgt) {
          this.ultCD = this.ult.interval;
          this._castUlt(tgt);
        } else {
          this.ultCD = 0.25; // wait for a target
        }
      }
    }
  }

  _castUlt(tgt) {
    const col = this.ult.type === "meteor" ? "#ff8a3a" : this.trim;
    const dmg = this.effATK() * this.ult.mult;
    this.battle.damageEnemiesInRadius(tgt.x, tgt.y, this.ult.radius, dmg, this, null, this._status());
    this.battle.addEffect(new LW.Effect("ring", { x: tgt.x, y: tgt.y, radius: this.ult.radius, color: col, width: 5, life: 0.5 }));
    this.battle.addEffect(new LW.Effect("flash", { x: tgt.x, y: tgt.y, radius: this.ult.radius * 0.6, color: col, life: 0.32 }));
    for (let i = 0; i < 8; i++) {
      this.battle.addEffect(new LW.Effect("spark", { x: tgt.x, y: tgt.y, color: col, spread: this.ult.radius * 0.8, count: 8, life: 0.5, seed: i }));
    }
    this.battle.addEffect(
      new LW.Effect("text", { x: tgt.x, y: tgt.y - 30, text: this.ult.type === "meteor" ? "CATACLYSM" : "VOLLEY", color: col, size: 13, bold: true, vy: -20, life: 0.9 })
    );
  }

  // Reset per-wave state (survive-once, surge, ult cooldown).
  resetForWave() {
    this._survived = false;
    this.atkBuff = 1;
    this._atkBuffT = 0;
    this.ultCD = this.ult ? this.ult.interval * 0.6 : null;
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
