/* =========================================================================
 * Last Wall — config.js
 * Central balance constants, layout anchors and tuning values.
 * One place to tweak the whole game (per the build file's "data tables" goal).
 * ========================================================================= */
window.LW = window.LW || {};

LW.Config = {
  /* Logical render resolution (portrait / iPhone 9:16). The canvas is scaled
   * to fit the device while keeping these coordinates stable. */
  WORLD_W: 540,
  WORLD_H: 960,

  SAVE_KEY: "lastwall.save.v1",

  /* ---- Campaign ------------------------------------------------------- */
  CITIES: 10,
  WAVES_PER_CITY: 10,

  /* ---- Rarity --------------------------------------------------------- */
  RARITY: {
    Rare: { name: "Rare", mult: 1.0, color: "#5aa9e6", glow: "#7fc2ff" },
    Epic: { name: "Epic", mult: 1.35, color: "#b06be0", glow: "#d39bff" },
    Legendary: { name: "Legendary", mult: 1.8, color: "#f0a000", glow: "#ffd766" },
  },

  /* ---- Hero classes (base level-1 stats before rarity multiplier) ----- */
  CLASS: {
    Fighter: {
      name: "Fighter",
      baseHP: 320,
      baseATK: 22,
      attackInterval: 1.0,
      range: 78,
      color: "#e0594b",
      accent: "#ffcaa0",
      blocks: true,
      allowedPosition: "Bridge",
      desc: "Tanky melee blocker. Holds the bridge choke point.",
    },
    Archer: {
      name: "Archer",
      baseHP: 130,
      baseATK: 30,
      attackInterval: 0.8,
      range: 380,
      color: "#3fb878",
      accent: "#caffe0",
      blocks: false,
      allowedPosition: "Bastion",
      desc: "Longest range single-target DPS from a bastion.",
    },
    Mage: {
      name: "Mage",
      baseHP: 150,
      baseATK: 26,
      attackInterval: 1.3,
      range: 300,
      splash: 64,
      color: "#5b8def",
      accent: "#bcd6ff",
      blocks: false,
      allowedPosition: "Bastion",
      desc: "Splash magic from a bastion. Strong vs clustered enemies.",
    },
  },

  /* Per-level stat growth: stat = base * (1 + GROWTH * (level - 1)). */
  HERO_GROWTH: 0.12,
  HERO_MAX_LEVEL: 10,

  /* Gold cost to reach the given level (index by target level). */
  LEVEL_COST: { 2: 50, 3: 75, 4: 100, 5: 150, 6: 200, 7: 275, 8: 350, 9: 450, 10: 600 },

  /* Support units derive from the parent hero. */
  SUPPORT_HP_PCT: 0.4,
  SUPPORT_ATK_PCT: 0.35,
  SUPPORT_PER_HERO: 2,

  /* ---- Turret --------------------------------------------------------- */
  TURRET: {
    baseDamage: 18,
    baseInterval: 1.0,
    range: 430,
    projectiles: 1,
    splash: 0,
  },

  /* ---- City / Wall ---------------------------------------------------- */
  CITY_BASE_HP: 20,

  /* ---- In-battle (per-run) upgrade panel ------------------------------ */
  UPGRADE: {
    hero: { baseCost: 60, costStep: 35, atkPct: 0.1, hpPct: 0.1 },
    wall: { baseCost: 70, costStep: 40, cityHP: 3, bastionBonus: 0.06 },
    turret: { baseCost: 65, costStep: 35, dmgPct: 0.15, cdReduce: 0.08, splashAt: 3, projAt: 5 },
  },

  /* ---- Rewards -------------------------------------------------------- */
  reward: {
    waveGold: (city, wave) => 35 + 8 * wave + 12 * city,
    levelGold: (city) => 200 + 60 * city,
    waveCrystals: 1, // Regular Summon Crystal per wave
    levelEpicCrystals: 1, // Epic Summon Crystal per level
    dupeGold: { Rare: 60, Epic: 180, Legendary: 500 },
  },

  /* ---- Gacha ---------------------------------------------------------- */
  gacha: {
    regular: {
      cost: 1, // regular crystals
      table: [
        { key: "Rare", weight: 85 },
        { key: "Epic", weight: 15 },
        { key: "Legendary", weight: 0 },
      ],
    },
    epic: {
      cost: 1, // epic crystals
      table: [
        { key: "Epic", weight: 75 },
        { key: "Legendary", weight: 25 },
      ],
      pity: 5, // guaranteed Legendary after this many non-Legendary epic pulls
    },
  },

  /* ---- Battle pacing --------------------------------------------------- */
  spawnInterval: 0.85, // seconds between enemies inside a wave (scaled down later)
  speedOptions: [1, 2],

  /* ---- Layout anchors (logical coordinates) ---------------------------
   * Fitted to the painted battlefield (assets/battlefield.jpg). Mirrors the
   * "Spawn Anchors" section of the build file. Ranged heroes stand ON TOP of
   * the two bastions; the Fighter group holds the apron in front of the gate. */
  anchors: {
    Anchor_Bastion_Left_Hero: { x: 110, y: 598 },
    Anchor_Bastion_Left_Unit_1: { x: 80, y: 612 },
    Anchor_Bastion_Left_Unit_2: { x: 140, y: 612 },
    Anchor_Bastion_Right_Hero: { x: 432, y: 596 },
    Anchor_Bastion_Right_Unit_1: { x: 402, y: 610 },
    Anchor_Bastion_Right_Unit_2: { x: 462, y: 610 },
    Anchor_Bridge_Hero: { x: 270, y: 588 },
    Anchor_Bridge_Unit_1: { x: 234, y: 602 },
    Anchor_Bridge_Unit_2: { x: 306, y: 602 },
    Anchor_EnemySpawn_Top: { x: 256, y: 58 },
    Anchor_EnemySpawn_LeftTop: { x: 210, y: 72 },
    Anchor_EnemySpawn_RightTop: { x: 300, y: 72 },
    Anchor_CityDamagePoint: { x: 270, y: 946 },
    Anchor_Turret_Main: { x: 270, y: 624 },
    Anchor_CameraFocus: { x: 270, y: 470 },
  },

  /* Main enemy path control points, traced along the painted dirt path
   * (top forest clearing -> winding field -> gate apron -> through gate ->
   * bridge -> city). The Fighter group blocks at the gate apron. */
  splinePoints: [
    { x: 256, y: 48 },
    { x: 232, y: 138 },
    { x: 198, y: 232 },
    { x: 232, y: 318 },
    { x: 298, y: 372 },
    { x: 300, y: 452 },
    { x: 276, y: 528 },
    { x: 270, y: 600 },
    { x: 270, y: 662 }, // gate apron (fighter choke)
    { x: 270, y: 744 }, // through the gate
    { x: 270, y: 852 }, // bridge
    { x: 270, y: 946 }, // city point
  ],
};
