"use client";

// Audio family — one task (FSDD spoken digits, 8 kHz, 0.5 s), four input
// representations, drawn on ONE spine so the eye sees only the front-end move
// (src/mini_networks/models/audio/model.py, core/data/audio.py — the STFT /
// mel front-ends live in the TRAINER and have zero parameters):
//   audio_classifier      AudioCNN      wave [1,4000] → Conv1d k5 s2 ×3
//                         (32/64/128 ch, T 2000→1000→500) → AdaptiveAvgPool1d
//                         → Linear 128→10. Introduces waveform-conv.
//   audio_spectrogram     AudioSpecCNN  |STFT| (n_fft 256, hop 128 → 129 bins ×
//                         32 frames) → Conv2d 16/32/64 + MaxPool2 ×2 → avg →
//                         Linear 64→10. Introduces spectrogram-frontend.
//   audio_melspectrogram  AudioMelSpecCNN  fb[64,129] @ |STFT| → the SAME 2-D
//                         CNN (23,946 params in both). Introduces mel-frontend.
//   audio_transformer     AudioTransformer  |STFT| transposed → 32 tokens of
//                         129 dims → Linear 129→64 → 2 post-LN encoder blocks
//                         (4 heads × 16, FFN 256, no mask, no positions, no
//                         CLS) → mean over frames → Linear 64→10. Introduces
//                         nothing: the composition is the point.
//
// REAL (data/audio_*-champion.ts, local champions, CPU inference): the same 8
// FSDD TEST clips (digits 0–7, one speaker) in all four files — logits,
// softmax, argmax; AUD_WAVE (the waveform, mean-pooled 10× for display),
// AUD_FEAT (the real 128-d pooled vector), ASPEC_SPEC / ATF_FRAMES (the real
// log|STFT|, 129→64 rows, per-clip scaled), AMEL_MEL (the real log-mel with
// its 12 empty bands). The mel filterbank is exact maths transcribed from
// core/data/audio.py::mel_filterbank (its peaks equal AMEL_FB_PEAK_BIN; 12
// filters empty, 15 single-bin, real triangles (≥3 bins) from filter 34).
// NOT exported: conv kernels, 1-D / 2-D feature maps, attention weights —
// those are drawn as structure (Bars, threads) with a "not exported" note.
//
// Layout grid shared by all four (STYLE §3b): headers on rows 14/24; the wave
// strip and every 64×32 slab share top 86 and bottom 214 (centre CY 150);
// every caption and channel subscript sits on ROW_CAP 224; notes on 238…268;
// the 2-D back-end and the pooled sliver sit at the same x in S, M and T.
import { useEffect, useMemo, useState, type MutableRefObject, type ReactNode } from "react";
import { AUD_FEAT, AUD_LABELS, AUD_LOGITS, AUD_PRED, AUD_PROBS, AUD_WAVE } from "../data/audio_classifier-champion";
import { ASPEC_LABELS, ASPEC_LOGITS, ASPEC_PRED, ASPEC_PROBS, ASPEC_SPEC } from "../data/audio_spectrogram-champion";
import { AMEL_LABELS, AMEL_LOGITS, AMEL_MEL, AMEL_PRED, AMEL_PROBS } from "../data/audio_melspectrogram-champion";
import { ATF_FRAMES, ATF_LABELS, ATF_LOGITS, ATF_PRED, ATF_PROBS } from "../data/audio_transformer-champion";
import { unNib } from "../math";
import { Bars, Diamond, Frame, PText, Wire } from "../prims";
import { useTick } from "../tick";
import { heatIndex, type Theme } from "../themes";
import type { KeyHandler } from "./types";

export const AUDIO_VIEW = { w: 560, h: 316 };
export type AudioName = "audio_classifier" | "audio_spectrogram" | "audio_melspectrogram" | "audio_transformer";
export const AUDIO_CARD_VIEW: Record<AudioName, { w: number; h: number }> = {
  audio_classifier: { w: 190, h: 104 },
  audio_spectrogram: { w: 190, h: 104 },
  audio_melspectrogram: { w: 190, h: 104 },
  audio_transformer: { w: 190, h: 116 },
};

// ————— the shared grid —————
const CY = 150;                       // the spine
const TOP = 86;                       // wave strip + slabs: 64 rows × 2 px = 128 → 86..213
const SLAB_H = 128;
const ROW_H1 = 14, ROW_H2 = 24;       // headers
const ROW_CAP = 224;                  // every caption + channel subscript
const NOTE = (i: number) => 238 + 10 * i;
const PTR_Y = 82;                     // selected-frame pointers above strip / slabs
const X_FRONT = 68;                   // front-end region starts here
const X_FB = 144, X_MEL = 220;        // mel: filterbank + mel slab (12-px gaps)
const X_BE = [294, 307, 325] as const; // 2-D back-end blocks, 10-px gaps
const X_SLIVER = 353;                 // the pooled 64-d vector (S, M, T)
const X_LOGIT = 360;
const N_CLIPS = 8;
const N_FRAMES = 32;
const DEFAULT = { clip: 7, frame: 16 }; // clip 7: raw-wave says 4, every spectral front-end says 7
const Z0 = 70;                          // classifier zoom: AUD_WAVE points 70..87 (strip px 23–24)
const DEAD_MELS = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 13, 14] as const; // empty filters (checked against melFilterbank)

/**
 * AMEL_MEL for display: the export min-maxes each clip over all 64 rows, so the
 * 12 empty rows (log 1e-6) pin the floor and the live rows sit in nibbles 8–f.
 * Re-stretch the live rows over their own nonzero range; the dead rows (and
 * true zeros) stay 0. Display-only — the footer says "live rows rescaled".
 */
function melView(s: string, dead: readonly number[] = DEAD_MELS, cols = N_FRAMES): Float32Array {
  const isDead = new Set(dead);
  let lo = 15, hi = 0;
  for (let r = 0; r < 64; r++) {
    if (isDead.has(r)) continue;
    for (let c = 0; c < cols; c++) {
      const n = parseInt(s[r * cols + c], 16);
      if (n > 0) { lo = Math.min(lo, n); hi = Math.max(hi, n); }
    }
  }
  const out = new Float32Array(64 * cols);
  for (let r = 0; r < 64; r++) {
    if (isDead.has(r)) continue;
    for (let c = 0; c < cols; c++) {
      const n = parseInt(s[r * cols + c], 16);
      out[r * cols + c] = n === 0 ? 0 : Math.min(1, (n - lo + 1) / (hi - lo + 1));
    }
  }
  return out;
}

