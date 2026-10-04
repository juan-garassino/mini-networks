// The Transit diagram's layout: ONE connected system map (Beck / Vignelli).
// Families are lines; a line is a family's *service*: it calls at every model
// of the family and at every model built on one of them, so a model built on
// two families is an interchange of two lines. Like the periodic table's
// PLACEMENT (lib/blueprint.ts) the drawing is authored, not computed: station
// cells and line paths are drafted by hand on one grid, the districts sit where
// the painted maps put each family's land (Perception west, Representation
// north, Structure an island north-east, Sequence centre, Decision east,
// Generative south), so the maps' roads can borrow this topology.
//
// What is computed: the service sets (from builds_on), the px geometry, and an
// audit that holds the drawing to the data and to the genre: no crossings
// between lines, no collinear overlaps, no line through a station it does not
// serve, every leg 0/45/90°, no label touching a label, a track or a station.
// A model the drafting does not know yet is listed in `unplaced`, never lost.
//
// Pure + deterministic, no DOM: node --test runs it (lib/world/metro.test.ts).
import type { TaxonomyResponse } from "../../lib/types.ts";
import { ATOMS, familyOf as blueprintFamily } from "../../lib/blueprint.ts";
import { roundedD, polylineLength, samplePolyline } from "../../lib/world/path.ts";
import { LINE_COLORS, LINE_ORDER } from "./encoding.ts";

/** Grid pitch (px). Every station and every corner sits on this grid. */
export const G = 20;
/** The one corner radius of every bend. */
export const CORNER = 14;
export const TRACK_W = 6;
export const LABEL_PX = 13;
/** Map extent in cells (the drafting sheet). */
export const COLS = 69;
export const ROWS = 40;

export type Side = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
export interface Pt { x: number; y: number }

/** Authored station cells + label side (always the outside of the track). */
export const STATIONS: Record<string, { x: number; y: number; side: Side }> = {
  // Perception, the west side: one north–south trunk through classifier
  dino: { x: 10, y: 5, side: "w" },
  vit: { x: 10, y: 11, side: "w" },
  classifier: { x: 10, y: 17, side: "w" },
  mobilenet: { x: 10, y: 21, side: "w" },
  resnet: { x: 10, y: 25, side: "w" },
  convnext: { x: 10, y: 29, side: "w" },
  lora: { x: 13, y: 20, side: "ne" },
  detection: { x: 16, y: 23, side: "ne" },
  rpp_classifier: { x: 19, y: 26, side: "ne" },
  tabular_classifier: { x: 22, y: 29, side: "e" },
  segmentation: { x: 19, y: 17, side: "ne" },
  sam: { x: 19, y: 11, side: "n" },
  unet_ae: { x: 19, y: 21, side: "e" },
  audio_classifier: { x: 25, y: 17, side: "s" },
  audio_spectrogram: { x: 29, y: 17, side: "e" },
  audio_melspectrogram: { x: 29, y: 21, side: "e" },
  audio_transformer: { x: 29, y: 11, side: "n" },
  // Representation, the north rim
  simclr: { x: 22, y: 5, side: "s" },
  vision_embed: { x: 22, y: 2, side: "e" },
  clip: { x: 40, y: 5, side: "e" },
  // Sequence, the centre: transformer is the hub of the system
  transformer: { x: 40, y: 11, side: "ne" },
  rnn: { x: 37, y: 8, side: "w" },
  moe: { x: 46, y: 11, side: "s" },
  deepseek: { x: 52, y: 11, side: "s" },
  kimi: { x: 58, y: 11, side: "s" },
  mamba: { x: 64, y: 11, side: "s" },
  text_token_classifier: { x: 40, y: 15, side: "w" },
  text_seq2seq: { x: 40, y: 19, side: "w" },
  rag: { x: 40, y: 23, side: "w" },
  grokking: { x: 40, y: 27, side: "w" },
  text_diffusion: { x: 40, y: 33, side: "e" },
  // Decision, the east
  rlhf: { x: 56, y: 16, side: "n" },
  reinforce: { x: 62, y: 16, side: "e" },
  grpo: { x: 56, y: 20, side: "w" },
  dpo: { x: 56, y: 24, side: "w" },
  rl_maze: { x: 62, y: 20, side: "e" },
  alphazero: { x: 62, y: 24, side: "e" },
  // Structure, an island shuttle in the north-east (no cross-family edge)
  gnn: { x: 50, y: 4, side: "n" },
  nerf: { x: 58, y: 4, side: "n" },
  // Generative, the south
  tabular_diffusion: { x: 22, y: 33, side: "w" },
  vae: { x: 19, y: 37, side: "s" },
  gan: { x: 25, y: 37, side: "s" },
  diffusion: { x: 31, y: 37, side: "s" },
  pixelcnn: { x: 37, y: 37, side: "s" },
};

