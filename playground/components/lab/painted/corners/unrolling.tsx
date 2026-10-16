"use client";

// The load moment, drawn by the map itself (the library's loading convention,
// lib/lab-contract.ts labLoading / loadPhase). While the view is veiled (data,
// the map, its painting and the framing still coming in) the title cartouche
// already stands in its corner on the map's ground (the parchment sea; on
// paper a low-res copy of the painting, where the painting will lie), and
// where its sentence will be it says what is happening ("Unrolling the
// map…") over a pixel bar built like the scale bar: one framed segment per
// step, the done ones gold. Honest steps, never a timer, never a spinner. It
// is server-rendered, so it is the first paint; the reveal then cuts to the
// real cartouche in the same place, with the same title at the same size
// (phone: the top bar's row; focus mode: the quiet one-row title), so the
// title holds still across the cut.
import type { CSSProperties } from "react";
import { labLoading, type LoadPhase } from "@/lib/lab-contract";
import { CORNER, PHONE, TYPE, type Material } from "../material";
import { plateStyle } from "./plate";
import { SCALE_CELL } from "./scale-bar";

/** The steps in the order they usually land; the status names the first not done. */
export const LOAD_STEPS = ["Reading the zoo", "Unrolling the map", "Painting the lands", "Framing the view"] as const;
const CELLS = 4;   // per step: a segment of the bar, as a land's segment on the scale bar
/** offline: the API refused (useLabData retries); say how to start it */
const OFFLINE = "The zoo's API is not answering. Start it with python main.py serve";
const GROUND_BLUR = 6;   // px: the low-res painting is a ground, not a picture

function Bar({ m, done }: { m: Material; done: boolean[] }) {
  const cell = (on: boolean): CSSProperties => ({
    width: SCALE_CELL.w, height: SCALE_CELL.h, flex: "none", background: on ? m.evidence.champion.fill : m.plateHi,
  });
  return (
    <div className="flex flex-none items-end" style={{ gap: SCALE_CELL.landGap }} role="progressbar" aria-label="Loading the map"
      aria-valuemin={0} aria-valuemax={done.length} aria-valuenow={done.filter(Boolean).length}>
      {done.map((d, s) => (
        <div key={s} className="flex" style={{ gap: "var(--ap, 2px)", padding: "var(--ap, 2px)", background: m.border }}>
          {Array.from({ length: CELLS }, (_, i) => <span key={i} style={cell(d)} />)}
        </div>
      ))}
    </div>
  );
}

export function Unrolling({ m, done, phase, quiet, ground, title = "The Model Zoo" }: {
  m: Material;
  /** one flag per LOAD_STEPS entry */
  done: boolean[];
  /** loadPhase(): api / layout name the step under way; offline says how to start the API */
  phase: LoadPhase;
  /** focus mode (a deep link into a land or a model): the cartouche's one-row title */
  quiet: boolean;
  /** the map's ground behind the plate (paper: a low-res copy of the painting, cover, from the top) */
  ground?: string;
  title?: string;
}) {
  const current = Math.max(0, done.findIndex((d) => !d));
  const status = phase === "offline" ? OFFLINE : `${LOAD_STEPS[current] ?? LOAD_STEPS[LOAD_STEPS.length - 1]}…`;
  const ink = m.crisp ? m.border : m.ink;
  const h1 = (size: number): CSSProperties => ({ fontFamily: m.signFont, fontWeight: 700, fontSize: size, color: ink });
  // one status element: the phone and desktop plates show the same line
  const line = (
    <p className="leading-snug" style={{ fontSize: TYPE.lead, color: m.ink }}>{status}</p>
  );
  return (
    <div data-painted-loading {...labLoading(phase)} className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {ground && (
        <div aria-hidden className="absolute" style={{ inset: -2 * GROUND_BLUR, background: `url(${ground}) center top / cover no-repeat`, filter: `blur(${GROUND_BLUR}px)` }} />
      )}
      {/* phones: the top bar's row, then the status under the title */}
      <div className="absolute left-3 right-3 top-3 sm:hidden" style={{ ...plateStyle(m), fontFamily: m.bodyFont, padding: `${CORNER.padQuiet}px ${CORNER.padQuiet + 2}px ${CORNER.pad}px` }}>
        <div className="flex items-center" style={{ height: `calc(${PHONE.bar - 2 * CORNER.padQuiet}px - 2 * var(--ap, 1px))` }}>
          <p className="whitespace-nowrap leading-none" style={h1(TYPE.displayTiny)}>{title}</p>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">{line}<Bar m={m} done={done} /></div>
      </div>
      {/* from sm up: the cartouche, in its corner (paper's overview hangs it from the top edge) */}
      <div className={`absolute left-5 hidden sm:block ${m.crisp || quiet ? "top-5" : "top-0"}`}
        style={{ ...plateStyle(m), fontFamily: m.bodyFont, width: quiet ? "max-content" : CORNER.w, maxWidth: CORNER.w,
          padding: quiet ? `${CORNER.padQuiet}px ${CORNER.padQuiet + 2}px ${CORNER.pad}px` : CORNER.pad }}>
        <p className="leading-none" style={h1(quiet ? TYPE.displaySmall : TYPE.display)}>{title}</p>
        <div className="mt-2">{line}</div>
        <div className="mt-3"><Bar m={m} done={done} /></div>
      </div>
    </div>
  );
}
