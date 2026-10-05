// The octilinear system-map engine (Beck / Vignelli), independent of any data
// set: give it lines, stations and drafted paths on a cell grid (SystemSpec,
// documented in DESIGN.md) and it returns px geometry, station marks, label
// boxes and an audit that holds the drawing to the genre: no crossings, no
// collinear overlaps, no line through a station it does not serve, every leg
// 0/45/90°, no label touching a label, a track, a station or a reserved area.
//
// Stations without an authored cell are placed by a deterministic fallback
// (placeAuto): a straight spur from a station already on its line, to the
// nearest free cell whose spur and name collide with nothing. What it cannot
// place is listed in `unplaced`, never lost.
//
// Pure + deterministic, no DOM: node --test runs it (lib/world/metro.test.ts).
import { roundedD, polylineLength, samplePolyline } from "../../lib/world/path.ts";
import { GRID, MARK, SHEET, TYPE } from "./tokens.ts";

export type Side = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
export interface Pt { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }
export type Anchor = "start" | "middle" | "end";

/** A path entry: a station id, or a bare corner cell [x, y]. */
export type PathEntry = string | [number, number];

/** ———— the input: everything a system map needs ———— */
export interface SystemSpec {
  /** drafting sheet in cells (one cell = GRID.pitch px) */
  cols: number;
  rows: number;
  /** key order; `color` is the line's track colour */
  lines: { id: string; name: string; color: string }[];
  stations: SpecStation[];
  /** per line id: paths in riding order (the train rides the longest) */
  routes: Record<string, PathEntry[][]>;
  /** quiet area names (cells), drawn under the map and kept clear */
  areas?: { id: string; name: string; x: number; y: number; anchor: Anchor }[];
  /** reserved rects (cells) nothing may touch, e.g. the in-map key */
  reserved?: { id: string; x: number; y: number; w: number; h: number }[];
}
export interface SpecStation {
  id: string;
  label: string;
  /** lines that must call here, the station's own line first */
  lines: string[];
  /** drawn as a lettered bullet (an elementary node) */
  origin?: boolean;
  symbol?: string;
  /** upstream ids: preferred anchors for the fallback, and the tooltip */
  parents?: string[];
  /** authored cell + label side; omit to let placeAuto find one */
  at?: { x: number; y: number; side: Side };
}

/** ———— the output ———— */
export type StationKind = "origin" | "tick" | "interchange";
export interface MapStation {
  id: string;
  label: string;
  symbol: string;
  x: number;
  y: number;
  side: Side;
  kind: StationKind;
  lines: string[];
  parents: string[];
  /** unit vector of the tick (towards the label), for tick stations */
  tick: Pt;
  /** a one-line station where its only track ends: drawn as a bar across the line end */
  terminus: boolean;
  /** placed by the fallback, not the drafting */
  auto: boolean;
  text: { x: number; y: number; anchor: Anchor };
  box: Rect;
}
export interface MapPath { stations: string[]; points: Pt[]; d: string; length: number; auto: boolean }
export interface MapLine {
  id: string;
  name: string;
  color: string;
  paths: MapPath[];
  stations: string[];
  interchanges: number;
  /** the longest path: the one the line's train rides */
  trainPath: number;
}
export interface MapAudit {
  crossings: number;
  overlaps: number;
  passThrough: number;
  labelCollisions: number;
  offGrid: number;
  serviceMismatch: string[];
  details: string[];
}
export interface SystemLayout {
  width: number;
  height: number;
  stations: MapStation[];
  lines: MapLine[];
  areas: { id: string; name: string; x: number; y: number; anchor: Anchor }[];
  reserved: { id: string; box: Rect }[];
  audit: MapAudit;
  /** ids the fallback placed (their spurs are drawn dashed) */
  auto: string[];
  /** ids nobody could place */
  unplaced: string[];
}

const G = GRID.pitch;
const px = (c: number) => c * G;
const textWidth = (s: string, bold = false, size: number = TYPE.label) =>
  s.length * size * (bold ? TYPE.emBold : TYPE.emRegular);

const SIDE_VEC: Record<Side, Pt> = {
  n: { x: 0, y: -1 }, s: { x: 0, y: 1 }, e: { x: 1, y: 0 }, w: { x: -1, y: 0 },
  ne: { x: 1, y: -1 }, nw: { x: -1, y: -1 }, se: { x: 1, y: 1 }, sw: { x: -1, y: 1 },
};

