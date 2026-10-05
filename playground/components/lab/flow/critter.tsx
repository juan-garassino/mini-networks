"use client";

// The process glyph inside every box: a small kawaii creature in a 24×24 cell.
// Two marks only (encoding.ts): silhouette = family, face = evidence state.
// No hats, pennants, badges or stickers — the box carries the rest.
import { memo } from "react";
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { COLOR, fam, STROKE } from "./tokens";

const SW = STROKE.critter;

/** Body outline per family, drawn in a 24×24 cell; returns the face centre. */
function Body({ family, fill }: { family: string; fill: string }) {
  const p = { fill, stroke: COLOR.ink, strokeWidth: SW, strokeLinejoin: "round" as const };
  switch (family) {
    case "perception": // an eyeball with three lashes
      return (
        <>
          <path d="M7.6 6.4 L6.4 3.6 M12 5.4 V2.4 M16.4 6.4 L17.6 3.6" stroke={COLOR.ink} strokeWidth={SW} strokeLinecap="round" />
          <circle cx={12} cy={14} r={8.6} {...p} />
        </>
      );
    case "sequence": // a token caterpillar: two tail segments, a head with antennae
      return (
        <>
          <circle cx={4.6} cy={18} r={3.2} {...p} />
          <circle cx={8.4} cy={17} r={3.8} {...p} />
          <path d="M11.4 7.4 L9.8 3.8 M16.6 7.4 L18.2 3.8" stroke={COLOR.ink} strokeWidth={SW} strokeLinecap="round" />
          <circle cx={14} cy={14.2} r={7.6} {...p} />
        </>
      );
    case "generative": // an egg
      return <path d="M12 3.6 C17 3.6 20.2 10.4 20.2 15 C20.2 19.6 16.6 22.6 12 22.6 C7.4 22.6 3.8 19.6 3.8 15 C3.8 10.4 7 3.6 12 3.6 Z" {...p} />;
    case "representation": // mirror twins, back to back
      return (
        <>
          <circle cx={7.6} cy={14.4} r={6.4} {...p} />
          <circle cx={16.4} cy={14.4} r={6.4} {...p} />
          <path d="M12 9.6 V19.2" stroke={COLOR.ink} strokeWidth={0.9} strokeDasharray="1.4 1.4" />
        </>
      );
    case "structure": // a crystal
      return <path d="M12 2.8 L20.2 8.6 L20.2 18 L12 23 L3.8 18 L3.8 8.6 Z" {...p} />;
    case "decision": // a dice bot with an antenna
      return (
        <>
          <path d="M12 7.2 V3.6" stroke={COLOR.ink} strokeWidth={SW} strokeLinecap="round" />
          <circle cx={12} cy={3.2} r={1.5} fill={COLOR.ink} />
          <rect x={4} y={7.2} width={16} height={15} rx={3.4} {...p} />
        </>
      );
    default:
      return <rect x={4} y={6} width={16} height={16} rx={8} {...p} />;
  }
}

const FACE_Y: Record<string, number> = { perception: 14.6, sequence: 14.8, generative: 15.6, representation: 14.8, structure: 13.8, decision: 15.2 };
const FACE_X: Record<string, number> = { sequence: 14 };

/** The face IS the evidence: happy arcs + open smile = champion, dot eyes + smile = trained,
 * dot eyes + wobbly mouth + sweat drop = provisional bar, closed eyes = not trained yet. */
function Face({ x, y, state }: { x: number; y: number; state: EvidenceState }) {
  const s = { fill: "none", stroke: COLOR.ink, strokeWidth: STROKE.face, strokeLinecap: "round" as const };
  return (
    <g transform={`translate(${x} ${y})`}>
      {state === "champion" && (
        <>
          <path d="M-4.4 -0.6 Q-3 -2.6 -1.6 -0.6 M1.6 -0.6 Q3 -2.6 4.4 -0.6" {...s} />
          <path d="M-2 1.8 Q0 4.6 2 1.8 Z" fill={COLOR.ink} stroke={COLOR.ink} strokeWidth={0.8} strokeLinejoin="round" />
        </>
      )}
      {(state === "trained" || state === "provisional") && (
        <>
          <circle cx={-3} cy={-1} r={1.15} fill={COLOR.ink} />
          <circle cx={3} cy={-1} r={1.15} fill={COLOR.ink} />
        </>
      )}
      {state === "trained" && <path d="M-1.8 1.9 Q0 3.4 1.8 1.9" {...s} />}
      {state === "provisional" && (
        <>
          <path d="M-2.2 2.4 q0.7 -0.9 1.4 0 t1.4 0 t1.4 0" {...s} strokeWidth={1} />
          <path d="M6.4 -6.2 q-1.6 2.1 -1.6 3.1 a1.6 1.6 0 0 0 3.2 0 q0 -1 -1.6 -3.1z" fill={COLOR.sweat} stroke={COLOR.ink} strokeWidth={0.8} />
        </>
      )}
      {state === "untrained" && <path d="M-4.2 -0.8 H-1.8 M1.8 -0.8 H4.2 M-1 2.2 H1" {...s} />}
    </g>
  );
}

export const Critter = memo(function Critter({ family, state, x = 0, y = 0, size = 24 }: {
  family: string; state: EvidenceState; x?: number; y?: number; size?: number;
}) {
  const f = fam(family);
  // an untrained model's body is paler: asleep, not yet part of the working zoo
  const fill = state === "untrained" ? f.strip : f.body;
  return (
    <g transform={`translate(${x} ${y}) scale(${size / 24})`} aria-hidden>
      <Body family={family} fill={fill} />
      <Face x={FACE_X[family] ?? 12} y={FACE_Y[family] ?? 14.5} state={state} />
    </g>
  );
});

/** The evidence mark in a box's header strip (centred on x, y; ~8 px). */
export function EvidenceMark({ state, x = 0, y = 0 }: { state: EvidenceState; x?: number; y?: number }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden>
      {state === "champion" && <path d="M0 -4.4 L1.3 -1.4 L4.4 -1.2 L2 0.9 L2.7 4 L0 2.4 L-2.7 4 L-2 0.9 L-4.4 -1.2 L-1.3 -1.4 Z" fill={COLOR.gold} stroke={COLOR.ink} strokeWidth={0.8} strokeLinejoin="round" />}
      {state === "trained" && <circle r={3.1} fill={COLOR.ink} />}
      {state === "provisional" && (<><circle r={3.1} fill={COLOR.card} stroke={COLOR.ink} strokeWidth={1} /><path d="M0 -3.1 A3.1 3.1 0 0 1 0 3.1 Z" fill={COLOR.ink} /></>)}
      {state === "untrained" && <circle r={3.1} fill="none" stroke={COLOR.ink} strokeWidth={1} strokeDasharray="1.6 1.3" />}
    </g>
  );
}
