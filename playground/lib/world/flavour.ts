// R2-E world flavour — every element encodes data, all deterministic:
//   harbours   = where a family's composition boats dock (boats = compositions
//                touching the family)
//   cities     = atoms as cities; block count scales with direct children
//                (the biggest hubs are capitals)
//   mountains  = inked ranges along family borders no road/bridge crosses
//   islands    = the hidden "?" island (next-era models) and the ruins islet
//                (retired models), both OUTSIDE camera.world
// Placed after roads and labels, only on genuinely free tiles.
import type { TaxonomyResponse } from "../types.ts";
import type { Box, City, Harbour, Pt, SecretIsland } from "./types.ts";
import { T } from "./types.ts";
import type { Graph } from "./graph.ts";
import type { RegionGrid } from "./regions.ts";
import {
  CAPITAL_MIN_CHILDREN, CITY_BASE, CITY_INSET, CITY_MAX, CITY_PER_CHILD, CITY_RING, HARBOUR_RADIUS,
  HARBOUR_SPLIT_BOATS, MOUNTAIN_MIN, MOUNTAIN_ROAD_CLEAR, SECRET_GAP, SECRET_H, SECRET_MIN_W, SECRET_PITCH, TILE,
} from "./constants.ts";
import { DX, DY, bfs } from "./grid.ts";
import { fnv1a, hash2 } from "./rng.ts";

const N4X = [1, -1, 0, 0];
const N4Y = [0, 0, 1, -1];

/** 1 = a tile no flavour may use (footprints, set-pieces, roads, bridges, rivers, sea, label tiles). */
export function occupiedMask(rg: RegionGrid, labelMask: Uint8Array): Uint8Array {
  const { terrain } = rg;
  const m = new Uint8Array(terrain.length);
  for (let i = 0; i < m.length; i++) {
    const t = terrain[i];
    if (!(t === T.LAND || t === T.COAST) || labelMask[i]) m[i] = 1;
  }
  return m;
}

/** Cities around every atom. Marks the tiles it uses in `used`. */
export function placeCities(g: Graph, rg: RegionGrid, foot: Map<string, Box>, busy: Uint8Array, used: Uint8Array): City[] {
  const { cols, rows, regionOf } = rg;
  const out: City[] = [];
  const atoms = [...foot.keys()].filter((n) => g.atom.get(n)).sort();
  // biggest hubs claim their land first
  atoms.sort((a, b) => g.children.get(b)!.length - g.children.get(a)!.length || (a < b ? -1 : 1));
  for (const name of atoms) {
    const f = foot.get(name)!;
    const children = g.children.get(name)!.length;
    const want = Math.min(CITY_MAX, CITY_BASE + CITY_PER_CHILD * children);
    const own = regionOf[f.y * cols + f.x];
    const seed = fnv1a(`city:${name}`);
    const cands: { t: number; key: number }[] = [];
    for (let y = f.y - CITY_RING; y < f.y + f.h + CITY_RING; y++) {
      for (let x = f.x - CITY_RING; x < f.x + f.w + CITY_RING; x++) {
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const t = y * cols + x;
        if (busy[t] || used[t] || regionOf[t] !== own) continue;
        const ring = Math.max(f.x - x, x - (f.x + f.w - 1), f.y - y, y - (f.y + f.h - 1));
        cands.push({ t, key: ring + 0.9 * hash2(x, y, seed) });
      }
    }
    cands.sort((a, b) => a.key - b.key || a.t - b.t);
    const blocks: Box[] = [];
    for (const { t } of cands.slice(0, want)) {
      used[t] = 1;
      const x = t % cols;
      const y = (t - x) / cols;
      const r1 = hash2(x, y, seed ^ 0x51ed);
      const r2 = hash2(y, x, seed ^ 0x2c1b);
      const w = TILE - 2 * CITY_INSET - Math.floor(r1 * 5);
      const h = TILE - 2 * CITY_INSET - Math.floor(r2 * 5);
      const bx = x * TILE + CITY_INSET + Math.floor(hash2(x + 7, y, seed) * (TILE - 2 * CITY_INSET - w + 1));
      const by = y * TILE + CITY_INSET + Math.floor(hash2(x, y + 7, seed) * (TILE - 2 * CITY_INSET - h + 1));
      blocks.push({ x: bx, y: by, w, h });
    }
    out.push({ node: name, children, capital: children >= CAPITAL_MIN_CHILDREN, blocks });
  }
  out.sort((a, b) => (a.node < b.node ? -1 : 1));
  return out;
}