/** A line path: stations (by name) and bare corner cells, in riding order.
 * Every path starts at an origin (atom) or at a station nearer one, so a
 * train riding it travels the way models build on each other. */
export type PathEntry = string | [number, number];
export const ROUTES: Record<string, PathEntry[][]> = {
  perception: [
    ["classifier", "vit", "dino"],
    ["classifier", "mobilenet", "resnet", "convnext"],
    ["classifier", "segmentation", "audio_classifier", "audio_spectrogram"],
    ["segmentation", "sam"],
    ["segmentation", "unet_ae"],
    ["audio_spectrogram", "audio_transformer"],
    ["audio_spectrogram", "audio_melspectrogram"],
    ["classifier", "lora", "detection", "rpp_classifier", "tabular_classifier", "tabular_diffusion"],
  ],
  sequence: [
    ["transformer", "audio_transformer", "sam", "vit"],
    ["transformer", "moe", "deepseek", "kimi", "mamba"],
    ["transformer", "text_token_classifier", "text_seq2seq", "rag", "grokking", "text_diffusion"],
    ["transformer", "clip"],
    ["transformer", "rnn"],
    ["transformer", [45, 16], "rlhf"],
  ],
  representation: [
    ["simclr", "dino"],
    ["simclr", "clip"],
    ["simclr", "vision_embed"],
  ],
  structure: [["gnn", "nerf"]],
  decision: [
    ["reinforce", "rlhf", "grpo", "dpo"],
    ["reinforce", "rl_maze", "alphazero"],
  ],
  generative: [
    ["vae", "gan", "diffusion", "pixelcnn"],
    ["diffusion", [27, 33], "tabular_diffusion"],
    ["diffusion", [35, 33], "text_diffusion"],
  ],
};

/** Quiet area names: each district's name sits in its own land. */
export const DISTRICTS: { family: string; x: number; y: number; anchor: "start" | "middle" | "end" }[] = [
  { family: "perception", x: 10, y: 33.2, anchor: "middle" },
  { family: "representation", x: 31, y: 2.4, anchor: "middle" },
  { family: "structure", x: 54, y: 6.9, anchor: "middle" },
  { family: "sequence", x: 48, y: 22, anchor: "middle" },
  { family: "decision", x: 59, y: 27, anchor: "middle" },
  { family: "generative", x: 28, y: 39.6, anchor: "middle" },
];

/** The map's own cartouche (title + key), in the empty south-east (cells). */
export const CARTOUCHE = { x: 46, y: 28.5, w: 22.5, h: 11 };
export const DISTRICT_PX = 15;

export type StationKind = "origin" | "tick" | "interchange";

export interface Rect { x: number; y: number; w: number; h: number }

export interface MetroStation {
  name: string;
  label: string;
  family: string;
  /** px */
  x: number;
  y: number;
  side: Side;
  kind: StationKind;
  /** families whose lines call here (own family first) */
  lines: string[];
  parents: string[];
  /** unit vector of the tick (towards the label), for tick stations */
  tick: Pt;
  /** a one-line station where its only track ends: drawn as a bar across the line end */
  terminus: boolean;
  text: { x: number; y: number; anchor: "start" | "middle" | "end" };
  box: Rect;
}

export interface MetroPath { stations: string[]; points: Pt[]; d: string; length: number }
export interface MetroLine {
  family: string;
  color: string;
  paths: MetroPath[];
  stations: string[];
  interchanges: number;
  /** the longest path: the one the line's train rides */
  trainPath: number;
}

export interface MetroAudit {
  crossings: number;
  overlaps: number;
  passThrough: number;
  labelCollisions: number;
  offGrid: number;
  serviceMismatch: string[];
  details: string[];
}

export interface MetroLayout {
  width: number;
  height: number;
  stations: MetroStation[];
  lines: MetroLine[];
  audit: MetroAudit;
  unplaced: string[];
}

export const labelOf = (name: string) => name.replace(/_/g, " ");

/** Jost advance widths, measured average per glyph at 1px (lowercase names). */
const EM_REGULAR = 0.5;
const EM_BOLD = 0.535;
export const textWidth = (s: string, bold = false) => s.length * LABEL_PX * (bold ? EM_BOLD : EM_REGULAR);

const px = (c: number) => c * G;

