/* =========================================================================
 * Last Wall — HeroCollection.js   (mirrors BP_HeroCollectionManager)
 * Owned heroes, leveling (gold), team selection and the canonical stat
 * computation used by both the meta UI and the battle entities.
 * ========================================================================= */
window.LW = window.LW || {};

LW.HeroCollection = class HeroCollection {
  constructor(game) {
    this.game = game;
  }

  get state() {
    return this.game.state;
  }

  /* ---- Ownership ------------------------------------------------------ */

  isOwned(id) {
    return !!this.state.heroes[id];
  }

  level(id) {
    const h = this.state.heroes[id];
    return h ? h.level : 0;
  }

  ownedIds() {
    return Object.keys(this.state.heroes);
  }

  ownedHeroes() {
    return this.ownedIds()
      .map((id) => LW.HeroData.byId(id))
      .filter(Boolean);
  }

  /* Add a hero from a summon. On a duplicate, increments the copy counter
   * (which can unlock an ability tier) and grants gold.
   * Returns { isNew, dupeGold, copies, unlockedTier, tiers }. */
  addHero(id) {
    const def = LW.HeroData.byId(id);
    if (this.isOwned(id)) {
      const h = this.state.heroes[id];
      const before = this.unlockedTiers(id);
      h.copies = (h.copies || 0) + 1;
      const after = this.unlockedTiers(id);
      const base = LW.Config.reward.dupeGold[def.rarity] || 50;
      // Reduced gold while abilities are still unlocking, full once maxed.
      const gold = after >= 3 ? base : Math.round(base * 0.5);
      this.game.addGold(gold, true);
      this.game.persist();
      this.game.emit("change");
      return { isNew: false, dupeGold: gold, copies: h.copies, unlockedTier: after > before ? after : 0, tiers: after };
    }
    this.state.heroes[id] = { level: 1, copies: 0 };
    this.game.persist();
    this.game.emit("change");
    return { isNew: true, dupeGold: 0, copies: 0, unlockedTier: 0, tiers: 0 };
  }

  /* ---- Duplicate abilities + element --------------------------------- */

  copies(id) {
    const h = this.state.heroes[id];
    return h ? h.copies || 0 : 0;
  }

  // The copy count at which every duplicate ability is unlocked — i.e. the
  // hero is fully collected. Derived from the last ABILITY_UNLOCKS threshold.
  maxCopies() {
    const u = LW.Config.ABILITY_UNLOCKS;
    return u[u.length - 1];
  }

  // Owned and fully collected (all duplicate ability tiers unlocked)?
  isMaxed(id) {
    return this.isOwned(id) && this.copies(id) >= this.maxCopies();
  }

  // Retired heroes have left the summon pool: a fully-collected hero of a
  // RETIRE_WHEN_MAXED rarity (Legendaries) so no duplicate can ever be pulled.
  isRetired(id) {
    const def = LW.HeroData.byId(id);
    if (!def || !LW.Config.RETIRE_WHEN_MAXED.includes(def.rarity)) return false;
    return this.isMaxed(id);
  }

  // Number of ability tiers unlocked (0..3) from the copy count.
  unlockedTiers(id) {
    const c = this.copies(id);
    let n = 0;
    for (const need of LW.Config.ABILITY_UNLOCKS) if (c >= need) n++;
    return n;
  }

  copiesForTier(tier) {
    return LW.Config.ABILITY_UNLOCKS[tier - 1];
  }

  isAttuned(id) {
    return this.unlockedTiers(id) >= 1; // Tier I = Attunement
  }

  element(id) {
    const d = LW.HeroData.byId(id);
    return d ? d.element : null;
  }

  // The 3 abilities of a hero with locked/unlocked state.
  abilities(id) {
    const d = LW.HeroData.byId(id);
    if (!d) return [];
    const defs = LW.Config.ABILITIES[d.class] || [];
    const n = this.unlockedTiers(id);
    return defs.map((a, i) => ({
      tier: i + 1,
      name: a.name,
      desc: a.desc,
      unlocked: i < n,
      copiesNeeded: LW.Config.ABILITY_UNLOCKS[i],
    }));
  }

  // Aggregate combat mods from every UNLOCKED ability tier.
  abilityMods(id) {
    const mods = {
      atkMult: 1, hpMult: 1, asMult: 1, rangeMult: 1, splashMult: 1,
      extraProjectiles: 0, reflect: 0, surviveOnce: false, attuned: false,
      slowOnHit: null, ult: null,
    };
    const d = LW.HeroData.byId(id);
    if (!d) return mods;
    const defs = LW.Config.ABILITIES[d.class] || [];
    const n = this.unlockedTiers(id);
    for (let i = 0; i < n; i++) {
      const m = defs[i].mods || {};
      if (m.atkMult) mods.atkMult *= m.atkMult;
      if (m.hpMult) mods.hpMult *= m.hpMult;
      if (m.asMult) mods.asMult *= m.asMult;
      if (m.rangeMult) mods.rangeMult *= m.rangeMult;
      if (m.splashMult) mods.splashMult *= m.splashMult;
      if (m.extraProjectiles) mods.extraProjectiles += m.extraProjectiles;
      if (m.reflect) mods.reflect = Math.max(mods.reflect, m.reflect);
      if (m.surviveOnce) mods.surviveOnce = true;
      if (m.attune) mods.attuned = true;
      if (m.slowOnHit) mods.slowOnHit = m.slowOnHit;
      if (m.ult) mods.ult = m.ult;
    }
    return mods;
  }

  /* ---- Leveling ------------------------------------------------------- */

  levelUpCost(id) {
    const lvl = this.level(id);
    if (lvl <= 0 || lvl >= LW.Config.HERO_MAX_LEVEL) return null;
    return LW.Config.LEVEL_COST[lvl + 1];
  }

  canLevelUp(id) {
    const cost = this.levelUpCost(id);
    return cost != null && this.state.gold >= cost;
  }

  levelUp(id) {
    const cost = this.levelUpCost(id);
    if (cost == null || this.state.gold < cost) return false;
    this.state.gold -= cost;
    this.state.heroes[id].level += 1;
    this.game.persist();
    this.game.emit("change");
    return true;
  }

  /* ---- Stats (canonical) ---------------------------------------------
   * Returns the computed combat stats for a hero at a given level. If level
   * is omitted, the owned level is used. */
  computeStats(id, levelOverride) {
    const def = LW.HeroData.byId(id);
    if (!def) return null;
    const cls = LW.Config.CLASS[def.class];
    const rarity = LW.Config.RARITY[def.rarity];
    const lvl = levelOverride || this.level(id) || 1;
    const growth = 1 + LW.Config.HERO_GROWTH * (lvl - 1);
    const mult = rarity.mult * growth;
    return {
      maxHP: Math.round(cls.baseHP * mult),
      atk: Math.round(cls.baseATK * mult),
      attackInterval: cls.attackInterval,
      range: cls.range,
      splash: cls.splash || 0,
      level: lvl,
      class: def.class,
      blocks: cls.blocks,
    };
  }

  /* ---- Team ----------------------------------------------------------- */

  getTeam() {
    return Object.assign({}, this.state.team);
  }

  // Element synergy for the currently selected team (for meta UI preview).
  teamSynergy() {
    const t = this.state.team;
    const deployed = [];
    for (const slot of ["bridge", "left", "right"]) {
      const id = t[slot];
      if (!id) continue;
      const d = LW.HeroData.byId(id);
      if (!d) continue;
      deployed.push({ element: d.element, attuned: this.isAttuned(id) });
    }
    return LW.Synergy.compute(deployed);
  }

  // Which positions a class may occupy.
  classAllowedAt(cls, slot) {
    if (slot === "bridge") return cls === "Fighter";
    return cls === "Archer" || cls === "Mage"; // bastions
  }

  setTeamSlot(slot, heroId) {
    const def = LW.HeroData.byId(heroId);
    if (!def || !this.isOwned(heroId)) return false;
    if (!this.classAllowedAt(def.class, slot)) return false;
    // Prevent the same hero from filling two slots.
    const team = this.state.team;
    for (const s of ["bridge", "left", "right"]) {
      if (s !== slot && team[s] === heroId) team[s] = null;
    }
    team[slot] = heroId;
    this.game.persist();
    this.game.emit("change");
    return true;
  }

  // A team is battle-ready only when all three positions are filled legally.
  validateTeam() {
    const t = this.state.team;
    const slots = [
      ["bridge", t.bridge],
      ["left", t.left],
      ["right", t.right],
    ];
    for (const [slot, id] of slots) {
      if (!id || !this.isOwned(id)) return false;
      const def = LW.HeroData.byId(id);
      if (!def || !this.classAllowedAt(def.class, slot)) return false;
    }
    return true;
  }
};
