// Paper art — the material + light system.
//
//   <ArtDefs />      render ONCE per document (inside any <svg>): every shared
//                    pattern + gradient the assets reference (ids "pa-*").
//   <Art>            place an asset: base-centre at (x, y), `size` px tall.
//   <Cutout>         a paper cutout: side thickness face, die-cut rim lit from
//                    the top-left, the faces (children), fibre grain, and a
//                    material finish (paper | card | felt | sticker).
//   <StandUp>        a Cutout standing on the ground: contact shadow + a cast
//                    shadow falling down-right + the little card base tab.
//   <SoftShadow>     layered translucent copies (no filter) — a soft edge.
//
// Perf: zero SVG filters. A soft shadow is 3 translucent copies of one path;
// grain/knit/corrugation are small <pattern> tiles the browser caches. A Cutout
// is ~5 paths + its faces, so a map can hold a few hundred.
import type { ReactNode } from "react";
import { CAST, P } from "./palette";
import { rng } from "./geom";

// ── shared defs ─────────────────────────────────────────────────────────

function fibreStrokes(seed: number, size: number, count: number, minLen: number, maxLen: number) {
  const r = rng(seed);
  let light = "", dark = "";
  for (let i = 0; i < count; i++) {
    const x = r() * size, y = r() * size, len = minLen + r() * (maxLen - minLen), a = r() * Math.PI;
    const bx = (r() - 0.5) * 2.4, by = (r() - 0.5) * 2.4;
    const seg = `M${x.toFixed(1)} ${y.toFixed(1)}q${(Math.cos(a) * len * 0.5 + bx).toFixed(1)} ${(Math.sin(a) * len * 0.5 + by).toFixed(1)} ${(Math.cos(a) * len).toFixed(1)} ${(Math.sin(a) * len).toFixed(1)}`;
    if (r() < 0.55) light += seg; else dark += seg;
  }
  return { light, dark };
}
function specks(seed: number, size: number, count: number, rMax: number) {
  const r = rng(seed);
  let a = "", b = "";
  for (let i = 0; i < count; i++) {
    const x = r() * size, y = r() * size, rr = 0.3 + r() * rMax;
    const c = `M${(x - rr).toFixed(1)} ${y.toFixed(1)}a${rr.toFixed(2)} ${rr.toFixed(2)} 0 1 0 ${(rr * 2).toFixed(2)} 0a${rr.toFixed(2)} ${rr.toFixed(2)} 0 1 0 ${(-rr * 2).toFixed(2)} 0Z`;
    if (r() < 0.5) a += c; else b += c;
  }
  return { a, b };
}

const FIBRE = fibreStrokes(0x5eed, 64, 70, 3, 11);
const GRIT = specks(0x9e37, 40, 46, 1.1);

/** Every shared pattern + gradient, rendered once. Overlay patterns are
 *  colour-agnostic (translucent ink / paper) and go on top of a base fill. */
