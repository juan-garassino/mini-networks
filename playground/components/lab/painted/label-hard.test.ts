import { test } from "node:test";
import assert from "node:assert/strict";
import { placeTags, type TagSpec } from "./labels.ts";
import type { Box } from "./anchors.ts";

const hits = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const bounds = { x: 0, y: 0, w: 400, h: 300 };

// (ribbons.ts applies the same rule; it imports the pixel-art raster, which
// needs the app's path aliases, so it is covered by the screenshots instead)
test("tags: never partly under a hard box (the map plate); a plain tag that cannot clear it is left out", () => {
  const hard = [{ x: 0, y: 0, w: 210, h: 300 }];
  const spec = (name: string, x: number, must = false): TagSpec => ({ name, text: name, at: { x, y: 150 }, w: 40, h: 14, priority: must ? 1000 : 1, must });
  const out = placeTags([spec("buried", 100), spec("sel", 230, true)], { markerR: 4, obstacles: [], bounds, hard });
  assert.deepEqual(out.map((t) => t.name), ["sel"]);
  assert.ok(!hits(out[0].box, hard[0]));
});
