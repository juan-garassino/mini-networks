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
export interface BLane {
  family: string; index: number; x: number; y: number; w: number; h: number; cols: number[];
  /** stepped outline hugging the occupied columns: [x0, x1, y0, y1] per column band (world) */
  steps: [number, number, number, number][];
}
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
  /** creature size in px at the overview design */
  cpx: number;
  /** leftover cells of the packing (world boxes) — filled with map cartouches */
  slots: Box[];
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
  tagLines: (name: string) => number = () => 1,
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
    type Local = { lane: number; w: number; h: number; nodes: BNode[]; pipes: BPipe[]; heads: { depth: number; x: number }[]; steps: [number, number, number, number][] };
    // fit (pass 2): the tray's final size after packing edge to edge — extra width
    // opens the gutters evenly, extra height spreads the rows (≤1.8×) then centres
    const buildLocal = (li: number, fit?: { w: number; h: number }): Local => {
      const lane = flow.lanes[li];
      const ns = flow.nodes.filter((n) => n.lane === li);
      const depths = [...new Set(ns.map((n) => n.depth))].sort((a, b) => a - b);
      const inner0 = lane.h * ay - 20 * ay;
      const ayF = fit ? ay * Math.min(1.8, Math.max(1, (fit.h - u(PAD_TOP) - u(PAD_BOTTOM)) / Math.max(1, inner0))) : ay;
      const dyF = fit ? Math.max(0, (fit.h - (u(PAD_TOP) + lane.h * ayF + u(PAD_BOTTOM) - 20 * ayF)) / 2) : 0;
      const ly = (y: number) => u(PAD_TOP) + dyF + (y - lane.y) * ayF;
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
          const blockers = ns.filter((n) => n.depth > dp && n.depth < dc)
            .map((n) => ({ y: ly(cyO(n.name)), clear: u((tagLines(n.name) * 14.6 + 9) / 2 + 5) }));
          let bestC = mid, bestD = Infinity;
          for (let yy = ly(lane.y) + u(8); yy <= ly(lane.y + lane.h) - u(8); yy += u(1)) {
            if (blockers.some((b) => Math.abs(b.y - yy) < b.clear) || usedChans.some((c) => Math.abs(c - yy) < u(7))) continue;
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
      const extraX = fit ? Math.max(0, fit.w - natural(li)) / depths.length : 0;
      let x = u(PAD_SIDE) + R + extraX * 0.35;
      let right = 0;
      const heads: { depth: number; x: number }[] = [];
      for (const d of depths) {
        colX.set(d, x);
        heads.push({ depth: d, x });
        const slot = Math.max(...ns.filter((n) => n.depth === d).map((n) => u(slotPx(n.name, d === 0))));
        const end = x + R + u(GAP) + slot;
        right = Math.max(right, end);
        const nt = tracksIn.get(d) ?? 0;
        trunkX0.set(d, end + u(GUTTER_PAD) + extraX * 0.3);
        x = end + u(GUTTER_PAD) + Math.max(0, nt - 1) * u(TRACK) + u(GUTTER_PAD) + R + u(GAP) + extraX;
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
      const w = fit ? fit.w : right + u(PAD_SIDE);
      const h = fit ? fit.h : u(PAD_TOP) + lane.h * ay + u(PAD_BOTTOM) - 20 * ay;
      // full tray: packed edge to edge with its neighbours (no dead corners)
      const steps: [number, number, number, number][] = depths.map(() => [0, w, 0, h]);
      return { lane: li, w, h, nodes, pipes, heads, steps };
    };
    const naturalW = new Map<number, number>();
    const natural = (li: number) => naturalW.get(li)!;
    const locals0: Local[] = flow.lanes.map((_, li) => buildLocal(li));
    locals0.forEach((l) => naturalW.set(l.lane, l.w));
    const locals = locals0;

    // ——— pack blocks to fit the design screen: 1–2 columns, each a stack of
    // shelves (narrow blocks share a shelf side by side); best scale wins ———
    const gap = u(BLOCK_GAP);
    type Shelf = { y: number; h: number; ids: number[] };
    type Col = { x: number; w: number; shelves: Shelf[] };
    let best: { s: number; place: Map<number, Pt>; W: number; H: number; cols: Col[] } | null = null;
    const n = locals.length;
    const shelfPack = (ids: number[], colW: number) => {
      const place = new Map<number, Pt>();
      const shelves: Shelf[] = [];
      let y = 0, x = 0, shelfH = 0, cur: number[] = [];
      for (const li of ids) {
        const b = locals[li];
        if (x > 0 && x + b.w > colW + 1e-6) { shelves.push({ y, h: shelfH, ids: cur }); y += shelfH + gap; x = 0; shelfH = 0; cur = []; }
        place.set(li, { x, y });
        cur.push(li);
        x += b.w + gap;
        shelfH = Math.max(shelfH, b.h);
      }
      shelves.push({ y, h: shelfH, ids: cur });
      return { place, h: y + shelfH, shelves };
    };
    for (let mask = 0; mask < (columns === 1 ? 1 : 1 << n); mask++) {
      const cols = [0, 1].map((c) => locals.map((l) => l.lane).filter((li) => ((mask >> li) & 1) === c));
      if (cols[0].length === 0) continue;
      const used = cols.filter((c) => c.length > 0);
      let x0 = 0, H = 0;
      const place = new Map<number, Pt>();
      const colsOut: Col[] = [];
      for (const ids of used) {
        const colW = Math.max(...ids.map((li) => locals[li].w));
        // try a few orders inside the column: lane order, tallest first
        const variants = [ids, [...ids].sort((a, b) => locals[b].h - locals[a].h), [...ids].sort((a, b) => locals[b].w - locals[a].w)];
        let bestV: ReturnType<typeof shelfPack> | null = null;
        for (const v of variants) { const r = shelfPack(v, colW); if (!bestV || r.h < bestV.h) bestV = r; }
        for (const [li, p] of bestV!.place) place.set(li, { x: p.x + x0, y: p.y });
        H = Math.max(H, bestV!.h);
        colsOut.push({ x: x0, w: colW, shelves: bestV!.shelves });
        x0 += colW + gap;
      }
      const W = x0 - gap;
      const s = Math.min(DESIGN.w / W, DESIGN.h / H);
      if (!best || s > best.s + 1e-9) best = { s, place, W, H, cols: colsOut };
    }
    // ——— pass 2: grow the packing to the screen's aspect and every tray to its cell ———
    const A = DESIGN.w / DESIGN.h;
    let Wt = best!.W, Ht = best!.H;
    if (Wt / Ht < A) Wt = Ht * A; else Ht = Wt / A;
    const cols = best!.cols;
    const sumColW = cols.reduce((a, c) => a + c.w, 0);
    const extraW = Wt - best!.W;
    const place = new Map<number, Pt>();
    const fits = new Map<number, { w: number; h: number }>();
    const slots: Box[] = [];
    let cx0 = 0;
    for (const c of cols) {
      const cw = c.w + extraW * (c.w / sumColW);
      const colH = c.shelves.reduce((a, sh) => a + sh.h, 0) + gap * (c.shelves.length - 1);
      const sumSh = c.shelves.reduce((a, sh) => a + sh.h, 0);
      let sy = 0;
      for (const sh of c.shelves) {
        const shH = sh.h + (Ht - colH) * (sh.h / sumSh);
        const sumW = sh.ids.reduce((a, li) => a + locals[li].w, 0);
        const free = cw - sumW - gap * (sh.ids.length - 1);
        let sx = cx0;
        for (const li of sh.ids) {
          let tw = locals[li].w + free * (locals[li].w / sumW);
          // a tray that would be mostly empty keeps a snug width; the rest of its
          // cell becomes a map cartouche (key, compass, sea glimpse)
          if (tw - locals[li].w > u(230) && tw > locals[li].w * 1.4) {
            const keep = locals[li].w + u(24);
            slots.push({ x: sx + keep + gap, y: sy, w: tw - keep - gap, h: shH });
            tw = keep;
          }
          place.set(li, { x: sx, y: sy });
          fits.set(li, { w: tw, h: shH });
          sx += tw + gap;
        }
        sy += shH + gap;
      }
      cx0 += cw + gap;
    }
    best!.W = Wt; best!.H = Ht;
    const fitted = flow.lanes.map((_, li) => buildLocal(li, fits.get(li)));
    const list: BNode[] = [];
    const pipes: BPipe[] = [];
    const lanes: BLane[] = [];
    const heads: Board["heads"] = [];
    for (const l of fitted) {
      const o = place.get(l.lane)!;
      lanes.push({ family: flow.lanes[l.lane].family, index: l.lane, x: o.x, y: o.y, w: l.w, h: l.h, cols: l.heads.map((h) => h.depth),
        steps: l.steps.map(([a, b, c, d]) => [a + o.x, b + o.x, c + o.y, d + o.y]) });
      for (const n of l.nodes) list.push({ ...n, x: n.x + o.x, y: n.y + o.y, slotStart: n.slotStart + o.x, slotEnd: n.slotEnd + o.x });
      for (const p of l.pipes) pipes.push({ ...p, pts: p.pts.map((q) => ({ x: q.x + o.x, y: q.y + o.y })) });
      l.heads.forEach((h, i) => heads.push({ lane: l.lane, depth: h.depth, x: h.x + o.x, y: l.steps[i][2] + o.y + u(PAD_TOP) * 0.42 }));
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
      nodes, list, lanes, pipes, width, height, s0, R, heads, cpx: CREATURE, slots,
      next: { x: width + u(90), y: height / 2 - u(150), w: u(320), h: u(300) },
      ruins: { x: -u(90) - u(340), y: height / 2 - u(230), w: u(340), h: u(460) },
    };
  }
  void children;
  return out!;
}

