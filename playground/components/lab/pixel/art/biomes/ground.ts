// Biome GROUND kernels (round 4). Each biome has
//   · at(x, y)  — the calm interior ground colour at art px (x, y): flat base +
//                 a few large clean-edged tone zones (majority-cleaned, no speckle).
//                 Drop-in for composeAuthored's `ground` hook (convert world px → art px).
//   · paint(img, mask, o) — the full treatment of one region mask inside an art image:
//                 ground, ground MARKS (frontier washes · neon street grid + arterials +
//                 rain · reef bathymetry + caustics + sand ripples) and the BORDER
//                 transition (frontier: clean edge + lit rim · neon: lit city wall with
//                 dusk spill onto the day neighbours · reef: pale reef crest deepening inward).
// Everything deterministic (lattice hash / value noise), coordinates in art px of
// the image being painted plus an optional global offset so tiles agree across LODs.
import { CLEAR, SHADOW } from "../palette";
import { bayer4, fbm3, hash2 } from "../noise";
import type { ArtImage } from "../raster";
import { BR, C, lt } from "./palette";

export interface PaintOptions {
  /** land mask of the image (1 = land); spill never paints sea. Default: every non-CLEAR pixel is land. */
  land?: Uint8Array;
  /** pixels the marks must not touch (roads, footprints, labels…); ground tone still applies */
  protect?: Uint8Array;
  /** river / canal pixels (neon: canal edges get a cyan neon lip) */
  water?: Uint8Array;
  /** art px per tile (scales grid pitch, wash + zone sizes). Default 3. */
  apt?: number;
  /** global art-px offset of the image's (0, 0) so patterns line up across tiles/LODs */
  ox?: number;
  oy?: number;
  /** paint the border transition (default true) */
  border?: boolean;
}

export interface BiomeGround {
  key: string;
  name: string;
  night: boolean;
  underwater: boolean;
  /** calm interior colour at art px (x, y) (global coords), `apt` art px per tile */
  at(x: number, y: number, apt?: number): number;
  paint(img: ArtImage, mask: Uint8Array, o?: PaintOptions): void;
}

// ——— shared helpers ———

/** 4-neighbour BFS distance (art px) from the mask EDGE, inside (d ≥ 1) — 0 outside. Capped. */
export function distInside(mask: Uint8Array, w: number, h: number, cap = 64): Uint8Array {
  const d = new Uint8Array(w * h);
  const q: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!mask[i]) continue;
    const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1 || !mask[i - 1] || !mask[i + 1] || !mask[i - w] || !mask[i + w];
    if (edge) { d[i] = 1; q.push(i); }
  }
  for (let k = 0; k < q.length; k++) {
    const i = q[k];
    if (d[i] >= cap) continue;
    const x = i % w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
      if (j < 0 || j >= w * h || !mask[j] || d[j]) continue;
      d[j] = d[i] + 1; q.push(j);
    }
  }
  return d;
}

/** Distance OUTSIDE the mask (1 = touching), capped. */
export function distOutside(mask: Uint8Array, w: number, h: number, cap = 8): Uint8Array {
  const inv = new Uint8Array(w * h);
  for (let i = 0; i < inv.length; i++) inv[i] = mask[i] ? 0 : 1;
  const d = new Uint8Array(w * h);
  const q: number[] = [];
  for (let i = 0; i < inv.length; i++) {
    if (!inv[i]) continue;
    const x = i % w;
    if ((x > 0 && mask[i - 1]) || (x < w - 1 && mask[i + 1]) || (i >= w && mask[i - w]) || (i + w < w * h && mask[i + w])) { d[i] = 1; q.push(i); }
  }
  for (let k = 0; k < q.length; k++) {
    const i = q[k];
    if (d[i] >= cap) continue;
    const x = i % w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
      if (j < 0 || j >= w * h || !inv[j] || d[j]) continue;
      d[j] = d[i] + 1; q.push(j);
    }
  }
  return d;
}

