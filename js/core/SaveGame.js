/* =========================================================================
 * Last Wall — SaveGame.js   (mirrors BP_LW_SaveGame)
 * Pure persistence layer over localStorage. Defines the default save shape
 * and reconciles old/partial saves with the current default.
 * ========================================================================= */
window.LW = window.LW || {};

LW.SaveGame = (function () {
  "use strict";
  const C = LW.Config;

  function defaultState() {
    const heroes = {};
    for (const id of LW.HeroData.starters) heroes[id] = { level: 1 };
    return {
      version: 1,
      // Fresh start: a little gold to feel progression, but ZERO summon
      // currency — crystals are earned from waves/cities.
      gold: 150,
      regularCrystals: 0,
      epicCrystals: 0,
      epicPity: 0, // non-Legendary Epic-banner pulls since the last Legendary
      unlockedCity: 0, // highest city index the player may enter
      completedCities: new Array(C.CITIES).fill(false),
      heroes, // { heroId: { level } }
      team: {
        bridge: "fighter_brick",
        left: "archer_robin",
        right: "mage_ember",
      },
      stats: { wavesCleared: 0, citiesCleared: 0, summons: 0 },
    };
  }

  function load() {
    let raw = null;
    try {
      raw = localStorage.getItem(C.SAVE_KEY);
    } catch (e) {
      raw = null;
    }
    if (!raw) return defaultState();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return defaultState();
    }
    // Merge onto defaults so missing fields are filled in.
    const def = defaultState();
    const state = Object.assign(def, parsed);
    state.completedCities = (parsed.completedCities || def.completedCities).slice(0, C.CITIES);
    while (state.completedCities.length < C.CITIES) state.completedCities.push(false);
    state.team = Object.assign({}, def.team, parsed.team || {});
    state.heroes = Object.assign({}, parsed.heroes || def.heroes);
    state.stats = Object.assign({}, def.stats, parsed.stats || {});
    return state;
  }

  function save(state) {
    try {
      localStorage.setItem(C.SAVE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clear() {
    try {
      localStorage.removeItem(C.SAVE_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  return { defaultState, load, save, clear };
})();
