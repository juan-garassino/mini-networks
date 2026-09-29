// Drawing kit for the biome art: a Painter that also paints raw palette
// indices (so the biome ramps in ./palette work everywhere), string art with an
// index legend, and a finish pass (rim light + selective shadow-side outline)
// that understands the biome ramps. Same rules as sprites/paint.ts: one key
// light top-left, lit faces left/top, outline only on the shadow side in the
// darkest step of the touching material; the builder's inkOutline() then adds
// the 1-px maroon ink ring round the whole silhouette (parchment edition).
import { CLEAR } from "../palette";
import { artBlank, type ArtImage } from "../raster";
import { downsample } from "../../raster";
import { Painter, type Sprite } from "../sprites/paint";
import { dk, lt } from "./palette";

export type IdxLegend = Record<string, number>;

export class Pen extends Painter {
  f(x: number, y: number, w: number, h: number, v: number) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, v);
  }
  hl(x0: number, x1: number, y: number, v: number) { for (let x = x0; x <= x1; x++) this.set(x, y, v); }
  vl(x: number, y0: number, y1: number, v: number) { for (let y = y0; y <= y1; y++) this.set(x, y, v); }
  ln(x0: number, y0: number, x1: number, y1: number, v: number) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) this.set(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), v);
  }
  /** String art with an index legend ('.'/' ' = skip). */
  art(ox: number, oy: number, rows: readonly string[], legend: IdxLegend) {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const v = legend[row[x]];
        if (v !== undefined) this.set(ox + x, oy + y, v);
      }
    });
  }
  /** Filled ellipse, lit top-left: 3 tones (lit / body / shade) + optional spec. */
  blob(cx: number, cy: number, rx: number, ry: number, lit: number, body: number, shade: number, spec?: number) {
    for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      const ex = dx / (rx + 0.5), ey = dy / (ry + 0.5);
      if (ex * ex + ey * ey > 1) continue;
      const l = -(ex + ey);
      this.set(cx + dx, cy + dy, l > 0.55 ? lit : l < -0.45 ? shade : body);
    }
    if (spec !== undefined) this.set(cx - Math.round(rx * 0.45), cy - Math.round(ry * 0.45), spec);
  }
  /** Box with a lit left column, shaded right column and a darker base row. */
  box(x: number, y: number, w: number, h: number, body: number, o: { lit?: number; shade?: number; top?: number; base?: number } = {}) {
    const lit = o.lit ?? lt(body), shade = o.shade ?? dk(body);
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      let v = c === 0 ? lit : c === w - 1 ? shade : body;
      if (r === h - 1 && o.base !== undefined) v = o.base;
      this.set(x + c, y + r, v);
    }
    if (o.top !== undefined) this.hl(x, x + w - 1, y, o.top);
  }
  clearPx(x: number, y: number) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.img.data[y * this.w + x] = CLEAR; }

  /**
   * Finishing pass with biome-aware ramps: rim light on pixels with clear
   * above/left (skipped for `glow` indices that are already brightest), then a
   * selective outline on the shadow side (right/below) in the darkest step.
   */
  done2(anchor: { x: number; y: number }, o: { rim?: boolean; outline?: boolean; keep?: ReadonlySet<number>; shadow?: [number, number, number, number]; slot?: Sprite["slot"] } = {}): Sprite {
    const { w, h } = this;
    const src = new Uint8Array(this.img.data);
    const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? src[y * w + x] : CLEAR);
    if (o.rim !== false) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = at(x, y);
      if (v === CLEAR || o.keep?.has(v)) continue;
      if (at(x, y - 1) === CLEAR || at(x - 1, y) === CLEAR) this.img.data[y * w + x] = lt(v);
    }
    if (o.outline !== false) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (at(x, y) !== CLEAR) continue;
      const left = at(x - 1, y), up = at(x, y - 1);
      const s = left !== CLEAR ? left : up;
      if (s !== CLEAR && !o.keep?.has(s)) this.img.data[y * w + x] = dk(s, 6);
    }
    const sh = o.shadow;
    return {
      img: this.img, anchor,
      ...(sh ? { shadow: this.groundShadow(sh[0], sh[1], sh[2], sh[3]) } : {}),
      ...(o.slot ? { slot: o.slot } : {}),
    };
  }
}

/** A stamp as the authored composer's Glyph shape ({img, foot}) plus a name/role. */
export interface BiomeStamp {
  name: string;
  /** decor = scatter in free land · relief = mesas/canyons/buttes · town = buildings/clusters ·
   *  rail = track + train + station · city = towers/billboards · reef = corals/kelp/ruins · fauna = fish/bubbles */
  role: "decor" | "relief" | "town" | "rail" | "city" | "reef" | "fauna";
  img: ArtImage;
  foot: { x: number; y: number };
  note: string;
}

