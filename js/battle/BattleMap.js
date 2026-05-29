/* =========================================================================
 * Last Wall — BattleMap.js   (mirrors BP_BattleMapController + the scene)
 * Owns the layout anchors and paints the world: forest/mountain spawn zone,
 * open field with the winding dirt path, the stone wall with two round
 * bastions and a central gate, and the bridge choke extending to the city.
 *
 * The static scene is baked to an offscreen canvas once; only torches and
 * banners animate, keeping the per-frame cost low on mobile.
 * ========================================================================= */
window.LW = window.LW || {};

LW.BattleMap = class BattleMap {
  constructor(battle) {
    this.battle = battle;
    this.W = LW.Config.WORLD_W;
    this.H = LW.Config.WORLD_H;
    this.anchors = LW.Config.anchors;

    // Wall / bridge geometry (logical coords).
    this.wallTop = 556;
    this.wallBottom = 690;
    this.gate = { x: 270, w: 66, top: 600, bottom: 690 };
    this.bastionL = { x: 96, y: 600, r: 52 };
    this.bastionR = { x: 444, y: 600, r: 52 };
    this.bridge = { topY: 690, topHalf: 34, botY: 912, botHalf: 62, cx: 270 };

    this._rngState = 1337;
    this._props = this._genProps();
    this.t = 0;

    this._bake();
  }

  /* ---- Helpers -------------------------------------------------------- */

  _rng() {
    // Deterministic LCG so decorative props don't flicker between rebuilds.
    this._rngState = (this._rngState * 1664525 + 1013904223) >>> 0;
    return this._rngState / 4294967296;
  }

  getAnchor(name) {
    return this.anchors[name];
  }

  // Faux-perspective: things lower on screen are nearer, so a touch larger.
  depthScale(y) {
    const t = LW.util.clamp((y - 40) / (this.H - 40), 0, 1);
    return LW.util.lerp(0.82, 1.12, t);
  }

  _genProps() {
    const trees = [];
    const rng = () => this._rng();
    // Forest framing down both edges of the field.
    for (let y = 70; y < 560; y += 26) {
      const jitterL = rng() * 18;
      const jitterR = rng() * 18;
      trees.push({ x: 12 + jitterL, y: y + rng() * 10, r: 18 + rng() * 12, side: -1 });
      trees.push({ x: this.W - 12 - jitterR, y: y + rng() * 10, r: 18 + rng() * 12, side: 1 });
    }
    // Top canopy band across the spawn zone.
    for (let i = 0; i < 22; i++) {
      trees.push({ x: rng() * this.W, y: 18 + rng() * 60, r: 20 + rng() * 16, side: 0 });
    }
    const rocks = [];
    for (let i = 0; i < 12; i++) {
      const x = 150 + rng() * 240;
      const y = 180 + rng() * 320;
      rocks.push({ x, y, r: 4 + rng() * 7, kind: rng() < 0.4 ? "stump" : "rock" });
    }
    return { trees, rocks };
  }

  /* ---- Static bake ---------------------------------------------------- */

  _bake() {
    const c = document.createElement("canvas");
    c.width = this.W;
    c.height = this.H;
    const ctx = c.getContext("2d");
    this._paintSky(ctx);
    this._paintField(ctx);
    this._paintPath(ctx);
    this._paintProps(ctx);
    this._paintForest(ctx);
    this._paintWall(ctx);
    this._paintBridge(ctx);
    this.bg = c;
  }

  _paintSky(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 240);
    g.addColorStop(0, "#33406a");
    g.addColorStop(0.55, "#6f83ab");
    g.addColorStop(1, "#c7b59a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, 260);

    // Layered distant mountains.
    const ranges = [
      { y: 150, h: 90, col: "#5b6789" },
      { y: 175, h: 95, col: "#6e789a" },
      { y: 200, h: 90, col: "#8a8fa6" },
    ];
    for (const r of ranges) {
      ctx.fillStyle = r.col;
      ctx.beginPath();
      ctx.moveTo(0, r.y + r.h);
      let x = 0;
      let up = true;
      ctx.lineTo(0, r.y + 20);
      while (x < this.W) {
        const peak = r.y + (up ? -10 : 18) + this._rng() * 20;
        x += 50 + this._rng() * 50;
        ctx.lineTo(x, peak);
        up = !up;
      }
      ctx.lineTo(this.W, r.y + r.h);
      ctx.closePath();
      ctx.fill();
    }
    // Soft fog band over the treeline.
    const fg = ctx.createLinearGradient(0, 200, 0, 300);
    fg.addColorStop(0, "rgba(220,225,230,0)");
    fg.addColorStop(0.6, "rgba(222,228,232,0.55)");
    fg.addColorStop(1, "rgba(222,228,232,0)");
    ctx.fillStyle = fg;
    ctx.fillRect(0, 190, this.W, 120);
  }

  _paintField(ctx) {
    const g = ctx.createLinearGradient(0, 200, 0, this.H);
    g.addColorStop(0, "#6f9a55");
    g.addColorStop(0.5, "#5f8c46");
    g.addColorStop(1, "#4f7a3a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 230, this.W, this.H - 230);

    // Subtle grass tufts / texture dabs.
    for (let i = 0; i < 420; i++) {
      const x = this._rng() * this.W;
      const y = 250 + this._rng() * (this.H - 250);
      ctx.globalAlpha = 0.06 + this._rng() * 0.06;
      ctx.fillStyle = this._rng() < 0.5 ? "#7cae5e" : "#46702f";
      ctx.fillRect(x, y, 2, 3 + this._rng() * 3);
    }
    ctx.globalAlpha = 1;
  }

  _paintPath(ctx) {
    const samples = this.battle.spline.samples.filter((s) => s.y <= this.wallTop + 4);
    if (samples.length < 2) return;
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(samples[0].x, samples[0].y);
      for (let i = 1; i < samples.length; i++) ctx.lineTo(samples[i].x, samples[i].y);
    };
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    trace();
    ctx.strokeStyle = "#7d5e38";
    ctx.lineWidth = 34;
    ctx.stroke();
    trace();
    ctx.strokeStyle = "#b9925e";
    ctx.lineWidth = 26;
    ctx.stroke();
    trace();
    ctx.strokeStyle = "#c8a878";
    ctx.lineWidth = 14;
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  _paintProps(ctx) {
    for (const r of this._props.rocks) {
      if (r.kind === "rock") {
        ctx.fillStyle = "#8d8d92";
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, r.r, r.r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.beginPath();
        ctx.ellipse(r.x - r.r * 0.3, r.y - r.r * 0.3, r.r * 0.4, r.r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "#7a5a3a";
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, r.r, r.r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#a07c4f";
        ctx.beginPath();
        ctx.ellipse(r.x, r.y - r.r * 0.4, r.r * 0.7, r.r * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  _tree(ctx, t) {
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.ellipse(t.x, t.y + t.r * 0.7, t.r * 0.7, t.r * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    // trunk
    ctx.fillStyle = "#5a3f29";
    ctx.fillRect(t.x - 2.5, t.y, 5, t.r * 0.6);
    // canopy clusters
    const blobs = [
      [0, -t.r * 0.4, t.r],
      [-t.r * 0.5, -t.r * 0.1, t.r * 0.7],
      [t.r * 0.5, -t.r * 0.1, t.r * 0.7],
      [0, -t.r, t.r * 0.7],
    ];
    ctx.fillStyle = "#2f5a39";
    for (const b of blobs) {
      ctx.beginPath();
      ctx.arc(t.x + b[0], t.y + b[1], b[2], 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#3d6e45";
    for (const b of blobs) {
      ctx.beginPath();
      ctx.arc(t.x + b[0] - t.r * 0.18, t.y + b[1] - t.r * 0.22, b[2] * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _paintForest(ctx) {
    // Sort by y so nearer trees overlap correctly.
    const trees = this._props.trees.slice().sort((a, b) => a.y - b.y);
    for (const t of trees) this._tree(ctx, t);
  }

  _stoneFace(ctx, x, y, w, h, base, light) {
    ctx.fillStyle = base;
    LW.Sprites.roundRect(ctx, x, y, w, h, 5);
    ctx.fill();
    // brick seams
    ctx.strokeStyle = "rgba(0,0,0,0.16)";
    ctx.lineWidth = 1;
    for (let yy = y + 12; yy < y + h; yy += 12) {
      ctx.beginPath();
      ctx.moveTo(x + 2, yy);
      ctx.lineTo(x + w - 2, yy);
      ctx.stroke();
    }
    ctx.fillStyle = light;
    LW.Sprites.roundRect(ctx, x, y, w, 6, 5);
    ctx.fill();
  }

  _crenellations(ctx, x, w, top, col) {
    ctx.fillStyle = col;
    const n = Math.floor(w / 16);
    for (let i = 0; i <= n; i++) {
      ctx.fillRect(x + i * 16, top - 10, 9, 12);
    }
  }

  _paintWall(ctx) {
    const tier = this.battle.wall ? this.battle.wall.visualTier : 0;
    const base = ["#8a847c", "#928c83", "#9a948b", "#a39c92"][tier] || "#8a847c";
    const light = "#b6b0a6";
    const dark = "#6c665e";

    // Curtain wall (two spans flanking the gate).
    const wy = this.wallTop;
    const wh = this.wallBottom - this.wallTop;
    this._stoneFace(ctx, 40, wy, 168, wh, base, light); // left span
    this._stoneFace(ctx, 332, wy, 168, wh, base, light); // right span
    this._crenellations(ctx, 40, 168, wy, dark);
    this._crenellations(ctx, 332, 168, wy, dark);

    // Gate housing.
    const g = this.gate;
    this._stoneFace(ctx, g.x - g.w / 2 - 8, wy, g.w + 16, wh, base, light);
    // Gate arch opening with wooden doors.
    ctx.fillStyle = "#2b2118";
    ctx.beginPath();
    ctx.moveTo(g.x - g.w / 2, g.bottom);
    ctx.lineTo(g.x - g.w / 2, g.top + 14);
    ctx.quadraticCurveTo(g.x, g.top - 16, g.x + g.w / 2, g.top + 14);
    ctx.lineTo(g.x + g.w / 2, g.bottom);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#5a3f29";
    for (let i = 0; i < 2; i++) {
      ctx.fillRect(g.x - g.w / 2 + 4 + i * (g.w / 2 - 2), g.top + 12, g.w / 2 - 6, g.bottom - g.top - 14);
    }
    ctx.strokeStyle = "#3a2a1c";
    ctx.lineWidth = 2;
    for (let yy = g.top + 22; yy < g.bottom; yy += 14) {
      ctx.beginPath();
      ctx.moveTo(g.x - g.w / 2 + 4, yy);
      ctx.lineTo(g.x + g.w / 2 - 4, yy);
      ctx.stroke();
    }

    // Round bastions (towers) flanking the gate.
    for (const b of [this.bastionL, this.bastionR]) {
      // tower body
      const grd = ctx.createLinearGradient(b.x - b.r, 0, b.x + b.r, 0);
      grd.addColorStop(0, dark);
      grd.addColorStop(0.4, base);
      grd.addColorStop(0.6, light);
      grd.addColorStop(1, dark);
      ctx.fillStyle = grd;
      LW.Sprites.roundRect(ctx, b.x - b.r, b.y - 70, b.r * 2, 150, 14);
      ctx.fill();
      // top platform ring
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y - 64, b.r, b.r * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3a3630";
      ctx.beginPath();
      ctx.ellipse(b.x, b.y - 64, b.r - 7, (b.r - 7) * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      // merlons around the rim
      ctx.fillStyle = dark;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI - Math.PI;
        const mx = b.x + Math.cos(a) * b.r;
        const my = b.y - 64 + Math.sin(a) * b.r * 0.42;
        if (my <= b.y - 60) ctx.fillRect(mx - 4, my - 8, 8, 10);
      }
    }
  }

  _paintBridge(ctx) {
    const br = this.bridge;
    // Bridge deck as a downward-widening trapezoid (perspective toward viewer).
    ctx.fillStyle = "#6f6a62";
    ctx.beginPath();
    ctx.moveTo(br.cx - br.topHalf, br.topY);
    ctx.lineTo(br.cx + br.topHalf, br.topY);
    ctx.lineTo(br.cx + br.botHalf, br.botY);
    ctx.lineTo(br.cx - br.botHalf, br.botY);
    ctx.closePath();
    ctx.fill();

    // Slabs across the deck.
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 2;
    const rows = 8;
    for (let i = 1; i < rows; i++) {
      const tt = i / rows;
      const y = LW.util.lerp(br.topY, br.botY, tt);
      const half = LW.util.lerp(br.topHalf, br.botHalf, tt);
      ctx.beginPath();
      ctx.moveTo(br.cx - half, y);
      ctx.lineTo(br.cx + half, y);
      ctx.stroke();
    }
    // Deck highlight strip
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.moveTo(br.cx - br.topHalf * 0.4, br.topY);
    ctx.lineTo(br.cx + br.topHalf * 0.4, br.topY);
    ctx.lineTo(br.cx + br.botHalf * 0.4, br.botY);
    ctx.lineTo(br.cx - br.botHalf * 0.4, br.botY);
    ctx.closePath();
    ctx.fill();

    // Heavy side rails.
    ctx.fillStyle = "#534e47";
    ctx.beginPath();
    ctx.moveTo(br.cx - br.topHalf - 6, br.topY);
    ctx.lineTo(br.cx - br.topHalf, br.topY);
    ctx.lineTo(br.cx - br.botHalf, br.botY);
    ctx.lineTo(br.cx - br.botHalf - 12, br.botY);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(br.cx + br.topHalf + 6, br.topY);
    ctx.lineTo(br.cx + br.topHalf, br.topY);
    ctx.lineTo(br.cx + br.botHalf, br.botY);
    ctx.lineTo(br.cx + br.botHalf + 12, br.botY);
    ctx.closePath();
    ctx.fill();

    // A sliver of city rooftops at the very bottom (what we defend).
    ctx.fillStyle = "#3b2f4a";
    ctx.fillRect(0, this.H - 26, this.W, 26);
    ctx.fillStyle = "#6a4f7a";
    for (let x = 6; x < this.W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, this.H - 26);
      ctx.lineTo(x + 14, this.H - 40);
      ctx.lineTo(x + 28, this.H - 26);
      ctx.closePath();
      ctx.fill();
    }
  }

  /* ---- Per-frame ------------------------------------------------------ */

  renderBackground(ctx) {
    ctx.drawImage(this.bg, 0, 0);
  }

  update(dt) {
    this.t += dt;
  }

  // Animated bits + atmospheric overlays drawn on top of the entities.
  renderForeground(ctx) {
    // Banners on the gate towers (gentle wave).
    this._banner(ctx, this.gate.x - 46, this.wallTop - 4, "#b03a52");
    this._banner(ctx, this.gate.x + 46, this.wallTop - 4, "#3a72b0");

    // Torch flames flanking the gate.
    this._torch(ctx, this.gate.x - 44, this.gate.top + 18);
    this._torch(ctx, this.gate.x + 44, this.gate.top + 18);

    // Top fog so spawns fade in from the forest.
    const fg = ctx.createLinearGradient(0, 0, 0, 90);
    fg.addColorStop(0, "rgba(206,214,222,0.5)");
    fg.addColorStop(1, "rgba(206,214,222,0)");
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, this.W, 90);

    // Vignette for focus.
    const vg = ctx.createRadialGradient(this.W / 2, this.H * 0.46, this.H * 0.3, this.W / 2, this.H * 0.5, this.H * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.28)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.W, this.H);
  }

  _banner(ctx, x, y, col) {
    const wave = Math.sin(this.t * 2 + x) * 2;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - 6, y);
    ctx.lineTo(x + 6, y);
    ctx.lineTo(x + 6 + wave, y + 26);
    ctx.lineTo(x, y + 20);
    ctx.lineTo(x - 6 + wave, y + 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(x - 6, y, 12, 3);
  }

  _torch(ctx, x, y) {
    const f = 1 + Math.sin(this.t * 12 + x) * 0.18;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#ff8a2a";
    ctx.beginPath();
    ctx.ellipse(x, y, 3.2, 6 * f, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe06a";
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 1.8, 3.4 * f, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#ffb24a";
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
};
