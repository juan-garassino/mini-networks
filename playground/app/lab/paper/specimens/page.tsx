"use client";

// /lab/paper/specimens — the paper art specimen sheet. Every asset of
// components/lab/paper/art on a neutral cutting-mat ground at 1× (its on-map
// size), 2× and 4×, plus a diorama that proves they harmonise.
//
//   ?group=setpieces,spots    only these groups (ids in art/catalog.tsx)
//   ?item=setpiece-perception only these items
//   ?scale=4                  only these scales (1,2,4)
//   ?view=diorama             only the diorama
//   ?still=1                  freeze the few animated specimens
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ArtDefs, CATALOG, ArtDiorama, type Specimen } from "@/components/lab/paper/art";

interface Query { groups: string[] | null; items: string[] | null; scales: number[]; view: "all" | "diorama" | "sheet"; still: boolean }

function parse(search: string): Query {
  const p = new URLSearchParams(search);
  const list = (k: string) => (p.get(k) ? p.get(k)!.split(",").map((s) => s.trim()).filter(Boolean) : null);
  const scales = (list("scale") ?? ["1", "2", "4"]).map(Number).filter((n) => n > 0);
  const v = p.get("view");
  return { groups: list("group"), items: list("item"), scales, view: v === "diorama" || v === "sheet" ? v : "all", still: p.get("still") === "1" };
}

const subscribe = (cb: () => void) => { window.addEventListener("popstate", cb); return () => window.removeEventListener("popstate", cb); };
const INK = "#2B2118";
const MAT = "#E4DFD3";

function Cell({ s, k, still }: { s: Specimen; k: number; still: boolean }) {
  const size = s.map * k;
  const scale = size / s.H;
  // room for the cast shadow (falls down-right, ~0.55 H across, 0.2 H down)
  const pad = 10 / scale + 6;
  const x0 = -s.W / 2 - pad, x1 = s.W / 2 + pad + s.H * 0.3;
  const y0 = -s.H - pad, y1 = pad + s.H * 0.12;
  const w = (x1 - x0) * scale, h = (y1 - y0) * scale;
  return (
    <figure className="m-0 flex min-w-0 max-w-full flex-col items-start gap-1.5">
      <svg width={Math.round(w)} height={Math.round(h)} viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} role="img" aria-label={`${s.name} at ${k}×`}
        style={{ background: "rgba(255,253,247,0.35)", borderRadius: 6, overflow: "visible", maxWidth: "100%", height: "auto" }}>
        {s.draw(s.H, still)}
      </svg>
      <figcaption className="text-[13px] text-[#5A4B3C]">{k}×, {Math.round(size)} px tall</figcaption>
    </figure>
  );
}

export default function PaperSpecimens() {
  // the query lives in the URL; static export has no server value (null → render nothing yet)
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => null);
  const q = useMemo(() => (search === null ? null : parse(search)), [search]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!q) return;
    let raf = 0;
    document.fonts.ready.then(() => { raf = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true))); });
    return () => cancelAnimationFrame(raf);
  }, [q]);

  const groups = useMemo(() => {
    if (!q) return [];
    return CATALOG.filter((g) => !q.groups || q.groups.includes(g.id))
      .map((g) => ({ ...g, items: g.items.filter((it) => !q.items || q.items.includes(it.id)) }))
      .filter((g) => g.items.length);
  }, [q]);

  return (
    <div data-lab-ready={ready ? "1" : undefined} className="h-full overflow-y-auto overflow-x-hidden"
      style={{
        background: `${MAT} linear-gradient(rgba(43,33,24,0.06) 1px, transparent 1px) 0 0 / 24px 24px, linear-gradient(90deg, rgba(43,33,24,0.06) 1px, transparent 1px) 0 0 / 24px 24px`,
        backgroundColor: MAT, color: INK, fontFamily: "var(--paper-body), ui-rounded, system-ui, sans-serif",
      }}>
      <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden><ArtDefs /></svg>
      {q && (
        <main className="mx-auto max-w-[1560px] px-4 py-8 sm:px-8">
          {q.view !== "diorama" && q.view !== "sheet" && !q.groups && !q.items && (
            <header className="mb-8 max-w-[70ch]">
              <h1 className="text-[40px] leading-none" style={{ fontFamily: "var(--paper-display), system-ui" }}>Paper art specimens</h1>
              <p className="mt-3 text-[16px] leading-relaxed text-[#5A4B3C]">
                Every asset in <code>components/lab/paper/art</code>, cut from paper and lit by one lamp at the top-left.
                1× is the size it takes on the map; 2× and 4× show the detail. The diorama at the end puts them on one board.
              </p>
            </header>
          )}
          {q.view !== "diorama" && groups.map((g) => (
            <section key={g.id} className="mb-12">
              <h2 className="text-[28px] leading-tight" style={{ fontFamily: "var(--paper-display), system-ui" }}>{g.title}</h2>
              <p className="mb-5 mt-1 max-w-[80ch] text-[15px] text-[#5A4B3C]">{g.note}</p>
              <div className="flex flex-wrap items-end gap-x-12 gap-y-10">
                {g.items.map((it) => (
                  <article key={it.id} className="min-w-0 max-w-full">
                    <h3 className="text-[17px] font-semibold">{it.name}</h3>
                    <p className="mb-2 text-[14px] text-[#5A4B3C]">{it.encodes}</p>
                    <div className="flex flex-wrap items-end gap-6">
                      {q.scales.map((k) => <Cell key={k} s={it} k={k} still={q.still} />)}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
          {(q.view === "diorama" || (q.view === "all" && !q.groups && !q.items)) && (
            <section className="mb-12">
              <h2 className="text-[28px] leading-tight" style={{ fontFamily: "var(--paper-display), system-ui" }}>Diorama</h2>
              <p className="mb-5 mt-1 max-w-[80ch] text-[15px] text-[#5A4B3C]">
                The assets together on a tilted ground patch with sea: the proof that one light, one rim and one palette hold.
              </p>
              <ArtDiorama still={q.still} />
            </section>
          )}
        </main>
      )}
    </div>
  );
}
