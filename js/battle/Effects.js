/* =========================================================================
 * Last Wall — Effects.js
 * Lightweight transient VFX: floating combat text, hit sparks, splash rings
 * and muzzle flashes. BattleManager keeps an array and ticks/draws them.
 * ========================================================================= */
window.LW = window.LW || {};

LW.Effect = class Effect {
  constructor(kind, opts) {
    this.kind = kind;
    Object.assign(this, opts);
    this.t = 0;
    this.life = opts.life || 0.5;
    this.dead = false;
  }

  update(dt) {
    this.t += dt;
    if (this.kind === "text") {
      this.y += (this.vy || -26) * dt;
    } else if (this.kind === "spark") {
      // particles expand outward
    }
    if (this.t >= this.life) this.dead = true;
  }

  render(ctx) {
    const k = this.kind;
    const p = Math.min(1, this.t / this.life);
    if (k === "text") {
      ctx.save();
      ctx.globalAlpha = 1 - p * p;
      ctx.font = (this.bold ? "bold " : "") + (this.size || 13) + "px 'Trebuchet MS', sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.strokeText(this.text, this.x, this.y);
      ctx.fillStyle = this.color || "#fff";
      ctx.fillText(this.text, this.x, this.y);
      ctx.restore();
    } else if (k === "spark") {
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = this.color || "#ffd766";
      const n = this.count || 6;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (this.seed || 0);
        const rad = p * (this.spread || 14);
        const r = (this.size || 2.4) * (1 - p);
        ctx.beginPath();
        ctx.arc(this.x + Math.cos(a) * rad, this.y + Math.sin(a) * rad, Math.max(0.5, r), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (k === "ring") {
      ctx.save();
      ctx.globalAlpha = (1 - p) * 0.8;
      ctx.strokeStyle = this.color || "#fff";
      ctx.lineWidth = (this.width || 3) * (1 - p) + 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y, (this.radius || 30) * p, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (k === "flash") {
      ctx.save();
      ctx.globalAlpha = (1 - p) * 0.9;
      ctx.fillStyle = this.color || "#fff2c0";
      ctx.beginPath();
      ctx.arc(this.x, this.y, (this.radius || 6) * (1 - p * 0.4), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
};
