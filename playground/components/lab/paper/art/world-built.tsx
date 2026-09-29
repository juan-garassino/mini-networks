// Storybook buildings for the six lands: the red-roofed castle, waterwheel
// houses, Wild West storefronts + windpump + chessboard + hedge maze, the
// lava forge's black castle, neon cyberpunk towers, underwater glass domes.
// <Art> props: base-centre (x, y), `size` px tall.
import { memo, type ReactNode } from "react";
import { Art, type ArtProps, Glint, LitEdge, StandUp } from "./materials";
import { INK, P, R, S, HI, LIT, MID, SHADE, DEEP, type Ramp } from "./palette";
import { circ, ell, poly, rect, rng } from "./geom";
import { Door, Pennant, Win } from "./bits";
import { Box3, box3D, Cone, coneD, crenelD, Shaft, shaftD } from "./landmark-kit";
import { STORY_FONT } from "./storyfont";
import { Coral } from "./world-flora";

// ── Sequence: the red-roofed castle + waterwheel house ─────────────────
const TOWERS: [number, number, number, number][] = [[-44, 16, 62, 26], [-22, 20, 92, 34], [4, 24, 112, 40], [28, 18, 80, 30], [48, 14, 56, 24]]; // x, w, h, roof h
export const StoryCastle = memo(function StoryCastle({ roof = S.roofRed, ...p }: ArtProps & { roof?: Ramp }) {
  const wall = rect(-54, -40, 108, 40);
  const sil = [wall, crenelD(-54, 54, -40, 5, 6, 4), ...TOWERS.flatMap(([x, w, h, rh]) => [shaftD(x, w, h), coneD(x, -h, w + 8, rh)])];
  return (
    <Art design={156} {...p}>
      <StandUp d={sil} foot={52} rim={2.4} depth={2.4} ink={1.2}>
        {TOWERS.map(([x, w, h, rh], i) => (
          <g key={i}>
            <Shaft x={x} w={w} h={h} ramp={S.parch} round />
            <Cone x={x} y={-h} w={w + 8} h={rh} ramp={roof} />
            <Win x={x - 2.5} y={-h + 10} w={5} h={8} lit={i === 2} />
            {h > 70 && <Win x={x - 2.5} y={-h + 34} w={5} h={8} />}
          </g>
        ))}
        <path d={wall} fill={S.parch[LIT]} />
        <path d={rect(26, -40, 28, 40)} fill={S.parch[SHADE]} />
        <path d={wall} fill="url(#pa-stone)" />
        <path d={wall} fill="url(#pa-occl)" />
        <path d={crenelD(-54, 54, -40, 5, 6, 4)} fill={S.parch[HI]} />
        <path d="M-10 0 V-20 A10 10 0 0 1 10 -20 V0Z" fill={S.parch[MID]} />
        <path d="M-7 0 V-19 A7 7 0 0 1 7 -19 V0Z" fill="#3A2436" />
        <path d="M-4.5 0 V-24 M0 0 V-26 M4.5 0 V-24 M-7 -8 H7 M-7 -16 H7" stroke={S.stone[LIT]} strokeWidth={0.8} />
        {[-40, -26, 22, 38].map((x) => <Win key={x} x={x} y={-30} w={5} h={8} />)}
      </StandUp>
      {[[-22, -126], [4, -152], [28, -110]].map(([x, y], i) => <Pennant key={i} x={x} y={y} h={14} ramp={i === 1 ? R.gold : roof} />)}
    </Art>
  );
});

