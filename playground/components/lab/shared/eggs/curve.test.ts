// Curve picking (lesson sparkline) + the critter's real-loss selection.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { MetricSeries, RunSummary } from "../../../../lib/types.ts";
import {
  bestDecreasing, decreaseScore, lessonRunOrder, lossCandidates, mainLoss, pickCurve,
} from "../lesson/curve.ts";

const pts = (...ys: number[]): [number, number][] => ys.map((y, i) => [i, y]);
const run = (id: string, model: string, extra: Partial<RunSummary> = {}): RunSummary => ({
  id, model, source: "local", status: "done", last_step: 0, created_at: "2026-01-01",
  last_metrics: { loss: 1 }, artifact_names: [], ...extra,
});

test("mainLoss prefers loss, ignores bookkeeping + aux series", () => {
  const s: MetricSeries[] = [
    { key: "epoch", points: pts(0, 1, 2) },
    { key: "aux_loss", points: pts(3, 2, 1, 0) },
    { key: "finetune_loss", points: pts(4, 3) },
    { key: "pretrain_loss", points: pts(2, 0.9, 0.4) },
  ];
  assert.equal(mainLoss(s)?.key, "pretrain_loss");
  assert.equal(mainLoss([...s, { key: "loss", points: pts(1, 0.5) }])?.key, "loss");
});

test("pickCurve adds the gate metric and skips 1-point series", () => {
  const s: MetricSeries[] = [
    { key: "loss", points: pts(2, 1, 0.5) },
    { key: "accuracy", points: pts(0.1, 0.5, 0.9) },
    { key: "psnr", points: pts(10) },
  ];
  assert.deepEqual(pickCurve(s, "accuracy")?.map((c) => c.key), ["loss", "accuracy"]);
  assert.deepEqual(pickCurve(s, "psnr")?.map((c) => c.key), ["loss"]);
  assert.equal(pickCurve([{ key: "loss", points: pts(1) }]), null);
  assert.deepEqual(pickCurve([{ key: "episode_reward", points: pts(0, 1) }])?.map((c) => c.key), ["episode_reward"]);
});

test("decreaseScore: clear drops qualify, noise and short series don't", () => {
  assert.ok((decreaseScore(pts(2.097, 0.92, 0.456)) ?? 0) > 0.7);   // real lora pretrain_loss
  assert.equal(decreaseScore(pts(0.516, 0.502, 0.512, 0.495)), null); // rl_rlhf_maze ppo_loss
  assert.equal(decreaseScore(pts(3.2, 3.1)), null);
  assert.equal(decreaseScore(pts(1, 2, 3)), null);
  assert.equal(decreaseScore(pts(1, NaN, 0.1)), null);
});

test("bestDecreasing prefers ≥10 points over a bigger drop", () => {
  const long = pts(...Array.from({ length: 12 }, (_, i) => 2 - i * 0.1));
  const c = bestDecreasing("r", "m", [
    { key: "loss", points: pts(5, 1, 0.1) },
    { key: "train_loss", points: long },
  ]);
  assert.equal(c?.key, "train_loss");
  assert.equal(bestDecreasing("r", "m", [{ key: "accuracy", points: pts(1, 0.5, 0.1) }]), null);
});

test("lossCandidates: done runs with a loss, longest first", () => {
  const c = lossCandidates([
    run("a", "x", { last_step: 1 }),
    run("b", "x", { last_step: 9 }),
    run("c", "x", { status: "running", last_step: 50 }),
    run("d", "x", { last_step: 99, last_metrics: { reward: 1 } }),
  ]);
  assert.deepEqual(c.map((r) => r.id), ["b", "a"]);
});

test("lessonRunOrder: done, then running, longest, newest; only this model", () => {
  const o = lessonRunOrder([
    run("a", "m", { status: "failed", last_step: 100 }),
    run("b", "m", { status: "running", last_step: 50 }),
    run("c", "m", { last_step: 3, created_at: "2026-02-01" }),
    run("d", "m", { last_step: 3, created_at: "2026-03-01" }),
    run("e", "other"),
  ], "m");
  assert.deepEqual(o.map((r) => r.id), ["d", "c", "b", "a"]);
});
