// The Night Map's baked sky: one deterministic pixel painting of the night,
// made from lib/world positions only. 1 sky px = CELL frame px.
//
//   the night     NIGHT ramp: open sky, plus a Milky Way band of dust that is
//                 Bayer-dithered between its steps and fades out where the
//                 nebulae are (it fills the margins, never the families)
//   nebulae       one cloud per family, on the family's own 5-step ramp: a
//                 field of soft splats on the family's stars (atoms brighter)
//                 and along its primary lineage edges, broken up by a coarse
//                 value noise, Bayer-dithered (4×4 ordered) between steps.
//                 Where two families meet, each pixel belongs to the stronger
//                 cloud and the weaker one carves a dark lane, so the six
//                 families read as six separate nebulae
//   field stars   decoration: single pixels (a few small crosses), denser in
//                 the Milky Way, kept clear of every model star
//
// Pure (no DOM): bake.test.ts runs it under node; the skin puts the RGBA into
// a canvas and shows it pixelated under the marks.
import { FAMILY_INK, FIELD, GRID, NIGHT, hex, type Rgb } from "./tokens.ts";

export const CELL = GRID.cell;

export interface BakeStar { name: string; family: string; x: number; y: number; atom: boolean }
export interface BakeEdge { from: { x: number; y: number }; to: { x: number; y: number }; family: string }
export interface FieldStar { bx: number; by: number; tone: number }

export interface Bake {
  /** frame px of sky pixel (0,0)'s top-left corner */
  x: number;
  y: number;
  cell: number;
  w: number;
  h: number;
  rgba: Uint8ClampedArray;
  /** per sky px: index into `families` of the nebula painted there, else -1 */
  owner: Int8Array;
  /** per sky px: the nebula step painted there (1–5), 0 = open sky */
  level: Uint8Array;
  families: string[];
  /** decoration stars (the life layer twinkles some of them) */
  field: FieldStar[];
}

/** 4×4 Bayer matrix, as thresholds in [0, 1). */
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (x: number, y: number) => BAYER4[(y & 3) * 4 + (x & 3)];

