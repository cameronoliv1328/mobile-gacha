/* =========================================================================
 * Last Wall — GameInstance.js   (mirrors BP_LW_GameInstance)
 * The persistent meta hub: currencies, campaign progression, pity state and
 * the owning references to HeroCollection + SummonManager. Emits "change"
 * whenever meta state mutates so the UI can refresh.
 * ========================================================================= */
window.LW = window.LW || {};

LW.GameInstance = class GameInstance extends LW.util.Emitter {
  constructor() {
    super();
    this.state = LW.SaveGame.load();
    this.heroes = new LW.HeroCollection(this);
    this.summon = new LW.SummonManager(this);
  }

  persist() {
    LW.SaveGame.save(this.state);
  }

  /* ---- Currencies ----------------------------------------------------- */

  addGold(n, silent) {
    this.state.gold += n;
    this.persist();
    if (!silent) this.emit("change");
    return this.state.gold;
  }

  spendGold(n) {
    if (this.state.gold < n) return false;
    this.state.gold -= n;
    this.persist();
    this.emit("change");
    return true;
  }

  addRegularCrystals(n) {
    this.state.regularCrystals += n;
    this.persist();
    this.emit("change");
  }

  addEpicCrystals(n) {
    this.state.epicCrystals += n;
    this.persist();
    this.emit("change");
  }

  /* ---- Campaign progression -------------------------------------------
   * Two tiers: locations (cities) each contain LEVELS_PER_CITY levels. A level
   * is unlocked when the previous level in its location is cleared; a location
   * is unlocked when the previous location is fully completed. */

  isCityUnlocked(cityIndex) {
    return cityIndex >= 0 && cityIndex <= this.state.unlockedCity;
  }

  // Levels cleared in a location (0..LEVELS_PER_CITY).
  levelsCleared(cityIndex) {
    return (this.state.levelProgress && this.state.levelProgress[cityIndex]) || 0;
  }

  isCityCompleted(cityIndex) {
    return this.levelsCleared(cityIndex) >= LW.Config.LEVELS_PER_CITY;
  }

  // A level is unlocked if its location is unlocked and all prior levels there
  // are cleared (level 0 is always available in an unlocked location).
  isLevelUnlocked(cityIndex, levelIndex) {
    if (!this.isCityUnlocked(cityIndex)) return false;
    return levelIndex <= this.levelsCleared(cityIndex);
  }

  isLevelCompleted(cityIndex, levelIndex) {
    return levelIndex < this.levelsCleared(cityIndex);
  }

  /* Reward + unlock when a LEVEL's final wave is cleared. Returns the reward.
   * Completing the last level of a location unlocks the next location. */
  completeLevel(cityIndex, levelIndex) {
    const already = this.isLevelCompleted(cityIndex, levelIndex);
    // Advance the location's cleared-level count (only ever forward).
    if (levelIndex + 1 > this.levelsCleared(cityIndex)) {
      this.state.levelProgress[cityIndex] = levelIndex + 1;
    }
    const cityDone = this.isCityCompleted(cityIndex);
    this.state.completedCities[cityIndex] = cityDone;

    const bonusGold = LW.Config.reward.levelGold(cityIndex, levelIndex);
    const epic = LW.Config.reward.levelEpicCrystals;
    this.state.gold += bonusGold;
    this.state.epicCrystals += epic;

    // Unlock the next location once this one is fully cleared.
    if (cityDone) {
      const next = Math.min(LW.Config.CITIES - 1, cityIndex + 1);
      if (next > this.state.unlockedCity) this.state.unlockedCity = next;
    }

    if (!already) this.state.stats.levelsCleared = (this.state.stats.levelsCleared || 0) + 1;
    if (cityDone) this.state.stats.citiesCleared = (this.state.stats.citiesCleared || 0) + 1;

    this.persist();
    this.emit("change");
    return { bonusGold, epicCrystals: epic, cityDone, unlockedCity: this.state.unlockedCity, levelsCleared: this.levelsCleared(cityIndex) };
  }

  /* Back-compat shim: completing "a city" == completing its level 0. */
  completeCity(cityIndex) {
    return this.completeLevel(cityIndex, 0);
  }

  /* Reward for clearing a single (non-final) wave. */
  rewardWave(cityIndex, waveIndex, goldMult, bonusCrystals) {
    const gold = Math.round(LW.Config.reward.waveGold(cityIndex, waveIndex) * (goldMult || 1));
    const crystals = LW.Config.reward.waveCrystals + (bonusCrystals || 0);
    this.state.gold += gold;
    this.state.regularCrystals += crystals;
    this.state.stats.wavesCleared = (this.state.stats.wavesCleared || 0) + 1;
    this.persist();
    this.emit("change");
    return { gold, crystals };
  }

  /* ---- Maintenance ---------------------------------------------------- */

  hardReset() {
    LW.SaveGame.clear();
    this.state = LW.SaveGame.defaultState();
    this.persist();
    this.emit("change");
  }
};
