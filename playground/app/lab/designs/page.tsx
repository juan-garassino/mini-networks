"use client";

// /lab/designs — the design board: eight designs, one layout idea and one
// shared component (lib/designs.ts), fifteen pages in all, each judged keep or
// drop on its own. Designs with several variants are full-width bands; the
// single-page designs share one grid; the extras close the board. The contact
// strip up top is one mark per page in board order, coloured by its verdict.
// Thumbnails come from public/local/designs/<id>.jpg + shots.json (node
// scripts/designs.mjs; local, gitignored). Verdicts are remembered in this
// browser and posted to the feedback inbox (skin "designs") so the agent
// reads them too.
import { useEffect, useState } from "react";
import { postFeedback } from "@/lib/api";
import { ALL_VARIANTS, DESIGNS, DIAGRAMS, type Variant } from "@/lib/designs";

type Verdict = "keep" | "drop";
type Shots = Record<string, { at: string; ready: boolean }>;
const KEY = "mn-design-verdicts";

// One palette for the whole board: a cool light-table, white mats, and two
// pastel verdict colours that stay quiet until a verdict is given.
const TOKENS = {
  "--board": "#eceeec",
  "--mat": "#ffffff",
  "--ink": "#1d2125",
  "--muted": "#5b6268",
  "--faint": "#8a9196",
  "--rule": "#d3d8d6",
  "--keep": "#3d7653",
  "--keep-bg": "#dcebe0",
  "--drop": "#9c4447",
  "--drop-bg": "#f3dcdc",
  "--open": "#c3c9cb",
} as React.CSSProperties;

const SINGLES = DESIGNS.filter((d) => d.variants.length === 1 && d.kind === "design");
const BANDS = DESIGNS.filter((d) => d.variants.length > 1);
const LAYOUTS = DESIGNS.filter((d) => d.kind === "layout");
const PAGE_COUNT = ALL_VARIANTS.length;
const DESIGN_COUNT = DESIGNS.filter((d) => d.kind === "design").length;
const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** Board order, grouped: the contact strip and the page read in the same order. */
const GROUPS: { id: string; variants: Variant[] }[] = [
  ...BANDS.map((d) => ({ id: d.id, variants: d.variants })),
  { id: "singles", variants: SINGLES.map((d) => d.variants[0]) },
  { id: "extras", variants: [...LAYOUTS.map((d) => d.variants[0]), DIAGRAMS] },
];

const cap = (w: string) => w[0].toUpperCase() + w.slice(1);
// one string, so no JSX whitespace between the counts and the words can be lost
const INTRO = `${cap(words[DESIGN_COUNT])} designs, one layout idea and the shared diagrams: ${PAGE_COUNT} pages in all. `
  + "Open each one, then keep it or drop it. Your verdicts stay in this browser and go to the agent\u2019s inbox.";

function load(): Record<string, Verdict> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
}

const thumbSrc = (id: string, shots: Shots) => `/local/designs/${id}.jpg${shots[id] ? `?v=${encodeURIComponent(shots[id].at)}` : ""}`;

function Thumb({ v, shots, verdict, small = false }: { v: Variant; shots: Shots; verdict?: Verdict; small?: boolean }) {
  const [missing, setMissing] = useState(false);
  return (
    <div className="relative aspect-[16/10] overflow-hidden bg-[var(--board)]" style={{ borderRadius: small ? 2 : 3 }}>
      {missing ? (
        !small && <p className="absolute inset-0 grid place-items-center p-4 text-center text-[14px] text-[var(--faint)]">No thumbnail yet</p>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- local, gitignored thumbnail
        <img src={thumbSrc(v.id, shots)} alt="" loading={small ? "eager" : "lazy"} decoding="async"
          className="block h-full w-full object-cover object-top"
          style={verdict === "drop" ? { filter: "grayscale(0.9)", opacity: 0.5 } : undefined}
          onError={() => setMissing(true)} />
      )}
    </div>
  );
}

function Mark({ kind }: { kind: Verdict }) {
  return kind === "keep" ? (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ) : (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  );
}

