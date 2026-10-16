// Skin D · Kawaii DFD — the ONE tokens module. Every flow component reads its colours, type,
// spacing, strokes, radii, shadows, opacities and motion timings from here; nothing else
// hard-codes a value. A data-flow sheet: white paper, one ink for every line and word, colour
// only in the family header strips (soft pastels, never text) and in the one accent that
// lights a lineage. Geometry (track grid, box sizes, label/tag/name px) belongs to the router:
// lib/world/dfd.ts, re-exported below so a renderer needs one import.
import type { CSSProperties } from "react";
import { displayName } from "@/lib/copy";
import { DFD_ATOM_CELL, DFD_LABEL_PX, DFD_NAME_PX, DFD_PAD, DFD_SHELF_PX, DFD_STRIP, DFD_TAG_PX, critterPx } from "@/lib/world/dfd";

export const COLOR = {
  sheet: "#FCFCFA",     // the paper
  card: "#FFFFFF",      // box, chip, drawer and panel fill
  ink: "#2E2742",       // every edge, outline and word
  inkSoft: "#5D5672",   // secondary text (≥ 6:1 on the sheet)
  rule: "#E4E1EA",      // swim-lane rules, drawer dividers, the sheet grabber
  shelf: "#F3F1F6",     // the shelf's tray (standalone atoms), a step off the paper
  head: "#8A84A0",      // column headers (Atoms / Gen n), the phone ruler
  accent: "#2F5FD0",    // the one accent: selection, lit lineage, pipeline order, focus ring
  onAccent: "#FFFFFF",  // text on the accent
  accentWash: "rgba(47,95,208,0.10)", // a chart's area under the line
  gold: "#E2A322",      // champion star
  sweat: "#9CC4F2",     // the provisional face's sweat drop
  hover: "#F3F1F7",     // list row hover
  meterTrack: "#F1EFF5",
  meterPass: "#A5DCC2", // best local run meets the bar
  meterShort: "#F2BE9F", // …is short of it
  axis: "#CFCADB",      // chart axes
} as const;

/** One family = a soft pastel strip, a slightly deeper creature fill and a deep tone (packets
 * leaving that family). Pastels are fills only, never text colours. */
export interface FamilyTone { strip: string; body: string; deep: string; label: string; kind: string }
export const FAMILY: Record<string, FamilyTone> = {
  perception:     { strip: "#D5EEE1", body: "#A5DCC2", deep: "#3E9C78", label: "Perception",     kind: "eyeballs" },
  sequence:       { strip: "#DAE6F7", body: "#AECAEF", deep: "#4A7FC4", label: "Sequence",       kind: "caterpillars" },
  generative:     { strip: "#F8E2D3", body: "#F2BE9F", deep: "#CC6C3A", label: "Generative",     kind: "eggs" },
  representation: { strip: "#E7E0F7", body: "#C7B8EF", deep: "#7A62CF", label: "Representation", kind: "mirror twins" },
  structure:      { strip: "#F3EBC6", body: "#E8D488", deep: "#A9840F", label: "Structure",      kind: "crystals" },
  decision:       { strip: "#F6DCE7", body: "#EEB2CC", deep: "#C04F86", label: "Decision",       kind: "dice bots" },
};
export const UNKNOWN_FAMILY: FamilyTone = { strip: "#ECE9F2", body: "#D2CDE0", deep: "#7D7896", label: "Other", kind: "newcomers" };
export const fam = (f: string): FamilyTone => FAMILY[f] ?? { ...UNKNOWN_FAMILY, label: displayName(f) };

/** Type: one family (M PLUS Rounded 1c, --flow-body) at 500/700/800; Mochiy Pop One
 * (--flow-display) for the page title only. Sizes in px. */
