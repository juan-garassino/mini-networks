// Every visual mark of the pixel skin → the data it encodes → where the data
// comes from. Anything drawn that is not in this table must be cut.
//
// Biomes (one family = one land; all tones from Sweetie-16, see palette.ts):
//   perception     green meadow  base #38b764 · light #a7f070 · shade #257179 · decor round tree
//   sequence       slate plateau base #566c86 · light #94b0c2 · shade #333c57 · decor cactus
//   generative     autumn woods  base #ef7d57 · light #ffcd75 · shade #b13e53 · decor red tree
//   representation snowfield     base #f4f4f4 · light #73eff7 · shade #94b0c2 · decor snowy pine
//   decision       violet moor   base #5d275d · light #b13e53 · shade #333c57 · decor mushroom
//   structure      teal reef     base #257179 · light #38b764 · shade #29366f · decor crystal
//   (unknown future family → open plain #a7f070)
export interface Mark { mark: string; encodes: string; source: string }

export const ENCODING: Mark[] = [
  // terrain — the illustrator's art/ system (terrain-shade.ts), one height field lit from the top-left
  { mark: "land biome (hue-shifted ramps: meadow, dunes & stone, volcanic reach, icy highlands, savanna, crystal isle)", encodes: "family of the region", source: "world.regionOf → art/palette BIOMES" },
  { mark: "elevation bands (sand → ground → forest → rock → snow) with slope light", encodes: "distance inland + the family-border ranges (terrain relief; ridges = borders)", source: "world.terrain distance field + world.mountains" },
  { mark: "land area", encodes: "model count of the family (area ∝ models)", source: "world.regions[].tiles" },
  { mark: "bright cyan shallow halo + foam dots; deep indigo ocean", encodes: "coast / sea", source: "world.terrain = SEA" },
  { mark: "maroon cliff lip under south/east coasts", encodes: "raised land edge (tile below land is sea)", source: "world.terrain neighbours" },
  { mark: "river (water band)", encodes: "border between two families", source: "world.terrain = RIVER" },
  { mark: "canopy clumps", encodes: "the forest-able band of that land's biome", source: "art/ stampCanopy by biome" },
  { mark: "clouds with cast shadows", encodes: "atmosphere only, over the empty sea slots (no data); one veils the hidden island", source: "world.seaSlots, world.hiddenIsland" },
  { mark: "compass rose (first open sea from the lower-left)", encodes: "north is up", source: "art terrain land mask (placement)" },
  { mark: "faceted snow-capped peaks (lit / shadow faces)", encodes: "a family border that no lineage crosses", source: "world.mountains" },
  // lineage
  { mark: "3-art-px two-tone road on its own lane (dark edge, light cobble core, cast shadow)", encodes: "builds_on edge to the model's primary parent; parallel roads never merge", source: "world.roads[].lanePoints (primary=true)" },
  { mark: "bold dark V arrows along every road", encodes: "direction of lineage, parent → child", source: "world.roads[].chevrons" },
  { mark: "stepping stones", encodes: "builds_on edge to a secondary parent", source: "world.roads[] primary=false" },
  { mark: "faint pressed trail (one shade darker)", encodes: "cross-family lineage, kept quiet until an endpoint is focused", source: "world.roads[] kind = bridge" },
  { mark: "plank bridge", encodes: "cross-family edge crossing a border river", source: "world.bridges[]" },
  { mark: "lit lanes in node view: parents gold / cyan / lime / orange (primary first), children foam-white, tone-coloured chevrons; kin name-plates rimmed to match", encodes: "every parent and child road of the focused model, each distinguishable", source: "lineage(world, focus)" },
  // settlements & travel
  { mark: "castle per mechanism (16 silhouettes) with the species emblem on its banner", encodes: "atom (elementary model) and which one", source: "world.nodes[].atom → art castleSprite(name) + lib/icons emblem" },
  { mark: "domed capital hall at the heart of a hub city", encodes: "capital: a hub atom (most models built on it)", source: "world.cities[].capital" },
  { mark: "houses round a castle, windows lit / unlit", encodes: "city blocks: models built on that atom; lit = the atom has runs or a champion", source: "world.cities[].blocks, evidence" },
  { mark: "gold star / wooden '?' board pinned on a castle", encodes: "atom champion / provisional bar", source: "evidenceState()" },
  { mark: "pedestal medallion with the species emblem", encodes: "derived model and which one", source: "world.nodes[].atom = false; iconFor(name)" },
  { mark: "medallion dress: gold + star (champion), royal blue + pennant (trained), grey in scaffold with '?' (provisional), dim cracked stone (untrained)", encodes: "evidence state", source: "evidenceState() → art markerSprite" },
  { mark: "castle one ramp step darker", encodes: "atom with no champion and no runs", source: "evidence" },
  { mark: "pier + boats (1 at overview, up to 3 zoomed in); wooden 'N boats' board when more", encodes: "pipelines (compositions) that use a model of this land", source: "world.harbours[].boats" },
  { mark: "boat sailing a foam-dotted course", encodes: "the selected pipeline's ferry route", source: "ferryRoute(world, composition.composes)" },
  { mark: "engine running a lineage line", encodes: "a model with a live running run", source: "useLiveTraining(runs) + pathToAtom" },
  { mark: "engine parked beside a station (only when no run is live)", encodes: "the model with the most logged runs (the busiest station)", source: "stationCounts(runs), useLiveTraining(runs) = []" },
  // regions
  { mark: "wooden region signboard", encodes: "family name + model count (count in 5×7 pixel digits, asserted against the node count)", source: "world.regions[].setPiece, world.nodes" },
  // focus & avatar
  { mark: "ink name-plate in screen space (gold = atom, cream = derived; constant 16/14px, priority-placed, culled)", encodes: "model name, atom vs derived", source: "placeScreenLabels(world, camera, viewport)" },
  { mark: "focused sprite one scale step larger on an ink-and-gold plinth, gold plate, gold corner brackets", encodes: "the focused model (loudest object)", source: "?focus= (URL)" },
  { mark: "whole map one ramp step darker (node view); other lands darker (region view)", encodes: "not the focus: steps back one value; kin and the region's land stay full value", source: "lineage(); art region mask" },
  { mark: "white-cored dotted quest route", encodes: "the critter's walk from the root atom", source: "pathToAtom(world, focus)" },
  { mark: "one-eyed blob critter (art/ 4-frame walk; parks at parkingSpot)", encodes: "the learner walking the lineage", source: "pathToAtom + parkingSpot" },
  { mark: "5×7 pixel digits", encodes: "every data numeral (counts, LV, runs, bars, champion version)", source: "pixel-num.tsx" },
  // status card (pages: Lesson · Anatomy · Lineage · Proof · Pipelines, ↑/↓)
  { mark: "portrait", encodes: "the model's exact map sprite on its land's ground colour", source: "nodeSprite() — same code as the map" },
  { mark: "LV n + 'n steps below its atom' / Class", encodes: "generation depth / family", source: "world.nodes[].depth, family" },
  { mark: "stat bars (12 cells)", encodes: "Built on it = descendants ÷ zoo max; Runs = logged runs ÷ zoo max", source: "lineage().descendants; evidence.run_count" },
  { mark: "Parents / Pipelines rows", encodes: "builds_on parents (named) / number of compositions using it", source: "cardModel.parents, compositions" },
  { mark: "gate meter (16 cells, gold tick at 80%, star when champion)", encodes: "best M-tier metric ÷ bar (direction-aware); hollow = no M-tier score yet", source: "evidence.best_metric, threshold_m, higher_is_better" },
  { mark: "Anatomy page / Proof curve / Pipelines list", encodes: "forward pass / main loss of the best run / compositions (select sails the boat)", source: "schematics, useLesson, taxonomy.compositions" },
];

