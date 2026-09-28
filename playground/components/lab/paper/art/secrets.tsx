// Secret-island dressing + region signs.
//
//   PaperDragon  an original, friendly little dragon (never a known character);
//                `silhouette` draws it as a flat fog-blue shape ("here be dragons")
//   FogIsland    the "?" island: a die-cut islet, a gold "?" standing on it,
//                low fog cutouts and a dragon silhouette in the mist
//   Ruins        broken fluted columns, a cracked arch, rubble and vines
//   SignBoard    a cut-cardboard sign on two posts with chunky outlined lettering
import { memo } from "react";
import { Art, type ArtProps, Cutout, Glint, LitEdge, StandUp } from "./materials";
import { familyRamp, P, R, HI, LIT, MID, SHADE, DEEP, type Ramp } from "./palette";
import { circ, ell, poly, rect, rrect } from "./geom";
import { Tuft } from "./bits";
import { PaperCloud } from "./sky";

// ── the dragon ─────────────────────────────────────────────────────────
const DRAGON = {
  body: ell(0, -22, 24, 16),
  neck: "M8 -32 Q14 -44 22 -46 L30 -40 Q20 -36 18 -24Z",
  head: circ(26, -50, 12.5),
  snout: ell(36, -45, 10, 7),
  hornL: poly(19, -58, 17, -70, 25, -61),
  hornR: poly(27, -61, 30, -72, 33, -59),
  wing: "M-6 -34 Q-12 -64 6 -72 Q4 -62 11 -58 Q10 -52 17 -50 Q8 -40 -6 -34Z",
  tail: "M-20 -16 Q-40 -12 -44 -28 Q-46 -36 -40 -38 Q-42 -30 -36 -26 Q-30 -22 -20 -26Z",
  tip: poly(-40, -38, -48, -44, -38, -48, -36, -40),
  legs: rrect(-14, -10, 9, 10, 3) + rrect(8, -10, 9, 10, 3),
};
export const PaperDragon = memo(function PaperDragon({ silhouette = false, ramp = R.teal, ...p }: ArtProps & { silhouette?: boolean; ramp?: Ramp }) {
  const all = [DRAGON.body, DRAGON.neck, DRAGON.head, DRAGON.snout, DRAGON.hornL, DRAGON.hornR, DRAGON.wing, DRAGON.tail, DRAGON.tip, DRAGON.legs];
  if (silhouette) {
    return (
      <Art design={74} {...p}>
        <g opacity={0.55}>{all.map((d, i) => <path key={i} d={d} fill="#5E6E9E" />)}</g>
        <circle cx={29} cy={-52} r={2.2} fill="#FFF3A6" />
      </Art>
    );
  }
  return (
    <Art design={74} {...p}>
      <StandUp d={all} foot={22} rim={2.2} depth={1.8}>
        <path d={DRAGON.tail} fill={ramp[MID]} />
        <path d={DRAGON.tip} fill={R.gold[LIT]} />
        <path d={DRAGON.legs} fill={ramp[SHADE]} />
        <path d={DRAGON.body} fill={ramp[MID]} />
        <path d="M-24 -22 Q-22 -36 0 -38 Q-14 -32 -16 -18Z" fill={ramp[LIT]} />
        <path d="M18 -30 Q22 -18 10 -8 Q20 -10 23 -20Z" fill={ramp[SHADE]} />
        <path d={ell(5, -17, 13, 9)} fill={R.cream[LIT]} />
        <path d="M-5 -20 H15 M-6 -15 H16 M-3 -10 H13" stroke={R.cream[SHADE]} strokeWidth={0.9} />
        {/* back spikes */}
        <path d="M-18 -34 L-16 -40 L-12 -36Z M-10 -37 L-7 -44 L-4 -38Z M-2 -38 L2 -45 L5 -38Z" fill={R.gold[LIT]} />
        {/* wing: membrane + bones */}
        <path d={DRAGON.wing} fill={ramp[HI]} />
        <path d="M-6 -34 Q-12 -64 6 -72 Q0 -56 -6 -34Z" fill={ramp[LIT]} />
        <path d="M-6 -34 L6 -72 M-6 -34 L11 -58 M-6 -34 L17 -50" stroke={ramp[SHADE]} strokeWidth={1.2} strokeLinecap="round" />
        {/* neck, head, snout */}
        <path d={DRAGON.neck} fill={ramp[MID]} />
        <path d={DRAGON.head} fill={ramp[MID]} />
        <path d={DRAGON.snout} fill={ramp[LIT]} />
        <path d="M15 -52 Q17 -61 26 -62 Q20 -58 19 -50Z" fill={ramp[HI]} />
        <path d={DRAGON.hornL + DRAGON.hornR} fill={R.gold[LIT]} />
        <path d={poly(25, -61, 21, -69, 23, -60)} fill={R.gold[SHADE]} />
        <circle cx={40} cy={-47} r={1} fill={ramp[DEEP]} />
        <circle cx={44} cy={-46} r={1} fill={ramp[DEEP]} />
        <path d="M31 -41 Q37 -38 43 -42" fill="none" stroke={ramp[DEEP]} strokeWidth={1.4} strokeLinecap="round" />
        <circle cx={27} cy={-52} r={4.4} fill="#FFFFFF" />
        <circle cx={28.2} cy={-51.6} r={2.6} fill={P.ink} />
        <circle cx={27.1} cy={-53} r={1} fill="#FFFFFF" />
        <ellipse cx={31} cy={-43} rx={2.6} ry={1.4} fill={R.pink[LIT]} opacity={0.8} />
      </StandUp>
    </Art>
  );
});

