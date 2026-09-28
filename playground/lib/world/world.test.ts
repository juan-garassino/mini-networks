// Invariants of the geographic world contract (spec § Tests → World).
// Run: npm test  (node --test --experimental-strip-types)
import { cpus, loadavg } from "node:os";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { TaxonomyResponse } from "../types.ts";
import type { Box, World } from "./types.ts";
import { T } from "./types.ts";
import { buildWorld, familyMapFromBlueprint, ferryRoute, lineage, parkingSpot, pathToAtom, placeScreenLabels } from "./index.ts";
import { buildGraph } from "./graph.ts";
import { mulberry32, shuffle } from "./rng.ts";
import {
  ATOM_GAP, CITY_BASE, CITY_MAX, CITY_PER_CHILD, FOOT_GAP, HIDDEN_DEFAULT, LABEL_FOOT_CLEAR, LANE_GAP, LANE_OVERLAP_MAX,
  MIN_CENTRE_DIST, MOUNTAIN_ROAD_CLEAR,
} from "./constants.ts";
import { boatsPerFamily } from "./flavour.ts";

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

/** tiles a px box touches */
const boxTiles = (w: World, b: Box) => {
  const out: number[] = [];
  for (let y = Math.floor(b.y / S); y <= Math.floor((b.y + b.h - 1e-6) / S); y++) {
    for (let x = Math.floor(b.x / S); x <= Math.floor((b.x + b.w - 1e-6) / S); x++) out.push(y * w.cols + x);
  }
  return out;
};
const boxDist = (a: Box, b: Box) => Math.hypot(
  Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w)), Math.max(0, b.y - (a.y + a.h), a.y - (b.y + b.h)));
const labelMask = (w: World) => {
  const m = new Uint8Array(w.cols * w.rows);
  for (const l of w.labels) for (const t of boxTiles(w, l.box)) m[t] = 1;
  return m;
};

test("v2 spacing: node gaps, centre distance, label clearance", () => {
  for (const [i, a] of world.nodes.entries()) {
    for (const b of world.nodes.slice(i + 1)) {
      const gx = Math.max(b.foot.x - (a.foot.x + a.foot.w), a.foot.x - (b.foot.x + b.foot.w));
      const gy = Math.max(b.foot.y - (a.foot.y + a.foot.h), a.foot.y - (b.foot.y + b.foot.h));
      const gap = Math.max(gx, gy);
      assert.ok(gap >= (a.atom && b.atom ? ATOM_GAP : FOOT_GAP), `${a.name}/${b.name} gap ${gap}`);
      const d = Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y);
      assert.ok(d >= MIN_CENTRE_DIST * S, `${a.name}/${b.name} centres ${(d / S).toFixed(1)} tiles`);
    }
  }
  for (const l of world.labels) {
    for (const t of boxTiles(world, l.box)) {
      assert.ok(world.terrain[t] !== T.ROAD && world.terrain[t] !== T.BRIDGE, `label ${l.node} sits on a road`);
    }
    for (const n of world.nodes) {
      if (n.name === l.node) continue;
      assert.ok(boxDist(l.box, pxBox(n.foot)) >= LABEL_FOOT_CLEAR - 1e-9, `label ${l.node} hugs ${n.name}`);
    }
  }
});

test("v2 labels carry screen-label metadata", () => {
  const prios = world.labels.map((l) => l.priority);
  assert.equal(new Set(prios).size, prios.length);
  const byName = new Map(world.nodes.map((n) => [n.name, n]));
  const minAtom = Math.min(...world.labels.filter((l) => byName.get(l.node)!.atom).map((l) => l.priority));
  const maxDerived = Math.max(...world.labels.filter((l) => !byName.get(l.node)!.atom).map((l) => l.priority));
  assert.ok(minAtom > maxDerived, "atoms outrank derived");
  const top = [...world.labels].sort((a, b) => b.priority - a.priority)[0];
  assert.equal(top.node, "transformer");
  for (const l of world.labels) {
    const f = pxBox(byName.get(l.node)!.foot);
    const onEdge = (Math.abs(l.anchorPt.x - f.x) < 1e-9 || Math.abs(l.anchorPt.x - f.x - f.w) < 1e-9 ||
      Math.abs(l.anchorPt.y - f.y) < 1e-9 || Math.abs(l.anchorPt.y - f.y - f.h) < 1e-9) &&
      l.anchorPt.x >= f.x && l.anchorPt.x <= f.x + f.w && l.anchorPt.y >= f.y && l.anchorPt.y <= f.y + f.h;
    assert.ok(onEdge, `${l.node} anchorPt not on its footprint edge`);
    assert.equal(l.preferred.length, 8);
    assert.equal(new Set(l.preferred).size, 8);
    assert.equal(l.preferred[0], l.anchor);
  }
});

