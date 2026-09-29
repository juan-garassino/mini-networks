// Contemporary pixel-art palette for the pixel skin (round 3 — replaces the
// retired Sweetie-16 look). Built from HUE-SHIFTED RAMPS, dark → light:
// shadows slide toward blue / purple / maroon, highlights toward yellow / warm.
// No pure black anywhere: the darkest value is deep indigo (ink) or maroon.
//
// Everything the art system paints is an index into PALETTE (255 = clear), so
// no colour outside the curated set can reach the screen. Ramps share entries
// where two materials meet (wood ⊂ rock + sand, cliff ⊂ rock) — the palette
// is the de-duplicated union of every ramp (~60 colours).

// ————————————————————————————— ramps (hex, dark → light) —————————————————————————————
const OCEAN = ["#1e1f4e", "#2a2f6c", "#343f8a", "#3f4fa3", "#4a60b6"] as const;
const ROCK = ["#3a1d33", "#56283a", "#7a3736", "#9a4c35", "#b86a45", "#d6925f"] as const;
const ROOF = ["#4a1d3e", "#7c2641", "#b1363e", "#d95a41"] as const;
const GOLD = [ROCK[2], "#a4602b", "#d99232", "#f5c24a", "#ffe78e"] as const;
const FOAM = ["#d2f7ec", "#fbfdf0"] as const;

const HEX = {
  /** deep ocean: flat indigo/periwinkle, darker steps for currents + cloud shadow */
  ocean: OCEAN,
  /** shallow halo: blue in shadow → cyan → pale aqua (swirl lines) */
  shallow: ["#2c6db6", "#338fd4", "#37acea", "#39c5f0", "#62dcf2", "#9cefee"],
  /** foam: pale aqua → warm white */
  foam: FOAM,
  /** sand / lowland ochre: maroon-red shadow → peach → cream */
  sand: [ROCK[2], "#a4644e", "#c98552", "#e2a562", "#efc27c", "#f8e0a4"],
  /** lush meadow: teal shadow → green → yellow-green light */
  meadow: ["#173e4a", "#1f6352", "#2a8a47", "#45a93e", "#5cc23f", "#8fd645", "#cbea5e"],
  /** dry savanna: brown-violet → ochre grass → straw */
  savanna: ["#5a4148", "#8a6a48", "#b4903f", "#d4b24a", "#efc27c", "#f8e0a4"],
  /** frost tundra (representation lowlands): slate teal → mint */
  frost: ["#35566e", "#4f8189", "#79b0a8", "#b4dcc8"],
  /** snow: lavender shadow → blue-white → warm white */
  snow: ["#4b4a86", "#6c70ad", "#949dd0", "#bccbe8", "#e2ebf4", FOAM[1]],
  /** crystal / masonry: grey-violet (also every stone sprite) */
  stone: ["#2e2946", "#463f63", "#625b82", "#837ea2", "#aba9c3", "#e2ebf4"],
  /** red-brown rock / volcanic ground: maroon shadow → rust → peach light */
  rock: ROCK,
  /** lava / embers */
  lava: [ROOF[2], "#e2542c", "#ff8f2e", GOLD[3]],
  /** roof reds: plum shadow → red → coral */
  roof: [...ROOF, "#ff8f2e"],
  /** gold (evidence, compass, trims): maroon shadow → amber → pale gold */
  gold: GOLD,
  /** magic / crystal accents: violet → pink */
  magic: ["#4d2468", "#9a4aa6", "#eba0d6"],
  /** UI: ink (= deepest ocean indigo, never black), paper */
  ui: [OCEAN[0], "#fff6e0"],
  /** royal banner blue (castle banners, flags) — ocean + halo entries */
  banner: [OCEAN[0], OCEAN[2], OCEAN[4], "#62dcf2"],
} as const;

