"use client";

// Everything a lab skin needs, in one hook: live taxonomy + runs + evidence,
// and the two deterministic layouts built from them (lib/world). Retries until
// the API answers; polls runs/evidence every 5s unless still=1 (screenshots
// must not change under the camera).
import { useEffect, useMemo, useState } from "react";
import { getEvidence, getTaxonomy, listRuns } from "@/lib/api";
import type { ModelEvidence, RunSummary, TaxonomyResponse } from "@/lib/types";
import { buildFlow, buildWorld, familyMapFromBlueprint } from "@/lib/world";

const POLL_MS = 5000;

export function useWorld(still: boolean | null) {
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
  const world = useMemo(() => (taxonomy && family ? buildWorld(taxonomy, family) : null), [taxonomy, family]);
  const flow = useMemo(() => (taxonomy && family ? buildFlow(taxonomy, family) : null), [taxonomy, family]);

  return {
    taxonomy, runs, evidence, family, world, flow, online,
    // true once taxonomy + first runs/evidence answers are in — skins set
    // data-lab-ready only after this AND their own first draw.
    ready: Boolean(world && flow && live.runs && live.evidence),
  };
}
