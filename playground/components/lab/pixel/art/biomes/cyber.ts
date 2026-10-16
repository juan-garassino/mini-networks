// NEON CITY — Sequence as a cyberpunk night pocket (round 4). The LLM frontier
// is a megacity after dark inside the day map: blackened-indigo asphalt, a
// street grid with magenta/cyan neon arterials, towers of lit windows (gold +
// cyan), rooftop antennas, holo billboards with ORIGINAL glyph marks (bars,
// brackets, chevrons — no real script), rain, a neon canal lip, and a lit
// city wall where the night meets the day. Still lit from the top-left (the
// lit face is the moon/sky side), same ink ring, same fixed grid.
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { hash2 } from "../noise";
import type { ArtImage } from "../raster";
import { stampInto, type EmblemMaskLike } from "../sprites/markers";
import type { Sprite } from "../sprites/paint";
import { BR, C } from "./palette";
import { Pen, stampOf, type BiomeStamp } from "./kit";
import { neonGrid } from "./ground";

const N = BR.night, M = BR.neonM, Y = BR.neonC;
const S2 = C("stone", 2), S3 = C("stone", 3), S4 = C("stone", 4);
const GOLD = C("gold", 3), GOLDL = C("gold", 4);
/** colours that must never be dulled by rim/outline passes (they are light sources) */
export const NEON_KEEP = new Set([...M, ...Y, GOLD, GOLDL, C("foam", 1)]);

// ——————————————————————————— towers ———————————————————————————

/** Window grid on a face: 1-px windows every 2 columns / 2 rows; hash decides lit gold / cyan / dark. */
function windows(p: Pen, x0: number, y0: number, w: number, h: number, seed: number, lit = 0.42) {
  for (let y = y0; y < y0 + h; y += 2) for (let x = x0; x < x0 + w; x += 2) {
    const r = hash2(x, y, seed);
    p.set(x, y, r < lit * 0.72 ? GOLD : r < lit ? Y[2] : N[1]);
  }
}

/** Original holo glyph marks (bars/brackets/chevrons), `k` picks a pattern. */
const GLYPHS = [
  ["#.#.##", "#.#..#", "###.##"],
  ["##..#.", "#.#.##", "##..#."],
  [".#.###", "##..#.", ".#..#."],
  ["###.#.", "..#.##", "###.#."],
];
function holo(p: Pen, x: number, y: number, w: number, h: number, hue: "m" | "c", k: number) {
  const R = hue === "m" ? M : Y;
  p.f(x, y, w, h, R[0]); p.hl(x, x + w - 1, y, R[1]); p.vl(x, y, y + h - 1, R[1]);
  const g = GLYPHS[k % GLYPHS.length];
  const gx = x + Math.max(1, (w - g[0].length) >> 1), gy = y + Math.max(1, (h - g.length) >> 1);
  g.forEach((row, r) => { for (let c = 0; c < row.length && gx + c < x + w - 1; c++) if (row[c] === "#" && gy + r < y + h - 1) p.set(gx + c, gy + r, R[3]); });
}

interface TowerOpt { antenna?: boolean; trim?: "m" | "c"; sign?: "m" | "c"; setback?: boolean; seed?: number; roofSign?: boolean }

/**
 * A tower: roof slab (top surface catching the sky), front face with a lit
 * left column and a shaded right band, window grid, neon trim at the crown,
 * street-level shop glow, optional setback crown, antenna, side holo sign.
 */
