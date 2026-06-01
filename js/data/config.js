/* =========================================================================
 * Last Wall — config.js
 * Central balance constants, layout anchors and tuning values.
 * One place to tweak the whole game (per the build file's "data tables" goal).
 * ========================================================================= */
window.LW = window.LW || {};

LW.Config = {
  /* Logical render resolution (landscape / iPhone 16:9). The canvas is scaled
   * to fit the device while keeping these coordinates stable. */
  WORLD_W: 960,
  WORLD_H: 540,

  SAVE_KEY: "lastwall.save.v1",

  /* Optional painted battle map. If this image is present it's drawn as the
   * battlefield background; otherwise BattleMap paints the scene procedurally.
   * The art must match the road traced by `lanes` below (16:9 landscape). */
  MAP_IMAGE: "assets/map_ironcove.png",

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

  /* ---- Elements (drive team synergy) ---------------------------------- */
  ELEMENTS: {
    Ice: { name: "Ice", color: "#7fd0ff", icon: "❄" },
    Fire: { name: "Fire", color: "#ff8a3a", icon: "🔥" },
    Nature: { name: "Nature", color: "#7ad06a", icon: "🌿" },
    Storm: { name: "Storm", color: "#b08bff", icon: "⚡" },
  },

  /* ---- Duplicate special abilities ------------------------------------
   * Pulling a hero you already own grants a "copy". Copies unlock 3 ability
   * tiers; the third is the most powerful (a signature ultimate). Tier I is
   * "Attunement", which empowers the hero's element synergy contribution. */
  ABILITY_UNLOCKS: [1, 2, 4], // copies required for tiers I, II, III

  /* A hero is "fully collected" once its copy count reaches the final
   * ABILITY_UNLOCKS threshold (every duplicate ability unlocked). Heroes of a
   * rarity listed here are then RETIRED from the summon pool, so no duplicate
   * of them can ever be pulled again. Legendaries are unique this way. */
  RETIRE_WHEN_MAXED: ["Legendary"],

  ABILITIES: {
    Fighter: [
      { name: "Attunement", desc: "+12% HP. Empowers element synergy.", mods: { hpMult: 1.12, attune: true } },
      { name: "Riposte", desc: "Reflect 25% of melee damage taken; +25% cleave radius.", mods: { reflect: 0.25, splashMult: 1.25 } },
      { name: "Unbreakable", desc: "Survive one lethal hit each wave, then +40% ATK (6s); +20% HP & ATK.", mods: { hpMult: 1.2, atkMult: 1.2, surviveOnce: true } },
    ],
    Archer: [
      { name: "Attunement", desc: "+12% attack speed, +10% range. Empowers element synergy.", mods: { asMult: 1.12, rangeMult: 1.1, attune: true } },
      { name: "Double Nock", desc: "Fire an extra arrow at a 2nd target; +10% ATK.", mods: { extraProjectiles: 1, atkMult: 1.1 } },
      { name: "Rain of Arrows", desc: "Every 6s an arrow volley storms the densest cluster; +20% ATK.", mods: { atkMult: 1.2, ult: { type: "volley", interval: 6, radius: 76, mult: 2.2 } } },
    ],
    Mage: [
      { name: "Attunement", desc: "+15% splash, +8% ATK. Empowers element synergy.", mods: { splashMult: 1.15, atkMult: 1.08, attune: true } },
      { name: "Hex", desc: "Spells slow enemies 30% for 2s; +12% ATK.", mods: { slowOnHit: { factor: 0.7, dur: 2.0 }, atkMult: 1.12 } },
      { name: "Cataclysm", desc: "Every 7s a meteor erupts on the densest cluster; +20% ATK.", mods: { atkMult: 1.2, ult: { type: "meteor", interval: 7, radius: 98, mult: 3.0 } } },
    ],
  },

  /* ---- Team synergy ---------------------------------------------------
   * Based on the elements of the 3 deployed heroes. Two sharing = minor;
   * all three sharing = major (team buff + an element effect). Potency scales
   * with how many of the matching heroes are Attuned (Tier I ability). */
  SYNERGY: {
    minorCount: 2,
    majorCount: 3,
    attunePotencyPerHero: 0.12,
    minor: { atkMult: 1.1 },
    majorBase: { atkMult: 1.18, hpMult: 1.12 },
    majorByElement: {
      Ice: { slowOnHit: { factor: 0.7, dur: 1.5 }, label: "Frostbite — attacks slow enemies" },
      Fire: { burnOnHit: { fraction: 0.25, dur: 3 }, label: "Wildfire — attacks ignite enemies" },
      Nature: { regen: 0.02, hpMult: 1.06, label: "Verdant — defenders regenerate HP" },
      Storm: { asMult: 1.18, label: "Tempest — defenders attack faster" },
    },
  },

  /* ---- Roguelite wave affixes (push-your-luck) ------------------------
   * Between waves the player picks the next wave from a few options. Tougher
   * affixes pay out more gold + crystals (reward = multiplier). */
  AFFIXES: [
    { id: "none", name: "Standard", icon: "•", desc: "No modifier.", reward: 1.0 },
    { id: "frenzied", name: "Frenzied", icon: "»", desc: "Enemies move 30% faster.", enemy: { speedMult: 1.3 }, reward: 1.3 },
    { id: "armored", name: "Armored", icon: "🛡", desc: "Enemies take 25% less physical damage.", enemy: { physResist: 0.25 }, reward: 1.35 },
    { id: "swarm", name: "Swarm", icon: "🐾", desc: "50% more enemies, each a bit weaker.", count: 1.5, enemy: { hpMult: 0.72 }, reward: 1.35 },
    { id: "misty", name: "Misty", icon: "🌫", desc: "Your heroes' range is cut 25%.", hero: { rangeMult: 0.75 }, reward: 1.4 },
    { id: "regen", name: "Regenerating", icon: "♺", desc: "Enemies slowly regenerate health.", enemy: { regen: 0.03 }, reward: 1.4 },
    { id: "bloodmoon", name: "Blood Moon", icon: "☾", desc: "Enemies hit 30% harder — but drop far more gold.", enemy: { atkMult: 1.3 }, reward: 1.7 },
  ],

  /* ---- Per-hero active skills (manually triggered, tap-aimed) ----------
   * Every deployed hero has one class skill on a cooldown. The tier-3
   * duplicate ability upgrades it (tier3 overrides). Fighter self-casts;
   * Archer/Mage are aimed at a point within `range`. */
  ACTIVE_SKILLS: {
    Fighter: {
      name: "Whirlwind", aim: "self", cooldown: 12, radius: 92, dmgMult: 2.4,
      knockback: 60, slow: { factor: 0.6, dur: 2 }, color: "#ffcaa0",
      tier3: { dmgMult: 3.3, radius: 114, knockback: 84, cooldown: 10 },
    },
    Archer: {
      name: "Arrow Storm", aim: "target", cooldown: 11, range: 380, radius: 82, dmgMult: 2.2,
      color: "#eaffd0",
      tier3: { dmgMult: 3.0, radius: 106, cooldown: 9, volleys: 2 },
    },
    Mage: {
      name: "Cataclysm", aim: "target", cooldown: 13, range: 320, radius: 104, dmgMult: 3.0,
      color: "#ffd8a0",
      tier3: { dmgMult: 4.2, radius: 130, cooldown: 11 },
    },
  },

  /* ---- Combat 2.0: damage types, affinities, status combos ------------ */
  COMBAT: {
    // Class -> damage type. A hero's element comes from the hero data.
    classDamageType: { Fighter: "physical", Archer: "physical", Mage: "magic" },
    weakMult: 1.5, // element weakness
    resistMult: 0.6, // element resistance
    weakTypeMult: 1.5, // physical/magic weakness
    // Element -> status applied on hit (drives the combo system).
    elementStatus: { Ice: "chill", Fire: "burn", Nature: "wet", Storm: "shock", Neutral: null },
    status: {
      burn: { dur: 3.0, dps: 0.2 }, // dps = fraction of the hit's damage per second
      chill: { dur: 2.0, slow: 0.68, freezeStacks: 3 }, // 3 chills (or chill on wet) -> frozen
      frozen: { dur: 1.6, bonus: 1.25 }, // rooted; takes +25% damage
      wet: { dur: 4.0 },
      shock: { dur: 3.0, chainRadius: 72, chainMult: 0.5 },
      oil: { dur: 5.0 },
    },
    shatter: { mult: 1.7 }, // physical hit on a frozen enemy (consumes frozen)
    ignite: { mult: 1.3, radius: 72 }, // fire hit on an oiled enemy (AoE)
    conduct: { bonus: 1.4 }, // storm hit on a wet enemy (stronger + chains)
  },

  /* ---- Turret --------------------------------------------------------- */
  TURRET: {
    baseDamage: 18,
    baseInterval: 1.0,
    range: 430,
    projectiles: 1,
    splash: 0,
  },

  /* ---- City / Wall ---------------------------------------------------- */
  CITY_BASE_HP: 35,

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
  speedOptions: [1, 2, 4, 8],
  // Global enemy march-speed multiplier. The Ironcove Pass road is longer than
  // a straight lane, so enemies move a touch faster to keep the original pacing
  // (time-to-reach and time-in-range) and the tuned difficulty curve intact.
  ENEMY_SPEED_MULT: 1.2,

  /* ---- Layout anchors (logical coordinates, 960x540 landscape) ---------
   * Traced onto the painted Ironcove Pass map (assets/map_ironcove.png):
   * enemies march from the Demonic Gate (top-left) along the road to the
   * player's castle (bottom-right). The two ranged heroes hold the rune
   * bastions flanking the road; the Fighter stands in the vanguard on the road
   * just before the castle and blocks its centre. */
  anchors: {
    Anchor_Bastion_Left_Hero: { x: 198, y: 300 },     // Hero Bastion 1 (lower-left platform)
    Anchor_Bastion_Left_Unit_1: { x: 176, y: 312 },
    Anchor_Bastion_Left_Unit_2: { x: 220, y: 312 },
    Anchor_Bastion_Right_Hero: { x: 545, y: 86 },      // Hero Bastion 2 (upper-centre platform)
    Anchor_Bastion_Right_Unit_1: { x: 523, y: 98 },
    Anchor_Bastion_Right_Unit_2: { x: 567, y: 98 },
    Anchor_Bridge_Hero: { x: 820, y: 350 },            // Vanguard on the road before the castle
    Anchor_Bridge_Unit_1: { x: 800, y: 366 },
    Anchor_Bridge_Unit_2: { x: 842, y: 338 },
    Anchor_EnemySpawn_Top: { x: 120, y: 80 },          // Demonic Gate
    Anchor_CityDamagePoint: { x: 868, y: 408 },        // Castle gate
    Anchor_Turret_Main: { x: 880, y: 360 },            // Castle cannon
    Anchor_CameraFocus: { x: 480, y: 280 },
  },

  /* One winding road, modelled as three closely-spaced trails so a few enemies
   * slip along the edges. The trails are traced onto the painted map's road and
   * offset ±15px along the local normal. The Fighter blocks the CENTRE trail
   * (blockLane) at the vanguard; the flanking trails have no melee blocker and
   * must be cleared by the bastion heroes + castle cannon. The centre draws the
   * most enemies (and every boss). */
  blockLane: 1,
  laneWeights: [0.22, 0.56, 0.22],
  lanes: [
    { points: [{ x: 141, y: 80 }, { x: 215, y: 139 }, { x: 262, y: 200 }, { x: 262, y: 267 }, { x: 227, y: 297 }, { x: 262, y: 317 }, { x: 329, y: 290 }, { x: 372, y: 228 }, { x: 448, y: 210 }, { x: 516, y: 182 }, { x: 597, y: 163 }, { x: 674, y: 150 }, { x: 746, y: 185 }, { x: 779, y: 249 }, { x: 812, y: 304 }, { x: 848, y: 351 }, { x: 880, y: 400 }] },
    { points: [{ x: 132, y: 92 }, { x: 205, y: 150 }, { x: 248, y: 205 }, { x: 248, y: 262 }, { x: 212, y: 300 }, { x: 262, y: 332 }, { x: 338, y: 302 }, { x: 380, y: 240 }, { x: 452, y: 224 }, { x: 520, y: 196 }, { x: 600, y: 178 }, { x: 672, y: 165 }, { x: 736, y: 196 }, { x: 766, y: 256 }, { x: 800, y: 312 }, { x: 836, y: 360 }, { x: 868, y: 408 }] },
    { points: [{ x: 123, y: 104 }, { x: 195, y: 161 }, { x: 234, y: 210 }, { x: 234, y: 257 }, { x: 197, y: 303 }, { x: 262, y: 347 }, { x: 347, y: 314 }, { x: 388, y: 252 }, { x: 456, y: 238 }, { x: 524, y: 210 }, { x: 603, y: 193 }, { x: 670, y: 180 }, { x: 726, y: 207 }, { x: 753, y: 263 }, { x: 788, y: 320 }, { x: 824, y: 369 }, { x: 856, y: 416 }] },
  ],
};
