// The key, in two forms that render the same data (the layout's lines with
// their two counts + encoding.ts KEY, so the key cannot drift from the marks):
//   Cartouche: inside the SVG, in the sheet's reserved "cartouche" rect (desktop).
//   PhoneKey:  HTML above the map on a phone, folded into a disclosure so the
//              map leads; the cartouche is a long swipe away there.
// Two counts per line: "models" = the family's own models (what every other
// design prints), "stops" = every station the line calls at (its models + the
// models built on them), so a reader comparing designs never sees a clash.
import { KEY, KEY_COLUMNS } from "./encoding";
import { KeyGlyph } from "./marks";
import type { SystemLayout } from "./system";
import { GRID, INK, INK_DIM, LINE_FAINT, PAPER, SPACE, TYPE } from "./tokens";

/** The legend rows this map needs: the spur row only when something was auto-placed. */
const legendFor = (layout: SystemLayout) => KEY.rows.filter((r) => r.sample !== "spur" || layout.auto.length > 0);
/** A line's own models: the stations whose first (own) line it is. */
const ownModels = (layout: SystemLayout, line: string) => layout.stations.filter((s) => s.lines[0] === line).length;

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
      <text x={x0 + pad + SPACE.keyModels} y={y0 + SPACE.keyTop - SPACE.keyRow} fontSize={TYPE.keyHead} fill={INK_DIM} textAnchor="end">{KEY_COLUMNS.models}</text>
      <text x={x0 + pad + SPACE.keyStops} y={y0 + SPACE.keyTop - SPACE.keyRow} fontSize={TYPE.keyHead} fill={INK_DIM} textAnchor="end">{KEY_COLUMNS.stops}</text>
      {layout.lines.map((l, i) => {
        const y = y0 + SPACE.keyTop + i * SPACE.keyRow;
        const num = { fontSize: TYPE.key, textAnchor: "end" as const, style: { fontVariantNumeric: "tabular-nums" } };
        return (
          <g key={l.id}>
            <line x1={x0 + pad} x2={x0 + pad + 26} y1={y - 4} y2={y - 4} stroke={l.color} strokeWidth={GRID.track} strokeLinecap="round" />
            <text x={x0 + pad + SPACE.keyName} y={y} fontSize={TYPE.key} fill={INK}>{l.name}</text>
            <text x={x0 + pad + SPACE.keyModels} y={y} fill={INK} {...num}>{ownModels(layout, l.id)}</text>
            <text x={x0 + pad + SPACE.keyStops} y={y} fill={INK_DIM} {...num}>{l.stations.length}</text>
          </g>
        );
      })}
      {legend.map(({ sample: mark, label }, i) => {
        const y = y0 + SPACE.keyTop + i * glyphRow;
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

/** Phone only: the key above the map, folded (the map leads); open, the lines
 * with their two counts, then one row per mark. */
export function PhoneKey({ layout }: { layout: SystemLayout }) {
  return (
    <details className="group mb-3 border-y border-line-faint text-[12px] leading-tight text-ink md:hidden">
      <summary className="flex h-10 cursor-pointer list-none items-center justify-between text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-1.5">
          {layout.lines.map((l) => <span key={l.id} aria-hidden className="h-[6px] w-4 rounded-full" style={{ background: l.color }} />)}
          <span className="ml-1.5">Key</span>
        </span>
        <span className="font-normal text-ink-dim"><span className="group-open:hidden">Show</span><span className="hidden group-open:inline">Hide</span></span>
      </summary>
      <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-3 gap-y-1 pb-1">
        <span /><span />
        <span className="text-right text-[11px] text-ink-dim">{KEY_COLUMNS.models}</span>
        <span className="text-right text-[11px] text-ink-dim">{KEY_COLUMNS.stops}</span>
        {layout.lines.map((l) => (
          <div key={l.id} className="contents">
            <span className="h-[6px] w-6 shrink-0 rounded-full" style={{ background: l.color }} />
            <span>{l.name}</span>
            <span className="text-right tabular-nums">{ownModels(layout, l.id)}</span>
            <span className="text-right tabular-nums text-ink-dim">{l.stations.length}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-1 pb-3">
        {legendFor(layout).map(({ sample: mark, label }) => (
          <div key={mark} className="flex h-[22px] items-center gap-2">
            <svg width={34} height={22} viewBox="0 0 34 22" aria-hidden className="shrink-0">
              <KeyGlyph mark={mark} cx={17} cy={11} />
            </svg>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
