// Public types of the world contract (docs/superpowers/specs/2026-09-28-
// playground-bakeoff-design.md § "The world contract"). Pure data — skins only
// paint these; no renderer invents a position.
//
// Units: anything named `foot`, `setPiece`, `bbox`, `seed`, `tiles` or `tile`
// is in TILE coordinates (1 tile = World.tile px). Everything else that is a
// Pt/Box (`center`, `points`, `Label.box`, `seaSlots`, `camera`) is in PIXELS.

export type Pt = { x: number; y: number };
export type Box = Pt & { w: number; h: number };
/** model name → family name (see familyMapFromBlueprint). */
export type FamilyMap = Record<string, string>;

/** Terrain codes stored in World.terrain (erasable-syntax friendly: no enum). */
export const T = {
  SEA: 0,
  LAND: 1,
  COAST: 2,
  RIVER: 3,
  ROAD: 4,
  BRIDGE: 5,
  FOOT: 6,
  SETPIECE: 7,
} as const;
export type Terrain = (typeof T)[keyof typeof T];

export interface Region {
  family: string;
  /** index into World.regions; also the value stored in World.regionOf. */
  id: number;
  /** data-derived: the family has zero cross-family edges. */
  islet: boolean;
  tiles: number;
  targetTiles: number;
  /** growth seed, tile coords. */
  seed: Pt;
  /** signature set-piece footprint, tile coords (null if none fit). */
  setPiece: Box | null;
  /** tile-coord bounding box of the region's tiles. */
  bbox: Box;
}

export interface WorldNode {
  name: string;
  family: string;
  /** 0 for atoms; 1 + max(parent depth) otherwise. */
  depth: number;
  atom: boolean;
  /** same-family parent, else deepest, else first listed; null for roots. */
  primary: string | null;
  /** every builds_on parent that exists in the taxonomy, as listed. */
  parents: string[];
  /** footprint in tiles (4×4 atoms, 2×2 derived). */
  foot: Box;
  /** footprint centre in px. */
  center: Pt;
}

export type RoadKind = "primary" | "secondary" | "bridge";

export interface Road {
  /** `${from}->${to}` */
  id: string;
  /** parent (builds_on target) */
  from: string;
  /** child */
  to: string;
  /** "bridge" = cross-family edge; else "primary" (child's primary parent) or "secondary". */
  kind: RoadKind;
  /** true when `from` is the child's primary parent (independent of kind). */
  primary: boolean;
  /** tile indices, parent side → child side, consecutive 8-neighbours. Empty if unroutable. */
  tiles: number[];
  /** px polyline: footprint-edge stub, then tile centres at direction changes, then stub. */
  points: Pt[];
  /** px length of `points`. */
  length: number;
}

export interface Bridge {
  roadId: string;
  /** consecutive RIVER tiles crossed straight-through. */
  tiles: number[];
  /** direction of travel over the bridge. */
  axis: "h" | "v";
  /** families on the two banks, in travel order. */
  regions: [string, string];
}

export type Anchor = "S" | "N" | "E" | "W" | "SE" | "NE" | "SW" | "NW";

export interface Label {
  node: string;
  text: string;
  font: 13 | 15;
  /** px box. */
  box: Box;
  anchor: Anchor;
}

export interface Decor {
  tile: number;
  region: string;
  variant: number;
  scale: number;
}

export interface CameraAnchors {
  world: Box;
  regions: Record<string, Box>;
  nodes: Record<string, { focus: Pt; box: Box }>;
}

export interface World {
  cols: number;
  rows: number;
  tile: 16;
  /** one T.* code per tile, row-major (i = y * cols + x). */
  terrain: Uint8Array;
  /** region id per tile, -1 = sea. RIVER/ROAD/FOOT tiles keep their region. */
  regionOf: Int8Array;
  regions: Region[];
  nodes: WorldNode[];
  roads: Road[];
  bridges: Bridge[];
  labels: Label[];
  decor: Decor[];
  /** px boxes: the 3 largest empty sea squares (for furniture). */
  seaSlots: Box[];
  camera: CameraAnchors;
  warnings: string[];
}

export interface WorldOptions {
  /** label size override (px); default w = 0.6·font·chars + 8, h = 1.35·font + 4. */
  measure?: (text: string, font: 13 | 15) => { w: number; h: number };
  /** debug hook: called after every layout attempt with its hard failures (empty = accepted). */
  onAttempt?: (attempt: number, failures: string[]) => void;
}

export interface PathResult {
  /** node names walked, from the start node to its root atom. */
  nodes: string[];
  /** px polyline (continuous: node centre → road → next centre …). */
  points: Pt[];
  length: number;
}

export interface FerryRoute {
  /** member names actually visited (unknown names skipped). */
  visits: string[];
  /** px polyline; points[i] is at sea when sea[i]. */
  points: Pt[];
  sea: boolean[];
  length: number;
}

export interface FlowNode {
  name: string;
  family: string;
  depth: number;
  /** lane index (into FlowLayout.lanes). */
  lane: number;
  /** column index = depth. */
  col: number;
  /** order within its (lane, col) cell, top → bottom. */
  order: number;
  box: Box;
}

export interface FlowPipe {
  from: string;
  to: string;
  /** axis-aligned px polyline from the parent's out-port to the child's in-port. */
  points: Pt[];
  length: number;
  crossLane: boolean;
}

export interface FlowLayout {
  width: number;
  height: number;
  lanes: { family: string; y: number; h: number }[];
  columns: { depth: number; x: number }[];
  nodes: FlowNode[];
  pipes: FlowPipe[];
  /** straight-segment crossings of the chosen order. */
  crossings: number;
  /** straight-segment crossings of the seed (PLACEMENT) order, for comparison. */
  seedCrossings: number;
}
