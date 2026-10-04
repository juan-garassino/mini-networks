"use client";

// Skin D · Kawaii DFD — the zoo as a data-flow diagram (/lab/flow).
// lib/world/dfd.ts lays every model on a strict grid (desktop: two stacks of
// family lanes × generation columns; phone: one file-tree column) and routes
// every builds_on edge orthogonally with zero crossings; this board draws that
// sheet, lights a lineage on hover / selection, docks the drawer, and moves a
// camera between the URL-driven views (?zoom=overview|region|node&focus=…&still=1).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ModelEvidence } from "@/lib/types";
import { COMPOSITION_LESSONS } from "@/lib/lessons";
import type { DfdLayout } from "@/lib/world/dfd";
import { useWorld } from "@/hooks/use-world";
import { useLesson } from "@/hooks/use-lesson";
import { useLabView } from "@/components/lab/shared/url-state";
import { LabMotion } from "@/components/lab/shared/still";
import { cardModel, displayName, evidenceState, type EvidenceState } from "@/components/lab/shared/card-model";
import {
  forwardPassOrder, forwardPassSchedule, GROKKING_EGG,
  useCritterClicks, useKonami, useLongFocus, useRealLossCurve, type RealLossCurve,
} from "@/components/lab/shared/eggs";
import { Sparkline } from "@/components/lab/shared/lesson/sparkline";
import { Critter, EvidenceMark } from "./critter";
import { DRAWER_W, FlowDrawer } from "./drawer";
import { Packets, type PacketRoute } from "./packets";
import { edgeKey, Sheet, type SheetState } from "./sheet";
import { useDfd, useFlowFont } from "./use-dfd";
import { ACCENT, fam, INK, INK_SOFT, RULE, SHEET } from "./palette";
import s from "./flow.module.css";

const BAR_D = 44;      // desktop top bar
const BAR_M = 52;      // phone top bar
const STATES: EvidenceState[] = ["champion", "trained", "provisional", "untrained"];
const STATE_WORD: Record<EvidenceState, string> = { champion: "champion", trained: "trained", provisional: "provisional", untrained: "untrained" };

interface Cam { s: number; tx: number; ty: number }
type R = { x: number; y: number; w: number; h: number };

function useStage() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  return { ref, size };
}

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setR(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return r;
}

