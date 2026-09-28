// Polyline helpers shared by every skin: rounded SVG paths and arc-length
// sampling (critter walks, tensor-blob parades).
import type { Pt } from "./types.ts";

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
