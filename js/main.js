/* =========================================================================
 * Last Wall — main.js
 * App bootstrap: owns the GameInstance + UI, drives the canvas render loop,
 * and manages the battle lifecycle (start / quit / pause / speed).
 * ========================================================================= */
window.LW = window.LW || {};

LW.App = class App {
  constructor() {
    // Preload the painted battlefield illustration used by every battle.
    LW.assets = LW.assets || {};
    if (!LW.assets.battlefield) {
      const bf = new Image();
      bf.src = "assets/battlefield.jpg";
      LW.assets.battlefield = bf;
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
    for (const h of LW.HeroData.list) loadSprite(h.id);
    for (const e of LW.EnemyData.list) loadSprite(e.id);

    this.canvas = document.getElementById("stage");
    this.ctx = this.canvas.getContext("2d");
    this.sx = 1;
    this.sy = 1;

    this.mode = "meta";
    this.battle = null;
    this.paused = false;
    this.speed = 1;
    this.lastTs = 0;

    window.addEventListener("resize", () => this._resizeCanvas());
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
    this.speed = this.speed === 1 ? 2 : 1;
    if (this.battle) this.battle.setSpeed(this.speed);
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
      this.ui.updateBattleHUD();
    }
    requestAnimationFrame(this._loop);
  }
};

window.addEventListener("DOMContentLoaded", () => {
  LW.app = new LW.App();
});
