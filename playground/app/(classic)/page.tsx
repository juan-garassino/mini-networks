"use client";

import { useEffect, useState } from "react";
import { MotionConfig, motion } from "motion/react";
import { getTaxonomy } from "@/lib/api";
import type { TaxonomyResponse } from "@/lib/types";
import { useRuns } from "@/hooks/use-runs";
import { TitleBlock, type EditionId, type SheetId } from "@/components/title-block";
import { ElementSheet } from "@/components/element-sheet";
import { PERIODIC_SKINS, applySkin, isPeriodicSkin } from "@/components/periodic/skins";
import { PeriodicTable } from "@/components/periodic/periodic-table";
import { ChartMetro, METRO_TITLE } from "@/components/metro/metro-chart";
import { MetroTabs } from "@/components/metro/tabs";
import { usePageTitle } from "@/components/metro/hooks";
import { applySheet as applyMetroSheet } from "@/components/metro/tokens";
import { ChartAtlas } from "@/components/views/chart-atlas";
import { ChartPaper } from "@/components/views/chart-paper";
import { Reactions } from "@/components/views/reactions";
import { Observatory } from "@/components/views/observatory";

const EDITION_IDS: EditionId[] = ["blueprint", "wallchart", "terminal", "metro", "atlas", "paper"];

export default function Page() {
  const [sheet, setSheet] = useState<SheetId>("chart");
  const [selected, setSelected] = useState<string | null>(null);
  const [taxonomy, setTaxonomy] = useState<TaxonomyResponse | null>(null);
  const [edition, setEdition] = useState<EditionId>("blueprint");
  const [still, setStill] = useState(false);
  const { runs, ok } = useRuns();

  useEffect(() => {
    // retry until the API answers — a tab opened before `serve` is up otherwise
    // shows an empty sheet forever
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = () => {
      getTaxonomy()
        .then((t) => { if (alive) setTaxonomy(t); })
        .catch(() => { if (alive) timer = setTimeout(load, 3000); });
    };
    load();
    // ?edition=<id> gives every edition its own link (the design gallery at
    // /lab/designs); otherwise the last chosen edition is remembered
    const fromUrl = new URLSearchParams(window.location.search).get("edition") as EditionId | null;
    const saved = localStorage.getItem("mn-edition") as EditionId | null;
    const pick = fromUrl && EDITION_IDS.includes(fromUrl) ? fromUrl : saved;
    if (pick) setEdition(pick);
    // ?still=1 freezes every loop for screenshots, as on the /lab skins
    if (new URLSearchParams(window.location.search).get("still") === "1") {
      document.documentElement.setAttribute("data-still", "");
      setStill(true);
    }
    return () => { alive = false; clearTimeout(timer); };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-edition", edition);
    localStorage.setItem("mn-edition", edition);
    // the periodic-table skins are token sets painted on <html>; the other
    // editions keep their [data-edition] blocks in blueprint.css and borrow
    // only the blueprint's tile tokens for the drawer's element tile
    if (isPeriodicSkin(edition)) return applySkin(document.documentElement, PERIODIC_SKINS[edition]);
    const undoTiles = applySkin(document.documentElement, PERIODIC_SKINS.blueprint, { tableOnly: true });
    // the transit sheet's colours live in components/metro/tokens.ts
    const undoSheet = edition === "metro" ? applyMetroSheet(document.documentElement) : () => {};
    return () => { undoTiles(); undoSheet(); };
  }, [edition]);
  // transit names its own page (the root title names the periodic table)
  usePageTitle(edition === "metro" ? METRO_TITLE : null);

  return (
    <MotionConfig reducedMotion={still ? "always" : "user"}>
      <main className="relative min-h-0">
        {/* Enter-only keyed remount. AnimatePresence mode="wait" froze to a blank
            sheet: the saved edition swaps the key right after hydration, the
            exit of the never-entered SSR child never completed, so the next
            sheet never mounted. */}
        <motion.div
          key={`${sheet}-${edition}`}
          className="absolute inset-0"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {sheet === "chart" && (
            isPeriodicSkin(edition) ? <PeriodicTable taxonomy={taxonomy} skin={PERIODIC_SKINS[edition]} onSelect={setSelected} />
            : edition === "metro" ? <ChartMetro taxonomy={taxonomy} onSelect={setSelected} />
            : edition === "atlas" ? <ChartAtlas taxonomy={taxonomy} onSelect={setSelected} />
            : <ChartPaper taxonomy={taxonomy} onSelect={setSelected} />
          )}
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
      {/* transit has its own title (the in-map cartouche) and a Jost tab row; the
          blueprint title block belongs to the editions without one */}
      {edition === "metro"
        ? <MetroTabs sheet={sheet} setSheet={setSheet} editions={EDITION_IDS} edition={edition} setEdition={setEdition} />
        : <TitleBlock sheet={sheet} setSheet={setSheet} ok={ok} runCount={runs.length} edition={edition} setEdition={setEdition} />}
    </MotionConfig>
  );
}
