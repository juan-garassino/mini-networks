"use client";

// Skin "sky": the Night Map — the model zoo after dark, as one contemporary
// pixel-art star chart; the painted pixel map's night sibling.
//
//   the sky     baked once (bake.ts, 1 sky px = 4 world px, shown pixelated):
//               the night ramp, a dithered Milky Way in the margins, field
//               stars, and one Bayer-dithered nebula per family on its own
//               hue-shifted ramp — the nebula is the family
//   the marks   a screen canvas on a fixed art grid (paint.ts): evidence star
//               sprites, 1-px asterism lines (lineage) that stop short of their
//               stars, dotted pipeline arcs, the broken selection ring, and the
//               12-fps life layer (motion.ts: twinkle, champion glint, lineage
//               comets, a meteor) — frame 0 only under ?still=1 / reduced motion
//   the words   night sign plaques (emblem + FAMILY count) on each nebula's
//               top-left, Pixelify star names under their sprites, named edge
//               chevrons for pipeline partners off screen
//   the chrome  the painted maps' four corners + drawer in the night material
//               (tokens.ts SKY_MATERIAL), with Day | Night tabs (chrome.tsx)
//
// Files: tokens.ts (every value) · bake.ts (the sky) · layers.tsx (canvases)
// · paint.ts / sprites.ts / motion.ts (the art grid, sprites, life) ·
// layout.ts (word placement) · plaque.tsx / chrome.tsx (HTML furniture).
// DESIGN.md says how to lift it.
//
// Positions come ONLY from lib/world. On a portrait phone the whole chart is
// turned a quarter (frame coords), so the landscape zoo fills a tall screen.
// /lab contract: URL view → useWorld → camera → paint → data-lab-ready → window.__lab.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useWorld } from "@/hooks/use-world";
import { useLabView, type LabView } from "@/components/lab/shared/url-state";
import { LabMotion } from "@/components/lab/shared/still";
import { useCamera, type CamBox } from "@/components/lab/shared/camera";
import { cardModel, displayName, evidenceState, type EvidenceState } from "@/components/lab/shared/card-model";
import { FAMILIES, type Family } from "@/components/lab/painted/anchors";
import { Cartouche } from "@/components/lab/painted/corners/cartouche";
import { Compass } from "@/components/lab/painted/corners/compass";
import { ScaleBar } from "@/components/lab/painted/corners/scale-bar";
import { CornerPlate } from "@/components/lab/painted/corners/corner-plate";
import { Drawer, DRAWER_W, sheetHeight, type Sheet } from "@/components/lab/painted/drawer";
import { bakeSky, type Bake } from "./bake";
import { FAMILY_INK, GRID, INK, LINE, SKY_MATERIAL as m, SPACE, TYPE } from "./tokens";
import { dim, mix } from "./paint";
import { EVIDENCE_RUN, SkyCanvas, SkyMarks, type FStar, type Line } from "./layers";
import { clamp, pad, placeWords, union, type Box } from "./layout";
import { Chevron, NightTabs, ShowUi } from "./chrome";
import { StarPair } from "./icon";
import { Plaque } from "./plaque";

const AP = GRID.ap;
const DAY_HREF = "/lab/painted/?map=pixel";

/** Fit `b` into the screen rect the insets leave free; with `q`, snap the
 * scale so one sky px is a whole number of device px (crisp, even pixels) —
 * unless snapping would shrink the sky by more than `maxLoss` (a phone, where
 * one sky px is only 2–3 device px: whole px there would waste a third of it). */
function fitInto(b: Box, vw: number, vh: number, ins: { t: number; r: number; b: number; l: number }, visW: number, visH: number, q: number, maxLoss = 1): Box {
  const aw = Math.max(80, visW - ins.l - ins.r), ah = Math.max(80, visH - ins.t - ins.b);
  let s = Math.min(aw / Math.max(1, b.w), ah / Math.max(1, b.h));
  if (q > 0 && s * q >= 1) { const sn = Math.floor(s * q) / q; if (1 - sn / s <= maxLoss) s = sn; }
  const x = b.x + b.w / 2 - (ins.l + aw / 2) / s, y = b.y + b.h / 2 - (ins.t + ah / 2) / s;
  return { x, y, w: vw / s, h: vh / s };
}

