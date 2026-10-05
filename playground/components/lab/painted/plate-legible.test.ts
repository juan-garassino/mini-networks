// The diagram kit's legibility floor (anatomy2/legible.ts), as the map plate
// uses it: the full drawing only at a crisp zoom whose labels read, else the card.
import { test } from "node:test";
import assert from "node:assert/strict";
import { LEGIBLE, fallbackFor, isCrisp, isLegible, labelPx, legibleZooms } from "../shared/anatomy2/legible.ts";

test("×1 fails the floor, ×1.5 passes it", () => {
  assert.equal(labelPx(1), 7);
  assert.equal(isLegible(1), false);
  assert.equal(isLegible(1.5), true);
  assert.ok(labelPx(LEGIBLE.cardZoom) >= LEGIBLE.minLabelPx);
});

test("legible zooms are crisp on the screen they are for", () => {
  assert.deepEqual(legibleZooms(2), [1.5, 2]);
  assert.deepEqual(legibleZooms(1), [2]);
  assert.deepEqual(legibleZooms(3), [5 / 3, 2]);
  for (const d of [1, 2, 3]) for (const z of legibleZooms(d)) assert.ok(isCrisp(z, d) && isLegible(z));
});

test("a full drawing below the floor falls back to the card", () => {
  assert.equal(fallbackFor(560, 560), "card");
  assert.equal(fallbackFor(840, 560), "full");
  assert.equal(fallbackFor(1120, 560), "full");
});
