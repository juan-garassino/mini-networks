// Atom landmarks, part B: diffusion, pixelcnn, simclr, gnn, nerf and the
// three decision atoms. Same contract as part A (see LandmarkDef there).
import { Glint, LitEdge } from "./materials";
import { P, R, HI, LIT, MID, SHADE, DEEP } from "./palette";
import { circ, ell, poly, rect, rng } from "./geom";
import { Door, Pennant, Tuft, Win } from "./bits";
import { Box3, box3D, Cone, coneD, crenelD, Mound, moundD, Shaft, shaftD } from "./landmark-kit";
import { Die } from "./setpieces";
import { PaperCloud } from "./sky";
import { B, type LandmarkDef } from "./landmarks-a";

// 9 · diffusion — mist pagoda: a pagoda condensing out of cloud
const PAGODA = [0, 1, 2, 3].map((i) => ({ i, w: 46 - i * 8, y0: -16 - i * 30, h: 20 }));
const eave = (w: number, y: number) => `M${-w / 2 - 14} ${y + 2} Q${-w / 2 - 6} ${y - 1} ${-w / 2 + 2} ${y - 8} L${w / 2 - 2} ${y - 8} Q${w / 2 + 6} ${y - 1} ${w / 2 + 14} ${y + 2} Q0 ${y - 3} ${-w / 2 - 14} ${y + 2}Z`;
const diffusion: LandmarkDef = {
  H: 176, W: 140, metaphor: "mist pagoda: a building condensing out of noise",
  sil: [...PAGODA.flatMap((t) => [rect(-t.w / 2, t.y0 - t.h, t.w, t.h + 2), eave(t.w, t.y0 - t.h)]), poly(-3, -144, 3, -144, 0, -170), rect(-44, -26, 88, 26)],
  plaque: [0, -88, 16],
  body: (fam) => (
    <g>
      {PAGODA.map((t) => (
        <g key={t.i} opacity={t.i === 0 ? 0.55 : t.i === 1 ? 0.85 : 1}>
          <path d={rect(-t.w / 2, t.y0 - t.h, t.w, t.h + 2)} fill={R.cream[LIT]} />
          <path d={rect(t.w / 2 - t.w * 0.28, t.y0 - t.h, t.w * 0.28, t.h + 2)} fill={R.cream[SHADE]} />
          <path d={rect(-t.w / 2, t.y0 - t.h, t.w, t.h + 2)} fill="url(#pa-planks)" opacity={0.4} />
          {[-t.w / 2 + 4, t.w / 2 - 7].map((x) => <path key={x} d={rect(x, t.y0 - t.h, 3, t.h + 2)} fill={R.red[MID]} />)}
          <path d={eave(t.w, t.y0 - t.h)} fill={fam[MID]} />
          <path d={`M${-t.w / 2 - 14} ${t.y0 - t.h + 2} Q${-t.w / 2 - 6} ${t.y0 - t.h - 1} ${-t.w / 2 + 2} ${t.y0 - t.h - 8} L0 ${t.y0 - t.h - 8} L0 ${t.y0 - t.h - 1.6} Q${-t.w / 4} ${t.y0 - t.h - 1} ${-t.w / 2 - 14} ${t.y0 - t.h + 2}Z`} fill={fam[LIT]} />
          <path d={eave(t.w, t.y0 - t.h)} fill="url(#pa-tiles)" />
          <path d={`M${-t.w / 2 - 14} ${t.y0 - t.h + 2} Q0 ${t.y0 - t.h - 3} ${t.w / 2 + 14} ${t.y0 - t.h + 2}`} stroke={fam[DEEP]} strokeWidth={1.4} fill="none" />
          {t.i > 1 && <Win x={-3} y={t.y0 - t.h + 5} w={6} h={9} lit={t.i === 3} />}
        </g>
      ))}
      <path d="M0 -140 V-172" stroke={R.gold[MID]} strokeWidth={2.4} />
      {[-148, -154, -160].map((y) => <ellipse key={y} cx={0} cy={y} rx={4} ry={1.4} fill={R.gold[LIT]} />)}
      <circle cx={0} cy={-172} r={2.6} fill={R.gold[HI]} />
      {/* mist streaks rising off the lower tiers */}
      <path d="M-40 -40 Q-30 -44 -20 -40 M18 -50 Q28 -54 38 -50 M-36 -62 Q-28 -65 -20 -62" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" fill="none" strokeDasharray="6 4" />
      <PaperCloud x={-26} y={2} size={34} variant={0} />
      <PaperCloud x={30} y={4} size={30} variant={1} />
      <PaperCloud x={0} y={10} size={26} variant={2} />
    </g>
  ),
};

