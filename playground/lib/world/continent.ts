// Continent v3 — a DESIGNED map instead of grown blobs, recreating the
// owner's reference (playground/.lab-shots/refs/map-reference.png, "The Model
// Zoo"), adapted to the live taxonomy. Everything is authored once in a
// 150×100 frame (3:2, the reference's aspect; 1 unit = 10.24 reference px)
// and scaled to the tile grid, so the geography is the same at every data
// size; only the family BORDERS move with the data (areas ∝ model counts).
//
//   representation  the snowy range across the top-centre (+ SimCLR's foothills)
//   perception      the whole west: forest (NW), medieval towns (centre-west),
//                   a dry wild-west plateau (SW, tabular_classifier)
//   sequence        the centre and north-east: transformer's cathedral
//                   (centre-north), ancient ruins (centre), a desert plateau
//                   (NE, mamba)
//   generative      the southern volcanic lobe (diffusion, pixelcnn, vae, gan)
//   decision        the eastern green upland (alphazero, the village) + a
//                   SUNKEN CITY on the seabed of the south-east bay
//                   (reinforce, rl_maze) — `Region.underwater`
//   structure       a separate FLOATING island in the top-right corner
//                   (gnn, nerf) — `Region.floating`
//
// Pipeline (deterministic): continent outline (+ domain-warp coast noise) →
// land mask sized so land ≈ Σ land targets; family skeletons → additively
// weighted geodesic growth over the land (every front advances at the same
// pace, so no region races along a coast), head starts iterated until areas
// match; seabed families then grow part of their area into the bay; islet
// families (no cross-family edge) grow as floating islands.
import type { BorderKind, IsletKind, Pt, ZoneKind } from "./types.ts";
import { MinHeap } from "./grid.ts";
import { fbm, fnv1a } from "./rng.ts";

type XY = [number, number];

/** Authoring frame (units): 3:2 like both references (1 unit = 10.24 reference px). */
export const FRAME_W = 150;
export const FRAME_H = 100;

export type PresetName = "pixel" | "paper";

/** One authored geography. Every coordinate is in frame units. */
export interface Preset {
  /** the continent's coast, clockwise (before noise). */
  outline: XY[];
  /** the sea pocket whose seabed holds the SEABED families' underwater part. */
  bay: XY[];
  /** where islet families float (their island grows inside this, from the anchors). */
  floatIsland: XY[];
  floatAnchors: XY[];
  /** decorative islets [x, y, radius, kind]. */
  islets: [number, number, number, IsletKind][];
  /** region spines: each region grows outward from its polyline. */
  skeletons: Record<string, XY[]>;
  /** families whose region continues onto the bay's seabed (share of the target) along a spine from their coast. */
  seabed: Record<string, { share: number; spine: XY[] }>;
  /** where the reference labels each atom — placement pulls atoms here. */
  atomAnchors: Record<string, XY>;
  /** where the reference draws each region's landmark (the set-piece). */
  setPieceAnchors: Record<string, XY>;
  /** biome sub-zones. */
  zones: { family: string; zone: ZoneKind; poly: XY[] }[];
  /** unknown (future) land families take these spots in order. */
  spare: XY[];
  /** border kind per sorted family pair "a|b" (unlisted: "range"; a strait must run coast to coast, else it is a river). */
  borders: Record<string, BorderKind>;
  /**
   * every family pair joined by a cross-family edge must share a border
   * (pixel). false = a bridge road may cross a third land on the way (paper:
   * Perception and Generative sit at opposite corners).
   */
  requireAdjacent: boolean;
}

