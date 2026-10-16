// The parchment sea runs past the map's edge to every corner of the screen,
// dressed with the map's OWN sea furniture: every pixel cluster that sits in
// open sea (not sea colour, in no land — clouds, ships, the serpent, islets,
// birds) is lifted off the map as a sprite and re-stamped, sparsely and
// deterministically, in the ring around the map. Pure: no DOM, no "@/".

export interface SeaSprite {
  w: number;
  h: number;
  /** palette index per pixel, -1 = transparent (sea) */
  px: Int16Array;
  area: number;
}

export interface Placed { sprite: number; x: number; y: number; flip: boolean }

/** 8-connected clusters of (non-sea, no-land) pixels, up to `maxSide` wide. */
export function extractSprites(idx: ArrayLike<number>, sea: Uint8Array, lands: ArrayLike<number>, w: number, h: number, maxSide = 96): SeaSprite[] {
  const seen = new Uint8Array(w * h);
  const out: SeaSprite[] = [];
  const free = (p: number) => !sea[p] && lands[p] < 0 && !seen[p];
  for (let p0 = 0; p0 < w * h; p0++) {
    if (!free(p0)) continue;
    const pts: number[] = [];
    const st = [p0];
    seen[p0] = 1;
    let x0 = w, x1 = -1, y0 = h, y1 = -1;
    while (st.length) {
      const p = st.pop()!;
      pts.push(p);
      const x = p % w, y = (p - x) / w;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (free(q)) { seen[q] = 1; st.push(q); }
      }
    }
    const sw = x1 - x0 + 1, sh = y1 - y0 + 1;
    // skip specks, anything touching the image edge (half a cloud) and big blobs
    if (pts.length < 6 || sw > maxSide || sh > maxSide || x0 === 0 || y0 === 0 || x1 === w - 1 || y1 === h - 1) continue;
    const px = new Int16Array(sw * sh).fill(-1);
    for (const p of pts) { const x = p % w, y = (p - x) / w; px[(y - y0) * sw + (x - x0)] = idx[p]; }
    out.push({ w: sw, h: sh, px, area: pts.length });
  }
  // stable order: biggest first (placement caps big ones)
  return out.sort((a, b) => b.area - a.area);
}

/** Seeded, sparse placement in the ring [-padX, W+padX]×[-padY, H+padY]
 * minus the map rect (inflated by `gap`). Cell grid + jitter: never two
 * sprites in one cell, big sprites used at most twice, small ones freely. */
export function placeFurniture(sprites: SeaSprite[], W: number, H: number, opts: {
  padX: number; padY: number; cell?: number; density?: number; seed?: number; gap?: number; bigArea?: number;
}): Placed[] {
  const { padX, padY } = opts;
  const cell = opts.cell ?? 72, density = opts.density ?? 0.5, gap = opts.gap ?? 8, bigArea = opts.bigArea ?? 260;
  let s = (opts.seed ?? 7) >>> 0 || 1;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  if (!sprites.length) return [];
  const uses = new Uint16Array(sprites.length);
  const out: Placed[] = [];
  // pick weight ~ 1/sqrt(area): small furniture is common, big is rare
  const weights = sprites.map((sp) => 1 / Math.sqrt(sp.area));
  const pick = (): number => {
    const avail = sprites.map((sp, i) => (sp.area >= bigArea && uses[i] >= 2 ? 0 : weights[i]));
    const total = avail.reduce((a, b) => a + b, 0);
    if (total <= 0) return -1;
    let r = rnd() * total;
    for (let i = 0; i < avail.length; i++) { r -= avail[i]; if (r <= 0) return i; }
    return avail.length - 1;
  };
  const x0 = -padX, y0 = -padY, x1 = W + padX, y1 = H + padY;
  for (let cy = y0; cy < y1; cy += cell) for (let cx = x0; cx < x1; cx += cell) {
    if (rnd() > density) continue;
    const i = pick();
    if (i < 0) continue;
    const sp = sprites[i];
    const x = Math.floor(cx + rnd() * Math.max(1, cell - sp.w)), y = Math.floor(cy + rnd() * Math.max(1, cell - sp.h));
    // never over the map (inflated), never off the ring
    if (x + sp.w > -gap && x < W + gap && y + sp.h > -gap && y < H + gap) continue;
    if (x < x0 || y < y0 || x + sp.w > x1 || y + sp.h > y1) continue;
    uses[i]++;
    out.push({ sprite: i, x, y, flip: rnd() < 0.5 });
  }
  return out;
}
