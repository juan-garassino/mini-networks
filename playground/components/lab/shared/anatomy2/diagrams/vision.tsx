"use client";

// Vision-classifier family (resnet / mobilenet / convnext / vit): one shared
// "spine" — the real MNIST test 7, one real feature map per stage (the
// highest-contrast channel), 10 real logits — plus an inset that opens the ONE
// block that makes each model what it is, drawn from its own code with real
// maps from its local champion (data/<model>-champion.ts, export_vision.py):
//   resnet     models/resnet/model.py      BasicBlock: F(x) + shortcut(x)
//   mobilenet  models/mobilenet + core/blocks/cnn.py DepthwiseSeparable:
//              depthwise 3×3 (one filter per channel) → pointwise 1×1 → BN·ReLU
//   convnext   models/convnext/model.py    dw 3×3 → LayerNorm → 1×1 ×4 → GELU
//              → 1×1 back → + x   (inverted bottleneck)
//   vit        models/vit/model.py         4×4 patches → 64-d tokens + CLS →
//              4 encoder layers × 4 heads → CLS → 10 logits
import { useMemo, type ReactNode } from "react";
import { MNIST_DIGITS, digitPixels } from "../data/mnist-digits";
import * as RES from "../data/resnet-champion";
import * as MOB from "../data/mobilenet-champion";
import * as CNX from "../data/convnext-champion";
import * as VIT from "../data/vit-champion";
import { softmax, unNib } from "../math";
import { Bars, Diamond, Frame, Node, PText, Thumb, Wire } from "../prims";
import type { Theme } from "../themes";

export const VISION_VIEW = { w: 560, h: 316 };
export const VISION_CARD_VIEW = { w: 190, h: 104 }; // caption moved to card.caption
export type VisionName = "resnet" | "mobilenet" | "convnext" | "vit";

interface Stage { label: string; res: number; ch: number; idx: number; map: string }
interface Spec {
  stages: readonly Stage[];
  logits: readonly number[];
  allPred: readonly number[];
  arch: string;          // one line under the spine, from the code
  inset: string;         // inset title
  Inset: (p: { theme: Theme; x: number; y: number }) => ReactNode;
  Mini: (p: { theme: Theme; x: number; y: number }) => ReactNode; // card key view (≈ 120×56)
}

const DIGIT = MNIST_DIGITS[7];
const pxFor = (res: number) => (res >= 28 ? 2 : res >= 14 ? 3 : 4);
const sizeFor = (res: number) => res * pxFor(res);

