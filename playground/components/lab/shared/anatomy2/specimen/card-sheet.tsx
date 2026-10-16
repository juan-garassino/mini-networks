"use client";

// The review sheet (?variant=card): every card, shelved like the index, each
// under its name in the pixel face. Cards in a shelf share one art box (the
// tallest card's height), so every footer in a row sits on one baseline.
// A card opens its full plate in place (a real href for new tabs).
import { MechanismDiagram } from "../mechanism";
import { PixelLabel, displayName } from "../prims";
import { diagramFor } from "../registry";
import { BORDER, PIXEL, SPACE, type Theme, type ThemeName } from "../tokens";
import type { Group } from "./groups";

/** Columns of `cardWidth` that fit in `avail` (≥ 1). */
export function sheetCols(avail: number, cardWidth: number): number {
  return Math.max(1, Math.floor((avail + SPACE.l) / (cardWidth + SPACE.l)));
}

/** Width of a sheet holding as many card columns as fit in `avail`. */
export function sheetWidth(avail: number, cardWidth: number): number {
  const cols = sheetCols(avail, cardWidth);
  return cols * cardWidth + (cols - 1) * SPACE.l;
}

/** The shelf's shared art height in art px: its tallest card. */
const shelfArtH = (models: string[]) => Math.max(0, ...models.map((m) => diagramFor(m)?.card.view.h ?? 0));

export function CardSheet({ groups, theme, th, still, cardWidth, cols, hrefFor, onPick }: {
  groups: Group[]; theme: ThemeName; th: Theme; still: boolean;
  /** CSS px: a whole number of device px per art px (legible.ts fitZoom) */
  cardWidth: number;
  /** columns per row; one column needs no shared art box */
  cols: number;
  hrefFor: (m: string) => string; onPick: (m: string) => void;
}) {
  return (
    <div>
      {groups.map((g) => {
        const artH = cols > 1 ? shelfArtH(g.models) : undefined;
        return (
          <section key={g.label} aria-label={g.label} style={{ marginTop: SPACE.xl }}>
            <h2 style={{ display: "flex", alignItems: "flex-start", gap: SPACE.m, margin: `0 0 ${SPACE.m}px`, paddingBottom: SPACE.s, borderBottom: `${BORDER.hair}px solid ${th.frame}`, color: th.textDim }}>
              <PixelLabel text={g.label} s={PIXEL.head} />
              <PixelLabel text={String(g.models.length)} s={PIXEL.head} label={`${g.models.length} models`} style={{ marginLeft: "auto" }} />
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${cardWidth}px)`, gap: `${SPACE.xl}px ${SPACE.l}px`, justifyContent: "start" }}>
              {g.models.map((m) => (
                <div key={m}>
                  <h3 style={{ margin: `0 0 ${SPACE.s}px`, color: th.text }}><PixelLabel text={displayName(m)} s={PIXEL.card} /></h3>
                  <MechanismDiagram name={m} theme={theme} variant="card" still={still} width={cardWidth} artH={artH}
                    href={hrefFor(m)} onOpen={() => { onPick(m); return true; }} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