/** Boats per family: compositions whose members touch it. */
export function boatsPerFamily(g: Graph, tax: TaxonomyResponse): Map<string, number> {
  const out = new Map<string, number>(g.families.map((f) => [f, 0]));
  for (const c of tax.compositions ?? []) {
    const fams = new Set<string>();
    for (const m of c.composes) { const f = g.family.get(m); if (f) fams.add(f); }
    for (const f of fams) out.set(f, (out.get(f) ?? 0) + 1);
  }
  return out;
}

/** One harbour per region (two when busy), on open coast near the region's atoms. */
export function placeHarbours(
  g: Graph, rg: RegionGrid, tax: TaxonomyResponse, foot: Map<string, Box>, busy: Uint8Array, used: Uint8Array,
): Harbour[] {
  const { cols, rows, terrain, regionOf } = rg;
  const n = cols * rows;
  // open sea = sea connected to the frame
  const frame: number[] = [];
  for (let x = 0; x < cols; x++) frame.push(x, (rows - 1) * cols + x);
  for (let y = 0; y < rows; y++) frame.push(y * cols, y * cols + cols - 1);
  const openSea = bfs(cols, rows, frame.filter((i) => terrain[i] === T.SEA), { diag: false, passable: (i) => terrain[i] === T.SEA });
  const seaNear = (i: number) => {
    const x = i % cols;
    const y = (i - x) / cols;
    let k = 0;
    for (let dy = -HARBOUR_RADIUS; dy <= HARBOUR_RADIUS; dy++) {
      for (let dx = -HARBOUR_RADIUS; dx <= HARBOUR_RADIUS; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= cols || yy >= rows || terrain[yy * cols + xx] === T.SEA) k++;
      }
    }
    return k;
  };
  const boats = boatsPerFamily(g, tax);
  const out: Harbour[] = [];
  for (const reg of rg.regions) {
    const atoms = g.membersOf.get(reg.family)!.filter((m) => g.atom.get(m) && foot.has(m)).map((m) => foot.get(m)!);
    const cands: { t: number; dock: number; score: number }[] = [];
    for (let i = 0; i < n; i++) {
      if (regionOf[i] !== reg.id || terrain[i] !== T.COAST || busy[i] || used[i]) continue;
      const x = i % cols;
      const y = (i - x) / cols;
      let dock = -1;
      let best = -1;
      for (let k = 0; k < 4; k++) {
        const nx = x + N4X[k];
        const ny = y + N4Y[k];
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const u = ny * cols + nx;
        if (openSea[u] === 32767 || terrain[u] !== T.SEA) continue;
        const s = seaNear(u);
        if (s > best) { best = s; dock = u; }
      }
      if (dock < 0) continue;
      let dAtom = 0;
      if (atoms.length) {
        dAtom = Infinity;
        for (const b of atoms) dAtom = Math.min(dAtom, Math.hypot(x - (b.x + b.w / 2), y - (b.y + b.h / 2)));
      }
      cands.push({ t: i, dock, score: best - 0.35 * dAtom + 0.5 * hash2(x, y, fnv1a(reg.family)) });
    }
    if (!cands.length) continue;
    cands.sort((a, b) => b.score - a.score || a.t - b.t);
    const total = boats.get(reg.family) ?? 0;
    const picks = [cands[0]];
    if (total > HARBOUR_SPLIT_BOATS && cands.length > 1) {
      const a = cands[0].t;
      const ax = a % cols;
      const ay = (a - ax) / cols;
      let far = cands[1];
      let fd = -1;
      for (const c of cands.slice(0, Math.max(8, Math.floor(cands.length / 2)))) {
        const cx = c.t % cols;
        const d = Math.hypot(cx - ax, (c.t - cx) / cols - ay);
        if (d > fd) { fd = d; far = c; }
      }
      if (fd >= 6) picks.push(far);
    }
    picks.forEach((p, k) => {
      used[p.t] = 1;
      const dx = p.dock % cols;
      const share = picks.length === 1 ? total : k === 0 ? Math.ceil(total / 2) : Math.floor(total / 2);
      out.push({
        family: reg.family, tile: p.t,
        pt: { x: (dx + 0.5) * TILE, y: ((p.dock - dx) / cols + 0.5) * TILE },
        boats: share,
      });
    });
  }
  return out;
}

