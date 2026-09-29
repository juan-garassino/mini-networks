// Step 1 — regions (v3). The continent is a designed template (continent.ts):
// an authored C-shaped silhouette around a bay, partitioned among the families
// by speed-weighted growth from authored skeletons until each region's area
// matches its target; islet families become underwater reefs in the bay.
// Borders are 1-tile T.RIVER bands (2 tiles for straits) so roads cross only
// on bridges; each border's KIND (range/river/strait) is recorded.
import type { Border, BorderKind, IsletKind, Pt, Region, Shape, ZoneKind } from "./types.ts";
import { T } from "./types.ts";
import type { Graph } from "./graph.ts";
import { pairKey } from "./graph.ts";
import { AREA_BASE, AREA_MIN_MODELS, AREA_PER_MODEL } from "./constants.ts";
import { PRESETS, buildContinent } from "./continent.ts";
import type { Preset } from "./continent.ts";

export interface RegionGrid {
  cols: number;
  rows: number;
  regionOf: Int8Array;
  terrain: Uint8Array;
  regions: Region[];
  /** v3: kind per touching family pair (pairKey). */
  borderKind: Map<string, BorderKind>;
  /** v3: authored shapes in TILE coords (world.ts converts to px). */
  outline: Pt[];
  bay: Pt[];
  islets: { kind: IsletKind; poly: Pt[] }[];
  zones: { family: string; zone: ZoneKind; poly: Pt[] }[];
}

const N4X = [1, -1, 0, 0];
const N4Y = [0, 0, 1, -1];

export function targetTiles(n: number, areaMul: number): number {
  return Math.round(AREA_PER_MODEL * areaMul * Math.max(n, AREA_MIN_MODELS) + AREA_BASE);
}

/** v3: a seabed tile (sea tile with an owner). */
export const isReef = (rg: { terrain: Uint8Array; regionOf: Int8Array }, i: number) =>
  rg.regionOf[i] >= 0 && rg.terrain[i] === T.SEA;

export function growRegions(g: Graph, areaMul: number, warnings: string[], preset: Preset = PRESETS.pixel): RegionGrid {
  const fams = g.families;
  const targets = fams.map((f) => targetTiles(g.membersOf.get(f)!.length, areaMul));
  // an islet family (no cross-family edge) floats on its own island — unless
  // every family is an islet (then there is no continent to float beside)
  const floating = fams.map((f) => g.islet.has(f) && g.islet.size < fams.length);
  const c = buildContinent(fams.map((f, r) => ({ family: f, target: targets[r], floating: floating[r] })), preset, warnings);
  const { cols, rows, regionOf, land } = c;
  const n = cols * rows;

  // border kinds for every touching land pair (straits must run coast to coast)
  const touching = new Set<string>();
  for (let i = 0; i < n; i++) {
    const r = regionOf[i];
    if (r < 0 || !land[i]) continue;
    const x = i % cols;
    if (x + 1 < cols && regionOf[i + 1] >= 0 && regionOf[i + 1] !== r && land[i + 1]) touching.add(`${Math.min(r, regionOf[i + 1])}:${Math.max(r, regionOf[i + 1])}`);
    if (i + cols < n && regionOf[i + cols] >= 0 && regionOf[i + cols] !== r && land[i + cols]) touching.add(`${Math.min(r, regionOf[i + cols])}:${Math.max(r, regionOf[i + cols])}`);
  }
  const borderKind = new Map<string, BorderKind>();
  const kindOf = (a: number, b: number) => borderKind.get(pairKey(fams[a], fams[b]));
  for (const k of [...touching].sort()) {
    const [a, b] = k.split(":").map(Number);
    const key = pairKey(fams[a], fams[b]);
    borderKind.set(key, preset.borders[key] ?? "range");
  }

  const terrain = new Uint8Array(n);
  const sea = (x: number, y: number) => x < 0 || y < 0 || x >= cols || y >= rows || !land[y * cols + x];
  for (let i = 0; i < n; i++) {
    const r = regionOf[i];
    if (r < 0 || !land[i]) continue; // sea and reef stay T.SEA
    const x = i % cols;
    const y = (i - x) / cols;
    let river = false;
    let coast = false;
    for (let k = 0; k < 4; k++) {
      const nx = x + N4X[k];
      const ny = y + N4Y[k];
      if (sea(nx, ny)) { coast = true; continue; }
      const o = regionOf[ny * cols + nx];
      if (o > r) river = true;
      else if (o >= 0 && o < r && kindOf(o, r) === "strait") river = true; // straits are 2 tiles wide
    }
    terrain[i] = river ? T.RIVER : coast ? T.COAST : T.LAND;
  }
  // a strait that does not reach the sea at both ends is a river
  for (const [key, kind] of borderKind) {
    if (kind !== "strait") continue;
    const [fa, fb] = key.split("|");
    const a = fams.indexOf(fa), b = fams.indexOf(fb);
    const tiles: number[] = [];
    for (let i = 0; i < n; i++) {
      if (terrain[i] !== T.RIVER || (regionOf[i] !== a && regionOf[i] !== b)) continue;
      const x = i % cols, y = (i - x) / cols;
      for (let k = 0; k < 4; k++) {
        const nx = x + N4X[k], ny = y + N4Y[k];
        if (!sea(nx, ny) && regionOf[ny * cols + nx] === (regionOf[i] === a ? b : a)) { tiles.push(i); break; }
      }
    }
    const mouths = seaMouths(tiles, cols, rows, sea);
    if (mouths < 2) {
      borderKind.set(key, "river");
      for (const t of tiles) {
        const x = t % cols, y = (t - x) / cols;
        let keep = false;
        for (let k = 0; k < 4; k++) {
          const nx = x + N4X[k], ny = y + N4Y[k];
          if (!sea(nx, ny) && regionOf[ny * cols + nx] > regionOf[t]) keep = true;
        }
        if (!keep) terrain[t] = coastOrLand(t, cols, rows, sea);
      }
    }
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
    const sk = c.skeletons[r];
    return {
      family: f, id: r, islet: g.islet.has(f), underwater: c.underwater[r], floating: floating[r], tiles, targetTiles: targets[r],
      seed: sk.length ? { x: Math.floor(sk[0].x), y: Math.floor(sk[0].y) } : { x: 0, y: 0 }, skeleton: sk,
      setPiece: null, bbox: tiles ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } : { x: 0, y: 0, w: 0, h: 0 },
    };
  });
  return { cols, rows, regionOf, terrain, regions, borderKind, outline: c.outline, bay: c.bay, islets: c.islets, zones: c.zones };
}

