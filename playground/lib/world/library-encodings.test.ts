// The design library's encoding contract (lib/encoding.ts), checked for every
// kept design: each mark encodes something, each kind is known, and every key
// row points at a real mark. Lives here because package.json's test glob
// covers lib/world/*.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { auditEncoding, type Encoding, type MarkKey } from "../encoding.ts";
import * as periodic from "../../components/periodic/encoding.ts";
import * as metro from "../../components/metro/encoding.ts";
import * as sky from "../../components/lab/sky/encoding.ts";
import * as flow from "../../components/lab/flow/encoding.ts";
import * as anatomy from "../../components/lab/shared/anatomy2/encoding.ts";
import * as painted from "../../components/lab/painted/encoding.ts";

const DESIGNS: [string, Encoding, MarkKey[]][] = [
  ["periodic", periodic.ENCODING, [periodic.KEY_PARTS, periodic.KEY_LEVELS]],
  ["transit", metro.ENCODING, [metro.KEY]],
  ["star atlas", sky.ENCODING, [sky.KEY]],
  ["kawaii flow", flow.ENCODING, []],
  ["kawaii flow eggs", flow.EGGS, []],
  ["pixel diagrams", anatomy.ENCODING, []],
  ["painted maps", painted.ENCODING, [painted.KEY, painted.PAPER_KEY]],
];

for (const [name, enc, keys] of DESIGNS) {
  test(`${name}: every mark encodes something and every key row names a real mark`, () => {
    assert.ok(Object.keys(enc).length > 0, "an empty encoding");
    assert.deepEqual(auditEncoding(enc, keys), []);
  });
}

test("a key row naming a missing mark is caught", () => {
  const bad = auditEncoding({ dot: { encodes: "a model" } }, [{ rows: [{ mark: "ring", sample: "x", label: "Ring" }] }]);
  assert.equal(bad.length, 1);
});
