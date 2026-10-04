"use client";

// Text family built on the transformer (diagrams/transformer.tsx is the parent;
// its row/bar/grid shapes are copied here so the eye finds the delta alone):
//   text_token_classifier  models/text_token_classifier/model.py — token + pos
//                          embedding (d_model 64) → 2 post-LN encoder blocks
//                          (2 heads × 32, FFN 64→256→64 ReLU, NO causal mask,
//                          no final norm) → Linear(64→2) per POSITION; label =
//                          1 iff the char is a vowel. Introduces bidirectional
//                          encoding: the attention square is FULL, and the
//                          hot step line marks where the parent's mask began.
//   text_seq2seq           models/text_seq2seq/model.py — src_embed / tgt_embed
//                          + one shared pos table; 2-block encoder (no mask,
//                          FFN 64→128→64, + final LN) → memory [32×64]; 2-block
//                          decoder (causal self-attn → CROSS attention over the
//                          memory, no mask → FFN, + final LN) → Linear(64→65).
//                          Introduces encoder-decoder cross-attention: the hot
//                          memory bus climbing into both decoder blocks.
//
// REAL (data/*-champion.ts, local champions, CPU inference — no training):
//   TOK — char ids, p(vowel), the 0/1 flags on "Speak, speak." (13/13), and the
//         encoder self-attention of every block × head (TOK_ATTN, nibbles 0..1)
//         with its exact mass on later characters (TOK_ATTN_FUTURE).
//   S2S — the 32 source chars, the 31 teacher-forced top-1 guesses + p for
//         tgt[1..31] (12/31 right), p(true char) → CE 2.24 from the exported
//         probabilities, one sampled decode at T .8, and the decoder's
//         cross-attention of every block × head (S2S_CROSS, nibbles 0..0.25,
//         drawn ×8) with its max weight and row entropy.
// Structure only (exact from the code): the decoder's causal self-attention
// triangle in the inset — it is the inherited mask shape, drawn flat.
import { useEffect, useMemo, useState, type MutableRefObject, type ReactNode } from "react";
import {
  S2S_CROSS, S2S_CROSS_ENTROPY, S2S_CROSS_HI, S2S_PRED, S2S_PRED_P, S2S_SAMPLED, S2S_SRC, S2S_TEMPERATURE, S2S_TGT, S2S_TRUE_P,
} from "../data/text_seq2seq-champion";
import { TOK_ATTN, TOK_ATTN_FUTURE, TOK_LINE, TOK_LINE_IDS, TOK_LINE_P, TOK_LINE_PRED, TOK_LINE_TRUE } from "../data/text_token_classifier-champion";
import { unNib } from "../math";
import { Bars, Diamond, Frame, PText, Wire } from "../prims";
import { useTick } from "../tick";
import { heatIndex, type Theme } from "../themes";
import type { KeyHandler } from "./types";

export const TEXT_VIEW = { w: 560, h: 316 };
export type TextName = "text_token_classifier" | "text_seq2seq";
export const TEXT_CARD_VIEW: Record<TextName, { w: number; h: number }> = {
  text_token_classifier: { w: 190, h: 124 },
  text_seq2seq: { w: 190, h: 124 },
};

const show = (ch: string) => (ch === " " ? "·" : ch === "\n" ? "↵" : ch);
/** house number format: two decimals, leading zero dropped under 1 */
const fmt = (v: number) => (Math.abs(v) < 1 ? v.toFixed(2).replace(/^0/, "") : v.toFixed(2));
/** cycle the 4 (block, head) maps: d = +1 → next, −1 → previous */
const nextHead = (v: { layer: number; head: number }, d: number) => {
  const k = (v.layer * 2 + v.head + d + 4) % 4;
  return { layer: Math.floor(k / 2), head: k % 2 };
};

/** n×n (or rows×cols) heat cells as 8 merged paths, one per heat level. */
function heatPaths(vals: ArrayLike<number>, rows: number, cols: number, x0: number, y0: number, pitch: number, cell: number, scale = 1): string[] {
  const d: string[] = Array(8).fill("");
  for (let i = 0; i < rows; i++) {
    for (let k = 0; k < cols; k++) {
      d[heatIndex(vals[i * cols + k] / scale)] += `M${x0 + k * pitch} ${y0 + i * pitch}h${cell}v${cell}h${-cell}z`;
    }
  }
  return d;
}

/* ═══════════════════ text_token_classifier ═══════════════════ */
// parent constants (transformer.tsx): rows of 18 px, char cell 14×14 at x 16,
// Bars bw 3 gap 1 spanning TOP..BOT, per-row FFN bars, guess column, grid.
const TN = TOK_LINE.length; // 13
const ROW0 = 40, RH = 18;
const ry = (i: number) => ROW0 + i * RH;        // row top
const rc = (i: number) => ry(i) + 7;            // row centre
const BW = 3, GAP = 1;
const LAYER_X = [88, 152];                      // 2 blocks (the parent has 4)
const ATTN_W = 2 * BW + GAP;                    // 2 heads × 32 dims → 1 bar = 32 channels
const FFN_X = ATTN_W + 6;
const TOP = ROW0 - 2, BOT = ry(TN - 1) + 16;    // 38, 272
const LABEL_Y = BOT + 6;                        // the one row for `+pos` and `_{2}`
const HEAD_X = 216;                             // Linear(64→2): a 2-px sliver
const OUT_X = 238;
const GRID = { x: 330, y: 40, c: 12 };
const MINI = { x: 498, y: 40, pitch: TN + 4 };
const HDR1 = 18, HDR2 = 28;                     // the two header rows, shared by every column
const TOK_DEFAULT = { layer: 1, head: 0, q: 7 }; // block 2 head 1, the `s`: reads the `e` before it AND the `e` after it

