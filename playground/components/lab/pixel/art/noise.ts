// Seeded, deterministic noise for the art system (never Math.random).
// Re-exports the world's lattice hash so terrain speckle agrees across runs.
import { hash2, mulberry32, valueNoise } from "@/lib/world/rng";

export { hash2, mulberry32, valueNoise };

/** Three-octave value noise in [0, 1]. */
export function fbm3(x: number, y: number, seed: number, scale: number): number {
  return (
    4 * valueNoise(x, y, seed, scale) +
    2 * valueNoise(x, y, seed ^ 0x9e3779b9, scale / 2) +
    valueNoise(x, y, seed ^ 0x85ebca6b, scale / 4)
  ) / 7;
}

/** Ridged noise in [0, 1]: sharp crests where value noise crosses 0.5. */
export function ridged(x: number, y: number, seed: number, scale: number): number {
  const n = fbm3(x, y, seed, scale);
  return 1 - Math.abs(n * 2 - 1);
}

// 4×4 Bayer matrix, thresholds in (0, 1).
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function bayer4(x: number, y: number): number {
  return (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

/**
 * Quantise a continuous ramp position `v` (in steps) with ordered dithering
 * ONLY near the half-way band edge: inside ±`band` of the midpoint between two
 * steps the Bayer matrix picks floor or ceil; elsewhere it simply rounds.
 * That keeps big flat clusters and a crisp 1–3 px dither seam per transition.
 */
export function ditherStep(v: number, x: number, y: number, band = 0.18): number {
  const f = Math.floor(v);
  const frac = v - f;
  if (Math.abs(frac - 0.5) < band) {
    const t = (frac - 0.5 + band) / (2 * band); // 0..1 across the seam
    return bayer4(x, y) < t ? f + 1 : f;
  }
  return frac < 0.5 ? f : f + 1;
}

// ————— fast value noise: identical values to valueNoise(), but the lattice
// hashes are memoised per (seed, scale) so a full-world pass is a few array
// reads per sample instead of four hashes. Coordinates outside the cached
// window (tile coords −64…320) fall back to valueNoise.
const LAT: { seed: number; scale: number; a: Float32Array; n: number; o: number }[] = [];
const smooth = (t: number) => t * t * (3 - 2 * t);
function lattice(seed: number, scale: number) {
  for (let k = 0; k < LAT.length; k++) { const L = LAT[k]; if (L.seed === seed && L.scale === scale) return L; }
  const o = Math.ceil(64 / scale) + 2;
  const n = Math.ceil(384 / scale) + 4;
  const a = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) a[j * n + i] = hash2(i - o, j - o, seed);
  const L = { seed, scale, a, n, o };
  LAT.push(L);
  return L;
}
export function noise(x: number, y: number, seed: number, scale: number): number {
  const L = lattice(seed, scale);
  const fx = x / scale, fy = y / scale;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const i = x0 + L.o, j = y0 + L.o;
  if (i < 0 || j < 0 || i + 1 >= L.n || j + 1 >= L.n) return valueNoise(x, y, seed, scale);
  const tx = smooth(fx - x0), ty = smooth(fy - y0);
  const k = j * L.n + i;
  const a = L.a[k], b = L.a[k + 1], c = L.a[k + L.n], d = L.a[k + L.n + 1];
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}
/** fbm3 on the fast lattice. */
export function fbm3f(x: number, y: number, seed: number, scale: number): number {
  return (4 * noise(x, y, seed, scale) + 2 * noise(x, y, seed ^ 0x9e3779b9, scale / 2) + noise(x, y, seed ^ 0x85ebca6b, scale / 4)) / 7;
}
export function ridgedf(x: number, y: number, seed: number, scale: number): number {
  return 1 - Math.abs(fbm3f(x, y, seed, scale) * 2 - 1);
}
