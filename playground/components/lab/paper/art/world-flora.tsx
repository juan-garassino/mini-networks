// Storybook vegetation and creatures for the world map: ink-lined conifers,
// broadleaf and autumn trees, snowy pines, a deer, an ice-crystal spire,
// coral and jellyfish, and ForestCluster — a lush, depth-sorted forest patch.
// <Art> props: base-centre (x, y), `size` px tall.
import { memo } from "react";
import { Art, type ArtProps, Cutout, Glint, StandUp } from "./materials";
import { INK, S, HI, LIT, MID, SHADE, DEEP, type Ramp } from "./palette";
import { blob, ell, poly, rng } from "./geom";
import { crystalFacets } from "./setpieces";

type Lobe = readonly [number, number, number];
const lobed = (ls: readonly Lobe[], dx: number, dy: number, k: number) => blob(ls.map(([x, y, r]) => [x + r * dx, y + r * dy, r * k] as const));

/** A storybook conifer: three serrated tiers, lit left halves, ink edge. design H 40. */
export const Conifer = memo(function Conifer({ ramp = S.forest, snow = false, ...p }: ArtProps & { ramp?: Ramp; snow?: boolean }) {
  const tier = (y: number, w: number, h: number) => {
    const pts: number[] = [0, y - h, w, y];
    const teeth = 4;
    for (let i = teeth * 2 - 1; i >= 1; i--) pts.push(-w + (i * 2 * w) / (teeth * 2), y - (i % 2 ? 2.4 : 0));
    pts.push(-w, y);
    return poly(...pts);
  };
  const tiers = [tier(-6, 11, 16), tier(-16, 8.6, 14), tier(-25, 6, 13)];
  const trunk = poly(-1.6, 0, 1.6, 0, 1.4, -7, -1.4, -7);
  return (
    <Art design={40} {...p}>
      <StandUp d={[trunk, ...tiers]} foot={7} rim={1.4} depth={1.2} ink={0.9}>
        <path d={trunk} fill={S.wood[SHADE]} />
        {tiers.map((d, i) => <path key={i} d={d} fill={ramp[i === 2 ? MID : SHADE]} />)}
        {[[-6, 11, 16], [-16, 8.6, 14], [-25, 6, 13]].map(([y, w, h], i) => (
          <path key={`l${i}`} d={poly(0, y - h, -w * 0.15, y - 1, -w, y)} fill={ramp[i === 2 ? LIT : MID]} />
        ))}
        <path d="M-3 -30 L0 -38 L1 -33" stroke={ramp[HI]} strokeWidth={0.9} fill="none" strokeLinecap="round" />
        {snow && <path d="M0 -38 L-4 -30 Q-2 -31 0 -29 Q2 -31 4 -30Z M-6 -20 Q-3 -22 0 -20 Q3 -22 6 -20 L0 -28Z M-9 -10 Q-4 -12 0 -10 Q4 -12 9 -10 L0 -19Z" fill={S.snow[LIT]} />}
      </StandUp>
    </Art>
  );
});

/** A round broadleaf tree (or `autumn`): lobed crown in four tones. design H 40. */
export const Broadleaf = memo(function Broadleaf({ autumn = false, ramp, ...p }: ArtProps & { autumn?: boolean; ramp?: Ramp }) {
  const rp = ramp ?? (autumn ? S.autumn : S.grass);
  const ls: Lobe[] = [[-8, -22, 8], [0, -30, 9.5], [8, -22, 8], [0, -20, 8]];
  const trunk = poly(-1.8, 0, 1.8, 0, 1.4, -14, -1.4, -14);
  return (
    <Art design={40} {...p}>
      <StandUp d={[trunk, blob(ls)]} foot={7} rim={1.4} depth={1.2} ink={0.9}>
        <path d={trunk} fill={S.wood[MID]} />
        <path d={blob(ls)} fill={rp[SHADE]} />
        <path d={lobed(ls, -0.12, -0.16, 0.86)} fill={rp[MID]} />
        <path d={lobed(ls, -0.3, -0.36, 0.5)} fill={rp[LIT]} />
        <path d={lobed(ls, -0.42, -0.5, 0.16)} fill={rp[HI]} />
      </StandUp>
    </Art>
  );
});

