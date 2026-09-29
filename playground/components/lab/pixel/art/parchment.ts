// Parchment edition (?theme=parchment) — owner reference 2026-09-29: the sea
// IS the cream paper (no water fill) with horizontal dither hatching along the
// coasts; land in a muted ~12-colour register (sage, ochre, rust, lavender
// snow) with ink-outlined ridges; every cartographic mark (routes, boats,
// serpents, compass, lettering) in ONE maroon ink ramp.
//
// Implemented as a palette-index REMAP of the normal composite, so the same
// terrain, castles and markers are reused: every ramp maps to its parchment
// counterpart by relative step; water pixels become paper + hatching.
import { CLEAR, PALETTE, RAMPS, type RampName } from "./palette";
import { chamfer } from "./terrain-shade";
import type { ArtImage } from "./raster";

const TO: Partial<Record<RampName, RampName>> = {
  meadow: "sage", forest: "sage", olive: "sage", pine: "sage", frost: "sage",
  sand: "ochreP", savanna: "ochreP", glow: "ochreP", gold: "ochreP",
  rock: "rustP", cliff: "rustP", lava: "rustP", roof: "rustP", wood: "rustP", banner: "rustP",
  snow: "snowP", stone: "snowP", magic: "snowP",
  ocean: "paper", shallow: "paper", foam: "paper",
};
// sprite materials whose darkest step becomes the ink outline
const INKED = new Set<RampName>(["stone", "roof", "wood", "banner", "gold", "rock", "cliff", "magic", "snow"]);
const WATER = new Set<number>([...RAMPS.ocean, ...RAMPS.shallow, ...RAMPS.foam]);

/** index → parchment index (256-entry table). */
export const PARCHMENT: Uint8Array = (() => {
  const m = new Uint8Array(256);
  for (let i = 0; i < 256; i++) m[i] = i;
  const seen = new Set<number>();
  for (const [name, r] of Object.entries(RAMPS) as [RampName, number[]][]) {
    const to = TO[name];
    if (!to) continue;
    const tr = RAMPS[to];
    r.forEach((idx, k) => {
      if (seen.has(idx)) return;
      seen.add(idx);
      if (k === 0 && INKED.has(name)) { m[idx] = RAMPS.ink[0]; return; }
      m[idx] = tr[Math.round((k / Math.max(1, r.length - 1)) * (tr.length - 1))];
    });
  }
  m[RAMPS.ui[0]] = RAMPS.ink[0];
  m[RAMPS.ui[1]] = RAMPS.paper[3];
  m[CLEAR] = CLEAR;
  return m;
})();

export const isWaterIdx = (v: number) => WATER.has(v);

const hash = (x: number, y: number) => {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};

/**
 * Parchment pass over a composite: land/sprites remapped, water → paper with
 * coast hatching (horizontal broken lines fading with distance), a darker
 * paper line hugging the coast, sparse paper grain, and ink ridge outlines on
 * the rust highlands (shadow side).
 */