test("v2 road lanes: parallel, inside the road tiles, never coinciding beyond a stub", () => {
  for (const r of world.roads) {
    assert.ok(Math.abs(r.lane) * LANE_GAP <= S / 2 - 2, `${r.id} lane ${r.lane} leaves its tiles`);
    assert.equal(r.lanePoints.length, r.points.length, r.id);
    // each lane segment is parallel to its centreline segment at distance |lane|·LANE_GAP
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1], b = r.points[i], p = r.lanePoints[i - 1], q = r.lanePoints[i];
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      if (L < 1e-9) continue;
      const cross = ((b.x - a.x) * (q.y - p.y) - (b.y - a.y) * (q.x - p.x)) / L;
      assert.ok(Math.abs(cross) < 0.1 * L + 0.1, `${r.id} lane segment ${i} not parallel`);
      const off = ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / L; // signed, + = right of travel
      assert.ok(Math.abs(Math.abs(off) - Math.abs(r.lane) * LANE_GAP) < 0.1, `${r.id} lane offset`);
    }
  }
  // collinear overlap between any two roads' lane polylines
  type Seg = [number, number, number, number];
  const segs = (pts: { x: number; y: number }[]): Seg[] => pts.slice(1).map((q, i) => [pts[i].x, pts[i].y, q.x, q.y]);
  const overlap = (s: Seg, t: Seg) => {
    const dx = s[2] - s[0], dy = s[3] - s[1];
    const L = Math.hypot(dx, dy);
    if (L < 1e-9) return 0;
    const ux = dx / L, uy = dy / L;
    const perp = (x: number, y: number) => Math.abs((x - s[0]) * uy - (y - s[1]) * ux);
    if (perp(t[0], t[1]) > 1 || perp(t[2], t[3]) > 1) return 0;
    const pr = (x: number, y: number) => (x - s[0]) * ux + (y - s[1]) * uy;
    const a = pr(t[0], t[1]), b = pr(t[2], t[3]);
    return Math.max(0, Math.min(L, Math.max(a, b)) - Math.max(0, Math.min(a, b)));
  };
  const all = world.roads.map((r) => ({ id: r.id, s: segs(r.lanePoints) }));
  let worst = 0;
  for (const [i, A] of all.entries()) {
    for (const B of all.slice(i + 1)) {
      let o = 0;
      for (const s of A.s) for (const t of B.s) o += overlap(s, t);
      worst = Math.max(worst, o);
      assert.ok(o <= LANE_OVERLAP_MAX, `${A.id} and ${B.id} coincide for ${o.toFixed(1)}px`);
    }
  }
  console.log(`# worst lane coincidence ${worst.toFixed(1)}px; lanes used ${[...new Set(world.roads.map((r) => r.lane))].sort()}`);
});

test("v2 chevrons point parent → child along the lane", () => {
  for (const r of world.roads) {
    assert.ok(r.chevrons.length >= 1, `${r.id} has no chevron`);
    let lastT = -1;
    for (const c of r.chevrons) {
      // find the lane segment the chevron lies on
      let best = Infinity, bestT = 0, bestAng = 0, acc = 0;
      for (let i = 1; i < r.lanePoints.length; i++) {
        const a = r.lanePoints[i - 1], b = r.lanePoints[i];
        const L = Math.hypot(b.x - a.x, b.y - a.y);
        if (L < 1e-9) continue;
        const u = Math.max(0, Math.min(1, ((c.x - a.x) * (b.x - a.x) + (c.y - a.y) * (b.y - a.y)) / (L * L)));
        const d = Math.hypot(a.x + u * (b.x - a.x) - c.x, a.y + u * (b.y - a.y) - c.y);
        if (d < best) { best = d; bestT = acc + u * L; bestAng = Math.atan2(b.y - a.y, b.x - a.x); }
        acc += L;
      }
      assert.ok(best < 0.05, `${r.id} chevron off its lane`);
      let dAng = Math.abs(bestAng - c.angle);
      if (dAng > Math.PI) dAng = 2 * Math.PI - dAng;
      assert.ok(dAng < 1e-3, `${r.id} chevron points the wrong way`);
      assert.ok(bestT > lastT, `${r.id} chevrons out of order`);
      lastT = bestT;
    }
  }
});

