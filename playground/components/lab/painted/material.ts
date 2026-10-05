// The painted kit's ONE tokens module: every colour, face, size, gap, border,
// shadow and timing the chrome (corners/, drawer, card, map plate, overlay,
// skin) reads. Components never invent a literal; DESIGN.md has the tables.
// Two kinds of token live here:
//   · the kit's shared scale (TYPE, SPACE, CORNER, DRAWER, MOTION, CHROME):
//     one rhythm for every material;
//   · a Material per map: the inks, faces and plate construction. The pixel
//     material is cut from the map's own 128-colour palette (index in the
//     comment); the paper material from the painter's cardstock and sepia.
// The art modules (pixel-art.ts, life.ts, true-map.tsx, sea-furniture.ts,
// stage.tsx, pixel-icon.tsx) are not chrome: their colours are the pixel
// map's own palette ramps, kept beside the sprites they draw.
// Pure data (and one tiny element helper), so node tests may import it.
import { createElement, Fragment, type ReactNode } from "react";
import type { EvidenceState } from "@/components/lab/shared/card-model";
import type { MapId } from "./anchors";

export type MaterialId = MapId | "sky";

export interface Material {
  id: MaterialId;
  /** which anatomy diagram theme the drawer uses */
  diagram: "pixel" | "paper";
  sea: string;          // page colour beyond the image edge
  plate: string;        // tag / sign fill
  plateHi: string;      // hovered tag; the sheets' ground (#rrggbb: the drawer's fade appends alpha)
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
  /** the sign voice's optical size against the shared TYPE scale (default 1):
   * a small-caps face sets lower-case names at its x-height, so it runs larger */
  signScale?: number;
  /** a model's name, wherever it is set in the sign voice (default signFont):
   * a name is data, so it keeps its lower-case identity — never small caps */
  nameFont?: string;
  /** font-variant-numeric for the whole skin (default: the face's own figures) */
  numeric?: string;
  /** cut cardstock (paper only): a hard offset drop + a printed laid-paper
   * texture, both CSS-only, so every HTML plate reads as one stock */
  card?: {
    /** the drop's ink; `drop` is the box-shadow, `dropFilter` the same lift for an SVG */
    dropInk: string;
    drop: string;
    dropFilter: string;
    /** the drawer's edge against the map: the drop, cast left */
    dropLeft: string;
    /** the pressed hairline just inside a plate's border */
    inset: string;
    /** a plate's printed stock; `sheet` = the same for the large sheets (drawer,
     * enlarged diagram), its tone laid once over the viewport's height so a
     * sticky header and the sheet under it share one tone, seamless */
    grain: string;
    sheet: string;
  };
  evidence: Record<EvidenceState, { fill: string; stroke: string; dash?: string }>;
}

/** The SVG overlay's own marks (image renders: the paper map, and the pixel
 * map's clean / grid / baked images). */
export interface Marks {
  plateTop: string;     // a painter's plate re-cut: gradient top → bottom
  plateBottom: string;
  plateEdge: string;    // its border and its hard drop
  plateDropAlpha: number;
  veil: string;         // a plate off the lineage, dimmed without opacity
  veilAlpha: number;
  washAlpha: number;    // the focus fade over the painting outside the land in focus
  refill: { subtitle: string; count: string };  // parchment over the painter's live numbers
  sealEdge: string;     // the land's wax seal
  sealDrop: string;
  star: string;         // a champion marker's star
  pip: string;          // a trained marker's centre
  halo: string;         // under the selection ring
  tagBevel: string;     // pixel tags' lower bevel
  sign: { drop: string; rule: string };          // pixel image renders' land signs
  critter: { body: string; feet: string; tip: string; eye: string; pupil: string; shadow: string };
}

export type MapMaterial = Material & { id: MapId; marks: Marks };

// ——— the shared scale ————————————————————————————————————————————————

/** One type scale, CSS px. The card reads top to bottom on the first five;
 * the rest are the chrome's few other voices. */
