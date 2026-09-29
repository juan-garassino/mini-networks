// Size-free hero glyphs, for the near levels of detail where a hand-drawn
// 7–15 px stamp would be a speck. Same drawing rules as the hand stamps —
// flat facets (lit left face, shadow right face), a ridge line, jagged snow
// line, 1-px outline in the material's darkest step, sparkles placed by
// hand-picked ratios — so a big volcano reads like a bigger drawing of the
// small one, never like noise. All deterministic (no randomness).
import { RAMPS, CLEAR } from "../palette";
import type { ArtImage } from "../raster";
import { CANOPY_2, CANOPY_3, type Stamp } from "./stamps";

const blank = (w: number, h: number): ArtImage => ({ w, h, data: new Uint8Array(w * h).fill(CLEAR) });
const set = (m: ArtImage, x: number, y: number, v: number) => { if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.data[y * m.w + x] = v; };
const get = (m: ArtImage, x: number, y: number) => (x >= 0 && y >= 0 && x < m.w && y < m.h ? m.data[y * m.w + x] : CLEAR);

/** 1-px outline round the silhouette in `ink` (optionally skipping the base row). */
function outline(m: ArtImage, ink: number, base = false): ArtImage {
  const o = blank(m.w + 2, m.h + (base ? 2 : 1));
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) o.data[(y + 1) * o.w + x + 1] = m.data[y * m.w + x];
  const src = new Uint8Array(o.data);
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < o.w && y < o.h ? src[y * o.w + x] : CLEAR);
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
    if (src[y * o.w + x] !== CLEAR) continue;
    if (!base && y === o.h - 1) continue;
    if (at(x - 1, y) !== CLEAR || at(x + 1, y) !== CLEAR || at(x, y - 1) !== CLEAR || at(x, y + 1) !== CLEAR) o.data[y * o.w + x] = ink;
  }
  return o;
}

export interface Glyph { img: ArtImage; foot: { x: number; y: number } }

/** Faceted cone: mountain (snow cap) or volcano (crater + lava flow + smoke). */
export function cone(w: number, h: number, o: { snow?: boolean; crater?: boolean; ramp?: "rock" | "stone" } = {}): Glyph {
  w = w | 1;
  const R = RAMPS[o.ramp ?? "rock"], S = RAMPS.snow, Lv = RAMPS.lava;
  const smoke = o.crater ? Math.max(2, Math.round(h * 0.18)) : 0;
  const m = blank(w, h + smoke);
  const cx = (w - 1) / 2;
  const craterHalf = o.crater ? Math.max(1, Math.round(w * 0.07)) : 0;
  for (let y = 0; y < h; y++) {
    const t = y / Math.max(1, h - 1);
    const half = Math.max(craterHalf, Math.round((w / 2) * Math.pow(t, 0.9)));
    const ridge = Math.round(cx + t * w * 0.07);
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const lit = x < ridge;
      const edgeR = x > cx + half * 0.72;
      let v = lit ? R[4] : edgeR ? R[1] : R[2];
      if (lit && x < cx - half * 0.7) v = R[3];                            // lit face rolls off at the silhouette
      if (lit && y % 4 === 3 && (x + y) % 5 < 2 && y > h * 0.3) v = R[3];  // strata dashes on the lit face
      if (!lit && y % 5 === 2 && (x * 3 + y) % 7 < 2) v = R[1];          // gullies on the shadow face
      if (o.snow) {
        const jag = ((x * 7 + 3) % 5) - 2;
        if (t < 0.38 + jag * 0.035) v = lit ? S[5] : S[2];
        else if (t < 0.46 + jag * 0.035 && (x + y) % 2 === 0) v = lit ? S[4] : S[1];  // snow streaks
      }
      set(m, x, y + smoke, v);
    }
  }
  if (o.crater) {
    for (let x = Math.round(cx - craterHalf); x <= Math.round(cx + craterHalf); x++) { set(m, x, smoke, Lv[2]); set(m, x, smoke + 1, Lv[3]); }
    // lava flow down the lit face, a slow S-curve
    for (let y = 2; y < h * 0.82; y++) {
      const x = Math.round(cx - 1 - y * 0.12 + Math.sin(y / 3.2) * 1.2);
      set(m, x, y + smoke, y % 3 ? Lv[1] : Lv[2]);
      if (y > h * 0.4) set(m, x - 1, y + smoke, Lv[0]);
    }
    // smoke puffs: three offset 2×2 blobs drifting right
    for (let k = 0; k < 3; k++) {
      const x = Math.round(cx + k * 2), y = smoke - 1 - k;
      if (y < 0) break;
      set(m, x, y, S[3]); set(m, x + 1, y, S[4]); set(m, x, y - 1, S[4]);
    }
  }
  const out = outline(m, R[0]);
  return { img: out, foot: { x: Math.round(cx) + 1, y: out.h - 1 } };
}

