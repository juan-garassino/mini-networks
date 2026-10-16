// Ribbon (label) placement on the true map, in ART pixels. A pixel artist's
// rules: a ribbon never covers a landmark, a marker or a banner; it prefers
// open ground or water (low "clutter": few dark outline pixels under it);
// its tail points at its spot; ribbons never overlap if any candidate avoids
// it; everything stays inside the visible part of the map. Greedy by
// priority: the selected model, its lineage, atoms, then derived by depth.
// `hard` boxes (the map plate + its leader) are never covered, not even in
// part: a ribbon that cannot clear them is left out, unless it is `must`
// (the selected model, its lineage) — those reach further out on longer
// stems to clear them.
import type { Box } from "./anchors";
import { RIBBON_MARGIN, ribbonSize, type RibbonSpec, type TailSide } from "./pixel-art";

export interface RibbonItem {
  name: string;
  text: string;
  ax: number;          // the spot (art px)
  ay: number;
  clear: number;       // half-size of the landmark/marker box to keep clear
  banner: boolean;     // an atom's banner flies above the spot
  priority: number;
  loud?: boolean;
  hover?: boolean;
  /** always shown, and never under a hard obstacle if any stem clears it */
  must?: boolean;
}

export interface PlacedRibbon extends RibbonSpec { name: string; box: Box }

const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** The boxes a landmark/marker (and an atom's banner) occupies. */
export function spotBoxes(it: Pick<RibbonItem, "ax" | "ay" | "clear" | "banner">): Box[] {
  const out: Box[] = [{ x: it.ax - it.clear, y: it.ay - it.clear, w: it.clear * 2 + 1, h: it.clear * 2 + 1 }];
  if (it.banner) out.push({ x: it.ax - 1, y: it.ay - 19, w: 14, h: 19 });
  return out;
}

/** Summed-area table of a 0/1 "busy pixel" mask → O(1) clutter per box. */
export function clutterTable(busy: Uint8Array, w: number, h: number): (b: Box) => number {
  const W1 = w + 1;
  const I = new Int32Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += busy[y * w + x];
      I[(y + 1) * W1 + x + 1] = I[y * W1 + x + 1] + row;
    }
  }
  return (b: Box) => {
    const x0 = Math.max(0, Math.floor(b.x)), y0 = Math.max(0, Math.floor(b.y));
    const x1 = Math.min(w, Math.ceil(b.x + b.w)), y1 = Math.min(h, Math.ceil(b.y + b.h));
    if (x1 <= x0 || y1 <= y0) return 0;
    return I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0];
  };
}

export function layoutRibbons(items: RibbonItem[], opts: {
  g: number;
  spots: Box[];          // every landmark/marker/banner on the map (not just labelled ones)
  obstacles: Box[];      // family signs etc.
  bounds: Box;           // the visible part of the map
  clutter?: (b: Box) => number;
  hard?: Box[];          // drawn OVER the map (the map plate, its leader): never partly covered
}): PlacedRibbon[] {
  const hard = opts.hard ?? [];
  const placed: PlacedRibbon[] = [];
  const taken: Box[] = [];
  const order = [...items].sort((a, b) => b.priority - a.priority);
  for (const it of order) {
    const { w, h } = ribbonSize(it.text, opts.g, it.loud);
    const up = it.banner ? 19 : it.clear;
    const cands: { x: number; y: number; tail: TailSide; at: number; stem: number; cost: number }[] = [];
    // below / above / right / left of the spot, at the plain distance or with a
    // longer stem, sliding along the side so the ribbon can find open ground
    for (const stem of it.must && hard.length ? [0, 3, 7, 12, 18, 26] : [0, 3, 7]) {
      const gap = 4 + stem;
      for (const f of [0.5, 0.25, 0.75, 0.1, 0.9]) {
        const lateral = Math.abs(f - 0.5) * 4;
        cands.push({ x: Math.round(it.ax - w * f), y: it.ay + it.clear + gap, tail: "top", at: it.ax, stem, cost: stem * 1.5 + lateral });
        cands.push({ x: Math.round(it.ax - w * f), y: it.ay - up - gap - h + 1, tail: "bottom", at: it.ax, stem, cost: 1 + stem * 1.5 + lateral });
      }
      for (const f of [0.5, 0.2, 0.8]) {
        const lateral = Math.abs(f - 0.5) * 3;
        cands.push({ x: it.ax + it.clear + gap + (it.banner ? 11 : 0), y: Math.round(it.ay - h * f), tail: "left", at: it.ay, stem, cost: 2 + stem * 1.5 + lateral });
        cands.push({ x: it.ax - it.clear - gap - w, y: Math.round(it.ay - h * f), tail: "right", at: it.ay, stem, cost: 2 + stem * 1.5 + lateral });
      }
    }
    const B = opts.bounds;
    let best: (typeof cands)[number] & { score: number; box: Box } = { ...cands[0], score: Infinity, box: { x: 0, y: 0, w: 0, h: 0 } };
    // the tail + stem as a thin column toward the spot (drawRibbon's pointer)
    const tailBox = (c: (typeof cands)[number]): Box => {
      const n = 3 + c.stem;
      const tx = Math.max(c.x + 3, Math.min(c.x + w - 4, c.at)), ty = Math.max(c.y + 3, Math.min(c.y + h - 4, c.at));
      return c.tail === "top" ? { x: tx - 2, y: c.y - n, w: 5, h: n } : c.tail === "bottom" ? { x: tx - 2, y: c.y + h - 1, w: 5, h: n + 1 }
        : c.tail === "left" ? { x: c.x - n, y: ty - 2, w: n, h: 5 } : { x: c.x + w - 1, y: ty - 2, w: n + 1, h: 5 };
    };
    for (const c of cands) {
      const box = { x: c.x - RIBBON_MARGIN, y: c.y - 1, w: w + RIBBON_MARGIN * 2, h: h + 3 };
      let score = c.cost;
      if (box.x < B.x || box.y < B.y || box.x + box.w > B.x + B.w || box.y + box.h > B.y + B.h) score += 1e6;
      for (const t of taken) score += overlap(box, t) * 40;
      for (const s of opts.spots) score += overlap(box, s) * 20;
      for (const o of opts.obstacles) score += overlap(box, o) * 30;
      if (opts.clutter) score += opts.clutter(box) * 0.8;
      if (hard.length) {
        // the whole ribbon, tail and stem included, stays off the plate; and
        // its stem never crosses a placed ribbon (it would cut that one)
        const tb = tailBox(c);
        if (hard.some((o) => overlap(box, o) > 0 || overlap(tb, o) > 0)) score += 1e8;
        for (const t of taken) score += overlap(tb, t) * 400;
      }
      if (score < best.score) best = { ...c, score, box };
    }
    // a label the plate would cut in half is left out instead (must-labels
    // stay); with the plate up, so is one that would sit on, or be cut by, a
    // placed ribbon (stems included)
    const bestTail = tailBox(best);
    if (!it.must && (best.score >= 1e8 || (hard.length && taken.some((t) => overlap(best.box, t) > 0 || overlap(bestTail, t) > 0)))) continue;
    taken.push(best.box);
    if (hard.length) taken.push(bestTail);
    placed.push({
      name: it.name, text: it.text, x: best.x, y: best.y, g: opts.g, tail: best.tail, tailAt: best.at, stem: best.stem,
      loud: it.loud, hover: it.hover, box: best.box,
    });
  }
  // draw order: lowest priority first so the loud ones sit on top
  return placed.reverse();
}