/** A lush forest patch: n trees scattered (deterministically) in a w×h ellipse,
 *  sorted back-to-front, back rows darker and smaller — the layered forest. */
export const ForestCluster = memo(function ForestCluster({ x = 0, y = 0, w = 120, h = 50, n = 18, seed = 1, mix = "conifer", tree = 30, snow = false }: {
  x?: number; y?: number; w?: number; h?: number; n?: number; seed?: number;
  /** conifer | broadleaf | autumn | mixed | fall (autumn + conifer) */
  mix?: "conifer" | "broadleaf" | "autumn" | "mixed" | "fall"; tree?: number; snow?: boolean;
}) {
  const r = rng(seed);
  const trees: { x: number; y: number; k: number; kind: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r());
    trees.push({ x: Math.cos(a) * d * w / 2, y: Math.sin(a) * d * h / 2, k: 0.75 + r() * 0.45, kind: r() });
  }
  trees.sort((a, b) => a.y - b.y);
  return (
    <g transform={`translate(${x} ${y})`}>
      {trees.map((t, i) => {
        const back = (t.y + h / 2) / h;   // 0 back → 1 front
        const s = tree * t.k * (0.82 + back * 0.25);
        const kind = mix === "conifer" ? 0 : mix === "broadleaf" ? 1 : mix === "autumn" ? 2 : mix === "fall" ? (t.kind < 0.5 ? 0 : 2) : t.kind < 0.45 ? 0 : t.kind < 0.8 ? 1 : 2;
        return (
          <g key={i} opacity={0.82 + back * 0.18}>
            {kind === 0 ? <Conifer x={t.x} y={t.y} size={s} snow={snow} ramp={back < 0.35 ? darker(S.forest) : S.forest} />
              : kind === 1 ? <Broadleaf x={t.x} y={t.y} size={s * 0.9} />
                : <Broadleaf x={t.x} y={t.y} size={s * 0.9} autumn />}
          </g>
        );
      })}
    </g>
  );
});
const darker = (rp: Ramp): Ramp => [rp[MID], rp[SHADE], rp[SHADE], rp[DEEP], rp[DEEP]];

/** A deer standing in the snow (stand-up silhouette). design H 36. */
export const Deer = memo(function Deer(p: ArtProps) {
  const body = "M-12 -14 Q-14 -20 -8 -21 L6 -21 Q10 -21 11 -24 L13 -30 Q14 -34 17 -33 L19 -31 Q20 -29 17 -27 L15 -20 Q14 -15 10 -14Z";
  const legs = poly(-11, -15, -9, -15, -9, 0, -11, 0) + poly(-6, -15, -4, -15, -4, 0, -6, 0) + poly(5, -15, 7, -15, 7, 0, 5, 0) + poly(9, -15, 11, -15, 11, 0, 9, 0);
  const antlers = "M15 -33 L13 -40 L10 -42 M13 -40 L15 -44 M17 -33 L19 -40 L22 -41 M19 -40 L18 -44";
  return (
    <Art design={36} {...p}>
      <StandUp d={[body, legs]} foot={11} rim={1.4} depth={1} ink={0.9}>
        <path d={legs} fill={S.wood[SHADE]} />
        <path d={body} fill={S.wood[MID]} />
        <path d="M-12 -14 Q-14 -20 -8 -21 L6 -21 Q2 -18 -2 -16 Q-8 -14 -12 -14Z" fill={S.wood[LIT]} />
        <path d="M-6 -15 Q0 -13 8 -15" stroke={S.parch[LIT]} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        <circle cx={16.4} cy={-30.6} r={0.9} fill={INK} />
        <path d="M-13 -19 l-2 -2" stroke={S.parch[HI]} strokeWidth={1.6} strokeLinecap="round" />
      </StandUp>
      <path d={antlers} stroke={S.wood[DEEP]} strokeWidth={1.1} fill="none" strokeLinecap="round" />
    </Art>
  );
});

