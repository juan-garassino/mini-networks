// Contemporary terrain shading (local shim until art/terrain-shade.ts lands):
// one height field for the whole world — distance inland + the family-border
// ridges (world.mountains) + gentle relief — lit by ONE key light from the
// top-left, quantised onto each family's hue-shifted ramps, with ordered
// dithering only where bands meet. Water gets depth: a bright cyan shallow
// halo with a foam line, then deepening indigo with calm current strokes.
// Output is palette indices (look.ts PALETTE), like every other layer.
import type { World } from "@/lib/world";
import { blank, type IndexImage } from "./raster";
import { bayer, dressOf, R, rampPick, vnoise, type Dress } from "./look";

export interface GroundShape {
  land: Uint8Array; owner: Int8Array; river: Uint8Array;
  dWater: Float32Array; dLand: Float32Array; cliff: Uint8Array; cliffOwner: Int8Array;
}

const TS = 16;

/** Distance (px) to the nearest ridge polyline, capped — two-pass chamfer from rasterised ridges. */
function ridgeField(world: World, W: number, H: number): Float32Array {
  const d = new Float32Array(W * H).fill(1e6);
  for (const line of world.mountains) for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
    for (let s = 0; s <= n; s++) {
      const x = Math.round(a.x + ((b.x - a.x) * s) / Math.max(n, 1)), y = Math.round(a.y + ((b.y - a.y) * s) / Math.max(n, 1));
      if (x >= 0 && y >= 0 && x < W && y < H) d[y * W + x] = 0;
    }
  }
  const D = Math.SQRT2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + 1);
    if (y > 0) { v = Math.min(v, d[i - W] + 1); if (x > 0) v = Math.min(v, d[i - W - 1] + D); if (x < W - 1) v = Math.min(v, d[i - W + 1] + D); }
    d[i] = v;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x; let v = d[i];
    if (x < W - 1) v = Math.min(v, d[i + 1] + 1);
    if (y < H - 1) { v = Math.min(v, d[i + W] + 1); if (x < W - 1) v = Math.min(v, d[i + W + 1] + D); if (x > 0) v = Math.min(v, d[i + W - 1] + D); }
    d[i] = v;
  }
  return d;
}

export interface Shaded { img: IndexImage; height: Float32Array }

export function shadeGround(world: World, g: GroundShape): Shaded {
  const W = world.cols * TS, H = world.rows * TS;
  const img = blank(W, H);
  const ridge = ridgeField(world, W, H);
  const dress: Dress[] = world.regions.map((r) => dressOf(r.family));

  // height: 0 at the shore → ~1 on ridges and deep inland
  const h = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!g.land[i]) { h[i] = -Math.min(1, g.dLand[i] / 60); continue; }
    const inland = 1 - Math.exp(-g.dWater[i] / 80);
    const relief = 0.22 * (vnoise(x, y, 56) - 0.5) + 0.1 * (vnoise(x, y, 19, 3) - 0.5);
    const rid = 0.6 * Math.exp(-ridge[i] / 22);
    h[i] = Math.max(0, Math.min(1.2, 0.55 * inland + relief * Math.min(1, g.dWater[i] / 12) + rid));
  }

  const G = 9; // light gain on the height gradient
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let v: number;
    if (g.land[i]) {
      const own = g.owner[i];
      const dr = dress[own] ?? dressOf("");
      const e = h[i];
      // light: height rising toward bottom-right means the face looks top-left → lit
      const ex = (h[Math.min(i + 2, i - (x % W) + W - 1)] - h[Math.max(i - 2, i - (x % W))]);
      const ey = (h[Math.min(i + 2 * W, W * H - 1)] - h[Math.max(i - 2 * W, 0)]);
      const light = Math.max(-1, Math.min(1, (ex + ey) * G));
      const eb = e + (bayer(x, y) - 0.5) * 0.05; // dithered band edges
      const shore = g.dWater[i];
      if (shore <= 1.2) { v = R[dr.low][1]; }
      else {
        const band: [keyof typeof R, number, number] =
          eb < 0.12 ? [dr.low, 0, 0.12] : eb < 0.5 ? [dr.mid, 0.12, 0.5] : eb < 0.78 ? [dr.high, 0.5, 0.78] : [dr.peak, 0.78, 1.2];
        const within = Math.min(1, Math.max(0, (e - band[1]) / (band[2] - band[1])));
        const t = Math.min(1, Math.max(0, 0.52 + 0.38 * light + 0.12 * (within - 0.5)));
        v = rampPick(R[band[0]], t, x, y);
      }
    } else if (!g.river[i] && g.cliff[i] >= 1 && g.cliff[i] <= 4) {
      // raised slab: a maroon cliff face under south-facing shores, then foam
      const k = g.cliff[i];
      v = k === 1 ? R.cliff[2] : k <= 3 ? R.cliff[1] : R.ocean[8];
    } else {
      const d = g.dLand[i];
      const o = R.ocean;
      if (g.river[i]) v = d <= 1.2 ? o[5] : d <= 3.5 ? o[6] : o[5];
      else if (d <= 1.6) v = (x + y * 2) % 4 === 0 ? o[7] : o[8];         // foam dots on the shoreline
      else if (d <= 3) v = o[7];
      else if (d <= 13) v = o[6];
      else if (d <= 20) v = rampPick([o[6], o[5]], (d - 13) / 7, x, y, 0.9);
      else if (d <= 34) v = rampPick([o[5], o[4], o[3]], (d - 20) / 14, x, y, 0.5);
      else v = o[3];
      // calm current strokes: thin iso-lines of a slow noise field
      const c = vnoise(x, y, d <= 13 ? 26 : 90, d <= 13 ? 11 : 5);
      if (d > 4 && Math.abs(c - 0.5) < (d <= 13 ? 0.012 : 0.006)) v = d <= 13 ? o[7] : o[2];
      // ember shallows off the volcanic land (generative)
      if (d > 2 && d <= 13) {
        const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) {
          const rr = world.regionOf[(ty + dy) * world.cols + tx + dx];
          if (rr >= 0 && dress[rr]?.shallows) near = true;
        }
        if (near && vnoise(x, y, 14, 23) > 0.74) v = R.lava[vnoise(x, y, 5, 29) > 0.6 ? 2 : 1];
      }
    }
    img.data[i] = v;
  }
  return { img, height: h };
}

