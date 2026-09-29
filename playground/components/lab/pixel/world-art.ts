"use client";

// Round 3 map compositor: the illustrator's art/ system (terrain shading,
// hue-shifted palette, sprite library) + this skin's map logic. All layers
// are palette-index images at ART resolution (art/ ART_PER_TILE = 8 art px
// per tile → 1 art px = 2 world px) covering camera.all (both secret islands).
//
// Bottom → top: renderTerrain (ocean, halo, cliffs, height-lit land, ridges
// along family borders, canopies) · cloud shadows · lineage paths on their
// lanes + chevrons · bridges · city houses (lit = trained atom) · piers ·
// secret-island props · compass · nodes (castles per mechanism with the
// species emblem on the banner; evidence markers with the species emblem) ·
// clouds. Boats, trains, the critter and focus are drawn live (pixel-world).
import { T, type Pt, type World, type WorldNode } from "@/lib/world";
import {
  artBlank, artBlit, artToCanvas, chamfer, parchmentize, inkAroundMask, fbm3, biomeOf as artBiomeOf, type RampName, type TerrainArt, bakeCloudShadow, capital, castleSprite, isletBlobs, cloudSpots, cloudSprites, darker, markerSprite, props,
  RAMPS, renderTerrain, SHADOW, CLEAR, type ArtImage, type EmblemMask, type Sprite, Painter,
} from "./art";
import type { NodeLook } from "./terrain";
import { downsample } from "./raster";
import { composeAuthored } from "./art/authored";
import { buildMapV3 } from "./world-v3";

export type ArtEmblems = Map<string, Map<number, EmblemMask>>;

export interface ArtLayers {
  /** world px of art pixel (0, 0) */
  origin: Pt;
  /** world px per art px */
  px: number;
  w: number;
  h: number;
  full: HTMLCanvasElement;
  dim: HTMLCanvasElement;
  far: HTMLCanvasElement;
  farDim: HTMLCanvasElement;
  raw: ArtImage;
  region: Int8Array;
}

type P = { x: number; y: number };

// ————————————————————————————— painting helpers —————————————————————————————

function put(img: ArtImage, x: number, y: number, v: number) {
  x = Math.round(x); y = Math.round(y);
  if (x >= 0 && y >= 0 && x < img.w && y < img.h) img.data[y * img.w + x] = v;
}
function get(img: ArtImage, x: number, y: number) {
  x = Math.round(x); y = Math.round(y);
  return x >= 0 && y >= 0 && x < img.w && y < img.h ? img.data[y * img.w + x] : CLEAR;
}

/** Walk a polyline in 0.5-px steps, calling `f` on each rounded pixel once. */
function walkPoly(pts: P[], f: (x: number, y: number) => void) {
  const seen = new Set<number>();
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2));
    for (let s = 0; s <= n; s++) {
      const x = Math.round(a.x + ((b.x - a.x) * s) / n), y = Math.round(a.y + ((b.y - a.y) * s) / n);
      const k = y * 100000 + x;
      if (seen.has(k)) continue;
      seen.add(k);
      f(x, y);
    }
  }
}

/** A 3-px "V" pointing along `angle`, as pixel offsets. */
export function chevronOffsets(angle: number, arm = 1): [number, number][] {
  const out: [number, number][] = [];
  const c = Math.cos(angle), s = Math.sin(angle);
  for (let p = -arm; p <= arm; p++) {
    const u = -Math.abs(p), w = p;
    out.push([Math.round(u * c - w * s), Math.round(u * s + w * c)]);
  }
  return out;
}

/** Road polylines to draw: each road's lane, plus stubs into derived markers' feet. */
export function compassArt(): ArtImage {
  return outlined(scale2(props.compass().img), RAMPS.ui[0]);
}

export function roadPolys(world: World): { road: World["roads"][number]; pts: Pt[] }[] {
  const byName = new Map(world.nodes.map((n) => [n.name, n]));
  return world.roads.map((road) => {
    const base = road.lanePoints.length ? road.lanePoints : road.points;
    const pts: Pt[] = [...base];
    const a = byName.get(road.from), b = byName.get(road.to);
    if (a && !a.atom && pts.length) pts.unshift({ ...a.center });
    if (b && !b.atom && pts.length) pts.push({ ...b.center });
    return { road, pts };
  });
}