/** A tall ice-crystal spire (representation's snowy plateau). design H 96. */
export const CrystalSpire = memo(function CrystalSpire(p: ArtProps) {
  const ice: Ramp = ["#E6F8FF", "#9EDCF6", "#5EB4E4", "#3A84C0", "#27588E"];
  const cr = [crystalFacets(0, 0, 22, 62, -0.02), crystalFacets(-15, 0, 13, 32, -0.35), crystalFacets(14, 0, 14, 38, 0.3), crystalFacets(-24, 0, 8, 16, -0.6), crystalFacets(24, 0, 8, 18, 0.62)];
  return (
    <Art design={96} {...p}>
      <circle cx={0} cy={-50} r={40} fill="url(#pa-glow)" opacity={0.35} />
      <StandUp d={cr.map((c) => c.sil)} foot={24} rim={2} depth={1.6} ink={1}>
        {cr.map((c, i) => (
          <g key={i}>
            <path d={c.left} fill={ice[LIT]} />
            <path d={c.front} fill={ice[MID]} />
            <path d={c.right} fill={ice[SHADE]} />
            <path d={c.tipL} fill={ice[HI]} />
            <path d={c.tipF} fill={ice[LIT]} />
            <path d={c.tipR} fill={ice[MID]} />
            <path d={c.streak} stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={1.2} strokeLinecap="round" />
          </g>
        ))}
        <path d="M-26 0 Q0 -6 26 0Z" fill={S.snow[LIT]} />
      </StandUp>
      <Glint x={-3} y={-84} r={3.4} streak={false} />
    </Art>
  );
});

/** Branching coral (pink or orange), for the underwater zone. design H 30. */
export const Coral = memo(function Coral({ ramp = S.pink, ...p }: ArtProps & { ramp?: Ramp }) {
  const br = "M0 0 V-10 M0 -10 L-7 -18 L-8 -26 M-7 -18 L-12 -22 M0 -10 L5 -20 L4 -28 M5 -20 L11 -24 L12 -29 M0 -6 L8 -10";
  return (
    <Art design={30} {...p}>
      <path d={br} stroke="#FFFFFF" strokeOpacity={0.8} strokeWidth={5.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={br} stroke={INK} strokeOpacity={0.5} strokeWidth={4.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={br} stroke={ramp[MID]} strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={br} stroke={ramp[HI]} strokeWidth={1} fill="none" strokeLinecap="round" transform="translate(-0.6 -0.6)" />
    </Art>
  );
});

/** A glowing jellyfish drifting (no ground shadow). design H 40. */
export const Jellyfish = memo(function Jellyfish({ ramp = S.pink, ...p }: ArtProps & { ramp?: Ramp }) {
  const bell = "M-11 -26 Q-11 -40 0 -40 Q11 -40 11 -26 Q8 -24 5 -26 Q2 -24 0 -26 Q-2 -24 -5 -26 Q-8 -24 -11 -26Z";
  return (
    <Art design={40} {...p}>
      <circle cx={0} cy={-30} r={18} fill="url(#pa-glow)" opacity={0.5} />
      <path d="M-7 -25 Q-9 -14 -5 -4 M-2 -25 Q-4 -12 0 0 M3 -25 Q1 -14 4 -6 M7 -25 Q9 -16 6 -8" stroke={ramp[LIT]} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <Cutout d={bell} rim={1.4} depth={1} shadow="none" ink={0.8}>
        <path d={bell} fill={ramp[LIT]} opacity={0.9} />
        <path d={ell(-3, -33, 5, 4)} fill={ramp[HI]} />
        <path d="M-8 -28 Q0 -31 8 -28" stroke={ramp[SHADE]} strokeWidth={0.9} fill="none" />
      </Cutout>
    </Art>
  );
});
