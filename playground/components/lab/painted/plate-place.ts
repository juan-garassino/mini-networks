// Where the "How it works" plate goes on the map, and how the camera frames it.
//
// The plate is a vignette anchored beside the selected castle: it lives in map
// space (it follows the castle through pans and zooms) but keeps its own size
// in screen px so its pixels stay crisp. A leader line runs straight from the
// castle to the plate's nearest edge, so the castle's coordinate along that
// edge always falls inside the plate's span (never a bent line).
//
// composePlate picks, together, the camera scale, where the castle sits on
// screen, the side of the castle the plate hangs on (right / left / below /
// above) and how far the plate slides along that side. It is a small search:
//   for each candidate scale (the land-fit scale first, then a step or two out)
//     for each side and slide
//       the castle + plate pair must fit the visible map area, the plate may not
//       touch a corner plate, the camera may not leave the painting (paper);
//       among the castle positions that work, take the one nearest the
//       land-centred framing
//   cost = scale steps out + what the plate covers (lineage first) + how far
//   the castle moved from where the land-centred framing puts it + how much of
//   the land ends up off screen or under the plate. The cheapest wins.
// Pure: no React, no DOM — tested in plate-place.test.ts.

export interface PBox { x: number; y: number; w: number; h: number }
export interface PPt { x: number; y: number }
export type PlateSide = "right" | "left" | "below" | "above";

export interface PlateInput {
  /** the castle (map units) */
  anchor: PPt;
  /** the castle's clearance box around the anchor, map units, relative to it */
  castle: PBox;
  /** extra screen px kept clear around the castle (its name ribbon) */
  castlePad: number;
  /** the plate's size, CSS px */
  plate: { w: number; h: number };
  /** candidate scales (CSS px per map unit), the preferred one first */
  scales: number[];
  /** the land the castle is in (map units): the framing the camera centres on */
  land: PBox;
  /** the visible map area (left of the drawer), CSS px */
  view: PBox;
  /** inset of the safe area inside `view` */
  inset: number;
  /** screen rects the plate must not touch (corner plates), CSS px */
  avoid: PBox[];
  /** map-unit points the plate should not cover, by weight */
  keep: { pts: PPt[]; weight: number }[];
  /** leader length, CSS px */
  gap: number;
  /** map-unit boxes the plate may not touch (paper: the painter's land titles,
   * which can neither move nor hide); in `fixed` mode they count as spill */
  block?: PBox[];
  /** map-unit boxes the plate should cover as little of as it can (paper: the
   * land titles, once no placement keeps fully off them) — cost per px² */
  soft?: PBox[];
  /** paper: the camera may not show past the painting (map size, map units) */
  bounded?: { w: number; h: number };
  /** last resort: the camera is fixed and the castle sits here (CSS px); the
   * plate takes the side that spills least out of the safe area */
  fixed?: PPt;
}

export interface PlatePlan {
  k: number;
  /** the castle's resting screen position, CSS px (from which the camera follows) */
  at: PPt;
  side: PlateSide;
  /** where the castle falls along the plate's near edge, 0..1 */
  slide: number;
  /** the leader's length, CSS px: the input's gap, or longer to reach past a
   * blocked box beside the castle (paper: its own name plate) */
  gap: number;
  cost: number;
}

const SIDES: PlateSide[] = ["right", "left", "below", "above"];
const SLIDES = [0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9];
const STEP_COST = 220;   // one scale step out ≈ covering a lineage castle
const DEVIATION = 0.5;   // per px the castle moves off its land-centred spot
const LAND_COST = 700;   // the whole land hidden (off screen or under the plate)
const SOFT_COST = 1 / 30; // per px² of a soft box (a painted title) under the plate: a 300×60 title ≈ 600
const LONG_LEADER = 0.6; // per px the leader runs past the standard gap

const hits = (a: PBox, b: PBox, m = 0) =>
  a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
const inside = (p: PPt, b: PBox, m = 0) => p.x >= b.x - m && p.x <= b.x + b.w + m && p.y >= b.y - m && p.y <= b.y + b.h + m;

