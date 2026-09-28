"use client";

// Skin D · Kawaii flow — the zoo as a dataflow board.
// Positions come ONLY from buildFlow (columns = generation depth, lanes =
// families, pipes = builds_on). The camera is uniform (every transition is a
// real zoom); legibility comes from semantic zoom instead: name tags are
// placed greedily in importance order (focus, atoms, then by child count) and
// a tag only appears where it fits at ≥13px without covering a creature,
// another tag or a foreign pipe.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { roundedD, type FlowLayout, type FlowNode, type Pt } from "@/lib/world";
import type { ModelEvidence } from "@/lib/types";
import { useWorld } from "@/hooks/use-world";
import { useLabView } from "@/components/lab/shared/url-state";
import { LabMotion } from "@/components/lab/shared/still";
import { cardModel, displayName, evidenceState, type EvidenceState } from "@/components/lab/shared/card-model";
import { fitView, useFlowCamera, useStageSize, type CamBox, type View } from "./camera";
import { Creature, EvidenceGlyph } from "./creature";
import { FlowCard } from "./card";
import { Parade, STEP, type ParadePipe } from "./parade";
import { fam, INK, INK_SOFT, PAPER, DOT } from "./palette";
import s from "./flow.module.css";

const CARD_W = 400;
const RAIL = 220;          // desktop: room left of the atoms for their name plates
const TITLES = 210;        // desktop: room right of the trays for lane titles
const MOBILE_OVERVIEW_S = 0.6;  // phone overview: ~1.4 screens tall, scroll by camera
const MOBILE_RAIL = 148;        // phone overview: left rail for the atoms' name plates
const TRACK = 9;           // world px between trunks sharing a gutter
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function hash01(name: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return ((h >>> 0) % 1000) / 1000;
}

const approxWidth = (t: string, px: number) => t.length * px * 0.68;

interface Graph {
  node: Map<string, FlowNode>;
  parents: Map<string, string[]>;
  children: Map<string, string[]>;
  /** world-px pipe polylines: creature centre → shared trunk → creature centre. */
  pipePts: Map<string, Pt[]>;
  laneAtom: Map<string, string>;
  laneCount: Map<string, number>;
}

