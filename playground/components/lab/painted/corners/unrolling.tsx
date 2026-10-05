"use client";

// The load moment, drawn by the map itself: while the view is veiled (data,
// the map, its painting and the framing still coming in) the title cartouche
// is already in its corner on the bare sea, and where its sentence will be it
// says what is happening ("Unrolling the map…") over a pixel progress bar
// built like the scale bar: one framed segment per step, the done ones gold.
// It is server-rendered, so it is the first paint; the reveal then cuts to
// the real cartouche in the same place, with the same title at the same size
// (phone: the top bar's row; focus mode: the quiet one-row title), so the
// title holds still across the cut. Honest steps, never a timer: each segment
// fills when its work is in. Under still / reduced motion the current
// segment does not blink.
import type { CSSProperties } from "react";
import { CORNER, MOTION, PHONE, TYPE, type Material } from "../material";
import { plateStyle } from "./plate";
import { SCALE_CELL } from "./scale-bar";

/** The steps in the order they usually land; the status names the first not done. */
export const LOAD_STEPS = ["Reading the zoo", "Unrolling the map", "Painting the lands", "Framing the view"] as const;
const CELLS = 4;   // per step: a segment of the bar, as a land's segment on the scale bar

export const UNROLL_KEYFRAMES = `@keyframes painted-unroll { from { opacity: 1; } to { opacity: .25; } }`;

function Bar({ m, done, still }: { m: Material; done: boolean[]; still: boolean }) {
  const current = done.findIndex((d) => !d);
  const cell = (on: boolean, blink: boolean, i: number): CSSProperties => ({
    width: SCALE_CELL.w, height: SCALE_CELL.h, flex: "none",
    background: on ? m.evidence.champion.fill : m.plateHi,
    // the current step's cells blink in turn, stepped (interface motion is never eased)
    animation: blink && !still ? `painted-unroll ${MOTION.unroll.ms}ms steps(1, end) ${i * (MOTION.unroll.ms / CELLS)}ms infinite alternate` : undefined,
  });
  return (
    <div className="flex items-end" style={{ gap: SCALE_CELL.landGap }} role="progressbar" aria-label="Loading the map"
      aria-valuemin={0} aria-valuemax={done.length} aria-valuenow={done.filter(Boolean).length}>
      {done.map((d, s) => (
        <div key={s} className="flex" style={{ gap: "var(--ap, 2px)", padding: "var(--ap, 2px)", background: m.border }}>
          {Array.from({ length: CELLS }, (_, i) => <span key={i} style={cell(d, s === current, i)} />)}
        </div>
      ))}
    </div>
  );
}

export function Unrolling({ m, done, quiet, still, title = "The Model Zoo" }: {
  m: Material;
  /** one flag per LOAD_STEPS entry */
  done: boolean[];
  /** focus mode (a deep link into a land or a model): the cartouche's one-row title */
  quiet: boolean;
  still: boolean;
  title?: string;
}) {
  const current = Math.max(0, done.findIndex((d) => !d));
  const status = `${LOAD_STEPS[current] ?? LOAD_STEPS[LOAD_STEPS.length - 1]}…`;
  const ink = m.crisp ? m.border : m.ink;
  const h1 = (size: number): CSSProperties => ({ fontFamily: m.signFont, fontWeight: 700, fontSize: size, color: ink });
  const line = (
    <p role="status" aria-live="polite" className="leading-snug" style={{ fontSize: TYPE.lead, color: m.ink }}>{status}</p>
  );
  return (
    <div data-painted-loading className="pointer-events-none absolute inset-0 z-20">
      {/* phones: the top bar's row, then the status under the title */}
      <div className="absolute left-3 right-3 top-3 sm:hidden" style={{ ...plateStyle(m), fontFamily: m.bodyFont, padding: `${CORNER.padQuiet}px ${CORNER.padQuiet + 2}px ${CORNER.pad}px` }}>
        <div className="flex items-center" style={{ height: `calc(${PHONE.bar - 2 * CORNER.padQuiet}px - 2 * var(--ap, 1px))` }}>
          <p className="whitespace-nowrap leading-none" style={h1(TYPE.displayTiny)}>{title}</p>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">{line}<Bar m={m} done={done} still={still} /></div>
      </div>
      {/* from sm up: the cartouche, in its corner (paper's overview hangs it from the top edge) */}
      <div className={`absolute left-5 hidden sm:block ${m.crisp || quiet ? "top-5" : "top-0"}`}
        style={{ ...plateStyle(m), fontFamily: m.bodyFont, width: quiet ? "max-content" : CORNER.w,
          padding: quiet ? `${CORNER.padQuiet}px ${CORNER.padQuiet + 2}px ${CORNER.pad}px` : CORNER.pad }}>
        <p className="leading-none" style={h1(quiet ? TYPE.displaySmall : TYPE.display)}>{title}</p>
        <div className="mt-2">{line}</div>
        <div className="mt-3"><Bar m={m} done={done} still={still} /></div>
      </div>
    </div>
  );
}
