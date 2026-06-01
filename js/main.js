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
    this.sx = 1;
    this.sy = 1;

    this.mode = "meta";
    this.battle = null;
    this.paused = false;
    this.speed = 1;
    this.lastTs = 0;
    this.armedSkill = null; // hero position whose skill is being aimed
    this.aimX = LW.Config.WORLD_W / 2;
    this.aimY = LW.Config.WORLD_H / 2;

    window.addEventListener("resize", () => this._resizeCanvas());
    this.canvas.addEventListener("pointerdown", (e) => this._onPointer(e));
    this.canvas.addEventListener("pointermove", (e) => {
      if (this.armedSkill) {
        const w = this._toWorld(e);
        this.aimX = w.x;
        this.aimY = w.y;
      }
    });
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
    this.sx = (w / LW.Config.WORLD_W) * dpr;
    this.sy = (h / LW.Config.WORLD_H) * dpr;
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

  _onPointer(e) {
    if (this.mode !== "battle" || !this.battle || this.paused || !this.armedSkill) return;
    const h = this.battle.heroByPos(this.armedSkill);
    if (h) {
      const w = this._toWorld(e);
      const a = this._clampAim(h, w.x, w.y);
      this.battle.castHeroSkill(this.armedSkill, a.x, a.y);
    }
    this.armedSkill = null;
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
      ctx.setTransform(this.sx, 0, 0, this.sy, 0, 0);
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
