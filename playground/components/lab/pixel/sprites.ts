// Every sprite of the pixel skin as a paint-by-number string array. Keys:
//   0-f  Sweetie-16 index (see palette.ts)      .  transparent
//   placeholders resolved per use via a recolour map (e.g. roof, canopy,
//   level-dot fill) — so one drawing serves every family / evidence state.
// Rasterised at runtime into index buffers (terrain.ts); no image files.

export type SpriteRows = readonly string[];

// ——— Atom: castle (2×2 tiles of art, drawn ×2 into its 4×4 footprint) ———
// R roof, r roof shade, d stone, e stone shade, f doorway.
export const CASTLE: SpriteRows = [
  ".....00..................00.....",
  "....0Rr0................0Rr0....",
  "...0RRRr0..............0RRRr0...",
  "...0RRrr0..............0RRrr0...",
  "..0RRRRrr0............0RRRRrr0..",
  "..0RRRrrr0............0RRRrrr0..",
  ".0rrrrrrrr0..........0rrrrrrrr0.",
  "..0ddddde0............0ddddde0..",
  "..0dd00de0............0dd00de0..",
  "..0dd00de0............0dd00de0..",
  "..0ddddde0000.0000.0000ddddde0..",
  "..0ddddde00d0.0dd0.0d00ddddde0..",
  "..0edddde0eeeeeeeeeeee0edddde0..",
  "..0ddddde0dddddddddddd0ddddde0..",
  "..0deddde0ddeddddddedd0deddde0..",
  "..0ddddde0dddddddddddd0ddddde0..",
  "..0ddddde0ddd000000ddd0ddddde0..",
  "..0dd00de0dd00ffff00dd0dd00de0..",
  "..0dd00de0d0ffffffff0d0dd00de0..",
  "..0ddddde0d0ffffffff0d0ddddde0..",
  "..0deddde0d0ffffffff0d0deddde0..",
  "..0ddddde0d0ffffffff0d0ddddde0..",
  "..0ddddde0e0ffffffff0e0ddddde0..",
  "..0ddedde0d0ffffffff0d0ddedde0..",
  "..0ddddde0d0ffffffff0d0ddddde0..",
  "..0ddddde0d0ffffffff0d0ddddde0..",
  "..0deddde0d0ffffffff0d0deddde0..",
  "..0ddddde0d0ffffffff0d0ddddde0..",
  "..0eeeeee0e0ffffffff0e0eeeeee0..",
  "..0000000000000000000000000000..",
  "................................",
  "................................",
];

// ——— Derived model: level dot (native size, centred in its 2×2 footprint) ———
// F face, D face shade / rim, H highlight.
export const DOT: SpriteRows = [
  "......00000000......",
  "....00HHHFFFFF00....",
  "...0HHFFFFFFFFFF0...",
  "..0HFFFFFFFFFFFFD0..",
  ".0HFFFFFFFFFFFFFFD0.",
  ".0FFFFFFFFFFFFFFFD0.",
  "0FFFFFFFFFFFFFFFFFD0",
  "0FFFFFFFFFFFFFFFFFD0",
  "0FFFFFFFFFFFFFFFFFD0",
  "0FFFFFFFFFFFFFFFFDD0",
  "0DFFFFFFFFFFFFFFFDD0",
  ".0DFFFFFFFFFFFFFDD0.",
  ".0DDFFFFFFFFFFFDDD0.",
  "..0DDDFFFFFFFFDDD0..",
  "..0DDDDDDDDDDDDDD0..",
  "...00DDDDDDDDDD00...",
  ".....0000000000.....",
];

// ——— Evidence markers ———
export const STAR: SpriteRows = [
  ".....0.....",
  "....040....",
  "....040....",
  "00004440000",
  "04444c44440",
  ".044444440.",
  "..0444440..",
  "..0443440..",
  ".044303440.",
  ".0430.0340.",
  ".00.....00.",
];

export const QSIGN: SpriteRows = [
  "000000000000",
  "044444444430",
  "044440044430",
  "044404404430",
  "044444044430",
  "044440444430",
  "044444444430",
  "044440444430",
  "033333333330",
  "000000000000",
  "....0320....",
  "....0320....",
  "....0000....",
];

// ——— Decor, one per biome (placed only on world.decor cells) ———
// X canopy, Y canopy light, Z canopy shade.
export const TREE: SpriteRows = [
  "................",
  ".....000000.....",
  "...00YYYXXX00...",
  "..0YYXXXXXXXX0..",
  ".0YXXXXXXXXXXZ0.",
  ".0YXXXXXXXXXXZ0.",
  "0YXXXXXXXXXXXXZ0",
  "0XXXXXXXXXXXXZZ0",
  "0XXXXXXXXXXXZZZ0",
  ".0XXXXXXXXXZZZ0.",
  ".0ZXXXXXXXZZZZ0.",
  "..00ZZZZZZZZ00..",
  ".....00fe00.....",
  "......0fe0......",
  ".....0ffee0.....",
  "......0000......",
];

