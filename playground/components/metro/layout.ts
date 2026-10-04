// Pure strip-map layout for the Transit diagram. One strip per family line:
// tracks = builds_on edges inside the family (transitively reduced), drawn
// octilinear only (90° then one 45° kink per branch, rounded corners).
// Generations read left → right (one column each), branches stack in rows.
// Deterministic: same taxonomy in, same drawing out.
import type { TaxonModel } from "@/lib/types";
import { ATOMS, PLACEMENT, familyOf as blueprintFamily } from "@/lib/blueprint";
import { LINE_COLORS } from "./encoding";

export const COL = 140; // one generation
export const ROW = 40; // one branch row
const PAD_X = 22;
const PAD_TOP = 34; // room for row 0's labels above the track
const PAD_BOTTOM = 18;
const CORNER = 12; // bend radius
export const LABEL_PX = 13;
const CHAR_W = 5.9; // Jost at 13px, measured average advance (lowercase names)
const BADGE_W = 19;

export interface Stop {
  name: string;
  x: number;
  y: number;
  atom: boolean;
  /** "above" when the line carries on to the right of the stop, else "right" */
  labelSide: "above" | "right";
  kind: "origin" | "tick" | "end" | "interchange";
  /** parents on other lines (change-for bullets) */
  changeFor: { name: string; family: string }[];
}

export interface Strip {
  family: string;
  color: string;
  stops: Stop[];
  tracks: string[];
  width: number;
  height: number;
  interchanges: number;
}

/** Family of any model: the blueprint placement, else its first parent's. */
export function makeFamilyOf(models: TaxonModel[]) {
  const memo: Record<string, string> = {};
  const byName = new Map(models.map((m) => [m.name, m]));
  const of = (name: string, seen = new Set<string>()): string => {
    if (memo[name]) return memo[name];
    const fam = blueprintFamily(name);
    if (fam) return (memo[name] = fam);
    const first = byName.get(name)?.builds_on[0];
    if (first && !seen.has(first)) { seen.add(name); return (memo[name] = of(first, seen)); }
    return (memo[name] = "structure");
  };
  return of;
}

export const labelOf = (name: string) => name.replace(/_/g, " ");
export const textWidth = (s: string) => s.length * CHAR_W;

/** Octilinear route: vertical run, one 45° kink, horizontal run into `b`. */
function route(a: { x: number; y: number }, b: { x: number; y: number }): [number, number][] {
  const dy = b.y - a.y;
  if (dy === 0) return [[a.x, a.y], [b.x, b.y]];
  const s = Math.sign(dy);
  const diag = Math.min(Math.abs(dy), ROW);
  const pts: [number, number][] = [[a.x, a.y]];
  if (Math.abs(dy) > diag) pts.push([a.x, b.y - s * diag]);
  pts.push([a.x + diag, b.y], [b.x, b.y]);
  return pts;
}

