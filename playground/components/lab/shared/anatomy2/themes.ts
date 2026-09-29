// Two looks for the same truthful structure. Every diagram paints ONLY with
// these tokens, so a theme is a palette swap plus a couple of flags.
//
// pixel — the owner's reference (2026-09-29): near-black ground, one royal-blue
//         accent for the network, dim slate dotted wiring, a pink loss
//         diamond. Data (images, noise, heat) uses an 8-step indigo→ember→cream
//         ramp so it never competes with the blue of the network.
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
    name: "pixel",
    ground: "#0a0c12",
    panel: "#0e121c",
    frame: "#26324d",
    wire: "#2a3754",
    wireHot: "#6f8fe8",
    accent: "#1f45c4",
    accentHi: "#4a78ff",
    accentLo: "#132c85",
    text: "#6a7898",
    textDim: "#3d4966",
    loss: "#e8315b",
    lossHi: "#ff9ab2",
    shadow: null,
    ramp: ["#0d0b24", "#271457", "#4f1a7a", "#86267a", "#c23d63", "#ec6a3f", "#f8a93f", "#fde9a8"],
    heat: ["#0e121c", "#15214a", "#1c3187", "#2448c4", "#3d6cf5", "#79a0ff", "#b9ccff", "#eef3ff"],
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