/** the hot step: the line where the parent's causal mask would begin (right of it = later chars) */
function stepPath(x0: number, y0: number, cw: number, rh: number, n: number): string {
  let d = "";
  for (let i = 0; i < n - 1; i++) {
    const xv = x0 + (i + 1) * cw - 1;
    d += `M${xv} ${y0 + i * rh - 1}h1v${rh + 1}h-1z`;                 // down the gap right of cell (i, i)
    d += `M${xv} ${y0 + (i + 1) * rh - 1}h${cw + 1}v1h${-(cw + 1)}z`;  // along the gap under cell (i, i+1)
  }
  return d;
}

function TokenClassifierDiagram({ theme: T, still, keys: keysRef }: { theme: Theme; still: boolean; keys?: MutableRefObject<KeyHandler | null> }) {
  const [sel, setSel] = useState(TOK_DEFAULT);
  const s = still ? TOK_DEFAULT : sel;
  const frame = useTick(3, 3, still);
  const maps = useMemo(() => TOK_ATTN.map((L) => L.map((h) => unNib(h, 0, 1))), []);
  const A = maps[s.layer][s.head];
  const w = (q: number, k: number) => A[q * TN + k];
  // CE = −mean ln p(true label); the exported p are saturated (0/1 at 3 decimals), so this prints .00 (exact 0.0002)
  const ce = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < TN; i++) sum += Math.log(Math.max(1e-6, TOK_LINE_TRUE[i] ? TOK_LINE_P[i] : 1 - TOK_LINE_P[i]));
    return Math.max(0, -sum / TN);
  }, []);
  const step = useMemo(() => stepPath(GRID.x, GRID.y, GRID.c, GRID.c, TN), []);

  useEffect(() => {
    if (!keysRef || still) return;
    keysRef.current = (e) => {
      if (e.key === "ArrowUp") { setSel((v) => ({ ...v, q: Math.max(0, v.q - 1) })); return true; }
      if (e.key === "ArrowDown") { setSel((v) => ({ ...v, q: Math.min(TN - 1, v.q + 1) })); return true; }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const d = e.key === "ArrowRight" ? 1 : -1;
        setSel((v) => ({ ...v, ...nextHead(v, d) }));
        return true;
      }
      return false;
    };
    return () => { keysRef.current = null; };
  }, [keysRef, still]);

  const interactive = !still;
  const lx = LAYER_X[s.layer];
  const wx = lx - 4;                                  // the reach wire's column (the parent's lx − 4)
  const keyRows = Array.from({ length: TN }, (_, k) => k).filter((k) => w(s.q, k) >= 0.06);
  const above = keyRows.filter((k) => k < s.q), below = keyRows.filter((k) => k > s.q);
  const qIsKey = keyRows.includes(s.q);

  return (
    <g>
      <rect x={0} y={0} width={TEXT_VIEW.w} height={TEXT_VIEW.h} fill={T.ground} />

      {/* headers: two shared rows */}
      <PText x={16} y={HDR1} text="char" fill={T.textDim} />
      <PText x={54} y={HDR1} text="embed" fill={T.textDim} />
      {LAYER_X.map((x, l) => (
        <g key={l}>
          <PText x={x} y={HDR1} text={`block ${l + 1}`} fill={l === s.layer ? T.text : T.textDim} />
          <PText x={x - 6} y={HDR2} text="attn" fill={T.textDim} />
          <PText x={x + FFN_X + 8} y={HDR2} text="ffn" fill={T.textDim} />
        </g>
      ))}
      <PText x={HEAD_X - 6} y={HDR2} text="head" fill={T.textDim} />
      <PText x={OUT_X - 2} y={HDR1} text="p(vowel)" fill={T.textDim} />
      <PText x={OUT_X - 2} y={HDR2} text="guess" fill={T.textDim} />
      <PText x={OUT_X + 30} y={HDR2} text="real" fill={T.textDim} />

      {/* residual stream: one thread per position */}
      {Array.from({ length: TN }, (_, i) => (
        <Wire key={`r${i}`} pts={[[72, rc(i)], [OUT_X - 4, rc(i)]]} fill={i === s.q ? T.wireHot : T.wire} />
      ))}

      {/* chars → ids → embedding (2 cells = 64 dims) */}
      {Array.from({ length: TN }, (_, i) => {
        const hot = i === s.q;
        return (
          <g key={`t${i}`} onClick={interactive ? () => setSel((v) => ({ ...v, q: i })) : undefined} style={interactive ? { cursor: "pointer" } : undefined}>
            <rect x={16} y={ry(i)} width={14} height={14} fill={T.panel} />
            <Frame x={16} y={ry(i)} w={14} h={14} fill={T.frame} />
            <PText x={23} y={ry(i) + 4} text={show(TOK_LINE[i])} fill={hot ? T.wireHot : T.text} anchor="middle" />
            <PText x={34} y={ry(i) + 5} text={`_{${TOK_LINE_IDS[i]}}`} fill={T.textDim} />
            {[0, 1].map((c) => <rect key={c} x={54 + c * 4} y={ry(i) + 2} width={3} height={10} fill={hot ? (c === 0 ? T.accentHi : T.accent) : T.accentLo} />)}
          </g>
        );
      })}
      <PText x={54} y={LABEL_Y} text="+pos" fill={T.textDim} />

      {/* the 2 blocks: one bar per head across all rows (the selected head lit), FFN bars cut per row */}
      {LAYER_X.map((x, l) => (
        <g key={`b${l}`}>
          {[0, 1].map((h) => (
            <Bars key={h} x={x + h * (BW + GAP)} y={TOP} bars={1} h={BOT - TOP} theme={T} bw={BW} gap={GAP} dim={!(l === s.layer && h === s.head)} />
          ))}
          {Array.from({ length: TN }, (_, i) => (
            <Bars key={i} x={x + FFN_X} y={ry(i) + 1} bars={8} h={12} theme={T} bw={BW} gap={GAP} dim={i !== s.q || l !== s.layer} />
          ))}
        </g>
      ))}

      {/* where the selected query reads from — real keys (w ≥ .06), ABOVE and BELOW it: no mask.
          The dots march toward the query from both ends. */}
      {above.length > 0 && <Wire pts={[[wx, rc(Math.min(...above))], [wx, rc(s.q) - 4]]} fill={T.wireHot} step={3} phase={frame} />}
      {below.length > 0 && <Wire pts={[[wx, rc(Math.max(...below))], [wx, rc(s.q) + 4]]} fill={T.wireHot} step={3} phase={frame} />}
      {!qIsKey && <Wire pts={[[wx, rc(s.q)], [wx + 2, rc(s.q)]]} fill={T.wireHot} step={1} />}
      {keyRows.map((k) => (
        <rect key={`k${k}`} x={lx - 6} y={rc(k) - 2} width={5} height={5} fill={T.heat[Math.max(3, heatIndex(w(s.q, k)))]} />
      ))}

      {/* head: Linear(64→2), one 2-way score per position */}
      <rect x={HEAD_X} y={TOP} width={2} height={BOT - TOP} fill={T.accentHi} />
      <PText x={HEAD_X} y={LABEL_Y - 2} text="_{2}" fill={T.textDim} />

      {/* output column: guess flag, p(vowel) bar, true flag */}
      {Array.from({ length: TN }, (_, i) => {
        const ok = TOK_LINE_PRED[i] === TOK_LINE_TRUE[i];
        return (
          <g key={`o${i}`}>
            <rect x={OUT_X} y={ry(i)} width={14} height={14} fill={ok ? T.accent : T.panel} />
            <Frame x={OUT_X} y={ry(i)} w={14} h={14} fill={T.frame} />
            <PText x={OUT_X + 7} y={ry(i) + 4} text={String(TOK_LINE_PRED[i])} fill={ok ? T.ground : T.text} anchor="middle" />
            <rect x={OUT_X + 16} y={ry(i) + 6} width={Math.max(1, Math.round(TOK_LINE_P[i] * 12))} height={2} fill={ok ? T.accentHi : T.textDim} />
            <PText x={OUT_X + 32} y={ry(i) + 4} text={String(TOK_LINE_TRUE[i])} fill={T.textDim} />
          </g>
        );
      })}
      <Diamond cx={OUT_X + 10} cy={BOT + 14} theme={T} r={5} />
      <PText x={OUT_X + 20} y={BOT + 11} text={`CE ${fmt(ce)}`} fill={T.loss} />

      {/* the selected head's real square: rows = query, cols = key, NO masked half.
          The hot step is where the parent's mask began — everything right of it is a later char. */}
      <PText x={GRID.x - 12} y={HDR1} text={`block ${s.layer + 1}, head ${s.head + 1}`} fill={T.wireHot} />
      {Array.from({ length: TN }, (_, i) => (
        <g key={`g${i}`}>
          <PText x={GRID.x - 7} y={GRID.y + i * GRID.c + 2} text={show(TOK_LINE[i])} fill={i === s.q ? T.wireHot : T.textDim} anchor="middle" />
          <PText x={GRID.x + i * GRID.c + 5} y={HDR2} text={show(TOK_LINE[i])} fill={T.textDim} anchor="middle" />
          {Array.from({ length: TN }, (_, k) => (
            <rect key={k} x={GRID.x + k * GRID.c} y={GRID.y + i * GRID.c} width={GRID.c - 1} height={GRID.c - 1} fill={T.heat[heatIndex(w(i, k))]} />
          ))}
        </g>
      ))}
      <path d={step} fill={T.wireHot} />
      <Frame x={GRID.x - 1} y={GRID.y + s.q * GRID.c - 1} w={TN * GRID.c + 1} h={GRID.c + 1} fill={T.wireHot} />
      <PText x={GRID.x} y={GRID.y + TN * GRID.c + 4} text="reads both ways" fill={T.wireHot} />
      <PText x={GRID.x} y={GRID.y + TN * GRID.c + 14} text="right of the step = later chars" fill={T.textDim} />
      <PText x={GRID.x} y={GRID.y + TN * GRID.c + 24} text={`they get ${fmt(TOK_ATTN_FUTURE[s.layer][s.head])} of each row (parent: 0)`} fill={T.textDim} />
      <PText x={GRID.x} y={GRID.y + TN * GRID.c + 44} text="label = f(char): a lookup." fill={T.loss} />
      <PText x={GRID.x} y={GRID.y + TN * GRID.c + 54} text="both ways by design, not by need" fill={T.loss} />

      {/* all 4 heads (real), pick one */}
      <PText x={MINI.x} y={HDR1} text="heads" fill={T.textDim} />
      {[0, 1].map((h) => <PText key={`mh${h}`} x={MINI.x + h * MINI.pitch + 6} y={HDR2} text={String(h + 1)} fill={T.textDim} anchor="middle" />)}
      {[0, 1].map((l) => <PText key={`ml${l}`} x={MINI.x + 2 * MINI.pitch} y={MINI.y + l * MINI.pitch + 3} text={`b${l + 1}`} fill={T.textDim} />)}
      {maps.map((L, l) => L.map((m, h) => {
        const x = MINI.x + h * MINI.pitch, y = MINI.y + l * MINI.pitch;
        const d = heatPaths(m, TN, TN, x, y, 1, 1);
        const on = l === s.layer && h === s.head;
        return (
          <g key={`m${l}${h}`} onClick={interactive ? () => setSel((v) => ({ ...v, layer: l, head: h })) : undefined} style={interactive ? { cursor: "pointer" } : undefined}>
            <rect x={x} y={y} width={TN} height={TN} fill={T.panel} />
            {d.map((p, i) => (p ? <path key={i} d={p} fill={T.heat[i]} /> : null))}
            <Frame x={x - 2} y={y - 2} w={TN + 4} h={TN + 4} fill={on ? T.text : T.ground} />
          </g>
        );
      }))}

      <PText x={16} y={TEXT_VIEW.h - 14} text="1 bar = 32 channels   2 blocks, 2 heads, width 64, ffn 256, 65 chars → 2 labels" fill={T.textDim} />
    </g>
  );
}

