"use client";

// CLIP anatomy, from src/mini_networks/models/clip/{config,model}.py.
// Image tower: Conv 1→32 (28×28) → Conv s2 →64 (14×14) → Conv s2 →128 (7×7)
// (each + BN + ReLU) → global average pool → Linear 128→128 → L2-normalise.
// Text tower: chars → ids (ord % 256, 32 slots, 0 = pad) → embedding 64 +
// position → 2 Transformer encoder layers (2 heads, ffn 256) → mean-pool over
// non-pad chars → Linear 64→128 → L2-normalise. Score = cosine similarity ×
// a learned scale (exp log_temperature); loss = symmetric cross-entropy
// (InfoNCE) over the batch, the diagonal being the matching pairs.
//
// REAL (data/clip-champion.ts, the local mini-clip champion): the 6×6 cosine
// similarities between six real MNIST test digits and six real training
// captions, the learned scale, and the InfoNCE computed from them here.
// Towers are drawn once, spanning every row/column: the same weights embed
// every image (rows) and every caption (columns).
import { CLIP_CAPTIONS, CLIP_LOGIT_SCALE, CLIP_SIM } from "../data/clip-champion";
import { MNIST_DIGITS, digitPixels } from "../data/mnist-digits";
import { resize, softmax } from "../math";
import { Bars, Diamond, Frame, PText, Thumb, Wire } from "../prims";
import { heatIndex, type Theme } from "../themes";

export const CLIP_VIEW = { w: 560, h: 316 };
const N = 6, C = 30;
const M = { x: 300, y: 114 };
const rowC = (i: number) => M.y + i * C + 14;
const colC = (j: number) => M.x + j * C + 14;

/** horizontal bar (the text tower runs top→down, so its channel bars lie flat) */
function HBars({ x, y, bars, w, theme }: { x: number; y: number; bars: number; w: number; theme: Theme }) {
  return (
    <g>
      {Array.from({ length: bars }, (_, b) => (
        <g key={b}>
          <rect x={x} y={y + b * 5} width={w} height={3} fill={theme.accent} />
          <rect x={x} y={y + b * 5} width={w} height={1} fill={theme.accentHi} />
        </g>
      ))}
    </g>
  );
}

export function CLIPDiagram({ theme }: { theme: Theme }) {
  const T = theme;
  const imgs = MNIST_DIGITS.slice(0, N).map(digitPixels);
  const names = CLIP_CAPTIONS.map((c) => c.split(" ").pop() ?? c);
  const logits = CLIP_SIM.map((r) => r.map((s) => s * CLIP_LOGIT_SCALE));
  const pRow = logits.map((r) => softmax(r));
  const pCol = logits[0].map((_, j) => softmax(logits.map((r) => r[j])));
  const ce = (-pRow.reduce((a, r, i) => a + Math.log(r[i]), 0) / N - pCol.reduce((a, c, j) => a + Math.log(c[j]), 0) / N) / 2;
  const best = CLIP_SIM.map((r) => (r as readonly number[]).indexOf(Math.max(...r)));
  const hits = best.filter((b, i) => b === i).length;

  return (
    <g>
      <rect x={0} y={0} width={CLIP_VIEW.w} height={CLIP_VIEW.h} fill={T.ground} />

      {/* ——— text tower (columns) ——— */}
      <PText x={M.x - 8} y={12} text="a photo of the digit" fill={T.textDim} anchor="end" />
      {names.map((n, j) => (
        <g key={n}>
          <PText x={colC(j) + 1} y={12} text={n} fill={T.text} anchor="middle" />
          <Wire pts={[[colC(j), 22], [colC(j), M.y - 3]]} fill={T.wire} />
        </g>
      ))}
      {/* tower stages step by a constant 14 px; each label is centred on the
          stage it names (the two layers share one label) */}
      <PText x={M.x - 8} y={22} text="text encoder" fill={T.text} anchor="end" />
      <PText x={M.x - 8} y={32} text="chars → 64" fill={T.textDim} anchor="end" />
      <PText x={M.x - 8} y={52} text="2 layers, 2 heads" fill={T.textDim} anchor="end" />
      <PText x={M.x - 8} y={78} text="mean → 128" fill={T.textDim} anchor="end" />
      <PText x={M.x - 8} y={91} text="unit length" fill={T.textDim} anchor="end" />
      <HBars x={M.x} y={30} bars={2} w={N * C - 1} theme={T} />
      <HBars x={M.x} y={44} bars={2} w={N * C - 1} theme={T} />
      <HBars x={M.x} y={58} bars={2} w={N * C - 1} theme={T} />
      <HBars x={M.x} y={72} bars={4} w={N * C - 1} theme={T} />
      <rect x={M.x} y={94} width={N * C - 1} height={1} fill={T.accentHi} />

      {/* ——— image tower (rows) ——— */}
      <PText x={16} y={M.y - 26} text="image encoder" fill={T.text} />
      <PText x={16} y={M.y - 16} text="28 → 14 → 7 px, pool → 128, unit length" fill={T.textDim} />
      {imgs.map((im, i) => (
        <g key={i}>
          <Thumb x={16} y={M.y + i * C + 1} data={im} n={28} px={1} theme={T} />
          <Wire pts={[[48, rowC(i)], [M.x - 3, rowC(i)]]} fill={T.wire} />
        </g>
      ))}
      {/* stages 14 px apart; every label centred under its stage on one row */}
      <Bars x={70} y={M.y} bars={1} h={N * C - 1} theme={T} bw={3} gap={2} />
      <Bars x={87} y={M.y} bars={2} h={N * C - 1} theme={T} bw={3} gap={2} />
      <Bars x={109} y={M.y} bars={4} h={N * C - 1} theme={T} bw={3} gap={2} />
      <rect x={141} y={M.y} width={1} height={N * C - 1} fill={T.textDim} />
      <Bars x={156} y={M.y} bars={4} h={N * C - 1} theme={T} bw={3} gap={2} />
      <rect x={188} y={M.y} width={1} height={N * C - 1} fill={T.accentHi} />
      {[["_{32}", 71], ["_{64}", 91], ["_{128}", 118], ["_{avg}", 142], ["_{128}", 165]].map(([t, x]) => (
        <PText key={`${t}${x}`} x={x as number} y={M.y + N * C + 3} text={t as string} fill={T.textDim} anchor="middle" />
      ))}

      {/* ——— similarity matrix: cos(image_i, caption_j) ——— */}
      {CLIP_SIM.map((r, i) => r.map((s, j) => (
        <g key={`${i}${j}`}>
          <rect x={M.x + j * C} y={M.y + i * C} width={C - 1} height={C - 1} fill={T.heat[heatIndex(pRow[i][j])]} />
          <PText x={M.x + j * C + 15} y={M.y + i * C + 12} text={`_{${s < 0 ? "-" : ""}${Math.abs(s).toFixed(2).replace(/^0/, "")}}`}
            fill={pRow[i][j] > 0.5 ? T.ground : T.textDim} anchor="middle" />
        </g>
      )))}
      {Array.from({ length: N }, (_, i) => (
        <Frame key={`d${i}`} x={M.x + i * C - 1} y={M.y + i * C - 1} w={C + 1} h={C + 1} fill={T.wireHot} />
      ))}
      {best.map((b, i) => (b !== i ? <Frame key={`w${i}`} x={M.x + b * C} y={M.y + i * C} w={C - 1} h={C - 1} fill={T.loss} /> : null))}

      {/* ——— loss ——— */}
      <Wire pts={[[M.x + N * C + 2, M.y + 90], [520, M.y + 90]]} fill={T.wire} />
      <Diamond cx={526} cy={M.y + 90} theme={T} />
      <PText x={526} y={M.y + 102} text="InfoNCE" fill={T.loss} anchor="middle" />
      <PText x={526} y={M.y + 112} text={ce.toFixed(2)} fill={T.loss} anchor="middle" />
      <PText x={M.x + N * C + 8} y={M.y + 2} text={`×${CLIP_LOGIT_SCALE.toFixed(1)}`} fill={T.text} />
      <PText x={M.x + N * C + 8} y={M.y + 12} text="learned" fill={T.textDim} />
      <PText x={M.x + N * C + 8} y={M.y + 22} text="scale" fill={T.textDim} />
      <PText x={M.x + N * C + 8} y={M.y + 152} text={`${hits} of ${N}`} fill={T.text} />
      <PText x={M.x + N * C + 8} y={M.y + 162} text="rows pick" fill={T.textDim} />
      <PText x={M.x + N * C + 8} y={M.y + 172} text="their pair" fill={T.textDim} />
    </g>
  );
}