/** Three tone zones (-1 / 0 / +1) from low-frequency noise, majority-cleaned so every zone is a solid cluster. */
function zones(w: number, h: number, mask: Uint8Array, ox: number, oy: number, scale: number, seed: number, lo = 0.36, hi = 0.63): Int8Array {
  const t = new Int8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!mask[i]) continue;
    const n = fbm3(x + ox, y + oy, seed, scale);
    t[i] = n > hi ? 1 : n < lo ? -1 : 0;
  }
  const t2 = new Int8Array(t);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (!mask[i]) continue;
    const c: Record<number, number> = { [-1]: 0, 0: 0, 1: 0 };
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) c[t[i + dy * w + dx]]++;
    t2[i] = c[1] >= 5 ? 1 : c[-1] >= 5 ? -1 : c[0] >= 5 ? 0 : t[i];
  }
  return t2;
}

// ——————————————————————————— THE FRONTIER ———————————————————————————
const F_BASE = C("sand", 2), F_LITE = C("sand", 3), F_RED = C("rock", 4);

export const FRONTIER: BiomeGround = {
  key: "wildwest", name: "the wild west", night: false, underwater: false,
  at(x, y, apt = 3) {
    const n = fbm3(x, y, 0xd35e, 7 * apt);
    return n > 0.63 ? F_LITE : n < 0.36 ? F_RED : F_BASE;
  },
  paint(img, mask, o = {}) {
    const { w, h } = img, apt = o.apt ?? 3, ox = o.ox ?? 0, oy = o.oy ?? 0;
    const z = zones(w, h, mask, ox, oy, 7 * apt, 0xd35e);
    for (let i = 0; i < w * h; i++) if (mask[i]) img.data[i] = z[i] > 0 ? F_LITE : z[i] < 0 ? F_RED : F_BASE;
    // dry washes: thin meandering contour lines of a second noise field, gated to a few
    // reaches; pale sand bed with a maroon shadow bank on the lower side (lit from the NW)
    const bed = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i] || o.protect?.[i]) continue;
      const gx = x + ox, gy = y + oy;
      const n = fbm3(gx, gy, 0x3a5b, 11 * apt);
      if (Math.abs(n - 0.5) > 0.011 * Math.max(1, 3 / apt)) continue;
      if (fbm3(gx, gy, 0x77e1, 9 * apt) < 0.5) continue;
      bed[i] = 1;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (bed[i]) { img.data[i] = C("sand", 4); continue; }
      if (y > 0 && bed[i - w] && mask[i] && !o.protect?.[i]) img.data[i] = C("rock", 3);
    }
    // border: a 1-px lit lip on north/west edges (the plateau catches the sun) — clean, no blend
    if (o.border !== false) {
      for (let y = 1; y < h; y++) for (let x = 1; x < w; x++) {
        const i = y * w + x;
        if (mask[i] && (!mask[i - w] || !mask[i - 1]) && !o.protect?.[i]) img.data[i] = C("sand", 4);
      }
    }
  },
};

// ——————————————————————————— NEON CITY ———————————————————————————
const N = BR.night, M = BR.neonM, Y = BR.neonC;

/** Street grid geometry (global art px): pitch, and which lines are neon arterials. */
export function neonGrid(apt = 3) {
  const pitch = Math.max(8, Math.round(apt * 3));
  return {
    pitch,
    /** 0 = lot, 1 = street, 2 = horizontal arterial (magenta), 3 = vertical arterial (cyan) */
    cell(gx: number, gy: number): 0 | 1 | 2 | 3 {
      const ix = Math.floor(gx / pitch), iy = Math.floor(gy / pitch);
      const fx = ((gx % pitch) + pitch) % pitch, fy = ((gy % pitch) + pitch) % pitch;
      const artV = ((ix % 3) + 3) % 3 === 0, artH = ((iy % 3) + 3) % 3 === 1;
      if (fy === 0 && artH) return 2;
      if (fx === 0 && artV) return 3;
      if (fx === 0 || fy === 0) return 1;
      return 0;
    },
  };
}