test("v2 lineage: every parent and child road, ancestors and descendants", () => {
  const k = lineage(world, "kimi");
  assert.deepEqual(k.parents.map((r) => r.from).sort(), ["mamba", "moe", "transformer"]);
  assert.equal(k.parents[0].primary, true);
  assert.equal(k.children.length, 0);
  assert.deepEqual(k.ancestors, ["mamba", "moe", "transformer"]);
  const t = lineage(world, "transformer");
  assert.equal(t.parents.length, 0);
  assert.equal(t.children.length, graph.children.get("transformer")!.length);
  assert.ok(t.descendants.includes("kimi") && t.descendants.includes("dpo"));
  assert.ok(t.descendants.indexOf("rlhf") < t.descendants.indexOf("dpo"), "nearest generation first");
  const d = lineage(world, "dino");
  assert.deepEqual(d.parents.map((r) => r.from).sort(), ["simclr", "vit"]);
  assert.deepEqual(new Set(d.ancestors), new Set(["simclr", "vit", "transformer", "classifier"]));
  assert.deepEqual(lineage(world, "nope"), { parents: [], children: [], ancestors: [], descendants: [] });
});

test("v2 parkingSpot: beside the spot on its road, never on a footprint or label", () => {
  const solids = [...world.nodes.map((n) => pxBox(n.foot)), ...world.labels.map((l) => l.box)];
  for (const n of world.nodes) {
    const p = parkingSpot(world, n.name);
    for (const b of solids) {
      assert.ok(!(p.x > b.x - 3 && p.x < b.x + b.w + 3 && p.y > b.y - 3 && p.y < b.y + b.h + 3), `${n.name} parks on a solid`);
    }
    assert.ok(boxDist({ x: p.x, y: p.y, w: 0, h: 0 }, pxBox(n.foot)) <= 80, `${n.name} parks too far`);
    const own = world.roads.filter((r) => r.to === n.name || r.from === n.name);
    if (!own.length) continue;
    const onRoad = own.some((r) => r.lanePoints.slice(1).some((q, i) => {
      const a = r.lanePoints[i];
      const L2 = (q.x - a.x) ** 2 + (q.y - a.y) ** 2;
      const u = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * (q.x - a.x) + (p.y - a.y) * (q.y - a.y)) / L2)) : 0;
      return Math.hypot(a.x + u * (q.x - a.x) - p.x, a.y + u * (q.y - a.y) - p.y) < 0.05;
    }));
    assert.ok(onRoad, `${n.name} does not park on its road`);
  }
  // the primary (incoming) road is preferred
  const p = parkingSpot(world, "kimi");
  const prim = world.roads.find((r) => r.to === "kimi" && r.primary)!;
  const end = prim.lanePoints[prim.lanePoints.length - 1];
  assert.ok(Math.hypot(p.x - end.x, p.y - end.y) < 80);
});

test("v2 flavour: harbours dock one boat per composition touching the family", () => {
  const boats = boatsPerFamily(graph, tax);
  const lmask = labelMask(world);
  for (const r of world.regions) {
    const hs = world.harbours.filter((h) => h.family === r.family);
    assert.ok(hs.length >= 1, `${r.family} has no harbour`);
    assert.equal(hs.reduce((a, h) => a + h.boats, 0), boats.get(r.family), `${r.family} boats`);
    for (const h of hs) {
      assert.equal(world.terrain[h.tile], T.COAST);
      assert.equal(world.regionOf[h.tile], r.id);
      assert.ok(!lmask[h.tile]);
      const dock = Math.floor(h.pt.y / S) * world.cols + Math.floor(h.pt.x / S);
      assert.equal(world.terrain[dock], T.SEA);
      const dx = Math.abs((dock % world.cols) - (h.tile % world.cols));
      const dy = Math.abs(Math.floor(dock / world.cols) - Math.floor(h.tile / world.cols));
      assert.equal(dx + dy, 1, "dock is 4-adjacent to the harbour");
    }
  }
  // perception is in the most compositions (live data)
  assert.ok((boats.get("perception") ?? 0) >= (boats.get("decision") ?? 0));
  assert.equal(new Set(world.harbours.map((h) => h.tile)).size, world.harbours.length);
});

