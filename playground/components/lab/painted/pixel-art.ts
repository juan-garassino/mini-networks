// Pixel art for the true map, drawn at ART resolution (1 unit = 1 art pixel)
// into plain RGBA buffers that become canvas layers scaled with the map — so
// every marker, ribbon and glyph pixel sits exactly on the map's grid at every
// crisp scale. Colours are the map's own: every token below is one of the 128
// entries of pixel-map-true.png's palette (index in the comment; see
// .lab-shots/painted/palette.png). No DOM here: callers putImageData().
import { CRITTER } from "@/components/lab/shared/critter";
import type { EvidenceState } from "@/components/lab/shared/card-model";

type RGB = readonly [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// ——— tokens sampled from the map's palette
export const INK = {
  parchment: "#f0e1ae",   // 0  — the sea/parchment itself
  parchHi: "#fdf4c1",     // 62
  parchLo: "#e9deb0",     // 120
  parchDeep: "#caa57c",   // 76
  maroon: "#7a2424",      // 23 — the map's red-brown ink
  maroonDeep: "#4a091c",  // 103
  ink: "#3a1d2a",         // 17 — darkest warm outline
  inkSoft: "#715755",     // 15
  shadow: "#221316",      // 38
  gold: "#fdc771",        // 8  — road-marker gold
  goldHi: "#feed73",      // 108
  goldLo: "#eba244",      // 33
  goldDeep: "#9e4d2d",    // 24
  sea: "#24b9d4",         // 5
  white: "#ffffff",       // 3
} as const;

/** Evidence ramps: [lit, base, shade] + the glyph/outline colours. */
export const EVIDENCE_ART: Record<EvidenceState, { ramp: [string, string, string]; line: string; glyph: string; dashed?: boolean }> = {
  champion: { ramp: ["#feed73", "#fece66", "#eba244"], line: "#3a1d2a", glyph: "#7a2424" },     // 108 · 112 · 33
  trained: { ramp: ["#b5b93d", "#597b29", "#46582a"], line: "#233424", glyph: "#d8e1c6" },      // 7 · 9 · 32 · 70 · 111
  provisional: { ramp: ["#fdf4c1", "#f0e1ae", "#e9deb0"], line: "#7a2424", glyph: "#7a2424", dashed: true }, // 62 · 0 · 120
  untrained: { ramp: ["#d2ceb9", "#9a8e88", "#51545d"], line: "#221316", glyph: "#51545d" },    // 81 · 42 · 63 · 38
};

// ——— a raster we write art pixels into

export class Raster {
  readonly data: Uint8ClampedArray;
  constructor(readonly w: number, readonly h: number, data?: Uint8ClampedArray) {
    this.data = data ?? new Uint8ClampedArray(w * h * 4);
  }
  set(x: number, y: number, c: RGB | string, a = 255) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const rgb = typeof c === "string" ? hex(c) : c;
    const i = (y * this.w + x) * 4;
    this.data[i] = rgb[0]; this.data[i + 1] = rgb[1]; this.data[i + 2] = rgb[2]; this.data[i + 3] = a;
  }
  rect(x: number, y: number, w: number, h: number, c: RGB | string) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }
  clear() { this.data.fill(0); }
}

// ——— shapes as pixel sets; outline = set pixels with a 4-neighbour outside

type Px = Map<string, string>; // "x,y" → region/colour key
const key = (x: number, y: number) => `${x},${y}`;
const unkey = (k: string) => k.split(",").map(Number) as [number, number];

function outlineOf(set: Px): Set<string> {
  const out = new Set<string>();
  for (const k of set.keys()) {
    const [x, y] = unkey(k);
    if (!set.has(key(x - 1, y)) || !set.has(key(x + 1, y)) || !set.has(key(x, y - 1)) || !set.has(key(x, y + 1))) out.add(k);
  }
  return out;
}

/** 1-art-px drop shadow: the set shifted (1, 1), where it isn't covered. */
function paintShadow(r: Raster, set: Px, c: string) {
  for (const k of set.keys()) {
    const [x, y] = unkey(k);
    if (!set.has(key(x + 1, y + 1))) r.set(x + 1, y + 1, c);
  }
}

