// WorldDiorama — the storybook world map staged from the library, following
// the owner's paper-map reference geography (never its pixels): Perception
// forest NW, Representation snow plateau top-centre, Structure floating
// islands NE, Sequence centre (clock tower, waterwheels, red castle),
// Decision Wild West SW, Generative SE (lava forge · neon city · dome city).
// Labels come from our real taxonomy. Specimen + staging reference only.
import { Fragment, type ReactNode } from "react";
import { S, LIT } from "./palette";
import { LandSlab, Waterfall, LavaRiver, Rails, FloatingIsland, SeaStack, Mesa, SnowPeaks, LavaCone, landPath } from "./world-terrain";
import { ForestCluster, Deer, CrystalSpire, Coral, Jellyfish } from "./world-flora";
import { StoryCastle, WaterwheelHouse, Storefront, Windpump, Chessboard, HedgeMaze, LavaCastle, NeonTower, GlassDome } from "./world-built";
import { SailingShip, SeaSerpent } from "./world-sea";
import { TitleCartouche, FamilySign, ModelTag, CompassRose, ScaleBar } from "./world-furniture";
import { ClockTower } from "./setpieces";
import { Cactus } from "./flora";
import { Boulder, Tuft } from "./bits";
import { PaperTrain, PlankBridge } from "./vehicles";
import { Cottage, Townhouse } from "./buildings";
import { PaperCloud } from "./sky";
import { AtomLandmark } from "./landmarks";

const W = 1200, H = 800;
const LAND = {
  representation: landPath([[356, 70], [430, 30], [530, 40], [620, 24], [716, 50], [770, 110], [752, 196], [690, 240], [580, 256], [470, 250], [390, 226], [346, 160]], 11, 14),
  perception: landPath([[24, 240], [56, 170], [132, 128], [226, 124], [306, 146], [376, 196], [414, 262], [398, 336], [350, 404], [270, 436], [170, 432], [90, 406], [34, 344]], 12, 18),
  sequence: landPath([[380, 296], [462, 262], [560, 250], [676, 262], [770, 290], [818, 356], [800, 436], [742, 500], [640, 536], [528, 532], [432, 500], [372, 440], [352, 364]], 13, 18),
  decision: landPath([[30, 482], [112, 446], [222, 440], [326, 456], [420, 490], [460, 560], [452, 646], [398, 716], [306, 760], [196, 768], [98, 740], [36, 680], [18, 580]], 14, 20),
  lava: landPath([[488, 596], [556, 556], [650, 552], [730, 584], [770, 648], [752, 726], [686, 776], [584, 786], [504, 752], [468, 680]], 15, 14),
  neon: landPath([[716, 560], [790, 526], [884, 526], [946, 560], [966, 626], [930, 686], [852, 710], [770, 700], [724, 656]], 16, 12),
};
const TERRACE = {
  perception: landPath([[90, 200], [150, 160], [240, 156], [300, 190], [290, 250], [200, 270], [110, 256]], 21, 10),
  sequence: landPath([[450, 300], [530, 282], [600, 290], [610, 340], [540, 360], [460, 350]], 22, 8),
  representation: landPath([[420, 80], [520, 62], [640, 60], [720, 90], [700, 150], [580, 170], [450, 160]], 23, 10),
};
const REEF = "M900 590 C960 560 1100 560 1170 600 C1200 640 1190 720 1140 760 C1080 790 960 790 920 750 C880 710 870 630 900 590Z";
const ROAD = "#E8C27A";

function Road({ d }: { d: string }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke="#6A4127" strokeOpacity={0.55} strokeWidth={6} />
      <path d={d} stroke={ROAD} strokeWidth={4} />
      <path d={d} stroke="#FFF3D0" strokeWidth={1.2} strokeDasharray="3 5" />
    </g>
  );
}
const Node = ({ x, y }: { x: number; y: number }) => (
  <g><circle cx={x} cy={y} r={6} fill="#FFF3C4" stroke="#6A4127" strokeWidth={1.4} /><circle cx={x - 1.4} cy={y - 1.4} r={2} fill="#FFFFFF" /></g>
);

