// Atom landmarks, part A: perception, sequence and the first two generative
// atoms. Each def = design box, silhouette pieces (rim + cast shadow), the
// drawing, and where the emblem plaque sits. Base-centre (0, 0), up negative.
import type { ReactNode } from "react";
import { Glint, LitEdge } from "./materials";
import { P, R, HI, LIT, MID, SHADE, DEEP, type Ramp } from "./palette";
import { circ, ell, poly, rect } from "./geom";
import { Door, Pennant, Tuft, Win } from "./bits";
import { Box3, box3D, Cone, coneD, crenelD, Mound, moundD, Shaft, shaftD } from "./landmark-kit";

export interface LandmarkDef {
  /** design height / width (base-centre at 0,0) */
  H: number;
  W: number;
  /** the mechanism metaphor, for the specimen caption */
  metaphor: string;
  sil: string[];
  body: (fam: Ramp) => ReactNode;
  /** plaque centre + face size */
  plaque: [number, number, number];
}

const B = -6;   // buildings stand a little into the mound

// 1 · classifier — lens tower: one great eye over a conv-grid portcullis
const classifier: LandmarkDef = {
  H: 172, W: 130, metaphor: "lens tower: one great eye over a conv-grid portcullis",
  sil: [moundD(56), ...box3D(-4, 42, 100, 12, B), circ(-4, -134, 33), rect(-24, -110, 40, 8)],
  plaque: [-4, -62, 20],
  body: (fam) => (
    <g>
      <Mound w={56} />
      <Box3 x={-4} y={B} w={42} h={100} d={12} ramp={R.cream} />
      {/* the gate: a dark arch with the conv grid as portcullis, a gold kernel sliding over it */}
      <path d={`M-19 ${B} V-30 A15 15 0 0 1 11 -30 V${B}Z`} fill={R.cream[MID]} />
      <path d={`M-15 ${B} V-30 A11 11 0 0 1 7 -30 V${B}Z`} fill="#2E2238" />
      <path d={`M-10 ${B} V-40 M-4 ${B} V-41 M2 ${B} V-40 M-15 -14 H7 M-15 -22 H7 M-15 -30 H7`} stroke={R.rock[LIT]} strokeWidth={1.1} />
      <path d={rect(-11, -32, 13, 13)} fill={R.gold[LIT]} fillOpacity={0.25} stroke={R.gold[LIT]} strokeWidth={1.8} strokeLinejoin="round" />
      <Win x={-20} y={-96} w={6} h={9} />
      <Win x={6} y={-96} w={6} h={9} />
      {/* collar under the lens */}
      <path d={rect(-24, -110, 40, 8)} fill={fam[MID]} />
      <path d={rect(-24, -110, 40, 2.4)} fill={fam[HI]} />
      <path d={rect(8, -110, 8, 8)} fill={fam[SHADE]} />
      {/* the great lens: brass ring, bolts, a watching eye behind glass */}
      <circle cx={-2} cy={-132} r={32} fill={R.gold[DEEP]} />
      <circle cx={-4} cy={-134} r={32} fill={R.gold[MID]} />
      <path d="M-34 -136 A30 30 0 0 1 -6 -165" fill="none" stroke={R.gold[HI]} strokeWidth={3} strokeLinecap="round" />
      {Array.from({ length: 8 }, (_, k) => { const a = (k * Math.PI) / 4; return <circle key={k} cx={-4 + Math.cos(a) * 28} cy={-134 + Math.sin(a) * 28} r={1.5} fill={R.gold[DEEP]} />; })}
      <circle cx={-4} cy={-134} r={24} fill={R.gold[SHADE]} />
      <circle cx={-4} cy={-134} r={22} fill="#FFFFFF" />
      <circle cx={-2} cy={-133} r={12} fill={R.teal[MID]} />
      <circle cx={-2} cy={-133} r={12} fill="none" stroke={R.teal[DEEP]} strokeWidth={1.4} />
      <circle cx={-1.4} cy={-132.6} r={6} fill={P.ink} />
      <circle cx={-5} cy={-137} r={2.6} fill="#FFFFFF" />
      {/* the lid: a family-colour visor over the eye */}
      <path d="M-30 -140 A26 26 0 0 1 22 -140 Q-4 -150 -30 -140Z" fill={fam[MID]} />
      <path d="M-30 -140 A26 26 0 0 1 -4 -160 Q-18 -150 -30 -140Z" fill={fam[LIT]} />
      <path d="M-22 -124 A20 20 0 0 0 -8 -114" fill="none" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={2.2} strokeLinecap="round" />
      <circle cx={-4} cy={-134} r={22} fill="url(#pa-gloss)" />
      <Tuft x={-44} y={-4} /> <Tuft x={40} y={-4} s={0.9} />
    </g>
  ),
};

