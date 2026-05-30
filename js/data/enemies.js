/* =========================================================================
 * Last Wall — enemies.js
 * Enemy roster with combat archetypes + elemental affinities (Combat 2.0).
 *
 * Affinity fields (all optional):
 *   element       own element (also = the status it shrugs off)
 *   weakElement   takes x1.5 from this element
 *   resistElement takes x0.6 from this element
 *   weakType      'physical' | 'magic'  -> x1.5 from that damage type
 *   physResist    0..0.8 fraction of physical damage ignored (armor)
 *   magicResist   0..0.8 fraction of magic damage ignored (wards)
 *   statusImmune  [ 'burn','frozen','wet','shock','slow' ] statuses ignored
 *
 * Archetype flags:
 *   flying        bypasses the Fighter; only ranged/turret can hit it
 *   armored       (use physResist) heavy plate
 *   shieldHP      a frontal shield pool absorbed before HP (status-immune up)
 *   healer        heals nearby wounded enemies + can revive
 *   splitInto     id spawned x splitCount on death
 *   burrower      untargetable underground through the field, surfaces at gate
 *   berserker     gains atk + speed as HP drops
 *   bannerman     aura buffs nearby enemies (atk/speed)
 *   spriteId      sprite to draw (defaults to id; lets variants reuse art)
 * ========================================================================= */
window.LW = window.LW || {};

LW.EnemyData = {
  list: [
    {
      id: "slime", name: "Slime", hp: 60, atk: 7, attackInterval: 1.2, speed: 30, cityDamage: 1,
      radius: 12, color: "#6fcf5a", accent: "#caffb0", shape: "blob",
      element: "Nature", weakElement: "Fire", resistElement: "Nature",
      splitInto: "slimelet", splitCount: 2,
    },
    {
      id: "goblin", name: "Goblin", hp: 85, atk: 11, attackInterval: 1.0, speed: 48, cityDamage: 1,
      radius: 11, color: "#7fae4b", accent: "#d8ff9a", shape: "biped",
      element: "Neutral", weakElement: "Fire",
    },
    {
      id: "wolf", name: "Dire Wolf", hp: 80, atk: 11, attackInterval: 0.9, speed: 76, cityDamage: 1,
      radius: 12, color: "#8c8c96", accent: "#d8d8e0", shape: "beast",
      element: "Neutral", weakElement: "Ice", berserker: { hpBelow: 0.5, atkMult: 1.6, speedMult: 1.5 },
    },
    {
      id: "orc", name: "Orc", hp: 230, atk: 22, attackInterval: 1.1, speed: 33, cityDamage: 2,
      radius: 15, color: "#5f8f5a", accent: "#b6e0a0", shape: "biped",
      element: "Nature", physResist: 0.12, weakElement: "Fire",
    },
    {
      id: "necromancer", name: "Necromancer", hp: 160, atk: 16, attackInterval: 1.4, speed: 34, cityDamage: 2,
      radius: 13, color: "#7a5fae", accent: "#d8c2ff", shape: "robed",
      element: "Nature", physResist: 0.3, weakElement: "Fire", weakType: "magic",
      healer: { radius: 120, heal: 0.04, interval: 1.4, reviveChance: 0.25 },
    },
    {
      id: "harpy", name: "Harpy", hp: 70, atk: 13, attackInterval: 1.0, speed: 84, cityDamage: 1,
      radius: 12, color: "#c98fb0", accent: "#ffd8ec", shape: "beast",
      element: "Storm", weakElement: "Ice", flying: true,
    },
    {
      id: "knight", name: "Frost Knight", hp: 190, atk: 21, attackInterval: 1.1, speed: 30, cityDamage: 2,
      radius: 14, color: "#7f93b0", accent: "#dbe7f5", shape: "biped",
      element: "Ice", armored: true, physResist: 0.62, weakType: "magic", statusImmune: ["frozen"],
    },
    {
      id: "shieldbearer", name: "Shieldbearer", hp: 140, atk: 16, attackInterval: 1.1, speed: 29, cityDamage: 2,
      radius: 14, color: "#9c7b4a", accent: "#e6cfa0", shape: "biped",
      element: "Neutral", shieldHP: 140, weakType: "magic",
    },
    {
      id: "mole", name: "Tunneler", hp: 120, atk: 14, attackInterval: 1.0, speed: 42, cityDamage: 2,
      radius: 12, color: "#9a7a5a", accent: "#d8b88a", shape: "blob",
      element: "Nature", weakElement: "Fire", burrower: true,
    },
    {
      id: "warboss", name: "Warboss", hp: 280, atk: 24, attackInterval: 1.2, speed: 30, cityDamage: 3,
      radius: 16, color: "#6f5a3a", accent: "#e0b070", shape: "biped", spriteId: "orc",
      element: "Nature", physResist: 0.18, weakElement: "Fire",
      bannerman: { radius: 130, atkMult: 1.3, speedMult: 1.2 },
    },
    {
      id: "ogre", name: "Ogre Siege Beast", hp: 1600, atk: 58, attackInterval: 1.5, speed: 22, cityDamage: 5,
      radius: 24, color: "#a05a4a", accent: "#ffcaa0", shape: "boss", isBoss: true,
      element: "Neutral", physResist: 0.25, weakType: "magic",
      berserker: { hpBelow: 0.4, atkMult: 1.5, speedMult: 1.4 },
    },
    {
      id: "slimelet", name: "Slimelet", hp: 24, atk: 4, attackInterval: 1.2, speed: 44, cityDamage: 1,
      radius: 8, color: "#8fdf6a", accent: "#d8ffb8", shape: "blob", spriteId: "slime",
      element: "Nature", weakElement: "Fire", resistElement: "Nature",
    },
  ],

  byId(id) {
    return this.list.find((e) => e.id === id) || null;
  },
};
