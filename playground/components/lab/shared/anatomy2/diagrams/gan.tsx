"use client";

// GAN anatomy, from src/mini_networks/models/gan/{config,model}.py (the
// current mini-DCGAN): G: z(100) → Linear → [256,7,7] → BN·ReLU → ConvT s2 →
// [128,14,14] → BN·ReLU → ConvT s2 → [1,28,28] → tanh.  D: Conv s2 (64, 14×14)
// → LReLU → Conv s2 (128, 7×7) → BN·LReLU → flatten 6272 → Linear → sigmoid.
// Losses (non-saturating): D: BCE(D(real),1)+BCE(D(fake),0); G: BCE(D(fake),1).
//
// REAL: the real digits (MNIST test), and — from data/gan-champion.ts — six
// generator samples, D's score for every real and fake image, and the two
// losses computed from those scores. CAVEAT, labelled on the drawing: the
// locally registered champion (mini-gan v1) predates the DCGAN rewrite — its
// G and D are the old MLPs — so the samples/scores come from that network
// while the blocks show today's code.
import { useMemo } from "react";
import { GAN_D_FAKE, GAN_D_REAL, GAN_FAKE } from "../data/gan-champion";
import { MNIST_DIGITS, digitPixels } from "../data/mnist-digits";
import { gaussian, unNib } from "../math";
import { Bars, Diamond, PText, Thumb, Wire } from "../prims";
import type { Theme } from "../themes";

export const GAN_VIEW = { w: 560, h: 316 };
const CY = 150;
const REAL_Y = 58, FAKE_Y = 184, COL_X = [182, 246, 310];
const SHOW = [0, 1, 3]; // which of the six real / fake images to show (real: digits 0, 1, 3)