// Easter eggs (shared logic in components/lab/shared/eggs, drawn here in 16-bit)
export const EGGS: Mark[] = [
  { mark: "grokking bubble: 'memorising…' → 'oh — I get it now' after a 4 s hover/focus + an illustrative curve (labelled)", encodes: "delayed generalisation (grokking)", source: "GROKKING_EGG, useLongFocus" },
  { mark: "hidden '?' island with three dark monoliths, a sea serpent and 'here be dragons', outside the overview (pan / zoom out)", encodes: "next-era models not yet in the zoo (VQ-VAE, flow matching, gated PixelCNN)", source: "world.hiddenIsland, NEXT_ERA" },
  { mark: "ruins islet: broken columns with epitaphs", encodes: "retired legacy/ projects and their living successors", source: "world.ruinsIsland, RUINS" },
  { mark: "critter clicked 7× → 'Training…' bubble drawing a real loss curve", encodes: "a real, clearly decreasing loss series from a logged run", source: "useCritterClicks(7), useRealLossCurve(runs)" },
  { mark: "↑↑↓↓←→←→BA: gold frames sweep the zoo generation by generation", encodes: "a forward pass across the zoo in depth order", source: "useKonami, forwardPassOrder(world), forwardPassSchedule" },
  { mark: "double_descent's boat course dips twice", encodes: "test error falls, rises at the interpolation threshold, falls again", source: "DOUBLE_DESCENT_EGG, dipDepth(t)" },
];
