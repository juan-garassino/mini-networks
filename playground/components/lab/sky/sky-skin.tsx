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
//   the chrome  the painted maps' four corners + drawer in the night material,
//               with Day | Night tabs where the day map has Pixel | Paper
//
// Positions come ONLY from lib/world. On a portrait phone the whole chart is
// turned a quarter (frame coords), so the landscape zoo fills a tall screen.
// /lab contract: URL view → useWorld → camera → paint → data-lab-ready → window.__lab.
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
import { bakeSky, ghostBake, type Bake } from "./bake";
import { FAMILY_INK, FIELD, GOLD, GREY, INK, LILAC, MINT } from "./palette";
import { Pix, arcPixels, asterism, dim, mix, stamp } from "./paint";
import { CONSTELLATION, ringOffsets, starRadius, starSprite } from "./sprites";
import { FPS, LOOP, comet, glint, meteor, twinkle } from "./motion";
import { StarPair } from "./icon";
import { Plaque } from "./specimen";

const m = MATERIALS.sky;
const MOBILE_BP = 640;
const AP = 2;        // css px per art px (the marks' grid; 4 device px on a retina screen)
const PAD = 900;     // frame px of sky baked around the zoo
const NEB = 96;      // frame px of nebula beyond a family's outermost stars
// the plaque's second line ("Serpens, the Serpent"), in characters, for its width
const CONSTELLATION_W: Record<string, number> = Object.fromEntries(Object.entries(CONSTELLATION).map(([f, c]) => [f, c.latin.length + c.gloss.length + 2]));

type Box = { x: number; y: number; w: number; h: number };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const union = (bs: Box[]): Box => {
  const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y));
  return { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x, h: Math.max(...bs.map((b) => b.y + b.h)) - y };
};
const pad = (b: Box, p: number, top = p): Box => ({ x: b.x - p, y: b.y - top, w: b.w + 2 * p, h: b.h + p + top });
const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** A model in FRAME coords (lib/world, turned a quarter on a portrait phone). */
interface FStar { name: string; family: string; x: number; y: number; atom: boolean; parents: string[]; state: EvidenceState }

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

/** A frame counter at FPS, frozen at 0 when still / reduced motion / hidden tab. */
function useSkyTick(still: boolean): number {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (still || typeof window === "undefined") return;
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
    let raf = 0, last = performance.now(), acc = 0;
    const period = 1000 / FPS;
    const loop = (now: number) => {
      acc += now - last; last = now;
      if (acc >= period) { const k = Math.floor(acc / period); acc -= k * period; setFrame((f) => (f + Math.min(k, 3)) % LOOP || 1); }
      raf = requestAnimationFrame(loop);
    };
    const start = () => { last = performance.now(); acc = 0; raf = requestAnimationFrame(loop); };
    const stop = () => cancelAnimationFrame(raf);
    const onVis = () => { stop(); if (!document.hidden && !mq?.matches) start(); };
    const onMq = () => { stop(); if (mq?.matches) setFrame(0); else start(); };
    if (!mq?.matches) start();
    document.addEventListener("visibilitychange", onVis);
    mq?.addEventListener?.("change", onMq);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); mq?.removeEventListener?.("change", onMq); };
  }, [still]);
  return still ? 0 : frame;
}

