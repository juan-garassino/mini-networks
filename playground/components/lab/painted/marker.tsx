// The image renders' evidence marker, one drawing for the map, the legend and
// the card: a disc in the evidence fill (dashed rim while the bar is still
// provisional), a star for a champion, a pale pip for trained. Pixel image
// renders get the same marks squared (crispEdges). Colours: material.ts.
import type { EvidenceState } from "@/components/lab/shared/card-model";
import type { MapMaterial, Material } from "./material";

const star = (R: number) =>
  `M0 ${-R * 0.62} L${R * 0.19} ${-R * 0.12} L${R * 0.62} ${-R * 0.12} L${R * 0.27} ${R * 0.16} L${R * 0.4} ${R * 0.62} L0 ${R * 0.33} L${-R * 0.4} ${R * 0.62} L${-R * 0.27} ${R * 0.16} L${-R * 0.62} ${-R * 0.12} L${-R * 0.19} ${-R * 0.12} Z`;

/** The marker at the origin, radius R (its rim is R/5 wide). */
export function Mark({ m, state, R, sw }: { m: MapMaterial; state: EvidenceState; R: number; sw: number }) {
  const ev = m.evidence[state];
  if (m.crisp) {
    return (
      <g shapeRendering="crispEdges">
        <rect x={-R} y={-R} width={R * 2} height={R * 2} fill={ev.fill} stroke={ev.stroke} strokeWidth={sw}
          strokeDasharray={ev.dash ? `${sw * 2} ${sw * 1.5}` : undefined} />
        {state === "champion" && <path d={star(R)} fill={m.marks.star} />}
        {state === "trained" && <rect x={-R * 0.3} y={-R * 0.3} width={R * 0.6} height={R * 0.6} fill={m.marks.pip} />}
      </g>
    );
  }
  return (
    <g>
      <circle r={R} fill={ev.fill} stroke={ev.stroke} strokeWidth={sw} strokeDasharray={ev.dash ? `${sw * 2.2} ${sw * 1.6}` : undefined} />
      {state === "champion" && <path d={star(R)} fill={m.marks.star} />}
      {state === "trained" && <circle r={R * 0.35} fill={m.marks.pip} />}
    </g>
  );
}

/** The same marker as an inline icon (legend rows, the card's name and signposts). */
export function MarkIcon({ m, state, size }: { m: Material; state: EvidenceState; size: number }) {
  if (!("marks" in m)) return null;
  const R = size / 2 - 1;
  return (
    <svg aria-hidden width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} className="block flex-none">
      <Mark m={m as MapMaterial} state={state} R={R} sw={Math.max(1.2, R / 5)} />
    </svg>
  );
}