// ── the "?" island ─────────────────────────────────────────────────────
export const FogIsland = memo(function FogIsland({ dragon = true, ...p }: ArtProps & { dragon?: boolean }) {
  const isle = "M-70 0 Q-72 -14 -40 -20 Q0 -26 40 -20 Q72 -14 70 0 Q60 14 0 16 Q-60 14 -70 0Z";
  const grass = "M-60 -2 Q-60 -12 -34 -16 Q0 -21 34 -16 Q60 -12 60 -2 Q50 8 0 10 Q-50 8 -60 -2Z";
  return (
    <Art design={96} {...p}>
      <Cutout d={isle} rim={3} depth={4} shadow="drop" lift={0.6}>
        <path d={isle} fill={R.sand[LIT]} />
        <path d={grass} fill="url(#pa-grass)" />
        <path d="M-60 -2 Q-60 -12 -34 -16 Q-10 -19 0 -20 Q-40 -12 -44 4Z" fill="#FFFFFF" opacity={0.18} />
      </Cutout>
      {dragon && <PaperDragon silhouette x={34} y={-6} size={50} />}
      {/* the gold "?" cut from thick card */}
      <g transform="translate(-6 -2)">
        <ellipse cx={4} cy={1} rx={16} ry={4} fill={P.shadow} opacity={0.2} />
        <text x={3} y={2} textAnchor="middle" fontSize={62} fill={R.gold[DEEP]} fontFamily="var(--paper-display), system-ui" stroke={R.gold[DEEP]} strokeWidth={8} strokeLinejoin="round">?</text>
        <text x={0} y={-1} textAnchor="middle" fontSize={62} fill={R.gold[LIT]} fontFamily="var(--paper-display), system-ui" stroke="#FFFFFF" strokeWidth={7} strokeLinejoin="round" paintOrder="stroke">?</text>
        <text x={0} y={-1} textAnchor="middle" fontSize={62} fill="url(#pa-gloss)" fontFamily="var(--paper-display), system-ui">?</text>
        <Glint x={-8} y={-38} r={3} streak={false} />
      </g>
      {/* low fog drifting across the front */}
      <PaperCloud variant={1} x={-48} y={10} size={22} />
      <PaperCloud variant={2} x={40} y={14} size={20} />
      <Tuft x={-40} y={-10} s={1} />
      <Tuft x={50} y={-8} s={0.9} />
    </Art>
  );
});