/* ————————————————————— resnet: F(x) + x ————————————————————— */
function ResInset({ theme: T, x, y }: { theme: Theme; x: number; y: number }) {
  const s = RES.RESNET_SIG;
  const d = useMemo(() => ({ in: unNib(s.in), f: unNib(s.f), sc: unNib(s.sc), sum: unNib(s.sum), out: unNib(s.out) }), [s]);
  const my = y + 30;
  return (
    <g>
      <PText x={x} y={y - 2} text={`x: ch #${s.inIdx} of 32`} fill={T.textDim} />
      <Thumb x={x} y={y + 10} data={d.in} n={28} px={2} theme={T} />
      {/* residual branch */}
      <Wire pts={[[x + 58, my], [x + 70, my]]} fill={T.accentLo} step={1} />
      <Bars x={x + 72} y={my - 12} bars={2} h={24} theme={T} bw={3} gap={2} />
      <Wire pts={[[x + 81, my], [x + 92, my]]} fill={T.accentLo} step={1} />
      <Bars x={x + 94} y={my - 12} bars={4} h={24} theme={T} bw={3} gap={2} />
      <PText x={x + 70} y={my + 16} text="conv s2" fill={T.textDim} />
      <PText x={x + 70} y={my + 26} text="conv" fill={T.textDim} />
      <Wire pts={[[x + 113, my], [x + 124, my]]} fill={T.accentLo} step={1} />
      <Thumb x={x + 126} y={my - 21} data={d.f} n={14} px={3} theme={T} />
      <PText x={x + 126} y={my + 25} text="F(x)" fill={T.text} />
      {/* shortcut: the skip */}
      <Wire pts={[[x + 40, y + 68], [x + 40, y + 107], [x + 124, y + 107]]} fill={T.wireHot} step={1} />
      <PText x={x + 46} y={y + 95} text="skip, 1×1 s2" fill={T.wireHot} />
      <Thumb x={x + 126} y={y + 86} data={d.sc} n={14} px={3} theme={T} />
      {/* add + relu */}
      <Wire pts={[[x + 170, my], [x + 184, my], [x + 184, y + 64]]} fill={T.wire} />
      <Wire pts={[[x + 170, y + 107], [x + 184, y + 107], [x + 184, y + 76]]} fill={T.wireHot} />
      <Node cx={x + 184} cy={y + 70} glyph="+" theme={T} hot />
      <Wire pts={[[x + 190, y + 70], [x + 202, y + 70]]} fill={T.wire} />
      <Thumb x={x + 204} y={y + 49} data={d.sum} n={14} px={3} theme={T} />
      <PText x={x + 204} y={y + 95} text="F(x)+x" fill={T.text} />
      <Wire pts={[[x + 248, y + 70], [x + 262, y + 70]]} fill={T.wire} />
      <Thumb x={x + 264} y={y + 49} data={d.out} n={14} px={3} theme={T} />
      <PText x={x + 264} y={y + 95} text="ReLU" fill={T.text} />
      <PText x={x + 320} y={y + 40} text="the block only has to" fill={T.textDim} />
      <PText x={x + 320} y={y + 50} text="learn a correction F(x);" fill={T.textDim} />
      <PText x={x + 320} y={y + 60} text="the skip carries x through," fill={T.textDim} />
      <PText x={x + 320} y={y + 70} text="so gradients do too" fill={T.textDim} />
      <PText x={x + 320} y={y + 90} text={`out: ch #${s.outIdx} of 64, 14 px`} fill={T.textDim} />
    </g>
  );
}
function ResMini({ theme: T, x, y }: { theme: Theme; x: number; y: number }) {
  const s = RES.RESNET_SIG;
  const f = useMemo(() => unNib(s.f), [s]), sc = useMemo(() => unNib(s.sc), [s]), sum = useMemo(() => unNib(s.sum), [s]);
  return (
    <g>
      <Thumb x={x} y={y} data={f} n={14} px={2} theme={T} />
      <PText x={x} y={y + 31} text="F(x)" fill={T.text} />
      <Thumb x={x} y={y + 42} data={sc} n={14} px={2} theme={T} />
      <PText x={x + 32} y={y + 50} text="skip" fill={T.wireHot} />
      <Wire pts={[[x + 30, y + 14], [x + 58, y + 14], [x + 58, y + 26]]} fill={T.wire} />
      <Wire pts={[[x + 30, y + 56], [x + 58, y + 56], [x + 58, y + 38]]} fill={T.wireHot} />
      <Node cx={x + 58} cy={y + 32} glyph="+" theme={T} hot />
      <Wire pts={[[x + 64, y + 32], [x + 70, y + 32]]} fill={T.wire} />
      <Thumb x={x + 72} y={y + 18} data={sum} n={14} px={2} theme={T} />
    </g>
  );
}

