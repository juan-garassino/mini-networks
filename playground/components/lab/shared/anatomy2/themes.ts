// Two looks for the same truthful structure. Every diagram paints ONLY with
// these tokens, so a theme is a palette swap plus a couple of flags.
//
// pixel — pastel on plum dusk (2026-10-04, was royal blue on near-black):
//         periwinkle network, dim lilac dotted wiring, mint for the introduced
//         idea, a rose loss diamond. Data (images, noise) uses an 8-step
//         plum→rose→peach→cream ramp; attention/similarity a periwinkle heat.
// paper — the same drawing on a cardboard panel: cut-paper blocks with a hard
//         offset shadow, ink wiring, data printed in ink on cream stock.

export type ThemeName = "pixel" | "paper";

export interface Theme {
  name: ThemeName;
  ground: string;       // page/panel background
  panel: string;        // inset panels (embedding box, legends)
  frame: string;        // thumbnail + panel outlines
  wire: string;         // dotted wiring (dim)
  wireHot: string;      // wiring that carries the current state
  accent: string;       // network blocks
  accentHi: string;     // block highlight edge / live detail
  accentLo: string;     // block shadow edge
  text: string;         // labels
  textDim: string;      // secondary labels
  loss: string;         // the loss diamond
  lossHi: string;
  shadow: string | null; // cut-paper drop shadow (paper only)
  /** 8 colours, value −1 → ramp[0] … +1 → ramp[7]. */
  ramp: readonly string[];
  /** heat ramp for attention / similarity (0 → 1). */
  heat: readonly string[];
}

export const THEMES: Record<ThemeName, Theme> = {
  pixel: {
    // 2026-10-04 owner: "a palette more pastel" — the same roles, softened:
    // a plum-dusk ground, periwinkle network, mint for the one introduced
    // idea, a rose loss, and a plum→rose→peach→cream data ramp that sits
    // next to the painted map's parchment instead of shouting over it.
    name: "pixel",
    ground: "#1c1a2b",
    panel: "#24223a",
    frame: "#46435f",
    wire: "#4b4868",
    wireHot: "#9fe6cf",
    accent: "#8c9fe6",
    accentHi: "#c6d0fa",
    accentLo: "#5d6aa8",
    text: "#b3aecb",
    textDim: "#726d8e",
    loss: "#f4a0b0",
    lossHi: "#ffd6de",
    shadow: null,
    ramp: ["#1f1b33", "#3b2f5c", "#5e4682", "#8a5f9e", "#b97fa8", "#e0a3a8", "#f4c9a8", "#fdeccb"],
    heat: ["#24223a", "#2e3358", "#3c4a80", "#5267a8", "#7389cc", "#9eb0e6", "#cad5f6", "#eef2ff"],
  },
  paper: {
    name: "paper",
    ground: "#c9ab7c",
    panel: "#ecdcbc",
    frame: "#5b4327",
    wire: "#7d6040",
    wireHot: "#1d2f6b",
    accent: "#2c4fa8",
    accentHi: "#5d7fd0",
    accentLo: "#1a3170",
    text: "#3b2a17",
    textDim: "#7a5d3b",
    loss: "#c23a22",
    lossHi: "#f08a62",
    shadow: "#8a6c45",
    ramp: ["#f4e9d2", "#e6d6b6", "#cdb994", "#a99473", "#7e6c55", "#57493a", "#352c25", "#1b1714"],
    heat: ["#ecdcbc", "#e2c79b", "#d8a877", "#c98452", "#b45f36", "#94412a", "#6b2c20", "#3f1a14"],
  },
};

export function rampIndex(v: number): number {
  const q = Math.floor(((Math.max(-1, Math.min(1, v)) + 1) / 2) * 8);
  return Math.max(0, Math.min(7, q));
}

export function heatIndex(v: number): number {
  return Math.max(0, Math.min(7, Math.floor(Math.max(0, Math.min(1, v)) * 8)));
}
