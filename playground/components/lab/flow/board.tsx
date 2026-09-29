"use client";

// Skin D · Kawaii flow — the zoo as a dataflow board.
// Positions come ONLY from buildFlow (columns = generation depth, lanes =
// families, pipes = builds_on); geometry.ts folds the lane stack into two
// halves on wide screens and regroups pipes into per-parent trunks. The
// camera is uniform (every transition is a real zoom). Labels live in screen
// space at a constant size, placed by priority (focus, atoms, hubs, rest) and
// culled where they would cover a creature, a tag, a foreign pipe or the edge.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chevronsAlong, roundedD, type Pt } from "@/lib/world";
import type { ModelEvidence } from "@/lib/types";
import { iconFor } from "@/lib/icons";
import { useWorld } from "@/hooks/use-world";
import { useLesson } from "@/hooks/use-lesson";
import { useLabView } from "@/components/lab/shared/url-state";
import { LabMotion } from "@/components/lab/shared/still";
import { cardModel, displayName, evidenceState, type EvidenceState } from "@/components/lab/shared/card-model";
import {
  forwardPassOrder, forwardPassSchedule, GROKKING_EGG, stationCounts,
  useKonami, useLiveTraining, useLongFocus, useRealLossCurve,
} from "@/components/lab/shared/eggs";
import { Sparkline } from "@/components/lab/shared/lesson/sparkline";
import { fitView, useFlowCamera, useStageSize, type CamBox, type View } from "./camera";
import { Creature, CreatureDefs, EvidenceGlyph } from "./creature";
import { FlowCard } from "./card";
import { Parade, STEP, type ParadePipe } from "./parade";
import { Dock, Ferry, ferryPath, GrokBubble, Mascot, NextEraLane, RuinsLane, Trains } from "./extras";
import { layoutBoard, type BNode } from "./geometry";
import { ACCENT, DOT, fam, hexMix, INK, INK_SOFT, PAPER } from "./palette";
import s from "./flow.module.css";

const CARD_W = 440;
const RAIL = 196;              // desktop: room left of the left half for the atoms' name plates
const MOBILE_S = 0.5;          // phone overview scale (the board runs ~1.5 screens tall; drag to scroll)
const MOBILE_RAIL = 148;       // phone overview: left rail for atom plates
const CAPITAL = 5;             // an atom with ≥ this many children is a capital (pennant)
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
const approxWidth = (t: string, px: number) => t.length * px * 0.68;

type R = { x: number; y: number; w: number; h: number };
const hit = (a: R, b: R, m = 0) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;

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

