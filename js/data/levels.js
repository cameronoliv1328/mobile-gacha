/* =========================================================================
 * Last Wall — levels.js
 * Procedurally builds the 10 cities x 10 waves campaign. Fodder + a growing
 * sprinkle of "special" archetypes (flying, shielded, healer, armored,
 * burrower, bannerman) introduced city by city so each new threat teaches a
 * counter. getWave() returns the spawn script for one wave.
 * ========================================================================= */
window.LW = window.LW || {};

LW.Levels = (function () {
  "use strict";
  const U = LW.util;
  const C = LW.Config;

  const CITY_NAMES = [
    "Thornvale", "Oakreach", "Stonebridge", "Mistfen", "Highcairn",
    "Emberholt", "Frostgate", "Duskwatch", "Ravenspire", "Last Wall",
  ];

  // Weighted fodder pool by (0-based) city index.
  function poolFor(cityIndex) {
    const pool = ["slime", "slime", "goblin", "goblin"];
    if (cityIndex >= 1) pool.push("wolf", "goblin");
    if (cityIndex >= 2) pool.push("orc");
    if (cityIndex >= 4) pool.push("orc", "wolf");
    return pool;
  }

  // Special archetypes unlocked per city (each teaches a counter).
  function specialsFor(cityIndex) {
    const s = [];
    if (cityIndex >= 1) s.push("harpy"); // flying -> need ranged
    if (cityIndex >= 2) s.push("shieldbearer"); // shielded -> magic/AoE
    if (cityIndex >= 3) s.push("necromancer", "harpy"); // healer -> focus fire
    if (cityIndex >= 4) s.push("knight"); // armored -> magic
    if (cityIndex >= 5) s.push("mole"); // burrower -> gate/turret
    if (cityIndex >= 6) s.push("warboss"); // bannerman -> priority kill
    return s;
  }

  function scaleFor(cityIndex, waveIndex) {
    return 1 + 0.3 * cityIndex + 0.1 * waveIndex;
  }

  function getWave(cityIndex, waveIndex) {
    const isBoss = waveIndex === C.WAVES_PER_CITY - 1;
    const scale = scaleFor(cityIndex, waveIndex);
    const fodder = poolFor(cityIndex);
    const specials = specialsFor(cityIndex);
    const gap = Math.max(0.38, C.spawnInterval - 0.025 * cityIndex - 0.02 * waveIndex);

    const ids = [];
    if (isBoss) {
      const adds = 7 + 2 * cityIndex;
      for (let i = 0; i < adds; i++) ids.push(U.pick(fodder));
      const nSpec = Math.min(specials.length, 2 + Math.floor(cityIndex / 2));
      for (let i = 0; i < nSpec && specials.length; i++) ids.push(U.pick(specials));
      ids.push("ogre");
      if (cityIndex >= 6) ids.push("warboss");
      const escort = 4 + cityIndex;
      for (let i = 0; i < escort; i++) ids.push(U.pick(fodder));
    } else {
      const count = 6 + Math.round(1.4 * cityIndex) + Math.round(1.2 * waveIndex);
      for (let i = 0; i < count; i++) ids.push(U.pick(fodder));
      if (specials.length) {
        const nSpec = Math.round(waveIndex * 0.4) + Math.floor(cityIndex / 2);
        for (let i = 0; i < nSpec; i++) ids.splice(U.randInt(1, ids.length), 0, U.pick(specials));
      }
    }

    const spawns = [];
    let t = 0.6;
    for (const id of ids) {
      spawns.push({ enemyId: id, t });
      t += id === "ogre" ? gap * 2.4 : gap;
    }
    return { scale, isBoss, spawns };
  }

  function cityName(cityIndex) {
    return CITY_NAMES[cityIndex] || "City " + (cityIndex + 1);
  }

  return { getWave, cityName, scaleFor, poolFor, specialsFor, CITY_NAMES };
})();