// ── ruins ──────────────────────────────────────────────────────────────
function Column({ x, h, broken }: { x: number; h: number; broken: boolean }) {
  const w = 7;
  const top = broken ? `L${x + w} ${-h + 4} L${x + 3} ${-h - 2} L${x} ${-h + 3} L${x - 4} ${-h - 3} L${x - w} ${-h + 2}` : `L${x + w} ${-h} L${x - w} ${-h}`;
  const shaft = `M${x - w} 0 L${x + w} 0 ${top}Z`;
  return {
    sil: shaft + rect(x - w - 3, -4, w * 2 + 6, 4) + (broken ? "" : rect(x - w - 3, -h - 5, w * 2 + 6, 5)),
    draw: (
      <g>
        <path d={shaft} fill={R.cream[LIT]} />
        <path d={`M${x + 2} 0 L${x + w} 0 L${x + w} ${-h + 4} L${x + 2} ${-h + 1}Z`} fill={R.cream[SHADE]} />
        <path d={`M${x - 4} -4 V${-h + 4} M${x} -4 V${-h + 5} M${x + 4} -4 V${-h + 5}`} stroke={R.cream[MID]} strokeWidth={1} />
        <path d={`M${x - 3.2} -4 V${-h + 4}`} stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={0.7} />
        <path d={rect(x - w - 3, -4, w * 2 + 6, 4)} fill={R.cream[MID]} />
        {!broken && <path d={rect(x - w - 3, -h - 5, w * 2 + 6, 5)} fill={R.cream[HI]} />}
        {!broken && <path d={rect(x + w - 2, -h - 5, 5, 5)} fill={R.cream[SHADE]} />}
        {broken && <path d={`M${x - 2} ${-h + 10} l3 5 l-2 4`} stroke={R.cream[DEEP]} strokeWidth={0.9} fill="none" />}
      </g>
    ),
  };
}
export const Ruins = memo(function Ruins(p: ArtProps) {
  const cols = [Column({ x: -40, h: 44, broken: false }), Column({ x: -20, h: 26, broken: true }), Column({ x: 44, h: 34, broken: true })];
  const arch = "M-2 0 V-34 Q-2 -52 14 -52 Q30 -52 30 -34 V0 H22 V-32 Q22 -42 14 -42 Q6 -42 6 -32 V0Z";
  const gap = "M20 -50 L26 -45 L23 -40 L27 -36 L30 -40 L30 -46 Q28 -50 24 -52Z";
  const rubble = [rrect(8, -6, 9, 6, 1.2), rrect(-8, -5, 7, 5, 1), rrect(30, -5, 8, 5, 1)];
  const base = ell(0, 2, 58, 8);
  const leaves = (d: string, pts: [number, number][]) => (
    <g>
      <path d={d} fill="none" stroke={R.leaf[SHADE]} strokeWidth={1.2} strokeLinecap="round" />
      {pts.map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx={2.4} ry={1.4} transform={`rotate(${i % 2 ? 35 : -35} ${x} ${y})`} fill={i % 2 ? R.leaf[MID] : R.leaf[LIT]} />)}
    </g>
  );
  return (
    <Art design={62} {...p}>
      <Cutout d={base} rim={2} depth={2} shadow="none">
        <path d={base} fill={R.rock[LIT]} />
        <path d="M-50 2 H-20 M-30 -3 L-26 6 M0 -4 L4 8 M20 0 H48 M30 -4 L28 6" stroke={R.rock[SHADE]} strokeWidth={1} />
      </Cutout>
      <StandUp d={[...cols.map((c) => c.sil), arch, ...rubble]} foot={50} rim={2} depth={1.8}>
        {cols.map((c, i) => <g key={i}>{c.draw}</g>)}
        <path d={arch} fill={R.cream[LIT]} />
        <path d="M22 0 V-32 Q22 -42 14 -42 L14 -52 Q30 -52 30 -34 V0Z" fill={R.cream[SHADE]} />
        <path d={arch} fill="url(#pa-stone)" />
        <path d={gap} fill={P.die} />
        <path d="M6 -40 L10 -34 L8 -28 L12 -22" stroke={R.cream[DEEP]} strokeWidth={1} fill="none" strokeLinecap="round" />
        <LitEdge d="M-1.6 -2 V-34 Q-1.6 -51 13 -51.6" w={1.1} />
        {rubble.map((d, i) => <path key={i} d={d} fill={i === 1 ? R.cream[MID] : R.cream[LIT]} />)}
        {leaves("M-44 0 Q-48 -16 -40 -28 Q-36 -36 -42 -44", [[-46, -10], [-43, -18], [-39, -26], [-38, -34], [-41, -40]])}
        {leaves("M24 0 Q20 -14 26 -24 Q30 -32 24 -40", [[22, -8], [23, -16], [27, -24], [27, -32]])}
        <Tuft x={-30} y={0} s={0.9} />
        <Tuft x={4} y={0} s={0.8} />
        <Tuft x={52} y={0} s={0.9} />
      </StandUp>
    </Art>
  );
});