export const stampOf = (name: string, role: BiomeStamp["role"], s: Sprite, note: string): BiomeStamp =>
  ({ name, role, img: s.img, foot: s.anchor, note });

/**
 * Detail tier: `f` = integer downsample factor (1 full · 2 = ÷2 · 3 = micro),
 * palette-preserving (block mode, outlines weighted), anchor/foot/slot scaled.
 */
export function atTier<T extends { img: ArtImage }>(s: T, f: number): T {
  if (f <= 1) return s;
  const img = downsample(s.img, f, (v) => (v === CLEAR ? 0.8 : 1)) as ArtImage;
  const out: Record<string, unknown> = { ...s, img };
  for (const k of ["anchor", "foot"] as const) {
    const p = (s as Record<string, unknown>)[k] as { x: number; y: number } | undefined;
    if (p) out[k] = { x: Math.round(p.x / f), y: Math.round(p.y / f) };
  }
  const slot = (s as Record<string, unknown>).slot as Sprite["slot"] | undefined;
  if (slot) out.slot = { x: Math.round(slot.x / f), y: Math.round(slot.y / f), w: Math.max(1, Math.round(slot.w / f)), h: Math.max(1, Math.round(slot.h / f)) };
  delete out.shadow;
  return out as T;
}

/** Compose several sprites (back-to-front by anchor y) onto one canvas; returns a Sprite. */
export function cluster(w: number, h: number, parts: { s: Sprite | BiomeStamp; x: number; y: number; flip?: boolean }[], anchor: { x: number; y: number }): Sprite {
  const img = artBlank(w, h);
  const foot = (s: Sprite | BiomeStamp) => ("anchor" in s ? s.anchor : s.foot);
  const sorted = [...parts].sort((a, b) => a.y - b.y);
  for (const { s, x, y, flip } of sorted) {
    const f = foot(s);
    const ox = x - (flip ? s.img.w - 1 - f.x : f.x), oy = y - f.y;
    for (let sy = 0; sy < s.img.h; sy++) for (let sx = 0; sx < s.img.w; sx++) {
      const v = s.img.data[sy * s.img.w + (flip ? s.img.w - 1 - sx : sx)];
      if (v === CLEAR) continue;
      const px = ox + sx, py = oy + sy;
      if (px >= 0 && py >= 0 && px < w && py < h) img.data[py * w + px] = v;
    }
  }
  return { img, anchor };
}

// ——————————————————————————— 3/4 diorama primitives (index ramps, dark → light) ———————————————————————————
// The reference look: props STAND UP in a 3/4 top-down view — roofs are big readable
// shapes seen from above-front, walls below, a 1-px maroon-brown outline, a ground shadow.
type Ramp = readonly number[];
const at = (r: Ramp, t: number) => r[Math.max(0, Math.min(r.length - 1, Math.round(t * (r.length - 1))))];

/** Gable roof, front slope seen from above: lit ridge, shingle courses, lit left end, dark eave. */
export function roof3q(p: Pen, x: number, y: number, w: number, h: number, R: Ramp) {
  for (let r = 0; r < h; r++) {
    const inset = r === 0 ? 1 : 0;
    for (let c = inset; c < w - inset; c++) {
      let v = r === 0 ? at(R, 0.95) : at(R, 0.6);
      if (r > 0 && r % 2 === 0 && (c + (r >> 1)) % 3 === 0) v = at(R, 0.4);          // shingle butts
      if (c <= inset + 1 && r > 0) v = at(R, 0.8);                                   // lit hip
      if (c >= w - 2 - inset && r > 0) v = at(R, 0.35);                              // shaded hip
      if (r === h - 1) v = at(R, 0.15);                                              // eave shadow line
      p.set(x + c, y + r, v);
    }
  }
}

/** Half-timbered wall: cream plaster, dark oak frame (edges, mid post, rail, braces). */
export function timber(p: Pen, x: number, y: number, w: number, h: number, plaster: Ramp, beam: Ramp) {
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) p.set(x + c, y + r, c === 0 ? at(plaster, 1) : c >= w - 1 ? at(plaster, 0.4) : at(plaster, 0.75));
  const b = at(beam, 0.25);
  p.vl(x, y, y + h - 1, b); p.vl(x + w - 1, y, y + h - 1, b); p.hl(x, x + w - 1, y, b); p.hl(x, x + w - 1, y + h - 1, b);
  if (h >= 6) p.hl(x, x + w - 1, y + (h >> 1), b);
  for (let c = 4; c < w - 2; c += 5) p.vl(x + c, y, y + h - 1, b);
  if (w >= 7 && h >= 6) { p.ln(x + 1, y + (h >> 1) - 1, x + 3, y + 1, b); }
}