export const PINE: SpriteRows = [
  ".......00.......",
  "......0cc0......",
  "......0c70......",
  ".....0cc770.....",
  ".....077770.....",
  "....0cc77770....",
  "...0cc7777770...",
  "...0777777770...",
  "..0cc777777770..",
  "..0cc777777770..",
  ".0cc77777777770.",
  ".00000000000000.",
  "......0ef0......",
  "......0ef0......",
  ".....000000.....",
  "................",
];

export const CACTUS: SpriteRows = [
  "................",
  "......0000......",
  ".....065560.....",
  "..00.065660.00..",
  ".05600656600650.",
  ".06600656600660.",
  ".066666656666660",
  ".006666656666600",
  "...000065660000.",
  ".....065660.....",
  ".....065660.....",
  ".....065660.....",
  "....03333330....",
  "....00000000....",
  "................",
  "................",
];

export const MUSHROOM: SpriteRows = [
  "................",
  "................",
  ".....000000.....",
  "...002222cc00...",
  "..02cc22222220..",
  ".0222222cc22220.",
  ".022cc22222c220.",
  ".01111111111110.",
  "..000cccccc000..",
  ".....0cccd0.....",
  ".....0cccd0.....",
  ".....0ccdd0.....",
  "....00000000....",
  "................",
  "................",
  "................",
];

export const CRYSTAL: SpriteRows = [
  "................",
  ".......00.......",
  "......0bc0......",
  "......0bc0......",
  ".....0bbc90.....",
  ".....0bbc90.....",
  "..00.0bb990.00..",
  ".0bc00bb9900b90.",
  ".0b900bb99900b90",
  ".0b900b99990990.",
  "..090.0b9990090.",
  "...000999900000.",
  "....0eeeeee0....",
  ".....000000.....",
  "................",
  "................",
];

