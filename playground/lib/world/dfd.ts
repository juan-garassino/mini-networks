// buildDfd — the "Kawaii DFD" sheet for /lab/flow: every model is a box on a
// strict grid (desktop: two stacks of family lanes × 4 generation columns;
// phone: one stack, generations top → bottom, two box columns), and every
// builds_on edge is routed ORTHOGONALLY on an 8-px track grid so that no two
// edges of different sources cross, touch or run on top of each other, and no
// edge passes within 8 px of a box. The router is a maze router (A* over the
// track grid, bend-penalised) that grows one Steiner tree per source: a
// source's fan-out shares one trunk and splits on T-junctions. Vertical runs
// are only allowed in the gutters between box columns (plus the last two
// steps into a top port); horizontal runs only where no box is. An edge that
// still cannot be routed becomes an off-sheet connector pair (budget 2).
//
// Pure and deterministic: models are sorted by name before anything happens,
// so the input order never matters. No DOM — the caller passes `measure`.
import type { TaxonomyResponse } from "../types.ts";
import type { FamilyMap, Pt } from "./types.ts";
import { buildGraph, type Graph } from "./graph.ts";
import { mulberry32 } from "./rng.ts";

/** Track grid pitch (px at the overview): the gap between parallel tracks and the box clearance. */
export const DFD_G = 8;
/** The one elbow radius of every edge (≤ G/2, so two bends one track apart never clamp it). */
export const DFD_R = 4;
export const DFD_BOX_H = 40;
/** Header strip height inside a box (address + evidence glyph). */
export const DFD_STRIP = 12;
export const DFD_NAME_PX = 13;
export const DFD_LABEL_PX = 11;
/** Off-sheet connector budget (edges that could not be routed crossing-free). */
export const DFD_OFFSHEET_MAX = 2;

/** An atom is drawn as a DFD store: its index cell (the atom number) sits left of the creature. */
export const DFD_ATOM_CELL = 24;

const G = DFD_G;
// box chrome around the name: left pad · creature · gap · right pad (atoms add their index cell)
const BOX_CHROME = 6 + 24 + 6 + 8;

// desktop sheet
const D = {
  rowPitch: 56, // box 40 + row gap 16 (one track at the gap's centre line)
  laneHead: 24, // swim-lane label band above a lane's first row
  headRow: 16, // the column header row (Atoms / Gen 1 …)
  topChan: 16,
  bottom: 16,
  gutter: 40, // 4 tracks between generation columns
  margin: 32,
  corridor: 48, // between the two stacks: 5 tracks
};
// phone sheet (one box column between two routing gutters)
const M = {
  width: 376, // 47 tracks; shown at scale 1 on a 390-px phone
  rowPitch: 56,
  laneHead: 32,
  laneGap: 16,
  top: 8,
  iters: 3000,
};

export type DfdMode = "desktop" | "mobile";
export type DfdSide = "left" | "right" | "top" | "bottom";
type Rect = { x: number; y: number; w: number; h: number };

export interface DfdBox extends Rect {
  name: string;
  family: string;
  depth: number;
  atom: boolean;
  stack: number;
  lane: number;
  /** generation column (desktop) / box column 0–1 (phone) */
  col: number;
  /** row inside the lane (desktop) or inside the generation band (phone) */
  row: number;
  /** the name as 1–2 lines, as measured */
  lines: string[];
  /** lineage address: atoms 1…n, derived <primary parent>.<k> */
  address: string;
}
export interface DfdLane extends Rect {
  family: string;
  stack: number;
  count: number;
  /** where the swim-lane label sits (also an obstacle for the router) */
  label: Rect;
}
export interface DfdHeader { text: string; x: number; y: number; w: number; depth: number; stack: number }
export interface DfdEdge {
  from: string;
  to: string;
  cross: boolean;
  /** orthogonal polyline, out-port → in-port (empty for an off-sheet edge) */
  points: Pt[];
  side: DfdSide;
  offSheet: boolean;
}
export interface DfdLabel extends Rect {
  text: string;
  /** "from->to" of every edge that runs through the label's gap */
  edges: string[];
  /** the run the gap is cut in: horizontal (text on the line) or vertical (text across it) */
  along: "h" | "v";
}
export interface DfdOffSheet { from: string; to: string; outText: string; inText: string; out: Rect; in: Rect; stubOut: Pt[]; stubIn: Pt[] }
export interface DfdAudit {
  crossings: number;
  overlaps: number;
  boxHits: number;
  labelHits: number;
  /** cross-family edges without an inline label */
  unlabelled: number;
  nonOrthogonal: number;
}
export interface DfdLayout {
  mode: DfdMode;
  width: number;
  height: number;
  grid: number;
  radius: number;
  boxes: DfdBox[];
  lanes: DfdLane[];
  headers: DfdHeader[];
  edges: DfdEdge[];
  labels: DfdLabel[];
  offSheet: DfdOffSheet[];
  /** stacks, left → right (desktop) / the one stack (phone): families top → bottom */
  stacks: string[][];
  audit: DfdAudit;
  /** routing attempts made before this one was kept (diagnostic) */
  attempts: number;
}
export interface DfdOptions {
  mode: DfdMode;
  /** text width in px for `px`-sized M PLUS Rounded 700 (default: an estimate) */
  measure?: (text: string, px: number) => number;
  /** widest the desktop sheet may be (default 1424) */
  maxWidth?: number;
}

const approxMeasure = (t: string, px: number) => t.length * px * 0.6;
const words = (n: string) => n.replace(/_/g, " ");
const up8 = (v: number) => Math.ceil(v / G) * G;

/** A name as one line, or as the two-line split with the shortest longest line. */
export function wrapName(text: string): string[][] {
  const out: string[][] = [[text]];
  const w = text.split(" ");
  for (let i = 1; i < w.length; i++) out.push([w.slice(0, i).join(" "), w.slice(i).join(" ")]);
  return out;
}

// ———————————————————————————————————————— addresses

/** Lineage addresses: atoms 1…n in family order (most-built-on first), derived models
 * <primary parent's address>.<k> ordered by descendant count. Mode-independent. */
export function lineageAddresses(g: Graph): Map<string, string> {
  const desc = new Map<string, number>();
  const count = (n: string, seen: Set<string>): number => {
    if (desc.has(n)) return desc.get(n)!;
    let c = 0;
    for (const k of g.children.get(n)!) if (!seen.has(k)) { seen.add(k); c += 1 + count(k, seen); }
    desc.set(n, c);
    return c;
  };
  for (const n of g.names) count(n, new Set([n]));
  const byDesc = (a: string, b: string) => desc.get(b)! - desc.get(a)! || (a < b ? -1 : 1);
  const addr = new Map<string, string>();
  let k = 0;
  for (const f of g.families) {
    for (const n of g.membersOf.get(f)!.filter((m) => g.atom.get(m)).sort(byDesc)) addr.set(n, String(++k));
  }
  const visit = (p: string) => {
    const kids = g.primaryChildren.get(p)!.filter((c) => !addr.has(c)).sort(byDesc);
    kids.forEach((c, i) => addr.set(c, `${addr.get(p)}.${i + 1}`));
    kids.forEach(visit);
  };
  for (const n of [...addr.keys()]) visit(n);
  // anything left (a cycle cut by buildGraph) gets a trailing number
  for (const n of g.names) if (!addr.has(n)) addr.set(n, String(++k));
  return addr;
}

// ———————————————————————————————————————— ordering (rows inside lanes)

type Cells = Map<string, string[][]>; // family → [depth] → names in order

function cellsOf(g: Graph, depthCount: number): Cells {
  const cells: Cells = new Map();
  for (const f of g.families) cells.set(f, Array.from({ length: depthCount }, () => []));
  for (const n of g.names) cells.get(g.family.get(n)!)![g.depth.get(n)!].push(n);
  return cells;
}

/** Strictly increasing integer rows in [0, R) for desired positions d (in order), minimising Σ|r − d|. */
function assignSlots(d: number[], R: number): number[] {
  const k = d.length;
  if (k === 0) return [];
  const INF = 1e9;
  const f: number[][] = Array.from({ length: k }, () => new Array(R).fill(INF));
  const from: number[][] = Array.from({ length: k }, () => new Array(R).fill(-1));
  for (let r = 0; r < R; r++) f[0][r] = Math.abs(r - d[0]);
  for (let i = 1; i < k; i++) {
    let best = INF, bi = -1;
    for (let r = 0; r < R; r++) {
      if (r - 1 >= 0 && f[i - 1][r - 1] < best) { best = f[i - 1][r - 1]; bi = r - 1; }
      if (bi >= 0) { f[i][r] = best + Math.abs(r - d[i]); from[i][r] = bi; }
    }
  }
  let r = 0;
  for (let q = 1; q < R; q++) if (f[k - 1][q] < f[k - 1][r]) r = q;
  const out = new Array(k);
  for (let i = k - 1; i >= 0; i--) { out[i] = r; r = from[i][r]; }
  return out;
}

interface Arrangement { stacks: string[][] }

