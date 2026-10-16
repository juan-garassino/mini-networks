// rpp_classifier structure numbers: the conv band inside the dense matrix, the
// parameter total and the prior terms at init must match the dossier (rpp.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { RPP_INIT, RPP_LAMBDA, RPP_PARAMS } from "../data/rpp-structure.ts";
import { avgPool2, bandCount, bandRuns, bellHeights, sigmaOf } from "./rpp-band.ts";

test("the conv is a 9-diagonal band inside the dense channel-pair block", () => {
  assert.equal(bandCount(7), 361);
  assert.equal(bandCount(14), 1600);
  let n = 0;
  for (let o = 0; o < 49; o++) for (const [a, b] of bandRuns(7, o)) n += b - a;
  assert.equal(n, 361);
});

test("parameter counts sum to the model's 616 098", () => {
  const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);
  assert.equal(sum(RPP_PARAMS.conv) + sum(RPP_PARAMS.free) + sum(RPP_PARAMS.bn) + RPP_PARAMS.head, RPP_PARAMS.total);
  assert.equal(RPP_PARAMS.conv[0], 8 * 1 * 9);
  assert.equal(RPP_PARAMS.conv[1], 16 * 8 * 9);
  assert.equal(RPP_PARAMS.free[0], 196 * 1568);
  assert.equal(RPP_PARAMS.free[1], 392 * 784);
});

test("prior terms at init: .0008 conv vs 7.84 free; sigma ratio 10x", () => {
  assert.equal((RPP_LAMBDA.conv * RPP_INIT.convSq).toFixed(4), "0.0008");
  assert.equal((RPP_LAMBDA.free * RPP_INIT.freeSq).toFixed(2), "7.84");
  assert.ok(Math.abs(sigmaOf(RPP_LAMBDA.conv) / sigmaOf(RPP_LAMBDA.free) - 10) < 1e-9);
  const wide = bellHeights(RPP_LAMBDA.conv, 40, 100, 10);
  const narrow = bellHeights(RPP_LAMBDA.free, 40, 100, 10);
  assert.ok(wide.filter((h) => h > 0).length > narrow.filter((h) => h > 0).length);
});

test("avgPool2 is the 2x2 mean", () => {
  assert.deepEqual([...avgPool2([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], 4, 4)], [3.5, 5.5, 11.5, 13.5]);
});
