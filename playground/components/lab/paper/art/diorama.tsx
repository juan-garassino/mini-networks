// A small diorama that puts the library on one board: a tilted ground plane
// (meadow island + desert island) on a scalloped sea, gold roads joining
// level spots, stand-up props sorted back-to-front, boats, clouds and a big
// foreground tree overlapping the frame. It is the harmony test for the
// specimen sheet — and a reference for how the builder can stage the map.
import { Fragment, type ReactNode } from "react";
import { P, R, HI, LIT, SHADE } from "./palette";
import { LighthouseEye, ClockTower } from "./setpieces";
import { BigTree, Cactus, Dune, EyeFlowers, FeltBush, Mountains, Palm, Pyramid, RoundTree } from "./flora";
import { Cottage, Townhouse, RoundHouse } from "./buildings";
import { AtomSpot, LevelSpot } from "./spots";
import { PaperBoat, Pier, PlankBridge, SteamBoat, PaperTrain } from "./vehicles";
import { CloudShadow, PaperCloud } from "./sky";
import { CritterArt } from "./critter";
import { FogIsland, SignBoard } from "./secrets";
import { Tuft } from "./bits";

const W = 1200, H = 720;
const CX = 560, CY = 410, TILT = 0.6;
/** ground (x, y) → screen */
const at = (x: number, y: number) => ({ x: CX + x, y: CY + y * TILT });

const MEADOW = "M-520 -40 C-540 -250 -310 -320 -130 -300 C10 -285 60 -200 40 -80 C28 40 80 170 -40 240 C-200 330 -470 270 -520 -40Z";
const DESERT = "M110 -230 C270 -330 520 -290 545 -80 C565 120 430 300 230 285 C90 272 70 130 108 20 C126 -60 70 -150 110 -230Z";
const ROAD_M = "M-330 60 C-260 20 -200 -40 -140 -120 M-330 60 C-250 110 -160 150 -70 150 M-140 -120 C-80 -80 -20 -30 70 -10";
const ROAD_D = "M70 -10 C140 0 190 -40 250 -70 M250 -70 C320 -20 360 40 380 120";

function Ground() {
  const lands = [MEADOW, DESERT];
  return (
    <g transform={`translate(${CX} ${CY}) scale(1 ${TILT})`}>
      {/* drop shadow onto the water, card edge, foam, die-cut rim, surface */}
      {lands.map((d, i) => <path key={`s${i}`} d={d} fill="#0F3A8A" opacity={0.35} transform="translate(10 30)" />)}
      {lands.map((d, i) => <path key={`f${i}`} d={d} fill="none" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={46} strokeLinejoin="round" />)}
      {lands.map((d, i) => <path key={`f2${i}`} d={d} fill="none" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={26} strokeLinejoin="round" />)}
      {lands.map((d, i) => <path key={`e${i}`} d={d} fill={P.dieShade} stroke={P.dieShade} strokeWidth={12} strokeLinejoin="round" transform="translate(0 16)" />)}
      {lands.map((d, i) => <path key={`r${i}`} d={d} fill={P.die} stroke={P.die} strokeWidth={12} strokeLinejoin="round" />)}
      <path d={MEADOW} fill={R.sand[LIT]} />
      <path d={MEADOW} fill="url(#pa-grass)" stroke={R.sand[LIT]} strokeWidth={14} strokeLinejoin="round" paintOrder="stroke" />
      <path d={DESERT} fill="url(#pa-sand)" />
      <path d={MEADOW + DESERT} fill="url(#pa-fibre)" />
      {/* roads: raised gold with a dark edge and a lit crown */}
      {[ROAD_M, ROAD_D].map((d, i) => (
        <Fragment key={i}>
          <path d={d} fill="none" stroke="#0F0A20" strokeOpacity={0.18} strokeWidth={34} strokeLinecap="round" transform="translate(4 8)" />
          <path d={d} fill="none" stroke={R.orange[SHADE]} strokeWidth={32} strokeLinecap="round" />
          <path d={d} fill="none" stroke={R.gold[LIT]} strokeWidth={24} strokeLinecap="round" />
          <path d={d} fill="none" stroke="url(#pa-cobble)" strokeWidth={24} strokeLinecap="round" opacity={0.6} />
          <path d={d} fill="none" stroke={R.gold[HI]} strokeWidth={4} strokeLinecap="round" strokeDasharray="1 22" transform="translate(-4 -6)" />
        </Fragment>
      ))}
    </g>
  );
}

interface Placed { y: number; node: ReactNode }

