// Atom landmarks — one castle per MECHANISM (16), each with a silhouette that
// says what the mechanism does, all lit from the top-left, grey-violet
// masonry + a signature material, selective outlines (shadow side only).
// Canvas 36×46 art px; the 4×4-tile atom footprint is 32×32 art px at
// ART_PER_TILE = 8, so a castle stands on its footprint and overhangs it
// upward (anchor = bottom centre). `slot` = the 9×9 emblem window on the
// castle's banner (stamp the lib/icons glyph there via stampEmblem).
import { Painter, type Sprite } from "./paint";
import { RAMPS } from "../palette";

export const CASTLE_W = 36;
export const CASTLE_H = 46;
const GY = 43;          // ground row
const CX = 18;

/** Stone plinth the whole keep stands on + its ground shadow. */
function plinth(p: Painter, x0: number, x1: number) {
  p.rect(x0, GY - 2, x1 - x0 + 1, 2, "stone", 2);
  p.hline(x0, x1, GY - 2, "stone", 3);
  p.hline(x0, x1, GY, "stone", 1);
  p.px(x0, GY - 1, "stone", 3);
}

/** Hanging banner (11×13) with a 9×9 emblem window; returns the slot. */
function banner(p: Painter, x: number, y: number, ramp: "banner" | "roof" | "magic" | "meadow" = "banner") {
  const top = RAMPS[ramp].length - 1;
  p.hline(x - 1, x + 11, y - 1, "wood", 2);
  for (let r = 0; r < 12; r++) for (let c = 0; c < 11; c++) {
    const tail = r >= 10 && Math.abs(c - 5) < r - 9;          // swallow-tail notch
    if (tail) continue;
    const v = c === 0 ? top - 1 : c >= 9 ? 1 : 2;
    p.px(x + c, y + r, ramp, v);
  }
  p.vline(x + 0, y, y + 10, "gold", 3);
  p.vline(x + 10, y, y + 10, "gold", 1);
  return { x: x + 1, y: y + 1, w: 9, h: 9 };
}

function finish(p: Painter, x0: number, x1: number, slot?: Sprite["slot"]): Sprite {
  p.finish();
  const shadow = p.groundShadow(CX, GY - 1, (x1 - x0) / 2 + 3, 3);
  return p.done({ x: CX, y: GY }, { shadow, slot });
}

// ——————————————————————————— the 16 ———————————————————————————

/** classifier · convolution — the Lens Tower: a round keep with one great eye. */
function classifier(): Sprite {
  const p = new Painter(CASTLE_W, CASTLE_H);
  p.wall(5, 26, 26, 15, "stone");
  p.crenels(5, 26, 26, "stone");
  p.cylinder(12, 9, 12, 32, "stone");
  p.cone(CX, 0, 7, 8, "roof");
  // the eye: sclera, iris, pupil, glint
  p.ball(CX, 16, 4, 3, "snow", { mid: 4 });
  p.ball(CX, 16, 2, 2, "shallow", { mid: 3 });
  p.px(CX, 16, "ui", 0); p.px(CX + 1, 16, "ui", 0);
  p.px(CX - 1, 15, "foam", 1);
  // conv grid portcullis on the wall
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) p.rect(7 + c * 3, 30 + r * 3, 2, 2, "stone", 0);
  p.door(CX - 2, 34, 5, 7);
  const slot = banner(p, 21, 28);
  plinth(p, 4, 31);
  p.flag(CX, -1 + 0, "roof", 0, 0);
  return finish(p, 4, 31, slot);
}

/** tabular_classifier · mlp — the Layered Ziggurat: dense tiers of windows. */
function tabular(): Sprite {
  const p = new Painter(CASTLE_W, CASTLE_H);
  const tiers = [[4, 28, 13], [8, 20, 8], [11, 14, 6]] as const; // x, w… (x, y via stacking)
  let y = GY - 2;
  tiers.forEach(([x, w, h], k) => {
    y -= h;
    p.wall(x, y, w, h, "stone", { mid: 3 - (k === 2 ? 0 : 0) });
    p.hline(x - 1, x + w, y, "stone", 4);            // lit ledge
    const n = Math.floor((w - 2) / 3);
    for (let i = 0; i < n; i++) p.window(x + 2 + i * 3, y + 2, 1, 2 + (k === 0 ? 1 : 0), (i + k) % 3 !== 1);
  });
  p.flag(CX, y - 7, "banner", 5, 6);
  const slot = banner(p, 13, 31, "roof");
  plinth(p, 3, 32);
  return finish(p, 3, 32, slot);
}

