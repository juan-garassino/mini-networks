// Life on the pixel map: the moving pixels only ever show colours from their
// own ramp, never touch our markers, and a frame is deterministic in t.
import assert from "node:assert/strict";
import { test } from "node:test";
import { analyseLife, paintLife } from "./life.ts";
import type { PixelMap } from "./pixelmap.ts";

// a 24×16 toy map: parchment sea (0) round a land of grass (1) with a pond of
// two blues (2 dark, 3 light), a white foam pixel (4), a yellow window (5), a
// hot lava strip (6, 7) and a bush (8 darker green)
const HEX = ["#f0e1ae", "#b5b93d", "#0780af", "#24b9d4", "#ffffff", "#feed73", "#e98637", "#fece66", "#597b29"];
function toy(): { pm: PixelMap; sea: Uint8Array; lands: Int8Array } {
  const w = 24, h = 16;
  const idx = new Uint16Array(w * h);
  const lands = new Int8Array(w * h).fill(-1);
  const sea = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x;
    const land = x >= 2 && x < 22 && y >= 2 && y < 14;
    if (!land) { sea[p] = 1; idx[p] = 0; continue; }
    lands[p] = 0;
    idx[p] = 1;
    if (x >= 4 && x < 12 && y >= 4 && y < 12) idx[p] = (x + y) & 1 ? 2 : 3; // pond, 64 px
    if (x === 12 && y === 8) idx[p] = 4;                                     // foam beside the pond
    if (x === 18 && y === 5) idx[p] = 5;                                     // a window
    if (x >= 14 && x < 20 && y >= 9 && y < 13) idx[p] = y & 1 ? 6 : 7;        // lava, 24 px (too small: ignored)
    if (x >= 15 && x < 19 && y >= 2 && y < 4) idx[p] = 8;                    // a bush, 8 px… + 4 more
    if (x >= 16 && x < 18 && y === 4) idx[p] = 8;
  }
  const palette = new Uint8Array(HEX.length * 3);
  HEX.forEach((c, i) => { palette[i * 3] = parseInt(c.slice(1, 3), 16); palette[i * 3 + 1] = parseInt(c.slice(3, 5), 16); palette[i * 3 + 2] = parseInt(c.slice(5, 7), 16); });
  return { pm: { w, h, palette, hex: HEX, idx }, sea, lands };
}

test("classes find the pond, its foam, the window and the bush, not the sea", () => {
  const { pm, sea, lands } = toy();
  const life = analyseLife(pm, sea, lands, 0, { vents: [[17, 9]], lamps: [] });
  assert.equal(life.water.px.length, 0, "a 64-px pond is a roof-sized blue, not water");
  assert.equal(life.lights.px.length, 1);
  assert.equal(life.foliage.px.length, 10);
  assert.equal(life.crater.length, 1);
  for (const p of life.foliage.px) assert.equal(sea[p], 0);
});

test("a frame only ever paints ramp colours, skips protected pixels and repeats in t", () => {
  const { pm, sea, lands } = toy();
  // make the pond coastal so it counts as water
  const w = pm.w;
  for (let y = 4; y < 12; y++) { const p = y * w + 3; sea[p] = 1; lands[p] = -1; pm.idx[p] = 0; }
  const life = analyseLife(pm, sea, lands, 0, { vents: [], lamps: [[20, 12]] });
  assert.ok(life.water.px.length > 0, "a pond on the coast is water");
  const skip = new Uint8Array(pm.w * pm.h);
  skip[6 * w + 6] = 1;
  const fp = { skip, ghost: null, ghostRGB: (r: number, g: number, b: number) => [r, g, b] as const };
  const a = new Uint8ClampedArray(pm.w * pm.h * 4), b = new Uint8ClampedArray(pm.w * pm.h * 4);
  paintLife(a, pm, life, 1.25, fp);
  paintLife(b, pm, life, 1.25, fp);
  assert.deepEqual(a, b);
  assert.equal(a[(6 * w + 6) * 4 + 3], 0, "protected pixel untouched");
  const allowed = new Set(HEX.map((c) => c.toLowerCase()).concat(["#feed73", "#fffebb"]));
  let painted = 0;
  for (let p = 0; p < pm.w * pm.h; p++) {
    if (!a[p * 4 + 3]) continue;
    painted++;
    const c = `#${[a[p * 4], a[p * 4 + 1], a[p * 4 + 2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    if (life.water.rampPos[pm.idx[p]] >= 0) assert.ok(c === "#0780af" || c === "#24b9d4", `water pixel shows ${c}`);
    assert.ok(allowed.has(c), `unknown colour ${c}`);
  }
  assert.ok(painted > 0);
});