test("v2 flavour: cities grow around atoms on free land, capitals for hubs", () => {
  const atoms = world.nodes.filter((n) => n.atom).map((n) => n.name).sort();
  assert.deepEqual(world.cities.map((c) => c.node), atoms);
  const lmask = labelMask(world);
  const usedTiles = new Set<number>();
  for (const c of world.cities) {
    assert.equal(c.children, graph.children.get(c.node)!.length);
    assert.equal(c.blocks.length, Math.min(CITY_MAX, CITY_BASE + CITY_PER_CHILD * c.children), `${c.node} blocks`);
    for (const b of c.blocks) {
      const tiles = boxTiles(world, b);
      assert.equal(tiles.length, 1, `${c.node} block spans tiles`);
      const t = tiles[0];
      assert.ok(!usedTiles.has(t), "blocks overlap");
      usedTiles.add(t);
      assert.ok(world.terrain[t] === T.LAND || world.terrain[t] === T.COAST, `${c.node} block on terrain ${world.terrain[t]}`);
      assert.ok(!lmask[t], `${c.node} block under a label`);
    }
  }
  const capitals = world.cities.filter((c) => c.capital).map((c) => c.node).sort();
  assert.deepEqual(capitals, ["classifier", "transformer"]);
  for (const d of world.decor) assert.ok(!usedTiles.has(d.tile), "decor on a city block");
});

test("v2 flavour: mountain ranges along quiet family borders", () => {
  assert.ok(world.mountains.length >= 1);
  const { cols, rows, terrain } = world;
  const lmask = labelMask(world);
  const decor = new Set(world.decor.map((d) => d.tile));
  for (const m of world.mountains) {
    let touchesBorder = false;
    for (let i = 0; i < m.length; i++) {
      const x = Math.floor(m[i].x / S), y = Math.floor(m[i].y / S), t = y * cols + x;
      assert.equal(terrain[t], T.LAND);
      assert.ok(!lmask[t] && !decor.has(t));
      for (let dy = -MOUNTAIN_ROAD_CLEAR; dy <= MOUNTAIN_ROAD_CLEAR; dy++) {
        for (let dx = -MOUNTAIN_ROAD_CLEAR; dx <= MOUNTAIN_ROAD_CLEAR; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
          const v = terrain[yy * cols + xx];
          assert.ok(v !== T.ROAD && v !== T.BRIDGE, "mountain beside a road");
        }
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const u = (y + dy) * cols + x + dx;
        if (terrain[u] === T.RIVER && world.regionOf[u] !== world.regionOf[t]) touchesBorder = true;
      }
      if (i) {
        const px = Math.floor(m[i - 1].x / S), py = Math.floor(m[i - 1].y / S);
        assert.equal(Math.max(Math.abs(px - x), Math.abs(py - y)), 1, "range is continuous");
      }
    }
    assert.ok(touchesBorder, "range is not on a border");
  }
});

test("v2 flavour: secret islands lie outside camera.world, inside camera.all", () => {
  const W = world.camera.world;
  const A = world.camera.all;
  const contains = (o: Box, i: Box) => i.x >= o.x && i.y >= o.y && i.x + i.w <= o.x + o.w && i.y + i.h <= o.y + o.h;
  for (const isl of [world.hiddenIsland, world.ruinsIsland]) {
    assert.ok(!overlap(isl.box, W), "island visible in the overview");
    assert.ok(contains(A, isl.box));
    assert.ok(contains(A, { ...isl.dragons, w: 0, h: 0 }));
    assert.equal(isl.slots.length, isl.names.length);
    for (const p of isl.slots) assert.ok(contains(isl.box, { ...p, w: 0, h: 0 }));
  }
  assert.ok(contains(A, W));
  assert.ok(!overlap(world.hiddenIsland.box, world.ruinsIsland.box));
  assert.deepEqual(world.hiddenIsland.names, HIDDEN_DEFAULT);
  assert.deepEqual(world.ruinsIsland.names, []);
  const w2 = buildWorld(tax, fam, { hidden: ["a", "b"], ruins: ["lenet", "hopfield", "rbm", "som"] });
  assert.deepEqual(w2.hiddenIsland.names, ["a", "b"]);
  assert.equal(w2.ruinsIsland.slots.length, 4);
  assert.ok(!overlap(w2.ruinsIsland.box, w2.camera.world));
  assert.deepEqual(w2.nodes, world.nodes, "island names never move the map");
});

