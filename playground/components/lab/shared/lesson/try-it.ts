"use client";

// "Try it": one-click inference presets against the served champion
// (POST /infer/{model} with no run → the pulled champion, see
// api/routers/inference.py). Only models where one click gives a meaningful
// result. Request shapes come from colab/probes.py + the router: top-level
// `prompt` / `n_samples` / `temperature`, everything else under `inputs`.
//
// Deliberately NOT here (and why):
//  - diffusion / tabular_diffusion: /infer builds a fast_demo config, so the
//    sampler runs the S-tier 25 steps against an M-trained model → noise.
//  - gan: the served champion predates the mini-DCGAN generator — its
//    checkpoint no longer loads (verified 2026-09-28: 400 "Failed to load").
//  - pixelcnn: 784 sequential passes of an 8-layer net — minutes on this machine.
//  - rlhf / rag: champions ship without tokenizer / retrieval index → empty text / error.
//  - models without a champion (grokking, alphazero, gnn, nerf, kimi, …):
//    /infer would serve an untrained model (400 "Model not loaded").
import { useCallback, useEffect, useRef, useState } from "react";
import type { ModelEvidence } from "@/lib/types";
import {
  drawnOne, readDigit, readMaze, readSamples, readText, type TryOutput,
} from "./try-read";

export type TryRender = "text" | "image" | "label" | "json";

export interface TryPreset {
  /** button copy, sentence case */
  label: string;
  /** POST /infer/{model} body */
  body: unknown;
  render: TryRender;
  /** true = this exact request was run against the live champion */
  verified: boolean;
  /** what the model is given, for skins to show (e.g. the drawn "1") */
  input?: { kind: "grid"; grid: number[][] } | { kind: "text"; text: string };
  read: (outputs: Record<string, unknown>) => TryOutput;
}

const ONE = drawnOne();
const DIGIT_BODY = { inputs: { images: [[ONE]] } };           // [1,1,28,28]
const LM_BODY = { prompt: "ROMEO:", temperature: 0.8, inputs: { max_new_tokens: 80 } };

const lm = (verified: boolean): TryPreset => ({
  label: "Write a line of Shakespeare",
  body: LM_BODY,
  render: "text",
  verified,
  read: readText,
});
const digit = (verified: boolean): TryPreset => ({
  label: "Show it a hand-drawn 1",
  body: DIGIT_BODY,
  render: "label",
  verified,
  input: { kind: "grid", grid: ONE },
  read: readDigit,
});
const maze: TryPreset = {
  label: "Let it walk the maze",
  body: { inputs: {} },
  render: "label",
  verified: false,
  read: readMaze,
};

export const TRY_PRESETS: Record<string, TryPreset> = {
  // verified 2026-09-28: 200, 60 raw char ids → "not malive he wars, the …"
  transformer: lm(true),
  rnn: lm(false),            // same infer() contract + champion as transformer
  mamba: lm(false),
  // verified 2026-09-28: classifier → 1, ~100% (logit 10.1 vs ≤ -1.2)
  classifier: digit(true),
  resnet: digit(false),      // same SupervisedTrainer.infer contract
  vit: digit(false),
  mobilenet: digit(false),
  convnext: digit(false),
  vae: {
    label: "Dream up four new digits",
    body: { inputs: { sample: 4 } },                        // probes.py: {"sample": n}
    render: "image",
    verified: false,
    read: readSamples,
  },
  rl_maze: maze,             // probes.py: infer(config, {})
  reinforce: maze,
};

/** A preset exists AND the model has a served champion to answer it. */
export function tryAvailable(name: string, evidence: ModelEvidence[]): boolean {
  return Boolean(TRY_PRESETS[name] && evidence.find((e) => e.name === name)?.champion);
}

export const TRY_COPY = {
  running: "asking the model…",
  warming: "the model server is warming up the champion — first call can take ~30s on this machine",
  timeout: "no answer after 90s — the machine is busy; try again in a moment",
  offline: "the model server isn't answering — is `python main.py serve` running?",
  noChampion: "no trained champion is loaded for this model on this server yet",
  unknown: "the server doesn't know this model",
  failed: "the model couldn't answer this time",
} as const;

const TIMEOUT_MS = 90_000;
const WARMING_AFTER_MS = 4_000;
const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export type TryState = "idle" | "running" | "done" | "error";

function toUrls(grids: number[][][]): string[] {
  if (typeof document === "undefined") return [];
  return grids.map((g) => {
    const h = g.length, w = g[0]?.length ?? 0;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    const img = ctx.createImageData(w, h);
    g.forEach((row, y) => row.forEach((v, x) => {
      const i = (y * w + x) * 4, b = Math.round(v * 255);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }));
    ctx.putImageData(img, 0, 0);
    return c.toDataURL("image/png");
  });
}

function explain(status: number, text: string): string {
  if (status === 404) return TRY_COPY.unknown;
  if (/Model not loaded|Train (the agent )?first|not loaded|Failed to load checkpoint/i.test(text)) return TRY_COPY.noChampion;
  return `${TRY_COPY.failed} (${status})`;
}

/**
 * useTryIt(name) → { run(), state, output, error, slow, preset }.
 * `slow` flips true after 4s of waiting — show TRY_COPY.warming then. Times
 * out at 90s. One request at a time; switching model resets. No preset → run()
 * is a no-op and `preset` is null (skins hide the button).
 */
export function useTryIt(name: string | null) {
  const preset = name ? TRY_PRESETS[name] ?? null : null;
  const [state, setState] = useState<TryState>("idle");
  const [output, setOutput] = useState<TryOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  const [shownFor, setShownFor] = useState(name);
  if (shownFor !== name) {           // model switched: reset during render (no effect loop)
    setShownFor(name);
    setState("idle"); setOutput(null); setError(null); setSlow(false);
  }
  // abort an in-flight request when the model switches or the card unmounts
  useEffect(() => () => ctrl.current?.abort(), [name]);

  const run = useCallback(async () => {
    if (!name || !preset || ctrl.current) return;
    const ac = new AbortController();
    ctrl.current = ac;
    setState("running"); setOutput(null); setError(null); setSlow(false);
    const warm = setTimeout(() => setSlow(true), WARMING_AFTER_MS);
    const kill = setTimeout(() => ac.abort("timeout"), TIMEOUT_MS);
    try {
      const r = await fetch(`${BASE}/infer/${name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preset.body),
        signal: ac.signal,
      });
      if (!r.ok) throw new Error(explain(r.status, await r.text()));
      const data = (await r.json()) as { outputs?: Record<string, unknown> };
      let out = preset.read(data.outputs ?? {});
      if (out.kind === "image") out = { ...out, urls: toUrls(out.grids) };
      setOutput(out);
      setState("done");
    } catch (e) {
      if (ac.signal.aborted) {
        if (ac.signal.reason === "timeout") { setError(TRY_COPY.timeout); setState("error"); }
        else setState("idle");                        // unmounted / model switched
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        setError(e instanceof TypeError ? TRY_COPY.offline : msg);
        setState("error");
      }
    } finally {
      clearTimeout(warm); clearTimeout(kill);
      setSlow(false);
      if (ctrl.current === ac) ctrl.current = null;
    }
  }, [name, preset]);

  return { run, state, output, error, slow, preset };
}
