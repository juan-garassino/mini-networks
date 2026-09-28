// Step 5 — roads. One octilinear A* road per builds_on edge; later roads get
// a discount on existing ROAD tiles so lineage shares trunks instead of
// starbursting. River tiles are only crossed straight-through (→ Bridge).
import type { Box, Bridge, Pt, Road } from "./types.ts";
import { T } from "./types.ts";
import type { GEdge, Graph } from "./graph.ts";
import type { RegionGrid } from "./regions.ts";
import { TILE } from "./constants.ts";
import { astarRoad } from "./grid.ts";
import type { RoadSearch } from "./grid.ts";
import { polylineLength } from "./path.ts";

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
  g: Graph, rg: RegionGrid, foot: Map<string, Box>, coast: Uint8Array,
): RoadResult {
  const { cols, rows, regionOf, terrain } = rg;
  const n = cols * rows;
  const famId = new Map(rg.regions.map((r) => [r.family, r.id]));
  const nodeIdx = new Map([...foot.keys()].map((k, i) => [k, i]));

  // footprint-adjacency owner: node index, -1 none, -2 several
  const owner = new Int16Array(n).fill(-1);
  for (const [name, b] of foot) {
    const id = nodeIdx.get(name)!;
    for (let y = b.y - 1; y <= b.y + b.h; y++) {
      for (let x = b.x - 1; x <= b.x + b.w; x++) {
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const i = y * cols + x;
        if (terrain[i] === T.FOOT) continue;
        owner[i] = owner[i] === -1 || owner[i] === id ? id : -2;
      }
    }
  }

  const walk = new Uint8Array(n);
  const river = new Uint8Array(n);
  const road = new Uint8Array(n);
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
    const empty: Road = { id, from: e.from, to: e.to, kind, primary: e.primary, tiles: [], points: [], length: 0 };
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
        cols, rows, walk, river, road, regionOf, coast, owner, allowRegion,
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
    for (let k = 0; k < path.length; k++) {
      const t = path[k];
      if (river[t]) {
        run.push(t);
        river[t] = 2;
        terrain[t] = T.BRIDGE;
      } else {
        flush(k);
        road[t] = 1;
        terrain[t] = T.ROAD;
      }
    }
    flush(path.length);
    const points = [stub(path[0], A, cols), ...compress(path, cols), stub(path[path.length - 1], B, cols)];
    roads.push({ id, from: e.from, to: e.to, kind, primary: e.primary, tiles: path, points, length: polylineLength(points) });
  }
  roads.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { roads, bridges, failures };
}
