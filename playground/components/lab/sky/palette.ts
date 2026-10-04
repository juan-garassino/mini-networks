// The Night Map's palette: every colour the sky paints, as named ramps.
//
// House rule (the painted pixel map's): a ramp is hue-SHIFTED, not just
// darkened — its dark end leans cold (violet/indigo, the colour of the night
// around it) and its light end leans warm. That is what makes a dithered
// cloud read as painted rather than as a tinted gradient. Every value here is
// used by bake.ts (the baked sky), sprites.ts (the star and emblem sprites) or
// the night material's chrome; nothing else invents a colour.
//
// Pure data: imported by node tests.

export type Rgb = [number, number, number];

export const hex = (h: string): Rgb => {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

/** The night itself, darkest → lightest. 0–1 are the open sky, 2–4 the
 * Milky Way's dust; it shifts from violet-black toward a cold slate blue. */
export const NIGHT = [
  "#0b0a20", // 0 the deep sky (the page colour beyond the bake)
  "#100f2c", // 1 open sky
  "#151838", // 2 faint dust
  "#1b2046", // 3 dust
  "#232b56", // 4 the band's bright core
] as const;

/** Field stars (decoration): a cold dim blue up to a warm white. */
export const FIELD = ["#3c4374", "#6a74a8", "#aeb8e2", "#f2f0ff"] as const;

/** A family's nebula ramp (dark rim → bright core, 5 steps) and its pastel
 * tints (sign plaque border, emblem, lineage line). The ramp's step 0 sits one
 * rung above the open sky so a nebula's rim never reads as a hole. Hues follow
 * the day map's lands: perception's forest, sequence's sand, generative's
 * lava, representation's snow, structure's neon city, decision's sea. */
export interface FamilyInk {
  ramp: [string, string, string, string, string];
  /** pastel tints, mid → pale: [plaque border + line, emblem light, emblem pale] */
  tint: [string, string, string];
}

export const FAMILY_INK: Record<string, FamilyInk> = {
  perception: {
    ramp: ["#141f3c", "#16304a", "#1c4550", "#2a5e58", "#45795f"],
    tint: ["#7cc49a", "#b4e2bc", "#e6f8de"],
  },
  sequence: {
    ramp: ["#1c1a3e", "#2c2348", "#45304f", "#644355", "#8a5d5a"],
    tint: ["#e0a070", "#f4c79a", "#fde8cc"],
  },
  generative: {
    ramp: ["#1e1840", "#331c49", "#4f224d", "#712e50", "#994455"],
    tint: ["#ec8476", "#f6b0a0", "#fddad0"],
  },
  representation: {
    ramp: ["#141c42", "#182a56", "#1f3e6c", "#2e5684", "#4a749e"],
    tint: ["#8cb2e8", "#bcd6f6", "#e6f0ff"],
  },
  structure: {
    ramp: ["#191842", "#251f56", "#352b6a", "#4a3b80", "#665296"],
    tint: ["#b49cec", "#d4c4f8", "#f0e8ff"],
  },
  decision: {
    ramp: ["#121e42", "#143052", "#174662", "#1f5e70", "#357a7c"],
    tint: ["#70ccc8", "#a8e6de", "#dcf8f2"],
  },
};

/** Evidence sprite ramps (sprites.ts letters → colours). */
export const GOLD = { k: "#3a2418", "1": "#8a4e2c", "2": "#d08a3c", "3": "#f2c25e", "4": "#ffe9a4", w: "#fffbea" } as const;
export const MINT = { k: "#10283a", "1": "#246a6a", "2": "#48a68c", "3": "#8edcb4", "4": "#dcffe8" } as const;
export const LILAC = { "1": "#6a64a6", "2": "#aaa4e4", "3": "#e2deff" } as const;
export const GREY = { k: "#0b0a20", "1": "#4a4e74", "2": "#8a8eb2" } as const;

/** Lines and marks over the sky. */
export const INK = {
  lit: "#ffd98a",       // the selected lineage (pastel gold, the comets' trail)
  ring: "#ffe2b0",      // the selection ring
  cross: "#8c8fbe",     // secondary + cross-family lineage, shown on focus only (dashed)
  pipe: "#a6e2dc",      // pipeline arcs (dotted pastel aqua)
  name: "#ece6f6",      // star names
  nameSoft: "#b0abd0",  // derived names, unselected
  outline: "#0b0a20",   // text and plaque outlines (NIGHT[0])
} as const;
