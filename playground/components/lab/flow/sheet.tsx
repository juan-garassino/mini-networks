"use client";

// The DFD sheet itself, in sheet coordinates (lib/world/dfd.ts): swim lanes, the
// column header row, every builds_on edge as one orthogonal ink line with rounded
// elbows and an arrowhead at its own input port, inline labels in gaps, and the
// boxes (process = derived model, store = atom). Pure render: the board owns the
// camera, the selection and the motion.
import { memo } from "react";
import type { Pt } from "@/lib/world";
import { elbowD, DFD_ATOM_CELL, type DfdBox, type DfdEdge, type DfdLayout } from "@/lib/world/dfd";
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { Critter, EvidenceMark } from "./critter";
import { ACCENT, fam, HEAD, INK, INK_SOFT, RULE, SHEET } from "./palette";
import s from "./flow.module.css";

export const NAME_PX = 13;
const LINE = 12.6;
const words = (n: string) => n.replace(/_/g, " ");
export const edgeKey = (e: { from: string; to: string }) => `${e.from}->${e.to}`;

/** Filled arrowhead whose tip sits on the last point, pointing along the last run. */
function arrowD(pts: Pt[], len = 7, half = 3.6): string {
  const z = pts[pts.length - 1], y = pts[pts.length - 2];
  const ux = Math.sign(z.x - y.x), uy = Math.sign(z.y - y.y);
  const bx = z.x - ux * len, by = z.y - uy * len;
  return `M${z.x} ${z.y} L${bx - uy * half} ${by + ux * half} L${bx + uy * half} ${by - ux * half} Z`;
}
/** The route stops short of the tip so the arrowhead stays a clean point. */
function trimEnd(pts: Pt[], d = 5): Pt[] {
  const z = pts[pts.length - 1], y = pts[pts.length - 2];
  const ux = Math.sign(z.x - y.x), uy = Math.sign(z.y - y.y);
  return [...pts.slice(0, -1), { x: z.x - ux * d, y: z.y - uy * d }];
}

export interface SheetState {
  states: Map<string, EvidenceState>;
  /** models lit by hover / focus / selection (null = nothing lit) */
  lit: Set<string> | null;
  litEdges: Set<string> | null;
  selected: string | null;
  /** a pipeline being shown: its members in order */
  pipeline: string[] | null;
  /** Konami forward pass: per-model delay (ms) and the run key */
  wave: { key: number; delay: Record<string, number> } | null;
}