/* ————————————— mobilenet: depthwise, then pointwise ————————————— */
function MobInset({ theme: T, x, y }: { theme: Theme; x: number; y: number }) {
  const s = MOB.MOBILENET_SIG;
  const d = useMemo(() => ({
    in: s.in.map((m) => unNib(m)), k: s.dwK.map((m) => unNib(m)), dw: s.dw.map((m) => unNib(m)), out: s.out.map((m) => unNib(m)),
  }), [s]);
  const row = (i: number) => y + 14 + i * 29;
  const orow = (j: number) => y + 22 + j * 36;
  return (
    <g>
      <PText x={x} y={y - 8} text="4 of 32" fill={T.textDim} />
      <PText x={x + 60} y={y - 8} text="depthwise 3×3 s2" fill={T.textDim} />
      <PText x={x + 60} y={y + 2} text="one filter per channel" fill={T.wireHot} />
      <PText x={x + 196} y={y - 8} text="pointwise 1×1" fill={T.textDim} />
      <PText x={x + 196} y={y + 2} text="mixes channels" fill={T.wireHot} />
      {d.in.map((m, i) => (
        <g key={i}>
          <Thumb x={x} y={row(i)} data={m} n={28} px={1} theme={T} />
          <Wire pts={[[x + 30, row(i) + 14], [x + 70, row(i) + 14]]} fill={T.wire} />
          <Thumb x={x + 72} y={row(i) + 8} data={d.k[i]} n={3} px={4} theme={T} />
          <Wire pts={[[x + 86, row(i) + 14], [x + 100, row(i) + 14]]} fill={T.wire} />
          <Thumb x={x + 102} y={row(i)} data={d.dw[i]} n={14} px={2} theme={T} />
        </g>
      ))}
      {/* pointwise: every dw channel → every output channel, weight = brightness */}
      {s.pwW.map((wr, j) => wr.map((w, i) => (
        <Wire key={`${i}${j}`} pts={[[x + 132, row(i) + 14], [x + 222, orow(j) + 14]]}
          fill={Math.abs(w) > 0.5 ? (w > 0 ? T.wireHot : T.loss) : T.wire} step={Math.abs(w) > 0.5 ? 1 : 3} />
      )))}
      {d.out.map((m, j) => (
        <g key={j}>
          <Thumb x={x + 224} y={orow(j)} data={m} n={14} px={2} theme={T} />
          <PText x={x + 256} y={orow(j) + 10} text={`#${s.outIdx[j]}`} fill={T.textDim} />
        </g>
      ))}
      <PText x={x + 150} y={y + 124} text="line: + weight / − weight" fill={T.textDim} />
      <PText x={x + 300} y={y + 30} text="weights for 32→64:" fill={T.textDim} />
      <PText x={x + 300} y={y + 42} text={`plain 3×3   ${s.costStd.toLocaleString("en")}`} fill={T.text} />
      <PText x={x + 300} y={y + 52} text={`separable   ${s.costSep.toLocaleString("en")}`} fill={T.wireHot} />
      <PText x={x + 300} y={y + 66} text={`${(s.costStd / s.costSep).toFixed(1)}× fewer`} fill={T.wireHot} />
    </g>
  );
}
function MobMini({ theme: T, x, y }: { theme: Theme; x: number; y: number }) {
  const s = MOB.MOBILENET_SIG;
  const dw = useMemo(() => s.dw.map((m) => unNib(m)), [s]);
  const out = useMemo(() => s.out.map((m) => unNib(m)), [s]);
  return (
    <g>
      {dw.slice(0, 3).map((m, i) => <Thumb key={i} x={x} y={y + i * 20} data={m} n={14} px={1} theme={T} />)}
      {s.pwW.map((wr, j) => wr.slice(0, 3).map((w, i) => (
        <Wire key={`${i}${j}`} pts={[[x + 16, y + i * 20 + 7], [x + 50, y + j * 20 + 7]]} fill={Math.abs(w) > 0.5 ? T.wireHot : T.wire} step={2} />
      )))}
      {out.map((m, j) => <Thumb key={j} x={x + 52} y={y + j * 20} data={m} n={14} px={1} theme={T} />)}
      <PText x={x} y={y + 62} text="dw" fill={T.textDim} />
      <PText x={x + 52} y={y + 62} text="pw" fill={T.textDim} />
    </g>
  );
}