/** Polyline → path with rounded corners (quadratic at each bend). */
function rounded(pts: [number, number][]): string {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1], [cx, cy] = pts[i], [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(cx - px, cy - py), l2 = Math.hypot(nx - cx, ny - cy);
    const r = Math.min(CORNER, l1 / 2, l2 / 2);
    const ax = cx - ((cx - px) / l1) * r, ay = cy - ((cy - py) / l1) * r;
    const bx = cx + ((nx - cx) / l2) * r, by = cy + ((ny - cy) / l2) * r;
    d += ` L ${ax.toFixed(1)} ${ay.toFixed(1)} Q ${cx} ${cy} ${bx.toFixed(1)} ${by.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  return d + ` L ${last[0]} ${last[1]}`;
}

const order = (n: string) => {
  const p = PLACEMENT[n];
  return ATOMS[n] ? ATOMS[n].z : p ? 100 + p.row * 20 + p.col : 999;
};

export function layoutStrip(models: TaxonModel[], family: string, familyOf: (n: string) => string): Strip {
  const members = models.filter((m) => familyOf(m.name) === family);
  const inFam = new Set(members.map((m) => m.name));
  const byName = new Map(members.map((m) => [m.name, m]));
  const famParents = (n: string) => (byName.get(n)?.builds_on ?? []).filter((p) => inFam.has(p) && p !== n);

  const ancMemo = new Map<string, Set<string>>();
  const ancestors = (n: string, stack = new Set<string>()): Set<string> => {
    if (ancMemo.has(n)) return ancMemo.get(n)!;
    const out = new Set<string>();
    stack.add(n);
    for (const p of famParents(n)) {
      if (stack.has(p)) continue;
      out.add(p);
      ancestors(p, stack).forEach((a) => out.add(a));
    }
    stack.delete(n);
    ancMemo.set(n, out);
    return out;
  };
  // transitive reduction: drop a parent already reachable through another
  const reduced = (n: string) => {
    const ps = famParents(n);
    return ps.filter((p) => !ps.some((q) => q !== p && ancestors(q).has(p)));
  };
  const depthMemo = new Map<string, number>();
  const depth = (n: string, stack = new Set<string>()): number => {
    if (depthMemo.has(n)) return depthMemo.get(n)!;
    stack.add(n);
    const ps = reduced(n).filter((p) => !stack.has(p));
    const d = ps.length ? Math.max(...ps.map((p) => depth(p, stack))) + 1 : 0;
    stack.delete(n);
    depthMemo.set(n, d);
    return d;
  };
  // tree parent = the deepest reduced parent (ties → builds_on order)
  const treeParent = new Map<string, string>();
  const extra: { from: string; to: string }[] = [];
  for (const m of members) {
    const ps = reduced(m.name);
    if (!ps.length) continue;
    const tp = ps.reduce((a, b) => (depth(b) > depth(a) ? b : a));
    treeParent.set(m.name, tp);
    ps.filter((p) => p !== tp).forEach((p) => extra.push({ from: p, to: m.name }));
  }
  const children = (n: string) => members.map((m) => m.name).filter((c) => treeParent.get(c) === n);
  const extraTargets = new Set(extra.map((e) => e.to));
  const hasExtra = (n: string): boolean => extraTargets.has(n) || children(n).some(hasExtra);
  const desc = (n: string): number => children(n).reduce((s, c) => s + 1 + desc(c), 0);
  const sortKids = (ks: string[]) => ks.sort((a, b) =>
    Number(hasExtra(a)) - Number(hasExtra(b)) || desc(b) - desc(a) || order(a) - order(b));

  // roots by atomic number; a root that feeds an extra track sits right
  // below the root whose branch it joins, so the joining track stays short
  let roots = members.map((m) => m.name).filter((n) => !treeParent.has(n)).sort((a, b) => order(a) - order(b));
  for (const e of extra) {
    if (treeParent.has(e.from)) continue;
    const host = roots.find((r) => r !== e.from && (r === e.to || [...ancestors(e.to)].includes(r)));
    if (!host) continue;
    roots = roots.filter((r) => r !== e.from);
    roots.splice(roots.indexOf(host) + 1, 0, e.from);
  }

  const row = new Map<string, number>();
  let next = 0;
  const place = (n: string) => {
    const ks = sortKids(children(n));
    if (!ks.length) { row.set(n, next++); return; }
    ks.forEach(place);
    row.set(n, row.get(ks[0])!);
  };
  roots.forEach(place);

  const at = (n: string) => ({ x: PAD_X + 12 + depth(n) * COL, y: PAD_TOP + row.get(n)! * ROW });
  const tracks: string[] = [];
  for (const [c, p] of treeParent) tracks.push(rounded(route(at(p), at(c))));
  for (const e of extra) tracks.push(rounded(route(at(e.from), at(e.to))));

  const feeds = new Set([...treeParent.values(), ...extra.map((e) => e.from)]);
  const stops: Stop[] = members.map((m) => {
    const atom = !!ATOMS[m.name];
    const changeFor = m.builds_on.filter((p) => !inFam.has(p)).map((p) => ({ name: p, family: familyOf(p) }));
    const kind: Stop["kind"] = atom ? "origin"
      : m.builds_on.length > 1 ? "interchange"
      : feeds.has(m.name) ? "tick" : "end";
    return {
      name: m.name, ...at(m.name), atom, changeFor, kind,
      labelSide: children(m.name).length ? "above" : "right",
    };
  });

  let width = 0;
  for (const s of stops) {
    const tw = textWidth(labelOf(s.name)) + s.changeFor.length * BADGE_W + (s.changeFor.length ? 6 : 0);
    width = Math.max(width, s.labelSide === "right" ? s.x + 16 + tw : s.x - 3 + tw);
  }
  return {
    family, color: LINE_COLORS[family] ?? "#777", stops, tracks,
    width: Math.ceil(width + PAD_X), height: PAD_TOP + Math.max(0, next - 1) * ROW + PAD_BOTTOM + 8,
    interchanges: stops.filter((s) => s.kind === "interchange").length,
  };
}

export const BADGE = BADGE_W;
