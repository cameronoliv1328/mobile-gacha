/* =========================================================================
 * Last Wall — SummonManager.js   (mirrors BP_SummonManager)
 * Gacha rolls, rarity tables, Epic-banner pity and duplicate handling.
 *
 *   Regular : Rare 85% / Epic 15% / Legendary 0%
 *   Epic    : Epic 75% / Legendary 25%, guaranteed Legendary after 5
 *             consecutive non-Legendary Epic pulls.
 * ========================================================================= */
window.LW = window.LW || {};

LW.SummonManager = class SummonManager {
  constructor(game) {
    this.game = game;
  }

  get state() {
    return this.game.state;
  }

  costOf(banner) {
    return LW.Config.gacha[banner].cost;
  }

  currencyFor(banner) {
    return banner === "epic" ? this.state.epicCrystals : this.state.regularCrystals;
  }

  canRoll(banner) {
    return this.currencyFor(banner) >= this.costOf(banner);
  }

  // How many more non-Legendary Epic pulls until the pity guarantee triggers.
  pityRemaining() {
    return Math.max(0, LW.Config.gacha.epic.pity - this.state.epicPity);
  }

  _spend(banner) {
    if (banner === "epic") this.state.epicCrystals -= this.costOf(banner);
    else this.state.regularCrystals -= this.costOf(banner);
  }

  _rollRarity(banner) {
    const cfg = LW.Config.gacha[banner];
    if (banner === "epic") {
      // Pity: after `pity` non-Legendary pulls, force a Legendary.
      if (this.state.epicPity >= cfg.pity) {
        return { rarity: "Legendary", forced: true };
      }
      const r = LW.util.weightedPick(cfg.table).key;
      return { rarity: r, forced: false };
    }
    return { rarity: LW.util.weightedPick(cfg.table).key, forced: false };
  }

  _heroOfRarity(rarity) {
    const candidates = LW.HeroData.list.filter((h) => h.rarity === rarity);
    return LW.util.pick(candidates);
  }

  /* Perform one roll. Returns a result object or null if unaffordable. */
  roll(banner) {
    if (!this.canRoll(banner)) return null;
    this._spend(banner);

    const { rarity, forced } = this._rollRarity(banner);

    // Maintain Epic-banner pity counter.
    if (banner === "epic") {
      if (rarity === "Legendary") this.state.epicPity = 0;
      else this.state.epicPity += 1;
    }

    const def = this._heroOfRarity(rarity);
    const add = this.game.heroes.addHero(def.id); // persists + emits
    this.state.stats.summons = (this.state.stats.summons || 0) + 1;
    this.game.persist();
    this.game.emit("change");

    return {
      banner,
      heroId: def.id,
      def,
      rarity,
      forced,
      isNew: add.isNew,
      dupeGold: add.dupeGold,
      pityRemaining: this.pityRemaining(),
    };
  }

  rollMany(banner, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const r = this.roll(banner);
      if (!r) break;
      out.push(r);
    }
    return out;
  }
};