const Box = memo(function Box({ b, state, dim, sel, order, delay, waveKey, onPick, onHover }: {
  b: DfdBox; state: EvidenceState; dim: boolean; sel: boolean; order: number; delay: number | null; waveKey: number;
  onPick: (n: string) => void; onHover: (n: string | null, on: boolean) => void;
}) {
  const f = fam(b.family);
  const { x, y, w, h } = b;
  const r = 7;
  const strip = 12;
  const two = b.lines.length > 1;
  const nameX = b.atom ? x + DFD_ATOM_CELL + 34 : x + 34;
  const mid = b.atom ? y + h / 2 : y + strip + (h - strip) / 2;
  // two lines under a header strip ride 1.2 px high so the second line's descenders clear the border
  const lift = two && !b.atom ? 1.2 : 0;
  const base = two ? [mid - LINE / 2 + 4.4 - lift, mid + LINE / 2 + 4.4 - lift] : [mid + 4.6];
  const stroke = sel || order > 0 ? ACCENT : INK;
  return (
    <g role="button" tabIndex={0} aria-label={`${words(b.name)}, ${b.atom ? "atom" : `generation ${b.depth}`}, ${state}`}
      data-model={b.name} className={`${s.box} ${delay != null ? s.hop : ""}`} key={delay != null ? waveKey : undefined}
      style={{ opacity: dim ? 0.26 : 1, ["--d" as string]: `${delay ?? 0}ms` }}
      onClick={() => onPick(b.name)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(b.name); } }}
      onMouseEnter={() => onHover(b.name, true)} onMouseLeave={() => onHover(b.name, false)}
      onFocus={() => onHover(b.name, true)} onBlur={() => onHover(b.name, false)}>
      {sel && <rect x={x - 4} y={y - 4} width={w + 8} height={h + 8} rx={r + 3} fill="none" stroke={ACCENT} strokeOpacity={0.3} strokeWidth={3} />}
      <rect x={x} y={y} width={w} height={h} rx={r} fill="#fff" />
      {b.atom ? (
        <>
          <path d={`M${x + DFD_ATOM_CELL} ${y} H${x + r} Q${x} ${y} ${x} ${y + r} V${y + h - r} Q${x} ${y + h} ${x + r} ${y + h} H${x + DFD_ATOM_CELL} Z`} fill={f.strip} />
          <path d={`M${x + DFD_ATOM_CELL} ${y} V${y + h}`} stroke={INK} strokeWidth={1} />
          <text x={x + DFD_ATOM_CELL / 2} y={y + h / 2 + 4.2} textAnchor="middle" className={s.addr} fontSize={12} fill={INK}>{b.address}</text>
          <EvidenceMark state={state} x={x + w - 9} y={y + 9} />
          <Critter family={b.family} state={state} x={x + DFD_ATOM_CELL + 6} y={y + (h - 22) / 2} size={22} />
        </>
      ) : (
        <>
          <path d={`M${x} ${y + strip} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + strip} Z`} fill={f.strip} />
          <path d={`M${x} ${y + strip} H${x + w}`} stroke={INK} strokeWidth={1} />
          <text x={x + 7} y={y + 9.3} className={s.addr} fontSize={9.5} fill={INK}>{b.address}</text>
          <EvidenceMark state={state} x={x + w - 9} y={y + 6} />
          <Critter family={b.family} state={state} x={x + 7} y={y + strip + (h - strip - 22) / 2} size={22} />
        </>
      )}
      <rect x={x} y={y} width={w} height={h} rx={r} fill="none" stroke={stroke} strokeWidth={sel ? 2.2 : order > 0 ? 2 : 1.25} />
      <text className={s.name} fontSize={NAME_PX} fill={INK}>
        {b.lines.map((l, i) => <tspan key={i} x={nameX} y={base[i]}>{l}</tspan>)}
      </text>
      {order > 0 && (
        <g transform={`translate(${x + w} ${y})`}>
          <circle r={8} fill={ACCENT} stroke="#fff" strokeWidth={1.5} />
          <text y={3.6} textAnchor="middle" className={s.addr} fontSize={10} fill="#fff">{order}</text>
        </g>
      )}
    </g>
  );
});

