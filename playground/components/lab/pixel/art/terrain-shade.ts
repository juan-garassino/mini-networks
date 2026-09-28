// Terrain look-development for the pixel skin: a height field derived from the
// world (distance to coast + seeded hills + the world's mountain ranges),
// shaded by ONE key light from the top-left, quantised onto hue-shifted ramps
// with ordered dithering only at band seams. Pure functions + one renderer.
//
// Layers the renderer composes, bottom → top (all in palette indices):
//   deep ocean (flat indigo + sparse darker current spirals)
//   shallow halo (bright cyan, lighter swirl lines, foam dot line at the shore)
//   land cast shadow on the halo (down-right of every coast)
//   raised-slab cliff lip on south/east coasts (maroon face, foam at its foot)
//   land: elevation bands sand → biome ground → forest-able → rock → snow,
//         slope-lit faces on ridges, per-biome accents (dune ripples, lava
//         cracks, crystal glints, frost), procedural canopy clumps
//   cloud shadows (optional: indigo remap under each cloud, offset down-right)
//
// Resolution: ART_PER_TILE art px per world tile (default 8 → 1 art px = 2
// world px). The whole 132×99-tile world is 1056×792 art px.
import { T, type Box, type Pt, type SecretIsland, type World } from "@/lib/world";
import { biomeOf, CLEAR, RAMPS, SHADOW, type Biome, type RampName } from "./palette";
import { bayer4, ditherStep, fbm3f as fbm3, hash2, mulberry32, noise as valueNoise, ridgedf as ridged } from "./noise";
import { artBlank, artBlit, artToCanvas, type ArtImage } from "./raster";

export const ART_PER_TILE = 8;
const TILE = 16;

/** Top-left key light, in art-pixel xy (y down). Lit faces rise toward +x/+y. */
export const LIGHT = { x: -1, y: -1 } as const;

// ————————————————————————————— bands (elevation thresholds, h ∈ [0, 1]) —————————————————————————————
export const BANDS = {
  beach: 0.15,   // below: beach sand
  forest: 0.3,   // forest-able from here …
  forestTop: 0.6, // … to here
  rock: 0.64,    // highland rock from here
  snow: 0.85,    // snow caps from here
} as const;
const SEAM = 0.014; // half-width (in h) of the dithered seam at each band edge

// ————————————————————————————— pixel kernels —————————————————————————————

export interface LandSample {
  /** art-pixel coords (for dither/speckle) */
  x: number; y: number;
  /** elevation 0..1 */
  h: number;
  /** elevation gradient per art px */
  gx: number; gy: number;
  /** tile coords (for biome-scale noise) */
  tx: number; ty: number;
  biome: Biome;
  /** art px to the nearest water */
  dCoast: number;
  /** 1 when the pixel sits on a road/footprint/set-piece tile (keep it quiet) */
  civic: number;
  /** 0..1 proximity to a world.mountains border ridge (1 on the crest); optional */
  ridge?: number;
  seed: number;
}

const rampOf = (name: RampName) => RAMPS[name];

/** Slope light term in ramp steps: + on faces turned to the top-left light. */
export function slopeLight(gx: number, gy: number, gain = 26): number {
  const s = (gx * -LIGHT.x + gy * -LIGHT.y) * gain; // gx+gy > 0 ⇒ faces up-left
  return Math.max(-2, Math.min(2, s));
}

/** Pick a band with an ordered-dither seam around each threshold. */
function bandOf(h: number, x: number, y: number): 0 | 1 | 2 | 3 {
  const b = bayer4(x, y);
  const past = (t: number) => (Math.abs(h - t) < SEAM ? b < (h - t + SEAM) / (2 * SEAM) : h >= t);
  if (past(BANDS.snow)) return 3;
  if (past(BANDS.rock)) return 2;
  if (past(BANDS.beach)) return 1;
  return 0;
}