// small evidence pennants for atoms (castles carry no marker of their own)
function atomBadge(state: NodeLook["state"]): Sprite | null {
  if (state === "champion") {
    const p = new Painter(9, 9);
    p.rows(0, 0, [
      "....a....",
      "...aba...",
      "aaaabbaaa",
      ".abbccba.",
      "..abcba..",
      ".abbabba.",
      ".ab...ba.",
      "a.......a",
    ], { a: ["gold", 0], b: ["gold", 3], c: ["gold", 4] });
    return p.done({ x: 4, y: 8 });
  }
  if (state === "provisional") {
    const p = new Painter(7, 10);
    p.rows(0, 0, [
      "aaaaaaa",
      "abbbbba",
      "abbccba",
      "abbbcba",
      "abbcbba",
      "abbbbba",
      "abbcbba",
      "aaaaaaa",
      "...a...",
      "...a...",
    ], { a: ["wood", 1], b: ["wood", 4], c: ["roof", 1] });
    return p.done({ x: 3, y: 9 });
  }
  return null;
}

/** The sprite a node stands as on the map (also the card portrait). */
export function nodeSprite(n: Pick<WorldNode, "name" | "atom">, look: NodeLook, emblems: ArtEmblems | null): Sprite {
  if (n.atom) {
    const base = castleSprite(n.name, emblems?.get(n.name)?.get(9));
    const badge = atomBadge(look.state);
    if (!badge && look.filled) return base;
    const p = new Painter(base.img.w + 6, base.img.h + 4);
    artBlit(p.img, base.img, 0, 4);
    if (!look.filled) for (let i = 0; i < p.img.data.length; i++) if (p.img.data[i] !== CLEAR) p.img.data[i] = darker(p.img.data[i]);
    if (badge) {
      // anchor the badge ON the castle: at the top of its right-hand silhouette
      let top = base.img.h;
      for (let y = 0; y < base.img.h && top === base.img.h; y++) for (let x = base.img.w - 12; x < base.img.w; x++) {
        if (base.img.data[y * base.img.w + x] !== CLEAR) { top = y; break; }
      }
      artBlit(p.img, badge.img, base.img.w - 9, Math.max(0, top + 4 - badge.img.h + 3));
    }
    return { ...base, img: p.img, anchor: { x: base.anchor.x, y: base.anchor.y + 4 } };
  }
  return markerSprite(look.state, n.name, emblems?.get(n.name)?.get(7));
}

/** Secret-island slots nudged onto their islet (art/ isletBlobs staggers islets up/down). */
export function islandSlots(island: World["hiddenIsland"]): Pt[] {
  const blobs = isletBlobs(island).filter((b) => !b.extra);
  const slots = island.slots;
  if (!slots.length) return [];
  const groups = blobs.length;
  const out: Pt[] = [];
  for (let gi = 0; gi < groups; gi++) {
    const g = slots.slice(Math.round((gi * slots.length) / groups), Math.round(((gi + 1) * slots.length) / groups));
    const mean = g.reduce((a, p) => a + p.y, 0) / g.length;
    for (const p of g) out.push({ x: p.x, y: p.y + (blobs[gi].cy - mean) });
  }
  return out;
}

function scale2(src: ArtImage): ArtImage {
  const out = artBlank(src.w * 2, src.h * 2);
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) out.data[y * out.w + x] = src.data[(y >> 1) * src.w + (x >> 1)];
  return out;
}
function outlined(src: ArtImage, ink: number): ArtImage {
  const out = artBlank(src.w + 2, src.h + 2);
  artBlit(out, src, 1, 1);
  const d = new Uint8Array(out.data);
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
    if (d[y * out.w + x] !== CLEAR) continue;
    const n = [d[(y - 1) * out.w + x], d[(y + 1) * out.w + x], x > 0 ? d[y * out.w + x - 1] : CLEAR, x < out.w - 1 ? d[y * out.w + x + 1] : CLEAR];
    if (n.some((v) => v !== undefined && v !== CLEAR)) out.data[y * out.w + x] = ink;
  }
  return out;
}

