// The Transit diagram (/?edition=metro, components/metro/metro-chart.tsx):
// every visual mark → the datum it encodes, in the library's one shape
// (lib/encoding.ts). The on-screen key renders KEY, whose rows name their
// marks, so the key cannot drift from the marks.
import { defineEncoding, defineKey } from "../../lib/encoding.ts";

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

export const ENCODING = defineEncoding({
  map: { encodes: "one connected system: the whole zoo is a single network diagram, not one strip per family" },
  line: { encodes: "a family's service (colour = family): it calls at every model of the family and at every model built on one of them" },
  "track geometry": { encodes: "0°, 45° and 90° only, on one 20-px grid, one corner radius; the drawing is authored like the periodic table's placement (components/metro/layout.ts STATIONS + ROUTES)" },
  "dashed spur": { encodes: "a station the drafting does not know yet, placed by the engine's fallback (system.ts placeAuto) on a straight spur off a station of its line: under construction until it is drafted" },
  "station order": { encodes: "every path starts at an origin (or at a station nearer one), so riding away from an origin follows the way models build on each other; a station's exact parents are in its spec sheet" },
  geography: { encodes: "where each family's stations sit: the painted maps' geography (Perception west, Representation north, Structure a north-east island, Sequence centre, Decision east, Generative south); no area names, the line colour carries the family" },
  "origin bullet": { encodes: "an atom (elementary model), lettered with its element symbol, in its line's colour" },
  "station tick": { encodes: "a derived model served by one line; the tick points at its name" },
  "terminus bar": { encodes: "a station on one line where that line's path ends: nothing further on this line builds from here" },
  "interchange ring": { encodes: "a model served by two or more lines: it builds on models from more than one family" },
  "label weight": { encodes: "semibold = an atom or an interchange (where you change), regular = a station on one line" },
  train: { encodes: "one per line, riding the line's longest path outward from its origin; motion only, frozen under ?still=1 and prefers-reduced-motion", kind: "motion" },
  "through service": { encodes: "a composition (pipeline): its name and the stations it calls at, each bullet in that station's line colour; hovering one lights those stations on the map" },
  "key: models": { encodes: "in the key: the family's own models (the same count every design prints)", kind: "chrome" },
  "key: stops": { encodes: "in the key: how many stations the line calls at (its own models + every model built on one of them)", kind: "chrome" },
});

/** The key's two count columns, in order. */
export const KEY_COLUMNS = { models: "models", stops: "stops" } as const;

export type MetroMark = "origin" | "tick" | "terminus" | "interchange" | "train" | "spur";

/** The on-screen key, in reading order: each row draws `sample` with the map's own glyph. */
export const KEY = defineKey(ENCODING, {
  rows: [
    { mark: "origin bullet", sample: "origin", label: "Origin: an atom" },
    { mark: "station tick", sample: "tick", label: "Station on one line" },
    { mark: "terminus bar", sample: "terminus", label: "End of a branch" },
    { mark: "interchange ring", sample: "interchange", label: "Interchange: two or more lines" },
    { mark: "train", sample: "train", label: "Train, outbound from an origin" },
    { mark: "dashed spur", sample: "spur", label: "Not drafted yet: placed automatically" },
  ],
});