export const NEON: BiomeGround = {
  key: "cyber", name: "cyber island", night: true, underwater: false,
  at(x, y, apt = 3) {
    const c = neonGrid(apt).cell(x, y);
    return c === 2 ? M[2] : c === 3 ? Y[2] : c === 1 ? N[1] : N[3];
  },
  paint(img, mask, o = {}) {
    const { w, h } = img, apt = o.apt ?? 3, ox = o.ox ?? 0, oy = o.oy ?? 0;
    const g = neonGrid(apt);
    const din = distInside(mask, w, h, 8);
    const z = zones(w, h, mask, ox, oy, 6 * apt, 0x6e0);
    const WALL = o.border === false ? 0 : 3;       // wall ring width inside the mask
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      const gx = x + ox, gy = y + oy;
      const c = g.cell(gx, gy);
      // lots: roof-level plazas (violet), a few darker districts; streets: blackened asphalt
      let v = c === 0 ? (z[i] < 0 ? N[2] : N[3]) : N[1];
      if (!o.protect?.[i]) {
        if (c === 2) v = M[2];
        else if (c === 3) v = Y[2];
        else if (c === 0) {
          // neon glow bleeds 1 px off the arterials onto the lots
          if (g.cell(gx, gy - 1) === 2 || g.cell(gx, gy + 1) === 2) v = M[0];
          else if (g.cell(gx - 1, gy) === 3 || g.cell(gx + 1, gy) === 3) v = Y[0];
        }
        if (c === 2 && (g.cell(gx - 1, gy) === 3 || g.cell(gx + 1, gy) === 3)) v = Y[3];   // junction flare
      }
      img.data[i] = v;
    }
    // rain: short parallel streaks (down-left), sparse lattice — one direction, one length
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const gx = x + ox, gy = y + oy;
      if (hash2(Math.floor(gx / 5), Math.floor(gy / 7), 0x7a1) > 0.16) continue;
      if (gx % 5 !== 2 || gy % 7 !== 0) continue;
      for (let k = 0; k < 3; k++) {
        const xx = x - k, yy = y + k * 2, yy2 = yy + 1;
        for (const py of [yy, yy2]) {
          if (xx < 0 || py >= h || py < 0) continue;
          const j = py * w + xx;
          if (mask[j] && din[j] > WALL && !o.protect?.[j] && img.data[j] !== M[2] && img.data[j] !== Y[2]) img.data[j] = N[4];
        }
      }
    }
    // canal edges: a cyan neon lip where the city meets water, dark embankment behind it
    if (o.water || o.land) {
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (!mask[i]) continue;
        const wet = (j: number) => (o.water?.[j] ?? 0) || (o.land ? !o.land[j] : 0);
        if (wet(i)) continue;
        if (wet(i - 1) || wet(i + 1) || wet(i - w) || wet(i + w)) img.data[i] = Y[2];
        else if (wet(i - 2) || wet(i + 2) || wet(i - 2 * w) || wet(i + 2 * w)) img.data[i] = N[0];
      }
    }
    if (o.border === false) return;
    // THE CITY WALL (levee) on land borders: [dusk spill ×2 outside] [lit wall top] [wall face with lamps] [magenta levee strip]
    const land = o.land;
    const isLand = (j: number) => (land ? land[j] === 1 : img.data[j] !== CLEAR);
    const dout = distOutside(mask, w, h, 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (mask[i]) {
        const d = din[i];
        if (d > 3 || o.water?.[i]) continue;
        // only walls facing LAND neighbours (sea/canal sides keep the neon lip)
        let nearLand = false;
        for (let dy = -3; dy <= 3 && !nearLand; dy++) for (let dx = -3; dx <= 3; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (!mask[j] && isLand(j) && !o.water?.[j]) { nearLand = true; break; }
        }
        if (!nearLand) continue;
        const gx = x + ox, gy = y + oy;
        if (d === 1) img.data[i] = C("stone", 4);                                      // wall top, catching the day light
        else if (d === 2) img.data[i] = (gx + gy) % 4 === 0 ? C("gold", 3) : C("stone", 2); // wall face + lamp windows
        else img.data[i] = M[1];                                                       // levee neon strip
        continue;
      }
      // dusk spill onto the day neighbour: 1 px shadow, then a sparse ordered 2nd px
      const d = dout[i];
      if (!d || !isLand(i) || o.water?.[i] || img.data[i] === CLEAR) continue;
      if (d === 1) img.data[i] = SHADOW[img.data[i]];
      else if (d === 2 && bayer4(x + ox, y + oy) < 0.5) img.data[i] = SHADOW[img.data[i]];
    }
  },
};

