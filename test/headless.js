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
  "js/core/Synergy.js",
  "js/core/GameInstance.js",
  "js/battle/Spline.js",
  "js/battle/Render.js",
  "js/battle/Anim.js",
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

// Epic pity: while Legendaries remain in the pool, one must appear at least
// every (pity+1) pulls. (Once every Legendary is fully collected they retire
// from the pool and the banner can no longer award one — covered separately.)
game.state.epicCrystals = 1000;
game.state.epicPity = 0;
let sincelego = 0, maxGap = 0, pityHits = 0;
for (let i = 0; i < 300; i++) {
  const legendsLeft = game.summon.legendariesRemaining();
  const pityWasMax = game.state.epicPity >= LW.Config.gacha.epic.pity;
  const r = game.summon.roll("epic");
  if (legendsLeft > 0) {
    if (pityWasMax) { assert(r.rarity === "Legendary", "pity forces Legendary"); pityHits++; }
    if (r.rarity === "Legendary") { maxGap = Math.max(maxGap, sincelego); sincelego = 0; }
    else sincelego++;
  }
}
assert(maxGap <= LW.Config.gacha.epic.pity, "never exceed pity gap (maxGap=" + maxGap + ")");
assert(pityHits > 0, "pity actually triggered at least once");
console.log("  gacha ok — regular[R:" + rareCt + " E:" + epicCt + " L:" + legCt + "]  epic maxGap=" + maxGap + " pityHits=" + pityHits);

/* ---- Legendary retirement: a maxed Legendary leaves the wish pool ------- */
console.log("— legendary retirement —");
LW.SaveGame.clear();
const rg = new LW.GameInstance();
const maxC = rg.heroes.maxCopies();
assert(maxC === Math.max.apply(null, LW.Config.ABILITY_UNLOCKS), "maxCopies = last ability unlock");
const legends = LW.HeroData.list.filter((h) => h.rarity === "Legendary").map((h) => h.id);
assert(legends.length > 0, "there are Legendary heroes");

const legId = legends[0];
rg.heroes.addHero(legId); // own it (copies 0)
assert(!rg.heroes.isRetired(legId), "freshly owned legendary is not retired");
for (let i = 0; i < maxC; i++) rg.heroes.addHero(legId); // collect every copy
assert(rg.heroes.copies(legId) === maxC, "collected all copies of the legendary");
assert(rg.heroes.isMaxed(legId) && rg.heroes.isRetired(legId), "maxed legendary is retired");
assert(!rg.summon.availableOfRarity("Legendary").some((h) => h.id === legId), "retired legendary left the pool");

// It can never be pulled again: force many Legendary rolls; the maxed one must
// never reappear and its copy count must never exceed the max.
rg.state.epicCrystals = 100000;
for (let i = 0; i < 600; i++) {
  rg.state.epicPity = LW.Config.gacha.epic.pity; // force a Legendary roll
  const r = rg.summon.roll("epic");
  assert(r.def.id !== legId, "retired legendary was pulled again");
}
assert(rg.heroes.copies(legId) === maxC, "retired legendary copy count unchanged");

// With EVERY Legendary retired, a forced Legendary roll drops a rarity instead
// of ever producing a duplicate legend.
for (const id of legends) rg.state.heroes[id] = { level: 1, copies: maxC };
assert(rg.summon.legendariesRemaining() === 0, "all legendaries retired");
rg.state.epicPity = LW.Config.gacha.epic.pity;
const dg = rg.summon.roll("epic");
assert(dg.rarity !== "Legendary" && dg.downgraded, "forced legendary downgrades when pool empty");
for (const id of legends) assert(rg.heroes.copies(id) <= maxC, "no legendary exceeds max copies");
console.log("  legendary retirement ok");

/* ===================================================================== *
 *  Duplicate abilities + element synergy
 * ===================================================================== */
