// Invariants of the Transit diagram (components/metro/layout.ts drafting +
// system.ts engine): one connected system map held to the data and to the genre. Lives here so the existing
// `lib/world/*.test.ts` glob runs it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { TaxonomyResponse } from "../types.ts";
import { G, ROUTES, STATIONS, buildMetro } from "../../components/metro/layout.ts";
import { buildSystem, type SystemSpec } from "../../components/metro/system.ts";

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
  assert.deepEqual(metro.auto, [], "the drafting knows every model: nothing falls back");
  assert.deepEqual(metro.audit.serviceMismatch, []);
});

test("interchanges are exactly the models served by two or more lines", () => {
  const ring = metro.stations.filter((s) => s.kind === "interchange").map((s) => s.id).sort();
  assert.deepEqual(ring, ["audio_transformer", "clip", "dino", "rlhf", "sam", "tabular_diffusion", "text_diffusion", "vit"]);
});

test("one connected system: every line but the Structure shuttle meets another line", () => {
  const adj = new Map<string, Set<string>>();
  for (const l of metro.lines) adj.set(l.id, new Set());
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

const clean = (m: ReturnType<typeof buildMetro>) => {
  const a = m.audit;
  return { crossings: a.crossings, overlaps: a.overlaps, passThrough: a.passThrough, labels: a.labelCollisions, offGrid: a.offGrid };
};
const ZERO = { crossings: 0, overlaps: 0, passThrough: 0, labels: 0, offGrid: 0 };
const model = (name: string, builds_on: string[]) => ({ name, level: "derived" as const, introduces: [], builds_on, note: "", description: "" });

test("a model the drafting does not know is placed by the fallback, on a clean spur of its line", () => {
  const m = buildMetro({ ...tax, models: [...tax.models, model("hyena", ["mamba"])] });
  assert.deepEqual(m.unplaced, []);
  assert.deepEqual(m.auto, ["hyena"]);
  assert.deepEqual(clean(m), ZERO, m.audit.details.join("\n"));
  const spur = m.lines.find((l) => l.id === "sequence")!.paths.find((p) => p.auto)!;
  assert.deepEqual(spur.stations, ["mamba", "hyena"]);
  const st = m.stations.find((s) => s.id === "hyena")!;
  assert.ok(st.auto && st.terminus && st.x % G === 0 && st.y % G === 0);
});

test("the fallback serves a two-family model on both of its lines when a clean spur fits", () => {
  const m = buildMetro({ ...tax, models: [...tax.models, model("pixel_text", ["pixelcnn", "text_diffusion"]), model("hyena", ["mamba"]), model("tiny_vit", ["vit"])] });
  assert.deepEqual(m.unplaced, []);
  assert.deepEqual(clean(m), ZERO, m.audit.details.join("\n"));
  assert.deepEqual(m.auto, ["hyena", "pixel_text", "tiny_vit"]);
  assert.deepEqual(m.audit.serviceMismatch, []);
  assert.equal(m.stations.find((s) => s.id === "pixel_text")!.kind, "interchange");
});

test("an auto-placed station never hides on a trunk, and a line it cannot reach is reported, not faked", () => {
  const m = buildMetro({ ...tax, models: [...tax.models, model("tiny_vit", ["vit"]), model("gnn_vae", ["gnn", "vae"])] });
  assert.deepEqual(clean(m), ZERO, m.audit.details.join("\n"));
  const tiny = m.stations.find((s) => s.id === "tiny_vit")!;
  const trunk = m.stations.filter((s) => s.x === tiny.x && s.id !== "tiny_vit").map((s) => s.y);
  assert.ok(!(tiny.x === m.stations.find((s) => s.id === "vit")!.x && trunk.some((y) => y > tiny.y) && trunk.some((y) => y < tiny.y)), "tiny vit sits between two trunk stops");
  // gnn (the north-east island) and vae (the south-west) are too far apart for
  // one clean, short spur. (gan + rlhf used to be the example; with the
  // district names gone their cells are free and the spur now fits.)
  assert.deepEqual(m.audit.serviceMismatch, ["gnn_vae: data generative,structure ≠ drawn structure"]);
});

test("the engine maps any graph: a stub drafting grows by the fallback into a clean map", () => {
  // the smallest drafting: two origins, each with one drafted leg; the rest is placed
  const spec: SystemSpec = {
    cols: 30, rows: 20,
    lines: [{ id: "a", name: "A", color: "#e2826d" }, { id: "b", name: "B", color: "#6b8fd0" }],
    stations: [
      { id: "root", label: "root", lines: ["a"], origin: true, at: { x: 6, y: 10, side: "w" } },
      { id: "one", label: "one", lines: ["a"], parents: ["root"], at: { x: 10, y: 10, side: "s" } },
      { id: "hub", label: "hub", lines: ["b"], origin: true, at: { x: 20, y: 10, side: "n" } },
      { id: "three", label: "three", lines: ["b"], parents: ["hub"], at: { x: 24, y: 10, side: "s" } },
      { id: "two", label: "two", lines: ["a"], parents: ["one"] },
      { id: "four", label: "four", lines: ["b"], parents: ["three"] },
    ],
    routes: { a: [["root", "one"]], b: [["hub", "three"]] },
  };
  const m = buildSystem(spec);
  assert.deepEqual(m.unplaced, []);
  assert.deepEqual(m.auto, ["four", "two"]);
  const a = m.audit;
  assert.equal(a.crossings + a.overlaps + a.labelCollisions + a.passThrough + a.offGrid, 0, a.details.join("\n"));
  assert.deepEqual(a.serviceMismatch, []);
  assert.equal(JSON.stringify(buildSystem(spec)), JSON.stringify(m), "deterministic");
});
