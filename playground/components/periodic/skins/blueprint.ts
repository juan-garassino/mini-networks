import type { PeriodicSkin } from "./types";

// Blueprint: a cyanotype drawing — chalk-white line-work on Prussian blue,
// drafting caps, single ink. Family is told by column block only.
export const blueprint: PeriodicSkin = {
  id: "blueprint",
  label: "Blueprint",
  color: {
    paper: "#0a2540",      // Prussian blue sheet
    paperDeep: "#071b30",  // darker field under tiles
    ink: "#dff3ff",        // chalk-white ink
    inkDim: "#7fb6d9",     // faded annotation ink
    line: "#9fdcf5",       // pen line-work
    lineFaint: "#1d4468",  // construction lines / grid
    accent: "#f2c27e",     // soft amber markup (was #ffb454 — shouted over the white ink)
  },
  family: null,
  type: {
    display: "--font-display",  // Big Shoulders
    body: "--font-draft",       // Martian Mono
    name: "--font-display",     // Big Shoulders: condensed, so names stay words at 13 px
    singleWeight: false,
    textCase: "uppercase",
    titleTracking: "0.14em",
    size: {
      title: "2.75rem", symbolAtom: "27px", symbolCompound: "23px", symbolReaction: "18px",
      number: "10px", name: "13px", nameLeading: "1.05", nameReaction: "12px", small: "11px", famhead: "14px",
    },
  },
  space: { row: "5.25rem", reactionRow: "4.75rem", stackCell: "5rem", gap: "4px", tilePad: "4px 5px 5px" },
  border: {
    atom: "1.5px solid var(--line)",
    compound: "1px solid var(--line-faint)",
    reaction: "1px dashed var(--line-faint)",
    famRule: "1px solid var(--line-faint)",
    famBand: "0px",
  },
  famhead: { numeral: false, textCase: "none", rule: "above", gap: "8px" },
  fill: { atom: "80%", compound: "40%", reaction: "30%", under: "transparent" },
  compoundSymbol: "var(--ink-dim)",
  radius: { tile: "0px" },
  shadow: { tile: "none" },
  backdrop: {
    // vignette, then major (96px) and minor (24px) drafting grid
    image: [
      "radial-gradient(ellipse at 50% 40%, rgba(20, 60, 100, 0.35), rgba(4, 14, 26, 0.55))",
      "linear-gradient(#1d4468 1px, transparent 1px)",
      "linear-gradient(90deg, #1d4468 1px, transparent 1px)",
      "linear-gradient(rgba(29, 68, 104, 0.35) 1px, transparent 1px)",
      "linear-gradient(90deg, rgba(29, 68, 104, 0.35) 1px, transparent 1px)",
    ].join(", "),
    size: "100% 100%, 96px 96px, 96px 96px, 24px 24px, 24px 24px",
    grain: 0.07,
  },
  interaction: "accent",
  chrome: { zoom: 1, drawerZoom: 1, stampTilt: "-2deg" },
  motion: { enter: 0.3, rowStagger: 0.07, colStagger: 0.015, reactionStart: 0.55, reactionStagger: 0.02 },
  masthead: "title",
};
