// Painted skin — every visual mark → the datum it encodes. A mark not in this
// table does not belong on the screen. (Biome dressing is the owner's
// painting; the live layer only adds what is listed here.)
export const ENCODING = {
  // on the map
  "land sign": "family name + number of models in that land (count badge)",
  "atom banner": "a root model (no parents); flag colour = evidence state",
  "road stone": "a derived model on the painted roads; stone colour = evidence state",
  "model ribbon": "the model's name; loud (inked) when selected, lit when hovered",
  "paper plate": "paper map: the model's name over the painter's plate, one type size for all (long names break to two lines); 'no model yet' where the painter invented one",
  "lit road": "the selected model's lineage back to its root atom",
  "focus fade": "lands other than the focused one fade (dithered band = distance from it)",
  critter: "walks the lineage road from the root to the selected model",
  "road cart": "one builds_on edge, travelling parent → child in the child's evidence colour; the selected lineage's carts run lit and without gaps",
  // life (the painting breathing — no data beyond the carts; every pixel keeps to its own ramp)
  "water glint": "decoration: waves cross the blue water, foam blinks",
  "lava pulse": "decoration: the flow brightens in waves; embers + smoke rise from the three vents",
  "window flicker": "decoration: lit windows and lanterns flicker",
  "leaf rustle": "decoration: gusts lift highlights across the trees",
  "lighthouse beam": "decoration: a ray sweeps round each lamp",
  waterfall: "decoration: the painted falls pour (landmark boxes)",
  "flag flutter": "decoration: small red flags on poles and towers ripple",
  gull: "decoration: a few birds cross the parchment sea",
  splash: "decoration: now and then a fish breaks the water",
  // openness (three levels): whole map = land signs only (hover names a model);
  // in a land = that land's names; a model = its card + named lineage
  // the four corners
  "cartouche sentence": "live counts: models, lands, proven champions (or the focused land's)",
  "sheet tab": "which owner map is open (pixel / paper)",
  "compass points": "pan direction; hub = whole map (filled gold when at the whole map)",
  "scale bar cell": "one model, in land order (atoms first); fill = evidence state (hatched = provisional); one framed segment = one land",
  "pipeline tick": "one composition (pipeline): a graduation hanging under the scale bar's baseline",
  "scale bar title": "the zoo's counts: models and proven champions (sign voice), pipelines (right)",
  "legend title": "'Map key': the corner plates' one title treatment (sign voice, border ink)",
  "search magnifier": "focus mode: the find-a-model field, folded; pressing it (or '/') unfolds the field in place",
  "legend row": "the evidence vocabulary (banner + stone per state; 'not trained yet' is the grey stone alone — an untrained atom flies no banner)",
  "minimap frame": "the camera box on the whole map (shown only when zoomed in)",
  // corner system (corners/plate.tsx): one outer margin, one plate padding, one
  // side-column width (cartouche, legend / minimap); the compass stands on the
  // scale bar, and scale bar + legend share the bottom edge. While the map
  // plate is up and no hole between them fits it, the scale bar folds away,
  // then the minimap (the chrome yields; the plate never clips).
  // Focus mode (a land or a model open, or zoomed in): the cartouche is one row
  // (title, Whole map, magnifier), the scale bar a slim strip of 4-px cells (no
  // ticks, no title), the minimap a 176-px inset, the compass two thirds size,
  // the tabs compact — they re-stamp in place (two frames) on the change;
  // phones with a model open drop "map only" and the cartouche's Whole map
  // (the sheet has its own). No mark changes meaning, only size.
  "land sign clearance": "a land sign that would sit under the corner furniture steps to the nearest clear spot",
  // the map plate (desktop): "How <model> works", hung beside the selected castle
  "map plate": "the selected model's full mechanism diagram at 1 art px = 1 CSS px (×1.5 / ×2 only when that is whole device px and the plate keeps to half the visible width, 60 % of its height), in a compact frame (8-px padding, 22-px buttons), on a plate of the map's own material; follows the castle in map space, never scales; caption = how real the drawing is (the diagram's badge)",
  "leader line": "ties the plate to its castle: 2 art px of maroon ink in a 1-art-px cream halo, straight to the plate's nearest edge, a dot at the model's spot and a stepped notch where it docks into the plate; no name ever sits under it or the plate (they move, or hide); it runs longer only to carry the plate past a name it may not cover",
  "healed patch": "paper: a painter's plate half under a plate is painted out with a feathered clone of the painting beside it (no blank sign)",
  // the drawer
  "drawer glyph": "the selected model's evidence state, as its own map sprite",
  "drawer place line": "the model's land, and atom or its generation (depth)",
  "evidence stamp": "the evidence state in the colours the map paints it (dashed = provisional), + the champion's registry version",
  "introduces box": "a mechanism the model adds to the zoo (gold square = the taxonomy's 'introduces')",
  "card road": "the Lineage section, as the map draws it: 'Built on' signposts, a dashed road, the model itself (inked, 'you are here'), a dashed road, leads-to signposts; an atom has no road in; a dashed empty sign = nobody builds on it yet",
  "count badge": "how many pipelines (the land signs' badge, beside the section header)",
  "section header": "one of the card's three sections (Lineage, Pipelines, Quality gate; + How it works on phones): sign voice, ruled out to the edge",
  "more fade": "the card scrolls: the ground fades over its foot while more lies below the fold",
  "gate rows": "the EvidenceSpec gate: metric + direction, the M bar (provisional flag), the best so far when reported, runs logged",
  "mechanism diagram": "how the model works, drawn from the real champion's outputs (on a framed mat cut from the diagram's own ground); on the painted maps' desktop it is the map plate, and the drawer keeps only the text in a narrower 336-px sheet (+ 'Show how it works' when the plate is closed)",
  "signpost chip": "a parent (built on) or child (leads to) model, with its evidence glyph; press to travel there",
  "metric line": "best gate metric vs the M bar (drawn bar, only when a best metric is reported)",
  "pipeline row": "a composition the model is in; its parts, the model itself inked, the others pressable",
} as const;
