"use client";

// Small chrome controls shared by every specimen layout: a segmented switch
// (theme, one-drawing vs every-card), prev/next steps, the compact model
// picker for narrow screens, and the shelved index for wide ones.
import type { MouseEvent } from "react";
import { PixelLabel, displayName } from "../prims";
import { PIXEL, SPACE } from "../tokens";
import type { Group } from "./groups";

/** A two-or-more option switch; the pressed option is the current value. */
export function Segmented<V extends string>({ label, options, value, onChange }: {
  label: string; options: readonly { value: V; text: string }[]; value: V; onChange: (v: V) => void;
}) {
  return (
    <div className="anx-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          <PixelLabel text={o.text} s={PIXEL.head} />
        </button>
      ))}
    </div>
  );
}

/** A same-page link that updates the view in place (still a real href for new tabs). */
function ViewLink({ href, onGo, className, current, disabled, children, label }: {
  href: string; onGo: () => void; className: string; current?: boolean; disabled?: boolean; children: React.ReactNode; label?: string;
}) {
  const click = (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (!disabled) onGo();
  };
  return (
    <a href={href} onClick={click} className={className} aria-current={current ? "page" : undefined}
      aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined} aria-label={label}>
      {children}
    </a>
  );
}

/** The wide-screen index: shelf heads in the pixel face, entries in prose. */
export function ModelIndex({ groups, current, hrefFor, onPick }: {
  groups: Group[]; current: string; hrefFor: (m: string) => string; onPick: (m: string) => void;
}) {
  return (
    <nav aria-label="models">
      {groups.map((g) => (
        <section key={g.label} style={{ marginTop: SPACE.l }}>
          <h2 style={{ margin: `0 0 ${SPACE.s}px` }}><PixelLabel text={g.label} s={PIXEL.head} /></h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {g.models.map((m) => (
              <li key={m}>
                <ViewLink href={hrefFor(m)} onGo={() => onPick(m)} className="anx-entry" current={m === current}>
                  {displayName(m)}
                </ViewLink>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}

/** Previous / next in reading order; hidden (not removed) at either end so nothing shifts. */
export function Steps({ order, current, hrefFor, onPick }: {
  order: string[]; current: string; hrefFor: (m: string) => string; onPick: (m: string) => void;
}) {
  const i = order.indexOf(current);
  const prev = i > 0 ? order[i - 1] : null;
  const next = i >= 0 && i < order.length - 1 ? order[i + 1] : null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: SPACE.l, alignItems: "center" }}>
      <ViewLink href={prev ? hrefFor(prev) : "#"} onGo={() => prev && onPick(prev)} className="anx-step" disabled={!prev}
        label={prev ? `Previous: ${displayName(prev)}` : undefined}>
        <PixelLabel text="←" s={PIXEL.head} label="" /> {prev ? displayName(prev) : ""}
      </ViewLink>
      <ViewLink href={next ? hrefFor(next) : "#"} onGo={() => next && onPick(next)} className="anx-step" disabled={!next}
        label={next ? `Next: ${displayName(next)}` : undefined}>
        {next ? displayName(next) : ""} <PixelLabel text="→" s={PIXEL.head} label="" />
      </ViewLink>
    </div>
  );
}

/** The narrow-screen picker: one native select, grouped like the index. */
export function ModelPicker({ groups, current, onPick }: { groups: Group[]; current: string; onPick: (m: string) => void }) {
  return (
    <label style={{ display: "block", position: "relative" }}>
      <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Model</span>
      <select className="anx-select" value={current} onChange={(e) => onPick(e.target.value)}>
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.models.map((m) => <option key={m} value={m}>{displayName(m)}</option>)}
          </optgroup>
        ))}
      </select>
      <PixelLabel text="↓" s={PIXEL.head} label="" style={{ position: "absolute", right: SPACE.m, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
    </label>
  );
}
