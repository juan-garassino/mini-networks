"use client";

// /lab/designs — every design on its own card, to keep or to drop. Thumbnails
// come from public/local/designs/<id>.jpg (node scripts/designs.mjs; local,
// gitignored). A verdict is remembered in this browser and posted to the
// feedback inbox (skin "designs") so the agent reads it too.
import { useEffect, useState } from "react";
import { postFeedback } from "@/lib/api";
import { DESIGNS, DESIGN_GROUPS, type Design } from "@/lib/designs";

type Verdict = "keep" | "drop";
const KEY = "mn-design-verdicts";

function load(): Record<string, Verdict> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
}

export default function DesignsPage() {
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [sent, setSent] = useState<string | null>(null);
  useEffect(() => { setVerdicts(load()); }, []);

  const judge = (d: Design, v: Verdict) => {
    const next = { ...verdicts };
    if (next[d.id] === v) delete next[d.id]; else next[d.id] = v;
    setVerdicts(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
    const word = next[d.id] ?? "undecided";
    postFeedback({ skin: "designs", url: window.location.href, text: `verdict: ${d.id} (${d.name}) → ${word}`, viewport: [window.innerWidth, window.innerHeight], images: [] })
      .then(() => setSent(`${d.name}: ${word}`)).catch(() => setSent(`${d.name}: ${word} (saved here only, API offline)`));
  };

  const kept = DESIGNS.filter((d) => verdicts[d.id] === "keep").map((d) => d.name);
  const dropped = DESIGNS.filter((d) => verdicts[d.id] === "drop").map((d) => d.name);

  return (
    <main className="h-full overflow-y-auto bg-[#f6f3ec] text-neutral-900">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Every design, apart</h1>
            <p className="mt-1 max-w-prose text-[15px] text-neutral-600">
              {DESIGNS.length} designs across the classic playground and the lab. Open any one in full, then keep it or drop it.
            </p>
          </div>
          <div className="text-[14px] text-neutral-600">
            {kept.length > 0 && <p><b className="text-emerald-800">Keep:</b> {kept.join(", ")}</p>}
            {dropped.length > 0 && <p><b className="text-rose-800">Drop:</b> {dropped.join(", ")}</p>}
            {sent && <p className="text-neutral-400" aria-live="polite">sent: {sent}</p>}
          </div>
        </header>

        {DESIGN_GROUPS.map((g) => {
          const items = DESIGNS.filter((d) => d.group === g);
          return (
            <section key={g} aria-label={g} className="mt-10">
              <h2 className="text-lg font-semibold">{g}</h2>
              <ul className="mt-3 grid gap-5 sm:grid-cols-2">
                {items.map((d) => {
                  const v = verdicts[d.id];
                  return (
                    <li key={d.id} className="overflow-hidden rounded-lg bg-white shadow-[0_1px_0_rgba(0,0,0,.08),0_8px_24px_-16px_rgba(0,0,0,.35)]"
                      style={{ outline: v === "keep" ? "3px solid #047857" : v === "drop" ? "3px solid #be123c" : "1px solid #ddd", opacity: v === "drop" ? 0.55 : 1 }}>
                      <a href={d.href} className="block aspect-[16/10] bg-neutral-100 focus-visible:outline-2" aria-label={`Open ${d.name}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- local thumbnail */}
                        <img src={`/local/designs/${d.id}.jpg`} alt="" className="block h-full w-full object-cover object-top"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
                      </a>
                      <div className="flex items-start justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <a href={d.href} className="text-[17px] font-semibold hover:underline">{d.name}</a>
                          <p className="mt-0.5 text-[14px] text-neutral-600">{d.pitch}</p>
                          <p className="mt-1 truncate font-mono text-[12px] text-neutral-400">{d.href}</p>
                        </div>
                        <div className="flex flex-none gap-1.5">
                          <button type="button" onClick={() => judge(d, "keep")} aria-pressed={v === "keep"}
                            className="rounded px-2.5 py-1 text-[14px] font-medium focus-visible:outline-2"
                            style={{ background: v === "keep" ? "#047857" : "#ecfdf5", color: v === "keep" ? "#fff" : "#065f46" }}>Keep</button>
                          <button type="button" onClick={() => judge(d, "drop")} aria-pressed={v === "drop"}
                            className="rounded px-2.5 py-1 text-[14px] font-medium focus-visible:outline-2"
                            style={{ background: v === "drop" ? "#be123c" : "#fff1f2", color: v === "drop" ? "#fff" : "#9f1239" }}>Drop</button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        <p className="mt-10 text-[13px] text-neutral-400">
          Thumbnails missing? Run <code>node scripts/designs.mjs</code> with the API and dev server up.
        </p>
      </div>
    </main>
  );
}
