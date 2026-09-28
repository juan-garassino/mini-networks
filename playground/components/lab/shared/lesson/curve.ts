// Pure metric-curve helpers shared by useLesson (the card's sparkline) and the
// critter egg (a REAL decreasing loss curve). Relative imports only — tested
// under node --test (curve.test.ts).
import type { MetricSeries, RunSummary } from "../../../../lib/types.ts";

export type Curve = { key: string; points: [number, number][] };

// Bookkeeping series logged beside the metrics — never worth a sparkline.
const NOT_A_CURVE = /^(epoch|step|stage|phase|epsilon|lr|learning_rate|time|elapsed|batch|global_step)$/i;

function usable(s: MetricSeries): boolean {
  return !NOT_A_CURVE.test(s.key) && s.points.length >= 2 && s.points.every(([, v]) => Number.isFinite(v));
}

/** The main loss key of a run: "loss" > "train_loss" > the longest *loss series. */
export function mainLoss(series: MetricSeries[]): MetricSeries | null {
  const ok = series.filter(usable);
  for (const k of ["loss", "train_loss", "total_loss"]) {
    const hit = ok.find((s) => s.key === k);
    if (hit) return hit;
  }
  const losses = ok
    .filter((s) => /loss$/i.test(s.key) && !/aux/i.test(s.key))
    .sort((a, b) => b.points.length - a.points.length);
  return losses[0] ?? null;
}

/**
 * What a lesson card plots: the main loss, plus the quality-gate metric when
 * the run logged it (evidence.gate_metric, e.g. "accuracy", "psnr"). Falls
 * back to the longest usable series. null when nothing has ≥2 points.
 */
export function pickCurve(series: MetricSeries[], gateMetric?: string | null): Curve[] | null {
  const out: Curve[] = [];
  const loss = mainLoss(series);
  if (loss) out.push({ key: loss.key, points: loss.points });
  const gate = gateMetric ? series.find((s) => s.key === gateMetric && usable(s)) : undefined;
  if (gate && gate.key !== loss?.key) out.push({ key: gate.key, points: gate.points });
  if (!out.length) {
    const longest = series.filter(usable).sort((a, b) => b.points.length - a.points.length)[0];
    if (longest) out.push({ key: longest.key, points: longest.points });
  }
  return out.length ? out : null;
}

/**
 * Runs of one model in the order a lesson card should try them: live or
 * finished first, then the longest (last_step), then the newest.
 */
export function lessonRunOrder(runs: RunSummary[], model: string): RunSummary[] {
  const rank = (r: RunSummary) => (r.status === "done" ? 0 : r.status === "running" ? 1 : 2);
  return runs
    .filter((r) => r.model === model)
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (b.last_step ?? -1) - (a.last_step ?? -1) ||
        (b.created_at ?? "").localeCompare(a.created_at ?? ""),
    );
}

/**
 * "Clearly decreasing": ≥3 finite points, the last quarter's mean at least
 * 25% below the first quarter's (relative to |first|), and ≥60% of steps
 * going down. Returns the relative drop (0..1+) or null when it doesn't qualify.
 */
export function decreaseScore(points: [number, number][]): number | null {
  if (points.length < 3 || !points.every(([, v]) => Number.isFinite(v))) return null;
  const vs = points.map(([, v]) => v);
  const q = Math.max(1, Math.floor(vs.length / 4));
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  const first = mean(vs.slice(0, q));
  const last = mean(vs.slice(-q));
  if (first === 0) return null;
  const drop = (first - last) / Math.abs(first);
  let down = 0;
  for (let i = 1; i < vs.length; i++) if (vs[i] < vs[i - 1]) down++;
  if (drop < 0.25 || down / (vs.length - 1) < 0.6) return null;
  return drop;
}

export interface RealLossCurve {
  runId: string;
  model: string;
  key: string;
  points: [number, number][];
  /** relative drop first-quarter → last-quarter (0..1) */
  drop: number;
}

/**
 * Candidate runs for the critter's real loss curve, best first: done runs
 * whose last metrics mention a loss, longest first. Callers fetch metrics in
 * this order and stop at the first ≥10-point qualifier.
 */
export function lossCandidates(runs: RunSummary[], limit = 24): RunSummary[] {
  return runs
    .filter((r) => r.status === "done" && Object.keys(r.last_metrics).some((k) => /loss/i.test(k)))
    .sort(
      (a, b) =>
        (b.last_step ?? -1) - (a.last_step ?? -1) ||
        (b.created_at ?? "").localeCompare(a.created_at ?? ""),
    )
    .slice(0, limit);
}

/** Best clearly-decreasing loss series of one run's metrics, or null. */
export function bestDecreasing(runId: string, model: string, series: MetricSeries[]): RealLossCurve | null {
  let best: RealLossCurve | null = null;
  for (const s of series) {
    if (!/loss/i.test(s.key) || /aux/i.test(s.key)) continue;
    const drop = decreaseScore(s.points);
    if (drop == null) continue;
    const cand = { runId, model, key: s.key, points: s.points, drop };
    if (!best || better(cand, best)) best = cand;
  }
  return best;
}

/** Prefer ≥10 points, then more points, then a bigger drop. */
export function better(a: RealLossCurve, b: RealLossCurve): boolean {
  const la = a.points.length >= 10 ? 1 : 0;
  const lb = b.points.length >= 10 ? 1 : 0;
  if (la !== lb) return la > lb;
  if (a.points.length !== b.points.length) return a.points.length > b.points.length;
  return a.drop > b.drop;
}