/** Desktop rows: barycentric sweeps with slot assignment, scored by straight-line crossings. */
function orderDesktop(g: Graph, arr: Arrangement, sweeps: number): Map<string, number> {
  const cells = cellsOf(g, 4);
  const R = new Map<string, number>();
  for (const f of g.families) R.set(f, Math.max(1, ...cells.get(f)!.map((c) => c.length)));
  const laneStart = new Map<string, number>();
  const stackOf = new Map<string, number>();
  arr.stacks.forEach((st, s) => { let y = 0; for (const f of st) { laneStart.set(f, y); stackOf.set(f, s); y += R.get(f)! + 0.45; } });
  const row = new Map<string, number>();
  const yIdx = (n: string) => laneStart.get(g.family.get(n)!)! + row.get(n)!;
  // seed: atoms by descendant fan-out, derived grouped by primary parent
  for (const f of g.families) {
    for (const cell of cells.get(f)!) {
      cell.sort((a, b) => {
        const pa = g.primary.get(a) ?? "", pb = g.primary.get(b) ?? "";
        return pa < pb ? -1 : pa > pb ? 1 : a < b ? -1 : 1;
      });
      const off = Math.floor((R.get(f)! - cell.length) / 2);
      cell.forEach((n, i) => row.set(n, off + i));
    }
  }
  const mean = (ns: string[]) => (ns.length ? ns.reduce((s, n) => s + yIdx(n), 0) / ns.length : null);
  const place = (f: string, cell: string[], key: (n: string) => number | null) => {
    const ls = laneStart.get(f)!;
    const want = new Map(cell.map((n) => [n, (key(n) ?? yIdx(n)) - ls]));
    const idx = new Map(cell.map((n, i) => [n, i]));
    cell.sort((a, b) => want.get(a)! - want.get(b)! || idx.get(a)! - idx.get(b)!);
    const rows = assignSlots(cell.map((n) => want.get(n)!), R.get(f)!);
    cell.forEach((n, i) => row.set(n, rows[i]));
  };
  const score = () => {
    // straight segments in (column, row) space, adjacent-or-long, same stack only
    const segs = g.edges.filter((e) => stackOf.get(g.family.get(e.from)!) === stackOf.get(g.family.get(e.to)!))
      .map((e) => ({ e, a: { x: g.depth.get(e.from)! + 0.5, y: yIdx(e.from) }, b: { x: g.depth.get(e.to)!, y: yIdx(e.to) } }));
    let k = 0;
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const p = segs[i], q = segs[j];
        if (p.e.from === q.e.from || p.e.to === q.e.to) continue;
        if (segCrossProper(p.a, p.b, q.a, q.b)) k++;
      }
    }
    // keep each parent level with its children: Σ |row(parent) − row(child)|
    let L = 0;
    for (const e of g.edges) L += Math.abs(yIdx(e.from) - yIdx(e.to));
    return k * 100 + L;
  };
  let best = new Map(row), bestS = score();
  for (let s = 0; s < sweeps; s++) {
    const fwd = s % 2 === 0;
    const ds = fwd ? [1, 2, 3, 0] : [2, 1, 0, 3];
    for (const d of ds) {
      for (const f of g.families) {
        const cell = cells.get(f)![d];
        if (!cell.length) continue;
        place(f, cell, (n) => {
          const ps = g.parents.get(n)!, ks = g.children.get(n)!;
          if (fwd && d > 0 && ps.length) return mean(ps);
          return ks.length ? mean(ks) : ps.length ? mean(ps) : null;
        });
      }
    }
    const sc = score();
    if (sc < bestS) { bestS = sc; best = new Map(row); }
  }
  return best;
}

// ———————————————————————————————————————— geometry

interface Sheet {
  width: number;
  height: number;
  boxes: DfdBox[];
  lanes: DfdLane[];
  headers: DfdHeader[];
  /** x ranges of box columns: vertical runs are forbidden inside them (± clearance) */
  colBands: [number, number][];
  /** extra obstacles (labels, header text) */
  blocks: Rect[];
}

const COL_TITLES = ["Atoms", "Gen 1", "Gen 2", "Gen 3", "Gen 4", "Gen 5"];

function lanePx(px: number) { return px; }

function sheetDesktop(g: Graph, arr: Arrangement, rows: Map<string, number>, addr: Map<string, string>,
  measure: (t: string, px: number) => number, maxWidth: number): Sheet {
  const nCols = 4;
  // per stack, per column: the boxes; widths measured (wrap only when the sheet would be too wide)
  const need = (n: string, lines: string[]) => up8(Math.max(...lines.map((l) => measure(l, DFD_NAME_PX))) + BOX_CHROME + (g.atom.get(n) ? DFD_ATOM_CELL : 0));
  const choice = new Map<string, string[]>();
  for (const n of g.names) choice.set(n, [words(n)]);
  const colW = () => arr.stacks.map((st) => Array.from({ length: nCols }, (_, c) => {
    const ns = g.names.filter((n) => st.includes(g.family.get(n)!) && g.depth.get(n) === c);
    const minW = up8(measure(COL_TITLES[c], 12) + 8);
    return Math.max(minW, 96, ...ns.map((n) => need(n, choice.get(n)!)));
  }));
  const total = (w: number[][]) => D.margin * 2 + D.corridor * (arr.stacks.length - 1) + w.reduce((s, ws) => s + ws.reduce((a, b) => a + b, 0) + D.gutter * (nCols - 1), 0);
  let widths = colW();
  // wrap the names that save the most width first, until the sheet fits
  const cands = g.names.filter((n) => words(n).includes(" ")).map((n) => {
    const opts = wrapName(words(n)).slice(1);
    const best = opts.reduce((a, b) => (Math.max(...a.map((l) => measure(l, DFD_NAME_PX))) <= Math.max(...b.map((l) => measure(l, DFD_NAME_PX))) ? a : b));
    return { n, best, save: need(n, [words(n)]) - need(n, best) };
  }).sort((a, b) => b.save - a.save || (a.n < b.n ? -1 : 1));
  for (const c of cands) {
    if (total(widths) <= maxWidth) break;
    choice.set(c.n, c.best);
    widths = colW();
  }
  const R = new Map<string, number>();
  for (const f of g.families) {
    const cs = [0, 1, 2, 3].map((d) => g.names.filter((n) => g.family.get(n) === f && g.depth.get(n) === d).length);
    R.set(f, Math.max(1, ...cs));
  }
  const boxes: DfdBox[] = [], lanes: DfdLane[] = [], headers: DfdHeader[] = [], blocks: Rect[] = [];
  const colBands: [number, number][] = [];
  let x = D.margin;
  let height = 0;
  arr.stacks.forEach((st, s) => {
    const colX: number[] = [];
    widths[s].forEach((w, c) => { colX.push(x); colBands.push([x, x + w]); x += w + (c < nCols - 1 ? D.gutter : 0); });
    const stackW = x - colX[0];
    x += D.corridor;
    colX.forEach((cx, c) => {
      const w = up8(measure(COL_TITLES[c], 12));
      headers.push({ text: COL_TITLES[c], x: cx, y: 4, w, depth: c, stack: s });
      blocks.push({ x: cx - 2, y: 0, w: w + 4, h: 18 });
    });
    let y = D.headRow + D.topChan;
    for (const f of st) {
      const laneIdx = lanes.length;
      const count = g.membersOf.get(f)!.length;
      const lw = up8(measure(f, 13) + measure(` ${count}`, 12) + 16);
      const label = { x: colX[0], y: y + 3, w: lw, h: 16 };
      blocks.push(label);
      const top = y + D.laneHead;
      const h = D.laneHead + R.get(f)! * D.rowPitch;
      lanes.push({ family: f, stack: s, count, x: colX[0], y, w: stackW, h, label });
      for (const n of g.names.filter((m) => g.family.get(m) === f)) {
        const c = g.depth.get(n)!;
        const r = rows.get(n)!;
        boxes.push({
          name: n, family: f, depth: c, atom: g.atom.get(n)!, stack: s, lane: laneIdx, col: c, row: r,
          x: colX[c], y: top + r * D.rowPitch, w: widths[s][c], h: DFD_BOX_H, lines: choice.get(n)!, address: addr.get(n)!,
        });
      }
      y = top + R.get(f)! * D.rowPitch;
    }
    height = Math.max(height, y + D.bottom);
  });
  const width = x - D.corridor + D.margin;
  void lanePx;
  return { width, height: up8(height), boxes, lanes, headers, colBands, blocks };
}

// ———————————————————————————————————————— the phone sheet: a two-page channel router
//
// One box column; lanes stacked. Inside a lane the rows are a FILE TREE: the pre-order
// walk of the primary-parent tree, each model directly followed by its brood. Every
// edge runs in one of the two gutters ("pages"): out of its parent's side, along a
// vertical track, into its child's SAME side. A parent's edges on one page share one
// trunk (its net). On one page two nets can only meet where a stub of one passes the
// trunk of another that rides a track nearer the boxes — so the score counts exactly
// that. A seeded annealer picks the lane order, the sibling order, the page of every
// edge and (by rule) the port order on every box side, driving the count to zero, then
// fewer tracks, then shorter wire. Constructive and fast (well under a second), unlike
// the desktop maze router.

