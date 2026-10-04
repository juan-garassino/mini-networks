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
  "legend row": "the evidence vocabulary (banner + stone per state)",
  "minimap frame": "the camera box on the whole map (shown only when zoomed in)",
  // the map plate (desktop): "How <model> works", hung beside the selected castle
  "map plate": "the selected model's full mechanism diagram at 1 art px = 1 CSS px (×2 with room), on a plate of the map's own material; follows the castle in map space, never scales; caption = how real the drawing is (the diagram's badge)",
  "leader line": "ties the plate to its castle: 2 art px of maroon ink in a 1-art-px cream halo, straight to the plate's nearest edge, a dot at the model's spot and a stepped notch where it docks into the plate; no name ever sits under it or the plate (they move, or hide)",
  // the drawer
  "drawer glyph": "the selected model's evidence state, as its own map sprite",
  "mechanism diagram": "how the model works, drawn from the real champion's outputs (on a framed mat cut from the diagram's own ground); on the painted maps' desktop it is the map plate, and the drawer keeps only the text in a narrower 336-px sheet (+ 'Show how it works' when the plate is closed)",
  "signpost chip": "a parent (built on) or child (leads to) model, with its evidence glyph",
  "metric line": "best gate metric vs the M bar, and run count",
} as const;
