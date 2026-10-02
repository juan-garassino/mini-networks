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
// Layout: a left sidebar (desktop) or bottom sheet (phones) holds EVERYTHING
// that isn't the map (sidebar.tsx); the map fills the rest edge to edge.
// /lab contract: URL view → useWorld → camera → paint → data-lab-ready → window.__lab.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useWorld } from "@/hooks/use-world";
import { useLabView, type LabView } from "@/components/lab/shared/url-state";
import { LabMotion } from "@/components/lab/shared/still";
import { useCamera, type CamBox } from "@/components/lab/shared/camera";
import { cardModel, displayName, evidenceState, type EvidenceState } from "@/components/lab/shared/card-model";
import { CRITTER } from "@/components/lab/shared/critter";
import { FAMILIES, insidePolygon, landBox, resolveMap, type Box, type Family, type MapId, type Pt } from "./anchors";
import { buildRoadGraph, chainRoute, lineageRoutes, pointAt, polylineLength, rootChain } from "./roads";
import { placeTags, textWidth, type PlacedTag, type TagSpec } from "./labels";
import { PaintedOverlay } from "./overlay";
import { Sidebar, sheetHeight, type Labels, type Render, type Sheet } from "./sidebar";
import { TrueMapLayers, spotClear, useTrueMap } from "./true-map";
import { PIXELMAP_CMD } from "./pixelmap";
import { layoutRibbons, spotBoxes, type PlacedRibbon, type RibbonItem } from "./ribbons";
import { ribbonSize } from "./pixel-art";
import { FAMILY_TITLE, IMAGES, THEMES } from "./theme";

// render=grid: 3-px blocks (scripts/pixelate_map.py --cell 3), rests on thirds.
const GRID_CELL = 3;
const GRID_SCALES = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => n / GRID_CELL);
const IMG_MAX = 3;       // clean/grid/baked: × the 1536-px image
const PAPER_MAX = 2;
const TRUE_MAX = 6;      // × the 768-px true map (= 3× the 1536 renders)
const MOBILE_BP = 640;

const KEYFRAMES = `
@keyframes painted-march { to { stroke-dashoffset: -32; } }
@keyframes painted-pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.22); opacity: .5; } }
`;

interface Opts { map: MapId; render: Render; labels: Labels }

