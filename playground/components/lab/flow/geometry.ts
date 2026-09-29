// Board geometry for skin D. What buildFlow decides is kept: which lane
// (family) a model lives in, its generation column and its order/row within
// the lane, and every same-family builds_on route (incl. the channel a long
// edge rides). What this module stylises:
//   • every lane becomes its own tray ("block") whose columns are as wide as
//     the names they hold — each creature owns a name slot to its right, at
//     the overview scale — so all 44 names fit at 1440×900;
//   • blocks are packed side by side to fill a landscape screen (cross-family
//     edges are portals at rest, so blocks don't need to touch their partners);
//   • pipes: one trunk per parent in the gutter after its column, branching off
//     at each child's row; a pipe starts at the END of its parent's name slot,
//     so no pipe ever runs under a name.
import type { Box, FlowLayout, Pt } from "@/lib/world";

export interface BNode {
  name: string; family: string; depth: number; lane: number; col: number;
  /** world x where this creature's name slot starts */
  slotStart: number;
  /** creature centre (world) */
  x: number; y: number;
  /** world x where this creature's name slot ends (pipes leave from here) */
  slotEnd: number;
}
export interface BLane { family: string; index: number; x: number; y: number; w: number; h: number; cols: number[] }
export interface BPipe { id: string; from: string; to: string; pts: Pt[]; crossLane: boolean }
export interface Board {
  nodes: Map<string, BNode>;
  list: BNode[];
  lanes: BLane[];
  pipes: BPipe[];
  width: number;
  height: number;
  /** the screen scale this layout was designed for (overview at 1440×900) */
  s0: number;
  /** creature radius (world) */
  R: number;
  /** column header anchors (world) */
  heads: { lane: number; depth: number; x: number; y: number }[];
  /** the hidden next-era lane and the legacy ruins — outside the overview frame */
  next: Box;
  ruins: Box;
}

// design sizes in SCREEN px at the overview scale
const CREATURE = 44;      // creature footprint
const GAP = 8;            // creature ↔ name slot
const TRACK = 11;         // between trunks in a gutter
const GUTTER_PAD = 10;    // name slot end ↔ first trunk, last trunk ↔ next creature
const ROW = 42;           // min row pitch (fits a two-line name tag)
const PAD_TOP = 30;       // tab + generation headers
const PAD_SIDE = 14;
const PAD_BOTTOM = 18;
const BLOCK_GAP = 22;
export const DESIGN = { w: 1440 - 32, h: 900 - 72 - 20 };