export const WaterwheelHouse = memo(function WaterwheelHouse({ roof = S.roofRed, ...p }: ArtProps & { roof?: Ramp }) {
  const walls = box3D(-8, 34, 30, 10);
  const roofD = poly(-28, -30, -8, -48, 12, -30) + poly(-8, -48, 2, -52, 20, -35, 12, -30);
  const wheel = circ(20, -16, 16);
  return (
    <Art design={60} {...p}>
      <path d="M22 2 Q34 -2 48 4" stroke={S.sea[LIT]} strokeWidth={5} fill="none" strokeLinecap="round" />
      <StandUp d={[...walls, roofD, wheel]} foot={24} rim={1.8} depth={1.6} ink={1}>
        <Box3 x={-8} w={34} h={30} d={10} ramp={S.parch} pattern="pa-planks" />
        {/* half-timbering */}
        <path d="M-25 -15 H9 M-18 0 V-30 M-2 0 V-30 M-25 -30 L-10 -15 M9 -30 L-6 -15" stroke={S.wood[SHADE]} strokeWidth={1.4} />
        <path d={poly(-28, -30, -8, -48, 12, -30)} fill={S.parch[HI]} />
        <path d={poly(-8, -48, 2, -52, 20, -35, 12, -30)} fill={roof[MID]} />
        <path d={poly(-8, -48, 2, -52, 20, -35, 12, -30)} fill="url(#pa-tiles)" />
        <path d={poly(-30, -29, -8, -49, -8, -46, -27, -29)} fill={roof[LIT]} />
        <circle cx={-8} cy={-37} r={2.4} fill={P.window} />
        <Door x={-14} y={-14} w={7} h={14} />
        <circle cx={20} cy={-16} r={16} fill={S.wood[SHADE]} />
        <circle cx={20} cy={-16} r={11} fill={S.wood[LIT]} />
        {Array.from({ length: 8 }, (_, k) => { const a = (k * Math.PI) / 4; return <path key={k} d={`M${20 + Math.cos(a) * 3} ${-16 + Math.sin(a) * 3}L${20 + Math.cos(a) * 16} ${-16 + Math.sin(a) * 16}`} stroke={S.wood[DEEP]} strokeWidth={1.6} />; })}
        <circle cx={20} cy={-16} r={2.6} fill={R.gold[MID]} />
        <path d="M6 -24 A16 16 0 0 1 14 -31" stroke={S.wood[HI]} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      </StandUp>
      <path d="M30 -2 q3 -4 6 0 q3 -4 6 0" stroke="#FFFFFF" strokeWidth={1.2} fill="none" />
    </Art>
  );
});

// ── Decision: the Wild West ────────────────────────────────────────────
const SIGNS = ["SALOON", "GENERAL", "BANK", "SHERIFF"];
/** A false-front western storefront; `variant` 0..3 changes shape, colour and sign. design H 56. */
export const Storefront = memo(function Storefront({ variant = 0, ...p }: ArtProps & { variant?: number }) {
  const v = ((variant % 4) + 4) % 4;
  const wall: Ramp = [S.wood, S.sand, S.roofRed, S.stone][v];
  const front = v === 0 ? "M-20 0 V-44 H-12 Q-12 -50 -6 -50 H6 Q12 -50 12 -44 H20 V0Z"
    : v === 1 ? "M-20 0 V-46 H-14 V-50 H14 V-46 H20 V0Z"
      : v === 2 ? "M-20 0 V-44 L0 -52 L20 -44 V0Z" : "M-20 0 V-48 H20 V0Z";
  const side = poly(20, 0, 30, -4, 30, -34, 20, -30);
  return (
    <Art design={56} {...p}>
      <StandUp d={[front, side]} foot={22} rim={1.8} depth={1.6} ink={1}>
        <path d={side} fill={wall[DEEP]} />
        <path d={front} fill={wall[MID]} />
        <path d={front} fill="url(#pa-planks)" opacity={0.7} />
        <path d="M-20 0 V-44 H-12 V0Z" fill={wall[LIT]} opacity={0.5} />
        {/* sign board */}
        <path d={rect(-17, -42, 34, 10)} fill={S.parch[LIT]} stroke={INK} strokeOpacity={0.6} strokeWidth={0.8} />
        <text x={0} y={-34.4} textAnchor="middle" fontSize={6.6} fontWeight={800} fill={INK} style={{ fontFamily: STORY_FONT }} letterSpacing={0.3}>{SIGNS[v]}</text>
        {/* porch roof on posts */}
        <path d={poly(-24, -24, 24, -24, 28, -18, -20, -18)} fill={S.wood[SHADE]} />
        <path d={poly(-24, -24, 24, -24, 24.6, -22.6, -23.4, -22.6)} fill={S.wood[HI]} />
        <path d="M-20 -18 V0 M20 -18 V0 M0 -18 V-14" stroke={S.wood[DEEP]} strokeWidth={1.6} />
        <path d={rect(-15, -16, 8, 9)} fill={P.windowLit} stroke={S.wood[DEEP]} strokeWidth={1} />
        <path d={rect(7, -16, 8, 9)} fill={P.window} stroke={S.wood[DEEP]} strokeWidth={1} />
        <path d="M-4 0 V-12 H4 V0" fill="#3A2436" />
        {v === 0 && <path d="M-4 -9 H4 M-4 -5 H4" stroke={S.wood[LIT]} strokeWidth={1.2} />}
        <LitEdge d="M-19.5 -1 V-43" w={1} />
      </StandUp>
    </Art>
  );
});

