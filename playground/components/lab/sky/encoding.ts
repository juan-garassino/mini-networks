// The Night Map (skin "sky") — every visual mark → the datum it encodes, in the
// library's one shape (lib/encoding.ts). Tokens: tokens.ts. Sprites: sprites.ts.
// Bake: bake.ts. Life: motion.ts. The star key (key.tsx) renders KEY below,
// whose rows name their marks, so it cannot drift.
import { defineEncoding, defineKey } from "../../../lib/encoding.ts";

export const ENCODING = defineEncoding({
  // the baked sky (1 sky px = 4 lib/world px, pixelated)
  nebula: { encodes: "one family: a Bayer-dithered cloud on the family's own hue-shifted 5-step ramp, grown from its stars (atoms denser) and its primary lineage edges; a model's star always lies inside its family's nebula (bake.test.ts). Dark lanes = where two families meet" },
  "nebula ghost": { encodes: "a region / node view: the other families' nebulae sink into the night ramp — only the focused family keeps its colour", kind: "interaction" },
  "milky way": { encodes: "decoration only: a dithered dust band in the margins, faded wherever a nebula is", kind: "decoration" },
  "field stars": { encodes: "decoration only: single pixels (a few crosses), denser in the Milky Way, never near a model star", kind: "decoration" },
  // the marks (art grid, 1 art px = 2 CSS px)
  "star sprite": { encodes: "one model at its lib/world position; shape = evidence: gold ray sparkle = champion, mint cut gem = trained, broken lilac ring = new with a provisional bar, dim grey point = not trained yet" },
  "star size": { encodes: "atom (large sprite: 11×11 sparkle / 7×7 gem / 9×9 ring / 5×5 point) vs derived (7 / 5 / 7 / 3)" },
  "asterism line": { encodes: "a builds_on edge, parent → child: 1-art-px line in the family's pastel, stopping short of both stars (a parent with a fan of children keeps a wider clear ring, +1 art px per 3 lines). Primary in-family edges keep full ink near both stars and sink two flat steps into their nebula's tone in the middle of a long run, so a busy parent's fan reads as spokes and the stars read first. A focused family adds its secondary + cross-family edges, dashed and quiet. The selected model's lineage is pastel gold, full ink end to end" },
  comet: { encodes: "lineage direction: a bright pixel with a 3-px tail runs each primary line from parent to child, in the child's evidence ramp (only the selected lineage runs, faster, when a model is selected)", kind: "motion" },
  glint: { encodes: "champion: now and then a champion's rays grow by two art px and its core whitens", kind: "motion" },
  "selection reticle": { encodes: "the selected model: a whole pastel-gold ring with four ticks at N/E/S/W (never the broken ring that means provisional); a dotted cream ring = hover", kind: "interaction" },
  "pipeline arc": { encodes: "the selected model's pipelines: one dotted pastel-aqua arc to each partner star on screen, never under a sign or a name (hover the partner: the pipelines' names)" },
  "edge chevron": { encodes: "a star off screen, named on a plate hugging the screen edge on the ray toward it: solid pastel aqua = a pipeline partner; dashed lineage ink = the far end of a drawn line that leaves the screen (a zoomed view); click selects it" },
  // the words
  "sign plaque": { encodes: "a family: emblem (Eye, Serpent, Furnace, Mirrors, Lattice, Arrow) + Family name + model count, bordered in the family's pastel, on its nebula's top-left (taken: the free spot nearest the family's stars that sits on none of another family's cloud, read off the bake); zoomed in, the Latin constellation name under it; click opens the family" },
  "sign leader": { encodes: "a sign that had to sit away from its stars (a packed phone sky): a dotted line in the family's pastel from the sign to its nearest star" },
  "star name": { encodes: "the model's name (Pixelify): every atom, the stars that start a lineage, is named at every zoom (the star key says so); derived on hover, selection, lineage, as a pipeline partner (aqua), in the focused family or when zoomed in" },
  meteor: { encodes: "decoration only: a pixel meteor every ~11 s", kind: "decoration" },
  motion: { encodes: "12-fps flip-book (twinkle, glint, comets, meteor); frame 0 only under ?still=1 and prefers-reduced-motion", kind: "motion" },
  // the corners (shared with the painted maps, night material)
  "day | night tabs": { encodes: "the two sides of the zoo: Day = the painted pixel map, Night = this sky", kind: "chrome" },
  "star key": { encodes: "the evidence vocabulary, each row drawn with the sky's own atom + derived sprites, and the naming rule; on a phone it folds behind a Key button", kind: "chrome" },
  "cartouche sentence": { encodes: "live counts: models, nebulae, proven champions (or the focused family's)", kind: "chrome" },
  "compass points": { encodes: "pan direction; hub = whole sky", kind: "chrome" },
  "scale bar tick": { encodes: "one model in family order, filled by evidence", kind: "chrome" },
});

/** The star key: one row per evidence state, each drawn with the sky's real
 * atom + derived sprites, then the closing lines on size, names, nebulae and lines. */
export const KEY = defineKey(ENCODING, {
  title: "Star key",
  rows: [
    { mark: "star sprite", sample: "champion", label: "champion, passed the gate" },
    { mark: "star sprite", sample: "trained", label: "trained, no champion yet" },
    { mark: "star sprite", sample: "provisional", label: "new, bar still provisional" },
    { mark: "star sprite", sample: "untrained", label: "not trained yet" },
  ],
  notes: [
    "Large, named stars are atoms: each starts a lineage. Small stars are models built on them; point at one for its name.",
    "Each nebula is a family. A line runs from a parent star to a model built on it; comets run along it, parent to child.",
  ],
});
