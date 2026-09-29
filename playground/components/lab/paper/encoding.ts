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
  road: "#6B4A1E",          // road edge (dark brown: gold reads on every ground)
  footpath: "#7E6444",      // secondary parents: thin solid path, lower value
  stone: "#D9C7A2",         // mountains, ruins
  stoneDark: "#A88F66",
  roof: "#8C4A2F",
  plank: "#9A5B2B",
  plankDark: "#6E3E1B",
} as const;

// ── family → region colour. Round 2 colour discipline: the ground is LOW
// chroma (a pale card stock per family, still distinct); saturation is kept
// for evidence (blue trained faces, gold champion seals) and the focus. Never
// blue = sea, never gold = road, never red = champion flag.
// face = land fill, edge = cardstock thickness under the cutout, light = set-
// piece highlight facet, dark = facet shade / props / roofs.
export interface FamilyInk { face: string; edge: string; light: string; dark: string }

export const FAMILY_INK: Record<string, FamilyInk> = {
  perception:     { face: "#A9D08A", edge: "#5F8F46", light: "#CFE6BB", dark: "#5E8A45" }, // sage meadow
  sequence:       { face: "#EDBB8C", edge: "#B0713C", light: "#F7D8B8", dark: "#A96A36" }, // apricot card
  generative:     { face: "#B7A6DE", edge: "#6E5AA6", light: "#D8CEF0", dark: "#6F5BA8" }, // lavender card
  representation: { face: "#8FCFC6", edge: "#3F8A80", light: "#C3E8E2", dark: "#3D857C" }, // sea-glass
  structure:      { face: "#EBB0CB", edge: "#A85B80", light: "#F6D5E4", dark: "#A6587E" }, // rose card
  decision:       { face: "#CBDB86", edge: "#7C8F33", light: "#E3ECBC", dark: "#798C31" }, // pear card
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
  // ── region view = the family's clearing scene (owner reference 2026-09-29) ──
  { mark: "clearing scene (canopy frame, glowing stage, biome trees)", encodes: "the family you entered; tree kind + palette = its biome (meadow, palms, puff/lava, snowy pines, crystals, acacias)", source: "region family → biomeOf()" },
  { mark: "little paper character on a disc", encodes: "a derived model; body = family colour, belly emblem = species; disc = evidence (gold+star champion, blue trained, white hollow untrained, pencil provisional)", source: "world.nodes + evidenceState()" },
  { mark: "mechanism landmark in the clearing", encodes: "an atom (its own landmark)", source: "AtomLandmark(name)" },
  { mark: "character positions", encodes: "the model's world position, squashed into the clearing (same map for all)", source: "sceneLayout(world, family).map" },
  { mark: "stepping stones", encodes: "builds-on roads inside the family (dotted stones = the walk back to the atom)", source: "world.roads (both ends in family)" },
  { mark: "stones leaving through the trees + signpost 'To X'", encodes: "builds-on edges to another family, toward where it lies on the map; click to go there", source: "world.roads (cross-family) + camera.regions" },
  { mark: "mushroom-tree, twin pines, hollow trunk, ferns, flowers, tufts", encodes: "nothing — clearing dressing in free space only (round-3 brief allows biome dressing)", source: "sceneLayout props" },
  { mark: "dark vignette", encodes: "nothing — frames the stage", source: "—" },
  // ── round 2/3 marks ──
  { mark: "tilted ground plane (diorama)", encodes: "nothing — a camera: the far edge recedes; positions are the world's, picking unprojects the tilt", source: "diorama.ts (project / unproject)" },
  { mark: "printed ground (grass stripes, dunes)", encodes: "the family's biome: perception, sequence (others: their card-stock colour)", source: "world.regions[].family" },
  { mark: "illustrated set-piece / spot / house / boat / critter art", encodes: "same data as the marks below, drawn by the art library (./art)", source: "art/catalog.tsx encodes column" },
  { mark: "paper clouds over empty sea", encodes: "nothing — weather over world.seaSlots (decoration allowed by the round-3 brief)", source: "world.seaSlots" },
  { mark: "stand-up cutouts (billboards)", encodes: "each prop stands at its world base point, drawn far → near", source: "billboards.tsx" },
  { mark: "species emblem on a spot", encodes: "which model (one glyph per species)", source: "iconFor(name) (lib/icons)" },
  { mark: "semantic zoom (castles hold ~48px at the whole-map view; derived spots shrink to dots)", encodes: "atoms read first; derived models appear as you zoom in", source: "camera scale" },
  { mark: "parent → child chevrons on a road", encodes: "direction of builds-on", source: "world.roads[].chevrons" },
  { mark: "road drawn on its lane", encodes: "one road per edge, never merged with a neighbour", source: "world.roads[].lanePoints" },
  { mark: "quiet cross-family road, raised when an end is focused", encodes: "a builds-on edge between families", source: "world.roads[] (kind bridge)" },
  { mark: "town of paper houses around a castle; a keep = capital", encodes: "the atom's direct children (houses) and hub status", source: "world.cities[]" },
  { mark: "mountain range", encodes: "a family border no road crosses", source: "world.mountains" },
  { mark: "pier + up to 3 paper boats (+ number badge)", encodes: "compositions that touch the family", source: "world.harbours[].boats" },
  { mark: "sailing boat + dashed sea route", encodes: "the selected composition's route through its members", source: "ferryRoute(world, composes)" },
  { mark: "paper train on a lineage line", encodes: "a live running training run", source: "useLiveTraining(runs)" },
  { mark: "blue ticket on a name tag", encodes: "runs recorded for that model", source: "stationCounts(runs)" },
  { mark: "name tag (screen space, 16/14px)", encodes: "model name; placed by priority, culled on collision and within 24px of the edge", source: "placeScreenLabels (+ local obstacle shim)" },
  { mark: "dimmed map in the node view", encodes: "everything outside the focused model's family tree", source: "lineage + pathToAtom" },
  { mark: "blue sea with scalloped waves", encodes: "no model lives here (empty space between families)", source: "world.terrain == SEA" },
  { mark: "coloured cardstock island", encodes: "a family of models; its area grows with the family's model count", source: "world.regions[] + world.regionOf" },
  { mark: "island colour", encodes: "which family (perception meadow, sequence tangerine, generative violet, representation teal, structure pink, decision lime)", source: "world.regions[].family → FAMILY_INK" },
  { mark: "one blue river (smooth ribbon, foam banks, widening mouth, planks where roads cross)", encodes: "the longest family border that reaches the sea, preferring Representation's", source: "borders(world) → pickRiver" },
  { mark: "stitched hedge / low stone wall", encodes: "every other border between two families (wall where Generative or Structure meets a neighbour)", source: "borders(world)" },
  { mark: "island sitting alone in the sea", encodes: "a family with no edges to other families", source: "world.regions[].islet" },
  { mark: "white die-cut rim + offset card edge", encodes: "layer order (sea < land < roads < spots < set-pieces); no data beyond stacking", source: "render order" },
  { mark: "paper-fibre texture on land", encodes: "land (vs sea); same tile everywhere", source: "world.terrain != SEA" },
  { mark: "fat gold road (rimmed, shadowed)", encodes: "a builds-on edge to the child's primary parent — the lineage trunk", source: "world.roads[] (primary)" },
  { mark: "thin dashed footpath (60% opacity)", encodes: "a builds-on edge to one of the child's other parents", source: "world.roads[] (!primary)" },
  { mark: "wooden plank bridge", encodes: "a builds-on edge that crosses from one family into another", source: "world.bridges[]" },
  { mark: "ink stitches on a white under-stroke", encodes: "the walk from the focused (or hovered) model back to its root atom", source: "pathToAtom(world, name)" },
  { mark: "big two-tier octagon (castle spot)", encodes: "an atom — an elementary model that roots its family", source: "world.nodes[].atom" },
  { mark: "small octagon spot", encodes: "a derived model", source: "world.nodes[] (!atom)" },
  { mark: "filled blue spot face", encodes: "trained: the model has at least one run", source: "evidenceState() == trained | champion" },
  { mark: "hollow white spot face", encodes: "not trained yet", source: "evidenceState() == untrained" },
  { mark: "pencil-sketch dashed spot, no gold", encodes: "provisional: its quality bar is not inked yet", source: "evidenceState() == provisional" },
  { mark: "gold star seal on the spot face", encodes: "champion: a checkpoint that passed the quality gate", source: "evidenceState() == champion" },
  { mark: "red flag with a white star", encodes: "champion — raised only on the selected, hovered or keyboard-focused spot (red means champion, nothing else)", source: "evidenceState() == champion + ?focus= / hover" },
  { mark: "ink outline halo + lifted spot", encodes: "the focused (or hovered, in the region view) model", source: "?focus= / hover" },
  { mark: "dashed ink ring", encodes: "keyboard focus on a spot", source: ":focus-visible" },
  { mark: "2px hover lift", encodes: "the spot under the pointer can be opened", source: ":hover" },
  { mark: "vellum sheet over the map", encodes: "everything outside the family tree of the focused model (node view) or the hovered/keyboard-focused spot (region view); its parents, children and walk to the atom stay above it", source: "world.nodes[].parents + pathToAtom" },
  { mark: "cut-paper name tag", encodes: "model name at the world's label anchor; shown when ≥13px on screen", source: "world.labels[]" },
  { mark: "knit felt texture on set-piece facets", encodes: "part of the set-piece mark (family-coloured facets); no extra data", source: "world.regions[].setPiece" },
  { mark: "pop-up set-piece", encodes: "the family's signature mechanism; grows up to 1.6× into free land/sea margin that holds no spot, road or tag (lighthouse eye, clock tower, kiln, twin towers, crystal lattice, dice keep)", source: "world.regions[].setPiece" },
  { mark: "region sign (cut card)", encodes: "family name, staked beside the family's set-piece (whole-map view only)", source: "world.regions[].family + setPiece" },
  { mark: "small paper props: eye-flowers, token trains, sample puffs, mirrored reeds, linked shards, dice", encodes: "the family's biome — each echoes its set-piece mechanism; drawn on every world.decor cell (variant unused)", source: "world.decor[].region, .scale" },
  { mark: "one-eyed critter", encodes: "you, walking from the focused model's root atom to it", source: "pathToAtom(world, focus) reversed" },
  { mark: "folded paper note", encodes: "the focused model's card (description, lineage, proof)", source: "cardModel()" },
];

// ── eggs (components/lab/shared/eggs/README.md) ─────────────────────────
export const EGGS: Encoding[] = [
  { mark: "grokking note: 'memorising…' then the insight after 4 s", encodes: "delayed generalisation (illustrative curve, labelled)", source: "useLongFocus + GROKKING_EGG" },
  { mark: "pencil '?' island past the sea edge + sea serpent", encodes: "next-era models not yet in the zoo; 'here be dragons'", source: "world.hiddenIsland + NEXT_ERA" },
  { mark: "ruined columns on a far islet (click for an epitaph)", encodes: "retired legacy/ models and their living successor", source: "world.ruinsIsland + RUINS" },
  { mark: "critter clicked 7× trains: a real loss curve draws itself", encodes: "a REAL decreasing loss from /web/runs (hidden if none)", source: "useCritterClicks + useRealLossCurve" },
  { mark: "Konami code: gold rings pulse generation by generation", encodes: "a forward pass across the zoo in depth order", source: "useKonami + forwardPassSchedule" },
  { mark: "double_descent boat dips twice on its course", encodes: "test error falls, rises at the interpolation threshold, falls again", source: "dipDepth(t)" },
];