// ——— bitmap text: a 5-row small-caps face drawn for this map (cap height 5
// art px — the smallest size a pixel artist letters a map legend at; 3 px
// wide mostly, M/W 5, N/Q 4, 1 px letter spacing). Labels are set in caps, like
// a game-map legend: at 5 px, capitals read far better than lowercase.

const F: Record<string, string[]> = {
  A: [".x.", "x.x", "xxx", "x.x", "x.x"], B: ["xx.", "x.x", "xx.", "x.x", "xx."],
  C: [".xx", "x..", "x..", "x..", ".xx"], D: ["xx.", "x.x", "x.x", "x.x", "xx."],
  E: ["xxx", "x..", "xx.", "x..", "xxx"], F: ["xxx", "x..", "xx.", "x..", "x.."],
  G: [".xx", "x..", "x.x", "x.x", ".xx"], H: ["x.x", "x.x", "xxx", "x.x", "x.x"],
  I: ["xxx", ".x.", ".x.", ".x.", "xxx"], J: ["..x", "..x", "..x", "x.x", ".x."],
  K: ["x.x", "x.x", "xx.", "x.x", "x.x"], L: ["x..", "x..", "x..", "x..", "xxx"],
  M: ["x...x", "xx.xx", "x.x.x", "x...x", "x...x"], N: ["x..x", "xx.x", "x.xx", "x..x", "x..x"],
  O: [".x.", "x.x", "x.x", "x.x", ".x."], P: ["xx.", "x.x", "xx.", "x..", "x.."],
  Q: [".xx.", "x..x", "x..x", "x.x.", ".x.x"], R: ["xx.", "x.x", "xx.", "x.x", "x.x"],
  S: [".xx", "x..", ".x.", "..x", "xx."], T: ["xxx", ".x.", ".x.", ".x.", ".x."],
  U: ["x.x", "x.x", "x.x", "x.x", "xxx"], V: ["x.x", "x.x", "x.x", "x.x", ".x."],
  W: ["x...x", "x...x", "x.x.x", "xx.xx", "x...x"], X: ["x.x", "x.x", ".x.", "x.x", "x.x"],
  Y: ["x.x", "x.x", ".x.", ".x.", ".x."], Z: ["xxx", "..x", ".x.", "x..", "xxx"],
  "0": ["xxx", "x.x", "x.x", "x.x", "xxx"], "1": [".x", "xx", ".x", ".x", ".x"],
  "2": ["xx.", "..x", ".x.", "x..", "xxx"], "3": ["xx.", "..x", ".x.", "..x", "xx."],
  "4": ["x.x", "x.x", "xxx", "..x", "..x"], "5": ["xxx", "x..", "xx.", "..x", "xx."],
  "6": [".xx", "x..", "xxx", "x.x", "xxx"], "7": ["xxx", "..x", ".x.", ".x.", ".x."],
  "8": ["xxx", "x.x", "xxx", "x.x", "xxx"], "9": ["xxx", "x.x", "xxx", "..x", "xx."],
  " ": ["..", "..", "..", "..", ".."], "-": ["...", "...", "xxx", "...", "..."],
  "&": [".x.", "x.x", ".x.", "x.x", ".xx"],
};
export const FONT_ROWS = 5;

export function textRects(text: string, x: number, y: number, g: number): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const gl = F[ch] ?? F[" "];
    gl.forEach((row, gy) => [...row].forEach((c, gx) => { if (c === "x") out.push([cx + gx * g, y + gy * g, g, g]); }));
    cx += (gl[0].length + 1) * g;
  }
  return out;
}

export function textBox(text: string, g: number): { w: number; h: number } {
  let w = 0;
  for (const ch of text.toUpperCase()) w += ((F[ch] ?? F[" "])[0].length + 1) * g;
  return { w: Math.max(0, w - g), h: FONT_ROWS * g };
}

function paintText(r: Raster, text: string, x: number, y: number, g: number, c: string) {
  for (const [rx, ry, rw, rh] of textRects(text, x, y, g)) r.rect(rx, ry, rw, rh, c);
}

// ——— markers

const STAR = [".x.", "xxx", ".x."];          // champion: a 3×3 pixel star
const DOT = ["x"];

