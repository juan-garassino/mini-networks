// Pure geometry for the hybrid diorama (layout v2). Styling only: every
// position comes from lib/world; these helpers turn tiles and polylines into
// cut-paper shapes. No imports from other skins.
import { T, type Box, type Pt, type World } from "@/lib/world";

const f = (n: number) => (Math.round(n * 10) / 10).toString();
const fi = (n: number) => Math.round(n).toString();

/** Boundary loops of a tile set (px), collinear points dropped. */
function traceLoops(inSet: (x: number, y: number) => boolean, cols: number, rows: number, tile: number): Pt[][] {
  const out = new Map<string, [number, number][]>();
  const add = (ax: number, ay: number, bx: number, by: number) => {
    const k = `${ax},${ay}`;
    const l = out.get(k);
    if (l) l.push([bx, by]); else out.set(k, [[bx, by]]);
  };
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!inSet(x, y)) continue;
      if (!inSet(x, y - 1)) add(x, y, x + 1, y);
      if (!inSet(x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (!inSet(x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (!inSet(x - 1, y)) add(x, y + 1, x, y);
    }
  }
  const loops: Pt[][] = [];
  for (const [startKey, list] of out) {
    while (list.length) {
      const [sx, sy] = startKey.split(",").map(Number);
      const loop: [number, number][] = [[sx, sy]];
      let cur = list.pop()!;
      let guard = 0;
      while (!(cur[0] === sx && cur[1] === sy) && guard++ < 200000) {
        loop.push(cur);
        const next = out.get(`${cur[0]},${cur[1]}`);
        if (!next || !next.length) break;
        cur = next.pop()!;
      }
      const simp: Pt[] = [];
      const n = loop.length;
      for (let i = 0; i < n; i++) {
        const a = loop[(i - 1 + n) % n], b = loop[i], c = loop[(i + 1) % n];
        if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0) simp.push({ x: b[0] * tile, y: b[1] * tile });
      }
      if (simp.length >= 3) loops.push(simp);
    }
  }
  return loops;
}

/** Chaikin corner cutting on a closed loop: the scissor-cut coast. */
export function chaikin(pts: Pt[], iterations: number): Pt[] {
  let p = pts;
  for (let it = 0; it < iterations; it++) {
    const q: Pt[] = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      q.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      q.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    p = q;
  }
  return p;
}

export const loopsD = (loops: Pt[][]) => loops.map((l) => `M${l.map((p) => `${fi(p.x)} ${fi(p.y)}`).join(" ")}Z`).join("");

/** One smoothed outline per region: land minus river channels and bridge decks. */
export function regionOutlines(world: World): string[] {
  const { cols, rows, tile, terrain, regionOf } = world;
  return world.regions.map((r) => {
    const inSet = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= cols || y >= rows) return false;
      const i = y * cols + x;
      const t = terrain[i];
      return regionOf[i] === r.id && t !== T.SEA && t !== T.RIVER && t !== T.BRIDGE;
    };
    return loopsD(traceLoops(inSet, cols, rows, tile).map((l) => chaikin(l, 2)));
  });
}

/** A rounded blob inside a box (the secret islands, which have no tiles). */
export function islandD(b: Box, seed: number): string {
  const pts: Pt[] = [];
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    const wob = 1 + 0.08 * Math.sin(k * 2.3 + seed);
    pts.push({ x: cx + Math.cos(a) * (b.w / 2) * wob, y: cy + Math.sin(a) * (b.h / 2) * wob });
  }
  return loopsD([chaikin(pts, 2)]);
}

export function octagonD(cx: number, cy: number, r: number): string {
  const k = r * 0.4142;
  return `M${f(cx - k)} ${f(cy - r)}H${f(cx + k)}L${f(cx + r)} ${f(cy - k)}V${f(cy + k)}L${f(cx + k)} ${f(cy + r)}H${f(cx - k)}L${f(cx - r)} ${f(cy + k)}V${f(cy - k)}Z`;
}

export const lineD = (p: Pt[]) => (p.length ? `M${p.map((q) => `${f(q.x)} ${f(q.y)}`).join("L")}` : "");

/** Points every `step` px along a polyline, with the local direction. */
export function sampleEvery(points: Pt[], step: number): (Pt & { angle: number })[] {
  const out: (Pt & { angle: number })[] = [];
  let carry = step / 2;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    let d = carry;
    while (d <= L) {
      out.push({ x: a.x + ((b.x - a.x) * d) / L, y: a.y + ((b.y - a.y) * d) / L, angle: ang });
      d += step;
    }
    carry = d - L;
  }
  return out;
}

/** Five-point star polygon (the champion seal). */
export function starPts(cx: number, cy: number, r: number): string {
  const p: string[] = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.45 : r;
    p.push(`${f(cx + rr * Math.cos(a))},${f(cy + rr * Math.sin(a))}`);
  }
  return p.join(" ");
}

/** Offset every point of a route perpendicular to its course by off(t). */
export function bendRoute(points: Pt[], off: (t: number) => number): Pt[] {
  if (points.length < 2) return points;
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const L = cum[cum.length - 1] || 1;
  // resample densely so the bend is smooth
  const dense: Pt[] = [];
  const N = Math.max(24, Math.round(L / 12));
  let j = 1;
  for (let k = 0; k <= N; k++) {
    const s = (k / N) * L;
    while (j < cum.length - 1 && cum[j] < s) j++;
    const a = points[j - 1], b = points[j];
    const seg = cum[j] - cum[j - 1] || 1;
    const u = (s - cum[j - 1]) / seg;
    const x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u;
    const nx = -(b.y - a.y) / seg, ny = (b.x - a.x) / seg;
    const o = off(k / N);
    dense.push({ x: x + nx * o, y: y + ny * o });
  }
  return dense;
}
