// Cute stand-up paper buildings in 3/4 view: the lit front (gable) wall faces
// the viewer and the key light, the side wall recedes up-right in shade, the
// roof plane catches the light from above. Base-centre at (0, 0).
//
//   Cottage     white walls, red tiled roof, chimney, flag (ref: "white house with red roof and a flag")
//   Townhouse   tall and narrow, slate mansard, shuttered windows
//   Shop        striped awning, big window, a hanging sign
//   RoundHouse  a little round tower with a cone roof
//   CityBlock   three of them clustered (hubs / city spots)
import { memo, type ComponentType } from "react";
import { Art, type ArtProps, LitEdge, StandUp } from "./materials";
import { P, R, HI, LIT, MID, SHADE, DEEP, type Ramp } from "./palette";
import { circ, poly, rect } from "./geom";
import { Door, Pennant, SquareWin, Win } from "./bits";

/** A window drawn on a receding side wall (skewed up-right). */
function SideWin({ x, y, w = 4, h = 6, slope = 6 / 18 }: { x: number; y: number; w?: number; h?: number; slope?: number }) {
  const d = poly(x, y, x + w, y - w * slope, x + w, y - w * slope + h, x, y + h);
  return (
    <g>
      <path d={d} fill={R.cream[MID]} stroke={R.cream[MID]} strokeWidth={1.4} strokeLinejoin="round" />
      <path d={d} fill={P.window} opacity={0.85} />
    </g>
  );
}

export const Cottage = memo(function Cottage({ roof = R.red, wall = R.cream, flag = true, ...p }: ArtProps & { roof?: Ramp; wall?: Ramp; flag?: boolean }) {
  const front = poly(-16, 0, -16, -22, -5, -35, 6, -22, 6, 0);
  const side = poly(6, 0, 24, -6, 24, -28, 6, -22);
  const roofP = poly(-5.5, -37, 13, -43, 27.5, -27, 8, -20.5);
  const barge = poly(-19, -20.5, -5.5, -37.5, -5.5, -34, -15.5, -20.5);
  const chimney = rect(14, -46, 5.4, 11);
  return (
    <Art design={56} {...p}>
      <StandUp d={[front, side, roofP, barge, chimney]} foot={20} rim={2} depth={1.6}>
        <path d={front} fill={wall[HI]} />
        <path d={side} fill={wall[SHADE]} />
        <path d={front} fill="url(#pa-occl)" />
        <path d={roofP} fill={roof[MID]} />
        <path d={roofP} fill="url(#pa-tiles)" />
        <path d="M-5.5 -37 L13 -43 L14 -40 L-3 -34Z" fill={roof[LIT]} />
        <path d="M8 -20.5 L27.5 -27 L28 -25 L8.6 -18.6Z" fill={roof[DEEP]} />
        <path d={barge} fill={roof[LIT]} />
        <path d="M-5.5 -37 L8 -20.5" stroke={roof[SHADE]} strokeWidth={2.2} strokeLinecap="round" />
        <path d={chimney} fill={R.red[SHADE]} />
        <path d={rect(14, -46, 2.4, 11)} fill={R.red[MID]} />
        <path d={rect(13.2, -47.6, 7, 2.4)} fill={R.rock[LIT]} />
        <circle cx={-5} cy={-27} r={2.6} fill={R.cream[MID]} />
        <circle cx={-5} cy={-27} r={1.8} fill={P.window} />
        <SquareWin x={-13.5} y={-15} w={5.6} h={5.6} shutter={R.teal[MID]} />
        <Door x={-3} y={-13} w={7} h={13} />
        <SideWin x={10} y={-17.4} />
        <SideWin x={17} y={-19.8} />
        <LitEdge d="M-15.6 -1 V-21.6 L-5.2 -34" w={1.1} />
      </StandUp>
      {flag && <Pennant x={16.7} y={-47} h={12} ramp={R.blue} />}
    </Art>
  );
});

export const Townhouse = memo(function Townhouse({ wall = R.sand, roof = R.blue, ...p }: ArtProps & { wall?: Ramp; roof?: Ramp }) {
  const front = rect(-12, -44, 20, 44);
  const side = poly(8, 0, 18, -4, 18, -48, 8, -44);
  const mansard = poly(-14, -44, 10, -44, 6, -57, -10, -57);
  const mSide = poly(10, -44, 20, -48, 16, -60, 6, -57);
  return (
    <Art design={62} {...p}>
      <StandUp d={[front, side, mansard, mSide]} foot={16} rim={2} depth={1.6}>
        <path d={front} fill={wall[LIT]} />
        <path d={side} fill={wall[SHADE]} />
        <path d={front} fill="url(#pa-occl)" />
        <path d={mansard} fill={roof[MID]} />
        <path d={mSide} fill={roof[DEEP]} />
        <path d={mansard + mSide} fill="url(#pa-shingle)" />
        <path d={rect(-14.6, -45.4, 25, 2.4)} fill={P.die} />
        <path d="M-10 -57 L6 -57" stroke={roof[HI]} strokeWidth={1.2} />
        {/* dormer */}
        <path d={poly(-5.5, -46, 1.5, -46, 1.5, -52, -2, -55.5, -5.5, -52)} fill={P.die} />
        <path d={rect(-4, -51, 4, 5)} fill={P.window} />
        <SquareWin x={-8.5} y={-38} w={5} h={6} shutter={R.leaf[MID]} />
        <SquareWin x={1} y={-38} w={5} h={6} shutter={R.leaf[MID]} />
        <SquareWin x={-8.5} y={-26} w={5} h={6} shutter={R.leaf[MID]} lit />
        <SquareWin x={1} y={-26} w={5} h={6} shutter={R.leaf[MID]} />
        <Door x={-4.6} y={-13} w={7} h={13} wood={R.red} />
        <SideWin x={11} y={-34} w={3.6} slope={0.4} />
        <SideWin x={11} y={-22} w={3.6} slope={0.4} />
        <LitEdge d="M-11.6 -1 V-43.6" w={1.1} />
      </StandUp>
    </Art>
  );
});