export function ArtDefs() {
  return (
    <defs>
      {/* ── overlays (translucent, any base colour) ── */}
      <pattern id="pa-fibre" width={64} height={64} patternUnits="userSpaceOnUse">
        <path d={FIBRE.light} fill="none" stroke="#FFFDF6" strokeOpacity={0.18} strokeWidth={0.7} strokeLinecap="round" />
        <path d={FIBRE.dark} fill="none" stroke="#2B2118" strokeOpacity={0.08} strokeWidth={0.6} strokeLinecap="round" />
      </pattern>
      <pattern id="pa-grit" width={40} height={40} patternUnits="userSpaceOnUse">
        <path d={GRIT.a} fill="#FFFFFF" fillOpacity={0.22} />
        <path d={GRIT.b} fill="#1B1530" fillOpacity={0.2} />
      </pattern>
      {/* knit: interlocking V stitches, each with a lit left leg and a shaded right leg */}
      <pattern id="pa-knit" width={6} height={5.2} patternUnits="userSpaceOnUse">
        <path d="M0.6 0.4 Q1.2 3.6 3 4.8" fill="none" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={1.1} strokeLinecap="round" />
        <path d="M5.4 0.4 Q4.8 3.6 3 4.8" fill="none" stroke="#1B1530" strokeOpacity={0.24} strokeWidth={1.1} strokeLinecap="round" />
      </pattern>
      <pattern id="pa-corrugate" width={3} height={10} patternUnits="userSpaceOnUse">
        <rect width={1.3} height={10} fill="#5A3E1E" fillOpacity={0.28} />
        <rect x={1.3} width={0.6} height={10} fill="#FFF6DD" fillOpacity={0.25} />
      </pattern>
      <pattern id="pa-bricks" width={16} height={9} patternUnits="userSpaceOnUse">
        <path d="M0 0.5H16M0 5H16M4 0.5V5M12 5V9.5" fill="none" stroke="#2A1030" strokeOpacity={0.22} strokeWidth={0.9} />
        <path d="M0 1.4H16M0 5.9H16" fill="none" stroke="#FFFFFF" strokeOpacity={0.18} strokeWidth={0.6} />
      </pattern>
      <pattern id="pa-stone" width={22} height={12} patternUnits="userSpaceOnUse">
        <path d="M0 0.5H22M0 6.5H22M7 0.5V6.5M17 6.5V12.5" fill="none" stroke="#3D2F4A" strokeOpacity={0.24} strokeWidth={0.9} />
        <path d="M1 1.6H6M8 1.6H21M1 7.6H16M18 7.6H22" fill="none" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={0.7} strokeLinecap="round" />
      </pattern>
      {/* roof tiles: rows of scallops */}
      <pattern id="pa-tiles" width={8} height={6} patternUnits="userSpaceOnUse">
        <path d="M0 6 Q2 0.6 4 6 Q6 0.6 8 6" fill="none" stroke="#2A1030" strokeOpacity={0.26} strokeWidth={0.9} />
        <path d="M0.8 4.6 Q2 1.8 3 3.8" fill="none" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={0.6} />
        <path d="M4.8 4.6 Q6 1.8 7 3.8" fill="none" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={0.6} />
      </pattern>
      <pattern id="pa-shingle" width={10} height={6} patternUnits="userSpaceOnUse">
        <path d="M0 0.5H10M0 3.5H10M3 0.5V3.5M8 3.5V6.5" fill="none" stroke="#1B1530" strokeOpacity={0.26} strokeWidth={0.8} />
      </pattern>
      <pattern id="pa-planks" width={40} height={6} patternUnits="userSpaceOnUse">
        <path d="M0 0.4H40" stroke="#3A1E10" strokeOpacity={0.35} strokeWidth={0.8} />
        <path d="M0 1.3H40" stroke="#FFE6BF" strokeOpacity={0.3} strokeWidth={0.6} />
        <path d="M13 0.5V6M31 0.5V6" stroke="#3A1E10" strokeOpacity={0.22} strokeWidth={0.7} />
        <circle cx={15} cy={3.2} r={0.5} fill="#3A1E10" fillOpacity={0.5} />
      </pattern>
      <pattern id="pa-stripes" width={7} height={10} patternUnits="userSpaceOnUse">
        <rect x={4.4} width={1.6} height={10} fill="#10404A" fillOpacity={0.3} />
        <rect x={1} width={1.1} height={10} fill="#FFFFFF" fillOpacity={0.22} />
      </pattern>
      <pattern id="pa-bands" width={10} height={14} patternUnits="userSpaceOnUse">
        <rect width={10} height={7} fill="#FFFBEF" />
      </pattern>
      {/* graphite hatching for "not inked yet" (provisional) */}
      <pattern id="pa-hatch" width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
        <path d="M0 0.5H4" stroke="#7A6E62" strokeOpacity={0.55} strokeWidth={0.7} />
      </pattern>
      <pattern id="pa-dots" width={6} height={6} patternUnits="userSpaceOnUse">
        <circle cx={1.5} cy={1.5} r={0.8} fill="#FFFFFF" fillOpacity={0.45} />
        <circle cx={4.5} cy={4.5} r={0.8} fill="#FFFFFF" fillOpacity={0.45} />
      </pattern>

      {/* ── surfaces (opaque, for ground layers in world px) ── */}
      <pattern id="pa-grass" width={14} height={14} patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
        <rect width={14} height={14} fill="#7DCB45" />
        <rect width={7} height={14} fill="#6DBE3E" />
        <rect x={6.4} width={0.9} height={14} fill="#A2DE66" fillOpacity={0.6} />
      </pattern>
      <pattern id="pa-meadow" width={20} height={20} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width={20} height={20} fill="#86D04A" />
        <rect width={10} height={10} fill="#79C544" />
        <rect x={10} y={10} width={10} height={10} fill="#79C544" />
      </pattern>
      <pattern id="pa-sand" width={60} height={28} patternUnits="userSpaceOnUse">
        <rect width={60} height={28} fill="#F7D98A" />
        <path d="M-4 12 Q10 4 24 11 T54 10 M20 25 Q34 18 48 25 T78 24" fill="none" stroke="#E8BF62" strokeWidth={2.2} strokeLinecap="round" />
        <path d="M-4 10.4 Q10 2.4 24 9.4 M20 23.4 Q34 16.4 48 23.4" fill="none" stroke="#FFF0B8" strokeWidth={1.2} strokeLinecap="round" />
      </pattern>
      {/* sea: three blues of scallops, each crest traced with a white line */}
      <pattern id="pa-sea" width={48} height={26} patternUnits="userSpaceOnUse">
        <rect width={48} height={26} fill="#1E62D9" />
        <path d="M0 13 a12 12 0 0 1 24 0 a12 12 0 0 1 24 0 V26 H0Z" fill="#1A57C8" />
        <path d="M-12 26 a12 12 0 0 1 24 0 a12 12 0 0 1 24 0 a12 12 0 0 1 24 0" fill="#2872E2" />
        <path d="M0 13 a12 12 0 0 1 24 0 a12 12 0 0 1 24 0" fill="none" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={1.4} />
        <path d="M-12 26 a12 12 0 0 1 24 0 a12 12 0 0 1 24 0 a12 12 0 0 1 24 0" fill="none" stroke="#8EC2FF" strokeOpacity={0.55} strokeWidth={1.2} />
        <path d="M-12 0 a12 12 0 0 1 24 0 a12 12 0 0 1 24 0 a12 12 0 0 1 24 0" fill="none" stroke="#8EC2FF" strokeOpacity={0.55} strokeWidth={1.2} />
      </pattern>
      <pattern id="pa-cobble" width={12} height={10} patternUnits="userSpaceOnUse">
        <rect width={12} height={10} fill="#F2B632" />
        <path d="M1 4.5 Q3 1 6 1.4 Q9 1 11 4.5 M-5 9.5 Q-3 6 0 6.4 Q3 6 5 9.5 M7 9.5 Q9 6 12 6.4" fill="none" stroke="#C98A14" strokeOpacity={0.55} strokeWidth={0.9} />
      </pattern>

      {/* ── gradients ── */}
      {/* die-cut rim: bright on the lit top-left, cream-shaded bottom-right */}
      <linearGradient id="pa-rim" x1={0} y1={0} x2={1} y2={1}>
        <stop offset={0.45} stopColor="#FFFFFF" />
        <stop offset={1} stopColor={P.dieShade} />
      </linearGradient>
      {/* sticker gloss: a soft white hotspot up-left */}
      <radialGradient id="pa-gloss" cx={0.3} cy={0.22} r={0.65}>
        <stop offset={0} stopColor="#FFFFFF" stopOpacity={0.62} />
        <stop offset={0.35} stopColor="#FFFFFF" stopOpacity={0.16} />
        <stop offset={1} stopColor="#FFFFFF" stopOpacity={0} />
      </radialGradient>
      {/* cylinder turn: lit left edge, core, shaded right edge */}
      <linearGradient id="pa-turn" x1={0} y1={0} x2={1} y2={0}>
        <stop offset={0} stopColor="#FFFFFF" stopOpacity={0.28} />
        <stop offset={0.3} stopColor="#FFFFFF" stopOpacity={0} />
        <stop offset={0.55} stopColor="#1B1530" stopOpacity={0} />
        <stop offset={1} stopColor="#1B1530" stopOpacity={0.42} />
      </linearGradient>
      {/* ground occlusion: darkens the bottom of a wall where it meets the ground */}
      <linearGradient id="pa-occl" x1={0} y1={0} x2={0} y2={1}>
        <stop offset={0.72} stopColor="#1B1530" stopOpacity={0} />
        <stop offset={1} stopColor="#1B1530" stopOpacity={0.24} />
      </linearGradient>
      <radialGradient id="pa-glow">
        <stop offset={0} stopColor="#FFF6B0" stopOpacity={0.95} />
        <stop offset={0.45} stopColor="#FFD84D" stopOpacity={0.45} />
        <stop offset={1} stopColor="#FFD84D" stopOpacity={0} />
      </radialGradient>
      {/* a lamp beam: opaque at the lamp (x = 1 of its box), fading out */}
      <linearGradient id="pa-beam" x1={1} y1={0} x2={0} y2={0}>
        <stop offset={0} stopColor="#FFF3A6" stopOpacity={0.85} />
        <stop offset={1} stopColor="#FFF3A6" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="pa-lake" x1={0} y1={0} x2={0} y2={1}>
        <stop offset={0} stopColor="#7FD8F2" />
        <stop offset={1} stopColor="#2A8FD8" />
      </linearGradient>
      <linearGradient id="pa-cloud" x1={0} y1={0} x2={0.3} y2={1}>
        <stop offset={0} stopColor="#FFFFFF" />
        <stop offset={0.55} stopColor="#E9EEF8" />
        <stop offset={1} stopColor="#B9C4DE" />
      </linearGradient>
    </defs>
  );
}

