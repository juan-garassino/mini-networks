"use client";

// The storybook map (owner's paper-map reference) drawn from lib/world v3
// (preset "paper"): each family is a raised land slab with an organic
// coastline, its biome zones dressed densely (forests, snow peaks, the Wild
// West, the lava forge, the neon city, the dome city under the water), real
// rivers and waterfalls on river borders, mountain ranges on range borders,
// roads between models, towns around atoms, a painted sea with ships, a
// serpent and sea stacks. Positions: ONLY world data (shapes, zones, borders,
// islets, nodes, roads, cities, seaSlots). Everything is in world px and
// memoised — the camera only changes the viewBox.
import { memo, useMemo, type ReactNode } from "react";
import { roundedD, type Pt, type World, type WorldNode } from "@/lib/world";
import type { EvidenceState } from "@/components/lab/shared/card-model";
import {
  AtomLandmark, Broadleaf, Chessboard, Conifer, Coral, Cottage, CrystalSpire, Deer, FloatingIsland, FogIsland, GlassDome,
  HedgeMaze, INK, Jellyfish, LandSlab, LavaCastle, LavaCone, LavaRiver, LevelSpot, Mesa, NeonTower, PaperCloud, Rails,
  Ruins, S, SailingShip, SeaSerpent, SeaStack, SnowPeaks, Storefront, StoryCastle, Townhouse, Waterfall, WaterwheelHouse,
  Windpump, Cactus, Tuft, LIT, MID, type SlabTop,
} from "./art";

// ── geometry helpers ──────────────────────────────────────────────────────
const hash = (a: number, b: number) => {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return ((h >>> 0) % 10000) / 10000;
};
function smoothClosed(p: Pt[], passes = 2, half = 2): Pt[] {
  let q = p;
  for (let k = 0; k < passes; k++) {
    const n = q.length;
    q = q.map((_, i) => {
      let x = 0, y = 0;
      for (let j = -half; j <= half; j++) { const r = q[(i + j + n) % n]; x += r.x; y += r.y; }
      return { x: x / (2 * half + 1), y: y / (2 * half + 1) };
    });
  }
  return q;
}
/** Shrink a closed polygon by `d` px along its smoothed inward normals (a sea
 *  channel opens between neighbouring lands). */
function inset(p: Pt[], d: number): Pt[] {
  const q = smoothClosed(p, 3, 2);
  let area = 0;
  for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length]; area += a.x * b.y - b.x * a.y; }
  const sgn = area > 0 ? 1 : -1;
  return q.map((c, i) => {
    const a = q[(i - 2 + q.length) % q.length], b = q[(i + 2) % q.length];
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
    return { x: c.x - sgn * (dy / L) * d, y: c.y + sgn * (dx / L) * d };
  });
}