export function parchmentize(img: ArtImage, land: Uint8Array | null, apt: number, opts: { keepLand?: boolean } = {}): ArtImage {
  const keepLand = opts.keepLand ?? true;
  const { w, h } = img;
  const out: ArtImage = { w, h, data: new Uint8Array(img.data.length) };
  const water = new Uint8Array(w * h);
  for (let i = 0; i < img.data.length; i++) water[i] = isWaterIdx(img.data[i]) && (!land || !land[i]) ? 1 : 0;
  const notWater = new Uint8Array(w * h);
  for (let i = 0; i < notWater.length; i++) notWater[i] = water[i] ? 0 : 1;
  const d = chamfer(notWater, w, h, 64);
  const P = RAMPS.paper, s = Math.max(0.6, apt / 8);           // hatch spacing scales with art resolution
  const gap = Math.max(2, Math.round(3 * s));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const v = img.data[i];
    if (v === CLEAR) { out.data[i] = CLEAR; continue; }
    // owner 2026-09-29 ("more variations of colour", T4 palette): the LAND keeps the
    // full hue-shifted art ramps and slope light; only the sea becomes paper
    if (!water[i]) { out.data[i] = keepLand ? v : PARCHMENT[v]; continue; }
    const dd = d[i];
    let o = P[2];
    if (dd <= 1.2) o = RAMPS.ink[2];                                    // thin ink coastline
    else if (dd <= 18 * s && y % gap === 0) {
      // horizontal hatching hugging the coast: solid near the shore, breaking into
      // dashes further out (dash length shrinks with distance)
      const fade = dd / (18 * s);
      const dash = Math.max(2, Math.round((1 - fade) * 9));
      if (((x + (y * 5) % 7) % (dash + 3)) < dash && hash(x >> 2, y) > fade * 0.6) o = P[fade < 0.5 ? 0 : 1];
    } else if (hash(x, y) < 0.012) o = P[1];                          // paper grain
    else if (hash(x + 7, y + 3) < 0.006) o = P[3];
    out.data[i] = o;
  }
  // sparse curly wave glyphs in ink on the open paper sea (deterministic grid)
  const cell = Math.round(46 * s);
  const WAVE = [".##...##", "#..#.#..", "....#..."];
  for (let gy = 0; gy < h; gy += cell) for (let gx = 0; gx < w; gx += cell) {
    const x0 = gx + Math.floor(hash(gx, gy) * (cell - 10)), y0 = gy + Math.floor(hash(gy, gx) * (cell - 6));
    if (hash(gx + 1, gy + 1) > 0.42) continue;
    let ok = true;
    for (let yy = -3; yy < 6 && ok; yy++) for (let xx = -3; xx < 11 && ok; xx++) {
      const j = (y0 + yy) * w + x0 + xx;
      if (y0 + yy < 0 || x0 + xx < 0 || y0 + yy >= h || x0 + xx >= w || !water[j] || d[j] < 18 * s) ok = false;
    }
    if (!ok) continue;
    WAVE.forEach((row, yy) => { for (let xx = 0; xx < row.length; xx++) if (row[xx] === "#") out.data[(y0 + yy) * w + x0 + xx] = RAMPS.ink[1]; });
  }
  if (keepLand) return out;
  // ink ridges: rust pixels with non-rust land below/right get an ink edge
  const rust = new Set(RAMPS.rustP);
  const src = new Uint8Array(out.data);
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
    const i = y * w + x;
    if (!rust.has(src[i])) continue;
    const below = src[i + w], right = src[i + 1];
    const edge = (v: number) => v !== CLEAR && !rust.has(v) && v !== RAMPS.ink[0] && !isPaper(v);
    if (edge(below) || edge(right)) out.data[i] = RAMPS.ink[1];
  }
  return out;
}
const isPaper = (v: number) => RAMPS.paper.includes(v);

/** Any sprite as maroon ink line art on paper: dark → ink, mid → light ink, light → paper. */
export function inkify(img: ArtImage): ArtImage {
  const out: ArtImage = { w: img.w, h: img.h, data: new Uint8Array(img.data) };
  for (let i = 0; i < out.data.length; i++) {
    const v = out.data[i];
    if (v === CLEAR) continue;
    const hex = PALETTE[v];
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    const l = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
    out.data[i] = l < 0.5 ? RAMPS.ink[0] : l < 0.72 ? RAMPS.ink[1] : RAMPS.paper[3];
  }
  return out;
}

/** Apply the parchment table to a sprite (castles, markers, critter keep their muted colours). */
export function parchmentSprite(img: ArtImage): ArtImage {
  return { w: img.w, h: img.h, data: img.data.map((v) => PARCHMENT[v]) };
}

/** 1px ink outline round every opaque sprite pixel (transparent neighbours → ink); size unchanged. */
export function inkOutline(img: ArtImage, ink = RAMPS.ink[0]): ArtImage {
  const out: ArtImage = { w: img.w, h: img.h, data: new Uint8Array(img.data) };
  const { w, h } = img;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (img.data[i] !== CLEAR) continue;
    const n = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < w && yy < h && img.data[yy * w + xx] !== CLEAR;
    if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) out.data[i] = ink;
  }
  return out;
}

/** Ink outline round a MASK inside a composite (sprites painted over terrain). */
export function inkAroundMask(img: ArtImage, mask: Uint8Array, ink = RAMPS.ink[0]) {
  const { w, h } = img;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (mask[i]) continue;
    if (mask[i - 1] || mask[i + 1] || mask[i - w] || mask[i + w]) img.data[i] = ink;
  }
}