/** Land kernel: one art pixel → palette index. */
export function shadeLand(p: LandSample): number {
  const { x, y, h, biome, tx, ty, seed } = p;
  const quiet = p.civic > 0.25;                          // roads / footprints: keep it calm
  const lit = slopeLight(p.gx, p.gy) * (quiet ? 0.4 : 1);
  let band = bandOf(h, x, y);
  if (quiet && band > 1) band = 1;
  const speck = hash2(x, y, seed ^ 0x51ed);
  const D = 0.035;                                       // narrow seams → crisp clusters
  // cluster warp: shifts every step boundary along an organic contour, so
  // flat ground breaks into hand-placed-looking clusters instead of wide dither
  const warp = (valueNoise(tx, ty, seed ^ 0xc1, 0.9) - 0.5) * 0.7;

  if (band === 0) {
    // beach / lowland: pale sand, lighter lip on lit (north/west) shores
    const r = rampOf(biome.low);
    const top = r.length - 1;
    let v = biome.low === "sand" ? 4 : biome.low === "rock" ? 2 : top - 1;
    if (p.dCoast <= 1.5) v += 1;                        // bright wet-sand/lip line
    v += lit * 0.5 + warp * 0.5;
    if (speck < 0.025) v -= 1;                          // darker dither dots
    return r[Math.max(0, Math.min(top, ditherStep(v, x, y, D)))];
  }
  if (band === 1) {
    const r = rampOf(biome.mid);
    const top = r.length - 1;
    // ground drifts one step darker with altitude (cool shade up the hills)
    const alt = (h - BANDS.beach) / (BANDS.rock - BANDS.beach);
    let v = midBase(biome) - alt * 0.9 + lit * 1.1 + warp;
    // biome texture
    switch (biome.key) {
      case "dunes": {
        // long wavy dune crests: a lit crest line with a cool shadow line under it
        const rip = (ty * 1.25 + tx * 0.2 + 1.9 * valueNoise(tx, ty, seed ^ 0x77, 2.6)) * 1.1;
        const f = rip - Math.floor(rip);
        const on = !quiet && valueNoise(tx, ty, seed ^ 0x78, 3.5) > 0.5;
        if (on && f < 0.06) v += 0.8;
        else if (on && f < 0.12) v -= 1;
        else if (speck < 0.015) v -= 1;
        break;
      }
      case "savanna":
        if (speck < 0.02) v -= 1.2; else if (speck > 0.99) v += 1;   // dry shrubs / straw glints
        break;
      case "volcanic": {
        const c = ridged(tx, ty, seed ^ 0x1a7a, 6);
        if (c > 0.978 && !quiet && alt > 0.3 && valueNoise(tx, ty, seed ^ 0x1a7b, 2) > 0.55) return lavaAt(x, y, c); // glowing cracks, broken, uplands only
        if (speck < 0.03) v -= 1;
        break;
      }
      case "crystal":
        if (speck > 0.994 && !quiet) return RAMPS.magic[2];            // glints
        if (speck < 0.02) v -= 1;
        break;
      case "ice":
        if (speck > 0.99) v += 1.5;
        break;
      default:
        if (speck < 0.018) v -= 1; else if (speck > 0.992) v += 1;
    }
    return r[Math.max(0, Math.min(top, ditherStep(v, x, y, D)))];
  }
  if (band === 2) {
    const r = rampOf(biome.high);
    const top = r.length - 1;
    // faceted ridges: lit face up to 2 steps up, shadow face 2 steps down
    let v = Math.round(top * 0.55) + lit * 1.4 - (h - BANDS.rock) * 2 + warp * 0.6;
    if (speck < 0.03) v -= 1;
    return r[Math.max(0, Math.min(top, ditherStep(v, x, y, D)))];
  }
  // snow caps: lavender shadow faces, warm-white lit faces; volcanic peaks glow
  if (biome.peak !== "snow" && biome.peak !== "lava") {
    // no snow in hot biomes: the high ramp's lit top
    const r = rampOf(biome.peak);
    const top = r.length - 1;
    return r[Math.max(0, Math.min(top, ditherStep(top - 1.3 + lit * 1.5, x, y, D)))];
  }
  if (biome.peak === "lava") {
    // ash cones: dark rock faces, a small glowing crater only at the very top
    if (h > 0.975 && !quiet && (p.ridge ?? 0) < 0.15) return lavaAt(x, y, h);
    const r = RAMPS.rock;
    return r[Math.max(0, Math.min(r.length - 1, ditherStep(1.8 + lit * 1.6 + warp * 0.5, x, y, D)))];
  }
  const r = RAMPS.snow;
  const v = 4 + lit * 1.5;
  return r[Math.max(1, Math.min(r.length - 1, ditherStep(v, x, y, D)))];
}

function midBase(b: Biome): number {
  switch (b.key) {
    case "meadow": return 4.3;     // #5cc23f
    case "savanna": return 3.5;
    case "dunes": return 3.6;      // sand #e2a562 → #efc27c
    case "volcanic": return 2.6;   // rust brown
    case "ice": return 2.8;
    case "crystal": return 3.2;
    default: return 3.5;
  }
}

function lavaAt(x: number, y: number, c: number): number {
  const r = RAMPS.lava;
  const k = hash2(x, y, 0x1a5a);
  return k < 0.12 ? r[3] : c > 0.985 || k < 0.55 ? r[2] : r[1];
}

