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

// hand-placed like the reference: VISION top-left, LANGUAGE top-right,
// GENERATIVE right, GEOMETRY mid-left, REINFORCEMENT bottom-left,
// KNOWLEDGE bottom-centre — the Transformer hub sits dead centre between them.
export const REGIONS: Region[] = [
  { key: "perception", name: "Vision", tagline: "see · understand · represent", color: "#c0433a", cx: 0.24, cy: 0.30, r: 0.20 },
  { key: "sequence", name: "Language", tagline: "generate · reason · communicate", color: "#2f4b7c", cx: 0.72, cy: 0.28, r: 0.19 },
  { key: "generative", name: "Generative", tagline: "create · imagine · synthesize", color: "#d0682f", cx: 0.80, cy: 0.66, r: 0.16 },
  { key: "representation", name: "Geometry", tagline: "embed · represent · measure", color: "#6a4d8c", cx: 0.22, cy: 0.62, r: 0.15 },
  { key: "decision", name: "Reinforcement", tagline: "learn · act · adapt", color: "#3f7d4f", cx: 0.34, cy: 0.82, r: 0.15 },
  { key: "structure", name: "Knowledge", tagline: "retrieve · augment · ground", color: "#5a5f66", cx: 0.60, cy: 0.80, r: 0.15 },
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
