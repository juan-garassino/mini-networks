// Invariants of the geographic world contract (spec § Tests → World).
// Run: npm test  (node --test --experimental-strip-types)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { TaxonomyResponse } from "../types.ts";
import type { Box, World } from "./types.ts";
import { T } from "./types.ts";
import { buildWorld, familyMapFromBlueprint, ferryRoute, pathToAtom } from "./index.ts";
import { buildGraph } from "./graph.ts";
import { mulberry32, shuffle } from "./rng.ts";

const tax: TaxonomyResponse = JSON.parse(
  readFileSync(new URL("./__fixtures__/taxonomy.json", import.meta.url), "utf8"),
);
const fam = familyMapFromBlueprint();
const world = buildWorld(tax, fam);
const graph = buildGraph(tax, fam);
const S = world.tile;

const tileXY = (w: World, t: number) => ({ x: t % w.cols, y: Math.floor(t / w.cols) });
const footTiles = (b: Box, cols: number) => {
  const out: number[] = [];
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) out.push(y * cols + x);
  return out;
};
const pxBox = (b: Box): Box => ({ x: b.x * S, y: b.y * S, w: b.w * S, h: b.h * S });
const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const regionId = (w: World, family: string) => w.regions.find((r) => r.family === family)!.id;
const adj4 = (t: number, b: Box, cols: number) => {
  const { x, y } = { x: t % cols, y: Math.floor(t / cols) };
  const inside = (xx: number, yy: number) => xx >= b.x && xx < b.x + b.w && yy >= b.y && yy < b.y + b.h;
  return !inside(x, y) && (inside(x + 1, y) || inside(x - 1, y) || inside(x, y + 1) || inside(x, y - 1));
};

test("the live snapshot builds without warnings", () => {
  assert.deepEqual(world.warnings, []);
  assert.equal(tax.models.length, 44);
});

test("(1) every model is placed exactly once, in its family", () => {
  const names = world.nodes.map((n) => n.name);
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual([...names].sort(), tax.models.map((m) => m.name).sort());
  for (const n of world.nodes) {
    assert.equal(n.family, fam[n.name], n.name);
    assert.equal(n.atom, tax.models.find((m) => m.name === n.name)!.level === "elementary", n.name);
    assert.equal(n.foot.w, n.atom ? 4 : 2);
  }
});

test("(2) an unknown future model falls back to its parent's family and gets a road", () => {
  const t2: TaxonomyResponse = {
    ...tax,
    models: [...tax.models, { name: "mystery_net", level: "derived", introduces: [], builds_on: ["gan"], note: "", description: "" }],
  };
  const w = buildWorld(t2, fam);
  const node = w.nodes.find((n) => n.name === "mystery_net");
  assert.ok(node, "placed");
  assert.equal(node.family, "generative");
  const road = w.roads.find((r) => r.id === "gan->mystery_net");
  assert.ok(road && road.tiles.length > 0, "routed");
  assert.ok(!w.warnings.some((m) => m.includes("mystery_net")), w.warnings.join("; "));
});

test("(3) footprints are disjoint, inside their own region, never on river or sea", () => {
  const seen = new Map<number, string>();
  for (const n of world.nodes) {
    const rid = regionId(world, n.family);
    for (const t of footTiles(n.foot, world.cols)) {
      assert.ok(!seen.has(t), `${n.name} overlaps ${seen.get(t)}`);
      seen.set(t, n.name);
      assert.equal(world.terrain[t], T.FOOT, n.name);
      assert.equal(world.regionOf[t], rid, `${n.name} outside its region`);
      // a river tile is one with a 4-neighbour in a higher-id region
      const { x, y } = tileXY(world, t);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const o = world.regionOf[(y + dy) * world.cols + x + dx];
        assert.ok(!(o > rid), `${n.name} sits on a river tile`);
      }
    }
    assert.equal(n.center.x, (n.foot.x + n.foot.w / 2) * S);
    assert.equal(n.center.y, (n.foot.y + n.foot.h / 2) * S);
  }
});