function tower(w: number, h: number, o: TowerOpt = {}): Sprite {
  const ex = o.sign ? 4 : 0, top = o.antenna ? 6 : o.roofSign ? 5 : 1;
  const p = new Pen(w + ex + 1, h + top + 1);
  const x0 = 0, y0 = top, seed = o.seed ?? w * 31 + h;
  const face = (x: number, y: number, ww: number, hh: number) => {
    for (let r = 0; r < hh; r++) for (let c = 0; c < ww; c++) p.set(x + c, y + r, c === 0 ? N[4] : c >= ww - 2 ? N[2] : N[3]);
    p.hl(x, x + ww - 1, y, S3); p.hl(x + 1, x + ww - 2, y + 1, S2);      // roof slab (lit top edge)
    windows(p, x + 1 + ((x + 1) & 1 ? 1 : 0), y + 3, ww - 2, hh - 5, seed + x);
  };
  if (o.setback && w >= 7 && h >= 14) {
    const cw = w - 4, ch = Math.round(h * 0.3);
    face(x0 + 2, y0, cw, ch + 1);
    face(x0, y0 + ch, w, h - ch);
  } else face(x0, y0, w, h);
  const trim = o.trim === "c" ? Y : M;
  p.hl(x0 + (o.setback ? 2 : 0), x0 + w - 1 - (o.setback ? 2 : 0), y0 + 2, trim[2]);      // neon crown line
  p.hl(x0, x0 + w - 1, y0 + h - 1, trim[1]);                                               // shop glow at street level
  for (let x = x0 + 1; x < x0 + w - 1; x += 3) p.set(x, y0 + h - 2, trim[3]);
  if (o.antenna) {
    const ax = x0 + (o.setback ? 2 + ((w - 4) >> 1) : w >> 1);
    p.vl(ax, 1, y0, S3); p.set(ax, 0, M[2]); p.set(ax + 1, 3, S2); p.set(ax - 1, 3, S2);
  }
  if (o.roofSign) holo(p, x0 + 1, 0, Math.min(w - 2, 7), 4, o.trim === "c" ? "m" : "c", seed);
  if (o.sign) {
    const sy = y0 + 4 + (seed % 5);
    p.hl(x0 + w, x0 + w, sy + 1, S2);
    holo(p, x0 + w, sy, 4, Math.min(9, h - 6), o.sign, seed + 1);
  }
  return p.done2({ x: w >> 1, y: y0 + h - 1 }, { keep: NEON_KEEP, shadow: [w >> 1, y0 + h - 1, w / 2 + 1, 1] });
}

/** Twin towers linked by a lit skybridge. */
function twin(): Sprite {
  const p = new Pen(16, 27);
  const a = tower(6, 22, { trim: "c", seed: 7 }), b = tower(6, 17, { trim: "m", seed: 9 });
  blit(p, a.img, 0, 4); blit(p, b.img, 9, 9);
  p.hl(6, 9, 13, S3); p.hl(6, 9, 14, Y[1]); p.hl(6, 9, 15, N[2]);
  return { img: p.img, anchor: { x: 7, y: 25 }, shadow: p.groundShadow(7, 25, 8, 1) };
}

function blit(p: Pen, img: ArtImage, x: number, y: number) {
  for (let yy = 0; yy < img.h; yy++) for (let xx = 0; xx < img.w; xx++) { const v = img.data[yy * img.w + xx]; if (v !== 255) p.set(x + xx, y + yy, v); }
}

/** Free-standing holo billboard on a mast. */
function billboard(hue: "m" | "c"): Sprite {
  const p = new Pen(12, 12);
  p.vl(5, 7, 11, S2); p.vl(6, 7, 11, N[2]);
  holo(p, 0, 0, 12, 7, hue, hue === "m" ? 0 : 2);
  return p.done2({ x: 5, y: 11 }, { keep: NEON_KEEP, outline: false });
}

/** Street kiosk: a tiny noodle-bar box with a glowing awning. */
function kiosk(): Sprite {
  const p = new Pen(8, 7);
  p.hl(0, 7, 0, M[2]); p.hl(0, 7, 1, M[1]);
  p.f(1, 2, 6, 4, N[3]); p.vl(1, 2, 5, N[4]); p.f(2, 3, 4, 2, GOLD); p.set(2, 3, GOLDL);
  p.hl(0, 7, 6, N[1]);
  return p.done2({ x: 4, y: 6 }, { keep: NEON_KEEP });
}

