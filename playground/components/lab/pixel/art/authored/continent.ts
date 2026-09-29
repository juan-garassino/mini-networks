// The AUTHORED continent silhouette. lib/world stays the source of every
// position; this module only decides where the paper ends and the land
// begins, with a cartographer's gesture instead of a noise-grown blob:
//
//   1. the world's land (non-SEA tiles) is smoothed at tile scale — no
//      16-px staircase, no noise — giving broad deliberate curves;
//   2. hand-placed GESTURES (tile coords, read off the current world) carve
//      bays and fjords and add capes, peninsulas and islet tails;
//   3. every civic tile (roads, footprints, set-pieces, bridges, rivers,
//      harbours, city blocks, label boxes) is PROTECTED with a 1-tile margin:
//      if a gesture would drown a model, the mask is nudged, never the node;
//   4. a coherent 1-art-px "hand wobble" on the contour (not speckle), then a
//      majority filter so no lone pixels survive.
//
// authoredLand(world, artPerTile) rasterises this at ANY level of detail
// (2, 3, 4, 6, 8 art px per tile …) — one vector source, every LOD derived.
import { T, type Box, type Pt, type World } from "@/lib/world";
import { isletBlobs } from "../terrain-shade";
import { noise } from "../noise";

const TILE = 16;
/** capes read as landforms, not tentacles: radii are fattened by this at raster time */
const CAPE_FAT = 1.4;

export type Gesture =
  /** capsule chain joined into one landform: [x, y, radius] in tiles */
  | { kind: "cape"; name: string; pts: [number, number, number][] }
  /** separate round islets, one per point */
  | { kind: "tail"; name: string; pts: [number, number, number][] }
  /** carve: a bay / fjord (capsule chain) */
  | { kind: "bay"; name: string; pts: [number, number, number][] };

/**
 * Hand-placed on the 132×99 world (taxonomy of 2026-09). If the world changes,
 * gestures that would cut civic land are neutralised by the protection mask,
 * and capes that land in open sea stay harmless — the map degrades gracefully.
 */
export const GESTURES: Gesture[] = [
  { kind: "cape", name: "Perceptron Point (NW)", pts: [[31, 19, 2.6], [26, 15.5, 1.9], [22.5, 13, 1.2]] },
  { kind: "tail", name: "NW islets", pts: [[19, 10.5, 1.1], [16.5, 8.5, 0.8], [14.6, 7.2, 0.5]] },
  { kind: "bay", name: "West Fjord", pts: [[2.5, 48, 1.8], [9, 49, 1.4]] },
  { kind: "cape", name: "SW peninsula", pts: [[19, 68, 2.6], [14.5, 72, 1.9], [11, 75, 1.2]] },
  { kind: "tail", name: "SW islets", pts: [[8.3, 77.6, 1.0], [6.3, 80.1, 0.65], [5, 82, 0.4]] },
  { kind: "cape", name: "North Cape (Representation)", pts: [[62, 8, 2.2], [63.5, 4.5, 1.5], [64.5, 2.6, 0.9]] },
  { kind: "tail", name: "North islet", pts: [[67.6, 1.9, 0.8]] },
  { kind: "tail", name: "Strait islet", pts: [[47.5, 11, 1.3], [45, 9, 0.6]] },
  { kind: "tail", name: "Gulf islets", pts: [[90, 24.5, 1.4], [93.2, 21.5, 0.95], [95.7, 19.3, 0.6]] },
  { kind: "cape", name: "East Cape (Decision)", pts: [[121, 50, 2.6], [125, 52.5, 1.8], [127.5, 55, 1.1]] },
  { kind: "tail", name: "East islets", pts: [[128.8, 58, 0.8], [129.5, 60.5, 0.45]] },
  { kind: "bay", name: "Decision Bay", pts: [[107, 65.5, 3.2]] },
  { kind: "bay", name: "Sandy Sound", pts: [[87.5, 66.5, 2.4]] },
  { kind: "cape", name: "Ember Cape (Generative)", pts: [[60, 92, 2.4], [58.5, 95, 1.5], [57.5, 96.8, 0.9]] },
  { kind: "tail", name: "Ember islet", pts: [[54.5, 97.3, 0.7]] },
  { kind: "bay", name: "Crystal Cove (Structure)", pts: [[100.3, 18, 2.6]] },
  { kind: "tail", name: "Crystal islets", pts: [[113, 31.4, 1.0], [110.9, 31.4, 0.55]] },
];