// 10 · pixelcnn — block tower built row by row, the next block on the hoist
const COLS = 6, ROWS = 9, BS = 11;
const PIX = (() => {
  const r = rng(42);
  const ramps = [R.violet, R.pink, R.teal, R.gold, R.blue, R.orange];
  return Array.from({ length: ROWS * COLS }, () => ramps[Math.floor(r() * ramps.length)]);
})();
const pixelcnn: LandmarkDef = {
  H: 160, W: 124, metaphor: "block tower built row by row: each block only sees those before it",
  sil: [moundD(56), ...box3D(0, 76, 8, 10, B), rect(-33, B - 8 - ROWS * BS + BS, COLS * BS, (ROWS - 1) * BS), rect(-33, B - 8 - ROWS * BS, 3 * BS, BS),
    poly(33, B - 8, 43, B - 12, 43, B - 8 - (ROWS - 1) * BS - 4, 33, B - 8 - (ROWS - 1) * BS), rect(30, -150, 3, 58), rect(-6, -152, 40, 4)],
  plaque: [0, -52, 18],
  body: () => {
    const y0 = B - 8;
    return (
      <g>
        <Mound w={56} ramp={R.rock} />
        <Box3 x={0} y={B} w={76} h={8} d={10} ramp={R.cream} top />
        {/* right side face of the stack, one shaded block per row */}
        <path d={poly(33, y0, 43, y0 - 4.5, 43, y0 - (ROWS - 1) * BS - 4.5, 33, y0 - (ROWS - 1) * BS)} fill={R.rock[SHADE]} />
        {Array.from({ length: ROWS * COLS }, (_, k) => {
          const row = Math.floor(k / COLS), col = k % COLS;
          const x = -33 + col * BS, y = y0 - (row + 1) * BS;
          const placed = row < ROWS - 1 || col < 3;
          if (!placed) return <rect key={k} x={x + 0.6} y={y + 0.6} width={BS - 1.2} height={BS - 1.2} rx={1} fill="none" stroke={P.pencil} strokeWidth={0.9} strokeDasharray="2 1.6" />;
          const rp = PIX[k];
          return (
            <g key={k}>
              <rect x={x} y={y} width={BS} height={BS} fill={rp[MID]} />
              <path d={`M${x} ${y + BS} V${y} H${x + BS} L${x + BS - 2} ${y + 2} H${x + 2} V${y + BS - 2}Z`} fill={rp[HI]} />
              <path d={`M${x + BS} ${y} V${y + BS} H${x} L${x + 2} ${y + BS - 2} H${x + BS - 2} V${y + 2}Z`} fill={rp[SHADE]} />
            </g>
          );
        })}
        {/* the hoist: a post, a boom, the next block swinging in */}
        <path d={rect(30, -150, 3, 58)} fill={R.wood[MID]} />
        <path d={rect(-6, -152, 40, 4)} fill={R.wood[LIT]} />
        <path d="M31 -148 L10 -134" stroke={R.wood[SHADE]} strokeWidth={1.6} />
        <path d="M-2 -148 V-126" stroke={P.ink} strokeWidth={0.9} />
        <rect x={-7.5} y={-126} width={BS} height={BS} fill={PIX[ROWS * COLS - 3][MID]} stroke={P.die} strokeWidth={1.4} />
        <path d="M-7.5 -115 V-126 H3.5" fill="none" stroke={PIX[ROWS * COLS - 3][HI]} strokeWidth={2} />
        <path d="M6 -122 l4 2 M6 -118 l4 0" stroke={P.inkSoft} strokeWidth={0.9} strokeLinecap="round" />
      </g>
    );
  },
};