// ————— card: six digits × six captions, real cosine similarities —————
export const CLIP_CARD_VIEW = { w: 190, h: 118 };

export function CLIPCard({ theme }: { theme: Theme }) {
  const T = theme;
  const imgs = MNIST_DIGITS.slice(0, N).map((d) => resize(digitPixels(d), 28, 28, 14));
  const logits = CLIP_SIM.map((r) => r.map((s) => s * CLIP_LOGIT_SCALE));
  const pRow = logits.map((r) => softmax(r));
  const best = CLIP_SIM.map((r) => (r as readonly number[]).indexOf(Math.max(...r)));
  const X0 = 22, Y0 = 18, S = 16;
  return (
    <g>
      <rect x={0} y={0} width={CLIP_CARD_VIEW.w} height={CLIP_CARD_VIEW.h} fill={T.ground} />
      <PText x={X0} y={2} text="'a photo of the digit n'" fill={T.textDim} />
      {Array.from({ length: N }, (_, j) => <PText key={j} x={X0 + j * S + 8} y={7} text={`_{${j}}`} fill={T.text} anchor="middle" />)}
      {imgs.map((im, i) => <Thumb key={i} x={4} y={Y0 + i * S + 1} data={im} n={14} px={1} theme={T} frame={false} />)}
      {CLIP_SIM.map((r, i) => r.map((_, j) => (
        <rect key={`${i}${j}`} x={X0 + j * S} y={Y0 + i * S} width={S - 1} height={S - 1} fill={T.heat[heatIndex(pRow[i][j])]} />
      )))}
      {Array.from({ length: N }, (_, i) => <Frame key={i} x={X0 + i * S - 1} y={Y0 + i * S - 1} w={S + 1} h={S + 1} fill={T.wireHot} />)}
      {best.map((b, i) => (b !== i ? <Frame key={`w${i}`} x={X0 + b * S} y={Y0 + i * S} w={S - 1} h={S - 1} fill={T.loss} /> : null))}
      <PText x={X0 + N * S + 8} y={Y0 + 4} text="image" fill={T.textDim} />
      <PText x={X0 + N * S + 8} y={Y0 + 14} text="×caption" fill={T.textDim} />
      <PText x={X0 + N * S + 8} y={Y0 + 30} text="lit: pairs" fill={T.wireHot} />
      <PText x={X0 + N * S + 8} y={Y0 + 40} text="red: miss" fill={T.loss} />
      <PText x={X0 + N * S + 8} y={Y0 + 56} text={`${best.filter((b, i) => b === i).length} of ${N} right`} fill={T.text} />
    </g>
  );
}
