"use client";

// Skin D · Kawaii flow — the zoo as a dataflow board.
// Positions come ONLY from buildFlow (columns = generation depth, lanes =
// families, pipes = builds_on). The local camera maps them with independent
// x/y scales; creatures, tags and text are drawn at screen size on top.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { roundedD, type FlowLayout, type FlowNode, type Pt } from "@/lib/world";
import type { ModelEvidence } from "@/lib/types";
import { useWorld } from "@/hooks/use-world";
import { useLabView } from "@/components/lab/shared/url-state";
import { LabMotion } from "@/components/lab/shared/still";
import { cardModel, displayName, evidenceState, type EvidenceState } from "@/components/lab/shared/card-model";
import { fitView, useFlowCamera, useStageSize, type CamBox, type View } from "./camera";
import { Creature } from "./creature";
import { FlowCard } from "./card";
import { Parade, STEP, type ParadePipe } from "./parade";
import { fam, INK, INK_SOFT, PAPER, DOT } from "./palette";
import s from "./flow.module.css";

const CARD_W = 400;
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
  /** world-px pipe polylines extended to both creature centres. */
  pipePts: Map<string, Pt[]>;
  laneAtom: Map<string, string>;
  laneCount: Map<string, number>;
}

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
  const pipePts = new Map<string, Pt[]>();
  for (const p of flow.pipes) {
    const a = node.get(p.from)!.box;
    const b = node.get(p.to)!.box;
    const pts = p.points.map((q) => ({ ...q }));
    pts[0] = { x: a.x + a.w / 2, y: pts[0].y };
    pts[pts.length - 1] = { x: b.x + b.w / 2, y: pts[pts.length - 1].y };
    pipePts.set(`${p.from}->${p.to}`, pts);
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

function FaceKey({ state, label }: { state: EvidenceState; label: string }) {
  return (
    <span className="flex items-center gap-1 whitespace-nowrap text-[13px] font-bold">
      <svg viewBox="-24 -26 48 50" className="h-7 w-7" aria-hidden>
        <Creature family="perception" atom={false} depth={1} children={0} state={state} runs={0} phase={0} still />
      </svg>
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
  const headerH = mobile ? 60 : 72;
  const colHeadH = 30;
  const gutter = mobile ? 0 : 200;

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

  // ——— camera target ———
  const target: View | null = useMemo(() => {
    if (!flow || !g || size.w === 0) return null;
    // right margin leaves the last generation's name tags room on screen
    const right = mobile ? 8 : 150;
    const avail: CamBox = { x: gutter + 8, y: headerH + colHeadH, w: size.w - gutter - 8 - right, h: size.h - headerH - colHeadH - 12 };
    if (zoom === "region" && focusNode) {
      const lane = flow.lanes[focusNode.lane];
      return fitView({ x: 0, y: lane.y - 10, w: flow.width, h: lane.h + 20 }, avail, mobile ? 3.2 : 2.2, 2.2);
    }
    if (zoom === "node" && focusNode) {
      const b = focusNode.box;
      const pad: CamBox = { x: b.x + b.w / 2 - b.w * 1.25, y: b.y + b.h / 2 - b.h * 1.8, w: b.w * 2.5, h: b.h * 3.6 };
      const nodeAvail: CamBox = mobile
        ? { x: 8, y: headerH + 8, w: size.w - 16, h: size.h * 0.52 - headerH - 16 }
        : { x: 24, y: headerH + colHeadH, w: size.w - CARD_W - 16 - 72, h: size.h - headerH - colHeadH - 24 };
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
      // (upstream parents sit to the left/top, so they stay in shot)
      const fx = (b.x + b.w / 2) * cv.sx + cv.tx;
      const fy = (b.y + b.h / 2) * cv.sy + cv.ty;
      if (mobile) cv.ty += size.h * 0.54 - 8 - 84 - fy;
      else cv.tx += Math.max(0, size.w - 16 - CARD_W - 220 - fx);
      return cv;
    }
    return fitView({ x: 0, y: 0, w: flow.width, h: flow.height }, avail, mobile ? 1.3 : 3.6, 4);
  }, [flow, g, size.w, size.h, zoom, focusNode, mobile, gutter, headerH]);

  const cam = useFlowCamera(target, still);
  const v = cam.view;

  // ——— selection, parade, bounce ———
  const [run, setRun] = useState(0);
  const [landed, setLanded] = useState<string | null>(null);
  const select = useCallback((name: string) => {
    setRun((r) => r + 1);
    update({ zoom: "node", focus: name });
  }, [update]);
  const selected = zoom === "node" && focusNode ? focusNode.name : null;
  const runKey = `${selected}:${run}`;
  const hops = useMemo(() => (g && selected ? lineage(g, selected) : null), [g, selected]);
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

  // ——— per-frame screen geometry ———
  const scene = useMemo(() => {
    if (!v || !flow || !g) return null;
    const X = (x: number) => x * v.sx + v.tx;
    const Y = (y: number) => y * v.sy + v.ty;
    const rowPitch = 64 * v.sy;
    const colSp = 220 * v.sx;
    // Glyph scale: as big as the row pitch allows; derived models put their
    // name tag BELOW when a full-size tag fits under them, else beside.
    // Elders (atoms) always wear a name plate beside them, so their hats
    // never collide with the tag of the elder above.
    const kFit = Math.min((rowPitch - 6) / 44, colSp / 110);
    const font0 = 13;
    const kBelow = (rowPitch - (font0 + 12) - 8) / 44;
    const below = kBelow >= 0.95;
    const k = clamp(below ? Math.min(kFit, kBelow) : kFit, 0.5, 1.6);
    const font = Math.round(clamp(11 + 2.5 * k, 13, 16));
    const tagH = font + 10;
    const tube = clamp(2.5 + 2.8 * k, 4, 8);
    const kAtom = Math.max(k, Math.min(1.2 * k, (rowPitch - 4) / 54));
    const nodes = flow.nodes.map((n) => {
      const cx = X(n.box.x + n.box.w / 2);
      const cy = Y(n.box.y + n.box.h / 2);
      const atom = n.depth === 0;
      const kk = atom ? kAtom : k;
      const text = displayName(n.name);
      const fs = atom ? font + 1 : font;
      const tw = measure.current(text, fs) + 16;
      let tag: { x: number; y: number; w: number } | null;
      const lastCol = n.col === flow.columns.length - 1;
      if (below && !atom) {
        tag = tw <= colSp - 14 && cx + tw / 2 <= size.w - 4 ? { x: cx - tw / 2, y: cy + 22 * kk + 3, w: tw } : null;
      } else {
        const x0 = cx + 24 * kk + 3;
        const room = lastCol ? size.w - x0 - 8 : colSp - 24 * kk - 3 - 26 * k - 10;
        tag = tw <= room ? { x: x0, y: cy - tagH / 2, w: tw } : null;
      }
      return { n, cx, cy, kk, text, fs, tag };
    });
    return { X, Y, k, font, tagH, below, tube, nodes };
  }, [v, flow, g, size.w, fontsReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const pipeD = useMemo(() => {
    if (!v || !flow || !g) return [];
    return flow.pipes.map((p) => {
      const id = `${p.from}->${p.to}`;
      const pts = g.pipePts.get(id)!.map((q) => ({ x: q.x * v.sx + v.tx, y: q.y * v.sy + v.ty }));
      let role: "anc" | "kid" | "dim" | "rest" = "rest";
      if (hops && selected) role = hops.has(p.from) && hops.has(p.to) && hops.get(p.from)! > hops.get(p.to)! ? "anc" : p.from === selected ? "kid" : "dim";
      return { id, d: roundedD(pts, 14), from: p.from, role };
    });
  }, [v, flow, g, hops, selected]);

  // ——— the speech-bubble tail from the card to the focused creature ———
  const tail = (() => {
    if (!scene || !selected || !card) return null;
    const me = scene.nodes.find((q) => q.n.name === selected);
    if (!me) return null;
    if (mobile) {
      const top = size.h * 0.54;
      const tip = { x: me.cx, y: me.cy + 22 * me.kk + (me.tag && scene.below ? scene.tagH + 8 : 6) };
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

  const laneOf = (f: string) => g?.laneAtom.get(f);
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
                <pattern id="flow-dots" patternUnits="userSpaceOnUse" x={v.tx} y={v.ty} width={32 * v.sx} height={32 * v.sy}>
                  <circle cx={1.5} cy={1.5} r={1.5} fill={DOT} />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={PAPER} />
              <rect width="100%" height="100%" fill="url(#flow-dots)" />

              {/* lanes = families */}
              {flow.lanes.map((l) => {
                const f = fam(l.family);
                const x0 = scene.X(6), x1 = scene.X(flow.width - 6);
                const rx = clamp(18 * scene.k, 10, 24);
                // a shallow tray: the same hard offset edge the card and header wear
                return (
                  <g key={l.family}>
                    <rect x={x0} y={scene.Y(l.y) + 4} width={x1 - x0} height={l.h * v.sy} rx={rx} fill={f.deep} fillOpacity={0.22} />
                    <rect x={x0} y={scene.Y(l.y)} width={x1 - x0} height={l.h * v.sy} rx={rx}
                      fill={PAPER} stroke={f.deep} strokeOpacity={0.45} strokeWidth={1.5} />
                    <rect x={x0} y={scene.Y(l.y)} width={x1 - x0} height={l.h * v.sy} rx={rx} fill={f.fill} fillOpacity={0.3} />
                  </g>
                );
              })}

              {/* pipes = builds_on; tube colour = the parent's family */}
              {[...pipeD].sort((a, b) => (a.role === "dim" ? 0 : 1) - (b.role === "dim" ? 0 : 1)).map((p) => {
                const col = fam(g.node.get(p.from)!.family).fill;
                const on = p.role === "anc" || p.role === "kid";
                const w = on ? scene.tube + 1.5 : scene.tube;
                return (
                  <g key={p.id} opacity={p.role === "dim" ? 0.28 : 1} fill="none" strokeLinecap="round" strokeLinejoin="round">
                    {p.role === "anc" && (
                      <>
                        <path d={p.d} stroke={col} strokeWidth={w + 16} strokeOpacity={0.35} />
                        <path d={p.d} stroke="#fff" strokeWidth={w + 8} strokeOpacity={0.9} />
                      </>
                    )}
                    <path d={p.d} stroke={INK} strokeWidth={w + 3} strokeOpacity={on ? 0.9 : 0.45} />
                    <path d={p.d} stroke={col} strokeWidth={w} />
                    <path d={p.d} stroke="#fff" strokeWidth={Math.max(1, w * 0.22)} strokeOpacity={0.7} transform={`translate(0 ${-w * 0.18})`} />
                  </g>
                );
              })}

              {/* creatures */}
              {scene.nodes.map(({ n, cx, cy, kk }) => {
                const ev = evBy.get(n.name);
                const st = evidenceState(ev);
                const isSel = n.name === selected;
                return (
                  <g key={n.name} transform={`translate(${cx} ${cy})`} className={s.node} tabIndex={0} role="button"
                    aria-label={`${displayName(n.name)}, ${fam(n.family).label}, ${st}`}
                    onClick={() => select(n.name)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(n.name); } }}>
                    <title>{displayName(n.name)}</title>
                    <circle className={s.ring} r={30 * kk} fill="none" stroke={INK} strokeWidth={3} strokeDasharray="5 4" />
                    {isSel && <circle r={31 * kk} fill="#fff" stroke={INK} strokeWidth={2.5} />}
                    <circle r={24 * kk} fill="transparent" />
                    <g transform={`scale(${kk})`}>
                      <g key={isSel && landed === runKey ? runKey : "idle"} className={isSel && landed === runKey && !still ? s.bounce : undefined}>
                        <Creature family={n.family} atom={n.depth === 0} depth={n.depth} children={g.children.get(n.name)!.length}
                          state={st} runs={runsBy.get(n.name) ?? 0} phase={hash01(n.name)} still={still} />
                      </g>
                    </g>
                  </g>
                );
              })}

              {/* name tags: elders (atoms) wear their family colour, the selected one is inked */}
              {scene.nodes.map(({ n, fs, tag, text }) => {
                if (!tag) return null;
                const isSel = n.name === selected;
                const atom = n.depth === 0;
                return (
                  <g key={n.name} pointerEvents="none">
                    <rect x={tag.x} y={tag.y} width={tag.w} height={scene.tagH} rx={scene.tagH / 2}
                      fill={isSel ? INK : atom ? fam(n.family).fill : "#fff"} stroke={INK} strokeWidth={atom || isSel ? 2 : 1.4} />
                    <text x={tag.x + tag.w / 2} y={tag.y + scene.tagH / 2 + 0.5} fontSize={fs} textAnchor="middle" dominantBaseline="central"
                      className={s.display} fill={isSel ? "#fff" : INK}>{text}</text>
                  </g>
                );
              })}

              {selected && v && (
                <Parade pipes={paradePipes} view={v} size={clamp(scene.tube * 2.5, 11, 21)} still={still} runKey={runKey}
                  onLanded={() => setLanded(runKey)} />
              )}

              {/* lane titles: family, how many, and which creature shape they wear */}
              {flow.lanes.map((l) => {
                const f = fam(l.family);
                const n = g.laneCount.get(l.family) ?? 0;
                const top = scene.Y(l.y);
                const atom = laneOf(l.family);
                const go = () => atom && update({ zoom: "region", focus: atom });
                if (top + 40 < headerH || top > size.h) return null;
                if (mobile) {
                  // a folder tab straddling the lane's top edge, right-aligned
                  const tw = measure.current(f.label, 13) + 18;
                  const x1 = scene.X(flow.width - 18);
                  return (
                    <g key={l.family} className="cursor-pointer" onClick={go}>
                      <rect x={x1 - tw} y={top - 11} width={tw} height={22} rx={11} fill={f.fill} stroke={INK} strokeWidth={1.8} />
                      <text x={x1 - tw / 2} y={top + 0.5} textAnchor="middle" dominantBaseline="central" className={s.display} fontSize={13} fill={INK}>{f.label}</text>
                    </g>
                  );
                }
                const x = scene.X(6) - 14;
                if (x < 120) return null;
                return (
                  <g key={l.family} className="cursor-pointer" onClick={go}>
                    <text x={x} y={top + 20} textAnchor="end" className={s.display} fontSize={18} fill={INK}>{f.label}</text>
                    <text x={x} y={top + 42} textAnchor="end" fontSize={14} fontWeight={700} fill={INK_SOFT}>{n} {f.kind}</text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* column headers = generation depth, sticky under the header */}
        {scene && flow && v && zoom !== "node" && (
          <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: Math.max(headerH + 2, scene.Y(0) - colHeadH) }}>
            {flow.columns.map((c) => {
              const x = scene.X(c.x + 75);
              if (x < -60 || x > size.w + 60) return null;
              return (
                <span key={c.depth} className="absolute -translate-x-1/2 whitespace-nowrap rounded-full px-2 text-[13px] font-extrabold leading-6"
                  style={{ left: x, background: PAPER, color: INK }}>
                  {c.depth === 0 ? "Atoms" : `Generation ${c.depth}`}
                </span>
              );
            })}
          </div>
        )}

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
          {size.w >= 1180 && (
            <div className="flex items-center gap-3" aria-label="What the faces mean">
              <FaceKey state="champion" label="champion" />
              <FaceKey state="trained" label="trained" />
              <FaceKey state="provisional" label="new bar" />
              <FaceKey state="untrained" label="not trained" />
            </div>
          )}
          <input list="flow-models" placeholder="Find a model" aria-label="Find a model"
            className={`${s.search} w-[132px] rounded-full border-2 bg-[#F3F0FF] px-3 py-1 text-[14px] font-bold placeholder:text-[#5E4F80] sm:w-[180px]`}
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
