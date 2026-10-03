"use client";

// The true pixel map, painted by us: pixel-map.json → a stack of native-size
// canvases scaled together (image-rendering: pixelated) —
//   base   the map's pixels + evidence re-coloured road markers, atom banners
//   focus  the focus gradient: out-of-focus pixels fade toward a warm sepia
//          ghost over a dithered band around the focused land (see focusField)
//   life   the moving pixels: water glints, foam, lava pulse, embers + smoke,
//          window flicker, leaf rustle, carts on the roads (life.ts), 12 fps
//   fx     lit lineage road, selection brackets, the walking critter
//   labels ribbons (bitmap font) + family signs
//   hit    an invisible SVG of buttons for pointer + keyboard + screen readers
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { displayName } from "@/components/lab/shared/card-model";
import { FAMILIES, type Box, type Family, type PaintedMap, type Pt } from "./anchors";
import {
  PIXELMAP_URL, decodePixelMap, landIds, landSwatch, seaMask,
  type PixelMap, type PixelMapDoc,
} from "./pixelmap";
import {
  BAYER4, GHOST_LEVELS, INK, Raster, critterSprite, drawBanner, drawBrackets, drawDisc, drawLitRoad, drawRibbons, drawSprite, ghostRGB,
  rasterPolyline, recolourMarker, type Sprite,
} from "./pixel-art";
import { analyseLife, paintLife, type Traveller } from "./life";
import { clutterTable, type PlacedRibbon } from "./ribbons";

// ——— loading + derived data

export interface TrueData {
  pm: PixelMap;
  sea: Uint8Array;
  lands: Int8Array;
  swatch: Record<Family, string>;
  landBox: Record<Family, Box>;
  /** anchors that sit on one of the map's painted road markers → its pixels */
  markers: Record<string, { disc: number[]; ring: number[] }>;
  /** clutter (dark outline pixels) under a box — ribbons prefer open ground */
  clutter: (b: Box) => number;
}

export type TrueStatus = { status: "off" | "loading" | "missing" } | { status: "error"; message: string } | { status: "ready"; data: TrueData };

const isWhite = (pm: PixelMap, p: number) => {
  const k = pm.idx[p] * 3;
  return pm.palette[k] >= 240 && pm.palette[k + 1] >= 235 && pm.palette[k + 2] >= 190;
};

/** The painted marker under an anchor: the near-white disc within 3 px of
 * it (7–9 px wide, 25–70 px) and the ring of pixels around that disc. */
function findMarker(pm: PixelMap, ax: number, ay: number): { disc: number[]; ring: number[] } | null {
  const { w, h } = pm;
  const x0 = Math.floor(ax), y0 = Math.floor(ay);
  let seed = -1, bd = Infinity;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const x = x0 + dx, y = y0 + dy;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const p = y * w + x;
    if (isWhite(pm, p) && dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; seed = p; }
  }
  if (seed < 0) return null;
  const disc = new Set<number>([seed]);
  const st = [seed];
  while (st.length && disc.size <= 90) {
    const p = st.pop()!;
    const x = p % w;
    for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
      if (q < 0 || q >= w * h || disc.has(q) || !isWhite(pm, q)) continue;
      disc.add(q); st.push(q);
    }
  }
  if (disc.size < 25 || disc.size > 70) return null;
  const ring = new Set<number>();
  for (const p of disc) {
    const x = p % w;
    for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) if (q >= 0 && q < w * h && !disc.has(q)) ring.add(q);
  }
  return { disc: [...disc], ring: [...ring] };
}

