// Composition WITH INTENT on the authored continent (round 4):
//   · calm negative space — each family's ground is one flat colour with a few
//     large clean-edged tone zones (no speckle, no dither);
//   · deliberate 1-px strokes — ink coastline on the paper sea, a lit sand lip
//     on north/west shores, a maroon cliff lip under south/east shores,
//     horizontal hatching ONLY in a band along the coast;
//   · 1–2 HERO features per family (snowy spine, volcano, lake, oasis, mesa,
//     crystal spires), hand-placed in tile coords and nudged into free land;
//   · mountain RANGES of peak glyphs along world.mountains (the family borders);
//   · detail concentrated near models (forest / palm / acacia clusters round
//     each node), sparse hills far from them.
// Everything is a hand-drawn stamp (stamps.ts) at a constant pixel size; the
// LOD (art px per tile) only changes how many stamps fit and which size tier.
import type { Pt, World } from "@/lib/world";
import { RAMPS, biomeOf, CLEAR, type RampName } from "../palette";
import { noise, fbm3f } from "../noise";
import type { ArtImage } from "../raster";
import { authoredLand, type AuthoredLand } from "./continent";
import {
  ACACIA, CAN, DUNE, FOREST_M, FOREST_S, HILL, HILL_L, LAKE, MESA, PALM, PEAK_L, PEAK_M, PEAK_S, PINE, PINE_SNOW, POND,
  ROCKS, SPIRES, VOLCANO, recolour, stampImage, type Stamp,
} from "./stamps";
import { cone, forest, lake, mesa, spires, type Glyph } from "./gen";

const TILE = 16;

interface Ground { ramp: RampName; base: number }
const GROUND: Record<string, Ground> = {
  meadow: { ramp: "meadow", base: 4 },
  savanna: { ramp: "savanna", base: 3 },
  dunes: { ramp: "sand", base: 3 },
  volcanic: { ramp: "rock", base: 3 },
  ice: { ramp: "frost", base: 2 },
  crystal: { ramp: "stone", base: 3 },
};

export type HeroKind = "spine" | "volcano" | "lake" | "oasis" | "mesa" | "spires";
export interface Hero {
  kind: HeroKind;
  family: string;
  /** tile coords: anchor (or polyline for the spine) */
  pts: [number, number][];
}
/** Hand-placed heroes (tile coords on the current world; nudged into free land). */
export const HEROES: Hero[] = [
  { kind: "spine", family: "representation", pts: [[59, 6.5], [56.5, 9.5], [57.5, 12.5], [60.5, 20.5], [57, 26.5], [60.5, 30]] },
  { kind: "volcano", family: "generative", pts: [[61, 89]] },
  { kind: "lake", family: "perception", pts: [[15, 40]] },
  { kind: "oasis", family: "sequence", pts: [[80, 51]] },
  { kind: "mesa", family: "decision", pts: [[101, 57]] },
  { kind: "spires", family: "structure", pts: [[122, 9]] },
  { kind: "spires", family: "structure", pts: [[106, 24]] },
];

export interface PlacedHero { kind: HeroKind; family: string; at: Pt }

export interface AuthoredMap extends AuthoredLand {
  img: ArtImage;
  heroes: PlacedHero[];
  timings: Record<string, number>;
}

export interface ComposeOptions {
  /** "paper" (default) paints the parchment sea + coast hatching; "clear" leaves the sea transparent */
  sea?: "paper" | "clear";
  /** stamp decoration (default true) */
  decor?: boolean;
}

/** Call f every `gap` px of arc length along a polyline (with the unit normal). */
function alongPolyline(pts: { x: number; y: number }[], gap: number, f: (x: number, y: number, k: number, nx: number, ny: number) => void) {
  let acc = gap / 2, k = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
    let t = acc;
    while (t <= len) { f(a.x + ((b.x - a.x) * t) / len, a.y + ((b.y - a.y) * t) / len, k++, nx, ny); t += gap; }
    acc = t - len;
  }
}

const tierOf = (apt: number) => (apt <= 3 ? 0 : apt <= 5 ? 1 : 2);

