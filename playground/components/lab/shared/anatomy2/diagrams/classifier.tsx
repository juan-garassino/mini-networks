"use client";

// Classifier (SmallCNN) anatomy, from src/mini_networks/models/classifier/
// model.py: [1,28,28] → ConvBNReLU(1→32) → MaxPool2 → [32,14,14] →
// ConvBNReLU(32→64) → MaxPool2 → [64,7,7] → flatten 3136 → Linear 64 → ReLU →
// 10 logits.
//
// REAL (data/classifier-champion.ts, the local mini-classifier champion on
// MNIST test image 0, a 7): the 4 highest-contrast of conv1's 32 learned
// 3×3 kernels, their feature maps after BN+ReLU, the 4 highest-contrast of
// conv2's 64 maps, and the 10 logits. The 2×2 max-pools are recomputed here from those
// real maps (exactly what MaxPool2d does). Only four channels per layer are
// shown — the stacked frames behind them stand for the rest.
import { useMemo } from "react";
import { CLS_CH1, CLS_CH2, CLS_DIGIT_LABEL, CLS_FILTERS, CLS_LOGITS, CLS_MAPS1, CLS_MAPS2 } from "../data/classifier-champion";
import { digitByLabel, digitPixels } from "../data/mnist-digits";
import { maxPool2, softmax, unNib } from "../math";
import { Bars, Diamond, Frame, PText, Thumb, Wire } from "../prims";
import type { Theme } from "../themes";

export const CLASSIFIER_VIEW = { w: 560, h: 316 };
const ROW = (r: number) => 44 + r * 62;
const X = { input: 16, filt: 86, m1: 104, p1: 182, m2: 232, p2: 282, flat: 312, fc: 326, logit: 360 };

function Stack({ x, y, s, theme }: { x: number; y: number; s: number; theme: Theme }) {
  // a few offset frames behind a map: "and the other channels"
  return (
    <g>
      {[2, 1].map((k) => <Frame key={k} x={x + k * 2 - 1} y={y - k * 2 - 1} w={s + 2} h={s + 2} fill={theme.textDim} />)}
      <rect x={x} y={y} width={s} height={s} fill={theme.ground} />
    </g>
  );
}

export function ClassifierDiagram({ theme }: { theme: Theme }) {
  const T = theme;
  const d = useMemo(() => {
    const x = digitPixels(digitByLabel(CLS_DIGIT_LABEL));
    const f = CLS_FILTERS.map((s) => unNib(s));
    const m1 = CLS_MAPS1.map((s) => unNib(s));
    const p1 = m1.map((m) => maxPool2(m, 28, 28));
    const m2 = CLS_MAPS2.map((s) => unNib(s));
    const p2 = m2.map((m) => maxPool2(m, 14, 14));
    const p = softmax([...CLS_LOGITS]);
    return { x, f, m1, p1, m2, p2, p };
  }, []);
  const pred = d.p.indexOf(Math.max(...d.p));
  const ce = -Math.log(Math.max(1e-12, d.p[CLS_DIGIT_LABEL]));
  const midY = ROW(0) + Math.round((ROW(3) + 56 - ROW(0)) / 2);

  return (
    <g>
      <rect x={0} y={0} width={CLASSIFIER_VIEW.w} height={CLASSIFIER_VIEW.h} fill={T.ground} />

      {/* stage headers */}
      <PText x={X.input} y={14} text="image" fill={T.textDim} />
      <PText x={X.filt} y={14} text="conv 3×3" fill={T.textDim} />
      <PText x={X.filt} y={24} text="4 of 32" fill={T.textDim} />
      <PText x={X.p1} y={14} text="pool" fill={T.textDim} />
      <PText x={X.m2} y={14} text="conv 3×3" fill={T.textDim} />
      <PText x={X.m2} y={24} text="4 of 64" fill={T.textDim} />
      <PText x={X.p2} y={14} text="pool" fill={T.textDim} />
      <PText x={X.fc} y={14} text="fc" fill={T.textDim} />
      <PText x={X.logit} y={14} text="10 logits" fill={T.textDim} />

      {/* input */}
      <Thumb x={X.input} y={midY - 28} data={d.x} theme={T} />
      <PText x={X.input} y={midY + 33} text="test 0" fill={T.textDim} />
      <PText x={X.input} y={midY + 43} text="28×28" fill={T.textDim} />

      {[0, 1, 2, 3].map((r) => {
        const y = ROW(r);
        // every stage of a row hangs on one spine at the 56-px map's centre, so
        // kernel → map → pool → map → pool wires run flat (no slopes)
        const c = y + 28;
        return (
          <g key={r}>
            {/* input → each learned kernel */}
            <Wire pts={[[X.input + 58, midY], [X.input + 62, midY], [X.input + 62, c], [X.filt - 2, c]]} fill={T.wire} />
            {/* the learned 3×3 kernel, 4 px per weight */}
            <Thumb x={X.filt} y={c - 6} data={d.f[r]} n={3} px={4} theme={T} />
            <PText x={X.filt} y={c + 10} text={`_{${CLS_CH1[r]}}`} fill={T.textDim} />
            {r === 0 && <Stack x={X.m1} y={y} s={56} theme={T} />}
            <Thumb x={X.m1} y={y} data={d.m1[r]} theme={T} />
            <Wire pts={[[X.m1 + 58, c], [X.p1 - 2, c]]} fill={T.wire} />
            <Thumb x={X.p1} y={c - 14} data={d.p1[r]} n={14} px={2} theme={T} />
            <Wire pts={[[X.p1 + 30, c], [X.m2 - 2, c]]} fill={T.wire} />
            {r === 0 && <Stack x={X.m2} y={c - 14} s={28} theme={T} />}
            <Thumb x={X.m2} y={c - 14} data={d.m2[r]} n={14} px={2} theme={T} />
            <PText x={X.m2} y={c + 17} text={`_{${CLS_CH2[r]}}`} fill={T.textDim} />
            <Wire pts={[[X.m2 + 30, c], [X.p2 - 2, c]]} fill={T.wire} />
            <Thumb x={X.p2} y={c - 7} data={d.p2[r]} n={7} px={2} theme={T} />
            <Wire pts={[[X.p2 + 16, c], [X.flat - 2, midY]]} fill={T.wire} />
          </g>
        );
      })}

      {/* flatten 3136 → fc 64 (1 bar = 32) */}
      <rect x={X.flat} y={ROW(0)} width={1} height={ROW(3) + 56 - ROW(0)} fill={T.accentHi} />
      <PText x={X.flat} y={22} text="_{3136}" fill={T.textDim} />
      <Bars x={X.fc} y={midY - 42} bars={2} h={84} theme={T} bw={4} gap={2} />
      <PText x={X.fc} y={midY + 46} text="_{64}" fill={T.textDim} />
      <Wire pts={[[X.fc + 12, midY], [X.logit - 4, midY]]} fill={T.accentLo} step={1} />

      {/* the 10 logits → softmax */}
      {d.p.map((p, k) => {
        const y = 44 + k * 24;
        const hot = k === pred;
        const bw = Math.max(1, Math.round(p * 90));
        return (
          <g key={k}>
            <PText x={X.logit} y={y} text={String(k)} fill={hot ? T.wireHot : T.textDim} />
            <rect x={X.logit + 10} y={y + 1} width={92} height={5} fill={T.panel} />
            <rect x={X.logit + 10} y={y + 1} width={bw} height={5} fill={hot ? T.accentHi : T.accent} />
            <PText x={X.logit + 108} y={y} text={CLS_LOGITS[k].toFixed(1)} fill={hot ? T.wireHot : T.textDim} />
          </g>
        );
      })}
      <PText x={X.logit + 10} y={44 + 10 * 24 + 2} text="bar = softmax, number = logit" fill={T.textDim} />

      {/* loss against the true label */}
      <Wire pts={[[X.logit + 140, 44 + CLS_DIGIT_LABEL * 24 + 3], [520, 44 + CLS_DIGIT_LABEL * 24 + 3], [520, 214]]} fill={T.wire} />
      <Diamond cx={520} cy={220} theme={T} />
      <PText x={521} y={230} text="CE" fill={T.loss} anchor="middle" />
      <PText x={521} y={240} text={ce < 0.005 ? "<.01" : ce.toFixed(2)} fill={T.loss} anchor="middle" />
      <PText x={521} y={250} text={`label ${CLS_DIGIT_LABEL}`} fill={T.textDim} anchor="middle" />

      <PText x={16} y={CLASSIFIER_VIEW.h - 14} text="map: dark = 0 after ReLU, bright = its max   kernel: dark = negative weight" fill={T.textDim} />
    </g>
  );
}

