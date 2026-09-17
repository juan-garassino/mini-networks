"use client";

// The Network Atlas — a full-screen editorial constellation of the 44-model
// relationship graph, distinct from the "/" periodic-table editions. Full-bleed
// (fixed inset-0) so it escapes the framed chart shell in the root layout.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getTaxonomy } from "@/lib/api";
import type { TaxonomyResponse } from "@/lib/types";
import { computeAtlas } from "@/components/atlas/layout";
import { AtlasGraph } from "@/components/atlas/graph";
import { AtlasDetail } from "@/components/atlas/detail";
import { AtlasLegend, AtlasTimeline, AtlasTitle } from "@/components/atlas/legend";
import { ATLAS_INK, ATLAS_INK_DIM, ATLAS_PAPER } from "@/components/atlas/theme";

const W = 1600;
const H = 1000;

export default function AtlasPage() {
  const [tax, setTax] = useState<TaxonomyResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = () => {
      getTaxonomy()
        .then((t) => { if (alive) setTax(t); })
        .catch(() => { if (alive) timer = setTimeout(load, 3000); });
    };
    load();
    return () => { alive = false; clearTimeout(timer); };
  }, []);

  const layout = useMemo(() => (tax ? computeAtlas(tax, W, H) : null), [tax]);
  const selNode = selected && layout ? layout.byName.get(selected) ?? null : null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden"
      style={{ background: ATLAS_PAPER, backgroundImage: "radial-gradient(ellipse at 50% 40%, #f7f3ea, #e9e2d1)" }}>
      {/* top nav (light, decorative) */}
      <nav className="pointer-events-none absolute inset-x-0 top-8 z-10 flex justify-center">
        <div className="flex items-center gap-7 text-[11px] uppercase tracking-[0.16em]"
          style={{ color: ATLAS_INK_DIM, fontFamily: "var(--font-jost), sans-serif" }}>
          <span style={{ color: ATLAS_INK }}>Map</span><span>List</span><span>Stories</span><span>Compare</span>
        </div>
      </nav>
      <Link href="/" className="absolute right-8 top-8 z-10 text-[11px] uppercase tracking-[0.16em] hover:underline"
        style={{ color: ATLAS_INK_DIM, fontFamily: "var(--font-jost), sans-serif" }}>
        ← periodic table
      </Link>

      {layout ? (
        <>
          <div className="absolute inset-0 flex items-center justify-center px-4 pb-16 pt-24">
            <div className="aspect-[1600/1000] max-h-full w-full max-w-[1700px]">
              <AtlasGraph layout={layout} W={W} H={H} selected={selected} onSelect={setSelected} />
            </div>
          </div>
          <AtlasTitle />
          <AtlasLegend />
          <AtlasTimeline models={tax!.models.length} edges={layout.edges.filter((e) => e.type === "derives").length} />
          <AtlasDetail node={selNode} layout={layout} onSelect={setSelected} />
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-[12px] uppercase tracking-[0.3em]"
          style={{ color: ATLAS_INK_DIM, fontFamily: "var(--font-jost), sans-serif" }}>
          charting the network…
        </div>
      )}
    </div>
  );
}
