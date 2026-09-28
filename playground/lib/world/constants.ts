// Every tunable of the world + flow layouts, in one place. Values follow the
// spec (2026-09-28-playground-bakeoff-design.md); where the spec was silent or
// ambiguous the chosen interpretation is written next to the number.

export const TILE = 16 as const;

// ── regions ──────────────────────────────────────────────────────────────
/**
 * target tiles = AREA_PER_MODEL·max(n, AREA_MIN_MODELS) + AREA_BASE.
 * Spec 42; tuned to 54: at 42 the 3-tile footprint gaps + label boxes did not
 * fit on the first attempt (every build needed 2–3 area retries ≈ 3× the time)
 * and labels crowded into neighbours. 54 builds first time with 0 ambiguous labels.
 */
export const AREA_PER_MODEL = 54;
export const AREA_MIN_MODELS = 4;
export const AREA_BASE = 20;
/**
 * fraction of the grid that is land; grid is 4:3. Spec 62%: at that density the
 * regions only met because they were crushed against the sea margin (flat,
 * ruler-straight coasts; generative squashed to a 12-row strip). 50% + the
 * partner spokes below gives round regions that still share the 6 borders.
 */
export const LAND_FRACTION = 0.5;
export const GRID_ASPECT = 4 / 3;
/** tiles of guaranteed sea at the grid edge. */
export const SEA_MARGIN = 2;
/**
 * Not in the spec: the sea margin wobbles by up to this many extra tiles
 * (value noise) so regions pressed against the frame get an organic coast
 * instead of a ruler-straight edge.
 */
export const COAST_WOBBLE = 4;
/** Chebyshev sea gap between an islet and any other region. */
export const ISLET_MOAT = 2;
/** growth cost = dist/sqrt(target) + NOISE_WEIGHT·noise(tile) (noise ∈ [0,1], per-region field). */
export const NOISE_WEIGHT = 0.15;
/**
 * Not in the spec: growth distance is measured to a skeleton = the seed plus a
 * spoke reaching this fraction of the way to each partner family's seed.
 * Partners grow lobes toward each other, so the required borders appear
 * without relying on crowding (which squashed regions against the frame).
 */
export const PARTNER_SPOKE = 0.4;
/** value-noise lattice spacing in tiles (two octaves: this and half of it). */
export const NOISE_SCALE = 7;
/** enclosed sea pockets smaller than this become land of the surrounding region. */
export const HOLE_FILL_MAX = 12;
/** The only authored layout: seed positions as grid fractions. */
export const SEED_FRACTIONS: Record<string, [number, number]> = {
  sequence: [0.52, 0.5],
  perception: [0.2, 0.5],
  representation: [0.47, 0.17],
  generative: [0.47, 0.84],
  decision: [0.82, 0.5],
  structure: [0.88, 0.14],
};
/** Unknown (future) families take these spare corner slots in order. */
export const SPARE_SLOTS: [number, number][] = [
  [0.12, 0.14],
  [0.88, 0.86],
  [0.12, 0.86],
  [0.5, 0.06],
];
/** Fallback family for a parentless model absent from the family map and ATOMS (warned). */
export const FALLBACK_FAMILY = "structure";

// ── placement ────────────────────────────────────────────────────────────
export const ATOM_SIZE = 4;
export const DERIVED_SIZE = 2;
/**
 * Spec: atom candidates at edge-distance ≥3. Read as the footprint CENTRE: its
 * inner tiles sit at ≥3, i.e. every footprint tile at ≥2 (a 1-tile own-land rim).
 * Requiring ≥3 on every tile (a 2-tile rim) cannot fit 4 atoms in generative's 230 tiles.
 */
export const ATOM_EDGE_MIN = 2;
export const DERIVED_EDGE_MIN = 1;
/** empty tiles required between a derived footprint and any other footprint (Chebyshev box gap). */
export const FOOT_GAP = 3;
/**
 * The spec sets no atom–atom gap; 2 tiles (32px) still clears a 15px label
 * (24px tall) and lets 4 atoms pack into generative's ~230 tiles.
 */
export const ATOM_GAP = 2;
/** atom score: EDGE_W·min(edgeDist, EDGE_CAP) + dist-to-placed-atoms − BORDER_W·mean border dist. */
export const ATOM_EDGE_W = 2;
export const ATOM_EDGE_CAP = 5;
/** Not in the spec: the distance-to-placed-atoms term is capped (tiles) so atoms don't flee to the rim. */
export const ATOM_SPREAD_CAP = 12;
export const ATOM_BORDER_W = 0.3;
/**
 * derived: ideal distance per generation from the primary parent, tiles
 * (spec 6; 7 matches AREA_PER_MODEL 54). Deviation: generations are counted
 * inside the family (famDepth), not global depth — audio_transformer is depth 3
 * only via perception's audio chain, and k=3 flung it to the far rim of sequence.
 */