/** rnn · recurrence — the Loop Mill: a mill house turned by a great wheel. */
function rnn(): Sprite {
  const p = new Painter(CASTLE_W, CASTLE_H);
  p.wall(12, 22, 20, 19, "stone");
  p.gable(10, 12, 24, 10, "roof");
  p.cylinder(27, 6, 5, 10, "stone");           // chimney tower
  p.cone(29, 1, 3, 5, "roof");
  p.window(15, 26, 2, 3, true); p.window(26, 26, 2, 3, true);
  p.door(20, 34, 5, 7);
  // the wheel (loop): rim, spokes, hub
  const wx = 10, wy = 29, r = 9;
  for (let a = 0; a < 64; a++) {
    const t = (a / 64) * Math.PI * 2;
    const x = Math.round(wx + Math.cos(t) * r), y = Math.round(wy + Math.sin(t) * r);
    const lit = Math.cos(t) + Math.sin(t) < 0;
    p.px(x, y, "wood", lit ? 5 : 2);
    p.px(Math.round(wx + Math.cos(t) * (r - 1)), Math.round(wy + Math.sin(t) * (r - 1)), "wood", lit ? 4 : 1);
  }
  for (let k = 0; k < 8; k++) {
    const t = (k / 8) * Math.PI * 2 + 0.2;
    p.line(wx, wy, Math.round(wx + Math.cos(t) * (r - 1)), Math.round(wy + Math.sin(t) * (r - 1)), "wood", 3);
    p.px(Math.round(wx + Math.cos(t) * (r + 1)), Math.round(wy + Math.sin(t) * (r + 1)), "wood", 2); // paddles
  }
  p.ball(wx, wy, 1, 1, "gold", { mid: 3 });
  // loop arrow on the gable
  const slot = banner(p, 17, 12 + 0, "banner");
  plinth(p, 2, 33);
  return finish(p, 2, 33, slot);
}

/** transformer · self-attention — the Attention Spire: one needle, many heads. */
function transformer(): Sprite {
  const p = new Painter(CASTLE_W, CASTLE_H);
  p.wall(3, 30, 30, 11, "stone");
  // heads: four side spires, nearer = shorter
  const heads = [[3, 26, 5], [28, 26, 5], [8, 21, 5], [23, 21, 5]] as const;
  for (const [x, y, w] of heads) {
    p.cylinder(x, y, w, 30 - y + 1, "stone");
    p.cone(x + 2, y - 6, 3, 6, "banner", { mid: 2 });
  }
  // the main needle: a tall narrow spire far above the heads
  p.cylinder(14, 17, 9, 14, "stone");
  p.cone(CX, 2, 4, 15, "banner", { mid: 2 });
  p.vline(CX - 1, 6, 16, "banner", 3);
  p.vline(CX, 0, 2, "gold", 3); p.px(CX, 0, "gold", 4);
  // attention threads from the needle to every head (gold)
  for (const [x, y] of heads) p.line(CX, 8, x + 2, y - 6, "gold", 3);
  p.window(16, 20, 2, 3, true); p.window(19, 20, 2, 3, true);
  p.door(CX - 2, 34, 5, 7);
  const slot = banner(p, 5, 29);
  plinth(p, 2, 33);
  return finish(p, 2, 33, slot);
}

/** mamba · selective scan — the Serpent Coil: a tower wrapped by a snake. */
function mamba(): Sprite {
  const p = new Painter(CASTLE_W, CASTLE_H);
  p.cylinder(11, 8, 14, 33, "stone");
  p.crenels(10, 8, 16, "stone");
  // serpent: diagonal bands wrapping the tower (front passes only)
  for (let band = 0; band < 3; band++) {
    const y0 = 14 + band * 10;
    for (let c = -1; c <= 14; c++) {
      const y = y0 + Math.round((c / 14) * 6);
      const x = 11 + c;
      const front = true;
      if (!front) continue;
      p.px(x, y, "meadow", 5); p.px(x, y + 1, "meadow", 4); p.px(x, y + 2, "meadow", 3); p.px(x, y + 3, "meadow", 1);
      if ((c + band) % 3 === 0) p.px(x, y + 1, "savanna", 4);        // belly scales
    }
  }
  // head rearing over the parapet
  p.ball(24, 4, 3, 2, "meadow", { mid: 4 });
  p.rect(22, 5, 3, 4, "meadow", 3);
  p.px(25, 3, "gold", 4); p.px(26, 5, "roof", 3); p.px(27, 5, "roof", 3); // eye + tongue
  p.px(9, 40, "meadow", 3); p.px(8, 40, "meadow", 2);                        // tail
  p.door(CX - 2, 35, 5, 6);
  const slot = banner(p, 22, 25, "meadow");
  plinth(p, 6, 30);
  return finish(p, 6, 30, slot);
}