// card: the parent's 13-column grid shape, FULL, with the real head and the hot step, over the 13 vowel flags
function TokenClassifierCard({ theme: T }: { theme: Theme }) {
  const V = TEXT_CARD_VIEW.text_token_classifier;
  const X0 = 16, CW = 12, RH2 = 6, Y0 = 16;   // 13 cols × 12 = 156 → x 16..171
  const A = useMemo(() => unNib(TOK_ATTN[TOK_DEFAULT.layer][TOK_DEFAULT.head], 0, 1), []);
  const step = useMemo(() => stepPath(X0, Y0, CW, RH2, TN), []);
  const right = TOK_LINE_PRED.filter((f, i) => f === TOK_LINE_TRUE[i]).length;
  return (
    <g>
      <rect x={0} y={0} width={V.w} height={V.h} fill={T.ground} />
      {Array.from({ length: TN }, (_, i) => (
        <g key={i}>
          <PText x={X0 + i * CW + 5} y={4} text={show(TOK_LINE[i])} fill={T.text} anchor="middle" />
          {Array.from({ length: TN }, (_, k) => (
            <rect key={k} x={X0 + k * CW} y={Y0 + i * RH2} width={CW - 1} height={RH2 - 1} fill={T.heat[heatIndex(A[i * TN + k])]} />
          ))}
        </g>
      ))}
      <path d={step} fill={T.wireHot} />
      {Array.from({ length: TN }, (_, i) => {
        const ok = TOK_LINE_PRED[i] === TOK_LINE_TRUE[i];
        return (
          <g key={`g${i}`}>
            <rect x={X0 + i * CW} y={Y0 + TN * RH2 + 3} width={CW - 1} height={13} fill={ok ? T.accent : T.panel} />
            <PText x={X0 + i * CW + 5} y={Y0 + TN * RH2 + 6} text={String(TOK_LINE_PRED[i])} fill={ok ? T.ground : T.text} anchor="middle" />
          </g>
        );
      })}
      <PText x={X0} y={Y0 + TN * RH2 + 19} text={`reads both ways · vowel? ${right}/${TN}`} fill={T.textDim} />
    </g>
  );
}