// ——————————————————————————— THE REEF ———————————————————————————
const R = BR.reef, SB = BR.seabed;

export const REEF: BiomeGround = {
  key: "sunken", name: "sunken city", night: false, underwater: true,
  at() { return R[3]; },
  paint(img, mask, o = {}) {
    const { w, h } = img, apt = o.apt ?? 3, ox = o.ox ?? 0, oy = o.oy ?? 0;
    const din = distInside(mask, w, h, 60);
    // bathymetry: pale crest at the rim, stepping deeper inward in CLEAN warped contour bands
    const S = Math.max(1, apt / 3);
    const bands = [2, 5, 9, 14, 20].map((b) => b * S);
    const sand = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      const gx = x + ox, gy = y + oy;
      const warp = (fbm3(gx, gy, 0x5ee1, 9 * apt) - 0.5) * 7 * S;
      const d = din[i] + warp;
      const k = d < 1.5 ? 6 : d < bands[1] ? 5 : d < bands[2] ? 4 : d < bands[3] ? 3 : d < bands[4] ? 2 : 1;
      img.data[i] = R[k];
      // sand flats in the shallow bands
      if (k >= 4 && k <= 5 && fbm3(gx, gy, 0x5a4d, 6 * apt) > 0.62) { img.data[i] = SB[2]; sand[i] = 1; }
    }
    // sand ripples: short wavy lines every 3 rows on the flats
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!sand[i] || o.protect?.[i]) continue;
      const gx = x + ox, gy = y + oy;
      if (((gy + Math.round(Math.sin(gx * 0.7) * 1)) % 3 + 3) % 3 === 0 && (gx % 7) < 5) img.data[i] = SB[1];
    }
    // caustics: calm 1-px lighter wavy lines, broken, on the water (not the sand)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i] || sand[i] || o.protect?.[i] || din[i] < 3) continue;
      const gx = x + ox, gy = y + oy;
      const wave = gy + 1.6 * Math.sin(gx * 0.45 + gy * 0.13) + 0.9 * Math.sin(gx * 0.17 - 1.3);
      const m = ((wave % 7) + 7) % 7;
      if (m < 1 && fbm3(gx, gy, 0xca5c, 5 * apt) > 0.52) img.data[i] = lt(img.data[i]);
    }
  },
};

// ——————————————————————————— simple zoned grounds (reference palette) ———————————————————————————
/** Flat ground with three clean tone zones (lo / base / hi) + optional sparse patches of a 2nd material. */
function zoned(key: string, name: string, lo: number, base: number, hi: number, patch?: { a: number; b: number; th: number }): BiomeGround {
  return {
    key, name, night: false, underwater: false,
    at(x, y, apt = 3) { const n = fbm3(x, y, 0x61a7 ^ key.length, 7 * apt); return n > 0.63 ? hi : n < 0.36 ? lo : base; },
    paint(img, mask, o = {}) {
      const { w, h } = img, apt = o.apt ?? 3, ox = o.ox ?? 0, oy = o.oy ?? 0;
      const z = zones(w, h, mask, ox, oy, 7 * apt, 0x61a7 ^ key.length);
      for (let i = 0; i < w * h; i++) if (mask[i]) img.data[i] = z[i] > 0 ? hi : z[i] < 0 ? lo : base;
      if (!patch) return;
      const pz = zones(w, h, mask, ox + 911, oy + 377, 5 * apt, 0xa11 ^ key.length, 0.2, patch.th);
      for (let i = 0; i < w * h; i++) if (mask[i] && pz[i] > 0 && !o.protect?.[i]) img.data[i] = z[i] > 0 ? patch.b : patch.a;
    },
  };
}
const O = BR.olive, D = BR.desert, SN = BR.snowR, ST = BR.stoneR, BA = BR.basalt, LV = BR.lavaR;
export const FOREST = zoned("forest", "pine & oak forest", O[3], O[4], O[5], { a: BR.forestR[3], b: BR.forestR[4], th: 0.62 });
export const VILLAGE = zoned("village", "green village", O[4], O[5], O[6]);
export const MARBLE = zoned("marble", "marble sands", D[5], D[6], BR.paperR[3], { a: O[4], b: O[5], th: 0.7 });
export const STILTS = zoned("stilts", "desert of the stilt town", D[3], D[4], D[5]);
export const SNOW = zoned("snow", "snowfields", SN[3], SN[4], SN[5], { a: ST[3], b: ST[4], th: 0.72 });