// ── placement ───────────────────────────────────────────────────────────

export interface ArtProps {
  /** base-centre x, y in the parent's units */
  x?: number;
  y?: number;
  /** rendered height in the parent's units (defaults to the asset's design height) */
  size?: number;
  /** mirror horizontally (the light stays top-left: assets re-shade, not flip, where it matters) */
  flip?: boolean;
}

/** Place a design-space drawing (base-centre at 0,0, `design` units tall). */
export function Art({ x = 0, y = 0, size, design, flip, children }: ArtProps & { design: number; children: ReactNode }) {
  const k = (size ?? design) / design;
  const t = `translate(${x} ${y})${k !== 1 || flip ? ` scale(${flip ? -k : k} ${k})` : ""}`;
  return <g transform={t}>{children}</g>;
}

// ── shadows ─────────────────────────────────────────────────────────────

/** Soft shadow without a filter: a wide faint copy, a mid copy, the core.
 *  Each step is an OPAQUE union inside a translucent group, so overlapping
 *  silhouette pieces never double-darken. */
export function SoftShadow({ d, transform, spread = 3, opacity = 1, color = P.shadow }: {
  d: string | string[]; transform?: string; spread?: number; opacity?: number; color?: string;
}) {
  const ds = Array.isArray(d) ? d : [d];
  const step = (o: number, sw: number) => (
    <g opacity={o}>
      {ds.map((p, i) => <path key={i} d={p} fill={color} stroke={sw ? color : undefined} strokeWidth={sw || undefined} strokeLinejoin="round" />)}
    </g>
  );
  return (
    <g transform={transform} opacity={opacity} pointerEvents="none">
      {step(0.07, spread * 3.2)}
      {step(0.08, spread * 1.6)}
      {step(0.12, 0)}
    </g>
  );
}