export const TYPE = {
  // the drawer card
  name: 28,          // the model's name (sign voice, 700)
  head: 14,          // a section header, ruled to the edge
  body: 15,          // reading text, 1.4
  note: 13,          // glosses, the road's end, a gate row, 1.35
  meta: 12,          // where it is, sub-labels, "you are here"
  chip: 14,          // anything you press in the card; the introduced idea; a pipeline's name
  stamp: 13,         // the evidence stamp
  badge: 11,         // a section's count
  // the chrome
  display: 32,       // the cartouche title
  displaySmall: 20,  // the cartouche on a phone, or in focus mode
  displayTiny: 16,   // the focus-mode cartouche on a phone
  lead: 16,          // the cartouche sentence; a button; the search field
  plateTitle: 15,    // a corner plate's or the map plate's title
  link: 14,          // "Whole map"; the legend rows; a tag; the hover label
  tab: 20,           // a sheet tab
  tabSmall: 14,
  aside: 14,         // the "map only" / dev tabs
  asideSmall: 12,
  button: 13,        // the drawer's and the map plate's buttons
  sheetTitle: 24,    // the enlarged diagram's title
  caption: 12,       // the map plate's caption
} as const;

/** The card's rhythm, CSS px: an 8-px step. */
export const SPACE = {
  section: 24,       // between the card's sections
  label: 10,         // a section header to its content
  sub: 6,            // a sub-label to its chips
  lede: 16,          // the stamp row to the description
} as const;

/** The four corners: one outer margin, one inner padding, one side column. */
export const CORNER = {
  w: 324,            // the side plates' column (cartouche, legend / minimap)
  pad: 12,           // every corner plate's inner padding
  wQuiet: 176,       // focus mode: the minimap's small inset
  padQuiet: 6,       // focus mode: half padding
  margin: 20,        // from sm up (12 on a phone: the skin's left-3 / sm:left-5)
  stack: 12,         // compass above the scale bar
  stackQuiet: 8,
  wPhone: 168,       // the phone cartouche
} as const;

/** The reading panel. */
export const DRAWER = {
  w: 440,            // the diagram in the card
  wMap: 336,         // diagramOn="map": text only, a ~290-px measure (≈ 40 characters)
  snap: { peek: 0.2, half: 0.5, full: 0.88 },
  measure: "19em",   // running text: ≈ 38 characters at any of the scale's sizes
} as const;

/** Every timing. Interface motion is stepped (steps(n)), never eased, except
 * the phone sheet's height; all of it is frozen under still=1 and reduced
 * motion (LabMotion + the keyframes' media query). */
export const MOTION = {
  stamp: { ms: 160, steps: 2, delay: 120, stagger: 90 },  // the load moment: corners stamp on in turn
  restamp: { ms: 140, steps: 2, stagger: 40 },            // a focus-mode change re-stamps them in place
  plateFade: { ms: 180, steps: 3 },                        // the map plate on landing
  sheet: "220ms ease",                                     // the phone sheet's height
  march: "0.9s linear infinite",                           // a lit lineage road's dashes (image renders)
  pulse: "1.4s ease-in-out infinite",                      // the selection ring
  hopMs: 380,                                              // the critter's hop
} as const;

/** Chrome inks every material shares. */
export const CHROME = {
  minimapVeil: "rgba(34,19,22,.35)",   // what lies outside the minimap's view box
} as const;

/** a size in the material's sign voice */
export const sign = (m: Material, px: number) => Math.round(px * (m.signScale ?? 1));
/** a model's name inside a sign-voice title: its own face, its own case */
export const nameFace = (m: Material) => m.nameFont ?? m.signFont;
/** "How <name> works" in the sign voice, the name in its own face (a material
 * without a nameFont keeps one unbroken run of text) */
export const howItWorks = (m: Material, name: string): ReactNode =>
  m.nameFont ? createElement(Fragment, null, "How ", createElement("span", { style: { fontFamily: m.nameFont } }, name), " works") : `How ${name} works`;

// ——— faces ———————————————————————————————————————————————————————————

// The pixel map's one face: Pixelify Sans for letters, with clearer pixel
// digits laid over it for 0-9 only (unicode-range faces: VT323 regular, Jersey
// 15 bold; app/lab/painted/layout.tsx): Pixelify's 5 reads as S and its 8 as
// B, and numbers are data. Where a route does not load the digits family
// (the var is unset), this falls back to Pixelify alone.
const PIXEL_FONT = "var(--font-pixel-digits, var(--font-pixel)), var(--font-pixel), ui-monospace, monospace";
// The paper map's two faces: IM Fell English SC for signs, Alegreya to read.
// Fell's figures are old-style, its 1 a small-cap I ("Champion vi"), so its
// digits come from Alegreya's (unicode-range, layout.tsx) and the whole skin
// asks for lining figures (`numeric`): 0.150 stands on the line like a number.
const FELL = "var(--font-paper-digits, var(--font-fell)), var(--font-fell), Georgia, serif";
const ALEGREYA = "var(--font-alegreya), Georgia, serif";

