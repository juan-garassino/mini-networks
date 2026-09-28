// Every visual mark of the hybrid skin (round 2, layout v2) and the data it
// encodes. A mark not in this table must not be drawn. Eggs are declared in
// their own section (see components/lab/shared/eggs/README.md).
export interface Encoding { mark: string; encodes: string; source: string }

export const ENCODING: Encoding[] = [
  // ── the paper diorama (paper art library: one top-left key light) ──────
  { mark: "island printed in its family's ground (grass stripes, dunes, heath, frost, quartz, savanna)", encodes: "a family; area grows with its model count", source: "world.regions + regionOf → regionOutlines(); GROUND[family]" },
  { mark: "die-cut rim, card thickness, cast shadow, fibre grain", encodes: "paper material only; no data", source: "render order" },
  { mark: "foam band at the coast, scalloped sea", encodes: "open sea (no model)", source: "world.terrain == SEA" },
  { mark: "sea gap between islands", encodes: "the border between two families", source: "world.terrain == RIVER (left uncut)" },
  { mark: "stand-up rock peaks (snow on the tallest)", encodes: "a family border that no builds-on road crosses", source: "world.mountains" },
  { mark: "biome dressing: broadleaf trees, palms, boulders, pines, crystals, grass + flowers", encodes: "the family / biome of that free cell (only when zoomed in enough to read)", source: "world.decor[].region, scale" },
  { mark: "fat gold cobble road", encodes: "builds-on edge from the child's primary parent", source: "world.roads[].primary, lanePoints" },
  { mark: "thin gold road", encodes: "builds-on edge from a secondary parent", source: "world.roads[] (!primary)" },
  { mark: "faint thin long road", encodes: "a cross-family builds-on edge, raised to full weight when an endpoint is focused", source: "world.roads[].kind == bridge" },
  { mark: "brown chevrons along a road", encodes: "direction: parent → child", source: "world.roads[].chevrons" },
  { mark: "plank bridge", encodes: "where a cross-family road crosses a border", source: "world.bridges" },
  { mark: "glossy octagon sticker", encodes: "atom (elementary model), the city at its family's root", source: "world.nodes[].atom" },
  { mark: "glossy round sticker", encodes: "derived model (a town)", source: "world.nodes[] (!atom)" },
  { mark: "white species emblem on the sticker face", encodes: "which model (one glyph per species)", source: "iconFor(name) (lib/icons.tsx)" },
  { mark: "sticker face in the family's printing colour, gold rim", encodes: "trained (has at least one run)", source: "evidenceState() trained | champion" },
  { mark: "cream face, pencil emblem, cream rim", encodes: "not trained yet", source: "evidenceState() == untrained" },
  { mark: "dashed pencil ring on the face", encodes: "provisional: its quality bar is not settled", source: "evidenceState() == provisional" },
  { mark: "gold star seal", encodes: "champion: passed the M-tier gate", source: "evidenceState() == champion" },
  { mark: "town dot (whole-map zoom)", encodes: "a derived model too small to carry an emblem yet (semantic zoom)", source: "spotScale()" },
  { mark: "stand-up houses around an atom", encodes: "city size: one house per model built on it; capitals (hubs) get crenellated towers", source: "world.cities" },
  { mark: "station notches under a sticker", encodes: "recorded runs of that model (max 6 shown)", source: "stationCounts(runs)" },
  { mark: "harbour pier + up to 3 steamers + count badge", encodes: "compositions touching the family (badge = how many)", source: "world.harbours[].boats" },
  { mark: "gold steamer + dashed course", encodes: "the selected pipeline sailing its ferry route (one-model pipelines round-trip from their harbour)", source: "ferryRoute(world, composes)" },
  { mark: "train of three cars on a road", encodes: "a model with a live running run, riding its lineage line", source: "useLiveTraining(runs) + pathToAtom" },
  { mark: "red dashed halo + larger lifted sticker", encodes: "the focused model", source: "view.focus" },
  { mark: "value step-back (darkened)", encodes: "outside the focus: other families (region) / outside the family tree (model)", source: "lineage(world, focus), family" },
  { mark: "roads lifted above the step-back", encodes: "every parent road, child road and the walk home of the focus", source: "lineage(world, focus) + pathToAtom" },
  { mark: "red dotted quest route", encodes: "the critter's walk from the root atom to the focus", source: "pathToAtom reversed → parkingSpot" },
  { mark: "paper critter", encodes: "you; parks beside the focus, never on it", source: "parkingSpot(world, focus)" },
  { mark: "region sign plate (whole-map zoom)", encodes: "family name + model count, pinned to its set-piece, slid off any model it would cover", source: "world.regions[].setPiece" },
  { mark: "paper name tag (Fredoka, constant size)", encodes: "model name; placed by priority (focus > atoms > hubs), culled on collision, never under a window or at the edge", source: "placeScreenLabels()" },
  { mark: "dimmed name tag", encodes: "a model outside the focus", source: "as the value step-back" },
  // ── the pixel chrome ───────────────────────────────────────────────────
  { mark: "contemporary pixel panel (indigo ramp, warm-lit rim, cool shade) printed on die-cut card", encodes: "something to read (one at a time); no data", source: "—" },
  { mark: "slim title plate + breadcrumb", encodes: "zoo size and where you are (family, model)", source: "world.nodes, world.regions, view" },
  { mark: "pixel hand", encodes: "what Enter opens (menu row / focused model), outside its halo", source: "menu cursor, view.focus" },
  { mark: "pixel emblem (rasterised species glyph)", encodes: "which model, in the chrome's medium", source: "iconFor(name) → 20×20 grid" },
  { mark: "pixel-bordered swatch", encodes: "family (the island's own cardstock)", source: "FAMILY[family].face" },
  { mark: "gold menu name / gold portrait", encodes: "atom / the focused model", source: "world.nodes[].atom" },
  { mark: "pixel gold star", encodes: "champion (same as the map seal)", source: "evidenceState()" },
  { mark: "3×5 bitmap digits", encodes: "every number in the chrome", source: "the field each prints" },
  { mark: "LV", encodes: "generation = depth + 1", source: "world.nodes[].depth" },
  { mark: "animated anatomy", encodes: "the model's forward pass, stage by stage", source: "schematicFor(name) (lib/schematics)" },
  { mark: "family line (builds on › emblem › leads to)", encodes: "parents / children, travel targets", source: "cardModel().parents / children" },
  { mark: "gate meter fill / gold tick", encodes: "progress toward the M-tier bar / champion passed it", source: "evidence.best_metric, threshold_m" },
  { mark: "sparkline", encodes: "a real run's main loss curve (run id shown)", source: "useLesson().curve" },
  { mark: "pipeline rows", encodes: "compositions it appears in; selecting one sails its boat", source: "taxonomy.compositions" },
];

export const EGGS: Encoding[] = [
  { mark: "grokking bubble: 'memorising…' → 'oh — I get it now'", encodes: "delayed generalisation; clicks only after a 4 s hover or keyboard focus on grokking (curve labelled as an illustration)", source: "useLongFocus + GROKKING_EGG" },
  { mark: "the ? island + 'here be dragons' serpent", encodes: "next-era models not yet in the zoo; found by panning or zooming out past the sea's edge", source: "world.hiddenIsland + NEXT_ERA" },
  { mark: "ruined columns on the far islet", encodes: "retired legacy/ models, with epitaph and living successor", source: "world.ruinsIsland + RUINS" },
  { mark: "critter turns gold + bubble with a drawing loss curve", encodes: "after 7 clicks (or Enter) on the critter it trains on a REAL decreasing loss series; run id shown", source: "useRealLossCurve(runs)" },
  { mark: "double_descent boat dips twice", encodes: "test error falls, rises at the interpolation threshold, falls again", source: "DOUBLE_DESCENT_EGG + dipDepth(t)" },
  { mark: "Konami: gold rings ripple generation by generation", encodes: "a forward pass across the whole zoo in depth order (↑↑↓↓←→←→ B A)", source: "useKonami + forwardPassOrder/Schedule" },
];
