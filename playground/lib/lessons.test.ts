// Lesson coverage + budget: every taxonomy model/composition has copy, and no
// model lesson exceeds 60 words. Run:
//   node --test --experimental-strip-types --no-warnings lib/lessons.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { TaxonomyResponse } from "./types.ts";
import { COMPOSITION_LESSONS, LESSONS, lessonFor, missingLessons, wordCount } from "./lessons.ts";

const tax: TaxonomyResponse = JSON.parse(
  readFileSync(new URL("./world/__fixtures__/taxonomy.json", import.meta.url), "utf8"),
);

test("fixture is the 44-model / 22-composition zoo", () => {
  assert.equal(tax.models.length, 44);
  assert.equal(tax.compositions.length, 22);
});

test("every taxonomy model and composition has a lesson", () => {
  assert.deepEqual(missingLessons(tax), { models: [], compositions: [] });
});

test("no orphan lessons (names that are not in the taxonomy)", () => {
  const models = new Set(tax.models.map((m) => m.name));
  const comps = new Set(tax.compositions.map((c) => c.name));
  assert.deepEqual(Object.keys(LESSONS).filter((n) => !models.has(n)), []);
  assert.deepEqual(Object.keys(COMPOSITION_LESSONS).filter((n) => !comps.has(n)), []);
});

test("each model lesson is ≤ 60 words and has what/why/idea", () => {
  for (const [name, l] of Object.entries(LESSONS)) {
    assert.ok(l.what && l.why && l.idea, `${name}: empty field`);
    const n = wordCount(l);
    assert.ok(n <= 60, `${name}: ${n} words`);
  }
});

test("composition lessons are one sentence", () => {
  for (const [name, line] of Object.entries(COMPOSITION_LESSONS)) {
    const sentences = line.split(/[.!?](\s|$)/).filter((s) => s && s.trim().length > 1);
    assert.equal(sentences.length, 1, `${name}: ${line}`);
  }
});

test("lessonFor resolves models, compositions and unknowns", () => {
  assert.equal(lessonFor("transformer")?.kind, "model");
  assert.equal(lessonFor("vlm")?.kind, "composition");
  assert.equal(lessonFor("nope"), null);
});
