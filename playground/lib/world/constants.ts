// Every tunable of the world + flow layouts, in one place. Values follow the
// spec (2026-09-28-playground-bakeoff-design.md); where the spec was silent or
// ambiguous the chosen interpretation is written next to the number.

export const TILE = 16 as const;
/** v3: layout generation — bumped when the map's geography changes (skins may key cached art on it). */
export const WORLD_VERSION = 3;

// ── regions ──────────────────────────────────────────────────────────────
/**
 * target tiles = AREA_PER_MODEL·max(n, AREA_MIN_MODELS) + AREA_BASE.
 * Spec 42; v1 tuned to 54. Layout v2 (R2-A "more spacing"): the footprint gap
 * doubled (3→6) and the generation step went 7→12, so each model needs roughly
 * (gap+size)² ≈ 2× the land it had — 120 builds first time with labels in
 * clean space (no label on a road tile) and room for cities around atoms.
 */
export const AREA_PER_MODEL = 140;
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
/**
 * empty tiles required between a derived footprint and any other footprint
 * (Chebyshev box gap). v1 3 → v2 6: the owner's "more spacing"; a 6-tile gap
 * fits a label band on each side plus a road between neighbours.
 */
export const FOOT_GAP = 6;
/**
 * The spec sets no atom–atom gap; v1 2 → v2 5 (atoms grow cities around them,
 * see CITY_*). 5 still lets generative's 4 atoms pack into its region.
 */
export const ATOM_GAP = 5;
/** invariant (tests): no two node centres closer than this (tiles). */
export const MIN_CENTRE_DIST = 7;
/** atom score: EDGE_W·min(edgeDist, EDGE_CAP) + dist-to-placed-atoms − BORDER_W·mean border dist. */
export const ATOM_EDGE_W = 2;
export const ATOM_EDGE_CAP = 5;
/** Not in the spec: the distance-to-placed-atoms term is capped (tiles) so atoms don't flee to the rim. */
export const ATOM_SPREAD_CAP = 20;
/**
 * v3: atoms with an authored reference spot (continent.ts ATOM_ANCHORS) pay
 * this per tile away from it — strong enough to dominate the edge/border
 * terms, so the map reads like the owner's reference.
 */
export const W_ATOM_ANCHOR = 3;
/** v3: set-pieces pay this per tile away from their authored landmark spot (edge distance capped at 3 still counts). */
export const W_SETPIECE_ANCHOR = 0.35;
/** v2 0.3 → 0.8: the spread cap grew with the world, so the border pull must too. */
export const ATOM_BORDER_W = 0.8;
/**
 * derived: ideal distance per generation from the primary parent, tiles
 * (spec 6; v1 7; v2 12 — "~2× spacing", matches FOOT_GAP 6 + AREA_PER_MODEL 120).
 * Deviation: generations are counted inside the family (famDepth), not global
 * depth — audio_transformer is depth 3 only via perception's audio chain, and
 * k=3 flung it to the far rim of sequence.
 */
export const GEN_STEP = 12;
export const W_SECONDARY = 0.5;
/**
 * v3 trunk-and-branch (replaces the radial sibling fan): a hub's same-family
 * children sit along 1 trunk (2 from TRUNK_SPLIT children), TRUNK_OFF tiles to
 * alternating sides of the trunk line, TRUNK_HALF tiles apart along it
 * (÷ max(|cos|,|sin|) so diagonal trunks keep the Chebyshev FOOT_GAP), the
 * first one TRUNK_FIRST(_ATOM) tiles from the hub centre.
 */
export const TRUNK_SPLIT = 4;
export const TRUNK_OFF = 4;
export const TRUNK_HALF = 4.5;
export const TRUNK_FIRST = 9;
export const TRUNK_FIRST_ATOM = 10;
/** min separation of two trunks, in 22.5° steps (5 → 112.5°). */
export const TRUNK_MIN_SEP = 5;
/** candidate cost per squared tile from the trunk slot (÷ GEN_STEP, like the v2 distance term). */
export const W_TRUNK = 1;
/** trunk bearing score: continue outward from the hub's parent / lean toward borders its children bridge. */
export const W_TRUNK_OUT = 0.5;
export const W_TRUNK_PULL = 0.6;
/** trunk bearing score: keep clear of the hub's own bridges out and of the region's other atoms nearby. */
export const W_TRUNK_AVOID = 0.5;
/** 1 = children with a cross-family parent ride the trunk too (0 = they wait at their bridge; measured: shorter roads but ~20% more crossings). */
export const TRUNK_CROSS_KIDS = 1;
/** v2 1.5 → 4: every term is /GEN_STEP, which grew 7→12; keeps cross-family children at their bridge. */
export const W_CROSS_BORDER = 4;
/** Not in the spec: derived nodes with cross-family children lean toward that border (atoms get the same pull via ATOM_BORDER_W). */
export const W_DESC_BORDER = 2;
export const W_SIBLING = 2;
/**
 * Spec says "distance to the border with each cross-family parent region";
 * measured to the part of that border within this many tiles of the point
 * nearest the parent, else a child hugs a far stretch and its bridge road detours.
 */
export const BORDER_NEAR_SLACK = 9;
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
/** v2: a road turns at most this many 45° steps per tile (2 = 90°); no hairpins. */
export const MAX_TURN_STEPS = 2;
/**
 * v2: trunk sharing is only for SIBLINGS — a road rides an existing road of
 * the same parent at this multiplier (the hub's bundle branches at distinct
 * junctions). v1 discounted every road (0.4), which braided unrelated lineages.
 */