/** A farm windpump: lattice tower, multi-blade wheel, tail vane, a water tank. design H 92. */
export const Windpump = memo(function Windpump(p: ArtProps) {
  const hub: [number, number] = [2, -76];
  const blades = Array.from({ length: 12 }, (_, k) => {
    const a = (k * Math.PI) / 6;
    const c = Math.cos(a), s = Math.sin(a), q = Math.cos(a + 0.2), w = Math.sin(a + 0.2);
    return poly(hub[0] + c * 4, hub[1] + s * 4, hub[0] + c * 17, hub[1] + s * 17, hub[0] + q * 17, hub[1] + w * 17, hub[0] + q * 4, hub[1] + w * 4);
  });
  const legs = "M-12 0 L-2 -72 M12 0 L2 -72 M-10 -16 L10 -16 M-8 -34 L8 -34 M-5 -52 L5 -52 M-12 0 L8 -34 M12 0 L-8 -34 M-8 -34 L5 -52 M8 -34 L-5 -52";
  return (
    <Art design={92} {...p}>
      <ellipse cx={4} cy={1} rx={18} ry={4} fill={P.shadow} opacity={0.18} />
      <path d={legs} stroke={INK} strokeOpacity={0.6} strokeWidth={2.8} fill="none" strokeLinecap="round" />
      <path d={legs} stroke={S.wood[MID]} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <StandUp d={[rect(14, -14, 16, 14), ell(22, -14, 8, 2.6)]} foot={9} rim={1.4} depth={1} ink={0.9}>
        <path d={rect(14, -14, 16, 14)} fill={S.wood[MID]} />
        <path d={rect(14, -14, 5, 14)} fill={S.wood[LIT]} />
        <path d="M14 -10 H30 M14 -4 H30" stroke={S.stone[SHADE]} strokeWidth={1} />
        <path d={ell(22, -14, 8, 2.6)} fill={S.sea[LIT]} />
      </StandUp>
      <path d={`M${hub[0]} ${hub[1]} L-22 ${hub[1] - 2}`} stroke={S.wood[DEEP]} strokeWidth={1.6} />
      <path d={poly(-34, hub[1] - 10, -20, hub[1] - 4, -20, hub[1] + 2, -34, hub[1] + 6)} fill={S.roofRed[MID]} stroke={INK} strokeOpacity={0.6} strokeWidth={0.9} />
      <circle cx={hub[0]} cy={hub[1]} r={18} fill="#FFFFFF" opacity={0.9} />
      {blades.map((d, i) => <path key={i} d={d} fill={i % 2 ? S.stone[LIT] : S.stone[HI]} stroke={INK} strokeOpacity={0.55} strokeWidth={0.6} />)}
      <circle cx={hub[0]} cy={hub[1]} r={17} fill="none" stroke={S.stone[SHADE]} strokeWidth={1.2} />
      <circle cx={hub[0]} cy={hub[1]} r={3.4} fill={S.roofRed[MID]} stroke={INK} strokeWidth={0.8} />
    </Art>
  );
});

