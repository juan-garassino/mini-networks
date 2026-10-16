"use client";

// Everything a lesson card shows for one model (spec R2-B), headless:
//   lesson   — plain-language copy (lib/lessons.ts); `composition` for a composition
//   curve    — main loss (+ gate metric) of the best run that has ≥2 points
//   samples  — image artifact URLs from that model's runs (newest first, ≤8)
//   champion — the registry champion from /web/evidence, or null
// Pass runs/evidence from useWorld (no duplicate polling). Metrics are fetched
// only for the selected model, once per (run, last_step, status) and cached
// for the session (lesson/metrics-cache.ts) — never on a timer. With still=1
// the runs don't change, so it is exactly one fetch per selection.
import { useEffect, useMemo, useState } from "react";
import { artifactUrl } from "@/lib/api";
import { lessonFor, type Lesson } from "@/lib/lessons";
import type { ModelEvidence, RunSummary } from "@/lib/types";
import { lessonRunOrder, pickCurve, type Curve } from "@/components/lab/shared/lesson/curve";
import { cachedMetrics, metricsKey } from "@/components/lab/shared/lesson/metrics-cache";

const MAX_TRIES = 3;                   // runs probed for a curve before giving up
const IMG = /\.(png|jpe?g|gif|webp)$/i;

export interface LessonData {
  lesson: Lesson | null;
  /** one-sentence lesson when `name` is a composition */
  composition: string | null;
  curve: Curve[] | null;
  /** the run the curve came from */
  curveRun: RunSummary | null;
  samples: string[];
  champion: { version: string; label: string } | null;
  loading: boolean;
  error: string | null;
}

export function useLesson(
  name: string | null,
  { runs, evidence, still }: { runs: RunSummary[]; evidence: ModelEvidence[]; still: boolean | null },
): LessonData {
  const found = name ? lessonFor(name) : null;

  const ordered = useMemo(() => (name ? lessonRunOrder(runs, name).slice(0, MAX_TRIES) : []), [runs, name]);
  // a stable string: the effect re-runs only when a candidate run actually changes
  const candKey = ordered.map(metricsKey).join(",");

  const ev = name ? evidence.find((e) => e.name === name) : undefined;
  const gate = ev?.gate_metric ?? null;

  const [state, setState] = useState<{
    name: string | null; key: string; curve: Curve[] | null; run: RunSummary | null; error: string | null;
  }>({ name: null, key: "", curve: null, run: null, error: null });

  useEffect(() => {
    if (!name || still === null || !candKey) return;
    let alive = true;
    const cands = ordered;
    (async () => {
      let lastErr: string | null = null;
      for (const r of cands) {
        try {
          const m = await cachedMetrics(r);
          const c = pickCurve(m.series, gate);
          if (c) {
            if (alive) setState({ name, key: candKey, curve: c, run: r, error: null });
            return;
          }
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
        }
      }
      if (alive) setState({ name, key: candKey, curve: null, run: null, error: lastErr });
    })();
    return () => { alive = false; };
    // `ordered` is summarised by candKey on purpose (runs is a new array every poll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, still, candKey, gate]);

  const current = state.key === candKey && candKey !== "";
  // same model, newer points on the way: keep showing the previous curve
  const sameModel = state.name === name;
  const samples = useMemo(() => {
    if (!name) return [];
    return runs
      .filter((r) => r.model === name)
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      .flatMap((r) => r.artifact_names.filter((a) => IMG.test(a)).map((a) => artifactUrl(r.id, a)))
      .slice(0, 8);
  }, [runs, name]);

  const champion = ev?.champion
    ? { version: ev.champion_version?.match(/\bv\d+\b/)?.[0] ?? "champion", label: ev.champion_version ?? "" }
    : null;

  return {
    lesson: found?.kind === "model" ? found.lesson : null,
    composition: found?.kind === "composition" ? found.line : null,
    curve: sameModel ? state.curve : null,
    curveRun: sameModel ? state.run : null,
    samples,
    champion,
    loading: Boolean(candKey) && still !== null && !current,
    error: current ? state.error : null,
  };
}
