/* =========================================================================
 * Last Wall — util.js
 * Shared math, RNG, DOM and small helper utilities used across the game.
 * Everything attaches to the global LW namespace (classic scripts, no build).
 * ========================================================================= */
window.LW = window.LW || {};

LW.util = (function () {
  "use strict";

  const TAU = Math.PI * 2;

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function dist(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function dist2(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  }

  function angle(ax, ay, bx, by) {
    return Math.atan2(by - ay, bx - ax);
  }

  // Inclusive integer between lo and hi.
  function randInt(lo, hi) {
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }

  function randFloat(lo, hi) {
    return lo + Math.random() * (hi - lo);
  }

  function chance(p) {
    return Math.random() < p;
  }

  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  // Weighted pick. table = [{ key, weight }]. Returns the chosen entry.
  function weightedPick(table) {
    let total = 0;
    for (const e of table) total += e.weight;
    let r = Math.random() * total;
    for (const e of table) {
      r -= e.weight;
      if (r <= 0) return e;
    }
    return table[table.length - 1];
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function formatNumber(n) {
    n = Math.floor(n);
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 10000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return String(n);
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /* ---- Tiny DOM helpers ------------------------------------------------ */

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === "class") node.className = attrs[k];
        else if (k === "html") node.innerHTML = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else if (k === "style") node.style.cssText = attrs[k];
        else if (k.startsWith("on") && typeof attrs[k] === "function") {
          node.addEventListener(k.slice(2), attrs[k]);
        } else if (attrs[k] != null) {
          node.setAttribute(k, attrs[k]);
        }
      }
    }
    if (children != null) {
      const list = Array.isArray(children) ? children : [children];
      for (const c of list) {
        if (c == null) continue;
        node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      }
    }
    return node;
  }

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  /* ---- Minimal event emitter ------------------------------------------- */

  class Emitter {
    constructor() {
      this._h = {};
    }
    on(evt, fn) {
      (this._h[evt] = this._h[evt] || []).push(fn);
      return this;
    }
    off(evt, fn) {
      const a = this._h[evt];
      if (a) this._h[evt] = a.filter((f) => f !== fn);
      return this;
    }
    emit(evt, payload) {
      const a = this._h[evt];
      if (a) for (const f of a.slice()) f(payload);
      return this;
    }
  }

  return {
    TAU,
    clamp,
    lerp,
    dist,
    dist2,
    angle,
    randInt,
    randFloat,
    chance,
    pick,
    weightedPick,
    shuffle,
    formatNumber,
    deepClone,
    el,
    $,
    clear,
    Emitter,
  };
})();
