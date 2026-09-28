// The learner's avatar as a 4-frame walk-cycle sprite sheet, rasterised from
// the SHARED critter geometry (components/lab/shared/critter.ts) so the pixel
// skin's blob keeps the exact one-eyed perceptron silhouette of the other
// skins. Output is ordinary sprite rows (same format as sprites.ts).
import { CRITTER } from "@/components/lab/shared/critter";
import type { SpriteRows } from "./sprites";

const SCALE = 5;              // viewBox units per pixel → 24×28 sprite
const W = 24 + 2, H = 28 + 2; // +1px outline margin all round

// Per-frame body bob (px) and foot swing (px, viewBox units ×SCALE).
const FRAMES = [
  { bob: 0, swing: 0 },
  { bob: -1, swing: 1 },
  { bob: 0, swing: 0 },
  { bob: -1, swing: -1 },
];

// 0 ink outline · 4 body · 3 body shade · c eye · 2 antenna tip (Σ) · f antenna · e feet
export function critterFrames(): SpriteRows[] {
  const cv = document.createElement("canvas");
  const ctx = cv.getContext("2d")!;
  const body = new Path2D(CRITTER.body);
  const antenna = new Path2D(CRITTER.antenna);
  const smile = new Path2D(CRITTER.smile);
  const inCircle = (x: number, y: number, c: { cx: number; cy: number; r: number }) =>
    (x - c.cx) ** 2 + (y - c.cy) ** 2 <= c.r * c.r;

  return FRAMES.map(({ bob, swing }) => {
    const grid: string[][] = Array.from({ length: H }, () => Array(W).fill("."));
    const isBody = (px: number, py: number) => {
      const x = (px - 1 + 0.5) * SCALE, y = (py - 1 - bob + 0.5) * SCALE;
      return ctx.isPointInPath(body, x, y);
    };
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const x = (px - 1 + 0.5) * SCALE;
        const yb = (py - 1 - bob + 0.5) * SCALE; // body-space y (bobs)
        const yf = (py - 1 + 0.5) * SCALE;       // feet stay on the ground
        let ch = ".";
        const [lf, rf] = CRITTER.feet;
        if (inCircle(x, yf, { cx: lf.cx + swing * SCALE, cy: lf.cy, r: 9 }) || inCircle(x, yf, { cx: rf.cx - swing * SCALE, cy: rf.cy, r: 9 })) ch = "e";
        ctx.lineWidth = 5;
        if (ctx.isPointInStroke(antenna, x, yb)) ch = "f";
        if (inCircle(x, yb, CRITTER.antennaTip)) ch = "2";
        if (ctx.isPointInPath(body, x, yb)) {
          ch = !isBody(px + 1, py) || !isBody(px, py + 1) || yb > 104 ? "3" : "4";
          if (inCircle(x, yb, CRITTER.eye)) ch = "c";
          if (inCircle(x, yb, CRITTER.pupil)) ch = "0";
          ctx.lineWidth = 6;
          if (ctx.isPointInStroke(smile, x, yb)) ch = "0";
        }
        grid[py][px] = ch;
      }
    }
    // eye ring: eye-white pixels touching body become ink, so the eye reads
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      if (grid[py][px] !== "c") continue;
      const n = [grid[py - 1]?.[px], grid[py + 1]?.[px], grid[py][px - 1], grid[py][px + 1]];
      if (n.some((c) => c === "4" || c === "3")) grid[py][px] = "0";
    }
    // 1px ink outline around the whole silhouette
    const out = grid.map((r) => [...r]);
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      if (grid[py][px] !== ".") continue;
      const n = [grid[py - 1]?.[px], grid[py + 1]?.[px], grid[py][px - 1], grid[py][px + 1]];
      if (n.some((c) => c !== undefined && c !== "." && c !== "0")) out[py][px] = "0";
    }
    return out.map((r) => r.join(""));
  });
}
