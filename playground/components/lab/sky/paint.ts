// Pixel painting on a screen canvas, on a fixed ART grid (1 art px = `ap` CSS
// px, snapped to the device grid): sprites, 1-px Bresenham lines that stop
// short of the stars they join, dotted pipeline arcs, broken rings. Every mark
// lands on whole art pixels — no antialiased stroke anywhere on the sky.
import { NIGHT, hex } from "./tokens.ts";
import type { Sprite } from "./sprites.ts";

export type Pt = { x: number; y: number };

/** One layer of art pixels, batched by colour (fillRect per pixel, one fillStyle per colour). */
export class Pix {
  private by = new Map<string, number[]>();
  constructor(readonly ap: number, readonly dpr: number, readonly cols: number, readonly rows: number) {}
  add(ax: number, ay: number, c: string) {
    if (ax < -2 || ay < -2 || ax > this.cols + 2 || ay > this.rows + 2) return;
    let a = this.by.get(c);
    if (!a) { a = []; this.by.set(c, a); }
    a.push(ax, ay);
  }
  flush(ctx: CanvasRenderingContext2D) {
    const s = Math.round(this.ap * this.dpr);
    for (const [c, a] of this.by) {
      ctx.fillStyle = c;
      for (let i = 0; i < a.length; i += 2) ctx.fillRect(a[i] * s, a[i + 1] * s, s, s);
    }
    this.by.clear();
  }
}

/** Integer line from a to b (inclusive), 8-connected. */
export function bresenham(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const out: [number, number][] = [];
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy, x = x0, y = y0;
  for (let guard = 0; guard < 20000; guard++) {
    out.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x += sx; }
    if (e2 <= dx) { e += dx; y += sy; }
  }
  return out;
}

/** The pixels of a line between two stars, minus the `ra` / `rb` art px around each end. */
export function asterism(a: [number, number], b: [number, number], ra: number, rb: number): [number, number][] {
  return bresenham(a[0], a[1], b[0], b[1]).filter(([x, y]) => Math.hypot(x - a[0], y - a[1]) > ra && Math.hypot(x - b[0], y - b[1]) > rb);
}

/** A quadratic arc bowed to the left of a→b, as unique art pixels (stopping short like a line). */
export function arcPixels(a: [number, number], b: [number, number], ra: number, rb: number, bow = 0.2): [number, number][] {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  const k = Math.min(bow, 40 / L);
  const cx = (a[0] + b[0]) / 2 - dy * k, cy = (a[1] + b[1]) / 2 + dx * k;
  const n = Math.ceil(L * 1.6);
  const out: [number, number][] = [];
  let last = "";
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const x = Math.round(u * u * a[0] + 2 * u * t * cx + t * t * b[0]), y = Math.round(u * u * a[1] + 2 * u * t * cy + t * t * b[1]);
    const key = `${x},${y}`;
    if (key === last) continue;
    last = key;
    if (Math.hypot(x - a[0], y - a[1]) > ra && Math.hypot(x - b[0], y - b[1]) > rb) out.push([x, y]);
  }
  return out;
}

/** Stamp a sprite centred on (ax, ay); `ink` overrides its colours (dimmed families). */
export function stamp(p: Pix, s: Sprite, ax: number, ay: number, ink?: (c: string) => string) {
  const ox = ax - (s.w - 1) / 2, oy = ay - (s.h - 1) / 2;
  for (let y = 0; y < s.h; y++) {
    const row = s.rows[y];
    for (let x = 0; x < s.w; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      const c = s.ink[ch];
      p.add(Math.round(ox + x), Math.round(oy + y), ink ? ink(c) : c);
    }
  }
}

// ——— dimming: a colour sunk toward the open sky, still a flat colour (no alpha on the sky)
const SKY = hex(NIGHT[1]);
const dimCache = new Map<string, string>();
export function dim(c: string, k = 0.62): string {
  const key = `${c}|${k}`;
  const hit = dimCache.get(key);
  if (hit) return hit;
  const v = hex(c);
  const out = `#${v.map((ch, i) => Math.round(ch + (SKY[i] - ch) * k).toString(16).padStart(2, "0")).join("")}`;
  dimCache.set(key, out);
  return out;
}

/** Mix two hex colours (t = 0 → a). */
export function mix(a: string, b: string, t: number): string {
  const x = hex(a), y = hex(b);
  return `#${x.map((ch, i) => Math.round(ch + (y[i] - ch) * t).toString(16).padStart(2, "0")).join("")}`;
}
