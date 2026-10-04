import { test } from "node:test";
import assert from "node:assert/strict";
import { composePlate, plateRect, sample, type PlateInput } from "./plate-place.ts";

const base = (over: Partial<PlateInput> = {}): PlateInput => ({
  anchor: { x: 100, y: 100 }, castle: { x: -6, y: -6, w: 12, h: 12 }, castlePad: 10,
  plate: { w: 400, h: 240 }, scales: [2, 1.5], land: { x: 0, y: 0, w: 200, h: 200 },
  view: { x: 0, y: 0, w: 1000, h: 800 }, inset: 16, avoid: [], keep: [], gap: 40, ...over,
});

const screenPlate = (inp: PlateInput) => {
  const p = composePlate(inp)!;
  const r = plateRect(p.side, p.slide, inp.castle, p.k, inp.plate, inp.gap);
  return { p, r: { x: p.at.x + r.x, y: p.at.y + r.y, w: r.w, h: r.h } };
};

test("the pair fits the safe area at the preferred scale, plate clear of the castle", () => {
  const inp = base();
  const { p, r } = screenPlate(inp);
  assert.equal(p.k, 2);
  assert.ok(r.x >= 16 && r.y >= 16 && r.x + r.w <= 984 && r.y + r.h <= 784);
  const c = { x: p.at.x, y: p.at.y };
  assert.ok(!(c.x > r.x - 12 && c.x < r.x + r.w + 12 && c.y > r.y - 12 && c.y < r.y + r.h + 12));
});

test("the castle always falls inside the plate's span along the leader (a straight line)", () => {
  for (const anchor of [{ x: 10, y: 10 }, { x: 190, y: 190 }, { x: 100, y: 20 }]) {
    const { p, r } = screenPlate(base({ anchor }));
    if (p.side === "right" || p.side === "left") assert.ok(p.at.y >= r.y && p.at.y <= r.y + r.h);
    else assert.ok(p.at.x >= r.x && p.at.x <= r.x + r.w);
  }
});

test("the plate avoids corner plates and steers off the lineage", () => {
  const avoid = [{ x: 500, y: 0, w: 500, h: 800 }];
  const { r } = screenPlate(base({ avoid }));
  assert.ok(r.x + r.w <= 492);
  // lineage to the right of the castle: the plate goes elsewhere
  const keep = [{ pts: sample([{ x: 100, y: 100 }, { x: 200, y: 100 }], 4), weight: 50 }];
  const { p } = screenPlate(base({ keep }));
  assert.notEqual(p.side, "right");
});

test("bounded (paper): the camera never shows past the painting", () => {
  const inp = base({ bounded: { w: 600, h: 500 }, anchor: { x: 560, y: 250 }, land: { x: 400, y: 100, w: 200, h: 300 } });
  const p = composePlate(inp)!;
  const camX = inp.anchor.x - p.at.x / p.k;
  assert.ok(camX >= -1e-6 && camX <= 600 - 1000 / p.k + 1e-6);
});

test("nothing fits → null; fixed still places the plate where it spills least", () => {
  assert.equal(composePlate(base({ view: { x: 0, y: 0, w: 300, h: 200 } })), null);
  const view = { x: 0, y: 0, w: 600, h: 300 };
  const p = composePlate(base({ view, scales: [2], fixed: { x: 80, y: 150 } }))!;
  assert.deepEqual(p.at, { x: 80, y: 150 });
  assert.equal(p.side, "right");
});