/* ——————————— convnext: inverted bottleneck + skip ——————————— */
function CnxInset({ theme: T, x, y }: { theme: Theme; x: number; y: number }) {
  const s = CNX.CONVNEXT_SIG;
  const d = useMemo(() => ({ x: unNib(s.x), dw: unNib(s.dw), exp: s.exp.map((m) => unNib(m)), proj: unNib(s.proj), sum: unNib(s.sum) }), [s]);
  const cy = y + 50;
  return (
    <g>
      <Thumb x={x} y={cy - 28} data={d.x} n={28} px={2} theme={T} />
      <PText x={x} y={cy + 32} text="x (32ch)" fill={T.textDim} />
      <Wire pts={[[x + 58, cy], [x + 70, cy]]} fill={T.wire} />
      <Thumb x={x + 72} y={cy - 14} data={d.dw} n={28} px={1} theme={T} />
      <PText x={x + 72} y={cy + 18} text="dw 3×3" fill={T.textDim} />
      <PText x={x + 72} y={cy + 28} text="LayerNorm" fill={T.textDim} />
      <Wire pts={[[x + 102, cy], [x + 114, cy]]} fill={T.wire} />
      {/* the fat middle: 32 → 128 → 32 */}
      <Bars x={x + 116} y={cy - 12} bars={2} h={24} theme={T} bw={3} gap={2} />
      <Bars x={x + 130} y={cy - 12} bars={8} h={24} theme={T} bw={3} gap={2} />
      <Bars x={x + 172} y={cy - 12} bars={2} h={24} theme={T} bw={3} gap={2} />
      <PText x={x + 114} y={cy - 36} text="1×1 up ×4, GELU, 1×1 down" fill={T.wireHot} />
      <PText x={x + 116} y={cy - 24} text="_{32}" fill={T.textDim} />
      <PText x={x + 146} y={cy - 24} text="_{128}" fill={T.textDim} />
      <PText x={x + 172} y={cy - 24} text="_{32}" fill={T.textDim} />
      {d.exp.map((m, i) => <Thumb key={i} x={x + 124 + i * 30} y={cy + 16} data={m} n={28} px={1} theme={T} />)}
      <PText x={x + 124} y={cy + 48} text="4 of the 128 wide maps" fill={T.textDim} />
      <Wire pts={[[x + 182, cy], [x + 194, cy]]} fill={T.wire} />
      <Thumb x={x + 196} y={cy - 14} data={d.proj} n={28} px={1} theme={T} />
      <Wire pts={[[x + 226, cy], [x + 238, cy]]} fill={T.wire} />
      <Node cx={x + 244} cy={cy} glyph="+" theme={T} hot />
      <Wire pts={[[x + 29, cy + 40], [x + 29, cy + 70], [x + 244, cy + 70], [x + 244, cy + 6]]} fill={T.wireHot} step={1} />
      <PText x={x + 36} y={cy + 74} text="skip: x is added back" fill={T.wireHot} />
      <Wire pts={[[x + 250, cy], [x + 262, cy]]} fill={T.wire} />
      <Thumb x={x + 264} y={cy - 28} data={d.sum} n={28} px={2} theme={T} />
      <PText x={x + 264} y={cy + 32} text="x + block(x)" fill={T.text} />
      <PText x={x + 330} y={cy - 20} text="wide in the middle," fill={T.textDim} />
      <PText x={x + 330} y={cy - 10} text="narrow at the ends:" fill={T.textDim} />
      <PText x={x + 330} y={cy} text="the inverse of a" fill={T.textDim} />
      <PText x={x + 330} y={cy + 10} text="ResNet bottleneck" fill={T.textDim} />
      <PText x={x + 330} y={cy + 26} text={`channel #${s.k}`} fill={T.textDim} />
    </g>
  );
}
function CnxMini({ theme: T, x, y }: { theme: Theme; x: number; y: number }) {
  const s = CNX.CONVNEXT_SIG;
  const xm = useMemo(() => unNib(s.x), [s]), sm = useMemo(() => unNib(s.sum), [s]);
  return (
    <g>
      <Thumb x={x} y={y + 14} data={xm} n={28} px={1} theme={T} />
      <Bars x={x + 34} y={y + 20} bars={2} h={16} theme={T} bw={1} gap={1} />
      <Bars x={x + 40} y={y + 20} bars={8} h={16} theme={T} bw={1} gap={1} />
      <Bars x={x + 58} y={y + 20} bars={2} h={16} theme={T} bw={1} gap={1} />
      <PText x={x + 32} y={y + 6} text="32→128→32" fill={T.wireHot} />
      <Wire pts={[[x + 14, y + 44], [x + 14, y + 52], [x + 72, y + 52], [x + 72, y + 30]]} fill={T.wireHot} step={1} />
      <Thumb x={x + 76} y={y + 14} data={sm} n={28} px={1} theme={T} />
    </g>
  );
}

