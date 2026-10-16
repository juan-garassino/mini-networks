// The art catalogue: every asset with its design box, suggested on-map size
// and what it encodes. Drives the specimen sheet (/lab/paper/specimens/) and
// documents the library for the builder's encoding.ts.
import type { ReactNode } from "react";
import { Cutout, StandUp } from "./materials";
import { R, LIT, MID } from "./palette";
import { blob, rect } from "./geom";
import { SET_PIECES, TokenTrain } from "./setpieces";
import { BIOME, BigTree, Mountains } from "./flora";
import { CityBlock, HOUSES } from "./buildings";
import { AtomSpot, CapitalSpot, LevelSpot, type SpotState } from "./spots";
import { AtomLandmark, LANDMARKS } from "./landmarks";
import { PaperBoat, PaperTrain, Pier, PlankBridge, RopeBridge, SteamBoat } from "./vehicles";
import { PaperCloud } from "./sky";
import { CritterArt, CritterWalk, type CritterPose } from "./critter";
import { FogIsland, PaperDragon, Ruins, SignBoard } from "./secrets";
import { Tuft } from "./bits";
import { FloatingIsland, LandSlab, LavaRiver, Mesa, Rails, SeaStack, Waterfall } from "./world-terrain";
import { Broadleaf, Conifer, Coral, CrystalSpire, Deer, ForestCluster, Jellyfish } from "./world-flora";
import { Chessboard, GlassDome, HedgeMaze, LavaCastle, NeonTower, Storefront, StoryCastle, WaterwheelHouse, Windpump } from "./world-built";
import { SailingShip, SeaSerpent } from "./world-sea";
import { CompassRose, FamilySign, ModelTag, ScaleBar, TitleCartouche } from "./world-furniture";

export interface Specimen {
  id: string;
  name: string;
  /** what the asset encodes on the map (hand to encoding.ts) */
  encodes: string;
  /** design box: width and height in design units (base-centre at 0,0) */
  W: number;
  H: number;
  /** suggested on-map height in world px ("1×" on the specimen sheet) */
  map: number;
  /** draws the asset at `size` px tall, base-centre at (0,0) */
  draw: (size: number, still?: boolean) => ReactNode;
}
export interface SpecimenGroup { id: string; title: string; note: string; items: Specimen[] }

const FAMILY_NOTE: Record<string, string> = {
  perception: "perception: models that see",
  sequence: "sequence: order and time steps",
  generative: "generative: puffs out samples",
  representation: "representation: two views, one meaning",
  structure: "structure: nodes and links",
  decision: "decision: choices under chance",
};
const FAMILIES = Object.keys(FAMILY_NOTE);

/** Flat assets are centred on the ground; lift them so the sheet can base-align. */
const flat = (lift: number, node: ReactNode) => <g transform={`translate(0 ${-lift})`}>{node}</g>;

const SWATCH = blob([[-14, -20, 14], [6, -26, 16], [18, -14, 11], [-2, -12, 12]]);
const swatch = (id: string, name: string, encodes: string, node: ReactNode): Specimen =>
  ({ id, name, encodes, W: 60, H: 46, map: 46, draw: (size) => <g transform={`scale(${size / 46})`}>{node}</g> });
const surface = (id: string, name: string, fill: string): Specimen =>
  ({ id, name, encodes: `surface pattern url(#${fill}): world px, fill a ground path with it`, W: 90, H: 50, map: 50,
    draw: () => <g><path d={rect(-45, -50, 90, 50)} fill={`url(#${fill})`} /></g> });

const SPOT_STATES: SpotState[] = ["champion", "trained", "untrained", "provisional"];
const SPOT_COPY: Record<SpotState, string> = {
  champion: "champion: a checkpoint passed the gate (gold star seal)",
  trained: "trained: at least one run (glossy blue face)",
  untrained: "untrained: no run yet (hollow paper face, blue emblem)",
  provisional: "provisional: quality bar not inked (pencil sketch, unfinished paper)",
};
const POSES: CritterPose[] = ["idle", "walk0", "walk1", "walk2", "walk3", "train"];