type Pt = [number, number];
interface Outputs { logits: readonly (readonly number[])[]; probs: readonly (readonly number[])[]; pred: readonly number[]; labels: readonly number[] }
const OUT: Record<AudioName, Outputs> = {
  audio_classifier: { logits: AUD_LOGITS, probs: AUD_PROBS, pred: AUD_PRED, labels: AUD_LABELS },
  audio_spectrogram: { logits: ASPEC_LOGITS, probs: ASPEC_PROBS, pred: ASPEC_PRED, labels: ASPEC_LABELS },
  audio_melspectrogram: { logits: AMEL_LOGITS, probs: AMEL_PROBS, pred: AMEL_PRED, labels: AMEL_LABELS },
  audio_transformer: { logits: ATF_LOGITS, probs: ATF_PROBS, pred: ATF_PRED, labels: ATF_LABELS },
};

// ————— exact maths: core/data/audio.py::mel_filterbank(n_fft, n_mels, sample_rate=16000, f_min=0, f_max=8000) —————
// m_pts = linspace(mel(f_min), mel(f_max), n_mels+2); bins = floor((n_fft+1)·hz/sample_rate);
// a filter whose bins collide is skipped (stays all-zero) — 12 of the 64 at 8 kHz data / 16 kHz bank.
export function melFilterbank(nFft = 256, nMels = 64, sampleRate = 16000, fMin = 0, fMax = 8000): Float32Array[] {
  const hzToMel = (hz: number) => 2595 * Math.log10(1 + hz / 700);
  const melToHz = (m: number) => 700 * (10 ** (m / 2595) - 1);
  const nFreqs = nFft / 2 + 1;
  const mMin = hzToMel(fMin), mMax = hzToMel(fMax);
  const bins: number[] = [];
  for (let i = 0; i < nMels + 2; i++) bins.push(Math.floor(((nFft + 1) * melToHz(mMin + ((mMax - mMin) * i) / (nMels + 1))) / sampleRate));
  const fb: Float32Array[] = [];
  for (let m = 1; m <= nMels; m++) {
    const row = new Float32Array(nFreqs);
    const a = bins[m - 1], b = bins[m], c = bins[m + 1];
    if (a !== b && b !== c) {
      for (let k = a; k < b; k++) row[k] = (k - a) / (b - a);
      for (let k = b; k < c; k++) row[k] = (c - k) / (c - b);
    }
    fb.push(row);
  }
  return fb;
}

/** rows × cols heat map (values 0..1, row-major), `px` per cell; row 0 drawn at the BOTTOM when `flip` (frequency axis). */
function Heat({ x, y, data, rows, cols, px, theme, flip = true }: {
  x: number; y: number; data: ArrayLike<number>; rows: number; cols: number; px: number; theme: Theme; flip?: boolean;
}) {
  const ds: string[] = Array(8).fill("");
  for (let r = 0; r < rows; r++) {
    const yy = y + (flip ? rows - 1 - r : r) * px;
    let c = 0;
    while (c < cols) {
      const lvl = heatIndex(data[r * cols + c]);
      let e = c + 1;
      while (e < cols && heatIndex(data[r * cols + e]) === lvl) e++;
      ds[lvl] += `M${x + c * px} ${yy}h${(e - c) * px}v${px}h${-(e - c) * px}z`;
      c = e;
    }
  }
  return <g>{ds.map((d, i) => (d ? <path key={i} d={d} fill={theme.heat[i]} /> : null))}</g>;
}

/** 64 rows → 16 (mean of 4), same 32 columns — for the 3-px card cells. */
function poolRows4(spec: Float32Array, cols = N_FRAMES): Float32Array {
  const out = new Float32Array(16 * cols);
  for (let r = 0; r < 16; r++) for (let c = 0; c < cols; c++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += spec[(4 * r + k) * cols + c];
    out[r * cols + c] = s / 4;
  }
  return out;
}

/** The waveform as one min…max run per pixel column (ramp[6], a data colour). */
function waveRuns(wave: Float32Array, x: number, cy: number, w: number, amp: number): string {
  let d = "";
  const per = wave.length / w;
  for (let c = 0; c < w; c++) {
    const a = Math.floor(c * per), b = Math.max(a + 1, Math.floor((c + 1) * per));
    let lo = 1, hi = -1;
    for (let i = a; i < b; i++) { lo = Math.min(lo, wave[i]); hi = Math.max(hi, wave[i]); }
    const y1 = cy - Math.round(hi * amp), y2 = cy - Math.round(lo * amp);
    d += `M${x + c} ${y1}h1v${y2 - y1 + 1}h-1z`;
  }
  return d;
}

const fmt = (v: number) => (v < 0.005 ? "<.01" : v.toFixed(2).replace(/^0/, ""));

/* ————————————————————— shared family pieces (full view) ————————————————————— */

/** The input: 40×128 strip at x 16, sharing top and bottom with every slab. */
function WaveStrip({ theme: T, wave, clip, frame }: { theme: Theme; wave: Float32Array; clip: number; frame: number | null }) {
  return (
    <g>
      <PText x={16} y={ROW_H1} text="wave" fill={T.textDim} />
      <PText x={16} y={ROW_H2} text="8 kHz" fill={T.textDim} />
      {T.shadow && <rect x={18} y={TOP + 2} width={40} height={SLAB_H} fill={T.shadow} />}
      <rect x={16} y={TOP} width={40} height={SLAB_H} fill={T.panel} />
      <Frame x={15} y={TOP - 1} w={42} h={SLAB_H + 2} fill={T.frame} />
      <path d={waveRuns(wave, 16, CY, 40, 60)} fill={T.ramp[6]} />
      <PText x={16} y={ROW_CAP} text={`clip ${clip}`} fill={T.textDim} />
      <PText x={16} y={ROW_CAP + 10} text="0.5 s" fill={T.textDim} />
      {frame !== null && <PText x={16} y={ROW_CAP + 20} text={`frame ${frame}`} fill={T.wireHot} />}
    </g>
  );
}