/* ——————————— vit: patches, tokens, attention ——————————— */
function vitCls(layer: number, head: number | null): Float32Array {
  const hs = VIT.VIT_SIG.cls[layer];
  const maps = hs.map((h, i) => unNib(h).map((v) => ((v + 1) / 2) * VIT.VIT_SIG.clsMax[layer][i]));
  const out = new Float32Array(49);
  for (let k = 0; k < 49; k++) out[k] = head === null ? maps.reduce((a, m) => a + m[k], 0) / maps.length : maps[head][k];
  let mx = 1e-9;
  for (const v of out) mx = Math.max(mx, v);
  return out.map((v) => Math.sqrt(v / mx) * 2 - 1); // display: brightness = √(weight/max)
}
/** the digit's strokes as 1-px dots on a 3-px grid, to overlay a heat map */
function stencil(d: Float32Array, x: number, y: number): string {
  let p = "";
  for (let r = 0; r < 28; r++) for (let c = 0; c < 28; c++) if (d[r * 28 + c] > 0.2) p += `M${x + c * 3 + 1} ${y + r * 3 + 1}h1v1h-1z`;
  return p;
}
function VitInset({ theme: T, x, y }: { theme: Theme; x: number; y: number }) {
  const digit = useMemo(() => digitPixels(DIGIT), []);
  const last = useMemo(() => vitCls(3, null), []);
  const heads = useMemo(() => [0, 1, 2, 3].map((l) => [0, 1, 2, 3].map((h) => vitCls(l, h))), []);
  // digit cut into 7×7 patches of 4×4 (1 art px gap between patches)
  const cells: ReactNode[] = [];
  for (let py = 0; py < 7; py++) for (let px = 0; px < 7; px++) {
    const patch = new Float32Array(16);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) patch[r * 4 + c] = digit[(py * 4 + r) * 28 + px * 4 + c];
    cells.push(<Thumb key={`${py}${px}`} x={x + px * 13} y={y + 10 + py * 13} data={patch} n={4} px={3} theme={T} frame={false} />);
  }
  return (
    <g>
      <PText x={x} y={y} text="49 patches of 4×4 px" fill={T.textDim} />
      {cells}
      <Wire pts={[[x + 94, y + 55], [x + 110, y + 55]]} fill={T.wire} />
      {/* token column: CLS + 49 patch tokens, each → 64 numbers */}
      <PText x={x + 112} y={y} text="tokens" fill={T.textDim} />
      <rect x={x + 112} y={y + 10} width={16} height={2} fill={T.wireHot} />
      {Array.from({ length: 49 }, (_, i) => <rect key={i} x={x + 112} y={y + 13 + i * 2} width={16} height={1} fill={T.accent} />)}
      <PText x={x + 132} y={y + 8} text="CLS" fill={T.wireHot} />
      <PText x={x + 132} y={y + 20} text="+49" fill={T.textDim} />
      <PText x={x + 132} y={y + 30} text="×64" fill={T.textDim} />
      <Wire pts={[[x + 150, y + 60], [x + 158, y + 60]]} fill={T.wire} />
      <Bars x={x + 160} y={y + 10} bars={2} h={100} theme={T} bw={3} gap={2} />
      <Bars x={x + 174} y={y + 10} bars={2} h={100} theme={T} bw={3} gap={2} />
      <Bars x={x + 188} y={y + 10} bars={2} h={100} theme={T} bw={3} gap={2} />
      <Bars x={x + 202} y={y + 10} bars={2} h={100} theme={T} bw={3} gap={2} />
      <PText x={x + 160} y={y} text="4 layers" fill={T.textDim} />
      <Wire pts={[[x + 212, y + 60], [x + 224, y + 60]]} fill={T.wire} />
      {/* where CLS looks in the last layer, over the digit */}
      <PText x={x + 226} y={y} text="CLS attention, layer 4" fill={T.wireHot} />
      <Thumb x={x + 226} y={y + 10} data={last} n={7} px={12} theme={T} heat />
      <path d={stencil(digit, x + 226, y + 10)} fill={T.loss} />
      <PText x={x + 226} y={y + 100} text="mean of 4 heads;" fill={T.textDim} />
      <PText x={x + 226} y={y + 110} text="dots = the 7" fill={T.loss} />
      {/* all 16 heads */}
      <PText x={x + 340} y={y} text="every layer × head (rows = layers)" fill={T.textDim} />
      {heads.map((L, l) => L.map((m, h) => (
        <Thumb key={`${l}${h}`} x={x + 340 + h * 25} y={y + 12 + l * 25} data={m} n={7} px={3} theme={T} heat />
      )))}
      <PText x={x + 442} y={y + 16} text="L1 spreads" fill={T.textDim} />
      <PText x={x + 442} y={y + 26} text="evenly" fill={T.textDim} />
    </g>
  );
}
function VitMini({ theme: T, x, y }: { theme: Theme; x: number; y: number }) {
  const last = useMemo(() => vitCls(3, null), []);
  const digit = useMemo(() => digitPixels(DIGIT), []);
  return (
    <g>
      <Thumb x={x} y={y + 6} data={digit} n={28} px={1} theme={T} />
      {[1, 2, 3, 4, 5, 6].map((k) => (
        <g key={k}>
          <rect x={x + k * 4} y={y + 6} width={1} height={28} fill={T.ground} opacity={0.8} />
          <rect x={x} y={y + 6 + k * 4} width={28} height={1} fill={T.ground} opacity={0.8} />
        </g>
      ))}
      <PText x={x} y={y + 38} text="patches" fill={T.textDim} />
      <Wire pts={[[x + 31, y + 20], [x + 42, y + 20]]} fill={T.wire} />
      <Thumb x={x + 44} y={y + 6} data={last} n={7} px={4} theme={T} heat />
      <PText x={x + 44} y={y + 38} text="CLS looks" fill={T.wireHot} />
    </g>
  );
}