export interface WaterSample {
  x: number; y: number;
  /** art px to nearest land (0 on land) */
  dLand: number;
  /** halo width here (art px), already noise-modulated */
  halo: number;
  /** tile coords */
  tx: number; ty: number;
  seed: number;
  /** biome of the nearest land (lava shallows off volcanic coasts) */
  near: Biome | null;
}

/** Water kernel: deep ocean / shallow halo / swirl lines / foam dots. */
export function shadeWater(p: WaterSample): number {
  const { x, y, dLand, halo, seed, tx, ty } = p;
  const s = RAMPS.shallow, o = RAMPS.ocean, f = RAMPS.foam;
  if (dLand <= 1.01) {
    // foam dot line right at the shore
    return hash2(x, y, seed ^ 0xf0a) < 0.72 ? f[1] : f[0];
  }
  if (dLand <= halo) {
    if (dLand <= 2.5) return s[5];
    // a second, broken line of foam dots
    if (dLand > 3.2 && dLand <= 4.2 && hash2(x, y, seed ^ 0xf0b) < 0.28) return f[0];
    // lava / coral warm patch in volcanic shallows
    if (p.near?.key === "volcanic" && dLand < halo * 0.55 && valueNoise(tx, ty, seed ^ 0xc0, 2.5) > 0.72) {
      return hash2(x, y, seed ^ 3) < 0.5 ? RAMPS.lava[2] : RAMPS.lava[1];
    }
    // swirl / wave lines: contours of a warped distance, broken by a noise mask
    const warp = 6 * valueNoise(tx, ty, seed ^ 0x5a1, 2.6);
    const c = (dLand + warp) / 6.5;
    const onLine = c - Math.floor(c) < 0.14;
    if (onLine && dLand > 4.5 && dLand < halo - 2.5 && valueNoise(tx, ty, seed ^ 0x77e, 1.6) > 0.46) return s[5];
    // outer rim of the halo: two darker blue steps, dithered into the deep
    const edge = halo - dLand;
    if (edge < 1.5) return bayer4(x, y) < 0.5 ? s[1] : o[4];
    if (edge < 3) return s[2];
    return s[3];
  }
  return o[3];
}

// ————————————————————————————— fields —————————————————————————————

/** Two-pass chamfer (1, √2) distance to the nearest pixel where src[i] === 1. */
export function chamfer(src: Uint8Array, w: number, h: number, cap = 1e5): Float32Array {
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = src[i] ? 0 : cap;
  const D = Math.SQRT2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    let v = d[i];
    if (v === 0) continue;
    if (x > 0) v = Math.min(v, d[i - 1] + 1);
    if (y > 0) {
      v = Math.min(v, d[i - w] + 1);
      if (x > 0) v = Math.min(v, d[i - w - 1] + D);
      if (x < w - 1) v = Math.min(v, d[i - w + 1] + D);
    }
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    let v = d[i];
    if (v === 0) continue;
    if (x < w - 1) v = Math.min(v, d[i + 1] + 1);
    if (y < h - 1) {
      v = Math.min(v, d[i + w] + 1);
      if (x < w - 1) v = Math.min(v, d[i + w + 1] + D);
      if (x > 0) v = Math.min(v, d[i + w - 1] + D);
    }
    d[i] = v;
  }
  return d;
}

export interface TerrainOptions {
  /** art px per world tile (default 8). */
  artPerTile?: number;
  /** "grid" = the tile grid only; "all" = grid ∪ camera.all (includes both secret islands). */
  extent?: "grid" | "all";
  seed?: number;
  /** cloud shadows to bake (art-px top-left of the CLOUD sprite + its mask); see bakeCloudShadows. */
  clouds?: { x: number; y: number; img: ArtImage }[];
  /** procedural canopy clumps on forest-able ground (default true). */
  canopies?: boolean;
}

export interface TerrainArt {
  img: ArtImage;
  /** world px of art pixel (0, 0)'s top-left corner. */
  origin: Pt;
  /** world px per art px (TILE / artPerTile). */
  px: number;
  artPerTile: number;
  /** elevation per art px (0 on water). */
  height: Float32Array;
  /** 1 land, 0 water (sea or river). */
  land: Uint8Array;
  /** region id per art px (-1 water, -2 hidden island, -3 ruins islet). */
  region: Int8Array;
  /** ms spent per phase (look-dev perf). */
  timings: Record<string, number>;
}

const HIDDEN_BIOME: Biome = { key: "crystal", name: "unknown isle", low: "stone", mid: "stone", high: "stone", peak: "magic", forest: "pine", canopy: 0.1, accent: "magic" };
const RUINS_BIOME: Biome = { key: "dunes", name: "ruins islet", low: "sand", mid: "sand", high: "stone", peak: "snow", forest: "olive", canopy: 0.05, accent: "stone" };