function lit(dx: number, dy: number, span: number): 0 | 1 | 2 {
  const s = dx + dy;
  return s <= -span ? 0 : s >= span ? 2 : 1;
}

/** Re-colour one of the map's own painted road markers by evidence: `disc`
 * is the marker's light fill pixels, `ring` its dark outline pixels (both as
 * pixel indices into the map). */
export function recolourMarker(r: Raster, disc: number[], ring: number[], state: EvidenceState) {
  const art = EVIDENCE_ART[state];
  let sx = 0, sy = 0;
  for (const p of disc) { sx += p % r.w; sy += Math.floor(p / r.w); }
  const cx = sx / disc.length, cy = sy / disc.length;
  for (const p of disc) {
    const x = p % r.w, y = Math.floor(p / r.w);
    r.set(x, y, art.ramp[lit(x - cx, y - cy, 2.5)]);
  }
  for (const p of ring) {
    const x = p % r.w, y = Math.floor(p / r.w);
    r.set(x, y, art.dashed && (x + y) % 2 === 0 ? art.ramp[1] : art.line);
  }
  glyph(r, Math.round(cx), Math.round(cy), state);
}

function glyph(r: Raster, cx: number, cy: number, state: EvidenceState) {
  const art = EVIDENCE_ART[state];
  const g = state === "champion" ? STAR : state === "trained" ? DOT : null;
  if (!g) return;
  const oy = cy - Math.floor(g.length / 2), ox = cx - Math.floor(g[0].length / 2);
  g.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === "x") r.set(ox + x, oy + y, art.glyph); }));
}

const DISC = ["..xxx..", ".xxxxx.", "xxxxxxx", "xxxxxxx", "xxxxxxx", ".xxxxx.", "..xxx.."];

/** A marker stone for a derived model that stands on a landmark, not on a
 * painted road marker: the same 7×7 disc, same ramps, same glyph. */
export function drawDisc(r: Raster, ax: number, ay: number, state: EvidenceState) {
  const set: Px = new Map();
  DISC.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === "x") set.set(key(ax - 3 + x, ay - 3 + y), "f"); }));
  paintShadow(r, set, INK.shadow);
  const ring = outlineOf(set);
  const art = EVIDENCE_ART[state];
  for (const k of set.keys()) {
    const [x, y] = unkey(k);
    if (ring.has(k)) r.set(x, y, art.dashed && (x + y) % 2 === 0 ? art.ramp[1] : art.line);
    else r.set(x, y, art.ramp[lit(x - ax, y - ay, 2)]);
  }
  glyph(r, ax, ay, state);
}

/** An atom's banner: a 1-px pole planted at the landmark (ax, ay) with a
 * flag flying from its top. Champion = gold swallowtail banner with a pixel
 * star; trained = green pennant; provisional = an unfinished frame (dashed
 * outline, bare parchment); untrained = a plain grey stone, no pole. */
export function drawBanner(r: Raster, ax: number, ay: number, state: EvidenceState) {
  if (state === "untrained") { drawDisc(r, ax, ay, state); return; }
  const art = EVIDENCE_ART[state];
  const top = ay - 15;
  // pole with a gold finial, 1-px shadow to its right
  for (let y = top; y <= ay; y++) { r.set(ax, y, INK.ink); r.set(ax + 1, y + 1, INK.shadow, 110); }
  r.set(ax, top - 1, INK.goldLo);
  r.set(ax, top - 2, INK.goldHi);
  // flag
  const set: Px = new Map();
  const fw = 10, fh = 7;
  for (let y = 0; y < fh; y++) {
    let w = fw;
    if (state === "trained") w = Math.max(1, fw - Math.abs(y - (fh - 1) / 2) * 2.6);          // pennant
    else if (state === "champion" && Math.abs(y - (fh - 1) / 2) < 1.5) w = fw - 2;          // swallowtail notch
    for (let x = 0; x < w; x++) set.set(key(ax + 1 + x, top + y), "f");
  }
  paintShadow(r, set, INK.shadow);
  const ring = outlineOf(set);
  for (const k of set.keys()) {
    const [x, y] = unkey(k);
    if (ring.has(k)) r.set(x, y, art.dashed && (x + y) % 2 === 0 ? INK.parchHi : art.line);
    else r.set(x, y, art.ramp[lit(x - (ax + 5), y - (top + 3), 3)]);
  }
  if (state === "champion") glyph(r, ax + 5, top + 3, state);
  if (state === "provisional") for (let x = ax + 3; x <= ax + 8; x += 2) r.set(x, top + 3, INK.maroon); // scaffold stitch
}

