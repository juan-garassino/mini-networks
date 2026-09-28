// Step 1 — regions. Simultaneous growth of every family from its authored
// seed out of one global min-heap (4-neighbour, so each region stays
// 4-connected), cost dist/sqrt(target) + noise, until each hits its target.
import type { Region } from "./types.ts";
import { T } from "./types.ts";
import type { Graph } from "./graph.ts";
import { pairKey } from "./graph.ts";
import {
  AREA_BASE, AREA_MIN_MODELS, AREA_PER_MODEL, COAST_WOBBLE, GRID_ASPECT, HOLE_FILL_MAX, ISLET_MOAT,
  LAND_FRACTION, NOISE_SCALE, NOISE_WEIGHT, PARTNER_SPOKE, SEA_MARGIN, SEED_FRACTIONS, SPARE_SLOTS,
} from "./constants.ts";
import { MinHeap } from "./grid.ts";
import { fbm, fnv1a } from "./rng.ts";

export interface RegionGrid {
  cols: number;
  rows: number;
  regionOf: Int8Array;
  terrain: Uint8Array;
  regions: Region[];
}

const N4X = [1, -1, 0, 0];
const N4Y = [0, 0, 1, -1];

export function targetTiles(n: number, areaMul: number): number {
  return Math.round(AREA_PER_MODEL * areaMul * Math.max(n, AREA_MIN_MODELS) + AREA_BASE);
}

export function growRegions(g: Graph, areaMul: number, warnings: string[]): RegionGrid {
  const fams = g.families;
  const targets = fams.map((f) => targetTiles(g.membersOf.get(f)!.length, areaMul));
  const total = targets.reduce((a, b) => a + b, 0);
  const cols = Math.round(Math.sqrt((total / LAND_FRACTION) * GRID_ASPECT));
  const rows = Math.round(cols / GRID_ASPECT);
  const n = cols * rows;
  const regionOf = new Int8Array(n).fill(-1);
  const islet = fams.map((f) => g.islet.has(f));

  let spare = 0;
  const seeds = fams.map((f) => {
    let fr = SEED_FRACTIONS[f];
    if (!fr) {
      fr = SPARE_SLOTS[spare++ % SPARE_SLOTS.length];
      warnings.push(`family "${f}" has no authored seed; using a spare islet slot`);
    }
    const clamp = (v: number, hi: number) => Math.min(hi - 1 - SEA_MARGIN, Math.max(SEA_MARGIN, v));
    return { x: clamp(Math.round(fr[0] * (cols - 1)), cols), y: clamp(Math.round(fr[1] * (rows - 1)), rows) };
  });
  const noiseSeed = fams.map((f) => fnv1a(`region:${f}`));
  const coastSeed = fnv1a("coast");
  const sqrtT = targets.map((t) => Math.sqrt(t));

  const claimable = (x: number, y: number, r: number) => {
    const frame = Math.min(x, y, cols - 1 - x, rows - 1 - y);
    if (frame < SEA_MARGIN) return false;
    if (frame < SEA_MARGIN + COAST_WOBBLE && frame < SEA_MARGIN + Math.round(COAST_WOBBLE * fbm(x, y, coastSeed, NOISE_SCALE))) return false;
    for (let dy = -ISLET_MOAT; dy <= ISLET_MOAT; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= rows) continue;
      for (let dx = -ISLET_MOAT; dx <= ISLET_MOAT; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= cols) continue;
        const o = regionOf[yy * cols + xx];
        if (o < 0 || o === r) continue;
        if (islet[r] || islet[o]) return false;
      }
    }
    return true;
  };

  const count = new Int32Array(fams.length);
  const pushed = new Int32Array(n); // bitmask of regions that queued the tile
  const heap = new MinHeap();
  // Skeleton: the seed plus a short spoke toward every partner family's seed
  // (families joined by a cross-family edge), so partners grow lobes that meet.
  const spokes: [number, number, number, number][][] = fams.map((f, r) => {
    const out: [number, number, number, number][] = [[seeds[r].x, seeds[r].y, seeds[r].x, seeds[r].y]];
    fams.forEach((o, q) => {
      if (q === r || !g.crossPairs.has(pairKey(f, o))) return;
      out.push([seeds[r].x, seeds[r].y,
        seeds[r].x + PARTNER_SPOKE * (seeds[q].x - seeds[r].x), seeds[r].y + PARTNER_SPOKE * (seeds[q].y - seeds[r].y)]);
    });
    return out;
  });
  const segDist = (px: number, py: number, s: [number, number, number, number]) => {
    const dx = s[2] - s[0];
    const dy = s[3] - s[1];
    const L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((px - s[0]) * dx + (py - s[1]) * dy) / L)) : 0;
    return Math.hypot(px - s[0] - t * dx, py - s[1] - t * dy);
  };
  const cost = (r: number, x: number, y: number) => {
    let d = Infinity;
    for (const s of spokes[r]) d = Math.min(d, segDist(x, y, s));
    return d / sqrtT[r] + NOISE_WEIGHT * fbm(x, y, noiseSeed[r], NOISE_SCALE);
  };
  fams.forEach((_, r) => {
    const t = seeds[r].y * cols + seeds[r].x;
    heap.push(0, r * 100000 + t, r * 100000 + t);
    pushed[t] |= 1 << r;
  });
  while (heap.size) {
    const v = heap.pop();
    const r = Math.floor(v / 100000);
    const t = v - r * 100000;
    if (regionOf[t] !== -1 || count[r] >= targets[r]) continue;
    const x = t % cols;
    const y = (t - x) / cols;
    if (!claimable(x, y, r)) continue;
    regionOf[t] = r;
    count[r]++;
    for (let k = 0; k < 4; k++) {
      const nx = x + N4X[k];
      const ny = y + N4Y[k];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const u = ny * cols + nx;
      if (regionOf[u] !== -1 || pushed[u] & (1 << r)) continue;
      pushed[u] |= 1 << r;
      heap.push(cost(r, nx, ny), r * 100000 + u, r * 100000 + u);
    }
  }

  fillHoles(cols, rows, regionOf, islet);

  const terrain = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = regionOf[i];
    if (r < 0) continue;
    const x = i % cols;
    const y = (i - x) / cols;
    let river = false;
    let coast = false;
    for (let k = 0; k < 4; k++) {
      const nx = x + N4X[k];
      const ny = y + N4Y[k];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) { coast = true; continue; }
      const o = regionOf[ny * cols + nx];
      if (o < 0) coast = true;
      else if (o > r) river = true;
    }
    terrain[i] = river ? T.RIVER : coast ? T.COAST : T.LAND;
  }

  const regions: Region[] = fams.map((f, r) => {
    let x0 = cols, y0 = rows, x1 = -1, y1 = -1, tiles = 0;
    for (let i = 0; i < n; i++) {
      if (regionOf[i] !== r) continue;
      tiles++;
      const x = i % cols;
      const y = (i - x) / cols;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    if (tiles === 0) warnings.push(`region "${f}" could not grow`);
    return {
      family: f, id: r, islet: islet[r], tiles, targetTiles: targets[r], seed: { ...seeds[r] },
      setPiece: null, bbox: tiles ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } : { x: 0, y: 0, w: 0, h: 0 },
    };
  });
  return { cols, rows, regionOf, terrain, regions };
}