export function layoutBoard(
  flow: FlowLayout,
  children: Map<string, string[]>,
  slotPx: (name: string, atom: boolean) => number,
  columns: 1 | 2 = 2,
): Board {
  const byName = new Map(flow.nodes.map((n) => [n.name, n]));
  const cyO = (n: string) => byName.get(n)!.box.y + byName.get(n)!.box.h / 2;
  const laneIdx = (n: string) => byName.get(n)!.lane;
  const samePipes = flow.pipes.filter((p) => laneIdx(p.from) === laneIdx(p.to));

  // the px design is scale-free; s0 only sets the world unit (overview ≈ s0)
  const s0 = 0.535;
  let out: Board | null = null;
  {
    const u = (px: number) => px / s0;             // screen px at s0 → world
    const R = u(CREATURE / 2);
    const ay = Math.max(1, u(ROW) / 84);

    // ——— one block per lane (local coordinates) ———
    type Local = { lane: number; w: number; h: number; nodes: BNode[]; pipes: BPipe[]; heads: { depth: number; x: number }[] };
    const locals: Local[] = flow.lanes.map((lane, li) => {
      const ns = flow.nodes.filter((n) => n.lane === li);
      const depths = [...new Set(ns.map((n) => n.depth))].sort((a, b) => a - b);
      const ly = (y: number) => u(PAD_TOP) + (y - lane.y) * ay;
      // trunk intervals per gutter (depth index) → number of tracks
      const trunkIv = new Map<string, { g: number; y0: number; y1: number }>();
      const grow = (key: string, g: number, a: number, b: number) => {
        const t = trunkIv.get(key) ?? { g, y0: Infinity, y1: -Infinity };
        t.y0 = Math.min(t.y0, a, b); t.y1 = Math.max(t.y1, a, b); trunkIv.set(key, t);
      };
      const chanOf = new Map<string, number | null>();
      const usedChans: number[] = [];
      for (const p of samePipes.filter((q) => laneIdx(q.from) === li)) {
        const dp = byName.get(p.from)!.depth, dc = byName.get(p.to)!.depth;
        let chan: number | null = null;
        if (dc - dp > 1) {
          // the channel a long edge rides across the skipped generations: the free
          // horizontal nearest the midpoint that stays clear of every name tag
          // (≥ half a two-line tag + a tube) of the columns it crosses
          const mid = (ly(cyO(p.from)) + ly(cyO(p.to))) / 2;
          const blockers = ns.filter((n) => n.depth > dp && n.depth < dc).map((n) => ly(cyO(n.name)));
          const clearW = u(22);
          let bestC = mid, bestD = Infinity;
          for (let yy = ly(lane.y) + u(8); yy <= ly(lane.y + lane.h) - u(8); yy += u(2)) {
            if (blockers.some((b) => Math.abs(b - yy) < clearW) || usedChans.some((c) => Math.abs(c - yy) < u(9))) continue;
            const d = Math.abs(yy - mid);
            if (d < bestD) { bestD = d; bestC = yy; }
          }
          chan = bestC;
          usedChans.push(bestC);
        }
        chanOf.set(`${p.from}->${p.to}`, chan);
        grow(`o:${p.from}`, dp, ly(cyO(p.from)), chan ?? ly(cyO(p.to)));
        if (chan !== null) grow(`i:${p.to}`, dc - 1, chan, ly(cyO(p.to)));
      }
      const trackOf = new Map<string, number>();
      const tracksIn = new Map<number, number>();
      for (const g of new Set([...trunkIv.values()].map((t) => t.g))) {
        const list = [...trunkIv.entries()].filter(([, t]) => t.g === g)
          .sort(([ka, a], [kb, b]) => (b.y1 - b.y0) - (a.y1 - a.y0) || a.y0 - b.y0 || (ka < kb ? -1 : 1));
        const tracks: [number, number][][] = [];
        for (const [key, t] of list) {
          let i = tracks.findIndex((iv) => iv.every(([a, b]) => t.y1 < a - u(6) || t.y0 > b + u(6)));
          if (i < 0) { i = tracks.length; tracks.push([]); }
          tracks[i].push([t.y0, t.y1]);
          trackOf.set(key, i);
        }
        tracksIn.set(g, tracks.length);
      }
      // columns: creature, then the widest name slot of the column, then its trunks
      const colX = new Map<number, number>();
      const trunkX0 = new Map<number, number>();
      let x = u(PAD_SIDE) + R;
      let right = 0;
      const heads: { depth: number; x: number }[] = [];
      for (const d of depths) {
        colX.set(d, x);
        heads.push({ depth: d, x });
        const slot = Math.max(...ns.filter((n) => n.depth === d).map((n) => u(slotPx(n.name, d === 0))));
        const end = x + R + u(GAP) + slot;
        right = Math.max(right, end);
        const nt = tracksIn.get(d) ?? 0;
        trunkX0.set(d, end + u(GUTTER_PAD));
        x = end + u(GUTTER_PAD) + Math.max(0, nt - 1) * u(TRACK) + u(GUTTER_PAD) + R + u(GAP);
      }
      const nodes: BNode[] = ns.map((n) => {
        const cx = colX.get(n.depth)!;
        return { name: n.name, family: n.family, depth: n.depth, lane: li, col: n.col, x: cx, y: ly(cyO(n.name)),
          slotStart: cx + R + u(GAP), slotEnd: cx + R + u(GAP) + u(slotPx(n.name, n.depth === 0)) };
      });
      const at = new Map(nodes.map((n) => [n.name, n]));
      const tx = (key: string, g: number) => trunkX0.get(g)! + (trackOf.get(key) ?? 0) * u(TRACK);
      const pipes: BPipe[] = samePipes.filter((q) => laneIdx(q.from) === li).map((p) => {
        const a = at.get(p.from)!, b = at.get(p.to)!;
        const id = `${p.from}->${p.to}`;
        const chan = chanOf.get(id) ?? null;
        const t1 = tx(`o:${p.from}`, a.depth);
        const pts: Pt[] = chan === null
          ? [{ x: a.slotEnd, y: a.y }, { x: t1, y: a.y }, { x: t1, y: b.y }, { x: b.x, y: b.y }]
          : [{ x: a.slotEnd, y: a.y }, { x: t1, y: a.y }, { x: t1, y: chan }, { x: tx(`i:${p.to}`, b.depth - 1), y: chan },
            { x: tx(`i:${p.to}`, b.depth - 1), y: b.y }, { x: b.x, y: b.y }];
        return { id, from: p.from, to: p.to, pts, crossLane: false };
      });
      const w = right + u(PAD_SIDE);
      const h = u(PAD_TOP) + lane.h * ay + u(PAD_BOTTOM) - 20 * ay;
      return { lane: li, w, h, nodes, pipes, heads };
    });

    // ——— pack blocks to fit the design screen: 1–2 columns, each a stack of
    // shelves (narrow blocks share a shelf side by side); best scale wins ———
    const gap = u(BLOCK_GAP);
    let best: { s: number; place: Map<number, Pt>; W: number; H: number } | null = null;
    const n = locals.length;
    const shelfPack = (ids: number[], colW: number) => {
      const place = new Map<number, Pt>();
      let y = 0, x = 0, shelfH = 0;
      for (const li of ids) {
        const b = locals[li];
        if (x > 0 && x + b.w > colW + 1e-6) { y += shelfH + gap; x = 0; shelfH = 0; }
        place.set(li, { x, y });
        x += b.w + gap;
        shelfH = Math.max(shelfH, b.h);
      }
      return { place, h: y + shelfH };
    };
    for (let mask = 0; mask < (columns === 1 ? 1 : 1 << n); mask++) {
      const cols = [0, 1].map((c) => locals.map((l) => l.lane).filter((li) => ((mask >> li) & 1) === c));
      if (cols[0].length === 0) continue;
      const used = cols.filter((c) => c.length > 0);
      let x0 = 0, H = 0;
      const place = new Map<number, Pt>();
      for (const ids of used) {
        const colW = Math.max(...ids.map((li) => locals[li].w));
        // try a few orders inside the column: lane order, tallest first
        const variants = [ids, [...ids].sort((a, b) => locals[b].h - locals[a].h), [...ids].sort((a, b) => locals[b].w - locals[a].w)];
        let bestV: { place: Map<number, Pt>; h: number } | null = null;
        for (const v of variants) { const r = shelfPack(v, colW); if (!bestV || r.h < bestV.h) bestV = r; }
        for (const [li, p] of bestV!.place) place.set(li, { x: p.x + x0, y: p.y });
        H = Math.max(H, bestV!.h);
        x0 += colW + gap;
      }
      const W = x0 - gap;
      const s = Math.min(DESIGN.w / W, DESIGN.h / H);
      if (!best || s > best.s + 1e-9) best = { s, place, W, H };
    }
    const place = best!.place;
    const list: BNode[] = [];
    const pipes: BPipe[] = [];
    const lanes: BLane[] = [];
    const heads: Board["heads"] = [];
    for (const l of locals) {
      const o = place.get(l.lane)!;
      lanes.push({ family: flow.lanes[l.lane].family, index: l.lane, x: o.x, y: o.y, w: l.w, h: l.h, cols: l.heads.map((h) => h.depth) });
      for (const n of l.nodes) list.push({ ...n, x: n.x + o.x, y: n.y + o.y, slotStart: n.slotStart + o.x, slotEnd: n.slotEnd + o.x });
      for (const p of l.pipes) pipes.push({ ...p, pts: p.pts.map((q) => ({ x: q.x + o.x, y: q.y + o.y })) });
      for (const h of l.heads) heads.push({ lane: l.lane, depth: h.depth, x: h.x + o.x, y: o.y + u(PAD_TOP) * 0.42 });
    }
    // cross-family edges: drawn only when lit — a smooth arc between the two creatures
    const nodes = new Map(list.map((n) => [n.name, n]));
    for (const p of flow.pipes.filter((q) => laneIdx(q.from) !== laneIdx(q.to))) {
      const a = nodes.get(p.from)!, b = nodes.get(p.to)!;
      const A = { x: a.slotEnd, y: a.y }, B = { x: b.x - R, y: b.y };
      const dx = Math.max(u(80), Math.abs(B.x - A.x) * 0.45);
      const c1 = { x: A.x + dx, y: A.y }, c2 = { x: B.x - dx, y: B.y };
      const pts: Pt[] = [];
      for (let i = 0; i <= 28; i++) {
        const t = i / 28, m = 1 - t;
        pts.push({
          x: m * m * m * A.x + 3 * m * m * t * c1.x + 3 * m * t * t * c2.x + t * t * t * B.x,
          y: m * m * m * A.y + 3 * m * m * t * c1.y + 3 * m * t * t * c2.y + t * t * t * B.y,
        });
      }
      pts.push({ x: b.x, y: b.y });
      pipes.push({ id: `${p.from}->${p.to}`, from: p.from, to: p.to, pts, crossLane: true });
    }
    const width = best!.W, height = best!.H;
    out = {
      nodes, list, lanes, pipes, width, height, s0, R, heads,
      next: { x: width + u(220), y: height / 2 - u(150), w: u(560), h: u(300) },
      ruins: { x: -u(220) - u(640), y: height / 2 - u(230), w: u(640), h: u(460) },
    };
  }
  void children;
  return out!;
}