// ——— ribbons (labels) and signs

export type TailSide = "top" | "bottom" | "left" | "right" | null;
export interface RibbonSpec {
  text: string;
  x: number;            // plate top-left (art px)
  y: number;
  g: number;            // art px per font pixel
  tail: TailSide;
  tailAt: number;       // x (top/bottom) or y (left/right) of the tail tip
  stem?: number;        // extra 1-px stem beyond the 3-px pointer, toward the spot
  loud?: boolean;       // selected: inked (maroon plate, cream caps), gold edge, wider margin
  hover?: boolean;
  sign?: { count: number } | null; // family sign: count badge on the right
  dim?: boolean;        // outside the focused land: drawn in the dimmed palette
}

export function ribbonSize(text: string, g: number, loud = false, sign = false): { w: number; h: number; padX: number; padY: number; badge: number } {
  const t = textBox(text, g);
  // 1 art px of air above/below the caps, 2 beside them; the selected ribbon a little more
  const padX = 2 + (loud ? 1 : 0), padY = 1 + (loud ? 1 : 0);
  const badge = sign ? textBox("99", g).w + 5 : 0;
  // plate incl. its 1-px outline; flaps (3 px each side) are outside this box
  return { w: t.w + padX * 2 + 2 + badge, h: t.h + padY * 2 + 2, padX, padY, badge };
}

/** Extra art px a ribbon occupies outside its plate box (flaps + tail + shadow). */
export const RIBBON_MARGIN = 4;

export function drawRibbon(r: Raster, s: RibbonSpec) {
  const { w, h, padX, padY, badge } = ribbonSize(s.text, s.g, s.loud, Boolean(s.sign));
  const { x, y } = s;
  const plate: Px = new Map();
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    const corner = (xx === x || xx === x + w - 1) && (yy === y || yy === y + h - 1);
    if (!corner) plate.set(key(xx, yy), "p");
  }
  // scroll flaps: folded ends tucked behind the plate, notched on the outside
  const flaps: Px = new Map();
  const fy0 = y + 2, fh = Math.max(5, h - 1), mid = fy0 + (fh - 1) / 2;
  for (let yy = fy0; yy < fy0 + fh; yy++) {
    const d = Math.abs(yy - mid);
    for (let c = 1; c <= 3; c++) {
      if (c === 3 && d < 1.5) continue;
      if (c === 2 && d < 0.5) continue;
      flaps.set(key(x - c, yy), "f");
      flaps.set(key(x + w - 1 + c, yy), "f");
    }
  }
  // tail: a 3-px pointer from the plate toward the spot (+ an optional stem)
  if (s.tail) {
    const t = Math.round(s.tailAt), n = 3 + (s.stem ?? 0);
    const tx = Math.max(x + 3, Math.min(x + w - 4, t)), ty = Math.max(y + 3, Math.min(y + h - 4, t));
    for (let i = 1; i <= n; i++) {
      const half = Math.max(0, 3 - i);
      for (let k = -half; k <= half; k++) {
        if (s.tail === "top") plate.set(key(tx + k, y - i), "p");
        if (s.tail === "bottom") plate.set(key(tx + k, y + h - 1 + i), "p");
        if (s.tail === "left") plate.set(key(x - i, ty + k), "p");
        if (s.tail === "right") plate.set(key(x + w - 1 + i, ty + k), "p");
      }
    }
  }
  const all: Px = new Map([...flaps, ...plate]);
  paintShadow(r, all, INK.shadow);
  const flapRing = outlineOf(flaps);
  for (const k of flaps.keys()) {
    if (plate.has(k)) continue;
    const [fx, fy] = unkey(k);
    r.set(fx, fy, flapRing.has(k) ? INK.maroon : INK.parchDeep);
  }
  const ring = outlineOf(plate);
  const edge = s.loud ? INK.gold : INK.maroon;
  for (const k of plate.keys()) {
    const [px, py] = unkey(k);
    if (ring.has(k)) { r.set(px, py, edge); continue; }
    // selected = INKED: the plate filled with the map's maroon (as the
    // drawer's "you are here" chip), a warm bevel on top, a deep one below
    const inner = s.loud
      ? (py === y + 1 ? INK.goldDeep : py === y + h - 2 ? INK.maroonDeep : INK.maroon)
      : py === y + 1 ? (s.hover ? INK.white : INK.parchHi) : py === y + h - 2 ? INK.parchLo : s.hover ? INK.parchHi : INK.parchment;
    r.set(px, py, inner);
  }
  if (s.loud) {
    // the gold edge gets a dark keyline outside it: the loudest plate on the map
    for (const k of ring) {
      const [px, py] = unkey(k);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!all.has(key(px + dx, py + dy))) r.set(px + dx, py + dy, INK.ink);
    }
  }
  paintText(r, s.text, x + 1 + padX, y + 1 + padY, s.g, s.loud ? INK.parchHi : INK.ink);
  if (s.sign) {
    const bx = x + w - 1 - badge, by = y + 1, bh = h - 2;
    r.rect(bx, by, badge, bh, INK.maroon);
    r.rect(bx, by, badge, 1, INK.maroonDeep);
    const n = String(s.sign.count);
    const tb = textBox(n, s.g);
    paintText(r, n, bx + Math.floor((badge - tb.w) / 2), by + Math.floor((bh - tb.h) / 2), s.g, INK.parchHi);
  }
}

