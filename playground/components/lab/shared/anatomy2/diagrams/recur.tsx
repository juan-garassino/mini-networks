"use client";

// Recurrence family, unrolled over the real line "Speak, speak.":
//   rnn    models/rnn/model.py   char embedding 256 → 2-layer LSTM (256) →
//          lm_head. One cell, reused at every step, carrying (h, c).
//   mamba  models/mamba/model.py NanoMamba block: LayerNorm → Linear 128→256 →
//          causal depthwise conv (k=4) → u·SiLU, gate·sigmoid →
//          s_t = a·s_{t−1} + b·u_t (a, b learned per channel, NOT input-
//          dependent: this mini version has no "selectivity") → g·s → Linear.
// REAL (data/rnn-champion.ts, data/mamba-champion.ts via export_seq.py): the
// states at every step for the channels that move most, mamba's learned a and
// b, and each step's top next-char guess + p(true next char).
import { useMemo } from "react";
import * as RNN from "../data/rnn-champion";
import * as MAM from "../data/mamba-champion";
import { unNib } from "../math";
import { Diamond, Frame, PText, Thumb, Wire } from "../prims";
import type { Theme } from "../themes";

export const RECUR_VIEW = { w: 560, h: 316 };
export const RECUR_CARD_VIEW = { w: 190, h: 104 };
export type RecurName = "rnn" | "mamba";

const LINE = "Speak, speak.";
const N = LINE.length;
const show = (ch: string) => (ch === " " ? "·" : ch === "\n" ? "↵" : ch);

interface Out { pred: readonly string[]; predP: readonly number[]; trueP: readonly number[] }
const OUT: Record<RecurName, Out> = { rnn: RNN.RNN_OUT, mamba: MAM.MAMBA_OUT };

function column(v: ArrayLike<number>, x: number, y: number, w: number, h: number, pal: readonly string[], heat = false) {
  const ds: string[] = Array(8).fill("");
  for (let i = 0; i < v.length; i++) {
    const q = heat ? Math.max(0, Math.min(7, Math.floor(v[i] * 8))) : Math.max(0, Math.min(7, Math.floor(((v[i] + 1) / 2) * 8)));
    ds[q] += `M${x} ${y + i * h}h${w}v${h}h${-w}z`;
  }
  return ds.map((d, i) => (d ? <path key={i} d={d} fill={pal[i]} /> : null));
}

function ce(o: Out) {
  return -o.trueP.reduce((a, p) => a + Math.log(Math.max(1e-6, p)), 0) / o.trueP.length;
}

