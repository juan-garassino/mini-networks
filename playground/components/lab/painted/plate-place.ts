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
  cost: number;
}

const SIDES: PlateSide[] = ["right", "left", "below", "above"];
const SLIDES = [0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9];
const STEP_COST = 220;   // one scale step out ≈ covering a lineage castle
const DEVIATION = 0.5;   // per px the castle moves off its land-centred spot
const LAND_COST = 700;   // the whole land hidden (off screen or under the plate)

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
  let best: PlatePlan | null = null;
  inp.scales.forEach((k, step) => {
    // the castle where the land-centred framing puts it
    const c0 = { x: view.x + view.w / 2 + (a.x - lc.x) * k, y: view.y + view.h / 2 + (a.y - lc.y) * k };
    // the blocked map boxes on screen, for a castle resting at (cx, cy)
    const blocks = (cx: number, cy: number) => (inp.block ?? []).map((b) => ({ x: cx + (b.x - a.x) * k, y: cy + (b.y - a.y) * k, w: b.w * k, h: b.h * k }));
    const cb = { x: castle.x * k - inp.castlePad, y: castle.y * k - inp.castlePad, w: castle.w * k + 2 * inp.castlePad, h: castle.h * k + 2 * inp.castlePad };
    for (const side of SIDES) for (const slide of SLIDES) {
      const pr = plateRect(side, slide, castle, k, plate, gap);
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
      const clampTo = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
      let xs: number[], ys: number[];
      if (inp.fixed) { xs = [inp.fixed.x]; ys = [inp.fixed.y]; }
      else {
        if (lox > hix + 1e-6 || loy > hiy + 1e-6) continue;
        xs = [...new Set([clampTo(c0.x, lox, hix), lox, hix].map(Math.round))];
        ys = [...new Set([clampTo(c0.y, loy, hiy), loy, hiy].map(Math.round))];
      }
      for (const cx of xs) for (const cy of ys) {
        const r = { x: cx + pr.x, y: cy + pr.y, w: pr.w, h: pr.h };
        let spill = 0;
        if (inp.fixed) {
          // what falls outside the safe area or on a corner plate, in px²/100
          const ix = Math.max(0, Math.min(r.x + r.w, safe.x + safe.w) - Math.max(r.x, safe.x));
          const iy = Math.max(0, Math.min(r.y + r.h, safe.y + safe.h) - Math.max(r.y, safe.y));
          spill = (r.w * r.h - ix * iy) / 100;
          for (const o of [...inp.avoid, ...blocks(cx, cy)]) {
            const ox = Math.max(0, Math.min(r.x + r.w, o.x + o.w) - Math.max(r.x, o.x)), oy = Math.max(0, Math.min(r.y + r.h, o.y + o.h) - Math.max(r.y, o.y));
            spill += (ox * oy) / 100;
          }
        } else {
          if (cx < lox - 1 || cx > hix + 1 || cy < loy - 1 || cy > hiy + 1) continue;
          if (inp.avoid.some((o) => hits(r, o, 8))) continue;
          // the plate and its leader (castle → the plate's near edge)
          const lead = side === "right" ? { x: cx, y: cy - 6, w: r.x - cx, h: 12 } : side === "left" ? { x: r.x + r.w, y: cy - 6, w: cx - r.x - r.w, h: 12 }
            : side === "below" ? { x: cx - 6, y: cy, w: 12, h: r.y - cy } : { x: cx - 6, y: r.y + r.h, w: 12, h: cy - r.y - r.h };
          if (blocks(cx, cy).some((o) => hits(r, o, 4) || hits(lead, o, 2))) continue;
        }
        // the castle (and its name) keeps off the corner plates too
        const cs = { x: cx + cb.x, y: cy + cb.y, w: cb.w, h: cb.h };
        if (!inp.fixed && inp.avoid.some((o) => hits(cs, o, 4))) continue;
        let cover = spill;
        // how much of the land stays in view and uncovered
        const L = { x: cx + (inp.land.x - a.x) * k, y: cy + (inp.land.y - a.y) * k, w: inp.land.w * k, h: inp.land.h * k };
        const ov = (p: PBox, q: PBox) => Math.max(0, Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x)) * Math.max(0, Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y));
        const shown = Math.max(0, ov(L, view) - ov(L, r)) / Math.max(1, L.w * L.h);
        cover += LAND_COST * (1 - shown);
        for (const grp of inp.keep) for (const p of grp.pts) {
          if (inside({ x: cx + (p.x - a.x) * k, y: cy + (p.y - a.y) * k }, r, 6)) cover += grp.weight;
        }
        const cost = step * STEP_COST + cover + DEVIATION * Math.hypot(cx - c0.x, cy - c0.y);
        if (!best || cost < best.cost) best = { k, at: { x: cx, y: cy }, side, slide, cost };
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
