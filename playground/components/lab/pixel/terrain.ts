// Static map layers for the pixel skin, painted once into palette-index
// buffers and cached as canvases (the visible canvas only re-blits them).
//
// Autotiling (the skin's signature) — every edge is computed from neighbour
// masks of world.terrain, never drawn by hand:
//   · coast/river banks: per-tile QUADRANTS look at their two orthogonal
//     neighbours — land quadrants with water on both sides get a rounded
//     outer corner carved out; water quadrants with land on both sides get an
//     inner-corner fillet. A pixel distance field then lays the ink shoreline,
//     foam and shallow band, so corners and edges always join.
//   · south-facing sea coasts drop a cliff face (vertical run below land).
//   · roads: each tile's 8-bit connection mask (from the road tile chains)
//     draws an arm per connected neighbour, outline pass then fill pass, so
//     trunks, junctions and diagonals join without seams.
//   · bridges: wooden planks across the river along the bridge axis.
import { T, type World, type WorldNode } from "@/lib/world";
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { biomeOf } from "./palette";
import {
  blank, blit, CLEAR, downsample, fillRect, flipX, recolor, sprite, toCanvas, type IndexImage,
} from "./raster";
import {
  CACTUS, CASTLE, CRYSTAL, GLINTS, GLYPHS, GROUND, GROUND_OF, HOUSE, MOUNTAIN, MUSHROOM, PIER, PINE, QSIGN, STAR, TREE,
} from "./sprites";
import { emblemSprite, type EmblemMask } from "./emblems";

export const TS = 16;

export interface NodeLook {
  state: EvidenceState;
  filled: boolean;
  /** mechanism the model introduces (atoms wear it as a banner glyph). */
  mech?: string;
}

export interface Layers {
  /** ts16 (static: no idle water animation in round 2) */
  full: HTMLCanvasElement;
  /** the same layers one palette step darker (SNES colour-math "step back") */
  dim: { full: HTMLCanvasElement; mid: HTMLCanvasElement; far: HTMLCanvasElement };
  /** raw index buffers, kept to cut per-region layers on demand */
  raw: IndexImage;
  mid: HTMLCanvasElement;   // ts8 (one art pixel per 2 world px)
  far: HTMLCanvasElement;   // ts4
  /** land owner per ts16 pixel (region id, -1 water) — for the region spotlight. */
  owner: Int8Array;
  w: number;
  h: number;
}

// ———————————————————————— ground ————————————————————————

const isWaterCode = (v: number) => v === T.SEA || v === T.RIVER || v === T.BRIDGE;

interface Ground {
  land: Uint8Array;     // 1 land pixel
  owner: Int8Array;     // region id per land pixel
  river: Uint8Array;    // 1 when the pixel's tile is river/bridge
  dWater: Float32Array; // land px → nearest water px
  dLand: Float32Array;  // water px → nearest land px
  cliff: Uint8Array;    // water px: rows below a land pixel (0 = none, capped 9)
  cliffOwner: Int8Array;
}