// ——— Region monuments: the family's signature mechanism as a glyph ———
// Drawn ×2 on the region's set-piece plaza.
export const GLYPHS: Record<string, SpriteRows> = {
  // an eye: perception sees
  perception: [
    "................",
    "................",
    "................",
    ".....000000.....",
    "...00cccccc00...",
    "..0cccc00cccc0..",
    ".0ccc000990ccc0.",
    "0ccc00009990ccc0",
    ".0ccc000990ccc0.",
    "..0cccc00cccc0..",
    "...00cccccc00...",
    ".....000000.....",
    "................",
    "................",
    "................",
    "................",
  ],
  // beads on a string: a sequence of tokens
  sequence: [
    "................",
    "................",
    "................",
    "................",
    "..00....00....00",
    ".0340..0340..034",
    "0333000333000333",
    "0332000332000332",
    ".020...020...020",
    "..0.....0.....0.",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  // a sprout from a seed: generation
  generative: [
    "................",
    "....00....00....",
    "...0550..0550...",
    "..055660066550..",
    "..056660066650..",
    "...0666006660...",
    "....00066000....",
    "......0660......",
    "......0660......",
    ".....006600.....",
    "....04444440....",
    "...0443333440...",
    "...0433333340...",
    "....04333340....",
    ".....000000.....",
    "................",
  ],
  // a mirror: an embedding reflects its input
  representation: [
    "......0000......",
    "....00dddd00....",
    "...0dbbbbbbd0...",
    "..0dbbcbbbbbd0..",
    "..0dbcbbbbbbd0..",
    "..0dbbbbbbbbd0..",
    "..0dbbbbbbbbd0..",
    "..0dbbbbbbb9d0..",
    "...0dbbbbb9d0...",
    "....00dddd00....",
    "......0ee0......",
    "......0ee0......",
    "....00eeee00....",
    "...0eeeeeeee0...",
    "...0000000000...",
    "................",
  ],
  // a fork in the road: choosing an action
  decision: [
    "................",
    "......00........",
    ".00000ee0000....",
    ".0444444444440..",
    ".04444444444440.",
    ".0333333333330..",
    ".00000ee0000....",
    "....00000ee00000",
    "..0444444444440.",
    ".04444444444440.",
    "..0333333333330.",
    "....00000ee00000",
    "........0ee0....",
    "........0ee0....",
    ".......000000...",
    "................",
  ],
  // three linked nodes: a graph
  structure: [
    "................",
    "......0000......",
    ".....0bbcb0.....",
    ".....0b99b0.....",
    "......0000......",
    ".....0.00.0.....",
    "....0..00..0....",
    "...0...00...0...",
    "..0000.00.0000..",
    ".0bbcb0000bbcb0.",
    ".0b99b0..0b99b0.",
    "..0000....0000..",
    "................",
    "................",
    "................",
    "................",
  ],
};

// ——— Water glints, 2 frames (only over mid/deep water) ———
// 'x' marks a glint pixel.
export const GLINTS: [SpriteRows, SpriteRows] = [
  [
    "................",
    "................",
    "...xx...........",
    "................",
    "................",
    "..........xxx...",
    "................",
    "................",
    "................",
    "......xx........",
    "................",
    "................",
    ".xx.............",
    "............xx..",
    "................",
    "................",
  ],
  [
    "................",
    "................",
    ".....xx.........",
    "................",
    "................",
    "........xxx.....",
    "................",
    "................",
    "................",
    "....xx..........",
    "................",
    "................",
    "...xx...........",
    "..........xx....",
    "................",
    "................",
  ],
];

// ——— Ground texture per biome ('L' light, 'S' shade) ———
export const GROUND: Record<string, SpriteRows> = {
  // grass tufts
  tufts: [
    "................",
    "..L.............",
    ".LSL............",
    "..........L.....",
    ".........LSL....",
    "................",
    "................",
    "....S...........",
    "................",
    "................",
    "...........L....",
    "..L.......LSL...",
    ".LSL............",
    "................",
    "......S.........",
    "................",
  ],
  // wind ripples
  ripples: [
    "................",
    "................",
    "..SSS...........",
    ".....SS.........",
    "................",
    "................",
    "..........SSS...",
    ".............SS.",
    "................",
    "....L...........",
    "................",
    "................",
    "...SSS..........",
    "......SS........",
    "..........L.....",
    "................",
  ],
  // snow sparkle
  sparkle: [
    "................",
    "................",
    "...S............",
    "..SLS...........",
    "...S.......S....",
    "................",
    "................",
    "................",
    "..........S.....",
    ".........SLS....",
    "..........S.....",
    "................",
    "....S...........",
    "................",
    "................",
    "................",
  ],
  // cracked stone
  cracks: [
    "................",
    "..SS............",
    "....S...........",
    "....SS..........",
    "................",
    "...........L....",
    "................",
    "................",
    ".........SS.....",
    "...........S....",
    "...........SS...",
    "................",
    "..L.............",
    "................",
    "................",
    "................",
  ],
};
export const GROUND_OF: Record<string, keyof typeof GROUND> = {
  perception: "tufts", generative: "tufts", decision: "tufts",
  sequence: "cracks", representation: "sparkle", structure: "ripples",
};

// Focus cursor corner (top-left; mirrored for the other three).
export const CORNER: SpriteRows = [
  "00000000..",
  "0cccccc0..",
  "0c444400..",
  "0c400000..",
  "0c40......",
  "0c40......",
  "0000......",
  "..........",
];

// Menu cursor (party rows, search results).
export const POINTER: SpriteRows = [
  "00......",
  "0c00....",
  "0cc400..",
  "0cc4440.",
  "0cc400..",
  "0c00....",
  "00......",
];

// ——— Map-key samples (legend only) ———
export const KEY_ROAD: SpriteRows = [
  "6666666666666666",
  "6666666666666666",
  "ffffffffffffffff",
  "dddddddddddddddd",
  "dddddddddddddddd",
  "dddddddddddddddd",
  "ffffffffffffffff",
  "6666666666666666",
  "6666666666666666",
];
export const KEY_STONES: SpriteRows = [
  "6666666666666666",
  "6666666666666666",
  "66ff66ff66ff66ff",
  "6fddf6fddf6fddf6",
  "6fddf6fddf6fddf6",
  "66ff66ff66ff66ff",
  "6666666666666666",
  "6666666666666666",
  "6666666666666666",
];
export const KEY_BRIDGE: SpriteRows = [
  "6699999999999966",
  "ffffffffffffffff",
  "3323323323323323",
  "3323323323323323",
  "3323323323323323",
  "ffffffffffffffff",
  "6688888888888866",
  "6699999999999966",
  "6699999999999966",
];

// ——— Atom banners: the mechanism each atom introduces, as a 5×5 glyph ———
// Hung on the castle keep (red pennant, gold glyph). Atoms are exactly the
// models that introduce a mechanism, so every castle wears a different one.
export const BANNER: SpriteRows = [
  "000000000",
  "0RRRRRRR0",
  "0RRRRRRR0",
  "0RRRRRRR0",
  "0RRRRRRR0",
  "0RRRRRRR0",
  "0RRRRRRR0",
  "0RRRRRRR0",
  "0RRRRRRR0",
  ".0RRRRR0.",
  "..0RRR0..",
  "...000...",
];
export const MECH_GLYPHS: Record<string, SpriteRows> = {
  convolution: ["x.x.x", ".....", "x.x.x", ".....", "x.x.x"],                 // 3×3 kernel taps
  mlp: ["x...x", "xx.xx", "x.x.x", "xx.xx", "x...x"],                         // dense criss-cross
  recurrence: [".xxx.", "x...x", "x.xxx", "x....", ".xxx."],                  // loop back
  "self-attention": ["x.x.x", ".xxx.", "xxxxx", ".xxx.", "x.x.x"],            // all-to-all
  "selective-scan": ["x....", "xx...", "xxx..", "xxxx.", "xxxxx"],            // decaying scan
  "message-passing": ["x...x", ".xxx.", ".x.x.", ".xxx.", "x...x"],           // hub and spokes
  "variational-latent": ["..x..", ".x.x.", ".x.x.", "x...x", "x...x"],        // bell curve
  "adversarial-game": ["x...x", ".x.x.", "..x..", ".x.x.", "x...x"],          // crossed blades
  "iterative-denoising": ["x.x.x", ".x.x.", "xx.xx", "xxxxx", "xxxxx"],       // noise → solid
  "autoregressive-factorization": ["xxxxx", "xxxxx", "xx...", ".....", "....."], // raster so far
  "skip-encoder-decoder": ["xxxxx", "x...x", "x...x", "x...x", ".xxx."],      // U with skip
  "contrastive-infonce": ["x...x", "xx.xx", "xxxxx", "xx.xx", "x...x"],       // pulled together
  "policy-gradient": ["..x..", ".xxx.", "x.x.x", "..x..", "..x.."],           // ascend
  "value-based-rl": ["xxxxx", "x.x.x", "xxxxx", "x.x.x", "xxxxx"],            // Q-table
  "neural-field-rendering": ["....x", "...x.", "xxx..", "xxx..", "xxx.."],    // ray into a volume
  "tree-search-self-play": ["..x..", "..x..", ".x.x.", "x...x", "x.x.x"],     // search tree
};


// ——— Round 2: world flavour (each encodes data — see encoding.ts) ———
// Mountain peak for border ranges (S = land shade, L = snow/light).
export const MOUNTAIN: SpriteRows = [
  ".......00.......",
  "......0cc0......",
  ".....0cccd0.....",
  "....0ccdde00....",
  "....0cddee0f0...",
  "...0edeeeef0f0..",
  "..0eeeeeeff0ff0.",
  "..0eeeefeeff0ff0",
  ".0eeeeffeeefff00",
  ".0eeeffeeeefff0.",
  "0eeeffeeeeefff0.",
  "0000000000000000",
];
// City house (block = one building on an atom's city blocks).
export const HOUSE: SpriteRows = [
  "...0000...",
  "..022220..",
  ".02222220.",
  "0222222220",
  "0000000000",
  ".0cccccc0.",
  ".0c00cdc0.",
  ".0c00cdc0.",
  ".00000000.",
];
// Boat = one composition docked at this family's harbour.
export const BOAT: SpriteRows = [
  "....0.....",
  "...0c0....",
  "...0cc0...",
  "...0ccc0..",
  "...0cccc0.",
  "....0000..",
  "0000000000",
  "0333333330",
  ".03222230.",
  "..000000..",
];
// Pier plank from the coast out to the harbour.
export const PIER: SpriteRows = [
  "0000",
  "3323",
  "3323",
  "0000",
];
// Ruined column (legacy models on the ruins islet).
export const RUIN: SpriteRows = [
  "..0000....",
  ".0dddd0...",
  ".0dde00...",
  "..0de0....",
  "..0dd0....",
  "..0de0.00.",
  "..0dd00d0.",
  "..0de0.0..",
  ".0dddd0...",
  "0eeeeee000",
  "0000000000",
];
// Next-era silhouette: an uncharted model (dark monolith with a "?").
export const QSTONE: SpriteRows = [
  "..000000..",
  ".0ffffff0.",
  ".0ff44ff0.",
  ".0f4ff4f0.",
  ".0ffff4f0.",
  ".0fff4ff0.",
  ".0ffffff0.",
  ".0fff4ff0.",
  ".0ffffff0.",
  "0000000000",
];
// Sea serpent off the hidden island ("here be dragons").
export const DRAGON: SpriteRows = [
  "..........00....",
  ".........0660...",
  "........06600...",
  "..00....0660....",
  ".0660..06600....",
  "066660066000....",
  "0660066660......",
  ".00..0000.......",
];
// Train: engine running a lineage while its model has a live run.
export const TRAIN: SpriteRows = [
  "..00......",
  ".0220000..",
  ".02222220.",
  "0222c2220.",
  "022222222.",
  "000000000.",
  ".0f0..0f0.",
];
