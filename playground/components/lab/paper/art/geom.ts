// Tiny path builders for the art library. Pure, deterministic (no Math.random —
// use rng(seed)). Coordinates are design units; every asset puts its base
// centre at (0, 0) with "up" negative.

const n = (v: number) => (Math.round(v * 100) / 100).toString();

export const circ = (cx: number, cy: number, r: number) =>
  `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(r * 2)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-r * 2)} 0Z`;

export const ell = (cx: number, cy: number, rx: number, ry: number) =>
  `M${n(cx - rx)} ${n(cy)}a${n(rx)} ${n(ry)} 0 1 0 ${n(rx * 2)} 0a${n(rx)} ${n(ry)} 0 1 0 ${n(-rx * 2)} 0Z`;

export const rect = (x: number, y: number, w: number, h: number) =>
  `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}Z`;

export const rrect = (x: number, y: number, w: number, h: number, r: number) => {
  const q = Math.min(r, w / 2, h / 2);
  return `M${n(x + q)} ${n(y)}H${n(x + w - q)}Q${n(x + w)} ${n(y)} ${n(x + w)} ${n(y + q)}V${n(y + h - q)}Q${n(x + w)} ${n(y + h)} ${n(x + w - q)} ${n(y + h)}H${n(x + q)}Q${n(x)} ${n(y + h)} ${n(x)} ${n(y + h - q)}V${n(y + q)}Q${n(x)} ${n(y)} ${n(x + q)} ${n(y)}Z`;
};

/** Closed polygon from flat [x0, y0, x1, y1, …]. */
export const poly = (...p: number[]) => {
  let s = `M${n(p[0])} ${n(p[1])}`;
  for (let i = 2; i < p.length; i += 2) s += `L${n(p[i])} ${n(p[i + 1])}`;
  return s + "Z";
};

/** Open polyline (for strokes). */
export const line = (...p: number[]) => {
  let s = `M${n(p[0])} ${n(p[1])}`;
  for (let i = 2; i < p.length; i += 2) s += `L${n(p[i])} ${n(p[i + 1])}`;
  return s;
};

/** Union of circles [[cx, cy, r], …] as one path (a puffy cloud / canopy). */
export const blob = (cs: readonly (readonly [number, number, number])[]) => cs.map(([x, y, r]) => circ(x, y, r)).join("");

/** n-point star, first point up. */
export const star = (cx: number, cy: number, r: number, inner = 0.45, points = 5) => {
  const p: number[] = [];
  for (let k = 0; k < points * 2; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / points;
    const rr = k % 2 ? r * inner : r;
    p.push(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
  }
  return poly(...p);
};

/** Flat-topped regular octagon, optionally squashed vertically (tilt < 1). */
export const octagonPts = (cx: number, cy: number, r: number, tilt = 1): number[] => {
  const p: number[] = [];
  for (let k = 0; k < 8; k++) {
    const a = Math.PI / 8 + (k * Math.PI) / 4;
    p.push(cx + r * Math.cos(a), cy + r * Math.sin(a) * tilt);
  }
  return p;
};
export const octagon = (cx: number, cy: number, r: number, tilt = 1) => poly(...octagonPts(cx, cy, r, tilt));

/** The lower half of an extruded octagon (the visible side band of a disc of
 *  thickness t) — front-facing edges only. */
export const octagonSide = (cx: number, cy: number, r: number, tilt: number, t: number) => {
  const p = octagonPts(cx, cy, r, tilt);
  // vertices 0..3 are the lower half (angles 22.5°..157.5°), plus the two
  // horizontal extremes (7 and 4) so the band starts at the widest point
  const idx = [7, 0, 1, 2, 3, 4];
  const top = idx.map((i) => [p[i * 2], p[i * 2 + 1]]);
  const bot = [...top].reverse().map(([x, y]) => [x, y + t]);
  return poly(...top.flat(), ...bot.flat());
};

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Jagged palm frond: a curved blade from (x0,y0) bending to (x1,y1) with
 *  `teeth` notches on its lower edge. */
export function frond(x0: number, y0: number, x1: number, y1: number, width: number, teeth = 5, droop = 0.35): string {
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;                   // normal, flipped to hang down
  if (ny < 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; }
  const cx = mx, cy = my - len * droop;                // arch upward, then droop to the tip
  const q = (t: number) => {                            // quadratic point on the spine
    const u = 1 - t;
    return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1];
  };
  const top: number[] = [], bot: number[] = [];
  for (let i = 0; i <= teeth * 2; i++) {
    const t = i / (teeth * 2);
    const [px, py] = q(t);
    const w = width * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.35);
    top.push(px - nx * w * 0.35, py - ny * w * 0.35);
    const notch = i % 2 ? 0.35 : 1;
    bot.push(px + nx * w * notch, py + ny * w * notch);
  }
  const pts: number[] = [...top];
  for (let i = bot.length - 2; i >= 0; i -= 2) pts.push(bot[i], bot[i + 1]);
  return poly(...pts);
}

/** Scalloped edge along a horizontal run: bumps of radius r from x0 to x1 at y. */
export function scallops(x0: number, x1: number, y: number, r: number, up = true): string {
  const count = Math.max(1, Math.round((x1 - x0) / (r * 2)));
  const step = (x1 - x0) / count;
  let s = `M${n(x0)} ${n(y)}`;
  for (let i = 0; i < count; i++) s += `a${n(step / 2)} ${n(r)} 0 0 ${up ? 1 : 0} ${n(step)} 0`;
  return s;
}