/** Pin slots (offsets inside a 40-px box) for 1–4 pins on one box side. */
const SLOTS = [[16], [16, 24], [8, 16, 24], [8, 16, 24, 32]];

interface PhoneEval {
  cost: number;
  faults: number;
  tracks: [number, number];
  /** y of every box top */
  top: Int32Array;
  /** per edge: track, port y at the parent, port y at the child */
  track: Int32Array;
  ys: Int32Array;
  yt: Int32Array;
  laneY: [number, number][];
  bottom: number;
}

class PhoneSearch {
  n: number;
  names: string[];
  laneOf: Int32Array;
  lanes: number[];          // lane order (family indices)
  roots: number[][];        // per family: root boxes in order
  kids: number[][];         // per box: same-family primary children in order
  ef: Int32Array; et: Int32Array; page: Int8Array;
  /** edges drawn as an off-sheet connector pair instead of a route */
  off: Uint8Array;
  m: number;
  g: Graph;
  constructor(g: Graph, addr: Map<string, string>) {
    this.g = g;
    this.names = g.names;
    this.n = g.names.length;
    const id = new Map(g.names.map((s, i) => [s, i]));
    const fams = g.families;
    this.laneOf = new Int32Array(this.n);
    g.names.forEach((s, i) => { this.laneOf[i] = fams.indexOf(g.family.get(s)!); });
    const byAddr = (a: string, b: string) => addr.get(a)!.localeCompare(addr.get(b)!, "en", { numeric: true });
    this.kids = g.names.map((s) => g.primaryChildren.get(s)!.filter((c) => g.family.get(c) === g.family.get(s)).sort(byAddr).map((c) => id.get(c)!));
    this.roots = fams.map((f) => g.membersOf.get(f)!.filter((s) => { const p = g.primary.get(s); return !p || g.family.get(p) !== f; }).sort(byAddr).map((s) => id.get(s)!));
    this.lanes = fams.map((_, i) => i);
    const es = [...g.edges].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : a.to < b.to ? -1 : 1));
    this.m = es.length;
    this.ef = new Int32Array(es.map((e) => id.get(e.from)!));
    this.et = new Int32Array(es.map((e) => id.get(e.to)!));
    // start: the primary tree in the left gutter, every other edge in the right one
    this.page = new Int8Array(es.map((e) => (e.primary && !e.cross ? 0 : 1)));
    this.off = new Uint8Array(this.m);
  }

  rows(): { top: Int32Array; laneY: [number, number][]; bottom: number } {
    const top = new Int32Array(this.n).fill(-1);
    const laneY: [number, number][] = [];
    let y = M.top;
    const walk = (b: number) => {
      if (top[b] >= 0) return;
      top[b] = y; y += M.rowPitch;
      for (const c of this.kids[b]) walk(c);
    };
    for (const l of this.lanes) {
      const y0 = y;
      y += M.laneHead;
      for (const r of this.roots[l]) walk(r);
      for (let b = 0; b < this.n; b++) if (this.laneOf[b] === l) walk(b); // a cycle's leftovers
      laneY[l] = [y0, y];
      y += M.laneGap;
    }
    return { top, laneY, bottom: y - M.laneGap };
  }

  // scratch buffers, reused by every eval (the annealer calls it thousands of times)
  private memb: number[][] = [];
  private side: number[][] = [];
  private pinY = new Int32Array(0);
  private y0 = new Float64Array(0);
  private y1 = new Float64Array(0);
  private trackOf = new Int32Array(0);

  eval(): PhoneEval {
    const { n, m, ef, et, page } = this;
    const N2 = n * 2;
    if (this.memb.length !== N2) {
      this.memb = Array.from({ length: N2 }, () => []);
      this.side = Array.from({ length: N2 }, () => []);
      this.pinY = new Int32Array(N2 * n);
      this.y0 = new Float64Array(N2); this.y1 = new Float64Array(N2);
      this.trackOf = new Int32Array(N2);
    }
    const { memb, side, pinY, y0, y1, trackOf } = this;
    const { top, laneY, bottom } = this.rows();
    for (let k = 0; k < N2; k++) { memb[k].length = 0; side[k].length = 0; }
    // nets: id = src * 2 + page; members = src + targets
    for (let i = 0; i < m; i++) {
      if (this.off[i]) continue;
      const k = ef[i] * 2 + page[i];
      if (!memb[k].length) memb[k].push(ef[i]);
      memb[k].push(et[i]);
    }
    const nets: number[] = [];
    for (let k = 0; k < N2; k++) {
      const bs = memb[k];
      if (!bs.length) continue;
      nets.push(k);
      let a1 = Infinity, a2 = Infinity, z1 = -Infinity, z2 = -Infinity;
      for (const b of bs) {
        const y = top[b];
        if (y < a1) { a2 = a1; a1 = y; } else if (y < a2) a2 = y;
        if (y > z1) { z2 = z1; z1 = y; } else if (y > z2) z2 = y;
      }
      for (const b of bs) {
        const by = top[b];
        const lo = by === a1 ? a2 : a1, hi = by === z1 ? z2 : z1;
        const cls = hi < by ? 0 : lo > by ? 2 : 1;
        // up: nearest reach first (largest lo); down: farthest reach first (largest hi)
        const key = cls === 0 ? -lo : cls === 2 ? -hi : 0;
        side[b * 2 + (k & 1)].push(((cls * 100000 + key + 50000) * 128) + k);
      }
    }
    let over = 0;
    y0.fill(Infinity); y1.fill(-Infinity);
    for (let s = 0; s < N2; s++) {
      const pins = side[s];
      const L = pins.length;
      if (!L) continue;
      for (let i = 1; i < L; i++) { const v = pins[i]; let j = i - 1; while (j >= 0 && pins[j] > v) { pins[j + 1] = pins[j]; j--; } pins[j + 1] = v; }
      const b = s >> 1;
      if (L > 4) over += L - 4;
      const sl = SLOTS[Math.min(4, L) - 1];
      for (let i = 0; i < L; i++) {
        const k = pins[i] % 128;
        const y = top[b] + sl[Math.min(i, sl.length - 1)];
        pinY[k * n + b] = y;
        if (y < y0[k]) y0[k] = y;
        if (y > y1[k]) y1[k] = y;
      }
    }
    // tracks per page: a net nested in another rides nearer the boxes
    const tracks: [number, number] = [0, 0];
    let faults = over, wire = 0;
    for (const pg of [0, 1]) {
      const ns = nets.filter((k) => (k & 1) === pg).sort((a, b) => y1[a] - y0[a] - (y1[b] - y0[b]) || y0[a] - y0[b] || a - b);
      for (let i = 0; i < ns.length; i++) {
        const k = ns[i];
        let t = 0;
        for (let j = 0; j < i; j++) { const o = ns[j]; if (y0[o] >= y0[k] && y1[o] <= y1[k] && trackOf[o] + 1 > t) t = trackOf[o] + 1; }
        for (let clash = true; clash; ) {
          clash = false;
          for (let j = 0; j < i; j++) { const o = ns[j]; if (trackOf[o] === t && y0[o] <= y1[k] + G && y0[k] <= y1[o] + G) { clash = true; t++; break; } }
        }
        trackOf[k] = t;
        if (t + 1 > tracks[pg]) tracks[pg] = t + 1;
      }
      for (const k of ns) {
        wire += y1[k] - y0[k];
        const tk = trackOf[k];
        for (const b of memb[k]) {
          const y = pinY[k * n + b];
          wire += (tk + 1) * G;
          for (const o of ns) if (trackOf[o] < tk && y >= y0[o] && y <= y1[o]) faults++;
        }
      }
    }
    const track = new Int32Array(m), ys = new Int32Array(m), yt = new Int32Array(m);
    for (let i = 0; i < m; i++) {
      const k = ef[i] * 2 + page[i];
      track[i] = trackOf[k]; ys[i] = pinY[k * n + ef[i]]; yt[i] = pinY[k * n + et[i]];
    }
    const cost = faults * 1000 + (tracks[0] + tracks[1]) * 6 + Math.max(tracks[0], tracks[1]) * 12 + wire * 0.001;
    return { cost, faults, tracks, top, track, ys, yt, laneY, bottom };
  }

  /** Seeded annealing over pages, sibling order and lane order. */
  anneal(iters: number, seed: number): PhoneEval {
    const rnd = mulberry32(seed);
    const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
    let cur = this.eval();
    let best = cur;
    let snap = this.snapshot();
    const lists: number[][] = [...this.roots, ...this.kids].filter((l) => l.length > 1);
    const srcs = [...new Set(this.ef)];
    for (let it = 0; it < iters && best.faults + 0 >= 0; it++) {
      const T = 6 * (1 - it / iters) + 0.05;
      const r = rnd();
      let undo: () => void;
      if (r < 0.5) {
        const i = Math.floor(rnd() * this.m);
        this.page[i] ^= 1;
        undo = () => { this.page[i] ^= 1; };
      } else if (r < 0.65) {
        const s = pick(srcs);
        const idx: number[] = [];
        for (let i = 0; i < this.m; i++) if (this.ef[i] === s) idx.push(i);
        const old = idx.map((i) => this.page[i]);
        const v = rnd() < 0.5 ? 0 : 1;
        idx.forEach((i) => { this.page[i] = v; });
        undo = () => idx.forEach((i, k) => { this.page[i] = old[k]; });
      } else if (r < 0.9 && lists.length) {
        const l = pick(lists);
        const a = Math.floor(rnd() * l.length);
        let b = Math.floor(rnd() * (l.length - 1));
        if (b >= a) b++;
        [l[a], l[b]] = [l[b], l[a]];
        undo = () => { [l[a], l[b]] = [l[b], l[a]]; };
      } else {
        const L = this.lanes;
        const a = Math.floor(rnd() * (L.length - 1));
        [L[a], L[a + 1]] = [L[a + 1], L[a]];
        undo = () => { [L[a], L[a + 1]] = [L[a + 1], L[a]]; };
      }
      const nx = this.eval();
      const d = nx.cost - cur.cost;
      if (d <= 0 || rnd() < Math.exp(-d / T)) {
        cur = nx;
        if (nx.cost < best.cost - 1e-9) { best = nx; snap = this.snapshot(); }
      } else undo();
    }
    this.restore(snap);
    return this.eval();
  }

  snapshot() { return { lanes: [...this.lanes], roots: this.roots.map((r) => [...r]), kids: this.kids.map((k) => [...k]), page: this.page.slice() }; }
  restore(s: ReturnType<PhoneSearch["snapshot"]>) {
    this.lanes.splice(0, this.lanes.length, ...s.lanes);
    s.roots.forEach((r, i) => this.roots[i].splice(0, this.roots[i].length, ...r));
    s.kids.forEach((k, i) => this.kids[i].splice(0, this.kids[i].length, ...k));
    this.page.set(s.page);
  }
}

