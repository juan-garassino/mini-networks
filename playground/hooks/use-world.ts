"use client";

// Everything a lib/world skin needs, in one hook: the live data (useLabData:
// taxonomy + runs + evidence + family, polled unless still=1) and the two
// deterministic layouts built from them (lib/world). Designs that never paint
// lib/world (the painted maps) use useLabData and skip the ~1 s layout build.
import { useMemo } from "react";
import { buildFlow, buildWorld } from "@/lib/world";
import { NEXT_ERA, RUINS } from "@/components/lab/shared/eggs";
import { useLabData } from "./use-lab-data";

// Secret islands: next-era silhouettes and retired legacy/ models (eggs data).
const WORLD_OPTS = { hidden: NEXT_ERA.map((m) => m.id), ruins: RUINS.map((r) => r.id) };

export function useWorld(still: boolean | null, preset: "pixel" | "paper" = "pixel") {
  const data = useLabData(still);
  const { taxonomy, family } = data;
  const world = useMemo(() => (taxonomy && family ? buildWorld(taxonomy, family, { ...WORLD_OPTS, preset }) : null), [taxonomy, family, preset]);
  const flow = useMemo(() => (taxonomy && family ? buildFlow(taxonomy, family) : null), [taxonomy, family]);

  return {
    ...data, world, flow,
    // true once taxonomy + first runs/evidence answers are in and laid out —
    // skins set data-lab-ready only after this AND their own first draw.
    ready: Boolean(data.ready && world && flow),
  };
}
