// Step 5 — roads. One octilinear A* road per builds_on edge. v2: a road rides
// its SIBLINGS' roads (same parent) at a discount, so a hub leaves on a few
// trunks that branch at distinct junctions; running along another parent's
// road costs extra (no braids), and roads avoid the label bands reserved in
// labels.ts. Roads that still share tiles get distinct parallel lanes.
// River tiles are only crossed straight-through (→ Bridge).
import type { Box, Bridge, Pt, Road } from "./types.ts";
import { T } from "./types.ts";
import type { GEdge, Graph } from "./graph.ts";
import type { RegionGrid } from "./regions.ts";
import { CHEVRON_END_CLEAR, CHEVRON_SPACING, LANE_GAP, TILE } from "./constants.ts";
import { astarRoad } from "./grid.ts";
import type { RoadSearch } from "./grid.ts";
import { chevronsAlong, offsetPolyline, polylineLength } from "./path.ts";

export interface RoadResult {
  roads: Road[];
  bridges: Bridge[];
  failures: string[];
}

/** Tiles 4-adjacent to (outside) a footprint. */
function ring4(b: Box, cols: number, rows: number): number[] {
  const out: number[] = [];
  for (let x = b.x; x < b.x + b.w; x++) {
    if (b.y - 1 >= 0) out.push((b.y - 1) * cols + x);
    if (b.y + b.h < rows) out.push((b.y + b.h) * cols + x);
  }
  for (let y = b.y; y < b.y + b.h; y++) {
    if (b.x - 1 >= 0) out.push(y * cols + b.x - 1);
    if (b.x + b.w < cols) out.push(y * cols + b.x + b.w);
  }
  return out;
}

/** px point where a tile adjacent to footprint `b` meets its edge. */
function stub(tile: number, b: Box, cols: number): Pt {
  const x = tile % cols;
  const y = (tile - x) / cols;
  const cx = (x + 0.5) * TILE;
  const cy = (y + 0.5) * TILE;
  if (x === b.x - 1) return { x: b.x * TILE, y: cy };
  if (x === b.x + b.w) return { x: (b.x + b.w) * TILE, y: cy };
  if (y === b.y - 1) return { x: cx, y: b.y * TILE };
  return { x: cx, y: (b.y + b.h) * TILE };
}

/** Tile path → px polyline with a vertex only where the direction changes. */
export function compress(tiles: number[], cols: number): Pt[] {
  const pts: Pt[] = [];
  const c = (t: number) => ({ x: ((t % cols) + 0.5) * TILE, y: (Math.floor(t / cols) + 0.5) * TILE });
  for (let i = 0; i < tiles.length; i++) {
    if (i === 0 || i === tiles.length - 1 || tiles[i] - tiles[i - 1] !== tiles[i + 1] - tiles[i]) pts.push(c(tiles[i]));
  }
  return pts;
}

