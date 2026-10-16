// Storybook world terrain (paper-map-reference): raised land slabs with thick
// layered cliff walls, waterfalls, floating islands with hanging rock, sea
// stacks, mesas, lava rivers and rails. One key light (top-left), cutout
// thickness, contact/cast shadows, a warm ink line on silhouettes.
//
// LandSlab / Waterfall / LavaRiver / Rails draw in the PARENT's units (they
// follow a region path); the rest are <Art> props (base-centre, `size` px tall).
import { memo, type ReactNode } from "react";
import { Art, type ArtProps, Cutout, StandUp } from "./materials";
import { Broadleaf, Conifer } from "./world-flora";
import { INK, S, HI, LIT, MID, SHADE, DEEP, type Ramp } from "./palette";
import { blob, ell, poly, rng } from "./geom";


/** An organic coastline through control points: each edge gets a jittered
 *  midpoint, then a closed Catmull-Rom curve — bays and headlands, never blobs. */
export function landPath(pts: [number, number][], seed = 1, amp = 14): string {
  const r = rng(seed);
  const all: [number, number][] = [];
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    all.push(p);
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1;
    const j = (r() - 0.5) * 2 * amp;
    all.push([mx - (dy / L) * j, my + (dx / L) * j]);
  });
  const n = all.length, f = (v: number) => v.toFixed(1);
  let d = `M${f(all[0][0])} ${f(all[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = all[(i - 1 + n) % n], p1 = all[i], p2 = all[(i + 1) % n], p3 = all[(i + 2) % n];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + "Z";
}

export type SlabTop = "grass" | "autumn" | "snow" | "desert" | "lava" | "night" | "reef";
const TOPS: Record<SlabTop, { fill: string; top: Ramp; cliff: Ramp }> = {
  grass: { fill: "url(#pa-s-grass)", top: S.grass, cliff: S.cliff },
  autumn: { fill: "url(#pa-s-autumn)", top: S.autumn, cliff: S.cliff },
  snow: { fill: "url(#pa-s-snow)", top: S.snow, cliff: S.stone },
  desert: { fill: "url(#pa-s-desert)", top: S.sand, cliff: S.sand },
  lava: { fill: "url(#pa-s-lavarock)", top: S.basalt, cliff: S.basalt },
  night: { fill: "url(#pa-s-night)", top: S.night, cliff: S.night },
  reef: { fill: "url(#pa-s-reef)", top: S.reef, cliff: S.reef },
};

/**
 * A raised land slab: the region outline `d` extruded `depth` down as a
 * stack of cliff bands (paper layers: lit near the lip, dark at the sea),
 * vertical cracks, foam at the waterline, a shadow on the sea, then the top
 * surface with an overhanging grass lip and an ink edge.
 */
export const LandSlab = memo(function LandSlab({ d, depth = 40, top = "grass", layers = 5, foam = true, lip = true, ink = 1.4, children }: {
  d: string; depth?: number; top?: SlabTop; layers?: number; foam?: boolean; lip?: boolean; ink?: number; children?: ReactNode;
}) {
  const t = TOPS[top];
  const band = [t.cliff[DEEP], t.cliff[SHADE], t.cliff[MID], t.cliff[MID], t.cliff[LIT], t.cliff[HI]];
  const ks = Array.from({ length: layers }, (_, i) => layers - i);   // bottom band first
  return (
    <g>
      {foam && <path d={d} transform={`translate(12 ${depth + 16})`} fill="#1B3A5E" opacity={0.3} />}
      {foam && <path d={d} transform={`translate(0 ${depth})`} fill="none" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={30} strokeLinejoin="round" />}
      {foam && <path d={d} transform={`translate(0 ${depth})`} fill="none" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={8} strokeLinejoin="round" />}
      {ks.map((k) => {
        const c = band[Math.min(band.length - 1, Math.round(((layers - k) / Math.max(1, layers - 1)) * (band.length - 2)))];
        const tr = `translate(0 ${((depth * k) / layers).toFixed(1)})`;
        return (
          <g key={k} transform={tr}>
            <path d={d} fill={c} stroke={k === layers ? INK : c} strokeOpacity={k === layers ? 0.7 : 1} strokeWidth={k === layers ? ink : 1} strokeLinejoin="round" />
            <path d={d} fill="url(#pa-cliff)" />
          </g>
        );
      })}
      {/* the lit lip and the overhanging grass fringe */}
      <path d={d} fill="none" stroke={t.cliff[HI]} strokeWidth={4} strokeLinejoin="round" transform="translate(0 2)" />
      {lip && <path d={d} fill="none" stroke={t.top[SHADE]} strokeWidth={8} strokeDasharray="0.1 7" strokeLinecap="round" transform="translate(0 1.6)" />}
      {lip && <path d={d} fill="none" stroke={t.top[MID]} strokeWidth={7} strokeDasharray="0.1 7" strokeLinecap="round" />}
      <path d={d} fill={t.fill} />
      <path d={d} fill="url(#pa-fibre)" />
      <path d={d} fill="none" stroke={t.top[HI]} strokeOpacity={0.55} strokeWidth={2} strokeLinejoin="round" transform="translate(-1 -1)" />
      <path d={d} fill="none" stroke={INK} strokeOpacity={0.6} strokeWidth={ink * 0.8} strokeLinejoin="round" />
      {children}
    </g>
  );
});

/** Falling water off a cliff lip at (x, y): curtain streaks, foam and mist at the base. */
export function Waterfall({ x, y, h, w = 16 }: { x: number; y: number; h: number; w?: number }) {
  const curtain = `M${x - w / 2} ${y} H${x + w / 2} Q${x + w / 2 + 2} ${y + h * 0.6} ${x + w / 2 + 3} ${y + h} H${x - w / 2 - 3} Q${x - w / 2 - 2} ${y + h * 0.6} ${x - w / 2} ${y}Z`;
  const streaks = Array.from({ length: Math.max(3, Math.round(w / 3.4)) }, (_, i) => {
    const sx = x - w / 2 + 2 + (i * (w - 4)) / Math.max(1, Math.round(w / 3.4) - 1);
    return `M${sx} ${y + 2} Q${sx + 0.6} ${y + h * 0.5} ${sx + (sx < x ? -1.5 : 1.5)} ${y + h - 2}`;
  }).join("");
  return (
    <g pointerEvents="none">
      <path d={curtain} fill={S.sea[LIT]} stroke={INK} strokeOpacity={0.45} strokeWidth={0.9} />
      <path d={`M${x - w / 2} ${y} H${x - w / 6} L${x - w / 6 - 1} ${y + h} H${x - w / 2 - 3} Q${x - w / 2 - 2} ${y + h * 0.6} ${x - w / 2} ${y}Z`} fill={S.sea[HI]} />
      <path d={streaks} stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={1.3} fill="none" strokeLinecap="round" />
      <path d={`M${x - w / 2} ${y + 1} H${x + w / 2}`} stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" />
      <path d={blob([[x - w * 0.45, y + h, w * 0.3], [x, y + h + 1, w * 0.38], [x + w * 0.45, y + h, w * 0.3], [x - w * 0.8, y + h + 2, w * 0.2], [x + w * 0.8, y + h + 2, w * 0.22]])} fill="#FFFFFF" />
      <path d={ell(x, y + h + 4, w * 1.2, w * 0.25)} fill="#FFFFFF" opacity={0.45} />
    </g>
  );
}

/** A glowing lava river along a path (ground layer, parent units). */
export function LavaRiver({ d, w = 10 }: { d: string; w?: number }) {
  return (
    <g pointerEvents="none" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={S.lava[MID]} strokeOpacity={0.35} strokeWidth={w * 2.2} />
      <path d={d} stroke={S.basalt[DEEP]} strokeWidth={w + 3} />
      <path d={d} stroke={S.lava[SHADE]} strokeWidth={w} />
      <path d={d} stroke={S.lava[MID]} strokeWidth={w * 0.62} />
      <path d={d} stroke={S.lava[LIT]} strokeWidth={w * 0.3} strokeDasharray={`${w * 1.4} ${w * 0.8}`} />
      <path d={d} stroke={S.lava[HI]} strokeWidth={w * 0.12} />
    </g>
  );
}

/** A railway along a path: ties, then a steel band whose middle is re-painted
 *  in the ground colour so two rails remain. */
export function Rails({ d, ground = S.sand[LIT], w = 8 }: { d: string; ground?: string; w?: number }) {
  return (
    <g pointerEvents="none" fill="none" strokeLinejoin="round">
      <path d={d} stroke="#2A1B14" strokeOpacity={0.25} strokeWidth={w + 5} transform="translate(1.4 2)" />
      <path d={d} stroke={S.wood[SHADE]} strokeWidth={w + 4} strokeDasharray="2.4 3.2" />
      <path d={d} stroke="#6E6A70" strokeWidth={w} />
      <path d={d} stroke={ground} strokeWidth={w - 2.6} strokeOpacity={0.9} />
      <path d={d} stroke={S.wood[MID]} strokeWidth={w - 2.6} strokeDasharray="2.4 3.2" strokeOpacity={0.9} />
    </g>
  );
}

// ── stand-up terrain props ─────────────────────────────────────────────

/** A floating island: a small slab with trees on top, rock hanging beneath,
 *  its shadow far below on the sea. design H 120 (top at −100, rock to +20). */
export const FloatingIsland = memo(function FloatingIsland({ top = "grass", trees = true, children, ...p }: ArtProps & { top?: SlabTop; trees?: boolean; children?: ReactNode }) {
  const t = TOPS[top];
  const plate = "M-46 -60 Q-44 -72 -20 -76 Q10 -80 34 -74 Q50 -68 46 -58 Q30 -48 0 -48 Q-34 -48 -46 -60Z";
  const hang = "M-44 -56 L-30 -34 L-22 -40 L-12 -8 L-4 -20 L4 10 L10 -14 L20 -4 L26 -30 L36 -26 L44 -56Z";
  const drips = poly(-26, -30, -22, -18, -18, -30) + poly(14, -6, 16, 6, 19, -4);
  return (
    <Art design={120} {...p}>
      <ellipse cx={30} cy={36} rx={42} ry={8} fill="#1B3A5E" opacity={0.22} />
      <Cutout d={[hang, drips]} rim={2} depth={2} shadow="none" ink={1.1}>
        <path d={hang} fill={t.cliff[SHADE]} />
        <path d="M-44 -56 L-30 -34 L-22 -40 L-12 -8 L-8 -30 L-14 -56Z" fill={t.cliff[LIT]} />
        <path d="M10 -14 L20 -4 L26 -30 L36 -26 L44 -56 L20 -56Z" fill={t.cliff[DEEP]} />
        <path d={hang} fill="url(#pa-cliff)" />
        <path d={drips} fill={t.cliff[MID]} />
        <path d="M-2 -52 Q-4 -40 0 -30 M18 -52 Q20 -44 16 -36" stroke={S.forest[MID]} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      </Cutout>
      <Cutout d={plate} rim={2} depth={3} shadow="none" ink={1.2}>
        <path d={plate} fill={t.cliff[MID]} transform="translate(0 6)" />
        <path d={plate} fill={t.fill} />
        <path d="M-46 -60 Q-44 -72 -20 -76 Q-30 -68 -34 -58Z" fill="#FFFFFF" opacity={0.18} />
      </Cutout>
      {trees && <>
        <Conifer x={-26} y={-60} size={26} />
        <Conifer x={-12} y={-66} size={32} />
        <Broadleaf x={30} y={-62} size={24} />
      </>}
      {children}
    </Art>
  );
});

/** A rocky sea stack with a grassy cap and a foam ring. design H 70. */
export const SeaStack = memo(function SeaStack({ grass = true, ...p }: ArtProps & { grass?: boolean }) {
  const rock = "M-14 0 L-16 -30 L-10 -52 L-2 -62 L8 -58 L14 -40 L16 -12 L18 0Z";
  return (
    <Art design={70} {...p}>
      <ellipse cx={2} cy={1} rx={24} ry={5} fill="#FFFFFF" opacity={0.55} />
      <path d="M-26 2 Q0 -3 28 2" stroke="#FFFFFF" strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <StandUp d={rock} foot={14} rim={2} depth={2} ink={1.2}>
        <path d={rock} fill={S.stone[MID]} />
        <path d="M-14 0 L-16 -30 L-10 -52 L-2 -62 L-4 -30 L-6 0Z" fill={S.stone[LIT]} />
        <path d="M6 0 L8 -30 L8 -58 L14 -40 L16 -12 L18 0Z" fill={S.stone[SHADE]} />
        <path d={rock} fill="url(#pa-cliff)" />
        <path d="M-12 -20 H10 M-12 -38 H12" stroke={S.stone[DEEP]} strokeOpacity={0.5} strokeWidth={1} />
        {grass && <path d="M-10 -52 L-2 -62 L8 -58 L10 -54 Q2 -50 -4 -52 Q-8 -48 -10 -52Z" fill={S.grass[LIT]} />}
      </StandUp>
    </Art>
  );
});

/** A desert mesa / butte: horizontal strata bands, eroded top edge, talus at the foot. design H 70. */
export const Mesa = memo(function Mesa({ wide = false, ...p }: ArtProps & { wide?: boolean }) {
  const w = wide ? 30 : 18;
  const body = `M${-w - 16} 0 Q${-w - 8} -8 ${-w - 4} -14 L${-w} -52 L${-w + 4} -58 L${-w * 0.4} -60 L${-w * 0.2} -57 L${w * 0.3} -61 L${w - 2} -58 L${w + 2} -50 L${w + 6} -14 Q${w + 12} -6 ${w + 20} 0Z`;
  const band = (y0: number, y1: number, c: string, i: number) => <path key={i} d={`M${-w - 12} ${y0} L${-w - 10} ${y1} L${w + 12} ${y1 - 1} L${w + 14} ${y0}Z`} fill={c} />;
  return (
    <Art design={70} {...p}>
      <StandUp d={body} foot={w + 12} rim={2} depth={2} ink={1.2}>
        <path d={body} fill={S.sand[MID]} />
        {band(-46, -40, S.sand[SHADE], 0)}{band(-30, -24, S.cliff[MID], 1)}{band(-16, -12, S.sand[SHADE], 2)}
        <path d={`M${-w - 16} 0 Q${-w - 8} -8 ${-w - 4} -14 L${-w} -52 L${-w + 4} -58 L${-w * 0.4} -60 L${-w * 0.5} 0Z`} fill={S.sand[HI]} opacity={0.45} />
        <path d={`M${w * 0.35} 0 L${w * 0.3} -61 L${w - 2} -58 L${w + 2} -50 L${w + 6} -14 Q${w + 12} -6 ${w + 20} 0Z`} fill={S.cliff[SHADE]} opacity={0.55} />
        <path d={`M${-w * 0.6} -50 L${-w * 0.55} -30 M${w * 0.1} -56 L${w * 0.15} -34 M${w * 0.7} -48 L${w * 0.65} -22`} stroke={S.sand[DEEP]} strokeOpacity={0.6} strokeWidth={1.1} fill="none" />
        <path d={`M${-w} -52 L${-w + 4} -58 L${-w * 0.4} -60 L${-w * 0.2} -57 L${w * 0.3} -61 L${w - 2} -58`} stroke={S.sand[HI]} strokeWidth={2.2} fill="none" strokeLinejoin="round" />
        <path d={`M${-w - 12} -2 q4 -3 8 0 M${w + 6} -2 q4 -3 8 0`} stroke={S.sand[SHADE]} strokeWidth={1.4} fill="none" />
      </StandUp>
    </Art>
  );
});

/** A jagged range of snowy peaks (the snow plateau's back wall). design H 90. */
export const SnowPeaks = memo(function SnowPeaks(p: ArtProps) {
  const peaks: [number, number, number][] = [[-60, 26, 58], [-30, 24, 82], [0, 30, 70], [30, 26, 88], [60, 24, 60]];
  const sil = peaks.map(([x, w, h]) => poly(x - w, 0, x - w * 0.3, -h * 0.7, x, -h, x + w * 0.4, -h * 0.62, x + w, 0));
  return (
    <Art design={90} {...p}>
      <StandUp d={sil} foot={80} rim={2} depth={2} ink={1.2}>
        {peaks.map(([x, w, h], i) => (
          <g key={i}>
            <path d={sil[i]} fill={S.stone[MID]} />
            <path d={poly(x, -h, x + w * 0.4, -h * 0.62, x + w, 0, x + w * 0.1, 0)} fill={S.stone[SHADE]} />
            <path d={poly(x - w * 0.3, -h * 0.7, x, -h, x + w * 0.4, -h * 0.62, x + w * 0.25, -h * 0.45, x + w * 0.05, -h * 0.55, x - w * 0.12, -h * 0.4, x - w * 0.35, -h * 0.5)} fill="#FFFFFF" />
            <path d={poly(x, -h, x + w * 0.4, -h * 0.62, x + w * 0.25, -h * 0.45, x + w * 0.1, -h * 0.6)} fill={S.snow[SHADE]} />
          </g>
        ))}
        <path d="M-86 0 Q-40 -16 0 -10 Q40 -16 86 0Z" fill={S.snow[LIT]} />
      </StandUp>
    </Art>
  );
});

/** A small black volcanic cone with a glowing crater and a lava streak. design H 50. */
export const LavaCone = memo(function LavaCone(p: ArtProps) {
  const cone = "M-30 0 L-8 -40 L8 -40 L30 0Z";
  return (
    <Art design={50} {...p}>
      <StandUp d={cone} foot={28} rim={1.8} depth={1.6} ink={1.1}>
        <path d={cone} fill={S.stone[SHADE]} />
        <path d="M-30 0 L-8 -40 L-2 -40 L-12 0Z" fill={S.stone[MID]} />
        <path d="M-22 -14 L-12 -18 M-16 -28 L-8 -30 M10 -22 L18 -20" stroke={S.stone[DEEP]} strokeWidth={1} />
        <path d="M8 -40 L30 0 L14 0 L4 -40Z" fill={S.basalt[DEEP]} />
        <path d={ell(0, -40, 8, 2.4)} fill={S.lava[MID]} />
        <path d="M-2 -38 Q-6 -24 -2 -12 Q1 -4 -4 0" stroke={S.lava[MID]} strokeWidth={3} fill="none" strokeLinecap="round" />
        <path d="M-2 -38 Q-6 -24 -2 -12" stroke={S.lava[HI]} strokeWidth={1} fill="none" strokeLinecap="round" />
      </StandUp>
      <circle cx={0} cy={-44} r={12} fill="url(#pa-glow)" opacity={0.7} />
      <path d="M2 -48 q-3 -6 1 -10 q-1 4 3 6" stroke={S.stone[LIT]} strokeOpacity={0.7} strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </Art>
  );
});
