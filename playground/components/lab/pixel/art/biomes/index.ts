// Zone art library (round 4, the owner's FINAL pixel reference): the reference
// map's set-pieces and biomes, redrawn from scratch in our TS pixel system in
// its 3/4 diorama style and colours. See README.md for the builder contract.
import type { EvidenceState } from "@/components/lab/shared/card-model";
import type { ArtImage } from "../raster";
import { stampInto, type EmblemMaskLike } from "../sprites/markers";
import type { Sprite } from "../sprites/paint";
import { BR } from "./palette";
import { Pen, stampOf, type BiomeStamp } from "./kit";
import { WEST_LANDMARKS, westLandmark, westMarker, westSprites, westStamps } from "./west";
import { NEON_LANDMARKS, neonLandmark, neonMarker, neonStamps } from "./cyber";
import { REEF_LANDMARKS, reefLandmark, reefMarker, reefStamps } from "./reef";
import { TOWN_LANDMARKS, townLandmark, townSprites } from "./town";
import { SANDS_LANDMARKS, sandsLandmark, sandsSprites } from "./sands";
import { FORGE_LANDMARKS, forgeLandmark, forgeSprites } from "./forge";
import { seaSprites } from "./sea";
import { SCENES } from "./scenes";

export { BR, BIOME_HEX, BIOME_INK, C, dk, lt, REF_OF, type BiomeRampName } from "./palette";
export { atTier, cluster, Pen, type BiomeStamp } from "./kit";
export {
  biomeGround, groundHook, neonGrid, distInside, distOutside, paintCliffs, paintUnderside, ZONE_GROUNDS,
  type BiomeGround, type PaintOptions,
} from "./ground";
export { boomtown, westSprites } from "./west";
export { cityBlocks, neonSprites, NEON_KEEP } from "./cyber";
export { coralCluster, reefSprites, REEF_KEEP } from "./reef";
export { banner9, townSprites } from "./town";
export { sandsSprites } from "./sands";
export { forgeSprites } from "./forge";
export { cartouche, seaSprites } from "./sea";
export { Layout, blobMask } from "./vignette";
export { SCENES };

export type ZoneKey = "forest" | "wildwest" | "village" | "snow" | "marble" | "stilts" | "forge" | "sunken" | "cyber" | "sea";

/** The zones of the reference map: family, name, and the atoms whose landmark lives there. */
export const ZONES: Record<ZoneKey, { family: string; name: string; atoms: string[] }> = {
  forest: { family: "perception", name: "pine & oak forest — giant treehouse, windmill, timbered towns, pier", atoms: ["classifier", "segmentation"] },
  wildwest: { family: "perception", name: "wild-west plateau (south-west) — saloon, water towers, rail + mine cart, cacti", atoms: ["tabular_classifier"] },
  snow: { family: "representation", name: "snowy peaks — the red-flagged twin castle, snowy pines", atoms: ["simclr"] },
  marble: { family: "sequence", name: "marble sands — cathedral rise, ruins, pools, palms", atoms: ["transformer", "rnn"] },
  stilts: { family: "sequence", name: "north-east desert — wooden stilt towers, a windmill, hoodoos", atoms: ["mamba"] },
  forge: { family: "generative", name: "the volcano — smokestacks, lava rivers, dark forges", atoms: ["diffusion", "pixelcnn", "vae", "gan"] },
  village: { family: "decision", name: "east village — red-roof church, domed observatory", atoms: ["alphazero"] },
  sunken: { family: "decision", name: "the SE bay — underwater ruins city (domes, coral, fish, jellyfish)", atoms: ["reinforce", "rl_maze"] },
  cyber: { family: "structure", name: "the floating cyberpunk island (top-right) — neon towers, hanging cables + lanterns", atoms: ["gnn", "nerf"] },
  sea: { family: "", name: "sea furniture — ships, islets with a tuft, lighthouse, serpent, waves, clouds, compass, cartouche, corner icons", atoms: [] },
};
/** A family's main zone (derived models default here; the builder may override per model/position). */
export const FAMILY_ZONE: Record<string, ZoneKey> = {
  perception: "forest", sequence: "marble", generative: "forge", representation: "snow", decision: "village", structure: "cyber",
};
export const ZONE_OF_ATOM: Record<string, ZoneKey> = Object.fromEntries(
  (Object.entries(ZONES) as [ZoneKey, { atoms: string[] }][]).flatMap(([z, v]) => v.atoms.map((a) => [a, z])),
);
/** Zone of a model: its atom zone, else its family's main zone. */
export const zoneOf = (name: string, family?: string): ZoneKey | undefined => ZONE_OF_ATOM[name] ?? (family ? FAMILY_ZONE[family] : undefined);
const asZones = (k: string): ZoneKey[] =>
  k in ZONES ? [k as ZoneKey] : (Object.entries(ZONES) as [ZoneKey, { family: string }][]).filter(([, v]) => v.family === k).map(([z]) => z);

