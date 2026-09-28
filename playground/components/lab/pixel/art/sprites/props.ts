// Props: foliage per biome, rocks, peaks, houses, harbour, boat, train,
// bridge, clouds, ruins, the dragon and the compass rose. All lit top-left,
// selective outlines, ramps from art/palette.ts. Sizes in art px.
import { Painter, type Sprite } from "./paint";
import type { RampName } from "../palette";

const s = (p: Painter, ax: number, ay: number, shadow?: [number, number, number, number]) => {
  p.finish();
  return p.done({ x: ax, y: ay }, shadow ? { shadow: p.groundShadow(...shadow) } : {});
};

// ——————————————————————————— foliage ———————————————————————————

/** Clump of 3–4 round canopies (meadow / olive acacia / charred / frosted). */
export function treeClump(kind: "meadow" | "olive" | "ember" | "frost" = "meadow"): Sprite {
  const p = new Painter(24, 20);
  const canopy: RampName = kind === "olive" ? "olive" : kind === "ember" ? "rock" : kind === "frost" ? "pine" : "forest";
  const blobs = kind === "olive"
    ? [[7, 7, 6, 3], [17, 9, 5, 3]]
    : [[8, 9, 5, 5], [16, 8, 4, 4], [12, 13, 5, 4], [18, 13, 3, 3]];
  // trunks
  for (const [x, y, , ry] of blobs) { p.vline(x, y + ry - 1, y + ry + 3, "wood", 2); p.px(x + 1, y + ry + 1, "wood", 1); }
  for (const [x, y, rx, ry] of blobs) {
    p.ball(x, y, rx, ry, canopy, { mid: kind === "ember" ? 2 : 3, spec: true });
    if (kind === "frost") { p.hline(x - rx + 2, x + 1, y - ry + 1, "snow", 5); p.px(x - 1, y - ry, "snow", 4); }
    if (kind === "ember") p.px(x + 1, y + 1, "lava", 2);
  }
  return s(p, 12, 18, [13, 18, 10, 2]);
}

/** Palm: curved trunk + five fronds + coconuts. */
export function palm(): Sprite {
  const p = new Painter(16, 20);
  for (let y = 7; y <= 18; y++) { const x = 8 + Math.round(Math.sin((y - 7) / 5) * 1.5); p.px(x, y, "wood", 4); p.px(x + 1, y, "wood", 2); if (y % 2) p.px(x, y, "wood", 3); }
  const fronds = [[-7, 3], [-5, -2], [0, -4], [5, -2], [7, 3]] as const;
  for (const [dx, dy] of fronds) {
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      const x = Math.round(8 + dx * t), y = Math.round(6 + dy * t + (Math.abs(dx) > 4 ? t * t * 3 : 0));
      p.px(x, y, "forest", dx < 0 || dy < -2 ? 5 : 3);
      if (k > 1 && k < 6) p.px(x, y + 1, "forest", 2);
    }
  }
  p.px(8, 7, "wood", 1); p.px(9, 7, "wood", 2);
  return s(p, 9, 19, [9, 19, 4, 1]);
}

/** Pine: tiered cone, optional snow on the tiers. */
export function pine(snow = false): Sprite {
  const p = new Painter(12, 18);
  for (const [y, hw] of [[9, 5], [5, 4], [1, 3]] as const) {
    p.cone(6, y, hw, 6, "pine", { mid: 3, eave: false });
    if (snow) { p.hline(6 - hw + 1, 5, y + 6, "snow", 5); p.px(6, y, "snow", 5); }
  }
  p.vline(6, 16, 17, "wood", 2);
  return s(p, 6, 17, [7, 17, 4, 1]);
}

/** Rocks: boulder pair (0) or a single outcrop (1), in the given ramp. */
export function rock(v = 0, ramp: RampName = "stone"): Sprite {
  const p = new Painter(14, 10);
  if (v === 0) { p.ball(5, 6, 4, 3, ramp, { mid: 3, spec: true }); p.ball(10, 7, 2, 2, ramp, { mid: 3 }); }
  else { p.ball(7, 5, 5, 4, ramp, { mid: 3, spec: true }); p.line(5, 3, 8, 6, ramp, 1); }
  return s(p, 7, 9, [7, 9, 6, 1]);
}