/** The hub atom of each family (most descendants): its capital shows on the far overview. */
export function familyHubs(world: World): Map<string, WorldNode> {
  const kids = new Map<string, number>();
  for (const r of world.roads) kids.set(r.from, (kids.get(r.from) ?? 0) + 1);
  const hubs = new Map<string, WorldNode>();
  for (const n of world.nodes) if (n.atom) {
    const cur = hubs.get(n.family);
    if (!cur || (kids.get(n.name) ?? 0) > (kids.get(cur.name) ?? 0)) hubs.set(n.family, n);
  }
  return hubs;
}

/**
 * The far overview (mobile): terrain rendered NATIVELY at 3 art px per tile
 * (not a downsample) — halo, cliffs, biomes, relief read at 1 CSS px per art
 * px — plus thin primary roads and one 12×15 micro-castle per family hub.
 */
export function buildMiniLayer(world: World, emblems: ArtEmblems | null, theme: Theme = "parchment"): { origin: Pt; px: number; canvas: HTMLCanvasElement } {
  const t = renderTerrain(world, { artPerTile: 3, extent: "all", canopies: true, ...(theme === "parchment" ? CONTINENT : {}) });
  const img = t.img;
  const A = (p: P): P => ({ x: (p.x - t.origin.x) / t.px, y: (p.y - t.origin.y) / t.px });
  for (const { road, pts } of roadPolys(world)) {
    if (road.kind === "bridge" || !road.primary) continue;
    walkPoly(pts.map(A), (x, y) => put(img, x, y, RAMPS.wood[1]));
  }
  for (const hub of familyHubs(world).values()) {
    const big = castleSprite(hub.name, emblems?.get(hub.name)?.get(9)).img;
    const mini = downsample(big, 3, (v) => (v === RAMPS.ui[0] ? 0.7 : 1));
    const c = A({ x: hub.center.x, y: (hub.foot.y + hub.foot.h) * 16 });
    artBlit(img, mini, c.x - mini.w / 2, c.y - mini.h + 1);
  }
  return { origin: t.origin, px: t.px, canvas: artToCanvas(theme === "parchment" ? parchmentize(img, t.land, 3) : img) };
}

/**
 * ONE CONTINENT (parchment): elevation drives colour across family borders —
 * coast sand → lowland green → forest → rock → snow, as in the T4 reference.
 * Each family keeps its biome KEY (dune crests, savanna shrubs, lava cracks,
 * crystal glints, frost, its own canopy species) as the accent; stronger
 * relief + slope-light contrast so hills and ranges read at overview zoom.
 */
const CONTINENT = {
  biomeFor: (family: string) => {
    const b = artBiomeOf(family);
    const forest: RampName = b.key === "ice" || b.key === "crystal" ? "pine" : b.key === "savanna" || b.key === "dunes" ? "olive" : "forest";
    return { ...b, low: "sand" as RampName, mid: "meadow" as RampName, high: "rock" as RampName, peak: "snow" as RampName, forest, canopy: Math.max(b.canopy, 0.4) };
  },
  relief: 1.35,
  lightGain: 1.8,
};

/**
 * Tiny islets scattered on the parchment sea (cartographic atmosphere, like the
 * reference): lumpy sand/grass blobs lit top-left, far from every coast and
 * from the secret islands; the parchment pass then hatches round them.
 */
