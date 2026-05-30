/* =========================================================================
 * Last Wall — Render.js  (LW.Sprites)
 * Stateless procedural sprite painters. Everything is drawn with canvas
 * primitives (no image assets required) in a chunky, readable, stylized
 * fantasy look. Entity render() methods call into these.
 * ========================================================================= */
window.LW = window.LW || {};

LW.Sprites = (function () {
  "use strict";
  const TAU = Math.PI * 2;

  function shadow(ctx, x, y, rx, ry) {
    ctx.save();
    // Soft, layered contact shadow so sprites sit on the painted ground.
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = "#0b0d12";
    ctx.beginPath();
    ctx.ellipse(x, y, rx * 1.05, ry * 1.05, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    ctx.ellipse(x, y, rx * 1.5, ry * 1.4, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function healthBar(ctx, x, y, w, ratio, fill) {
    ratio = Math.max(0, Math.min(1, ratio));
    const h = 4;
    ctx.save();
    ctx.fillStyle = "rgba(8,10,16,0.7)";
    ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = "#2a2f3a";
    ctx.fillRect(x - w / 2, y, w, h);
    ctx.fillStyle = fill || (ratio > 0.5 ? "#6fcf5a" : ratio > 0.25 ? "#e6c84a" : "#e0594b");
    ctx.fillRect(x - w / 2, y, w * ratio, h);
    ctx.restore();
  }

  /* ---- Heroes & support units (humanoids by class) -------------------- */

  function humanoid(ctx, o) {
    const s = o.scale || 1;
    const x = o.x;
    const y = o.y; // feet baseline
    const dir = o.facing >= 0 ? 1 : -1;
    const sway = o.attacking ? Math.sin(o.swing || 0) : 0;

    shadow(ctx, x, y, 13 * s, 5 * s);

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);

    const bob = o.isHero ? Math.sin((o.bob || 0)) * 0.6 : 0;
    ctx.translate(0, bob);

    // Legs
    ctx.fillStyle = o.secondary;
    ctx.fillRect(-5, -10, 4, 10);
    ctx.fillRect(1, -10, 4, 10);

    // Torso
    roundRect(ctx, -7, -26, 14, 18, 4);
    ctx.fillStyle = o.primary;
    ctx.fill();
    // Torso highlight
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    roundRect(ctx, -7, -26, 14, 7, 4);
    ctx.fill();

    // Trim belt
    ctx.fillStyle = o.trim;
    ctx.fillRect(-7, -14, 14, 3);

    // Head
    ctx.fillStyle = "#f1c9a5";
    ctx.beginPath();
    ctx.arc(0, -31, 5.5, 0, TAU);
    ctx.fill();

    // Class accessory
    if (o.cls === "Fighter") {
      // Helmet
      ctx.fillStyle = o.trim;
      ctx.beginPath();
      ctx.arc(0, -32, 6, Math.PI, TAU);
      ctx.fill();
      ctx.fillRect(-6, -32, 12, 2);
      // Shield (front side)
      ctx.save();
      ctx.translate(dir * 9, -20);
      ctx.fillStyle = o.secondary;
      roundRect(ctx, -4, -8, 8, 16, 3);
      ctx.fill();
      ctx.strokeStyle = o.trim;
      ctx.lineWidth = 1.4;
      roundRect(ctx, -4, -8, 8, 16, 3);
      ctx.stroke();
      ctx.restore();
      // Sword (back side), swings when attacking
      ctx.save();
      ctx.translate(-dir * 8, -22);
      ctx.rotate(dir * (-0.5 + sway * 0.9));
      ctx.strokeStyle = "#dfe6ef";
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.lineTo(0, -14);
      ctx.stroke();
      ctx.strokeStyle = o.trim;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-3, 4);
      ctx.lineTo(3, 4);
      ctx.stroke();
      ctx.restore();
    } else if (o.cls === "Archer") {
      // Hood
      ctx.fillStyle = o.secondary;
      ctx.beginPath();
      ctx.arc(0, -32, 6.5, Math.PI * 0.9, TAU * 1.03);
      ctx.fill();
      // Bow
      ctx.save();
      ctx.translate(dir * 8, -20);
      ctx.rotate(dir * (0.1 - sway * 0.4));
      ctx.strokeStyle = o.trim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 11, -1.1, 1.1);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(-1.1) * 11, Math.sin(-1.1) * 11);
      ctx.lineTo(Math.cos(1.1) * 11, Math.sin(1.1) * 11);
      ctx.stroke();
      ctx.restore();
    } else if (o.cls === "Mage") {
      // Pointed hat
      ctx.fillStyle = o.secondary;
      ctx.beginPath();
      ctx.moveTo(-7, -33);
      ctx.lineTo(7, -33);
      ctx.lineTo(dir * 3, -46);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = o.trim;
      ctx.fillRect(-7, -34, 14, 2.5);
      // Staff + orb
      ctx.save();
      ctx.translate(dir * 9, -22);
      ctx.rotate(dir * (0.15 + sway * 0.3));
      ctx.strokeStyle = "#8a6a45";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.lineTo(0, -12);
      ctx.stroke();
      ctx.fillStyle = o.trim;
      ctx.beginPath();
      ctx.arc(0, -13, 3.4, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(0, -13, 5.5, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // Hero distinction: shoulder plume + subtle outline
    if (o.isHero) {
      ctx.fillStyle = o.trim;
      ctx.beginPath();
      ctx.moveTo(0, -38);
      ctx.lineTo(-3, -44);
      ctx.lineTo(3, -44);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  /* ---- Enemies (by shape) --------------------------------------------- */

  function enemy(ctx, o) {
    const s = o.scale || 1;
    const x = o.x;
    const y = o.y;
    const r = (o.radius || 12) * s;
    const t = o.t || 0;

    shadow(ctx, x, y, r * 0.95, r * 0.4);

    ctx.save();
    ctx.translate(x, y);

    if (o.shape === "blob") {
      const wob = Math.sin(t * 6) * 0.12 + 1;
      ctx.fillStyle = o.color;
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.7, r, r * 0.8 * wob, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.ellipse(-r * 0.3, -r * 0.95, r * 0.3, r * 0.2, 0, 0, TAU);
      ctx.fill();
      eyes(ctx, 0, -r * 0.8, r * 0.32, 1.4);
    } else if (o.shape === "beast") {
      // low quadruped
      const lunge = Math.sin(t * 9) * 1.2;
      ctx.fillStyle = o.color;
      roundRectC(ctx, -r, -r * 0.9, r * 2, r * 0.9, r * 0.4);
      // head
      ctx.beginPath();
      ctx.arc((o.facing >= 0 ? 1 : -1) * r * 0.9, -r * 0.9 + lunge, r * 0.5, 0, TAU);
      ctx.fill();
      // ears
      ctx.fillStyle = o.accent;
      ctx.fillRect((o.facing >= 0 ? 1 : -1) * r * 1.05, -r * 1.45, 3, 4);
      eyes(ctx, (o.facing >= 0 ? 1 : -1) * r * 1.0, -r * 0.95, r * 0.2, 1.0);
    } else if (o.shape === "robed") {
      ctx.fillStyle = o.color;
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(-r * 0.6, -r * 1.6);
      ctx.quadraticCurveTo(0, -r * 2.0, r * 0.6, -r * 1.6);
      ctx.lineTo(r, 0);
      ctx.closePath();
      ctx.fill();
      // hood shadow
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.arc(0, -r * 1.4, r * 0.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = o.accent;
      ctx.beginPath();
      ctx.arc(-r * 0.18, -r * 1.45, 1.6, 0, TAU);
      ctx.arc(r * 0.18, -r * 1.45, 1.6, 0, TAU);
      ctx.fill();
    } else if (o.shape === "boss") {
      // big brute with club
      ctx.fillStyle = o.color;
      roundRectC(ctx, -r * 0.8, -r * 2.0, r * 1.6, r * 2.0, r * 0.4);
      ctx.beginPath();
      ctx.arc(0, -r * 2.1, r * 0.7, 0, TAU);
      ctx.fill();
      // tusks
      ctx.fillStyle = "#fff4dc";
      ctx.fillRect(-r * 0.3, -r * 1.9, 3, 5);
      ctx.fillRect(r * 0.2, -r * 1.9, 3, 5);
      eyes(ctx, 0, -r * 2.15, r * 0.28, 1.6);
      // club
      ctx.save();
      ctx.translate((o.facing >= 0 ? 1 : -1) * r * 0.9, -r * 1.4);
      ctx.rotate((o.facing >= 0 ? 1 : -1) * (0.4 + Math.sin(t * 3) * 0.2));
      ctx.strokeStyle = "#6b4a32";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -r * 1.2);
      ctx.stroke();
      ctx.fillStyle = "#7a5a40";
      ctx.beginPath();
      ctx.arc(0, -r * 1.3, r * 0.55, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else {
      // biped (goblin / orc)
      const stride = Math.sin(t * 8) * 1.5;
      ctx.fillStyle = o.color;
      // legs
      ctx.fillRect(-r * 0.5, -r * 0.7, r * 0.35, r * 0.7 + stride);
      ctx.fillRect(r * 0.18, -r * 0.7, r * 0.35, r * 0.7 - stride);
      // body
      roundRectC(ctx, -r * 0.6, -r * 1.7, r * 1.2, r * 1.1, r * 0.35);
      // head
      ctx.beginPath();
      ctx.arc(0, -r * 1.85, r * 0.5, 0, TAU);
      ctx.fill();
      // ears
      ctx.fillStyle = o.accent;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 1.9);
      ctx.lineTo(-r * 0.9, -r * 2.1);
      ctx.lineTo(-r * 0.45, -r * 1.7);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(r * 0.5, -r * 1.9);
      ctx.lineTo(r * 0.9, -r * 2.1);
      ctx.lineTo(r * 0.45, -r * 1.7);
      ctx.closePath();
      ctx.fill();
      eyes(ctx, 0, -r * 1.9, r * 0.28, 1.2);
    }

    ctx.restore();
  }

  function eyes(ctx, cx, cy, spread, size) {
    ctx.fillStyle = "#1a1020";
    ctx.beginPath();
    ctx.arc(cx - spread, cy, size, 0, TAU);
    ctx.arc(cx + spread, cy, size, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#ffe9a0";
    ctx.beginPath();
    ctx.arc(cx - spread, cy, size * 0.45, 0, TAU);
    ctx.arc(cx + spread, cy, size * 0.45, 0, TAU);
    ctx.fill();
  }

  /* ---- Projectiles ---------------------------------------------------- */

  function projectile(ctx, o) {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.angle || 0);
    if (o.style === "arrow") {
      ctx.strokeStyle = "#caa15a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.lineTo(6, 0);
      ctx.stroke();
      ctx.fillStyle = "#e8e8ee";
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(2, -3);
      ctx.lineTo(2, 3);
      ctx.closePath();
      ctx.fill();
    } else if (o.style === "magic") {
      ctx.fillStyle = o.color || "#7aa9ff";
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 3.6, 0, TAU);
      ctx.fill();
    } else {
      // cannon ball
      ctx.fillStyle = "#3a3f48";
      ctx.beginPath();
      ctx.arc(0, 0, o.r || 5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath();
      ctx.arc(-1.5, -1.5, (o.r || 5) * 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---- Geometry helpers ----------------------------------------------- */

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  // round rect that also fills (centered-ish usage)
  function roundRectC(ctx, x, y, w, h, r) {
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
  }

  /* ---- Painted sprite billboards (with procedural fallback) ----------- */

  // Draws a transparent painted sprite anchored by the feet at (x, y), with a
  // ground shadow and an animation transform (facing-space: +x = forward).
  function drawSprite(ctx, img, o) {
    const h = o.h;
    const w = h * (img.width / img.height);
    const dir = o.facing < 0 ? -1 : 1;
    const tr = o.tr || { ox: 0, oy: 0, sx: 1, sy: 1, rot: 0 };
    shadow(ctx, o.x, o.y, w * 0.32, h * 0.055);
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.scale(dir, 1); // face: now +x points "forward"
    ctx.translate(tr.ox || 0, tr.oy || 0);
    if (tr.rot) ctx.rotate(tr.rot);
    ctx.scale(tr.sx || 1, tr.sy || 1);
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }

  function spriteFor(id) {
    const a = LW.assets && LW.assets.sprites;
    const img = a && a[id];
    return img && img.complete && img.naturalWidth ? img : null;
  }

  return { shadow, healthBar, humanoid, enemy, projectile, roundRect, drawSprite, spriteFor };
})();
