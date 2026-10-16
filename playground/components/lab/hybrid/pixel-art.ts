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
interface FrameInks { outline: string; lit: string[]; shade: string[]; fill: string; rivet: [string, string, string] }

// Round 4 (critic r2): one panel system built from the pixel palette's ui /
// banner / ocean ramps — deep indigo body (never royal blue, so it stops
// fighting the sea), a 2px lit top-left bevel, a cool bottom-right shade, and
// gold-ramp rivets in the corners. The family colour lives in the header
// ribbon, not the frame.
const RIVET: [string, string, string] = [UI.goldLit, UI.gold, UI.goldShade];
const FRAMES: Record<FrameKind, FrameInks> = {
  window: { outline: UI.ink, lit: [UI.bevelHi, UI.panelHi], shade: [UI.ink, UI.panelShade], fill: UI.panel, rivet: RIVET },
  plate: { outline: UI.ink, lit: [UI.bevelHi, UI.panelHi], shade: [UI.ink, UI.panelShade], fill: UI.panel, rivet: RIVET },
  dialog: { outline: UI.ink, lit: [UI.bevelHi, UI.panelHi], shade: [UI.ink, UI.panelShade], fill: UI.panel, rivet: RIVET },
  hot: { outline: UI.ink, lit: [UI.cyanHi, UI.cyan], shade: [UI.ink, UI.cyanShade], fill: UI.cyanShade, rivet: RIVET },
};

/** Grid size of the frame bitmap and its slice (in art pixels). */
export const FRAME_GRID = 16;
export const FRAME_SLICE = 6;

/**
 * A 16×16 panel bitmap (drawn ×2): chamfered 1px outline, a 2px bevel lit on
 * the top/left and shaded on the bottom/right, a 2×2 gold rivet in each
 * corner (lit pixel top-left, shaded pixel bottom-right), then the body.
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
      const litSide = (y < n / 2 && dy <= dx) || (x < n / 2 && dx < dy);
      if (L === 0) c = ink.outline;
      else if (L <= 2) c = (litSide ? ink.lit : ink.shade)[L - 1];
      else if (dx >= 3 && dx <= 4 && dy >= 3 && dy <= 4) {
        const tl = (x < n / 2 ? dx : 7 - dx) === 3 && (y < n / 2 ? dy : 7 - dy) === 3;
        const br = (x < n / 2 ? dx : 7 - dx) === 4 && (y < n / 2 ? dy : 7 - dy) === 4;
        c = tl ? ink.rivet[0] : br ? ink.rivet[2] : ink.rivet[1];
      }
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