// ——— the focus "ghost": out-of-focus pixels fade toward a warm sepia
// duotone built from the map's own inkSoft (#715755, 15) and parchment
// (#f0e1ae, 0) — lighter and lower in contrast, so the world stays readable at
// full fade. GHOST_LEVELS discrete levels; the boundary between them is Bayer
// dithered (true-map.tsx), so the falloff is a crisp pixel-art gradient.
export const GHOST_LEVELS = 5;
const DUO_DARK = [0x71, 0x57, 0x55], DUO_LIGHT = [0xf0, 0xe1, 0xae];
export function ghostRGB(r: number, g: number, b: number, a: number): [number, number, number] {
  const l = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
  const l2 = 0.3 + 0.62 * l; // lift + compress contrast
  const k = 0.8 * a;
  return [r, g, b].map((v, c) => Math.round(v + ((DUO_DARK[c] + (DUO_LIGHT[c] - DUO_DARK[c]) * l2) - v) * k)) as [number, number, number];
}
/** 4×4 ordered-dither thresholds in [0, 1). */
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** Draw ribbons, the dimmed ones first and through the dim transform. */
export function drawRibbons(r: Raster, list: RibbonSpec[]) {
  const dim = list.filter((s) => s.dim);
  if (dim.length) {
    const tmp = new Raster(r.w, r.h);
    for (const s of dim) drawRibbon(tmp, s);
    for (let i = 0; i < tmp.data.length; i += 4) {
      if (!tmp.data[i + 3]) continue;
      const [a, b, c] = ghostRGB(tmp.data[i], tmp.data[i + 1], tmp.data[i + 2], 0.8);
      r.data[i] = a; r.data[i + 1] = b; r.data[i + 2] = c; r.data[i + 3] = tmp.data[i + 3];
    }
  }
  for (const s of list) if (!s.dim) drawRibbon(r, s);
}

// ——— lineage road, selection brackets, the critter

