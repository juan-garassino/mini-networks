"use client";

// Skin "painted": the owner's reference map IS the background (full-bleed,
// cover-fit), and a live layer sits on hand-mapped anchors (anchors.ts):
// evidence markers, 44 tags, family signs with real counts, lineage lit along
// the painted roads, the perceptron critter walking those roads, and the
// shared lesson card. /lab contract: URL view (url-state) → useWorld → camera
// (shared/camera) → paint → card → data-lab-ready → window.__lab.
//
// Pixel crispness: the grid image is 4px cells, so the pixel map only ever
// rests at INTEGER scales (1×/2×/3× of the source, capped at 3×) with the
// offset snapped to whole screen px; the wheel steps between those levels.
// The paper map zooms smoothly, capped at 2× image resolution.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorld } from "@/hooks/use-world";
import { useLabView, type LabView } from "@/components/lab/shared/url-state";
import { LabMotion } from "@/components/lab/shared/still";
import { useCamera, type CamBox } from "@/components/lab/shared/camera";
import { cardModel, displayName, evidenceState, type EvidenceState } from "@/components/lab/shared/card-model";
import { CRITTER } from "@/components/lab/shared/critter";
import { IMAGE, landBox, resolveMap, type Box, type Family, type MapId, type Pt } from "./anchors";
import { NavPad } from "./nav";
import { buildRoadGraph, chainRoute, lineageRoutes, pointAt, polylineLength, rootChain } from "./roads";
import { placeTags, textWidth, type PlacedTag, type TagSpec } from "./labels";
import { PaintedOverlay } from "./overlay";
import { PaintedCard } from "./card";
import { Controls, Search, type Labels, type Render } from "./hud";
import { FAMILY_TITLE, IMAGES, THEMES } from "./theme";

const W = IMAGE.w, H = IMAGE.h;
// render=grid: the grid image is 3px blocks (scripts/pixelate_map.py --cell 3
// on clean2), so the camera only rests where 3·k is a whole number (thirds)
// and every block stays a crisp block. render=clean/baked have no consistent
// pixel grid (apparent pitch drifts 2–14px), so they zoom smoothly: overview =
// whole map (contain-fit), then any scale up to PIXEL_MAX, drawn with
// image-rendering: pixelated so upscales stay crisp.
const GRID_CELL = 3;
const PIXEL_SCALES = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => n / GRID_CELL);
const PIXEL_MAX = 3;
const PAPER_MAX = 2;
const CARD_W = 380; // desktop card width incl. margin (screen px)

const KEYFRAMES = `
@keyframes painted-march { to { stroke-dashoffset: -32; } }
@keyframes painted-pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.22); opacity: .5; } }
`;

interface Opts { map: MapId; render: Render; labels: Labels }

