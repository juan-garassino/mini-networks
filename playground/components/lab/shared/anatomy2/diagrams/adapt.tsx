"use client";

// Adaptation group: lora (builds on classifier, introduces low-rank-adaptation)
// and rag (builds on transformer, introduces retrieval-augmentation). Two
// different ideas, two components, one file.
//
// lora — models/lora/model.py LoRACNN (NOT the classifier's SmallCNN):
//   x [1,28,28] → conv 1→16 + ReLU + pool → conv 16→32 + ReLU + pool →
//   flatten 1568 → LoRALinear(1568→128) → ReLU → LoRALinear(128→10).
//   LoRALinear(x) = F.linear(x, W, b) + (x Aᵀ Bᵀ)·(alpha/rank), rank 4,
//   alpha 4 → scale 1; ΔW = B·A is never merged into W. Stage 2 (Fashion)
//   trains A1,B1,A2,B2 only. Each FC layer is drawn as a dim frozen W lane on
//   the spine plus a lit A ▸ 4 ◂ B hourglass underneath whose waist is exactly
//   4 px (the rank), rejoining at a hot + node; the stage-2 gradient bus
//   (T.loss) rises only into A and B.
//   REAL (data/lora-champion.ts, mini-lora v1): 8 FashionMNIST test items,
//   logits adapters ON vs OFF (OFF = frozen W alone), |W| vs |ΔW|, the fc2
//   factors and fc1's B. ΔW2 = B2·A2 is rebuilt from 4-bit factors (approx).
//   Conv maps and fc1's A are not exported, so the convs are structure only.
//
// rag — models/rag: a parameter-free TF-IDF retriever over 5 577 200-char
//   chunks of Tiny Shakespeare, the prompt "[Context: c1 | c2 | c3] query",
//   and a 2-block char LM (2 heads, width 64, ffn 128, seq_len 128) that only
//   reads the LAST 128 chars of that prompt.
//   REAL (data/rag-champion.ts, mini-rag v1): query, terms, top-3 chunks and
//   scores, the 631-char prompt, the 63 generated chars.
import { useEffect, useMemo, useState, type MutableRefObject, type ReactNode } from "react";
import {
  LORA_ALPHA, LORA_BASE_LOGITS, LORA_BASE_PRED, LORA_CLASS_NAMES, LORA_DELTA, LORA_FC1_B, LORA_FC1_B_MAX,
  LORA_FC2_A, LORA_FC2_A_MAX, LORA_FC2_B, LORA_FC2_B_MAX, LORA_IDX, LORA_LOGITS, LORA_PRED, LORA_RANK, LORA_X, LORA_Y,
} from "../data/lora-champion";
import {
  RAG_CHUNKS, RAG_CHUNK_SIZE, RAG_GENERATED, RAG_N_CHUNKS, RAG_PROMPT, RAG_QUERY, RAG_QUERY_TERMS, RAG_SCORES,
  RAG_SEQ_LEN, RAG_VOCAB, RAG_VOCAB_WORDS,
} from "../data/rag-champion";
import { softmax, unNib } from "../math";
import { Bars, Diamond, Frame, Node, PText, Thumb, Wire, barsWidth } from "../prims";
import { textWidth } from "../pixel-font";
import { useTick } from "../tick";
import { rampIndex, type Theme } from "../themes";
import type { KeyHandler } from "./types";

export const ADAPT_VIEW = { w: 560, h: 316 };
export const ADAPT_CARD_VIEW = { w: 190, h: 104 };
export type AdaptName = "lora" | "rag";

const fmt = (v: number) => (Math.abs(v) < 1 ? v.toFixed(2).replace(/^(-?)0/, "$1") : v.toFixed(2));
const fmt3 = (v: number) => v.toFixed(3).replace(/^0/, "");
const grp = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** rows×cols matrix (values −1..1, row-major) painted in the theme ramp — Thumb for non-square shapes. */
function Mat({ x, y, rows, cols, px, data, theme }: { x: number; y: number; rows: number; cols: number; px: number; data: ArrayLike<number>; theme: Theme }) {
  const ds: string[] = Array(8).fill("");
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const lvl = rampIndex(data[r * cols + c]);
      let e = c + 1;
      while (e < cols && rampIndex(data[r * cols + e]) === lvl) e++;
      ds[lvl] += `M${x + c * px} ${y + r * px}h${(e - c) * px}v${px}h${-(e - c) * px}z`;
      c = e;
    }
  }
  const W = cols * px, H = rows * px;
  return (
    <g>
      {theme.shadow && <rect x={x + 2} y={y + 2} width={W} height={H} fill={theme.shadow} />}
      {ds.map((d, i) => (d ? <path key={i} d={d} fill={theme.ramp[i]} /> : null))}
      <path d={`M${x - 1} ${y - 1}h${W + 2}v${H + 2}h${-(W + 2)}z M${x} ${y}v${H}h${W}v${-H}z`} fill={theme.frame} fillRule="evenodd" />
    </g>
  );
}

/** normalise to ±1 by own max |v| (display only) */
function sym(a: ArrayLike<number>): Float32Array {
  let m = 1e-9;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]));
  return Float32Array.from(a, (v) => v / m);
}

// ═════════════════════════════════ lora ═════════════════════════════════

const L = {
  CY: 64, AY: 92, LABEL_Y: 112, BUS_Y: 128, HDR_Y: 12, ROW0: 26, STRIP_Y: 246,
  IN_X: 16, C1: 84, C2: 96, FLAT: 114, FC1: 128, FC2: 200,
  NUM: 268, OFF: 278, ON: 336, TRACK: 50, CLS: 392, DIA: { x: 528, y: 26 }, BUS_X: 544,
};
const SEL0 = 7; // Sneaker, test 9: right with adapters on, a digit 4 with them off
const STAIR = 9; // columns of 2 px in A and in B
const WAIST = 6;
const ceOf = (logits: readonly number[], y: number) => -Math.log(Math.max(1e-12, softmax([...logits])[y]));

