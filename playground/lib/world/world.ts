// buildWorld — taxonomy + family map → a deterministic tile world (regions,
// nodes, roads, bridges, labels, decor, flavour, camera anchors). Plus the
// walks skins animate: pathToAtom (lineage) and ferryRoute (compositions),
// and the v2 queries lineage (every parent/child road) and parkingSpot.
import type { TaxonomyResponse } from "../types.ts";
import type {
  Box, CameraAnchors, FamilyMap, FerryRoute, Lineage, PathResult, Pt, Road, World, WorldNode, WorldOptions,
} from "./types.ts";
import { T } from "./types.ts";
import {
  CAMERA_NODE_PAD, CAMERA_REGION_PAD, FERRY_FOOT, FERRY_LAND, FERRY_ROAD, FERRY_SEA, HIDDEN_DEFAULT, MAX_RETRIES,
  RETRY_AREA_MUL, TILE, WORLD_VERSION,
} from "./constants.ts";
import { buildGraph } from "./graph.ts";
import { PRESETS } from "./continent.ts";
import { growRegions, sharesBorder, traceBorders, traceShapes } from "./regions.ts";
import { placeAll } from "./place.ts";
import { routeRoads } from "./roads.ts";
import { labelZones, placeLabels } from "./labels.ts";
import { labelTiles, placeDecor, seaSlots } from "./decor.ts";
import { occupiedMask, placeCities, placeHarbours, placeMountains, secretIsland } from "./flavour.ts";
import { DX, DY, MinHeap, isDiag } from "./grid.ts";
import { polylineLength, samplePolyline } from "./path.ts";

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
const inPoly = (poly: Pt[], x: number, y: number) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};
const px = (b: Box): Box => ({ x: b.x * TILE, y: b.y * TILE, w: b.w * TILE, h: b.h * TILE });