// 11 · simclr — magnet twins: a horseshoe magnet arch pulling two twin towers together
const MAG_OUT = "M-52 -10 V-96 A52 52 0 0 1 52 -96 V-10 H30 V-96 A30 30 0 0 0 -30 -96 V-10Z";
const simclr: LandmarkDef = {
  H: 164, W: 130, metaphor: "magnet twins: two views of one thing, pulled together",
  sil: [moundD(64), MAG_OUT, shaftD(-15, 14, 46, B), shaftD(15, 14, 46, B), coneD(-15, B - 46, 20, 16), coneD(15, B - 46, 20, 16)],
  plaque: [0, -134, 16],
  body: (fam) => (
    <g>
      <Mound w={64} />
      {/* field lines between the poles */}
      <path d="M-30 -30 Q0 -44 30 -30 M-30 -20 Q0 -28 30 -20 M-30 -40 Q0 -62 30 -40" stroke={R.snow[SHADE]} strokeWidth={1.2} strokeDasharray="3 3" fill="none" />
      {/* twin towers leaning in */}
      {[-15, 15].map((x, i) => (
        <g key={x} transform={`rotate(${i ? -5 : 5} ${x} ${B})`}>
          <Shaft x={x} y={B} w={14} h={46} round ramp={R.cream} />
          <Cone x={x} y={B - 46} w={20} h={16} ramp={fam} />
          <Win x={x - 2.5} y={-38} w={5} h={8} lit={i === 1} />
        </g>
      ))}
      {/* the magnet arch */}
      <path d={MAG_OUT} fill={R.red[MID]} />
      <path d="M-52 -10 V-96 A52 52 0 0 1 0 -148 V-126 A30 30 0 0 0 -30 -96 V-10Z" fill={R.red[LIT]} />
      <path d="M30 -10 V-96 A30 30 0 0 0 22 -117 L38 -132 A52 52 0 0 1 52 -96 V-10Z" fill={R.red[SHADE]} />
      <path d="M-50 -14 V-96 A50 50 0 0 1 -18 -142" fill="none" stroke={R.red[HI]} strokeWidth={1.8} strokeLinecap="round" />
      {/* pole pieces: silver feet, N and S */}
      {[-41, 41].map((x, i) => (
        <g key={x}>
          <path d={rect(x - 11, -30, 22, 22)} fill={i ? R.rock[MID] : R.snow[MID]} />
          <path d={rect(x - 11, -30, 8, 22)} fill={R.snow[LIT]} />
          <path d={rect(x + 5, -30, 6, 22)} fill={R.rock[SHADE]} />
          <text x={x} y={-15} textAnchor="middle" fontSize={11} fontFamily="var(--paper-display), system-ui" fill={P.ink}>{i ? "S" : "N"}</text>
        </g>
      ))}
      <Glint x={-40} y={-116} r={3} streak={false} />
    </g>
  ),
};

