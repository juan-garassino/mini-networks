import type { PeriodicSkin } from "./types";

// Terminal: the same table printed by a phosphor console — VT323 throughout,
// box cells instead of tiles, hover/focus as inverse video, a shell prompt
// for a masthead. Single ink: family is told by column block only.
export const terminal: PeriodicSkin = {
  id: "terminal",
  label: "Terminal",
  color: {
    paper: "#050805",      // tube black
    paperDeep: "#020302",
    ink: "#7dff9a",        // P1 phosphor
    inkDim: "#3f9a5a",     // dim phosphor (was #2e7a44 — too faint to read the names)
    line: "#4ddc72",
    lineFaint: "#174a28",
    accent: "#e9d47e",     // soft amber cursor
  },
  family: null,
  type: {
    display: "--font-vt",
    body: "--font-vt",
    singleWeight: true,
    textCase: "none",
    titleTracking: "0.05em",
    size: {
      // VT323 sits ~25% smaller than Martian Mono at the same px
      title: "2.5rem", symbolAtom: "34px", symbolCompound: "30px", symbolReaction: "22px",
      number: "13px", name: "13px", nameFit: "19cqi", small: "14px", famhead: "16px",
    },
  },
  space: { row: "5.25rem", reactionRow: "5.5rem", stackCell: "5rem", gap: "4px", tilePad: "3px 5px 4px" },  // three VT323 name lines need the taller f-block row
  border: {
    atom: "1px solid var(--line)",
    compound: "1px solid var(--line-faint)",
    reaction: "1px dashed var(--line-faint)",
    famRule: "1px dashed var(--line-faint)",
    famBand: "0px",
  },
  fill: { atom: "0%", compound: "0%", reaction: "0%", under: "transparent" },
  compoundSymbol: "var(--ink-dim)",
  radius: { tile: "0px" },
  shadow: { tile: "none" },
  backdrop: {
    image: "repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.35) 0 2px, transparent 2px 4px)",  // scanlines
    size: "100% 100%",
    grain: 0.07,
  },
  interaction: "inverse",
  // the chrome keeps Tailwind px sizes, so it zooms instead of re-sizing
  chrome: { zoom: 1.4, drawerZoom: 1.3, stampTilt: "0deg" },
  motion: { enter: 0.18, rowStagger: 0.05, colStagger: 0.01, reactionStart: 0.4, reactionStagger: 0.015 },
  masthead: "prompt",
};
