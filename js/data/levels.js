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

  // Stat multiplier applied to every enemy in a given wave. Steep enough that
  // base heroes stall by the early cities and the late cities demand leveling,
  // upgrades, duplicate abilities and element synergy.
  function scaleFor(cityIndex, waveIndex) {
    return 1 + 0.34 * cityIndex + 0.1 * waveIndex;
  }

  /* getWave(cityIndex, waveIndex) -> { scale, isBoss, spawns:[{enemyId,t}] } */
  function getWave(cityIndex, waveIndex) {
    const isBoss = waveIndex === C.WAVES_PER_CITY - 1;
    const scale = scaleFor(cityIndex, waveIndex);
    const pool = poolFor(cityIndex);

    // Tighter spawn cadence in later content (more overlap = more pressure).
    const gap = Math.max(0.38, C.spawnInterval - 0.025 * cityIndex - 0.02 * waveIndex);

    const ids = [];
    if (isBoss) {
      // A wall of fodder, then the boss, then a heavy escort.
      const adds = 8 + 2 * cityIndex;
      for (let i = 0; i < adds; i++) ids.push(U.pick(pool));
      ids.push("ogre");
      const escort = 5 + cityIndex;
      for (let i = 0; i < escort; i++) ids.push(U.pick(pool));
    } else {
      const count = 6 + Math.round(1.5 * cityIndex) + Math.round(1.3 * waveIndex);
      for (let i = 0; i < count; i++) ids.push(U.pick(pool));
      // Pressure spike of the toughest available unit, more common late.
      if (waveIndex >= 3 && U.chance(0.6)) {
        const tough = pool.includes("orc") ? "orc" : "goblin";
        const n = pool.includes("orc") ? 3 : 2;
        const at = U.randInt(2, ids.length);
        for (let i = 0; i < n; i++) ids.splice(at, 0, tough);
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