// 12 · gnn — graph pavilions on stilts, linked by plank walkways (nodes + edges)
const NODES: [number, number, number][] = [[-50, -48, 15], [0, -92, 17], [50, -42, 14], [14, -14, 12]];   // x, platform y, radius
const EDGES: [number, number][] = [[0, 1], [1, 2], [0, 3], [2, 3], [1, 3]];
const pavilionSil = ([x, y, r]: [number, number, number]) => [ell(x, y, r, r * 0.34), rect(x - r * 0.8, y - r * 1.1, r * 1.6, r * 1.1), poly(x - r * 1.05, y - r * 1.05, x, y - r * 2, x + r * 1.05, y - r * 1.05)];
const gnn: LandmarkDef = {
  H: 150, W: 150, metaphor: "graph pavilions: nodes on stilts, messages passed along walkways",
  sil: [moundD(66), ...NODES.flatMap(pavilionSil), ...NODES.map(([x, y]) => rect(x - 2, y, 4, -y))],
  plaque: [-24, -18, 15],
  body: (fam) => (
    <g>
      <Mound w={66} />
      {NODES.map(([x, y], i) => <g key={`s${i}`}><path d={rect(x - 2, y, 4, -y - 4)} fill={R.wood[SHADE]} /><path d={rect(x - 2, y, 1.4, -y - 4)} fill={R.wood[LIT]} /></g>)}
      {/* walkways: plank ribbons with rope rails */}
      {EDGES.map(([a, b], i) => {
        const [x0, y0] = NODES[a], [x1, y1] = NODES[b];
        const d = `M${x0} ${y0} L${x1} ${y1}`;
        return (
          <g key={`e${i}`}>
            <path d={d} stroke={P.die} strokeWidth={7} strokeLinecap="round" />
            <path d={d} stroke={R.wood[LIT]} strokeWidth={4.4} strokeLinecap="round" />
            <path d={d} stroke={R.wood[SHADE]} strokeWidth={4.4} strokeDasharray="0.8 2.6" />
            <path d={`M${x0} ${y0 - 6} L${x1} ${y1 - 6}`} stroke={R.sand[SHADE]} strokeWidth={0.9} />
            <circle cx={(x0 + x1) / 2} cy={(y0 + y1) / 2 - 3} r={2} fill={fam[LIT]} stroke={P.die} strokeWidth={0.8} />
          </g>
        );
      })}
      {NODES.map(([x, y, r], i) => (
        <g key={`n${i}`}>
          <path d={ell(x, y, r, r * 0.34)} fill={R.wood[MID]} />
          <path d={ell(x, y - 1.2, r, r * 0.3)} fill={R.wood[LIT]} />
          {[-0.7, -0.25, 0.25, 0.7].map((k) => <path key={k} d={rect(x + k * r - 1, y - r * 1.05, 2, r * 1.05)} fill={k > 0.5 ? R.cream[SHADE] : R.cream[LIT]} />)}
          <path d={poly(x - r * 1.05, y - r * 1.05, x, y - r * 2, x, y - r * 1.05)} fill={fam[LIT]} />
          <path d={poly(x, y - r * 1.05, x, y - r * 2, x + r * 1.05, y - r * 1.05)} fill={fam[SHADE]} />
          <path d={`M${x - r * 1.05} ${y - r * 1.05} Q${x} ${y - r * 0.8} ${x + r * 1.05} ${y - r * 1.05}`} stroke={fam[DEEP]} strokeWidth={1.4} fill="none" />
          <circle cx={x} cy={y - r * 2 - 1.6} r={1.8} fill={R.gold[LIT]} />
        </g>
      ))}
      <path d="M-24 0 V-10" stroke={R.wood[MID]} strokeWidth={2.4} />
    </g>
  ),
};

// 13 · nerf — orbit observatory: cameras circling a domed scene
const RING = { cx: 0, cy: -96, rx: 70, ry: 16 };
const ringPt = (t: number) => [RING.cx + RING.rx * Math.cos(t), RING.cy + RING.ry * Math.sin(t)] as const;
const CAMS = [0.35, 1.3, 2.4, 3.6, 4.6, 5.5];
const nerf: LandmarkDef = {
  H: 150, W: 150, metaphor: "orbit observatory: cameras circling one scene from every side",
  sil: [moundD(64), shaftD(0, 72, 50, B), circ(0, B - 50, 35), poly(2, -112, 40, -126, 42, -120, 4, -106)],
  plaque: [0, -28, 17],
  body: (fam) => {
    const arc = (a: number, b: number) => {
      const [x0, y0] = ringPt(a), [x1, y1] = ringPt(b);
      return `M${x0} ${y0} A${RING.rx} ${RING.ry} 0 0 ${b > a ? 1 : 0} ${x1} ${y1}`;
    };
    const cam = (t: number, i: number) => {
      const [x, y] = ringPt(t);
      const toward = Math.atan2(-86 - y, RING.cx - x);
      return (
        <g key={i} transform={`translate(${x} ${y}) rotate(${(toward * 180) / Math.PI})`}>
          <rect x={-6} y={-4} width={10} height={8} rx={1.4} fill={P.ink} stroke={P.die} strokeWidth={1} />
          <circle cx={5} cy={0} r={3.2} fill={R.blue[LIT]} stroke={P.die} strokeWidth={0.8} />
        </g>
      );
    };
    return (
      <g>
        <Mound w={62} ramp={R.rock} />
        {/* back of the ring and the cameras behind the dome */}
        <path d={arc(Math.PI, Math.PI * 2)} fill="none" stroke={R.gold[SHADE]} strokeWidth={2.6} />
        {CAMS.filter((t) => Math.sin(t) < 0).map((t, i) => cam(t, i))}
        {/* drum + dome */}
        <Shaft x={0} y={B} w={72} h={50} round ramp={R.cream} />
        <path d={rect(-37, B - 52, 74, 5)} fill={fam[MID]} />
        <path d={`M-35 ${B - 50} A35 35 0 0 1 35 ${B - 50}Z`} fill={R.snow[SHADE]} />
        <path d={`M-35 ${B - 50} A35 35 0 0 1 0 ${B - 85} V${B - 50}Z`} fill={R.snow[MID]} />
        <path d={`M-31 ${B - 58} A33 33 0 0 1 -8 ${B - 83}`} stroke="#FFFFFF" strokeWidth={3} fill="none" strokeLinecap="round" />
        <path d={`M14 ${B - 50} A35 35 0 0 0 20 ${B - 78} L27 ${B - 71} A35 35 0 0 1 35 ${B - 50}Z`} fill={R.rock[LIT]} />
        <path d={`M-4 ${B - 50} V${B - 84} H5 V${B - 50}Z`} fill="#2E2238" />
        <path d="M2 -112 L40 -126 L42 -120 L4 -106Z" fill={R.gold[MID]} stroke={P.die} strokeWidth={1.2} />
        <circle cx={41} cy={-123} r={3.8} fill={R.blue[LIT]} stroke={P.die} strokeWidth={1} />
        <Win x={-26} y={-44} w={6} h={9} />
        <Win x={20} y={-44} w={6} h={9} lit />
        {/* front of the ring, the front cameras, their sight lines to the dome */}
        {CAMS.filter((t) => Math.sin(t) >= 0).map((t, i) => { const [x, y] = ringPt(t); return <path key={`l${i}`} d={`M${x} ${y} L0 -86`} stroke={R.gold[LIT]} strokeWidth={0.7} strokeDasharray="2 2" />; })}
        <path d={arc(0, Math.PI)} fill="none" stroke={P.die} strokeWidth={5} />
        <path d={arc(0, Math.PI)} fill="none" stroke={R.gold[MID]} strokeWidth={2.8} />
        {CAMS.filter((t) => Math.sin(t) >= 0).map((t, i) => cam(t, i + 10))}
      </g>
    );
  },
};

