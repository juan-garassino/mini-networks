// The true pixel map as DATA: decode scripts/pixelmap_to_json.py's
// "rle36-v2" JSON into palette + per-pixel indices, then everything the skin
// paints from it — the base image, the sea mask, per-land masks, the dimmed
// "focus" layers and land swatches. Pure (no DOM, no "@/" imports) apart from
// paintIndices(), so .lab-shots/painted/*.ts can run it under plain node.
import { insidePolygon, type Family, type PaintedMap } from "./anchors.ts";

export const PIXELMAP_URL = "/local/pixel-map.json";
export const PIXELMAP_CMD =
  "uv run python playground/scripts/pixelmap_to_json.py playground/public/local/pixel-map-true.png playground/public/local/pixel-map.json";

const REPEAT = 1000; // tokens >= REPEAT repeat the previous pixel (token - 999) times

export interface PixelMapDoc { format: string; source?: string; w: number; h: number; palette: string[]; rows: string[] }

export interface PixelMap {
  w: number;
  h: number;
  /** rgb triplets, palette[i*3 .. i*3+2] */
  palette: Uint8Array;
  hex: string[];
  /** palette index per pixel, row-major */
  idx: Uint16Array;
}

export function decodePixelMap(doc: PixelMapDoc): PixelMap {
  if (doc.format !== "rle36-v2") throw new Error(`unknown pixel map format ${doc.format}`);
  const { w, h } = doc;
  const palette = new Uint8Array(doc.palette.length * 3);
  doc.palette.forEach((p, i) => {
    palette[i * 3] = parseInt(p.slice(1, 3), 16);
    palette[i * 3 + 1] = parseInt(p.slice(3, 5), 16);
    palette[i * 3 + 2] = parseInt(p.slice(5, 7), 16);
  });
  const idx = new Uint16Array(w * h);
  for (let y = 0; y < h; y++) {
    const s = doc.rows[y];
    let x = 0;
    const base = y * w;
    for (let i = 0; i < s.length; i += 2) {
      const v = parseInt(s.slice(i, i + 2), 36);
      if (v < REPEAT) { idx[base + x++] = v; continue; }
      const prev = idx[base + x - 1];
      for (let n = v - REPEAT + 1; n > 0; n--) idx[base + x++] = prev;
    }
    if (x !== w) throw new Error(`pixel map row ${y} decodes to ${x} px, expected ${w}`);
  }
  return { w, h, palette, hex: doc.palette, idx };
}

// ————————————————————————————————————————————— sea + lands

/** The sea: the parchment background flood-filled from the image border
 * (4-connected), so parchment pockets inside a land stay land. */
export function seaMask(pm: PixelMap): Uint8Array {
  const { w, h, idx, palette } = pm;
  // "sea-like" palette entries: close to the most common colour (index 0 —
  // the encoder orders the palette by frequency, and the parchment sea wins)
  const r0 = palette[0], g0 = palette[1], b0 = palette[2];
  const seaIdx = new Uint8Array(palette.length / 3);
  for (let i = 0; i < seaIdx.length; i++) {
    const d = Math.abs(palette[i * 3] - r0) + Math.abs(palette[i * 3 + 1] - g0) + Math.abs(palette[i * 3 + 2] - b0);
    seaIdx[i] = d <= 18 ? 1 : 0;
  }
  const sea = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (p: number) => { if (!sea[p] && seaIdx[idx[p]]) { sea[p] = 1; stack.push(p); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < w * (h - 1)) push(p + w);
  }
  return sea;
}

/** Land id per pixel: the FAMILIES index of the land it belongs to, or -1
 * for sea and stray decor (islets, boats, clouds). Two passes: (1) pixels
 * inside a hand-drawn land polygon (map.lands; first match wins) that aren't
 * sea; (2) a breadth-first grow from those pixels through connected non-sea
 * pixels, at most GROW steps — so each land's cliffs, beaches and coastal
 * foam join it (the polygons stay rough and inland), while islets separated
 * by open sea stay out. */
