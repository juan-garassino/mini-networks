// The Transit diagram (/?edition=metro, components/views/chart-metro.tsx):
// every visual mark → the datum it encodes. The on-screen key renders
// METRO_LEGEND, so the key cannot drift from the marks.

/** Line order = the periodic table's family order (also the key's order). */
export const LINE_ORDER = ["perception", "sequence", "generative", "representation", "structure", "decision"] as const;

/** One line per family. Pastel signage: told apart at a glance, never loud on the
 * neutral sheet; each still holds a white letter on its origin bullet. */
export const LINE_COLORS: Record<string, string> = {
  perception: "#e2826d",
  sequence: "#6b8fd0",
  generative: "#5fae86",
  representation: "#a28bd2",
  structure: "#d9a95a",
  decision: "#4fb0a9",
};

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
  "station order": "every path starts at an origin (or at a station nearer one), so riding away from an origin follows the way models build on each other; a station's exact parents are in its spec sheet",
  district: "where each family's stations sit: the painted maps' geography (Perception west, Representation north, Structure a north-east island, Sequence centre, Decision east, Generative south); the quiet area name is the family",
  "origin bullet": "an atom (elementary model), lettered with its element symbol, in its line's colour",
  "station tick": "a derived model served by one line; the tick points at its name",
  "terminus bar": "a station on one line where that line's path ends: nothing further on this line builds from here",
  "interchange ring": "a model served by two or more lines: it builds on models from more than one family",
  "label weight": "semibold = an atom or an interchange (where you change), regular = a station on one line",
  train: "one per line, riding the line's longest path outward from its origin; motion only, frozen under ?still=1 and prefers-reduced-motion",
  "through service": "a composition (pipeline): its name and the stations it calls at, each bullet in that station's line colour; hovering one lights those stations on the map",
  "line count": "in the key: how many stations the line calls at (its own models + the models built on them)",
} as const;

export type MetroMark = "origin" | "tick" | "terminus" | "interchange" | "train";

/** The on-screen key, in reading order. */
export const METRO_LEGEND: { mark: MetroMark; label: string }[] = [
  { mark: "origin", label: "Origin: an atom" },
  { mark: "tick", label: "Station on one line" },
  { mark: "terminus", label: "End of a branch" },
  { mark: "interchange", label: "Interchange: two or more lines" },
  { mark: "train", label: "Train, outbound from an origin" },
];
