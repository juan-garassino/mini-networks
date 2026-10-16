// The Network Atlas — editorial palette & style. A cream data-viz "map of
// machine intelligence": muted ink, translucent region fields, one hairline web.
// Families (from lib/blueprint) are re-labelled as editorial regions.

export const ATLAS_INK = "#2b2723";
export const ATLAS_INK_DIM = "#8b8378";
export const ATLAS_PAPER = "#f4f0e6";
export const ATLAS_PAPER_DEEP = "#ece6d6";

export type RegionKey =
  | "perception" | "sequence" | "generative" | "representation" | "decision" | "structure";

export type Region = {
  key: RegionKey;
  name: string;
  tagline: string;
  color: string;
  // normalised cluster centre (0..1 of the canvas) + rough radius
  cx: number; cy: number; r: number;
};

// Hand-placed around the transformer hub (dead centre); radii grow with the
// family's head-count (perception 15, sequence 12, decision 6, generative 5,
// representation 4, structure 2) so no field has to overlap a neighbour.
// Inks are muted engraving pigments, not signal colours.
export const REGIONS: Region[] = [
  { key: "perception", name: "Vision", tagline: "see · understand · represent", color: "#b0574d", cx: 0.25, cy: 0.33, r: 0.19 },
  { key: "sequence", name: "Language", tagline: "generate · reason · communicate", color: "#46608c", cx: 0.745, cy: 0.32, r: 0.175 },
  { key: "generative", name: "Generative", tagline: "create · imagine · synthesize", color: "#bd7745", cx: 0.80, cy: 0.77, r: 0.115 },
  { key: "representation", name: "Geometry", tagline: "embed · represent · measure", color: "#7a6298", cx: 0.16, cy: 0.77, r: 0.105 },
  { key: "decision", name: "Reinforcement", tagline: "learn · act · adapt", color: "#4d8459", cx: 0.39, cy: 0.80, r: 0.12 },
  { key: "structure", name: "Knowledge", tagline: "retrieve · augment · ground", color: "#6b7077", cx: 0.60, cy: 0.83, r: 0.08 },
];

export const REGION_BY_KEY: Record<string, Region> =
  Object.fromEntries(REGIONS.map((r) => [r.key, r]));

// node radii by role
export const R_HUB = 17;
export const R_MILESTONE = 13;
export const R_MODEL = 8.5;
export const R_DERIVED = 6.5;
export const R_CONCEPT = 2.2;

export const HUB_NAME = "transformer";
export const HUB_INK = "#171512";