test("(4) regions: size within ±15%, 4-connected, required borders, islet moat", () => {
  const { cols, rows, regionOf } = world;
  for (const r of world.regions) {
    assert.ok(Math.abs(r.tiles - r.targetTiles) <= 0.15 * r.targetTiles, `${r.family} ${r.tiles}/${r.targetTiles}`);
    const tiles: number[] = [];
    for (let i = 0; i < regionOf.length; i++) if (regionOf[i] === r.id) tiles.push(i);
    assert.equal(tiles.length, r.tiles);
    const seen = new Set([tiles[0]]);
    const q = [tiles[0]];
    while (q.length) {
      const i = q.pop()!;
      const x = i % cols;
      for (const j of [x + 1 < cols ? i + 1 : -1, x > 0 ? i - 1 : -1, i + cols, i - cols]) {
        if (j >= 0 && j < regionOf.length && regionOf[j] === r.id && !seen.has(j)) { seen.add(j); q.push(j); }
      }
    }
    assert.equal(seen.size, r.tiles, `${r.family} is not 4-connected`);
  }
  const touches = (a: number, b: number) => {
    for (let i = 0; i < regionOf.length; i++) {
      if (regionOf[i] !== a) continue;
      const x = i % cols;
      if ((x + 1 < cols && regionOf[i + 1] === b) || (x > 0 && regionOf[i - 1] === b) ||
          regionOf[i + cols] === b || regionOf[i - cols] === b) return true;
    }
    return false;
  };
  const required = [
    ["perception", "sequence"], ["sequence", "representation"], ["sequence", "decision"],
    ["sequence", "generative"], ["perception", "representation"], ["perception", "generative"],
  ];
  for (const [a, b] of required) assert.ok(touches(regionId(world, a), regionId(world, b)), `${a}|${b} share no border`);
  const islets = world.regions.filter((r) => r.islet);
  assert.deepEqual(islets.map((r) => r.family), ["structure"]);
  for (const r of islets) {
    for (let i = 0; i < regionOf.length; i++) {
      if (regionOf[i] !== r.id) continue;
      const x = i % cols;
      const y = Math.floor(i / cols);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
          const o = regionOf[yy * cols + xx];
          assert.ok(o === -1 || o === r.id, "islet touches another region");
        }
      }
    }
  }
});

test("(5) one continuous, walkable, anchored road per builds_on edge; rivers only on bridges", () => {
  const edges = tax.models.flatMap((m) => m.builds_on.map((p) => `${p}->${m.name}`)).sort();
  assert.deepEqual(world.roads.map((r) => r.id).sort(), edges);
  const byName = new Map(world.nodes.map((n) => [n.name, n]));
  const blocked = new Set<number>([T.SEA, T.RIVER, T.BRIDGE, T.FOOT, T.SETPIECE]);
  for (const r of world.roads) {
    assert.ok(r.tiles.length > 0, `${r.id} unrouted`);
    const from = byName.get(r.from)!;
    const to = byName.get(r.to)!;
    assert.ok(adj4(r.tiles[0], from.foot, world.cols), `${r.id} not anchored at ${r.from}`);
    assert.ok(adj4(r.tiles[r.tiles.length - 1], to.foot, world.cols), `${r.id} not anchored at ${r.to}`);
    const bridgeTiles = new Set(world.bridges.filter((b) => b.roadId === r.id).flatMap((b) => b.tiles));
    for (let k = 0; k < r.tiles.length; k++) {
      const t = r.tiles[k];
      const v = world.terrain[t];
      assert.ok(v === T.ROAD || v === T.BRIDGE, `${r.id} on terrain ${v}`);
      if (v === T.BRIDGE) assert.ok(bridgeTiles.has(t), `${r.id} crosses water outside its bridges`);
      if (k === 0) continue;
      const a = tileXY(world, r.tiles[k - 1]);
      const b = tileXY(world, t);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      assert.ok(Math.max(Math.abs(dx), Math.abs(dy)) === 1, `${r.id} jumps`);
      if (dx && dy) {
        assert.ok(!blocked.has(world.terrain[a.y * world.cols + b.x]) && !blocked.has(world.terrain[b.y * world.cols + a.x]),
          `${r.id} cuts a corner`);
      }
    }
    const cross = from.family !== to.family;
    assert.equal(r.kind === "bridge", cross, r.id);
    if (cross) assert.ok(bridgeTiles.size > 0, `${r.id} crosses families without a bridge`);
    assert.equal(r.primary, to.primary === r.from);
  }
  assert.equal(world.roads.filter((r) => r.kind === "bridge").length, 8);
  for (const b of world.bridges) assert.notEqual(b.regions[0], b.regions[1]);
});

