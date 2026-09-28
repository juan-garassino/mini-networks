// buildFlow — the "flow" layout (skin D): columns = generation depth, lanes =
// families, pipes = builds_on edges routed orthogonally through the gutters.
import { PLACEMENT } from "../blueprint.ts";
import type { TaxonomyResponse } from "../types.ts";
import type { Box, FamilyMap, FlowLayout, FlowNode, FlowPipe, Pt } from "./types.ts";
import {
  FLOW_CHANNEL_CLEAR, FLOW_COL_W, FLOW_LANE_GAP, FLOW_NODE_H, FLOW_NODE_W, FLOW_PAD,
  FLOW_ROW_PITCH, FLOW_SWEEPS, FLOW_TRACK,
} from "./constants.ts";
import { buildGraph } from "./graph.ts";
import { polylineLength } from "./path.ts";

/** Lexicographic permutations of [0..n). */
function* permutations(n: number): Generator<number[]> {
  const a = Array.from({ length: n }, (_, i) => i);
  for (;;) {
    yield [...a];
    let i = n - 2;
    while (i >= 0 && a[i] >= a[i + 1]) i--;
    if (i < 0) return;
    let j = n - 1;
    while (a[j] <= a[i]) j--;
    [a[i], a[j]] = [a[j], a[i]];
    for (let l = i + 1, r = n - 1; l < r; l++, r--) [a[l], a[r]] = [a[r], a[l]];
  }
}

function segCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

