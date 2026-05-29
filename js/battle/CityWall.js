/* =========================================================================
 * Last Wall — CityWall.js   (mirrors BP_CityWall)
 * Tracks the wall upgrade track: City HP bonus, bastion defensive bonus and
 * a visual tier that the battle map renders (thicker stone, banners, etc.).
 * ========================================================================= */
window.LW = window.LW || {};

LW.CityWall = class CityWall {
  constructor() {
    this.level = 1;
    this.cityHPBonus = 0;
    this.bastionBonus = 0; // fractional HP bonus to bastion heroes
    this.visualTier = 0; // 0..3, drives renderer
  }

  // Returns the amount of extra City HP this upgrade grants.
  upgrade() {
    const U = LW.Config.UPGRADE.wall;
    this.level += 1;
    this.cityHPBonus += U.cityHP;
    this.bastionBonus += U.bastionBonus;
    this.visualTier = Math.min(3, Math.floor((this.level - 1) / 2));
    return U.cityHP;
  }
};