export const GEN_STEP = 7;
export const W_SECONDARY = 0.5;
export const W_CROSS_BORDER = 1.5;
/** Not in the spec: derived nodes with cross-family children lean toward that border (atoms get the same pull via ATOM_BORDER_W). */
export const W_DESC_BORDER = 0.75;
export const W_SIBLING = 2;
/**
 * Spec says "distance to the border with each cross-family parent region";
 * measured to the part of that border within this many tiles of the point
 * nearest the parent, else a child hugs a far stretch and its bridge road detours.
 */
export const BORDER_NEAR_SLACK = 6;
export const SIBLING_CONE_DEG = 35;
export const W_NOISE = 0.2;
/**
 * Not in the spec: greedy placement can strand the last atoms of a crowded
 * region (generative: 4 atoms in ~230 tiles). Candidates are tried best-first
 * and the first one after which the region's remaining footprints still pack
 * (scan-order greedy) wins; at most this many are checked.
 */
export const LOOKAHEAD_MAX = 60;

// ── set-pieces ──────────────────────────────────────────────────────────
export const SETPIECE_BIG_MIN_TILES = 400;
/** [w, h] tried in order (big regions start at 6×5). */
export const SETPIECE_SIZES_BIG: [number, number][] = [[6, 5], [4, 4], [3, 3]];
export const SETPIECE_SIZES_SMALL: [number, number][] = [[4, 4], [3, 3]];
export const SETPIECE_FOOT_GAP = 2;
/** buffer (tiles) between a set-piece and every node→parent straight line. */
export const SETPIECE_LINE_BUFFER = 1;

// ── roads ────────────────────────────────────────────────────────────────
export const COST_ORTHO = 1;
export const COST_DIAG = 1.45;
export const COST_TURN = 0.6; // per 45°
export const ROAD_REUSE = 0.4; // multiplier on the base step onto an existing ROAD tile (trunks)
export const COST_NEAR_FOREIGN_FOOT = 2;
export const COST_COAST = 1;
export const COST_RIVER = 8; // per RIVER tile crossed straight-through
export const COST_BRIDGE_REUSE = 1; // per tile when the river tile is already a bridge
export const HEURISTIC_W = 0.4; // × octile distance (≤ ROAD_REUSE → admissible)
/** a straight river crossing may span at most this many consecutive river tiles. */
export const MAX_BRIDGE_SPAN = 3;

// ── labels ───────────────────────────────────────────────────────────────
export const FONT_ATOM = 15 as const;
export const FONT_DERIVED = 13 as const;
export const LABEL_CHAR_W = 0.6; // × font per char
export const LABEL_PAD_W = 8;
export const LABEL_LINE_H = 1.35; // × font
export const LABEL_PAD_H = 4;
export const LABEL_GAP = 4; // px offset from the footprint
/** anchor preference cost; ring 1 (one tile further out) adds LABEL_RING_COST per ring. */
export const ANCHOR_COST: Record<string, number> = {
  S: 0, N: 0.3, E: 0.5, W: 0.5, SE: 0.8, NE: 0.8, SW: 0.8, NW: 0.8,
};
export const LABEL_RING_COST = 1;
/** rings 0–1 are the spec; 2–3 are a last resort before a warning. */
export const LABEL_RINGS = 4;
export const LABEL_COST_ROAD = 4; // per road tile under the label
export const LABEL_COST_WATER = 1; // per sea/river tile under the label
export const LABEL_COST_FOREIGN = 2; // per foreign-region tile under the label
/** Not in the spec: a label within this many px of another node's footprint costs extra (ambiguity). */
export const LABEL_NEAR_FOREIGN = 14;
export const LABEL_COST_NEAR_FOREIGN = 2;
/** …and a label not clearly nearer its own node than any other (margin LABEL_NEAR_FOREIGN) costs this. */
export const LABEL_COST_AMBIGUOUS = 8;

// ── decor ────────────────────────────────────────────────────────────────
export const DECOR_KEEP_P = 0.45;
export const DECOR_VARIANTS = 4;
export const DECOR_SCALE_MIN = 0.8;
export const DECOR_SCALE_MAX = 1.2;
export const SEA_SLOTS = 3;

// ── retry / camera ───────────────────────────────────────────────────────
export const MAX_RETRIES = 3;
export const RETRY_AREA_MUL = 1.1;
export const CAMERA_REGION_PAD = 1; // tiles
export const CAMERA_NODE_PAD = 3; // tiles

// ── ferry (composition) routes ──────────────────────────────────────────
export const FERRY_ROAD = 0.6;
export const FERRY_SEA = 0.8;
export const FERRY_LAND = 2;
/** Not in the spec: other nodes' footprints are skirted, not walked through. */
export const FERRY_FOOT = 6;

// ── flow layout ──────────────────────────────────────────────────────────
export const FLOW_COL_W = 220;
export const FLOW_NODE_W = 150;
export const FLOW_NODE_H = 44;
export const FLOW_ROW_PITCH = 64;
export const FLOW_LANE_GAP = 24;
export const FLOW_PAD = 24;
export const FLOW_TRACK = 6;
export const FLOW_SWEEPS = 4;
/** min clearance (px) between a horizontal channel and any node box. */
export const FLOW_CHANNEL_CLEAR = 4;
export const FLOW_CORNER_R = 10;