// derived ramps (shared entries, no new colours)
const DERIVED = {
  /** wood: the rock shadows + sand lights */
  wood: [ROCK[0], ROCK[1], ROCK[2], "#a4644e", "#c98552", "#e2a562"],
  /** cliff faces under the raised land slab */
  cliff: [ROCK[0], ROCK[1], ROCK[2], ROCK[3]],
  /** forest canopy (meadow, shadow end) */
  forest: ["#173e4a", "#1f6352", "#2a8a47", "#45a93e", "#5cc23f", "#8fd645"],
  /** pine canopy: teal-dark into frost */
  pine: [OCEAN[0], "#173e4a", "#35566e", "#1f6352", "#4f8189", "#79b0a8"],
  /** olive canopy for savanna acacias */
  olive: ["#5a4148", "#1f6352", "#8a6a48", "#45a93e", "#d4b24a", "#cbea5e"],
  /** window glow */
  glow: [GOLD[1], GOLD[3], GOLD[4], FOAM[1]],
} as const;

export type RampName = keyof typeof HEX | keyof typeof DERIVED;
const ALL: Record<RampName, readonly string[]> = { ...HEX, ...DERIVED };

// ————————————————————————————— palette (de-duplicated union) —————————————————————————————
export const PALETTE: string[] = [];
const indexOfHex = new Map<string, number>();
for (const ramp of Object.values(ALL)) for (const hex of ramp) {
  if (!indexOfHex.has(hex)) { indexOfHex.set(hex, PALETTE.length); PALETTE.push(hex); }
}

/** name → palette indices, dark → light. */
export const RAMPS = Object.fromEntries(
  Object.entries(ALL).map(([k, v]) => [k, v.map((h) => indexOfHex.get(h)!)]),
) as Record<RampName, number[]>;

export const CLEAR = 255;

/** Ramp step `t` ∈ [0, 1] (0 = darkest) → palette index. */
export function shade(ramp: RampName | readonly number[], t: number): number {
  const r = typeof ramp === "string" ? RAMPS[ramp] : ramp;
  const k = Math.round(Math.max(0, Math.min(1, t)) * (r.length - 1));
  return r[k];
}

/** Ramp step by integer (clamped; negative counts from the light end). */
export function step(ramp: RampName, i: number): number {
  const r = RAMPS[ramp];
  const k = i < 0 ? r.length + i : i;
  return r[Math.max(0, Math.min(r.length - 1, k))];
}

/** Common single colours. */
export const INK = RAMPS.ui[0];
export const PAPER = RAMPS.ui[1];

/** Uint8 RGB triples, one per palette index. */
export const RGB: [number, number, number][] = PALETTE.map((h) => [
  parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16),
]);

// ————————————————————————————— colour math on indices —————————————————————————————
// Which ramp (and step) each index belongs to — its FIRST (primary) ramp.
const home = new Map<number, { ramp: RampName; i: number }>();
for (const [name, r] of Object.entries(RAMPS) as [RampName, number[]][]) {
  r.forEach((idx, i) => { if (!home.has(idx)) home.set(idx, { ramp: name, i }); });
}

/** One step darker along the index's home ramp (falls back to itself at the end). */
export function darker(idx: number, n = 1): number {
  const h = home.get(idx);
  if (!h) return idx;
  const r = RAMPS[h.ramp];
  return r[Math.max(0, h.i - n)];
}
/** One step lighter along the index's home ramp. */
export function lighter(idx: number, n = 1): number {
  const h = home.get(idx);
  if (!h) return idx;
  const r = RAMPS[h.ramp];
  return r[Math.min(r.length - 1, h.i + n)];
}

// Cast-shadow remap (cloud shadows, land shadow on the halo): every index →
// a darker, cooler neighbour. Water drops toward indigo; land drops one step.
export const SHADOW: Uint8Array = (() => {
  const m = new Uint8Array(256);
  for (let i = 0; i < 256; i++) m[i] = i;
  PALETTE.forEach((_, i) => { m[i] = darker(i); });
  const o = RAMPS.ocean, s = RAMPS.shallow, f = RAMPS.foam;
  m[o[3]] = o[1]; m[o[4]] = o[2]; m[o[2]] = o[1]; m[o[1]] = o[0];
  m[s[5]] = s[3]; m[s[4]] = s[2]; m[s[3]] = s[1]; m[s[2]] = s[1]; m[s[1]] = s[0]; m[s[0]] = o[3];
  m[f[0]] = s[4]; m[f[1]] = s[4];
  return m;
})();

