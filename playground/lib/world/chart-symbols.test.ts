// The periodic table's symbols (lib/blueprint.ts): every model and every reaction
// prints a symbol no other tile on the chart prints (review 1: UN, TE, AU, DE, MO
// and CL repeated). The rule is documented in components/periodic/DESIGN.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { TaxonomyResponse } from "../types.ts";
import { ATOMS, PLACEMENT, reactionSymbols, symbolCandidates, symbolFor } from "../blueprint.ts";

const tax: TaxonomyResponse = JSON.parse(readFileSync(new URL("./__fixtures__/taxonomy.json", import.meta.url), "utf8"));

test("every model and reaction on the chart has its own symbol, two or three letters", () => {
  const models = Object.keys(PLACEMENT).map((n) => symbolFor(n));
  const reactions = [...reactionSymbols(tax.compositions.map((c) => c.name)).values()];
  const all = [...models, ...reactions];
  // unique as printed in both cases (the blueprint skin sets symbols in caps)
  assert.equal(new Set(all.map((s) => s.toUpperCase())).size, all.length, `repeats: ${all.filter((s, i) => all.indexOf(s) !== i)}`);
  for (const s of all) assert.match(s, /^[A-Z][a-z]{1,2}$/, `${s}: Capital + 1–2 lower case`);
  assert.equal(all.filter((s) => s.length === 2).length, all.length, "the zoo needs no three-letter symbol");
});

test("atoms keep their hand-set symbols; the rule is deterministic and stable", () => {
  for (const [n, a] of Object.entries(ATOMS)) assert.equal(symbolFor(n), a.symbol);
  assert.equal(symbolFor("text_seq2seq"), "Ts", "word initials first");
  assert.equal(symbolFor("resnet"), "Re", "then the first different letter");
  assert.equal(symbolFor("unet_ae"), "Ua", "never the atom's Un");
  assert.deepEqual(symbolCandidates("lora_lm").slice(0, 2), ["Lo", "Lr"], "no doubled letter");
  const names = tax.compositions.map((c) => c.name);
  assert.deepEqual([...reactionSymbols(names)], [...reactionSymbols([...names])], "same input, same symbols");
});