/** Hover car with a light trail (fauna — scatter over streets). */
function hovercar(): Sprite {
  const p = new Pen(10, 3);
  p.hl(0, 3, 1, M[0]); p.hl(2, 4, 1, M[1]);
  p.f(5, 0, 4, 2, S3); p.set(5, 0, S4); p.set(9, 1, GOLDL); p.hl(5, 8, 2, N[1]);
  return p.done2({ x: 6, y: 2 }, { rim: false, outline: false, keep: NEON_KEEP });
}

/** Rooftop antenna cluster / comms dish (small decor on plazas). */
function dish(): Sprite {
  const p = new Pen(7, 8);
  p.art(0, 0, ["..sss..", ".s...s.", "s..m..s", ".sssss.", "...t...", "...t...", "..ttt..", ".ttttt."], { s: S3, m: M[2], t: N[4] });
  return p.done2({ x: 3, y: 7 }, { keep: NEON_KEEP });
}

// ——————————————————————————— landmarks (36×46, emblem slot 9×9 on a holo panel) ———————————————————————————
const LW = 36, LH = 46, GY = 43, CX = 18;

/** Holo panel (11×11) with a dark 9×9 screen — the emblem slot. */
function panel(p: Pen, x: number, y: number, hue: "m" | "c" = "c") {
  const R = hue === "m" ? M : Y;
  p.f(x, y, 11, 11, R[1]); p.hl(x, x + 10, y, R[2]); p.vl(x, y, y + 10, R[2]);
  p.f(x + 1, y + 1, 9, 9, N[0]);
  return { x: x + 1, y: y + 1, w: 9, h: 9 };
}

function plaza(p: Pen, x0: number, x1: number) {
  p.hl(x0, x1, GY - 2, S2); p.hl(x0, x1, GY - 1, N[3]); p.hl(x0, x1, GY, N[1]);
  for (let x = x0 + 1; x < x1; x += 4) p.set(x, GY - 1, M[2]);
}

/** gnn · message passing — the NEXUS SPIRE: the tallest tower; neon threads pass messages from its needle to every neighbour. */
function capitalTower(): Sprite {
  const p = new Pen(LW, LH);
  // shoulder towers (the heads the threads reach)
  const l = tower(7, 20, { trim: "m", seed: 3 }), r = tower(8, 16, { trim: "c", seed: 5 });
  blit(p, l.img, 0, GY - 2 - 20 - 1 + 1); blit(p, r.img, 27, GY - 2 - 16);
  // the spire: tapering stepped body
  const steps = [[11, 14, 22], [13, 10, 12], [15, 6, 7]] as const;     // [x, w, y-top] tiers
  const base = GY - 2;
  steps.forEach(([x, w, yt], k) => {
    const yb = k === 0 ? base : steps[k - 1][2] + 1;
    for (let y = yt; y <= yb; y++) for (let c = 0; c < w; c++) p.set(x + c, y, c === 0 ? N[4] : c >= w - 2 ? N[2] : N[3]);
    p.hl(x, x + w - 1, yt, S3);
    windows(p, x + 1 + ((x + 1) & 1), yt + 2, w - 2, yb - yt - 2, 40 + k, 0.5);
    p.hl(x, x + w - 1, yt + 1, k % 2 ? Y[2] : M[2]);                     // neon ring per setback
  });
  // needle + beacon
  p.vl(18, 1, 6, S4); p.vl(19, 2, 6, S2); p.set(18, 0, Y[3]); p.set(17, 1, Y[2]); p.set(19, 1, Y[2]);
  // attention threads: needle → the heads (alternating magenta / cyan)
  const heads: [number, number, number][] = [[3, 22, M[2]], [1, 30, Y[2]], [31, 27, Y[2]], [34, 33, M[2]], [9, 16, Y[2]]];
  for (const [hx, hy, col] of heads) { p.ln(18, 1, hx, hy, col); p.set(hx, hy, C("foam", 1)); }
  const slot = panel(p, 13, 26, "c");
  plaza(p, 0, 35);
  return p.done2({ x: CX, y: GY }, { slot, keep: NEON_KEEP, shadow: [CX, GY - 1, 18, 3] });
}

