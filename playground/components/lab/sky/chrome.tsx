"use client";

// The Night Map's own furniture (the four corners themselves are the painted
// maps' shared components, fed SKY_MATERIAL):
//
//   NightTabs   Day | Night | sky only, hung from the top edge like the day
//               map's Pixel | Paper tabs
//   ShowUi      the one button left when the UI is hidden
//   Chevron     a star off screen: a named plate on the edge with a pixel
//               arrowhead toward it — aqua for a pipeline partner, the dashed
//               lineage ink for the far end of a line that leaves the screen
import type { CSSProperties } from "react";
import { displayName } from "@/components/lab/shared/card-model";
import { plateStyle } from "@/components/lab/painted/corners/plate";
import { GRID, INK, SKY_MATERIAL as m, SPACE, TYPE } from "./tokens";

export function NightTabs({ compact, onHideUi, dayHref }: { compact: boolean; onHideUi: () => void; dayHref: string }) {
  const k = compact ? 1 : 0;
  // one box for all three: the same height and padding; the active tab differs by fill only
  const box = (on: boolean): CSSProperties => ({
    ...plateStyle(m, { loud: on, shadow: true }), borderTop: "none",
    height: SPACE.tab.h[k], padding: `0 ${SPACE.tab.x[k]}px`, display: "inline-flex", alignItems: "center",
    fontFamily: m.signFont, fontWeight: 700, fontSize: TYPE.tab[k], textDecoration: "none", lineHeight: 1,
  });
  const cls = "focus-visible:outline-2 focus-visible:outline-offset-2";
  return (
    <nav aria-label="Day and night sheets" className="flex flex-col items-end">
      <div role="tablist" className={`flex items-start ${compact ? "gap-1" : "gap-1.5"}`}>
        <a role="tab" aria-selected={false} href={dayHref} className={cls} style={box(false)}>Day</a>
        <span role="tab" aria-selected className={cls} style={box(true)}>Night</span>
        <button type="button" onClick={onHideUi} aria-label="Sky only: hide the UI (h)" title="Sky only (h)" className={cls}
          style={{ ...box(false), fontFamily: m.bodyFont, fontWeight: 500, fontSize: TYPE.button[k] }}>
          sky only
        </button>
      </div>
    </nav>
  );
}

export function ShowUi({ onShow }: { onShow: () => void }) {
  return (
    <button type="button" onClick={onShow} aria-label="Show the UI (h)" title="Show the UI (h)"
      className="absolute right-3 top-3 z-20 px-2.5 py-1 leading-none opacity-50 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 sm:right-5 sm:top-5"
      style={{ ...plateStyle(m, { shadow: false }), fontFamily: m.bodyFont, fontSize: TYPE.button[0] }}>UI</button>
  );
}

export type ChevronDir = "l" | "r" | "u" | "d";

// a 3×5 pixel arrowhead per direction, in art px (lands on the art grid)
const HEAD: Record<ChevronDir, [number, number][]> = {
  r: [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4], [0, 1], [0, 2], [0, 3], [1, 2]],
  l: [[2, 0], [1, 1], [0, 2], [1, 3], [2, 4], [2, 1], [2, 2], [2, 3], [1, 2]],
  d: [[0, 0], [1, 1], [2, 2], [3, 1], [4, 0], [1, 0], [2, 0], [3, 0], [2, 1]],
  u: [[0, 2], [1, 1], [2, 0], [3, 1], [4, 2], [1, 2], [2, 2], [3, 2], [2, 1]],
};

/** The chevron's plate size in CSS px, before it is drawn (layout.ts places it with this). */
export const chevronSize = (name: string, compact: boolean) => ({ w: Math.ceil(displayName(name).length * TYPE.chevron[compact ? 1 : 0] * TYPE.em + 34), h: 26 });

export function Chevron({ x, y, dir, name, kind, compact, onPick }: { x: number; y: number; dir: ChevronDir; name: string; kind: "pipe" | "line"; compact: boolean; onPick: () => void }) {
  const ap = GRID.ap, side = dir === "l" || dir === "r";
  const ink = kind === "pipe" ? INK.pipe : INK.cross;
  const svg = (
    <svg width={(side ? 3 : 5) * ap} height={(side ? 5 : 3) * ap} shapeRendering="crispEdges" aria-hidden className="flex-none">
      {HEAD[dir].map(([a, b], i) => <rect key={i} x={a * ap} y={b * ap} width={ap} height={ap} fill={ink} />)}
    </svg>
  );
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onPick(); }} title={`${displayName(name)}: ${kind === "pipe" ? "a pipeline partner" : "the far end of this line"}, off screen`}
      className="pointer-events-auto absolute z-10 flex items-center gap-1.5 px-2 py-1 leading-none focus-visible:outline-2"
      style={{ ...plateStyle(m), border: `var(--ap) ${kind === "pipe" ? "solid" : "dashed"} ${ink}`, left: x, top: y, transform: "translate(-50%, -50%)", fontFamily: m.tagFont, fontSize: TYPE.chevron[compact ? 1 : 0], whiteSpace: "nowrap", color: m.ink }}>
      {(dir === "l" || dir === "u") && svg}
      {displayName(name)}
      {(dir === "r" || dir === "d") && svg}
    </button>
  );
}
