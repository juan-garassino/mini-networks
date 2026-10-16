// Placement helpers for composed scenes: a Layout (occupancy-checked, y-sorted
// stamping with optional ink ring) and a soft blob mask. Deterministic.
import { CLEAR } from "../palette";
import { fbm3, hash2 } from "../noise";
import { artBlank, type ArtImage } from "../raster";
import { inkOutline } from "../parchment";
import type { Sprite } from "../sprites/paint";
import type { BiomeStamp } from "./kit";
import { BIOME_INK } from "./palette";

type Art = Sprite | BiomeStamp;
const footOf = (s: Art) => ("anchor" in s ? s.anchor : s.foot);

export class Layout {
  occ: Uint8Array;
  items: { img: ArtImage; x: number; y: number; fy: number }[] = [];
  constructor(public w: number, public h: number, public free: (x: number, y: number) => boolean) { this.occ = new Uint8Array(w * h); }
  /** Place with foot at (x, y); `force` skips the checks (set pieces), `ink` adds the map's ink ring (sprites). */
  put(s: Art, x: number, y: number, o: { force?: boolean; pad?: number; ink?: boolean; flip?: boolean } = {}): boolean {
    const img0 = o.ink ? inkOutline(s.img, BIOME_INK) : s.img;
    const f = footOf(s), k = o.ink ? 1 : 0;
    const fx = o.flip ? img0.w - 1 - (f.x + k) : f.x + k;
    const ox = Math.round(x - fx), oy = Math.round(y - (f.y + k));
    const pad = o.pad ?? 1;
    const img = o.flip ? flip(img0) : img0;
    if (!o.force) {
      for (let yy = 0; yy < img.h; yy++) for (let xx = 0; xx < img.w; xx++) {
        if (img.data[yy * img.w + xx] === CLEAR) continue;
        for (let dy = -pad; dy <= pad; dy++) for (let dx = -pad; dx <= pad; dx++) {
          const px = ox + xx + dx, py = oy + yy + dy;
          if (px < 0 || py < 0 || px >= this.w || py >= this.h || !this.free(px, py) || this.occ[py * this.w + px]) return false;
        }
      }
    }
    for (let yy = 0; yy < img.h; yy++) for (let xx = 0; xx < img.w; xx++) {
      const px = ox + xx, py = oy + yy;
      if (img.data[yy * img.w + xx] !== CLEAR && px >= 0 && py >= 0 && px < this.w && py < this.h) this.occ[py * this.w + px] = 1;
    }
    this.items.push({ img, x: ox, y: oy, fy: oy + img.h });
    return true;
  }
  /** Scatter `n` copies in free ground (deterministic lattice search). */
  scatter(s: Art, n: number, seed: number, region?: (x: number, y: number) => boolean) {
    let got = 0;
    for (let k = 0; k < n * 40 && got < n; k++) {
      const x = Math.floor(hash2(k, seed, 0x51) * this.w), y = Math.floor(hash2(seed, k, 0x77) * this.h);
      if (region && !region(x, y)) continue;
      if (this.put(s, x, y, { pad: 2 })) got++;
    }
  }
  draw(dst: ArtImage) {
    for (const p of [...this.items].sort((a, b) => a.fy - b.fy || a.x - b.x)) for (let y = 0; y < p.img.h; y++) for (let x = 0; x < p.img.w; x++) {
      const v = p.img.data[y * p.img.w + x];
      const px = p.x + x, py = p.y + y;
      if (v !== CLEAR && px >= 0 && py >= 0 && px < dst.w && py < dst.h) dst.data[py * dst.w + px] = v;
    }
  }
}

function flip(img: ArtImage): ArtImage {
  const o = artBlank(img.w, img.h);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) o.data[y * img.w + img.w - 1 - x] = img.data[y * img.w + x];
  return o;
}

/** Soft blob mask (superellipse + low-frequency wobble), 1 = region. */
export function blobMask(w: number, h: number, cx: number, cy: number, rx: number, ry: number, seed: number): Uint8Array {
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ex = Math.abs((x - cx) / rx), ey = Math.abs((y - cy) / ry);
    const r = Math.pow(ex, 2.6) + Math.pow(ey, 2.6) + (fbm3(x, y, seed, 22) - 0.5) * 0.9;
    m[y * w + x] = r < 1 ? 1 : 0;
  }
  return m;
}