console.log("— abilities & synergy —");
LW.SaveGame.clear(); // fresh save (earlier gacha rolls persisted to the mock store)
const g2 = new LW.GameInstance();
const fid = "fighter_brick";
assert(g2.heroes.unlockedTiers(fid) === 0, "no abilities at 0 copies");
assert(!g2.heroes.isAttuned(fid), "not attuned at 0 copies");

// Copy thresholds 1 / 2 / 4 unlock tiers I / II / III.
g2.state.heroes[fid].copies = 1;
assert(g2.heroes.unlockedTiers(fid) === 1 && g2.heroes.isAttuned(fid), "tier I (Attunement) at 1 copy");
g2.state.heroes[fid].copies = 2;
assert(g2.heroes.unlockedTiers(fid) === 2, "tier II at 2 copies");
g2.state.heroes[fid].copies = 3;
assert(g2.heroes.unlockedTiers(fid) === 2, "still tier II at 3 copies");
g2.state.heroes[fid].copies = 4;
assert(g2.heroes.unlockedTiers(fid) === 3, "tier III at 4 copies");

const fmods = g2.heroes.abilityMods(fid);
assert(fmods.reflect > 0, "fighter tier II grants reflect");
assert(fmods.surviveOnce === true, "fighter tier III grants survive-once (most powerful)");
assert(fmods.hpMult > 1 && fmods.atkMult > 1, "fighter abilities raise stats");

// addHero on a duplicate increments copies and reports the unlock.
const beforeCopies = g2.heroes.copies("archer_robin");
const dup = g2.heroes.addHero("archer_robin");
assert(!dup.isNew && dup.copies === beforeCopies + 1, "duplicate increments copy count");
assert(dup.unlockedTier === 1, "first duplicate unlocks an ability tier");

g2.state.heroes["archer_robin"].copies = 4;
const amods = g2.heroes.abilityMods("archer_robin");
assert(amods.extraProjectiles >= 1, "archer tier II adds a projectile");
assert(amods.ult && amods.ult.type === "volley", "archer tier III is the Rain of Arrows ultimate");
g2.state.heroes["mage_ember"].copies = 2;
assert(g2.heroes.abilityMods("mage_ember").slowOnHit, "mage tier II slows on hit");

// Synergy from team elements.
const Syn = LW.Synergy;
const ice3 = Syn.compute([{ element: "Ice", attuned: false }, { element: "Ice", attuned: false }, { element: "Ice", attuned: false }]);
assert(ice3.tier === "major" && ice3.element === "Ice", "3 Ice heroes -> major Ice synergy");
assert(ice3.slowOnHit && ice3.atkMult > 1 && ice3.hpMult > 1, "Ice synergy: slow + team buff");
const fire3 = Syn.compute([{ element: "Fire", attuned: false }, { element: "Fire", attuned: false }, { element: "Fire", attuned: false }]);
assert(fire3.burnOnHit, "Fire synergy burns enemies");
const two = Syn.compute([{ element: "Nature", attuned: false }, { element: "Nature", attuned: false }, { element: "Fire", attuned: false }]);
assert(two.tier === "minor", "2 shared element -> minor synergy");
const none = Syn.compute([{ element: "Ice", attuned: false }, { element: "Fire", attuned: false }, { element: "Storm", attuned: false }]);
assert(none.tier === "none", "all different -> no synergy");
const attuned3 = Syn.compute([{ element: "Fire", attuned: true }, { element: "Fire", attuned: true }, { element: "Fire", attuned: true }]);
assert(attuned3.atkMult > fire3.atkMult, "Attunement (Tier I) increases synergy potency");
console.log("  abilities + synergy ok");

/* ===================================================================== *
 *  Combat 2.0 — affinities, status combos, archetypes
 * ===================================================================== */
console.log("— combat 2.0 —");
LW.SaveGame.clear();
const cg = new LW.GameInstance();
const cb = new LW.BattleManager(cg, 3);
cb.start();
const mk = (id) => new LW.Enemy(cb, LW.EnemyData.byId(id), 1);

