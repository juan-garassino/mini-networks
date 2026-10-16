"use client";

// Pipelines (taxonomy compositions): the list behind the top bar's toggle, and the caption
// plate that explains the one being shown (its members are numbered on the sheet).
import type { TaxonComposition } from "@/lib/types";
import { COMPOSITION_LESSONS } from "@/lib/lessons";
import { displayName } from "@/components/lab/shared/card-model";
import { COLOR, RADIUS, SHADOW, TYPE } from "./tokens";
import s from "./flow.module.css";

export function PipelinesPanel({ comps, shown, top, onToggle }: { comps: TaxonComposition[]; shown: string | null; top: number; onToggle: (name: string) => void }) {
  return (
    <div className="absolute right-3 z-50 max-h-[70%] w-[min(420px,calc(100%-24px))] overflow-y-auto border p-2"
      style={{ top, borderColor: COLOR.ink, borderRadius: RADIUS.panel, background: COLOR.card, boxShadow: SHADOW.panel }}>
      <p className="px-2 pb-1 pt-1 font-bold" style={{ color: COLOR.inkSoft, fontSize: TYPE.ui }}>Pipelines chain models; show one to number its members on the sheet.</p>
      <ul>
        {comps.map((c) => (
          <li key={c.name}>
            <button type="button" onClick={() => onToggle(c.name)} aria-pressed={shown === c.name}
              className={`${s.btn} ${s.row} w-full px-2 py-1.5 text-left leading-snug`} style={{ borderRadius: RADIUS.ui - 1, fontSize: TYPE.ui + 1 }}>
              <b>{displayName(c.name)}</b> <span style={{ color: COLOR.inkSoft }}>{c.composes.map(displayName).join(", ")}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PipelineCaption({ comp, onClear }: { comp: TaxonComposition; onClear: () => void }) {
  return (
    <div className="absolute bottom-3 left-3 z-30 flex max-w-[min(560px,calc(100%-24px))] items-start gap-3 border px-3 py-2"
      style={{ borderColor: COLOR.accent, borderRadius: RADIUS.panel, background: COLOR.card }}>
      <p className="leading-snug" style={{ fontSize: TYPE.ui + 1 }}><b>{displayName(comp.name)}</b>: {COMPOSITION_LESSONS[comp.name] ?? comp.description}</p>
      <button type="button" onClick={onClear} className={`${s.btn} shrink-0 font-bold underline`} style={{ fontSize: TYPE.ui }}>Clear</button>
    </div>
  );
}
