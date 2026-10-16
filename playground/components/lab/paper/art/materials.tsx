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

      {/* ── storybook surfaces (the painted world map) ── */}
      <pattern id="pa-sea-paint" width={200} height={120} patternUnits="userSpaceOnUse">
        <rect width={200} height={120} fill="#4C8FB9" />
        <g fill="#72B2D0" fillOpacity={0.32}><ellipse cx="41.7" cy="38.9" rx="17.8" ry="7.7" /><ellipse cx="101.5" cy="0.1" rx="35.8" ry="11.8" /><ellipse cx="43.6" cy="88.0" rx="37.7" ry="6.0" /><ellipse cx="17.0" cy="36.0" rx="31.9" ry="7.6" /><ellipse cx="112.0" cy="96.7" rx="41.9" ry="9.8" /><ellipse cx="178.9" cy="67.1" rx="19.9" ry="7.9" /><ellipse cx="99.8" cy="45.2" rx="36.1" ry="6.9" /><ellipse cx="141.7" cy="62.3" rx="21.0" ry="7.3" /><ellipse cx="11.1" cy="69.3" rx="33.5" ry="11.5" /></g>
        <g fill="#356F9B" fillOpacity={0.22}><ellipse cx="150" cy="30" rx="40" ry="9" /><ellipse cx="40" cy="95" rx="36" ry="8" /></g>
        <path d="M98.8 32.1q7.0 -8.4 13.9 0q4.2 5.8 7.7 -1.7M124.3 100.7q3.1 -3.5 6.2 0q1.9 2.5 3.4 -0.7M55.5 17.2q4.7 -4.9 9.4 0q2.8 3.4 5.2 -1.0M22.5 0.7q3.4 -3.4 6.8 0q2.0 2.4 3.8 -0.7M86.0 95.4q3.8 -2.9 7.6 0q2.3 2.0 4.2 -0.6M53.0 97.3q4.0 -4.3 8.1 0q2.4 3.0 4.5 -0.9M183.0 54.1q6.8 -6.2 13.7 0q4.1 4.3 7.5 -1.2M15.1 28.1q6.8 -6.5 13.6 0q4.1 4.6 7.5 -1.3M137.6 79.8q5.3 -4.6 10.7 0q3.2 3.2 5.9 -0.9M81.8 109.2q6.8 -5.3 13.6 0q4.1 3.7 7.5 -1.1M75.1 51.8q3.1 -3.2 6.2 0q1.8 2.2 3.4 -0.6M71.7 12.9q4.1 -4.2 8.2 0q2.5 3.0 4.5 -0.8M57.8 16.4q5.7 -5.2 11.5 0q3.4 3.7 6.3 -1.0M116.2 110.4q4.5 -3.4 9.1 0q2.7 2.4 5.0 -0.7M19.6 27.7q7.0 -5.5 14.1 0q4.2 3.8 7.7 -1.1M95.5 95.3q4.7 -4.4 9.5 0q2.8 3.1 5.2 -0.9M117.3 115.8q3.4 -3.0 6.8 0q2.0 2.1 3.7 -0.6M61.5 13.2q6.2 -4.8 12.3 0q3.7 3.3 6.8 -1.0M154.1 86.7q3.8 -3.7 7.6 0q2.3 2.6 4.2 -0.7M121.5 9.3q3.7 -2.9 7.4 0q2.2 2.0 4.0 -0.6M89.1 111.6q5.7 -5.6 11.3 0q3.4 3.9 6.2 -1.1M31.6 77.4q4.8 -4.8 9.6 0q2.9 3.4 5.3 -1.0" fill="none" stroke="#FFFFFF" strokeOpacity={0.72} strokeWidth={1.3} strokeLinecap="round" />
        <path d="M116.6 33.5q2.8 -1.2 5.7 0M36.7 48.6q4.4 -1.2 8.7 0M25.7 89.5q3.4 -1.2 6.8 0M40.5 34.4q5.2 -1.2 10.4 0M29.0 13.2q5.2 -1.2 10.4 0M54.2 62.0q5.8 -1.2 11.6 0M150.9 48.0q2.2 -1.2 4.5 0M193.0 35.6q3.5 -1.2 7.0 0M139.5 58.0q2.8 -1.2 5.7 0M181.5 78.2q6.0 -1.2 12.0 0M190.9 104.7q4.6 -1.2 9.1 0M33.1 7.8q3.0 -1.2 6.1 0M144.6 51.7q2.4 -1.2 4.7 0M18.8 93.6q5.7 -1.2 11.4 0M35.8 65.0q3.6 -1.2 7.1 0M34.9 38.4q4.4 -1.2 8.7 0M71.8 96.3q2.0 -1.2 4.0 0M75.8 12.7q5.1 -1.2 10.3 0" fill="none" stroke="#AED7E6" strokeOpacity={0.8} strokeWidth={1.1} strokeLinecap="round" />
      </pattern>
      <pattern id="pa-s-grass" width={60} height={60} patternUnits="userSpaceOnUse">
        <rect width={60} height={60} fill="#8AAE50" />
        <g fill="#7A9E45" fillOpacity={0.7}><ellipse cx="26.8" cy="54.4" rx="10.8" ry="4.1" /><ellipse cx="2.5" cy="31.8" rx="10.5" ry="4.3" /><ellipse cx="29.3" cy="49.9" rx="6.4" ry="4.2" /><ellipse cx="20.2" cy="4.8" rx="8.1" ry="3.0" /><ellipse cx="14.3" cy="30.7" rx="8.4" ry="5.1" /><ellipse cx="27.8" cy="13.2" rx="5.9" ry="5.8" /><ellipse cx="9.2" cy="45.1" rx="10.5" ry="4.8" /></g>
        <path d="M39.9 1.7l0.9 -3M25.9 17.4l0.6 -3M28.2 9.9l-0.2 -3M17.2 59.8l-0.6 -3M29.3 4.5l0.1 -3M48.7 2.4l-0.3 -3M52.1 48.8l-0.1 -3M1.7 29.9l-0.4 -3M30.6 49.5l-0.8 -3M55.9 59.0l0.4 -3M7.2 40.0l0.3 -3M59.6 46.0l0.8 -3M40.4 13.8l-0.4 -3M56.9 52.2l-0.1 -3M37.5 6.8l0.9 -3M30.4 19.0l0.8 -3M36.0 57.6l0.6 -3M49.6 31.8l1.0 -3M37.4 20.3l-0.6 -3M51.4 4.9l0.3 -3M43.3 1.1l0.5 -3M45.3 44.8l-1.0 -3M5.9 34.9l0.8 -3M20.2 29.7l-0.1 -3M29.0 46.5l-0.2 -3M41.4 44.3l0.5 -3" stroke="#557A38" strokeOpacity={0.7} strokeWidth={0.9} strokeLinecap="round" />
      </pattern>
      <pattern id="pa-s-autumn" width={60} height={60} patternUnits="userSpaceOnUse">
        <rect width={60} height={60} fill="#A3A64E" />
        <g fill="#C9A24A" fillOpacity={0.55}><ellipse cx="26.8" cy="54.4" rx="10.8" ry="4.1" /><ellipse cx="2.5" cy="31.8" rx="10.5" ry="4.3" /><ellipse cx="29.3" cy="49.9" rx="6.4" ry="4.2" /><ellipse cx="20.2" cy="4.8" rx="8.1" ry="3.0" /><ellipse cx="14.3" cy="30.7" rx="8.4" ry="5.1" /><ellipse cx="27.8" cy="13.2" rx="5.9" ry="5.8" /><ellipse cx="9.2" cy="45.1" rx="10.5" ry="4.8" /></g>
        <path d="M39.9 1.7l0.9 -3M25.9 17.4l0.6 -3M28.2 9.9l-0.2 -3M17.2 59.8l-0.6 -3M29.3 4.5l0.1 -3M48.7 2.4l-0.3 -3M52.1 48.8l-0.1 -3M1.7 29.9l-0.4 -3M30.6 49.5l-0.8 -3M55.9 59.0l0.4 -3M7.2 40.0l0.3 -3M59.6 46.0l0.8 -3M40.4 13.8l-0.4 -3M56.9 52.2l-0.1 -3M37.5 6.8l0.9 -3M30.4 19.0l0.8 -3M36.0 57.6l0.6 -3M49.6 31.8l1.0 -3M37.4 20.3l-0.6 -3M51.4 4.9l0.3 -3M43.3 1.1l0.5 -3M45.3 44.8l-1.0 -3M5.9 34.9l0.8 -3M20.2 29.7l-0.1 -3M29.0 46.5l-0.2 -3M41.4 44.3l0.5 -3" stroke="#6E7A36" strokeOpacity={0.7} strokeWidth={0.9} strokeLinecap="round" />
      </pattern>
      <pattern id="pa-s-snow" width={60} height={60} patternUnits="userSpaceOnUse">
        <rect width={60} height={60} fill="#EEF3F8" />
        <g fill="#D3DFEA" fillOpacity={0.8}><ellipse cx="26.8" cy="54.4" rx="10.8" ry="4.1" /><ellipse cx="2.5" cy="31.8" rx="10.5" ry="4.3" /><ellipse cx="29.3" cy="49.9" rx="6.4" ry="4.2" /><ellipse cx="20.2" cy="4.8" rx="8.1" ry="3.0" /><ellipse cx="14.3" cy="30.7" rx="8.4" ry="5.1" /><ellipse cx="27.8" cy="13.2" rx="5.9" ry="5.8" /><ellipse cx="9.2" cy="45.1" rx="10.5" ry="4.8" /></g>
      </pattern>
      <pattern id="pa-s-desert" width={60} height={60} patternUnits="userSpaceOnUse">
        <rect width={60} height={60} fill="#DDA560" />
        <g fill="#E8B46C" fillOpacity={0.6}><ellipse cx="26.8" cy="54.4" rx="10.8" ry="4.1" /><ellipse cx="2.5" cy="31.8" rx="10.5" ry="4.3" /><ellipse cx="29.3" cy="49.9" rx="6.4" ry="4.2" /><ellipse cx="20.2" cy="4.8" rx="8.1" ry="3.0" /><ellipse cx="14.3" cy="30.7" rx="8.4" ry="5.1" /><ellipse cx="27.8" cy="13.2" rx="5.9" ry="5.8" /><ellipse cx="9.2" cy="45.1" rx="10.5" ry="4.8" /></g>
        <path d="M39.9 1.7l0.9 -3M25.9 17.4l0.6 -3M28.2 9.9l-0.2 -3M17.2 59.8l-0.6 -3M29.3 4.5l0.1 -3M48.7 2.4l-0.3 -3M52.1 48.8l-0.1 -3M1.7 29.9l-0.4 -3M30.6 49.5l-0.8 -3M55.9 59.0l0.4 -3M7.2 40.0l0.3 -3M59.6 46.0l0.8 -3M40.4 13.8l-0.4 -3M56.9 52.2l-0.1 -3M37.5 6.8l0.9 -3M30.4 19.0l0.8 -3M36.0 57.6l0.6 -3M49.6 31.8l1.0 -3M37.4 20.3l-0.6 -3M51.4 4.9l0.3 -3M43.3 1.1l0.5 -3M45.3 44.8l-1.0 -3M5.9 34.9l0.8 -3M20.2 29.7l-0.1 -3M29.0 46.5l-0.2 -3M41.4 44.3l0.5 -3" stroke="#A86B39" strokeOpacity={0.35} strokeWidth={0.8} strokeLinecap="round" />
      </pattern>
      <pattern id="pa-s-lavarock" width={80} height={80} patternUnits="userSpaceOnUse">
        <rect width={80} height={80} fill="#3A3038" />
        <path d="M66.9 12.8Q58.6 18.8 70.4 12.7Q71.0 10.2 73.2 19.4Q68.7 9.6 85.5 28.1M66.6 0.7Q64.9 3.2 67.0 1.1Q67.0 -2.4 78.4 -9.7Q75.4 0.3 76.1 3.1M34.9 48.0Q30.2 41.9 33.3 43.6Q30.4 33.7 41.8 40.6Q43.2 38.1 29.8 43.7" fill="none" stroke="#F0672B" strokeOpacity={0.3} strokeWidth={2.6} strokeLinejoin="round" />
        <path d="M66.9 12.8Q58.6 18.8 70.4 12.7Q71.0 10.2 73.2 19.4Q68.7 9.6 85.5 28.1M66.6 0.7Q64.9 3.2 67.0 1.1Q67.0 -2.4 78.4 -9.7Q75.4 0.3 76.1 3.1M34.9 48.0Q30.2 41.9 33.3 43.6Q30.4 33.7 41.8 40.6Q43.2 38.1 29.8 43.7" fill="none" stroke="#FFA63E" strokeOpacity={0.8} strokeWidth={0.8} strokeLinejoin="round" />
        <g fill="#FFA63E" fillOpacity={0.7}><circle cx="25.2" cy="69.2" r="1.4" /><circle cx="63.6" cy="51.2" r="0.7" /><circle cx="37.7" cy="4.8" r="0.7" /><circle cx="57.9" cy="31.4" r="1.3" /><circle cx="22.4" cy="17.2" r="1.2" /><circle cx="67.3" cy="2.8" r="0.6" /><circle cx="9.7" cy="16.8" r="1.1" /><circle cx="60.1" cy="21.8" r="1.5" /></g>
      </pattern>
      <pattern id="pa-s-night" width={60} height={60} patternUnits="userSpaceOnUse">
        <rect width={60} height={60} fill="#3E4270" />
        <g fill="#2D3058" fillOpacity={0.7}><ellipse cx="26.8" cy="54.4" rx="10.8" ry="4.1" /><ellipse cx="2.5" cy="31.8" rx="10.5" ry="4.3" /><ellipse cx="29.3" cy="49.9" rx="6.4" ry="4.2" /><ellipse cx="20.2" cy="4.8" rx="8.1" ry="3.0" /><ellipse cx="14.3" cy="30.7" rx="8.4" ry="5.1" /><ellipse cx="27.8" cy="13.2" rx="5.9" ry="5.8" /><ellipse cx="9.2" cy="45.1" rx="10.5" ry="4.8" /></g>
        <path d="M0 30 H60 M30 0 V60" stroke="#66E9F6" strokeOpacity={0.25} strokeWidth={0.8} />
      </pattern>
      <pattern id="pa-s-reef" width={60} height={60} patternUnits="userSpaceOnUse">
        <rect width={60} height={60} fill="#3C9CA0" />
        <g fill="#2B7480" fillOpacity={0.5}><ellipse cx="26.8" cy="54.4" rx="10.8" ry="4.1" /><ellipse cx="2.5" cy="31.8" rx="10.5" ry="4.3" /><ellipse cx="29.3" cy="49.9" rx="6.4" ry="4.2" /><ellipse cx="20.2" cy="4.8" rx="8.1" ry="3.0" /><ellipse cx="14.3" cy="30.7" rx="8.4" ry="5.1" /><ellipse cx="27.8" cy="13.2" rx="5.9" ry="5.8" /><ellipse cx="9.2" cy="45.1" rx="10.5" ry="4.8" /></g>
        <path d="M51.1 3.0q5.3 -4.8 10.6 0q3.2 3.2 5.8 -1.1M58.3 8.3q5.8 -5.2 11.6 0q3.5 3.5 6.4 -1.2M106.0 56.4q2.7 -2.5 5.4 0q1.6 1.6 3.0 -0.5M21.7 65.5q4.8 -4.4 9.7 0q2.9 2.9 5.3 -1.0M59.5 49.6q4.2 -3.8 8.4 0q2.5 2" fill="none" stroke="#A2E2DA" strokeOpacity={0.5} strokeWidth={0.9} />
      </pattern>
      <pattern id="pa-cliff" width={64} height={44} patternUnits="userSpaceOnUse">
        <path d="M44.1 -2L43.0 13.7L41.4 26.0L42.2 37.9L43.9 48.5M42.3 -2L42.1 6.1L43.7 15.1L44.7 24.0L43.8 37.3L44.9 43.4L44.0 51.5M15.7 -2L17.1 6.8L16.7 16.0L15.8 31.8L14.7 41.7L15.6 56.4M41.5 -2L42.1 7.4L41.4 19.2L41.8 33.0L43.5 39.0L42.9 48.5M53.4 -2L55.3 8.8L54.8 14.9L54.0 28.5L52.3 41.1L53.3 47.9M3.2 -2L5.0 13.3L5.1 22.2L6.5 36.8L8.3 48.6M18.8 -2L17.4 11.3L18.5 19.8L16.8 27.2L18.0 36.5L17.7 48.9M20.9 -2L21.9 13.0L23.0 20.0L23.4 35.4L22.9 42.5L21.1 52.5" fill="none" stroke="#2A1B14" strokeOpacity={0.22} strokeWidth={1} strokeLinejoin="round" />
        <path d="M45.5 4.6l0.6 11.9M43.7 2.5l-0.1 13.9M17.1 17.6l0.0 12.4M42.9 17.5l-0.5 7.4M54.8 10.5l-0.5 13.4M4.6 14.0l0.1 6.9M20.2 2.0l-0.4 13.7M22.3 8.4l0.8 8.5" fill="none" stroke="#FFFFFF" strokeOpacity={0.22} strokeWidth={0.9} strokeLinecap="round" />
        <path d="M38.3 2.3h14.2M5.0 22.5h14.3M10.5 26.2h7.0M18.2 29.2h8.5" fill="none" stroke="#2A1B14" strokeOpacity={0.2} strokeWidth={1} strokeLinecap="round" />
      </pattern>
      {/* parchment for signs and the cartouche */}
      <pattern id="pa-parch" width={80} height={80} patternUnits="userSpaceOnUse">
        <rect width={80} height={80} fill="#F2E2C0" />
        <g fill="#E1CA9C" fillOpacity={0.45}><ellipse cx="26.8" cy="54.4" rx="10.8" ry="4.1" /><ellipse cx="2.5" cy="31.8" rx="10.5" ry="4.3" /><ellipse cx="29.3" cy="49.9" rx="6.4" ry="4.2" /><ellipse cx="20.2" cy="4.8" rx="8.1" ry="3.0" /><ellipse cx="14.3" cy="30.7" rx="8.4" ry="5.1" /><ellipse cx="27.8" cy="13.2" rx="5.9" ry="5.8" /><ellipse cx="9.2" cy="45.1" rx="10.5" ry="4.8" /></g>
      </pattern>
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
  /** storybook ink outline width (0 = none): a warm brown line on every silhouette piece */
  ink?: number;
  children?: ReactNode;
}

export function Cutout({ d, rim = 3, depth = 2.5, material = "paper", shadow = "drop", lift = 1, grain = true, fuzz, ink = 0, children }: CutoutProps) {
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
      {ink > 0 && each({ fill: "none", stroke: "#3B2A20", strokeOpacity: 0.85, strokeWidth: ink, strokeLinejoin: "round" })}
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