// Elemental weakness / resistance.
let e = mk("slime"); let h = e.hp;
cb.damageEnemy(e, 100, null, { type: "magic", element: "Fire" }); // slime weak Fire
assert(Math.abs(h - e.hp - 150) <= 2, "weakness ~x1.5 (" + (h - e.hp) + ")");
e = mk("slime"); h = e.hp;
cb.damageEnemy(e, 100, null, { type: "physical", element: "Nature" }); // slime resists Nature
assert(Math.abs(h - e.hp - 60) <= 2, "resistance ~x0.6 (" + (h - e.hp) + ")");

// Armor vs damage type.
e = mk("knight"); h = e.hp;
cb.damageEnemy(e, 100, null, { type: "physical", element: "Neutral" });
assert(h - e.hp < 45, "armored knight shrugs physical (" + (h - e.hp) + ")");
e = mk("knight"); h = e.hp;
cb.damageEnemy(e, 100, null, { type: "magic", element: "Neutral" });
assert(h - e.hp > 140, "armored knight weak to magic (" + (h - e.hp) + ")");

// Status combos.
e = mk("goblin");
e.applyStatus("wet", 10);
e.applyStatus("chill", 10);
assert(e.isFrozen(), "wet + chill => frozen");
cb.damageEnemy(e, 40, null, { type: "physical", element: "Neutral" });
assert(!e.isFrozen(), "physical hit shatters frozen");
e = mk("goblin");
e.applyStatus("wet", 10);
e.applyStatus("burn", 100);
assert(e.burnT === 0, "wet douses fire");
e = mk("harpy"); // element Storm -> immune to its own status (shock)
e.applyStatus("shock", 50);
assert(e.shockT === 0, "enemy immune to its own element status");

// Flying bypasses the Fighter; only ranged can hit it.
const fly = mk("harpy");
assert(fly.flying && !fly.blockable, "harpy flies and is unblockable");
cb.enemies.length = 0;
cb.enemies.push(fly);
fly.splineDistance = cb.blockDistance;
fly._syncPos();
assert(cb.bestTargetInRange(fly.x, fly.y, 220, { melee: true }) !== fly, "melee cannot target a flyer");
assert(cb.bestTargetInRange(fly.x, fly.y, 220, {}) === fly, "ranged can target a flyer");

// Splitter spawns slimelets on death.
cb.enemies.length = 0;
const sp = mk("slime");
cb.enemies.push(sp);
sp.die();
assert(cb.enemies.some((x) => x.enemyId === "slimelet"), "slime splits into slimelets");

// Shield absorbs before HP.
e = mk("shieldbearer");
assert(e.shieldHP > 0, "shieldbearer has a shield");
const sh0 = e.shieldHP;
cb.damageEnemy(e, 30, null, { type: "physical", element: "Neutral" });
assert(e.shieldHP < sh0 && e.hp === e.maxHP, "physical chips shield, not HP");
console.log("  combat 2.0 ok");

/* ===================================================================== *
 *  TIER 2 — Full battle simulation
 * ===================================================================== */
console.log("— battle simulation —");