/* ═══════════════════ text_seq2seq ═══════════════════ */
// two of the parent's stacks at an 8-px row pitch (32 + 31 glyph rows fit the
// 316-px height), joined by the hot memory bus; the right third opens the
// selected decoder block: causal triangle (inherited) → real cross rectangle 31×32.
const NE = S2S_SRC.length;        // 32 source chars
const ND = S2S_TGT.length - 1;    // 31 decoder inputs tgt[0..30]; predicted = tgt[1..31]
const S_ROW0 = 32, S_RH = 8;
const sy = (i: number) => S_ROW0 + i * S_RH;
const sc = (i: number) => sy(i) + 3;
const S_TOP = S_ROW0 - 2;
const BOT_E = sy(NE - 1) + 10;    // 290
const BOT_D = sy(ND - 1) + 10;    // 282
const S_HDR1 = 12, S_HDR2 = 22;
const EX = { glyph: 16, emb: 26, thread: [36, 126] as const, blocks: [40, 76], ln: 110, keys: 120, bus: 128 };
const DX = { glyph: 150, emb: 160, thread: [170, 284] as const, blocks: [176, 226], ln: 268, lm: 278, out: 287, p: 296, real: 312 };
const CROSS = 13, FFN = 26;       // offsets inside a decoder block: self · cross · ffn
const E_FFN = 13;                 // inside an encoder block: attn · ffn
const INX = 338;                  // the inset
const RECT = { x: INX, y: 110, p: 4, c: 3 };   // 31×32 cross cells, 3×3 on a 4-px pitch
const BUS_Y = BOT_E;
const crossX = (b: number) => DX.blocks[b] + CROSS + BW;  // the 1-px gap between the two cross-head bars (bw 3, gap 1)
const UNIFORM = 1 / NE;           // a perfectly flat cross row
const CROSS_FULL = 0.125;         // heat ×8: a cross cell is full at w = .125, so flat (1/32) sits at heat 2 and the texture shows
const S2S_DEFAULT = { layer: 0, head: 1, q: 5 };  // block 1 head 2 (the sharpest map, lowest entropy); the `f` of "further"

