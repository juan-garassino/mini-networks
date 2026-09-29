// PERCEPTION forest + DECISION village + REPRESENTATION snow (round 4, reference
// look): dense pine/oak forest, a giant treehouse, a windmill, half-timbered
// medieval towns (classifier: the blue-slate keep town · segmentation: the red-roof
// U-town), a green village with a red-roof church (alphazero) and a domed
// observatory, snowy peaks, snowy pines and the twin-towered snow castle (simclr).
// 3/4 diorama: roofs read from above, walls below, maroon-brown outline, ground shadow.
import { BR } from "./palette";
import { Pen, cone3q, cyl3q, dome3q, oak3q, pine3q, roof3q, timber, wall3q, win3q } from "./kit";
import type { Sprite } from "../sprites/paint";

const O = BR.olive, F = BR.forestR, W = BR.woodR, S = BR.stoneR, R = BR.roofR, SL = BR.slate, G = BR.goldR, SN = BR.snowR;
const PL = [BR.desert[4], BR.desert[5], BR.desert[6], BR.light[1]];       // plaster: warm cream
const LIT = G[3], LIT2 = G[4], DARK = S[0];
const LW = 36, LH = 46, GY = 43, CX = 18;

const fin = (p: Pen, ax: number, ay: number, rx: number, slot?: Sprite["slot"]) => p.done2({ x: ax, y: ay }, { slot, shadow: [ax, ay, rx, 1.6], keep: new Set([LIT, LIT2]) });

/** Emblem banner (11×13) hanging from a pole bracket: 9×9 cream window. */
export function banner9(p: Pen, x: number, y: number, cloth: readonly number[] = R) {
  p.hl(x - 1, x + 11, y - 1, W[1]);
  for (let r = 0; r < 12; r++) for (let c = 0; c < 11; c++) {
    if (r >= 10 && Math.abs(c - 5) < r - 9) continue;
    p.set(x + c, y + r, c === 0 ? cloth[3] : c >= 9 ? cloth[1] : cloth[2]);
  }
  p.f(x + 1, y + 1, 9, 9, BR.paperR[3]);
  return { x: x + 1, y: y + 1, w: 9, h: 9 };
}

// ——————————————————————————— forest ———————————————————————————
export function pine(h = 12, snow = false): Sprite {
  const w = Math.round(h * 0.6) | 1;
  const p = new Pen(w + 2, h + 2);
  pine3q(p, (w + 2) >> 1, h, h, F, W[1], snow ? SN[5] : undefined);
  if (snow) for (let x = 1; x < w + 1; x += 2) if (p.get(x, Math.round(h * 0.55)) !== 255) p.set(x, Math.round(h * 0.55), SN[4]);
  return p.done2({ x: (w + 2) >> 1, y: h }, { shadow: [(w + 2) >> 1, h, w / 2, 1] });
}

export function oak(r = 5): Sprite {
  const p = new Pen(r * 3 + 2, r * 3 + 3);
  oak3q(p, Math.round(r * 1.5) + 1, r * 3 + 1, r, F, W[2]);
  return p.done2({ x: Math.round(r * 1.5) + 1, y: r * 3 + 1 }, { shadow: [Math.round(r * 1.5) + 1, r * 3 + 1, r, 1.2] });
}

/** Forest clump: pines + one oak, back to front. */
export function grove(): Sprite {
  const p = new Pen(24, 20);
  pine3q(p, 5, 13, 12, F, W[1]); pine3q(p, 16, 12, 11, F, W[1]);
  oak3q(p, 11, 18, 4, F, W[2]);
  pine3q(p, 3, 19, 9, F, W[1]); pine3q(p, 20, 19, 10, F, W[1]);
  return p.done2({ x: 12, y: 19 }, { shadow: [12, 19, 11, 1.5] });
}

/** Half-timbered house: v0 red gable · v1 slate, tall · v2 wide with a dormer. */
export function house(v: 0 | 1 | 2): Sprite {
  const w = v === 2 ? 16 : 12, wallH = v === 1 ? 9 : 7, roofH = v === 1 ? 6 : 5;
  const p = new Pen(w + 2, wallH + roofH + 3);
  const roof = v === 1 ? SL : R;
  roof3q(p, 0, 1, w + 1, roofH, roof);
  timber(p, 1, roofH + 1, w - 1, wallH, PL, W);
  p.f(3, roofH + wallH - 3, 2, 3, W[1]);                                    // door
  win3q(p, 6, roofH + 3, 2, 2, LIT); if (w > 12) win3q(p, 11, roofH + 3, 2, 2, LIT); else win3q(p, 9, roofH + 3, 1, 2, W[1]);
  if (v === 2) { p.f(6, 0, 4, 3, PL[2]); p.hl(5, 10, 0, roof[3]); win3q(p, 7, 1, 2, 1, LIT); }
  p.vl(w - 2, 0, 1, S[2]); p.set(w - 2, 0, S[3]);                          // chimney
  return fin(p, (w + 2) >> 1, wallH + roofH, w / 2 + 1);
}

