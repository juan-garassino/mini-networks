// Index images for the art system: palette indices (art/palette.ts), 255 =
// clear. Converted to RGBA canvases only at the very end, so no off-palette
// colour ever reaches the screen.
import { CLEAR, RGB } from "./palette";

export interface ArtImage { w: number; h: number; data: Uint8Array }

export function artBlank(w: number, h: number, fill = CLEAR): ArtImage {
  const data = new Uint8Array(w * h);
  data.fill(fill);
  return { w, h, data };
}

/** Paint src onto dst at (x, y) (integer), skipping clear pixels. */
export function artBlit(dst: ArtImage, src: ArtImage, x: number, y: number, flip = false) {
  x = Math.round(x); y = Math.round(y);
  for (let sy = 0; sy < src.h; sy++) {
    const py = y + sy;
    if (py < 0 || py >= dst.h) continue;
    for (let sx = 0; sx < src.w; sx++) {
      const v = src.data[sy * src.w + (flip ? src.w - 1 - sx : sx)];
      if (v === CLEAR) continue;
      const px = x + sx;
      if (px >= 0 && px < dst.w) dst.data[py * dst.w + px] = v;
    }
  }
}

/** Mirror horizontally. */
export function artFlipX(img: ArtImage): ArtImage {
  const out = artBlank(img.w, img.h);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) out.data[y * img.w + img.w - 1 - x] = img.data[y * img.w + x];
  return out;
}

/** Remap indices through a 256-entry table (e.g. SHADOW) where `mask` is set. */
export function remapWhere(img: ArtImage, table: Uint8Array, mask: (x: number, y: number) => boolean) {
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const i = y * img.w + x;
    const v = img.data[i];
    if (v !== CLEAR && mask(x, y)) img.data[i] = table[v];
  }
}

/** Index image → RGBA canvas at integer `scale` (nearest-neighbour, crisp). */
export function artToCanvas(img: ArtImage, scale = 1, doc: Document = document): HTMLCanvasElement {
  const c = doc.createElement("canvas");
  c.width = img.w * scale; c.height = img.h * scale;
  const ctx = c.getContext("2d")!;
  const id = ctx.createImageData(c.width, c.height);
  const px = id.data;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const v = img.data[y * img.w + x];
    if (v === CLEAR) continue;
    const [r, g, b] = RGB[v];
    for (let dy = 0; dy < scale; dy++) {
      let o = ((y * scale + dy) * c.width + x * scale) * 4;
      for (let dx = 0; dx < scale; dx++, o += 4) { px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255; }
    }
  }
  ctx.putImageData(id, 0, 0);
  return c;
}