/** Lava forge: basalt zones split by meandering glowing lava rivers (crust · glow · molten core · hot spots). */
export const FORGE: BiomeGround = {
  key: "forge", name: "lava forge", night: false, underwater: false,
  at(x, y, apt = 3) { const n = fbm3(x, y, 0xf09e, 7 * apt); return n > 0.63 ? BA[3] : n < 0.36 ? BA[1] : BA[2]; },
  paint(img, mask, o = {}) {
    const { w, h } = img, apt = o.apt ?? 3, ox = o.ox ?? 0, oy = o.oy ?? 0;
    const z = zones(w, h, mask, ox, oy, 7 * apt, 0xf09e);
    for (let i = 0; i < w * h; i++) if (mask[i]) img.data[i] = z[i] > 0 ? BA[3] : z[i] < 0 ? BA[1] : BA[2];
    const lava = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i] || o.protect?.[i]) continue;
      const n = fbm3(x + ox, y + oy, 0x1a7a, 13 * apt);
      lava[i] = fbm3(x + ox, y + oy, 0x2b8b, 10 * apt) < 0.52 ? 1 : Math.abs(n - 0.5);      // only some reaches flow
    }
    const th = 0.022 * Math.max(1, 3 / apt);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!mask[i] || o.protect?.[i]) continue;
      const d = lava[i];
      if (d < th * 0.45) img.data[i] = hash2(x + ox, y + oy, 0x5) < 0.12 ? LV[4] : LV[3];
      else if (d < th) img.data[i] = LV[2];
      else if (d < th * 1.5) img.data[i] = y > 0 && lava[i - w] < th ? LV[0] : BA[0];     // glow spill below, crust elsewhere
    }
  },
};

/**
 * DIORAMA CLIFFS (the reference's raised slab): under every land edge that faces
 * south, a layered cliff face `depth` art px tall hangs into the sea — lit left
 * third, strata every 2 rows, vertical fissures, a dark foot and a foam line;
 * east-facing edges get a 1-px shaded lip. `ramp` = cliff ramp (dark → light).
 */
export function paintCliffs(img: ArtImage, land: Uint8Array, o: { depth?: number; ramp?: readonly number[]; foam?: number; ox?: number } = {}) {
  const { w, h } = img, depth = o.depth ?? 8, R = o.ramp ?? BR.cliffR, ox = o.ox ?? 0;
  const foam = o.foam ?? BR.light[1];
  for (let x = 0; x < w; x++) for (let y = 0; y < h - 1; y++) {
    const i = y * w + x;
    if (!land[i] || land[i + w]) continue;
    const gx = x + ox;
    // ragged foot: blocky teeth (2–3 px wide) of varying drop
    const dd = depth + Math.round((hash2(Math.floor(gx / 3), 7, 0xc1f) - 0.5) * 4);
    const crack = hash2(gx, 3, 0x9a1) < 0.2;
    const westCorner = x > 0 && !land[i - 1], eastCorner = x < w - 1 && !land[i + 1];
    for (let k = 1; k <= dd; k++) {
      const yy = y + k;
      if (yy >= h || land[yy * w + x]) break;
      const t = k / dd;
      let v = k === 1 ? R[5] : t < 0.35 ? (gx % 3 === 0 ? R[3] : R[4]) : t < 0.75 ? (gx % 4 === 1 ? R[2] : R[3]) : R[2];
      if (k === Math.round(dd * 0.35) + 1) v = R[2];                              // strata seam
      if (crack && k > 1 && k < dd) v = R[1];                                       // vertical crack
      if (westCorner && k > 1) v = R[4];
      if (eastCorner && k > 1) v = R[1];
      if (k >= dd - 1) v = k === dd ? R[0] : R[1];
      img.data[yy * w + x] = v;
    }
    const fy = y + dd + 1;
    if (fy < h && !land[fy * w + x] && gx % 2 === 0) img.data[fy * w + x] = foam;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w - 1; x++) {
    const i = y * w + x;
    if (land[i] && !land[i + 1] && !(y > 0 && !land[i - w])) img.data[i] = R[2];   // east rim darkens
  }
}