/** classifier.tsx's 10-row logits list, the CE Diamond at (520,220) and the 8-clip hit strip at x 504. */
function Readout({ theme: T, name, clip }: { theme: Theme; name: AudioName; clip: number }) {
  const o = OUT[name];
  const probs = o.probs[clip], logits = o.logits[clip], label = o.labels[clip];
  const pred = o.pred[clip];
  const ce = -Math.log(Math.max(1e-12, probs[label]));
  const hits = o.pred.reduce((a, p, i) => a + (p === o.labels[i] ? 1 : 0), 0);
  const ly = 44 + label * 24 + 3;
  // label row → a vertical at x 498 (between the logit numbers and the clip strip) → the Diamond's left tip
  const route: Pt[] = [[494, ly], [498, ly], [498, 220], [511, 220]];
  return (
    <g>
      <PText x={X_LOGIT} y={ROW_H1} text="10 logits" fill={T.textDim} />
      <PText x={X_LOGIT} y={ROW_H2} text="held-out clips, same speakers" fill={T.textDim} />
      {probs.map((p, k) => {
        const y = 44 + k * 24;
        const hot = k === pred;
        const bw = Math.max(1, Math.round(p * 90));
        return (
          <g key={k}>
            <PText x={X_LOGIT} y={y} text={String(k)} fill={hot ? T.wireHot : T.textDim} />
            <rect x={X_LOGIT + 10} y={y + 1} width={92} height={5} fill={T.panel} />
            <rect x={X_LOGIT + 10} y={y + 1} width={bw} height={5} fill={hot ? T.accentHi : T.accent} />
            <PText x={X_LOGIT + 108} y={y} text={logits[k].toFixed(1)} fill={hot ? T.wireHot : T.textDim} />
          </g>
        );
      })}
      <PText x={X_LOGIT + 10} y={286} text="bar = softmax, number = logit" fill={T.textDim} />

      <Wire pts={route} fill={T.wire} />
      <Diamond cx={520} cy={220} theme={T} />
      <PText x={521} y={230} text="CE" fill={T.loss} anchor="middle" />
      <PText x={521} y={240} text={fmt(ce)} fill={T.loss} anchor="middle" />
      <PText x={521} y={250} text={`label ${label}`} fill={T.textDim} anchor="middle" />

      {/* the 8 test clips: label → guess; solid = right, a loss frame + the wrong digit = miss */}
      <PText x={504} y={ROW_H1} text="8 clips" fill={T.textDim} />
      {o.labels.map((lab, i) => {
        const y = 40 + i * 18;
        const ok = o.pred[i] === lab;
        return (
          <g key={i}>
            <PText x={504} y={y + 2} text={String(lab)} fill={i === clip ? T.wireHot : T.text} />
            {ok ? (
              <rect x={518} y={y} width={10} height={10} fill={T.accent} />
            ) : (
              <g>
                <Frame x={518} y={y} w={10} h={10} fill={T.loss} />
                <PText x={523} y={y + 2} text={String(o.pred[i])} fill={T.loss} anchor="middle" />
              </g>
            )}
          </g>
        );
      })}
      <PText x={504} y={186} text={`${hits}/${N_CLIPS}`} fill={T.text} />
      <PText x={504} y={196} text="of ~600" fill={T.textDim} />
    </g>
  );
}

/** The 2-D CNN (AudioSpecCNN, reused verbatim by audio_melspectrogram): Bars 16/32/64 whose heights are the frequency rows, 8-px gaps, GAP sliver. */
function BackEnd2D({ theme: T, rows }: { theme: Theme; rows: readonly [number, number, number] }) {
  const top = (h: number) => CY - Math.floor(h / 2);
  const counts = [1, 2, 4] as const;
  const right = (i: number) => X_BE[i] + counts[i] * 5 - 2; // last bar pixel + 1
  return (
    <g>
      <PText x={X_BE[0]} y={ROW_H1} text="conv ×3" fill={T.textDim} />
      <PText x={X_BE[0]} y={ROW_H2} text="pool ×2" fill={T.textDim} />
      {counts.map((n, i) => (
        <g key={i}>
          <Bars x={X_BE[i]} y={top(rows[i])} bars={n} h={rows[i]} theme={T} bw={3} gap={2} />
          <PText x={X_BE[i]} y={ROW_CAP} text={`_{${16 * n}}`} fill={T.textDim} />
          <Wire pts={[[right(i) + 1, CY], [(i < 2 ? X_BE[i + 1] : X_SLIVER) - 2, CY]]} fill={T.accentLo} step={1} />
        </g>
      ))}
    </g>
  );
}

/** The pooled 64-d vector as a 1-px sliver → the logits. */
function Sliver({ theme: T }: { theme: Theme }) {
  return (
    <g>
      <rect x={X_SLIVER} y={CY - 32} width={1} height={64} fill={T.accentHi} />
      <Wire pts={[[X_SLIVER + 2, CY], [X_LOGIT - 3, CY]]} fill={T.accentLo} step={1} />
      <PText x={X_SLIVER - 2} y={ROW_CAP} text="_{64}" fill={T.textDim} />
    </g>
  );
}

/** A 64×32 slab (rows = frequency, low at the bottom) with its frame: hot = x−2/y−2 (+4), plain = x−1 like a Thumb. */
function Slab({ theme: T, x, data, hot = false }: { theme: Theme; x: number; data: ArrayLike<number>; hot?: boolean }) {
  return (
    <g>
      {T.shadow && <rect x={x + 2} y={TOP + 2} width={64} height={SLAB_H} fill={T.shadow} />}
      <Heat x={x} y={TOP} data={data} rows={64} cols={N_FRAMES} px={2} theme={T} />
      {hot ? <Frame x={x - 2} y={TOP - 2} w={68} h={SLAB_H + 4} fill={T.wireHot} /> : <Frame x={x - 1} y={TOP - 1} w={66} h={SLAB_H + 2} fill={T.frame} />}
    </g>
  );
}

/* ————————————————————— the family component ————————————————————— */

