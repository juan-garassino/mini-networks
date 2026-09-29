"use client";

// Round 5 compositor — the owner's FINAL pixel map (.lab-shots/refs/map-reference.png)
// on lib/world v3 (preset "pixel": authored geography, zones, borders, bay, islets)
// dressed with the zone art library (art/biomes). One composite per level of
// detail (art px per tile), drawn at the fixed on-screen pixel grid.
//
// Bottom → top: parchment sea · smoothed land slabs (tile field, bilinear) ·
// zone grounds (biomeGround.at + .paint) · sunken city on the bay's seabed (REEF) ·
// rivers · cliffs under every south coast (paintCliffs) · floating island's
// underside (paintUnderside) · dotted cream trails · y-sorted stamps (Layout,
// ink-ringed): range peaks, heroes, towns, decor, landmarks, markers / stops ·
// sea furniture (islets, lighthouse, waves).
import { T, type Pt, type World, type WorldNode } from "@/lib/world";
import {
  artBlank, artToCanvas, castleSprite, CLEAR, darker, markerSprite, RAMPS, type ArtImage, type Sprite,
} from "./art";
import { hash2, valueNoise } from "./art/noise";
import {
  BIOME_INK, BR, Layout, atTier, biomeGround, biomeLandmark, biomeMarker, biomeStamps, dk, forgeSprites, paintCliffs, paintUnderside,
  seaSprites, townSprites, type BiomeStamp,
} from "./art/biomes";
import type { NodeLook } from "./terrain";
import type { ArtEmblems, ArtLayers } from "./world-art";

const TILE = 16;

/** world v3 zone kind → art/biomes zone key. */
const ZONE_KEY: Record<string, string> = {
  forest: "forest", town: "village", wildwest: "wildwest", snow: "snow", cathedral: "marble", ruins: "marble",
  desert: "stilts", forge: "forge", village: "village", underwater: "sunken", cyber: "cyber", meadow: "village", sky: "cyber",
};
const FAMILY_ZONE: Record<string, string> = { perception: "forest", sequence: "marble", generative: "forge", representation: "snow", decision: "village", structure: "cyber" };
/** stamps set per zone key (zone art uses its own names). */
const STAMP_ZONE: Record<string, string> = { forest: "forest", village: "village", wildwest: "wildwest", snow: "snow", marble: "marble", stilts: "stilts", forge: "forge", sunken: "sunken", cyber: "cyber" };