// exact parameter counts from the code's shapes (models/lora/model.py)
const P = (() => {
  const conv = (1 * 16 * 9 + 16) + (16 * 32 * 9 + 32);
  const [f1, f2] = LORA_DELTA;
  const w1 = f1.shape[0] * f1.shape[1] + f1.shape[0];
  const w2 = f2.shape[0] * f2.shape[1] + f2.shape[0];
  const ab1 = LORA_RANK * (f1.shape[0] + f1.shape[1]);
  const ab2 = LORA_RANK * (f2.shape[0] + f2.shape[1]);
  const trained = ab1 + ab2;
  return { trained, total: conv + w1 + w2 + trained };
})();

function useLoraData() {
  return useMemo(() => {
    const x = LORA_X.map((s) => unNib(s, 0, 1).map((v) => v * 2 - 1));
    const pOn = LORA_LOGITS.map((l) => softmax([...l]));
    const pOff = LORA_BASE_LOGITS.map((l) => softmax([...l]));
    const ceOn = LORA_LOGITS.map((l, i) => ceOf(l, LORA_Y[i]));
    const ceOff = LORA_BASE_LOGITS.map((l, i) => ceOf(l, LORA_Y[i]));
    const R = LORA_RANK;
    const a2 = unNib(LORA_FC2_A, -LORA_FC2_A_MAX, LORA_FC2_A_MAX); // [4,128]
    const b2 = unNib(LORA_FC2_B, -LORA_FC2_B_MAX, LORA_FC2_B_MAX); // [10,4]
    const b1 = unNib(LORA_FC1_B, -LORA_FC1_B_MAX, LORA_FC1_B_MAX); // [128,4]
    const H = a2.length / R, O = b2.length / R;
    const scale = LORA_ALPHA / R;
    const dw2 = new Float32Array(O * H);
    for (let o = 0; o < O; o++) for (let j = 0; j < H; j++) {
      let s = 0;
      for (let r = 0; r < R; r++) s += b2[o * R + r] * a2[r * H + j];
      dw2[o * H + j] = s * scale;
    }
    const b1t = new Float32Array(R * H);
    for (let r = 0; r < R; r++) for (let j = 0; j < H; j++) b1t[r * H + j] = b1[j * R + r];
    const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    return {
      x, pOn, pOff, ceOn, ceOff, H, O,
      a2: sym(a2), b2: sym(b2), dw2: sym(dw2), b1t: sym(b1t),
      meanOn: mean(ceOn), meanOff: mean(ceOff),
      right: LORA_PRED.filter((p, i) => p === LORA_Y[i]).length,
    };
  }, []);
}

/** one LoRA layer: dim frozen W lane on the spine + the lit A ▸ rank ◂ B hourglass, joined at a hot + */
function LoraLayer({ T, bx, wBars, bMax, frame }: { T: Theme; bx: number; wBars: number; bMax: number; frame: number }) {
  const { CY, AY } = L;
  const out: ReactNode[] = [];
  const col = (key: string, x: number, h: number) => {
    const y = AY - h / 2;
    if (T.shadow) out.push(<rect key={`s${key}`} x={x + 1} y={y + 1} width={2} height={h} fill={T.shadow} />);
    out.push(<rect key={key} x={x} y={y} width={2} height={h} fill={T.accent} />);
    out.push(<rect key={`t${key}`} x={x} y={y} width={2} height={1} fill={T.accentHi} />);
  };
  for (let c = 0; c < STAIR; c++) col(`a${c}`, bx + 2 * c, 20 - 2 * c);
  for (let c = 0; c < STAIR; c++) col(`b${c}`, bx + 2 * STAIR + WAIST + 2 * c, Math.min(bMax, 4 + 2 * c));
  const wW = barsWidth(wBars, 3, 2);
  const nx = bx + 52;
  const bEnd = bx + 2 * STAIR * 2 + WAIST; // first px after B
  return (
    <g>
      <Bars x={bx} y={CY - 12} bars={wBars} h={24} theme={T} bw={3} gap={2} dim />
      <Wire pts={[[bx + wW + 1, CY], [nx - 7, CY]]} fill={T.accentLo} step={1} />
      {out}
      {/* the waist: exactly LORA_RANK px tall — the 4 numbers per item */}
      <rect x={bx + 2 * STAIR} y={AY - LORA_RANK / 2} width={WAIST} height={LORA_RANK} fill={T.wireHot} />
      {/* split → A and B → +, the bypass the data takes (dots march when not still) */}
      <Wire pts={[[bx - 4, CY + 2], [bx - 4, AY], [bx - 2, AY]]} fill={T.wireHot} step={3} phase={frame} />
      <Wire pts={[[bEnd, AY], [nx, AY], [nx, CY + 7]]} fill={T.wireHot} step={3} phase={frame} />
      <Node cx={nx} cy={CY} glyph="+" theme={T} hot />
      <PText x={bx + STAIR} y={L.LABEL_Y} text="A" fill={T.wireHot} anchor="middle" />
      <PText x={bx + 2 * STAIR + WAIST / 2} y={L.LABEL_Y} text={`_{${LORA_RANK}}`} fill={T.wireHot} anchor="middle" />
      <PText x={bx + 2 * STAIR + WAIST + STAIR} y={L.LABEL_Y} text="B" fill={T.wireHot} anchor="middle" />
    </g>
  );
}

