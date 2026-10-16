"use client";

// The Network Atlas's left column: title block, live counts and the key.
// The key is rendered from NETWORK_LEGEND (encoding.ts) so it names exactly
// the marks the graph draws — nothing decorative, nothing it doesn't draw.
import { useId } from "react";
import { NETWORK_LEGEND, type LegendMark } from "./encoding";
import { ATLAS_INK, ATLAS_INK_DIM, HUB_INK, R_DERIVED, R_MODEL } from "./theme";

const SANS = "var(--font-jost), sans-serif";
const SERIF = "var(--font-cormorant), serif";
const SAMPLE = "#7d756a"; // a neutral ink for family-coloured marks in the key

function Swatch({ mark }: { mark: LegendMark }) {
  const id = `leg-${mark}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`; // the key renders twice (desktop column + phone)
  return (
    <svg width="34" height="18" viewBox="0 0 34 18" aria-hidden className="shrink-0">
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0 L10 5 L0 10z" fill={mark === "builds-hub" ? HUB_INK : ATLAS_INK_DIM} />
        </marker>
      </defs>
      {mark === "atom" && <circle cx="9" cy="9" r={R_MODEL * 0.8} fill={SAMPLE} />}
      {mark === "derived" && <circle cx="9" cy="9" r={R_DERIVED * 0.75} fill={SAMPLE} />}
      {mark === "milestone" && <><circle cx="9" cy="9" r="5.2" fill={SAMPLE} /><circle cx="9" cy="9" r="7.8" fill="none" stroke={SAMPLE} strokeWidth="1.1" opacity="0.7" /></>}
      {mark === "hub" && <><circle cx="9" cy="9" r="6" fill={HUB_INK} /><circle cx="9" cy="9" r="8.4" fill="none" stroke={HUB_INK} strokeWidth="1.1" opacity="0.6" /></>}
      {mark === "concept" && <><circle cx="7" cy="9" r="4" fill={SAMPLE} /><circle cx="16" cy="5" r="1.8" fill={SAMPLE} opacity="0.6" /></>}
      {mark === "builds" && <line x1="1" y1="9" x2="31" y2="9" stroke={ATLAS_INK_DIM} strokeWidth="1" markerEnd={`url(#${id})`} />}
      {mark === "builds-hub" && <line x1="1" y1="9" x2="31" y2="9" stroke={HUB_INK} strokeWidth="1.1" markerEnd={`url(#${id})`} />}
      {mark === "pipeline" && <line x1="1" y1="9" x2="33" y2="9" stroke={SAMPLE} strokeWidth="1" strokeDasharray="1.5 4" strokeLinecap="round" />}
    </svg>
  );
}

export function AtlasTitle({ counts }: { counts: { models: number; links: number; pipelines: number } | null }) {
  return (
    <div className="select-none">
      <h1 className="text-[30px] leading-[0.95] tracking-[0.02em] md:text-[34px]" style={{ fontFamily: SERIF, color: ATLAS_INK, fontWeight: 700 }}>
        The Network<br />Atlas
      </h1>
      <p className="mt-3 max-w-[30ch] text-[12px] leading-[1.45]" style={{ color: ATLAS_INK_DIM, fontFamily: SANS }}>
        How the models of mini_networks build on one another and
        combine into pipelines. Pick any model to read its lineage.
      </p>
      {counts && (
        <p className="mt-3 text-[11px] tabular-nums" style={{ color: ATLAS_INK, fontFamily: SANS }}>
          {counts.models} models, {counts.links} builds-on links, {counts.pipelines} pipelines
        </p>
      )}
    </div>
  );
}

export function AtlasLegend() {
  return (
    <div className="select-none text-[11.5px]" style={{ color: ATLAS_INK, fontFamily: SANS }}>
      <h2 className="mb-2 text-[15px] font-bold" style={{ fontFamily: SERIF }}>Key</h2>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-1">
        {NETWORK_LEGEND.map(({ mark, label }) => (
          <li key={mark} className="flex items-center gap-2 leading-tight">
            <Swatch mark={mark} />
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