/** gnn · message passing — the Graph Pavilions: domes linked by walkways. */
function gnn(): Sprite {
  const p = new Painter(CASTLE_W, CASTLE_H);
  const nodes = [[9, 30], [27, 30], [18, 17]] as const;
  // edges first (walkways on posts)
  for (const [a, b] of [[0, 1], [0, 2], [1, 2]] as const) {
    const [x0, y0] = nodes[a], [x1, y1] = nodes[b];
    p.line(x0, y0 - 3, x1, y1 - 3, "wood", 4);
    p.line(x0, y0 - 2, x1, y1 - 2, "wood", 2);
  }
  for (const [x, y] of nodes) {
    p.wall(x - 4, y - 4, 9, 8 + (y < 20 ? 6 : 0), "stone");
    p.dome(x, y - 5, 5, "shallow", { mid: 2 });
    p.px(x, y - 11, "gold", 4);
    p.window(x - 1, y - 1, 2, 3, true);
  }
  p.vline(18, 27, 40, "stone", 2);
  const slot = banner(p, 13, 28);
  plinth(p, 3, 32);
  return finish(p, 3, 32, slot);
}

/** vae · variational latent — the Hourglass Keep: wide, pinched, wide. */
function vae(): Sprite {
  const p = new Painter(CASTLE_W, CASTLE_H);
  for (let y = 6; y <= 40; y++) {
    const t = (y - 23) / 17;                 // -1 top … 0 waist … 1 base
    const half = Math.round(4 + 10 * t * t);
    for (let x = CX - half; x <= CX + half; x++) {
      const u = (x - (CX - half) + 0.5) / (2 * half + 1);
      let v = u < 0.2 ? 4 : u < 0.6 ? 3 : u < 0.85 ? 2 : 1;
      if (y % 4 === 3 && (x + (y >> 2)) % 3 === 0) v -= 1;
      p.px(x, y, "stone", v);
    }
  }
  p.crenels(CX - 14, 6, 29, "stone");
  // the latent: one glowing window at the waist
  p.rect(CX - 2, 21, 4, 4, "magic", 0);
  p.rect(CX - 1, 22, 2, 2, "magic", 2);
  p.px(CX - 1, 22, "foam", 1);
  p.window(9, 12, 2, 3, true); p.window(26, 12, 2, 3, false);
  p.door(CX - 2, 34, 5, 7);
  const slot = banner(p, 5, 29 - 0, "magic");
  plinth(p, 3, 32);
  return finish(p, 3, 32, slot);
}

/** gan · adversarial game — the Duelling Towers: red vs blue, swords crossed. */
function gan(): Sprite {
  const p = new Painter(CASTLE_W, CASTLE_H);
  p.wall(8, 31, 20, 10, "stone");
  p.cylinder(2, 12, 10, 29, "stone");
  p.cone(7, 3, 6, 9, "roof");
  p.cylinder(24, 12, 10, 29, "stone");
  p.cone(29, 3, 6, 9, "banner", { mid: 2 });
  p.window(5, 18, 2, 3, true); p.window(28, 18, 2, 3, true);
  // crossed swords between them
  p.line(12, 14, 23, 25, "snow", 4); p.line(23, 14, 12, 25, "snow", 3);
  p.line(13, 14, 23, 24, "stone", 2);
  p.hline(11, 14, 17, "gold", 3); p.hline(21, 24, 17, "gold", 2);
  p.door(CX - 2, 34, 5, 7);
  const slot = banner(p, 12, 26 + 0);
  plinth(p, 1, 34);
  return finish(p, 1, 34, slot);
}

