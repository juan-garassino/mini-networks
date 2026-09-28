// Procedural pixel art — no image files. Every sprite is either a formula
// (the 9-slice window frame) or a string array, rasterised to an SVG of 1×1
// rects with crispEdges, so it scales by integers without blur.
import { UI } from "./palette.ts";

export type FrameKind = "window" | "plate" | "dialog" | "hot";

// Contemporary pixel UI (round 3): hue-shifted panel ramps from the pixel
// skin's art palette — indigo panels (never black), a warm top-left
// highlight, a cool bottom-right shade, a coloured outline, rounded 2px
// corners. Depth comes from the ramp + the paper card's soft shadow, not
// from a heavy bevel.
interface FrameInks { outline: string; hi: string; shade: string; lit: string; fill: string }

const FRAMES: Record<FrameKind, FrameInks> = {
  window: { outline: UI.ink, hi: UI.panelHi, shade: UI.panelShade, lit: UI.panelLit, fill: UI.panel },
  plate: { outline: UI.plumDeep, hi: UI.goldLit, shade: UI.plumShade, lit: UI.plumLit, fill: UI.plum },
  dialog: { outline: UI.ink, hi: UI.panelHi, shade: UI.ink, lit: UI.panelShade, fill: UI.panelDeep },
  hot: { outline: UI.ink, hi: UI.cyanHi, shade: UI.cyanShade, lit: UI.cyan, fill: UI.cyanShade },
};

/** Grid size of the frame bitmap and its slice (in art pixels). */
export const FRAME_GRID = 12;
export const FRAME_SLICE = 4;

/**
 * A 12×12 panel bitmap: rounded (1-px chamfer) outline, then a 1-px rim that
 * is warm-lit on the top/left and cool-shaded on the bottom/right, a 1-px lit
 * band under the top edge, and the fill. Centre = fill (border-image `fill`).
 */
export function frameSvg(kind: FrameKind): string {
  const ink = FRAMES[kind];
  const n = FRAME_GRID;
  let rects = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = Math.min(x, n - 1 - x), dy = Math.min(y, n - 1 - y);
      const L = Math.min(dx, dy, dx + dy - 1);
      if (L < 0) continue;
      let c = ink.fill;
      if (L === 0) c = ink.outline;
      else if (L === 1) c = (y < n / 2 && dy <= dx) || (x < n / 2 && dx < dy) ? ink.hi : ink.shade;
      else if (y === 2 && L === 2) c = ink.lit;
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${n}" height="${n}" shape-rendering="crispEdges">${rects}</svg>`;
}

const cache = new Map<FrameKind, string>();
/** CSS `border-image-source` value for a frame kind (memoised). */
export function frameUrl(kind: FrameKind): string {
  let u = cache.get(kind);
  if (!u) {
    u = `url("data:image/svg+xml,${encodeURIComponent(frameSvg(kind))}")`;
    cache.set(kind, u);
  }
  return u;
}

export const frameFill = (kind: FrameKind) => FRAMES[kind].fill;

// ── string-array sprites ────────────────────────────────────────────────
// '.' = transparent; every other char is a key into the sprite's palette.

export interface Sprite { rows: string[]; ink: Record<string, string> }

/** The pointing hand (menu cursor). Points right; flip for left. */
export const HAND: Sprite = {
  rows: [
    "....kkkk......",
    "...kwwwwk.....",
    "..kwwwwwwkkkkk",
    "kkwwwwwwwwwwwk",
    "kwwwwwwwwmmmmk",
    "kwwwwwwwwkkkk.",
    "kwwwwwwwwwwk..",
    "kwwwwwwwmmmk..",
    "kkwwwwwwwwwk..",
    ".kmwwwwwmmk...",
    "..kkkkkkkk....",
  ],
  ink: { k: UI.ink, w: UI.text, m: UI.dim },
};

/** Small down-arrow ("more below") used inside scrolling windows. */
export const ARROW_DOWN: Sprite = {
  rows: ["kkkkkkk", "kwwwwwk", ".kwwwk.", "..kwk..", "...k..."],
  ink: { k: UI.ink, w: UI.gold },
};

/** Rasterise a sprite to SVG rect markup (row-run merged). */
export function spriteRects(s: Sprite): { w: number; h: number; rects: { x: number; y: number; w: number; fill: string }[] } {
  const rects: { x: number; y: number; w: number; fill: string }[] = [];
  s.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === ".") { x++; continue; }
      let e = x + 1;
      while (e < row.length && row[e] === ch) e++;
      rects.push({ x, y, w: e - x, fill: s.ink[ch] ?? UI.ink });
      x = e;
    }
  });
  return { w: Math.max(...s.rows.map((r) => r.length)), h: s.rows.length, rects };
}

/** Cleared tick beside the bar: the champion passed the M-tier gate. */
export const CHECK: Sprite = {
  rows: [
    ".....kk",
    "....kgk",
    "k..kgk.",
    "kgkgk..",
    ".kgk...",
    "..k....",
  ],
  ink: { k: UI.ink, g: UI.gold },
};

/** Champion seal in the menu: the map's star, as a pixel sprite. */
export const STAR: Sprite = {
  rows: [
    "...k...",
    "..kgk..",
    "kkkgkkk",
    "kgggggk",
    ".kgggk.",
    "kgk.kgk",
    "kk...kk",
  ],
  ink: { k: UI.ink, g: UI.gold },
};