/** The plate's rect relative to the castle's screen position, at scale k. */
export function plateRect(side: PlateSide, slide: number, castle: PBox, k: number, plate: { w: number; h: number }, gap: number): PBox {
  const x0 = castle.x * k, x1 = (castle.x + castle.w) * k, y0 = castle.y * k, y1 = (castle.y + castle.h) * k;
  switch (side) {
    case "right": return { x: x1 + gap, y: -slide * plate.h, w: plate.w, h: plate.h };
    case "left": return { x: x0 - gap - plate.w, y: -slide * plate.h, w: plate.w, h: plate.h };
    case "below": return { x: -slide * plate.w, y: y1 + gap, w: plate.w, h: plate.h };
    case "above": return { x: -slide * plate.w, y: y0 - gap - plate.h, w: plate.w, h: plate.h };
  }
}

export function composePlate(inp: PlateInput): PlatePlan | null {
  const { anchor: a, castle, plate, view, inset, gap } = inp;
  const safe = { x: view.x + inset, y: view.y + inset, w: view.w - 2 * inset, h: view.h - 2 * inset };
  const lc = { x: inp.land.x + inp.land.w / 2, y: inp.land.y + inp.land.h / 2 };
  const ov = (p: PBox, q: PBox) => Math.max(0, Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x)) * Math.max(0, Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y));
  const clampTo = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  let best: PlatePlan | null = null;
  inp.scales.forEach((k, step) => {
    // the castle where the land-centred framing puts it
    const c0 = { x: view.x + view.w / 2 + (a.x - lc.x) * k, y: view.y + view.h / 2 + (a.y - lc.y) * k };
    // everything that lives in map space moves with the castle, so its
    // relation to the plate depends only on (scale, side, slide): blocked
    // boxes and the points to keep clear are taken relative to the castle
    const blocksRel = (inp.block ?? []).map((b) => ({ x: (b.x - a.x) * k, y: (b.y - a.y) * k, w: b.w * k, h: b.h * k }));
    const keepRel = inp.keep.map((g) => ({ weight: g.weight, pts: g.pts.map((p) => ({ x: (p.x - a.x) * k, y: (p.y - a.y) * k })) }));
    const cb = { x: castle.x * k - inp.castlePad, y: castle.y * k - inp.castlePad, w: castle.w * k + 2 * inp.castlePad, h: castle.h * k + 2 * inp.castlePad };
    const softRel = (inp.soft ?? []).map((b) => ({ x: (b.x - a.x) * k, y: (b.y - a.y) * k, w: b.w * k, h: b.h * k }));
    for (const side of SIDES) {
      // the leader's length: the standard gap, or just long enough for the
      // plate to clear a blocked box on that side of the castle (≤ 3 gaps)
      const near = side === "right" ? (castle.x + castle.w) * k : side === "left" ? -castle.x * k : side === "below" ? (castle.y + castle.h) * k : -castle.y * k;
      const gaps = [gap, ...blocksRel.map((b) => (side === "right" ? b.x + b.w : side === "left" ? -b.x : side === "below" ? b.y + b.h : -b.y) + 6 - near)
        .filter((g) => g > gap && g <= 3 * gap).map(Math.ceil)];
      // besides the standard slides, the ones that tuck the plate just past a
      // blocked box's edge (paper: a painted land title above or below it)
      const vertical = side === "right" || side === "left";
      const span = vertical ? plate.h : plate.w;
      const edgeSlides = blocksRel.flatMap((b) => {
        const lo = vertical ? b.y : b.x, hi = vertical ? b.y + b.h : b.x + b.w;
        return [-(hi + 6) / span, 1 - (lo - 6) / span];
      }).filter((v) => v >= 0.04 && v <= 0.96);
      const slides = [...new Set([...SLIDES, ...edgeSlides].map((v) => Math.round(v * 100) / 100))];
      for (const g of [...new Set(gaps)]) {
        for (const slide of slides) {
          const pr = plateRect(side, slide, castle, k, plate, g);
          // the plate and its leader (castle → the plate's near edge), castle-relative
          const lead = side === "right" ? { x: 0, y: -6, w: pr.x, h: 12 } : side === "left" ? { x: pr.x + pr.w, y: -6, w: -pr.x - pr.w, h: 12 }
            : side === "below" ? { x: -6, y: 0, w: 12, h: pr.y } : { x: -6, y: pr.y + pr.h, w: 12, h: -pr.y - pr.h };
          if (!inp.fixed && blocksRel.some((o) => hits(pr, o, 4) || hits(lead, o, 2))) continue;
          let keepCost = (g - gap) * LONG_LEADER;
          for (const grp of keepRel) for (const p of grp.pts) if (inside(p, pr, 6)) keepCost += grp.weight;
          for (const b of softRel) keepCost += ov(pr, b) * SOFT_COST;
          const bx0 = Math.min(cb.x, pr.x), by0 = Math.min(cb.y, pr.y);
          const bx1 = Math.max(cb.x + cb.w, pr.x + pr.w), by1 = Math.max(cb.y + cb.h, pr.y + pr.h);
          // castle screen positions that keep the pair inside the safe area
          let lox = safe.x - bx0, hix = safe.x + safe.w - bx1, loy = safe.y - by0, hiy = safe.y + safe.h - by1;
          if (inp.bounded) {
            // camera x = a.x - cx / k must stay in [0, W - view.w / k] (view starts at 0)
            lox = Math.max(lox, (a.x - (inp.bounded.w - (view.x + view.w) / k)) * k);
            hix = Math.min(hix, a.x * k);
            loy = Math.max(loy, (a.y - (inp.bounded.h - (view.y + view.h) / k)) * k);
            hiy = Math.min(hiy, a.y * k);
          }
          let xs: number[], ys: number[];
          if (inp.fixed) { xs = [inp.fixed.x]; ys = [inp.fixed.y]; }
          else {
            if (lox > hix + 1e-6 || loy > hiy + 1e-6) continue;
            // candidates: the land-centred spot, the range's ends, an even grid
            // across it, and the spots that put the plate (or the castle) just
            // clear of a corner plate's edge — the room between two corner
            // plates is often exactly one such slot
            const cand = (lo: number, hi: number, c: number, edges: number[]) => [...new Set(
              [clampTo(c, lo, hi), lo, hi, ...[1, 2, 3, 4, 5].map((i) => lo + ((hi - lo) * i) / 6), ...edges.filter((v) => v >= lo - 1 && v <= hi + 1)]
                .map((v) => Math.round(clampTo(v, lo, hi))))];
            xs = cand(lox, hix, c0.x, inp.avoid.flatMap((o) => [o.x + o.w + 9 - pr.x, o.x - 9 - pr.x - pr.w, o.x + o.w + 5 - cb.x, o.x - 5 - cb.x - cb.w]));
            ys = cand(loy, hiy, c0.y, inp.avoid.flatMap((o) => [o.y + o.h + 9 - pr.y, o.y - 9 - pr.y - pr.h, o.y + o.h + 5 - cb.y, o.y - 5 - cb.y - cb.h]));
          }
          for (const cx of xs) for (const cy of ys) {
            const r = { x: cx + pr.x, y: cy + pr.y, w: pr.w, h: pr.h };
            let spill = 0;
            if (inp.fixed) {
              // what falls outside the safe area or on a corner plate, in px²/100
              const ix = Math.max(0, Math.min(r.x + r.w, safe.x + safe.w) - Math.max(r.x, safe.x));
              const iy = Math.max(0, Math.min(r.y + r.h, safe.y + safe.h) - Math.max(r.y, safe.y));
              spill = (r.w * r.h - ix * iy) / 100;
              for (const o of [...inp.avoid, ...blocksRel.map((b) => ({ ...b, x: b.x + cx, y: b.y + cy }))]) spill += ov(r, o) / 100;
            } else {
              if (cx < lox - 1 || cx > hix + 1 || cy < loy - 1 || cy > hiy + 1) continue;
              if (inp.avoid.some((o) => hits(r, o, 8))) continue;
              // the castle (and its name) keeps off the corner plates too
              const cs = { x: cx + cb.x, y: cy + cb.y, w: cb.w, h: cb.h };
              if (inp.avoid.some((o) => hits(cs, o, 4))) continue;
            }
            // how much of the land stays in view and uncovered
            const L = { x: cx + (inp.land.x - a.x) * k, y: cy + (inp.land.y - a.y) * k, w: inp.land.w * k, h: inp.land.h * k };
            const shown = Math.max(0, ov(L, view) - ov(L, r)) / Math.max(1, L.w * L.h);
            const cost = step * STEP_COST + spill + keepCost + LAND_COST * (1 - shown) + DEVIATION * Math.hypot(cx - c0.x, cy - c0.y);
            if (!best || cost < best.cost) best = { k, at: { x: cx, y: cy }, side, slide, gap: g, cost };
          }
        }
      }
    }
  });
  return best;
}

/** Points every `every` map units along a polyline (the lit lineage roads). */
export function sample(pts: PPt[], every: number): PPt[] {
  const out: PPt[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / every));
    for (let j = 0; j < n; j++) out.push({ x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n });
  }
  if (pts.length) out.push(pts[pts.length - 1]);
  return out;
}