function seaIslets(img: ArtImage, t: TerrainArt, apt: number) {
  const W = img.w, H = img.h;
  const dist = chamfer(t.land, W, H, 400);
  const cell = Math.round(apt * 9);
  const h = (x: number, y: number, k: number) => { const v = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453; return v - Math.floor(v); };
  for (let gy = cell; gy < H - cell; gy += cell) for (let gx = cell; gx < W - cell; gx += cell) {
    if (h(gx, gy, 1) > 0.34) continue;
    const cx = gx + Math.floor(h(gx, gy, 2) * cell * 0.6), cy = gy + Math.floor(h(gx, gy, 3) * cell * 0.6);
    const r = Math.max(2, Math.round((2 + h(gx, gy, 4) * 3) * (apt / 8)));
    if (dist[cy * W + cx] < apt * 5 + r || t.region[cy * W + cx] < -1) continue;
    const grassy = h(gx, gy, 5) < 0.5;
    for (let dy = -r - 1; dy <= r + 1; dy++) for (let dx = -r - 2; dx <= r + 2; dx++) {
      const e = (dx * dx) / ((r + 1.2) ** 2) + (dy * dy) / ((r * 0.75 + 0.6) ** 2) + (h(cx + dx, cy + dy, 6) - 0.5) * 0.25;
      if (e > 1) continue;
      const lit = dx + dy < -r * 0.4, dark = dx + dy > r * 0.6;
      const ramp = grassy && e < 0.55 ? RAMPS.meadow : RAMPS.sand;
      const k = dark ? 2 : lit ? ramp.length - 2 : ramp.length - 3;
      const x = cx + dx, y = cy + dy;
      if (x >= 0 && y >= 0 && x < W && y < H) img.data[y * W + x] = ramp[k];
    }
  }
}

/**
 * Variety INSIDE each family (owner: "more variations of colour", T4 palette):
 * low-frequency patches re-shade the biome's ground onto a neighbour ramp at
 * the SAME relative step, so slope light and relief survive — orange-ochre sand
 * patches in the lowlands, yellow-green meadows, grassy savanna in the dunes,
 * red-brown outcrops on the uplands. Road / footprint / set-piece tiles stay calm.
 */
function biomeMix(world: World, t: TerrainArt, apt: number) {
  const img = t.img, W = img.w, H = img.h;
  type Mix = { to: RampName; seed: number; lo: number; hi: number; hMin: number; hMax: number };
  const MIX: Record<string, Mix[]> = {
    meadow:  [{ to: "sand", seed: 11, lo: 0.7, hi: 2, hMin: 0, hMax: 0.3 }, { to: "savanna", seed: 12, lo: 0, hi: 0.24, hMin: 0.1, hMax: 0.45 }],
    savanna: [{ to: "savanna", seed: 13, lo: 0.46, hi: 2, hMin: 0, hMax: 0.6 }, { to: "sand", seed: 14, lo: 0, hi: 0.26, hMin: 0, hMax: 0.4 }],
    dunes:   [{ to: "sand", seed: 15, lo: 0.44, hi: 2, hMin: 0, hMax: 0.6 }, { to: "savanna", seed: 16, lo: 0, hi: 0.34, hMin: 0, hMax: 0.6 }],
    volcanic:[{ to: "rock", seed: 17, lo: 0.42, hi: 2, hMin: 0, hMax: 0.7 }, { to: "sand", seed: 22, lo: 0, hi: 0.24, hMin: 0, hMax: 0.35 }],
    ice:     [{ to: "frost", seed: 18, lo: 0.44, hi: 2, hMin: 0.15, hMax: 0.7 }, { to: "snow", seed: 19, lo: 0, hi: 0.22, hMin: 0.35, hMax: 1 }],
    crystal: [{ to: "stone", seed: 20, lo: 0.4, hi: 2, hMin: 0.1, hMax: 1 }, { to: "magic", seed: 21, lo: 0, hi: 0.12, hMin: 0.3, hMax: 1 }],
  };
  const stepIn = new Map<number, { ramp: number[]; k: number }>();
  const TS = 16, px = t.px;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!t.land[i] || t.region[i] < 0) continue;
    const reg = world.regions[t.region[i]];
    if (!reg) continue;
    const b = CONTINENT.biomeFor(reg.family);
    const mixes = MIX[b.key];
    if (!mixes) continue;
    const tx = Math.floor((t.origin.x + (x + 0.5) * px) / TS), ty = Math.floor((t.origin.y + (y + 0.5) * px) / TS);
    const code = tx >= 0 && ty >= 0 && tx < world.cols && ty < world.rows ? world.terrain[ty * world.cols + tx] : T.SEA;
    void code; // colour patches cross roads too (only relief is kept calm there) — no tile-shaped squares
    const v = img.data[i];
    const mid = RAMPS[b.mid];
    const k = mid.indexOf(v);
    if (k < 0) continue;                                   // only the biome's own ground is re-shaded
    const hh = t.height[i];
    for (const m of mixes) {
      if (hh < m.hMin || hh > m.hMax) continue;
      const n = fbm3(x / apt, y / apt, m.seed, 7);
      if (n < m.lo || n > m.hi) continue;
      const to = RAMPS[m.to];
      img.data[i] = to[Math.max(0, Math.min(to.length - 1, Math.round((k / Math.max(1, mid.length - 1)) * (to.length - 1))))];
      break;
    }
  }
  void stepIn;
}

