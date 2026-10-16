// buildDfd — the "Kawaii DFD" sheet for /lab/flow (and the router behind any directed graph
// drawn as a data-flow sheet; see components/lab/flow/DESIGN.md). Every node is a box on a
// strict grid (desktop: two stacks of group lanes × generation columns; phone: one stack, a
// file tree indented by generation), and every edge is routed ORTHOGONALLY on an 8-px track
// grid so that no two edges of different sources cross, touch or run on top of each other,
// and no edge passes within 8 px of a box. The router is a maze router (A* over the track
// grid, bend-penalised) that grows one Steiner tree per out-port: a fan-out shares one trunk
// and splits on T-junctions. Vertical runs only in the gutters between box columns (plus the
// last two steps into a top port); horizontal runs only where no box is.
//
// Route quality is a rule, not a hope: an edge whose route is a DETOUR (longer than
// DFD_DETOUR_MAX × the Manhattan distance between its box centres, or straying outside the stacks of its
// two ends) — or that cannot be routed at all — becomes an off-sheet connector pair: a short
// stub out of each box ending in a tag that names the far end (budget DFD_OFFSHEET_MAX; each
// pair is priced as CONNECTOR_COST px of wire when layouts are compared).
//
// Atoms with no edges at all ("islands") leave the grid: they are compact chips on the SHELF, a
// labelled tray across the top of the desktop sheet, above the column headers, so no chip ever
// stands under a generation it does not belong to and the grid holds only boxes that carry lines.
//
// Real wires stay inside one panel (stack): a line between the two stacks is always a connector
// pair (why "panel"), its out-tag listing every far end of that parent in the other stack.
//
// Pure and deterministic: models are sorted by name before anything happens, so the input
// order never matters. No DOM — the caller passes `measure`.
import { buildGraph, type Graph } from "./graph.ts";
import type { FamilyMap, Pt } from "./types.ts";
import { mulberry32 } from "./rng.ts";
import { displayName as words } from "../copy.ts";

/** Track grid pitch (px at the overview): the gap between parallel tracks and the box clearance. */
export const DFD_G = 8;
/** The one elbow radius of every edge (≤ G/2, so two bends one track apart never clamp it). */
export const DFD_R = 4;
/** Desktop box height when the sheet fits `maxHeight` (12-px strip + 36-px body: two-line names breathe). */
export const DFD_BOX_TALL = 48;
/** Compact box height: the phone, and a desktop sheet that would not fit with tall boxes. */
export const DFD_BOX_H = 40;
/** Island chip height (a compact store on the shelf). */
export const DFD_CHIP_H = 40;
/** Header strip height inside a derived box (address + evidence glyph). */
export const DFD_STRIP = 12;
/** An atom is drawn as a DFD store: its index cell (the atom number) sits left of the creature. */
export const DFD_ATOM_CELL = 24;
/** Box padding: left pad · creature · gap · right pad (the evidence mark rides in the strip / corner). */
export const DFD_PAD = { left: 6, gap: 6, right: 8, chipMark: 10 };
/** Creature size inside a box of height h. */
export const critterPx = (h: number) => (h >= DFD_BOX_TALL ? 24 : 22);
export const DFD_NAME_PX = 13;
export const DFD_LABEL_PX = 11;
export const DFD_TAG_PX = 12;
export const DFD_TAG_H = 16;
/** Length of a connector tag's pointed tip (the flow direction): sideways / up-or-down. */
export const DFD_TAG_TIP = 6;
export const DFD_TAG_NOTCH = 4;
/** The shelf (the tray of island chips above the column headers): its name and its caption. */
export const DFD_SHELF_TITLE = "Standalone atoms";
export const DFD_SHELF_TEXT = "no lines in or out yet";
export const DFD_SHELF_PX = 12;
/** One more line of a bundled connector tag (a parent's far ends in the other stack). */
export const DFD_TAG_LINE = 14;
/** Phone: indent per generation (the file tree's step). */
export const DFD_INDENT = 16;
/** Off-sheet connector budget (detours + edges that could not be routed crossing-free). */
export const DFD_OFFSHEET_MAX = 2;
/** A route longer than this × the Manhattan distance between its box centres is a detour → connector pair. */
export const DFD_DETOUR_MAX = 1.6;
/** A cross-family line at most this long needs no inline label: its parent sits at the other end. */
export const DFD_SHORT = 160;
/** A connector pair is priced as this much wire when two layouts are compared. */
const CONNECTOR_COST = 600;
/** …and a pair between the two stacks (no choice: wires stay in their panel) as this much. */
const PANEL_COST = 200;
/** A parent's lines that frame boxes (framedBoxes) cost this much per frame. */
const FRAME_COST = 800;
/** …plus this much per other line of the same parent (cutting one line out of a hub's comb leaves a gap in it). */
const HUB_GAP = 40;

const G = DFD_G;
const BOX_CHROME = DFD_PAD.left + 24 + DFD_PAD.gap + DFD_PAD.right;
const CHIP_CHROME = DFD_ATOM_CELL + DFD_PAD.left + 22 + DFD_PAD.gap + DFD_PAD.right + DFD_PAD.chipMark;

// desktop sheet
const D = {
  rowGap: 16, // one track at the gap's centre line
  laneHead: 24, // swim-lane label band above a lane's first row
  chipRow: DFD_CHIP_H + 8,
  shelfPad: 8, // the shelf tray's inner padding round its chips
  shelfAfter: 8, // shelf tray → column header row
  chipGap: 8, // between two chips of one group on the shelf
  groupGap: 24, // between two groups' chips on the shelf
  headRow: 16, // the column header row (Atoms / Gen 1 …)
  topChan: 16,
  bottom: 0, // the last lane already ends one row gap below its last box
  gutter: 40, // 4 tracks between generation columns (32 routes the zoo, but whole combs then fail round the margin on perturbed graphs)
  margin: 16, // the right margin: nothing routes round the outside (that would be a detour)
  marginLeft: 32, // the left margin holds the lane's left gutter (one track 8 px off the boxes), 24 px in from the sheet's edge
  corridor: 32, // between the two stacks: no wire crosses it (lines between stacks are connector pairs)
};
// phone sheet (one box column between two routing gutters)
const M = {
  width: 376, // 47 tracks; shown at scale 1 on a 390-px phone
  rowPitch: 48, // box 40 + 8: no line ever runs between two phone rows (only beside them)
  laneHead: 32,
  laneGap: 16,
  tagRoom: 32, // extra gap above a box that carries a connector tag (tag 20 + stub 12 + air; a multiple of the track pitch)
  top: 8,
  maxIndent: 4, // generations deeper than this share the last indent
  iters: 3000,
};

export type DfdMode = "desktop" | "mobile";
export type DfdSide = "left" | "right" | "top" | "bottom";
type Rect = { x: number; y: number; w: number; h: number };

/** The one input the router needs: nodes with the names of the nodes they build on. */
export interface DfdGraphInput { models: { name: string; builds_on: string[] }[] }

