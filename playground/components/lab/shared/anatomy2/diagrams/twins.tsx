"use client";

// Twin-view family: simclr / dino / vision_embed. Two REAL augmented views of
// each digit (the code's own ContrastivePairFromDigits transform:
// RandomResizedCrop 0.8–1 + RandomRotation 20, seed 2026) go through the
// encoder(s); the objective acts on the embeddings. Everything is from the
// local champions (export_twins.py):
//   simclr        models/simclr: 2 conv → 128 → projection 128→128→64,
//                 L2-normalised; InfoNCE over the batch, T = 0.2
//   dino          models/dino: student MiniViT + head → 64 prototypes; teacher
//                 = EMA 0.99 of the student, centred and sharpened
//                 (T 0.07 vs student 0.1); cross-view cross-entropy
//   vision_embed  models/vision_embed: 2 conv → Linear 64 → L2-normalise
import { useMemo } from "react";
import * as SIM from "../data/simclr-champion";
import * as DNO from "../data/dino-champion";
import * as VE from "../data/vision_embed-champion";
import { MNIST_DIGITS, digitPixels } from "../data/mnist-digits";
import { unNib } from "../math";
import { Bars, Diamond, Frame, PText, Thumb, Wire } from "../prims";
import { heatIndex, type Theme } from "../themes";

export const TWIN_VIEW = { w: 560, h: 316 };
export const TWIN_CARD_VIEW = { w: 190, h: 116 };
export type TwinName = "simclr" | "dino" | "vision_embed";

const K = 6;
const VIEWS: Record<TwinName, { v1: readonly string[]; v2: readonly string[]; pca: readonly (readonly number[])[] }> = {
  simclr: { v1: SIM.SIMCLR_V1, v2: SIM.SIMCLR_V2, pca: SIM.SIMCLR_PCA },
  dino: { v1: DNO.DINO_V1, v2: DNO.DINO_V2, pca: DNO.DINO_PCA },
  vision_embed: { v1: VE.VE_V1, v2: VE.VE_V2, pca: VE.VE_PCA },
};

/** 2-D PCA scatter: 10 digits (their numeral) + the 12 views (dots joined to their pair) */
function Space({ theme: T, x, y, s, pca, small = false }: { theme: Theme; x: number; y: number; s: number; pca: readonly (readonly number[])[]; small?: boolean }) {
  const px = (v: number) => Math.round(x + s / 2 + v * (s / 2 - 6));
  const py = (v: number) => Math.round(y + s / 2 - v * (s / 2 - 6));
  return (
    <g>
      <rect x={x} y={y} width={s} height={s} fill={T.panel} />
      <Frame x={x - 1} y={y - 1} w={s + 2} h={s + 2} fill={T.frame} />
      {Array.from({ length: K }, (_, i) => {
        const a = pca[10 + i], b = pca[10 + K + i];
        return (
          <g key={`p${i}`}>
            <Wire pts={[[px(a[0]), py(a[1])], [px(b[0]), py(b[1])]]} fill={T.wireHot} step={1} />
            <rect x={px(a[0]) - 1} y={py(a[1]) - 1} width={3} height={3} fill={T.wireHot} />
            <rect x={px(b[0]) - 1} y={py(b[1]) - 1} width={3} height={3} fill={T.accentHi} />
          </g>
        );
      })}
      {pca.slice(0, 10).map((p, k) => (
        <PText key={k} x={px(p[0]) + 1} y={py(p[1]) - 3} text={small ? `_{${k}}` : String(k)} fill={T.text} anchor="middle" />
      ))}
    </g>
  );
}

function ViewColumn({ theme: T, name, x, y, px = 1, rowH = 30 }: { theme: Theme; name: TwinName; x: number; y: number; px?: number; rowH?: number }) {
  const v = VIEWS[name];
  const d = useMemo(() => ({
    x: MNIST_DIGITS.slice(0, K).map(digitPixels), a: v.v1.map((s) => unNib(s)), b: v.v2.map((s) => unNib(s)),
  }), [v]);
  const w = 28 * px;
  return (
    <g>
      {Array.from({ length: K }, (_, i) => (
        <g key={i}>
          <Thumb x={x} y={y + i * rowH} data={d.x[i]} px={px} theme={T} />
          <Wire pts={[[x + w + 2, y + i * rowH + w / 2], [x + w + 6, y + i * rowH + w / 2]]} fill={T.wire} />
          <Thumb x={x + w + 8} y={y + i * rowH} data={d.a[i]} px={px} theme={T} />
          <Thumb x={x + 2 * w + 12} y={y + i * rowH} data={d.b[i]} px={px} theme={T} />
        </g>
      ))}
    </g>
  );
}

