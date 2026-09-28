// The six family set-pieces — each family's signature mechanism as a big
// stand-up paper landmark (ref-paper.md "Landmarks": 3–6 shading facets,
// patterns, windows, doors, bricks). Base-centre at (0, 0), up negative.
//
//   perception      LighthouseEye   a banded lighthouse whose lamp is an eye, beams out
//   sequence        ClockTower      brick clock tower + a token train on its rail
//   generative      KilnVolcano     basalt cone with a brick kiln collar, sample puffs
//   representation  MirrorTowers    twin towers, mirror discs, reflected in a lake
//   structure       CrystalLattice  crystal cluster on a cave rock, gold node-links
//   decision        DiceKeep        a keep with turrets, a giant die on the tower
import { memo, useId, type ComponentType } from "react";
import { Art, type ArtProps, Cutout, Glint, LitEdge, StandUp } from "./materials";
import { P, R, HI, LIT, MID, SHADE, DEEP, type Ramp } from "./palette";
import { blob, circ, ell, poly, rect, rrect } from "./geom";
import { Boulder, Door, Merlons, merlonsD, Pennant, SquareWin, Tuft, Win } from "./bits";

type Pt = [number, number];
const rot = (pts: Pt[], a: number, ox: number, oy: number): Pt[] => {
  const c = Math.cos(a), s = Math.sin(a);
  return pts.map(([x, y]) => [ox + x * c - y * s, oy + x * s + y * c]);
};
const polyP = (pts: Pt[]) => poly(...pts.flat());

// ── 1 · perception: the lighthouse eye ──────────────────────────────────
const LH = { H: 232 };
export const LighthouseEye = memo(function LighthouseEye(p: ArtProps) {
  // tower: 5 bands from y -30 to -150, tapering 24 → 16 half-width
  const hw = (y: number) => 24 - ((-30 - y) / 120) * 8;
  const bands = [0, 1, 2, 3, 4].map((i) => {
    const y0 = -30 - i * 24, y1 = y0 - 24;
    return { i, d: poly(-hw(y0), y0, hw(y0), y0, hw(y1), y1, -hw(y1), y1), y0, y1 };
  });
  const tower = poly(-24, -28, 24, -28, 16, -150, -16, -150);
  const mound = poly(-74, 0, -66, -16, -48, -30, -20, -37, 14, -37, 42, -30, 62, -17, 74, 0);
  const cottage = [poly(-62, -26, -38, -26, -38, -46, -62, -46), poly(-66, -44, -50, -58, -34, -44)];
  const sil = [mound, tower, rect(-26, -157, 52, 8), rect(-15, -193, 30, 38), poly(-19, -191, 0, -216, 19, -191), circ(0, -219, 4.5), ...cottage];
  return (
    <Art design={LH.H} {...p}>
      {/* the beams: light, no paper — drawn under the cutout */}
      <g opacity={0.9}>
        <path d="M-6 -181 L-118 -214 Q-124 -181 -118 -150 Z" fill="url(#pa-beam)" />
        <g transform="scale(-1 1)"><path d="M-6 -181 L-118 -214 Q-124 -181 -118 -150 Z" fill="url(#pa-beam)" /></g>
      </g>
      <StandUp d={sil} foot={70} rim={3} depth={3}>
        {/* rock mound: lit left, face, shaded right, then grit + ledges */}
        <path d={mound} fill={R.rock[MID]} />
        <path d={poly(-74, 0, -66, -16, -48, -30, -20, -37, -10, -20, -30, 0)} fill={R.rock[LIT]} />
        <path d={poly(22, 0, 28, -17, 14, -37, 42, -30, 62, -17, 74, 0)} fill={R.rock[SHADE]} />
        <path d={poly(40, 0, 50, -10, 62, -17, 74, 0)} fill={R.rock[DEEP]} opacity={0.6} />
        <path d={mound} fill="url(#pa-grit)" />
        <LitEdge d="M-70 -8 L-64 -17 L-47 -30 L-20 -37" w={1.6} />
        <path d="M-40 -10 L-30 -18 M8 -8 L16 -20 L12 -28 M46 -8 L52 -16" fill="none" stroke={R.rock[DEEP]} strokeWidth={1.2} strokeLinecap="round" />
        {/* grass cap along the crest */}
        <path d="M-50 -29 Q-36 -38 -20 -38 L14 -38 Q30 -36 44 -30 Q30 -31 20 -27 Q6 -31 -8 -28 Q-22 -32 -34 -26 Q-42 -29 -50 -29Z" fill={R.grass[LIT]} />
        <path d="M14 -38 Q30 -36 44 -30 Q30 -31 20 -27 Q18 -33 14 -38Z" fill={R.grass[SHADE]} />
        <Tuft x={-56} y={-20} s={1.1} />
        <Tuft x={34} y={-28} s={1.2} />
        <Tuft x={58} y={-12} s={1} />
        <Boulder x={-18} y={-4} r={8} />
        <Boulder x={36} y={-2} r={6} />

        {/* keeper's cottage */}
        <path d={cottage[0]} fill={R.cream[LIT]} />
        <path d={poly(-44, -26, -38, -26, -38, -46, -44, -46)} fill={R.cream[SHADE]} />
        <path d={cottage[0]} fill="url(#pa-occl)" />
        <path d={poly(-66, -44, -50, -58, -50, -44)} fill={R.red[LIT]} />
        <path d={poly(-50, -58, -34, -44, -50, -44)} fill={R.red[SHADE]} />
        <path d={poly(-66, -44, -50, -58, -34, -44)} fill="url(#pa-tiles)" />
        <SquareWin x={-58} y={-40} w={6} h={6} />
        <rect x={-48} y={-38} width={5} height={12} fill={R.wood[MID]} />

        {/* the banded tower */}
        {bands.map((b) => <path key={b.i} d={b.d} fill={b.i % 2 ? R.cream[LIT] : R.red[LIT]} />)}
        <path d={tower} fill="url(#pa-turn)" />
        <path d={poly(8, -28, 24, -28, 16, -150, 5, -150)} fill={P.shadow} opacity={0.14} />
        <LitEdge d="M-23 -32 L-15.6 -148" w={1.8} opacity={0.8} />
        {bands.map((b) => (
          <path key={`e${b.i}`} d={`M${-hw(b.y1)} ${b.y1}H${hw(b.y1)}`} stroke={R.red[DEEP]} strokeOpacity={0.35} strokeWidth={0.8} />
        ))}
        <Win x={-8} y={-128} w={6} h={9} />
        <Win x={2} y={-102} w={6} h={9} />
        <Win x={-8} y={-78} w={6} h={9} />
        <Door x={-6.5} y={-46} w={13} h={16} />

        {/* gallery: deck + railing */}
        <path d={rect(-26, -157, 52, 8)} fill={R.red[MID]} />
        <path d={rect(-26, -157, 52, 2.4)} fill={R.red[HI]} />
        <path d={rect(12, -157, 14, 8)} fill={R.red[SHADE]} />
        <path d="M-22 -157 V-168 M-15 -157 V-168 M-8 -157 V-168 M-1 -157 V-168 M6 -157 V-168 M13 -157 V-168 M20 -157 V-168 M-23 -168 H21" stroke={R.red[DEEP]} strokeWidth={1.4} strokeLinecap="round" />

        {/* lantern room: glass, frame, THE EYE */}
        <path d={rect(-15, -193, 30, 26)} fill="#CDEBFF" />
        <path d={rect(-15, -193, 30, 26)} fill="url(#pa-glow)" />
        <path d="M-11 -180 Q0 -193 11 -180 Q0 -167 -11 -180Z" fill="#FFFFFF" />
        <path d="M-11 -180 Q0 -193 11 -180" fill="none" stroke={P.ink} strokeWidth={1.6} strokeLinecap="round" />
        <path d="M-11 -180 Q0 -167 11 -180" fill="none" stroke={P.ink} strokeWidth={0.9} strokeOpacity={0.6} />
        <path d="M-6 -188 L-7.5 -191.5 M0 -189.5 V-193.4 M6 -188 L7.5 -191.5" stroke={P.ink} strokeWidth={1.1} strokeLinecap="round" />
        <circle cx={1} cy={-180} r={5.6} fill={R.teal[MID]} />
        <circle cx={1} cy={-180} r={5.6} fill="none" stroke={R.teal[DEEP]} strokeWidth={0.9} />
        <circle cx={1.4} cy={-180} r={2.8} fill={P.ink} />
        <circle cx={-0.6} cy={-182.2} r={1.3} fill="#FFFFFF" />
        <path d="M-15 -193 V-167 M15 -193 V-167 M-15 -167 H15" stroke={R.red[DEEP]} strokeWidth={2} />
        <path d="M-15 -193 H15" stroke={R.red[SHADE]} strokeWidth={2.4} />

        {/* roof: two facets, tiles, finial */}
        <path d={poly(-19, -191, 0, -216, 0, -191)} fill={R.red[LIT]} />
        <path d={poly(0, -191, 0, -216, 19, -191)} fill={R.red[SHADE]} />
        <path d={poly(-19, -191, 0, -216, 19, -191)} fill="url(#pa-tiles)" />
        <LitEdge d="M-18 -192 L-1 -214" w={1.4} />
        <path d={rect(-20, -193, 40, 3)} fill={R.red[DEEP]} />
        <circle cx={0} cy={-219} r={4} fill={R.gold[MID]} />
        <circle cx={-1.2} cy={-220.4} r={1.6} fill={R.gold[HI]} />
      </StandUp>
    </Art>
  );
});

