"use client";

// PixelCNN anatomy (atom: introduces autoregressive-factorization), drawn from
// src/mini_networks/models/pixelcnn/{model,trainer}.py and the REGISTERED
// champion, which is the early 4-layer / 32-filter net (PCNN_ARCH, PCNN_ERA),
// not today's 8 × 64 config.
//
//   x [B,1,28,28] binarised (>0.5) → MaskedConv 'A' 1→32 + ReLU →
//   3 × MaskedConv 'B' 32→32 + ReLU → Conv 1×1 32→1 → one logit per pixel →
//   σ = p(x_i=1 | x_<i).  Constant 28×28 — no pooling, no latent, no timestep.
//
// Two lanes, one net:
//   · SAMPLE (top, diffusion's chain grammar): raster order, 784 passes, one
//     Bernoulli coin per pixel. Every canvas is a REAL prefix of sample 0
//     (PCNN_SAMPLES), and because the masks are causal PCNN_SAMPLE_PROB[i] is
//     exactly the p pixel i was drawn from — the replay is real data. The lens
//     outlines the exact 34-px receptive field of 1×A + 3×B 3×3 masks (4 rows
//     up, ±4 cols, up-right blind spot). The per-step uniform number was not
//     exported; only the coin's real outcome is shown.
//   · TRAIN (bottom, classifier's spine grammar): ONE teacher-forced pass, the
//     real binarised test 7 in, its real p map out (PCNN_REAL_PROB), BCE .07
//     nats/pixel printed verbatim from PCNN_REAL_NLL (never recomputed from the
//     16-level nibbles). Layers are structure only (no activations exported).
// wireHot = only the autoregressive idea: the cursor, its causal context, the
// raster order and the position-i ticks beside the mask centres.
import { useMemo, type MutableRefObject, type ReactNode } from "react";
import {
  PCNN_MASK_A, PCNN_MASK_B, PCNN_REAL, PCNN_REAL_NLL, PCNN_REAL_PROB, PCNN_SAMPLES, PCNN_SAMPLE_PROB,
} from "../data/pixelcnn-champion";
import { unNib } from "../math";
import { Bars, Diamond, Frame, PText, Thumb, Wire } from "../prims";
import { useTick } from "../tick";
import { heatIndex, type Theme } from "../themes";
import type { KeyHandler } from "./types";

const N = 28;
const fmt = (v: number) => v.toFixed(2).replace(/^0/, "");

/** binary nibble string → 0/1 (unNib gives .031/.969, so threshold at .5) */
const bin = (s: string) => Array.from(unNib(s, 0, 1), (v) => (v > 0.5 ? 1 : 0));
/** the canvas after k raster steps: pixels < k from the sample, the rest still 0 (−1 in the ramp) */
const prefix = (s: number[], k: number) => Float32Array.from(s, (v, idx) => (idx < k && v ? 1 : -1));
const pm1 = (s: number[]) => Float32Array.from(s, (v) => (v ? 1 : -1));
const mask = (m: readonly (readonly number[])[]) => Float32Array.from(m.flat(), (v) => v * 2 - 1);
/** a p nibble as house text: '0' is the bin [0, .0625) */
const pText = (nib: string, p: number) => (nib === "0" ? "< .06" : `~ ${fmt(p)}`);

/** the exact receptive field of 1 × mask A + 3 × mask B (3×3): 34 pixels */
function inField(r: number, c: number, cr: number, cc: number): boolean {
  const up = cr - r;
  if (up === 0) return c >= cc - 4 && c <= cc - 1;
  if (up >= 1 && up <= 4) return c >= cc - 4 && c <= cc + up;
  return false;
}

// ————— the lens: a fixed window of the canvas around the cursor —————
interface LensProps {
  x: number; y: number; pitch: number; cell: number; canvas: number[]; i: number; theme: Theme;
  r0?: number; c0?: number; rows?: number; cols?: number;
}

