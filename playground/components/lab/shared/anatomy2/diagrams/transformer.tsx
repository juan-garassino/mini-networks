"use client";

// Transformer (char-level GPT) anatomy, from src/mini_networks/models/
// transformer/{config,model}.py: token + learned position embeddings (d_model
// 128) → 4 post-LN blocks of causal multi-head attention (4 heads × 32 dims)
// + position-wise FFN (128→256→128) → LayerNorm → lm_head over the 65-char
// Tiny Shakespeare vocab. The residual stream is drawn as one thread per
// position; attention bars run across all rows (they mix positions), FFN bars
// are cut per row (each position alone).
//
// REAL (data/transformer-champion.ts, the local mini-transformer champion on
// the real line "Speak, speak."): the char ids, every layer × head attention
// pattern, the top-1 next-char prediction per position, p(true next char) and
// the cross-entropy. Nothing here is illustrative.
import { useEffect, useMemo, useState, type MutableRefObject } from "react";
import { TF_ATTN, TF_IDS, TF_LINE, TF_PRED, TF_PRED_P, TF_TRUE_P } from "../data/transformer-champion";
import { unNib } from "../math";
import { Bars, Diamond, Frame, PText, Wire } from "../prims";
import { heatIndex, type Theme } from "../themes";
import type { KeyHandler } from "./types";

export const TRANSFORMER_VIEW = { w: 560, h: 316 };
const N = TF_LINE.length; // 13
const ROW0 = 40, RH = 18;
const ry = (i: number) => ROW0 + i * RH;          // row top
const rc = (i: number) => ry(i) + 7;              // row centre
const LAYER_X = [88, 152, 216, 280];
const BW = 3, GAP = 1;
const ATTN_W = 4 * BW + 3 * GAP;   // 4 heads × 32 dims → 1 bar = 32 channels
const FFN_X = ATTN_W + 6;
const FFN_W = 8 * BW + 7 * GAP;    // d_ff 256 → 8 bars
const TOP = ROW0 - 2, BOT = ry(N - 1) + 16;
const HEAD_X = 344;                // final LayerNorm + lm_head
const OUT_X = 366;
const GRID = { x: 436, y: 40, c: 8 };
const MINI = { x: 424, y: 176, s: 1, gap: 4 };

const show = (ch: string) => (ch === " " ? "·" : ch === "\n" ? "↵" : ch);
const DEFAULT = { layer: 0, head: 2, q: 8 }; // L1 H3: the clearest real pattern (previous-char head, mean 0.59 one step back)