function Seq2SeqDiagram({ theme: T, still, keys: keysRef }: { theme: Theme; still: boolean; keys?: MutableRefObject<KeyHandler | null> }) {
  const [sel, setSel] = useState(S2S_DEFAULT);
  const s = still ? S2S_DEFAULT : sel;
  const frame = useTick(3, 3, still);
  const { ce, ok, right } = useMemo(() => {
    const ok = Array.from({ length: ND }, (_, i) => S2S_PRED[i] === S2S_TGT[i + 1]);
    const ce = -S2S_TRUE_P.reduce((a, p) => a + Math.log(Math.max(1e-6, p)), 0) / S2S_TRUE_P.length;
    return { ce, ok, right: ok.filter(Boolean).length };
  }, []);
  const cross = useMemo(() => S2S_CROSS.map((L) => L.map((h) => unNib(h, 0, S2S_CROSS_HI))), []);
  const W = cross[s.layer][s.head];
  const cells = useMemo(() => heatPaths(W, ND, NE, RECT.x, RECT.y, RECT.p, RECT.c, CROSS_FULL), [W]);
  const temp = String(S2S_TEMPERATURE).replace(/^0/, "");
  const keysOfQ = Array.from({ length: NE }, (_, k) => k).filter((k) => W[s.q * NE + k] >= 2 * UNIFORM);

  useEffect(() => {
    if (!keysRef || still) return;
    keysRef.current = (e) => {
      if (e.key === "ArrowUp") { setSel((v) => ({ ...v, q: Math.max(0, v.q - 1) })); return true; }
      if (e.key === "ArrowDown") { setSel((v) => ({ ...v, q: Math.min(ND - 1, v.q + 1) })); return true; }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const d = e.key === "ArrowRight" ? 1 : -1;
        setSel((v) => ({ ...v, ...nextHead(v, d) }));
        return true;
      }
      return false;
    };
    return () => { keysRef.current = null; };
  }, [keysRef, still]);

  const interactive = !still;
  const ln32 = Math.log(NE);

  return (
    <g>
      <rect x={0} y={0} width={TEXT_VIEW.w} height={TEXT_VIEW.h} fill={T.ground} />

      {/* headers: two shared rows */}
      <PText x={EX.glyph} y={S_HDR1} text={`encoder: ${NE} src chars`} fill={T.textDim} />
      <PText x={EX.glyph} y={S_HDR2} text="src" fill={T.textDim} />
      <PText x={EX.blocks[0]} y={S_HDR2} text="1" fill={T.textDim} />
      <PText x={EX.blocks[0] + E_FFN} y={S_HDR2} text="2" fill={T.textDim} />
      <PText x={EX.ln - 2} y={S_HDR2} text="LN" fill={T.textDim} />
      <PText x={EX.bus - 4} y={S_HDR2} text="mem" fill={T.wireHot} />
      <PText x={DX.glyph} y={S_HDR1} text={`decoder: tgt[0..${ND - 1}]`} fill={T.textDim} />
      <PText x={DX.glyph} y={S_HDR2} text="tgt" fill={T.textDim} />
      {DX.blocks.map((x, b) => (
        <g key={b}>
          <PText x={x} y={S_HDR2} text="1" fill={T.textDim} />
          <PText x={x + CROSS} y={S_HDR2} text="2" fill={T.wireHot} />
          <PText x={x + FFN} y={S_HDR2} text="3" fill={T.textDim} />
        </g>
      ))}
      <PText x={DX.ln - 6} y={S_HDR2} text="LN" fill={T.textDim} />
      <PText x={DX.lm} y={S_HDR2} text="lm" fill={T.textDim} />
      <PText x={DX.out - 3} y={S_HDR1} text="guess" fill={T.textDim} />
      <PText x={DX.p + 2} y={S_HDR2} text="p" fill={T.textDim} />
      <PText x={DX.real - 1} y={S_HDR2} text="real" fill={T.textDim} />

      {/* ——— encoder: 32 rows ——— */}
      {Array.from({ length: NE }, (_, i) => (
        <g key={`e${i}`}>
          <Wire pts={[[EX.thread[0], sc(i)], [EX.thread[1], sc(i)]]} fill={T.wire} />
          <PText x={EX.glyph} y={sy(i)} text={show(S2S_SRC[i])} fill={T.text} />
          {[0, 1].map((c) => <rect key={c} x={EX.emb + c * 4} y={sy(i) + 1} width={3} height={6} fill={T.accentLo} />)}
        </g>
      ))}
      {EX.blocks.map((x, b) => (
        <g key={`eb${b}`}>
          <Bars x={x} y={S_TOP} bars={2} h={BOT_E - S_TOP} theme={T} bw={BW} gap={GAP} dim />
          {Array.from({ length: NE }, (_, i) => (
            <Bars key={i} x={x + E_FFN} y={sy(i) + 1} bars={4} h={6} theme={T} bw={BW} gap={GAP} dim />
          ))}
        </g>
      ))}
      {/* the final LN is lit: its output IS the memory the decoder reads */}
      <Bars x={EX.ln} y={S_TOP} bars={2} h={BOT_E - S_TOP} theme={T} bw={BW} gap={GAP} />
      {/* the memory rows the selected decoder char reads most (≥ 2× flat), at the bus mouth */}
      {keysOfQ.map((k) => (
        <rect key={`kq${k}`} x={EX.keys} y={sc(k) - 1} width={3} height={3} fill={T.heat[Math.max(3, heatIndex(W[s.q * NE + k] / CROSS_FULL))]} />
      ))}

      {/* ——— decoder: 31 rows, teacher forcing ——— */}
      {Array.from({ length: ND }, (_, i) => (
        <g key={`d${i}`} onClick={interactive ? () => setSel((v) => ({ ...v, q: i })) : undefined} style={interactive ? { cursor: "pointer" } : undefined}>
          <Wire pts={[[DX.thread[0], sc(i)], [DX.thread[1], sc(i)]]} fill={T.wire} />
          <rect x={DX.glyph - 1} y={sy(i)} width={8} height={S_RH} fill={T.ground} fillOpacity={0} />
          <PText x={DX.glyph} y={sy(i)} text={show(S2S_TGT[i])} fill={i === s.q ? T.wireHot : T.text} />
          {[0, 1].map((c) => <rect key={c} x={DX.emb + c * 4} y={sy(i) + 1} width={3} height={6} fill={T.accentLo} />)}
        </g>
      ))}
      {DX.blocks.map((x, b) => (
        <g key={`db${b}`}>
          {[0, 1].map((h) => (
            <g key={h}>
              <Bars x={x + h * (BW + GAP)} y={S_TOP} bars={1} h={BOT_D - S_TOP} theme={T} bw={BW} gap={GAP} dim={!(b === s.layer && h === s.head)} />
              <Bars x={x + CROSS + h * (BW + GAP)} y={S_TOP} bars={1} h={BOT_D - S_TOP} theme={T} bw={BW} gap={GAP} dim={!(b === s.layer && h === s.head)} />
            </g>
          ))}
          {Array.from({ length: ND }, (_, i) => (
            <Bars key={i} x={x + FFN} y={sy(i) + 1} bars={4} h={6} theme={T} bw={BW} gap={GAP} dim />
          ))}
        </g>
      ))}
      <Bars x={DX.ln} y={S_TOP} bars={2} h={BOT_D - S_TOP} theme={T} bw={BW} gap={GAP} dim />
      <Bars x={DX.lm} y={S_TOP} bars={2} h={BOT_D - S_TOP} theme={T} bw={BW} gap={GAP} dim />

      {/* ——— the memory bus (introduced): encoder output → the cross-attention pair of BOTH decoder blocks.
          Each climb runs up the 1-px gap between the two cross-head bars, the whole stack high, so the
          marching dots visibly feed every decoder row. Drawn after the Bars: in paper the first bar's
          shadow fills that gap column, and the wire must sit on top of it. ——— */}
      <Wire pts={[[EX.bus, S_ROW0 + 3], [EX.bus, BUS_Y], [crossX(0), BUS_Y], [crossX(0), S_TOP]]} fill={T.wireHot} step={3} phase={frame} />
      <Wire pts={[[crossX(0), BUS_Y], [crossX(1), BUS_Y], [crossX(1), S_TOP]]} fill={T.wireHot} step={3} phase={frame} />

      {/* output: guess vs tgt[i+1], p bar */}
      {Array.from({ length: ND }, (_, i) => (
        <g key={`o${i}`}>
          <rect x={DX.out} y={sy(i)} width={7} height={7} fill={ok[i] ? T.accent : T.panel} />
          <PText x={DX.out + 1} y={sy(i)} text={show(S2S_PRED[i])} fill={ok[i] ? T.ground : T.text} />
          <rect x={DX.p} y={sy(i) + 3} width={Math.max(1, Math.round(S2S_PRED_P[i] * 12))} height={2} fill={ok[i] ? T.accentHi : T.textDim} />
          <PText x={DX.real} y={sy(i)} text={show(S2S_TGT[i + 1])} fill={T.textDim} />
        </g>
      ))}
      <Diamond cx={DX.p + 2} cy={BOT_D + 12} theme={T} r={5} />
      <PText x={DX.p + 12} y={BOT_D + 9} text={`CE ${fmt(ce)}`} fill={T.loss} />

      {/* ——— inset: inside the selected decoder block ——— */}
      <PText x={INX} y={S_HDR1} text={`decoder block ${s.layer + 1}, head ${s.head + 1}`} fill={T.wireHot} />
      {Array.from({ length: ND }, (_, i) => (
        <rect key={`tri${i}`} x={INX} y={S_TOP + 2 * i} width={2 * (i + 1)} height={2} fill={T.heat[3]} />
      ))}
      <PText x={INX + 66} y={S_ROW0} text="1 self-attn" fill={T.text} />
      <PText x={INX + 66} y={S_ROW0 + 10} text={`causal ${ND}×${ND}`} fill={T.textDim} />
      <PText x={INX + 66} y={S_ROW0 + 20} text="inherited: mask shape" fill={T.textDim} />

      <PText x={INX} y={RECT.y - 12} text="2 cross-attn" fill={T.wireHot} />
      <PText x={INX + 78} y={RECT.y - 12} text="Q tgt, KV src, no mask" fill={T.textDim} />
      <rect x={RECT.x} y={RECT.y} width={NE * RECT.p - 1} height={ND * RECT.p - 1} fill={T.heat[0]} />
      {cells.map((p, i) => (p ? <path key={i} d={p} fill={T.heat[i]} /> : null))}
      <Frame x={RECT.x - 1} y={RECT.y - 1} w={NE * RECT.p + 1} h={ND * RECT.p + 1} fill={T.frame} />
      <Frame x={RECT.x - 1} y={RECT.y + s.q * RECT.p - 1} w={NE * RECT.p + 1} h={RECT.p + 1} fill={T.wireHot} />
      <PText x={RECT.x - 7} y={RECT.y + s.q * RECT.p - 2} text={show(S2S_TGT[s.q])} fill={T.wireHot} />
      <PText x={RECT.x + NE * RECT.p + 4} y={RECT.y - 4} text="_{0}" fill={T.textDim} />
      <PText x={RECT.x + NE * RECT.p + 4} y={RECT.y + (ND - 1) * RECT.p - 4} text={`_{${ND - 1}}`} fill={T.textDim} />
      <PText x={RECT.x + NE * RECT.p + 8} y={RECT.y + 58} text="→ 3 ffn" fill={T.textDim} />
      {[0, 8, 16, 24, 31].map((k) => <PText key={k} x={RECT.x + RECT.p * k} y={RECT.y + ND * RECT.p + 2} text={`_{${k}}`} fill={T.textDim} />)}

      <PText x={INX} y={248} text={`near flat: entropy ${fmt(S2S_CROSS_ENTROPY[s.layer][s.head])} of ${fmt(ln32)}`} fill={T.textDim} />
      <PText x={INX} y={258} text="train: in tgt[i], real tgt[i+1]" fill={T.textDim} />
      <PText x={INX} y={268} text={`sample: seed src[${NE - 1}] '${S2S_SRC[NE - 1]}', T ${temp} →`} fill={T.textDim} />
      <PText x={INX} y={278} text={[...S2S_SAMPLED].map(show).join("")} fill={T.text} />

      <PText x={16} y={TEXT_VIEW.h - 14} text={`1 bar = 32 channels   2+2 blocks, 2 heads, width 64, ffn 128, 65 chars   ${right}/${ND} right`} fill={T.textDim} />
      <PText x={TEXT_VIEW.w - 16} y={TEXT_VIEW.h - 14} text="heat ×8   bar = p(guess)" fill={T.textDim} anchor="end" />
    </g>
  );
}

