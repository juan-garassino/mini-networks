// SEA FURNITURE (round 4, reference look): sailing ships, rocky islets with
// pines, a lighthouse islet, clouds, the compass rose, the title cartouche
// frame (any size) and the two corner icons (ruins temple, pipelines ship).
// All in the one maroon-brown ink family on the parchment sea.
import { BR } from "./palette";
import { Pen, cyl3q, cone3q, pine3q } from "./kit";
import { artBlank, type ArtImage } from "../raster";
import type { Sprite } from "../sprites/paint";

const K = BR.ink, P = BR.paperR, W = BR.woodR, S = BR.stoneR, F = BR.forestR, R = BR.roofR, WA = BR.water, G = BR.goldR, LT = BR.light;

/** Sailing ship: dark hull with a lit gunwale, two masts, cream sails, red pennant. `big` 30×26, else 17×15. */
export function ship(big = true, flip = false): Sprite {
  const w = big ? 30 : 17, h = big ? 26 : 15;
  const p = new Pen(w, h);
  const hullY = big ? 17 : 10, hullW = big ? 24 : 13, x0 = (w - hullW) >> 1;
  for (let r = 0; r < (big ? 5 : 3); r++) {
    const inset = r;
    for (let c = inset; c < hullW - inset; c++) p.set(x0 + c, hullY + r, r === 0 ? W[4] : c < hullW * 0.3 ? W[3] : W[2]);
  }
  p.hl(x0 - 1, x0 + 2, hullY - 1, W[3]); p.hl(x0 + hullW - 4, x0 + hullW, hullY - 2, W[3]);   // bow + stern castle
  if (big) for (let c = 4; c < hullW - 4; c += 3) p.set(x0 + c, hullY + 2, W[0]);           // gun ports
  const masts = big ? [x0 + 8, x0 + 16] : [x0 + 6];
  for (const [k, mx] of masts.entries()) {
    const top = big ? (k ? 3 : 1) : 1;
    p.vl(mx, top, hullY - 1, W[1]);
    const sw = big ? 5 : 4, sh = big ? 11 - k * 2 : 7;
    for (let r = 0; r < sh; r++) {
      const bulge = Math.round(Math.sin((r / sh) * Math.PI) * 1.5);
      for (let c = -sw - bulge; c <= sw; c++) p.set(mx + c, top + 2 + r, c < -1 ? LT[1] : c < 2 ? P[3] : P[2]);
    }
    p.hl(mx - sw - 1, mx + sw, top + 2 + sh, W[1]);
    p.art(mx + 1, top - 1, ["rrr", "rr."], { r: R[3] });
  }
  // water line
  for (let x = x0 - 2; x < x0 + hullW + 2; x += 2) p.set(x, h - 1, WA[4]);
  const s = p.done2({ x: w >> 1, y: hullY + (big ? 4 : 2) }, { keep: new Set([WA[4]]) });
  return flip ? { ...s, img: mirror(s.img), anchor: { x: w - 1 - s.anchor.x, y: s.anchor.y } } : s;
}

function mirror(img: ArtImage): ArtImage {
  const o = artBlank(img.w, img.h);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) o.data[y * img.w + img.w - 1 - x] = img.data[y * img.w + x];
  return o;
}

/** Rocky islet (3/4): a raised rock with a layered cliff skirt, foam at its foot; `pines` on top. */
export function islet(w = 20, pines = 2, bare = false): Sprite {
  const h = 16;
  const p = new Pen(w, h + 3);
  const cx = w >> 1, top = 6;
  for (let y = top; y < h; y++) {
    const t = (y - top) / (h - top);
    const hw = Math.round((w / 2 - 2) * Math.sqrt(Math.min(1, t * 2.2)));
    for (let dx = -hw; dx <= hw; dx++) {
      const grass = !bare && y < top + 3;
      const u = (dx + hw + 0.5) / (2 * hw + 1);
      p.set(cx + dx, y, grass ? (u < 0.4 ? BR.olive[5] : BR.olive[3]) : (y - top) % 3 === 2 ? S[1] : u < 0.35 ? S[3] : u < 0.75 ? S[2] : S[1]);
    }
  }
  if (bare) { for (let y = 1; y < top + 2; y++) { const hw = Math.round((y / (top + 2)) * 3); for (let dx = -hw; dx <= hw; dx++) p.set(cx - 2 + dx, y, dx < 0 ? S[3] : S[2]); } }
  for (let k = 0; k < pines; k++) pine3q(p, cx - 4 + k * 7, top + 2, 8, F, W[1]);
  for (let x = 1; x < w - 1; x++) if (x % 2 === 0) p.set(x, h + 1, LT[1]);
  for (let x = 2; x < w - 2; x += 3) p.set(x, h + 2, WA[4]);
  return p.done2({ x: cx, y: h }, { keep: new Set([LT[1], WA[4]]) });
}