/** Family of any model: the blueprint placement, else its first parent's. */
export function makeFamilyOf(tax: TaxonomyResponse) {
  const byName = new Map(tax.models.map((m) => [m.name, m]));
  const memo = new Map<string, string>();
  const of = (name: string, seen: Set<string> = new Set()): string => {
    const hit = memo.get(name);
    if (hit) return hit;
    let f = blueprintFamily(name);
    if (!f) {
      const first = byName.get(name)?.builds_on[0];
      f = first && !seen.has(first) ? of(first, new Set([...seen, name])) : "structure";
    }
    memo.set(name, f);
    return f;
  };
  return of;
}

const SIDE_VEC: Record<Side, Pt> = {
  n: { x: 0, y: -1 }, s: { x: 0, y: 1 }, e: { x: 1, y: 0 }, w: { x: -1, y: 0 },
  ne: { x: 1, y: -1 }, nw: { x: -1, y: -1 }, se: { x: 1, y: 1 }, sw: { x: -1, y: 1 },
};

// label offsets from the station centre (px): clears the ring / bullet
const GAP = 12;
const ASC = 9.5; // cap+x height above the baseline at 13px
const DESC = 3.5; // descender below the baseline

function placeText(x: number, y: number, side: Side, w: number) {
  const mid = y + ASC / 2 - 0.5; // baseline that centres lowercase on y
  let tx = x, ty = mid, anchor: "start" | "middle" | "end" = "start";
  switch (side) {
    case "e": tx = x + GAP; break;
    case "w": tx = x - GAP; anchor = "end"; break;
    case "n": ty = y - GAP - DESC; anchor = "middle"; break;
    case "s": ty = y + GAP + ASC; anchor = "middle"; break;
    case "ne": tx = x + 8; ty = y - 10 - DESC; break;
    case "nw": tx = x - 8; ty = y - 10 - DESC; anchor = "end"; break;
    case "se": tx = x + 8; ty = y + 10 + ASC; break;
    case "sw": tx = x - 8; ty = y + 10 + ASC; anchor = "end"; break;
  }
  const left = anchor === "start" ? tx : anchor === "end" ? tx - w : tx - w / 2;
  return { text: { x: tx, y: ty, anchor }, box: { x: left, y: ty - ASC, w, h: ASC + DESC } };
}

// ———— geometry audits ————

type Seg = { a: Pt; b: Pt; line: string };
const EPS = 1e-6;
const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const same = (p: Pt, q: Pt) => Math.abs(p.x - q.x) < EPS && Math.abs(p.y - q.y) < EPS;
const onSeg = (p: Pt, a: Pt, b: Pt) =>
  Math.abs(cross(a, b, p)) < EPS && p.x >= Math.min(a.x, b.x) - EPS && p.x <= Math.max(a.x, b.x) + EPS
  && p.y >= Math.min(a.y, b.y) - EPS && p.y <= Math.max(a.y, b.y) + EPS;

/** "cross" = proper crossing, "overlap" = collinear shared length, "touch" = endpoint contact, null = apart. */
function relate(s: Seg, t: Seg): "cross" | "overlap" | "touch" | null {
  const d1 = cross(t.a, t.b, s.a), d2 = cross(t.a, t.b, s.b);
  const d3 = cross(s.a, s.b, t.a), d4 = cross(s.a, s.b, t.b);
  if (Math.abs(d1) < EPS && Math.abs(d2) < EPS) {
    // collinear: shared length?
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
  // sample along the segment (legs are short; 2px steps are exact enough)
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2));
  for (let i = 0; i <= n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n, y = a.y + ((b.y - a.y) * i) / n;
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return true;
  }
  return false;
}
const rectsHit = (p: Rect, q: Rect, pad: number) =>
  p.x < q.x + q.w + pad && q.x < p.x + p.w + pad && p.y < q.y + q.h + pad && q.y < p.y + p.h + pad;

