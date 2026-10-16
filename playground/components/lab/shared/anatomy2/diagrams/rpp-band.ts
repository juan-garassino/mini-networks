// Exact structure maths for the rpp_classifier diagram (pure TS so node --test
// can check it, rpp-band.test.ts). No model, no checkpoint.

/**
 * Where a zero-padded 3×3 conv lives inside the same-shape dense matrix: for
 * ONE (out-channel, in-channel) pair on an s×s map, the s²×s² block of
 * free.weight. Cell (o, i) is a conv tap iff the two pixels are within one
 * step in both row and column — 9 shared diagonals, clipped at the edges.
 */
export function bandLit(s: number, o: number, i: number): boolean {
  const oy = Math.floor(o / s), ox = o % s, iy = Math.floor(i / s), ix = i % s;
  return Math.abs(oy - iy) <= 1 && Math.abs(ox - ix) <= 1;
}

/** number of conv taps in one s²×s² channel-pair block (s=7 → 361, s=14 → 1 600) */
export function bandCount(s: number): number {
  let n = 0;
  for (let o = 0; o < s * s; o++) for (let i = 0; i < s * s; i++) if (bandLit(s, o, i)) n++;
  return n;
}

/** per output row o: the lit [start, end) column runs (≤ 3, one per input row) */
export function bandRuns(s: number, o: number): [number, number][] {
  const oy = Math.floor(o / s), ox = o % s;
  const out: [number, number][] = [];
  for (let iy = Math.max(0, oy - 1); iy <= Math.min(s - 1, oy + 1); iy++) {
    out.push([iy * s + Math.max(0, ox - 1), iy * s + Math.min(s - 1, ox + 1) + 1]);
  }
  return out;
}

/** nn.AvgPool2d(2) on an h×w single-channel map. */
export function avgPool2(img: ArrayLike<number>, h: number, w: number): Float32Array {
  const H = Math.floor(h / 2), W = Math.floor(w / 2);
  const out = new Float32Array(H * W);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      out[y * W + x] = (img[2 * y * w + 2 * x] + img[2 * y * w + 2 * x + 1] + img[(2 * y + 1) * w + 2 * x] + img[(2 * y + 1) * w + 2 * x + 1]) / 4;
  return out;
}

/** N(0, σ²) density shape with σ = 1/√(2λ) (the MAP reading of an L2 term λ‖w‖²) */
export const sigmaOf = (lambda: number) => 1 / Math.sqrt(2 * lambda);

/**
 * Bell heights (integer px, 0..peak) for `cols` columns spanning ±range weight
 * units on a shared axis: h = round(peak · exp(−u²/2σ²)), u at the column centre.
 */
export function bellHeights(lambda: number, cols: number, range: number, peak: number): number[] {
  const s = sigmaOf(lambda);
  const upx = (2 * range) / cols;
  return Array.from({ length: cols }, (_, c) => {
    const u = (c + 0.5 - cols / 2) * upx;
    return Math.round(peak * Math.exp(-(u * u) / (2 * s * s)));
  });
}