export function useTrueMap(on: boolean, map: PaintedMap): TrueStatus {
  const [doc, setDoc] = useState<{ status: "loading" | "missing" | "error" | "ready"; doc?: PixelMapDoc; message?: string }>({ status: "loading" });
  useEffect(() => {
    if (!on) return;
    let alive = true;
    fetch(PIXELMAP_URL)
      .then(async (r) => {
        if (!alive) return;
        if (r.status === 404) { setDoc({ status: "missing" }); return; }
        if (!r.ok) throw new Error(`${r.status} ${PIXELMAP_URL}`);
        const d = (await r.json()) as PixelMapDoc;
        if (alive) setDoc({ status: "ready", doc: d });
      })
      .catch((e: unknown) => { if (alive) setDoc({ status: "error", message: String(e) }); });
    return () => { alive = false; };
  }, [on]);

  return useMemo<TrueStatus>(() => {
    if (!on) return { status: "off" };
    if (doc.status === "loading" || doc.status === "missing") return { status: doc.status };
    if (doc.status === "error" || !doc.doc) return { status: "error", message: doc.message ?? "unknown error" };
    try {
      const pm = decodePixelMap(doc.doc);
      const sea = seaMask(pm);
      const lands = landIds(pm, map, FAMILIES, sea);
      const swatch = {} as Record<Family, string>;
      const landBox = {} as Record<Family, Box>;
      FAMILIES.forEach((f, fi) => {
        swatch[f] = landSwatch(pm, lands, fi);
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let p = 0; p < lands.length; p++) if (lands[p] === fi) {
          const x = p % pm.w, y = (p / pm.w) | 0;
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        landBox[f] = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
      });
      const markers: TrueData["markers"] = {};
      for (const [n, a] of Object.entries(map.anchors)) {
        const m = findMarker(pm, a[0], a[1]);
        if (m) markers[n] = m;
      }
      // "busy" = the art's dark outline pixels (buildings, trees, cliffs have
      // many; grass, sand, water and the parchment sea have few)
      const busy = new Uint8Array(pm.w * pm.h);
      for (let q = 0; q < busy.length; q++) {
        const k = pm.idx[q] * 3;
        busy[q] = 0.3 * pm.palette[k] + 0.59 * pm.palette[k + 1] + 0.11 * pm.palette[k + 2] < 72 ? 1 : 0;
      }
      const clutter = clutterTable(busy, pm.w, pm.h);
      return { status: "ready", data: { pm, sea, lands, swatch, landBox, markers, clutter } };
    } catch (e) {
      return { status: "error", message: String(e) };
    }
  }, [on, doc, map]);
}

// ——— painting


function useCanvasPaint(ref: React.RefObject<HTMLCanvasElement | null>, raster: Raster | null) {
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !raster) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(raster.data), raster.w, raster.h), 0, 0);
  }, [ref, raster]);
}

// ——— the focus gradient

const BAND = 32;   // art px: the dithered falloff just outside the land
const FAR = 120;   // art px: the ghost reaches full strength this far out
/** The focus canvas reaches this far past the map's edge (≥ FAR): the parchment
 * sea beyond the image is veiled by the same field, so no rectangle shows.
 * Outside the ring the sea is at full ghost — SEA_GHOST, the stage's colour. */
export const RING = 128;
/** ghostRGB(parchment, 1): what the sea becomes far from the focused land */
export const SEA_GHOST = "#e0d0a3";
/** The veil over the extended sea: the parchment's duotone target, applied at
 * alpha 0.8·a — exactly ghostRGB(parchment, a), so it joins the map's own sea. */
export const SEA_VEIL: [number, number, number] = [220, 204, 160];

/** Chamfer distance (1, √2) from land f's pixels, minus a 3-px dilation so
 * the coast foam and cliff faces belong to the land. 0 inside. */
export function focusField(lands: Int8Array, fi: number, w: number, h: number): Float32Array {
  const INF = 1e9, D = 1.4142;
  const d = new Float32Array(w * h);
  for (let p = 0; p < d.length; p++) d[p] = lands[p] === fi ? 0 : INF;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x;
    let v = d[p];
    if (x > 0) v = Math.min(v, d[p - 1] + 1);
    if (y > 0) {
      v = Math.min(v, d[p - w] + 1);
      if (x > 0) v = Math.min(v, d[p - w - 1] + D);
      if (x < w - 1) v = Math.min(v, d[p - w + 1] + D);
    }
    d[p] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const p = y * w + x;
    let v = d[p];
    if (x < w - 1) v = Math.min(v, d[p + 1] + 1);
    if (y < h - 1) {
      v = Math.min(v, d[p + w] + 1);
      if (x < w - 1) v = Math.min(v, d[p + w + 1] + D);
      if (x > 0) v = Math.min(v, d[p + w - 1] + D);
    }
    d[p] = v;
  }
  // the 3-px dilation, applied after both passes (in-pass it would compound)
  for (let p = 0; p < d.length; p++) d[p] = Math.max(0, d[p] - 3);
  return d;
}