export function buildMetro(tax: TaxonomyResponse): MetroLayout {
  const familyOf = makeFamilyOf(tax);
  const byName = new Map(tax.models.map((m) => [m.name, m]));
  const details: string[] = [];

  // service: a family's line calls at its own models and at every model built on one of them
  const served = new Map<string, string[]>();
  for (const m of tax.models) {
    const own = familyOf(m.name);
    const fams = [own, ...m.builds_on.map((p) => familyOf(p))];
    served.set(m.name, [...new Set(fams)]);
  }

  const unplaced = tax.models.map((m) => m.name).filter((n) => !STATIONS[n]).sort();
  const at = (e: PathEntry): Pt => (typeof e === "string" ? { x: px(STATIONS[e].x), y: px(STATIONS[e].y) } : { x: px(e[0]), y: px(e[1]) });

  // ———— lines ————
  let offGrid = 0;
  const drawn = new Map<string, Set<string>>(); // station → families drawn through it
  const lines: MetroLine[] = [];
  for (const family of LINE_ORDER) {
    const routes = (ROUTES[family] ?? []).map((r) => r.filter((e) => typeof e !== "string" || (STATIONS[e] && byName.has(e))));
    const paths: MetroPath[] = [];
    for (const r of routes) {
      if (r.filter((e) => typeof e === "string").length < 2) continue;
      const points = r.map(at);
      for (let i = 1; i < points.length; i++) {
        const dx = Math.abs(points[i].x - points[i - 1].x), dy = Math.abs(points[i].y - points[i - 1].y);
        if (!(dx < EPS || dy < EPS || Math.abs(dx - dy) < EPS)) { offGrid++; details.push(`leg not octilinear: ${family} ${JSON.stringify(r[i - 1])}→${JSON.stringify(r[i])}`); }
      }
      const stations = r.filter((e): e is string => typeof e === "string");
      for (const s of stations) {
        if (!drawn.has(s)) drawn.set(s, new Set());
        drawn.get(s)!.add(family);
      }
      // round only at bare corners; a bend AT a station stays a true joint under its mark
      const d = roundedPath(points, r.map((e) => typeof e !== "string"));
      paths.push({ stations, points, d, length: polylineLength(points) });
    }
    if (!paths.length) continue;
    const stations = [...new Set(paths.flatMap((p) => p.stations))];
    let trainPath = 0;
    paths.forEach((p, i) => { if (p.length > paths[trainPath].length) trainPath = i; });
    lines.push({
      family, color: LINE_COLORS[family] ?? "#888", paths, stations, trainPath,
      interchanges: stations.filter((s) => (served.get(s)?.length ?? 0) > 1).length,
    });
  }

  // ———— stations ————
  const segs: Seg[] = lines.flatMap((l) => l.paths.flatMap((p) => p.points.slice(1).map((b, i) => ({ a: p.points[i], b, line: l.family }))));
  const stations: MetroStation[] = [];
  for (const name of Object.keys(STATIONS)) {
    const m = byName.get(name);
    if (!m) continue;
    const spec = STATIONS[name];
    const x = px(spec.x), y = px(spec.y);
    const lineFams = served.get(name) ?? [familyOf(name)];
    const atom = !!ATOMS[name] || m.level === "elementary";
    const kind: StationKind = atom ? "origin" : lineFams.length > 1 ? "interchange" : "tick";
    const label = labelOf(name);
    const bold = kind !== "tick";
    const w = textWidth(label, bold);
    const { text, box } = placeText(x, y, spec.side, w);
    // tick: perpendicular to a straight track, on the label side; at a junction
    // (legs on two axes) it points straight at the label, the one free side
    const here: Pt = { x, y };
    const legs = segs.filter((sg) => same(sg.a, here) || same(sg.b, here))
      .map((sg) => norm(sub(same(sg.a, here) ? sg.b : sg.a, here)));
    const sv = SIDE_VEC[spec.side];
    const axes = new Set(legs.map((v) => `${Math.round(Math.abs(v.x))},${Math.round(v.y * Math.sign(v.x || 1))}`));
    const dir = legs[0] ?? { x: 1, y: 0 };
    let perp = { x: -dir.y, y: dir.x };
    if (perp.x * sv.x + perp.y * sv.y < 0) perp = { x: -perp.x, y: -perp.y };
    const tick = axes.size > 1 ? norm(sv) : perp;
    const terminus = kind === "tick" && legs.length === 1;
    stations.push({
      name, label, family: familyOf(name), x, y, side: spec.side, kind,
      lines: lineFams, parents: m.builds_on, tick, terminus, text, box,
    });
  }

  // ———— audit ————
  let crossings = 0, overlaps = 0, passThrough = 0, labelCollisions = 0;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const s = segs[i], t = segs[j];
      const rel = relate(s, t);
      if (!rel || rel === "touch") {
        // touching lines of different colours must meet at a station they share
        if (rel === "touch" && s.line !== t.line) {
          const p = [s.a, s.b, t.a, t.b].find((q) => onSeg(q, s.a, s.b) && onSeg(q, t.a, t.b))!;
          const st = stations.find((q) => same(q, p));
          if (!st) { crossings++; details.push(`lines touch off-station: ${s.line}×${t.line} at ${p.x / G},${p.y / G}`); }
        }
        continue;
      }
      if (rel === "cross" && s.line !== t.line) { crossings++; details.push(`crossing: ${s.line}×${t.line}`); }
      if (rel === "overlap" && s.line !== t.line) { overlaps++; details.push(`overlap: ${s.line}×${t.line}`); }
    }
  }
  for (const st of stations) {
    for (const s of segs) {
      if (!onSeg(st, s.a, s.b)) continue;
      if (!st.lines.includes(s.line) || !drawn.get(st.name)?.has(s.line)) {
        passThrough++; details.push(`${s.line} passes ${st.name} without serving it`);
      }
    }
  }
  const marks: Rect[] = stations.map((s) => ({ x: s.x - 11, y: s.y - 11, w: 22, h: 22 }));
  stations.forEach((s, i) => {
    for (const seg of segs) if (segHitsRect(seg.a, seg.b, s.box, TRACK_W / 2 + 1)) { labelCollisions++; details.push(`label ${s.name} × ${seg.line} track`); break; }
    stations.forEach((t, j) => {
      if (j > i && rectsHit(s.box, t.box, 2)) { labelCollisions++; details.push(`label ${s.name} × label ${t.name}`); }
      if (j !== i && rectsHit(s.box, marks[j], 1)) { labelCollisions++; details.push(`label ${s.name} × station ${t.name}`); }
    });
  });
  // nothing may touch the cartouche or a district name
  const card: Rect = { x: px(CARTOUCHE.x), y: px(CARTOUCHE.y), w: px(CARTOUCHE.w), h: px(CARTOUCHE.h) };
  const areas: { name: string; box: Rect }[] = DISTRICTS.map((d) => {
    const w = d.family.length * DISTRICT_PX * 0.56;
    const x = px(d.x), y = px(d.y);
    const left = d.anchor === "start" ? x : d.anchor === "end" ? x - w : x - w / 2;
    return { name: `district ${d.family}`, box: { x: left, y: y - 11, w, h: 14 } };
  });
  for (const a of [{ name: "cartouche", box: card }, ...areas]) {
    for (const seg of segs) if (segHitsRect(seg.a, seg.b, a.box, TRACK_W / 2 + 2)) { labelCollisions++; details.push(`${a.name} × ${seg.line} track`); break; }
    stations.forEach((s, i) => {
      if (rectsHit(a.box, s.box, 4) || rectsHit(a.box, marks[i], 4)) { labelCollisions++; details.push(`${a.name} × ${s.name}`); }
    });
  }
  const serviceMismatch: string[] = [];
  for (const st of stations) {
    const want = [...st.lines].sort().join(",");
    const got = [...(drawn.get(st.name) ?? [])].sort().join(",");
    if (want !== got) serviceMismatch.push(`${st.name}: data ${want} ≠ drawn ${got || "∅"}`);
  }

  return {
    width: px(COLS), height: px(ROWS), stations, lines, unplaced,
    audit: { crossings, overlaps, passThrough, labelCollisions, offGrid, serviceMismatch, details },
  };
}

