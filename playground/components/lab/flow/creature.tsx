"use client";

// One creature per model, drawn in a local ±24 box centred on the node.
// Every part is data (see encoding.ts):
//   body shape ← family · segment count (caterpillar) ← number of children ·
//   dice pips ← generation · top hat + 1.2× size ← atom ·
//   eyes / mouth / medal / sweat / zzz ← evidence state · blush ← has local runs.
import { memo } from "react";
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { fam, GOLD, INK, SWEAT } from "./palette";
import s from "./flow.module.css";

export interface CreatureProps {
  family: string;
  atom: boolean;
  depth: number;
  children: number;
  state: EvidenceState;
  runs: number;
  /** stable per-model phase for the rare blink (hash of the name). */
  phase: number;
  still: boolean;
}

const W = 2; // outline width in local units (scales with the creature)

function Face({ x, y, k, state, runs, phase, still }: {
  x: number; y: number; k: number; state: EvidenceState; runs: number; phase: number; still: boolean;
}) {
  const open = state !== "untrained";
  const blink = open && !still ? s.blink : undefined;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      {runs > 0 && (
        <g fill="#FF7FA8" opacity={0.55}>
          <ellipse cx={-10} cy={4} rx={3.2} ry={2} />
          <ellipse cx={10} cy={4} rx={3.2} ry={2} />
        </g>
      )}
      {open ? (
        <g className={blink} style={blink ? { animationDelay: `${-phase * 14}s` } : undefined}>
          {state === "champion" ? (
            <>
              <circle cx={-6} cy={-1} r={3.6} fill={INK} />
              <circle cx={6} cy={-1} r={3.6} fill={INK} />
              <path d="M-5 -3.6 l.7 1.6 1.6 .7 -1.6 .7 -.7 1.6 -.7 -1.6 -1.6 -.7 1.6 -.7z M7 -3.6 l.7 1.6 1.6 .7 -1.6 .7 -.7 1.6 -.7 -1.6 -1.6 -.7 1.6 -.7z" fill="#fff" />
            </>
          ) : (
            <>
              <circle cx={-6} cy={-1} r={2.5} fill={INK} />
              <circle cx={6} cy={-1} r={2.5} fill={INK} />
              <circle cx={-5.2} cy={-1.9} r={0.9} fill="#fff" />
              <circle cx={6.8} cy={-1.9} r={0.9} fill="#fff" />
            </>
          )}
        </g>
      ) : (
        <path d="M-9 -1 Q-6 2 -3 -1 M3 -1 Q6 2 9 -1" fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
      )}
      {state === "champion" && <path d="M-4 4 Q0 10 4 4 Z" fill={INK} stroke={INK} strokeWidth={1} strokeLinejoin="round" />}
      {state === "trained" && <path d="M-4 4.5 Q0 8.5 4 4.5" fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />}
      {state === "provisional" && (
        <>
          <path d="M-4.5 6 q1.5 -2 3 0 t3 0 t3 0" fill="none" stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
          <path d="M13 -12 q-3.2 4.2 -3.2 6.2 a3.2 3.2 0 0 0 6.4 0 q0 -2 -3.2 -6.2z" fill={SWEAT} stroke={INK} strokeWidth={1.2} />
        </>
      )}
      {state === "untrained" && (
        <>
          <circle cx={0} cy={5.5} r={1.6} fill="none" stroke={INK} strokeWidth={1.3} />
          <path d="M10 -14 h6 l-6 6 h6 M17.5 -22 h4 l-4 4 h4" fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </g>
  );
}

function Medal({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-3 -6 L-4.5 1 M3 -6 L4.5 1" stroke="#E5566F" strokeWidth={2.6} strokeLinecap="round" />
      <circle cx={0} cy={3} r={4.6} fill={GOLD} stroke={INK} strokeWidth={1.4} />
      <path d="M0 0.8 l.8 1.5 1.6 .2 -1.2 1.1 .3 1.6 -1.5 -.8 -1.5 .8 .3 -1.6 -1.2 -1.1 1.6 -.2z" fill="#fff" />
    </g>
  );
}

function Hat({ x, y, band }: { x: number; y: number; band: string }) {
  // Top hat of an elder (atom): brim + crown, band in the family's deep tone.
  return (
    <g transform={`translate(${x} ${y}) rotate(-8)`}>
      <rect x={-10} y={-2} width={20} height={4} rx={2} fill={INK} />
      <rect x={-6.5} y={-13} width={13} height={12} rx={2} fill={INK} />
      <rect x={-6.5} y={-5} width={13} height={3} fill={band} />
    </g>
  );
}

function Body({ family, children, depth, fill, deep }: { family: string; children: number; depth: number; fill: string; deep: string }) {
  const line = { stroke: INK, strokeWidth: W, strokeLinejoin: "round" as const };
  switch (family) {
    case "perception":
      // round eyeball; the lens cap faces downstream (toward its children)
      return (
        <>
          <path d="M14 -9 Q24 0 14 9" fill="#fff" {...line} />
          <circle r={18} fill={fill} {...line} />
          <path d="M-12 -8 A13 13 0 0 1 -3 -14" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.8} />
        </>
      );
    case "sequence": {
      // token caterpillar: one trailing segment per child (capped at 5)
      const n = Math.min(children, 5);
      const segs = Array.from({ length: n }, (_, i) => n - 1 - i);
      return (
        <>
          {segs.map((i) => (
            <g key={i}>
              <circle cx={-17 - i * 10} cy={9} r={1.8} fill={INK} />
              <circle cx={-17 - i * 10} cy={4} r={7.5} fill={fill} {...line} />
            </g>
          ))}
          <path d="M-5 -15 Q-8 -22 -11 -23 M5 -15 Q8 -22 11 -23" fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
          <circle cx={-11} cy={-23} r={2} fill={deep} stroke={INK} strokeWidth={1.2} />
          <circle cx={11} cy={-23} r={2} fill={deep} stroke={INK} strokeWidth={1.2} />
          <circle r={16} fill={fill} {...line} />
          <path d="M-10 -7 A11 11 0 0 1 -3 -12" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" opacity={0.8} />
        </>
      );
    }
    case "generative":
      // egg-cloud: an egg whose lower rim is a cloud of samples
      return (
        <>
          <path d="M-16 5 C-16 -13 -8 -21 0 -21 C8 -21 16 -13 16 5 Q17 14 9 13 Q5 19 0 15 Q-5 19 -9 13 Q-17 14 -16 5 Z" fill={fill} {...line} />
          <path d="M-9 -9 A11 11 0 0 1 -3 -15" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" opacity={0.8} />
        </>
      );
    case "representation":
      // mirror twins: two views of one thing across a mirror line
      return (
        <>
          <path d="M0 -17 V17" stroke={deep} strokeWidth={1.4} strokeDasharray="2 2.5" />
          <circle cx={-11} cy={2} r={11.5} fill={fill} {...line} />
          <circle cx={11} cy={2} r={11.5} fill={fill} {...line} />
        </>
      );
    case "structure":
      // crystal: facets of a graph
      return (
        <>
          <path d="M-10 -17 H10 L18 -5 L0 19 L-18 -5 Z" fill={fill} {...line} />
          <path d="M-18 -5 H18 M-10 -17 L-5 -5 L0 19 L5 -5 L10 -17" fill="none" stroke={deep} strokeWidth={1.1} opacity={0.7} />
        </>
      );
    case "decision": {
      // dice bot: pips on the top face = generation (1 pip for an atom)
      const pips = [[0, 0], [-5, 1.2], [5, -1.2], [0, -2.4]].slice(0, Math.min(depth + 1, 4));
      return (
        <>
          <path d="M1 -19 V-26" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
          <circle cx={1} cy={-27} r={2.2} fill={deep} stroke={INK} strokeWidth={1.2} />
          <path d="M-15 -12 L-8 -19 H20 L13 -12 Z" fill="#FFD3E7" {...line} />
          <path d="M13 -12 L20 -19 V11 L13 18 Z" fill={deep} {...line} />
          <rect x={-15} y={-12} width={28} height={30} rx={4} fill={fill} {...line} />
          <g transform="translate(3 -15.5)">
            {pips.map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx={1.6} ry={1} fill={INK} />)}
          </g>
        </>
      );
    }
    default:
      return <circle r={16} fill={fill} {...line} />;
  }
}