const smooth = (e0: number, e1: number, v: number) => { const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
/** Ghost amount at distance dist: most of the fade in the band, the rest
 * spread out to FAR, so nearby context stays warmer (a spotlight). */
const ghostAt = (dist: number) => 0.72 * smooth(0, BAND, dist) + 0.28 * Math.max(0, Math.min(1, (dist - BAND) / (FAR - BAND)));

/** Paint the focus layer: every pixel picks one of the ghost levels by its
 * distance from the focused land, Bayer-dithered between adjacent levels.
 * `front` is the reveal radius from `origin`: inside it the NEW field shows,
 * outside the OLD one (Infinity = settled). */
function compositeFocus(
  out: Uint8ClampedArray, levels: Uint8ClampedArray[],
  from: { field: Float32Array | null; strength: number }, to: { field: Float32Array | null; strength: number },
  front: number, origin: Pt | null, w: number, h: number,
) {
  const L = levels.length - 1;
  const ox = origin?.x ?? w / 2, oy = origin?.y ?? h / 2;
  const BW = w + 2 * RING;
  const [vr, vg, vb] = SEA_VEIL;
  for (let Y = 0; Y < h + 2 * RING; Y++) {
    const y = Y - RING;
    const dy2 = (y - oy) * (y - oy);
    const inY = y >= 0 && y < h;
    const cy = inY ? y : y < 0 ? 0 : h - 1;
    for (let X = 0; X < BW; X++) {
      const x = X - RING;
      const inside = inY && x >= 0 && x < w;
      const b = BAYER4[(Y & 3) * 4 + (X & 3)];
      // which field this pixel shows: dithered wavefront between old and new
      let useNew = true;
      if (front !== Infinity) {
        const dA = Math.sqrt((x - ox) * (x - ox) + dy2);
        useNew = (front - dA) / 10 + b > 1;
      }
      const f = useNew ? to : from;
      const q = (Y * BW + X) * 4;
      if (inside) {
        const p = y * w + x;
        const dist = f.field ? f.field[p] : 0;
        const lvl = Math.max(0, Math.min(L, Math.floor(ghostAt(dist) * L * f.strength + b)));
        const src = levels[lvl];
        const s = p * 4;
        out[q] = src[s]; out[q + 1] = src[s + 1]; out[q + 2] = src[s + 2]; out[q + 3] = 255;
      } else {
        // beyond the edge: the field continues from the nearest map pixel
        const cx = x < 0 ? 0 : x >= w ? w - 1 : x;
        const dist = f.field ? f.field[cy * w + cx] + Math.hypot(x - cx, y - cy) : 0;
        const lvl = Math.max(0, Math.min(L, Math.floor(ghostAt(dist) * L * f.strength + b)));
        out[q] = vr; out[q + 1] = vg; out[q + 2] = vb; out[q + 3] = Math.round((255 * 0.8 * lvl) / L);
      }
    }
  }
}

export interface TrueMapProps {
  data: TrueData;
  map: PaintedMap;
  states: Record<string, EvidenceState>;
  atoms: Set<string>;
  focusFam: Family | null;
  /** 1 = a focused land; lighter for a land-row hover */
  focusStrength: number;
  /** where the focus reveal starts (the focused model, or the land's centre) */
  focusAt: Pt | null;
  ribbons: PlacedRibbon[];
  signs: PlacedRibbon[];
  lineage: Pt[][];
  /** carts on the roads: one per builds_on edge */
  travellers: Traveller[];
  selected: string | null;
  hovered: string | null;
  critter: (Pt & { dir: number; walking: boolean; hop: number }) | null;
  scale: number;
  still: boolean;
  onSelect: (n: string) => void;
  onHover: (n: string | null) => void;
  onCritter: () => void;
  onPainted: () => void;
}

/** Half-size of the box a spot occupies (for ribbon clearance + hit areas). */
export function spotClear(name: string, atoms: Set<string>, markers: TrueData["markers"]): number {
  // atoms stand on the big landmarks (towns, castles); a derived model on a
  // landmark (cottage, tower, wagon) needs less; a road marker least
  return atoms.has(name) ? 12 : markers[name] ? 5 : 8;
}

export const TrueMapLayers = memo(function TrueMapLayers(p: TrueMapProps) {
  const { data, map } = p;
  const { pm } = data;
  const W = pm.w, H = pm.h;
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const fxRef = useRef<HTMLCanvasElement | null>(null);
  const labelRef = useRef<HTMLCanvasElement | null>(null);

  // base: map pixels + markers + banners (repainted only when evidence changes)
  const stateKey = JSON.stringify(p.states);
  const base = useMemo(() => {
    const r = new Raster(W, H);
    for (let q = 0; q < W * H; q++) {
      const k = pm.idx[q] * 3;
      r.data[q * 4] = pm.palette[k]; r.data[q * 4 + 1] = pm.palette[k + 1]; r.data[q * 4 + 2] = pm.palette[k + 2]; r.data[q * 4 + 3] = 255;
    }
    // derived first, atoms last (banners fly over neighbours)
    const names = Object.keys(map.anchors).sort((a, b) => Number(p.atoms.has(a)) - Number(p.atoms.has(b)));
    for (const n of names) {
      const a = map.anchors[n];
      const st = p.states[n] ?? "untrained";
      const ax = Math.floor(a[0]), ay = Math.floor(a[1]);
      const mk = data.markers[n];
      if (mk) recolourMarker(r, mk.disc, mk.ring, st);
      if (p.atoms.has(n)) drawBanner(r, mk ? ax + 4 : ax, ay, st);
      else if (!mk) drawDisc(r, ax, ay, st);
    }
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pm, map, data.markers, stateKey, p.atoms]);
  useCanvasPaint(baseRef, base);

  // ghost levels 1..L of the whole base (level 0 = the base itself)
  const ghosts = useMemo(() => {
    const out: Uint8ClampedArray[] = [base.data];
    for (let l = 1; l <= GHOST_LEVELS; l++) {
      const d = new Uint8ClampedArray(base.data.length);
      const a = l / GHOST_LEVELS;
      for (let q = 0; q < W * H; q++) {
        const [r, g, b] = ghostRGB(base.data[q * 4], base.data[q * 4 + 1], base.data[q * 4 + 2], a);
        d[q * 4] = r; d[q * 4 + 1] = g; d[q * 4 + 2] = b; d[q * 4 + 3] = 255;
      }
      out.push(d);
    }
    return out;
  }, [base, W, H]);

  // the focus gradient, animated as a wavefront from the focus spot
  const focusRef = useRef<HTMLCanvasElement | null>(null);
  const fields = useRef(new Map<string, Float32Array>());
  const fieldFor = useCallback((f: Family | null): Float32Array | null => {
    if (!f) return null;
    const hit = fields.current.get(f);
    if (hit) return hit;
    const d = focusField(data.lands, FAMILIES.indexOf(f), W, H);
    fields.current.set(f, d);
    return d;
  }, [data.lands, W, H]);
  const shown = useRef<{ field: Float32Array | null; strength: number }>({ field: null, strength: 1 });
  const [focusOn, setFocusOn] = useState(false);
  const target = { field: fieldFor(p.focusFam), strength: p.focusStrength };
  const origin = p.focusAt;
  useEffect(() => {
    const cv = focusRef.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const from = shown.current, to = { field: fieldFor(p.focusFam), strength: p.focusStrength };
    const img = new ImageData(W + 2 * RING, H + 2 * RING);
    const paint = (front: number) => {
      compositeFocus(img.data, ghosts, from, to, front, origin, W, H);
      ctx.putImageData(img, 0, 0);
    };
    if (!to.field && !from.field) { setFocusOn(false); shown.current = to; return; }
    setFocusOn(true);
    const reach = Math.hypot(W, H);
    if (p.still || (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)) {
      paint(Infinity);
      shown.current = to;
      if (!to.field) setFocusOn(false);
      return;
    }
    let raf = 0, t0 = 0;
    const step = (now: number) => {
      if (!t0) t0 = now;
      const k = Math.min(1, (now - t0) / 420);
      const e = 1 - (1 - k) ** 3;
      paint(k >= 1 ? Infinity : e * reach);
      if (k < 1) raf = requestAnimationFrame(step);
      else { shown.current = to; if (!to.field) setFocusOn(false); }
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); shown.current = to; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.focusFam, p.focusStrength, ghosts, origin?.x, origin?.y, p.still, fieldFor, W, H]);
  void target;

  // life: the moving pixels, a 12-fps loop over the base (above the focus
  // layer, so each moving pixel ghosts itself by the same field)
  const lifeRef = useRef<HTMLCanvasElement | null>(null);
  const life = useMemo(() => analyseLife(pm, data.sea, data.lands, FAMILIES.indexOf("generative"), map.landmarks), [pm, data.sea, data.lands, map.landmarks]);
  // never paint over our own markers and banners
  const skip = useMemo(() => {
    const m = new Uint8Array(W * H);
    for (let q = 0; q < W * H; q++) {
      const k = pm.idx[q] * 3;
      if (base.data[q * 4] !== pm.palette[k] || base.data[q * 4 + 1] !== pm.palette[k + 1] || base.data[q * 4 + 2] !== pm.palette[k + 2]) m[q] = 1;
    }
    return m;
  }, [base, pm, W, H]);
  const latest = useRef({ travellers: p.travellers, focusFam: p.focusFam, focusStrength: p.focusStrength });
  useEffect(() => { latest.current = { travellers: p.travellers, focusFam: p.focusFam, focusStrength: p.focusStrength }; });
  useEffect(() => {
    const cv = lifeRef.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const img = new ImageData(W, H);
    const L = GHOST_LEVELS;
    const frame = (t: number) => {
      const { travellers, focusFam, focusStrength } = latest.current;
      const field = fieldFor(focusFam);
      const ghost = field
        ? (q: number) => Math.max(0, Math.min(L, Math.floor(ghostAt(field[q]) * L * focusStrength + BAYER4[(((q / W) | 0) & 3) * 4 + ((q % W) & 3)]))) / L
        : null;
      img.data.fill(0);
      paintLife(img.data, pm, life, t, { skip, ghost, ghostRGB }, travellers);
      ctx.putImageData(img, 0, 0);
    };
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (p.still || reduced) { frame(0); return; }
    let raf = 0, last = -1;
    const t0 = performance.now();
    const step = (now: number) => {
      const tick = Math.floor((now - t0) / (1000 / 12));
      if (tick !== last) { last = tick; frame(tick / 12); }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [pm, life, skip, fieldFor, p.still, W, H]);

  // labels: family signs + ribbons
  const labels = useMemo(() => {
    const r = new Raster(W, H);
    drawRibbons(r, [...p.signs, ...p.ribbons]);
    return r;
  }, [p.signs, p.ribbons, W, H]);
  useCanvasPaint(labelRef, labels);

  // fx: lineage, brackets, critter (march phase ticks only while something is lit)
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (p.still || !p.lineage.length) return;
    const id = setInterval(() => setPhase((v) => (v + 1) % 1000), 140);
    return () => clearInterval(id);
  }, [p.still, p.lineage.length]);
  const lineagePx = useMemo(() => p.lineage.map((pts) => rasterPolyline(pts)), [p.lineage]);
  const [sprites, setSprites] = useState<[Sprite, Sprite] | null>(null);
  useEffect(() => {
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx) setSprites([critterSprite(ctx, 0), critterSprite(ctx, 1)]);
  }, []);
  const fx = useMemo(() => {
    const r = new Raster(W, H);
    for (const px of lineagePx) drawLitRoad(r, px, phase);
    if (p.hovered && p.hovered !== p.selected && map.anchors[p.hovered]) {
      const a = map.anchors[p.hovered];
      const rad = p.atoms.has(p.hovered) ? 10 : 6;
      drawBrackets(r, Math.floor(a[0]), Math.floor(a[1]), rad, INK.parchHi, INK.ink);
    }
    if (p.selected && map.anchors[p.selected]) {
      const a = map.anchors[p.selected];
      const rad = (p.atoms.has(p.selected) ? 11 : 7) + (p.still ? 0 : phase % 4 < 2 ? 0 : 1);
      drawBrackets(r, Math.floor(a[0]), Math.floor(a[1]), rad, INK.goldHi, INK.maroon);
    }
    if (p.critter && sprites) {
      const s = sprites[p.critter.walking && phase % 2 ? 1 : 0];
      const hop = p.critter.hop ? Math.round(Math.sin(p.critter.hop * Math.PI) * 6) : 0;
      drawSprite(r, s, Math.round(p.critter.x - s.w / 2), Math.round(p.critter.y - s.h - hop), p.critter.dir < 0);
    }
    return r;
  }, [lineagePx, phase, p.hovered, p.selected, p.critter, p.atoms, p.still, sprites, map, W, H]);
  useCanvasPaint(fxRef, fx);

  // tell the skin once the base is on screen
  const { onPainted } = p;
  useEffect(() => { onPainted(); }, [base, onPainted]);

  const px = { position: "absolute", inset: 0, width: "100%", height: "100%", imageRendering: "pixelated" } as const;
  const hitR = Math.max(6, 12 / p.scale);
  return (
    <>
      <canvas ref={baseRef} width={W} height={H} style={px} aria-hidden />
      <canvas ref={focusRef} width={W + 2 * RING} height={H + 2 * RING} aria-hidden
        style={{ ...px, inset: "auto", left: `${(-RING / W) * 100}%`, top: `${(-RING / H) * 100}%`, width: `${((W + 2 * RING) / W) * 100}%`, height: `${((H + 2 * RING) / H) * 100}%`, visibility: focusOn ? "visible" : "hidden" }} />
      <canvas ref={lifeRef} width={W} height={H} style={px} aria-hidden />
      <canvas ref={fxRef} width={W} height={H} style={px} aria-hidden />
      <canvas ref={labelRef} width={W} height={H} style={px} aria-hidden />
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 block h-full w-full" role="group" aria-label="The models on the map">
        {Object.entries(map.anchors).map(([n, a]) => (
          <circle key={n} cx={a[0]} cy={a[1]} r={hitR} fill="transparent" role="button" tabIndex={0}
            aria-label={`${displayName(n)}: ${p.states[n] ?? "untrained"}`}
            className="cursor-pointer outline-none"
            onClick={(e) => { e.stopPropagation(); p.onSelect(n); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); p.onSelect(n); } }}
            onPointerEnter={() => p.onHover(n)} onPointerLeave={() => p.onHover(null)}
            onFocus={() => p.onHover(n)} onBlur={() => p.onHover(null)} />
        ))}
        {p.ribbons.map((rb) => (
          <rect key={`r-${rb.name}`} x={rb.box.x} y={rb.box.y} width={rb.box.w} height={rb.box.h} fill="transparent" aria-hidden
            className="cursor-pointer" onClick={(e) => { e.stopPropagation(); p.onSelect(rb.name); }}
            onPointerEnter={() => p.onHover(rb.name)} onPointerLeave={() => p.onHover(null)} />
        ))}
        {p.critter && (
          <rect x={p.critter.x - 7} y={p.critter.y - 15} width={14} height={16} fill="transparent" className="cursor-pointer"
            aria-label="the perceptron critter" role="img" onClick={(e) => { e.stopPropagation(); p.onCritter(); }} />
        )}
      </svg>
    </>
  );
});