// 2 · tabular_classifier — layered ziggurat of window tiers (rows of cells)
const TIER = (i: number) => ({ w: 116 - i * 26, y0: B - i * 25, y1: B - (i + 1) * 25 });
const tabular_classifier: LandmarkDef = {
  H: 150, W: 150, metaphor: "ziggurat of window tiers: a table, row by row",
  sil: [moundD(66), ...[0, 1, 2, 3].flatMap((i) => box3D(0, TIER(i).w, 25, 10, TIER(i).y0)), rect(-7, -128, 14, 22), coneD(0, -128, 20, 12)],
  plaque: [0, -44, 19],
  body: (fam) => (
    <g>
      <Mound w={66} ramp={R.grass} />
      {[0, 1, 2, 3].map((i) => {
        const t = TIER(i);
        const n = Math.max(2, Math.floor((t.w - 8) / 11));
        const x0 = -((n - 1) * 11) / 2;
        return (
          <g key={i}>
            <Box3 x={0} y={t.y0} w={t.w} h={25} d={10} ramp={i === 3 ? fam : R.sand} top pattern={i === 3 ? null : "pa-bricks"} />
            <path d={rect(-t.w / 2, t.y1, t.w, 3)} fill={i === 3 ? fam[HI] : R.cream[HI]} />
            {Array.from({ length: n }, (_, k) => {
              if (i === 1 && Math.abs(x0 + k * 11) < 14) return null;   // the plaque's cell
              const lit = (k * 7 + i * 3) % 5 === 0;
              return <rect key={k} x={x0 + k * 11 - 3.2} y={t.y0 - 17} width={6.4} height={8} rx={0.8} fill={lit ? P.windowLit : P.window} stroke={R.cream[HI]} strokeWidth={1} />;
            })}
          </g>
        );
      })}
      <Shaft x={0} y={-106} w={14} h={22} ramp={R.cream} pattern={null} />
      <path d="M-3 -110 v-6 a3 3 0 0 1 6 0 v6Z" fill={P.windowLit} />
      <Cone x={0} y={-128} w={20} h={12} ramp={fam} />
      <Pennant x={0} y={-140} h={12} ramp={fam} />
      <Door x={-5} y={B - 15} w={10} h={15} />
    </g>
  ),
};

