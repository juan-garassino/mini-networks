// Egg data + try-it readers: grounded, consistent with the taxonomy/repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import type { TaxonomyResponse, RunSummary } from "../../../../lib/types.ts";
import { DOUBLE_DESCENT_EGG, GROKKING_EGG, NEXT_ERA, RUINS, dipDepth } from "./data.ts";
import { liveTrainingModels, stationCounts } from "./trains.ts";
import {
  SHAKESPEARE_CHARS, decodeShakespeare, drawnOne, readDigit, readMaze, readSamples, readText,
} from "../lesson/try-read.ts";

const tax: TaxonomyResponse = JSON.parse(
  readFileSync(new URL("../../../../lib/world/__fixtures__/taxonomy.json", import.meta.url), "utf8"),
);
const models = new Set(tax.models.map((m) => m.name));
const comps = new Set(tax.compositions.map((c) => c.name));

test("grokking + double_descent eggs point at real zoo entries", () => {
  assert.ok(models.has(GROKKING_EGG.model));
  assert.ok(comps.has(DOUBLE_DESCENT_EGG.composition));
});

test("next-era silhouettes are NOT in the zoo yet and hang off real parents", () => {
  for (const n of NEXT_ERA) {
    assert.ok(!models.has(n.id), n.id);
    assert.ok(models.has(n.buildsOn), n.buildsOn);
  }
});

test("every ruin exists under legacy/ and its successor is alive", () => {
  const repo = new URL("../../../../../", import.meta.url);
  for (const r of RUINS) {
    assert.ok(existsSync(new URL(r.path, repo)), r.path);
    if (r.successor) assert.ok(models.has(r.successor) || comps.has(r.successor), r.successor);
  }
});

test("dipDepth has two dips with a crest between them", () => {
  const ys = Array.from({ length: 101 }, (_, i) => dipDepth(i / 100));
  const peaks = ys.filter((y, i) => i > 0 && i < 100 && y > ys[i - 1] && y >= ys[i + 1]);
  assert.equal(peaks.length, 2);
  assert.ok(dipDepth(0.5) < dipDepth(0.28) && dipDepth(0.5) < dipDepth(0.72));
  assert.ok(dipDepth(0) < 0.05 && dipDepth(1) < 0.05);
  assert.ok(ys.every((y) => y >= 0 && y <= 1));
});

test("trains: live models + station counts", () => {
  const r = (model: string, status: RunSummary["status"]): RunSummary => ({
    id: model + status, model, source: "local", status, last_metrics: {}, artifact_names: [],
  });
  const runs = [r("gan", "running"), r("gan", "done"), r("vae", "done"), r("gan", "running")];
  assert.deepEqual(liveTrainingModels(runs), ["gan"]);
  assert.deepEqual(stationCounts(runs), { gan: 3, vae: 1 });
});

test("try-read: shakespeare decode matches the live transformer champion", () => {
  assert.equal(SHAKESPEARE_CHARS.length, 65);
  // ids returned by POST /infer/transformer on 2026-09-28
  const ids = [0, 52, 53, 58, 1, 51, 39, 50, 47, 60, 43, 1, 46, 43, 1, 61, 39, 56, 57, 6];
  assert.equal(decodeShakespeare(ids), "\nnot malive he wars,");
  assert.equal(decodeShakespeare([70]), null);
  const t = readText({ tokens: [ids] });
  assert.equal(t.kind, "text");
  assert.equal(readText({ generated: "To be" }).kind, "text");
  assert.equal(readText({ nothing: 1 }).kind, "json");
});

test("try-read: drawn 1, digit label, maze, samples", () => {
  const one = drawnOne();
  assert.equal(one.length, 28);
  assert.ok(one.every((row) => row.length === 28 && row.every((v) => v >= 0 && v <= 1)));
  assert.ok(one[14][14] === 1 && one[0][0] === 0);
  const d = readDigit({ predictions: [1], logits: [[-2.13, 10.12, -2.33, -6.38, -1.21, -7.43, -1.37, -4.48, -1.67, -3.05]] });
  assert.deepEqual(d, { kind: "label", label: "it reads: 1", detail: "100% sure" });
  const m = readMaze({ actions: [3, 3, 1], success: true, steps: 3, total_reward: 1 });
  assert.equal(m.kind === "label" && m.detail, "→→↓");
  const s = readSamples({ samples: [[[[0, 0.5], [1, 2]]]] });
  assert.ok(s.kind === "image" && s.grids[0][1][1] === 1);
});
