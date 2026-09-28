// buildWorld — taxonomy + family map → a deterministic tile world (regions,
// nodes, roads, bridges, labels, decor, camera anchors). Plus the two walks
// skins animate: pathToAtom (lineage) and ferryRoute (compositions).
import type { TaxonomyResponse } from "../types.ts";
import type {
  Box, CameraAnchors, FamilyMap, FerryRoute, PathResult, Pt, World, WorldNode, WorldOptions,
} from "./types.ts";
import { T } from "./types.ts";
import {
  CAMERA_NODE_PAD, CAMERA_REGION_PAD, FERRY_FOOT, FERRY_LAND, FERRY_ROAD, FERRY_SEA, MAX_RETRIES,
  RETRY_AREA_MUL, TILE,
} from "./constants.ts";
import { buildGraph } from "./graph.ts";
import { growRegions, sharesBorder } from "./regions.ts";
import { placeAll } from "./place.ts";
import { routeRoads } from "./roads.ts";
import { placeLabels } from "./labels.ts";
import { labelTiles, placeDecor, seaSlots } from "./decor.ts";
import { DX, DY, MinHeap, isDiag } from "./grid.ts";
import { polylineLength } from "./path.ts";

const union = (a: Box, b: Box): Box => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};
const pad = (b: Box, p: number, W: number, H: number): Box => {
  const x = Math.max(0, b.x - p);
  const y = Math.max(0, b.y - p);
  return { x, y, w: Math.min(W, b.x + b.w + p) - x, h: Math.min(H, b.y + b.h + p) - y };
};
const px = (b: Box): Box => ({ x: b.x * TILE, y: b.y * TILE, w: b.w * TILE, h: b.h * TILE });

export function buildWorld(tax: TaxonomyResponse, fam: FamilyMap, opts: WorldOptions = {}): World {
  const g = buildGraph(tax, fam);
  for (let attempt = 0; ; attempt++) {
    const warnings = [...g.warnings];
    const failures: string[] = [];
    const rg = growRegions(g, RETRY_AREA_MUL ** attempt, warnings);
    for (const reg of rg.regions) {
      if (reg.tiles < reg.targetTiles * 0.85) failures.push(`region ${reg.family} reached ${reg.tiles}/${reg.targetTiles} tiles`);
    }
    for (const key of [...g.crossPairs.keys()].sort()) {
      const [a, b] = key.split("|");
      const ia = rg.regions.find((r) => r.family === a)!.id;
      const ib = rg.regions.find((r) => r.family === b)!.id;
      if (!sharesBorder(rg.cols, rg.rows, rg.regionOf, ia, ib)) failures.push(`regions ${a} and ${b} do not touch`);
    }
    const coast = new Uint8Array(rg.terrain.length);
    for (let i = 0; i < coast.length; i++) coast[i] = rg.terrain[i] === T.COAST ? 1 : 0;
    const pl = placeAll(g, rg);
    failures.push(...pl.failures);
    const rr = routeRoads(g, rg, pl.foot, coast);
    failures.push(...rr.failures);
    const lb = placeLabels(g, rg, pl.foot, pl.setPiece, rr.bridges, opts);
    failures.push(...lb.failures);
    opts.onAttempt?.(attempt, [...failures]);
    if (failures.length && attempt < MAX_RETRIES) continue;
    warnings.push(...failures);
    if (attempt > 0) warnings.push(`layout needed ${attempt} retr${attempt === 1 ? "y" : "ies"} (area ×${(RETRY_AREA_MUL ** attempt).toFixed(2)})`);

    const { cols, rows } = rg;
    const W = cols * TILE;
    const H = rows * TILE;
    const regions = rg.regions.map((r, i) => ({ ...r, setPiece: pl.setPiece[i] }));
    const nodes: WorldNode[] = [];
    for (const name of g.names) {
      const foot = pl.foot.get(name);
      if (!foot) continue;
      nodes.push({
        name, family: g.family.get(name)!, depth: g.depth.get(name)!, atom: g.atom.get(name)!,
        primary: g.primary.get(name)!, parents: [...g.parents.get(name)!], foot: { ...foot },
        center: { x: (foot.x + foot.w / 2) * TILE, y: (foot.y + foot.h / 2) * TILE },
      });
    }
    const lmask = labelTiles(cols, rows, lb.labels);
    const decor = placeDecor(rg, lmask);
    const slots = seaSlots(rg, lmask);

    const camera: CameraAnchors = { world: { x: 0, y: 0, w: W, h: H }, regions: {}, nodes: {} };
    const labelOf = new Map(lb.labels.map((l) => [l.node, l]));
    for (const r of regions) {
      let b = px(r.bbox);
      for (const nd of nodes) {
        const l = labelOf.get(nd.name);
        if (nd.family === r.family && l) b = union(b, l.box);
      }
      camera.regions[r.family] = pad(b, CAMERA_REGION_PAD * TILE, W, H);
    }
    for (const nd of nodes) {
      const l = labelOf.get(nd.name);
      const b = l ? union(px(nd.foot), l.box) : px(nd.foot);
      camera.nodes[nd.name] = { focus: { ...nd.center }, box: pad(b, CAMERA_NODE_PAD * TILE, W, H) };
    }
    return {
      cols, rows, tile: TILE, terrain: rg.terrain, regionOf: rg.regionOf, regions, nodes,
      roads: rr.roads, bridges: rr.bridges, labels: lb.labels, decor, seaSlots: slots, camera, warnings,
    };
  }
}