/** Closed Catmull-Rom through points, with a deterministic coastline wobble. */
function organic(p: Pt[], seed: number, amp: number): string {
  const s = smoothClosed(p, 2, 2);
  const all: Pt[] = [];
  s.forEach((a, i) => {
    const b = s[(i + 1) % s.length];
    all.push(a);
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
    if (L > 18) {
      const j = (hash(seed, i) - 0.5) * 2 * amp;
      all.push({ x: (a.x + b.x) / 2 - (dy / L) * j, y: (a.y + b.y) / 2 + (dx / L) * j });
    }
  });
  const n = all.length, f = (v: number) => v.toFixed(1);
  let d = `M${f(all[0].x)} ${f(all[0].y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = all[(i - 1 + n) % n], p1 = all[i], p2 = all[(i + 1) % n], p3 = all[(i + 2) % n];
    d += `C${f(p1.x + (p2.x - p0.x) / 6)} ${f(p1.y + (p2.y - p0.y) / 6)} ${f(p2.x - (p3.x - p1.x) / 6)} ${f(p2.y - (p3.y - p1.y) / 6)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return d + "Z";
}
function inside(p: Pt, poly: Pt[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
function distToPoly(p: Pt, poly: Pt[]): number {
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) d = Math.min(d, segDist(p, poly[j], poly[i]));
  return d;
}
function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
const centroid = (p: Pt[]) => ({ x: p.reduce((s, q) => s + q.x, 0) / p.length, y: p.reduce((s, q) => s + q.y, 0) / p.length });
const bbox = (p: Pt[]) => {
  const xs = p.map((q) => q.x), ys = p.map((q) => q.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
};
const lineD = (l: Pt[]) => `M${l.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("L")}`;
function smoothOpen(p: Pt[], passes = 3, half = 3): Pt[] {
  let q = p;
  for (let k = 0; k < passes; k++) q = q.map((a, i) => {
    if (i === 0 || i === q.length - 1) return a;
    const h = Math.min(half, i, q.length - 1 - i);
    let x = 0, y = 0;
    for (let j = i - h; j <= i + h; j++) { x += q[j].x; y += q[j].y; }
    return { x: x / (2 * h + 1), y: y / (2 * h + 1) };
  });
  return q;
}
const curveD = (l: Pt[]) => {
  if (l.length < 3) return lineD(l);
  let d = `M${l[0].x.toFixed(1)} ${l[0].y.toFixed(1)}`;
  for (let i = 1; i < l.length - 1; i++) {
    const m = { x: (l[i].x + l[i + 1].x) / 2, y: (l[i].y + l[i + 1].y) / 2 };
    d += `Q${l[i].x.toFixed(1)} ${l[i].y.toFixed(1)} ${m.x.toFixed(1)} ${m.y.toFixed(1)}`;
  }
  const z = l[l.length - 1];
  return d + `L${z.x.toFixed(1)} ${z.y.toFixed(1)}`;
};

// ── per-family look ───────────────────────────────────────────────────────
const TOP: Record<string, SlabTop> = {
  perception: "grass", representation: "snow", sequence: "autumn", decision: "desert", structure: "grass", generative: "lava",
};
const DEPTH: Record<string, number> = {
  perception: 58, representation: 76, sequence: 62, decision: 54, structure: 90, generative: 46,
};
/** Painter's order: north families first so southern cliffs overlap them. */
const ORDER = ["representation", "perception", "sequence", "decision", "generative"];   // structure floats (islands)

export interface Story {
  lands: { family: string; d: string; poly: Pt[]; depth: number; top: SlabTop }[];
  terraces: { d: string; top: SlabTop; depth: number }[];
  reef: string | null;
  rivers: { d: string; w: number; mouth: Pt | null }[];
  ranges: Pt[];
  lava: string[];
  roads: { id: string; d: string }[];
  bridges: Pt[][];
  props: { y: number; key: string; node: ReactNode }[];
  islets: { kind: string; at: Pt; size: number }[];
}

export function buildStory(world: World): Story {
  const shapes = new Map(world.shapes.map((s) => [s.family, s.poly]));
  const lands = ORDER.filter((f) => shapes.has(f)).map((f, i) => {
    const poly = inset(shapes.get(f)!, 20);
    return { family: f, poly, d: organic(poly, 11 + i, 12), depth: DEPTH[f] ?? 50, top: TOP[f] ?? "grass" };
  });
  const zone = (f: string, z: string) => world.zones.find((q) => q.family === f && q.zone === z)?.poly ?? null;

  // raised terraces (the reference's stacked plateaus) + zone tops
  const terraces: Story["terraces"] = [];
  const cyber = zone("generative", "cyber");
  if (cyber) terraces.push({ d: organic(cyber, 41, 8), top: "night", depth: 26 });
  const cath = zone("sequence", "cathedral");
  if (cath) terraces.push({ d: organic(cath, 42, 6), top: "grass", depth: 14 });
  const under = zone("generative", "underwater");
  const reef = under ? organic(under, 43, 10) : null;

  // borders: rivers become smooth water ribbons, ranges become peaks
  const rivers: Story["rivers"] = [];
  const ranges: Pt[] = [];
  const seaAt = (p: Pt) => {
    const tx = Math.floor(p.x / world.tile), ty = Math.floor(p.y / world.tile);
    return tx < 0 || ty < 0 || tx >= world.cols || ty >= world.rows || world.regionOf[ty * world.cols + tx] < 0;
  };
  for (const b of world.borders) {
    if (b.path.length < 3) continue;
    const l = smoothOpen(b.path, 4, 3);
    if (b.kind === "river") {
      const a = seaAt(l[0]) || seaAt(l[1]), z = seaAt(l[l.length - 1]) || seaAt(l[l.length - 2]);
      const line = a && !z ? [...l].reverse() : l;
      rivers.push({ d: curveD(line), w: 16, mouth: a || z ? line[line.length - 1] : null });
    } else if (b.kind === "range") {
      const n = Math.max(2, Math.floor(l.length / 6));
      for (let i = 0; i < n; i++) ranges.push(l[Math.floor((i + 0.5) * (l.length / n))]);
    }
  }
  const lava: string[] = [];
  const forge = zone("generative", "forge");
  if (forge) {
    const bb = bbox(forge);
    for (let i = 0; i < 4; i++) {
      const x = bb.x0 + ((i + 0.6) / 4.2) * (bb.x1 - bb.x0);
      const pts: Pt[] = [];
      for (let k = 0; k <= 6; k++) pts.push({ x: x + (hash(i, k) - 0.5) * 60, y: bb.y0 + 20 + (k / 6) * (bb.y1 - bb.y0 - 30) });
      lava.push(curveD(pts.filter((p) => inside(p, forge))));
    }
  }

  const roads = world.roads.map((r) => ({ id: r.id, d: roundedD(r.lanePoints.length ? r.lanePoints : r.points, 18) }));
  // where a road crosses open water (the channels between lands) it becomes a plank bridge
  const onLand = (p: Pt) => lands.some((l) => inside(p, l.poly)) || world.nodes.some((n) => Math.hypot(n.center.x - p.x, n.center.y - p.y) < 30);
  const bridges: Pt[][] = [];
  for (const r of world.roads) {
    const P = r.lanePoints.length ? r.lanePoints : r.points;
    let run: Pt[] = [];
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6));
      for (let k = 0; k <= n; k++) {
        const q = { x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n };
        if (!onLand(q)) run.push(q);
        else if (run.length) { if (run.length > 2) bridges.push(run); run = []; }
      }
    }
    if (run.length > 2) bridges.push(run);
  }

  // ── dense dressing on free land ─────────────────────────────────────────
  const nodes = world.nodes;
  const segs: [Pt, Pt][] = [];
  for (const r of world.roads) { const P = r.lanePoints.length ? r.lanePoints : r.points; for (let i = 1; i < P.length; i++) segs.push([P[i - 1], P[i]]); }
  const blocks = world.cities.flatMap((c) => c.blocks.map((b) => ({ x: b.x + b.w / 2, y: b.y + b.h })));
  const busy = (p: Pt, rNode: number, rRoad: number) =>
    nodes.some((n) => Math.hypot(n.center.x - p.x, n.center.y - p.y) < (n.atom ? rNode * 1.7 : rNode)) ||
    segs.some(([a, b]) => segDist(p, a, b) < rRoad) || blocks.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < 26);
  const props: Story["props"] = [];
  const put = (key: string, y: number, node: ReactNode) => props.push({ key, y, node });

  // trees: a jittered grid over each land (forest zones dense, others lighter)
  const riverLines = world.borders.filter((b) => b.kind === "river").map((b) => smoothOpen(b.path, 4, 3));
  const nearRiver = (p: Pt) => riverLines.some((l) => l.some((q, i) => i > 0 && segDist(p, l[i - 1], q) < 22));
  for (const land of lands) {
    const f = land.family;
    if (f === "generative" || f === "decision" || f === "structure") continue;
    const bb = bbox(land.poly);
    const zForest = zone("perception", "forest"), zSnow = zone("representation", "snow"), zMeadow = zone("sequence", "meadow");
    const step = f === "perception" ? 24 : f === "representation" ? 26 : 30;
    for (let gy = Math.floor(bb.y0 / step); gy <= bb.y1 / step; gy++) {
      for (let gx = Math.floor(bb.x0 / step); gx <= bb.x1 / step; gx++) {
        const p = { x: gx * step + (hash(gx, gy) - 0.5) * step * 0.9 + (gy % 2 ? step / 2 : 0), y: gy * step + (hash(gy, gx + 99) - 0.5) * step * 0.8 };
        if (!inside(p, land.poly) || distToPoly(p, land.poly) < 14) continue;
        const inZone = (f === "perception" && zForest && inside(p, zForest)) || (f === "representation" && zSnow && inside(p, zSnow)) ||
          (f === "sequence" && zMeadow && inside(p, zMeadow));
        const keep = inZone ? 0.9 : f === "sequence" ? 0.62 : 0.55;
        if (hash(gx * 7, gy * 3) > keep) continue;
        if (busy(p, 44, 16) || nearRiver(p) || (cath && inside(p, cath))) continue;
        const s = 30 + hash(gx, gy * 5) * 12;
        const v = hash(gx * 13, gy);
        const node = f === "representation" ? <Conifer x={p.x} y={p.y} size={s} snow />
          : f === "sequence" ? (v < 0.55 ? <Broadleaf x={p.x} y={p.y} size={s * 0.9} autumn /> : <Conifer x={p.x} y={p.y} size={s} />)
            : v < 0.62 ? <Conifer x={p.x} y={p.y} size={s} /> : <Broadleaf x={p.x} y={p.y} size={s * 0.9} />;
        put(`t${f}${gx},${gy}`, p.y, node);
      }
    }
  }
  // Representation: snow peaks along the north rim, crystal spires and deer
  const rep = lands.find((l) => l.family === "representation");
  if (rep) {
    const bb = bbox(rep.poly);
    for (let i = 0; i < 6; i++) {
      const p = { x: bb.x0 + ((i + 0.5) / 6) * (bb.x1 - bb.x0), y: bb.y0 + 70 + hash(i, 3) * 30 };
      if (!inside(p, rep.poly) || busy(p, 70, 30)) continue;
      put(`pk${i}`, p.y - 30, <SnowPeaks x={p.x} y={p.y} size={80 + hash(i, 4) * 40} />);
    }
    [[0.35, 0.5], [0.72, 0.62], [0.55, 0.78]].forEach(([u, v], i) => {
      const p = { x: bb.x0 + u * (bb.x1 - bb.x0), y: bb.y0 + v * (bb.y1 - bb.y0) };
      if (inside(p, rep.poly) && !busy(p, 50, 20)) put(`dr${i}`, p.y, i === 1 ? <CrystalSpire x={p.x} y={p.y} size={70} /> : <Deer x={p.x} y={p.y} size={30} />);
    });
  }
  // ranges: mountain peaks on range borders
  ranges.forEach((p, i) => { if (!busy(p, 50, 18)) put(`rg${i}`, p.y, <SnowPeaks x={p.x} y={p.y + 20} size={70 + hash(i, 8) * 30} />); });

  // Decision: the Wild West — mesas, cacti, a windpump, storefronts, rails
  const dec = lands.find((l) => l.family === "decision");
  if (dec) {
    const bb = bbox(dec.poly);
    const step = 44;
    for (let gy = Math.floor(bb.y0 / step); gy <= bb.y1 / step; gy++) for (let gx = Math.floor(bb.x0 / step); gx <= bb.x1 / step; gx++) {
      const p = { x: gx * step + (hash(gx, gy) - 0.5) * step, y: gy * step + (hash(gy, gx) - 0.5) * step };
      if (!inside(p, dec.poly) || distToPoly(p, dec.poly) < 20 || busy(p, 46, 18) || nearRiver(p)) continue;
      const v = hash(gx * 5, gy * 11);
      if (v < 0.34) put(`cc${gx},${gy}`, p.y, <Cactus x={p.x} y={p.y} size={26 + v * 20} />);
      else if (v < 0.44) put(`ms${gx},${gy}`, p.y, <Mesa x={p.x} y={p.y} size={50 + v * 30} wide={v < 0.4} />);
      else if (v < 0.62) put(`tf${gx},${gy}`, p.y, <Tuft x={p.x} y={p.y} s={1.6} ramp={S.autumn} />);
    }
  }
  // Generative: lava cones in the forge, neon towers packed in the cyber zone, domes and coral on the reef
  if (forge) {
    const bb = bbox(forge);
    for (let i = 0; i < 14; i++) {
      const p = { x: bb.x0 + hash(i, 21) * (bb.x1 - bb.x0), y: bb.y0 + hash(i, 22) * (bb.y1 - bb.y0) };
      if (!inside(p, forge) || busy(p, 50, 18)) continue;
      put(`lc${i}`, p.y, i % 5 === 0 ? <LavaCastle x={p.x} y={p.y} size={80} /> : <LavaCone x={p.x} y={p.y} size={34 + hash(i, 23) * 26} />);
    }
  }
  if (cyber) {
    const bb = bbox(cyber);
    const step = 34;
    for (let gy = Math.floor(bb.y0 / step); gy <= bb.y1 / step; gy++) for (let gx = Math.floor(bb.x0 / step); gx <= bb.x1 / step; gx++) {
      const p = { x: gx * step + (hash(gx, gy) - 0.5) * 16, y: gy * step + (hash(gy, gx) - 0.5) * 12 };
      if (!inside(p, cyber) || distToPoly(p, cyber) < 10 || busy(p, 44, 14)) continue;
      put(`nt${gx},${gy}`, p.y, <NeonTower x={p.x} y={p.y} size={50 + hash(gx, gy * 3) * 60} variant={(gx + gy) % 4} />);
    }
  }
  if (under) {
    const bb = bbox(under);
    for (let i = 0; i < 16; i++) {
      const p = { x: bb.x0 + hash(i, 31) * (bb.x1 - bb.x0), y: bb.y0 + hash(i, 32) * (bb.y1 - bb.y0) };
      if (!inside(p, under) || busy(p, 46, 14)) continue;
      put(`uw${i}`, p.y, i % 3 === 0 ? <GlassDome x={p.x} y={p.y} size={50 + hash(i, 33) * 30} /> : i % 3 === 1 ? <Coral x={p.x} y={p.y} size={24} ramp={i % 2 ? S.pink : S.autumn} /> : <Jellyfish x={p.x} y={p.y - 20} size={26} ramp={i % 2 ? S.pink : S.cyan} />);
    }
  }
  // towns: houses on the city blocks, in the family's style
  const fam = new Map(nodes.map((n) => [n.name, n.family]));
  world.cities.forEach((c) => {
    const f = fam.get(c.node) ?? "";
    c.blocks.forEach((b, i) => {
      const x = b.x + b.w / 2, y = b.y + b.h;
      const v = (i + c.node.length) % 4;
      const node = f === "decision" ? <Storefront x={x} y={y} size={34} variant={v} />
        : f === "generative" ? <NeonTower x={x} y={y} size={46} variant={v} />
          : f === "sequence" && v === 0 ? <WaterwheelHouse x={x} y={y} size={36} />
            : v % 2 ? <Townhouse x={x} y={y} size={32} /> : <Cottage x={x} y={y} size={30} />;
      put(`h${c.node}${i}`, y, node);
    });
  });
  // signature set-pieces the reference has: a clock-tower-and-castle heart, a windpump + maze + chessboard west
  if (cath) { const c = centroid(cath); if (!busy(c, 60, 20)) put("castle", c.y, <StoryCastle x={c.x} y={c.y} size={96} />); }
  if (dec) {
    const bb = bbox(dec.poly);
    const spots: [number, number, (p: Pt) => ReactNode][] = [
      [0.12, 0.35, (p) => <Windpump x={p.x} y={p.y} size={70} />],
      [0.62, 0.72, (p) => <HedgeMaze x={p.x} y={p.y} size={44} />],
      [0.8, 0.3, (p) => <Chessboard x={p.x} y={p.y} size={40} />],
    ];
    spots.forEach(([u, v, draw], i) => {
      const p = { x: bb.x0 + u * (bb.x1 - bb.x0), y: bb.y0 + v * (bb.y1 - bb.y0) };
      if (inside(p, dec.poly) && !busy(p, 60, 22)) put(`ww${i}`, p.y, draw(p));
    });
  }
  // sea: ships and a serpent in the open water; sea stacks on rock islets
  world.seaSlots.forEach((b, i) => {
    const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    put(`sh${i}`, c.y, i === 1 ? <SeaSerpent x={c.x} y={c.y} size={70} /> : <SailingShip x={c.x} y={c.y} size={70} facing={i % 2 ? -1 : 1} />);
    put(`cl${i}`, c.y - 90, <PaperCloud x={c.x + 60} y={c.y - 80} size={50} variant={i % 3} />);
  });
  const islets = world.islets.map((it) => ({ kind: it.kind, at: centroid(it.poly), size: Math.max(40, bbox(it.poly).x1 - bbox(it.poly).x0) }));
  islets.forEach((it, i) => {
    if (it.kind === "rock") put(`st${i}`, it.at.y, <SeaStack x={it.at.x} y={it.at.y + 10} size={Math.min(70, it.size)} grass={i % 2 === 0} />);
    else put(`fi${i}`, it.at.y, <FloatingIsland x={it.at.x} y={it.at.y + 20} size={Math.min(90, it.size * 1.2)} />);
  });
  // Structure floats: one big floating island under each of its models, small
  // ones scattered in its sky, rope bridges between them (drawn with the roads)
  const sky = world.shapes.find((q) => q.family === "structure")?.poly;
  const floaters: Pt[] = [];
  for (const n of nodes.filter((q) => q.family === "structure")) {
    const size = n.atom ? 300 : 200, k = size / 120;
    put(`fl${n.name}`, n.center.y - 1, <FloatingIsland x={n.center.x} y={n.center.y + 62 * k} size={size} trees={false} />);
    floaters.push(n.center);
  }
  if (sky) {
    const bb = bbox(sky);
    for (let i = 0; i < 24 && floaters.length < 7; i++) {
      const p = { x: bb.x0 + hash(i, 51) * (bb.x1 - bb.x0), y: bb.y0 + hash(i, 52) * (bb.y1 - bb.y0) };
      if (!inside(p, sky) || floaters.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 190) || busy(p, 120, 40)) continue;
      put(`fx${i}`, p.y, <FloatingIsland x={p.x} y={p.y + 62} size={110 + hash(i, 53) * 60} />);
      floaters.push(p);
    }
  }
  // one sailing ship per harbour that docks compositions (encodes: pipelines touching the family)
  world.harbours.filter((h) => h.boats > 0).forEach((h, i) => {
    put(`hb${i}`, h.pt.y + 30, <SailingShip x={h.pt.x + (i % 2 ? -30 : 30)} y={h.pt.y + 40} size={58} facing={i % 2 ? -1 : 1} />);
  });
  // the secret islands (outside the overview)
  const hi = world.hiddenIsland;
  put("fog", hi.box.y + hi.box.h, <FogIsland x={hi.box.x + hi.box.w / 2} y={hi.box.y + hi.box.h * 0.9} size={150} />);
  world.ruinsIsland.slots.forEach((p, i) => put(`ru${i}`, p.y, <Ruins x={p.x} y={p.y} size={[40, 50, 34, 46][i % 4]} flip={i % 3 === 1} />));

  return { lands, terraces, reef, rivers, ranges, lava, roads, bridges, props, islets };
}