export function GANDiagram({ theme }: { theme: Theme }) {
  const T = theme;
  const d = useMemo(() => ({
    z: gaussian(100, 11),
    real: SHOW.map((i) => digitPixels(MNIST_DIGITS[i])),
    fake: SHOW.map((i) => unNib(GAN_FAKE[i])),
  }), []);
  const bce = (p: number) => -Math.log(Math.max(1e-6, p));
  const dLoss = GAN_D_REAL.reduce((a, p) => a + bce(p), 0) / GAN_D_REAL.length + GAN_D_FAKE.reduce((a, p) => a + bce(1 - p), 0) / GAN_D_FAKE.length;
  const gLoss = GAN_D_FAKE.reduce((a, p) => a + bce(p), 0) / GAN_D_FAKE.length;

  const zd: string[] = Array(8).fill("");
  for (let i = 0; i < 100; i++) {
    const lvl = Math.max(0, Math.min(7, Math.floor(((d.z[i] / 2.5 + 1) / 2) * 8)));
    zd[lvl] += `M${16 + (i % 10) * 4} ${CY - 20 + Math.floor(i / 10) * 4}h3v3h-3z`;
  }

  const score = (x: number, y: number, p: number, real: boolean) => (
    <g>
      <rect x={x} y={y + 2} width={36} height={3} fill={T.panel} />
      <rect x={x} y={y + 2} width={Math.max(1, Math.round(p * 36))} height={3} fill={real ? T.accentHi : T.loss} />
      <PText x={x + 56} y={y} text={p.toFixed(2).replace(/^0/, "")} fill={real ? T.text : T.loss} anchor="end" />
    </g>
  );

  return (
    <g>
      <rect x={0} y={0} width={GAN_VIEW.w} height={GAN_VIEW.h} fill={T.ground} />

      {/* ——— generator ——— */}
      <PText x={16} y={CY - 44} text="noise z" fill={T.textDim} />
      {zd.map((p, i) => (p ? <path key={i} d={p} fill={T.ramp[i]} /> : null))}
      <PText x={16} y={CY + 26} text="_{100}" fill={T.textDim} />
      <PText x={70} y={CY - 58} text="generator" fill={T.text} />
      <Wire pts={[[58, CY], [68, CY]]} fill={T.accentLo} step={1} />
      <Bars x={70} y={CY - 10} bars={8} h={21} theme={T} bw={3} gap={2} />
      <Wire pts={[[109, CY], [118, CY]]} fill={T.accentLo} step={1} />
      <Bars x={120} y={CY - 21} bars={4} h={42} theme={T} bw={3} gap={2} />
      <Wire pts={[[139, CY], [148, CY]]} fill={T.accentLo} step={1} />
      <rect x={150} y={CY - 42} width={1} height={84} fill={T.accentHi} />
      <PText x={72} y={CY + 16} text="_{256}" fill={T.textDim} />
      <PText x={120} y={CY + 26} text="_{128}" fill={T.textDim} />
      <PText x={149} y={CY + 47} text="_{1}" fill={T.textDim} />
      <PText x={70} y={CY - 47} text="7→14→28 px" fill={T.textDim} />
      <Wire pts={[[151, CY], [160, CY], [160, FAKE_Y + 28], [COL_X[0] - 3, FAKE_Y + 28]]} fill={T.accentLo} step={1} />

      {/* ——— the arena: real vs fake, each scored by D ——— */}
      <PText x={COL_X[0]} y={REAL_Y - 14} text="real digits" fill={T.text} />
      <PText x={COL_X[0]} y={FAKE_Y - 14} text="fakes G(z)" fill={T.text} />
      <PText x={COL_X[0] + 60} y={FAKE_Y - 14} text="still mush, and D can tell" fill={T.textDim} />
      {SHOW.map((_, k) => (
        <g key={k}>
          <Thumb x={COL_X[k]} y={REAL_Y} data={d.real[k]} theme={T} />
          {score(COL_X[k], REAL_Y + 60, GAN_D_REAL[SHOW[k]], true)}
          <Thumb x={COL_X[k]} y={FAKE_Y} data={d.fake[k]} theme={T} />
          {score(COL_X[k], FAKE_Y + 60, GAN_D_FAKE[SHOW[k]], false)}
        </g>
      ))}
      <PText x={COL_X[0]} y={REAL_Y + 72} text="D(x): how real D thinks it is" fill={T.textDim} />
      <PText x={COL_X[0]} y={FAKE_Y + 72} text="champion v1: older MLP G and D" fill={T.textDim} />

      {/* both rows → D */}
      <Wire pts={[[COL_X[2] + 58, REAL_Y + 28], [382, REAL_Y + 28], [382, CY - 4], [388, CY - 4]]} fill={T.wire} />
      <Wire pts={[[COL_X[2] + 58, FAKE_Y + 28], [382, FAKE_Y + 28], [382, CY + 4], [388, CY + 4]]} fill={T.wire} />

      {/* ——— discriminator ——— */}
      <PText x={390} y={CY - 58} text="discriminator" fill={T.text} />
      <Bars x={390} y={CY - 21} bars={2} h={42} theme={T} bw={3} gap={2} />
      <Wire pts={[[399, CY], [406, CY]]} fill={T.accentLo} step={1} />
      <Bars x={408} y={CY - 10} bars={4} h={21} theme={T} bw={3} gap={2} />
      <Wire pts={[[427, CY], [438, CY]]} fill={T.accentLo} step={1} />
      <rect x={440} y={CY - 1} width={3} height={3} fill={T.accentHi} />
      <PText x={390} y={CY + 26} text="_{64}" fill={T.textDim} />
      <PText x={408} y={CY + 16} text="_{128}" fill={T.textDim} />
      <PText x={390} y={CY - 47} text="14→7 px" fill={T.textDim} />
      <PText x={446} y={CY - 3} text="real?" fill={T.text} />

      {/* ——— losses (from the scores above) ——— */}
      <Wire pts={[[443, CY], [470, CY], [470, 96], [492, 96]]} fill={T.wire} />
      <Diamond cx={498} cy={96} theme={T} />
      <PText x={508} y={80} text="D loss" fill={T.loss} />
      <PText x={508} y={90} text={dLoss.toFixed(2)} fill={T.loss} />
      <PText x={508} y={102} text="real→1" fill={T.textDim} />
      <PText x={508} y={112} text="fake→0" fill={T.textDim} />
      <Wire pts={[[470, CY], [470, 214], [492, 214]]} fill={T.wire} />
      <Diamond cx={498} cy={214} theme={T} />
      <PText x={508} y={198} text="G loss" fill={T.loss} />
      <PText x={508} y={208} text={gLoss.toFixed(2)} fill={T.loss} />
      <PText x={508} y={220} text="fake→1" fill={T.textDim} />

      {/* G learns through D: its gradient flows back */}
      <Wire pts={[[498, 221], [498, 290], [110, 290], [110, CY + 72]]} fill={T.loss} step={3} />
      <PText x={110} y={CY + 64} text="↑" fill={T.loss} anchor="middle" />
      <PText x={260} y={294} text="gradient of G loss flows back through D into G" fill={T.textDim} anchor="middle" />
    </g>
  );
}