/** nerf · radiance field — the ORBIT LINE: a monorail orbit circling a tower like cameras round a scene. */
function loopTower(): Sprite {
  const p = new Pen(LW, LH);
  const cx = 18, cy = 22, rx = 16, ry = 5;
  const ring = (front: boolean) => {
    for (let a = 0; a < 360; a += 1) {
      const t = (a * Math.PI) / 180;
      const x = Math.round(cx + Math.cos(t) * rx), y = Math.round(cy + Math.sin(t) * ry);
      if ((Math.sin(t) > 0) !== front) continue;
      p.set(x, y, front ? S4 : S2); p.set(x, y + 1, front ? M[2] : M[0]);
    }
  };
  ring(false);
  // the tower
  for (let y = 4; y <= GY - 2; y++) for (let c = 0; c < 12; c++) p.set(12 + c, y, c === 0 ? N[4] : c >= 10 ? N[2] : N[3]);
  p.hl(12, 23, 4, S3); p.hl(12, 23, 5, Y[2]);
  windows(p, 13, 8, 10, 30, 71, 0.5);
  p.vl(17, 0, 3, S3); p.set(17, 0, M[2]);
  ring(true);
  // loop support pylons + the monorail car at the front of the loop
  for (const x of [6, 30]) { p.vl(x, cy + 3, GY - 2, S2); p.vl(x + 1, cy + 3, GY - 2, N[2]); }
  p.f(20, cy + ry - 3, 8, 3, S4); p.hl(20, 27, cy + ry - 3, C("foam", 1)); p.hl(21, 26, cy + ry - 2, GOLD); p.set(27, cy + ry - 2, Y[3]);
  // a second, lower loop arrow (the recurrence) painted on the plaza
  const slot = panel(p, 13, 29, "m");
  plaza(p, 0, 35);
  return p.done2({ x: CX, y: GY }, { slot, keep: NEON_KEEP, shadow: [CX, GY - 1, 18, 3] });
}

/** Hanging cable run with node lamps (drape between two towers / off the island edge). 24×10. */
function cables(): Sprite {
  const p = new Pen(24, 10);
  for (let x = 0; x < 24; x++) { const y = Math.round(1 + Math.sin((x / 23) * Math.PI) * 6); p.set(x, y, N[0]); if (x % 2) p.set(x, y + 1, N[1]); }
  for (let x = 0; x < 24; x++) { const y = Math.round(2 + Math.sin((x / 23) * Math.PI) * 4); if (x % 3 === 0) p.set(x, y, N[1]); }
  for (const x of [6, 12, 18]) { const y = Math.round(1 + Math.sin((x / 23) * Math.PI) * 6); p.set(x, y + 1, Y[2]); p.set(x, y + 2, Y[3]); }
  return { img: p.img, anchor: { x: 12, y: 9 } };
}

/** Floating rock chunk with a lamp post (drifts off the cyber island). 12×16. */
function floatChunk(): Sprite {
  const p = new Pen(13, 17);
  p.f(1, 5, 11, 3, N[3]); p.hl(1, 11, 5, N[4]); p.hl(2, 10, 4, S3);
  for (let y = 8; y < 16; y++) { const hw = Math.round(5 * (1 - (y - 8) / 8)); for (let dx = -hw; dx <= hw; dx++) p.set(6 + dx, y, dx < 0 ? N[2] : N[1]); }
  p.vl(4, 0, 4, S2); p.set(4, 0, Y[3]); p.set(3, 0, Y[2]); p.set(5, 0, Y[2]);
  p.vl(8, 14, 16, M[1]);
  return p.done2({ x: 6, y: 7 }, { keep: NEON_KEEP });
}

