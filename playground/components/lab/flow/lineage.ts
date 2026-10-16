// The graph as drawn (from the routed layout) and the lineage questions the board asks of it.
import type { DfdBox, DfdLayout } from "@/lib/world/dfd";

export interface DrawnGraph {
  parents: Map<string, string[]>;
  children: Map<string, string[]>;
  box: Map<string, DfdBox>;
}

export function drawnGraph(layout: DfdLayout): DrawnGraph {
  const parents = new Map<string, string[]>(layout.boxes.map((b) => [b.name, []]));
  const children = new Map<string, string[]>(layout.boxes.map((b) => [b.name, []]));
  for (const e of layout.edges) { parents.get(e.to)?.push(e.from); children.get(e.from)?.push(e.to); }
  return { parents, children, box: new Map(layout.boxes.map((b) => [b.name, b])) };
}

/** Ancestors of `n` with their longest hop count down to it (n itself at 0). */
export function hopsUp(parents: Map<string, string[]>, n: string): Map<string, number> {
  const hops = new Map<string, number>([[n, 0]]);
  const visit = (m: string) => {
    for (const p of parents.get(m) ?? []) {
      const h = hops.get(m)! + 1;
      if ((hops.get(p) ?? -1) < h) { hops.set(p, h); visit(p); }
    }
  };
  visit(n);
  return hops;
}
