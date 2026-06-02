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

  // Number of waves in a level of this location (grows per location).
  function wavesPerLevel(cityIndex) {
    return C.wavesForCity(cityIndex);
  }

  // Difficulty scale rises with location, the level within it, and the wave.
  // Each level is harder than the last within a location.
  function scaleFor(cityIndex, levelIndex, waveIndex) {
    levelIndex = levelIndex || 0;
    return 1 + 0.3 * cityIndex + 0.06 * levelIndex + 0.1 * waveIndex;
  }

  // A "progress" factor 0..~1 combining location + level, used to ramp counts.
  function progress(cityIndex, levelIndex) {
    return cityIndex + (levelIndex || 0) / Math.max(1, C.LEVELS_PER_CITY);
  }

  // getWave(cityIndex, levelIndex, waveIndex). The final wave of each level is
  // the boss wave. (Legacy 2-arg calls treat the 2nd arg as the wave index in
  // level 0.)
  function getWave(cityIndex, levelIndex, waveIndex) {
    if (waveIndex === undefined) { waveIndex = levelIndex; levelIndex = 0; }
    const lastWave = wavesPerLevel(cityIndex) - 1;
    const isBoss = waveIndex === lastWave;
    const scale = scaleFor(cityIndex, levelIndex, waveIndex);
    const prog = progress(cityIndex, levelIndex);
    const fodder = poolFor(cityIndex);
    const specials = specialsFor(cityIndex);
    const gap = Math.max(0.34, C.spawnInterval - 0.02 * prog - 0.02 * waveIndex);

    const ids = [];
    if (isBoss) {
      const adds = 7 + Math.round(2 * prog);
      for (let i = 0; i < adds; i++) ids.push(U.pick(fodder));
      const nSpec = Math.min(specials.length, 2 + Math.floor(prog / 2));
      for (let i = 0; i < nSpec && specials.length; i++) ids.push(U.pick(specials));
      ids.push("ogre");
      if (cityIndex >= 6) ids.push("warboss");
      const escort = 4 + Math.round(prog);
      for (let i = 0; i < escort; i++) ids.push(U.pick(fodder));
    } else {
      const count = 6 + Math.round(1.4 * prog) + Math.round(1.2 * waveIndex);
      for (let i = 0; i < count; i++) ids.push(U.pick(fodder));
      if (specials.length) {
        const nSpec = Math.round(waveIndex * 0.4) + Math.floor(prog / 2);
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

  return { getWave, cityName, scaleFor, wavesPerLevel, poolFor, specialsFor, CITY_NAMES };
})();
