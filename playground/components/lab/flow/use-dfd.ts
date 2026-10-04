"use client";

// The sheet for the live taxonomy: names are measured in the real face (M PLUS
// Rounded 1c 700, read from the --flow-body variable once the font has loaded),
// then lib/world/dfd.ts lays out the grid and routes every edge. The router is
// the expensive part (≈1 s on a slow machine), so it runs once per taxonomy and
// mode, on an idle frame after the first paint.
import { useEffect, useMemo, useState } from "react";
import type { TaxonomyResponse } from "@/lib/types";
import type { FamilyMap } from "@/lib/world";
import { buildDfd, type DfdLayout, type DfdMode } from "@/lib/world/dfd";

type Measure = (t: string, px: number) => number;

export function useFlowFont(): Measure | null {
  const [measure, setMeasure] = useState<Measure | null>(null);
  useEffect(() => {
    let alive = true;
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;font-family:var(--flow-body)";
    (document.querySelector("[data-flow-root]") ?? document.body).appendChild(probe);
    const family = getComputedStyle(probe).fontFamily;
    probe.remove();
    const ctx = document.createElement("canvas").getContext("2d");
    const done = () => {
      if (!alive) return;
      setMeasure(() => (t: string, px: number) => {
        if (!ctx) return t.length * px * 0.6;
        ctx.font = `700 ${px}px ${family}`;
        return ctx.measureText(t).width;
      });
    };
    document.fonts.load(`700 13px ${family}`).then(() => document.fonts.ready).then(done, done);
    return () => { alive = false; };
  }, []);
  return measure;
}

const cache = new Map<string, DfdLayout>();

export function useDfd(taxonomy: TaxonomyResponse | null, family: FamilyMap | null, mode: DfdMode | null, measure: Measure | null) {
  const key = useMemo(() => (taxonomy && mode ? `${mode}:${JSON.stringify(taxonomy.models.map((m) => [m.name, m.builds_on]))}` : null), [taxonomy, mode]);
  const [layout, setLayout] = useState<DfdLayout | null>(null);
  useEffect(() => {
    if (!taxonomy || !family || !mode || !measure || !key || cache.has(key)) return;
    // let the "drawing the sheet" state paint first, then route
    const t = setTimeout(() => {
      const l = buildDfd(taxonomy, family, { mode, measure });
      cache.set(key, l);
      setLayout(l);
    }, 30);
    return () => clearTimeout(t);
  }, [taxonomy, family, mode, measure, key]);
  const hit = key ? cache.get(key) : undefined;
  if (hit) return hit;
  return layout && layout.mode === mode ? layout : null;
}
