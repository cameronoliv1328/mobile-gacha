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

  /* Add a hero from a summon. Returns { isNew, dupeGold }. */
  addHero(id) {
    if (this.isOwned(id)) {
      const def = LW.HeroData.byId(id);
      const gold = LW.Config.reward.dupeGold[def.rarity] || 50;
      this.game.addGold(gold, true);
      return { isNew: false, dupeGold: gold };
    }
    this.state.heroes[id] = { level: 1 };
    this.game.persist();
    this.game.emit("change");
    return { isNew: true, dupeGold: 0 };
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
