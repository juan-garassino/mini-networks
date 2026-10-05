// The Transit design's ONE tokens module: every colour, size, weight, gap and
// timing the map and its page use. Components read these (or the CSS vars
// SHEET_VARS paints on <html>), never literals. Pure data, no DOM.

/** The sheet: a neutral porcelain page so the pastel lines carry all the colour. */
export const SHEET = {
  paper: "#f3f4f1",
  paperDeep: "#e8eae5",
  ink: "#1f2327",
  inkDim: "#686d71",
  lineFaint: "#d5d8d2",
  /** hover / focus on a name: the one warm accent */
  accent: "#cf4f3e",
  /** the key's neutral sample track (a line of no family) */
  sampleTrack: "#9a9d9f",
  /** the letter on an origin bullet: ink, not white — white on these pastels
   * fails contrast at bullet size (mustard ~1.9:1); ink holds 6:1 or more */
  bulletInk: "#1f2327",
  /** a line with no colour of its own (a family not in LINE_COLORS) */
  unknownLine: "#888888",
} as const;

/** One line per family. Pastel signage: told apart at a glance, never loud on the
 * neutral sheet; each holds an ink letter on its origin bullet. */
export const LINE_COLORS: Record<string, string> = {
  perception: "#e2826d",
  sequence: "#6b8fd0",
  generative: "#5fae86",
  representation: "#a28bd2",
  structure: "#d9a95a",
  decision: "#4fb0a9",
};

/** The page's CSS vars (shared chrome: title block, drawer, page body read these). */
export const SHEET_VARS: Record<string, string> = {
  "--paper": SHEET.paper,
  "--paper-deep": SHEET.paperDeep,
  "--ink": SHEET.ink,
  "--ink-dim": SHEET.inkDim,
  "--line": SHEET.ink,
  "--line-faint": SHEET.lineFaint,
  "--redline": SHEET.accent,
};

/** Paint the sheet tokens on an element (the page's <html>); returns the undo. */
export function applySheet(el: HTMLElement): () => void {
  for (const [k, v] of Object.entries(SHEET_VARS)) el.style.setProperty(k, v);
  return () => { for (const k of Object.keys(SHEET_VARS)) el.style.removeProperty(k); };
}

/** In SVG, read colours through the vars so the chrome and the map never drift. */
export const INK = "var(--ink)";
export const INK_DIM = "var(--ink-dim)";
export const PAPER = "var(--paper)";
export const LINE_FAINT = "var(--line-faint)";

/** Type: one family (Jost, a geometric sans in the Johnston/Futura lineage). */
export const TYPE = {
  family: "var(--font-jost), sans-serif",
  /** station name (px); the label metrics below are measured at this size */
  label: 13,
  /** district (area) name */
  district: 15,
  districtOpacity: 0.75,
  districtTracking: "0.02em",
  /** cartouche title / sentence / key rows */
  title: 21,
  note: 12,
  key: 12.5,
  /** letter in an origin bullet (map) / service bullet (list) */
  bulletLetter: 11,
  serviceLetter: 10,
  /** the key's column heads (models / stops) */
  keyHead: 11,
  regular: 400,
  semibold: 600,
  bold: 700,
  /** Jost advance widths, average per glyph at 1px (lowercase names) */
  emRegular: 0.5,
  emBold: 0.535,
  emDistrict: 0.56,
  /** cap+x height above / descender below the baseline at `label` px */
  ascent: 9.5,
  descent: 3.5,
} as const;

/** The drafting grid and the track. */
export const GRID = {
  /** pitch (px): every station and corner sits on it */
  pitch: 20,
  /** the one bend radius */
  corner: 14,
  track: 6,
} as const;

/** Mark geometry (px). `extent` = how far the mark reaches from the station centre
 * towards its label; the label always clears it by `labelClear`. */
export const MARK = {
  origin: { r: 10.5, halo: 2.5, extent: 11.75 },
  ring: { r: 7.5, stroke: 2.6, extent: 8.8 },
  tick: { len: 8.5, w: 4.5, extent: 8.5 },
  /** a terminus bar: the tick drawn across the track end, round-capped */
  terminus: { half: 8.5, extent: 10.75 },
  train: { w: 18, h: 9, stroke: 2.2, windowW: 4, windowH: 3.2 },
  /** clear space between a mark's extent and its name */
  labelClear: 4.5,
  /** the transparent hit area's margin around mark + name */
  hitPad: 3,
} as const;

/** Spacing inside the in-map cartouche and the page. */
export const SPACE = {
  cartouchePad: 18,
  /** the key's line rows: name at +keyName, the two counts end at +keyModels / +keyStops */
  keyName: 36,
  keyModels: 150,
  keyStops: 184,
  /** the mark column's left edge */
  cartoucheColB: 204,
  /** the key rows start this far below the cartouche top (under the column heads) */
  keyTop: 120,
  cartoucheRadius: 3,
  cartoucheStroke: 1.5,
  keyRow: 19,
  glyphRow: 22,
  /** phone: the map keeps this legible width and pans inside its frame */
  phoneMinWidth: 1180,
  /** desktop: the page column */
  maxWidth: 1480,
  /** phone: the pan frame fades out over this many px at each side, so a name
   * running off the frame dims away instead of being chopped mid-letter */
  frameFade: 18,
  /** the sheet tab row under the map (tabs.tsx) */
  tabsH: 40,
} as const;

/** Motion: one train per line; nothing else moves on its own. */
export const MOTION = {
  /** px per second along the path */
  trainSpeed: 46,
  trainMinDur: 6,
  /** where a frozen train parks along its path (still / reduced motion) */
  trainStillT: 0.42,
  /** fade in / out at the ends of each run */
  trainFade: { values: "0;1;1;0", keyTimes: "0;0.05;0.93;1" },
  /** a hover on a through service dims the rest of the map */
  dimMs: 160,
  dimTo: 0.28,
  dimStation: 0.3,
} as const;
