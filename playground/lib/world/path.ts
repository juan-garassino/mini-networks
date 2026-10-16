// Polyline helpers shared by every skin: rounded SVG paths and arc-length
// sampling (critter walks, tensor-blob parades).
import type { Chevron, Pt } from "./types.ts";

const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

/** Drop consecutive duplicates (zero-length segments). */
function dedupe(points: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    const q = out[out.length - 1];
    if (!q || Math.abs(q.x - p.x) > 1e-9 || Math.abs(q.y - p.y) > 1e-9) out.push(p);
  }
  return out;
}

/**
 * SVG path `d` through `points` with every interior corner rounded by a
 * quadratic curve of radius min(r, half of each adjacent segment).
 */
export function roundedD(points: Pt[], r: number): string {
  const pts = dedupe(points);
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  let d = `M${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const l1 = Math.hypot(b.x - a.x, b.y - a.y);
    const l2 = Math.hypot(c.x - b.x, c.y - b.y);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    if (rr <= 0.01) {
      d += ` L${fmt(b.x)} ${fmt(b.y)}`;
      continue;
    }
    const p1 = { x: b.x + ((a.x - b.x) / l1) * rr, y: b.y + ((a.y - b.y) / l1) * rr };
    const p2 = { x: b.x + ((c.x - b.x) / l2) * rr, y: b.y + ((c.y - b.y) / l2) * rr };
    d += ` L${fmt(p1.x)} ${fmt(p1.y)} Q${fmt(b.x)} ${fmt(b.y)} ${fmt(p2.x)} ${fmt(p2.y)}`;
  }
  const z = pts[pts.length - 1];
  d += ` L${fmt(z.x)} ${fmt(z.y)}`;
  return d;
}

/** Total px length of a polyline. */
export function polylineLength(points: Pt[]): number {
  let L = 0;
  for (let i = 1; i < points.length; i++) {
    L += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return L;
}

/**
 * Arc-length parameterisation: `at(t)` for t ∈ [0, 1] returns the point and
 * the heading (radians) of the segment it lies on.
 */
export function samplePolyline(points: Pt[]): {
  length: number;
  at: (t: number) => Pt & { angle: number };
} {
  const pts = dedupe(points);
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const length = cum[cum.length - 1] ?? 0;
  const at = (t: number) => {
    if (pts.length === 0) return { x: 0, y: 0, angle: 0 };
    if (pts.length === 1 || length === 0) return { x: pts[0].x, y: pts[0].y, angle: 0 };
    const s = Math.min(1, Math.max(0, t)) * length;
    let lo = 0;
    let hi = cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const a = pts[lo];
    const b = pts[hi];
    const seg = cum[hi] - cum[lo];
    const u = seg > 0 ? (s - cum[lo]) / seg : 0;
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  };
  return { length, at };
}

/**
 * Parallel offset of a polyline: every segment shifted `d` px along its LEFT
 * normal (y grows downward, so left of travel east is north), joined with
 * mitres (capped at 3·|d| for very sharp turns). d = 0 returns a copy.
 */
export function offsetPolyline(points: Pt[], d: number): Pt[] {
  const pts = dedupe(points);
  if (d === 0 || pts.length < 2) return pts.map((p) => ({ x: p.x, y: p.y }));
  const nrm = (a: Pt, b: Pt) => {
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    return { x: (b.y - a.y) / L, y: -(b.x - a.x) / L };
  };
  const out: Pt[] = [];
  const n0 = nrm(pts[0], pts[1]);
  out.push({ x: pts[0].x + n0.x * d, y: pts[0].y + n0.y * d });
  for (let i = 1; i < pts.length - 1; i++) {
    const a = nrm(pts[i - 1], pts[i]);
    const b = nrm(pts[i], pts[i + 1]);
    const mx = a.x + b.x;
    const my = a.y + b.y;
    const ml = Math.hypot(mx, my);
    if (ml < 1e-9) { out.push({ x: pts[i].x + a.x * d, y: pts[i].y + a.y * d }); continue; }
    // mitre length = d / cos(θ/2); cos(θ/2) = |a+b|/2
    const m = Math.min(Math.abs(d / (ml / 2)), 3 * Math.abs(d)) * Math.sign(d);
    out.push({ x: pts[i].x + (mx / ml) * m, y: pts[i].y + (my / ml) * m });
  }
  const z = pts.length - 1;
  const nz = nrm(pts[z - 1], pts[z]);
  out.push({ x: pts[z].x + nz.x * d, y: pts[z].y + nz.y * d });
  return out.map((p) => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 }));
}

/**
 * Direction cues every `spacing` px along a polyline (start → end), centred
 * so the run is symmetric, none within `endClear` px of either end. A path
 * too short for that gets a single chevron at its midpoint.
 */
export function chevronsAlong(points: Pt[], spacing: number, endClear: number): Chevron[] {
  const s = samplePolyline(points);
  if (s.length <= 0) return [];
  const usable = s.length - 2 * endClear;
  const out: Chevron[] = [];
  const at = (u: number) => {
    const p = s.at(u / s.length);
    return { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100, angle: Math.round(p.angle * 1e4) / 1e4 };
  };
  if (usable < spacing) {
    out.push(at(s.length / 2));
    return out;
  }
  const n = Math.floor(usable / spacing) + 1;
  const start = endClear + (usable - (n - 1) * spacing) / 2;
  for (let k = 0; k < n; k++) out.push(at(start + k * spacing));
  return out;
}