export const Shop = memo(function Shop({ wall = R.pink, awning = R.red, ...p }: ArtProps & { wall?: Ramp; awning?: Ramp }) {
  const front = rect(-18, -28, 30, 28);
  const side = poly(12, 0, 22, -4, 22, -32, 12, -28);
  const parapet = rect(-19, -31, 32, 4);
  const awn = "M-20 -21 L14 -21 L16 -14 L-18 -14Z";
  const stripes = Array.from({ length: 6 }, (_, i) => {
    const x0 = -20 + (i * 34) / 6, x1 = x0 + 34 / 12;
    return poly(x0, -21, x1, -21, x1 + 2, -14, x0 + 2, -14);
  }).join("");
  const scallop = Array.from({ length: 6 }, (_, i) => circ(-16 + i * 5.8 + 2.9, -14, 2.9)).join("");
  return (
    <Art design={40} {...p}>
      <StandUp d={[front, side, parapet, awn, scallop]} foot={20} rim={2} depth={1.6}>
        <path d={front} fill={wall[LIT]} />
        <path d={side} fill={wall[SHADE]} />
        <path d={front} fill="url(#pa-occl)" />
        <path d={parapet} fill={P.die} />
        <path d={rect(12, -31, 1, 4)} fill={R.cream[SHADE]} />
        <path d={rect(-15, -12, 16, 10)} fill={P.windowLit} />
        <path d={rect(-15, -12, 16, 10)} fill="none" stroke={P.die} strokeWidth={1.6} />
        <path d="M-12 -4 h3 v-3 h-3Z M-6 -4 h4 v-4 h-4Z" fill={R.orange[MID]} />
        <path d={rect(3, -12, 6, 12)} fill={R.wood[MID]} />
        <path d={scallop} fill={awning[SHADE]} />
        <path d={awn} fill={P.die} />
        <path d={stripes} fill={awning[LIT]} />
        <path d="M-20 -21 L14 -21" stroke={awning[HI]} strokeWidth={1} />
        <path d={rect(-11, -28, 16, 6)} fill={R.wood[LIT]} />
        <path d="M-8 -25 H2" stroke={P.ink} strokeWidth={1.2} strokeLinecap="round" />
        <SideWin x={15} y={-20} w={4} slope={0.4} />
      </StandUp>
    </Art>
  );
});

export const RoundHouse = memo(function RoundHouse({ roof = R.orange, ...p }: ArtProps & { roof?: Ramp }) {
  const body = rect(-11, -30, 22, 30);
  const cone = poly(-15, -29, 0, -54, 15, -29);
  return (
    <Art design={60} {...p}>
      <StandUp d={[body, cone]} foot={12} rim={2} depth={1.6}>
        <path d={body} fill={R.cream[LIT]} />
        <path d={body} fill="url(#pa-stone)" />
        <path d={body} fill="url(#pa-turn)" />
        <path d={body} fill="url(#pa-occl)" />
        <path d={poly(-15, -29, 0, -54, 0, -29)} fill={roof[LIT]} />
        <path d={poly(0, -29, 0, -54, 15, -29)} fill={roof[SHADE]} />
        <path d={cone} fill="url(#pa-shingle)" />
        <path d="M-15 -29 Q0 -25 15 -29" stroke={roof[DEEP]} strokeWidth={2} fill="none" />
        <Win x={-3} y={-24} w={6} h={8} />
        <Door x={-3.5} y={-11} w={7} h={11} />
      </StandUp>
      <Pennant x={0} y={-54} h={10} ramp={roof} />
    </Art>
  );
});

/** Three buildings clustered in depth (back row drawn first, lifted). */
export const CityBlock = memo(function CityBlock({ variant = 0, ...p }: ArtProps & { variant?: number }) {
  const v = variant % 3;
  return (
    <Art design={72} {...p}>
      {v === 0 && <>
        <Townhouse x={-12} y={-8} size={58} />
        <RoundHouse x={18} y={-6} size={52} />
        <Cottage x={-4} y={4} size={44} flag={false} />
        <Shop x={24} y={6} size={30} />
      </>}
      {v === 1 && <>
        <Cottage x={14} y={-8} size={46} roof={R.blue} />
        <Townhouse x={-18} y={-6} size={56} wall={R.cream} roof={R.red} />
        <Shop x={0} y={6} size={34} wall={R.sand} awning={R.teal} />
      </>}
      {v === 2 && <>
        <RoundHouse x={-20} y={-8} size={56} roof={R.violet} />
        <Townhouse x={10} y={-6} size={54} wall={R.pink} roof={R.teal} />
        <Cottage x={-6} y={6} size={40} flag={false} />
      </>}
    </Art>
  );
});

export const HOUSES: { C: ComponentType<ArtProps>; H: number; W: number; name: string }[] = [
  { C: Cottage, H: 56, W: 52, name: "Cottage" },
  { C: Townhouse, H: 62, W: 38, name: "Townhouse" },
  { C: Shop, H: 40, W: 48, name: "Shop" },
  { C: RoundHouse, H: 60, W: 32, name: "Round house" },
];
