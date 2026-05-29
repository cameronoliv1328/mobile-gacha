/* =========================================================================
 * Last Wall — levels.js
 * Procedurally builds the 10 cities x 10 waves campaign so content is dense
 * but data-driven. getWave() returns the spawn script for one wave.
 * ========================================================================= */
window.LW = window.LW || {};

LW.Levels = (function () {
  "use strict";
  const U = LW.util;
  const C = LW.Config;

  const CITY_NAMES = [
    "Thornvale",
    "Oakreach",
    "Stonebridge",
    "Mistfen",
    "Highcairn",
    "Emberholt",
    "Frostgate",
    "Duskwatch",
    "Ravenspire",
    "Last Wall",
  ];

  // Which enemy types are available by the given (0-based) city index.
  function poolFor(cityIndex) {
    const pool = ["slime", "goblin"];
    if (cityIndex >= 1) pool.push("wolf");
    if (cityIndex >= 2) pool.push("orc");
    if (cityIndex >= 3) pool.push("necromancer");
    if (cityIndex >= 5) pool.push("orc"); // weight orcs more in late cities
    return pool;
  }

  // Stat multiplier applied to every enemy in a given wave.
  function scaleFor(cityIndex, waveIndex) {
    return 1 + 0.2 * cityIndex + 0.07 * waveIndex;
  }

  /* getWave(cityIndex, waveIndex) -> { scale, isBoss, spawns:[{enemyId,t}] } */
  function getWave(cityIndex, waveIndex) {
    const isBoss = waveIndex === C.WAVES_PER_CITY - 1;
    const scale = scaleFor(cityIndex, waveIndex);
    const pool = poolFor(cityIndex);

    // Slightly tighter spawn cadence in later content.
    const gap = Math.max(0.45, C.spawnInterval - 0.02 * cityIndex - 0.015 * waveIndex);

    const ids = [];
    if (isBoss) {
      // A wall of fodder, then the boss, then a final escort.
      const adds = 6 + cityIndex;
      for (let i = 0; i < adds; i++) ids.push(U.pick(pool));
      ids.push("ogre");
      const escort = 4 + Math.floor(cityIndex / 2);
      for (let i = 0; i < escort; i++) ids.push(U.pick(pool));
    } else {
      const count = 5 + cityIndex + Math.floor(waveIndex * 1.1);
      for (let i = 0; i < count; i++) ids.push(U.pick(pool));
      // Occasional mini-pressure spike of the toughest available unit.
      if (waveIndex >= 4 && U.chance(0.5)) {
        const tough = pool.includes("orc") ? "orc" : "goblin";
        ids.splice(U.randInt(2, ids.length), 0, tough, tough);
      }
    }

    const spawns = [];
    let t = 0.6;
    for (const id of ids) {
      spawns.push({ enemyId: id, t });
      // Bosses pause the cadence so fodder clears first.
      t += id === "ogre" ? gap * 2.2 : gap;
    }

    return { scale, isBoss, spawns };
  }

  function cityName(cityIndex) {
    return CITY_NAMES[cityIndex] || "City " + (cityIndex + 1);
  }

  return { getWave, cityName, scaleFor, poolFor, CITY_NAMES };
})();
