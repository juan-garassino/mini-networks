"use client";

// SegUNet family: segmentation (binary mask) and unet_ae (reconstruct the
// input), from src/mini_networks/models/segmentation/unet.py (unet_ae reuses
// it unchanged): enc1 32 @28 → pool → enc2 64 @14 → pool → bottleneck 128 @7
// → up + concat enc2 → dec2 64 → up + concat enc1 → dec1 32 → 1×1 → sigmoid.
// REAL (data/{segmentation,unet_ae}-champion.ts, export_unet.py): one
// feature map per level, the outputs for four MNIST test digits, the true
// masks (pixel > 0, the dataset's own rule) and the IoU / MSE.
import { useMemo } from "react";
import * as SEG from "../data/segmentation-champion";
import * as AE from "../data/unet_ae-champion";
import { MNIST_DIGITS, digitPixels } from "../data/mnist-digits";
import { unNib } from "../math";
import { Bars, Diamond, Frame, PText, Thumb, Wire } from "../prims";
import type { Theme } from "../themes";

export const UNET_VIEW = { w: 560, h: 316 };
export const UNET_CARD_VIEW = { w: 190, h: 100 };
export type UNetName = "segmentation" | "unet_ae";

interface D { digits: readonly number[]; maps: readonly string[]; out: readonly string[]; tgt: readonly string[]; metric: readonly number[]; mName: string; good: "high" | "low" }
const DATA: Record<UNetName, D> = {
  segmentation: { digits: SEG.SEG_DIGITS, maps: SEG.SEG_MAPS, out: SEG.SEG_OUT, tgt: SEG.SEG_TGT, metric: SEG.SEG_IOU, mName: "IoU", good: "high" },
  unet_ae: { digits: AE.AE_DIGITS, maps: AE.AE_MAPS, out: AE.AE_OUT, tgt: AE.AE_TGT, metric: AE.AE_MSE, mName: "MSE", good: "low" },
};

const BW = 3, GAP = 2;
const LV = [{ top: 26, h: 84 }, { top: 47, h: 42 }, { top: 57, h: 21 }];
const cyL = (l: number) => LV[l].top + Math.floor(LV[l].h / 2);
const BLK = [
  { x: 92, bars: 2, l: 0, ch: 32 }, { x: 132, bars: 4, l: 1, ch: 64 }, { x: 180, bars: 8, l: 2, ch: 128 },
  { x: 246, bars: 4, l: 1, ch: 64 }, { x: 292, bars: 2, l: 0, ch: 32 },
];
const bw = (n: number) => n * BW + (n - 1) * GAP;