function LoraDiagram({ theme, still, keys: keysRef }: { theme: Theme; still: boolean; keys?: MutableRefObject<KeyHandler | null> }) {
  const T = theme;
  const d = useLoraData();
  const [selS, setSel] = useState(SEL0);
  const sel = still ? SEL0 : selS;
  const frame = useTick(3, 3, still);
  const n = LORA_X.length;

  useEffect(() => {
    if (!keysRef || still) return;
    keysRef.current = (e) => {
      if (e.key === "ArrowRight") { setSel((v) => (v + 1) % n); return true; }
      if (e.key === "ArrowLeft") { setSel((v) => (v + n - 1) % n); return true; }
      return false;
    };
    return () => { keysRef.current = null; };
  }, [keysRef, still, n]);

  const { CY, AY, LABEL_Y, BUS_Y, HDR_Y, ROW0, STRIP_Y } = L;
  const y = LORA_Y[sel];
  const pOn = d.pOn[sel], pOff = d.pOff[sel];
  const onArg = LORA_PRED[sel], offArg = LORA_BASE_PRED[sel];
  const row = (k: number) => ROW0 + 10 * k;
  const trueName = LORA_CLASS_NAMES[y];
  const wireX0 = L.CLS + textWidth(trueName) + 4;
  const [f1, f2] = LORA_DELTA;
  const interactive = !still;
  // gradient risers: under A's tallest (left) column and B's tallest (right) column of each layer
  const risers: [number, number][] = [
    [L.FC1 + 1, AY + 10], [L.FC1 + 2 * STAIR + WAIST + 2 * STAIR - 1, AY + 10],
    [L.FC2 + 1, AY + 10], [L.FC2 + 2 * STAIR + WAIST + 2 * STAIR - 1, AY + 5],
  ];
  const NB = 356; // norm bar origin, 10 px per unit of Frobenius norm

  return (
    <g>
      <rect x={0} y={0} width={ADAPT_VIEW.w} height={ADAPT_VIEW.h} fill={T.ground} />

      {/* headers */}
      <PText x={L.IN_X} y={HDR_Y} text="image" fill={T.textDim} />
      <PText x={L.C1} y={HDR_Y} text="conv" fill={T.textDim} />
      <PText x={L.FC1} y={HDR_Y} text={`fc1 ${f1.shape[1]}→${f1.shape[0]}`} fill={T.textDim} />
      <PText x={L.FC2} y={HDR_Y} text={`fc2 ${f2.shape[1]}→${f2.shape[0]}`} fill={T.textDim} />
      <PText x={L.OFF} y={HDR_Y} text="off: W" fill={T.textDim} />
      <PText x={L.ON} y={HDR_Y} text="on: W + BA" fill={T.wireHot} />
      <PText x={L.CLS} y={HDR_Y} text="as class" fill={T.textDim} />

      {/* input (a real Fashion test item) */}
      <Thumb x={L.IN_X} y={CY - 28} data={d.x[sel]} theme={T} />
      <PText x={L.IN_X} y={96} text={`test ${LORA_IDX[sel]}`} fill={T.textDim} />
      <PText x={L.IN_X} y={106} text={trueName} fill={T.text} />

      {/* inherited convs, frozen (maps not exported: structure only) */}
      <Wire pts={[[74, CY], [L.C1 - 2, CY]]} fill={T.accentLo} step={1} />
      <Bars x={L.C1} y={CY - 42} bars={1} h={84} theme={T} bw={3} gap={2} dim />
      <Wire pts={[[L.C1 + 5, CY], [L.C2 - 2, CY]]} fill={T.accentLo} step={1} />
      <Bars x={L.C2} y={CY - 21} bars={2} h={42} theme={T} bw={3} gap={2} dim />
      <Wire pts={[[L.C2 + 10, CY], [L.FLAT - 2, CY]]} fill={T.accentLo} step={1} />
      <rect x={L.FLAT} y={CY - 21} width={1} height={42} fill={T.accentHi} />
      <PText x={L.FLAT} y={22} text={`_{${f1.shape[1]}}`} fill={T.textDim} />
      <PText x={L.C1} y={LABEL_Y} text="_{16}" fill={T.textDim} />
      <PText x={L.C2} y={LABEL_Y} text="_{32}" fill={T.textDim} />

      {/* fc1, fc2: frozen W lane + the low-rank bypass */}
      <Wire pts={[[L.FLAT + 2, CY], [L.FC1 - 2, CY]]} fill={T.accentLo} step={1} />
      <PText x={L.FC1} y={42} text="W frozen" fill={T.textDim} />
      <LoraLayer T={T} bx={L.FC1} wBars={8} bMax={20} frame={frame} />
      <Wire pts={[[L.FC1 + 58, CY], [L.FC2 - 2, CY]]} fill={T.accentLo} step={1} />
      <PText x={L.FC1 + 58} y={LABEL_Y} text={`_{${f1.shape[0]}}`} fill={T.textDim} />
      <PText x={L.FC2} y={42} text="W" fill={T.textDim} />
      <LoraLayer T={T} bx={L.FC2} wBars={1} bMax={10} frame={frame} />
      <Wire pts={[[L.FC2 + 58, CY], [L.NUM - 4, CY]]} fill={T.accentLo} step={1} />
      <PText x={L.FC2 + 52} y={LABEL_Y} text={`_{${f2.shape[0]}}`} fill={T.textDim} anchor="middle" />

      {/* the same 10 units: off = digit units of the frozen W, on = clothes */}
      {Array.from({ length: 10 }, (_, k) => {
        const ry = row(k);
        const wOff = Math.max(1, Math.round(pOff[k] * L.TRACK));
        const wOn = Math.max(1, Math.round(pOn[k] * L.TRACK));
        return (
          <g key={k}>
            <PText x={L.NUM} y={ry} text={String(k)} fill={k === offArg ? T.text : T.textDim} />
            <rect x={L.OFF} y={ry + 2} width={L.TRACK} height={3} fill={T.panel} />
            <rect x={L.OFF} y={ry + 2} width={wOff} height={3} fill={k === offArg ? T.accent : T.accentLo} />
            <rect x={L.ON} y={ry + 2} width={L.TRACK} height={3} fill={T.panel} />
            <rect x={L.ON} y={ry + 2} width={wOn} height={3} fill={k === onArg ? T.accentHi : T.accent} />
            <PText x={L.CLS} y={ry} text={LORA_CLASS_NAMES[k]} fill={k === onArg ? T.wireHot : k === y ? T.text : T.textDim} />
          </g>
        );
      })}

      {/* loss on the true class, adapters on */}
      <Wire pts={[[wireX0, row(y) + 3], [508, row(y) + 3], [508, L.DIA.y], [L.DIA.x - 8, L.DIA.y]]} fill={T.wire} />
      <Diamond cx={L.DIA.x} cy={L.DIA.y} theme={T} />
      <PText x={L.DIA.x + 1} y={36} text="CE" fill={T.loss} anchor="middle" />
      <PText x={L.DIA.x + 1} y={46} text={fmt(d.ceOn[sel])} fill={T.loss} anchor="middle" />
      <PText x={L.DIA.x + 1} y={56} text="off" fill={T.textDim} anchor="middle" />
      <PText x={L.DIA.x + 1} y={66} text={fmt(d.ceOff[sel])} fill={T.textDim} anchor="middle" />

      {/* stage-2 gradient: back along a bus, up into A and B only */}
      <Wire pts={[[L.DIA.x + 8, L.DIA.y], [L.BUS_X, L.DIA.y], [L.BUS_X, BUS_Y], [risers[0][0], BUS_Y]]} fill={T.loss} step={3} />
      {risers.map(([x, bot], i) => <Wire key={i} pts={[[x, BUS_Y], [x, bot + 3]]} fill={T.loss} step={3} />)}
      <PText x={L.IN_X} y={134} text="∇" fill={T.loss} />
      <PText x={L.IN_X + 8} y={134} text={`stage 2 trains A and B only: ${grp(P.trained)} of ${grp(P.total)} params (${((100 * P.trained) / P.total).toFixed(1)}%); W and the convs stay frozen`} fill={T.textDim} />

      {/* the real factors as a matmul plate: A2 on top, B2 at left, ΔW2 = B2·A2 where they meet, B1 on the same 128 units */}
      <PText x={L.IN_X} y={150} text="the trained factors (fc2's A and B, fc1's B)" fill={T.textDim} />
      <PText x={L.IN_X} y={164} text="A_{2}" fill={T.wireHot} />
      <Mat x={44} y={164} rows={LORA_RANK} cols={d.H} px={2} data={d.a2} theme={T} />
      <PText x={L.IN_X} y={182} text="B_{2}" fill={T.wireHot} />
      <Mat x={32} y={176} rows={d.O} cols={LORA_RANK} px={2} data={d.b2} theme={T} />
      <Mat x={44} y={176} rows={d.O} cols={d.H} px={2} data={d.dw2} theme={T} />
      <PText x={44} y={200} text={`ΔW_{2} = B_{2}·A_{2}: ${d.O}×${d.H}, rank ${LORA_RANK} (4-bit, approx.)`} fill={T.textDim} />
      <PText x={L.IN_X} y={212} text="B_{1}" fill={T.wireHot} />
      <Mat x={44} y={212} rows={LORA_RANK} cols={d.H} px={2} data={d.b1t} theme={T} />
      <PText x={44} y={224} text="fc1's B on the same 128 units; A_{1} not exported" fill={T.textDim} />

      {/* |W| vs |ΔW| — low rank, not small */}
      <PText x={316} y={150} text="size (Frobenius norm)" fill={T.textDim} />
      {LORA_DELTA.map((L2, i) => {
        const y0 = 164 + i * 24;
        const wW = Math.round(L2.normW * 10), wD = Math.max(1, Math.round(L2.normDelta * 10));
        return (
          <g key={L2.name}>
            <PText x={316} y={y0} text={L2.name} fill={T.textDim} />
            <PText x={334} y={y0} text="|W|" fill={T.text} />
            <rect x={NB} y={y0 + 2} width={wW} height={3} fill={T.accentLo} />
            <PText x={NB + wW + 4} y={y0} text={fmt(L2.normW)} fill={T.textDim} />
            <PText x={334} y={y0 + 10} text="|ΔW|" fill={T.wireHot} />
            <rect x={NB} y={y0 + 12} width={wD} height={3} fill={T.wireHot} />
            <PText x={NB + wD + 4} y={y0 + 10} text={fmt(L2.normDelta)} fill={T.textDim} />
          </g>
        );
      })}
      <PText x={316} y={212} text="low rank, not small:" fill={T.wireHot} />
      <PText x={316} y={222} text={`fc1's |ΔW| is ${Math.round((100 * f1.normDelta) / f1.normW)}% of |W|`} fill={T.textDim} />

      {/* the 8 real Fashion test items: CE off | on */}
      <PText x={L.IN_X} y={234} text={`8 Fashion test items, CE off | on: adapters on get ${d.right} of 8 right, mean CE ${fmt(d.meanOff)} → ${fmt(d.meanOn)}`} fill={T.text} />
      {LORA_X.map((_, i) => {
        const x0 = 16 + 64 * i;
        const hOff = Math.max(1, Math.round(d.ceOff[i] * 2.5));
        const hOn = Math.max(1, Math.round(d.ceOn[i] * 2.5));
        const ok = LORA_PRED[i] === LORA_Y[i];
        return (
          <g key={i} onClick={interactive ? () => setSel(i) : undefined} style={interactive ? { cursor: "pointer" } : undefined}>
            <Thumb x={x0} y={STRIP_Y} data={d.x[i]} px={1} theme={T} />
            <rect x={x0 + 32} y={274 - hOff} width={3} height={hOff} fill={T.accentLo} />
            <rect x={x0 + 37} y={274 - hOn} width={3} height={hOn} fill={T.accent} />
            {ok && <PText x={x0 + 44} y={STRIP_Y} text="✓" fill={T.wireHot} />}
            {i === sel && <Frame x={x0 - 2} y={STRIP_Y - 2} w={32} h={32} fill={T.wireHot} />}
            <PText x={x0} y={280} text={LORA_CLASS_NAMES[LORA_Y[i]]} fill={i === sel ? T.text : T.textDim} />
          </g>
        );
      })}

      <PText x={L.IN_X} y={290} text="gate = MNIST digit accuracy with adapters on (.83); Fashion accuracy is never measured" fill={T.loss} />
      <PText x={L.IN_X} y={ADAPT_VIEW.h - 14} text="dim = frozen   lit = trained in stage 2   waist = rank 4   1 bar = 16 channels   track = softmax" fill={T.textDim} />
    </g>
  );
}

