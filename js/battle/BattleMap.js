/* =========================================================================
 * Last Wall — BattleMap.js   (mirrors BP_BattleMapController + the scene)
 * Owns the layout anchors and paints the world. The battlefield itself is a
 * single hand-painted illustration (assets/battlefield.jpg) — forest/mountain
 * spawn zone, the winding field path, the stone wall with two round bastions
 * and central gate, and the bridge descending to the city. Units, projectiles
 * and VFX are drawn on top.
 * ========================================================================= */
window.LW = window.LW || {};

LW.BattleMap = class BattleMap {
  constructor(battle) {
    this.battle = battle;
    this.W = LW.Config.WORLD_W;
    this.H = LW.Config.WORLD_H;
    this.anchors = LW.Config.anchors;
    this.t = 0;
  }

  getAnchor(name) {
    return this.anchors[name];
  }

  // Faux-perspective: things lower on screen are nearer, so a touch larger.
  depthScale(y) {
    const t = LW.util.clamp((y - 40) / (this.H - 40), 0, 1);
    return LW.util.lerp(0.9, 1.2, t);
  }

  update(dt) {
    this.t += dt;
  }

  _bgImage() {
    return LW.assets && LW.assets.battlefield;
  }

  renderBackground(ctx) {
    const img = this._bgImage();
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, 0, 0, this.W, this.H);
    } else {
      // Fallback gradient until the painting loads (forest -> field -> city).
      const g = ctx.createLinearGradient(0, 0, 0, this.H);
      g.addColorStop(0, "#3a4a6b");
      g.addColorStop(0.45, "#5f8c46");
      g.addColorStop(1, "#33303f");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.W, this.H);
    }
  }

  // Subtle atmospheric overlay drawn above the actors to focus the action.
  renderForeground(ctx) {
    const vg = ctx.createRadialGradient(this.W / 2, this.H * 0.5, this.H * 0.34, this.W / 2, this.H * 0.54, this.H * 0.8);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.24)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.W, this.H);
  }
};