// ── PIXEL: .lab-shots/refs/map-reference.png ("The Model Zoo", pixel) ──────
//   representation  the snowy range across the top-centre (+ SimCLR's foothills)
//   perception      the whole west: forest (NW), medieval towns (centre-west),
//                   a dry wild-west plateau (SW, tabular_classifier)
//   sequence        the centre and north-east: transformer's cathedral
//                   (centre-north), ancient ruins (centre), a desert plateau (NE, mamba)
//   generative      the southern volcanic lobe (diffusion, pixelcnn, vae, gan)
//   decision        the eastern green upland (alphazero, the village) + a
//                   SUNKEN CITY on the seabed of the south-east bay (reinforce, rl_maze)
//   structure       a separate FLOATING island in the top-right corner (gnn, nerf)
const PIXEL_FLOAT: XY[] = [
  [110, 10], [117, 5], [128, 4], [138, 6], [145, 10], [146, 17], [142, 24], [136, 30], [129, 34], [121, 32], [115, 26], [110, 18],
];
export const PIXEL: Preset = {
  outline: [
    [12, 41], [14, 34], [20, 29], [28, 25], [34, 19], [39, 11], [45, 5], [52, 7], [57, 13], // Perception's forest, NW
    [63, 9], [70, 4], [80, 5], [90, 7], [98, 9], [102, 15], [103, 24], // Representation's snowy range
    [107, 30], [113, 34], // Sequence's desert plateau (NE)
    [120, 34], [128, 34], [136, 37], [143, 43], [146, 51], [145, 58], [139, 62], // Decision's village land (E)
    [129, 60], [119, 58], [111, 58], [105, 62], [101, 67], // the bay's north shore (sunken city below)
    [104, 74], [106, 84], [101, 93], [92, 98], [80, 98.5], [70, 98], [61, 95], [54, 90], // the volcanic lobe
    [46, 88], [36, 88], [25, 87], [18, 82], [17, 73], [21, 66], [28, 63], [36, 59], // the wild-west terrace
    [34, 53], [27, 50], [19, 48], [13, 45], // the west inlet (sea serpent, pier), cutting in under the forest
  ],
  bay: [[105, 60], [112, 57], [124, 59], [136, 61], [146, 59], [149, 64], [149, 99], [112, 99], [104, 92], [106, 80], [102, 68]],
  floatIsland: PIXEL_FLOAT,
  floatAnchors: [[128, 17], [22, 94]],
  islets: [
    [5, 30, 2.0, "lighthouse"], [27, 5, 1.4, "rock"], [7, 70, 1.5, "rock"], [12, 77, 1.2, "rock"], [6, 61, 1.6, "rock"],
    [16, 94, 1.8, "rock"], [29, 95, 1.3, "rock"], [42, 94, 1.2, "rock"], [107, 21, 1.6, "rock"], [147, 21, 1.6, "rock"],
    [145, 33, 1.3, "rock"], [148, 45, 1.3, "rock"], [110, 97, 1.4, "rock"], [138, 96, 1.2, "rock"], [148, 88, 1.2, "rock"],
  ],
  skeletons: {
    perception: [[46, 10], [38, 22], [26, 34], [40, 40], [54, 46], [42, 58], [30, 70], [40, 80]],
    representation: [[50, 24], [60, 15], [72, 9], [86, 10], [98, 14]],
    sequence: [[70, 33], [80, 40], [84, 54], [92, 45], [104, 34]],
    generative: [[60, 84], [72, 70], [86, 76], [80, 93]],
    decision: [[118, 42], [128, 46], [140, 54]],
  },
  seabed: { decision: { share: 0.45, spine: [[118, 60], [116, 70], [124, 77], [130, 84]] } },
  atomAnchors: {
    simclr: [50, 25], transformer: [73, 38], mamba: [96, 40], rnn: [86, 53],
    classifier: [55, 47], segmentation: [45, 62], tabular_classifier: [35, 79],
    pixelcnn: [83, 73], diffusion: [64, 85], vae: [71, 90], gan: [87, 89],
    alphazero: [123, 47], reinforce: [116, 70], rl_maze: [130, 83], gnn: [115, 15], nerf: [126, 28],
  },
  setPieceAnchors: {
    perception: [28, 35], representation: [74, 7], sequence: [80, 47], generative: [72, 64],
    decision: [133, 53], structure: [131, 12],
  },
  zones: [
    { family: "perception", zone: "forest", poly: [[30, 22], [40, 8], [54, 8], [60, 18], [58, 30], [50, 38], [40, 44], [14, 42], [20, 30]] },
    { family: "perception", zone: "town", poly: [[36, 42], [56, 36], [66, 44], [64, 58], [56, 64], [44, 68], [32, 64], [30, 54]] },
    { family: "perception", zone: "wildwest", poly: [[20, 66], [40, 64], [56, 68], [58, 80], [54, 88], [36, 89], [18, 84], [16, 74]] },
    { family: "representation", zone: "snow", poly: [[56, 18], [62, 9], [70, 4], [90, 6], [102, 12], [102, 28], [86, 30], [66, 30], [58, 28]] },
    { family: "sequence", zone: "cathedral", poly: [[64, 30], [80, 28], [84, 34], [82, 44], [70, 46], [64, 40]] },
    { family: "sequence", zone: "ruins", poly: [[70, 46], [84, 44], [98, 48], [102, 60], [88, 64], [72, 62], [66, 54]] },
    { family: "sequence", zone: "desert", poly: [[84, 30], [98, 26], [108, 30], [112, 38], [110, 52], [98, 52], [88, 44]] },
    { family: "generative", zone: "forge", poly: [[56, 62], [80, 60], [100, 64], [106, 78], [100, 94], [80, 99], [62, 96], [52, 88], [54, 74]] },
    { family: "decision", zone: "village", poly: [[114, 36], [128, 33], [142, 42], [146, 52], [144, 60], [128, 60], [114, 56]] },
    { family: "decision", zone: "underwater", poly: [[106, 62], [124, 60], [146, 62], [148, 78], [144, 92], [124, 94], [108, 88], [104, 72]] },
    { family: "structure", zone: "cyber", poly: PIXEL_FLOAT },
  ],
  spare: [[30, 80], [96, 20], [138, 50], [20, 40]],
  borders: {
    "perception|sequence": "river", // the rivers and waterfalls from the peaks down the middle
    "perception|representation": "range", // the snowline above the forest
    "representation|sequence": "range", // the cliffs under the range
    "decision|sequence": "strait", // the channel under the bridges to the village land
    "generative|sequence": "range", // the ruins' cliffs over the volcano
    "generative|perception": "range", // the terrace's edge (the rail line)
  },
  requireAdjacent: true,
};

