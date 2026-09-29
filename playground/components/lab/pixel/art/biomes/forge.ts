// GENERATIVE lava forge (round 4, reference look): dark basalt ground split by
// glowing lava rivers, black smokestacks, forges and factories. Four landmarks,
// one per generative atom, each a way of MAKING: the steam foundry (diffusion —
// the plume clears as it rises), the block furnace (pixelcnn — windows light in
// raster order), the hourglass furnace (vae — the glowing bottleneck), the twin
// forges (gan — two fires facing off).
import { BR } from "./palette";
import { Pen, cone3q, cyl3q, wall3q } from "./kit";
import { banner9 } from "./town";
import type { Sprite } from "../sprites/paint";

const B = BR.basalt, L = BR.lavaR, S = BR.stoneR, C = BR.iron, G = BR.goldR, SN = BR.snowR, IR = BR.iron;
const HOT = new Set([L[2], L[3], L[4], G[3], G[4]]);
const LW = 36, LH = 46, GY = 43, CX = 18;
const fin = (p: Pen, ax: number, ay: number, rx: number, slot?: Sprite["slot"]) => p.done2({ x: ax, y: ay }, { slot, shadow: [ax, ay, rx, 1.6], keep: HOT });

/** Brick chimney (lit left), soot cap; `puffs` of smoke above, greying out as they rise. */
function chimney(p: Pen, x: number, top: number, base: number, w = 4, puffs = 3, clearing = false) {
  for (let y = top; y <= base; y++) for (let c = 0; c < w; c++) p.set(x + c, y, c === 0 ? C[3] : c === w - 1 ? C[1] : y % 3 === 0 && c % 2 ? C[1] : C[2]);
  p.hl(x - 1, x + w, top, B[1]); p.hl(x - 1, x + w, top + 1, B[2]);
  const tones = clearing ? [[S[2], S[1], S[0]], [SN[2], S[2], S[1]], [SN[4], SN[2], SN[1]], [BR.light[1], SN[4], SN[2]]] : [[S[2], S[1], S[0]], [S[3], S[2], S[1]], [SN[2], S[3], S[2]]];
  for (let k = 0; k < puffs; k++) {
    const t = tones[Math.min(k, tones.length - 1)];
    p.blob(x + (w >> 1) + k * 2, top - 3 - k * 5, 2 + k * 0.6, 1.6 + k * 0.4, t[0], t[1], t[2]);
  }
}

export function smokestack(): Sprite {
  const p = new Pen(12, 28);
  chimney(p, 3, 12, 26, 4, 3);
  return fin(p, 5, 26, 3);
}

/** Basalt spire with glowing lava cracks. */
export function basaltSpire(h = 14): Sprite {
  const p = new Pen(11, h + 2);
  for (let y = 0; y <= h; y++) {
    const hw = Math.round(0.5 + (y / h) * 4.5 + (y % 4 === 1 ? 0.6 : 0));
    for (let dx = -hw; dx <= hw; dx++) p.set(5 + dx, y, dx < 0 ? IR[3] : dx === 0 ? IR[2] : IR[1]);
  }
  p.ln(5, 4, 4, 8, L[2]); p.ln(4, 8, 6, h - 2, L[1]); p.set(4, 8, L[3]);
  return fin(p, 5, h, 4);
}

/** Lava pool: crusted rim, molten core with a bright centre. */
export function lavaPool(w = 13, h = 6): Sprite {
  const p = new Pen(w, h);
  p.blob(w >> 1, h >> 1, (w - 1) / 2, (h - 1) / 2, B[2], B[1], B[0]);
  p.blob(w >> 1, h >> 1, (w - 4) / 2, (h - 3) / 2, L[3], L[2], L[1]);
  p.set((w >> 1) - 1, (h >> 1) - 1, L[4]);
  return p.done2({ x: w >> 1, y: h - 1 }, { rim: false, keep: HOT });
}