/** A giant chessboard (AlphaZero): a raised tilted board with a few pieces. design H 60. */
export const Chessboard = memo(function Chessboard(p: ArtProps) {
  const Pt = (u: number, v: number) => [-54 + 96 * u + 18 * v, -12 - 30 * v] as const;
  const top = poly(...Pt(0, 0), ...Pt(1, 0), ...Pt(1, 1), ...Pt(0, 1));
  const front = poly(...Pt(0, 0), ...Pt(1, 0), Pt(1, 0)[0], 0, Pt(0, 0)[0], 0);
  const side = poly(...Pt(1, 0), ...Pt(1, 1), Pt(1, 1)[0], Pt(1, 1)[1] + 12, Pt(1, 0)[0], 0);
  const sq: string[] = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) sq.push(poly(...Pt(i / 8, j / 8), ...Pt((i + 1) / 8, j / 8), ...Pt((i + 1) / 8, (j + 1) / 8), ...Pt(i / 8, (j + 1) / 8)));
  const piece = (u: number, v: number, dark: boolean, kind: "rook" | "pawn" | "knight") => {
    const [x, y] = Pt(u, v);
    const c = dark ? S.basalt : S.parch;
    const d = kind === "rook" ? `M${x - 4} ${y} V${y - 10} h1.6 v-2 h1.6 v2 h1.6 v-2 h1.6 v2 h1.6 v10Z`
      : kind === "knight" ? `M${x - 4} ${y} V${y - 4} Q${x - 4} ${y - 12} ${x + 2} ${y - 13} L${x + 4} ${y - 9} L${x + 1} ${y - 8} L${x + 3} ${y}Z`
        : `M${x - 3.4} ${y} Q${x - 3} ${y - 5} ${x - 1.4} ${y - 6} A2.4 2.4 0 1 1 ${x + 1.4} ${y - 6} Q${x + 3} ${y - 5} ${x + 3.4} ${y}Z`;
    return <path key={`${u}${v}`} d={d} fill={c[MID]} stroke={INK} strokeWidth={0.8} />;
  };
  return (
    <Art design={60} {...p}>
      <StandUp d={[top, front, side]} foot={50} rim={2} depth={1.6} ink={1.1}>
        <path d={front} fill={S.wood[MID]} />
        <path d={side} fill={S.wood[DEEP]} />
        <path d={front} fill="url(#pa-planks)" opacity={0.6} />
        <path d={top} fill={S.parch[LIT]} />
        <path d={sq.join("")} fill={S.wood[SHADE]} />
        <path d={top} fill="url(#pa-gloss)" opacity={0.5} />
      </StandUp>
      {piece(0.1, 0.9, true, "rook")}{piece(0.35, 0.7, true, "pawn")}{piece(0.6, 0.55, false, "knight")}{piece(0.8, 0.3, false, "rook")}{piece(0.45, 0.2, false, "pawn")}
    </Art>
  );
});

/** A hedge maze on a tilted lawn (rl_maze). design H 50. */
export const HedgeMaze = memo(function HedgeMaze(p: ArtProps) {
  const Pt = (u: number, v: number) => [-56 + 100 * u + 20 * v, -6 - 34 * v] as const;
  const lawn = poly(...Pt(0, 0), ...Pt(1, 0), ...Pt(1, 1), ...Pt(0, 1));
  const walls: [number, number, number, number][] = [
    [0, 0, 1, 0], [0, 1, 1, 1], [0, 0, 0, 0.8], [1, 0.2, 1, 1],
    [0.15, 0.15, 0.85, 0.15], [0.15, 0.15, 0.15, 0.85], [0.15, 0.85, 0.7, 0.85], [0.85, 0.15, 0.85, 0.7],
    [0.3, 0.3, 0.7, 0.3], [0.3, 0.3, 0.3, 0.7], [0.3, 0.7, 0.55, 0.7], [0.7, 0.3, 0.7, 0.55], [0.45, 0.45, 0.55, 0.45],
  ];
  return (
    <Art design={50} {...p}>
      <path d={lawn} fill={S.grass[LIT]} stroke={INK} strokeOpacity={0.5} strokeWidth={1} transform="translate(2 3)" />
      <path d={lawn} fill={S.grass[MID]} stroke={INK} strokeOpacity={0.6} strokeWidth={1} />
      {walls.sort((a, b) => (b[1] + b[3]) - (a[1] + a[3])).map(([u0, v0, u1, v1], i) => {
        const [x0, y0] = Pt(u0, v0), [x1, y1] = Pt(u1, v1);
        const seg = `M${x0} ${y0} L${x1} ${y1}`;
        return (
          <g key={i}>
            <path d={seg} stroke={INK} strokeOpacity={0.55} strokeWidth={6.4} strokeLinecap="square" />
            <path d={seg} stroke={S.forest[SHADE]} strokeWidth={5} strokeLinecap="square" />
            <path d={seg} stroke={S.forest[MID]} strokeWidth={5} strokeLinecap="square" transform="translate(0 -3)" />
            <path d={seg} stroke={S.forest[HI]} strokeWidth={1.2} strokeDasharray="1 2" transform="translate(-0.6 -4.6)" />
          </g>
        );
      })}
      <circle cx={Pt(0.5, 0.5)[0]} cy={Pt(0.5, 0.5)[1] - 3} r={3.2} fill={R.gold[LIT]} stroke={INK} strokeWidth={0.8} />
    </Art>
  );
});