export function FlowBoard() {
  const { view, update } = useLabView();
  const still = view?.still ?? true;
  const { taxonomy, runs, evidence, flow, online, ready } = useWorld(view ? view.still : null);
  const { ref, size } = useStageSize();
  const mobile = size.w > 0 && size.w < 640;
  const headerH = mobile ? 58 : 72;
  const EDGE = mobile ? 10 : 24;

  // ——— font measurement (labels must fit their slot at ≥13px) ———
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

  // ——— graph + board ———
  const graph = useMemo(() => {
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
    const docks = new Map<string, { name: string; label: string }[]>();
    for (const c of taxonomy.compositions) {
      const fams = new Set(c.composes.filter((m) => names.has(m)).map((m) => flow.nodes.find((n) => n.name === m)!.family));
      for (const f of fams) docks.set(f, [...(docks.get(f) ?? []), { name: c.name, label: `${displayName(c.name)}: ${c.description}` }]);
    }
    return { parents, children, laneAtom, laneCount, docks };
  }, [flow, taxonomy]);
  const board = useMemo(() => (flow && size.w > 0 ? layoutBoard(flow, mobile ? "stack" : "split") : null), [flow, mobile, size.w]);

  const evBy = useMemo(() => new Map<string, ModelEvidence>(evidence.map((e) => [e.name, e])), [evidence]);
  const stations = useMemo(() => stationCounts(runs), [runs]);
  const live = useLiveTraining(runs);

  const focusNode = view?.focus && board ? board.nodes.get(view.focus) ?? null : null;
  const zoom = view && focusNode ? view.zoom : "overview";
  const bandH = headerH;

  // ——— camera target (uniform scale everywhere) ———
  const target: View | null = useMemo(() => {
    if (!board || !graph || size.w === 0) return null;
    if (zoom === "region" && focusNode) {
      const lane = board.lanes[focusNode.lane];
      const box = { x: lane.x - 6, y: lane.y - 44, w: lane.w + 12, h: lane.h + 60 };
      if (mobile) {
        const sc = 0.9;
        return { sx: sc, sy: sc, tx: 4, ty: bandH + 12 - box.y * sc };
      }
      return fitView(box, { x: RAIL, y: bandH + 16, w: size.w - RAIL - 40, h: size.h - bandH - 32 }, 1, 1.8);
    }
    if (zoom === "node" && focusNode) {
      const b: CamBox = { x: focusNode.x - 75, y: focusNode.y - 22, w: 150, h: 44 };
      const pad: CamBox = { x: b.x + b.w / 2 - b.w * 1.25, y: b.y + b.h / 2 - b.h * 1.8, w: b.w * 2.5, h: b.h * 3.6 };
      const nodeAvail: CamBox = mobile
        ? { x: 8, y: headerH + 8, w: size.w - 16, h: size.h * 0.52 - headerH - 16 }
        : { x: 24, y: headerH + 12, w: size.w - CARD_W - 16 - 72, h: size.h - headerH - 36 };
      // widen the frame to the direct parents so the parade's last leg is in shot
      let box = pad;
      for (const p of graph.parents.get(focusNode.name) ?? []) {
        const q = board.nodes.get(p)!;
        const x0 = Math.min(box.x, q.x - 95), y0 = Math.min(box.y, q.y - 52);
        const x1 = Math.max(box.x + box.w, q.x + 95), y1 = Math.max(box.y + box.h, q.y + 62);
        box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      }
      const wide = fitView(box, nodeAvail, 1, 2);
      const cv = wide.sx >= (mobile ? 0.8 : 1.0) ? wide : fitView(pad, nodeAvail, 1, 2);
      // slide the focused creature next to its card so the speech tail stays short
      const fx = focusNode.x * cv.sx + cv.tx;
      const fy = focusNode.y * cv.sy + cv.ty;
      if (mobile) cv.ty += size.h * 0.54 - 8 - 90 - fy;
      else cv.tx += Math.max(0, size.w - 16 - CARD_W - 220 - fx);
      return cv;
    }
    if (mobile) return { sx: MOBILE_S, sy: MOBILE_S, tx: MOBILE_RAIL, ty: bandH + 8 - board.top * MOBILE_S };
    const sc = Math.min((size.w - RAIL - EDGE) / board.width, (size.h - bandH - 20) / (board.height - board.top));
    const left = RAIL + Math.max(0, (size.w - RAIL - EDGE - board.width * sc) / 2);
    return { sx: sc, sy: sc, tx: left, ty: bandH + 8 - board.top * sc };
  }, [board, graph, size.w, size.h, zoom, focusNode, mobile, bandH, headerH, EDGE]);

  const cam = useFlowCamera(target, still);
  const v = cam.view;

  // ——— selection, hover, parade, bounce ———
  const [run, setRun] = useState(0);
  const [landed, setLanded] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
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
  const [wave, setWave] = useState<{ t0: number; n: number } | null>(null);
  const [waveNow, setWaveNow] = useState(0);
  const schedule = useMemo(() => (board ? forwardPassSchedule(forwardPassOrder({ nodes: board.list }), 450) : {}), [board]);
  const waveEnd = useMemo(() => Math.max(0, ...Object.values(schedule)) + 900, [schedule]);
  useKonami(useCallback(() => setWave((w) => ({ t0: performance.now(), n: (w?.n ?? 0) + 1 })), []), !still);
  useEffect(() => {
    if (!wave) return;
    let raf = 0;
    const tick = (now: number) => {
      const el = now - wave.t0;
      setWaveNow(el);
      if (el < waveEnd) raf = requestAnimationFrame(tick); else setWave(null);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [wave, waveEnd]);
  const waveOn = (n: string) => wave !== null && schedule[n] !== undefined && waveNow >= schedule[n] && waveNow < schedule[n] + 700;

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
  const [trainP, setTrainP] = useState(0);
  useEffect(() => {
    if (!realCurve || !training) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => { const u = Math.min(1, (now - t0) / 2600); setTrainP(u); if (u < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [realCurve, training]);

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

  const card = useMemo(() => {
    if (!selected || !taxonomy || !focusNode) return null;
    return cardModel(selected, { taxonomy, evidence, runs, family: focusNode.family, depth: focusNode.depth });
  }, [selected, taxonomy, focusNode, evidence, runs]);
  const lesson = useLesson(selected, { runs, evidence, still: view ? view.still : null });

  // ——— per-frame screen geometry + semantic-zoom labelling ———
  const scene = useMemo(() => {
    if (!v || !board || !graph) return null;
    const sc = v.sx;
    const X = (x: number) => x * sc + v.tx;
    const Y = (y: number) => y * sc + v.ty;
    const rowPitch = 84 * sc;
    const colSp = 280 * sc;
    const kFit = Math.min((rowPitch - 8) / 44, colSp / 120);
    const kBelow = (rowPitch - 25 - 10) / 44;
    const below = kBelow >= 0.8;
    const kMax = mobile && zoom === "overview" ? 0.62 : 1.5;
    const k = clamp(below ? Math.min(kFit, kBelow) : kFit, 0.45, kMax);
    const font = Math.round(clamp(11 + 2.5 * k, 13, 16));
    const tagH = font + 10;
    const tube = clamp(2.2 + 2.6 * k, 3, 7);

    const nodes = board.list.map((n) => {
      const atom = n.depth === 0;
      const kids = graph.children.get(n.name)!.length;
      const sel = n.name === selected;
      const kk = k * (sel ? 1.3 : 1);
      const cx = X(n.x), cy = Y(n.y);
      const left = (n.family === "sequence" ? 27 : n.family === "representation" ? 26 : 23) * kk;
      const right = (n.family === "representation" ? 24 : n.family === "decision" ? 21 : 20) * kk;
      const top = (atom ? (kids >= CAPITAL ? 43 : 31) : n.family === "decision" ? 30 : 26) * kk;
      const body: R = { x: cx - left, y: cy - top, w: left + right, h: top + 23 * kk };
      return { n, atom, kids, kk, cx, cy, left, right, body, sel };
    });

    const pipes = board.pipes.map((p) => ({ ...p, spts: p.pts.map((q) => ({ x: X(q.x), y: Y(q.y) })) }));
    const segs: { r: R; from: string; to: string; first: boolean; last: boolean }[] = [];
    const pad = tube / 2 + 1;
    for (const p of pipes) {
      if (p.crossLane) continue;          // cross-family edges are portals until lit
      for (let i = 0; i < p.spts.length - 1; i++) {
        const a = p.spts[i], b = p.spts[i + 1];
        segs.push({
          r: { x: Math.min(a.x, b.x) - pad, y: Math.min(a.y, b.y) - pad, w: Math.abs(a.x - b.x) + 2 * pad, h: Math.abs(a.y - b.y) + 2 * pad },
          from: p.from, to: p.to, first: i === 0, last: i === p.spts.length - 2,
        });
      }
    }

    const cardLeft = selected && !mobile ? size.w - 16 - CARD_W - 12 : size.w;
    const stage: R = {
      x: EDGE, y: bandH + 4,
      w: Math.min(cardLeft, size.w - EDGE) - EDGE,
      h: (selected && mobile ? size.h * 0.54 - 12 : size.h - EDGE / 2) - bandH - 4,
    };
    const inside = (r: R) => r.x >= stage.x && r.y >= stage.y && r.x + r.w <= stage.x + stage.w && r.y + r.h <= stage.y + stage.h;
    // a tag stays on its own board: the left half ends where the right half's atom plates begin
    const halfEnd = board.halfX.length > 1 ? X(board.halfX[1] - 250) : Infinity;

    // lane tabs (attached to each tray's top-right edge) and harbours (bottom-right)
    const tabs = board.lanes.map((l) => {
      const f = fam(l.family);
      const t1 = f.label, t2 = `${graph.laneCount.get(l.family) ?? 0} ${f.kind}`;
      const w1 = measure.current(t1, 14), w2 = t2.length * 7.2;
      const tw = w1 + w2 + 30;
      const x1 = X(l.x + l.w) - 18;
      return { family: l.family, t1, t2, w1, r: { x: x1 - tw, y: Y(l.y) - 12, w: tw, h: 24 } };
    });
    const docks = board.lanes.map((l) => {
      const all = graph.docks.get(l.family) ?? [];
      const boats = all.slice(0, 3);
      const more = all.length - boats.length;
      const x = X(l.x + l.w) - 16, y = Y(l.y + l.h) - 14;
      const w = boats.length * 34 + (more > 0 ? 34 : 0) + 12;
      return { family: l.family, x, y, boats, all, more, r: { x: x - w, y: y - 30, w: w + 4, h: 38 } };
    });

    // cross-family portals: a short pipe end on the child's upper-left, in the parent's family colour
    const portals = pipes.filter((p) => p.crossLane).map((p) => {
      const q = nodes.find((o) => o.n.name === p.to)!;
      const idx = pipes.filter((o) => o.crossLane && o.to === p.to).findIndex((o) => o.id === p.id);
      const r = clamp(7 + 3 * k, 8, 12);
      const cx = q.cx - q.left - r - 6, cy = q.cy - 14 * q.kk - idx * (2 * r + 6);
      return { id: p.id, from: p.from, to: p.to, cx, cy, r, ex: q.cx - q.left * 0.6, ey: q.cy - 6 * q.kk };
    });

    // greedy labelling in importance order
    const order = [...nodes].sort((a, b) =>
      Number(b.sel) - Number(a.sel) || Number(b.n.name === hover) - Number(a.n.name === hover) || Number(b.atom) - Number(a.atom) || b.kids - a.kids
      || a.n.depth - b.n.depth || (a.n.name < b.n.name ? -1 : 1));
    const placed: R[] = [...tabs.map((t) => t.r), ...docks.filter((d) => d.boats.length).map((d) => d.r),
      ...portals.map((o) => ({ x: o.cx - o.r - 2, y: o.cy - o.r - 2, w: 2 * o.r + 4, h: 2 * o.r + 4 }))];
    const tags = new Map<string, { x: number; y: number; w: number; fs: number; text: string; chip: string | null }>();
    for (const q of order) {
      const text = displayName(q.n.name);
      const fs = q.atom && !mobile ? font + 1 : font;
      const isLive = live.includes(q.n.name);
      const count = stations[q.n.name] ?? 0;
      const chip = isLive ? "live" : count > 0 ? String(count) : null;
      const chipW = chip ? measure.current(chip, 12) * 0.9 + 16 : 0;
      const tw = measure.current(text, fs) + 33 + chipW;
      const right: R = { x: q.cx + q.right + 4, y: q.cy - tagH / 2, w: tw, h: tagH };
      const leftR: R = { x: q.cx - q.left - 4 - tw, y: q.cy - tagH / 2, w: tw, h: tagH };
      const under: R = { x: q.cx - tw / 2, y: q.cy + 23 * q.kk + 3, w: tw, h: tagH };
      const underR: R = { ...under, x: q.cx - q.left };
      const cands = q.atom ? [leftR, right, under] : below ? [under, underR, right] : [right, under, underR, leftR];
      const clear = (r: R) => inside(r) && (q.n.half > 0 || r.x + r.w <= halfEnd) && !nodes.some((o) => o !== q && hit(r, o.body, 2)) && !placed.some((o) => hit(r, o, 4));
      const ownBoard = (r: R) => q.n.half > 0 || r.x + r.w <= halfEnd;
      const ok = (r: R) => clear(r) && ownBoard(r) && !segs.some((sg) => {
        const own = (sg.from === q.n.name && sg.first) || (sg.to === q.n.name && sg.last);
        return !own && hit(r, sg.r);
      });
      const hov = q.n.name === hover;
      const pick = q.sel ? [under, underR, right].find(clear) ?? cands.find(ok) ?? right
        : cands.find(ok) ?? (zoom !== "overview" || hov ? cands.find(clear) : undefined) ?? (hov ? cands.find(inside) : undefined);
      if (!pick) continue;
      placed.push(pick);
      tags.set(q.n.name, { x: pick.x, y: pick.y, w: pick.w, fs, text, chip });
    }

    // trays hug everything drawn in their lane, per half
    const halves = board.halfX.map((_, h) => {
      let x0 = Infinity, x1 = -Infinity;
      for (const l of board.lanes.filter((l) => l.half === h)) { x0 = Math.min(x0, X(l.x)); x1 = Math.max(x1, X(l.x + l.w)); }
      for (const q of nodes.filter((q) => q.n.half === h)) {
        x0 = Math.min(x0, q.body.x - 12);
        const t = tags.get(q.n.name);
        if (t) { x0 = Math.min(x0, t.x - 12); x1 = Math.max(x1, t.x + t.w + 12); }
      }
      return { x0, x1 };
    });
    return { X, Y, sc, k, tagH, tube, nodes, pipes, tags, tabs, docks, halves, portals };
  }, [v, board, graph, size.w, size.h, fontsReady, mobile, zoom, selected, hover, bandH, EDGE, live, stations]); // eslint-disable-line react-hooks/exhaustive-deps

  const pipeD = useMemo(() => {
    if (!scene) return [];
    return scene.pipes.map((p) => {
      let role: "anc" | "kid" | "dim" | "rest" = "rest";
      if (litHops && lit) {
        role = litHops.has(p.from) && litHops.has(p.to) && litHops.get(p.from)! > litHops.get(p.to)! ? "anc" : p.from === lit ? "kid" : "dim";
      }
      const cross = p.crossLane;
      const shown = !cross || (lit !== null && (p.from === lit || p.to === lit || role === "anc"));
      const chev = (role === "anc" || role === "kid" || cross || scene.tube >= 6) ? chevronsAlong(p.spts, 64, 22) : [];
      return { id: p.id, d: roundedD(p.spts, 14), from: p.from, role, cross, shown, chev, spts: p.spts };
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

  const trainRoutes = useMemo(() => {
    if (!scene) return [];
    return scene.pipes.filter((p) => live.includes(p.to)).map((p) => ({ id: p.id, pts: p.spts }));
  }, [scene, live]);

  // ——— the speech-bubble tail from the card to the focused creature ———
  const tail = (() => {
    if (!scene || !selected || !card) return null;
    const me = scene.nodes.find((q) => q.n.name === selected);
    if (!me) return null;
    const myTag = scene.tags.get(selected);
    if (mobile) {
      const top = size.h * 0.54;
      const tip = { x: me.cx, y: me.cy + 23 * me.kk + (myTag && myTag.y > me.cy ? scene.tagH + 8 : 6) };
      if (tip.y > top - 16) return null;
      const bx = clamp(tip.x, 44, size.w - 44);
      return { fill: `M${bx - 16} ${top + 4} Q${bx - 4} ${(top + tip.y) / 2} ${tip.x} ${tip.y} Q${bx + 8} ${(top + tip.y) / 2} ${bx + 16} ${top + 4} Z`,
        line: `M${bx - 16} ${top + 1.5} Q${bx - 4} ${(top + tip.y) / 2} ${tip.x} ${tip.y} Q${bx + 8} ${(top + tip.y) / 2} ${bx + 16} ${top + 1.5}` };
    }
    const left = size.w - 16 - CARD_W;
    const tip = { x: me.cx + 26 * me.kk, y: me.cy - 10 * me.kk };
    if (tip.x > left - 24) return null;
    const by = clamp(tip.y, 80 + 60, size.h - 80);
    const mx = (left + tip.x) / 2;
    return { fill: `M${left + 4} ${by - 18} Q${mx} ${by - 6} ${tip.x} ${tip.y} Q${mx} ${by + 10} ${left + 4} ${by + 18} Z`,
      line: `M${left + 1.5} ${by - 18} Q${mx} ${by - 6} ${tip.x} ${tip.y} Q${mx} ${by + 10} ${left + 1.5} ${by + 18}` };
  })();

  const familyOf = useCallback((n: string) => board?.nodes.get(n)?.family ?? "", [board]);

  // a soft tube with opaque layers (so a shared spine never darkens where pipes overlap)
  const renderPipe = (p: (typeof pipeD)[number]) => {
    if (!scene || !board) return null;
    const f = fam(board.nodes.get(p.from)!.family);
    const on = p.role === "anc" || p.role === "kid";
    const w = on ? scene.tube + 1.5 : scene.tube;
    const waving = wave !== null && waveOn(p.from);
    const rim = waving ? ACCENT : on || p.cross ? INK : hexMix(INK, PAPER, 0.45);
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
        <path d={p.d} stroke={waving ? "#FFC2D6" : f.fill} strokeWidth={w} />
        <path d={p.d} stroke={hexMix(f.fill, f.deep, 0.45)} strokeWidth={Math.max(1, w * 0.3)} transform={`translate(${w * 0.22} ${w * 0.26})`} />
        <path d={p.d} stroke="#fff" strokeWidth={Math.max(1, w * 0.24)} transform={`translate(${-w * 0.2} ${-w * 0.22})`} />
        {p.chev.map((c, i) => (
          <path key={i} d="M-2.5 -3 L1.5 0 L-2.5 3" stroke={INK} strokeOpacity={0.6} strokeWidth={1.6}
            transform={`translate(${c.x} ${c.y}) rotate(${(c.angle * 180) / Math.PI}) scale(${Math.min(1.4, w / 5)})`} />
        ))}
      </g>
    );
  };
  const crumbs = focusNode && zoom !== "overview" ? fam(focusNode.family).label : null;
  const grok = scene?.nodes.find((q) => q.n.name === GROKKING_EGG.model);

  return (
    <LabMotion still={still}>
      <div data-lab-ready={drawn ? "1" : undefined} className={`${s.stage} relative h-full overflow-hidden`}>
        <span ref={probe} className={`${s.display} pointer-events-none absolute -left-[9999px] top-0`} aria-hidden>Aa</span>
        <svg className="pointer-events-none absolute h-0 w-0" aria-hidden><CreatureDefs /></svg>

        <div ref={ref} {...cam.handlers} className="absolute inset-0 touch-none select-none">
          {scene && v && board && graph && (
            <svg className="h-full w-full" role="application" aria-label="Dataflow board of the model zoo">
              <defs>
                <pattern id="flow-dots" patternUnits="userSpaceOnUse" x={v.tx} y={v.ty} width={42 * scene.sc} height={42 * scene.sc}>
                  <circle cx={1.5} cy={1.5} r={1.5} fill={DOT} />
                </pattern>
                {/* printed tray fabric: one motif per family, drawn in its deep tone */}
                {Object.keys(PRINTS).map((f) => (
                  <pattern key={f} id={`fp-${f}`} patternUnits="userSpaceOnUse" width={56} height={56}
                    patternTransform={`translate(${v.tx} ${v.ty}) scale(${Math.max(0.6, scene.sc)})`}>
                    <path d={PRINTS[f]} fill="none" stroke={fam(f).deep} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" opacity={0.2} />
                  </pattern>
                ))}
              </defs>
              <rect width="100%" height="100%" fill={PAPER} />
              <rect width="100%" height="100%" fill="url(#flow-dots)" />

              {/* off-chart: the ruins of the old zoo (west) and the uncharted next era (east) */}
              {/* drawn only once fully in view — never a clipped tease */}
              {[board.ruins, board.next].map((b, i) => {
                const x = scene.X(b.x), y = scene.Y(b.y), w = b.w * scene.sc, h = b.h * scene.sc;
                if (x < 8 || y < bandH + 8 || x + w > size.w - 8 || y + h > size.h - 8) return null;
                return i === 0
                  ? <RuinsLane key="ruins" x={x} y={y} w={w} h={h} sc={scene.sc} />
                  : <NextEraLane key="next" x={x} y={y} w={w} h={h} sc={scene.sc} />;
              })}

              {/* lane trays = families (low-chroma ground) */}
              {board.lanes.map((l) => {
                const f = fam(l.family);
                const hv = scene.halves[l.half];
                const rx = clamp(20 * scene.k, 12, 26);
                const y = scene.Y(l.y), h = l.h * scene.sc, w = hv.x1 - hv.x0;
                // a felt tray with thickness: cast shadow, side face, printed top, lit top edge
                return (
                  <g key={l.family}>
                    <rect x={hv.x0 + 3} y={y + 10} width={w} height={h} rx={rx} fill={INK} fillOpacity={0.1} />
                    <rect x={hv.x0} y={y + 6} width={w} height={h} rx={rx} fill={f.deep} fillOpacity={0.55} />
                    <rect x={hv.x0} y={y} width={w} height={h} rx={rx} fill={PAPER} />
                    <rect x={hv.x0} y={y} width={w} height={h} rx={rx} fill={f.fill} fillOpacity={0.3} />
                    <rect x={hv.x0} y={y} width={w} height={h} rx={rx} fill={`url(#fp-${l.family})`} />
                    <rect x={hv.x0 + 1.5} y={y + 1.5} width={w - 3} height={h - 3} rx={rx - 1} fill="none" stroke="#fff" strokeOpacity={0.8} strokeWidth={2}
                      strokeDasharray={`${w} ${w + 2 * h}`} strokeDashoffset={-0} />
                    <rect x={hv.x0} y={y} width={w} height={h} rx={rx} fill="none" stroke={f.deep} strokeOpacity={0.5} strokeWidth={1.5} />
                  </g>
                );
              })}

              {/* pipes = builds_on inside a family; core colour = the parent's family; a hub is one spine that splits */}
              {[...pipeD].filter((p) => !p.cross).sort((a, b) => Number(a.role !== "dim") - Number(b.role !== "dim")).map(renderPipe)}

              {/* harbours: one boat per composition that uses a model of this family */}
              {scene.docks.map((d) => d.boats.length > 0 && (
                <Dock key={d.family} x={d.x} y={d.y} boats={d.boats} more={d.more} all={d.all} sailing={ferry?.name ?? null} onSail={sail} />
              ))}

              {/* creatures */}
              {scene.nodes.map(({ n, cx, cy, kk, kids, sel }) => {
                const st = evidenceState(evBy.get(n.name));
                const dim = litSet !== null && !litSet.has(n.name);
                const bounce = (sel && landed === runKey && !still) || waveOn(n.name);
                return (
                  <g key={n.name} transform={`translate(${cx} ${cy})`} className={s.node} tabIndex={0} role="button"
                    opacity={dim ? 0.45 : 1}
                    aria-label={`${displayName(n.name)}, ${fam(n.family).label}, ${st}`}
                    onClick={() => select(n.name)}
                    onPointerEnter={() => setHover(n.name)} onPointerLeave={() => setHover((h) => (h === n.name ? null : h))}
                    onFocus={() => setHover(n.name)} onBlur={() => setHover((h) => (h === n.name ? null : h))}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(n.name); } }}>
                    <title>{displayName(n.name)}</title>
                    <circle className={s.ring} r={30 * kk} fill="none" stroke={INK} strokeWidth={3} strokeDasharray="5 4" />
                    {sel && <circle r={32 * kk} fill="#fff" stroke={ACCENT} strokeWidth={3} />}
                    <circle r={24 * kk} fill="transparent" />
                    <g transform={`scale(${kk})`}>
                      <g key={bounce ? `b${runKey}${wave?.n ?? 0}` : "idle"} className={bounce ? s.bounce : undefined}>
                        <Creature family={n.family} atom={n.depth === 0} capital={kids >= CAPITAL} state={st}
                          emblem={iconFor(n.name)} eureka={n.name === GROKKING_EGG.model && grokHeld} />
                      </g>
                    </g>
                  </g>
                );
              })}

              {live.length > 0 && <Trains routes={trainRoutes} still={still} size={clamp(scene.tube * 1.9, 9, 16)} />}

              {/* name tags: evidence glyph + name + station (local run count / live) */}
              {scene.nodes.map(({ n, sel }) => {
                const t = scene.tags.get(n.name);
                if (!t) return null;
                const atom = n.depth === 0;
                const st = evidenceState(evBy.get(n.name));
                const dim = litSet !== null && !litSet.has(n.name);
                const tw = measure.current(t.text, t.fs);
                return (
                  <g key={n.name} pointerEvents="none" opacity={dim ? 0.7 : 1}>
                    <rect x={t.x} y={t.y} width={t.w} height={scene.tagH} rx={scene.tagH / 2}
                      fill={sel ? INK : atom ? fam(n.family).fill : "#fff"} stroke={INK} strokeWidth={atom || sel ? 2 : 1.4} />
                    <g transform={`translate(${t.x + 12.5} ${t.y + scene.tagH / 2})`}>
                      {sel && <circle r={7.6} fill="#fff" />}
                      <EvidenceGlyph state={st} />
                    </g>
                    <text x={t.x + 24} y={t.y + scene.tagH / 2 + 0.5} fontSize={t.fs} dominantBaseline="central"
                      className={s.display} fill={sel ? "#fff" : INK}>{t.text}</text>
                    {t.chip && (
                      <g transform={`translate(${t.x + 24 + tw + 6} ${t.y + 4})`}>
                        <rect width={t.w - (24 + tw + 6) - 5} height={scene.tagH - 8} rx={(scene.tagH - 8) / 2}
                          fill={t.chip === "live" ? ACCENT : sel ? "#fff" : "#EDE8FF"} />
                        <text x={(t.w - (24 + tw + 6) - 5) / 2} y={(scene.tagH - 8) / 2 + 0.5} textAnchor="middle" dominantBaseline="central"
                          fontSize={12} fontWeight={800} fill={t.chip === "live" ? "#fff" : INK}>{t.chip}</text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* generation headers, inside each board above its trays */}
              {board.halfX.flatMap((_, h) => [0, 1, 2, 3].map((d) => {
                const x = scene.X(board.colX(h, d) + board.nodeW / 2);
                const y = scene.Y(board.lanes.find((l) => l.half === h)?.y ?? 0) - 26;   // screen px above the trays, below the sky bridge
                if (x < 30 || x > size.w - 30 || y < bandH + 6) return null;
                return (
                  <text key={`h${h}${d}`} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={800}
                    fill={INK_SOFT} stroke={PAPER} strokeWidth={4} paintOrder="stroke">
                    {d === 0 ? "Atoms" : scene.sc * 280 < 150 ? `Gen ${d}` : `Generation ${d}`}
                  </text>
                );
              }))}

              {/* lane tabs: family, count and the silhouette it wears — attached to the tray */}
              {scene.tabs.map((t) => (
                <g key={t.family} className="cursor-pointer" onClick={() => { const a = graph.laneAtom.get(t.family); if (a) update({ zoom: "region", focus: a }); }}>
                  <rect x={t.r.x} y={t.r.y} width={t.r.w} height={t.r.h} rx={12} fill={fam(t.family).fill} stroke={INK} strokeWidth={2} />
                  <text x={t.r.x + 12} y={t.r.y + 12.5} dominantBaseline="central" className={s.display} fontSize={14} fill={INK}>{t.t1}</text>
                  <text x={t.r.x + 20 + t.w1} y={t.r.y + 12.5} dominantBaseline="central" fontSize={13} fontWeight={700} fill={INK}>{t.t2}</text>
                </g>
              ))}

              {/* cross-family edges: portals by default … */}
              {scene.portals.map((o) => {
                const pf = board.nodes.get(o.from)!.family;
                const Icon = iconFor(o.from);
                const shown = pipeD.find((p) => p.id === o.id)?.shown;
                if (shown) return null;
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

              {selected && (
                <Parade pipes={paradePipes} view={v} size={clamp(scene.tube * 2.5, 11, 21)} still={still} runKey={runKey}
                  onLanded={() => setLanded(runKey)} />
              )}
              {ferryDraw && <Ferry path={ferryDraw.path} still={still} runKey={`${ferry?.name}:${ferry?.key}`} label={ferryDraw.label} />}
              {grok && hover === GROKKING_EGG.model && !still && <GrokBubble x={grok.cx} y={grok.cy - 30 * grok.kk} held={grokHeld} />}
            </svg>
          )}
        </div>

        {/* opaque paper band behind the header (+ generation headers) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30" style={{ height: bandH, background: PAPER, boxShadow: `0 1.5px 0 rgba(59,46,90,0.14)` }}>
        </div>

        {tail && (
          <svg className="pointer-events-none absolute inset-0 z-30 h-full w-full" aria-hidden>
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
          <input list="flow-models" placeholder="Find a model" aria-label="Find a model"
            className={`${s.search} w-[128px] rounded-full border-2 bg-[#F3F0FF] px-3 py-1 text-[14px] font-bold placeholder:text-[#5E4F80] sm:w-[160px]`}
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
        {training && realCurve && (
          <div className="absolute left-4 top-[76px] z-40 w-[300px] rounded-2xl border-2 bg-white p-3" style={{ borderColor: INK, boxShadow: `0 4px 0 ${INK}` }}>
            <p className={`${s.display} text-[15px]`}>Fine, I'll train.</p>
            <Sparkline points={realCurve.points} progress={still ? 1 : trainP} label={realCurve.key.replace(/_/g, " ")} width={272} height={70}
              palette={{ line: ACCENT, axis: "#C9BFE8", text: INK, fill: "rgba(214,51,108,0.12)" }} title="a real loss curve" />
            <p className="mt-1 text-[13px] font-bold" style={{ color: INK_SOFT }}>a real run: {realCurve.model.replace(/_/g, " ")}, {realCurve.runId}</p>
          </div>
        )}

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
