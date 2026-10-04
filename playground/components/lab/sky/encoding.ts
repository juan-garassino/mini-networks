// Sky skin — every visual mark → the datum it encodes.
export const ENCODING = {
  star: "one model at its lib/world position; glyph = evidence (8-ray gold champion with a white core · 4-ray trained · hollow dashed ring provisional · dim dot untrained)",
  "star size": "atoms are the bright named stars; derived stars are smaller",
  "star label": "the model's name — atoms always (italic, like an atlas's proper star names); derived on hover, selection, zoom, lineage or as a pipeline partner (pastel aqua)",
  "constellation line": "a lineage edge (builds_on): cream hairline inside a family (stronger for the primary parent), dashed and faint across families; gold on the selected lineage",
  "constellation figure": "the family, engraved THROUGH its actual stars (figures.ts): Oculus's pupil sits on the classifier atom, Serpens's body winds through every sequence star, Fornax's flame wraps the generative stars, Gemini's mirrors hold the representation stars on their rims, Crystallus's cell has its stars on opposite vertices, Sagitta's arrow points from the decision atoms toward their descendants",
  "constellation name": "the family: Latin name in capitals, its English gloss and star count in italic",
  "pipeline arc": "the selected star's pipelines: one dotted pastel-aqua arc to each partner star (hover: the pipelines' names)",
  "selection ring": "the selected star; other constellations dim",
  "neatline ticks": "the lib/world tile grid: a short tick every 4 tiles, a long one every 16",
  "graticule + ecliptic": "decoration only — the plate's engraved furniture, no data",
  "field stars": "decoration only — no data; ~1 in 9 scintillate, and a meteor crosses every 14 s (≤10 fps, frozen under still=1 / reduced motion)",
  // the corners (shared with the painted maps, night material)
  "cartouche sentence": "live counts: models, constellations, proven champions (or the focused family's)",
  "compass points": "pan direction; hub = whole sky",
  "scale bar tick": "one model in family order, filled by evidence (the magnitude scale)",
  "legend row": "the evidence vocabulary",
} as const;