// ——— the baked sky, drawn at the camera
const SkyCanvas = memo(function SkyCanvas({ bake, ghost, box, vw, vh, dpr, onPaint }: {
  bake: Bake; ghost: string | null; box: CamBox; vw: number; vh: number; dpr: number; onPaint: () => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const cache = useRef(new Map<string, HTMLCanvasElement>());
  useEffect(() => { cache.current = new Map(); }, [bake]);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || vw <= 1) return;
    const key = ghost ?? "";
    let src = cache.current.get(key);
    if (!src) {
      src = document.createElement("canvas");
      src.width = bake.w; src.height = bake.h;
      src.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(ghost ? ghostBake(bake, ghost) : bake.rgba), bake.w, bake.h), 0, 0);
      cache.current.set(key, src);
    }
    const W = Math.round(vw * dpr), H = Math.round(vh * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = m.sea;
    ctx.fillRect(0, 0, W, H);
    const k = (vw / box.w) * dpr; // device px per frame px
    const cellPx = bake.cell * k;
    // snap the sky's origin to whole device px; whole-px cells when the camera is settled
    const ox = Math.round((bake.x - box.x) * k), oy = Math.round((bake.y - box.y) * k);
    ctx.drawImage(src, ox, oy, Math.round(bake.w * cellPx), Math.round(bake.h * cellPx));
    onPaint();
  }, [bake, ghost, box, vw, vh, dpr, onPaint]);
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 block" style={{ width: vw, height: vh, imageRendering: "pixelated" }} />;
});

/** One lineage line as the marks canvas draws it. */
interface Line { id: string; a: FStar; b: FStar; ink: string; pattern: "solid" | "dash"; comet: { busy: boolean; ink: string[] } | null }

const EVIDENCE_RUN: Record<EvidenceState, string[]> = {
  // comet head → tail, bright → dark, on the child's own sprite ramp
  champion: [GOLD.w, GOLD["4"], GOLD["3"], GOLD["2"]],
  trained: [MINT["4"], MINT["3"], MINT["2"], MINT["1"]],
  provisional: [LILAC["3"], LILAC["3"], LILAC["2"], LILAC["1"]],
  untrained: [GREY["2"], GREY["2"], GREY["1"], GREY["1"]],
};

// ——— the marks + the life layer, on the art grid
const SkyMarks = memo(function SkyMarks({ stars, lines, arcs, box, vw, vh, dpr, bake, selected, hovered, dimFam, still }: {
  stars: FStar[]; lines: Line[]; arcs: { a: FStar; b: FStar }[]; box: CamBox; vw: number; vh: number; dpr: number; bake: Bake;
  selected: string | null; hovered: string | null; dimFam: string | null; still: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const frame = useSkyTick(still);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || vw <= 1) return;
    const W = Math.round(vw * dpr), H = Math.round(vh * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    const S = vw / box.w;
    const cols = Math.ceil(vw / AP), rows = Math.ceil(vh / AP);
    const art = (s: { x: number; y: number }): [number, number] => [Math.round(((s.x - box.x) * S) / AP), Math.round(((s.y - box.y) * S) / AP)];
    const ink = (f: string) => (dimFam && f !== dimFam ? (c: string) => dim(c) : undefined);

    // twinkle: a few field stars step along the field ramp (sky grid)
    if (frame > 0) {
      const k = S * dpr, cell = bake.cell * k;
      bake.field.forEach((f, i) => {
        const d = twinkle(i, frame);
        if (!d) return;
        const x = Math.round((bake.x + f.bx * bake.cell - box.x) * k), y = Math.round((bake.y + f.by * bake.cell - box.y) * k);
        if (x < -cell || y < -cell || x > W || y > H) return;
        ctx.fillStyle = FIELD[clamp(f.tone + d, 0, 3)];
        ctx.fillRect(x, y, Math.max(1, Math.round(cell)), Math.max(1, Math.round(cell)));
      });
    }

    const under = new Pix(AP, dpr, cols, rows), over = new Pix(AP, dpr, cols, rows), top = new Pix(AP, dpr, cols, rows);
    // lineage lines (+ comets running parent → child)
    lines.forEach((l, i) => {
      const A = art(l.a), B = art(l.b);
      const px = asterism(A, B, starRadius(l.a.state, l.a.atom) + 2, starRadius(l.b.state, l.b.atom) + 2);
      px.forEach(([x, y], j) => { if (l.pattern === "solid" || j % 4 < 2) under.add(x, y, l.ink); });
      if (l.comet) {
        const h = comet(i, px.length, frame, l.comet.busy);
        if (h >= 0) for (let t = 0; t < 4; t++) { const p = px[h - t]; if (p) over.add(p[0], p[1], l.comet.ink[t]); }
      }
    });
    // pipeline arcs: dotted pastel aqua, star to star
    for (const a of arcs) {
      const px = arcPixels(art(a.a), art(a.b), starRadius(a.a.state, a.a.atom) + 3, starRadius(a.b.state, a.b.atom) + 3);
      px.forEach(([x, y], j) => { if (j % 3 === 0) under.add(x, y, INK.pipe); });
    }
    // the stars
    stars.forEach((s, i) => {
      const [x, y] = art(s);
      if (x < -8 || y < -8 || x > cols + 8 || y > rows + 8) return;
      stamp(over, starSprite(s.state, s.atom), x, y, ink(s.family));
      if (s.state === "champion") {
        const g = glint(i, frame);
        if (g) {
          top.add(x, y, GOLD.w);
          const r = starRadius("champion", s.atom);
          for (let k = 1; k <= g - 1; k++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) top.add(x + dx * (r + k), y + dy * (r + k), k === g - 1 ? GOLD["3"] : GOLD["4"]);
        }
      }
      if (s.name === selected || s.name === hovered) {
        const r = starRadius(s.state, s.atom) + 3;
        for (const [dx, dy] of ringOffsets(r, s.name === selected ? "broken" : "dotted")) top.add(x + dx, y + dy, s.name === selected ? INK.ring : INK.name);
      }
    });
    // a meteor now and then (decoration)
    const met = meteor(frame, cols, rows);
    if (met) for (const p of met) under.add(p.x, p.y, FIELD[p.k]);
    under.flush(ctx); over.flush(ctx); top.flush(ctx);
  }, [stars, lines, arcs, box, vw, vh, dpr, bake, selected, hovered, dimFam, frame]);
  return <canvas ref={ref} aria-hidden data-sky-life={frame} className="pointer-events-none absolute inset-0 block" style={{ width: vw, height: vh, imageRendering: "pixelated" }} />;
});

