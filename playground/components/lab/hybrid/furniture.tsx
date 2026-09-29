"use client";

// Map-sheet furniture for the overview: the corners of the screen carry
// purposeful pieces instead of dead sea. A paper compass rose (orientation of
// the board), the map key (what the marks mean), and a glimpse of the
// uncharted "?" island with its dragon, which opens the hidden island.
import { memo } from "react";
import { FogIsland, LevelSpot, PaperBoat, PaperDragon, AtomSpot, P, R } from "@/components/lab/paper/art";
import { NEXT_ERA_COPY } from "@/components/lab/shared/eggs";
import s from "./hybrid.module.css";

/** Paper compass rose: an 8-point star cut from card, gold N. */
export const CompassRose = memo(function CompassRose({ size = 120 }: { size?: number }) {
  const r = 44, q = 16;
  const pt = (a: number, len: number) => `${Math.cos(a) * len} ${Math.sin(a) * len}`;
  const star = (len: number, w: number, rot: number) => {
    let d = "";
    for (let k = 0; k < 4; k++) {
      const a = rot + (k * Math.PI) / 2 - Math.PI / 2;
      d += `M0 0L${pt(a - Math.PI / 4, w)}L${pt(a, len)}L${pt(a + Math.PI / 4, w)}Z`;
    }
    return d;
  };
  return (
    <svg width={size} height={size} viewBox="-60 -60 120 120" aria-hidden className="pointer-events-none">
      <circle cx={4} cy={6} r={r + 6} fill={P.shadow} opacity={0.18} />
      <circle r={r + 6} fill={P.die} />
      <circle r={r + 2} fill={R.cream[1]} stroke={R.wood[3]} strokeWidth={1.5} />
      <circle r={r - 8} fill="none" stroke={R.wood[3]} strokeWidth={0.8} strokeDasharray="2 3" />
      <path d={star(r - 10, q * 0.55, Math.PI / 4)} fill={R.sea[2]} stroke={P.die} strokeWidth={1.2} strokeLinejoin="round" />
      <path d={star(r, q * 0.7, 0)} fill={R.gold[1]} stroke={R.wood[4]} strokeWidth={1.2} strokeLinejoin="round" />
      {/* lit halves of the four main points */}
      {[0, 1, 2, 3].map((k) => {
        const a = (k * Math.PI) / 2 - Math.PI / 2;
        return <path key={k} d={`M0 0L${pt(a - Math.PI / 4, q * 0.7)}L${pt(a, r)}Z`} fill={R.gold[0]} />;
      })}
      <circle r={4} fill={R.wood[4]} />
      <text y={-r - 12} textAnchor="middle" fontSize={16} fontWeight={700} fill={R.red[3]} stroke={P.die} strokeWidth={4} paintOrder="stroke"
        style={{ fontFamily: "var(--font-hybrid-round), system-ui" }}>N</text>
    </svg>
  );
});

/** The map key, drawn in the map's own pieces (lives in the menu cartouche). */
export function MapKey() {
  const row = (glyph: React.ReactNode, text: string) => (
    <li className="flex items-center gap-2">
      <svg width={30} height={26} viewBox="-15 -16 30 26" aria-hidden className="flex-none">{glyph}</svg>
      <span>{text}</span>
    </li>
  );
  return (
    <ul className={`${s.t14} grid grid-cols-2 gap-x-2 gap-y-1 px-2 pb-1`}>
      {row(<AtomSpot name="" state="trained" r={11} castle={false} />, "atom")}
      {row(<LevelSpot name="" state="trained" r={9} />, "model")}
      {row(<LevelSpot name="" state="champion" r={9} />, "champion")}
      {row(<path d="M-13 5 Q0 -3 13 5" stroke={R.gold[1]} strokeWidth={5} fill="none" strokeLinecap="round" />, "builds on")}
      {row(<PaperBoat x={0} y={8} size={20} />, "pipeline")}
      {row(<LevelSpot name="" state="untrained" r={9} />, "untrained")}
    </ul>
  );
}

/** A glimpse of the uncharted island, cut by the frame edge: click to sail there. */
export function UnchartedGlimpse({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className={s.glimpse} aria-label={`${NEXT_ERA_COPY.warning}: sail to the uncharted island`}>
      <svg width={230} height={170} viewBox="0 0 230 170" aria-hidden>
        <FogIsland x={120} y={150} size={100} />
        <PaperDragon x={40} y={160} size={46} silhouette />
        <text x={116} y={22} textAnchor="middle" fontSize={15} fontStyle="italic" fontWeight={600} fill={P.die} stroke={R.sea[4]} strokeWidth={3} paintOrder="stroke"
          style={{ fontFamily: "var(--font-hybrid-round), system-ui" }}>{NEXT_ERA_COPY.warning}</text>
      </svg>
    </button>
  );
}