export function AudioDiagram({ theme, name, still, keys: keysRef }: {
  theme: Theme; name: AudioName; still: boolean; keys?: MutableRefObject<KeyHandler | null>;
}) {
  const T = theme;
  const [sel, setSel] = useState(DEFAULT);
  const s = still ? DEFAULT : sel;
  // one moving thing per drawing, on the hot path: the classifier's kernel steps by its stride, the rest march a frame column
  const frame = useTick(3, 3, still);
  // S and M: the shown STFT frame steps one hop per tick (window on the wave + column on the slab move together)
  const f = name === "audio_spectrogram" || name === "audio_melspectrogram" ? Math.min(N_FRAMES - 1, s.frame + frame) : s.frame;

  useEffect(() => {
    if (!keysRef || still) return;
    keysRef.current = (e) => {
      if (e.key === "ArrowLeft") { setSel((v) => ({ ...v, clip: (v.clip + N_CLIPS - 1) % N_CLIPS })); return true; }
      if (e.key === "ArrowRight") { setSel((v) => ({ ...v, clip: (v.clip + 1) % N_CLIPS })); return true; }
      if (name !== "audio_classifier" && e.key === "ArrowUp") { setSel((v) => ({ ...v, frame: Math.max(0, v.frame - 1) })); return true; }
      if (name !== "audio_classifier" && e.key === "ArrowDown") { setSel((v) => ({ ...v, frame: Math.min(N_FRAMES - 1, v.frame + 1) })); return true; }
      return false;
    };
    return () => { keysRef.current = null; };
  }, [keysRef, still, name]);

  const d = useMemo(() => ({
    wave: unNib(AUD_WAVE[s.clip]),
    feat: unNib(AUD_FEAT[s.clip], 0, 1),
    // ATF_FRAMES is string-identical to ASPEC_SPEC (same STFT); each model reads its own export
    spec: unNib((name === "audio_transformer" ? ATF_FRAMES : ASPEC_SPEC)[s.clip], 0, 1),
    mel: melView(AMEL_MEL[s.clip]),
  }), [s.clip, name]);
  // fb[64,129] pooled 4× along the bins for display: 32 columns (bin 128 dropped), cell = mean of its 4 bins ×2 (clipped),
  // so a wide triangle shows lighter shoulders and a one-bin filter a mid cell
  const fbView = useMemo(() => {
    const fb = melFilterbank();
    const out = new Float32Array(64 * 32);
    for (let m = 0; m < 64; m++) for (let c = 0; c < 32; c++) out[m * 32 + c] = Math.min(1, (fb[m][4 * c] + fb[m][4 * c + 1] + fb[m][4 * c + 2] + fb[m][4 * c + 3]) / 2);
    const dead: number[] = [];
    for (let m = 0; m < 64; m++) if (!fb[m].some((v) => v > 0)) dead.push(m);
    return { out, dead };
  }, []);

  const colX = (x: number) => x + 2 * f; // left pixel of frame f's column in a slab at x

  let body: ReactNode;
  let footer: string;
  if (name === "audio_classifier") {
    footer = "wave: 400 of 4000, scaled · 1 bar = 16 ch, height = steps ÷ 20 · feat: 8 per row, blank = 0";
    const B = [216, 234, 262] as const; // 2/4/8 bars, 10-px gaps
    // the zoom: 18 trace points from Z0 (the loudest stretch of clip 7), 6-px cells centred on the spine
    const Z = { x: 72, cell: 6, amp: 22, top: CY - 22, bot: CY + 22, out: CY + 30 };
    const zoom = Array.from(d.wave.subarray(Z0, Z0 + 18));
    const zsx = 16 + Math.floor(Z0 / 10); // strip column: 400 points over 40 px
    const k0 = 4 + 2 * frame;             // kernel's first tap (cell); slides by the stride
    const kx = Z.x + k0 * Z.cell - 2;
    const gx = Z.x + (k0 + 2) * Z.cell - 3;
    const ox = Z.x + (k0 + 2) * Z.cell;   // the output cell under the kernel's centre tap
    body = (
      <g>
        <PText x={X_FRONT} y={ROW_H1} text="conv1d k5 s2" fill={T.textDim} />
        <PText x={X_FRONT} y={ROW_H2} text="weights not exported" fill={T.textDim} />
        <PText x={B[0]} y={ROW_H1} text="×3, ReLU, no BN" fill={T.textDim} />
        <PText x={316} y={ROW_H1} text="avg" fill={T.textDim} />
        <PText x={316} y={ROW_H2} text="→128" fill={T.textDim} />
        {/* where the zoom sits on the strip (hot ticks above + below), and the input feeding it */}
        <rect x={zsx} y={TOP - 4} width={2} height={2} fill={T.wireHot} />
        <rect x={zsx} y={TOP + SLAB_H + 2} width={2} height={2} fill={T.wireHot} />
        <Wire pts={[[59, CY], [Z.x - 4, CY]]} fill={T.wire} />
        {/* the zoom: 18 consecutive points of the real trace, one 6-px cell each, stems from the centre line */}
        {zoom.map((v, i) => {
          const x = Z.x + i * Z.cell;
          const h = Math.max(1, Math.round(Math.abs(v) * Z.amp));
          return (
            <g key={i}>
              <rect x={x} y={CY - Z.amp} width={Z.cell - 1} height={2 * Z.amp + 1} fill={T.panel} />
              <rect x={x + 1} y={v >= 0 ? CY - h : CY} width={3} height={h + 1} fill={T.ramp[6]} />
            </g>
          );
        })}
        {/* the next position: 2 cells on (stride 2) — structure, so plain wire, not hot */}
        <Wire pts={[[gx, Z.top - 5], [gx + 5 * Z.cell + 3, Z.top - 5], [gx + 5 * Z.cell + 3, Z.bot + 5], [gx, Z.bot + 5], [gx, Z.top - 5]]} fill={T.wire} />
        {/* the kernel: 5 taps — what this model introduces, the one hot Frame */}
        <Frame x={kx} y={Z.top - 2} w={5 * Z.cell + 3} h={Z.bot - Z.top + 5} fill={T.wireHot} />
        {/* outputs: one per 2 input cells (stride 2) — the current one lit, the next one after it */}
        {zoom.map((_, i) => (i % 2 === 0 ? (
          <rect key={`o${i}`} x={Z.x + i * Z.cell} y={Z.out} width={4} height={4} fill={i === k0 + 2 ? T.accent : T.accentLo} />
        ) : null))}
        <Wire pts={[[ox + 2, Z.out + 6], [ox + 2, Z.out + 9], [204, Z.out + 9], [204, CY], [B[0] - 3, CY]]} fill={T.wireHot} step={2} phase={frame} />
        {/* the whole clip on a ruler (112 px = 4000 samples) and, in loss red, the 1 px one output step sees */}
        <rect x={Z.x} y={210} width={112} height={1} fill={T.textDim} />
        <rect x={Z.x + 111} y={207} width={1} height={3} fill={T.textDim} />
        <rect x={Z.x} y={204} width={1} height={7} fill={T.loss} />
        <PText x={Z.x} y={ROW_CAP} text="the clip: 4000 samples" fill={T.textDim} />
        {/* three conv stages: bars = channels (1 bar = 16), height = time steps ÷ 20 */}
        <Bars x={B[0]} y={CY - 50} bars={2} h={100} theme={T} bw={3} gap={2} />
        <Wire pts={[[B[0] + 9, CY], [B[1] - 2, CY]]} fill={T.accentLo} step={1} />
        <Bars x={B[1]} y={CY - 25} bars={4} h={50} theme={T} bw={3} gap={2} />
        <Wire pts={[[B[1] + 19, CY], [B[2] - 2, CY]]} fill={T.accentLo} step={1} />
        <Bars x={B[2]} y={CY - 12} bars={8} h={25} theme={T} bw={3} gap={2} />
        <Wire pts={[[B[2] + 39, CY], [313, CY]]} fill={T.accentLo} step={1} />
        <PText x={B[0]} y={ROW_CAP} text="_{32}" fill={T.textDim} />
        <PText x={B[1]} y={ROW_CAP} text="_{64}" fill={T.textDim} />
        <PText x={B[2]} y={ROW_CAP} text="_{128}" fill={T.textDim} />
        {/* the real 128-d pooled vector (AUD_FEAT), 8 per row */}
        <Frame x={315} y={125} w={26} h={50} fill={T.frame} />
        <Heat x={316} y={126} data={d.feat} rows={16} cols={8} px={3} theme={T} flip={false} />
        <Wire pts={[[343, CY], [X_LOGIT - 3, CY]]} fill={T.accentLo} step={1} />
        {/* honesty: receptive field 29 samples = 3.6 ms, then a global average over 500 steps */}
        <PText x={X_FRONT} y={NOTE(0)} text="zoom: pooled points stand in for samples" fill={T.textDim} />
        <PText x={X_FRONT} y={NOTE(1)} text="kernel: 5 taps; next step 2 samples on" fill={T.textDim} />
        <PText x={X_FRONT} y={NOTE(2)} text="red px: one step sees 29 samples = 3.6 ms" fill={T.loss} />
        <PText x={X_FRONT} y={NOTE(3)} text="then averages all 500 steps: when is lost" fill={T.loss} />
      </g>
    );
  } else if (name === "audio_spectrogram") {
    footer = "spec: log, per-clip scaled, low Hz at bottom · 1 bar = 16 ch, height = freq rows";
    const wx = Math.max(16, Math.min(53, 16 + Math.round((f * 128 - 128) / 100))); // frame f's 256-sample window on the 40-px strip
    body = (
      <g>
        <PText x={X_FRONT} y={ROW_H1} text="STFT mag 129×32" fill={T.textDim} />
        <PText x={X_FRONT} y={ROW_H2} text="0 params" fill={T.textDim} />
        {/* wave → |STFT|: the frontend this model introduces — data moving, not a layer */}
        <rect x={wx} y={PTR_Y} width={3} height={2} fill={T.wireHot} />
        <rect x={wx} y={216} width={3} height={2} fill={T.wireHot} />
        <Wire pts={[[59, CY], [63, CY]]} fill={T.wireHot} step={3} phase={frame} />
        <Slab theme={T} x={X_FRONT} data={d.spec} hot />
        <rect x={colX(X_FRONT)} y={PTR_Y} width={2} height={2} fill={T.wireHot} />
        <PText x={136} y={TOP} text="4 kHz" fill={T.textDim} />
        <PText x={136} y={TOP + SLAB_H - 7} text="0" fill={T.textDim} />
        {/* time ruler: 64 px = 0.5 s, a tick per frame; the window = 2 hops */}
        {Array.from({ length: 33 }, (_, i) => <rect key={i} x={X_FRONT + 2 * i} y={217} width={1} height={2} fill={T.textDim} />)}
        <rect x={X_FRONT} y={219} width={65} height={1} fill={T.textDim} />
        <rect x={Math.max(X_FRONT, colX(X_FRONT) - 1)} y={221} width={4} height={1} fill={T.wireHot} />
        <PText x={X_FRONT} y={ROW_CAP} text="32 frames × 16 ms" fill={T.textDim} />
        <PText x={X_FRONT} y={NOTE(0)} text="window 256, hop 128: 50% overlap" fill={T.textDim} />
        <PText x={X_FRONT} y={NOTE(1)} text="129 bins × 31.25 Hz, 0-4 kHz" fill={T.textDim} />
        <PText x={X_FRONT} y={NOTE(2)} text="shown: log, scaled, 64 of 129 rows" fill={T.textDim} />
        {/* what actually crosses the gap into the CNN (the picture is a display transform) */}
        <PText x={150} y={CY - 22} text="net input:" fill={T.textDim} />
        <PText x={150} y={CY - 12} text="linear, 129 rows" fill={T.textDim} />
        {/* inherited 2-D CNN; the 129-row bar is drawn 128 px so it shares top + bottom with the slab */}
        <Wire pts={[[136, CY], [X_BE[0] - 3, CY]]} fill={T.wire} />
        <BackEnd2D theme={T} rows={[128, 64, 32]} />
        <Sliver theme={T} />
      </g>
    );
  } else if (name === "audio_melspectrogram") {
    footer = "mel: log, live rows rescaled, low at bottom · fb: 4 bins/cell, mean ×2 · 1 bar = 16 ch, h = rows";
    body = (
      <g>
        <PText x={X_FRONT} y={ROW_H1} text="STFT mag" fill={T.textDim} />
        <PText x={X_FRONT} y={ROW_H2} text="inherited" fill={T.textDim} />
        <PText x={X_FB} y={ROW_H1} text="fb 64×129" fill={T.textDim} />
        <PText x={X_FB} y={ROW_H2} text="0 params" fill={T.textDim} />
        <PText x={X_MEL} y={ROW_H1} text="mel 64×32" fill={T.textDim} />
        <PText x={X_MEL} y={ROW_H2} text="64 bands" fill={T.textDim} />
        {/* inherited |STFT| */}
        <Wire pts={[[59, CY], [64, CY]]} fill={T.wire} />
        <Slab theme={T} x={X_FRONT} data={d.spec} />
        <rect x={colX(X_FRONT)} y={PTR_Y} width={2} height={2} fill={T.wireHot} />
        {/* the mel-frontend this model introduces: fb[64,129] @ |STFT| — exact triangles, 12 empty rows ticked */}
        <Wire pts={[[135, CY], [139, CY]]} fill={T.wireHot} step={3} phase={frame} />
        <Slab theme={T} x={X_FB} data={fbView.out} hot />
        {fbView.dead.map((m) => <rect key={m} x={X_FB - 6} y={TOP + (63 - m) * 2} width={2} height={2} fill={T.loss} />)}
        <Wire pts={[[211, CY], [215, CY]]} fill={T.wireHot} step={3} phase={frame} />
        <Slab theme={T} x={X_MEL} data={d.mel} />
        <rect x={colX(X_MEL)} y={PTR_Y} width={2} height={2} fill={T.wireHot} />
        <PText x={X_FB} y={NOTE(0)} text="12 of 64 mel bands empty" fill={T.loss} />
        <PText x={X_FB} y={NOTE(1)} text="bank assumes 16 kHz, FSDD is 8 kHz" fill={T.loss} />
        <PText x={X_FB} y={NOTE(2)} text="52 live, 15 one-bin, real triangles from 34" fill={T.textDim} />
        <PText x={X_FB} y={NOTE(3)} text="same CNN as spectrogram: 23,946 params" fill={T.textDim} />
        {/* the SAME 2-D CNN, at the same x; heights follow the 64 mel rows */}
        <Wire pts={[[287, CY], [X_BE[0] - 3, CY]]} fill={T.wire} />
        <BackEnd2D theme={T} rows={[64, 32, 16]} />
        <Sliver theme={T} />
      </g>
    );
  } else {
    footer = "spec: log, scaled · 1 bar = 16 ch · 2 post-LN blocks, 4 heads × 16, width 64, ffn 256";
    const ry = (i: number) => 62 + i * 5;
    const rc = (i: number) => ry(i) + 2;
    const E = 166, A = [208, 268] as const, FX = [229, 289] as const;
    const hx = colX(X_FRONT);
    body = (
      <g>
        <PText x={X_FRONT} y={ROW_H1} text="STFT mag 129×32" fill={T.textDim} />
        <PText x={X_FRONT} y={ROW_H2} text="inherited" fill={T.textDim} />
        <PText x={E} y={ROW_H1} text="tokens" fill={T.textDim} />
        <PText x={E} y={ROW_H2} text="→64" fill={T.textDim} />
        {A.map((x, b) => (
          <g key={x}>
            <PText x={x} y={ROW_H1} text={`block ${b + 1}`} fill={T.textDim} />
            <PText x={x} y={ROW_H2} text="attn" fill={T.textDim} />
            <PText x={FX[b]} y={ROW_H2} text="ffn" fill={T.textDim} />
          </g>
        ))}
        
        {/* inherited |STFT| */}
        <Wire pts={[[59, CY], [64, CY]]} fill={T.wire} />
        <Slab theme={T} x={X_FRONT} data={d.spec} />
        <PText x={X_FRONT} y={ROW_CAP} text="each column → one token" fill={T.textDim} />
        {/* the hinge: column f of the spectrogram becomes token row f */}
        <rect x={hx} y={PTR_Y} width={2} height={2} fill={T.wireHot} />
        <Wire pts={[[hx, 79], [hx, 50], [160, 50], [160, rc(f)], [162, rc(f)]]} fill={T.wireHot} step={3} phase={frame} />
        {/* 32 residual threads (one per frame) → the mean bus */}
        {Array.from({ length: N_FRAMES }, (_, i) => (
          <Wire key={`r${i}`} pts={[[E + 16, rc(i)], [343, rc(i)]]} fill={i === f ? T.wireHot : T.wire} />
        ))}
        {/* embed 129→64 (4 cells = 64 dims) per frame */}
        {Array.from({ length: N_FRAMES }, (_, i) => (
          <g key={`e${i}`}>
            {[0, 1, 2, 3].map((c) => (
              <rect key={c} x={E + c * 4} y={i === f ? ry(i) : ry(i) + 1} width={3} height={i === f ? 4 : 2} fill={i === f ? (c === 0 ? T.accentHi : T.accent) : T.accentLo} />
            ))}
          </g>
        ))}
        {/* 2 post-LN blocks: attn 4 heads × 16 across all rows (full, no mask), ffn 256 per row */}
        {[0, 1].map((b) => (
          <g key={`b${b}`}>
            <Bars x={A[b]} y={61} bars={4} h={161} theme={T} bw={3} gap={1} />
            {Array.from({ length: N_FRAMES }, (_, i) => (
              <Bars key={i} x={FX[b]} y={i === f ? ry(i) : ry(i) + 1} bars={16} h={i === f ? 4 : 2} theme={T} bw={1} gap={1} dim={i !== f} />
            ))}
          </g>
        ))}
        {/* the selected token row reads first in both themes: other rows are 2 px (mass, not hue, recedes), and a
            1-px ground gap above + below the Frame cuts it clear of the attention bars it crosses */}
        <rect x={E - 1} y={ry(f) - 2} width={FX[1] + 31 - E + 2} height={1} fill={T.ground} />
        <rect x={E - 1} y={ry(f) + 5} width={FX[1] + 31 - E + 2} height={1} fill={T.ground} />
        <Frame x={E - 1} y={ry(f) - 1} w={FX[1] + 31 - E + 2} h={6} fill={T.wireHot} />
        {/* mean over the 32 frames → 64 → logits */}
        <Wire pts={[[346, rc(0)], [346, rc(N_FRAMES - 1)]]} fill={T.wire} />
        <Wire pts={[[347, CY], [X_SLIVER - 2, CY]]} fill={T.wire} step={1} />
        {/* "mean" ends at the bus it names; the sliver's _{64} follows on the same caption row */}
        <PText x={346} y={ROW_CAP} text="mean" fill={T.textDim} anchor="end" />
        <Sliver theme={T} />
        <PText x={X_FRONT} y={NOTE(0)} text="attention weights not exported" fill={T.textDim} />
        <PText x={X_FRONT} y={NOTE(1)} text="no mask, no +pos, no CLS" fill={T.textDim} />
        <PText x={X_FRONT} y={NOTE(2)} text="order-blind: mean pool, no positions" fill={T.loss} />
        <PText x={X_FRONT} y={NOTE(3)} text="shuffle the frames, same answer" fill={T.loss} />
      </g>
    );
  }

  return (
    <g>
      <rect x={0} y={0} width={AUDIO_VIEW.w} height={AUDIO_VIEW.h} fill={T.ground} />
      <WaveStrip theme={T} wave={d.wave} clip={s.clip} frame={name === "audio_classifier" ? null : f} />
      {body}
      <Readout theme={T} name={name} clip={s.clip} />
      <PText x={16} y={AUDIO_VIEW.h - 14} text={footer} fill={T.textDim} />
    </g>
  );
}

