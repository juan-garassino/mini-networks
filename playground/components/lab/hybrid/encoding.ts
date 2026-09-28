// Every visual mark of the hybrid skin and the data it encodes. A mark that
// is not in this table must not be drawn.
import { ENCODING as PAPER_ENCODING } from "@/components/lab/paper";

export interface Encoding { mark: string; encodes: string; source: string }

// Map marks this skin adds on top of the paper layers.
export const MAP_EXTRAS: Encoding[] = [
  { mark: "vellum over the other islands (region view)", encodes: "families other than the one you are visiting", source: "view.focus → world.nodes[].family" },
];

// The pixel chrome — this skin's own part.
export const CHROME_ENCODING: Encoding[] = [
  { mark: "pixel window printed on a die-cut card (soft paper shadow)", encodes: "something to read (chrome, not territory); no data", source: "—" },
  { mark: "pixel title plate", encodes: "zoo size: model and family counts", source: "world.nodes, world.regions" },
  { mark: "pixel hand", encodes: "what Enter opens: the current family's entry atom, the current model row, or the focused model", source: "menu cursor, view.focus" },
  { mark: "highlighted blue menu row", encodes: "the keyboard cursor", source: "menu cursor" },
  { mark: "pixel swatch", encodes: "family (nearest Sweetie-16 colour to the map's island colour)", source: "world.nodes[].family → paper FAMILY_INK → snapSwatches()" },
  { mark: "gold menu text", encodes: "atom (elementary model)", source: "world.nodes[].atom" },
  { mark: "pixel red flag pip", encodes: "champion (same meaning as the map's red flag)", source: "evidenceState()" },
  { mark: "5×7 bitmap digits", encodes: "every number printed in the chrome (counts, LV, the bar, versions) — drawn, not typed, so 2/5 never read as 8/S", source: "the field each number prints" },
  { mark: "LV number", encodes: "generation = depth + 1", source: "world.nodes[].depth" },
  { mark: "Class", encodes: "family", source: "world.nodes[].family" },
  { mark: "Equipped vN", encodes: "champion checkpoint version", source: "evidence.champion_version" },
  { mark: "gate meter fill / white tick", encodes: "best local metric / the M-tier bar (green clears, orange short)", source: "evidence.best_metric, threshold_m, higher_is_better" },
  { mark: "Skills list", encodes: "mechanisms the model introduces", source: "taxonomy.models[].introduces + mechanisms" },
  { mark: "Builds on / Leads to rows", encodes: "parents / children, travel targets", source: "cardModel().parents / children" },
  { mark: "typewriter line", encodes: "model description, or a family's size and atoms", source: "taxonomy description; world.nodes" },
];

// Live table: the paper skin's map marks (its folded-note card is replaced
// by the pixel status window; set-pieces stand still, no pop-up) + chrome.
export const ENCODING: Encoding[] = [
  ...PAPER_ENCODING
    .filter((e) => !/note/i.test(e.mark))
    .map((e) => (/set-piece/i.test(e.mark) && /pop/i.test(e.mark) ? { ...e, mark: "standing set-piece (no pop-up here)" } : e)),
  ...MAP_EXTRAS,
  ...CHROME_ENCODING,
];

// Fallback table: marks of this skin's own paper shim (./paper-map.tsx),
// used only if the paper skin's layers fail to render.
export const ENCODING_SHIM: Encoding[] = [
  // ── the paper diorama ──────────────────────────────────────────────────
  { mark: "cardstock region cutout (colour)", encodes: "model family; area ∝ model count", source: "world.regions[] + world.regionOf" },
  { mark: "card edge + cast shadow under a cutout", encodes: "same region (paper thickness only restates the cutout)", source: "world.regions[]" },
  { mark: "light-blue channel between cutouts", encodes: "border between two families", source: "world.terrain == RIVER" },
  { mark: "open sea card", encodes: "no model (outside every family)", source: "world.terrain == SEA" },
  { mark: "plank bridge", encodes: "cross-family builds_on edge crossing a border", source: "world.bridges[]" },
  { mark: "cream road strip (thick)", encodes: "builds_on edge from a model's primary parent; length ∝ generation gap", source: "world.roads[].kind primary|bridge" },
  { mark: "cream road strip (thin)", encodes: "builds_on edge from a secondary parent", source: "world.roads[].kind secondary" },
  { mark: "gold dotted trail", encodes: "focused model's walk home to its root atom", source: "pathToAtom(world, focus)" },
  { mark: "large octagon in family colour + symbol", encodes: "atom (elementary model) and its periodic symbol", source: "world.nodes[].atom + symbolFor()" },
  { mark: "small white disc with family ring", encodes: "derived model", source: "world.nodes[] (atom=false)" },
  { mark: "gold ring + lifted node", encodes: "the focused model", source: "view.focus" },
  { mark: "red flag", encodes: "champion checkpoint passed the M gate", source: "evidenceState() == champion" },
  { mark: "yellow pennant", encodes: "quality bar still provisional", source: "evidenceState() == provisional" },
  { mark: "white pennant", encodes: "trained locally, no champion", source: "evidenceState() == trained" },
  { mark: "no flag", encodes: "never trained", source: "evidenceState() == untrained" },
  { mark: "paper name tag (Fredoka)", encodes: "model name; hidden when it would print under 13px", source: "world.labels[]" },
  { mark: "region signboard", encodes: "family name + model count, on the region's set-piece", source: "world.regions[].setPiece + node counts" },
  { mark: "paper props (bush, reeds, flower, crystal, pine, rock)", encodes: "biome = family of the free cell", source: "world.decor[].region, .scale" },
  { mark: "paper critter", encodes: "you: walks from the root atom to the model you opened", source: "pathToAtom + samplePolyline" },
  ...CHROME_ENCODING,
];