function useWindow() {
  const [w, setW] = useState({ w: 1440, dpr: 2 });
  useEffect(() => {
    const on = () => setW({ w: window.innerWidth, dpr: window.devicePixelRatio || 1 });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

/** The corner plates' live rects (relative to `root`), so no word is placed
 * under one: each plate registers with `refFor(key)`; a ResizeObserver on the
 * plates and their container (`refFor(key, false)`: watched, not an obstacle)
 * re-measures when a plate grows or moves. */
function useCornerRects(root: React.RefObject<HTMLElement | null>) {
  const els = useRef(new Map<string, HTMLElement>());
  const refs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const watchOnly = useRef(new Set<string>());
  const [rects, setRects] = useState<Box[]>([]);
  const measure = useCallback(() => {
    const r0 = root.current?.getBoundingClientRect();
    if (!r0) return;
    const out = [...els.current].filter(([k]) => !watchOnly.current.has(k)).map(([, e]) => e.getBoundingClientRect()).filter((r) => r.width > 0)
      .map((r) => ({ x: Math.round(r.left - r0.left), y: Math.round(r.top - r0.top), w: Math.round(r.width), h: Math.round(r.height) }));
    setRects((prev) => (JSON.stringify(prev) === JSON.stringify(out) ? prev : out));
  }, [root]);
  const ro = useRef<ResizeObserver | null>(null);
  const observer = useCallback(() => {
    if (!ro.current && typeof ResizeObserver !== "undefined") ro.current = new ResizeObserver(() => measure());
    return ro.current;
  }, [measure]);
  useEffect(() => () => ro.current?.disconnect(), []);
  const refFor = useCallback((key: string, obstacle = true) => {
    if (!obstacle) watchOnly.current.add(key);
    let f = refs.current.get(key);
    if (!f) {
      f = (el: HTMLElement | null) => {
        const old = els.current.get(key);
        if (old) observer()?.unobserve(old);
        if (el) { els.current.set(key, el); observer()?.observe(el); } else els.current.delete(key);
        measure();
      };
      refs.current.set(key, f);
    }
    return f;
  }, [observer, measure]);
  return { rects, refFor };
}

const NO_LEADERS: never[] = [];

export function SkySkin() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { view, update } = useLabView();
  const still = view?.still ?? true;
  const { world, taxonomy, evidence, runs, family, ready } = useWorld(view ? view.still : null);
  const { w: winW, dpr } = useWindow();
  const mobile = winW < GRID.mobileBp;
  const [sheet, setSheet] = useState<Sheet>("peek");
  const [uiHidden, setUiHidden] = useState(false);
  const [fullDiagram, setFullDiagram] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => setUiHidden(new URLSearchParams(window.location.search).get("ui") === "0");
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  // ——— the viewport (the camera measures it) and the frame's orientation
  const [vp, setVp] = useState({ w: 1, h: 1 });
  const measured = vp.w > 1;
  const portrait = measured && vp.h > vp.w * 1.3;
  const wb: Box = world?.camera.world ?? { x: 0, y: 0, w: 2048, h: 1360 };
  const toF = useCallback((p: { x: number; y: number }) => (portrait ? { x: wb.y + wb.h - p.y, y: p.x } : { x: p.x, y: p.y }), [portrait, wb.x, wb.y, wb.w, wb.h]); // eslint-disable-line react-hooks/exhaustive-deps
  const frameWorld: Box = useMemo(() => (portrait ? { x: 0, y: wb.x, w: wb.h, h: wb.w } : { x: wb.x, y: wb.y, w: wb.w, h: wb.h }), [portrait, wb.x, wb.y, wb.w, wb.h]);

  // ——— data
  const nodes = useMemo(() => world?.nodes ?? [], [world]);
  const names = useMemo(() => nodes.map((n) => n.name), [nodes]);
  const atoms = useMemo(() => new Set(nodes.filter((n) => n.atom).map((n) => n.name)), [nodes]);
  const states = useMemo(() => {
    const out: Record<string, EvidenceState> = {};
    for (const n of names) out[n] = evidenceState(evidence.find((e) => e.name === n));
    return out;
  }, [names, evidence]);
  const stars: FStar[] = useMemo(() => nodes.map((n) => ({ name: n.name, family: n.family, ...toF(n.center), atom: n.atom, parents: n.parents, state: states[n.name] ?? "untrained" })), [nodes, toF, states]);
  const byName = useMemo(() => new Map(stars.map((s) => [s.name, s])), [stars]);
  const famCount = useMemo(() => { const c: Record<string, number> = {}; for (const n of nodes) c[n.family] = (c[n.family] ?? 0) + 1; return c; }, [nodes]);
  const famProven = useMemo(() => { const c: Record<string, number> = {}; for (const n of nodes) if (states[n.name] === "champion") c[n.family] = (c[n.family] ?? 0) + 1; return c; }, [nodes, states]);
  const pipelines = useMemo(() => taxonomy?.compositions.map((c) => c.name) ?? [], [taxonomy]);
  const counts = useMemo(() => ({
    models: names.length, pipelines: pipelines.length,
    champions: Object.values(states).filter((s) => s === "champion").length, lands: Object.keys(famCount).length,
  }), [names, pipelines, states, famCount]);
  // each family's hull (frame px) and its nebula's box
  const hulls = useMemo(() => {
    const out: Partial<Record<Family, Box>> = {};
    for (const f of FAMILIES) {
      const fs = stars.filter((s) => s.family === f);
      if (!fs.length) continue;
      const x = Math.min(...fs.map((s) => s.x)), y = Math.min(...fs.map((s) => s.y));
      out[f] = { x, y, w: Math.max(...fs.map((s) => s.x)) - x, h: Math.max(...fs.map((s) => s.y)) - y };
    }
    return out;
  }, [stars]);
  const nebBox = useCallback((f: Family): Box | null => (hulls[f] ? pad(hulls[f]!, GRID.neb, GRID.neb + 30) : null), [hulls]);

  const selected = view?.zoom === "node" && view.focus && byName.has(view.focus) ? view.focus : null;
  const focusStar = (view?.zoom === "region" || view?.zoom === "node") && view.focus ? byName.get(view.focus) ?? null : null;
  const focusFam = (focusStar?.family as Family | undefined) ?? null;
  const lineageSet = useMemo(() => {
    const s = new Set<string>();
    if (!selected) return s;
    const walk = (n: string) => { if (s.has(n)) return; s.add(n); (byName.get(n)?.parents ?? []).forEach(walk); };
    walk(selected);
    return s;
  }, [selected, byName]);
  // the selected star's pipeline partners (deduped), named by their pipelines
  const partners = useMemo(() => {
    if (!selected || !taxonomy) return [] as { name: string; via: string[] }[];
    const by = new Map<string, string[]>();
    for (const c of taxonomy.compositions) {
      if (!c.composes.includes(selected)) continue;
      for (const x of c.composes) if (x !== selected && byName.has(x)) by.set(x, [...(by.get(x) ?? []), c.name]);
    }
    return [...by.entries()].map(([name, via]) => ({ name, via }));
  }, [selected, taxonomy, byName]);
  const partnerSet = useMemo(() => new Set(partners.map((p) => p.name)), [partners]);

  // ——— the bake (once per orientation; it waits for the measured viewport)
  const skyBox = useMemo(() => pad(frameWorld, GRID.pad), [frameWorld]);
  const bake = useMemo(() => {
    if (!world || !measured || !stars.length) return null;
    const edges = world.roads.filter((r) => r.kind === "primary").map((r) => ({ from: byName.get(r.from)!, to: byName.get(r.to)!, family: byName.get(r.to)!.family })).filter((e) => e.from && e.to);
    return bakeSky({ stars, edges, box: skyBox });
    // the bake depends on positions only (not evidence): key on the orientation + world
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, measured, portrait, skyBox]);

  // ——— camera (frame px); the drawer / sheet cover part of the viewport
  const [manual, setManual] = useState<CamBox | null>(null);
  const sheetPx = mobile && selected ? sheetHeight(sheet === "peek" ? "half" : sheet, vp.h) : 0;
  const drawerPx = !mobile && selected && !fullDiagram ? DRAWER_W : 0;
  const visW = Math.max(160, vp.w - drawerPx), visH = Math.max(120, vp.h - sheetPx);
  const q = GRID.cell * dpr; // device px per frame px that make one sky px a whole number of device px
  const target: CamBox = useMemo(() => {
    if (!world || !view || !measured) return frameWorld;
    const ins = SPACE.fit[mobile ? 1 : 0];
    const all = union(FAMILIES.map(nebBox).filter(Boolean) as Box[]);
    // a phone fits the stars themselves (+ room for a sign row): the nebulae's
    // soft rims run on past the edges, so the sky fills the screen, not a strip
    let b: Box = mobile ? pad(union(Object.values(hulls) as Box[]), 40, 110) : all;
    if (view.zoom === "region" && focusFam) b = nebBox(focusFam) ?? all;
    if (view.zoom === "node" && focusStar && focusFam) {
      // the star's nebula, plus its pipeline partners nearest first, within 2.5× the nebula
      const nb = nebBox(focusFam)!;
      const capW = nb.w * 2.5, capH = nb.h * 2.5;
      b = nb;
      const near = partners.map((p) => byName.get(p.name)!).sort((p, r) => Math.hypot(p.x - focusStar.x, p.y - focusStar.y) - Math.hypot(r.x - focusStar.x, r.y - focusStar.y));
      for (const p of near) {
        const u = union([b, { x: p.x - 70, y: p.y - 60, w: 140, h: 120 }]);
        if (u.w <= capW && u.h <= capH) b = u;
      }
    }
    const zin = view.zoom === "overview" || mobile ? ins : { ...ins, ...SPACE.fitZoom };
    return fitInto(b, vp.w, vp.h, zin, visW, visH, view.zoom === "overview" ? q : 0, mobile ? 0.12 : 1);
  }, [world, view, measured, frameWorld, mobile, hulls, nebBox, focusFam, focusStar, partners, byName, vp.w, vp.h, visW, visH, q]);
  useEffect(() => { setManual(null); }, [view?.zoom, view?.focus, vp.w, vp.h, drawerPx]);
  const camClamp = useMemo(() => ({ right: drawerPx, bottom: sheetPx }), [drawerPx, sheetPx]);
  const { ref: camRef, box: camBox, size: camSize, handlers: camHandlers, dragged: camDragged } = useCamera({ world: skyBox, target: manual ?? target, still, targetViewport: vp, minWidth: 120, clamp: camClamp });
  useEffect(() => { if (camSize.w !== vp.w || camSize.h !== vp.h) setVp({ w: camSize.w, h: camSize.h }); }, [camSize.w, camSize.h, vp.w, vp.h]);
  const S = vp.w / camBox.w; // screen px per frame px
  const minW = frameWorld.w * 0.08, maxW = frameWorld.w * (portrait ? 1.2 : 1.4);
  const zoomTo = (w: number, fx = 0.5, fy = 0.5) => {
    const b = camBox;
    w = clamp(w, minW, maxW);
    const h = w * (b.h / b.w);
    setManual({ x: b.x + (b.w - w) * fx, y: b.y + (b.h - h) * fy, w, h });
  };
  const stepZoom = (dir: 1 | -1) => zoomTo(camBox.w / (dir > 0 ? 1.6 : 1 / 1.6));
  const onWheel = (e: React.WheelEvent) => {
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    zoomTo(camBox.w * Math.exp(e.deltaY * 0.0015), (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
  };
  const panBy = (dx: number, dy: number) => {
    const b = camBox;
    setManual({ ...b, x: clamp(b.x + dx * b.w, skyBox.x, skyBox.x + skyBox.w - b.w), y: clamp(b.y + dy * b.h, skyBox.y, skyBox.y + skyBox.h - b.h) });
  };
  const fitWhole = () => { setManual(null); update({ zoom: "overview", focus: null }); };
  const jumpLand = (f: Family) => {
    const first = stars.filter((s) => s.family === f).sort((a, b) => Number(b.atom) - Number(a.atom))[0];
    if (first) update({ zoom: "region", focus: first.name });
  };
  const onSelect = useCallback((n: string) => {
    if (n === selected) { setManual(null); update({ zoom: "overview", focus: null }); return; }
    update({ zoom: "node", focus: n }); setSheet((s) => (s === "peek" ? "half" : s)); setFullDiagram(false);
  }, [update, selected]);
  useEffect(() => { if (!selected) setFullDiagram(false); }, [selected]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (fullDiagram) setFullDiagram(false); else if ((view?.zoom ?? "overview") !== "overview") fitWhole(); }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
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
    const n = selected ? nodes.find((x) => x.name === selected) : undefined;
    return n && taxonomy ? cardModel(n.name, { taxonomy, evidence, runs, family: n.family, depth: n.depth }) : null;
  }, [selected, nodes, taxonomy, evidence, runs]);

  // ——— ready + hooks: data in, the sky painted for the current bake
  const [painted, setPainted] = useState<Bake | null>(null);
  const onPaint = useCallback(() => setPainted(bake), [bake]);
  const drawn = Boolean(ready && bake && painted === bake);
  useEffect(() => {
    if (!drawn) return;
    const w = window as unknown as { __lab?: unknown };
    w.__lab = { select: (n: string) => onSelect(n), view: (v: { zoom: LabView["zoom"]; focus?: string }) => update({ zoom: v.zoom, focus: v.focus ?? null }) };
    return () => { delete w.__lab; };
  }, [drawn, onSelect, update]);

  // ——— the lines: primary lineage in the overview; a focused family adds its
  // secondary + cross-family lines (dashed); a selection lights its lineage
  const lines: Line[] = useMemo(() => {
    if (!world) return [];
    const out: Line[] = [];
    for (const r of world.roads) {
      const a = byName.get(r.from), b = byName.get(r.to);
      if (!a || !b) continue;
      const lit = lineageSet.has(r.from) && lineageSet.has(r.to);
      const touches = focusFam !== null && (a.family === focusFam || b.family === focusFam);
      const fam = FAMILY_INK[b.family];
      if (lit) { out.push({ id: r.id, a, b, ink: INK.lit, pattern: r.kind === "primary" ? "solid" : "dash", sink: null, comet: { busy: true, ink: EVIDENCE_RUN[b.state] } }); continue; }
      if (r.kind === "primary") {
        const dimmed = focusFam !== null && b.family !== focusFam;
        // the whole sky: lines sit quietly under the stars (the nebula + sprites
        // read first, the fans of a busy parent never shout); a focused family's
        // own lines come up to the pastel
        const quiet = focusFam === null && !selected;
        const base = fam ? (quiet ? mix(fam.tint[0], fam.ramp[3], 0.62) : mix(fam.tint[0], fam.ramp[2], 0.3)) : INK.cross;
        // a long line's middle sinks two steps (layers.tsx), so a parent's fan reads as spokes
        out.push({ id: r.id, a, b, ink: dimmed ? dim(base, 0.7) : base, pattern: "solid", sink: fam && !dimmed ? fam.ramp[LINE.sinkStep] : null, comet: selected || dimmed ? null : { busy: false, ink: EVIDENCE_RUN[b.state] } });
      } else if (touches) {
        // secondary + cross-family lineage: shown only on focus, dashed and quiet
        out.push({ id: r.id, a, b, ink: dim(INK.cross, 0.4), pattern: "dash", sink: null, comet: null });
      }
    }
    // lit lines on top
    return out.sort((p, r) => Number(p.ink === INK.lit) - Number(r.ink === INK.lit));
  }, [world, byName, lineageSet, focusFam, selected]);

  // ——— screen-space layout: plaques, names, partner arcs / chevrons
  const scr = useCallback((p: { x: number; y: number }) => {
    const ax = Math.round(((p.x - camBox.x) * S) / AP), ay = Math.round(((p.y - camBox.y) * S) / AP);
    return { x: ax * AP + AP / 2, y: ay * AP + AP / 2 };
  }, [camBox.x, camBox.y, S]);
  const zoomedIn = camBox.w < frameWorld.w * 0.75;
  const regionish = (view?.zoom ?? "overview") !== "overview" || zoomedIn;
  const corners = useCornerRects(rootRef);
  const layout = useMemo(() => placeWords({
    stars, byName, families: [...FAMILIES], hulls, famCount, focusFam, selected, hovered, lineage: lineageSet, partners,
    scr, cam: camBox, S, bake, vw: vp.w, vh: vp.h, visW, visH, mobile, regionish, zoomedIn,
    corners: uiHidden ? [] : corners.rects,
  }), [stars, byName, hulls, famCount, focusFam, selected, hovered, lineageSet, partners, scr, camBox, S, bake, vp.w, vp.h, visW, visH, mobile, regionish, zoomedIn, uiHidden, corners.rects]);

  const whole = !manual && (view?.zoom ?? "overview") === "overview";
  const corner = "pointer-events-auto absolute z-20";
  const vw = vp.w, vh = vp.h;

  return (
    <LabMotion still={still}>
      <div ref={rootRef} data-lab-ready={drawn ? "1" : undefined} className="relative h-full w-full select-none overflow-hidden"
        style={{ background: m.sea, fontFamily: m.bodyFont, ["--ap" as string]: `${AP}px` } as CSSProperties}>
        <div ref={camRef} {...camHandlers} onWheel={onWheel}
          onClick={() => { if (!camDragged.current && (view?.zoom ?? "overview") !== "overview") fitWhole(); }} className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing">
          {bake && measured && (
            <>
              <SkyCanvas bake={bake} ghost={focusFam} box={camBox} vw={vw} vh={vh} dpr={dpr} sea={m.sea} onPaint={onPaint} />
              <SkyMarks stars={stars} lines={lines} arcs={layout.arcs} leaders={uiHidden ? NO_LEADERS : layout.leaders} box={camBox} vw={vw} vh={vh} dpr={dpr} ap={AP} bake={bake}
                selected={selected} hovered={hovered} dimFam={focusFam} still={still} />
              <svg width={vw} height={vh} className="absolute inset-0 block" role="group" aria-label="The Night Map: the models as stars, the families as nebulae">
                {/* star names (Pixelify, outlined in the night) */}
                <g pointerEvents="none">
                  {layout.labels.map(({ s, x, y, fs, anchor }) => {
                    const sel = s.name === selected;
                    const other = focusFam !== null && s.family !== focusFam && !partnerSet.has(s.name);
                    return (
                      <text key={s.name} x={x} y={y} textAnchor={anchor} fontSize={fs} fontFamily={m.tagFont} fontWeight={s.atom || sel ? 600 : 400}
                        fill={sel ? INK.ring : partnerSet.has(s.name) ? INK.pipe : s.atom ? INK.name : INK.nameSoft} opacity={other ? 0.5 : 1}
                        style={{ paintOrder: "stroke", stroke: INK.outline, strokeWidth: TYPE.outline, strokeLinejoin: "miter" }}>
                        {displayName(s.name)}
                      </text>
                    );
                  })}
                </g>
                {/* hit targets */}
                {stars.map((s) => {
                  const p = scr(s);
                  return (
                    <circle key={s.name} cx={p.x} cy={p.y} r={s.atom ? 14 : 11} fill="transparent" className="cursor-pointer outline-none" role="button" tabIndex={0}
                      aria-label={`${displayName(s.name)}: ${s.state}`}
                      onClick={(ev) => { ev.stopPropagation(); if (!camDragged.current) onSelect(s.name); }}
                      onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onSelect(s.name); } }}
                      onPointerEnter={() => setHovered(s.name)} onPointerLeave={() => setHovered(null)} onFocus={() => setHovered(s.name)} onBlur={() => setHovered(null)}>
                      <title>{partnerSet.has(s.name) ? `${displayName(s.name)}: ${partners.find((p) => p.name === s.name)!.via.map(displayName).join(", ")}` : displayName(s.name)}</title>
                    </circle>
                  );
                })}
              </svg>
              {/* the night signs: one per nebula, at its top-left */}
              {!uiHidden && layout.plaques.map(({ f, x, y }) => (
                <div key={f} className="absolute z-10" style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
                  <Plaque family={f} count={famCount[f] ?? 0} compact={mobile} latin={regionish && !mobile}
                    dimmed={focusFam !== null && f !== focusFam}
                    onClick={() => { if (!camDragged.current) jumpLand(f as Family); }} />
                </div>
              ))}
              {!uiHidden && layout.chevrons.map((c) => <Chevron key={c.name} {...c} compact={mobile} onPick={() => onSelect(c.name)} />)}
            </>
          )}
        </div>

        {uiHidden && <ShowUi onShow={() => setUiHidden(false)} />}
        {!uiHidden && (
          <div ref={corners.refFor("frame", false)} className="pointer-events-none absolute inset-0 z-20" style={{ right: drawerPx, bottom: sheetPx }}>
            {/* every corner plate registers its rect, so layout.ts keeps words out from under it */}
            <div ref={corners.refFor("cartouche")} className={`${corner} left-3 top-3 sm:left-5 sm:top-5`}>
              <Cartouche m={m} title="The Celestial Zoo" noun="nebulae" counts={counts} names={names} focusFam={focusFam} famCount={famCount} famProven={famProven}
                onPick={onSelect} onWhole={fitWhole} compact={mobile} />
            </div>
            <div ref={corners.refFor("tabs")} className={`${corner} right-3 top-0 sm:right-5`}>
              <NightTabs compact={mobile} dayHref={DAY_HREF} onHideUi={() => setUiHidden(true)} />
            </div>
            {/* the compass stands on the scale bar; scale bar + legend share the bottom margin (corners/plate.tsx) */}
            <div className={`${corner} bottom-3 left-3 flex flex-col items-start gap-3 sm:bottom-5 sm:left-5`}>
              <div ref={corners.refFor("compass")}>
                <Compass m={m} unit={mobile ? 3.5 : 5} onPan={panBy} onWhole={fitWhole} onZoom={stepZoom}
                  canIn={camBox.w > minW + 1} canOut={camBox.w < maxW - 1} whole={whole} />
              </div>
              {!mobile && (
                <div ref={corners.refFor("scale")}>
                  <ScaleBar m={m} names={names} family={family} states={states} atoms={atoms} pipelines={pipelines} counts={counts}
                    selected={selected} onPick={onSelect} onLand={jumpLand} focusFam={focusFam} />
                </div>
              )}
            </div>
            {!mobile && !drawerPx && (
              <div ref={corners.refFor("legend")} className={`${corner} bottom-3 right-3 sm:bottom-5 sm:right-5`}>
                <CornerPlate m={m} face="legend" world={{ w: wb.w, h: wb.h }} box={camBox} source={{ img: "", pixelated: true }} onCenter={() => {}}
                  glyph={(s) => <StarPair state={s} />}
                  note="Each nebula is a family. A line runs from a parent star to a model built on it, brightest near the stars; comets run along it, parent to child." />
              </div>
            )}
          </div>
        )}

        {card && !uiHidden && (
          <Drawer m={m} mobile={mobile} sheet={sheet === "peek" ? "half" : sheet} setSheet={setSheet} card={card} still={still}
            onPick={onSelect} onBack={fitWhole}
            stateOf={(n) => states[n] ?? "untrained"} isAtom={(n) => atoms.has(n)}
            fullDiagram={fullDiagram} setFullDiagram={setFullDiagram} stageW={vp.w} />
        )}
      </div>
    </LabMotion>
  );
}

