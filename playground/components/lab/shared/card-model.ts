// Headless model-card content: every skin renders the SAME facts its own way,
// so the bake-off compares design, not data. Pure — no fetching here.
import { artifactUrl } from "@/lib/api";
import { symbolFor } from "@/lib/blueprint";
import type { ModelEvidence, RunSummary, TaxonomyResponse } from "@/lib/types";

// One vocabulary for proof-it-works across skins (flag / face / status line).
// Precedence: a champion is proven; provisional means the bar itself is new.
export type EvidenceState = "champion" | "provisional" | "trained" | "untrained";

export function evidenceState(e: ModelEvidence | undefined): EvidenceState {
  if (!e) return "untrained";
  if (e.champion) return "champion";
  if (e.provisional) return "provisional";
  return e.run_count > 0 ? "trained" : "untrained";
}

export const EVIDENCE_COPY: Record<EvidenceState, string> = {
  champion: "Champion — a trained checkpoint passed the quality gate",
  provisional: "New — its quality bar is still provisional",
  trained: "Trained locally — no champion yet",
  untrained: "Not trained yet",
};

export interface CardModel {
  name: string;
  symbol: string;
  family: string;
  atom: boolean;
  depth: number;
  description: string;
  note: string;
  introduces: { key: string; description: string }[];
  parents: string[];
  children: string[];
  compositions: { name: string; composes: string[]; description: string }[];
  evidence: ModelEvidence | undefined;
  state: EvidenceState;
  // best metric vs the M bar, by direction; null when either side is unknown
  passesBar: boolean | null;
  latestRun: RunSummary | undefined;
  sampleImage: string | null;
}

export function cardModel(
  name: string,
  ctx: {
    taxonomy: TaxonomyResponse;
    evidence: ModelEvidence[];
    runs: RunSummary[];
    family: string;
    depth: number;
  },
): CardModel | null {
  const m = ctx.taxonomy.models.find((x) => x.name === name);
  if (!m) return null;
  const ev = ctx.evidence.find((e) => e.name === name);
  const runs = ctx.runs
    .filter((r) => r.model === name)
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  const latest = runs[0];
  const img = runs
    .flatMap((r) => r.artifact_names.filter((a) => /\.(png|jpe?g|gif|webp)$/i.test(a)).map((a) => artifactUrl(r.id, a)))[0];
  const passes =
    ev && ev.best_metric != null && ev.threshold_m != null
      ? ev.higher_is_better ? ev.best_metric >= ev.threshold_m : ev.best_metric <= ev.threshold_m
      : null;

  return {
    name,
    symbol: symbolFor(name),
    family: ctx.family,
    atom: m.level === "elementary",
    depth: ctx.depth,
    description: m.description,
    note: m.note,
    introduces: m.introduces.map((k) => ({ key: k, description: ctx.taxonomy.mechanisms[k]?.description ?? "" })),
    parents: m.builds_on,
    children: ctx.taxonomy.models.filter((x) => x.builds_on.includes(name)).map((x) => x.name),
    compositions: ctx.taxonomy.compositions.filter((c) => c.composes.includes(name)),
    evidence: ev,
    state: evidenceState(ev),
    passesBar: passes,
    latestRun: latest,
    sampleImage: img ?? null,
  };
}

// Model names are snake_case identifiers; learners read words.
export function displayName(name: string): string {
  return name.replace(/_/g, " ");
}
