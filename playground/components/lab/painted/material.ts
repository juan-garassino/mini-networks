// Material tokens for the live layer, one per owner map. Every component
// renders both: the pixel map gets parchment plates cut from its own 128-colour
// palette (1-art-px maroon borders, Pixelify Sans); the paper map gets painted
import type { EvidenceState } from "@/components/lab/shared/card-model";
import type { MapId } from "./anchors";

export type MaterialId = MapId | "sky";

export interface Material {
  id: MaterialId;
  /** which anatomy diagram theme the drawer uses */
  diagram: "pixel" | "paper";
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
  field: string;        // input fill
  shadow: string;       // hard plate shadow (pixel) / soft (paper)
  rule: string;         // thin inner rule on plates
  tagFont: string;
  signFont: string;
  bodyFont: string;
  crisp: boolean;       // shape-rendering crispEdges + square caps
  /** the compass rose's outline + N (default: dark ink on pixel, the border on paper) */
  roseInk?: string;
  radius: number;       // plate corner radius (image px at 1×)
  /** cut cardstock (paper only): a hard offset drop + a printed laid-paper
   * texture, both CSS-only, so every HTML plate reads as one stock */
  card?: { drop: string; grain: string };
  evidence: Record<EvidenceState, { fill: string; stroke: string; dash?: string }>;
}

// The pixel map's one face: Pixelify Sans for letters, with clearer pixel
// digits laid over it for 0-9 only (unicode-range faces: VT323 regular, Jersey
// 15 bold; app/lab/painted/layout.tsx): Pixelify's 5 reads as S and its 8 as
// B, and numbers are data. Where a route does not load the digits family
// (the var is unset), this falls back to Pixelify alone.
const PIXEL_FONT = "var(--font-pixel-digits, var(--font-pixel)), var(--font-pixel), ui-monospace, monospace";

// The night material for /lab/sky: the pixel map's chrome after dark — the
// same plates (1-art-px border, inner bevel, hard shadow, Pixelify, square
// corners), cut from the night's own ramps (components/lab/sky/palette.ts):
// indigo plates, a soft pastel-gold rim, cream ink. The evidence fills are the
// sky's star sprites' mid tones, so the scale bar and legend speak the sky.
const SKY: Material = {
  id: "sky",
  diagram: "pixel",
  sea: "#100f2c",       // NIGHT[1], the open sky
  plate: "#161838",
  plateHi: "#191c42",
  border: "#e2c48a",    // soft pastel gold
  ink: "#ece6f6",
  inkSoft: "#aaa6cc",
  loud: "#e2c48a",
  loudInk: "#141634",
  road: "#f2d08e",      // pastel gold (compass points, highlights)
  roadEdge: "#8a5a2c",
  ring: "#ffe2b0",
  field: "#0d0c26",
  shadow: "#06051a",
  rule: "#2c3068",      // the inner bevel: one step up the night ramp
  roseInk: "#ece6f6",   // the compass's outline + N: cream, the night has no dark ink to spare
  tagFont: "var(--font-pixel), ui-monospace, monospace",
  signFont: "var(--font-pixel), ui-monospace, monospace",
  bodyFont: "var(--font-pixel), ui-monospace, monospace",
  crisp: true,
  radius: 0,
  evidence: {
    champion: { fill: "#f2c25e", stroke: "#8a4e2c" },     // GOLD 3 · 1
    provisional: { fill: "#191c42", stroke: "#aaa4e4", dash: "2 2" }, // LILAC 2
    trained: { fill: "#8edcb4", stroke: "#246a6a" },      // MINT 3 · 1
    untrained: { fill: "#8a8eb2", stroke: "#4a4e74" },    // GREY 2 · 1
  },
};

export const MATERIALS: Record<MaterialId, Material> = {
  // every pixel token is an entry of pixel-map-true.png's 128-colour palette
  // (index in the comment) — the UI is cut from the same world as the map
  pixel: {
    id: "pixel",
    diagram: "pixel",
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
    field: "#fffedb",     // 61
    shadow: "#221316",    // 38
    rule: "#e9deb0",      // 120
    tagFont: PIXEL_FONT,
    signFont: PIXEL_FONT,
    bodyFont: PIXEL_FONT,
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
    diagram: "paper",
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
    field: "#fff7e4",
    shadow: "rgba(43,29,18,.35)",
    rule: "#7a5a3a",
    tagFont: "var(--font-alegreya), Georgia, serif",
    signFont: "var(--font-fell), Georgia, serif",
    bodyFont: "var(--font-alegreya), Georgia, serif",
    crisp: false,
    radius: 3,
    card: {
      // hard, unblurred: a sheet lifted a few mm off the painting
      drop: "3px 3px 0 rgba(58,38,22,.62)",
      // laid lines (the wire marks of handmade stock) + a sparse fibre stipple + a soft sheet tone
      grain: [
        "repeating-linear-gradient(0deg, rgba(122,90,58,.055) 0 1px, transparent 1px 4px)",
        "radial-gradient(rgba(90,62,36,.10) .6px, transparent 1px) 0 0 / 5px 5px",
        "radial-gradient(rgba(90,62,36,.07) .6px, transparent 1px) 2px 3px / 7px 7px",
        "linear-gradient(180deg, rgba(255,255,255,.35), rgba(201,165,112,.18))",
      ].join(", "),
    },
    evidence: {
      champion: { fill: "#e9b52c", stroke: "#4a3322" },
      provisional: { fill: "#f1ddb8", stroke: "#4a3322", dash: "2.5 2" },
      trained: { fill: "#5f9e5a", stroke: "#2c4a28" },
      untrained: { fill: "#cbbfa8", stroke: "#7b6d57" },
    },
  },
  sky: SKY,
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