// ── region sign ────────────────────────────────────────────────────────
/** Approximate text width for Lilita One at `fs` (no DOM measuring). */
const textW = (s: string, fs: number) => [...s].reduce((w, c) => w + (c === " " ? 0.28 : /[mw]/i.test(c) ? 0.78 : /[il]/.test(c) ? 0.3 : 0.56), 0) * fs;

/** A cut-cardboard sign on two posts. `family` picks the board colour. Design
 *  units: board ~30 tall, posts 16 below; its width follows the text. */
export const SignBoard = memo(function SignBoard({ text, family, ramp, ...p }: ArtProps & { text: string; family?: string; ramp?: Ramp }) {
  const rp = ramp ?? (family ? familyRamp(family) : R.orange);
  const fs = 20;
  const w = Math.max(60, textW(text, fs) + 28), h = 30, x0 = -w / 2, top = -16 - h;
  const board = rrect(x0, top, w, h, 8);
  const posts = [x0 + 12, -x0 - 12];
  return (
    <Art design={52} {...p}>
      {posts.map((x) => (
        <g key={x}>
          <ellipse cx={x + 1} cy={0.6} rx={5} ry={1.6} fill={P.shadow} opacity={0.22} />
          <path d={rect(x - 2.6, -20, 5.2, 20)} fill={R.wood[MID]} stroke={P.die} strokeWidth={1.6} />
          <path d={rect(x - 2.6, -20, 2, 20)} fill={R.wood[LIT]} />
        </g>
      ))}
      <Cutout d={board} rim={2.6} depth={3.4} material="card" shadow="drop" lift={0.5}>
        <path d={board} fill={rp[MID]} />
        <path d={rrect(x0 + 3, top + 3, w - 6, h - 6, 5.5)} fill={rp[LIT]} />
        <path d={rrect(x0 + 3, top + 3, w - 6, 7, 3.5)} fill={rp[HI]} opacity={0.55} />
        {[x0 + 7, -x0 - 7].map((x) => <circle key={x} cx={x} cy={top + h / 2} r={1.6} fill={rp[DEEP]} />)}
        <text x={0} y={top + h / 2 + fs * 0.35} textAnchor="middle" fontSize={fs} fill="#FFFFFF" stroke={rp[DEEP]} strokeWidth={4.2}
          strokeLinejoin="round" paintOrder="stroke" fontFamily="var(--paper-display), system-ui" letterSpacing={0.4}>{text}</text>
      </Cutout>
    </Art>
  );
});

