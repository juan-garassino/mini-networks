"use client";

// Skin B · 16-bit overworld (round 2). One <canvas> blits the cached,
// autotiled terrain (terrain.ts) at an integer zoom (view.ts) and draws the
// live layer: the focused lineage in gold with chevrons, the focused model on
// a plinth at +1 scale, the quest route, the critter, sailing ferries,
// running trains and the Konami wave. DOM overlays carry every word on pixel
// name-plates placed in SCREEN space (placeScreenLabels, constant size).
import { Sailboat } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ferryRoute, lineage, parkingSpot, pathToAtom, placeScreenLabels, samplePolyline,
  type Pt, type World, type WorldNode,
} from "@/lib/world";
import { useWorld } from "@/hooks/use-world";
import { useLesson } from "@/hooks/use-lesson";
import { useLabView, type Zoom } from "@/components/lab/shared/url-state";
import { LabMotion } from "@/components/lab/shared/still";
import { fitBox, useCamera, type CamBox } from "@/components/lab/shared/camera";
import { cardModel, displayName, evidenceState } from "@/components/lab/shared/card-model";
import { CRITTER } from "@/components/lab/shared/critter";
import {
  DOUBLE_DESCENT_EGG, GROKKING_EGG, NEXT_ERA, NEXT_ERA_COPY, RUINS, dipDepth, forwardPassOrder, forwardPassSchedule,
  stationCounts, useKonami, useLiveTraining, useLongFocus, useRealLossCurve,
} from "@/components/lab/shared/eggs";
import { Sparkline } from "@/components/lab/shared/lesson/sparkline";
import type { ModelEvidence, TaxonomyResponse } from "@/lib/types";
import { familyLabel } from "./palette";
import { downsample } from "./raster";
import type { NodeLook } from "./terrain";
import { artFlipX, artToCanvas, cloudSprites, critterSheet, emblemMasks, inkify, inkOutline, isletBlobs, props, RAMPS, PALETTE, type ArtImage, type Sprite } from "./art";
import { T } from "@/lib/world";
import { ArtImg } from "./art-img";
import { type Theme, buildArtLayers, buildMiniLayer, compassArt, tierFor, chevronOffsets, familyHubs, islandSlots, nodeSprite, regionCut, roadPolys, type ArtEmblems, type ArtLayers } from "./world-art";
import { snapTile, toScreen, xformFor, type Stage, type Xform } from "./view";
import { StatusCard } from "./status-card";
import { placeSigns, type Rect } from "./signs";
import { Legend } from "./legend";
import { TitleWindow } from "./title-window";
import { PixelWindow } from "./window";
import { PixelNum } from "./pixel-num";
import styles from "./pixel.module.css";

const CARD_W = 400 + 16 + 8;
const SHEET = 0.52;
const MOBILE_TOP = 84;
const MOBILE_KEY = 236;     // mobile overview: the lands cartouche under the map
const TITLE_GUTTER = 120;
const TS = 16;
// ADAPTIVE RESOLUTION (owner): ONE fixed on-screen pixel size for the map at every
// zoom — every art pixel is a Q×Q block — and zoom changes the level of detail
// (art px per world tile) instead. Levels are rendered natively and cached.
// Q = 3 on desktop so the overview can be 3 art px per tile AND show the whole land
// (4×3 would crop land); every art pixel is still a visible 3×3 block
const Q_DESKTOP = 3, Q_MOBILE = 3;
const LEVELS_DESKTOP = [3, 4, 6, 8];
const LEVELS_MOBILE = [1, 2, 4, 6];
const hex = (i: number) => PALETTE[i];
const GOLD = hex(RAMPS.gold[3]), INK = hex(RAMPS.ui[0]);
// each parent of the focus gets its own lit colour (primary first); children are foam-white
export const PARENT_TONES = [hex(RAMPS.gold[3]), hex(RAMPS.shallow[4]), hex(RAMPS.meadow[6]), hex(RAMPS.lava[2])];
const CHILD_TONE = hex(RAMPS.foam[1]);
// parchment: parents in the ink ramp + muted accents, children in light ink
const PARENT_TONES_INK = [hex(RAMPS.ink[0]), hex(RAMPS.rustP[2]), hex(RAMPS.sage[1]), hex(RAMPS.ochreP[0])];
const CHILD_TONE_INK = hex(RAMPS.ink[2]);
const X_RED = "#c8372d"; // the ONLY non-ink accent on the parchment map: X marks the focused model
/** A sprite as a canvas with its anchor (art px). */
type Stamp = { c: HTMLCanvasElement; ax: number; ay: number };
/** A sprite at a detail tier (integer downsample, palette-preserving), as a stamp. */
const stampT = (s: Sprite, f: number, flip = false, map?: (img: ArtImage) => ArtImage): Stamp => {
  let img = f <= 1 ? s.img : downsample(s.img, f, (v) => (v === 255 ? 0.8 : 1));
  if (map) img = map(img);
  return stamp({ ...s, img, anchor: f <= 1 ? s.anchor : { x: Math.round(s.anchor.x / f), y: Math.round(s.anchor.y / f) } }, flip);
};
const stamp = (s: Sprite, flip = false): Stamp => ({ c: artToCanvas(flip ? artFlipX(s.img) : s.img), ax: flip ? s.img.w - 1 - s.anchor.x : s.anchor.x, ay: s.anchor.y });

export function looksFrom(world: World | null, evidence: ModelEvidence[], taxonomy?: TaxonomyResponse | null): Map<string, NodeLook> {
  const m = new Map<string, NodeLook>();
  if (!world) return m;
  for (const n of world.nodes) {
    const ev = evidence.find((e) => e.name === n.name);
    const state = evidenceState(ev);
    const mech = taxonomy?.models.find((x) => x.name === n.name)?.introduces[0];
    m.set(n.name, { state, filled: state === "champion" || (ev?.run_count ?? 0) > 0, mech });
  }
  return m;
}

function padBox(b: CamBox, f: number, c: Pt): CamBox {
  const w = b.w * f, h = b.h * f;
  return { x: c.x - w / 2, y: c.y - h / 2, w, h };
}

/** Region zoom: fit the region's nodes (+labels) at ≥×2, cover-style, pulled toward the focus. */
function regionTarget(world: World, focus: WorldNode, stage: Stage): CamBox {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (b: CamBox) => { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); };
  for (const n of world.nodes) if (n.family === focus.family) grow({ x: n.foot.x * TS, y: n.foot.y * TS, w: n.foot.w * TS, h: n.foot.h * TS });
  const bw = x1 - x0 + 64, bh = y1 - y0 + 64;
  const sw = Math.max(stage.w, 2), sh = Math.max(stage.h, 2);
  const k = Math.max(1, snapTile(Math.min(sw / bw, sh / bh)) / 16);
  const w = sw / k, h = sh / k;
  const clamp = (c: number, f: number, half: number) => Math.min(Math.max(c, f - half * 0.55), f + half * 0.55);
  const cx = clamp((x0 + x1) / 2, focus.center.x, w / 2), cy = clamp((y0 + y1) / 2, focus.center.y, h / 2);
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/**
 * Overview frame: land + its halo, plus both secret islands on desktop (the
 * "?" isle and the ruins archipelago sit fully in frame); on mobile land + ruins.
 */
/** Ink palm-isle vignette: a mound, a palm and a rayed sun, in the maroon ink ramp. */
function palmIsle(): ArtImage {
  // drawn natively at the map grid's size (22×16 art px): mound, palm, rayed sun
  const w = 22, h = 16;
  const img: ArtImage = { w, h, data: new Uint8Array(w * h).fill(255) };
  const put = (x: number, y: number, v: number) => { if (x >= 0 && y >= 0 && x < w && y < h) img.data[y * w + x] = v; };
  const I0 = RAMPS.ink[0], I1 = RAMPS.ink[1];
  for (let x = 2; x < 19; x++) { const top = 13 - Math.round(2 * Math.sin(((x - 2) / 17) * Math.PI)); for (let y = top; y < 14; y++) put(x, y, y === top ? I0 : I1); }
  for (let x = 0; x < 22; x += 3) put(x, 15, I1);
  for (let y = 5; y < 12; y++) put(8 + (y > 8 ? 1 : 0), y, I0);
  for (const [dx, dy] of [[-4, 1], [-3, -1], [0, -2], [3, -1], [4, 1]]) for (let k = 0; k <= 3; k++) put(8 + Math.round((dx * k) / 3), 5 + Math.round((dy * k) / 3 + (k * k) / 6), I0);
  for (const [dx, dy] of [[0, -2], [2, 0], [0, 2], [-2, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]]) put(17 + dx, 4 + dy, Math.abs(dx) + Math.abs(dy) === 2 && dx * dy === 0 ? I0 : I1);
  put(17, 4, I1);
  return img;
}