export function TwinDiagram({ theme, name }: { theme: Theme; name: TwinName }) {
  const T = theme;
  const Y0 = 34;
  const v = VIEWS[name];
  return (
    <g>
      <rect x={0} y={0} width={TWIN_VIEW.w} height={TWIN_VIEW.h} fill={T.ground} />
      <PText x={16} y={12} text="digit" fill={T.textDim} />
      <PText x={52} y={12} text="view A, view B" fill={T.textDim} />
      <PText x={16} y={Y0 + 184} text="views: the code's real crop + rotate" fill={T.textDim} />
      <ViewColumn theme={T} name={name} x={16} y={Y0} />
      {/* towers */}
      {name === "dino" ? (
        <>
          <PText x={128} y={12} text="student" fill={T.text} />
          <Bars x={130} y={Y0} bars={2} h={176} theme={T} bw={3} gap={2} />
          <PText x={160} y={22} text="teacher" fill={T.wireHot} />
          <Bars x={162} y={Y0} bars={2} h={176} theme={T} bw={3} gap={2} dim />
          <PText x={146} y={Y0 + 196} text="teacher = EMA" fill={T.wireHot} anchor="middle" />
          <PText x={146} y={Y0 + 206} text={`${DNO.DINO_EMA} of student`} fill={T.wireHot} anchor="middle" />
          <PText x={146} y={Y0 + 216} text="(no gradients)" fill={T.textDim} anchor="middle" />
        </>
      ) : (
        <>
          <PText x={128} y={12} text="one encoder" fill={T.text} />
          <PText x={128} y={22} text="for both views" fill={T.textDim} />
          <Bars x={134} y={Y0} bars={1} h={176} theme={T} bw={3} gap={2} />
          <Bars x={142} y={Y0} bars={2} h={176} theme={T} bw={3} gap={2} />
          <Bars x={156} y={Y0} bars={name === "simclr" ? 4 : 2} h={176} theme={T} bw={3} gap={2} />
          <rect x={180} y={Y0} width={1} height={176} fill={T.accentHi} />
          <PText x={128} y={Y0 + 196} text={name === "simclr" ? "conv, fc 128," : "conv 32, 64,"} fill={T.textDim} />
          <PText x={128} y={Y0 + 206} text={name === "simclr" ? "head → 64" : "linear 64"} fill={T.textDim} />
        </>
      )}
      {Array.from({ length: K }, (_, i) => (
        <Wire key={i} pts={[[112, Y0 + i * 30 + 14], [126, Y0 + i * 30 + 14]]} fill={T.wire} />
      ))}
      <Wire pts={[[186, Y0 + 88], [196, Y0 + 88]]} fill={T.accentLo} step={1} />

      {name === "simclr" && <SimclrObjective theme={T} />}
      {name === "dino" && <DinoObjective theme={T} />}
      {name === "vision_embed" && <VEObjective theme={T} />}

      <PText x={428} y={150} text="embedding space (2-D PCA)" fill={T.textDim} />
      <Space theme={T} x={428} y={162} s={118} pca={v.pca} />
      <PText x={428} y={284} text="dots: view A / B, joined" fill={T.textDim} />
      <PText x={428} y={294} text="numerals: the 10 digits" fill={T.textDim} />
    </g>
  );
}

function SimclrObjective({ theme: T }: { theme: Theme }) {
  const S = SIM.SIMCLR_SIM;
  const X = 200, Y = 34, C = 14;
  return (
    <g>
      <PText x={X} y={12} text="similarity of all 12 views" fill={T.text} />
      <PText x={X} y={22} text="(6 × A, then 6 × B)" fill={T.textDim} />
      {S.map((row, i) => row.map((v, j) => (
        <rect key={`${i}${j}`} x={X + j * C} y={Y + i * C} width={C - 1} height={C - 1} fill={i === j ? T.frame : T.heat[heatIndex((v + 1) / 2)]} />
      )))}
      {Array.from({ length: K }, (_, i) => (
        <g key={i}>
          <Frame x={X + (i + K) * C - 1} y={Y + i * C - 1} w={C + 1} h={C + 1} fill={T.wireHot} />
          <Frame x={X + i * C - 1} y={Y + (i + K) * C - 1} w={C + 1} h={C + 1} fill={T.wireHot} />
        </g>
      ))}
      <PText x={X} y={Y + 12 * C + 4} text="framed: the two views of one digit" fill={T.wireHot} />
      <PText x={X} y={Y + 12 * C + 14} text="pull these together, push the rest apart" fill={T.textDim} />
      <Wire pts={[[X + 12 * C + 4, Y + 84], [X + 12 * C + 30, Y + 84]]} fill={T.wire} />
      <Diamond cx={X + 12 * C + 38} cy={Y + 84} theme={T} r={5} />
      <PText x={X + 12 * C + 30} y={Y + 94} text="InfoNCE" fill={T.loss} />
      <PText x={X + 12 * C + 30} y={Y + 104} text={`${SIM.SIMCLR_LOSS} (T ${SIM.SIMCLR_T})`} fill={T.loss} />
    </g>
  );
}