/**
 * FLOATING UNDERSIDE (the cyber island): jagged hanging rock below the island mask —
 * stalactite teeth of varying length, night-stone strata, neon drips and hanging cables.
 */
export function paintUnderside(img: ArtImage, mask: Uint8Array, o: { depth?: number; ox?: number } = {}) {
  const { w, h } = img, depth = o.depth ?? 14, ox = o.ox ?? 0;
  const N = BR.night, M = BR.neonM, Y = BR.neonC;
  for (let x = 0; x < w; x++) {
    let edge = -1;
    for (let y = h - 1; y >= 0; y--) if (mask[y * w + x]) { edge = y; break; }
    if (edge < 0) continue;
    const tooth = Math.round(depth * (0.35 + 0.65 * Math.abs(Math.sin((x + ox) * 0.37) * Math.cos((x + ox) * 0.11))));
    const left = x > 0 && mask[edge * w + x - 1] === 0, right = x < w - 1 && mask[edge * w + x + 1] === 0;
    for (let k = 1; k <= tooth; k++) {
      const yy = edge + k;
      if (yy >= h) break;
      let v = k === 1 ? N[4] : Math.floor(k / 3) % 2 ? N[2] : N[3];
      if (left) v = N[4];
      if (right) v = N[1];
      if (k === tooth) v = N[0];
      img.data[yy * w + x] = v;
    }
    const gx = x + ox;
    if (gx % 13 === 5 && tooth > 4) for (let k = tooth + 1; k < tooth + 6 && edge + k < h; k++) img.data[(edge + k) * w + x] = k === tooth + 5 ? Y[3] : N[0];   // hanging cable + lamp
    if (gx % 17 === 9 && tooth > 3) { const yy = edge + tooth + 1; if (yy < h) img.data[yy * w + x] = M[2]; }                                        // neon drip
  }
}

export const ZONE_GROUNDS: Record<string, BiomeGround> = {
  forest: FOREST, village: VILLAGE, wildwest: FRONTIER, marble: MARBLE, stilts: STILTS, snow: SNOW, forge: FORGE, sunken: REEF, cyber: NEON,
};
const FAMILY_ZONE: Record<string, string> = { perception: "forest", sequence: "marble", generative: "forge", representation: "snow", decision: "village", structure: "cyber" };

/** Ground kernel for a ZONE key (forest · village · wildwest · marble · stilts · snow · forge · sunken · cyber) or a family (its main zone). */
export function biomeGround(zoneOrFamily: string): BiomeGround | undefined {
  return ZONE_GROUNDS[zoneOrFamily] ?? ZONE_GROUNDS[FAMILY_ZONE[zoneOrFamily] ?? ""];
}

/** composeAuthored `ground` hook for one family (world px → art px via `px` world px per art px). */
export function groundHook(zoneOrFamily: string, px: number, apt = 3): ((wx: number, wy: number) => number | undefined) | undefined {
  const g = biomeGround(zoneOrFamily);
  if (!g || g.underwater) return undefined;
  return (wx, wy) => g.at(Math.floor(wx / px), Math.floor(wy / px), apt);
}