/** European windmill: stone tower, cone cap, four lattice sails. 20×26. */
export function windmill(): Sprite {
  const p = new Pen(21, 27);
  cyl3q(p, 6, 10, 9, 15, S);
  cone3q(p, 10, 5, 5, 5, R);
  p.f(9, 20, 3, 5, W[1]); win3q(p, 9, 13, 2, 2, LIT);
  const hub = { x: 10, y: 9 };
  for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
    for (let k = 1; k <= 9; k++) {
      const x = hub.x + dx * k, y = hub.y + dy * k;
      p.set(x, y, W[1]);
      if (k > 2) { p.set(x + dx, y, PL[3]); if (k % 2) p.set(x + dx, y - dy, PL[2]); }
    }
  }
  p.set(hub.x, hub.y, W[0]);
  return fin(p, 10, 25, 5);
}

/** Giant treehouse (hero set-piece, 46×54): a vast oak, a cabin in its fork, platform, ladder, lit windows, pennant. */
export function treehouse(): Sprite {
  const p = new Pen(46, 54);
  // trunk + roots
  for (let y = 26; y <= 52; y++) {
    const hw = 4 + (y > 46 ? (y - 46) : 0);
    for (let dx = -hw; dx <= hw; dx++) p.set(23 + dx, y, dx < -hw + 3 ? W[3] : dx > hw - 3 ? W[1] : W[2]);
  }
  for (const [x0, x1] of [[14, 19], [28, 33]] as const) p.hl(x0, x1, 52, W[1]);
  // canopy: big lobes behind the cabin
  p.blob(12, 16, 11, 9, F[5], F[4], F[2]); p.blob(34, 15, 11, 9, F[5], F[3], F[2]);
  p.blob(23, 9, 13, 9, F[6], F[4], F[3]);
  p.blob(8, 27, 7, 5, F[5], F[3], F[1]); p.blob(38, 27, 7, 5, F[4], F[3], F[1]);
  // cabin in the fork
  roof3q(p, 13, 13, 21, 6, R);
  wall3q(p, 14, 19, 19, 10, W);
  for (let y = 20; y < 29; y += 2) p.hl(15, 31, y, W[2]);                  // log courses
  win3q(p, 17, 22, 3, 3, LIT); win3q(p, 27, 22, 3, 3, LIT); p.f(22, 23, 3, 6, W[0]);
  // platform + rail + ladder
  p.hl(10, 36, 29, W[4]); p.hl(10, 36, 30, W[1]);
  for (let x = 10; x <= 36; x += 3) p.vl(x, 27, 28, W[3]);
  p.hl(10, 36, 27, W[3]);
  for (let y = 31; y <= 51; y++) { p.set(33, y, W[3]); p.set(36, y, W[2]); if (y % 3 === 0) p.hl(33, 36, y, W[4]); }
  // pennant
  p.vl(23, 1, 13, W[1]); p.art(24, 1, ["rrrr", "rrr.", "rr.."], { r: R[3] });
  return fin(p, 23, 52, 14);
}

/** Wooden pier on piles (segmentation's harbour): planks with seams, piles into the water, a bollard. 28×9. */
export function pier(): Sprite {
  const p = new Pen(29, 10);
  for (let x = 0; x < 28; x++) { p.set(x, 2, W[5]); p.set(x, 3, x % 4 === 3 ? W[2] : W[4]); p.set(x, 4, W[3]); p.set(x, 5, W[1]); }
  for (const x of [1, 8, 15, 22, 27]) { p.vl(x, 6, 8, W[1]); p.set(x, 9, BR.water[4]); }
  p.f(24, 0, 2, 2, W[1]); p.set(24, 0, W[3]);
  return p.done2({ x: 0, y: 5 }, { rim: false });
}

// ——————————————————————————— landmarks ———————————————————————————

