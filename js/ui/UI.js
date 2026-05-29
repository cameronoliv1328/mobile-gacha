/* =========================================================================
 * Last Wall — UI.js
 * All UMG-style screens (menu, campaign map, summon, roster, hero detail)
 * plus the in-battle HUD, between-wave upgrade panel and result overlays.
 * DOM-driven; battle visuals live on the canvas underneath.
 * ========================================================================= */
window.LW = window.LW || {};

LW.UI = class UI {
  constructor(app, game) {
    this.app = app;
    this.game = game;
    this.el = LW.util.el;

    this.uiRoot = document.getElementById("ui-root");
    this.battleLayer = document.getElementById("battle-layer");
    this.battleHud = document.getElementById("battle-hud");
    this.battleOverlay = document.getElementById("battle-overlay");
    this.modalRoot = document.getElementById("modal-root");
    this.toastRoot = document.getElementById("toast-root");

    this.screen = "menu";
    this.hudRefs = null;

    // Re-render meta screens when currencies/roster change.
    this.game.on("change", () => {
      if (this.app.mode !== "battle") this.render();
      this._refreshCurrencyBars();
    });
  }

  /* ===================================================================== *
   *  Navigation
   * ===================================================================== */

  enterMeta(screen) {
    this.app.mode = "meta";
    this.battleLayer.classList.add("hidden");
    this.uiRoot.classList.remove("hidden");
    LW.util.clear(this.battleOverlay);
    if (screen) this.screen = screen;
    this.render();
  }

  go(screen) {
    this.screen = screen;
    this.render();
  }

  render() {
    const root = LW.util.clear(this.uiRoot);
    let node;
    if (this.screen === "menu") node = this._menu();
    else if (this.screen === "campaign") node = this._campaign();
    else if (this.screen === "summon") node = this._summon();
    else if (this.screen === "roster") node = this._roster();
    else node = this._menu();
    root.appendChild(node);
  }

  /* ===================================================================== *
   *  Shared bits
   * ===================================================================== */

  _gem(kind) {
    return this.el("span", { class: "gem " + kind });
  }

  currencyBar() {
    const s = this.game.state;
    const chip = (kind, val, title) =>
      this.el("div", { class: "chip", title }, [this._gem(kind), this.el("span", { class: "chip-val", text: LW.util.formatNumber(val) })]);
    const bar = this.el("div", { class: "currency-bar" }, [
      chip("gold", s.gold, "Gold"),
      chip("reg", s.regularCrystals, "Regular Summon Crystals"),
      chip("epic", s.epicCrystals, "Epic Summon Crystals"),
    ]);
    bar._refresh = () => {
      bar.querySelectorAll(".chip-val")[0].textContent = LW.util.formatNumber(this.game.state.gold);
      bar.querySelectorAll(".chip-val")[1].textContent = LW.util.formatNumber(this.game.state.regularCrystals);
      bar.querySelectorAll(".chip-val")[2].textContent = LW.util.formatNumber(this.game.state.epicCrystals);
    };
    (this._currencyBars = this._currencyBars || []).push(bar);
    return bar;
  }

  _refreshCurrencyBars() {
    if (!this._currencyBars) return;
    this._currencyBars = this._currencyBars.filter((b) => b.isConnected);
    for (const b of this._currencyBars) b._refresh();
  }

  _elementBadge(elName, withName) {
    const E = LW.Config.ELEMENTS[elName];
    if (!E) return this.el("span");
    const kids = [this.el("span", { class: "elem-ic", text: E.icon })];
    if (withName) kids.push(this.el("span", { text: " " + E.name }));
    return this.el("span", { class: "elem-badge", style: "color:" + E.color + ";border-color:" + E.color }, kids);
  }

  // Small dots showing how many duplicate-ability tiers are unlocked (0..3).
  _tierDots(id) {
    const tiers = this.game.heroes.unlockedTiers(id);
    const row = this.el("div", { class: "tier-dots" });
    for (let i = 0; i < 3; i++) row.appendChild(this.el("span", { class: "tdot" + (i < tiers ? " on" : "") + (i === 2 ? " ult" : "") }));
    return row;
  }

  _synergyBanner(syn) {
    syn = syn || this.game.heroes.teamSynergy();
    const wrap = this.el("div", { class: "synergy-banner tier-" + syn.tier });
    if (!syn || syn.tier === "none") {
      wrap.appendChild(this.el("span", { class: "syn-none", text: "No element synergy — match elements for a bonus" }));
      return wrap;
    }
    const E = LW.Config.ELEMENTS[syn.element];
    wrap.appendChild(this.el("span", { class: "syn-ic", style: "color:" + E.color, text: E.icon }));
    const head = syn.tier === "major" ? E.name + " ×3" : E.name + " ×2";
    wrap.appendChild(this.el("span", { class: "syn-txt", text: head + (syn.label ? " — " + syn.label.replace(/^.*— /, "") : "") }));
    const bonus =
      "+" + Math.round((syn.atkMult - 1) * 100) + "% ATK" + (syn.hpMult > 1 ? " · +" + Math.round((syn.hpMult - 1) * 100) + "% HP" : "");
    wrap.appendChild(this.el("span", { class: "syn-bonus", text: bonus }));
    return wrap;
  }

  header(title, onBack) {
    const kids = [];
    if (onBack) kids.push(this.el("button", { class: "btn-icon back", text: "‹", onclick: onBack }));
    kids.push(this.el("h2", { class: "screen-title", text: title }));
    kids.push(this.el("div", { class: "header-spacer" }));
    return this.el("div", { class: "screen-header" }, kids);
  }

  /* Canvas thumbnail of a hero, drawn with the same sprite painters. */
  heroThumb(def, size, owned) {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    c.className = "thumb";
    const ctx = c.getContext("2d");
    const rar = LW.Config.RARITY[def.rarity];
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, rar.color);
    g.addColorStop(1, "#1c2230");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size * 0.4);
    ctx.globalAlpha = 1;
    if (owned === false) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "bold " + size * 0.5 + "px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", size / 2, size / 2);
      return c;
    }
    const img = LW.Sprites.spriteFor(def.id);
    if (img) {
      const s = Math.min((size * 0.98) / img.width, (size * 0.98) / img.height);
      const w = img.width * s;
      const h = img.height * s;
      ctx.drawImage(img, size / 2 - w / 2, size - h - 1, w, h);
    } else {
      LW.Sprites.humanoid(ctx, {
        x: size / 2, y: size * 0.86, scale: size / 62, cls: def.class,
        primary: def.theme.primary, secondary: def.theme.secondary, trim: def.theme.trim, facing: 1, isHero: true, bob: 0,
      });
    }
    return c;
  }

  enemyThumb(def, size) {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    const img = LW.Sprites.spriteFor(def.id);
    if (img) {
      const s = Math.min((size * 0.96) / img.width, (size * 0.96) / img.height);
      const w = img.width * s;
      const h = img.height * s;
      ctx.drawImage(img, size / 2 - w / 2, size - h - 1, w, h);
    } else {
      LW.Sprites.enemy(ctx, {
        x: size / 2, y: size * 0.82, scale: (size / 80) * (def.isBoss ? 0.7 : 1.2),
        radius: def.radius, color: def.color, accent: def.accent, shape: def.shape, facing: 1, t: 0,
      });
    }
    return c;
  }

  toast(msg, kind) {
    const t = this.el("div", { class: "toast " + (kind || ""), text: msg });
    this.toastRoot.appendChild(t);
    setTimeout(() => t.classList.add("show"), 10);
    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 300);
    }, 2200);
  }

  modal(node, opts) {
    const wrap = this.el("div", { class: "modal-wrap" });
    const card = this.el("div", { class: "modal-card " + ((opts && opts.cls) || "") }, [node]);
    wrap.appendChild(card);
    if (!opts || opts.dismissable !== false) {
      wrap.addEventListener("click", (e) => {
        if (e.target === wrap) this.closeModal();
      });
    }
    LW.util.clear(this.modalRoot).appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add("show"));
    return wrap;
  }

  closeModal() {
    LW.util.clear(this.modalRoot);
  }

  /* ===================================================================== *
   *  Main menu
   * ===================================================================== */

  _menu() {
    const wrap = this.el("div", { class: "screen menu-screen" });
    wrap.appendChild(this.currencyBar());

    const title = this.el("div", { class: "title-block" }, [
      this.el("div", { class: "game-title", text: "LAST WALL" }),
      this.el("div", { class: "game-sub", text: "Hold the bridge. Defend the city." }),
    ]);
    wrap.appendChild(title);

    // Team showcase
    const team = this.game.heroes.getTeam();
    const showcase = this.el("div", { class: "team-showcase" });
    for (const [slot, label] of [["left", "Bastion"], ["bridge", "Bridge"], ["right", "Bastion"]]) {
      const id = team[slot];
      const def = id && LW.HeroData.byId(id);
      const cell = this.el("div", { class: "showcase-cell" + (slot === "bridge" ? " featured" : "") });
      if (def) {
        cell.appendChild(this.heroThumb(def, slot === "bridge" ? 92 : 76));
        cell.appendChild(this.el("div", { class: "showcase-name", text: def.name }));
      } else {
        cell.appendChild(this.el("div", { class: "showcase-empty", text: "—" }));
      }
      cell.appendChild(this.el("div", { class: "showcase-slot", text: label }));
      showcase.appendChild(cell);
    }
    wrap.appendChild(showcase);

    const menu = this.el("div", { class: "menu-buttons" }, [
      this.el("button", { class: "btn btn-primary big", html: "<span>⚔️ Campaign</span>", onclick: () => this.go("campaign") }),
      this.el("button", { class: "btn", html: "<span>✦ Summon</span>", onclick: () => this.go("summon") }),
      this.el("button", { class: "btn", html: "<span>🛡 Heroes</span>", onclick: () => this.go("roster") }),
    ]);
    wrap.appendChild(menu);

    const footer = this.el("div", { class: "menu-footer" }, [
      this.el("span", { text: "Cities cleared: " + (this.game.state.stats.citiesCleared || 0) + " / " + LW.Config.CITIES }),
      this.el("button", {
        class: "btn-text danger",
        text: "Reset Save",
        onclick: () => this._confirmReset(),
      }),
    ]);
    wrap.appendChild(footer);
    return wrap;
  }

  _confirmReset() {
    const body = this.el("div", {}, [
      this.el("h3", { text: "Reset all progress?" }),
      this.el("p", { class: "muted", text: "This permanently clears currencies, heroes and campaign progress." }),
      this.el("div", { class: "modal-actions" }, [
        this.el("button", { class: "btn", text: "Cancel", onclick: () => this.closeModal() }),
        this.el("button", {
          class: "btn btn-danger",
          text: "Reset",
          onclick: () => {
            this.game.hardReset();
            this.closeModal();
            this.go("menu");
            this.toast("Progress reset");
          },
        }),
      ]),
    ]);
    this.modal(body);
  }

  /* ===================================================================== *
   *  Campaign map
   * ===================================================================== */

  _campaign() {
    const wrap = this.el("div", { class: "screen campaign-screen" });
    wrap.appendChild(this.header("Campaign", () => this.go("menu")));
    wrap.appendChild(this.currencyBar());

    // Team strip
    wrap.appendChild(this._teamStrip());

    const list = this.el("div", { class: "city-list" });
    for (let i = 0; i < LW.Config.CITIES; i++) {
      const unlocked = this.game.isCityUnlocked(i);
      const done = this.game.isCityCompleted(i);
      const node = this.el("div", {
        class: "city-node" + (unlocked ? "" : " locked") + (done ? " done" : "") + (i === this.game.state.unlockedCity ? " current" : ""),
        onclick: unlocked ? () => this._launch(i) : () => this.toast("Clear the previous city first"),
      });
      node.appendChild(this.el("div", { class: "city-num", text: String(i + 1) }));
      const info = this.el("div", { class: "city-info" }, [
        this.el("div", { class: "city-name", text: LW.Levels.cityName(i) }),
        this.el("div", { class: "city-meta", text: LW.Config.WAVES_PER_CITY + " waves" + (done ? "  ·  ✓ cleared" : "") }),
      ]);
      node.appendChild(info);
      node.appendChild(this.el("div", { class: "city-status", text: unlocked ? (done ? "Replay" : "Battle ›") : "🔒" }));
      list.appendChild(node);
    }
    wrap.appendChild(list);
    return wrap;
  }

  _teamStrip() {
    const team = this.game.heroes.getTeam();
    const strip = this.el("div", { class: "team-strip" });
    const slots = [
      ["bridge", "Bridge · Fighter"],
      ["left", "Left Bastion"],
      ["right", "Right Bastion"],
    ];
    for (const [slot, label] of slots) {
      const id = team[slot];
      const def = id && LW.HeroData.byId(id);
      const cell = this.el("div", { class: "team-cell", onclick: () => this.go("roster") });
      if (def) cell.appendChild(this.heroThumb(def, 50));
      else cell.appendChild(this.el("div", { class: "thumb empty", text: "+" }));
      cell.appendChild(this.el("div", { class: "team-label", text: label }));
      strip.appendChild(cell);
    }
    const ok = this.game.heroes.validateTeam();
    strip.appendChild(
      this.el("div", { class: "team-edit" }, [
        this.el("div", { class: "team-valid " + (ok ? "good" : "bad"), text: ok ? "Team ready" : "Team incomplete" }),
        this.el("button", { class: "btn-text", text: "Edit ›", onclick: () => this.go("roster") }),
      ])
    );
    return this.el("div", { class: "team-strip-wrap" }, [strip, this._synergyBanner()]);
  }

  _launch(cityIndex) {
    if (!this.game.heroes.validateTeam()) {
      this.toast("Set a Fighter on the bridge and 2 ranged heroes on the bastions");
      this.go("roster");
      return;
    }
    this.app.startBattle(cityIndex);
  }

  /* ===================================================================== *
   *  Summon
   * ===================================================================== */

  _summon() {
    const wrap = this.el("div", { class: "screen summon-screen" });
    wrap.appendChild(this.header("Summon", () => this.go("menu")));
    wrap.appendChild(this.currencyBar());

    wrap.appendChild(this._banner("regular"));
    wrap.appendChild(this._banner("epic"));

    wrap.appendChild(
      this.el("p", { class: "summon-note muted", text: "Duplicate heroes are converted to Gold." })
    );
    return wrap;
  }

  _banner(kind) {
    const isEpic = kind === "epic";
    const cfg = LW.Config.gacha[kind];
    const card = this.el("div", { class: "banner-card " + kind });
    card.appendChild(this.el("div", { class: "banner-title", text: isEpic ? "Epic Banner" : "Regular Banner" }));

    const rates = isEpic
      ? "Epic 75%  ·  Legendary 25%"
      : "Rare 85%  ·  Epic 15%";
    card.appendChild(this.el("div", { class: "banner-rates", text: rates }));

    if (isEpic) {
      const rem = this.game.summon.pityRemaining();
      card.appendChild(
        this.el("div", { class: "pity" }, [
          this.el("div", { class: "pity-label", text: "Guaranteed Legendary in " + rem + " pull" + (rem === 1 ? "" : "s") }),
          this._pityDots(),
        ])
      );
    }

    const cost = cfg.cost;
    const cur = isEpic ? "epic" : "reg";
    const owned = this.game.summon.currencyFor(kind);
    const actions = this.el("div", { class: "banner-actions" });
    const single = this.el("button", {
      class: "btn btn-primary",
      onclick: () => this._doSummon(kind, 1),
    }, [this.el("span", { text: "Summon ×1  " }), this._gem(cur), this.el("span", { text: " " + cost })]);
    const x10 = this.el("button", {
      class: "btn",
      onclick: () => this._doSummon(kind, 10),
    }, [this.el("span", { text: "Summon ×10  " }), this._gem(cur), this.el("span", { text: " " + cost * 10 })]);
    if (owned < cost) single.disabled = true;
    if (owned < cost * 10) x10.disabled = true;
    actions.appendChild(single);
    actions.appendChild(x10);
    card.appendChild(actions);
    card.appendChild(this.el("div", { class: "banner-owned", html: "You have " + LW.util.formatNumber(owned) + " " + (isEpic ? "Epic" : "Regular") + " crystals" }));
    return card;
  }

  _pityDots() {
    const max = LW.Config.gacha.epic.pity;
    const have = this.game.state.epicPity;
    const row = this.el("div", { class: "pity-dots" });
    for (let i = 0; i < max; i++) row.appendChild(this.el("span", { class: "pity-dot" + (i < have ? " on" : "") }));
    return row;
  }

  _doSummon(kind, n) {
    if (!this.game.summon.canRoll(kind)) {
      this.toast("Not enough crystals");
      return;
    }
    const results = this.game.summon.rollMany(kind, n);
    if (!results.length) return;
    this._showSummonResults(results);
  }

  _showSummonResults(results) {
    const grid = this.el("div", { class: "result-grid " + (results.length > 1 ? "multi" : "single") });
    let bestRank = 0;
    const rank = { Rare: 1, Epic: 2, Legendary: 3 };
    for (const r of results) {
      bestRank = Math.max(bestRank, rank[r.rarity]);
      const cell = this.el("div", { class: "result-cell rar-" + r.rarity.toLowerCase() });
      cell.appendChild(this.heroThumb(r.def, results.length > 1 ? 70 : 130));
      cell.appendChild(this.el("div", { class: "result-name", text: r.def.name }));
      cell.appendChild(
        this.el("div", { class: "result-rarity" }, [this.el("span", { text: r.rarity + (r.forced ? " ★pity " : " ") }), this._elementBadge(r.def.element)])
      );
      let tag = r.isNew ? "NEW!" : "Copy " + r.copies + " · +" + r.dupeGold + "g";
      let tagCls = "result-tag";
      if (r.unlockedTier) {
        tag = "Ability " + ["I", "II", "III"][r.unlockedTier - 1] + " unlocked!";
        tagCls += " ability";
      }
      cell.appendChild(this.el("div", { class: tagCls, text: tag }));
      grid.appendChild(cell);
    }
    const body = this.el("div", { class: "summon-result rar-best-" + bestRank }, [
      this.el("h3", { text: results.length > 1 ? results.length + "× Summon" : "Summon Result" }),
      grid,
      this.el("div", { class: "modal-actions" }, [
        this.el("button", { class: "btn btn-primary", text: "Great!", onclick: () => this.closeModal() }),
      ]),
    ]);
    this.modal(body, { cls: "summon-modal" });
    this.render();
  }

  /* ===================================================================== *
   *  Roster + hero detail
   * ===================================================================== */

  _roster() {
    const wrap = this.el("div", { class: "screen roster-screen" });
    wrap.appendChild(this.header("Heroes", () => this.go("menu")));
    wrap.appendChild(this.currencyBar());
    wrap.appendChild(this._teamStrip());

    for (const cls of ["Fighter", "Archer", "Mage"]) {
      wrap.appendChild(this.el("div", { class: "roster-section-title", text: cls + "s" }));
      const grid = this.el("div", { class: "roster-grid" });
      for (const def of LW.HeroData.byClass(cls)) {
        const owned = this.game.heroes.isOwned(def.id);
        const card = this.el("div", {
          class: "hero-card" + (owned ? "" : " unowned") + " rar-" + def.rarity.toLowerCase(),
          onclick: owned ? () => this._heroDetail(def.id) : null,
        });
        const eb = this._elementBadge(def.element);
        eb.classList.add("card-elem");
        card.appendChild(eb);
        card.appendChild(this.heroThumb(def, 64, owned));
        card.appendChild(this.el("div", { class: "hero-card-name", text: owned ? def.name : "???" }));
        if (owned) card.appendChild(this.el("div", { class: "hero-card-lv", text: "Lv " + this.game.heroes.level(def.id) }));
        card.appendChild(this.el("div", { class: "hero-card-rar", text: def.rarity }));
        if (owned) card.appendChild(this._tierDots(def.id));
        grid.appendChild(card);
      }
      wrap.appendChild(grid);
    }
    return wrap;
  }

  _heroDetail(id) {
    const def = LW.HeroData.byId(id);
    const stats = this.game.heroes.computeStats(id);
    const lvl = this.game.heroes.level(id);
    const team = this.game.heroes.getTeam();

    const body = this.el("div", { class: "hero-detail rar-" + def.rarity.toLowerCase() });
    const head = this.el("div", { class: "hd-head" }, [
      this.heroThumb(def, 110),
      this.el("div", { class: "hd-meta" }, [
        this.el("div", { class: "hd-name", text: def.name }),
        this.el("div", { class: "hd-class" }, [this.el("span", { text: def.rarity + " " + def.class + "  " }), this._elementBadge(def.element, true)]),
        this.el("div", { class: "hd-blurb muted", text: def.blurb }),
      ]),
    ]);
    body.appendChild(head);

    const statRow = (label, val) => this.el("div", { class: "stat-row" }, [this.el("span", { class: "stat-k", text: label }), this.el("span", { class: "stat-v", text: val })]);
    const grid = this.el("div", { class: "hd-stats" }, [
      statRow("Level", lvl + " / " + LW.Config.HERO_MAX_LEVEL),
      statRow("HP", String(stats.maxHP)),
      statRow("ATK", String(stats.atk)),
      statRow("Range", String(Math.round(stats.range))),
      statRow("Atk Speed", (1 / stats.attackInterval).toFixed(2) + "/s"),
      statRow("Support", "2× " + def.class + " (" + Math.round(LW.Config.SUPPORT_HP_PCT * 100) + "% HP / " + Math.round(LW.Config.SUPPORT_ATK_PCT * 100) + "% ATK)"),
    ]);
    body.appendChild(grid);

    // Duplicate special abilities (unlocked by collecting copies).
    const abil = this.el("div", { class: "abilities" });
    abil.appendChild(
      this.el("div", { class: "abil-head" }, [
        this.el("span", { text: "Duplicate Abilities" }),
        this.el("span", { class: "copies-count", text: "Copies " + this.game.heroes.copies(id) }),
      ])
    );
    for (const a of this.game.heroes.abilities(id)) {
      const row = this.el("div", { class: "abil-row" + (a.unlocked ? " unlocked" : "") + (a.tier === 3 ? " ultimate" : "") });
      row.appendChild(this.el("div", { class: "abil-tier", text: ["I", "II", "III"][a.tier - 1] }));
      row.appendChild(
        this.el("div", { class: "abil-mid" }, [
          this.el("div", { class: "abil-name", text: a.name + (a.tier === 3 ? "  ★" : "") }),
          this.el("div", { class: "abil-desc", text: a.desc }),
        ])
      );
      row.appendChild(this.el("div", { class: "abil-state", text: a.unlocked ? "✓" : a.copiesNeeded + " copies" }));
      abil.appendChild(row);
    }
    body.appendChild(abil);

    // Level up
    const cost = this.game.heroes.levelUpCost(id);
    if (cost != null) {
      const next = this.game.heroes.computeStats(id, lvl + 1);
      const luBtn = this.el("button", {
        class: "btn btn-primary",
        onclick: () => {
          if (this.game.heroes.levelUp(id)) {
            this.toast(def.name + " is now Lv " + this.game.heroes.level(id));
            this.closeModal();
            this._heroDetail(id);
          } else this.toast("Not enough gold");
        },
      }, [this.el("span", { text: "Level Up → Lv " + (lvl + 1) + "  (HP " + next.maxHP + " · ATK " + next.atk + ")  " }), this._gem("gold"), this.el("span", { text: " " + cost })]);
      if (this.game.state.gold < cost) luBtn.disabled = true;
      body.appendChild(luBtn);
    } else {
      body.appendChild(this.el("div", { class: "maxed", text: "★ Max Level" }));
    }

    // Deploy buttons
    const deploy = this.el("div", { class: "deploy-row" });
    if (def.class === "Fighter") {
      deploy.appendChild(this._deployBtn(id, "bridge", "Deploy to Bridge", team.bridge === id));
    } else {
      deploy.appendChild(this._deployBtn(id, "left", "Left Bastion", team.left === id));
      deploy.appendChild(this._deployBtn(id, "right", "Right Bastion", team.right === id));
    }
    body.appendChild(deploy);

    body.appendChild(this.el("div", { class: "modal-actions" }, [this.el("button", { class: "btn", text: "Close", onclick: () => this.closeModal() })]));
    this.modal(body, { cls: "hero-detail-modal" });
  }

  _deployBtn(id, slot, label, active) {
    return this.el("button", {
      class: "btn deploy-btn" + (active ? " active" : ""),
      text: active ? "✓ " + label : label,
      onclick: () => {
        this.game.heroes.setTeamSlot(slot, id);
        this.toast(LW.HeroData.byId(id).name + " deployed");
        this.closeModal();
        this._heroDetail(id);
      },
    });
  }

  /* ===================================================================== *
   *  Battle HUD
   * ===================================================================== */

  enterBattle(battle) {
    this.battle = battle;
    this.app.mode = "battle";
    this.uiRoot.classList.add("hidden");
    this.battleLayer.classList.remove("hidden");
    LW.util.clear(this.battleOverlay);
    this._buildHud();
    battle.on("phase", (p) => this._onPhase(p));
    battle.on("reward", (r) => this._onReward(r));
    battle.on("victory", (v) => this._onVictory(v));
    battle.on("defeat", () => this._onDefeat());
  }

  _buildHud() {
    const hud = LW.util.clear(this.battleHud);
    const wave = this.el("div", { class: "hud-wave" });
    const cityHpFill = this.el("div", { class: "cityhp-fill" });
    const cityHpText = this.el("span", { class: "cityhp-text" });
    const gold = this.el("span", { class: "chip-val", text: "0" });
    const speedBtn = this.el("button", { class: "btn-icon", text: "»", onclick: () => this.app.toggleSpeed() });
    const pauseBtn = this.el("button", { class: "btn-icon", text: "⏸", onclick: () => this.app.togglePause() });

    const top = this.el("div", { class: "hud-top" }, [
      this.el("div", { class: "hud-left" }, [this.el("div", { class: "hud-city", text: this.battle.cityName }), wave]),
      this.el("div", { class: "hud-right" }, [this.el("div", { class: "chip" }, [this._gem("gold"), gold]), speedBtn, pauseBtn]),
    ]);
    const cityHp = this.el("div", { class: "cityhp" }, [
      this.el("span", { class: "cityhp-label", text: "🏰" }),
      this.el("div", { class: "cityhp-bar" }, [cityHpFill]),
      cityHpText,
    ]);
    const synergy = this.el("div", { class: "hud-synergy", style: "display:none" });
    hud.appendChild(top);
    hud.appendChild(cityHp);
    hud.appendChild(synergy);
    this.hudRefs = { wave, cityHpFill, cityHpText, gold, speedBtn, pauseBtn, synergy, synShown: false };
  }

  updateBattleHUD() {
    if (!this.hudRefs || !this.battle) return;
    const h = this.battle.hud();
    this.hudRefs.wave.innerHTML =
      "Wave <b>" + h.wave + "</b> / " + h.totalWaves + (h.isBoss && h.phase === "fighting" ? ' <span class="boss-tag">BOSS</span>' : "");
    this.hudRefs.gold.textContent = LW.util.formatNumber(h.gold);
    const ratio = h.cityMaxHP > 0 ? h.cityHP / h.cityMaxHP : 0;
    this.hudRefs.cityHpFill.style.width = Math.max(0, ratio * 100) + "%";
    this.hudRefs.cityHpFill.style.background = ratio > 0.5 ? "#6fcf5a" : ratio > 0.25 ? "#e6c84a" : "#e0594b";
    this.hudRefs.cityHpText.textContent = h.cityHP + " / " + h.cityMaxHP;
    this.hudRefs.speedBtn.textContent = this.app.speed === 2 ? "»»" : "»";
    this.hudRefs.speedBtn.classList.toggle("active", this.app.speed === 2);

    // Synergy is constant for a battle — populate it once when available.
    if (!this.hudRefs.synShown && h.synergy && h.synergy.tier !== "none") {
      this.hudRefs.synShown = true;
      const E = LW.Config.ELEMENTS[h.synergy.element];
      const label = h.synergy.tier === "major" ? E.name + " Synergy" : E.name + " ×2";
      LW.util.clear(this.hudRefs.synergy);
      this.hudRefs.synergy.style.display = "";
      this.hudRefs.synergy.appendChild(this.el("span", { class: "hud-syn-ic", style: "color:" + E.color, text: E.icon }));
      this.hudRefs.synergy.appendChild(this.el("span", { text: " " + label }));
    }
  }

  _onPhase(p) {
    LW.util.clear(this.battleOverlay);
    if (p === "upgrade") this._showUpgradePanel();
  }

  _onReward(r) {
    if (r.kind === "wave") this.toast("Wave " + r.wave + " cleared!  +" + r.reward.gold + " gold  ·  +1 Crystal", "good");
  }

  /* ---- Between-wave upgrade panel ------------------------------------ */

  _showUpgradePanel() {
    const panel = this.el("div", { class: "panel upgrade-panel" });
    panel.appendChild(this.el("div", { class: "panel-title", text: "Wave " + (this.battle.waveIndex + 1) + " cleared" }));
    panel.appendChild(this.el("div", { class: "panel-sub", text: "Fortify, then send the next wave." }));

    const opts = this.el("div", { class: "upgrade-options" });
    const defs = [
      { type: "hero", icon: "🛡", name: "Upgrade Heroes" },
      { type: "wall", icon: "🧱", name: "Upgrade Wall" },
      { type: "turret", icon: "🎯", name: "Upgrade Turret" },
    ];
    const rebuild = () => {
      LW.util.clear(opts);
      for (const d of defs) {
        const cost = this.battle.upgradeCost(d.type);
        const afford = this.battle.canAfford(d.type);
        const btn = this.el("button", {
          class: "upgrade-opt" + (afford ? "" : " disabled"),
          onclick: () => {
            const res = this.battle.buyUpgrade(d.type);
            if (res.ok) {
              this.toast(d.name + " applied");
              rebuild();
              this._updatePanelGold(panel);
            } else this.toast("Not enough gold");
          },
        });
        btn.appendChild(this.el("div", { class: "uo-icon", text: d.icon }));
        btn.appendChild(this.el("div", { class: "uo-name", text: d.name }));
        btn.appendChild(this.el("div", { class: "uo-desc", text: this.battle.upgradeSummary(d.type) }));
        btn.appendChild(this.el("div", { class: "uo-cost" }, [this._gem("gold"), this.el("span", { text: " " + cost })]));
        opts.appendChild(btn);
      }
    };
    rebuild();
    panel.appendChild(opts);

    const gold = this.el("div", { class: "panel-gold" }, [this.el("span", { text: "Gold: " }), this._gem("gold"), this.el("span", { class: "pg-val", text: LW.util.formatNumber(this.game.state.gold) })]);
    panel.appendChild(gold);
    panel._goldVal = gold.querySelector(".pg-val");

    panel.appendChild(
      this.el("button", { class: "btn btn-primary big", text: "Continue → Wave " + (this.battle.waveIndex + 2), onclick: () => this.battle.continueToNextWave() })
    );
    this.battleOverlay.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add("show"));
  }

  _updatePanelGold(panel) {
    if (panel._goldVal) panel._goldVal.textContent = LW.util.formatNumber(this.game.state.gold);
  }

  /* ---- Result overlays ----------------------------------------------- */

  _onVictory(v) {
    const panel = this.el("div", { class: "panel result-panel victory" });
    panel.appendChild(this.el("div", { class: "result-banner", text: "City Defended!" }));
    panel.appendChild(this.el("div", { class: "result-city", text: this.battle.cityName }));
    const rew = this.el("div", { class: "result-rewards" }, [
      this.el("div", { class: "rr" }, [this._gem("gold"), this.el("span", { text: " +" + v.cityReward.bonusGold + " bonus gold" })]),
      this.el("div", { class: "rr" }, [this._gem("epic"), this.el("span", { text: " +" + v.cityReward.epicCrystals + " Epic Crystal" })]),
    ]);
    panel.appendChild(rew);
    const hasNext = this.battle.cityIndex + 1 < LW.Config.CITIES;
    const actions = this.el("div", { class: "result-actions" });
    if (hasNext) actions.appendChild(this.el("button", { class: "btn btn-primary big", text: "Next City ›", onclick: () => this.app.startBattle(this.battle.cityIndex + 1) }));
    actions.appendChild(this.el("button", { class: "btn", text: "Campaign", onclick: () => this.app.quitBattle("campaign") }));
    actions.appendChild(this.el("button", { class: "btn", text: "Summon", onclick: () => this.app.quitBattle("summon") }));
    panel.appendChild(actions);
    this.battleOverlay.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add("show"));
  }

  _onDefeat() {
    const panel = this.el("div", { class: "panel result-panel defeat" });
    panel.appendChild(this.el("div", { class: "result-banner", text: "The Wall Has Fallen" }));
    panel.appendChild(this.el("div", { class: "result-city", text: "Reached Wave " + (this.battle.waveIndex + 1) + " of " + LW.Config.WAVES_PER_CITY }));
    const actions = this.el("div", { class: "result-actions" }, [
      this.el("button", { class: "btn btn-primary big", text: "Retry", onclick: () => this.app.startBattle(this.battle.cityIndex) }),
      this.el("button", { class: "btn", text: "Campaign", onclick: () => this.app.quitBattle("campaign") }),
      this.el("button", { class: "btn", text: "Upgrade Heroes", onclick: () => this.app.quitBattle("roster") }),
    ]);
    panel.appendChild(actions);
    this.battleOverlay.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add("show"));
  }

  showPauseMenu() {
    const panel = this.el("div", { class: "panel pause-panel" }, [
      this.el("div", { class: "panel-title", text: "Paused" }),
      this.el("div", { class: "result-actions" }, [
        this.el("button", { class: "btn btn-primary", text: "Resume", onclick: () => this.app.togglePause() }),
        this.el("button", { class: "btn", text: "Restart City", onclick: () => this.app.startBattle(this.battle.cityIndex) }),
        this.el("button", { class: "btn", text: "Quit to Campaign", onclick: () => this.app.quitBattle("campaign") }),
      ]),
    ]);
    LW.util.clear(this.battleOverlay).appendChild(panel);
    requestAnimationFrame(() => panel.classList.add("show"));
  }

  hidePauseMenu() {
    if (this.battle && this.battle.phase !== "upgrade") LW.util.clear(this.battleOverlay);
  }
};