/** Faceted peak: lit left face, shadow right face, snow cap with lavender shade. */
export function snowPeak(ramp: RampName = "rock"): Sprite {
  const p = new Painter(28, 20);
  const apex = 11, base = 18;
  for (let y = 2; y <= base; y++) {
    const t = (y - 2) / (base - 2);
    const l = Math.round(apex - t * 11), r = Math.round(apex + t * 14);
    for (let x = l; x <= r; x++) {
      const lit = x <= apex + Math.round(t * 2);
      const snow = y < 2 + 7 - ((x * 5) % 3);
      if (snow) p.px(x, y, "snow", lit ? 5 : 2);
      else p.px(x, y, ramp, lit ? 4 : x > r - 2 ? 1 : 2);
    }
  }
  // secondary ridge + crevice lines
  p.line(apex, 3, apex + 4, base, ramp, 1);
  p.line(apex - 4, 12, apex - 6, base, ramp, 3);
  return s(p, 13, 18, [14, 18, 12, 1]);
}

// ——————————————————————————— settlements ———————————————————————————

/** Houses: 0 red gable cottage, 1 blue-roof townhouse, 2 thatched hut, 3 tower house. */
export function house(v = 0, lit = true): Sprite {
  const p = new Painter(14, 16);
  const roof: RampName = v === 1 ? "banner" : v === 2 ? "savanna" : "roof";
  if (v === 3) {
    p.cylinder(3, 5, 7, 10, "stone");
    p.cone(6, 0, 4, 5, "roof");
    p.window(5, 8, 2, 2, lit);
  } else {
    p.wall(2, 8, 10, 7, v === 2 ? "wood" : "stone", { mid: v === 2 ? 3 : 4 });
    p.gable(1, 3, 12, 5, roof);
    p.window(4, 10, 2, 2, lit);
    p.door(8, 10, 3, 5);
    if (v === 0) { p.rect(9, 1, 2, 3, "stone", 2); p.px(9, 1, "stone", 4); }       // chimney
  }
  return s(p, 7, 15, [7, 15, 6, 1]);
}

/** Harbour pier: planks on posts, a bollard and a lantern. Horizontal, 28×10. */
export function pier(): Sprite {
  const p = new Painter(28, 12);
  p.rect(0, 3, 27, 4, "wood", 4);
  for (let x = 0; x < 27; x += 3) p.vline(x, 3, 6, "wood", 3);
  p.hline(0, 26, 3, "wood", 5);
  for (const x of [1, 9, 17, 25]) { p.vline(x, 7, 10, "wood", 1); p.px(x, 7, "wood", 2); }
  p.rect(22, 1, 2, 2, "stone", 2);                       // bollard
  p.vline(4, -1 + 1, 2, "stone", 1); p.px(4, 0, "glow", 2);  // lantern
  return s(p, 0, 5);
}

/** Boat: unmistakable hull (dark wood, lit gunwale) + a big cream sail + pennant. */
export function boat(flip = false): Sprite {
  const p = new Painter(18, 18);
  // sail (triangle, lit left) + jib
  for (let y = 2; y <= 11; y++) {
    const w = Math.round((y - 2) * 0.75);
    for (let x = 8 - w; x <= 8; x++) p.px(x, y, "sand", x === 8 - w ? 5 : 5 - (x > 6 ? 1 : 0));
    const j = Math.round((y - 4) * 0.45);
    if (y > 4) for (let x = 10; x <= 10 + j; x++) p.px(x, y, "sand", 4);
  }
  p.vline(9, 1, 12, "wood", 1);
  p.px(10, 1, "roof", 3); p.px(11, 1, "roof", 3); p.px(10, 2, "roof", 2);
  // hull
  for (let y = 12; y <= 15; y++) {
    const inset = y - 12;
    for (let x = 1 + inset; x <= 16 - inset; x++) p.px(x, y, "wood", y === 12 ? 4 : y === 13 ? 3 : 2);
  }
  p.hline(1, 16, 12, "wood", 5);
  p.px(4, 13, "gold", 3);
  const sp = s(p, 9, 16);
  if (flip) {
    const d = sp.img.data, w = sp.img.w;
    for (let y = 0; y < sp.img.h; y++) d.subarray(y * w, y * w + w).reverse();
  }
  return sp;
}

