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
      damageType: LW.Config.COMBAT.classDamageType[o.def.class] || "physical",
      element: o.def.element || "Neutral",
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
    this.skillDef = LW.Config.ACTIVE_SKILLS[o.def.class] || null;
    this.skillCD = 0;
    this.skillTier3 = false;
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
    this.skillTier3 = !!am.ult; // tier-3 duplicate ability upgrades the skill

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

    if (this.skillCD > 0) this.skillCD -= dt;
  }

  /* ---- Active skill --------------------------------------------------- */

  get skillReady() {
    return this.alive && this.skillCD <= 0;
  }

  // Merged skill params (tier-3 duplicate ability overrides base).
  skillParams() {
    const d = this.skillDef;
    if (!d) return null;
    return this.skillTier3 ? Object.assign({}, d, d.tier3) : d;
  }

  skillRange() {
    const p = this.skillParams();
    return p && p.aim === "target" ? p.range : 0;
  }

  // Cast at a world point (Fighter ignores it and self-centres). Returns ok.
  castSkill(x, y) {
    if (!this.skillReady) return false;
    const p = this.skillParams();
    if (!p) return false;
    const cx = p.aim === "self" ? this.x : x;
    const cy = p.aim === "self" ? this.y : y;
    const dmg = this.effATK() * p.dmgMult;
    const atk = { type: this.damageType, element: this.element, status: this._status() };
    const volleys = p.volleys || 1;
    for (let i = 0; i < volleys; i++) {
      this.battle.damageEnemiesInRadius(cx, cy, p.radius, dmg / volleys, this, null, atk);
    }
    if (p.knockback) this.battle.knockbackEnemies(cx, cy, p.radius, p.knockback);
    if (p.slow) {
      for (const e of this.battle.enemies) {
        if (e.alive && LW.util.dist2(cx, cy, e.x, e.y) <= p.radius * p.radius) e.applySlow(p.slow.factor, p.slow.dur);
      }
    }
    this.skillCD = p.cooldown;
    this._skillVfx(cx, cy, p);
    return true;
  }

  _skillVfx(cx, cy, p) {
    const col = p.color || this.trim;
    this.battle.addEffect(new LW.Effect("ring", { x: cx, y: cy, radius: p.radius, color: col, width: 5, life: 0.5 }));
    this.battle.addEffect(new LW.Effect("flash", { x: cx, y: cy, radius: p.radius * 0.6, color: col, life: 0.32 }));
    for (let i = 0; i < 10; i++) {
      this.battle.addEffect(new LW.Effect("spark", { x: cx, y: cy, color: col, spread: p.radius * 0.8, count: 10, life: 0.5, seed: i }));
    }
    this.battle.addEffect(new LW.Effect("text", { x: cx, y: cy - 30, text: this.skillDef.name + "!", color: col, size: 14, bold: true, vy: -20, life: 0.9 }));
  }

  // Reset per-wave state (survive-once, surge, skill cooldown).
  resetForWave() {
    this._survived = false;
    this.atkBuff = 1;
    this._atkBuffT = 0;
    this.skillCD = 0;
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