/** Enclosed sea pockets (< HOLE_FILL_MAX tiles, not touching the frame) become land. */
function fillHoles(cols: number, rows: number, regionOf: Int8Array, islet: boolean[]) {
  const n = cols * rows;
  const seen = new Uint8Array(n);
  const q = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (regionOf[s] !== -1 || seen[s]) continue;
    let head = 0;
    let tail = 0;
    q[tail++] = s;
    seen[s] = 1;
    let frame = false;
    const votes = new Map<number, number>();
    while (head < tail) {
      const i = q[head++];
      const x = i % cols;
      const y = (i - x) / cols;
      for (let k = 0; k < 4; k++) {
        const nx = x + N4X[k];
        const ny = y + N4Y[k];
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) { frame = true; continue; }
        const u = ny * cols + nx;
        const o = regionOf[u];
        if (o >= 0) votes.set(o, (votes.get(o) ?? 0) + 1);
        else if (!seen[u]) { seen[u] = 1; q[tail++] = u; }
      }
    }
    if (frame || tail >= HOLE_FILL_MAX || votes.size === 0) continue;
    const ids = [...votes.keys()].sort((a, b) => a - b);
    if (ids.length > 1 && ids.some((r) => islet[r])) continue;
    let best = ids[0];
    for (const r of ids) if (votes.get(r)! > votes.get(best)!) best = r;
    for (let k = 0; k < tail; k++) regionOf[q[k]] = best;
  }
}

/** True when some tile of region a is 4-adjacent to a tile of region b. */
export function sharesBorder(cols: number, rows: number, regionOf: Int8Array, a: number, b: number): boolean {
  for (let i = 0; i < cols * rows; i++) {
    if (regionOf[i] !== a) continue;
    const x = i % cols;
    if (x + 1 < cols && regionOf[i + 1] === b) return true;
    if (x > 0 && regionOf[i - 1] === b) return true;
    if (i + cols < cols * rows && regionOf[i + cols] === b) return true;
    if (i - cols >= 0 && regionOf[i - cols] === b) return true;
  }
  return false;
}