interface PhoneResult { sheet: Sheet; edges: DfdEdge[]; faults: number; lanes: string[]; off: { from: string; to: string }[] }

function phoneSheet(g: Graph, addr: Map<string, string>, measure: (t: string, px: number) => number): PhoneResult {
  const S = new PhoneSearch(g, addr);
  // lane order seed: islets (no cross-family edge) last, then the shortest cross-family reach
  const size = g.families.map((f) => g.membersOf.get(f)!.length);
  let bestP: number[] = S.lanes, bestC = Infinity;
  for (const p of permute(g.families.map((_, i) => i))) {
    let y = 0;
    const mid: number[] = [];
    for (const f of p) { mid[f] = y + size[f] / 2; y += size[f] + 1; }
    let c = 0;
    for (const e of g.edges) if (e.cross) c += Math.abs(mid[g.families.indexOf(g.family.get(e.from)!)] - mid[g.families.indexOf(g.family.get(e.to)!)]);
    p.forEach((f, i) => { if (g.islet.has(g.families[f]) && i !== p.length - 1) c += 3; });
    if (c < bestC) { bestC = c; bestP = p; }
  }
  S.lanes.splice(0, S.lanes.length, ...bestP);
  let ev = S.eval();
  if (ev.faults > 0) ev = S.anneal(M.iters, 0x5eed);
  // what the annealer could not untangle becomes an off-sheet connector pair (budget 2):
  // each time, the edge whose removal leaves the fewest faults
  while (ev.faults > 0 && [...S.off].filter(Boolean).length < DFD_OFFSHEET_MAX) {
    let bi = -1, bc = Infinity;
    for (let i = 0; i < S.m; i++) {
      if (S.off[i]) continue;
      S.off[i] = 1;
      const c = S.eval().cost;
      S.off[i] = 0;
      if (c < bc) { bc = c; bi = i; }
    }
    S.off[bi] = 1;
    ev = S.anneal(Math.floor(M.iters / 3), 0xf1a7);
  }
  const { top, laneY, bottom, tracks } = ev;
  const colX = G * tracks[0] + 2 * G, colR = M.width - G * tracks[1] - 2 * G, colW = colR - colX;
  const widest = (ls: string[]) => Math.max(...ls.map((l) => measure(l, DFD_NAME_PX)));
  const fit = (s: string) => {
    const all = wrapName(words(s));
    for (const lines of all) if (widest(lines) + BOX_CHROME + (g.atom.get(s) ? DFD_ATOM_CELL : 0) <= colW) return lines;
    return all.reduce((a, b) => (widest(a) <= widest(b) ? a : b));
  };
  const boxes: DfdBox[] = [], lanesOut: DfdLane[] = [], blocks: Rect[] = [];
  const order = S.lanes.map((l) => g.families[l]);
  S.lanes.forEach((l, li) => {
    const f = g.families[l];
    const [y0, y1] = laneY[l];
    const count = g.membersOf.get(f)!.length;
    const lw = up8(measure(f, 13) + measure(` ${count}`, 12) + 16);
    const label = { x: colX, y: y0 + 8, w: lw, h: 16 };
    blocks.push(label);
    lanesOut.push({ family: f, stack: 0, count, x: 0, y: y0, w: M.width, h: y1 - y0, label });
    const mine = g.names.map((s, i) => ({ s, i })).filter((q) => S.laneOf[q.i] === l).sort((a, b) => top[a.i] - top[b.i]);
    mine.forEach(({ s, i }, r) => {
      boxes.push({
        name: s, family: f, depth: g.depth.get(s)!, atom: g.atom.get(s)!, stack: 0, lane: li, col: 0, row: r,
        x: colX, y: top[i], w: colW, h: DFD_BOX_H, lines: fit(s), address: addr.get(s)!,
      });
    });
  });
  // geometry: every edge leaves its parent's side, rides its net's track, enters the child's same side
  const edges: DfdEdge[] = [];
  const offEdges: { from: string; to: string }[] = [];
  for (let i = 0; i < S.m; i++) {
    if (S.off[i]) { offEdges.push({ from: g.names[S.ef[i]], to: g.names[S.et[i]] }); continue; }
    const pg = S.page[i], t = ev.track[i];
    const sideX = pg === 0 ? colX : colR;
    const tx = pg === 0 ? colX - G * (t + 1) : colR + G * (t + 1);
    const from = g.names[S.ef[i]], to = g.names[S.et[i]];
    edges.push({
      from, to, cross: g.family.get(from) !== g.family.get(to), side: pg === 0 ? "left" : "right", offSheet: false,
      points: [{ x: sideX, y: ev.ys[i] }, { x: tx, y: ev.ys[i] }, { x: tx, y: ev.yt[i] }, { x: sideX, y: ev.yt[i] }],
    });
  }
  const sheet: Sheet = { width: M.width, height: up8(bottom + M.top), boxes, lanes: lanesOut, headers: [], colBands: [[colX, colR]], blocks };
  return { sheet, edges, faults: ev.faults, lanes: order, off: offEdges };
}

// ———————————————————————————————————————— the router

const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
const BEND = 4;
const JOIN = 1;
const CROWD = 0.3;
const SOFT = 30; // price per grid step through another source's line (rip-up search)
const MAX_RIPS = 3;
const PORT_LANE = 1.5;

interface PortOpt { pre: number; prepre: number; port: Pt; side: DfdSide; dir: number; cost: number }
interface OutOpt { start: number; port: Pt; side: DfdSide; dir: number; cost: number }

class MinHeap {
  f = new Float64Array(4096);
  s = new Int32Array(4096);
  n = 0;
  /** f of the last popped entry */
  top = 0;
  get size() { return this.n; }
  clear() { this.n = 0; }
  push(f: number, s: number) {
    if (this.n === this.f.length) {
      const F = new Float64Array(this.n * 2); F.set(this.f); this.f = F;
      const S = new Int32Array(this.n * 2); S.set(this.s); this.s = S;
    }
    const F = this.f, S = this.s;
    let i = this.n++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (F[p] <= f) break;
      F[i] = F[p]; S[i] = S[p]; i = p;
    }
    F[i] = f; S[i] = s;
  }
  pop(): number {
    const F = this.f, S = this.s;
    this.top = F[0];
    const ts = S[0];
    const n = --this.n;
    if (n > 0) {
      const lf = F[n], ls = S[n];
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && F[r] < F[l] ? r : l;
        if (F[c] >= lf) break;
        F[i] = F[c]; S[i] = S[c]; i = c;
      }
      F[i] = lf; S[i] = ls;
    }
    return ts;
  }
}

interface RouteResult {
  edges: DfdEdge[];
  failed: { from: string; to: string }[];
  cost: number;
}

class Router {
  nx: number; ny: number; N: number;
  blocked: Uint8Array;
  vBand: Uint8Array;
  owner: Int32Array;
  /** port approach points, usable only by edges into / out of that box (box index + 1) */
  resv: Int32Array;
  idx: Map<string, number>;
  goalMark: Int32Array;
  apprMark: Uint8Array;
  /** the second track beside a box's in-port side (box index + 1): running along it shuts that box's doors */
  portLane: Int32Array;
  locked: Uint8Array = new Uint8Array(0);
  heap = new MinHeap();
  g: Float64Array;
  came: Int32Array;
  touched: number[] = [];
  sheet: Sheet;
  mode: DfdMode;
  byName: Map<string, DfdBox>;

