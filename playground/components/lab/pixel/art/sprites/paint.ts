// A tiny pixel painter for hero sprites. Every primitive paints palette
// indices from a named RAMP and shades itself for the one key light (top-left):
// lit flank → ramp top, shadow flank → ramp bottom. Finishing passes add the
// selective outline (shadow side only, in the darkest step of the touching
// material — never flat black) and a rim light on lit edges.
//
// Also: `rows()` turns hand-drawn string art (one char per pixel, legend →
// [ramp, step]) into the same index image, for glyph-like assets (compass
// letters, "?" signs) that are better placed by hand.
import { CLEAR, RAMPS, darker, lighter, type RampName } from "../palette";
import { artBlank, type ArtImage } from "../raster";
import { bayer4 } from "../noise";

export type Legend = Record<string, readonly [RampName, number] | number>;

export interface Sprite {
  img: ArtImage;
  /** ground-contact shadow mask (non-clear = shadowed), same frame as img. */
  shadow?: ArtImage;
  /** art-px point that sits on the ground / footprint centre-bottom. */
  anchor: { x: number; y: number };
  /** where a mechanism emblem / banner glyph goes (art px, inside img). */
  slot?: { x: number; y: number; w: number; h: number };
}

const R = (ramp: RampName, i: number) => {
  const r = RAMPS[ramp];
  return r[Math.max(0, Math.min(r.length - 1, i < 0 ? r.length + i : i))];
};

export class Painter {
  img: ArtImage;
  w: number;
  h: number;
  constructor(w: number, h: number) { this.w = w; this.h = h; this.img = artBlank(w, h); }

