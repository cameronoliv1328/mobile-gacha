/* =========================================================================
 * Last Wall — Anim.js
 * Lightweight procedural frame animation for the painted billboard sprites.
 * Returns a per-frame transform (in the sprite's facing-space: +x = forward)
 * that drawSprite applies. Poses are stepped at a low rate so they read as
 * classic 2-3 frame sprite animation rather than a smooth tween.
 *
 *   idle  : 2-frame breathing
 *   walk  : 2-frame waddle (enemies on the move)
 *   attack: 3-frame wind-up -> strike -> recover (melee lunge / ranged cast)
 * ========================================================================= */
window.LW = window.LW || {};

LW.Anim = (function () {
  "use strict";

  const NEUTRAL = { ox: 0, oy: 0, sx: 1, sy: 1, rot: 0 };

  // 2-frame idle breathe.
  function idle(t) {
    return Math.floor(t / 0.36) % 2 === 0 ? NEUTRAL : { ox: 0, oy: 1.5, sx: 1.015, sy: 0.972, rot: 0 };
  }

  // 2-frame waddle for moving enemies.
  function walk(t) {
    return Math.floor(t / 0.16) % 2 === 0 ? { ox: 0, oy: 0, sx: 1, sy: 1, rot: 0.05 } : { ox: 0, oy: -2, sx: 1.0, sy: 1.0, rot: -0.05 };
  }

  // 3-frame attack. p in 0..1. melee lunges forward, ranged does a cast pop.
  function attack(p, ranged) {
    const f = p < 0.34 ? 0 : p < 0.66 ? 1 : 2;
    if (ranged) {
      if (f === 0) return { ox: -2, oy: -1, sx: 1.0, sy: 1.05, rot: -0.06 };
      if (f === 1) return { ox: 4, oy: -1, sx: 1.07, sy: 1.02, rot: 0.05 };
      return { ox: 1, oy: 0, sx: 1, sy: 1, rot: 0 };
    }
    if (f === 0) return { ox: -4, oy: 0, sx: 1.03, sy: 0.97, rot: -0.16 }; // wind up
    if (f === 1) return { ox: 11, oy: -2, sx: 1.0, sy: 1.05, rot: 0.24 }; // strike
    return { ox: 3, oy: 0, sx: 1, sy: 1, rot: 0.06 }; // recover
  }

  function heroTransform(o) {
    if (o.attacking && o.swingDur > 0) {
      const p = 1 - Math.max(0, o.swingT) / o.swingDur;
      return attack(p, o.ranged);
    }
    return idle(o.t);
  }

  function enemyTransform(o) {
    if (o.attacking && o.attackDur > 0) {
      const p = 1 - Math.max(0, o.attackT) / o.attackDur;
      const f = p < 0.4 ? 0 : p < 0.7 ? 1 : 2;
      if (f === 0) return { ox: -3, oy: 0, sx: 1.03, sy: 0.98, rot: -0.12 };
      if (f === 1) return { ox: 9, oy: -2, sx: 1.0, sy: 1.05, rot: 0.18 };
      return { ox: 2, oy: 0, sx: 1, sy: 1, rot: 0.05 };
    }
    return o.moving ? walk(o.t) : idle(o.t);
  }

  return { heroTransform, enemyTransform, idle, walk, attack, NEUTRAL };
})();