// ── PAPER: .lab-shots/refs/paper-map-reference.png (storybook map) ─────────
//   perception      the north-west forest land (CNN tower, ResNet/ViT keeps, towns)
//   representation  the snowy mountain plateau, top-centre (SimCLR's crystal)
//   structure       a cluster of FLOATING islands, north-east (gnn, nerf)
//   sequence        the central green land of rivers and waterfalls:
//                   transformer's castle centre, rnn/mamba waterwheels
//   decision        the south-west Wild West desert plateau: cacti, rail line,
//                   alphazero's chessboard, rl_maze's hedge maze
//   generative      the south-east, three zones: the lava forge (gan), the
//                   neon city (diffusion), underwater domes on the seabed (vae, pixelcnn)
const PAPER_FLOAT: XY[] = [
  [110, 16], [118, 10], [130, 12], [142, 12], [148, 18], [146, 28], [142, 40], [145, 50], [136, 54], [126, 52], [116, 50],
  [112, 42], [116, 32], [110, 26],
];
export const PAPER: Preset = {
  outline: [
    [4, 26], [9, 18], [19, 14], [31, 15], [42, 16], [49, 20], // Perception's forest, north coast
    [51, 11], [57, 3], [67, 1], [79, 2], [91, 4], [100, 11], [103, 20], [101, 28], // the snowy plateau
    [104, 36], [107, 46], [104, 56], [97, 62], // Sequence's east shore
    [110, 63], [121, 65], [126, 72], [124, 82], [118, 92], [106, 97], [92, 98], [78, 97], [70, 92], // the forge + neon city
    [62, 92], [50, 94], [36, 93], [22, 92], [9, 88], [3, 80], [4, 68], [7, 60], // the Wild West plateau
    [4, 54], [2, 46], [2, 36], // Perception's west coast
  ],
  bay: [[112, 62], [124, 60], [136, 58], [149, 61], [149, 98], [118, 99], [114, 90], [124, 80], [124, 70]],
  floatIsland: PAPER_FLOAT,
  floatAnchors: [[128, 30], [20, 96]],
  islets: [
    [4, 8, 1.4, "rock"], [6, 64, 1.3, "rock"], [20, 97, 1.6, "rock"], [54, 98, 1.3, "rock"], [66, 98, 1.4, "rock"],
    [104, 5, 1.6, "rock"], [146, 58, 1.6, "rock"], [44, 60, 1.1, "rock"], [103, 12, 1.4, "floating"],
    [149, 56, 1.2, "floating"], [112, 57, 1.2, "floating"], [150, 6, 1.1, "floating"],
  ],
  skeletons: {
    perception: [[10, 30], [22, 26], [36, 24], [40, 36], [28, 44], [14, 50]],
    representation: [[56, 12], [68, 10], [82, 14], [96, 16], [90, 26]],
    sequence: [[48, 44], [62, 44], [80, 50], [98, 48], [86, 62]],
    decision: [[12, 70], [30, 72], [50, 74], [40, 86], [60, 84]],
    generative: [[78, 88], [96, 82], [112, 76], [118, 70]],
  },
  seabed: { generative: { share: 0.3, spine: [[124, 72], [132, 80], [140, 90]] } },
  atomAnchors: {
    classifier: [35, 38], segmentation: [18, 43], tabular_classifier: [13, 51],
    simclr: [80, 16], transformer: [79, 52], rnn: [56, 50], mamba: [98, 49],
    alphazero: [55, 72], reinforce: [14, 69], rl_maze: [38, 86],
    gan: [82, 88], diffusion: [99, 84], vae: [130, 80], pixelcnn: [138, 90],
    gnn: [115, 21], nerf: [137, 35],
  },
  setPieceAnchors: {
    perception: [14, 34], representation: [60, 10], sequence: [68, 44], generative: [106, 74],
    decision: [10, 62], structure: [123, 38],
  },
  zones: [
    { family: "perception", zone: "forest", poly: [[4, 25], [18, 14], [42, 16], [50, 24], [48, 40], [40, 50], [24, 56], [4, 54]] },
    { family: "representation", zone: "snow", poly: [[50, 12], [58, 2], [90, 3], [102, 12], [102, 28], [80, 30], [56, 28], [48, 22]] },
    { family: "sequence", zone: "meadow", poly: [[38, 32], [60, 30], [100, 30], [106, 44], [100, 60], [88, 68], [66, 66], [46, 60], [40, 46]] },
    { family: "sequence", zone: "cathedral", poly: [[72, 46], [88, 46], [88, 60], [72, 60]] },
    { family: "decision", zone: "wildwest", poly: [[4, 58], [30, 56], [56, 60], [70, 66], [68, 90], [50, 94], [20, 93], [4, 84]] },
    { family: "generative", zone: "forge", poly: [[70, 70], [92, 68], [98, 80], [96, 97], [72, 97], [68, 86]] },
    { family: "generative", zone: "cyber", poly: [[94, 64], [118, 62], [124, 72], [118, 88], [100, 90], [96, 78]] },
    { family: "generative", zone: "underwater", poly: [[118, 62], [149, 62], [149, 98], [116, 98], [114, 84]] },
    { family: "structure", zone: "sky", poly: PAPER_FLOAT },
  ],
  spare: [[30, 30], [80, 20], [60, 80], [110, 80]],
  borders: {
    "perception|sequence": "river", // the waterfalls between the forest and the river land
    "perception|representation": "strait", // the rope bridge up to the plateau
    "representation|sequence": "range", // the plateau's cliffs
    "decision|sequence": "range", // the desert's red cliffs
    "generative|sequence": "strait", // the long wooden bridge
    "decision|generative": "strait", // the rail bridge
    "decision|perception": "strait", // the south bridge
  },
  requireAdjacent: false,
};