function shapeGround(world: World): Ground {
  const { cols, rows, terrain, regionOf } = world;
  const W = cols * TS, H = rows * TS;
  const land = new Uint8Array(W * H);
  const owner = new Int8Array(W * H).fill(-1);
  const river = new Uint8Array(W * H);
  const waterAt = (tx: number, ty: number) =>
    tx < 0 || ty < 0 || tx >= cols || ty >= rows ? true : isWaterCode(terrain[ty * cols + tx]);
  const OUTER_R = 5, INNER_R = 3;

  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const t = ty * cols + tx;
      const water = isWaterCode(terrain[t]);
      const isRiver = terrain[t] === T.RIVER || terrain[t] === T.BRIDGE;
      for (let y = 0; y < TS; y++) {
        for (let x = 0; x < TS; x++) {
          const qx = x < TS / 2 ? -1 : 1, qy = y < TS / 2 ? -1 : 1;
          const hWater = waterAt(tx + qx, ty), vWater = waterAt(tx, ty + qy);
          let isLand = !water;
          let own = water ? -1 : regionOf[t];
          if (!water && hWater && vWater) {
            // outer corner: carve a rounded bite from this quadrant
            const cx = qx < 0 ? OUTER_R : TS - OUTER_R, cy = qy < 0 ? OUTER_R : TS - OUTER_R;
            const px = x + 0.5, py = y + 0.5;
            const beyond = (qx < 0 ? px < cx : px > cx) && (qy < 0 ? py < cy : py > cy);
            if (beyond && Math.hypot(px - cx, py - cy) > OUTER_R) { isLand = false; own = -1; }
          } else if (water && !hWater && !vWater) {
            // inner corner: land wraps round this water quadrant → fillet
            const cx = qx < 0 ? INNER_R : TS - INNER_R, cy = qy < 0 ? INNER_R : TS - INNER_R;
            const px = x + 0.5, py = y + 0.5;
            const beyond = (qx < 0 ? px < cx : px > cx) && (qy < 0 ? py < cy : py > cy);
            if (beyond && Math.hypot(px - cx, py - cy) > INNER_R) {
              isLand = true;
              own = regionOf[(ty + qy) * cols + tx];
            }
          }
          const i = (ty * TS + y) * W + tx * TS + x;
          land[i] = isLand ? 1 : 0;
          owner[i] = own;
          river[i] = isRiver ? 1 : 0;
        }
      }
    }
  }

  const dist = (target: number) => {
    // two-pass chamfer (1, √2) distance to the nearest pixel whose land === target
    const d = new Float32Array(W * H);
    const INF = 1e6;
    for (let i = 0; i < d.length; i++) d[i] = land[i] === target ? 0 : INF;
    const D = Math.SQRT2;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, d[i - W] + 1);
        if (x > 0) v = Math.min(v, d[i - W - 1] + D);
        if (x < W - 1) v = Math.min(v, d[i - W + 1] + D);
      }
      d[i] = v;
    }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      let v = d[i];
      if (x < W - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < H - 1) {
        v = Math.min(v, d[i + W] + 1);
        if (x < W - 1) v = Math.min(v, d[i + W + 1] + D);
        if (x > 0) v = Math.min(v, d[i + W - 1] + D);
      }
      d[i] = v;
    }
    return d;
  };
  const dLand = dist(1);
  const dWater = dist(0);

  const cliff = new Uint8Array(W * H);
  const cliffOwner = new Int8Array(W * H).fill(-1);
  for (let x = 0; x < W; x++) {
    let run = 0, own = -1;
    for (let y = 0; y < H; y++) {
      const i = y * W + x;
      if (land[i]) { run = 0; own = owner[i]; continue; }
      if (own >= 0 && run < 9) { run++; cliff[i] = river[i] ? 0 : run; cliffOwner[i] = own; }
      else own = -1;
    }
  }
  return { land, owner, river, dWater, dLand, cliff, cliffOwner };
}

function paintGround(world: World, g: Ground, frame: 0 | 1): IndexImage {
  const W = world.cols * TS, H = world.rows * TS;
  const img = blank(W, H);
  const glint = GLINTS[frame];
  const regionBiome = world.regions.map((r) => biomeOf(r.family));
  const regionTex = world.regions.map((r) => GROUND[GROUND_OF[r.family] ?? "tufts"]);
  const CLIFF_H = 4;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let v: number;
      if (g.land[i]) {
        const own = g.owner[i];
        const b = regionBiome[own] ?? biomeOf("");
        if (g.dWater[i] <= 1.5) v = b.light;            // lit lip along every shore
        else {
          const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
          const lx = (tx + ty) & 1 ? TS - 1 - (x % TS) : x % TS; // checker-mirrored texture
          const ch = regionTex[own]?.[y % TS]?.[lx];
          v = ch === "L" ? b.light : ch === "S" ? b.shade : b.base;
        }
      } else if (!g.river[i] && g.cliff[i] >= 1 && g.cliff[i] <= CLIFF_H + 1) {
        const k = g.cliff[i];
        const b = regionBiome[g.cliffOwner[i]] ?? biomeOf("");
        v = k <= CLIFF_H - 1 ? b.shade : k === CLIFF_H ? 15 : 11; // face, waterline, foam
      } else {
        const d = g.dLand[i];
        if (g.river[i]) {
          v = d <= 1.2 ? 15 : d <= 3.5 ? 10 : 9;
        } else {
          v = d <= 1.2 ? 15 : d <= 2.5 ? 11 : d <= 6 ? 10 : d <= 30 ? 9 : d <= 38 ? ((x + y) & 1 ? 8 : 9) : 8;
        }
        if ((v === 9 || v === 8) && glint[y % TS][x % TS] === "x") v = v === 9 ? 10 : 9;
      }
      img.data[i] = v;
    }
  }
  return img;
}