const SPECS: Record<VisionName, Spec> = {
  resnet: {
    stages: RES.RESNET_STAGES, logits: RES.RESNET_LOGITS, allPred: RES.RESNET_ALL_PRED,
    arch: "stem 32, then 3 residual blocks (32, 64 s2, 128 s2), avg pool, 10 logits",
    inset: "inside block 2: the residual skip", Inset: ResInset, Mini: ResMini,
  },
  mobilenet: {
    stages: MOB.MOBILENET_STAGES, logits: MOB.MOBILENET_LOGITS, allPred: MOB.MOBILENET_ALL_PRED,
    arch: "stem 32, then 2 separable blocks (64 s2, 128 s2), avg pool, 10 logits",
    inset: "inside separable block 1: split one conv into two cheap ones", Inset: MobInset, Mini: MobMini,
  },
  convnext: {
    stages: CNX.CONVNEXT_STAGES, logits: CNX.CONVNEXT_LOGITS, allPred: CNX.CONVNEXT_ALL_PRED,
    arch: "stem 32, 3 ConvNeXt blocks (32, 64, 128) with 2×2 s2 downsampling, avg pool, 10 logits",
    inset: "inside stage 1: the inverted bottleneck", Inset: CnxInset, Mini: CnxMini,
  },
  vit: {
    stages: VIT.VIT_STAGES, logits: VIT.VIT_LOGITS, allPred: VIT.VIT_ALL_PRED,
    arch: "4×4 patches → 64-d tokens + CLS + positions, 4 encoder layers × 4 heads (mlp 128), CLS → 10 logits",
    inset: "no convolutions: the image becomes 49 tokens that attend to each other", Inset: VitInset, Mini: VitMini,
  },
};

function Logits({ theme: T, x, y, logits, rowH = 9, barW = 50 }: { theme: Theme; x: number; y: number; logits: readonly number[]; rowH?: number; barW?: number }) {
  const p = softmax([...logits]);
  const pred = p.indexOf(Math.max(...p));
  return (
    <g>
      {p.map((v, k) => (
        <g key={k}>
          <PText x={x} y={y + k * rowH} text={`_{${k}}`} fill={k === pred ? T.wireHot : T.textDim} />
          <rect x={x + 6} y={y + k * rowH + 2} width={barW} height={3} fill={T.panel} />
          <rect x={x + 6} y={y + k * rowH + 2} width={Math.max(1, Math.round(v * barW))} height={3} fill={k === pred ? T.accentHi : T.accent} />
        </g>
      ))}
    </g>
  );
}