export function buildWorld(tax: TaxonomyResponse, fam: FamilyMap, opts: WorldOptions = {}): World {
  const g = buildGraph(tax, fam);
  const presetName = opts.preset === "paper" ? "paper" : "pixel";
  const preset = PRESETS[presetName];
  for (let attempt = 0; ; attempt++) {
    const warnings = [...g.warnings];
    const failures: string[] = [];
    const rg = growRegions(g, RETRY_AREA_MUL ** attempt, warnings, preset);
    for (const reg of rg.regions) {
      if (reg.tiles < reg.targetTiles * 0.85) failures.push(`region ${reg.family} reached ${reg.tiles}/${reg.targetTiles} tiles`);
    }
    for (const key of [...g.crossPairs.keys()].sort()) {
      const [a, b] = key.split("|");
      const ia = rg.regions.find((r) => r.family === a)!.id;
      const ib = rg.regions.find((r) => r.family === b)!.id;
      // paper: a bridge road may cross a third land on its way (roads still must route)
      if (preset.requireAdjacent && !sharesBorder(rg.cols, rg.rows, rg.regionOf, ia, ib)) failures.push(`regions ${a} and ${b} do not touch`);
    }
    const coast = new Uint8Array(rg.terrain.length);
    for (let i = 0; i < coast.length; i++) coast[i] = rg.terrain[i] === T.COAST ? 1 : 0;
    const pl = placeAll(g, rg, preset);
    failures.push(...pl.failures);
    const lz = labelZones(g, rg, pl.foot, opts);
    const rr = routeRoads(g, rg, pl.foot, coast, lz.zone);
    failures.push(...rr.failures);
    const lb = placeLabels(g, rg, pl.foot, pl.setPiece, rr.bridges, opts, lz.prefer);
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
      const cx = foot.x + foot.w / 2, cy = foot.y + foot.h / 2;
      const z = rg.zones.find((q) => q.family === g.family.get(name) && inPoly(q.poly, cx, cy));
      nodes.push({
        name, family: g.family.get(name)!, depth: g.depth.get(name)!, atom: g.atom.get(name)!,
        primary: g.primary.get(name)!, parents: [...g.parents.get(name)!], foot: { ...foot },
        center: { x: cx * TILE, y: cy * TILE }, zone: z ? z.zone : null,
      });
    }
    const lmask = labelTiles(cols, rows, lb.labels);
    // flavour claims free land first (cities hug atoms, harbours on open
    // coast, mountains on quiet borders); decor fills what is left
    const busy = occupiedMask(rg, lmask);
    const used = new Uint8Array(cols * rows);
    const cities = placeCities(g, rg, pl.foot, busy, used);
    const harbours = placeHarbours(g, rg, tax, pl.foot, busy, used);
    const mountains = placeMountains(rg, busy, used);
    const flavourMask = new Uint8Array(cols * rows);
    for (let i = 0; i < flavourMask.length; i++) flavourMask[i] = lmask[i] | used[i];
    for (const h of harbours) flavourMask[Math.floor(h.pt.y / TILE) * cols + Math.floor(h.pt.x / TILE)] = 1;
    const decor = placeDecor(rg, flavourMask);
    const slots = seaSlots(rg, flavourMask);

    const worldBox = { x: 0, y: 0, w: W, h: H };
    const hiddenIsland = secretIsland(worldBox, opts.hidden ?? HIDDEN_DEFAULT, "east");
    const ruinsIsland = secretIsland(worldBox, opts.ruins ?? [], "south");
    let all = union(union(worldBox, hiddenIsland.box), ruinsIsland.box);
    for (const p of [hiddenIsland.dragons, ruinsIsland.dragons]) all = union(all, { x: p.x, y: p.y, w: 0, h: 0 });
    all = { x: all.x - 2 * TILE, y: all.y - 2 * TILE, w: all.w + 4 * TILE, h: all.h + 4 * TILE };
    const camera: CameraAnchors = { world: worldBox, all, regions: {}, nodes: {} };
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
    const tpx = (p: Pt): Pt => ({ x: Math.round(p.x * TILE * 100) / 100, y: Math.round(p.y * TILE * 100) / 100 });
    return {
      version: WORLD_VERSION, preset: presetName, cols, rows, tile: TILE, terrain: rg.terrain, regionOf: rg.regionOf, regions, nodes,
      roads: rr.roads, bridges: rr.bridges, labels: lb.labels, decor, seaSlots: slots, camera,
      harbours, cities, mountains, hiddenIsland, ruinsIsland,
      borders: traceBorders(rg, TILE), outline: rg.outline.map(tpx), bay: rg.bay.map(tpx),
      islets: rg.islets.map((i) => ({ kind: i.kind, poly: i.poly.map(tpx) })),
      zones: rg.zones.map((z) => ({ family: z.family, zone: z.zone, poly: z.poly.map(tpx) })),
      shapes: traceShapes(rg, TILE), warnings,
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

/** Every road into / out of `name`, plus all ancestors and descendants (nearest generation first). */
export function lineage(world: World, name: string): Lineage {
  const parents = world.roads.filter((r) => r.to === name)
    .sort((a, b) => Number(b.primary) - Number(a.primary) || (a.id < b.id ? -1 : 1));
  const children = world.roads.filter((r) => r.from === name).sort((a, b) => (a.id < b.id ? -1 : 1));
  const up = new Map<string, string[]>();
  const down = new Map<string, string[]>();
  for (const r of world.roads) {
    if (!up.has(r.to)) up.set(r.to, []);
    up.get(r.to)!.push(r.from);
    if (!down.has(r.from)) down.set(r.from, []);
    down.get(r.from)!.push(r.to);
  }
  const walk = (next: Map<string, string[]>) => {
    const seen = new Set([name]);
    const out: string[] = [];
    let level = [name];
    while (level.length) {
      const nxt = [...new Set(level.flatMap((n) => next.get(n) ?? []))].filter((n) => !seen.has(n)).sort();
      for (const n of nxt) { seen.add(n); out.push(n); }
      level = nxt;
    }
    return out;
  };
  return { parents, children, ancestors: walk(up), descendants: walk(down) };
}

/** Distance (px) the critter parks back from the footprint edge along its road. */
const PARK_BACK = [22, 28, 36, 46, 58, 72];
const PARK_CLEAR = 4;

/**
 * Where the critter waits when `name` is focused: on the model's incoming
 * primary road (atoms: its first outgoing road), a little back from the
 * footprint — never inside any footprint or label (PARK_CLEAR px margin).
 * Returns the px point plus the heading toward the model (radians).
 */
export function parkingSpot(world: World, name: string): Pt & { angle: number } {
  const node = world.nodes.find((n) => n.name === name);
  if (!node) return { x: 0, y: 0, angle: 0 };
  const S = world.tile;
  const solids: Box[] = [
    ...world.nodes.map((n) => ({ x: n.foot.x * S, y: n.foot.y * S, w: n.foot.w * S, h: n.foot.h * S })),
    ...world.labels.map((l) => l.box),
  ];
  const free = (p: Pt) => !solids.some((b) =>
    p.x > b.x - PARK_CLEAR && p.x < b.x + b.w + PARK_CLEAR && p.y > b.y - PARK_CLEAR && p.y < b.y + b.h + PARK_CLEAR);
  const ins = world.roads.filter((r) => r.to === name && r.lanePoints.length)
    .sort((a, b) => Number(b.primary) - Number(a.primary) || (a.id < b.id ? -1 : 1));
  const outs = world.roads.filter((r) => r.from === name && r.lanePoints.length).sort((a, b) => (a.id < b.id ? -1 : 1));
  const tries: { road: Road; incoming: boolean }[] = [
    ...ins.map((road) => ({ road, incoming: true })), ...outs.map((road) => ({ road, incoming: false })),
  ];
  for (const { road, incoming } of tries) {
    const s = samplePolyline(road.lanePoints);
    for (const back of PARK_BACK) {
      if (back >= s.length) break;
      const p = s.at(incoming ? 1 - back / s.length : back / s.length);
      if (!free(p)) continue;
      const angle = incoming ? p.angle : p.angle + Math.PI;
      return { x: round2(p.x), y: round2(p.y), angle: round2(Math.atan2(Math.sin(angle), Math.cos(angle))) };
    }
  }
  // no usable road: the nearest free tile centre around the footprint
  const f = node.foot;
  for (let ring = 1; ring <= 4; ring++) {
    for (let y = f.y - ring; y < f.y + f.h + ring; y++) {
      for (let x = f.x - ring; x < f.x + f.w + ring; x++) {
        if (Math.max(f.x - x, x - (f.x + f.w - 1), f.y - y, y - (f.y + f.h - 1)) !== ring) continue;
        const p = { x: (x + 0.5) * S, y: (y + 0.5) * S };
        if (x >= 0 && y >= 0 && x < world.cols && y < world.rows && free(p)) {
          return { ...p, angle: round2(Math.atan2(node.center.y - p.y, node.center.x - p.x)) };
        }
      }
    }
  }
  return { x: node.center.x, y: (f.y + f.h) * S + PARK_BACK[0], angle: -Math.PI / 2 };
}
const round2 = (v: number) => Math.round(v * 100) / 100;

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
