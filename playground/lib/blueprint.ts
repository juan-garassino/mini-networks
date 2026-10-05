// Chart layout data: element symbols and the hand-drafted periodic-table
// PLACEMENT of all 44 models (like the real table, positions are authored,
// not computed). Levels, parents and descriptions come live from
// /web/taxonomy — this file only carries the *drafting* of the chart.

export interface AtomSpec { symbol: string; z: number; family: string }

export const ATOMS: Record<string, AtomSpec> = {
  classifier:         { symbol: "Cv", z: 1,  family: "perception" },
  tabular_classifier: { symbol: "Ml", z: 2,  family: "perception" },
  segmentation:       { symbol: "Un", z: 3,  family: "perception" },
  rnn:                { symbol: "Rc", z: 4,  family: "sequence" },
  transformer:        { symbol: "At", z: 5,  family: "sequence" },
  mamba:              { symbol: "Ss", z: 6,  family: "sequence" },
  vae:                { symbol: "Vl", z: 7,  family: "generative" },
  gan:                { symbol: "Ad", z: 8,  family: "generative" },
  diffusion:          { symbol: "Df", z: 9,  family: "generative" },
  pixelcnn:           { symbol: "Ar", z: 10, family: "generative" },
  simclr:             { symbol: "Ct", z: 11, family: "representation" },
  gnn:                { symbol: "Mp", z: 12, family: "structure" },
  nerf:               { symbol: "Nf", z: 13, family: "structure" },
  reinforce:          { symbol: "Pg", z: 14, family: "decision" },
  rl_maze:            { symbol: "Qv", z: 15, family: "decision" },
  alphazero:          { symbol: "Mc", z: 16, family: "decision" },
};

/** Group blocks: [firstCol, lastCol] of a 16-column table. */
export const FAMILY_BLOCKS: { family: string; label: string; cols: [number, number] }[] = [
  { family: "perception",     label: "I · Perception",     cols: [1, 3] },
  { family: "sequence",       label: "II · Sequence",      cols: [4, 6] },
  { family: "generative",     label: "III · Generative",   cols: [7, 10] },
  { family: "representation", label: "IV · Repr.",         cols: [11, 11] },
  { family: "structure",      label: "V · Structure",      cols: [12, 13] },
  { family: "decision",       label: "VI · Decision",      cols: [14, 16] },
];

/** Authored table positions — period 1 = the 16 atoms; derived models sit
 * below their family block, roughly one period per generation. */
export const PLACEMENT: Record<string, { col: number; row: number }> = {
  // period 1 — atoms
  classifier: { col: 1, row: 1 }, tabular_classifier: { col: 2, row: 1 }, segmentation: { col: 3, row: 1 },
  rnn: { col: 4, row: 1 }, transformer: { col: 5, row: 1 }, mamba: { col: 6, row: 1 },
  vae: { col: 7, row: 1 }, gan: { col: 8, row: 1 }, diffusion: { col: 9, row: 1 }, pixelcnn: { col: 10, row: 1 },
  simclr: { col: 11, row: 1 }, gnn: { col: 12, row: 1 }, nerf: { col: 13, row: 1 },
  reinforce: { col: 14, row: 1 }, rl_maze: { col: 15, row: 1 }, alphazero: { col: 16, row: 1 },
  // perception block (cols 1-3)
  resnet: { col: 1, row: 2 }, rpp_classifier: { col: 2, row: 2 }, unet_ae: { col: 3, row: 2 },
  mobilenet: { col: 1, row: 3 }, detection: { col: 2, row: 3 }, sam: { col: 3, row: 3 },
  convnext: { col: 1, row: 4 }, lora: { col: 2, row: 4 }, vit: { col: 3, row: 4 },
  audio_classifier: { col: 1, row: 5 }, audio_spectrogram: { col: 2, row: 5 }, audio_melspectrogram: { col: 3, row: 5 },
  // sequence block (cols 4-6)
  text_token_classifier: { col: 4, row: 2 }, moe: { col: 5, row: 2 }, audio_transformer: { col: 6, row: 2 },
  text_seq2seq: { col: 4, row: 3 }, kimi: { col: 5, row: 3 }, deepseek: { col: 6, row: 3 },
  rag: { col: 4, row: 4 }, grokking: { col: 5, row: 4 }, text_diffusion: { col: 6, row: 4 },
  // generative block
  tabular_diffusion: { col: 9, row: 2 },
  // representation column
  vision_embed: { col: 11, row: 2 }, clip: { col: 11, row: 3 }, dino: { col: 11, row: 4 },
  // decision block
  rlhf: { col: 14, row: 2 },
  grpo: { col: 14, row: 3 }, dpo: { col: 15, row: 3 },
};