  constructor(sheet: Sheet, mode: DfdMode) {
    this.sheet = sheet;
    this.mode = mode;
    this.nx = sheet.width / G + 1;
    this.ny = sheet.height / G + 1;
    this.N = this.nx * this.ny;
    this.blocked = new Uint8Array(this.N);
    this.vBand = new Uint8Array(this.nx);
    this.owner = new Int32Array(this.N);
    this.g = new Float64Array(this.N * 5).fill(Infinity);
    this.came = new Int32Array(this.N * 5).fill(-1);
    this.byName = new Map(sheet.boxes.map((b) => [b.name, b]));
    this.idx = new Map(sheet.boxes.map((b, i) => [b.name, i]));
    this.resv = new Int32Array(this.N);
    this.goalMark = new Int32Array(this.N);
    this.apprMark = new Uint8Array(this.N);
    this.portLane = new Int32Array(this.N);
    const mark = (r: Rect, clear: number) => {
      const i0 = Math.max(0, Math.floor((r.x - clear) / G)), i1 = Math.min(this.nx - 1, Math.ceil((r.x + r.w + clear) / G));
      const j0 = Math.max(0, Math.floor((r.y - clear) / G)), j1 = Math.min(this.ny - 1, Math.ceil((r.y + r.h + clear) / G));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = i * G, y = j * G;
        if (x > r.x - clear && x < r.x + r.w + clear && y > r.y - clear && y < r.y + r.h + clear) this.blocked[j * this.nx + i] = 1;
      }
    };
    for (const b of sheet.boxes) mark(b, G);
    for (const r of sheet.blocks) mark(r, G / 2);
    for (let i = 0; i < this.nx; i++) {
      const x = i * G;
      this.vBand[i] = sheet.colBands.every(([a, b]) => x <= a - G || x >= b + G) ? 1 : 0;
    }
    // every box keeps its own doorways: the track just outside each in-port side and its out-port start
    sheet.boxes.forEach((b, k) => {
      const tag = (x: number, y: number) => { const p = this.at(x, y); if (p >= 0 && p < this.N && !this.blocked[p] && !this.resv[p]) this.resv[p] = k + 1; };
      tag(b.x + b.w + G, b.y + 24);
      const lane = (x: number, y: number) => { const p = this.at(x, y); if (p >= 0 && p < this.N && !this.blocked[p]) this.portLane[p] = k + 1; };
      for (let y = b.y; y <= b.y + b.h; y += G) { lane(b.x - 2 * G, y); if (mode === "mobile") lane(b.x + b.w + 2 * G, y); }
      if (mode === "desktop") for (let y = b.y + G; y <= b.y + b.h - G; y += G) tag(b.x - G, y);
      else for (let y = b.y + G; y <= b.y + b.h - G; y += G) { tag(b.x - G, y); tag(b.x + b.w + G, y); }
    });
  }

  at(x: number, y: number) { return Math.round(y / G) * this.nx + Math.round(x / G); }
  xy(p: number): Pt { return { x: (p % this.nx) * G, y: Math.floor(p / this.nx) * G }; }
  free(p: number) { return p >= 0 && p < this.N && !this.blocked[p] && !this.owner[p]; }

  outOpts(b: DfdBox): OutOpt[] {
    const midY = b.y + 24;
    const cx = Math.round((b.x + b.w / 2) / G) * G;
    const opts: OutOpt[] = [];
    if (this.mode === "desktop") {
      opts.push({ start: this.at(b.x + b.w + G, midY), port: { x: b.x + b.w, y: midY }, side: "right", dir: 0, cost: 0 });
    } else {
      // phone: out of the bottom, near the left (a file-tree elbow), or out of the right side
      // phone: lineage inside a family runs down the left gutter (a file tree), cross-family down the right
      opts.push({ start: this.at(b.x - G, b.y + 4 * G), port: { x: b.x, y: b.y + 4 * G }, side: "left", dir: 2, cost: 0 });
      opts.push({ start: this.at(b.x + b.w + G, midY), port: { x: b.x + b.w, y: midY }, side: "right", dir: 0, cost: 0 });
      void cx;
    }
    return opts.filter((o) => this.free(o.start));
  }

  inOpts(b: DfdBox, net: number, own?: Uint8Array, soft = false, crossEdge = false): PortOpt[] {
    const opts: PortOpt[] = [];
    const ok = (p: number) => p >= 0 && p < this.N && !this.blocked[p] && foreignOk(p) && (!this.resv[p] || this.resv[p] === this.idx.get(b.name)! + 1);
    void net;
    const foreignOk = (p: number) => !this.owner[p] || (own !== undefined && own[p] === 1) || (soft && !this.locked[this.owner[p] - 1]);
    const side = (s: DfdSide, cost: number) => {
      if (s === "left" || s === "right") {
        const sx = s === "left" ? b.x : b.x + b.w;
        const dx = s === "left" ? -G : G;
        for (let y = b.y + G; y <= b.y + b.h - G; y += G) {
          const pre = this.at(sx + dx, y), prepre = this.at(sx + 2 * dx, y);
          // desktop doors centre on the body; the phone's sit high (its out-port leaves low on the left)
          const home = this.mode === "desktop" ? b.y + 24 : b.y + G;
          if (ok(pre) && ok(prepre)) opts.push({ pre, prepre, port: { x: sx, y }, side: s, dir: s === "left" ? 0 : 2, cost: cost + Math.abs(y - home) / G * 0.6 });
        }
      } else {
        const sy = s === "top" ? b.y : b.y + b.h;
        const dy = s === "top" ? -G : G;
        const mid = b.x + b.w / 2;
        for (let x = Math.ceil((b.x + G) / G) * G; x <= b.x + b.w - G; x += G) {
          const pre = this.at(x, sy + dy), prepre = this.at(x, sy + 2 * dy);
          if (ok(pre) && ok(prepre)) opts.push({ pre, prepre, port: { x, y: sy }, side: s, dir: s === "top" ? 1 : 3, cost: cost + Math.abs(x - mid) / G * 0.25 });
        }
      }
    };
    if (this.mode === "desktop") { side("left", 0); side("top", 6); side("bottom", 6); }
    else { side("left", crossEdge ? 6 : 0); side("right", crossEdge ? 0 : 6); }
    return opts;
  }

  reset() {
    for (const s of this.touched) { this.g[s] = Infinity; this.came[s] = -1; }
    this.touched.length = 0;
  }

  /** A* from start states to any port option; returns the grid points start → pre-port. */
  search(net: number, starts: { p: number; d: number; c: number }[], goals: PortOpt[], own: Uint8Array, keys: [number, number], soft = 0): { pts: number[]; goal: PortOpt; cost: number } | null {
    this.reset();
    const heap = this.heap;
    heap.clear();
    const gm = this.goalMark, am = this.apprMark;
    goals.forEach((o, k) => { gm[o.pre] = k + 1; if (o.side === "top" || o.side === "bottom") am[o.pre] = 1; });
    // lower bound: grid distance to the target box grown by one track (every pre-port lies on it)
    let rx0 = Infinity, rx1 = -Infinity, ry0 = Infinity, ry1 = -Infinity;
    for (const o of goals) {
      const x = o.pre % this.nx, y = Math.floor(o.pre / this.nx);
      if (x < rx0) rx0 = x; if (x > rx1) rx1 = x; if (y < ry0) ry0 = y; if (y > ry1) ry1 = y;
    }
    const nxx = this.nx;
    const h = (p: number) => {
      const x = p % nxx, y = (p - x) / nxx;
      return (x < rx0 ? rx0 - x : x > rx1 ? x - rx1 : 0) + (y < ry0 ? ry0 - y : y > ry1 ? y - ry1 : 0);
    };
    for (const s of starts) {
      const id = s.p * 5 + s.d;
      if (s.c < this.g[id]) { this.g[id] = s.c; this.came[id] = -2; this.touched.push(id); heap.push(s.c + h(s.p), id); }
    }
    let best: { id: number; cost: number; goal: PortOpt } | null = null;
    const nx = this.nx;
    let expanded = 0;
    while (heap.size) {
      const id = heap.pop();
      const f = heap.top;
      if (best && f >= best.cost) break;
      const gc = this.g[id];
      if (f > gc + h(Math.floor(id / 5)) + 1e-9) continue;
      if (++expanded > 400000) break;
      const p = Math.floor(id / 5), d = id % 5;
      const px = p % nx;
      for (let nd = 0; nd < 4; nd++) {
        if (d !== 4 && nd === (d + 2) % 4) continue;
        const qx = px + DX[nd];
        if (qx < 0 || qx >= nx) continue;
        const q = p + DX[nd] + DY[nd] * nx;
        if (q < 0 || q >= this.N) continue;
        if (this.blocked[q] || own[q]) continue;
        const ow = this.owner[q];
        if (ow && (!soft || this.locked[ow - 1])) continue;
        const rv = this.resv[q];
        if (rv && rv !== keys[0] && rv !== keys[1]) continue;
        if (nd % 2 === 1 && !this.vBand[qx] && !am[q]) continue;
        let c = gc + 1 + (d !== 4 && nd !== d ? BEND : 0) + (ow ? soft : 0);
        // running along another box's door track (not just crossing it) closes that box's in-ports
        const pl = this.portLane[q];
        if (pl && pl !== keys[1] && nd % 2 === 1) c += PORT_LANE;
        // crowding: prefer a track that is not right beside another source's line
        if (nd % 2 === 0) {
          if (q - nx >= 0 && this.owner[q - nx]) c += CROWD;
          if (q + nx < this.N && this.owner[q + nx]) c += CROWD;
        } else {
          if (qx > 0 && this.owner[q - 1]) c += CROWD;
          if (qx < nx - 1 && this.owner[q + 1]) c += CROWD;
        }
        const qid = q * 5 + nd;
        if (c >= this.g[qid]) continue;
        this.g[qid] = c; this.came[qid] = id; this.touched.push(qid);
        const gk = gm[q];
        if (gk) {
          const o = goals[gk - 1];
          // the last two steps run straight into the port: prepre → pre in the port's direction
          if (nd === o.dir && p === o.prepre) {
            const tot = c + o.cost;
            if (!best || tot < best.cost) best = { id: qid, cost: tot, goal: o };
          }
        }
        heap.push(c + h(q), qid);
      }
    }
    for (const o of goals) { gm[o.pre] = 0; am[o.pre] = 0; }
    if (!best) return null;
    const pts: number[] = [];
    let id = best.id;
    while (id >= 0) { pts.push(Math.floor(id / 5)); const c = this.came[id]; if (c === -2) break; id = c; }
    pts.reverse();
    return { pts, goal: best.goal, cost: best.cost };
  }

  /**
   * Rip-up and reroute: nets are routed one after another; when an edge finds
   * no free path, it searches again with other sources' lines passable at a
   * high price, takes that path, and the sources it went through are ripped up
   * and queued again. A source ripped MAX_RIPS times is locked in place.
   */
  routeAll(nets: { src: string; targets: string[] }[], cross: (a: string, b: string) => boolean): RouteResult {
    this.owner.fill(0);
    const K = nets.length;
    const netPts: number[][] = nets.map(() => []);
    const netEdges: DfdEdge[][] = nets.map(() => []);
    const netFailed: { from: string; to: string }[][] = nets.map(() => []);
    const netCost = new Float64Array(K);
    const rips = new Int32Array(K);
    this.locked = new Uint8Array(K);
    const queue = nets.map((_, i) => i);
    const queued = new Uint8Array(K).fill(1);
    const rip = (v: number) => {
      for (const p of netPts[v]) if (this.owner[p] === v + 1) this.owner[p] = 0;
      netPts[v] = []; netEdges[v] = []; netFailed[v] = []; netCost[v] = 0;
      if (++rips[v] >= MAX_RIPS) this.locked[v] = 1;
      if (!queued[v]) { queued[v] = 1; queue.push(v); }
    };
    let guard = 0;
    while (queue.length && guard++ < K * (MAX_RIPS + 2)) {
      const ni = queue.shift()!;
      queued[ni] = 0;
      this.locked[ni] = 1; // never rip the net being routed
      this.routeNet(ni, nets[ni], cross, netPts, netEdges, netFailed, netCost, rip);
      this.locked[ni] = rips[ni] >= MAX_RIPS ? 1 : 0;
    }
    let cost = 0;
    for (let i = 0; i < K; i++) cost += netCost[i];
    return { edges: netEdges.flat(), failed: netFailed.flat(), cost };
  }

  routeNet(ni: number, net: { src: string; targets: string[] }, cross: (a: string, b: string) => boolean,
    netPts: number[][], netEdges: DfdEdge[][], netFailed: { from: string; to: string }[][], netCost: Float64Array, rip: (v: number) => void) {
    const sb = this.byName.get(net.src)!;
    const own = new Uint8Array(this.N);
    const parent = new Map<number, number>();
    const joinable: number[] = [];
    const reserved = new Set<number>();
    const rootAt = new Map<number, OutOpt>();
    let root: OutOpt | null = null;
    const pathTo = (p: number) => {
      const out: number[] = [];
      let q: number | undefined = p;
      while (q !== undefined && q >= 0) { out.push(q); q = parent.get(q); }
      return out.reverse();
    };
    const sorted = [...net.targets].sort((a, b) => {
      const A = this.byName.get(a)!, B = this.byName.get(b)!;
      const da = Math.abs(A.x - sb.x) + Math.abs(A.y - sb.y), db = Math.abs(B.x - sb.x) + Math.abs(B.y - sb.y);
      return db - da || (a < b ? -1 : 1);
    });
    for (const t of sorted) {
      const keys: [number, number] = [this.idx.get(net.src)! + 1, this.idx.get(t)! + 1];
      let res: { pts: number[]; goal: PortOpt; cost: number } | null = null;
      let outs: OutOpt[] = [];
      for (const soft of [0, SOFT]) {
        const tb = this.byName.get(t)!;
        const goals = this.inOpts(tb, ni, own, soft > 0, cross(net.src, t)).filter((o) => !own[o.pre] && (!own[o.prepre] || (root !== null && !reserved.has(o.prepre))));
        // a fresh out-port (only one on desktop; the phone's second side), or any joinable tree point
        outs = this.outOpts(sb).filter((o) => !rootAt.has(o.start) && !own[o.start] && (!root || this.mode === "mobile"));
        const starts: { p: number; d: number; c: number }[] = [
          ...outs.map((o) => ({ p: o.start, d: o.dir, c: o.cost + (root ? 2 : 0) })),
          ...joinable.filter((p) => !reserved.has(p)).map((p) => ({ p, d: 4, c: JOIN })),
        ];
        res = goals.length && starts.length ? this.search(ni, starts, goals, own, keys, soft) : null;
        if (res) break;
      }
      if (!res) { netFailed[ni].push({ from: net.src, to: t }); continue; }
      // take the path: whoever it runs through is ripped up and queued again
      const victims = new Set<number>();
      for (const p of res.pts) if (this.owner[p] && this.owner[p] !== ni + 1) victims.add(this.owner[p] - 1);
      for (const v of victims) rip(v);
      netCost[ni] += res.cost;
      const first = res.pts[0];
      const fresh = outs.find((o) => o.start === first && !own[first]);
      if (fresh) { rootAt.set(first, fresh); parent.set(first, -1); root = root ?? fresh; }
      const prefix = pathTo(first);
      const rootPort = rootAt.get(prefix[0])!.port;
      for (let k = 1; k < res.pts.length; k++) parent.set(res.pts[k], res.pts[k - 1]);
      for (const p of res.pts) { own[p] = 1; this.owner[p] = ni + 1; netPts[ni].push(p); }
      for (const p of res.pts) if (p !== res.goal.pre && p !== res.goal.prepre) joinable.push(p);
      reserved.add(res.goal.pre); reserved.add(res.goal.prepre);
      const gridPts = [...prefix, ...res.pts.slice(1)];
      const pts: Pt[] = [rootPort, ...gridPts.map((p) => this.xy(p)), res.goal.port];
      netEdges[ni].push({ from: net.src, to: t, cross: cross(net.src, t), points: simplify(pts), side: res.goal.side, offSheet: false });
    }
  }
}