// ── layers ────────────────────────────────────────────────────────────────
export const StoryGround = memo(function StoryGround({ world, story }: { world: World; story: Story }) {
  const { w, h } = world.camera.world;
  return (
    <g aria-hidden>
      <rect x={-w} y={-h} width={w * 3} height={h * 3} fill="url(#pa-sea-paint)" />
      {story.reef && (
        <g>
          <path d={story.reef} fill="url(#pa-s-reef)" opacity={0.9} />
          <path d={story.reef} fill="#72B2D0" opacity={0.25} />
          <path d={story.reef} fill="none" stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={14} />
        </g>
      )}
      {story.lands.map((l) => <LandSlab key={l.family} d={l.d} depth={l.depth} top={l.top} layers={6} />)}
      {story.terraces.map((t, i) => <LandSlab key={i} d={t.d} depth={t.depth} top={t.top} layers={3} foam={false} />)}
      {story.lava.map((d, i) => <LavaRiver key={i} d={d} w={9 - i} />)}
      {/* rivers: smooth painted water with foam banks and a light stripe; a waterfall at the mouth */}
      {false && story.rivers.map((r, i) => (
        <g key={i} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={r.d} stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={r.w + 10} />
          <path d={r.d} stroke={INK} strokeOpacity={0.35} strokeWidth={r.w + 3} />
          <path d={r.d} stroke={S.sea[LIT]} strokeWidth={r.w} />
          <path d={r.d} stroke={S.sea[MID]} strokeWidth={r.w * 0.45} transform="translate(1.5 2)" />
          <path d={r.d} stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={2} strokeDasharray="8 12" />
        </g>
      ))}
      {story.rivers.filter((r) => r.mouth).map((r, i) => <Waterfall key={`wf${i}`} x={r.mouth!.x} y={r.mouth!.y} h={52} w={20} />)}
    </g>
  );
});

