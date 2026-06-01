/* =========================================================================
 * Last Wall — main.js
 * App bootstrap: owns the GameInstance + UI, drives the canvas render loop,
 * and manages the battle lifecycle (start / quit / pause / speed).
 * ========================================================================= */
window.LW = window.LW || {};

LW.App = class App {
  constructor() {
    LW.assets = LW.assets || {};
    // Optional painted battle map; BattleMap falls back to procedural art if
    // the file is missing or fails to load.
    if (LW.Config.MAP_IMAGE && !LW.assets.mapImage) {
      const mi = new Image();
      mi.src = LW.Config.MAP_IMAGE;
      LW.assets.mapImage = mi;
    }

    // Painted, animated tower frames keyed by tower type (archer/mage/guard).
    LW.assets.towers = LW.assets.towers || {};
    for (const key in LW.Config.TOWER_TYPES) {
      if (LW.assets.towers[key]) continue;
      LW.assets.towers[key] = (LW.Config.TOWER_TYPES[key].frames || []).map((src) => {
        const im = new Image();
        im.src = src;
        return im;
      });
    }

    this.game = new LW.GameInstance();
    this.ui = new LW.UI(this, this.game);

    // Preload painted character sprites; refresh meta thumbnails as they load.
    LW.assets.sprites = LW.assets.sprites || {};
    let rerenderQueued = false;
    const onSpriteLoad = () => {
      if (this.mode === "meta" && !rerenderQueued) {
        rerenderQueued = true;
        requestAnimationFrame(() => {
          rerenderQueued = false;
          if (this.mode === "meta") this.ui.render();
        });
      }
    };
    const loadSprite = (id) => {
      if (LW.assets.sprites[id]) return;
      const im = new Image();
      im.onload = onSpriteLoad;
      im.src = "assets/sprites/" + id + ".png";
      LW.assets.sprites[id] = im;
    };
    const spriteIds = new Set();
    for (const h of LW.HeroData.list) spriteIds.add(h.id);
    for (const e of LW.EnemyData.list) spriteIds.add(e.spriteId || e.id); // variants reuse art
    for (const id of spriteIds) loadSprite(id);

    this.canvas = document.getElementById("stage");
    this.ctx = this.canvas.getContext("2d");
    this.dpr = 1;
    this.cssW = LW.Config.WORLD_W;
    this.cssH = LW.Config.WORLD_H;
    this.fit = 1; // CSS px per world unit at zoom 1

    // Battle camera: a zoomed-in view the player can pan around the map.
    this.cam = { x: 0, y: 0, zoom: LW.Config.CAM_DEFAULT_ZOOM || 1.7 };

    this.mode = "meta";
    this.battle = null;
    this.paused = false;
    this.speed = 1;
    this.lastTs = 0;
    this.armedSkill = null; // hero position whose skill is being aimed
    this.aimX = LW.Config.WORLD_W / 2;
    this.aimY = LW.Config.WORLD_H / 2;

    // Pointer state for drag-to-pan vs tap-to-build.
    this._ptr = { down: false, dragging: false, sx: 0, sy: 0, lx: 0, ly: 0, camX: 0, camY: 0, moved: 0 };

    window.addEventListener("resize", () => this._resizeCanvas());
    this.canvas.addEventListener("pointerdown", (e) => this._onPointerDown(e));
    this.canvas.addEventListener("pointermove", (e) => this._onPointerMove(e));
    window.addEventListener("pointerup", (e) => this._onPointerUp(e));
    this.canvas.addEventListener("wheel", (e) => this._onWheel(e), { passive: false });
    this._loop = this._loop.bind(this);

    this.ui.enterMeta("menu");
    requestAnimationFrame(this._loop);
  }

  _resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    let w = rect.width;
    let h = rect.height;
    if (w < 2 || h < 2) {
      const app = document.getElementById("app").getBoundingClientRect();
      w = app.width;
      h = app.height;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.dpr = dpr;
    this.cssW = w;
    this.cssH = h;
    // Fit the world to the canvas (16:9 world in a 16:9 stage); cover so no bars.
    this.fit = Math.max(w / LW.Config.WORLD_W, h / LW.Config.WORLD_H);
    this._clampCam();
  }

  /* ---- Camera (zoom + pan) ------------------------------------------- */

  // CSS px per world unit at the current zoom.
  _viewScale() {
    return this.fit * this.cam.zoom;
  }

  // Keep the camera within the map bounds for the current zoom.
  _clampCam() {
    const vs = this._viewScale();
    const viewW = this.cssW / vs;
    const viewH = this.cssH / vs;
    const maxX = Math.max(0, LW.Config.WORLD_W - viewW);
    const maxY = Math.max(0, LW.Config.WORLD_H - viewH);
    this.cam.x = LW.util.clamp(this.cam.x, 0, maxX);
    this.cam.y = LW.util.clamp(this.cam.y, 0, maxY);
  }

  // Centre the camera on a world point (used at battle start).
  centerCam(wx, wy) {
    const vs = this._viewScale();
    this.cam.x = wx - this.cssW / vs / 2;
    this.cam.y = wy - this.cssH / vs / 2;
    this._clampCam();
  }

  setZoom(z, focusWX, focusWY) {
    const old = this.cam.zoom;
    const zoom = LW.util.clamp(z, LW.Config.CAM_MIN_ZOOM || 1, LW.Config.CAM_MAX_ZOOM || 2.6);
    if (zoom === old) return;
    // Keep the focus world point under the same screen spot while zooming.
    const fx = focusWX != null ? focusWX : this.cam.x + this.cssW / this._viewScale() / 2;
    const fy = focusWY != null ? focusWY : this.cam.y + this.cssH / this._viewScale() / 2;
    const sxBefore = (fx - this.cam.x) * this._viewScale();
    const syBefore = (fy - this.cam.y) * this._viewScale();
    this.cam.zoom = zoom;
    const vs = this._viewScale();
    this.cam.x = fx - sxBefore / vs;
    this.cam.y = fy - syBefore / vs;
    this._clampCam();
  }

  // Screen (client) px -> world coordinates, through the camera.
  _toWorld(e) {
    const rect = this.canvas.getBoundingClientRect();
    const vs = this._viewScale();
    return {
      x: this.cam.x + (e.clientX - rect.left) / vs,
      y: this.cam.y + (e.clientY - rect.top) / vs,
    };
  }

  // World -> on-stage CSS pixel position (for DOM overlays like the build menu).
  worldToScreen(wx, wy) {
    const vs = this._viewScale();
    return { x: (wx - this.cam.x) * vs, y: (wy - this.cam.y) * vs };
  }

  /* ---- Battle lifecycle ---------------------------------------------- */

  startBattle(cityIndex) {
    if (!this.game.heroes.validateTeam()) {
      this.ui.toast("Your team is incomplete");
      this.ui.enterMeta("roster");
      return;
    }
    this.battle = new LW.BattleManager(this.game, cityIndex);
    this.paused = false;
    this.speed = 1;
    this.armedSkill = null;
    this.ui.enterBattle(this.battle);
    this.battle.setSpeed(this.speed);
    this.battle.start();
    this._resizeCanvas();
    // Open zoomed in, centred on the map's action area.
    this.cam.zoom = LW.Config.CAM_DEFAULT_ZOOM || 1.7;
    const f = this.battle.map.getAnchor("Anchor_CameraFocus");
    this.centerCam(f.x, f.y);
    this.lastTs = performance.now();
  }

  quitBattle(screen) {
    this.battle = null;
    this.paused = false;
    this.ui.enterMeta(screen || "campaign");
  }

  togglePause() {
    if (!this.battle) return;
    if (this.battle.phase === "victory" || this.battle.phase === "defeat" || this.battle.phase === "upgrade") return;
    this.paused = !this.paused;
    if (this.paused) this.ui.showPauseMenu();
    else this.ui.hidePauseMenu();
  }

  toggleSpeed() {
    const opts = LW.Config.speedOptions;
    const i = opts.indexOf(this.speed);
    this.speed = opts[(i + 1) % opts.length];
    if (this.battle) this.battle.setSpeed(this.speed);
  }

  /* ---- Active-skill input -------------------------------------------- */

  _toWorld(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * LW.Config.WORLD_W,
      y: ((e.clientY - rect.top) / rect.height) * LW.Config.WORLD_H,
    };
  }

  // UI skill button tap: self-cast fires now; aimed skills enter aim mode.
  tapSkill(pos) {
    if (!this.battle) return;
    const h = this.battle.heroByPos(pos);
    if (!h || !h.skillReady) {
      this.armedSkill = null;
      return;
    }
    const p = h.skillParams();
    if (p.aim === "self") {
      this.battle.castHeroSkill(pos, h.x, h.y);
      this.armedSkill = null;
    } else {
      this.armedSkill = this.armedSkill === pos ? null : pos;
      this.aimX = h.x;
      this.aimY = h.y - 110;
    }
  }

  _clampAim(h, x, y) {
    const p = h.skillParams();
    const dx = x - h.x;
    const dy = y - h.y;
    const d = Math.hypot(dx, dy);
    if (p.range && d > p.range) return { x: h.x + (dx / d) * p.range, y: h.y + (dy / d) * p.range };
    return { x, y };
  }

  _onPointerDown(e) {
    if (this.mode !== "battle" || !this.battle) return;
    const p = this._ptr;
    p.down = true;
    p.dragging = false;
    p.moved = 0;
    p.sx = p.lx = e.clientX;
    p.sy = p.ly = e.clientY;
    p.camX = this.cam.x;
    p.camY = this.cam.y;
  }

  _onPointerMove(e) {
    const p = this._ptr;
    if (this.armedSkill) {
      const w = this._toWorld(e);
      this.aimX = w.x;
      this.aimY = w.y;
      return;
    }
    if (!p.down || this.mode !== "battle") return;
    const dx = e.clientX - p.sx;
    const dy = e.clientY - p.sy;
    p.moved = Math.max(p.moved, Math.hypot(dx, dy));
    if (p.moved > 6) {
      p.dragging = true;
      this.ui.closeTowerMenu();
      const vs = this._viewScale();
      this.cam.x = p.camX - dx / vs;
      this.cam.y = p.camY - dy / vs;
      this._clampCam();
    }
  }

  _onPointerUp(e) {
    const p = this._ptr;
    if (!p.down) return;
    p.down = false;
    if (this.mode !== "battle" || !this.battle || this.paused) { p.dragging = false; return; }
    if (p.dragging) { p.dragging = false; return; } // it was a pan, not a tap

    const w = this._toWorld(e);

    // Aiming a hero skill takes priority.
    if (this.armedSkill) {
      const h = this.battle.heroByPos(this.armedSkill);
      if (h) {
        const a = this._clampAim(h, w.x, w.y);
        this.battle.castHeroSkill(this.armedSkill, a.x, a.y);
      }
      this.armedSkill = null;
      return;
    }

    // Otherwise a tap selects a build plot or an existing tower (build/sell UI).
    const plotIdx = this.battle.plotAt(w.x, w.y, 24);
    if (plotIdx >= 0) this.ui.openTowerMenu(plotIdx);
    else this.ui.closeTowerMenu();
  }

  _onWheel(e) {
    if (this.mode !== "battle" || !this.battle) return;
    e.preventDefault();
    const w = this._toWorld(e);
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    this.setZoom(this.cam.zoom * factor, w.x, w.y);
    this.ui.closeTowerMenu();
  }

  _drawAim(ctx) {
    const h = this.battle.heroByPos(this.armedSkill);
    if (!h || !h.alive) {
      this.armedSkill = null;
      return;
    }
    const p = h.skillParams();
    const a = this._clampAim(h, this.aimX, this.aimY);
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    ctx.arc(h.x, h.y, p.range || p.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.strokeStyle = p.color || "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(a.x, a.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(a.x - 11, a.y);
    ctx.lineTo(a.x + 11, a.y);
    ctx.moveTo(a.x, a.y - 11);
    ctx.lineTo(a.x, a.y + 11);
    ctx.stroke();
    ctx.restore();
  }

  /* ---- Render loop ---------------------------------------------------- */

  _loop(ts) {
    const dt = Math.min(0.1, (ts - this.lastTs) / 1000 || 0);
    this.lastTs = ts;

    if (this.mode === "battle" && this.battle) {
      if (!this.paused) this.battle.update(dt);
      const ctx = this.ctx;
      // World -> canvas through the camera: scale by (fit*zoom*dpr), offset by cam.
      const s = this._viewScale() * this.dpr;
      ctx.setTransform(s, 0, 0, s, -this.cam.x * s, -this.cam.y * s);
      this.battle.render(ctx);
      if (this.armedSkill) this._drawAim(ctx);
      this.ui.updateBattleHUD();
    }
    requestAnimationFrame(this._loop);
  }
};

window.addEventListener("DOMContentLoaded", () => {
  LW.app = new LW.App();
});