/** Drop duplicate and collinear interior points. */
function simplify(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (q && q.x === p.x && q.y === p.y) continue;
    if (out.length >= 2) {
      const a = out[out.length - 2], b = out[out.length - 1];
      if ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y)) { out[out.length - 1] = p; continue; }
    }
    out.push(p);
  }
  return out;
}

// ———————————————————————————————————————— geometry checks (the audit)

function segCrossProper(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

type Seg = { a: Pt; b: Pt; e: number; src: string };
const horiz = (s: { a: Pt; b: Pt }) => s.a.y === s.b.y;

/** Do two axis-aligned segments share any point? (closed) */
function segTouch(s: { a: Pt; b: Pt }, t: { a: Pt; b: Pt }): boolean {
  const sx0 = Math.min(s.a.x, s.b.x), sx1 = Math.max(s.a.x, s.b.x), sy0 = Math.min(s.a.y, s.b.y), sy1 = Math.max(s.a.y, s.b.y);
  const tx0 = Math.min(t.a.x, t.b.x), tx1 = Math.max(t.a.x, t.b.x), ty0 = Math.min(t.a.y, t.b.y), ty1 = Math.max(t.a.y, t.b.y);
  return sx0 <= tx1 && tx0 <= sx1 && sy0 <= ty1 && ty0 <= sy1;
}
/** Collinear overlap of positive length? */
function segOverlap(s: { a: Pt; b: Pt }, t: { a: Pt; b: Pt }): boolean {
  if (horiz(s) !== horiz(t)) return false;
  if (horiz(s)) {
    if (s.a.y !== t.a.y) return false;
    return Math.min(Math.max(s.a.x, s.b.x), Math.max(t.a.x, t.b.x)) - Math.max(Math.min(s.a.x, s.b.x), Math.min(t.a.x, t.b.x)) > 0;
  }
  if (s.a.x !== t.a.x) return false;
  return Math.min(Math.max(s.a.y, s.b.y), Math.max(t.a.y, t.b.y)) - Math.max(Math.min(s.a.y, s.b.y), Math.min(t.a.y, t.b.y)) > 0;
}
function segRect(s: { a: Pt; b: Pt }, r: Rect, m: number): boolean {
  const x0 = Math.min(s.a.x, s.b.x), x1 = Math.max(s.a.x, s.b.x), y0 = Math.min(s.a.y, s.b.y), y1 = Math.max(s.a.y, s.b.y);
  return x0 < r.x + r.w + m && x1 > r.x - m && y0 < r.y + r.h + m && y1 > r.y - m;
}

export function segmentsOf(edges: DfdEdge[]): Seg[] {
  const out: Seg[] = [];
  edges.forEach((e, i) => {
    for (let k = 1; k < e.points.length; k++) out.push({ a: e.points[k - 1], b: e.points[k], e: i, src: e.from });
  });
  return out;
}

/** The sheet's own proof: crossings / overlaps between different sources, box hits, label hits. */
export function auditDfd(l: { boxes: DfdBox[]; edges: DfdEdge[]; labels: DfdLabel[] }): DfdAudit {
  const segs = segmentsOf(l.edges);
  let crossings = 0, overlaps = 0, boxHits = 0, labelHits = 0, nonOrthogonal = 0;
  for (const s of segs) if (s.a.x !== s.b.x && s.a.y !== s.b.y) nonOrthogonal++;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const s = segs[i], t = segs[j];
      if (s.src === t.src) {
        // a source's own branches may share their trunk, never cross it
        if (s.e !== t.e && horiz(s) !== horiz(t) && segCrossProper(s.a, s.b, t.a, t.b)) crossings++;
        continue;
      }
      if (!segTouch(s, t)) continue;
      if (segOverlap(s, t)) overlaps++;
      else crossings++;
    }
  }
  const byName = new Map(l.boxes.map((b) => [b.name, b]));
  l.edges.forEach((e) => {
    const n = e.points.length;
    for (let k = 1; k < n; k++) {
      const s = { a: e.points[k - 1], b: e.points[k] };
      for (const b of l.boxes) {
        // the first run leaves its own source, the last enters its own target
        if (k === 1 && b.name === e.from) continue;
        if (k === n - 1 && b.name === e.to) continue;
        if (segRect(s, b, G - 0.5)) boxHits++;
      }
    }
    // the last run must be perpendicular to the target's edge and end on it
    const tb = byName.get(e.to);
    if (tb && n >= 2) {
      const a = e.points[n - 2], z = e.points[n - 1];
      const okL = z.x === tb.x && a.y === z.y && a.x < z.x;
      const okR = z.x === tb.x + tb.w && a.y === z.y && a.x > z.x;
      const okT = z.y === tb.y && a.x === z.x && a.y < z.y;
      const okB = z.y === tb.y + tb.h && a.x === z.x && a.y > z.y;
      if (!(okL || okR || okT || okB)) boxHits++;
    }
  });
  for (const lab of l.labels) {
    const own = new Set(lab.edges);
    for (const b of l.boxes) if (segRect({ a: { x: lab.x, y: lab.y }, b: { x: lab.x + lab.w, y: lab.y + lab.h } }, b, 0)) labelHits++;
    for (const s of segs) {
      const e = l.edges[s.e];
      // the line the gap is cut in
      if (own.has(`${e.from}->${e.to}`) && (lab.along === "h" ? horiz(s) && s.a.y === lab.y + lab.h / 2 : !horiz(s) && s.a.x === lab.x + lab.w / 2)) continue;
      if (segRect(s, lab, 1)) labelHits++;
    }
    for (const o of l.labels) if (o !== lab && segRect({ a: { x: o.x, y: o.y }, b: { x: o.x + o.w, y: o.y + o.h } }, lab, 2)) labelHits += 0.5;
  }
  const labelled = new Set(l.labels.flatMap((x) => x.edges));
  const unlabelled = l.edges.filter((e) => e.cross && !e.offSheet && !labelled.has(`${e.from}->${e.to}`)).length;
  return { crossings, overlaps, boxHits, labelHits: Math.round(labelHits), unlabelled, nonOrthogonal };
}