// ——— phone layout: a vertical scroll of trays, each exactly the screen's width.
// Inside a tray the generations stack top → bottom (Atoms band, Gen 1 band, …);
// a band is a grid of creature + name cells (two per row, one when a name is
// long). Same-family pipes leave a creature on its left, drop down the column
// margin to the corridor under the band and run across to the child's margin.
const M = { W: 374, CRE: 40, GAP: 6, MARGIN: 22, ROW: 50, BAND_HEAD: 20, CORRIDOR: 16, PAD_TOP: 30, PAD_BOTTOM: 30, TRAY_GAP: 34 };
export function layoutMobile(
  flow: FlowLayout,
  slotPx: (name: string, atom: boolean) => number,
): Board {
  const s0 = 0.535;
  const u = (px: number) => px / s0;
  const R = u(M.CRE / 2);
  const byName = new Map(flow.nodes.map((n) => [n.name, n]));
  const cyO = (n: string) => byName.get(n)!.box.y;
  const trayW = u(M.W);
  const cellW = (trayW - u(8)) / 2;               // two cells per row
  const slotMax = cellW - u(M.MARGIN + M.CRE + M.GAP + 6);
  const list: BNode[] = [];
  const lanes: BLane[] = [];
  const heads: Board["heads"] = [];
  const pipes: BPipe[] = [];
  let y = 0;
  flow.lanes.forEach((lane, li) => {
    const ns = flow.nodes.filter((n) => n.lane === li);
    const depths = [...new Set(ns.map((n) => n.depth))].sort((a, b) => a - b);
    const top = y;
    let cy = y + u(M.PAD_TOP);
    const bandBottom = new Map<number, number>();
    const steps: [number, number, number, number][] = [];
    for (const d of depths) {
      const inBand = ns.filter((n) => n.depth === d).sort((a, b) => cyO(a.name) - cyO(b.name));
      heads.push({ lane: li, depth: d, x: u(M.MARGIN + 30), y: cy + u(8) });
      cy += u(M.BAND_HEAD);
      let col = 0;
      let rowY = cy + u(M.ROW / 2);
      for (const n of inBand) {
        const slot = u(slotPx(n.name, d === 0));
        const wide = slot > slotMax;
        if (col === 1 && wide) { col = 0; rowY += u(M.ROW); }
        const cellX = u(4) + col * cellW;
        const x = cellX + u(M.MARGIN) + R;
        list.push({ name: n.name, family: n.family, depth: d, lane: li, col: n.col, x, y: rowY,
          slotStart: x + R + u(M.GAP), slotEnd: x + R + u(M.GAP) + slot });
        if (wide || col === 1) { col = 0; rowY += u(M.ROW); } else col = 1;
      }
      const bottom = (col === 0 ? rowY - u(M.ROW / 2) : rowY + u(M.ROW / 2));
      bandBottom.set(d, bottom);
      cy = bottom + u(M.CORRIDOR);
    }
    const h = cy - top + u(M.PAD_BOTTOM) - u(M.CORRIDOR);
    steps.push([0, trayW, top, top + h]);
    lanes.push({ family: lane.family, index: li, x: 0, y: top, w: trayW, h, cols: depths, steps });
    y = top + h + u(M.TRAY_GAP);
  });
  const nodes = new Map(list.map((n) => [n.name, n]));
  // same-family pipes: left margin → corridor under the parent's band → child's margin → child
  const laneOf = (n: string) => byName.get(n)!.lane;
  const lanesBy = new Map(lanes.map((l) => [l.index, l]));
  const corridorY = (li: number, d: number) => {
    const l = lanesBy.get(li)!;
    const lower = list.filter((n) => n.lane === li && n.depth === d).map((n) => n.y);
    return Math.max(...lower) + R + u(M.CORRIDOR * 0.45) + (l ? 0 : 0);
  };
  for (const p of flow.pipes) {
    const a = nodes.get(p.from)!, b = nodes.get(p.to)!;
    if (laneOf(p.from) !== laneOf(p.to)) {
      const A = { x: a.x - R, y: a.y }, B = { x: b.x - R, y: b.y };
      const dx = Math.max(u(60), Math.abs(B.y - A.y) * 0.25);
      const pts: Pt[] = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24, m = 1 - t;
        const c1 = { x: A.x - dx, y: A.y }, c2 = { x: B.x - dx, y: B.y };
        pts.push({ x: m * m * m * A.x + 3 * m * m * t * c1.x + 3 * m * t * t * c2.x + t * t * t * B.x,
          y: m * m * m * A.y + 3 * m * m * t * c1.y + 3 * m * t * t * c2.y + t * t * t * B.y });
      }
      pts.push({ x: b.x, y: b.y });
      pipes.push({ id: `${p.from}->${p.to}`, from: p.from, to: p.to, pts, crossLane: true });
      continue;
    }
    const mA = a.x - R - u(9), mB = b.x - R - u(9);
    const cy = corridorY(a.lane, a.depth);
    pipes.push({ id: `${p.from}->${p.to}`, from: p.from, to: p.to, crossLane: false,
      pts: [{ x: a.x, y: a.y }, { x: mA, y: a.y }, { x: mA, y: cy }, { x: mB, y: cy }, { x: mB, y: b.y }, { x: b.x, y: b.y }] });
  }
  const width = trayW, height = y - u(M.TRAY_GAP);
  return {
    nodes, list, lanes, pipes, width, height, s0, R, heads, cpx: M.CRE, slots: [],
    next: { x: 0, y: height + u(60), w: trayW, h: u(300) },
    ruins: { x: 0, y: height + u(400), w: trayW, h: u(460) },
  };
}