// ── Generative: lava forge, neon city, dome city ───────────────────────
/** The lava forge's black castle: spiky towers, glowing windows, lava spilling out. design H 130. */
export const LavaCastle = memo(function LavaCastle(p: ArtProps) {
  const T: [number, number, number][] = [[-34, 16, 70], [-12, 20, 96], [12, 18, 110], [34, 14, 64]];
  const spike = (x: number, h: number, w: number) => poly(x - w / 2 - 3, -h, x - w / 4, -h - 10, x, -h - 22, x + w / 4, -h - 10, x + w / 2 + 3, -h);
  const sil = [rect(-44, -36, 88, 36), crenelD(-44, 44, -36, 5, 5, 4), ...T.flatMap(([x, w, h]) => [shaftD(x, w, h), spike(x, h, w)])];
  return (
    <Art design={134} {...p}>
      <StandUp d={sil} foot={44} rim={2} depth={2} ink={1.3}>
        {T.map(([x, w, h], i) => (
          <g key={i}>
            <Shaft x={x} w={w} h={h} ramp={S.basalt} pattern="pa-stone" />
            <path d={spike(x, h, w)} fill={S.basalt[SHADE]} />
            <path d={poly(x - w / 2 - 3, -h, x - w / 4, -h - 10, x, -h - 22, x, -h)} fill={S.basalt[LIT]} />
            {[16, 36, 56].filter((dy) => dy < h - 14).map((dy) => <rect key={dy} x={x - 2.4} y={-h + dy} width={4.8} height={7} rx={2} fill={S.lava[LIT]} />)}
          </g>
        ))}
        <path d={rect(-44, -36, 88, 36)} fill={S.basalt[MID]} />
        <path d={rect(20, -36, 24, 36)} fill={S.basalt[SHADE]} />
        <path d={rect(-44, -36, 88, 36)} fill="url(#pa-stone)" />
        <path d={crenelD(-44, 44, -36, 5, 5, 4)} fill={S.basalt[LIT]} />
        <path d="M-9 0 V-18 A9 9 0 0 1 9 -18 V0Z" fill={S.lava[MID]} />
        <circle cx={0} cy={-10} r={16} fill="url(#pa-glow)" />
        <path d="M-6 0 Q-8 -8 -2 -12 Q0 -6 4 -10 Q6 -4 5 0Z" fill={S.lava[HI]} />
        <path d="M-40 -30 L-38 0 M30 -30 Q34 -16 32 0" stroke={S.lava[MID]} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      </StandUp>
      <path d="M12 -132 q-4 -8 2 -14 q-2 6 3 8" stroke={S.stone[LIT]} strokeOpacity={0.7} strokeWidth={2} fill="none" strokeLinecap="round" />
    </Art>
  );
});

