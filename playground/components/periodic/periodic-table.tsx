"use client";

import { useRef } from "react";
import type { TaxonomyResponse } from "@/lib/types";
import { atomicNumbers } from "@/lib/blueprint";
import { ChartKey } from "./chart-key";
import { useLabReady, useStill } from "@/lib/lab-contract";
import { entranceEnd } from "./entrance";
import { FamilyStack } from "./family-stack";
import { Masthead } from "./masthead";
import { placeModels, placeReactions } from "./placed";
import { ReactionBlock } from "./reaction-block";
import type { PeriodicSkin } from "./skins";
import { TableGrid, keyFitsBay } from "./table-grid";

// The periodic table sheet: one structure for every skin. The skin's look
// arrives as CSS vars on <html> (skins/index.ts applySkin); this component
// only reads the skin's motion timings and masthead variant. Under still (the lab
// contract) nothing enters; data-lab-ready waits for the entrance (entrance.ts).
export function PeriodicTable({
  taxonomy, skin, onSelect,
}: {
  taxonomy: TaxonomyResponse | null;
  skin: PeriodicSkin;
  onSelect: (name: string) => void;
}) {
  const frozen = useStill();
  const ref = useRef<HTMLDivElement>(null);
  const models = taxonomy ? placeModels(taxonomy) : [];
  const reactions = taxonomy ? placeReactions(taxonomy) : [];
  const motion = frozen ? null : skin.motion;
  const end = motion ? entranceEnd(motion, Math.max(1, ...models.map((m) => m.row)), Math.max(1, ...models.map((m) => m.col)), reactions.length) : 0;
  const ready = useLabReady(!!taxonomy, ref, end * 1000);
  if (!taxonomy) {
    return (
      <div className="pt-sheet pt-loading" role="status">
        Loading the models…
      </div>
    );
  }
  const sample = atomicNumbers().transformer;
  return (
    <div ref={ref} className="pt-sheet" data-lab-ready={ready}>
      <Masthead
        variant={skin.masthead}
        counts={{
          models: taxonomy.models.length,
          atoms: taxonomy.models.filter((m) => m.level === "elementary").length,
          reactions: taxonomy.compositions.length,
        }}
      />
      <TableGrid models={models} sampleNumber={sample} motion={motion} onSelect={onSelect} />
      <FamilyStack models={models} motion={motion} onSelect={onSelect} />
      <ReactionBlock reactions={reactions} motion={motion} onSelect={onSelect} />
      {/* the key's own block when the bay is taken, and always on narrow screens */}
      <div className={keyFitsBay ? "pt-key-foot pt-narrow-only" : "pt-key-foot"}>
        <ChartKey sampleNumber={sample} />
      </div>
    </div>
  );
}
