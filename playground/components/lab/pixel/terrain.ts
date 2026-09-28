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
  BANNER, CACTUS, CASTLE, CRYSTAL, DOT, GLINTS, GLYPHS, GROUND, GROUND_OF, MECH_GLYPHS, MUSHROOM, PINE, QSIGN, STAR, TREE,
} from "./sprites";

export const TS = 16;

export interface NodeLook {
  state: EvidenceState;
  filled: boolean;
  /** mechanism the model introduces (atoms wear it as a banner glyph). */
  mech?: string;
}

export interface Layers {
  /** ts16: [water frame 0, water frame 1] */
  full: [HTMLCanvasElement, HTMLCanvasElement];
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

interface Seg { a: { x: number; y: number }; b: { x: number; y: number }; primary: boolean }

/** Road connection masks → segments (tile-centre to tile-centre, plus footprint stubs), in world px. */
export function roadSegments(world: World): Seg[] {
  const { cols } = world;
  const centre = (t: number) => ({ x: (t % cols) * TS + TS / 2, y: Math.floor(t / cols) * TS + TS / 2 });
  const byName = new Map(world.nodes.map((n) => [n.name, n]));
  const segs = new Map<string, Seg>();
  const add = (key: string, a: { x: number; y: number }, b: { x: number; y: number }, primary: boolean) => {
    const s = segs.get(key);
    if (s) s.primary ||= primary;
    else segs.set(key, { a, b, primary });
  };
  const stubInto = (n: WorldNode, from: { x: number; y: number }) => {
    const fx = n.foot.x * TS, fy = n.foot.y * TS, fw = n.foot.w * TS, fh = n.foot.h * TS;
    if (!n.atom) return { ...n.center };
    const x = Math.min(Math.max(from.x, fx), fx + fw), y = Math.min(Math.max(from.y, fy), fy + fh);
    const dx = Math.sign(n.center.x - x), dy = Math.sign(n.center.y - y);
    return { x: x + dx * 6, y: y + dy * 6 };
  };
  for (const r of world.roads) {
    if (!r.tiles.length) continue;
    for (let k = 0; k + 1 < r.tiles.length; k++) {
      const [p, q] = [r.tiles[k], r.tiles[k + 1]].sort((m, n) => m - n);
      add(`${p}-${q}`, centre(p), centre(q), r.primary);
    }
    const from = byName.get(r.from), to = byName.get(r.to);
    const first = centre(r.tiles[0]), last = centre(r.tiles[r.tiles.length - 1]);
    if (from) add(`${r.from}@${r.tiles[0]}`, first, stubInto(from, first), r.primary);
    if (to) add(`${r.to}@${r.tiles[r.tiles.length - 1]}`, last, stubInto(to, last), r.primary);
  }
  return [...segs.values()];
}

function paintRoads(img: IndexImage, segs: Seg[], f: number) {
  // f = world px per art px (1 at ts16, 2 at ts8, 4 at ts4)
  const P = (p: { x: number; y: number }) => ({ x: p.x / f, y: p.y / f });
  const outline = f === 1 ? 8 : f === 2 ? 4 : 0;
  const fill = f === 1 ? 5 : f === 2 ? 2 : 1;
  // secondary (second-parent) roads: stepping-stone dots
  for (const s of segs) {
    if (s.primary) continue;
    const a = P(s.a), b = P(s.b);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const gap = f === 1 ? 6 : 3;
    for (let d = 0; d <= len; d += gap) {
      const x = a.x + ((b.x - a.x) * d) / Math.max(len, 1e-6), y = a.y + ((b.y - a.y) * d) / Math.max(len, 1e-6);
      if (f === 1) { disc(img, x, y, 4, C_IDX.charcoal); disc(img, x, y, 2, C_IDX.silver); }
      else disc(img, x, y, 1, f === 2 ? C_IDX.silver : C_IDX.charcoal);
    }
  }
  if (outline) for (const s of segs) if (s.primary) stroke(img, P(s.a), P(s.b), outline, C_IDX.charcoal);
  if (f === 1) {
    // bevelled cobble road: slate bed, silver top shifted up-left, sparse slate setts
    for (const s of segs) if (s.primary) stroke(img, P(s.a), P(s.b), fill + 1, C_IDX.slate);
    const off = (p: { x: number; y: number }) => ({ x: p.x - 0.5, y: p.y - 0.5 });
    for (const s of segs) if (s.primary) stroke(img, off(P(s.a)), off(P(s.b)), fill, C_IDX.silver);
    for (const s of segs) {
      if (!s.primary) continue;
      const a = P(s.a), b = P(s.b);
      const x0 = Math.floor(Math.min(a.x, b.x) - 4), x1 = Math.ceil(Math.max(a.x, b.x) + 4);
      const y0 = Math.floor(Math.min(a.y, b.y) - 4), y1 = Math.ceil(Math.max(a.y, b.y) + 4);
      for (let y = Math.max(0, y0); y < Math.min(img.h, y1); y++) for (let x = Math.max(0, x0); x < Math.min(img.w, x1); x++) {
        const i = y * img.w + x;
        if (img.data[i] === C_IDX.silver && (x * 3 + y * 5) % 11 === 0) img.data[i] = C_IDX.slate;
      }
    }
  } else {
    for (const s of segs) if (s.primary) stroke(img, P(s.a), P(s.b), fill, f === 4 ? C_IDX.charcoal : C_IDX.silver);
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

// Node sprites per evidence look.
export function castleFor(look: NodeLook): IndexImage {
  const base = sprite(CASTLE, { R: C_IDX.blue, r: C_IDX.navy });
  const c = look.filled ? base : recolor(base, { [C_IDX.silver]: C_IDX.slate, [C_IDX.slate]: C_IDX.charcoal, [C_IDX.blue]: C_IDX.slate, [C_IDX.navy]: C_IDX.charcoal });
  const glyph = look.mech ? MECH_GLYPHS[look.mech] : undefined;
  if (glyph) {
    // banner on the keep: red pennant with the mechanism glyph in gold
    blit(c, sprite(BANNER, { R: C_IDX.red }), 11, 10);
    blit(c, sprite(glyph, { x: C_IDX.gold }), 13, 12);
  }
  return c;
}
export function dotFor(look: NodeLook): IndexImage {
  return look.filled
    ? sprite(DOT, { F: C_IDX.gold, D: C_IDX.orange, H: C_IDX.white })
    : sprite(DOT, { F: C_IDX.slate, D: C_IDX.charcoal, H: C_IDX.silver });
}

/** Margin (world px) around a composed node so markers can overhang the footprint. */
export const NODE_PAD = 8;

/**
 * One node as it appears on the map at ts16 (castle ×2 + banner + ground
 * shadow, or level dot), with its evidence marker anchored ON the sprite:
 * the star/sign overlaps the dot's upper-right rim or sits on the right
 * tower's spire. Used by the map and by the status-card portrait.
 */
export function composeNode(atom: boolean, look: NodeLook, shade: number, frame: 0 | 1 = 0): IndexImage {
  const fw = atom ? 64 : 32;
  const img = blank(fw + 2 * NODE_PAD, fw + 2 * NODE_PAD);
  const o = NODE_PAD;
  if (atom) {
    fillRect(img, o + 6, o + 58, fw - 10, 3, shade);
    fillRect(img, o + 10, o + 61, fw - 18, 1, shade);
    blit(img, castleFor(look), o, o, 2);
  } else {
    const d = dotFor(look);
    blit(img, d, o + (fw - d.w) / 2, o + Math.floor((fw - d.h) / 2));
  }
  const mk = look.state === "champion" ? sprite(STAR) : look.state === "provisional" && frame === 0 ? sprite(QSIGN) : null;
  if (mk) {
    if (atom) blit(img, mk, o + fw - 12 - Math.floor(mk.w / 2), o - 6);
    else blit(img, mk, o + 26 - Math.floor(mk.w / 2), o + 1);
  }
  return img;
}

function paintNodes(img: IndexImage, world: World, looks: Map<string, NodeLook>, f: number, frame: 0 | 1) {
  for (const n of world.nodes) {
    const look = looks.get(n.name) ?? { state: "untrained", filled: false };
    const t = Math.floor(n.center.y / TS) * world.cols + Math.floor(n.center.x / TS);
    const shade = biomeOf(world.regions[world.regionOf[t]]?.family ?? n.family).shade;
    let comp = composeNode(n.atom, f === 4 ? { ...look, state: "trained" } : look, shade, frame);
    if (f > 1) comp = downsample(comp, f, (v) => (v === 0 ? 0.8 : v === C_IDX.gold || v === C_IDX.red ? 1.3 : 1));
    blit(img, comp, (n.foot.x * TS - NODE_PAD) / f, (n.foot.y * TS - NODE_PAD) / f);
  }
}

// ———————————————————————— build ————————————————————————

function glyphImages(): Record<string, IndexImage> {
  return Object.fromEntries(Object.entries(GLYPHS).map(([k, rows]) => [k, sprite(rows)]));
}

export function buildLayers(world: World, looks: Map<string, NodeLook>): Layers {
  const g = shapeGround(world);
  const segs = roadSegments(world);
  const glyphs = glyphImages();
  const W = world.cols * TS, H = world.rows * TS;

  const overlay = (img: IndexImage, f: number, frame: 0 | 1) => {
    paintPlazas(img, world, f, glyphs);
    paintRoads(img, segs, f);
    paintBridges(img, world, f);
    paintDecor(img, world, f);
    paintNodes(img, world, looks, f, frame);
    return img;
  };

  const g0 = paintGround(world, g, 0);
  const g1 = paintGround(world, g, 1);
  const mid = downsample(g0, 2, (v) => (v === C_IDX.charcoal ? 0.8 : 1));
  const far = downsample(g0, 4);
  return {
    full: [toCanvas(overlay(g0, 1, 0)), toCanvas(overlay(g1, 1, 1))],
    mid: toCanvas(overlay(mid, 2, 0)),
    far: toCanvas(overlay(far, 4, 0)),
    owner: g.owner,
    w: W,
    h: H,
  };
}

/** 50% ink dither over everything outside one region (region spotlight), at ts16. */
export function spotlight(layers: Layers, regionId: number): HTMLCanvasElement {
  const img = blank(layers.w, layers.h, CLEAR);
  for (let y = 0; y < layers.h; y++) for (let x = 0; x < layers.w; x++) {
    const i = y * layers.w + x;
    if (layers.owner[i] !== regionId && ((x + y) & 1) === 0) img.data[i] = C_IDX.ink;
  }
  return toCanvas(img);
}