/** diffusion · iterative denoising — the Mist Pagoda rising out of cloud. */
function diffusion(): Sprite {
  const p = new Painter(CASTLE_W, CASTLE_H);
  const tiers = [[8, 30, 20, 11], [10, 20, 16, 8], [12, 12, 12, 6]] as const;
  for (const [x, y, w, h] of tiers) {
    p.wall(x, y, w, h, "stone");
    p.gable(x - 3, y - 4, w + 6, 4, "shallow");
    p.window(x + (w >> 1) - 1, y + 2, 2, 3, true);
  }
  p.cone(CX, 0, 2, 7, "shallow", { mid: 3 });
  // cloud rings: puffs across the lower tiers (noise clearing upward)
  for (const [x, y, r] of [[5, 38, 4], [11, 40, 4], [26, 39, 5], [31, 36, 3], [4, 27, 3], [31, 25, 3]] as const) {
    p.ball(x, y, r, r - 1, "snow", { mid: 4, gain: 1.6 });
  }
  const slot = banner(p, 13, 25 + 5);
  plinth(p, 3, 33);
  return finish(p, 3, 33, slot);
}

/** pixelcnn · autoregressive — the Block Tower, built pixel by pixel. */
function pixelcnn(): Sprite {
  const p = new Painter(CASTLE_W, CASTLE_H);
  const B = 5;
  // raster order: rows bottom-up, left→right; the top row is only half-built
  const rows = [6, 6, 5, 5, 4, 2];
  rows.forEach((n, r) => {
    for (let c = 0; c < n; c++) {
      const x = 3 + c * B, y = GY - 2 - (r + 1) * B;
      const tone = (c + r) % 3;
      p.rect(x, y, B, B, "stone", 2 + (tone === 0 ? 1 : 0));
      p.hline(x, x + B - 1, y, "stone", 4); p.vline(x, y, y + B - 1, "stone", 4);
      p.hline(x, x + B - 1, y + B - 1, "stone", 1); p.vline(x + B - 1, y, y + B - 1, "stone", 1);
      if (tone === 1) p.px(x + 2, y + 2, "glow", 1);
    }
  });
  // the next block being placed (hovering, gold)
  const nx = 3 + 2 * B, ny = GY - 2 - 6 * B - 3;
  p.rect(nx, ny, B, B, "gold", 3); p.hline(nx, nx + B - 1, ny, "gold", 4); p.vline(nx + B - 1, ny, ny + B - 1, "gold", 1);
  p.vline(nx + 2, ny - 5, ny - 1, "wood", 1);           // crane cable
  p.hline(nx + 2, nx + 12, ny - 6, "wood", 3); p.vline(nx + 12, ny - 6, 12, "wood", 2);
  const slot = banner(p, 20, 29);
  plinth(p, 2, 33);
  return finish(p, 2, 33, slot);
}

/** segmentation · skip encoder-decoder — the U-Gate: towers joined by a skip bridge. */
function segmentation(): Sprite {
  const p = new Painter(CASTLE_W, CASTLE_H);
  // U: two tall arms + a deep low floor
  p.cylinder(3, 8, 9, 33, "stone");
  p.cylinder(24, 8, 9, 33, "stone");
  p.crenels(3, 8, 9, "stone"); p.crenels(24, 8, 9, "stone");
  p.wall(12, 34, 12, 7, "stone", { mid: 2 });
  // skip-connection bridges across the U (gold rails)
  for (const y of [13, 22]) {
    p.hline(12, 23, y, "wood", 4); p.hline(12, 23, y + 1, "wood", 2);
    for (let x = 13; x < 23; x += 3) p.px(x, y - 1, "gold", 3);
  }
  p.window(6, 26, 2, 3, true); p.window(27, 26, 2, 3, true);
  p.door(CX - 2, 35, 5, 6);
  const slot = banner(p, 13, 24 - 0);
  plinth(p, 2, 33);
  return finish(p, 2, 33, slot);
}

