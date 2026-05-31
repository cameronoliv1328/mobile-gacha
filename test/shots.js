/* Playwright screenshot + console-error harness for Last Wall.
 * Renders the real game in Chromium and captures every screen.
 * Requires Playwright + a chromium build:  npx playwright install chromium
 * Usage:  node test/shots.js   (output dir overridable via LW_SHOTS_DIR)     */
"use strict";
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

function loadPlaywright() {
  try { return require("playwright"); } catch (e) {}
  try {
    const g = execSync("npm root -g").toString().trim();
    return require(path.join(g, "playwright"));
  } catch (e) {}
  console.error("Playwright not found. Run: npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}
const { chromium } = loadPlaywright();

const OUT = process.env.LW_SHOTS_DIR || path.resolve(__dirname, "..", "screenshots");
fs.mkdirSync(OUT, { recursive: true });
const URL = "file://" + path.resolve(__dirname, "..", "index.html");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

  const shot = async (name) => { await page.screenshot({ path: path.join(OUT, name + ".png") }); console.log("shot:", name); };

  await page.goto(URL, { waitUntil: "load" });
  await sleep(400);
  await shot("01-menu");

  // Battle
  await page.locator(".menu-buttons .btn").first().click();
  await sleep(300);
  await shot("02-campaign");
  await page.locator(".city-node").first().click();
  await sleep(1600);
  await shot("03-battle-early");
  await sleep(3200);
  await shot("04-battle-mid");
  try {
    await page.waitForSelector(".upgrade-panel.show", { timeout: 30000 });
    await sleep(300);
    await shot("05-upgrade-panel");
  } catch (e) { console.log("(upgrade panel: " + e.message.split("\n")[0] + ")"); }
  try {
    await page.evaluate(() => LW.app.ui._onVictory({ waveReward: { gold: 120, crystals: 1 }, cityReward: { bonusGold: 260, epicCrystals: 1, unlockedCity: 1 } }));
    await sleep(400);
    await shot("05b-victory");
    await page.evaluate(() => LW.app.ui._onDefeat());
    await sleep(400);
    await shot("05c-defeat");
  } catch (e) { console.log("(result overlay: " + e.message.split("\n")[0] + ")"); }

  // Inject a demo save so the ability/synergy UI is populated, then show meta.
  await page.goto(URL, { waitUntil: "load" });
  await sleep(300);
  await page.evaluate(() => {
    const g = LW.app.game;
    g.state.gold = 3000;
    g.state.regularCrystals = 20;
    g.state.epicCrystals = 8;
    for (const id of ["fighter_brick", "archer_robin", "mage_ember", "fighter_ironhide", "archer_fletcher", "mage_frost", "mage_storm", "archer_hawkeye"]) {
      g.state.heroes[id] = g.state.heroes[id] || { level: 6, copies: 0 };
      g.state.heroes[id].level = 6;
    }
    g.state.heroes["fighter_brick"].copies = 4;
    g.state.heroes["fighter_ironhide"].copies = 4;
    g.state.heroes["archer_fletcher"].copies = 2;
    g.state.heroes["mage_frost"].copies = 4;
    g.state.team = { bridge: "fighter_ironhide", left: "archer_fletcher", right: "mage_frost" }; // mono Ice major synergy
    g.persist();
    LW.app.ui.enterMeta("menu");
  });
  await sleep(200);

  await page.locator(".menu-buttons .btn").nth(1).click(); // Summon
  await sleep(300);
  await shot("06-summon");
  try {
    await page.locator(".banner-card.regular .btn-primary").click();
    await sleep(400);
    await shot("07-summon-result");
    await page.locator(".summon-modal .btn-primary").click();
  } catch (e) { console.log("(summon result: " + e.message.split("\n")[0] + ")"); }

  await page.evaluate(() => LW.app.ui.enterMeta("roster"));
  await sleep(300);
  await shot("08-roster");
  try {
    await page.locator(".hero-card").first().click(); // Brick (4 copies -> all abilities)
    await sleep(400);
    await shot("09-hero-detail");
  } catch (e) { console.log("(hero detail: " + e.message.split("\n")[0] + ")"); }

  // Campaign with the mono-Ice synergy banner active.
  await page.evaluate(() => { LW.app.ui.closeModal(); LW.app.ui.enterMeta("campaign"); });
  await sleep(300);
  await shot("10-campaign-synergy");

  await browser.close();
  console.log("\n=== console / page errors (" + errors.length + ") ===");
  for (const e of errors.slice(0, 40)) console.log(e);
  if (!errors.length) console.log("none");
})().catch((e) => { console.error("HARNESS ERROR:", e); process.exit(1); });
