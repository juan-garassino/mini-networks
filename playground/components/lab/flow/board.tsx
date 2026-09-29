"use client";

// Skin D · Kawaii flow — the zoo as a dataflow board.
// Rows, columns, lanes and same-family routes come from buildFlow;
// geometry.ts turns every lane into its own tray whose columns reserve a name
// slot per creature (so all 44 names fit the overview), packs the trays to
// fill the screen and routes one trunk per parent. The camera never
// re-renders the board per frame (camera.ts): the board is drawn for the
// settled view and moved by one matrix while flying; labels are placed once
// the camera settles.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chevronsAlong, roundedD, type Pt } from "@/lib/world";
import type { ModelEvidence, TaxonomyResponse } from "@/lib/types";
import { iconFor } from "@/lib/icons";
import { useWorld } from "@/hooks/use-world";
import { useLesson } from "@/hooks/use-lesson";
import { useLabView } from "@/components/lab/shared/url-state";
import { LabMotion } from "@/components/lab/shared/still";
import { cardModel, displayName, evidenceState, type EvidenceState } from "@/components/lab/shared/card-model";
import {
  forwardPassOrder, forwardPassSchedule, GROKKING_EGG, stationCounts,
  useKonami, useLiveTraining, useLongFocus, useRealLossCurve, type RealLossCurve,
} from "@/components/lab/shared/eggs";
import { Sparkline } from "@/components/lab/shared/lesson/sparkline";
import { fitView, useFlowCamera, useStageSize, type CamBox, type View } from "./camera";
import { Creature, CreatureDefs, EvidenceGlyph, traitFor, type Trait } from "./creature";
import { FlowCard } from "./card";
import { Parade, STEP, type ParadePipe } from "./parade";
import { Dock, Ferry, ferryPath, GrokBubble, Mascot, NextEraLane, RuinsLane, Trains } from "./extras";
import { layoutBoard, type Board, type BNode } from "./geometry";
import { ACCENT, DOT, fam, hexMix, INK, INK_SOFT, PAPER } from "./palette";
import s from "./flow.module.css";

const CARD_W = 440;
const CAPITAL = 5;             // an atom with ≥ this many children is a capital (pennant)
const TAG_OVER = 30;           // tag px beyond its text: 6 pad · 13 glyph · 5 gap · 6 pad
// tray fabric motifs (56px tile): the family's own creature feature, printed small
const PRINTS: Record<string, string> = {
  perception: "M10 14 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 M38 42 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0",
  sequence: "M6 14 h6 M16 14 h6 M26 14 h6 M34 42 h6 M44 42 h6",
  generative: "M8 16 q4 -6 8 0 q4 -6 8 0 M36 44 q4 -6 8 0 q4 -6 8 0",
  representation: "M12 10 v10 M8 15 h8 M44 38 v10 M40 43 h8",
  structure: "M14 8 l6 4 v7 l-6 4 l-6 -4 v-7 z M42 36 l6 4 v7 l-6 4 l-6 -4 v-7 z",
  decision: "M8 8 h11 v11 h-11 z M36 36 h11 v11 h-11 z",
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const approxWidth = (t: string, px: number) => t.length * px * 0.62;

type R = { x: number; y: number; w: number; h: number };
const hit = (a: R, b: R, m = 0) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
const shrink = (r: R, d: number): R => ({ x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d });

/** A name as one line, or two balanced lines when it has a space and is long. */
function wrapName(text: string): string[] {
  const w = text.split(" ");
  if (text.length <= 12 || w.length < 2) return [text];
  let best = [text], bw = Infinity;
  for (let i = 1; i < w.length; i++) {
    const a = w.slice(0, i).join(" "), b = w.slice(i).join(" ");
    const m = Math.max(a.length, b.length);
    if (m < bw) { bw = m; best = [a, b]; }
  }
  return best;
}

/** ancestors of `f` and each one's longest hop count down to `f`. */
function lineageHops(parents: Map<string, string[]>, f: string) {
  const hops = new Map<string, number>([[f, 0]]);
  const visit = (n: string) => {
    for (const p of parents.get(n) ?? []) {
      const h = hops.get(n)! + 1;
      if ((hops.get(p) ?? -1) < h) { hops.set(p, h); visit(p); }
    }
  };
  visit(f);
  return hops;
}

function KeyItem({ state, label }: { state: EvidenceState; label: string }) {
  return (
    <span className="flex items-center gap-1 whitespace-nowrap text-[13px] font-bold">
      <svg viewBox="-24 -30 48 54" className="h-7 w-7" aria-hidden>
        <Creature family="perception" atom={false} state={state} />
      </svg>
      <svg viewBox="-8 -8 16 16" className="h-[14px] w-[14px]" aria-hidden><EvidenceGlyph state={state} /></svg>
      {label}
    </span>
  );
}

/** One creature, memoised: camera frames never touch it. */
const CreatureNode = memo(function CreatureNode({ name, family, depth, cx, cy, kk, capital, st, trait, sel, dim, bounce, bounceKey, bounceDelay, eureka, onSelect, onHover }: {
  name: string; family: string; depth: number; cx: number; cy: number; kk: number; capital: boolean; st: EvidenceState;
  trait: Trait; sel: boolean; dim: boolean; bounce: boolean; bounceKey: string; bounceDelay: number; eureka: boolean;
  onSelect: (n: string) => void; onHover: (n: string | null, on: boolean) => void;
}) {
  return (
    <g transform={`translate(${cx} ${cy})`} className={s.node} tabIndex={0} role="button" opacity={dim ? 0.45 : 1}
      aria-label={`${displayName(name)}, ${fam(family).label}, ${st}`}
      onClick={() => onSelect(name)}
      onPointerEnter={() => onHover(name, true)} onPointerLeave={() => onHover(name, false)}
      onFocus={() => onHover(name, true)} onBlur={() => onHover(name, false)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(name); } }}>
      <title>{displayName(name)}</title>
      <circle className={s.ring} r={30 * kk} fill="none" stroke={INK} strokeWidth={3} strokeDasharray="5 4" />
      {sel && <circle r={32 * kk} fill="#fff" stroke={ACCENT} strokeWidth={3} />}
      <circle r={24 * kk} fill="transparent" />
      <g transform={`scale(${kk})`}>
        <g key={bounce ? bounceKey : "idle"} className={bounce ? s.bounce : undefined}
          style={bounce && bounceDelay ? { animationDelay: `${bounceDelay}ms` } : undefined}>
          <Creature family={family} atom={depth === 0} capital={capital} state={st}
            emblem={iconFor(name)} trait={trait} eureka={eureka} />
        </g>
      </g>
    </g>
  );
});

