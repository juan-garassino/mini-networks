// Painting out the painter's lettering (paper map): a restorer's retouch.
// The painter's model plates and his own chrome (cartouche, compass, scale
// bar: the four corners replace it) are removed from the painting once, when
// it has decoded, and the skin shows that clean painting with our plates on
// it. A plate we then do not draw (half under the map plate or a corner, an
// invented landmark when zoomed in) simply is not there: the painting runs on
// under it. No blank card, no blurred patch.
//
// Two strokes, by size:
//   · a plate (small): a clone stamp. The stretch of painting whose
//     surroundings match is copied over it with a feathered edge. Which
//     stretch: for every candidate offset, the band of painting just outside
//     the hole is compared, pixel for pixel, with the band round the source;
//     the closest wins, so lava is retouched from lava, sea from sea.
//   · the painter's cartouche, compass, scale bar (large, on open sea): no
//     stretch that size matches, so the hole is washed in from its rim (a
//     smooth membrane of the colours round it, pull-push) and the grain of
//     the best-matching stretch is laid over the wash, so it reads as brushed.
// Sources never hold lettering: neither a hole not yet retouched nor the
// lettering the map keeps (`keep`). Pure (no DOM), and a generator: the skin
// runs it a few ms at a time so the page stays live while it works.
import type { Box } from "./anchors";

/** RGBA pixels, as ImageData has them. */
export interface Pixels { width: number; height: number; data: Uint8ClampedArray | Uint8Array }

/** a hole reaches this far past its lettering box (the painter's torn edge and drop) … */
export const HOLE_PAD = 9;
/** … and its outer FEATHER px blend into the painting round it */
const FEATHER = 6;
const BAND = 8;          // the band outside the hole that is matched, px
const SAMPLE = 3;        // the band is sampled every SAMPLE px
const STEP = 4;          // candidate offsets every STEP px …
const REACH = 1.6;       // … out to REACH × the hole's larger side (+ MARGIN)
const MARGIN = 40;
const LARGE = 24000;     // px²: holes larger than this are washed, not cloned
const GRAIN = 4;         // the grain laid over a wash: a sample less its GRAIN-px box blur …
const TILE = 40;         // … from a TILE-px square, mirrored across the hole in a brick bond …
const GRAIN_K = 0.6;     // … at this strength (a repeat must not read as a pattern)

const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const grow = (b: Box, p: number): Box => ({ x: Math.floor(b.x - p), y: Math.floor(b.y - p), w: Math.ceil(b.w + 2 * p), h: Math.ceil(b.h + 2 * p) });

/** The best clone offset for hole `h` (padded): the source at h + offset. */
function bestOffset(img: Pixels, h: Box, avoid: readonly Box[]): { dx: number; dy: number } | null {
  const { width: W, height: H, data } = img;
  const pts: number[] = [];
  for (let y = h.y - BAND; y < h.y + h.h + BAND; y += SAMPLE) for (let x = h.x - BAND; x < h.x + h.w + BAND; x += SAMPLE) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) continue;
    pts.push(x, y);
  }
  if (pts.length < 8) return null;
  const n = pts.length / 2;
  const reach = Math.max(h.w, h.h) * REACH + MARGIN;
  let best: { dx: number; dy: number } | null = null, bestCost = Infinity;
  for (let dy = -reach; dy <= reach; dy += STEP) for (let dx = -reach; dx <= reach; dx += STEP) {
    const ddx = Math.round(dx), ddy = Math.round(dy);
    const src = grow({ x: h.x + ddx, y: h.y + ddy, w: h.w, h: h.h }, BAND);
    if (src.x < 0 || src.y < 0 || src.x + src.w > W || src.y + src.h > H) continue;
    if (hit(src, grow(h, BAND)) || avoid.some((b) => hit(src, b))) continue;
    let cost = 0;
    const lim = bestCost * n;
    for (let k = 0; k < pts.length && cost < lim; k += 2) {
      const a = (pts[k + 1] * W + pts[k]) * 4, b = ((pts[k + 1] + ddy) * W + pts[k] + ddx) * 4;
      cost += Math.abs(data[a] - data[b]) + Math.abs(data[a + 1] - data[b + 1]) + Math.abs(data[a + 2] - data[b + 2]);
    }
    cost /= n;
    if (cost < bestCost) { bestCost = cost; best = { dx: ddx, dy: ddy }; }
  }
  return best;
}

/** 0 at the hole's edge → 1 FEATHER px in */
const ramp = (h: Box, x: number, y: number) => Math.min(1, (Math.min(x - h.x, h.x + h.w - 1 - x, y - h.y, h.y + h.h - 1 - y) + 1) / FEATHER);