export interface DfdBox extends Rect {
  name: string;
  family: string;
  depth: number;
  atom: boolean;
  /** an island (atom with no edges), drawn as a compact chip on the desktop shelf */
  chip: boolean;
  /** the box's stack (a chip on the shelf: -1) */
  stack: number;
  /** index into `lanes` (a chip on the shelf: -1) */
  lane: number;
  /** generation column (desktop; a chip: 0) / 0 (phone) */
  col: number;
  /** row inside the lane (desktop grid; chips: their shelf row) or inside the lane (phone) */
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
/** Desktop: the tray of island chips across the top of the sheet, above the column headers. */
export interface DfdShelf extends Rect {
  /** the title (DFD_SHELF_TITLE) and, under it, the caption (DFD_SHELF_TEXT) */
  title: Rect;
  caption: Rect;
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
  /** a line between the stacks that enters its panel at a hub tag: `points` start at the tag
   * (the connector pair's in-end), not at `from` */
  hub?: boolean;
}
export interface DfdLabel extends Rect {
  text: string;
  /** "from->to" of every edge the label names (its whole trunk) */
  edges: string[];
  /** the run the gap is cut in: horizontal (text on the line) or vertical (text across it) */
  along: "h" | "v";
  /** on a vertical run: the text turned to read up the line (where there is no room across it) */
  turn?: boolean;
}
/** One end of an off-sheet connector: a tag (pointing along the flow) on a short stub. */
export interface DfdTag extends Rect {
  /** the first (often only) far end: "address name" */
  text: string;
  /** the address part of `text` (drawn bolder) */
  address: string;
  /** every far end the tag names, one line each (a parent's bundle into the other stack names
   * several; `text` / `address` are the first): "address name", the address, the model */
  lines: { text: string; address: string; name: string }[];
  /** which way the tag's tip points (the flow direction) */
  tip: DfdSide;
  /** out: box port → tag; in: tag → box port (the arrowhead sits on the box) */
  stub: Pt[];
}
export interface DfdOffSheet {
  from: string;
  to: string;
  out: DfdTag;
  in: DfdTag;
  /** detour / unroutable: a line inside one stack that could not be drawn well; panel: a line
   * between the two stacks (always a pair; its out-tag is shared by the parent's bundle) */
  why: "detour" | "unroutable" | "panel";
  /** the detour ratio of the route this pair replaced (0 when the edge could not be routed) */
  ratio: number;
}
export interface DfdAudit {
  crossings: number;
  overlaps: number;
  boxHits: number;
  labelHits: number;
  /** cross-family edges longer than DFD_SHORT without an inline label */
  unlabelled: number;
  nonOrthogonal: number;
  /** routed edges that are detours (should always be 0: they become connector pairs) */
  detours: number;
}
export interface DfdLayout {
  mode: DfdMode;
  width: number;
  height: number;
  grid: number;
  radius: number;
  boxes: DfdBox[];
  lanes: DfdLane[];
  /** desktop, when any island exists: the chip shelf */
  shelf: DfdShelf | null;
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
  /** tallest the desktop sheet may be with tall boxes (default 848); taller → compact boxes */
  maxHeight?: number;
}

// the default measure: M PLUS Rounded 1c 700 advance widths (em) for the glyphs model names use,
// measured in the browser; anything else counts as 0.62 em (capitals) / 0.6 em
const EM_GLYPHS = " -.0123456789_abcdefghijklmnopqrstuvwxyz";
const EM_WIDTHS = [284,482,338,640,640,640,640,640,640,640,640,640,640,590,561,607,508,607,546,526,591,601,338,383,563,338,819,597,574,601,601,485,518,523,591,540,787,526,540,558];
const approxMeasure = (t: string, px: number) => {
  let em = 0;
  for (const ch of t) { const i = EM_GLYPHS.indexOf(ch); em += i >= 0 ? EM_WIDTHS[i] / 1000 : ch >= "A" && ch <= "Z" ? 0.65 : 0.6; }
  return em * px;
};
const up8 = (v: number) => Math.ceil(v / G) * G;
const byAddress = (addr: Map<string, string>) => (a: string, b: string) => addr.get(a)!.localeCompare(addr.get(b)!, "en", { numeric: true });
const depthCount = (g: Graph) => 1 + Math.max(0, ...g.names.map((n) => g.depth.get(n)!));
export const columnTitle = (c: number) => (c === 0 ? "Atoms" : `Gen ${c}`);
/** An atom nothing builds on (no edges in or out). */
const isIsland = (g: Graph, n: string) => g.atom.get(n)! && g.children.get(n)!.length === 0;

/** A name as one line, or as the two-line split with the shortest longest line. */
export function wrapName(text: string): string[][] {
  const out: string[][] = [[text]];
  const w = text.split(" ");
  for (let i = 1; i < w.length; i++) out.push([w.slice(0, i).join(" "), w.slice(i).join(" ")]);
  return out;
}

export function routeLength(pts: Pt[]): number {
  let len = 0;
  for (let k = 1; k < pts.length; k++) len += Math.abs(pts[k].x - pts[k - 1].x) + Math.abs(pts[k].y - pts[k - 1].y);
  return len;
}
/** Manhattan gap between two boxes (0 on an axis where they overlap). */
export function boxGap(s: Rect, t: Rect): number {
  const dx = Math.max(0, t.x - (s.x + s.w), s.x - (t.x + t.w));
  const dy = Math.max(0, t.y - (s.y + s.h), s.y - (t.y + t.h));
  return dx + dy;
}
/** Routed length ÷ the Manhattan distance between the two box centres (at least 4 tracks). */
export function detourRatio(pts: Pt[], s: Rect, t: Rect): number {
  const d = Math.abs(s.x + s.w / 2 - (t.x + t.w / 2)) + Math.abs(s.y + s.h / 2 - (t.y + t.h / 2));
  return routeLength(pts) / Math.max(4 * G, d);
}

// ———————————————————————————————————————— addresses

/**
 * Lineage addresses: atoms 1…n, derived models <primary parent's address>.<k>. `before` orders
 * the atoms and every brood. A finished sheet passes its READING order (sheetAddresses), so the
 * addresses count down the page: in a lane, a column (desktop) or the file tree (phone) never
 * reads 1.7 above 1.1. Without it (the phone search's seed): atoms in family order, most-built-on
 * first, broods by descendant count — graph-only.
 */
export function lineageAddresses(g: Graph, before?: (a: string, b: string) => number): Map<string, string> {
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
  const order = before ?? byDesc;
  const addr = new Map<string, string>();
  let k = 0;
  const atoms = (f: string[]) => f.filter((m) => g.atom.get(m)).sort(order);
  for (const n of before ? atoms(g.names) : g.families.flatMap((f) => atoms(g.membersOf.get(f)!))) addr.set(n, String(++k));
  const visit = (p: string) => {
    const kids = g.primaryChildren.get(p)!.filter((c) => !addr.has(c)).sort(order);
    kids.forEach((c, i) => addr.set(c, `${addr.get(p)}.${i + 1}`));
    kids.forEach(visit);
  };
  for (const n of [...addr.keys()]) visit(n);
  // anything left (a cycle cut by buildGraph) gets a trailing number
  for (const n of g.names) if (!addr.has(n)) addr.set(n, String(++k));
  return addr;
}

/** Addresses read off a finished sheet: `key` gives each node its reading position (compared
 * lexicographically), and the boxes are relabelled in place. Returns the address map. */
function sheetAddresses(g: Graph, boxes: DfdBox[], key: (b: DfdBox) => number[]): Map<string, string> {
  const pos = new Map(boxes.map((b) => [b.name, key(b)]));
  const before = (a: string, b: string) => {
    const p = pos.get(a) ?? [], q = pos.get(b) ?? [];
    for (let i = 0; i < Math.max(p.length, q.length); i++) if ((p[i] ?? -1) !== (q[i] ?? -1)) return (p[i] ?? -1) - (q[i] ?? -1);
    return a < b ? -1 : a > b ? 1 : 0;
  };
  const addr = lineageAddresses(g, before);
  for (const b of boxes) b.address = addr.get(b.name)!;
  return addr;
}

// ———————————————————————————————————————— ordering (rows inside lanes)

type Cells = Map<string, string[][]>; // family → [depth] → grid names in order

function cellsOf(g: Graph, depthCount: number): Cells {
  const cells: Cells = new Map();
  for (const f of g.families) cells.set(f, Array.from({ length: depthCount }, () => []));
  for (const n of g.names) if (!isIsland(g, n)) cells.get(g.family.get(n)!)![g.depth.get(n)!].push(n);
  return cells;
}
/** Grid rows a lane needs (its islands live on the shelf, not on the grid). */
function laneRows(g: Graph, f: string): number {
  const counts = new Map<number, number>();
  for (const n of g.membersOf.get(f)!) if (!isIsland(g, n)) counts.set(g.depth.get(n)!, (counts.get(g.depth.get(n)!) ?? 0) + 1);
  return Math.max(0, ...counts.values());
}
/** A lane's height in row pitches: grid rows + its head; a group of islands only has no lane. */
function laneUnits(g: Graph, f: string, pitch: number): number {
  const R = laneRows(g, f);
  return R ? R + D.laneHead / pitch : 0;
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
function orderDesktop(g: Graph, arr: Arrangement, sweeps: number, pitch: number): Map<string, number> {
  const nD = depthCount(g);
  const cells = cellsOf(g, nD);
  const R = new Map<string, number>(g.families.map((f) => [f, laneRows(g, f)]));
  const laneStart = new Map<string, number>();
  const stackOf = new Map<string, number>();
  arr.stacks.forEach((st, s) => {
    let y = 0;
    for (const f of st) { y += laneUnits(g, f, pitch) - R.get(f)!; laneStart.set(f, y); stackOf.set(f, s); y += R.get(f)!; }
  });
  const row = new Map<string, number>();
  const yIdx = (n: string) => laneStart.get(g.family.get(n)!)! + row.get(n)!;
  const gridEdges = g.edges.filter((e) => !isIsland(g, e.from) && !isIsland(g, e.to));
  // seed: grouped by primary parent
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
    // straight segments in (column, row) space, same stack only
    const segs = gridEdges.filter((e) => stackOf.get(g.family.get(e.from)!) === stackOf.get(g.family.get(e.to)!))
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
    for (const e of gridEdges) L += Math.abs(yIdx(e.from) - yIdx(e.to));
    return k * 100 + L;
  };
  let best = new Map(row), bestS = score();
  const fwdOrder = [...Array.from({ length: nD - 1 }, (_, i) => i + 1), 0];
  const backOrder = [...Array.from({ length: Math.max(0, nD - 1) }, (_, i) => nD - 2 - i), nD - 1];
  for (let s = 0; s < sweeps; s++) {
    const fwd = s % 2 === 0;
    for (const d of fwd ? fwdOrder : backOrder) {
      for (const f of g.families) {
        const cell = cells.get(f)![d];
        if (!cell || !cell.length) continue;
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
  shelf: DfdShelf | null;
  headers: DfdHeader[];
  /** x ranges of box columns: vertical runs are forbidden inside them (± clearance) */
  colBands: [number, number][];
  /** extra obstacles (labels, header text) */
  blocks: Rect[];
  /** x extent of each stack (a line may not stray outside the stacks of its two ends) */
  stackX: [number, number][];
  /** bottom of the last lane (nothing routes below it) */
  contentBottom: number;
  /** every node's address, read off this sheet (sheetAddresses) */
  addr: Map<string, string>;
}

function sheetDesktop(g: Graph, arr: Arrangement, rows: Map<string, number>,
  measure: (t: string, px: number) => number, maxWidth: number, boxH: number): Sheet {
  const pitch = boxH + D.rowGap;
  const grid = g.names.filter((n) => !isIsland(g, n));
  const famIn = (st: string[]) => (n: string) => st.includes(g.family.get(n)!);
  // each stack shows the generation columns its own grid boxes use
  const nCols = arr.stacks.map((st) => 1 + Math.max(0, ...grid.filter(famIn(st)).map((n) => g.depth.get(n)!)));
  // widths measured; wrap only when the sheet would be too wide
  const need = (n: string, lines: string[]) => up8(Math.max(...lines.map((l) => measure(l, DFD_NAME_PX))) + BOX_CHROME + (g.atom.get(n) ? DFD_ATOM_CELL : 0));
  const choice = new Map<string, string[]>();
  for (const n of g.names) choice.set(n, [words(n)]);
  const colW = () => arr.stacks.map((st, s) => Array.from({ length: nCols[s] }, (_, c) => {
    const ns = grid.filter((n) => famIn(st)(n) && g.depth.get(n) === c);
    const minW = up8(measure(columnTitle(c), 12) + 8);
    return Math.max(minW, 96, ...ns.map((n) => need(n, choice.get(n)!)));
  }));
  const total = (w: number[][]) => D.marginLeft + D.margin + D.corridor * (arr.stacks.length - 1) + w.reduce((s, ws) => s + ws.reduce((a, b) => a + b, 0) + D.gutter * (ws.length - 1), 0);
  let widths = colW();
  // wrap the names that save the most width first, until the sheet fits
  const cands = grid.filter((n) => words(n).includes(" ")).map((n) => {
    const opts = wrapName(words(n)).slice(1);
    const best = opts.reduce((a, b) => (Math.max(...a.map((l) => measure(l, DFD_NAME_PX))) <= Math.max(...b.map((l) => measure(l, DFD_NAME_PX))) ? a : b));
    return { n, best, save: need(n, [words(n)]) - need(n, best) };
  }).sort((a, b) => b.save - a.save || (a.n < b.n ? -1 : 1));
  for (const c of cands) {
    if (total(widths) <= maxWidth) break;
    choice.set(c.n, c.best);
    widths = colW();
  }
  // the greedy pass can overshoot: give back every wrap the sheet can still afford, cheapest first
  for (const c of [...cands].reverse()) {
    if (choice.get(c.n)!.length === 1) continue;
    choice.set(c.n, [words(c.n)]);
    const w = colW();
    if (total(w) <= maxWidth) widths = w;
    else choice.set(c.n, c.best);
  }
  const boxes: DfdBox[] = [], lanes: DfdLane[] = [], headers: DfdHeader[] = [], blocks: Rect[] = [];
  const colBands: [number, number][] = [];
  const stackX: [number, number][] = [];
  const width = total(widths);
  // the shelf: every island as a chip on one tray across the top, title + caption on its left,
  // the chips grouped by lane (in the stacks' reading order, then the islands-only groups), rows
  // wrapping at the right margin. It sits above the column headers: no generation claims a chip.
  const groupOrder = [...arr.stacks.flat(), ...g.families.filter((f) => !arr.stacks.flat().includes(f))];
  const islands = g.names.filter((n) => isIsland(g, n))
    .sort((a, b) => groupOrder.indexOf(g.family.get(a)!) - groupOrder.indexOf(g.family.get(b)!) || (a < b ? -1 : 1));
  let shelf: DfdShelf | null = null;
  let top0 = 0;
  if (islands.length) {
    const tw = up8(Math.max(measure(DFD_SHELF_TITLE, 13), measure(DFD_SHELF_TEXT, DFD_SHELF_PX)) + 8);
    const x0 = D.marginLeft + D.shelfPad, cx0 = x0 + tw + D.groupGap, xMax = width - D.margin - D.shelfPad;
    let cx = cx0, row = 0, prev = "";
    for (const n of islands) {
      const w = up8(measure(words(n), DFD_NAME_PX) + CHIP_CHROME);
      const f = g.family.get(n)!;
      if (prev) cx += f === prev ? D.chipGap : D.groupGap;
      if (cx + w > xMax && cx > cx0) { row++; cx = cx0; }
      boxes.push({
        name: n, family: f, depth: 0, atom: true, chip: true, stack: -1, lane: -1, col: 0, row,
        x: cx, y: D.shelfPad + row * D.chipRow, w, h: DFD_CHIP_H, lines: [words(n)], address: "",
      });
      cx += w;
      prev = f;
    }
    const h = D.shelfPad * 2 + (row + 1) * D.chipRow - (D.chipRow - DFD_CHIP_H);
    // title 16 + caption 14, 4 apart, centred on the first chip row (as a lane's name sits)
    const title = { x: x0, y: D.shelfPad + 3, w: tw, h: 16 };
    const caption = { x: x0, y: D.shelfPad + 23, w: tw, h: 14 };
    shelf = { x: D.marginLeft, y: 0, w: width - D.marginLeft - D.margin, h, title, caption };
    blocks.push(title, caption);
    top0 = h + D.shelfAfter;
  }
  let x = D.marginLeft;
  let height = 0, contentBottom = 0;
  arr.stacks.forEach((st, s) => {
    const colX: number[] = [];
    widths[s].forEach((w, c) => { colX.push(x); colBands.push([x, x + w]); x += w + (c < nCols[s] - 1 ? D.gutter : 0); });
    const x0 = colX[0], x1 = x;
    stackX.push([x0, x1]);
    x += D.corridor;
    colX.forEach((cx, c) => {
      const w = up8(measure(columnTitle(c), 12));
      headers.push({ text: columnTitle(c), x: cx, y: top0 + 4, w, depth: c, stack: s });
      blocks.push({ x: cx - 2, y: top0, w: w + 4, h: 18 });
    });
    let y = top0 + D.headRow + D.topChan;
    for (const f of st) {
      const R = laneRows(g, f);
      if (!R) continue; // a group of islands only: its chips are all on the shelf
      const laneIdx = lanes.length;
      const count = g.membersOf.get(f)!.length;
      const label = { x: x0, y: y + 3, w: up8(measure(f, 13) + measure(` ${count}`, 12) + 16), h: 16 };
      blocks.push(label);
      const top = y + D.laneHead;
      lanes.push({ family: f, stack: s, count, x: x0, y, w: x1 - x0, h: D.laneHead + R * pitch, label });
      for (const n of grid.filter((m) => g.family.get(m) === f)) {
        const c = g.depth.get(n)!;
        boxes.push({
          name: n, family: f, depth: c, atom: g.atom.get(n)!, chip: false, stack: s, lane: laneIdx, col: c, row: rows.get(n)!,
          x: colX[c], y: top + rows.get(n)! * pitch, w: widths[s][c], h: boxH, lines: choice.get(n)!, address: "",
        });
      }
      y = top + R * pitch;
    }
    contentBottom = Math.max(contentBottom, y);
    height = Math.max(height, y + D.bottom);
  });
  // reading order: the shelf (row by row, left → right), then the left stack and the right; lanes
  // top → bottom; in a lane the grid column by column, each top → bottom
  const addr = sheetAddresses(g, boxes, (b) => (b.chip ? [-1, b.row, b.x] : [b.stack, b.lane, b.col, b.row]));
  return { width, height: up8(height), boxes, lanes, shelf, headers, colBands, blocks, stackX, contentBottom, addr };
}

// ———————————————————————————————————————— the phone sheet: a two-page channel router
//
// One box column; lanes stacked. Inside a lane the rows are a FILE TREE: the pre-order
// walk of the primary-parent tree, each model directly followed by its brood, indented by
// generation. Every edge runs in one of the two gutters ("pages"): out of its parent's side,
// along a vertical track, into its child's SAME side. A parent's edges on one page share one
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
  constructor(g: Graph, addr: Map<string, string>) {
    this.names = g.names;
    this.n = g.names.length;
    const id = new Map(g.names.map((s, i) => [s, i]));
    const fams = g.families;
    this.laneOf = new Int32Array(this.n);
    g.names.forEach((s, i) => { this.laneOf[i] = fams.indexOf(g.family.get(s)!); });
    const order = byAddress(addr);
    this.kids = g.names.map((s) => g.primaryChildren.get(s)!.filter((c) => g.family.get(c) === g.family.get(s)).sort(order).map((c) => id.get(c)!));
    this.roots = fams.map((f) => g.membersOf.get(f)!.filter((s) => { const p = g.primary.get(s); return !p || g.family.get(p) !== f; }).sort(order).map((s) => id.get(s)!));
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
    // an off-sheet connector's tag sits in the gap above its box: those rows get tagRoom more
    const tagged = new Uint8Array(this.n);
    for (let i = 0; i < this.m; i++) if (this.off[i]) { tagged[this.ef[i]] = 1; tagged[this.et[i]] = 1; }
    let y = M.top;
    const walk = (b: number) => {
      if (top[b] >= 0) return;
      if (tagged[b]) y += M.tagRoom;
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
    for (let it = 0; it < iters; it++) {
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

interface PhoneResult { sheet: Sheet; edges: DfdEdge[]; lanes: string[]; off: { from: string; to: string }[] }

function phoneSheet(g: Graph, addr: Map<string, string>, measure: (t: string, px: number) => number): PhoneResult {
  const S = new PhoneSearch(g, addr);
  // lane order seed: islets (no cross-family edge) last, then the shortest cross-family reach
  const size = g.families.map((f) => g.membersOf.get(f)!.length);
  let bestP: number[] = S.lanes, bestC = Infinity;
  for (const p of permute(g.families.map((_, i) => i), 7)) {
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
  const colX = G * tracks[0] + 2 * G, colR = M.width - G * tracks[1] - 2 * G;
  const indent = (d: number) => Math.min(d, M.maxIndent) * DFD_INDENT;
  const widest = (ls: string[]) => Math.max(...ls.map((l) => measure(l, DFD_NAME_PX)));
  const fit = (s: string, w: number) => {
    const all = wrapName(words(s));
    for (const lines of all) if (widest(lines) + BOX_CHROME + (g.atom.get(s) ? DFD_ATOM_CELL : 0) <= w) return lines;
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
      const bx = colX + indent(g.depth.get(s)!);
      boxes.push({
        name: s, family: f, depth: g.depth.get(s)!, atom: g.atom.get(s)!, chip: false, stack: 0, lane: li, col: 0, row: r,
        x: bx, y: top[i], w: colR - bx, h: DFD_BOX_H, lines: fit(s, colR - bx), address: "",
      });
    });
  });
  // the generation ruler: one tick per indent step (drawn by the board, sticky under the bar)
  const nD = Math.min(depthCount(g), M.maxIndent + 1);
  const headers: DfdHeader[] = Array.from({ length: nD }, (_, d) => ({ text: String(d), x: colX + indent(d), y: 0, w: DFD_INDENT, depth: d, stack: 0 }));
  // geometry: every edge leaves its parent's side, rides its net's track, enters the child's same side
  const byName = new Map(boxes.map((b) => [b.name, b]));
  const edges: DfdEdge[] = [];
  const offEdges: { from: string; to: string }[] = [];
  for (let i = 0; i < S.m; i++) {
    const from = g.names[S.ef[i]], to = g.names[S.et[i]];
    if (S.off[i]) { offEdges.push({ from, to }); continue; }
    const pg = S.page[i], t = ev.track[i];
    const tx = pg === 0 ? colX - G * (t + 1) : colR + G * (t + 1);
    const xs = pg === 0 ? byName.get(from)!.x : colR, xt = pg === 0 ? byName.get(to)!.x : colR;
    edges.push({
      from, to, cross: g.family.get(from) !== g.family.get(to), side: pg === 0 ? "left" : "right", offSheet: false,
      points: [{ x: xs, y: ev.ys[i] }, { x: tx, y: ev.ys[i] }, { x: tx, y: ev.yt[i] }, { x: xt, y: ev.yt[i] }],
    });
  }
  const sheet: Sheet = {
    width: M.width, height: up8(bottom + M.top), boxes, lanes: lanesOut, shelf: null, headers, colBands: [[colX, colR]], blocks,
    stackX: [[0, M.width]], contentBottom: bottom,
    // the file tree reads top → bottom (lanes in their sheet order)
    addr: sheetAddresses(g, boxes, (b) => [b.y]),
  };
  return { sheet, edges, lanes: order, off: offEdges };
}

// ———————————————————————————————————————— the router

const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
const BEND = 4;
const JOIN = 1;
const CROWD = 0.3;
const SOFT = 30; // price per grid step through another source's line (rip-up search)
const MAX_RIPS = 3;
/** desktop arrangements routed once / given the full routing search */
const ARR_QUICK = 4;
const ARR_FULL = 2;
const PORT_LANE = 1.5;
/** a backward out-port (the parent's LEFT side) costs this much more than its right one */
const BACK_PORT = 1;

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
  /** grid points on a swim-lane rule: a line may cross a rule, never run along it */
  onRule: Uint8Array;
  locked: Uint8Array = new Uint8Array(0);
  /** boxes with an out-port (set per routeAll) */
  sources = new Set<string>();
  heap = new MinHeap();
  g: Float64Array;
  came: Int32Array;
  touched: number[] = [];
  sheet: Sheet;
  byName: Map<string, DfdBox>;

  constructor(sheet: Sheet) {
    this.sheet = sheet;
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
    this.onRule = new Uint8Array(this.N);
    for (const l of sheet.lanes) {
      if (l.y % G) continue;
      for (let x = Math.ceil(l.x / G) * G; x <= l.x + l.w; x += G) this.onRule[this.at(x, l.y)] = 1;
    }
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
    // the sheet's own edges are never a track (the margin's one track sits a step inside them)
    for (let j = 0; j < this.ny; j++) { this.blocked[j * this.nx] = 1; this.blocked[j * this.nx + this.nx - 1] = 1; }
    for (let i = 0; i < this.nx; i++) {
      const x = i * G;
      this.vBand[i] = sheet.colBands.every(([a, b]) => x <= a - G || x >= b + G) ? 1 : 0;
    }
    // every grid box keeps its own doorways: the track just outside each in-port side and its
    // out-port start (island chips have no lines, so they keep no doors)
    sheet.boxes.forEach((b, k) => {
      if (b.chip) return;
      const tag = (x: number, y: number) => { const p = this.at(x, y); if (p >= 0 && p < this.N && !this.blocked[p] && !this.resv[p]) this.resv[p] = k + 1; };
      tag(b.x + b.w + G, b.y + 24);
      const lane = (x: number, y: number) => { const p = this.at(x, y); if (p >= 0 && p < this.N && !this.blocked[p]) this.portLane[p] = k + 1; };
      for (let y = b.y; y <= b.y + b.h; y += G) lane(b.x - 2 * G, y);
      // an atom has no in-ports, so its left side keeps no doors (that track is the margin's)
      if (!b.atom) for (let y = b.y + G; y <= b.y + b.h - G; y += G) tag(b.x - G, y);
    });
  }

  at(x: number, y: number) { return Math.round(y / G) * this.nx + Math.round(x / G); }
  xy(p: number): Pt { return { x: (p % this.nx) * G, y: Math.floor(p / this.nx) * G }; }
  free(p: number) { return p >= 0 && p < this.N && !this.blocked[p] && !this.owner[p]; }

  /** Out-ports: the right side's middle; for a child wholly to the LEFT, also the left side
   * (a second root), so a backward line crosses straight over instead of hooking round. */
  outOpts(b: DfdBox, back: boolean): OutOpt[] {
    const midY = b.y + 24;
    const opts: OutOpt[] = [{ start: this.at(b.x + b.w + G, midY), port: { x: b.x + b.w, y: midY }, side: "right", dir: 0, cost: 0 }];
    if (back) {
      for (const dy of [0, -G, G, -2 * G, 2 * G]) {
        const y = midY + dy;
        if (y < b.y + G || y > b.y + b.h - G) continue;
        opts.push({ start: this.at(b.x - G, y), port: { x: b.x, y }, side: "left", dir: 2, cost: BACK_PORT + Math.abs(dy) / G * 0.6 });
      }
    }
    return opts.filter((o) => this.free(o.start));
  }

  inOpts(b: DfdBox, own: Uint8Array, soft: boolean, fromRight: boolean): PortOpt[] {
    const opts: PortOpt[] = [];
    const foreignOk = (p: number) => !this.owner[p] || own[p] === 1 || (soft && !this.locked[this.owner[p] - 1]);
    const ok = (p: number) => p >= 0 && p < this.N && !this.blocked[p] && foreignOk(p) && (!this.resv[p] || this.resv[p] === this.idx.get(b.name)! + 1);
    const side = (s: DfdSide, cost: number) => {
      if (s === "left" || s === "right") {
        const sx = s === "left" ? b.x : b.x + b.w;
        const dx = s === "left" ? -G : G;
        for (let y = b.y + G; y <= b.y + b.h - G; y += G) {
          const pre = this.at(sx + dx, y), prepre = this.at(sx + 2 * dx, y);
          if (ok(pre) && ok(prepre)) opts.push({ pre, prepre, port: { x: sx, y }, side: s, dir: s === "left" ? 0 : 2, cost: cost + Math.abs(y - (b.y + 24)) / G * 0.6 });
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
    // a line from a parent RIGHT of the box (another stack) may enter a childless box on its
    // right side instead of hooking over it into its top; a parent to the left never does
    // (two arrowheads meeting nose to nose read as a two-way edge)
    side("left", 0); side("top", 6); side("bottom", 6);
    if (fromRight && !this.sources.has(b.name)) side("right", 6);
    return opts;
  }

  reset() {
    for (const s of this.touched) { this.g[s] = Infinity; this.came[s] = -1; }
    this.touched.length = 0;
  }

  /** A* from start states to any port option; returns the grid points start → pre-port. */
  search(starts: { p: number; d: number; c: number }[], goals: PortOpt[], own: Uint8Array, keys: [number, number], soft = 0): { pts: number[]; goal: PortOpt; cost: number } | null {
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
        if (nd % 2 === 0 && this.onRule[q] && this.onRule[p]) continue;
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
   * and queued again. A source ripped MAX_RIPS times is locked in place, and so is a
   * `pinned` source from the start (one whose line detoured last time: it keeps its direct
   * route and the line that pushed it round has to give way instead).
   */
  routeAll(nets: { src: string; targets: string[] }[], cross: (a: string, b: string) => boolean, pinned: Set<string> = new Set()): RouteResult {
    this.owner.fill(0);
    this.sources = new Set(nets.map((n) => n.src));
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
      this.locked[ni] = rips[ni] >= MAX_RIPS || pinned.has(nets[ni].src) ? 1 : 0;
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
    const rootSides = new Set<DfdSide>();
    /** which out-port's tree each grid point belongs to */
    const treeSide = new Map<number, DfdSide>();
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
      const tb = this.byName.get(t)!;
      const back = tb.x + tb.w <= sb.x - G;
      let res: { pts: number[]; goal: PortOpt; cost: number } | null = null;
      let outs: OutOpt[] = [];
      for (const soft of [0, SOFT]) {
        const goals = this.inOpts(tb, own, soft > 0, sb.x > tb.x + tb.w).filter((o) => !own[o.pre] && (!own[o.prepre] || (rootAt.size > 0 && !reserved.has(o.prepre))));
        // a fresh out-port (one per side), or any joinable tree point
        outs = this.outOpts(sb, back).filter((o) => !rootAt.has(o.start) && !own[o.start] && !rootSides.has(o.side));
        const starts: { p: number; d: number; c: number }[] = [
          ...outs.map((o) => ({ p: o.start, d: o.dir, c: o.cost + (rootAt.size ? 2 : 0) })),
          // a child to the right never hangs off the backward (left-side) trunk
          ...joinable.filter((p) => !reserved.has(p) && (back || treeSide.get(p) !== "left")).map((p) => ({ p, d: 4, c: JOIN })),
        ];
        res = goals.length && starts.length ? this.search(starts, goals, own, keys, soft) : null;
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
      if (fresh) { rootAt.set(first, fresh); rootSides.add(fresh.side); parent.set(first, -1); }
      const prefix = pathTo(first);
      const root = rootAt.get(prefix[0])!;
      const rootPort = root.port;
      for (const p of res.pts) treeSide.set(p, root.side);
      for (let k = 1; k < res.pts.length; k++) parent.set(res.pts[k], res.pts[k - 1]);
      for (const p of res.pts) { own[p] = 1; this.owner[p] = ni + 1; netPts[ni].push(p); }
      for (const p of res.pts) if (p !== res.goal.pre && p !== res.goal.prepre) joinable.push(p);
      reserved.add(res.goal.pre); reserved.add(res.goal.prepre);
      const gridPts = [...prefix, ...res.pts.slice(1)];
      const pts: Pt[] = [rootPort, ...gridPts.map((p) => this.xy(p)), res.goal.port];
      netEdges[ni].push({ from: net.src, to: t, cross: cross(net.src, t), points: simplify(pts), side: res.goal.side, offSheet: false });
    }
  }

  /**
   * One extra net routed over finished line work: every edge in `existing` is a locked
   * obstacle. The net's source may be a pseudo box (a hub tag) that is not on the sheet.
   */
  routeOver(existing: DfdEdge[], net: { src: string; targets: string[] }, cross: (a: string, b: string) => boolean): { edges: DfdEdge[]; failed: number } {
    this.owner.fill(0);
    const ids = new Map<string, number>();
    for (const e of existing) {
      if (!e.points.length) continue;
      if (!ids.has(e.from)) ids.set(e.from, ids.size + 1);
      const id = ids.get(e.from)!;
      for (let k = 1; k < e.points.length; k++) {
        const a = e.points[k - 1], b = e.points[k];
        const n = Math.round((Math.abs(b.x - a.x) + Math.abs(b.y - a.y)) / G);
        for (let i = 0; i <= n; i++) {
          const q = this.at(a.x + Math.sign(b.x - a.x) * i * G, a.y + Math.sign(b.y - a.y) * i * G);
          if (q >= 0 && q < this.N) this.owner[q] = id;
        }
      }
    }
    const ni = ids.size;
    this.locked = new Uint8Array(ni + 1).fill(1);
    this.sources = new Set([net.src]);
    const netPts: number[][] = Array.from({ length: ni + 1 }, () => []);
    const netEdges: DfdEdge[][] = Array.from({ length: ni + 1 }, () => []);
    const netFailed: { from: string; to: string }[][] = Array.from({ length: ni + 1 }, () => []);
    this.routeNet(ni, net, cross, netPts, netEdges, netFailed, new Float64Array(ni + 1), () => {});
    return { edges: netEdges[ni], failed: netFailed[ni].length };
  }

  /**
   * The lane's left gutter. An edge that came back a detour (or with no route at all) gets one
   * more try once every other line is down: out of its parent's LEFT side and round the margin
   * track beside the stack (DFD_G px off the boxes, like every other track). The zoo's case:
   * transformer's comb fills its whole column, and mamba's line out of the atom column cuts
   * across any trunk that climbs to text diffusion above it — round the left it is one clean
   * elbow, not a connector pair inside one lane. Kept only when the new line is no detour.
   */
  salvage(res: RouteResult, bad: (e: DfdEdge) => boolean, cross: (a: string, b: string) => boolean): void {
    const redo: { from: string; to: string; old?: DfdEdge }[] = [
      ...res.edges.filter(bad).map((e) => ({ from: e.from, to: e.to, old: e })),
      ...res.failed.map((f) => ({ from: f.from, to: f.to })),
    ];
    for (const r of redo) {
      const sb = this.byName.get(r.from)!, tb = this.byName.get(r.to)!;
      // every other line (this parent's own comb included) is an obstacle: the new branch is a
      // second root, so it may neither cross nor join the first
      this.owner.fill(0);
      const ids = new Map<string, number>();
      for (const e of res.edges) {
        if (e === r.old) continue;
        if (!ids.has(e.from)) ids.set(e.from, ids.size + 1);
        const id = ids.get(e.from)!;
        for (let k = 1; k < e.points.length; k++) {
          const a = e.points[k - 1], b = e.points[k];
          const n = Math.round((Math.abs(b.x - a.x) + Math.abs(b.y - a.y)) / G);
          for (let i = 0; i <= n; i++) {
            const q = this.at(a.x + Math.sign(b.x - a.x) * i * G, a.y + Math.sign(b.y - a.y) * i * G);
            if (q >= 0 && q < this.N) this.owner[q] = id;
          }
        }
      }
      this.locked = new Uint8Array(ids.size + 1).fill(1);
      const starts = this.outOpts(sb, true).filter((o) => o.side === "left").map((o) => ({ p: o.start, d: o.dir, c: o.cost }));
      const own = new Uint8Array(this.N);
      const goals = this.inOpts(tb, own, false, sb.x > tb.x + tb.w);
      const keys: [number, number] = [this.idx.get(r.from)! + 1, this.idx.get(r.to)! + 1];
      const found = starts.length && goals.length ? this.search(starts, goals, own, keys, 0) : null;
      if (!found) continue;
      const first = found.pts[0];
      const y = Math.floor(first / this.nx) * G;
      const e: DfdEdge = {
        from: r.from, to: r.to, cross: cross(r.from, r.to), side: found.goal.side, offSheet: false,
        points: simplify([{ x: sb.x, y }, ...found.pts.map((q) => this.xy(q)), found.goal.port]),
      };
      if (bad(e)) continue;
      res.edges = [...res.edges.filter((x) => x !== r.old), e];
      res.failed = res.failed.filter((f) => !(f.from === r.from && f.to === r.to));
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
/** Does segment s come within m px of rect r? */
function segRect(s: { a: Pt; b: Pt }, r: Rect, m: number): boolean {
  const x0 = Math.min(s.a.x, s.b.x), x1 = Math.max(s.a.x, s.b.x), y0 = Math.min(s.a.y, s.b.y), y1 = Math.max(s.a.y, s.b.y);
  return x0 < r.x + r.w + m && x1 > r.x - m && y0 < r.y + r.h + m && y1 > r.y - m;
}
const diag = (r: Rect) => ({ a: { x: r.x, y: r.y }, b: { x: r.x + r.w, y: r.y + r.h } });

export function segmentsOf(edges: { from: string; points: Pt[] }[]): Seg[] {
  const out: Seg[] = [];
  edges.forEach((e, i) => {
    for (let k = 1; k < e.points.length; k++) out.push({ a: e.points[k - 1], b: e.points[k], e: i, src: e.from });
  });
  return out;
}

/** The two stubs of every connector pair, as edges (the out stub ends at a tag, not a box). */
function stubEdges(off: DfdOffSheet[]): DfdEdge[] {
  return off.flatMap((o) => [
    { from: o.from, to: `${o.to}#tag`, cross: false, points: o.out.stub, side: "left" as DfdSide, offSheet: false },
    { from: o.from, to: o.to, cross: false, points: o.in.stub, side: "left" as DfdSide, offSheet: false },
  ]);
}

/** Is an edge a detour: too long for the gap it spans, or straying outside its two stacks (the
 * margin track one step outside a stack still counts as the stack's own: the lane's left gutter)? */
function isDetour(e: DfdEdge, sheet: Pick<Sheet, "stackX" | "contentBottom">, by: Map<string, DfdBox>): boolean {
  if (e.points.length < 2 || e.hub) return false;
  const s = by.get(e.from)!, t = by.get(e.to)!;
  if (detourRatio(e.points, s, t) > DFD_DETOUR_MAX) return true;
  const [ax0, ax1] = sheet.stackX[s.stack], [bx0, bx1] = sheet.stackX[t.stack];
  const x0 = Math.min(ax0, bx0), x1 = Math.max(ax1, bx1);
  return e.points.some((p) => p.x < x0 - G || p.x > x1 + G || p.y > sheet.contentBottom);
}

/** The sheet's own proof: crossings / overlaps between different sources, box hits, label hits. */
export function auditDfd(l: { boxes: DfdBox[]; edges: DfdEdge[]; labels: DfdLabel[]; offSheet?: DfdOffSheet[] }, sheet?: Pick<Sheet, "stackX" | "contentBottom">): DfdAudit {
  const off = l.offSheet ?? [];
  const all = [...l.edges.filter((e) => e.points.length), ...stubEdges(off)];
  const segs = segmentsOf(all);
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
  all.forEach((e) => {
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
    for (const b of l.boxes) if (segRect(diag(lab), b, 0)) labelHits++;
    for (const s of segs) {
      const e = all[s.e];
      // the line the gap is cut in
      if (own.has(`${e.from}->${e.to}`) && (lab.along === "h" ? horiz(s) && s.a.y === lab.y + lab.h / 2 : !horiz(s) && s.a.x === lab.x + lab.w / 2)) continue;
      if (segRect(s, lab, 1)) labelHits++;
    }
    for (const o of l.labels) if (o !== lab && segRect(diag(o), lab, 2)) labelHits += 0.5;
  }
  // connector tags: clear of every box, every line but their own stub, every label and tag
  const tags = off.flatMap((o) => [o.out, o.in]);
  for (const t of tags) {
    for (const b of l.boxes) if (segRect(diag(t), b, 0)) labelHits++;
    for (const s of segs) {
      const e = all[s.e];
      if (e.points === t.stub) continue;
      // a hub's own lines start on its tag
      if (e.hub && s.a === e.points[0] && (s.a.x === t.x || s.a.x === t.x + t.w) && s.a.y > t.y && s.a.y < t.y + t.h) continue;
      if (segRect(s, t, 1)) labelHits++;
    }
    for (const o of [...l.labels, ...tags]) if (o !== t && segRect(diag(o), t, 2)) labelHits += 0.5;
  }
  const labelled = new Set(l.labels.flatMap((x) => x.edges));
  const unlabelled = l.edges.filter((e) => e.cross && !e.offSheet && !e.hub && routeLength(e.points) > DFD_SHORT && !labelled.has(`${e.from}->${e.to}`)).length;
  const detours = sheet ? l.edges.filter((e) => isDetour(e, sheet, byName)).length : 0;
  return { crossings, overlaps, boxHits, labelHits: Math.round(labelHits), unlabelled, nonOrthogonal, detours };
}

// ———————————————————————————————————————— frames: a parent's lines must never box boxes in

/** An arm shorter than this (one box) does not close a frame. */
const FRAME_ARM = 48;

/** Union of 1-D intervals. */
function mergeSpans(spans: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const [a, b] of [...spans].sort((p, q) => p[0] - q[0])) {
    const z = out[out.length - 1];
    if (z && a <= z[1]) z[1] = Math.max(z[1], b);
    else out.push([a, b]);
  }
  return out;
}

export interface DfdFrame {
  /** the parent whose lines draw the frame */
  src: string;
  /** the boxes inside it */
  boxes: string[];
  /** the run the frame's two arms turn off (y for a U, x for a C) and its extent */
  horiz: boolean;
  at: number;
  span: [number, number];
}

/**
 * Boxes framed by ONE parent's line work. Its runs are merged per track; two arms at least
 * FRAME_ARM long that leave one run the same way draw a U (or, off a vertical run, a C). The U
 * is a FRAME when line work (anyone's) also runs along its open side, over at least half its
 * width, between the ends of its two arms: then the boxes whose centres lie inside read as
 * boxed in, a group the data does not have. A comb never does this (its taps are short); a
 * bus that loops round a column and meets another line over the top does.
 */
export function framedBoxes(l: { boxes: DfdBox[]; edges: DfdEdge[] }): DfdFrame[] {
  const out: DfdFrame[] = [];
  const bySrc = new Map<string, Seg[]>();
  const every = segmentsOf(l.edges.filter((e) => e.points.length > 1));
  // how much of [k0, k1] the line work along tracks lo..hi covers (horizontal runs for a U)
  const cover = (horizRun: boolean, k0: number, k1: number, lo: number, hi: number) => {
    const spans: [number, number][] = [];
    for (const s of every) {
      if (horiz(s) !== horizRun || (s.a.x === s.b.x && s.a.y === s.b.y)) continue;
      const t = horizRun ? s.a.y : s.a.x;
      if (t < lo || t > hi) continue;
      const a = Math.max(k0, horizRun ? Math.min(s.a.x, s.b.x) : Math.min(s.a.y, s.b.y));
      const b = Math.min(k1, horizRun ? Math.max(s.a.x, s.b.x) : Math.max(s.a.y, s.b.y));
      if (b > a) spans.push([a, b]);
    }
    return mergeSpans(spans).reduce((n, [a, b]) => n + b - a, 0) / Math.max(1, k1 - k0);
  };
  for (const s of every) {
    if (!bySrc.has(s.src)) bySrc.set(s.src, []);
    bySrc.get(s.src)!.push(s);
  }
  for (const [src, segs] of bySrc) {
    // per orientation: tracks → merged spans
    for (const horizRun of [true, false]) {
      const along = new Map<number, [number, number][]>(), across = new Map<number, [number, number][]>();
      for (const s of segs) {
        const h = horiz(s);
        if (s.a.x === s.b.x && s.a.y === s.b.y) continue;
        const key = h ? s.a.y : s.a.x;
        const span: [number, number] = h ? [Math.min(s.a.x, s.b.x), Math.max(s.a.x, s.b.x)] : [Math.min(s.a.y, s.b.y), Math.max(s.a.y, s.b.y)];
        const m = h === horizRun ? along : across;
        if (!m.has(key)) m.set(key, []);
        m.get(key)!.push(span);
      }
      const acrossM = new Map([...across].map(([k, v]) => [k, mergeSpans(v)]));
      // how far the arm at track `k` runs from `c` towards lower (−1) / higher (+1) values
      const arm = (k: number, c: number, dir: -1 | 1) => {
        const sp = acrossM.get(k)?.find(([a, b]) => a <= c && c <= b);
        return sp ? (dir < 0 ? c - sp[0] : sp[1] - c) : 0;
      };
      for (const [c, spans] of along) {
        for (const [a, b] of mergeSpans(spans)) {
          // every arm that leaves this run (at its ends or at a T on it), each way
          const ks = [...acrossM.keys()].filter((k) => k >= a && k <= b).sort((p, q) => p - q);
          for (const dir of [-1, 1] as const) {
            const arms = ks.filter((k) => arm(k, c, dir) >= FRAME_ARM);
            for (let i = 0; i + 1 < arms.length; i++) {
              const k0 = arms[i], k1 = arms[i + 1];
              const a0 = arm(k0, c, dir), a1 = arm(k1, c, dir);
              const reach = Math.min(a0, a1), far = Math.max(a0, a1);
              // the open side: line work between the two arms' ends (a track's slack either way)
              const e0 = c + dir * (reach - 2 * G), e1 = c + dir * (far + G);
              if (cover(horizRun, k0, k1, Math.min(e0, e1), Math.max(e0, e1)) < 0.5) continue;
              const lo = Math.min(c, c + dir * far), hi = Math.max(c, c + dir * far);
              const inside = l.boxes.filter((bx) => {
                const px = bx.x + bx.w / 2, py = bx.y + bx.h / 2;
                const [u, v] = horizRun ? [px, py] : [py, px];
                return u > k0 && u < k1 && v > lo && v < hi;
              }).map((bx) => bx.name);
              if (inside.length) out.push({ src, boxes: inside, horiz: horizRun, at: c, span: [k0, k1] });
            }
          }
        }
      }
    }
  }
  return out;
}

// ———————————————————————————————————————— inline labels: one per trunk

/** Width of a turned label's gap: clears the line's neighbours one track (8 px) away with 1.5 px to spare. */
const TURN_W = 12;
const edgeKey = (e: { from: string; to: string }) => `${e.from}->${e.to}`;

/**
 * Inline labels name the PARENT of a cross-family line ("4 transformer"), once per trunk (the
 * tree of lines leaving one out-port). The gap is cut where most of the trunk's cross-family
 * lines run together, preferring a run no same-family line of that parent shares (on the
 * parent's own comb the name is redundant). A line too short to need one (≤ DFD_SHORT) gets
 * none; a bare address is never printed.
 */
function placeLabels(edges: DfdEdge[], boxes: DfdBox[], addr: Map<string, string>, measure: (t: string, px: number) => number,
  width: number, height: number, lanes: DfdLane[], avoid: Rect[] = []): DfdLabel[] {
  // a label laid level never sits on a swim-lane rule (it would read as the lane's own caption);
  // a turned one may cut through a rule like the line it is cut into
  const rules: Rect[] = lanes.map((l) => ({ x: l.x, y: l.y, w: l.w, h: 1 }));
  const labels: DfdLabel[] = [];
  const segs = segmentsOf(edges);
  const H = DFD_LABEL_PX + 3;
  const trunks = new Map<string, DfdEdge[]>();
  for (const e of edges) {
    // a hub's lines are named by the hub's own tag
    if (!e.cross || e.offSheet || e.hub || e.points.length < 2) continue;
    const k = `${e.from}@${e.points[0].x},${e.points[0].y}`;
    if (!trunks.has(k)) trunks.set(k, []);
    trunks.get(k)!.push(e);
  }
  for (const trunk of trunks.values()) {
    if (trunk.every((e) => routeLength(e.points) <= DFD_SHORT)) continue;
    const src = trunk[0].from;
    const crossKeys = new Set(trunk.map(edgeKey));
    const text = `${addr.get(src)} ${words(src)}`;
    const w = Math.ceil(measure(text, DFD_LABEL_PX)) + 8;
    let best: { lab: DfdLabel; score: number } | null = null;
    const seen = new Set<string>();
    for (const e of trunk) {
      for (let k = 1; k < e.points.length; k++) {
        const a = e.points[k - 1], b = e.points[k];
        const h = a.y === b.y;
        const len = h ? Math.abs(a.x - b.x) : Math.abs(a.y - b.y);
        // horizontal: a gap cut along the line; vertical: text across it, or turned to read up it
        const modes: ("h" | "v" | "turn")[] = h ? (len >= w + 2 * DFD_R + 4 ? ["h"] : []) : [
          ...(len >= H + 2 * DFD_R + 8 ? ["v" as const] : []), ...(len >= w + 2 * DFD_R + 8 ? ["turn" as const] : []),
        ];
        for (const mode of modes) {
          const lo = h ? Math.min(a.x, b.x) + DFD_R + 2 : Math.min(a.y, b.y) + DFD_R + 4;
          const hi = h ? Math.max(a.x, b.x) - DFD_R - 2 : Math.max(a.y, b.y) - DFD_R - 4;
          const span = mode === "v" ? H : w;
          const mid = Math.round((lo + hi) / 2);
          const tries = [0];
          for (let s = G; s < (hi - lo) / 2; s += G) tries.push(s, -s);
          for (const d of tries) {
            const c0 = mid + d - span / 2;
            if (c0 < lo || c0 + span > hi) continue;
            const rect: Rect = mode === "h" ? { x: c0, y: a.y - H / 2, w, h: H } : mode === "turn" ? { x: a.x - TURN_W / 2, y: c0, w: TURN_W, h: w } : { x: a.x - w / 2, y: c0, w, h: H };
            const id = `${mode}:${rect.x},${rect.y}`;
            if (seen.has(id)) continue;
            seen.add(id);
            if (rect.x < 2 || rect.y < 2 || rect.x + rect.w > width - 2 || rect.y + rect.h > height - 2) continue;
            // the lines the gap cuts: runs of this same source along this line through the rect
            const own = new Set<string>();
            let bad = false;
            for (const s of segs) {
              if (!segRect(s, rect, 1.5)) continue;
              const o = edges[s.e];
              const along = h ? s.a.y === a.y && s.b.y === a.y : s.a.x === a.x && s.b.x === a.x;
              if (o.from === src && along) { own.add(edgeKey(o)); continue; }
              bad = true; break;
            }
            if (bad) continue;
            if (boxes.some((bx) => segRect(diag(rect), bx, 0.5))) continue;
            if (labels.some((o) => segRect(diag(o), rect, 3))) continue;
            if (avoid.some((o) => segRect(diag(o), rect, 3))) continue;
            if (mode !== "turn" && rules.some((u) => segRect(diag(u), rect, 2))) continue;
            const cover = [...own].filter((k2) => crossKeys.has(k2)).length;
            const shared = [...own].some((k2) => !crossKeys.has(k2));
            const score = (shared ? 1000 : 0) - cover * 100 + (mode === "h" ? 0 : mode === "v" ? 10 : 20) - Math.min(len, 400) * 0.02 + Math.abs(d) * 0.01;
            if (!best || score < best.score - 1e-9) {
              best = { lab: { text, ...rect, edges: [...new Set([...own, ...crossKeys])], along: h ? "h" : "v", ...(mode === "turn" ? { turn: true } : {}) }, score };
            }
          }
        }
      }
    }
    if (best) labels.push(best.lab);
  }
  return labels;
}

// ———————————————————————————————————————— connector tags

interface TagCtx {
  boxes: DfdBox[];
  segs: { a: Pt; b: Pt }[];
  rects: Rect[];
  rules: Rect[];
  width: number;
  height: number;
  measure: (t: string, px: number) => number;
}
const UNIT: Record<DfdSide, Pt> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 } };
const OPPOSITE: Record<DfdSide, DfdSide> = { left: "right", right: "left", top: "bottom", bottom: "top" };

/** Width of a connector tag for `text` (padding + the pointed tip). */
const tagWidth = (text: string, measure: (t: string, px: number) => number) => Math.ceil(measure(text, DFD_TAG_PX)) + 12 + DFD_TAG_TIP;

/**
 * One end of a connector pair: a stub straight out of a free port on box `b`, ending in a
 * tag beyond it that names `lines` (one far end each). Candidates: every side in `sides`
 * (preference order), every port position on it, stub lengths 12–40 px and three tag
 * alignments; the first clean one by score wins.
 */
function placeTag(b: DfdBox, role: "out" | "in", lines: DfdTag["lines"], sides: DfdSide[], ctx: TagCtx): DfdTag | null {
  const tw = Math.max(...lines.map((l) => tagWidth(l.text, ctx.measure)));
  const { text, address } = lines[0];
  let best: { tag: DfdTag; score: number } | null = null;
  sides.forEach((side, si) => {
    const u = UNIT[side];
    const along = side === "left" || side === "right";
    // a tag on a vertical stub carries its tip below / above its text: 4 px taller
    const th = DFD_TAG_H + (lines.length - 1) * DFD_TAG_LINE + (along ? 0 : DFD_TAG_NOTCH);
    const pos: number[] = [];
    if (along) for (let y = b.y + G; y <= b.y + b.h - G; y += G) pos.push(y);
    else for (let x = Math.ceil((b.x + 2 * G) / G) * G; x <= b.x + b.w - 2 * G; x += G) pos.push(x);
    const pref = along ? b.y + 24 : b.x + b.w / 2;
    for (const p of pos) {
      const P = along ? { x: side === "left" ? b.x : b.x + b.w, y: p } : { x: p, y: side === "top" ? b.y : b.y + b.h };
      for (const L of [12, 16, 24, 32, 40]) {
        const Q = { x: P.x + u.x * L, y: P.y + u.y * L };
        const rects: Rect[] = along
          ? [{ x: u.x > 0 ? Q.x : Q.x - tw, y: P.y - th / 2, w: tw, h: th }]
          : [0, 1, 2].map((k) => ({ x: k === 0 ? P.x - tw / 2 : k === 1 ? P.x - 12 : P.x - tw + 12, y: u.y > 0 ? Q.y : Q.y - th, w: tw, h: th }));
        rects.forEach((r, align) => {
          const score = si * 1000 + L * 3 + Math.abs(p - pref) * 0.5 + align * 4;
          if (best && score >= best.score) return;
          const stub = { a: P, b: Q };
          if (r.x < 2 || r.y < 2 || r.x + r.w > ctx.width - 2 || r.y + r.h > ctx.height - 2) return;
          for (const o of ctx.boxes) {
            if (o !== b && segRect(stub, o, G - 0.5)) return;
            if (segRect(diag(r), o, 3)) return;
          }
          const sb = { x: Math.min(P.x, Q.x), y: Math.min(P.y, Q.y), w: Math.abs(P.x - Q.x), h: Math.abs(P.y - Q.y) };
          for (const s of ctx.segs) if (segRect(s, sb, 3) || segRect(s, r, 3)) return;
          for (const o of ctx.rects) if (segRect(diag(o), r, 3) || segRect(stub, o, 2)) return;
          for (const o of ctx.rules) if (segRect(diag(o), r, 2) || segRect(stub, o, 0)) return;
          const tip = role === "out" ? side : OPPOSITE[side];
          best = { tag: { ...r, text, address, lines, tip, stub: role === "out" ? [P, Q] : [Q, P] }, score };
        });
      }
    }
  });
  return best ? (best as { tag: DfdTag }).tag : null;
}

/** A connector pair for edge from → to, or null where either end finds no clean spot. */
function placePair(from: string, to: string, why: DfdOffSheet["why"], ratio: number, mode: DfdMode, ctx: TagCtx, by: Map<string, DfdBox>, addr: Map<string, string>): DfdOffSheet | null {
  const s = by.get(from)!, t = by.get(to)!;
  const outSides: DfdSide[] = mode === "desktop" ? ["right", "bottom", "top", "left"] : ["top"];
  const inSides: DfdSide[] = mode === "desktop" ? ["left", "top", "bottom", "right"] : ["top"];
  // the full "address name"; where no spot holds it, the address alone (still unambiguous)
  const tag = (b: DfdBox, role: "out" | "in", far: string, sides: DfdSide[], c: TagCtx) =>
    placeTag(b, role, [{ text: `${addr.get(far)} ${words(far)}`, address: addr.get(far)!, name: far }], sides, c)
    ?? placeTag(b, role, [{ text: addr.get(far)!, address: addr.get(far)!, name: far }], sides, c);
  const out = tag(s, "out", to, outSides, ctx);
  if (!out) return null;
  const ctx2 = { ...ctx, segs: [...ctx.segs, { a: out.stub[0], b: out.stub[1] }], rects: [...ctx.rects, out] };
  const inn = tag(t, "in", from, inSides, ctx2);
  return inn ? { from, to, out, in: inn, why, ratio: +ratio.toFixed(3) } : null;
}

/** The out-end of a parent's lines into the OTHER stack: one tag on the parent naming every far
 * end (a line each, in address order), out of the side that faces the other stack first. */
function placeBundle(from: string, far: string[], ctx: TagCtx, by: Map<string, DfdBox>, addr: Map<string, string>): DfdTag | null {
  const s = by.get(from)!;
  const toRight = by.get(far[0])!.stack > s.stack;
  const sides: DfdSide[] = toRight ? ["right", "bottom", "top", "left"] : ["left", "bottom", "top", "right"];
  return placeTag(s, "out", far.map((t) => ({ text: `${addr.get(t)} ${words(t)}`, address: addr.get(t)!, name: t })), sides, ctx)
    ?? placeTag(s, "out", far.map((t) => ({ text: addr.get(t)!, address: addr.get(t)!, name: t })), sides, ctx);
}

/**
 * The in-end of a parent's lines into the other stack as ONE hub: a tag naming the parent in a
 * free grid cell of the children's stack, left of them all, and a small comb routed from it to
 * each child over the finished line work (so a hub's lines never cross another). The nearest
 * cell whose comb routes with no detour wins.
 */
function placeHub(sheet: Sheet, from: string, far: string[], edges: DfdEdge[], ctx: TagCtx, by: Map<string, DfdBox>,
  addr: Map<string, string>, cross: (a: string, b: string) => boolean): { tag: DfdTag; edges: DfdEdge[] } | null {
  const kids = far.map((t) => by.get(t)!);
  const stack = kids[0].stack;
  const grid = sheet.boxes.filter((b) => !b.chip && b.stack === stack);
  const boxH = grid[0].h, pitch = boxH + D.rowGap;
  const text = `${addr.get(from)} ${words(from)}`;
  const w = up8(tagWidth(text, ctx.measure));
  const minX = Math.min(...kids.map((b) => b.x)), cy = kids.reduce((a, b) => a + b.y + b.h / 2, 0) / kids.length;
  const cols = [...new Set(grid.map((b) => b.x))];
  const cands: Rect[] = [];
  for (const l of sheet.lanes.filter((x) => x.stack === stack)) {
    for (let y = l.y + D.laneHead; y + boxH <= l.y + l.h; y += pitch) {
      for (const x of cols) {
        const r = { x, y, w, h: boxH };
        if (x + w + 2 * G > minX) continue; // left of every child: the comb flows right
        if (sheet.boxes.some((b) => segRect(diag(r), b, G - 0.5))) continue;
        if (ctx.segs.some((sg) => segRect(sg, r, G - 0.5))) continue;
        if (ctx.rects.some((o) => segRect(diag(o), r, 3))) continue;
        cands.push(r);
      }
    }
  }
  cands.sort((a, b) => (minX - (a.x + a.w)) + Math.abs(a.y + a.h / 2 - cy) - ((minX - (b.x + b.w)) + Math.abs(b.y + b.h / 2 - cy)) || a.y - b.y || a.x - b.x);
  for (const r of cands.slice(0, 12)) {
    const hub: DfdBox = { name: `#hub:${from}`, family: by.get(from)!.family, depth: 0, atom: true, chip: false, stack, lane: -1, col: 0, row: 0, ...r, lines: [], address: "" };
    const router = new Router({ ...sheet, boxes: [...sheet.boxes, hub] });
    const got = router.routeOver(edges, { src: hub.name, targets: [...far].sort() }, cross);
    if (got.failed || got.edges.some((e) => detourRatio(e.points, hub, by.get(e.to)!) > DFD_DETOUR_MAX)) continue;
    const midY = r.y + 24; // the router's out-port row
    return {
      tag: { x: r.x, y: midY - DFD_TAG_H / 2, w, h: DFD_TAG_H, text, address: addr.get(from)!, lines: [{ text, address: addr.get(from)!, name: from }], tip: "right", stub: [] },
      edges: got.edges.map((e) => ({ ...e, from, hub: true })),
    };
  }
  return null;
}

// ———————————————————————————————————————— the whole pass

function permute<T>(xs: T[], cap = Infinity): T[][] {
  if (xs.length <= 1) return [xs.slice()];
  // beyond `cap` items the order is kept (an exhaustive search would explode)
  if (xs.length > cap) return [xs.slice()];
  const out: T[][] = [];
  xs.forEach((x, i) => { for (const p of permute([...xs.slice(0, i), ...xs.slice(i + 1)])) out.push([x, ...p]); });
  return out;
}

/** Candidate stack arrangements, best first by a cheap proxy (stack balance, backward and long cross-lane edges). */
function arrangements(g: Graph, pitch: number, cap = Infinity): Arrangement[] {
  // a group of islands only has no lane (its chips are on the shelf)
  const fams = g.families.filter((f) => laneRows(g, f) > 0);
  const units = new Map(fams.map((f) => [f, laneUnits(g, f, pitch)]));
  if (fams.length === 1) return [{ stacks: [fams] }];
  const proxy = (stacks: string[][]) => {
    const pos = new Map<string, { s: number; y: number }>();
    stacks.forEach((st, s) => { let y = 0; for (const f of st) { pos.set(f, { s, y: y + units.get(f)! / 2 }); y += units.get(f)!; } });
    let c = 0;
    for (const e of g.edges) {
      if (!e.cross) continue;
      const a = pos.get(g.family.get(e.from)!), b = pos.get(g.family.get(e.to)!);
      if (!a || !b) continue; // an island group has no lane
      // a line inside a stack is wire (its rows apart); one between the stacks is a connector
      // pair, a fixed price (dearer backwards)
      c += a.s !== b.s ? 6 + (a.s > b.s ? 10 : 0) : Math.abs(a.y - b.y);
      // …whose out-tag needs room beside its parent: a one-row lane has none (the line gets wired)
      if (a.s !== b.s && laneRows(g, g.family.get(e.from)!) < 2) c += 12;
    }
    // a family with no cross-family edge sits at the bottom of its stack
    stacks.forEach((st) => st.forEach((f, i) => { if (g.islet.has(f) && i !== st.length - 1) c += 4; }));
    // balance: the taller stack sets the sheet's height
    const h = stacks.map((st) => st.reduce((s, f) => s + units.get(f)!, 0));
    // a stack taller than the sheet's envelope forces compact boxes on every lane
    return c + Math.abs(h[0] - h[1]) * 2 + (Math.max(...h) > cap + 1e-9 ? 40 : 0);
  };
  const cands: { a: Arrangement; s: number }[] = [];
  const height = (A: string[]) => A.reduce((s, f) => s + units.get(f)!, 0);
  const splits: [string[], string[]][] = [];
  if (fams.length <= 8) {
    let bestH = Infinity;
    const all: { A: string[]; B: string[]; h: number }[] = [];
    for (let mask = 1; mask < (1 << fams.length) - 1; mask++) {
      const A = fams.filter((_, i) => mask & (1 << i)), B = fams.filter((_, i) => !(mask & (1 << i)));
      const h = Math.max(height(A), height(B));
      all.push({ A, B, h });
      bestH = Math.min(bestH, h);
    }
    // near-balanced splits (within one row of the best) compete on wire
    for (const s of all) if (s.h <= bestH + 1 + 1e-9) splits.push([s.A, s.B]);
  } else {
    // many groups: greedy balance, tallest first
    const A: string[] = [], B: string[] = [];
    for (const f of [...fams].sort((p, q) => units.get(q)! - units.get(p)! || (p < q ? -1 : 1))) (height(A) <= height(B) ? A : B).push(f);
    splits.push([A, B]);
  }
  for (const [A, B] of splits) {
    for (const pa of permute(A, 5)) for (const pb of permute(B, 5)) cands.push({ a: { stacks: [pa, pb] }, s: proxy([pa, pb]) });
  }
  cands.sort((p, q) => p.s - q.s || JSON.stringify(p.a.stacks).localeCompare(JSON.stringify(q.a.stacks)));
  return cands.map((c) => c.a);
}

/**
 * Wire quality of a routed sheet (lower is better): total length + a price per bend, plus a
 * steep price on every DETOUR — wire beyond 1.3× an edge's Manhattan reach (+ 6 tracks of
 * slack). Clean routing alone is not enough: the first clean arrangement used to win even when
 * its hub's lines ran round the page margin at 2–2.5× their reach.
 */
export function wireQuality(edges: DfdEdge[], boxes: DfdBox[]): number {
  const by = new Map(boxes.map((b) => [b.name, b]));
  let q = 0;
  for (const e of edges) {
    if (e.points.length < 2) continue;
    const len = routeLength(e.points);
    const s = by.get(e.from)!, t = by.get(e.to)!;
    const reach = boxGap(s, t) + 2 * G;
    q += len + 16 * (e.points.length - 2) + 3 * Math.max(0, len - 1.3 * reach - 6 * G);
  }
  return q;
}

function routeSheet(sheet: Sheet, g: Graph, budget: number, score: (r: RouteResult) => number, wired: Set<string> = new Set()): { res: RouteResult; tries: number } {
  const router = new Router(sheet);
  const cross = (a: string, b: string) => g.family.get(a) !== g.family.get(b);
  const byName = new Map(sheet.boxes.map((b) => [b.name, b]));
  // real wires stay inside one stack; the lines between the stacks are connector pairs (finish),
  // except `wired` ones (their tags found no clean spot)
  const nets0 = g.names.map((n) => ({ src: n, targets: g.children.get(n)!.filter((t) => byName.get(t)!.stack === byName.get(n)!.stack || wired.has(`${n}->${t}`)).sort() }))
    .filter((n) => n.targets.length);
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
  for (const start of orders.slice(0, budget > 1 ? orders.length : 1)) {
    let order = start;
    const pinned = new Set<string>();
    for (let it = 0; it < 3 && tries < budget; it++) {
      tries++;
      const res = router.routeAll(order, cross, pinned);
      router.salvage(res, (e) => isDetour(e, sheet, byName), cross);
      res.cost = score(res);
      if (!best || res.cost < best.cost) best = res;
      // a source with an unroutable edge or a detour goes first next time, pinned (never
      // ripped): its line takes the direct channel and the others find their way round it
      const bad = new Set([...res.failed.map((f) => f.from), ...res.edges.filter((e) => isDetour(e, sheet, byName)).map((e) => e.from)]);
      if (!bad.size) break;
      for (const b of bad) pinned.add(b);
      order = [...order.filter((n) => bad.has(n.src)), ...order.filter((n) => !bad.has(n.src))];
    }
  }
  return { res: best!, tries };
}

interface Finished {
  edges: DfdEdge[]; labels: DfdLabel[]; offSheet: DfdOffSheet[]; score: number;
  /** lines between the stacks whose connector tags found no clean spot (they get routed instead) */
  unpanel: { from: string; to: string }[];
}

/**
 * From routes to a finished sheet: detours (worst first) and unroutable edges become connector
 * pairs within the budget; then inline labels are cut, one per trunk. Scored for comparison:
 * unplaced edges ≫ unlabelled ≫ wire quality + CONNECTOR_COST per pair.
 */
function finish(sheet: Sheet, routed: DfdEdge[], failed: { from: string; to: string }[], mode: DfdMode,
  measure: (t: string, px: number) => number, panel: { from: string; to: string }[] = []): Finished {
  const addr = sheet.addr;
  const by = new Map(sheet.boxes.map((b) => [b.name, b]));
  // the phone's channel router cannot detour (every line is out → track → in); only the maze router can
  const detours = routed.filter((e) => mode === "desktop" && isDetour(e, sheet, by))
    .map((e) => ({ e, r: detourRatio(e.points, by.get(e.from)!, by.get(e.to)!) }))
    .sort((a, b) => b.r - a.r || (edgeKey(a.e) < edgeKey(b.e) ? -1 : 1));
  const want: { from: string; to: string; why: DfdOffSheet["why"]; ratio: number; e?: DfdEdge }[] = [
    ...failed.map((f) => ({ ...f, why: "unroutable" as const, ratio: 0 })),
    ...detours.map((d) => ({ from: d.e.from, to: d.e.to, why: "detour" as const, ratio: d.r, e: d.e })),
  ].slice(0, DFD_OFFSHEET_MAX);
  const cut = new Set(want.filter((w) => w.e).map((w) => w.e!));
  let edges = routed.filter((e) => !cut.has(e));
  const rules = sheet.lanes.map((l) => ({ x: l.x, y: l.y, w: l.w, h: 1 }));
  const offSheet: DfdOffSheet[] = [];
  let unplaced = failed.length - want.filter((w) => w.why === "unroutable").length;
  // the lines between the stacks first: one bundle per parent
  const bundles = new Map<string, string[]>();
  const unpanel: { from: string; to: string }[] = [];
  for (const p of panel) bundles.set(p.from, [...(bundles.get(p.from) ?? []), p.to]);
  const famOf = (n: string) => by.get(n.startsWith("#hub:") ? n.slice(5) : n)!.family;
  const cross = (a: string, b: string) => famOf(a) !== famOf(b);
  const ctxNow = (extra: { segs?: { a: Pt; b: Pt }[]; rects?: Rect[] } = {}): TagCtx => ({
    boxes: sheet.boxes, rules, width: sheet.width, height: sheet.height, measure,
    segs: [...segmentsOf(edges), ...stubEdges(offSheet).flatMap((e) => segmentsOf([e])), ...(extra.segs ?? [])],
    rects: [...sheet.blocks, ...offSheet.flatMap((o) => [o.out, o.in]), ...(extra.rects ?? [])],
  });
  for (const [from, tos] of [...bundles].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const far = [...tos].sort(byAddress(addr));
    const out = placeBundle(from, far, ctxNow(), by, addr);
    const fail = () => { unplaced += far.length; unpanel.push(...far.map((to) => ({ from, to }))); };
    if (!out) { fail(); continue; }
    const withOut = { segs: [{ a: out.stub[0], b: out.stub[1] }], rects: [out as Rect] };
    // one in-tag per child (one child) / one hub and its comb (several), each the other's fallback
    const singles = (): DfdOffSheet[] | null => {
      const ps: DfdOffSheet[] = [];
      const extra = { segs: [...withOut.segs], rects: [...withOut.rects] };
      for (const t of far) {
        const tb = by.get(t)!;
        const sides: DfdSide[] = tb.stack > by.get(from)!.stack ? ["left", "top", "bottom", "right"] : ["right", "top", "bottom", "left"];
        const text = `${addr.get(from)} ${words(from)}`;
        const inn = placeTag(tb, "in", [{ text, address: addr.get(from)!, name: from }], sides, ctxNow(extra))
          ?? placeTag(tb, "in", [{ text: addr.get(from)!, address: addr.get(from)!, name: from }], sides, ctxNow(extra));
        if (!inn) return null;
        ps.push({ from, to: t, out, in: inn, why: "panel", ratio: 0 });
        extra.segs.push({ a: inn.stub[0], b: inn.stub[1] });
        extra.rects.push(inn);
      }
      return ps;
    };
    const hub = (): DfdOffSheet[] | null => {
      const h = placeHub(sheet, from, far, [...edges, ...stubEdges(offSheet), { from, to: "#out", cross: false, points: out.stub, side: "left", offSheet: false }], ctxNow(withOut), by, addr, cross);
      if (!h) return null;
      edges = [...edges, ...h.edges];
      return far.map((t) => ({ from, to: t, out, in: h.tag, why: "panel" as const, ratio: 0 }));
    };
    const ps = far.length > 1 ? hub() ?? singles() : singles() ?? hub();
    if (ps) offSheet.push(...ps);
    else fail();
  }
  for (const w of want) {
    const segs = [...segmentsOf(edges), ...stubEdges(offSheet).flatMap((e) => segmentsOf([e]))];
    const ctx: TagCtx = { boxes: sheet.boxes, segs, rects: [...sheet.blocks, ...offSheet.flatMap((o) => [o.out, o.in])], rules, width: sheet.width, height: sheet.height, measure };
    const pair = placePair(w.from, w.to, w.why, w.ratio, mode, ctx, by, addr);
    if (pair) offSheet.push(pair);
    else if (w.e) edges = [...edges, w.e]; // no clean spot for its tags: the line stays (a detour)
    else unplaced++;
  }
  edges.sort((a, b) => (edgeKey(a) < edgeKey(b) ? -1 : 1));
  const labels = placeLabels(edges, sheet.boxes, addr, measure, sheet.width, sheet.height, sheet.lanes, offSheet.flatMap((o) => [o.out, o.in]));
  const unl = auditDfd({ boxes: sheet.boxes, edges, labels }).unlabelled;
  // a pair cut out of a hub's comb leaves a gap in it: each sibling line of the source adds HUB_GAP
  const siblings = (src: string) => routed.filter((e) => e.from === src).length - 1;
  const score = unplaced * 1e6 + unl * 1e4 + wireQuality(edges, sheet.boxes) + FRAME_COST * framedBoxes({ boxes: sheet.boxes, edges }).length
    + offSheet.reduce((s2, o) => s2 + (o.why === "panel" ? PANEL_COST : CONNECTOR_COST + HUB_GAP * siblings(o.from)), 0);
  // a hub's lines are routed edges already; every other pair is an edge with no route
  const routedKeys = new Set(edges.map(edgeKey));
  const offEdges: DfdEdge[] = offSheet.filter((o) => !routedKeys.has(edgeKey(o)))
    .map((o) => ({ from: o.from, to: o.to, cross: by.get(o.from)!.family !== by.get(o.to)!.family, points: [], side: "left", offSheet: true }));
  return { edges: [...edges, ...offEdges].sort((a, b) => (edgeKey(a) < edgeKey(b) ? -1 : 1)), labels, offSheet, score, unpanel };
}

/** Lay out and route a directed graph as a DFD sheet. `fam` maps every node to its group (lane). */
export function buildDfd(input: DfdGraphInput, fam: FamilyMap, opts: DfdOptions): DfdLayout {
  // the graph builder reads only names and builds_on; the rest of a taxonomy is not needed
  const g = buildGraph({ mechanisms: {}, compositions: [], models: input.models.map((m) => ({ name: m.name, builds_on: m.builds_on, level: "derived", introduces: [], note: "", description: "" })) }, fam);
  const measure = opts.measure ?? approxMeasure;
  const layoutOf = (mode: DfdMode, sheet: Sheet, f: Finished, stacks: string[][], attempts: number): DfdLayout => {
    const layout: DfdLayout = {
      mode, width: sheet.width, height: sheet.height, grid: G, radius: DFD_R,
      boxes: sheet.boxes, lanes: sheet.lanes, shelf: sheet.shelf, headers: sheet.headers, edges: f.edges, labels: f.labels, offSheet: f.offSheet,
      stacks, audit: { crossings: 0, overlaps: 0, boxHits: 0, labelHits: 0, unlabelled: 0, nonOrthogonal: 0, detours: 0 }, attempts,
    };
    layout.audit = auditDfd(layout, mode === "desktop" ? sheet : undefined);
    return layout;
  };
  if (opts.mode === "mobile") {
    const ph = phoneSheet(g, lineageAddresses(g), measure);
    return layoutOf("mobile", ph.sheet, finish(ph.sheet, ph.edges, ph.off, "mobile", measure), [ph.lanes], 1);
  }
  // Two rounds: every one of the ARR_QUICK best arrangements (by the cheap proxy) is routed
  // once; the ARR_FULL best of those (more, while none places every edge) get the full routing
  // search; the winner has the best finished score (connector pairs priced in).
  const maxW = opts.maxWidth ?? 1424, maxH = opts.maxHeight ?? 848;
  const rowsOf = new Map<Sheet, { rows: Map<string, number>; boxH: number }>();
  const sheetFor = (arr: Arrangement) => {
    for (const boxH of [DFD_BOX_TALL, DFD_BOX_H]) {
      const pitch = boxH + D.rowGap;
      const rows = orderDesktop(g, arr, 8, pitch);
      const sh = sheetDesktop(g, arr, rows, measure, maxW, boxH);
      rowsOf.set(sh, { rows, boxH });
      if (sh.height <= maxH || boxH === DFD_BOX_H) return sh;
    }
    throw new Error("unreachable");
  };
  const panelOf = (sheet: Sheet) => {
    const st = new Map(sheet.boxes.map((b) => [b.name, b.stack]));
    return g.edges.filter((e) => st.get(e.from) !== st.get(e.to)).map((e) => ({ from: e.from, to: e.to }));
  };
  // route, finish; a line between the stacks whose tags found no spot is routed as a wire, once
  let attempts = 0;
  const solve = (sheet: Sheet, budget: number): Finished => {
    const wired = new Set<string>();
    let f: Finished | null = null;
    for (let pass = 0; pass < 2; pass++) {
      const panel = panelOf(sheet).filter((p) => !wired.has(edgeKey(p)));
      const { res, tries } = routeSheet(sheet, g, budget, (r) => finish(sheet, r.edges, r.failed, "desktop", measure, panel).score, wired);
      attempts += tries;
      f = finish(sheet, res.edges, res.failed, "desktop", measure, panel);
      if (!f.unpanel.length) break;
      for (const p of f.unpanel) wired.add(edgeKey(p));
    }
    return f!;
  };
  // the envelope in tall rows: the sheet's height less the shelf (one chip row) and the header band
  const tallPitch = DFD_BOX_TALL + D.rowGap;
  const shelfH = g.names.some((n) => isIsland(g, n)) ? D.shelfPad * 2 + DFD_CHIP_H + D.shelfAfter : 0;
  const cap = (maxH - shelfH - D.headRow - D.topChan) / tallPitch;
  const quick = arrangements(g, tallPitch, cap).slice(0, ARR_QUICK).map((arr) => {
    const sheet = sheetFor(arr);
    return { arr, sheet, score: solve(sheet, 1).score };
  }).sort((a, b) => a.score - b.score);
  let best: { sheet: Sheet; f: Finished; arr: Arrangement } | null = null;
  for (const [i, { arr, sheet }] of quick.entries()) {
    // past the first ARR_FULL, only while nothing has placed every edge yet
    if (i >= ARR_FULL && best && best.f.score < 1e6) break;
    const f = solve(sheet, 6);
    if (!best || f.score < best.f.score) best = { sheet, f, arr };
  }
  // repair a frame: move the box at either end of the frame's base run (the parent, or a child
  // its base leads to) to another free row of its own column, and keep the best frame-free sheet
  for (let round = 0; round < 2; round++) {
    const { sheet, f, arr } = best!;
    const fr = framedBoxes({ boxes: sheet.boxes, edges: f.edges })[0];
    if (!fr) break;
    const { rows, boxH } = rowsOf.get(sheet)!;
    const onBase = (e: DfdEdge) => e.points.some((p, k) => k > 0 && (fr.horiz
      ? p.y === fr.at && e.points[k - 1].y === fr.at && Math.max(p.x, e.points[k - 1].x) > fr.span[0] && Math.min(p.x, e.points[k - 1].x) < fr.span[1]
      : p.x === fr.at && e.points[k - 1].x === fr.at && Math.max(p.y, e.points[k - 1].y) > fr.span[0] && Math.min(p.y, e.points[k - 1].y) < fr.span[1]));
    const movers = [fr.src, ...f.edges.filter((e) => e.from === fr.src && !e.hub && onBase(e)).map((e) => e.to)]
      .filter((n, i, a) => a.indexOf(n) === i && rows.has(n));
    let cand: { sheet: Sheet; score: number } | null = null;
    for (const n of movers) {
      const b = sheet.boxes.find((x) => x.name === n)!;
      const R = Math.round((sheet.lanes[b.lane].h - D.laneHead) / (boxH + D.rowGap));
      const taken = new Set(sheet.boxes.filter((x) => !x.chip && x.lane === b.lane && x.col === b.col).map((x) => x.row));
      for (let r = 0; r < R; r++) {
        if (taken.has(r)) continue;
        const rows2 = new Map(rows).set(n, r);
        const sh = sheetDesktop(g, arr, rows2, measure, maxW, boxH);
        rowsOf.set(sh, { rows: rows2, boxH });
        const q = solve(sh, 1);
        if (framedBoxes({ boxes: sh.boxes, edges: q.edges }).length < framedBoxes({ boxes: sheet.boxes, edges: f.edges }).length && (!cand || q.score < cand.score)) cand = { sheet: sh, score: q.score };
      }
    }
    if (!cand) break;
    const f2 = solve(cand.sheet, 6);
    if (f2.score < f.score) best = { sheet: cand.sheet, f: f2, arr };
    else break;
  }
  return layoutOf("desktop", best!.sheet, best!.f, best!.arr.stacks, attempts);
}

// ———————————————————————————————————————— drawing helpers (shared by every renderer)

const fmt = (v: number) => (Math.round(v * 100) / 100).toString();

/** An orthogonal polyline as an SVG path of straight runs and quarter arcs of ONE radius (no Béziers). */
export function elbowD(pts: Pt[], r = DFD_R): string {
  if (!pts.length) return "";
  let d = `M${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const ux = Math.sign(b.x - a.x), uy = Math.sign(b.y - a.y), vx = Math.sign(c.x - b.x), vy = Math.sign(c.y - b.y);
    const p1 = { x: b.x - ux * r, y: b.y - uy * r }, p2 = { x: b.x + vx * r, y: b.y + vy * r };
    const sweep = ux * vy - uy * vx > 0 ? 1 : 0;
    d += ` L${fmt(p1.x)} ${fmt(p1.y)} A${r} ${r} 0 0 ${sweep} ${fmt(p2.x)} ${fmt(p2.y)}`;
  }
  const z = pts[pts.length - 1];
  return `${d} L${fmt(z.x)} ${fmt(z.y)}`;
}

/** Filled arrowhead whose tip sits on the last point, pointing along the last run. */
export function arrowD(pts: Pt[], len = 7, half = 3.6): string {
  const z = pts[pts.length - 1], y = pts[pts.length - 2];
  const ux = Math.sign(z.x - y.x), uy = Math.sign(z.y - y.y);
  const bx = z.x - ux * len, by = z.y - uy * len;
  return `M${fmt(z.x)} ${fmt(z.y)} L${fmt(bx - uy * half)} ${fmt(by + ux * half)} L${fmt(bx + uy * half)} ${fmt(by - ux * half)} Z`;
}

/** The polyline stopped `d` px short of its end, so an arrowhead keeps a clean point. */
export function trimEnd(pts: Pt[], d = 5): Pt[] {
  const z = pts[pts.length - 1], y = pts[pts.length - 2];
  const ux = Math.sign(z.x - y.x), uy = Math.sign(z.y - y.y);
  return [...pts.slice(0, -1), { x: z.x - ux * d, y: z.y - uy * d }];
}

/** A connector tag's outline: a rectangle with a pointed tip on its `tip` side (the off-page connector shape). */
export function tagD(t: Rect & { tip: DfdSide }, tip = DFD_TAG_TIP): string {
  const { x, y, w, h } = t, x1 = x + w, y1 = y + h, my = y + h / 2, mx = x + w / 2;
  switch (t.tip) {
    case "right": return `M${x} ${y} H${x1 - tip} L${x1} ${my} L${x1 - tip} ${y1} H${x} Z`;
    case "left": return `M${x1} ${y} H${x + tip} L${x} ${my} L${x + tip} ${y1} H${x1} Z`;
    case "bottom": return `M${x} ${y} H${x1} V${y1 - DFD_TAG_NOTCH} H${mx + 5} L${mx} ${y1} L${mx - 5} ${y1 - DFD_TAG_NOTCH} H${x} Z`;
    case "top": return `M${x} ${y + DFD_TAG_NOTCH} H${mx - 5} L${mx} ${y} L${mx + 5} ${y + DFD_TAG_NOTCH} H${x1} V${y1} H${x} Z`;
  }
}

/** Internals for the router's own tests and dumps (not part of the skin contract). */
export const __dfd = { Router, sheetDesktop, orderDesktop, arrangements, routeSheet, placeLabels, phoneSheet, PhoneSearch, isDetour, finish };