export const PRESETS: Record<PresetName, Preset> = { pixel: PIXEL, paper: PAPER };

// Back-compat names (pixel preset) for skins that imported them.
export const OUTLINE = PIXEL.outline;
export const BAY = PIXEL.bay;
export const FLOAT_ISLAND = PIXEL.floatIsland;
export const ISLETS = PIXEL.islets;
export const SKELETONS = PIXEL.skeletons;
export const SEABED = PIXEL.seabed;
export const ATOM_ANCHORS = PIXEL.atomAnchors;
export const SETPIECE_ANCHORS = PIXEL.setPieceAnchors;
export const ZONES = PIXEL.zones;
export const BORDER_KINDS = PIXEL.borders;

// ── tunables (each commented) ───────────────────────────────────────────
/** coast domain-warp: amplitude and noise scale in frame units (capes and coves). */
const WARP_AMP = 2.4;
const WARP_SCALE = 8;
/** tile-level coast crinkle amplitude (frame units) at a ~3-tile scale. */
const CRINKLE_AMP = 0.9;
/** points per Catmull-Rom segment when smoothing the authored polygons. */
const SMOOTH_STEPS = 8;
/** tiles of guaranteed sea at the grid frame. */
const FRAME_SEA = 1;
/** growth-cost noise: borders meander instead of running straight. */
const BORDER_NOISE = 1.4;
const BORDER_NOISE_SCALE = 9;
/** head-start iterations for area matching; stop early once every region is within AREA_TOL. */
const AREA_ITERS = 24;
const AREA_TOL = 0.03;
/** sea gap (tiles, Chebyshev) between a floating island and anything else. */
export const FLOAT_MOAT = 3;
/** sea gap (tiles) between a seabed and another family's land. */
const SEABED_CLEAR = 2;
/** enclosed lakes smaller than this become land. */
const LAKE_FILL = 30;
/** islets closer than this (tiles) to other ground are dropped. */
const ISLET_GAP = 2;

export interface ContinentFamily {
  family: string;
  target: number;
  /** grows as a floating island (islet family). */
  floating: boolean;
}

export interface Continent {
  cols: number;
  rows: number;
  /** region index per tile (-1 sea); seabed tiles are sea with an owner. */
  regionOf: Int8Array;
  /** 1 = land (continent + floating islands), 0 = sea (incl. seabed). */
  land: Uint8Array;
  /** per region: part of it lies on the seabed. */
  underwater: boolean[];
  /** tile-coordinate polygons (unwarped, smoothed) for skins/artists. */
  outline: Pt[];
  bay: Pt[];
  islets: { kind: IsletKind; poly: Pt[] }[];
  zones: { family: string; zone: ZoneKind; poly: Pt[] }[];
  /** growth skeleton per region (tile coords), in region order. */
  skeletons: Pt[][];
}

