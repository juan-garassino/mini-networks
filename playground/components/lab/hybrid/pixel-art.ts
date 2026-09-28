// Procedural pixel art — no image files. Every sprite is either a formula
// (the 9-slice window frame) or a string array, rasterised to an SVG of 1×1
// rects with crispEdges, so it scales by integers without blur.
import { SW } from "./palette.ts";

export type FrameKind = "window" | "plate" | "dialog" | "hot";

interface FrameInks { outline: string; frame: string; bevel: string; inner: string; fill: string }

// window = the status / menu windows · plate = the title plate · dialog = the
// one-line narrator box · hot = a selected row inside a window.
const FRAMES: Record<FrameKind, FrameInks> = {
  window: { outline: SW.night, frame: SW.white, bevel: SW.mist, inner: SW.night, fill: SW.navy },
  plate: { outline: SW.night, frame: SW.butter, bevel: SW.orange, inner: SW.night, fill: SW.plum },
  dialog: { outline: SW.night, frame: SW.white, bevel: SW.mist, inner: SW.night, fill: SW.night },
  hot: { outline: SW.night, frame: SW.cyan, bevel: SW.sky, inner: SW.night, fill: SW.blue },
};

/** Grid size of the frame bitmap and its slice (in art pixels). */
export const FRAME_GRID = 16;
export const FRAME_SLICE = 6;

/**
 * A 16×16 window bitmap with 45° chamfered corners. Layer index is the
 * chamfered distance from the edge: 0 outline, 1–2 frame, 3 bevel, 4 inner
 * line, ≥5 fill. The centre 4×4 is fill so `border-image … fill` paints it.
 */
export function frameSvg(kind: FrameKind): string {
  const ink = FRAMES[kind];
  const layer = [ink.outline, ink.frame, ink.frame, ink.bevel, ink.inner];
  const n = FRAME_GRID;
  let rects = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = Math.min(x, n - 1 - x);
      const dy = Math.min(y, n - 1 - y);
      const L = Math.min(dx, dy, dx + dy - 2);
      if (L < 0) continue;
      const c = L < layer.length ? layer[L] : ink.fill;
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
  ink: { k: SW.night, w: SW.white, m: SW.mist },
};

/** Small down-arrow ("more below") used inside scrolling windows. */
export const ARROW_DOWN: Sprite = {
  rows: ["kkkkkkk", "kwwwwwk", ".kwwwk.", "..kwk..", "...k..."],
  ink: { k: SW.night, w: SW.butter },
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
      rects.push({ x, y, w: e - x, fill: s.ink[ch] ?? SW.night });
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
  ink: { k: SW.night, g: SW.butter },
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
  ink: { k: SW.night, g: SW.butter },
};