/** simclr · contrastive — the Magnet Twins: mirrored towers pulled together. */
function simclr(): Sprite {
  const p = new Painter(CASTLE_W, CASTLE_H);
  for (const x of [5, 22]) {
    p.cylinder(x, 16, 9, 25, "stone");
    p.cone(x + 4, 8, 5, 7, "roof");
  }
  // horseshoe magnet arch between the tips (red + silver poles)
  for (let a = 0; a <= 32; a++) {
    const t = Math.PI + (a / 32) * Math.PI;
    const x = Math.round(CX + Math.cos(t) * 8), y = Math.round(12 + Math.sin(t) * 9);
    p.px(x, y, "roof", 3); p.px(x, y + 1, "roof", 2); p.px(x, y + 2, "roof", 1);
  }
  p.rect(9, 11, 3, 3, "snow", 4); p.rect(25, 11, 3, 3, "snow", 3);
  // pull lines
  p.px(15, 22, "gold", 4); p.px(16, 22, "gold", 3); p.px(20, 22, "gold", 3); p.px(21, 22, "gold", 4);
  p.wall(14, 32, 8, 9, "stone");
  p.door(CX - 2, 35, 5, 6);
  const slot = banner(p, 3, 23 + 3, "roof");
  plinth(p, 3, 32);
  return finish(p, 3, 32, slot);
}

/** reinforce · policy gradient — the Dice Keep: a keep carved from a die. */
function reinforce(): Sprite {
  const p = new Painter(CASTLE_W, CASTLE_H);
  // isometric-ish die: front face + top face + side face
  const x = 6, y = 17, s = 20;
  for (let r = 0; r < 6; r++) p.hline(x + 6 - r, x + s + 5 - r, y - 6 + r, "snow", 5 - (r > 3 ? 1 : 0));      // top
  p.rect(x, y, s, s, "snow", 4);                                                                                // front
  for (let c = 0; c < 6; c++) p.vline(x + s + c, y - c, y + s - 1 - c, "snow", 2);                              // side
  for (const [px, py] of [[4, 4], [10, 10], [15, 15], [15, 4], [4, 15]] as const) p.rect(x + px - 1, y + py - 1, 3, 3, "roof", 2);
  for (const [px, py] of [[22, 4], [23, 13]] as const) p.rect(x + px, y + py, 2, 2, "roof", 1);
  p.rect(x + 9, y - 4, 3, 1, "roof", 3);
  p.door(x + 7, y + s - 7, 6, 7);
  p.flag(x + 12, y - 12, "banner", 6, 7);
  const slot = banner(p, 24, 29 + 0);
  plinth(p, 3, 34);
  return finish(p, 3, 34, slot);
}

/** rl_maze · value-based RL — the Maze Fort: hedge walls, a goal tower. */
function rlMaze(): Sprite {
  const p = new Painter(CASTLE_W, CASTLE_H);
  const maze = [
    "#############",
    "#...#.......#",
    "#.#.#.#####.#",
    "#.#...#...#.#",
    "#.#####.#.#.#",
    "#.....#.#...#",
    "###.#.#.###.#",
    "#...#...#...#",
    "#############",
  ];
  const ox = 3, oy = 22;
  maze.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const x = ox + c * 2 + (r > 0 ? 0 : 0), y = oy + r * 2;
      if (row[c] === "#") { p.rect(x, y, 2, 2, "meadow", 2); p.px(x, y, "meadow", 4); p.px(x + 1, y + 1, "meadow", 1); }
      else { p.rect(x, y, 2, 2, "sand", 4); }
    }
  });
  p.rect(ox + 2, oy + 2, 2, 2, "banner", 2);                    // the agent
  // goal tower top-right
  p.cylinder(24, 6, 8, 18, "stone");
  p.crenels(24, 6, 8, "stone");
  p.flag(28, -1 + 0, "gold", 5, 6);
  p.window(27, 12, 2, 3, true);
  // value trail
  for (const [c, r] of [[3, 3], [3, 5], [5, 5], [7, 5], [7, 7], [9, 7]] as const) p.px(ox + c * 2, oy + r * 2, "gold", 4);
  const slot = banner(p, 11, 5 + 3);
  plinth(p, 2, 30);
  return finish(p, 2, 30, slot);
}

