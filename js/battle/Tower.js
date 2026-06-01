/* =========================================================================
 * Last Wall — Tower.js   (BP_TowerBase)
 * A player-built defensive tower occupying a dirt-circle plot. Three kinds:
 *   archer : fast single-target physical arrows.
 *   mage   : slower splash magic.
 *   guard  : no ranged attack — maintains a small squad of blocking infantry
 *            that march onto the path and body-block monsters (respawn on death).
 * Towers auto-target and auto-fire; they replace the damage the removed hero
 * support units used to provide. Rendered from painted, animated frames.
 * ========================================================================= */
window.LW = window.LW || {};

LW.Tower = class Tower {
  constructor(battle, plot, typeKey) {
    this.battle = battle;
    this.plot = plot;
    this.x = plot.x;
    this.y = plot.y;
    this.typeKey = typeKey;
    this.def = LW.Config.TOWER_TYPES[typeKey];
    this.range = this.def.range;
    this.cd = Math.random() * (this.def.attackInterval || 1);
    this.t = Math.random() * 4;
    this.fireT = 0;          // fire-animation timer
    this.aimAngle = -Math.PI / 2;
    this.infantry = [];      // guard-post squad
    this.spawnCD = 0;        // guard-post respawn cadence
  }

  /* ---- Per-frame ------------------------------------------------------ */

  update(dt) {
    this.t += dt;
    if (this.cd > 0) this.cd -= dt;
    if (this.fireT > 0) this.fireT = Math.max(0, this.fireT - dt);

    if (this.typeKey === "guard") {
      this._updateGuard(dt);
      return;
    }

    // Ranged towers: target the enemy closest to breaching, then fire.
    const target = this.battle.bestTargetInRange(this.x, this.y, this.range, {});
    if (target) {
      this.aimAngle = Math.atan2(target.y - this.y, target.x - this.x);
      if (this.cd <= 0) {
        this._fire(target);
        this.cd = this.def.attackInterval;
        this.fireT = this.def.fireTime || 0.3;
      }
    }
  }

  _fire(target) {
    const d = this.def;
    this.battle.spawnProjectile({
      x: this.x,
      y: this.y - this.def.h * 0.5, // leave from the tower top
      target,
      aimX: target.x,
      aimY: target.y - (target.radius || 10),
      speed: d.projSpeed || 420,
      damage: d.damage,
      splash: d.splash || 0,
      style: d.projStyle || "arrow",
      color: d.color,
      type: d.damageType || "physical",
      element: d.element || "Neutral",
    });
  }

  /* ---- Guard post: maintain a blocking infantry squad ----------------- */

  _updateGuard(dt) {
    const before = this.infantry.length;
    this.infantry = this.infantry.filter((u) => u.alive);
    if (this.spawnCD > 0) this.spawnCD -= dt;
    const want = this.def.spawnCount || 2;
    // An empty post re-mans immediately (e.g. at wave start); a partial squad
    // waits out the respawn cadence so losing a unit mid-wave costs time.
    if (this.infantry.length === 0 && before > 0) this.spawnCD = 0;
    if (this.infantry.length < want && this.spawnCD <= 0) {
      this._spawnInfantry();
      this.spawnCD = this.infantry.length < want ? 0.5 : (this.def.spawnInterval || 9);
    }
    if (this.infantry.some((u) => u.alive)) this.fireT = this.def.fireTime || 0.3;
  }

  _spawnInfantry() {
    // Block at the nearest point on the centre lane within the tower's leash.
    // Stagger squad members along the path so they stand shoulder-to-shoulder
    // rather than stacking on one spot.
    const guard = this._guardPoint();
    const slot = this.infantry.length; // 0,1,2...
    const off = (slot - ((this.def.spawnCount || 2) - 1) / 2) * 18;
    const tan = this._laneTangent(guard);
    const u = new LW.Infantry(this.battle, {
      tower: this,
      x: this.x,
      y: this.y + 6,
      guardX: guard.x + tan.x * off,
      guardY: guard.y + tan.y * off,
      maxHP: this.def.infantryHP,
      atk: this.def.infantryATK,
      attackInterval: this.def.infantryInterval,
    });
    this.infantry.push(u);
    this.battle.units.push(u);
  }

  // Unit tangent of the blocked lane at the sample nearest a point.
  _laneTangent(p) {
    const lane = this.battle.lanes[this.battle.blockLane];
    const d = this.battle._distanceOn(lane, p.x, p.y);
    return lane.tangentAt(d);
  }

  // Point on the blocked lane nearest this tower (where infantry hold the line).
  _guardPoint() {
    const lane = this.battle.lanes[this.battle.blockLane];
    let best = lane.samples[0], bestD = Infinity;
    for (const s of lane.samples) {
      const dd = LW.util.dist2(this.x, this.y, s.x, s.y);
      if (dd < bestD) { bestD = dd; best = s; }
    }
    return best;
  }

  /* ---- Build / sell --------------------------------------------------- */

  sellValue() {
    return Math.round((this.def.cost || 0) * (LW.Config.TOWER_SELL_FRACTION || 0.5));
  }

  remove() {
    for (const u of this.infantry) if (u.alive) u.despawn();
    this.infantry = [];
  }

  /* ---- Render --------------------------------------------------------- */

  // The current animation frame image (browser only; falls back to none).
  _frameImg() {
    const set = LW.assets && LW.assets.towers && LW.assets.towers[this.typeKey];
    if (!set || !set.length) return null;
    const d = this.def;
    let idx = 0;
    if (this.fireT > 0 && d.fireSeq && d.fireSeq.length) {
      const prog = d.fireTime ? 1 - this.fireT / d.fireTime : 0;
      idx = d.fireSeq[Math.min(d.fireSeq.length - 1, Math.floor(prog * d.fireSeq.length))];
    }
    const img = set[Math.min(set.length - 1, idx)];
    return img && img.complete && img.naturalWidth ? img : null;
  }

  render(ctx) {
    const d = this.def;
    const depth = this.battle.map.depthScale(this.y);
    const img = this._frameImg();
    const firing = this.fireT > 0;
    const prog = firing && d.fireTime ? 1 - this.fireT / d.fireTime : 0;

    ctx.save();
    // Contact shadow.
    const sw = (img ? d.h * depth * (img.naturalWidth / img.naturalHeight) : 40 * depth);
    ctx.fillStyle = "rgba(0,0,0,0.20)";
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + (d.dy || 0) * depth - 2, sw * 0.42, d.h * depth * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Procedural charge glow (mage crystals).
    if (d.glow && img) {
      const h = d.h * depth, w = sw, topY = this.y + (d.dy || 0) * depth - h;
      const base = 0.28 + 0.12 * Math.sin(this.t * 3 + this.x);
      const pulse = firing ? Math.sin(prog * Math.PI) : 0;
      const a2 = base * 0.5 + pulse * 0.9;
      if (a2 > 0.02) {
        const gx = this.x - w / 2 + d.glow.x * w, gy = topY + d.glow.y * h, gr = d.glow.r * w * (1 + 0.25 * pulse);
        const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        rg.addColorStop(0, d.glow.color); rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = Math.min(0.85, a2);
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      }
    }

    if (img) {
      const h = d.h * depth, w = sw;
      ctx.drawImage(img, this.x - w / 2, this.y + (d.dy || 0) * depth - h, w, h);
    } else {
      // Fallback: a simple stone stub so the tower is visible without art.
      ctx.fillStyle = "#7d828c";
      LW.Sprites.roundRect(ctx, this.x - 14, this.y - 34, 28, 38, 5); ctx.fill();
      ctx.fillStyle = d.color || "#9aa0aa";
      LW.Sprites.roundRect(ctx, this.x - 16, this.y - 40, 32, 10, 4); ctx.fill();
    }
    ctx.restore();
  }
};