/** Number of separate sea stretches touching a set of border tiles (a strait needs 2: one per end). */
function seaMouths(tiles: number[], cols: number, rows: number, sea: (x: number, y: number) => boolean): number {
  const touch = new Set<number>();
  for (const t of tiles) {
    const x = t % cols, y = (t - x) / cols;
    for (let k = 0; k < 4; k++) {
      const nx = x + N4X[k], ny = y + N4Y[k];
      if (sea(nx, ny) && nx >= 0 && ny >= 0 && nx < cols && ny < rows) touch.add(ny * cols + nx);
    }
  }
  // cluster the touching sea tiles (8-neighbour, within 3 tiles = same mouth)
  const list = [...touch].sort((a, b) => a - b);
  const group = new Map<number, number>();
  let g = 0;
  for (const s of list) {
    if (group.has(s)) continue;
    group.set(s, g);
    const st = [s];
    while (st.length) {
      const u = st.pop()!;
      const ux = u % cols, uy = (u - ux) / cols;
      for (const v of list) {
        if (group.has(v)) continue;
        const vx = v % cols, vy = (v - vx) / cols;
        if (Math.max(Math.abs(vx - ux), Math.abs(vy - uy)) <= 3) { group.set(v, g); st.push(v); }
      }
    }
    g++;
  }
  return g;
}

