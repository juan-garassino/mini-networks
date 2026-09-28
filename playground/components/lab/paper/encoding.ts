// Papercraft skin — design tokens and the mark → data table.
//
// Every visual mark on the paper map is declared in ENCODING. If a mark is not
// in this table it does not belong on the map. Positions always come from
// lib/world; this file only decides how a datum is painted.

// ── core palette (from the brief) ───────────────────────────────────────
export const PAPER = {
  sea: "#1E6FD9",
  seaLight: "#4A8FE8",      // scalloped wave stroke on the sea
  seaDeep: "#1553A8",       // card-edge under land cutouts
  meadow: "#6CC24A",
  gold: "#F2B632",
  goldEdge: "#B87A0E",      // darker road/rim edge
  goldSide: "#C98A14",      // octagon side thickness
  die: "#FFFDF6",           // die-cut white rim
  ink: "#2B2118",
  inkSoft: "#5A4B3C",
  flag: "#E23D3D",
  face: "#2F74E0",          // level-spot face (blue)
  faceDeep: "#1F55AE",
  pencil: "#7A6E62",        // graphite for "not inked yet" sketches
  shadow: "rgba(43,33,24,0.26)",
  plank: "#9A5B2B",
  plankDark: "#6E3E1B",
} as const;

// ── family → region colour (saturated, distinct; never blue = sea, never
// gold = road, never flag red = champion). face = land fill, edge = cardstock
// thickness under the cutout, light = set-piece highlight facet, dark = facet
// shade / decor. ─────────────────────────────────────────────────────────
export interface FamilyInk { face: string; edge: string; light: string; dark: string }

export const FAMILY_INK: Record<string, FamilyInk> = {
  perception:     { face: "#6CC24A", edge: "#3F8A2A", light: "#9BDD7A", dark: "#3E8F2A" }, // meadow
  sequence:       { face: "#F08A3C", edge: "#B35A1C", light: "#FFB273", dark: "#C4601E" }, // tangerine
  generative:     { face: "#8E62D9", edge: "#5E3AA3", light: "#B99AF0", dark: "#6841B0" }, // kiln violet
  representation: { face: "#2EBFB3", edge: "#1A8177", light: "#7FE0D6", dark: "#178C82" }, // lagoon teal
  structure:      { face: "#EE6FAE", edge: "#B03F78", light: "#FFA6D1", dark: "#C24587" }, // crystal pink
  decision:       { face: "#A9D23A", edge: "#6F8F1C", light: "#CFEA7C", dark: "#789A1E" }, // lime court
};
const FALLBACK_INK: FamilyInk = { face: "#C9B28A", edge: "#8C7650", light: "#E4D3B1", dark: "#8C7650" };
export const inkOf = (family: string): FamilyInk => FAMILY_INK[family] ?? FALLBACK_INK;

// Learner-facing region names + one plain line each (HUD + legend).
export const FAMILY_COPY: Record<string, { name: string; line: string; piece: string }> = {
  perception: { name: "Perception", line: "Models that look at images, sound and tables and say what they see.", piece: "Lighthouse eye: these models see." },
  sequence: { name: "Sequence", line: "Models that read and write one token after another.", piece: "Clock tower: order and time steps." },
  generative: { name: "Generative", line: "Models that make new samples from noise or a code.", piece: "Paper kiln: it puffs out samples." },
  representation: { name: "Representation", line: "Models that learn embeddings — two views, one meaning.", piece: "Twin towers mirrored in a lake: paired views." },
  structure: { name: "Structure", line: "Models for graphs and 3D scenes.", piece: "Crystal lattice: nodes and links." },
  decision: { name: "Decision", line: "Models that act, get rewarded and learn to choose.", piece: "Dice keep: choices under chance." },
};
export const familyName = (f: string) => FAMILY_COPY[f]?.name ?? f.charAt(0).toUpperCase() + f.slice(1);