/** Where the face and hat sit for each body (local units). */
const ANCHORS: Record<string, { face: [number, number, number]; hat: [number, number]; medal: [number, number] }> = {
  perception: { face: [0, 1, 1], hat: [-2, -17], medal: [12, 14] },
  sequence: { face: [0, 1, 0.95], hat: [0, -15], medal: [11, 13] },
  generative: { face: [0, 0, 1], hat: [0, -20], medal: [12, 12] },
  representation: { face: [0, 2, 0.62], hat: [-11, -9], medal: [0, 15] },
  structure: { face: [0, -2, 0.9], hat: [0, -16], medal: [12, 8] },
  decision: { face: [-1, 3, 0.95], hat: [-4, -20], medal: [10, 17] },
};

export const Creature = memo(function Creature(p: CreatureProps) {
  const f = fam(p.family);
  const a = ANCHORS[p.family] ?? ANCHORS.perception;
  const twins = p.family === "representation";
  return (
    <g>
      <ellipse cx={0} cy={21} rx={p.family === "sequence" ? 16 + Math.min(p.children, 5) * 5 : 17} ry={3.2}
        transform={p.family === "sequence" ? `translate(${-Math.min(p.children, 5) * 5} 0)` : undefined}
        fill={INK} opacity={0.12} />
      <Body family={p.family} children={p.children} depth={p.depth} fill={f.fill} deep={f.deep} />
      {twins ? (
        <>
          <Face x={-11} y={a.face[1]} k={a.face[2]} state={p.state} runs={0} phase={p.phase} still={p.still} />
          <g transform={`translate(${11} ${a.face[1]}) scale(-${a.face[2]} ${a.face[2]})`}>
            <Face x={0} y={0} k={1} state={p.state} runs={0} phase={p.phase} still={p.still} />
          </g>
          {p.runs > 0 && (
            <g fill="#FF7FA8" opacity={0.55}>
              <ellipse cx={-17} cy={6} rx={2.4} ry={1.5} />
              <ellipse cx={17} cy={6} rx={2.4} ry={1.5} />
            </g>
          )}
        </>
      ) : (
        <Face x={a.face[0]} y={a.face[1]} k={a.face[2]} state={p.state} runs={p.runs} phase={p.phase} still={p.still} />
      )}
      {p.atom && <Hat x={a.hat[0]} y={a.hat[1]} band={f.deep} />}
      {p.state === "champion" && <Medal x={a.medal[0]} y={a.medal[1]} />}
    </g>
  );
});
