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

  /* Battle camera: the view is zoomed in and the player can pan/zoom around
   * the map. zoom is a multiple of the fit-to-screen scale. */
  CAM_DEFAULT_ZOOM: 1.75,
  CAM_MIN_ZOOM: 1.0,
  CAM_MAX_ZOOM: 2.8,

  SAVE_KEY: "lastwall.save.v1",

  /* Optional painted battle map. If this image is present it's drawn as the
   * battlefield background; otherwise BattleMap paints the scene procedurally.
   * The art must match the road traced by `lanes` below (16:9 landscape). */
  MAP_IMAGE: "assets/map_ironcove.png",

  /* ---- Buildable towers (Kingdom-Rush style) --------------------------
   * Towers are built on the dirt-circle plots (PLOTS) during battle for gold.
   *   Archer : fast single-target physical arrows (long range).
   *   Mage   : slower splash magic (shorter range, hits clusters).
   *   Guard  : no ranged attack — periodically spawns blocking infantry that
   *            march to the path and body-block monsters (respawn when killed).
   * Art: painted frames extracted from the asset sheets. `h` = logical draw
   * height; `dy` nudges the tower foot relative to the plot centre; fireSeq /
   * fireTime drive the firing animation; `glow` is an optional procedural
   * charge glow (the mage's crystals). */
  TOWER_TYPES: {
    archer: {
      name: "Archer Tower", cls: "Archer", cost: 70, icon: "🏹",
      damage: 26, attackInterval: 0.75, range: 196, splash: 0,
      projSpeed: 470, projStyle: "arrow", damageType: "physical", element: "Neutral",
      color: "#caa15a",
      h: 62, dy: 3, fireTime: 0.34, fireSeq: [1, 2, 3, 0],
      frames: ["assets/towers/tower_archer_0.png", "assets/towers/tower_archer_1.png", "assets/towers/tower_archer_2.png", "assets/towers/tower_archer_3.png"],
    },
    mage: {
      name: "Mage Tower", cls: "Mage", cost: 90, icon: "✨",
      damage: 34, attackInterval: 1.25, range: 168, splash: 58,
      projSpeed: 360, projStyle: "magic", damageType: "magic", element: "Neutral",
      color: "#6fd3ff",
      h: 66, dy: 3, fireTime: 0.5, fireSeq: [0],
      frames: ["assets/towers/tower_mage_0.png"],
      glow: { color: "#6fd3ff", x: 0.5, y: 0.86, r: 0.42 },
    },
    guard: {
      name: "Guard Post", cls: "Fighter", cost: 80, icon: "🛡",
      range: 150, // leash: how far infantry roam to reach the path
      spawnCount: 2, spawnInterval: 9, // infantry maintained + respawn cadence
      infantryHP: 150, infantryATK: 16, infantryInterval: 1.0,
      color: "#9fb0c4",
      h: 60, dy: 3, fireTime: 0.3, fireSeq: [1, 0],
      frames: ["assets/towers/tower_guard_0.png", "assets/towers/tower_guard_1.png"],
    },
  },

  /* Build/economy. Towers can be sold back for a fraction of spend. */
  TOWER_SELL_FRACTION: 0.6,
  PLOT_RADIUS: 18, // tap radius / drawn ring size for an empty plot

  /* Dirt-circle build plots on the painted map (world coords). Towers may be
   * built only here. Traced onto assets/map_ironcove.png. */
  PLOTS: [
    { x: 214, y: 150 },
    { x: 306, y: 122 },
    { x: 438, y: 120 },
    { x: 360, y: 182 },
    { x: 286, y: 208 },
    { x: 480, y: 202 },
    { x: 360, y: 250 },
    { x: 292, y: 270 },
    { x: 500, y: 300 },
    { x: 622, y: 250 },
  ],

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
  // Global enemy march-speed multiplier — tuned against the difficulty band so
  // the road's time-to-reach / time-in-range keeps the campaign curve intact.
  ENEMY_SPEED_MULT: 1.0,

  /* ---- Layout anchors (logical coordinates, 960x540 landscape) ---------
   * Traced onto the painted Ironcove Pass map (assets/map_ironcove.png):
   * enemies march from the Demonic Gate (top-left) along the road to the
   * player's castle (bottom-right). The two ranged HEROES stand ALONE on the
   * rune bastions flanking the road; the Fighter hero stands on the road just
   * before the castle and blocks it. (Towers are built separately on PLOTS;
   * heroes no longer have support units.) */
  anchors: {
    Anchor_Bastion_Left_Hero: { x: 213, y: 340 },      // Hero centred on Bastion 1 (lower-left platform)
    Anchor_Bastion_Right_Hero: { x: 545, y: 134 },     // Hero centred on Bastion 2 (upper-centre platform)
    Anchor_Bridge_Hero: { x: 780, y: 332 },            // Fighter hero, centred on the road before the castle
    Anchor_EnemySpawn_Top: { x: 58, y: 132 },          // Demonic Gate (path start)
    Anchor_CityDamagePoint: { x: 856, y: 400 },        // Castle gate (path end)
    Anchor_Turret_Main: { x: 888, y: 372 },            // Castle cannon
    Anchor_CameraFocus: { x: 470, y: 250 },
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
    { points: [{ x: 61, y: 118 }, { x: 144, y: 137 }, { x: 206, y: 160 }, { x: 247, y: 204 }, { x: 256, y: 233 }, { x: 289, y: 238 }, { x: 322, y: 214 }, { x: 378, y: 179 }, { x: 449, y: 152 }, { x: 527, y: 142 }, { x: 602, y: 144 }, { x: 654, y: 164 }, { x: 695, y: 205 }, { x: 725, y: 256 }, { x: 770, y: 304 }, { x: 821, y: 352 }, { x: 865, y: 389 }] },
    { points: [{ x: 58, y: 132 }, { x: 140, y: 150 }, { x: 198, y: 172 }, { x: 236, y: 212 }, { x: 248, y: 244 }, { x: 292, y: 252 }, { x: 330, y: 226 }, { x: 384, y: 192 }, { x: 452, y: 166 }, { x: 528, y: 156 }, { x: 600, y: 158 }, { x: 646, y: 176 }, { x: 684, y: 214 }, { x: 714, y: 264 }, { x: 760, y: 314 }, { x: 812, y: 362 }, { x: 856, y: 400 }] },
    { points: [{ x: 55, y: 146 }, { x: 136, y: 163 }, { x: 190, y: 184 }, { x: 225, y: 220 }, { x: 240, y: 255 }, { x: 295, y: 266 }, { x: 338, y: 238 }, { x: 390, y: 205 }, { x: 455, y: 180 }, { x: 529, y: 170 }, { x: 598, y: 172 }, { x: 638, y: 188 }, { x: 673, y: 223 }, { x: 703, y: 272 }, { x: 750, y: 324 }, { x: 803, y: 372 }, { x: 847, y: 411 }] },
  ],
};