// ————————————————————————————— compose —————————————————————————————

export type Theme = "parchment" | "ocean";

/**
 * Sprite detail tier per art resolution (art px per tile). Each value is the
 * integer downsample factor of the full sprite (1 = full detail), 0 = not drawn.
 * At 8 art px per tile a castle (36×46) stands on its 4×4-tile footprint (32 px).
 */
export function tierFor(apt: number) {
  // castles never below ÷2 (distinct silhouettes); derived models become clean pips (−1)
  if (apt >= 6) return { castle: 1, marker: 1, house: 1, peak: 1, prop: 1, live: 2, hubsOnly: false };
  if (apt >= 4) return { castle: 2, marker: 2, house: 2, peak: 2, prop: 2, live: 2, hubsOnly: false };
  if (apt >= 2) return { castle: 2, marker: -1, house: 3, peak: 3, prop: 3, live: 2, hubsOnly: false };
  return { castle: 2, marker: 0, house: 0, peak: 0, prop: 0, live: 3, hubsOnly: true };
}

/** A derived model at the overview: 5×5 evidence-coloured pip, 1px ink outline (7×7). */
export function pipSprite(state: NodeLook["state"]): ArtImage {
  const fill = state === "champion" ? RAMPS.gold[3] : state === "trained" ? RAMPS.banner[2] : state === "provisional" ? RAMPS.stone[4] : RAMPS.stone[2];
  const lite = state === "champion" ? RAMPS.gold[4] : state === "trained" ? RAMPS.banner[3] : RAMPS.stone[5];
  const rows = [".ooooo.", "oLffffo", "offfffo", "offfffo", "offfffo", "offfffo", ".ooooo."];
  const img = artBlank(7, 7);
  rows.forEach((r, y) => { for (let x = 0; x < 7; x++) { const c = r[x]; if (c !== ".") img.data[y * 7 + x] = c === "o" ? RAMPS.ink[0] : c === "L" ? lite : fill; } });
  if (state === "provisional") { img.data[2 * 7 + 3] = RAMPS.ink[0]; img.data[4 * 7 + 3] = RAMPS.ink[0]; }
  return img;
}