/** Plain wall with lit left column, shaded right, darker base. */
export function wall3q(p: Pen, x: number, y: number, w: number, h: number, R: Ramp, courses = true) {
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    let v = c === 0 ? at(R, 0.95) : c >= w - 2 ? at(R, 0.45) : at(R, 0.7);
    if (courses && r % 3 === 2 && (c + r) % 4 === 0) v = at(R, 0.5);
    if (r === h - 1) v = at(R, 0.35);
    p.set(x + c, y + r, v);
  }
}

/** Cone roof (towers, turrets): apex (cx, y), half-width hw at y+h. */
export function cone3q(p: Pen, cx: number, y: number, hw: number, h: number, R: Ramp) {
  for (let r = 0; r <= h; r++) {
    const half = Math.round((r / h) * hw);
    for (let dx = -half; dx <= half; dx++) {
      const u = (dx + half + 0.5) / (2 * half + 1);
      let v = u < 0.4 ? at(R, 0.85) : u < 0.72 ? at(R, 0.6) : at(R, 0.35);
      if (r === h) v = at(R, 0.15);
      p.set(cx + dx, y + r, v);
    }
  }
}

/** Upright cylinder (tower body): lit left third, shaded right. */
export function cyl3q(p: Pen, x: number, y: number, w: number, h: number, R: Ramp) {
  for (let c = 0; c < w; c++) {
    const u = (c + 0.5) / w;
    const v = u < 0.2 ? at(R, 1) : u < 0.55 ? at(R, 0.75) : u < 0.8 ? at(R, 0.55) : at(R, 0.35);
    for (let r = 0; r < h; r++) p.set(x + c, y + r, r % 4 === 3 && (c + (r >> 2)) % 3 === 0 ? at(R, 0.45) : v);
  }
}

/** Dome on base row y: sphere shading lit top-left, specular glint. */
export function dome3q(p: Pen, cx: number, y: number, r: number, R: Ramp, glint?: number) {
  for (let dy = -r; dy <= 0; dy++) for (let dx = -r; dx <= r; dx++) {
    const ex = dx / (r + 0.5), ey = dy / (r + 0.5);
    if (ex * ex + ey * ey > 1) continue;
    const l = -(ex * 0.9 + ey * 0.6);
    p.set(cx + dx, y + dy, l > 0.55 ? at(R, 1) : l > 0.1 ? at(R, 0.75) : l > -0.35 ? at(R, 0.5) : at(R, 0.3));
  }
  if (glint !== undefined) p.set(cx - Math.round(r * 0.45), y - Math.round(r * 0.6), glint);
}

/** Window (w×h): dark pane or warm lit pane, lit sill. */
export function win3q(p: Pen, x: number, y: number, w: number, h: number, pane: number, frame?: number) {
  p.f(x, y, w, h, pane);
  if (frame !== undefined) p.hl(x, x + w - 1, y + h, frame);
}

/** Layered pine (3/4): stacked tiers, lit left flank, trunk stub. */
export function pine3q(p: Pen, cx: number, base: number, h: number, R: Ramp, trunk: number, snow?: number) {
  const tiers = Math.max(2, Math.round(h / 4));
  const top = base - h;
  for (let t = 0; t < tiers; t++) {
    const y0 = top + Math.round((t * (h - 2)) / tiers), y1 = top + Math.round(((t + 1) * (h - 2)) / tiers) + 1;
    const maxHw = Math.round(1 + ((t + 1) / tiers) * (h * 0.28));
    for (let y = y0; y <= y1; y++) {
      const hw = Math.max(0, Math.round(((y - y0 + 1) / (y1 - y0 + 1)) * maxHw));
      for (let dx = -hw; dx <= hw; dx++) {
        const u = (dx + hw + 0.5) / (2 * hw + 1);
        let v = u < 0.35 ? at(R, 0.85) : u < 0.7 ? at(R, 0.6) : at(R, 0.35);
        if (y === y1) v = at(R, 0.2);
        if (snow !== undefined && y === y0 + 1 && u < 0.7) v = snow;
        p.set(cx + dx, y, v);
      }
    }
  }
  p.vl(cx, base - 1, base, trunk);
}

/** Round broadleaf (oak) canopy of 3 lobes + trunk. */
export function oak3q(p: Pen, cx: number, base: number, r: number, R: Ramp, trunk: number) {
  p.vl(cx, base - r, base, trunk); p.set(cx + 1, base, trunk);
  const cy = base - r - 2;
  p.blob(cx - Math.round(r * 0.5), cy + 1, r * 0.7, r * 0.6, at(R, 0.85), at(R, 0.6), at(R, 0.3));
  p.blob(cx + Math.round(r * 0.5), cy + 1, r * 0.7, r * 0.6, at(R, 0.8), at(R, 0.55), at(R, 0.25));
  p.blob(cx, cy - Math.round(r * 0.35), r * 0.75, r * 0.65, at(R, 1), at(R, 0.65), at(R, 0.35));
}