test("(6) labels: one per node, font ≥13, in the world, colliding with nothing", () => {
  const W = world.cols * S;
  const H = world.rows * S;
  assert.deepEqual(world.labels.map((l) => l.node).sort(), world.nodes.map((n) => n.name).sort());
  const solids: Box[] = [
    ...world.nodes.map((n) => pxBox(n.foot)),
    ...world.regions.flatMap((r) => (r.setPiece ? [pxBox(r.setPiece)] : [])),
    ...world.bridges.flatMap((b) => b.tiles.map((t) => pxBox({ ...tileXY(world, t), w: 1, h: 1 }))),
  ];
  for (const [i, l] of world.labels.entries()) {
    assert.ok(l.font >= 13);
    assert.ok(l.box.x >= 0 && l.box.y >= 0 && l.box.x + l.box.w <= W && l.box.y + l.box.h <= H, `${l.node} outside`);
    for (const s of solids) assert.ok(!overlap(l.box, s), `${l.node} label covers a solid`);
    for (const m of world.labels.slice(i + 1)) assert.ok(!overlap(l.box, m.box), `${l.node} × ${m.node}`);
    assert.ok(l.box.w >= 0.6 * l.font * l.text.length);
  }
});

test("(7) decor keeps one clear tile from everything", () => {
  const { cols, rows, terrain } = world;
  const busy = new Uint8Array(cols * rows);
  for (let i = 0; i < busy.length; i++) {
    const t = terrain[i];
    if (t === T.FOOT || t === T.SETPIECE || t === T.ROAD || t === T.BRIDGE || t === T.RIVER) busy[i] = 1;
  }
  for (const l of world.labels) {
    for (let y = Math.floor(l.box.y / S); y <= Math.floor((l.box.y + l.box.h - 1e-6) / S); y++) {
      for (let x = Math.floor(l.box.x / S); x <= Math.floor((l.box.x + l.box.w - 1e-6) / S); x++) busy[y * cols + x] = 1;
    }
  }
  const decor = new Set(world.decor.map((d) => d.tile));
  assert.ok(world.decor.length > 0);
  for (const d of world.decor) {
    assert.ok(terrain[d.tile] === T.LAND || terrain[d.tile] === T.COAST);
    assert.equal(world.regions[world.regionOf[d.tile]].family, d.region);
    const { x, y } = tileXY(world, d.tile);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
        const j = yy * cols + xx;
        assert.ok(!busy[j], `decor at ${x},${y} too close to something`);
        if (j !== d.tile) assert.ok(!decor.has(j), "decor touches decor");
      }
    }
  }
  assert.ok(world.seaSlots.length > 0);
});

test("(8) deterministic across runs, cloned input and shuffled models", () => {
  assert.deepEqual(buildWorld(tax, fam), world);
  assert.deepEqual(buildWorld(structuredClone(tax), { ...fam }), world);
  const shuffled = { ...tax, models: shuffle([...tax.models], mulberry32(7)) };
  assert.deepEqual(buildWorld(shuffled, fam), world);
});

