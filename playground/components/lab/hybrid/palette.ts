// Two media, one family identity. The chrome (everything you read) snaps to
// the Sweetie-16 palette; the diorama is cardstock — the same hue per family,
// lifted toward paper white so it reads as printed card, not pixels.
import { FAMILY_INK as PAPER_FAMILY, familyName } from "@/components/lab/paper";


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

/** family → Sweetie-16 swatch (chrome) and cardstock tint / edge (map). */
export interface FamilyInk { swatch: string; card: string; edge: string; label: string }

export const FAMILY: Record<string, FamilyInk> = {
  perception:     { swatch: SW.green,  card: "#74cf8f", edge: "#2a8a4b", label: "Perception" },
  sequence:       { swatch: SW.butter, card: "#ffdb97", edge: "#c99440", label: "Sequence" },
  generative:     { swatch: SW.orange, card: "#f59f80", edge: "#b85636", label: "Generative" },
  representation: { swatch: SW.cyan,   card: "#a8f2f6", edge: "#3fa9b3", label: "Representation" },
  decision:       { swatch: SW.berry,  card: "#d9798a", edge: "#84283b", label: "Decision" },
  structure:      { swatch: SW.lime,   card: "#c6f4a0", edge: "#6fae43", label: "Structure" },
};

const UNKNOWN: FamilyInk = { swatch: SW.mist, card: "#c9d6df", edge: "#6f8697", label: "Other" };
export const familyInk = (f: string): FamilyInk =>
  FAMILY[f] ?? { ...UNKNOWN, label: f.charAt(0).toUpperCase() + f.slice(1) };

/** Diorama materials (not family-coded). */
export const PAPER = {
  sea: "#3b5dc9",        // printed sea card
  seaDeep: "#29366f",    // sea card fibre
  river: "#6f95e6",      // channel between two region cutouts
  rim: "#fffaf0",        // die-cut white rim around every cutout
  shadow: "#1a1c2c",     // cast shadow of card onto card
  road: "#fff6df",       // paper road strip
  roadCase: "#333c57",   // road strip cut line
  walk: "#ffcd75",       // the focused model's walk home, painted over its roads
  plank: "#c98b4f",      // bridge planks
  ink: "#2b2a3a",        // map lettering
  flag: "#e43b44",       // champion flag
} as const;

// ── chrome swatches that match the paper map ──────────────────────────────
// The map is the papercraft skin's; its family colours are not in Sweetie-16.
// Each family's chrome swatch is the perceptually nearest Sweetie-16 colour
// (CIE Lab), assigned greedily so no two families share a swatch. Structural
// chrome colours (night, navy, ink, slate, white, mist) are never used.
const SWATCH_POOL = [SW.plum, SW.berry, SW.orange, SW.butter, SW.lime, SW.green, SW.teal, SW.blue, SW.sky, SW.cyan];

function lab(hex: string): [number, number, number] {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const x = (v[0] * 0.4124 + v[1] * 0.3576 + v[2] * 0.1805) / 0.95047;
  const y = v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722;
  const z = (v[0] * 0.0193 + v[1] * 0.1192 + v[2] * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const dist = (a: string, b: string) => {
  const p = lab(a), q = lab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
};

/**
 * family → Sweetie-16 swatch, snapped from the map's family faces: the
 * assignment with the smallest TOTAL Lab distance (exhaustive, ≤ 10P6
 * options), so two close greens can't swap the way a greedy pick would.
 */
export function snapSwatches(faces: Record<string, string>): Record<string, string> {
  const fams = Object.keys(faces).sort();
  const D = fams.map((f) => SWATCH_POOL.map((c) => dist(faces[f], c)));
  let best = Infinity;
  let bestPick: number[] = [];
  const pick: number[] = [];
  const used = new Array(SWATCH_POOL.length).fill(false);
  const go = (i: number, sum: number) => {
    if (sum >= best) return;
    if (i === fams.length) { best = sum; bestPick = [...pick]; return; }
    for (let c = 0; c < SWATCH_POOL.length; c++) {
      if (used[c]) continue;
      used[c] = true; pick.push(c);
      go(i + 1, sum + D[i][c]);
      used[c] = false; pick.pop();
    }
  };
  if (fams.length <= SWATCH_POOL.length) go(0, 0);
  const out: Record<string, string> = {};
  fams.forEach((f, i) => { out[f] = bestPick.length ? SWATCH_POOL[bestPick[i]] : SW.mist; });
  return out;
}

const SNAPPED = snapSwatches(Object.fromEntries(Object.entries(PAPER_FAMILY).map(([f, ink]) => [f, ink.face])));
/** Chrome swatch for a family: matches the paper map's island colour. */
export const chromeSwatch = (f: string): string => SNAPPED[f] ?? familyInk(f).swatch;
/** Learner-facing family name (shared with the paper map's signs). */
export const familyLabel = (f: string): string => familyName(f);