// card: two mask shapes — the inherited causal triangle → the real cross rectangle (no mask)
const CARD_R = { x: 90, y: 6, c: 3 };   // 32 × 3 = 96 → 90..185; 31 × 3 = 93 → 6..98

function Seq2SeqCard({ theme: T }: { theme: Theme }) {
  const V = TEXT_CARD_VIEW.text_seq2seq;
  const R = CARD_R;
  const cells = useMemo(
    () => heatPaths(unNib(S2S_CROSS[S2S_DEFAULT.layer][S2S_DEFAULT.head], 0, S2S_CROSS_HI), ND, NE, CARD_R.x, CARD_R.y, CARD_R.c, CARD_R.c, CROSS_FULL),
    [],
  );
  const right = Array.from({ length: ND }, (_, i) => S2S_PRED[i] === S2S_TGT[i + 1]).filter(Boolean).length;
  const triY = R.y + ND * R.c - 2 * ND;   // bottom-aligned with the rectangle
  return (
    <g>
      <rect x={0} y={0} width={V.w} height={V.h} fill={T.ground} />
      {Array.from({ length: ND }, (_, i) => (
        <rect key={i} x={6} y={triY + 2 * i} width={2 * (i + 1)} height={2} fill={T.heat[3]} />
      ))}
      <PText x={76} y={R.y + 43} text="→" fill={T.textDim} />
      {cells.map((p, i) => (p ? <path key={i} d={p} fill={T.heat[i]} /> : null))}
      <Frame x={R.x - 1} y={R.y - 1} w={NE * R.c + 2} h={ND * R.c + 2} fill={T.wireHot} />
      <PText x={6} y={104} text="self: causal" fill={T.textDim} />
      <PText x={R.x} y={104} text="cross: no mask" fill={T.wireHot} />
      <PText x={6} y={114} text={`reads all of src · ${right}/${ND} right`} fill={T.textDim} />
    </g>
  );
}

