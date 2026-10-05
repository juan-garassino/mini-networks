// Every non-colour decision of the diagram kit in one place. Colours are the
// Theme in themes.ts (a theme is a palette swap); this file is the rest:
// the art grid, type, spacing, borders and motion. Diagrams draw in art
// pixels (ART); the page chrome around them works in CSS px (SPACE, TYPE)
// and sets its own type in the same 5×7 pixel face via <PixelLabel>.
import { FONT_H } from "./pixel-font";
import { MAX_FPS } from "./tick";

export { THEMES, type Theme, type ThemeName } from "./themes";

/** The art grid (viewBox units). See STYLE.md §1. */
export const ART = {
  full: { w: 560, h: 316 },  // every full diagram
  cardW: 190,                // every card; heights 100–124
  scale: 2,                  // CSS px per art px at the canonical size
  row: 10,                   // text row pitch: 7-px glyph + 3
  glyph: FONT_H,             // cap height of the pixel face
  descender: 2,              // rows below the baseline (g, p, y)
} as const;

/** Pixel-face sizes for chrome, as integer multiples of one font pixel. */
export const PIXEL = {
  wordmark: 3,   // "how it works"
  name: 4,       // the model name heading a plate
  head: 2,       // section and group heads
  card: 2,       // the name over a card on the review sheet
} as const;

/** Prose face (truth captions, ledes, hints) and its scale in CSS px. */
export const TYPE = {
  prose: "var(--font-anatomy-prose), system-ui, sans-serif",
  lede: { size: 19, line: 1.4 },     // the one-line "what it does" under a name
  body: { size: 15, line: 1.6 },     // the truth paragraph
  nav: { size: 14, line: 1.3 },      // index entries
  hint: { size: 13, line: 1.45 },    // keyboard hints, scrubber label
  small: { size: 12, line: 1.4 },    // under a card (badge + open link)
  measure: "68ch",                   // longest prose line
} as const;

/** Spacing in CSS px; an 8-px rhythm with the 16-px phone gutter. */
export const SPACE = {
  gutter: 16,     // page side margin
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 40,
  index: 240,     // desktop index column width
  card: 380,      // card column = ART.cardW × ART.scale
} as const;

/** Lines: everything is square-cornered pixel work; borders are 1 or 2 px. */
export const BORDER = {
  hair: 1,
  focus: 2,
  radius: 0,
} as const;

/** Motion: flip-book only (tick.ts). The chrome itself never animates. */
export const MOTION = {
  maxFps: MAX_FPS,
  stillT: 380,    // diffusion's t under still=1 and on cards
} as const;
