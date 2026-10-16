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
    symbol: "--font-vt",
    name: "--font-vt",
    singleWeight: true,
    titleTracking: "0.05em",
    size: {
      // VT323 sits ~25% smaller than Martian Mono at the same px
      title: "2rem", symbolAtom: "29px", symbolCompound: "25px", symbolReaction: "20px",
      number: "13px", name: "15px", nameLeading: "0.88", nameReaction: "14px", small: "14px", famhead: "16px",
    },
  },
  // rows sized so the whole sheet, f-block included, fits a 1440×900 screen
  space: { row: "4.75rem", reactionRow: "5rem", stackCell: "5rem", gap: "4px", tilePad: "3px 3px 4px", tabs: "2.75rem" },
  border: {
    atom: "1px solid var(--line)",
    compound: "1px solid var(--line-faint)",
    reaction: "1px dashed var(--line-faint)",
    famRule: "1px dashed var(--line-faint)",
    famBand: "0px",
  },
  famhead: { rule: "below", gap: "12px" },
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
  // the spec-sheet drawer keeps Tailwind px sizes, so it zooms instead of re-sizing
  chrome: { drawerZoom: 1.3, stampTilt: "0deg" },
  motion: { enter: 0.18, rowStagger: 0.05, colStagger: 0.01, reactionStart: 0.4, reactionStagger: 0.015 },
  voice: {
    loading: "reading /web/taxonomy",
    offline: "error: the zoo’s API is not answering (start it: python main.py serve). retrying every 3 s",
  },
  masthead: "prompt",
};