// ——————————————————————————— stamps ———————————————————————————
function zoneStamps(z: ZoneKey): BiomeStamp[] {
  const t = townSprites(), s = sandsSprites(), f = forgeSprites(), w = westSprites(), sea = seaSprites();
  switch (z) {
    case "forest": return [
      stampOf("pine", "decor", t.pine, "layered 3/4 pine"), stampOf("pine · small", "decor", t.pineS, ""),
      stampOf("oak", "decor", t.oak, "three-lobed broadleaf"), stampOf("oak · small", "decor", t.oakS, ""),
      stampOf("grove", "decor", t.grove, "pines + an oak, back to front"),
      stampOf("timber house · red", "town", t.house0, "half-timbered, red gable"), stampOf("timber house · slate", "town", t.house1, "tall, slate roof"),
      stampOf("timber house · wide", "town", t.house2, "dormer + chimney"), stampOf("windmill", "town", t.windmill, "west coast: stone tower, lattice sails"),
      stampOf("water tower", "town", w.waterTower, "tank on trestle legs"), stampOf("pier", "town", t.pier, "segmentation's wooden pier on piles"),
      stampOf("giant treehouse", "town", t.treehouse, "HERO: cabin in a vast oak, two platforms, ladders"),
    ];
    case "village": return [
      stampOf("oak", "decor", t.oak, ""), stampOf("grove", "decor", t.grove, ""), stampOf("cottage", "town", t.house0, "red-roof cottage"),
      stampOf("farmhouse", "town", t.house2, "wide, dormer"), stampOf("domed observatory", "town", t.observatory, "HERO: Decision's hub"),
    ];
    case "snow": return [
      stampOf("snowy pine", "decor", t.pineSnow, ""), stampOf("snowy pine · small", "decor", t.pineSnowS, ""),
      stampOf("snow peak L", "relief", t.peakL, "lit snow face, shaded face, rock foot"), stampOf("snow peak M", "relief", t.peakM, ""), stampOf("snow peak S", "relief", t.peakS, ""),
    ];
    case "marble": return [
      stampOf("palm", "decor", s.palm, ""), stampOf("palm ←", "decor", s.palmL, ""), stampOf("marble column", "relief", s.column, "fluted, capital + base"),
      stampOf("broken column", "relief", s.columnB, ""), stampOf("pool", "relief", s.pool, "tiled rim, glint row"),
    ];
    case "stilts": return [
      stampOf("hoodoo", "relief", s.hoodoo, "striped desert spire"), stampOf("hoodoo · small", "relief", s.hoodooS, ""),
      stampOf("desert windmill", "town", w.windmill, "lattice tower, fan wheel"), stampOf("scrub", "decor", w.scrub, ""), stampOf("tumbleweed", "decor", w.tumbleweed, ""),
    ];
    case "forge": return [
      stampOf("volcano", "relief", f.volcano, "HERO: basalt cone, glowing crater, lava rivers, rim smokestacks"),
      stampOf("smokestack", "town", f.smokestack, "brick chimney, soot plume"), stampOf("basalt spire", "relief", f.spire, "lava cracks"),
      stampOf("basalt spire · small", "relief", f.spireS, ""), stampOf("lava pool", "relief", f.lavaPool, "crusted rim, molten core"),
    ];
    case "wildwest": return westStamps();
    case "sunken": return reefStamps();
    case "cyber": return neonStamps();
    case "sea": return [
      stampOf("galleon", "fauna", sea.ship, "two masts, cream sails"), stampOf("galleon ←", "fauna", sea.shipL, ""), stampOf("sloop", "fauna", sea.sloop, ""),
      stampOf("islet · pines", "relief", sea.islet, "layered rock skirt, foam"), stampOf("islet · small", "relief", sea.isletS, ""),
      stampOf("rock · tuft", "relief", sea.tuft, "rocky islet with a tuft of grass"), stampOf("sea rock", "relief", sea.rock, "bare"),
      stampOf("lighthouse islet", "town", sea.lighthouse, "striped tower, lantern beams"), stampOf("sea serpent", "fauna", sea.serpent, "western sea: humps, finned head, spout"),
      stampOf("wave", "fauna", sea.wave, "parchment-sea dash"),
      stampOf("cloud", "fauna", sea.cloud0, ""), stampOf("cloud · small", "fauna", sea.cloud1, ""), stampOf("cloud · long", "fauna", sea.cloud2, ""),
      stampOf("compass rose", "fauna", sea.compass, "N/E/S/W"), stampOf("ruins icon", "fauna", sea.ruins, "corner: N ruins"), stampOf("pipelines icon", "fauna", sea.pipelines, "corner: N pipelines"),
    ];
  }
}