  get(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.img.data[y * this.w + x] : CLEAR;
  }
  set(x: number, y: number, v: number) {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h && v !== CLEAR) this.img.data[y * this.w + x] = v;
  }
  px(x: number, y: number, ramp: RampName, i: number) { this.set(x, y, R(ramp, i)); }
  rect(x: number, y: number, w: number, h: number, ramp: RampName, i: number) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, ramp, i);
  }
  hline(x0: number, x1: number, y: number, ramp: RampName, i: number) { for (let x = x0; x <= x1; x++) this.px(x, y, ramp, i); }
  vline(x: number, y0: number, y1: number, ramp: RampName, i: number) { for (let y = y0; y <= y1; y++) this.px(x, y, ramp, i); }
  line(x0: number, y0: number, x1: number, y1: number, ramp: RampName, i: number) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) this.px(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), ramp, i);
  }

  /**
   * Upright cylinder/tower body: columns shaded lit-left → shadow-right,
   * optional masonry courses (sparse darker brick seams).
   */
  cylinder(x: number, y: number, w: number, h: number, ramp: RampName, o: { mid?: number; courses?: boolean } = {}) {
    const top = RAMPS[ramp].length - 1;
    const mid = o.mid ?? Math.round(top * 0.6);
    for (let c = 0; c < w; c++) {
      const u = (c + 0.5) / w;
      const s = u < 0.18 ? mid + 1 : u < 0.55 ? mid : u < 0.82 ? mid - 1 : mid - 2;
      for (let r = 0; r < h; r++) {
        let v = s;
        if (o.courses !== false && r % 4 === 3 && (c + (r >> 2)) % 3 === 0) v -= 1;
        this.px(x + c, y + r, ramp, v);
      }
    }
  }

  /** Flat wall: lit left edge column, body, shadowed right column, darker base course. */
  wall(x: number, y: number, w: number, h: number, ramp: RampName, o: { mid?: number } = {}) {
    const top = RAMPS[ramp].length - 1;
    const mid = o.mid ?? Math.round(top * 0.55);
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      let v = c === 0 ? mid + 1 : c === w - 1 ? mid - 1 : mid;
      if (r === h - 1) v -= 1;
      if (r % 3 === 2 && (c + r) % 4 === 0) v -= 1;
      this.px(x + c, y + r, ramp, v);
    }
  }

  /** Crenellated parapet on top of a body at row y (merlons 2 px wide). */
  crenels(x: number, y: number, w: number, ramp: RampName, mid = 3) {
    for (let c = 0; c < w; c++) {
      const merlon = Math.floor(c / 2) % 2 === 0;
      const v = c === 0 ? mid + 1 : c >= w - 2 ? mid - 1 : mid;
      if (merlon) { this.px(x + c, y - 2, ramp, v + 1); this.px(x + c, y - 1, ramp, v); }
      this.px(x + c, y, ramp, v - 1);
    }
  }

  /** Cone roof: apex (cx, y), base row y+h, half-width hw. Lit left half. */
  cone(cx: number, y: number, hw: number, h: number, ramp: RampName, o: { mid?: number; eave?: boolean } = {}) {
    const top = RAMPS[ramp].length - 1;
    const mid = o.mid ?? Math.round(top * 0.6);
    for (let r = 0; r <= h; r++) {
      const half = Math.round((r / h) * hw);
      for (let dx = -half; dx <= half; dx++) {
        const u = (dx + half + 0.5) / (2 * half + 1);
        let v = u < 0.4 ? mid + 1 : u < 0.7 ? mid : mid - 1;
        if (r > 1 && r % 3 === 0 && dx % 2 === 0) v -= 1;                 // shingle rows
        if (dx === -half && r > 0) v = mid + 1;
        this.px(cx + dx, y + r, ramp, v);
      }
    }
    if (o.eave !== false) this.hline(cx - hw, cx + hw, y + h + 1, ramp, mid - 2);
  }

  /** Gable roof seen from the front-top: a band with a lit ridge line. */
  gable(x: number, y: number, w: number, h: number, ramp: RampName) {
    const top = RAMPS[ramp].length - 1;
    for (let r = 0; r < h; r++) {
      const inset = Math.max(0, h - 1 - r) >> 1;
      for (let c = inset; c < w - inset; c++) {
        let v = r === 0 ? top : r < h / 2 ? top - 1 : top - 2;
        if (c === w - inset - 1) v -= 1;
        if (r === h - 1) v = Math.max(0, top - 3);
        this.px(x + c, y + r, ramp, v);
      }
    }
  }

  /** Filled ellipse with sphere shading for the top-left light. */
  ball(cx: number, cy: number, rx: number, ry: number, ramp: RampName, o: { mid?: number; spec?: boolean; gain?: number } = {}) {
    const top = RAMPS[ramp].length - 1;
    const mid = o.mid ?? Math.round(top * 0.55);
    for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      const ex = dx / (rx + 0.5), ey = dy / (ry + 0.5);
      const d2 = ex * ex + ey * ey;
      if (d2 > 1) continue;
      const l = -(ex + ey) * 0.75 + (1 - d2) * 0.3;
      let v = mid + l * (o.gain ?? 2.2);
      const f = Math.floor(v), frac = v - f;
      v = Math.abs(frac - 0.5) < 0.12 ? (bayer4(cx + dx, cy + dy) < frac ? f + 1 : f) : Math.round(v);
      this.px(cx + dx, cy + dy, ramp, Math.max(0, Math.min(top, v)));
    }
    if (o.spec) this.px(cx - Math.round(rx * 0.45), cy - Math.round(ry * 0.45), ramp, top);
  }

  /** Dome (upper half-ball) sitting on row `y` (its base). */
  dome(cx: number, y: number, r: number, ramp: RampName, o: { mid?: number } = {}) {
    const top = RAMPS[ramp].length - 1;
    const mid = o.mid ?? Math.round(top * 0.55);
    for (let dy = -r; dy <= 0; dy++) for (let dx = -r; dx <= r; dx++) {
      const ex = dx / (r + 0.5), ey = dy / (r + 0.5);
      const d2 = ex * ex + ey * ey;
      if (d2 > 1) continue;
      const l = -(ex * 0.9 + ey * 0.5);
      this.px(cx + dx, y + dy, ramp, Math.max(0, Math.min(top, Math.round(mid + l * 2))));
    }
    this.px(cx - Math.round(r * 0.4), y - Math.round(r * 0.6), ramp, top);
  }

  /** Arched window/door: dark recess, lit when `glow`. */
  window(x: number, y: number, w: number, h: number, glow = false) {
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      if (r === 0 && w > 1 && (c === 0 || c === w - 1)) continue;          // arched top
      const v = glow ? (r === 0 || c === w - 1 ? R("glow", 0) : R("glow", 1 + (r === 1 && c === 0 ? 1 : 0))) : R("stone", r === 0 ? 1 : 0);
      this.set(x + c, y + r, v);
    }
  }

  door(x: number, y: number, w: number, h: number) {
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      if (r === 0 && (c === 0 || c === w - 1)) continue;
      this.set(x + c, y + r, c === 0 ? R("wood", 2) : R("wood", 1));
    }
    this.set(x + w - 2, y + (h >> 1) + 1, R("gold", 3));
  }

  /** Pennant flag on a pole: pole top at (x, y). */
  flag(x: number, y: number, ramp: RampName = "roof", len = 5, pole = 5) {
    this.vline(x, y, y + pole, "stone", 1);
    this.px(x, y - 1, "gold", 4);
    for (let c = 1; c <= len; c++) {
      const rows = Math.max(1, Math.round(3 * (1 - (c - 1) / len)));
      for (let r = 0; r < rows; r++) this.px(x + c, y + r + (c > len / 2 ? 1 : 0), ramp, r === 0 ? -2 : -3);
    }
  }

  /** Paint string art at (ox, oy) with a legend (char → [ramp, step] | index). */
  rows(ox: number, oy: number, art: readonly string[], legend: Legend) {
    art.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === "." || ch === " ") continue;
        const e = legend[ch];
        if (e === undefined) continue;
        this.set(ox + x, oy + y, typeof e === "number" ? e : R(e[0], e[1]));
      }
    });
  }

  /** Stamp a 1-bit mask (emblem) with a fill + a 1 px drop-shadow down-right. */
  mask(ox: number, oy: number, bits: Uint8Array, size: number, fill: number, drop?: number) {
    if (drop !== undefined) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (bits[y * size + x] && !bits[(y + 1) * size + x + 1]) this.set(ox + x + 1, oy + y + 1, drop);
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (bits[y * size + x]) this.set(ox + x, oy + y, fill);
  }

  /**
   * Finishing: (1) rim light — interior pixels with clear above/left lighten a
   * step; (2) selective outline — clear pixels to the right/below of the
   * silhouette take the DARKEST step of the touching material's ramp.
   * Lit side (top/left) stays un-outlined (optionally a one-step-darker
   * hairline when `litLine`, for sprites that must read on busy ground).
   */
  finish(o: { rim?: boolean; litLine?: boolean } = {}) {
    const { w, h } = this;
    const src = new Uint8Array(this.img.data);
    const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? src[y * w + x] : CLEAR);
    if (o.rim !== false) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = at(x, y);
        if (v === CLEAR) continue;
        if (at(x, y - 1) === CLEAR || at(x - 1, y) === CLEAR) this.img.data[y * w + x] = lighter(v);
      }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (at(x, y) !== CLEAR) continue;
      const left = at(x - 1, y), up = at(x, y - 1), ul = at(x - 1, y - 1);
      const right = at(x + 1, y), down = at(x, y + 1);
      const shadowSide = left !== CLEAR ? left : up !== CLEAR ? up : ul !== CLEAR && (at(x - 1, y) !== CLEAR || at(x, y - 1) !== CLEAR) ? ul : CLEAR;
      if (shadowSide !== CLEAR) { this.img.data[y * w + x] = darker(shadowSide, 6); continue; }
      if (o.litLine) {
        const lit = right !== CLEAR ? right : down !== CLEAR ? down : CLEAR;
        if (lit !== CLEAR) this.img.data[y * w + x] = darker(lit, 2);
      }
    }
    return this;
  }

  /** Elliptical ground-contact shadow mask under the sprite, offset down-right. */
  groundShadow(cx: number, cy: number, rx: number, ry: number): ArtImage {
    const m = artBlank(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const ex = (x + 0.5 - cx - 1) / rx, ey = (y + 0.5 - cy) / ry;
      if (ex * ex + ey * ey <= 1) m.data[y * this.w + x] = 1;
    }
    return m;
  }

  done(anchor: { x: number; y: number }, extra: Partial<Sprite> = {}): Sprite {
    return { img: this.img, anchor, ...extra };
  }
}

/** Grow a canvas: a sprite drawn on a bigger Painter (for shadows/outlines that overhang). */
export const ramp = R;
