/* =========================================================================
 * Last Wall — BattleMap.js   (mirrors BP_BattleMapController + the scene)
 * Owns the layout anchors and paints the world. The battlefield is "Ironcove
 * Pass": a landscape Kingdom-Rush-style map — a Demonic Gate carved into a
 * rocky cliff at the top-left spawn, a winding dirt road (the centre lane)
 * crossing a river on a stone bridge to the player's castle at the
 * bottom-right, with two rune bastions flanking the road where the ranged
 * heroes stand, framed by pine forest, mountains and a waterfall. The scene is
 * painted once to an offscreen canvas (so it lines up exactly with the
 * movement splines) and blitted each frame; units, projectiles and VFX draw
 * on top.
 * ========================================================================= */
window.LW = window.LW || {};

LW.BattleMap = class BattleMap {
  constructor(battle) {
    this.battle = battle;
    this.W = LW.Config.WORLD_W;
    this.H = LW.Config.WORLD_H;
    this.anchors = LW.Config.anchors;
    this.t = 0;
    this._bg = null; // prerendered scene (offscreen canvas)
  }

  getAnchor(name) {
    return this.anchors[name];
  }

  // Faux-perspective: things lower on screen are nearer, so a touch larger.
  depthScale(y) {
    const t = LW.util.clamp((y - 40) / (this.H - 40), 0, 1);
    return LW.util.lerp(0.92, 1.16, t);
  }

  update(dt) {
    this.t += dt;
  }

  // Small deterministic RNG so the painted scene is stable across frames/runs.
  _rng(seed) {
    let s = seed >>> 0;
    return function () {
      s += 0x6d2b79f5;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---- Background (prerendered once, then blitted) -------------------- */

  // A committed painted map (LW.Config.MAP_IMAGE), if it loaded successfully.
  _mapImage() {
    const im = LW.assets && LW.assets.mapImage;
    return im && im.complete && im.naturalWidth ? im : null;
  }

  renderBackground(ctx) {
    const img = this._mapImage();
    if (img) {
      // Cover-fit the painting to the logical world (preserve aspect).
      const s = Math.max(this.W / img.naturalWidth, this.H / img.naturalHeight);
      const w = img.naturalWidth * s;
      const h = img.naturalHeight * s;
      ctx.drawImage(img, (this.W - w) / 2, (this.H - h) / 2, w, h);
      return;
    }
    // No committed art: paint the scene procedurally (matches the spline).
    if (!this._bg) this._buildScene();
    if (this._bg) ctx.drawImage(this._bg, 0, 0, this.W, this.H);
    else this._paintGrass(ctx); // pathological fallback
  }

  _buildScene() {
    const SS = 2; // supersample for crisp edges on hi-dpi
    let c, g;
    try {
      c = document.createElement("canvas");
      c.width = this.W * SS;
      c.height = this.H * SS;
      g = c.getContext("2d");
    } catch (e) {
      this._bg = null;
      return;
    }
    if (!g) { this._bg = null; return; }
    g.save();
    g.scale(SS, SS);
    this._paint(g);
    g.restore();
    this._bg = c;
  }

  _paint(g) {
    g.lineCap = "round";
    g.lineJoin = "round";
    this._paintGrass(g);
    this._paintMountains(g);
    this._paintRiver(g);
    this._paintWaterfall(g, 824, 36, 150);   // scenic cliff waterfall (right)
    this._paintRoad(g);
    this._paintBridge(g, 690, 300, 0.77, 96, 46); // stone arch where road meets river
    this._paintBastion(g, this.anchors.Anchor_Bastion_Left_Hero, 58, "#3a6fb0", "bolt");
    this._paintBastion(g, this.anchors.Anchor_Bastion_Right_Hero, 52, "#c0452e", "crest");
    this._paintGate(g, this.anchors.Anchor_EnemySpawn_Top);
    this._paintCastle(g, this.anchors.Anchor_CityDamagePoint);
    this._paintForest(g);
    this._paintDecor(g);
  }

  /* ---- Ground -------------------------------------------------------- */

  _paintGrass(g) {
    const W = this.W, H = this.H;
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#6ba24a");
    grad.addColorStop(1, "#56913e");
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    const rnd = this._rng(1234);
    // Soft tonal patches.
    for (let i = 0; i < 90; i++) {
      const x = rnd() * W, y = rnd() * H, r = 16 + rnd() * 54;
      g.globalAlpha = 0.07 + rnd() * 0.1;
      g.fillStyle = rnd() < 0.5 ? "#7fbb63" : "#4a8537";
      g.beginPath();
      g.ellipse(x, y, r, r * 0.58, 0, 0, Math.PI * 2);
      g.fill();
    }
    // Scattered grass tufts.
    g.globalAlpha = 0.5;
    g.strokeStyle = "#3f7a34";
    g.lineWidth = 1;
    for (let i = 0; i < 240; i++) {
      const x = rnd() * W, y = rnd() * H;
      g.beginPath();
      g.moveTo(x, y); g.lineTo(x - 2, y - 4);
      g.moveTo(x, y); g.lineTo(x + 2, y - 4);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  _paintMountains(g) {
    const W = this.W;
    // Hazy back ridge.
    g.fillStyle = "#9aa6bd";
    this._ridge(g, [[420, 96], [500, 24], [580, 70], [660, 18], [760, 78], [880, 30], [W, 70], [W, 0], [380, 0]]);
    // Nearer ridge with snow caps.
    g.fillStyle = "#7e8aa3";
    this._ridge(g, [[470, 104], [560, 40], [650, 96], [740, 36], [840, 90], [W, 44], [W, 0], [440, 0]]);
    g.fillStyle = "#e9eef6";
    for (const peak of [[560, 40], [740, 36]]) {
      g.beginPath();
      g.moveTo(peak[0] - 18, peak[1] + 22);
      g.lineTo(peak[0], peak[1]);
      g.lineTo(peak[0] + 18, peak[1] + 22);
      g.lineTo(peak[0] + 8, peak[1] + 16);
      g.lineTo(peak[0], peak[1] + 22);
      g.lineTo(peak[0] - 8, peak[1] + 16);
      g.closePath();
      g.fill();
    }
  }

  _ridge(g, pts) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.fill();
  }

  /* ---- Water --------------------------------------------------------- */

  _paintRiver(g) {
    const pts = [
      { x: 770, y: -12 }, { x: 744, y: 70 }, { x: 724, y: 150 }, { x: 705, y: 235 },
      { x: 690, y: 300 }, { x: 690, y: 382 }, { x: 706, y: 470 }, { x: 724, y: 560 },
    ];
    const stroke = (w, color, alpha) => {
      g.globalAlpha = alpha == null ? 1 : alpha;
      g.strokeStyle = color;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.stroke();
    };
    stroke(60, "#2d6498");
    stroke(50, "#3c7cb8");
    stroke(34, "#57a0d6");
    stroke(14, "#9fcdf0", 0.7);
    // Foam ripples along the banks.
    g.globalAlpha = 0.5;
    g.strokeStyle = "#e8f4ff";
    g.lineWidth = 1.4;
    const rnd = this._rng(55);
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i];
      for (let k = 0; k < 3; k++) {
        const yy = p.y + (rnd() * 40 - 20);
        g.beginPath();
        g.ellipse(p.x + (rnd() * 16 - 8), yy, 9, 2.2, 0, 0, Math.PI * 2);
        g.stroke();
      }
    }
    g.globalAlpha = 1;
  }

  _paintWaterfall(g, x, yTop, h) {
    // Rocky cliff lip.
    g.fillStyle = "#6f6a63";
    g.beginPath(); g.ellipse(x, yTop, 30, 12, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#827c73";
    g.beginPath(); g.ellipse(x, yTop - 2, 24, 8, 0, 0, Math.PI * 2); g.fill();
    // Falling water.
    const grad = g.createLinearGradient(0, yTop, 0, yTop + h);
    grad.addColorStop(0, "#bfe0f5");
    grad.addColorStop(0.5, "#7fb6e0");
    grad.addColorStop(1, "#4f93cc");
    g.fillStyle = grad;
    g.fillRect(x - 17, yTop, 34, h);
    // Streaks + mist.
    g.strokeStyle = "rgba(255,255,255,0.6)";
    g.lineWidth = 1.4;
    for (let i = -13; i <= 13; i += 5) {
      g.beginPath(); g.moveTo(x + i, yTop + 4); g.lineTo(x + i, yTop + h - 6); g.stroke();
    }
    g.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      g.beginPath(); g.ellipse(x + Math.cos(a) * 18, yTop + h + Math.sin(a) * 6, 7, 4, 0, 0, Math.PI * 2); g.fill();
    }
  }

  /* ---- Road ---------------------------------------------------------- */

  _paintRoad(g) {
    const s = this.battle.spline && this.battle.spline.samples;
    if (!s || !s.length) return;
    const line = (w, color) => {
      g.strokeStyle = color;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(s[0].x, s[0].y);
      for (let i = 1; i < s.length; i++) g.lineTo(s[i].x, s[i].y);
      g.stroke();
    };
    line(38, "#7b5c34"); // shadowed edge
    line(30, "#b78f55"); // packed dirt
    line(22, "#d7b075"); // lit centre
    // Pebbles + ruts.
    const rnd = this._rng(7);
    for (let i = 4; i < s.length; i += 4) {
      const p = s[i];
      g.fillStyle = "rgba(110,86,52,0.5)";
      g.beginPath();
      g.ellipse(p.x + (rnd() * 10 - 5), p.y + (rnd() * 7 - 3.5), 2.4, 1.6, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(232,205,150,0.5)";
      g.beginPath();
      g.ellipse(p.x + (rnd() * 10 - 5), p.y + (rnd() * 7 - 3.5), 1.4, 1, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  _paintBridge(g, x, y, angle, len, wid) {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    // Cast shadow on the water.
    g.fillStyle = "rgba(0,0,0,0.22)";
    g.fillRect(-len / 2, -wid / 2 + 4, len, wid);
    // Stone deck.
    g.fillStyle = "#8c8f97";
    g.fillRect(-len / 2, -wid / 2, len, wid);
    g.fillStyle = "#a3a7af";
    g.fillRect(-len / 2, -wid / 2, len, 5);
    // Cobble seams.
    g.strokeStyle = "rgba(60,62,70,0.55)";
    g.lineWidth = 1.4;
    for (let i = -len / 2 + 6; i <= len / 2 - 4; i += 9) {
      g.beginPath(); g.moveTo(i, -wid / 2); g.lineTo(i, wid / 2); g.stroke();
    }
    // Parapets.
    g.fillStyle = "#6f727b";
    g.fillRect(-len / 2, -wid / 2 - 5, len, 6);
    g.fillRect(-len / 2, wid / 2 - 1, len, 6);
    g.fillStyle = "#80838c";
    for (let i = -len / 2; i < len / 2; i += 12) {
      g.fillRect(i, -wid / 2 - 8, 7, 4);
      g.fillRect(i, wid / 2 + 2, 7, 4);
    }
    g.restore();
  }

  /* ---- Bastions ------------------------------------------------------ */

  _paintBastion(g, a, r, bannerColor, crest) {
    const x = a.x, y = a.y;
    g.save();
    // Ground shadow.
    g.fillStyle = "rgba(0,0,0,0.22)";
    g.beginPath(); g.ellipse(x, y + r * 0.5, r * 1.08, r * 0.5, 0, 0, Math.PI * 2); g.fill();
    // Stone drum (side) + platform top.
    g.fillStyle = "#6f747e";
    g.beginPath(); g.ellipse(x, y + 6, r, r * 0.62, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#7d828c";
    g.beginPath(); g.ellipse(x, y, r, r * 0.62, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#9aa0aa";
    g.beginPath(); g.ellipse(x, y - 3, r * 0.92, r * 0.56, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#bcc2cb";
    g.beginPath(); g.ellipse(x, y - 5, r * 0.74, r * 0.45, 0, 0, Math.PI * 2); g.fill();
    // Crenellation blocks around the rim.
    g.fillStyle = "#868c96";
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const bx = x + Math.cos(ang) * r * 0.9;
      const by = y - 3 + Math.sin(ang) * r * 0.56;
      g.fillRect(bx - 3, by - 4, 6, 6);
    }
    // Rune ring.
    g.strokeStyle = "#caa94f";
    g.lineWidth = 2;
    g.beginPath(); g.ellipse(x, y - 5, r * 0.56, r * 0.34, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#d9bf6a";
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      g.beginPath();
      g.ellipse(x + Math.cos(ang) * r * 0.56, y - 5 + Math.sin(ang) * r * 0.34, 1.7, 1.2, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#caa94f";
    g.beginPath(); g.arc(x, y - 5, 3, 0, Math.PI * 2); g.fill();
    // Banner pole + flag.
    g.strokeStyle = "#5b3f28";
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x, y - r - 30); g.stroke();
    g.fillStyle = bannerColor;
    g.beginPath();
    g.moveTo(x, y - r - 30);
    g.lineTo(x + 26, y - r - 24);
    g.lineTo(x + 20, y - r - 18);
    g.lineTo(x + 26, y - r - 12);
    g.lineTo(x, y - r - 16);
    g.closePath();
    g.fill();
    g.fillStyle = "#ffe08a";
    if (crest === "bolt") {
      g.beginPath();
      g.moveTo(x + 11, y - r - 27); g.lineTo(x + 7, y - r - 21);
      g.lineTo(x + 11, y - r - 21); g.lineTo(x + 7, y - r - 15);
      g.lineTo(x + 16, y - r - 23); g.lineTo(x + 12, y - r - 23);
      g.closePath(); g.fill();
    } else {
      g.beginPath(); g.arc(x + 11, y - r - 21, 3, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  /* ---- Demonic Gate (spawn) ------------------------------------------ */

  _rockMass(g, x, y, w, h, light, dark) {
    g.fillStyle = dark;
    g.beginPath(); g.ellipse(x, y + h * 0.18, w, h, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = light;
    g.beginPath(); g.ellipse(x - w * 0.22, y - h * 0.18, w * 0.7, h * 0.7, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(x + w * 0.42, y - h * 0.05, w * 0.42, h * 0.55, 0, 0, Math.PI * 2); g.fill();
  }

  _paintGate(g, a) {
    const x = a.x, y = a.y;
    g.save();
    // Ground shadow.
    g.fillStyle = "rgba(0,0,0,0.22)";
    g.beginPath(); g.ellipse(x + 4, y + 40, 66, 22, 0, 0, Math.PI * 2); g.fill();
    // Rocky crag the gate is carved into.
    this._rockMass(g, x, y - 6, 64, 50, "#7c7780", "#534f59");
    this._rockMass(g, x - 44, y + 6, 30, 34, "#6f6a73", "#4a4751");
    this._rockMass(g, x + 46, y + 2, 28, 32, "#6f6a73", "#4a4751");
    // Carved stone archway.
    g.fillStyle = "#3b3842";
    this._archShape(g, x, y + 30, 26, 52);
    g.fillStyle = "#2a2730";
    this._archShape(g, x, y + 30, 19, 42);
    // Dark cave mouth.
    g.fillStyle = "#0c0a12";
    this._archShape(g, x, y + 30, 14, 34);
    // Hellish portal glow.
    const pg = g.createRadialGradient(x, y + 12, 3, x, y + 12, 26);
    pg.addColorStop(0, "#ffb24a");
    pg.addColorStop(0.45, "#d23a22");
    pg.addColorStop(1, "rgba(90,18,50,0)");
    g.fillStyle = pg;
    g.beginPath(); g.ellipse(x, y + 14, 16, 22, 0, 0, Math.PI * 2); g.fill();
    // Fang stones at the arch lip + skull boss.
    g.fillStyle = "#d9d2c4";
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(x + i * 7 - 2, y + 2); g.lineTo(x + i * 7 + 2, y + 2); g.lineTo(x + i * 7, y + 8);
      g.closePath(); g.fill();
    }
    g.fillStyle = "#e6e0d2";
    g.beginPath(); g.arc(x, y - 18, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#2a2730";
    g.beginPath(); g.arc(x - 2.3, y - 19, 1.5, 0, Math.PI * 2); g.arc(x + 2.3, y - 19, 1.5, 0, Math.PI * 2); g.fill();
    // Arrow sign pointing out of the gate.
    g.strokeStyle = "#caa15a"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x + 22, y + 44); g.lineTo(x + 40, y + 50); g.stroke();
    g.beginPath(); g.moveTo(x + 40, y + 50); g.lineTo(x + 33, y + 45); g.moveTo(x + 40, y + 50); g.lineTo(x + 33, y + 53); g.stroke();
    g.restore();
  }

  _archShape(g, x, yb, hw, h) {
    g.beginPath();
    g.moveTo(x - hw, yb);
    g.lineTo(x - hw, yb - h + hw);
    g.arc(x, yb - h + hw, hw, Math.PI, 0);
    g.lineTo(x + hw, yb);
    g.closePath();
    g.fill();
  }

  /* ---- Castle -------------------------------------------------------- */

  _paintCastle(g, a) {
    const cx = a.x - 36, cy = a.y - 30;
    const wall = "#566980", wallHi = "#6a7d94", stone = "#46566b", roof = "#3f80bc", roofHi = "#6aa6dc", trim = "#222a36";
    g.save();
    g.fillStyle = "rgba(0,0,0,0.26)";
    g.beginPath(); g.ellipse(cx + 6, cy + 46, 86, 30, 0, 0, Math.PI * 2); g.fill();

    const tower = (tx, ty, w, h) => {
      g.fillStyle = stone; g.fillRect(tx - w / 2, ty - h, w, h);
      g.fillStyle = wallHi; g.fillRect(tx - w / 2, ty - h, w * 0.4, h);
      g.fillStyle = "#3a4859";
      for (let i = -w / 2; i < w / 2 - 2; i += 8) g.fillRect(tx + i, ty - h - 7, 6, 7);
      // Conical blue roof.
      g.fillStyle = roof;
      g.beginPath(); g.moveTo(tx - w / 2 - 4, ty - h - 6); g.lineTo(tx, ty - h - 34); g.lineTo(tx + w / 2 + 4, ty - h - 6); g.closePath(); g.fill();
      g.fillStyle = roofHi;
      g.beginPath(); g.moveTo(tx - w / 2 - 4, ty - h - 6); g.lineTo(tx, ty - h - 34); g.lineTo(tx - 2, ty - h - 9); g.closePath(); g.fill();
      // Pennant.
      g.strokeStyle = "#caa15a"; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(tx, ty - h - 34); g.lineTo(tx, ty - h - 46); g.stroke();
      g.fillStyle = "#c8455a";
      g.beginPath(); g.moveTo(tx, ty - h - 46); g.lineTo(tx + 11, ty - h - 42); g.lineTo(tx, ty - h - 38); g.closePath(); g.fill();
    };

    // Back tower, curtain wall, keep, front towers (rough depth order).
    tower(cx, cy - 14, 26, 34);
    g.fillStyle = wall; g.fillRect(cx - 50, cy - 22, 100, 62);
    g.fillStyle = wallHi; g.fillRect(cx - 50, cy - 22, 100, 9);
    g.fillStyle = "#3a4859";
    for (let i = -50; i < 50; i += 16) g.fillRect(cx + i, cy - 30, 9, 9);
    // Gate facing the road.
    g.fillStyle = trim; this._archShape(g, cx + 26, cy + 40, 17, 28);
    g.fillStyle = "#161c24"; this._archShape(g, cx + 26, cy + 40, 12, 22);
    g.strokeStyle = "#6a7686"; g.lineWidth = 1.4;
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(cx + 26 + i * 4, cy + 22); g.lineTo(cx + 26 + i * 4, cy + 40); g.stroke(); }
    tower(cx - 48, cy + 32, 22, 50);
    tower(cx + 48, cy + 32, 22, 50);
    g.restore();
  }

  /* ---- Forest + decorations ------------------------------------------ */

  _tree(g, x, y, s) {
    g.fillStyle = "rgba(0,0,0,0.16)";
    g.beginPath(); g.ellipse(x, y + s * 0.5, s * 0.9, s * 0.34, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#274f26";
    g.beginPath(); g.ellipse(x, y, s * 1.05, s * 0.92, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#387034";
    g.beginPath(); g.ellipse(x - s * 0.2, y - s * 0.25, s * 0.82, s * 0.72, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#54a04b";
    g.beginPath(); g.ellipse(x - s * 0.3, y - s * 0.4, s * 0.46, s * 0.4, 0, 0, Math.PI * 2); g.fill();
  }

  _pine(g, x, y, s) {
    g.fillStyle = "rgba(0,0,0,0.16)";
    g.beginPath(); g.ellipse(x, y + s * 0.2, s * 0.7, s * 0.26, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#5a3f24";
    g.fillRect(x - s * 0.08, y - s * 0.1, s * 0.16, s * 0.4);
    const tier = (oy, w, col) => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(x - w, y + oy); g.lineTo(x, y + oy - w * 1.5); g.lineTo(x + w, y + oy); g.closePath();
      g.fill();
    };
    tier(s * 0.1, s * 0.7, "#27502a");
    tier(-s * 0.35, s * 0.58, "#347036");
    tier(-s * 0.8, s * 0.42, "#46924a");
  }

  _paintForest(g) {
    const W = this.W, H = this.H, rnd = this._rng(99);
    const draw = (x, y, s) => (rnd() < 0.45 ? this._pine(g, x, y, s) : this._tree(g, x, y, s));
    // Edge framing (denser at the corners, like the reference).
    for (let i = 0; i < 210; i++) {
      const e = rnd();
      let x, y;
      if (e < 0.3) { x = rnd() * W; y = rnd() * 48; }
      else if (e < 0.5) { x = rnd() * W; y = H - rnd() * 56; }
      else if (e < 0.76) { x = rnd() * 66; y = rnd() * H; }
      else { x = W - rnd() * 58; y = rnd() * H; }
      draw(x, y, 10 + rnd() * 14);
    }
    // Big trees guarding the Demonic Gate (top-left), matching the reference.
    for (let i = 0; i < 16; i++) this._tree(g, 20 + rnd() * 150, 30 + rnd() * 130, 16 + rnd() * 14);
    // A couple of large foreground trees in the bottom corners.
    this._tree(g, 26, H - 30, 30);
    this._pine(g, W - 30, H - 26, 30);
  }

  _runeStone(g, x, y, s) {
    g.fillStyle = "rgba(0,0,0,0.18)";
    g.beginPath(); g.ellipse(x, y + 2, s * 0.7, s * 0.24, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#8a8e96";
    g.beginPath();
    g.moveTo(x - s * 0.4, y); g.lineTo(x - s * 0.3, y - s * 1.4);
    g.lineTo(x + s * 0.3, y - s * 1.5); g.lineTo(x + s * 0.42, y);
    g.closePath(); g.fill();
    g.fillStyle = "#a7abb3";
    g.fillRect(x - s * 0.22, y - s * 1.35, s * 0.18, s * 1.2);
    g.fillStyle = "#caa94f";
    g.fillRect(x - s * 0.06, y - s * 1.0, s * 0.12, s * 0.1);
    g.fillRect(x - s * 0.06, y - s * 0.7, s * 0.12, s * 0.1);
  }

  _ruinTower(g, x, y, s) {
    g.fillStyle = "rgba(0,0,0,0.2)";
    g.beginPath(); g.ellipse(x, y + s * 0.3, s * 0.8, s * 0.3, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#5d6470";
    g.fillRect(x - s * 0.5, y - s * 1.4, s, s * 1.7);
    g.fillStyle = "#717986";
    g.fillRect(x - s * 0.5, y - s * 1.4, s * 0.4, s * 1.7);
    // Broken top.
    g.fillStyle = "#56913e";
    g.beginPath();
    g.moveTo(x - s * 0.5, y - s * 1.4); g.lineTo(x - s * 0.2, y - s * 1.55);
    g.lineTo(x + s * 0.1, y - s * 1.35); g.lineTo(x + s * 0.5, y - s * 1.5);
    g.lineTo(x + s * 0.5, y - s * 1.4); g.closePath(); g.fill();
  }

  _catapult(g, x, y, s) {
    g.fillStyle = "rgba(0,0,0,0.2)";
    g.beginPath(); g.ellipse(x, y + 3, s, s * 0.3, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#6b4a28"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x - s * 0.7, y); g.lineTo(x + s * 0.7, y); g.stroke();
    g.beginPath(); g.moveTo(x - s * 0.5, y); g.lineTo(x, y - s * 0.9); g.stroke();
    g.beginPath(); g.moveTo(x + s * 0.5, y); g.lineTo(x, y - s * 0.9); g.stroke();
    g.fillStyle = "#7a5630";
    g.beginPath(); g.arc(x - s * 0.5, y, s * 0.22, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(x + s * 0.5, y, s * 0.22, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#8a5a30"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, y - s * 0.9); g.lineTo(x - s * 0.8, y - s * 1.1); g.stroke();
  }

  _tent(g, x, y, s, color) {
    g.fillStyle = "rgba(0,0,0,0.18)";
    g.beginPath(); g.ellipse(x, y + 2, s * 0.9, s * 0.24, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = color;
    g.beginPath(); g.moveTo(x - s * 0.8, y); g.lineTo(x, y - s); g.lineTo(x + s * 0.8, y); g.closePath(); g.fill();
    g.fillStyle = "rgba(0,0,0,0.18)";
    g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.8, y); g.lineTo(x + s * 0.2, y); g.closePath(); g.fill();
    g.fillStyle = "#2a2026";
    g.beginPath(); g.moveTo(x - s * 0.16, y); g.lineTo(x, y - s * 0.45); g.lineTo(x + s * 0.16, y); g.closePath(); g.fill();
  }

  _paintDecor(g) {
    const s = this.battle.spline && this.battle.spline.samples;
    const rnd = this._rng(303);
    // Signposts along the road (offset to the grassy side).
    if (s && s.length) {
      for (const f of [0.12, 0.26, 0.42, 0.56, 0.7]) {
        const p = s[Math.floor(s.length * f)];
        if (p) this._signpost(g, p.x + (rnd() < 0.5 ? -22 : 22), p.y - 2);
      }
    }
    // Rune monoliths scattered across the meadow.
    for (const c of [[180, 250], [120, 360], [360, 250], [470, 430], [330, 470], [560, 150]]) {
      this._runeStone(g, c[0], c[1], 14 + rnd() * 5);
    }
    // Ruined enemy towers (left edge + far right) like the reference.
    this._ruinTower(g, 70, 300, 26);
    this._ruinTower(g, 905, 250, 24);
    // Encampment near the river mouth (catapult + tents).
    this._catapult(g, 470, 510, 34);
    this._tent(g, 540, 512, 22, "#b6532f");
    this._tent(g, 392, 514, 20, "#c98a3a");
    // Loose rocks.
    g.fillStyle = "#8a8e96";
    for (let i = 0; i < 14; i++) {
      const x = rnd() * this.W, y = 60 + rnd() * (this.H - 120);
      g.beginPath(); g.ellipse(x, y, 4 + rnd() * 5, 3 + rnd() * 3, 0, 0, Math.PI * 2); g.fill();
    }
  }

  _signpost(g, x, y) {
    g.save();
    g.translate(x, y);
    g.fillStyle = "rgba(0,0,0,0.18)";
    g.beginPath(); g.ellipse(0, 1, 9, 3, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#5b3f2a";
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -18); g.stroke();
    g.fillStyle = "#8a5a30";
    g.fillRect(-8, -25, 16, 10);
    g.fillStyle = "#caa15a";
    g.fillRect(-8, -25, 16, 2.5);
    g.fillStyle = "#5b3f2a";
    g.fillRect(-5, -22, 10, 1.6);
    g.fillRect(-5, -19.5, 7, 1.6);
    g.restore();
  }

  // Painted defensive towers, one per deployed hero, drawn at the hero anchor
  // (behind the hero sprite). Archer/Mage garrison their bastion; the Fighter
  // mans the guard post in the vanguard.
  renderTowers(ctx) {
    const cfg = LW.Config.TOWERS;
    const imgs = LW.assets && LW.assets.towers;
    if (!cfg || !imgs) return;
    for (const hero of this.battle.heroes) {
      const t = cfg[hero.cls];
      const img = imgs[hero.cls];
      if (!t || !img || !img.complete || !img.naturalWidth) continue;
      const depth = this.depthScale(hero.y);
      const h = t.h * depth;
      const w = h * (img.naturalWidth / img.naturalHeight);
      const footY = hero.y + (t.dy || 0) * depth;
      ctx.save();
      ctx.globalAlpha = 1;
      // Soft contact shadow under the tower.
      ctx.fillStyle = "rgba(0,0,0,0.20)";
      ctx.beginPath();
      ctx.ellipse(hero.x, footY - 2, w * 0.42, h * 0.10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(img, hero.x - w / 2, footY - h, w, h);
      ctx.restore();
    }
  }

  // Subtle atmospheric overlay drawn above the actors to focus the action.
  renderForeground(ctx) {
    const vg = ctx.createRadialGradient(this.W / 2, this.H * 0.5, this.H * 0.42, this.W / 2, this.H * 0.54, this.H * 1.1);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.W, this.H);
  }
};