// ———————————————————————————————————————— inline labels

function placeLabels(edges: DfdEdge[], boxes: DfdBox[], addr: Map<string, string>, measure: (t: string, px: number) => number, width = Infinity, height = Infinity): DfdLabel[] {
  const labels: DfdLabel[] = [];
  const segs = segmentsOf(edges);
  const H = DFD_LABEL_PX + 3;
  const key = (e: DfdEdge) => `${e.from}->${e.to}`;
  const done = new Set<string>();
  const rectHit = (r: Rect, m: number) => (s: { a: Pt; b: Pt }) => segRect(s, r, m);
  for (const e of edges) {
    if (!e.cross || e.offSheet || done.has(key(e))) continue;
    // the label names the source (every line it cuts comes from that same source);
    // where the full "4 transformer" finds no gap, the bare address "4" is tried
    let placed: DfdLabel | null = null;
    for (const text of [`${addr.get(e.from)} ${words(e.from)}`, addr.get(e.from)!]) {
    const w = Math.ceil(measure(text, DFD_LABEL_PX)) + 8;
    const runs: { a: Pt; b: Pt; k: number; h: boolean }[] = [];
    for (let k = 1; k < e.points.length; k++) {
      const a = e.points[k - 1], b = e.points[k];
      if (a.y === b.y && Math.abs(a.x - b.x) >= w + 2 * DFD_R + 4) runs.push({ a, b, k, h: true });
      if (a.x === b.x && Math.abs(a.y - b.y) >= H + 2 * DFD_R + 8) runs.push({ a, b, k, h: false });
    }
    // horizontal runs first (a gap cut along the line), longest first; vertical runs are the fallback
    runs.sort((p, q) => Number(q.h) - Number(p.h) || (q.h ? Math.abs(q.a.x - q.b.x) - Math.abs(p.a.x - p.b.x) : Math.abs(q.a.y - q.b.y) - Math.abs(p.a.y - p.b.y)) || q.k - p.k);
    for (const r of runs) {
      const lo = r.h ? Math.min(r.a.x, r.b.x) + DFD_R + 2 : Math.min(r.a.y, r.b.y) + DFD_R + 4;
      const hi = r.h ? Math.max(r.a.x, r.b.x) - DFD_R - 2 : Math.max(r.a.y, r.b.y) - DFD_R - 4;
      const len = r.h ? w : H;
      const mid = Math.round((lo + hi) / 2);
      const tries = [0];
      for (let s = G; s < (hi - lo) / 2; s += G) tries.push(s, -s);
      for (const d of tries) {
        const c0 = mid + d - len / 2;
        if (c0 < lo || c0 + len > hi) continue;
        const rect: Rect = r.h ? { x: c0, y: r.a.y - H / 2, w, h: H } : { x: r.a.x - w / 2, y: c0, w, h: H };
        if (rect.x < 2 || rect.y < 2 || rect.x + rect.w > width - 2 || rect.y + rect.h > height - 2) continue; // stays on the sheet
        // the lines the gap cuts: runs of this same source along this line through the rect
        const own = new Set<string>();
        let bad = false;
        for (const s of segs) {
          if (!segRect(s, rect, 1.5)) continue;
          const o = edges[s.e];
          const along = r.h ? s.a.y === r.a.y && s.b.y === r.a.y : s.a.x === r.a.x && s.b.x === r.a.x;
          if (o.from === e.from && along) { own.add(key(o)); continue; }
          bad = true; break;
        }
        if (bad) continue;
        if (boxes.some((b) => rectHit({ x: b.x, y: b.y, w: b.w, h: b.h }, 0.5)({ a: { x: rect.x, y: rect.y }, b: { x: rect.x + rect.w, y: rect.y + rect.h } }))) continue;
        if (labels.some((o) => segRect({ a: { x: o.x, y: o.y }, b: { x: o.x + o.w, y: o.y + o.h } }, rect, 3))) continue;
        // a vertical gap must cut the line where it fully crosses the rect (no elbow inside)
        placed = { text, ...rect, edges: [...own], along: r.h ? "h" : "v" };
        break;
      }
      if (placed) break;
    }
    if (placed) break;
    }
    if (placed) { labels.push(placed); for (const k of placed.edges) done.add(k); }
  }
  return labels;
}

// ———————————————————————————————————————— the whole pass

function permute<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs.slice()];
  const out: T[][] = [];
  xs.forEach((x, i) => { for (const p of permute([...xs.slice(0, i), ...xs.slice(i + 1)])) out.push([x, ...p]); });
  return out;
}

