"use client";

// One creature per model, drawn in a local ±24 box centred on the node.
// Every part is data (see encoding.ts):
//   silhouette (incl. lashes, antennae, facets, tail) ← family ·
//   top hat ← atom · pennant ← capital (hub) · badge glyph ← species ·
//   eyes / mouth / medal / sweat / zzz ← evidence state.
import { memo } from "react";
import type { LucideIcon } from "lucide-react";
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { ACCENT, fam, FAMILY, GOLD, hexMix, INK, SWEAT } from "./palette";

export interface CreatureProps {
  family: string;
  atom: boolean;
  state: EvidenceState;
  /** hub atom (≥5 models build on it): a pennant on the elder's hat */
  capital?: boolean;
  /** the model's species glyph (lib/icons), worn as a badge */
  emblem?: LucideIcon | null;
  /** grokking egg: the idea has "clicked" */
  eureka?: boolean;
  /** body mark for the mechanism category it introduces */
  trait?: Trait;
}

const W = 2; // outline width in local units (scales with the creature)

function Face({ x, y, k, state }: { x: number; y: number; k: number; state: EvidenceState }) {
  const open = state !== "untrained";
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      {open ? (
        state === "champion" ? (
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
        )
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
      <path d="M-10 0 H10 M-6.5 -12 H6.5 V-1 H-6.5 Z" fill="#fff" stroke="#fff" strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
      <rect x={-10} y={-2} width={20} height={4} rx={2} fill={INK} />
      <rect x={-6.5} y={-13} width={13} height={12} rx={2} fill={INK} />
      <rect x={-4.5} y={-11.5} width={2.2} height={6} rx={1} fill="#fff" opacity={0.35} />
      <rect x={-6.5} y={-5} width={13} height={3} fill={band} />
    </g>
  );
}

type Mode = "shadow" | "rim" | "paint";

// One key light, top-left, for every creature: a cast shadow down-right, a
// white die-cut sticker rim, a volume gradient (lit top-left → shade bottom-
// right, CreatureDefs) and a glossy sticker highlight. Light is a rendering
// system, not data (encoding.ts "light").
function Body({ family, fill, deep, mode }: { family: string; fill: string; deep: string; mode: Mode }) {
  const main = mode === "paint"
    ? { fill: `url(#fg-${family})`, stroke: INK, strokeWidth: W, strokeLinejoin: "round" as const }
    : mode === "rim" ? { fill: "#fff", stroke: "#fff", strokeWidth: W + 6, strokeLinejoin: "round" as const }
      : { fill: INK, stroke: INK, strokeWidth: W + 1, strokeLinejoin: "round" as const };
  const face = (c: string) => (mode === "paint" ? { ...main, fill: c } : main);
  const line = (w: number) => (mode === "paint" ? { stroke: INK, strokeWidth: w } : mode === "rim" ? { stroke: "#fff", strokeWidth: w + 6 } : { stroke: INK, strokeWidth: w + 1 });
  const knob = (c: string) => (mode === "paint" ? { fill: c, stroke: INK, strokeWidth: 1.2 } : main);
  switch (family) {
    case "perception":
      // eyeball: a round ball with three lashes on its lid
      return (
        <>
          <path d="M-9 -15 L-12 -21 M0 -18 V-24.5 M9 -15 L12 -21" fill="none" {...line(2)} strokeLinecap="round" />
          <circle r={18} {...main} />
        </>
      );
    case "sequence":
      // token caterpillar: two tail segments curled up behind the head, antennae on top
      return (
        <>
          <circle cx={-19} cy={1} r={6.5} {...main} />
          <circle cx={-12} cy={10} r={8} {...main} />
          <path d="M-5 -15 Q-8 -22 -11 -23 M5 -15 Q8 -22 11 -23" fill="none" {...line(1.6)} strokeLinecap="round" />
          <circle cx={-11} cy={-23} r={2} {...knob(deep)} />
          <circle cx={11} cy={-23} r={2} {...knob(deep)} />
          <circle r={16} {...main} />
        </>
      );
    case "generative":
      // egg-cloud: an egg whose lower rim is a cloud of samples
      return <path d="M-16 5 C-16 -13 -8 -21 0 -21 C8 -21 16 -13 16 5 Q17 14 9 13 Q5 19 0 15 Q-5 19 -9 13 Q-17 14 -16 5 Z" {...main} />;
    case "representation":
      // mirror twins: two views of one thing across a mirror line
      return (
        <>
          {mode === "paint" && <path d="M0 -17 V17" stroke={deep} strokeWidth={1.4} strokeDasharray="2 2.5" />}
          <circle cx={-11} cy={2} r={11.5} {...main} />
          <circle cx={11} cy={2} r={11.5} {...main} />
        </>
      );
    case "structure":
      // crystal: a cut gem (its facet lines are part of the silhouette)
      return (
        <>
          <path d="M-10 -17 H10 L18 -5 L0 19 L-18 -5 Z" {...main} />
          {mode === "paint" && <path d="M-18 -5 H18 M-10 -17 L-5 -5 L0 19 L5 -5 L10 -17" fill="none" stroke={deep} strokeWidth={1.1} opacity={0.7} />}
        </>
      );
    case "decision":
      // dice bot: a cube with an antenna (top face lit, side face in shade)
      return (
        <>
          <path d="M1 -19 V-26" fill="none" {...line(1.6)} strokeLinecap="round" />
          <circle cx={1} cy={-27} r={2.2} {...knob(deep)} />
          <path d="M-15 -12 L-8 -19 H20 L13 -12 Z" {...face("#FFD9EA")} />
          <path d="M13 -12 L20 -19 V11 L13 18 Z" {...face(deep)} />
          <rect x={-15} y={-12} width={28} height={30} rx={4} {...main} />
        </>
      );
    default:
      return <circle r={16} {...main} />;
  }
}

const GLOSS: Record<string, [number, number, number, number][]> = {
  perception: [[-8, -9, 5.5, 3], [-2.5, -13, 1.4, 1.4]],
  sequence: [[-7, -8, 4.8, 2.6], [-2, -11.5, 1.3, 1.3], [-22, -2, 2, 1.2]],
  generative: [[-7, -11, 4.5, 2.6], [-2, -15, 1.3, 1.3]],
  representation: [[-16, -4, 3.2, 1.8], [6, -4, 3.2, 1.8]],
  structure: [[-8, -11, 4, 1.6]],
  decision: [[-9, -7, 4, 2.2]],
};

/** Paint servers for the light system — render once per document (ids are global). */
export function CreatureDefs() {
  return (
    <defs>
      {Object.entries(FAMILY).map(([k, f]) => (
        <radialGradient key={k} id={`fg-${k}`} cx="0.34" cy="0.3" r="0.85">
          <stop offset="0" stopColor={hexMix(f.fill, "#ffffff", 0.6)} />
          <stop offset="0.45" stopColor={f.fill} />
          <stop offset="1" stopColor={hexMix(f.fill, f.deep, 0.62)} />
        </radialGradient>
      ))}
      <radialGradient id="fg-" cx="0.34" cy="0.3" r="0.85">
        <stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#CFC6EA" />
      </radialGradient>
      <radialGradient id="f-contact" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor={INK} stopOpacity="0.32" />
        <stop offset="1" stopColor={INK} stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

/** The evidence glyph worn on every name tag (screen px, centred on 0,0, ≥12px). */
export function EvidenceGlyph({ state, size = 13 }: { state: EvidenceState; size?: number }) {
  const k = size / 13;
  return (
    <g transform={`scale(${k})`}>
      {state === "champion" && (
        <>
          <circle r={6.2} fill={GOLD} stroke={INK} strokeWidth={1.4} />
          <path d="M0 -3.6 l1.05 2.1 2.3 .33 -1.67 1.62 .4 2.3 -2.08 -1.1 -2.08 1.1 .4 -2.3 -1.67 -1.62 2.3 -.33z" fill="#fff" />
        </>
      )}
      {state === "trained" && (
        <>
          <circle r={6.2} fill="#fff" stroke={INK} strokeWidth={1.4} />
          <circle cx={-2.2} cy={-1.4} r={1} fill={INK} />
          <circle cx={2.2} cy={-1.4} r={1} fill={INK} />
          <path d="M-2.6 1.4 Q0 3.8 2.6 1.4" fill="none" stroke={INK} strokeWidth={1.3} strokeLinecap="round" />
        </>
      )}
      {state === "provisional" && (
        <path d="M0 -6.8 Q-5 -0.6 -5 1.9 A5 5 0 0 0 5 1.9 Q5 -0.6 0 -6.8Z" fill={SWEAT} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
      )}
      {state === "untrained" && (
        <>
          <circle r={6.2} fill="#E4DEF7" stroke={INK} strokeWidth={1.4} />
          <path d="M-2.4 -2.4 H2.4 L-2.4 2.4 H2.4" fill="none" stroke={INK} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </g>
  );
}

/** Where the face and hat sit for each body (local units). */
type Anchor = { face: [number, number, number]; hat: [number, number]; medal: [number, number]; belly: [number, number, number]; trait: [number, number] };
const ANCHORS: Record<string, Anchor> = {
  perception: { face: [0, -5, 0.85], hat: [-2, -17], medal: [13, 12], belly: [0, 8.5, 7.5], trait: [-13, -7] },
  sequence: { face: [1, -5, 0.8], hat: [0, -15], medal: [12, 11], belly: [1, 7.5, 6.8], trait: [-12, -6] },
  generative: { face: [0, -7, 0.85], hat: [0, -20], medal: [12, 10], belly: [0, 6, 7], trait: [-12, -8] },
  representation: { face: [0, -2, 0.55], hat: [-11, -9], medal: [17, 11], belly: [0, 13, 6.5], trait: [-19, -5] },
  structure: { face: [0, -8, 0.75], hat: [0, -16], medal: [12, 4], belly: [0, 5, 6.5], trait: [-11, -9] },
  decision: { face: [-1, -3, 0.8], hat: [-4, -20], medal: [11, 16], belly: [-1, 9.5, 6.5], trait: [-10, -7] },
};

export type Trait = "eye" | "stripes" | "curl" | "spots" | "puff" | "bolt" | "bypass" | "pack" | "wave" | null;
/** One body mark per mechanism CATEGORY the model introduces (first match wins). */
export function traitFor(mechs: string[]): Trait {
  const m = mechs.join(" ");
  if (/spectrogram|mel-|waveform/.test(m)) return "wave";
  if (/attention|patch|bidirectional|promptable/.test(m)) return "eye";
  if (/residual|hyper-conn|low-rank|pathway/.test(m)) return "bypass";
  if (/recurren|scan|delayed/.test(m)) return "curl";
  if (/expert|routing|retrieval|message-passing|multi-token/.test(m)) return "pack";
  if (/policy|value|reward|preference|advantage|tree-search|adversarial/.test(m)) return "bolt";
  if (/denois|masked-text/.test(m)) return "puff";
  if (/latent|contrast|metric|reconstruction|distillation|field|embedding/.test(m)) return "spots";
  if (/conv|mlp|encoder|bbox/.test(m)) return "stripes";
  return null;
}

function TraitMark({ t, x, y, deep }: { t: Trait; x: number; y: number; deep: string }) {
  if (!t) return null;
  const ink = { fill: "none", stroke: INK, strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  // drawn at 1.7× on an accent sticker disc so siblings differ at overview scale
  return (
    <g transform={`translate(${x - 5} ${y - 5}) scale(1.3)`}>
      <circle r={5.8} fill="#fff" stroke={ACCENT} strokeWidth={1.4} />
      {t === "eye" && (<><circle r={3.4} fill="#fff" stroke={INK} strokeWidth={1.4} /><circle cx={0.6} cy={0.4} r={1.5} fill={INK} /></>)}
      {t === "stripes" && <path d="M-2 -4 q3 1 2.5 4 M1.5 -5 q3 1 2.5 4 M-4.5 -1 q3 1 2.5 4" {...ink} stroke={deep} strokeWidth={2} />}
      {t === "curl" && <path d="M0 0 a1.6 1.6 0 1 1 1.6 1.8 a3.2 3.2 0 1 1 -3.4 -3.8" {...ink} />}
      {t === "spots" && (<><circle cx={-2} cy={-2} r={1.5} fill={deep} /><circle cx={2.2} cy={-0.5} r={1.2} fill={deep} /><circle cx={-0.6} cy={2.4} r={1.1} fill={deep} /></>)}
      {t === "puff" && (<><circle cx={-2} cy={0} r={2.6} fill="#fff" stroke={INK} strokeWidth={1.2} /><circle cx={1.8} cy={-1.4} r={2.2} fill="#fff" stroke={INK} strokeWidth={1.2} /></>)}
      {t === "bolt" && <path d="M1 -5 L-2.5 0.5 H0.5 L-1 5 L3 -1 H0 Z" fill={GOLD} stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />}
      {t === "bypass" && <path d="M-4 3 Q-4 -4 1 -4 L3.5 -4 M1.5 -6 L3.8 -4 L1.5 -2" {...ink} />}
      {t === "pack" && <rect x={-3.5} y={-4} width={7} height={8} rx={2} fill={deep} stroke={INK} strokeWidth={1.3} />}
      {t === "wave" && <path d="M-4.5 0 q1.1 -3 2.2 0 t2.2 0 t2.2 0 t2.2 0" {...ink} />}
    </g>
  );
}

function Belly({ x, y, r, fill, Icon }: { x: number; y: number; r: number; fill: string; Icon: LucideIcon }) {
  const i = r * 1.45;
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill={hexMix(fill, "#ffffff", 0.72)} stroke={INK} strokeWidth={1.3} />
      <Icon x={-i / 2} y={-i / 2} width={i} height={i} strokeWidth={2.6} color={INK} />
    </g>
  );
}

function Pennant({ x, y, fill }: { x: number; y: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(-8)`}>
      <path d="M0 0 V-12" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
      <path d="M0 -12 L10 -9 L0 -6 Z" fill={fill} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
    </g>
  );
}

function Bulb({ y }: { y: number }) {
  return (
    <g transform={`translate(14 ${y})`}>
      <path d="M-4 -12 L-6.5 -15 M4 -12 L6.5 -15 M0 -13.5 V-17" stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
      <circle cx={0} cy={-5} r={6} fill="#FFE27A" stroke={INK} strokeWidth={1.5} />
      <rect x={-2.6} y={0.5} width={5.2} height={3.4} rx={1} fill="#fff" stroke={INK} strokeWidth={1.2} />
    </g>
  );
}

export const Creature = memo(function Creature(p: CreatureProps) {
  const f = fam(p.family);
  const a = ANCHORS[p.family] ?? ANCHORS.perception;
  const twins = p.family === "representation";
  return (
    <g>
      <ellipse cx={3} cy={21} rx={20} ry={5} fill="url(#f-contact)" />
      <g transform="translate(2.4 3.2)" opacity={0.16}>
        <Body family={p.family} fill={f.fill} deep={f.deep} mode="shadow" />
      </g>
      <Body family={p.family} fill={f.fill} deep={f.deep} mode="rim" />
      <Body family={p.family} fill={f.fill} deep={f.deep} mode="paint" />
      {(GLOSS[p.family] ?? []).map(([x, y, rx, ry], i) => (
        <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} transform={`rotate(-28 ${x} ${y})`} fill="#fff" opacity={i ? 0.95 : 0.8} />
      ))}
      {p.emblem && <Belly x={a.belly[0]} y={a.belly[1]} r={a.belly[2]} fill={f.fill} Icon={p.emblem} />}
      <TraitMark t={p.trait ?? null} x={a.trait[0]} y={a.trait[1]} deep={f.deep} />
      {twins ? (
        <>
          <Face x={-11} y={a.face[1]} k={a.face[2]} state={p.state} />
          <g transform={`translate(${11} ${a.face[1]}) scale(-${a.face[2]} ${a.face[2]})`}>
            <Face x={0} y={0} k={1} state={p.state} />
          </g>
        </>
      ) : (
        <Face x={a.face[0]} y={a.face[1]} k={a.face[2]} state={p.state} />
      )}
      {p.atom && <Hat x={a.hat[0]} y={a.hat[1]} band={f.deep} />}
      {p.atom && p.capital && <Pennant x={a.hat[0] + 3} y={a.hat[1] - 12} fill={f.deep} />}
      {p.state === "champion" && <Medal x={a.medal[0]} y={a.medal[1]} />}
      {p.eureka && <Bulb y={a.hat[1] - 4} />}
    </g>
  );
});
