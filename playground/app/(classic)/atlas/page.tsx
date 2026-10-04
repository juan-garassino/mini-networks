"use client";

// The Network Atlas — a full-screen editorial constellation of the 44-model
// relationship graph, distinct from the "/" periodic-table editions. Full-bleed
// (fixed inset-0) so it escapes the framed chart shell in the root layout.
// Desktop: key column | graph | detail rail (the graph re-fits when the rail
// opens). Phone: header, a sideways-panning graph strip, key, bottom-sheet rail.
// ?focus=<model> opens with that model selected; selection is mirrored back.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getTaxonomy } from "@/lib/api";
import type { TaxonomyResponse } from "@/lib/types";
import { computeAtlas } from "@/components/atlas/layout";
import { AtlasGraph } from "@/components/atlas/graph";
import { AtlasDetail } from "@/components/atlas/detail";
import { AtlasLegend, AtlasTitle } from "@/components/atlas/legend";
import { ATLAS_INK, ATLAS_INK_DIM, ATLAS_PAPER } from "@/components/atlas/theme";

const W = 1600;
const H = 1000;
const SANS = "var(--font-jost), sans-serif";

function NavLinks() {
  return (
    <nav aria-label="Other views" className="flex gap-5 text-[12px]" style={{ fontFamily: SANS, color: ATLAS_INK_DIM }}>
      <Link href="/?edition=atlas" className="underline-offset-4 hover:underline focus-visible:underline" style={{ color: ATLAS_INK }}>Atlas plates</Link>
      <Link href="/" className="underline-offset-4 hover:underline focus-visible:underline">Periodic table</Link>
    </nav>
  );
}

export default function AtlasPage() {
  const [tax, setTax] = useState<TaxonomyResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const focus = new URLSearchParams(window.location.search).get("focus");
    const load = () => {
      getTaxonomy()
        .then((t) => {
          if (!alive) return;
          setTax(t);
          if (focus && t.models.some((m) => m.name === focus)) setSelected(focus);
        })
        .catch(() => { if (alive) timer = setTimeout(load, 3000); });
    };
    load();
    return () => { alive = false; clearTimeout(timer); };
  }, []);

  const layout = useMemo(() => (tax ? computeAtlas(tax, W, H) : null), [tax]);
  const selNode = selected && layout ? layout.byName.get(selected) ?? null : null;

  // mirror the selection into ?focus= so a chosen model is a shareable link
  useEffect(() => {
    if (!layout) return;
    const url = new URL(window.location.href);
    if (selNode) url.searchParams.set("focus", selNode.name); else url.searchParams.delete("focus");
    window.history.replaceState(null, "", url);
  }, [selNode, layout]);

  // the phone strip opens centred on the transformer hub
  useEffect(() => {
    const el = strip.current;
    if (el && layout) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [layout]);

  // phones: the bottom sheet covers half the screen, so bring the chosen
  // model into the visible top half of the strip (pan + page scroll)
  useEffect(() => {
    const el = strip.current, pg = page.current;
    if (!el || !pg || !selNode || window.innerWidth >= 768) return;
    const k = el.scrollWidth / W;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      || new URLSearchParams(window.location.search).get("still") === "1";
    const behavior: ScrollBehavior = calm ? "auto" : "smooth";
    el.scrollTo({ left: selNode.x * k - el.clientWidth / 2, behavior });
    const stripTop = el.getBoundingClientRect().top - pg.getBoundingClientRect().top + pg.scrollTop;
    pg.scrollTo({ top: stripTop + selNode.y * k - window.innerHeight * 0.26, behavior });
  }, [selNode]);

  const counts = tax && layout ? {
    models: tax.models.length,
    links: layout.edges.filter((e) => e.type === "derives").length,
    pipelines: tax.compositions.length,
  } : null;

  return (
    <div ref={page} className="fixed inset-0 z-50 overflow-y-auto md:flex md:overflow-hidden"
      style={{ background: ATLAS_PAPER, backgroundImage: "radial-gradient(ellipse at 55% 45%, #f7f3ea, #e9e2d1)" }}>
      {/* key column */}
      <div className="flex flex-col gap-6 px-4 pb-4 pt-6 md:w-[248px] md:shrink-0 md:justify-between md:overflow-y-auto md:py-8 md:pl-8 md:pr-4">
        <div className="space-y-4">
          <AtlasTitle counts={counts} />
          <NavLinks />
        </div>
        <div className="hidden md:block"><AtlasLegend /></div>
      </div>

      {layout && tax ? (
        <>
          {/* graph */}
          <div className="relative min-w-0 md:flex-1">
            {/* one graph for both widths (two SVGs would share marker ids):
                a sideways-panning strip on phones, fitted beside the key on desktop */}
            <div ref={strip} className="overflow-x-auto border-y md:flex md:h-full md:items-center md:justify-center md:overflow-visible md:border-0 md:py-8 md:pr-6"
              style={{ borderColor: "#ddd5c4" }}>
              <div className="h-[690px] w-[1104px] md:aspect-[1600/1000] md:h-auto md:max-h-full md:w-full">
                <AtlasGraph layout={layout} W={W} H={H} selected={selected} onSelect={setSelected} />
              </div>
            </div>
            <div className="md:hidden">
              <p className="px-4 pt-2 text-[11px]" style={{ color: ATLAS_INK_DIM, fontFamily: SANS }}>
                Drag the map sideways to pan. Tap a model to read it.
              </p>
            </div>
          </div>
          <div className={`px-4 pt-6 md:hidden ${selNode ? "pb-[60vh]" : "pb-10"}`}><AtlasLegend /></div>
          {selNode && <AtlasDetail node={selNode} layout={layout} taxonomy={tax} onSelect={setSelected} />}
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center py-24 text-[13px]"
          style={{ color: ATLAS_INK_DIM, fontFamily: SANS }}>
          Charting the network. Waiting for the API on :8000.
        </div>
      )}
    </div>
  );
}