export const StoryRoads = memo(function StoryRoads({ story, trail }: { story: Story; trail: string[] }) {
  const hot = new Set(trail);
  return (
    <g aria-hidden fill="none" strokeLinecap="round" strokeLinejoin="round">
      {story.roads.map((r) => <path key={`e${r.id}`} d={r.d} stroke="#6A4127" strokeOpacity={0.55} strokeWidth={8} />)}
      {story.roads.map((r) => <path key={`g${r.id}`} d={r.d} stroke="#E8C27A" strokeWidth={5} />)}
      {story.roads.map((r) => <path key={`c${r.id}`} d={r.d} stroke="#FFF3D0" strokeWidth={1.4} strokeDasharray="3 7" />)}
      {story.bridges.map((b, i) => {
        const d = lineD(b);
        return (
          <g key={`b${i}`}>
            <path d={d} stroke="rgba(20,30,50,0.3)" strokeWidth={16} transform="translate(3 8)" />
            <path d={d} stroke="#482D1E" strokeWidth={15} strokeLinecap="butt" />
            <path d={d} stroke="#B27C47" strokeWidth={11} strokeLinecap="butt" />
            <path d={d} stroke="#6B4228" strokeWidth={11} strokeDasharray="1.4 4.6" strokeLinecap="butt" />
          </g>
        );
      })}
      {story.roads.filter((r) => hot.has(r.id)).map((r) => <path key={`t${r.id}`} d={r.d} stroke={INK} strokeWidth={4} strokeDasharray="0.1 12" />)}
    </g>
  );
});

