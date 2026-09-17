"use client";

// In-canvas chrome for the atlas (Image 17 parts): title block + node-type and
// edge-type legends (top-left), a decorative timeline axis + counts (bottom).
// Plain HTML overlays positioned over the full-bleed SVG.
import { ATLAS_INK, ATLAS_INK_DIM, HUB_INK } from "./theme";

const NODE_KEYS: [string, string][] = [
  ["model", "Model"], ["family", "Family"], ["milestone", "Milestone"], ["concept", "Concept"],
];
const EDGE_KEYS = ["Derives from", "Evolves to", "Combines with", "Related to", "Similar to"];

export function AtlasTitle() {
  return (
    <div className="pointer-events-none absolute left-8 top-7 select-none">
      <h1 className="leading-[0.95] tracking-[0.02em]" style={{ fontFamily: "var(--font-cormorant), serif", color: ATLAS_INK, fontSize: 34, fontWeight: 700 }}>
        THE<br />NETWORK<br />ATLAS
      </h1>
      <p className="mt-3 max-w-[190px] text-[11px] leading-snug" style={{ color: ATLAS_INK_DIM, fontFamily: "var(--font-jost), sans-serif" }}>
        A map of machine intelligence — the relationships between neural
        networks, models and ideas.
      </p>
    </div>
  );
}

export function AtlasLegend() {
  return (
    <div className="pointer-events-none absolute bottom-24 left-8 select-none text-[11px]"
      style={{ color: ATLAS_INK, fontFamily: "var(--font-jost), sans-serif" }}>
      <div className="mb-3 space-y-1.5">
        {NODE_KEYS.map(([k, label]) => (
          <div key={k} className="flex items-center gap-2.5">
            {k === "model" && <span className="inline-block h-3.5 w-3.5 rounded-full" style={{ background: HUB_INK }} />}
            {k === "family" && <span className="inline-block h-3.5 w-3.5 rounded-full border-[1.5px]" style={{ borderColor: HUB_INK }} />}
            {k === "milestone" && <span className="inline-block h-3.5 w-3.5 rounded-full border-[1.5px]" style={{ background: HUB_INK, boxShadow: `0 0 0 2px #f4f0e6, 0 0 0 3px ${HUB_INK}` }} />}
            {k === "concept" && <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: HUB_INK }} />}
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="space-y-1.5" style={{ color: ATLAS_INK_DIM }}>
        {EDGE_KEYS.map((e, i) => (
          <div key={e} className="flex items-center gap-2.5">
            <svg width="26" height="6" viewBox="0 0 26 6">
              <line x1="0" y1="3" x2="26" y2="3" stroke={ATLAS_INK} strokeWidth="1"
                strokeDasharray={i === 2 ? "2 3" : i >= 3 ? "1 3" : undefined}
                markerEnd={i === 1 ? "url(#leg-arrow)" : undefined} />
              <defs><marker id="leg-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10z" fill={ATLAS_INK} /></marker></defs>
            </svg>
            <span>{e}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AtlasTimeline({ models, edges }: { models: number; edges: number }) {
  const years = [2012, 2014, 2016, 2018, 2020, 2022, 2024, 2026];
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 select-none px-8">
      <div className="mx-auto flex max-w-[900px] items-center gap-3" style={{ color: ATLAS_INK_DIM, fontFamily: "var(--font-jost), sans-serif" }}>
        <div className="relative h-px flex-1" style={{ background: ATLAS_INK_DIM }}>
          {years.map((y, i) => (
            <div key={y} className="absolute -top-1.5 flex flex-col items-center" style={{ left: `${(i / (years.length - 1)) * 100}%`, transform: "translateX(-50%)" }}>
              <span className="block h-2 w-px" style={{ background: ATLAS_INK_DIM }} />
              <span className="mt-1 text-[9px]">{y}</span>
            </div>
          ))}
          <span className="absolute -top-[3px] h-2 w-2 rounded-full" style={{ left: "62%", background: ATLAS_INK }} />
        </div>
        <span className="whitespace-nowrap text-[10px]">{models} models · {edges} relationships</span>
      </div>
    </div>
  );
}
