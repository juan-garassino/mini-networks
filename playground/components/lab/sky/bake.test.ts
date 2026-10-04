// The Night Map's baked sky: deterministic, and every model star sits inside
// its own family's nebula (the nebula IS the family's membership mark).
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import type { TaxonomyResponse } from "../../../lib/types.ts";
import { buildWorld, familyMapFromBlueprint } from "../../../lib/world/index.ts";
import { bakeSky, ghostBake, skyPx, type BakeEdge, type BakeStar } from "./bake.ts";
import { STAR_SPRITES, emblem, ringOffsets } from "./sprites.ts";

const tax: TaxonomyResponse = JSON.parse(readFileSync(new URL("../../../lib/world/__fixtures__/taxonomy.json", import.meta.url), "utf8"));
const world = buildWorld(tax, familyMapFromBlueprint(tax), { preset: "pixel" });
const by = new Map(world.nodes.map((n) => [n.name, n]));
const stars: BakeStar[] = world.nodes.map((n) => ({ name: n.name, family: n.family, x: n.center.x, y: n.center.y, atom: n.atom }));
const edges: BakeEdge[] = world.roads.filter((r) => r.kind === "primary").map((r) => ({ from: by.get(r.from)!.center, to: by.get(r.to)!.center, family: by.get(r.to)!.family }));
const box = { x: -400, y: -300, w: world.camera.world.w + 800, h: world.camera.world.h + 600 };

test("the bake is deterministic", () => {
  const a = bakeSky({ stars, edges, box }), b = bakeSky({ stars, edges, box });
  assert.equal(a.w, b.w);
  assert.equal(a.h, b.h);
  assert.deepEqual(a.rgba, b.rgba);
  assert.deepEqual(a.field, b.field);
});

test("every model star lies inside its own family's nebula", () => {
  const b = bakeSky({ stars, edges, box });
  for (const s of stars) {
    const { bx, by: y } = skyPx(b, s.x, s.y);
    // the star's own pixel and its 3×3 neighbourhood mostly belong to the family
    let own = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (b.families[b.owner[(y + dy) * b.w + bx + dx]] === s.family) own++;
    assert.ok(own >= 6, `${s.name}: only ${own}/9 pixels in the ${s.family} nebula`);
  }
});

test("six families, six nebulae, and the ghost keeps only the focused one", () => {
  const b = bakeSky({ stars, edges, box });
  assert.equal(b.families.length, 6);
  for (let k = 0; k < 6; k++) assert.ok(b.owner.some((o) => o === k));
  const g = ghostBake(b, "sequence");
  const k = b.families.indexOf("sequence");
  for (let i = 0; i < b.owner.length; i += 97) {
    const same = g[i * 4] === b.rgba[i * 4] && g[i * 4 + 1] === b.rgba[i * 4 + 1] && g[i * 4 + 2] === b.rgba[i * 4 + 2];
    if (b.owner[i] === k || b.owner[i] < 0) assert.ok(same);
  }
});

test("field stars keep clear of every model star", () => {
  const b = bakeSky({ stars, edges, box });
  for (const s of stars) {
    const { bx, by: y } = skyPx(b, s.x, s.y);
    for (const f of b.field) assert.ok(Math.max(Math.abs(f.bx - bx), Math.abs(f.by - y)) > 6, `field star at ${f.bx},${f.by} crowds ${s.name}`);
  }
});

test("sprites are rectangular and use only their own ink", () => {
  const all = [...Object.values(STAR_SPRITES).flatMap((s) => [s.atom, s.derived]), ...["perception", "sequence", "generative", "representation", "structure", "decision"].map((f) => emblem(f)!)];
  for (const s of all) {
    assert.equal(s.rows.length, s.h);
    for (const r of s.rows) {
      assert.equal(r.length, s.w);
      for (const ch of r) assert.ok(ch === "." || ch in s.ink, `letter ${ch} has no ink`);
    }
  }
  for (const f of ["perception", "sequence", "generative", "representation", "structure", "decision"]) assert.equal(emblem(f)!.w, 16);
  assert.ok(ringOffsets(9, "broken").length < ringOffsets(9, "dotted").length * 2);
});