export const Sheet = memo(function Sheet({ layout, st, onPick, onHover }: {
  layout: DfdLayout; st: SheetState; onPick: (n: string) => void; onHover: (n: string | null, on: boolean) => void;
}) {
  const { lit, litEdges, selected, pipeline, wave } = st;
  const inPipe = pipeline ? new Map(pipeline.map((n, i) => [n, i + 1])) : null;
  const routed = layout.edges.filter((e) => !e.offSheet && e.points.length > 1);
  const isLit = (e: DfdEdge) => !!litEdges?.has(edgeKey(e));
  const pipeEdge = (e: DfdEdge) => !!inPipe && inPipe.has(e.from) && inPipe.get(e.to) === (inPipe.get(e.from) ?? -9) + 1;
  const dimEdge = (e: DfdEdge) => (litEdges ? !isLit(e) : inPipe ? !pipeEdge(e) : false);
  const dimBox = (n: string) => (lit ? !lit.has(n) : inPipe ? !inPipe.has(n) : false);
  const labelDim = (edges: string[]) => (litEdges || inPipe) && !edges.some((k) => { const e = routed.find((q) => edgeKey(q) === k); return e && !dimEdge(e); });
  const loud = routed.filter((e) => isLit(e) || pipeEdge(e));
  return (
    <g>
      {/* swim lanes: a thin rule and the family's name + count */}
      {layout.lanes.map((l) => (
        <g key={l.family}>
          <path d={`M${l.x} ${l.y + 0.5} H${l.x + l.w}`} stroke={RULE} strokeWidth={1} />
          <text x={l.label.x} y={l.label.y + 12} className={s.lane} fontSize={13} fill={INK}>
            {fam(l.family).label}<tspan className={s.count} fill={INK_SOFT} dx={5}>{l.count}</tspan>
          </text>
        </g>
      ))}
      {layout.headers.map((h) => (
        <text key={`${h.stack}:${h.depth}`} x={h.x} y={h.y + 10} className={s.head} fontSize={12} fill={HEAD}>{h.text}</text>
      ))}
      {/* edges at rest: one ink, one weight, one elbow radius */}
      <g fill="none" stroke={INK} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        {routed.map((e) => (
          <g key={edgeKey(e)} opacity={dimEdge(e) ? 0.16 : 1} data-edge={edgeKey(e)}>
            <path d={elbowD(trimEnd(e.points), layout.radius)} />
            <path d={arrowD(e.points)} fill={INK} stroke="none" />
          </g>
        ))}
      </g>
      {/* the lit lineage (or a shown pipeline) in the accent, on top */}
      <g fill="none" stroke={ACCENT} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        {loud.map((e) => (
          <g key={edgeKey(e)}>
            <path d={elbowD(trimEnd(e.points), layout.radius)} />
            <path d={arrowD(e.points, 8, 4)} fill={ACCENT} stroke="none" />
          </g>
        ))}
      </g>
      {/* inline labels: a gap cut in the line, naming the parent in another family */}
      {layout.labels.map((l) => (
        <g key={`${l.x}:${l.y}`} opacity={labelDim(l.edges) ? 0.2 : 1}>
          <rect x={l.x} y={l.y} width={l.w} height={l.h} fill={SHEET} />
          {l.turn ? (
            // turned: reads up the vertical line it is cut into
            <text transform={`translate(${l.x + l.w / 2} ${l.y + l.h / 2}) rotate(-90)`} y={3.8} textAnchor="middle" className={s.label} fontSize={11} fill={INK_SOFT}>{l.text}</text>
          ) : (
            <text x={l.x + l.w / 2} y={l.y + l.h / 2 + 3.8} textAnchor="middle" className={s.label} fontSize={11} fill={INK_SOFT}>{l.text}</text>
          )}
        </g>
      ))}
      {layout.boxes.map((b) => (
        <Box key={b.name} b={b} state={st.states.get(b.name) ?? "untrained"} dim={dimBox(b.name)} sel={b.name === selected}
          order={inPipe?.get(b.name) ?? 0} delay={wave ? wave.delay[b.name] ?? null : null} waveKey={wave?.key ?? 0}
          onPick={onPick} onHover={onHover} />
      ))}
      {/* off-sheet connector pairs: a pentagon tag in the row gap above each end */}
      {layout.offSheet.map((o) => {
        const by = new Map(layout.boxes.map((b) => [b.name, b]));
        const src = by.get(o.from)!, dst = by.get(o.to)!;
        const tag = (b: DfdBox, text: string, k: string) => (
          <g key={k} transform={`translate(${b.x + b.w} ${b.y - 4})`} opacity={dimBox(b.name) ? 0.26 : 1}>
            <path d="M-12 -10 H-2 L2 -5.5 L-2 -1 H-12 Z" fill="#fff" stroke={INK} strokeWidth={1} />
            <text x={-16} y={-2} textAnchor="end" className={s.label} fontSize={11} fill={INK_SOFT}>{text}</text>
          </g>
        );
        return <g key={edgeKey(o)}>{tag(src, o.outText, "o")}{tag(dst, o.inText, "i")}</g>;
      })}
    </g>
  );
});
