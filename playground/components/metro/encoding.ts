// The Transit diagram (/?edition=metro, components/views/chart-metro.tsx):
// every visual mark → the datum it encodes. The on-screen key renders
// METRO_LEGEND, so the key cannot drift from the marks.

/** One line per family. Softened signage colours: distinct at a glance, never
 * loud against the warm off-white sheet. */
export const LINE_COLORS: Record<string, string> = {
  perception: "#d4563f",
  sequence: "#3f6fc0",
  generative: "#3d9064",
  representation: "#8662b8",
  structure: "#cf8a33",
  decision: "#2b9590",
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
  line: "a family (lib/blueprint placement); colour = family; one strip map per line",
  track: "builds on, inside one family: a track runs from the parent to the child (transitive links are dropped, so convnext hangs off resnet, not classifier)",
  "track geometry": "45° and 90° only; generations read left to right, one column per generation, one row per branch",
  "origin bullet": "an atom (elementary model), lettered with its element symbol",
  "station tick": "a derived model with a single parent",
  "end bar": "a station where its branch ends: nothing in this family builds on it yet",
  "interchange ring": "a model that builds on two or more parents",
  "change-for bullet": "a parent on another line, lettered with its symbol and painted in that line's colour",
  "line header": "the family name, its station count and its interchange count",
  "through service": "a composition: the pipeline name and the stations it calls at, each in its own line's colour",
} as const;

export type MetroMark = "origin" | "tick" | "end" | "interchange" | "change";

/** The on-screen key, in reading order. */
export const METRO_LEGEND: { mark: MetroMark; label: string }[] = [
  { mark: "origin", label: "Origin: an atom" },
  { mark: "tick", label: "Station: one parent" },
  { mark: "end", label: "End of branch" },
  { mark: "interchange", label: "Interchange: two or more parents" },
  { mark: "change", label: "Change for a parent on another line" },
];
