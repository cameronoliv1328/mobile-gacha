/* =========================================================================
 * Last Wall — Spline.js   (Spline_EnemyPath_Main)
 * Catmull-Rom spline through the path control points. Pre-samples the curve
 * with cumulative arc length so enemies can move by world distance and we
 * can map distance -> position / tangent cheaply.
 * ========================================================================= */
window.LW = window.LW || {};

LW.Spline = class Spline {
  constructor(points, samplesPerSeg) {
    this.cp = points;
    this.samples = []; // [{ x, y, d }]
    this._build(samplesPerSeg || 26);
    this.length = this.samples.length ? this.samples[this.samples.length - 1].d : 0;
  }

  _cr(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return {
      x:
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y:
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    };
  }

  _build(spp) {
    const P = this.cp;
    const n = P.length;
    let d = 0;
    let prev = null;
    for (let k = 0; k < n - 1; k++) {
      const p0 = P[Math.max(0, k - 1)];
      const p1 = P[k];
      const p2 = P[k + 1];
      const p3 = P[Math.min(n - 1, k + 2)];
      const steps = k === n - 2 ? spp : spp; // uniform
      for (let j = 0; j <= steps; j++) {
        if (k > 0 && j === 0) continue; // avoid duplicate seam points
        const pt = this._cr(p0, p1, p2, p3, j / steps);
        if (prev) d += LW.util.dist(prev.x, prev.y, pt.x, pt.y);
        this.samples.push({ x: pt.x, y: pt.y, d });
        prev = pt;
      }
    }
  }

  // World position at arc-length distance.
  pointAt(distance) {
    const s = this.samples;
    if (!s.length) return { x: 0, y: 0 };
    const d = LW.util.clamp(distance, 0, this.length);
    // Linear scan is fine: sample count is small (a few hundred).
    let lo = 0;
    let hi = s.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (s[mid].d < d) lo = mid + 1;
      else hi = mid;
    }
    const b = s[lo];
    if (lo === 0) return { x: b.x, y: b.y };
    const a = s[lo - 1];
    const span = b.d - a.d || 1;
    const t = (d - a.d) / span;
    return { x: LW.util.lerp(a.x, b.x, t), y: LW.util.lerp(a.y, b.y, t) };
  }

  // Unit tangent (direction of travel) at a distance.
  tangentAt(distance) {
    const e = 2;
    const a = this.pointAt(distance - e);
    const b = this.pointAt(distance + e);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  fractionToDistance(f) {
    return LW.util.clamp(f, 0, 1) * this.length;
  }
};
