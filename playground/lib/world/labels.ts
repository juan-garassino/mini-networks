// Step 6 — labels. Greedy placement over 8 anchors × rings; atoms first, then
// the longest names. Hard: inside the world, never over a footprint,
// set-piece, bridge or another label. Soft: roads, water, foreign regions.
import type { Anchor, Box, Bridge, Label, WorldOptions } from "./types.ts";
import { T } from "./types.ts";
import type { Graph } from "./graph.ts";
import type { RegionGrid } from "./regions.ts";
import {
  ANCHOR_COST, FONT_ATOM, FONT_DERIVED, LABEL_CHAR_W, LABEL_COST_FOREIGN, LABEL_COST_ROAD,
  LABEL_COST_AMBIGUOUS, LABEL_COST_NEAR_FOREIGN, LABEL_COST_WATER, LABEL_GAP, LABEL_NEAR_FOREIGN, LABEL_LINE_H, LABEL_PAD_H, LABEL_PAD_W, LABEL_RING_COST,
  LABEL_RINGS, TILE,
} from "./constants.ts";

export function defaultMeasure(text: string, font: 13 | 15) {
  return { w: LABEL_CHAR_W * font * text.length + LABEL_PAD_W, h: LABEL_LINE_H * font + LABEL_PAD_H };
}

export const boxesOverlap = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const boxDist = (a: Box, b: Box) => {
  const dx = Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w));
  const dy = Math.max(0, b.y - (a.y + a.h), a.y - (b.y + b.h));
  return Math.hypot(dx, dy);
};

const ANCHORS: Anchor[] = ["S", "N", "E", "W", "SE", "SW", "NE", "NW"];

export function placeLabels(
  g: Graph, rg: RegionGrid, foot: Map<string, Box>, setPiece: (Box | null)[],
  bridges: Bridge[], opts: WorldOptions,
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
    const L = f.x * TILE;
    const R = (f.x + f.w) * TILE;
    const Tp = f.y * TILE;
    const B = (f.y + f.h) * TILE;
    const cx = (L + R) / 2;
    const cy = (Tp + B) / 2;
    const own = famId.get(g.family.get(name)!)!;
    let best: Label | null = null;
    let bestCost = Infinity;
    for (let ring = 0; ring < LABEL_RINGS; ring++) {
      const o = LABEL_GAP + ring * TILE;
      // 8 anchors, plus S/N slid a quarter-label either way and E/W slid half a
      // line up/down (cost of the diagonal they lean toward) as extra fallbacks
      const cands: [Anchor, number, number, number][] = [];
      for (const anchor of ANCHORS) {
        switch (anchor) {
          case "S": cands.push(["S", cx - w / 2, B + o, 0]); break;
          case "N": cands.push(["N", cx - w / 2, Tp - o - h, 0]); break;
          case "E": cands.push(["E", R + o, cy - h / 2, 0]); break;
          case "W": cands.push(["W", L - o - w, cy - h / 2, 0]); break;
          case "SE": cands.push(["SE", L, B + o, 0], ["SE", cx - w / 4, B + o, 0], ["SE", R + o, cy, 0]); break;
          case "SW": cands.push(["SW", R - w, B + o, 0], ["SW", cx - (3 * w) / 4, B + o, 0], ["SW", L - o - w, cy, 0]); break;
          case "NE": cands.push(["NE", L, Tp - o - h, 0], ["NE", cx - w / 4, Tp - o - h, 0], ["NE", R + o, cy - h, 0]); break;
          default: cands.push(["NW", R - w, Tp - o - h, 0], ["NW", cx - (3 * w) / 4, Tp - o - h, 0], ["NW", L - o - w, cy - h, 0]); break;
        }
      }
      for (const [anchor, x, y] of cands) {
        const box = { x, y, w, h };
        if (x < 0 || y < 0 || x + w > W || y + h > H) continue;
        let cost = ANCHOR_COST[anchor] + ring * LABEL_RING_COST;
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
            if (t === T.ROAD) cost += LABEL_COST_ROAD * frac;
            if (t === T.SEA || t === T.RIVER) cost += LABEL_COST_WATER * frac;
            if (regionOf[i] >= 0 && regionOf[i] !== own) cost += LABEL_COST_FOREIGN * frac;
          }
        }
        if (!ok || cost >= bestCost) continue;
        if (labels.some((l) => boxesOverlap(l.box, box))) continue;
        // a label nearer someone else's footprint than its own reads as theirs
        const dOwn = boxDist(box, { x: L, y: Tp, w: R - L, h: B - Tp });
        for (const [other, fb] of footPx) {
          if (other === name) continue;
          const d = boxDist(box, fb);
          if (d < LABEL_NEAR_FOREIGN) cost += LABEL_COST_NEAR_FOREIGN;
          if (d < dOwn + LABEL_NEAR_FOREIGN) cost += LABEL_COST_AMBIGUOUS;
        }
        if (cost >= bestCost) continue;
        bestCost = cost;
        best = { node: name, text: name, font, box, anchor };
      }
    }
    if (best) labels.push(best);
    else failures.push(`no label spot for ${name}`);
  }
  labels.sort((a, b) => (a.node < b.node ? -1 : 1));
  return { labels, failures };
}
