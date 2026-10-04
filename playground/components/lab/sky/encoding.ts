// The Night Map (skin "sky") — every visual mark → the datum it encodes.
// Colours: palette.ts. Sprites: sprites.ts. Bake: bake.ts. Life: motion.ts.
export const ENCODING = {
  // the baked sky (1 sky px = 4 lib/world px, pixelated)
  nebula: "one family: a Bayer-dithered cloud on the family's own hue-shifted 5-step ramp, grown from its stars (atoms denser) and its primary lineage edges; a model's star always lies inside its family's nebula (bake.test.ts). Dark lanes = where two families meet",
  "nebula ghost": "a region / node view: the other families' nebulae sink into the night ramp — only the focused family keeps its colour",
  "milky way": "decoration only: a dithered dust band in the margins, faded wherever a nebula is",
  "field stars": "decoration only: single pixels (a few crosses), denser in the Milky Way, never near a model star",
  // the marks (art grid, 1 art px = 2 CSS px)
  "star sprite": "one model at its lib/world position; shape = evidence: gold ray sparkle = champion, mint cut gem = trained, broken lilac ring = new with a provisional bar, dim grey point = not trained yet",
  "star size": "atom (large sprite: 11×11 sparkle / 7×7 gem / 9×9 ring / 5×5 point) vs derived (7 / 5 / 7 / 3)",
  "asterism line": "a builds_on edge, parent → child: 1-art-px line in the family's pastel, stopping short of both stars. Overview: primary in-family edges only. A focused family adds its secondary + cross-family edges, dashed and quiet. The selected model's lineage is pastel gold",
  comet: "lineage direction: a bright pixel with a 3-px tail runs each primary line from parent to child, in the child's evidence ramp (only the selected lineage runs, faster, when a model is selected)",
  glint: "champion: now and then a champion's rays grow by two art px and its core whitens",
  "selection ring": "the selected model (broken pastel-gold ring); a dotted cream ring = hover",
  "pipeline arc": "the selected model's pipelines: one dotted pastel-aqua arc to each partner star on screen (hover the partner: the pipelines' names)",
  "edge chevron": "a pipeline partner off screen: a pastel-aqua named plate on the edge, toward it; click selects it",
  // the words
  "sign plaque": "a family: emblem (Eye, Serpent, Furnace, Mirrors, Lattice, Arrow) + FAMILY + model count, bordered in the family's pastel, on its nebula's top-left (taken: the nearest free spot whose closest star is the family's own); zoomed in, the Latin constellation name under it; click opens the family",
  "star name": "the model's name (Pixelify): atoms always; derived on hover, selection, lineage, as a pipeline partner (aqua), in the focused family or when zoomed in",
  meteor: "decoration only: a pixel meteor every ~11 s",
  motion: "12-fps flip-book (twinkle, glint, comets, meteor); frame 0 only under ?still=1 and prefers-reduced-motion",
  // the corners (shared with the painted maps, night material)
  "day | night tabs": "the two sides of the zoo: Day = the painted pixel map, Night = this sky",
  "cartouche sentence": "live counts: models, nebulae, proven champions (or the focused family's)",
  "compass points": "pan direction; hub = whole sky",
  "scale bar tick": "one model in family order, filled by evidence",
  "legend row": "the evidence vocabulary, drawn with the sky's own atom + derived sprites",
} as const;