export function WorldDiorama({ still = true }: { still?: boolean }) {
  void still;
  const layer = (items: [number, ReactNode][]) => items.sort((a, b) => a[0] - b[0]).map(([, n], i) => <Fragment key={i}>{n}</Fragment>);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block", borderRadius: 12 }} role="img" aria-label="Storybook world map diorama">
      <rect width={W} height={H} fill="url(#pa-sea-paint)" />
      {/* underwater dome city: a reef floor seen through the water */}
      <path d={REEF} fill="url(#pa-s-reef)" opacity={0.85} />
      <path d={REEF} fill="#72B2D0" opacity={0.25} />
      <path d={REEF} fill="none" stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={10} />

      {/* sea life + stacks behind the lands */}
      <SeaStack x={30} y={120} size={50} /> <SeaStack x={1170} y={120} size={60} /> <SeaStack x={820} y={60} size={40} grass={false} />
      <SeaStack x={470} y={790} size={46} /> <SeaStack x={1170} y={470} size={44} />

      {/* ── Representation: snowy plateau ── */}
      <LandSlab d={LAND.representation} depth={64} top="snow" layers={6} />
      <LandSlab d={TERRACE.representation} depth={16} top="snow" layers={3} foam={false} />
      <SnowPeaks x={440} y={80} size={66} />
      <SnowPeaks x={560} y={70} size={80} />
      <SnowPeaks x={690} y={86} size={70} />
      <SnowPeaks x={400} y={150} size={44} />
      <SnowPeaks x={740} y={170} size={46} />
      <ForestCluster x={430} y={150} w={120} h={50} n={52} seed={3} snow tree={26} />
      <ForestCluster x={690} y={180} w={110} h={60} n={44} seed={4} snow tree={26} />
      <ForestCluster x={560} y={226} w={300} h={34} n={62} seed={5} snow tree={24} />
      <Road d="M420 200 C470 190 520 170 560 160 M560 160 C600 170 640 190 690 200 M470 200 C500 220 540 232 580 236" />
      {[[420, 200], [560, 160], [690, 200], [580, 236]].map(([x, y], i) => <Node key={`rn${i}`} x={x} y={y} />)}
      {layer([
        [150, <AtomLandmark key="s" name="simclr" state="trained" size={78} x={560} y={150} />],
        [120, <CrystalSpire key="c" x={630} y={122} size={74} />],
        [170, <AtomLandmark key="v" name="vae" state="champion" size={72} x={470} y={188} />],
        [182, <Deer key="d" x={690} y={182} size={26} />],
      ])}

      {/* ── Structure: floating islands ── */}
      {layer([
        [150, <FloatingIsland key="a" x={900} y={250} size={110} />],
        [200, <FloatingIsland key="b" x={1060} y={300} size={120} trees={false}><AtomLandmark name="gnn" state="trained" size={60} x={0} y={-66} /></FloatingIsland>],
        [300, <FloatingIsland key="c" x={950} y={420} size={100} trees={false}><AtomLandmark name="nerf" state="untrained" size={56} x={0} y={-64} /></FloatingIsland>],
        [120, <FloatingIsland key="d" x={1130} y={170} size={80} />],
        [130, <FloatingIsland key="e" x={1000} y={160} size={90} />],
        [260, <FloatingIsland key="f" x={1150} y={370} size={96} />],
        [400, <FloatingIsland key="g" x={1080} y={470} size={70} />],
        [350, <FloatingIsland key="h" x={860} y={380} size={70} />],
      ])}
      {["M930 200 Q990 210 1030 230", "M1040 290 Q1000 330 975 360", "M1010 110 Q1060 110 1110 120", "M1090 260 Q1120 290 1140 310", "M900 330 Q880 350 870 340", "M1000 420 Q1040 440 1070 430"].map((d, i) => (
        <g key={i}><path d={d} stroke="#482D1E" strokeWidth={6} fill="none" strokeLinecap="round" /><path d={d} stroke="#B27C47" strokeWidth={4} fill="none" strokeDasharray="2.4 1.6" /></g>
      ))}

      {/* ── Perception: forest ── */}
      <LandSlab d={LAND.perception} depth={52} top="grass" />
      <LandSlab d={TERRACE.perception} depth={18} top="grass" layers={3} foam={false} />
      <Waterfall x={292} y={240} h={16} w={10} />
      <Waterfall x={300} y={414} h={50} w={18} />
      <ForestCluster x={120} y={196} w={170} h={70} n={91} seed={7} mix="mixed" tree={28} />
      <ForestCluster x={340} y={250} w={110} h={90} n={65} seed={17} mix="conifer" tree={28} />
      <ForestCluster x={260} y={370} w={220} h={60} n={78} seed={8} mix="mixed" tree={26} />
      <ForestCluster x={80} y={360} w={90} h={60} n={39} seed={27} mix="conifer" tree={26} />
      <Road d="M110 300 C160 270 220 260 280 250 M280 250 C310 280 320 320 300 350 M110 300 C140 340 180 360 220 370" />
      {[[110, 300], [280, 250], [300, 350], [220, 370]].map(([x, y], i) => <Node key={i} x={x} y={y} />)}
      {layer([
        [240, <AtomLandmark key="c" name="classifier" state="champion" size={80} x={250} y={240} />],
        [360, <AtomLandmark key="s" name="segmentation" state="trained" size={70} x={180} y={362} />],
        [300, <AtomLandmark key="t" name="tabular_classifier" state="trained" size={60} x={100} y={300} />],
      ])}

      {/* ── Sequence: the heartland ── */}
      <LandSlab d={LAND.sequence} depth={56} top="autumn" />
      <LandSlab d={TERRACE.sequence} depth={14} top="grass" layers={3} foam={false} />
      <path d="M600 280 C600 330 560 360 590 410 C610 450 660 470 700 505" stroke={S.sea[LIT]} strokeWidth={9} fill="none" strokeLinecap="round" />
      <path d="M600 280 C600 330 560 360 590 410 C610 450 660 470 700 505" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={2} strokeDasharray="5 8" fill="none" />
      <Waterfall x={700} y={508} h={54} w={16} />
      <Waterfall x={400} y={470} h={50} w={14} />
      <ForestCluster x={470} y={320} w={150} h={50} n={59} seed={11} mix="fall" tree={26} />
      <ForestCluster x={745} y={380} w={100} h={110} n={65} seed={12} mix="fall" tree={26} />
      <ForestCluster x={520} y={495} w={180} h={40} n={52} seed={19} mix="fall" tree={26} />
      <ForestCluster x={690} y={300} w={120} h={30} n={31} seed={23} mix="fall" tree={26} />
      <ForestCluster x={410} y={420} w={60} h={70} n={26} seed={29} mix="fall" tree={26} />
      <Road d="M440 400 C500 380 560 400 600 430 M600 430 C650 420 700 400 740 380 M600 430 C590 460 560 480 520 490" />
      {[[440, 400], [600, 430], [740, 380], [520, 490]].map(([x, y], i) => <Node key={i} x={x} y={y} />)}
      {layer([
        [340, <ClockTower key="k" x={520} y={352} size={100} train={false} />],
        [400, <WaterwheelHouse key="w1" x={450} y={404} size={50} />],
        [460, <WaterwheelHouse key="w2" x={720} y={452} size={46} roof={S.roofBlu} />],
        [430, <StoryCastle key="t" x={630} y={428} size={120} />],
        [380, <Cottage key="h1" x={680} y={380} size={32} />],
        [372, <Townhouse key="h2" x={560} y={372} size={34} />],
      ])}

      {/* bridges between the lands */}
      <PlankBridge x={375} y={288} size={16} span={60} />
      <PlankBridge x={420} y={470} size={14} span={50} />
      <PlankBridge x={760} y={540} size={14} span={50} />
      {/* ── Generative: lava forge + neon city ── */}
      <LandSlab d={LAND.lava} depth={40} top="lava" />
      <LavaRiver d="M600 580 C620 620 580 660 610 700 C630 730 600 760 610 780" w={9} />
      <LavaRiver d="M660 600 C680 640 700 680 690 740" w={6} />
      <LavaRiver d="M520 660 C540 690 530 720 560 750" w={5} />
      <LavaRiver d="M720 620 C700 660 730 700 710 760" w={6} />
      <ellipse cx={620} cy={680} rx={120} ry={70} fill="url(#pa-glow)" opacity={0.35} />
      <ellipse cx={840} cy={620} rx={110} ry={60} fill={S.pink[LIT]} opacity={0.12} />
      <ellipse cx={800} cy={660} rx={80} ry={40} fill={S.cyan[LIT]} opacity={0.1} />
      <LandSlab d={LAND.neon} depth={36} top="night" />
      {layer([
        [640, <LavaCastle key="l" x={560} y={690} size={100} />],
        [620, <LavaCone key="lc1" x={650} y={620} size={40} />],
        [740, <LavaCone key="lc2" x={520} y={740} size={34} />],
        [760, <LavaCone key="lc3" x={700} y={760} size={30} />],
        [700, <AtomLandmark key="g" name="gan" state="trained" size={64} x={660} y={720} />],
        [600, <NeonTower key="n1" x={760} y={600} size={96} variant={0} />],
        [610, <NeonTower key="n2" x={800} y={612} size={80} variant={1} />],
        [620, <NeonTower key="n3" x={850} y={604} size={104} variant={3} />],
        [650, <NeonTower key="n4" x={880} y={650} size={76} variant={2} />],
        [590, <NeonTower key="n5" x={830} y={580} size={70} variant={1} />],
        [640, <NeonTower key="n6" x={740} y={640} size={66} variant={2} />],
        [680, <NeonTower key="n7" x={900} y={690} size={60} variant={0} />],
        [670, <AtomLandmark key="df" name="diffusion" state="provisional" size={64} x={800} y={672} />],
      ])}
      {/* dome city under the water */}
      {layer([
        [640, <GlassDome key="g1" x={990} y={650} size={70} />],
        [700, <GlassDome key="g2" x={1100} y={700} size={60} />],
        [620, <GlassDome key="g3" x={1110} y={620} size={46} />],
        [760, <GlassDome key="g4" x={1010} y={760} size={40} />],
        [740, <Coral key="c1" x={950} y={745} size={26} />],
        [750, <Coral key="c2" x={1150} y={760} size={22} ramp={S.autumn} />],
      ])}
      <Jellyfish x={1060} y={610} size={34} /> <Jellyfish x={930} y={700} size={26} ramp={S.cyan} />

      {/* ── Decision: the Wild West ── */}
      <LandSlab d={LAND.decision} depth={50} top="desert" layers={6} />
      <Rails d="M70 640 C140 660 220 690 300 700 C350 706 400 690 430 670" ground="#DDA560" />
      {layer([
        [500, <Mesa key="m1" x={120} y={500} size={60} wide />],
        [490, <Mesa key="m2" x={370} y={505} size={56} />],
        [540, <Mesa key="m3" x={410} y={560} size={40} />],
        [720, <Mesa key="m4" x={380} y={690} size={42} wide />],
        [560, <Windpump key="wp" x={90} y={560} size={70} />],
        [560, <Storefront key="s0" x={180} y={560} size={44} variant={0} />],
        [566, <Storefront key="s1" x={222} y={566} size={48} variant={1} />],
        [572, <Storefront key="s2" x={262} y={570} size={42} variant={2} />],
        [600, <Chessboard key="cb" x={350} y={600} size={42} />],
        [620, <HedgeMaze key="hm" x={160} y={624} size={40} />],
        [700, <PaperTrain key="tr" x={250} y={698} size={30} />],
        [620, <Cactus key="k1" x={140} y={620} size={30} />],
        [650, <Cactus key="k2" x={400} y={640} size={26} />],
        [700, <Cactus key="k3" x={90} y={700} size={28} />],
        [600, <Cactus key="k4" x={60} y={600} size={24} />],
        [660, <Cactus key="k5" x={320} y={660} size={24} />],
        [540, <Cactus key="k6" x={300} y={530} size={22} />],
        [575, <Storefront key="s3" x={300} y={576} size={40} variant={3} />],
        ...([[70, 540], [200, 520], [330, 540], [120, 690], [300, 730], [420, 600], [60, 640], [240, 620]] as [number, number][]).map(([x, y], i): [number, ReactNode] => [y, <Tuft key={`dt${i}`} x={x} y={y} s={1.3} ramp={S.autumn} />]),
        ...([[100, 560], [260, 650], [400, 660], [180, 730]] as [number, number][]).map(([x, y], i): [number, ReactNode] => [y, <Boulder key={`db${i}`} x={x} y={y} r={5} ramp={S.sand} />]),
      ])}

      {/* ── sea: ships, serpent, clouds ── */}
      <SailingShip x={60} y={455} size={60} />
      <SailingShip x={470} y={560} size={50} facing={-1} />
      <SeaSerpent x={1070} y={520} size={56} />
      <PaperCloud x={880} y={60} size={46} variant={0} />
      <PaperCloud x={80} y={440} size={34} variant={1} />
      <PaperCloud x={1150} y={560} size={40} variant={2} />

      {/* ── furniture ── */}
      <TitleCartouche x={170} y={70} />
      <FamilySign x={540} y={34} family="representation" scale={0.9} />
      <FamilySign x={1010} y={110} family="structure" scale={0.9} />
      <FamilySign x={190} y={180} family="perception" scale={0.9} />
      <FamilySign x={620} y={300} family="sequence" scale={0.9} />
      <FamilySign x={230} y={470} family="decision" scale={0.9} />
      <FamilySign x={880} y={530} family="generative" scale={0.9} />
      <ModelTag x={250} y={262} text="classifier" /> <ModelTag x={630} y={450} text="transformer" /> <ModelTag x={350} y={622} text="alphazero" />
      <ModelTag x={160} y={646} text="rl maze" /> <ModelTag x={560} y={712} text="gan" />
      <CompassRose x={70} y={730} r={30} />
      <ScaleBar x={120} y={770} w={110} label="22 pipelines" />
    </svg>
  );
}
