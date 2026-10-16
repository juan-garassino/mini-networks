"use client";

// Map furniture: ornate compass rose, scroll-banner title, a galleon carrying
// the surveyor critter, a sea-serpent flourish, a scale bar, and a decorative
// border frame. All inline SVG using the atlas gradients/filters.
import { motion } from "motion/react";
import { CritterCameo } from "@/components/paper/critters";

const INK = "#3a2d20";

export function CompassRose({ x, y, r = 56 }: { x: number; y: number; r?: number }) {
  const pt = (deg: number, rad: number) => `${Math.cos((deg * Math.PI) / 180) * rad},${Math.sin((deg * Math.PI) / 180) * rad}`;
  return (
    <g transform={`translate(${x} ${y})`} filter="url(#a-shadow-sm)">
      <circle r={r} fill="url(#a-parch)" stroke={INK} strokeWidth={1.8} />
      <circle r={r - 8} fill="none" stroke={INK} strokeWidth={0.8} opacity={0.4} />
      <circle r={r - 14} fill="none" stroke={INK} strokeWidth={0.6} opacity={0.3} strokeDasharray="1 4" />
      {[45, 135, 225, 315].map((d) => (
        <polygon key={d} points={`0,0 ${pt(d - 7, r - 16)} ${pt(d, r - 8)} ${pt(d + 7, r - 16)}`}
          fill="#cbb98f" stroke={INK} strokeWidth={0.6} />
      ))}
      {[0, 90, 180, 270].map((d) => (
        <polygon key={d} points={`0,0 ${pt(d - 6, r - 8)} ${pt(d, r - 1)} ${pt(d + 6, r - 8)}`}
          fill="url(#a-gold)" stroke={INK} strokeWidth={0.8} />
      ))}
      <polygon points={`0,0 ${pt(270 - 6, r - 8)} ${pt(270, r - 1)} ${pt(270 + 6, r - 8)}`}
        fill="#bf4a2a" stroke={INK} strokeWidth={0.8} />
      <circle r={4} fill="url(#a-gold)" stroke={INK} strokeWidth={1} />
      <text x={0} y={-r + 12} textAnchor="middle" fontFamily="var(--font-display)" fontSize={12} fontWeight={800} fill={INK}>N</text>
    </g>
  );
}

export function ScrollBanner({ x, y, models, comps }: { x: number; y: number; models: number; comps: number }) {
  return (
    <g transform={`translate(${x} ${y})`} filter="url(#a-shadow)">
      {/* curled ends */}
      <path d="M0 2 Q-14 26 0 50 L-10 50 Q-24 26 -10 2 Z" fill="#dcc79a" stroke={INK} strokeWidth={1.5} />
      <path d="M360 2 Q374 26 360 50 L370 50 Q384 26 370 2 Z" fill="#dcc79a" stroke={INK} strokeWidth={1.5} />
      <rect x={0} y={0} width={360} height={52} rx={4} fill="url(#a-parch)" stroke={INK} strokeWidth={1.8} />
      <rect x={6} y={5} width={348} height={42} rx={3} fill="none" stroke={INK} strokeWidth={0.7} opacity={0.35} />
      <text x={18} y={19} fontFamily="var(--font-draft)" fontSize={10} fill="#8a7a63">the periodic table of</text>
      <text x={16} y={42} fontFamily="var(--font-display)" fontSize={26} fontWeight={800} letterSpacing="0.05em" fill={INK}>mini_networks</text>
      <text x={355} y={45} textAnchor="end" fontFamily="var(--font-draft)" fontSize={9.5} fill="#8a7a63">
        {models} species · {comps} routes
      </text>
    </g>
  );
}

export function Galleon({ x, y }: { x: number; y: number }) {
  return (
    <motion.g transform={`translate(${x} ${y})`}
      animate={{ y: [0, -4, 0], rotate: [-1.5, 1.5, -1.5] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
      <g filter="url(#a-shadow-sm)">
        <path d="M-38 0 Q-32 20 0 20 Q32 20 38 0 Z" fill="#a9814e" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
        <path d="M-38 0 Q-32 20 0 20 Q32 20 38 0" fill="none" stroke="#7d5f3a" strokeWidth={1} opacity={0.5} />
        <line x1={-2} y1={0} x2={-2} y2={-40} stroke={INK} strokeWidth={2.2} />
        <path d="M2 -38 Q26 -30 22 -6 L2 -6 Z" fill="#f2e8cd" stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
        <path d="M-6 -30 Q-24 -24 -20 -6 L-6 -6 Z" fill="#e9d7a6" stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
        <path d="M-2 -40 l6 -2 l-6 -3 Z" fill="#bf4a2a" stroke={INK} strokeWidth={0.8} />
      </g>
      <foreignObject x={-16} y={-20} width={28} height={28}>
        <CritterCameo size={26} />
      </foreignObject>
    </motion.g>
  );
}

export function SeaSerpent({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={0.85}>
      <path d="M0 12 Q14 -6 28 12 Q42 30 56 12 Q70 -6 84 12" fill="none" stroke="#5f8790" strokeWidth={4} strokeLinecap="round" />
      <path d="M84 12 q10 -6 16 -2 q-8 2 -8 8 q-6 -2 -8 -6 Z" fill="#5f8790" stroke={INK} strokeWidth={1} strokeLinejoin="round" />
      <circle cx={92} cy={7} r={1.3} fill={INK} />
    </g>
  );
}

export function ScaleBar({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-8} y={-8} width={150} height={34} rx={4} fill="url(#a-parch)" stroke={INK} strokeWidth={1.2} opacity={0.92} />
      {[0, 30, 60, 90, 120].map((tx, i) => (
        <rect key={tx} x={tx} y={8} width={30} height={6} fill={i % 2 ? "#f2e8cd" : INK} stroke={INK} strokeWidth={1} />
      ))}
      <text x={0} y={4} fontSize={9} fontFamily="var(--font-draft)" fill={INK}>0</text>
      <text x={118} y={4} fontSize={9} fontFamily="var(--font-draft)" fill={INK}>1 epoch</text>
    </g>
  );
}

export function BorderFrame({ w, h }: { w: number; h: number }) {
  const m = 10;
  const corner = (cx: number, cy: number, sx: number, sy: number) => (
    <path d={`M${cx} ${cy + sy * 34} Q${cx} ${cy} ${cx + sx * 34} ${cy} M${cx + sx * 10} ${cy + sy * 22} Q${cx + sx * 10} ${cy + sy * 10} ${cx + sx * 22} ${cy + sy * 10}`}
      fill="none" stroke={INK} strokeWidth={1.6} opacity={0.5} />
  );
  return (
    <g>
      <rect x={m} y={m} width={w - 2 * m} height={h - 2 * m} rx={6} fill="none" stroke={INK} strokeWidth={2} opacity={0.55} />
      <rect x={m + 5} y={m + 5} width={w - 2 * m - 10} height={h - 2 * m - 10} rx={4} fill="none" stroke={INK} strokeWidth={0.8} opacity={0.3} />
      {corner(m + 2, m + 2, 1, 1)}
      {corner(w - m - 2, m + 2, -1, 1)}
      {corner(m + 2, h - m - 2, 1, -1)}
      {corner(w - m - 2, h - m - 2, -1, -1)}
    </g>
  );
}
