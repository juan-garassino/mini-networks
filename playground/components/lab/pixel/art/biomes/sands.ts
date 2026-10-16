// SEQUENCE sands (round 4, reference look): the transformer's blue-domed
// cathedral on the green rise, ancient marble ruins with columns, pools and
// palms at the sequence centre (rnn), and a wooden stilt town in the desert
// east (mamba); desert hoodoos, palms, broken columns.
import { BR } from "./palette";
import { Pen, cone3q, roof3q, wall3q, win3q } from "./kit";
import { banner9 } from "./town";
import type { Sprite } from "../sprites/paint";

const S = BR.stoneR, SL = BR.slate, G = BR.goldR, W = BR.woodR, D = BR.desert, F = BR.forestR, WA = BR.water, R = BR.roofR;
const LIT = G[3], LIT2 = G[4];
const LW = 36, LH = 46, GY = 43, CX = 18;
const fin = (p: Pen, ax: number, ay: number, rx: number, slot?: Sprite["slot"]) => p.done2({ x: ax, y: ay }, { slot, shadow: [ax, ay, rx, 1.6], keep: new Set([LIT, LIT2]) });

export function palm(h = 12, flip = false): Sprite {
  const p = new Pen(15, h + 3);
  const lean = flip ? -1 : 1;
  for (let y = 4; y <= h + 1; y++) { const x = 7 + Math.round(((h + 1 - y) / h) * 2 * lean); p.set(x, y, y % 2 ? W[3] : W[2]); p.set(x + 1, y, W[1]); }
  const top = { x: 7 + 2 * lean, y: 4 };
  const fronds: [number, number][] = [[-6, 2], [-4, -2], [0, -3], [4, -2], [6, 2], [-3, 3], [3, 3]];
  for (const [dx, dy] of fronds) {
    const n = Math.max(Math.abs(dx), Math.abs(dy));
    for (let k = 1; k <= n; k++) {
      const x = top.x + Math.round((dx * k) / n), y = top.y + Math.round((dy * k) / n) + (k > n / 2 && Math.abs(dx) > 3 ? 1 : 0);
      p.set(x, y, dy < 0 ? F[5] : F[4]); p.set(x, y + 1, F[2]);
    }
  }
  p.set(top.x, top.y, F[6]); p.set(top.x, top.y + 1, W[2]); p.set(top.x + 1, top.y + 1, W[1]);
  return p.done2({ x: 8, y: h + 1 }, { shadow: [8, h + 1, 4, 1] });
}

/** Marble column: fluted shaft, capital + base; `broken` snaps it off at a jagged height. */
export function column(h = 14, broken = false): Sprite {
  const p = new Pen(7, h + 2);
  const top = broken ? Math.round(h * 0.45) : 0;
  if (!broken) { p.hl(0, 5, 0, S[5]); p.hl(0, 5, 1, S[3]); }
  for (let y = broken ? top : 2; y < h - 1; y++) { p.set(1, y, S[5]); p.set(2, y, S[4]); p.set(3, y, S[4]); p.set(4, y, S[3]); if (y % 3 === 0) p.set(3, y, S[3]); }
  if (broken) { p.set(1, top - 1, S[5]); p.set(3, top - 1, S[4]); p.set(2, top - 2, S[5]); }
  p.hl(0, 5, h - 1, S[3]); p.hl(0, 5, h, S[2]);
  return p.done2({ x: 3, y: h }, { shadow: [3, h, 3, 1] });
}

/** Desert hoodoo / rock spire with strata. */
export function hoodoo(h = 14): Sprite {
  const p = new Pen(9, h + 2);
  for (let y = 0; y <= h; y++) {
    const hw = y < 3 ? 2 : Math.round(1.5 + (y / h) * 2.5 + Math.sin(y * 0.9) * 0.6);
    for (let dx = -hw; dx <= hw; dx++) {
      const band = Math.floor(y / 3) % 2;
      p.set(4 + dx, y, dx < 0 ? (band ? D[4] : D[5]) : dx === 0 ? (band ? D[3] : D[4]) : band ? D[1] : D[2]);
    }
  }
  p.hl(2, 6, 0, D[6]);
  return p.done2({ x: 4, y: h }, { shadow: [4, h, 4, 1] });
}