function parseOpts(search: string): Opts {
  const p = new URLSearchParams(search);
  const map: MapId = p.get("map") === "paper" ? "paper" : "pixel";
  const r = p.get("render");
  const render: Render = r === "grid" || r === "baked" ? r : "clean";
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

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function boxAt(cx: number, cy: number, k: number, vp: { w: number; h: number }): CamBox {
  const w = vp.w / k, h = vp.h / k;
  const x = w >= W ? (W - w) / 2 : clamp(cx - w / 2, 0, W - w);
  const y = h >= H ? (H - h) / 2 : clamp(cy - h / 2, 0, H - h);
  return { x, y, w, h };
}

/** Canvas text measurement in the route's real fonts (falls back to estimates). */
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
  const render: Render = opts?.render ?? "clean";
  const labels: Labels = opts?.labels ?? "ours";
  const theme = THEMES[mapId];
  const map = useMemo(() => resolveMap(mapId, render), [mapId, render]);
  const imgSrc = mapId === "paper" ? IMAGES.paper : IMAGES[render];
  const snapGrid = mapId === "pixel" && render === "grid";
  const ours = labels === "ours";
  const heal = mapId === "paper" && ours;

  // ——— data
  const names = useMemo(() => taxonomy?.models.map((m) => m.name).filter((n) => map.anchors[n]) ?? [], [taxonomy, map]);
  const parentsOf = useCallback((n: string) => taxonomy?.models.find((m) => m.name === n)?.builds_on ?? [], [taxonomy]);
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
  const lineage = useMemo(() => (selected && taxonomy ? lineageRoutes(graph, selected, parentsOf) : []), [selected, graph, parentsOf, taxonomy]);
  const lineageSet = useMemo(() => {
    const s = new Set<string>();
    if (!selected) return s;
    const walk = (n: string) => { if (s.has(n)) return; s.add(n); parentsOf(n).forEach(walk); };
    walk(selected);
    return s;
  }, [selected, parentsOf]);

  // ——— camera
  const [vp, setVp] = useState({ w: 1, h: 1 });
  const [manual, setManual] = useState<CamBox | null>(null);
  // Overview shows the WHOLE map (contain-fit); zooming in goes up from there.
  const fit = Math.min(vp.w / W, vp.h / H);
  const levels = useMemo(() => {
    if (snapGrid) {
      const snap = (k: number) => [...PIXEL_SCALES].reverse().find((s) => s <= k + 1e-3) ?? PIXEL_SCALES[0];
      const up = (k: number) => PIXEL_SCALES.find((s) => s >= k - 1e-3) ?? 3;
      const base = snap(fit);
      return { overview: base, region: up(base * 1.8), node: up(Math.max(base * 2.2, 1)), min: PIXEL_SCALES[0], max: PIXEL_MAX };
    }
    if (mapId === "pixel") {
      return { overview: fit, region: Math.min(PIXEL_MAX, fit * 1.8), node: Math.min(PIXEL_MAX, Math.max(fit * 2.2, 1.2)), min: fit * 0.8, max: PIXEL_MAX };
    }
    return { overview: fit, region: Math.min(PAPER_MAX, fit * 1.8), node: Math.min(PAPER_MAX, Math.max(fit * 2.2, 1.2)), min: fit * 0.8, max: PAPER_MAX };
  }, [mapId, fit, snapGrid]);

  const target: CamBox = useMemo(() => {
    const zoom = view?.zoom ?? "overview";
    const focus = view?.focus ?? null;
    const a = focus ? map.anchors[focus] : undefined;
    if (zoom === "node" && a) {
      const k = levels.node;
      const wide = vp.w >= 640;
      return boxAt(a[0] + (wide ? CARD_W / 2 / k : 0), a[1] + (wide ? 0 : (vp.h * 0.26) / k), k, vp);
    }
    if (zoom === "region" && a && family?.[focus!]) {
      const lb = landBox(map.lands[family[focus!] as keyof typeof map.lands]);
      let k = levels.region;
      if (mapId === "paper") k = clamp(Math.min(vp.w / (lb.w + 120), vp.h / (lb.h + 120)), levels.min, PAPER_MAX);
      return boxAt(lb.x + lb.w / 2, lb.y + lb.h / 2, k, vp);
    }
    return boxAt(W / 2, H / 2, levels.overview, vp);
  }, [view, map, levels, vp, family, mapId]);

  useEffect(() => { setManual(null); }, [view?.zoom, view?.focus, mapId, vp.w, vp.h]);

  const cam = useCamera({ world: { x: 0, y: 0, w: W, h: H }, target: manual ?? target, still, targetViewport: vp });
  useEffect(() => {
    if (cam.size.w !== vp.w || cam.size.h !== vp.h) setVp({ w: cam.size.w, h: cam.size.h });
  }, [cam.size.w, cam.size.h, vp.w, vp.h]);

  const wheelAcc = useRef(0);
  const onWheel = useCallback((e: React.WheelEvent) => {
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width, fy = (e.clientY - rect.top) / rect.height;
    const cur = vp.w / cam.box.w;
    let k: number;
    if (snapGrid) {
      wheelAcc.current += e.deltaY;
      if (Math.abs(wheelAcc.current) < 40) return;
      const dir = wheelAcc.current < 0 ? 1 : -1;
      wheelAcc.current = 0;
      const idx = PIXEL_SCALES.reduce((bi, s, i) => (Math.abs(s - cur) < Math.abs(PIXEL_SCALES[bi] - cur) ? i : bi), 0);
      k = clamp(PIXEL_SCALES[clamp(idx + dir, 0, PIXEL_SCALES.length - 1)], levels.min, levels.max);
    } else {
      k = clamp(cur * Math.exp(-e.deltaY * 0.0015), levels.min, levels.max);
    }
    zoomTo(k, fx, fy);
  }, [cam.box, vp.w, snapGrid, levels]); // eslint-disable-line react-hooks/exhaustive-deps

  // Zoom about a screen fraction (fx, fy); keeps the map centred when it's smaller than the view.
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
  const stepZoom = (dir: 1 | -1) => {
    const cur = vp.w / cam.box.w;
    if (snapGrid) {
      const next = dir > 0 ? PIXEL_SCALES.find((s) => s > cur + 1e-3) : [...PIXEL_SCALES].reverse().find((s) => s < cur - 1e-3);
      if (next !== undefined) zoomTo(clamp(next, levels.min, levels.max));
    } else zoomTo(clamp(cur * (dir > 0 ? 1.4 : 1 / 1.4), levels.min, levels.max));
  };
  const panBy = (dx: number, dy: number) => {
    const b = cam.box;
    setManual({
      ...b,
      x: b.w >= W ? b.x : clamp(b.x + dx * b.w, 0, W - b.w),
      y: b.h >= H ? b.y : clamp(b.y + dy * b.h, 0, H - b.h),
    });
  };
  const centerAt = (x: number, y: number) => {
    const b = cam.box;
    setManual({ ...b, x: b.w >= W ? b.x : clamp(x - b.w / 2, 0, W - b.w), y: b.h >= H ? b.y : clamp(y - b.h / 2, 0, H - b.h) });
  };
  const fitWhole = () => { setManual(null); update({ zoom: "overview", focus: null }); };
  const jumpLand = (f: Family) => {
    const first = names.find((n) => family?.[n] === f && map.anchors[n]);
    if (first) update({ zoom: "region", focus: first });
  };

  // live scale; the pixel map snaps to its integer level once the flight lands
  let S = cam.scale > 0 && Number.isFinite(cam.scale) ? cam.scale : 1;
  if (snapGrid) { const q = Math.round(S * GRID_CELL) / GRID_CELL; if (Math.abs(S - q) < 0.01) S = q; }
  const ox = Math.round(-cam.box.x * S), oy = Math.round(-cam.box.y * S);
  // layout scale: the resting scale of the current target (tags re-layout per level, not per frame)
  const Sl = manual ? vp.w / manual.w : vp.w / target.w;
  const layoutS = Number.isFinite(Sl) && Sl > 0 ? (snapGrid ? Math.round(Sl * GRID_CELL) / GRID_CELL || 1 : Sl) : 1;

  // ——— fonts + tags
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const done = () => { if (alive) setFontsReady(true); };
    const fallback = setTimeout(done, 1500);
    document.fonts?.ready.then(done).catch(done);
    return () => { alive = false; clearTimeout(fallback); };
  }, []);
  const measure = useMeasure(fontsReady);

  const screenFont = layoutS < 1.5 ? 11 : layoutS < 2.5 ? 13 : 14;
  const tagFont = screenFont / layoutS;
  const markerR = (layoutS < 1.5 ? 5.5 : layoutS < 2.5 ? 7 : 8) / layoutS;

  // paper + ours: models the painter gave a plate are tagged BY that plate
  const plated = useMemo(() => new Set(heal ? map.baked.map((b) => b.name).filter(Boolean) as string[] : []), [heal, map]);
  const tagNames = useMemo(() => {
    if (ours) return names.filter((n) => !plated.has(n));
    return [selected, hovered].filter((n): n is string => Boolean(n && map.anchors[n]));
  }, [ours, names, selected, hovered, map, plated]);

  const obstacles = useMemo(() => {
    const o: Box[] = [];
    if (!ours) return o;
    if (mapId === "pixel") {
      o.push({ ...map.cartouche, w: map.cartouche.w + 6, h: map.cartouche.h + 6 });
      for (const [f, at] of Object.entries(map.signs)) {
        const w = FAMILY_TITLE[f].length * 15 * 0.62 + 64;
        o.push({ x: at[0] - w / 2, y: at[1] - 13, w, h: 26 });
      }
      o.push({ x: map.pipelines.x - 60, y: map.pipelines.y - 18, w: 120, h: 24 });
    } else {
      for (const b of map.baked) o.push({ x: b.box.x - 5, y: b.box.y - 5, w: b.box.w + 10, h: b.box.h + 10 });
      o.push({ x: 26, y: 20, w: 312, h: 118 });
    }
    return o;
  }, [ours, mapId, map]);

  const tags: PlacedTag[] = useMemo(() => {
    if (!taxonomy) return [];
    const pad = screenFont * 0.45 / layoutS;
    const specs: TagSpec[] = tagNames.map((n) => {
      const text = displayName(n);
      const wScreen = measure ? measure(text, screenFont, mapId) : textWidth(text, screenFont, mapId);
      const isAtom = parentsOf(n).length === 0;
      return {
        name: n, text, at: { x: map.anchors[n][0], y: map.anchors[n][1] },
        w: wScreen / layoutS + pad * 2, h: (screenFont * 1.55) / layoutS,
        priority: (n === selected ? 1000 : 0) + (lineageSet.has(n) ? 300 : 0) + (isAtom ? 100 : 50 - depthOf(n)),
      };
    });
    return placeTags(specs, { markerR, obstacles, bounds: { x: 2, y: 2, w: W - 4, h: H - 4 } });
  }, [taxonomy, tagNames, measure, screenFont, layoutS, mapId, map, parentsOf, selected, lineageSet, depthOf, markerR, obstacles]);

  // ——— critter: walks from the selected model's root atom along the painted roads
  const [critter, setCritter] = useState<(Pt & { dir: number; walking: boolean; hop: number }) | null>(null);
  // idle spot: beside the focused model (region view), else the first atom
  const focusName = view?.focus ?? null;
  const home = useMemo(() => (focusName && map.anchors[focusName]) || map.anchors.classifier || Object.values(map.anchors)[0], [map, focusName]);
  useEffect(() => {
    if (!taxonomy) return;
    const side = -(markerR * 3.4); // stand beside the marker, clear of the ring
    if (!selected) { setCritter({ x: home[0] + side, y: home[1], dir: 1, walking: false, hop: 0 }); return; }
    const a = map.anchors[selected];
    const pts = chainRoute(graph, rootChain(selected, parentsOf));
    const end = { x: a[0] + side, y: a[1], dir: 1, walking: false, hop: 0 };
    if (still || pts.length < 2) { setCritter(end); return; }
    const len = polylineLength(pts);
    const speed = Math.max(CRITTER.walkSpeed, len / 3.2);
    let raf = 0, t0 = 0;
    const step = (now: number) => {
      if (!t0) t0 = now;
      const dist = ((now - t0) / 1000) * speed;
      if (dist >= len) { setCritter(end); return; }
      const p = pointAt(pts, dist);
      setCritter({ x: p.x + side, y: p.y, dir: p.dir, walking: true, hop: 0 });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // markerR is layout-scale dependent; re-run only on selection/map changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, graph, still, taxonomy, home]);

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
  const onSelect = useCallback((n: string) => update({ zoom: "node", focus: n }), [update]);
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
  }, [view?.zoom, update]);

  const card = useMemo(() => {
    if (!selected || !taxonomy || !family) return null;
    return cardModel(selected, { taxonomy, evidence, runs, family: family[selected] ?? "", depth: depthOf(selected) });
  }, [selected, taxonomy, evidence, runs, family, depthOf]);

  // ——— ready: data + image + fonts + first painted frame
  const [imgLoaded, setImgLoaded] = useState<string | null>(null);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    setDrawn(false);
    if (!ready || imgLoaded !== imgSrc || !fontsReady || vp.w <= 1) return;
    const id = requestAnimationFrame(() => setDrawn(true));
    const t = setTimeout(() => setDrawn(true), 250);
    return () => { cancelAnimationFrame(id); clearTimeout(t); };
  }, [ready, imgLoaded, imgSrc, fontsReady, vp.w]);

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

  return (
    <LabMotion still={still}>
      <style>{KEYFRAMES}</style>
      <div data-painted-root data-lab-ready={drawn ? "1" : undefined}
        className="relative h-full w-full select-none overflow-hidden" style={{ background: theme.sea }}>
        <div ref={cam.ref} {...cam.handlers} onWheel={onWheel} className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing">
          <div className="absolute left-0 top-0" style={{ width: W * S, height: H * S, transform: `translate(${ox}px, ${oy}px)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a local, owner-supplied painting drawn at exact integer scales */}
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
          </div>
        </div>
        <Search theme={theme} names={names} onPick={onSelect} />
        {!still && (
          <NavPad theme={theme} imgSrc={imgSrc} pixelated={mapId === "pixel"} box={cam.box}
            canIn={vp.w / cam.box.w < levels.max - 1e-3} canOut={vp.w / cam.box.w > levels.min + 1e-3}
            onZoom={stepZoom} onFit={fitWhole} onLand={jumpLand} onCenter={centerAt} />
        )}
        {opts && <Controls theme={theme} map={mapId} render={render} labels={labels} set={set} online={online} />}
        {card && <PaintedCard card={card} theme={theme} still={still} onPick={onSelect} onClose={() => update({ zoom: "region" })} />}
      </div>
    </LabMotion>
  );
}