/** Stand-ups (trees, towns, landmarks, spots, ships…) painted far → near. */
export const StoryProps = memo(function StoryProps({ world, story, states, focus }: {
  world: World; story: Story; states: Record<string, EvidenceState>; focus: string | null;
}) {
  const items = useMemo(() => {
    const all = [...story.props];
    for (const n of world.nodes) all.push({ key: `n${n.name}`, y: n.center.y + (n.atom ? 20 : 0.5), node: <ModelMark node={n} state={states[n.name] ?? "untrained"} focused={n.name === focus} /> });
    return all.sort((a, b) => a.y - b.y);
  }, [world, story, states, focus]);
  return <g aria-hidden>{items.map((it) => <g key={it.key}>{it.node}</g>)}</g>;
});

function ModelMark({ node, state, focused }: { node: WorldNode; state: EvidenceState; focused: boolean }) {
  const { x, y } = node.center;
  const k = focused ? 1.3 : 1;
  if (node.atom) {
    const big = node.name === "transformer" || node.name === "classifier";
    return (
      <g transform={focused ? `translate(${x} ${y}) scale(${k}) translate(${-x} ${-y})` : undefined}>
        <ellipse cx={x} cy={y + 20} rx={36} ry={10} fill="rgba(40,26,18,0.25)" />
        <AtomLandmark name={node.name} state={state} size={big ? 118 : 92} x={x} y={y + 20} />
      </g>
    );
  }
  return (
    <g transform={focused ? `translate(${x} ${y}) scale(${k}) translate(${-x} ${-y})` : undefined}>
      <circle cx={x} cy={y} r={20} fill="#FFF3C4" stroke="#6A4127" strokeWidth={2} />
      <LevelSpot name={node.name} state={state} x={x} y={y - 2} r={16} />
    </g>
  );
}