/** A name `gap` px from the centre on `side`, lowercase centred on the station row. */
function placeText(x: number, y: number, side: Side, w: number, gap: number) {
  const { ascent: ASC, descent: DESC } = TYPE;
  const mid = y + ASC / 2 - 0.5;
  const dg = gap * 0.72; // a diagonal name keeps the same clear distance
  let tx = x, ty = mid, anchor: Anchor = "start";
  switch (side) {
    case "e": tx = x + gap; break;
    case "w": tx = x - gap; anchor = "end"; break;
    case "n": ty = y - gap - DESC; anchor = "middle"; break;
    case "s": ty = y + gap + ASC; anchor = "middle"; break;
    case "ne": tx = x + dg; ty = y - dg - DESC; break;
    case "nw": tx = x - dg; ty = y - dg - DESC; anchor = "end"; break;
    case "se": tx = x + dg; ty = y + dg + ASC; break;
    case "sw": tx = x - dg; ty = y + dg + ASC; anchor = "end"; break;
  }
  const left = anchor === "start" ? tx : anchor === "end" ? tx - w : tx - w / 2;
  return { text: { x: tx, y: ty, anchor }, box: { x: left, y: ty - ASC, w, h: ASC + DESC } };
}

/** How far a station's mark reaches towards its name. */
function markExtent(kind: StationKind, terminus: boolean, tick: Pt, side: Side): number {
  if (kind === "origin") return MARK.origin.extent;
  if (kind === "interchange") return MARK.ring.extent;
  const sv = norm(SIDE_VEC[side]);
  const along = Math.abs(tick.x * sv.x + tick.y * sv.y);
  const reach = terminus ? MARK.terminus.extent : MARK.tick.extent;
  return Math.max(along * reach, GRID.track / 2 + 1);
}

// ———— geometry ————

type Seg = { a: Pt; b: Pt; line: string };
const EPS = 1e-6;
const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const same = (p: Pt, q: Pt) => Math.abs(p.x - q.x) < EPS && Math.abs(p.y - q.y) < EPS;
const onSeg = (p: Pt, a: Pt, b: Pt) =>
  Math.abs(cross(a, b, p)) < EPS && p.x >= Math.min(a.x, b.x) - EPS && p.x <= Math.max(a.x, b.x) + EPS
  && p.y >= Math.min(a.y, b.y) - EPS && p.y <= Math.max(a.y, b.y) + EPS;
const sub = (a: Pt, b: Pt) => ({ x: a.x - b.x, y: a.y - b.y });
const norm = (v: Pt) => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };
const collinear = (a: Pt, b: Pt, c: Pt) => Math.abs(cross(a, b, c)) < EPS;

/** "cross" = proper crossing, "overlap" = collinear shared length, "touch" = endpoint contact, null = apart. */
function relate(s: Seg, t: Seg): "cross" | "overlap" | "touch" | null {
  const d1 = cross(t.a, t.b, s.a), d2 = cross(t.a, t.b, s.b);
  const d3 = cross(s.a, s.b, t.a), d4 = cross(s.a, s.b, t.b);
  if (Math.abs(d1) < EPS && Math.abs(d2) < EPS) {
    const ax = Math.abs(s.a.x - s.b.x) > EPS ? "x" : "y";
    const lo = Math.max(Math.min(s.a[ax], s.b[ax]), Math.min(t.a[ax], t.b[ax]));
    const hi = Math.min(Math.max(s.a[ax], s.b[ax]), Math.max(t.a[ax], t.b[ax]));
    if (hi - lo > EPS) return "overlap";
    return hi - lo > -EPS ? "touch" : null;
  }
  if (((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) && ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))) return "cross";
  if (onSeg(s.a, t.a, t.b) || onSeg(s.b, t.a, t.b) || onSeg(t.a, s.a, s.b) || onSeg(t.b, s.a, s.b)) return "touch";
  return null;
}
function segHitsRect(a: Pt, b: Pt, r: Rect, pad: number): boolean {
  const x0 = r.x - pad, y0 = r.y - pad, x1 = r.x + r.w + pad, y1 = r.y + r.h + pad;
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2));
  for (let i = 0; i <= n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n, y = a.y + ((b.y - a.y) * i) / n;
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return true;
  }
  return false;
}
const rectsHit = (p: Rect, q: Rect, pad: number) =>
  p.x < q.x + q.w + pad && q.x < p.x + p.w + pad && p.y < q.y + q.h + pad && q.y < p.y + p.h + pad;