/** Ambient occlusion under a standing prop: a dark core in a soft pool. */
export function ContactShadow({ rx, ry, cx = 0, cy = 0 }: { rx: number; ry?: number; cx?: number; cy?: number }) {
  const h = ry ?? Math.min(rx * 0.26, 3 + rx * 0.08);
  return (
    <g pointerEvents="none">
      <ellipse cx={cx + rx * 0.12} cy={cy + h * 0.25} rx={rx * 1.25} ry={h * 1.5} fill={P.shadow} fillOpacity={0.08} />
      <ellipse cx={cx + rx * 0.08} cy={cy + h * 0.15} rx={rx * 1.02} ry={h} fill={P.shadow} fillOpacity={0.12} />
      <ellipse cx={cx + rx * 0.04} cy={cy} rx={rx * 0.8} ry={h * 0.55} fill={P.shadow} fillOpacity={0.2} />
    </g>
  );
}

// ── the cutout ──────────────────────────────────────────────────────────

export type Material = "paper" | "card" | "felt" | "sticker";

export interface CutoutProps {
  /** the silhouette: one path or several pieces (drawn as a union) — drives rim, side face and shadow */
  d: string | string[];
  /** die-cut rim width in design units (0 = none) */
  rim?: number;
  /** side thickness, shown down-right of the silhouette */
  depth?: number;
  material?: Material;
  /** "drop" = lying flat / floating (offset down-right), "ground" = standing (cast onto the ground), "none" */
  shadow?: "drop" | "ground" | "none";
  /** how far a floating piece hovers (drop-shadow offset multiplier) */
  lift?: number;
  /** fibre grain overlay on top of the faces */
  grain?: boolean;
  /** felt edge colour (material="felt") */
  fuzz?: string;
  children?: ReactNode;
}

