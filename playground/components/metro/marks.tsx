// The map's marks, drawn at a station centre (x, y). Every mark is declared in
// encoding.ts; sizes come from tokens.ts MARK. Shared by the map, the in-map
// cartouche and the phone key, so a key sample is the mark itself.
import type { MetroMark } from "./encoding";
import { GRID, INK, MARK, PAPER, SHEET, TYPE } from "./tokens";
import type { Pt } from "./system";

export function Mark({ kind, x, y, color, tick = { x: 0, y: -1 }, terminus = false, symbol = "" }: {
  kind: MetroMark; x: number; y: number; color: string; tick?: Pt; terminus?: boolean; symbol?: string;
}) {
  switch (kind) {
    case "origin":
      return (
        <g>
          <circle cx={x} cy={y} r={MARK.origin.r} fill={color} stroke={PAPER} strokeWidth={MARK.origin.halo} />
          <text x={x} y={y + 3.9} textAnchor="middle" fontSize={TYPE.bulletLetter} fontWeight={TYPE.bold} fill={SHEET.bulletInk}>{symbol}</text>
        </g>
      );
    case "tick":
      return terminus
        ? <line x1={x - tick.x * MARK.terminus.half} y1={y - tick.y * MARK.terminus.half} x2={x + tick.x * MARK.terminus.half} y2={y + tick.y * MARK.terminus.half}
            stroke={color} strokeWidth={MARK.tick.w} strokeLinecap="round" />
        : <line x1={x} y1={y} x2={x + tick.x * MARK.tick.len} y2={y + tick.y * MARK.tick.len} stroke={color} strokeWidth={MARK.tick.w} />;
    case "terminus":
      return <Mark kind="tick" x={x} y={y} color={color} tick={{ x: 0, y: -1 }} terminus />;
    case "interchange":
      return <circle cx={x} cy={y} r={MARK.ring.r} fill={PAPER} stroke={INK} strokeWidth={MARK.ring.stroke} />;
    case "train":
      return <TrainBody x={x} y={y} angle={0} color={color} />;
    case "spur":
      return null; // a spur is a track style, drawn by KeyGlyph / Track
  }
}

export function TrainBody({ x, y, angle, color }: { x: number; y: number; angle: number; color: string }) {
  const t = MARK.train;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <rect x={-t.w / 2} y={-t.h / 2} width={t.w} height={t.h} rx={t.h / 2} fill={PAPER} stroke={color} strokeWidth={t.stroke} />
      <rect x={2.5} y={-t.windowH / 2} width={t.windowW} height={t.windowH} rx={1.2} fill={color} />
    </g>
  );
}

/** Dash of a track the drafting has not drawn yet (an auto-placed spur). */
export const SPUR_DASH = `${GRID.track * 1.4} ${GRID.track * 1.1}`;

/** A key sample: a short neutral track with the mark on it, centred on (cx, cy), 30 px wide. */
export function KeyGlyph({ mark, cx, cy }: { mark: MetroMark; cx: number; cy: number }) {
  const c = SHEET.sampleTrack;
  // the track runs where the mark would sit on the map: an origin starts it, a terminus ends it
  const x1 = mark === "origin" ? cx : cx - 15;
  const x2 = mark === "terminus" ? cx : cx + 15;
  return (
    <g>
      <line x1={x1} x2={x2} y1={cy} y2={cy} stroke={c} strokeWidth={GRID.track} strokeLinecap={mark === "spur" ? "butt" : "round"}
        strokeDasharray={mark === "spur" ? SPUR_DASH : undefined} />
      <Mark kind={mark} x={cx} y={cy} color={c} symbol="At" tick={{ x: 0, y: -1 }} />
    </g>
  );
}

/** A station named in a list: its bullet in its line colour, lettered with its symbol. */
export function Bullet({ label, symbol, color }: { label: string; symbol: string; color: string }) {
  return (
    <svg width={20} height={20} viewBox="-10 -10 20 20" aria-label={label} role="img">
      <title>{label}</title>
      <circle r={9} fill={color} />
      <text y={3.5} textAnchor="middle" fontSize={TYPE.serviceLetter} fontWeight={TYPE.bold} fill={SHEET.bulletInk}
        style={{ fontFamily: TYPE.family }}>{symbol}</text>
    </svg>
  );
}