export const TYPE = {
  name: DFD_NAME_PX,        // a model's name in its box (13: the floor at overview scale 1)
  nameLeading: 12.6,        // two-line names
  label: DFD_LABEL_PX,      // inline edge labels
  tag: DFD_TAG_PX,          // connector tags
  address: 9.5,             // a derived box's header strip
  index: 12,                // an atom's index cell
  lane: 13,                 // swim-lane name
  shelf: DFD_SHELF_PX,      // the shelf's caption under its title ("no lines in or out yet")
  head: 12,                 // column headers, the phone ruler
  small: 12,                // drawer addresses, captions
  ui: 13,                   // buttons, legend, search
  prose: 14,                // drawer notes, chips, pipeline rows
  body: 15,                 // drawer prose
  lede: 15,                 // drawer's first sentence (regular: it leads, it does not shout)
  title: 19, titleMobile: 16, // "Zoo flow"
  drawerTitle: 24,
} as const;

/** Box anatomy (from the router's paddings, so text never outgrows the measured width). */
export const BOX = {
  radius: 7,
  strip: DFD_STRIP,
  cell: DFD_ATOM_CELL,
  pad: DFD_PAD,
  critter: critterPx,
  halo: 4,                  // the selection halo's offset outside the box
} as const;

export const SPACE = {
  barDesktop: 44,           // top bar height
  barMobile: 52,
  drawerW: 420,             // docked drawer (desktop)
  keyW: 380,                // the key popover (desktop)
  sheetMaxH: "55%",         // phone bottom sheet
  stageInset: 4,            // the overview's breathing room inside the stage
  nodeInset: 16,            // node view: frame inset beside the drawer
  framePad: 32,             // node view: air around the framed lineage
  lanePad: 24,              // region view: air around the framed lane
} as const;

export const RADIUS = { ui: 7, panel: 8, sheet: 14, chip: 4, shelf: 10 } as const;

export const STROKE = {
  edge: 1.5,                // every line at rest
  edgeLit: 2.2,             // the lit lineage
  box: 1.25,
  boxSelected: 2.2,
  boxPipeline: 2,
  halo: 3,
  rule: 1,
  strip: 1,                 // the strip / index-cell divider
  critter: 1.3,
  face: 1.2,
  tag: 1,
} as const;

/** Arrowheads: [length, half-width] at rest and lit. */
export const ARROW = { rest: [7, 3.6], lit: [8, 4] } as const;

export const SHADOW = {
  panel: "0 8px 24px rgba(46,39,66,0.14)",   // key, pipelines, keeper
  drawer: "-8px 0 24px rgba(46,39,66,0.06)",
  sheet: "0 -6px 24px rgba(46,39,66,0.12)",  // phone bottom sheet
} as const;

export const OPACITY = { dimBox: 0.26, dimEdge: 0.16, dimLabel: 0.2, halo: 0.3 } as const;

/** Motion (ms). Everything here is frozen under ?still=1 and prefers-reduced-motion. */
export const MOTION = {
  camera: 520,              // view changes (ease-out cubic)
  fade: 180,                // a box dimming / lighting
  hop: 620,                 // Konami: one box's hop
  hopStagger: 520,          // …the delay between generations
  packetHop: 900,           // a packet riding one edge
  packetRest: 900,          // the pause before the lineage replays
  drawer: 240,              // the drawer sliding in
  keeper: 3200,             // the keeper's loss curve drawing in
  ease: [0.3, 0.7, 0.4, 1] as [number, number, number, number],
} as const;

/** The same tokens as CSS custom properties, set once on the board's root for flow.module.css. */
export const FLOW_CSS_VARS = {
  "--flow-ink": COLOR.ink,
  "--flow-accent": COLOR.accent,
  "--flow-hover": COLOR.hover,
  "--flow-t-label": `${TYPE.label}px`,
  "--flow-t-small": `${TYPE.small}px`,
  "--flow-t-ui": `${TYPE.ui}px`,
  "--flow-t-prose": `${TYPE.prose}px`,
  "--flow-t-body": `${TYPE.body}px`,
  "--flow-t-lede": `${TYPE.lede}px`,
  "--flow-t-title": `${TYPE.drawerTitle}px`,
  "--flow-r-ui": `${RADIUS.ui}px`,
  "--flow-r-chip": `${RADIUS.chip}px`,
  "--flow-r-sheet": `${RADIUS.sheet}px`,
  "--flow-fade": `${MOTION.fade}ms`,
  "--flow-hop": `${MOTION.hop}ms`,
  "--flow-ease": `cubic-bezier(${MOTION.ease.join(",")})`,
} as CSSProperties;