function DinoObjective({ theme: T }: { theme: Theme }) {
  const rows = [0, 1, 2];
  const X = 206, Y = 34;
  const bars = (s: string, x: number, y: number, fill: string, mx: number) => {
    const v = Array.from(unNib(s));
    return v.map((q, k) => {
      const h = Math.max(1, Math.round(((q + 1) / 2) * mx * 200));
      return <rect key={k} x={x + k * 2} y={y + 20 - Math.min(20, h)} width={1} height={Math.min(20, h)} fill={fill} />;
    });
  };
  return (
    <g>
      <PText x={X} y={12} text="64 prototypes: student vs teacher" fill={T.text} />
      <PText x={X} y={22} text="(teacher sees the OTHER view)" fill={T.textDim} />
      {rows.map((i, k) => (
        <g key={i}>
          <PText x={X} y={Y + k * 46} text={`digit ${i}`} fill={T.textDim} />
          <PText x={X} y={Y + k * 46 + 10} text="student" fill={T.accentHi} />
          <PText x={X} y={Y + k * 46 + 28} text="teacher" fill={T.wireHot} />
          {bars(DNO.DINO_SPROB[i], X + 40, Y + k * 46 - 4, T.accent, DNO.DINO_SMAX[i])}
          {bars(DNO.DINO_TPROB[i], X + 40, Y + k * 46 + 18, T.wireHot, DNO.DINO_TMAX[i])}
          <PText x={X + 172} y={Y + k * 46 + 4} text={`max ${DNO.DINO_SMAX[i].toFixed(2)}`} fill={T.accentHi} />
          <PText x={X + 172} y={Y + k * 46 + 24} text={`max ${DNO.DINO_TMAX[i].toFixed(2)}`} fill={T.wireHot} />
        </g>
      ))}
      <PText x={X} y={Y + 138} text={`student T ${DNO.DINO_TEMPS[0]}, teacher T ${DNO.DINO_TEMPS[1]}, centred`} fill={T.textDim} />
      <PText x={X} y={Y + 148} text="this checkpoint's targets are nearly flat" fill={T.loss} />
      <PText x={X} y={Y + 158} text="(uniform = 0.016): loss sits near ln 64" fill={T.loss} />
      <Diamond cx={X + 196} cy={Y + 170} theme={T} r={5} />
      <PText x={X} y={Y + 168} text={`cross-view CE ${DNO.DINO_LOSS}`} fill={T.loss} />
    </g>
  );
}

function VEObjective({ theme: T }: { theme: Theme }) {
  const S = VE.VE_SIM10;
  const X = 214, Y = 44, C = 15;
  const digits = useMemo(() => MNIST_DIGITS.map(digitPixels), []);
  return (
    <g>
      <PText x={X - 14} y={12} text="cosine between the 10 digits" fill={T.text} />
      <PText x={X - 14} y={22} text="(unit vectors: cosine = dot product)" fill={T.textDim} />
      {S.map((row, i) => (
        <g key={i}>
          <PText x={X - 8} y={Y + i * C + 4} text={String(i)} fill={T.textDim} anchor="middle" />
          <PText x={X + i * C + 7} y={Y - 10} text={String(i)} fill={T.textDim} anchor="middle" />
          {row.map((v, j) => (
            <rect key={j} x={X + j * C} y={Y + i * C} width={C - 1} height={C - 1} fill={i === j ? T.frame : T.heat[heatIndex((v + 1) / 2)]} />
          ))}
          <Frame x={X + VE.VE_NN[i] * C - 1} y={Y + i * C - 1} w={C + 1} h={C + 1} fill={T.wireHot} />
        </g>
      ))}
      <PText x={X} y={Y + 10 * C + 4} text="framed: each digit's nearest other digit" fill={T.wireHot} />
      <Thumb x={X - 14} y={Y + 10 * C + 18} data={digits[4]} px={1} theme={T} />
      <PText x={X + 18} y={Y + 10 * C + 28} text="→" fill={T.wireHot} />
      <Thumb x={X + 28} y={Y + 10 * C + 18} data={digits[VE.VE_NN[4]]} px={1} theme={T} />
      <PText x={X + 62} y={Y + 10 * C + 24} text="4 is closest to" fill={T.textDim} />
      <PText x={X + 62} y={Y + 10 * C + 34} text={`${VE.VE_NN[4]} (shape, not label)`} fill={T.textDim} />
    </g>
  );
}

export function TwinCard({ theme, name }: { theme: Theme; name: TwinName }) {
  const T = theme;
  const v = VIEWS[name];
  const d = useMemo(() => ({ a: v.v1.slice(0, 3).map((s) => unNib(s)), b: v.v2.slice(0, 3).map((s) => unNib(s)) }), [v]);
  return (
    <g>
      <rect x={0} y={0} width={TWIN_CARD_VIEW.w} height={TWIN_CARD_VIEW.h} fill={T.ground} />
      {d.a.map((m, i) => (
        <g key={i}>
          <Thumb x={4} y={6 + i * 32} data={m} px={1} theme={T} />
          <Thumb x={36} y={6 + i * 32} data={d.b[i]} px={1} theme={T} />
        </g>
      ))}
      <Wire pts={[[68, 50], [80, 50]]} fill={T.wire} />
      <Space theme={T} x={84} y={4} s={98} pca={v.pca} small />
      <PText x={84} y={106} text="views pulled together" fill={T.textDim} />
    </g>
  );
}
