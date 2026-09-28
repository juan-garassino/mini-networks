// Index-buffer rasteriser: everything is painted as Sweetie-16 palette
// indices (255 = transparent) and only turned into RGBA at the very end, so
// no colour outside the palette can ever reach the screen and downsampling
// can pick a real palette entry (mode) instead of blending.
import { keyIndex, SWEETIE } from "./palette";
import type { SpriteRows } from "./sprites";

export const CLEAR = 255;

export interface IndexImage { w: number; h: number; data: Uint8Array }

export function blank(w: number, h: number, fill = CLEAR): IndexImage {
  const data = new Uint8Array(w * h);
  data.fill(fill);
  return { w, h, data };
}

/** Rows → index image. `map` resolves placeholder letters (roof, canopy…). */
export function sprite(rows: SpriteRows, map: Record<string, number> = {}): IndexImage {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const img = blank(w, h);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === "." || ch === undefined) continue;
      const v = ch in map ? map[ch] : keyIndex(ch);
      if (v >= 0) img.data[y * w + x] = v;
    }
  }
  return img;
}

export function recolor(img: IndexImage, from: Record<number, number>): IndexImage {
  const out = { w: img.w, h: img.h, data: new Uint8Array(img.data) };
  for (let i = 0; i < out.data.length; i++) {
    const v = out.data[i];
    if (v in from) out.data[i] = from[v];
  }
  return out;
}

export function flipX(img: IndexImage): IndexImage {
  const out = blank(img.w, img.h);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) out.data[y * img.w + (img.w - 1 - x)] = img.data[y * img.w + x];
  return out;
}

export function flipY(img: IndexImage): IndexImage {
  const out = blank(img.w, img.h);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) out.data[(img.h - 1 - y) * img.w + x] = img.data[y * img.w + x];
  return out;
}

/** Paint src onto dst at (x, y), integer scale, skipping transparent pixels. */
export function blit(dst: IndexImage, src: IndexImage, x: number, y: number, scale = 1) {
  x = Math.round(x); y = Math.round(y);
  for (let sy = 0; sy < src.h; sy++) {
    for (let sx = 0; sx < src.w; sx++) {
      const v = src.data[sy * src.w + sx];
      if (v === CLEAR) continue;
      for (let dy = 0; dy < scale; dy++) {
        const py = y + sy * scale + dy;
        if (py < 0 || py >= dst.h) continue;
        const row = py * dst.w;
        for (let dx = 0; dx < scale; dx++) {
          const px = x + sx * scale + dx;
          if (px >= 0 && px < dst.w) dst.data[row + px] = v;
        }
      }
    }
  }
}

export function fillRect(dst: IndexImage, x: number, y: number, w: number, h: number, v: number) {
  const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(dst.w, Math.round(x + w)), y1 = Math.min(dst.h, Math.round(y + h));
  for (let py = y0; py < y1; py++) dst.data.fill(v, py * dst.w + x0, py * dst.w + x1);
}

/**
 * Palette-preserving downsample by an integer factor: each output pixel is
 * the most frequent index of its f×f block, with `weight` letting thin but
 * important colours (outlines, roads) win against flat ground.
 */
export function downsample(src: IndexImage, f: number, weight: (v: number) => number = () => 1): IndexImage {
  if (f === 1) return src;
  const w = Math.floor(src.w / f), h = Math.floor(src.h / f);
  const out = blank(w, h);
  const score = new Float32Array(256);
  const seen: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      seen.length = 0;
      for (let dy = 0; dy < f; dy++) {
        const row = (y * f + dy) * src.w + x * f;
        for (let dx = 0; dx < f; dx++) {
          const v = src.data[row + dx];
          if (score[v] === 0) seen.push(v);
          score[v] += v === CLEAR ? 1 : weight(v);
        }
      }
      let best = CLEAR, bs = -1;
      for (const v of seen) { if (score[v] > bs) { bs = score[v]; best = v; } score[v] = 0; }
      out.data[y * w + x] = best;
    }
  }
  return out;
}

const RGB = SWEETIE.map((hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]);

export function toCanvas(img: IndexImage): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.w; c.height = img.h;
  const ctx = c.getContext("2d")!;
  const id = ctx.createImageData(img.w, img.h);
  const px = id.data;
  for (let i = 0; i < img.data.length; i++) {
    const v = img.data[i];
    if (v === CLEAR) continue;
    const [r, g, b] = RGB[v];
    px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = b; px[i * 4 + 3] = 255;
  }
  ctx.putImageData(id, 0, 0);
  return c;
}
