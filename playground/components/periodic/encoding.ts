// The periodic table — every visual mark → the datum it encodes, in the
// library's one shape (lib/encoding.ts). Identical in every skin: a skin may
// restyle a mark, never re-mean it. The on-screen key (chart-key.tsx) renders
// KEY_PARTS + KEY_LEVELS, whose rows name their marks, so it cannot drift.
import { defineEncoding, defineKey } from "../../lib/encoding.ts";

export const ENCODING = defineEncoding({
  "column block": { encodes: "family (lib/blueprint FAMILY_BLOCKS); tinted only in skins with family colours" },
  row: { encodes: "generation: row 1 = the 16 atoms, each lower row builds on the rows above" },
  "tile border": { encodes: "level: atom = heavy solid, derived compound = light solid, reaction = dashed" },
  "tile fill": { encodes: "level again, as tint strength (atom full, compound a lighter pull)" },
  "top-left number": { encodes: "atomic number: atoms 1-16, compounds 17.. in reading order, reactions ✻n" },
  "top-right glyph": { encodes: "the mechanism icon of the model (lib/icons)" },
  symbol: { encodes: "the chart symbol, unique across models AND reactions (lib/blueprint symbolFor / reactionSymbols; rule in DESIGN.md); compounds print dimmer in single-ink skins" },
  "bottom name": { encodes: "the model or composition name as words (lib/copy displayName), in the skin's name face, wrapping between words, never cut off" },
  "family head": { encodes: "the family's name (never numbered: the families are not a sequence)" },
  "f-block": { encodes: "compositions (reactions): whole models wired into one pipeline" },
  "sheet tabs": { encodes: "which sheet is open (Chart, Reactions, Observatory): the open one is inked", kind: "interaction" },
  "api status": { encodes: "drawn only while the zoo's API is offline", kind: "chrome" },
  "loading line": { encodes: "the load phase (lib/lab-contract loadPhase), in the skin's voice (voice.loading / voice.offline)", kind: "chrome" },
  "masthead counts": { encodes: "live totals from /web/taxonomy (lib/copy zooCounts): models, atoms, reactions", kind: "chrome" },
  "accent colour": { encodes: "interaction only — hover, focus, the selected spec sheet", kind: "interaction" },
});

export type TileLevel = "atom" | "compound" | "reaction";

/** The key's annotated sample tile, top to bottom. */
export const KEY_PARTS = defineKey(ENCODING, {
  rows: [
    { mark: "top-left number", sample: "corner", label: "number and mechanism glyph" },
    { mark: "symbol", sample: "symbol", label: "symbol" },
    { mark: "bottom name", sample: "name", label: "model name" },
  ],
});

/** The key's three kinds of tile, in reading order, and how to read the rows. */
export const KEY_LEVELS = defineKey(ENCODING, {
  rows: [
    { mark: "tile border", sample: "atom", label: "Atom: introduces one mechanism" },
    { mark: "tile border", sample: "compound", label: "Compound: built from atoms" },
    { mark: "tile border", sample: "reaction", label: "Reaction ✻: whole models in one pipeline" },
  ],
  notes: ["Rows read as generations: each builds on the rows above it."],
});
