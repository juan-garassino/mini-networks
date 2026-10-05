// The Night Map's tokens: every colour, size, gap and timing the sky uses.
// Components read these; none of them invents a literal. DESIGN.md has the
// table. Pure data (no DOM, type-only imports): node tests import this file.
//
// Colour house rule (the painted pixel map's): a ramp is hue-SHIFTED, not just
// darkened. Its dark end leans cold (violet/indigo, the night around it) and
// its light end leans warm, which is what makes a dithered cloud read as
// painted rather than as a tinted gradient.
import { withDigits } from "../../../lib/numerals.ts";
import type { Material } from "@/components/lab/painted/material";

export type Rgb = [number, number, number];

export const hex = (h: string): Rgb => {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

// ——— colour ————————————————————————————————————————————————————————————

/** The night itself, darkest → lightest. 0–1 are the open sky, 2–4 the
 * Milky Way's dust; it shifts from violet-black toward a cold slate blue. */
export const NIGHT = [
  "#0b0a20", // 0 the deep sky (text outlines, plate shadow's neighbour)
  "#100f2c", // 1 open sky (the page colour beyond the bake)
  "#151838", // 2 faint dust
  "#1b2046", // 3 dust
  "#232b56", // 4 the band's bright core
] as const;

/** Field stars (decoration): a cold dim blue up to a warm white. */
export const FIELD = ["#3c4374", "#6a74a8", "#aeb8e2", "#f2f0ff"] as const;

/** A family's nebula ramp (dark rim → bright core, 5 steps) and its pastel
 * tints (sign plaque border, emblem, lineage line). The ramp's step 0 sits one
 * rung above the open sky so a nebula's rim never reads as a hole. */
export interface FamilyInk {
  ramp: [string, string, string, string, string];
  /** pastel tints, mid → pale: [plaque border + line, emblem light, emblem pale] */
  tint: [string, string, string];
}

/** One entry per family, in the order the bake assigns nebulae. Replace these
 * keys with your own groups when you lift the renderer (DESIGN.md). */
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
  pipe: "#a6e2dc",      // pipeline arcs + off-screen partner plates (dotted pastel aqua)
  name: "#ece6f6",      // star names
  nameSoft: "#b0abd0",  // derived names, unselected
  outline: NIGHT[0],    // text outlines
} as const;

/** Chrome: the painted maps' plates after dark. Same construction as the pixel
 * map (1-art-px border, inner bevel, hard shadow, square corners), cut from the
 * night ramps. The rim is a quiet brass, not a bright gold: the stars carry
 * the gold, so the furniture steps back. */
const CHROME = {
  plate: "#161838",     // between NIGHT 2 and 3
  plateHi: "#191c42",
  rim: "#b9a47c",       // plate border + cartouche title: a muted brass
  ink: INK.name,
  inkSoft: "#aaa6cc",
  loud: "#e2c48a",      // the selected tab / chip: the one filled gold
  loudInk: "#141634",
  highlight: "#f2d08e", // compass points, highlights
  highlightEdge: "#8a5a2c",
  field: "#0d0c26",     // the search input
  shadow: "#06051a",
  bevel: "#2c3068",     // the inner bevel: one step up the night ramp
} as const;

// ——— type ——————————————————————————————————————————————————————————————

/** The text voice: Pixelify Sans for letters, with the library's digit face
 * laid over it for 0-9 (the numerals rule, lib/numerals.ts: VT323 regular,
 * Jersey 15 bold), because Pixelify's 5 reads as S and its 8 as B and numbers
 * are data. Both loaded in app/lab/sky/layout.tsx; unset vars fall back to
 * Pixelify alone. */
export const FONT = withDigits("var(--font-pixel), ui-monospace, monospace");
/** The sign voice (cartouche title, tab and plate titles): Jersey 15, whose
 * capital C stays open and whose Z is square; Pixelify's bold C closes into
 * an O and its Z reads as 2. */
export const SIGN_FONT = "var(--font-sky-sign, var(--font-pixel)), var(--font-pixel), ui-monospace, monospace";

/** The type scale in CSS px, [desktop, phone]. Pixelify reads best on whole
 * px; the steps follow a 1.2 ratio from the 12 px derived name. */
export const TYPE = {
  starAtom: [13, 11],     // atom star names
  starDerived: [12, 10],  // derived star names
  plaque: [15, 12],       // family name on its sign
  plaqueSub: [12, 10],    // the Latin constellation line
  chevron: [13, 12],      // off-screen partner plate
  tab: [20, 14],          // Day | Night
  /** the star key plate (bottom-right; the phone opens it from a Key button):
   * title, rows, note — the painted kit's corner-plate sizes */
  keyTitle: 15,
  keyRow: 14,
  keyNote: 13,
  button: [14, 12],       // sky only / UI
  /** the specimen sheet (?specimen=1): title, section heads, captions */
  sheet: { title: 28, head: 16, body: 14 },
  /** em width of a Pixelify glyph, for placing words before they are drawn */
  em: 0.6,
  /** the night outline around every star name, CSS px */
  outline: 3,
} as const;

// ——— grid + spacing ————————————————————————————————————————————————————

