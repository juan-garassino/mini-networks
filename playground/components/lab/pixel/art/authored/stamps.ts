// Hand-drawn stamp library for the authored map (round 4 — "human designed").
// Every stamp is literal pixel art: one char per art pixel, a per-stamp
// legend char → [ramp, step]. Drawn for ONE key light (top-left): lit faces
// on the left/top, dark faces + 1-px outline on the bottom/right. No noise.
// Stamps are drawn at a constant pixel size; the composer picks S/M/L by LOD.
import { RAMPS, type RampName } from "../palette";
import { CLEAR } from "../palette";
import type { ArtImage } from "../raster";

export type StampLegend = Record<string, readonly [RampName, number]>;
export interface Stamp {
  name: string;
  rows: readonly string[];
  legend: StampLegend;
  /** foot point (x, y) inside the stamp that sits on the map anchor */
  foot: { x: number; y: number };
}

const mk = (name: string, rows: readonly string[], legend: StampLegend, foot?: { x: number; y: number }): Stamp => ({
  name, rows, legend, foot: foot ?? { x: Math.floor(rows[0].length / 2), y: rows.length - 1 },
});

/** Re-key a stamp's ramps (e.g. rock peaks → stone peaks) keeping steps. */
export function recolour(s: Stamp, map: Partial<Record<RampName, RampName>>, name = s.name): Stamp {
  const legend: StampLegend = {};
  for (const [k, [r, i]] of Object.entries(s.legend)) {
    const to = map[r] ?? r;
    const n = RAMPS[to].length, m = RAMPS[r].length;
    legend[k] = [to, Math.round((i / Math.max(1, m - 1)) * (n - 1))];
  }
  return { ...s, name, legend };
}

// ——————————————————————————— canopies & forest clumps ———————————————————————————
// canopy keys: 4 light, 3 mid, 2 dark, o outline (forest ramp)
export const CAN: StampLegend = { "4": ["forest", 4], "3": ["forest", 3], "2": ["forest", 2], "5": ["forest", 5], o: ["forest", 0] };
export const CANOPY_2 = [
  ".ooo.",
  "o453o",
  "o432o",
  "o322o",
  ".ooo.",
];
export const CANOPY_3 = [
  "..ooo..",
  ".o454o.",
  "o44443o",
  "o44332o",
  "o43322o",
  ".o322o.",
  "..ooo..",
];

/** A clump = canopies stamped back-to-front (authored arrangement). */
function clump(name: string, parts: [readonly string[], number, number][]): Stamp {
  let w = 0, h = 0;
  for (const [r, x, y] of parts) { w = Math.max(w, x + r[0].length); h = Math.max(h, y + r.length); }
  const grid = Array.from({ length: h }, () => Array(w).fill("."));
  for (const [r, x0, y0] of parts) r.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] !== ".") grid[y0 + y][x0 + x] = row[x];
  });
  return mk(name, grid.map((r) => r.join("")), CAN);
}

export const FOREST_S = clump("forest S", [[CANOPY_2, 0, 0], [CANOPY_2, 3, 2]]);
export const FOREST_M = clump("forest M", [[CANOPY_3, 2, 0], [CANOPY_2, 0, 3], [CANOPY_2, 7, 3], [CANOPY_2, 4, 5]]);
export const FOREST_L = clump("forest L", [
  [CANOPY_3, 4, 0], [CANOPY_3, 10, 1], [CANOPY_2, 0, 3], [CANOPY_3, 1, 5], [CANOPY_2, 8, 6], [CANOPY_3, 12, 6], [CANOPY_2, 6, 9],
]);

// ——————————————————————————— peaks (faceted, snow caps) ———————————————————————————
// 4 lit face, 3 mid, 2 shadow face, 1 deep shadow, o ink outline; w snow lit, v snow shade
const PK: StampLegend = {
  "4": ["rock", 4], "3": ["rock", 3], "2": ["rock", 2], "1": ["rock", 1], o: ["rock", 0],
  w: ["snow", 5], v: ["snow", 2],
};
export const PEAK_S = mk("peak S", [
  "...o...",
  "..o4o..",
  ".o442o.",
  "o44321o",
], PK);
export const PEAK_M = mk("peak M", [
  "....o....",
  "...owo...",
  "..owwvo..",
  ".o4wv21o.",
  "o4443211o",
], PK);
export const PEAK_L = mk("peak L", [
  "......o......",
  ".....owo.....",
  "....owwvo....",
  "...owwwvvo...",
  "..o4wwv211o..",
  ".o44w3v2211o.",
  "o44433322111o",
], PK);

// ——————————————————————————— ground relief ———————————————————————————
// g+ lighter ground, g= ground, g- darker, g_ shadow. Resolved against the
// region's ground ramp at stamp time (ramp "ground" is a placeholder).
const GR: StampLegend = { "+": ["meadow", 5], "=": ["meadow", 4], "-": ["meadow", 3], _: ["meadow", 2] };
export const HILL = mk("hill", [
  "..++-..",
  ".++=--.",
  "+==--__",
], GR);
export const HILL_L = mk("hill L", [
  "....++--....",
  "..+++==---..",
  ".++===----_.",
  "+===----___.",
], GR);
export const DUNE = mk("dune", [
  "...++-...",
  ".+++=--..",
  "++==---__",
], { "+": ["sand", 5], "=": ["sand", 4], "-": ["sand", 3], _: ["sand", 2] });

