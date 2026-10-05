"use client";

// Phone only: the generation ruler, sticky under the top bar. The phone sheet is a file tree
// indented by generation (DFD_INDENT per step); one digit per step sits exactly over the left
// edge its boxes start at, so the indent reads as a column header.
import type { DfdLayout } from "@/lib/world/dfd";
import { COLOR, TYPE } from "./tokens";
import s from "./flow.module.css";

export const RULER_H = 18;

export function GenerationRuler({ layout }: { layout: DfdLayout }) {
  const hs = layout.headers;
  if (!hs.length) return null;
  const end = hs[hs.length - 1].x + hs[hs.length - 1].w;
  return (
    <svg width={layout.width} height={RULER_H} viewBox={`0 0 ${layout.width} ${RULER_H}`} className="mx-auto block" role="img"
      aria-label={`indent shows the generation: ${hs.map((h) => h.text).join(", ")}`}>
      {/* each digit starts at the left edge its generation's boxes start at, like the desktop's column headers */}
      {hs.map((h) => <text key={h.depth} x={h.x} y={13} className={s.head} fontSize={TYPE.head} fill={COLOR.head}>{h.text}</text>)}
      <text x={end + 4} y={13} className={s.head} fontSize={TYPE.head} fill={COLOR.head}>generation</text>
    </svg>
  );
}
