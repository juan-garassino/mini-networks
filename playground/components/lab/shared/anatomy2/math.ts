// Exact client-side maths for the anatomy diagrams. Every number here is a
// transcription of the Python it names — change one side, change the other.

/** mulberry32 — a tiny seeded PRNG so the "random" noise is reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** n standard-normal samples (Box–Muller) from a seed. */
export function gaussian(n: number, seed: number): Float32Array {
  const r = rng(seed);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 2) {
    const u = Math.max(1e-9, r());
    const v = r();
    const m = Math.sqrt(-2 * Math.log(u));
    out[i] = m * Math.cos(2 * Math.PI * v);
    if (i + 1 < n) out[i + 1] = m * Math.sin(2 * Math.PI * v);
  }
  return out;
}

// ————— DDPM (src/mini_networks/models/diffusion/{config,scheduler}.py) —————

/** DiffusionConfig: timesteps=1000, schedule="linear", beta 1e-4 → 0.02. */
export const DDPM = { T: 1000, betaStart: 1e-4, betaEnd: 0.02 } as const;

/**
 * NoiseScheduler(linear): betas = linspace(b0·s, b1·s, T), s = 1000/T (=1 at
 * the reference T=1000), alphas = 1−betas, ᾱ = cumprod(alphas). Index i here is
 * the CODE index (0..T−1); the diagram labels paper-style t = i+1, with t=0
 * the clean image.
 */
export function alphaBar(T: number = DDPM.T): Float64Array {
  const s = 1000 / T;
  const out = new Float64Array(T);
  let acc = 1;
  for (let i = 0; i < T; i++) {
    const beta = Math.min(0.999, DDPM.betaStart * s + ((DDPM.betaEnd - DDPM.betaStart) * s * i) / (T - 1));
    acc *= 1 - beta;
    out[i] = acc;
  }
  return out;
}

export function betaAt(i: number, T: number = DDPM.T): number {
  const s = 1000 / T;
  return Math.min(0.999, DDPM.betaStart * s + ((DDPM.betaEnd - DDPM.betaStart) * s * i) / (T - 1));
}

/** ᾱ for paper-indexed t (t=0 → 1, the clean image). */
export function abarT(ab: Float64Array, t: number): number {
  return t <= 0 ? 1 : ab[Math.min(ab.length, t) - 1];
}

/** q(x_t | x_0): x_t = √ᾱ_t · x_0 + √(1−ᾱ_t) · ε (scheduler.add_noise). */
export function addNoise(x0: Float32Array, eps: Float32Array, abar: number): Float32Array {
  const a = Math.sqrt(abar);
  const b = Math.sqrt(1 - abar);
  const out = new Float32Array(x0.length);
  for (let i = 0; i < x0.length; i++) out[i] = a * x0[i] + b * eps[i];
  return out;
}

/**
 * model.get_time_embedding(t, 128): half=64,
 * freqs = exp(−ln(10000)·k/(half−1)), emb = [cos(t·freqs), sin(t·freqs)].
 */
export function timeEmbedding(t: number, dim = 128): { cos: Float32Array; sin: Float32Array } {
  const half = dim / 2;
  const cos = new Float32Array(half);
  const sin = new Float32Array(half);
  for (let k = 0; k < half; k++) {
    const f = Math.exp((-Math.log(10000) * k) / (half - 1));
    cos[k] = Math.cos(t * f);
    sin[k] = Math.sin(t * f);
  }
  return { cos, sin };
}

// ————— small image ops (classifier / vae / gan illustrations) —————

/** 'same'-padded 3×3 conv on an h×w single-channel map. */
export function conv3(img: Float32Array, h: number, w: number, k: number[]): Float32Array {
  const out = new Float32Array(h * w);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy < 0 || xx < 0 || yy >= h || xx >= w) continue;
          s += img[yy * w + xx] * k[(dy + 1) * 3 + (dx + 1)];
        }
      out[y * w + x] = s;
    }
  return out;
}

export const relu = (a: Float32Array): Float32Array => a.map((v) => (v > 0 ? v : 0));

/** 2×2 max-pool (stride 2). */
export function maxPool2(img: Float32Array, h: number, w: number): Float32Array {
  const H = Math.floor(h / 2), W = Math.floor(w / 2);
  const out = new Float32Array(H * W);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      out[y * W + x] = Math.max(img[2 * y * w + 2 * x], img[2 * y * w + 2 * x + 1], img[(2 * y + 1) * w + 2 * x], img[(2 * y + 1) * w + 2 * x + 1]);
  return out;
}

/** Rescale a map to [−1, 1] by its own max |value| (display only). */
export function normSym(a: Float32Array): Float32Array {
  let m = 1e-6;
  for (const v of a) m = Math.max(m, Math.abs(v));
  return a.map((v) => v / m);
}

/** Rescale a map to [−1, 1] by min/max (display only). */
export function normMinMax(a: Float32Array): Float32Array {
  let lo = Infinity, hi = -Infinity;
  for (const v of a) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const r = Math.max(1e-6, hi - lo);
  return a.map((v) => ((v - lo) / r) * 2 - 1);
}

/** Box-blur downsample of a 28×28 map to n×n (mean pooling). */
export function resize(img: Float32Array, h: number, w: number, n: number): Float32Array {
  const out = new Float32Array(n * n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const y0 = Math.floor((y * h) / n), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * h) / n));
      const x0 = Math.floor((x * w) / n), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * w) / n));
      let s = 0, c = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { s += img[yy * w + xx]; c++; }
      out[y * n + x] = s / c;
    }
  return out;
}

export function softmax(v: number[]): number[] {
  const m = Math.max(...v);
  const e = v.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
}

// ————— decoding the exported champion data (data/*-champion.ts) —————

/** One hex char per value, 16 levels over [lo, hi] → bin centres. */
export function unNib(s: string, lo = -1, hi = 1): Float32Array {
  const out = new Float32Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = lo + ((parseInt(s[i], 16) + 0.5) / 16) * (hi - lo);
  return out;
}

/** Hex bytes → Uint8Array. */
export function hexBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(2 * i, 2 * i + 2), 16);
  return out;
}
