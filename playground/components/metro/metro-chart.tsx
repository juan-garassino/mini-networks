"use client";
// Edition "metro": the zoo as ONE transit system (Beck / Vignelli). The page
// composes the pieces: a phone header + key, the map in a frame that pans on a
// phone, the in-map cartouche on desktop, the under-construction list, and the
// through services. The drafting lives in layout.ts, the engine in system.ts,
// every value in tokens.ts, every mark in encoding.ts (DESIGN.md has the map).
import { useMemo, useRef, useState, type CSSProperties } from "react";
import type { TaxonomyResponse } from "@/lib/types";
import { useLabReady, useStill } from "@/lib/lab-contract";
import { useQueryFlag } from "./hooks";
import { Cartouche, PhoneKey } from "./key";
import { MetroLoading } from "./loading";
import { COLS, G, buildMetro, labelOf } from "./layout";
import { MetroMap } from "./map";
import { Services } from "./services";
import { SPACE } from "./tokens";

/** The knot (signature specimen, ?specimen=1): the blue arm's three interchanges with Perception. */
const SPECIMEN = { x: 4, y: 0.6, w: 42, h: 23 };
export const METRO_TITLE = "mini_networks transit";
const NOTE = "A line calls at its family and at every model built on it.";
/** Phone: the frame opens on the west side of the knot (vit / sam), not on blank margin. */
const PHONE_START_X = 3 * G;
function openOnTheKnot(el: HTMLDivElement | null) {
  if (el && el.scrollWidth > el.clientWidth + 1 && el.scrollLeft === 0) {
    el.scrollLeft = PHONE_START_X * (el.scrollWidth / (COLS * G));
  }
}

export function ChartMetro({ taxonomy, onSelect, offline = false }: {
  taxonomy: TaxonomyResponse | null;
  onSelect: (name: string) => void;
  /** the API refused the last request (the caller retries) */
  offline?: boolean;
}) {
  const layout = useMemo(() => (taxonomy ? buildMetro(taxonomy) : null), [taxonomy]);
  const [lit, setLit] = useState<string[] | null>(null);
  const specimen = useQueryFlag("specimen");
  // the lab contract (lib/lab-contract.ts): the edition has no entrance of its
  // own, so it is ready once the map is laid out, its face is in, the page's
  // sheet transition has finished and the map has painted
  const still = useStill();
  const rootRef = useRef<HTMLDivElement>(null);
  const drawn = useLabReady(!!layout, rootRef) === "1";
  // until the taxonomy is in: transit's own loading surface (loading.tsx)
  if (!taxonomy || !layout) return <MetroLoading phase={offline ? "offline" : "api"} title={METRO_TITLE} />;
  const live = !still;

  if (specimen) {
    return (
      <div ref={rootRef} className="h-full overflow-auto p-4 sm:p-8">
        <MetroMap layout={layout} onSelect={onSelect} lit={null} live={live} view={SPECIMEN} className="w-full" ready={drawn} />
      </div>
    );
  }

  const services = taxonomy.compositions.map((c) => ({ id: c.name, label: labelOf(c.name), calls: c.composes }));
  return (
    <div ref={rootRef} className="h-full overflow-y-auto overflow-x-hidden">
      <div className="mx-auto px-4 pb-10 pt-3 sm:px-6" style={{ maxWidth: SPACE.maxWidth }}>
        {/* phone: the cartouche sits in the map's far corner, so title + key lead here */}
        <header className="pb-3 md:hidden">
          <h1 className="text-[22px] font-semibold leading-tight text-ink">{METRO_TITLE}</h1>
          <p className="mt-1 text-[13px] leading-snug text-ink-dim">
            {layout.stations.length} stations on {layout.lines.length} lines. Change at a ring. Swipe the map sideways to ride east.
          </p>
        </header>
        <PhoneKey layout={layout} />

        {/* phone: the frame pans; its sides fade (SPACE.frameFade) so a name
            running off the frame dims away instead of being cut mid-letter */}
        <div ref={openOnTheKnot} className="metro-frame -mx-4 overflow-x-auto overflow-y-hidden px-4 md:mx-0 md:overflow-visible md:px-0 [mask-image:var(--frame-fade)] md:[mask-image:none]"
          style={{ ["--frame-fade" as string]: `linear-gradient(to right, transparent, #000 ${SPACE.frameFade}px, #000 calc(100% - ${SPACE.frameFade}px), transparent)` } as CSSProperties}>
          <MetroMap layout={layout} onSelect={onSelect} lit={lit} live={live} ready={drawn}
            className="metro-map block h-auto w-full md:max-h-[calc(100dvh-112px)]" minWidth={SPACE.phoneMinWidth}>
            <Cartouche layout={layout} title={METRO_TITLE} note={NOTE} />
          </MetroMap>
        </div>

        {layout.unplaced.length > 0 && (
          <p className="mt-4 text-[13px] text-ink-dim">
            Under construction (no free cell on its line yet):{" "}
            {layout.unplaced.map((n) => (
              <button key={n} onClick={() => onSelect(n)} className="mr-2 text-ink underline decoration-line-faint underline-offset-2">{labelOf(n)}</button>
            ))}
          </p>
        )}

        <Services layout={layout} services={services} onSelect={onSelect} onLight={setLit} />
      </div>
    </div>
  );
}
