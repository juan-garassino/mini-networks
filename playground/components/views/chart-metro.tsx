"use client";

import type { TaxonomyResponse } from "@/lib/types";
import { symbolFor } from "@/lib/blueprint";
import { LINE_COLORS, LINE_NAMES, METRO_LEGEND, type MetroMark } from "@/components/metro/encoding";
import { BADGE, LABEL_PX, labelOf, layoutStrip, makeFamilyOf, textWidth, type Stop, type Strip } from "@/components/metro/layout";

// Edition 3: the zoo as a transit system. Each family is a line, drawn as its
// own strip map (the diagram posted inside a carriage): tracks are builds_on
// links inside the family, 45°/90° only, generations left → right. Every mark
// is declared in components/metro/encoding.ts; the key below renders it.
const FAMILIES = Object.keys(LINE_COLORS);
const INK = "var(--ink)";
const TRACK_W = 6;

export function ChartMetro({
  taxonomy, onSelect,
}: {
  taxonomy: TaxonomyResponse | null;
  onSelect: (name: string) => void;
}) {
  if (!taxonomy) return null;
  const familyOf = makeFamilyOf(taxonomy.models);
  const strips = FAMILIES.map((f) => layoutStrip(taxonomy.models, f, familyOf)).filter((s) => s.stops.length);
  // one shared width keeps every strip on the same column grid
  const W = Math.max(...strips.map((s) => s.width));

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-6 sm:px-8">
        <header className="border-b-[3px] border-ink pb-5">
          <div className="text-[11px] tracking-[0.3em] text-ink-dim">NETWORK DIAGRAM · NOT TO SCALE</div>
          <h1 className="bp-title mt-1 text-[28px] font-bold leading-tight text-ink sm:text-4xl">The mini_networks Transit Authority</h1>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-x-10 gap-y-5">
            <p className="max-w-[48ch] text-[13px] leading-snug text-ink-dim">
              {taxonomy.models.length} stations on {strips.length} lines. Each line is a family; a track
              means the model builds on the one before it. Ride left to right, one generation per stop.
            </p>
            <MetroKey strips={strips} />
          </div>
        </header>

        <div className="mt-7 grid gap-x-12 gap-y-9"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${W}px), 1fr))` }}>
          {strips.map((s) => <StripPanel key={s.family} strip={s} width={W} onSelect={onSelect} />)}
        </div>

        <section className="mt-10">
          <div className="flex items-baseline justify-between border-b-[3px] border-ink pb-2">
            <h2 className="text-[17px] font-bold text-ink">Through services</h2>
            <span className="text-[12px] text-ink-dim">{taxonomy.compositions.length} pipelines across lines</span>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 sm:gap-x-10">
            {taxonomy.compositions.map((c) => (
              <button key={c.name} onClick={() => onSelect(c.name)}
                className="metro-service grid grid-cols-[1fr_auto] items-center gap-3 border-b border-line-faint py-2 text-left">
                <span className="truncate text-[13px] text-ink">{labelOf(c.name)}</span>
                <span className="flex gap-1">
                  {c.composes.map((n) => <Bullet key={n} name={n} family={familyOf(n)} />)}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StripPanel({ strip, width, onSelect }: { strip: Strip; width: number; onSelect: (n: string) => void }) {
  const { family, color, stops, tracks, height, interchanges } = strip;
  return (
    <section className="min-w-0">
      <div className="flex items-center gap-3 pb-2">
        <span className="h-[10px] w-10 rounded-full" style={{ background: color }} />
        <h2 className="text-[17px] font-bold text-ink">{LINE_NAMES[family] ?? family} line</h2>
        <span className="ml-auto text-[12px] tabular-nums text-ink-dim">
          {stops.length} stations{interchanges ? `, ${interchanges} interchange${interchanges > 1 ? "s" : ""}` : ""}
        </span>
      </div>
      <div className="overflow-x-auto border-t border-line-faint">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block"
          style={{ fontFamily: "var(--font-jost), sans-serif" }} role="img" aria-label={`${family} line`}>
          {tracks.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={color} strokeWidth={TRACK_W} strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {stops.map((s) => <StopMark key={s.name} s={s} color={color} onSelect={onSelect} />)}
        </svg>
      </div>
    </section>
  );
}

function StopMark({ s, color, onSelect }: { s: Stop; color: string; onSelect: (n: string) => void }) {
  const label = labelOf(s.name);
  const lx = s.labelSide === "right" ? s.x + (s.kind === "origin" ? 18 : 14) : s.x - 3;
  const ly = s.labelSide === "right" ? s.y + 4.5 : s.y - 14;
  const bx = lx + textWidth(label) + 6 + BADGE / 2;
  return (
    <g className="metro-stop cursor-pointer" onClick={() => onSelect(s.name)}>
      <title>{label}{s.changeFor.length ? ` (change for ${s.changeFor.map((c) => labelOf(c.name)).join(", ")})` : ""}</title>
      {/* generous hit area */}
      <rect x={s.x - 14} y={s.y - 28} width={textWidth(label) + 40} height={44} fill="transparent" />
      <Mark kind={s.kind} x={s.x} y={s.y} color={color} up={s.labelSide === "above"} symbol={symbolFor(s.name)} />
      <text x={lx} y={ly} fontSize={LABEL_PX} fill={INK} fontWeight={s.atom ? 600 : 400}>{label}</text>
      {s.changeFor.map((c, i) => (
        <g key={c.name} transform={`translate(${bx + i * BADGE} ${ly - 4.5})`}>
          <circle r={8} fill={LINE_COLORS[c.family] ?? "#777"} />
          <text y={3} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#fff">{symbolFor(c.name)}</text>
        </g>
      ))}
    </g>
  );
}

function Mark({ kind, x, y, color, up = true, symbol = "" }: {
  kind: MetroMark; x: number; y: number; color: string; up?: boolean; symbol?: string;
}) {
  switch (kind) {
    case "origin":
      return (
        <g>
          <circle cx={x} cy={y} r={11.5} fill={color} stroke="var(--paper)" strokeWidth={2} />
          <text x={x} y={y + 3.6} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff">{symbol}</text>
        </g>
      );
    case "tick":
      return <line x1={x} y1={y} x2={x} y2={up ? y - 9 : y + 9} stroke={color} strokeWidth={4} />;
    case "end":
      return <line x1={x} y1={y - 8} x2={x} y2={y + 8} stroke={color} strokeWidth={4.5} strokeLinecap="round" />;
    case "interchange":
      return <circle cx={x} cy={y} r={7.5} fill="var(--paper)" stroke={INK} strokeWidth={2.6} />;
    case "change":
      return (
        <g>
          <circle cx={x} cy={y} r={8} fill={color} />
          <text x={x} y={y + 3} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#fff">{symbol}</text>
        </g>
      );
  }
}

function Bullet({ name, family }: { name: string; family: string }) {
  return (
    <svg width={20} height={20} viewBox="-10 -10 20 20" aria-label={labelOf(name)} role="img">
      <title>{labelOf(name)}</title>
      <circle r={9} fill={LINE_COLORS[family] ?? "#777"} />
      <text y={3.2} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff"
        style={{ fontFamily: "var(--font-jost), sans-serif" }}>{symbolFor(name)}</text>
    </svg>
  );
}

function MetroKey({ strips }: { strips: Strip[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-4 text-[12px] text-ink sm:grid-cols-[auto_auto]">
      <div>
        <div className="mb-1 text-[11px] font-semibold text-ink-dim">Lines</div>
        {strips.map((s) => (
          <div key={s.family} className="flex h-[20px] items-center gap-2">
            <span className="h-[6px] w-7 rounded-full" style={{ background: s.color }} />
            <span className="w-[100px]">{LINE_NAMES[s.family] ?? s.family}</span>
            <span className="w-5 text-right tabular-nums text-ink-dim">{s.stops.length}</span>
          </div>
        ))}
      </div>
      <div>
        <div className="mb-1 text-[11px] font-semibold text-ink-dim">Symbols</div>
        {METRO_LEGEND.map(({ mark, label }) => (
          <div key={mark} className="flex min-h-[24px] items-center gap-2">
            <svg width={38} height={24} viewBox="0 0 38 24" aria-hidden className="shrink-0">
              {mark !== "change" && (
                <line x1={2} y1={14} x2={mark === "end" ? 19 : 36} y2={14}
                  stroke="#8a8478" strokeWidth={5} strokeLinecap="round" />
              )}
              <Mark kind={mark} x={19} y={14} color={mark === "change" ? LINE_COLORS.sequence : "#8a8478"} symbol={mark === "origin" ? "Cv" : "At"} />
            </svg>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