/** Convert a world-px point to art-px in a TerrainArt frame. */
export const toArt = (t: Pick<TerrainArt, "origin" | "px">, p: Pt): Pt => ({ x: (p.x - t.origin.x) / t.px, y: (p.y - t.origin.y) / t.px });

function superellipse(island: SecretIsland, wx: number, wy: number): number {
  const b = island.box;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, rx = b.w / 2, ry = b.h / 2;
  return (Math.abs((wx - cx) / rx) ** 2.6 + Math.abs((wy - cy) / ry) ** 2.6) ** (1 / 2.6);
}

/** Full-world terrain in palette indices. Deterministic for a given world + seed. */
export function renderTerrain(world: World, opts: TerrainOptions = {}): TerrainArt {
  const t0 = performance.now();
  const timings: Record<string, number> = {};
  const lap = (k: string, since: number) => { timings[k] = Math.round(performance.now() - since); return performance.now(); };
  const apt = opts.artPerTile ?? ART_PER_TILE;
  const seed = opts.seed ?? 0x2b1d;
  const px = TILE / apt;
  const { cols, rows, terrain, regionOf } = world;

  // frame (world px)
  let frame: Box = { x: 0, y: 0, w: cols * TILE, h: rows * TILE };
  if (opts.extent === "all") {
    const a = world.camera.all;
    const x0 = Math.min(0, a.x), y0 = Math.min(0, a.y);
    const x1 = Math.max(frame.w, a.x + a.w), y1 = Math.max(frame.h, a.y + a.h);
    frame = { x: Math.floor(x0 / TILE) * TILE, y: Math.floor(y0 / TILE) * TILE, w: 0, h: 0 };
    frame.w = Math.ceil((x1 - frame.x) / TILE) * TILE;
    frame.h = Math.ceil((y1 - frame.y) / TILE) * TILE;
  }
  const W = Math.round(frame.w / px), H = Math.round(frame.h / px);
  const N = W * H;

  // ——— tile-level fields: landness (sea = 0; rivers count as land for the coast), river, civic
  const inGrid = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < cols && ty < rows;
  // padded tile fields (1-tile border) for branch-free bilinear lookups
  const PC = cols + 2, PR = rows + 2;
  const fLand = new Float32Array(PC * PR), fRiver = new Float32Array(PC * PR), fCivic = new Float32Array(PC * PR);
  for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) {
    const v = terrain[ty * cols + tx], k = (ty + 1) * PC + tx + 1;
    fLand[k] = v !== T.SEA ? 1 : 0;
    fRiver[k] = v === T.RIVER || v === T.BRIDGE ? 1 : 0;
    fCivic[k] = v === T.ROAD || v === T.FOOT || v === T.SETPIECE || v === T.BRIDGE ? 1 : 0;
  }
  const bilerp = (f: Float32Array, u: number, v: number) => {
    u += 1; v += 1;
    const x0 = Math.floor(u), y0 = Math.floor(v);
    const fx = u - x0, fy = v - y0;
    if (x0 < 0 || y0 < 0 || x0 >= PC - 1 || y0 >= PR - 1) return 0;
    const k = y0 * PC + x0;
    const a = f[k], b = f[k + 1], c = f[k + PC], d = f[k + PC + 1];
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  };

  const land = new Uint8Array(N);
  const river = new Uint8Array(N);
  const civic = new Float32Array(N);
  const region = new Int8Array(N).fill(-1);
  const TX = new Float32Array(W), TY = new Float32Array(H);
  for (let x = 0; x < W; x++) TX[x] = (frame.x + (x + 0.5) * px) / TILE;
  for (let y = 0; y < H; y++) TY[y] = (frame.y + (y + 0.5) * px) / TILE;

  let t = performance.now();
  for (let y = 0; y < H; y++) {
    const ty = TY[y];
    for (let x = 0; x < W; x++) {
      const tx = TX[x];
      const i = y * W + x;
      const n = valueNoise(tx, ty, seed ^ 0x3c0a, 1.3) - 0.5;
      const tix = Math.floor(tx), tiy = Math.floor(ty);
      if (inGrid(tix, tiy)) {
        const L = bilerp(fLand, tx - 0.5, ty - 0.5) + n * 0.34;
        if (L > 0.5) {
          land[i] = 1;
          const R = bilerp(fRiver, tx - 0.5, ty - 0.5) + n * 0.2;
          if (R > 0.42) { river[i] = 1; }
          civic[i] = bilerp(fCivic, tx - 0.5, ty - 0.5);
          // region lookup, domain-warped so family borders are organic
          const wx = tx + (valueNoise(tx, ty, seed ^ 0x11, 1.6) - 0.5) * 1.1;
          const wy = ty + (valueNoise(tx, ty, seed ^ 0x22, 1.6) - 0.5) * 1.1;
          let r = inGrid(Math.floor(wx), Math.floor(wy)) ? regionOf[Math.floor(wy) * cols + Math.floor(wx)] : -1;
          if (r < 0) r = regionOf[tiy * cols + tix];
          if (r < 0) {
            for (let k = 0; k < 8 && r < 0; k++) {
              const ax = tix + [1, -1, 0, 0, 1, 1, -1, -1][k], ay = tiy + [0, 0, 1, -1, 1, -1, 1, -1][k];
              if (inGrid(ax, ay)) r = regionOf[ay * cols + ax];
            }
          }
          region[i] = r;
        }
      } else {
        const wx = frame.x + (x + 0.5) * px, wy = frame.y + (y + 0.5) * px;
        for (const [isl, id] of [[world.hiddenIsland, -2], [world.ruinsIsland, -3]] as const) {
          if (superellipse(isl, wx, wy) + n * 0.12 < 1) { land[i] = 1; region[i] = id; }
        }
      }
    }
  }
  t = lap("masks", t);

  // ——— distance fields (art px)
  const water = new Uint8Array(N);
  for (let i = 0; i < N; i++) water[i] = land[i] && !river[i] ? 0 : 1;
  const seaOnly = new Uint8Array(N);
  for (let i = 0; i < N; i++) seaOnly[i] = land[i] ? 0 : 1;
  const dCoast = chamfer(seaOnly, W, H);            // land px → sea
  const dLand = chamfer(land, W, H);                 // sea px → land
  const ridgeSrc = new Uint8Array(N);
  for (const line of world.mountains) {
    for (let k = 0; k + 1 < line.length; k++) {
      const a = toArt({ origin: frame, px }, line[k]), b = toArt({ origin: frame, px }, line[k + 1]);
      const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
      for (let s = 0; s <= steps; s++) {
        const u = steps ? s / steps : 0;
        const xx = Math.round(a.x + (b.x - a.x) * u), yy = Math.round(a.y + (b.y - a.y) * u);
        if (xx >= 0 && yy >= 0 && xx < W && yy < H) ridgeSrc[yy * W + xx] = 1;
      }
    }
  }
  const dRidge = chamfer(ridgeSrc, W, H);
  const civSrc = new Uint8Array(N);
  for (let i = 0; i < N; i++) civSrc[i] = civic[i] > 0.2 ? 1 : 0;
  const dCiv = chamfer(civSrc, W, H);
  void water;
  t = lap("distance", t);

  // ——— elevation
  const height = new Float32Array(N);
  const biomes: Biome[] = world.regions.map((r) => biomeOf(r.family));
  const biomeAt = (i: number): Biome => (region[i] === -2 ? HIDDEN_BIOME : region[i] === -3 ? RUINS_BIOME : biomes[region[i]] ?? biomes[0]);
  for (let y = 0; y < H; y++) {
    const ty = TY[y];
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!land[i]) continue;
      const tx = TX[x];
      const dc = dCoast[i] / apt;                          // tiles to the sea
      const base = 1 - Math.exp(-dc / 2.6);
      const hills = fbm3(tx, ty, seed ^ 0x4111, 7) - 0.5;
      const b = biomeAt(i);
      const lift = b.key === "ice" ? 0.1 : b.key === "crystal" ? 0.05 : 0;
      let h = 0.09 + 0.38 * base + 0.42 * hills * base + lift * base;
      // mountain ranges along family borders: a sharp ridged crest
      const dr = dRidge[i] / apt;
      if (dr < 3.2) {
        const k = 1 - dr / 3.2;
        const crest = ridged(tx, ty, seed ^ 0x9d, 2.2);
        h += (0.62 + 0.3 * crest) * k * k * Math.min(1, dc / 0.8);
      }
      // massifs: highlands rise only in the WILD land away from roads and
      // footprints (so nodes sit on calm ground), faceted by ridged detail
      const dv = dCiv[i] / apt + (valueNoise(tx, ty, seed ^ 0x77a, 2.5) - 0.5) * 2.4;
      const wild = dv <= 1 ? 0 : dv >= 4.5 ? 1 : ((dv - 1) / 3.5) ** 2 * (3 - 2 * ((dv - 1) / 3.5));
      if (wild > 0) {
        const m = Math.max(0, fbm3(tx, ty, seed ^ 0x5151, 9) - 0.4) * 2.6;
        const facet = ridged(tx, ty, seed ^ 0x5152, 3.2) - 0.5;
        h += wild * base * (m * 0.62 + m * facet * 0.35);
      }
      height[i] = Math.max(0, Math.min(1, h));
    }
  }
  t = lap("height", t);

  // ——— shade every pixel
  const img = artBlank(W, H, RAMPS.ocean[3]);
  const out = img.data;
  const nearBiome = (x: number, y: number): Biome | null => {
    // cheap: sample 4 compass points 6 px out
    for (const [dx, dy] of [[0, -6], [0, 6], [-6, 0], [6, 0], [-4, -4], [4, 4]]) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < W && yy < H && land[yy * W + xx]) return biomeAt(yy * W + xx);
    }
    return null;
  };
  const haloBase = apt * 2.3;
  const cliffH = Math.max(3, Math.round(apt * 0.5));
  const isLand = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && land[y * W + x] === 1;
  for (let y = 0; y < H; y++) {
    const ty = TY[y];
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const tx = TX[x];
      if (land[i]) {
        if (river[i]) {
          // rivers: halo cyan with a shaded north bank and sparse glints
          const s = RAMPS.shallow;
          const bank = isLand(x, y - 1) && !river[i - W];
          const bankW = isLand(x - 1, y) && !river[i - 1];
          out[i] = bank || bankW ? s[1] : hash2(x, y, seed ^ 0xabc) < 0.04 ? s[5] : ((x + 2 * y) % 11 === 0 ? s[4] : s[3]);
          continue;
        }
        const gx = ((x < W - 1 && land[i + 1] ? height[i + 1] : height[i]) - (x > 0 && land[i - 1] ? height[i - 1] : height[i])) / 2;
        const gy = ((y < H - 1 && land[i + W] ? height[i + W] : height[i]) - (y > 0 && land[i - W] ? height[i - W] : height[i])) / 2;
        out[i] = shadeLand({ x, y, h: height[i], gx, gy, tx, ty, biome: biomeAt(i), dCoast: dCoast[i], civic: civic[i], ridge: Math.max(0, 1 - dRidge[i] / (apt * 3.2)), seed });
        continue;
      }
      // ——— water
      // raised slab: cliff face below south coasts / right of east coasts
      let southRun = 0;
      for (let k = 1; k <= cliffH; k++) if (isLand(x, y - k)) { southRun = k; break; }
      if (southRun) {
        const r = RAMPS.cliff;
        out[i] = southRun === 1 ? r[3] : southRun === cliffH ? r[1] : r[2];
        // vertical strata: an occasional darker seam
        if (southRun > 1 && hash2(x, 0, seed ^ 0x5ea) < 0.18) out[i] = r[1];
        continue;
      }
      if (isLand(x - 1, y) || (isLand(x - 2, y) && isLand(x - 2, y - 1))) {
        out[i] = isLand(x - 1, y) ? RAMPS.cliff[1] : RAMPS.cliff[0];
        continue;
      }
      // foam where the cliff meets the water
      if (isLand(x, y - cliffH - 1) && !isLand(x, y - 1)) {
        out[i] = hash2(x, y, seed ^ 0xfa) < 0.75 ? RAMPS.foam[1] : RAMPS.foam[0];
        continue;
      }
      const halo = haloBase * (0.75 + 0.5 * valueNoise(tx, ty, seed ^ 0x6a10, 4));
      const d = dLand[i];
      out[i] = shadeWater({ x, y, dLand: d, halo, tx, ty, seed, near: d < halo ? nearBiome(x, y) : null });
    }
  }
  t = lap("shade", t);

  // ——— land cast shadow on the water: down-right of every coast (skip foam + cliff)
  const shadowLen = Math.max(3, Math.round(apt * 0.6));
  const cliffIdx = new Set<number>(RAMPS.cliff);
  const foamIdx = new Set<number>(RAMPS.foam);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (land[i] || cliffIdx.has(out[i]) || foamIdx.has(out[i])) continue;
    for (let j = 1; j <= shadowLen; j++) {
      // south coasts: below the cliff, drifting right; east coasts: right of the face
      if (isLand(x - j, y - cliffH - j) || isLand(x - 2 - j, y - j)) { out[i] = SHADOW[out[i]]; break; }
    }
  }

  // ——— deep-ocean current spirals: sparse, 1 px, darker indigo
  const rnd = mulberry32(seed ^ 0xc0ffee);
  const spirals = Math.round((W * H) / 60000);
  const ocean = RAMPS.ocean;
  for (let s = 0; s < spirals * 4 && s < 400; s++) {
    const cx = rnd() * W, cy = rnd() * H;
    const ci = Math.floor(cy) * W + Math.floor(cx);
    if (land[ci] || dLand[ci] < haloBase * 1.25 + 14) continue;
    const turns = 1.1 + rnd() * 1.1, a0 = rnd() * Math.PI * 2, dir = rnd() < 0.5 ? 1 : -1;
    const grow = 1.1 + rnd() * 0.9;
    let ok = true;
    const pts: number[] = [];
    for (let th = 0; th < turns * Math.PI * 2; th += 0.08) {
      const r = 1.5 + grow * th;
      const xx = Math.round(cx + Math.cos(a0 + dir * th) * r), yy = Math.round(cy + Math.sin(a0 + dir * th) * r * 0.8);
      if (xx < 0 || yy < 0 || xx >= W || yy >= H || out[yy * W + xx] !== ocean[3]) { ok = false; break; }
      pts.push(yy * W + xx);
    }
    // a trailing current line off the spiral's outer end
    if (ok) {
      const th = turns * Math.PI * 2, r = 1.5 + grow * th;
      let xx = cx + Math.cos(a0 + dir * th) * r, yy = cy + Math.sin(a0 + dir * th) * r * 0.8;
      const len = 10 + rnd() * 18;
      for (let k = 0; k < len; k++) {
        xx += 1; yy += Math.sin(k / 4) * 0.35;
        const xi = Math.round(xx), yi = Math.round(yy);
        if (xi < 0 || yi < 0 || xi >= W || yi >= H || out[yi * W + xi] !== ocean[3]) break;
        pts.push(yi * W + xi);
      }
      for (const p of pts) out[p] = ocean[2];
    }
  }
  t = lap("water-fx", t);

  // ——— procedural canopy clumps (forest-able band, off roads, per-biome density)
  if (opts.canopies !== false) {
    const step = Math.max(4, Math.round(apt * 0.62));
    const cand: { x: number; y: number; r: number; b: Biome }[] = [];
    for (let gy = 0; gy < H; gy += step) for (let gx = 0; gx < W; gx += step) {
      const x = Math.floor(gx + hash2(gx, gy, seed ^ 0x7e1) * step);
      const y = Math.floor(gy + hash2(gx, gy, seed ^ 0x7e2) * step);
      if (x >= W || y >= H) continue;
      const i = y * W + x;
      if (!land[i] || river[i] || civic[i] > 0.02 || dCoast[i] < 4) continue;
      const h = height[i];
      if (h < BANDS.forest || h > BANDS.forestTop) continue;
      const b = biomeAt(i);
      const dens = valueNoise(TX[x], TY[y], seed ^ 0xf0e5, 5);
      if (dens < 1 - b.canopy) continue;
      // clear of other civic pixels in the canopy's radius
      const r = hash2(x, y, seed ^ 0x3) < 0.7 ? 3 : 2;
      let clear = true;
      for (let dy = -r - 1; dy <= r + 1 && clear; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) { clear = false; break; }
        const j = yy * W + xx;
        if (!land[j] || river[j] || civic[j] > 0.02) { clear = false; break; }
      }
      if (clear) cand.push({ x, y, r, b });
    }
    cand.sort((a, b) => a.y - b.y || a.x - b.x);
    for (const c of cand) stampCanopy(img, c.x, c.y, c.r, c.b);
  }
  lap("canopy", t);

  if (opts.clouds) for (const c of opts.clouds) bakeCloudShadow(img, c.img, c.x, c.y);

  timings.total = Math.round(performance.now() - t0);
  return { img, origin: { x: frame.x, y: frame.y }, px, artPerTile: apt, height, land, region, timings };
}