/* ═══════════════════ dispatch + registry entries ═══════════════════ */
export function TextDiagram({ theme, name, still, keys }: { theme: Theme; name: TextName; still: boolean; keys?: MutableRefObject<KeyHandler | null> }) {
  return name === "text_token_classifier"
    ? <TokenClassifierDiagram theme={theme} still={still} keys={keys} />
    : <Seq2SeqDiagram theme={theme} still={still} keys={keys} />;
}
export function TextCard({ theme, name }: { theme: Theme; name: TextName }) {
  return name === "text_token_classifier" ? <TokenClassifierCard theme={theme} /> : <Seq2SeqCard theme={theme} />;
}

// Structurally the registry's DiagramDef (index.tsx keeps that interface private).
interface TextDef {
  view: { w: number; h: number };
  interactive?: boolean;
  keysHint?: string;
  title: string;
  truth: string;
  render: (p: { theme: Theme; t: number; onT?: (t: number) => void; still: boolean; keys: MutableRefObject<KeyHandler | null> }) => ReactNode;
  card: { view: { w: number; h: number }; render: (p: { theme: Theme; t: number }) => ReactNode };
  badge: string;
}

export const TEXT_DEFS: Record<string, TextDef> = {
  text_token_classifier: {
    view: TEXT_VIEW,
    interactive: true,
    keysHint: "↑/↓ pick a character, ←/→ pick a head",
    title: "text_token_classifier — every character reads the whole line, then gets its own label",
    truth: "All real: the local mini-text_token_classifier champion on 'Speak, speak.' — the char ids, p(vowel) at every position and the 13 flags (13/13 right; the exact cross-entropy is 0.0002, printed .00), and the self-attention of both blocks and both heads. There is no causal mask, so the square is full: right of the hot step (where the parent's mask begins) sit the later characters, and each head gives them 31–44% of a row's attention (a causal model: 0). Drawn from the code: 2 post-LN encoder blocks of 2 heads × 32 dims, FFN 64→256→64 (ReLU, no final norm), a 2-way head per position. Honest note: the label is a function of the character alone, so the architecture reads both ways while the task does not need it.",
    badge: "real champion attention",
    render: ({ theme, still, keys }) => <TextDiagram theme={theme} name="text_token_classifier" still={still} keys={keys} />,
    card: { view: TEXT_CARD_VIEW.text_token_classifier, render: ({ theme }) => <TextCard theme={theme} name="text_token_classifier" /> },
  },
  text_seq2seq: {
    view: TEXT_VIEW,
    interactive: true,
    keysHint: "↑/↓ pick a target char, ←/→ pick a head",
    title: "text_seq2seq — an encoder reads the source, a decoder writes on while looking at it",
    truth: "Real: the local mini-text_seq2seq champion on one 64-char training window — its 32 source chars, the 31 teacher-forced top-1 guesses for tgt[1..31] with their probabilities (12/31 right), p(true char) and CE 2.24 from the exported probabilities (the checkpoint's unrounded figure is 2.32), one continuation sampled at T 0.8 from the source's last char (no BOS token; greedy decoding loops), and the cross-attention of both decoder blocks and heads, drawn ×8 (a cell is full at .125; a perfectly flat row is 1/32). It is near-uniform — row entropy 3.07–3.19 nats against ln 32 = 3.47 — so there is no alignment and no diagonal; the squares beside the encoder mark the memory rows the selected char reads at twice the flat weight or more. Drawn from the code: two embedding tables and one shared position table, a 2-block encoder with no mask + final LayerNorm whose output is the memory, a 2-block decoder whose self-attention is causal (the triangle is that mask shape, not values) and whose cross-attention reads all 32 memory rows with no mask, FFN 64→128→64 ReLU. Source and target are the two halves of the same passage, not a translation pair.",
    badge: "real champion attention",
    render: ({ theme, still, keys }) => <TextDiagram theme={theme} name="text_seq2seq" still={still} keys={keys} />,
    card: { view: TEXT_CARD_VIEW.text_seq2seq, render: ({ theme }) => <TextCard theme={theme} name="text_seq2seq" /> },
  },
};
