// Step 6 — labels. Greedy placement over 8 anchors × rings × sideways slides;
// atoms first, then the longest names. Hard: inside the world, never over a
// footprint, set-piece, bridge, ROAD (v2) or another label; clear of other
// footprints by LABEL_FOOT_CLEAR. Soft: water, foreign regions, ambiguity.
//
// v2 also reserves a label band per node BEFORE roads are routed
// (labelZones): the side facing away from the node's edges. Roads pay to
// enter a band, so labels usually find their preferred side clean.
import type { Anchor, Box, Bridge, Label, WorldOptions } from "./types.ts";
import { T } from "./types.ts";
import type { Graph } from "./graph.ts";
import type { RegionGrid } from "./regions.ts";
import {
  ANCHOR_COST, FONT_ATOM, FONT_DERIVED, LABEL_CHAR_W, LABEL_COST_FOREIGN, LABEL_COST_AMBIGUOUS,
  LABEL_COST_NEAR_FOREIGN, LABEL_COST_WATER, LABEL_FOOT_CLEAR, LABEL_GAP, LABEL_LABEL_CLEAR, LABEL_LINE_H,
  LABEL_NEAR_FOREIGN, LABEL_PAD_H, LABEL_PAD_W, LABEL_RING_COST, LABEL_RING_STEP, LABEL_RINGS,
  LABEL_RINGS_MAX, LABEL_SLIDE_COST, TILE,
} from "./constants.ts";

export function defaultMeasure(text: string, font: 13 | 15) {
  return { w: LABEL_CHAR_W * font * text.length + LABEL_PAD_W, h: LABEL_LINE_H * font + LABEL_PAD_H };
}

export const boxesOverlap = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export const boxDist = (a: Box, b: Box) => {
  const dx = Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w));
  const dy = Math.max(0, b.y - (a.y + a.h), a.y - (b.y + b.h));
  return Math.hypot(dx, dy);
};

const SIDES: { a: Anchor; ang: number }[] = [
  { a: "S", ang: Math.PI / 2 }, { a: "N", ang: -Math.PI / 2 }, { a: "E", ang: 0 }, { a: "W", ang: Math.PI },
];
/** an edge whose bearing is within this of a side's direction "uses" that side. */
const SIDE_CONE = (65 * Math.PI) / 180;

/** px label box for `anchor` at offset `o` with a sideways slide `s`. */
function candBox(anchor: Anchor, f: Box, w: number, h: number, o: number, s: number): Box {
  const L = f.x * TILE;
  const R = (f.x + f.w) * TILE;
  const Tp = f.y * TILE;
  const B = (f.y + f.h) * TILE;
  const cx = (L + R) / 2;
  const cy = (Tp + B) / 2;
  switch (anchor) {
    case "S": return { x: cx - w / 2 + s, y: B + o, w, h };
    case "N": return { x: cx - w / 2 + s, y: Tp - o - h, w, h };
    case "E": return { x: R + o, y: cy - h / 2 + s, w, h };
    case "W": return { x: L - o - w, y: cy - h / 2 + s, w, h };
    case "SE": return { x: R + o, y: B + o, w, h };
    case "SW": return { x: L - o - w, y: B + o, w, h };
    case "NE": return { x: R + o, y: Tp - o - h, w, h };
    default: return { x: L - o - w, y: Tp - o - h, w, h };
  }
}

/**
 * Preferred label side per node (the side facing away from its edges) and a
 * tile mask of every node's ring-0 label box on that side.
 */
export function labelZones(
  g: Graph, rg: RegionGrid, foot: Map<string, Box>, opts: WorldOptions,
): { zone: Uint8Array; prefer: Map<string, Anchor> } {
  const { cols, rows } = rg;
  const measure = opts.measure ?? defaultMeasure;
  const zone = new Uint8Array(cols * rows);
  const prefer = new Map<string, Anchor>();
  const ctr = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  for (const [name, f] of foot) {
    const c = ctr(f);
    const bearings: number[] = [];
    for (const o of [...g.parents.get(name)!, ...g.children.get(name)!]) {
      const ob = foot.get(o);
      if (!ob) continue;
      const oc = ctr(ob);
      bearings.push(Math.atan2(oc.y - c.y, oc.x - c.x));
    }
    let best: Anchor = "S";
    let bestCost = Infinity;
    for (const { a, ang } of SIDES) {
      let used = 0;
      for (const b of bearings) {
        let d = Math.abs(b - ang);
        if (d > Math.PI) d = 2 * Math.PI - d;
        if (d < SIDE_CONE) used++;
      }
      const cost = 2 * used + ANCHOR_COST[a];
      if (cost < bestCost) { bestCost = cost; best = a; }
    }
    prefer.set(name, best);
    const font = g.atom.get(name) ? FONT_ATOM : FONT_DERIVED;
    const { w, h } = measure(name, font);
    const b = candBox(best, f, w, h, LABEL_GAP, 0);
    const tx0 = Math.max(0, Math.floor(b.x / TILE));
    const ty0 = Math.max(0, Math.floor(b.y / TILE));
    const tx1 = Math.min(cols - 1, Math.floor((b.x + b.w - 1e-6) / TILE));
    const ty1 = Math.min(rows - 1, Math.floor((b.y + b.h - 1e-6) / TILE));
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) zone[ty * cols + tx] = 1;
  }
  return { zone, prefer };
}