const markRect = (p: Pt): Rect => ({ x: p.x - 11, y: p.y - 11, w: 22, h: 22 });

/** Rounded path: corners rounded only at bare corner cells; a bend AT a station stays a true joint. */
function roundedPath(points: Pt[], soft: boolean[]): string {
  const runs: Pt[][] = [[points[0]]];
  for (let i = 1; i < points.length; i++) {
    runs[runs.length - 1].push(points[i]);
    if (i < points.length - 1 && !soft[i] && !collinear(points[i - 1], points[i], points[i + 1])) runs.push([points[i]]);
  }
  return runs.map((r) => roundedD(r, GRID.corner)).join(" ");
}

// ———— drawing (one pass over cells + routes) ————

interface Drawn {
  lines: MapLine[];
  stations: MapStation[];
  segs: Seg[];
  served: Map<string, Set<string>>;
  offGrid: string[];
}

function draw(spec: SystemSpec, cells: Map<string, NonNullable<SpecStation["at"]>>, routes: Record<string, PathEntry[][]>, autoIds: Set<string>): Drawn {
  const byId = new Map(spec.stations.map((s) => [s.id, s]));
  const at = (e: PathEntry): Pt => (typeof e === "string" ? { x: px(cells.get(e)!.x), y: px(cells.get(e)!.y) } : { x: px(e[0]), y: px(e[1]) });
  const offGrid: string[] = [];
  const served = new Map<string, Set<string>>();
  const lines: MapLine[] = [];
  for (const line of spec.lines) {
    const paths: MapPath[] = [];
    for (const raw of routes[line.id] ?? []) {
      const r = raw.filter((e) => typeof e !== "string" || (cells.has(e) && byId.has(e)));
      const stations = r.filter((e): e is string => typeof e === "string");
      if (stations.length < 2) continue;
      const points = r.map(at);
      for (let i = 1; i < points.length; i++) {
        const dx = Math.abs(points[i].x - points[i - 1].x), dy = Math.abs(points[i].y - points[i - 1].y);
        if (!(dx < EPS || dy < EPS || Math.abs(dx - dy) < EPS)) offGrid.push(`leg not octilinear: ${line.id} ${JSON.stringify(r[i - 1])}→${JSON.stringify(r[i])}`);
      }
      for (const s of stations) {
        if (!served.has(s)) served.set(s, new Set());
        served.get(s)!.add(line.id);
      }
      paths.push({
        stations, points, d: roundedPath(points, r.map((e) => typeof e !== "string")), length: polylineLength(points),
        auto: stations.some((s) => autoIds.has(s)) && stations.length === 2,
      });
    }
    if (!paths.length) continue;
    const stations = [...new Set(paths.flatMap((p) => p.stations))];
    let trainPath = 0;
    paths.forEach((p, i) => { if (!p.auto && (paths[trainPath].auto || p.length > paths[trainPath].length)) trainPath = i; });
    lines.push({
      id: line.id, name: line.name, color: line.color, paths, stations, trainPath,
      interchanges: stations.filter((s) => (byId.get(s)?.lines.length ?? 0) > 1).length,
    });
  }

  const segs: Seg[] = lines.flatMap((l) => l.paths.flatMap((p) => p.points.slice(1).map((b, i) => ({ a: p.points[i], b, line: l.id }))));
  const stations: MapStation[] = [];
  for (const s of spec.stations) {
    const cell = cells.get(s.id);
    if (!cell) continue;
    const here: Pt = { x: px(cell.x), y: px(cell.y) };
    const kind: StationKind = s.origin ? "origin" : s.lines.length > 1 ? "interchange" : "tick";
    // tick: perpendicular to a straight track, on the label side; at a junction
    // (legs on two axes) it points straight at the label, the one free side
    const legs = segs.filter((sg) => same(sg.a, here) || same(sg.b, here)).map((sg) => norm(sub(same(sg.a, here) ? sg.b : sg.a, here)));
    const sv = SIDE_VEC[cell.side];
    const axes = new Set(legs.map((v) => `${Math.round(Math.abs(v.x))},${Math.round(v.y * Math.sign(v.x || 1))}`));
    const dir = legs[0] ?? { x: 1, y: 0 };
    let perp = { x: -dir.y, y: dir.x };
    if (perp.x * sv.x + perp.y * sv.y < 0) perp = { x: -perp.x, y: -perp.y };
    const tick = axes.size > 1 ? norm(sv) : perp;
    const terminus = kind === "tick" && legs.length === 1;
    const w = textWidth(s.label, kind !== "tick");
    const { text, box } = placeText(here.x, here.y, cell.side, w, markExtent(kind, terminus, tick, cell.side) + MARK.labelClear);
    stations.push({
      id: s.id, label: s.label, symbol: s.symbol ?? "", x: here.x, y: here.y, side: cell.side, kind,
      lines: s.lines, parents: s.parents ?? [], tick, terminus, auto: autoIds.has(s.id), text, box,
    });
  }
  return { lines, stations, segs, served, offGrid };
}