/** Flat-topped mesa with striated cliff walls. */
export function mesa(w: number, h: number): Glyph {
  const m = blank(w, h);
  const top = Math.max(2, Math.round(h * 0.32));
  const inset = Math.max(1, Math.round(w * 0.12));
  for (let y = 0; y < h; y++) {
    const flare = y < top ? inset : Math.max(0, inset - Math.floor((y - top) / 2));
    for (let x = flare; x < w - flare; x++) {
      let v: number;
      if (y < top) v = y === 0 ? RAMPS.sand[5] : x > w - flare - 3 ? RAMPS.sand[3] : RAMPS.sand[4];
      else {
        const lit = x < w * 0.55;
        v = lit ? ((x >> 1) % 2 ? RAMPS.rock[4] : RAMPS.rock[3]) : ((x >> 1) % 2 ? RAMPS.rock[2] : RAMPS.rock[3]);
        if (y === top) v = RAMPS.rock[2];                                  // shadow under the lip
        if (y === h - 1) v = RAMPS.rock[2];
      }
      set(m, x, y, v);
    }
  }
  const out = outline(m, RAMPS.rock[1]);
  return { img: out, foot: { x: Math.round(w / 2) + 1, y: out.h - 1 } };
}

/** Two-lobed lake: shaded north bank, light south lip, sparkle diamonds. */
export function lake(w: number, h: number): Glyph {
  const m = blank(w, h);
  const S = RAMPS.shallow;
  const inside = (x: number, y: number) => {
    const a = ((x - w * 0.42) / (w * 0.42)) ** 2 + ((y - h * 0.5) / (h * 0.5)) ** 2;
    const b = ((x - w * 0.72) / (w * 0.28)) ** 2 + ((y - h * 0.58) / (h * 0.4)) ** 2;
    return a <= 1 || b <= 1;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inside(x + 0.5, y + 0.5)) continue;
    const bank = !inside(x + 0.5, y - 0.5) || !inside(x - 0.5, y + 0.5);
    const lip = !inside(x + 0.5, y + 1.5);
    const band = !inside(x + 0.5, y - 1.5);
    set(m, x, y, bank ? S[1] : lip ? S[4] : band ? S[2] : S[3]);
  }
  const d = (cx: number, cy: number) => {
    set(m, cx, cy, RAMPS.foam[1]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (get(m, cx + dx, cy + dy) !== CLEAR) set(m, cx + dx, cy + dy, S[5]);
  };
  d(Math.round(w * 0.34), Math.round(h * 0.45));
  set(m, Math.round(w * 0.7), Math.round(h * 0.62), S[5]);
  const out = outline(m, S[0], true);
  return { img: out, foot: { x: Math.round(w / 2) + 1, y: Math.round(h / 2) + 1 } };
}

/** Crystal spires: n prisms of falling height, lit left facet, tip glint. */
export function spires(w: number, h: number): Glyph {
  const m = blank(w, h);
  const M = RAMPS.magic;
  const n = Math.max(2, Math.round(w / 5));
  const order = [0.5, 0.25, 0.75, 0.1, 0.9];
  for (let k = n - 1; k >= 0; k--) {
    const cx = Math.round(w * order[k % order.length]);
    const hh = Math.round(h * (1 - k * 0.22));
    const half = Math.max(1, Math.round(w / (n * 2.6)));
    for (let y = h - hh; y < h; y++) {
      const t = (y - (h - hh)) / Math.max(1, hh);
      const hw = t < 0.25 ? Math.round(half * (t / 0.25)) : half;
      for (let x = cx - hw; x <= cx + hw; x++) set(m, x, y, x < cx ? M[2] : x === cx ? M[1] : M[0]);
    }
    set(m, cx, h - hh, RAMPS.foam[1]);
  }
  const out = outline(m, RAMPS.stone[0]);
  return { img: out, foot: { x: Math.round(w / 2) + 1, y: out.h - 1 } };
}

/** A forest clump of radius r made of hand-drawn canopies, packed back-to-front. */
export function forest(r: number, canopy: Stamp["legend"]): Glyph {
  const W = r * 2 + 8, H = Math.round(r * 1.5) + 8;
  const m = blank(W, H);
  const spots: [number, number, boolean][] = [];
  const step = 4;
  for (let y = 0; y <= r * 1.5; y += step - 1) for (let x = 0; x <= r * 2; x += step) {
    const xx = x + ((y / (step - 1)) % 2 ? 2 : 0);
    const dx = (xx - r) / r, dy = (y - r * 0.75) / (r * 0.75);
    const d = dx * dx + dy * dy;
    if (d > 1) continue;
    spots.push([xx, y, d < 0.55]);
  }
  for (const [x, y, big] of spots) {
    const rows = big ? CANOPY_3 : CANOPY_2;
    rows.forEach((row, yy) => {
      for (let xx = 0; xx < row.length; xx++) {
        const ch = row[xx];
        const e = canopy[ch];
        if (!e) continue;
        const ramp = RAMPS[e[0]];
        set(m, x + xx, y + yy, ramp[Math.min(ramp.length - 1, e[1])]);
      }
    });
  }
  return { img: m, foot: { x: Math.round(W / 2), y: H - 2 } };
}
