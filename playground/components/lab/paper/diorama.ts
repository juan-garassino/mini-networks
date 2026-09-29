// The diorama camera (round 3): the flat map is the GROUND PLANE, tilted away
// from the viewer with a CSS perspective (the far edge recedes), and props
// stand up on it as billboards drawn in screen space at their projected base.
//
// flat  = the untilted camera view in screen px (what useCamera frames)
// screen = after the tilt. project() / unproject() convert between them with
// the same maths the CSS transform uses, so picking stays exact:
//   CSS: transform-origin (ox, oy); transform: perspective(P) rotateX(A)
//   rotateX(A):  y' = y·cosA,  z = y·sinA      (y relative to the origin)
//   perspective: w = 1 − z/P,  X = x/w,  Y = y'/w
import type { Box, Pt } from "@/lib/world";

export interface Tilt {
  /** degrees; 0 = flat map */
  angle: number;
  /** CSS perspective distance, px */
  persp: number;
  /** origin as a fraction of the viewport height (x is always the centre) */
  originY: number;
}

export const TILT: Tilt = { angle: 40, persp: 1800, originY: 0.6 };
export const FLAT: Tilt = { angle: 0, persp: 1700, originY: 0.62 };

export interface Diorama {
  tilt: Tilt;
  vw: number; vh: number;
  ox: number; oy: number;
  /** flat px → screen px (+ local magnification k) */
  project: (p: Pt) => { x: number; y: number; k: number };
  /** screen px → flat px */
  unproject: (p: Pt) => Pt;
  /** the flat-space rect the ground element must cover to fill the screen */
  ground: Box;
  /** CSS transform + origin for the ground element (origin in its own px) */
  css: { transform: string; transformOrigin: string };
}

export function diorama(vw: number, vh: number, tilt: Tilt = TILT): Diorama {
  const a = (tilt.angle * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a), P = tilt.persp;
  const ox = vw / 2, oy = vh * tilt.originY;
  const project = (p: Pt) => {
    const x = p.x - ox, y = p.y - oy;
    const w = 1 - (y * sin) / P;
    return { x: ox + x / w, y: oy + (y * cos) / w, k: 1 / w };
  };
  const unproject = (p: Pt) => {
    const u = p.x - ox, v = p.y - oy;
    const y = v / (cos + (v * sin) / P);
    const w = 1 - (y * sin) / P;
    return { x: ox + u * w, y: oy + y };
  };
  // cover every screen corner (plus a margin) in flat space
  const corners = [unproject({ x: -40, y: -40 }), unproject({ x: vw + 40, y: -40 }),
    unproject({ x: -40, y: vh + 40 }), unproject({ x: vw + 40, y: vh + 40 })];
  const x0 = Math.min(0, ...corners.map((c) => c.x)), x1 = Math.max(vw, ...corners.map((c) => c.x));
  const y0 = Math.min(0, ...corners.map((c) => c.y)), y1 = Math.max(vh, ...corners.map((c) => c.y));
  const ground = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  return {
    tilt, vw, vh, ox, oy, project, unproject, ground,
    css: {
      transform: tilt.angle ? `perspective(${P}px) rotateX(${tilt.angle}deg)` : "none",
      transformOrigin: `${ox - x0}px ${oy - y0}px`,
    },
  };
}
