"use client";

// Skin "painted": the owner's map with a live layer, one interface.
//
// Pixel map, render=true (default): the map is DATA — pixel-map.json (768×512,
// 128 colours; scripts/pixelmap_to_json.py) painted by us onto native-size
// canvases (true-map.tsx): markers, banners, ribbons, lit roads and the
// critter are pixel art on the same grid. The camera rests only at CRISP
// scales, k / devicePixelRatio art px per CSS px (every art pixel = exactly k
// device pixels), and pans snap to whole device pixels. Focusing a land
// crossfades in a dimmed copy of everything else, so that land glows.
// Other renders (clean / grid / baked, paper) draw the image with the SVG
// overlay (overlay.tsx) in 1536-px image coordinates.
//
// Layout, "four corners": the map owns every pixel of the viewport (the pixel
// map's parchment sea runs on to the edges, dressed with the map's own sea
// furniture — stage.tsx; the paper map is cover-cropped). Everything that is
// not the map is cartographic furniture in the corners (corners/): the title
// cartouche + search (top-left), the Pixel / Paper sheet tabs (top-right), the
// compass that navigates + the scale bar that measures the zoo (bottom-left)
// and a legend that turns into a minimap when zoomed (bottom-right). Selecting
// a model opens the drawer (drawer.tsx) on the right; the camera refits to the
// width that is left. One component tree, two materials (material.ts).
// Focus mode (`quiet`: a land or a model open, or zoomed in): the corners step
// back — the cartouche to one row, the scale bar to a slim strip, the minimap
// to a small inset, the compass and tabs smaller — so the map plate and the
// drawer are the two things to read; they re-stamp in place (two frames) as
// they change, and hold still under still=1 / reduced motion.
// /lab contract: URL view → useWorld → camera → paint → data-lab-ready → window.__lab.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useWorld } from "@/hooks/use-world";
import { useLabView, type LabView } from "@/components/lab/shared/url-state";
import { LabMotion } from "@/components/lab/shared/still";
import { useCamera, type CamBox } from "@/components/lab/shared/camera";
import { cardModel, displayName, evidenceState, type EvidenceState } from "@/components/lab/shared/card-model";
import { CRITTER } from "@/components/lab/shared/critter";
import { FAMILIES, landBox, resolveMap, type Box, type Family, type MapId, type Pt } from "./anchors";
import type { Traveller } from "./life";
import { EVIDENCE_ART } from "./pixel-art";
import { buildRoadGraph, chainRoute, lineageRoutes, pointAt, polylineLength, rootChain, route } from "./roads";
import { placeTags, textWidth, type PlacedTag, type TagSpec } from "./labels";
import { PaintedOverlay, type PaperSign } from "./overlay";
import { Drawer, drawerWidth, sheetHeight, type Sheet } from "./drawer";
import { Cartouche } from "./corners/cartouche";
import { SheetTabs, type Labels, type Render } from "./corners/sheet-tabs";
import { Compass } from "./corners/compass";
import { ScaleBar } from "./corners/scale-bar";
import { CornerPlate } from "./corners/corner-plate";
import { SeaCanvas, useSeaFurniture } from "./stage";
import { TrueMapLayers, spotClear, useTrueMap } from "./true-map";
import { PIXELMAP_CMD } from "./pixelmap";
import { layoutRibbons, spotBoxes, type PlacedRibbon, type RibbonItem } from "./ribbons";
import { ribbonSize } from "./pixel-art";
import { CORNER, FAMILY_TITLE, IMAGES, MATERIALS, MOTION, PAPER_TITLE, TYPE } from "./material";
import { Leader, MapPlate, plateEstimate } from "./map-plate";
import { retouch, type Pixels } from "./heal";
import { composePlate, plateRect, sample, type PBox, type PPt, type PlatePlan } from "./plate-place";

// render=grid: 3-px blocks (scripts/pixelate_map.py --cell 3), rests on thirds.
const GRID_CELL = 3;
const GRID_SCALES = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => n / GRID_CELL);
const IMG_MAX = 3;       // clean/grid/baked: × the 1536-px image
const PAPER_MAX = 2;
const TRUE_MAX = 6;      // × the 768-px true map (= 3× the 1536 renders)
const MOBILE_BP = 640;
// desktop: the diagram hangs on the map as a plate, so the drawer is text only
// (and narrow, drawer.tsx DRAWER_W_MAP); phones keep it in the sheet
const DIAGRAM_ON = "map" as const;

const KEYFRAMES = `
@keyframes painted-march { to { stroke-dashoffset: -32; } }
@keyframes painted-pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.22); opacity: .5; } }
@keyframes painted-stamp { from { opacity: 0; transform: translate(0, 3px); } to { opacity: 1; transform: none; } }
@keyframes painted-restamp-a { from { opacity: .35; transform: translate(0, 2px); } to { opacity: 1; transform: none; } }
@keyframes painted-restamp-b { from { opacity: .35; transform: translate(0, 2px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { [data-painted-root] [data-corner], [data-painted-root] [data-map-plate] { animation: none !important; } }
`;
// the load moment: the four corners stamp onto the sea, two frames each, in
// turn; afterwards (flips > 0) each change of focus mode re-stamps them in
// place, quicker and without leaving the sea bare (the two names alternate so
// the animation restarts without remounting the plates). Timings: MOTION.
const stamp = (i: number, still: boolean, flips = 0): CSSProperties => {
  const { stamp: a, restamp: b } = MOTION;
  return still ? {}
    : flips === 0 ? { animation: `painted-stamp ${a.ms}ms steps(${a.steps}, end) both`, animationDelay: `${a.delay + i * a.stagger}ms` }
    : { animation: `painted-restamp-${flips % 2 ? "a" : "b"} ${b.ms}ms steps(${b.steps}, end) both`, animationDelay: `${i * b.stagger}ms` };
};

interface Opts { map: MapId; render: Render; labels: Labels; dev: boolean; ui: boolean; plate: boolean }

function parseOpts(search: string): Opts {
  const p = new URLSearchParams(search);
  const map: MapId = p.get("map") === "paper" ? "paper" : "pixel";
  const r = p.get("render");
  const render: Render = r === "clean" || r === "grid" || r === "baked" ? r : "true";
  const l = p.get("labels");
  const labels: Labels = l === "ours" || l === "baked" ? l : map === "pixel" && render === "baked" ? "baked" : "ours";
  return { map, render, labels, dev: p.get("dev") === "1", ui: p.get("ui") !== "0", plate: p.get("plate") !== "0" };
}

