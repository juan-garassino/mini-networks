// Invariants of the Transit diagram (components/metro/layout.ts): one connected
// system map held to the data and to the genre. Lives here so the existing
// `lib/world/*.test.ts` glob runs it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { TaxonomyResponse } from "../types.ts";
import { G, ROUTES, STATIONS, buildMetro } from "../../components/metro/layout.ts";

const tax: TaxonomyResponse = JSON.parse(
  readFileSync(new URL("./__fixtures__/taxonomy.json", import.meta.url), "utf8"),
);
const metro = buildMetro(tax);

test("audit: zero crossings, overlaps, pass-throughs, label collisions, off-grid legs", () => {
  const a = metro.audit;
  assert.deepEqual(
    { crossings: a.crossings, overlaps: a.overlaps, passThrough: a.passThrough, labels: a.labelCollisions, offGrid: a.offGrid },
    { crossings: 0, overlaps: 0, passThrough: 0, labels: 0, offGrid: 0 },
    a.details.join("\n"),
  );
});

test("every model is a station and the drawn service equals the data", () => {
  assert.equal(metro.stations.length, tax.models.length);
  assert.deepEqual(metro.unplaced, []);
  assert.deepEqual(metro.audit.serviceMismatch, []);
});

test("interchanges are exactly the models served by two or more lines", () => {
  const ring = metro.stations.filter((s) => s.kind === "interchange").map((s) => s.name).sort();
  assert.deepEqual(ring, ["audio_transformer", "clip", "dino", "rlhf", "sam", "tabular_diffusion", "text_diffusion", "vit"]);
});

test("one connected system: every line but the Structure shuttle meets another line", () => {
  const adj = new Map<string, Set<string>>();
  for (const l of metro.lines) adj.set(l.family, new Set());
  for (const s of metro.stations) for (const a of s.lines) for (const b of s.lines) if (a !== b) adj.get(a)?.add(b);
  const seen = new Set<string>(["sequence"]);
  const queue = ["sequence"];
  while (queue.length) for (const n of adj.get(queue.shift()!) ?? []) if (!seen.has(n)) { seen.add(n); queue.push(n); }
  assert.deepEqual([...seen].sort(), ["decision", "generative", "perception", "representation", "sequence"]);
});

test("stations and corners sit on the grid", () => {
  for (const s of Object.values(STATIONS)) assert.ok(Number.isInteger(s.x) && Number.isInteger(s.y));
  for (const r of Object.values(ROUTES)) for (const e of r.flat()) if (Array.isArray(e)) assert.ok(e.every(Number.isInteger));
  for (const s of metro.stations) assert.ok(s.x % G === 0 && s.y % G === 0);
});

test("deterministic: input order never changes the drawing", () => {
  const shuffled = { ...tax, models: [...tax.models].reverse() };
  assert.deepEqual(JSON.stringify(buildMetro(shuffled).lines), JSON.stringify(metro.lines));
});

test("a model the drafting does not know is listed, not lost", () => {
  const extra = { ...tax, models: [...tax.models, { name: "hyena", level: "derived" as const, introduces: [], builds_on: ["mamba"], note: "", description: "" }] };
  const m = buildMetro(extra);
  assert.deepEqual(m.unplaced, ["hyena"]);
  assert.equal(m.audit.crossings, 0);
});