// ————— card: digit → 4 real conv1 maps → 4 real conv2 maps → 10 scores —————
export const CLASSIFIER_CARD_VIEW = { w: 190, h: 100 };

export function ClassifierCard({ theme }: { theme: Theme }) {
  const T = theme;
  const d = useMemo(() => ({
    x: digitPixels(digitByLabel(CLS_DIGIT_LABEL)),
    m1: CLS_MAPS1.map((s) => unNib(s)),
    m2: CLS_MAPS2.map((s) => unNib(s)),
    p: softmax([...CLS_LOGITS]),
  }), []);
  const pred = d.p.indexOf(Math.max(...d.p));
  return (
    <g>
      <rect x={0} y={0} width={CLASSIFIER_CARD_VIEW.w} height={CLASSIFIER_CARD_VIEW.h} fill={T.ground} />
      <PText x={40} y={4} text="conv" fill={T.textDim} />
      <PText x={106} y={4} text="conv" fill={T.textDim} />
      <PText x={144} y={4} text="scores" fill={T.textDim} />
      <Thumb x={4} y={36} data={d.x} px={1} theme={T} />
      <Wire pts={[[33, 50], [38, 50]]} fill={T.wire} />
      {[0, 1, 2, 3].map((r) => (
        <Thumb key={`a${r}`} x={40 + (r % 2) * 30} y={20 + Math.floor(r / 2) * 30} data={d.m1[r]} px={1} theme={T} />
      ))}
      <Wire pts={[[99, 50], [104, 50]]} fill={T.wire} />
      {[0, 1, 2, 3].map((r) => (
        <Thumb key={`b${r}`} x={106 + (r % 2) * 16} y={34 + Math.floor(r / 2) * 16} data={d.m2[r]} n={14} px={1} theme={T} />
      ))}
      <Wire pts={[[137, 50], [143, 50]]} fill={T.wire} />
      {d.p.map((p, k) => {
        const h = Math.max(1, Math.round(p * 44));
        return (
          <g key={k}>
            <rect x={145 + k * 4} y={72 - h} width={3} height={h} fill={k === pred ? T.accentHi : T.accent} />
            <PText x={145 + k * 4} y={75} text={`_{${k}}`} fill={k === pred ? T.wireHot : T.textDim} />
          </g>
        );
      })}
      <PText x={4} y={90} text={`real champion: says ${pred}`} fill={T.textDim} />
    </g>
  );
}