function inPoly(poly: Pt[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

const dimIdx = (v: number) => { if (v === CLEAR) return v; const a = darker(v); return a !== v ? a : dk(v); };

export function buildMapV3(world: World, looks: Map<string, NodeLook>, emblems: ArtEmblems | null, apt: number): ArtLayers {
  const { cols, rows, terrain, regionOf } = world;
  const all = world.camera.all;
  const fx0 = Math.floor(Math.min(0, all.x) / TILE) * TILE, fy0 = Math.floor(Math.min(0, all.y) / TILE) * TILE;
  const fx1 = Math.ceil(Math.max(cols * TILE, all.x + all.w) / TILE) * TILE, fy1 = Math.ceil(Math.max(rows * TILE, all.y + all.h) / TILE) * TILE;
  const px = TILE / apt;
  const W = ((fx1 - fx0) / TILE) * apt, H = ((fy1 - fy0) / TILE) * apt;
  const N = W * H;
  const ox = Math.round(fx0 / px), oy = Math.round(fy0 / px);        // global art offset (patterns line up across levels)
  const A = (p: Pt): Pt => ({ x: (p.x - fx0) / px, y: (p.y - fy0) / px });

  // ——— tile classes
  const borderKind = new Map<number, string>();
  for (const b of world.borders) for (const t of b.tiles) borderKind.set(t, b.kind);
  const regionById = world.regions;
  const bay = world.bay;
  const tileLand = (tx: number, ty: number): number => {
    if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return 0;
    const t = ty * cols + tx, c = terrain[t];
    const r = regionById[regionOf[t]];
    if (r?.underwater && bay.length && inPoly(bay, (tx + 0.5) * TILE, (ty + 0.5) * TILE)) return 0;   // seabed
    if (c === T.SEA) return 0;
    if (borderKind.get(t) === "strait") return 0;
    return 1;
  };
  const tileSeabed = (tx: number, ty: number): boolean => {
    if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return false;
    const t = ty * cols + tx;
    const r = regionById[regionOf[t]];
    return !!r?.underwater && (terrain[t] === T.SEA || (bay.length > 0 && inPoly(bay, (tx + 0.5) * TILE, (ty + 0.5) * TILE)));
  };
  // blurred tile field (3×3) → smooth coasts after bilinear sampling
  const TW = (fx1 - fx0) / TILE, TH = (fy1 - fy0) / TILE, tx0 = fx0 / TILE, ty0 = fy0 / TILE;
  const raw = new Float32Array(TW * TH), fld = new Float32Array(TW * TH), rv = new Float32Array(TW * TH);
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    raw[y * TW + x] = tileLand(x + tx0, y + ty0);
    const gx = x + tx0, gy = y + ty0;
    rv[y * TW + x] = gx >= 0 && gy >= 0 && gx < cols && gy < rows && borderKind.get(gy * cols + gx) === "river" ? 1 : 0;
  }
  const rvS = new Float32Array(TW * TH);
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    let s2 = 0, n2 = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= TW || yy >= TH) continue;
      const wgt = dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1;
      s2 += rv[yy * TW + xx] * wgt; n2 += wgt;
    }
    rvS[y * TW + x] = s2 / n2;
  }
  const bilR = (u: number, v: number) => {
    const x0 = Math.max(0, Math.min(TW - 1, Math.floor(u))), y0 = Math.max(0, Math.min(TH - 1, Math.floor(v)));
    const x1 = Math.min(TW - 1, x0 + 1), y1 = Math.min(TH - 1, y0 + 1), fx = u - Math.floor(u), fy = v - Math.floor(v);
    const a = rvS[y0 * TW + x0], b = rvS[y0 * TW + x1], c = rvS[y1 * TW + x0], d = rvS[y1 * TW + x1];
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  };
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    let s = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= TW || yy >= TH) { n += 1; continue; }
      const wgt = dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1;
      s += raw[yy * TW + xx] * wgt; n += wgt;
    }
    fld[y * TW + x] = s / n * (16 / 16);
  }
  const bil = (u: number, v: number) => {
    const x0 = Math.max(0, Math.min(TW - 1, Math.floor(u))), y0 = Math.max(0, Math.min(TH - 1, Math.floor(v)));
    const x1 = Math.min(TW - 1, x0 + 1), y1 = Math.min(TH - 1, y0 + 1), fx = u - Math.floor(u), fy = v - Math.floor(v);
    const a = fld[y0 * TW + x0], b = fld[y0 * TW + x1], c = fld[y1 * TW + x0], d = fld[y1 * TW + x1];
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  };

  // ——— art-px masks
  const land = new Uint8Array(N), water = new Uint8Array(N), seabed = new Uint8Array(N), floatM = new Uint8Array(N);
  const protect = new Uint8Array(N), region = new Int8Array(N).fill(-1);
  const zoneOf = new Array<string>(N);
  const zonesPoly = world.zones.map((z) => ({ key: ZONE_KEY[z.zone] ?? FAMILY_ZONE[z.family] ?? "forest", family: z.family, poly: z.poly }));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const wx = fx0 + (x + 0.5) * px, wy = fy0 + (y + 0.5) * px;
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    const inGrid = tx >= 0 && ty >= 0 && tx < cols && ty < rows;
    const t = inGrid ? ty * cols + tx : -1;
    const code = inGrid ? terrain[t] : T.SEA;
    const civic = code === T.ROAD || code === T.FOOT || code === T.SETPIECE || code === T.BRIDGE;
    const sb = inGrid && tileSeabed(tx, ty);
    let f = bil(wx / TILE - 0.5 - tx0, wy / TILE - 0.5 - ty0);
    f += (valueNoise(wx / TILE, wy / TILE, 0x7a11, 1.6) - 0.5) * 0.12;
    let isLand = f > 0.5;
    if (civic && !sb) isLand = true;
    if (sb) { isLand = false; seabed[i] = 1; }
    if (isLand) {
      land[i] = 1;
      let r = inGrid ? regionOf[t] : -1;
      if (r < 0) {
        // coast pixels outside a region tile: nearest region in the 3×3 tile ring
        for (let d = 1; d <= 2 && r < 0; d++) for (let dy = -d; dy <= d && r < 0; dy++) for (let dx = -d; dx <= d && r < 0; dx++) {
          const xx = tx + dx, yy = ty + dy;
          if (xx >= 0 && yy >= 0 && xx < cols && yy < rows && terrain[yy * cols + xx] !== T.SEA) r = regionOf[yy * cols + xx];
        }
      }
      region[i] = r;
      if (r >= 0 && regionById[r]?.floating) floatM[i] = 1;
      // rivers: a smooth meandering band (bilinear of the river tiles), never tile steps
      const rr = bilR(wx / TILE - 0.5 - tx0, wy / TILE - 0.5 - ty0) + (valueNoise(wx / TILE, wy / TILE, 0x5e1, 2.2) - 0.5) * 0.12;
      if (rr > 0.34 && !civic) water[i] = 1;
      if (civic) protect[i] = 1;
      const fam = r >= 0 ? regionById[r].family : "perception";
      const z = zonesPoly.find((zp) => zp.family === fam && inPoly(zp.poly, wx, wy));
      zoneOf[i] = z?.key ?? FAMILY_ZONE[fam] ?? "forest";
    } else if (sb) {
      region[i] = regionOf[t];
      if (civic) protect[i] = 1;
      zoneOf[i] = "sunken";
    }
  }
  // protect a 1-px ring round every footprint / road
  const prot2 = new Uint8Array(protect);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (protect[i]) continue;
    if (protect[i - 1] || protect[i + 1] || protect[i - W] || protect[i + W]) prot2[i] = 1;
  }

  // ——— paint: sea, grounds, seabed, rivers
  const img = artBlank(W, H, BR.paperR[2] ?? RAMPS.paper[2]);
  const byZone = new Map<string, Uint8Array>();
  for (let i = 0; i < N; i++) {
    const z = zoneOf[i];
    if (!z) continue;
    let m = byZone.get(z);
    if (!m) { m = new Uint8Array(N); byZone.set(z, m); }
    m[i] = 1;
  }
  for (const [z, m] of byZone) {
    const g = biomeGround(z);
    if (!g) continue;
    for (let i = 0; i < N; i++) if (m[i]) img.data[i] = g.at((i % W) + ox, Math.floor(i / W) + oy, apt);
    g.paint(img, m, { land: z === "sunken" ? seabed : land, protect: prot2, water, apt, ox, oy, border: z !== "cyber" });
  }
  for (let i = 0; i < N; i++) {
    if (!water[i]) continue;
    const x = i % W, y = (i - x) / W;
    const edge = (x > 0 && !water[i - 1] && land[i - 1]) || (y > 0 && !water[i - W] && land[i - W]);
    img.data[i] = edge ? BR.water[1] : (x + 2 * y) % 9 === 0 ? BR.water[4] : BR.water[3];
  }

  // ——— diorama edges: cliffs under every south coast (not the floating island), its underside
  const slab = new Uint8Array(N);
  for (let i = 0; i < N; i++) slab[i] = land[i] && !floatM[i] ? 1 : 0;
  paintCliffs(img, slab, { depth: Math.max(7, Math.round(apt * 2.6)), ox });
  paintUnderside(img, floatM, { depth: Math.max(8, Math.round(apt * 5)), ox });
  // occupied-by-cliff (so sea furniture stays clear)
  const solid = new Uint8Array(N);
  for (let i = 0; i < N; i++) solid[i] = land[i] || img.data[i] !== (BR.paperR[2] ?? RAMPS.paper[2]) ? 1 : 0;

  // ——— trails: dotted cream dashes on their lanes
  const cream = BR.paperR[3] ?? RAMPS.paper[3];
  for (const road of world.roads) {
    const pts = (road.lanePoints.length ? road.lanePoints : road.points).map(A);
    let k = 0;
    for (let s = 1; s < pts.length; s++) {
      const a = pts[s - 1], b = pts[s];
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
      for (let q = 0; q <= n; q++) {
        if (k++ % 4 >= 2) continue;
        const x = Math.round(a.x + ((b.x - a.x) * q) / n), y = Math.round(a.y + ((b.y - a.y) * q) / n);
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = y * W + x;
        if (!land[i] && !seabed[i]) continue;
        img.data[i] = road.kind === "bridge" ? BR.woodR[3] ?? cream : cream;
      }
    }
  }

  // ——— y-sorted stamps
  const free = (x: number, y: number) => {
    const i = y * W + x;
    return land[i] === 1 && !prot2[i] && !water[i];
  };
  const L = new Layout(W, H, free);
  const t = townSprites(), fg = forgeSprites(), sea = seaSprites();
  const zoneCentroid = (key: string): Pt | null => {
    let sx = 0, sy = 0, n = 0;
    const m = byZone.get(key);
    if (!m) return null;
    for (let i = 0; i < N; i += 3) if (m[i]) { sx += i % W; sy += Math.floor(i / W); n++; }
    return n ? { x: sx / n, y: sy / n } : null;
  };
  const inZone = (key: string) => (x: number, y: number) => zoneOf[y * W + x] === key;
  const spiral = (s: Sprite | BiomeStamp, c: Pt | null, key: string, ink = true) => {
    if (!c) return false;
    const ok = inZone(key);
    for (let r = 0; r < 60; r += 2) for (let a = 0; a < 16; a++) {
      const x = Math.round(c.x + Math.cos((a / 16) * Math.PI * 2) * r), y = Math.round(c.y + Math.sin((a / 16) * Math.PI * 2) * r * 0.7);
      if (x < 0 || y < 0 || x >= W || y >= H || !ok(x, y)) continue;
      if (L.put(s, x, y, { pad: 1, ink })) return true;
      if (r === 0) break;
    }
    return false;
  };

  // landmarks first (they own their footprints), then heroes, ranges, towns, decor
  // detail tiers on the fixed grid: overview/region halve the big set-pieces
  const F = apt <= 4 ? 2 : 1;
  const T2 = <S extends Sprite | BiomeStamp>(s: S): S => atTier(s, F);
  const nodes = [...world.nodes].sort((a, b) => a.center.y - b.center.y);
  const zoneOfNode = (n: WorldNode) => (n.zone ? ZONE_KEY[n.zone] : undefined) ?? FAMILY_ZONE[n.family] ?? "forest";
  const stops: { n: WorldNode; look: NodeLook }[] = [];
  for (const n of nodes) {
    const look = looks.get(n.name) ?? { state: "untrained" as const, filled: false };
    const foot = A({ x: n.center.x, y: (n.foot.y + n.foot.h) * TILE });
    if (n.atom) {
      const e9 = emblems?.get(n.name)?.get(9);
      const s = biomeLandmark(n.name, e9) ?? castleSprite(n.name, e9);
      L.put(T2(s), foot.x, foot.y, { force: true, ink: true });
    } else if (apt >= 6) {
      const e7 = emblems?.get(n.name)?.get(7);
      const s = biomeMarker(zoneOfNode(n), look.state, e7) ?? markerSprite(look.state, n.name, e7);
      L.put(s, foot.x, foot.y, { force: true, ink: true });
    } else stops.push({ n, look });
  }
  // heroes: treehouse (forest), volcano (forge), observatory (village)
  spiral(T2(t.treehouse), zoneCentroid("forest"), "forest");
  spiral(T2(fg.volcano), zoneCentroid("forge"), "forge");
  spiral(T2(t.observatory), zoneCentroid("village"), "village");
  // range borders: peaks along the border path (bridges stay open as passes)
  const peakSprites = [t.peakM, t.peakS, t.peakL, t.peakS];
  for (const b of world.borders) if (b.kind === "range") {
    const pts = b.path.map(A);
    let acc = 0;
    for (let s = 1; s < pts.length; s++) {
      const a = pts[s - 1], c = pts[s];
      const len = Math.hypot(c.x - a.x, c.y - a.y);
      for (let d = acc; d < len; d += Math.max(5, apt * 3)) {
        const x = Math.round(a.x + ((c.x - a.x) * d) / len), y = Math.round(a.y + ((c.y - a.y) * d) / len);
        const k = (x * 7 + y * 3) % peakSprites.length;
        L.put(peakSprites[k], x, y + 2, { pad: 0, ink: true });
      }
      acc = 0;
    }
  }
  // towns on the world's city blocks (zone flavoured)
  const townFor = (key: string) => biomeStamps(STAMP_ZONE[key] ?? key).filter((s) => s.role === "town" && !/HERO|boomtown/i.test(s.note + s.name));
  for (const city of world.cities) city.blocks.forEach((bk, k) => {
    const c = A({ x: bk.x + bk.w / 2, y: bk.y + bk.h });
    const z = zoneOf[Math.round(c.y) * W + Math.round(c.x)];
    const list = z ? townFor(z) : [];
    if (list.length) L.put(T2(list[k % list.length]), c.x, c.y, { pad: 0, ink: true });
  });
  // decor + relief scatter per zone (density by zone area)
  let seed = 11;
  for (const [z, m] of byZone) {
    if (z === "sunken") continue;
    let area = 0;
    for (let i = 0; i < N; i++) area += m[i];
    const list = biomeStamps(STAMP_ZONE[z] ?? z).filter((s) => (s.role === "decor" || s.role === "relief" || s.role === "city") && !/HERO/.test(s.note) && !/volcano|pool|lava pool/.test(s.name));
    if (!list.length) continue;
    // decor (trees, cacti…) in clumps; relief sparse — calm fields between (T4 / reference)
    // density per TILE area (art area scales with apt²), so the overview is as dressed as the reference
    const per = (z === "forest" || z === "snow" ? 60 : z === "cyber" ? 90 : 170) * (apt / 6) ** 2 * (apt <= 4 ? 0.55 : 1);
    const want = Math.round(area / per);
    const ok = inZone(z);
    list.forEach((s, j) => {
      const n = s.role === "decor" ? Math.ceil((want * 1.4) / list.length) : Math.max(1, Math.round(want / (list.length * 6)));
      let got = 0;
      for (let k = 0; k < n * 40 && got < n; k++) {
        // clumped: candidates cluster round a few seeds per zone
        const c = k % 5;
        const bx = hash2(c, seed, 0x11) * W, by = hash2(seed, c, 0x13) * H;
        const x = Math.round(s.role === "decor" ? bx + (hash2(k, seed, 0x51) - 0.5) * W * 0.18 : hash2(k, seed, 0x51) * W);
        const y = Math.round(s.role === "decor" ? by + (hash2(seed, k, 0x77) - 0.5) * H * 0.14 : hash2(seed, k, 0x77) * H);
        if (x < 0 || y < 0 || x >= W || y >= H || !ok(x, y)) continue;
        if (L.put(s.role === "decor" ? s : T2(s), x, y, { pad: apt <= 4 ? 0 : 1, ink: true })) got++;
      }
      seed += 7 + j;
    });
  }
  // sunken city: reef stamps scattered on the seabed (their own free test)
  const reefFree = new Layout(W, H, (x, y) => seabed[y * W + x] === 1 && !prot2[y * W + x]);
  for (const s of biomeStamps("sunken")) reefFree.scatter(s, s.role === "reef" ? 5 : 3, seed++ * 17);

  // derived models as round stops (cream disc, ink ring, evidence dot)
  const stopImg = (state: NodeLook["state"]): ArtImage => {
    const im = artBlank(7, 7);
    const dot = state === "champion" ? BR.goldR[2] ?? RAMPS.gold[3] : state === "trained" ? BR.water[2] : state === "provisional" ? BR.stoneR[2] : BR.stoneR[1];
    const rows7 = [".ooooo.", "occccco", "occddco", "occddco", "occccco", "occccco", ".ooooo."];
    rows7.forEach((r, y) => { for (let x = 0; x < 7; x++) { const ch = r[x]; if (ch === ".") continue; im.data[y * 7 + x] = ch === "o" ? BIOME_INK : ch === "d" ? dot : cream; } });
    return im;
  };
  for (const { n, look } of stops) {
    const c = A(n.center);
    L.put({ img: stopImg(look.state), anchor: { x: 3, y: 3 } } as Sprite, c.x, c.y, { force: true });
  }

  // sea furniture: islets from world v3 polygons, waves in open water
  const seaFree = new Layout(W, H, (x, y) => !solid[y * W + x] && !seabed[y * W + x]);
  world.islets.forEach((isl, k) => {
    let cx = 0, cy = 0;
    for (const p of isl.poly) { cx += p.x; cy += p.y; }
    const c = A({ x: cx / isl.poly.length, y: cy / isl.poly.length });
    const s = T2(isl.kind === "lighthouse" ? sea.lighthouse : [sea.tuft, sea.rock, sea.isletS, sea.islet][k % 4]);
    seaFree.put(s, c.x, c.y, { force: true, ink: true });
  });
  seaFree.scatter(sea.wave, Math.round((W * H) / 2600), 91);

  seaFree.draw(img);
  reefFree.draw(img);
  L.draw(img);

  const dimImg: ArtImage = { w: W, h: H, data: img.data.map(dimIdx) };
  const full = artToCanvas(img), dim = artToCanvas(dimImg);
  void hash2;
  return { origin: { x: fx0, y: fy0 }, px, w: W, h: H, full, dim, far: full, farDim: dim, raw: img, region };
}