/** Sea serpent: three humps out of the water, finned head with a spout. 34×16. */
export function serpent(): Sprite {
  const p = new Pen(34, 17);
  const body = [BR.slate[1], BR.slate[2], BR.water[2], BR.water[4]];
  const hump = (cx: number, r: number) => {
    for (let a = 0; a <= 180; a += 4) {
      const t = (a * Math.PI) / 180;
      const x = Math.round(cx - Math.cos(t) * r), y = Math.round(12 - Math.sin(t) * r);
      p.set(x, y, body[3]); p.set(x, y + 1, body[2]); p.set(x, y + 2, body[1]);
    }
    for (const x of [cx - r - 1, cx + r + 1]) p.set(x, 14, LT[1]);
  };
  hump(5, 3); hump(13, 3);
  // neck + head
  for (let y = 4; y <= 13; y++) { p.set(21 + Math.round((13 - y) * 0.2), y, body[3]); p.set(22 + Math.round((13 - y) * 0.2), y, body[2]); p.set(23 + Math.round((13 - y) * 0.2), y, body[1]); }
  p.art(21, 1, [".hhhhh...", "hhHhhhhh.", "hhhhhhhhm", ".bbb....."], { h: body[3], H: K[0], b: body[1], m: R[2] });
  p.art(19, 2, ["f", "ff", ".f"], { f: body[2] });
  p.set(31, 0, WA[4]); p.set(30, 0, WA[4]); p.set(32, 1, WA[4]);                     // spout
  for (let x = 0; x < 34; x += 3) p.set(x, 16, WA[4]);
  return p.done2({ x: 17, y: 14 }, { keep: new Set([LT[1], WA[4]]) });
}

/** Parchment-sea wave dash (tiny, ink-hatch tone). */
export function wave(): Sprite {
  const p = new Pen(7, 2);
  p.art(0, 0, [".##..##", "#..##.."], { "#": P[0] });
  return { img: p.img, anchor: { x: 3, y: 1 } };
}

/** Lighthouse on a rocky islet: striped tower, lantern with a glow, cone cap. 22×32. */
export function lighthouse(): Sprite {
  const base = islet(22, 0);
  const p = new Pen(22, 34);
  const oy = 34 - base.img.h;
  for (let y = 0; y < base.img.h; y++) for (let x = 0; x < 22; x++) { const v = base.img.data[y * 22 + x]; if (v !== 255) p.set(x, y + oy, v); }
  cyl3q(p, 8, 7, 6, oy + 8 - 7, S);
  for (let y = 10; y < oy + 8; y += 5) for (let x = 8; x < 14; x++) { p.set(x, y, x < 10 ? R[3] : R[2]); p.set(x, y + 1, x < 10 ? R[3] : R[1]); }
  p.f(8, 4, 6, 3, G[3]); p.set(9, 5, G[4]); p.vl(8, 4, 6, S[1]); p.vl(13, 4, 6, S[1]);
  cone3q(p, 10, 0, 4, 3, R);
  p.hl(7, 14, 7, S[1]);
  for (const [x, y] of [[4, 4], [2, 5], [17, 4], [19, 5]] as const) p.set(x, y, G[4]);      // beams
  return p.done2({ x: 11, y: 34 - 3 }, { keep: new Set([G[4], LT[1], WA[4]]) });
}

/** Puffy cloud: cream tops, blue-grey belly. */
export function cloud(v = 0): Sprite {
  const w = [30, 22, 36][v % 3];
  const p = new Pen(w, 13);
  const lobes = v === 1 ? [[6, 7, 5], [13, 5, 6], [18, 8, 4]] : v === 2 ? [[6, 8, 5], [13, 5, 6], [21, 4, 7], [29, 8, 5]] : [[6, 8, 5], [13, 5, 6], [21, 7, 6]];
  for (const [x, y, r] of lobes) p.blob(x, y, r, r * 0.8, LT[1], LT[0], WA[4]);
  for (let x = 2; x < w - 2; x++) if (p.get(x, 11) !== 255 || p.get(x, 10) !== 255) { p.set(x, 11, WA[3]); }
  return p.done2({ x: w >> 1, y: 11 }, { rim: false, keep: new Set([LT[1], LT[0], WA[4], WA[3]]) });
}

