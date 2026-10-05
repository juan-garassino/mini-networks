// The periodic table — every visual mark → the datum it encodes. Identical in
// every skin: a skin may restyle a mark, never re-mean it. The on-screen key
// (chart-key.tsx) renders KEY_PARTS + KEY_LEVELS, so it cannot drift.

export const TABLE_ENCODING = {
  "column block": "family (lib/blueprint FAMILY_BLOCKS); tinted only in skins with family colours",
  row: "generation: row 1 = the 16 atoms, each lower row builds on the rows above",
  "tile border": "level: atom = heavy solid, derived compound = light solid, reaction = dashed",
  "tile fill": "level again, as tint strength (atom full, compound a lighter pull)",
  "top-left number": "atomic number: atoms 1-16, compounds 17.. in reading order, reactions ✻n",
  "top-right glyph": "the mechanism icon of the model (lib/icons)",
  symbol: "the chart symbol, unique across models AND reactions (lib/blueprint symbolFor / reactionSymbols; rule in DESIGN.md); compounds print dimmer in single-ink skins",
  "bottom name": "the model or composition name as words (underscore drawn as a space), in the skin's name face, wrapping between words, never cut off",
  "family head": "the family's name (a skin may prefix its numeral, I-VI, in FAMILY_BLOCKS order)",
  "f-block": "compositions (reactions): whole models wired into one pipeline",
  "masthead counts": "live totals from /web/taxonomy: models, atoms, reactions",
  "accent colour": "interaction only — hover, focus, the selected spec sheet",
} as const;

export type TileLevel = "atom" | "compound" | "reaction";

/** The key's annotated sample tile, top to bottom. */
export const KEY_PARTS = ["number and mechanism glyph", "symbol", "model name"] as const;

/** The key's three kinds of tile, in reading order. */
export const KEY_LEVELS: { level: TileLevel; label: string }[] = [
  { level: "atom", label: "Atom: introduces one mechanism" },
  { level: "compound", label: "Compound: built from atoms" },
  { level: "reaction", label: "Reaction ✻: whole models in one pipeline" },
];

export const KEY_ROWS_NOTE = "Rows read as generations: each builds on the rows above it.";
