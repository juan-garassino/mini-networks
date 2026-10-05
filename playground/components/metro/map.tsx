// The system map as one SVG, painted in reading order: quiet area names, the
// tracks (an auto-placed spur dashed), one train per line, the stations, then
// whatever furniture the page passes as children (the cartouche). It reads only
// a SystemLayout, so it draws any graph the engine laid out.
import type { ReactNode } from "react";
import { SPUR_DASH } from "./marks";
import { Station } from "./station";
import { Train } from "./train";
import { lineColor, type SystemLayout } from "./system";
import { GRID, INK_DIM, MOTION, TYPE } from "./tokens";

export interface MapView { x: number; y: number; w: number; h: number }

export function MetroMap({ layout, onSelect, lit, live, view, className, minWidth, children }: {
  layout: SystemLayout;
  onSelect: (id: string) => void;
  /** station ids to light (a through service under the pointer); the rest dims */
  lit: string[] | null;
  live: boolean;
  /** a crop in cells (the specimen view); default = the whole sheet */
  view?: MapView;
  className?: string;
  minWidth?: number;
  children?: ReactNode;
}) {
  const { width, height, stations, lines, audit, areas } = layout;
  const G = GRID.pitch;
  const vb = view ? [view.x * G, view.y * G, view.w * G, view.h * G] : [0, 0, width, height];
  const litSet = lit ? new Set(lit) : null;
  const names = Object.fromEntries(lines.map((l) => [l.id, l.name]));
  const labels = new Map(stations.map((s) => [s.id, s.label]));
  const stops = stations.map((s) => ({ x: s.x, y: s.y }));
  const interchanges = stations.filter((s) => s.kind === "interchange").length;
  return (
    <svg viewBox={vb.join(" ")} className={className} role="img"
      aria-label={`Transit map: ${stations.length} stations on ${lines.length} lines, ${interchanges} interchanges`}
      style={{ fontFamily: TYPE.family, minWidth }}
      data-crossings={audit.crossings} data-overlaps={audit.overlaps} data-pass-through={audit.passThrough}
      data-label-collisions={audit.labelCollisions} data-off-grid={audit.offGrid}
      data-service-mismatch={audit.serviceMismatch.length} data-stations={stations.length} data-auto={layout.auto.length}
      data-metro-ready="1">
      {areas.map((a) => (
        <text key={a.id} x={a.x * G} y={a.y * G} textAnchor={a.anchor} fontSize={TYPE.district}
          fill={INK_DIM} opacity={TYPE.districtOpacity} letterSpacing={TYPE.districtTracking} className="select-none">
          {a.name}
        </text>
      ))}

      <g opacity={litSet ? MOTION.dimTo : 1} style={{ transition: `opacity ${MOTION.dimMs}ms ease` }}>
        {lines.map((l) => l.paths.map((p, i) => (
          <path key={`${l.id}-${i}`} d={p.d} fill="none" stroke={l.color} strokeWidth={GRID.track}
            strokeLinecap={p.auto ? "butt" : "round"} strokeLinejoin="round" strokeDasharray={p.auto ? SPUR_DASH : undefined} />
        )))}
        {lines.map((l) => <Train key={l.id} line={l} live={live} stops={stops} />)}
      </g>

      {stations.map((s) => (
        <Station key={s.id} s={s} color={lineColor(layout, s.lines[0])} lineNames={names} onSelect={onSelect}
          dim={!!litSet && !litSet.has(s.id)} nameOf={(id) => labels.get(id) ?? id} />
      ))}

      {children}
    </svg>
  );
}
