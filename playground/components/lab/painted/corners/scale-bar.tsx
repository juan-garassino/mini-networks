"use client";

// Bottom-left, over the compass: the scale bar measures the zoo, drawn the way
// a map draws its scale — one inked bar, divided. Each land is a framed
// segment; each cell in it is one model in land order (atoms first), filled
// by its evidence (gold champion, green trained, hatched when the bar is still
// provisional, grey untrained). Under the baseline hang the minor graduations:
// one per pipeline. Hover names the model, click focuses it, double-click a
// segment opens that land. The counts are the plate's title, in the sign voice
// every corner plate shares. slim (focus mode): the cells alone, at 4 px, on
// half padding — still a key to the zoo (the selected model's cell rings),
// no longer a headline.
import { useState } from "react";
import { displayName, type EvidenceState } from "@/components/lab/shared/card-model";
import { FAMILIES, type Family } from "../anchors";
import { CORNER, FAMILY_TITLE, TYPE, type Material } from "../material";
import { plateStyle, plateTitle } from "./plate";

const CELL = 7, H = 12, LAND_GAP = 6, PIPE_H = 6, PIPE_STEP = 6;

export function ScaleBar({ m, names, family, states, atoms, pipelines, counts, selected, onPick, onLand, focusFam, slim = false }: {
  m: Material;
  names: string[];
  family: Record<string, string> | null;
  states: Record<string, EvidenceState>;
  atoms: Set<string>;
  pipelines: string[];
  counts: { models: number; pipelines: number; champions: number };
  selected: string | null;
  onPick: (n: string) => void;
  onLand: (f: Family) => void;
  focusFam: Family | null;
  /** focus mode: the cells only, small */
  slim?: boolean;
}) {
  const cw = slim ? 4 : CELL, ch = slim ? 6 : H;
  const [hover, setHover] = useState<string | null>(null);
  const groups = FAMILIES.map((f) => ({
    f,
    models: names.filter((n) => family?.[n] === f).sort((a, b) => Number(atoms.has(b)) - Number(atoms.has(a)) || a.localeCompare(b)),
  })).filter((g) => g.models.length);
  const cell = (s: EvidenceState, on: boolean): React.CSSProperties => {
    const e = m.evidence[s];
    return {
      width: cw, height: ch, flex: "none", padding: 0, border: 0,
      background: s === "provisional"
        ? `repeating-linear-gradient(135deg, ${e.stroke} 0 1px, ${m.plateHi} 1px 3px)`
        : e.fill,
      boxShadow: on ? `0 0 0 var(--ap, 2px) ${m.ring}` : undefined,
      position: on ? "relative" : undefined, zIndex: on ? 1 : undefined,
    };
  };
  return (
    <div style={{ ...plateStyle(m), padding: slim ? CORNER.padQuiet : CORNER.pad, fontFamily: m.bodyFont, color: m.ink }} role="group" aria-label="Scale: every model, by evidence">
      {!slim && (
        // tabular figures: the counts change as runs land; the line must not jitter
        <p className="mb-2.5 flex items-baseline justify-between gap-4" style={{ fontVariantNumeric: "tabular-nums" }}>
          <span style={plateTitle(m)}>{counts.models} models, {counts.champions} proven</span>
          <span style={{ fontSize: TYPE.note, lineHeight: 1, color: m.inkSoft }}>{counts.pipelines} pipelines</span>
        </p>
      )}
      <div className="relative flex items-end" style={{ gap: slim ? 4 : LAND_GAP }}>
        {groups.map(({ f, models }) => (
          // a land = one framed segment; the frame colour shows between cells as the divisions
          <div key={f} className="flex" role="group" aria-label={FAMILY_TITLE[f]} onDoubleClick={() => onLand(f)}
            style={{ gap: "var(--ap, 2px)", padding: "var(--ap, 2px)", background: m.border, opacity: focusFam && focusFam !== f ? 0.4 : 1 }}>
            {models.map((n) => {
              const on = n === selected || n === hover;
              return (
                <button key={n} type="button" aria-label={`${displayName(n)}, ${states[n] ?? "untrained"}`} title={displayName(n)}
                  onClick={() => onPick(n)} onPointerEnter={() => setHover(n)} onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(n)} onBlur={() => setHover(null)}
                  className="block focus-visible:outline-2" style={cell(states[n] ?? "untrained", on)} />
              );
            })}
          </div>
        ))}
        {hover && (
          <span className={`pointer-events-none absolute ${slim ? "-top-8" : "-top-9"} left-0 whitespace-nowrap px-2 py-0.5`} style={{ ...plateStyle(m, { loud: true, shadow: false }), fontSize: TYPE.link }}>
            {displayName(hover)}, {family?.[hover] ? FAMILY_TITLE[family[hover]] : ""}
          </span>
        )}
      </div>
      {/* the baseline, with the pipelines hanging under it as minor graduations */}
      {!slim && (
        <>
          <div className="mt-1" style={{ height: 0, borderTop: `var(--ap, 2px) solid ${m.border}` }} />
          <div className="flex items-start justify-between" aria-label={`${counts.pipelines} pipelines`} role="img" style={{ gap: PIPE_STEP - 2 }}>
            {pipelines.map((p) => (
              <span key={p} title={displayName(p)} style={{ width: 2, height: PIPE_H, flex: "none", background: m.border }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