export function RecurDiagram({ theme, name }: { theme: Theme; name: RecurName }) {
  const T = theme;
  const o = OUT[name];
  const X0 = 106, DX = 34;
  const cx = (t: number) => X0 + t * DX;
  const data = useMemo(() => name === "rnn"
    ? { a: RNN.RNN_H.map((s) => unNib(s)), b: RNN.RNN_C.map((s) => unNib(s)), c: null as Float32Array[] | null }
    : { a: MAM.MAMBA_U.map((s) => unNib(s)), b: MAM.MAMBA_G.map((s) => unNib(s, 0, 1)), c: MAM.MAMBA_S.map((s) => unNib(s)) }, [name]);
  const ch = name === "rnn" ? RNN.RNN_CH.length : MAM.MAMBA_CH.length;
  const SH = name === "rnn" ? 3 : 4;          // px per channel in a strip
  const sh = ch * SH;
  const Y = { chars: 18, cell: 52 };
  const rowsY = name === "rnn"
    ? [{ y: Y.cell + 12, label: "c: cell state", sub: "(the long lane)" }, { y: Y.cell + 12 + sh + 22, label: "h: hidden state", sub: "(what it says)" }]
    : [{ y: Y.cell + 12, label: "u: input", sub: "conv, SiLU" }, { y: Y.cell + 12 + sh + 14, label: "s: state", sub: "a·s + b·u" }];
  const cellBottom = rowsY[rowsY.length - 1].y + sh + 8;
  const outY = Math.max(cellBottom + 16, 240);
  return (
    <g>
      <rect x={0} y={0} width={RECUR_VIEW.w} height={RECUR_VIEW.h} fill={T.ground} />
      <PText x={16} y={Y.chars + 4} text="char" fill={T.textDim} />
      {Array.from({ length: N }, (_, t) => (
        <g key={t}>
          <rect x={cx(t)} y={Y.chars} width={14} height={14} fill={T.panel} />
          <Frame x={cx(t)} y={Y.chars} w={14} h={14} fill={T.frame} />
          <PText x={cx(t) + 7} y={Y.chars + 4} text={show(LINE[t])} fill={T.text} anchor="middle" />
          <Wire pts={[[cx(t) + 7, Y.chars + 16], [cx(t) + 7, Y.cell - 2]]} fill={T.wire} />
          <PText x={cx(t) + 7} y={4} text={`_{${t}}`} fill={T.textDim} anchor="middle" />
        </g>
      ))}

      {/* the same cell at every step */}
      {Array.from({ length: N }, (_, t) => {
        const x = cx(t) - 4;
        const h = rowsY[rowsY.length - 1].y + sh - Y.cell + 8;
        return (
          <g key={`c${t}`}>
            <rect x={x} y={Y.cell} width={22} height={h} fill={T.panel} />
            <Frame x={x} y={Y.cell} w={22} h={h} fill={T.accentLo} />
            {name === "rnn" && column(data.b[t], x + 5, rowsY[0].y, 12, SH, T.ramp)}
            {name === "rnn" && column(data.a[t], x + 5, rowsY[1].y, 12, SH, T.ramp)}
            {name === "mamba" && column(data.a[t], x + 5, rowsY[0].y, 12, SH, T.ramp)}
            {name === "mamba" && column(data.c![t], x + 5, rowsY[1].y, 12, SH, T.ramp)}
            {name === "mamba" && column(data.b[t], x + 18, rowsY[1].y, 2, SH, T.heat, true)}
            {/* state handed to the next step */}
            {t < N - 1 && name === "rnn" && (
              <>
                <Wire pts={[[x + 22, rowsY[0].y + sh / 2], [x + DX, rowsY[0].y + sh / 2]]} fill={T.wireHot} step={1} />
                <Wire pts={[[x + 22, rowsY[1].y + sh / 2], [x + DX, rowsY[1].y + sh / 2]]} fill={T.wireHot} step={2} />
              </>
            )}
            {t < N - 1 && name === "mamba" && (
              <Wire pts={[[x + 22, rowsY[1].y + sh / 2], [x + DX, rowsY[1].y + sh / 2]]} fill={T.wireHot} step={1} />
            )}
            <Wire pts={[[cx(t) + 7, Y.cell + h + 1], [cx(t) + 7, outY - 3]]} fill={T.wire} />
          </g>
        );
      })}
      {rowsY.map((r, k) => (
        <g key={`l${k}`}>
          <PText x={16} y={r.y + 2} text={r.label} fill={T.text} />
          <PText x={16} y={r.y + 12} text={r.sub} fill={T.textDim} />
        </g>
      ))}
      {name === "mamba" && (
        <>
          <PText x={16} y={rowsY[1].y + 26} text="gate g: thin" fill={T.textDim} />
          <PText x={16} y={rowsY[1].y + 36} text="strip, right" fill={T.textDim} />
        </>
      )}

      {/* guesses */}
      <PText x={16} y={outY + 4} text="guess" fill={T.textDim} />
      {Array.from({ length: N }, (_, t) => {
        const truth = t + 1 < N ? LINE[t + 1] : null;
        const ok = truth !== null && o.pred[t] === truth;
        return (
          <g key={`o${t}`}>
            <rect x={cx(t)} y={outY} width={14} height={14} fill={ok ? T.accent : T.panel} />
            <Frame x={cx(t)} y={outY} w={14} h={14} fill={T.frame} />
            <PText x={cx(t) + 7} y={outY + 4} text={show(o.pred[t])} fill={ok ? T.panel : T.text} anchor="middle" />
            <rect x={cx(t)} y={outY + 16} width={Math.max(1, Math.round(o.predP[t] * 14))} height={2} fill={ok ? T.accentHi : T.textDim} />
            <PText x={cx(t) + 7} y={outY + 22} text={truth === null ? "" : show(truth)} fill={T.textDim} anchor="middle" />
          </g>
        );
      })}
      <PText x={16} y={outY + 22} text="real" fill={T.textDim} />
      <Diamond cx={cx(N - 1) + 30} cy={outY + 7} r={5} theme={T} />
      <PText x={cx(N - 1) + 30} y={outY + 16} text="CE" fill={T.loss} anchor="middle" />
      <PText x={cx(N - 1) + 30} y={outY + 26} text={ce(o).toFixed(2)} fill={T.loss} anchor="middle" />

      <PText x={16} y={RECUR_VIEW.h - 14} text={name === "rnn"
        ? `one LSTM cell reused 13 times, 2 layers × 256; showing the ${ch} top-layer channels that move most`
        : `block 1 of 4; ${ch} of 128 channels; learned decay a = ${Math.min(...MAM.MAMBA_A).toFixed(2)} to ${Math.max(...MAM.MAMBA_A).toFixed(2)}, still near its start, 0.5`} fill={T.textDim} />
    </g>
  );
}

export function RecurCard({ theme, name }: { theme: Theme; name: RecurName }) {
  const T = theme;
  const o = OUT[name];
  const st = useMemo(() => (name === "rnn" ? RNN.RNN_H : MAM.MAMBA_S).map((s) => unNib(s)), [name]);
  const DX = 14, X0 = 6;
  const ch = st[0].length;
  return (
    <g>
      <rect x={0} y={0} width={RECUR_CARD_VIEW.w} height={RECUR_CARD_VIEW.h} fill={T.ground} />
      {Array.from({ length: N }, (_, t) => {
        const truth = t + 1 < N ? LINE[t + 1] : null;
        const ok = truth !== null && o.pred[t] === truth;
        return (
          <g key={t}>
            <PText x={X0 + t * DX + 5} y={2} text={show(LINE[t])} fill={T.text} anchor="middle" />
            {column(st[t], X0 + t * DX, 14, 10, 2, T.ramp)}
            {t < N - 1 && <rect x={X0 + t * DX + 10} y={14 + ch} width={4} height={1} fill={T.wireHot} />}
            <rect x={X0 + t * DX} y={18 + ch * 2} width={11} height={12} fill={ok ? T.accent : T.panel} />
            <PText x={X0 + t * DX + 5} y={20 + ch * 2} text={show(o.pred[t])} fill={ok ? T.panel : T.text} anchor="middle" />
          </g>
        );
      })}
      <PText x={X0} y={34 + ch * 2} text={name === "rnn" ? "hidden state, step by step" : "scan state, step by step"} fill={T.textDim} />
    </g>
  );
}