function LoraCard({ theme }: { theme: Theme }) {
  const T = theme;
  const d = useLoraData();
  const s = SEL0;
  const CY = 44, AY = 64;
  const pOn = d.pOn[s], pOff = d.pOff[s];
  const onArg = LORA_PRED[s], offArg = LORA_BASE_PRED[s];
  const cols: ReactNode[] = [];
  const col = (key: string, x: number, h: number) => {
    if (T.shadow) cols.push(<rect key={`s${key}`} x={x + 1} y={AY - h / 2 + 1} width={2} height={h} fill={T.shadow} />);
    cols.push(<rect key={key} x={x} y={AY - h / 2} width={2} height={h} fill={T.accent} />);
  };
  for (let c = 0; c < 5; c++) col(`a${c}`, 42 + 2 * c, 12 - 2 * c);
  for (let c = 0; c < 5; c++) col(`b${c}`, 66 + 2 * c, 4 + 2 * c);
  return (
    <g>
      <rect x={0} y={0} width={ADAPT_CARD_VIEW.w} height={ADAPT_CARD_VIEW.h} fill={T.ground} />
      <PText x={42} y={4} text="W frozen" fill={T.textDim} />
      <PText x={106} y={4} text="off" fill={T.textDim} />
      <PText x={126} y={4} text="on" fill={T.wireHot} />
      <Thumb x={4} y={CY - 14} data={d.x[s]} px={1} theme={T} />
      <Wire pts={[[34, CY], [40, CY]]} fill={T.accentLo} step={1} />
      <Bars x={42} y={CY - 6} bars={21} h={12} theme={T} bw={1} gap={1} dim />
      <Wire pts={[[84, CY], [87, CY]]} fill={T.accentLo} step={1} />
      {/* the bypass: A ▸ rank ◂ B */}
      <Wire pts={[[36, CY + 2], [36, AY], [40, AY]]} fill={T.wireHot} step={2} />
      {cols}
      <rect x={52} y={AY - 2} width={14} height={4} fill={T.wireHot} />
      <Wire pts={[[77, AY], [94, AY], [94, CY + 7]]} fill={T.wireHot} step={2} />
      <Node cx={94} cy={CY} glyph="+" theme={T} hot />
      <PText x={59} y={70} text={`_{${LORA_RANK}}`} fill={T.wireHot} anchor="middle" />
      <Wire pts={[[100, CY], [103, CY]]} fill={T.accentLo} step={1} />
      {/* the same 10 output units, off vs on */}
      {Array.from({ length: 10 }, (_, k) => {
        const hOff = Math.max(1, Math.round(pOff[k] * 30));
        const hOn = Math.max(1, Math.round(pOn[k] * 30));
        return (
          <g key={k}>
            <rect x={106 + 8 * k} y={58 - hOff} width={3} height={hOff} fill={k === offArg ? T.accent : T.accentLo} />
            <rect x={110 + 8 * k} y={58 - hOn} width={3} height={hOn} fill={k === onArg ? T.accentHi : T.accent} />
          </g>
        );
      })}
      <PText x={107 + 8 * offArg} y={61} text={`_{${offArg}}`} fill={T.textDim} />
      <PText x={111 + 8 * onArg} y={61} text={`_{${onArg}}`} fill={T.wireHot} />
      <PText x={4} y={90} text={`off: digit ${offArg}`} fill={T.textDim} />
      <PText x={80} y={90} text={`on: ${LORA_CLASS_NAMES[onArg]}`} fill={T.wireHot} />
    </g>
  );
}

