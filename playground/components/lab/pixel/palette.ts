// Sweetie-16 — the ONLY colours the pixel skin paints with (map, sprites,
// windows, text). Sprites index it by one hex-digit key so every sprite string
// reads like a paint-by-number sheet.
// Round 3: the legacy 16 slots map to their hue-shifted contemporary roles via
// the illustrator's LEGACY_MAP (art/palette.ts) — used only by the few UI
// sprites still drawn from sprites.ts (menu pointer, meter star). The map is
// drawn entirely from art/.
import { LEGACY_HEX } from "./art/palette";
export const SWEETIE: readonly string[] = LEGACY_HEX;

export const C = {
  ink: SWEETIE[0], plum: SWEETIE[1], red: SWEETIE[2], orange: SWEETIE[3],
  gold: SWEETIE[4], lime: SWEETIE[5], green: SWEETIE[6], teal: SWEETIE[7],
  navy: SWEETIE[8], blue: SWEETIE[9], sky: SWEETIE[10], cyan: SWEETIE[11],
  white: SWEETIE[12], silver: SWEETIE[13], slate: SWEETIE[14], charcoal: SWEETIE[15],
} as const;

/** "0".."f" → palette index; biome placeholders are resolved per family. */
export function keyIndex(ch: string): number {
  const n = parseInt(ch, 16);
  return Number.isNaN(n) ? -1 : n;
}

// A biome = one family's ground. Three tones per biome, all from Sweetie-16:
// base (the ground), light (texture highlights, coast lip), shade (cliff
// faces, texture shadows). `plate` tints the family's name sign.
export interface Biome {
  name: string;          // learner-facing biome word, shown in the legend
  base: number;
  light: number;
  shade: number;
}

// Round 2 colour discipline: grounds sit at low chroma so saturation is left
// for evidence (gold) and focus; the central, busiest land is slate stone.
export const BIOMES: Record<string, Biome> = {
  perception:     { name: "green meadow", base: 6, light: 5, shade: 7 },
  sequence:       { name: "slate plateau", base: 14, light: 13, shade: 15 },
  generative:     { name: "autumn woods", base: 3, light: 4, shade: 2 },
  representation: { name: "snowfield",    base: 12, light: 11, shade: 13 },
  decision:       { name: "violet moor",  base: 1, light: 2, shade: 15 },
  structure:      { name: "teal reef",    base: 7, light: 6, shade: 8 },
};
// Families the world may grow later (world.ts falls back to spare slots).
export const FALLBACK_BIOME: Biome = { name: "open plain", base: 5, light: 12, shade: 6 };

export const biomeOf = (family: string): Biome => BIOMES[family] ?? FALLBACK_BIOME;

export const FAMILY_LABEL: Record<string, string> = {
  perception: "Perception",
  sequence: "Sequence",
  generative: "Generative",
  representation: "Representation",
  decision: "Decision",
  structure: "Structure",
};
export const familyLabel = (f: string) => FAMILY_LABEL[f] ?? f.charAt(0).toUpperCase() + f.slice(1);
