/* =========================================================================
 * Last Wall — enemies.js
 * Compact enemy roster (6 types). Base stats are scaled per city/wave by
 * the level data. Shape/colour fields drive the procedural sprite renderer.
 * ========================================================================= */
window.LW = window.LW || {};

LW.EnemyData = {
  list: [
    {
      id: "slime",
      name: "Slime",
      hp: 55,
      atk: 7,
      attackInterval: 1.2,
      speed: 30,
      cityDamage: 1,
      radius: 12,
      color: "#6fcf5a",
      accent: "#caffb0",
      shape: "blob",
    },
    {
      id: "goblin",
      name: "Goblin",
      hp: 85,
      atk: 11,
      attackInterval: 1.0,
      speed: 46,
      cityDamage: 1,
      radius: 11,
      color: "#7fae4b",
      accent: "#d8ff9a",
      shape: "biped",
    },
    {
      id: "wolf",
      name: "Wolf",
      hp: 70,
      atk: 10,
      attackInterval: 0.9,
      speed: 74,
      cityDamage: 1,
      radius: 12,
      color: "#8c8c96",
      accent: "#d8d8e0",
      shape: "beast",
    },
    {
      id: "orc",
      name: "Orc",
      hp: 210,
      atk: 22,
      attackInterval: 1.1,
      speed: 33,
      cityDamage: 2,
      radius: 15,
      color: "#5f8f5a",
      accent: "#b6e0a0",
      shape: "biped",
    },
    {
      id: "necromancer",
      name: "Necromancer",
      hp: 150,
      atk: 17,
      attackInterval: 1.4,
      speed: 36,
      cityDamage: 2,
      radius: 13,
      color: "#7a5fae",
      accent: "#d8c2ff",
      shape: "robed",
    },
    {
      id: "ogre",
      name: "Ogre Siege Beast",
      hp: 1500,
      atk: 60,
      attackInterval: 1.5,
      speed: 22,
      cityDamage: 5,
      radius: 24,
      color: "#a05a4a",
      accent: "#ffcaa0",
      shape: "boss",
      isBoss: true,
    },
  ],

  byId(id) {
    return this.list.find((e) => e.id === id) || null;
  },
};