/** Integer hash of (x, y, seed) → [0, 1). */
export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise on a lattice of `cell` sky px → [0, 1). */
function valueNoise(x: number, y: number, cell: number, seed: number): number {
  const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
  const fx = x / cell - gx, fy = y / cell - gy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(gx, gy, seed), b = hash2(gx + 1, gy, seed), c = hash2(gx, gy + 1, seed), d = hash2(gx + 1, gy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const cloud = (x: number, y: number, seed: number) => valueNoise(x, y, 16, seed) * 0.55 + valueNoise(x, y, 7, seed + 7) * 0.3 + valueNoise(x, y, 3, seed + 13) * 0.15;

// sizes in FRAME px (lib/world px)
const SIGMA_ATOM = 88, SIGMA_DERIVED = 62, SIGMA_EDGE = 40;
const EDGE_STEP = 14, EDGE_W = 0.2;
/** field → cloud density (1 − e^(−GAIN·F)): a lone derived star's centre is ~0.6 */
const GAIN = 0.6;
/** how hard the weaker cloud carves a lane into the stronger one */
const LANE = 0.75;

export function bakeSky({ stars, edges, box, seed = 5 }: { stars: BakeStar[]; edges: BakeEdge[]; box: { x: number; y: number; w: number; h: number }; seed?: number }): Bake {
  const cell = CELL;
  const x0 = Math.floor(box.x / cell) * cell, y0 = Math.floor(box.y / cell) * cell;
  const w = Math.ceil((box.x + box.w - x0) / cell), h = Math.ceil((box.y + box.h - y0) / cell);
  const families = Object.keys(FAMILY_INK).filter((f) => stars.some((s) => s.family === f));
  const fi = new Map(families.map((f, i) => [f, i]));

  // ——— nebula fields, on a window around the stars (3σ margin)
  const M = 3 * SIGMA_ATOM;
  const sx = stars.map((s) => s.x), sy = stars.map((s) => s.y);
  const wx0 = Math.max(0, Math.floor((Math.min(...sx) - M - x0) / cell)), wy0 = Math.max(0, Math.floor((Math.min(...sy) - M - y0) / cell));
  const wx1 = Math.min(w, Math.ceil((Math.max(...sx) + M - x0) / cell)), wy1 = Math.min(h, Math.ceil((Math.max(...sy) + M - y0) / cell));
  const ww = Math.max(0, wx1 - wx0), wh = Math.max(0, wy1 - wy0);
  const fields = families.map(() => new Float32Array(ww * wh));
  const splat = (f: Float32Array, cx: number, cy: number, sigma: number, wt: number) => {
    const r = Math.ceil((3 * sigma) / cell);
    const gx = Math.round((cx - x0) / cell) - wx0, gy = Math.round((cy - y0) / cell) - wy0;
    const inv = 1 / (2 * sigma * sigma);
    for (let y = Math.max(0, gy - r); y <= Math.min(wh - 1, gy + r); y++) {
      const dy = (wy0 + y + 0.5) * cell + y0 - cy;
      for (let x = Math.max(0, gx - r); x <= Math.min(ww - 1, gx + r); x++) {
        const dx = (wx0 + x + 0.5) * cell + x0 - cx;
        f[y * ww + x] += wt * Math.exp(-(dx * dx + dy * dy) * inv);
      }
    }
  };
  for (const s of stars) {
    const i = fi.get(s.family);
    if (i !== undefined) splat(fields[i], s.x, s.y, s.atom ? SIGMA_ATOM : SIGMA_DERIVED, s.atom ? 1.25 : 1);
  }
  for (const e of edges) {
    const i = fi.get(e.family);
    if (i === undefined) continue;
    const L = Math.hypot(e.to.x - e.from.x, e.to.y - e.from.y);
    const n = Math.max(1, Math.round(L / EDGE_STEP));
    for (let k = 1; k < n; k++) splat(fields[i], e.from.x + ((e.to.x - e.from.x) * k) / n, e.from.y + ((e.to.y - e.from.y) * k) / n, SIGMA_EDGE, EDGE_W);
  }

  // ——— the Milky Way's centre line: through the stars' centroid, rising to the right
  const cxs = sx.reduce((a, b) => a + b, 0) / Math.max(1, sx.length), cys = sy.reduce((a, b) => a + b, 0) / Math.max(1, sy.length);
  const ang = (-24 * Math.PI) / 180;
  const nx = -Math.sin(ang), ny = Math.cos(ang); // the band's normal
  const bandW = Math.min(box.w, box.h) * 0.3;

  const rgba = new Uint8ClampedArray(w * h * 4);
  const owner = new Int8Array(w * h).fill(-1);
  const level = new Uint8Array(w * h);
  const night = NIGHT.map(hex);
  const ramps = families.map((f) => FAMILY_INK[f].ramp.map(hex));
  const fieldInk = FIELD.map(hex);
  const put = (i: number, c: Rgb) => { rgba[i * 4] = c[0]; rgba[i * 4 + 1] = c[1]; rgba[i * 4 + 2] = c[2]; rgba[i * 4 + 3] = 255; };
  const fmax = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      // the strongest and second-strongest cloud here
      let best = -1, b1 = 0, b2 = 0;
      const lx = x - wx0, ly = y - wy0;
      if (lx >= 0 && ly >= 0 && lx < ww && ly < wh) {
        for (let k = 0; k < families.length; k++) {
          const v = fields[k][ly * ww + lx];
          if (v > b1) { b2 = b1; b1 = v; best = k; } else if (v > b2) b2 = v;
        }
      }
      fmax[i] = b1;
      // soft saturation (a dense family never floods flat), then the cloud
      // noise breaks every step up, cores included
      const e = Math.max(0, b1 - LANE * b2);
      const lv = best >= 0 ? Math.floor((1 - Math.exp(-e * GAIN)) * 5.6 * (0.45 + 0.8 * cloud(x, y, seed)) + bayer(x, y)) : 0;
      if (lv >= 1) {
        owner[i] = best;
        level[i] = Math.min(5, lv);
        put(i, ramps[best][Math.min(4, lv - 1)]);
        continue;
      }
      // open sky: the Milky Way's dust, faded where the clouds are
      const px = x0 + (x + 0.5) * cell, py = y0 + (y + 0.5) * cell;
      const d = (px - cxs) * nx + (py - cys) * ny + Math.sin((px - cxs) / 900) * 140;
      const band = Math.exp(-(d * d) / (2 * bandW * bandW)) * (0.35 + 0.9 * cloud(x * 0.7, y * 0.7, seed + 31));
      const veil = Math.max(0, 1 - b1 * 1.6);
      const step = Math.min(4, 1 + Math.floor(band * veil * 3.4 + bayer(x, y) - 0.15));
      put(i, night[Math.max(1, step)]);
    }
  }

  // ——— field stars: decoration, never near a model star
  const field: FieldStar[] = [];
  const clear = new Uint8Array(w * h);
  const R = 7; // sky px kept clear around every model star
  for (const s of stars) {
    const gx = Math.floor((s.x - x0) / cell), gy = Math.floor((s.y - y0) / cell);
    for (let y = Math.max(0, gy - R); y <= Math.min(h - 1, gy + R); y++) for (let x = Math.max(0, gx - R); x <= Math.min(w - 1, gx + R); x++) clear[y * w + x] = 1;
  }
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (clear[i]) continue;
      const px = x0 + (x + 0.5) * cell, py = y0 + (y + 0.5) * cell;
      const d = (px - cxs) * nx + (py - cys) * ny;
      const band = Math.exp(-(d * d) / (2 * bandW * bandW));
      const inCloud = owner[i] >= 0;
      const p = (0.0045 + 0.012 * band) * (inCloud ? 0.25 : 1);
      const r = hash2(x, y, seed + 101);
      if (r >= p) continue;
      const t = hash2(x, y, seed + 202);
      const tone = t < 0.62 ? 0 : t < 0.9 ? 1 : t < 0.985 ? 2 : 3;
      put(i, fieldInk[tone]);
      field.push({ bx: x, by: y, tone });
      // the brightest few are small crosses (arms one step down)
      if (tone === 3) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (y + dy) * w + x + dx; if (!clear[j]) put(j, fieldInk[1]); }
    }
  }
  return { x: x0, y: y0, cell, w, h, rgba, owner, level, families, field };
}

/** The bake with every nebula except `keep` sunk into the night (a focused
 * family): its pixels fall to the open-sky step their cloud level allows. */
export function ghostBake(b: Bake, keep: string): Uint8ClampedArray {
  const k = b.families.indexOf(keep);
  const out = new Uint8ClampedArray(b.rgba);
  const night = NIGHT.map(hex);
  for (let i = 0; i < b.owner.length; i++) {
    const o = b.owner[i];
    if (o < 0 || o === k) continue;
    const c = night[Math.min(3, 1 + (b.level[i] >> 1))];
    out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2];
  }
  return out;
}

/** Sky px under a frame point. */
export const skyPx = (b: Bake, x: number, y: number) => ({ bx: Math.floor((x - b.x) / b.cell), by: Math.floor((y - b.y) / b.cell) });
