"use client";

// The live data every lab design reads, without any layout: taxonomy + runs +
// evidence + the family map. Retries until the API answers; polls runs/evidence
// every 5s unless still=1 (screenshots must not change under the camera).
// Designs that draw their own map (the painted pixel/paper maps) read this
// directly; useWorld adds the lib/world layouts (~1 s of main-thread work on
// the owner's Mac) on top for the skins that paint lib/world.
import { useEffect, useMemo, useState } from "react";
import { getEvidence, getTaxonomy, listRuns } from "@/lib/api";
import type { ModelEvidence, RunSummary, TaxonomyResponse } from "@/lib/types";
// the module itself, not the "@/lib/world" barrel: no layout code in the bundle
import { familyMapFromBlueprint } from "@/lib/world/graph";

const POLL_MS = 5000;

export function useLabData(still: boolean | null) {
  const [taxonomy, setTaxonomy] = useState<TaxonomyResponse | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [evidence, setEvidence] = useState<ModelEvidence[]>([]);
  const [live, setLive] = useState<{ runs: boolean; evidence: boolean }>({ runs: false, evidence: false });
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = () => {
      getTaxonomy()
        .then((t) => { if (alive) { setTaxonomy(t); setOnline(true); } })
        .catch(() => { if (alive) { setOnline(false); timer = setTimeout(load, 3000); } });
    };
    load();
    return () => { alive = false; clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (still === null) return;          // view not parsed yet
    let alive = true;
    const tick = () => {
      listRuns().then((d) => { if (alive) { setRuns(d.runs); setLive((l) => ({ ...l, runs: true })); } }).catch(() => {});
      getEvidence().then((d) => { if (alive) { setEvidence(d.models); setLive((l) => ({ ...l, evidence: true })); } }).catch(() => {});
    };
    tick();
    const id = still ? undefined : setInterval(tick, POLL_MS);
    return () => { alive = false; if (id) clearInterval(id); };
  }, [still]);

  const family = useMemo(() => (taxonomy ? familyMapFromBlueprint(taxonomy) : null), [taxonomy]);

  return {
    taxonomy, runs, evidence, family, online,
    // true once taxonomy + first runs/evidence answers are in
    ready: Boolean(family && live.runs && live.evidence),
  };
}
