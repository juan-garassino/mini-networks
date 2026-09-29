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
import type { Pt, World, WorldNode } from "@/lib/world";
import {
  artBlank, artBlit, artToCanvas, parchmentize, bakeCloudShadow, capital, castleSprite, isletBlobs, cloudSpots, cloudSprites, darker, markerSprite, props,
  RAMPS, renderTerrain, SHADOW, CLEAR, type ArtImage, type EmblemMask, type Sprite, Painter,
} from "./art";
import type { NodeLook } from "./terrain";
import { downsample } from "./raster";

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
  const blobs = isletBlobs(island);
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
  const t = renderTerrain(world, { artPerTile: 3, extent: "all", canopies: true });
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

// ————————————————————————————— compose —————————————————————————————

export type Theme = "parchment" | "ocean";

export function buildArtLayers(world: World, looks: Map<string, NodeLook>, emblems: ArtEmblems | null, apt = 8, theme: Theme = "parchment"): ArtLayers {
  const ink = theme === "parchment";
  const clouds = cloudSprites(apt >= 8 ? 4 : 3).map((s) => s.img);
  const t = renderTerrain(world, { extent: "all", artPerTile: apt });
  let img = t.img;
  const A = (p: P): P => ({ x: (p.x - t.origin.x) / t.px, y: (p.y - t.origin.y) / t.px });
  // parchment has no clouds: the paper is the sky and the sea
  const spots = ink ? [] : cloudSpots(world, t, clouds);
  for (const s of spots) bakeCloudShadow(img, s.img, s.x, s.y);

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
      for (const [dx, dy] of chevronOffsets(ch.angle, 2)) put(img, c.x + dx, c.y + dy, RAMPS.ink[0]);
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

  // faceted ridges along family borders no lineage crosses (lit / shadow faces, snow caps)
  const peaks: P[] = [];
  for (const line of world.mountains) {
    let carry = 0;
    for (let i = 1; i < line.length; i++) {
      const a = A(line[i - 1]), b = A(line[i]);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      for (let d = carry; d < len; d += 11) peaks.push({ x: a.x + ((b.x - a.x) * d) / len, y: a.y + ((b.y - a.y) * d) / len });
      carry = Math.max(0, carry + Math.ceil((len - carry) / 11) * 11 - len);
    }
  }
  peaks.sort((p, q) => p.y - q.y);
  peaks.forEach((pk, i) => {
    const s = props.snowPeak(i % 3 === 1 ? "stone" : "rock");
    const flip = i % 2 === 1;
    artBlit(img, s.img, pk.x - (flip ? s.img.w - 1 - s.anchor.x : s.anchor.x), pk.y - s.anchor.y + ((i * 3) % 4), flip);
  });

  // bridges: planks across the river
  const TS = 16;
  const bh = props.bridge("h"), bv = props.bridge("v");
  for (const br of world.bridges) for (const tile of br.tiles) {
    const c = A({ x: (tile % world.cols) * TS + TS / 2, y: Math.floor(tile / world.cols) * TS + TS / 2 });
    const s = br.axis === "h" ? bh : bv;
    artBlit(img, s.img, c.x - s.img.w / 2, c.y - s.img.h / 2);
  }

  // cities: one house per block, lit when the atom has runs or a champion;
  // capitals (hub atoms) get the domed hall at the heart of their blocks
  for (const city of world.cities) {
    const lit = looks.get(city.node)?.filled ?? false;
    let hall: { x0: number; y0: number; x1: number; y1: number } | null = null;
    if (city.capital && city.blocks.length) {
      const cap = capital(0);
      const cx = city.blocks.reduce((a, b) => a + b.x + b.w / 2, 0) / city.blocks.length;
      const cy = city.blocks.reduce((a, b) => a + b.y + b.h, 0) / city.blocks.length;
      const c = A({ x: cx, y: cy });
      const x0 = c.x - cap.anchor.x, y0 = c.y - cap.anchor.y;
      artBlit(img, cap.img, x0, y0);
      hall = { x0, y0, x1: x0 + cap.img.w, y1: y0 + cap.img.h };
    }
    city.blocks.forEach((b, i) => {
      const s = props.house(i % 4, lit);
      const c = A({ x: b.x + b.w / 2, y: b.y + b.h });
      if (hall && c.x > hall.x0 - 4 && c.x < hall.x1 + 4 && c.y > hall.y0 && c.y < hall.y1 + 8) return;
      artBlit(img, s.img, c.x - s.anchor.x, c.y - s.anchor.y);
    });
  }

  // harbour piers (boats are live sprites)
  const pier = props.pier();
  for (const h of world.harbours) if (h.boats > 0) {
    const c = A(h.pt);
    artBlit(img, pier.img, c.x - pier.anchor.x, c.y - pier.anchor.y);
  }

  // secret islands: next-era stones + a dragon; ruins
  const qs = props.questionStone(), ru = props.ruins(), dr = props.dragon();
  for (const s of islandSlots(world.hiddenIsland)) { const c = A(s); artBlit(img, qs.img, c.x - qs.anchor.x, c.y - qs.anchor.y); }
  { const c = A(world.hiddenIsland.dragons); artBlit(img, dr.img, c.x - dr.anchor.x, c.y - dr.anchor.y); }
  for (const s of islandSlots(world.ruinsIsland)) { const c = A(s); artBlit(img, ru.img, c.x - ru.anchor.x, c.y - ru.anchor.y); }

  // compass rose in the emptiest sea (north is up)
  // (the compass rose is screen furniture now: pixel-world pins it to a corner)
  void outlined; void scale2;

  // nodes, back to front
  const nodes = [...world.nodes].sort((a, b) => a.center.y - b.center.y);
  for (const n of nodes) {
    const look = looks.get(n.name) ?? { state: "untrained" as const, filled: false };
    const s = nodeSprite(n, look, emblems);
    const foot = A({ x: n.center.x, y: (n.foot.y + n.foot.h) * TS });
    if (s.shadow) for (let y = 0; y < s.shadow.h; y++) for (let x = 0; x < s.shadow.w; x++) {
      if (s.shadow.data[y * s.shadow.w + x] === CLEAR) continue;
      const px = Math.round(foot.x - s.anchor.x + x), py = Math.round(foot.y - s.anchor.y + y);
      put(img, px, py, SHADOW[get(img, px, py)] ?? get(img, px, py));
    }
    artBlit(img, s.img, foot.x - s.anchor.x, foot.y - s.anchor.y);
  }

  for (const s of spots) artBlit(img, s.img, s.x, s.y);

  if (ink) img = parchmentize(img, t.land, apt);
  const dimImg: ArtImage = { w: img.w, h: img.h, data: img.data.map((v) => (v === CLEAR ? v : darker(v))) };
  const farImg = downsample(img, 2, (v) => (v === RAMPS.ui[0] ? 0.8 : 1));
  const farDim = { w: farImg.w, h: farImg.h, data: farImg.data.map((v) => (v === CLEAR ? v : darker(v))) };
  return {
    origin: t.origin, px: t.px, w: img.w, h: img.h,
    full: artToCanvas(img), dim: artToCanvas(dimImg), far: artToCanvas(farImg), farDim: artToCanvas(farDim),
    raw: img, region: t.region,
  };
}

/** The full-value layer cut to one region's land (pixel-exact along its coast). */
export function regionCut(layers: ArtLayers, regionId: number): HTMLCanvasElement {
  const out = artBlank(layers.w, layers.h);
  for (let i = 0; i < out.data.length; i++) if (layers.region[i] === regionId) out.data[i] = layers.raw.data[i];
  return artToCanvas(out);
}
