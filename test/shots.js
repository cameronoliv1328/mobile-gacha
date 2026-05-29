/* Playwright screenshot + console-error harness for Last Wall.
 * Renders the real game in Chromium and captures every screen.
 * Requires Playwright + a chromium build:  npx playwright install chromium
 * Usage:  node test/shots.js   (output dir overridable via LW_SHOTS_DIR)     */
"use strict";
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

// Resolve Playwright whether installed locally or globally.
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

  await page.goto(URL, { waitUntil: "load" });
  await sleep(400);
  const shot = async (name) => { await page.screenshot({ path: path.join(OUT, name + ".png") }); console.log("shot:", name); };

  await shot("01-menu");

  // Campaign
  await page.locator(".menu-buttons .btn").first().click();
  await sleep(300);
  await shot("02-campaign");

  // Start battle on city 1 (default team is valid).
  await page.locator(".city-node").first().click();
  await sleep(1500); // prep + first spawns
  await shot("03-battle-early");
  await sleep(3000);
  await shot("04-battle-mid");

  // Try to capture the between-wave upgrade panel.
  try {
    await page.waitForSelector(".upgrade-panel.show", { timeout: 30000 });
    await sleep(300);
    await shot("05-upgrade-panel");
  } catch (e) {
    console.log("(upgrade panel not captured: " + e.message.split("\n")[0] + ")");
  }

  // Synthetic victory / defeat overlays (visual confirmation of the panels).
  try {
    await page.evaluate(() => LW.app.ui._onVictory({ waveReward: { gold: 120, crystals: 1 }, cityReward: { bonusGold: 260, epicCrystals: 1, unlockedCity: 1 } }));
    await sleep(400);
    await shot("05b-victory");
    await page.evaluate(() => LW.app.ui._onDefeat());
    await sleep(400);
    await shot("05c-defeat");
  } catch (e) { console.log("(result overlay skip: " + e.message.split("\n")[0] + ")"); }

  // Fresh load for the meta screens.
  await page.goto(URL, { waitUntil: "load" });
  await sleep(300);
  await page.locator(".menu-buttons .btn").nth(1).click(); // Summon
  await sleep(300);
  await shot("06-summon");
  // Do a regular summon to show the result modal.
  try {
    await page.locator(".banner-card.regular .btn-primary").click();
    await sleep(400);
    await shot("07-summon-result");
    await page.locator(".summon-modal .btn-primary").click();
  } catch (e) { console.log("(summon result skip: " + e.message.split("\n")[0] + ")"); }

  await page.goto(URL, { waitUntil: "load" });
  await sleep(300);
  await page.locator(".menu-buttons .btn").nth(2).click(); // Heroes
  await sleep(300);
  await shot("08-roster");
  try {
    await page.locator(".hero-card").first().click();
    await sleep(400);
    await shot("09-hero-detail");
  } catch (e) { console.log("(hero detail skip: " + e.message.split("\n")[0] + ")"); }

  await browser.close();

  console.log("\n=== console / page errors (" + errors.length + ") ===");
  for (const e of errors.slice(0, 40)) console.log(e);
  if (!errors.length) console.log("none 🎉");
})().catch((e) => { console.error("HARNESS ERROR:", e); process.exit(1); });
