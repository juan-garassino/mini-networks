"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { motion } from "motion/react";
import { LabMotion, useStill, useStillParam } from "@/lib/lab-contract";
import { getTaxonomy } from "@/lib/api";
import {
  EDITION_IDS, EDITION_KEY, editionPaint, paintEdition, pickEdition,
  type EditionId, type SheetId,
} from "@/lib/editions";
import type { TaxonomyResponse } from "@/lib/types";
import { useRuns } from "@/hooks/use-runs";
import { TitleBlock } from "@/components/title-block";
import { ElementSheet } from "@/components/element-sheet";
import { PERIODIC_SKINS, isPeriodicSkin } from "@/components/periodic/skins";
import { PeriodicTable } from "@/components/periodic/periodic-table";
import { SheetTabs } from "@/components/periodic/sheet-tabs";
import { ChartMetro } from "@/components/metro/metro-chart";
import { MetroTabs } from "@/components/metro/tabs";
import { usePageTitle } from "@/components/metro/hooks";
import { pageTitle } from "@/lib/copy";
import { ChartAtlas } from "@/components/views/chart-atlas";
import { ChartPaper } from "@/components/views/chart-paper";
import { Reactions } from "@/components/views/reactions";
import { Observatory } from "@/components/views/observatory";

/** How long the page waits before asking a silent API again. */
const RETRY_MS = 3000;

const noSubscribe = () => () => {};
/** The edition this load opens on (?edition=, else the saved one); null on the server. */
function readInitialEdition(): EditionId {
  let saved: string | null = null;
  try { saved = localStorage.getItem(EDITION_KEY); } catch {}
  return pickEdition(window.location.search, saved);
}

// The classic editions at "/": the periodic table skins, transit and the atlas
// plates, switched in place (?edition=<id>). A client component; page.tsx
// beside it is the server shell that carries the route's metadata.
//
// Loading (lib/lab-contract.ts LOADING): the server cannot know ?edition, so
// it renders EVERY edition's loading shell, each under data-boot-for; the boot
// script in layout.tsx paints the chosen edition's tokens and shows only its
// shell before first paint. After hydration the page renders just that one.
export function Editions() {
  const [sheet, setSheet] = useState<SheetId>("chart");
  const [selected, setSelected] = useState<string | null>(null);
  const [taxonomy, setTaxonomy] = useState<TaxonomyResponse | null>(null);
  const [offline, setOffline] = useState(false);
  // null until hydrated (the boot shells are on screen), then the reader's pick
  const initial = useSyncExternalStore(noSubscribe, readInitialEdition, () => null);
  const [chosen, setChosen] = useState<EditionId | null>(null);
  const edition = initial && (chosen ?? initial);
  // a sheet slides in only when the reader switches; never on load
  const [switched, setSwitched] = useState(false);
  // the lab contract: no sheet entrance under still; ?still=1 also freezes the
  // blueprint.css loops via html[data-still]
  const still = useStill();
  const stillParam = useStillParam();
  const { runs, ok } = useRuns();

  useEffect(() => {
    // retry until the API answers — a tab opened before `serve` is up otherwise
    // shows an empty sheet forever; the loading line says it is retrying
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = () => {
      getTaxonomy()
        .then((t) => { if (alive) { setTaxonomy(t); setOffline(false); } })
        .catch(() => { if (alive) { setOffline(true); timer = setTimeout(load, RETRY_MS); } });
    };
    load();
    return () => { alive = false; clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (!stillParam) return;
    document.documentElement.setAttribute("data-still", "");
    return () => document.documentElement.removeAttribute("data-still");
  }, [stillParam]);

  useEffect(() => {
    if (!edition) return;
    const root = document.documentElement;
    root.setAttribute("data-edition", edition);
    try { localStorage.setItem(EDITION_KEY, edition); } catch {}
    // the boot script painted these already; painting again owns the undo
    return paintEdition(root, editionPaint(edition));
  }, [edition]);
  // transit names its own page ("/" is the periodic table's route, page.tsx)
  usePageTitle(edition === "metro" ? pageTitle("Transit") : null);

  const pickSheet = (s: SheetId) => { setSwitched(true); setSheet(s); };
  const pickEditionTo = (e: EditionId) => { setSwitched(true); setChosen(e); };

  /** An edition's chart sheet: each design draws its own loading surface until the taxonomy is in. */
  const chart = (id: EditionId): ReactNode =>
    isPeriodicSkin(id) ? <PeriodicTable taxonomy={taxonomy} skin={PERIODIC_SKINS[id]} onSelect={setSelected} offline={offline} />
    : id === "metro" ? <ChartMetro taxonomy={taxonomy} onSelect={setSelected} offline={offline} />
    : id === "atlas" ? <ChartAtlas taxonomy={taxonomy} onSelect={setSelected} />
    : <ChartPaper taxonomy={taxonomy} onSelect={setSelected} />;

  /** An edition's sheet row: its own tabs (periodic, transit), else the legacy title block. */
  const tabs = (id: EditionId): ReactNode =>
    isPeriodicSkin(id) ? <SheetTabs sheet={sheet} setSheet={pickSheet} editions={EDITION_IDS} edition={id} setEdition={pickEditionTo} offline={!ok} />
    : id === "metro" ? <MetroTabs sheet={sheet} setSheet={pickSheet} editions={EDITION_IDS} edition={id} setEdition={pickEditionTo} />
    : <TitleBlock sheet={sheet} setSheet={pickSheet} ok={ok} runCount={runs.length} edition={id} setEdition={pickEditionTo} />;

  if (!edition) {
    return (
      <LabMotion still>
        {EDITION_IDS.map((id) => (
          <div key={id} data-boot-for={id} className="contents">
            <main className="relative min-h-0"><div className="absolute inset-0">{chart(id)}</div></main>
            {tabs(id)}
          </div>
        ))}
      </LabMotion>
    );
  }

  return (
    <LabMotion still={still}>
      <main className="relative min-h-0">
        {/* Enter-only keyed remount. AnimatePresence mode="wait" froze to a blank
            sheet: the saved edition swaps the key right after hydration, the
            exit of the never-entered SSR child never completed, so the next
            sheet never mounted. */}
        <motion.div
          key={`${sheet}-${edition}`}
          className="absolute inset-0"
          initial={still || !switched ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {sheet === "chart" && chart(edition)}
          {sheet === "reactions" && (
            <Reactions taxonomy={taxonomy} runs={runs} onSelect={setSelected} />
          )}
          {sheet === "observatory" && (
            <Observatory runs={runs} onSelectModel={setSelected} />
          )}
        </motion.div>

        <ElementSheet
          name={selected}
          taxonomy={taxonomy}
          runs={runs}
          onSelect={setSelected}
          onClose={() => setSelected(null)}
        />
      </main>
      {tabs(edition)}
    </LabMotion>
  );
}