/** Train engine (0) or carriage (1), side view facing right. */
export function train(v = 0): Sprite {
  const p = new Painter(v === 0 ? 18 : 14, 12);
  if (v === 0) {
    p.cylinder(1, 3, 10, 6, "banner", { mid: 2, courses: false });  // boiler
    p.rect(10, 1, 6, 8, "roof", 2); p.hline(10, 15, 1, "roof", 4);    // cab
    p.window(12, 3, 2, 2, true);
    p.rect(3, 0, 2, 3, "stone", 1); p.px(3, 0, "stone", 3);           // chimney
    p.px(0, 6, "glow", 2);                                             // lamp
  } else {
    p.rect(0, 2, 13, 7, "savanna", 3); p.hline(0, 12, 2, "savanna", 5);
    for (const x of [2, 6, 10]) p.window(x, 4, 2, 2, true);
  }
  const w = p.w;
  for (const x of v === 0 ? [3, 8, 13] : [3, 9]) { p.ball(x, 10, 1, 1, "stone", { mid: 1 }); p.px(x, 10, "stone", 3); }
  p.hline(0, w - 1, 9, "stone", 0);
  return s(p, w >> 1, 11);
}

/** Bridge planks across a river: horizontal (h) or vertical (v). */
export function bridge(axis: "h" | "v" = "h"): Sprite {
  const p = new Painter(axis === "h" ? 20 : 10, axis === "h" ? 10 : 20);
  if (axis === "h") {
    for (let x = 0; x < 20; x++) p.vline(x, 2, 7, "wood", x % 3 === 0 ? 2 : 4);
    p.hline(0, 19, 1, "wood", 5); p.hline(0, 19, 8, "wood", 1);
    for (const x of [0, 19]) p.vline(x, 0, 9, "wood", 1);
  } else {
    for (let y = 0; y < 20; y++) p.hline(2, 7, y, "wood", y % 3 === 0 ? 2 : 4);
    p.vline(1, 0, 19, "wood", 5); p.vline(8, 0, 19, "wood", 1);
  }
  return s(p, p.w >> 1, p.h >> 1);
}

// ——————————————————————————— sky ———————————————————————————

/** Chunky cloud: cream top lobes, lavender underside. Variants 0–2; `k` = size multiplier (map clouds use 2). */
export function cloud(v = 0, k = 1): Sprite {
  const base = [
    [[8, 10, 6, 5], [17, 7, 7, 6], [26, 10, 6, 5], [14, 12, 9, 3]],
    [[7, 9, 5, 4], [15, 6, 6, 5], [23, 8, 6, 5], [31, 11, 4, 3], [18, 12, 12, 3]],
    [[6, 7, 5, 4], [13, 5, 5, 4], [18, 8, 4, 3], [12, 9, 7, 2]],
  ][v % 3];
  const lobes = base.map(([x, y, rx, ry]) => [x * k, y * k, rx * k, ry * k]);
  const W = (v === 1 ? 38 : v === 2 ? 24 : 34) * k, H = (v === 2 ? 13 : 17) * k;
  const p = new Painter(W, H);
  for (const [x, y, rx, ry] of lobes) p.ball(x, y, rx, ry, "snow", { mid: 4, gain: 1.3 });
  // flat lavender underside band (2 steps, thicker for big clouds)
  const bottom = Math.max(...lobes.map(([, y, , ry]) => y + ry));
  const band = 2 * k;
  for (let x = 0; x < W; x++) for (let y = bottom - band; y <= bottom; y++) {
    if (p.get(x, y) !== 255) p.px(x, y, "snow", y > bottom - k ? 1 : 2);
  }
  p.finish({ rim: false });
  return p.done({ x: W >> 1, y: H >> 1 });
}

// ——————————————————————————— lore ———————————————————————————

/** Ruins: broken columns + a half arch on a cracked stone floor. */
export function ruins(): Sprite {
  const p = new Painter(24, 20);
  p.rect(1, 16, 22, 3, "stone", 2); p.hline(1, 22, 16, "stone", 4);
  p.cylinder(3, 5, 4, 11, "sand", { mid: 4 });                 // tall column
  p.rect(2, 4, 6, 2, "sand", 5);
  p.cylinder(10, 10, 4, 6, "sand", { mid: 4 });                // broken stub
  p.line(10, 10, 13, 9, "sand", 5);
  // half arch
  for (let a = 0; a <= 12; a++) {
    const t = Math.PI + (a / 24) * Math.PI;
    p.rect(Math.round(20 + Math.cos(t) * 5), Math.round(12 + Math.sin(t) * 7), 2, 2, "sand", a < 6 ? 5 : 3);
  }
  p.cylinder(18, 12, 3, 4, "sand", { mid: 3 });
  p.rect(14, 15, 3, 1, "sand", 3); p.px(8, 17, "stone", 1); p.px(15, 18, "stone", 1);  // rubble + cracks
  p.px(6, 3, "meadow", 4); p.px(7, 3, "meadow", 3);           // moss on the capital
  return s(p, 12, 19, [12, 19, 11, 1]);
}

