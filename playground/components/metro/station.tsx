// One station: its mark, its name and a hit area covering both. Clicking (or
// Enter / Space) opens the station's spec sheet; hover/focus turn the name to
// the accent (blueprint.css .metro-stop rules read the --redline token).
import { Mark } from "./marks";
import { INK, MARK, MOTION, TYPE } from "./tokens";
import type { MapStation } from "./system";

export function Station({ s, color, lineNames, onSelect, dim, nameOf }: {
  s: MapStation;
  /** the station's own line colour */
  color: string;
  lineNames: Record<string, string>;
  onSelect: (id: string) => void;
  dim: boolean;
  /** label of an upstream id, for the tooltip */
  nameOf: (id: string) => string;
}) {
  const r = 12; // the mark's half-size inside the hit area
  const x0 = Math.min(s.box.x, s.x - r) - MARK.hitPad, y0 = Math.min(s.box.y, s.y - r) - MARK.hitPad;
  const x1 = Math.max(s.box.x + s.box.w, s.x + r) + MARK.hitPad, y1 = Math.max(s.box.y + s.box.h, s.y + r) + MARK.hitPad;
  const change = s.lines.length > 1 ? `, change for ${s.lines.map((f) => lineNames[f] ?? f).join(" and ")}` : "";
  return (
    <g className="metro-stop cursor-pointer outline-none" tabIndex={0} role="button" aria-label={`${s.label}${change}`}
      onClick={() => onSelect(s.id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(s.id); } }}
      opacity={dim ? MOTION.dimStation : 1} style={{ transition: `opacity ${MOTION.dimMs}ms ease` }}>
      <title>{s.label}{s.parents.length ? `, built on ${s.parents.map(nameOf).join(", ")}` : ", an origin"}{s.auto ? " (placed automatically)" : ""}</title>
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="transparent" />
      <Mark kind={s.kind} x={s.x} y={s.y} color={color} tick={s.tick} terminus={s.terminus} symbol={s.symbol} />
      <text x={s.text.x} y={s.text.y} textAnchor={s.text.anchor} fontSize={TYPE.label}
        fontWeight={s.kind === "tick" ? TYPE.regular : TYPE.semibold} fill={INK} className="metro-label">{s.label}</text>
    </g>
  );
}