function Lens({ x, y, pitch, cell, canvas, i, theme: T, r0 = 10, c0 = 12, rows = 5, cols = 13 }: LensProps) {
  const cr = Math.floor(i / N), cc = i % N;
  const cx = (c: number) => x + (c - c0) * pitch;
  const cy = (r: number) => y + (r - r0) * pitch;
  let on = "", off = "", fut = "", cur = "", rf = "";
  const ring = (px: number, py: number) => `M${px} ${py}h${cell}v${cell}h${-cell}z M${px + 1} ${py + 1}v${cell - 2}h${cell - 2}v${-(cell - 2)}z`;
  for (let r = r0; r < r0 + rows; r++)
    for (let c = c0; c < c0 + cols; c++) {
      const idx = r * N + c, px = cx(c), py = cy(r);
      const box = `M${px} ${py}h${cell}v${cell}h${-cell}z`;
      if (idx === i) cur += box;
      else if (idx > i) fut += ring(px, py);
      else if (canvas[idx]) on += box;
      else off += box;
      if (!inField(r, c, cr, cc)) continue;
      // outline the field on the 1-px ground gaps, never on a data cell
      const out = (rr: number, ccc: number) => !inField(rr, ccc, cr, cc) || rr < r0 || ccc < c0 || ccc >= c0 + cols;
      if (out(r - 1, c)) rf += `M${px - 1} ${py - 1}h${cell + 2}v1h${-(cell + 2)}z`;
      if (out(r + 1, c)) rf += `M${px - 1} ${py + cell}h${cell + 2}v1h${-(cell + 2)}z`;
      if (out(r, c - 1)) rf += `M${px - 1} ${py - 1}h1v${cell + 2}h-1z`;
      if (out(r, c + 1)) rf += `M${px + cell} ${py - 1}h1v${cell + 2}h-1z`;
    }
  const core = Math.floor(cell / 2);
  return (
    <g>
      <path d={off} fill={T.ramp[1]} />
      <path d={on} fill={T.ramp[7]} />
      <path d={fut} fill={T.frame} fillRule="evenodd" />
      <path d={cur} fill={T.wireHot} />
      <rect x={cx(cc) + core} y={cy(cr) + core} width={1} height={1} fill={T.ground} />
      <path d={rf} fill={T.wireHot} />
    </g>
  );
}

/** a 3×3 mask kernel with the position-i ticks drawn OFF the kernel, pointing at its centre */
function MaskKernel({ x, y, data, theme: T }: { x: number; y: number; data: Float32Array; theme: Theme }) {
  return (
    <g>
      <Thumb x={x} y={y} data={data} n={3} px={4} theme={T} />
      <rect x={x - 4} y={y + 5} width={2} height={2} fill={T.wireHot} />
      <rect x={x + 5} y={y - 4} width={2} height={2} fill={T.wireHot} />
    </g>
  );
}

// ————— full view —————
export const PIXELCNN_VIEW = { w: 560, h: 316 };

// lane 1: sampling (diffusion's chain + the introduced lens)
const TH = 56, CH_Y = 24;
const CH_X = [16, 90, 164, 238];
const CHAIN_K = [0, 196, 308, 467]; // k 140 is still blank — not a useful stop
const LENS = { x: 320, y: 17, pitch: 8, cell: 7 };
const TAPE_Y = 61, RO_X = 436, ROW_CAP1 = 84;
// frame 0 = the complete story: (16,19) p ~ .66, coin → 0; then (16,17) .78 → 1, (16,18) .84 → 1.
// Row 16 sits under the stroke, so the 34-px field holds 13 lit pixels (rows 14–16).
const FRAMES = [467, 465, 466];
// the lens window: rows 12–16 (cursor row at the bottom), cols 11–23 = c−4 … c+4 for every frame
const LENS_R0 = 12, LENS_C0 = 11;
const LENS_ROW_Y = LENS.y + 4 * LENS.pitch + Math.floor(LENS.cell / 2); // centre of the cursor row (lens row 5)

// lane 2: training (classifier's spine)
const HEAD1 = 6, HEAD2 = 106, STAGE = 118, KER_Y = 132, BAR_TOP = 152, CY = BAR_TOP + 42;
const LAYER_X = [96, 124, 152, 180];
const SLIVER_X = 208;
const PMAP = { x: 252, y: 166 };
const DIA = { cx: 360, cy: CY };
const ROW_CAP2 = 242, ROW_NOTE = 254, TGT_Y = 270;
const DIV_X = 416;
const GAL = { x: [426, 490], y: [120, 182] };