/** The authored map at `artPerTile` art px per tile: ground, rivers, coasts, sea, heroes, ranges, clusters. */
export function composeAuthored(world: World, artPerTile: number, opts: ComposeOptions = {}): AuthoredMap {
  const t0 = performance.now();
  const L = authoredLand(world, artPerTile);
  const t1 = performance.now();
  const { w: W, h: H, land, region, river, civic } = L;
  const apt = artPerTile, tier = tierOf(apt);
  const N = W * H;
  const img: ArtImage = { w: W, h: H, data: new Uint8Array(N).fill(CLEAR) };
  const out = img.data;
  const toArt = (tx: number, ty: number) => ({ x: (tx * TILE - L.origin.x) / L.px, y: (ty * TILE - L.origin.y) / L.px });
  const fam = (r: number) => (r === -2 ? "structure" : r === -3 ? "sequence" : world.regions[r]?.family ?? "perception");
  const biomeKey = (r: number) => biomeOf(fam(r)).key;

  // ——— snow field along the Representation spine (ground turns to snow near it)
  const spine = HEROES.find((h) => h.kind === "spine")!;
  const spineArt = spine.pts.map(([x, y]) => toArt(x, y));
  const distSpine = (x: number, y: number) => {
    let best = 1e9;
    for (let k = 0; k + 1 < spineArt.length; k++) {
      const a = spineArt[k], b = spineArt[k + 1];
      const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / L2));
      best = Math.min(best, Math.hypot(x - a.x - vx * t, y - a.y - vy * t));
    }
    return best;
  };

  // ——— ground: flat family colour + large clean tone zones (no speckle)
  const tone = new Int8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!land[i]) continue;
    const tx = (L.origin.x + (x + 0.5) * L.px) / TILE, ty = (L.origin.y + (y + 0.5) * L.px) / TILE;
    const n = fbm3f(tx, ty, 0x61a7, 16);
    tone[i] = n > 0.64 ? 1 : n < 0.33 ? -1 : 0;
  }
  // majority-clean the tone map so every zone is a solid cluster
  const tone2 = new Int8Array(tone);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (!land[i]) continue;
    const c: Record<number, number> = { [-1]: 0, 0: 0, 1: 0 };
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) c[tone[i + dy * W + dx]]++;
    tone2[i] = c[1] >= 5 ? 1 : c[-1] >= 5 ? -1 : c[0] >= 5 ? 0 : tone[i];
  }
  // coastal lowlands (T4): a wavy ochre band between the shore and the green, drawn as
  // one clean contour of the coast distance (never speckled)
  const dCoast = new Uint16Array(N).fill(65535);
  {
    const q: number[] = [];
    for (let i = 0; i < N; i++) if (!land[i]) { dCoast[i] = 0; q.push(i); }
    for (let hh = 0; hh < q.length; hh++) {
      const k = q[hh];
      for (const j of [k - 1, k + 1, k - W, k + W]) if (j >= 0 && j < N && dCoast[j] === 65535) { dCoast[j] = dCoast[k] + 1; q.push(j); }
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!land[i]) continue;
    const bk = biomeKey(region[i]);
    let g = GROUND[bk] ?? GROUND.meadow;
    if (bk === "meadow" || bk === "savanna") {
      const tx = (L.origin.x + (x + 0.5) * L.px) / TILE, ty = (L.origin.y + (y + 0.5) * L.px) / TILE;
      const band = apt * (0.5 + 1.6 * noise(tx, ty, 0x10a, 7));
      if (dCoast[i] <= band) g = bk === "meadow" ? { ramp: "sand", base: 4 } : { ramp: "sand", base: 5 };
    }
    if (bk === "ice") {
      // snowfield along the spine: a wavy but clean contour (never a ruled stripe)
      const tx = (L.origin.x + (x + 0.5) * L.px) / TILE, ty = (L.origin.y + (y + 0.5) * L.px) / TILE;
      if (distSpine(x, y) < apt * 2.4 * (0.55 + 0.9 * noise(tx, ty, 0x5a0, 3.5))) g = { ramp: "snow", base: 4 };
    }
    const r = RAMPS[g.ramp];
    out[i] = r[Math.max(0, Math.min(r.length - 1, g.base + tone2[i]))];
  }
  // rivers: cyan core, darker banks (1 px), natural region borders
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!river[i] || !land[i]) continue;
    const edge = (x > 0 && !river[i - 1]) || (y > 0 && !river[i - W]) || (x < W - 1 && !river[i + 1]) || (y < H - 1 && !river[i + W]);
    out[i] = edge ? RAMPS.shallow[1] : RAMPS.shallow[3];
  }
  const t2 = performance.now();

  // ——— stamps
  const heroes: PlacedHero[] = [];
  if (opts.decor !== false) {
    const occ = new Uint8Array(N);
    const blocked = (x: number, y: number) => {
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) return true;
      const i = y * W + x;
      return !land[i] || river[i] === 1 || civic[i] >= 0.3;
    };
    type Place = { img: ArtImage; x: number; y: number; fy: number };
    const placed: Place[] = [];
    const cache = new Map<string, ArtImage>();
    const imgOf = (s: Stamp, ground?: RampName) => {
      const k = s.name + "|" + (ground ?? "");
      let m = cache.get(k);
      if (!m) { m = stampImage(s, ground); cache.set(k, m); }
      return m;
    };
    type Art = Stamp | Glyph;
    /** Try a stamp/glyph with its foot at (fx, fy); `overlap` lets range peaks overlap each other. */
    const tryStamp = (s: Art, fx: number, fy: number, o: { overlap?: boolean; ground?: RampName; pad?: number } = {}) => {
      const m = "rows" in s ? imgOf(s, o.ground) : s.img;
      const ox = Math.round(fx - s.foot.x), oy = Math.round(fy - s.foot.y);
      const pad = o.pad ?? 1;
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        if (m.data[y * m.w + x] === CLEAR) continue;
        for (let dy = -pad; dy <= pad; dy++) for (let dx = -pad; dx <= pad; dx++) {
          const px = ox + x + dx, py = oy + y + dy;
          if (blocked(px, py)) return false;
          if (!o.overlap && occ[py * W + px]) return false;
        }
      }
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.data[y * m.w + x] !== CLEAR) occ[(oy + y) * W + ox + x] = 1;
      placed.push({ img: m, x: ox, y: oy, fy: oy + m.h });
      return true;
    };
    /** Spiral search (art px) for a spot where `f` succeeds. */
    const nudge = (cx: number, cy: number, maxR: number, f: (x: number, y: number) => boolean) => {
      if (f(cx, cy)) return { x: cx, y: cy };
      for (let r = 1; r <= maxR; r++) for (let k = 0; k < 8 * r; k++) {
        const a = (k / (8 * r)) * Math.PI * 2;
        const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
        if (f(x, y)) return { x, y };
      }
      return null;
    };
    // ——— size-aware glyph pickers: hand stamps while they are big enough, drawn-to-size glyphs beyond
    const gcache = new Map<string, Glyph>();
    const glyph = (k: string, make: () => Glyph) => { let g = gcache.get(k); if (!g) { g = make(); gcache.set(k, g); } return g; };
    const peakOf = (w: number, kind: "snow" | "bare" | "crystal"): Art => {
      const hand = kind === "crystal" ? crystalPeaks : kind === "bare" ? bareRock : peakSet;
      if (w <= 7) return hand[0];
      if (w <= 10) return hand[1];
      if (w <= 14) return hand[2];
      return glyph(`peak${w}${kind}`, () => cone(w, Math.round(w * 0.62), { snow: kind !== "bare", ramp: kind === "crystal" ? "stone" : "rock" }));
    };
    const peakSet = [PEAK_S, PEAK_M, PEAK_L];
    const crystalPeaks = peakSet.map((p) => recolour(p, { rock: "stone", snow: "magic" }, p.name + " crystal"));
    const bareRock = peakSet.map((p) => recolour(p, { snow: "rock" }, p.name + " bare"));
    const peakW = Math.max(7, Math.round(apt * 2.4));

    // (1) heroes — footprint in TILES, filled at this LOD's pixel density
    for (const h of HEROES) {
      const a = toArt(h.pts[0][0], h.pts[0][1]);
      const R = apt * 5;
      let at: { x: number; y: number } | null = null;
      switch (h.kind) {
        case "spine": {
          // snowy peaks marching along the authored spine, big/small alternating, back-to-front
          const w0 = Math.round(peakW * 1.3);
          alongPolyline(spineArt, Math.max(4.5, w0 * 0.55), (x, y, k, nx, ny) => {
            const z = (k % 2 ? 1 : -1) * peakW * 0.3;
            const big = peakOf(k % 2 ? peakW : w0, "snow");
            if (tryStamp(big, x + nx * z, y + ny * z, { overlap: true, pad: 0 }) || tryStamp(PEAK_S, x + nx * z, y + ny * z, { overlap: true, pad: 0 })) at = at ?? { x, y };
          });
          break;
        }
        case "volcano": {
          const w = Math.round(apt * 6.5);
          const v: Art = w <= 17 ? VOLCANO : glyph(`volcano${w}`, () => cone(w, Math.round(w * 0.6), { crater: true }));
          at = nudge(a.x, a.y, R, (x, y) => tryStamp(v, x, y));
          if (at) {
            const sw = Math.round(w * 0.55);
            tryStamp(peakOf(sw, "bare"), at.x - Math.round(w * 0.62), at.y + 1, { overlap: true, pad: 0 });
            tryStamp(peakOf(Math.round(sw * 0.8), "bare"), at.x + Math.round(w * 0.6), at.y + 2, { overlap: true, pad: 0 });
          }
          break;
        }
        case "lake": {
          const w = Math.round(apt * 5.5), hh = Math.round(apt * 3);
          const lk: Art = w <= 9 ? POND : w <= 13 ? LAKE : glyph(`lake${w}`, () => lake(w, hh));
          at = nudge(a.x, a.y, R, (x, y) => tryStamp(lk, x, y));
          if (at) {
            const fr = glyph(`forest${Math.round(apt * 1.3)}`, () => forest(Math.max(4, Math.round(apt * 1.3)), CAN));
            tryStamp(apt <= 3 ? FOREST_S : fr, at.x - Math.round(w * 0.75), at.y - 2);
            tryStamp(apt <= 3 ? FOREST_S : fr, at.x + Math.round(w * 0.7), at.y + 3);
          }
          break;
        }
        case "oasis": {
          const w = Math.round(apt * 2.8);
          const pd: Art = w <= 9 ? POND : glyph(`pond${w}`, () => lake(w, Math.round(w * 0.6)));
          at = nudge(a.x, a.y, R, (x, y) => tryStamp(pd, x, y));
          if (at) {
            const n = 2 + tier * 2;
            for (let k = 0; k < n; k++) {
              const ang = -2.4 + (k / Math.max(1, n - 1)) * 3.4;
              tryStamp(PALM, at.x + Math.round(Math.cos(ang) * (w * 0.6 + 4)), at.y + Math.round(Math.sin(ang) * (w * 0.35 + 3)));
            }
            if (tier >= 1) { tryStamp(DUNE, at.x - w - 6, at.y + 6); tryStamp(DUNE, at.x + w + 6, at.y + 5); }
          }
          break;
        }
        case "mesa": {
          const w = Math.round(apt * 5);
          const me: Art = w <= 13 ? MESA : glyph(`mesa${w}`, () => mesa(w, Math.round(w * 0.5)));
          at = nudge(a.x, a.y, R, (x, y) => tryStamp(me, x, y));
          if (at) {
            const w2 = Math.round(w * 0.6);
            tryStamp(w2 <= 13 ? MESA : glyph(`mesa${w2}`, () => mesa(w2, Math.round(w2 * 0.55))), at.x + Math.round(w * 0.85), at.y + 3);
            if (tier >= 1) tryStamp(HILL, at.x - Math.round(w * 0.8), at.y + 2, { ground: "savanna" });
          }
          break;
        }
        case "spires": {
          const w = Math.round(apt * 3.6);
          const sp: Art = w <= 11 ? SPIRES : glyph(`spires${w}`, () => spires(w, Math.round(w * 1.1)));
          at = nudge(a.x, a.y, R, (x, y) => tryStamp(sp, x, y));
          if (at && tier >= 1) tryStamp(ROCKS, at.x + Math.round(w * 0.8), at.y + 1);
          break;
        }
      }
      if (at) heroes.push({ kind: h.kind, family: h.family, at: { x: at.x * L.px + L.origin.x, y: at.y * L.px + L.origin.y } });
    }

    // (2) mountain ranges on the family borders (world.mountains): peaks every `gap` px of ARC
    // LENGTH along the whole polyline (not per segment), zig-zagging across the line so a
    // range reads as separate faceted peaks, never as hatching
    const gap = Math.max(4.5, peakW * 0.7);
    for (const line of world.mountains) {
      const pts = line.map((p) => ({ x: (p.x - L.origin.x) / L.px, y: (p.y - L.origin.y) / L.px }));
      alongPolyline(pts, gap, (x, y, k, nx, ny) => {
        const zig = (k % 2 ? 1 : -1) * Math.max(1, peakW * 0.22);
        const px2 = x + nx * zig, py2 = y + ny * zig;
        const r = region[Math.round(py2) * W + Math.round(px2)] ?? 0;
        const kind = biomeKey(r) === "crystal" ? "crystal" : biomeKey(r) === "ice" ? "snow" : "bare";
        const w = k % 3 === 0 ? Math.round(peakW * 1.25) : peakW;
        if (!nudge(Math.round(px2), Math.round(py2), Math.max(3, Math.round(apt * 0.8)), (xx, yy) => tryStamp(peakOf(w, kind), xx, yy, { overlap: true, pad: 0 })))
          nudge(Math.round(px2), Math.round(py2), 3, (xx, yy) => tryStamp(peakOf(7, kind), xx, yy, { overlap: true, pad: 0 }));
      });
    }

    // (3) clusters near models: detail concentrates round the settlements
    const fr = apt <= 3 ? null : glyph(`forest${Math.round(apt)}`, () => forest(Math.max(4, Math.round(apt)), CAN));
    const pineFr = apt <= 3 ? null : glyph(`pforest${Math.round(apt)}`, () => forest(Math.max(4, Math.round(apt * 0.9)), recolour({ name: "", rows: [], legend: CAN, foot: { x: 0, y: 0 } }, { forest: "pine" }).legend));
    const clusterFor = (bk: string): { s: Art; ground?: RampName }[] => {
      switch (bk) {
        case "meadow": return tier === 0 ? [{ s: FOREST_S }, { s: FOREST_M }, { s: FOREST_S }] : [{ s: fr ?? FOREST_M }, { s: FOREST_S }, { s: fr ?? FOREST_M }];
        case "ice": return [{ s: pineFr ?? PINE_SNOW }, { s: PINE_SNOW }, { s: PINE }];
        case "savanna": return tier === 0 ? [{ s: SCRUB }, { s: HILL, ground: "savanna" }] : [{ s: ACACIA }, { s: SCRUB }, { s: HILL, ground: "savanna" }];
        case "dunes": return tier === 0 ? [{ s: DUNE }] : [{ s: PALM }, { s: DUNE }];
        case "volcanic": return tier === 0 ? [{ s: PEAK_S_BARE }, { s: HILL, ground: "rock" }] : [{ s: BASALT }, { s: PEAK_S_BARE }, { s: HILL, ground: "rock" }];
        case "crystal": return [{ s: ROCKS }, { s: PINE }];
        default: return [{ s: FOREST_S }];
      }
    };
    const BASALT = recolour(ROCKS, { stone: "rock" }, "basalt");
    const SCRUB = recolour(FOREST_S, { forest: "olive" }, "scrub clump");
    const PEAK_S_BARE = bareRock[0];
    const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    for (const nd of world.nodes) {
      const c = toArt(nd.center.x / TILE, nd.center.y / TILE);
      const ri = region[Math.round(c.y) * W + Math.round(c.x)];
      const set = clusterFor(biomeKey(ri ?? 0));
      const want = (nd.atom ? 2 : 1) + tier + (biomeKey(ri ?? 0) === "meadow" ? 1 : 0);
      let got = 0;
      const start = Math.floor(((nd.name.charCodeAt(0) * 7 + nd.name.length) % 8));
      const reach = (nd.foot.w / 2 + 1.6) * apt;
      for (let k = 0; k < 16 && got < want; k++) {
        const [dx, dy] = DIRS[(start + k * 3) % 8];
        const rr = k < 8 ? reach : reach * 1.8;                 // second ring if the first is crowded
        const x = c.x + dx * rr, y = c.y + dy * rr + apt * 0.5;
        const pick = set[got % set.length];
        const spot = nudge(Math.round(x), Math.round(y), Math.max(2, apt), (xx, yy) => tryStamp(pick.s, xx, yy, { ground: pick.ground }));
        if (spot) got++;
      }
    }

    // (4) calm, sparse relief far from everything (a hill here and there, one per ~4×4 tiles at most)
    const cell = Math.max(12, Math.round(apt * 4.5));
    for (let gy = 0; gy < H; gy += cell) for (let gx = 0; gx < W; gx += cell) {
      const x = gx + Math.floor(noise(gx, gy, 0xab1, 1) * cell), y = gy + Math.floor(noise(gy, gx, 0xab2, 1) * cell);
      if (x >= W || y >= H || !land[y * W + x] || civic[y * W + x] > 0.02) continue;
      if (noise(gx * 0.37, gy * 0.37, 0xab3, 1) < 0.45) continue;
      const bk = biomeKey(region[y * W + x]);
      if (bk === "dunes") tryStamp(DUNE, x, y, { pad: 2 });
      else tryStamp(tier >= 2 && bk !== "crystal" ? HILL_L : HILL, x, y, { pad: 2, ground: (GROUND[bk] ?? GROUND.meadow).ramp });
    }

    placed.sort((a, b) => a.fy - b.fy || a.x - b.x);
    for (const p of placed) for (let y = 0; y < p.img.h; y++) for (let x = 0; x < p.img.w; x++) {
      const v = p.img.data[y * p.img.w + x];
      if (v !== CLEAR) out[(p.y + y) * W + p.x + x] = v;
    }
  }
  // the "?" island wears mist: clean horizontal wisps in pale snow, every 3rd row, in two bands
  for (let y = 0; y < H; y++) {
    if (y % 3) continue;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (region[i] !== -2) continue;
      const tx = (L.origin.x + (x + 0.5) * L.px) / TILE, ty = (L.origin.y + (y + 0.5) * L.px) / TILE;
      if (noise(tx * 0.5, ty * 2.2, 0x3157, 1.3) > 0.58 && (x + y) % 7 < 5) out[i] = RAMPS.snow[4];
    }
  }
  const t3 = performance.now();

  // ——— coasts: lit sand lip (N/W), cliff lip (S/E, hangs into the sea), ink stroke, hatching
  const cliffH = apt >= 6 ? 2 : 1;
  const sea = new Uint8Array(N);
  for (let i = 0; i < N; i++) sea[i] = land[i] ? 0 : 1;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (!land[i] || river[i]) continue;
    if ((sea[i - W] || sea[i - 1]) && !sea[i + W]) {
      const bk = biomeKey(region[i]);
      out[i] = bk === "dunes" || bk === "savanna" ? RAMPS.sand[5] : bk === "ice" ? RAMPS.snow[5] : bk === "crystal" ? RAMPS.stone[5] : RAMPS.sand[4];
    }
  }
  const coast = new Uint8Array(N);   // sea px that are cliff or ink stroke
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (!sea[i]) continue;
    let cliff = 0;
    for (let k = 1; k <= cliffH; k++) if (land[i - k * W]) { cliff = k; break; }
    if (cliff) { out[i] = cliff === 1 ? RAMPS.rock[2] : RAMPS.rock[1]; coast[i] = 2; continue; }
    if (land[i - 1]) { out[i] = RAMPS.rock[1]; coast[i] = 2; continue; }
  }
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (!sea[i] || coast[i]) continue;
    const touch = (j: number) => land[j] || coast[j] === 2;
    if (touch(i - 1) || touch(i + 1) || touch(i - W) || touch(i + W)) { out[i] = RAMPS.ink[1]; coast[i] = 1; }
  }
  if (opts.sea !== "clear") {
    // distance from the coast stroke for the hatch band
    const band = Math.max(6, Math.round(apt * 1.4));
    const d = new Uint8Array(N).fill(255);
    const q: number[] = [];
    for (let i = 0; i < N; i++) if (coast[i]) { d[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const k = q[h];
      if (d[k] >= band) continue;
      for (const j of [k - 1, k + 1, k - W, k + W]) if (j >= 0 && j < N && sea[j] && d[j] === 255) { d[j] = d[k] + 1; q.push(j); }
    }
    const gap = apt >= 6 ? 3 : 2;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!sea[i] || coast[i]) continue;
      let v = RAMPS.paper[2];
      const dd = d[i];
      if (dd !== 255 && dd >= 2 && y % gap === 0) {
        // dashes shorten with distance: solid near the shore, broken further out
        const dash = Math.max(1, band - dd + 1), period = dash + 2;
        if ((x + (y >> 1) * 3) % period < dash) v = dd <= 2 ? RAMPS.paper[0] : RAMPS.paper[1];
      }
      out[i] = v;
    }
  }
  const t4 = performance.now();
  return {
    ...L, img, heroes,
    timings: { land: Math.round(t1 - t0), ground: Math.round(t2 - t1), stamps: Math.round(t3 - t2), coast: Math.round(t4 - t3), total: Math.round(t4 - t0) },
  };
}