// ═════════════════════════════════ rag ═════════════════════════════════

// Recomputed exactly from the corpus by the field expert (pure-Python TF-IDF,
// matches the exported top-3): normalised query weights (idf hear 4.26,
// me 2.35, speak 4.05), the 4th/5th scores, the 10th score, how many chunks
// score > 0, their median, and the winners' chunk ids. Not in the data file.
const RAG_QUERY_W = [0.67, 0.37, 0.64];
const RAG_NEXT_SCORES = [0.414, 0.319];
const RAG_TENTH = 0.285;
const RAG_NONZERO = 1735;
const RAG_MEDIAN = 0.03;
const RAG_IDS = [4778, 380, 1408];
// gate eval_loss of mini-rag v1 (runs/sweep/m-registry-2/report.json): LM char CE on the corpus
const RAG_GATE_CE = 2.459;

const R = {
  HDR_Y: 12, ROW: (k: number) => 24 + 10 * k, TAPE_Y: [110, 120, 130], X0: 50, CPX: 2,
  NOTE_Y: 142, LM_Y: 164, LM_H: 36, LM_CY: 182, LABEL_Y: 204,
  WORD_X: 108, WTRACK: 142, WVAL: 186, BUS: 204, BRK: 211, STRACK: 214, SVAL: 318, SID: 346, EXC: 382,
};
const OOV = new Set(["[", "|", "]"]);
const showCh = (ch: string) => (ch === "\n" ? "↵" : ch);

interface TapeCell { x: number; row: number; ch: string; idx: number }

/** the 631-char prompt laid out as three chunk rows, one char per `cpx` px (exact segment offsets) */
function tapeLayout(x0: number, cpx: number, prefixX: number): { cells: TapeCell[]; winX: number } {
  const pre = "[Context: ".length, sep = " | ".length;
  const [c1, c2, c3] = RAG_CHUNKS.map((c) => c.length);
  const segs: { len: number; row: number; x: number }[] = [
    { len: pre, row: 0, x: prefixX },
    { len: c1, row: 0, x: x0 }, { len: sep, row: 0, x: x0 + RAG_CHUNK_SIZE * cpx },
    { len: c2, row: 1, x: x0 }, { len: sep, row: 1, x: x0 + RAG_CHUNK_SIZE * cpx },
    { len: c3, row: 2, x: x0 }, { len: RAG_PROMPT.length - (pre + c1 + sep + c2 + sep + c3), row: 2, x: x0 + RAG_CHUNK_SIZE * cpx },
  ];
  const cells: TapeCell[] = [];
  let idx = 0;
  for (const s of segs) for (let i = 0; i < s.len; i++, idx++) cells.push({ x: s.x + Math.floor((i * cpx)), row: s.row, ch: RAG_PROMPT[idx], idx });
  const w0 = RAG_PROMPT.length - RAG_SEQ_LEN;
  return { cells, winX: cells[w0].x };
}

/** excerpt: the chunk line holding the most distinct query terms (first on ties), from the word before its first hit */
function excerpt(chunk: string, max: number): [string, boolean][] {
  const terms = new Set<string>(RAG_QUERY_TERMS);
  let line = "", at = 0, best = 0;
  for (const l of chunk.split("\n")) {
    const seen = new Set<string>();
    let first = -1;
    const m = /[a-z0-9]+/gi;
    for (let r = m.exec(l); r; r = m.exec(l)) {
      const w = r[0].toLowerCase();
      if (!terms.has(w)) continue;
      seen.add(w);
      if (first < 0) first = r.index;
    }
    if (seen.size > best) { best = seen.size; line = l; at = first; }
  }
  const s = line.length <= max ? 0 : line.lastIndexOf(" ", at - 2) + 1;
  const text = line.slice(s, s + max);
  const out: [string, boolean][] = [];
  const re = /[a-z0-9]+|[^a-z0-9]+/gi;
  for (let r = re.exec(text); r; r = re.exec(text)) out.push([r[0], /^[a-z0-9]+$/i.test(r[0]) && terms.has(r[0].toLowerCase())]);
  return out;
}