export function PixelCNNDiagram({ theme, still }: { theme: Theme; still: boolean }) {
  const T = theme;
  const d = useMemo(() => {
    const s = PCNN_SAMPLES.map(bin);
    const p0 = unNib(PCNN_SAMPLE_PROB[0], 0, 1);
    return {
      s,
      p0,
      chain: CHAIN_K.map((k) => prefix(s[0], k)),
      gallery: s.map(pm1),
      real: pm1(bin(PCNN_REAL[0])),
      realP: unNib(PCNN_REAL_PROB[0], 0, 1),
      kA: mask(PCNN_MASK_A),
      kB: mask(PCNN_MASK_B),
    };
  }, []);
  const f = useTick(2, FRAMES.length, still);
  const i = FRAMES[f];
  const cr = Math.floor(i / N), cc = i % N;
  const hot = useMemo(() => prefix(d.s[0], i), [d, i]);
  const p = d.p0[i];
  const nib = PCNN_SAMPLE_PROB[0][i];
  const coin = d.s[0][i];
  const HX = CH_X[3];

  return (
    <g>
      <rect x={0} y={0} width={PIXELCNN_VIEW.w} height={PIXELCNN_VIEW.h} fill={T.ground} />

      {/* ——— lane 1: sample, 784 passes, one coin per pixel ——— */}
      <PText x={16} y={HEAD1} text="sample: 784 passes, one pixel each" fill={T.textDim} />
      <PText x={LENS.x} y={HEAD1} text="what the net sees" fill={T.textDim} />
      {CHAIN_K.map((k, j) => {
        const x = CH_X[j];
        const isHot = j === 3;
        const kk = isHot ? i : k;
        const r = Math.floor(kk / N);
        return (
          <g key={k}>
            <Thumb x={x} y={CH_Y} data={isHot ? hot : d.chain[j]} theme={T} />
            {/* cursor row, pointed at from outside the frame */}
            <rect x={x - 5} y={CH_Y + 2 * r} width={2} height={2} fill={T.wireHot} />
            {j < 3 && <PText x={x + TH + 9} y={CH_Y + 6} text="→" fill={T.wire} anchor="middle" />}
            <PText x={x} y={ROW_CAP1} text={`k ${kk}`} fill={isHot ? T.wireHot : T.textDim} />
          </g>
        );
      })}
      {/* the fixed raster order of infer(), drawn on the still-blank first canvas */}
      {[4, 12, 20].map((dy) => (
        <g key={dy}>
          <Wire pts={[[CH_X[0] + 4, CH_Y + dy], [CH_X[0] + 48, CH_Y + dy]]} fill={T.wireHot} />
          <rect x={CH_X[0] + 47} y={CH_Y + dy - 1} width={1} height={1} fill={T.wireHot} />
          <rect x={CH_X[0] + 47} y={CH_Y + dy + 1} width={1} height={1} fill={T.wireHot} />
        </g>
      ))}
      {/* the hot canvas: one Frame, the cursor column ticked above it */}
      <Frame x={HX - 2} y={CH_Y - 2} w={TH + 4} h={TH + 4} fill={T.wireHot} />
      <rect x={HX + 2 * cc} y={CH_Y - 6} width={2} height={2} fill={T.wireHot} />
      {/* cursor row → the same row in the lens: an orthogonal dogleg onto the lens row's centre */}
      <Wire pts={[[HX + TH + 4, CH_Y + 2 * cr], [LENS.x - 10, CH_Y + 2 * cr], [LENS.x - 10, LENS_ROW_Y], [LENS.x - 3, LENS_ROW_Y]]} fill={T.wireHot} />

      {/* the lens: rows 12–16, cols 11–23 of the same canvas, the 34-px field outlined */}
      <Lens x={LENS.x} y={LENS.y} pitch={LENS.pitch} cell={LENS.cell} canvas={d.s[0]} i={i} theme={T} r0={LENS_R0} c0={LENS_C0} />
      {/* the coin tape: p of every draw on this row so far, cursor included */}
      <PText x={LENS.x - 10} y={TAPE_Y} text="p" fill={T.textDim} />
      {Array.from({ length: cc - LENS_C0 + 1 }, (_, k) => {
        const c = LENS_C0 + k;
        return <rect key={c} x={LENS.x + k * LENS.pitch} y={TAPE_Y} width={LENS.cell} height={LENS.cell} fill={T.heat[heatIndex(d.p0[cr * N + c])]} />;
      })}
      <PText x={LENS.x} y={ROW_CAP1} text="34 px seen: 4 masks stacked" fill={T.textDim} />

      {/* readout at the cursor */}
      <PText x={RO_X} y={17} text={`i ${i}`} fill={T.wireHot} />
      <PText x={RO_X} y={27} text={`row ${cr}, col ${cc}`} fill={T.textDim} />
      <PText x={RO_X} y={37} text={`p ${pText(nib, p)}`} fill={T.text} />
      <rect x={RO_X} y={47} width={60} height={4} fill={T.panel} />
      <rect x={RO_X} y={47} width={Math.max(1, Math.round(p * 60))} height={4} fill={T.accent} />
      <PText x={RO_X} y={55} text={`coin → ${coin}`} fill={T.text} />
      <Frame x={RO_X + 49} y={54} w={9} h={9} fill={T.frame} />
      <rect x={RO_X + 50} y={55} width={7} height={7} fill={coin ? T.ramp[7] : T.ramp[1]} />
      <PText x={RO_X} y={65} text="a draw, not p>.5" fill={T.textDim} />

      <rect x={16} y={98} width={530} height={1} fill={T.frame} />

      {/* ——— lane 2: train, one teacher-forced pass ——— */}
      <PText x={16} y={HEAD2} text="train: one pass, all 784 p at once" fill={T.textDim} />
      <PText x={88} y={STAGE} text="masks" fill={T.textDim} anchor="end" />
      {LAYER_X.map((lx, l) => (
        <g key={lx}>
          <PText x={lx + 4} y={STAGE} text={l === 0 ? "A" : "B"} fill={T.text} anchor="middle" />
          <MaskKernel x={lx - 2} y={KER_Y} data={l === 0 ? d.kA : d.kB} theme={T} />
          <Wire pts={[[lx + 4, KER_Y + 15], [lx + 4, BAR_TOP - 2]]} fill={T.wire} />
          <Bars x={lx} y={BAR_TOP} bars={2} h={84} theme={T} bw={3} gap={2} />
          <PText x={lx + 4} y={ROW_CAP2} text="_{32}" fill={T.textDim} anchor="middle" />
          {l < 3 && <Wire pts={[[lx + 10, CY], [LAYER_X[l + 1] - 2, CY]]} fill={T.accentLo} step={1} />}
        </g>
      ))}
      <PText x={SLIVER_X + 1} y={STAGE} text="1×1" fill={T.textDim} anchor="middle" />
      <PText x={PMAP.x} y={STAGE} text="p, teacher-forced" fill={T.textDim} />

      <Thumb x={16} y={CY - 28} data={d.real} theme={T} />
      <PText x={16} y={ROW_CAP2} text="a real 7" fill={T.textDim} />
      <Wire pts={[[74, CY], [94, CY]]} fill={T.accentLo} step={1} />
      <Wire pts={[[LAYER_X[3] + 10, CY], [SLIVER_X - 2, CY]]} fill={T.accentLo} step={1} />
      <rect x={SLIVER_X} y={BAR_TOP} width={1} height={84} fill={T.accentHi} />
      <PText x={SLIVER_X + 1} y={ROW_CAP2} text="_{1}" fill={T.textDim} anchor="middle" />
      <Wire pts={[[SLIVER_X + 2, CY], [PMAP.x - 3, CY]]} fill={T.wire} />
      <PText x={230} y={CY - 12} text="σ" fill={T.text} anchor="middle" />
      <Thumb x={PMAP.x} y={PMAP.y} data={d.realP} heat theme={T} />
      <PText x={PMAP.x} y={ROW_CAP2} text="p(x_i=1 | x<i)" fill={T.textDim} />
      <PText x={LAYER_X[0]} y={ROW_NOTE} text="v1: 4 × 32, structure only (now 8 × 64)" fill={T.textDim} />

      {/* BCE against the same tensor: legal only because the masks hide x_i */}
      <Wire pts={[[PMAP.x + TH + 2, CY], [DIA.cx - 8, CY]]} fill={T.wire} />
      <Wire pts={[[80, CY + 2], [80, TGT_Y], [DIA.cx, TGT_Y], [DIA.cx, DIA.cy + 9]]} fill={T.wire} />
      <PText x={86} y={TGT_Y + 4} text="target = the same 7 (masks hide x_i)" fill={T.textDim} />
      <Diamond cx={DIA.cx} cy={DIA.cy} theme={T} />
      <PText x={DIA.cx + 10} y={DIA.cy - 11} text="BCE" fill={T.loss} />
      <PText x={DIA.cx + 10} y={DIA.cy - 1} text={fmt(PCNN_REAL_NLL[0])} fill={T.loss} />
      <PText x={DIA.cx + 10} y={DIA.cy + 9} text="per px" fill={T.textDim} />

      {/* ——— the finished samples and the gate, apart from the loss ——— */}
      <rect x={DIV_X} y={104} width={1} height={180} fill={T.frame} />
      <PText x={GAL.x[0]} y={HEAD2} text="4 finished samples" fill={T.text} />
      {d.gallery.map((g, k) => (
        <Thumb key={k} x={GAL.x[k % 2]} y={GAL.y[Math.floor(k / 2)]} data={g} theme={T} />
      ))}
      <PText x={GAL.x[0]} y={ROW_CAP2} text="stroke fragments" fill={T.textDim} />
      <PText x={GAL.x[0]} y={ROW_NOTE} text="gate: a judge scores" fill={T.textDim} />
      <PText x={GAL.x[0]} y={ROW_NOTE + 10} text="these, bar .5 (M)" fill={T.textDim} />

      <PText x={16} y={PIXELCNN_VIEW.h - 14} text="1 bar = 16 channels, every layer 28×28   kernel: on = live tap, tick = pixel i   heat: p" fill={T.textDim} />
    </g>
  );
}