// ————— card: G → fakes, reals, D's real scores —————
export const GAN_CARD_VIEW = { w: 190, h: 104 };

export function GANCard({ theme }: { theme: Theme }) {
  const T = theme;
  const d = useMemo(() => ({
    z: gaussian(100, 11),
    real: SHOW.map((i) => digitPixels(MNIST_DIGITS[i])),
    fake: SHOW.map((i) => unNib(GAN_FAKE[i])),
  }), []);
  const zd: string[] = Array(8).fill("");
  for (let i = 0; i < 100; i++) {
    const lvl = Math.max(0, Math.min(7, Math.floor(((d.z[i] / 2.5 + 1) / 2) * 8)));
    zd[lvl] += `M${4 + (i % 10) * 2} ${62 + Math.floor(i / 10) * 2}h2v2h-2z`;
  }
  const bar = (x: number, y: number, p: number, real: boolean) => (
    <g>
      <rect x={x} y={y} width={28} height={2} fill={T.panel} />
      <rect x={x} y={y} width={Math.max(1, Math.round(p * 28))} height={2} fill={real ? T.accentHi : T.loss} />
    </g>
  );
  return (
    <g>
      <rect x={0} y={0} width={GAN_CARD_VIEW.w} height={GAN_CARD_VIEW.h} fill={T.ground} />
      <PText x={4} y={50} text="z" fill={T.textDim} />
      {zd.map((p, i) => (p ? <path key={i} d={p} fill={T.ramp[i]} /> : null))}
      <Bars x={28} y={69} bars={4} h={7} theme={T} bw={1} gap={1} />
      <Bars x={37} y={65} bars={2} h={14} theme={T} bw={1} gap={1} />
      <rect x={43} y={58} width={1} height={28} fill={T.accentHi} />
      <Wire pts={[[45, 72], [52, 72]]} fill={T.accentLo} step={1} />
      <PText x={54} y={4} text="real" fill={T.text} />
      <PText x={54} y={50} text="fake" fill={T.text} />
      {[0, 1, 2].map((k) => (
        <g key={k}>
          <Thumb x={54 + k * 32} y={14} data={d.real[k]} px={1} theme={T} />
          {bar(54 + k * 32, 44, GAN_D_REAL[SHOW[k]], true)}
          <Thumb x={54 + k * 32} y={58} data={d.fake[k]} px={1} theme={T} />
          {bar(54 + k * 32, 88, GAN_D_FAKE[SHOW[k]], false)}
        </g>
      ))}
      <Wire pts={[[148, 28], [154, 28], [154, 50], [158, 50]]} fill={T.wire} />
      <Wire pts={[[148, 72], [154, 72], [154, 54], [158, 54]]} fill={T.wire} />
      <Bars x={160} y={45} bars={2} h={14} theme={T} bw={1} gap={1} />
      <Bars x={166} y={48} bars={4} h={7} theme={T} bw={1} gap={1} />
      <PText x={186} y={62} text="D" fill={T.text} anchor="end" />
      <PText x={4} y={94} text="bars: D(x)" fill={T.textDim} />
    </g>
  );
}