/** Day | Night, hung from the top edge exactly like the day map's Pixel | Paper. */
function NightTabs({ compact, onHideUi }: { compact: boolean; onHideUi: () => void }) {
  const tab = (text: string, on: boolean, href?: string) => {
    const style: CSSProperties = {
      ...plateStyle(m, { loud: on, shadow: on }),
      borderTop: "none", paddingTop: on ? (compact ? 10 : 14) : (compact ? 6 : 8),
      fontFamily: m.signFont, fontWeight: 700, fontSize: compact ? 14 : 20, textDecoration: "none", display: "inline-block",
    };
    const cls = `${compact ? "px-2 pb-1.5" : "px-4 pb-2"} leading-none focus-visible:outline-2 focus-visible:outline-offset-2`;
    return on
      ? <span key={text} role="tab" aria-selected className={cls} style={style}>{text}</span>
      : <a key={text} role="tab" aria-selected={false} href={href} className={cls} style={style}>{text}</a>;
  };
  return (
    <nav aria-label="Day and night sheets" className="flex flex-col items-end">
      <div role="tablist" className={`flex items-start ${compact ? "gap-1" : "gap-1.5"}`}>
        {tab("Day", false, "/lab/painted/?map=pixel")}
        {tab("Night", true)}
        <button type="button" onClick={onHideUi} aria-label="Sky only: hide the UI (h)" title="Sky only (h)"
          className={`${compact ? "px-1.5 pb-1.5 pt-1.5" : "px-3 pb-2 pt-2"} leading-none focus-visible:outline-2`}
          style={{ ...plateStyle(m, { shadow: true }), borderTop: "none", fontFamily: m.bodyFont, fontSize: compact ? 12 : 14 }}>
          sky only
        </button>
      </div>
    </nav>
  );
}