function coastOrLand(t: number, cols: number, rows: number, sea: (x: number, y: number) => boolean): number {
  const x = t % cols, y = (t - x) / cols;
  for (let k = 0; k < 4; k++) if (sea(x + N4X[k], y + N4Y[k])) return T.COAST;
  return T.LAND;
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

/**
 * v3: every natural border — its kind, its water/pass tiles (T.RIVER or
 * T.BRIDGE) and a px path along its longest run. Call after roads (bridges
 * replace river tiles).
 */
export function traceBorders(rg: RegionGrid, tile: number): Border[] {
  const { cols, rows, regionOf, terrain, regions } = rg;
  const n = cols * rows;
  const water = (i: number) => terrain[i] === T.RIVER || terrain[i] === T.BRIDGE;
  const out: Border[] = [];
  for (const [key, kind] of [...rg.borderKind].sort((p, q) => (p[0] < q[0] ? -1 : 1))) {
    const [fa, fb] = key.split("|");
    const a = regions.find((r) => r.family === fa)!.id;
    const b = regions.find((r) => r.family === fb)!.id;
    const tiles: number[] = [];
    const spine = new Uint8Array(n); // the lower-id side: present for every kind
    const lo = Math.min(a, b), hi = Math.max(a, b);
    for (let i = 0; i < n; i++) {
      const r = regionOf[i];
      if ((r !== a && r !== b) || !water(i)) continue;
      const other = r === a ? b : a;
      const x = i % cols, y = (i - x) / cols;
      let hit = false;
      for (let k = 0; k < 4; k++) {
        const nx = x + N4X[k], ny = y + N4Y[k];
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const u = ny * cols + nx;
        if (regionOf[u] === other && terrain[u] !== T.SEA) hit = true;
      }
      if (!hit) continue;
      tiles.push(i);
      if (r === lo && hi !== lo) spine[i] = 1;
    }
    const path = longestRun(spine, cols, rows).map((t) => ({ x: ((t % cols) + 0.5) * tile, y: (Math.floor(t / cols) + 0.5) * tile }));
    out.push({ a: fa, b: fb, kind, path, tiles });
  }
  return out;
}

/** The longest 8-connected chain through a tile set (two BFS sweeps: farthest-from-anywhere, then farthest-from-that). */
function longestRun(mask: Uint8Array, cols: number, rows: number): number[] {
  const n = cols * rows;
  let first = -1;
  let best: number[] = [];
  const seen = new Uint8Array(n);
  for (let s = 0; s < n; s++) {
    if (!mask[s] || seen[s]) continue;
    first = s;
    const sweep = (from: number) => {
      const par = new Map<number, number>([[from, -1]]);
      const q = [from];
      let last = from;
      for (let h = 0; h < q.length; h++) {
        const i = q[h];
        last = i;
        seen[i] = 1;
        const x = i % cols, y = (i - x) / cols;
        // orthogonal neighbours first so the chain prefers straight steps
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const u = ny * cols + nx;
          if (mask[u] && !par.has(u)) { par.set(u, i); q.push(u); }
        }
      }
      const path: number[] = [];
      for (let t = last; t !== -1; t = par.get(t)!) path.push(t);
      return path;
    };
    const far = sweep(first)[0];
    const run = sweep(far);
    if (run.length > best.length) best = run;
  }
  return best;
}

/**
 * v3: each region's land outline (px): the boundary of its largest land
 * component traced along tile edges, then simplified (Douglas–Peucker, ε = ½ tile).
 */
export function traceShapes(rg: RegionGrid, tile: number): Shape[] {
  const { cols, rows, regionOf, terrain } = rg;
  const out: Shape[] = [];
  for (const reg of rg.regions) {
    const inR = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < cols && y < rows && regionOf[y * cols + x] === reg.id && terrain[y * cols + x] !== T.SEA;
    // directed boundary edges (region on the left walking clockwise in screen coords), keyed by start corner
    const next = new Map<number, number[]>();
    const key = (x: number, y: number) => y * (cols + 1) + x;
    const add = (ax: number, ay: number, bx: number, by: number) => {
      const k = key(ax, ay);
      if (!next.has(k)) next.set(k, []);
      next.get(k)!.push(key(bx, by));
    };
    let start = -1;
    let bestLen = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (!inR(x, y)) continue;
      if (!inR(x, y - 1)) add(x, y, x + 1, y);
      if (!inR(x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (!inR(x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (!inR(x - 1, y)) add(x, y + 1, x, y);
    }
    const used = new Set<string>();
    let best: number[] = [];
    for (const [k0, outs] of [...next].sort((a, b) => a[0] - b[0])) {
      for (const k1 of outs) {
        if (used.has(`${k0}>${k1}`)) continue;
        const loop = [k0];
        let a = k0, b = k1;
        while (!used.has(`${a}>${b}`)) {
          used.add(`${a}>${b}`);
          loop.push(b);
          const cand = next.get(b) ?? [];
          const nb = cand.find((c) => !used.has(`${b}>${c}`));
          if (nb === undefined) break;
          a = b;
          b = nb;
        }
        if (loop.length > bestLen) { bestLen = loop.length; best = loop; start = k0; }
      }
    }
    if (start < 0) { out.push({ family: reg.family, poly: [] }); continue; }
    const pts = best.map((k) => ({ x: (k % (cols + 1)), y: Math.floor(k / (cols + 1)) }));
    out.push({ family: reg.family, poly: simplify(pts, 0.5).map((p) => ({ x: p.x * tile, y: p.y * tile })) });
  }
  return out;
}

function simplify(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const st: [number, number][] = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop()!;
    let far = -1;
    let fd = eps;
    const A = pts[a], B = pts[b];
    const L = Math.hypot(B.x - A.x, B.y - A.y);
    for (let i = a + 1; i < b; i++) {
      const P = pts[i];
      const d = L ? Math.abs((B.x - A.x) * (A.y - P.y) - (A.x - P.x) * (B.y - A.y)) / L : Math.hypot(P.x - A.x, P.y - A.y);
      if (d > fd) { fd = d; far = i; }
    }
    if (far >= 0) { keep[far] = 1; st.push([a, far], [far, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