/** Closed uniform Catmull-Rom through `pts`. */
export function smoothClosed(pts: XY[], steps = SMOOTH_STEPS): XY[] {
  const n = pts.length;
  const out: XY[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

/** Point-in-polygon accelerated by 1-unit row buckets of edges. */
function bucketed(poly: XY[]): (x: number, y: number) => boolean {
  const buckets: [number, number, number, number][][] = [];
  const y0 = Math.floor(Math.min(...poly.map((p) => p[1]))) - 1;
  const y1 = Math.ceil(Math.max(...poly.map((p) => p[1]))) + 1;
  for (let y = y0; y <= y1; y++) buckets.push([]);
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    for (let y = Math.floor(Math.min(yi, yj)); y <= Math.floor(Math.max(yi, yj)); y++) buckets[y - y0].push([xi, yi, xj, yj]);
  }
  return (x, y) => {
    const k = Math.floor(y) - y0;
    if (k < 0 || k >= buckets.length) return false;
    let c = false;
    for (const [xi, yi, xj, yj] of buckets[k]) {
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
}

const N4X = [1, -1, 0, 0];
const N4Y = [0, 0, 1, -1];
const round2 = (v: number) => Math.round(v * 100) / 100;

interface Compiled { outS: XY[]; inOutline: (x: number, y: number) => boolean; bayS: XY[]; inBay: (x: number, y: number) => boolean; inFloat: (x: number, y: number) => boolean }
const COMPILED = new Map<Preset, Compiled>();
function compiled(p: Preset): Compiled {
  let c = COMPILED.get(p);
  if (!c) {
    const outS = smoothClosed(p.outline);
    const bayS = smoothClosed(p.bay);
    c = { outS, inOutline: bucketed(outS), bayS, inBay: bucketed(bayS), inFloat: bucketed(smoothClosed(p.floatIsland)) };
    COMPILED.set(p, c);
  }
  return c;
}
const SEED_WX = fnv1a("coast:wx");
const SEED_WY = fnv1a("coast:wy");
const SEED_CR = fnv1a("coast:crinkle");

/**
 * Pure-function memo (bounded): the raster and noise fields depend only on
 * (preset, grid size, family), so rebuilding the same world reuses them.
 */
const MEMO = new Map<string, Uint8Array | Float32Array>();
function memo<V extends Uint8Array | Float32Array>(key: string, make: () => V): V {
  let v = MEMO.get(key) as V | undefined;
  if (!v) {
    if (MEMO.size > 64) MEMO.clear();
    v = make();
    MEMO.set(key, v);
  }
  return v;
}
const OUTLINE_IDS = new WeakMap<object, number>();
let outlineCount = 0;
const outlineId = (f: object) => {
  if (!OUTLINE_IDS.has(f)) OUTLINE_IDS.set(f, ++outlineCount);
  return OUTLINE_IDS.get(f)!;
};

/** Land mask for a cols×rows grid (tile centres mapped into the frame, domain-warped). Returns a fresh copy. */
function rasterLand(cols: number, rows: number, inOutline: (x: number, y: number) => boolean): Uint8Array {
  return memo(`land:${outlineId(inOutline)}:${cols}x${rows}`, () => rasterLandRaw(cols, rows, inOutline)).slice();
}
function rasterLandRaw(cols: number, rows: number, inOutline: (x: number, y: number) => boolean): Uint8Array {
  const land = new Uint8Array(cols * rows);
  const sx = FRAME_W / cols;
  const sy = FRAME_H / rows;
  for (let y = FRAME_SEA; y < rows - FRAME_SEA; y++) {
    for (let x = FRAME_SEA; x < cols - FRAME_SEA; x++) {
      const fx = (x + 0.5) * sx;
      const fy = (y + 0.5) * sy;
      const wx = fx + WARP_AMP * 2 * (fbm(fx, fy, SEED_WX, WARP_SCALE) - 0.5) + CRINKLE_AMP * 2 * (fbm(x, y, SEED_CR, 3) - 0.5);
      const wy = fy + WARP_AMP * 2 * (fbm(fx, fy, SEED_WY, WARP_SCALE) - 0.5) + CRINKLE_AMP * 2 * (fbm(y, x, SEED_CR, 3) - 0.5);
      if (inOutline(wx, wy)) land[y * cols + x] = 1;
    }
  }
  return land;
}

/** Connected components (4-neighbour) of `mask`. */
function components(mask: Uint8Array, cols: number, rows: number): { id: Int32Array; sizes: number[] } {
  const n = cols * rows;
  const id = new Int32Array(n).fill(-1);
  const sizes: number[] = [];
  const q = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (!mask[s] || id[s] >= 0) continue;
    const c = sizes.length;
    let head = 0, tail = 0;
    q[tail++] = s;
    id[s] = c;
    while (head < tail) {
      const i = q[head++];
      const x = i % cols, y = (i - x) / cols;
      for (let k = 0; k < 4; k++) {
        const nx = x + N4X[k], ny = y + N4Y[k];
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const u = ny * cols + nx;
        if (mask[u] && id[u] < 0) { id[u] = c; q[tail++] = u; }
      }
    }
    sizes.push(tail);
  }
  return { id, sizes };
}

/** Keep the largest land component; fill small enclosed lakes. */
function tidyLand(land: Uint8Array, cols: number, rows: number) {
  const { id, sizes } = components(land, cols, rows);
  let big = 0;
  for (let c = 1; c < sizes.length; c++) if (sizes[c] > sizes[big]) big = c;
  for (let i = 0; i < land.length; i++) if (land[i] && id[i] !== big) land[i] = 0;
  const sea = new Uint8Array(land.length);
  for (let i = 0; i < land.length; i++) sea[i] = land[i] ? 0 : 1;
  const w = components(sea, cols, rows);
  const edge = new Uint8Array(w.sizes.length);
  for (let x = 0; x < cols; x++) { edge[w.id[x]] = 1; edge[w.id[(rows - 1) * cols + x]] = 1; }
  for (let y = 0; y < rows; y++) { edge[w.id[y * cols]] = 1; edge[w.id[y * cols + cols - 1]] = 1; }
  for (let i = 0; i < land.length; i++) {
    const c = w.id[i];
    if (c >= 0 && !edge[c] && w.sizes[c] < LAKE_FILL) land[i] = 1;
  }
}

/** 3:2 grid for `landTarget` continent tiles: trial raster → measure → size (re-measured). */
function sizeGrid(landTarget: number, inOutline: (x: number, y: number) => boolean): { cols: number; rows: number; land: Uint8Array } {
  let rows = 60;
  let cols = Math.round((rows * FRAME_W) / FRAME_H);
  let land = rasterLand(cols, rows, inOutline);
  for (let pass = 0; pass < 3; pass++) {
    let k = 0;
    for (let i = 0; i < land.length; i++) k += land[i];
    const frac = k / (cols * rows);
    const want = Math.max(24, Math.round(Math.sqrt(landTarget / (frac * (FRAME_W / FRAME_H)))));
    if (want === rows && pass) break;
    rows = want;
    cols = Math.round((rows * FRAME_W) / FRAME_H);
    land = rasterLand(cols, rows, inOutline);
  }
  tidyLand(land, cols, rows);
  return { cols, rows, land };
}

/** Rasterise a frame-unit polyline to distinct tile indices (only where `ok`). */
function rasterPolyline(pts: XY[], cols: number, rows: number, ok: (i: number) => boolean): number[] {
  const sx = cols / FRAME_W;
  const sy = rows / FRAME_H;
  const seen = new Set<number>();
  const out: number[] = [];
  const add = (fx: number, fy: number) => {
    const x = Math.min(cols - 1, Math.max(0, Math.floor(fx * sx)));
    const y = Math.min(rows - 1, Math.max(0, Math.floor(fy * sy)));
    const i = y * cols + x;
    if (!seen.has(i) && ok(i)) { seen.add(i); out.push(i); }
  };
  if (pts.length === 1) add(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) {
    const [ax, ay] = pts[k - 1];
    const [bx, by] = pts[k];
    const steps = Math.max(1, Math.ceil(Math.hypot((bx - ax) * sx, (by - ay) * sy) * 3));
    for (let s = 0; s <= steps; s++) add(ax + ((bx - ax) * s) / steps, ay + ((by - ay) * s) / steps);
  }
  return out;
}

/** Nearest tile to frame point p that satisfies ok; -1 if none. */
function nearestTile(p: XY, cols: number, rows: number, ok: (i: number) => boolean): number {
  const x0 = Math.min(cols - 1, Math.max(0, Math.floor((p[0] * cols) / FRAME_W)));
  const y0 = Math.min(rows - 1, Math.max(0, Math.floor((p[1] * rows) / FRAME_H)));
  let best = -1;
  let bd = Infinity;
  for (let i = 0; i < cols * rows; i++) {
    if (!ok(i)) continue;
    const x = i % cols, y = (i - x) / cols;
    const d = (x - x0) ** 2 + (y - y0) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/**
 * Additively weighted multi-source geodesic growth over `land`: region r's
 * front starts at time −head[r] from its (pre-claimed) skeleton tiles and
 * every front advances (1 + noise) per tile. Growth only expands a region's
 * own tiles, so every region stays 4-connected to its skeleton.
 */
function partition(
  land: Uint8Array, cols: number, rows: number, seeds: number[][], head: number[], noise: Float32Array[],
): Int8Array {
  const n = cols * rows;
  const owner = new Int8Array(n).fill(-1);
  const done = new Uint8Array(n);
  const heap = new MinHeap();
  seeds.forEach((ss, r) => { for (const t of ss) owner[t] = r; });
  seeds.forEach((ss, r) => { for (const t of ss) heap.push(-head[r], r * n + t, r * n + t); });
  while (heap.size) {
    const v = heap.pop();
    const g = heap.lastPri;
    const r = Math.floor(v / n);
    const t = v - r * n;
    if (done[t] || (owner[t] !== -1 && owner[t] !== r)) continue;
    owner[t] = r;
    done[t] = 1;
    const x = t % cols, y = (t - x) / cols;
    for (let k = 0; k < 4; k++) {
      const nx = x + N4X[k], ny = y + N4Y[k];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const u = ny * cols + nx;
      if (!land[u] || done[u] || (owner[u] !== -1 && owner[u] !== r)) continue;
      heap.push(g + 1 + BORDER_NOISE * noise[r][u], r * n + u, r * n + u);
    }
  }
  return owner;
}

/** Hand disconnected pieces of a region to the neighbour that surrounds them most (or the sea). */
function reconnect(owner: Int8Array, cols: number, rows: number, nReg: number) {
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (let r = 0; r < nReg; r++) {
      const m = new Uint8Array(owner.length);
      for (let i = 0; i < owner.length; i++) m[i] = owner[i] === r ? 1 : 0;
      const { id, sizes } = components(m, cols, rows);
      if (sizes.length < 2) continue;
      let big = 0;
      for (let c = 1; c < sizes.length; c++) if (sizes[c] > sizes[big]) big = c;
      for (let c = 0; c < sizes.length; c++) {
        if (c === big) continue;
        const votes = new Map<number, number>();
        for (let i = 0; i < owner.length; i++) {
          if (id[i] !== c) continue;
          const x = i % cols, y = (i - x) / cols;
          for (let k = 0; k < 4; k++) {
            const nx = x + N4X[k], ny = y + N4Y[k];
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            const o = owner[ny * cols + nx];
            if (o >= 0 && o !== r) votes.set(o, (votes.get(o) ?? 0) + 1);
          }
        }
        let to = -1;
        for (const [o, v] of [...votes].sort((a, b) => a[0] - b[0])) if (to < 0 || v > votes.get(to)!) to = o;
        for (let i = 0; i < owner.length; i++) if (id[i] === c) owner[i] = to;
        changed = true;
      }
    }
    if (!changed) break;
  }
}

/** Chebyshev distance to the source tiles. */
function chebyshev(cols: number, rows: number, src: number[]): Int16Array {
  const n = cols * rows;
  const d = new Int16Array(n).fill(32767);
  const q = new Int32Array(n);
  let head = 0, tail = 0;
  for (const s of src) if (d[s]) { d[s] = 0; q[tail++] = s; }
  while (head < tail) {
    const i = q[head++];
    const x = i % cols, y = (i - x) / cols;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const u = ny * cols + nx;
        if (d[u] > d[i] + 1) { d[u] = d[i] + 1; q[tail++] = u; }
      }
    }
  }
  return d;
}

/**
 * Grow `target` tiles for region r from `seeds` over tiles passing `ok`,
 * best-first by `prio` (the region stays 4-connected to its seeds).
 */
function growBy(
  owner: Int8Array, cols: number, rows: number, r: number, seeds: number[], target: number,
  ok: (i: number) => boolean, prio: (i: number) => number,
): number {
  const heap = new MinHeap();
  const pushed = new Uint8Array(cols * rows);
  for (const s of seeds) if (!pushed[s] && ok(s)) { pushed[s] = 1; heap.push(prio(s), s, s); }
  let count = 0;
  while (heap.size && count < target) {
    const t = heap.pop();
    owner[t] = r;
    count++;
    const x = t % cols, y = (t - x) / cols;
    for (let k = 0; k < 4; k++) {
      const nx = x + N4X[k], ny = y + N4Y[k];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const u = ny * cols + nx;
      if (pushed[u] || !ok(u)) continue;
      pushed[u] = 1;
      heap.push(prio(u), u, u);
    }
  }
  return count;
}

/** Distance (tiles) from tile (x, y) to a frame-unit polyline. */
function distToPolyline(x: number, y: number, pts: XY[], sx: number, sy: number): number {
  let best = Infinity;
  const px = x + 0.5, py = y + 0.5;
  for (let k = 0; k < pts.length; k++) {
    const ax = pts[k][0] * sx, ay = pts[k][1] * sy;
    const b = pts[Math.min(k + 1, pts.length - 1)];
    const bx = b[0] * sx, by = b[1] * sy;
    const dx = bx - ax, dy = by - ay;
    const L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
    best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy));
  }
  return best;
}