/** The torn / burnt paper edge: a jagged dark rim with a scorched brown band inside it. */
function burntEdge(W: number, H: number, dpr: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const px = 3 * dpr; // edge "pixels"
  const n = (i: number, seed: number) => {
    const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const depth = (i: number, seed: number) => 2 + Math.round(3 * n(i, seed) + 2 * n(Math.floor(i / 5), seed + 1));
  const band = (along: number, seed: number, draw: (i: number, d: number) => void) => { for (let i = 0; i < along; i++) draw(i, depth(i, seed)); };
  const cols = Math.ceil(W / px), rows = Math.ceil(H / px);
  const paint = (x: number, y: number, d: number, horizontal: boolean, flip: boolean) => {
    for (let k = 0; k < d + 2; k++) {
      g.fillStyle = k < d - 1 ? "#3a120d" : k < d ? "#5a1a14" : k === d ? "#8a5a36" : "#b8935e";
      if (horizontal) g.fillRect(x * px, flip ? H - (k + 1) * px : k * px, px, px);
      else g.fillRect(flip ? W - (k + 1) * px : k * px, y * px, px, px);
    }
  };
  band(cols, 1, (i, d) => paint(i, 0, d, true, false));
  band(cols, 2, (i, d) => paint(i, 0, d, true, true));
  band(rows, 3, (i, d) => paint(0, i, d, false, false));
  band(rows, 4, (i, d) => paint(0, i, d, false, true));
  return c;
}

/** Integer tile for the desktop map sheet: 10 px per tile when the land's height fits, else 8. */
function sheetTile(world: World, vp: { w: number; h: number }): number {
  void world; void vp;
  return LEVELS_DESKTOP[0] * Q_DESKTOP; // the overview level: 2 art px per tile at 5 screen px per art px
}
function landBounds(world: World): CamBox {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of world.regions) { x0 = Math.min(x0, r.bbox.x * TS); y0 = Math.min(y0, r.bbox.y * TS); x1 = Math.max(x1, (r.bbox.x + r.bbox.w) * TS); y1 = Math.max(y1, (r.bbox.y + r.bbox.h) * TS); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
/**
 * Desktop overview = a full-bleed map sheet: the land fills the viewport height
 * (cover-fit, the camera crops sea, not land), nudged east until the uncharted
 * "?" isle just peeks in at the right edge.
 */
function sheetBox(world: World, vp: { w: number; h: number }): CamBox {
  const l = landBounds(world);
  const t = sheetTile(world, vp);
  const w = (vp.w * 16) / t, h = (vp.h * 16) / t;
  let cx = l.x + l.w / 2;
  const hidden = Math.min(...isletBlobs(world.hiddenIsland).map((b) => b.cx - b.rx));
  const want = hidden + 70 - (cx + w / 2);
  const room = l.x - 12 - (cx - w / 2);
  cx += Math.max(0, Math.min(want, room));
  return { x: cx - w / 2, y: l.y + l.h / 2 - h / 2, w, h };
}

function overviewBox(world: World, mobile: boolean): CamBox {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (x: number, y: number, w: number, h: number) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h); };
  for (const r of world.regions) grow(r.bbox.x * TS, r.bbox.y * TS, r.bbox.w * TS, r.bbox.h * TS);
  const isles = mobile ? [world.ruinsIsland] : [world.ruinsIsland, world.hiddenIsland];
  for (const isl of isles) for (const b of isletBlobs(isl)) grow(b.cx - b.rx - 10, b.cy - b.ry - 10, 2 * b.rx + 20, 2 * b.ry + 20);
  const pad = mobile ? 8 : 12;
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
}