export const ROAD_REUSE = 0.5;
/** v2: per tile on a road of another parent (crossing = 1 tile; running along = braid). */
export const COST_SHARE_FOREIGN = 2.5;
/** v2: at most this many roads share a tile; more costs COST_LANE_FULL per tile. */
export const MAX_LANES = 3;
export const COST_LANE_FULL = 12;
/**
 * v2: per tile entered inside another node's reserved label band (the side
 * the label will prefer, chosen before routing). Keeps label space clean.
 */
export const COST_LABEL_ZONE = 3;
/** v2: per tile within 1 tile of a foreign footprint's ring (keeps label bands free). */
export const COST_NEAR_FOREIGN_RING2 = 0.6;
/** px between parallel lanes of roads sharing tiles (lane k is offset k·LANE_GAP to the left of travel). */
export const LANE_GAP = 5;
/** px between direction chevrons along a road; none closer than CHEVRON_END_CLEAR to either end. */
export const CHEVRON_SPACING = 48;
export const CHEVRON_END_CLEAR = 14;
/** invariant: two roads' lane polylines may coincide for at most this many px (a shared stub). */
export const LANE_OVERLAP_MAX = TILE;
export const COST_NEAR_FOREIGN_FOOT = 2;
export const COST_COAST = 1;
export const COST_RIVER = 8; // per RIVER tile crossed straight-through
export const COST_BRIDGE_REUSE = 1; // per tile when the river tile is already a bridge
export const HEURISTIC_W = 1.0;
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
/**
 * rings 0–1 are the spec; v2 adds half-tile steps (LABEL_RING_STEP) out to
 * 8 rings plus sideways slides, because road tiles are now HARD for labels.
 */
export const LABEL_RINGS = 8;
export const LABEL_RING_STEP = 8; // px per ring
/** last-resort rings (only searched while no ring < LABEL_RINGS fits). */
export const LABEL_RINGS_MAX = 20;
/** v2 hard: a label keeps this many px from every other node's footprint. */
export const LABEL_FOOT_CLEAR = 6;
/** v2 hard: labels keep this many px from each other. */
export const LABEL_LABEL_CLEAR = 2;
/** cost per px a S/N label slides sideways / an E/W label slides vertically. */
export const LABEL_SLIDE_COST = 0.01;
export const LABEL_COST_ROAD = 4; // v1 soft cost per road tile under the label (v2: roads are hard)
export const LABEL_COST_WATER = 1; // per sea/river tile under the label
export const LABEL_COST_FOREIGN = 2; // per foreign-region tile under the label
/** Not in the spec: a label within this many px of another node's footprint costs extra (ambiguity). */
export const LABEL_NEAR_FOREIGN = 14;
export const LABEL_COST_NEAR_FOREIGN = 2;
/** …and a label not clearly nearer its own node than any other (margin LABEL_NEAR_FOREIGN) costs this. */
export const LABEL_COST_AMBIGUOUS = 8;

// ── world flavour (R2-E) ────────────────────────────────────────────────
/** a city block is placed on free tiles within this Chebyshev ring of the atom footprint. */
export const CITY_RING = 3;
/** blocks = CITY_BASE + CITY_PER_CHILD·children, capped at CITY_MAX. */
export const CITY_BASE = 2;
export const CITY_PER_CHILD = 1;
export const CITY_MAX = 14;
/** atoms with at least this many direct children are "capitals". */
export const CAPITAL_MIN_CHILDREN = 6;
/** block px inset inside its tile (so blocks never touch neighbouring tiles). */
export const CITY_INSET = 2;
/** harbour: coast tile with ≥ this many sea tiles within HARBOUR_RADIUS (open water). */
export const HARBOUR_RADIUS = 3;
/** a region gets a second harbour when more than this many boats dock there. */
export const HARBOUR_SPLIT_BOATS = 6;
/** mountains: land tiles beside a border river, ≥ MOUNTAIN_ROAD_CLEAR tiles from any road/bridge. */
export const MOUNTAIN_ROAD_CLEAR = 3;
/** mountain ranges shorter than this many tiles are dropped. */
export const MOUNTAIN_MIN = 4;
/** secret islands: sea gap (tiles) outside camera.world, slot pitch (tiles), min size (tiles). */
export const SECRET_GAP = 10;
export const SECRET_PITCH = 6;
export const SECRET_MIN_W = 8;
export const SECRET_H = 8;
export const HIDDEN_DEFAULT = ["vq_vae", "flow_matching", "gated_pixelcnn"];

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
// v2 (R2-A "more spacing"): column 220→280, row pitch 64→84, lane gap 24→48.
export const FLOW_COL_W = 280;
export const FLOW_NODE_W = 150;
export const FLOW_NODE_H = 44;
export const FLOW_ROW_PITCH = 84;
export const FLOW_LANE_GAP = 48;
export const FLOW_PAD = 24;
// v2 6 → 9: the gutter grew 70 → 130px; wider tracks keep parallel pipes separable.
export const FLOW_TRACK = 9;
export const FLOW_SWEEPS = 4;
/** min clearance (px) between a horizontal channel and any node box. */
export const FLOW_CHANNEL_CLEAR = 4;
export const FLOW_CORNER_R = 10;
