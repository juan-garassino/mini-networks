// Trains = training (spec R2-E). Pure helpers over /web/runs.
import type { RunSummary } from "../../../../lib/types.ts";

/** Models with at least one `running` run — a train runs their lineage line. */
export function liveTrainingModels(runs: RunSummary[]): string[] {
  const out: string[] = [];
  for (const r of runs) if (r.status === "running" && !out.includes(r.model)) out.push(r.model);
  return out;
}

/** Runs per model — each spot's station board shows this count. */
export function stationCounts(runs: RunSummary[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of runs) out[r.model] = (out[r.model] ?? 0) + 1;
  return out;
}