/** The keeper's popover (own animation state — never re-renders the board). */
function KeeperTrains({ curve, still }: { curve: RealLossCurve; still: boolean }) {
  const [p, setP] = useState(still ? 1 : 0);
  useEffect(() => {
    if (still) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => { const u = Math.min(1, (now - t0) / 2600); setP(u); if (u < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [curve, still]);
  return (
    <div className="absolute left-4 top-[76px] z-40 w-[300px] rounded-2xl border-2 bg-white p-3" style={{ borderColor: INK, boxShadow: `0 4px 0 ${INK}` }}>
      <p className={`${s.display} text-[15px]`}>Fine, I&apos;ll train.</p>
      <Sparkline points={curve.points} progress={p} label={curve.key.replace(/_/g, " ")} width={272} height={70}
        palette={{ line: ACCENT, axis: "#C9BFE8", text: INK, fill: "rgba(214,51,108,0.12)" }} title="a real loss curve" />
      <p className="mt-1 text-[13px] font-bold" style={{ color: INK_SOFT }}>a real run: {curve.model.replace(/_/g, " ")}, {curve.runId}</p>
    </div>
  );
}

function useGraph(flow: ReturnType<typeof useWorld>["flow"], taxonomy: TaxonomyResponse | null) {
  return useMemo(() => {
    if (!flow || !taxonomy) return null;
    const names = new Set(flow.nodes.map((n) => n.name));
    const parents = new Map<string, string[]>(flow.nodes.map((n) => [n.name, []]));
    const children = new Map<string, string[]>(flow.nodes.map((n) => [n.name, []]));
    for (const m of taxonomy.models) {
      if (!names.has(m.name)) continue;
      for (const p of m.builds_on) if (names.has(p)) { parents.get(m.name)!.push(p); children.get(p)!.push(m.name); }
    }
    const laneAtom = new Map<string, string>();
    const laneCount = new Map<string, number>();
    for (const n of flow.nodes) {
      laneCount.set(n.family, (laneCount.get(n.family) ?? 0) + 1);
      const cur = laneAtom.get(n.family);
      if (n.depth === 0 && (!cur || children.get(n.name)!.length > children.get(cur)!.length)) laneAtom.set(n.family, n.name);
    }
    const famOf = new Map(flow.nodes.map((n) => [n.name, n.family]));
    const docks = new Map<string, { name: string; label: string }[]>();
    for (const c of taxonomy.compositions) {
      const fams = new Set(c.composes.filter((m) => names.has(m)).map((m) => famOf.get(m)!));
      for (const f of fams) docks.set(f, [...(docks.get(f) ?? []), { name: c.name, label: `${displayName(c.name)}: ${c.description}` }]);
    }
    const traits = new Map(taxonomy.models.map((m) => [m.name, traitFor(m.introduces)]));
    return { parents, children, laneAtom, laneCount, docks, traits };
  }, [flow, taxonomy]);
}

export function FlowBoard() {
  const { view, update } = useLabView();
  const still = view?.still ?? true;
  const { taxonomy, runs, evidence, flow, online, ready } = useWorld(view ? view.still : null);
  const { ref, size } = useStageSize();
  const mobile = size.w > 0 && size.w < 640;
  const headerH = mobile ? 58 : 72;
  const EDGE = mobile ? 8 : 16;

  // ——— font measurement (name slots are sized from real glyph widths) ———
  const probe = useRef<HTMLSpanElement | null>(null);
  const measure = useRef(approxWidth);
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    const el = probe.current;
    if (!el) return;
    const family = getComputedStyle(el).fontFamily;
    const ctx = document.createElement("canvas").getContext("2d");
    let alive = true;
    const done = () => {
      if (!alive) return;
      if (ctx) measure.current = (t, px) => { ctx.font = `${px}px ${family}`; return ctx.measureText(t).width; };
      setFontsReady(true);
    };
    document.fonts.load(`13px ${family}`).then(() => document.fonts.ready).then(done, done);
    return () => { alive = false; };
  }, []);
  const lineW = useCallback((lines: string[], px: number) => Math.max(...lines.map((l) => measure.current(l, px))), []);

  const graph = useGraph(flow, taxonomy);
  const board: Board | null = useMemo(() => {
    if (!flow || !graph || !fontsReady || size.w === 0) return null;
    return layoutBoard(flow, graph.children,
      (name, atom) => lineW(wrapName(displayName(name)), atom ? 14 : 13) + TAG_OVER + 2, mobile ? 1 : 2);
  }, [flow, graph, fontsReady, mobile, size.w > 0, lineW]); // eslint-disable-line react-hooks/exhaustive-deps

  const evBy = useMemo(() => new Map<string, ModelEvidence>(evidence.map((e) => [e.name, e])), [evidence]);
  const stations = useMemo(() => stationCounts(runs), [runs]);
  const live = useLiveTraining(runs);

  const focusNode = view?.focus && board ? board.nodes.get(view.focus) ?? null : null;
  const zoom = view && focusNode ? view.zoom : "overview";

  // ——— camera target (uniform scale everywhere) ———
  const target: View | null = useMemo(() => {
    if (!board || !graph || size.w === 0) return null;
    if (zoom === "region" && focusNode) {
      const l = board.lanes.find((q) => q.index === focusNode.lane)!;
      const box = { x: l.x - 10, y: l.y - 10, w: l.w + 20, h: l.h + 20 };
      if (mobile) {
        const sc = Math.min(1.1, (size.w - 16) / box.w);
        return { sx: sc, sy: sc, tx: 8 - box.x * sc, ty: headerH + 10 - box.y * sc };
      }
      return fitView(box, { x: 24, y: headerH + 12, w: size.w - 48, h: size.h - headerH - 24 }, 1, 1.8);
    }
    if (zoom === "node" && focusNode) {
      const b: CamBox = { x: focusNode.x - board.R, y: focusNode.y - board.R * 1.1, w: focusNode.slotEnd - focusNode.x + board.R, h: board.R * 2.2 };
      const pad: CamBox = { x: b.x - b.w * 0.6, y: b.y - b.h * 1.2, w: b.w * 2.2, h: b.h * 3.4 };
      const nodeAvail: CamBox = mobile
        ? { x: 8, y: headerH + 8, w: size.w - 16, h: size.h * 0.52 - headerH - 16 }
        : { x: 24, y: headerH + 12, w: size.w - CARD_W - 16 - 72, h: size.h - headerH - 36 };
      let box = pad;
      for (const p of graph.parents.get(focusNode.name) ?? []) {
        const q = board.nodes.get(p)!;
        const x0 = Math.min(box.x, q.x - board.R * 1.5), y0 = Math.min(box.y, q.y - board.R * 1.6);
        const x1 = Math.max(box.x + box.w, q.slotEnd + board.R * 0.5), y1 = Math.max(box.y + box.h, q.y + board.R * 1.8);
        box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      }
      const wide = fitView(box, nodeAvail, 1, 2);
      const cv = wide.sx >= board.s0 * (mobile ? 1.2 : 1.6) ? wide : fitView(pad, nodeAvail, 1, 2);
      const fx = focusNode.x * cv.sx + cv.tx;
      const fy = focusNode.y * cv.sy + cv.ty;
      if (mobile) cv.ty += size.h * 0.54 - 8 - 90 - fy;
      else cv.tx += Math.max(0, size.w - 16 - CARD_W - 240 - fx);
      return cv;
    }
    if (mobile) {
      const sc = (size.w - 2 * EDGE) / board.width;
      return { sx: sc, sy: sc, tx: EDGE, ty: headerH + 8 };
    }
    const sc = Math.min((size.w - 2 * EDGE) / board.width, (size.h - headerH - 20) / board.height);
    return { sx: sc, sy: sc, tx: (size.w - board.width * sc) / 2, ty: headerH + 10 + Math.max(0, (size.h - headerH - 20 - board.height * sc) / 2) };
  }, [board, graph, size.w, size.h, zoom, focusNode, mobile, headerH, EDGE]);

  const cam = useFlowCamera(target, still);
  const v = cam.view;
  // the card and the parade wait for the camera to land: one orchestrated
  // moment per interaction, and the heavy card never mounts mid-flight
  const landedCam = !!v && !!target && Math.abs(v.sx - target.sx) < 1e-4 && Math.abs(v.tx - target.tx) < 0.5 && Math.abs(v.ty - target.ty) < 0.5;
  const [cardOn, setCardOn] = useState<string | null>(null);

  // ——— selection, hover, parade, bounce ———
  const [run, setRun] = useState(0);
  const [landed, setLanded] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const onHover = useCallback((n: string | null, on: boolean) => setHover((h) => (on ? n : h === n ? null : h)), []);
  const select = useCallback((name: string) => {
    setRun((r) => r + 1);
    update({ zoom: "node", focus: name });
  }, [update]);
  const selected = zoom === "node" && focusNode ? focusNode.name : null;
  const lit = selected ?? hover;
  const runKey = `${selected}:${run}`;
  const hops = useMemo(() => (graph && selected ? lineageHops(graph.parents, selected) : null), [graph, selected]);
  const litHops = useMemo(() => (graph && lit ? lineageHops(graph.parents, lit) : null), [graph, lit]);
  const litSet = useMemo(() => {
    if (!graph || !lit || !litHops) return null;
    return new Set([...litHops.keys(), ...(graph.children.get(lit) ?? [])]);
  }, [graph, lit, litHops]);
  const paradePipes: ParadePipe[] = useMemo(() => {
    if (!board || !hops) return [];
    const H = Math.max(0, ...hops.values());
    return board.pipes
      .filter((p) => hops.has(p.from) && hops.has(p.to) && hops.get(p.from)! > hops.get(p.to)!)
      .map((p) => ({ id: p.id, points: p.pts, fromFamily: board.nodes.get(p.from)!.family, start: (H - hops.get(p.from)!) * STEP }));
  }, [board, hops]);

  // ——— ferries (compositions) ———
  const [ferry, setFerry] = useState<{ name: string; key: number } | null>(null);
  const sail = useCallback((name: string) => setFerry((f) => (f?.name === name ? null : { name, key: (f?.key ?? 0) + 1 })), []);

  // ——— eggs ———
  // Konami: ONE render starts the wave; CSS animation-delays carry it through the generations.
  const [wave, setWave] = useState(0);
  const [waveOnNow, setWaveOnNow] = useState(false);
  const schedule = useMemo(() => (board ? forwardPassSchedule(forwardPassOrder({ nodes: board.list }), 520) : {}), [board]);
  const waveEnd = useMemo(() => Math.max(0, ...Object.values(schedule)) + 1000, [schedule]);
  useKonami(useCallback(() => { setWave((w) => w + 1); setWaveOnNow(true); }, []), !still);
  useEffect(() => {
    if (!waveOnNow) return;
    const t = setTimeout(() => setWaveOnNow(false), waveEnd);
    return () => clearTimeout(t);
  }, [waveOnNow, wave, waveEnd]);

  const grokHeld = useLongFocus(!still && hover === GROKKING_EGG.model ? GROKKING_EGG.model : null, GROKKING_EGG.holdMs);

  const mascotRef = useRef({ n: 0, last: 0 });
  const [mascotN, setMascotN] = useState(0);
  const [training, setTraining] = useState(false);
  const mascotClick = useCallback(() => {
    const now = Date.now();
    const m = mascotRef.current;
    m.n = now - m.last <= 2500 ? m.n + 1 : 1;
    m.last = now;
    setMascotN(m.n);
    if (m.n >= 7) setTraining(true);
  }, []);
  const { curve: realCurve } = useRealLossCurve(runs, training && !still);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (training) { setTraining(false); mascotRef.current.n = 0; setMascotN(0); }
      else if (zoom === "node") update({ zoom: "region" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom, update, training]);

  // ——— ready marker ———
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (!ready || !fontsReady || !v) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => { inner = requestAnimationFrame(() => setDrawn(true)); });
    const t = setTimeout(() => setDrawn(true), 250);
    return () => { cancelAnimationFrame(outer); cancelAnimationFrame(inner); clearTimeout(t); };
  }, [ready, fontsReady, v]);

  // ——— test hook for scripts/shoot.mjs --motion ———
  useEffect(() => {
    if (!drawn) return;
    const w = window as unknown as { __lab?: unknown };
    w.__lab = {
      select: (name: string) => select(name),
      view: (nv: { zoom: "overview" | "region" | "node"; focus?: string }) =>
        update(nv.focus !== undefined ? { zoom: nv.zoom, focus: nv.focus } : { zoom: nv.zoom }),
      critterClick: (n: number) => { for (let i = 0; i < n; i++) mascotClick(); },
    };
    return () => { delete w.__lab; };
  }, [drawn, select, update, mascotClick]);

  useEffect(() => { if (landedCam && selected) setCardOn(selected); else if (!selected) setCardOn(null); }, [landedCam, selected]);
  const card = useMemo(() => {
    if (!selected || !taxonomy || !focusNode || cardOn !== selected) return null;
    return cardModel(selected, { taxonomy, evidence, runs, family: focusNode.family, depth: focusNode.depth });
  }, [selected, taxonomy, focusNode, evidence, runs, cardOn]);
  const lesson = useLesson(card ? selected : null, { runs, evidence, still: view ? view.still : null });

  // ——— screen geometry + labels, for the SETTLED view only ———
  const scene = useMemo(() => {
    if (!v || !board || !graph) return null;
    const sc = v.sx;
    const X = (x: number) => x * sc + v.tx;
    const Y = (y: number) => y * sc + v.ty;
    const z = sc / board.s0;                         // 1 at the overview design
    // creature scale: 1 at the overview design; when zoomed in, as big as the row pitch allows
    const pitch = 84 * sc;
    const k = z <= 1 ? clamp(z, 0.3, 1) : Math.max(1, Math.min(z, pitch / 58, 1.6));
    const font = Math.round(clamp(13 * Math.sqrt(Math.max(1, z)), 13, 16));
    const tube = clamp(5.2 * Math.sqrt(k), 2.4, 8);

    const nodes = board.list.map((n) => {
      const atom = n.depth === 0;
      const kids = graph.children.get(n.name)!.length;
      const sel = n.name === selected;
      const kk = k * (sel ? 1.3 : 1);
      const cx = X(n.x), cy = Y(n.y);
      const half = 23 * kk;
      const top = (atom ? (kids >= CAPITAL ? 44 : 32) : n.family === "decision" ? 30 : 26) * kk;
      const body: R = { x: cx - half - (n.family === "sequence" ? 4 * kk : 0), y: cy - top, w: 2 * half, h: top + 24 * kk };
      return { n, atom, kids, kk, cx, cy, body, sel };
    });

    const pipes = board.pipes.map((p) => ({ ...p, spts: p.pts.map((q) => ({ x: X(q.x), y: Y(q.y) })) }));
    const segs: (R & { from: string })[] = [];
    const pad = tube / 2 + 1;
    for (const p of pipes) {
      if (p.crossLane) continue;           // cross-family edges are portals until lit
      for (let i = 1; i < p.spts.length - 1; i++) {   // (the first run is replaced by the tag's own exit below)
        const a = p.spts[i], b = p.spts[i + 1];
        segs.push({ from: p.from, x: Math.min(a.x, b.x) - pad, y: Math.min(a.y, b.y) - pad, w: Math.abs(a.x - b.x) + 2 * pad, h: Math.abs(a.y - b.y) + 2 * pad });
      }
    }

    const cardLeft = selected && !mobile ? size.w - 16 - CARD_W - 12 : size.w;
    const stage: R = {
      x: EDGE, y: headerH + 4,
      w: Math.min(cardLeft, size.w - EDGE) - EDGE,
      h: (selected && mobile ? size.h * 0.54 - 12 : size.h - EDGE / 2) - headerH - 4,
    };
    const inside = (r: R) => r.x >= stage.x && r.y >= stage.y && r.x + r.w <= stage.x + stage.w && r.y + r.h <= stage.y + stage.h;

    // trays, tabs, generation headers, harbours
    const showChrome = z > 0.55;
    const trays = board.lanes.map((l) => ({ l, x: X(l.x), y: Y(l.y), w: l.w * sc, h: l.h * sc }));
    const tabs = showChrome ? trays.map(({ l, x, y, w }) => {
      const f = fam(l.family);
      const t1 = f.label, t2 = `${graph.laneCount.get(l.family) ?? 0} ${f.kind}`;
      const w1 = measure.current(t1, 14), w2 = measure.current(t2, 13) * 0.82;
      const tw = w1 + w2 + 30;
      return { family: l.family, t1, t2, w1, r: { x: Math.max(x + 6, x + w - 14 - tw), y: y - 12, w: tw, h: 24 } };
    }) : [];
    const heads = showChrome && z > 0.75 ? board.heads.flatMap((h) => {
      const text = h.depth === 0 ? "Atoms" : `Gen ${h.depth}`;
      const x = X(h.x), y = Y(h.y) + 4;
      const r: R = { x: x - 22, y: y - 9, w: 44, h: 18 };
      if (tabs.some((t) => hit(r, t.r, 4))) return [];
      return [{ key: `${h.lane}:${h.depth}`, x, y, text }];
    }) : [];
    const docks = showChrome ? trays.map(({ l, x, y, w, h }) => {
      const all = graph.docks.get(l.family) ?? [];
      const boats = all.slice(0, 3);
      const more = all.length - boats.length;
      const dx = x + w - 14, dy = y + h + 4;
      const dw = boats.length * 34 + (more > 0 ? 34 : 0) + 12;
      return { family: l.family, x: dx, y: dy, boats, all, more, r: { x: dx - dw, y: dy - 30, w: dw + 4, h: 38 } };
    }) : [];

    // portals: cross-family edges at rest — a short pipe end on the child's upper-left
    const portals = pipes.filter((p) => p.crossLane).map((p) => {
      const q = nodes.find((o) => o.n.name === p.to)!;
      const idx = pipes.filter((o) => o.crossLane && o.to === p.to).findIndex((o) => o.id === p.id);
      const r = clamp(9 * Math.sqrt(k), 7, 12);
      const cx = q.cx - 24 * q.kk - r, cy = q.cy - 20 * q.kk - idx * (2 * r + 5);
      return { id: p.id, from: p.from, to: p.to, cx, cy, r, ex: q.cx - 14 * q.kk, ey: q.cy - 10 * q.kk };
    });

    // name tags: every creature owns a slot to its right; fall back to a
    // collision-checked spot (atoms first, then hubs) only when the slot is too small
    const lineH = font * 1.12;
    const placed: R[] = [...tabs.map((t) => t.r), ...docks.filter((d) => d.boats.length).map((d) => d.r),
      ...portals.map((o) => ({ x: o.cx - o.r - 2, y: o.cy - o.r - 2, w: 2 * o.r + 4, h: 2 * o.r + 4 }))];
    const tags = new Map<string, { x: number; y: number; w: number; h: number; fs: number; lines: string[]; chip: string | null }>();
    const order = [...nodes].sort((a, b) =>
      Number(b.sel) - Number(a.sel) || Number(b.atom) - Number(a.atom) || b.kids - a.kids
      || a.n.depth - b.n.depth || (a.n.name < b.n.name ? -1 : 1));
    for (const q of order) {
      const text = displayName(q.n.name);
      const fs = q.atom ? font + 1 : font;
      // the slot starts at the creature's (screen-size) side, ends at its reserved world end
      const slotX = Math.min(X(q.n.slotStart), q.cx + 24 * q.kk + 6), slotW = X(q.n.slotEnd) - slotX;
      const count = stations[q.n.name] ?? 0;
      const chip = live.includes(q.n.name) ? "live" : count > 0 ? String(count) : null;
      const chipW = chip ? measure.current(chip, 12) + 12 : 0;
      const one = measure.current(text, fs) + TAG_OVER;
      const lines = one + chipW <= slotW + 2 ? [text] : wrapName(text);
      const w0 = lines.length === 1 ? one : lineW(lines, fs) + TAG_OVER;
      const w = w0 + (w0 + chipW <= slotW + 2 ? chipW : 0);
      const h = lines.length * lineH + 9;
      const slot: R = { x: slotX, y: q.cy - h / 2, w, h };
      const clear = (r: R) => inside(r) && !nodes.some((o) => o !== q && hit(shrink(r, 1), o.body)) && !placed.some((o) => hit(r, o, 2));
      let pick: R | undefined;
      if (w <= slotW + 3 && inside(slot)) pick = slot;
      if (!pick) {
        const under: R = { x: q.cx - w / 2, y: q.cy + 24 * q.kk + 2, w, h };
        const left: R = { x: q.cx - 26 * q.kk - w, y: q.cy - h / 2, w, h };
        const cands = q.atom ? [slot, left, under] : [slot, under, left];
        // atoms keep their name even over a pipe; everyone else never sits on a foreign pipe
        pick = cands.find((r) => clear(r) && (q.atom || !segs.some((sg) => sg.from !== q.n.name && hit(shrink(r, 2), sg))));
        if (!pick && q.sel) pick = cands.find(clear) ?? slot;
      }
      if (!pick) continue;
      placed.push(pick);
      tags.set(q.n.name, { x: pick.x, y: pick.y, w: pick.w, h: pick.h, fs, lines, chip: pick.w > w0 + 1 ? chip : null });
    }
    // every same-family pipe leaves from the END of its parent's name tag (or the creature's side)
    for (const p of pipes) {
      if (p.crossLane || p.spts.length < 2) continue;
      const t = tags.get(p.from);
      const q = nodes.find((o) => o.n.name === p.from)!;
      const x0 = t && Math.abs(t.y + t.h / 2 - q.cy) < 2 && t.x > q.cx ? t.x + t.w : q.cx + 24 * q.kk;
      if (x0 < p.spts[1].x - 2) p.spts[0] = { x: x0, y: p.spts[0].y };
    }
    return { X, Y, sc, z, k, tube, font, lineH, nodes, pipes, tags, tabs, heads, docks, trays, portals };
  }, [v, board, graph, size.w, size.h, mobile, zoom, selected, headerH, EDGE, live, stations, lineW]);

  // overview invariant: at the 1440×900 design every creature is named
  const placedCount = scene?.tags.size ?? 0;
  useEffect(() => {
    if (!scene || zoom !== "overview" || mobile || size.w < 1400 || size.h < 880) return;
    if (placedCount < scene.nodes.length) console.warn(`[flow] overview named ${placedCount}/${scene.nodes.length} creatures`);
  }, [scene, zoom, mobile, size.w, size.h, placedCount]);

  const pipeD = useMemo(() => {
    if (!scene) return [];
    return scene.pipes.map((p) => {
      let role: "anc" | "kid" | "dim" | "rest" = "rest";
      if (litHops && lit) {
        role = litHops.has(p.from) && litHops.has(p.to) && litHops.get(p.from)! > litHops.get(p.to)! ? "anc" : p.from === lit ? "kid" : "dim";
      }
      const cross = p.crossLane;
      const shown = !cross || (lit !== null && (p.from === lit || p.to === lit || role === "anc"));
      const chev = (role === "anc" || role === "kid" || cross || scene.z >= 1.3) ? chevronsAlong(p.spts, 64, 22) : [];
      return { id: p.id, d: cross ? p.spts.map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(" ") : roundedD(p.spts, 12), from: p.from, role, cross, shown, chev, spts: p.spts };
    });
  }, [scene, litHops, lit]);

  const ferryDraw = useMemo(() => {
    if (!ferry || !scene || !taxonomy || !board) return null;
    const comp = taxonomy.compositions.find((c) => c.name === ferry.name);
    if (!comp) return null;
    const members = comp.composes.filter((m) => board.nodes.has(m));
    if (!members.length) return null;
    const home = board.nodes.get(members[0])!.family;
    const dock = scene.docks.find((d) => d.family === home);
    const bi = dock ? dock.boats.findIndex((b) => b.name === comp.name) : -1;
    const start = dock ? { x: dock.x - (dock.boats.length + (dock.more > 0 ? 1 : 0)) * 34 - 12 + 20 + Math.max(0, bi) * 34, y: dock.y - 6 } : null;
    const stops = members.map((m) => { const q = scene.nodes.find((n) => n.n.name === m)!; return { x: q.cx, y: q.cy }; });
    const all = start ? [start, ...stops, start] : stops.length > 1 ? stops : [stops[0], { x: stops[0].x + 60, y: stops[0].y - 50 }, stops[0]];
    return { path: ferryPath(all, comp.name === "double_descent"), label: displayName(comp.name) };
  }, [ferry, scene, taxonomy, board]);

  const trainRoutes = useMemo(() => (scene ? scene.pipes.filter((p) => live.includes(p.to) && !p.crossLane).map((p) => ({ id: p.id, pts: p.spts })) : []), [scene, live]);

  // ——— the speech-bubble tail from the card to the focused creature ———
  const tail = (() => {
    if (!scene || !selected || !card) return null;
    const me = scene.nodes.find((q) => q.n.name === selected);
    if (!me) return null;
    const myTag = scene.tags.get(selected);
    if (mobile) {
      const top = size.h * 0.54;
      const tip = { x: me.cx, y: me.cy + 24 * me.kk + (myTag && myTag.y > me.cy ? myTag.h + 8 : 6) };
      if (tip.y > top - 16) return null;
      const bx = clamp(tip.x, 44, size.w - 44);
      return { fill: `M${bx - 16} ${top + 4} Q${bx - 4} ${(top + tip.y) / 2} ${tip.x} ${tip.y} Q${bx + 8} ${(top + tip.y) / 2} ${bx + 16} ${top + 4} Z`,
        line: `M${bx - 16} ${top + 1.5} Q${bx - 4} ${(top + tip.y) / 2} ${tip.x} ${tip.y} Q${bx + 8} ${(top + tip.y) / 2} ${bx + 16} ${top + 1.5}` };
    }
    const left = size.w - 16 - CARD_W;
    const tip = { x: (myTag ? Math.max(me.cx + 26 * me.kk, myTag.x + myTag.w + 6) : me.cx + 26 * me.kk), y: me.cy - 4 * me.kk };
    if (tip.x > left - 24) return null;
    const by = clamp(tip.y, 80 + 60, size.h - 80);
    const mx = (left + tip.x) / 2;
    return { fill: `M${left + 4} ${by - 18} Q${mx} ${by - 6} ${tip.x} ${tip.y} Q${mx} ${by + 10} ${left + 4} ${by + 18} Z`,
      line: `M${left + 1.5} ${by - 18} Q${mx} ${by - 6} ${tip.x} ${tip.y} Q${mx} ${by + 10} ${left + 1.5} ${by + 18}` };
  })();

  const familyOf = useCallback((n: string) => board?.nodes.get(n)?.family ?? "", [board]);
  const crumbs = focusNode && zoom !== "overview" ? fam(focusNode.family).label : null;
  const grok = scene?.nodes.find((q) => q.n.name === GROKKING_EGG.model);

  // a soft tube with opaque layers (a shared spine never darkens where pipes overlap)
  const renderPipe = (p: (typeof pipeD)[number]) => {
    if (!scene || !board) return null;
    const f = fam(board.nodes.get(p.from)!.family);
    const on = p.role === "anc" || p.role === "kid";
    const w = on ? scene.tube + 1.5 : scene.tube;
    const rim = on || p.cross ? INK : hexMix(INK, PAPER, 0.45);
    return (
      <g key={p.id} opacity={p.role === "dim" ? 0.22 : 1} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {p.role === "anc" && (
          <>
            <path d={p.d} stroke={hexMix(ACCENT, PAPER, 0.8)} strokeWidth={w + 12} />
            <path d={p.d} stroke="#fff" strokeWidth={w + 7} />
          </>
        )}
        {p.cross && p.role !== "anc" && <path d={p.d} stroke="#fff" strokeWidth={w + 7} />}
        <path d={p.d} stroke={rim} strokeWidth={w + 3} />
        <path d={p.d} stroke={f.fill} strokeWidth={w} />
        <path d={p.d} stroke={hexMix(f.fill, f.deep, 0.45)} strokeWidth={Math.max(1, w * 0.3)} transform={`translate(${w * 0.22} ${w * 0.26})`} />
        <path d={p.d} stroke="#fff" strokeWidth={Math.max(1, w * 0.24)} transform={`translate(${-w * 0.2} ${-w * 0.22})`} />
        {waveOnNow && (
          <path key={`w${wave}`} d={p.d} stroke={ACCENT} strokeWidth={w + 2} className={s.flash}
            style={{ animationDelay: `${schedule[p.from] ?? 0}ms` }} />
        )}
        {p.chev.map((c, i) => (
          <path key={i} d="M-2.5 -3 L1.5 0 L-2.5 3" stroke={INK} strokeOpacity={0.6} strokeWidth={1.6}
            transform={`translate(${c.x} ${c.y}) rotate(${(c.angle * 180) / Math.PI}) scale(${Math.min(1.4, w / 5)})`} />
        ))}
      </g>
    );
  };

  return (
    <LabMotion still={still}>
      <div data-lab-ready={drawn ? "1" : undefined} data-names-placed={scene ? `${placedCount}/${scene.nodes.length}` : undefined}
        className={`${s.stage} relative h-full overflow-hidden`}>
        <span ref={probe} className={`${s.display} pointer-events-none absolute -left-[9999px] top-0`} aria-hidden>Aa</span>
        <svg className="pointer-events-none absolute h-0 w-0" aria-hidden><CreatureDefs /></svg>

        <div ref={ref} {...cam.handlers} className="absolute inset-0 touch-none select-none">
          {scene && v && board && graph && (
            <svg className="h-full w-full" role="application" aria-label="Dataflow board of the model zoo">
              <defs>
                <pattern id="flow-dots" patternUnits="userSpaceOnUse" x={v.tx} y={v.ty} width={42 * scene.sc} height={42 * scene.sc}>
                  <circle cx={1.5} cy={1.5} r={1.5} fill={DOT} />
                </pattern>
                {Object.keys(PRINTS).map((f) => (
                  <pattern key={f} id={`fp-${f}`} patternUnits="userSpaceOnUse" width={56} height={56}
                    patternTransform={`translate(${v.tx} ${v.ty}) scale(${Math.max(0.6, scene.z)})`}>
                    <path d={PRINTS[f]} fill="none" stroke={fam(f).deep} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" opacity={0.2} />
                  </pattern>
                ))}
              </defs>
              <rect width="100%" height="100%" fill={PAPER} />
              <g ref={cam.gRef}>
                <rect x={-4000} y={-4000} width={12000} height={12000} fill="url(#flow-dots)" />

                {/* off-chart lanes: drawn only when fully in view — never a clipped tease */}
                {[board.ruins, board.next].map((b, i) => {
                  const x = scene.X(b.x), y = scene.Y(b.y), w = b.w * scene.sc, h = b.h * scene.sc;
                  if (x < 8 || y < headerH + 8 || x + w > size.w - 8 || y + h > size.h - 8) return null;
                  return i === 0
                    ? <RuinsLane key="ruins" x={x} y={y} w={w} h={h} sc={scene.z * 0.6} />
                    : <NextEraLane key="next" x={x} y={y} w={w} h={h} sc={scene.z * 0.6} />;
                })}

                {/* lane trays: felt with thickness, printed with the family's motif */}
                {scene.trays.map(({ l, x, y, w, h }) => {
                  const f = fam(l.family);
                  const rx = clamp(18 * scene.k, 8, 24);
                  return (
                    <g key={l.family}>
                      <rect x={x + 3} y={y + 10} width={w} height={h} rx={rx} fill={INK} fillOpacity={0.1} />
                      <rect x={x} y={y + 6} width={w} height={h} rx={rx} fill={f.deep} fillOpacity={0.55} />
                      <rect x={x} y={y} width={w} height={h} rx={rx} fill={PAPER} />
                      <rect x={x} y={y} width={w} height={h} rx={rx} fill={f.fill} fillOpacity={0.3} />
                      <rect x={x} y={y} width={w} height={h} rx={rx} fill={`url(#fp-${l.family})`} />
                      <rect x={x} y={y} width={w} height={h} rx={rx} fill="none" stroke={f.deep} strokeOpacity={0.5} strokeWidth={1.5} />
                    </g>
                  );
                })}

                {/* generation headers, inside each tray above its columns */}
                {scene.heads.map((h) => (
                  <text key={h.key} x={h.x} y={h.y} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={800} fill={INK_SOFT}>{h.text}</text>
                ))}

                {/* pipes = builds_on inside a family: one trunk per parent, branching at each child's row */}
                {[...pipeD].filter((p) => !p.cross).sort((a, b) => Number(a.role !== "dim") - Number(b.role !== "dim")).map(renderPipe)}

                {/* harbours: up to three moored ferries per family (+ how many more) */}
                {scene.docks.map((d) => d.boats.length > 0 && (
                  <Dock key={d.family} x={d.x} y={d.y} boats={d.boats} more={d.more} all={d.all} sailing={ferry?.name ?? null} onSail={sail} />
                ))}

                {/* creatures */}
                {scene.nodes.map(({ n, cx, cy, kk, kids, sel }) => (
                  <CreatureNode key={n.name} name={n.name} family={n.family} depth={n.depth} cx={cx} cy={cy} kk={kk}
                    capital={kids >= CAPITAL} st={evidenceState(evBy.get(n.name))} trait={graph.traits.get(n.name) ?? null}
                    sel={sel} dim={litSet !== null && !litSet.has(n.name)}
                    bounce={(sel && landed === runKey && !still) || waveOnNow}
                    bounceKey={waveOnNow ? `w${wave}` : `b${runKey}`} bounceDelay={waveOnNow ? schedule[n.name] ?? 0 : 0}
                    eureka={n.name === GROKKING_EGG.model && grokHeld} onSelect={select} onHover={onHover} />
                ))}

                {live.length > 0 && <Trains routes={trainRoutes} still={still} size={clamp(scene.tube * 1.9, 9, 16)} />}

                {/* name tags: evidence glyph + name (+ local run count when there is room) */}
                {scene.nodes.map(({ n, sel }) => {
                  const t = scene.tags.get(n.name);
                  if (!t) return null;
                  const atom = n.depth === 0;
                  const st = evidenceState(evBy.get(n.name));
                  const dim = litSet !== null && !litSet.has(n.name);
                  const textW = Math.max(...t.lines.map((l) => measure.current(l, t.fs)));
                  const ty0 = t.y + t.h / 2 - ((t.lines.length - 1) * scene.lineH) / 2;
                  return (
                    <g key={n.name} pointerEvents="none" opacity={dim ? 0.7 : 1}>
                      <rect x={t.x} y={t.y} width={t.w} height={t.h} rx={Math.min(t.h / 2, 13)}
                        fill={sel ? INK : atom ? fam(n.family).fill : "#fff"} stroke={INK} strokeWidth={atom || sel ? 2 : 1.4} />
                      <g transform={`translate(${t.x + 12.5} ${t.y + t.h / 2})`}>
                        {sel && <circle r={7.6} fill="#fff" />}
                        <EvidenceGlyph state={st} />
                      </g>
                      <text x={t.x + 24} fontSize={t.fs} className={s.display} fill={sel ? "#fff" : INK}>
                        {t.lines.map((l, i) => (
                          <tspan key={i} x={t.x + 24} y={ty0 + i * scene.lineH + 0.5} dominantBaseline="central">{l}</tspan>
                        ))}
                      </text>
                      {t.chip && (
                        <g transform={`translate(${t.x + 24 + textW + 5} ${t.y + t.h / 2 - 8})`}>
                          <rect width={measure.current(t.chip, 12) + 10} height={16} rx={8} fill={t.chip === "live" ? ACCENT : sel ? "#fff" : "#EDE8FF"} />
                          <text x={(measure.current(t.chip, 12) + 10) / 2} y={8.5} textAnchor="middle" dominantBaseline="central"
                            fontSize={12} fontWeight={800} fill={t.chip === "live" ? "#fff" : INK}>{t.chip}</text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* lane tabs: family, count and the silhouette it wears — attached to the tray */}
                {scene.tabs.map((t) => (
                  <g key={t.family} className="cursor-pointer" onClick={() => { const a = graph.laneAtom.get(t.family); if (a) update({ zoom: "region", focus: a }); }}>
                    <rect x={t.r.x} y={t.r.y} width={t.r.w} height={t.r.h} rx={12} fill={fam(t.family).fill} stroke={INK} strokeWidth={2} />
                    <text x={t.r.x + 12} y={t.r.y + 12.5} dominantBaseline="central" className={s.display} fontSize={14} fill={INK}>{t.t1}</text>
                    <text x={t.r.x + 20 + t.w1} y={t.r.y + 12.5} dominantBaseline="central" fontSize={13} fontWeight={700} fill={INK}>{t.t2}</text>
                  </g>
                ))}

                {/* cross-family edges: portals at rest … */}
                {scene.portals.map((o) => {
                  const pf = board.nodes.get(o.from)!.family;
                  const Icon = iconFor(o.from);
                  if (pipeD.find((p) => p.id === o.id)?.shown) return null;
                  const dim = litSet !== null && !litSet.has(o.to);
                  return (
                    <g key={o.id} className="cursor-pointer" opacity={dim ? 0.4 : 1}
                      onPointerEnter={() => setHover(o.from)} onPointerLeave={() => setHover((h) => (h === o.from ? null : h))}
                      onClick={(e) => { e.stopPropagation(); select(o.from); }}>
                      <title>{`builds on ${displayName(o.from)} (${fam(pf).label}) — hover to trace the pipe`}</title>
                      <path d={`M${o.cx} ${o.cy} L${o.ex} ${o.ey}`} stroke={INK} strokeWidth={scene.tube + 3} strokeLinecap="round" />
                      <path d={`M${o.cx} ${o.cy} L${o.ex} ${o.ey}`} stroke={fam(pf).fill} strokeWidth={scene.tube} strokeLinecap="round" />
                      <circle cx={o.cx} cy={o.cy} r={o.r + 2} fill="#fff" />
                      <circle cx={o.cx} cy={o.cy} r={o.r} fill={fam(pf).fill} stroke={INK} strokeWidth={1.8} />
                      {Icon && <Icon x={o.cx - o.r * 0.62} y={o.cy - o.r * 0.62} width={o.r * 1.24} height={o.r * 1.24} strokeWidth={2.4} color={INK} />}
                    </g>
                  );
                })}
                {/* … and the full route, above everything, once either end is lit */}
                {pipeD.filter((p) => p.cross && p.shown).map(renderPipe)}

                {selected && cardOn === selected && (
                  <Parade pipes={paradePipes} view={v} size={clamp(scene.tube * 2.6, 11, 22)} still={still} runKey={runKey}
                    onLanded={() => setLanded(runKey)} />
                )}
                {ferryDraw && <Ferry path={ferryDraw.path} still={still} runKey={`${ferry?.name}:${ferry?.key}`} label={ferryDraw.label} />}
                {grok && hover === GROKKING_EGG.model && !still && <GrokBubble x={grok.cx} y={grok.cy - 30 * grok.kk} held={grokHeld} />}
              </g>
            </svg>
          )}
        </div>

        {/* opaque paper band behind the header */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30" style={{ height: headerH, background: PAPER, boxShadow: `0 1.5px 0 rgba(59,46,90,0.14)` }} />

        {tail && (
          <svg ref={cam.hideWhileMoving as React.RefObject<SVGSVGElement>} className="pointer-events-none absolute inset-0 z-30 h-full w-full" aria-hidden>
            <path d={tail.fill} fill="#fff" />
            <path d={tail.line} fill="none" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
          </svg>
        )}

        {card && (
          <FlowCard c={card} lesson={lesson} mobile={mobile} still={still} evidence={evidence}
            familyOf={familyOf} onPick={select} onClose={() => update({ zoom: "region" })} onSail={sail} sailing={ferry?.name ?? null} />
        )}

        {/* header */}
        <header className="absolute inset-x-3 top-3 z-40 flex items-center gap-3 rounded-full border-[2.5px] bg-white px-4"
          style={{ height: headerH - 18, borderColor: INK, boxShadow: `0 4px 0 ${INK}` }}>
          <a href="/lab/" className={`${s.btn} shrink-0 rounded-full text-[13px] font-bold underline underline-offset-2`}>All skins</a>
          <button type="button" onClick={mascotClick} aria-label={`The zoo keeper${mascotN > 1 && !training ? `, poked ${mascotN} times` : ""}`}
            className={`${s.btn} -my-1 shrink-0 rounded-full`}>
            <span key={mascotN} className={mascotN > 0 && !still ? s.hop : undefined} style={{ display: "inline-block" }}>
              <Mascot state={training ? "trained" : "idle"} />
            </span>
          </button>
          <h1 className={`${s.display} shrink-0 text-[17px] leading-none`}>
            <button type="button" className={s.btn} onClick={() => update({ zoom: "overview", focus: null })}>Zoo flow</button>
          </h1>
          {!mobile && crumbs && focusNode && (
            <nav className="flex min-w-0 items-center gap-1.5 text-[14px] font-bold" aria-label="Where you are">
              <span aria-hidden>/</span>
              <button type="button" className={`${s.btn} rounded-full px-2`} style={{ background: fam(focusNode.family).fill }}
                onClick={() => update({ zoom: "region" })}>{crumbs}</button>
              {zoom === "node" && (<><span aria-hidden>/</span><span className="truncate">{displayName(focusNode.name)}</span></>)}
            </nav>
          )}
          <div className="flex-1" />
          {size.w >= 1240 && (
            <div className="flex items-center gap-3" aria-label="What the faces mean">
              <KeyItem state="champion" label="champion" />
              <KeyItem state="trained" label="trained" />
              <KeyItem state="provisional" label="provisional bar" />
              <KeyItem state="untrained" label="not trained" />
              <span className="flex items-center gap-1 whitespace-nowrap text-[13px] font-bold">
                <span className="rounded-full px-1.5 text-[12px] font-extrabold" style={{ background: "#EDE8FF" }}>3</span>local runs
              </span>
            </div>
          )}
          <input list="flow-models" placeholder={mobile ? "Search" : "Find a model"} aria-label="Find a model"
            className={`${s.search} w-[112px] rounded-full border-2 bg-[#F3F0FF] px-3 py-1 text-[14px] font-bold placeholder:text-[#5E4F80] sm:w-[160px]`}
            style={{ borderColor: INK }}
            onChange={(e) => {
              const name = e.target.value.trim().replace(/ /g, "_");
              if (board?.nodes.has(name)) { select(name); e.target.value = ""; e.target.blur(); }
            }} />
          <datalist id="flow-models">
            {board?.list.map((n: BNode) => <option key={n.name} value={displayName(n.name)} />)}
          </datalist>
        </header>

        {/* egg: the keeper trains on a REAL run's loss after 7 pokes */}
        {training && realCurve && <KeeperTrains curve={realCurve} still={still} />}

        {!online && (
          <p className="absolute inset-x-0 top-24 z-40 mx-auto w-fit max-w-[90%] rounded-2xl border-2 bg-white px-4 py-3 text-[15px] font-bold" style={{ borderColor: INK }}>
            The model API at localhost:8000 is not answering. Start it with python main.py serve; the board retries every 3 seconds.
          </p>
        )}
      </div>
    </LabMotion>
  );
}

export type { Pt };