function useOpts() {
  const [opts, setOpts] = useState<Opts | null>(null);
  useEffect(() => {
    const sync = () => setOpts(parseOpts(window.location.search));
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const set = useCallback((next: Partial<Opts>) => {
    const p = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, String(v));
    window.history.replaceState(null, "", `${window.location.pathname}?${p}`);
    setOpts(parseOpts(p.toString()));
  }, []);
  return { opts, set };
}

function useDpr() {
  const [dpr, setDpr] = useState(1);
  useEffect(() => {
    let mq: MediaQueryList | null = null;
    const on = () => {
      setDpr(window.devicePixelRatio || 1);
      mq?.removeEventListener("change", on);
      mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      mq.addEventListener("change", on);
    };
    on();
    return () => mq?.removeEventListener("change", on);
  }, []);
  return dpr;
}

function useWindowW() {
  const [w, setW] = useState(1440);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Canvas text measurement in the route's real fonts (SVG overlay tags). */
function useMeasure(fontsReady: boolean) {
  return useMemo(() => {
    if (!fontsReady || typeof document === "undefined") return null;
    const ctx = document.createElement("canvas").getContext("2d");
    const root = document.querySelector("[data-painted-root]") as HTMLElement | null;
    if (!ctx || !root) return null;
    const cs = getComputedStyle(root);
    const fam = { pixel: cs.getPropertyValue("--font-pixel").trim(), paper: cs.getPropertyValue("--font-alegreya").trim() };
    return (text: string, px: number, which: MapId) => {
      if (!fam[which]) return textWidth(text, px, which);
      ctx.font = `500 ${px}px ${fam[which]}`;
      return ctx.measureText(text).width;
    };
  }, [fontsReady]);
}

export function PaintedSkin() {
  const { view, update } = useLabView();
  const { opts, set } = useOpts();
  const still = view?.still ?? true;
  const { taxonomy, evidence, runs, family, ready } = useWorld(view ? view.still : null);

  const mapId: MapId = opts?.map ?? "pixel";
  const render: Render = opts?.render ?? "true";
  const labels: Labels = opts?.labels ?? "ours";
  const theme = MATERIALS[mapId];
  const isTrue = mapId === "pixel" && render === "true";
  const map = useMemo(() => resolveMap(mapId, render), [mapId, render]);
  const W = map.width, H = map.height;
  const imgSrc = mapId === "paper" ? IMAGES.paper : IMAGES[render];
  const snapGrid = mapId === "pixel" && render === "grid";
  const ours = labels === "ours";
  const heal = mapId === "paper" && ours;
  const trueState = useTrueMap(isTrue, map);
  const td = trueState.status === "ready" ? trueState.data : null;
  const dpr = useDpr();
  const winW = useWindowW();
  const mobile = winW < MOBILE_BP;
  const [sheet, setSheet] = useState<Sheet>("peek");
  const [devOpen, setDevOpen] = useState(false);
  // "map only": every plate and the drawer hide (key h, or ?ui=0) to look at the map alone
  const [uiHidden, setUiHidden] = useState(false);
  useEffect(() => { if (opts) setUiHidden(!opts.ui); }, [opts]);
  const [fullDiagram, setFullDiagram] = useState(false);
  // the "How it works" plate on the map (desktop): open on every new
  // selection; Close hides it and keeps the selection; ?plate=0 starts closed
  const [plateOpen, setPlateOpen] = useState(true);
  // ?plate= read once the URL is known (a render-time adjustment, not an effect)
  const optPlate = opts?.plate;
  const [plateFromUrl, setPlateFromUrl] = useState<boolean | undefined>(undefined);
  if (optPlate !== plateFromUrl) {
    setPlateFromUrl(optPlate);
    if (optPlate !== undefined) setPlateOpen(optPlate);
  }
  const furniture = useSeaFurniture(td?.pm ?? null, td?.sea ?? null, td?.lands ?? null);

  // ——— data
  const names = useMemo(() => taxonomy?.models.map((m) => m.name).filter((n) => map.anchors[n]) ?? [], [taxonomy, map]);
  const parentsOf = useCallback((n: string) => taxonomy?.models.find((m) => m.name === n)?.builds_on ?? [], [taxonomy]);
  const atoms = useMemo(() => new Set(names.filter((n) => parentsOf(n).length === 0)), [names, parentsOf]);
  const depthOf = useMemo(() => {
    const memo = new Map<string, number>();
    const f = (n: string, guard = 0): number => {
      if (memo.has(n)) return memo.get(n)!;
      const ps = parentsOf(n);
      const v = ps.length && guard < 12 ? 1 + Math.max(...ps.map((p) => f(p, guard + 1))) : 0;
      memo.set(n, v);
      return v;
    };
    return f;
  }, [parentsOf]);
  const states = useMemo(() => {
    const out: Record<string, EvidenceState> = {};
    for (const n of names) out[n] = evidenceState(evidence.find((e) => e.name === n));
    return out;
  }, [names, evidence]);
  const famCount = useMemo(() => {
    const c: Record<string, number> = {};
    for (const n of names) { const f = family?.[n]; if (f) c[f] = (c[f] ?? 0) + 1; }
    return c;
  }, [names, family]);
  const famProven = useMemo(() => {
    const c: Record<string, number> = {};
    for (const n of names) { const f = family?.[n]; if (f && states[n] === "champion") c[f] = (c[f] ?? 0) + 1; }
    return c;
  }, [names, family, states]);
  const familyOf = useCallback((n: string) => family?.[n], [family]);
  const pipelines = useMemo(() => taxonomy?.compositions.map((c) => c.name) ?? [], [taxonomy]);
  const counts = useMemo(() => ({
    models: names.length,
    pipelines: taxonomy?.compositions.length ?? 0,
    champions: Object.values(states).filter((s) => s === "champion").length,
    lands: Object.keys(famCount).length,
  }), [names, taxonomy, states, famCount]);

  const graph = useMemo(() => buildRoadGraph(map), [map]);
  const selected = view?.zoom === "node" && view.focus && map.anchors[view.focus] ? view.focus : null;
  // focus mode by the view (a land or a model open); zooming in by hand also
  // quiets the corners (quiet, below, once the camera is known)
  const quietView = (view?.zoom ?? "overview") !== "overview";
  // the compass stands this far above the scale bar (the bottom-left stack's gap)
  const BL_GAP = quietView ? CORNER.stackQuiet : CORNER.stack;
  const [hovered, setHovered] = useState<string | null>(null);
  const lineage = useMemo(() => (selected && taxonomy ? lineageRoutes(graph, selected, parentsOf) : []), [selected, graph, parentsOf, taxonomy]);
  // the carts: every builds_on edge travelled parent → child in the child's
  // evidence colour; the selected model's lineage runs lit and without gaps
  const travellers = useMemo<Traveller[]>(() => {
    if (!isTrue || !taxonomy) return [];
    const rgb = (hx: string) => [parseInt(hx.slice(1, 3), 16), parseInt(hx.slice(3, 5), 16), parseInt(hx.slice(5, 7), 16)] as const;
    const litKeys = new Set(lineage.map((l) => `${l.from}>${l.to}`));
    const out: Traveller[] = [];
    let i = 0;
    for (const n of names) for (const par of parentsOf(n)) {
      if (!map.anchors[par]) continue;
      const pts = route(graph, par, n);
      if (!pts) continue;
      const art = EVIDENCE_ART[states[n] ?? "untrained"];
      const lit = litKeys.has(`${par}>${n}`);
      out.push({ pts, len: polylineLength(pts), speed: lit ? 16 : 9 + (i % 3) * 1.5, phase: ((i * 0.618) % 1), body: rgb(art.ramp[1]), hi: rgb(art.ramp[0]), lit });
      i++;
    }
    return out;
  }, [isTrue, taxonomy, names, parentsOf, map, graph, states, lineage]);
  const lineageSet = useMemo(() => {
    const s = new Set<string>();
    if (!selected) return s;
    const walk = (n: string) => { if (s.has(n)) return; s.add(n); parentsOf(n).forEach(walk); };
    walk(selected);
    return s;
  }, [selected, parentsOf]);
  const viewFam = (view?.zoom === "region" || view?.zoom === "node") && view.focus && family?.[view.focus]
    ? (family[view.focus] as Family) : null;
  const focusFam: Family | null = viewFam;
  const focusStrength = 1;

  // where the focus reveal starts: the focused model
  const focusAtX = view?.focus && map.anchors[view.focus] ? [Math.floor(map.anchors[view.focus][0]), Math.floor(map.anchors[view.focus][1])] : null;
  const fax = focusAtX?.[0] ?? null, fay = focusAtX?.[1] ?? null;
  const focusAt = useMemo(() => (fax == null || fay == null ? null : { x: fax, y: fay }), [fax, fay]);

  // ——— camera
  const [vp, setVp] = useState({ w: 1, h: 1 });
  const [manual, setManual] = useState<CamBox | null>(null);
  // phones: the sheet covers the bottom of the map; desktop: the drawer covers
  // the right — frame into the part that stays visible
  const sheetPx = mobile && selected ? sheetHeight(sheet === "peek" ? "half" : sheet, vp.h) : 0;
  const visH = Math.max(120, vp.h - sheetPx);
  // paper: when no framing on the painting holds castle + plate (plan below is
  // null), the diagram falls back into the drawer, which then takes its full width
  const [cardFallback, setCardFallback] = useState<string | null>(null);
  const diagramOn = selected && cardFallback === selected ? "drawer" : DIAGRAM_ON;
  const drawerPx = !mobile && selected && !fullDiagram && !uiHidden ? drawerWidth(diagramOn) : 0;
  const visW = Math.max(160, vp.w - drawerPx);
  // the continent (union of the land boxes) is what the whole-map view frames;
  // the image's own sea margins may fall off — the sea continues anyway
  const continent: Box = useMemo(() => {
    if (!td) return { x: 0, y: 0, w: W, h: H };
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (const f of FAMILIES) { const b = td.landBox[f]; if (!b || !b.w) continue; x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
    const m = 14;
    return x1 > x0 ? { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m } : { x: 0, y: 0, w: W, h: H };
  }, [td, W, H]);
  const fit = isTrue ? Math.min(visW / continent.w, visH / continent.h)
    : mapId === "paper" ? Math.max(visW / W, visH / H)      // cover: the painting fills the screen
    : Math.min(visW / W, visH / H);
  const crisp = useMemo(() => Array.from({ length: TRUE_MAX * dpr }, (_, i) => (i + 1) / dpr), [dpr]);
  const down = useCallback((k: number) => [...crisp].reverse().find((s) => s <= k + 1e-3) ?? crisp[0], [crisp]);
  const upTo = useCallback((k: number) => crisp.find((s) => s >= k - 1e-3) ?? crisp[crisp.length - 1], [crisp]);

  const levels = useMemo(() => {
    if (isTrue) {
      // whole map at the largest crisp scale that fits (the parchment sea
      // runs on past the map's edge, so the margin reads as more sea). On a
      // phone, if that throws away more than a quarter of the width, take
      // the next crisp scale up instead (the map then pans)
      let base = down(fit);
      if (mobile && base < fit * 0.75) base = upTo(fit);
      return { overview: base, region: upTo(base * 1.8), node: upTo(Math.max(2, base * 2)), min: base, max: TRUE_MAX };
    }
    if (snapGrid) {
      const snap = (k: number) => [...GRID_SCALES].reverse().find((s) => s <= k + 1e-3) ?? GRID_SCALES[0];
      const up = (k: number) => GRID_SCALES.find((s) => s >= k - 1e-3) ?? IMG_MAX;
      const base = snap(fit);
      return { overview: base, region: up(base * 1.8), node: up(Math.max(base * 2.2, 1)), min: GRID_SCALES[0], max: IMG_MAX };
    }
    const max = mapId === "paper" ? PAPER_MAX : IMG_MAX;
    return { overview: fit, region: Math.min(max, fit * 1.8), node: Math.min(max, Math.max(fit * 2.2, 1.2)), min: mapId === "paper" ? fit : fit * 0.8, max };
  }, [isTrue, snapGrid, mapId, fit, down, upTo, mobile]);

  const boxAt = useCallback((cx: number, cy: number, k: number, free = false): CamBox => {
    // centre (cx, cy) in the VISIBLE part of the view (left of the drawer,
    // above the sheet); the covered part shows more map or more sea.
    // free: centre exactly, even if that shows sea past the map's edge (a
    // land on the coast is still framed in the middle — the sea goes on)
    const w = vp.w / k, h = vp.h / k, wv = visW / k, hv = visH / k;
    const x = free ? cx - wv / 2 : wv >= W ? (W - wv) / 2 : clamp(cx - wv / 2, 0, W - wv);
    const y = free ? cy - hv / 2 : hv >= H ? (H - hv) / 2 : clamp(cy - hv / 2, 0, H - hv);
    return { x, y, w, h };
  }, [vp, visW, visH, W, H]);

  const landFrame = useCallback((f: Family): Box => {
    if (td) return td.landBox[f];
    return landBox(map.lands[f]);
  }, [td, map]);

  // a land's framing scale: the whole land in the visible map, kept clear of
  // the corner plates (cartouche, scale bar, legend sit in the corners) by a
  // screen-px safe inset on desktop
  const landFitK = useCallback((lb: Box) => {
    const m = isTrue ? 10 : 60;
    const safe = !mobile && !uiHidden ? 72 : 0;
    return Math.min((visW - safe * 2) / (lb.w + m * 2), (visH - safe * 2) / (lb.h + m * 2));
  }, [isTrue, mobile, uiHidden, visW, visH]);
  const crispK = useCallback((k: number) => (isTrue ? clamp(down(k), levels.overview, TRUE_MAX) : clamp(k, levels.min, levels.max)), [isTrue, down, levels]);

  // ——— the "How it works" plate on the map (desktop, a model selected): it
  // hangs beside the castle on a leader line; the camera frames the castle
  // and the plate as a pair (plate-place.ts). Corner plates are measured so
  // the plate never lands on one.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [corners, setCorners] = useState<PBox[]>([]);
  // the top corners and the legend / minimap as measured, and the compass and
  // scale bar measured apart (sticky: the scale bar's last size is kept while
  // it is folded away), so the plate can be planned with or without it
  const [cornerAt, setCornerAt] = useState<{ tl?: PBox; tr?: PBox; br?: PBox; compass?: { w: number; h: number }; scale?: { w: number; h: number } }>({});
  const plateEl = useRef<HTMLElement | null>(null);
  const [plateMeasured, setPlateMeasured] = useState<{ name: string; zoom: number; w: number; h: number } | null>(null);
  const plateWanted = !mobile && !!selected && plateOpen && !uiHidden && view?.zoom === "node";
  // the largest crisp zoom (a whole number of device px per art px) at which
  // the plate keeps to half the visible width and 60 % of its height — the
  // castle and its land are the subject; ×1 whatever the screen otherwise
  const plateZoom = [2, 1.5].find((z) => Number.isInteger(z * dpr) && plateEstimate(selected ?? "", z, 2).w <= visW * 0.5
    && plateEstimate(selected ?? "", z, 2).h <= visH * 0.6) ?? 1;
  const plateSize = selected && plateMeasured?.name === selected && plateMeasured.zoom === plateZoom
    ? plateMeasured : plateEstimate(selected ?? "", plateZoom, 2);
  const anchorPt = useCallback((n: string): PPt => {
    const a = map.anchors[n];
    return isTrue ? { x: Math.floor(a[0]) + 0.5, y: Math.floor(a[1]) + 0.5 } : { x: a[0], y: a[1] };
  }, [map, isTrue]);
  // the selected castle's clearance (map units, around its anchor) — the plate
  // keeps out of it. True map: an atom stands on a painted castle / town that
  // runs ~35 art px either side of its flag and further down than up (the
  // flag flies from the keep), so the box is the landmark, not just the
  // ribbon keep-out; a derived model is a road stone. Image renders: the marker.
  // `spot` is the half-size of the marker itself: the leader's dot sits there.
  const castleBox: PBox = useMemo(() => {
    if (!selected) return { x: 0, y: 0, w: 0, h: 0 };
    // image renders: the marker, and room below it for the name tag
    if (!isTrue || !td) return { x: -14, y: -14, w: 28, h: 46 };
    if (atoms.has(selected)) return { x: -36, y: -40, w: 72, h: 92 };
    const c = spotClear(selected, atoms, td.markers);
    return { x: -c - 2, y: -c - 2, w: 2 * c + 5, h: 2 * c + 5 };
  }, [selected, isTrue, td, atoms]);
  const castleSpot = selected && isTrue && td ? spotClear(selected, atoms, td.markers) : 0;
  const PLATE_GAP = 40;
  // fold: 0 = every corner plate stays; 1 = the scale bar folds; 2 = the minimap too
  const planned: { plan: PlatePlan | null; fold: 0 | 1 | 2 } | null = useMemo(() => {
    if (!plateWanted || !selected || !family?.[selected] || vp.w <= 1) return null;
    const fam = family[selected] as Family;
    const lb = landFrame(fam);
    const kLand = crispK(landFitK(lb));
    const scales = isTrue
      ? crisp.filter((s) => s <= kLand + 1e-3 && s >= levels.overview - 1e-3).reverse().slice(0, 3)
      // paper: out to the cover fit, then IN — a model on the painting's edge
      // (vae, gan on the SE coast) moves off the edge, and off the corner
      // plates, only as the camera goes closer (the painting may not slide)
      : [kLand, kLand / 1.2, kLand / 1.4, kLand / 1.7, levels.min, kLand * 1.2, kLand * 1.45]
        .filter((s, i, all) => s >= levels.min - 1e-3 && s <= levels.max + 1e-3 && all.findIndex((t) => Math.abs(t - s) < 1e-3) === i);
    const a = anchorPt(selected);
    const others = names.filter((n) => n !== selected);
    const keep = [
      { pts: lineage.flatMap((l) => sample(l.pts, isTrue ? 4 : 8)), weight: 12 },
      { pts: others.filter((n) => lineageSet.has(n)).map(anchorPt), weight: 120 },
      { pts: others.filter((n) => family?.[n] === fam && !lineageSet.has(n)).map(anchorPt), weight: 20 },
      { pts: map.signs[fam] ? [{ x: map.signs[fam][0], y: map.signs[fam][1] }] : [], weight: 30 },
    ];
    // paper: the painter's plates do not move. Those of the selected model and
    // its lineage carry names that must stay whole (padded: our plate grows
    // round a long name), so the plate never touches them; the land titles are
    // part of the painting, so it keeps off them too while any framing allows
    const named = heal ? map.baked.filter((b) => b.name && lineageSet.has(b.name)).map((b) => ({ x: b.box.x - 20, y: b.box.y - 10, w: b.box.w + 40, h: b.box.h + 20 })) : [];
    const titles = heal ? map.baked.filter((b) => b.kind === "family").map((b) => b.box) : [];
    const view = { x: 0, y: 0, w: visW, h: visH };
    const bounded = mapId === "paper" ? { w: W, h: H } : undefined;
    // the corner plates the plate keeps off: all four; or, when the pair fits
    // nowhere between them (1280×800: the cartouche, scale bar and minimap
    // leave no 596×406 hole), the scale bar folds away and the compass drops
    // to the bottom margin — the chrome yields rather than the plate clipping
    const { tl, tr, br, compass: cp, scale: sc } = cornerAt;
    const M = CORNER.margin;
    const top = [tl, tr].filter((c): c is PBox => Boolean(c));
    const right = br ? [br] : [];
    const avoidFull = cp && sc ? [...top, ...right, { x: M, y: vp.h - M - sc.h, w: sc.w, h: sc.h }, { x: M, y: vp.h - M - sc.h - BL_GAP - cp.h, w: cp.w, h: cp.h }] : corners;
    const compassDown = cp ? [{ x: M, y: vp.h - M - cp.h, w: cp.w, h: cp.h }] : [];
    const avoidYield = cp ? [...top, ...right, ...compassDown] : corners;
    // and if even that leaves no hole, the minimap folds too (the plate is the focus)
    const avoidBare = cp ? [...top, ...compassDown] : corners;
    const base0 = { anchor: a, castle: castleBox, plate: plateSize, land: lb, view, keep, gap: PLATE_GAP, bounded };
    // the land-centred framing (paper: kept on the painting), for the last resort
    const wv = visW / kLand, hv = visH / kLand;
    const camX = bounded ? clamp(lb.x + lb.w / 2 - wv / 2, 0, Math.max(0, W - wv)) : lb.x + lb.w / 2 - wv / 2;
    const camY = bounded ? clamp(lb.y + lb.h / 2 - hv / 2, 0, Math.max(0, H - hv)) : lb.y + lb.h / 2 - hv / 2;
    // paper never shows past the painting's edge (it is cover-cropped): a model
    // on the coast takes the side that keeps the camera on the painting, even
    // if the plate then covers more of its land. If no framing on the painting
    // fits the pair with the lineage's names whole, there is no plate: the
    // diagram goes back into the (wide) drawer — the card fallback
    const attempt = (avoid: PBox[]) => {
      const base = { ...base0, avoid };
      // a model wedged between titles (transformer under "Sequence & State")
      // has no framing clear of them all: then the plate covers as little of
      // any title as it can, rather than wherever the land-centred framing put it
      if (heal) {
        return composePlate({ ...base, block: [...named, ...titles], castlePad: 14, scales, inset: 16 })
          ?? composePlate({ ...base, block: [...named, ...titles], castlePad: 0, scales, inset: 4 })
          ?? composePlate({ ...base, block: named, soft: titles, castlePad: 14, scales, inset: 16 })
          ?? composePlate({ ...base, block: named, soft: titles, castlePad: 0, scales, inset: 4 });
      }
      return composePlate({ ...base, castlePad: 14, scales, inset: 16 })
        ?? composePlate({ ...base, castlePad: 0, scales, inset: 4 });
    };
    const full = attempt(avoidFull);
    if (full) return { plan: full, fold: 0 };
    const folded = attempt(avoidYield);
    if (folded) return { plan: folded, fold: 1 };
    const bare = attempt(avoidBare);
    if (bare || heal) return { plan: bare, fold: bare ? 2 : 0 };
    // last resort: the land-centred framing, the plate on its least-bad side
    return { plan: composePlate({ ...base0, avoid: avoidBare, castlePad: 0, scales: [kLand], inset: 4, fixed: { x: (a.x - camX) * kLand, y: (a.y - camY) * kLand } }), fold: 2 };
  }, [plateWanted, selected, family, vp.w, vp.h, landFrame, crispK, landFitK, isTrue, crisp, levels, anchorPt, names, lineage, lineageSet, map, visW, visH, mapId, W, H, castleBox, plateSize, corners, cornerAt, heal, BL_GAP]);
  const plan: PlatePlan | null = planned?.plan ?? null;
  // the scale bar (and, at need, the minimap) fold away while the plate needs their corner
  const fold = planned?.fold ?? 0;
  const foldScale = fold >= 1;

  const target: CamBox = useMemo(() => {
    const zoom = view?.zoom ?? "overview";
    const focus = view?.focus ?? null;
    const a = focus ? map.anchors[focus] : undefined;
    if (zoom === "node" && plan && focus) {
      // the castle + plate pair, composed: the castle rests at plan.at
      const p = anchorPt(focus);
      return { x: p.x - plan.at.x / plan.k, y: p.y - plan.at.y / plan.k, w: vp.w / plan.k, h: vp.h / plan.k };
    }
    if ((zoom === "node" || zoom === "region") && a && family?.[focus!]) {
      const lb = landFrame(family[focus!] as Family);
      const m = isTrue ? 10 : 60;
      let k = landFitK(lb);
      // phones: a whole land at 390 px wide packs its names on top of each
      // other — go in half as close again (bounded by the height) and centre
      // on the focused model, kept inside its land; the rest of the land pans
      if (isTrue && mobile) k = Math.min(k * 1.5, visH / (lb.h + m * 2));
      k = isTrue ? clamp(down(k), levels.overview, TRUE_MAX) : clamp(k, levels.min, levels.max);
      if (isTrue && mobile) {
        const wv = visW / k, hv = visH / k;
        const cx = wv >= lb.w ? lb.x + lb.w / 2 : clamp(a[0], lb.x + wv / 2, lb.x + lb.w - wv / 2);
        const cy = hv >= lb.h ? lb.y + lb.h / 2 : clamp(a[1], lb.y + hv / 2, lb.y + lb.h - hv / 2);
        return boxAt(cx, cy, k, true);
      }
      // paper on a phone, a model: the half-sheet leaves a short strip of map,
      // and a coastal model clamped to the painting's edge lands under the
      // compass — go in to node scale and centre on the model itself
      if (mapId === "paper" && mobile && zoom === "node") return boxAt(a[0], a[1], levels.node);
      // paper has no sea past its edge (it is cover-cropped): keep the painting
      // filling the visible view and let the land sit off-centre instead
      return boxAt(lb.x + lb.w / 2, lb.y + lb.h / 2, k, mapId !== "paper");
    }
    if (isTrue) return boxAt(continent.x + continent.w / 2, continent.y + continent.h / 2, levels.overview);
    // paper: the cover crop takes its loss from the bottom (sea, ships and the
    // painter's painted-out scale bar), never from the land titles along the top
    if (mapId === "paper") return boxAt(W / 2, 0, levels.overview);
    return boxAt(W / 2, H / 2, levels.overview);
  }, [view, map, levels, family, landFrame, boxAt, visW, visH, isTrue, down, W, H, continent, mobile, mapId, plan, anchorPt, vp.w, vp.h, landFitK]);

  useEffect(() => { setManual(null); }, [view?.zoom, view?.focus, mapId, render, vp.w, vp.h, drawerPx]);

  const camClamp = useMemo(() => ({ right: drawerPx, bottom: sheetPx }), [drawerPx, sheetPx]);
  const framed = (view?.zoom ?? "overview") !== "overview";
  const camWorld = useMemo(() => (framed && mapId !== "paper" ? { x: -W * 0.25, y: -H * 0.25, w: W * 1.5, h: H * 1.5 } : { x: 0, y: 0, w: W, h: H }), [framed, W, H, mapId]);
  const cam = useCamera({ world: camWorld, target: manual ?? target, still, targetViewport: vp, minWidth: 40, clamp: camClamp });
  useEffect(() => {
    if (cam.size.w !== vp.w || cam.size.h !== vp.h) setVp({ w: cam.size.w, h: cam.size.h });
  }, [cam.size.w, cam.size.h, vp.w, vp.h]);

  const curScale = () => vp.w / cam.box.w;
  const zoomTo = (k: number, fx = 0.5, fy = 0.5) => {
    const b = cam.box;
    if (Math.abs(k - vp.w / b.w) < 1e-3) return;
    const px = b.x + fx * b.w, py = b.y + fy * b.h;
    const w = vp.w / k, h = vp.h / k;
    setManual({
      x: w >= W ? (W - w) / 2 : clamp(px - fx * w, 0, W - w),
      y: h >= H ? (H - h) / 2 : clamp(py - fy * h, 0, H - h), w, h,
    });
  };
  const stepList = isTrue ? crisp.filter((s) => s >= levels.min - 1e-3 && s <= levels.max + 1e-3) : snapGrid ? GRID_SCALES : null;
  const stepZoom = (dir: 1 | -1, fx = 0.5, fy = 0.5) => {
    const cur = curScale();
    if (stepList) {
      const next = dir > 0 ? stepList.find((s) => s > cur + 1e-3) : [...stepList].reverse().find((s) => s < cur - 1e-3);
      if (next !== undefined) zoomTo(next, fx, fy);
    } else zoomTo(clamp(cur * (dir > 0 ? 1.4 : 1 / 1.4), levels.min, levels.max), fx, fy);
  };
  const wheelAcc = useRef(0);
  const onWheel = (e: React.WheelEvent) => {
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width, fy = (e.clientY - rect.top) / rect.height;
    if (stepList) {
      wheelAcc.current += e.deltaY;
      if (Math.abs(wheelAcc.current) < 40) return;
      const dir = wheelAcc.current < 0 ? 1 : -1;
      wheelAcc.current = 0;
      stepZoom(dir, fx, fy);
    } else zoomTo(clamp(curScale() * Math.exp(-e.deltaY * 0.0015), levels.min, levels.max), fx, fy);
  };
  const panBy = (dx: number, dy: number) => {
    const b = cam.box;
    const wv = (visW / vp.w) * b.w, hv = (visH / vp.h) * b.h;
    setManual({ ...b, x: wv >= W ? b.x : clamp(b.x + dx * b.w, 0, W - wv), y: hv >= H ? b.y : clamp(b.y + dy * b.h, 0, H - hv) });
  };
  const centerAt = (x: number, y: number) => {
    const b = cam.box;
    setManual({ ...b, x: b.w >= W ? b.x : clamp(x - b.w / 2, 0, W - b.w), y: b.h >= H ? b.y : clamp(y - b.h / 2, 0, H - b.h) });
  };
  const fitWhole = () => { setManual(null); update({ zoom: "overview", focus: null }); };
  const jumpLand = (f: Family) => {
    const first = names.filter((n) => family?.[n] === f).sort((a, b) => Number(atoms.has(b)) - Number(atoms.has(a)))[0];
    if (first) update({ zoom: "region", focus: first });
  };

  // live scale: crisp maps snap to their level once the flight lands, and
  // offsets snap to whole DEVICE pixels so art pixels never straddle two
  let S = cam.scale > 0 && Number.isFinite(cam.scale) ? cam.scale : 1;
  if (isTrue) { const q = Math.round(S * dpr) / dpr; if (Math.abs(S - q) < 0.01) S = q; }
  if (snapGrid) { const q = Math.round(S * GRID_CELL) / GRID_CELL; if (Math.abs(S - q) < 0.01) S = q; }
  const ox = Math.round(-cam.box.x * S * dpr) / dpr, oy = Math.round(-cam.box.y * S * dpr) / dpr;
  // layout scale: the resting scale of the current target (labels re-layout per level, not per frame)
  const Sl = manual ? vp.w / manual.w : vp.w / target.w;
  const layoutS = Number.isFinite(Sl) && Sl > 0 ? Sl : 1;
  // one art pixel in CSS px (plate borders): the true map's current scale
  const ap = isTrue ? clamp(Math.round(layoutS * dpr) / dpr, 1, 3) : 2;
  const theme_ = theme;
  const zoomedIn_ = curScale() > levels.overview + 1e-3;
  const quiet = quietView || zoomedIn_;
  // each change of focus mode re-stamps the corners (stamp(), a render-time adjustment)
  const [quietSeen, setQuietSeen] = useState<{ q: boolean; flips: number } | null>(null);
  if (opts && (quietSeen === null || quietSeen.q !== quiet)) setQuietSeen({ q: quiet, flips: quietSeen === null ? 0 : quietSeen.flips + 1 });
  const flips = quietSeen?.flips ?? 0;

  // the plate and its leader at rest, in map units, with a little air (the
  // plate's hard shadow, the leader's halo + notch): drawn OVER the map, so
  // the labels lay out around them and never sit half under them (labels.ts,
  // ribbons.ts `hard`); a label that cannot clear them is left out
  const plateRest: Box[] = useMemo(() => {
    if (!plan || !selected) return [];
    const a = anchorPt(selected);
    const r = plateRect(plan.side, plan.slide, castleBox, layoutS, plateSize, plan.gap);
    const air = 6 / layoutS;
    const box = { x: a.x + r.x / layoutS - air, y: a.y + r.y / layoutS - air, w: r.w / layoutS + 2 * air, h: r.h / layoutS + 2 * air };
    // the leader's half-width: 2 art px of ink + 1 of halo either side, + air
    const t = (2 * ap + 3) / layoutS;
    const leader = plan.side === "right" ? { x: a.x, y: a.y - t, w: box.x - a.x, h: 2 * t }
      : plan.side === "left" ? { x: box.x + box.w, y: a.y - t, w: a.x - box.x - box.w, h: 2 * t }
      : plan.side === "below" ? { x: a.x - t, y: a.y, w: 2 * t, h: box.y - a.y }
      : { x: a.x - t, y: box.y + box.h, w: 2 * t, h: a.y - box.y - box.h };
    return [box, leader];
  }, [plan, selected, anchorPt, castleBox, layoutS, plateSize, ap]);
  // with the plate up, the corner plates are hard for labels too (map units at
  // rest): a sign or a name half under the cartouche or the minimap reads as
  // cut just the same
  const restBox0 = manual ?? target;
  const cornersAtRest: Box[] = useMemo(() => {
    const air = 4;
    return corners.map((c) => ({
      x: restBox0.x + (c.x - air) / layoutS, y: restBox0.y + (c.y - air) / layoutS, w: (c.w + 2 * air) / layoutS, h: (c.h + 2 * air) / layoutS,
    }));
  }, [corners, restBox0.x, restBox0.y, layoutS]);
  const labelHard: Box[] = useMemo(() => (plateRest.length ? [...plateRest, ...cornersAtRest] : []), [plateRest, cornersAtRest]);
  // paper: a painter's plate (or a land's seal) half under any corner plate
  // reads as cut ("pixe…" under the legend) — it is painted out instead, with
  // or without the map plate up
  const paperHard: Box[] = useMemo(() => (heal ? [...plateRest, ...cornersAtRest] : labelHard), [heal, plateRest, cornersAtRest, labelHard]);
  // … and so does one the screen's edge cuts ("vision emb…" on a phone): the
  // strips just past the visible view are hard too
  const edgeHard: Box[] = useMemo(() => {
    if (!heal) return [];
    const b = manual ?? target, x1 = b.x + (visW / vp.w) * b.w, y1 = b.y + (visH / vp.h) * b.h, far = 4000;
    return [{ x: b.x - far, y: -far, w: far, h: 3 * far }, { x: x1, y: -far, w: far, h: 3 * far }, { x: -far, y: b.y - far, w: 3 * far, h: far }, { x: -far, y: y1, w: 3 * far, h: far }];
  }, [heal, manual, target, visW, visH, vp.w, vp.h]);


  // ——— fonts
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const done = () => { if (alive) setFontsReady(true); };
    const fallback = setTimeout(done, 1500);
    document.fonts?.ready.then(done).catch(done);
    return () => { alive = false; clearTimeout(fallback); };
  }, []);
  const measure = useMeasure(fontsReady);

  // measure the corner plates (the plate keeps off them) and the plate itself
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const o = root.getBoundingClientRect();
    const next = [...root.querySelectorAll<HTMLElement>("[data-corner]")].map((el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left - o.left), y: Math.round(r.top - o.top), w: Math.round(r.width), h: Math.round(r.height) };
    }).filter((r) => r.w > 0 && r.h > 0);
    setCorners((cur) => (cur.length === next.length && cur.every((c, i) => Math.abs(c.x - next[i].x) + Math.abs(c.y - next[i].y) + Math.abs(c.w - next[i].w) + Math.abs(c.h - next[i].h) < 4) ? cur : next));
    const rect = (sel: string) => {
      const el = root.querySelector<HTMLElement>(sel);
      if (!el) return undefined;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left - o.left), y: Math.round(r.top - o.top), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const tl = rect('[data-corner="tl"]'), tr = rect('[data-corner="tr"]'), br = rect('[data-corner="br"]');
    const cpr = rect("[data-compass]"), scr = rect("[data-scale]");
    setCornerAt((cur) => {
      // sticky: a folded plate keeps its last measured place (else folding it
      // would make room, unfold it, and loop)
      const nx = { tl, tr, br: br ?? cur.br, compass: cpr ? { w: cpr.w, h: cpr.h } : cur.compass, scale: scr ? { w: scr.w, h: scr.h } : cur.scale };
      const same = (p?: { w: number; h: number; x?: number; y?: number }, q?: { w: number; h: number; x?: number; y?: number }) =>
        (!p && !q) || (!!p && !!q && Math.abs(p.w - q.w) + Math.abs(p.h - q.h) + Math.abs((p.x ?? 0) - (q.x ?? 0)) + Math.abs((p.y ?? 0) - (q.y ?? 0)) < 4);
      return same(cur.tl, nx.tl) && same(cur.tr, nx.tr) && same(cur.br, nx.br) && same(cur.compass, nx.compass) && same(cur.scale, nx.scale) ? cur : nx;
    });
  }, [vp.w, vp.h, mobile, uiHidden, selected, focusFam, fontsReady, zoomedIn_, drawerPx, sheetPx, opts, foldScale, ap, cornerAt.scale?.w, quiet]);
  const plateShown = Boolean(plan && plateWanted && !fullDiagram && selected);
  // the card fallback, decided at the narrow drawer: a wider drawer only leaves
  // less room, so once set it holds until the selection changes
  const noRoom = plateWanted && heal && vp.w > 1 && !plan && !!family?.[selected ?? ""] ? selected : null;
  // (a render-time adjustment, not an effect)
  if (noRoom && cardFallback !== noRoom) setCardFallback(noRoom);
  else if (!noRoom && cardFallback && cardFallback !== selected) setCardFallback(null);
  useLayoutEffect(() => {
    const el = plateEl.current;
    if (!plateShown || !el || !selected) return;
    const on = () => {
      const w = el.offsetWidth, h = el.offsetHeight;
      setPlateMeasured((cur) => (cur && cur.name === selected && cur.zoom === plateZoom && cur.w === w && cur.h === h ? cur : { name: selected, zoom: plateZoom, w, h }));
    };
    on();
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, [plateShown, selected, plateZoom]);

  // ——— which names show: three levels of openness.
  //   whole map   only the land signs — the painting is the thing; a hovered
  //               model shows its name
  //   in a land   (zoomed in, or a land in focus) that land's names open
  //   a model     its card opens (the drawer) and its lineage is named
  const zoomedIn = isTrue ? layoutS >= 2 - 1e-3 : layoutS >= levels.overview * 1.8;
  // paper: past ×1.4 of the whole sheet the painter's plates (painted-scale)
  // would outgrow the live tags (screen-steady): every name goes screen-steady
  const steadyNames = !isTrue && layoutS >= levels.overview * 1.4;
  const showName = useCallback((n: string) =>
    n === selected || n === hovered || lineageSet.has(n)
      || (focusFam !== null ? family?.[n] === focusFam : zoomedIn),
  [selected, hovered, lineageSet, focusFam, family, zoomedIn]);

  // ——— true map: ribbons + signs (art px)
  // glyph size: the 5-px caps land at ~10 screen px (ribbons) and ~14 (signs)
  const g = Math.max(1, Math.round(10 / (5 * layoutS)));
  const gSign = Math.max(1, Math.round(14 / (5 * layoutS)));
  // the visible part of the map at rest (above the sheet on phones): labels
  // are laid out inside it so the view edge never clips a sign or a ribbon
  const restBox = manual ?? target;
  const visible: Box = useMemo(() => {
    const x0 = Math.max(0, restBox.x), y0 = Math.max(0, restBox.y);
    const x1 = Math.min(W, restBox.x + (visW / vp.w) * restBox.w), y1 = Math.min(H, restBox.y + (visH / vp.h) * restBox.h);
    return { x: x0 + 2, y: y0 + 2, w: Math.max(40, x1 - x0 - 4), h: Math.max(40, y1 - y0 - 4) };
  }, [restBox.x, restBox.y, restBox.w, restBox.h, W, H, visW, visH, vp.w, vp.h]);
  // the corner furniture at rest, in map units (+ a little air): a land sign
  // never sits under the compass, the cartouche or the tabs
  const chrome: Box[] = useMemo(() => corners.map((c) => ({
    x: restBox.x + (c.x - 6) / layoutS, y: restBox.y + (c.y - 6) / layoutS, w: (c.w + 12) / layoutS, h: (c.h + 12) / layoutS,
  })), [corners, restBox.x, restBox.y, layoutS]);
  const signs: PlacedRibbon[] = useMemo(() => {
    if (!isTrue || !ours) return [];
    const V = visible;
    const placed: Box[] = [];
    const out: PlacedRibbon[] = [];
    const blockers = [...chrome, ...labelHard];
    // top to bottom, so a sign pushed off its spot moves away from the ones above it
    const order = [...FAMILIES].sort((a, b) => map.signs[a][1] - map.signs[b][1]);
    // every sign's painted spot, so a sign that steps aside never lands on one
    const home = (f: Family) => {
      const { w, h } = ribbonSize(FAMILY_TITLE[f].toUpperCase(), gSign, false, true);
      const x = clamp(Math.round(map.signs[f][0] - w / 2), V.x + 4, V.x + V.w - w - 5), y = clamp(Math.round(map.signs[f][1] - h / 2), V.y + 2, V.y + V.h - h - 3);
      return { x: x - 4, y: y - 1, w: w + 8, h: h + 3 };
    };
    for (const f of order) {
      const text = FAMILY_TITLE[f].toUpperCase();
      const { w, h } = ribbonSize(text, gSign, false, true);
      const [sx, sy] = map.signs[f];
      const fitX = (x: number) => clamp(Math.round(x), V.x + 4, V.x + V.w - w - 5);
      const fitY = (y: number) => clamp(Math.round(y), V.y + 2, V.y + V.h - h - 3);
      const boxOf = (x: number, y: number) => ({ x: x - 4, y: y - 1, w: w + 8, h: h + 3 });
      const x0 = fitX(sx - w / 2), y0 = fitY(sy - h / 2);
      // its painted spot, as always; a sign the plate or its leader would cut
      // is left out (signs do not move under the plate). A sign that sits
      // under the corner furniture alone (the compass + zoom rail on a phone,
      // the cartouche) steps to the nearest spot — one sign height up/down or
      // a third of its width sideways — that clears the furniture and the
      // signs already placed, still inside the view
      const b0 = boxOf(x0, y0);
      if (labelHard.some((o) => overlaps(b0, o))) continue;
      let at: [number, number] = [x0, y0];
      if (chrome.some((o) => overlaps(b0, o))) {
        const cands: [number, number][] = [];
        for (let i = 1; i <= 6; i++) for (const [dx, dy] of [[0, -i], [0, i], [i, 0], [-i, 0], [i, -i], [-i, -i], [i, i], [-i, i]]) {
          cands.push([fitX(x0 + (dx * w) / 3), fitY(y0 + dy * (h + 4))]);
        }
        const hit = cands.find(([x, y]) => { const b = boxOf(x, y); return !placed.some((o) => overlaps(b, o)) && !blockers.some((o) => overlaps(b, o))
          && !order.some((g) => g !== f && overlaps(b, home(g))); });
        if (!hit) continue;
        at = hit;
      }
      const [x, y] = at;
      const box = boxOf(x, y);
      placed.push(box);
      out.push({ name: `sign-${f}`, text, x, y, g: gSign, tail: null, tailAt: 0, sign: { count: famCount[f] ?? 0 }, dim: focusFam !== null && f !== focusFam, box });
    }
    return out;
  }, [isTrue, ours, gSign, map, famCount, focusFam, visible, labelHard, chrome]);

  // paper: the painter's land titles, redrawn on our stock (the painting
  // under them is retouched), so a title can do what a painted one cannot:
  // it stays whole, and it keeps its whole-sheet screen size when the camera
  // goes in (a sign, not scenery). At its painted spot; if the screen edge or
  // a corner plate would cut it, it steps to the nearest spot in view (a
  // title height up or down, a third of its width sideways) that clears the
  // corners and the titles already placed. With a land in focus only that
  // land's title may step; the others show only where they were painted, and
  // one the map plate would cut is left off
  const paperSigns: PaperSign[] = useMemo(() => {
    if (!heal) return [];
    const V = visible, out: PaperSign[] = [], placed: Box[] = [];
    const fams = Object.keys(PAPER_TITLE) as Family[];
    // (never below ×0.6 of the painted size: a phone at node zoom keeps a readable title)
    const k = clamp(levels.overview / layoutS, 0.6, 1);
    // a title that steps aside never lands on a model's plate
    const plates = map.baked.filter((b) => b.kind === "model" || b.kind === "invented").map((b) => b.box);
    const titles = map.baked.filter((b) => b.kind === "family").sort((a, b) => a.box.y - b.box.y);
    for (const b of titles) {
      const f = fams.find((q) => PAPER_TITLE[q] === b.text);
      if (!f) continue;
      const w = b.box.w * k, h = b.box.h * k;
      const x0 = b.box.x + (b.box.w - w) / 2, y0 = b.box.y + (b.box.h - h) / 2;
      const seal = 15 * k;   // the seal rides the top-right corner: keep it in view too
      const fitX = (x: number) => clamp(x, V.x + 2, V.x + V.w - w - seal - 2);
      const fitY = (y: number) => clamp(y, V.y + seal + 2, V.y + V.h - h - 2);
      // a title may step into view only if at least half of it was there
      // already (a land off the screen's edge is not pulled onto the phone)
      const ix = Math.max(0, Math.min(x0 + w, V.x + V.w) - Math.max(x0, V.x)), iy = Math.max(0, Math.min(y0 + h, V.y + V.h) - Math.max(y0, V.y));
      const mayStep = (focusFam === null || focusFam === f) && ix * iy >= (w * h) / 2;
      const cands: [number, number][] = mayStep ? [[fitX(x0), fitY(y0)]] : [[x0, y0]];
      if (!mayStep && (x0 < V.x || y0 - seal < V.y || x0 + w + seal > V.x + V.w || y0 + h > V.y + V.h)) continue;
      if (mayStep) for (let i = 1; i <= 4; i++) for (const [dx, dy] of [[0, i], [0, -i], [i, 0], [-i, 0], [i, i], [-i, i]]) {
        cands.push([fitX(x0 + (dx * w) / 3), fitY(y0 + dy * (h + 8 * k))]);
      }
      const at = cands.find(([x, y], i) => {
        const box = { x, y: y - seal, w: w + seal, h: h + seal };
        const moved = i > 0 || Math.abs(x - x0) + Math.abs(y - y0) > 1;
        return !chrome.some((o) => overlaps(box, o)) && !labelHard.some((o) => overlaps(box, o)) && !placed.some((o) => overlaps(box, o))
          && !(moved && plates.some((o) => overlaps(box, o)));
      });
      if (!at) continue;
      const box = { x: at[0], y: at[1], w, h };
      placed.push({ x: box.x - 6, y: box.y - seal - 4, w: w + seal + 12, h: h + seal + 10 });
      out.push({ fam: f, box, count: famCount[f] ?? 0, k });
    }
    return out;
  }, [heal, visible, map, chrome, labelHard, famCount, focusFam, levels.overview, layoutS]);

  // phones have no map plate, so labelHard is empty there; the corner
  // furniture (the condensed cartouche, the tabs, the compass rail) is hard
  // for the model names instead, as the corner plates are on desktop: a name
  // half under the cartouche ("…CNN" peeking out) reads as cut. The land
  // signs join them: pushed off the cartouche, a name must not land on a sign
  const ribbonHard: Box[] = useMemo(() => (mobile ? [...labelHard, ...chrome, ...signs.map((s) => s.box)] : labelHard), [mobile, labelHard, chrome, signs]);
  const ribbons: PlacedRibbon[] = useMemo(() => {
    if (!isTrue || !td || !taxonomy) return [];
    const inView = (n: string) => {
      const a = map.anchors[n];
      return a[0] >= visible.x && a[0] <= visible.x + visible.w && a[1] >= visible.y && a[1] <= visible.y + visible.h;
    };
    const shown = names.filter((n) => inView(n) && (ours ? showName(n) : n === selected || n === hovered));
    const items: RibbonItem[] = shown.map((n) => {
      const a = map.anchors[n];
      return {
        name: n, text: displayName(n), ax: Math.floor(a[0]), ay: Math.floor(a[1]),
        clear: spotClear(n, atoms, td.markers), banner: atoms.has(n),
        priority: (n === selected ? 1000 : 0) + (n === hovered ? 400 : 0) + (lineageSet.has(n) ? 300 : 0) + (atoms.has(n) ? 100 : 50 - depthOf(n)),
        loud: n === selected, hover: n === hovered && n !== selected,
        must: n === selected || lineageSet.has(n),
      };
    });
    const spots = names.flatMap((n) => {
      const a = map.anchors[n];
      return spotBoxes({ ax: Math.floor(a[0]), ay: Math.floor(a[1]), clear: spotClear(n, atoms, td.markers), banner: atoms.has(n) });
    });
    const obstacles = signs.map((s) => s.box);
    return layoutRibbons(items, { g, spots, obstacles, bounds: visible, clutter: td.clutter, hard: ribbonHard })
      .map((rb) => ({ ...rb, dim: focusFam !== null && family?.[rb.name] !== focusFam && !lineageSet.has(rb.name) && rb.name !== hovered }));
  }, [isTrue, td, taxonomy, names, ours, showName, selected, hovered, map, atoms, lineageSet, depthOf, g, signs, visible, focusFam, family, ribbonHard]);

  // ——— image renders: SVG overlay tags
  const screenFont = layoutS < 1.5 ? 11 : layoutS < 2.5 ? 13 : 14;
  const tagFont = screenFont / layoutS;
  const markerR = (layoutS < 1.5 ? 5.5 : layoutS < 2.5 ? 7 : 8) / layoutS;
  const plated = useMemo(() => new Set(heal ? map.baked.map((b) => b.name).filter(Boolean) as string[] : []), [heal, map]);
  const obstacles = useMemo(() => {
    const o: Box[] = [];
    if (!ours || isTrue) return o;
    if (mapId === "pixel") {
      for (const [f, at] of Object.entries(map.signs)) {
        const w = FAMILY_TITLE[f].length * 15 * 0.62 + 64;
        o.push({ x: at[0] - w / 2, y: at[1] - 13, w, h: 26 });
      }
    } else {
      for (const b of map.baked) o.push({ x: b.box.x - 5, y: b.box.y - 5, w: b.box.w + 10, h: b.box.h + 10 });
    }
    return o;
  }, [ours, isTrue, mapId, map]);
  const tags: PlacedTag[] = useMemo(() => {
    if (!taxonomy || isTrue) return [];
    const tagNames = ours ? names.filter((n) => !plated.has(n) && showName(n)) : [selected, hovered].filter((n): n is string => Boolean(n && map.anchors[n]));
    const pad = (screenFont * 0.45) / layoutS;
    const specs: TagSpec[] = tagNames.map((n) => {
      const text = displayName(n);
      const wScreen = measure ? measure(text, screenFont, mapId) : textWidth(text, screenFont, mapId);
      return {
        name: n, text, at: { x: map.anchors[n][0], y: map.anchors[n][1] },
        w: wScreen / layoutS + pad * 2, h: (screenFont * 1.55) / layoutS,
        priority: (n === selected ? 1000 : 0) + (lineageSet.has(n) ? 300 : 0) + (atoms.has(n) ? 100 : 50 - depthOf(n)),
        must: n === selected || lineageSet.has(n),
      };
    });
    // the selected tag draws 1.25× about its centre: keep its growth off the plate too
    const grow = (screenFont * 0.5) / layoutS;
    const hard = labelHard.map((b) => ({ x: b.x - grow, y: b.y - grow, w: b.w + 2 * grow, h: b.h + 2 * grow }));
    return placeTags(specs, { markerR, obstacles, bounds: { x: 2, y: 2, w: W - 4, h: H - 4 }, hard });
  }, [taxonomy, isTrue, ours, names, plated, showName, selected, hovered, map, screenFont, layoutS, measure, mapId, lineageSet, atoms, depthOf, markerR, obstacles, W, H, labelHard]);

  // ——— critter: walks from the selected model's root atom along the painted roads
  const [critter, setCritter] = useState<(Pt & { dir: number; walking: boolean; hop: number }) | null>(null);
  const focusName = view?.focus ?? null;
  const home = useMemo(() => (focusName && map.anchors[focusName]) || map.anchors.classifier || Object.values(map.anchors)[0], [map, focusName]);
  useEffect(() => {
    if (!taxonomy) return;
    // stand beside the spot, clear of its marker / brackets
    const side = (n: string | null) => isTrue ? -((n && atoms.has(n) ? 12 : 8)) : -(markerR * 3.4);
    const foot = isTrue ? 3 : 0;
    if (!selected) { setCritter({ x: home[0] + side(focusName), y: home[1] + foot, dir: 1, walking: false, hop: 0 }); return; }
    const a = map.anchors[selected];
    const pts = chainRoute(graph, rootChain(selected, parentsOf));
    const end = { x: a[0] + side(selected), y: a[1] + foot, dir: 1, walking: false, hop: 0 };
    if (still || pts.length < 2) { setCritter(end); return; }
    const len = polylineLength(pts);
    const speed = Math.max((CRITTER.walkSpeed * W) / 1536, len / 3.2);
    let raf = 0, t0 = 0;
    const step = (now: number) => {
      if (!t0) t0 = now;
      const dist = ((now - t0) / 1000) * speed;
      if (dist >= len) { setCritter(end); return; }
      const p = pointAt(pts, dist);
      setCritter({ x: p.x, y: p.y + foot, dir: p.dir, walking: true, hop: 0 });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // markerR is layout-scale dependent; re-run only on selection/map changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, graph, still, taxonomy, home, isTrue]);

  const hopRaf = useRef(0);
  const onCritter = useCallback(() => {
    if (still) return;
    cancelAnimationFrame(hopRaf.current);
    let t0 = 0;
    const step = (now: number) => {
      if (!t0) t0 = now;
      const k = Math.min(1, (now - t0) / MOTION.hopMs);
      setCritter((c) => (c ? { ...c, hop: k < 1 ? k : 0 } : c));
      if (k < 1) hopRaf.current = requestAnimationFrame(step);
    };
    hopRaf.current = requestAnimationFrame(step);
  }, [still]);

  // ——— interaction
  const onSelect = useCallback((n: string) => {
    if (n === selected) { setManual(null); update({ zoom: "overview", focus: null }); return; }
    update({ zoom: "node", focus: n });
    setSheet((s) => (s === "peek" ? "half" : s));
    setFullDiagram(false);
    setPlateOpen(true);
  }, [update, selected]);
  useEffect(() => { if (!selected) setFullDiagram(false); }, [selected]);
  const setView = useCallback((v: Partial<Omit<LabView, "still">>) => update(v), [update]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Escape peels one layer at a time: the enlarged diagram, the plate, the selection
      if (e.key === "Escape") {
        if (fullDiagram) setFullDiagram(false);
        else if (plateShown) setPlateOpen(false);
        else if ((view?.zoom ?? "overview") !== "overview") fitWhole();
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      // keys the plate's diagram uses (its scrubber / picks) never pan the map
      if (e.defaultPrevented || (e.target as HTMLElement | null)?.closest?.("[data-map-plate]")) return;
      if (e.key === "h" || e.key === "H") setUiHidden((v) => !v);
      else if (e.key === "+" || e.key === "=") stepZoom(1);
      else if (e.key === "-" || e.key === "_") stepZoom(-1);
      else if (e.key === "0") fitWhole();
      else if (e.key === "ArrowLeft") panBy(-0.2, 0);
      else if (e.key === "ArrowRight") panBy(0.2, 0);
      else if (e.key === "ArrowUp") panBy(0, -0.2);
      else if (e.key === "ArrowDown") panBy(0, 0.2);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const card = useMemo(() => {
    if (!selected || !taxonomy || !family) return null;
    return cardModel(selected, { taxonomy, evidence, runs, family: family[selected] ?? "", depth: depthOf(selected) });
  }, [selected, taxonomy, evidence, runs, family, depthOf]);

  // ——— paper: the painting retouched once (heal.ts): the painter's own
  // chrome and his model plates painted out, a few ms at a time so the page
  // stays live; the stage then shows the clean painting under our plates
  const [clean, setClean] = useState<{ src: string; url: string } | null>(null);
  useEffect(() => {
    if (!heal) return;
    let alive = true, timer = 0, url = "";
    const img = new Image();
    img.src = imgSrc;
    img.decode().then(() => {
      const cv = document.createElement("canvas");
      cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      const ctx = cv.getContext("2d", { willReadFrequently: true });
      if (!ctx || !alive) return;
      ctx.drawImage(img, 0, 0);
      const px: Pixels = ctx.getImageData(0, 0, cv.width, cv.height);
      // the chrome first (the largest holes), then the titles and the plates: all redrawn by us
      const holes = [...map.baked.filter((b) => b.kind === "chrome"), ...map.baked.filter((b) => b.kind !== "chrome")].map((b) => b.box);
      const it = retouch(px, holes);
      const slice = () => {
        const t0 = performance.now();
        while (performance.now() - t0 < 12) if (it.next().done) {
          ctx.putImageData(px as ImageData, 0, 0);
          cv.toBlob((blob) => { if (alive && blob) { url = URL.createObjectURL(blob); setClean({ src: imgSrc, url }); } });
          return;
        }
        timer = window.setTimeout(slice, 0);
      };
      slice();
    }).catch(() => { if (alive) setClean({ src: imgSrc, url: imgSrc }); });
    return () => { alive = false; clearTimeout(timer); if (url) URL.revokeObjectURL(url); };
  }, [heal, imgSrc, map]);
  const shownSrc = heal ? (clean?.src === imgSrc ? clean.url : null) : imgSrc;
  // until the retouch is done the original shows (our plates cover its lettering)
  const stageSrc = shownSrc ?? imgSrc;

  // ——— ready: data + picture + fonts + first painted frame
  const [imgLoaded, setImgLoaded] = useState<string | null>(null);
  const [trueVersion, setTrueVersion] = useState(0);
  const baseCanvas = useRef<HTMLCanvasElement | null>(null);
  const onPainted = useCallback(() => {
    baseCanvas.current = document.querySelector<HTMLCanvasElement>("[data-painted-map] canvas");
    setTrueVersion((v) => v + 1);
  }, []);
  const pictureReady = isTrue ? (trueState.status === "ready" ? trueVersion > 0 : trueState.status === "missing" || trueState.status === "error")
    : imgLoaded !== null && imgLoaded === shownSrc;
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    setDrawn(false);
    if (!ready || !pictureReady || !fontsReady || vp.w <= 1) return;
    const id = requestAnimationFrame(() => setDrawn(true));
    const t = setTimeout(() => setDrawn(true), 250);
    return () => { cancelAnimationFrame(id); clearTimeout(t); };
  }, [ready, pictureReady, fontsReady, vp.w]);

  useEffect(() => {
    if (!drawn) return;
    const w = window as unknown as { __lab?: unknown };
    w.__lab = {
      select: (name: string) => onSelect(name),
      view: (v: { zoom: LabView["zoom"]; focus?: string }) => setView({ zoom: v.zoom, focus: v.focus ?? null }),
      critterClick: (n: number) => { for (let i = 0; i < n; i++) setTimeout(onCritter, i * 420); },
    };
    return () => { delete w.__lab; };
  }, [drawn, onSelect, setView, onCritter]);

  const m = theme_;
  const whole = !manual && (view?.zoom ?? "overview") === "overview";
  const compassUnit = m.crisp ? clamp(Math.round(ap * 3), 4, 6) : 5;
  // focus mode: 2 art px a grid unit (≈ two thirds of the size)
  const compassUnitQ = m.crisp ? clamp(Math.round(ap * 2), 3, 4) : 3.5;
  const minimap = isTrue ? { canvas: baseCanvas.current, version: trueVersion } : { img: stageSrc, pixelated: mapId === "pixel" };
  const corner = "pointer-events-auto absolute z-20";
  // paper on a phone in focus mode: the one-row cartouche and the tabs would
  // meet across 390 px (Fell runs wider than Pixelify), so "Whole map" is left
  // to the compass hub and "map only" to the h key, as with a model open
  const phoneTight = mapId === "paper" && quiet;

  return (
    <LabMotion still={still}>
      <style>{KEYFRAMES}</style>
      <div ref={rootRef} data-painted-root data-lab-ready={drawn ? "1" : undefined}
        className="relative h-full w-full select-none overflow-hidden"
        style={{ background: m.sea, fontVariantNumeric: m.numeric, ["--ap" as string]: `${ap}px` } as CSSProperties}>
        {/* ——— the stage: sea to every edge, the map on it */}
        <div ref={cam.ref} {...cam.handlers} onWheel={onWheel}
          onClick={() => { if (!cam.dragged.current && (view?.zoom ?? "overview") !== "overview") fitWhole(); }}
          className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing">
          {isTrue && td && furniture && (
            <SeaCanvas pm={td.pm} furniture={furniture} scale={S} ox={ox} oy={oy} vw={vp.w} vh={vp.h} dpr={dpr} mapW={W} mapH={H} ghost={focusFam !== null} />
          )}
          <div data-painted-map className="absolute left-0 top-0" style={{ width: W * S, height: H * S, transform: `translate(${ox}px, ${oy}px)` }}>
            {isTrue ? (
              td && taxonomy ? (
                <TrueMapLayers data={td} map={map} states={states} atoms={atoms} focusFam={focusFam}
                  focusStrength={focusStrength} focusAt={focusAt}
                  ribbons={ribbons} signs={signs} lineage={lineage.map((l) => l.pts)} travellers={travellers}
                  selected={selected} hovered={hovered} critter={critter} scale={S} still={still}
                  onSelect={onSelect} onHover={setHovered} onCritter={onCritter} onPainted={onPainted} />
              ) : null
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- a local, owner-supplied painting */}
                <img key={imgSrc} src={stageSrc} alt={mapId === "pixel" ? "A pixel-art map of six lands" : "A painted storybook map of six lands"}
                  width={W} height={H} draggable={false} onLoad={() => setImgLoaded(stageSrc)}
                  ref={(el) => { if (el?.complete && el.naturalWidth && imgLoaded !== stageSrc) setImgLoaded(stageSrc); }}
                  className="absolute inset-0 block h-full w-full max-w-none"
                  style={{ imageRendering: mapId === "pixel" ? "pixelated" : "auto" }} />
                {taxonomy && (
                  <PaintedOverlay map={map} theme={m} scale={S} heal={heal} ours={ours} hard={[...paperHard, ...edgeHard]} steady={steadyNames} paperSigns={paperSigns} focusFam={focusFam} familyOf={familyOf}
                    tags={tags} tagFont={tagFont} markerR={markerR} states={states} famCount={famCount}
                    selected={selected} hovered={hovered} lineage={lineage} lineageSet={lineageSet}
                    critter={critter} still={still} onSelect={onSelect} onHover={setHovered} onCritter={onCritter} />
                )}
              </>
            )}
          </div>
        </div>

        {/* ——— the "How it works" plate, hung on the map beside the castle (map
            space: it follows the castle; screen size: its pixels stay crisp).
            A sibling of the stage, so a tap on it is never a tap on the sea */}
        {plateShown && plan && selected && (() => {
          const snap = (v: number) => Math.round(v * dpr) / dpr;
          const a = anchorPt(selected);
          const cx = a.x * S + ox, cy = a.y * S + oy;
          const r = plateRect(plan.side, plan.slide, castleBox, S, plateSize, plan.gap);
          const px = snap(cx + r.x), py = snap(cy + r.y);
          // the dot: at the edge of the model's own spot (its flag / stone),
          // on the plate's side; the line crosses the landmark to the plate
          const d = isTrue ? Math.min(castleSpot, 8) * S : markerR * S + 3;
          const at = plan.side === "right" ? { x: snap(cx + d), y: snap(cy) } : plan.side === "left" ? { x: snap(cx - d), y: snap(cy) }
            : plan.side === "below" ? { x: snap(cx), y: snap(cy + d) } : { x: snap(cx), y: snap(cy - d) };
          const edge = plan.side === "right" ? px : plan.side === "left" ? px + plateSize.w : plan.side === "below" ? py : py + plateSize.h;
          // while the camera is still flying in, the plate waits (a full-size
          // plate over a far-out map reads as a modal); it fades in on landing
          const landed = manual !== null || Math.abs(S / plan.k - 1) < 0.08;
          return (
            <div className="pointer-events-none absolute inset-0 z-[15]"
              style={{ right: drawerPx, opacity: landed ? 1 : 0, visibility: landed ? "visible" : "hidden", transition: still ? undefined : `opacity ${MOTION.plateFade.ms}ms steps(${MOTION.plateFade.steps}, end)` }}>
              <MapPlate ref={plateEl} m={m} name={selected} still={still} zoom={plateZoom}
                data={{ "data-plate-side": plan.side, "data-plate-k": String(plan.k), "data-plate-cost": String(Math.round(plan.cost)) }}
                style={{ left: px, top: py, ...stamp(4, still) }}
                onEnlarge={() => setFullDiagram(true)} onClose={() => setPlateOpen(false)} />
              {/* after the plate: the notch docks over the plate's hard shadow */}
              <Leader m={m} side={plan.side} castle={at} edge={edge} t={ap} />
            </div>
          );
        })()}

        {/* ——— the four corners (the map stays draggable between them) */}
        {opts && uiHidden && (
          <button type="button" onClick={() => setUiHidden(false)} aria-label="Show the UI (h)" title="Show the UI (h)"
            className="absolute right-3 top-3 z-20 px-2.5 py-1 leading-none opacity-50 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 sm:right-5 sm:top-5"
            style={{ background: m.plateHi, color: m.ink, border: `var(--ap) solid ${m.border}`, fontFamily: m.bodyFont, fontSize: TYPE.link }}>
            UI
          </button>
        )}
        {opts && !uiHidden && (
          <div className="pointer-events-none absolute inset-0 z-20" style={{ right: drawerPx, bottom: sheetPx }}>
            {/* paper: flush to the top so it covers the painter's own cartouche at the whole-map view */}
            <div data-corner="tl" className={`${corner} left-3 sm:left-5 ${m.crisp || quiet ? "top-3 sm:top-5" : "top-0"}`} style={stamp(0, still, flips)}>
              {/* a phone with a model open leaves "Whole map" to the sheet's own button */}
              <Cartouche m={m} counts={counts} names={names} focusFam={focusFam} famCount={famCount} famProven={famProven}
                onPick={onSelect} onWhole={fitWhole} compact={mobile} quiet={quiet} wholeLink={!(mobile && (selected || phoneTight))} />
            </div>
            <div data-corner="tr" className={`${corner} right-3 top-0 sm:right-5`} style={stamp(1, still, flips)}>
              <SheetTabs m={m} mapId={mapId} dev={opts.dev} render={render} labels={labels} setOpts={set} devOpen={devOpen} setDevOpen={setDevOpen} compact={mobile || quiet}
                mapOnly={!(mobile && (selected || phoneTight))} onHideUi={() => setUiHidden(true)} />
            </div>
            {/* the compass stands on the scale bar, as on a printed map: the
                scale bar and the legend share the bottom margin */}
            <div data-corner="bl" className={`${corner} bottom-3 left-3 flex flex-col items-start sm:bottom-5 sm:left-5`} style={{ gap: BL_GAP, ...stamp(2, still, flips) }}>
              <div data-compass>
                <Compass m={m} unit={mobile ? (selected ? 3 : 3.5) : quiet ? compassUnitQ : compassUnit} onPan={panBy} onWhole={fitWhole} onZoom={(d) => stepZoom(d)}
                  canIn={curScale() < levels.max - 1e-3} canOut={curScale() > levels.min + 1e-3} whole={whole}
                  rail={mobile ? (selected ? 30 : 36) : quiet ? 28 : 36} />
              </div>
              {/* folded away while the "How it works" plate needs its corner (planned above) */}
              {!mobile && !(foldScale && plateShown) && (
                <div data-scale>
                  <ScaleBar m={m} names={names} family={family} states={states} atoms={atoms} pipelines={pipelines} counts={counts}
                    selected={selected} onPick={onSelect} onLand={jumpLand} focusFam={focusFam} slim={quiet} />
                </div>
              )}
            </div>
            {!mobile && !(fold >= 2 && plateShown) && (
              <div data-corner="br" className={`${corner} bottom-3 right-3 sm:bottom-5 sm:right-5`} style={stamp(3, still, flips)}>
                {/* focus mode: the minimap is a small inset (orientation, not a second map) */}
                <CornerPlate m={m} face={zoomedIn_ ? "minimap" : "legend"} world={{ w: W, h: H }} box={cam.box} source={minimap} onCenter={centerAt}
                  quiet={quiet && zoomedIn_}
                  width={quiet && zoomedIn_ ? CORNER.wQuiet : cornerAt.scale ? clamp(visW - 2 * CORNER.margin - cornerAt.scale.w - 24, 264, CORNER.w) : CORNER.w} />
              </div>
            )}
          </div>
        )}

        {isTrue && (trueState.status === "missing" || trueState.status === "error") && (
          <div role="alert" className="absolute inset-x-4 top-24 z-30 mx-auto max-w-xl p-4" style={{ ...{ background: m.plateHi, color: m.ink, border: `var(--ap) solid ${m.border}`, fontFamily: m.bodyFont }, fontSize: TYPE.body }}>
            <p className="font-bold">The true pixel map has not been converted yet.</p>
            <p className="mt-1">Run:</p>
            <pre className="mt-1 whitespace-pre-wrap break-all text-[13px]">{PIXELMAP_CMD}</pre>
            {trueState.status === "error" && <p className="mt-2 text-[13px]" style={{ color: m.inkSoft }}>{trueState.message}</p>}
          </div>
        )}

        {/* ——— the drawer */}
        {card && !uiHidden && (
          <Drawer m={m} mobile={mobile} sheet={sheet === "peek" ? "half" : sheet} setSheet={setSheet} card={card} still={still}
            onPick={onSelect} onBack={fitWhole}
            stateOf={(n) => states[n] ?? "untrained"} isAtom={(n) => atoms.has(n)}
            fullDiagram={fullDiagram} setFullDiagram={setFullDiagram} stageW={vp.w}
            diagramOn={diagramOn} onShowDiagram={plateOpen ? undefined : () => setPlateOpen(true)} />
        )}
      </div>
    </LabMotion>
  );
}