/** The hole washed in from its rim: pull-push over a pyramid of the known
 * pixels round it (a smooth membrane of their colours). RGB floats, hole coordinates. */
function wash(img: Pixels, h: Box): Float32Array {
  const { width: W, data } = img;
  // the hole + a rim of painting, as a small weighted image
  const r = BAND * 2, X0 = Math.max(0, h.x - r), Y0 = Math.max(0, h.y - r);
  const X1 = Math.min(img.width, h.x + h.w + r), Y1 = Math.min(img.height, h.y + h.h + r);
  let w = X1 - X0, hh = Y1 - Y0;
  let col = new Float32Array(w * hh * 3), wt = new Float32Array(w * hh);
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    const gx = X0 + x, gy = Y0 + y;
    if (gx >= h.x && gx < h.x + h.w && gy >= h.y && gy < h.y + h.h) continue;
    const a = (gy * W + gx) * 4, i = y * w + x;
    col[i * 3] = data[a]; col[i * 3 + 1] = data[a + 1]; col[i * 3 + 2] = data[a + 2]; wt[i] = 1;
  }
  // pull: halve until 1 px, keeping weighted means
  const levels: { col: Float32Array; wt: Float32Array; w: number; h: number }[] = [{ col, wt, w, h: hh }];
  while (w > 1 || hh > 1) {
    const nw = Math.max(1, w >> 1), nh = Math.max(1, hh >> 1);
    const nc = new Float32Array(nw * nh * 3), nwt = new Float32Array(nw * nh);
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, j = Math.min(nh - 1, y >> 1) * nw + Math.min(nw - 1, x >> 1);
      nwt[j] += wt[i]; nc[j * 3] += col[i * 3] * wt[i]; nc[j * 3 + 1] += col[i * 3 + 1] * wt[i]; nc[j * 3 + 2] += col[i * 3 + 2] * wt[i];
    }
    for (let j = 0; j < nw * nh; j++) if (nwt[j] > 0) { nc[j * 3] /= nwt[j]; nc[j * 3 + 1] /= nwt[j]; nc[j * 3 + 2] /= nwt[j]; nwt[j] = Math.min(1, nwt[j]); }
    levels.push({ col: nc, wt: nwt, w: nw, h: nh });
    col = nc; wt = nwt; w = nw; hh = nh;
  }
  // push: fill each level's gaps from the (bilinear) coarser level
  for (let l = levels.length - 2; l >= 0; l--) {
    const f = levels[l], c = levels[l + 1];
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      const i = y * f.w + x;
      if (f.wt[i] >= 1) continue;
      const cx = Math.min(c.w - 1, Math.max(0, (x - 0.5) / 2)), cy = Math.min(c.h - 1, Math.max(0, (y - 0.5) / 2));
      const x0 = Math.floor(cx), y0 = Math.floor(cy), x1 = Math.min(c.w - 1, x0 + 1), y1 = Math.min(c.h - 1, y0 + 1);
      const fx = cx - x0, fy = cy - y0;
      for (let k = 0; k < 3; k++) {
        const v = (c.col[(y0 * c.w + x0) * 3 + k] * (1 - fx) + c.col[(y0 * c.w + x1) * 3 + k] * fx) * (1 - fy)
          + (c.col[(y1 * c.w + x0) * 3 + k] * (1 - fx) + c.col[(y1 * c.w + x1) * 3 + k] * fx) * fy;
        f.col[i * 3 + k] = f.col[i * 3 + k] * f.wt[i] + v * (1 - f.wt[i]);
      }
      f.wt[i] = 1;
    }
  }
  const out = new Float32Array(h.w * h.h * 3), base = levels[0];
  for (let y = 0; y < h.h; y++) for (let x = 0; x < h.w; x++) {
    const i = (h.y + y - Y0) * base.w + (h.x + x - X0);
    for (let k = 0; k < 3; k++) out[(y * h.w + x) * 3 + k] = base.col[i * 3 + k];
  }
  return out;
}

/** The grain laid over a wash: a TILE-px square of open painting near the
 * hole, the colour closest to the wash's and the most even (open sea, not a
 * coast), less its own box blur, mirrored across the hole. RGB, hole coordinates. */
