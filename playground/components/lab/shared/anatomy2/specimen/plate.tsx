"use client";

// One model's plate: its name in the diagram's own pixel face, the one-line
// "what it does", the drawing, then what is real. The drawing obeys the
// legibility floor (legible.ts): the full drawing at a crisp zoom whose labels
// are ≥ 10 px when one fits; otherwise the card, whose "Open full diagram"
// opens the full drawing in place (?full=1) in a sideways scroller.
import type { ReactNode } from "react";
import { MechanismDiagram, sentence } from "../mechanism";
import { PixelLabel, displayName } from "../prims";
import { diagramFor } from "../registry";
import { BORDER, PIXEL, SPACE, TYPE, type Theme, type ThemeName } from "../tokens";

/** "diffusion — noise a digit, …" → the part after the dash, capitalised. */
export function ledeOf(title: string): string {
  const i = title.indexOf(" — ");
  const s = i < 0 ? "" : title.slice(i + 3);
  return s ? s[0].toUpperCase() + s.slice(1) : "";
}

/** How the plate shows its drawing (specimen.tsx picks it from the room it has). */
export type PlateFit =
  | { kind: "full"; width: number }                               // the drawing fits at a legible zoom
  | { kind: "card"; cardWidth: number; fullWidth: number };      // only the card fits; full scrolls

export function Plate({ model, theme, th, t, onT, still, fit, full, onFull }: {
  model: string; theme: ThemeName; th: Theme; t: number; onT: (t: number) => void; still: boolean;
  fit: PlateFit;
  /** card fit only: the full drawing is open (sideways scroller) */
  full: boolean;
  onFull: (open: boolean) => void;
}) {
  const def = diagramFor(model);
  const stacked = fit.kind === "card";
  const drawing = (width: number, exact: boolean) => (
    <MechanismDiagram key={`${model}-${theme}`} name={model} theme={theme} t={t} onTChange={onT}
      still={still} width={width} fit={!exact} caption={false} />
  );

  let body: ReactNode;
  if (fit.kind === "full") body = drawing(fit.width, false);
  else if (!full) {
    // the card, its footer without the badge ("what is real" below says it)
    body = (
      <>
        <MechanismDiagram key={`${model}-${theme}-card`} name={model} theme={theme} variant="card" still={still} width={fit.cardWidth}
          caption={false} onOpen={() => { onFull(true); return true; }} />
        <p style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: SPACE.s, margin: `${SPACE.s}px 0 0`, maxWidth: fit.cardWidth, fontSize: TYPE.small.size, lineHeight: TYPE.small.line, color: th.text }}>
          <span>{def?.card.caption ? sentence(def.card.caption) : ""}</span>
          <button type="button" className="anx-back" style={{ color: th.wireHot }} onClick={() => onFull(true)}>Open full diagram</button>
        </p>
      </>
    );
  } else {
    body = (
      <>
        <div className="anx-scroll" style={{ margin: `0 -${SPACE.gutter}px`, padding: `0 ${SPACE.gutter}px` }}>{drawing(fit.fullWidth, true)}</div>
        <p style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: SPACE.s, margin: `${SPACE.s}px 0 0`, fontSize: TYPE.small.size, lineHeight: TYPE.small.line, color: th.textDim }}>
          <span>Wider than the screen: swipe it sideways.</span>
          <button type="button" className="anx-back" style={{ color: th.wireHot }} onClick={() => onFull(false)}>Show the card</button>
        </p>
      </>
    );
  }

  return (
    <article aria-labelledby="plate-name">
      <header style={{ marginBottom: SPACE.l }}>
        <h1 id="plate-name" style={{ margin: 0, color: th.text }}>
          <PixelLabel text={displayName(model)} s={PIXEL.name} />
        </h1>
        {def && (
          <p style={{ margin: `${SPACE.s + 2}px 0 0`, fontSize: TYPE.lede.size, lineHeight: TYPE.lede.line, color: th.text, maxWidth: TYPE.measure }}>
            {ledeOf(def.title)}
          </p>
        )}
      </header>
      {body}
      {def && (
        <section aria-labelledby="plate-real" style={{
          display: "grid", gridTemplateColumns: stacked ? "1fr" : `${SPACE.index - SPACE.l}px minmax(0, 1fr)`,
          gap: stacked ? SPACE.s : SPACE.l, marginTop: SPACE.xl, paddingTop: SPACE.m, borderTop: `${BORDER.hair}px solid ${th.frame}`,
        }}>
          <div>
            <h2 id="plate-real" style={{ margin: 0, color: th.textDim }}><PixelLabel text="what is real" s={PIXEL.head} /></h2>
            <p style={{ margin: `${SPACE.s}px 0 0`, color: th.wireHot, fontSize: TYPE.hint.size, lineHeight: TYPE.hint.line }}>{def.badge}</p>
          </div>
          {/* the measure sits on the paragraph itself, in its own em */}
          <p style={{ margin: 0, maxWidth: TYPE.measure, fontSize: TYPE.body.size, lineHeight: TYPE.body.line, color: th.text }}>{def.truth}</p>
        </section>
      )}
    </article>
  );
}
