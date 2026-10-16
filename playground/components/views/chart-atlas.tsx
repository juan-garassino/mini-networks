"use client";

import { createElement } from "react";
import Link from "next/link";
import type { TaxonomyResponse } from "@/lib/types";
import { ATOMS, FAMILY_BLOCKS, PLACEMENT, familyOf } from "@/lib/blueprint";
import { iconFor } from "@/lib/icons";

// Edition 4: a naturalist's atlas — every species gets a plate, bound in six
// orders (the families). Every mark is declared in components/atlas/encoding.ts
// (PLATES_ENCODING): the hatched disc behind a figure = how many models build
// on it; the specimen label = genus, species, mechanism, parents, descendants.
const GENUS: Record<string, string> = {
  perception: "Perceptio", sequence: "Sequentia", generative: "Generativa",
  representation: "Repraesentatio", structure: "Structura", decision: "Decisio",
};
const ENGLISH: Record<string, string> = {
  perception: "Perception", sequence: "Sequence", generative: "Generative",
  representation: "Representation", structure: "Structure", decision: "Decision",
};

const ROMAN_PARTS: [number, string][] = [[40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
const roman = (n: number) => {
  let out = "";
  for (const [v, s] of ROMAN_PARTS) while (n >= v) { out += s; n -= v; }
  return out;
};
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const words = (n: number) => n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
const pretty = (s: string) => s.replace(/_/g, " ");

// table reading order inside an order: atoms first, then derived row by row
const placeKey = (name: string) => {
  const p = PLACEMENT[name];
  return p ? p.row * 100 + p.col : 9999;
};

function Plate({ n, name, level, introduces, buildsOn, descendants, genus, onSelect }: {
  n: number; name: string; level: string; introduces: string[]; buildsOn: string[];
  descendants: number; genus: string; onSelect: (name: string) => void;
}) {
  const icon = iconFor(name); // a static lucide lookup, not a component made per render
  const disc = descendants > 0 ? 44 + 8 * Math.min(descendants, 7) : 0;
  return (
    <button
      onClick={() => onSelect(name)}
      className="group flex flex-col border-[1.5px] border-line bg-paper-deep/40 p-[3px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-redline"
    >
      <div className="flex flex-1 flex-col border border-line-faint px-3 pb-3 pt-2 font-display text-ink">
        <div className="flex items-baseline justify-between text-[13px] text-ink-dim" style={{ fontVariant: "small-caps" }}>
          <span className="tracking-[0.06em]">plate {roman(n).toLowerCase()}</span>
          <span className="italic" style={{ fontVariant: "normal" }}>{level === "elementary" ? "typus" : "hybrida"}</span>
        </div>
        <div className="relative flex h-[104px] items-center justify-center">
          {disc > 0 && (
            <svg aria-hidden width={disc} height={disc} viewBox="0 0 100 100" className="absolute">
              <circle cx="50" cy="50" r="49" fill="url(#plate-hatch)" stroke="var(--line)" strokeWidth={100 / disc} opacity="0.55" />
            </svg>
          )}
          {icon && createElement(icon, { size: 48, strokeWidth: 1, className: "relative text-line transition-colors duration-200 group-hover:text-redline" })}
        </div>
        <div className="border-t border-line-faint pt-2">
          <div className="text-[13px] italic leading-tight text-ink-dim">{genus}</div>
          <div className="truncate text-[19px] font-semibold italic leading-tight" title={pretty(name)}>{pretty(name)}</div>
          <dl className="mt-1.5 grid grid-cols-[2.6em_minmax(0,1fr)] gap-x-1.5 text-[13px] leading-[1.3]">
            <dt className="italic text-ink-dim">intr.</dt>
            <dd className="truncate" title={introduces.map(pretty).join(", ")}>
              {introduces.length ? pretty(introduces[0]) : "none"}
              {introduces.length > 1 && <span className="text-ink-dim"> +{introduces.length - 1}</span>}
            </dd>
            <dt className="italic text-ink-dim">ex</dt>
            <dd className="truncate" title={buildsOn.map(pretty).join(", ")}>
              {buildsOn.length ? buildsOn.map(pretty).join(", ") : <span className="italic text-ink-dim">atom</span>}
            </dd>
            <dt className="italic text-ink-dim">desc.</dt>
            <dd className="tabular-nums">{descendants}</dd>
          </dl>
        </div>
      </div>
    </button>
  );
}

export function ChartAtlas({
  taxonomy, onSelect,
}: {
  taxonomy: TaxonomyResponse | null;
  onSelect: (name: string) => void;
}) {
  if (!taxonomy) return null;
  const famOf = (name: string): string => {
    const f = familyOf(name);
    if (f) return f;
    const m = taxonomy.models.find((x) => x.name === name);
    return m?.builds_on[0] ? famOf(m.builds_on[0]) : "structure";
  };
  const descendants = new Map<string, number>();
  for (const m of taxonomy.models) for (const p of m.builds_on) descendants.set(p, (descendants.get(p) ?? 0) + 1);

  const orders = FAMILY_BLOCKS.map((b) => ({
    family: b.family,
    models: taxonomy.models
      .filter((m) => famOf(m.name) === b.family)
      .sort((a, z) => Number(!ATOMS[a.name]) - Number(!ATOMS[z.name]) || placeKey(a.name) - placeKey(z.name)),
  })).filter((o) => o.models.length > 0);

  let plateNo = 0;

  return (
    <div className="h-full overflow-y-auto px-4 pb-10 pt-6 sm:px-10">
      {/* one hatch for every plate's descendant disc */}
      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          <pattern id="plate-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="4" stroke="var(--line)" strokeWidth="1" opacity="0.5" />
          </pattern>
        </defs>
      </svg>

      <header className="mx-auto mb-2 max-w-[1500px] border-b-2 border-line pb-4 text-center font-display">
        <h1 className="bp-title text-[34px] font-bold leading-tight text-ink sm:text-[44px]">An Atlas of Neural Species</h1>
        <p className="mt-1 text-[16px] italic text-ink-dim">
          {words(taxonomy.models.length).replace(/^./, (c) => c.toUpperCase())} plates in {words(orders.length)} orders,
          with {words(taxonomy.compositions.length)} observed symbioses
        </p>
        <p className="mt-2 text-[14px]">
          <Link href="/atlas/" className="italic text-line underline decoration-line-faint underline-offset-4 hover:decoration-line">
            See every species on one network chart
          </Link>
        </p>
      </header>

      <div className="mx-auto max-w-[1500px]">
        {orders.map((o, i) => (
          <section key={o.family} aria-labelledby={`ordo-${o.family}`}>
            <header className="mb-4 mt-9 flex flex-wrap items-baseline gap-x-4 border-b border-line pb-1.5 font-display">
              <span className="text-[14px] tracking-[0.06em] text-ink-dim" style={{ fontVariant: "small-caps" }}>ordo {roman(i + 1).toLowerCase()}</span>
              <h2 id={`ordo-${o.family}`} className="bp-title text-[28px] font-semibold italic leading-none text-ink">{GENUS[o.family]}</h2>
              <span className="basis-full text-[15px] italic text-ink-dim sm:ml-auto sm:basis-auto">
                {ENGLISH[o.family]}, {words(o.models.length)} {o.models.length === 1 ? "plate" : "plates"}
              </span>
            </header>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
              {o.models.map((m) => (
                <Plate key={m.name} n={++plateNo} name={m.name} level={m.level} introduces={m.introduces}
                  buildsOn={m.builds_on} descendants={descendants.get(m.name) ?? 0} genus={GENUS[o.family]} onSelect={onSelect} />
              ))}
            </div>
          </section>
        ))}

        <section aria-labelledby="symbioses" className="mt-12">
          <header className="mb-3 flex flex-wrap items-baseline gap-x-4 border-b border-line pb-1.5 font-display">
            <h2 id="symbioses" className="bp-title text-[28px] font-semibold italic leading-none text-ink">Observed symbioses</h2>
            <span className="basis-full text-[15px] italic text-ink-dim sm:ml-auto sm:basis-auto">
              {words(taxonomy.compositions.length)} pipelines that combine species
            </span>
          </header>
          <ul className="grid gap-x-10 font-display lg:grid-cols-2">
            {taxonomy.compositions.map((c) => (
              <li key={c.name}>
                <button onClick={() => onSelect(c.name)}
                  className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-b border-dotted border-line-faint py-2 text-left focus-visible:outline-2 focus-visible:outline-redline">
                  <span className="min-w-0">
                    <span className="block truncate text-[17px] font-semibold italic leading-tight text-ink group-hover:text-redline">{pretty(c.name)}</span>
                    <span className="block truncate text-[14px] leading-snug text-ink-dim">{c.composes.map(pretty).join(" + ")}</span>
                  </span>
                  <span className="text-[13px] italic tabular-nums text-ink-dim">
                    {c.composes.length} species
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