export interface AuthoredLand {
  /** art px size */
  w: number;
  h: number;
  /** world px of art pixel (0, 0) */
  origin: Pt;
  /** world px per art px (= 16 / artPerTile) */
  px: number;
  artPerTile: number;
  /** 1 = land (rivers included), 0 = sea */
  land: Uint8Array;
  /** region id per art px (−1 sea, −2 "?" island, −3 ruins islets); rivers keep their bank's region */
  region: Int8Array;
  /** 1 = river pixel (inside land) */
  river: Uint8Array;
  /** 0..1 civic cover per art px (roads / footprints / set-pieces / bridges / labels / cities / harbours;
   *  rivers excluded) — keep decoration where this is < 0.3 */
  civic: Float32Array;
  /** the frame in world px (grid ∪ camera.all) */
  frame: Box;
}

/** Frame covering the grid ∪ camera.all (both secret islands), snapped to tiles. */
export function authoredFrame(world: World): Box {
  const gw = world.cols * TILE, gh = world.rows * TILE;
  const a = world.camera.all;
  const x0 = Math.floor(Math.min(0, a.x) / TILE) * TILE, y0 = Math.floor(Math.min(0, a.y) / TILE) * TILE;
  const x1 = Math.max(gw, a.x + a.w), y1 = Math.max(gh, a.y + a.h);
  return { x: x0, y: y0, w: Math.ceil((x1 - x0) / TILE) * TILE, h: Math.ceil((y1 - y0) / TILE) * TILE };
}

/** Shared river meander displacement (tiles): ±0.55 tile, smooth. */
const meander = (tx: number, ty: number): [number, number] => [
  (noise(tx, ty, 0x5e1, 3.2) - 0.5) * 1.1,
  (noise(tx, ty, 0x5e2, 3.2) - 0.5) * 1.1,
];

function capsuleDist(px: number, py: number, pts: [number, number, number][]): { d: number; r: number } {
  if (pts.length === 1) return { d: Math.hypot(px - pts[0][0], py - pts[0][1]), r: pts[0][2] };
  let best = { d: 1e9, r: 1 };
  for (let k = 0; k + 1 < pts.length; k++) {
    const [ax, ay, ar] = pts[k], [bx, by, br] = pts[k + 1];
    const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L2));
    const d = Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
    const r = ar + (br - ar) * t;
    if (d - r < best.d - best.r) best = { d, r };
  }
  return best;
}