// 3 · segmentation — U-gate: two towers joined by skip bridges over a U
const segmentation: LandmarkDef = {
  H: 176, W: 140, metaphor: "U-gate: two towers, a U below, skip bridges across",
  sil: [moundD(62), shaftD(-38, 28, 130, B), shaftD(38, 28, 130, B), coneD(-38, B - 130, 34, 30), coneD(38, B - 130, 34, 30),
    "M-26 -76 V-34 Q-26 -8 0 -8 Q26 -8 26 -34 V-76 H14 V-36 Q14 -20 0 -20 Q-14 -20 -14 -36 V-76Z", rect(-26, -88, 52, 8), rect(-26, -118, 52, 8)],
  plaque: [0, -46, 17],
  body: (fam) => (
    <g>
      <Mound w={62} />
      <Shaft x={-38} y={B} w={28} h={130} round />
      <Shaft x={38} y={B} w={28} h={130} round />
      <path d={crenelD(-52, -24, B - 130, 4, 4, 2.8)} fill={R.cream[HI]} />
      <path d={crenelD(24, 52, B - 130, 4, 4, 2.8)} fill={R.cream[MID]} />
      <Cone x={-38} y={B - 131} w={34} h={30} ramp={fam} />
      <Cone x={38} y={B - 131} w={34} h={30} ramp={fam} />
      {[-110, -80, -50, -26].map((y) => <g key={y}><Win x={-41} y={y} w={6} h={9} /><Win x={35} y={y} w={6} h={9} lit={y === -50} /></g>)}
      {/* the U: the encoder goes down, the decoder comes back up */}
      <path d="M-26 -76 V-34 Q-26 -8 0 -8 Q26 -8 26 -34 V-76 H14 V-36 Q14 -20 0 -20 Q-14 -20 -14 -36 V-76Z" fill={fam[MID]} />
      <path d="M-26 -76 V-34 Q-26 -8 0 -8 L0 -20 Q-14 -20 -14 -36 V-76Z" fill={fam[LIT]} />
      <path d="M-26 -76 V-34 Q-26 -8 0 -8 Q26 -8 26 -34 V-76 H14 V-36 Q14 -20 0 -20 Q-14 -20 -14 -36 V-76Z" fill="url(#pa-bricks)" />
      <path d="M-24.6 -74 V-34 Q-24.6 -10 -2 -9.4" fill="none" stroke={fam[HI]} strokeWidth={1.2} strokeLinecap="round" />
      {/* skip bridges: gold decks with rails, straight across */}
      {[-88, -118].map((y) => (
        <g key={y}>
          <path d={rect(-26, y, 52, 8)} fill={R.gold[LIT]} />
          <path d={rect(-26, y, 52, 8)} fill="url(#pa-planks)" opacity={0.7} />
          <path d={rect(-26, y + 6, 52, 2)} fill={R.gold[SHADE]} />
          <path d={`M-26 ${y - 6} H26 M-18 ${y} V${y - 6} M0 ${y} V${y - 6} M18 ${y} V${y - 6}`} stroke={R.gold[DEEP]} strokeWidth={1.2} />
        </g>
      ))}
      <Tuft x={-56} y={-3} /> <Tuft x={56} y={-3} s={0.9} />
    </g>
  ),
};

// 4 · rnn — loop mill: a water wheel whose water is carried back up to feed it
const rnn: LandmarkDef = {
  H: 150, W: 156, metaphor: "loop mill: the wheel's water is carried back to turn it again",
  sil: [moundD(70), ...box3D(-26, 52, 56, 14, B), poly(-52, B - 56, -26, B - 84, 0, B - 56), poly(-26, -91, -10, -97, 18, -68, 2, -62), circ(32, -48, 36),
    "M46 -12 C92 -16 96 -112 38 -112 C20 -112 8 -104 4 -94 L-2 -98 C4 -112 20 -120 38 -120 C104 -120 100 -8 46 -4Z"],
  plaque: [-38, -36, 17],
  body: (fam) => (
    <g>
      <Mound w={70} ramp={R.sand} />
      <path d={ell(34, -6, 30, 5)} fill="url(#pa-lake)" />
      <Box3 x={-26} y={B} w={52} h={56} d={14} ramp={R.cream} pattern="pa-planks" />
      <path d={poly(-52, B - 56, -26, B - 84, 0, B - 56)} fill={R.cream[HI]} />
      <path d={poly(-26, -91, -10, -97, 18, -68, 2, -62)} fill={fam[MID]} />
      <path d={poly(-26, -91, -10, -97, 18, -68, 2, -62)} fill="url(#pa-tiles)" />
      <path d={poly(-56, -60, -26, -92, -24, -88, -52, -58)} fill={fam[LIT]} />
      <path d="M-26 -91 L2 -62" stroke={fam[SHADE]} strokeWidth={2.4} strokeLinecap="round" />
      <circle cx={-26} cy={-72} r={3.2} fill={P.window} />
      <Door x={-18} y={-26} w={9} h={20} />
      {/* the wheel */}
      <circle cx={32} cy={-48} r={33} fill={R.wood[DEEP]} />
      <circle cx={31} cy={-49} r={32} fill={R.wood[MID]} />
      <circle cx={31} cy={-49} r={25} fill={R.cream[MID]} />
      <circle cx={31} cy={-49} r={25} fill="url(#pa-turn)" />
      {Array.from({ length: 12 }, (_, k) => {
        const a = (k * Math.PI) / 6;
        const c = Math.cos(a), s = Math.sin(a);
        return <g key={k}>
          <path d={`M${31 + c * 5} ${-49 + s * 5}L${31 + c * 25} ${-49 + s * 25}`} stroke={R.wood[SHADE]} strokeWidth={1.8} />
          <path d={poly(31 + c * 26 - s * 3, -49 + s * 26 + c * 3, 31 + c * 36 - s * 3, -49 + s * 36 + c * 3, 31 + c * 36 + s * 3, -49 + s * 36 - c * 3, 31 + c * 26 + s * 3, -49 + s * 26 - c * 3)} fill={k % 2 ? R.wood[LIT] : R.wood[MID]} />
        </g>;
      })}
      <path d="M2 -60 A32 32 0 0 1 20 -79" fill="none" stroke={R.wood[HI]} strokeWidth={2} strokeLinecap="round" />
      <circle cx={31} cy={-49} r={5} fill={R.gold[MID]} />
      <circle cx={30} cy={-50} r={2} fill={R.gold[HI]} />
      {/* the recurrence: a trough carries the water from the bottom back to the top */}
      <path d="M46 -8 C96 -12 98 -116 38 -116 C20 -116 8 -108 2 -96" fill="none" stroke={R.wood[SHADE]} strokeWidth={8} strokeLinecap="round" />
      <path d="M46 -8 C96 -12 98 -116 38 -116 C20 -116 8 -108 2 -96" fill="none" stroke={R.blue[LIT]} strokeWidth={4} strokeLinecap="round" />
      <path d="M60 -12 C88 -20 92 -90 60 -110" fill="none" stroke="#FFFFFF" strokeWidth={1.2} strokeDasharray="4 5" strokeLinecap="round" />
      <path d="M2 -92 Q0 -86 3 -80 M7 -90 Q6 -84 8 -79" stroke={R.blue[LIT]} strokeWidth={2} strokeLinecap="round" fill="none" />
      <circle cx={4} cy={-74} r={1.6} fill={R.blue[LIT]} />
      {[[80, -40], [88, -70]].map(([x, y], i) => <path key={i} d={`M${x} ${y} l3 ${i ? -4 : 4} l3 ${i ? 4 : -4}`} stroke="#FFFFFF" strokeWidth={1.6} fill="none" strokeLinecap="round" />)}
    </g>
  ),
};