function Verdicts({ v, value, onJudge }: { v: Variant; value: Verdict | undefined; onJudge: (v: Variant, x: Verdict) => void }) {
  return (
    <div role="group" aria-label={`Verdict for ${v.name}`} className="flex h-10 flex-none overflow-hidden rounded-md border border-[var(--rule)] max-sm:w-full">
      {(["keep", "drop"] as const).map((x) => {
        const on = value === x;
        return (
          <button key={x} type="button" onClick={() => onJudge(v, x)} aria-pressed={on}
            className="flex min-w-[88px] items-center justify-center gap-1.5 px-3.5 text-[14px] font-semibold focus-visible:relative focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ink)] max-sm:flex-1 [&+&]:border-l [&+&]:border-[var(--rule)]"
            style={{
              background: on ? `var(--${x})` : "var(--mat)",
              color: on ? "#fff" : `var(--${x})`,
            }}>
            <Mark kind={x} />{x === "keep" ? (on ? "Kept" : "Keep") : (on ? "Dropped" : "Drop")}
          </button>
        );
      })}
    </div>
  );
}

function Card({ v, title, pitch, note, shots, verdict, onJudge }: {
  v: Variant; title: string; pitch: string; note?: string; shots: Shots;
  verdict: Verdict | undefined; onJudge: (v: Variant, x: Verdict) => void;
}) {
  return (
    <article id={`v-${v.id}`} className="flex scroll-mt-6 flex-col rounded-lg bg-[var(--mat)] p-2.5"
      style={{ boxShadow: verdict ? `0 0 0 2px var(--${verdict})` : "0 0 0 1px var(--rule)" }}>
      <a href={v.href} aria-label={`Open ${title}`} className="block rounded-[3px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]">
        <Thumb v={v} shots={shots} verdict={verdict} />
      </a>
      <div className="flex flex-1 flex-col gap-3 px-1.5 pb-1 pt-3.5">
        <div className="min-w-0">
          {note && <p className="text-[13px] text-[var(--faint)]">{note}</p>}
          <h3 className="text-[18px] font-semibold leading-snug">
            <a href={v.href} className="hover:underline focus-visible:outline-2 focus-visible:outline-[var(--ink)]">{title}</a>
          </h3>
          <p className="mt-0.5 max-w-[56ch] text-[15px] leading-[1.45] text-[var(--muted)]">{pitch}</p>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Verdicts v={v} value={verdict} onJudge={onJudge} />
          <a href={v.href} className="text-[14px] text-[var(--muted)] underline decoration-[var(--rule)] underline-offset-4 hover:text-[var(--ink)] hover:decoration-current max-sm:hidden">Open page</a>
        </div>
      </div>
    </article>
  );
}

function SectionHead({ title, pitch, count }: { title: string; pitch: string; count: string }) {
  return (
    <header className="mb-4 border-t border-[var(--rule)] pt-5">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-[26px] font-semibold leading-tight tracking-[-0.01em]">{title}</h2>
        <span className="text-[15px] text-[var(--faint)]">{count}</span>
      </div>
      <p className="mt-1 max-w-[64ch] text-[16px] leading-[1.45] text-[var(--muted)]">{pitch}</p>
    </header>
  );
}

