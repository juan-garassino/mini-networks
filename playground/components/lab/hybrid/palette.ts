// Two media, one identity.
// Chrome (everything you read) = Sweetie-16 pixel windows printed on card.
// Diorama = low-chroma cardstock: region colour is GROUND, so saturation is
// reserved for evidence (the gold star seal) and focus — and there is ONE
// accent, gold, shared by focus, champions and the quest route.

export const SW = {
  night: "#1a1c2c",
  plum: "#5d275d",
  berry: "#b13e53",
  orange: "#ef7d57",
  butter: "#ffcd75",
  lime: "#a7f070",
  green: "#38b764",
  teal: "#257179",
  navy: "#29366f",
  blue: "#3b5dc9",
  sky: "#41a6f6",
  cyan: "#73eff7",
  white: "#f4f4f4",
  mist: "#94b0c2",
  slate: "#566c86",
  ink: "#333c57",
} as const;

// ── contemporary pixel UI tokens (read from the pixel skin's art palette:
// hue-shifted ramps, indigo instead of black, warm lights, cool shades) ──
import { PALETTE as PX, RAMPS as PXR } from "@/components/lab/pixel/art/palette";
import { GROUND } from "./art.tsx";
const px = (ramp: keyof typeof PXR, i: number) => PX[PXR[ramp][Math.max(0, Math.min(PXR[ramp].length - 1, i < 0 ? PXR[ramp].length + i : i))]];
export const UI = {
  ink: px("ocean", 0),        // outlines, deepest panel
  panelDeep: px("ocean", 1),
  panelShade: px("ocean", 1),
  panel: px("ocean", 2),      // window fill
  panelLit: px("ocean", 3),   // lit band under the top edge
  panelHi: px("ocean", 4),    // warm-lit rim, top/left
  text: px("ui", 1),          // warm paper white
  dim: px("snow", 3),         // secondary text (≥4.5:1 on panel)
  gold: px("gold", 3),        // headings, atom names, stars
  goldLit: px("gold", 4),
  cyan: px("shallow", 3),
  cyanHi: px("shallow", 5),
  cyanShade: px("shallow", 1),
  good: px("meadow", 5),
  warn: px("lava", 2),
  plum: px("roof", 1),        // title plate
  plumLit: px("roof", 2),
  plumShade: px("roof", 0),
  plumDeep: px("magic", 0),
} as const;

/** family → cardstock face (calm ground), card edge (thickness), prop ink, and
 *  the VIVID printing ink used where punch is earned: emblems, plinth sides,
 *  region signs. */
export interface FamilyInk { face: string; edge: string; ink: string; vivid: string; label: string }

// Six low-chroma cardstocks, distinct in hue AND value so the islands still
// read in greyscale: sage, ochre, heather, sea-glass, rose clay, umber.
export const FAMILY: Record<string, FamilyInk> = {
  perception:     { face: "#a3c98a", edge: "#6f9a57", ink: "#4f6b3f", vivid: "#2e8b3e", label: "Perception" },
  sequence:       { face: "#e3c27f", edge: "#b08a45", ink: "#77602f", vivid: "#c46a12", label: "Sequence" },
  generative:     { face: "#b9a3d6", edge: "#8670a6", ink: "#5a4a72", vivid: "#7043b8", label: "Generative" },
  representation: { face: "#8fcac0", edge: "#5a9a90", ink: "#3f6b65", vivid: "#10857c", label: "Representation" },
  structure:      { face: "#e0a3a6", edge: "#ad6f73", ink: "#74504c", vivid: "#c23c5a", label: "Structure" },
  decision:       { face: "#cdb58c", edge: "#98804f", ink: "#645540", vivid: "#8a5a1c", label: "Decision" },
};

const UNKNOWN: FamilyInk = { face: "#c9c3b5", edge: "#98917f", ink: "#625c4d", vivid: "#5d5a66", label: "Other" };
export const familyInk = (f: string): FamilyInk =>
  FAMILY[f] ?? { ...UNKNOWN, label: f.charAt(0).toUpperCase() + f.slice(1) };

/** Chrome swatch = the island's own printed ground, in a pixel border. */
export const chromeSwatch = (f: string): string => GROUND[f]?.base ?? familyInk(f).face;
export const familyLabel = (f: string): string => familyInk(f).label;

/** Diorama materials. */
export const PAPER = {
  sea: "#2c5a8c",        // deep printed-blue sea: a vivid board under calm grounds
  seaHatch: "#3f72a8",   // engraved wave hatch
  seaDeep: "#1d3d62",    // cast shadow of land onto sea
  river: "#5b7d9c",      // channel between two families
  rim: "#fffaf0",        // die-cut white rim around every cutout
  shadow: "#1a1c2c",     // card-on-card shadow
  road: "#f3ead7",       // road paper
  path: "#e2d7c0",       // footpath (secondary builds_on) — lower value
  ink: "#2b2a3a",        // inked lettering, mountains, chevrons
  pencil: "#7d7a86",     // provisional / uncharted
  gold: "#f2b632",       // THE accent: focus, champion seal, quest route
  goldEdge: "#a8750f",
  plank: "#b58555",      // bridges, docks
  plankDark: "#7c5431",
  dim: "#1a1c2c",        // value step-back when a model is focused (not a milky veil)
} as const;
