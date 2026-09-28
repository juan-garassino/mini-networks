// One metrics fetch per (run, version) for the whole page session — shared by
// useLesson and the critter egg so neither refetches in a loop. `version` is
// whatever changes when the run has new points (last_step + status); a done
// run's key never changes, so it is fetched exactly once.
import { getMetrics } from "@/lib/api";
import type { MetricsResponse, RunSummary } from "@/lib/types";

const cache = new Map<string, Promise<MetricsResponse>>();

export function metricsKey(run: Pick<RunSummary, "id" | "last_step" | "status">): string {
  return `${run.id}@${run.last_step ?? ""}@${run.status}`;
}

export function cachedMetrics(run: Pick<RunSummary, "id" | "last_step" | "status">): Promise<MetricsResponse> {
  const key = metricsKey(run);
  let p = cache.get(key);
  if (!p) {
    p = getMetrics(run.id);
    // failed fetches are forgotten so a later open can retry (never a loop:
    // callers only fetch on selection / unlock, not on a timer)
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}
