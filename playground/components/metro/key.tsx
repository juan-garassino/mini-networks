// The key, in two forms that render the same data (the layout's lines with
// their counts + METRO_LEGEND, so the key cannot drift from the marks):
//   Cartouche: inside the SVG, in the sheet's reserved "cartouche" rect (desktop).
//   PhoneKey:  HTML above the map on a phone, where the cartouche is a long swipe away.
import { METRO_LEGEND } from "./encoding";
import { KeyGlyph } from "./marks";
import type { SystemLayout } from "./system";
import { GRID, INK, INK_DIM, LINE_FAINT, PAPER, SPACE, TYPE } from "./tokens";

/** The legend rows this map needs: the spur row only when something was auto-placed. */
const legendFor = (layout: SystemLayout) => METRO_LEGEND.filter((r) => r.mark !== "spur" || layout.auto.length > 0);

export function Cartouche({ layout, title, note }: { layout: SystemLayout; title: string; note: string }) {
  const r = layout.reserved.find((q) => q.id === "cartouche");
  if (!r) return null;
  const { x: x0, y: y0, w, h } = r.box;
  const pad = SPACE.cartouchePad;
  const colB = x0 + pad + SPACE.cartoucheColB;
  const legend = legendFor(layout);
  const glyphRow = legend.length > 5 ? SPACE.keyRow : SPACE.glyphRow;
  const interchanges = layout.stations.filter((s) => s.kind === "interchange").length;
  return (
    <g className="select-none">
      <rect x={x0} y={y0} width={w} height={h} fill={PAPER} stroke={INK} strokeWidth={SPACE.cartoucheStroke} rx={SPACE.cartoucheRadius} />
      <text x={x0 + pad} y={y0 + 32} fontSize={TYPE.title} fontWeight={TYPE.semibold} fill={INK}>{title}</text>
      <text x={x0 + pad} y={y0 + 54} fontSize={TYPE.note} fill={INK_DIM}>
        {layout.stations.length} stations on {layout.lines.length} lines, {interchanges} interchanges, {layout.audit.crossings} crossings.
      </text>
      <text x={x0 + pad} y={y0 + 70} fontSize={TYPE.note} fill={INK_DIM}>{note}</text>
      <line x1={x0 + pad} x2={x0 + w - pad} y1={y0 + 84} y2={y0 + 84} stroke={LINE_FAINT} strokeWidth={1} />
      {layout.lines.map((l, i) => {
        const y = y0 + 104 + i * SPACE.keyRow;
        return (
          <g key={l.id}>
            <line x1={x0 + pad} x2={x0 + pad + 26} y1={y - 4} y2={y - 4} stroke={l.color} strokeWidth={GRID.track} strokeLinecap="round" />
            <text x={x0 + pad + 36} y={y} fontSize={TYPE.key} fill={INK}>{l.name}</text>
            <text x={x0 + pad + 146} y={y} fontSize={TYPE.key} fill={INK_DIM} textAnchor="end" style={{ fontVariantNumeric: "tabular-nums" }}>{l.stations.length}</text>
          </g>
        );
      })}
      {legend.map(({ mark, label }, i) => {
        const y = y0 + 104 + i * glyphRow;
        return (
          <g key={mark}>
            <KeyGlyph mark={mark} cx={colB + 15} cy={y - 4} />
            <text x={colB + 42} y={y} fontSize={TYPE.key} fill={INK}>{label}</text>
          </g>
        );
      })}
    </g>
  );
}

/** Phone only: the key above the map, lines in two columns, then one row per mark. */
export function PhoneKey({ layout }: { layout: SystemLayout }) {
  return (
    <div className="mb-3 border-y border-line-faint py-3 text-[12px] leading-tight text-ink md:hidden">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        {layout.lines.map((l) => (
          <div key={l.id} className="flex items-center gap-1.5">
            <span className="h-[6px] w-6 shrink-0 rounded-full" style={{ background: l.color }} />
            <span>{l.name}</span>
            <span className="ml-auto tabular-nums text-ink-dim">{l.stations.length}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-1">
        {legendFor(layout).map(({ mark, label }) => (
          <div key={mark} className="flex h-[22px] items-center gap-2">
            <svg width={34} height={22} viewBox="0 0 34 22" aria-hidden className="shrink-0">
              <KeyGlyph mark={mark} cx={17} cy={11} />
            </svg>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
