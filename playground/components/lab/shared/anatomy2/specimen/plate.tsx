"use client";

// One model's plate: its name in the diagram's own pixel face, the one-line
// "what it does", the drawing at an integer scale, then what is real.
import { MechanismDiagram } from "../mechanism";
import { PixelLabel, displayName } from "../prims";
import { diagramFor } from "../registry";
import { BORDER, PIXEL, SPACE, TYPE, type Theme, type ThemeName } from "../tokens";

/** "diffusion — noise a digit, …" → the part after the dash, capitalised. */
export function ledeOf(title: string): string {
  const i = title.indexOf(" — ");
  const s = i < 0 ? "" : title.slice(i + 3);
  return s ? s[0].toUpperCase() + s.slice(1) : "";
}

export function Plate({ model, theme, th, t, onT, still, width, narrow }: {
  model: string; theme: ThemeName; th: Theme; t: number; onT: (t: number) => void; still: boolean;
  /** drawing width in CSS px (an integer multiple of the art width) */
  width: number;
  /** below 1×: keep 1× and let the drawing scroll sideways on its own */
  narrow: boolean;
}) {
  const def = diagramFor(model);
  const drawing = (
    <MechanismDiagram key={`${model}-${theme}`} name={model} theme={theme} t={t} onTChange={onT}
      still={still} width={width} fit={!narrow} caption={false} />
  );
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
      {narrow ? (
        <>
          <div className="anx-scroll" style={{ margin: `0 -${SPACE.gutter}px`, padding: `0 ${SPACE.gutter}px` }}>{drawing}</div>
          <p style={{ margin: `${SPACE.s}px 0 0`, fontSize: TYPE.small.size, color: th.textDim }}>The drawing is wider than the screen: swipe it sideways.</p>
        </>
      ) : drawing}
      {def && (
        <section aria-labelledby="plate-real" style={{
          display: "grid", gridTemplateColumns: narrow ? "1fr" : `${SPACE.index - SPACE.l}px minmax(0, ${TYPE.measure})`,
          gap: narrow ? SPACE.s : SPACE.l, marginTop: SPACE.xl, paddingTop: SPACE.m, borderTop: `${BORDER.hair}px solid ${th.frame}`,
        }}>
          <div>
            <h2 id="plate-real" style={{ margin: 0, color: th.textDim }}><PixelLabel text="what is real" s={PIXEL.head} /></h2>
            <p style={{ margin: `${SPACE.s}px 0 0`, color: th.wireHot, fontSize: TYPE.hint.size, lineHeight: TYPE.hint.line }}>{def.badge}</p>
          </div>
          <p style={{ margin: 0, fontSize: TYPE.body.size, lineHeight: TYPE.body.line, color: th.text }}>{def.truth}</p>
        </section>
      )}
    </article>
  );
}