/** The VOLCANO (hero set-piece, 64×55): basalt cone, glowing crater, lava rivers down the flanks, two smokestacks at the rim. */
export function volcano(): Sprite {
  const p = new Pen(64, 55);
  const cx = 32, top = 16, base = 52;
  for (let y = top; y <= base; y++) {
    const hw = Math.round(5 + ((y - top) / (base - top)) * 26);
    for (let dx = -hw; dx <= hw; dx++) {
      const u = (dx + hw + 0.5) / (2 * hw + 1);
      let v = u < 0.25 ? B[4] : u < 0.5 ? B[3] : u < 0.75 ? B[2] : B[1];
      if ((y + Math.abs(dx) * 2) % 7 === 0 && u > 0.2) v = B[1];                // gullies
      p.set(cx + dx, y, v);
    }
  }
  // crater
  p.hl(cx - 5, cx + 5, top, B[0]); p.hl(cx - 4, cx + 4, top + 1, L[2]); p.hl(cx - 3, cx + 3, top + 1, L[3]); p.set(cx - 1, top + 1, L[4]);
  // lava rivers: meander down the flanks, branching
  const river = (x0: number, dir: number, seed: number, stop = base) => {
    let x = x0;
    for (let y = top + 2; y <= stop; y++) {
      x += Math.round(Math.sin(y * (0.3 + seed * 0.07) + seed) * 0.9) + (y % (2 + (seed % 3)) === 0 ? dir : 0);
      p.set(x, y, L[3]); p.set(x + 1, y, L[2]); if (y % 5 === 0) p.set(x, y, L[4]);
      p.set(x - 1, y, y % 2 ? L[1] : B[0]);
    }
  };
  river(cx - 2, -1, 1); river(cx + 2, 1, 5, base - 6); river(cx, 0, 3, base - 14);
  // smokestacks at the rim + plumes
  chimney(p, cx - 11, 10, 19, 3, 2); chimney(p, cx + 8, 8, 18, 3, 3);
  return p.done2({ x: cx, y: base }, { keep: HOT, shadow: [cx, base, 28, 2] });
}

function yard(p: Pen) {
  p.hl(0, 35, GY - 2, B[3]); p.hl(0, 35, GY - 1, B[2]); p.hl(0, 35, GY, B[0]);
}

/** diffusion · denoising — the STEAM FOUNDRY: sawtooth hall, a chimney whose plume turns from soot to clean white as it rises. */
function steamFoundry(): Sprite {
  const p = new Pen(LW, LH);
  chimney(p, 25, 12, 30, 5, 4, true);
  for (let k = 0; k < 3; k++) {                                        // sawtooth roof bays
    const x = 2 + k * 8;
    for (let r = 0; r < 6; r++) for (let c = 0; c <= r + 1 && c < 8; c++) p.set(x + c, 24 + r, c === r + 1 ? S[4] : c < 2 ? S[1] : S[2]);
    p.vl(x, 24, 29, S[4]);
  }
  wall3q(p, 2, 30, 30, 11, C);
  for (let x = 4; x < 30; x += 4) { p.f(x, 33, 2, 3, L[3]); p.set(x, 33, L[4]); }
  p.f(14, 36, 5, 5, B[0]); p.hl(14, 18, 36, L[2]);
  const slot = banner9(p, 1, 12, BR.roofR);
  yard(p);
  return fin(p, CX, GY, 18, slot);
}

/** pixelcnn · autoregressive — the BLOCK FURNACE: a stepped brick stack; windows light up in raster order (top-left first). */
function blockFurnace(): Sprite {
  const p = new Pen(LW, LH);
  const tiers = [[4, 28, 30, 11], [8, 20, 20, 10], [12, 12, 12, 8]] as const;   // x, w, y, h
  let n = 0;
  for (let k = tiers.length - 1; k >= 0; k--) {
    const [x, w, y, h] = tiers[k];
    wall3q(p, x, y, w, h, C);
    p.hl(x - 1, x + w, y, C[4]);
  }
  for (const [x, w, y, h] of [...tiers].reverse()) {
    for (let yy = y + 2; yy < y + h - 1; yy += 3) for (let xx = x + 2; xx < x + w - 2; xx += 3) {
      const lit = n++ < 14;                                             // the raster front: first 14 cells glow
      p.f(xx, yy, 2, 2, lit ? L[3] : B[1]); if (lit) p.set(xx, yy, L[4]);
    }
  }
  chimney(p, 16, 4, 12, 4, 2);
  const slot = banner9(p, 24, 18, BR.roofR);
  yard(p);
  return fin(p, CX, GY, 18, slot);
}