// ————— card: canvas → lens staircase + coin tape, masks A/B, 4 samples, the stack —————
export const PIXELCNN_CARD_VIEW = { w: 190, h: 104 };
const CARD_I = 467;

export function PixelCNNCard({ theme }: { theme: Theme }) {
  const T = theme;
  const d = useMemo(() => {
    const s = PCNN_SAMPLES.map(bin);
    return {
      s,
      p0: unNib(PCNN_SAMPLE_PROB[0], 0, 1),
      canvas: prefix(s[0], CARD_I),
      gallery: s.map(pm1),
      kA: mask(PCNN_MASK_A),
      kB: mask(PCNN_MASK_B),
    };
  }, []);
  const cr = Math.floor(CARD_I / N), cc = CARD_I % N;
  return (
    <g>
      <rect x={0} y={0} width={PIXELCNN_CARD_VIEW.w} height={PIXELCNN_CARD_VIEW.h} fill={T.ground} />
      <Thumb x={6} y={19} data={d.canvas} px={1} theme={T} />
      <rect x={2} y={19 + cr} width={2} height={1} fill={T.wireHot} />
      <rect x={6 + cc} y={15} width={1} height={2} fill={T.wireHot} />
      {/* thumb row → the lens's cursor row centre (lens row 5 at pitch 6: y 7 + 24 + 2) */}
      <Wire pts={[[36, 19 + cr], [39, 19 + cr], [39, 33], [42, 33]]} fill={T.wireHot} />
      <Lens x={44} y={7} pitch={6} cell={5} canvas={d.s[0]} i={CARD_I} theme={T} r0={LENS_R0} c0={LENS_C0} />
      {Array.from({ length: cc - LENS_C0 + 1 }, (_, k) => (
        <rect key={k} x={44 + k * 6} y={41} width={5} height={5} fill={T.heat[heatIndex(d.p0[cr * N + LENS_C0 + k])]} />
      ))}
      <MaskKernel x={136} y={10} data={d.kA} theme={T} />
      <MaskKernel x={160} y={10} data={d.kB} theme={T} />
      <PText x={142} y={28} text="A" fill={T.text} anchor="middle" />
      <PText x={166} y={28} text="B" fill={T.text} anchor="middle" />
      {d.gallery.map((g, k) => (
        <Thumb key={k} x={6 + k * 32} y={56} data={g} px={1} theme={T} />
      ))}
      {[142, 150, 158, 166].map((x, l) => (
        <g key={x}>
          <Bars x={x} y={56} bars={2} h={28} theme={T} bw={1} gap={1} />
          <Wire pts={[[x + 4, 70], [l < 3 ? x + 6 : 172, 70]]} fill={T.accentLo} step={1} />
        </g>
      ))}
      <rect x={174} y={56} width={1} height={28} fill={T.accentHi} />
      <PText x={6} y={92} text="784 coins, raster order" fill={T.textDim} />
    </g>
  );
}

// Structurally the registry's DiagramDef (index.tsx keeps that interface private).
interface PixelCNNDef {
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

export const PIXELCNN_DEFS: Record<string, PixelCNNDef> = {
  pixelcnn: {
    view: PIXELCNN_VIEW,
    title: "pixelcnn — one pixel at a time, each a coin flip on the pixels before it",
    truth:
      "All drawn data is the registered mini-pixelcnn v1 champion (4 masked layers × 32 filters; today's config is 8 × 64): its 4 raster samples, the p(x_i=1|x_<i) each pixel was drawn from (exact, because the masks are causal), and the teacher-forced p map and BCE .07 nats/pixel on MNIST test 0, a 7. The outlined 34 pixels are this net's exact receptive field. Layers are structure only (no activations exported); the per-step random number is not shown, only the coin's real outcome. The gate is a separate judge score on samples (bar .5 at M), not this loss.",
    badge: "real champion samples + p",
    render: ({ theme, still }) => <PixelCNNDiagram theme={theme} still={still} />,
    card: { view: PIXELCNN_CARD_VIEW, render: ({ theme }) => <PixelCNNCard theme={theme} /> },
  },
};