/** A pipeline partner off screen: a named chevron on the edge, toward it. */
function Chevron({ x, y, dir, name, onPick }: { x: number; y: number; dir: "l" | "r" | "u" | "d"; name: string; onPick: () => void }) {
  // a 5×5 pixel arrowhead, drawn in rects so it lands on the art grid
  const head: Record<typeof dir, [number, number][]> = {
    r: [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4], [0, 1], [0, 2], [0, 3], [1, 2]],
    l: [[2, 0], [1, 1], [0, 2], [1, 3], [2, 4], [2, 1], [2, 2], [2, 3], [1, 2]],
    d: [[0, 0], [1, 1], [2, 2], [3, 1], [4, 0], [1, 0], [2, 0], [3, 0], [2, 1]],
    u: [[0, 2], [1, 1], [2, 0], [3, 1], [4, 2], [1, 2], [2, 2], [3, 2], [2, 1]],
  };
  const svg = (
    <svg width={dir === "l" || dir === "r" ? 3 * AP : 5 * AP} height={dir === "l" || dir === "r" ? 5 * AP : 3 * AP} shapeRendering="crispEdges" aria-hidden className="flex-none">
      {head[dir].map(([a, b], i) => <rect key={i} x={a * AP} y={b * AP} width={AP} height={AP} fill={INK.pipe} />)}
    </svg>
  );
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onPick(); }} title={`${displayName(name)}: a pipeline partner off screen`}
      className="pointer-events-auto absolute z-10 flex items-center gap-1.5 px-2 py-1 leading-none focus-visible:outline-2"
      style={{ ...plateStyle(m), border: `var(--ap) solid ${INK.pipe}`, left: x, top: y, transform: "translate(-50%, -50%)", fontFamily: m.tagFont, fontSize: 13, whiteSpace: "nowrap", color: m.ink }}>
      {(dir === "l" || dir === "u") && svg}
      {displayName(name)}
      {(dir === "r" || dir === "d") && svg}
    </button>
  );
}

