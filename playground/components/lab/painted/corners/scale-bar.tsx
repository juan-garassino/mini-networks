"use client";

// Bottom-left, under the compass: the scale bar measures the zoo. One tick per
// model in land order, filled by its evidence (gold champion, green trained,
// dashed hollow when the bar is still provisional, grey untrained); a wider
// gap separates the lands. Hover names the model, click focuses it. A second,
// thinner row of ticks is the pipelines — what the painted "28 pipelines"
// scale bar promised.
import { useState } from "react";
import { displayName, type EvidenceState } from "@/components/lab/shared/card-model";
import { FAMILIES, type Family } from "../anchors";
import { FAMILY_TITLE, type Material } from "../material";
import { plateStyle } from "./plate";

const TICK = 6, GAP = 2, LAND_GAP = 10, H = 14, PIPE_H = 7;

export function ScaleBar({ m, names, family, states, atoms, pipelines, counts, selected, onPick, onLand, focusFam }: {
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
}) {
  const [hover, setHover] = useState<string | null>(null);
  const groups = FAMILIES.map((f) => ({
    f,
    models: names.filter((n) => family?.[n] === f).sort((a, b) => Number(atoms.has(b)) - Number(atoms.has(a)) || a.localeCompare(b)),
  })).filter((g) => g.models.length);
  const style = (s: EvidenceState, on: boolean): React.CSSProperties => {
    const e = m.evidence[s];
    return {
      width: TICK, height: H, flex: "none", boxSizing: "border-box",
      background: s === "provisional" ? `repeating-linear-gradient(to bottom, ${e.fill} 0 2px, ${e.stroke} 2px 3px)` : e.fill,
      border: `1px ${s === "provisional" ? "dashed" : "solid"} ${e.stroke}`,
      boxShadow: on ? `0 -3px 0 ${m.ring}` : undefined,
      transform: on ? "translateY(-2px)" : undefined,
    };
  };
  return (
    <div className="p-3" style={{ ...plateStyle(m), fontFamily: m.bodyFont, color: m.ink }} role="group" aria-label="Scale: every model, by evidence">
      <div className="relative flex items-end" style={{ gap: LAND_GAP, height: H + 2 }}>
        {groups.map(({ f, models }) => (
          <div key={f} className="flex items-end" style={{ gap: GAP, opacity: focusFam && focusFam !== f ? 0.45 : 1 }} role="group" aria-label={FAMILY_TITLE[f]}
            onDoubleClick={() => onLand(f)}>
            {models.map((n) => {
              const on = n === selected || n === hover;
              return (
                <button key={n} type="button" aria-label={`${displayName(n)}, ${states[n] ?? "untrained"}`} title={displayName(n)}
                  onClick={() => onPick(n)} onPointerEnter={() => setHover(n)} onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(n)} onBlur={() => setHover(null)}
                  className="block p-0 focus-visible:outline-2" style={style(states[n] ?? "untrained", on)} />
              );
            })}
          </div>
        ))}
        {hover && (
          <span className="pointer-events-none absolute -top-9 left-0 whitespace-nowrap px-2 py-0.5" style={{ ...plateStyle(m, { loud: true, shadow: false }), fontSize: 14 }}>
            {displayName(hover)}, {family?.[hover] ? FAMILY_TITLE[family[hover]] : ""}
          </span>
        )}
      </div>
      {/* the baseline with end caps, like a drawn scale */}
      <div className="mt-1" style={{ height: 0, borderTop: `var(--ap, 2px) solid ${m.border}` }} />
      <div className="mt-1.5 flex items-end gap-0.5" aria-label={`${counts.pipelines} pipelines`} role="img">
        {pipelines.map((p) => (
          <span key={p} title={displayName(p)} style={{ width: TICK, height: PIPE_H, flex: "none", boxSizing: "border-box", background: m.plate, border: `1px solid ${m.border}` }} />
        ))}
      </div>
      <p className="mt-1.5 flex justify-between gap-4 leading-none" style={{ fontSize: 14, color: m.inkSoft }}>
        <span>{counts.models} models, {counts.champions} proven</span>
        <span>{counts.pipelines} pipelines</span>
      </p>
    </div>
  );
}