/** Every stamp of a ZONE, or of all zones of a FAMILY. */
export function biomeStamps(zoneOrFamily: string): BiomeStamp[] {
  return asZones(zoneOrFamily).flatMap(zoneStamps);
}

// ——————————————————————————— landmarks ———————————————————————————
const ALL_LANDMARKS = { ...TOWN_LANDMARKS, ...WEST_LANDMARKS, ...SANDS_LANDMARKS, ...FORGE_LANDMARKS, ...REEF_LANDMARKS, ...NEON_LANDMARKS };
export const BIOME_LANDMARK_NOTES: Record<string, string> = Object.fromEntries(Object.entries(ALL_LANDMARKS).map(([k, v]) => [k, v.note]));

/** Emblem colours per landmark slot: [glyph, drop]. Cream banners / tablets → ink; holo panels → neon. */
const SLOT_INK: Record<string, [number, number | undefined]> = {
  default: [BR.ink[0], undefined],
  gnn: [BR.neonC[2], undefined],
  nerf: [BR.neonM[2], undefined],
};

/** The zone landmark of an ATOM (36×46, anchor (18, 43), 9×9 emblem slot), or undefined (use castleSprite). */
export function biomeLandmark(name: string, emblem?: EmblemMaskLike): Sprite | undefined {
  const base = townLandmark(name) ?? westLandmark(name) ?? sandsLandmark(name) ?? forgeLandmark(name) ?? reefLandmark(name) ?? neonLandmark(name);
  if (!base) return undefined;
  if (!emblem || !base.slot) return base;
  const k = `${name}:emblem`;
  let s = emblemed.get(k);
  if (!s) { s = withGlyph(base, emblem, SLOT_INK[name] ?? SLOT_INK.default); emblemed.set(k, s); }
  return s;
}
const emblemed = new Map<string, Sprite>();

function withGlyph(base: Sprite, emblem: EmblemMaskLike, [fill, drop]: [number, number | undefined]): Sprite {
  const p = new Pen(base.img.w, base.img.h);
  p.img.data.set(base.img.data);
  stampInto(p, base.slot!, emblem, fill, drop);
  return { ...base, img: p.img };
}

/** Zone-styled marker for a DERIVED model (20×28, anchor (10, 26), 7×7 slot): wildwest tent · sunken clam · cyber pod; else undefined (markerSprite). */
export function biomeMarker(zone: string, state: EvidenceState, emblem?: EmblemMaskLike): Sprite | undefined {
  const k = `${zone}:${state}`;
  if (!emblem && markers.has(k)) return markers.get(k);
  const s = zone === "cyber" || zone === "structure" ? neonMarker(state, emblem) : zone === "sunken" ? reefMarker(state, emblem) : zone === "wildwest" ? westMarker(state, emblem) : undefined;
  if (!emblem) markers.set(k, s);
  return s;
}
const markers = new Map<string, Sprite | undefined>();

/** A composed showcase scene (forest · wildwest · heartland · forge · sunken · cyber · sea) at near detail. */
export function biomeVignette(scene: string): ArtImage | undefined {
  return SCENES[scene]?.make();
}