function reservedRects(spec: SystemSpec): { id: string; box: Rect }[] {
  const out = (spec.reserved ?? []).map((r) => ({ id: r.id, box: { x: px(r.x), y: px(r.y), w: px(r.w), h: px(r.h) } }));
  for (const a of spec.areas ?? []) {
    const w = a.name.length * TYPE.district * TYPE.emDistrict;
    const x = px(a.x), y = px(a.y);
    const left = a.anchor === "start" ? x : a.anchor === "end" ? x - w : x - w / 2;
    out.push({ id: `area ${a.id}`, box: { x: left, y: y - 11, w, h: 14 } });
  }
  return out;
}

function audit(d: Drawn, reserved: { id: string; box: Rect }[]): MapAudit {
  const details = [...d.offGrid];
  const { segs, stations } = d;
  let crossings = 0, overlaps = 0, passThrough = 0, labelCollisions = 0;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const s = segs[i], t = segs[j];
      const rel = relate(s, t);
      if (s.line === t.line) {
        // one line never runs over itself (a spur hidden under its own trunk)
        if (rel === "overlap") { overlaps++; details.push(`overlap: ${s.line} with itself`); }
        continue;
      }
      if (rel === "touch") {
        // touching lines of different colours must meet at a station they share
        const p = [s.a, s.b, t.a, t.b].find((q) => onSeg(q, s.a, s.b) && onSeg(q, t.a, t.b))!;
        if (!stations.some((q) => same(q, p))) { crossings++; details.push(`lines touch off-station: ${s.line}×${t.line} at ${p.x / G},${p.y / G}`); }
      }
      if (rel === "cross") { crossings++; details.push(`crossing: ${s.line}×${t.line}`); }
      if (rel === "overlap") { overlaps++; details.push(`overlap: ${s.line}×${t.line}`); }
    }
  }
  for (const st of stations) for (const s of segs) {
    if (!onSeg(st, s.a, s.b)) continue;
    if (!st.lines.includes(s.line) || !d.served.get(st.id)?.has(s.line)) {
      passThrough++; details.push(`${s.line} passes ${st.id} without serving it`);
    } else if (!same(st, s.a) && !same(st, s.b)) {
      passThrough++; details.push(`${st.id} sits mid-leg on ${s.line} (not a stop of that leg)`);
    }
  }
  const marks = stations.map(markRect);
  stations.forEach((s, i) => {
    for (const seg of segs) if (segHitsRect(seg.a, seg.b, s.box, GRID.track / 2 + 1)) { labelCollisions++; details.push(`label ${s.id} × ${seg.line} track`); break; }
    stations.forEach((t, j) => {
      if (j > i && rectsHit(s.box, t.box, 2)) { labelCollisions++; details.push(`label ${s.id} × label ${t.id}`); }
      if (j !== i && rectsHit(s.box, marks[j], 1)) { labelCollisions++; details.push(`label ${s.id} × station ${t.id}`); }
    });
  });
  for (const a of reserved) {
    for (const seg of segs) if (segHitsRect(seg.a, seg.b, a.box, GRID.track / 2 + 2)) { labelCollisions++; details.push(`${a.id} × ${seg.line} track`); break; }
    stations.forEach((s, i) => {
      if (rectsHit(a.box, s.box, 4) || rectsHit(a.box, marks[i], 4)) { labelCollisions++; details.push(`${a.id} × ${s.id}`); }
    });
  }
  const serviceMismatch: string[] = [];
  for (const st of stations) {
    const want = [...st.lines].sort().join(",");
    const got = [...(d.served.get(st.id) ?? [])].sort().join(",");
    if (want !== got) serviceMismatch.push(`${st.id}: data ${want} ≠ drawn ${got || "∅"}`);
  }
  return { crossings, overlaps, passThrough, labelCollisions, offGrid: d.offGrid.length, serviceMismatch, details };
}

