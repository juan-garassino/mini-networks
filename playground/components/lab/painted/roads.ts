// The painted road graph: stops (anchors + junctions) joined by the hand-traced
// polylines in anchors.ts. Dijkstra by polyline length gives the critter's
// walk and the lit lineage roads — both follow the roads painted on the image.
import { stopPoint, type PaintedMap, type Pt } from "./anchors";

interface Edge { to: string; pts: Pt[]; len: number; kind: string }
export interface RoadGraph { adj: Map<string, Edge[]> }

const plen = (pts: Pt[]) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);

export function buildRoadGraph(map: PaintedMap): RoadGraph {
  const adj = new Map<string, Edge[]>();
  const add = (a: string, e: Edge) => adj.set(a, [...(adj.get(a) ?? []), e]);
  for (const r of map.roads) {
    const a = stopPoint(map, r.a), b = stopPoint(map, r.b);
    if (!a || !b) continue;
    const pts = [a, ...(r.via ?? []).map(([x, y]) => ({ x, y })), b];
    const len = plen(pts);
    // air links cost more, so the critter only flies when there is no road
    const cost = r.kind === "air" ? len * 1.6 : len;
    add(r.a, { to: r.b, pts, len: cost, kind: r.kind ?? "road" });
    add(r.b, { to: r.a, pts: [...pts].reverse(), len: cost, kind: r.kind ?? "road" });
  }
  return { adj };
}

/** Shortest road route between two stops as one polyline (null if unreachable). */
export function route(g: RoadGraph, from: string, to: string): Pt[] | null {
  if (from === to) return null;
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, { from: string; e: Edge }>();
  const open = new Set<string>([from]);
  while (open.size) {
    let cur = "", best = Infinity;
    for (const n of open) { const d = dist.get(n)!; if (d < best) { best = d; cur = n; } }
    open.delete(cur);
    if (cur === to) break;
    for (const e of g.adj.get(cur) ?? []) {
      const nd = best + e.len;
      if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, { from: cur, e }); open.add(e.to); }
    }
  }
  if (!prev.has(to)) return null;
  const legs: Pt[][] = [];
  for (let n = to; n !== from; ) { const p = prev.get(n)!; legs.unshift(p.e.pts); n = p.from; }
  return legs.reduce<Pt[]>((acc, l) => (acc.length ? [...acc, ...l.slice(1)] : [...l]), []);
}

/** Every builds_on edge above `name` (recursively), as road polylines. */
export function lineageRoutes(
  g: RoadGraph,
  name: string,
  parentsOf: (n: string) => string[],
): { from: string; to: string; pts: Pt[] }[] {
  const out: { from: string; to: string; pts: Pt[] }[] = [];
  const seen = new Set<string>();
  const walk = (n: string) => {
    for (const p of parentsOf(n)) {
      const key = `${p}>${n}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const pts = route(g, p, n);
      if (pts) out.push({ from: p, to: n, pts });
      walk(p);
    }
  };
  walk(name);
  return out;
}

/** The critter's walk: from the model's root atom along its primary chain. */
export function rootChain(name: string, parentsOf: (n: string) => string[]): string[] {
  const chain = [name];
  for (let n = name, guard = 0; guard < 10; guard++) {
    const ps = parentsOf(n);
    if (!ps.length) break;
    n = ps[0];
    chain.unshift(n);
  }
  return chain;
}

export function chainRoute(g: RoadGraph, chain: string[]): Pt[] {
  let pts: Pt[] = [];
  for (let i = 1; i < chain.length; i++) {
    const leg = route(g, chain[i - 1], chain[i]);
    if (leg) pts = pts.length ? [...pts, ...leg.slice(1)] : leg;
  }
  return pts;
}

export function polylineLength(pts: Pt[]): number {
  return plen(pts);
}

export function pointAt(pts: Pt[], d: number): Pt & { dir: number } {
  let left = d;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= l || i === pts.length - 1) {
      const k = l ? Math.min(1, left / l) : 1;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, dir: Math.sign(b.x - a.x) || 1 };
    }
    left -= l;
  }
  const last = pts[pts.length - 1] ?? { x: 0, y: 0 };
  return { ...last, dir: 1 };
}