// 5 · transformer — attention spire: one needle, gold threads to many heads (the capital)
const HEADS: [number, number][] = [[-70, 40], [-46, 54], [46, 54], [70, 40]];
const transformer: LandmarkDef = {
  H: 236, W: 176, metaphor: "attention spire: one needle, gold threads to every head",
  sil: [moundD(86), ...box3D(0, 116, 9, 12, B), ...box3D(0, 94, 9, 10, B - 9), ...box3D(0, 72, 9, 8, B - 18),
    poly(-14, -24, 14, -24, 9, -150, -9, -150), poly(-11, -148, 11, -148, 0, -228), circ(0, -166, 10),
    ...HEADS.flatMap(([x, h]) => [shaftD(x, 16, h, -12), circ(x, -12 - h, 9)])],
  plaque: [0, -70, 22],
  body: (fam) => (
    <g>
      <Mound w={86} ramp={R.sand} />
      <Box3 x={0} y={B} w={116} h={9} d={12} ramp={R.cream} top />
      <Box3 x={0} y={B - 9} w={94} h={9} d={10} ramp={R.cream} top />
      <Box3 x={0} y={B - 18} w={72} h={9} d={8} ramp={R.cream} top />
      {/* heads: domed turrets around the plinth */}
      {HEADS.map(([x, h], i) => (
        <g key={i}>
          <Shaft x={x} y={-12} w={16} h={h} ramp={R.cream} round pattern="pa-stone" />
          <path d={`M${x - 9} ${-12 - h} A9 9 0 0 1 ${x + 9} ${-12 - h}Z`} fill={fam[MID]} />
          <path d={`M${x - 9} ${-12 - h} A9 9 0 0 1 ${x} ${-21 - h} V${-12 - h}Z`} fill={fam[LIT]} />
          <path d={rect(x - 9.5, -13 - h, 19, 2.4)} fill={R.gold[MID]} />
          <path d={`M${x - 2} ${-h + 6} v-4 a2 2 0 0 1 4 0 v4Z`} fill={i % 2 ? P.windowLit : P.window} />
          <circle cx={x} cy={-22 - h} r={2.2} fill={R.gold[LIT]} />
        </g>
      ))}
      {/* the needle: banded shaft, the attention orb, a slender gold spire */}
      <path d={poly(-14, -24, 14, -24, 9, -150, -9, -150)} fill={R.cream[LIT]} />
      <path d={poly(4, -24, 14, -24, 9, -150, 3, -150)} fill={R.cream[SHADE]} />
      <path d={poly(-14, -24, 14, -24, 9, -150, -9, -150)} fill="url(#pa-stone)" />
      {[-44, -100, -134].map((y) => { const w = 14 - ((-24 - y) / 126) * 5; return <g key={y}><path d={rect(-w - 1, y, w * 2 + 2, 4)} fill={fam[MID]} /><path d={rect(-w - 1, y, w * 2 + 2, 1.4)} fill={fam[HI]} /></g>; })}
      <Win x={-3} y={-124} w={6} h={9} lit />
      <LitEdge d="M-13.6 -26 L-8.6 -148" w={1.4} />
      <path d={poly(-11, -148, 0, -228, 0, -148)} fill={R.gold[LIT]} />
      <path d={poly(0, -148, 0, -228, 11, -148)} fill={R.gold[SHADE]} />
      <path d={rect(-12, -150, 24, 4)} fill={R.gold[DEEP]} />
      <circle cx={0} cy={-166} r={10} fill={R.gold[MID]} stroke={P.die} strokeWidth={2} />
      <circle cx={0} cy={-166} r={16} fill="url(#pa-glow)" />
      <circle cx={-3} cy={-169} r={3.2} fill={R.gold[HI]} />
      {/* attention: gold threads from the orb to every head */}
      {HEADS.map(([x, h], i) => {
        const tx = x, ty = -22 - h, mx = (tx) * 0.55, my = -150 + (ty + 150) * 0.2;
        return (
          <g key={`t${i}`}>
            <path d={`M0 -166 Q${mx} ${my} ${tx} ${ty}`} fill="none" stroke={P.die} strokeWidth={3} strokeLinecap="round" />
            <path d={`M0 -166 Q${mx} ${my} ${tx} ${ty}`} fill="none" stroke={R.gold[MID]} strokeWidth={1.5} strokeLinecap="round" />
          </g>
        );
      })}
      <Door x={-7} y={-38} w={14} h={14} />
      <Glint x={-6} y={-205} r={3} streak={false} />
    </g>
  ),
};