export function VisionDiagram({ theme, name }: { theme: Theme; name: VisionName }) {
  const T = theme;
  const S = SPECS[name];
  const digit = useMemo(() => digitPixels(DIGIT), []);
  const maps = useMemo(() => S.stages.map((s) => unNib(s.map)), [S]);
  const p = softmax([...S.logits]);
  const ce = -Math.log(Math.max(1e-9, p[7]));
  const hits = S.allPred.filter((v, i) => v === i).length;
  // spine columns
  const cols: { x: number; w: number }[] = [];
  const sumW = S.stages.reduce((a, s) => a + sizeFor(s.res), 0);
  const gap = Math.max(22, Math.min(48, Math.floor((400 - 72 - sumW) / S.stages.length)));
  let cx = 16 + 56 + gap;
  for (const s of S.stages) { cols.push({ x: cx, w: sizeFor(s.res) }); cx += sizeFor(s.res) + gap; }
  const SY = 26;
  const CAP_Y = SY + 28 + Math.max(28, ...cols.map((c) => Math.ceil(c.w / 2))) + 4;
  const LX = Math.max(cx + 4, 420);
  return (
    <g>
      <rect x={0} y={0} width={VISION_VIEW.w} height={VISION_VIEW.h} fill={T.ground} />
      <PText x={16} y={SY - 12} text="test 0, a 7" fill={T.textDim} />
      <Thumb x={16} y={SY} data={digit} theme={T} />
      {S.stages.map((s, i) => {
        const c = cols[i];
        const prevR = i === 0 ? 72 : cols[i - 1].x + cols[i - 1].w;
        return (
          <g key={i}>
            <Wire pts={[[prevR + 2, SY + 28], [c.x - 3, SY + 28]]} fill={T.accentLo} step={1} />
            <PText x={c.x} y={SY - 12} text={s.label} fill={T.text} />
            <Thumb x={c.x} y={SY + 28 - Math.floor(c.w / 2)} data={maps[i]} n={s.res} px={pxFor(s.res)} theme={T} />
            {/* every stage caption shares one row under the tallest (56 px) map */}
            <PText x={c.x} y={CAP_Y} text={`${s.ch} ch`} fill={T.textDim} />
            <PText x={c.x} y={CAP_Y + 10} text={`${s.res} px`} fill={T.textDim} />
          </g>
        );
      })}
      <Wire pts={[[cols[cols.length - 1].x + cols[cols.length - 1].w + 2, SY + 28], [LX - 4, SY + 28]]} fill={T.accentLo} step={1} />
      <PText x={LX} y={SY - 12} text="10 logits" fill={T.text} />
      <Logits theme={T} x={LX} y={SY - 2} logits={S.logits} />
      <Diamond cx={LX + 80} cy={SY + 28} theme={T} r={5} />
      <PText x={LX + 80} y={SY + 38} text={`CE ${ce.toFixed(2)}`} fill={T.loss} anchor="middle" />
      <PText x={LX + 80} y={SY + 48} text={`${hits}/10 digits`} fill={T.textDim} anchor="middle" />
      <PText x={16} y={SY + 90} text={S.arch} fill={T.textDim} />

      {/* the distinguishing block */}
      <rect x={10} y={134} width={540} height={172} fill={T.panel} />
      <Frame x={10} y={134} w={540} h={172} fill={T.frame} />
      <PText x={20} y={142} text={S.inset} fill={T.wireHot} />
      <S.Inset theme={T} x={24} y={168} />
    </g>
  );
}

/** The card's footer caption: the inset's subject ("block 2", "stage 1"). */
export const visionCaption = (name: VisionName): string => SPECS[name].inset.split(":")[0].replace("inside ", "");

export function VisionCard({ theme, name }: { theme: Theme; name: VisionName }) {
  const T = theme;
  const S = SPECS[name];
  const digit = useMemo(() => digitPixels(DIGIT), []);
  return (
    <g>
      <rect x={0} y={0} width={VISION_CARD_VIEW.w} height={VISION_CARD_VIEW.h} fill={T.ground} />
      <Thumb x={4} y={24} data={digit} px={1} theme={T} />
      <Wire pts={[[33, 38], [40, 38]]} fill={T.wire} />
      <S.Mini theme={T} x={42} y={8} />
      <Logits theme={T} x={150} y={10} logits={S.logits} rowH={9} barW={30} />
    </g>
  );
}