/** "?" stone for the hidden island's silhouettes. */
export function questionStone(): Sprite {
  const p = new Painter(14, 18);
  p.ball(7, 9, 5, 7, "stone", { mid: 2 });
  p.rows(4, 4, [
    ".###.",
    "#...#",
    "...#.",
    "..#..",
    "..#..",
    ".....",
    "..#..",
  ], { "#": ["magic", 2] });
  return s(p, 7, 17, [7, 17, 5, 1]);
}

/** A friendly dragon (original): round belly, stubby wings, curled tail, smoke puff. */
export function dragon(): Sprite {
  const p = new Painter(40, 30);
  // tail curl
  for (let a = 0; a < 40; a++) {
    const t = (a / 40) * Math.PI * 1.6;
    const r = 7 - a * 0.12;
    p.ball(Math.round(29 + Math.cos(t) * r), Math.round(21 - Math.sin(t) * r * 0.8), 1, 1, "meadow", { mid: 3 });
  }
  // wing (behind)
  p.rows(14, 2, [
    "......##",
    ".....###",
    "...#####",
    "..######",
    ".#######",
    "########",
  ], { "#": ["shallow", 2] });
  p.line(15, 7, 21, 2, "shallow", 0);
  p.ball(18, 18, 9, 7, "meadow", { mid: 4, spec: true });          // body
  p.ball(17, 21, 5, 4, "savanna", { mid: 4 });                       // belly
  for (let y = 18; y <= 24; y += 2) p.hline(14, 20, y, "savanna", 3);
  p.ball(8, 10, 6, 5, "meadow", { mid: 4, spec: true });             // head
  p.ball(4, 12, 3, 2, "meadow", { mid: 4 });                         // snout
  p.px(2, 11, "meadow", 0);                                          // nostril
  p.rect(8, 8, 3, 3, "foam", 1); p.px(9, 9, "ui", 0); p.px(10, 9, "ui", 0); // eye
  p.px(8, 8, "foam", 1);
  p.line(7, 5, 5, 2, "gold", 3); p.line(10, 5, 11, 2, "gold", 3);   // horns
  p.hline(4, 7, 14, "roof", 1);                                     // smile
  for (const [x, y] of [[12, 24], [22, 24]] as const) p.rect(x, y, 3, 3, "meadow", 2);  // feet
  for (let k = 0; k < 4; k++) p.px(14 + k * 3, 11 - (k % 2), "roof", 3);  // back spines
  // smoke puff
  p.ball(0 + 1, 7, 1, 1, "snow", { mid: 3 });
  const sp = s(p, 18, 27, [18, 27, 12, 2]);
  return sp;
}

/** Compass rose: chunky gold N/W/E/S letters (hand-placed) round a star. 40×40. */
export function compass(): Sprite {
  const p = new Painter(42, 42);
  const L = { "#": ["gold", 3], "+": ["gold", 4], "-": ["gold", 1] } as const;
  const N = ["#...#", "##..#", "#+#.#", "#..##", "#...#"];
  const E = ["####", "#...", "###.", "#...", "####"];
  const S = [".###", "#...", ".##.", "...#", "###."];
  const W = ["#...#", "#...#", "#.#.#", "##.##", "#...#"];
  // star: 4 long points (lit/shadow halves) + 4 short diagonals
  const c = 21;
  for (let k = 0; k <= 9; k++) {
    const hw = Math.max(0, 2 - Math.floor(k / 3));
    for (let d = -hw; d <= hw; d++) {
      p.px(c + d, c - k, "gold", d <= 0 ? 4 : 2);  // N
      p.px(c + d, c + k, "gold", d <= 0 ? 3 : 1);  // S
      p.px(c - k, c + d, "gold", d <= 0 ? 4 : 2);  // W
      p.px(c + k, c + d, "gold", d <= 0 ? 3 : 1);  // E
    }
  }
  for (let k = 1; k <= 5; k++) for (const [sx, sy] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) p.px(c + sx * k, c + sy * k, "roof", sx + sy < 0 ? 3 : 2);
  p.ball(c, c, 2, 2, "gold", { mid: 3, spec: true });
  p.rows(c - 2, 0, N, L); p.rows(c - 1, 37, S, L); p.rows(37, c - 2, E, L); p.rows(0, c - 2, W, L);
  p.finish({ litLine: true });
  return p.done({ x: c, y: c });
}