export function UNetDiagram({ theme, name }: { theme: Theme; name: UNetName }) {
  const T = theme;
  const d = DATA[name];
  const v = useMemo(() => ({
    x: d.digits.map((i) => digitPixels(MNIST_DIGITS[i])), maps: d.maps.map((s) => unNib(s)),
    out: d.out.map((s) => unNib(s)), tgt: d.tgt.map((s) => unNib(s)),
  }), [d]);
  const mean = d.metric.reduce((a, b) => a + b, 0) / d.metric.length;
  const fmt = (m: number) => (d.mName === "IoU" ? m.toFixed(2) : m.toFixed(4));
  return (
    <g>
      <rect x={0} y={0} width={UNET_VIEW.w} height={UNET_VIEW.h} fill={T.ground} />
      <PText x={16} y={16} text="input" fill={T.textDim} />
      <Thumb x={16} y={cyL(0) - 28} data={v.x[0]} theme={T} />
      <Wire pts={[[74, cyL(0)], [90, cyL(0)]]} fill={T.accentLo} step={1} />
      {/* skip bridges: the whole point */}
      <Wire pts={[[BLK[0].x + 4, LV[0].top - 2], [BLK[0].x + 4, 12], [BLK[4].x + 4, 12], [BLK[4].x + 4, LV[0].top - 2]]} fill={T.wireHot} />
      <Wire pts={[[BLK[1].x + 9, LV[1].top - 2], [BLK[1].x + 9, 30], [BLK[3].x + 9, 30], [BLK[3].x + 9, LV[1].top - 2]]} fill={T.wireHot} />
      <PText x={200} y={2} text="skip: copy + concat" fill={T.wireHot} anchor="middle" />
      {BLK.map((b, i) => {
        const nx = BLK[i + 1];
        return (
          <g key={i}>
            <Bars x={b.x} y={LV[b.l].top} bars={b.bars} h={LV[b.l].h} theme={T} bw={BW} gap={GAP} />
            <PText x={b.x} y={LV[b.l].top + LV[b.l].h + 3} text={`_{${b.ch}}`} fill={T.textDim} />
            {nx && <Wire pts={[[b.x + bw(b.bars) + 1, cyL(b.l)], [nx.x - 2, cyL(nx.l)]]} fill={T.accentLo} step={1} />}
          </g>
        );
      })}
      <Wire pts={[[BLK[4].x + bw(2) + 1, cyL(0)], [316, cyL(0)]]} fill={T.accentLo} step={1} />
      <rect x={318} y={LV[0].top} width={1} height={LV[0].h} fill={T.accentHi} />
      <Wire pts={[[320, cyL(0)], [332, cyL(0)]]} fill={T.accentLo} step={1} />
      <PText x={334} y={16} text={name === "segmentation" ? "mask" : "rebuilt"} fill={T.text} />
      <Thumb x={334} y={cyL(0) - 28} data={v.out[0]} theme={T} />
      <PText x={404} y={16} text={name === "segmentation" ? "true mask" : "target"} fill={T.textDim} />
      <Thumb x={404} y={cyL(0) - 28} data={v.tgt[0]} theme={T} />
      <Wire pts={[[392, cyL(0) + 34], [392, cyL(0) + 44], [470, cyL(0) + 44], [470, cyL(0) + 34]]} fill={T.wire} />
      <Diamond cx={480} cy={cyL(0)} theme={T} r={5} />
      <PText x={490} y={cyL(0) - 6} text={name === "segmentation" ? "BCE+Dice" : "MSE"} fill={T.loss} />
      <PText x={490} y={cyL(0) + 4} text={name === "segmentation" ? `IoU ${fmt(d.metric[0])}` : fmt(d.metric[0])} fill={T.loss} />
      {/* real maps per level */}
      <PText x={16} y={122} text="a real map" fill={T.textDim} />
      <PText x={16} y={132} text="per level" fill={T.textDim} />
      <Thumb x={86} y={122} data={v.maps[0]} n={28} px={1} theme={T} />
      <Thumb x={128} y={122} data={v.maps[1]} n={14} px={2} theme={T} />
      <Thumb x={186} y={122} data={v.maps[2]} n={7} px={4} theme={T} />
      <PText x={216} y={126} text={name === "unet_ae" ? "the 7×7 bottleneck barely matters:" : "28 → 14 → 7 px, then back up"} fill={T.textDim} />
      {name === "unet_ae" && <PText x={216} y={136} text="the skips hand detail straight across" fill={T.textDim} />}

      <rect x={10} y={158} width={540} height={148} fill={T.panel} />
      <Frame x={10} y={158} w={540} h={148} fill={T.frame} />
      <PText x={20} y={166} text={`four test digits, the champion's output, the target (mean ${d.mName} ${fmt(mean)})`} fill={T.wireHot} />
      {d.digits.map((_, k) => {
        const x = 24 + k * 132;
        return (
          <g key={k}>
            <Thumb x={x} y={186} data={v.x[k]} n={28} px={1} theme={T} />
            <Thumb x={x + 32} y={186} data={v.out[k]} n={28} px={1} theme={T} />
            <Thumb x={x + 64} y={186} data={v.tgt[k]} n={28} px={1} theme={T} />
            <PText x={x} y={220} text={`${d.mName} ${fmt(d.metric[k])}`} fill={T.text} />
          </g>
        );
      })}
      <PText x={24} y={236} text="in, out, target" fill={T.textDim} />
      <PText x={24} y={256} text={name === "segmentation"
        ? "the label for every pixel: stroke or background; loss = BCE + Dice (Dice handles the few stroke pixels)"
        : "same network as segmentation, target = the input itself; a UNet is almost too good an autoencoder"} fill={T.textDim} />
      <PText x={24} y={266} text={name === "segmentation"
        ? "skips carry exact stroke positions the 7×7 bottleneck has lost"
        : "(the skips skip the compression) — compare the VAE, which has no skips"} fill={T.textDim} />
    </g>
  );
}

export function UNetCard({ theme, name }: { theme: Theme; name: UNetName }) {
  const T = theme;
  const d = DATA[name];
  const v = useMemo(() => ({ x: digitPixels(MNIST_DIGITS[d.digits[0]]), out: unNib(d.out[0]) }), [d]);
  const lv = [{ t: 20, h: 28 }, { t: 27, h: 14 }, { t: 31, h: 7 }];
  const bl = [{ x: 40, n: 2, l: 0 }, { x: 50, n: 4, l: 1 }, { x: 64, n: 8, l: 2 }, { x: 84, n: 4, l: 1 }, { x: 96, n: 2, l: 0 }];
  return (
    <g>
      <rect x={0} y={0} width={UNET_CARD_VIEW.w} height={UNET_CARD_VIEW.h} fill={T.ground} />
      <Thumb x={4} y={20} data={v.x} px={1} theme={T} />
      <Wire pts={[[41, 16], [41, 8], [97, 8], [97, 16]]} fill={T.wireHot} />
      <Wire pts={[[52, 24], [52, 14], [87, 14], [87, 24]]} fill={T.wireHot} />
      {bl.map((b, i) => Array.from({ length: b.n }, (_, k) => (
        <rect key={`${i}${k}`} x={b.x + k * 2} y={lv[b.l].t} width={1} height={lv[b.l].h} fill={T.accent} />
      )))}
      <Thumb x={108} y={20} data={v.out} px={1} theme={T} />
      <PText x={142} y={24} text={d.mName} fill={T.loss} />
      <PText x={142} y={34} text={d.mName === "IoU" ? d.metric[0].toFixed(2) : d.metric[0].toFixed(4)} fill={T.loss} />
      <PText x={4} y={62} text="skips carry detail across" fill={T.wireHot} />
      <PText x={4} y={72} text={name === "segmentation" ? "real champion mask" : "real champion rebuild"} fill={T.textDim} />
    </g>
  );
}
