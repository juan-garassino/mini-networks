"use client";

// Shaded terrain primitives for the overworld. Consistent top-left light: each
// piece has a cast shadow (dark ellipse), a gradient body, and a highlight
// facet. Gradient/pattern ids come from <AtlasDefs/>. Pure inline SVG.
const INK = "#3a2d20";

function Shadow({ rx = 13, ry = 3.5, y = 3 }: { rx?: number; ry?: number; y?: number }) {
  return <ellipse cx={0} cy={y} rx={rx} ry={ry} fill={INK} opacity={0.16} />;
}

export function Tree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Shadow rx={15} ry={4} />
      <rect x={-3.5} y={-11} width={7} height={15} rx={2.5} fill="#9c7a4f" stroke={INK} strokeWidth={1.2} />
      <path d="M-3.5 -8 h7" stroke="#7d5f3a" strokeWidth={1} opacity={0.5} />
      <circle cx={-8} cy={-18} r={11} fill="url(#a-leaf)" stroke={INK} strokeWidth={1.3} />
      <circle cx={9} cy={-16} r={10} fill="url(#a-leaf)" stroke={INK} strokeWidth={1.3} />
      <circle cx={0} cy={-27} r={13} fill="url(#a-leaf)" stroke={INK} strokeWidth={1.3} />
      <circle cx={-4} cy={-31} r={4} fill="#b6d68f" opacity={0.7} />
    </g>
  );
}

export function Pine({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Shadow rx={12} ry={3.5} y={4} />
      <rect x={-3} y={-4} width={6} height={10} rx={1.5} fill="#9c7a4f" stroke={INK} strokeWidth={1.1} />
      <path d="M0 -36 L12 -8 L-12 -8 Z" fill="url(#a-pine)" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M0 -24 L15 2 L-15 2 Z" fill="url(#a-pine)" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M0 -34 L-4 -12 L0 -14 Z" fill="#8ab77a" opacity={0.55} />
    </g>
  );
}

export function Bush({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <Shadow rx={12} ry={3} y={2} />
      <circle cx={-7} cy={-4} r={7} fill="url(#a-leaf)" stroke={INK} strokeWidth={1.1} />
      <circle cx={7} cy={-5} r={8} fill="url(#a-leaf)" stroke={INK} strokeWidth={1.1} />
      <circle cx={0} cy={-9} r={7} fill="url(#a-leaf)" stroke={INK} strokeWidth={1.1} />
      <circle cx={-3} cy={-11} r={2.4} fill="#b6d68f" opacity={0.7} />
    </g>
  );
}

export function Mountain({ x, y, s = 1, snow = true }: { x: number; y: number; s?: number; snow?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Shadow rx={40} ry={6} y={4} />
      <path d="M-46 6 L0 -58 L46 6 Z" fill="#b8a888" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      {/* shaded right face */}
      <path d="M0 -58 L46 6 L10 6 Z" fill={INK} opacity={0.12} />
      {snow && <path d="M-16 -20 L0 -58 L16 -20 Q8 -14 0 -20 Q-8 -26 -16 -20 Z" fill="#f2efe6" stroke={INK} strokeWidth={1} strokeLinejoin="round" />}
    </g>
  );
}

export function Hill({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Shadow rx={30} ry={5} y={4} />
      <path d="M-34 6 Q-20 -26 0 -26 Q20 -26 34 6 Z" fill="#bcc98d" stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M0 -26 Q20 -26 34 6 L14 6 Z" fill={INK} opacity={0.1} />
    </g>
  );
}

export function Rock({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <Shadow rx={11} ry={3} y={4} />
      <path d="M-11 5 Q-13 -6 -3 -9 Q5 -12 10 -4 Q13 3 8 5 Z" fill="#c2b39a" stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M-3 -9 Q5 -12 10 -4 L2 -3 Z" fill={INK} opacity={0.12} />
    </g>
  );
}

export function Reed({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke="#6f8a5c" strokeWidth={1.8} strokeLinecap="round">
      <path d="M0 0 L-2 -16" /><path d="M4 0 L4 -18" /><path d="M8 0 L11 -14" />
      <circle cx={4} cy={-19} r={1.8} fill="#8a6b3d" stroke="none" />
      <circle cx={11} cy={-15} r={1.6} fill="#8a6b3d" stroke="none" />
    </g>
  );
}

export function Flower({ x, y, hue }: { x: number; y: number; hue: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0 v-7" stroke="#5f8a52" strokeWidth={1.4} strokeLinecap="round" />
      {[0, 72, 144, 216, 288].map((d) => (
        <ellipse key={d} cx={3.6 * Math.cos(((d - 90) * Math.PI) / 180)} cy={-7 + 3.6 * Math.sin(((d - 90) * Math.PI) / 180)}
          rx={2.6} ry={3.4} fill={hue} stroke={INK} strokeWidth={0.7}
          transform={`rotate(${d} ${3.6 * Math.cos(((d - 90) * Math.PI) / 180)} ${-7 + 3.6 * Math.sin(((d - 90) * Math.PI) / 180)})`} />
      ))}
      <circle cx={0} cy={-7} r={2} fill="#f7ecca" stroke={INK} strokeWidth={0.6} />
    </g>
  );
}

export function Pond({ x, y, rx, ry }: { x: number; y: number; rx: number; ry: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={rx + 3} ry={ry + 3} fill="#cdbd91" opacity={0.7} />
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#9cc3cf" stroke={INK} strokeWidth={1.2} />
      <ellipse cx={x - rx * 0.3} cy={y - ry * 0.32} rx={rx * 0.32} ry={ry * 0.22} fill="#d3ebef" opacity={0.75} />
    </g>
  );
}
