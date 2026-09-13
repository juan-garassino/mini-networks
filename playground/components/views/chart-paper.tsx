"use client";

import type { TaxonModel, TaxonomyResponse } from "@/lib/types";
import { ATOMS, symbolFor } from "@/lib/blueprint";
import { iconFor } from "@/lib/icons";
import { CritterCameo } from "@/components/paper/critters";

// Edition 5: a manila survey map. Families are districts, models are lots,
// compositions are routes. Muted survey palette, printed signage + pencil
// annotations, generous negative space — a playground for grown-ups.
const DISTRICTS: { family: string; name: string; role: string; color: string }[] = [
  { family: "perception", name: "Perception", role: "sees", color: "var(--pen-3)" },
  { family: "sequence", name: "Sequence", role: "remembers", color: "#5b7d99" },
  { family: "generative", name: "Generative", role: "imagines", color: "var(--redline)" },
  { family: "representation", name: "Representation", role: "compares", color: "var(--pen-4)" },
  { family: "structure", name: "Structure", role: "connects", color: "var(--pen-5)" },
  { family: "decision", name: "Decision", role: "chooses", color: "#4e8a86" },
];
const ROUTE_COLORS = ["var(--pen-3)", "#5b7d99", "var(--redline)", "var(--pen-4)", "var(--pen-5)", "#4e8a86"];

function CompassRose() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" className="-rotate-3">
      <circle cx={36} cy={36} r={30} stroke="var(--line)" strokeWidth={1.5} />
      <circle cx={36} cy={36} r={22} stroke="var(--line-faint)" strokeWidth={1} />
      {[
        ["N", 36, 12], ["E", 60, 40], ["S", 36, 64], ["W", 8, 40],
      ].map(([l, x, y]) => (
        <text key={l as string} x={x as number} y={y as number} textAnchor="middle" fontSize={9}
          fontFamily="var(--font-display)" fill="var(--ink-dim)">{l}</text>
      ))}
      {/* north needle */}
      <path d="M36 16 L41 38 L36 33 L31 38 Z" fill="var(--redline)" stroke="var(--line)" strokeWidth={0.8} />
      <path d="M36 56 L41 34 L36 39 L31 34 Z" fill="#f7f1e2" stroke="var(--line)" strokeWidth={0.8} />
      <circle cx={36} cy={36} r={2.5} fill="var(--line)" />
    </svg>
  );
}

function RouteGlyph({ color }: { color: string }) {
  return (
    <svg width="66" height="16" viewBox="0 0 66 16" fill="none" className="shrink-0">
      <line x1={7} y1={8} x2={59} y2={8} stroke={color} strokeWidth={2.5} strokeDasharray="1 5" strokeLinecap="round" />
      <circle cx={7} cy={8} r={4.5} fill="#f7f1e2" stroke={color} strokeWidth={2.5} />
      <circle cx={59} cy={8} r={4.5} fill={color} stroke="var(--line)" strokeWidth={1} />
    </svg>
  );
}