/** Mountain ranges beside border rivers, far from every road and bridge. */
export function placeMountains(rg: RegionGrid, busy: Uint8Array, used: Uint8Array): Pt[][] {
  const { cols, rows, terrain, regionOf } = rg;
  const n = cols * rows;
  const roadSrc: number[] = [];
  for (let i = 0; i < n; i++) if (terrain[i] === T.ROAD || terrain[i] === T.BRIDGE) roadSrc.push(i);
  const roadDist = bfs(cols, rows, roadSrc);
  const busyD = dilate(busy, cols, rows, terrain);
  const cand = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const t = terrain[i];
    if (t !== T.LAND || busyD[i] || used[i] || roadDist[i] <= MOUNTAIN_ROAD_CLEAR) continue;
    const x = i % cols;
    const y = (i - x) / cols;
    for (let k = 0; k < 4; k++) {
      const nx = x + N4X[k];
      const ny = y + N4Y[k];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const u = ny * cols + nx;
      if (terrain[u] === T.RIVER && regionOf[u] !== regionOf[i]) { cand[i] = 1; break; }
    }
  }
  const nb = (i: number) => {
    const x = i % cols;
    const y = (i - x) / cols;
    const out: number[] = [];
    for (let d = 0; d < 8; d++) {
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const u = ny * cols + nx;
      if (cand[u]) out.push(u);
    }
    return out;
  };
  const ranges: Pt[][] = [];
  const seen = new Uint8Array(n);
  const pt = (t: number): Pt => ({ x: ((t % cols) + 0.5) * TILE, y: (Math.floor(t / cols) + 0.5) * TILE });
  for (let s = 0; s < n; s++) {
    if (!cand[s] || seen[s]) continue;
    // component
    const comp: number[] = [];
    const q = [s];
    seen[s] = 1;
    while (q.length) {
      const i = q.pop()!;
      comp.push(i);
      for (const u of nb(i)) if (!seen[u]) { seen[u] = 1; q.push(u); }
    }
    comp.sort((a, b) => a - b);
    const inComp = new Set(comp);
    const visited = new Set<number>();
    for (;;) {
      // start at a remaining endpoint (fewest remaining neighbours)
      let start = -1;
      let deg = 99;
      for (const t of comp) {
        if (visited.has(t)) continue;
        const d = nb(t).filter((u) => inComp.has(u) && !visited.has(u)).length;
        if (d < deg) { deg = d; start = t; }
      }
      if (start < 0) break;
      const line = [start];
      visited.add(start);
      let cur = start;
      for (;;) {
        const next = nb(cur).filter((u) => inComp.has(u) && !visited.has(u))
          .sort((a, b) => Number(isDiagStep(cur, a, cols)) - Number(isDiagStep(cur, b, cols)) || a - b)[0];
        if (next === undefined) break;
        visited.add(next);
        line.push(next);
        cur = next;
      }
      if (line.length >= MOUNTAIN_MIN) {
        for (const t of line) used[t] = 1;
        ranges.push(line.map(pt));
      }
    }
  }
  return ranges;
}

const isDiagStep = (a: number, b: number, cols: number) => (a % cols) !== (b % cols) && Math.floor(a / cols) !== Math.floor(b / cols);

/** busy dilated by 1 (sea/river are not dilated — mountains may sit right on the bank). */
function dilate(busy: Uint8Array, cols: number, rows: number, terrain: Uint8Array): Uint8Array {
  const out = new Uint8Array(busy.length);
  for (let i = 0; i < busy.length; i++) {
    if (!busy[i]) continue;
    const t = terrain[i];
    if (t === T.SEA || t === T.RIVER) { out[i] = 1; continue; }
    const x = i % cols;
    const y = (i - x) / cols;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < cols && yy < rows) out[yy * cols + xx] = 1;
      }
    }
  }
  return out;
}

/** An island east of the world (hidden) or south of it (ruins), outside `world`. */
export function secretIsland(world: Box, names: string[], side: "east" | "south"): SecretIsland {
  const wTiles = Math.max(SECRET_MIN_W, names.length * SECRET_PITCH + 2);
  const w = wTiles * TILE;
  const h = SECRET_H * TILE;
  const snap = (v: number) => Math.round(v / TILE) * TILE;
  const box = side === "east"
    ? { x: world.x + world.w + SECRET_GAP * TILE, y: snap(world.y + world.h * 0.62 - h / 2), w, h }
    : { x: snap(world.x + world.w * 0.14), y: world.y + world.h + SECRET_GAP * TILE, w, h };
  const x0 = box.x + (w - names.length * SECRET_PITCH * TILE) / 2;
  const slots = names.map((_, i) => ({ x: x0 + (i + 0.5) * SECRET_PITCH * TILE, y: box.y + h / 2 }));
  const dragons = side === "east"
    ? { x: box.x + w + 4 * TILE, y: box.y - 2 * TILE }
    : { x: box.x - 4 * TILE, y: box.y + h + 2 * TILE };
  return { box, names: [...names], slots, dragons };
}
