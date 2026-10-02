// Per-map look for the live layer: the pixel map gets parchment plates with a
// 1-art-px maroon border in Pixelify Sans (crisp, square); the paper map gets
// softer painted plates in IM Fell / Alegreya that match the painter's tags.
import type { EvidenceState } from "@/components/lab/shared/card-model";
import type { MapId } from "./anchors";

export interface PaintedTheme {
  id: MapId;
  sea: string;          // page colour beyond the image edge
  plate: string;        // tag / sign fill
  plateHi: string;      // hovered tag
  border: string;       // plate border (maroon on pixel)
  ink: string;
  inkSoft: string;
  loud: string;         // selected: plate fill
  loudInk: string;
  road: string;         // lit lineage road
  roadEdge: string;
  ring: string;         // selection ring
  tagFont: string;
  signFont: string;
  bodyFont: string;
  crisp: boolean;       // shape-rendering crispEdges + square caps
  radius: number;       // plate corner radius (image px at 1×)
  evidence: Record<EvidenceState, { fill: string; stroke: string; dash?: string }>;
}

export const THEMES: Record<MapId, PaintedTheme> = {
  // every pixel token is an entry of pixel-map-true.png's 128-colour palette
  // (index in the comment) — the UI is cut from the same world as the map
  pixel: {
    id: "pixel",
    sea: "#f0e1ae",       // 0   the parchment sea
    plate: "#f0e1ae",     // 0
    plateHi: "#fdf4c1",   // 62
    border: "#7a2424",    // 23  maroon ink
    ink: "#3a1d2a",       // 17
    inkSoft: "#715755",   // 15
    loud: "#7a2424",      // 23
    loudInk: "#fdf4c1",   // 62
    road: "#fdc771",      // 8   road-marker gold
    roadEdge: "#7a2424",  // 23
    ring: "#e91c1d",      // 18
    tagFont: "var(--font-pixel), ui-monospace, monospace",
    signFont: "var(--font-pixel), ui-monospace, monospace",
    bodyFont: "var(--font-pixel), ui-monospace, monospace",
    crisp: true,
    radius: 0,
    evidence: {
      champion: { fill: "#fece66", stroke: "#3a1d2a" },           // 112 · 17
      provisional: { fill: "#f0e1ae", stroke: "#7a2424", dash: "2 2" },
      trained: { fill: "#597b29", stroke: "#233424" },            // 9 · 70
      untrained: { fill: "#9a8e88", stroke: "#221316" },          // 42 · 38
    },
  },
  paper: {
    id: "paper",
    sea: "#8fb7c9",
    plate: "#f1ddb8",
    plateHi: "#fff0d2",
    border: "#4a3322",
    ink: "#2b1d12",
    inkSoft: "#6a5139",
    loud: "#7a2e1c",
    loudInk: "#fff4dc",
    road: "#f4b73e",
    roadEdge: "#5a2c12",
    ring: "#c0392b",
    tagFont: "var(--font-alegreya), Georgia, serif",
    signFont: "var(--font-fell), Georgia, serif",
    bodyFont: "var(--font-alegreya), Georgia, serif",
    crisp: false,
    radius: 3,
    evidence: {
      champion: { fill: "#e9b52c", stroke: "#4a3322" },
      provisional: { fill: "#f1ddb8", stroke: "#4a3322", dash: "2.5 2" },
      trained: { fill: "#5f9e5a", stroke: "#2c4a28" },
      untrained: { fill: "#cbbfa8", stroke: "#7b6d57" },
    },
  },
};

export const FAMILY_TITLE: Record<string, string> = {
  perception: "Perception",
  sequence: "Sequence",
  generative: "Generative",
  representation: "Representation",
  structure: "Structure",
  decision: "Decision",
};

/** The paper painter's own sublines, kept when we redraw its plates. */
export const PAPER_SUBLINE: Record<string, string> = {
  perception: "From raw data to understanding",
  representation: "Learning useful representations",
  structure: "Learning from explicit structure",
  sequence: "Modeling temporal and structured sequences",
  decision: "Learning to act and make decisions",
  generative: "Creating new data and worlds",
};

export const PAPER_TITLE: Record<string, string> = {
  perception: "Perception",
  representation: "Representation",
  structure: "Structured Intelligence",
  sequence: "Sequence & State",
  decision: "Decision & Agents",
  generative: "Generative World",
};

export const IMAGES = {
  true: "/local/pixel-map-true.png", // minimap/preview only; the map itself is painted from pixel-map.json
  grid: "/local/pixel-map-grid.png",
  clean: "/local/pixel-map-clean2.png",
  baked: "/local/pixel-map.png",
  paper: "/local/paper-map.png",
} as const;