/* ————————————————————— cards: one memorable shape each, no motion ————————————————————— */

function Scores({ theme: T, name, x, bottom, hmax }: { theme: Theme; name: AudioName; x: number; bottom: number; hmax: number }) {
  const o = OUT[name];
  const p = o.probs[DEFAULT.clip], pred = o.pred[DEFAULT.clip];
  return (
    <g>
      {p.map((v, k) => {
        const h = Math.max(1, Math.round(v * hmax));
        return (
          <g key={k}>
            <rect x={x + k * 5} y={bottom - h} width={4} height={h} fill={k === pred ? T.accentHi : T.accent} />
            <PText x={x + k * 5} y={bottom + 1} text={`_{${k}}`} fill={k === pred ? T.wireHot : T.textDim} />
          </g>
        );
      })}
    </g>
  );
}

/** Card back-end: 1/2/4 bars (bw 1), heights h/2^i centred on cy, then the pooled sliver. */
function MiniCNN({ theme: T, x, cy, h }: { theme: Theme; x: number; cy: number; h: number }) {
  const hs = [h, h / 2, h / 4].map(Math.round);
  const xs = [x, x + 4, x + 10];
  return (
    <g>
      <Bars x={xs[0]} y={cy - Math.floor(hs[0] / 2)} bars={1} h={hs[0]} theme={T} bw={1} gap={1} />
      <Wire pts={[[xs[0] + 1, cy], [xs[1] - 1, cy]]} fill={T.accentLo} step={1} />
      <Bars x={xs[1]} y={cy - Math.floor(hs[1] / 2)} bars={2} h={hs[1]} theme={T} bw={1} gap={1} />
      <Wire pts={[[xs[1] + 3, cy], [xs[2] - 1, cy]]} fill={T.accentLo} step={1} />
      <Bars x={xs[2]} y={cy - Math.floor(hs[2] / 2)} bars={4} h={hs[2]} theme={T} bw={1} gap={1} />
      <Wire pts={[[xs[2] + 7, cy], [xs[2] + 9, cy]]} fill={T.accentLo} step={1} />
      <rect x={xs[2] + 10} y={cy - 12} width={1} height={24} fill={T.accentHi} />
    </g>
  );
}