// ——————————————————————————— derived markers (20×28, 7×7) ———————————————————————————

/** Arcology pod on a stem with a holo screen carrying the emblem, dressed by evidence state. */
export function neonMarker(state: EvidenceState, emblem?: EmblemMaskLike): Sprite {
  const p = new Pen(20, 28);
  const dim = state === "untrained";
  const hue = state === "champion" ? [C("gold", 1), C("gold", 2), GOLD, GOLDL] : dim ? [N[1], N[2], N[3], N[4]] : Y;
  // stem + base
  p.f(8, 18, 4, 7, N[3]); p.vl(8, 18, 24, N[4]); p.vl(11, 18, 24, N[2]);
  p.hl(4, 15, 25, N[4]); p.hl(4, 15, 26, N[1]); p.hl(5, 14, 24, dim ? N[2] : M[1]);
  // pod shell
  p.blob(10, 11, 8, 8, N[4], N[3], N[2]);
  p.hl(4, 16, 18, dim ? N[1] : M[2]);                                   // pod waist neon
  // screen
  p.f(5, 5, 11, 11, hue[1]); p.hl(5, 15, 5, hue[2]); p.vl(5, 5, 15, hue[2]);
  p.f(6, 6, 9, 9, N[0]);
  const slot = { x: 7, y: 7, w: 7, h: 7 };
  if (emblem && state !== "provisional") stampInto(p, slot, emblem, dim ? N[3] : hue[2], undefined);
  if (state === "provisional") {
    p.art(8, 7, [".###.", "....#", "..##.", ".....", "..#.."], { "#": Y[2] });
    p.vl(1, 4, 25, C("stone", 2)); p.vl(18, 4, 25, C("stone", 2)); p.hl(1, 18, 4, C("stone", 3)); p.ln(1, 25, 18, 6, C("stone", 1));
  }
  if (state === "champion") p.art(7, 0, ["...y...", "..yyy..", "yyyyyyy", ".yy.yy."], { y: GOLDL });
  if (state === "trained") { p.vl(17, 1, 6, C("stone", 3)); p.set(17, 0, M[2]); p.set(16, 1, M[1]); p.set(18, 1, M[1]); }
  return p.done2({ x: 10, y: 26 }, { slot, keep: NEON_KEEP, shadow: [10, 26, 7, 2] });
}

// ——————————————————————————— catalogue ———————————————————————————
const memo = new Map<string, Sprite>();
const once = (k: string, f: () => Sprite) => { let s = memo.get(k); if (!s) { s = f(); memo.set(k, s); } return s; };

export const NEON_LANDMARKS: Record<string, { make: () => Sprite; note: string }> = {
  gnn: { make: capitalTower, note: "Nexus Spire — the tallest tower; neon threads pass messages from its needle to every neighbour" },
  nerf: { make: loopTower, note: "Orbit Line — a monorail orbit circling the tower, like cameras round a scene" },
};

export function neonSprites() {
  return {
    t1: once("n:t1", () => tower(7, 24, { antenna: true, trim: "c", seed: 11 })),
    t2: once("n:t2", () => tower(9, 15, { sign: "m", seed: 12 })),
    t3: once("n:t3", () => tower(9, 28, { setback: true, antenna: true, trim: "m", seed: 13 })),
    t4: once("n:t4", () => tower(8, 9, { roofSign: true, trim: "c", seed: 14 })),
    t5: once("n:t5", () => tower(6, 18, { trim: "m", sign: "c", seed: 15 })),
    t6: once("n:t6", () => tower(8, 12, { trim: "c", seed: 16 })),
    twin: once("n:twin", twin),
    boardM: once("n:bm", () => billboard("m")), boardC: once("n:bc", () => billboard("c")),
    kiosk: once("n:kiosk", kiosk), car: once("n:car", hovercar), dish: once("n:dish", dish),
    cables: once("n:cables", cables), chunk: once("n:chunk", floatChunk),
  };
}