export function ChartPaper({
  taxonomy, onSelect,
}: {
  taxonomy: TaxonomyResponse | null;
  onSelect: (name: string) => void;
}) {
  if (!taxonomy) return null;
  const familyOf = (name: string): string => {
    if (ATOMS[name]) return ATOMS[name].family;
    const m = taxonomy.models.find((x) => x.name === name);
    return m?.builds_on[0] ? familyOf(m.builds_on[0]) : "structure";
  };
  const byFamily = (family: string): TaxonModel[] =>
    taxonomy.models
      .filter((m) => familyOf(m.name) === family)
      .sort((a, b) => (ATOMS[a.name]?.z ?? 99) - (ATOMS[b.name]?.z ?? 99));

  return (
    <div className="h-full overflow-y-auto px-6 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-[1400px] space-y-6">
        {/* ——— map furniture: cartouche · legend · compass ——— */}
        <div className="flex flex-wrap items-stretch gap-5">
          <div className="pp-panel flex-1 basis-72 px-6 py-4">
            <div className="text-[11px] text-ink-dim">the periodic table of</div>
            <h1 className="bp-title text-3xl font-extrabold text-ink sm:text-4xl">mini_networks</h1>
            <div className="mt-1 text-[12px] text-ink-dim">
              districts &amp; routes of {taxonomy.models.length} neural species · surveyed 2026
            </div>
          </div>

          <div className="pp-panel px-5 py-3">
            <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-ink-dim">Legend</div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-1">
              {DISTRICTS.map((d) => (
                <div key={d.family} className="flex items-center gap-2 text-[11px] text-ink">
                  <span className="h-3 w-3 rounded-[2px] border border-line" style={{ background: d.color }} />
                  <span className="flex-1">{d.name}</span>
                  <span className="text-ink-dim">{byFamily(d.family).length}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pp-panel hidden items-center justify-center px-4 lg:flex">
            <CompassRose />
          </div>
        </div>

        {/* ——— districts ——— */}
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {DISTRICTS.map((d, di) => {
            const models = byFamily(d.family);
            return (
              <section
                key={d.family}
                className="pp-panel p-4"
                style={{ transform: `rotate(${di % 2 ? 0.35 : -0.35}deg)` }}
              >
                <header className="mb-3 flex items-baseline justify-between">
                  <div>
                    <h2 className="bp-title text-base font-bold text-ink">{d.name}</h2>
                    <div className="h-[3px] w-14 rounded-full" style={{ background: d.color }} />
                  </div>
                  <span className="text-[11px] text-ink-dim">
                    {models.length} lots · <span className="italic">{d.role}</span>
                  </span>
                </header>
                <div className="grid grid-cols-2 gap-2">
                  {models.map((m) => {
                    const Icon = iconFor(m.name);
                    return (
                      <button
                        key={m.name}
                        onClick={() => onSelect(m.name)}
                        className="group flex items-center gap-2 rounded border border-line-faint bg-paper/40 px-2 py-1.5 text-left transition-all hover:-translate-y-px hover:border-line"
                      >
                        <span
                          className="grid h-6 w-6 shrink-0 place-items-center rounded-[3px] text-[10px] font-bold text-white transition-colors"
                          style={{ background: d.color }}
                        >
                          {ATOMS[m.name]?.symbol ?? symbolFor(m.name)}
                        </span>
                        <span className="flex-1 truncate text-[12px] text-ink">{m.name.replace(/_/g, " ")}</span>
                        {Icon && <Icon size={15} strokeWidth={1.5} className="shrink-0 text-ink-dim" />}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* ——— routes ——— */}
        <section className="pp-panel p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="bp-title text-base font-bold text-ink">Routes</h2>
            <span className="text-[11px] text-ink-dim">{taxonomy.compositions.length} compositions</span>
          </div>
          <div className="grid gap-x-10 gap-y-2.5 md:grid-cols-2">
            {taxonomy.compositions.map((c, i) => (
              <button
                key={c.name}
                onClick={() => onSelect(c.name)}
                className="group flex items-center gap-3 border-b border-dotted border-line-faint pb-1.5 text-left"
              >
                <RouteGlyph color={ROUTE_COLORS[i % ROUTE_COLORS.length]} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-ink transition-colors group-hover:text-redline">
                    {c.name.replace(/_/g, " ")}
                  </div>
                  <div className="truncate text-[11px] text-ink-dim">{c.composes.join(" ⇢ ")}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ——— map margin: scale bar + surveyor's mark ——— */}
        <div className="flex items-end justify-between px-1 pb-4 pt-2">
          <svg width="150" height="26" viewBox="0 0 150 26" fill="none">
            <line x1={2} y1={16} x2={122} y2={16} stroke="var(--ink-dim)" strokeWidth={1.5} />
            {[2, 32, 62, 92, 122].map((x) => (
              <line key={x} x1={x} y1={11} x2={x} y2={16} stroke="var(--ink-dim)" strokeWidth={1.5} />
            ))}
            <text x={2} y={8} fontSize={8} fill="var(--ink-dim)" fontFamily="var(--font-draft)">0</text>
            <text x={112} y={8} fontSize={8} fill="var(--ink-dim)" fontFamily="var(--font-draft)">1 epoch</text>
          </svg>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-ink-dim">drawn from life</span>
            <CritterCameo size={34} />
          </div>
        </div>
      </div>
    </div>
  );
}
