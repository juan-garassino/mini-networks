// The Night Map's life layer, as pure functions of a frame number (12 fps,
// a flip-book like the pixel map's life layer — never a glide). Frame 0 is the
// canonical still: every function returns "nothing moves" there, so ?still=1
// and prefers-reduced-motion show exactly the baked sky and the marks.
//
//   twinkle   ~1 in 6 field stars step one rung up or down the FIELD ramp
//             on their own slow period (decoration)
//   glint     each champion star flares now and then: its rays grow by two
//             art px and its core whitens for a few frames (encodes: champion)
//   comet     a bright pixel with a short tail runs each lineage line from
//             parent to child, in the child's evidence colour (encodes: the
//             direction of builds_on; on a selection only its lineage runs)
//   meteor    a pixel meteor crosses the sky every ~11 s (decoration)
import { hash2 } from "./bake.ts";

export const FPS = 12;
export const LOOP = FPS * 120; // a two-minute loop

/** Field star i's tone shift at this frame: −1, 0 or +1 (only 1 in 6 stars ever move). */
export function twinkle(i: number, frame: number): number {
  if (frame === 0 || i % 6 !== 0) return 0;
  const period = FPS * (2.5 + hash2(i, 1, 9) * 4);
  const s = Math.sin(((frame / period) + hash2(i, 2, 9)) * Math.PI * 2);
  return s > 0.72 ? 1 : s < -0.72 ? -1 : 0;
}

/** A champion's glint stage at this frame: 0 none, 1 core flash, 2 rays +1, 3 rays +2 (then back down). */
export function glint(i: number, frame: number): 0 | 1 | 2 | 3 {
  if (frame === 0) return 0;
  const period = Math.round(FPS * (7 + hash2(i, 3, 9) * 9));
  const t = (frame + Math.floor(hash2(i, 4, 9) * period)) % period;
  return t === 0 ? 1 : t === 1 ? 2 : t === 2 ? 3 : t === 3 ? 2 : t === 4 ? 1 : 0;
}

/** The comet's head index along a line of `len` pixels, or -1 (between runs). */
export function comet(i: number, len: number, frame: number, busy = false): number {
  if (frame === 0 || len < 4) return -1;
  // ~2 art px per frame; a run every 4–9 s (every 1.5–3 s on a selected lineage)
  const gap = Math.round(FPS * (busy ? 1.5 + hash2(i, 5, 9) * 1.5 : 4 + hash2(i, 5, 9) * 5));
  const cycle = Math.ceil(len / 2) + gap;
  const t = (frame + Math.floor(hash2(i, 6, 9) * cycle)) % cycle;
  const head = t * 2;
  return head < len ? head : -1;
}

/** The meteor at this frame in art px of a cols×rows screen: head + tail (dark → bright), or null. */
export function meteor(frame: number, cols: number, rows: number): { x: number; y: number; k: number }[] | null {
  if (frame === 0) return null;
  const EVERY = FPS * 11, LIFE = 14;
  const pass = Math.floor(frame / EVERY), t = frame % EVERY;
  if (t >= LIFE || pass === 0) return null;
  const sx = Math.floor(cols * (0.25 + hash2(pass, 7, 9) * 0.6)), sy = Math.floor(rows * (0.05 + hash2(pass, 8, 9) * 0.3));
  // down and to the left, 2:1, 3 art px per frame
  const hx = sx - t * 3, hy = sy + Math.floor((t * 3) / 2);
  const tail = Math.min(8, t * 3);
  const out: { x: number; y: number; k: number }[] = [];
  for (let j = tail; j >= 0; j--) out.push({ x: hx + j, y: hy - Math.floor(j / 2), k: j === 0 ? 3 : j < 3 ? 2 : j < 6 ? 1 : 0 });
  return out;
}
