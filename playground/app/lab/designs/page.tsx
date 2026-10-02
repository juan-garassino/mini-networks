"use client";

// /lab/designs — seven links: six designs and one layout idea, each with its
// variants, every variant its own page with a keep / drop verdict. Thumbnails
// come from public/local/designs/<id>.jpg (node scripts/designs.mjs; local,
// gitignored). Verdicts are remembered in this browser and posted to the
// feedback inbox (skin "designs") so the agent reads them too.
import { useEffect, useState } from "react";
import { postFeedback } from "@/lib/api";
import { ALL_VARIANTS, DESIGNS, DIAGRAMS, type Variant } from "@/lib/designs";

type Verdict = "keep" | "drop";
const KEY = "mn-design-verdicts";

function load(): Record<string, Verdict> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
}

function Thumb({ v, className = "" }: { v: Variant; className?: string }) {
  return (
    <a href={v.href} className={`block overflow-hidden bg-neutral-100 focus-visible:outline-2 ${className}`} aria-label={`Open ${v.name}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local thumbnail */}
      <img src={`/local/designs/${v.id}.jpg`} alt="" className="block h-full w-full object-cover object-top"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
    </a>
  );
}

function Verdicts({ v, value, onJudge }: { v: Variant; value: Verdict | undefined; onJudge: (v: Variant, x: Verdict) => void }) {
  return (
    <div className="flex flex-none gap-1.5">
      <button type="button" onClick={() => onJudge(v, "keep")} aria-pressed={value === "keep"}
        className="rounded px-2.5 py-1 text-[13px] font-medium focus-visible:outline-2"
        style={{ background: value === "keep" ? "#047857" : "#ecfdf5", color: value === "keep" ? "#fff" : "#065f46" }}>Keep</button>
      <button type="button" onClick={() => onJudge(v, "drop")} aria-pressed={value === "drop"}
        className="rounded px-2.5 py-1 text-[13px] font-medium focus-visible:outline-2"
        style={{ background: value === "drop" ? "#be123c" : "#fff1f2", color: value === "drop" ? "#fff" : "#9f1239" }}>Drop</button>
    </div>
  );
}

export default function DesignsPage() {
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [sent, setSent] = useState<string | null>(null);
  useEffect(() => { setVerdicts(load()); }, []);

  const judge = (v: Variant, x: Verdict) => {
    const next = { ...verdicts };
    if (next[v.id] === x) delete next[v.id]; else next[v.id] = x;
    setVerdicts(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
    const word = next[v.id] ?? "undecided";
    postFeedback({ skin: "designs", url: window.location.href, text: `verdict: ${v.id} (${v.name}) → ${word}`, viewport: [window.innerWidth, window.innerHeight], images: [] })
      .then(() => setSent(`${v.name}: ${word}`)).catch(() => setSent(`${v.name}: ${word} (saved here only, API offline)`));
  };

  const kept = ALL_VARIANTS.filter((v) => verdicts[v.id] === "keep").map((v) => v.name);
  const dropped = ALL_VARIANTS.filter((v) => verdicts[v.id] === "drop").map((v) => v.name);
  const outline = (id: string) => (verdicts[id] === "keep" ? "3px solid #047857" : verdicts[id] === "drop" ? "3px solid #be123c" : "1px solid #ddd");

  return (
    <main className="h-full overflow-y-auto bg-[#f6f3ec] text-neutral-900">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Seven links</h1>
            <p className="mt-1 max-w-prose text-[15px] text-neutral-600">
              Six designs and one layout idea. Each variant opens on its own page; keep it or drop it.
            </p>
          </div>
          <div className="max-w-md text-[14px] text-neutral-600">
            {kept.length > 0 && <p><b className="text-emerald-800">Keep:</b> {kept.join(", ")}</p>}
            {dropped.length > 0 && <p><b className="text-rose-800">Drop:</b> {dropped.join(", ")}</p>}
            {sent && <p className="text-neutral-400" aria-live="polite">sent: {sent}</p>}
          </div>
        </header>

        <ol className="mt-8 space-y-8">
          {DESIGNS.map((d, i) => {
            const lead = d.variants[0];
            const single = d.variants.length === 1;
            return (
              <li key={d.id} className="overflow-hidden rounded-lg bg-white shadow-[0_1px_0_rgba(0,0,0,.08),0_8px_24px_-16px_rgba(0,0,0,.35)]" style={{ outline: single ? outline(lead.id) : "1px solid #ddd" }}>
                <div className="grid gap-0 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                  <Thumb v={lead} className="aspect-[16/10] sm:aspect-auto sm:min-h-[260px]" />
                  <div className="flex flex-col p-5">
                    <p className="text-[13px] text-neutral-500">{i + 1} of {DESIGNS.length}{d.kind === "layout" ? ", a layout idea" : ""}</p>
                    <h2 className="mt-0.5 text-2xl font-bold tracking-tight">{d.name}</h2>
                    <p className="mt-1 text-[15px] text-neutral-600">{d.pitch}</p>
                    {single && (
                      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                        <a href={lead.href} className="truncate font-mono text-[12px] text-neutral-400 hover:underline">{lead.href}</a>
                        <Verdicts v={lead} value={verdicts[lead.id]} onJudge={judge} />
                      </div>
                    )}
                  </div>
                </div>
                {!single && (
                  <ul className="grid gap-px border-t border-neutral-200 bg-neutral-200 sm:grid-cols-2">
                    {d.variants.map((v) => (
                      <li key={v.id} className="flex gap-3 bg-white p-3" style={{ boxShadow: `inset 0 0 0 ${verdicts[v.id] ? 3 : 0}px ${verdicts[v.id] === "keep" ? "#047857" : "#be123c"}`, opacity: verdicts[v.id] === "drop" ? 0.55 : 1 }}>
                        <Thumb v={v} className="h-[72px] w-[116px] flex-none rounded" />
                        <div className="min-w-0 flex-1">
                          <a href={v.href} className="text-[15px] font-semibold hover:underline">{v.name}</a>
                          <p className="text-[13px] text-neutral-600">{v.pitch}</p>
                          <p className="truncate font-mono text-[11px] text-neutral-400">{v.href}</p>
                        </div>
                        <Verdicts v={v} value={verdicts[v.id]} onJudge={judge} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>

        <section aria-label="Diagrams" className="mt-10 flex gap-4 rounded-lg bg-white p-3" style={{ outline: outline(DIAGRAMS.id) }}>
          <Thumb v={DIAGRAMS} className="h-[90px] w-[144px] flex-none rounded" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-neutral-500">Not a design: a component every map's card opens</p>
            <a href={DIAGRAMS.href} className="text-[17px] font-semibold hover:underline">{DIAGRAMS.name}</a>
            <p className="text-[14px] text-neutral-600">{DIAGRAMS.pitch}</p>
          </div>
          <Verdicts v={DIAGRAMS} value={verdicts[DIAGRAMS.id]} onJudge={judge} />
        </section>

        <p className="mt-10 text-[13px] text-neutral-400">
          Thumbnails missing? Run <code>node scripts/designs.mjs</code> with the API and dev server up.
        </p>
      </div>
    </main>
  );
}