export function buildArtLayers(world: World, looks: Map<string, NodeLook>, emblems: ArtEmblems | null, apt = 8, theme: Theme = "parchment"): ArtLayers {
  // round 5: parchment = the owner's final map on world v3 + the zone art library
  if (theme === "parchment" && world.preset === "pixel" && world.zones?.length) return buildMapV3(world, looks, emblems, apt);
  const ink = theme === "parchment";
  const clouds = cloudSprites(apt >= 8 ? 4 : 3).map((s) => s.img);
  // parchment = the illustrator's AUTHORED continent (calm designed fields, heroes,
  // ranges, clusters, paper sea + coast hatching); ocean keeps the procedural terrain
  // SYNTHESIS: the authored skeleton (silhouette, coasts, hatching, rivers, heroes,
  // stamps) with the ground painted by our one-continent elevation shading, calmed
  // (no speck dots, big coherent patches, slope light kept) + biome patches
  let shaded: TerrainArt | null = null;
  if (ink) {
    shaded = renderTerrain(world, { extent: "all", artPerTile: apt, ...CONTINENT, calm: true, canopies: apt >= 4 });
    biomeMix(world, shaded, apt);
  }
  const sh = shaded;
  const groundAt = sh ? (wx: number, wy: number) => {
    const x = Math.floor((wx - sh.origin.x) / sh.px), y = Math.floor((wy - sh.origin.y) / sh.px);
    if (x < 0 || y < 0 || x >= sh.img.w || y >= sh.img.h) return undefined;
    const j = y * sh.img.w + x;
    if (!sh.land[j] || sh.region[j] < 0) return undefined;
    const v = sh.img.data[j];
    return RAMPS.shallow.includes(v) || RAMPS.ocean.includes(v) ? undefined : v;
  } : undefined;
  const au = ink ? composeAuthored(world, apt, { sea: "paper", ground: groundAt }) : null;
  const t: TerrainArt = au
    ? { img: au.img, origin: au.origin, px: au.px, artPerTile: apt, height: new Float32Array(au.w * au.h), land: au.land, region: au.region, timings: au.timings }
    : renderTerrain(world, { extent: "all", artPerTile: apt, ...(ink ? CONTINENT : {}) });
  let img = t.img;
  const A = (p: P): P => ({ x: (p.x - t.origin.x) / t.px, y: (p.y - t.origin.y) / t.px });
  // parchment has no clouds: the paper is the sky and the sea
  const spots = ink ? [] : cloudSpots(world, t, clouds);
  for (const s of spots) bakeCloudShadow(img, s.img, s.x, s.y);
  if (ink && !au) biomeMix(world, t, apt);
  // sprite mask: every opaque pixel of a painted landmark (for the ink outline pass)
  const mask = new Uint8Array(img.w * img.h);
  const blitM = (dst: ArtImage, src: ArtImage, x: number, y: number, flip = false) => {
    artBlit(dst, src, x, y, flip);
    if (!ink) return;
    x = Math.round(x); y = Math.round(y);
    for (let sy = 0; sy < src.h; sy++) for (let sx = 0; sx < src.w; sx++) {
      if (src.data[sy * src.w + (flip ? src.w - 1 - sx : sx)] === CLEAR) continue;
      const px = x + sx, py = y + sy;
      if (px >= 0 && py >= 0 && px < dst.w && py < dst.h) mask[py * dst.w + px] = 1;
    }
  };

  // lineage paths on their lanes: cross-family roads are pressed trails (quiet),
  // primary roads packed-earth paths with a shadow-side edge, second parents stepping stones
  const polys = roadPolys(world).map(({ road, pts }) => ({ road, pts: pts.map(A) }));
  if (ink) {
    // parchment: lineage routes are dotted maroon ink with small arrowheads; second
    // parents a sparser dot; cross-family routes a faint dash
    for (const { road, pts } of polys) {
      let k = 0;
      const primary = road.kind !== "bridge" && road.primary;
      walkPoly(pts, (x, y) => {
        const on = primary ? k % 3 < 2 : road.kind === "bridge" ? k % 6 < 2 : k % 3 === 0;
        k++;
        if (on) put(img, x, y, primary ? RAMPS.ink[0] : RAMPS.ink[1]);
      });
    }
    for (const { road } of polys) if (road.kind !== "bridge") for (const ch of road.chevrons) {
      const c = A(ch);
      for (const [dx, dy] of chevronOffsets(ch.angle, apt >= 4 ? 2 : 1)) put(img, c.x + dx, c.y + dy, RAMPS.ink[0]);
    }
  }
  if (!ink) {
  for (const { road, pts } of polys) if (road.kind === "bridge") walkPoly(pts, (x, y) => put(img, x, y, SHADOW[get(img, x, y)] ?? get(img, x, y)));
  for (const { road, pts } of polys) if (road.kind !== "bridge" && !road.primary) {
    let k = 0;
    walkPoly(pts, (x, y) => { if (k++ % 3 === 0) { put(img, x + 1, y + 1, RAMPS.wood[2]); put(img, x, y, RAMPS.sand[5]); } });
  }
  const main = polys.filter((p) => p.road.kind !== "bridge" && p.road.primary);
  // 3-art-px two-tone road: dark hue-shifted edge, light cobble core, soft cast shadow
  for (const { pts } of main) walkPoly(pts, (x, y) => { for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) if (dx === 2 || dy === 2) put(img, x + dx, y + dy, SHADOW[get(img, x + dx, y + dy)] ?? get(img, x + dx, y + dy)); });
  for (const { pts } of main) walkPoly(pts, (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) put(img, x + dx, y + dy, RAMPS.wood[1]); });
  for (const { pts } of main) walkPoly(pts, (x, y) => { put(img, x, y, RAMPS.sand[5]); });
  // direction arrows (parent → child): a bold dark V across the road
  for (const { road } of polys) if (road.kind !== "bridge") for (const ch of road.chevrons) {
    const c = A(ch);
    for (const [dx, dy] of chevronOffsets(ch.angle, 2)) { put(img, c.x + dx, c.y + dy, RAMPS.wood[0]); put(img, c.x + dx - Math.round(Math.cos(ch.angle)), c.y + dy - Math.round(Math.sin(ch.angle)), RAMPS.wood[0]); }
  }

  }

  // ——— landmarks, drawn in DETAIL TIERS so they sit on the same art grid as the
  // terrain at every level (adaptive resolution: the grid is fixed, detail changes)
  const tier = tierFor(apt);
  const T_ = (img0: ArtImage, f: number) => (f <= 1 ? img0 : downsample(img0, f, (v) => (v === RAMPS.ui[0] || v === CLEAR ? 0.8 : 1)));
  const TS = 16;
  const hubs = familyHubs(world);
  const hubNames = new Set([...hubs.values()].map((n) => n.name));

  // faceted ridges along family borders no lineage crosses (lit / shadow faces, snow caps)
  if (tier.peak) {
    const peaks: P[] = [];
    const gap = 11 * (apt / 8) * tier.peak + 2;
    for (const line of world.mountains) {
      let carry = 0;
      for (let i = 1; i < line.length; i++) {
        const a = A(line[i - 1]), b = A(line[i]);
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        for (let d = carry; d < len; d += gap) peaks.push({ x: a.x + ((b.x - a.x) * d) / len, y: a.y + ((b.y - a.y) * d) / len });
        carry = Math.max(0, carry + Math.ceil((len - carry) / gap) * gap - len);
      }
    }
    peaks.sort((p, q) => p.y - q.y);
    peaks.forEach((pk, i) => {
      const sp = props.snowPeak(i % 3 === 1 ? "stone" : "rock");
      const im = T_(sp.img, tier.peak), ax = sp.anchor.x / tier.peak, ay = sp.anchor.y / tier.peak;
      const flip = i % 2 === 1;
      blitM(img, im, pk.x - (flip ? im.w - 1 - ax : ax), pk.y - ay + ((i * 3) % 4) / tier.peak, flip);
    });
  }

  // bridges: planks across the river
  if (tier.prop) {
    const bh = T_(props.bridge("h").img, tier.prop), bv = T_(props.bridge("v").img, tier.prop);
    for (const br of world.bridges) for (const tile of br.tiles) {
      const c = A({ x: (tile % world.cols) * TS + TS / 2, y: Math.floor(tile / world.cols) * TS + TS / 2 });
      const im = br.axis === "h" ? bh : bv;
      blitM(img, im, c.x - im.w / 2, c.y - im.h / 2);
    }
  }

  // cities: one house per block, lit when the atom has runs or a champion;
  // capitals (hub atoms) get the domed hall at the heart of their blocks
  if (tier.house) for (const city of world.cities) {
    const lit = looks.get(city.node)?.filled ?? false;
    let hall: { x0: number; y0: number; x1: number; y1: number } | null = null;
    if (city.capital && city.blocks.length) {
      const cap = capital(0);
      const im = T_(cap.img, tier.house);
      const cx = city.blocks.reduce((a, b) => a + b.x + b.w / 2, 0) / city.blocks.length;
      const cy = city.blocks.reduce((a, b) => a + b.y + b.h, 0) / city.blocks.length;
      const c = A({ x: cx, y: cy });
      const x0 = c.x - cap.anchor.x / tier.house, y0 = c.y - cap.anchor.y / tier.house;
      blitM(img, im, x0, y0);
      hall = { x0, y0, x1: x0 + im.w, y1: y0 + im.h };
    }
    city.blocks.forEach((b, i) => {
      const hs = props.house(i % 4, lit);
      const im = T_(hs.img, tier.house);
      const c = A({ x: b.x + b.w / 2, y: b.y + b.h });
      if (hall && c.x > hall.x0 - 2 && c.x < hall.x1 + 2 && c.y > hall.y0 && c.y < hall.y1 + 4) return;
      blitM(img, im, c.x - hs.anchor.x / tier.house, c.y - hs.anchor.y / tier.house);
    });
  }

  // harbour piers (boats are live sprites)
  if (tier.prop) {
    const pier = props.pier();
    const im = T_(pier.img, tier.prop);
    for (const h of world.harbours) if (h.boats > 0) {
      const c = A(h.pt);
      blitM(img, im, c.x - pier.anchor.x / tier.prop, c.y - pier.anchor.y / tier.prop);
    }
  }

  // secret islands: next-era stones + a dragon; ruins
  if (tier.prop) {
    const f = tier.prop;
    const qs = props.questionStone(), ru = props.ruins(), dr = props.dragon();
    for (const s2 of islandSlots(world.hiddenIsland)) { const c = A(s2); blitM(img, T_(qs.img, f), c.x - qs.anchor.x / f, c.y - qs.anchor.y / f); }
    { const c = A(world.hiddenIsland.dragons); blitM(img, T_(dr.img, f), c.x - dr.anchor.x / f, c.y - dr.anchor.y / f); }
    // ruins vary per slot: the arch, the mirrored arch, a lone broken column
    const col = { ...ru.img, w: 12, data: (() => { const d = new Uint8Array(12 * ru.img.h); for (let y = 0; y < ru.img.h; y++) for (let x = 0; x < 12; x++) d[y * 12 + x] = ru.img.data[y * ru.img.w + x]; return d; })() };
    islandSlots(world.ruinsIsland).forEach((s2, k) => {
      const c = A(s2);
      const v = k % 3, im = v === 2 ? col : ru.img;
      blitM(img, T_(im, f), c.x - (v === 2 ? 6 : ru.anchor.x) / f, c.y - ru.anchor.y / f, v === 1);
    });
  }
  void outlined; void scale2;

  // nodes, back to front (far tier: only each family's hub castle, as a micro-sprite)
  const nodes = [...world.nodes].sort((a, b) => a.center.y - b.center.y);
  for (const n of nodes) {
    const f = n.atom ? tier.castle : tier.marker;
    if (!f || (tier.hubsOnly && !hubNames.has(n.name))) continue;
    const look = looks.get(n.name) ?? { state: "untrained" as const, filled: false };
    if (f === -1) {
      const pip = pipSprite(look.state);
      const c = A(n.center);
      blitM(img, pip, c.x - 3, c.y - 3);
      continue;
    }
    const sp = nodeSprite(n, look, emblems);
    const im = T_(sp.img, f), ax = sp.anchor.x / f, ay = sp.anchor.y / f;
    const foot = A({ x: n.center.x, y: (n.foot.y + n.foot.h) * TS });
    if (sp.shadow && f === 1) for (let y = 0; y < sp.shadow.h; y++) for (let x = 0; x < sp.shadow.w; x++) {
      if (sp.shadow.data[y * sp.shadow.w + x] === CLEAR) continue;
      const px2 = Math.round(foot.x - sp.anchor.x + x), py = Math.round(foot.y - sp.anchor.y + y);
      put(img, px2, py, SHADOW[get(img, px2, py)] ?? get(img, px2, py));
    }
    blitM(img, im, foot.x - ax, foot.y - ay);
  }

  for (const s of spots) artBlit(img, s.img, s.x, s.y);

  if (ink && !au) seaIslets(img, t, apt);
  if (ink && !au) img = parchmentize(img, t.land, apt);
  if (ink) inkAroundMask(img, mask);
  const dimImg: ArtImage = { w: img.w, h: img.h, data: img.data.map((v) => (v === CLEAR ? v : darker(v))) };
  const full = artToCanvas(img), dim = artToCanvas(dimImg);
  return {
    origin: t.origin, px: t.px, w: img.w, h: img.h,
    full, dim, far: full, farDim: dim,
    raw: img, region: t.region,
  };
}

/** The full-value layer cut to one region's land (pixel-exact along its coast). */
export function regionCut(layers: ArtLayers, regionId: number): HTMLCanvasElement {
  const out = artBlank(layers.w, layers.h);
  for (let i = 0; i < out.data.length; i++) if (layers.region[i] === regionId) out.data[i] = layers.raw.data[i];
  return artToCanvas(out);
}