export function neonStamps(): BiomeStamp[] {
  const s = neonSprites();
  return [
    stampOf("tower · needle", "city", s.t1, "slim, antenna beacon, cyan crown"),
    stampOf("tower · billboard", "city", s.t2, "mid-rise with a magenta side holo"),
    stampOf("tower · setback", "city", s.t3, "stepped crown + antenna, the skyline's tall note"),
    stampOf("block · roof sign", "city", s.t4, "low block with a rooftop holo"),
    stampOf("tower · slab", "city", s.t5, "narrow slab, cyan side sign"),
    stampOf("block", "city", s.t6, "mid block, gold + cyan windows"),
    stampOf("twin towers", "city", s.twin, "linked by a lit skybridge"),
    stampOf("holo board · magenta", "city", s.boardM, "original glyph marks, no real script"),
    stampOf("holo board · cyan", "city", s.boardC, "billboard on a mast"),
    stampOf("kiosk", "decor", s.kiosk, "noodle bar, glowing awning"),
    stampOf("comms dish", "decor", s.dish, "plaza / rooftop dressing"),
    stampOf("hover car", "fauna", s.car, "magenta light trail — over streets"),
    stampOf("hanging cables", "city", s.cables, "drape between towers / off the island edge, node lamps"),
    stampOf("floating chunk", "city", s.chunk, "a lamp-post rock drifting off the island"),
  ];
}

export const neonLandmark = (atom: string): Sprite | undefined => {
  const e = NEON_LANDMARKS[atom];
  return e ? once(`n:lm:${atom}`, e.make) : undefined;
};

/**
 * Fill a region's lots with towers (reference placement for the builder): one
 * building per lot foot (street row below the lot), skyline rising toward `peak`,
 * ~1 lot in 4 left as a plaza (kiosk / dish / billboard). `free(x, y)` vetoes pixels.
 */
export function cityBlocks(put: (s: Sprite, x: number, y: number) => boolean, w: number, h: number, peak: { x: number; y: number }, free: (x: number, y: number) => boolean, apt = 3, ox = 0, oy = 0, avoid: { x0: number; y0: number; x1: number; y1: number }[] = []) {
  const s = neonSprites();
  const g = neonGrid(apt), P = g.pitch;
  const tall = [s.t3, s.t1, s.twin], mid = [s.t2, s.t5, s.t6], low = [s.t4, s.t6, s.t2];
  const lots: { x: number; y: number }[] = [];
  for (let gy = Math.ceil(oy / P) * P; gy < oy + h; gy += P) for (let gx = Math.ceil(ox / P) * P; gx < ox + w; gx += P) {
    const fx = gx - ox + (P >> 1), fy = gy - oy + P - 1;               // lot foot: bottom-centre of the lot
    if (fy >= h || !free(fx, fy) || !free(fx - 3, fy - 3) || !free(fx + 3, fy - 3)) continue;
    if (avoid.some((b) => fx > b.x0 - 6 && fx < b.x1 + 6 && fy > b.y0 && fy < b.y1 + 10)) continue;   // never in front of a landmark
    lots.push({ x: fx, y: fy });
  }
  lots.sort((a, b) => a.y - b.y);
  for (const l of lots) {
    const r = hash2(l.x, l.y, 0xc17);
    const d = Math.hypot(l.x - peak.x, (l.y - peak.y) * 1.3) / Math.max(w, h);
    if (r > 1 - 0.3 * Math.min(1, d * 2.2)) continue;                     // open lots thin out toward the wall: the grid shows
    if (r < 0.2) { put([s.kiosk, s.dish, s.boardM, s.boardC][Math.floor(r * 18) % 4], l.x, l.y); continue; }
    const set = d < 0.22 ? tall : d < 0.42 ? mid : low;
    put(set[Math.floor(r * 97) % set.length], l.x, l.y);
  }
}