/** Compass rose: 8-point star, maroon + cream facets, N/E/S/W letters. 41×41. */
export function compassRose(): Sprite {
  const p = new Pen(41, 41);
  const c = 20;
  // kite-shaped points: one half ink, the other half cream (lit), drawn along any direction
  const point = (dx: number, dy: number, len: number, wid: number, dark: number, lite: number) => {
    const n = Math.hypot(dx, dy), ux = dx / n, uy = dy / n, px = -uy, py = ux;
    for (let t = 0; t <= len; t += 0.4) {
      const hw = wid * (1 - t / len);
      for (let s2 = -hw; s2 <= hw; s2 += 0.4) p.set(Math.round(c + ux * t + px * s2), Math.round(c + uy * t + py * s2), s2 < 0 ? dark : lite);
    }
  };
  for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) point(dx, dy, 11, 2.6, K[1], P[1]);
  for (const [dx, dy] of [[0, -1], [0, 1], [1, 0], [-1, 0]] as const) point(dx, dy, 15, 3.4, K[0], BR.desert[5]);
  p.blob(c, c, 1, 1, G[3], G[2], G[1]);
  const L: Record<string, string[]> = { N: ["#..#", "##.#", "#.##", "#..#"], S: [".##", "#..", ".##", "..#", "##."], E: ["###", "#..", "##.", "#..", "###"], W: ["#...#", "#.#.#", "#.#.#", ".#.#."] };
  p.art(19, 0, L.N.map((r) => r), { "#": K[0] }); p.art(19, 36, L.S, { "#": K[0] }); p.art(37, 18, L.E, { "#": K[0] }); p.art(0, 18, L.W, { "#": K[0] });
  // one ink ring round the star points (letters excluded: they sit on their own)
  const src = new Uint8Array(p.img.data);
  for (let y = 1; y < 40; y++) for (let x = 1; x < 40; x++) {
    if (src[y * 41 + x] !== 255 || Math.hypot(x - c, y - c) > 16) continue;
    if (src[y * 41 + x - 1] !== 255 || src[y * 41 + x + 1] !== 255 || src[(y - 1) * 41 + x] !== 255 || src[(y + 1) * 41 + x] !== 255) p.set(x, y, K[0]);
  }
  return p.done2({ x: c, y: c }, { rim: false, outline: false });
}

/** Title cartouche frame at any size: paper panel, double maroon rule, corner nails + filigree. */
export function cartouche(w: number, h: number): ArtImage {
  const p = new Pen(w, h);
  p.f(1, 1, w - 2, h - 2, P[3]);
  p.f(2, 2, w - 4, h - 4, P[2]);
  const rect = (i: number, v: number) => { p.hl(i, w - 1 - i, i, v); p.hl(i, w - 1 - i, h - 1 - i, v); p.vl(i, i, h - 1 - i, v); p.vl(w - 1 - i, i, h - 1 - i, v); };
  rect(0, K[0]); rect(2, K[1]);
  p.hl(3, w - 4, h - 4, P[1]); p.vl(w - 4, 3, h - 4, P[1]);           // inner shadow (bottom-right)
  for (const [x, y] of [[3, 3], [w - 6, 3], [3, h - 6], [w - 6, h - 6]] as const) { p.f(x, y, 3, 3, K[0]); p.set(x + 1, y + 1, G[3]); }
  for (const x of [w >> 1]) { p.hl(x - 4, x + 4, 1, K[2]); p.hl(x - 4, x + 4, h - 2, K[2]); }
  return p.img;
}

/** Corner icon: ruins temple (pediment, four columns, steps). 19×15. */
export function ruinsIcon(): Sprite {
  const p = new Pen(19, 15);
  p.art(0, 0, [
    "........#..........",
    "......#####........",
    "....#########......",
    "..#############....",
    "#################..",
  ].map((r) => r.slice(0, 17) + ".."), { "#": K[0] });
  for (let y = 0; y < 5; y++) for (let x = 0; x < 17; x++) if (p.get(x, y) !== 255) p.set(x + 1, y, K[0]);
  for (const x of [3, 7, 11, 15]) p.f(x, 6, 2, 6, K[0]);
  p.hl(1, 18, 5, K[1]); p.hl(1, 18, 12, K[0]); p.hl(0, 18, 13, K[1]); p.hl(0, 18, 14, K[0]);
  return p.done2({ x: 9, y: 14 }, { rim: false, outline: false });
}

/** Corner icon: a pipelines galleon on a dashed rule. 26×20. */
export function pipelinesIcon(): Sprite {
  const s = ship(true);
  const p = new Pen(30, 28);
  for (let y = 0; y < s.img.h; y++) for (let x = 0; x < s.img.w; x++) { const v = s.img.data[y * s.img.w + x]; if (v !== 255) p.set(x, y, v); }
  for (let x = 0; x < 30; x += 3) { p.set(x, 27, K[1]); p.set(x + 1, 27, K[1]); }
  return { img: p.img, anchor: { x: 15, y: 27 } };
}

const memo = new Map<string, Sprite>();
const once = (k: string, f: () => Sprite) => { let s = memo.get(k); if (!s) { s = f(); memo.set(k, s); } return s; };
export function seaSprites() {
  return {
    ship: once("sea:ship", () => ship(true)), shipL: once("sea:shipL", () => ship(true, true)), sloop: once("sea:sloop", () => ship(false)),
    islet: once("sea:islet", () => islet(20, 2)), isletS: once("sea:isletS", () => islet(14, 1)), rock: once("sea:rock", () => islet(12, 0, true)),
    lighthouse: once("sea:lh", lighthouse), serpent: once("sea:serpent", serpent), wave: once("sea:wave", wave),
    tuft: once("sea:tuft", () => islet(11, 0)),
    cloud0: once("sea:c0", () => cloud(0)), cloud1: once("sea:c1", () => cloud(1)), cloud2: once("sea:c2", () => cloud(2)),
    compass: once("sea:compass", compassRose), ruins: once("sea:ruins", ruinsIcon), pipelines: once("sea:pipes", pipelinesIcon),
  };
}
