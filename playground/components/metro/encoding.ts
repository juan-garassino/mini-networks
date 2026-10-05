// The Transit diagram (/?edition=metro, components/metro/metro-chart.tsx):
// every visual mark → the datum it encodes. The on-screen key renders
// METRO_LEGEND, so the key cannot drift from the marks.

/** Line order = the periodic table's family order (also the key's order). */
export const LINE_ORDER = ["perception", "sequence", "generative", "representation", "structure", "decision"] as const;

/** Line colours are tokens (tokens.ts LINE_COLORS): colour = family. */
export const LINE_NAMES: Record<string, string> = {
  perception: "Perception",
  sequence: "Sequence",
  generative: "Generative",
  representation: "Representation",
  structure: "Structure",
  decision: "Decision",
};

export const METRO_ENCODING = {
  map: "one connected system: the whole zoo is a single network diagram, not one strip per family",
  line: "a family's service (colour = family): it calls at every model of the family and at every model built on one of them",
  "track geometry": "0°, 45° and 90° only, on one 20-px grid, one corner radius; the drawing is authored like the periodic table's placement (components/metro/layout.ts STATIONS + ROUTES)",
  "dashed spur": "a station the drafting does not know yet, placed by the engine's fallback (system.ts placeAuto) on a straight spur off a station of its line: under construction until it is drafted",
  "station order": "every path starts at an origin (or at a station nearer one), so riding away from an origin follows the way models build on each other; a station's exact parents are in its spec sheet",
  geography: "where each family's stations sit: the painted maps' geography (Perception west, Representation north, Structure a north-east island, Sequence centre, Decision east, Generative south); no area names, the line colour carries the family",
  "origin bullet": "an atom (elementary model), lettered with its element symbol, in its line's colour",
  "station tick": "a derived model served by one line; the tick points at its name",
  "terminus bar": "a station on one line where that line's path ends: nothing further on this line builds from here",
  "interchange ring": "a model served by two or more lines: it builds on models from more than one family",
  "label weight": "semibold = an atom or an interchange (where you change), regular = a station on one line",
  train: "one per line, riding the line's longest path outward from its origin; motion only, frozen under ?still=1 and prefers-reduced-motion",
  "through service": "a composition (pipeline): its name and the stations it calls at, each bullet in that station's line colour; hovering one lights those stations on the map",
  "key: models": "in the key: the family's own models (the same count every design prints)",
  "key: stops": "in the key: how many stations the line calls at (its own models + every model built on one of them)",
} as const;

/** The key's two count columns, in order. */
export const KEY_COLUMNS = { models: "models", stops: "stops" } as const;

export type MetroMark = "origin" | "tick" | "terminus" | "interchange" | "train" | "spur";

/** The on-screen key, in reading order. */
export const METRO_LEGEND: { mark: MetroMark; label: string }[] = [
  { mark: "origin", label: "Origin: an atom" },
  { mark: "tick", label: "Station on one line" },
  { mark: "terminus", label: "End of a branch" },
  { mark: "interchange", label: "Interchange: two or more lines" },
  { mark: "train", label: "Train, outbound from an origin" },
  { mark: "spur", label: "Not drafted yet: placed automatically" },
];
