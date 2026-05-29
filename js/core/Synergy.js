/* =========================================================================
 * Last Wall — Synergy.js
 * Team-composition bonuses from the elements of the 3 deployed heroes.
 *   2 sharing an element -> minor synergy (team ATK).
 *   3 sharing an element -> major synergy (team ATK/HP + an element effect:
 *     Ice=slow, Fire=burn, Nature=regen, Storm=attack speed).
 * Potency scales with how many of the matching heroes are Attuned (Tier I
 * duplicate ability) — so the first duplicate ability empowers synergy.
 * ========================================================================= */
window.LW = window.LW || {};

LW.Synergy = {
  /* deployed: [{ element, attuned }] for the 3 placed heroes. */
  compute(deployed) {
    const S = LW.Config.SYNERGY;
    const out = {
      element: null, count: 0, tier: "none", label: "", attuned: 0, potency: 1,
      atkMult: 1, hpMult: 1, asMult: 1, regen: 0, slowOnHit: null, burnOnHit: null,
    };
    if (!deployed || !deployed.length) return out;

    const counts = {};
    for (const d of deployed) counts[d.element] = (counts[d.element] || 0) + 1;
    let domEl = null;
    let domCount = 0;
    for (const el in counts) {
      if (counts[el] > domCount) { domCount = counts[el]; domEl = el; }
    }
    out.element = domEl;
    out.count = domCount;
    if (domCount < S.minorCount) return out;

    const attuned = deployed.filter((d) => d.element === domEl && d.attuned).length;
    const potency = 1 + S.attunePotencyPerHero * attuned;
    out.attuned = attuned;
    out.potency = potency;
    const scale = (m) => 1 + (m - 1) * potency; // amplify the bonus delta

    if (domCount >= S.majorCount) {
      out.tier = "major";
      out.atkMult = scale(S.majorBase.atkMult);
      out.hpMult = scale(S.majorBase.hpMult);
      const em = S.majorByElement[domEl] || {};
      if (em.atkMult) out.atkMult *= scale(em.atkMult);
      if (em.hpMult) out.hpMult *= scale(em.hpMult);
      if (em.asMult) out.asMult = scale(em.asMult);
      if (em.regen) out.regen = em.regen * potency;
      if (em.slowOnHit) out.slowOnHit = em.slowOnHit;
      if (em.burnOnHit) out.burnOnHit = em.burnOnHit;
      out.label = em.label || domEl + " Synergy";
    } else {
      out.tier = "minor";
      out.atkMult = scale(S.minor.atkMult);
      out.label = domEl + " ×2 — +" + Math.round((out.atkMult - 1) * 100) + "% ATK";
    }
    return out;
  },
};