// 14 · reinforce — dice keep: a squat round keep rolling the policy dice
const reinforce: LandmarkDef = {
  H: 160, W: 140, metaphor: "dice keep: act by rolling the policy, keep what paid off",
  sil: [moundD(60), shaftD(0, 60, 74, B), crenelD(-32, 32, B - 74, 6, 6, 4), poly(-4, -132, 18, -121, 18, -92, -4, -81, -26, -92, -26, -121), circ(48, -122, 16)],
  plaque: [-10, -36, 18],
  body: (fam) => (
    <g>
      <Mound w={60} ramp={R.lime} />
      <Shaft x={0} y={B} w={60} h={74} round ramp={R.cream} />
      <path d={rect(-32, B - 76, 64, 4)} fill={fam[MID]} />
      <path d={crenelD(-32, 32, B - 76, 6, 6, 4)} fill={R.cream[HI]} />
      <Win x={-20} y={-68} w={6} h={9} />
      <Win x={10} y={-68} w={6} h={9} lit />
      <Door x={10} y={-26} w={11} h={20} />
      <path d="M-24 -54 h8 v14 l-4 -3 l-4 3Z" fill={fam[MID]} />
      {/* the die on the roof, a second die mid-roll */}
      <Die cx={-4} cy={-106} s={22} />
      <g transform="rotate(24 48 -122)"><Die cx={48} cy={-114} s={12} /></g>
      <path d="M22 -128 Q32 -142 42 -138 M24 -118 Q32 -128 38 -126" stroke={P.inkSoft} strokeWidth={1.1} fill="none" strokeLinecap="round" strokeDasharray="3 2" />
      <Pennant x={28} y={-84} h={16} ramp={fam} emblem="dot" />
    </g>
  ),
};

