import type { TaxonomyResponse } from "@/lib/types";
import { ATOMS, PLACEMENT, atomicNumbers } from "@/lib/blueprint";
import type { TileLevel } from "./encoding";

// The data shape both layouts draw: every placed model with its table cell,
// atomic number, level and tooltip; every composition with its ✻ index.
export interface PlacedModel {
  name: string;
  col: number;
  row: number;
  number: number;
  level: TileLevel;
  title: string;
}
export interface PlacedReaction { name: string; number: string; title: string }

export function placeModels(t: TaxonomyResponse): PlacedModel[] {
  const byName = Object.fromEntries(t.models.map((m) => [m.name, m]));
  const z = atomicNumbers();
  return Object.entries(PLACEMENT).map(([name, { col, row }]) => {
    const m = byName[name];
    return {
      name, col, row,
      number: z[name],
      level: ATOMS[name] ? "atom" : "compound",
      title: `${name}: ${m?.introduces.join(", ") || m?.note || ""}`,
    };
  });
}

export function placeReactions(t: TaxonomyResponse): PlacedReaction[] {
  return t.compositions.map((c, i) => ({
    name: c.name,
    number: `✻${i + 1}`,
    title: `${c.name} = ${c.composes.join(" + ")}`,
  }));
}
