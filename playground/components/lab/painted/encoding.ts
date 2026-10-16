// Painted skin — every visual mark → the datum it encodes, in the library's
// one shape (lib/encoding.ts). A mark not in this table does not belong on the
// screen. (Biome dressing is the owner's painting; the live layer only adds
// what is listed here.) The corner legend (corners/corner-plate.tsx) renders
// KEY / PAPER_KEY below, whose rows name their marks, so it cannot drift.
import { defineEncoding, defineKey } from "../../../lib/encoding.ts";

export const ENCODING = defineEncoding({
  // on the map
  "land sign": { encodes: "family name + number of models in that land (count badge); a land out of focus signs at the names' size, never louder" },
  "edge sign": { encodes: "phones: a land whose sign spot is off the screen — its name + count on the nearest screen edge, at the land's height, a stepped chevron toward it; press = open that land (none while a card is open)", kind: "chrome" },
  "atom banner": { encodes: "a root model (no parents); flag colour = evidence state" },
  "road stone": { encodes: "a derived model on the painted roads; stone colour = evidence state" },
  "model ribbon": { encodes: "the model's name; inked when selected (maroon plate, cream caps, gold edge + dark keyline — the drawer's 'you are here' chip), lit when hovered" },
  "paper plate": { encodes: "paper map: the model's name where the painter hung his plate (his lettering is retouched out of the painting), one type size for all at the whole-sheet view (long names break to two lines), one screen size once zoomed in; 'no model yet' where the painter invented one" },
  "paper land title": { encodes: "paper map: a land's name and the painter's subline, redrawn on our stock at his plate's size, set to fit; stays whole in view (steps clear of the corners) and keeps its whole-sheet screen size when zoomed in" },
  "paper seal": { encodes: "the number of models in that land (wax seal on the title's corner)" },
  "paper marker": { encodes: "a model on the paper map: disc in the evidence fill (dashed rim = provisional), star = champion, pip = trained; the same mark in the key, the card and its signposts" },
  "lit road": { encodes: "the selected model's lineage back to its root atom", kind: "interaction" },
  "focus fade": { encodes: "lands other than the focused one fade (pixel: dithered band = distance from it; paper: a feathered wash of the stock outside the land, and its names dimmed)", kind: "interaction" },
  critter: { encodes: "walks the lineage road from the root to the selected model", kind: "motion" },
  "road cart": { encodes: "one builds_on edge, travelling parent → child in the child's evidence colour; the selected lineage's carts run lit and without gaps", kind: "motion" },
  // life (the painting breathing — no data beyond the carts; every pixel keeps to its own ramp)
  "water glint": { encodes: "decoration: waves cross the blue water, foam blinks", kind: "decoration" },
  "lava pulse": { encodes: "decoration: the flow brightens in waves; embers + smoke rise from the three vents", kind: "decoration" },
  "window flicker": { encodes: "decoration: lit windows and lanterns flicker", kind: "decoration" },
  "leaf rustle": { encodes: "decoration: gusts lift highlights across the trees", kind: "decoration" },
  "lighthouse beam": { encodes: "decoration: a ray sweeps round each lamp", kind: "decoration" },
  waterfall: { encodes: "decoration: the painted falls pour (landmark boxes)", kind: "decoration" },
  "flag flutter": { encodes: "decoration: small red flags on poles and towers ripple", kind: "decoration" },
  gull: { encodes: "decoration: a few birds cross the parchment sea", kind: "decoration" },
  splash: { encodes: "decoration: now and then a fish breaks the water", kind: "decoration" },
  // openness (three levels): whole map = land signs only (hover names a model);
  // in a land = that land's names; a model = its card + named lineage
  // the four corners
  "cartouche sentence": { encodes: "live counts: models, lands, proven champions (or the focused land's)", kind: "chrome" },
  "sheet tab": { encodes: "which owner map is open (pixel / paper); every tab one height (CORNER.tab), the open one lowered", kind: "chrome" },
  "phone bar": { encodes: "phones: the two top corners as one row — title, find-a-model magnifier, the Pixel / Paper pair (pressed = open), map only (framed-corners icon)", kind: "chrome" },
  "disabled control": { encodes: "a control that cannot act now (zoomed all the way out): sunk flat, parchment fill, soft-ink rim and glyph, no shadow", kind: "chrome" },
  "compass points": { encodes: "pan direction; hub = whole map (filled gold when at the whole map)", kind: "chrome" },
  "scale bar cell": { encodes: "one model, in land order (atoms first); fill = evidence state (hatched = provisional); one framed segment = one land" },
  "pipeline tick": { encodes: "one composition (pipeline): a graduation hanging under the scale bar's baseline" },
  "scale bar title": { encodes: "the scale's key, '1 cell = 1 model' (sign voice), pipelines count (right); the zoo's counts live in the cartouche only", kind: "chrome" },
  "legend title": { encodes: "'Map key': the corner plates' one title treatment (sign voice, border ink)", kind: "chrome" },
  "search magnifier": { encodes: "focus mode: the find-a-model field, folded; pressing it (or '/') unfolds the field in place", kind: "chrome" },
  "legend row": { encodes: "the evidence vocabulary (banner + stone per state; 'not trained yet' is the grey stone alone — an untrained atom flies no banner)", kind: "chrome" },
  "minimap frame": { encodes: "the camera box on the whole map (shown only when zoomed in)", kind: "chrome" },
  // corner system (corners/plate.tsx): one outer margin, one plate padding, one
  // side-column width (cartouche, legend / minimap); the compass stands on the
  // scale bar, and scale bar + legend share the bottom edge. While the map
  // plate is up and no hole between them fits it, the scale bar folds away,
  // then the minimap (the chrome yields; the plate never clips).
  // Focus mode (a land or a model open, or zoomed in): the cartouche is one row
  // (title, Whole map, magnifier), the scale bar a slim strip of 4-px cells (no
  // ticks, no title), the minimap a 176-px inset, the compass two thirds size,
  // the tabs compact — they re-stamp in place (two frames) on the change;
  // with a model open the cartouche drops its Whole map (the drawer has one).
  // Phones: one top bar in every view; the overview frames the map by its
  // height at a whole crisp scale (the continent pans sideways); a land goes
  // in at a whole crisp scale too; the compass + slim scale bar step away
  // while the card is pulled up full. No mark changes meaning, only size.
  "land sign clearance": { encodes: "a land sign that would sit under the corner furniture steps to the nearest clear spot", kind: "chrome" },
  // the map plate (desktop): "How <model> works", hung beside the selected castle
  "map plate": { encodes: "the selected model's full mechanism diagram at 1 art px = 1 CSS px (×1.5 / ×2 only when that is whole device px and the plate keeps to half the visible width, 60 % of its height), in a compact frame (8-px padding, 22-px buttons), on a plate of the map's own material; follows the castle in map space, never scales; caption = how real the drawing is (the diagram's badge)", kind: "chrome" },
  "leader line": { encodes: "ties the plate to its castle: 2 art px of maroon ink in a 1-art-px cream halo, straight to the plate's nearest edge, a dot at the model's spot and a stepped notch where it docks into the plate; no name ever sits under it or the plate (they move, or hide); it runs longer only to carry the plate past a name it may not cover", kind: "interaction" },
  "retouch": { encodes: "paper: none — the painter's own cartouche, compass, scale bar and lettering are painted out once (heal.ts), so the sheet carries one compass, one title, one scale; a plate a corner, the map plate or the screen edge would cut is left off, the painting runs on under it", kind: "decoration" },
  // the drawer
  "drawer glyph": { encodes: "the selected model's evidence state, as its own map sprite (paper: its marker); a skin may pass its own (Drawer glyph prop)" },
  "drawer place line": { encodes: "the model's land, and atom or its generation (depth)" },
  "evidence stamp": { encodes: "the evidence state in the colours the map paints it (dashed = provisional), + the champion's registry version" },
  "introduces box": { encodes: "a mechanism the model adds to the zoo (gold cog = the taxonomy's 'introduces')" },
  "card road": { encodes: "the Lineage section, as the map draws it: 'Built on' signposts, a dashed road, the model itself (inked, 'you are here'), a dashed road, leads-to signposts; an atom has no road in; a dashed empty sign = nobody builds on it yet" },
  "count badge": { encodes: "how many pipelines (the land signs' badge, beside the section header)" },
  "section header": { encodes: "one of the card's three sections (Lineage, Pipelines, Quality gate; + How it works on phones): sign voice, ruled out to the edge", kind: "chrome" },
  "more fade": { encodes: "the card scrolls: the ground fades over its foot while more lies below the fold", kind: "chrome" },
  "gate rows": { encodes: "the EvidenceSpec gate: metric + direction, the M bar (provisional flag), the best so far when reported, runs logged" },
  "mechanism diagram": { encodes: "how the model works, drawn from the real champion's outputs (on a framed mat cut from the diagram's own ground); on the painted maps' desktop it is the map plate, and the drawer keeps only the text in a narrower 336-px sheet (+ 'Show how it works' when the plate is closed)" },
  "signpost chip": { encodes: "a parent (built on) or child (leads to) model, with its evidence glyph; press to travel there" },
  "metric line": { encodes: "best gate metric vs the M bar (drawn bar, only when a best metric is reported)" },
  "pipeline row": { encodes: "a composition the model is in; its parts, the model itself inked, the others pressable" },
});

/** The pixel map's key: one row per evidence state, drawn with the map's own
 * banner + stone sprites (an untrained model shows the grey stone alone). */
export const KEY = defineKey(ENCODING, {
  title: "Map key",
  rows: [
    { mark: "atom banner", sample: "champion", label: "champion, passed the gate" },
    { mark: "atom banner", sample: "trained", label: "trained, no champion yet" },
    { mark: "atom banner", sample: "provisional", label: "new, bar still provisional" },
    { mark: "road stone", sample: "untrained", label: "not trained yet" },
  ],
  notes: ["Banners mark atoms; stones, models built on them."],
});

/** The paper map's key: the same vocabulary in its own marker. */
export const PAPER_KEY = defineKey(ENCODING, {
  title: "Map key",
  rows: [
    { mark: "paper marker", sample: "champion", label: "champion, passed the gate" },
    { mark: "paper marker", sample: "trained", label: "trained, no champion yet" },
    { mark: "paper marker", sample: "provisional", label: "new, bar still provisional" },
    { mark: "paper marker", sample: "untrained", label: "not trained yet" },
  ],
  notes: ["Every model is a marker: a star for a champion, a pip for a trained one, a dashed rim while its bar is provisional."],
});