// 15 · rl_maze — maze fort: a walled fort whose courtyard is the maze
const U = (u: number, v: number) => [-62 + 112 * u + 22 * v, -34 - 46 * v] as const;
const MAZE: [number, number, number, number][] = [
  [0.2, 0, 0.2, 0.6], [0.4, 0.2, 0.4, 1], [0.6, 0, 0.6, 0.4], [0.6, 0.6, 0.6, 1], [0.8, 0.2, 0.8, 0.8],
  [0, 0.4, 0.2, 0.4], [0.4, 0.6, 0.6, 0.6], [0.6, 0.4, 0.8, 0.4], [0.2, 0.8, 0.4, 0.8], [0.8, 0.8, 1, 0.8],
];
const rl_maze: LandmarkDef = {
  H: 124, W: 160, metaphor: "maze fort: find the path to the flag, value by value",
  sil: [moundD(74), rect(-62, -34, 112, 28), poly(50, -6, 50, -34, 72, -80, 72, -52), poly(...U(0, 0), ...U(1, 0), ...U(1, 1), ...U(0, 1)),
    shaftD(-62, 18, 52, B), shaftD(50, 18, 52, B), coneD(-62, B - 52, 24, 20), coneD(50, B - 52, 24, 20)],
  plaque: [-12, -20, 15],
  body: (fam) => (
    <g>
      <Mound w={74} ramp={R.lime} />
      {/* the courtyard plane, maze walls standing on it */}
      <path d={poly(...U(0, 0), ...U(1, 0), ...U(1, 1), ...U(0, 1))} fill={R.sand[LIT]} />
      <path d={poly(...U(0, 0), ...U(1, 0), ...U(1, 1), ...U(0, 1))} fill="url(#pa-cobble)" opacity={0.35} />
      {MAZE.map(([u0, v0, u1, v1], i) => {
        const [x0, y0] = U(u0, v0), [x1, y1] = U(u1, v1);
        return (
          <g key={i}>
            <path d={`M${x0} ${y0} L${x1} ${y1}`} stroke={R.lime[DEEP]} strokeWidth={5} strokeLinecap="round" />
            <path d={`M${x0} ${y0 - 4} L${x1} ${y1 - 4}`} stroke={R.lime[MID]} strokeWidth={5} strokeLinecap="round" />
            <path d={`M${x0 - 1} ${y0 - 5.6} L${x1 - 1} ${y1 - 5.6}`} stroke={R.lime[HI]} strokeWidth={1.4} strokeLinecap="round" />
          </g>
        );
      })}
      {/* the learned route: dotted footprints to the goal flag */}
      <path d={[[0.1, 0.05], [0.1, 0.7], [0.3, 0.7], [0.3, 0.9], [0.5, 0.9], [0.5, 0.5], [0.7, 0.5], [0.7, 0.9], [0.9, 0.9]].map(([u, v], i) => `${i ? "L" : "M"}${U(u, v)[0]} ${U(u, v)[1]}`).join("")}
        fill="none" stroke={R.red[MID]} strokeWidth={2} strokeDasharray="2 2.6" strokeLinecap="round" />
      <path d={`M${U(0.9, 0.9)[0]} ${U(0.9, 0.9)[1]} V${U(0.9, 0.9)[1] - 16}`} stroke={P.ink} strokeWidth={1.2} />
      <path d={`M${U(0.9, 0.9)[0]} ${U(0.9, 0.9)[1] - 16} l9 3 l-9 3Z`} fill={R.gold[LIT]} stroke={P.die} strokeWidth={0.8} />
      {/* outer walls */}
      <path d={rect(-62, -34, 112, 28)} fill={R.cream[LIT]} />
      <path d={poly(50, -6, 50, -34, 72, -80, 72, -52)} fill={R.cream[SHADE]} />
      <path d={rect(-62, -34, 112, 28) + poly(50, -6, 50, -34, 72, -80, 72, -52)} fill="url(#pa-stone)" />
      <path d={rect(-62, -34, 112, 28)} fill="url(#pa-occl)" />
      <path d={crenelD(-60, 48, -34, 4, 5, 4)} fill={R.cream[HI]} />
      <path d="M26 -6 V-20 A8 8 0 0 1 42 -20 V-6Z" fill="#2E2238" />
      {[-62, 50].map((x) => (
        <g key={x}>
          <Shaft x={x} y={B} w={18} h={52} round ramp={R.cream} />
          <Cone x={x} y={B - 52} w={24} h={20} ramp={fam} />
        </g>
      ))}
      <LitEdge d="M-61.5 -8 V-34" w={1.2} />
    </g>
  ),
};