export function AudioCard({ theme, name }: { theme: Theme; name: AudioName }) {
  const T = theme;
  const v = AUDIO_CARD_VIEW[name];
  const d = useMemo(() => {
    const spec = unNib(ASPEC_SPEC[DEFAULT.clip], 0, 1);
    const mel = melView(AMEL_MEL[DEFAULT.clip]);
    // token matrix: row = frame, col = 16 pooled frequency rows (low → high)
    const spec16 = poolRows4(spec);
    const tokens = new Float32Array(N_FRAMES * 16);
    for (let fr = 0; fr < N_FRAMES; fr++) for (let c = 0; c < 16; c++) tokens[fr * 16 + c] = spec16[c * N_FRAMES + fr];
    // fb pooled to 16×16 (max): rows = 4 mel bands, cols = 8 bins
    const fb = melFilterbank();
    const fb16 = new Float32Array(16 * 16);
    for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) {
      let m = 0;
      for (let k = 0; k < 4; k++) for (let b = 0; b < 8; b++) m = Math.max(m, fb[4 * r + k][8 * c + b]);
      fb16[r * 16 + c] = m;
    }
    return { wave: unNib(AUD_WAVE[DEFAULT.clip]), spec16, mel16: poolRows4(mel), tokens, fb16 };
  }, []);

  if (name === "audio_classifier") {
    return (
      <g>
        <rect x={0} y={0} width={v.w} height={v.h} fill={T.ground} />
        <PText x={4} y={4} text="wave" fill={T.textDim} />
        <PText x={72} y={4} text="conv1d s2" fill={T.textDim} />
        <PText x={138} y={4} text="scores" fill={T.textDim} />
        <rect x={4} y={26} width={56} height={28} fill={T.panel} />
        <Frame x={3} y={25} w={58} h={30} fill={T.frame} />
        <path d={waveRuns(d.wave, 4, 40, 56, 13)} fill={T.ramp[6]} />
        <rect x={31} y={56} width={1} height={2} fill={T.loss} />
        <Wire pts={[[62, 40], [70, 40]]} fill={T.wireHot} step={2} />
        <Frame x={72} y={36} w={12} h={8} fill={T.wireHot} />
        {[0, 1, 2, 3, 4].map((c) => <rect key={c} x={73 + c * 2} y={37} width={1} height={6} fill={T.wire} />)}
        <Wire pts={[[85, 40], [90, 40]]} fill={T.wireHot} step={2} />
        <Bars x={92} y={15} bars={2} h={50} theme={T} bw={1} gap={1} />
        <Wire pts={[[95, 40], [97, 40]]} fill={T.accentLo} step={1} />
        <Bars x={98} y={28} bars={4} h={25} theme={T} bw={1} gap={1} />
        <Wire pts={[[105, 40], [107, 40]]} fill={T.accentLo} step={1} />
        <Bars x={108} y={34} bars={8} h={12} theme={T} bw={1} gap={1} />
        <Wire pts={[[123, 40], [135, 40]]} fill={T.accentLo} step={1} />
        <Scores theme={T} name={name} x={138} bottom={72} hmax={44} />
        <PText x={4} y={90} text="3.6 ms windows, then averaged" fill={T.textDim} />
      </g>
    );
  }
  if (name === "audio_spectrogram") {
    return (
      <g>
        <rect x={0} y={0} width={v.w} height={v.h} fill={T.ground} />
        <rect x={4} y={20} width={40} height={28} fill={T.panel} />
        <Frame x={3} y={19} w={42} h={30} fill={T.frame} />
        <path d={waveRuns(d.wave, 4, 34, 40, 13)} fill={T.ramp[6]} />
        <Wire pts={[[46, 34], [50, 34]]} fill={T.wireHot} step={2} />
        <Heat x={54} y={8} data={d.spec16} rows={16} cols={32} px={3} theme={T} />
        <Frame x={52} y={6} w={100} h={52} fill={T.wireHot} />
        <Wire pts={[[153, 32], [155, 32]]} fill={T.accentLo} step={1} />
        <MiniCNN theme={T} x={156} cy={32} h={48} />
        <PText x={4} y={62} text="0.5 s → 32 frames × 16 ms" fill={T.textDim} />
        <Scores theme={T} name={name} x={54} bottom={90} hmax={18} />
      </g>
    );
  }
  if (name === "audio_melspectrogram") {
    return (
      <g>
        <rect x={0} y={0} width={v.w} height={v.h} fill={T.ground} />
        <Heat x={4} y={8} data={d.fb16} rows={16} cols={16} px={3} theme={T} />
        <Frame x={2} y={6} w={52} h={52} fill={T.wireHot} />
        <Wire pts={[[56, 32], [59, 32]]} fill={T.wireHot} step={2} />
        <Heat x={62} y={8} data={d.mel16} rows={16} cols={32} px={3} theme={T} />
        <Frame x={61} y={7} w={98} h={50} fill={T.frame} />
        <Wire pts={[[160, 32], [161, 32]]} fill={T.accentLo} step={1} />
        <MiniCNN theme={T} x={162} cy={32} h={48} />
        <PText x={4} y={62} text="12 of 64 bands empty" fill={T.loss} />
        <Scores theme={T} name={name} x={62} bottom={90} hmax={18} />
      </g>
    );
  }
  // audio_transformer: the slab laid down — 32 frames become 32 token rows
  return (
    <g>
      <rect x={0} y={0} width={v.w} height={v.h} fill={T.ground} />
      <Heat x={4} y={8} data={d.spec16} rows={16} cols={32} px={3} theme={T} />
      <Frame x={3} y={7} w={98} h={50} fill={T.frame} />
      <rect x={52} y={58} width={3} height={2} fill={T.wireHot} />
      <Wire pts={[[53, 61], [53, 64], [110, 64], [110, 53], [112, 53]]} fill={T.wireHot} step={3} />
      <Heat x={116} y={4} data={d.tokens} rows={32} cols={16} px={3} theme={T} flip={false} />
      <Frame x={115} y={3} w={50} h={98} fill={T.frame} />
      <Frame x={114} y={51} w={52} h={5} fill={T.wireHot} />
      <Wire pts={[[167, 53], [169, 53]]} fill={T.accentLo} step={1} />
      <Bars x={171} y={4} bars={4} h={96} theme={T} bw={1} gap={1} />
      <Wire pts={[[179, 53], [181, 53]]} fill={T.accentLo} step={1} />
      <rect x={182} y={29} width={1} height={48} fill={T.accentHi} />
      <PText x={4} y={68} text="a frame = a token" fill={T.textDim} />
      <Scores theme={T} name={name} x={4} bottom={104} hmax={24} />
    </g>
  );
}

