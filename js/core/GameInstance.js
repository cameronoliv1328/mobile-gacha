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

  /* ---- Campaign progression ------------------------------------------- */

  isCityUnlocked(cityIndex) {
    return cityIndex >= 0 && cityIndex <= this.state.unlockedCity;
  }

  isCityCompleted(cityIndex) {
    return !!this.state.completedCities[cityIndex];
  }

  /* Reward + unlock when a city's 10th wave is cleared. Returns the reward. */
  completeCity(cityIndex) {
    const wasCompleted = this.state.completedCities[cityIndex];
    this.state.completedCities[cityIndex] = true;

    const bonusGold = LW.Config.reward.levelGold(cityIndex);
    const epic = LW.Config.reward.levelEpicCrystals;
    this.state.gold += bonusGold;
    this.state.epicCrystals += epic;

    const next = Math.min(LW.Config.CITIES - 1, cityIndex + 1);
    if (next > this.state.unlockedCity) this.state.unlockedCity = next;

    if (!wasCompleted) this.state.stats.citiesCleared = (this.state.stats.citiesCleared || 0) + 1;

    this.persist();
    this.emit("change");
    return { bonusGold, epicCrystals: epic, unlockedCity: this.state.unlockedCity };
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
