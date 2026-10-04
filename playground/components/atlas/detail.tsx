"use client";

// The detail rail for the selected model: a docked right column on desktop
// (the graph re-fits beside it), a bottom sheet on phones. Family, name,
// description, the mechanisms it introduces, what it builds on, what builds
// on it, and the pipelines it joins — each list links back into the graph.
import type { TaxonomyResponse } from "@/lib/types";
import type { AtlasLayout, AtlasNode } from "./layout";
import { ATLAS_INK, ATLAS_INK_DIM, ATLAS_PAPER, REGION_BY_KEY } from "./theme";

const SANS = "var(--font-jost), sans-serif";
const SERIF = "var(--font-cormorant), serif";
const pretty = (s: string) => s.replace(/_/g, " ");

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 border-t pt-3" style={{ borderColor: "#ddd5c4" }}>
      <h3 className="text-[15px] font-bold" style={{ fontFamily: SERIF, color: ATLAS_INK }}>{label}</h3>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

function ModelList({ items, layout, onSelect }: { items: string[]; layout: AtlasLayout; onSelect: (n: string) => void }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
      {items.map((m) => (
        <li key={m}>
          <button onClick={() => onSelect(m)}
            className="flex w-full items-center gap-2 text-left text-[13px] leading-snug underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
            style={{ color: ATLAS_INK }}>
            <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: layout.byName.get(m)?.color ?? ATLAS_INK_DIM }} />
            <span className="truncate">{pretty(m)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function AtlasDetail({
  node, layout, taxonomy, onSelect,
}: {
  node: AtlasNode; layout: AtlasLayout; taxonomy: TaxonomyResponse; onSelect: (n: string | null) => void;
}) {
  const region = REGION_BY_KEY[node.region];
  const usedBy = layout.usedBy.get(node.name) ?? [];
  const pipes = layout.pipelines.get(node.name) ?? [];

  return (
    <aside aria-label={`${pretty(node.name)} details`}
      className="fixed inset-x-0 bottom-0 z-20 max-h-[46vh] overflow-y-auto border-t px-5 pb-6 pt-4 shadow-[0_-8px_24px_rgba(43,39,35,0.10)] md:static md:inset-auto md:z-auto md:h-full md:max-h-none md:w-[320px] md:border-l md:border-t-0 md:px-6 md:pt-8 md:shadow-none"
      style={{ background: ATLAS_PAPER, borderColor: "#ddd5c4", fontFamily: SANS }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-[12px]" style={{ color: region.color }}>
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: region.color }} />
          {region.name}, {node.level === "elementary" ? "atom" : "derived model"}
        </div>
        <button onClick={() => onSelect(null)} aria-label="Close details"
          className="-mr-1 -mt-1 px-1 text-[18px] leading-none focus-visible:outline focus-visible:outline-1"
          style={{ color: ATLAS_INK_DIM }}>×</button>
      </div>
      <h2 className="mt-1 text-[30px] font-bold leading-[1.05]" style={{ fontFamily: SERIF, color: ATLAS_INK }}>
        {pretty(node.name)}
      </h2>
      <p className="mt-2 max-w-[40ch] text-[13px] leading-[1.5]" style={{ color: ATLAS_INK }}>
        {node.description || node.note || "A model in the mini_networks zoo."}
      </p>

      {node.introduces.length > 0 && (
        <Section label={node.introduces.length === 1 ? "Introduces" : `Introduces ${node.introduces.length} mechanisms`}>
          <dl className="space-y-1.5">
            {node.introduces.map((m) => (
              <div key={m}>
                <dt className="text-[13px] font-semibold" style={{ color: ATLAS_INK }}>{pretty(m)}</dt>
                {taxonomy.mechanisms[m]?.description && (
                  <dd className="text-[12px] leading-snug" style={{ color: ATLAS_INK_DIM }}>{taxonomy.mechanisms[m].description}</dd>
                )}
              </div>
            ))}
          </dl>
        </Section>
      )}
      {node.buildsOn.length > 0 && (
        <Section label="Builds on"><ModelList items={node.buildsOn} layout={layout} onSelect={onSelect} /></Section>
      )}
      {usedBy.length > 0 && (
        <Section label={`Built on by ${usedBy.length}`}><ModelList items={usedBy} layout={layout} onSelect={onSelect} /></Section>
      )}
      {pipes.length > 0 && (
        <Section label={pipes.length === 1 ? "In one pipeline" : `In ${pipes.length} pipelines`}>
          <ul className="space-y-0.5">
            {pipes.map((p) => (
              <li key={p} className="text-[13px] leading-snug" style={{ color: ATLAS_INK }}>{pretty(p)}</li>
            ))}
          </ul>
        </Section>
      )}
    </aside>
  );
}
