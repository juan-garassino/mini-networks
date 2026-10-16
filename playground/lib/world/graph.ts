// Taxonomy → normalised lineage graph: sorted models, family, depth, primary
// parent, cross-family edges, islets. Input order never matters (sorted by
// name); problems are recorded in `warnings`, never thrown.
import { ATOMS, FAMILY_BLOCKS, PLACEMENT } from "../blueprint.ts";
import type { TaxonomyResponse } from "../types.ts";
import type { FamilyMap } from "./types.ts";
import { FALLBACK_FAMILY } from "./constants.ts";

/**
 * Curated family membership: PLACEMENT column → FAMILY_BLOCKS, then ATOMS.
 * With a taxonomy, every model in it is included too, unknown ones resolved
 * by the same fallback buildWorld uses (ATOMS family → first parent's family).
 */
export function familyMapFromBlueprint(tax?: TaxonomyResponse): FamilyMap {
  const out: FamilyMap = {};
  for (const [name, a] of Object.entries(ATOMS)) out[name] = a.family;
  for (const [name, p] of Object.entries(PLACEMENT)) {
    const b = FAMILY_BLOCKS.find((f) => p.col >= f.cols[0] && p.col <= f.cols[1]);
    if (b) out[name] = b.family;
  }
  if (tax) for (const [name, f] of buildGraph(tax, out).family) out[name] = f;
  return out;
}

export interface GEdge {
  from: string;
  to: string;
  cross: boolean;
  primary: boolean;
}

export interface Graph {
  names: string[];
  family: Map<string, string>;
  depth: Map<string, number>;
  parents: Map<string, string[]>;
  children: Map<string, string[]>;
  primary: Map<string, string | null>;
  primaryChildren: Map<string, string[]>;
  atom: Map<string, boolean>;
  /** generation within the family: 1 + max(famDepth of same-family parents), 0 without any. */
  famDepth: Map<string, number>;
  edges: GEdge[];
  /** families with ≥1 model: FAMILY_BLOCKS order first, then unknown families by name. */
  families: string[];
  membersOf: Map<string, string[]>;
  /** sorted "a|b" family pair → cross-family edge count. */
  crossPairs: Map<string, number>;
  islet: Set<string>;
  warnings: string[];
}

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function buildGraph(tax: TaxonomyResponse, fam: FamilyMap): Graph {
  const warnings: string[] = [];
  const models = [...tax.models].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const byName = new Map<string, (typeof models)[number]>();
  for (const m of models) {
    if (byName.has(m.name)) warnings.push(`duplicate model "${m.name}" ignored`);
    else byName.set(m.name, m);
  }
  const names = [...byName.keys()];

  const parents = new Map<string, string[]>();
  for (const n of names) {
    const ps: string[] = [];
    for (const p of byName.get(n)!.builds_on ?? []) {
      if (p === n) warnings.push(`${n} builds on itself; edge ignored`);
      else if (!byName.has(p)) warnings.push(`${n} builds on unknown model "${p}"; edge ignored`);
      else if (!ps.includes(p)) ps.push(p);
    }
    parents.set(n, ps);
  }

  // depth = 1 + max(parent depth); cycles are cut with a warning.
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (n: string): number => {
    const d = depth.get(n);
    if (d !== undefined) return d;
    if (visiting.has(n)) {
      warnings.push(`builds_on cycle through "${n}"`);
      return 0;
    }
    visiting.add(n);
    const ps = parents.get(n)!;
    const v = ps.length ? 1 + Math.max(...ps.map(depthOf)) : 0;
    visiting.delete(n);
    depth.set(n, v);
    return v;
  };
  names.forEach(depthOf);

  // family: curated map → ATOMS → first parent's family (recursive) → fallback.
  const family = new Map<string, string>();
  const famVisiting = new Set<string>();
  const familyOf = (n: string): string => {
    const f = family.get(n);
    if (f) return f;
    let v: string | undefined = fam[n] ?? ATOMS[n]?.family;
    if (!v) {
      const first = parents.get(n)![0];
      if (first && !famVisiting.has(first)) {
        famVisiting.add(n);
        v = familyOf(first);
        famVisiting.delete(n);
      }
    }
    if (!v) {
      warnings.push(`no family for "${n}"; using ${FALLBACK_FAMILY}`);
      v = FALLBACK_FAMILY;
    }
    family.set(n, v);
    return v;
  };
  names.forEach(familyOf);

  // primary parent: deepest same-family parent (tie → first listed), else
  // deepest parent overall (tie → first listed).
  const primary = new Map<string, string | null>();
  for (const n of names) {
    const ps = parents.get(n)!;
    const pick = (cands: string[]) =>
      cands.reduce<string | null>((best, p) => (best === null || depth.get(p)! > depth.get(best)! ? p : best), null);
    const same = ps.filter((p) => family.get(p) === family.get(n));
    primary.set(n, same.length ? pick(same) : pick(ps));
  }

  const children = new Map<string, string[]>(names.map((n) => [n, []]));
  const primaryChildren = new Map<string, string[]>(names.map((n) => [n, []]));
  const edges: GEdge[] = [];
  for (const n of names) {
    for (const p of parents.get(n)!) {
      children.get(p)!.push(n);
      const isPrimary = primary.get(n) === p;
      if (isPrimary) primaryChildren.get(p)!.push(n);
      edges.push({ from: p, to: n, cross: family.get(p) !== family.get(n), primary: isPrimary });
    }
  }

  const present = new Set(family.values());
  const known = FAMILY_BLOCKS.map((b) => b.family).filter((f) => present.has(f));
  const unknown = [...present].filter((f) => !known.includes(f)).sort();
  const families = [...known, ...unknown];
  const membersOf = new Map<string, string[]>(families.map((f) => [f, []]));
  for (const n of names) membersOf.get(family.get(n)!)!.push(n);

  const crossPairs = new Map<string, number>();
  for (const e of edges) {
    if (!e.cross) continue;
    const k = pairKey(family.get(e.from)!, family.get(e.to)!);
    crossPairs.set(k, (crossPairs.get(k) ?? 0) + 1);
  }
  const touched = new Set<string>();
  for (const k of crossPairs.keys()) k.split("|").forEach((f) => touched.add(f));
  const islet = new Set(families.filter((f) => !touched.has(f)));

  const atom = new Map<string, boolean>(names.map((n) => [n, parents.get(n)!.length === 0]));
  const famDepth = new Map<string, number>();
  const fd = (n: string, guard: number): number => {
    const v = famDepth.get(n);
    if (v !== undefined) return v;
    const same = parents.get(n)!.filter((p) => family.get(p) === family.get(n));
    const d = same.length && guard < names.length ? 1 + Math.max(...same.map((p) => fd(p, guard + 1))) : 0;
    famDepth.set(n, d);
    return d;
  };
  names.forEach((n) => fd(n, 0));

  return {
    names, family, depth, parents, children, primary, primaryChildren, atom, famDepth,
    edges, families, membersOf, crossPairs, islet, warnings,
  };
}
