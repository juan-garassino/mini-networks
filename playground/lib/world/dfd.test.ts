// Invariants of the Kawaii DFD sheet (/lab/flow): every builds_on edge is an orthogonal
// route that never crosses, touches or runs on top of another parent's route and never
// passes within one track of a box — on the real graph, on 5 seeded shuffles of it, and
// on 5 seeded perturbations (a few leaves removed), for the desktop and the phone sheet.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { TaxonomyResponse } from "../types.ts";
import { familyMapFromBlueprint } from "./index.ts";
import {
  auditDfd, buildDfd, detourRatio, DFD_BOX_TALL, DFD_DETOUR_MAX, DFD_G, DFD_INDENT, DFD_OFFSHEET_MAX, DFD_SHORT,
  elbowD, framedBoxes, routeLength, type DfdBox, type DfdEdge, type DfdLayout, type DfdMode,
} from "./dfd.ts";
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
  // a detour may remain only once the connector budget is spent (shuffled perturbations can
  // exhaust it; the real zoo never does — asserted below). Pairs between the two stacks
  // ("panel") are the rule, not a repair, so the budget counts only the others.
  const repairs = l.offSheet.filter((o) => o.why !== "panel");
  assert.ok(l.audit.detours === 0 || repairs.length === DFD_OFFSHEET_MAX, `${what}: a routed line is a detour with budget left`);
  assert.ok(repairs.length <= DFD_OFFSHEET_MAX, `${what}: off-sheet budget`);
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
    assert.equal(l.audit.detours, 0, `${mode}: no detour`);
    assert.equal(l.boxes.length, 44);
    assert.equal(l.edges.length, edgeCount(tax));
    // every cross-family edge carries its inline label on desktop
    if (mode === "desktop") {
      assert.equal(l.audit.unlabelled, 0, "desktop: every cross-family edge labelled");
      // the grid: a generation column shares one left x in its stack (island chips sit on the
      // shelf, outside the grid)
      const xs = new Map<string, Set<number>>();
      for (const b of l.boxes) if (!b.chip) { const k = `${b.stack}:${b.col}`; if (!xs.has(k)) xs.set(k, new Set()); xs.get(k)!.add(b.x); }
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

// ——— route quality (design pass 2): the detour rule, connector pairs, one label per trunk,
// island chips, the balanced sheet, the phone's file tree

test("desktop: no routed line is a detour; each connector pair replaced one", () => {
  const l = buildDfd(tax, fam, { mode: "desktop" });
  const by = new Map(l.boxes.map((b) => [b.name, b]));
  for (const e of l.edges) {
    if (e.offSheet) continue;
    const r = detourRatio(e.points, by.get(e.from)!, by.get(e.to)!);
    assert.ok(r <= DFD_DETOUR_MAX, `${e.from}->${e.to} runs ${r.toFixed(2)}× the distance between its boxes`);
  }
  // the trade is measured: a pair only ever replaces a line that was a detour (or had no route),
  // or joins the two stacks (wires stay in their panel)
  for (const o of l.offSheet) {
    if (o.why === "panel") assert.notEqual(by.get(o.from)!.stack, by.get(o.to)!.stack, `${o.from}->${o.to}: a panel pair inside one stack`);
    else assert.ok(o.why === "unroutable" || o.ratio > DFD_DETOUR_MAX, `${o.from}->${o.to}: replaced a ${o.ratio}× line`);
  }
  // the zoo's one hopeless line: a backward edge between the stacks
  assert.ok(l.offSheet.some((o) => o.from === "audio_spectrogram" && o.to === "audio_transformer"), "audio spectrogram → audio transformer is a pair");
});

for (const mode of ["desktop", "mobile"] as DfdMode[]) {
  test(`${mode}: every connector tag names the far end and sits on a stub out of its own box`, () => {
    const l = buildDfd(tax, fam, { mode });
    const by = new Map(l.boxes.map((b) => [b.name, b]));
    for (const o of l.offSheet) {
      for (const [tag, far, own] of [[o.out, o.to, o.from], [o.in, o.from, o.to]] as const) {
        // a bundle names every far end of its parent in the other stack, one line each
        const line = tag.lines.find((x) => x.text.endsWith(far.replace(/_/g, " ")));
        assert.ok(line && line.text.startsWith(`${line.address} `), `${tag.text}: address + name of ${far}`);
        assert.equal(line!.address, l.boxes.find((x) => x.name === far)!.address, `${tag.text}: the far end's address`);
        assert.equal(tag.text, tag.lines[0].text, `${tag.text}: text is the first line`);
        if (!tag.stub.length) {
          // a hub: its lines (routed edges) start on the tag and end on each child
          const hub = l.edges.find((e) => e.from === o.from && e.to === o.to)!;
          assert.ok(hub.hub && hub.points[0].x === tag.x + tag.w && hub.points[0].y > tag.y && hub.points[0].y < tag.y + tag.h, `${tag.text}: ${o.to}'s line leaves the hub`);
          continue;
        }
        const b = by.get(own)!;
        const port = tag === o.out ? tag.stub[0] : tag.stub[tag.stub.length - 1];
        const onEdge = port.x === b.x || port.x === b.x + b.w || port.y === b.y || port.y === b.y + b.h;
        assert.ok(onEdge, `${tag.text}: stub starts on ${own}'s edge`);
        assert.ok(routeLength(tag.stub) >= 12, `${tag.text}: a visible stub`);
      }
    }
  });

  test(`${mode}: one inline label per trunk, never a bare address`, () => {
    const l = buildDfd(tax, fam, { mode });
    const edges = new Map(l.edges.map((e) => [`${e.from}->${e.to}`, e]));
    const trunks = new Set<string>();
    for (const lab of l.labels) {
      assert.match(lab.text, /^\S+ \S/, `"${lab.text}" carries the parent's name`);
      const cross = lab.edges.map((k) => edges.get(k)!).filter((e) => e.cross);
      assert.ok(cross.length > 0, `"${lab.text}" names a cross-family line`);
      const keys = new Set(cross.map((e) => `${e.from}@${e.points[0].x},${e.points[0].y}`));
      assert.equal(keys.size, 1, `"${lab.text}" names one trunk`);
      const k = [...keys][0];
      assert.ok(!trunks.has(k), `"${lab.text}": its trunk is labelled twice`);
      trunks.add(k);
    }
    // a line too short for its label needs none; every longer one has its trunk's
    const labelled = new Set(l.labels.flatMap((x) => x.edges));
    // (a hub's lines are named by the hub's own tag)
    for (const e of l.edges) if (e.cross && !e.offSheet && !e.hub && routeLength(e.points) > DFD_SHORT) assert.ok(labelled.has(`${e.from}->${e.to}`), `${e.from}->${e.to} unlabelled`);
    if (mode === "desktop") {
      const t = l.boxes.find((b) => b.name === "transformer")!.address;
      assert.equal(l.labels.filter((x) => x.text === `${t} transformer`).length, 1, `${t} transformer once`);
    }
  });
}

test("desktop: island atoms are chips on the shelf, above every column header; the stacks balance", () => {
  const l = buildDfd(tax, fam, { mode: "desktop" });
  const linked = new Set(l.edges.flatMap((e) => [e.from, e.to]));
  const top = Math.min(...l.headers.map((h) => h.y));
  assert.ok(l.shelf, "a shelf");
  for (const b of l.boxes) {
    assert.equal(b.chip, b.atom && !linked.has(b.name), `${b.name}: a chip exactly when it has no edges`);
    if (!b.chip) continue;
    // on the shelf, which ends above the column headers: no generation claims a chip
    const s = l.shelf!;
    assert.ok(b.x >= s.x && b.x + b.w <= s.x + s.w && b.y >= s.y && b.y + b.h <= s.y + s.h, `${b.name}: inside the shelf`);
    assert.ok(b.y + b.h < top, `${b.name}: above the column headers`);
  }
  // every grid box stands under the header of its own generation (the headers never lie)
  for (const b of l.boxes) if (!b.chip) {
    const h = l.headers.find((x) => x.stack === b.stack && x.x === b.x);
    assert.ok(h && h.depth === b.depth, `${b.name} (gen ${b.depth}) under "${h?.text}"`);
  }
  // the grid keeps only boxes that carry lines, so the tall boxes fit the 848-px envelope
  assert.ok(l.boxes.filter((b) => !b.chip).every((b) => b.h === DFD_BOX_TALL), "tall boxes");
  assert.ok(l.height <= 848 && l.width <= 1424, `sheet ${l.width}×${l.height}`);
  assert.ok(l.boxes.filter((b) => b.lines.length > 1).length <= 8, "at most 8 two-line names");
  const bottom = (s: number) => Math.max(...l.lanes.filter((x) => x.stack === s).map((x) => x.y + x.h));
  assert.ok(Math.abs(bottom(0) - bottom(1)) <= 2 * (DFD_BOX_TALL + 16), `stacks end at ${bottom(0)} / ${bottom(1)}`);
  // the left margin holds one track (the lane's left gutter), 24 px in from the sheet's edge:
  // only a line leaving its parent's LEFT side may ride it; nothing rides the right margin
  const by = new Map(l.boxes.map((b) => [b.name, b]));
  const x0 = Math.min(...l.boxes.filter((b) => !b.chip).map((b) => b.x));
  for (const e of l.edges) for (const p of e.points) {
    assert.ok(p.x >= 3 * DFD_G && p.x <= l.width - DFD_G, `${e.from}->${e.to} runs within a track of the sheet's edge`);
    if (p.x < x0) assert.equal(e.points[0].x, by.get(e.from)!.x, `${e.from}->${e.to} rides the margin without leaving its parent's left side`);
  }
  // a connector pair never joins two boxes of one lane: that line takes the left gutter instead
  for (const o of l.offSheet) assert.notEqual(by.get(o.from)!.lane, by.get(o.to)!.lane, `${o.from}->${o.to}: a pair inside one lane`);
});

test("desktop: real wires stay inside one stack; lines between the stacks are connector pairs", () => {
  const l = buildDfd(tax, fam, { mode: "desktop" });
  const by = new Map(l.boxes.map((b) => [b.name, b]));
  const pairs = new Set(l.offSheet.map((o) => `${o.from}->${o.to}`));
  for (const e of l.edges) {
    if (by.get(e.from)!.stack === by.get(e.to)!.stack) continue;
    assert.ok(pairs.has(`${e.from}->${e.to}`), `${e.from}->${e.to} crosses the corridor as a wire`);
    // the in-end: a stub tag on the child, or a hub whose lines stay in the child's stack
    if (e.hub) for (const p of e.points) assert.ok(p.x > l.width / 2 === by.get(e.to)!.x > l.width / 2, `${e.from}->${e.to}: hub line leaves its stack`);
  }
  // one out-tag per parent, naming all its far ends
  const outs = new Map<string, Set<object>>();
  for (const o of l.offSheet) if (o.why === "panel") { if (!outs.has(o.from)) outs.set(o.from, new Set()); outs.get(o.from)!.add(o.out); }
  for (const [p, s] of outs) assert.equal(s.size, 1, `${p}: one bundle tag`);
});

test("desktop: no parent's lines box boxes in (the frame rule)", () => {
  // the real zoo
  assert.deepEqual(framedBoxes(buildDfd(tax, fam, { mode: "desktop" })), [], "the zoo");
  // the detector: one source's U round a box, closed by another line over its open side
  const box = (name: string, x: number, y: number): DfdBox => ({ name, family: "f", depth: 1, atom: false, chip: false, stack: 0, lane: 0, col: 1, row: 0, x, y, w: 80, h: 48, lines: [name], address: "1.1" });
  const inside = box("inside", 140, 140);
  const u: DfdEdge = { from: "p", to: "a", cross: false, side: "left", offSheet: false, points: [{ x: 100, y: 100 }, { x: 100, y: 240 }, { x: 260, y: 240 }, { x: 260, y: 100 }, { x: 280, y: 100 }] };
  const lid: DfdEdge = { from: "q", to: "b", cross: false, side: "left", offSheet: false, points: [{ x: 96, y: 96 }, { x: 240, y: 96 }] };
  assert.deepEqual(framedBoxes({ boxes: [inside], edges: [u, lid] }).map((f) => [f.src, f.boxes]), [["p", ["inside"]]], "a closed frame is found");
  assert.deepEqual(framedBoxes({ boxes: [inside], edges: [u] }), [], "an open U is not a frame");
  // a comb (short taps) never frames
  const comb: DfdEdge[] = [100, 164, 228].map((y, i) => ({ from: "p", to: `c${i}`, cross: false, side: "left" as const, offSheet: false, points: [{ x: 60, y: 164 }, { x: 80, y: 164 }, { x: 80, y }, { x: 104, y }] }));
  assert.deepEqual(framedBoxes({ boxes: [inside], edges: [...comb, lid] }), [], "a comb is no frame");
});

test("mobile: a file tree indented by generation, a ruler for it, a compact sheet", () => {
  const l = buildDfd(tax, fam, { mode: "mobile" });
  const x0 = Math.min(...l.boxes.map((b) => b.x)), right = l.boxes[0].x + l.boxes[0].w;
  for (const b of l.boxes) {
    assert.equal(b.x, x0 + Math.min(b.depth, 4) * DFD_INDENT, `${b.name}: indent = generation`);
    assert.equal(b.x + b.w, right, `${b.name}: right edges aligned`);
  }
  assert.deepEqual(l.headers.map((h) => [h.text, h.x]), [0, 1, 2, 3].map((d) => [String(d), x0 + d * DFD_INDENT]));
  assert.ok(l.height <= 44 * 48 + 6 * 48 + 64, `phone sheet ${l.height} px`);
  for (const lab of l.labels) if (lab.turn) assert.ok(lab.w === 12 && lab.h > lab.w, `${lab.text}: a turned label is a 12-px gap along its line`);
  // a connector's tag hangs in the gap above its box: that gap must hold tag + stub
  for (const o of l.offSheet) for (const n of [o.from, o.to]) {
    const b = l.boxes.find((x) => x.name === n)!;
    const above = l.boxes.filter((x) => x.y < b.y && x.x < b.x + b.w && b.x < x.x + x.w).map((x) => x.y + x.h);
    if (above.length) assert.ok(b.y - Math.max(...above) >= 32, `${n}: room for its connector tag`);
  }
});

for (const mode of ["desktop", "mobile"] as DfdMode[]) {
  test(`${mode}: no line runs along a swim-lane rule and no level label sits on one`, () => {
    const l = buildDfd(tax, fam, { mode });
    for (const e of l.edges) for (let k = 1; k < e.points.length; k++) {
      const a = e.points[k - 1], b = e.points[k];
      if (a.y !== b.y) continue;
      for (const ln of l.lanes) {
        const ov = Math.min(Math.max(a.x, b.x), ln.x + ln.w) - Math.max(Math.min(a.x, b.x), ln.x);
        assert.ok(!(a.y === ln.y && ov > 0), `${e.from}->${e.to} runs along the ${ln.family} rule`);
      }
    }
    for (const lab of l.labels) if (!lab.turn) for (const ln of l.lanes) {
      const hit = lab.y <= ln.y + 1 && lab.y + lab.h >= ln.y && lab.x < ln.x + ln.w && lab.x + lab.w > ln.x;
      assert.ok(!hit, `label "${lab.text}" sits on the ${ln.family} rule`);
    }
  });
}

// ——— review 1: the addresses are read off the sheet, so they count down the page

const byAddr = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

/** Pairs (upper, lower) inside one reading group whose addresses run backwards. */
function inversions(l: DfdLayout): string[] {
  const groups = new Map<string, DfdLayout["boxes"]>();
  for (const b of l.boxes) {
    // desktop: a lane's chip shelf, and each of its grid columns; phone: a lane's file tree
    const k = l.mode === "desktop" ? `${b.lane}:${b.chip ? "chips" : b.col}` : `${b.lane}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(b);
  }
  const out: string[] = [];
  for (const bs of groups.values()) {
    bs.sort((a, b) => a.y - b.y || a.x - b.x);
    for (let i = 1; i < bs.length; i++) if (byAddr(bs[i - 1].address, bs[i].address) >= 0) out.push(`${bs[i - 1].address} ${bs[i - 1].name} above ${bs[i].address} ${bs[i].name}`);
  }
  // desktop: the shelf (at the top) reads first, so every chip's number is below every grid atom's
  if (l.mode === "desktop") {
    const chips = l.boxes.filter((b) => b.chip), atoms = l.boxes.filter((b) => b.atom && !b.chip);
    for (const c of chips) for (const a of atoms) if (byAddr(c.address, a.address) >= 0) out.push(`atoms: chip ${c.name} after ${a.name}`);
  }
  return out;
}

for (const mode of ["desktop", "mobile"] as DfdMode[]) {
  test(`${mode}: inside a lane the addresses count down the page (real graph and perturbations)`, () => {
    const l = buildDfd(tax, fam, { mode });
    assert.deepEqual(inversions(l), [], `${mode}: rows out of address order`);
    // every address is unique and is its primary parent's address plus one step
    assert.equal(new Set(l.boxes.map((b) => b.address)).size, l.boxes.length, "unique addresses");
    for (const b of l.boxes) if (!b.atom) assert.match(b.address, /^\d+(\.\d+)+$/, `${b.name}: a lineage address`);
    for (let seed = 1; seed <= 3; seed++) {
      const rnd = mulberry32(seed * 104729);
      const parents = new Set(tax.models.flatMap((m) => m.builds_on));
      const leaves = tax.models.filter((m) => !parents.has(m.name)).map((m) => m.name);
      const drop = new Set(shuffle([...leaves], rnd).slice(0, 1 + (seed % 3)));
      const t: TaxonomyResponse = { ...tax, models: tax.models.filter((m) => !drop.has(m.name)) };
      assert.deepEqual(inversions(buildDfd(t, fam, { mode })), [], `${mode} seed ${seed}`);
    }
  });
}
