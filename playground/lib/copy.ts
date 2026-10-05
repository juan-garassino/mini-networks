// The library's shared data voice (DESIGN-LIBRARY.md § Names and counts):
// one site name and page-title rule, one way to turn a model id into words,
// and one count of the zoo — so every design prints the same numbers in the
// same words. Pure: node --test may import it (relative path, .ts extension).
import type { ModelEvidence, TaxonomyResponse } from "./types.ts";

export const SITE = "mini_networks";

/** A route's <title>: "Kawaii flow | mini_networks" (app/layout.tsx title.template). */
export const pageTitle = (name: string) => `${name} | ${SITE}`;

/** Model and composition ids are snake_case; people read words: "text_diffusion" → "text diffusion".
 * Case is the design's (CSS text-transform), never baked into the string. */
export function displayName(id: string): string {
  return id.replace(/_/g, " ");
}

export interface ZooCounts {
  models: number;
  /** elementary models: each introduces one mechanism and starts a lineage */
  atoms: number;
  /** compositions; a design may call them reactions (periodic) or through services (transit) */
  pipelines: number;
  /** families with at least one model (0 without a family map) */
  families: number;
  /** models with a champion: a trained checkpoint passed the quality gate */
  proven: number;
}

/** The zoo's totals from /web/taxonomy (+ /web/evidence, + the family map). */
export function zooCounts(
  taxonomy: Pick<TaxonomyResponse, "models" | "compositions"> | null,
  evidence: readonly ModelEvidence[] = [],
  family: Record<string, string> | null = null,
): ZooCounts {
  const models = taxonomy?.models ?? [];
  const names = new Set(models.map((m) => m.name));
  return {
    models: models.length,
    atoms: models.filter((m) => m.level === "elementary").length,
    pipelines: taxonomy?.compositions.length ?? 0,
    families: family ? new Set(models.map((m) => family[m.name]).filter(Boolean)).size : 0,
    proven: evidence.filter((e) => e.champion && names.has(e.name)).length,
  };
}

/** Singular / plural for each counted noun. */
export const NOUNS = {
  models: ["model", "models"],
  atoms: ["atom", "atoms"],
  pipelines: ["pipeline", "pipelines"],
  reactions: ["reaction", "reactions"],
  families: ["family", "families"],
  proven: ["proven", "proven"],
} as const satisfies Record<string, readonly [string, string]>;

/** "44 models", "1 model". */
export function countOf(n: number, noun: keyof typeof NOUNS): string {
  return `${n} ${NOUNS[noun][n === 1 ? 0 : 1]}`;
}