/** Small tiled pool (3/4): stone rim, water with a lit glint row. */
export function pool(w = 14, h = 7): Sprite {
  const p = new Pen(w, h);
  p.f(0, 0, w, h, S[4]); p.hl(0, w - 1, 0, S[5]); p.hl(0, w - 1, h - 1, S[2]);
  p.f(1, 1, w - 2, h - 2, WA[3]); p.hl(1, w - 2, 1, WA[1]); for (let x = 3; x < w - 3; x += 3) p.set(x, h - 3, WA[5]);
  return p.done2({ x: w >> 1, y: h - 1 }, { rim: false });
}

// ——————————————————————————— landmarks ———————————————————————————

/** transformer · attention — the BLUE-SPIRED CATHEDRAL: a great central spire, gold threads from its needle to every pinnacle. */
function cathedral(): Sprite {
  const p = new Pen(LW, LH);
  const spire = (cx: number, top: number, hw: number, base: number) => {
    cone3q(p, cx, top, hw, base - top, SL);
    for (let y = top + 3; y < base; y += 3) p.set(cx - Math.round(((y - top) / (base - top)) * hw) + 1, y, SL[4]);   // lit crockets
    p.vl(cx, top - 2, top - 1, G[3]);
  };
  // side towers (pinnacled)
  for (const x of [2, 26]) { wall3q(p, x, 18, 8, 21, S); spire(x + 4, 7, 4, 18); win3q(p, x + 3, 22, 2, 4, SL[1]); win3q(p, x + 3, 29, 2, 3, SL[1]); }
  // nave + central tower + great spire
  roof3q(p, 9, 20, 18, 5, SL);
  wall3q(p, 9, 25, 18, 14, S);
  wall3q(p, 13, 12, 10, 13, S);
  spire(18, 1, 6, 12);
  p.blob(18, 17, 2, 2, SL[4], SL[3], SL[1]); p.set(18, 17, LIT);            // clock / rose
  p.blob(18, 28, 3, 3, SL[4], SL[3], SL[1]); p.set(18, 28, LIT);            // rose window
  p.f(15, 33, 7, 6, SL[0]); p.hl(16, 20, 32, S[5]); p.f(16, 34, 5, 5, W[1]); p.vl(18, 34, 38, W[0]);
  // attention threads: needle → every pinnacle and the facade heads
  for (const [x, y] of [[6, 5], [30, 5]] as const) {
    const n = Math.max(Math.abs(x - 18), Math.abs(y + 1));
    for (let k = 3; k < n; k += 3) p.set(Math.round(18 + ((x - 18) * k) / n), Math.round(-1 + ((y + 1) * k) / n), LIT2);
  }
  const slot = banner9(p, 24, 26, SL);
  p.hl(0, 35, GY - 2, S[4]); p.hl(0, 35, GY - 1, S[3]); p.hl(0, 35, GY, S[1]);
  return fin(p, CX, GY, 18, slot);
}

/** rnn · recurrence — the MARBLE LOOP: a horseshoe colonnade round a pool, the loop open at the front; palms. */
function marbleLoop(): Sprite {
  const p = new Pen(LW, LH);
  // sand plaza
  for (let y = 22; y < GY; y++) for (let x = 1; x < 35; x++) p.set(x, y, (x * 3 + y) % 11 === 0 ? D[4] : D[5]);
  // the pool in the middle
  p.f(10, 27, 16, 9, S[4]); p.hl(10, 25, 27, S[5]); p.f(11, 28, 14, 7, WA[3]); p.hl(11, 24, 28, WA[1]); p.set(15, 32, WA[5]); p.set(21, 31, WA[5]);
  // horseshoe of columns: back row (tall), side rows (stepping forward)
  const col = (x: number, base: number, h: number, broken = false) => {
    const top = base - h;
    for (let y = top + 2; y < base; y++) { p.set(x, y, S[5]); p.set(x + 1, y, S[4]); p.set(x + 2, y, S[3]); }
    if (!broken) { p.hl(x - 1, x + 3, top, S[5]); p.hl(x - 1, x + 3, top + 1, S[3]); }
    p.hl(x - 1, x + 3, base, S[2]);
  };
  // back entablature (architrave on the back row)
  p.hl(4, 31, 9, S[5]); p.hl(4, 31, 10, S[4]); p.hl(4, 31, 11, S[2]);
  p.art(10, 5, ["......ssss......", "...ssssSSSSss...", "sssSSSSSSSSSSSss"], { s: S[5], S: S[4] });
  for (const x of [5, 11, 17, 23, 29]) col(x, 25, 13);
  for (const [x, b] of [[2, 31], [2, 38], [31, 31]] as const) col(x, b, 14);
  col(31, 38, 8, true);                                                        // the broken one: where the loop lets go
  // palms at the sides
  const palmAt = (x: number, base: number, flip = false) => {
    const lean = flip ? -1 : 1;
    for (let y = base - 12; y <= base; y++) { const xx = x + Math.round(((base - y) / 12) * 2 * lean); p.set(xx, y, W[3]); p.set(xx + 1, y, W[1]); }
    const tx = x + 2 * lean, ty = base - 12;
    for (const [dx, dy] of [[-5, 2], [-3, -2], [0, -3], [3, -2], [5, 2]] as const) {
      const n = Math.max(Math.abs(dx), Math.abs(dy));
      for (let k = 1; k <= n; k++) { p.set(tx + Math.round((dx * k) / n), ty + Math.round((dy * k) / n), F[5]); p.set(tx + Math.round((dx * k) / n), ty + Math.round((dy * k) / n) + 1, F[2]); }
    }
  };
  palmAt(0, 42); palmAt(33, 42, true);
  const slot = banner9(p, 12, 12, BR.roofR);
  return fin(p, CX, GY, 18, slot);
}