/** Pixels of a polyline (Bresenham), deduplicated, in order. */
export function rasterPolyline(pts: { x: number; y: number }[]): [number, number][] {
  const out: [number, number][] = [];
  const seen = new Set<string>();
  for (let i = 1; i < pts.length; i++) {
    let x0 = Math.round(pts[i - 1].x), y0 = Math.round(pts[i - 1].y);
    const x1 = Math.round(pts[i].x), y1 = Math.round(pts[i].y);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      const k = key(x0, y0);
      if (!seen.has(k)) { seen.add(k); out.push([x0, y0]); }
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  return out;
}

/** The lit lineage road: marching gold dashes (3 on, 2 off) with a 1-px
 * maroon keel under each lit pixel, so it reads over grass, sand and snow. */
export function drawLitRoad(r: Raster, px: [number, number][], phase: number) {
  px.forEach(([x, y], i) => {
    if ((i + phase) % 5 >= 3) return;
    r.set(x, y + 1, INK.maroon);
    r.set(x + 1, y + 1, INK.maroon);
  });
  px.forEach(([x, y], i) => {
    if ((i + phase) % 5 >= 3) return;
    r.set(x, y, INK.goldHi);
    r.set(x + 1, y, INK.gold);
  });
}

/** Four L-shaped pixel brackets around (cx, cy) at radius rad. */
export function drawBrackets(r: Raster, cx: number, cy: number, rad: number, c: string, keel: string) {
  const L = 3;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const ox = cx + sx * rad, oy = cy + sy * rad;
    for (let i = 0; i < L; i++) {
      r.set(ox - sx * i + 1, oy + 1, keel); r.set(ox + 1, oy - sy * i + 1, keel);
    }
    for (let i = 0; i < L; i++) { r.set(ox - sx * i, oy, c); r.set(ox, oy - sy * i, c); }
  }
}

/** The perceptron critter as a 12×14 art-px sprite, rasterised from the
 * shared CRITTER geometry (so it keeps the cast's one-eyed silhouette). */
export interface Sprite { w: number; h: number; px: (string | null)[] }
export function critterSprite(ctx: CanvasRenderingContext2D, frame: 0 | 1): Sprite {
  const SCALE = 10, W = 12, H = 14;
  const body = new Path2D(CRITTER.body), antenna = new Path2D(CRITTER.antenna);
  const inC = (x: number, y: number, c: { cx: number; cy: number; r: number }) => (x - c.cx) ** 2 + (y - c.cy) ** 2 <= c.r * c.r;
  const px: (string | null)[] = new Array(W * H).fill(null);
  const bob = frame ? -SCALE * 0.6 : 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const vx = (x + 0.5) * SCALE, vy = (y + 0.5) * SCALE - bob;
    let c: string | null = null;
    if (ctx.isPointInPath(body, vx, vy)) {
      c = x + y < 9 ? "#6be0e0" : x - y > 2 || x + y > 17 ? "#0780af" : "#24b9d4"; // 77 · 14 · 5
      if (inC(vx, vy, CRITTER.eye)) c = "#ffffff";
      if (inC(vx, vy, CRITTER.pupil)) c = "#041731";
    } else if (ctx.isPointInStroke(antenna, vx, vy) || inC(vx, vy, { ...CRITTER.antennaTip, r: CRITTER.antennaTip.r + 3 })) {
      c = inC(vx, vy, { ...CRITTER.antennaTip, r: CRITTER.antennaTip.r + 3 }) ? "#fdc771" : "#041731";
    } else if (CRITTER.feet.some((f) => inC(vx, (y + 0.5) * SCALE, { cx: f.cx + (frame ? (f.cx < 60 ? -4 : 4) : 0), cy: f.cy, r: 9 }))) {
      c = "#3a1d2a";
    }
    px[y * W + x] = c;
  }
  // 1-px dark outline around the silhouette
  const out = [...px];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (px[y * W + x]) continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const X = x + dx, Y = y + dy;
      return X >= 0 && Y >= 0 && X < W && Y < H && px[Y * W + X] && px[Y * W + X] !== "#3a1d2a";
    });
    if (n) out[y * W + x] = "#041731";
  }
  return { w: W, h: H, px: out };
}

export function drawSprite(r: Raster, s: Sprite, x: number, y: number, flip: boolean) {
  for (let yy = 0; yy < s.h; yy++) for (let xx = 0; xx < s.w; xx++) {
    const c = s.px[yy * s.w + (flip ? s.w - 1 - xx : xx)];
    if (c) r.set(x + xx, y + yy, c);
  }
  // ground shadow
  for (let xx = 2; xx < s.w - 2; xx++) r.set(x + xx, y + s.h, INK.shadow, 120);
}