export const GRID = {
  /** CSS px per art px (the marks' grid: 4 device px on a retina screen) */
  ap: 2,
  /** frame (lib/world) px per baked sky px */
  cell: 4,
  /** below this window width the phone layout applies */
  mobileBp: 640,
  /** frame px of sky baked around the zoo */
  pad: 900,
  /** frame px of nebula beyond a family's outermost stars (region fit) */
  neb: 96,
} as const;

export const SPACE = {
  /** screen insets the camera fits the sky into: [desktop, phone] */
  fit: [{ t: 64, r: 40, b: 140, l: 40 }, { t: 118, r: 10, b: 100, l: 10 }],
  /** node view: the selected star keeps this share of its nebula's size as margin to the frame */
  nodeMargin: 0.3,
  /** a zoomed (region / node) view on desktop leaves less top, more bottom */
  fitZoom: { t: 40, b: 150 },
  /** px kept between a word and the screen edge */
  edge: 4,
  /** px around a corner plate that no word may enter */
  cornerHalo: 6,
  /** plaque padding [v, r, v, l] and emblem gap, [desktop, phone] */
  plaquePad: ["4px 8px 4px 5px", "3px 6px 3px 4px"],
  plaqueGap: [7, 5],
  plaqueH: { overview: 34, zoom: 44, phone: 26 },
  /** px kept between two signs (and between a sign and a later word) */
  plaqueApart: 6,
  /** the plaque's leader: drawn when the sign has to sit this far (px) from its nearest star */
  leaderAt: 34,
  /** a packed sky (the phone): a sign first looks for a free spot within this
   * many px of its own stars, and only then searches further out */
  signReach: 64,
  /** the star key plate: width and padding, [desktop, phone] (the painted kit's corner plate) */
  keyW: [324, 260],
  keyPad: [12, 10],
} as const;

// ——— lines (art px) ——————————————————————————————————————————————————————

export const LINE = {
  /** gap between a line's end and its star's sprite */
  gap: 2,
  /** a parent with a fan of children keeps a wider clear ring: +1 art px per this many lines */
  fanPerPx: 3,
  fanMax: 4,
  /** a long line keeps full ink this many art px from each end, then sinks one step… */
  fadeNear: 12,
  /** …and another step past this many (the middle of a long fan line is quiet) */
  fadeFar: 28,
  /** how far each step sinks toward the nebula's tone (0 = full ink) */
  fadeMix: [0.4, 0.62],
  /** the nebula ramp step a line sinks toward (its cloud's mid-bright tone) */
  sinkStep: 3,
  /** dash pattern for secondary lineage: on, period */
  dash: [2, 4],
  /** every nth pixel of a pipeline arc is lit */
  pipeDot: 3,
  /** a sign leader stops this many art px short of its star, and sinks this far toward the night */
  leaderStop: 9,
  leaderDim: 0.2,
} as const;

// ——— motion ————————————————————————————————————————————————————————————

export const MOTION = {
  /** a flip-book, never a glide */
  fps: 12,
  /** seconds in the loop (frame numbers wrap here) */
  loopS: 120,
  /** field star twinkle period, seconds [min, +range]; 1 in `twinkleEvery` stars move */
  twinkleS: [2.5, 4],
  twinkleEvery: 6,
  /** champion glint period, seconds [min, +range] */
  glintS: [7, 9],
  /** comet gap between runs, seconds [min, +range]: idle, then on a selected lineage */
  cometS: [4, 5],
  cometBusyS: [1.5, 1.5],
  /** art px a comet head moves per frame */
  cometStep: 2,
  /** a meteor every n seconds, living n frames */
  meteorS: 11,
  meteorLife: 14,
} as const;

/** The chrome material the shared corner components (Cartouche, Compass,
 * ScaleBar, Drawer; the sky's own key.tsx) read. Built from the tokens above, so the
 * night material has exactly one source. */
export const SKY_MATERIAL: Material = {
  id: "sky",
  diagram: "pixel",
  sea: NIGHT[1],
  plate: CHROME.plate,
  plateHi: CHROME.plateHi,
  border: CHROME.rim,
  ink: CHROME.ink,
  inkSoft: CHROME.inkSoft,
  loud: CHROME.loud,
  loudInk: CHROME.loudInk,
  road: CHROME.highlight,
  roadEdge: CHROME.highlightEdge,
  ring: INK.ring,
  field: CHROME.field,
  shadow: CHROME.shadow,
  rule: CHROME.bevel,
  roseInk: CHROME.ink, // the compass outline + N: cream, the night has no dark ink to spare
  tagFont: FONT,
  signFont: SIGN_FONT,
  bodyFont: FONT,
  crisp: true,
  radius: 0,
  evidence: {
    // the star sprites' mid tones, so the scale bar and legend speak the sky
    champion: { fill: GOLD["3"], stroke: GOLD["1"] },
    provisional: { fill: CHROME.plateHi, stroke: LILAC["2"], dash: "2 2" },
    trained: { fill: MINT["3"], stroke: MINT["1"] },
    untrained: { fill: GREY["2"], stroke: GREY["1"] },
  },
};