/** a line of text drawn piecewise in several colours (char advance matches textPath exactly) */
function Pieces({ x, y, pieces }: { x: number; y: number; pieces: [string, string][] }) {
  const starts = pieces.map((_, i) => {
    const before = pieces.slice(0, i).map(([t]) => t).join("");
    return before ? x + textWidth(before) + 1 : x;
  });
  return (
    <g>
      {pieces.map(([t, fill], i) => <PText key={i} x={starts[i]} y={y} text={t} fill={fill} />)}
    </g>
  );
}

function RagDiagram({ theme, still }: { theme: Theme; still: boolean }) {
  const T = theme;
  const f = useTick(2, 3, still);
  const tape = useMemo(() => tapeLayout(R.X0, R.CPX, 30), []);
  const ex = useMemo(() => RAG_CHUNKS.map((c) => excerpt(c, 27)), []);
  const win = RAG_PROMPT.slice(-RAG_SEQ_LEN);
  const w0 = RAG_PROMPT.length - RAG_SEQ_LEN;

  // tape ticks: capitals/digits 5 px, lowercase 3 px, punctuation 2 px; spaces empty; newline = floor dot
  const paths = useMemo(() => {
    const p = { dim: "", text: "", loss: "" };
    for (const c of tape.cells) {
      const y = R.TAPE_Y[c.row];
      const key: keyof typeof p = OOV.has(c.ch) ? "loss" : c.idx >= w0 ? "text" : "dim";
      if (c.ch === " ") continue;
      if (c.ch === "\n") { p[key] += `M${c.x} ${y + 5}h1v1h-1z`; continue; }
      const h = OOV.has(c.ch) || /[A-Z0-9]/.test(c.ch) ? 5 : /[a-z]/.test(c.ch) ? 3 : 2;
      p[key] += `M${c.x} ${y + 6 - h}h1v${h}h-1z`;
    }
    return p;
  }, [tape, w0]);

  const rows4 = [0, 1, 2, 3].map((r) => win.slice(r * 32, r * 32 + 32));
  const gen = [0, 1, 2].map((r) => RAG_GENERATED.slice(r * 26, r * 26 + 26));
  const sepX = R.X0 + RAG_CHUNK_SIZE * R.CPX;
  const scores = [...RAG_SCORES, ...RAG_NEXT_SCORES];

  return (
    <g>
      <rect x={0} y={0} width={ADAPT_VIEW.w} height={ADAPT_VIEW.h} fill={T.ground} />

      {/* headers */}
      <PText x={16} y={R.HDR_Y} text="query" fill={T.textDim} />
      <PText x={R.WORD_X} y={R.HDR_Y} text="words, weight" fill={T.textDim} />
      <PText x={R.STRACK} y={R.HDR_Y} text={`cosine to ${grp(RAG_N_CHUNKS)} chunks`} fill={T.textDim} />
      <PText x={R.SID} y={R.HDR_Y} text="chunk" fill={T.textDim} />
      <PText x={R.EXC} y={R.HDR_Y} text="retrieved text" fill={T.textDim} />

      {/* query → words (TF-IDF weights) */}
      <rect x={16} y={24} width={82} height={14} fill={T.panel} />
      <Frame x={16} y={24} w={82} h={14} fill={T.frame} />
      <PText x={20} y={28} text={RAG_QUERY} fill={T.text} />
      <PText x={16} y={44} text={`${grp(RAG_VOCAB_WORDS)} words`} fill={T.textDim} />
      <PText x={16} y={64} text="exact TF-IDF cosine scan:" fill={T.textDim} />
      <PText x={16} y={74} text="no weights, no loss" fill={T.textDim} />
      <Wire pts={[[100, 31], [104, 31], [104, R.ROW(0) + 3]]} fill={T.wireHot} />
      <Wire pts={[[104, R.ROW(0) + 3], [104, R.ROW(2) + 3]]} fill={T.wireHot} />
      {RAG_QUERY_TERMS.map((t, k) => {
        const y = R.ROW(k);
        return (
          <g key={t}>
            <Wire pts={[[105, y + 3], [R.WORD_X - 2, y + 3]]} fill={T.wireHot} />
            <PText x={R.WORD_X} y={y} text={t} fill={T.text} />
            <rect x={R.WTRACK} y={y + 2} width={40} height={3} fill={T.panel} />
            <rect x={R.WTRACK} y={y + 2} width={Math.round(RAG_QUERY_W[k] * 40)} height={3} fill={T.accent} />
            <PText x={R.WVAL} y={y} text={fmt(RAG_QUERY_W[k])} fill={T.textDim} />
            <Wire pts={[[R.WVAL + 16, y + 3], [R.BUS, y + 3]]} fill={T.wireHot} />
          </g>
        );
      })}
      <Wire pts={[[R.BUS, R.ROW(0) + 3], [R.BUS, R.ROW(4) + 3]]} fill={T.wireHot} />

      {/* cosine over every chunk: the top 3 retrieved (near tie), the next two not */}
      {scores.map((s, k) => {
        const y = R.ROW(k);
        const top = k < 3;
        return (
          <g key={k}>
            <Wire pts={[[R.BUS + 1, y + 3], [R.BRK - 2, y + 3]]} fill={T.wireHot} />
            <rect x={R.STRACK} y={y + 2} width={100} height={3} fill={T.panel} />
            <rect x={R.STRACK} y={y + 2} width={Math.round(s * 200)} height={3} fill={k === 0 ? T.accentHi : top ? T.accent : T.accentLo} />
            <PText x={R.SVAL} y={y} text={fmt3(s)} fill={k === 0 ? T.wireHot : T.textDim} />
            {top && <PText x={R.SID} y={y} text={`#${RAG_IDS[k]}`} fill={T.textDim} />}
            {top && <Pieces x={R.EXC} y={y} pieces={ex[k].map(([t, hit]) => [t, hit ? T.wireHot : T.textDim])} />}
          </g>
        );
      })}
      <PText x={R.STRACK} y={76} text={`10th ${fmt3(RAG_TENTH)}   ${grp(RAG_NONZERO)} of ${grp(RAG_N_CHUNKS)} chunks > 0, median ${fmt(RAG_MEDIAN)}`} fill={T.textDim} />
      {/* top-3 bracket and the stuffing wire down into the prompt */}
      <Wire pts={[[R.BRK + 1, R.ROW(0) + 1], [R.BRK, R.ROW(0) + 1], [R.BRK, R.ROW(2) + 6], [R.BRK + 1, R.ROW(2) + 6]]} fill={T.wireHot} step={1} />
      <Wire pts={[[R.BRK, R.ROW(2) + 8], [R.BRK, R.TAPE_Y[0] - 3]]} fill={T.wireHot} />
      <PText x={R.BRK + 4} y={88} text="top 3, pasted in order" fill={T.textDim} />

      {/* the prompt tape */}
      <PText x={R.BRK + 4} y={98} text={`prompt: [Context: c1 | c2 | c3] query   ${RAG_PROMPT.length} chars, 1 char = 2 px`} fill={T.textDim} />
      {R.TAPE_Y.map((y, r) => (
        <g key={r}>
          <rect x={30} y={y} width={sepX + 6 - 30 + (r === 2 ? 2 * 15 - 6 : 0)} height={7} fill={T.panel} />
          <PText x={16} y={y} text={`c${r + 1}`} fill={T.textDim} />
        </g>
      ))}
      <path d={paths.dim} fill={T.textDim} />
      <path d={paths.text} fill={T.text} />
      <path d={paths.loss} fill={T.loss} />
      {/* generated chars append to the tape (motion only; frame 0 = step 0) */}
      {Array.from({ length: f }, (_, j) => (
        <rect key={j} x={sepX + 30 + 2 * j} y={R.TAPE_Y[2] + 3} width={1} height={3} fill={T.text} />
      ))}
      <PText x={sepX + 12} y={R.TAPE_Y[0]} text="[|] fed as ↵" fill={T.loss} />
      {/* THE hot frame: the LM's 128-char window over the tape's right end */}
      <Frame x={tape.winX - 2 + 2 * f} y={R.TAPE_Y[2] - 2} w={RAG_SEQ_LEN * R.CPX + 4} h={11} fill={T.wireHot} />
      <PText x={R.X0} y={R.NOTE_Y} text="never seen by the LM" fill={T.loss} />
      <PText x={tape.winX} y={R.NOTE_Y} text={`the LM's window: last ${RAG_SEQ_LEN} chars`} fill={T.wireHot} />

      {/* what the LM reads at step 0 */}
      <PText x={16} y={154} text="what the LM reads, step 0" fill={T.textDim} />
      {rows4.map((line, r) => (
        <Pieces key={r} x={16} y={166 + 10 * r} pieces={[...line].map((ch) => [showCh(ch), OOV.has(ch) ? T.loss : T.text] as [string, string])} />
      ))}

      {/* the inherited char LM (calm: no hot marks inside) */}
      <Wire pts={[[212, R.LM_CY], [362, R.LM_CY]]} fill={T.accentLo} step={1} />
      <rect x={222} y={R.LM_Y} width={3} height={R.LM_H} fill={T.accentLo} />
      <rect x={226} y={R.LM_Y} width={3} height={R.LM_H} fill={T.accentLo} />
      {[236, 292].map((x, b) => (
        <g key={x}>
          <PText x={x} y={154} text={`block ${b + 1}`} fill={T.textDim} />
          <Bars x={x} y={R.LM_Y} bars={2} h={R.LM_H} theme={T} bw={3} gap={2} dim />
          <Bars x={x + 26} y={R.LM_Y} bars={4} h={R.LM_H} theme={T} bw={3} gap={2} dim />
          <PText x={x} y={R.LABEL_Y} text="attn" fill={T.textDim} />
          <PText x={x + 26} y={R.LABEL_Y} text="ffn" fill={T.textDim} />
        </g>
      ))}
      <Bars x={348} y={R.LM_Y} bars={2} h={R.LM_H} theme={T} bw={3} gap={2} dim />
      <PText x={222} y={R.LABEL_Y} text="_{64}" fill={T.textDim} />
      <PText x={348} y={R.LABEL_Y} text="lm" fill={T.textDim} />

      {/* next char → the real generation */}
      <rect x={366} y={R.LM_CY - 7} width={14} height={14} fill={T.panel} />
      <Frame x={366} y={R.LM_CY - 7} w={14} h={14} fill={T.frame} />
      <PText x={373} y={R.LM_CY - 3} text={RAG_GENERATED[0]} fill={T.text} anchor="middle" />
      <PText x={386} y={154} text={`${RAG_GENERATED.length} chars out, T .8`} fill={T.textDim} />
      {gen.map((g, r) => <PText key={r} x={386} y={166 + 10 * r} text={g} fill={T.text} />)}
      <PText x={386} y={196} text="1 sampled ↵ dropped by decode" fill={T.textDim} />
      <Wire pts={[[373, R.LM_CY + 9], [373, 208]]} fill={T.wire} />
      <Diamond cx={373} cy={216} theme={T} />
      <PText x={384} y={213} text={`CE ${fmt(RAG_GATE_CE)}`} fill={T.loss} />

      <PText x={16} y={236} text="CE = the LM's next-char loss on the corpus (gate, v1); retrieval itself is never scored" fill={T.loss} />
      <PText x={16} y={246} text="the LM was trained alone on plain text: it never saw a [Context: ...] prompt" fill={T.loss} />
      <PText x={16} y={256} text={`two vocabularies: retrieval counts ${grp(RAG_VOCAB_WORDS)} words, the LM spells ${RAG_VOCAB} characters`} fill={T.textDim} />
      <PText x={16} y={ADAPT_VIEW.h - 14} text={`1 bar = 32 channels   2 blocks, 2 heads, width 64, ffn 128, ${RAG_VOCAB} chars   tape tick = 1 char`} fill={T.textDim} />
    </g>
  );
}