// 16 · alphazero — a chess rook with a search tree climbing it
const TREE = (() => {
  // root at the foot, branching up the shaft; pv = principal variation
  const n: { x: number; y: number; v: number }[] = [
    { x: 30, y: -12, v: 1 }, { x: 22, y: -44, v: 1 }, { x: 40, y: -40, v: 0 },
    { x: 14, y: -80, v: 1 }, { x: 32, y: -76, v: 0 }, { x: 46, y: -70, v: 0 },
    { x: 6, y: -118, v: 1 }, { x: 24, y: -112, v: 0 }, { x: -12, y: -138, v: 1 }, { x: 16, y: -140, v: 0 },
  ];
  const e: [number, number, boolean][] = [[0, 1, true], [0, 2, false], [1, 3, true], [1, 4, false], [2, 5, false], [3, 6, true], [3, 7, false], [6, 8, true], [6, 9, false]];
  return { n, e };
})();
const alphazero: LandmarkDef = {
  H: 160, W: 120, metaphor: "a rook with its search tree climbing it: look ahead, then move",
  sil: [moundD(54), ell(0, -10, 34, 8), rect(-34, -18, 68, 10), poly(-24, -18, 24, -18, 19, -96, -19, -96), rect(-26, -104, 52, 10), rect(-24, -124, 48, 20), crenelD(-24, 24, -124, 10, 10, 3)],
  plaque: [-4, -58, 18],
  body: () => {
    const iv = R.cream;
    return (
      <g>
        <Mound w={54} ramp={R.lime} />
        {/* the rook: foot, shaft, collar, crown */}
        <path d={ell(0, -10, 34, 8)} fill={iv[SHADE]} />
        <path d={rect(-34, -18, 68, 10)} fill={iv[LIT]} />
        <path d={rect(14, -18, 20, 10)} fill={iv[SHADE]} />
        <path d={ell(0, -18, 34, 6)} fill={iv[HI]} />
        <path d={poly(-24, -18, 24, -18, 19, -96, -19, -96)} fill={iv[LIT]} />
        <path d={poly(8, -18, 24, -18, 19, -96, 6, -96)} fill={iv[SHADE]} />
        <path d={poly(-24, -18, 24, -18, 19, -96, -19, -96)} fill="url(#pa-turn)" />
        <LitEdge d="M-23 -20 L-18.6 -94" w={1.4} />
        <path d={rect(-26, -104, 52, 10)} fill={iv[MID]} />
        <path d={rect(-26, -104, 52, 3)} fill={iv[HI]} />
        <path d={rect(-24, -124, 48, 20)} fill={iv[LIT]} />
        <path d={rect(8, -124, 16, 20)} fill={iv[SHADE]} />
        <path d={crenelD(-24, 24, -124, 10, 10, 3)} fill={iv[LIT]} />
        <path d="M-2 -114 v-4 a2 2 0 0 1 4 0 v4Z" fill={P.window} />
        {/* the search tree: edges (principal variation in gold), nodes */}
        {TREE.e.map(([a, b, pv], i) => {
          const A = TREE.n[a], Bn = TREE.n[b];
          const d = `M${A.x} ${A.y} Q${(A.x + Bn.x) / 2 + 6} ${(A.y + Bn.y) / 2} ${Bn.x} ${Bn.y}`;
          return (
            <g key={i}>
              <path d={d} stroke={P.die} strokeWidth={pv ? 7 : 5} fill="none" strokeLinecap="round" />
              <path d={d} stroke={pv ? R.gold[MID] : R.leaf[MID]} strokeWidth={pv ? 4 : 2.6} fill="none" strokeLinecap="round" />
            </g>
          );
        })}
        {TREE.n.map((n, i) => (
          <g key={`n${i}`}>
            <circle cx={n.x} cy={n.y} r={i ? 5.4 : 6.4} fill={P.die} />
            <circle cx={n.x} cy={n.y} r={i ? 4.2 : 5.2} fill={n.v ? R.gold[LIT] : R.leaf[MID]} />
            <circle cx={n.x - 1} cy={n.y - 1} r={1} fill="#FFFFFF" opacity={0.8} />
          </g>
        ))}
        {[[-4, -44], [32, -60], [38, -96]].map(([x, y], i) => <path key={i} d={`M${x} ${y} q6 -6 12 -1.5 q-6 4.5 -12 1.5Z`} fill={R.leaf[LIT]} stroke={P.die} strokeWidth={0.6} />)}
        <Tuft x={-40} y={-3} />
      </g>
    );
  },
};

export const LANDMARKS_B: Record<string, LandmarkDef> = { diffusion, pixelcnn, simclr, gnn, nerf, reinforce, rl_maze, alphazero };