/** Build the map: grid, land, region ownership (land + seabed + floating islands), exported shapes. */
export function buildContinent(fams: ContinentFamily[], preset: Preset, warnings: string[]): Continent {
  const P = preset;
  const C = compiled(P);
  const share = fams.map((f) => (f.floating ? 0 : P.seabed[f.family]?.share ?? 0));
  const landTarget = fams.map((f, r) => (f.floating ? 0 : Math.round(f.target * (1 - share[r]))));
  const landFams = fams.map((f, r) => ({ ...f, r })).filter((f) => !f.floating);
  const total = Math.max(600, landTarget.reduce((a, b) => a + b, 0));
  const { cols, rows, land } = sizeGrid(total, C.inOutline);
  const n = cols * rows;
  const sx = cols / FRAME_W;
  const sy = rows / FRAME_H;
  const toTiles = (poly: XY[]) => poly.map(([x, y]) => ({ x: round2(x * sx), y: round2(y * sy) }));

  // seeds: authored skeletons, spare capes for unknown families
  let spare = 0;
  const seeds: number[][] = fams.map(() => []);
  const skeletons: Pt[][] = fams.map(() => []);
  const claimed = new Uint8Array(n);
  for (const f of landFams) {
    let pts = P.skeletons[f.family];
    if (!pts) {
      pts = [P.spare[spare++ % P.spare.length]];
      warnings.push(`family "${f.family}" has no authored place on the map; using a spare cape`);
    }
    skeletons[f.r] = toTiles(pts);
    let tiles = rasterPolyline(pts, cols, rows, (i) => land[i] === 1 && !claimed[i]);
    if (!tiles.length) {
      const t = nearestTile(pts[0], cols, rows, (i) => land[i] === 1 && !claimed[i]);
      tiles = t >= 0 ? [t] : [];
    }
    for (const t of tiles) claimed[t] = 1;
    seeds[f.r] = tiles;
  }

  // land partition, head starts iterated until areas match
  const regionOf = new Int8Array(n).fill(-1);
  if (landFams.length) {
    const noise = fams.map((f) => memo(`noise:${f.family}:${cols}x${rows}`, () => {
      const a = new Float32Array(n);
      const s = fnv1a(`border:${f.family}`);
      for (let i = 0; i < n; i++) { const x = i % cols; a[i] = fbm(x, (i - x) / cols, s, BORDER_NOISE_SCALE); }
      return a;
    }));
    let landCount = 0;
    for (let i = 0; i < n; i++) landCount += land[i];
    const sum = landFams.reduce((a, f) => a + landTarget[f.r], 0);
    const want = fams.map((_, r) => (landTarget[r] * landCount) / Math.max(1, sum));
    const head = fams.map(() => 0);
    let owner = partition(land, cols, rows, seeds, head, noise);
    for (let it = 0; it < AREA_ITERS; it++) {
      const area = fams.map(() => 0);
      const front = fams.map(() => 0);
      for (let i = 0; i < n; i++) {
        const r = owner[i];
        if (r < 0) continue;
        area[r]++;
        const x = i % cols;
        if ((x + 1 < cols && owner[i + 1] >= 0 && owner[i + 1] !== r) || (i + cols < n && owner[i + cols] >= 0 && owner[i + cols] !== r) ||
            (x > 0 && owner[i - 1] >= 0 && owner[i - 1] !== r) || (i >= cols && owner[i - cols] >= 0 && owner[i - cols] !== r)) front[r]++;
      }
      let worst = 0;
      for (const f of landFams) worst = Math.max(worst, Math.abs(area[f.r] - want[f.r]) / Math.max(1, want[f.r]));
      if (worst < AREA_TOL) break;
      // Δarea ≈ front·Δhead (a unit of head start moves the whole front one tile); damped
      for (const f of landFams) head[f.r] += (0.6 * (want[f.r] - area[f.r])) / Math.max(4, front[f.r]);
      owner = partition(land, cols, rows, seeds, head, noise);
    }
    reconnect(owner, cols, rows, fams.length);
    for (let i = 0; i < n; i++) regionOf[i] = owner[i];
  }
  for (let i = 0; i < n; i++) if (land[i] && regionOf[i] < 0) land[i] = 0; // cut-off land → sea

  // seabeds: grown from the family's own coast into the bay, along its spine
  const underwater = fams.map(() => false);
  const fx = (i: number) => ((i % cols) + 0.5) / sx;
  const fy = (i: number) => (Math.floor(i / cols) + 0.5) / sy;
  fams.forEach((f, r) => {
    const sb = P.seabed[f.family];
    if (!sb || f.floating || !share[r]) return;
    const others: number[] = [];
    for (let i = 0; i < n; i++) if (land[i] && regionOf[i] !== r) others.push(i);
    const dOther = chebyshev(cols, rows, others);
    const ok = (i: number) => !land[i] && regionOf[i] < 0 && dOther[i] > SEABED_CLEAR && C.inBay(fx(i), fy(i)) &&
      i % cols > 0 && i % cols < cols - 1 && i >= cols && i < n - cols;
    const coastSeeds: number[] = [];
    for (let i = 0; i < n; i++) {
      if (!ok(i)) continue;
      const x = i % cols, y = (i - x) / cols;
      for (let k = 0; k < 4; k++) {
        const u = (y + N4Y[k]) * cols + x + N4X[k];
        if (land[u] && regionOf[u] === r) { coastSeeds.push(i); break; }
      }
    }
    const seed = fnv1a(`seabed:${f.family}`);
    const got = growBy(regionOf, cols, rows, r, coastSeeds, f.target - landTarget[r], ok,
      (i) => distToPolyline(i % cols, Math.floor(i / cols), sb.spine, sx, sy) + 3 * fbm(i % cols, Math.floor(i / cols), seed, 4));
    underwater[r] = got > 0;
  });

  // floating islands: islet families, away from everything
  let fk = 0;
  fams.forEach((f, r) => {
    if (!f.floating) return;
    const anchor = P.floatAnchors[fk++ % P.floatAnchors.length];
    const src: number[] = [];
    for (let i = 0; i < n; i++) if (land[i] || regionOf[i] >= 0) src.push(i);
    const dist = chebyshev(cols, rows, src);
    const ok = (i: number) => {
      const x = i % cols, y = (i - x) / cols;
      return dist[i] > FLOAT_MOAT && x >= 2 && y >= 2 && x < cols - 2 && y < rows - 2;
    };
    const start = nearestTile(anchor, cols, rows, ok);
    if (start < 0) return;
    skeletons[r] = toTiles([anchor]);
    const seed = fnv1a(`float:${f.family}`);
    const ax = anchor[0] * sx, ay = anchor[1] * sy;
    growBy(regionOf, cols, rows, r, [start], f.target, ok, (i) => {
      const x = i % cols, y = (i - x) / cols;
      return Math.hypot((x + 0.5 - ax) / 1.3, y + 0.5 - ay) + (C.inFloat(fx(i), fy(i)) ? 0 : 6) + 4 * fbm(x, y, seed, 4);
    });
    for (let i = 0; i < n; i++) if (regionOf[i] === r) land[i] = 1;
  });

  // islets: skipped where they would touch other ground
  const ground: number[] = [];
  for (let i = 0; i < n; i++) if (land[i] || regionOf[i] >= 0) ground.push(i);
  const dGround = chebyshev(cols, rows, ground);
  const islets: { kind: IsletKind; poly: Pt[] }[] = [];
  P.islets.forEach(([ix, iy, ir, kind], k) => {
    const seed = fnv1a(`islet:${k}`);
    const ring: XY[] = [];
    for (let a = 0; a < 9; a++) {
      const ang = (a / 9) * 2 * Math.PI;
      const rr = ir * (0.7 + 0.6 * fbm(a * 3, k * 7, seed, 2));
      ring.push([ix + rr * Math.cos(ang), iy + rr * Math.sin(ang) * 0.85]);
    }
    const poly = smoothClosed(ring, 4);
    const inPoly = bucketed(poly);
    let ok = true;
    let any = false;
    for (let y = 0; y < rows && ok; y++) {
      for (let x = 0; x < cols; x++) {
        if (!inPoly((x + 0.5) / sx, (y + 0.5) / sy)) continue;
        any = true;
        if (dGround[y * cols + x] <= ISLET_GAP) { ok = false; break; }
      }
    }
    if (ok && any) islets.push({ kind, poly: toTiles(poly) });
  });

  return {
    cols, rows, regionOf, land, underwater, outline: toTiles(C.outS), bay: toTiles(C.bayS), islets,
    zones: P.zones.filter((z) => fams.some((f) => f.family === z.family)).map((z) => ({ family: z.family, zone: z.zone, poly: toTiles(smoothClosed(z.poly, 4)) })),
    skeletons,
  };
}