// ——————————————————————————— water ———————————————————————————
// B bank-shadow water, b water, c light lip, * sparkle, o water edge
const WT: StampLegend = { B: ["shallow", 1], b: ["shallow", 3], c: ["shallow", 4], "*": ["foam", 1], o: ["shallow", 0] };
export const POND = mk("pond", [
  "..ooooo..",
  ".oBBBBBo.",
  "obbbcbbbo",
  "obbc*cbbo",
  ".occccco.",
  "..ooooo..",
], WT, { x: 4, y: 3 });
export const LAKE = mk("lake", [
  "...ooooo...",
  ".ooBBBBBoo.",
  "oBbbbbcbbbo",
  "obbbbc*cbbo",
  "obbbbbcbbco",
  ".oocccccoo.",
  "...ooooo...",
], WT, { x: 5, y: 3 });

// ——————————————————————————— hero landmarks ———————————————————————————
export const VOLCANO = mk("volcano", [
  ".....ss..s.....",
  "......s.ss.....",
  ".....oLLLo.....",
  "....o4lLl2o....",
  "...o44L3221o...",
  "..o44L332211o..",
  ".o444L3322211o.",
  "o4443L33222111o",
], {
  "4": ["rock", 4], "3": ["rock", 3], "2": ["rock", 2], "1": ["rock", 1], o: ["rock", 0],
  L: ["lava", 2], l: ["lava", 1], s: ["snow", 3],
});
export const MESA = mk("mesa", [
  "..ooooooooo..",
  "..o5555554o..",
  "..o4444443o..",
  ".o323232321o.",
  ".o332332221o.",
  "o33232322211o",
], {
  "5": ["sand", 5], "4": ["sand", 4], "3": ["rock", 4], "2": ["rock", 3], "1": ["rock", 2], o: ["rock", 1],
});
export const PALM = mk("palm", [
  "oo...oo",
  "o5o.o4o",
  ".o545o.",
  "..o4o..",
  "...w...",
  "...w...",
], { "5": ["olive", 5], "4": ["olive", 3], o: ["meadow", 1], w: ["wood", 1] });
export const ACACIA = mk("acacia", [
  ".ooooooo.",
  "o5554443o",
  ".oo232oo.",
  "....w....",
  "....w....",
], { "5": ["olive", 5], "4": ["olive", 4], "3": ["olive", 3], "2": ["olive", 1], o: ["meadow", 1], w: ["wood", 2] });
export const PINE = mk("pine", [
  "..o..",
  ".o4o.",
  ".o42o",
  "o442o",
  "o432o",
  "..w..",
], { "4": ["pine", 5], "3": ["pine", 4], "2": ["pine", 3], o: ["pine", 0], w: ["wood", 2] });
export const PINE_SNOW = mk("pine snow", [
  "..o..",
  ".owo.",
  ".o4vo",
  "owwvo",
  "o432o",
  "..w..",
], { "4": ["pine", 5], "3": ["pine", 4], "2": ["pine", 3], o: ["pine", 0], w: ["snow", 5], v: ["snow", 2] });
export const SPIRES = mk("crystal spires", [
  "....o......",
  "...owo.....",
  "...omno....",
  ".o.omno....",
  "owoomno.o..",
  "omnomnoowo.",
  "omnomno.mno",
  "omnomnoomno",
  "omnomnnomno",
  ".oomnnnonno",
  "...ooooooo.",
], { w: ["foam", 1], m: ["magic", 2], n: ["magic", 1], o: ["magic", 0] });
export const ROCKS = mk("rocks", [
  ".oo.....",
  "o43o.oo.",
  "o321o42o",
  ".ooo.oo.",
], { "4": ["stone", 4], "3": ["stone", 3], "2": ["stone", 2], "1": ["stone", 1], o: ["stone", 0] });
export const TUFT = mk("tuft", [
  "+.+.+",
  "_+_+_",
], { "+": ["meadow", 5], _: ["meadow", 2] });

/** Rasterise a stamp (palette indices, CLEAR elsewhere); `ground` remaps the meadow ramp for relief stamps. */
export function stampImage(s: Stamp, ground?: RampName): ArtImage {
  const h = s.rows.length, w = s.rows[0].length;
  const data = new Uint8Array(w * h).fill(CLEAR);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = s.rows[y][x];
    const e = s.legend[ch];
    if (!e) continue;
    let [r, i] = e;
    if (ground && r === "meadow" && (s === HILL || s === HILL_L || s === TUFT)) {
      const n = RAMPS[ground].length, m = RAMPS.meadow.length;
      r = ground; i = Math.round((i / (m - 1)) * (n - 1));
    }
    const ramp = RAMPS[r];
    data[y * w + x] = ramp[Math.max(0, Math.min(ramp.length - 1, i))];
  }
  return { w, h, data };
}

/** Paint a stamp into `dst` with its foot at (x, y); `can(px, py)` may veto pixels. */
export function paintStamp(dst: ArtImage, s: Stamp | ArtImage, x: number, y: number, foot = { x: 0, y: 0 }, ground?: RampName) {
  const img = "rows" in s ? stampImage(s, ground) : s;
  const f = "rows" in s ? s.foot : foot;
  const ox = Math.round(x - f.x), oy = Math.round(y - f.y);
  for (let sy = 0; sy < img.h; sy++) for (let sx = 0; sx < img.w; sx++) {
    const v = img.data[sy * img.w + sx];
    if (v === CLEAR) continue;
    const px = ox + sx, py = oy + sy;
    if (px >= 0 && py >= 0 && px < dst.w && py < dst.h) dst.data[py * dst.w + px] = v;
  }
}

/** Every stamp, for the specimen sheet. */
export const STAMPS: Stamp[] = [
  FOREST_S, FOREST_M, FOREST_L, PEAK_S, PEAK_M, PEAK_L, HILL, HILL_L, DUNE, POND, LAKE, VOLCANO, MESA, PALM, ACACIA,
  PINE, PINE_SNOW, SPIRES, ROCKS, TUFT,
];