/** Candidate stack arrangements, best first by a cheap proxy (rows balance, backward and long cross-lane edges). */
function arrangements(g: Graph): Arrangement[] {
  const fams = g.families;
  const rows = new Map(fams.map((f) => [f, Math.max(1, ...[0, 1, 2, 3, 4, 5].map((d) => g.membersOf.get(f)!.filter((n) => g.depth.get(n) === d).length))]));
  const cands: { a: Arrangement; s: number }[] = [];
  const proxy = (stacks: string[][]) => {
    const pos = new Map<string, { s: number; y: number }>();
    stacks.forEach((st, s) => { let y = 0; for (const f of st) { pos.set(f, { s, y: y + rows.get(f)! / 2 }); y += rows.get(f)! + 0.5; } });
    let c = 0;
    for (const e of g.edges) {
      if (!e.cross) continue;
      const a = pos.get(g.family.get(e.from)!)!, b = pos.get(g.family.get(e.to)!)!;
      c += Math.abs(a.y - b.y);
      if (a.s !== b.s) c += 6 + (a.s > b.s ? 10 : 0);
    }
    // a family with no cross-family edge sits at the bottom of its stack
    stacks.forEach((st) => st.forEach((f, i) => { if (g.islet.has(f) && i !== st.length - 1) c += 4; }));
    return c;
  };
  {
    const total = fams.reduce((s, f) => s + rows.get(f)!, 0);
    let bestH = Infinity;
    const splits: [string[], string[]][] = [];
    for (let mask = 1; mask < (1 << fams.length) - 1; mask++) {
      const A = fams.filter((_, i) => mask & (1 << i)), B = fams.filter((_, i) => !(mask & (1 << i)));
      const h = Math.max(A.reduce((s, f) => s + rows.get(f)! + 0.45, 0), B.reduce((s, f) => s + rows.get(f)! + 0.45, 0));
      if (h < bestH - 1e-9) { bestH = h; splits.length = 0; }
      if (Math.abs(h - bestH) < 1e-9) splits.push([A, B]);
    }
    void total;
    for (const [A, B] of splits) {
      for (const pa of permute(A)) for (const pb of permute(B)) cands.push({ a: { stacks: [pa, pb] }, s: proxy([pa, pb]) });
    }
  }
  cands.sort((p, q) => p.s - q.s || JSON.stringify(p.a.stacks).localeCompare(JSON.stringify(q.a.stacks)));
  return cands.map((c) => c.a);
}

function routeSheet(sheet: Sheet, g: Graph, mode: DfdMode, budget: number): { res: RouteResult; tries: number } {
  const router = new Router(sheet, mode);
  const cross = (a: string, b: string) => g.family.get(a) !== g.family.get(b);
  const nets0 = g.names.filter((n) => g.children.get(n)!.length).map((n) => ({ src: n, targets: [...g.children.get(n)!].sort() }));
  const byName = new Map(sheet.boxes.map((b) => [b.name, b]));
  const bbox = (n: { src: string; targets: string[] }) => {
    const bs = [n.src, ...n.targets].map((t) => byName.get(t)!);
    const x0 = Math.min(...bs.map((b) => b.x)), x1 = Math.max(...bs.map((b) => b.x + b.w));
    const y0 = Math.min(...bs.map((b) => b.y)), y1 = Math.max(...bs.map((b) => b.y + b.h));
    return (x1 - x0) + (y1 - y0);
  };
  const orders = [
    // small, local combs first; the long reaches then find the channels left between them
    [...nets0].sort((a, b) => bbox(a) - bbox(b) || (a.src < b.src ? -1 : 1)),
    // hubs first (their trunks are the spine), then the long reaches
    [...nets0].sort((a, b) => b.targets.length - a.targets.length || bbox(b) - bbox(a) || (a.src < b.src ? -1 : 1)),
  ];
  let best: RouteResult | null = null;
  let tries = 0;
  for (const start of orders) {
    let order = start;
    for (let it = 0; it < 3 && tries < budget; it++) {
      tries++;
      const res = router.routeAll(order, cross);
      if (!best || res.failed.length < best.failed.length || (res.failed.length === best.failed.length && res.cost < best.cost)) best = res;
      if (!res.failed.length) break;
      const bad = new Set(res.failed.map((f) => f.from));
      order = [...order.filter((n) => bad.has(n.src)), ...order.filter((n) => !bad.has(n.src))];
    }
  }
  return { res: best!, tries };
}

function offSheetPairs(failed: { from: string; to: string }[], sheet: Sheet, addr: Map<string, string>): { edges: DfdEdge[]; pairs: DfdOffSheet[] } {
  const by = new Map(sheet.boxes.map((b) => [b.name, b]));
  const edges: DfdEdge[] = [];
  const pairs: DfdOffSheet[] = [];
  for (const f of failed) {
    const s = by.get(f.from)!, t = by.get(f.to)!;
    const outText = `to ${addr.get(f.to)} ${words(f.to)}`;
    const inText = `from ${addr.get(f.from)} ${words(f.from)}`;
    pairs.push({
      from: f.from, to: f.to, outText, inText,
      out: { x: s.x + s.w + 4, y: s.y - 14, w: outText.length * 6, h: 13 },
      in: { x: t.x - inText.length * 6 - 4, y: t.y - 14, w: inText.length * 6, h: 13 },
      stubOut: [{ x: s.x + s.w, y: s.y + 8 }, { x: s.x + s.w + G, y: s.y + 8 }],
      stubIn: [{ x: t.x - G, y: t.y + 8 }, { x: t.x, y: t.y + 8 }],
    });
    edges.push({ from: f.from, to: f.to, cross: s.family !== t.family, points: [], side: "left", offSheet: true });
  }
  return { edges, pairs };
}

export function buildDfd(tax: TaxonomyResponse, fam: FamilyMap, opts: DfdOptions): DfdLayout {
  const g = buildGraph(tax, fam);
  const measure = opts.measure ?? approxMeasure;
  const addr = lineageAddresses(g);
  if (opts.mode === "mobile") {
    const ph = phoneSheet(g, addr, measure);
    const off = offSheetPairs(ph.off, ph.sheet, addr);
    const edges = [...ph.edges, ...off.edges].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : a.to < b.to ? -1 : 1));
    const labels = placeLabels(ph.edges, ph.sheet.boxes, addr, measure, ph.sheet.width, ph.sheet.height);
    const layout: DfdLayout = {
      mode: "mobile", width: ph.sheet.width, height: ph.sheet.height, grid: G, radius: DFD_R,
      boxes: ph.sheet.boxes, lanes: ph.sheet.lanes, headers: ph.sheet.headers, edges, labels, offSheet: off.pairs,
      stacks: [ph.lanes], audit: { crossings: 0, overlaps: 0, boxHits: 0, labelHits: 0, unlabelled: 0, nonOrthogonal: 0 }, attempts: 1,
    };
    layout.audit = auditDfd(layout);
    return layout;
  }
  const arrs = arrangements(g);
  let best: { sheet: Sheet; res: RouteResult; labels: DfdLabel[]; arr: Arrangement; score: number } | null = null;
  let attempts = 0;
  for (const arr of arrs.slice(0, 4)) {
    const sheet = sheetDesktop(g, arr, orderDesktop(g, arr, 8), addr, measure, opts.maxWidth ?? 1424);
    const { res, tries } = routeSheet(sheet, g, "desktop", 6);
    attempts += tries;
    const labels = placeLabels(res.edges, sheet.boxes, addr, measure, sheet.width, sheet.height);
    const unl = res.edges.filter((e) => e.cross).length - new Set(labels.flatMap((l) => l.edges)).size;
    const score = res.failed.length * 1e6 + unl * 1e4 + res.cost;
    if (!best || score < best.score) best = { sheet, res, labels, arr, score };
    // the first cleanly routed arrangement wins: routing is the expensive part
    if (!res.failed.length) break;
  }
  const { sheet, res, labels, arr } = best!;
  const off = offSheetPairs(res.failed, sheet, addr);
  const edges = [...res.edges, ...off.edges].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : a.to < b.to ? -1 : 1));
  const layout: DfdLayout = {
    mode: opts.mode, width: sheet.width, height: sheet.height, grid: G, radius: DFD_R,
    boxes: sheet.boxes, lanes: sheet.lanes, headers: sheet.headers, edges, labels, offSheet: off.pairs,
    stacks: arr.stacks, audit: { crossings: 0, overlaps: 0, boxHits: 0, labelHits: 0, unlabelled: 0, nonOrthogonal: 0 }, attempts,
  };
  layout.audit = auditDfd(layout);
  return layout;
}

// ———————————————————————————————————————— drawing helper

/** An orthogonal polyline as an SVG path of straight runs and quarter arcs of ONE radius (no Béziers). */
export function elbowD(pts: Pt[], r = DFD_R): string {
  if (!pts.length) return "";
  const f = (v: number) => (Math.round(v * 100) / 100).toString();
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const ux = Math.sign(b.x - a.x), uy = Math.sign(b.y - a.y), vx = Math.sign(c.x - b.x), vy = Math.sign(c.y - b.y);
    const p1 = { x: b.x - ux * r, y: b.y - uy * r }, p2 = { x: b.x + vx * r, y: b.y + vy * r };
    const sweep = ux * vy - uy * vx > 0 ? 1 : 0;
    d += ` L${f(p1.x)} ${f(p1.y)} A${r} ${r} 0 0 ${sweep} ${f(p2.x)} ${f(p2.y)}`;
  }
  const z = pts[pts.length - 1];
  return `${d} L${f(z.x)} ${f(z.y)}`;
}

/** Internals for the router's own tests and dumps (not part of the skin contract). */
export const __dfd = { Router, sheetDesktop, orderDesktop, arrangements, routeSheet, placeLabels, phoneSheet, PhoneSearch };
