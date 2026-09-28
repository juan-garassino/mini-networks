// Every visual mark of the pixel skin → the data it encodes → where the data
// comes from. Anything drawn that is not in this table must be cut.
//
// Biomes (one family = one land; all tones from Sweetie-16, see palette.ts):
//   perception     green meadow  base #38b764 · light #a7f070 · shade #257179 · decor round tree
//   sequence       sand dunes    base #ffcd75 · light #f4f4f4 · shade #ef7d57 · decor cactus
//   generative     autumn woods  base #ef7d57 · light #ffcd75 · shade #b13e53 · decor red tree
//   representation snowfield     base #f4f4f4 · light #73eff7 · shade #94b0c2 · decor snowy pine
//   decision       violet moor   base #5d275d · light #b13e53 · shade #333c57 · decor mushroom
//   structure      slate islet   base #566c86 · light #94b0c2 · shade #333c57 · decor crystal
//   (unknown future family → open plain #a7f070)
export interface Mark { mark: string; encodes: string; source: string }

export const ENCODING: Mark[] = [
  // terrain
  { mark: "land biome (ground colour + texture tile)", encodes: "family of the region", source: "world.regionOf / world.regions[].family" },
  { mark: "land area", encodes: "model count of the family (area ∝ models)", source: "world.regions[].tiles" },
  { mark: "sea, shoreline, foam, shallow band", encodes: "where land ends (sea tiles)", source: "world.terrain = SEA" },
  { mark: "deep-water dither band", encodes: "distance from the nearest coast", source: "world.terrain (distance field)" },
  { mark: "rounded coast corners / fillets (autotile)", encodes: "coast shape from 2-neighbour tile masks", source: "world.terrain neighbours" },
  { mark: "cliff face under south shores", encodes: "land above sea (tile below land is SEA)", source: "world.terrain neighbours" },
  { mark: "river (1-tile water band)", encodes: "border between two families", source: "world.terrain = RIVER" },
  { mark: "water glints (2 frames, frozen under still=1)", encodes: "water tiles (sea/river)", source: "world.terrain" },
  // lineage
  { mark: "cobblestone road (ink outline, bevelled, slate setts)", encodes: "builds_on edge to the model's primary parent", source: "world.roads[] (primary=true) tiles → 8-bit join mask" },
  { mark: "stepping-stone dots", encodes: "builds_on edge to a secondary parent", source: "world.roads[] (primary=false)" },
  { mark: "wooden plank bridge", encodes: "cross-family builds_on edge crossing a river", source: "world.bridges[] (tiles, axis)" },
  // nodes
  { mark: "castle (32px art ×2 on its 4×4 footprint) + ground shadow in its land's shade", encodes: "atom (elementary model, generation 0)", source: "world.nodes[].atom, foot" },
  { mark: "level dot (on its 2×2 footprint)", encodes: "derived model", source: "world.nodes[].atom = false, foot" },
  { mark: "red banner with a 5×5 gold glyph on each castle keep", encodes: "the mechanism the atom introduces (16 atoms, 16 distinct glyphs)", source: "taxonomy.models[].introduces[0] → sprites.MECH_GLYPHS" },
  { mark: "gold dot vs grey dot", encodes: "derived model has a champion or ≥1 logged run vs neither", source: "evidence.champion || evidence.run_count > 0" },
  { mark: "grey castle", encodes: "atom with no champion and no runs (none today; kept so a new atom shows it)", source: "evidence (cardModel state)" },
  { mark: "gold star overlapping the dot's upper-right rim / on the castle's right spire", encodes: "champion checkpoint (passed the gate)", source: "evidenceState() = champion" },
  { mark: "'?' signpost (blinks off every other water frame; static under still)", encodes: "quality bar is provisional", source: "evidenceState() = provisional" },
  // regions
  { mark: "bevelled stone plaza + monument glyph", encodes: "the family's set-piece (eye=perception, beads=sequence, sprout=generative, mirror=representation, fork=decision, linked nodes=structure)", source: "world.regions[].setPiece" },
  { mark: "orange signboard (never over the monument)", encodes: "family name + model count (count ≥16px bold, asserted against the node count at runtime)", source: "world.regions[].family, world.nodes" },
  { mark: "gold-rimmed name chip (far zoom only)", encodes: "atom name at its castle; lower-lineage atoms culled when chips would overlap", source: "world.nodes[].atom, center; roads out-degree for priority" },
  { mark: "decor sprite (tree/cactus/pine/mushroom/crystal; mirrored by variant)", encodes: "the biome of that land", source: "world.decor[].region, variant" },
  // focus & avatar
  { mark: "outlined name label (gold 15px = atom, white 13px = derived)", encodes: "model name, atom vs derived", source: "world.labels[] (box, font)" },
  { mark: "cyan name plate + four gold corner brackets (×2 or more)", encodes: "the focused model", source: "?focus= (URL)" },
  { mark: "50% ink dither over other lands", encodes: "the region being viewed (region zoom, framed on its nodes at ≥×2)", source: "?zoom=region&focus= → world.regions, world.nodes" },
  { mark: "gold footprint trail (ink-rimmed 4px dots every 14 world px)", encodes: "the focused model's lineage route back to its root atom, revealed as the critter walks", source: "pathToAtom(world, focus).points" },
  { mark: "one-eyed blob critter (4-frame walk)", encodes: "the learner walking the lineage from the root atom to the focused model", source: "pathToAtom(world, focus) + samplePolyline" },
  { mark: "5×7 pixel digits (inline SVG, real text kept for screen readers)", encodes: "every data numeral: sign counts, LV, runs, bar/best metric, champion version", source: "same fields as the text they replace (pixel-num.tsx)" },
  // status card
  { mark: "LV n", encodes: "generation depth (atoms LV 0)", source: "world.nodes[].depth" },
  { mark: "Class", encodes: "family", source: "world.nodes[].family" },
  { mark: "Equipped", encodes: "champion version (v-number) or none", source: "evidence.champion_version" },
  { mark: "gate meter (16 cells, gold tick at 80%)", encodes: "best M-tier metric ÷ bar, inverted for lower-is-better; green passes, orange below; hollow cells = no M-tier score yet (local runs are S-tier smokes)", source: "evidence.best_metric, threshold_m, higher_is_better; cardModel.passesBar" },
  { mark: "gold star above the meter tick", encodes: "champion cleared this bar in the cloud sweep", source: "evidenceState() = champion" },
  { mark: "Skills learned", encodes: "mechanisms the model introduces", source: "taxonomy.introduces + mechanisms" },
  { mark: "Party rows (icon + name)", encodes: "parents (builds on) and children (leads to), clickable", source: "cardModel.parents / children" },
  { mark: "Appears in", encodes: "compositions that use the model", source: "cardModel.compositions" },
  { mark: "portrait (on its land's ground colour)", encodes: "the model's exact map sprite: castle + banner or dot, with its evidence marker", source: "composeNode(atom, look) — same code as the map" },
];
