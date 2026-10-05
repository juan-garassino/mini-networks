"use client";

import type { TaxonomyResponse } from "@/lib/types";
import { atomicNumbers } from "@/lib/blueprint";
import { ChartKey } from "./chart-key";
import { FamilyStack } from "./family-stack";
import { Masthead } from "./masthead";
import { placeModels, placeReactions } from "./placed";
import { ReactionBlock } from "./reaction-block";
import type { PeriodicSkin } from "./skins";
import { TableGrid, keyFitsBay } from "./table-grid";

// The periodic table sheet: one structure for every skin. The skin's look
// arrives as CSS vars on <html> (skins/index.ts applySkin); this component
// only reads the skin's motion timings and masthead variant.
export function PeriodicTable({
  taxonomy, skin, onSelect,
}: {
  taxonomy: TaxonomyResponse | null;
  skin: PeriodicSkin;
  onSelect: (name: string) => void;
}) {
  if (!taxonomy) {
    return (
      <div className="pt-sheet pt-loading" role="status">
        Loading the models…
      </div>
    );
  }
  const models = placeModels(taxonomy);
  const sample = atomicNumbers().transformer;
  return (
    <div className="pt-sheet" data-lab-ready="1">
      <Masthead
        variant={skin.masthead}
        counts={{
          models: taxonomy.models.length,
          atoms: taxonomy.models.filter((m) => m.level === "elementary").length,
          reactions: taxonomy.compositions.length,
        }}
      />
      <TableGrid models={models} sampleNumber={sample} motion={skin.motion} onSelect={onSelect} />
      <FamilyStack models={models} motion={skin.motion} onSelect={onSelect} />
      <ReactionBlock reactions={placeReactions(taxonomy)} motion={skin.motion} onSelect={onSelect} />
      {/* the key's own block when the bay is taken, and always on narrow screens */}
      <div className={keyFitsBay ? "pt-key-foot pt-narrow-only" : "pt-key-foot"}>
        <ChartKey sampleNumber={sample} />
      </div>
    </div>
  );
}
