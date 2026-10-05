"use client";

// The review sheet (?variant=card): every card, shelved like the index, each
// under its name in the pixel face. A card links to its full plate.
import { MechanismDiagram } from "../mechanism";
import { PixelLabel, displayName } from "../prims";
import { BORDER, PIXEL, SPACE, type Theme, type ThemeName } from "../tokens";
import type { Group } from "./groups";

/** Width of a sheet holding as many card columns as fit in `avail` (≥ 1). */
export function sheetWidth(avail: number, cardWidth: number): number {
  const cols = Math.max(1, Math.floor((avail + SPACE.l) / (cardWidth + SPACE.l)));
  return cols * cardWidth + (cols - 1) * SPACE.l;
}

export function CardSheet({ groups, theme, th, still, cardWidth }: {
  groups: Group[]; theme: ThemeName; th: Theme; still: boolean; cardWidth: number;
}) {
  return (
    <div>
      {groups.map((g) => (
        <section key={g.label} aria-label={g.label} style={{ marginTop: SPACE.xl }}>
          <h2 style={{ display: "flex", alignItems: "flex-start", gap: SPACE.m, margin: `0 0 ${SPACE.m}px`, paddingBottom: SPACE.s, borderBottom: `${BORDER.hair}px solid ${th.frame}`, color: th.textDim }}>
            <PixelLabel text={g.label} s={PIXEL.head} />
            <PixelLabel text={String(g.models.length)} s={PIXEL.head} label={`${g.models.length} models`} style={{ marginLeft: "auto" }} />
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, ${cardWidth}px)`, gap: `${SPACE.xl}px ${SPACE.l}px`, justifyContent: "start" }}>
            {g.models.map((m) => (
              <div key={m}>
                <h3 style={{ margin: `0 0 ${SPACE.s}px`, color: th.text }}><PixelLabel text={displayName(m)} s={PIXEL.card} /></h3>
                <MechanismDiagram name={m} theme={theme} variant="card" still={still} width={cardWidth} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
