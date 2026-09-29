// Board geometry for skin D. Every node position comes from buildFlow; this
// module only (a) regroups pipe tracks into per-parent trunks inside
// buildFlow's gutters and (b) on wide screens "folds" the lane stack into two
// side-by-side halves (lanes keep their internal geometry and order; the
// lower half is translated as a block so the board fills a landscape
// viewport). Pipes that cross the fold climb their gutters to ONE shared
// corridor above both halves (the "sky bridge"), cross there as a bundle and
// drop down the child's gutter — never through a lane or a creature.
import type { Box, FlowLayout, Pt } from "@/lib/world";

export interface BNode { name: string; family: string; depth: number; lane: number; col: number; half: number; x: number; y: number }
export interface BLane { family: string; index: number; half: number; x: number; y: number; w: number; h: number }
export interface BPipe { id: string; from: string; to: string; pts: Pt[]; crossLane: boolean; crossHalf: boolean }
export interface Board {
  mode: "split" | "stack";
  nodes: Map<string, BNode>;
  list: BNode[];
  lanes: BLane[];
  pipes: BPipe[];
  width: number;
  height: number;
  /** x offset of each half (world px) */
  halfX: number[];
  colX: (half: number, depth: number) => number;
  nodeW: number;
  /** world y of the top of the drawing (the sky-bridge corridor + column headers live above the lanes) */
  top: number;
  /** world y of the column headers */
  headerY: number;
  /** the hidden next-era lane and the legacy ruins — outside the overview frame */
  next: Box;
  ruins: Box;
}

const TRACK = 22;         // world px between trunks sharing a gutter (shrinks to fit the gutter)
const FOLD_GAP = 260;     // world px between the two halves (cross-fold pipes + the right half's atom plates)
const CORRIDOR_STEP = 9;  // world px between cross-fold pipes sharing the sky bridge