const fit = (r: R, a: R, max: number, min = 0): Cam => {
  const sc = Math.max(min, Math.min(max, a.w / r.w, a.h / r.h));
  return { s: sc, tx: a.x + (a.w - r.w * sc) / 2 - r.x * sc, ty: a.y + (a.h - r.h * sc) / 2 - r.y * sc };
};
const union = (rs: R[]): R => {
  const x0 = Math.min(...rs.map((r) => r.x)), y0 = Math.min(...rs.map((r) => r.y));
  const x1 = Math.max(...rs.map((r) => r.x + r.w)), y1 = Math.max(...rs.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};
const pad = (r: R, p: number): R => ({ x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p });

/** Ancestors of `n` with their longest hop count down to it. */
function hopsUp(parents: Map<string, string[]>, n: string) {
  const hops = new Map<string, number>([[n, 0]]);
  const visit = (m: string) => {
    for (const p of parents.get(m) ?? []) {
      const h = hops.get(m)! + 1;
      if ((hops.get(p) ?? -1) < h) { hops.set(p, h); visit(p); }
    }
  };
  visit(n);
  return hops;
}

function KeeperTrains({ curve, still, onClose }: { curve: RealLossCurve; still: boolean; onClose: () => void }) {
  const [p, setP] = useState(still ? 1 : 0);
  useEffect(() => {
    if (still) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => { const k = Math.min(1, (now - t0) / 3200); setP(k); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [curve, still]);
  return (
    <div className="absolute left-3 top-[52px] z-40 w-[300px] rounded-[8px] border bg-white p-3" style={{ borderColor: INK, boxShadow: "0 8px 24px rgba(46,39,66,0.12)" }}>
      <div className="flex items-center justify-between"><p className="text-[15px] font-extrabold">Fine, I&apos;ll train.</p>
        <button type="button" onClick={onClose} className={`${s.btn} text-[13px] font-bold underline`}>Close</button></div>
      <Sparkline points={curve.points} progress={p} label={curve.key.replace(/_/g, " ")} width={272} height={70}
        palette={{ line: ACCENT, axis: "#CFCADB", text: INK, fill: "rgba(47,95,208,0.10)" }} title="a real loss curve" />
      <p className="mt-1 text-[13px] font-bold" style={{ color: INK_SOFT }}>a real run: {curve.model.replace(/_/g, " ")}, {curve.runId}</p>
    </div>
  );
}

/** The key: every mark on the sheet, drawn as it is drawn there. */
function Legend({ column }: { column?: boolean }) {
  const item = "flex items-center gap-1.5 whitespace-nowrap";
  return (
    <div className={`flex ${column ? "flex-col items-start gap-2" : "items-center gap-3"} text-[13px] font-bold`} style={{ color: INK }}>
      <span className={item}>
        <svg width="30" height="16" viewBox="0 0 30 16" aria-hidden><rect x="0.6" y="0.6" width="28.8" height="14.8" rx="4" fill="#fff" stroke={INK} strokeWidth="1.2" /><path d="M0.6 4.6 Q0.6 0.6 4.6 0.6 H9 V15.4 H4.6 Q0.6 15.4 0.6 11.4 Z" fill={fam("sequence").strip} /><path d="M9 0.6 V15.4" stroke={INK} /></svg>
        {column ? "atom (its number starts a lineage)" : "atom"}
      </span>
      <span className={item}>
        <svg width="30" height="16" viewBox="0 0 30 16" aria-hidden><path d="M0.6 5 V4.6 Q0.6 0.6 4.6 0.6 H25.4 Q29.4 0.6 29.4 4.6 V5 Z" fill={fam("sequence").strip} /><path d="M0.6 5 H29.4" stroke={INK} /><rect x="0.6" y="0.6" width="28.8" height="14.8" rx="4" fill="none" stroke={INK} strokeWidth="1.2" /></svg>
        {column ? "derived (4.1 = first heir of atom 4)" : "derived"}
      </span>
      <span className={item}>
        <svg width="30" height="12" viewBox="0 0 30 12" aria-hidden><path d="M1 6 H23" stroke={INK} strokeWidth="1.5" /><path d="M29 6 L22 2.4 V9.6 Z" fill={INK} /></svg>
        builds on
      </span>
      <span className={item}>
        <svg width="40" height="12" viewBox="0 0 40 12" aria-hidden><path d="M1 6 H8 M32 6 H39" stroke={INK} strokeWidth="1.5" /><text x="20" y="9.5" textAnchor="middle" fontSize="9" fontWeight="700" fill={INK_SOFT}>4 tra</text></svg>
        {column ? "parent in another family" : "other family"}
      </span>
      <span className={`${column ? "flex flex-col items-start gap-1.5" : `${item} gap-2.5`}`}>
        {STATES.map((st) => (
          <span key={st} className="flex items-center gap-1">
            <svg viewBox="-12 -12 24 24" width="18" height="18" aria-hidden><g transform="translate(-12 -12)"><Critter family="perception" state={st} /></g></svg>
            <svg viewBox="-5 -5 10 10" width="9" height="9" aria-hidden><EvidenceMark state={st} /></svg>
            {STATE_WORD[st]}
          </span>
        ))}
      </span>
    </div>
  );
}

export function FlowBoard() {
  const { view, update } = useLabView();
  const still = view?.still ?? true;
  const reduced = useReducedMotion();
  const frozen = still || reduced;
  const { taxonomy, runs, evidence, family, ready } = useWorld(view ? view.still : null);
  const { ref: rootRef, size } = useStage();
  const mobile = size.w > 0 && size.w < 640;
  const mode = size.w > 0 ? (mobile ? "mobile" : "desktop") : null;
  const measure = useFlowFont();
  const layout: DfdLayout | null = useDfd(taxonomy, family, mode, measure);

  // ——— the graph as drawn ———
  const g = useMemo(() => {
    if (!layout) return null;
    const parents = new Map<string, string[]>(layout.boxes.map((b) => [b.name, []]));
    const children = new Map<string, string[]>(layout.boxes.map((b) => [b.name, []]));
    for (const e of layout.edges) { parents.get(e.to)?.push(e.from); children.get(e.from)?.push(e.to); }
    const box = new Map(layout.boxes.map((b) => [b.name, b]));
    return { parents, children, box };
  }, [layout]);
  const evBy = useMemo(() => new Map<string, ModelEvidence>(evidence.map((e) => [e.name, e])), [evidence]);
  const states = useMemo(() => new Map((layout?.boxes ?? []).map((b) => [b.name, evidenceState(evBy.get(b.name))])), [layout, evBy]);

  const focusBox = view?.focus && g ? g.box.get(view.focus) ?? null : null;
  const zoom = view && focusBox ? view.zoom : "overview";
  const selected = zoom === "node" && focusBox ? focusBox.name : null;

  // ——— hover, lineage lighting, pipelines ———
  const [hover, setHover] = useState<string | null>(null);
  const onHover = useCallback((n: string | null, on: boolean) => setHover((h) => (on ? n : h === n ? null : h)), []);
  const lit = selected ?? hover ?? (zoom === "region" && focusBox ? focusBox.name : null);
  const lineage = useMemo(() => {
    if (!g || !lit || !layout) return null;
    const up = hopsUp(g.parents, lit);
    const models = new Set([...up.keys(), ...(g.children.get(lit) ?? [])]);
    const edges = new Set(layout.edges.filter((e) => (up.has(e.from) && up.has(e.to)) || e.from === lit).map(edgeKey));
    return { up, models, edges };
  }, [g, lit, layout]);
  const [pipe, setPipe] = useState<string | null>(null);
  const pipeline = useMemo(() => {
    if (!pipe || !taxonomy || !g) return null;
    const c = taxonomy.compositions.find((q) => q.name === pipe);
    return c ? c.composes.filter((m) => g.box.has(m)) : null;
  }, [pipe, taxonomy, g]);
  const [pipesOpen, setPipesOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);

  const select = useCallback((name: string) => { setPipesOpen(false); update({ zoom: "node", focus: name }); }, [update]);
  const close = useCallback(() => update({ zoom: focusBox ? "region" : "overview" }), [update, focusBox]);

  // ——— eggs ———
  const [wave, setWave] = useState<{ key: number; delay: Record<string, number> } | null>(null);
  const schedule = useMemo(() => (layout ? forwardPassSchedule(forwardPassOrder({ nodes: layout.boxes.map((b) => ({ name: b.name, depth: b.depth })) }), 520) : {}), [layout]);
  useKonami(useCallback(() => setWave((w) => ({ key: (w?.key ?? 0) + 1, delay: schedule })), [schedule]), !frozen);
  useEffect(() => {
    if (!wave) return;
    const t = setTimeout(() => setWave(null), Math.max(0, ...Object.values(wave.delay)) + 900);
    return () => clearTimeout(t);
  }, [wave]);
  const grokHeld = useLongFocus(!frozen && hover === GROKKING_EGG.model ? GROKKING_EGG.model : null, GROKKING_EGG.holdMs);
  const keeper = useCritterClicks(7, 2500);
  const { curve: realCurve } = useRealLossCurve(runs, keeper.unlocked && !still);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (keeper.unlocked) keeper.reset();
      else if (pipe) setPipe(null);
      else if (pipesOpen || keyOpen) { setPipesOpen(false); setKeyOpen(false); }
      else if (zoom === "node") close();
      else if (zoom === "region") update({ zoom: "overview" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom, close, update, pipe, pipesOpen, keyOpen, keeper]);

  // ——— camera (desktop): uniform scale, three URL views, drag to pan, wheel to zoom ———
  const stageW = size.w, stageH = size.h - BAR_D;
  const target: Cam | null = useMemo(() => {
    if (!layout || mobile || stageW <= 0 || !g) return null;
    const whole: R = { x: 0, y: 0, w: layout.width, h: layout.height };
    const all: R = { x: 4, y: 2, w: stageW - 8, h: stageH - 4 };
    const over = fit(whole, all, 1.25);
    if (zoom === "region" && focusBox) {
      const lane = layout.lanes.find((l) => l.family === focusBox.family)!;
      const r = pad({ x: lane.x, y: lane.y, w: lane.w, h: lane.h }, 24);
      return fit(r, all, 2.2, over.s);
    }
    if (zoom === "node" && focusBox) {
      const kin = [focusBox.name, ...(g.parents.get(focusBox.name) ?? []), ...(g.children.get(focusBox.name) ?? [])].map((n) => g.box.get(n)!);
      const r = pad(union(kin), 32);
      const avail: R = { x: 16, y: 8, w: stageW - DRAWER_W - 32, h: stageH - 16 };
      return fit(r, avail, 1.9, Math.min(over.s, avail.w / r.w));
    }
    return over;
  }, [layout, mobile, stageW, stageH, zoom, focusBox, g]);
  const [cam, setCam] = useState<Cam | null>(null);
  const camRef = useRef<Cam | null>(null);
  useEffect(() => { camRef.current = cam; }, [cam]);
  useEffect(() => {
    if (!target) return;
    const from = camRef.current;
    if (!from || frozen) { setCam(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 520), e = 1 - Math.pow(1 - k, 3);
      setCam({ s: from.s + (target.s - from.s) * e, tx: from.tx + (target.tx - from.tx) * e, ty: from.ty + (target.ty - from.ty) * e });
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, frozen]);
  const drag = useRef<{ x: number; y: number; cam: Cam; moved: boolean } | null>(null);
  const onDown = (e: React.PointerEvent) => { if (cam) drag.current = { x: e.clientX, y: e.clientY, cam, moved: false }; };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    setCam({ ...d.cam, tx: d.cam.tx + dx, ty: d.cam.ty + dy });
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved && (e.target as Element).closest?.("[data-model]") == null && (selected || pipe)) {
      setPipe(null);
      if (selected) close();
    }
  };
  const svgRef = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const c = camRef.current;
      if (!c) return;
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      const k = Math.exp(-e.deltaY * 0.0015);
      const ns = Math.max(0.5, Math.min(3, c.s * k));
      const f = ns / c.s;
      setCam({ s: ns, tx: px - (px - c.tx) * f, ty: py - (py - c.ty) * f });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [layout, mobile]);

  // ——— phone: native scroll; the views scroll the sheet ———
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!mobile || !layout || !scrollRef.current) return;
    const sc = scrollRef.current;
    const top = BAR_M + 4;
    let y = 0;
    if (zoom === "node" && focusBox) {
      // the selection sits in the band above the bottom sheet (≤ 55% of the height)
      const band = sc.clientHeight * 0.45;
      y = top + focusBox.y - Math.max(BAR_M + 8, (band - focusBox.h) / 2 + BAR_M / 2);
    } else if (zoom === "region" && focusBox) {
      const lane = layout.lanes.find((l) => l.family === focusBox.family)!;
      y = top + lane.y - BAR_M;
    }
    sc.scrollTo({ top: Math.max(0, y), behavior: frozen ? "auto" : "smooth" });
  }, [mobile, layout, zoom, focusBox, frozen]);

  // ——— the card ———
  const card = useMemo(() => {
    if (!selected || !taxonomy || !focusBox) return null;
    return cardModel(selected, { taxonomy, evidence, runs, family: focusBox.family, depth: focusBox.depth });
  }, [selected, taxonomy, focusBox, evidence, runs]);
  const lesson = useLesson(card ? selected : null, { runs, evidence, still: view ? view.still : null });

  // ——— packets: the lineage flowing into the selection ———
  const routes: PacketRoute[] = useMemo(() => {
    if (!layout || !selected || !lineage) return [];
    return layout.edges.filter((e) => e.points.length > 1 && lineage.up.has(e.from) && lineage.up.has(e.to))
      .map((e) => ({ id: edgeKey(e), points: e.points, color: fam(g!.box.get(e.from)!.family).deep, hop: lineage.up.get(e.from)! - 1 }));
  }, [layout, selected, lineage, g]);

  const sheetState: SheetState = useMemo(() => ({
    states, selected, wave,
    lit: lineage?.models ?? null, litEdges: lineage?.edges ?? null,
    pipeline: lineage ? null : pipeline,
  }), [states, selected, wave, lineage, pipeline]);

  // ——— ready marker (scripts/shoot.mjs waits for it) ———
  const [paintedOnce, setPaintedOnce] = useState(false);
  const placed = !!layout && (mobile || !!cam);
  useEffect(() => {
    if (!ready || !placed) return;
    let a = 0, b = 0;
    a = requestAnimationFrame(() => { b = requestAnimationFrame(() => setPaintedOnce(true)); });
    return () => { cancelAnimationFrame(a); cancelAnimationFrame(b); };
  }, [ready, placed]);
  const drawn = paintedOnce && ready && placed;

  // ——— test hook for scripts/shoot.mjs --motion ———
  useEffect(() => {
    if (!drawn) return;
    const w = window as unknown as { __lab?: unknown };
    w.__lab = {
      select: (name: string) => select(name),
      view: (nv: { zoom: "overview" | "region" | "node"; focus?: string }) => update(nv.focus !== undefined ? { zoom: nv.zoom, focus: nv.focus } : { zoom: nv.zoom }),
      critterClick: (n: number) => { for (let i = 0; i < n; i++) keeper.click(); },
    };
    return () => { delete w.__lab; };
  }, [drawn, select, update, keeper]);

  const comps = taxonomy?.compositions ?? [];
  const pipeInfo = pipe ? comps.find((c) => c.name === pipe) : null;
  const grok = g?.box.get(GROKKING_EGG.model);
  const familyOf = useCallback((n: string) => g?.box.get(n)?.family ?? "", [g]);
  const addressOf = useCallback((n: string) => g?.box.get(n)?.address ?? "", [g]);
  const models = layout?.boxes.map((b) => b.name).sort() ?? [];

  const sheetBody = layout && (
    <>
      <Sheet layout={layout} st={sheetState} onPick={select} onHover={onHover} />
      {selected && routes.length > 0 && <Packets routes={routes} frozen={frozen} runKey={selected} />}
      {grok && hover === GROKKING_EGG.model && !frozen && (
        <foreignObject x={grok.x} y={grok.y - (grokHeld ? 150 : 64)} width={grokHeld ? 300 : 250} height={grokHeld ? 146 : 60} pointerEvents="none">
          <div className="rounded-[7px] border bg-white px-2.5 py-1.5 text-[13px] font-bold leading-snug" style={{ borderColor: INK, color: INK }}>
            {grokHeld ? GROKKING_EGG.after : GROKKING_EGG.before}
            {grokHeld && <p className="mt-1 text-[12px] font-medium leading-snug">{GROKKING_EGG.explain.split(". ")[0]}. <span style={{ color: INK_SOFT }}>({GROKKING_EGG.sketch.note})</span></p>}
          </div>
        </foreignObject>
      )}
    </>
  );

  const header = (
    <header className={`z-40 flex items-center ${mobile ? "gap-2 px-2" : "gap-3 px-3"} border-b bg-white`} style={{ height: mobile ? BAR_M : BAR_D, borderColor: RULE }}>
      {!mobile && <Link href="/lab/designs/" className="shrink-0 whitespace-nowrap text-[13px] font-bold underline" style={{ color: INK_SOFT }}>All designs</Link>}
      <button type="button" onClick={keeper.click} aria-label="the keeper (poke it)" className={`${s.btn} shrink-0`}>
        <svg viewBox="0 0 24 24" width={26} height={26} aria-hidden><Critter family="perception" state={keeper.unlocked ? "champion" : "trained"} /></svg>
      </button>
      <h1 className={`${s.title} shrink-0 whitespace-nowrap ${mobile ? "text-[16px]" : "text-[19px]"} leading-none`}>Zoo flow</h1>
      {!mobile && <span className="shrink-0 whitespace-nowrap text-[13px] font-bold" style={{ color: INK_SOFT }}>{layout ? `${layout.boxes.length} models` : ""}</span>}
      <div className="min-w-0 flex-1" />
      {!mobile && <Legend />}
      {mobile && (
        <button type="button" onClick={() => { setKeyOpen((o) => !o); setPipesOpen(false); }} aria-expanded={keyOpen}
          className={`${s.btn} rounded-[7px] border px-2 py-1 text-[13px] font-bold`} style={{ borderColor: INK }}>Key</button>
      )}
      <button type="button" onClick={() => { setPipesOpen((o) => !o); setKeyOpen(false); }} aria-expanded={pipesOpen}
        className={`${s.btn} shrink-0 rounded-[7px] border px-2 py-1 text-[13px] font-bold`} style={{ borderColor: INK, background: pipe ? ACCENT : "#fff", color: pipe ? "#fff" : INK }}>
        {mobile ? "Pipelines" : `Pipelines ${comps.length}`}
      </button>
      <input list="flow-models" placeholder={mobile ? "Find" : "Find a model"} aria-label="Find a model"
        className={`${mobile ? "w-[84px] min-w-0" : "w-[132px]"} rounded-[7px] border px-2 py-1 text-[13px] font-bold outline-none focus:ring-2`}
        style={{ borderColor: INK, color: INK }}
        onChange={(e) => { const v = e.target.value.trim().replace(/ /g, "_"); if (g?.box.has(v)) { select(v); e.target.value = ""; e.target.blur(); } }} />
      <datalist id="flow-models">{models.map((m) => <option key={m} value={displayName(m)} />)}</datalist>
    </header>
  );

  const pipesPanel = pipesOpen && (
    <div className="absolute right-3 z-50 max-h-[70%] w-[min(420px,calc(100%-24px))] overflow-y-auto rounded-[8px] border bg-white p-2"
      style={{ top: (mobile ? BAR_M : BAR_D) + 6, borderColor: INK, boxShadow: "0 8px 24px rgba(46,39,66,0.14)" }}>
      <p className="px-2 pb-1 pt-1 text-[13px] font-bold" style={{ color: INK_SOFT }}>Pipelines chain models; show one to number its members on the sheet.</p>
      <ul>
        {comps.map((c) => (
          <li key={c.name}>
            <button type="button" onClick={() => { setPipe((p) => (p === c.name ? null : c.name)); setPipesOpen(false); if (focusBox) update({ zoom: "overview" }); }}
              className={`${s.btn} w-full rounded-[6px] px-2 py-1.5 text-left text-[14px] leading-snug hover:bg-[#F3F1F7]`} aria-pressed={pipe === c.name}>
              <b>{displayName(c.name)}</b> <span style={{ color: INK_SOFT }}>{c.composes.map(displayName).join(", ")}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <LabMotion still={still}>
      <div ref={rootRef} data-flow-root className={`${s.page} relative h-full w-full overflow-hidden`} style={{ background: SHEET }}
        data-lab-ready={drawn ? "1" : undefined} data-flow-mode={layout?.mode}
        data-crossings={layout?.audit.crossings} data-overlaps={layout?.audit.overlaps} data-box-hits={layout?.audit.boxHits}
        data-names-placed={layout ? `${layout.boxes.length}/${layout.boxes.length}` : undefined}>
        {!mobile && header}
        {!layout && (
          <p className="absolute left-6 text-[15px] font-bold" style={{ top: BAR_D + 24, color: INK_SOFT }}>
            {taxonomy ? "Routing the sheet…" : "Waiting for the zoo’s API…"}
          </p>
        )}
        {layout && !mobile && cam && (
          <svg ref={svgRef} className="absolute left-0 touch-none select-none" style={{ top: BAR_D, width: stageW, height: stageH }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => { drag.current = null; }}
            data-crossings={layout.audit.crossings} data-overlaps={layout.audit.overlaps} role="img" aria-label="the zoo as a data-flow diagram">
            <g transform={`translate(${cam.tx} ${cam.ty}) scale(${cam.s})`}>{sheetBody}</g>
          </svg>
        )}
        {layout && mobile && (
          <div ref={scrollRef} className="absolute inset-0 overflow-y-auto overflow-x-hidden">
            <div className="sticky top-0 z-40">{header}</div>
            <svg width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} className="mx-auto mt-1 block"
              data-crossings={layout.audit.crossings} data-overlaps={layout.audit.overlaps} role="img" aria-label="the zoo as a data-flow diagram"
              onClick={(e) => { if ((e.target as Element).closest?.("[data-model]") == null && pipe) setPipe(null); }}>
              {sheetBody}
            </svg>
            <div style={{ height: selected ? "56vh" : 24 }} />
          </div>
        )}
        {mobile && keyOpen && (
          <div className="absolute inset-x-3 z-50 rounded-[8px] border bg-white p-3" style={{ top: BAR_M + 6, borderColor: INK, boxShadow: "0 8px 24px rgba(46,39,66,0.14)" }}>
            <Legend column />
          </div>
        )}
        {pipesPanel}
        {pipeInfo && !selected && (
          <div className="absolute bottom-3 left-3 z-30 flex max-w-[min(560px,calc(100%-24px))] items-start gap-3 rounded-[8px] border bg-white px-3 py-2" style={{ borderColor: ACCENT }}>
            <p className="text-[14px] leading-snug"><b>{displayName(pipeInfo.name)}</b>: {COMPOSITION_LESSONS[pipeInfo.name] ?? pipeInfo.description}</p>
            <button type="button" onClick={() => setPipe(null)} className={`${s.btn} shrink-0 text-[13px] font-bold underline`}>Clear</button>
          </div>
        )}
        {card && focusBox && (
          <div className="absolute inset-x-0 bottom-0 z-30" style={{ top: mobile ? 0 : BAR_D, pointerEvents: "none" }}>
            <div className="relative h-full w-full" style={{ pointerEvents: "none" }}>
              <div style={{ pointerEvents: "auto" }}>
                <FlowDrawer c={card} address={focusBox.address} lesson={lesson} mobile={mobile} still={frozen} evidence={evidence}
                  familyOf={familyOf} addressOf={addressOf} onPick={select} onClose={close}
                  onShowPipeline={(n) => { setPipe((p) => (p === n ? null : n)); update({ zoom: "overview" }); }} pipeline={pipe} />
              </div>
            </div>
          </div>
        )}
        {keeper.unlocked && realCurve && <KeeperTrains curve={realCurve} still={frozen} onClose={keeper.reset} />}
      </div>
    </LabMotion>
  );
}
