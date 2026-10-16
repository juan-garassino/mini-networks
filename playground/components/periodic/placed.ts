import type { TaxonomyResponse } from "@/lib/types";
import { ATOMS, PLACEMENT, atomicNumbers, reactionSymbols, symbolFor } from "@/lib/blueprint";
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
export interface PlacedReaction { name: string; number: string; symbol: string; title: string }

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
  const sym = reactionSymbols(t.compositions.map((c) => c.name));
  return t.compositions.map((c, i) => ({
    name: c.name,
    number: `✻${i + 1}`,
    symbol: sym.get(c.name)!,
    title: `${c.name} = ${c.composes.join(" + ")}`,
  }));
}

/** The symbol a tile prints for any name: a reaction's from the ✻ order, a model's from the chart. */
export function tileSymbol(name: string, t: TaxonomyResponse | null): string {
  const comps = t?.compositions.map((c) => c.name) ?? [];
  return comps.includes(name) ? reactionSymbols(comps).get(name)! : symbolFor(name);
}