/** vae · latent bottleneck — the HOURGLASS FURNACE: wide bowl, a glowing waist, a molten pour into the mould below. */
function hourglassFurnace(): Sprite {
  const p = new Pen(LW, LH);
  for (let y = 4; y <= 38; y++) {
    const t = (y - 21) / 17;
    const hw = Math.round(3 + Math.abs(t) * 10);
    for (let dx = -hw; dx <= hw; dx++) {
      const u = (dx + hw + 0.5) / (2 * hw + 1);
      p.set(18 + dx, y, u < 0.2 ? C[3] : u < 0.6 ? C[2] : u < 0.85 ? C[1] : C[0]);
    }
    if (y % 4 === 0) for (let dx = -hw; dx <= hw; dx += 2) p.set(18 + dx, y, B[2]);   // iron hoops / rivets
  }
  // the glowing waist (the latent)
  for (let y = 18; y <= 24; y++) { const hw = Math.round(3 + Math.abs((y - 21) / 17) * 10) - 1; for (let dx = -hw; dx <= hw; dx++) p.set(18 + dx, y, Math.abs(dx) < 2 ? L[4] : L[3]); }
  p.hl(7, 29, 4, B[1]); p.hl(8, 28, 5, L[2]); for (let x = 9; x < 28; x += 3) p.set(x, 5, L[3]);   // open top: molten
  p.vl(18, 39, 40, L[3]); p.f(12, 41, 13, 1, L[2]);
  const slot = banner9(p, 24, 24, BR.roofR);
  yard(p);
  return fin(p, CX, GY, 18, slot);
}

/** gan · adversarial — the TWIN FORGES: two forge towers facing off, fire mouths open, sparks between. */
function twinForges(): Sprite {
  const p = new Pen(LW, LH);
  for (const [x, flip] of [[1, false], [22, true]] as const) {
    cyl3q(p, x, 12, 13, 28, IR);
    cone3q(p, x + 6, 4, 7, 8, BR.roofR);
    for (let c = 0; c < 13; c += 3) p.set(x + c, 12, L[1]);
    // fire mouth facing the rival
    const mx = flip ? x + 1 : x + 8;
    p.f(mx, 26, 4, 6, L[2]); p.f(mx + (flip ? 0 : 1), 27, 3, 4, L[3]); p.set(mx + 1, 28, L[4]);
    p.vl(x + 6, 1, 4, B[1]); p.set(x + 6, 0, L[3]);
  }
  // sparks in the gap
  for (const [x, y] of [[16, 25], [18, 22], [20, 27], [17, 29], [19, 24], [15, 21]] as const) p.set(x, y, (x + y) % 2 ? G[4] : L[3]);
  // lava channel between them
  for (let x = 12; x < 25; x++) { p.set(x, 39, L[2]); p.set(x, 40, L[1]); if (x % 3 === 0) p.set(x, 39, L[4]); }
  const slot = banner9(p, 12, 6, BR.roofR);
  yard(p);
  return fin(p, CX, GY, 18, slot);
}

// ——————————————————————————— catalogue ———————————————————————————
const memo = new Map<string, Sprite>();
const once = (k: string, f: () => Sprite) => { let s = memo.get(k); if (!s) { s = f(); memo.set(k, s); } return s; };

export const FORGE_LANDMARKS: Record<string, { make: () => Sprite; note: string }> = {
  diffusion: { make: steamFoundry, note: "Steam Foundry — the plume turns from soot to clean white as it rises (denoising)" },
  pixelcnn: { make: blockFurnace, note: "Block Furnace — windows light up in raster order, top-left first" },
  vae: { make: hourglassFurnace, note: "Hourglass Furnace — a wide bowl, a glowing waist (the latent), a molten pour" },
  gan: { make: twinForges, note: "Twin Forges — two fires facing off, sparks flying between" },
};

export function forgeSprites() {
  return {
    smokestack: once("f:stack", smokestack), spire: once("f:spire", () => basaltSpire(14)), spireS: once("f:spireS", () => basaltSpire(9)),
    lavaPool: once("f:pool", () => lavaPool()), volcano: once("f:volcano", volcano),
  };
}

export const forgeLandmark = (atom: string): Sprite | undefined => {
  const e = FORGE_LANDMARKS[atom];
  return e ? once(`f:lm:${atom}`, e.make) : undefined;
};