// ———————————————————————— overlays ————————————————————————

function disc(img: IndexImage, cx: number, cy: number, size: number, v: number) {
  const r = size / 2;
  for (let y = Math.floor(cy - r); y < cy + r; y++) {
    for (let x = Math.floor(cx - r); x < cx + r; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (size >= 5 && dx * dx + dy * dy > r * r + 0.5) continue;
      if (x >= 0 && y >= 0 && x < img.w && y < img.h) img.data[y * img.w + x] = v;
    }
  }
}

function stroke(img: IndexImage, a: { x: number; y: number }, b: { x: number; y: number }, size: number, v: number) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(len * 2));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    disc(img, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, size, v);
  }
}


const C_IDX = { ink: 0, plum: 1, red: 2, orange: 3, gold: 4, lime: 5, green: 6, teal: 7, navy: 8, blue: 9, sky: 10, cyan: 11, white: 12, silver: 13, slate: 14, charcoal: 15 } as const;

function paintBridges(img: IndexImage, world: World, f: number) {
  const { cols } = world;
  const ext = f === 1 ? 3 : 1;
  const half = f === 1 ? 6 : f === 2 ? 3 : 1;
  for (const br of world.bridges) {
    for (const t of br.tiles) {
      const cx = ((t % cols) * TS + TS / 2) / f, cy = (Math.floor(t / cols) * TS + TS / 2) / f;
      const ts = TS / f;
      for (let a = -ts / 2 - ext; a < ts / 2 + ext; a++) {
        for (let o = -half; o < half; o++) {
          const x = Math.floor(br.axis === "h" ? cx + a : cx + o), y = Math.floor(br.axis === "h" ? cy + o : cy + a);
          if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
          const rail = o === -half || o === half - 1;
          const seam = f === 1 && (((br.axis === "h" ? x : y) % 3) + 3) % 3 === 2;
          img.data[y * img.w + x] = rail ? C_IDX.charcoal : seam ? C_IDX.red : C_IDX.orange;
        }
        // shadow cast on the water under the deck
        const sx = Math.floor(br.axis === "h" ? cx + a : cx + half), sy = Math.floor(br.axis === "h" ? cy + half : cy + a);
        if (sx >= 0 && sy >= 0 && sx < img.w && sy < img.h && img.data[sy * img.w + sx] !== C_IDX.charcoal) {
          const cur = img.data[sy * img.w + sx];
          if (cur === C_IDX.blue || cur === C_IDX.sky) img.data[sy * img.w + sx] = C_IDX.navy;
        }
      }
    }
  }
}

function paintPlazas(img: IndexImage, world: World, f: number, glyphs: Record<string, IndexImage>) {
  for (const r of world.regions) {
    const sp = r.setPiece;
    if (!sp) continue;
    const x0 = (sp.x * TS) / f, y0 = (sp.y * TS) / f, w = (sp.w * TS) / f, h = (sp.h * TS) / f;
    if (f === 1) {
      // plaza casts a 2px shadow south-east onto its own land
      const shade = biomeOf(r.family).shade;
      fillRect(img, x0 + 2, y0 + h, w, 2, shade);
      fillRect(img, x0 + w, y0 + 2, 2, h, shade);
    }
    fillRect(img, x0, y0, w, h, C_IDX.charcoal);
    fillRect(img, x0 + 1, y0 + 1, w - 2, h - 2, C_IDX.silver);
    if (f === 1) {
      fillRect(img, x0 + 1, y0 + 1, w - 2, 1, C_IDX.white);   // lit top edge
      fillRect(img, x0 + 1, y0 + 1, 1, h - 2, C_IDX.white);   // lit left edge
      // paving grout every 8px
      for (let y = y0 + 2; y < y0 + h - 1; y++) for (let x = x0 + 2; x < x0 + w - 1; x++) {
        const lx = x - x0, ly = y - y0;
        if (ly % 8 === 0 || (lx + (Math.floor(ly / 8) % 2) * 4) % 8 === 0) img.data[y * img.w + x] = C_IDX.slate;
      }
      fillRect(img, x0 + 1, y0 + h - 2, w - 2, 1, C_IDX.slate);
    }
    const gl = glyphs[r.family];
    if (gl) {
      const sc = f === 1 ? 2 : 1;
      const gi = f === 4 ? downsample(gl, 2) : gl;
      blit(img, gi, Math.round(x0 + (w - gi.w * sc) / 2), Math.round(y0 + (h - gi.h * sc) / 2), sc);
    }
  }
}

