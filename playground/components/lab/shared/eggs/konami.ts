// Konami forward pass — pure half (sequence matcher + zoo depth order).
// The hook lives in use-eggs.ts; this file is node-testable.

/** ↑ ↑ ↓ ↓ ← → ← → B A, as KeyboardEvent.key values (letters lower-cased). */
export const KONAMI: readonly string[] = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a",
];

export function normalizeKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
}

/**
 * Feed one key; returns the new matched-prefix length (KONAMI.length = done).
 * A wrong key falls back to the longest prefix that is still a suffix of what
 * was typed, so "↑ ↑ ↑ ↓ ↓ …" still unlocks.
 */
export function advanceKonami(pos: number, rawKey: string, seq: readonly string[] = KONAMI): number {
  const key = normalizeKey(rawKey);
  if (pos >= seq.length) pos = 0;
  const typed = [...seq.slice(0, pos), key];
  for (let k = Math.min(typed.length, seq.length); k > 0; k--) {
    let ok = true;
    for (let i = 0; i < k; i++) {
      if (typed[typed.length - k + i] !== seq[i]) { ok = false; break; }
    }
    if (ok) return k;
  }
  return 0;
}

/** Run a whole key sequence through the matcher; true if it completes at any point. */
export function konamiMatches(keys: string[], seq: readonly string[] = KONAMI): boolean {
  let pos = 0;
  for (const k of keys) {
    pos = advanceKonami(pos, k, seq);
    if (pos === seq.length) return true;
  }
  return false;
}

type DepthSource =
  | { nodes: { name: string; depth: number }[] }
  | { models: { name: string; builds_on: string[] }[] };

/**
 * Model names grouped by generation depth (0 = atoms, then everything whose
 * deepest parent is an atom, …) — the order of the "whole zoo forward pass"
 * wave. Accepts a built World (uses node.depth) or a taxonomy (computes
 * depth = 1 + max(parent depth); unknown parents are ignored, cycles broken).
 * Order inside a group follows the input order.
 */
export function forwardPassOrder(src: DepthSource): string[][] {
  const depth = new Map<string, number>();
  let names: string[];
  if ("nodes" in src) {
    names = src.nodes.map((n) => n.name);
    for (const n of src.nodes) depth.set(n.name, n.depth);
  } else {
    names = src.models.map((m) => m.name);
    const parents = new Map(src.models.map((m) => [m.name, m.builds_on]));
    const visiting = new Set<string>();
    const d = (n: string): number => {
      const hit = depth.get(n);
      if (hit != null) return hit;
      if (visiting.has(n)) return 0;
      visiting.add(n);
      const ps = (parents.get(n) ?? []).filter((p) => parents.has(p));
      const v = ps.length ? 1 + Math.max(...ps.map(d)) : 0;
      visiting.delete(n);
      depth.set(n, v);
      return v;
    };
    names.forEach(d);
  }
  const groups: string[][] = [];
  for (const n of names) {
    const k = depth.get(n) ?? 0;
    (groups[k] ??= []).push(n);
  }
  return groups.filter((g) => g && g.length);
}

/**
 * Start delay (ms) per model for the wave: group g lights at g * stepMs.
 * Skins animate each spot's forward pass (anatomy / pulse) at its delay.
 */
export function forwardPassSchedule(groups: string[][], stepMs = 450): Record<string, number> {
  const out: Record<string, number> = {};
  groups.forEach((g, i) => g.forEach((n) => { out[n] = i * stepMs; }));
  return out;
}