/** nerf · neural field rendering — the Orbit Observatory. */
function nerf(): Sprite {
  const p = new Painter(CASTLE_W, CASTLE_H);
  p.wall(7, 26, 22, 15, "stone");
  p.dome(CX, 26, 11, "stone", { mid: 3 });
  p.vline(CX, 16, 25, "ui", 0);                                   // dome slit
  p.vline(CX + 1, 16, 25, "stone", 0);
  p.line(CX + 1, 17, CX + 9, 9, "gold", 2); p.line(CX + 1, 16, CX + 9, 8, "gold", 4); // telescope
  // orbit ring with 3 camera beads
  for (let a = 0; a < 90; a++) {
    const t = (a / 90) * Math.PI * 2;
    const x = Math.round(CX + Math.cos(t) * 16), y = Math.round(24 + Math.sin(t) * 5);
    const behind = Math.sin(t) < 0 && Math.abs(x - CX) < 11;
    if (behind) continue;
    p.px(x, y, "gold", Math.sin(t) > 0 ? 3 : 2);
  }
  for (const t of [0.4, 2.2, 3.5]) p.ball(Math.round(CX + Math.cos(t) * 16), Math.round(24 + Math.sin(t) * 5), 1, 1, "shallow", { mid: 3 });
  p.window(10, 31, 2, 3, true); p.window(24, 31, 2, 3, true);
  p.door(CX - 2, 34, 5, 7);
  const slot = banner(p, 26, 31 - 0, "banner");
  plinth(p, 5, 31);
  return finish(p, 5, 31, slot);
}

/** alphazero · tree search + self-play — the Rook: a chess rook keep. */
function alphazero(): Sprite {
  const p = new Painter(CASTLE_W, CASTLE_H);
  // flared base, straight body, flared crown with deep crenels
  for (let y = 4; y <= 40; y++) {
    let half = 8;
    if (y > 34) half = 8 + (y - 34);
    if (y < 12) half = 11;
    if (y >= 12 && y < 14) half = 9;
    for (let x = CX - half; x <= CX + half; x++) {
      if (y < 8 && (Math.floor((x - (CX - half)) / 4) % 2 === 1)) continue; // crenel gaps
      const u = (x - (CX - half) + 0.5) / (2 * half + 1);
      p.px(x, y, "stone", u < 0.2 ? 5 : u < 0.55 ? 4 : u < 0.8 ? 3 : 2);
    }
  }
  p.hline(CX - 11, CX + 11, 11, "stone", 2);
  p.hline(CX - 9, CX + 9, 34, "stone", 2);
  // search tree climbing the body (gold branches)
  p.vline(CX, 26, 33, "gold", 3);
  p.line(CX, 29, CX - 4, 25, "gold", 3); p.line(CX, 29, CX + 4, 25, "gold", 2);
  p.line(CX - 4, 25, CX - 6, 22, "gold", 3); p.line(CX - 4, 25, CX - 2, 22, "gold", 3); p.line(CX + 4, 25, CX + 6, 22, "gold", 2);
  for (const [x, y] of [[CX - 6, 21], [CX - 2, 21], [CX + 6, 21], [CX + 4, 24]] as const) p.px(x, y, "gold", 4);
  p.door(CX - 2, 35, 5, 6);
  const slot = banner(p, CX - 5, 13 - 0 - 1, "banner");
  plinth(p, 5, 31);
  return finish(p, 5, 31, slot);
}

/** mechanism atom name → castle factory. */
export const CASTLES: Record<string, () => Sprite> = {
  classifier, tabular_classifier: tabular, rnn, transformer, mamba, gnn, vae, gan, diffusion, pixelcnn,
  segmentation, simclr, reinforce, rl_maze: rlMaze, nerf, alphazero,
};

/** One-line description of each silhouette (specimen captions, README). */
export const CASTLE_NOTES: Record<string, string> = {
  classifier: "Lens Tower — one great eye over a conv-grid portcullis",
  tabular_classifier: "Layered Ziggurat — dense tiers of windows",
  rnn: "Loop Mill — a wheel that feeds back",
  transformer: "Attention Spire — one needle, gold threads to many heads",
  mamba: "Serpent Coil — a scan that winds up the tower",
  gnn: "Graph Pavilions — domes linked by walkways",
  vae: "Hourglass Keep — the bottleneck glows",
  gan: "Duelling Towers — red vs blue, swords crossed",
  diffusion: "Mist Pagoda — rising clear out of cloud",
  pixelcnn: "Block Tower — built block by block, raster order",
  segmentation: "U-Gate — skip bridges across the U",
  simclr: "Magnet Twins — mirrored views pulled together",
  reinforce: "Dice Keep — a policy that rolls",
  rl_maze: "Maze Fort — a value trail to the goal tower",
  nerf: "Orbit Observatory — cameras circling a dome",
  alphazero: "Rook — a search tree climbing the keep",
};