function decorSprite(family: string): IndexImage {
  const b = biomeOf(family);
  switch (family) {
    case "representation": return sprite(PINE);
    case "sequence": return sprite(CACTUS);
    case "decision": return sprite(MUSHROOM);
    case "structure": return sprite(CRYSTAL);
    case "generative": return sprite(TREE, { X: C_IDX.red, Y: C_IDX.orange, Z: C_IDX.plum });
    default: return sprite(TREE, { X: C_IDX.teal, Y: b.light === C_IDX.lime ? C_IDX.green : b.light, Z: C_IDX.navy });
  }
}

function paintDecor(img: IndexImage, world: World, f: number) {
  const cache = new Map<string, IndexImage>();
  const { cols } = world;
  for (const d of world.decor) {
    let s = cache.get(d.region);
    if (!s) {
      s = decorSprite(d.region);
      if (f > 1) s = downsample(s, f, (v) => (v === 0 ? 0.7 : 1));
      cache.set(d.region, s);
    }
    const flip = d.variant % 2 === 1; // world.decor variant → mirrored sprite
    blit(img, flip ? flipX(s) : s, ((d.tile % cols) * TS) / f, (Math.floor(d.tile / cols) * TS) / f);
  }
}


// ———————————————————— roads on their lanes ————————————————————
type P = { x: number; y: number };

/** Every road as the polyline to draw: its lane (v2), plus stubs into derived towns' centres. */
export function roadPolys(world: World): { road: World["roads"][number]; pts: P[] }[] {
  const byName = new Map(world.nodes.map((n) => [n.name, n]));
  return world.roads.map((road) => {
    const base = road.lanePoints.length ? road.lanePoints : road.points;
    const pts: P[] = [...base];
    const a = byName.get(road.from), b = byName.get(road.to);
    if (a && !a.atom && pts.length) pts.unshift({ ...a.center });
    if (b && !b.atom && pts.length) pts.push({ ...b.center });
    return { road, pts };
  });
}

function strokePoly(img: IndexImage, pts: P[], f: number, size: number, v: number) {
  for (let i = 1; i < pts.length; i++) stroke(img, { x: pts[i - 1].x / f, y: pts[i - 1].y / f }, { x: pts[i].x / f, y: pts[i].y / f }, size, v);
}

/** A 2px-thick "V" pointing along `angle` (parent → child), stamped pixel by pixel. */
export function chevronPixels(x: number, y: number, angle: number, arm = 2): [number, number][] {
  const out: [number, number][] = [];
  const c = Math.cos(angle), s = Math.sin(angle);
  for (let p = -arm; p <= arm; p++) for (const back of [0, 1]) {
    const u = -Math.abs(p) - back, w = p;
    out.push([Math.round(x + u * c - w * s), Math.round(y + u * s + w * c)]);
  }
  return out;
}

