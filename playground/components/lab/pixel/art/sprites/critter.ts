// The critter (the one-eyed perceptron blob, original character) as a
// contemporary pixel sprite, rasterised from the SHARED geometry
// (components/lab/shared/critter.ts) so every skin keeps one silhouette.
// 26×30 art px: gold body with sphere shading for the top-left light, a big
// eye, red Σ-tip antenna, selective outline. Frames:
//   walk[0..3]  bob + alternating feet
//   idle[0..1]  breathing / blink
//   train       squashed, glowing antenna, sparks + motion lines ("training")
import { CRITTER } from "@/components/lab/shared/critter";
import { Painter, type Sprite } from "./paint";
import { RAMPS } from "../palette";
import { bayer4 } from "../noise";

const SCALE = 5;          // viewBox units per art px → 24×28 body
const W = 26, H = 30;

interface Pose { bob: number; swing: number; squash?: number; blink?: boolean; glow?: boolean }

let ctx: CanvasRenderingContext2D | null = null;
function ctx2d() {
  if (!ctx) ctx = document.createElement("canvas").getContext("2d")!;
  return ctx;
}

function frame(pose: Pose): Sprite {
  const c = ctx2d();
  const body = new Path2D(CRITTER.body);
  const antenna = new Path2D(CRITTER.antenna);
  const smile = new Path2D(CRITTER.smile);
  const p = new Painter(W, H);
  const sq = pose.squash ?? 0;                                    // 0..1: squash toward the ground
  const inC = (x: number, y: number, k: { cx: number; cy: number; r: number }) => (x - k.cx) ** 2 + (y - k.cy) ** 2 <= k.r * k.r;
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const x = (px - 1 + 0.5) * SCALE;
    const yf = (py - 1 + 0.5) * SCALE;
    // squash: scale y about the feet line (y=118) and widen x a touch
    const yb0 = (py - 1 - pose.bob + 0.5) * SCALE;
    const yb = 118 - (118 - yb0) / (1 - sq * 0.18);
    const xb = 60 + (x - 60) / (1 + sq * 0.1);
    const [lf, rf] = CRITTER.feet;
    if (inC(x, yf, { cx: lf.cx + pose.swing * SCALE, cy: lf.cy, r: 9 }) || inC(x, yf, { cx: rf.cx - pose.swing * SCALE, cy: rf.cy, r: 9 })) {
      p.px(px, py, "rock", x < 60 ? 3 : 2);
    }
    c.lineWidth = 5;
    if (c.isPointInStroke(antenna, xb, yb)) p.px(px, py, "rock", 1);
    if (inC(xb, yb, CRITTER.antennaTip)) p.px(px, py, pose.glow ? "lava" : "roof", pose.glow ? 3 : (xb < 62 && yb < 11 ? 4 : 3));
    if (c.isPointInPath(body, xb, yb)) {
      // sphere shading around the body centre, light from the top-left
      const ex = (xb - 60) / 42, ey = (yb - 74) / 46;
      const d2 = ex * ex + ey * ey;
      const l = -(ex * 0.8 + ey * 0.9) * 0.9 + (1 - d2) * 0.25;
      let v = 2.7 + l * 2.1;
      const f = Math.floor(v);
      v = Math.abs(v - f - 0.5) < 0.12 ? (bayer4(px, py) < v - f ? f + 1 : f) : Math.round(v);
      let idx = RAMPS.gold[Math.max(1, Math.min(4, v))];
      if (inC(xb, yb, CRITTER.eye)) {
        idx = pose.blink ? (Math.abs(yb - CRITTER.eye.cy) < 3 ? RAMPS.rock[1] : RAMPS.gold[3]) : RAMPS.foam[1];
        if (!pose.blink && (xb - CRITTER.eye.cx) + (yb - CRITTER.eye.cy) > 14) idx = RAMPS.snow[3];   // eye shade
        if (!pose.blink && inC(xb, yb, CRITTER.pupil)) idx = RAMPS.ui[0];
        if (!pose.blink && inC(xb, yb, { cx: CRITTER.pupil.cx - 3, cy: CRITTER.pupil.cy - 3, r: 2.2 })) idx = RAMPS.foam[1];
      }
      c.lineWidth = 6;
      if (c.isPointInStroke(smile, xb, yb)) idx = RAMPS.rock[1];
      p.set(px, py, idx);
    }
  }
  // eye ring: sclera pixels touching body become a warm dark ring
  const sclera = new Set([RAMPS.foam[1], RAMPS.snow[3], RAMPS.ui[0]]);
  const body4 = new Set(RAMPS.gold);
  const d = new Uint8Array(p.img.data);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = d[y * W + x];
    if (!sclera.has(v)) continue;
    const n = [d[(y - 1) * W + x], d[(y + 1) * W + x], d[y * W + x - 1], d[y * W + x + 1]];
    if (n.some((k) => body4.has(k))) p.img.data[y * W + x] = RAMPS.rock[2];
  }
  if (pose.glow) {
    for (const [x, y] of [[17, 0], [11, 1], [18, 3]] as const) p.px(x, y, "gold", 4);
    for (const y of [12, 16, 20]) { p.px(0, y, "snow", 3); p.px(1, y, "snow", 4); p.px(25, y + 1, "snow", 3); }
  }
  p.finish();
  return p.done({ x: 13, y: 28 }, { shadow: p.groundShadow(13, 28, 7, 1.5) });
}

export interface CritterSheet { walk: Sprite[]; idle: Sprite[]; train: Sprite }

let cache: CritterSheet | null = null;
export function critterSheet(): CritterSheet {
  if (cache) return cache;
  cache = {
    walk: [
      frame({ bob: 0, swing: 0 }),
      frame({ bob: -1, swing: 1 }),
      frame({ bob: 0, swing: 0 }),
      frame({ bob: -1, swing: -1 }),
    ],
    idle: [frame({ bob: 0, swing: 0 }), frame({ bob: 0, swing: 0, blink: true, squash: 0.25 })],
    train: frame({ bob: 0, swing: 0, squash: 0.6, glow: true }),
  };
  return cache;
}