/** classifier · convolution — the LENS KEEP town: a slate-roofed keep with a great round lens window, timbered houses at its foot. */
function lensKeep(): Sprite {
  const p = new Pen(LW, LH);
  cyl3q(p, 11, 12, 14, 26, S);
  cone3q(p, 18, 1, 8, 11, R);
  p.vl(18, 0, 1, G[3]); p.vl(18, 0, 1, W[1]); p.art(19, 0, ['rrr', 'rr.'], { r: R[3] });
  // the lens: stone ring, glassy iris, glint
  p.blob(18, 19, 4, 4, S[5], S[4], S[2]); p.blob(18, 19, 2, 2, SL[4], SL[3], SL[1], BR.light[1]);
  // conv grid of little windows
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) p.f(14 + c * 3, 27 + r * 3, 2, 2, (r + c) % 2 ? LIT : DARK);
  // timbered houses in front, left and right
  roof3q(p, 0, 26, 13, 5, R); timber(p, 1, 31, 11, 8, PL, W); win3q(p, 3, 33, 2, 2, LIT); p.f(7, 35, 2, 4, W[1]);
  roof3q(p, 24, 28, 12, 5, R); timber(p, 25, 33, 10, 7, PL, W); win3q(p, 31, 35, 2, 2, LIT);
  const slot = banner9(p, 25, 12, R);
  p.hl(0, 35, GY - 2, S[3]); p.hl(0, 35, GY - 1, S[2]); p.hl(0, 35, GY, S[1]);
  return fin(p, CX, GY, 18, slot);
}

/** segmentation · u-net — the U-TOWN: red-roofed houses round a U-shaped square, skip-bridge across its top. */
function uTown(): Sprite {
  const p = new Pen(LW, LH);
  // back row (the U's base)
  roof3q(p, 6, 8, 24, 6, R); timber(p, 7, 14, 22, 9, PL, W);
  win3q(p, 9, 16, 2, 2, LIT); win3q(p, 14, 16, 2, 2, LIT); win3q(p, 20, 16, 2, 2, LIT); win3q(p, 25, 16, 2, 2, LIT);
  cyl3q(p, 16, 2, 5, 7, S); cone3q(p, 18, -1, 3, 3, R);                    // little clock turret
  // the U's arms
  roof3q(p, 0, 18, 11, 6, R); timber(p, 1, 24, 9, 12, PL, W); win3q(p, 3, 27, 2, 2, LIT); win3q(p, 3, 31, 2, 2, W[1]);
  roof3q(p, 25, 18, 11, 6, R); timber(p, 26, 24, 9, 12, PL, W); win3q(p, 30, 27, 2, 2, LIT); win3q(p, 30, 31, 2, 2, LIT);
  // the square (cobbles) + well
  for (let y = 24; y < 41; y++) for (let x = 11; x < 25; x++) p.set(x, y, (x + y * 2) % 5 === 0 ? S[2] : S[3]);
  p.blob(18, 36, 2, 1, S[4], S[3], S[1]); p.set(18, 36, BR.water[2]);
  // skip bridge across the arms
  p.hl(9, 26, 22, W[4]); p.hl(9, 26, 23, W[1]);
  const slot = banner9(p, 12, 24, R);
  p.hl(0, 35, GY - 2, S[3]); p.hl(0, 35, GY - 1, S[2]); p.hl(0, 35, GY, S[1]);
  return fin(p, CX, GY, 18, slot);
}

/** alphazero · tree search — the CHURCH: a red-roofed nave and a rook-crowned bell tower. */
function church(): Sprite {
  const p = new Pen(LW, LH);
  // nave
  roof3q(p, 2, 16, 22, 8, R);
  wall3q(p, 3, 24, 20, 15, PL);
  for (const x of [6, 11, 16]) { p.f(x, 28, 2, 5, SL[2]); p.set(x, 28, SL[3]); }
  p.f(10, 34, 5, 5, W[1]); p.hl(10, 14, 33, S[4]);
  // bell tower with a rook crown (tree search = the chess rook) + red spire
  wall3q(p, 24, 12, 10, 27, PL);
  for (let c = 0; c < 12; c++) if (Math.floor(c / 2) % 2 === 0) p.vl(23 + c, 10, 11, c < 3 ? PL[3] : PL[1]);
  p.hl(23, 34, 12, S[2]);
  cone3q(p, 29, 0, 4, 9, R); p.vl(29, -1, 0, G[3]);
  p.f(27, 15, 4, 4, W[0]); p.set(28, 17, G[3]); p.set(29, 17, G[2]);      // the bell
  const slot = banner9(p, 24, 22, R);
  p.hl(0, 35, GY - 2, O[4]); p.hl(0, 35, GY - 1, O[3]); p.hl(0, 35, GY, O[1]);
  return fin(p, CX, GY, 18, slot);
}