function paintRoads(img: IndexImage, world: World, f: number) {
  const polys = roadPolys(world);
  const quiet = polys.filter((p) => p.road.kind === "bridge");
  const second = polys.filter((p) => p.road.kind !== "bridge" && !p.road.primary);
  const main = polys.filter((p) => p.road.kind !== "bridge" && p.road.primary);
  // cross-family lineage: long and loud → a thin low-value track until focused (live layer raises it)
  for (const { pts } of quiet) strokePoly(img, pts, f, f === 1 ? 2 : 1, C_IDX.charcoal);
  // second parents: stepping stones
  for (const { pts } of second) {
    for (let i = 1; i < pts.length; i++) {
      const a = { x: pts[i - 1].x / f, y: pts[i - 1].y / f }, b = { x: pts[i].x / f, y: pts[i].y / f };
      const len = Math.hypot(b.x - a.x, b.y - a.y), gap = f === 1 ? 6 : 3;
      for (let d = 0; d <= len; d += gap) {
        const x = a.x + ((b.x - a.x) * d) / Math.max(len, 1e-6), y = a.y + ((b.y - a.y) * d) / Math.max(len, 1e-6);
        if (f === 1) { disc(img, x, y, 4, C_IDX.charcoal); disc(img, x, y, 2, C_IDX.white); }
        else disc(img, x, y, 1, C_IDX.charcoal);
      }
    }
  }
  if (f === 4) { for (const { pts } of main) strokePoly(img, pts, f, 1, C_IDX.charcoal); return; }
  for (const { pts } of main) strokePoly(img, pts, f, f === 1 ? 7 : 4, C_IDX.charcoal);
  for (const { pts } of main) strokePoly(img, pts, f, f === 1 ? 4 : 2, f === 1 ? C_IDX.silver : C_IDX.white);
  if (f === 1) {
    const off = (pts: P[]) => pts.map((p) => ({ x: p.x - 0.5, y: p.y - 0.5 }));
    for (const { pts } of main) strokePoly(img, off(pts), f, 3, C_IDX.white);
    // direction chevrons (parent → child) in ink on every drawn road
    for (const { road } of [...main, ...second]) for (const ch of road.chevrons) {
      for (const [x, y] of chevronPixels(ch.x, ch.y, ch.angle)) {
        if (x >= 0 && y >= 0 && x < img.w && y < img.h) img.data[y * img.w + x] = C_IDX.charcoal;
      }
    }
  }
}

// ———————————————————— flavour: mountains, cities, harbours ————————————————————

function paintMountains(img: IndexImage, world: World, f: number) {
  const m = f === 1 ? sprite(MOUNTAIN) : downsample(sprite(MOUNTAIN), f, (v) => (v === 0 ? 0.7 : 1));
  for (const line of world.mountains) {
    let carry = 0;
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      for (let d = carry; d < len; d += 13) {
        const x = (a.x + ((b.x - a.x) * d) / len) / f, y = (a.y + ((b.y - a.y) * d) / len) / f;
        blit(img, m, Math.round(x - m.w / 2), Math.round(y - m.h + 3 / f));
        carry = d + 13 - len;
      }
    }
  }
}

function paintCities(img: IndexImage, world: World, f: number) {
  if (f === 4) return;
  const h = f === 1 ? sprite(HOUSE) : downsample(sprite(HOUSE), 2, (v) => (v === 0 ? 0.7 : 1));
  for (const c of world.cities) for (const b of c.blocks) {
    blit(img, h, Math.round((b.x + b.w / 2) / f - h.w / 2), Math.round((b.y + b.h / 2) / f - h.h / 2));
  }
}

function paintHarbours(img: IndexImage, world: World, f: number) {
  if (f === 4) return;
  const pier = sprite(PIER);
  for (const h of world.harbours) {
    if (h.boats <= 0) continue;
    const gap = f === 1 ? 12 : 6;
    const x0 = h.pt.x / f - ((h.boats - 1) * gap) / 2, y = h.pt.y / f;
    if (f === 1) { const t = h.tile, cx = (t % world.cols) * TS + TS / 2, cy = Math.floor(t / world.cols) * TS + TS / 2;
      for (let d = 0; d <= 1; d += 0.25) blit(img, pier, Math.round(cx + (h.pt.x - cx) * d - 2), Math.round(cy + (h.pt.y - cy) * d - 2)); }
    void x0; void y; // boats themselves are drawn on the live layer (big, ≤3 + a count)
  }
}

// ———————————————————— nodes ————————————————————

export type Emblems = Map<string, Map<number, EmblemMask>>;