// Pipes are restyled into trunks: every edge leaving a parent through a
// gutter rides that parent's single trunk (and long edges entering a child
// share the child's trunk), so a hub reads as one tube that branches, not a
// dozen parallel tubes. Vertical runs stay inside buildFlow's gutters and the
// long-span channel y comes from buildFlow; only the track x is regrouped.
function buildGraph(flow: FlowLayout, models: { name: string; builds_on: string[] }[]): Graph {
  const node = new Map(flow.nodes.map((n) => [n.name, n]));
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  for (const n of flow.nodes) { parents.set(n.name, []); children.set(n.name, []); }
  for (const m of models) {
    if (!node.has(m.name)) continue;
    for (const p of m.builds_on) {
      if (!node.has(p)) continue;
      parents.get(m.name)!.push(p);
      children.get(p)!.push(m.name);
    }
  }
  const cols = flow.columns.map((c) => c.x);
  const nodeW = flow.nodes[0]?.box.w ?? 150;
  const colW = cols.length > 1 ? cols[1] - cols[0] : 220;
  const gutterMid = (d: number) => cols[d] + nodeW + (colW - nodeW) / 2;
  const cx = (n: string) => node.get(n)!.box.x + node.get(n)!.box.w / 2;
  const cy = (n: string) => node.get(n)!.box.y + node.get(n)!.box.h / 2;

  type Plan = { id: string; from: string; to: string; dp: number; dc: number; chan: number | null };
  const plans: Plan[] = flow.pipes.map((p) => {
    const dp = node.get(p.from)!.depth;
    const dc = node.get(p.to)!.depth;
    let chan: number | null = null;
    if (dc - dp > 1) {
      let best = -1;
      for (let i = 1; i < p.points.length - 2; i++) {
        const a = p.points[i], b = p.points[i + 1];
        if (Math.abs(a.y - b.y) < 1e-6 && Math.abs(b.x - a.x) > best) { best = Math.abs(b.x - a.x); chan = a.y; }
      }
      if (chan === null) chan = (cy(p.from) + cy(p.to)) / 2;
    }
    return { id: `${p.from}->${p.to}`, from: p.from, to: p.to, dp, dc, chan };
  });

  // trunk intervals per gutter
  const trunks = new Map<string, { gutter: number; y0: number; y1: number }>();
  const grow = (key: string, gutter: number, ya: number, yb: number) => {
    const t = trunks.get(key) ?? { gutter, y0: Infinity, y1: -Infinity };
    t.y0 = Math.min(t.y0, ya, yb);
    t.y1 = Math.max(t.y1, ya, yb);
    trunks.set(key, t);
  };
  for (const p of plans) {
    grow(`o:${p.dp}:${p.from}`, p.dp, cy(p.from), p.chan ?? cy(p.to));
    if (p.chan !== null) grow(`i:${p.dc - 1}:${p.to}`, p.dc - 1, p.chan, cy(p.to));
  }
  const trackX = new Map<string, number>();
  for (const gi of [...new Set([...trunks.values()].map((t) => t.gutter))]) {
    const list = [...trunks.entries()].filter(([, t]) => t.gutter === gi)
      .sort(([ka, a], [kb, b]) => (b.y1 - b.y0) - (a.y1 - a.y0) || a.y0 - b.y0 || (ka < kb ? -1 : 1));
    const tracks: [number, number][][] = [];
    const assign = new Map<string, number>();
    for (const [key, t] of list) {
      let i = tracks.findIndex((iv) => iv.every(([a, b]) => t.y1 < a - 6 || t.y0 > b + 6));
      if (i < 0) { i = tracks.length; tracks.push([]); }
      tracks[i].push([t.y0, t.y1]);
      assign.set(key, i);
    }
    for (const [key, i] of assign) trackX.set(key, gutterMid(gi) + (i - (tracks.length - 1) / 2) * TRACK);
  }

  const pipePts = new Map<string, Pt[]>();
  for (const p of plans) {
    const g1 = trackX.get(`o:${p.dp}:${p.from}`)!;
    const a = { x: cx(p.from), y: cy(p.from) };
    const b = { x: cx(p.to), y: cy(p.to) };
    if (p.chan === null) {
      pipePts.set(p.id, [a, { x: g1, y: a.y }, { x: g1, y: b.y }, b]);
    } else {
      const g2 = trackX.get(`i:${p.dc - 1}:${p.to}`)!;
      pipePts.set(p.id, [a, { x: g1, y: a.y }, { x: g1, y: p.chan }, { x: g2, y: p.chan }, { x: g2, y: b.y }, b]);
    }
  }

  const laneAtom = new Map<string, string>();
  const laneCount = new Map<string, number>();
  for (const n of flow.nodes) {
    laneCount.set(n.family, (laneCount.get(n.family) ?? 0) + 1);
    const cur = laneAtom.get(n.family);
    if (n.depth === 0 && (!cur || children.get(n.name)!.length > children.get(cur)!.length)) laneAtom.set(n.family, n.name);
  }
  return { node, parents, children, pipePts, laneAtom, laneCount };
}

/** ancestors of `f` and each one's longest hop count down to `f`. */
function lineage(g: Graph, f: string) {
  const hops = new Map<string, number>([[f, 0]]);
  const visit = (n: string) => {
    for (const p of g.parents.get(n) ?? []) {
      const h = hops.get(n)! + 1;
      if ((hops.get(p) ?? -1) < h) { hops.set(p, h); visit(p); }
    }
  };
  visit(f);
  return hops;
}

type R = { x: number; y: number; w: number; h: number };
const hit = (a: R, b: R, m = 0) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;