export function SkySkin() {
  const { view, update } = useLabView();
  const still = view?.still ?? true;
  const { world, taxonomy, evidence, runs, family, ready } = useWorld(view ? view.still : null);
  const { w: winW, dpr } = useWindow();
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
  const nebBox = useCallback((f: Family): Box | null => (hulls[f] ? pad(hulls[f]!, NEB, NEB + 30) : null), [hulls]);

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
  const skyBox = useMemo(() => pad(frameWorld, PAD), [frameWorld]);
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
  const q = CELLQ(dpr);
  const target: CamBox = useMemo(() => {
    if (!world || !view || !measured) return frameWorld;
    const ins = mobile ? { t: 118, r: 10, b: 100, l: 10 } : { t: 64, r: 40, b: 140, l: 40 };
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
    const zin = view.zoom === "overview" ? ins : { ...ins, t: mobile ? ins.t : 40, b: mobile ? ins.b : 150 };
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
      if (lit) { out.push({ id: r.id, a, b, ink: INK.lit, pattern: r.kind === "primary" ? "solid" : "dash", comet: { busy: true, ink: EVIDENCE_RUN[b.state] } }); continue; }
      if (r.kind === "primary") {
        const dimmed = focusFam !== null && b.family !== focusFam;
        // the whole sky: lines sit quietly under the stars (the nebula + sprites
        // read first, the fans of a busy parent never shout); a focused family's
        // own lines come up to the pastel
        const quiet = focusFam === null && !selected;
        const base = fam ? (quiet ? mix(fam.tint[0], fam.ramp[3], 0.62) : mix(fam.tint[0], fam.ramp[2], 0.3)) : INK.cross;
        out.push({ id: r.id, a, b, ink: dimmed ? dim(base, 0.7) : base, pattern: "solid", comet: selected || dimmed ? null : { busy: false, ink: EVIDENCE_RUN[b.state] } });
      } else if (touches) {
        // secondary + cross-family lineage: shown only on focus, dashed and quiet
        out.push({ id: r.id, a, b, ink: dim(INK.cross, 0.4), pattern: "dash", comet: null });
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
  const layout = useMemo(() => {
    const obstacles: (Box & { star?: string })[] = [];
    // the corner plates (screen px, measured off the shots), so no word hides under them
    if (!uiHidden) {
      if (mobile) obstacles.push({ x: 0, y: 0, w: 186, h: 128 }, { x: vp.w - 192, y: 0, w: 192, h: 36 }, { x: 0, y: visH - 96, w: 122, h: 96 });
      else obstacles.push(
        { x: 0, y: 0, w: 354, h: focusFam ? 194 : 172 }, { x: vp.w - drawerPx - 284, y: 0, w: 284, h: 48 },
        { x: 0, y: visH - 222, w: 494, h: 86 }, { x: 0, y: visH - 134, w: 160, h: 134 },
        ...(drawerPx ? [] : [{ x: vp.w - 302, y: visH - 224, w: 302, h: 224 }]));
    }
    for (const s of stars) {
      // the selection / hover ring sits 3 art px out: keep words clear of it too
      const p = scr(s), r = (starRadius(s.state, s.atom) + (s.name === selected || s.name === hovered ? 5 : 2)) * AP;
      obstacles.push({ x: p.x - r, y: p.y - r, w: 2 * r, h: 2 * r, star: s.name });
    }
    // partners: on screen → an arc; off screen → a named chevron on the edge, toward it
    const arcs: { a: FStar; b: FStar }[] = [];
    const chevrons: { name: string; x: number; y: number; dir: "l" | "r" | "u" | "d" }[] = [];
    const sel = selected ? byName.get(selected) : undefined;
    if (sel) {
      const a = scr(sel);
      for (const p of partners) {
        const st = byName.get(p.name)!;
        const b = scr(st);
        const M = 18;
        if (b.x > M && b.y > M && b.x < visW - M && b.y < visH - M) {
          arcs.push({ a: sel, b: st });
          // no sign or name sits on an arc: its pixels are obstacles too
          const A: [number, number] = [Math.round((a.x - AP / 2) / AP), Math.round((a.y - AP / 2) / AP)], B: [number, number] = [Math.round((b.x - AP / 2) / AP), Math.round((b.y - AP / 2) / AP)];
          arcPixels(A, B, starRadius(sel.state, sel.atom) + 3, starRadius(st.state, st.atom) + 3).forEach(([x, y], j) => { if (j % 3 === 0) obstacles.push({ x: x * AP - 2, y: y * AP - 2, w: AP + 4, h: AP + 4 }); });
          continue;
        }
        const cw = displayName(p.name).length * 8 + 34, ch = 26;
        // the chevron hugs the screen edge (its plate just inside it), on the ray toward the partner
        const inner = { x0: 8 + cw / 2, y0: (mobile ? 140 : 70) + ch / 2, x1: visW - 8 - cw / 2, y1: visH - (mobile ? 110 : 80) - ch / 2 };
        const dx = b.x - a.x, dy = b.y - a.y;
        let t = 1;
        if (dx > 0) t = Math.min(t, (inner.x1 - a.x) / dx); else if (dx < 0) t = Math.min(t, (inner.x0 - a.x) / dx);
        if (dy > 0) t = Math.min(t, (inner.y1 - a.y) / dy); else if (dy < 0) t = Math.min(t, (inner.y0 - a.y) / dy);
        t = Math.max(0, t);
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "r" : "l") : dy > 0 ? "d" : "u";
        let c = { x: clamp(a.x + dx * t, inner.x0, inner.x1), y: clamp(a.y + dy * t, inner.y0, inner.y1) };
        // two chevrons never stack: step along the edge
        for (let k = 0; k < 6 && chevrons.some((o) => Math.abs(o.x - c.x) < cw && Math.abs(o.y - c.y) < ch); k++) c = { x: c.x, y: c.y + ch + 6 };
        chevrons.push({ name: p.name, ...c, dir });
        obstacles.push({ x: c.x - cw / 2, y: c.y - ch / 2, w: cw, h: ch });
      }
    }
    // the night signs: one per nebula, anchored on its top-left (the focused family's first)
    const plaqueH = mobile ? 26 : regionish ? 44 : 34;
    const plaques: { f: Family; x: number; y: number }[] = [];
    const area = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const snap = (v: number) => Math.round(v / AP) * AP;
    const order = [...FAMILIES].filter((f) => hulls[f]).sort((p, r) => Number(r === focusFam) - Number(p === focusFam) || (famCount[r] ?? 0) - (famCount[p] ?? 0));
    for (const f of order) {
      const h = hulls[f]!;
      const tl = scr({ x: h.x, y: h.y }), br = scr({ x: h.x + h.w, y: h.y + h.h });
      const c = CONSTELLATION_W[f] ?? 0;
      const pw = Math.max((f.length + 2) * (mobile ? 7.8 : 9.8), regionish && !mobile ? c * 6.6 : 0) + (mobile ? 36 : 48);
      const g = Math.max(mobile ? 8 : 12, 26 * S);
      const above = tl.y - g - plaqueH, below = br.y + g + 8, span = Math.max(0, br.x - tl.x + 2 * g - pw);
      const raw = [
        { x: tl.x - g, y: above },
        { x: tl.x - g + span / 3, y: above },
        { x: tl.x - g + (2 * span) / 3, y: above },
        { x: br.x + g - pw, y: above },
        { x: tl.x - g, y: below },
        { x: br.x + g - pw, y: below },
        { x: tl.x - g - pw - 4, y: tl.y - plaqueH / 2 },
        { x: br.x + g + 4, y: tl.y - plaqueH / 2 },
      ];
      const cands = raw.map((q) => ({ x: snap(q.x), y: snap(q.y), inside: q.x >= 4 && q.y >= 4 && q.x + pw <= visW - 4 && q.y + plaqueH <= visH - 4 }));
      const box = (q: { x: number; y: number }) => ({ x: q.x, y: q.y, w: pw, h: plaqueH });
      // zoomed in, another family's sign keeps to its anchor side (above the nebula) or stays away
      const allowed = regionish && f !== focusFam ? cands.slice(0, 4) : cands;
      // a sign belongs to the nebula whose stars are nearest it
      const own = stars.filter((s) => s.family === f).map(scr), rest = stars.filter((s) => s.family !== f).map(scr);
      const near = (pts: { x: number; y: number }[], q: { x: number; y: number }) => Math.min(...pts.map((p) => {
        const dx = Math.max(q.x - p.x, 0, p.x - (q.x + pw)), dy = Math.max(q.y - p.y, 0, p.y - (q.y + plaqueH));
        return Math.hypot(dx, dy);
      }));
      // …and never sits on another family's cloud (the share of its area painted
      // in a neighbour's nebula, read off the bake): a sign is read as part of
      // the colour under it
      const fi = bake ? bake.families.indexOf(f) : -1;
      const foreign = (q: { x: number; y: number }) => {
        if (!bake) return 0;
        let n = 0, o = 0;
        for (let y = q.y + 2; y < q.y + plaqueH; y += 6) for (let x = q.x + 2; x < q.x + pw; x += 6) {
          n++;
          const bx = Math.floor((camBox.x + x / S - bake.x) / bake.cell), by = Math.floor((camBox.y + y / S - bake.y) / bake.cell);
          if (bx < 0 || by < 0 || bx >= bake.w || by >= bake.h) continue;
          const k = by * bake.w + bx;
          if (bake.owner[k] >= 0 && bake.owner[k] !== fi && bake.level[k] >= 2) o++;
        }
        return n ? o / n : 0;
      };
      const owned = (q: { x: number; y: number }) => !rest.length || near(rest, q) >= near(own, q) + 6;
      const clean = (q: { x: number; y: number }) => regionish || foreign(q) <= 0.12;
      let pick = allowed.find((q) => q.inside && !obstacles.some((o) => hit(box(q), o)) && (regionish || (owned(q) && clean(q))));
      if (!pick && !(regionish && f !== focusFam)) {
        // the anchor is taken (a packed phone sky): the free spot nearest the
        // anchor whose closest star is one of the family's OWN — so a sign
        // never lands on (or reads as belonging to) a neighbouring nebula
        const a0 = cands[0];
        let best: { q: { x: number; y: number }; cost: number } | null = null;
        const R = mobile ? 140 : 180;
        for (let y = tl.y - plaqueH - R; y <= br.y + R; y += 8) {
          for (let x = tl.x - pw - R; x <= br.x + R; x += 8) {
            const q = { x: snap(x), y: snap(y) };
            if (q.x < 4 || q.y < 4 || q.x + pw > visW - 4 || q.y + plaqueH > visH - 4) continue;
            if (obstacles.some((o) => hit(box(q), o))) continue;
            if (!owned(q)) continue;
            const dOwn = near(own, q);
            const cost = dOwn * 2 + Math.hypot(q.x - a0.x, q.y - a0.y) * 0.5 + foreign(q) * 260;
            if (!best || cost < best.cost) best = { q, cost };
          }
        }
        if (best) pick = { ...best.q, inside: true };
      }
      if (!pick) {
        // zoomed in, another family's sign that has no clean spot is left out;
        // the whole sky (or the focused family) takes the least crowded spot
        if (regionish && f !== focusFam) continue;
        const clampd = cands.map((q) => ({ ...q, x: snap(clamp(q.x, 6, visW - pw - 6)), y: snap(clamp(q.y, 6, visH - plaqueH - 6)) }));
        pick = clampd.map((q) => ({ q, cost: obstacles.reduce((s2, o) => s2 + area(box(q), o), 0) })).sort((p, r) => p.cost - r.cost)[0].q;
      }
      obstacles.push(box(pick));
      plaques.push({ f, x: pick.x, y: pick.y });
    }
    // star names: atoms always; derived on hover, selection, lineage, partners, focus or zoom
    const show = (s: FStar) => s.atom || s.name === selected || s.name === hovered || lineageSet.has(s.name) || partnerSet.has(s.name) || (focusFam ? s.family === focusFam : zoomedIn);
    const rank = (s: FStar) => (s.name === selected ? 0 : s.name === hovered ? 1 : partnerSet.has(s.name) ? 2 : s.atom ? 3 : lineageSet.has(s.name) ? 4 : 5);
    const atomFs = mobile ? 11 : 13, derivedFs = mobile ? 10 : 12;
    const labels: { s: FStar; x: number; y: number; fs: number; anchor: "middle" | "start" | "end" }[] = [];
    for (const s of stars.filter(show).sort((p, r) => rank(p) - rank(r) || p.name.localeCompare(r.name))) {
      const p = scr(s);
      if (p.x < -40 || p.y < -20 || p.x > vp.w + 40 || p.y > vp.h + 20) continue;
      const fs = s.atom ? atomFs : derivedFs;
      const w = displayName(s.name).length * fs * 0.6 + 4, hh = fs + 4;
      const r = (starRadius(s.state, s.atom) + (s.name === selected || s.name === hovered ? 4 : 1)) * AP + 3;
      const cands: { x: number; y: number; anchor: "middle" | "start" | "end"; box: Box }[] = [
        { x: p.x, y: p.y + r + fs * 0.85, anchor: "middle", box: { x: p.x - w / 2, y: p.y + r, w, h: hh } },
        { x: p.x, y: p.y - r - 3, anchor: "middle", box: { x: p.x - w / 2, y: p.y - r - hh, w, h: hh } },
        { x: p.x + r + 2, y: p.y + fs * 0.35, anchor: "start", box: { x: p.x + r, y: p.y - hh / 2, w, h: hh } },
        { x: p.x - r - 2, y: p.y + fs * 0.35, anchor: "end", box: { x: p.x - r - w, y: p.y - hh / 2, w, h: hh } },
      ];
      // a name is never cut by the screen edge (or the drawer)
      const free = cands.find((c) => c.box.x >= 2 && c.box.x + c.box.w <= visW - 2 && !obstacles.some((o) => o.star !== s.name && hit(c.box, o)));
      const must = rank(s) <= 2;
      const c = free ?? (must ? cands[0] : null);
      if (!c) continue;
      obstacles.push(c.box);
      labels.push({ s, x: c.x, y: c.y, fs, anchor: c.anchor });
    }
    return { plaques, labels, arcs, chevrons };
  }, [stars, scr, hulls, famCount, mobile, regionish, uiHidden, vp.w, vp.h, visW, visH, drawerPx, S, selected, hovered, lineageSet, partnerSet, focusFam, zoomedIn, byName, partners, bake, camBox.x, camBox.y]);

  const whole = !manual && (view?.zoom ?? "overview") === "overview";
  const corner = "pointer-events-auto absolute z-20";
  const vw = vp.w, vh = vp.h;

  return (
    <LabMotion still={still}>
      <div data-lab-ready={drawn ? "1" : undefined} className="relative h-full w-full select-none overflow-hidden"
        style={{ background: m.sea, fontFamily: m.bodyFont, ["--ap" as string]: `${AP}px` } as CSSProperties}>
        <div ref={camRef} {...camHandlers} onWheel={onWheel}
          onClick={() => { if (!camDragged.current && (view?.zoom ?? "overview") !== "overview") fitWhole(); }} className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing">
          {bake && measured && (
            <>
              <SkyCanvas bake={bake} ghost={focusFam} box={camBox} vw={vw} vh={vh} dpr={dpr} onPaint={onPaint} />
              <SkyMarks stars={stars} lines={lines} arcs={layout.arcs} box={camBox} vw={vw} vh={vh} dpr={dpr} bake={bake}
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
                        style={{ paintOrder: "stroke", stroke: INK.outline, strokeWidth: 3, strokeLinejoin: "miter" }}>
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
                    onClick={() => { if (!camDragged.current) jumpLand(f); }} />
                </div>
              ))}
              {!uiHidden && layout.chevrons.map((c) => <Chevron key={c.name} {...c} onPick={() => onSelect(c.name)} />)}
            </>
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
              <Cartouche m={m} title="The Celestial Zoo" noun="nebulae" counts={counts} names={names} focusFam={focusFam} famCount={famCount} famProven={famProven}
                onPick={onSelect} onWhole={fitWhole} compact={mobile} />
            </div>
            <div className={`${corner} right-3 top-0 sm:right-5`}>
              <NightTabs compact={mobile} onHideUi={() => setUiHidden(true)} />
            </div>
            <div className={`${corner} bottom-3 left-3 flex flex-col items-start gap-3 sm:bottom-5 sm:left-5`}>
              {!mobile && (
                <ScaleBar m={m} names={names} family={family} states={states} atoms={atoms} pipelines={pipelines} counts={counts}
                  selected={selected} onPick={onSelect} onLand={jumpLand} focusFam={focusFam} />
              )}
              <Compass m={m} unit={mobile ? 3.5 : 5} onPan={panBy} onWhole={fitWhole} onZoom={stepZoom}
                canIn={camBox.w > minW + 1} canOut={camBox.w < maxW - 1} whole={whole} />
            </div>
            {!mobile && !drawerPx && (
              <div className={`${corner} bottom-3 right-3 sm:bottom-5 sm:right-5`}>
                <CornerPlate m={m} face="legend" world={{ w: wb.w, h: wb.h }} box={camBox} source={{ img: "", pixelated: true }} onCenter={() => {}}
                  glyph={(s) => <StarPair state={s} />}
                  note="Each nebula is a family. A line runs from a parent star to a model built on it; comets run along it, parent to child." />
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

/** Device px per frame px that make one sky px (4 frame px) a whole number of device px. */
function CELLQ(dpr: number) { return 4 * dpr; }
