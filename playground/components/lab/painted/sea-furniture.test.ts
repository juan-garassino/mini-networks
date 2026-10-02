import { test } from "node:test";
import assert from "node:assert/strict";
import { extractSprites, placeFurniture } from "./sea-furniture.ts";

// 12×8 toy map: sea everywhere (palette 0), a 3×2 "ship" (palette 1) in open
// sea, a land pixel cluster (lands=0) and a speck.
function toy() {
  const w = 12, h = 8;
  const idx = new Uint16Array(w * h);
  const sea = new Uint8Array(w * h).fill(1);
  const lands = new Int8Array(w * h).fill(-1);
  const put = (x: number, y: number, v: number, land = -1) => { const p = y * w + x; idx[p] = v; sea[p] = 0; lands[p] = land; };
  for (let y = 2; y < 4; y++) for (let x = 2; x < 5; x++) put(x, y, 1);
  for (let y = 5; y < 7; y++) for (let x = 6; x < 9; x++) put(x, y, 2, 0);
  put(10, 1, 3);
  return { idx, sea, lands, w, h };
}

test("extractSprites lifts open-sea clusters, skips land and specks", () => {
  const { idx, sea, lands, w, h } = toy();
  const sp = extractSprites(idx, sea, lands, w, h);
  assert.equal(sp.length, 1);
  assert.deepEqual([sp[0].w, sp[0].h, sp[0].area], [3, 2, 6]);
  assert.equal(sp[0].px[0], 1);
});

test("placeFurniture is deterministic and never covers the map", () => {
  const { idx, sea, lands, w, h } = toy();
  const sp = extractSprites(idx, sea, lands, w, h);
  const a = placeFurniture(sp, w, h, { padX: 60, padY: 40, cell: 8, density: 1, seed: 3 });
  const b = placeFurniture(sp, w, h, { padX: 60, padY: 40, cell: 8, density: 1, seed: 3 });
  assert.deepEqual(a, b);
  assert.ok(a.length > 10);
  for (const p of a) {
    const s = sp[p.sprite];
    const overMap = p.x + s.w > -8 && p.x < w + 8 && p.y + s.h > -8 && p.y < h + 8;
    assert.equal(overMap, false);
  }
});