/* ————————————————————— registry entries ————————————————————— */

// Structurally the registry's DiagramDef (index.tsx keeps that interface private).
interface AudioDef {
  view: { w: number; h: number };
  interactive?: boolean;
  keysHint?: string;
  title: string;
  truth: string;
  render: (p: { theme: Theme; t: number; onT?: (t: number) => void; still: boolean; keys: MutableRefObject<KeyHandler | null> }) => ReactNode;
  card: { view: { w: number; h: number }; render: (p: { theme: Theme; t: number }) => ReactNode };
  badge: string;
}

const def = (name: AudioName, title: string, truth: string, badge: string, keysHint: string): AudioDef => ({
  view: AUDIO_VIEW,
  interactive: true,
  keysHint,
  title,
  truth,
  badge,
  render: ({ theme, still, keys }) => <AudioDiagram theme={theme} name={name} still={still} keys={keys} />,
  card: { view: AUDIO_CARD_VIEW[name], render: ({ theme }) => <AudioCard theme={theme} name={name} /> },
});

export const AUDIO_DEFS: Record<string, AudioDef> = {
  audio_classifier: def(
    "audio_classifier",
    "audio classifier — a 1-D conv hears local waveform shapes, then averages time away",
    "Real: FSDD test clip 7 (0.5 s, 8 kHz, one speaker) through the local mini-audio_classifier champion — its waveform (shown mean-pooled 10×, 400 of 4000 samples, scaled to the clip's own peak; the zoom magnifies 18 of those pooled points, standing in for the raw samples a 5-tap, stride-2 kernel reads), the real 128-d AdaptiveAvgPool1d vector (77 of 128 non-zero), the ten logits and the cross-entropy 1.49 (it says 4). Drawn from the code: Conv1d k5 s2 ×3, 32 → 64 → 128 channels, 2000 → 1000 → 500 time steps, ReLU, no BatchNorm; the kernels and time maps were not exported. Honest reading: the receptive field is 29 samples = 3.6 ms (the red pixel on the 4000-sample ruler) before a global average, so the net detects local waveform shapes and forgets when — the reason for the 0.385 honest held-out accuracy (gate bar M 0.20). The 8 clips on the right are 8 of ~600 held-out recordings of the same speakers (4/8 right), not the gate number.",
    "real clip, real logits",
    "←/→ pick a clip",
  ),
  audio_spectrogram: def(
    "audio_spectrogram",
    "audio spectrogram — the STFT turns half a second of sound into a picture a CNN can read",
    "Real: the same clip 7's STFT magnitude through the local mini-audio_spectrogram champion — the spectrogram (shown as log, per-clip min-max scaled, 129 → 64 rows; the net gets 129 linear bins), the ten logits and the cross-entropy .03. Exact from the code: torch.stft n_fft 256, hop 128, 50% overlap → 32 frames × 16 ms, 129 bins × 31.25 Hz, zero parameters, computed in the trainer; then Conv2d 16 → 32 → 64 with two MaxPool2 (129 → 64 → 32 frequency rows), global average pool to 64, Linear 64 → 10 — conv-ReLU-pool, no BatchNorm. Kernels and feature maps were not exported, so the CNN is drawn as bars. 7/8 of the clips right (the 3 says 8); honest held-out accuracy 0.449, gate bar M 0.35.",
    "real spectrogram, real logits",
    "←/→ clip, ↑/↓ frame",
  ),
  audio_melspectrogram: def(
    "audio_melspectrogram",
    "audio mel spectrogram — the same CNN, fed 64 mel bands instead of 129 linear bins",
    "Real: clip 7's log-mel through the local mini-audio_melspectrogram champion, the logits and the cross-entropy .03. The export min-max scales each clip over all 64 rows, so the empty rows pin the floor; for display the live rows are re-stretched over their own range and the empty rows stay blank. The filterbank in the middle is the exact mel_filterbank(256, 64, 16000, 0, 8000) maths from the code, drawn with 4 bins per cell (mean ×2, clipped) so wide triangles show their shoulders (its peaks match the exported peak bins). Honest reading in red: the bank assumes 16 kHz but FSDD is 8 kHz, so 12 of the 64 filters are empty (bands 0–5, 7–10, 13, 14 — the blank floor of the mel image is real zeros, not a rendering bug), 15 more cover a single bin, and triangles of three or more bins only start at band 34. The back-end is AudioSpecCNN again — same code, same 23,946 parameters, drawn at the same place with heights 64 → 32 → 16. 5/8 clips right (3 → 8, 4 → 2, 6 → 8); honest held-out 0.430 vs the linear spectrogram's 0.449 — on this zoo mel did not win; the point is the representation axis, not a ranking. Gate bar M 0.35.",
    "real mel, exact filterbank",
    "←/→ clip, ↑/↓ frame",
  ),
  audio_transformer: def(
    "audio_transformer",
    "audio transformer — every STFT frame becomes a token; attention mixes all 32, order-blind",
    "Real: clip 7's STFT (the same 32 frames as audio_spectrogram, here read as 32 tokens of 129 dims), the ten logits and a cross-entropy under .01; 8/8 clips right, honest held-out accuracy 0.955 (gate bar M 0.40). Drawn from the code: Linear 129 → 64, two post-LN nn.TransformerEncoder blocks with 4 heads × 16 dims (1 bar = 16 channels) and an FFN 64 → 256 → 64, full bidirectional attention — no causal mask, no positional encoding, no CLS token — then the mean over the 32 frames and Linear 64 → 10. Attention weights and token states were not exported, so there is no attention grid: the blocks are structure. Honest reading: with no positions and a mean pool the model is permutation-invariant over frames (shuffle the columns, same logits) — it wins because each token is a whole spectrum and attention mixes all 32 globally, not because it models time.",
    "real tokens, real logits",
    "←/→ clip, ↑/↓ frame",
  ),
};