/** simclr · contrastive — the TWIN SNOW CASTLE: two mirrored towers pulled together by one gate. */
function snowCastle(): Sprite {
  const p = new Pen(LW, LH);
  wall3q(p, 4, 22, 28, 17, S);
  for (let c = 0; c < 28; c++) if (Math.floor(c / 2) % 2 === 0) p.vl(4 + c, 20, 21, S[4]);
  for (const x of [3, 25]) { cyl3q(p, x, 10, 8, 29, S); cone3q(p, x + 4, 2, 5, 8, SL); p.vl(x + 4, 0, 1, W[1]); p.art(x + 5, 0, ["rrr", "rr."], { r: R[3] }); win3q(p, x + 3, 16, 2, 3, LIT); }
  p.f(15, 30, 6, 9, W[1]); p.hl(15, 20, 29, S[5]);
  // snow on the battlements + roofs
  for (let c = 4; c < 32; c += 2) p.set(c, 20, SN[5]);
  for (const x of [5, 27]) p.hl(x, x + 4, 9, SN[5]);
  const slot = banner9(p, 12, 12, SL);
  p.hl(0, 35, GY - 2, SN[4]); p.hl(0, 35, GY - 1, SN[3]); p.hl(0, 35, GY, SN[1]);
  return fin(p, CX, GY, 18, slot);
}

/** Domed observatory (Decision's hub set-piece): white drum, slate dome with an open slit, brass telescope. 30×32. */
export function observatory(): Sprite {
  const p = new Pen(31, 33);
  wall3q(p, 3, 18, 24, 12, S);
  for (const x of [6, 12, 18, 23]) { p.f(x, 21, 2, 4, SL[1]); p.set(x, 21, SL[3]); }
  dome3q(p, 15, 18, 11, SL, BR.light[1]);
  p.vl(15, 8, 17, SL[0]); p.vl(16, 8, 17, SL[0]);                           // slit
  p.ln(16, 10, 25, 2, G[2]); p.ln(16, 11, 25, 3, G[1]); p.set(25, 2, G[4]);  // telescope
  p.f(13, 25, 4, 5, W[1]);
  p.hl(1, 29, 30, S[3]); p.hl(1, 29, 31, S[1]);
  return fin(p, 15, 31, 13);
}

/** Snowy peak (3/4 faceted): lit snow face left, shaded snow right, rock at the foot. */
export function snowPeak(w: number, h: number): Sprite {
  const p = new Pen(w + 2, h + 2);
  const cx = (w + 1) >> 1;
  for (let y = 0; y <= h; y++) {
    const hw = Math.round((y / h) * (w / 2));
    for (let dx = -hw; dx <= hw; dx++) {
      const rock = y > h * 0.8 + Math.sin(dx * 1.3) * 1.5;
      const lit = dx < Math.round(Math.sin(y * 0.7) * 1);
      p.set(cx + dx, y, rock ? (lit ? BR.stoneR[3] : BR.stoneR[2]) : lit ? SN[5] : SN[2]);
    }
    if (y > 1) p.set(cx + Math.round(Math.sin(y * 0.7) * 1), y, SN[1]);
  }
  return p.done2({ x: cx, y: h }, { rim: false, shadow: [cx, h, w / 2, 1.2] });
}

// ——————————————————————————— catalogue ———————————————————————————
const memo = new Map<string, Sprite>();
const once = (k: string, f: () => Sprite) => { let s = memo.get(k); if (!s) { s = f(); memo.set(k, s); } return s; };

export const TOWN_LANDMARKS: Record<string, { make: () => Sprite; note: string }> = {
  classifier: { make: lensKeep, note: "Lens Keep — a red-roofed keep with one great lens window over a conv grid, timbered houses at its foot" },
  segmentation: { make: uTown, note: "U-Town — red-roofed houses round a U-shaped square, a skip-bridge across the arms" },
  alphazero: { make: church, note: "Rook Church — red nave, a rook-crowned bell tower (search from the top)" },
  simclr: { make: snowCastle, note: "Twin Snow Castle — two mirrored towers pulled together by one gate" },
};

export function townSprites() {
  return {
    pine: once("t:pine", () => pine(12)), pineS: once("t:pineS", () => pine(8)),
    pineSnow: once("t:pineSn", () => pine(11, true)), pineSnowS: once("t:pineSnS", () => pine(8, true)),
    oak: once("t:oak", () => oak(5)), oakS: once("t:oakS", () => oak(3)), grove: once("t:grove", grove),
    house0: once("t:h0", () => house(0)), house1: once("t:h1", () => house(1)), house2: once("t:h2", () => house(2)),
    windmill: once("t:wm", windmill), pier: once("t:pier", pier), treehouse: once("t:th", treehouse), observatory: once("t:obs", observatory),
    peakL: once("t:pkL", () => snowPeak(27, 20)), peakM: once("t:pkM", () => snowPeak(17, 13)), peakS: once("t:pkS", () => snowPeak(11, 8)),
  };
}

export const townLandmark = (atom: string): Sprite | undefined => {
  const e = TOWN_LANDMARKS[atom];
  return e ? once(`t:lm:${atom}`, e.make) : undefined;
};