export function routeRoads(
  g: Graph, rg: RegionGrid, foot: Map<string, Box>, coast: Uint8Array, zone: Uint8Array = new Uint8Array(rg.cols * rg.rows),
): RoadResult {
  const { cols, rows, regionOf, terrain } = rg;
  const n = cols * rows;
  const famId = new Map(rg.regions.map((r) => [r.family, r.id]));
  const nodeIdx = new Map([...foot.keys()].map((k, i) => [k, i]));

  // footprint-adjacency owner (ring 1, and ring 2): node index, -1 none, -2 several
  const owner = new Int16Array(n).fill(-1);
  const owner2 = new Int16Array(n).fill(-1);
  for (const [name, b] of foot) {
    const id = nodeIdx.get(name)!;
    for (let y = b.y - 2; y <= b.y + b.h + 1; y++) {
      for (let x = b.x - 2; x <= b.x + b.w + 1; x++) {
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const i = y * cols + x;
        if (terrain[i] === T.FOOT) continue;
        const ring1 = x >= b.x - 1 && x <= b.x + b.w && y >= b.y - 1 && y <= b.y + b.h;
        const o = ring1 ? owner : owner2;
        o[i] = o[i] === -1 || o[i] === id ? id : -2;
      }
    }
  }

  const walk = new Uint8Array(n);
  const river = new Uint8Array(n);
  const occ = new Uint8Array(n);
  const sib = new Int16Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const t = terrain[i];
    if (t === T.LAND || t === T.COAST || t === T.ROAD) walk[i] = 1;
    if (t === T.RIVER) river[i] = 1;
  }
  const goal = new Uint8Array(n);
  const allowAll = new Uint8Array(rg.regions.length).fill(1);

  const edges = [...g.edges];
  const group = (e: GEdge) => (e.primary ? 0 : e.cross ? 2 : 1);
  edges.sort((a, b) =>
    group(a) - group(b) ||
    g.depth.get(a.to)! - g.depth.get(b.to)! ||
    (a.to < b.to ? -1 : a.to > b.to ? 1 : 0) ||
    (a.from < b.from ? -1 : 1));

  const roads: Road[] = [];
  const bridges: Bridge[] = [];
  const failures: string[] = [];
  for (const e of edges) {
    const id = `${e.from}->${e.to}`;
    const kind = e.cross ? "bridge" : e.primary ? "primary" : "secondary";
    const A = foot.get(e.from);
    const B = foot.get(e.to);
    const empty: Road = {
      id, from: e.from, to: e.to, kind, primary: e.primary, tiles: [], points: [], length: 0, lane: 0, lanePoints: [], chevrons: [],
    };
    if (!A || !B) { roads.push(empty); failures.push(`road ${id}: endpoint not placed`); continue; }
    for (const t of ring4(B, cols, rows)) goal[t] = 1;
    const rA = famId.get(g.family.get(e.from)!)!;
    const rB = famId.get(g.family.get(e.to)!)!;
    const tight = new Uint8Array(rg.regions.length);
    tight[rA] = 1;
    tight[rB] = 1;
    let path: number[] | null = null;
    for (const allowRegion of [tight, allowAll]) {
      const s: RoadSearch = {
        cols, rows, walk, river, occ, sib, zone, regionOf, coast, owner, owner2, allowRegion,
        fromId: nodeIdx.get(e.from)!, toId: nodeIdx.get(e.to)!,
        starts: ring4(A, cols, rows), goal,
        hx0: B.x - 1, hy0: B.y - 1, hx1: B.x + B.w, hy1: B.y + B.h,
      };
      path = astarRoad(s);
      if (path) break;
    }
    for (const t of ring4(B, cols, rows)) goal[t] = 0;
    if (!path) { roads.push(empty); failures.push(`road ${id}: no route`); continue; }

    // commit tiles; collect river runs as bridges
    let run: number[] = [];
    const flush = (k: number) => {
      if (!run.length) return;
      const before = path![k - run.length - 1];
      const after = path![k];
      bridges.push({
        roadId: id,
        tiles: run,
        axis: Math.abs(after - before) === run.length + 1 ? "h" : "v",
        regions: [rg.regions[regionOf[before]].family, rg.regions[regionOf[after]].family],
      });
      run = [];
    };
    const fromId = nodeIdx.get(e.from)!;
    for (let k = 0; k < path.length; k++) {
      const t = path[k];
      if (occ[t] < 255) occ[t]++;
      sib[t] = occ[t] === 1 || sib[t] === fromId ? fromId : -2;
      if (river[t]) {
        run.push(t);
        river[t] = 2;
        terrain[t] = T.BRIDGE;
      } else {
        flush(k);
        terrain[t] = T.ROAD;
      }
    }
    flush(path.length);
    const points = [stub(path[0], A, cols), ...compress(path, cols), stub(path[path.length - 1], B, cols)];
    roads.push({
      id, from: e.from, to: e.to, kind, primary: e.primary, tiles: path, points, length: polylineLength(points),
      lane: 0, lanePoints: [], chevrons: [],
    });
  }
  roads.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  assignLanes(roads, n);
  for (const r of roads) {
    r.lanePoints = r.points.length ? offsetPolyline(r.points, r.lane * LANE_GAP) : [];
    r.chevrons = r.lanePoints.length ? chevronsAlong(r.lanePoints, CHEVRON_SPACING, CHEVRON_END_CLEAR) : [];
  }
  return { roads, bridges, failures };
}

/**
 * Lane colouring. Two roads conflict when they share a tile-to-tile segment:
 * travelling the same way they need different lanes; opposite ways they need
 * lane_a ≠ −lane_b (lanes are offsets to the LEFT of travel). Greedy, most
 * constrained road first, lanes tried 0, +1, −1, +2, −2, …
 */
export function assignLanes(roads: Road[], n: number) {
  const seg = new Map<number, [number, number][]>();
  roads.forEach((r, ri) => {
    for (let k = 1; k < r.tiles.length; k++) {
      const a = r.tiles[k - 1];
      const b = r.tiles[k];
      const key = a < b ? a * n + b : b * n + a;
      let l = seg.get(key);
      if (!l) seg.set(key, (l = []));
      l.push([ri, a < b ? 1 : -1]);
    }
  });
  const rel: Map<number, Set<number>>[] = roads.map(() => new Map());
  for (const l of seg.values()) {
    for (let i = 0; i < l.length; i++) {
      for (let j = i + 1; j < l.length; j++) {
        const [a, da] = l[i];
        const [b, db] = l[j];
        if (a === b) continue;
        const s = da * db;
        if (!rel[a].has(b)) rel[a].set(b, new Set());
        if (!rel[b].has(a)) rel[b].set(a, new Set());
        rel[a].get(b)!.add(s);
        rel[b].get(a)!.add(s);
      }
    }
  }
  const order = roads.map((_, i) => i).sort((a, b) =>
    rel[b].size - rel[a].size || Number(roads[b].primary) - Number(roads[a].primary) || a - b);
  const lane = new Map<number, number>();
  for (const ri of order) {
    for (let k = 0; ; k++) {
      const cand = k === 0 ? 0 : k % 2 ? (k + 1) / 2 : -k / 2;
      let ok = true;
      for (const [o, rs] of rel[ri]) {
        const lo = lane.get(o);
        if (lo === undefined) continue;
        if ((rs.has(1) && cand === lo) || (rs.has(-1) && cand === -lo)) { ok = false; break; }
      }
      if (ok) { lane.set(ri, cand); break; }
    }
  }
  roads.forEach((r, i) => { r.lane = lane.get(i) ?? 0; });
}
