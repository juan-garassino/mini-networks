// Derived-model level markers (one per non-atom model, 2×2-tile footprint =
// 16×16 art px, drawn 20×24 standing up) and capital city clusters.
//
// Marker = stone pedestal + round medallion carrying the model's emblem
// (7×7 slot), dressed by EVIDENCE STATE so it reads at a glance:
//   champion     gold medallion + gold star + sparkles
//   trained      royal-blue medallion + pennant (lit)
//   provisional  grey medallion inside a wooden scaffold with a "?" board
//   untrained    dim, unlit stone medallion, ghosted emblem, a crack
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { Painter, type Sprite } from "./paint";
import { RAMPS, type RampName } from "../palette";

export const MARKER_W = 20;
export const MARKER_H = 28;

export interface EmblemMaskLike { size: number; bits: Uint8Array }

const FACE: Record<EvidenceState, { rim: RampName; face: RampName; mid: number; glyph: number; drop?: number }> = {
  champion:    { rim: "gold",   face: "gold",   mid: 3, glyph: RAMPS.rock[1], drop: RAMPS.gold[4] },
  trained:     { rim: "stone",  face: "banner", mid: 2, glyph: RAMPS.foam[1], drop: RAMPS.banner[0] },
  provisional: { rim: "stone",  face: "stone",  mid: 3, glyph: RAMPS.stone[0], drop: RAMPS.stone[5] },
  untrained:   { rim: "stone",  face: "stone",  mid: 1, glyph: RAMPS.stone[3] },
};

export function marker(state: EvidenceState, emblem?: EmblemMaskLike): Sprite {
  const p = new Painter(MARKER_W, MARKER_H);
  const f = FACE[state];
  const cx = 10, cy = 14;
  // pedestal
  const pedMid = state === "untrained" ? 1 : 3;
  p.rect(5, 21, 10, 5, "stone", pedMid);
  p.hline(4, 15, 20, "stone", pedMid + 1); p.hline(4, 15, 25, "stone", pedMid - 1);
  p.vline(5, 21, 24, "stone", pedMid + 1);
  // scaffold behind (provisional)
  if (state === "provisional") {
    p.vline(2, 5, 26, "wood", 3); p.vline(17, 5, 26, "wood", 2);
    p.hline(1, 18, 6, "wood", 4); p.line(2, 25, 17, 8, "wood", 2);
  }
  // medallion: rim ring + shaded face
  p.ball(cx, cy, 7, 7, f.rim, { mid: state === "untrained" ? 1 : 3 });
  p.ball(cx, cy, 5, 5, f.face, { mid: f.mid, gain: 1.2 });
  const slot = { x: cx - 3, y: cy - 3, w: 7, h: 7 };
  if (emblem) stampInto(p, slot, emblem, f.glyph, f.drop);
  if (state === "untrained") { p.line(13, 9, 11, 13, "stone", 0); p.px(12, 14, "stone", 0); }
  if (state === "champion") {
    // five-point star crowning the medallion + sparkles
    p.rows(7, 0, [
      "...#...",
      "..###..",
      "#######",
      ".#####.",
      ".##.##.",
    ].map((r) => r), { "#": ["gold", 4] });
    p.px(10, 1, "foam", 1);
    for (const [x, y] of [[2, 8], [18, 15], [2, 19]] as const) { p.px(x, y, "foam", 1); p.px(x - 1, y, "gold", 4); p.px(x + 1, y, "gold", 4); p.px(x, y - 1, "gold", 4); p.px(x, y + 1, "gold", 4); }
  }
  if (state === "trained") {
    p.vline(16, 1, 9, "stone", 1);
    p.rows(17, 1, ["###", "##.", "#.."], { "#": ["banner", 2] });
    p.px(16, 0, "gold", 4);
  }
  if (state === "provisional") {
    // hanging "?" board
    p.vline(14, 0, 2, "wood", 1);
    p.rect(11, 2, 7, 8, "wood", 5); p.vline(17, 2, 9, "wood", 3); p.hline(11, 17, 9, "wood", 3);
    p.rows(12, 3, [".###.", "....#", "..##.", ".....", "..#.."], { "#": ["roof", 1] });
  }
  p.finish();
  return p.done({ x: 10, y: 26 }, { shadow: p.groundShadow(10, 26, 7, 2), slot });
}

/** Stamp a 1-bit emblem (any size) centred into a slot. */
export function stampInto(p: Painter, slot: { x: number; y: number; w: number; h: number }, m: EmblemMaskLike, fill: number, drop?: number) {
  const ox = slot.x + ((slot.w - m.size) >> 1), oy = slot.y + ((slot.h - m.size) >> 1);
  p.mask(ox, oy, m.bits, m.size, fill, drop);
}

/** Capital cluster: a gold-domed hall ringed by houses, lit windows, wall stubs. 52×40. */
export function capital(v = 0): Sprite {
  const p = new Painter(52, 40);
  const roofA: RampName = v % 2 ? "banner" : "roof";
  // back row houses
  for (const [x, y, w, r] of [[2, 14, 12, roofA], [37, 12, 13, "roof"], [14, 8, 10, "savanna"]] as const) {
    p.wall(x, y + 5, w, 9, "stone", { mid: 4 });
    p.gable(x - 1, y, w + 2, 5, r);
    p.window(x + 2, y + 7, 2, 2, true);
    if (w > 11) p.window(x + w - 4, y + 7, 2, 2, (x & 1) === 0);
  }
  // the hall + dome
  p.wall(17, 18, 18, 16, "stone", { mid: 4 });
  p.dome(26, 18, 8, "gold", { mid: 3 });
  p.vline(26, 6, 9, "gold", 4); p.px(26, 5, "foam", 1);
  for (const x of [19, 23, 28, 32]) p.window(x, 22, 2, 4, true);
  p.door(24, 28, 5, 6);
  // front row houses
  for (const [x, y, w, r] of [[1, 26, 11, "roof"], [39, 25, 12, roofA]] as const) {
    p.wall(x, y + 4, w, 8, "stone", { mid: 3 });
    p.gable(x - 1, y, w + 2, 4, r);
    p.window(x + 2, y + 6, 2, 2, true); p.window(x + w - 4, y + 6, 2, 2, true);
  }
  // wall stubs + banner flags
  p.rect(12, 34, 5, 3, "stone", 2); p.rect(35, 34, 5, 3, "stone", 2);
  p.flag(15, 10, "banner", 4, 5); p.flag(44, 5, "roof", 4, 6);
  p.finish();
  return p.done({ x: 26, y: 37 }, { shadow: p.groundShadow(26, 37, 25, 3) });
}
