// Invariants of the flow layout (spec § Tests → Flow).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { TaxonomyResponse } from "../types.ts";
import type { Box, Pt } from "./types.ts";
import { buildFlow, familyMapFromBlueprint } from "./index.ts";
import { mulberry32, shuffle } from "./rng.ts";

const tax: TaxonomyResponse = JSON.parse(
  readFileSync(new URL("./__fixtures__/taxonomy.json", import.meta.url), "utf8"),
);
const fam = familyMapFromBlueprint();
const flow = buildFlow(tax, fam);
const byName = new Map(flow.nodes.map((n) => [n.name, n]));

/** Frozen from the 2026-09-28 snapshot; a layout change that adds crossings must justify raising it. */
const CROSSINGS_BOUND = 31;

test("columns are generation depth, lanes are families", () => {
  assert.equal(flow.nodes.length, 44);
  for (const n of flow.nodes) {
    assert.equal(n.col, n.depth);
    assert.equal(n.box.x, flow.columns[n.depth].x);
    assert.equal(flow.lanes[n.lane].family, n.family);
    assert.equal(n.family, fam[n.name]);
  }
  assert.deepEqual(flow.columns.map((c) => c.depth), [0, 1, 2, 3]);
  assert.deepEqual([...flow.lanes.map((l) => l.family)].sort(),
    ["decision", "generative", "perception", "representation", "sequence", "structure"]);
});

test("boxes are disjoint and sit inside their lane", () => {
  const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const [i, n] of flow.nodes.entries()) {
    const lane = flow.lanes[n.lane];
    assert.ok(n.box.y >= lane.y && n.box.y + n.box.h <= lane.y + lane.h, `${n.name} leaves its lane`);
    assert.ok(n.box.x >= 0 && n.box.x + n.box.w <= flow.width && n.box.y + n.box.h <= flow.height);
    for (const m of flow.nodes.slice(i + 1)) assert.ok(!overlap(n.box, m.box), `${n.name} × ${m.name}`);
  }
  for (let l = 1; l < flow.lanes.length; l++) {
    assert.ok(flow.lanes[l].y >= flow.lanes[l - 1].y + flow.lanes[l - 1].h);
  }
});

test("one axis-aligned pipe per edge, anchored at ports, crossing no foreign box", () => {
  const edges = tax.models.flatMap((m) => m.builds_on.map((p) => `${p}->${m.name}`)).sort();
  assert.deepEqual(flow.pipes.map((p) => `${p.from}->${p.to}`).sort(), edges);
  const hits = (a: Pt, b: Pt, box: Box) => {
    // strict interior intersection of an axis-aligned segment with a box
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    return x0 < box.x + box.w && x1 > box.x && y0 < box.y + box.h && y1 > box.y;
  };
  for (const p of flow.pipes) {
    const s = byName.get(p.from)!.box;
    const t = byName.get(p.to)!.box;
    const first = p.points[0];
    const last = p.points[p.points.length - 1];
    assert.equal(first.x, s.x + s.w, `${p.from}->${p.to} out-port`);
    assert.ok(first.y > s.y && first.y < s.y + s.h);
    assert.equal(last.x, t.x, `${p.from}->${p.to} in-port`);
    assert.ok(last.y > t.y && last.y < t.y + t.h);
    assert.equal(p.crossLane, byName.get(p.from)!.lane !== byName.get(p.to)!.lane);
    for (let i = 1; i < p.points.length; i++) {
      const a = p.points[i - 1];
      const b = p.points[i];
      assert.ok(a.x === b.x || a.y === b.y, `${p.from}->${p.to} diagonal segment`);
      for (const n of flow.nodes) {
        if (n.name === p.from || n.name === p.to) continue;
        assert.ok(!hits(a, b, n.box), `${p.from}->${p.to} crosses ${n.name}`);
      }
    }
    assert.ok(p.length > 0);
  }
});

test("barycenter ordering never loses to the seed order", () => {
  console.log(`# flow crossings ${flow.crossings} (seed ${flow.seedCrossings})`);
  assert.ok(flow.crossings <= flow.seedCrossings);
  assert.ok(flow.crossings <= CROSSINGS_BOUND);
});

test("sequence (the hub family) is not in an edge lane", () => {
  const i = flow.lanes.findIndex((l) => l.family === "sequence");
  assert.ok(i > 0 && i < flow.lanes.length - 1, `sequence lane ${i}`);
});

test("deterministic under input permutation", () => {
  const shuffled = { ...structuredClone(tax), models: shuffle(structuredClone(tax.models), mulberry32(3)) };
  assert.deepEqual(buildFlow(shuffled, fam), flow);
  assert.deepEqual(buildFlow(tax, fam), flow);
});