function parseOpts(search: string): Opts {
  const p = new URLSearchParams(search);
  const map: MapId = p.get("map") === "paper" ? "paper" : "pixel";
  const r = p.get("render");
  const render: Render = r === "clean" || r === "grid" || r === "baked" ? r : "true";
  const l = p.get("labels");
  const labels: Labels = l === "ours" || l === "baked" ? l : map === "pixel" && render === "baked" ? "baked" : "ours";
  return { map, render, labels };
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
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
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
  const { taxonomy, evidence, runs, family, ready, online } = useWorld(view ? view.still : null);

  const mapId: MapId = opts?.map ?? "pixel";
  const render: Render = opts?.render ?? "true";
  const labels: Labels = opts?.labels ?? "ours";
  const theme = THEMES[mapId];
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
  const counts = useMemo(() => ({
    models: names.length,
    pipelines: taxonomy?.compositions.length ?? 0,
    champions: Object.values(states).filter((s) => s === "champion").length,
    lands: Object.keys(famCount).length,
  }), [names, taxonomy, states, famCount]);

  const graph = useMemo(() => buildRoadGraph(map), [map]);
  const selected = view?.zoom === "node" && view.focus && map.anchors[view.focus] ? view.focus : null;
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoverRow, setHoverRow] = useState<Family | null>(null);
  const [mapHoverFam, setMapHoverFam] = useState<Family | null>(null);
  const lineage = useMemo(() => (selected && taxonomy ? lineageRoutes(graph, selected, parentsOf) : []), [selected, graph, parentsOf, taxonomy]);
  const lineageSet = useMemo(() => {
    const s = new Set<string>();
    if (!selected) return s;
    const walk = (n: string) => { if (s.has(n)) return; s.add(n); parentsOf(n).forEach(walk); };
    walk(selected);
    return s;
  }, [selected, parentsOf]);
  const viewFam = (view?.zoom === "region" || view?.zoom === "node") && view.focus && family?.[view.focus]
    ? (family[view.focus] as Family) : null;
  const focusFam: Family | null = hoverRow ?? viewFam;
  // a hovered land row gets the lighter version of the focus gradient
  const focusStrength = hoverRow && hoverRow !== viewFam ? 0.55 : 1;

  // where the focus reveal starts: the focused model, or a hovered land's centre
  const focusAtX = hoverRow && hoverRow !== viewFam
    ? (() => { const b = td?.landBox[hoverRow]; return b ? [Math.round(b.x + b.w / 2), Math.round(b.y + b.h / 2)] : null; })()
    : view?.focus && map.anchors[view.focus] ? [Math.floor(map.anchors[view.focus][0]), Math.floor(map.anchors[view.focus][1])] : null;
  const fax = focusAtX?.[0] ?? null, fay = focusAtX?.[1] ?? null;
  const focusAt = useMemo(() => (fax == null || fay == null ? null : { x: fax, y: fay }), [fax, fay]);

  // ——— camera
  const [vp, setVp] = useState({ w: 1, h: 1 });
  const [manual, setManual] = useState<CamBox | null>(null);
  // phones: the sheet covers the bottom of the map; frame into the part above it
  const sheetPx = mobile ? sheetHeight(selected ? (sheet === "peek" ? "half" : sheet) : sheet, vp.h) : 0;
  const visH = Math.max(120, vp.h - sheetPx);
  const fit = Math.min(vp.w / W, visH / H);
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
      return { overview: base, region: upTo(base * 1.8), node: upTo(Math.max(2, base * 2)), min: Math.min(base, crisp[0]), max: TRUE_MAX };
    }
    if (snapGrid) {
      const snap = (k: number) => [...GRID_SCALES].reverse().find((s) => s <= k + 1e-3) ?? GRID_SCALES[0];
      const up = (k: number) => GRID_SCALES.find((s) => s >= k - 1e-3) ?? IMG_MAX;
      const base = snap(fit);
      return { overview: base, region: up(base * 1.8), node: up(Math.max(base * 2.2, 1)), min: GRID_SCALES[0], max: IMG_MAX };
    }
    const max = mapId === "paper" ? PAPER_MAX : IMG_MAX;
    return { overview: fit, region: Math.min(max, fit * 1.8), node: Math.min(max, Math.max(fit * 2.2, 1.2)), min: fit * 0.8, max };
  }, [isTrue, snapGrid, mapId, fit, crisp, down, upTo, mobile]);

  const boxAt = useCallback((cx: number, cy: number, k: number): CamBox => {
    // centre (cx, cy) in the VISIBLE part of the view (above the sheet on phones)
    const w = vp.w / k, h = vp.h / k, hv = visH / k;
    const x = w >= W ? (W - w) / 2 : clamp(cx - w / 2, 0, W - w);
    const y = hv >= H ? (H - hv) / 2 : clamp(cy - hv / 2, 0, H - hv);
    return { x, y, w, h };
  }, [vp, visH, W, H]);

  const landFrame = useCallback((f: Family): Box => {
    if (td) return td.landBox[f];
    return landBox(map.lands[f]);
  }, [td, map]);

  const target: CamBox = useMemo(() => {
    const zoom = view?.zoom ?? "overview";
    const focus = view?.focus ?? null;
    const a = focus ? map.anchors[focus] : undefined;
    if (zoom === "node" && a) return boxAt(a[0], a[1], levels.node);
    if (zoom === "region" && a && family?.[focus!]) {
      const lb = landFrame(family[focus!] as Family);
      const m = isTrue ? 10 : 60;
      let k = Math.min(vp.w / (lb.w + m * 2), visH / (lb.h + m * 2));
      k = isTrue ? clamp(down(k), levels.overview, TRUE_MAX) : clamp(k, levels.min, levels.max);
      return boxAt(lb.x + lb.w / 2, lb.y + lb.h / 2, k);
    }
    return boxAt(W / 2, H / 2, levels.overview);
  }, [view, map, levels, family, landFrame, boxAt, vp.w, visH, isTrue, down, W, H]);

  useEffect(() => { setManual(null); }, [view?.zoom, view?.focus, mapId, render, vp.w, vp.h]);

  const cam = useCamera({ world: { x: 0, y: 0, w: W, h: H }, target: manual ?? target, still, targetViewport: vp, minWidth: 40 });
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
    setManual({ ...b, x: b.w >= W ? b.x : clamp(b.x + dx * b.w, 0, W - b.w), y: b.h >= H ? b.y : clamp(b.y + dy * b.h, 0, H - b.h) });
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
  // one art pixel in CSS px (sidebar borders): the true map's current scale
  const ap = isTrue ? clamp(Math.round(layoutS * dpr) / dpr, 1, 3) : 2;

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

  // ——— which names show (restraint): atoms always; a derived model when
  // selected / on the lit lineage / hovered / in the focused land, or when the
  // view is zoomed to ≥ 2 art px (true) or ≥ 1.8× the overview (images)
  const zoomedIn = isTrue ? layoutS >= 2 - 1e-3 : layoutS >= levels.overview * 1.8;
  // with a land in focus, only THAT land's derived names show (others dim)
  const showName = useCallback((n: string) =>
    atoms.has(n) || n === selected || n === hovered || lineageSet.has(n)
      || (focusFam !== null ? family?.[n] === focusFam : zoomedIn),
  [atoms, selected, hovered, lineageSet, focusFam, family, zoomedIn]);

  // ——— true map: ribbons + signs (art px)
  // glyph size: the 5-px caps land at ~10 screen px (ribbons) and ~14 (signs)
  const g = Math.max(1, Math.round(10 / (5 * layoutS)));
  const gSign = Math.max(1, Math.round(14 / (5 * layoutS)));
  // the visible part of the map at rest (above the sheet on phones): labels
  // are laid out inside it so the view edge never clips a sign or a ribbon
  const restBox = manual ?? target;
  const visible: Box = useMemo(() => {
    const x0 = Math.max(0, restBox.x), y0 = Math.max(0, restBox.y);
    const x1 = Math.min(W, restBox.x + restBox.w), y1 = Math.min(H, restBox.y + (visH / vp.h) * restBox.h);
    return { x: x0 + 2, y: y0 + 2, w: Math.max(40, x1 - x0 - 4), h: Math.max(40, y1 - y0 - 4) };
  }, [restBox.x, restBox.y, restBox.w, restBox.h, W, H, visH, vp.h]);
  const signs: PlacedRibbon[] = useMemo(() => {
    if (!isTrue || !ours) return [];
    return FAMILIES.map((f) => {
      const text = FAMILY_TITLE[f].toUpperCase();
      const { w, h } = ribbonSize(text, gSign, false, true);
      const [sx, sy] = map.signs[f];
      const V = visible;
      const x = clamp(Math.round(sx - w / 2), V.x + 4, V.x + V.w - w - 5), y = clamp(Math.round(sy - h / 2), V.y + 2, V.y + V.h - h - 3);
      return { name: `sign-${f}`, text, x, y, g: gSign, tail: null, tailAt: 0, sign: { count: famCount[f] ?? 0 }, dim: focusFam !== null && f !== focusFam, box: { x: x - 4, y: y - 1, w: w + 8, h: h + 3 } };
    });
  }, [isTrue, ours, gSign, map, famCount, focusFam, visible]);

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
      };
    });
    const spots = names.flatMap((n) => {
      const a = map.anchors[n];
      return spotBoxes({ ax: Math.floor(a[0]), ay: Math.floor(a[1]), clear: spotClear(n, atoms, td.markers), banner: atoms.has(n) });
    });
    return layoutRibbons(items, { g, spots, obstacles: signs.map((s) => s.box), bounds: visible, clutter: td.clutter })
      .map((rb) => ({ ...rb, dim: focusFam !== null && family?.[rb.name] !== focusFam && !lineageSet.has(rb.name) && rb.name !== hovered }));
  }, [isTrue, td, taxonomy, names, ours, showName, selected, hovered, map, atoms, lineageSet, depthOf, g, signs, visible, focusFam, family]);

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
      };
    });
    return placeTags(specs, { markerR, obstacles, bounds: { x: 2, y: 2, w: W - 4, h: H - 4 } });
  }, [taxonomy, isTrue, ours, names, plated, showName, selected, hovered, map, screenFont, layoutS, measure, mapId, lineageSet, atoms, depthOf, markerR, obstacles, W, H]);

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
      const k = Math.min(1, (now - t0) / 380);
      setCritter((c) => (c ? { ...c, hop: k < 1 ? k : 0 } : c));
      if (k < 1) hopRaf.current = requestAnimationFrame(step);
    };
    hopRaf.current = requestAnimationFrame(step);
  }, [still]);

  // ——— interaction
  const onSelect = useCallback((n: string) => {
    update({ zoom: "node", focus: n });
    setSheet((s) => (s === "peek" ? "half" : s));
  }, [update]);
  const setView = useCallback((v: Partial<Omit<LabView, "still">>) => update(v), [update]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && view?.zoom === "node") update({ zoom: "region" });
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "+" || e.key === "=") stepZoom(1);
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

  // hovering a land on the map lights its row in the sidebar
  const onMapPointer = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    const x = cam.box.x + ((e.clientX - rect.left) / rect.width) * cam.box.w;
    const y = cam.box.y + ((e.clientY - rect.top) / rect.height) * cam.box.h;
    let f: Family | null = null;
    if (td) {
      const px = Math.floor(x), py = Math.floor(y);
      if (px >= 0 && py >= 0 && px < W && py < H) { const i = td.lands[py * W + px]; f = i >= 0 ? FAMILIES[i] : null; }
    } else {
      f = FAMILIES.find((fam) => insidePolygon({ x, y }, map.lands[fam])) ?? null;
    }
    if (f !== mapHoverFam) setMapHoverFam(f);
  };

  const card = useMemo(() => {
    if (!selected || !taxonomy || !family) return null;
    return cardModel(selected, { taxonomy, evidence, runs, family: family[selected] ?? "", depth: depthOf(selected) });
  }, [selected, taxonomy, evidence, runs, family, depthOf]);

  // ——— ready: data + picture + fonts + first painted frame
  const [imgLoaded, setImgLoaded] = useState<string | null>(null);
  const [trueVersion, setTrueVersion] = useState(0);
  const baseCanvas = useRef<HTMLCanvasElement | null>(null);
  const onPainted = useCallback(() => {
    baseCanvas.current = document.querySelector<HTMLCanvasElement>("[data-painted-map] canvas");
    setTrueVersion((v) => v + 1);
  }, []);
  const pictureReady = isTrue ? (trueState.status === "ready" ? trueVersion > 0 : trueState.status === "missing" || trueState.status === "error") : imgLoaded === imgSrc;
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

  const swatch = useMemo(() => {
    if (td) return td.swatch;
    const s: Partial<Record<Family, string>> = {};
    for (const f of FAMILIES) s[f] = theme.evidence.champion.fill;
    return s;
  }, [td, theme]);

  const sidebar = opts && (
    <Sidebar theme={theme} mobile={mobile} sheet={selected && sheet === "peek" ? "half" : sheet} setSheet={setSheet}
      mapId={mapId} render={render} labels={labels} setOpts={set} online={online}
      counts={counts} names={names} family={family} atoms={atoms} states={states} famCount={famCount} swatch={swatch}
      world={{ w: W, h: H }} box={cam.box}
      minimap={isTrue ? { canvas: baseCanvas.current, version: trueVersion } : { img: imgSrc, pixelated: mapId === "pixel" }}
      canIn={curScale() < levels.max - 1e-3} canOut={curScale() > levels.min + 1e-3}
      onZoom={(d) => stepZoom(d)} onFit={fitWhole} onCenter={centerAt}
      focusFam={focusFam} mapHoverFam={mapHoverFam} onHoverLand={setHoverRow} onLand={jumpLand}
      card={card} onPick={onSelect} onBack={() => update({ zoom: "region" })} still={still} />
  );

  return (
    <LabMotion still={still}>
      <style>{KEYFRAMES}</style>
      <div data-painted-root data-lab-ready={drawn ? "1" : undefined}
        className="relative flex h-full w-full select-none overflow-hidden"
        style={{ background: theme.sea, ["--ap" as string]: `${ap}px` } as CSSProperties}>
        {!mobile && sidebar}
        <div className="relative h-full min-w-0 flex-1 overflow-hidden" style={{ background: theme.sea }}>
          <div ref={cam.ref} {...cam.handlers} onWheel={onWheel} onPointerMove={(e) => { cam.handlers.onPointerMove(e); onMapPointer(e); }}
            onPointerLeave={() => setMapHoverFam(null)}
            className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing">
            <div data-painted-map className="absolute left-0 top-0" style={{ width: W * S, height: H * S, transform: `translate(${ox}px, ${oy}px)` }}>
              {isTrue ? (
                td && taxonomy ? (
                  <TrueMapLayers data={td} map={map} states={states} atoms={atoms} focusFam={focusFam}
                    focusStrength={focusStrength} focusAt={focusAt}
                    ribbons={ribbons} signs={signs} lineage={lineage.map((l) => l.pts)}
                    selected={selected} hovered={hovered} critter={critter} scale={S} still={still}
                    onSelect={onSelect} onHover={setHovered} onCritter={onCritter} onPainted={onPainted} />
                ) : null
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- a local, owner-supplied painting */}
                  <img key={imgSrc} src={imgSrc} alt={mapId === "pixel" ? "A pixel-art map of six lands" : "A painted storybook map of six lands"}
                    width={W} height={H} draggable={false} onLoad={() => setImgLoaded(imgSrc)}
                    ref={(el) => { if (el?.complete && el.naturalWidth && imgLoaded !== imgSrc) setImgLoaded(imgSrc); }}
                    className="absolute inset-0 block h-full w-full max-w-none"
                    style={{ imageRendering: mapId === "pixel" ? "pixelated" : "auto" }} />
                  {taxonomy && (
                    <PaintedOverlay map={map} theme={theme} scale={S} heal={heal} ours={ours}
                      tags={tags} tagFont={tagFont} markerR={markerR} states={states} famCount={famCount} counts={counts}
                      selected={selected} hovered={hovered} lineage={lineage} lineageSet={lineageSet}
                      critter={critter} still={still} onSelect={onSelect} onHover={setHovered} onCritter={onCritter} />
                  )}
                </>
              )}
            </div>
          </div>
          {isTrue && (trueState.status === "missing" || trueState.status === "error") && (
            <div role="alert" className="absolute inset-x-4 top-4 z-10 mx-auto max-w-xl p-4 text-[15px]"
              style={{ background: theme.plateHi, color: theme.ink, border: `var(--ap) solid ${theme.border}`, fontFamily: theme.bodyFont }}>
              <p className="font-bold">The true pixel map has not been converted yet.</p>
              <p className="mt-1">Run:</p>
              <pre className="mt-1 whitespace-pre-wrap break-all text-[13px]">{PIXELMAP_CMD}</pre>
              {trueState.status === "error" && <p className="mt-2 text-[13px]" style={{ color: theme.inkSoft }}>{trueState.message}</p>}
            </div>
          )}
          {mobile && sidebar}
        </div>
      </div>
    </LabMotion>
  );
}