// ── the table ───────────────────────────────────────────────────────────
export interface Encoding { mark: string; encodes: string; source: string }

export const ENCODING: Encoding[] = [
  { mark: "blue sea with scalloped waves", encodes: "no model lives here (empty space between families)", source: "world.terrain == SEA" },
  { mark: "coloured cardstock island", encodes: "a family of models; its area grows with the family's model count", source: "world.regions[] + world.regionOf" },
  { mark: "island colour", encodes: "which family (perception meadow, sequence tangerine, generative violet, representation teal, structure pink, decision lime)", source: "world.regions[].family → FAMILY_INK" },
  { mark: "water channel between islands", encodes: "the border between two families that share models", source: "world.terrain == RIVER" },
  { mark: "island sitting alone in the sea", encodes: "a family with no edges to other families", source: "world.regions[].islet" },
  { mark: "white die-cut rim + offset card edge", encodes: "layer order (sea < land < roads < spots < set-pieces); no data beyond stacking", source: "render order" },
  { mark: "paper-fibre texture on land", encodes: "land (vs sea); same tile everywhere", source: "world.terrain != SEA" },
  { mark: "fat gold road", encodes: "a builds-on edge (child builds on parent); fat = the child's primary parent", source: "world.roads[] (primary)" },
  { mark: "thin gold road", encodes: "a secondary builds-on edge", source: "world.roads[] (!primary)" },
  { mark: "wooden plank bridge", encodes: "a builds-on edge that crosses from one family into another", source: "world.bridges[]" },
  { mark: "red stitched trail on the roads", encodes: "the focused model's lineage back to its root atom", source: "pathToAtom(world, focus)" },
  { mark: "big two-tier octagon (castle spot)", encodes: "an atom — an elementary model that roots its family", source: "world.nodes[].atom" },
  { mark: "small octagon spot", encodes: "a derived model", source: "world.nodes[] (!atom)" },
  { mark: "letters on a castle spot", encodes: "the atom's symbol from the periodic table", source: "symbolFor(name) (lib/blueprint)" },
  { mark: "filled blue spot face", encodes: "trained: the model has at least one run", source: "evidenceState() == trained | champion" },
  { mark: "hollow white spot face", encodes: "not trained yet", source: "evidenceState() == untrained" },
  { mark: "pencil-sketch dashed spot, no gold", encodes: "provisional: its quality bar is not inked yet", source: "evidenceState() == provisional" },
  { mark: "red flag with a white star", encodes: "champion: a checkpoint that passed the quality gate", source: "evidenceState() == champion" },
  { mark: "ink ring + lifted spot", encodes: "the focused model", source: "?focus=" },
  { mark: "vellum sheet over the map (node view)", encodes: "everything outside the focused model's family tree; its parents, children and walk to the atom stay above it", source: "world.nodes[].parents + pathToAtom" },
  { mark: "cut-paper name tag", encodes: "model name at the world's label anchor; shown when ≥13px on screen", source: "world.labels[]" },
  { mark: "knit felt texture on set-piece facets", encodes: "part of the set-piece mark (family-coloured facets); no extra data", source: "world.regions[].setPiece" },
  { mark: "pop-up set-piece", encodes: "the family's signature mechanism (lighthouse eye, clock tower, kiln, twin towers, crystal lattice, dice keep)", source: "world.regions[].setPiece" },
  { mark: "region sign (cut card)", encodes: "family name, pinned to the family's set-piece", source: "world.regions[].family + setPiece" },
  { mark: "small paper props (bush, reed, shard …)", encodes: "the family's biome, only on free decor cells", source: "world.decor[].region (+ .variant, .scale)" },
  { mark: "one-eyed critter", encodes: "you, walking from the focused model's root atom to it", source: "pathToAtom(world, focus) reversed" },
  { mark: "folded paper note", encodes: "the focused model's card (description, lineage, proof)", source: "cardModel()" },
];
