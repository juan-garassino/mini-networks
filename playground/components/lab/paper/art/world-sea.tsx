// The storybook sea: a sailing ship and a friendly sea serpent. The water
// itself is the `pa-sea-paint` surface (painted wave strokes) in ArtDefs.
import { memo } from "react";
import { Art, type ArtProps, Cutout, StandUp } from "./materials";
import { INK, S, HI, LIT, MID, SHADE, DEEP } from "./palette";
import { circ, ell, poly } from "./geom";

/** A three-masted sailing ship with billowing square sails and red flags. design H 84. */
export const SailingShip = memo(function SailingShip({ facing = 1, ...p }: ArtProps & { facing?: 1 | -1 }) {
  const hull = "M-34 -18 L34 -20 L40 -30 L44 -30 Q40 -8 28 0 L-26 0 Q-36 -6 -40 -24 L-34 -24Z";
  const stern = poly(-40, -24, -40, -36, -26, -36, -24, -20);
  const sail = (x: number, y: number, w: number, h: number) => `M${x - w / 2} ${y} Q${x} ${y + 3} ${x + w / 2} ${y} Q${x + w / 2 + 3} ${y + h / 2} ${x + w / 2} ${y + h} Q${x} ${y + h + 4} ${x - w / 2} ${y + h} Q${x - w / 2 + 3} ${y + h / 2} ${x - w / 2} ${y}Z`;
  const sails = [sail(-14, -64, 20, 16), sail(-14, -46, 24, 18), sail(8, -74, 22, 18), sail(8, -54, 28, 22), sail(28, -56, 16, 14)];
  const masts = "M-14 -20 V-70 M8 -20 V-82 M28 -22 V-62";
  return (
    <Art design={84} {...p} flip={facing === -1}>
      <path d={ell(2, 0, 44, 5)} fill="#FFFFFF" opacity={0.5} />
      <path d="M-58 2 Q-44 -3 -30 2 M-70 5 Q-60 1 -50 5" stroke="#FFFFFF" strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <Cutout d={[hull, stern, ...sails]} rim={1.8} depth={1.6} shadow="drop" lift={0.4} ink={1}>
        <path d={masts} stroke={S.wood[DEEP]} strokeWidth={2} />
        <path d="M-40 -36 L-14 -70 L8 -82 L44 -30" stroke={S.wood[SHADE]} strokeWidth={0.6} fill="none" />
        {sails.map((d, i) => (
          <g key={i}>
            <path d={d} fill={S.parch[HI]} />
            <path d={d} fill={S.parch[MID]} opacity={0.6} transform="translate(3 2)" />
          </g>
        ))}
        <path d={hull} fill={S.wood[MID]} />
        <path d="M-34 -18 L34 -20 L33 -14 L-33 -12Z" fill={S.wood[LIT]} />
        <path d="M-32 -9 L30 -11" stroke={S.roofRed[MID]} strokeWidth={2.4} />
        <path d="M16 -20 L40 -30 L44 -30 Q40 -8 28 0 L12 0Z" fill={S.wood[SHADE]} opacity={0.8} />
        <path d={stern} fill={S.wood[SHADE]} />
        <path d={poly(-38, -34, -30, -34, -30, -28, -38, -28)} fill="#FFE27A" />
        {[-20, -8, 4, 16].map((x) => <circle key={x} cx={x} cy={-15} r={1.3} fill={INK} />)}
      </Cutout>
      {[[-14, -70], [8, -82], [28, -62]].map(([x, y], i) => <path key={i} d={`M${x} ${y} L${x + 8} ${y - 2} L${x} ${y - 5}Z`} fill={S.roofRed[LIT]} stroke={INK} strokeWidth={0.6} />)}
    </Art>
  );
});

/** A friendly sea serpent: humps rising from foam rings, a frilled head. design H 62. */
export const SeaSerpent = memo(function SeaSerpent(p: ArtProps) {
  const hump = (x: number, w: number, h: number) => `M${x - w / 2} 0 Q${x - w / 2} ${-h} ${x} ${-h} Q${x + w / 2} ${-h} ${x + w / 2} 0 H${x + w / 2 - 6} Q${x + w / 2 - 6} ${-h + 7} ${x} ${-h + 7} Q${x - w / 2 + 6} ${-h + 7} ${x - w / 2 + 6} 0Z`;
  const humps = [hump(-40, 22, 16), hump(-12, 26, 22)];
  const neck = "M8 0 Q6 -30 22 -44 Q30 -52 40 -50 L44 -42 Q34 -42 28 -34 Q20 -22 22 0Z";
  const head = ell(44, -48, 11, 7);
  const frill = poly(22, -44, 18, -56, 26, -52, 26, -62, 32, -54, 36, -60);
  const tail = "M-62 0 Q-60 -10 -66 -16 Q-58 -12 -56 0Z";
  return (
    <Art design={62} {...p}>
      {[-40, -12, 15, -59].map((x, i) => <ellipse key={i} cx={x} cy={0} rx={i === 2 ? 16 : 14} ry={3} fill="#FFFFFF" opacity={0.7} />)}
      <StandUp d={[...humps, neck, head, frill, tail]} foot={0.1} rim={1.8} depth={1.4} ink={1.1} shadow="none">
        {[...humps, neck, tail].map((d, i) => <path key={i} d={d} fill={S.reef[MID]} />)}
        <path d="M8 0 Q6 -30 22 -44 Q14 -30 14 0Z" fill={S.reef[LIT]} />
        <path d={frill} fill={S.cyan[MID]} />
        <path d={head} fill={S.reef[MID]} />
        <path d={ell(42, -51, 7, 3)} fill={S.reef[HI]} />
        <circle cx={46} cy={-50} r={2.2} fill="#FFFFFF" />
        <circle cx={46.6} cy={-50} r={1.2} fill={INK} />
        <path d="M50 -45 Q53 -44 55 -46" stroke={INK} strokeWidth={0.9} fill="none" strokeLinecap="round" />
        {[-46, -40, -34, -18, -12, -6].map((x, i) => <path key={i} d={`M${x} ${i < 3 ? -13 : -19} l2 -4 l2 4Z`} fill={S.autumn[LIT]} />)}
        <path d="M12 -8 Q12 -26 20 -36" stroke={S.reef[DEEP]} strokeWidth={1} strokeDasharray="1.4 2.4" fill="none" />
        <path d={circ(40, -48, 0.1)} fill={INK} />
      </StandUp>
    </Art>
  );
});