export function TransformerDiagram({ theme, still, keys }: { theme: Theme; still: boolean; keys?: MutableRefObject<KeyHandler | null> }) {
  const T = theme;
  const [sel, setSel] = useState(DEFAULT);
  const s = still ? DEFAULT : sel;
  const maps = useMemo(() => TF_ATTN.map((L) => L.map((h) => unNib(h, 0, 1))), []);
  const A = maps[s.layer][s.head];
  const w = (q: number, k: number) => (k > q ? 0 : A[q * N + k]);
  const ce = useMemo(() => -TF_TRUE_P.reduce((a, p) => a + Math.log(Math.max(1e-6, p)), 0) / TF_TRUE_P.length, []);

  useEffect(() => {
    if (!keys || still) return;
    keys.current = (e) => {
      if (e.key === "ArrowUp") { setSel((v) => ({ ...v, q: Math.max(0, v.q - 1) })); return true; }
      if (e.key === "ArrowDown") { setSel((v) => ({ ...v, q: Math.min(N - 1, v.q + 1) })); return true; }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const d = e.key === "ArrowRight" ? 1 : 15;
        setSel((v) => { const k = (v.layer * 4 + v.head + d) % 16; return { ...v, layer: Math.floor(k / 4), head: k % 4 }; });
        return true;
      }
      return false;
    };
    return () => { keys.current = null; };
  }, [keys, still]);

  const lx = LAYER_X[s.layer];
  const keyRows = Array.from({ length: s.q + 1 }, (_, k) => k).filter((k) => w(s.q, k) >= 0.06);
  const topKey = Math.min(...keyRows, s.q);
  const interactive = !still;

  return (
    <g>
      <rect x={0} y={0} width={TRANSFORMER_VIEW.w} height={TRANSFORMER_VIEW.h} fill={T.ground} />

      {/* headers */}
      <PText x={16} y={18} text="char" fill={T.textDim} />
      <PText x={54} y={18} text="embed" fill={T.textDim} />
      {LAYER_X.map((x, l) => <PText key={l} x={x} y={18} text={`block ${l + 1}`} fill={l === s.layer ? T.wireHot : T.textDim} />)}
      <PText x={OUT_X - 4} y={18} text="next char" fill={T.textDim} />
      <PText x={OUT_X - 2} y={28} text="guess" fill={T.textDim} />
      <PText x={OUT_X + 30} y={28} text="real" fill={T.textDim} />
      {LAYER_X.map((x, l) => (
        <g key={`h${l}`}>
          <PText x={x} y={28} text="attn" fill={T.textDim} />
          <PText x={x + FFN_X} y={28} text="ffn" fill={T.textDim} />
        </g>
      ))}

      {/* residual stream: one thread per position */}
      {Array.from({ length: N }, (_, i) => (
        <Wire key={`r${i}`} pts={[[72, rc(i)], [OUT_X - 4, rc(i)]]} fill={i === s.q ? T.wireHot : T.wire} />
      ))}

      {/* tokens → ids → embedding (4 cells = 128 dims) */}
      {Array.from({ length: N }, (_, i) => {
        const hot = i === s.q;
        return (
          <g key={`t${i}`} onClick={interactive ? () => setSel((v) => ({ ...v, q: i })) : undefined} style={interactive ? { cursor: "pointer" } : undefined}>
            <rect x={16} y={ry(i)} width={14} height={14} fill={T.panel} />
            <Frame x={16} y={ry(i)} w={14} h={14} fill={hot ? T.wireHot : T.frame} />
            <PText x={23} y={ry(i) + 4} text={show(TF_LINE[i])} fill={hot ? T.wireHot : T.text} anchor="middle" />
            <PText x={34} y={ry(i) + 5} text={`_{${TF_IDS[i]}}`} fill={T.textDim} />
            {[0, 1, 2, 3].map((c) => <rect key={c} x={54 + c * 4} y={ry(i) + 2} width={3} height={10} fill={hot ? (c === 0 ? T.accentHi : T.accent) : T.accentLo} />)}
          </g>
        );
      })}
      <PText x={54} y={BOT + 6} text="+pos" fill={T.textDim} />

      {/* the 4 blocks */}
      {LAYER_X.map((x, l) => (
        <g key={`b${l}`}>
          <Bars x={x} y={TOP} bars={4} h={BOT - TOP} theme={T} bw={BW} gap={GAP} dim={l !== s.layer} />
          {l === s.layer && <Frame x={x + (s.head * (BW + GAP)) - 1} y={TOP - 2} w={BW + 2} h={BOT - TOP + 4} fill={T.wireHot} />}
          {Array.from({ length: N }, (_, i) => (
            <Bars key={i} x={x + FFN_X} y={ry(i) + 1} bars={8} h={12} theme={T} bw={BW} gap={GAP} dim={i !== s.q} />
          ))}
        </g>
      ))}

      {/* where the selected head's query row reads from */}
      <Wire pts={[[lx - 4, rc(topKey)], [lx - 4, rc(s.q)]]} fill={T.wireHot} step={1} />
      {keyRows.map((k) => (
        <rect key={`k${k}`} x={lx - 6} y={rc(k) - 2} width={5} height={5} fill={T.heat[Math.max(3, heatIndex(w(s.q, k)))]} />
      ))}

      {/* final norm + lm_head (65-way) → next char vs truth */}
      <Bars x={HEAD_X} y={TOP} bars={2} h={BOT - TOP} theme={T} bw={BW} gap={GAP} dim />
      <PText x={HEAD_X - 2} y={28} text="lm" fill={T.textDim} />
      {Array.from({ length: N }, (_, i) => {
        const truth = i + 1 < N ? TF_LINE[i + 1] : null;
        const ok = truth !== null && TF_PRED[i] === truth;
        return (
          <g key={`o${i}`}>
            <rect x={OUT_X} y={ry(i)} width={14} height={14} fill={ok ? T.accent : T.panel} />
            <Frame x={OUT_X} y={ry(i)} w={14} h={14} fill={i === s.q ? T.wireHot : T.frame} />
            <PText x={OUT_X + 7} y={ry(i) + 4} text={show(TF_PRED[i])} fill={ok ? "#ffffff" : T.text} anchor="middle" />
            <rect x={OUT_X + 16} y={ry(i) + 6} width={Math.max(1, Math.round(TF_PRED_P[i] * 12))} height={2} fill={ok ? T.accentHi : T.textDim} />
            <PText x={OUT_X + 32} y={ry(i) + 4} text={truth === null ? "" : show(truth)} fill={T.textDim} />
          </g>
        );
      })}
      <Diamond cx={OUT_X + 10} cy={BOT + 14} theme={T} r={5} />
      <PText x={OUT_X + 20} y={BOT + 11} text={`CE ${ce.toFixed(2)}`} fill={T.loss} />

      {/* the selected head's full pattern: rows = query, cols = key; upper triangle = causal mask */}
      <PText x={GRID.x - 12} y={18} text={`block ${s.layer + 1}, head ${s.head + 1}`} fill={T.wireHot} />
      {Array.from({ length: N }, (_, i) => (
        <g key={`g${i}`}>
          <PText x={GRID.x - 7} y={GRID.y + i * GRID.c + 1} text={show(TF_LINE[i])} fill={i === s.q ? T.wireHot : T.textDim} anchor="middle" />
          <PText x={GRID.x + i * GRID.c + 4} y={GRID.y - 9} text={show(TF_LINE[i])} fill={T.textDim} anchor="middle" />
          {Array.from({ length: N }, (_, k) =>
            k > i ? (
              <rect key={k} x={GRID.x + k * GRID.c + 3} y={GRID.y + i * GRID.c + 3} width={1} height={1} fill={T.frame} />
            ) : (
              <rect key={k} x={GRID.x + k * GRID.c} y={GRID.y + i * GRID.c} width={GRID.c - 1} height={GRID.c - 1} fill={T.heat[heatIndex(w(i, k))]} />
            ),
          )}
        </g>
      ))}
      <Frame x={GRID.x - 1} y={GRID.y + s.q * GRID.c - 1} w={N * GRID.c + 1} h={GRID.c + 1} fill={T.wireHot} />
      <PText x={GRID.x} y={GRID.y + N * GRID.c + 4} text="· = masked future" fill={T.textDim} />

      {/* all 16 heads (real), pick one */}
      <PText x={MINI.x} y={MINI.y - 12} text="all 16 heads" fill={T.textDim} />
      {maps.map((L, l) => L.map((m, h) => {
        const x = MINI.x + h * (N + MINI.gap), y = MINI.y + l * (N + MINI.gap);
        const d: string[] = Array(8).fill("");
        for (let i = 0; i < N; i++) for (let k = 0; k <= i; k++) d[heatIndex(m[i * N + k])] += `M${x + k} ${y + i}h1v1h-1z`;
        const on = l === s.layer && h === s.head;
        return (
          <g key={`m${l}${h}`} onClick={interactive ? () => setSel((v) => ({ ...v, layer: l, head: h })) : undefined} style={interactive ? { cursor: "pointer" } : undefined}>
            <rect x={x} y={y} width={N} height={N} fill={T.panel} />
            {d.map((p, i) => (p ? <path key={i} d={p} fill={T.heat[i]} /> : null))}
            <Frame x={x - 2} y={y - 2} w={N + 4} h={N + 4} fill={on ? T.wireHot : T.ground} />
          </g>
        );
      }))}
      <PText x={MINI.x + 4 * (N + MINI.gap) + 2} y={MINI.y + 3} text="block 1" fill={T.textDim} />
      <PText x={MINI.x + 4 * (N + MINI.gap) + 2} y={MINI.y + 3 * (N + MINI.gap) + 3} text="block 4" fill={T.textDim} />

      <PText x={16} y={TRANSFORMER_VIEW.h - 14} text="1 bar = 32 channels   4 blocks, 4 heads, width 128, ffn 256, 65 chars" fill={T.textDim} />
      <PText x={TRANSFORMER_VIEW.w - 16} y={TRANSFORMER_VIEW.h - 14} text="bar = p(guess)" fill={T.textDim} anchor="end" />
    </g>
  );
}