export function buildFlow(tax: TaxonomyResponse, fam: FamilyMap): FlowLayout {
  const g = buildGraph(tax, fam);

  // 1. lane order: best permutation of families by Σ weight·|lane delta|
  const fams = g.families;
  const permN = Math.min(fams.length, 8);
  let bestPerm: number[] = [];
  let bestCost = Infinity;
  for (const p of permutations(permN)) {
    const pos = new Map<string, number>();
    p.forEach((fi, lane) => pos.set(fams[fi], lane));
    let cost = 0;
    for (const [k, w] of g.crossPairs) {
      const [a, b] = k.split("|");
      cost += w * Math.abs((pos.get(a) ?? permN) - (pos.get(b) ?? permN));
    }
    if (cost < bestCost) { bestCost = cost; bestPerm = p; }
  }
  const laneFams = [...bestPerm.map((i) => fams[i]), ...fams.slice(permN)];
  const laneOf = new Map(laneFams.map((f, i) => [f, i]));

  // 2. cells + seed order
  const maxDepth = Math.max(0, ...g.names.map((n) => g.depth.get(n)!));
  const cells: string[][][] = laneFams.map(() => Array.from({ length: maxDepth + 1 }, () => []));
  for (const n of g.names) cells[laneOf.get(g.family.get(n)!)!][g.depth.get(n)!].push(n);
  const rowOf = (n: string) => PLACEMENT[n]?.row ?? 99;
  for (const lane of cells) for (const cell of lane) cell.sort((a, b) => rowOf(a) - rowOf(b) || (a < b ? -1 : 1));

  // geometry that doesn't depend on order
  const lanes: FlowLayout["lanes"] = [];
  let y = FLOW_PAD;
  for (let l = 0; l < laneFams.length; l++) {
    const m = Math.max(1, ...cells[l].map((c) => c.length));
    const h = m * FLOW_ROW_PITCH + (FLOW_ROW_PITCH - FLOW_NODE_H);
    lanes.push({ family: laneFams[l], y, h });
    y += h + FLOW_LANE_GAP;
  }
  const height = y - FLOW_LANE_GAP + FLOW_PAD;
  const columns = Array.from({ length: maxDepth + 1 }, (_, d) => ({ depth: d, x: FLOW_PAD + d * FLOW_COL_W }));
  const width = FLOW_PAD * 2 + maxDepth * FLOW_COL_W + FLOW_NODE_W;

  const boxes = () => {
    const out = new Map<string, Box>();
    cells.forEach((lane, l) => lane.forEach((cell, d) => {
      const stack = (cell.length - 1) * FLOW_ROW_PITCH + FLOW_NODE_H;
      const top = lanes[l].y + (lanes[l].h - stack) / 2;
      cell.forEach((n, i) => out.set(n, { x: columns[d].x, y: top + i * FLOW_ROW_PITCH, w: FLOW_NODE_W, h: FLOW_NODE_H }));
    }));
    return out;
  };
  const crossings = () => {
    const b = boxes();
    const c = (n: string) => ({ x: b.get(n)!.x + FLOW_NODE_W / 2, y: b.get(n)!.y + FLOW_NODE_H / 2 });
    let k = 0;
    const E = g.edges;
    for (let i = 0; i < E.length; i++) {
      for (let j = i + 1; j < E.length; j++) {
        const e = E[i];
        const f = E[j];
        if (e.from === f.from || e.from === f.to || e.to === f.from || e.to === f.to) continue;
        if (segCross(c(e.from), c(e.to), c(f.from), c(f.to))) k++;
      }
    }
    return k;
  };
  const snapshot = () => cells.map((lane) => lane.map((cell) => [...cell]));
  const seedCrossings = crossings();
  let best = snapshot();
  let bestX = seedCrossings;
  const sortCell = (cell: string[], key: (n: string) => number | null, cur: Map<string, Box>) => {
    const k = new Map(cell.map((n) => [n, key(n) ?? cur.get(n)!.y + FLOW_NODE_H / 2]));
    const idx = new Map(cell.map((n, i) => [n, i]));
    cell.sort((a, b) => k.get(a)! - k.get(b)! || idx.get(a)! - idx.get(b)!);
  };
  const mean = (ns: string[], b: Map<string, Box>) =>
    ns.length ? ns.reduce((s, n) => s + b.get(n)!.y + FLOW_NODE_H / 2, 0) / ns.length : null;
  for (let s = 0; s < FLOW_SWEEPS; s++) {
    for (const dir of [1, -1]) {
      const cols = dir === 1 ? columns.map((c) => c.depth).slice(1) : columns.map((c) => c.depth).slice(0, -1).reverse();
      for (const d of cols) {
        const cur = boxes();
        for (const lane of cells) {
          sortCell(lane[d], (n) => mean(dir === 1 ? g.parents.get(n)! : g.children.get(n)!, cur), cur);
        }
      }
      const x = crossings();
      if (x < bestX) { bestX = x; best = snapshot(); }
    }
  }
  best.forEach((lane, l) => lane.forEach((cell, d) => { cells[l][d] = cell; }));
  const box = boxes();

  // 3. ports: out-ports along the right edge sorted by target y; in-ports along the left edge by source y
  const cy = (n: string) => box.get(n)!.y + FLOW_NODE_H / 2;
  const outPort = new Map<string, number>();
  const inPort = new Map<string, number>();
  for (const n of g.names) {
    const kids = [...g.children.get(n)!].sort((a, b) => cy(a) - cy(b) || (a < b ? -1 : 1));
    kids.forEach((c, i) => outPort.set(`${n}->${c}`, box.get(n)!.y + (FLOW_NODE_H * (i + 1)) / (kids.length + 1)));
    const ps = [...g.parents.get(n)!].sort((a, b) => cy(a) - cy(b) || (a < b ? -1 : 1));
    ps.forEach((p, i) => inPort.set(`${p}->${n}`, box.get(n)!.y + (FLOW_NODE_H * (i + 1)) / (ps.length + 1)));
  }

  // 4. pipes: vertical runs in gutters (greedy interval colouring into tracks),
  //    long spans ride a free horizontal channel across the skipped columns.
  const gutterX0 = (d: number) => columns[d].x + FLOW_NODE_W;
  const gutterW = FLOW_COL_W - FLOW_NODE_W;
  type VSeg = { pipe: number; gutter: number; y0: number; y1: number; track: number };
  const vsegs: VSeg[] = [];
  const hChannels: { x0: number; x1: number; y: number }[] = [];
  const plans: { e: (typeof g.edges)[number]; sy: number; ty: number; chan: number | null }[] = [];
  const edges = [...g.edges].sort((a, b) =>
    (a.from < b.from ? -1 : a.from > b.from ? 1 : 0) || (a.to < b.to ? -1 : 1));
  edges.forEach((e, pi) => {
    const dp = g.depth.get(e.from)!;
    const dc = g.depth.get(e.to)!;
    const sy = outPort.get(`${e.from}->${e.to}`)!;
    const ty = inPort.get(`${e.from}->${e.to}`)!;
    if (dc === dp + 1) {
      vsegs.push({ pipe: pi, gutter: dp, y0: Math.min(sy, ty), y1: Math.max(sy, ty), track: 0 });
      plans.push({ e, sy, ty, chan: null });
      return;
    }
    const x0 = gutterX0(dp);
    const x1 = gutterX0(dc - 1) + gutterW;
    const blockers: Box[] = [];
    for (const [n, b] of box) if (g.depth.get(n)! > dp && g.depth.get(n)! < dc) blockers.push(b);
    let chan = sy;
    let bestC = Infinity;
    for (let yy = FLOW_CHANNEL_CLEAR; yy <= height - FLOW_CHANNEL_CLEAR; yy += 2) {
      if (blockers.some((b) => yy > b.y - FLOW_CHANNEL_CLEAR && yy < b.y + b.h + FLOW_CHANNEL_CLEAR)) continue;
      if (hChannels.some((h) => h.x0 < x1 && x0 < h.x1 && Math.abs(h.y - yy) < FLOW_TRACK)) continue;
      const c = Math.abs(yy - sy) + Math.abs(yy - ty) + 0.01 * Math.abs(yy - (sy + ty) / 2);
      if (c < bestC) { bestC = c; chan = yy; }
    }
    hChannels.push({ x0, x1, y: chan });
    vsegs.push({ pipe: pi, gutter: dp, y0: Math.min(sy, chan), y1: Math.max(sy, chan), track: 0 });
    vsegs.push({ pipe: pi, gutter: dc - 1, y0: Math.min(chan, ty), y1: Math.max(chan, ty), track: 0 });
    plans.push({ e, sy, ty, chan });
  });
  // First-fit track colouring, longest runs first: in a hub's fan-out the pipe
  // travelling farthest turns in the leftmost track, so siblings never cross.
  const trackCount = new Map<number, number>();
  for (const gi of [...new Set(vsegs.map((v) => v.gutter))].sort((a, b) => a - b)) {
    const segs = vsegs.filter((v) => v.gutter === gi)
      .sort((a, b) => (b.y1 - b.y0) - (a.y1 - a.y0) || a.y0 - b.y0 || a.pipe - b.pipe);
    const tracks: [number, number][][] = [];
    for (const s of segs) {
      let t = tracks.findIndex((iv) => iv.every(([y0, y1]) => s.y1 < y0 - 1 || s.y0 > y1 + 1));
      if (t < 0) { t = tracks.length; tracks.push([]); }
      tracks[t].push([s.y0, s.y1]);
      s.track = t;
    }
    trackCount.set(gi, tracks.length);
  }
  const trackX = (gi: number, t: number) =>
    gutterX0(gi) + gutterW / 2 + (t - (trackCount.get(gi)! - 1) / 2) * FLOW_TRACK;

  const pipes: FlowPipe[] = plans.map(({ e, sy, ty, chan }, pi) => {
    const sb = box.get(e.from)!;
    const tb = box.get(e.to)!;
    const mine = vsegs.filter((v) => v.pipe === pi);
    const sx = sb.x + sb.w;
    const tx = tb.x;
    let pts: Pt[];
    if (chan === null) {
      const gx = trackX(mine[0].gutter, mine[0].track);
      pts = [{ x: sx, y: sy }, { x: gx, y: sy }, { x: gx, y: ty }, { x: tx, y: ty }];
    } else {
      const g1 = trackX(mine[0].gutter, mine[0].track);
      const g2 = trackX(mine[1].gutter, mine[1].track);
      pts = [{ x: sx, y: sy }, { x: g1, y: sy }, { x: g1, y: chan }, { x: g2, y: chan }, { x: g2, y: ty }, { x: tx, y: ty }];
    }
    pts = simplify(pts);
    return {
      from: e.from, to: e.to, points: pts, length: polylineLength(pts),
      crossLane: laneOf.get(g.family.get(e.from)!) !== laneOf.get(g.family.get(e.to)!),
    };
  });

  const nodes: FlowNode[] = g.names.map((n) => {
    const l = laneOf.get(g.family.get(n)!)!;
    const d = g.depth.get(n)!;
    return { name: n, family: g.family.get(n)!, depth: d, lane: l, col: d, order: cells[l][d].indexOf(n), box: box.get(n)! };
  });
  return { width, height, lanes, columns, nodes, pipes, crossings: bestX, seedCrossings };
}

/** Drop duplicate and collinear interior points. */
function simplify(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (q && Math.abs(q.x - p.x) < 1e-9 && Math.abs(q.y - p.y) < 1e-9) continue;
    if (out.length >= 2) {
      const a = out[out.length - 2];
      const b = out[out.length - 1];
      if ((Math.abs(a.x - b.x) < 1e-9 && Math.abs(b.x - p.x) < 1e-9) || (Math.abs(a.y - b.y) < 1e-9 && Math.abs(b.y - p.y) < 1e-9)) {
        out[out.length - 1] = p;
        continue;
      }
    }
    out.push(p);
  }
  return out;
}