export function placeLabels(
  g: Graph, rg: RegionGrid, foot: Map<string, Box>, setPiece: (Box | null)[],
  bridges: Bridge[], opts: WorldOptions, prefer: Map<string, Anchor> = new Map(),
): { labels: Label[]; failures: string[] } {
  const { cols, rows, regionOf, terrain } = rg;
  const measure = opts.measure ?? defaultMeasure;
  const W = cols * TILE;
  const H = rows * TILE;
  const hard = new Uint8Array(cols * rows);
  const mark = (b: Box) => {
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) hard[y * cols + x] = 1;
  };
  for (const b of foot.values()) mark(b);
  for (const b of setPiece) if (b) mark(b);
  for (const br of bridges) for (const t of br.tiles) hard[t] = 1;
  // v2: labels never sit on a road (the owner saw "resnet" etc. on roads)
  for (let i = 0; i < hard.length; i++) if (terrain[i] === T.ROAD || terrain[i] === T.BRIDGE) hard[i] = 1;

  const famId = new Map(rg.regions.map((r) => [r.family, r.id]));
  const footPx = [...foot].map(([k, b]) => [k, { x: b.x * TILE, y: b.y * TILE, w: b.w * TILE, h: b.h * TILE }] as const);
  const order = [...foot.keys()].sort((a, b) =>
    Number(g.atom.get(b)) - Number(g.atom.get(a)) || b.length - a.length || (a < b ? -1 : 1));
  const labels: Label[] = [];
  const failures: string[] = [];
  for (const name of order) {
    const f = foot.get(name)!;
    const font = g.atom.get(name) ? FONT_ATOM : FONT_DERIVED;
    const { w, h } = measure(name, font);
    const own = famId.get(g.family.get(name)!)!;
    const ownPx = { x: f.x * TILE, y: f.y * TILE, w: f.w * TILE, h: f.h * TILE };
    const pref = prefer.get(name);
    let best: Label | null = null;
    let bestCost = Infinity;
    // S/N labels slide sideways while still overlapping the footprint's
    // x-range; E/W labels slide vertically likewise. A slide past half the
    // label reads as the diagonal it leans toward.
    const maxSX = w / 2 + ownPx.w / 2 - 6;
    const maxSY = h / 2 + ownPx.h / 2 - 4;
    const slidesX = [0, -w / 4, w / 4, -w / 2, w / 2, -maxSX, maxSX].filter((v, i, a) => Math.abs(v) <= maxSX && a.indexOf(v) === i);
    const slidesY = [0, -h / 2, h / 2, -maxSY, maxSY].filter((v, i, a) => Math.abs(v) <= maxSY && a.indexOf(v) === i);
    // rings beyond LABEL_RINGS are a last resort, tried only while nothing fits
    for (let ring = 0; ring < LABEL_RINGS_MAX && (ring < LABEL_RINGS || !best); ring++) {
      const o = LABEL_GAP + ring * LABEL_RING_STEP;
      const ringCost = (ring * LABEL_RING_STEP * LABEL_RING_COST) / TILE;
      const cands: [Anchor, Box, number][] = [];
      for (const a of ["S", "N"] as const) {
        for (const s of slidesX) {
          const lean: Anchor = Math.abs(s) < w / 2 ? a : (`${a}${s > 0 ? "E" : "W"}` as Anchor);
          cands.push([lean, candBox(a, f, w, h, o, s), ANCHOR_COST[a] + Math.abs(s) * LABEL_SLIDE_COST]);
        }
      }
      for (const a of ["E", "W"] as const) {
        for (const s of slidesY) {
          const lean: Anchor = Math.abs(s) < h ? a : (`${s > 0 ? "S" : "N"}${a}` as Anchor);
          cands.push([lean, candBox(a, f, w, h, o, s), ANCHOR_COST[a] + Math.abs(s) * LABEL_SLIDE_COST]);
        }
      }
      for (const a of ["SE", "SW", "NE", "NW"] as const) cands.push([a, candBox(a, f, w, h, o, 0), ANCHOR_COST[a]]);
      for (const [anchor, box, base] of cands) {
        const { x, y } = box;
        if (x < 0 || y < 0 || x + w > W || y + h > H) continue;
        let cost = base + ringCost + (pref && anchor === pref ? -0.25 : 0);
        if (cost >= bestCost) continue;
        const tx0 = Math.floor(x / TILE);
        const ty0 = Math.floor(y / TILE);
        const tx1 = Math.min(cols - 1, Math.floor((x + w - 1e-6) / TILE));
        const ty1 = Math.min(rows - 1, Math.floor((y + h - 1e-6) / TILE));
        let ok = true;
        for (let ty = ty0; ty <= ty1 && ok; ty++) {
          const oy = Math.min(y + h, (ty + 1) * TILE) - Math.max(y, ty * TILE);
          for (let tx = tx0; tx <= tx1; tx++) {
            const i = ty * cols + tx;
            if (hard[i]) { ok = false; break; }
            const ox = Math.min(x + w, (tx + 1) * TILE) - Math.max(x, tx * TILE);
            const frac = (ox * oy) / (TILE * TILE);
            const t = terrain[i];
            if (t === T.SEA || t === T.RIVER) cost += LABEL_COST_WATER * frac;
            if (regionOf[i] >= 0 && regionOf[i] !== own) cost += LABEL_COST_FOREIGN * frac;
          }
        }
        if (!ok || cost >= bestCost) continue;
        if (labels.some((l) => boxDist(l.box, box) < LABEL_LABEL_CLEAR)) continue;
        // a label nearer someone else's footprint than its own reads as theirs
        const dOwn = boxDist(box, ownPx);
        for (const [other, fb] of footPx) {
          if (other === name) continue;
          const d = boxDist(box, fb);
          if (d < LABEL_FOOT_CLEAR) { ok = false; break; }
          if (d < LABEL_NEAR_FOREIGN) cost += LABEL_COST_NEAR_FOREIGN;
          if (d < dOwn + LABEL_NEAR_FOREIGN) cost += LABEL_COST_AMBIGUOUS;
        }
        if (!ok || cost >= bestCost) continue;
        bestCost = cost;
        best = { node: name, text: name, font, box: { ...box }, anchor, priority: 0, anchorPt: { x: 0, y: 0 }, preferred: [] };
      }
    }
    if (best) labels.push(best);
    else failures.push(`no label spot for ${name}`);
  }
  // v2 screen-label metadata: static priority, edge attachment point, side ranking
  const desc = new Map<string, number>();
  const countDesc = (n: string) => {
    const seen = new Set<string>();
    const st = [n];
    while (st.length) for (const c of g.children.get(st.pop()!)!) if (!seen.has(c)) { seen.add(c); st.push(c); }
    return seen.size;
  };
  for (const n of foot.keys()) desc.set(n, countDesc(n));
  const rank = [...foot.keys()].sort((a, b) =>
    Number(g.atom.get(b)) - Number(g.atom.get(a)) || desc.get(b)! - desc.get(a)! ||
    g.depth.get(a)! - g.depth.get(b)! || (a < b ? -1 : 1));
  const prio = new Map(rank.map((n, i) => [n, rank.length - i]));
  for (const l of labels) {
    const f = foot.get(l.node)!;
    const fx0 = f.x * TILE, fy0 = f.y * TILE, fx1 = (f.x + f.w) * TILE, fy1 = (f.y + f.h) * TILE;
    const cx = l.box.x + l.box.w / 2;
    const cy = l.box.y + l.box.h / 2;
    l.priority = prio.get(l.node)!;
    l.anchorPt = { x: Math.min(fx1, Math.max(fx0, cx)), y: Math.min(fy1, Math.max(fy0, cy)) };
    l.preferred = rankSides(f, l.anchor, hard, cols, rows);
  }
  labels.sort((a, b) => (a.node < b.node ? -1 : 1));
  return { labels, failures };
}