const NEON: { w: number; h: number; top: "flat" | "step" | "spire"; sign: Ramp }[] = [
  { w: 22, h: 96, top: "spire", sign: S.pink }, { w: 18, h: 70, top: "step", sign: S.cyan }, { w: 26, h: 80, top: "flat", sign: S.pink }, { w: 16, h: 110, top: "spire", sign: S.cyan },
];
/** A cyberpunk tower: night-blue slab, window grid, vertical neon sign, antenna light. design H 124. */
export const NeonTower = memo(function NeonTower({ variant = 0, ...p }: ArtProps & { variant?: number }) {
  const t = NEON[((variant % NEON.length) + NEON.length) % NEON.length];
  const [front, side] = box3D(0, t.w, t.h, 7);
  const cap = t.top === "spire" ? poly(-t.w / 4, -t.h, 0, -t.h - 18, t.w / 4, -t.h) : t.top === "step" ? rect(-t.w / 3, -t.h - 8, (t.w * 2) / 3, 8) : rect(-t.w / 2 - 1, -t.h - 3, t.w + 2, 3);
  const r = rng(variant + 5);
  const win: ReactNode[] = [];
  for (let y = -t.h + 8; y < -10; y += 7) for (let x = -t.w / 2 + 3; x < t.w / 2 - 3; x += 5) {
    const q = r();
    win.push(<rect key={`${x}${y}`} x={x} y={y} width={2.6} height={3.4} fill={q < 0.18 ? S.pink[LIT] : q < 0.4 ? S.cyan[LIT] : q < 0.55 ? P.windowLit : S.night[DEEP]} />);
  }
  return (
    <Art design={124} {...p}>
      <StandUp d={[front, side, cap]} foot={t.w * 0.7} rim={1.6} depth={1.4} ink={1}>
        <path d={front} fill={S.night[MID]} />
        <path d={side} fill={S.night[DEEP]} />
        <path d={cap} fill={S.night[SHADE]} />
        {win}
        <path d={rect(-t.w / 2 + 1, -t.h * 0.8, 4, t.h * 0.45)} fill={t.sign[MID]} />
        <path d={rect(-t.w / 2 + 1, -t.h * 0.8, 4, t.h * 0.45)} fill="none" stroke={t.sign[HI]} strokeWidth={0.8} />
        <rect x={-t.w / 2 - 6} y={-t.h * 0.8 - 6} width={16} height={t.h * 0.45 + 12} fill={t.sign[LIT]} opacity={0.12} />
        <LitEdge d={`M${-t.w / 2 + 0.5} -1 V${-t.h + 1}`} w={1} opacity={0.5} />
      </StandUp>
      <path d={`M0 ${-t.h - (t.top === "spire" ? 18 : 8)} v-10`} stroke={S.night[LIT]} strokeWidth={1} />
      <circle cx={0} cy={-t.h - (t.top === "spire" ? 28 : 18)} r={1.8} fill={S.pink[LIT]} />
      <circle cx={0} cy={-t.h - (t.top === "spire" ? 28 : 18)} r={6} fill="url(#pa-glow)" />
    </Art>
  );
});

/** An underwater glass dome with little towers inside and coral at its foot. design H 80. */
export const GlassDome = memo(function GlassDome(p: ArtProps) {
  const dome = "M-34 -8 A34 34 0 0 1 34 -8Z";
  return (
    <Art design={84} {...p}>
      <ellipse cx={4} cy={0} rx={40} ry={7} fill={S.reef[DEEP]} opacity={0.4} />
      <path d={rect(-38, -10, 76, 10)} fill={S.stone[MID]} stroke={INK} strokeOpacity={0.6} strokeWidth={1} />
      <path d={rect(-38, -10, 76, 3)} fill={S.stone[HI]} />
      {/* the city inside */}
      {[[-16, 10, 26, S.roofBlu], [0, 12, 40, S.parch], [16, 9, 22, S.roofBlu]].map(([x, w, h, rp], i) => (
        <g key={i}>
          <Shaft x={x as number} y={-10} w={w as number} h={h as number} ramp={rp as Ramp} pattern={null} />
          <Cone x={x as number} y={-10 - (h as number)} w={(w as number) + 4} h={8} ramp={S.reef} pattern={null} />
        </g>
      ))}
      {/* the glass */}
      <path d={dome} fill="#BFF1FF" opacity={0.28} stroke={INK} strokeOpacity={0.55} strokeWidth={1.1} />
      <path d="M-26 -18 A28 28 0 0 1 -6 -38" stroke="#FFFFFF" strokeWidth={2.4} fill="none" strokeLinecap="round" opacity={0.85} />
      <path d="M-20 -12 A22 22 0 0 1 -12 -26" stroke="#FFFFFF" strokeWidth={1.2} fill="none" strokeLinecap="round" opacity={0.6} />
      <path d="M0 -42 V-8 M-24 -32 Q0 -24 24 -32" stroke="#E6FBFF" strokeWidth={0.7} fill="none" opacity={0.6} />
      <Glint x={-14} y={-34} r={2.6} streak={false} />
      <Coral x={-40} y={2} size={18} />
      <Coral x={42} y={2} size={14} ramp={S.autumn} />
    </Art>
  );
});