function KeyItem({ state, runs = 0, label }: { state: EvidenceState; runs?: number; label: string }) {
  return (
    <span className="flex items-center gap-1 whitespace-nowrap text-[13px] font-bold">
      <svg viewBox="-24 -30 48 54" className="h-7 w-7" aria-hidden>
        <Creature family="perception" atom={false} state={state} runs={runs} phase={0} still />
      </svg>
      {runs === 0 && (
        <svg viewBox="-8 -8 16 16" className="h-[14px] w-[14px]" aria-hidden><EvidenceGlyph state={state} /></svg>
      )}
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
  const colHeadH = 26;

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

  const g = useMemo(() => (flow && taxonomy ? buildGraph(flow, taxonomy.models) : null), [flow, taxonomy]);
  const evBy = useMemo(() => new Map<string, ModelEvidence>(evidence.map((e) => [e.name, e])), [evidence]);
  const runsBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of runs) m.set(r.model, (m.get(r.model) ?? 0) + 1);
    return m;
  }, [runs]);

  const focusNode = view?.focus && g ? g.node.get(view.focus) ?? null : null;
  const zoom = view && focusNode ? view.zoom : "overview";
  const bandH = headerH + (zoom !== "node" ? colHeadH : 0);

  // ——— camera target (uniform scale everywhere) ———
  const target: View | null = useMemo(() => {
    if (!flow || !g || size.w === 0) return null;
    if (zoom === "region" && focusNode) {
      const lane = flow.lanes[focusNode.lane];
      const box = { x: 0, y: lane.y - 12, w: flow.width, h: lane.h + 24 };
      if (mobile) {
        const sc = 0.9;
        return { sx: sc, sy: sc, tx: 4, ty: bandH + 8 - box.y * sc };
      }
      return fitView(box, { x: RAIL, y: bandH + 8, w: size.w - RAIL - TITLES - 16, h: size.h - bandH - 16 }, 1, 2);
    }
    if (zoom === "node" && focusNode) {
      const b = focusNode.box;
      const pad: CamBox = { x: b.x + b.w / 2 - b.w * 1.25, y: b.y + b.h / 2 - b.h * 1.8, w: b.w * 2.5, h: b.h * 3.6 };
      const nodeAvail: CamBox = mobile
        ? { x: 8, y: headerH + 8, w: size.w - 16, h: size.h * 0.52 - headerH - 16 }
        : { x: 24, y: headerH + 12, w: size.w - CARD_W - 16 - 72, h: size.h - headerH - 36 };
      // widen the frame to the direct parents so the parade's last leg is in shot
      let box = pad;
      for (const p of g.parents.get(focusNode.name) ?? []) {
        const q = g.node.get(p)!.box;
        const x0 = Math.min(box.x, q.x - 20), y0 = Math.min(box.y, q.y - 30);
        const x1 = Math.max(box.x + box.w, q.x + q.w + 20), y1 = Math.max(box.y + box.h, q.y + q.h + 40);
        box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      }
      const wide = fitView(box, nodeAvail, 1, 2.2);
      const cv = wide.sx >= (mobile ? 0.8 : 1.1) ? wide : fitView(pad, nodeAvail, 1, 2.2);
      // slide the focused creature next to its card so the speech tail stays short
      const fx = (b.x + b.w / 2) * cv.sx + cv.tx;
      const fy = (b.y + b.h / 2) * cv.sy + cv.ty;
      if (mobile) cv.ty += size.h * 0.54 - 8 - 84 - fy;
      else cv.tx += Math.max(0, size.w - 16 - CARD_W - 220 - fx);
      return cv;
    }
    if (mobile) {
      const sc = MOBILE_OVERVIEW_S;
      return { sx: sc, sy: sc, tx: MOBILE_RAIL, ty: bandH + 4 - 20 * sc };
    }
    const sc = Math.min((size.h - bandH - 14) / (flow.height - 28), (size.w - RAIL - TITLES - 48) / flow.width);
    const total = RAIL + flow.width * sc + TITLES;
    const left = Math.max(16, (size.w - total) / 2) + RAIL;
    return { sx: sc, sy: sc, tx: left, ty: bandH + 6 - 14 * sc };
  }, [flow, g, size.w, size.h, zoom, focusNode, mobile, bandH, headerH]);

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
  const lit = selected ?? hover;                   // whose lineage the pipes show
  const runKey = `${selected}:${run}`;
  const hops = useMemo(() => (g && selected ? lineage(g, selected) : null), [g, selected]);
  const litHops = useMemo(() => (g && lit ? lineage(g, lit) : null), [g, lit]);
  const paradePipes: ParadePipe[] = useMemo(() => {
    if (!g || !flow || !hops) return [];
    const H = Math.max(0, ...hops.values());
    return flow.pipes
      .filter((p) => hops.has(p.from) && hops.has(p.to) && hops.get(p.from)! > hops.get(p.to)!)
      .map((p) => ({
        id: `${p.from}->${p.to}`,
        points: g.pipePts.get(`${p.from}->${p.to}`)!,
        fromFamily: g.node.get(p.from)!.family,
        start: (H - hops.get(p.from)!) * STEP,
      }));
  }, [g, flow, hops]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && zoom === "node") update({ zoom: "region" }); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom, update]);

  // ——— ready marker: data in, fonts measured, first camera frame painted ———
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (!ready || !fontsReady || !v) return;
    // double rAF = the camera frame has been painted; the timeout covers
    // headless virtual time, where rAF can stall while nothing animates.
    let inner = 0;
    const outer = requestAnimationFrame(() => { inner = requestAnimationFrame(() => setDrawn(true)); });
    const t = setTimeout(() => setDrawn(true), 250);
    return () => { cancelAnimationFrame(outer); cancelAnimationFrame(inner); clearTimeout(t); };
  }, [ready, fontsReady, v]);

  const card = useMemo(() => {
    if (!selected || !taxonomy || !focusNode) return null;
    return cardModel(selected, { taxonomy, evidence, runs, family: focusNode.family, depth: focusNode.depth });
  }, [selected, taxonomy, focusNode, evidence, runs]);

  // ——— per-frame screen geometry + semantic-zoom labelling ———
  const scene = useMemo(() => {
    if (!v || !flow || !g) return null;
    const sc = v.sx;
    const X = (x: number) => x * sc + v.tx;
    const Y = (y: number) => y * sc + v.ty;
    const rowPitch = 64 * sc;
    const colSp = 220 * sc;
    // Glyph scale: as big as the row pitch allows; derived models put their
    // name tag BELOW when a full tag fits under them, else beside.
    const kFit = Math.min((rowPitch - 6) / 44, colSp / 110);
    const kBelow = (rowPitch - 25 - 8) / 44;
    const below = kBelow >= 0.8;
    const kMax = mobile && zoom === "overview" ? 0.52 : 1.6;
    const k = clamp(below ? Math.min(kFit, kBelow) : kFit, 0.45, kMax);
    const font = Math.round(clamp(11 + 2.5 * k, 13, 16));
    const tagH = font + 10;
    const tube = clamp(2.5 + 2.8 * k, 3.5, 8);
    const kAtom = Math.max(k, Math.min(1.2 * k, (rowPitch - 4) / 54, kMax * 1.1));

    const nodes = flow.nodes.map((n) => {
      const atom = n.depth === 0;
      const kk = atom ? kAtom : k;
      const cx = X(n.box.x + n.box.w / 2);
      const cy = Y(n.box.y + n.box.h / 2);
      const left = (n.family === "sequence" ? 27 : n.family === "representation" ? 24 : 20) * kk;
      const right = (n.family === "representation" ? 24 : n.family === "decision" ? 21 : 19) * kk;
      const top = (atom ? 31 : n.family === "decision" ? 30 : 26) * kk;
      const body: R = { x: cx - left, y: cy - top, w: left + right, h: top + 22 * kk };
      return { n, atom, kk, cx, cy, left, right, body };
    });

    // pipes in screen space (+ segments for tag avoidance)
    const pipes = flow.pipes.map((p) => {
      const id = `${p.from}->${p.to}`;
      const pts = g.pipePts.get(id)!.map((q) => ({ x: X(q.x), y: Y(q.y) }));
      return { id, from: p.from, to: p.to, pts };
    });
    const segs: { r: R; from: string; to: string; first: boolean; last: boolean }[] = [];
    const pad = tube / 2 + 1;
    for (const p of pipes) {
      for (let i = 0; i < p.pts.length - 1; i++) {
        const a = p.pts[i], b = p.pts[i + 1];
        segs.push({
          r: { x: Math.min(a.x, b.x) - pad, y: Math.min(a.y, b.y) - pad, w: Math.abs(a.x - b.x) + 2 * pad, h: Math.abs(a.y - b.y) + 2 * pad },
          from: p.from, to: p.to, first: i === 0, last: i === p.pts.length - 2,
        });
      }
    }

    // the visible stage for tags: under the header band, clear of the card / sheet
    const stage: R = {
      x: 4, y: bandH + 2,
      w: (selected && !mobile ? size.w - 16 - CARD_W - 10 : size.w - 4) - 4,
      h: (selected && mobile ? size.h * 0.54 - 12 : size.h - 4) - bandH - 2,
    };
    const inside = (r: R) => r.x >= stage.x && r.y >= stage.y && r.x + r.w <= stage.x + stage.w && r.y + r.h <= stage.y + stage.h;

    // mobile lane tabs are placed first (they are obstacles for tags)
    const tabs = mobile ? flow.lanes.map((l) => {
      const label = fam(l.family).label;
      const tw = measure.current(label, 13) + 18;
      const x1 = Math.min(X(flow.width - 18), size.w - 8);
      return { family: l.family, label, r: { x: x1 - tw, y: Y(l.y) - 11, w: tw, h: 22 } };
    }) : [];

    // greedy labelling in importance order
    const childCount = (n: string) => g.children.get(n)!.length;
    const order = [...nodes].sort((a, b) =>
      Number(b.n.name === selected) - Number(a.n.name === selected)
      || Number(b.atom) - Number(a.atom)
      || childCount(b.n.name) - childCount(a.n.name)
      || a.n.depth - b.n.depth
      || (a.n.name < b.n.name ? -1 : 1));
    const placed: R[] = tabs.map((t) => t.r);
    const tags = new Map<string, { x: number; y: number; w: number; fs: number; text: string }>();
    for (const q of order) {
      const text = displayName(q.n.name);
      const fs = q.atom && !mobile ? font + 1 : font;
      const tw = measure.current(text, fs) + 33;       // 6 pad · 13 glyph · 5 gap · text · 9 pad
      const right: R = { x: q.cx + q.right + 4, y: q.cy - tagH / 2, w: tw, h: tagH };
      const leftR: R = { x: q.cx - q.left - 4 - tw, y: q.cy - tagH / 2, w: tw, h: tagH };
      const under: R = { x: q.cx - tw / 2, y: q.cy + 22 * q.kk + 3, w: tw, h: tagH };
      const underR: R = { ...under, x: q.cx - q.left };   // under, hung right (clears the gutter on its left)
      const isSel = q.n.name === selected;
      const cands = q.atom ? [leftR, right, under] : below ? [under, underR, right] : [right, under, underR, leftR];
      const ok = (r: R) => inside(r)
        && !nodes.some((o) => o !== q && hit(r, o.body, 1))
        && !placed.some((o) => hit(r, o, 3))
        && !segs.some((sg) => {
          const own = (sg.from === q.n.name && sg.first) || (sg.to === q.n.name && sg.last);
          return !own && hit(r, sg.r);
        });
      // the focused model is always named (under or right of it, clear of its incoming parade);
      // it may sit over a foreign pipe, never over a creature or another tag
      const pick = isSel
        ? [under, underR, right].find((r) => inside(r) && !nodes.some((o) => o !== q && hit(r, o.body, 1)) && !placed.some((o) => hit(r, o, 3))) ?? cands.find(ok) ?? right
        : cands.find(ok);
      if (!pick) continue;
      placed.push(pick);
      tags.set(q.n.name, { x: pick.x, y: pick.y, w: pick.w, fs, text });
    }

    // trays hug everything drawn in their lane (same horizontal extent for all lanes)
    let tx0 = X(6), tx1 = X(flow.width - 6);
    for (const q of nodes) {
      tx0 = Math.min(tx0, q.body.x - 10);
      const t = tags.get(q.n.name);
      if (t) { tx0 = Math.min(tx0, t.x - 10); tx1 = Math.max(tx1, t.x + t.w + 10); }
    }
    return { X, Y, sc, k, tagH, below, tube, nodes, pipes, tags, tabs, tx0, tx1 };
  }, [v, flow, g, size.w, size.h, fontsReady, mobile, zoom, selected, bandH]); // eslint-disable-line react-hooks/exhaustive-deps

  const pipeD = useMemo(() => {
    if (!scene) return [];
    return scene.pipes.map((p) => {
      let role: "anc" | "kid" | "dim" | "rest" = "rest";
      if (litHops && lit) {
        role = litHops.has(p.from) && litHops.has(p.to) && litHops.get(p.from)! > litHops.get(p.to)! ? "anc" : p.from === lit ? "kid" : "dim";
      }
      return { id: p.id, d: roundedD(p.pts, 14), from: p.from, role };
    });
  }, [scene, litHops, lit]);

  // ——— the speech-bubble tail from the card to the focused creature ———
  const tail = (() => {
    if (!scene || !selected || !card) return null;
    const me = scene.nodes.find((q) => q.n.name === selected);
    if (!me) return null;
    const myTag = scene.tags.get(selected);
    if (mobile) {
      const top = size.h * 0.54;
      const tip = { x: me.cx, y: me.cy + 22 * me.kk + (myTag && myTag.y > me.cy ? scene.tagH + 8 : 6) };
      if (tip.y > top - 16) return null;
      const bx = clamp(tip.x, 44, size.w - 44);
      return { fill: `M${bx - 16} ${top + 4} Q${bx - 4} ${(top + tip.y) / 2} ${tip.x} ${tip.y} Q${bx + 8} ${(top + tip.y) / 2} ${bx + 16} ${top + 4} Z`,
        line: `M${bx - 16} ${top + 1.5} Q${bx - 4} ${(top + tip.y) / 2} ${tip.x} ${tip.y} Q${bx + 8} ${(top + tip.y) / 2} ${bx + 16} ${top + 1.5}` };
    }
    const left = size.w - 16 - CARD_W;
    const tip = { x: me.cx + 26 * me.kk, y: me.cy - 10 * me.kk };
    if (tip.x > left - 24) return null;
    const by = clamp(tip.y, 76 + 60, size.h - 80);
    const mx = (left + tip.x) / 2;
    return { fill: `M${left + 4} ${by - 18} Q${mx} ${by - 6} ${tip.x} ${tip.y} Q${mx} ${by + 10} ${left + 4} ${by + 18} Z`,
      line: `M${left + 1.5} ${by - 18} Q${mx} ${by - 6} ${tip.x} ${tip.y} Q${mx} ${by + 10} ${left + 1.5} ${by + 18}` };
  })();

  const familyOf = useCallback((n: string) => g?.node.get(n)?.family ?? "", [g]);
  const crumbs = focusNode && zoom !== "overview" ? fam(focusNode.family).label : null;

  return (
    <LabMotion still={still}>
      <div data-lab-ready={drawn ? "1" : undefined} className={`${s.stage} relative h-full overflow-hidden`}>
        <span ref={probe} className={`${s.display} pointer-events-none absolute -left-[9999px] top-0`} aria-hidden>Aa</span>

        <div ref={ref} {...cam.handlers} className="absolute inset-0 touch-none select-none">
          {scene && v && flow && g && (
            <svg className="h-full w-full" role="application" aria-label="Dataflow board of the model zoo">
              <defs>
                <pattern id="flow-dots" patternUnits="userSpaceOnUse" x={v.tx} y={v.ty} width={32 * scene.sc} height={32 * scene.sc}>
                  <circle cx={1.5} cy={1.5} r={1.5} fill={DOT} />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={PAPER} />
              <rect width="100%" height="100%" fill="url(#flow-dots)" />

              {/* lane trays = families */}
              {flow.lanes.map((l) => {
                const f = fam(l.family);
                const rx = clamp(18 * scene.k, 10, 24);
                const y = scene.Y(l.y), h = l.h * scene.sc, w = scene.tx1 - scene.tx0;
                return (
                  <g key={l.family}>
                    <rect x={scene.tx0} y={y + 4} width={w} height={h} rx={rx} fill={f.deep} fillOpacity={0.22} />
                    <rect x={scene.tx0} y={y} width={w} height={h} rx={rx} fill={PAPER} stroke={f.deep} strokeOpacity={0.45} strokeWidth={1.5} />
                    <rect x={scene.tx0} y={y} width={w} height={h} rx={rx} fill={f.fill} fillOpacity={0.3} />
                  </g>
                );
              })}

              {/* pipes = builds_on; tube colour = the parent's family; hubs share one trunk */}
              {[...pipeD].sort((a, b) => (a.role === "dim" ? 0 : 1) - (b.role === "dim" ? 0 : 1)).map((p) => {
                const col = fam(g.node.get(p.from)!.family).fill;
                const on = p.role === "anc" || p.role === "kid";
                const w = on ? scene.tube + 1.5 : scene.tube;
                return (
                  <g key={p.id} opacity={p.role === "dim" ? 0.25 : 1} fill="none" strokeLinecap="round" strokeLinejoin="round">
                    {p.role === "anc" && (
                      <>
                        <path d={p.d} stroke={col} strokeWidth={w + 16} strokeOpacity={0.35} />
                        <path d={p.d} stroke="#fff" strokeWidth={w + 8} strokeOpacity={0.9} />
                      </>
                    )}
                    <path d={p.d} stroke={INK} strokeWidth={w + 3} strokeOpacity={on ? 0.9 : 0.45} />
                    <path d={p.d} stroke={col} strokeWidth={w} />
                  </g>
                );
              })}

              {/* creatures */}
              {scene.nodes.map(({ n, cx, cy, kk }) => {
                const st = evidenceState(evBy.get(n.name));
                const isSel = n.name === selected;
                return (
                  <g key={n.name} transform={`translate(${cx} ${cy})`} className={s.node} tabIndex={0} role="button"
                    aria-label={`${displayName(n.name)}, ${fam(n.family).label}, ${st}`}
                    onClick={() => select(n.name)}
                    onPointerEnter={() => setHover(n.name)} onPointerLeave={() => setHover((h) => (h === n.name ? null : h))}
                    onFocus={() => setHover(n.name)} onBlur={() => setHover((h) => (h === n.name ? null : h))}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(n.name); } }}>
                    <title>{displayName(n.name)}</title>
                    <circle className={s.ring} r={30 * kk} fill="none" stroke={INK} strokeWidth={3} strokeDasharray="5 4" />
                    {isSel && <circle r={31 * kk} fill="#fff" stroke={INK} strokeWidth={2.5} />}
                    <circle r={24 * kk} fill="transparent" />
                    <g transform={`scale(${kk})`}>
                      <g key={isSel && landed === runKey ? runKey : "idle"} className={isSel && landed === runKey && !still ? s.bounce : undefined}>
                        <Creature family={n.family} atom={n.depth === 0} state={st}
                          runs={runsBy.get(n.name) ?? 0} phase={hash01(n.name)} still={still} />
                      </g>
                    </g>
                  </g>
                );
              })}

              {/* name tags: evidence glyph + name; elders wear their family colour, the selected one is inked */}
              {scene.nodes.map(({ n }) => {
                const t = scene.tags.get(n.name);
                if (!t) return null;
                const isSel = n.name === selected;
                const atom = n.depth === 0;
                const st = evidenceState(evBy.get(n.name));
                return (
                  <g key={n.name} pointerEvents="none">
                    <rect x={t.x} y={t.y} width={t.w} height={scene.tagH} rx={scene.tagH / 2}
                      fill={isSel ? INK : atom ? fam(n.family).fill : "#fff"} stroke={INK} strokeWidth={atom || isSel ? 2 : 1.4} />
                    <g transform={`translate(${t.x + 12.5} ${t.y + scene.tagH / 2})`}>
                      {isSel && <circle r={7.6} fill="#fff" />}
                      <EvidenceGlyph state={st} />
                    </g>
                    <text x={t.x + 24} y={t.y + scene.tagH / 2 + 0.5} fontSize={t.fs} dominantBaseline="central"
                      className={s.display} fill={isSel ? "#fff" : INK}>{t.text}</text>
                  </g>
                );
              })}

              {selected && (
                <Parade pipes={paradePipes} view={v} size={clamp(scene.tube * 2.5, 11, 21)} still={still} runKey={runKey}
                  onLanded={() => setLanded(runKey)} />
              )}

              {/* lane titles (desktop: right of the trays) / folder tabs (mobile) */}
              {mobile ? scene.tabs.map((t) => (
                <g key={t.family} className="cursor-pointer" onClick={() => { const a = g.laneAtom.get(t.family); if (a) update({ zoom: "region", focus: a }); }}>
                  <rect x={t.r.x} y={t.r.y} width={t.r.w} height={t.r.h} rx={11} fill={fam(t.family).fill} stroke={INK} strokeWidth={1.8} />
                  <text x={t.r.x + t.r.w / 2} y={t.r.y + 11.5} textAnchor="middle" dominantBaseline="central" className={s.display} fontSize={13} fill={INK}>{t.label}</text>
                </g>
              )) : zoom !== "node" && flow.lanes.map((l) => {
                const f = fam(l.family);
                const top = scene.Y(l.y);
                const x = scene.tx1 + 16;
                if (x > size.w - 150 || top + 40 < bandH || top > size.h) return null;
                const atom = g.laneAtom.get(l.family);
                return (
                  <g key={l.family} className="cursor-pointer" onClick={() => atom && update({ zoom: "region", focus: atom })}>
                    <text x={x} y={top + 20} className={s.display} fontSize={18} fill={INK}>{f.label}</text>
                    <text x={x} y={top + 42} fontSize={14} fontWeight={700} fill={INK_SOFT}>{g.laneCount.get(l.family) ?? 0} {f.kind}</text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* opaque paper band behind the header (+ generation headers) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30" style={{ height: bandH, background: PAPER, boxShadow: `0 1.5px 0 rgba(59,46,90,0.14)` }}>
          {scene && flow && zoom !== "node" && flow.columns.map((c) => {
            const x = scene.X(c.x + 75);
            if (x < 30 || x > size.w - 30) return null;
            return (
              <span key={c.depth} className="absolute -translate-x-1/2 whitespace-nowrap text-[13px] font-extrabold leading-6"
                style={{ left: x, top: headerH - 2, color: INK }}>
                {c.depth === 0 ? "Atoms" : scene.sc * 220 < 130 ? `Gen ${c.depth}` : `Generation ${c.depth}`}
              </span>
            );
          })}
        </div>

        {tail && (
          <svg className="pointer-events-none absolute inset-0 z-30 h-full w-full" aria-hidden>
            <path d={tail.fill} fill="#fff" />
            <path d={tail.line} fill="none" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
          </svg>
        )}

        {card && (
          <FlowCard c={card} mobile={mobile} still={still} runs={runsBy.get(card.name) ?? 0} phase={hash01(card.name)}
            familyOf={familyOf} onPick={select} onClose={() => update({ zoom: "region" })} />
        )}

        {/* header */}
        <header className="absolute inset-x-3 top-3 z-40 flex items-center gap-3 rounded-full border-[2.5px] bg-white px-4"
          style={{ height: headerH - 18, borderColor: INK, boxShadow: `0 4px 0 ${INK}` }}>
          <a href="/lab/" className={`${s.btn} shrink-0 rounded-full text-[13px] font-bold underline underline-offset-2`}>All skins</a>
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
              <KeyItem state="trained" runs={1} label="has local runs" />
            </div>
          )}
          <input list="flow-models" placeholder="Find a model" aria-label="Find a model"
            className={`${s.search} w-[132px] rounded-full border-2 bg-[#F3F0FF] px-3 py-1 text-[14px] font-bold placeholder:text-[#5E4F80] sm:w-[170px]`}
            style={{ borderColor: INK }}
            onChange={(e) => {
              const name = e.target.value.trim().replace(/ /g, "_");
              if (g?.node.has(name)) { select(name); e.target.value = ""; e.target.blur(); }
            }} />
          <datalist id="flow-models">
            {flow?.nodes.map((n) => <option key={n.name} value={displayName(n.name)} />)}
          </datalist>
        </header>

        {!online && (
          <p className="absolute inset-x-0 top-24 z-40 mx-auto w-fit max-w-[90%] rounded-2xl border-2 bg-white px-4 py-3 text-[15px] font-bold" style={{ borderColor: INK }}>
            The model API at localhost:8000 is not answering. Start it with python main.py serve; the board retries every 3 seconds.
          </p>
        )}
      </div>
    </LabMotion>
  );
}