export const CATALOG: SpecimenGroup[] = [
  {
    id: "materials",
    title: "Materials and surfaces",
    note: "The four cut materials every asset is built from, then the ground surface patterns (rendered once in <ArtDefs/>).",
    items: [
      swatch("mat-paper", "Matte paper", "Cutout material=\"paper\": white die-cut rim, cream side face, fibre grain",
        <StandUp d={SWATCH} foot={24} rim={3} depth={3}><path d={SWATCH} fill={R.red[LIT]} /></StandUp>),
      swatch("mat-card", "Cardboard", "Cutout material=\"card\": corrugated brown side face (signs, thick boards)",
        <StandUp d={SWATCH} foot={24} rim={3} depth={5} material="card"><path d={SWATCH} fill={R.orange[LIT]} /></StandUp>),
      swatch("mat-felt", "Felt / knit", "Cutout material=\"felt\" + fuzz: knit stitches, fuzzy edge (bushes, topiary)",
        <StandUp d={SWATCH} foot={24} rim={2} depth={2} material="felt" fuzz={R.grass[MID]}><path d={SWATCH} fill={R.grass[LIT]} /></StandUp>),
      swatch("mat-sticker", "Glossy sticker", "Cutout material=\"sticker\": specular hotspot (level spots, seals)",
        <Cutout d={SWATCH} rim={3} depth={2.5} material="sticker"><path d={SWATCH} fill={R.blue[MID]} /><path d={blob([[-16, -24, 6]])} fill={R.blue[LIT]} /></Cutout>),
      surface("surf-grass", "Grass stripes", "pa-grass"),
      surface("surf-meadow", "Meadow checker", "pa-meadow"),
      surface("surf-sand", "Sand dunes", "pa-sand"),
      surface("surf-sea", "Scalloped sea", "pa-sea"),
      surface("surf-cobble", "Gold road cobbles", "pa-cobble"),
    ],
  },
  {
    id: "setpieces",
    title: "Family set-pieces",
    note: "One per family: its signature mechanism, standing up on the island. Key light top-left; shadows fall down-right.",
    items: [
      ...Object.entries(SET_PIECES).map(([fam, s]): Specimen => ({
        id: `setpiece-${fam}`, name: s.name, encodes: FAMILY_NOTE[fam], W: s.W, H: s.H, map: 120,
        draw: (size) => <s.C size={size} />,
      })),
      { id: "token-train", name: "Token train", encodes: "sequence biome prop (cars carry tokens)", W: 130, H: 30, map: 16, draw: (size) => <TokenTrain size={size} /> },
    ],
  },
  {
    id: "landmarks",
    title: "Atom landmarks",
    note: "One distinct landmark per atom: a picture of the mechanism it introduces, with the emblem plaque carrying its evidence state.",
    items: [
      ...Object.entries(LANDMARKS).map(([name, d], i): Specimen => ({
        id: `landmark-${name}`, name: name.replace(/_/g, " "), encodes: d.metaphor, W: d.W, H: d.H, map: name === "transformer" ? 130 : 100,
        draw: (size) => <AtomLandmark name={name} state={(["trained", "champion", "untrained", "trained"] as SpotState[])[i % 4]} size={size} />,
      })),
      ...(["champion", "trained", "untrained", "provisional"] as SpotState[]).map((st): Specimen => ({
        id: `landmark-state-${st}`, name: `Lens tower, ${st}`, encodes: `evidence state on a landmark: ${st}`, W: 130, H: 172, map: 100,
        draw: (size) => <AtomLandmark name="classifier" state={st} size={size} />,
      })),
    ],
  },
  {
    id: "spots",
    title: "Level spots",
    note: "Flat glossy stickers the roads join at. Emblem = iconFor(name), printed crisp and un-squashed. r = radius in world px.",
    items: [
      ...SPOT_STATES.map((st): Specimen => ({
        id: `spot-${st}`, name: `Derived spot, ${st}`, encodes: SPOT_COPY[st], W: 50, H: 40, map: 38,
        draw: (size) => { const r = size / 1.9; return flat(r * 1.06, <LevelSpot name="resnet" state={st} r={r} />); },
      })),
      ...(["trained", "champion", "provisional"] as SpotState[]).map((st): Specimen => ({
        id: `atom-${st}`, name: `Atom castle spot, ${st}`, encodes: "an atom: elementary model rooting its family (castle roofs = family colour)", W: 80, H: 96, map: 90,
        draw: (size) => { const r = size / 3.2; return flat(r * 0.98, <AtomSpot name="classifier" state={st} r={r} family="perception" />); },
      })),
      {
        id: "capital", name: "Capital city spot", encodes: "a hub atom (many children): a city of houses and a spire behind the spot", W: 150, H: 134, map: 124,
        draw: (size) => { const r = size / 3.7; return flat(r * 0.98, <CapitalSpot name="transformer" state="champion" r={r} family="sequence" />); },
      },
    ],
  },
  {
    id: "biome",
    title: "Biome vegetation and props",
    note: "Three or more per family; each set tells you which family's land you stand on.",
    items: FAMILIES.flatMap((fam) => BIOME[fam].map((b, i): Specimen => ({
      id: `biome-${fam}-${i}`, name: b.name, encodes: `${FAMILY_NOTE[fam].split(":")[0]} biome`, W: b.W, H: b.H, map: Math.round(b.H * 0.6),
      draw: (size) => <b.C size={size} />,
    }))),
  },
  {
    id: "terrain",
    title: "Terrain and framing",
    note: "Mountain ranges (layered paper peaks), a big foreground tree for frame overlap, grass tufts.",
    items: [
      { id: "mountains", name: "Mountain range", encodes: "relief between families (decor)", W: 210, H: 96, map: 70, draw: (size) => <Mountains size={size} /> },
      { id: "mountains-bare", name: "Mountain range, no snow", encodes: "warm-biome relief", W: 210, H: 96, map: 70, draw: (size) => <Mountains size={size} snow={false} /> },
      { id: "bigtree", name: "Big foreground tree", encodes: "frame overlap at the map edge (no data)", W: 260, H: 250, map: 220, draw: (size) => <BigTree size={size} /> },
      { id: "tufts", name: "Grass tufts", encodes: "ground dressing", W: 40, H: 12, map: 10, draw: (size) => <g transform={`scale(${size / 12})`}><Tuft x={-10} y={0} /><Tuft x={4} y={0} s={0.8} ramp={R.lime} /><Tuft x={14} y={0} s={0.7} /></g> },
    ],
  },
  {
    id: "buildings",
    title: "Houses and city blocks",
    note: "Stand-up buildings in 3/4 view: lit front wall, shaded side wall, tiled roof plane.",
    items: [
      ...HOUSES.map((h, i): Specimen => ({ id: `house-${i}`, name: h.name, encodes: "town dressing around hubs", W: h.W, H: h.H, map: Math.round(h.H * 0.7), draw: (size) => <h.C size={size} /> })),
      ...[0, 1, 2].map((v): Specimen => ({ id: `city-${v}`, name: `City block ${v + 1}`, encodes: "a hub / city cluster", W: 90, H: 72, map: 56, draw: (size) => <CityBlock variant={v} size={size} /> })),
    ],
  },
  {
    id: "vehicles",
    title: "Boats, trains and bridges",
    note: "Boats = compositions, the train = live training, bridges = roads crossing between families.",
    items: [
      { id: "boat", name: "Paper sailboat", encodes: "a composition (cross-model pipeline) at sea", W: 70, H: 62, map: 44, draw: (size) => <PaperBoat size={size} /> },
      { id: "boat-violet", name: "Paper sailboat, family sail", encodes: "sail colour can carry the composition's family", W: 70, H: 62, map: 44, draw: (size) => <PaperBoat size={size} sail={R.violet} hull={R.blue} /> },
      { id: "pier", name: "Harbour pier", encodes: "a harbour where a composition's boat docks", W: 130, H: 50, map: 34, draw: (size) => <g transform={`translate(${-size * 1.3} 0)`}><Pier size={size} /></g> },
      { id: "steamboat", name: "Steamboat with smoke trail", encodes: "a composition under way (animated trail)", W: 110, H: 110, map: 60, draw: (size) => <SteamBoat size={(size * 64) / 110} /> },
      { id: "train", name: "Paper train", encodes: "a live training run on the map", W: 140, H: 44, map: 30, draw: (size) => <PaperTrain size={size} /> },
      { id: "bridge-h", name: "Plank bridge", encodes: "a builds-on road crossing between families", W: 90, H: 24, map: 24, draw: (size) => <PlankBridge size={size} /> },
      { id: "bridge-v", name: "Plank bridge, vertical", encodes: "same, north–south", W: 30, H: 80, map: 60, draw: (size) => <PlankBridge size={size} orient="v" /> },
      { id: "bridge-rope", name: "Rope bridge", encodes: "a long crossing / secondary link", W: 110, H: 34, map: 28, draw: (size) => <RopeBridge size={size} /> },
    ],
  },
  {
    id: "sky",
    title: "Clouds",
    note: "Puffy layered paper clouds; each casts a soft shadow onto the ground below-right (CloudShadow, drawn on the ground layer).",
    items: [0, 1, 2].map((v): Specimen => ({ id: `cloud-${v}`, name: `Cloud ${v + 1}`, encodes: "weather / depth (no data)", W: 130, H: 100, map: 60, draw: (size) => <g transform={`translate(0 ${-size * 0.5})`}><PaperCloud variant={v} size={size * 0.5} castShadow /></g> })),
  },
  {
    id: "critter",
    title: "The critter",
    note: "The one-eyed perceptron as a stand-up cutout: idle, a 4-pose walk cycle, and the training easter egg.",
    items: [{
      id: "critter-walking", name: "Critter, walk cycle (live)", encodes: "the 4 walk poses played at 8 fps; idle under ?still=1", W: 130, H: 140, map: 44,
      draw: (size: number, still?: boolean) => <CritterWalk still={still} size={size * (130 / 140)} />,
    } as Specimen, ...POSES.map((pose): Specimen => ({
      id: `critter-${pose}`, name: `Critter, ${pose}`, encodes: pose === "train" ? "easter egg: the critter trains a real run" : "you, walking the roads", W: 130, H: 140, map: 44,
      draw: (size) => <CritterArt pose={pose} size={size * (130 / 140)} />,
    }))],
  },
  {
    id: "secrets",
    title: "Secret islands and signs",
    note: "The '?' island with its dragon in the fog, the ruins of retired models, and the region sign boards.",
    items: [
      { id: "fog-island", name: "“?” island", encodes: "an undiscovered secret (here be dragons)", W: 160, H: 96, map: 80, draw: (size) => <FogIsland size={size} /> },
      { id: "dragon", name: "Paper dragon", encodes: "the secret's keeper, friendly", W: 100, H: 74, map: 44, draw: (size) => <PaperDragon size={size} /> },
      { id: "dragon-sil", name: "Dragon in the fog", encodes: "a secret not yet found", W: 100, H: 74, map: 44, draw: (size) => <PaperDragon size={size} silhouette /> },
      { id: "ruins", name: "Ruins", encodes: "retired models (epitaphs)", W: 120, H: 62, map: 50, draw: (size) => <Ruins size={size} /> },
      ...FAMILIES.map((f): Specimen => ({ id: `sign-${f}`, name: `Sign, ${f}`, encodes: "region name, staked beside the set-piece", W: 170, H: 52, map: 40,
        draw: (size) => <SignBoard text={f.charAt(0).toUpperCase() + f.slice(1)} family={f} size={size} /> })),
    ],
  },
];

