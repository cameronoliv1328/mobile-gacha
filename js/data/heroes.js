/* =========================================================================
 * Last Wall — heroes.js
 * The launch roster: 4 Fighters, 4 Archers, 4 Mages (12 total).
 * Each hero has an ELEMENT (Ice / Fire / Nature / Storm) used by the team
 * synergy system — every element has exactly one Fighter, Archer and Mage so
 * a full mono-element team is always buildable. Theme colours drive both the
 * hero sprite and its 2 matching support units.
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
      element: "Nature",
      theme: { primary: "#c0473a", secondary: "#8c2f25", trim: "#ffd9a0" },
      skillArchetype: "Bulwark",
      blurb: "A stubborn town guard who simply refuses to move.",
    },
    {
      id: "fighter_ironhide",
      name: "Ironhide",
      class: "Fighter",
      rarity: "Rare",
      element: "Ice",
      theme: { primary: "#6f8190", secondary: "#46535f", trim: "#d8ecf5" },
      skillArchetype: "Bulwark",
      blurb: "Veteran shieldbearer wrapped in frost-rimed plate.",
    },
    {
      id: "fighter_warlord",
      name: "Warlord Gar",
      class: "Fighter",
      rarity: "Epic",
      element: "Fire",
      theme: { primary: "#b03a2e", secondary: "#6e2114", trim: "#ffce6b" },
      skillArchetype: "Cleave",
      blurb: "Hits hard enough to clear the whole choke point.",
    },
    {
      id: "fighter_titan",
      name: "Titan Vael",
      class: "Fighter",
      rarity: "Legendary",
      element: "Storm",
      theme: { primary: "#8a7fd0", secondary: "#4a3f86", trim: "#fff0b0" },
      skillArchetype: "Unbreakable",
      blurb: "A living rampart wreathed in distant thunder.",
    },

    /* ---- Archers ---- */
    {
      id: "archer_robin",
      name: "Robin",
      class: "Archer",
      rarity: "Rare",
      element: "Nature",
      theme: { primary: "#3f9e63", secondary: "#27613d", trim: "#e6ffcf" },
      skillArchetype: "PiercingShot",
      blurb: "Quick hands, quicker quiver. Never misses the field.",
    },
    {
      id: "archer_fletcher",
      name: "Fletcher",
      class: "Archer",
      rarity: "Rare",
      element: "Ice",
      theme: { primary: "#4aa6c8", secondary: "#2a6a86", trim: "#d6f4ff" },
      skillArchetype: "PiercingShot",
      blurb: "Fletches frost-tipped arrows between every wave.",
    },
    {
      id: "archer_hawkeye",
      name: "Hawkeye",
      class: "Archer",
      rarity: "Epic",
      element: "Fire",
      theme: { primary: "#cc6a3a", secondary: "#7d3a1c", trim: "#ffe0b0" },
      skillArchetype: "Volley",
      blurb: "Picks off the deadliest target the instant it appears.",
    },
    {
      id: "archer_sylvan",
      name: "Sylvan Queen",
      class: "Archer",
      rarity: "Legendary",
      element: "Storm",
      theme: { primary: "#6fb0c0", secondary: "#2f7a8a", trim: "#eaffff" },
      skillArchetype: "RainOfArrows",
      blurb: "The storm itself answers her draw.",
    },

    /* ---- Mages ---- */
    {
      id: "mage_ember",
      name: "Ember",
      class: "Mage",
      rarity: "Rare",
      element: "Fire",
      theme: { primary: "#e0703a", secondary: "#9c4218", trim: "#ffd98a" },
      skillArchetype: "Firebolt",
      blurb: "Tosses fireballs that scatter the goblin lines.",
    },
    {
      id: "mage_frost",
      name: "Frost",
      class: "Mage",
      rarity: "Rare",
      element: "Ice",
      theme: { primary: "#4aa6d6", secondary: "#2a6a96", trim: "#d6f4ff" },
      skillArchetype: "Frostbolt",
      blurb: "Chills the field and the enemy's nerve.",
    },
    {
      id: "mage_storm",
      name: "Storm",
      class: "Mage",
      rarity: "Epic",
      element: "Storm",
      theme: { primary: "#6f7ce0", secondary: "#3b4499", trim: "#dfe4ff" },
      skillArchetype: "ChainLightning",
      blurb: "Calls lightning down on the densest crowd.",
    },
    {
      id: "mage_arcane",
      name: "Arcanist Lyra",
      class: "Mage",
      rarity: "Legendary",
      element: "Nature",
      theme: { primary: "#6fc08a", secondary: "#2f8a54", trim: "#e6ffd8" },
      skillArchetype: "Meteor",
      blurb: "Bends living arcana into a blooming cataclysm.",
    },
  ],

  byId(id) {
    return this.list.find((h) => h.id === id) || null;
  },

  byClass(cls) {
    return this.list.filter((h) => h.class === cls);
  },

  byElement(el) {
    return this.list.filter((h) => h.element === el);
  },
};
