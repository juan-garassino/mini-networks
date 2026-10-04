"use client";

// Skin "sky": the Celestial Zoo — an antique star atlas of the model zoo.
// Positions come ONLY from lib/world: every model is a star at its node's
// centre, every family a constellation over its region box, with a figure
// threaded through its stars (figures.ts). Lineage edges are the constellation
// lines; a selected model's pipelines appear as dotted arcs. The chrome is the
// painted maps' four corners in the night material (one UI, three materials).
// /lab contract: URL view → useWorld → camera → paint → data-lab-ready → window.__lab.
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { WorldNode } from "@/lib/world";
import { useWorld } from "@/hooks/use-world";
import { useLabView, type LabView } from "@/components/lab/shared/url-state";
import { LabMotion } from "@/components/lab/shared/still";
import { useCamera, type CamBox } from "@/components/lab/shared/camera";
import { cardModel, displayName, evidenceState, type EvidenceState } from "@/components/lab/shared/card-model";
import { FAMILIES, type Family } from "@/components/lab/painted/anchors";
import { MATERIALS } from "@/components/lab/painted/material";
import { Cartouche } from "@/components/lab/painted/corners/cartouche";
import { Compass } from "@/components/lab/painted/corners/compass";
import { ScaleBar } from "@/components/lab/painted/corners/scale-bar";
import { CornerPlate } from "@/components/lab/painted/corners/corner-plate";
import { plateStyle } from "@/components/lab/painted/corners/plate";
import { Drawer, DRAWER_W, sheetHeight, type Sheet } from "@/components/lab/painted/drawer";
import { CONSTELLATION, figureFor, fieldStars, starPath, type Figure } from "./figures";
import { SkyLife } from "./life";

const m = MATERIALS.sky;
const MOBILE_BP = 640;
// the plate's inks: a softened engraving gold on indigo, cream for star names,
// a pastel sea-glass for pipelines (the old #7fd3c7 teal shouted over the gold)
const GOLD = "#e3c27a", GOLD_DIM = "#8a7a4a", CREAM = "#f2e8c9", AQUA = "#b4dcd3", FIGURE = "#c9a85a";
const PAD = 1400; // world px of sky painted around the continent
const FIELD = fieldStars(1100, 7);
const TWINKLE_EVERY = 9; // every 9th field star scintillates (≈120 stars)
const NEAT = 150; // world px between the continent and the plate's neatline
const TICK = 64; // the neatline's graduation: one tick per 4 lib/world tiles (16 px)

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
type Box = { x: number; y: number; w: number; h: number };
const union = (bs: Box[]): Box => {
  const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y));
  return { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x, h: Math.max(...bs.map((b) => b.y + b.h)) - y };
};
const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Fit `b` (world) into the screen rect left by the insets (css px), return the camera box for the whole vw×vh viewport. */
function fitInto(b: Box, vw: number, vh: number, ins: { t: number; r: number; b: number; l: number }, visW: number, visH: number): Box {
  const aw = Math.max(80, visW - ins.l - ins.r), ah = Math.max(80, visH - ins.t - ins.b);
  const s = Math.min(aw / Math.max(1, b.w), ah / Math.max(1, b.h));
  const x = b.x + b.w / 2 - (ins.l + aw / 2) / s, y = b.y + b.h / 2 - (ins.t + ah / 2) / s;
  return { x, y, w: vw / s, h: vh / s };
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

/** The star for one model: glyph by evidence, size by atom-ness, in SCREEN px (÷ S). */
function Star({ n, state, S, lit, selected, hovered, onSelect, onHover }: {
  n: WorldNode; state: EvidenceState; S: number; lit: boolean; selected: boolean; hovered: boolean;
  onSelect: (n: string) => void; onHover: (n: string | null) => void;
}) {
  const base = n.atom ? 7 : 4.5;
  const r = (base + (selected ? 2 : 0)) / S;
  const e = m.evidence[state];
  const glyph =
    state === "champion" ? <g><path d={starPath(8, r, 0.42)} fill={e.fill} stroke={e.stroke} strokeWidth={0.6 / S} /><circle r={r * 0.26} fill="#fff7dc" /></g>
    : state === "trained" ? <path d={starPath(4, r * 1.05, 0.38)} fill={e.fill} stroke={e.stroke} strokeWidth={0.6 / S} />
    : state === "provisional" ? <circle r={r * 0.7} fill="none" stroke={e.stroke} strokeWidth={1.2 / S} strokeDasharray={`${2 / S} ${1.5 / S}`} />
    : <circle r={r * 0.5} fill={e.fill} />;
  return (
    <g transform={`translate(${n.center.x} ${n.center.y})`}>
      {(n.atom || state === "champion") && <circle r={r * 2.6} fill="url(#sky-halo)" opacity={lit ? 0.9 : 0.55} />}
      {glyph}
      {(selected || hovered) && <circle r={r * 1.9} fill="none" stroke={m.ring} strokeWidth={(selected ? 1.4 : 0.8) / S} strokeDasharray={hovered && !selected ? `${3 / S} ${2 / S}` : undefined} />}
      <circle r={Math.max(10, 16 / S)} fill="transparent" className="cursor-pointer outline-none" role="button" tabIndex={0}
        aria-label={`${displayName(n.name)}: ${state}`}
        onClick={(ev) => { ev.stopPropagation(); onSelect(n.name); }}
        onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onSelect(n.name); } }}
        onPointerEnter={() => onHover(n.name)} onPointerLeave={() => onHover(null)} onFocus={() => onHover(n.name)} onBlur={() => onHover(null)} />
    </g>
  );
}

