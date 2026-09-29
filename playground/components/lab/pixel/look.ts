// Contemporary pixel look — LOCAL SHIM until components/lab/pixel/art/**
// (owned by the illustrator) exports its palette ramps + terrain kernels.
// Replace these exports with `./art` ones as they land (see art/README.md).
//
// Hue-shifted ramps (shadows cool, highlights warm), ~5–8 steps per material.
// The palette is index-based: Sweetie-16 keeps slots 0–15 for legacy sprites
// and UI; ramps are appended from slot 16, so every mark stays palette-exact.
import { SWEETIE } from "./palette";

export const RAMPS = {
  // water: deepest → foam
  ocean: ["#1f2358", "#2a2f73", "#343d8e", "#3f4fa3", "#4766bd", "#3f8fdd", "#39c5f0", "#7fe3f5", "#d8fbff"],
  sand: ["#6a3f36", "#96593f", "#c07e4c", "#e2a562", "#f1c47f", "#fbe2a8"],
  grass: ["#1d4550", "#246b55", "#2f8f4c", "#46ab44", "#5cc23f", "#95d84a", "#d6ee7a"],
  forest: ["#152f45", "#1a4b48", "#236a42", "#34893c", "#57ab3c", "#9bd455"],
  rock: ["#2e1a33", "#4e2a3a", "#6e3634", "#8a4630", "#b86a45", "#dc9a62"],
  snow: ["#4a4a7a", "#7274a8", "#a3a8d4", "#d0d6f2", "#f2f5ff", "#ffffff"],
  ochre: ["#3f2a3a", "#6a3f3a", "#9a6040", "#c78c4a", "#e3b460", "#f6d98e"],
  ember: ["#2a1630", "#4c1f35", "#7a2a33", "#a8402e", "#d86a32", "#f7a64a"],
  crystal: ["#232447", "#373c69", "#51598a", "#7581ab", "#a3b3d2", "#d8e6f6"],
  cliff: ["#2a1426", "#4a1f33", "#6e2f3a"],
  cloud: ["#6a6aa8", "#9a9ccf", "#d4d6f2", "#fff8ea"],
  lava: ["#b83a2e", "#f0703a", "#ffc05a"],
} as const;
export type RampName = keyof typeof RAMPS;

/** One palette: Sweetie-16 first (legacy), then every ramp in order. */
export const PALETTE: string[] = [...SWEETIE];
export const R: Record<RampName, number[]> = {} as Record<RampName, number[]>;
for (const [name, hexes] of Object.entries(RAMPS) as [RampName, readonly string[]][]) {
  R[name] = hexes.map((h) => { PALETTE.push(h); return PALETTE.length - 1; });
}

/** How each family's land is dressed inside the ONE elevation system. */
export interface Dress { low: RampName; mid: RampName; high: RampName; peak: RampName; tree: RampName; shallows?: RampName }
export const DRESS: Record<string, Dress> = {
  perception:     { low: "sand",  mid: "grass",   high: "forest",  peak: "rock",    tree: "forest" },
  sequence:       { low: "sand",  mid: "ochre",   high: "rock",    peak: "snow",    tree: "grass" },
  generative:     { low: "ochre", mid: "ember",   high: "rock",    peak: "ember",   tree: "ember", shallows: "lava" },
  representation: { low: "sand",  mid: "snow",    high: "crystal", peak: "snow",    tree: "forest" },
  decision:       { low: "sand",  mid: "ochre",   high: "grass",   peak: "rock",    tree: "grass" },
  structure:      { low: "sand",  mid: "crystal", high: "crystal", peak: "snow",    tree: "crystal" },
};
export const dressOf = (family: string): Dress => DRESS[family] ?? DRESS.perception;

// 4×4 Bayer matrix, 0..15 → thresholds in [0,1)
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

/** Quantise t∈[0,1] onto a ramp with ordered dither only near band edges. */
export function rampPick(ramp: number[], t: number, x: number, y: number, edge = 0.35): number {
  const n = ramp.length;
  const f = Math.min(n - 1, Math.max(0, t * (n - 1)));
  const i = Math.floor(f), frac = f - i;
  if (i >= n - 1) return ramp[n - 1];
  // dither only in the middle band of the transition, flat elsewhere
  const d = frac < 0.5 - edge / 2 ? 0 : frac > 0.5 + edge / 2 ? 1 : (frac - (0.5 - edge / 2)) / edge;
  return ramp[d > bayer(x, y) ? i + 1 : i];
}

/** Deterministic value noise in [0,1] (terrain relief only — no randomness in data marks). */
export function vnoise(x: number, y: number, scale: number, seed = 7): number {
  const h = (ix: number, iy: number) => {
    let n = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const fx = x / scale, fy = y / scale;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  const tx = fx - ix, ty = fy - iy;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** UI tokens for the contemporary chrome (hue-shifted indigo panels, warm cream type). */
export const UI = {
  panel: "#262a4d",
  panelHi: "#343a66",
  panelLo: "#1b1d38",
  rim: "#5b62a0",
  rimLight: "#8e95d0",
  cream: "#fff4dc",
  muted: "#b9bbdf",
  gold: "#ffcf5a",
  goldDeep: "#e0913a",
  cyan: "#7fe3f5",
  lime: "#b5e36a",
  ember: "#f0703a",
  ink: "#15122b",
} as const;