function grain(img: Pixels, h: Box, avoid: readonly Box[], base: Float32Array): Float32Array {
  const { width: W, height: H, data } = img;
  const out = new Float32Array(h.w * h.h * 3);
  let mr = 0, mg = 0, mb = 0;
  for (let j = 0; j < base.length; j += 3) { mr += base[j]; mg += base[j + 1]; mb += base[j + 2]; }
  const nb = base.length / 3;
  mr /= nb; mg /= nb; mb /= nb;
  let best: Box | null = null, bestCost = Infinity;
  const reach = Math.max(h.w, h.h) + TILE * 2;
  for (let y = h.y - reach; y <= h.y + h.h + reach; y += TILE / 3) for (let x = h.x - reach; x <= h.x + h.w + reach; x += TILE / 3) {
    const t = { x: Math.round(x), y: Math.round(y), w: TILE, h: TILE };
    if (t.x - GRAIN < 0 || t.y - GRAIN < 0 || t.x + TILE + GRAIN > W || t.y + TILE + GRAIN > H) continue;
    if (hit(grow(t, GRAIN), h) || avoid.some((o) => hit(grow(t, GRAIN), o))) continue;
    let r = 0, g = 0, b = 0, q = 0, n = 0;
    for (let v = 0; v < TILE; v += 4) for (let u = 0; u < TILE; u += 4) {
      const a = ((t.y + v) * W + t.x + u) * 4;
      r += data[a]; g += data[a + 1]; b += data[a + 2]; q += data[a] * data[a] + data[a + 1] * data[a + 1] + data[a + 2] * data[a + 2]; n++;
    }
    r /= n; g /= n; b /= n;
    const spread = Math.sqrt(Math.max(0, q / n - (r * r + g * g + b * b)));
    const cost = Math.abs(r - mr) + Math.abs(g - mg) + Math.abs(b - mb) + 2 * spread;
    if (cost < bestCost) { bestCost = cost; best = t; }
  }
  if (!best) return out;
  const mirror = (v: number) => { const k = Math.floor(v / TILE), r = v - k * TILE; return k % 2 ? TILE - 1 - r : r; };
  for (let y = 0; y < h.h; y++) for (let x = 0; x < h.w; x++) {
    // brick bond: every other row of tiles shifted half a tile, so the mirror seams never line up
    const row = Math.floor(y / TILE) % 2;
    const sx = best.x + mirror(x + row * (TILE >> 1)), sy = best.y + mirror(y);
    let r = 0, g = 0, b = 0, n = 0;
    for (let v = -GRAIN; v <= GRAIN; v += 2) for (let u = -GRAIN; u <= GRAIN; u += 2) {
      const a = ((sy + v) * W + sx + u) * 4;
      r += data[a]; g += data[a + 1]; b += data[a + 2]; n++;
    }
    const a = (sy * W + sx) * 4, j = (y * h.w + x) * 3;
    out[j] = (data[a] - r / n) * GRAIN_K; out[j + 1] = (data[a + 1] - g / n) * GRAIN_K; out[j + 2] = (data[a + 2] - b / n) * GRAIN_K;
  }
  return out;
}

/** Retouch every hole of `img.data` in place, in order. Yields after each hole. */
export function* retouch(img: Pixels, holes: readonly Box[], keep: readonly Box[] = []): Generator<void, void, void> {
  const { width: W, height: H, data } = img;
  const padded = holes.map((b) => {
    const g = grow(b, HOLE_PAD);
    const x = Math.max(0, g.x), y = Math.max(0, g.y);
    return { x, y, w: Math.min(W, g.x + g.w) - x, h: Math.min(H, g.y + g.h) - y };
  });
  const kept = keep.map((b) => grow(b, 4));
  for (let i = 0; i < padded.length; i++) {
    const h = padded[i];
    // no source may hold a hole still to do, or a kept letter
    const off = bestOffset(img, h, [...padded.slice(i + 1), ...kept]);
    if (h.w * h.h > LARGE || !off) {
      const base = wash(img, h);
      const g = grain(img, h, [...padded, ...kept], base);
      for (let y = 0; y < h.h; y++) for (let x = 0; x < h.w; x++) {
        const a = ((h.y + y) * W + h.x + x) * 4, t = ramp(h, h.x + x, h.y + y), j = (y * h.w + x) * 3;
        for (let k = 0; k < 3; k++) data[a + k] = Math.max(0, Math.min(255, data[a + k] * (1 - t) + (base[j + k] + g[j + k]) * t));
      }
    } else {
      // source and hole never overlap, so the copy reads only untouched painting
      for (let y = 0; y < h.h; y++) for (let x = 0; x < h.w; x++) {
        const a = ((h.y + y) * W + h.x + x) * 4, b = ((h.y + y + off.dy) * W + h.x + x + off.dx) * 4, t = ramp(h, h.x + x, h.y + y);
        for (let k = 0; k < 3; k++) data[a + k] = data[a + k] * (1 - t) + data[b + k] * t;
      }
    }
    yield;
  }
}

/** Run `retouch` to the end (tests, node). */
export function retouchAll(img: Pixels, holes: readonly Box[], keep: readonly Box[] = []): void {
  const it = retouch(img, holes, keep);
  while (!it.next().done) { /* retouch */ }
}