/** mamba · selective state space — the STILT TOWN: huts on tall stilts, a walkway weaving between them, a serpent vane. */
function stiltTown(): Sprite {
  const p = new Pen(LW, LH);
  const hut = (x: number, y: number, w: number, legs: number, roof = W) => {
    for (const lx of [x + 1, x + w - 2]) { p.vl(lx, y + 8, y + 8 + legs, W[1]); }
    p.ln(x + 1, y + 10, x + w - 2, y + 8 + legs - 1, W[1]);
    roof3q(p, x - 1, y, w + 2, 4, roof === W ? BR.desert : roof);
    wall3q(p, x, y + 4, w, 5, W, false);
    for (let yy = y + 5; yy < y + 9; yy += 2) p.hl(x + 1, x + w - 2, yy, W[2]);
    win3q(p, x + 2, y + 5, 2, 2, LIT);
    p.hl(x - 1, x + w, y + 9, W[4]);
  };
  hut(3, 6, 11, 18); hut(21, 3, 12, 22); hut(12, 18, 10, 13, R);
  // weaving walkway (the selective scan path) between the decks
  p.ln(14, 15, 21, 12, W[4]); p.ln(14, 16, 21, 13, W[1]);
  p.ln(22, 26, 30, 25, W[4]); p.ln(22, 27, 30, 26, W[1]);
  // ladder
  for (let y = 28; y <= 42; y++) { p.set(16, y, W[3]); p.set(19, y, W[2]); if (y % 3 === 0) p.hl(16, 19, y, W[4]); }
  // serpent weather vane on the tall hut
  p.vl(27, 0, 3, W[1]); p.art(24, 0, [".sss..", "s...s.", "..ss.s"], { s: G[3] });
  const slot = banner9(p, 1, 28, BR.desert);
  for (let x = 0; x < 36; x++) { p.set(x, GY - 1, D[4]); p.set(x, GY, D[2]); }
  return fin(p, CX, GY, 18, slot);
}

// ——————————————————————————— catalogue ———————————————————————————
const memo = new Map<string, Sprite>();
const once = (k: string, f: () => Sprite) => { let s = memo.get(k); if (!s) { s = f(); memo.set(k, s); } return s; };

export const SANDS_LANDMARKS: Record<string, { make: () => Sprite; note: string }> = {
  transformer: { make: cathedral, note: "Blue-Spired Cathedral — one great spire; gold threads from its needle to every pinnacle" },
  rnn: { make: marbleLoop, note: "Marble Loop — a horseshoe colonnade round a pool; the broken column is where the loop lets go" },
  mamba: { make: stiltTown, note: "Stilt Town — huts on stilts, a walkway weaving between them, a serpent vane" },
};

export function sandsSprites() {
  return {
    palm: once("s:palm", () => palm(12)), palmL: once("s:palmL", () => palm(10, true)),
    column: once("s:col", () => column(14)), columnB: once("s:colB", () => column(14, true)),
    hoodoo: once("s:hoo", () => hoodoo(14)), hoodooS: once("s:hooS", () => hoodoo(9)), pool: once("s:pool", () => pool()),
  };
}

export const sandsLandmark = (atom: string): Sprite | undefined => {
  const e = SANDS_LANDMARKS[atom];
  return e ? once(`s:lm:${atom}`, e.make) : undefined;
};
