// placeScreenLabels — constant-size labels in SCREEN space for the current
// camera (skins call it per camera frame). Greedy by priority (focus first):
// each label tries its node's `preferred` sides and keeps the first box that
// stays inside the viewport minus `edgeMargin`, clear of already-placed
// labels and of every projected footprint; otherwise it is culled.
// Pure and deterministic; O(visible nodes × 8 × obstacles).
import type { Anchor, Box, ScreenLabel, World } from "./types.ts";

export interface ScreenLabelOptions {
  /** screen px font: one size for all, or atoms/derived (default 16 / 14). */
  font?: number | { atom: number; derived: number };
  /** node placed first regardless of priority (the skin's focus). */
  focus?: string | null;
  /** label size override in screen px (default w = 0.6·font·chars + 8, h = 1.35·font + 4). */
  measure?: (text: string, font: number) => { w: number; h: number };
  /** px kept clear at every viewport edge (default 24). */
  edgeMargin?: number;
  /** screen px between a label and its footprint (default 4). */
  gap?: number;
}

const PAD = 2; // px kept between two labels

const hit = (a: Box, b: Box, p: number) =>
  a.x < b.x + b.w + p && b.x < a.x + a.w + p && a.y < b.y + b.h + p && b.y < a.y + a.h + p;

/**
 * Camera → screen: the camera box is fitted into the viewport preserving
 * aspect (scale = min(vw/cw, vh/ch)) and centred — the same fit every skin's
 * `frame` uses. Returns labels in placement order (focus first).
 */
export function placeScreenLabels(
  world: World, camera: Box, viewport: { w: number; h: number }, opts: ScreenLabelOptions = {},
): ScreenLabel[] {
  const s = Math.min(viewport.w / camera.w, viewport.h / camera.h);
  const ox = (viewport.w - camera.w * s) / 2 - camera.x * s;
  const oy = (viewport.h - camera.h * s) / 2 - camera.y * s;
  const edge = opts.edgeMargin ?? 24;
  const gap = opts.gap ?? 4;
  const fontOf = (atom: boolean) => {
    const f = opts.font ?? { atom: 16, derived: 14 };
    return typeof f === "number" ? f : atom ? f.atom : f.derived;
  };
  const measure = opts.measure ?? ((t: string, f: number) => ({ w: 0.6 * f * t.length + 8, h: 1.35 * f + 4 }));
  const T = world.tile;
  const inner = { x: edge, y: edge, w: viewport.w - 2 * edge, h: viewport.h - 2 * edge };
  const inside = (b: Box) => b.x >= inner.x && b.y >= inner.y && b.x + b.w <= inner.x + inner.w && b.y + b.h <= inner.y + inner.h;

  // projected footprints of everything on screen (obstacles for every label)
  const feet = new Map<string, Box>();
  for (const n of world.nodes) {
    const b = { x: n.foot.x * T * s + ox, y: n.foot.y * T * s + oy, w: n.foot.w * T * s, h: n.foot.h * T * s };
    if (b.x + b.w < 0 || b.y + b.h < 0 || b.x > viewport.w || b.y > viewport.h) continue;
    feet.set(n.name, b);
  }
  const atomOf = new Map(world.nodes.map((n) => [n.name, n.atom]));
  const order = world.labels.filter((l) => feet.has(l.node))
    .sort((a, b) => Number(b.node === opts.focus) - Number(a.node === opts.focus) || b.priority - a.priority ||
      (a.node < b.node ? -1 : 1));
  const obstacles = [...feet.values()];
  const placed: ScreenLabel[] = [];
  for (const l of order) {
    const f = feet.get(l.node)!;
    const font = fontOf(atomOf.get(l.node) ?? false);
    const { w, h } = measure(l.text, font);
    const sides = l.preferred.length ? l.preferred : [l.anchor];
    for (const a of sides) {
      const b = boxAt(a, f, w, h, gap);
      if (!inside(b)) continue;
      if (obstacles.some((o) => hit(b, o, 0))) continue;
      if (placed.some((p) => hit(b, p, PAD))) continue;
      placed.push({ node: l.node, x: round(b.x), y: round(b.y), w: round(w), h: round(h), font, anchor: a });
      break;
    }
  }
  return placed;
}

const round = (v: number) => Math.round(v * 100) / 100;

function boxAt(a: Anchor, f: Box, w: number, h: number, g: number): Box {
  const cx = f.x + f.w / 2;
  const cy = f.y + f.h / 2;
  switch (a) {
    case "S": return { x: cx - w / 2, y: f.y + f.h + g, w, h };
    case "N": return { x: cx - w / 2, y: f.y - g - h, w, h };
    case "E": return { x: f.x + f.w + g, y: cy - h / 2, w, h };
    case "W": return { x: f.x - g - w, y: cy - h / 2, w, h };
    case "SE": return { x: f.x + f.w + g, y: f.y + f.h + g, w, h };
    case "SW": return { x: f.x - g - w, y: f.y + f.h + g, w, h };
    case "NE": return { x: f.x + f.w + g, y: f.y - g - h, w, h };
    default: return { x: f.x - g - w, y: f.y - g - h, w, h };
  }
}