// Node sprites per evidence look.
export function castleFor(look: NodeLook): IndexImage {
  const base = sprite(CASTLE, { R: C_IDX.blue, r: C_IDX.navy });
  return look.filled ? base : recolor(base, { [C_IDX.silver]: C_IDX.slate, [C_IDX.slate]: C_IDX.charcoal, [C_IDX.blue]: C_IDX.slate, [C_IDX.navy]: C_IDX.charcoal });
}

/** Round medallion of diameter d: ink rim, face, lower-right shade, upper-left light. */
function medallion(d: number, face: number, shade: number, light: number): IndexImage {
  const img = blank(d, d + 1);
  const r = d / 2, c = d / 2;
  for (let y = 0; y < d + 1; y++) for (let x = 0; x < d; x++) {
    const dx = x + 0.5 - c, dy = y + 0.5 - c, dd = Math.hypot(dx, dy);
    const dRim = Math.hypot(dx, dy - 1);             // 1px drop rim below
    if (dd <= r - 1) img.data[y * d + x] = dx + dy > r * 0.9 ? shade : dx + dy < -r * 1.05 ? light : face;
    else if (dd <= r) img.data[y * d + x] = 0;
    else if (dRim <= r) img.data[y * d + x] = 0;
  }
  return img;
}

export function dotFor(look: NodeLook, emblems?: Emblems, name?: string, size = 22): IndexImage {
  const on = look.filled;
  const m = medallion(size, on ? C_IDX.gold : C_IDX.slate, on ? C_IDX.orange : C_IDX.charcoal, on ? C_IDX.white : C_IDX.silver);
  const mask = name ? emblems?.get(name)?.get(size === 22 ? 12 : 9) : undefined;
  if (mask) {
    const e = emblemSprite(mask, on ? C_IDX.ink : C_IDX.silver);
    blit(m, e, Math.round((size - e.w) / 2), Math.round((size - e.h) / 2));
  }
  return m;
}

/** Atom banner: red pennant with the species emblem in gold (native pixels, hung on the keep). */
function banner(mask: EmblemMask | undefined, w: number, h: number): IndexImage {
  const img = blank(w, h + 2);
  for (let y = 0; y < h + 2; y++) for (let x = 0; x < w; x++) {
    const tip = y >= h ? Math.abs(x + 0.5 - w / 2) <= (h + 2 - y) * 1.5 : true;
    if (!tip) continue;
    const edge = x === 0 || x === w - 1 || y === 0 || (y >= h && Math.abs(x + 0.5 - w / 2) > (h + 1 - y) * 1.5);
    img.data[y * w + x] = edge ? C_IDX.ink : C_IDX.red;
  }
  if (mask) { const e = emblemSprite(mask, C_IDX.gold); blit(img, e, Math.round((w - e.w) / 2), 2); }
  return img;
}

/** Margin (world px) around a composed node so markers can overhang the footprint. */
export const NODE_PAD = 8;

/**
 * One node as it appears on the map (f = world px per art px: 1 near, 2 overview):
 * atom = castle + emblem banner + ground shadow; derived = emblem medallion.
 * The evidence marker is anchored ON the sprite. Also the card portrait.
 */
export function composeNode(atom: boolean, look: NodeLook, shade: number, emblems?: Emblems, name?: string, f: 1 | 2 = 1): IndexImage {
  const fw = (atom ? 64 : 32) / f, o = NODE_PAD / f;
  const img = blank(fw + 2 * o, fw + 2 * o);
  if (atom) {
    fillRect(img, o + 6 / f, o + 58 / f, fw - 10 / f, 3 / f, shade);
    blit(img, castleFor(look), o, o, f === 1 ? 2 : 1);
    const mask = name ? emblems?.get(name)?.get(f === 1 ? 12 : 9) : undefined;
    const b = f === 1 ? banner(mask, 16, 18) : banner(mask, 11, 12);
    blit(img, b, Math.round(o + (fw - b.w) / 2), Math.round(o + (f === 1 ? 20 : 9)));
  } else {
    const d = dotFor(look, emblems, name, f === 1 ? 22 : 16);
    blit(img, d, Math.round(o + (fw - d.w) / 2), Math.round(o + (fw - d.h) / 2));
  }
  const mk0 = look.state === "champion" ? sprite(STAR) : look.state === "provisional" ? sprite(QSIGN) : null;
  if (mk0) {
    const mk = f === 1 ? mk0 : downsample(mk0, 2, (v) => (v === 0 ? 0.6 : 1.3));
    if (atom) blit(img, mk, Math.round(o + fw - 12 / f - mk.w / 2), Math.round(o - 6 / f));
    else blit(img, mk, Math.round(o + fw * 0.78 - mk.w / 2), Math.round(o + 1 / f));
  }
  return img;
}