const ALL_ANCHORS: Anchor[] = ["S", "N", "E", "W", "SE", "SW", "NE", "NW"];

/** Sides ranked by blocked tiles (roads, footprints, set-pieces, bridges) in a 3-tile probe band; `first` leads. */
function rankSides(f: Box, first: Anchor, hard: Uint8Array, cols: number, rows: number): Anchor[] {
  const D = 3;
  const probe = (a: Anchor): number => {
    const s = a.includes("S"), n = a.includes("N"), e = a.includes("E"), w = a.includes("W");
    const x0 = e ? f.x + f.w : w ? f.x - D : f.x - 1;
    const x1 = e ? f.x + f.w + D - 1 : w ? f.x - 1 : f.x + f.w;
    const y0 = s ? f.y + f.h : n ? f.y - D + 1 : f.y - 1;
    const y1 = s ? f.y + f.h + D - 2 : n ? f.y - 1 : f.y + f.h;
    let k = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= cols || y >= rows || hard[y * cols + x]) k++;
    }
    return k;
  };
  const cost = new Map(ALL_ANCHORS.map((a) => [a, 3 * probe(a) + ANCHOR_COST[a]]));
  const rest = ALL_ANCHORS.filter((a) => a !== first)
    .sort((a, b) => cost.get(a)! - cost.get(b)! || ALL_ANCHORS.indexOf(a) - ALL_ANCHORS.indexOf(b));
  return [first, ...rest];
}