const hit = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function PixelWorld() {
  const { view, update } = useLabView();
  // parchment is THE look (owner, 2026-09-29); ?theme=ocean keeps the old sea for comparison
  const [theme, setTheme] = useState<Theme>("parchment");
  useEffect(() => { if (new URLSearchParams(window.location.search).get("theme") === "ocean") setTheme("ocean"); }, []);
  const ink = theme === "parchment";
  // parchment keeps the full art colours on land sprites; they get a 1px ink outline to sit on paper
  const tint = useCallback((img: ArtImage) => (ink ? inkOutline(img) : img), [ink]);
  const inkArt = useCallback((img: ArtImage) => (ink ? inkify(img) : img), [ink]);
  const still = view?.still ?? true;
  const { world, taxonomy, evidence, runs, ready } = useWorld(view ? view.still : null);

  // ——— viewport & stage ———
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setVp({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const mobile = vp.w > 0 && vp.w < 640;

  const nodeOf = useMemo(() => new Map((world?.nodes ?? []).map((n) => [n.name, n])), [world]);
  const focusNode: WorldNode | undefined = view?.focus ? nodeOf.get(view.focus) : undefined;
  const zoom: Zoom = view?.zoom ?? "overview";
  const cardOpen = zoom === "node" && !!focusNode;

  const stage: Stage = useMemo(() => {
    if (mobile && zoom === "overview") return { x: 0, y: MOBILE_TOP, w: vp.w, h: Math.max(120, vp.h - MOBILE_TOP - MOBILE_KEY) };
    void TITLE_GUTTER; // desktop overview is full-bleed: the title is a cartouche ON the map
    if (!cardOpen) return { x: 0, y: 0, w: vp.w, h: vp.h };
    return mobile ? { x: 0, y: 0, w: vp.w, h: Math.round(vp.h * (1 - SHEET)) } : { x: 0, y: 0, w: Math.max(200, vp.w - CARD_W), h: vp.h };
  }, [cardOpen, mobile, zoom, vp.w, vp.h]);

  const target: CamBox = useMemo(() => {
    if (!world) return { x: 0, y: 0, w: 1, h: 1 };
    if (zoom === "node" && focusNode) return padBox(world.camera.nodes[focusNode.name].box, 2.2, focusNode.center);
    if (zoom === "region" && focusNode) return regionTarget(world, focusNode, stage);
    if (!mobile && vp.w > 0) return sheetBox(world, vp);
    return overviewBox(world, mobile);
  }, [world, zoom, focusNode, stage, mobile, vp.w, vp.h]);

  const cam = useCamera({ world: world?.camera.all ?? target, target, still, minWidth: 180 });
  const miniMode = mobile && zoom === "overview";
  // front-load the zoom step: once a flight is a quarter done, draw at the target's
  // integer scale (the pan finishes at that scale) instead of snapping at the very end
  const flight = useRef<{ key: string; w0: number } | null>(null);
  const tKey = `${target.x}|${target.y}|${target.w}|${target.h}`;
  if (!flight.current || flight.current.key !== tKey) flight.current = { key: tKey, w0: cam.box.w };
  const fitT = xformFor(fitBox(target, stage.w, stage.h), stage, 32, { fit: zoom === "overview" ? "contain" : "cover" });
  const fitted = fitBox(target, stage.w, stage.h);
  const atTarget = Math.abs(cam.box.w - fitted.w) < 1 && Math.abs(cam.box.x - fitted.x) < 1 && Math.abs(cam.box.y - fitted.y) < 1;
  const prog = Math.abs(flight.current.w0 - fitBox(target, stage.w, stage.h).w) < 1 ? 1
    : 1 - Math.abs(cam.box.w - fitBox(target, stage.w, stage.h).w) / Math.abs(flight.current.w0 - fitBox(target, stage.w, stage.h).w);
  const sheetMode = !mobile && zoom === "overview" && !!world;
  const Q = mobile ? Q_MOBILE : Q_DESKTOP;
  const LEVELS = mobile ? LEVELS_MOBILE : LEVELS_DESKTOP;
  const pickTile = (box: CamBox, contain: boolean) => {
    if (stage.w <= 1 || !Number.isFinite(box.w)) return LEVELS[0] * Q;
    const k0 = contain ? Math.min(stage.w / box.w, stage.h / box.h) : Math.max(stage.w / box.w, stage.h / box.h);
    const want = k0 * 16 * (contain ? 1.02 : 1.12);
    let best = LEVELS[0] * Q;
    for (const a of LEVELS) if (a * Q <= want) best = a * Q;
    return best;
  };
  const contain = zoom === "overview";
  const tileNow = prog > 0.25 ? pickTile(fitBox(target, stage.w, stage.h), contain) : pickTile(cam.box, contain);
  const xf0: Xform = xformFor(cam.box, stage, 999, { tile: tileNow as 8 });
  // pan in whole art pixels: offsets snap to the fixed grid
  const xf: Xform = { ...xf0, ox: Math.round(xf0.ox / Q) * Q, oy: Math.round(xf0.oy / Q) * Q };
  const apt = xf.tile / Q;
  void sheetTile; void fitT;

  // ——— identity: species emblems (async raster), evidence looks, cached layers ———
  const [emblems, setEmblems] = useState<ArtEmblems | null>(null);
  useEffect(() => {
    if (!taxonomy) return;
    let alive = true;
    const names = [...taxonomy.models.map((m) => m.name), ...taxonomy.compositions.map((c) => c.name)];
    emblemMasks(names, [7, 9]).then((e) => { if (alive) setEmblems(e); });
    return () => { alive = false; };
  }, [taxonomy]);

  const looks = useMemo(() => looksFrom(world, evidence, taxonomy), [world, evidence, taxonomy]);
  const lookSig = useMemo(() => [...looks].map(([k, v]) => `${k}:${v.state}:${v.filled}`).join(","), [looks]);
  // one cached composite per level; the current level is built first, the rest at idle
  const levelCache = useRef(new Map<number, ArtLayers>());
  const [levelsVer, setLevelsVer] = useState(0);
  const cacheKey = `${theme}|${lookSig}|${emblems ? "e" : ""}|${mobile ? "m" : "d"}`;
  const cacheKeyRef = useRef(cacheKey);
  if (cacheKeyRef.current !== cacheKey) { cacheKeyRef.current = cacheKey; levelCache.current = new Map(); }
  useEffect(() => {
    if (!world || !ready || !emblems) return;
    let alive = true;
    const order = [apt, ...LEVELS.filter((a) => a !== apt)];
    let i = 0;
    const next = () => {
      if (!alive) return;
      while (i < order.length && levelCache.current.has(order[i])) i++;
      if (i >= order.length) return;
      levelCache.current.set(order[i], buildArtLayers(world, looks, emblems, order[i], theme));
      setLevelsVer((v) => v + 1);
      i++;
      setTimeout(next, 60);
    };
    if (!levelCache.current.has(apt)) {
      levelCache.current.set(apt, buildArtLayers(world, looks, emblems, apt, theme));
      setLevelsVer((v) => v + 1);
    }
    const id = setTimeout(next, 250);
    return () => { alive = false; clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, ready, cacheKey, apt]);
  const layers = levelCache.current.get(apt) ?? null;
  void levelsVer;
  const sheet = null; const mini = null; void buildMiniLayer;

  const regionId = zoom === "region" && focusNode ? world?.regions.find((r) => r.family === focusNode.family)?.id ?? -1 : -1;
  // region cut-outs are precomputed once per layer build (idle time), so a fly into a
  // region never stalls the camera on a full-layer pass
  const cuts = useRef(new Map<string, HTMLCanvasElement>());
  useEffect(() => {
    if (!layers || !world) return;
    let i = 0, alive = true;
    const next = () => {
      if (!alive || i >= world.regions.length) return;
      const r = world.regions[i++];
      if (!cuts.current.has(`${apt}:${r.id}`)) cuts.current.set(`${apt}:${r.id}`, regionCut(layers, r.id));
      setTimeout(next, 30);
    };
    const id = setTimeout(next, 200);
    return () => { alive = false; clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, world]);
  const spot = useMemo(() => {
    if (!layers || regionId < 0) return null;
    const key = `${apt}:${regionId}`;
    let c = cuts.current.get(key);
    if (!c) { c = regionCut(layers, regionId); cuts.current.set(key, c); }
    return c;
  }, [layers, regionId, apt]);

  // ——— focus: lineage + the loud sprite ———
  const lin = useMemo(() => (world && focusNode ? lineage(world, focusNode.name) : null), [world, focusNode]);
  const kin = useMemo(() => new Set(lin ? [...lin.parents.map((r) => r.from), ...lin.children.map((r) => r.to)] : []), [lin]);
  const kinTone = useMemo(() => new Map<string, string>(lin
    ? [...lin.children.map((r) => [r.to, CHILD_TONE] as [string, string]), ...lin.parents.map((r, i) => [r.from, PARENT_TONES[i % PARENT_TONES.length]] as [string, string])]
    : []), [lin]);
  const polys = useMemo(() => (world ? new Map(roadPolys(world).map((p) => [p.road.id, p.pts])) : new Map<string, Pt[]>()), [world]);
  const focusSprite = useMemo(() => {
    if (!focusNode || !emblems || typeof document === "undefined") return null;
    const look = looks.get(focusNode.name) ?? { state: "untrained" as const, filled: false };
    const sp = nodeSprite(focusNode, look, emblems);
    const f = focusNode.atom ? tierFor(apt).castle || 2 : Math.max(2, tierFor(apt).marker);
    return stampT(sp, f, false, tint);
  }, [focusNode, emblems, looks, tint, apt]);

  // ——— live-layer sprites ———
  const critter = useMemo(() => {
    if (typeof document === "undefined") return null;
    const sh = critterSheet();
    const f = Math.max(1, tierFor(apt).live);
    const T2 = (fr: Sprite) => { const d = f > 1 ? downsample(fr.img, f, (v) => (v === 255 ? 0.8 : 1)) : fr.img; return { ...fr, img: tint(d), anchor: { x: Math.round(fr.anchor.x / f), y: Math.round(fr.anchor.y / f) } }; };
    return { right: sh.walk.map((fr) => stamp(T2(fr))), left: sh.walk.map((fr) => stamp(T2(fr), true)), idle: stamp(T2(sh.idle[0]), true), train: stamp(T2(sh.train), true), w: Math.ceil(sh.walk[0].img.w / f), h: Math.ceil(sh.walk[0].img.h / f) };
  }, [tint, apt]);
  const small = useMemo(() => {
    if (typeof document === "undefined") return null;
    // parchment: galleons and engines are ink line art
    const f = apt >= 6 ? 1 : 2;
    const I = (fr: Sprite) => ({ ...fr, img: inkArt(fr.img) });
    return { boat: stampT(I(props.boat()), f), boatL: stampT(I(props.boat(true)), f), train: stampT(I(props.train(0)), f), trainL: stampT(I(props.train(0)), f, true) };
  }, [inkArt, apt]);

  // ——— motion: one rAF driver while anything is animating ———
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const animate = !still && !reduced;
  const drawRef = useRef<(now?: number) => void>(() => {});
  const active = useRef(new Set<string>());
  const rafId = useRef(0);
  const loop = useCallback(() => {
    if (rafId.current) return;
    const step = (now: number) => {
      rafId.current = 0;
      drawRef.current(now);
      if (active.current.size) rafId.current = requestAnimationFrame(step);
    };
    rafId.current = requestAnimationFrame(step);
  }, []);
  const startAnim = useCallback((k: string) => { active.current.add(k); loop(); }, [loop]);
  const stopAnim = useCallback((k: string) => { active.current.delete(k); }, []);
  useEffect(() => () => cancelAnimationFrame(rafId.current), []);

  // critter: walk from the root atom to the focused model, park at parkingSpot (never on the spot)
  const walk = useRef<{ at: (t: number) => Pt & { angle: number }; len: number; t0: number; speed: number; park: Pt } | null>(null);
  useEffect(() => {
    if (!world || !focusNode) { walk.current = null; drawRef.current(); return; }
    const park = parkingSpot(world, focusNode.name);
    const path = pathToAtom(world, focusNode.name);
    const pts = [...path.points].reverse();
    if (pts.length > 1) pts[pts.length - 1] = { x: park.x, y: park.y };
    const s = samplePolyline(pts.length > 1 ? pts : [park, park]);
    // the critter sets off once the camera has landed (fly ≈ 700ms) and takes ≥1.6s,
    // so the walk is the one orchestrated moment after a selection
    const LAND = 750;
    const speed = Math.min(Math.max(120, s.length / 3.2), Math.max(60, s.length / 1.6));
    walk.current = { at: s.at, len: s.length, t0: performance.now() + LAND, speed, park };
    if (!animate || s.length < 1) { walk.current.t0 = -1e9; drawRef.current(); return; }
    startAnim("walk");
    const done = setTimeout(() => stopAnim("walk"), LAND + (s.length / speed) * 1000 + 100);
    return () => { clearTimeout(done); stopAnim("walk"); };
  }, [world, focusNode, animate, startAnim, stopAnim]);

  // ferry: a selected composition sails its route (double_descent dips twice)
  const [sailing, setSailing] = useState<string | null>(null);
  useEffect(() => { setSailing(null); }, [focusNode?.name]);
  const sail = useRef<{ pts: Pt[]; at: (t: number) => Pt & { angle: number }; len: number; t0: number; dd: boolean } | null>(null);
  useEffect(() => {
    if (!world || !taxonomy || !sailing) { sail.current = null; drawRef.current(); return; }
    const comp = taxonomy.compositions.find((c) => c.name === sailing);
    if (!comp) return;
    const route = ferryRoute(world, comp.composes);
    let pts = route.points;
    const dd = sailing === DOUBLE_DESCENT_EGG.composition;
    if (dd) {
      // the double-descent egg: the course dips twice (dipDepth), crest at the interpolation threshold
      const s0 = samplePolyline(pts);
      pts = Array.from({ length: 80 }, (_, i) => {
        const t = i / 79, p = s0.at(t);
        const amp = 42 * dipDepth(t);
        return { x: p.x - Math.sin(p.angle) * amp, y: p.y + Math.cos(p.angle) * amp };
      });
    }
    const s = samplePolyline(pts);
    sail.current = { pts, at: s.at, len: s.length, t0: animate ? performance.now() : -1e9, dd };
    if (!animate) { drawRef.current(); return; }
    startAnim("sail");
    const done = setTimeout(() => stopAnim("sail"), (s.length / 220) * 1000 + 200);
    return () => { clearTimeout(done); stopAnim("sail"); };
  }, [world, taxonomy, sailing, animate, startAnim, stopAnim]);

  // trains = live training: a train runs the lineage line of every model with a running run
  const live = useLiveTraining(runs);
  const stations = useMemo(() => stationCounts(runs), [runs]);
  const trains = useMemo(() => (world ? live.map((m) => {
    const p = pathToAtom(world, m);
    return { model: m, ...samplePolyline([...p.points].reverse()) };
  }).filter((t) => t.length > 0) : []), [world, live]);
  // no live run right now → in every land one engine waits, parked on the rails
  // beside that land's busiest station (the model with the most logged runs)
  const parked = useMemo(() => {
    if (!world || live.length) return null;
    const out: { model: string; runs: number; at: Pt & { angle: number } }[] = [];
    for (const r of world.regions) {
      const best = world.nodes.filter((n) => n.family === r.family && (stations[n.name] ?? 0) > 0)
        .sort((a, b) => (stations[b.name] ?? 0) - (stations[a.name] ?? 0) || (a.name < b.name ? -1 : 1))[0];
      if (!best) continue;
      const road = world.roads.find((x) => x.to === best.name && x.lanePoints.length > 1) ?? world.roads.find((x) => x.from === best.name && x.lanePoints.length > 1);
      if (!road) continue;
      const sp = samplePolyline(road.lanePoints);
      // stand clear of the castle / marker: ~110 world px along the rails
      const t = road.to === best.name ? Math.max(0, 1 - 110 / Math.max(sp.length, 1)) : Math.min(1, 110 / Math.max(sp.length, 1));
      out.push({ model: best.name, runs: stations[best.name] ?? 0, at: sp.at(t) });
    }
    return out;
  }, [world, live, stations]);
  useEffect(() => {
    if (!trains.length || !animate) { drawRef.current(); return; }
    startAnim("trains");
    return () => stopAnim("trains");
  }, [trains, animate, startAnim, stopAnim]);

  // Konami: a forward pass across the zoo in generation order
  const konami = useRef<{ t0: number; at: Record<string, number>; end: number } | null>(null);
  const onKonami = useCallback(() => {
    if (!world || !animate) return;
    const at = forwardPassSchedule(forwardPassOrder(world), 450);
    konami.current = { t0: performance.now(), at, end: Math.max(...Object.values(at)) + 900 };
    startAnim("konami");
    setTimeout(() => { stopAnim("konami"); konami.current = null; drawRef.current(); }, konami.current.end + 50);
  }, [world, animate, startAnim, stopAnim]);
  useKonami(onKonami, animate);

  // critter egg: 7 clicks → it trains on a REAL loss curve
  // counter in refs (no stale closures between rapid clicks); the real curve is
  // prefetched once per session so the bubble fills within ~1s of the 7th click
  const clicks = useRef({ n: 0, last: 0 });
  const [critterUnlocked, setCritterUnlocked] = useState(false);
  const critterEgg = useMemo(() => ({
    click: () => {
      const now = Date.now();
      clicks.current.n = now - clicks.current.last <= 2500 ? clicks.current.n + 1 : 1;
      clicks.current.last = now;
      if (clicks.current.n >= 7) setCritterUnlocked(true);
    },
  }), []);
  const realCurve = useRealLossCurve(runs, !still && ready);
  const [trainT, setTrainT] = useState(0);
  useEffect(() => {
    if (!critterUnlocked) { setTrainT(0); return; }
    if (!realCurve.curve || !animate) { setTrainT(realCurve.curve ? 1 : 0); return; }
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => { const t = Math.min(1, (now - t0) / 2600); setTrainT(t); if (t < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [realCurve.curve, animate, critterUnlocked]);

  // grokking egg: hold (hover / keyboard focus) the grokking spot 4 s
  const [hovered, setHovered] = useState<string | null>(null);
  const grokked = useLongFocus(!still && hovered === GROKKING_EGG.model ? hovered : null, GROKKING_EGG.holdMs);
  const [epitaph, setEpitaph] = useState<string | null>(null);
  const [teaser, setTeaser] = useState<string | null>(null);

  // ——— canvas painting ———
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevTile = useRef<number | null>(null);
  const dissolve = useRef<{ snap: HTMLCanvasElement | null; t0: number }>({ snap: null, t0: 0 });
  const burnt = useRef<{ key: string; c: HTMLCanvasElement } | null>(null);
  const [drawn, setDrawn] = useState(false);
  const kinSprites = useMemo(() => {
    if (!world || !emblems || !lin || typeof document === "undefined") return null;
    const names = [...new Set([...lin.parents.map((r) => r.from), ...lin.children.map((r) => r.to)])];
    return new Map(names.map((name) => {
      const m = nodeOf.get(name)!;
      const look = looks.get(name) ?? { state: "untrained" as const, filled: false };
      const sp = nodeSprite(m, look, emblems);
      const f = m.atom ? tierFor(apt).castle || 2 : Math.max(2, tierFor(apt).marker);
      return [name, { s: stampT(sp, f, false, tint), node: m }] as const;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, emblems, lin, looks, nodeOf, apt]);
  const latest = useRef({ Q, apt, ink, sheet, xf, layers, spot, focusNode, vp, critter, small, lin, polys, focusSprite, zoom, trains, nodeOf, cardOpen, stage, kinSprites, world, parked, mini });
  latest.current = { Q, apt, ink, sheet, xf, layers, spot, focusNode, vp, critter, small, lin, polys, focusSprite, zoom, trains, nodeOf, cardOpen, stage, kinSprites, world, parked, mini };

  const draw = useCallback((nowArg?: number) => {
    const c = canvasRef.current;
    const L = latest.current;
    if (!c || !L.layers || L.vp.w === 0) return;
    const now = nowArg ?? performance.now();
    const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
    const W = L.vp.w * dpr, H = L.vp.h * dpr;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // zoom-step change: keep the last frame and dissolve it away in 4×4 cells (100ms)
    if (animate && prevTile.current !== null && prevTile.current !== L.xf.tile && c.width === W) {
      const snap = dissolve.current.snap ?? document.createElement("canvas");
      snap.width = W; snap.height = H;
      snap.getContext("2d")!.drawImage(c, 0, 0);
      dissolve.current = { snap, t0: now };
      startAnim("dissolve");
      setTimeout(() => stopAnim("dissolve"), 140);
    }
    prevTile.current = L.xf.tile;
    const dimAll = (L.zoom === "node" && !!L.focusNode) || (!!L.spot && L.zoom === "region");
    const INKM = L.ink;
    ctx.fillStyle = INKM ? hex(dimAll ? RAMPS.paper[1] : RAMPS.paper[2]) : hex(dimAll ? RAMPS.ocean[2] : RAMPS.ocean[3]); // sea beyond the art extent matches the (dimmed) layer
    ctx.fillRect(0, 0, W, H);
    const { tile, ox, oy, k } = L.xf;
    // FIXED GRID: every art pixel is U×U device px at every zoom; all live marks snap to it
    const U = L.Q * dpr;
    const S = (q: Pt) => ({ x: Math.round(((q.x * k + ox) * dpr) / U) * U, y: Math.round(((q.y * k + oy) * dpr) / U) * U });
    const far = L.apt < 2;
    // focus steps everything else back ONE ramp step (colour math, no veil):
    // node view → whole map one step darker, the lineage redrawn loud on top;
    // region view → the region's land is cut back in at full value along its coast.
    const stepBack = (L.zoom === "node" && !!L.focusNode) || (!!L.spot && L.zoom === "region");
    const Ly = L.layers;
    const layer = stepBack ? Ly.dim : Ly.full;
    const o = { x: (Ly.origin.x * k + ox) * dpr, y: (Ly.origin.y * k + oy) * dpr };
    ctx.drawImage(layer, Math.round(o.x), Math.round(o.y), layer.width * U, layer.height * U);
    if (L.spot && L.zoom === "region") ctx.drawImage(L.spot, Math.round(o.x), Math.round(o.y), L.spot.width * U, L.spot.height * U);
    const u = U;   // one art px on screen
    const bs = U;  // marks are drawn in whole art pixels
    const n = L.focusNode;
    const drawStamp = (st: Stamp, at: Pt, scale: number) => {
      const q = S(at);
      ctx.drawImage(st.c, Math.round(q.x - st.ax * scale), Math.round(q.y - st.ay * scale), st.c.width * scale, st.c.height * scale);
    };
    const footOf = (m: WorldNode): Pt => ({ x: m.center.x, y: (m.foot.y + m.foot.h) * TS });

    // node view: the direct kin come back at full value (their own sprites)
    if (n && L.zoom === "node" && L.kinSprites) for (const { s: st, node } of L.kinSprites.values()) drawStamp(st, footOf(node), U);

    // the focused lineage: every parent road (own colour, primary gold) and child road (white),
    // each on its own lane, ink-edged, with ink chevrons parent → child
    if (L.lin && L.zoom === "node") {
      const PT = INKM ? PARENT_TONES_INK : PARENT_TONES, CT = INKM ? CHILD_TONE_INK : CHILD_TONE;
      const lit = [
        ...L.lin.children.map((r) => [r, CT] as const),
        ...L.lin.parents.map((r, i) => [r, PT[i % PT.length]] as const).reverse(),
      ];
      for (const [r, tone] of lit) {
        const pts = L.polys.get(r.id) ?? [];
        const artW = 16 / L.apt; // world px per art px
        for (const [size, col] of (INKM ? [[1, tone]] : [[3, INK], [1, tone]]) as [number, string][]) {
          ctx.fillStyle = col;
          let n2 = 0;
          for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i];
            const len = Math.hypot(b.x - a.x, b.y - a.y);
            for (let d = 0; d <= len; d += artW) {
              // parchment: a dotted treasure trail (2 art px on, 2 off)
              if (INKM && n2++ % 4 >= 2) continue;
              const q = S({ x: a.x + ((b.x - a.x) * d) / len, y: a.y + ((b.y - a.y) * d) / len });
              const h2 = Math.floor(size / 2) * U;
              ctx.fillRect(q.x - h2, q.y - h2, size * U, size * U);
            }
          }
        }
        if (tile >= 16) for (const ch of r.chevrons) {
          const c0 = S(ch);
          ctx.fillStyle = INK;
          ctx.fillStyle = tone;
          for (const [x, y] of chevronOffsets(ch.angle, L.apt >= 4 ? 2 : 1)) ctx.fillRect(c0.x + x * U, c0.y + y * U, U, U);
        }
      }
    }

    // harbours: up to 3 big boats per dock (one per pipeline), the rest counted on a plate
    if (L.small && L.apt >= 2 && L.world) for (const h of L.world.harbours) {
      const nB = Math.min(L.apt >= 4 ? 3 : 1, h.boats); // overview: one boat + ×N plate (quieter coasts)
      const st = L.small.boat, sc = U;
      for (let i = 0; i < nB; i++) {
        const q = S(h.pt);
        const x = q.x + (i - (nB - 1) / 2) * (st.c.width + 2) * sc;
        ctx.drawImage(st.c, x - st.ax * sc, q.y - st.ay * sc, st.c.width * sc, st.c.height * sc);
      }
    }

    // quest route: the critter's walk from the root atom, dotted in gold behind it
    const w = walk.current;
    // rAF timestamps can precede t0 → clamp at 0
    const walked = w ? Math.max(0, Math.min(w.len, w.t0 < 0 ? w.len : ((now - w.t0) / 1000) * w.speed)) : 0;
    if (w && L.apt >= 3 && w.len > 0) {
      const artW = 16 / L.apt;
      for (let d = 3 * artW; d <= walked - 3 * artW; d += 4 * artW) {
        const q = S(w.at(d / w.len));
        ctx.fillStyle = INKM ? hex(RAMPS.ink[0]) : CHILD_TONE;
        ctx.fillRect(q.x, q.y, U, U);
      }
    }

    // focus: plinth + the model's own sprite one scale step louder + gold corner brackets
    if (n && L.focusSprite) {
      const st = L.focusSprite;
      const foot = S(footOf(n));
      const sw = st.c.width * U, sh = st.c.height * U;
      const left = foot.x - st.ax * U, top = foot.y - st.ay * U;
      const cell = (x: number, y: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(x, y, U, U); };
      if (INKM) {
        // X marks the spot: a red pixel X, ink-rimmed, just below the model's feet
        const R = L.apt >= 4 ? 3 : 2, cy = foot.y + (R + 1) * U;
        for (let t = -R - 1; t <= R + 1; t++) { cell(foot.x + t * U, cy + t * U, hex(RAMPS.ink[0])); cell(foot.x + t * U, cy - t * U, hex(RAMPS.ink[0])); }
        for (let t = -R; t <= R; t++) { cell(foot.x + t * U, cy + t * U, X_RED); cell(foot.x + t * U, cy - t * U, X_RED); }
      } else {
        for (let t = -3; t <= 3; t++) { cell(foot.x + t * U, foot.y, INK); cell(foot.x + t * U, foot.y + U, GOLD); }
      }
      ctx.drawImage(st.c, left, top, sw, sh);
      // corner brackets, 1 art px thick, 3 long
      const x0 = left - 2 * U, y0 = top - 2 * U, x1 = left + sw + U, y1 = foot.y + U, arm = 3;
      const col = INKM ? hex(RAMPS.ink[0]) : GOLD;
      for (const [cx, cy, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]] as const) {
        for (let a2 = 0; a2 < arm; a2++) { cell(cx + dx * a2 * U, cy, col); cell(cx, cy + dy * a2 * U, col); }
      }
    }

    // ferry sailing a composition
    const sl = sail.current;
    if (sl && L.small) {
      ctx.fillStyle = CHILD_TONE;
      ctx.fillStyle = INKM ? hex(RAMPS.ink[1]) : CHILD_TONE;
      for (let d = 0; d <= sl.len; d += 3 * 16 / L.apt) { const q2 = S(sl.at(d / sl.len)); ctx.fillRect(q2.x, q2.y, U, U); }
      const t = sl.t0 < 0 ? 0 : Math.min(1, ((now - sl.t0) / 1000) * 220 / Math.max(sl.len, 1));
      const q = sl.at(t), s = S(q);
      const st = Math.cos(q.angle) < 0 ? L.small.boatL : L.small.boat;
      const sc = U;
      ctx.drawImage(st.c, s.x - st.ax * sc, s.y - st.ay * sc, st.c.width * sc, st.c.height * sc);
    }

    // trains on the rails of models that are training right now
    if (L.small && L.apt >= 3) for (const tr of L.trains) {
      const t = animate ? ((now / 1000) * 120 / tr.length) % 1 : 0.5;
      const q = tr.at(t), s = S(q);
      const st = Math.cos(q.angle) < 0 ? L.small.trainL : L.small.train;
      const sc = U;
      ctx.drawImage(st.c, s.x - st.ax * sc, s.y - st.ay * sc, st.c.width * sc, st.c.height * sc);
    }
    // no live run: one engine waits, parked, at each land's busiest station
    if (L.small && L.apt >= 3 && L.parked) for (const pk of L.parked) {
      const q = pk.at, s = S(q);
      const st = Math.cos(q.angle) < 0 ? L.small.trainL : L.small.train;
      const sc = U;
      ctx.drawImage(st.c, s.x - st.ax * sc, s.y - st.ay * sc, st.c.width * sc, st.c.height * sc);
    }

    // Konami forward pass: each generation lights up in turn
    const kz = konami.current;
    if (kz) {
      const el = now - kz.t0;
      for (const [name, at] of Object.entries(kz.at)) {
        const m = L.nodeOf.get(name);
        if (!m || el < at || el > at + 700) continue;
        const a = S({ x: m.foot.x * TS - 6, y: m.foot.y * TS - 6 }), b = S({ x: (m.foot.x + m.foot.w) * TS + 6, y: (m.foot.y + m.foot.h) * TS + 6 });
        const th = U;
        ctx.fillStyle = INKM ? X_RED : GOLD;
        ctx.fillRect(Math.round(a.x), Math.round(a.y), Math.round(b.x - a.x), th); ctx.fillRect(Math.round(a.x), Math.round(b.y - th), Math.round(b.x - a.x), th);
        ctx.fillRect(Math.round(a.x), Math.round(a.y), th, Math.round(b.y - a.y)); ctx.fillRect(Math.round(b.x - th), Math.round(a.y), th, Math.round(b.y - a.y));
      }
    }

    // the critter
    if (w && L.critter && L.apt >= 3) {
      const arrived = walked >= w.len - 0.5;
      const q = arrived ? w.park : w.at(walked / Math.max(w.len, 1));
      const s = S(q);
      const dir = arrived ? -1 : Math.cos(w.at(walked / Math.max(w.len, 1)).angle) < 0 ? -1 : 1;
      const step = arrived ? 0 : Math.floor(walked / 7) % 4;
      const st = arrived ? L.critter.idle : (dir < 0 ? L.critter.left : L.critter.right)[step];
      const hopY = now - hop.current < 200 ? -2 * U : 0;
      ctx.drawImage(st.c, s.x - st.ax * U, s.y - st.ay * U + hopY, st.c.width * U, st.c.height * U);
    }
    // parchment: a torn, burnt paper edge frames the whole sheet
    if (INKM) {
      const key = `${W}x${H}`;
      if (!burnt.current || burnt.current.key !== key) burnt.current = { key, c: burntEdge(W, H, dpr) };
      ctx.drawImage(burnt.current.c, 0, 0);
    }
    const dz = dissolve.current;
    void far; void tile; void bs; void u;
    if (dz.snap && dz.t0 > 0 && now - dz.t0 < 100) {
      const tt = (now - dz.t0) / 100;
      const cw = Math.ceil(W / U), ch = Math.ceil(H / U);
      const mask = document.createElement("canvas");
      mask.width = cw; mask.height = ch;
      const mctx = mask.getContext("2d")!;
      const id = mctx.createImageData(cw, ch);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5][(y & 3) * 4 + (x & 3)] / 16;
        if (B >= tt) id.data[(y * cw + x) * 4 + 3] = 255;
      }
      mctx.putImageData(id, 0, 0);
      const tmp = document.createElement("canvas");
      tmp.width = W; tmp.height = H;
      const tctx = tmp.getContext("2d")!;
      tctx.imageSmoothingEnabled = false;
      tctx.drawImage(dz.snap, 0, 0);
      tctx.globalCompositeOperation = "destination-in";
      tctx.drawImage(mask, 0, 0, cw * U, ch * U);
      ctx.drawImage(tmp, 0, 0);
    }
    if (!drawn) setDrawn(true);
  }, [drawn, animate, startAnim, stopAnim]);
  drawRef.current = draw;
  useLayoutEffect(() => { draw(); });

  // ——— interaction ———
  const go = useCallback((name: string) => update({ zoom: "node", focus: name }), [update]);
  const back = useCallback(() => {
    if (zoom === "node") update({ zoom: "region" });
    else if (zoom === "region") update({ zoom: "overview" });
  }, [zoom, update]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") back(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back]);

  const press = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const onPointerDown = (e: React.PointerEvent) => { press.current = { x: e.clientX, y: e.clientY }; moved.current = false; cam.handlers.onPointerDown(e); };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = press.current;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) >= 4) moved.current = true;
    cam.handlers.onPointerMove(e);
  };
  const onPointerUp = () => { press.current = null; cam.handlers.onPointerUp(); };
  const onNode = (name: string) => { if (!moved.current) go(name); };
  // far overview: tap a land → its region (centred on the land's hub atom)
  const hubs = useMemo(() => (world ? familyHubs(world) : new Map<string, WorldNode>()), [world]);
  const openLand = (regionId: number) => {
    const r = world?.regions[regionId];
    const hub = r ? hubs.get(r.family) : undefined;
    if (hub) update({ zoom: "region", focus: hub.name });
  };
  const onStageClick = (e: React.MouseEvent) => {
    if (!miniMode || moved.current || !world) return;
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    const wx = (e.clientX - rect.left - xf.ox) / xf.k, wy = (e.clientY - rect.top - xf.oy) / xf.k;
    const tx = Math.floor(wx / TS), ty = Math.floor(wy / TS);
    if (tx < 0 || ty < 0 || tx >= world.cols || ty >= world.rows) return;
    const rid = world.regionOf[ty * world.cols + tx];
    if (rid >= 0) openLand(rid);
  };

  // test hook for scripts/shoot.mjs --motion (real interaction paths only)
  const critterClickRef = useRef(critterEgg.click);
  critterClickRef.current = critterEgg.click;
  // each click: the critter hops (the answer to the action), and the egg counter advances
  const hop = useRef(0);
  const onCritter = useCallback(() => {
    critterClickRef.current();
    hop.current = performance.now();
    if (animate) { startAnim("hop"); setTimeout(() => { stopAnim("hop"); drawRef.current(); }, 220); }
  }, [animate, startAnim, stopAnim]);
  useEffect(() => {
    if (!drawn || !ready) return;
    const w = window as unknown as { __lab?: unknown };
    w.__lab = {
      select: (name: string) => go(name),
      view: (v: { zoom: Zoom; focus?: string }) => update({ zoom: v.zoom, ...(v.focus ? { focus: v.focus } : {}) }),
      critterClick: (n: number) => {
        if (!walk.current) return false;
        // one click per tick, exactly like a person clicking (each click re-renders the counter)
        for (let i = 0; i < n; i++) setTimeout(() => onCritter(), i * 60);
      },
    };
    return () => { delete w.__lab; };
  }, [drawn, ready, go, update, onCritter]);

  // the card mounts only once the camera has SETTLED (no box change for 120ms),
  // then slides in; under still=1 it is there immediately
  const [landedFor, setLandedFor] = useState<string | null>(null);
  const bx = Math.round(cam.box.x), by = Math.round(cam.box.y), bw = Math.round(cam.box.w);
  useEffect(() => {
    if (!cardOpen || !focusNode) { setLandedFor(null); return; }
    if (!animate) { setLandedFor(focusNode.name); return; }
    // not there yet: hide a card for another model; keep this one's card once shown (drag-pan)
    if (!atTarget) { setLandedFor((prev) => (prev === focusNode.name ? prev : null)); return; }
    const id = setTimeout(() => setLandedFor(focusNode.name), 120);
    return () => clearTimeout(id);
  }, [cardOpen, focusNode, animate, bx, by, bw, atTarget]);
  const card = useMemo(() => {
    if (!cardOpen || !focusNode || !taxonomy) return null;
    return cardModel(focusNode.name, { taxonomy, evidence, runs, family: focusNode.family, depth: focusNode.depth });
  }, [cardOpen, focusNode, taxonomy, evidence, runs]);
  const lesson = useLesson(cardOpen && focusNode ? focusNode.name : null, { runs, evidence, still: view ? view.still : null });
  const atoms = useMemo(() => new Set((world?.nodes ?? []).filter((n) => n.atom).map((n) => n.name)), [world]);
  const stats = useMemo(() => {
    if (!world) return { desc: new Map<string, number>(), maxDesc: 1, maxRuns: 1 };
    const desc = new Map(world.nodes.map((n) => [n.name, lineage(world, n.name).descendants.length]));
    return { desc, maxDesc: Math.max(1, ...desc.values()), maxRuns: Math.max(1, ...evidence.map((e) => e.run_count)) };
  }, [world, evidence]);

  // ——— overlay geometry (screen space) ———
  const tile = xf.tile;
  const uiRects = useMemo<Rect[]>(() => {
    const r: Rect[] = mobile ? [{ x: 0, y: 0, w: vp.w, h: MOBILE_TOP }] : [{ x: 0, y: 0, w: 344, h: zoom === "overview" ? 200 : 196 }];
    if (mobile) r.push({ x: 0, y: vp.h - MOBILE_KEY, w: vp.w, h: MOBILE_KEY });
    else r.push({ x: vp.w - 130, y: vp.h - 56, w: 130, h: 56 }); // "Map key" button
    return r;
  }, [mobile, vp.w, vp.h, zoom]);
  const labelText = useMemo(() => new Map((world?.labels ?? []).map((l) => [l.text, l.node])), [world]);
  const plates = useMemo(() => {
    if (!world || vp.w === 0 || miniMode) return [];
    const camBox = { x: -xf.ox / xf.k, y: -xf.oy / xf.k, w: vp.w / xf.k, h: vp.h / xf.k };
    const measure = (t: string, f: number) => {
      const node = labelText.get(t);
      void node;
      return { w: Math.ceil(0.62 * f * displayName(t).length) + 14, h: f + 10 };
    };
    let out = placeScreenLabels(world, camBox, vp, { font: tile <= 4 ? { atom: 14, derived: 13 } : { atom: 16, derived: 14 }, focus: focusNode?.name ?? null, measure, edgeMargin: 24 });
    // node view: the focus plate sits centred under its plinth (never on the critter,
    // which parks beside the model); other plates yield to it and to the critter
    if (focusNode && zoom === "node" && tile >= 16 && world) {
      const fp = out.find((l) => l.node === focusNode.name);
      if (fp && focusSprite) {
        // 18px plate ABOVE the enlarged sprite + its brackets, off the lineage rail
        const c = toScreen(xf, { x: focusNode.center.x, y: (focusNode.foot.y + focusNode.foot.h) * TS });
        const u = Math.max(1, tile / 8), fs = u + 1, bs = Math.max(2, tile / 8);
        const top = c.y - focusSprite.ay * fs - 3 * bs;
        fp.font = 18; fp.h = 28; fp.w = Math.ceil(0.62 * 18 * displayName(focusNode.name).length) + 16;
        fp.x = Math.round(c.x - fp.w / 2); fp.y = Math.round(top - fp.h - 6);
      }
      const park = parkingSpot(world, focusNode.name);
      const ps = toScreen(xf, park);
      const cs = Math.max(1, tile / 8 - 1);
      const crit = { x: ps.x - 14 * cs, y: ps.y - 30 * cs, w: 28 * cs, h: 32 * cs };
      out = out.filter((l) => l.node === focusNode.name || (!hit(l, crit) && !(fp && hit(l, fp))));
    }
    return out
      // semantic zoom: at the overview only atoms (their cities) are named; derived names at region zoom
      .filter((l) => (zoom !== "overview" ? tile > 4 || nodeOf.get(l.node)?.atom : nodeOf.get(l.node)?.atom))
      .filter((l) => l.node === focusNode?.name || !uiRects.some((u) => hit(l, u)))
      .filter((l) => !cardOpen || (l.x + l.w <= stage.x + stage.w - 8 && l.y + l.h <= stage.y + stage.h - 8));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, xf.tile, xf.ox, xf.oy, vp.w, vp.h, focusNode, uiRects, cardOpen, stage, zoom, focusSprite, miniMode]);

  // far overview: land centroids (clamped to a tile of that land) for the 6 family signs
  const centroids = useMemo(() => {
    if (!world) return new Map<number, Pt>();
    const m = new Map<number, Pt>();
    for (const r of world.regions) {
      let sx = 0, sy = 0, n = 0;
      for (let i = 0; i < world.regionOf.length; i++) if (world.regionOf[i] === r.id) { sx += i % world.cols; sy += Math.floor(i / world.cols); n++; }
      if (!n) continue;
      let cx = sx / n, cy = sy / n;
      if (world.regionOf[Math.round(cy) * world.cols + Math.round(cx)] !== r.id) {
        let best = Infinity, bx = cx, by = cy;
        for (let i = 0; i < world.regionOf.length; i++) if (world.regionOf[i] === r.id) {
          const d = (i % world.cols - cx) ** 2 + (Math.floor(i / world.cols) - cy) ** 2;
          if (d < best) { best = d; bx = i % world.cols; by = Math.floor(i / world.cols); }
        }
        cx = bx; cy = by;
      }
      m.set(r.id, { x: (cx + 0.5) * TS, y: (cy + 0.5) * TS });
    }
    return m;
  }, [world]);

  const signs = useMemo(() => {
    if (!world) return [];
    if (miniMode) {
      return world.regions.filter((r) => centroids.has(r.id)).map((r) => {
        const c = toScreen(xf, centroids.get(r.id)!);
        const name = familyLabel(r.family), font = 14, w = Math.ceil(0.62 * font * name.length + 20), h = 24;
        return { id: r.id, name, font, count: null as number | null, anchor: { x: c.x, y: c.y, w: 0, h: 0 }, w, h,
          x: Math.round(Math.min(vp.w - w - 4, Math.max(4, c.x - w / 2))), y: Math.round(c.y - h / 2) };
      });
    }
    const twoLine = tile >= 16;
    const font = twoLine ? 16 : 14;
    const obstacles: Rect[] = [...uiRects];
    for (const r of world.regions) if (r.setPiece) {
      const sp = r.setPiece, g = 32 * xf.k;
      const c = toScreen(xf, { x: (sp.x + sp.w / 2) * TS, y: (sp.y + sp.h / 2) * TS });
      obstacles.push({ x: c.x - g / 2 - 2, y: c.y - g / 2 - 2, w: g + 4, h: g + 4, weight: 50 });
    }
    for (const l of plates) obstacles.push({ x: l.x - 8, y: l.y - 8, w: l.w + 16, h: l.h + 16, weight: 25 });
    for (const n of world.nodes) {
      const a = toScreen(xf, { x: n.foot.x * TS, y: n.foot.y * TS });
      const focus = n.name === focusNode?.name, pad = focus ? 56 : 4; // the focus sprite is drawn one scale step larger + brackets
      obstacles.push({ x: a.x - pad, y: a.y - pad, w: n.foot.w * TS * xf.k + 2 * pad, h: n.foot.h * TS * xf.k + 2 * pad, weight: focus ? 60 : twoLine ? 20 : 2 });
    }
    const items = world.regions.filter((r) => r.setPiece).map((r) => {
      const sp = r.setPiece!;
      const a = toScreen(xf, { x: sp.x * TS, y: sp.y * TS });
      const name = familyLabel(r.family);
      return {
        id: r.id, name, font,
        count: twoLine ? world.nodes.filter((n) => n.family === r.family).length : null,
        anchor: { x: a.x, y: a.y, w: sp.w * TS * xf.k, h: sp.h * TS * xf.k },
        w: Math.ceil(0.62 * font * name.length + 22), h: twoLine ? 44 : 24,
      };
    });
    const at = placeSigns(items, obstacles, { x: 4, y: 4, w: vp.w - 8, h: vp.h - 8 });
    return items.map((it) => ({ ...it, ...(at.get(it.id) ?? { x: it.anchor.x, y: it.anchor.y }) }))
      .filter((g) => !cardOpen || g.x + g.w <= stage.x + stage.w);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, plates, xf.tile, xf.ox, xf.oy, vp.w, vp.h, uiRects, focusNode, cardOpen, stage, miniMode, centroids]);

  // harbour tags: a small navy pier tag (boat icon ×N) attached to the pier, only
  // when zoomed in (hidden at overview), kept ≥16px from every sign and name
  const harbourSigns = useMemo(() => {
    if (!world || tile < 16) return [];
    const taken: Rect[] = [...uiRects, ...plates.map((l) => ({ x: l.x - 16, y: l.y - 16, w: l.w + 32, h: l.h + 32 })),
      ...signs.map((g) => ({ x: g.x - 16, y: g.y - 16, w: g.w + 32, h: g.h + 32 }))];
    const out: { key: number; x: number; y: number; w: number; boats: number }[] = [];
    for (const h of world.harbours) {
      const shown = Math.min(3, h.boats);
      if (h.boats <= shown) continue;
      const q = toScreen(xf, h.pt);
      const bs = Math.max(2, tile / 8), half = (shown * 20 * bs) / 2, w = 56, hh = 20;
      const cands = [
        { x: q.x - w / 2, y: q.y + 10 }, { x: q.x + half + 8, y: q.y - hh }, { x: q.x - half - 8 - w, y: q.y - hh },
      ];
      const pick = cands.find((c) => c.x > 4 && c.y > 4 && c.x + w < vp.w - 4 && c.y + hh < vp.h - 4
        && !taken.some((t) => hit({ ...c, w, h: hh }, t)));
      if (!pick) continue;
      taken.push({ ...pick, w, h: hh });
      out.push({ key: h.tile, x: pick.x, y: pick.y, w, boats: h.boats });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, xf.tile, xf.ox, xf.oy, plates, signs, uiRects, vp.w, vp.h]);

  useEffect(() => {
    if (!world) return;
    document.querySelectorAll<HTMLElement>("[data-sign-count]").forEach((el) => {
      const shown = Number(el.textContent?.match(/\d+/)?.[0]);
      if (shown !== Number(el.dataset.signCount)) console.error(`pixel: sign shows ${shown}, region has ${el.dataset.signCount}`);
    });
  }, [signs, world]);

  // map-sheet furniture placed in OPEN SEA on screen (sampled against world.terrain)
  // furniture sits on the SAME fixed grid as the map: art at ÷2..÷4, shown at Q
  const d2 = (im: ArtImage, f: number) => downsample(im, f, (v) => (v === 255 ? 0.7 : 1));
  const compassImg = useMemo(() => (typeof document === "undefined" ? null : inkArt(d2(compassArt(), 4))), [inkArt]);
  const furnitureArt = useMemo(() => (typeof document === "undefined" ? null : {
    ship: inkArt(props.boat().img), serpent: inkArt(d2(props.dragon().img, 2)), cloudA: cloudSprites(4)[0].img, cloudB: cloudSprites(4)[2].img,
    isle: palmIsle(), compass: inkArt(props.compass().img),
  }), [inkArt]);
  const furniture = useMemo(() => {
    // corners carry ink vignettes at the overview AND at region zoom (no dead sea quarters)
    if (!world || !(sheetMode || (zoom === "region" && !mobile && ink)) || !furnitureArt || !taxonomy) return [];
    const sea = (x: number, y: number, w: number, h: number) => {
      for (let sy = y; sy <= y + h; sy += 12) for (let sx = x; sx <= x + w; sx += 12) {
        const wx = (sx - xf.ox) / xf.k, wy = (sy - xf.oy) / xf.k;
        const tx = Math.floor(wx / TS), ty = Math.floor(wy / TS);
        if (tx >= 0 && ty >= 0 && tx < world.cols && ty < world.rows && world.terrain[ty * world.cols + tx] !== T.SEA) return false;
      }
      return true;
    };
    const taken: Rect[] = [...uiRects, ...plates, ...signs, { x: 0, y: vp.h - 110, w: 110, h: 110 }];
    const out: { key: string; x: number; y: number; img: ArtImage; scale: number; label?: string; caption?: string }[] = [];
    const place = (key: string, img: ArtImage, scale: number, cands: [number, number][], label?: string, caption?: string) => {
      const w = img.w * scale, h = img.h * scale + (caption ? 24 : 0);
      for (const [cx, cy] of cands) {
        const x = Math.round(cx - w / 2), y = Math.round(cy - h / 2);
        if (x < -w / 2 || y < -h / 2 || x > vp.w - w / 2 || y > vp.h - h / 2) continue;
        if (!sea(Math.max(0, x), Math.max(0, y), Math.min(w, vp.w - Math.max(0, x)), Math.min(h, vp.h - Math.max(0, y)))) continue;
        if (taken.some((t) => hit({ x, y, w, h }, t))) continue;
        taken.push({ x, y, w, h }); out.push({ key, x, y, img, scale, label, caption });
        return;
      }
    };
    const grid = (xs: number[], ys: number[]) => xs.flatMap((fx) => ys.map((fy) => [fx * vp.w, fy * vp.h] as [number, number]));
    // compass rose: a big ink vignette in the emptiest sea corner (same grid)
    place("compass", furnitureArt.compass, Q, [[0.07, 0.86], [0.08, 0.72], [0.93, 0.86], [0.92, 0.2], [0.35, 0.9], [0.62, 0.88]].map(([fx, fy]) => [fx * vp.w, fy * vp.h] as [number, number]), "Compass: north is up");
    place("serpent", furnitureArt.serpent, Q, grid([0.84, 0.9, 0.78, 0.72], [0.62, 0.55, 0.7, 0.45, 0.78]), "Sea serpent: here be dragons, toward the uncharted isle");
    place("ship", furnitureArt.ship, Q, grid([0.62, 0.55, 0.7, 0.48, 0.4, 0.3], [0.9, 0.86, 0.8, 0.94]),
      `Flagship: ${taxonomy.compositions.length} pipelines sail between the lands`, `${taxonomy.compositions.length} pipelines`);
    if (ink) {
      // ink palm-isle with its sun: points the way to the ruins isle of retired legacy models
      place("isle", furnitureArt.isle, Q, grid([0.9, 0.84, 0.1, 0.16, 0.78], [0.14, 0.22, 0.3, 0.08]),
        `Ruins isle: ${world.ruinsIsland.names.length} retired models lie beyond`, `${world.ruinsIsland.names.length} ruins`);
    } else {
      place("cloudA", furnitureArt.cloudA, 2, [[vp.w - 60, 40], [vp.w - 80, 90], [vp.w * 0.6, 20]]);
      place("cloudB", furnitureArt.cloudB, 2, [[40, vp.h * 0.55], [30, vp.h * 0.7], [vp.w * 0.3, vp.h - 20]]);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, ink, sheetMode, zoom, mobile, furnitureArt, taxonomy, xf.tile, xf.ox, xf.oy, vp.w, vp.h, plates, signs, uiRects]);

  const critterScreen = (() => {
    const w = walk.current;
    if (!w || tile < 16 || !critter) return null;
    const s = toScreen(xf, w.park);
    const cs = Math.max(1, tile / 8 - 1);
    return { x: s.x - critter.idle.ax * cs, y: s.y - critter.idle.ay * cs, w: critter.w * cs, h: critter.h * cs };
  })();
  const grokNode = world ? nodeOf.get(GROKKING_EGG.model) : undefined;

  return (
    <LabMotion still={still}>
      <div ref={rootRef} className={`${styles.root} ${ink ? styles.parchment : ""}`} data-lab-ready={drawn && ready && layers ? "1" : undefined}>
        <div
          className={styles.stage}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={onStageClick}
          onWheel={cam.handlers.onWheel}
        >
          <canvas ref={canvasRef} className={styles.canvas} role="img"
            aria-label="Tile map of the model zoo: six lands, one per model family; roads are lineage, cities are atoms, boats are pipelines" />
          <div ref={cam.ref} className="pointer-events-none absolute" style={{ left: stage.x, top: stage.y, width: Math.max(2, stage.w), height: Math.max(2, stage.h) }} />

          {signs.map((g) => (
            <div key={g.id} className={styles.sign} style={{ left: g.x, top: g.y, width: g.w, fontSize: g.font, ...(miniMode ? { pointerEvents: "auto", cursor: "pointer" } : {}) }}
              onClick={miniMode ? () => openLand(g.id) : undefined}>
              {g.name}
              {g.count != null && <span className="block text-[16px] font-normal" data-sign-count={g.count}><PixelNum value={g.count} /> models</span>}
            </div>
          ))}

          {plates.map((l) => {
            const node = nodeOf.get(l.node);
            const focus = focusNode?.name === l.node;
            const cls = focus ? styles.plateFocus : kin.has(l.node) ? `${styles.plateKin} ${node?.atom ? styles.plateAtom : ""}` : node?.atom ? styles.plateAtom : "";
            const dim = cardOpen && !focus && !kin.has(l.node);
            return (
              <div key={l.node} aria-hidden className={`${styles.plate} ${cls} ${dim ? styles.plateDim : ""}`}
                style={{ left: l.x, top: l.y, height: l.h, fontSize: l.font,
                  ...(kinTone.has(l.node) && !focus ? (ink
                    ? (zoom === "node" ? { boxShadow: "none", background: "transparent", textDecoration: "underline", textDecorationColor: "#5a1a14", textUnderlineOffset: 3 } : { boxShadow: "none", background: "transparent" })
                    : { boxShadow: `inset 0 0 0 2px ${kinTone.get(l.node)}, 0 2px 0 #1e1f4e` }) : {}) }}
                onClick={() => onNode(l.node)}>
                <span>{displayName(l.node)}</span>

              </div>
            );
          })}

          {world && !miniMode && world.nodes.map((n) => {
            const a = toScreen(xf, { x: n.foot.x * TS, y: n.foot.y * TS });
            const s = TS * xf.k;
            return (
              <button key={n.name} type="button" className={styles.hit}
                style={{ left: a.x, top: a.y, width: n.foot.w * s, height: n.foot.h * s }}
                aria-label={`${displayName(n.name)}, ${n.atom ? "atom" : "derived model"} in ${familyLabel(n.family)}`}
                onMouseEnter={() => setHovered(n.name)} onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(n.name)} onBlur={() => setHovered(null)}
                onClick={() => onNode(n.name)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); go(n.name); } }} />
            );
          })}

          {/* the secret islands: next-era silhouettes and the ruins of legacy/ */}
          {world && tile >= 16 && world.hiddenIsland.names.map((id, i) => {
            const s = toScreen(xf, islandSlots(world.hiddenIsland)[i]);
            const m = NEXT_ERA.find((x) => x.id === id);
            return (
              <button key={id} type="button" className={styles.plate} style={{ left: s.x - 12, top: s.y + 8, height: 22, fontSize: 14 }}
                onClick={() => setTeaser(teaser === id ? null : id)} aria-label={`uncharted: ${m?.name ?? id}`}>?</button>
            );
          })}
          {world && tile >= 16 && (() => {
            const s = toScreen(xf, world.hiddenIsland.dragons);
            return <div className={styles.dragons} style={{ left: s.x - 40, top: s.y + 24 }}>{NEXT_ERA_COPY.warning}</div>;
          })()}
          {world && tile >= 16 && world.ruinsIsland.names.map((id, i) => {
            const s = toScreen(xf, islandSlots(world.ruinsIsland)[i]);
            const r = RUINS.find((x) => x.id === id);
            return (
              <button key={id} type="button" className={styles.plate} style={{ left: s.x - 30, top: s.y + 10, height: 22, fontSize: 14 }}
                onClick={() => setEpitaph(epitaph === id ? null : id)}>{r?.name ?? id}</button>
            );
          })}

          {harbourSigns.map((h) => (
            <div key={h.key} className={styles.pierTag} title={`${h.boats} pipelines dock here`}
              style={{ left: h.x, top: h.y, width: h.w }}>
              <Sailboat size={13} strokeWidth={2.5} aria-hidden />×<PixelNum value={h.boats} scale={2} />
            </div>
          ))}

          {critterScreen && (
            <button type="button" aria-label="The critter (click it)" className={styles.hit}
              style={{ left: critterScreen.x, top: critterScreen.y, width: critterScreen.w, height: critterScreen.h }}
              onClick={(e) => { e.stopPropagation(); onCritter(); }} />
          )}
        </div>

        {/* egg bubbles */}
        {teaser && world && (() => {
          const m = NEXT_ERA.find((x) => x.id === teaser)!;
          const s = toScreen(xf, islandSlots(world.hiddenIsland)[world.hiddenIsland.names.indexOf(teaser)]);
          return (
            <PixelWindow className={styles.bubble} style={{ left: Math.min(vp.w - 320, s.x - 60), top: Math.max(8, s.y - 150) }}>
              <p className="text-[16px] font-bold text-[#f5c24a]">{m.name}</p>
              <p className="text-[16px] leading-snug">{m.teaser}</p>
              <p className="mt-1 text-[15px] text-[#bccbe8]">{NEXT_ERA_COPY.caption} It would grow from {displayName(m.buildsOn)}.</p>
            </PixelWindow>
          );
        })()}
        {epitaph && world && (() => {
          const r = RUINS.find((x) => x.id === epitaph)!;
          const s = toScreen(xf, islandSlots(world.ruinsIsland)[world.ruinsIsland.names.indexOf(epitaph)]);
          return (
            <PixelWindow className={styles.bubble} style={{ left: Math.max(8, s.x - 60), top: Math.max(8, s.y - 160) }}>
              <p className="text-[16px] font-bold text-[#f5c24a]">{r.name}</p>
              <p className="text-[16px] leading-snug">{r.epitaph}</p>
              {r.successor && <p className="mt-1 text-[15px] text-[#bccbe8]">Lives on as {displayName(r.successor)}.</p>}
            </PixelWindow>
          );
        })()}
        {grokNode && hovered === GROKKING_EGG.model && !still && (() => {
          const s = toScreen(xf, grokNode.center);
          return (
            <PixelWindow className={styles.bubble} style={{ left: Math.min(vp.w - 320, s.x + 24), top: Math.max(8, s.y - 120) }}>
              <p className="text-[16px] leading-snug">{grokked ? GROKKING_EGG.after : GROKKING_EGG.before}</p>
              {grokked && <p className="mt-1 text-[15px] leading-snug text-[#bccbe8]">{GROKKING_EGG.explain}</p>}
              {grokked && (
                <div className="mt-2">
                  <Sparkline points={GROKKING_EGG.sketch.val as unknown as [number, number][]} label="held-out accuracy" width={260} height={56} showValues={false}
                    palette={{ line: GOLD, axis: "#4a60b6", text: "#bccbe8" }} title={GROKKING_EGG.sketch.note} />
                  <p className="text-[14px] text-[#bccbe8]">Illustration of the paper&apos;s curve, not a zoo run.</p>
                </div>
              )}
            </PixelWindow>
          );
        })()}
        {critterUnlocked && critterScreen && (
          <PixelWindow className={styles.bubble} style={{ left: Math.min(vp.w - 320, critterScreen.x + critterScreen.w + 8), top: Math.max(8, critterScreen.y - 40) }}>
            <p className="text-[16px] font-bold text-[#f5c24a]">Training…</p>
            {realCurve.curve ? (
              <>
                <Sparkline points={realCurve.curve.points} progress={trainT} label={realCurve.curve.key.replace(/_/g, " ")} width={260} height={60}
                  palette={{ line: GOLD, axis: "#4a60b6", text: "#bccbe8", dot: "#fff6e0" }} title="a real loss curve from a logged run" />
                <p className="text-[14px] text-[#bccbe8]">A real run: {realCurve.curve.model}, {realCurve.curve.runId.slice(0, 24)}</p>
              </>
            ) : realCurve.loading ? (
              <p className="text-[15px] text-[#bccbe8]">Finding a real loss curve in the run log…</p>
            ) : (
              <p className="text-[15px] text-[#bccbe8]">No logged run has a clearly falling loss yet, so nothing to replay.</p>
            )}
          </PixelWindow>
        )}

        {/* map-sheet furniture: compass, flagship, sea serpent, clouds breaking the frame */}
        {furniture.map((f) => (
          <div key={f.key} className="pointer-events-none absolute" style={{ left: f.x, top: f.y }} aria-hidden={f.label ? undefined : true}>
            <ArtImg img={f.img} scale={f.scale} label={f.label} />
            {f.caption && <div className={styles.pierTag} style={{ position: "static", marginTop: 2, width: "auto", padding: "0 6px" }}>{f.caption}</div>}
          </div>
        ))}
        {/* compass rose: placed as map furniture (see furniture) */}

        <TitleWindow
          taxonomyNames={world?.nodes.map((n) => n.name) ?? []}
          zoom={zoom}
          focus={focusNode ?? null}
          regionCount={focusNode ? world?.nodes.filter((n) => n.family === focusNode.family).length ?? 0 : 0}
          mobile={mobile}
          onPick={go}
          onZoom={(z) => update({ zoom: z })}
          hidden={mobile && cardOpen}
        />
        {!mobile && <Legend mobile={false} defaultOpen={false} cartouche tint={ink ? tint : undefined} />}
        {miniMode && world && (
          <PixelWindow as="nav" aria-label="The six lands" className={`${styles.cartouche} absolute bottom-2 left-2 right-2`}>
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-[#f5c24a]">Six lands, <PixelNum value={world.nodes.length} /> models</h2>
              <Legend mobile defaultOpen={false} inline tint={ink ? tint : undefined} />
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-2">
              {world.regions.map((r) => {
                const hub = hubs.get(r.family);
                const count = world.nodes.filter((n) => n.family === r.family).length;
                return (
                  <li key={r.id}>
                    <button type="button" className={styles.landBtn} onClick={() => openLand(r.id)}>
                      <span className="block text-[15px] font-bold leading-tight">{familyLabel(r.family)}</span>
                      <span className="block text-[13px] leading-tight text-[#bccbe8]"><PixelNum value={count} /> models{hub ? `, from ${displayName(hub.name)}` : ""}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </PixelWindow>
        )}
        {card && emblems && landedFor === card.name && (
          <StatusCard tint={ink ? tint : undefined} slide={animate} card={card} looks={looks} atoms={atoms} emblems={emblems} lesson={lesson} evidence={evidence} still={still}
            descendants={stats.desc.get(card.name) ?? 0} maxDescendants={stats.maxDesc} maxRuns={stats.maxRuns}
            sailing={sailing} onSail={setSailing}
            onPick={go} onClose={() => update({ zoom: "region" })} />
        )}
      </div>
    </LabMotion>
  );
}