/** Family of any placed model: atoms carry theirs; derived models inherit
 * the family block their column sits under (the chart's own grouping). */
export function familyOf(name: string): string | undefined {
  if (ATOMS[name]) return ATOMS[name].family;
  const col = PLACEMENT[name]?.col;
  if (col === undefined) return undefined;
  return FAMILY_BLOCKS.find((b) => col >= b.cols[0] && col <= b.cols[1])?.family;
}

export const TABLE_COLS = 16;
export const TABLE_ROWS = 5;

/**
 * Chart symbols, unique across the whole chart (models AND reactions). The rule
 * (components/periodic/DESIGN.md "Symbols"):
 *   atoms keep their hand-set chemistry symbols (ATOMS);
 *   every other name, in chart order (derived models by atomic number, then
 *   reactions by ✻ index), takes the FIRST candidate no earlier name holds:
 *     1. first letter + the initial of each later word   (text_seq2seq → Ts)
 *     2. first letter + its first different letter        (resnet → Re)
 *     3. first letter + each later consonant, then each later letter
 *     4. three letters: first + two later letters, in order
 * Candidates are Capital + lower case, so they stay unique in caps skins too.
 */
const VOWELS = "aeiou";

export function symbolCandidates(name: string): string[] {
  const words = name.toLowerCase().split("_").map((w) => w.replace(/[^a-z]/g, "")).filter(Boolean);
  const letters = words.join("");
  const f = letters[0] ?? "x";
  const F = f.toUpperCase();
  const later = letters.slice(1).split("");
  const out = [
    ...words.slice(1).map((w) => F + w[0]),
    ...later.filter((c) => c !== f).slice(0, 1).map((c) => F + c),
    ...later.filter((c) => !VOWELS.includes(c)).map((c) => F + c),
    ...later.map((c) => F + c),
    ...later.flatMap((c, i) => later.slice(i + 1).map((d) => F + c + d)),
  ];
  // a doubled letter ("Ll") reads as a typo
  return [...new Set(out)].filter((c) => c[1] !== f);
}

/** Give each name in `names` (in order) its first candidate not in `taken`; `taken` grows. */
export function assignSymbols(names: string[], taken: Set<string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const n of names) {
    const s = symbolCandidates(n).find((c) => !taken.has(c)) ?? `${n.slice(0, 2)}${taken.size}`;
    taken.add(s);
    out.set(n, s);
  }
  return out;
}

const ATOM_SYMBOLS = new Set(Object.values(ATOMS).map((a) => a.symbol));
/** Derived models in atomic-number order (reading order of the table). */
const DERIVED_ORDER = Object.entries(PLACEMENT)
  .filter(([name]) => !ATOMS[name])
  .sort(([, a], [, b]) => a.row - b.row || a.col - b.col)
  .map(([name]) => name);
const MODEL_SYMBOLS = assignSymbols(DERIVED_ORDER, new Set(ATOM_SYMBOLS));
const TAKEN_BY_MODELS = new Set([...ATOM_SYMBOLS, ...MODEL_SYMBOLS.values()]);

/** A model's chart symbol (a model not on the chart yet still avoids every charted symbol). */
export function symbolFor(name: string): string {
  return ATOMS[name]?.symbol ?? MODEL_SYMBOLS.get(name) ?? assignSymbols([name], new Set(TAKEN_BY_MODELS)).get(name)!;
}

/** Reaction symbols for the compositions in ✻ order: unique among themselves and every model's. */
export function reactionSymbols(names: string[]): Map<string, string> {
  return assignSymbols(names, new Set(TAKEN_BY_MODELS));
}

/** Atomic number: atoms keep 1-16; derived models are numbered 17.. in
 * reading order of their table position. */
export function atomicNumbers(): Record<string, number> {
  const z: Record<string, number> = {};
  for (const [name, a] of Object.entries(ATOMS)) z[name] = a.z;
  let next = 17;
  for (const name of DERIVED_ORDER) z[name] = next++;
  return z;
}

export const STATUS_INK: Record<string, string> = {
  running: "var(--redline)",
  pending: "var(--redline)",
  dispatched: "var(--redline)",
  done: "var(--line)",
  failed: "var(--alert)",
  unknown: "var(--ink-dim)",
};