const GROW = 40;
export function landIds(pm: PixelMap, map: PaintedMap, families: readonly Family[], sea: Uint8Array): Int8Array {
  const { w, h } = pm;
  const out = new Int8Array(w * h).fill(-1);
  families.forEach((f, fi) => {
    const poly = map.lands[f];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [px, py] of poly) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(h - 1, Math.ceil(y1)); y++) {
      for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(w - 1, Math.ceil(x1)); x++) {
        const p = y * w + x;
        if (out[p] >= 0 || sea[p]) continue;
        if (insidePolygon({ x: x + 0.5, y: y + 0.5 }, poly)) out[p] = fi;
      }
    }
  });
  let frontier: number[] = [];
  for (let p = 0; p < out.length; p++) if (out[p] >= 0) frontier.push(p);
  for (let step = 0; step < GROW && frontier.length; step++) {
    const next: number[] = [];
    for (const p of frontier) {
      const x = p % w, f = out[p];
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w];
      for (const q of nb) {
        if (q < 0 || q >= out.length || out[q] >= 0 || sea[q]) continue;
        out[q] = f;
        next.push(q);
      }
    }
    frontier = next;
  }
  return out;
}

// ————————————————————————————————————————————— palette transforms

/** The "not in focus" palette: desaturate hard, darken, and pull toward a
 * cool dusk tint so the focused land's full colours glow against it. */
export function dimPalette(palette: Uint8Array): Uint8Array {
  const out = new Uint8Array(palette.length);
  const tint = [70, 64, 78];
  for (let i = 0; i < palette.length; i += 3) {
    const r = palette[i], g = palette[i + 1], b = palette[i + 2];
    const l = 0.3 * r + 0.59 * g + 0.11 * b;
    for (let c = 0; c < 3; c++) {
      const v = [r, g, b][c];
      const grey = v * 0.22 + l * 0.78;
      out[i + c] = Math.round(grey * 0.62 + tint[c] * 0.38);
    }
  }
  return out;
}

/** RGBA pixels for an ImageData: the whole map, or (with `keep`) only the
 * pixels where keep(p) is false, the rest transparent. */
export function rgbaFrom(pm: PixelMap, palette: Uint8Array, hole?: (p: number) => boolean): Uint8ClampedArray {
  const n = pm.w * pm.h;
  const out = new Uint8ClampedArray(n * 4);
  for (let p = 0; p < n; p++) {
    if (hole && hole(p)) continue;
    const k = pm.idx[p] * 3;
    out[p * 4] = palette[k];
    out[p * 4 + 1] = palette[k + 1];
    out[p * 4 + 2] = palette[k + 2];
    out[p * 4 + 3] = 255;
  }
  return out;
}

/** The land's own colour: the most common palette entry among its pixels
 * that is neither near-black/white nor washed out (so grass, snow, lava…). */
export function landSwatch(pm: PixelMap, lands: Int8Array, fi: number): string {
  const counts = new Map<number, number>();
  for (let p = 0; p < lands.length; p++) {
    if (lands[p] !== fi) continue;
    const i = pm.idx[p];
    counts.set(i, (counts.get(i) ?? 0) + 1);
  }
  let best = -1, bestN = -1;
  for (const [i, n] of counts) {
    const r = pm.palette[i * 3], g = pm.palette[i * 3 + 1], b = pm.palette[i * 3 + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx < 60 || mn > 225 || mx - mn < 40) continue;
    if (n > bestN) { best = i; bestN = n; }
  }
  return best >= 0 ? pm.hex[best] : "#888888";
}

/** Nearest palette colour to a target — used to derive UI tokens from the art. */
export function nearestHex(pm: PixelMap, rgb: [number, number, number]): string {
  let best = 0, bd = Infinity;
  for (let i = 0; i < pm.hex.length; i++) {
    const d = (pm.palette[i * 3] - rgb[0]) ** 2 + (pm.palette[i * 3 + 1] - rgb[1]) ** 2 + (pm.palette[i * 3 + 2] - rgb[2]) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return pm.hex[best];
}