test("v2 placeScreenLabels: in the viewport, collision-free, focus first, fast", () => {
  const vp = { w: 1280, h: 800 };
  const cam = world.camera.world;
  const out = placeScreenLabels(world, cam, vp, { edgeMargin: 24 });
  assert.ok(out.length >= 10, `only ${out.length} labels fit the overview`);
  const s = Math.min(vp.w / cam.w, vp.h / cam.h);
  const ox = (vp.w - cam.w * s) / 2 - cam.x * s;
  const oy = (vp.h - cam.h * s) / 2 - cam.y * s;
  const feet = world.nodes.map((n) => ({ x: n.foot.x * S * s + ox, y: n.foot.y * S * s + oy, w: n.foot.w * S * s, h: n.foot.h * S * s }));
  const prio = new Map(world.labels.map((l) => [l.node, l.priority]));
  for (const [i, l] of out.entries()) {
    assert.ok(l.x >= 24 && l.y >= 24 && l.x + l.w <= vp.w - 24 && l.y + l.h <= vp.h - 24, `${l.node} at the edge`);
    for (const f of feet) assert.ok(!overlap(l, f), `${l.node} covers a footprint`);
    for (const m of out.slice(i + 1)) assert.ok(!overlap(l, m), `${l.node} × ${m.node}`);
    if (i) assert.ok(prio.get(out[i - 1].node)! > prio.get(l.node)!, "priority order");
  }
  assert.equal(out[0].node, "transformer");
  // focus first, and a node-zoom camera shows the focus label
  const focusCam = world.camera.nodes["kimi"].box;
  const f = placeScreenLabels(world, focusCam, vp, { focus: "kimi" });
  assert.equal(f[0].node, "kimi");
  assert.deepEqual(placeScreenLabels(world, focusCam, vp, { focus: "kimi" }), f, "deterministic");
  const ts: number[] = [];
  for (let i = 0; i < 41; i++) {
    const t0 = performance.now();
    placeScreenLabels(world, cam, vp, { focus: "clip" });
    ts.push(performance.now() - t0);
  }
  ts.sort((a, b) => a - b);
  console.log(`# median placeScreenLabels ${ts[20].toFixed(2)}ms (target <4ms)`);
  assert.ok(ts[20] < 16, `placeScreenLabels ${ts[20].toFixed(2)}ms`);
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
  console.log(`# median buildWorld ${median.toFixed(1)}ms (v2 budget 150ms idle)`);
  // Wall-clock budgets only mean something on an idle machine: this owner box
  // often runs at load 100+ where the same build takes 5x longer. Assert the
  // idle budget only when the 1-min load is below the core count.
  const saturated = loadavg()[0] > cpus().length;
  if (saturated) console.log(`# (timing assert skipped: load ${loadavg()[0].toFixed(0)} on ${cpus().length} cores)`);
  else assert.ok(median < 150, `median ${median.toFixed(1)}ms`);
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

test("placeScreenLabels honours extra obstacles and a custom projection", () => {
  const world = buildWorld(tax, fam);
  const cam = world.camera.world;
  const vp = { w: 1440, h: 900 };
  const base = placeScreenLabels(world, cam, vp);
  assert.ok(base.length > 0);
  // a HUD box over the whole left half removes every label that sat there
  const hud = { x: 0, y: 0, w: 720, h: 900 };
  const withHud = placeScreenLabels(world, cam, vp, { obstacles: [hud] });
  assert.ok(withHud.every((l) => l.x >= 720 || l.x + l.w <= 0));
  // an identity-like projection equal to the default fit gives the same result
  const s = Math.min(vp.w / cam.w, vp.h / cam.h);
  const ox = (vp.w - cam.w * s) / 2 - cam.x * s, oy = (vp.h - cam.h * s) / 2 - cam.y * s;
  const same = placeScreenLabels(world, cam, vp, { project: (p) => ({ x: p.x * s + ox, y: p.y * s + oy }) });
  assert.deepEqual(same, base);
});