// ————————————————————————————— biomes —————————————————————————————
/**
 * A family's biome = which ramps its elevation bands use. `low` is the
 * lowland band next to the beach, `mid` the main ground, `high` the upland
 * below the snow line; `forest` tints canopies; `accent` is the biome's
 * signature detail colour (lava cracks, crystal glints, dune ripples…).
 */
export interface Biome {
  key: string;
  /** learner-facing word, for legends */
  name: string;
  low: RampName;
  mid: RampName;
  high: RampName;
  peak: RampName;
  forest: RampName;
  /** fraction of the forest-able band that actually grows canopy texture */
  canopy: number;
  accent: RampName;
}

export const BIOMES: Record<string, Biome> = {
  perception:     { key: "meadow",   name: "lush meadow",       low: "sand",    mid: "meadow",  high: "rock",  peak: "snow", forest: "forest", canopy: 0.55, accent: "meadow" },
  decision:       { key: "savanna",  name: "dry savanna",       low: "sand",    mid: "savanna", high: "rock",  peak: "rock", forest: "olive",  canopy: 0.25, accent: "savanna" },
  sequence:       { key: "dunes",    name: "dunes & mesas",     low: "sand",    mid: "sand",    high: "rock",  peak: "rock",  forest: "olive",  canopy: 0.08, accent: "rock" },
  generative:     { key: "volcanic", name: "volcanic reach",    low: "rock",    mid: "rock",    high: "rock",  peak: "lava", forest: "forest", canopy: 0.12, accent: "lava" },
  representation: { key: "ice",      name: "icy highlands",     low: "frost",   mid: "frost",   high: "snow",  peak: "snow", forest: "pine",   canopy: 0.35, accent: "snow" },
  structure:      { key: "crystal",  name: "crystal isle",      low: "stone",   mid: "stone",   high: "stone", peak: "magic", forest: "pine",   canopy: 0.15, accent: "magic" },
};
export const FALLBACK_BIOME: Biome = BIOMES.perception;
export const biomeOf = (family: string): Biome => BIOMES[family] ?? FALLBACK_BIOME;

/** Palette size (for the specimen sheet / tests). */
export const PALETTE_SIZE = PALETTE.length;

// ————————————————————————————— legacy swap —————————————————————————————
/**
 * Sweetie-16 index (components/lab/pixel/palette.ts, the retired skin) →
 * closest ROLE in the new ramps, so the whole skin can swap palettes in one
 * step: `newIdx = LEGACY_MAP[oldIdx]`, or `LEGACY_HEX[oldIdx]` for CSS/canvas.
 */
export const LEGACY_MAP: readonly number[] = [
  RAMPS.ui[0],       // 0 ink #1a1c2c      → ink (deepest ocean indigo, never black)
  RAMPS.magic[0],    // 1 plum #5d275d     → violet shadow
  RAMPS.roof[2],     // 2 red #b13e53      → roof red
  RAMPS.roof[3],     // 3 orange #ef7d57   → coral / roof light
  RAMPS.gold[3],     // 4 gold #ffcd75     → gold (evidence)
  RAMPS.meadow[5],   // 5 lime #a7f070     → grass highlight
  RAMPS.meadow[4],   // 6 green #38b764    → grass #5cc23f
  RAMPS.meadow[1],   // 7 teal #257179     → grass/forest teal shadow
  RAMPS.ocean[2],    // 8 navy #29366f     → deep-sea current
  RAMPS.ocean[3],    // 9 blue #3b5dc9     → deep ocean #3f4fa3
  RAMPS.shallow[3],  // a sky #41a6f6      → shallow halo #39c5f0
  RAMPS.shallow[4],  // b cyan #73eff7     → halo swirl / light cyan
  RAMPS.foam[1],     // c white #f4f4f4    → foam / warm white
  RAMPS.snow[3],     // d silver #94b0c2   → snow mid (blue-grey)
  RAMPS.stone[2],    // e slate #566c86    → stone mid
  RAMPS.stone[1],    // f charcoal #333c57 → stone shadow
];
export const LEGACY_HEX: readonly string[] = LEGACY_MAP.map((i) => PALETTE[i]);