/** Rasterise the authored continent at `artPerTile` art px per tile. */
export function authoredLand(world: World, artPerTile: number): AuthoredLand {
  const apt = artPerTile;
  const px = TILE / apt;
  const { cols, rows, terrain, regionOf } = world;
  const frame = authoredFrame(world);
  const W = Math.round(frame.w / px), H = Math.round(frame.h / px);
  const N = W * H;
  const tx0 = frame.x / TILE, ty0 = frame.y / TILE;
  const TC = Math.round(frame.w / TILE), TR = Math.round(frame.h / TILE);   // frame in tiles

  // ——— tile fields over the frame (grid offset by tx0, ty0)
  const inGrid = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows;
  const landT = new Float32Array(TC * TR), protT = new Uint8Array(TC * TR), riverT = new Float32Array(TC * TR);
  const decoT = new Float32Array(TC * TR);   // civic WITHOUT rivers: where decoration must not go
  for (let y = 0; y < TR; y++) for (let x = 0; x < TC; x++) {
    const gx = x + tx0, gy = y + ty0;
    if (!inGrid(gx, gy)) continue;
    const v = terrain[gy * cols + gx];
    landT[y * TC + x] = v === T.SEA ? 0 : 1;
    if (v === T.ROAD || v === T.FOOT || v === T.SETPIECE || v === T.BRIDGE || v === T.RIVER) protT[y * TC + x] = 1;
    if (v === T.ROAD || v === T.FOOT || v === T.SETPIECE || v === T.BRIDGE) decoT[y * TC + x] = 1;
    if (v === T.RIVER || v === T.BRIDGE) riverT[y * TC + x] = 1;
  }
  const mark = (b: Box) => {
    for (let y = Math.floor(b.y / TILE); y <= Math.floor((b.y + b.h - 0.01) / TILE); y++)
      for (let x = Math.floor(b.x / TILE); x <= Math.floor((b.x + b.w - 0.01) / TILE); x++) {
        const fx = x - tx0, fy = y - ty0;
        if (fx >= 0 && fy >= 0 && fx < TC && fy < TR) { protT[fy * TC + fx] = 1; decoT[fy * TC + fx] = 1; }
      }
  };
  for (const l of world.labels) mark(l.box);
  for (const c of world.cities) for (const b of c.blocks) mark(b);
  for (const hb of world.harbours) { const gx = hb.tile % cols, gy = Math.floor(hb.tile / cols); mark({ x: gx * TILE, y: gy * TILE, w: TILE, h: TILE }); }
  for (const n of world.nodes) mark({ x: n.foot.x * TILE, y: n.foot.y * TILE, w: n.foot.w * TILE, h: n.foot.h * TILE });
  // dilate protection by 1 tile (8-neighbour)
  const protD = new Float32Array(TC * TR);
  for (let y = 0; y < TR; y++) for (let x = 0; x < TC; x++) {
    let v = 0;
    for (let dy = -1; dy <= 1 && !v; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < TC && yy < TR && protT[yy * TC + xx] && landT[yy * TC + xx]) { v = 1; break; }
    }
    protD[y * TC + x] = v;
  }
  // smooth the land: two box blurs (radius 2) at tile scale
  const blur = (src: Float32Array, r: number) => {
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
    for (let y = 0; y < TR; y++) for (let x = 0; x < TC; x++) {
      let s = 0, n = 0;
      for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < TC) { s += src[y * TC + xx]; n++; } }
      tmp[y * TC + x] = s / n;
    }
    for (let y = 0; y < TR; y++) for (let x = 0; x < TC; x++) {
      let s = 0, n = 0;
      for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < TR) { s += tmp[yy * TC + x]; n++; } }
      out[y * TC + x] = s / n;
    }
    return out;
  };
  const smooth = blur(blur(landT, 2), 1);
  const protS = protD;

  const bil = (f: Float32Array, u: number, v: number) => {
    const x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
    const g = (x: number, y: number) => (x >= 0 && y >= 0 && x < TC && y < TR ? f[y * TC + x] : 0);
    const a = g(x0, y0), b = g(x0 + 1, y0), c = g(x0, y0 + 1), d = g(x0 + 1, y0 + 1);
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  };

  const islets = [[isletBlobs(world.hiddenIsland), -2], [isletBlobs(world.ruinsIsland), -3]] as const;
  const protF = Float32Array.from(protT);
  const land = new Uint8Array(N);
  const isle = new Int8Array(N);
  const civic = new Float32Array(N);
  const keepLand = new Uint8Array(N);
  const river = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    const ty = (frame.y + (y + 0.5) * px) / TILE;      // world tile coords
    for (let x = 0; x < W; x++) {
      const tx = (frame.x + (x + 0.5) * px) / TILE;
      const i = y * W + x;
      const u = tx - tx0 - 0.5, v = ty - ty0 - 0.5;
      let F = bil(smooth, u, v);
      // hand wobble: coherent, ≤ ~1 art px of contour drift
      F += (noise(tx, ty, 0x7a11, 1.7) - 0.5) * 0.09;
      for (const g of GESTURES) {
        if (g.kind === "tail") {
          for (const [cx, cy, r] of g.pts) {
            const d = Math.hypot(tx - cx, ty - cy);
            if (d < r * 1.6) F = Math.max(F, 0.5 + (r - d) / (2 * r) + (noise(tx, ty, 0x7a12, 0.8) - 0.5) * 0.12);
          }
          continue;
        }
        const { d, r } = capsuleDist(tx, ty, g.pts);
        if (d > r * 1.6 * CAPE_FAT) continue;
        if (g.kind === "cape") { const rr = r * CAPE_FAT; F = Math.max(F, 0.5 + (rr - d) / (2 * rr)); }
        else F = Math.min(F, 0.5 + (d - r) / (2 * r));
      }
      const P = bil(protS, u, v);
      civic[i] = bil(decoT, u, v);
      const keep = bil(protF, u, v);
      if (P > 0) F = Math.max(F, 0.5 + P * 0.5);
      // secret islets (outside the grid)
      const wx = frame.x + (x + 0.5) * px, wy = frame.y + (y + 0.5) * px;
      for (const [blobs, id] of islets) {
        for (const b of blobs) {
          const dx = (wx - b.cx) / b.rx, dy = (wy - b.cy) / b.ry;
          const d = Math.hypot(dx, dy);
          if (d > 1.4) continue;
          const lump = noise(Math.cos(Math.atan2(dy, dx)) * 2 + b.cx / 97, Math.sin(Math.atan2(dy, dx)) * 2 + b.cy / 89, 0x1515, 0.9) - 0.5;
          if (d - lump * 0.35 < 1) { F = 1; isle[i] = id; }
        }
      }
      land[i] = F > 0.5 ? 1 : 0;
      if (keep >= 0.5) keepLand[i] = 1;
      // rivers meander around their tile chain (same displacement as the region lookup below,
      // so the family border stays ON the river)
      const [mx, my] = meander(tx, ty);
      if (bil(riverT, u + mx, v + my) > 0.45) river[i] = 1;
    }
  }
  // majority filter: no lone pixels / pinholes on the contour
  const clean = new Uint8Array(land);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) n += land[i + dy * W + dx];
    if (land[i] && n <= 2) clean[i] = 0;
    else if (!land[i] && n >= 6) clean[i] = 1;
  }
  for (let i = 0; i < N; i++) if (keepLand[i]) clean[i] = 1;   // never drown civic ground (roads, feet, labels, rivers)

  // ——— regions: nearest-region per tile (BFS), sampled with a smooth meander warp
  const regT = new Int16Array(TC * TR).fill(-1);
  const q: number[] = [];
  for (let y = 0; y < TR; y++) for (let x = 0; x < TC; x++) {
    const gx = x + tx0, gy = y + ty0;
    if (inGrid(gx, gy) && regionOf[gy * cols + gx] >= 0) { regT[y * TC + x] = regionOf[gy * cols + gx]; q.push(y * TC + x); }
  }
  for (let h = 0; h < q.length; h++) {
    const k = q[h], x = k % TC, y = (k - x) / TC;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= TC || yy >= TR) continue;
      const j = yy * TC + xx;
      if (regT[j] < 0) { regT[j] = regT[k]; q.push(j); }
    }
  }
  const region = new Int8Array(N).fill(-1);
  for (let y = 0; y < H; y++) {
    const ty = (frame.y + (y + 0.5) * px) / TILE;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!clean[i]) continue;
      if (isle[i]) { region[i] = isle[i]; continue; }
      const tx0p = (frame.x + (x + 0.5) * px) / TILE;
      const [mx, my] = meander(tx0p, ty);
      const tx = tx0p + mx, tyy = ty + my;                        // river-consistent displacement
      let wx = tx + (noise(tx, tyy, 0x13, 5) - 0.5) * 2.4, wy = tyy + (noise(tx, tyy, 0x24, 5) - 0.5) * 2.4;
      // rivers are natural borders: never warp across one
      for (let k = 1; k <= 4; k++) {
        const s = k / 4;
        if (bil(riverT, tx + (wx - tx) * s - tx0 - 0.5, tyy + (wy - tyy) * s - ty0 - 0.5) > 0.3) { wx = tx; wy = tyy; break; }
      }
      const fx = Math.floor(wx) - tx0, fy = Math.floor(wy) - ty0;
      const r = fx >= 0 && fy >= 0 && fx < TC && fy < TR ? regT[fy * TC + fx] : -1;
      region[i] = r >= 0 ? r : regT[Math.max(0, Math.min(TR - 1, Math.floor(tyy) - ty0)) * TC + Math.max(0, Math.min(TC - 1, Math.floor(tx) - tx0))];
    }
  }
  return { w: W, h: H, origin: { x: frame.x, y: frame.y }, px, artPerTile: apt, land: clean, region, river, civic, frame };
}
