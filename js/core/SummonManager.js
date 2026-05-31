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

  // Heroes of a rarity that are still obtainable. Fully-collected Legendaries
  // are retired (removed from the wish pool) so they never appear again.
  availableOfRarity(rarity) {
    return LW.HeroData.list.filter((h) => h.rarity === rarity && !this.game.heroes.isRetired(h.id));
  }

  // How many Legendaries remain in the pool (none => the banner can no longer
  // award a Legendary; rolls that hit it drop a rarity instead).
  legendariesRemaining() {
    return this.availableOfRarity("Legendary").length;
  }

  _heroOfRarity(rarity) {
    // Walk down from the rolled rarity. If every hero of that rarity has been
    // retired (e.g. all Legendaries fully collected), award the next rarity
    // down rather than ever handing out a duplicate of a retired hero.
    const order = ["Legendary", "Epic", "Rare"];
    let start = order.indexOf(rarity);
    if (start < 0) start = order.length - 1;
    for (let i = start; i < order.length; i++) {
      const avail = this.availableOfRarity(order[i]);
      if (avail.length) return LW.util.pick(avail);
    }
    return LW.util.pick(LW.HeroData.list); // pathological: nothing left
  }

  /* Perform one roll. Returns a result object or null if unaffordable. */
  roll(banner) {
    if (!this.canRoll(banner)) return null;
    this._spend(banner);

    const rolled = this._rollRarity(banner);

    // Maintain Epic-banner pity counter (tracks the ROLLED rarity, regardless
    // of whether a Legendary was actually available to award).
    if (banner === "epic") {
      if (rolled.rarity === "Legendary") this.state.epicPity = 0;
      else this.state.epicPity += 1;
    }

    // Resolve to a concrete hero; the rarity may be downgraded if the rolled
    // rarity's pool is exhausted (all retired).
    const def = this._heroOfRarity(rolled.rarity);
    const rarity = def.rarity;
    const downgraded = rarity !== rolled.rarity;

    const add = this.game.heroes.addHero(def.id); // persists + emits
    this.state.stats.summons = (this.state.stats.summons || 0) + 1;
    this.game.persist();
    this.game.emit("change");

    return {
      banner,
      heroId: def.id,
      def,
      rarity,
      forced: rolled.forced && !downgraded,
      downgraded,
      isNew: add.isNew,
      dupeGold: add.dupeGold,
      copies: add.copies,
      unlockedTier: add.unlockedTier, // 1..3 if a duplicate ability just unlocked
      tiers: add.tiers,
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
