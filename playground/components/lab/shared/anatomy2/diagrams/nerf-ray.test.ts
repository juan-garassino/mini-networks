// The nerf hot ray, re-composited client-side, must match the numpy exporter
// (scripts/export_nerf_scene.py logs C = (.556, .556, .444), entry i = 87).
import { test } from "node:test";
import assert from "node:assert/strict";
import { NERF_GT_PIXEL, NERF_HOT } from "../data/nerf-scene.ts";
import { rayProfile } from "./nerf-ray.ts";

test("hot ray composites to the exporter's C and peaks at the wall entry", () => {
  const r = rayProfile();
  const want = [0.556, 0.556, 0.444];
  r.C.forEach((c, k) => assert.ok(Math.abs(c - want[k]) <= 0.002, `C[${k}] = ${c}`));
  const argmax = r.w.indexOf(Math.max(...r.w));
  assert.equal(argmax, NERF_HOT.entry);
  assert.ok(Math.abs(r.w[argmax] - 0.362) <= 0.002);
  // 200 midpoints vs the GT's 256 samples: still within .005 of the GT pixel
  r.C.forEach((c, k) => assert.ok(Math.abs(c - NERF_GT_PIXEL[k]) <= 0.005));
});