export function Cutout({ d, rim = 3, depth = 2.5, material = "paper", shadow = "drop", lift = 1, grain = true, fuzz, children }: CutoutProps) {
  const ds = Array.isArray(d) ? d : [d];
  const all = ds.join("");
  const side = material === "card" ? P.card : P.dieShade;
  const sideT = `translate(${(depth * 0.55).toFixed(2)} ${depth.toFixed(2)})`;
  const each = (props: Record<string, unknown>) => ds.map((p, i) => <path key={i} d={p} {...props} />);
  return (
    <g>
      {shadow === "drop" && <SoftShadow d={ds} transform={`translate(${((depth + 2.5) * lift).toFixed(2)} ${((depth + 4) * lift).toFixed(2)})`} spread={rim + 1} />}
      {shadow === "ground" && <SoftShadow d={ds} transform={CAST} spread={rim + 1.5} opacity={0.9} />}
      {depth > 0 && (
        <g transform={sideT}>
          {each({ fill: side, stroke: side, strokeWidth: rim * 2, strokeLinejoin: "round" })}
          {material === "card" && <path d={all} fill="url(#pa-corrugate)" stroke="url(#pa-corrugate)" strokeWidth={rim * 2} strokeLinejoin="round" />}
        </g>
      )}
      {rim > 0 && each({ fill: P.die, stroke: "url(#pa-rim)", strokeWidth: rim * 2, strokeLinejoin: "round" })}
      {material === "felt" && fuzz && (
        <path d={all} fill="none" stroke={fuzz} strokeWidth={rim * 1.2 + 1} strokeDasharray="0.1 1.9" strokeLinecap="round" />
      )}
      {children}
      {material === "felt" && <path d={all} fill="url(#pa-knit)" pointerEvents="none" />}
      {grain && <path d={all} fill="url(#pa-fibre)" pointerEvents="none" />}
      {material === "sticker" && <path d={all} fill="url(#pa-gloss)" pointerEvents="none" />}
    </g>
  );
}

/** A cutout standing on the ground: contact shadow, cast shadow down-right,
 *  a small folded card tab at the base, then the cutout itself. */
export function StandUp({ foot = 12, tab = false, ...c }: CutoutProps & { /** half-width of the footprint */ foot?: number; tab?: boolean }) {
  return (
    <g>
      <ContactShadow rx={foot} />
      {tab && (
        <path d={`M${-foot * 0.55} 0 L${foot * 0.55} 0 L${foot * 0.62 + 1.5} ${foot * 0.2 + 1} L${-foot * 0.48 + 1.5} ${foot * 0.2 + 1} Z`}
          fill={P.card} />
      )}
      <Cutout {...c} shadow={c.shadow ?? "ground"} />
    </g>
  );
}

// ── finishes ────────────────────────────────────────────────────────────

/** Specular glint: a short curved streak + a four-point sparkle. */
export function Glint({ x, y, r = 4, streak = true }: { x: number; y: number; r?: number; streak?: boolean }) {
  // sparkle centred up-right of the streak
  const cx = x + r * 0.5, cy = y - r * 1.1, q = r * 0.62, s = q * 0.22;
  return (
    <g pointerEvents="none">
      {streak && <path d={`M${x - r * 1.5} ${y + r * 1.2} Q${x - r * 1.45} ${y - r * 0.3} ${x - r * 0.3} ${y - r * 0.8}`} fill="none" stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={r * 0.42} strokeLinecap="round" />}
      <path d={`M${cx} ${cy - q}Q${cx + s} ${cy - s} ${cx + q} ${cy}Q${cx + s} ${cy + s} ${cx} ${cy + q}Q${cx - s} ${cy + s} ${cx - q} ${cy}Q${cx - s} ${cy - s} ${cx} ${cy - q}Z`} fill="#FFFFFF" />
    </g>
  );
}

/** A lit edge: a thin warm-white line along the top-left side of a face. */
export function LitEdge({ d, w = 1.2, opacity = 0.7 }: { d: string; w?: number; opacity?: number }) {
  return <path d={d} fill="none" stroke="#FFFBE8" strokeOpacity={opacity} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />;
}

/** Felt stitching along a path (running stitch). */
export function Stitch({ d, color = "#FFFFFF", w = 0.9, opacity = 0.7 }: { d: string; color?: string; w?: number; opacity?: number }) {
  return <path d={d} fill="none" stroke={color} strokeOpacity={opacity} strokeWidth={w} strokeDasharray={`${w * 2.4} ${w * 2}`} strokeLinecap="round" pointerEvents="none" />;
}