function simulateCity(cityIndex, opts) {
  opts = opts || {};
  LW.SaveGame.clear(); // always simulate from a clean save
  const g = new LW.GameInstance();
  g.state.gold = opts.gold != null ? opts.gold : 100000;
  if (opts.team) {
    for (const id of Object.values(opts.team)) if (!g.state.heroes[id]) g.state.heroes[id] = { level: 1, copies: 0 };
    g.state.team = Object.assign({}, opts.team);
  }
  for (const id of g.heroes.ownedIds()) {
    if (opts.heroLevel) g.state.heroes[id].level = opts.heroLevel;
    if (opts.copies != null) g.state.heroes[id].copies = opts.copies;
  }
  const battle = new LW.BattleManager(g, cityIndex);
  battle.start();
  if (opts.speed) battle.setSpeed(opts.speed);
  let buys = 0;
  const dt = 1 / 60;
  let safety = 0;
  let sawBlocked = false;
  const maxSteps = opts.maxSteps || 60 * 60 * 8; // up to 8 min of sim
  while (safety++ < maxSteps) {
    battle.update(dt);
    // Drive per-hero active skills (a player would fire them on cooldown).
    if (battle.phase === "fighting") {
      for (const pos of ["bridge", "left", "right"]) {
        const hh = battle.heroByPos(pos);
        if (hh && hh.skillReady) {
          const p = hh.skillParams();
          if (p.aim === "self") battle.castHeroSkill(pos, hh.x, hh.y);
          else {
            const tgt = battle.bestTargetInRange(hh.x, hh.y, p.range, {});
            if (tgt) battle.castHeroSkill(pos, tgt.x, tgt.y);
          }
        }
      }
    }
    if (battle.phase === "upgrade") {
      // Spend all earned gold (realistic when gold starts low).
      if (opts.buy !== false) {
        for (const type of ["hero", "wall", "turret"]) {
          while (battle.canAfford(type)) { battle.buyUpgrade(type); buys++; }
        }
      }
      battle.continueToNextWave();
    }
    if (battle.enemies.some((e) => e.state === "blocked")) sawBlocked = true;
    if (battle.phase === "victory" || battle.phase === "defeat") break;
  }
  return { battle, buys, sawBlocked, steps: safety, won: battle.phase === "victory" };
}

// City 0 is winnable even with NO upgrades; enemies reach and are blocked at the bridge.
// 8x speed substeps must produce the same outcome as 1x (no tunnelling).
const fast = simulateCity(0, { gold: 0, buy: false, speed: 8 });
assert(fast.battle.phase === "victory", "8x speed still clears city 0 (substep-stable)");

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

/* ---- Difficulty curve: challenging, with multiple power paths -------- */
console.log("— difficulty —");
const iceTeam = { bridge: "fighter_ironhide", left: "archer_fletcher", right: "mage_frost" };

// Base heroes cannot carry into the later cities (even with active skills).
const baseMid = simulateCity(6, { gold: 0, buy: false });
console.log("  city 7 — base heroes: " + baseMid.battle.phase + " w" + (baseMid.battle.waveIndex + 1));
assert(baseMid.battle.phase === "defeat", "base heroes can't clear a later city (investment required)");

// Leveling alone is not enough for the final city.
const lvlOnly = simulateCity(9, { gold: 0, buy: false, heroLevel: 10 });
console.log("  city 10 — lv10 only: " + lvlOnly.battle.phase + " w" + (lvlOnly.battle.waveIndex + 1));
assert(lvlOnly.battle.phase === "defeat", "leveling alone cannot clear the final city");

// Path A: leveling + upgrades bought from earned wave gold clears it.
const realUpg = simulateCity(9, { gold: 0, buy: true, heroLevel: 10 });
console.log("  city 10 — lv10 + earned upgrades: " + realUpg.battle.phase);
assert(realUpg.battle.phase === "victory", "final city winnable with leveling + earned upgrades");

// Path B: full investment (mono-element synergy + tier-3 abilities + upgrades).
const synFull = simulateCity(9, { gold: 0, buy: true, heroLevel: 10, team: iceTeam, copies: 4 });
console.log("  city 10 — full investment: " + synFull.battle.phase);
assert(synFull.battle.phase === "victory", "final city winnable with full investment");

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

// Full-screen hero inspection screen (portrait / stars / stats / skills).
ui._inspectHero("fighter_brick");
assert(ui.screen === "hero", "inspect switches to the hero screen");
assert(getEl("ui-root").querySelector(".hero-screen") != null, "hero inspection screen rendered");
assert(getEl("ui-root").querySelector(".hero-stars") != null, "hero screen shows rarity stars");
assert(getEl("ui-root").querySelector(".hero-stat-panel") != null, "hero screen shows the stats panel");
assert(getEl("ui-root").querySelector(".hero-skill-row") != null, "hero screen shows the skill row");
ui._heroDetail("fighter_brick"); // Details button opens the modal
assert(getEl("modal-root").children.length > 0, "details modal opens from the hero screen");
ui.closeModal();
ui.go("roster");

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