/** Critter walk from `name` back to its root atom along primary roads. */
export function pathToAtom(world: World, name: string): PathResult {
  const byName = new Map(world.nodes.map((n) => [n.name, n]));
  const roads = new Map(world.roads.map((r) => [r.id, r]));
  const start = byName.get(name);
  if (!start) return { nodes: [], points: [], length: 0 };
  const nodes = [name];
  const points: Pt[] = [{ ...start.center }];
  let cur = start;
  while (cur.primary && !nodes.includes(cur.primary)) {
    const p = byName.get(cur.primary);
    if (!p) break;
    const road = roads.get(`${p.name}->${cur.name}`);
    if (road) for (let i = road.points.length - 1; i >= 0; i--) points.push({ ...road.points[i] });
    points.push({ ...p.center });
    nodes.push(p.name);
    cur = p;
  }
  return { nodes, points, length: polylineLength(points) };
}

/** Composition "ferry": A* between member footprints in order (roads cheap, sea ok, land dear). */
export function ferryRoute(world: World, members: string[]): FerryRoute {
  const byName = new Map(world.nodes.map((n) => [n.name, n]));
  const visits = members.filter((m, i) => byName.has(m) && members[i - 1] !== m);
  const { cols, rows, terrain } = world;
  const tileOf = (p: Pt) => Math.floor(p.y / TILE) * cols + Math.floor(p.x / TILE);
  const stepCost = (t: number) => {
    const v = terrain[t];
    return v === T.ROAD || v === T.BRIDGE ? FERRY_ROAD : v === T.SEA ? FERRY_SEA : v === T.FOOT ? FERRY_FOOT : FERRY_LAND;
  };
  const points: Pt[] = [];
  const sea: boolean[] = [];
  const push = (p: Pt, s: boolean) => {
    const q = points[points.length - 1];
    if (q && q.x === p.x && q.y === p.y) return;
    points.push(p);
    sea.push(s);
  };
  if (visits.length) push({ ...byName.get(visits[0])!.center }, false);
  for (let k = 1; k < visits.length; k++) {
    const a = byName.get(visits[k - 1])!;
    const b = byName.get(visits[k])!;
    const tiles = ferryAstar(cols, rows, tileOf(a.center), tileOf(b.center), stepCost);
    // vertices where direction or the sea flag changes
    for (let i = 1; i < tiles.length - 1; i++) {
      const t = tiles[i];
      const s = terrain[t] === T.SEA;
      const turn = tiles[i] - tiles[i - 1] !== tiles[i + 1] - tiles[i];
      const flip = s !== (terrain[tiles[i - 1]] === T.SEA) || s !== (terrain[tiles[i + 1]] === T.SEA);
      if (turn || flip) push({ x: ((t % cols) + 0.5) * TILE, y: (Math.floor(t / cols) + 0.5) * TILE }, s);
    }
    push({ ...b.center }, false);
  }
  return { visits, points, sea, length: polylineLength(points) };
}

function ferryAstar(cols: number, rows: number, from: number, to: number, cost: (t: number) => number): number[] {
  const n = cols * rows;
  const g = new Float64Array(n).fill(Infinity);
  const par = new Int32Array(n).fill(-1);
  const tx = to % cols;
  const ty = (to - tx) / cols;
  const h = (t: number) => {
    const x = t % cols;
    const dx = Math.abs(x - tx);
    const dy = Math.abs((t - x) / cols - ty);
    const mn = Math.min(dx, dy);
    return FERRY_ROAD * (Math.max(dx, dy) - mn + Math.SQRT2 * mn);
  };
  const heap = new MinHeap();
  g[from] = 0;
  heap.push(h(from), from, from);
  while (heap.size) {
    const t = heap.pop();
    if (heap.lastPri > g[t] + h(t) + 1e-9) continue;
    if (t === to) break;
    const x = t % cols;
    const y = (t - x) / cols;
    for (let d = 0; d < 8; d++) {
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const u = ny * cols + nx;
      const c = g[t] + cost(u) * (isDiag(d) ? Math.SQRT2 : 1);
      if (c < g[u] - 1e-12) {
        g[u] = c;
        par[u] = t;
        heap.push(c + h(u), u, u);
      }
    }
  }
  const out: number[] = [];
  for (let t = to; t !== -1; t = par[t]) out.push(t);
  return out.reverse();
}
