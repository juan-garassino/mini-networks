"use client";

// One signature landmark per territory, ~64px tall, base anchored at (0,0) of
// the translate. Detailed but readable at map scale; consistent top-left light,
// a shared cast shadow, and the atlas gradients. Rendered via <Landmark/>.
import type { ReactNode } from "react";

const INK = "#3a2d20";
const CREAM = "#efe6cf";

function Base({ children }: { children: ReactNode }) {
  return (
    <g filter="url(#a-shadow-sm)">
      <ellipse cx={0} cy={2} rx={30} ry={5.5} fill={INK} opacity={0.18} />
      {children}
    </g>
  );
}

// Perception → observatory (a dome that watches)
function Observatory() {
  return (
    <Base>
      <rect x={-24} y={-22} width={48} height={24} rx={3} fill={CREAM} stroke={INK} strokeWidth={1.8} />
      <rect x={-24} y={-4} width={48} height={6} fill={INK} opacity={0.08} />
      <path d="M-27 -22 A27 22 0 0 1 27 -22 Z" fill="#cdd8dc" stroke={INK} strokeWidth={1.8} />
      <path d="M-27 -22 A27 22 0 0 1 0 -44 L0 -22 Z" fill="#e2eaec" opacity={0.6} />
      <path d="M-4 -40 L2 -52" stroke={INK} strokeWidth={2} strokeLinecap="round" />
      <rect x={-6} y={-36} width={12} height={9} rx={2} fill="#7d94a0" stroke={INK} strokeWidth={1.3} />
      <line x1={0} y1={-52} x2={0} y2={-46} stroke={INK} strokeWidth={1.6} />
      <circle cx={0} cy={-55} r={2.6} fill="url(#a-gold)" stroke={INK} strokeWidth={0.9} />
    </Base>
  );
}

// Sequence → clock tower (it remembers)
function ClockTower() {
  return (
    <Base>
      <rect x={-16} y={-52} width={32} height={54} rx={3} fill={CREAM} stroke={INK} strokeWidth={1.8} />
      <path d="M-16 -52 h32 M-16 -38 h32 M-16 -10 h32" stroke={INK} strokeWidth={0.8} opacity={0.25} />
      <rect x={4} y={-52} width={12} height={54} fill={INK} opacity={0.07} />
      <path d="M-20 -52 L0 -72 L20 -52 Z" fill="#8a5a3a" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M0 -72 L4 -82" stroke={INK} strokeWidth={1.4} />
      <path d="M4 -82 L16 -78 L4 -74 Z" fill="#bf4a2a" stroke={INK} strokeWidth={1} strokeLinejoin="round" />
      <circle cx={0} cy={-30} r={10} fill="#fff" stroke={INK} strokeWidth={1.6} />
      <line x1={0} y1={-30} x2={0} y2={-37} stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
      <line x1={0} y1={-30} x2={6} y2={-27} stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
    </Base>
  );
}

// Generative → kiln with fire glow + smoke (it imagines)
function Kiln() {
  return (
    <Base>
      <path d="M-24 2 Q-24 -30 0 -30 Q24 -30 24 2 Z" fill="#d8b48a" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M-24 -8 Q-24 -30 0 -30 Q24 -30 24 -8" fill="#e6c9a2" opacity={0.5} />
      {[-18, -9, 0, 9, 18].map((yy) => <path key={yy} d={`M${-Math.sqrt(Math.max(0, 576 - (yy + 6) * (yy + 6) * 1.4))} ${yy - 6} h${2 * Math.sqrt(Math.max(0, 576 - (yy + 6) * (yy + 6) * 1.4))}`} stroke={INK} strokeWidth={0.7} opacity={0.18} />)}
      <ellipse cx={0} cy={-2} rx={12} ry={9} fill="url(#a-glow)" />
      <path d="M-9 2 Q-9 -12 0 -12 Q9 -12 9 2 Z" fill="#7a3a24" stroke={INK} strokeWidth={1.3} />
      <path d="M-5 2 Q-5 -7 0 -8 Q5 -7 5 2 Z" fill="#ff9d3c" />
      <rect x={9} y={-44} width={10} height={20} rx={2} fill="#c9a06a" stroke={INK} strokeWidth={1.3} />
      <circle cx={14} cy={-50} r={5} fill="#eee7d6" opacity={0.9} />
      <circle cx={20} cy={-58} r={6} fill="#eee7d6" opacity={0.75} />
      <circle cx={14} cy={-66} r={7} fill="#eee7d6" opacity={0.55} />
    </Base>
  );
}

// Representation → twin mirror pavilions (it compares)
function Mirrors() {
  return (
    <Base>
      {[-15, 15].map((dx) => (
        <g key={dx} transform={`translate(${dx} 0)`}>
          <path d="M-11 -14 L0 -30 L11 -14 Z" fill="#7d6484" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
          <rect x={-9} y={-14} width={18} height={16} rx={1.5} fill="url(#a-glass)" stroke={INK} strokeWidth={1.5} />
          <line x1={-6} y1={-11} x2={5} y2={0} stroke="#fff" strokeWidth={1.4} opacity={0.8} />
          <line x1={0} y1={-12} x2={7} y2={-4} stroke="#fff" strokeWidth={1} opacity={0.6} />
        </g>
      ))}
    </Base>
  );
}

// Structure → woven lattice arch (it connects)
function Lattice() {
  return (
    <Base>
      <path d="M-24 2 Q-24 -30 0 -30 Q24 -30 24 2" fill="none" stroke="#9c7a4f" strokeWidth={5} strokeLinecap="round" />
      {[-16, -8, 0, 8, 16].map((dx) => <line key={dx} x1={dx} y1={2} x2={dx * 0.5} y2={-24} stroke="#b0894f" strokeWidth={1.8} />)}
      {[-20, -10, 0, 10, 20].map((dx) => <line key={`b${dx}`} x1={dx} y1={-6} x2={-dx * 0.6} y2={-22} stroke="#c19a5f" strokeWidth={1.3} opacity={0.85} />)}
      <ellipse cx={0} cy={-30} rx={4} ry={3} fill="url(#a-gold)" stroke={INK} strokeWidth={0.9} />
    </Base>
  );
}

// Decision → carved signpost (it chooses)
function Signpost() {
  return (
    <Base>
      <line x1={0} y1={2} x2={0} y2={-38} stroke="#9c7a4f" strokeWidth={4} strokeLinecap="round" />
      <line x1={0} y1={-20} x2={0} y2={-30} stroke="#7d5f3a" strokeWidth={1} opacity={0.5} />
      <path d="M0 -34 L24 -34 L30 -28 L24 -22 L0 -22 Z" fill="#4e8a86" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M0 -22 L-22 -22 L-28 -16 L-22 -10 L0 -10 Z" fill="#c98a3d" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M4 -30 h16 M4 -18 h-12" stroke="#fff" strokeWidth={1.2} opacity={0.55} />
    </Base>
  );
}

const MAP: Record<string, () => ReactNode> = {
  observatory: Observatory, clock: ClockTower, kiln: Kiln,
  mirrors: Mirrors, lattice: Lattice, signpost: Signpost,
};

export function Landmark({ kind, x, y }: { kind: string; x: number; y: number }) {
  const C = MAP[kind] ?? Signpost;
  return <g transform={`translate(${x} ${y})`}>{C()}</g>;
}