/** One round canopy (or pine / acacia by biome) shaded by the top-left light. */
export function stampCanopy(img: ArtImage, cx: number, cy: number, r: number, b: Biome) {
  const ramp = RAMPS[b.forest];
  const top = ramp.length - 1;
  const put = (x: number, y: number, v: number) => {
    if (x >= 0 && y >= 0 && x < img.w && y < img.h) img.data[y * img.w + x] = v;
  };
  const get = (x: number, y: number) => (x >= 0 && y >= 0 && x < img.w && y < img.h ? img.data[y * img.w + x] : CLEAR);
  if (b.forest === "pine") {
    // pine: stacked triangle, lit left flank, dark right, trunk
    const hgt = r * 2 + 2;
    for (let dy = 0; dy <= hgt; dy++) {
      const half = Math.floor((dy / hgt) * (r + 0.6));
      for (let dx = -half; dx <= half; dx++) {
        const edge = dx === half || dy === hgt;
        put(cx + dx, cy - r - 1 + dy, edge ? ramp[0] : dx < 0 ? ramp[top - (dy % 3 === 0 ? 1 : 0)] : ramp[2]);
      }
    }
    put(cx + 1, cy + r + 2, SHADOW[get(cx + 1, cy + r + 2)]);
    put(cx, cy + r + 2, RAMPS.wood[1]);
    return;
  }
  const ry = b.forest === "olive" ? Math.max(1, r - 1) : r;   // acacias sit flatter
  const rx = b.forest === "olive" ? r + 1 : r;
  // ground shadow down-right
  for (let dy = -ry; dy <= ry + 1; dy++) for (let dx = -rx; dx <= rx + 1; dx++) {
    const ex = (dx - 1) / (rx + 0.5), ey = (dy - 1) / (ry + 0.5);
    if (ex * ex + ey * ey <= 1) { const v = get(cx + dx, cy + dy); if (v !== CLEAR) put(cx + dx, cy + dy, SHADOW[v]); }
  }
  for (let dy = -ry - 1; dy <= ry + 1; dy++) for (let dx = -rx - 1; dx <= rx + 1; dx++) {
    const ex = dx / (rx + 0.5), ey = dy / (ry + 0.5);
    const d2 = ex * ex + ey * ey;
    if (d2 > 1) {
      // selective outline: only on the shadow (bottom/right) side
      const ex2 = (dx - Math.sign(dx)) / (rx + 0.5), ey2 = (dy - Math.sign(dy)) / (ry + 0.5);
      if ((dx > 0 || dy > 0) && ex2 * ex2 + ey2 * ey2 <= 1 && dx + dy > 0) put(cx + dx, cy + dy, ramp[0]);
      continue;
    }
    // light: brighter toward the top-left
    const l = -(ex + ey) * 0.7 + (1 - d2) * 0.35;
    let v = 2.6 + l * 2.2;
    if (d2 > 0.62 && dx + dy > 0) v = Math.min(v, 1.4);
    put(cx + dx, cy + dy, ramp[Math.max(1, Math.min(top, ditherStep(v, cx + dx, cy + dy, 0.12)))]);
  }
  // 1–2 px specular dot on the lit shoulder
  put(cx - Math.ceil(rx / 2), cy - Math.ceil(ry / 2), ramp[top]);
}

