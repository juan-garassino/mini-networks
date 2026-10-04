// The two atlas designs — every visual mark → the datum it encodes.
// "plates" = the Atlas plates edition (/?edition=atlas, components/views/chart-atlas.tsx);
// "network" = the Network Atlas (/atlas/, components/atlas/*). The Network Atlas
// legend renders NETWORK_LEGEND below, so the key on screen cannot drift from the marks.

export const PLATES_ENCODING = {
  order: "the model's family (lib/blueprint placement), set as a Latin order with its English name and plate count",
  "plate number": "reading order through the atlas: orders in table order, atoms before derived models",
  "typus / hybrida": "level: typus = an atom (elementary model), hybrida = a derived model",
  figure: "the model's own icon (lib/icons), engraved in the edition's line ink",
  "hatched disc": "how many models build on this one (builds_on in-degree): no disc = none, wider disc = more descendants (width capped at seven)",
  "specimen name": "genus (the order) + species (the model name)",
  "label: intr.": "the mechanism(s) the model introduces (taxonomy introduces); +n = more than one",
  "label: ex": "the models it builds on (taxonomy builds_on); atoms read 'atom'",
  "label: desc.": "the descendant count the hatched disc draws",
  "symbiosis row": "one composition: its name, the member models joined by +, and how many species it combines",
} as const;

export const NETWORK_ENCODING = {
  "region field": "a family, drawn as a soft field around its actual members; colour = family",
  "region name": "the family's editorial name and three verbs",
  "filled dot": "one model; colour = family; atoms are larger than derived models",
  "black hub": "the transformer, the most built-on model, pinned at the centre",
  "outer ring": "a milestone: five or more models build on it",
  "satellite dot": "one mechanism the model introduces",
  "arrowed line": "builds on: the arrow points at the parent; dark when the parent is the transformer",
  "dotted line": "a pipeline (composition) chains these models; colour = the first member's family",
  "node label": "the model name; atoms in serif, derived models in small sans",
  "dashed ring": "the selected model; everything outside its neighbourhood dims",
  "counts line": "live totals: models, builds-on links, pipelines",
} as const;

export type LegendMark = "atom" | "derived" | "hub" | "milestone" | "concept" | "builds" | "builds-hub" | "pipeline";

/** The on-screen key of the Network Atlas, in reading order. */
export const NETWORK_LEGEND: { mark: LegendMark; label: string }[] = [
  { mark: "atom", label: "Atom" },
  { mark: "derived", label: "Derived model" },
  { mark: "milestone", label: "Five or more build on it" },
  { mark: "hub", label: "The transformer hub" },
  { mark: "concept", label: "A mechanism it introduces" },
  { mark: "builds", label: "Builds on (arrow to parent)" },
  { mark: "builds-hub", label: "Builds on the transformer" },
  { mark: "pipeline", label: "Chained in a pipeline" },
];
