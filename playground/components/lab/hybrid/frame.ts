// Camera framing that respects the chrome: the target is fitted into the
// part of the viewport NOT covered by windows, so the focused node is never
// under a status window or bottom sheet.
import type { CamBox } from "@/components/lab/shared/camera";
import type { Box, Pt, World } from "@/lib/world";

export interface Insets { l: number; r: number; t: number; b: number }

/** Full-viewport camera box that shows `target` centred inside the insets. */
export function frameInto(target: Box, vw: number, vh: number, ins: Insets): CamBox {
  const iw = Math.max(80, vw - ins.l - ins.r);
  const ih = Math.max(80, vh - ins.t - ins.b);
  const k = Math.min(iw / target.w, ih / target.h);         // screen px per world px
  const cx = target.x + target.w / 2, cy = target.y + target.h / 2;
  return {
    x: cx - (ins.l + iw / 2) / k,
    y: cy - (ins.t + ih / 2) / k,
    w: vw / k,
    h: vh / k,
  };
}

export function unionBox(boxes: Box[]): Box {
  const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w)), y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function pointsBox(p: Pt[], pad: number): Box {
  const xs = p.map((q) => q.x), ys = p.map((q) => q.y);
  const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
  return { x: x0, y: y0, w: Math.max(...xs) + pad - x0, h: Math.max(...ys) + pad - y0 };
}

/** All land, without the sea margin. */
export const landBox = (world: World): Box => unionBox(Object.values(world.camera.regions));

/**
 * Node view target: the contract's tight node box grown ×2.5 around the
 * focus, joined with the critter's walk home when that stays readable.
 */
export function nodeBox(world: World, name: string, walk: Pt[]): Box {
  const c = world.camera.nodes[name];
  const grow: Box = { x: c.focus.x - c.box.w * 1.25, y: c.focus.y - c.box.h * 1.25, w: c.box.w * 2.5, h: c.box.h * 2.5 };
  if (walk.length < 2) return grow;
  const u = unionBox([grow, pointsBox(walk, 56)]);
  return u.w <= 720 && u.h <= 560 ? u : grow;
}