export default function DesignsPage() {
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [shots, setShots] = useState<Shots>({});
  const [sent, setSent] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage only exists after mount
    setVerdicts(load());
    fetch("/local/designs/shots.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : {})).then(setShots).catch(() => {});
  }, []);

  const judge = (v: Variant, x: Verdict) => {
    const next = { ...verdicts };
    if (next[v.id] === x) delete next[v.id]; else next[v.id] = x;
    setVerdicts(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
    const word = next[v.id] ?? "undecided";
    const said = next[v.id] === "keep" ? "kept" : next[v.id] === "drop" ? "dropped" : "back to undecided";
    postFeedback({ skin: "designs", url: window.location.href, text: `verdict: ${v.id} (${v.name}) → ${word}`, viewport: [window.innerWidth, window.innerHeight], images: [] })
      .then(() => setSent(`${v.name} ${said}. Sent to the inbox.`))
      .catch(() => setSent(`${v.name} ${said}. Saved in this browser only: the API is offline.`));
  };

  const kept = ALL_VARIANTS.filter((v) => verdicts[v.id] === "keep").length;
  const dropped = ALL_VARIANTS.filter((v) => verdicts[v.id] === "drop").length;
  const open = PAGE_COUNT - kept - dropped;
  const shotTimes = Object.values(shots).map((s) => Date.parse(s.at)).filter(Number.isFinite);
  const oldest = shotTimes.length ? new Date(Math.min(...shotTimes)) : null;
  const card = (v: Variant, title = v.name, pitch = v.pitch, note?: string) => (
    <Card key={v.id} v={v} title={title} pitch={pitch} note={note} shots={shots} verdict={verdicts[v.id]} onJudge={judge} />
  );

  return (
    <main className="h-full overflow-y-auto bg-[var(--board)] font-[family-name:var(--font-jost)] text-[var(--ink)]" style={TOKENS}>
      <div className="mx-auto max-w-[1320px] px-4 pb-16 pt-10 sm:px-8 sm:pt-14">
        <header className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[48px]">Design board</h1>
            <p className="mt-3 max-w-[60ch] text-[17px] leading-[1.5] text-[var(--muted)]">
              {INTRO}
            </p>
          </div>
          <dl className="flex gap-7 text-[15px]" aria-label="Verdicts so far">
            {([["Kept", kept, "var(--keep)"], ["Dropped", dropped, "var(--drop)"], ["To judge", open, "var(--ink)"]] as const).map(([label, n, c]) => (
              <div key={label} className="flex flex-col-reverse">
                <dt className="mt-1 text-[var(--muted)]">{label}</dt>
                <dd className="text-[34px] font-semibold leading-none tabular-nums" style={{ color: c }}>{n}</dd>
              </div>
            ))}
          </dl>
        </header>

        {/* contact strip: one mark per page, grouped as the board is, coloured by verdict */}
        <nav aria-label="Every page on the board" className="mt-8 flex flex-wrap gap-x-4 gap-y-3 rounded-lg sm:gap-x-5 lg:justify-between bg-[var(--mat)] p-3 shadow-[0_0_0_1px_var(--rule)]">
          {GROUPS.map((g) => (
            <ul key={g.id} className="flex gap-1 sm:gap-1.5">
              {g.variants.map((v) => {
                const vd = verdicts[v.id];
                return (
                  <li key={v.id} className="w-[44px] sm:w-[68px]">
                    <a href={`#v-${v.id}`} title={`${v.name}: ${vd === "keep" ? "kept" : vd === "drop" ? "dropped" : "to judge"}`}
                      className="block rounded-[3px] p-[2px] focus-visible:outline-2 focus-visible:outline-[var(--ink)]"
                      style={{ boxShadow: `inset 0 0 0 2px ${vd ? `var(--${vd})` : "transparent"}` }}>
                      <Thumb v={v} shots={shots} verdict={vd} small />
                    </a>
                    <span aria-hidden="true" className="mx-auto mt-1 block h-[3px] w-full rounded-full" style={{ background: vd ? `var(--${vd})` : "var(--open)" }} />
                  </li>
                );
              })}
            </ul>
          ))}
        </nav>
        <p aria-live="polite" className="mt-2 min-h-[22px] text-[14px] text-[var(--muted)]">{sent}</p>

        <div className="mt-8 space-y-12">
          {BANDS.map((d) => (
            <section key={d.id} aria-label={d.name}>
              <SectionHead title={d.name} pitch={d.pitch} count={`${words[d.variants.length]} variants`} />
              <div className={`grid gap-4 sm:grid-cols-2 sm:gap-5 ${d.variants.length === 3 ? "lg:grid-cols-3" : ""}`}>
                {d.variants.map((v) => card(v))}
              </div>
            </section>
          ))}

          <section aria-label="Single-page designs">
            <SectionHead title="Single-page designs" pitch="Each of these is one page with its own idea." count={`${words[SINGLES.length]} designs`} />
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
              {SINGLES.map((d) => card(d.variants[0], d.name, d.pitch))}
            </div>
          </section>

          <section aria-label="Also on the board">
            <SectionHead title="Also on the board" pitch="Not whole designs: a layout the maps could borrow, and the diagrams every map's card opens." count="two pages" />
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
              {LAYOUTS.map((d) => card(d.variants[0], d.name, d.pitch, "A layout idea"))}
              {card(DIAGRAMS, DIAGRAMS.name, DIAGRAMS.pitch, "A shared component")}
            </div>
          </section>
        </div>

        <footer className="mt-14 border-t border-[var(--rule)] pt-4 text-[14px] leading-[1.5] text-[var(--faint)]">
          {oldest
            ? <>Thumbnails shot {oldest.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}. </>
            : <>No thumbnail record yet. </>}
          To shoot them again, run <code className="text-[var(--muted)]">node scripts/designs.mjs</code> in playground/ with the dev server and API running.
        </footer>
      </div>
    </main>
  );
}