export function layoutBoard(flow: FlowLayout, mode: "split" | "stack"): Board {
  const lanesIn = flow.lanes;
  // ——— split point that balances the two halves' heights ———
  let split = lanesIn.length;
  if (mode === "split" && lanesIn.length > 1) {
    let best = Infinity;
    for (let k = 1; k < lanesIn.length; k++) {
      const top = lanesIn[k - 1].y + lanesIn[k - 1].h - lanesIn[0].y;
      const bot = lanesIn[lanesIn.length - 1].y + lanesIn[lanesIn.length - 1].h - lanesIn[k].y;
      const m = Math.max(top, bot);
      if (m < best) { best = m; split = k; }
    }
  }
  const halfOfLane = (l: number) => (l >= split ? 1 : 0);
  const W = flow.width;
  const dx = mode === "split" ? W + FOLD_GAP : 0;
  const dy = mode === "split" && split < lanesIn.length ? lanesIn[split].y - lanesIn[0].y : 0;
  const T = (p: Pt, half: number): Pt => (half ? { x: p.x + dx, y: p.y - dy } : { x: p.x, y: p.y });

  const cols = flow.columns.map((c) => c.x);
  const nodeW = flow.nodes[0]?.box.w ?? 150;
  const colW = cols.length > 1 ? cols[1] - cols[0] : 280;
  const gutterMid = (d: number) => cols[d] + nodeW + (colW - nodeW) / 2;

  const byName = new Map(flow.nodes.map((n) => [n.name, n]));
  const cxO = (n: string) => byName.get(n)!.box.x + byName.get(n)!.box.w / 2;
  const cyO = (n: string) => byName.get(n)!.box.y + byName.get(n)!.box.h / 2;
  const halfOf = (n: string) => halfOfLane(byName.get(n)!.lane);

  // ——— trunks (original coordinates, per half) ———
  type Plan = { id: string; from: string; to: string; dp: number; dc: number; chan: number | null; cross: boolean; crossLane: boolean };
  const plans: Plan[] = flow.pipes.map((p) => {
    const dp = byName.get(p.from)!.depth;
    const dc = byName.get(p.to)!.depth;
    let chan: number | null = null;
    if (dc - dp > 1) {
      let best = -1;
      for (let i = 1; i < p.points.length - 2; i++) {
        const a = p.points[i], b = p.points[i + 1];
        if (Math.abs(a.y - b.y) < 1e-6 && Math.abs(b.x - a.x) > best) { best = Math.abs(b.x - a.x); chan = a.y; }
      }
      if (chan === null) chan = (cyO(p.from) + cyO(p.to)) / 2;
    }
    return { id: `${p.from}->${p.to}`, from: p.from, to: p.to, dp, dc, chan, cross: halfOf(p.from) !== halfOf(p.to), crossLane: p.crossLane };
  });
  const trunks = new Map<string, { half: number; gutter: number; y0: number; y1: number }>();
  const grow = (key: string, half: number, gutter: number, ya: number, yb: number) => {
    const t = trunks.get(key) ?? { half, gutter, y0: Infinity, y1: -Infinity };
    t.y0 = Math.min(t.y0, ya, yb);
    t.y1 = Math.max(t.y1, ya, yb);
    trunks.set(key, t);
  };
  // cross-fold pipes: the parent's trunk climbs to the sky bridge; the child gets its own drop
  const crossPlans0 = plans.filter((p) => p.cross);
  const topLane = lanesIn[0].y;
  const bridgeY = (i: number) => topLane - 74 - i * CORRIDOR_STEP;        // transformed (both halves share it)
  const toOrig = (y: number, half: number) => (half ? y + dy : y);
  for (const p of plans) {
    const hp = halfOf(p.from);
    if (p.cross) {
      const hc = halfOf(p.to);
      const by = bridgeY(crossPlans0.indexOf(p));
      grow(`o:${hp}:${p.dp}:${p.from}`, hp, p.dp, cyO(p.from), toOrig(by, hp));
      grow(`x:${hc}:${p.dc - 1}:${p.to}:${p.from}`, hc, p.dc - 1, toOrig(by, hc), cyO(p.to));
      continue;
    }
    grow(`o:${hp}:${p.dp}:${p.from}`, hp, p.dp, cyO(p.from), p.chan ?? cyO(p.to));
    if (p.chan !== null) grow(`i:${hp}:${p.dc - 1}:${p.to}`, hp, p.dc - 1, p.chan, cyO(p.to));
  }
  const trackX = new Map<string, number>();
  for (const key0 of new Set([...trunks.values()].map((t) => `${t.half}:${t.gutter}`))) {
    const list = [...trunks.entries()].filter(([, t]) => `${t.half}:${t.gutter}` === key0)
      .sort(([ka, a], [kb, b]) => (b.y1 - b.y0) - (a.y1 - a.y0) || a.y0 - b.y0 || (ka < kb ? -1 : 1));
    const tracks: [number, number][][] = [];
    const assign = new Map<string, number>();
    for (const [key, t] of list) {
      let i = tracks.findIndex((iv) => iv.every(([a, b]) => t.y1 < a - 6 || t.y0 > b + 6));
      if (i < 0) { i = tracks.length; tracks.push([]); }
      tracks[i].push([t.y0, t.y1]);
      assign.set(key, i);
    }
    const sp = Math.min(TRACK, (colW - nodeW - 36) / Math.max(1, tracks.length - 1));
    for (const [key, i] of assign) trackX.set(key, gutterMid(trunks.get(key)!.gutter) + (i - (tracks.length - 1) / 2) * sp);
  }

  // ——— pipes ———
  const crossPlans = plans.filter((p) => p.cross);
  const pipes: BPipe[] = plans.map((p) => {
    const hp = halfOf(p.from), hc = halfOf(p.to);
    const g1 = trackX.get(`o:${hp}:${p.dp}:${p.from}`)!;
    const a = { x: cxO(p.from), y: cyO(p.from) };
    const b = { x: cxO(p.to), y: cyO(p.to) };
    let pts: Pt[];
    if (!p.cross) {
      if (p.chan === null) pts = [a, { x: g1, y: a.y }, { x: g1, y: b.y }, b];
      else {
        const g2 = trackX.get(`i:${hp}:${p.dc - 1}:${p.to}`)!;
        pts = [a, { x: g1, y: a.y }, { x: g1, y: p.chan }, { x: g2, y: p.chan }, { x: g2, y: b.y }, b];
      }
      pts = pts.map((q) => T(q, hp));
    } else {
      const i = crossPlans.indexOf(p);
      const by = bridgeY(i);
      const A = T(a, hp), B = T(b, hc);
      const G1 = T({ x: g1, y: 0 }, hp).x;
      const gIn = T({ x: trackX.get(`x:${hc}:${p.dc - 1}:${p.to}:${p.from}`)!, y: 0 }, hc).x;
      pts = [A, { x: G1, y: A.y }, { x: G1, y: by }, { x: gIn, y: by }, { x: gIn, y: B.y }, B];
    }
    return { id: p.id, from: p.from, to: p.to, pts, crossLane: p.crossLane, crossHalf: p.cross };
  });

  const list: BNode[] = flow.nodes.map((n) => {
    const h = halfOfLane(n.lane);
    const c = T({ x: n.box.x + n.box.w / 2, y: n.box.y + n.box.h / 2 }, h);
    return { name: n.name, family: n.family, depth: n.depth, lane: n.lane, col: n.col, half: h, x: c.x, y: c.y };
  });
  const lanes: BLane[] = lanesIn.map((l, i) => {
    const h = halfOfLane(i);
    const p = T({ x: 6, y: l.y }, h);
    return { family: l.family, index: i, half: h, x: p.x, y: p.y, w: W - 12, h: l.h };
  });
  const width = mode === "split" ? 2 * W + FOLD_GAP : W;
  const height = Math.max(...lanes.map((l) => l.y + l.h)) + 24;
  const top = crossPlans.length ? bridgeY(crossPlans.length - 1) - 24 : topLane - 44;
  return {
    mode, nodes: new Map(list.map((n) => [n.name, n])), list, lanes, pipes, width, height,
    halfX: mode === "split" ? [0, dx] : [0],
    colX: (half, d) => (half ? dx : 0) + cols[d],
    nodeW,
    top,
    headerY: topLane - 22,
    next: { x: width + 420, y: height / 2 - 170, w: 760, h: 340 },
    ruins: { x: -420 - 1100, y: height / 2 - 330, w: 1100, h: 660 },
  };
}