// ———— the fallback placer ————

const DIRS: Side[] = ["e", "s", "w", "n", "se", "ne", "sw", "nw"];
const SIDES_FOR: Record<Side, Side[]> = {
  // a spur's name: across the spur first, then beyond its end
  e: ["n", "s", "e"], w: ["n", "s", "w"], n: ["e", "w", "n"], s: ["e", "w", "s"],
  ne: ["e", "n", "ne"], nw: ["w", "n", "nw"], se: ["e", "s", "se"], sw: ["w", "s", "sw"],
};
const REACH = [2, 3, 4, 5, 6, 8];
/** A second line joins a placed station only from this near (cells): a longer spur reads as noise. */
const MAX_LINK = 10;

/** Geometry defects of a scene (the drafting's own count is the bar a placement must not raise). */
function defects(spec: SystemSpec, cells: Map<string, NonNullable<SpecStation["at"]>>, routes: Record<string, PathEntry[][]>, autoIds: Set<string>, reserved: { id: string; box: Rect }[], only?: string): number {
  const d = draw(spec, cells, routes, autoIds);
  const st = only ? d.stations.find((s) => s.id === only) : undefined;
  const W = px(spec.cols), H = px(spec.rows);
  if (st && (st.box.x < 0 || st.box.y < 0 || st.box.x + st.box.w > W || st.box.y + st.box.h > H)) return Infinity;
  const a = audit(d, reserved);
  return a.crossings + a.overlaps + a.passThrough + a.labelCollisions + a.offGrid;
}

function placeAuto(spec: SystemSpec, cells: Map<string, NonNullable<SpecStation["at"]>>, routes: Record<string, PathEntry[][]>, autoIds: Set<string>) {
  const reserved = reservedRects(spec);
  const unplaced: string[] = [];
  let pending = spec.stations.filter((s) => !s.at).sort((a, b) => a.id.localeCompare(b.id));
  // passes: a station whose lines have no drawn station yet waits for one that does
  for (let progress = true; pending.length && progress;) {
    progress = false;
    const next: SpecStation[] = [];
    for (const s of pending) {
      if (placeOne(spec, s, cells, routes, autoIds, reserved)) progress = true;
      else next.push(s);
    }
    pending = next;
  }
  unplaced.push(...pending.map((s) => s.id));
  return unplaced;
}

function onLine(routes: Record<string, PathEntry[][]>, line: string): string[] {
  return [...new Set((routes[line] ?? []).flat().filter((e): e is string => typeof e === "string"))];
}

/** Octilinear ways from cell b to cell t: straight, or one bare elbow (diagonal + straight). */
function legsBetween(b: Pt, t: Pt): PathEntry[][] {
  const dx = t.x - b.x, dy = t.y - b.y, ax = Math.abs(dx), ay = Math.abs(dy);
  if (!ax || !ay || ax === ay) return [[]];
  const sx = Math.sign(dx), sy = Math.sign(dy);
  const m = Math.min(ax, ay);
  const diagFirst: [number, number] = [b.x + sx * m, b.y + sy * m];
  const straightFirst: [number, number] = ax > ay ? [t.x - sx * m, b.y] : [b.x, t.y - sy * m];
  return [[diagFirst], [straightFirst]];
}