function RagCard({ theme }: { theme: Theme }) {
  const T = theme;
  const TY = [26, 34, 42];
  const { ticks, winX } = useMemo(() => {
    // 1 px = 2 chars: a pixel is lit when either of its chars is visible ink
    const { cells, winX: wx } = tapeLayout(34, 1, 24);
    const lit = new Map<string, { x: number; row: number; win: boolean; h: number }>();
    const w0 = RAG_PROMPT.length - RAG_SEQ_LEN;
    for (const c of cells) {
      if (c.ch === " " || c.ch === "\n") continue;
      const x = c.x <= 33 ? 12 + Math.floor((c.x - 24) / 2) : 17 + Math.floor((c.x - 34) / 2);
      const k = `${x},${c.row}`;
      const prev = lit.get(k);
      // tick height by the taller of its two chars: capitals/[|] 4, lowercase 3, punctuation 1
      const h = OOV.has(c.ch) || /[A-Z0-9]/.test(c.ch) ? 4 : /[a-z]/.test(c.ch) ? 3 : 1;
      lit.set(k, { x, row: c.row, win: (prev?.win ?? false) || c.idx >= w0, h: Math.max(prev?.h ?? 0, h) });
    }
    return { ticks: [...lit.values()], winX: 17 + Math.floor((wx - 34) / 2) };
  }, []);
  const genText = (() => {
    let t = RAG_GENERATED.slice(0, 30);
    while (t.length > 1 && textWidth(`→ ${t}`) > 182) t = t.slice(0, -1);
    return `→ ${t}`;
  })();
  return (
    <g>
      <rect x={0} y={0} width={ADAPT_CARD_VIEW.w} height={ADAPT_CARD_VIEW.h} fill={T.ground} />
      <rect x={4} y={2} width={72} height={14} fill={T.panel} />
      <Frame x={4} y={2} w={72} h={14} fill={T.frame} />
      <PText x={8} y={6} text={RAG_QUERY} fill={T.text} />
      {RAG_SCORES.map((s, k) => (
        <g key={k}>
          <rect x={96} y={4 + 4 * k} width={50} height={3} fill={T.panel} />
          <rect x={96} y={4 + 4 * k} width={Math.round(s * 100)} height={3} fill={k === 0 ? T.accentHi : T.accent} />
        </g>
      ))}
      <Wire pts={[[96, 17], [96, TY[0] - 2]]} fill={T.wireHot} />
      {TY.map((y, r) => (
        <g key={r}>
          <rect x={12} y={y} width={r === 2 ? 114 : 108} height={4} fill={T.panel} />
          <PText x={4} y={y - 4} text={`_{${r + 1}}`} fill={T.textDim} />
        </g>
      ))}
      {ticks.map((t) => (
        <rect key={`${t.x},${t.row}`} x={t.x} y={TY[t.row] + 4 - t.h} width={1} height={t.h} fill={t.win ? T.text : T.textDim} />
      ))}
      <Frame x={winX - 2} y={TY[2] - 2} w={RAG_SEQ_LEN / 2 + 4} h={8} fill={T.wireHot} />
      <PText x={4} y={60} text={genText} fill={T.text} />
      <PText x={4} y={90} text={`the LM reads only the last ${RAG_SEQ_LEN}`} fill={T.textDim} />
    </g>
  );
}