test("(9) pathToAtom walks continuously back to the root atom", () => {
  const byName = new Map(world.nodes.map((n) => [n.name, n]));
  const cases: [string, string[]][] = [
    ["tabular_diffusion", ["tabular_diffusion", "diffusion"]],
    ["kimi", ["kimi", "moe", "transformer"]],
    ["dpo", ["dpo", "rlhf", "reinforce"]],
    ["audio_melspectrogram", ["audio_melspectrogram", "audio_spectrogram", "audio_classifier", "classifier"]],
    ["classifier", ["classifier"]],
  ];
  for (const [start, chain] of cases) {
    const p = pathToAtom(world, start);
    assert.deepEqual(p.nodes, chain);
    assert.deepEqual(p.points[0], byName.get(start)!.center);
    assert.deepEqual(p.points[p.points.length - 1], byName.get(chain[chain.length - 1])!.center);
    const centers = new Set(chain.map((n) => `${byName.get(n)!.center.x},${byName.get(n)!.center.y}`));
    for (let i = 1; i < p.points.length; i++) {
      const a = p.points[i - 1];
      const b = p.points[i];
      const dx = Math.abs(b.x - a.x);
      const dy = Math.abs(b.y - a.y);
      const octilinear = dx < 1e-9 || dy < 1e-9 || Math.abs(dx - dy) < 1e-9;
      const toCenter = centers.has(`${a.x},${a.y}`) || centers.has(`${b.x},${b.y}`);
      assert.ok(octilinear || (toCenter && Math.hypot(dx, dy) <= 4 * S), `${start}: gap at point ${i}`);
    }
  }
});

test("(10) every composition's ferry route visits all its members", () => {
  const byName = new Map(world.nodes.map((n) => [n.name, n]));
  for (const c of tax.compositions) {
    const f = ferryRoute(world, c.composes);
    assert.equal(f.points.length, f.sea.length);
    assert.deepEqual(f.visits, c.composes.filter((m, i) => c.composes[i - 1] !== m));
    for (const m of c.composes) {
      const b = pxBox(byName.get(m)!.foot);
      assert.ok(f.points.some((p) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h), `${c.name} misses ${m}`);
    }
  }
});

test("(11) median build time", () => {
  const ts: number[] = [];
  for (let i = 0; i < 9; i++) {
    const t0 = performance.now();
    buildWorld(tax, fam);
    ts.push(performance.now() - t0);
  }
  ts.sort((a, b) => a - b);
  const median = ts[4];
  console.log(`# median buildWorld ${median.toFixed(1)}ms (target 30ms)`);
  assert.ok(median < 100, `median ${median.toFixed(1)}ms`);
});

test("graph: 16 atoms, 41 edges, 8 cross-family, structure islet", () => {
  assert.equal([...graph.atom.values()].filter(Boolean).length, 16);
  assert.equal(graph.edges.length, 41);
  assert.equal(graph.edges.filter((e) => e.cross).length, 8);
  assert.equal(Math.max(...graph.depth.values()), 3);
  assert.deepEqual([...graph.islet], ["structure"]);
});

test("degenerate and future inputs never throw; problems land in warnings", () => {
  const extra = (name: string, builds_on: string[], level: "elementary" | "derived" = "derived") =>
    ({ name, level, introduces: [], builds_on, note: "", description: "" });
  assert.equal(buildWorld({ ...tax, models: [], compositions: [] }, fam).nodes.length, 0);
  assert.equal(buildWorld({ ...tax, models: [tax.models[0]] }, fam).nodes.length, 1);
  const future = buildWorld({ ...tax, models: [...tax.models, extra("wav2vec", ["audio_classifier"])] }, { ...fam, wav2vec: "audio" });
  assert.ok(future.regions.some((r) => r.family === "audio"));
  assert.ok(future.warnings.some((w) => w.includes("audio")));
  const bad = buildWorld({ ...tax, models: [...tax.models, extra("yyy", ["nope"]), extra("c1", ["c2"]), extra("c2", ["c1"])] }, fam);
  assert.ok(bad.warnings.some((w) => w.includes("unknown model")));
  assert.ok(bad.warnings.some((w) => w.includes("cycle")));
  const grown = [...tax.models];
  for (let i = 0; i < 12; i++) grown.push(extra(`gen_${i}`, [i % 2 ? "gan" : "vae"]));
  const big = buildWorld({ ...tax, models: grown }, fam);
  assert.deepEqual(big.warnings, []);
  assert.equal(big.nodes.length, 56);
});
