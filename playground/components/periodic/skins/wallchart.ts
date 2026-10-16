import type { PeriodicSkin } from "./types";

// Wall chart: a printed classroom poster — parchment, oxblood ink, serif
// symbols in chemistry case, families printed as soft pastel blocks (atoms
// the full tint, compounds a lighter pull of the same ink).
export const wallchart: PeriodicSkin = {
  id: "wallchart",
  label: "Wall chart",
  color: {
    paper: "#efe3c8",      // parchment
    paperDeep: "#e4d4b0",  // shaded fold
    ink: "#2b1d12",        // printer's black-brown
    inkDim: "#7a5c3e",     // sepia annotation
    line: "#5b2320",       // oxblood rule
    lineFaint: "#c9b58e",  // hairline
    accent: "#8a1f1c",     // oxblood markup
  },
  family: {
    perception: "#c9d5ab",      // sage
    sequence: "#b7cbd8",        // slate blue
    generative: "#e3bdb0",      // rose clay
    representation: "#ead095",  // straw
    structure: "#cdc1db",       // lilac
    decision: "#afd2c8",        // celadon
  },
  type: {
    display: "--font-instrument",  // Instrument Serif (one weight)
    body: "--font-draft",
    symbol: "--font-instrument",
    name: "--font-instrument",     // the poster's serif: names read as words, not identifiers
    singleWeight: true,
    titleTracking: "0.02em",
    size: {
      title: "2.75rem", symbolAtom: "30px", symbolCompound: "26px", symbolReaction: "18px",
      number: "10px", name: "14px", nameLeading: "1", nameReaction: "12px", small: "11px", famhead: "14px",
    },
  },
  space: { row: "5.25rem", reactionRow: "4.75rem", stackCell: "5rem", gap: "4px", tilePad: "4px 5px 5px", tabs: "2.75rem" },
  border: {
    atom: "1.5px solid var(--line)",
    compound: "1px solid color-mix(in srgb, var(--line) 35%, var(--paper))",
    reaction: "1px dashed color-mix(in srgb, var(--line) 35%, var(--paper))",
    famRule: "0",
    famBand: "5px",
  },
  famhead: { rule: "below", gap: "8px" },
  fill: { atom: "100%", compound: "50%", reaction: "0%", under: "var(--paper)" },
  compoundSymbol: "var(--ink)",
  radius: { tile: "1px" },
  shadow: { tile: "0 1px 0 rgba(43, 29, 18, 0.12)" },  // a printed block's slight ink spread
  backdrop: {
    image: [
      "radial-gradient(ellipse at 50% 30%, rgba(255, 250, 230, 0.6), rgba(190, 165, 120, 0.5))",
      "repeating-linear-gradient(0deg, transparent 0 30px, rgba(120, 90, 50, 0.05) 30px 31px)",
    ].join(", "),
    size: "100% 100%, 100% 100%",
    grain: 0.07,
  },
  interaction: "accent",
  chrome: { drawerZoom: 1, stampTilt: "-2deg" },
  motion: { enter: 0.3, rowStagger: 0.07, colStagger: 0.015, reactionStart: 0.55, reactionStagger: 0.02 },
  voice: {
    loading: "Printing the chart…",
    offline: "The zoo’s API is not answering. Start it with python main.py serve; retrying every 3 s.",
  },
  masthead: "title",
};
