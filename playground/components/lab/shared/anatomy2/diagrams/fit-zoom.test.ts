// The specimen page's sizing rule (legible.ts fitZoom): the largest crisp zoom
// whose labels meet the floor and whose width fits — never ×1, never a
// fractional device pixel. Lives beside the diagram tests so `npm test` runs it.
import assert from "node:assert/strict";
import test from "node:test";
import { LEGIBLE, fitZoom, isCrisp, isLegible } from "../legible.ts";

const FULL_W = 560, CARD_W = 190;

test("a full drawing takes ×2 when it fits, ×1.5 on retina when only that fits", () => {
  assert.equal(fitZoom(1248, FULL_W, 2), 2);   // 1280 wide, no index
  assert.equal(fitZoom(992, FULL_W, 2), 1.5);  // 1024 wide: 840 px, 3 device px per art px
  assert.equal(fitZoom(992, FULL_W, 1), null); // ×1.5 is not crisp on dpr 1 → the card
});

test("no full drawing on a phone: the card instead", () => {
  assert.equal(fitZoom(358, FULL_W, 2), null);
  assert.equal(fitZoom(358, FULL_W, 3), null);
});

test("phone cards sit on whole device pixels with legible labels", () => {
  for (const dpr of [2, 3]) {
    const z = fitZoom(358, CARD_W, dpr);
    assert.ok(z !== null);
    assert.ok(isCrisp(z, dpr) && isLegible(z), `dpr ${dpr}: ×${z}`);
    assert.ok(z * CARD_W <= 358);
  }
  assert.equal(fitZoom(358, CARD_W, 2), 1.5);
  assert.equal(fitZoom(358, CARD_W, 3), 5 / 3);
  assert.equal(fitZoom(380, CARD_W, 2), LEGIBLE.cardZoom);
});
