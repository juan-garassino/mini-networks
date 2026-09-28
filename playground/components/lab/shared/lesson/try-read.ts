// Pure halves of "try it": request inputs we build client-side and readers
// that turn /infer/{model} outputs into something a learner can read.
// Node-testable (try-read.test.ts under eggs/ … see README).

export type TryOutput =
  | { kind: "text"; text: string; note?: string }
  | { kind: "image"; grids: number[][][]; urls: string[]; note?: string }
  | { kind: "label"; label: string; detail?: string; note?: string }
  | { kind: "json"; json: unknown; note?: string };

// The Shakespeare character set (sorted set of data/shakespeare.txt). The
// served text champions ship model.pt WITHOUT tokenizer.json, so /infer
// returns raw ids; verified 2026-09-28 against the transformer champion:
// ids index this string directly (id 0 = "\n", the seed token).
export const SHAKESPEARE_CHARS =
  "\n !$&',-.3:;?ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Decode raw char ids; null when any id falls outside the 65-char set. */
export function decodeShakespeare(ids: number[]): string | null {
  if (!ids.every((i) => Number.isInteger(i) && i >= 0 && i < SHAKESPEARE_CHARS.length)) return null;
  return ids.map((i) => SHAKESPEARE_CHARS[i]).join("");
}

/**
 * A hand-drawn "1" on a 28×28 canvas in [0,1] (MNIST's range — the data
 * pipeline is ToTensor() with no normalisation). A slightly slanted 3-px
 * stroke, rows 5–22. The classifier champion reads it as 1 with ~100%
 * confidence (verified 2026-09-28).
 */
export function drawnOne(): number[][] {
  const img = Array.from({ length: 28 }, () => new Array<number>(28).fill(0));
  for (let r = 5; r < 23; r++) {
    const c = 14 + (14 - r) * 0.18;
    for (let col = 0; col < 28; col++) {
      const d = Math.abs(col - c);
      const v = d < 1 ? 1 : Math.max(0, 1 - (d - 1));
      img[r][col] = Math.max(img[r][col], Math.round(v * 1000) / 1000);
    }
  }
  return img;
}

export function softmax(xs: number[]): number[] {
  const m = Math.max(...xs);
  const e = xs.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
}

type Outputs = Record<string, unknown>;

/** Text LMs: `generated` string, or raw `tokens` decoded with the Shakespeare set. */
export function readText(o: Outputs): TryOutput {
  if (typeof o.generated === "string" && o.generated.trim()) return { kind: "text", text: o.generated };
  const tokens = o.tokens as number[][] | undefined;
  if (Array.isArray(tokens) && Array.isArray(tokens[0])) {
    const text = decodeShakespeare(tokens[0]);
    if (text != null)
      return {
        kind: "text",
        text: text.replace(/^\n/, ""),
        note: "decoded with the Shakespeare character set — this champion was saved without its tokenizer, so it writes from scratch rather than continuing a prompt",
      };
  }
  return { kind: "json", json: o, note: "the server answered in a shape this card can't read as text" };
}

/** Image classifiers (SupervisedTrainer.infer): predictions + logits. */
export function readDigit(o: Outputs): TryOutput {
  const pred = (o.predictions as number[] | undefined)?.[0];
  const logits = (o.logits as number[][] | undefined)?.[0];
  if (typeof pred !== "number" || !Array.isArray(logits)) return { kind: "json", json: o };
  const p = softmax(logits)[pred] ?? 0;
  return {
    kind: "label",
    label: `it reads: ${pred}`,
    detail: `${Math.round(p * 100)}% sure`,
  };
}

const ARROW = ["↑", "↓", "←", "→"]; // models/rl_maze/env.py ACTIONS 0..3 = up, down, left, right

/** Maze agents (rl_maze / reinforce): one greedy episode. */
export function readMaze(o: Outputs): TryOutput {
  const actions = o.actions as number[] | undefined;
  const steps = typeof o.steps === "number" ? o.steps : actions?.length;
  if (!Array.isArray(actions) || steps == null) return { kind: "json", json: o };
  const path = actions.slice(0, 48).map((a) => ARROW[a] ?? "?").join("") + (actions.length > 48 ? "…" : "");
  return {
    kind: "label",
    label: o.success ? `found the exit in ${steps} moves` : `didn't reach the exit (${steps} moves)`,
    detail: path,
  };
}

/** [n,1,H,W] (or [n,H,W]) nested lists in [0,1] → n grayscale grids. */
export function toGrids(samples: unknown): number[][][] {
  if (!Array.isArray(samples)) return [];
  return samples
    .map((s) => (Array.isArray(s) && Array.isArray(s[0]) && Array.isArray(s[0][0]) ? s[0] : s))
    .filter((g): g is number[][] => Array.isArray(g) && Array.isArray(g[0]))
    .map((g) => g.map((row) => row.map((v) => Math.min(1, Math.max(0, Number(v) || 0)))));
}

/** Generative image models: `samples` → grids (urls filled in by the hook). */
export function readSamples(o: Outputs): TryOutput {
  const grids = toGrids(o.samples);
  if (!grids.length) return { kind: "json", json: o };
  return { kind: "image", grids, urls: [] };
}