// ——— the two maps ——————————————————————————————————————————————————————

const PAPER_DROP_INK = "rgba(58,38,22,.62)";
// laid lines (the wire marks of handmade stock) + a sparse fibre stipple, then a soft sheet tone
const PAPER_STOCK = [
  "repeating-linear-gradient(0deg, rgba(122,90,58,.055) 0 1px, transparent 1px 4px)",
  "radial-gradient(rgba(90,62,36,.10) .6px, transparent 1px) 0 0 / 5px 5px",
  "radial-gradient(rgba(90,62,36,.07) .6px, transparent 1px) 2px 3px / 7px 7px",
];
const PAPER_TONE = "linear-gradient(180deg, rgba(255,255,255,.35), rgba(201,165,112,.18))";

export const MATERIALS: Record<MapId, MapMaterial> = {
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
    roseInk: "#3a1d2a",   // 17  the compass in the map's darkest ink
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
    marks: {
      plateTop: "#f4ddb6", plateBottom: "#e5c595", plateEdge: "#3a2616", plateDropAlpha: 0.6,
      veil: "#e9dcc4", veilAlpha: 0.55, washAlpha: 0.5,
      refill: { subtitle: "#ecd3ae", count: "#dfc7a2" },
      sealEdge: "#4a1a10", sealDrop: "#2b1d12",
      star: "#6b1d1d", pip: "#e9f7df", halo: "#fff8e6", tagBevel: "#e3cf9f",
      sign: { drop: "#3b1a10", rule: "#d9bf86" },
      critter: { body: "#7fd0ff", feet: "#2e2a3a", tip: "#ffd23f", eye: "#fff", pupil: "#1b1b28", shadow: "#000" },
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
    tagFont: ALEGREYA,
    signFont: FELL,
    bodyFont: ALEGREYA,
    crisp: false,
    radius: 3,
    // Fell SC sets a lower-case name in small caps, at its x-height: ×1.2 gives
    // it the pixel face's presence at the same scale step
    signScale: 1.2,
    nameFont: ALEGREYA,
    numeric: "lining-nums",
    card: {
      // hard, unblurred: a sheet lifted a few mm off the painting
      dropInk: PAPER_DROP_INK,
      drop: `3px 3px 0 ${PAPER_DROP_INK}`,
      dropFilter: `drop-shadow(2px 2px 0 ${PAPER_DROP_INK})`,
      dropLeft: `-3px 0 0 ${PAPER_DROP_INK}`,
      inset: "rgba(255,248,230,.55)",
      grain: [...PAPER_STOCK, PAPER_TONE].join(", "),
      sheet: [...PAPER_STOCK, `${PAPER_TONE} 0 0 / 100% 100vh`].join(", "),
    },
    evidence: {
      champion: { fill: "#e9b52c", stroke: "#4a3322" },
      provisional: { fill: "#f1ddb8", stroke: "#4a3322", dash: "2.5 2" },
      trained: { fill: "#5f9e5a", stroke: "#2c4a28" },
      untrained: { fill: "#cbbfa8", stroke: "#7b6d57" },
    },
    marks: {
      plateTop: "#f4ddb6", plateBottom: "#e5c595", plateEdge: "#3a2616", plateDropAlpha: 0.6,
      veil: "#e9dcc4", veilAlpha: 0.55, washAlpha: 0.5,
      refill: { subtitle: "#ecd3ae", count: "#dfc7a2" },
      sealEdge: "#4a1a10", sealDrop: "#2b1d12",
      star: "#4a3322", pip: "#f4fbef", halo: "#fff8e6", tagBevel: "#e3cf9f",
      sign: { drop: "#3b1a10", rule: "#d9bf86" },
      critter: { body: "#f4d8a6", feet: "#2e2a3a", tip: "#ffd23f", eye: "#fff", pupil: "#1b1b28", shadow: "#000" },
    },
  },
};

// ——— words ———————————————————————————————————————————————————————————

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
