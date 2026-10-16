// Run: node --test --experimental-strip-types --no-warnings "components/lab/shared/eggs/*.test.ts"
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { TaxonomyResponse } from "../../../../lib/types.ts";
import { KONAMI, advanceKonami, forwardPassOrder, forwardPassSchedule, konamiMatches } from "./konami.ts";

const tax: TaxonomyResponse = JSON.parse(
  readFileSync(new URL("../../../../lib/world/__fixtures__/taxonomy.json", import.meta.url), "utf8"),
);

const U = "ArrowUp", D = "ArrowDown", L = "ArrowLeft", R = "ArrowRight";

test("the exact sequence unlocks; upper-case B/A too", () => {
  assert.ok(konamiMatches([...KONAMI]));
  assert.ok(konamiMatches([U, U, D, D, L, R, L, R, "B", "A"]));
});

test("a stray extra ↑ at the start still unlocks (suffix fallback)", () => {
  assert.ok(konamiMatches([U, U, U, D, D, L, R, L, R, "b", "a"]));
});

test("noise before and a restart mid-way still unlock", () => {
  assert.ok(konamiMatches(["x", U, U, D, "q", U, U, D, D, L, R, L, R, "b", "a"]));
});

test("incomplete or wrong-order sequences do not unlock", () => {
  assert.ok(!konamiMatches([U, U, D, D, L, R, L, R, "b"]));
  assert.ok(!konamiMatches([U, U, D, D, R, L, R, L, "b", "a"]));
  assert.ok(!konamiMatches([U, D, U, D, L, R, L, R, "b", "a"]));
});

test("advanceKonami resets to 0 on an unrelated key and to 1 on ↑", () => {
  assert.equal(advanceKonami(5, "z"), 0);
  assert.equal(advanceKonami(5, U), 1);
  assert.equal(advanceKonami(2, U), 2);   // ↑↑↑ keeps the last two
  assert.equal(advanceKonami(9, "a"), 10);
});

test("forwardPassOrder groups the 44 models by generation depth", () => {
  const g = forwardPassOrder(tax);
  assert.equal(g.flat().length, 44);
  assert.equal(new Set(g.flat()).size, 44);
  const atoms = tax.models.filter((m) => m.level === "elementary").map((m) => m.name);
  assert.deepEqual([...g[0]].sort(), [...atoms].sort());
  // every model sits strictly after all of its parents
  const at = new Map(g.flatMap((names, i) => names.map((n) => [n, i] as const)));
  for (const m of tax.models) for (const p of m.builds_on) assert.ok(at.get(p)! < at.get(m.name)!, `${p} → ${m.name}`);
  // known depths: kimi builds on moe (depth 1) → depth 2; convnext on resnet → 2
  assert.equal(at.get("kimi"), 2);
  assert.equal(at.get("convnext"), 2);
  assert.equal(at.get("audio_melspectrogram"), 3);
});

test("forwardPassOrder accepts a world-like {nodes: {name, depth}}", () => {
  const g = forwardPassOrder({ nodes: [{ name: "a", depth: 1 }, { name: "b", depth: 0 }, { name: "c", depth: 1 }] });
  assert.deepEqual(g, [["b"], ["a", "c"]]);
});

test("forwardPassSchedule delays each group by stepMs", () => {
  const s = forwardPassSchedule([["a"], ["b", "c"]], 100);
  assert.deepEqual(s, { a: 0, b: 100, c: 100 });
});