// 6 · mamba — serpent-coil tower: a snake scanning its way up
const HELIX = (() => {
  const pts: { x: number; y: number; front: boolean }[] = [];
  for (let i = 0; i <= 120; i++) {
    const t = (i / 120) * Math.PI * 6.2 + Math.PI;
    pts.push({ x: 25 * Math.cos(t), y: -18 - i * 0.92 + 7 * Math.sin(t), front: Math.sin(t) > 0 });
  }
  const segs: { d: string; front: boolean }[] = [];
  let cur = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`, front = pts[0].front;
  for (let i = 1; i < pts.length; i++) {
    cur += `L${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
    if (pts[i].front !== front || i === pts.length - 1) {
      segs.push({ d: cur, front });
      cur = `M${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
      front = pts[i].front;
    }
  }
  return { segs, head: pts[pts.length - 1] };
})();
const mamba: LandmarkDef = {
  H: 176, W: 120, metaphor: "serpent-coil tower: a snake scanning its way up",
  sil: [moundD(54), shaftD(0, 34, 130, B), crenelD(-19, 19, B - 130, 5, 5, 3), rect(-31, -130, 62, 118), ell(HELIX.head.x + 4, HELIX.head.y - 12, 10, 7)],
  plaque: [0, -20, 16],
  body: (fam) => {
    const snake = R.pine;
    const tube = (d: string, back: boolean, i: number) => (
      <g key={`${back ? "b" : "f"}${i}`}>
        <path d={d} fill="none" stroke={back ? snake[DEEP] : P.die} strokeWidth={back ? 9 : 12} strokeLinecap="round" strokeLinejoin="round" />
        {!back && <path d={d} fill="none" stroke={snake[MID]} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />}
        {!back && <path d={d} fill="none" stroke={snake[LIT]} strokeWidth={3} strokeLinecap="round" transform="translate(-1 -2.4)" />}
        {!back && <path d={d} fill="none" stroke={snake[DEEP]} strokeWidth={2} strokeDasharray="1.5 4" strokeLinecap="round" transform="translate(0 2)" />}
      </g>
    );
    const h = HELIX.head;
    return (
      <g>
        <Mound w={54} ramp={R.sand} />
        {HELIX.segs.filter((s) => !s.front).map((s, i) => tube(s.d, true, i))}
        <Shaft x={0} y={B} w={34} h={130} round ramp={R.cream} />
        <path d={crenelD(-19, 19, B - 130, 5, 5, 3)} fill={R.cream[HI]} />
        <path d={rect(-19, B - 131, 38, 3)} fill={fam[MID]} />
        <Win x={-3} y={-58} w={6} h={9} />
        <Win x={-3} y={-104} w={6} h={9} lit />
        {HELIX.segs.filter((s) => s.front).map((s, i) => tube(s.d, false, i))}
        {/* the head rises over the parapet, tongue out */}
        <path d={`M${h.x} ${h.y} Q${h.x + 2} ${h.y - 8} ${h.x + 4} ${h.y - 10}`} stroke={snake[MID]} strokeWidth={8} strokeLinecap="round" fill="none" />
        <ellipse cx={h.x + 4} cy={h.y - 12} rx={10} ry={7} fill={snake[MID]} stroke={P.die} strokeWidth={1.6} />
        <ellipse cx={h.x + 1} cy={h.y - 15} rx={6} ry={3} fill={snake[LIT]} />
        <circle cx={h.x + 7} cy={h.y - 14} r={2.4} fill="#FFFFFF" />
        <circle cx={h.x + 7.6} cy={h.y - 14} r={1.3} fill={P.ink} />
        <path d={`M${h.x + 13} ${h.y - 10} l6 1 l3 -2 M${h.x + 19} ${h.y - 9} l3 2`} stroke={R.red[MID]} strokeWidth={1.3} strokeLinecap="round" fill="none" />
        <Tuft x={-40} y={-3} ramp={R.lime} />
      </g>
    );
  },
};

// 7 · vae — hourglass keep: wide, a glowing bottleneck, wide again
const vae: LandmarkDef = {
  H: 168, W: 120, metaphor: "hourglass keep: everything squeezes through a glowing bottleneck",
  sil: [moundD(54), poly(-42, B, 42, B, 12, -76, -12, -76), poly(-12, -88, 12, -88, 42, -148, -42, -148), rect(-14, -90, 28, 16), crenelD(-44, 44, -148, 6, 6, 4), coneD(0, -154, 30, 14)],
  plaque: [0, -34, 19],
  body: (fam) => (
    <g>
      <Mound w={54} ramp={R.rock} />
      {/* lower half */}
      <path d={poly(-42, B, 42, B, 12, -76, -12, -76)} fill={R.cream[LIT]} />
      <path d={poly(14, B, 42, B, 12, -76, 5, -76)} fill={R.cream[SHADE]} />
      <path d={poly(-42, B, 42, B, 12, -76, -12, -76)} fill="url(#pa-stone)" />
      <LitEdge d="M-41 -8 L-12 -75" w={1.3} />
      {/* upper half (inverted) */}
      <path d={poly(-12, -88, 12, -88, 42, -148, -42, -148)} fill={R.cream[LIT]} />
      <path d={poly(5, -88, 12, -88, 42, -148, 18, -148)} fill={R.cream[SHADE]} />
      <path d={poly(-12, -88, 12, -88, 42, -148, -42, -148)} fill="url(#pa-stone)" />
      <path d={rect(-44, -152, 88, 5)} fill={fam[MID]} />
      <path d={rect(-44, -152, 88, 1.6)} fill={fam[HI]} />
      <path d={crenelD(-44, 44, -152, 6, 6, 4)} fill={R.cream[HI]} />
      <Cone x={0} y={-156} w={30} h={14} ramp={fam} />
      {[-30, -8, 14].map((x) => <Win key={x} x={x - 3} y={-138} w={6} h={9} lit={x === -8} />)}
      {[-18, 10].map((x) => <Win key={x} x={x - 3} y={-118} w={6} h={8} />)}
      {[-24, 18].map((x) => <Win key={x} x={x - 3} y={-52} w={6} h={9} />)}
      {/* the bottleneck: a lantern waist, glowing, grains falling through */}
      <path d={rect(-14, -90, 28, 16)} fill={fam[SHADE]} />
      <path d={rect(-10, -88, 20, 12)} fill={R.gold[HI]} />
      <circle cx={0} cy={-82} r={24} fill="url(#pa-glow)" />
      <path d="M-14 -90 H14 M-14 -74 H14" stroke={R.gold[MID]} strokeWidth={2.4} />
      {[[-2, -70], [1, -66], [-1, -62], [2, -96], [-2, -99]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.2} fill={R.gold[LIT]} />)}
      <Door x={-6} y={-20} w={12} h={14} />
    </g>
  ),
};

// 8 · gan — duelling towers: red forger vs blue critic, swords crossed
const Sword = ({ x0, y0, x1, y1 }: { x0: number; y0: number; x1: number; y1: number }) => {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const P2 = (t: number, o: number) => [x0 + ux * t + nx * o, y0 + uy * t + ny * o];
  return (
    <g>
      <path d={poly(...P2(14, -2.6), ...P2(L - 6, -2.6), ...P2(L, 0), ...P2(L - 6, 2.6), ...P2(14, 2.6))} fill={P.die} stroke={P.die} strokeWidth={3} strokeLinejoin="round" />
      <path d={poly(...P2(14, -2.6), ...P2(L - 6, -2.6), ...P2(L, 0), ...P2(14, 0))} fill={R.snow[LIT]} />
      <path d={poly(...P2(14, 0), ...P2(L, 0), ...P2(L - 6, 2.6), ...P2(14, 2.6))} fill={R.rock[LIT]} />
      <path d={poly(...P2(12, -9), ...P2(15, -9), ...P2(15, 9), ...P2(12, 9))} fill={R.gold[MID]} stroke={P.die} strokeWidth={1} />
      <path d={poly(...P2(2, -2), ...P2(12, -2), ...P2(12, 2), ...P2(2, 2))} fill={R.wood[MID]} />
      <circle cx={P2(0, 0)[0]} cy={P2(0, 0)[1]} r={3} fill={R.gold[LIT]} stroke={P.die} strokeWidth={1} />
    </g>
  );
};
const gan: LandmarkDef = {
  H: 176, W: 150, metaphor: "duelling towers: the red forger and the blue critic, swords crossed",
  sil: [moundD(66), shaftD(-40, 34, 110, B), shaftD(40, 34, 110, B), coneD(-40, B - 114, 42, 34), coneD(40, B - 114, 42, 34), ...box3D(0, 46, 34, 6, B)],
  plaque: [0, -24, 17],
  body: () => (
    <g>
      <Mound w={66} />
      {([[-40, R.red], [40, R.blue]] as const).map(([x, rp], i) => (
        <g key={i}>
          <Shaft x={x} y={B} w={34} h={110} ramp={R.cream} round />
          {[-30, -62, -94].map((y) => <path key={y} d={rect(x - 17, y, 34, 5)} fill={rp[MID]} />)}
          <path d={rect(x - 19, B - 114, 38, 5)} fill={rp[LIT]} />
          <path d={crenelD(x - 19, x + 19, B - 114, 4, 5, 3)} fill={rp[LIT]} />
          <Cone x={x} y={B - 118} w={42} h={30} ramp={rp} />
          <Win x={x - 3 + (i ? -6 : 6)} y={-80} w={6} h={9} lit />
          <path d={`M${x + (i ? -8 : 8)} -56 h8 v14 l-4 -3 l-4 3Z`} fill={rp[MID]} transform={`translate(${i ? -4 : -4} 0)`} />
          <Pennant x={x} y={B - 148} h={14} ramp={rp} />
        </g>
      ))}
      <Box3 x={0} y={B} w={46} h={34} d={6} ramp={R.cream} />
      <path d={crenelD(-23, 23, B - 34, 4, 5, 3.4)} fill={R.cream[HI]} />
      {/* crossed swords between the towers, a spark where they meet */}
      <Sword x0={-26} y0={-60} x1={26} y1={-150} />
      <Sword x0={26} y0={-60} x1={-26} y1={-150} />
      <path d="M0 -118 l3 -8 l2 7 l8 -1 l-6 5 l5 6 l-7 -2 l-4 7 l-1 -8 l-8 1 l6 -5Z" fill={R.gold[HI]} stroke={P.die} strokeWidth={1} />
    </g>
  ),
};

export const LANDMARKS_A: Record<string, LandmarkDef> = { classifier, tabular_classifier, segmentation, rnn, transformer, mamba, vae, gan };
export { B };