function placeOne(spec: SystemSpec, s: SpecStation, cells: Map<string, NonNullable<SpecStation["at"]>>, routes: Record<string, PathEntry[][]>, autoIds: Set<string>, reserved: { id: string; box: Rect }[]): boolean {
  const [own, ...more] = s.lines;
  const parents = s.parents ?? [];
  const rank = (q: string) => (parents.includes(q) ? parents.indexOf(q) : 1e3);
  const drawnOn = (line: string) => onLine(routes, line).filter((q) => cells.has(q)).sort((p, q) => rank(p) - rank(q) || p.localeCompare(q));
  const anchors = drawnOn(own);
  if (!anchors.length) return false;
  const base = defects(spec, cells, routes, autoIds, reserved);
  autoIds.add(s.id);
  // the other lines that must call here: one clean spur each (straight or one elbow)
  const connect = (x: number, y: number, needAll: boolean): Record<string, PathEntry[][]> | null => {
    let r = routes;
    for (const line of more) {
      let joined = false;
      for (const b of drawnOn(line)) {
        const bc = cells.get(b)!;
        if (Math.max(Math.abs(bc.x - x), Math.abs(bc.y - y)) > MAX_LINK) continue;
        for (const via of legsBetween(bc, { x, y })) {
          const t2 = { ...r, [line]: [...(r[line] ?? []), [b, ...via, s.id]] };
          if (defects(spec, cells, t2, autoIds, reserved, s.id) <= base) { r = t2; joined = true; break; }
        }
        if (joined) break;
      }
      if (!joined && needAll) return null;
    }
    return r;
  };
  // first look for a cell every line can reach; else settle for the station's own line
  for (const needAll of more.length ? [true, false] : [false]) {
    for (const k of REACH) for (const a of anchors) for (const dir of DIRS) {
      const ac = cells.get(a)!, v = SIDE_VEC[dir];
      const x = ac.x + v.x * k, y = ac.y + v.y * k;
      if (x < 1 || y < 1 || x > spec.cols - 1 || y > spec.rows - 1) continue;
      if ([...cells.entries()].some(([id, c]) => id !== s.id && Math.max(Math.abs(c.x - x), Math.abs(c.y - y)) < 2)) continue;
      for (const side of SIDES_FOR[dir]) {
        cells.set(s.id, { x, y, side });
        const prev = routes[own];
        routes[own] = [...(prev ?? []), [a, s.id]];
        if (defects(spec, cells, routes, autoIds, reserved, s.id) <= base) {
          const joined = connect(x, y, needAll);
          if (joined) { Object.assign(routes, joined); return true; }
        }
        routes[own] = prev;
      }
    }
  }
  cells.delete(s.id);
  autoIds.delete(s.id);
  return false;
}

// ———— entry ————

export function buildSystem(spec: SystemSpec): SystemLayout {
  const cells = new Map<string, NonNullable<SpecStation["at"]>>();
  for (const s of spec.stations) if (s.at) cells.set(s.id, s.at);
  const routes: Record<string, PathEntry[][]> = Object.fromEntries(Object.entries(spec.routes).map(([k, v]) => [k, v.map((r) => [...r])]));
  const autoIds = new Set<string>();
  const unplaced = placeAuto(spec, cells, routes, autoIds);
  const d = draw(spec, cells, routes, autoIds);
  const reserved = reservedRects(spec);
  return {
    width: px(spec.cols), height: px(spec.rows), stations: d.stations, lines: d.lines,
    areas: spec.areas ?? [], reserved: reserved.filter((r) => !r.id.startsWith("area ")),
    audit: audit(d, reserved), auto: [...autoIds].sort(), unplaced: unplaced.sort(),
  };
}

/** Where a train stands at fraction t of a path: parked mid-leg between two stops, never on a tick. */
export function trainPose(path: MapPath, t: number, stops: Pt[]) {
  const sp = samplePolyline(path.points);
  const cum: number[] = [0];
  for (let i = 1; i < path.points.length; i++) cum.push(cum[i - 1] + Math.hypot(path.points[i].x - path.points[i - 1].x, path.points[i].y - path.points[i - 1].y));
  const at = path.points.map((p, i) => ({ p, s: cum[i] })).filter(({ p }) => stops.some((q) => same(p, q)));
  const want = t * sp.length;
  let k = 0;
  while (k < at.length - 2 && at[k + 1].s < want) k++;
  const mid = (at[k].s + at[k + 1].s) / 2;
  return sp.at(sp.length ? mid / sp.length : 0);
}

export const lineColor = (layout: SystemLayout, id: string) => layout.lines.find((l) => l.id === id)?.color ?? SHEET.unknownLine;