// ————— card: the line, one real head's pattern, the model's guesses —————
export const TRANSFORMER_CARD_VIEW = { w: 190, h: 124 };

export function TransformerCard({ theme }: { theme: Theme }) {
  const T = theme;
  const A = useMemo(() => unNib(TF_ATTN[DEFAULT.layer][DEFAULT.head], 0, 1), []);
  const X0 = 30, CW = 12, RH2 = 6, Y0 = 16;
  return (
    <g>
      <rect x={0} y={0} width={TRANSFORMER_CARD_VIEW.w} height={TRANSFORMER_CARD_VIEW.h} fill={T.ground} />
      {Array.from({ length: N }, (_, i) => (
        <g key={i}>
          <PText x={X0 + i * CW + 5} y={4} text={show(TF_LINE[i])} fill={T.text} anchor="middle" />
          {Array.from({ length: N }, (_, k) =>
            k > i ? (
              <rect key={k} x={X0 + k * CW + 5} y={Y0 + i * RH2 + 2} width={1} height={1} fill={T.frame} />
            ) : (
              <rect key={k} x={X0 + k * CW} y={Y0 + i * RH2} width={CW - 1} height={RH2 - 1} fill={T.heat[heatIndex(A[i * N + k])]} />
            ),
          )}
        </g>
      ))}
      <PText x={2} y={Y0 + 2} text="each" fill={T.textDim} />
      <PText x={2} y={Y0 + 12} text="row" fill={T.textDim} />
      <PText x={2} y={Y0 + 22} text="reads" fill={T.textDim} />
      <PText x={2} y={Y0 + N * RH2 + 6} text="next" fill={T.textDim} />
      {Array.from({ length: N }, (_, i) => {
        const truth = i + 1 < N ? TF_LINE[i + 1] : null;
        const ok = truth !== null && TF_PRED[i] === truth;
        return (
          <g key={`g${i}`}>
            <rect x={X0 + i * CW} y={Y0 + N * RH2 + 3} width={CW - 1} height={13} fill={ok ? T.accent : T.panel} />
            <PText x={X0 + i * CW + 5} y={Y0 + N * RH2 + 6} text={show(TF_PRED[i])} fill={ok ? "#ffffff" : T.text} anchor="middle" />
          </g>
        );
      })}
      <PText x={X0} y={Y0 + N * RH2 + 21} text="block 1, head 3: looks one back" fill={T.textDim} />
    </g>
  );
}