const sub = (a: Pt, b: Pt) => ({ x: a.x - b.x, y: a.y - b.y });
const norm = (v: Pt) => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };

/** Rounded path: corners rounded only where `soft[i]` (bare corner cells). */
function roundedPath(points: Pt[], soft: boolean[]): string {
  // split at hard joints (stations where the path bends) and round each run
  const runs: Pt[][] = [[points[0]]];
  for (let i = 1; i < points.length; i++) {
    runs[runs.length - 1].push(points[i]);
    const bends = i < points.length - 1 && !soft[i] && !collinear(points[i - 1], points[i], points[i + 1]);
    if (bends) runs.push([points[i]]);
  }
  return runs.map((r) => roundedD(r, CORNER)).join(" ");
}
const collinear = (a: Pt, b: Pt, c: Pt) => Math.abs(cross(a, b, c)) < EPS;

/** Where a train stands at fraction t of a path (frozen frame + motion start). */
export function trainPose(path: MetroPath, t: number) {
  // park between two stations (the middle of the leg around t), never on a tick
  const sp = samplePolyline(path.points);
  const cum: number[] = [0];
  for (let i = 1; i < path.points.length; i++) cum.push(cum[i - 1] + Math.hypot(path.points[i].x - path.points[i - 1].x, path.points[i].y - path.points[i - 1].y));
  const stops = path.points.map((p, i) => ({ p, s: cum[i] })).filter(({ p }) => Object.values(STATIONS).some((st) => px(st.x) === p.x && px(st.y) === p.y));
  const want = t * sp.length;
  let k = 0;
  while (k < stops.length - 2 && stops[k + 1].s < want) k++;
  const mid = (stops[k].s + stops[k + 1].s) / 2;
  return sp.at(sp.length ? mid / sp.length : 0);
}
