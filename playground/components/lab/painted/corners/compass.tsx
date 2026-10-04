"use client";

// Bottom-left corner, the signature piece: a compass rose that IS the
// navigation. Its four long points pan the view a third of a screen; the
// centre returns to the whole map; a zoom rail stands beside it. Drawn on a
// 17-unit grid so the pixel map's edges land on art pixels (crispEdges);
// the paper map gets the same rose, anti-aliased, in its own inks.
import type { Material } from "../material";
import { Btn } from "./plate";

const N = 17, C = 8.5;

export function Compass({ m, unit, onPan, onWhole, onZoom, canIn, canOut, whole }: {
  m: Material;
  /** CSS px per grid unit */
  unit: number;
  onPan: (dx: number, dy: number) => void;
  onWhole: () => void;
  onZoom: (dir: 1 | -1) => void;
  canIn: boolean;
  canOut: boolean;
  whole: boolean;
}) {
  const size = N * unit;
  const ink = m.crisp ? "#3a1d2a" : m.border;
  const dark = m.border;            // maroon / sepia halves
  const light = m.plateHi;          // cream halves
  const gold = m.road;
  const pts = (a: [number, number], b: [number, number], c: [number, number]) => `${a[0]},${a[1]} ${b[0]},${b[1]} ${c[0]},${c[1]}`;
  // long points: tip, left shoulder, right shoulder (shoulders on the centre)
  const long: { id: string; tip: [number, number]; l: [number, number]; r: [number, number]; d: [number, number]; label: string }[] = [
    { id: "n", tip: [C, 0.5], l: [C - 2, C], r: [C + 2, C], d: [0, -1], label: "Pan up" },
    { id: "s", tip: [C, N - 0.5], l: [C + 2, C], r: [C - 2, C], d: [0, 1], label: "Pan down" },
    { id: "w", tip: [0.5, C], l: [C, C + 2], r: [C, C - 2], d: [-1, 0], label: "Pan left" },
    { id: "e", tip: [N - 0.5, C], l: [C, C - 2], r: [C, C + 2], d: [1, 0], label: "Pan right" },
  ];
  const diag: [number, number][] = [[2.5, 2.5], [N - 2.5, 2.5], [N - 2.5, N - 2.5], [2.5, N - 2.5]];
  const key = (fn: () => void) => (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };
  return (
    // the N rides above the rose (overflow): reserve its height so a plate stacked
    // above never collides with it
    <div className="flex items-end gap-2" role="group" aria-label="Map navigation" style={{ paddingTop: Math.round(unit * 4) }}>
      <svg width={size} height={size} viewBox={`0 0 ${N} ${N}`} shapeRendering={m.crisp ? "crispEdges" : "geometricPrecision"}
        style={{ display: "block", overflow: "visible", filter: m.crisp ? `drop-shadow(var(--ap) var(--ap) 0 ${m.shadow})` : m.card ? "drop-shadow(2px 2px 0 rgba(58,38,22,.62))" : `drop-shadow(1px 2px 0 ${m.shadow})` }}>
        {/* the rose's ring: a parchment disc with an ink rim */}
        <circle cx={C} cy={C} r={7} fill={m.plate} stroke={ink} strokeWidth={m.crisp ? 1 : 0.7} />
        <circle cx={C} cy={C} r={5.5} fill="none" stroke={m.border} strokeWidth={m.crisp ? 0.5 : 0.4} strokeDasharray={m.crisp ? "1 1" : "0.6 0.9"} />
        {/* short diagonal points, gold */}
        {diag.map(([x, y], i) => (
          <polygon key={i} points={pts([x, y], [C + (x < C ? -1 : 1) * 1.5, C], [C, C + (y < C ? -1 : 1) * 1.5])} fill={gold} stroke={ink} strokeWidth={m.crisp ? 0 : 0.5} />
        ))}
        {/* long points: dark left half, light right half — each a button */}
        {long.map((p) => (
          <g key={p.id} role="button" tabIndex={0} aria-label={p.label} className="cursor-pointer outline-none focus-visible:[&>polygon]:stroke-[1.5]"
            onClick={() => onPan(p.d[0] * 0.34, p.d[1] * 0.34)} onKeyDown={key(() => onPan(p.d[0] * 0.34, p.d[1] * 0.34))}>
            <polygon points={pts(p.tip, p.l, [C, C])} fill={dark} stroke={ink} strokeWidth={m.crisp ? 0 : 0.5} />
            <polygon points={pts(p.tip, p.r, [C, C])} fill={light} stroke={ink} strokeWidth={m.crisp ? 0 : 0.5} />
            <polygon points={pts(p.tip, p.l, p.r)} fill="transparent" className="hover:fill-white/25" />
          </g>
        ))}
        {/* outline of the long star in one stroke */}
        <polygon fill="none" stroke={ink} strokeWidth={m.crisp ? 0.5 : 0.6}
          points={`${C},0.5 ${C + 2},${C - 2} ${N - 0.5},${C} ${C + 2},${C + 2} ${C},${N - 0.5} ${C - 2},${C + 2} 0.5,${C} ${C - 2},${C - 2}`} />
        {/* the hub: whole map */}
        <g role="button" tabIndex={0} aria-label="Whole map" aria-pressed={whole} className="cursor-pointer outline-none"
          onClick={onWhole} onKeyDown={key(onWhole)}>
          <circle cx={C} cy={C} r={1.5} fill={whole ? gold : m.plateHi} stroke={ink} strokeWidth={m.crisp ? 0.5 : 0.6} />
        </g>
        <text x={C} y={-1.1} textAnchor="middle" fontSize={3.4} fontFamily={m.signFont} fontWeight={700} fill={ink}>N</text>
      </svg>
      <div className="flex flex-col gap-1.5">
        <Btn m={m} onClick={() => onZoom(1)} disabled={!canIn} label="Zoom in" title="Zoom in (+)" className="w-9" style={{ fontSize: 22, minHeight: 36, padding: 0 }}>+</Btn>
        <Btn m={m} onClick={() => onZoom(-1)} disabled={!canOut} label="Zoom out" title="Zoom out (−)" className="w-9" style={{ fontSize: 22, minHeight: 36, padding: 0 }}>−</Btn>
      </div>
    </div>
  );
}