// ═════════════════════════════════ dispatch + defs ═════════════════════════════════

export function AdaptDiagram({ theme, name, still, keys }: { theme: Theme; name: AdaptName; still: boolean; keys?: MutableRefObject<KeyHandler | null> }) {
  return name === "lora" ? <LoraDiagram theme={theme} still={still} keys={keys} /> : <RagDiagram theme={theme} still={still} />;
}

export function AdaptCard({ theme, name }: { theme: Theme; name: AdaptName }) {
  return name === "lora" ? <LoraCard theme={theme} /> : <RagCard theme={theme} />;
}

// Structurally the registry's DiagramDef (index.tsx keeps that interface private).
interface AdaptDef {
  view: { w: number; h: number };
  scrub?: boolean;
  interactive?: boolean;
  keysHint?: string;
  title: string;
  truth: string;
  render: (p: { theme: Theme; t: number; onT?: (t: number) => void; still: boolean; keys: MutableRefObject<KeyHandler | null> }) => ReactNode;
  card: { view: { w: number; h: number }; render: (p: { theme: Theme; t: number }) => ReactNode };
  badge: string;
}

const ADAPT_TEXT: Record<AdaptName, Pick<AdaptDef, "title" | "truth" | "badge" | "interactive" | "keysHint">> = {
  lora: {
    title: "lora — freeze W, learn a rank-4 bypass B·A beside it",
    truth:
      "Real: the local mini-lora v1 champion on 8 FashionMNIST test items. It shows the logits with the adapters off (the frozen W alone, whose 10 units still mean digits) and on, per-item cross-entropy, |W| vs |ΔW| per layer, and the trained fc2 factors and fc1's B. ΔW2 = B2·A2 is rebuilt here from 4-bit factors (approximate); fc1's A and the conv maps are not exported, so the convs are structure only. Stage 1 also trained A and B, so 'off' is not exactly the MNIST network. Parameter counts are exact from the shapes. The gate scores MNIST digits with the adapters on (.83); accuracy on Fashion is never measured.",
    badge: "real champion logits",
    interactive: true,
    keysHint: "←/→ pick a Fashion item, or click one",
  },
  rag: {
    title: "rag — fetch the closest passages, paste them before the question",
    truth:
      "Real: the local mini-rag v1 champion. The query's words, the top-3 chunks of Tiny Shakespeare by TF-IDF cosine and their scores, the exact 631-char prompt and the 63 chars the LM wrote. The word weights (idf hear 4.26, me 2.35, speak 4.05), the 4th, 5th and 10th scores, the count of non-zero chunks and the chunk ids were recomputed from the corpus. The LM reads only the last 128 chars of the prompt, and its CE (2.46) is the gate's next-char loss on plain text; retrieval itself is never scored. The appended ticks in the motion carry no glyph: which generated char fell where is not exported.",
    badge: "real retrieval and output",
  },
};

export const ADAPT_DEFS: Record<string, AdaptDef> = Object.fromEntries(
  (Object.keys(ADAPT_TEXT) as AdaptName[]).map((n) => [n, {
    view: ADAPT_VIEW,
    ...ADAPT_TEXT[n],
    render: ({ theme, still, keys }) => <AdaptDiagram theme={theme} name={n} still={still} keys={keys} />,
    card: { view: ADAPT_CARD_VIEW, render: ({ theme }) => <AdaptCard theme={theme} name={n} /> },
  } satisfies AdaptDef]),
);
