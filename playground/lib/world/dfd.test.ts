// Invariants of the Kawaii DFD sheet (/lab/flow): every builds_on edge is an orthogonal
// route that never crosses, touches or runs on top of another parent's route and never
// passes within one track of a box — on the real graph, on 5 seeded shuffles of it, and
// on 5 seeded perturbations (a few leaves removed), for the desktop and the phone sheet.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { TaxonomyResponse } from "../types.ts";
import { familyMapFromBlueprint } from "./index.ts";
import { auditDfd, buildDfd, DFD_G, DFD_OFFSHEET_MAX, elbowD, type DfdLayout, type DfdMode } from "./dfd.ts";
import { mulberry32, shuffle } from "./rng.ts";

const tax: TaxonomyResponse = JSON.parse(readFileSync(new URL("./__fixtures__/taxonomy.json", import.meta.url), "utf8"));
const fam = familyMapFromBlueprint();

function clean(l: DfdLayout, what: string) {
  const a = auditDfd(l);
  assert.equal(a.crossings, 0, `${what}: crossings`);
  assert.equal(a.overlaps, 0, `${what}: overlaps`);
  assert.equal(a.boxHits, 0, `${what}: box hits`);
  assert.equal(a.nonOrthogonal, 0, `${what}: diagonal runs`);
  assert.equal(a.labelHits, 0, `${what}: label hits`);
  assert.ok(l.offSheet.length <= DFD_OFFSHEET_MAX, `${what}: off-sheet budget`);
  // every routed edge ends ON its target's edge, its last run perpendicular to it
  const by = new Map(l.boxes.map((b) => [b.name, b]));
  for (const e of l.edges) {
    if (e.offSheet) { assert.equal(e.points.length, 0); continue; }
    const z = e.points[e.points.length - 1], y = e.points[e.points.length - 2], t = by.get(e.to)!;
    const onSide = (z.x === t.x || z.x === t.x + t.w) && z.y > t.y && z.y < t.y + t.h && y.y === z.y;
    const onTop = (z.y === t.y || z.y === t.y + t.h) && z.x > t.x && z.x < t.x + t.w && y.x === z.x;
    assert.ok(onSide || onTop, `${what}: ${e.from}->${e.to} arrives on ${t.name}'s edge`);
    for (const p of e.points.slice(1, -1)) assert.ok(p.x % DFD_G === 0 && p.y % DFD_G === 0, `${what}: ${e.from}->${e.to} off the track grid`);
    assert.doesNotMatch(elbowD(e.points), /[CQSTcqst]/, "no Béziers: straight runs and one-radius arcs only");
  }
  // no two boxes overlap; every model is on the sheet, every edge is drawn or off-sheet
  for (let i = 0; i < l.boxes.length; i++) for (let j = i + 1; j < l.boxes.length; j++) {
    const a = l.boxes[i], b = l.boxes[j];
    assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${what}: ${a.name} overlaps ${b.name}`);
  }
}

const edgeCount = (t: TaxonomyResponse) => {
  const names = new Set(t.models.map((m) => m.name));
  return t.models.reduce((s, m) => s + new Set(m.builds_on.filter((p) => names.has(p) && p !== m.name)).size, 0);
};

for (const mode of ["desktop", "mobile"] as DfdMode[]) {
  test(`${mode}: the real graph routes with zero crossings, overlaps and box hits`, () => {
    const l = buildDfd(tax, fam, { mode });
    clean(l, mode);
    assert.equal(l.boxes.length, 44);
    assert.equal(l.edges.length, edgeCount(tax));
    // every cross-family edge carries its inline label on desktop
    if (mode === "desktop") {
      assert.equal(l.offSheet.length, 0, "desktop: everything routes on the sheet");
      assert.equal(l.audit.unlabelled, 0, "desktop: every cross-family edge labelled");
      // the grid: a generation column shares one left x in its stack
      const xs = new Map<string, Set<number>>();
      for (const b of l.boxes) { const k = `${b.stack}:${b.col}`; if (!xs.has(k)) xs.set(k, new Set()); xs.get(k)!.add(b.x); }
      for (const [k, s] of xs) assert.equal(s.size, 1, `column ${k} is aligned`);
    }
  });

  test(`${mode}: 5 seeded shuffles of the model order give the same sheet`, () => {
    const ref = JSON.stringify(buildDfd(tax, fam, { mode }));
    for (let seed = 1; seed <= 5; seed++) {
      const rnd = mulberry32(seed * 7919);
      // model order is shuffled; builds_on order is data (its first entry breaks primary-parent ties)
      const t: TaxonomyResponse = { ...tax, models: shuffle([...tax.models], rnd) };
      assert.equal(JSON.stringify(buildDfd(t, fam, { mode })), ref, `seed ${seed}`);
    }
  });

  test(`${mode}: 5 seeded perturbations (leaves removed) still route cleanly`, () => {
    for (let seed = 1; seed <= 5; seed++) {
      const rnd = mulberry32(seed * 104729);
      const parents = new Set(tax.models.flatMap((m) => m.builds_on));
      const leaves = tax.models.filter((m) => !parents.has(m.name)).map((m) => m.name);
      const drop = new Set(shuffle([...leaves], rnd).slice(0, 1 + (seed % 3)));
      const t: TaxonomyResponse = { ...tax, models: tax.models.filter((m) => !drop.has(m.name)) };
      clean(buildDfd(t, fam, { mode }), `${mode} seed ${seed} (−${[...drop].join(", ")})`);
    }
  });
}