function paintNodes(img: IndexImage, world: World, looks: Map<string, NodeLook>, emblems: Emblems, f: number) {
  for (const n of world.nodes) {
    const look = looks.get(n.name) ?? { state: "untrained", filled: false };
    const t = Math.floor(n.center.y / TS) * world.cols + Math.floor(n.center.x / TS);
    const shade = biomeOf(world.regions[world.regionOf[t]]?.family ?? n.family).shade;
    // semantic zoom: castles keep a constant 32px (1× art) at the far zooms; derived dots shrink
    const farAtom = f === 4 && n.atom;
    let comp = composeNode(n.atom, f === 4 && !n.atom ? { ...look, state: "trained" } : look, shade, emblems, n.name, f === 1 ? 1 : 2);
    if (f === 4 && !n.atom) comp = downsample(comp, 2, (v) => (v === 0 ? 0.8 : v === C_IDX.gold || v === C_IDX.red ? 1.3 : 1));
    if (farAtom) blit(img, comp, Math.round(n.center.x / f - comp.w / 2), Math.round(n.center.y / f - comp.h / 2));
    else blit(img, comp, Math.round((n.foot.x * TS - NODE_PAD) / f), Math.round((n.foot.y * TS - NODE_PAD) / f));
  }
}

// ———————————————————————— build ————————————————————————

function glyphImages(): Record<string, IndexImage> {
  return Object.fromEntries(Object.entries(GLYPHS).map(([k, rows]) => [k, sprite(rows)]));
}

export function buildLayers(world: World, looks: Map<string, NodeLook>, emblems: Emblems): Layers {
  const g = shapeGround(world);
  const glyphs = glyphImages();
  const W = world.cols * TS, H = world.rows * TS;
  const overlay = (img: IndexImage, f: number) => {
    paintPlazas(img, world, f, glyphs);
    paintMountains(img, world, f);
    paintRoads(img, world, f);
    paintBridges(img, world, f);
    paintDecor(img, world, f);
    paintCities(img, world, f);
    paintHarbours(img, world, f);
    paintNodes(img, world, looks, emblems, f);
    return img;
  };
  const g0 = paintGround(world, g, 0);
  const mid = downsample(g0, 2, (v) => (v === C_IDX.charcoal ? 0.8 : 1));
  const far = downsample(g0, 4);
  const full = overlay(g0, 1), m = overlay(mid, 2), fa = overlay(far, 4);
  return {
    full: toCanvas(full),
    mid: toCanvas(m),
    far: toCanvas(fa),
    dim: { full: toCanvas(darken(full)), mid: toCanvas(darken(m)), far: toCanvas(darken(fa)) },
    raw: full,
    owner: g.owner,
    w: W,
    h: H,
  };
}

// One value step darker inside Sweetie-16 (each colour → its darker neighbour on its ramp).
const DARKER: Record<number, number> = {
  0: 0, 1: 0, 2: 1, 3: 2, 4: 3, 5: 6, 6: 7, 7: 8, 8: 0, 9: 8, 10: 9, 11: 10, 12: 13, 13: 14, 14: 15, 15: 0,
};
export function darken(img: IndexImage): IndexImage {
  return recolor(img, DARKER);
}

/** The full-detail layer cut to one region's land (pixel-exact coast), for the region spotlight. */
export function spotlight(layers: Layers, regionId: number): HTMLCanvasElement {
  const img = blank(layers.w, layers.h, CLEAR);
  for (let i = 0; i < img.data.length; i++) if (layers.owner[i] === regionId) img.data[i] = layers.raw.data[i];
  return toCanvas(img);
}