// ── 2 · sequence: the clock tower + token train ─────────────────────────
const CT = { H: 262 };
function ClockFace({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const ticks = Array.from({ length: 12 }, (_, k) => {
    const a = (k * Math.PI) / 6, big = k % 3 === 0;
    const r0 = r * (big ? 0.7 : 0.8), r1 = r * 0.9;
    return `M${cx + Math.sin(a) * r0} ${cy - Math.cos(a) * r0}L${cx + Math.sin(a) * r1} ${cy - Math.cos(a) * r1}`;
  }).join("");
  return (
    <g>
      <circle cx={cx + 1} cy={cy + 1.4} r={r + 3.4} fill={R.gold[DEEP]} />
      <circle cx={cx} cy={cy} r={r + 3.4} fill={R.gold[MID]} />
      <path d={`M${cx - r - 3} ${cy - 2}A${r + 3.4} ${r + 3.4} 0 0 1 ${cx + 2} ${cy - r - 3.2}`} fill="none" stroke={R.gold[HI]} strokeWidth={1.6} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={r} fill="#FFFCF2" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={R.cream[SHADE]} strokeWidth={0.8} />
      <path d={ticks} stroke={P.ink} strokeWidth={1.3} strokeLinecap="round" />
      <path d={`M${cx} ${cy}L${cx - r * 0.1} ${cy - r * 0.62}M${cx} ${cy}L${cx + r * 0.46} ${cy + r * 0.12}`} stroke={P.ink} strokeWidth={1.8} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={1.6} fill={R.red[MID]} />
      <circle cx={cx} cy={cy} r={r} fill="url(#pa-gloss)" />
    </g>
  );
}

export const ClockTower = memo(function ClockTower({ train = true, ...p }: ArtProps & { /** draw the token train on its rail */ train?: boolean }) {
  // front face x -28..18, side face 18..30 receding up by 6
  const front = rect(-28, -150, 46, 132);
  const side = poly(18, -18, 30, -24, 30, -156, 18, -150);
  const stage = [rect(-32, -194, 54, 46), poly(22, -148, 34, -154, 34, -200, 22, -194)];
  const belfry = [rect(-26, -214, 42, 22), poly(16, -192, 26, -198, 26, -218, 16, -214)];
  const spire = poly(-33, -212, -5, -262, 29, -214);
  const plinth = [rect(-44, -9, 88, 9), rect(-36, -19, 72, 11)];
  const sil = [...plinth, front, side, ...stage, ...belfry, spire, circ(-5, -266, 4)];
  const quoins = [];
  for (let y = -26, k = 0; y > -150; y -= 10, k++) {
    quoins.push(<rect key={`l${k}`} x={-28} y={y - 5} width={k % 2 ? 5 : 8} height={5} fill={R.cream[LIT]} />);
    quoins.push(<rect key={`r${k}`} x={k % 2 ? 13 : 10} y={y - 5} width={k % 2 ? 5 : 8} height={5} fill={R.cream[MID]} />);
  }
  return (
    <Art design={CT.H} {...p}>
      <StandUp d={sil} foot={46} rim={3} depth={3}>
        {/* plinth steps */}
        <path d={plinth[0]} fill={R.cream[MID]} />
        <path d={plinth[1]} fill={R.cream[LIT]} />
        <path d={rect(-44, -9, 88, 2)} fill={R.cream[HI]} />
        <path d={rect(-36, -19, 72, 2)} fill={R.cream[HI]} />
        <path d={rect(26, -9, 18, 9)} fill={R.cream[SHADE]} />
        <path d={rect(22, -19, 14, 11)} fill={R.cream[SHADE]} />
        <path d={plinth.join("")} fill="url(#pa-stone)" />

        {/* brick shaft: front lit, side shaded, courses + quoins */}
        <path d={front} fill={R.orange[LIT]} />
        <path d={front} fill="url(#pa-bricks)" />
        <path d={side} fill={R.orange[SHADE]} />
        <path d={side} fill="url(#pa-bricks)" />
        <path d={front} fill="url(#pa-occl)" />
        {quoins}
        <path d={rect(-30, -64, 50, 5)} fill={R.cream[LIT]} />
        <path d={poly(20, -64, 32, -70, 32, -65, 20, -59)} fill={R.cream[SHADE]} />
        <path d={rect(-30, -108, 50, 5)} fill={R.cream[LIT]} />
        <path d={poly(20, -108, 32, -114, 32, -109, 20, -103)} fill={R.cream[SHADE]} />
        <LitEdge d="M-28 -20 V-148" w={1.4} />
        <Win x={-18} y={-94} w={7} h={11} />
        <Win x={1} y={-94} w={7} h={11} />
        <Win x={-18} y={-138} w={7} h={11} lit />
        <Win x={1} y={-138} w={7} h={11} />
        <path d="M22 -86 v-10 a2 2 0 0 1 4 -2 v10 Z M22 -128 v-10 a2 2 0 0 1 4 -2 v10 Z" fill={P.window} opacity={0.85} />
        <Door x={-11} y={-48} w={14} h={29} />

        {/* clock stage */}
        <path d={stage[0]} fill={R.cream[LIT]} />
        <path d={stage[1]} fill={R.cream[SHADE]} />
        <path d={stage.join("")} fill="url(#pa-stone)" />
        <path d={rect(-34, -150, 58, 4)} fill={R.cream[MID]} />
        <path d={rect(-34, -196, 58, 4)} fill={R.cream[HI]} />
        <ClockFace cx={-5} cy={-171} r={15} />

        {/* belfry with a gold bell */}
        <path d={belfry[0]} fill={R.orange[MID]} />
        <path d={belfry[1]} fill={R.orange[DEEP]} />
        <path d="M-20 -194 V-206 A6 6 0 0 1 -8 -206 V-194Z M-2 -194 V-206 A6 6 0 0 1 10 -206 V-194Z" fill="#3A2340" />
        <path d="M-17.5 -196 Q-17 -204 -14 -204 Q-11 -204 -10.5 -196Z" fill={R.gold[LIT]} />
        <circle cx={-14} cy={-195.5} r={1.2} fill={R.gold[DEEP]} />
        <path d={rect(-28, -216, 46, 4)} fill={R.cream[LIT]} />

        {/* spire: lit and shaded facets + tile rows */}
        <path d={poly(-33, -212, -5, -262, -5, -212)} fill={R.teal[LIT]} />
        <path d={poly(-5, -212, -5, -262, 29, -214)} fill={R.teal[SHADE]} />
        <path d={spire} fill="url(#pa-tiles)" />
        <LitEdge d="M-31 -213 L-6 -259" w={1.5} />
        <path d={rect(-35, -214, 66, 4)} fill={R.teal[DEEP]} />
        <circle cx={-5} cy={-265} r={3.6} fill={R.gold[MID]} />
        <circle cx={-6} cy={-266.2} r={1.4} fill={R.gold[HI]} />
      </StandUp>
      <Pennant x={-5} y={-267} h={18} ramp={R.orange} />
      {train && <TokenTrain x={56} y={10} size={20} />}
    </Art>
  );
});

/** A little token train: engine + three token cars (letters as cargo). design H=30. */
export const TokenTrain = memo(function TokenTrain({ tokens = ["t", "o", "k"], ...p }: ArtProps & { tokens?: string[] }) {
  const car = (x: number) => rrect(x, -20, 18, 14, 3);
  const sil = [rrect(-40, -26, 26, 20, 3), rect(-46, -12, 8, 6), ...tokens.map((_, i) => car(-10 + i * 21))];
  return (
    <Art design={30} {...p}>
      <path d="M-50 3 H62" stroke={R.wood[SHADE]} strokeWidth={2.4} />
      <path d="M-48 3 V5 M-38 3 V5 M-28 3 V5 M-18 3 V5 M-8 3 V5 M2 3 V5 M12 3 V5 M22 3 V5 M32 3 V5 M42 3 V5 M52 3 V5" stroke={R.wood[DEEP]} strokeWidth={2} />
      <Cutout d={sil} rim={1.6} depth={1.5} shadow="drop" lift={0.4}>
        {/* engine */}
        <path d={rrect(-40, -26, 26, 20, 3)} fill={R.red[LIT]} />
        <path d={rrect(-26, -26, 12, 20, 3)} fill={R.red[SHADE]} />
        <path d={rect(-36, -23, 8, 7)} fill={P.windowLit} />
        <path d={rect(-46, -12, 8, 6)} fill={R.rock[SHADE]} />
        <path d={rect(-44, -34, 5, 9)} fill={P.ink} />
        {tokens.map((t, i) => (
          <g key={i}>
            <path d={car(-10 + i * 21)} fill={R.gold[LIT]} />
            <path d={rrect(-10 + i * 21 + 12, -20, 6, 14, 3)} fill={R.gold[SHADE]} />
            <text x={-10 + i * 21 + 7.5} y={-9.5} fontSize={10} fontWeight={700} textAnchor="middle" fill={P.ink} fontFamily="var(--paper-display), system-ui">{t}</text>
          </g>
        ))}
        {[-34, -20, -5, 4, 16, 25, 37, 46].map((x) => (
          <g key={x}><circle cx={x} cy={-5} r={3.4} fill={P.ink} /><circle cx={x} cy={-5} r={1.2} fill={R.rock[LIT]} /></g>
        ))}
      </Cutout>
    </Art>
  );
});

// ── 3 · generative: the kiln volcano ────────────────────────────────────
const KV = { H: 222 };
function Puff({ x, y, r, ramp = R.violet }: { x: number; y: number; r: number; ramp?: Ramp }) {
  const shape = blob([[x - r * 0.55, y + r * 0.15, r * 0.62], [x + r * 0.1, y - r * 0.25, r * 0.78], [x + r * 0.62, y + r * 0.2, r * 0.56]]);
  const shade = blob([[x + r * 0.1, y + r * 0.35, r * 0.62], [x + r * 0.7, y + r * 0.3, r * 0.44]]);
  return (
    <Cutout d={shape} rim={Math.max(1.4, r * 0.12)} depth={Math.max(1, r * 0.1)} shadow="drop" lift={1.6}>
      <path d={shape} fill="#F4ECFF" />
      <path d={shade} fill={ramp[HI]} />
      <path d={blob([[x - r * 0.62, y + r * 0.02, r * 0.3], [x - r * 0.05, y - r * 0.45, r * 0.34]])} fill="#FFFFFF" />
    </Cutout>
  );
}
export const KilnVolcano = memo(function KilnVolcano(p: ArtProps) {
  const cone = poly(-104, 0, -62, -58, -30, -114, -20, -122, 20, -122, 32, -112, 66, -56, 104, 0);
  return (
    <Art design={KV.H} {...p}>
      <StandUp d={[cone, rect(-24, -130, 48, 12)]} foot={100} rim={3} depth={3}>
        <path d={cone} fill={R.basalt[MID]} />
        <path d={poly(-104, 0, -62, -58, -30, -114, -20, -122, -8, -64, -38, 0)} fill={R.basalt[LIT]} />
        <path d={poly(24, 0, 10, -64, 20, -122, 32, -112, 66, -56, 104, 0)} fill={R.basalt[SHADE]} />
        <path d={poly(58, 0, 52, -30, 66, -56, 104, 0)} fill={R.basalt[DEEP]} />
        {/* ridges: lit spurs running down the cone + a secondary shaded gully */}
        <path d={poly(-62, -58, -44, -60, -34, -36, -52, 0, -70, 0, -58, -30)} fill={R.basalt[HI]} opacity={0.45} />
        <path d={poly(-30, -114, -22, -96, -26, -70, -34, -76)} fill={R.basalt[HI]} opacity={0.4} />
        <path d={poly(32, -112, 40, -84, 52, -60, 38, -70, 28, -96)} fill={R.basalt[MID]} opacity={0.8} />
        <path d={poly(66, -56, 72, -30, 84, 0, 70, 0, 62, -30)} fill={R.basalt[SHADE]} />
        {/* strata: lit ledges with dark undersides */}
        {[[-80, -22, 22], [-54, -48, 18], [-38, -84, 12], [30, -30, 18], [44, -60, 12], [-14, -30, 14], [8, -46, 10]].map(([x, y, w], i) => (
          <g key={i}>
            <path d={`M${x} ${y} L${x + w * 0.5} ${y - 4} L${x + w} ${y}`} fill="none" stroke={R.basalt[HI]} strokeOpacity={0.8} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
            <path d={`M${x + 1} ${y + 1.6} L${x + w - 1} ${y + 1.6}`} stroke={R.basalt[DEEP]} strokeWidth={1.4} strokeLinecap="round" />
          </g>
        ))}
        <path d="M-70 -12 L-60 -20 M-40 -50 L-30 -58 L-32 -66 M40 -22 L48 -30 M8 -90 L14 -100 M60 -18 L66 -8" fill="none" stroke={R.basalt[DEEP]} strokeWidth={1.4} strokeLinecap="round" />
        <path d={cone} fill="url(#pa-grit)" />
        <LitEdge d="M-102 -2 L-62 -58 L-30 -114 L-20 -122" w={1.8} />
        {/* boulders tumbled on the slopes */}
        <Boulder x={-60} y={-6} r={7} ramp={R.basalt} />
        <Boulder x={70} y={-4} r={6} ramp={R.basalt} />
        <Boulder x={-34} y={-58} r={4} ramp={R.basalt} />
        {/* lava rivulets: a warm halo, the flow, a hot core */}
        <path d="M-8 -118 Q-14 -96 -8 -80 Q-2 -64 -12 -44 Q-16 -36 -12 -30 Q-6 -40 -4 -48 Q4 -68 -2 -84 Q-4 -100 2 -118Z" fill="none" stroke={R.lava[MID]} strokeOpacity={0.35} strokeWidth={7} strokeLinejoin="round" />
        <path d="M10 -118 Q18 -104 16 -92 Q15 -84 20 -76 Q22 -86 21 -96 Q20 -110 14 -118Z" fill="none" stroke={R.lava[MID]} strokeOpacity={0.35} strokeWidth={6} strokeLinejoin="round" />
        <path d="M-8 -118 Q-14 -96 -8 -80 Q-2 -64 -12 -44 Q-16 -36 -12 -30 Q-6 -40 -4 -48 Q4 -68 -2 -84 Q-4 -100 2 -118Z" fill={R.lava[MID]} />
        <path d="M-6 -116 Q-11 -98 -6 -84 Q-2 -72 -8 -56 Q-3 -66 -2 -76 Q-3 -96 0 -116Z" fill={R.lava[LIT]} />
        <path d="M-5 -112 Q-8 -100 -5 -90" fill="none" stroke={R.lava[HI]} strokeWidth={1.4} strokeLinecap="round" />
        <path d="M10 -118 Q18 -104 16 -92 Q15 -84 20 -76 Q22 -86 21 -96 Q20 -110 14 -118Z" fill={R.lava[MID]} />
        <path d="M12 -116 Q17 -104 16 -96" fill="none" stroke={R.lava[LIT]} strokeWidth={1.6} strokeLinecap="round" />
        {/* the dark top: soot where the kiln breathes */}
        <path d="M-30 -114 L-20 -122 L20 -122 L32 -112 L22 -104 Q0 -110 -22 -104Z" fill={R.basalt[DEEP]} opacity={0.5} />
        {/* brick kiln collar around the crater */}
        <path d={rect(-24, -130, 48, 12)} fill={R.red[MID]} />
        <path d={rect(-24, -130, 48, 12)} fill="url(#pa-bricks)" />
        <path d={rect(8, -130, 16, 12)} fill={R.red[DEEP]} opacity={0.55} />
        <path d={rect(-26, -132, 52, 3.4)} fill={R.red[HI]} />
        <path d={ell(0, -131, 20, 4.4)} fill={R.lava[DEEP]} />
        <path d={ell(-1, -131.6, 15, 3)} fill={R.lava[LIT]} />
        <path d={ell(-3, -132, 7, 1.4)} fill={R.lava[HI]} />
        {/* kiln door at the foot: a brick arch with the fire inside */}
        <path d="M-20 0 V-18 A20 20 0 0 1 20 -18 V0Z" fill={R.red[MID]} />
        <path d="M-20 0 V-18 A20 20 0 0 1 20 -18 V0Z" fill="url(#pa-bricks)" />
        <path d="M-13 0 V-16 A13 13 0 0 1 13 -16 V0Z" fill="#3A1830" />
        <path d="M-13 0 V-16 A13 13 0 0 1 13 -16 V0Z" fill="url(#pa-glow)" />
        <path d="M-9 0 Q-8 -8 -4 -10 Q-4 -5 0 -12 Q2 -6 5 -9 Q8 -5 9 0Z" fill={R.lava[LIT]} />
        <path d="M-5 0 Q-4 -4 -1 -6 Q1 -3 4 -5 Q5 -2 5 0Z" fill={R.lava[HI]} />
        <path d="M-21 -18 A21 21 0 0 1 -8 -36" fill="none" stroke={R.red[HI]} strokeWidth={1.6} strokeLinecap="round" />
        {/* glazed sample pots cooling on the ledge */}
        <path d="M30 0 Q24 -6 27 -12 L29 -15 H35 L37 -12 Q40 -6 34 0Z" fill={R.violet[MID]} />
        <path d="M30 0 Q24 -6 27 -12 L29 -15 H32 Q28 -8 31 0Z" fill={R.violet[LIT]} />
        <path d="M44 0 Q39 -4 41 -9 L43 -11 H48 L50 -9 Q52 -4 47 0Z" fill={R.teal[MID]} />
        <Glint x={29} y={-9} r={1.6} streak={false} />
        <Tuft x={-80} y={-2} s={1} ramp={R.lime} />
        <Tuft x={78} y={-2} s={0.9} ramp={R.lime} />
      </StandUp>
      {/* sample puffs rising from the kiln, drifting right (floating cutouts) */}
      <Puff x={4} y={-146} r={15} />
      <Puff x={24} y={-176} r={17} />
      <Puff x={50} y={-198} r={12} />
      <Puff x={70} y={-212} r={7} />
    </Art>
  );
});

// ── 4 · representation: twin mirror towers over a lake ──────────────────
const MT = { H: 196 };
function MirrorTower({ x, roof, mirrorSide }: { x: number; roof: Ramp; mirrorSide: 1 | -1 }) {
  const b = -20;  // base on the far shore
  return (
    <g>
      <path d={rect(x - 15, b - 108, 30, 108)} fill={R.cream[LIT]} />
      <path d={rect(x - 15, b - 108, 30, 108)} fill="url(#pa-stone)" />
      <path d={rect(x - 15, b - 108, 30, 108)} fill="url(#pa-turn)" />
      <path d={rect(x - 15, b - 108, 30, 108)} fill="url(#pa-occl)" />
      <LitEdge d={`M${x - 14.5} ${b - 2} V${b - 106}`} w={1.4} />
      <path d={rect(x - 18, b - 114, 36, 7)} fill={R.cream[MID]} />
      <path d={rect(x - 18, b - 114, 36, 2)} fill={R.cream[HI]} />
      <path d={rect(x + 8, b - 114, 10, 7)} fill={R.cream[SHADE]} />
      <Win x={x - 3.5} y={b - 100} w={7} h={11} lit={mirrorSide === -1} />
      <Win x={x - 3.5} y={b - 60} w={7} h={11} />
      <Door x={x - 5} y={b - 16} w={10} h={16} />
      {/* painted friezes in the roof colour: the twins wear the same livery */}
      <path d={rect(x - 15, b - 44, 30, 5)} fill={roof[MID]} />
      <path d={rect(x - 15, b - 44, 30, 1.6)} fill={roof[HI]} />
      <path d={rect(x + 6, b - 44, 9, 5)} fill={roof[SHADE]} />
      <path d={`M${x - 15} ${b - 30} h30`} stroke={roof[MID]} strokeWidth={1.4} strokeDasharray="3 2.4" />
      {/* a dormer on the cone */}
      <path d={poly(x - 5, b - 120, x + 1, b - 120, x + 1, b - 127, x - 2, b - 131, x - 5, b - 127)} fill={P.die} />
      <path d={rect(x - 3.8, b - 126, 3.6, 5)} fill={P.window} />
      {/* conical roof */}
      <path d={poly(x - 20, b - 113, x, b - 160, x, b - 113)} fill={roof[LIT]} />
      <path d={poly(x, b - 113, x, b - 160, x + 20, b - 113)} fill={roof[SHADE]} />
      <path d={poly(x - 20, b - 113, x, b - 160, x + 20, b - 113)} fill="url(#pa-shingle)" />
      <path d={`M${x - 20} ${b - 113} Q${x} ${b - 108} ${x + 20} ${b - 113}`} fill={roof[DEEP]} />
      <LitEdge d={`M${x - 19} ${b - 114} L${x - 1} ${b - 158}`} w={1.3} />
      {/* the mirror disc, facing the twin */}
      <g transform={`translate(${x + mirrorSide * 15} ${b - 78})`}>
        <ellipse cx={mirrorSide * 3} cy={0} rx={9} ry={11} fill={R.gold[SHADE]} />
        <ellipse cx={mirrorSide * 2} cy={0} rx={8.5} ry={10.5} fill={R.gold[MID]} />
        <ellipse cx={mirrorSide * 2} cy={0} rx={6.4} ry={8.4} fill="#DDEBFA" />
        <path d={`M${mirrorSide * 2 - 4} ${4} L${mirrorSide * 2 + 2} ${-6}`} stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" />
        <ellipse cx={mirrorSide * 2} cy={0} rx={6.4} ry={8.4} fill="url(#pa-gloss)" />
      </g>
    </g>
  );
}
export const MirrorTowers = memo(function MirrorTowers(p: ArtProps) {
  const lake = ell(0, 6, 104, 26);
  const towerSil = (x: number) => [rect(x - 15, -128, 30, 108), rect(x - 18, -134, 36, 7), poly(x - 20, -133, x, -180, x + 20, -133), ell(x + (x < 0 ? 17 : -17), -98, 10, 12)];
  const sil = [...towerSil(-42), ...towerSil(42)];
  const arc = "M-27 -112 Q0 -142 27 -112";
  const clip = `pa-lake-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <Art design={MT.H} {...p}>
      {/* the lake lies flat on the ground: a die-cut pool with a sand shore */}
      <Cutout d={ell(0, 6, 110, 30)} rim={3} depth={0} shadow="none">
        <path d={ell(0, 6, 110, 30)} fill={R.sand[LIT]} />
        <path d={ell(2, 8, 108, 28)} fill={R.sand[MID]} opacity={0.5} />
        <path d={lake} fill="url(#pa-lake)" />
        {/* reflections: the towers upside down, squashed, faded */}
        <clipPath id={clip}><path d={lake} /></clipPath>
        <g clipPath={`url(#${clip})`}>
          <g opacity={0.42} transform="translate(0 -20) scale(1 -0.46) translate(0 20)">
            <path d={sil.join("")} fill={R.teal[DEEP]} />
          </g>
        </g>
        <path d="M-70 4 H-40 M-20 12 H14 M30 2 H62 M-52 20 H-26 M40 18 H70" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={1.6} strokeLinecap="round" />
        <path d="M-96 0 Q-60 -22 0 -22 Q60 -22 96 0" fill="none" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={2.4} />
        <Tuft x={-96} y={14} s={1} ramp={R.teal} />
        <Tuft x={92} y={16} s={1.1} ramp={R.teal} />
      </Cutout>
      <StandUp d={sil} foot={70} rim={3} depth={3} tab={false}>
        <MirrorTower x={-42} roof={R.teal} mirrorSide={1} />
        <MirrorTower x={42} roof={R.blue} mirrorSide={-1} />
      </StandUp>
      <Pennant x={-42} y={-180} h={16} ramp={R.teal} />
      <Pennant x={42} y={-180} h={16} ramp={R.blue} />
      {/* the shared meaning: a gold ribbon strung between the twins, with lanterns */}
      <path d={arc} fill="none" stroke={P.die} strokeWidth={4.4} strokeLinecap="round" />
      <path d={arc} fill="none" stroke={R.gold[MID]} strokeWidth={2.2} strokeLinecap="round" />
      {[-14, 0, 14].map((lx, i) => {
        const ly = -112 - (1 - (lx / 27) ** 2) * 15;
        return (
          <g key={i}>
            <path d={`M${lx} ${ly} v3`} stroke={P.ink} strokeWidth={0.8} />
            <path d={rrect(lx - 2.6, ly + 3, 5.2, 6.4, 2)} fill={i === 1 ? R.teal[LIT] : R.blue[LIT]} stroke={P.die} strokeWidth={1} />
          </g>
        );
      })}
    </Art>
  );
});

// ── 5 · structure: crystal lattice on a cave rock ───────────────────────
const CL = { H: 198 };
export function crystalFacets(x: number, y: number, w: number, h: number, a: number) {
  const t = w * 0.95;
  const L = -w / 2, M1 = -w * 0.12, M2 = w * 0.22, Rr = w / 2;
  const P2 = (pts: Pt[]) => polyP(rot(pts, a, x, y));
  return {
    left: P2([[L, 0], [L, -h], [M1, -h], [M1, 0]]),
    front: P2([[M1, 0], [M1, -h], [M2, -h], [M2, 0]]),
    right: P2([[M2, 0], [M2, -h], [Rr, -h], [Rr, 0]]),
    tipL: P2([[L, -h], [0, -h - t], [M1, -h]]),
    tipF: P2([[M1, -h], [0, -h - t], [M2, -h]]),
    tipR: P2([[M2, -h], [0, -h - t], [Rr, -h]]),
    streak: P2([[L + w * 0.1, -h * 0.15], [L + w * 0.1, -h * 0.85]]),
    sil: P2([[L, 0], [L, -h], [0, -h - t], [Rr, -h], [Rr, 0]]),
    tip: rot([[0, -h - t]], a, x, y)[0],
  };
}
export const CrystalLattice = memo(function CrystalLattice(p: ArtProps) {
  const rock = poly(-92, 0, -82, -38, -58, -66, -26, -80, 10, -78, 42, -64, 72, -38, 92, 0);
  const cr = [
    crystalFacets(-4, -72, 28, 66, -0.05),
    crystalFacets(-30, -66, 19, 42, -0.42),
    crystalFacets(22, -68, 21, 48, 0.36),
    crystalFacets(50, -46, 13, 24, 0.62),
    crystalFacets(-58, -52, 12, 20, -0.7),
  ];
  const pink = R.pink;
  const nodes = cr.map((c) => c.tip);
  const links: [number, number][] = [[0, 1], [0, 2], [1, 4], [2, 3], [1, 2]];
  return (
    <Art design={CL.H} {...p}>
      <StandUp d={[rock, ...cr.map((c) => c.sil)]} foot={88} rim={3} depth={3}>
        <path d={rock} fill={R.rock[MID]} />
        <path d={poly(-92, 0, -82, -38, -58, -66, -26, -80, -30, -40, -52, 0)} fill={R.rock[LIT]} />
        <path d={poly(34, 0, 36, -40, 42, -64, 72, -38, 92, 0)} fill={R.rock[SHADE]} />
        <path d={poly(60, 0, 62, -22, 72, -38, 92, 0)} fill={R.rock[DEEP]} opacity={0.6} />
        <path d={rock} fill="url(#pa-grit)" />
        <LitEdge d="M-90 -2 L-82 -38 L-58 -66 L-26 -80" w={1.8} />
        <path d="M-64 -30 L-54 -40 M50 -20 L58 -30 M-20 -58 L-12 -66" stroke={R.rock[DEEP]} strokeWidth={1.3} strokeLinecap="round" />
        {/* cave mouth with pink crystal-light inside */}
        <path d="M-26 0 V-22 Q-26 -44 0 -46 Q26 -44 26 -22 V0Z" fill="#231A3A" />
        <ellipse cx={0} cy={-8} rx={20} ry={14} fill={pink[MID]} opacity={0.35} />
        <path d="M-12 0 L-9 -12 L-6 0Z M4 0 L8 -16 L12 0Z" fill={pink[LIT]} />
        <path d="M8 -16 L12 0 L10 0Z" fill={pink[SHADE]} />
        <path d="M-28 -22 Q-28 -46 0 -48" fill="none" stroke={R.rock[HI]} strokeWidth={1.6} strokeLinecap="round" />
        {/* the lattice behind the crystals: gold rods */}
        {links.map(([a, b], i) => (
          <g key={i}>
            <path d={`M${nodes[a][0]} ${nodes[a][1]}L${nodes[b][0]} ${nodes[b][1]}`} stroke={R.gold[DEEP]} strokeWidth={3.2} strokeLinecap="round" />
            <path d={`M${nodes[a][0]} ${nodes[a][1]}L${nodes[b][0]} ${nodes[b][1]}`} stroke={R.gold[LIT]} strokeWidth={1.6} strokeLinecap="round" />
          </g>
        ))}
        {cr.map((c, i) => (
          <g key={i}>
            <path d={c.left} fill={pink[LIT]} />
            <path d={c.front} fill={pink[MID]} />
            <path d={c.right} fill={pink[SHADE]} />
            <path d={c.tipL} fill={pink[HI]} />
            <path d={c.tipF} fill={pink[LIT]} />
            <path d={c.tipR} fill={pink[MID]} />
            <path d={c.streak} stroke="#FFFFFF" strokeOpacity={0.75} strokeWidth={1.3} strokeLinecap="round" />
          </g>
        ))}
        {nodes.map(([nx, ny], i) => (
          <g key={i}>
            <circle cx={nx} cy={ny} r={4.2} fill={R.gold[SHADE]} />
            <circle cx={nx - 0.4} cy={ny - 0.4} r={3.6} fill={R.gold[LIT]} />
            <circle cx={nx - 1.3} cy={ny - 1.4} r={1.3} fill={R.gold[HI]} />
          </g>
        ))}
        <Glint x={-12} y={-118} r={3.2} streak={false} />
      </StandUp>
    </Art>
  );
});

// ── 6 · decision: the dice keep ─────────────────────────────────────────
const DK = { H: 214 };
function Die({ cx, cy, s }: { cx: number; cy: number; s: number }) {
  // iso cube: top rhombus, lit left face, shaded right face; pips mapped per face
  const h = s * 0.5, v = s * 0.66;
  const top = poly(cx, cy - h * 2, cx + s, cy - h, cx, cy, cx - s, cy - h);
  const left = poly(cx - s, cy - h, cx, cy, cx, cy + v * 2, cx - s, cy - h + v * 2);
  const right = poly(cx, cy, cx + s, cy - h, cx + s, cy - h + v * 2, cx, cy + v * 2);
  const pip = (m: string, pts: Pt[], color: string) => (
    <g transform={m}>{pts.map(([u, w], i) => <circle key={i} cx={u} cy={w} r={0.11} fill={color} />)}</g>
  );
  const topM = `matrix(${s} ${-h} ${s} ${h} ${cx - s} ${cy - h})`;
  const leftM = `matrix(${s} ${h} 0 ${v * 2} ${cx - s} ${cy - h})`;
  const rightM = `matrix(${s} ${-h} 0 ${v * 2} ${cx} ${cy})`;
  return (
    <g>
      <path d={top} fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={3} strokeLinejoin="round" />
      <path d={left} fill={R.cream[HI]} stroke={R.cream[HI]} strokeWidth={3} strokeLinejoin="round" />
      <path d={right} fill={R.cream[MID]} stroke={R.cream[MID]} strokeWidth={3} strokeLinejoin="round" />
      <path d={`M${cx - s} ${cy - h} L${cx} ${cy} L${cx + s} ${cy - h}`} fill="none" stroke={R.cream[SHADE]} strokeOpacity={0.35} strokeWidth={0.8} />
      {pip(topM, [[0.5, 0.5]], R.red[MID])}
      {pip(leftM, [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]], P.ink)}
      {pip(rightM, [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]], P.ink)}
      <Glint x={cx - s * 0.55} y={cy - h * 1.1} r={s * 0.14} streak={false} />
    </g>
  );
}
function Turret({ x, h, roofH, ramp }: { x: number; h: number; roofH: number; ramp: Ramp }) {
  return (
    <g>
      <path d={rect(x - 12, -h, 24, h)} fill={R.cream[LIT]} />
      <path d={rect(x - 12, -h, 24, h)} fill="url(#pa-stone)" />
      <path d={rect(x - 12, -h, 24, h)} fill="url(#pa-turn)" />
      <path d={rect(x - 12, -h, 24, h)} fill="url(#pa-occl)" />
      <LitEdge d={`M${x - 11.5} ${-2} V${-h + 2}`} w={1.3} />
      <path d={rect(x - 15, -h - 5, 30, 6)} fill={R.cream[MID]} />
      <path d={rect(x - 15, -h - 5, 30, 1.8)} fill={R.cream[HI]} />
      <path d={poly(x - 17, -h - 4, x, -h - roofH, x, -h - 4)} fill={ramp[LIT]} />
      <path d={poly(x, -h - 4, x, -h - roofH, x + 17, -h - 4)} fill={ramp[SHADE]} />
      <path d={poly(x - 17, -h - 4, x, -h - roofH, x + 17, -h - 4)} fill="url(#pa-shingle)" />
      <LitEdge d={`M${x - 16} ${-h - 5} L${x - 1} ${-h - roofH + 2}`} w={1.2} />
      <Win x={x - 3} y={-h + 12} w={6} h={9} />
      <path d={`M${x - 4} ${-h * 0.45} h8 v14 l-4 -3 l-4 3Z`} fill={ramp[MID]} />
      <path d={`M${x - 4} ${-h * 0.45} h3 v12.4 l-3 2.2Z`} fill={ramp[HI]} opacity={0.6} />
      <circle cx={x} cy={-h * 0.45 + 6} r={1.4} fill={P.die} />
    </g>
  );
}
export const DiceKeep = memo(function DiceKeep(p: ArtProps) {
  const hill = "M-96 0 Q-80 -12 -40 -14 Q0 -16 40 -14 Q80 -12 96 0Z";
  const wall = rect(-54, -78, 96, 70);
  const wallSide = poly(42, -8, 56, -14, 56, -84, 42, -78);
  const keep = rect(-26, -132, 42, 56);
  const keepSide = poly(16, -76, 28, -82, 28, -138, 16, -132);
  const turretSil = (x: number, h: number, rh: number) => [rect(x - 15, -h - 5, 30, h + 5), poly(x - 17, -h - 4, x, -h - rh, x + 17, -h - 4)];
  const sil = [hill, wall, wallSide, keep, keepSide, merlonsD(-54, 42, -78, 7, 7, 5), merlonsD(-26, 16, -132, 6, 6, 4),
    ...turretSil(-64, 104, 44), ...turretSil(66, 92, 40),
    poly(-2, -180, 20, -169, 20, -140, -2, -129, -24, -140, -24, -169)];
  return (
    <Art design={DK.H} {...p}>
      <StandUp d={sil} foot={90} rim={3} depth={3}>
        <path d={hill} fill={R.grass[MID]} />
        <path d="M-96 0 Q-80 -12 -40 -14 Q-10 -16 0 -16 Q-30 -10 -40 0Z" fill={R.grass[LIT]} />
        <path d="M40 -14 Q80 -12 96 0 H50 Q56 -8 40 -14Z" fill={R.grass[SHADE]} />
        <path d={hill} fill="url(#pa-fibre)" />
        {/* curtain wall */}
        <path d={wall} fill={R.cream[LIT]} />
        <path d={wallSide} fill={R.cream[SHADE]} />
        <path d={wall + wallSide} fill="url(#pa-stone)" />
        <path d={wall} fill="url(#pa-occl)" />
        <Merlons x0={-54} x1={42} y={-78} h={7} w={7} gap={5} />
        <path d="M42 -78 L56 -84" stroke={R.cream[DEEP]} strokeOpacity={0.4} strokeWidth={1} />
        {/* gate: voussoirs, dark passage, portcullis */}
        <path d="M-17 -8 V-40 A17 17 0 0 1 17 -40 V-8Z" fill={R.cream[MID]} />
        <path d="M-12 -8 V-38 A12 12 0 0 1 12 -38 V-8Z" fill="#2E2238" />
        <path d="M-8 -8 V-46 M-3 -8 V-50 M2 -8 V-50 M7 -8 V-46 M-12 -20 H12 M-12 -32 H12" stroke={R.rock[LIT]} strokeWidth={1.2} />
        <path d="M-14 -8 H14" stroke={R.cream[SHADE]} strokeWidth={2} />
        <path d="M-17 -40 A17 17 0 0 1 -4 -57" fill="none" stroke={R.cream[HI]} strokeWidth={1.6} strokeLinecap="round" />
        <SquareWin x={-44} y={-62} w={6} h={8} />
        <SquareWin x={26} y={-62} w={6} h={8} />
        {/* keep tower */}
        <path d={keep} fill={R.cream[LIT]} />
        <path d={keepSide} fill={R.cream[SHADE]} />
        <path d={keep + keepSide} fill="url(#pa-stone)" />
        <Merlons x0={-26} x1={16} y={-132} h={6} w={6} gap={3} />
        <Win x={-15} y={-118} w={7} h={11} />
        <Win x={1} y={-118} w={7} h={11} lit />
        <LitEdge d="M-26 -78 V-130" w={1.3} />
        {/* turrets with lime roofs and banners */}
        <Turret x={-64} h={104} roofH={44} ramp={R.lime} />
        <Turret x={66} h={92} roofH={40} ramp={R.lime} />
        <path d={rect(54, -92, 24, 92)} fill={P.shadow} opacity={0.12} />
        {/* the die on the keep */}
        <Die cx={-2} cy={-158} s={22} />
        <Tuft x={-86} y={-4} s={1} />
        <Tuft x={84} y={-4} s={1} />
      </StandUp>
      <Pennant x={-64} y={-152} h={20} ramp={R.lime} emblem="dot" />
      <Pennant x={66} y={-136} h={18} ramp={R.red} emblem="star" />
    </Art>
  );
});

// ── registry ───────────────────────────────────────────────────────────
/** Family → set-piece component + its design height (the natural size). */
export const SET_PIECES: Record<string, { C: ComponentType<ArtProps>; H: number; W: number; name: string }> = {
  perception: { C: LighthouseEye, H: LH.H, W: 240, name: "Lighthouse eye" },
  sequence: { C: ClockTower, H: CT.H, W: 190, name: "Clock tower + token train" },
  generative: { C: KilnVolcano, H: KV.H, W: 220, name: "Kiln volcano" },
  representation: { C: MirrorTowers, H: MT.H, W: 224, name: "Twin mirror towers" },
  structure: { C: CrystalLattice, H: CL.H, W: 190, name: "Crystal lattice" },
  decision: { C: DiceKeep, H: DK.H, W: 200, name: "Dice keep" },
};

