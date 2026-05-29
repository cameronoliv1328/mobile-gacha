/* =========================================================================
 * Last Wall — heroes.js
 * The launch roster: 4 Fighters, 4 Archers, 4 Mages (12 total).
 * Each hero defines theme colours used both for the hero sprite and its
 * 2 matching support units. Stats come from class base * rarity multiplier.
 * ========================================================================= */
window.LW = window.LW || {};

LW.HeroData = {
  /* The 3 heroes the player owns from the start (one of each class). */
  starters: ["fighter_brick", "archer_robin", "mage_ember"],

  list: [
    /* ---- Fighters ---- */
    {
      id: "fighter_brick",
      name: "Brick",
      class: "Fighter",
      rarity: "Rare",
      theme: { primary: "#c0473a", secondary: "#8c2f25", trim: "#ffd9a0" },
      skillArchetype: "Bulwark",
      blurb: "A stubborn town guard who simply refuses to move.",
    },
    {
      id: "fighter_ironhide",
      name: "Ironhide",
      class: "Fighter",
      rarity: "Rare",
      theme: { primary: "#7a6f63", secondary: "#4f463d", trim: "#d8c9a8" },
      skillArchetype: "Bulwark",
      blurb: "Veteran shieldbearer wrapped in dented plate.",
    },
    {
      id: "fighter_warlord",
      name: "Warlord Gar",
      class: "Fighter",
      rarity: "Epic",
      theme: { primary: "#b03a52", secondary: "#6e2233", trim: "#ffce6b" },
      skillArchetype: "Cleave",
      blurb: "Hits hard enough to clear the whole choke point.",
    },
    {
      id: "fighter_titan",
      name: "Titan Vael",
      class: "Fighter",
      rarity: "Legendary",
      theme: { primary: "#caa23a", secondary: "#7a5f17", trim: "#fff0b0" },
      skillArchetype: "Unbreakable",
      blurb: "A living rampart said to have never fallen.",
    },

    /* ---- Archers ---- */
    {
      id: "archer_robin",
      name: "Robin",
      class: "Archer",
      rarity: "Rare",
      theme: { primary: "#3f9e63", secondary: "#27613d", trim: "#e6ffcf" },
      skillArchetype: "PiercingShot",
      blurb: "Quick hands, quicker quiver. Never misses the field.",
    },
    {
      id: "archer_fletcher",
      name: "Fletcher",
      class: "Archer",
      rarity: "Rare",
      theme: { primary: "#5a8f4a", secondary: "#37582d", trim: "#f0ffd0" },
      skillArchetype: "PiercingShot",
      blurb: "Fletches her own arrows between every wave.",
    },
    {
      id: "archer_hawkeye",
      name: "Hawkeye",
      class: "Archer",
      rarity: "Epic",
      theme: { primary: "#2f9c8b", secondary: "#1c5d54", trim: "#d6fff4" },
      skillArchetype: "Volley",
      blurb: "Picks off the deadliest target the instant it appears.",
    },
    {
      id: "archer_sylvan",
      name: "Sylvan Queen",
      class: "Archer",
      rarity: "Legendary",
      theme: { primary: "#46c07a", secondary: "#1f7a48", trim: "#eaffce" },
      skillArchetype: "RainOfArrows",
      blurb: "The forest itself answers her draw.",
    },

    /* ---- Mages ---- */
    {
      id: "mage_ember",
      name: "Ember",
      class: "Mage",
      rarity: "Rare",
      theme: { primary: "#e0703a", secondary: "#9c4218", trim: "#ffd98a" },
      skillArchetype: "Firebolt",
      blurb: "Tosses fireballs that scatter the goblin lines.",
    },
    {
      id: "mage_frost",
      name: "Frost",
      class: "Mage",
      rarity: "Rare",
      theme: { primary: "#4aa6d6", secondary: "#2a6a96", trim: "#d6f4ff" },
      skillArchetype: "Frostbolt",
      blurb: "Chills the field and the enemy's nerve.",
    },
    {
      id: "mage_storm",
      name: "Storm",
      class: "Mage",
      rarity: "Epic",
      theme: { primary: "#6f7ce0", secondary: "#3b4499", trim: "#dfe4ff" },
      skillArchetype: "ChainLightning",
      blurb: "Calls lightning down on the densest crowd.",
    },
    {
      id: "mage_arcane",
      name: "Arcanist Lyra",
      class: "Mage",
      rarity: "Legendary",
      theme: { primary: "#a96be0", secondary: "#5e2f99", trim: "#f0dcff" },
      skillArchetype: "Meteor",
      blurb: "Bends raw arcana into a falling star.",
    },
  ],

  byId(id) {
    return this.list.find((h) => h.id === id) || null;
  },

  byClass(cls) {
    return this.list.filter((h) => h.class === cls);
  },
};