export function ArtDiorama({ still = true }: { still?: boolean }) {
  void still;
  const items: Placed[] = [];
  const put = (gx: number, gy: number, f: (x: number, y: number) => ReactNode) => {
    const p = at(gx, gy);
    items.push({ y: p.y, node: f(p.x, p.y) });
  };
  // meadow (perception)
  put(-400, -175, (x, y) => <LighthouseEye x={x} y={y} size={220} />);
  put(-250, -240, (x, y) => <RoundTree x={x} y={y} size={62} />);
  put(-195, -262, (x, y) => <RoundTree x={x} y={y} size={52} />);
  put(-150, -236, (x, y) => <FeltBush x={x} y={y} size={24} />);
  put(-480, 40, (x, y) => <RoundTree x={x} y={y} size={66} />);
  put(-440, 90, (x, y) => <FeltBush x={x} y={y} size={26} />);
  put(-230, 30, (x, y) => <FeltBush x={x} y={y} size={24} />);
  put(-400, 200, (x, y) => <EyeFlowers x={x} y={y} size={30} />);
  put(-150, 40, (x, y) => <EyeFlowers x={x} y={y} size={26} />);
  put(-10, 210, (x, y) => <RoundTree x={x} y={y} size={56} />);
  put(-50, -210, (x, y) => <Cottage x={x} y={y} size={56} />);
  put(0, -190, (x, y) => <Townhouse x={x} y={y} size={60} />);
  put(-20, -150, (x, y) => <RoundHouse x={x} y={y} size={52} />);
  put(-330, 60, (x, y) => <AtomSpot x={x} y={y} r={38} name="classifier" state="champion" family="perception" />);
  put(-140, -120, (x, y) => <LevelSpot x={x} y={y} r={24} name="resnet" state="trained" />);
  put(-70, 150, (x, y) => <LevelSpot x={x} y={y} r={24} name="vit" state="untrained" />);
  put(-205, 138, (x, y) => <CritterArt x={x} y={y} size={50} pose="walk1" />);
  put(-215, -40, (x, y) => <SignBoard x={x} y={y} size={40} text="Perception" family="perception" />);
  // desert (sequence)
  put(420, -160, (x, y) => <ClockTower x={x} y={y} size={230} train={false} />);
  put(250, -70, (x, y) => <LevelSpot x={x} y={y} r={24} name="rnn" state="champion" />);
  put(380, 120, (x, y) => <LevelSpot x={x} y={y} r={24} name="mamba" state="provisional" />);
  put(175, -205, (x, y) => <Palm x={x} y={y} size={84} />);
  put(490, 50, (x, y) => <Palm x={x} y={y} size={74} />);
  put(300, 220, (x, y) => <Cactus x={x} y={y} size={46} />);
  put(200, 150, (x, y) => <Cactus x={x} y={y} size={36} />);
  put(360, 250, (x, y) => <Pyramid x={x} y={y} size={52} />);
  put(470, 200, (x, y) => <Dune x={x} y={y} size={26} />);
  put(150, 60, (x, y) => <Dune x={x} y={y} size={20} />);
  put(270, 40, (x, y) => <PaperTrain x={x} y={y} size={34} />);
  put(300, -205, (x, y) => <Mountains x={x} y={y} size={80} snow={false} />);
  // sea
  put(-150, 270, (x, y) => <Pier x={x} y={y} size={34} />);
  put(-40, 330, (x, y) => <PaperBoat x={x} y={y} size={58} />);
  put(560, 440, (x, y) => <SteamBoat x={x} y={y} size={66} />);
  put(560, -490, (x, y) => <FogIsland x={x} y={y} size={84} />);
  put(70, -10, (x, y) => <PlankBridge x={x} y={y + 2} size={22} span={64} />);
  // ground dressing: grass tufts and flowers scattered on a fixed pattern
  const TUFTS: [number, number][] = [[-470, -120], [-360, -40], [-260, 180], [-110, -40], [-40, 60], [-480, 160], [-300, -140], [-150, 200], [0, -60], [-90, -200]];
  TUFTS.forEach(([gx, gy], i) => put(gx, gy, (x, y) => <Tuft x={x} y={y} s={1.2 + (i % 3) * 0.2} />));
  const SAND: [number, number][] = [[140, -120], [330, -40], [420, 260], [520, -30], [230, 250]];
  SAND.forEach(([gx, gy], i) => put(gx, gy, (x, y) => <Tuft x={x} y={y} s={1.1 + (i % 2) * 0.3} ramp={R.lime} />));
  items.sort((a, b) => a.y - b.y);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block", borderRadius: 12 }} role="img" aria-label="Diorama of the paper art on a tilted island">
      <rect width={W} height={H} fill="url(#pa-sea)" />
      <Ground />
      <CloudShadow x={640} y={640} size={80} variant={0} />
      <CloudShadow x={820} y={200} size={60} variant={1} />
      {items.map((it, i) => <Fragment key={i}>{it.node}</Fragment>)}
      <PaperCloud x={600} y={580} size={74} variant={0} />
      <PaperCloud x={790} y={150} size={56} variant={1} />
      <PaperCloud x={250} y={70} size={44} variant={2} />
      <BigTree x={40} y={H + 30} size={300} />
    </svg>
  );
}