/** Round tree canopies in clumps on a decor cell (shadow-side outline in the ramp's darkest hue). */
export function paintClump(img: IndexImage, cx: number, cy: number, ramp: number[], variant: number) {
  const n = 3 + (variant % 3);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + variant;
    const r = 2.5 + ((k + variant) % 3);
    const x0 = cx + Math.cos(a) * 4.5, y0 = cy + Math.sin(a) * 3.5 - 1;
    // cast shadow down-right onto the ground
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      const px = Math.round(x0 + x + 2), py = Math.round(y0 + y + 2);
      if (px >= 0 && py >= 0 && px < img.w && py < img.h && img.data[py * img.w + px] !== ramp[0]) img.data[py * img.w + px] = ramp[0];
    }
  }
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + variant;
    const r = 2.5 + ((k + variant) % 3);
    const x0 = cx + Math.cos(a) * 4.5, y0 = cy + Math.sin(a) * 3.5 - 1;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const dd = x * x + y * y;
      if (dd > r * r) continue;
      const px = Math.round(x0 + x), py = Math.round(y0 + y);
      if (px < 0 || py < 0 || px >= img.w || py >= img.h) continue;
      const rim = dd > (r - 1) * (r - 1) && x + y > 0;      // outline on the shadow side only
      const hi = x + y < -r * 0.9;                           // warm highlight top-left
      img.data[py * img.w + px] = rim ? ramp[1] : hi ? ramp[ramp.length - 1] : x + y > r * 0.3 ? ramp[2] : ramp[3];
    }
  }
}

/** A chunky cloud with a lavender underside and its shadow cast down-left on the water. */
export function paintCloud(img: IndexImage, cx: number, cy: number, s: number, ground: Uint8Array | null) {
  const lobes = [[-1.2, 0.2, 0.9], [-0.3, -0.4, 1.15], [0.8, -0.1, 1], [1.6, 0.35, 0.7]].map(([x, y, r]) => [cx + x * s, cy + y * s, r * s]);
  const inside = (x: number, y: number) => lobes.some(([lx, ly, lr]) => (x - lx) ** 2 + (y - ly) ** 2 <= lr * lr) && y <= cy + 0.6 * s;
  const sh = { x: -0.9 * s, y: 1.3 * s };
  const x0 = Math.floor(cx - 3 * s), x1 = Math.ceil(cx + 3 * s), y0 = Math.floor(cy - 2 * s), y1 = Math.ceil(cy + 2.4 * s);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
    if (inside(x - sh.x, y - sh.y) && !inside(x, y)) {
      const i = y * img.w + x;
      const cur = img.data[i];
      // shadow: one step deeper on the ocean ramp (only on water)
      const oi = R.ocean.indexOf(cur);
      if (oi > 0 && (!ground || !ground[i])) img.data[i] = R.ocean[Math.max(0, oi - 2)];
    }
  }
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (x < 0 || y < 0 || x >= img.w || y >= img.h || !inside(x, y)) continue;
    const under = !inside(x, y + 2), edgeTop = !inside(x, y - 1) || !inside(x - 1, y);
    img.data[y * img.w + x] = under ? R.cloud[1] : !inside(x, y + 4) ? R.cloud[2] : edgeTop ? R.cloud[3] : R.cloud[3];
    if (!inside(x + 1, y) && !under) img.data[y * img.w + x] = R.cloud[2];
  }
}