export function SkySkin() {
  const { view, update } = useLabView();
  const still = view?.still ?? true;
  const { world, taxonomy, evidence, runs, family, ready } = useWorld(view ? view.still : null);
  const winW = useWindowW();
  const mobile = winW < MOBILE_BP;
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

  // ——— data
  const nodes = useMemo(() => world?.nodes ?? [], [world]);
  const byName = useMemo(() => new Map(nodes.map((n) => [n.name, n])), [nodes]);
  const names = useMemo(() => nodes.map((n) => n.name), [nodes]);
  const atoms = useMemo(() => new Set(nodes.filter((n) => n.atom).map((n) => n.name)), [nodes]);
  const states = useMemo(() => {
    const out: Record<string, EvidenceState> = {};
    for (const n of names) out[n] = evidenceState(evidence.find((e) => e.name === n));
    return out;
  }, [names, evidence]);
  const famCount = useMemo(() => { const c: Record<string, number> = {}; for (const n of nodes) c[n.family] = (c[n.family] ?? 0) + 1; return c; }, [nodes]);
  const famProven = useMemo(() => { const c: Record<string, number> = {}; for (const n of nodes) if (states[n.name] === "champion") c[n.family] = (c[n.family] ?? 0) + 1; return c; }, [nodes, states]);
  const pipelines = useMemo(() => taxonomy?.compositions.map((c) => c.name) ?? [], [taxonomy]);
  const counts = useMemo(() => ({
    models: names.length, pipelines: pipelines.length,
    champions: Object.values(states).filter((s) => s === "champion").length, lands: Object.keys(famCount).length,
  }), [names, pipelines, states, famCount]);

  const selectedNode = view?.zoom === "node" && view.focus ? byName.get(view.focus) ?? null : null;
  const selected = selectedNode?.name ?? null;
  const focusNode = (view?.zoom === "region" || view?.zoom === "node") && view.focus ? byName.get(view.focus) ?? null : null;
  const focusFam = (focusNode?.family as Family | undefined) ?? null;
  const lineageSet = useMemo(() => {
    const s = new Set<string>();
    if (!selected) return s;
    const walk = (n: string) => { if (s.has(n)) return; s.add(n); (byName.get(n)?.parents ?? []).forEach(walk); };
    walk(selected);
    return s;
  }, [selected, byName]);
  // the selected star's pipelines: one arc to each partner star (deduped), named by its pipelines
  const arcs = useMemo(() => {
    const sel = selected ? byName.get(selected) : undefined;
    if (!sel || !taxonomy) return [];
    const by = new Map<string, string[]>();
    for (const c of taxonomy.compositions) {
      if (!c.composes.includes(sel.name)) continue;
      for (const x of c.composes) if (x !== sel.name && byName.has(x)) by.set(x, [...(by.get(x) ?? []), c.name]);
    }
    return [...by.entries()].map(([to, via]) => ({ to, via, a: sel.center, b: byName.get(to)!.center }));
  }, [selected, taxonomy, byName]);
  const partners = useMemo(() => new Set(arcs.map((a) => a.to)), [arcs]);

  // ——— the engraved figures, threaded through each family's actual stars
  const figures = useMemo(() => {
    const out: Partial<Record<Family, Figure>> = {};
    for (const f of FAMILIES) {
      const fig = figureFor(f, nodes.filter((n) => n.family === f).map((n) => ({ x: n.center.x, y: n.center.y, atom: n.atom, depth: n.depth })));
      if (fig) out[f] = fig;
    }
    return out;
  }, [nodes]);
  const plate = useMemo(() => {
    const boxes = Object.values(figures).map((f) => f!.box);
    return boxes.length ? union(boxes) : null;
  }, [figures]);

  // ——— camera (world px); the drawer / sheet cover part of the viewport, so
  // the target box is widened / heightened to keep its content in the visible part
  const [vp, setVp] = useState({ w: 1, h: 1 });
  const [manual, setManual] = useState<CamBox | null>(null);
  const sheetPx = mobile && selected ? sheetHeight(sheet === "peek" ? "half" : sheet, vp.h) : 0;
  const drawerPx = !mobile && selected && !fullDiagram ? DRAWER_W : 0;
  const visW = Math.max(160, vp.w - drawerPx), visH = Math.max(120, vp.h - sheetPx);
  const worldBox: CamBox = world?.camera.world ?? { x: 0, y: 0, w: 1600, h: 1000 };
  const target: CamBox = useMemo(() => {
    if (!world || !view) return worldBox;
    // the content is fitted into the screen rect the corner plates leave free
    // (css px), then the box is extended over the drawer / sheet
    const ins = mobile ? { t: 150, r: 14, b: 130, l: 14 } : { t: 96, r: 70, b: 190, l: 70 };
    // the whole plate: every figure, plus room for the names under the lowest ones
    let b: CamBox = plate ? { ...plate, h: plate.h + 70 } : worldBox;
    const node = view.focus ? byName.get(view.focus) : undefined;
    const fig = node ? figures[node.family as Family] : undefined;
    // a star is seen in its constellation: the figure, a little tighter, centred on the star
    if (view.zoom === "node" && node) {
      // the whole figure (and the star, should it sit outside it), with room for the name below
      const fb = fig?.box ?? { x: node.center.x - 200, y: node.center.y - 150, w: 400, h: 300 };
      b = union([{ ...fb, h: fb.h + 60 }, { x: node.center.x - 80, y: node.center.y - 80, w: 160, h: 160 }]);
    } else if (view.zoom === "region" && fig) b = { ...fig.box, h: fig.box.h + 60 };
    return fitInto(b, vp.w, vp.h, view.zoom === "overview" ? ins : { ...ins, t: mobile ? ins.t : 60, b: mobile ? ins.b : 200 }, visW, visH);
  }, [world, view, byName, worldBox, visW, visH, vp.w, vp.h, mobile, plate, figures]);
  useEffect(() => { setManual(null); }, [view?.zoom, view?.focus, vp.w, vp.h, drawerPx]);
  const camClamp = useMemo(() => ({ right: drawerPx, bottom: sheetPx }), [drawerPx, sheetPx]);
  const skyBox = useMemo(() => ({ x: worldBox.x - PAD, y: worldBox.y - PAD, w: worldBox.w + 2 * PAD, h: worldBox.h + 2 * PAD }), [worldBox]);
  const cam = useCamera({ world: skyBox, target: manual ?? target, still, targetViewport: vp, minWidth: 120, clamp: camClamp });
  useEffect(() => { if (cam.size.w !== vp.w || cam.size.h !== vp.h) setVp({ w: cam.size.w, h: cam.size.h }); }, [cam.size.w, cam.size.h, vp.w, vp.h]);
  const S = vp.w / cam.box.w; // screen px per world px
  const minW = worldBox.w * 0.08, maxW = worldBox.w * 1.4;
  const zoomTo = (w: number, fx = 0.5, fy = 0.5) => {
    const b = cam.box;
    w = clamp(w, minW, maxW);
    const h = w * (b.h / b.w);
    setManual({ x: b.x + (b.w - w) * fx, y: b.y + (b.h - h) * fy, w, h });
  };
  const stepZoom = (dir: 1 | -1) => zoomTo(cam.box.w / (dir > 0 ? 1.6 : 1 / 1.6));
  const onWheel = (e: React.WheelEvent) => {
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    zoomTo(cam.box.w * Math.exp(e.deltaY * 0.0015), (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
  };
  const panBy = (dx: number, dy: number) => {
    const b = cam.box;
    setManual({ ...b, x: clamp(b.x + dx * b.w, skyBox.x, skyBox.x + skyBox.w - b.w), y: clamp(b.y + dy * b.h, skyBox.y, skyBox.y + skyBox.h - b.h) });
  };
  const fitWhole = () => { setManual(null); update({ zoom: "overview", focus: null }); };
  const jumpLand = (f: Family) => {
    const first = nodes.filter((n) => n.family === f).sort((a, b) => Number(b.atom) - Number(a.atom))[0];
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

  const card = useMemo(() => (selectedNode && taxonomy ? cardModel(selectedNode.name, { taxonomy, evidence, runs, family: selectedNode.family, depth: selectedNode.depth }) : null), [selectedNode, taxonomy, evidence, runs]);

  // ——— ready + hooks
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    setDrawn(false);
    if (!ready || !world || vp.w <= 1) return;
    const id = requestAnimationFrame(() => setDrawn(true));
    const t = setTimeout(() => setDrawn(true), 250);
    return () => { cancelAnimationFrame(id); clearTimeout(t); };
  }, [ready, world, vp.w]);
  useEffect(() => {
    if (!drawn) return;
    const w = window as unknown as { __lab?: unknown };
    w.__lab = { select: (n: string) => onSelect(n), view: (v: { zoom: LabView["zoom"]; focus?: string }) => update({ zoom: v.zoom, focus: v.focus ?? null }) };
    return () => { delete w.__lab; };
  }, [drawn, onSelect, update]);

  // ——— which derived names show
  const zoomedIn = world ? cam.box.w < worldBox.w * 0.7 : false;
  const showName = (n: WorldNode) => n.atom || n.name === selected || n.name === hovered || lineageSet.has(n.name) || partners.has(n.name) || (focusFam ? n.family === focusFam : zoomedIn);

  const whole = !manual && (view?.zoom ?? "overview") === "overview";
  const corner = "pointer-events-auto absolute z-20";
  const hair = 1 / S;
  // type sizes in SCREEN px: world-proportional when the plate is small (phone), capped like an atlas
  const nameL = clamp(S * 30, 11, 18), glossL = nameL * 0.74;
  const showGloss = nameL >= 13;
  const atomFs = clamp(S * 24, 11, 15), derivedFs = clamp(S * 20, 10, 13);

  // constellation names: centred under the figure; when two would collide (or a
  // name would sit on a corner plate's star), the later one tries above, then nudges
  const labels = useMemo(() => {
    const out: Partial<Record<Family, { x: number; y: number }>> = {};
    // the stars are obstacles too: a name never sits on a star
    const placed: Box[] = nodes.map((n) => ({ x: n.center.x - 7 / S, y: n.center.y - 7 / S, w: 14 / S, h: 14 / S }));
    // and so are the atoms' names, which always show (centred, under the star)
    for (const n of nodes) if (n.atom) {
      const w = displayName(n.name).length * atomFs * 0.48 / S;
      placed.push({ x: n.center.x - w / 2, y: n.center.y + 12 / S, w, h: atomFs * 1.3 / S });
    }
    const order = [...FAMILIES].sort((p, q) => (famCount[q] ?? 0) - (famCount[p] ?? 0));
    for (const f of order) {
      const fig = figures[f];
      if (!fig) continue;
      const c = CONSTELLATION[f];
      const w = Math.max(c.latin.length * nameL * 0.86, showGloss ? (c.gloss.length + 9) * glossL * 0.48 : 0) / S;
      const h = (nameL + (showGloss ? glossL + 4 : 0)) / S;
      const cx = fig.box.x + fig.box.w / 2;
      const gap = 18 / S;
      const cands = [
        { x: cx, y: fig.box.y + fig.box.h + gap },
        { x: cx, y: fig.box.y - gap - h },
        { x: cx - w * 0.6, y: fig.box.y + fig.box.h + gap },
        { x: cx + w * 0.6, y: fig.box.y + fig.box.h + gap },
        { x: cx, y: fig.box.y + fig.box.h + gap + h * 1.2 },
        { x: cx - w * 0.6, y: fig.box.y - gap - h },
        { x: cx + w * 0.6, y: fig.box.y - gap - h },
      ];
      const pick = cands.find((p) => !placed.some((q) => hit({ x: p.x - w / 2, y: p.y, w, h }, q))) ?? cands[0];
      placed.push({ x: pick.x - w / 2, y: pick.y, w, h });
      out[f] = pick;
    }
    return out;
  }, [figures, famCount, nameL, glossL, showGloss, S, nodes, atomFs]);

  // ——— the plate furniture (decoration + the tile graduation), in world px
  const neat = useMemo(() => (plate ? { x: plate.x - NEAT, y: plate.y - NEAT, w: plate.w + 2 * NEAT, h: plate.h + 2 * NEAT + 60 } : null), [plate]);
  const graticule = useMemo(() => {
    if (!neat) return { par: [] as string[], mer: [] as string[] };
    // a conic projection: the pole far above the plate, parallels as arcs, meridians as rays
    const pole = { x: neat.x + neat.w / 2, y: neat.y - neat.h * 1.4 };
    const r0 = neat.y - pole.y, r1 = Math.hypot(neat.w / 2, neat.y + neat.h - pole.y);
    const par: string[] = [];
    for (let r = r0 + 170; r < r1; r += 170) par.push(`M${pole.x - r} ${pole.y}A${r} ${r} 0 0 0 ${pole.x + r} ${pole.y}`);
    const mer: string[] = [];
    const span = Math.atan2(neat.w / 2, neat.y + neat.h - pole.y) + 0.05;
    for (let a = -span; a <= span + 1e-6; a += span / 6) mer.push(`M${pole.x + Math.sin(a) * r0} ${pole.y + Math.cos(a) * r0}L${pole.x + Math.sin(a) * r1 * 1.1} ${pole.y + Math.cos(a) * r1 * 1.1}`);
    return { par, mer };
  }, [neat]);
  const ecliptic = useMemo(() => {
    if (!neat) return { d: "", ticks: "", at: { x: 0, y: 0 } };
    const y0 = neat.y + neat.h * 0.52, A = neat.h * 0.16, per = neat.w * 1.1;
    const pts: { x: number; y: number }[] = [];
    for (let x = neat.x; x <= neat.x + neat.w + 1; x += 16) pts.push({ x, y: y0 - A * Math.sin(((x - neat.x) / per) * Math.PI * 2) });
    let ticks = "";
    pts.forEach((p, i) => { if (i % 2 === 0) { const L = i % 10 === 0 ? 9 : 4; ticks += `M${p.x} ${p.y - L}L${p.x} ${p.y + L}`; } });
    return { d: `M${pts.map((p) => `${p.x} ${p.y}`).join("L")}`, ticks, at: pts[Math.floor(pts.length * 0.08)] };
  }, [neat]);
  const field = useMemo(() => FIELD.map((f) => ({ x: skyBox.x + f.x * skyBox.w, y: skyBox.y + f.y * skyBox.h, r: f.r, a: f.a * 0.6 })), [skyBox]);
  const fieldStill = useMemo(() => field.filter((_, i) => i % TWINKLE_EVERY !== 0), [field]);
  const fieldLive = useMemo(() => field.filter((_, i) => i % TWINKLE_EVERY === 0), [field]);

  return (
    <LabMotion still={still}>
      <div data-lab-ready={drawn ? "1" : undefined} className="relative h-full w-full select-none overflow-hidden"
        style={{ background: m.sea, ["--ap" as string]: "2px" } as CSSProperties}>
        <div ref={cam.ref} {...cam.handlers} onWheel={onWheel}
          onClick={() => { if (!cam.dragged.current && (view?.zoom ?? "overview") !== "overview") fitWhole(); }} className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing">
          {world && (
            <svg viewBox={cam.viewBox} className="block h-full w-full" role="group" aria-label="The Celestial Zoo: a star atlas of the models">
              <defs>
                <radialGradient id="sky-halo"><stop offset="0" stopColor={GOLD} stopOpacity="0.32" /><stop offset="1" stopColor={GOLD} stopOpacity="0" /></radialGradient>
                <radialGradient id="sky-dust" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#8fa3d9" stopOpacity="0.13" /><stop offset="1" stopColor="#8fa3d9" stopOpacity="0" /></radialGradient>
                <linearGradient id="sky-meteor"><stop offset="0" stopColor={CREAM} stopOpacity="0" /><stop offset="1" stopColor={CREAM} stopOpacity="0.95" /></linearGradient>
                {/* engraver's hatching, sized in screen px */}
                <pattern id="sky-hatch" patternUnits="userSpaceOnUse" width={4.5 * hair} height={4.5 * hair} patternTransform="rotate(38)">
                  <line x1={0} y1={0} x2={0} y2={4.5 * hair} stroke={FIGURE} strokeWidth={0.7 * hair} />
                </pattern>
                {neat && <clipPath id="sky-neat"><rect x={neat.x} y={neat.y} width={neat.w} height={neat.h} /></clipPath>}
              </defs>
              {/* the night: dust, field stars, and the plate's engraved furniture */}
              <g pointerEvents="none">
                <ellipse cx={worldBox.x + worldBox.w * 0.55} cy={worldBox.y + worldBox.h * 0.45} rx={worldBox.w * 1.1} ry={worldBox.h * 0.28} fill="url(#sky-dust)" transform={`rotate(-18 ${worldBox.x + worldBox.w * 0.55} ${worldBox.y + worldBox.h * 0.45})`} />
                {fieldStill.map((f, i) => <circle key={i} cx={f.x} cy={f.y} r={f.r / Math.sqrt(S)} fill={CREAM} opacity={f.a} />)}
                {neat && (
                  <g clipPath="url(#sky-neat)" fill="none" stroke={GOLD} strokeWidth={0.6 * hair}>
                    <g opacity={0.13}>{graticule.par.map((d, i) => <path key={`p${i}`} d={d} />)}{graticule.mer.map((d, i) => <path key={`m${i}`} d={d} />)}</g>
                    <g opacity={0.3}>
                      <path d={ecliptic.d} strokeWidth={0.9 * hair} />
                      <path d={ecliptic.ticks} strokeWidth={0.6 * hair} />
                    </g>
                  </g>
                )}
                {neat && (
                  <text x={ecliptic.at.x} y={ecliptic.at.y - 14 * hair} fontFamily={m.bodyFont} fontStyle="italic" fontSize={clamp(S * 20, 10, 13) * hair} fill={GOLD} opacity={0.5}>Ecliptica</text>
                )}
                {neat && (
                  <g fill="none" stroke={GOLD}>
                    {/* the neatline: a double rule, graduated every 4 tiles */}
                    <rect x={neat.x} y={neat.y} width={neat.w} height={neat.h} strokeWidth={1.4 * hair} opacity={0.55} />
                    <rect x={neat.x - 10 * hair} y={neat.y - 10 * hair} width={neat.w + 20 * hair} height={neat.h + 20 * hair} strokeWidth={0.6 * hair} opacity={0.45} />
                    <path opacity={0.45} strokeWidth={0.6 * hair} d={(() => {
                      let d = "";
                      for (let x = Math.ceil(neat.x / TICK) * TICK; x <= neat.x + neat.w; x += TICK) { const L = (x / TICK) % 4 === 0 ? 10 : 5; d += `M${x} ${neat.y}l0 ${-L * hair}M${x} ${neat.y + neat.h}l0 ${L * hair}`; }
                      for (let y = Math.ceil(neat.y / TICK) * TICK; y <= neat.y + neat.h; y += TICK) { const L = (y / TICK) % 4 === 0 ? 10 : 5; d += `M${neat.x} ${y}l${-L * hair} 0M${neat.x + neat.w} ${y}l${L * hair} 0`; }
                      return d;
                    })()} />
                  </g>
                )}
              </g>
              <SkyLife stars={fieldLive} box={neat ?? worldBox} S={S} color={CREAM} still={still} />
              {/* constellations: figure + name + lines + stars, per family (dimmed when another is focused) */}
              {FAMILIES.map((f) => {
                const fig = figures[f];
                const lab = labels[f];
                const dim = focusFam !== null && f !== focusFam;
                const fam = nodes.filter((n) => n.family === f);
                const c = CONSTELLATION[f];
                return (
                  <g key={f} opacity={dim ? 0.3 : 1} style={{ transition: still ? undefined : "opacity 300ms" }}>
                    {fig && (
                      <g pointerEvents="none" fill="none" stroke={FIGURE} strokeLinecap="round" strokeLinejoin="round">
                        {fig.hatch.map((d, i) => <path key={`h${i}`} d={d} fill="url(#sky-hatch)" stroke="none" opacity={0.42} />)}
                        {/* the body as an engraved double rule: a gold band with an indigo core */}
                        {fig.body.map((d, i) => (
                          <g key={`b${i}`}>
                            <path d={d} strokeWidth={3.6 * hair} opacity={0.5} />
                            <path d={d} stroke={m.sea} strokeWidth={1.5 * hair} />
                          </g>
                        ))}
                        {fig.detail.map((d, i) => <path key={`d${i}`} d={d} strokeWidth={0.8 * hair} opacity={0.5} />)}
                      </g>
                    )}
                    {lab && (
                      <text x={lab.x} y={lab.y + nameL * 0.82 * hair} textAnchor="middle" pointerEvents="none" fill={GOLD}
                        style={{ paintOrder: "stroke", stroke: m.sea, strokeWidth: 4 * hair, strokeLinejoin: "round" }}>
                        <tspan fontFamily={m.signFont} fontSize={nameL * hair} letterSpacing={nameL * 0.2 * hair}>{c.latin.toUpperCase()}</tspan>
                        {showGloss && (
                          <tspan x={lab.x} dy={(glossL + 4) * hair} fontFamily={m.bodyFont} fontStyle="italic" fontSize={glossL * hair} fill={m.inkSoft}>
                            {c.gloss}, {famCount[f] ?? 0} {famCount[f] === 1 ? "star" : "stars"}
                          </tspan>
                        )}
                      </text>
                    )}
                    {/* same-family lineage lines */}
                    {world.roads.filter((r) => r.kind !== "bridge" && byName.get(r.to)?.family === f).map((r) => {
                      const a = byName.get(r.from), b = byName.get(r.to);
                      if (!a || !b) return null;
                      const lit = lineageSet.has(r.to) && lineageSet.has(r.from);
                      return <line key={r.id} x1={a.center.x} y1={a.center.y} x2={b.center.x} y2={b.center.y}
                        stroke={lit ? m.ring : CREAM} strokeWidth={(lit ? 1.6 : 0.8) * hair} opacity={lit ? 1 : r.primary ? 0.55 : 0.28} pointerEvents="none" />;
                    })}
                    {fam.map((n) => (
                      <Star key={n.name} n={n} state={states[n.name] ?? "untrained"} S={S} lit={lineageSet.has(n.name) || n.name === hovered}
                        selected={n.name === selected} hovered={n.name === hovered} onSelect={onSelect} onHover={setHovered} />
                    ))}
                    {fam.filter(showName).map((n) => {
                      const sel = n.name === selected;
                      // clear of the selection ring (r × 1.9) and of the glyph otherwise
                      const off = sel ? (n.atom ? 9 : 6.5) * 1.9 + 13 : n.atom ? 20 : 15;
                      const fs = n.atom ? atomFs : derivedFs;
                      return (
                        <text key={`l-${n.name}`} x={n.center.x} y={n.center.y + (off + fs * 0.4) * hair} textAnchor="middle" pointerEvents="none"
                          fontSize={fs * hair} fontFamily={m.bodyFont} fontStyle={n.atom ? "italic" : undefined} fontWeight={n.atom ? 500 : undefined} fill={sel ? m.ring : partners.has(n.name) ? AQUA : CREAM}
                          opacity={n.atom || sel || n.name === hovered || partners.has(n.name) ? 1 : 0.82}
                          style={{ paintOrder: "stroke", stroke: m.sea, strokeWidth: 3.2 * hair, strokeLinejoin: "round" }}>
                          {displayName(n.name)}
                        </text>
                      );
                    })}
                  </g>
                );
              })}
              {/* cross-family lines: dashed, faint, brighter on the selected lineage */}
              <g pointerEvents="none">
                {world.roads.filter((r) => r.kind === "bridge").map((r) => {
                  const a = byName.get(r.from), b = byName.get(r.to);
                  if (!a || !b) return null;
                  const lit = lineageSet.has(r.to) && lineageSet.has(r.from);
                  const touches = focusFam === null || a.family === focusFam || b.family === focusFam;
                  return <line key={r.id} x1={a.center.x} y1={a.center.y} x2={b.center.x} y2={b.center.y}
                    stroke={lit ? m.ring : GOLD_DIM} strokeWidth={(lit ? 1.4 : 0.7) * hair} strokeDasharray={`${3 * hair} ${4 * hair}`} opacity={lit ? 1 : touches ? 0.45 : 0.15} />;
                })}
                {/* the selected star's pipelines: one dotted arc per partner star, bowed to one side */}
                {arcs.map((a) => {
                  const dx = a.b.x - a.a.x, dy = a.b.y - a.a.y, L = Math.hypot(dx, dy) || 1;
                  const k = Math.min(0.22, 90 / L);
                  const cx = (a.a.x + a.b.x) / 2 - dy * k, cy = (a.a.y + a.b.y) / 2 + dx * k;
                  return (
                    <path key={a.to} d={`M${a.a.x} ${a.a.y} Q${cx} ${cy} ${a.b.x} ${a.b.y}`} fill="none" stroke={AQUA} strokeWidth={1.1 * hair}
                      strokeDasharray={`${0.1 * hair} ${5 * hair}`} strokeLinecap="round" opacity={0.75}>
                      <title>{a.via.map(displayName).join(", ")}</title>
                    </path>
                  );
                })}
              </g>
            </svg>
          )}
        </div>

        {uiHidden && (
          <button type="button" onClick={() => setUiHidden(false)} aria-label="Show the UI (h)" title="Show the UI (h)"
            className="absolute right-3 top-3 z-20 px-2.5 py-1 leading-none opacity-50 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 sm:right-5 sm:top-5"
            style={{ ...plateStyle(m, { shadow: false }), fontFamily: m.bodyFont, fontSize: 14 }}>UI</button>
        )}
        {!uiHidden && (
          <div className="pointer-events-none absolute inset-0 z-20" style={{ right: drawerPx, bottom: sheetPx }}>
            <div className={`${corner} left-3 top-3 sm:left-5 sm:top-5`}>
              <Cartouche m={m} title="The Celestial Zoo" noun="constellations" counts={counts} names={names} focusFam={focusFam} famCount={famCount} famProven={famProven}
                onPick={onSelect} onWhole={fitWhole} compact={mobile} />
            </div>
            <div className={`${corner} right-3 top-0 flex items-start gap-1.5 sm:right-5`}>
              <a href="/lab/painted/" className="px-3 pb-2 pt-2 leading-none focus-visible:outline-2" style={{ ...plateStyle(m), borderTop: "none", fontFamily: m.bodyFont, fontSize: 14, textDecoration: "none" }}>day map</a>
              <button type="button" onClick={() => setUiHidden(true)} aria-label="Sky only: hide the UI (h)" title="Sky only (h)"
                className="px-3 pb-2 pt-2 leading-none focus-visible:outline-2" style={{ ...plateStyle(m), borderTop: "none", fontFamily: m.bodyFont, fontSize: 14 }}>sky only</button>
            </div>
            <div className={`${corner} bottom-3 left-3 flex flex-col items-start gap-3 sm:bottom-5 sm:left-5`}>
              {!mobile && (
                <ScaleBar m={m} names={names} family={family} states={states} atoms={atoms} pipelines={pipelines} counts={counts}
                  selected={selected} onPick={onSelect} onLand={jumpLand} focusFam={focusFam} />
              )}
              <Compass m={m} unit={mobile ? 3.5 : 5} onPan={panBy} onWhole={fitWhole} onZoom={stepZoom}
                canIn={cam.box.w > minW + 1} canOut={cam.box.w < maxW - 1} whole={whole} />
            </div>
            {!mobile && (
              <div className={`${corner} bottom-3 right-3 sm:bottom-5 sm:right-5`}>
                <CornerPlate m={m} face="legend" world={{ w: worldBox.w, h: worldBox.h }} box={cam.box} source={{ img: "", pixelated: false }} onCenter={() => {}}
                  note="The brightest stars are the atoms; the lines run from a parent to the models built on it." />
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