/**
 * Darken everything under a cloud's silhouette, offset down (and a touch
 * right) — the key light is top-left and high. Call BEFORE drawing the cloud.
 */
export const CLOUD_SHADOW_OFFSET = { x: 5, y: 14 } as const;
export function bakeCloudShadow(dst: ArtImage, cloud: ArtImage, x: number, y: number) {
  const ox = Math.round(x + CLOUD_SHADOW_OFFSET.x), oy = Math.round(y + CLOUD_SHADOW_OFFSET.y);
  for (let sy = 0; sy < cloud.h; sy++) for (let sx = 0; sx < cloud.w; sx++) {
    if (cloud.data[sy * cloud.w + sx] === CLEAR) continue;
    const px = ox + sx, py = oy + sy;
    if (px < 0 || py < 0 || px >= dst.w || py >= dst.h) continue;
    const i = py * dst.w + px;
    dst.data[i] = SHADOW[dst.data[i]];
  }
}

/**
 * Specimen/look-dev helper: the full world (incl. both secret islands) with
 * clouds over the sea slots, painted to a canvas at integer `scale`.
 */
export function renderTerrainPreview(
  world: World,
  scale = 1,
  cloud?: { imgs: ArtImage[] },
  opts: TerrainOptions = {},
): { canvas: HTMLCanvasElement; art: TerrainArt } {
  const pre = renderTerrain(world, { extent: "all", ...opts });
  if (cloud && cloud.imgs.length) {
    const spots = cloudSpots(world, pre, cloud.imgs);
    for (const s of spots) bakeCloudShadow(pre.img, s.img, s.x, s.y);
    for (const s of spots) artBlit(pre.img, s.img, s.x, s.y);
  }
  return { canvas: artToCanvas(pre.img, scale), art: pre };
}

/** Deterministic cloud placements: one per sea slot + one half-hiding the "?" island. */
export function cloudSpots(world: World, art: TerrainArt, imgs: ArtImage[]): { x: number; y: number; img: ArtImage }[] {
  const out: { x: number; y: number; img: ArtImage }[] = [];
  world.seaSlots.forEach((s, k) => {
    const img = imgs[k % imgs.length];
    const c = toArt(art, { x: s.x + s.w / 2, y: s.y + s.h / 2 });
    out.push({ x: Math.round(c.x - img.w / 2), y: Math.round(c.y - img.h / 2 - 6), img });
  });
  const hid = world.hiddenIsland.box;
  const img = imgs[0];
  const c = toArt(art, { x: hid.x + hid.w * 0.7, y: hid.y + hid.h * 0.2 });
  out.push({ x: Math.round(c.x - img.w / 2), y: Math.round(c.y - img.h / 2), img });
  return out;
}