const art = (id: string, name: string, encodes: string, W: number, H: number, map: number, node: (size: number) => ReactNode): Specimen => ({ id, name, encodes, W, H, map, draw: node });
/** Flat/parent-unit things drawn in a fixed box, scaled to the cell. */
const boxed = (id: string, name: string, encodes: string, W: number, H: number, map: number, node: ReactNode): Specimen =>
  ({ id, name, encodes, W, H, map, draw: (size) => <g transform={`scale(${size / H})`}>{node}</g> });
const SLAB = "M-60 -40 C-40 -62 20 -66 52 -52 C70 -42 66 -20 44 -12 C10 -2 -40 -4 -58 -16 C-66 -24 -66 -32 -60 -40Z";
const slab = (top: "grass" | "autumn" | "snow" | "desert" | "lava" | "night" | "reef") => <g transform="translate(0 -32)"><LandSlab d={SLAB} depth={28} top={top} /></g>;
const seaTile = (node: ReactNode) => <g><rect x={-80} y={-86} width={160} height={96} fill="url(#pa-sea-paint)" rx={6} />{node}</g>;

export const WORLD_CATALOG: SpecimenGroup[] = [
  {
    id: "world-terrain",
    title: "Storybook terrain",
    note: "Raised land slabs with layered cliff walls (a stack of paper bands), waterfalls, floating islands, sea stacks, mesas, lava rivers and rails.",
    items: [
      ...(["grass", "autumn", "snow", "desert", "lava", "night"] as const).map((t) => boxed(`slab-${t}`, `Land slab, ${t}`, "a family's land (LandSlab d={regionPath} top=…)", 160, 96, 96, seaTile(slab(t)))),
      boxed("waterfall", "Waterfall", "a river leaving the land over the cliff", 160, 96, 96, seaTile(<g>{slab("grass")}<path d="M-20 -60 C-10 -50 0 -46 8 -36" stroke="#72B2D0" strokeWidth={6} fill="none" /><Waterfall x={8} y={-36} h={30} w={12} /></g>)),
      boxed("lava-river", "Lava river", "the lava forge's flow (ground layer)", 160, 96, 96, <g><rect x={-80} y={-86} width={160} height={96} fill="url(#pa-s-lavarock)" rx={6} /><LavaRiver d="M-70 -70 C-30 -60 -20 -20 20 -30 C50 -38 60 -10 70 0" w={9} /></g>),
      boxed("rails", "Rails", "the railway the steam train runs on", 160, 96, 96, <g><rect x={-80} y={-86} width={160} height={96} fill="url(#pa-s-desert)" rx={6} /><Rails d="M-70 -20 C-30 -60 30 -10 70 -50" ground="#DDA560" /></g>),
      art("floating", "Floating island", "a structure island, rock hanging beneath", 110, 120, 110, (s) => <FloatingIsland size={s} />),
      art("seastack", "Sea stack", "rocky pillar in the sea", 50, 70, 50, (s) => <SeaStack size={s} />),
      art("mesa", "Mesa", "Wild West butte", 110, 64, 56, (s) => <Mesa size={s} wide />),
    ],
  },
  {
    id: "world-flora",
    title: "Storybook forests and creatures",
    note: "Ink-lined trees in dark forest greens and autumn tones; ForestCluster scatters a lush, depth-sorted patch.",
    items: [
      art("conifer", "Conifer", "forest tree", 30, 40, 30, (s) => <Conifer size={s} />),
      art("snowpine", "Snowy pine", "snow plateau tree", 30, 40, 30, (s) => <Conifer size={s} snow />),
      art("broadleaf", "Broadleaf", "meadow tree", 30, 40, 28, (s) => <Broadleaf size={s} />),
      art("autumn", "Autumn tree", "the Sequence heartland's trees", 30, 40, 28, (s) => <Broadleaf size={s} autumn />),
      boxed("forest", "Forest cluster", "a lush forest patch (mix conifer|broadleaf|autumn|mixed|fall)", 180, 90, 90, <ForestCluster x={0} y={-30} w={150} h={50} n={22} seed={2} mix="mixed" />),
      boxed("forest-fall", "Forest cluster, fall", "the heartland's autumn wood", 180, 90, 90, <ForestCluster x={0} y={-30} w={150} h={50} n={20} seed={9} mix="fall" />),
      art("deer", "Deer", "the snow plateau's resident", 40, 36, 28, (s) => <Deer size={s} />),
      art("spire", "Crystal spire", "representation's ice crystal", 60, 96, 80, (s) => <CrystalSpire size={s} />),
      art("coral", "Coral", "dome-city reef", 30, 30, 24, (s) => <Coral size={s} />),
      art("jelly", "Jellyfish", "dome-city drifter", 30, 40, 30, (s) => <Jellyfish size={s} />),
    ],
  },
  {
    id: "world-built",
    title: "Storybook buildings",
    note: "The heartland's red castle and waterwheel houses; the Wild West; the lava forge, the neon city and the underwater domes.",
    items: [
      art("castle", "Red-roofed castle", "the transformer's castle (heartland)", 130, 156, 120, (s) => <StoryCastle size={s} />),
      art("wheelhouse", "Waterwheel house", "heartland mill", 70, 60, 50, (s) => <WaterwheelHouse size={s} />),
      ...[0, 1, 2, 3].map((v) => art(`store-${v}`, `Storefront ${v + 1}`, "Wild West main street", 56, 56, 46, (s) => <Storefront size={s} variant={v} />)),
      art("windpump", "Windpump", "Wild West windmill", 60, 92, 70, (s) => <Windpump size={s} />),
      art("chess", "Giant chessboard", "alphazero's board", 130, 60, 50, (s) => <Chessboard size={s} />),
      art("maze", "Hedge maze", "rl_maze's maze", 130, 50, 44, (s) => <HedgeMaze size={s} />),
      art("lavacastle", "Lava castle", "the lava forge's black castle", 100, 134, 100, (s) => <LavaCastle size={s} />),
      ...[0, 1, 2, 3].map((v) => art(`neon-${v}`, `Neon tower ${v + 1}`, "the neon city (pink/cyan signs)", 44, 124, 90, (s) => <NeonTower size={s} variant={v} />)),
      art("dome", "Glass dome", "the underwater dome city", 90, 84, 70, (s) => <GlassDome size={s} />),
    ],
  },
  {
    id: "world-sea",
    title: "Storybook sea",
    note: "Painted-wave water (pa-sea-paint), a sailing ship and a friendly sea serpent.",
    items: [
      boxed("sea", "Painted sea", "url(#pa-sea-paint) — the ocean surface", 160, 96, 96, seaTile(null)),
      art("ship", "Sailing ship", "a composition under sail", 100, 84, 60, (s) => <SailingShip size={s} />),
      art("serpent", "Sea serpent", "here be serpents (sea decor)", 130, 62, 56, (s) => <SeaSerpent size={s} />),
    ],
  },
  {
    id: "world-furniture",
    title: "Map furniture",
    note: "Parchment and ink in the storybook serif: title cartouche, family signboards with a subtitle, model tags, compass, scale bar.",
    items: [
      boxed("cartouche", "Title cartouche", "the map's title and blurb", 330, 130, 130, <TitleCartouche x={0} y={-65} />),
      ...["perception", "representation", "structure", "sequence", "decision", "generative"].map((f) => boxed(`fsign-${f}`, `Family sign, ${f}`, "family name + taxonomy subtitle", 240, 60, 60, <FamilySign x={0} y={-30} family={f} />)),
      boxed("tag", "Model tag", "a model's name on the map", 120, 30, 30, <ModelTag x={0} y={-15} text="transformer" />),
      boxed("compass", "Compass rose", "orientation", 100, 100, 90, <CompassRose x={0} y={-50} r={32} />),
      boxed("scalebar", "Scale bar", "22 pipelines", 150, 40, 40, <ScaleBar x={-60} y={-26} w={120} />),
    ],
  },
];
