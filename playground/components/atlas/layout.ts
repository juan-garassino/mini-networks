// Pure, deterministic layout for the Network Atlas constellation. Takes the
// taxonomy + canvas size, returns positioned nodes, concept dots, relationship
// edges and adjacency. No Math.random / Date — a name-hash drives all jitter so
// re-renders are stable.
import type { TaxonomyResponse } from "@/lib/types";
import { ATOMS, FAMILY_BLOCKS, PLACEMENT } from "@/lib/blueprint";
import {
  HUB_NAME, R_CONCEPT, R_DERIVED, R_HUB, R_MILESTONE, R_MODEL,
  REGION_BY_KEY, REGIONS, type RegionKey,
} from "./theme";

export type NodeKind = "hub" | "milestone" | "model" | "derived";
export type AtlasNode = {
  name: string; x: number; y: number; r: number;
  region: RegionKey; color: string; kind: NodeKind;
  level: "elementary" | "derived"; inDeg: number;
  description: string; note: string; buildsOn: string[]; introduces: string[];
};
export type ConceptDot = { x: number; y: number; color: string; home: string };
export type AtlasEdge = { from: string; to: string; type: "derives" | "combine"; hub: boolean };
export type AtlasLayout = {
  nodes: AtlasNode[];
  concepts: ConceptDot[];
  edges: AtlasEdge[];
  adj: Map<string, Set<string>>;
  byName: Map<string, AtlasNode>;
  usedBy: Map<string, string[]>;
};

const GA = 137.508 * (Math.PI / 180);

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295; // 0..1
}

const blockForCol = (col: number) =>
  FAMILY_BLOCKS.find((b) => col >= b.cols[0] && col <= b.cols[1])?.family ?? "structure";
export const familyForName = (name: string, tax: TaxonomyResponse): string => {
  const col = PLACEMENT[name]?.col;
  if (col != null) return blockForCol(col);
  if (ATOMS[name]) return ATOMS[name].family;
  const m = tax.models.find((x) => x.name === name);
  return m?.builds_on[0] ? familyForName(m.builds_on[0], tax) : "structure";
};

export function computeAtlas(tax: TaxonomyResponse, W: number, H: number): AtlasLayout {
  // in-degree from builds_on (how many models derive from X)
  const inDeg = new Map<string, number>();
  const usedBy = new Map<string, string[]>();
  for (const m of tax.models) {
    for (const p of m.builds_on) {
      inDeg.set(p, (inDeg.get(p) ?? 0) + 1);
      usedBy.set(p, [...(usedBy.get(p) ?? []), m.name]);
    }
  }

  const kindOf = (name: string, level: string, deg: number): NodeKind =>
    name === HUB_NAME ? "hub" : deg >= 5 ? "milestone" : level === "elementary" ? "model" : "derived";
  const radiusOf = (k: NodeKind) =>
    k === "hub" ? R_HUB : k === "milestone" ? R_MILESTONE : k === "model" ? R_MODEL : R_DERIVED;

  // group members by region, biggest in-degree first (they anchor near centre)
  const groups = new Map<RegionKey, typeof tax.models>();
  for (const m of tax.models) {
    if (m.name === HUB_NAME) continue; // pinned to global centre
    const fam = familyForName(m.name, tax) as RegionKey;
    groups.set(fam, [...(groups.get(fam) ?? []), m]);
  }

  const nodes: AtlasNode[] = [];
  const push = (name: string, x: number, y: number, region: RegionKey) => {
    const m = tax.models.find((z) => z.name === name)!;
    const deg = inDeg.get(name) ?? 0;
    const kind = kindOf(name, m.level, deg);
    nodes.push({
      name, x, y, r: radiusOf(kind), region,
      color: REGION_BY_KEY[region].color, kind, level: m.level, inDeg: deg,
      description: m.description, note: m.note, buildsOn: m.builds_on, introduces: m.introduces,
    });
  };

  // hub dead centre
  push(HUB_NAME, W / 2, H * 0.5, familyForName(HUB_NAME, tax) as RegionKey);

  for (const reg of REGIONS) {
    const ms = (groups.get(reg.key) ?? []).slice()
      .sort((a, b) => (inDeg.get(b.name) ?? 0) - (inDeg.get(a.name) ?? 0));
    const rc = reg.r * Math.min(W, H);
    const cx = reg.cx * W, cy = reg.cy * H;
    ms.forEach((m, j) => {
      const t = ms.length > 1 ? (j + 0.45) / ms.length : 0;
      const rad = rc * Math.sqrt(t) * 0.95;
      const ang = j * GA + (hash(m.name) - 0.5) * 0.9;
      push(m.name, cx + rad * Math.cos(ang), cy + rad * Math.sin(ang), reg.key);
    });
  }

  // deterministic collision relaxation (hub stays pinned)
  const pad = 12;
  for (let pass = 0; pass < 60; pass++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let k = i + 1; k < nodes.length; k++) {
        const a = nodes[i], b = nodes[k];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const min = a.r + b.r + pad + 20; // room for labels
        if (d < min) {
          const push2 = (min - d) / 2;
          const ux = dx / d, uy = dy / d;
          if (a.name !== HUB_NAME) { a.x -= ux * push2; a.y -= uy * push2; }
          if (b.name !== HUB_NAME) { b.x += ux * push2; b.y += uy * push2; }
        }
      }
    }
  }
  // keep inside canvas margins
  for (const n of nodes) {
    n.x = Math.max(70, Math.min(W - 70, n.x));
    n.y = Math.max(70, Math.min(H - 96, n.y));
  }

  const byName = new Map(nodes.map((n) => [n.name, n]));

  // concept dots: each introduced mechanism as a tiny satellite of its model
  const concepts: ConceptDot[] = [];
  for (const n of nodes) {
    n.introduces.forEach((mech, j) => {
      const a = hash(n.name + mech) * Math.PI * 2 + j;
      const dist = n.r + 12 + hash(mech + n.name) * 12;
      concepts.push({ x: n.x + Math.cos(a) * dist, y: n.y + Math.sin(a) * dist, color: n.color, home: n.name });
    });
  }

  // edges: derives-from (builds_on) + combine (composition members, chained)
  const edges: AtlasEdge[] = [];
  const adj = new Map<string, Set<string>>();
  const link = (x: string, y: string) => {
    adj.set(x, (adj.get(x) ?? new Set()).add(y));
    adj.set(y, (adj.get(y) ?? new Set()).add(x));
  };
  for (const m of tax.models) {
    for (const p of m.builds_on) {
      if (byName.has(m.name) && byName.has(p)) {
        edges.push({ from: m.name, to: p, type: "derives", hub: p === HUB_NAME });
        link(m.name, p);
      }
    }
  }
  for (const c of tax.compositions) {
    const mem = c.composes.filter((x) => byName.has(x));
    for (let i = 1; i < mem.length; i++) {
      edges.push({ from: mem[i - 1], to: mem[i], type: "combine", hub: false });
      link(mem[i - 1], mem[i]);
    }
  }

  return { nodes, concepts, edges, adj, byName, usedBy };
}

export const CONCEPT_R = R_CONCEPT;
