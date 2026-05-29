/* =========================================================================
 * Last Wall — headless test harness
 * Mocks just enough of the browser (DOM, canvas 2D ctx, localStorage) to load
 * the real game scripts and (1) simulate full battles and meta systems, and
 * (2) smoke-render every UI screen. Run with:  node test/headless.js
 * ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let assertions = 0;
function assert(cond, msg) {
  assertions++;
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
}

/* ---- Canvas 2D context stub (no-op for any draw call) ----------------- */
function makeCtx(canvas) {
  const grad = { addColorStop() {} };
  const base = {
    canvas,
    save() {},
    restore() {},
    measureText() { return { width: 10 }; },
    createLinearGradient() { return grad; },
    createRadialGradient() { return grad; },
    drawImage() {},
  };
  return new Proxy(base, {
    get(t, p) {
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}

/* ---- Minimal DOM element mock ---------------------------------------- */
class El {
  constructor(tag) {
    this.tagName = (tag || "div").toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.isConnected = true;
    this._cls = new Set();
    this._attrs = {};
    this._listeners = {};
    this.style = { cssText: "" };
    this._text = "";
    this._html = "";
    this.disabled = false;
    this.value = "";
    if (this.tagName === "CANVAS") {
      this.width = 0;
      this.height = 0;
      this._ctx = makeCtx(this);
      this.getContext = () => this._ctx;
    }
    const self = this;
    this.classList = {
      add: (...c) => c.forEach((x) => self._cls.add(x)),
      remove: (...c) => c.forEach((x) => self._cls.delete(x)),
      toggle: (c, on) => (on === undefined ? (self._cls.has(c) ? self._cls.delete(c) : self._cls.add(c)) : on ? self._cls.add(c) : self._cls.delete(c)),
      contains: (c) => self._cls.has(c),
    };
  }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get className() { return [...this._cls].join(" "); }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return this._text; }
  set innerHTML(v) { this._html = String(v); }
  get innerHTML() { return this._html; }
  get firstChild() { return this.children[0] || null; }
  setAttribute(k, v) { this._attrs[k] = v; }
  getAttribute(k) { return this._attrs[k]; }
  appendChild(c) { c.parentNode = this; c.isConnected = true; this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
  dispatch(t, ev) { (this._listeners[t] || []).forEach((f) => f(ev || { target: this })); }
  click() { this.dispatch("click", { target: this }); }
  getBoundingClientRect() { return { width: 540, height: 960, top: 0, left: 0 }; }
  _all(out) {
    for (const c of this.children) {
      if (c instanceof El) { out.push(c); c._all(out); }
    }
    return out;
  }
  _matches(sel) {
    if (sel.startsWith(".")) return this._cls.has(sel.slice(1));
    return this.tagName === sel.toUpperCase();
  }
  querySelectorAll(sel) {
    const token = sel.trim().split(/\s+/).pop();
    return this._all([]).filter((e) => e._matches(token));
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

class TextNode { constructor(t) { this.nodeType = 3; this.textContent = String(t); this.parentNode = null; } }

/* ---- Global environment ---------------------------------------------- */
const ids = {};
function getEl(id) { return (ids[id] = ids[id] || new El("div")); }
["app", "ui-root", "battle-layer", "battle-hud", "battle-overlay", "modal-root", "toast-root"].forEach(getEl);
ids["stage"] = new El("canvas");

const store = new Map();
global.window = global;
global.document = {
  createElement: (t) => new El(t),
  createTextNode: (t) => new TextNode(t),
  getElementById: (id) => getEl(id),
  addEventListener() {},
};
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 0;
global.devicePixelRatio = 1;
global.addEventListener = () => {};
global.setTimeout = setTimeout;

/* ---- Load scripts in index.html order -------------------------------- */
const FILES = [
  "js/util.js",
  "js/data/config.js",
  "js/data/heroes.js",
  "js/data/enemies.js",
  "js/data/levels.js",
  "js/core/SaveGame.js",
  "js/core/HeroCollection.js",
  "js/core/SummonManager.js",
  "js/core/GameInstance.js",
  "js/battle/Spline.js",
  "js/battle/Render.js",
  "js/battle/Effects.js",
  "js/battle/Projectile.js",
  "js/battle/Combatant.js",
  "js/battle/SupportUnit.js",
  "js/battle/Hero.js",
  "js/battle/Enemy.js",
  "js/battle/Turret.js",
  "js/battle/CityWall.js",
  "js/battle/BattleMap.js",
  "js/battle/BattleManager.js",
  "js/ui/UI.js",
  "js/main.js",
];
const root = path.resolve(__dirname, "..");
for (const f of FILES) {
  const code = fs.readFileSync(path.join(root, f), "utf8");
  vm.runInThisContext(code, { filename: f });
}
const LW = global.LW;
assert(LW && LW.GameInstance, "LW namespace loaded");

/* ===================================================================== *
 *  TIER 1 — Meta logic
 * ===================================================================== */
console.log("— meta systems —");
const game = new LW.GameInstance();
assert(game.heroes.ownedIds().length === 3, "starts with 3 heroes");
assert(game.heroes.validateTeam(), "default team valid");
assert(game.heroes.getTeam().bridge && LW.HeroData.byId(game.heroes.getTeam().bridge).class === "Fighter", "bridge is a Fighter");

// Stat scaling sanity
const s1 = game.heroes.computeStats("fighter_brick", 1);
const s10 = game.heroes.computeStats("fighter_brick", 10);
assert(s10.maxHP > s1.maxHP && s10.atk > s1.atk, "leveling raises stats");

// Leveling
game.state.gold = 1000;
const lvBefore = game.heroes.level("archer_robin");
assert(game.heroes.levelUp("archer_robin"), "level up succeeds with gold");
assert(game.heroes.level("archer_robin") === lvBefore + 1, "level incremented");
assert(game.state.gold < 1000, "gold spent on level up");

// Team rules
assert(!game.heroes.classAllowedAt("Fighter", "left"), "fighter not allowed on bastion");
assert(game.heroes.classAllowedAt("Mage", "left"), "mage allowed on bastion");
assert(!game.heroes.setTeamSlot("bridge", "archer_robin"), "cannot put archer on bridge");

// Regular gacha rates: Legendary must be impossible
game.state.regularCrystals = 400;
let rareCt = 0, epicCt = 0, legCt = 0;
for (let i = 0; i < 400; i++) {
  const r = game.summon.roll("regular");
  if (r.rarity === "Rare") rareCt++; else if (r.rarity === "Epic") epicCt++; else legCt++;
}
assert(legCt === 0, "regular banner yields no Legendary");
assert(rareCt > epicCt, "regular banner mostly Rare (" + rareCt + " vs " + epicCt + ")");

// Epic pity: a Legendary must appear at least every (pity+1) pulls.
game.state.epicCrystals = 1000;
game.state.epicPity = 0;
let sincelego = 0, maxGap = 0, pityHits = 0;
for (let i = 0; i < 300; i++) {
  const pityWasMax = game.state.epicPity >= LW.Config.gacha.epic.pity;
  const r = game.summon.roll("epic");
  if (pityWasMax) { assert(r.rarity === "Legendary", "pity forces Legendary"); pityHits++; }
  if (r.rarity === "Legendary") { maxGap = Math.max(maxGap, sincelego); sincelego = 0; }
  else sincelego++;
}
assert(maxGap <= LW.Config.gacha.epic.pity, "never exceed pity gap (maxGap=" + maxGap + ")");
assert(pityHits > 0, "pity actually triggered at least once");
console.log("  gacha ok — regular[R:" + rareCt + " E:" + epicCt + " L:" + legCt + "]  epic maxGap=" + maxGap + " pityHits=" + pityHits);

/* ===================================================================== *
 *  TIER 2 — Full battle simulation
 * ===================================================================== */
console.log("— battle simulation —");

function simulateCity(cityIndex, opts) {
  opts = opts || {};
  const g = new LW.GameInstance();
  g.state.gold = opts.gold != null ? opts.gold : 100000;
  if (opts.heroLevel) for (const id of g.heroes.ownedIds()) g.state.heroes[id].level = opts.heroLevel;
  const battle = new LW.BattleManager(g, cityIndex);
  battle.start();
  let buys = 0;
  const dt = 1 / 60;
  let safety = 0;
  let sawBlocked = false;
  const maxSteps = opts.maxSteps || 60 * 60 * 8; // up to 8 min of sim
  while (safety++ < maxSteps) {
    battle.update(dt);
    if (battle.phase === "upgrade") {
      for (const type of ["hero", "wall", "turret"]) {
        if (opts.buy !== false && battle.canAfford(type)) { battle.buyUpgrade(type); buys++; }
      }
      battle.continueToNextWave();
    }
    if (battle.enemies.some((e) => e.state === "blocked")) sawBlocked = true;
    if (battle.phase === "victory" || battle.phase === "defeat") break;
  }
  return { battle, buys, sawBlocked, steps: safety, won: battle.phase === "victory" };
}

// City 0 is winnable even with NO upgrades; enemies reach and are blocked at the bridge.
const base = simulateCity(0, { gold: 0, buy: false });
console.log("  city 0 (no upgrades): phase=" + base.battle.phase + " wave=" + (base.battle.waveIndex + 1) + " kills=" + base.battle.killCount + " blocked=" + base.sawBlocked);
assert(base.battle.killCount > 0, "enemies were killed");
assert(base.sawBlocked, "enemies were blocked at the bridge by the Fighter group");
assert(base.battle.phase === "victory", "city 0 winnable without upgrades");

// Wave + city rewards accrued from the winning run.
assert(base.battle.game.state.regularCrystals >= LW.Config.WAVES_PER_CITY, "earned a Regular Crystal per wave");
assert(base.battle.game.isCityCompleted(0), "city 0 marked complete");
assert(base.battle.game.state.unlockedCity >= 1, "next city unlocked");
assert(base.battle.game.state.epicCrystals > 0, "epic crystal granted on city clear");

// The between-wave upgrade path also works and wins.
const up = simulateCity(0, { gold: 100000, buy: true });
console.log("  city 0 (upgrades): phase=" + up.battle.phase + " buys=" + up.buys);
assert(up.battle.phase === "victory", "city 0 won via upgrade path");
assert(up.buys > 0, "between-wave upgrades were purchased");

// Defeat path: a late city with base heroes and no upgrades is lost — and the
// enemies engaged the bridge before breaking through to the city.
const lose = simulateCity(9, { gold: 0, buy: false });
console.log("  city 9 (base heroes, no upgrades): phase=" + lose.battle.phase + " wave=" + (lose.battle.waveIndex + 1));
assert(lose.battle.phase === "defeat", "final city lost with base heroes / no upgrades");
assert(lose.sawBlocked, "enemies engaged the bridge before breaching");
assert(lose.battle.cityHP === 0, "defeat happens at 0 City HP");

// Late-game is winnable with investment (leveled heroes + upgrades).
const late = simulateCity(9, { gold: 100000, buy: true, heroLevel: LW.Config.HERO_MAX_LEVEL });
console.log("  city 9 (lv10 + upgrades): phase=" + late.battle.phase);
assert(late.battle.phase === "victory", "final city winnable with full investment");

// City HP never goes negative; blockDistance/gateDistance sane.
assert(base.battle.cityHP >= 0, "city HP non-negative");
const r0 = base;
assert(r0.battle.blockDistance > r0.battle.gateDistance, "block point is past the gate");
assert(r0.battle.spline.length > 100, "spline has length");

/* ===================================================================== *
 *  TIER 3 — UI smoke render
 * ===================================================================== */
console.log("— ui smoke —");
const appStub = {
  mode: "meta",
  speed: 1,
  startBattle() {},
  quitBattle() {},
  togglePause() {},
  toggleSpeed() {},
};
const ui = new LW.UI(appStub, game);
ui.enterMeta("menu");
assert(getEl("ui-root").children.length > 0, "menu rendered");
for (const screen of ["campaign", "summon", "roster", "menu"]) ui.go(screen);
ui._heroDetail("fighter_brick"); // opens modal
assert(getEl("modal-root").children.length > 0, "hero detail modal opened");
ui.closeModal();

// Summon result modal
game.state.regularCrystals = 10;
ui._doSummon("regular", 1);
ui.closeModal();
game.state.epicCrystals = 10;
ui._doSummon("epic", 1);
ui.closeModal();

// Battle HUD + panels
const battle2 = new LW.BattleManager(game, 0);
battle2.start();
ui.enterBattle(battle2);
ui.updateBattleHUD();
ui._showUpgradePanel();
assert(getEl("battle-overlay").children.length > 0, "upgrade panel shown");
ui._onVictory({ waveReward: { gold: 100, crystals: 1 }, cityReward: { bonusGold: 260, epicCrystals: 1, unlockedCity: 1 } });
ui._onDefeat();
ui.showPauseMenu();
ui.toast("hello");

console.log("\nALL TESTS PASSED  (" + assertions + " assertions)");
