"use client";

// rpp_classifier anatomy (residual pathway priors), from src/mini_networks/
// models/rpp_classifier/model.py:
//   x [1,28,28] → AvgPool2 → [1,14,14]
//   RPPBlock(1→8, 14):  c = Conv2d 3×3 (no bias),  f = Linear(196→1568).view,
//                        ReLU(BN(c + f))                         → [8,14,14]
//   AvgPool2 → [8,7,7] → RPPBlock(8→16, 7) → [16,7,7] → mean(H,W) → [16]
//   → Linear(16→10) → 10 logits.
// Training loss: CE + 1e-4·Σ‖W_conv‖² + 1e-2·Σ‖W_free‖² (eval: CE only).
//
// There is NO local rpp_classifier checkpoint. EXACT here: every shape and
// parameter count (data/rpp-structure.ts), the MNIST test digit and its 2×2
// average pools, the band the conv occupies inside the same-shape dense
// matrix (rpp-band.ts, node-tested), the λs and the loss terms at init
// (torch seed 0). ILLUSTRATIVE (seeded stand-ins, labelled on the drawing):
// the 3×3 kernel, the dense weights and therefore the c / f / c+f / out maps;
// the logit tracks are drawn empty.
import { useMemo, type MutableRefObject, type ReactNode } from "react";
import { digitByLabel, digitPixels } from "../data/mnist-digits";
import { RPP_GATE, RPP_INIT, RPP_LAMBDA, RPP_PARAMS } from "../data/rpp-structure";
import { conv3, rng } from "../math";
import { Bars, Diamond, Frame, Node, PText, Thumb, Wire } from "../prims";
import { textWidth } from "../pixel-font";
import { useTick } from "../tick";
import type { Theme } from "../themes";
import type { KeyHandler } from "./types";
import { avgPool2, bandRuns, bellHeights } from "./rpp-band";

export const RPP_VIEW = { w: 560, h: 316 };
export const RPP_CARD_VIEW = { w: 190, h: 110 };

// ————— named rows / columns (STYLE §3b) —————
const CY = 46;                    // the spine
const ROW_HEAD = 8, ROW_CAP = 80, ROW_RES = 90, ROW_PARAM = 100;
const X = { input: 16, pool: 90, b1: 138, b2: 178, gap: 218, logit: 262, logitLab: 254, logitHead: 252 };
// ledger (top right): CE, conv prior, free prior → the Diamond
const ROW_L = { ce: 22, conv: 36, free: 50 };
const L = { name: 330, bell: 358, lam: 402, trk: 432, trkW: 40, val: 506, bus: 512 };
const BELL = { w: 40, h: 12, range: 100, peak: 10 };
const DIA = { x: 524, y: 70 };   // name ends at x546 (w-14)
// inset: block 1 opened
const PANEL = { x: 10, y: 114, w: 540, h: 178 };
const ROW_TITLE = 122, LC = 158, LF = 246, MID = 202, MAP = 42;
const ROW_CAPC = 182, ROW_CAPM = 228, ROW_CAPF = 270, ROW_WARN = 283;
const ROW_PRICEC = 176, ROW_PRICEF = 215; // each lane's λ, on the lane it prices
const XI = { x: 24, k: 98, s0: 84, s1: 124, map: 146, plus: 200, sum: 216, out: 274 };
const MX = { x: 352, y: 140, px: 2, lab: 458 }; // the 49×49 exhibit
const FOOT = 302;
const LABEL = 7;                  // test 0 is a 7

const fmt2 = (v: number) => v.toFixed(2).replace(/^0/, "");

/** an L2 prior as its Gaussian: one wireHot px per column on a textDim axis */
function Bell({ x, y, w, h, lambda, range, peak, theme }: {
  x: number; y: number; w: number; h: number; lambda: number; range: number; peak: number; theme: Theme;
}) {
  const T = theme;
  const base = y + h - 1;
  const hs = bellHeights(lambda, w, range, peak);
  const cols = hs.map((v, c) => [c, v] as const).filter(([, v]) => v > 0);
  const pts: [number, number][] = cols.map(([c, v]) => [x + c, base - v]);
  // a spike narrower than the axis is grounded on it; a dome truncated by the axis ends is not
  if (cols.length && cols[0][0] > 0) {
    pts.unshift([x + cols[0][0] - 1, base]);
    pts.push([x + cols[cols.length - 1][0] + 1, base]);
  }
  return (
    <g>
      <rect x={x} y={base} width={w} height={1} fill={T.textDim} />
      <Wire pts={pts} fill={T.wireHot} step={1} />
    </g>
  );
}

/** one (out, in) channel-pair block of a dense free matrix, the conv band lit (exact mask) */
function BandSquare({ x, y, s, px, theme }: { x: number; y: number; s: number; px: number; theme: Theme }) {
  const T = theme;
  const n = s * s, S = n * px;
  let d = "";
  for (let o = 0; o < n; o++)
    for (const [a, b] of bandRuns(s, o)) d += `M${x + a * px} ${y + o * px}h${(b - a) * px}v${px}h${-(b - a) * px}z`;
  return (
    <g>
      {T.shadow && <rect x={x + 2} y={y + 2} width={S} height={S} fill={T.shadow} />}
      <rect x={x} y={y} width={S} height={S} fill={T.panel} />
      {/* block-Toeplitz grid: one block per map row (s cells) */}
      {Array.from({ length: s - 1 }, (_, k) => (
        <g key={k}>
          <rect x={x + (k + 1) * s * px} y={y} width={1} height={S} fill={T.frame} />
          <rect x={x} y={y + (k + 1) * s * px} width={S} height={1} fill={T.frame} />
        </g>
      ))}
      <path d={d} fill={T.accentHi} />
      <Frame x={x - 1} y={y - 1} w={S + 2} h={S + 2} fill={T.frame} />
    </g>
  );
}

/** PText that prints "_" literally (PText reads `_x` as a subscript) */
function Lit({ x, y, text, fill }: { x: number; y: number; text: string; fill: string }) {
  const out: ReactNode[] = [];
  let cx = x;
  text.split("_").forEach((piece, i) => {
    if (i > 0) { out.push(<PText key={`u${i}`} x={cx} y={y} text="_" fill={fill} />); cx += textWidth("_") + 1; }
    if (piece) { out.push(<PText key={`p${i}`} x={cx} y={y} text={piece} fill={fill} />); cx += textWidth(piece) + 1; }
  });
  return <g>{out}</g>;
}

function Stack({ x, y, s, theme }: { x: number; y: number; s: number; theme: Theme }) {
  // offset frames behind a map: "and the other 7 channels" (classifier shape)
  return (
    <g>
      {[2, 1].map((k) => <Frame key={k} x={x + k * 2 - 1} y={y - k * 2 - 1} w={s + 2} h={s + 2} fill={theme.textDim} />)}
      <rect x={x} y={y} width={s} height={s} fill={theme.panel} />
    </g>
  );
}

// ————— the exact input + the seeded stand-ins —————
function useRppData() {
  return useMemo(() => {
    const dig = digitByLabel(LABEL);
    const x28 = digitPixels(dig);
    // ToTensor gives 0..1; the model's first op is AvgPool2d(2)
    const x01 = avgPool2(x28.map((v) => (v + 1) / 2), 28, 28);
    const x14 = x01.map((v) => v * 2 - 1);
    // STAND-IN (seed 7): an init-like 3×3 kernel, U(±1/√9) as PyTorch draws it
    const r = rng(7);
    const k = Array.from({ length: 9 }, () => ((r() * 2 - 1) / 3));
    const c = conv3(x01, 14, 14, k);
    // STAND-IN (seed 11): channel 0 of an init-like dense W_free (rows 0..195), U(±1/√196)
    const r2 = rng(11);
    const f = new Float32Array(196);
    for (let p = 0; p < 196; p++) {
      let s = 0;
      for (let q = 0; q < 196; q++) s += ((r2() * 2 - 1) / 14) * x01[q];
      f[p] = s;
    }
    const sum = c.map((v, i) => v + f[i]);
    // one BN (train mode, this map's stats, γ=1 β=0 at init) then ReLU — after the sum
    const mean = sum.reduce((a, b) => a + b, 0) / sum.length;
    const vr = sum.reduce((a, b) => a + (b - mean) ** 2, 0) / sum.length;
    const out = sum.map((v) => Math.max(0, (v - mean) / Math.sqrt(vr + 1e-5)));
    const om = Math.max(1e-6, ...out);
    // c, f and c+f share ONE scale so their relative size reads honestly
    let m = 1e-6;
    for (const a of [c, f, sum]) for (const v of a) m = Math.max(m, Math.abs(v));
    return {
      index: dig.index, x28, x14,
      k: Float32Array.from(k.map((v) => v * 3)),
      c: c.map((v) => v / m), f: f.map((v) => v / m), sum: sum.map((v) => v / m),
      out: out.map((v) => (v / om) * 2 - 1),
    };
  }, []);
}

export function RppDiagram({ theme, still }: { theme: Theme; still: boolean }) {
  const T = theme;
  const d = useRppData();
  const frame = useTick(3, 3, still);

  const convTerm = RPP_LAMBDA.conv * RPP_INIT.convSq;   // .0008
  const freeTerm = RPP_LAMBDA.free * RPP_INIT.freeSq;   // 7.84
  const total = RPP_INIT.ce + convTerm + freeTerm;      // ~10.1
  const trk = (v: number) => Math.round((v / freeTerm) * L.trkW);
  const convP = RPP_PARAMS.conv[0] + RPP_PARAMS.conv[1];
  const freeP = RPP_PARAMS.free[0] + RPP_PARAMS.free[1];
  const n3 = (v: number) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const share = ((freeP / RPP_PARAMS.total) * 100).toFixed(1);

  const ledger: { key: string; y: number; name: string; lam?: number; val: string; bar: number }[] = [
    { key: "ce", y: ROW_L.ce, name: "CE", val: `~${RPP_INIT.ce.toFixed(2)}`, bar: trk(RPP_INIT.ce) },
    { key: "conv", y: ROW_L.conv, name: "conv", lam: RPP_LAMBDA.conv, val: convTerm.toFixed(4).replace(/^0/, ""), bar: trk(convTerm) },
    { key: "free", y: ROW_L.free, name: "free", lam: RPP_LAMBDA.free, val: freeTerm.toFixed(2), bar: trk(freeTerm) },
  ];

  return (
    <g>
      <rect x={0} y={0} width={RPP_VIEW.w} height={RPP_VIEW.h} fill={T.ground} />

      {/* ——— spine headers ——— */}
      <PText x={X.input} y={ROW_HEAD} text="image" fill={T.textDim} />
      <PText x={X.pool} y={ROW_HEAD} text="avg" fill={T.textDim} />
      <PText x={X.b1} y={ROW_HEAD} text="rpp 1" fill={T.textDim} />
      <PText x={X.b2} y={ROW_HEAD} text="rpp 2" fill={T.textDim} />
      <PText x={X.gap} y={ROW_HEAD} text="mean" fill={T.textDim} />
      <PText x={X.logitHead} y={ROW_HEAD} text="10 logits" fill={T.textDim} />

      {/* the real MNIST test digit and its exact 2×2 average pool */}
      <Thumb x={X.input} y={CY - 28} data={d.x28} theme={T} />
      <Wire pts={[[X.input + 59, CY], [X.pool - 3, CY]]} fill={T.wire} />
      <Thumb x={X.pool} y={CY - 14} data={d.x14} n={14} px={2} theme={T} />

      {/* the network: 1 bar = 8 channels, height = resolution × 3 */}
      <Wire pts={[[X.pool + 31, CY], [X.b1 - 5, CY]]} fill={T.accentLo} step={1} />
      <Bars x={X.b1} y={CY - 21} bars={1} h={42} theme={T} bw={3} gap={2} />
      <Frame x={X.b1 - 2} y={CY - 23} w={7} h={46} fill={T.wireHot} />
      <Wire pts={[[X.b1 + 7, CY], [X.b2 - 3, CY]]} fill={T.accentLo} step={1} />
      <PText x={150} y={36} text="avg" fill={T.textDim} />
      <Bars x={X.b2} y={CY - 10} bars={2} h={21} theme={T} bw={3} gap={2} />
      <Wire pts={[[X.b2 + 10, CY], [X.gap - 3, CY]]} fill={T.accentLo} step={1} />
      <Bars x={X.gap} y={CY - 1} bars={2} h={3} theme={T} bw={3} gap={2} />
      <Wire pts={[[X.gap + 10, CY], [X.logitLab - 4, CY]]} fill={T.accentLo} step={1} />

      {/* the 16→10 head: no checkpoint, so the score tracks stay empty */}
      {Array.from({ length: 10 }, (_, k) => (
        <g key={k}>
          {(k === 0 || k === LABEL || k === 9) && <PText x={X.logitLab} y={15 + 6 * k} text={`_{${k}}`} fill={k === LABEL ? T.text : T.textDim} />}
          <rect x={X.logit} y={19 + 6 * k} width={40} height={3} fill={T.panel} />
        </g>
      ))}

      {/* captions: one channel row, one resolution row */}
      <PText x={X.input} y={ROW_CAP} text={`test ${d.index}`} fill={T.textDim} />
      <PText x={X.input} y={ROW_RES} text="28×28" fill={T.textDim} />
      <PText x={X.pool} y={ROW_CAP} text="_{1}" fill={T.textDim} />
      <PText x={X.pool} y={ROW_RES} text="14×14" fill={T.textDim} />
      <PText x={X.b1} y={ROW_CAP} text="_{8}" fill={T.textDim} />
      <PText x={X.b1} y={ROW_RES} text="14" fill={T.textDim} />
      <PText x={X.b2} y={ROW_CAP} text="_{16}" fill={T.textDim} />
      <PText x={X.b2} y={ROW_RES} text="7" fill={T.textDim} />
      <PText x={X.gap} y={ROW_CAP} text="_{16}" fill={T.textDim} />
      <PText x={X.gap} y={ROW_RES} text="1" fill={T.textDim} />
      <PText x={X.logitHead} y={ROW_CAP} text="no scores" fill={T.textDim} />
      <PText x={X.input} y={ROW_PARAM} text={`weights: conv paths ${n3(convP)}, free paths ${n3(freeP)} (${share}%)`} fill={T.textDim} />

      {/* ——— the loss ledger: CE + two priors, each with its own price ——— */}
      <PText x={L.name} y={ROW_HEAD} text="term" fill={T.textDim} />
      <PText x={L.bell} y={ROW_HEAD} text="prior" fill={T.textDim} />
      <PText x={L.lam} y={ROW_HEAD} text="λ" fill={T.textDim} />
      <PText x={L.trk} y={ROW_HEAD} text="at init" fill={T.textDim} />
      {/* CE(logits, label 7) into the CE row */}
      <Wire pts={[[X.logit + 43, 19 + 6 * LABEL + 1], [318, 19 + 6 * LABEL + 1], [318, ROW_L.ce + 3], [L.name - 3, ROW_L.ce + 3]]} fill={T.wire} />
      {ledger.map((r) => (
        <g key={r.key}>
          <PText x={L.name} y={r.y} text={r.name} fill={r.key === "ce" ? T.loss : T.text} />
          {r.lam !== undefined && (
            <>
              <Bell x={L.bell} y={r.y - 3} w={BELL.w} h={BELL.h} lambda={r.lam} range={BELL.range} peak={BELL.peak} theme={T} />
              <PText x={L.lam} y={r.y} text={r.lam === 1e-4 ? "1e-4" : "1e-2"} fill={T.wireHot} />
            </>
          )}
          <rect x={L.trk} y={r.y + 2} width={L.trkW} height={4} fill={T.panel} />
          {r.bar > 0 && <rect x={L.trk} y={r.y + 2} width={r.bar} height={4} fill={T.loss} />}
          <PText x={L.val} y={r.y} text={r.val} fill={T.textDim} anchor="end" />
          <Wire pts={[[L.val + 2, r.y + 3], [L.bus - 1, r.y + 3]]} fill={r.lam !== undefined ? T.wireHot : T.wire} step={1} />
        </g>
      ))}
      <Wire pts={[[L.bus, ROW_L.ce + 3], [L.bus, DIA.y], [DIA.x - 9, DIA.y]]} fill={T.wire} step={1} />
      <Diamond cx={DIA.x} cy={DIA.y} theme={T} />
      <PText x={DIA.x + 1} y={ROW_CAP} text="CE+λ||W||²" fill={T.loss} anchor="middle" />
      <PText x={DIA.x + 1} y={ROW_RES} text={`~${total.toFixed(1)}`} fill={T.loss} anchor="middle" />
      <PText x={DIA.x + 1} y={ROW_PARAM} text="init" fill={T.textDim} anchor="middle" />
      <PText x={L.name} y={ROW_CAP} text={`gate: test acc, M ${fmt2(RPP_GATE.M)}, L ${fmt2(RPP_GATE.L)}`} fill={T.textDim} />
      <PText x={L.name} y={ROW_RES} text="provisional: no M sweep yet" fill={T.loss} />

      {/* ——— inset: block 1 opened ——— */}
      <rect x={PANEL.x} y={PANEL.y} width={PANEL.w} height={PANEL.h} fill={T.panel} />
      <Frame x={PANEL.x} y={PANEL.y} w={PANEL.w} h={PANEL.h} fill={T.frame} />
      <PText x={20} y={ROW_TITLE} text="inside rpp 1: two paths, one sum" fill={T.wireHot} />
      <PText x={MX.x} y={ROW_TITLE} text="the conv inside the free matrix" fill={T.textDim} />

      {/* the block's whole input: the exact pooled digit (in_ch = 1) */}
      <Thumb x={XI.x} y={MID - 21} data={d.x14} n={14} px={3} theme={T} />
      <PText x={XI.x} y={ROW_CAPM} text="x: avg 14" fill={T.textDim} />
      <PText x={XI.x} y={LC - 3} text="conv 3×3" fill={T.text} />
      <PText x={XI.x} y={LF - 3} text="dense" fill={T.text} />
      {/* ONE input, two paths (no third branch: no skip) */}
      <Wire pts={[[XI.x + MAP + 3, MID], [74, MID], [74, LC], [XI.k - 3, LC]]} fill={T.wire} />
      <Wire pts={[[74, MID], [74, LF], [XI.s0 - 3, LF]]} fill={T.wire} />

      {/* conv path: a weight-shared 3×3 kernel (stand-in) */}
      <Thumb x={XI.k} y={LC - 6} data={d.k} n={3} px={4} theme={T} />
      <PText x={XI.k} y={LC + 8} text="init" fill={T.textDim} />
      <PText x={XI.k} y={ROW_PRICEC} text="λ 1e-4" fill={T.wireHot} />
      <Wire pts={[[XI.k + 14, LC], [XI.map - 3, LC]]} fill={T.wire} />
      <Thumb x={XI.map} y={LC - 21} data={d.c} n={14} px={3} theme={T} />
      <PText x={XI.map} y={ROW_CAPC} text="c" fill={T.textDim} />

      {/* free path: flatten 196 → Linear(196→1568) all-to-all → view [8,14,14] */}
      <rect x={XI.s0} y={LF - 21} width={1} height={MAP} fill={T.accentHi} />
      {Array.from({ length: 4 }, (_, i) => Array.from({ length: 6 }, (_, j) => (
        <Wire key={`fan${i}-${j}`} pts={[[XI.s0 + 2, LF - 15 + 10 * i], [XI.s1 - 3, LF - 18 + 7 * j]]} fill={T.wire} step={1} />
      )))}
      <PText x={XI.s0} y={ROW_PRICEF} text="λ 1e-2" fill={T.wireHot} />
      <rect x={XI.s1} y={LF - 21} width={1} height={MAP} fill={T.accentHi} />
      <PText x={XI.s0} y={ROW_CAPF} text="_{196}" fill={T.textDim} />
      <PText x={XI.s1} y={ROW_CAPF} text="_{1568}" fill={T.textDim} />
      <Wire pts={[[XI.s1 + 3, LF], [XI.map - 3, LF]]} fill={T.wire} />
      <Thumb x={XI.map} y={LF - 21} data={d.f} n={14} px={3} theme={T} />
      <PText x={XI.map} y={ROW_CAPF} text="f" fill={T.textDim} />

      {/* THE introduced op: the two tensors meet at one unweighted + */}
      <Wire pts={[[XI.map + MAP + 3, LC], [XI.plus, LC], [XI.plus, MID - 8]]} fill={T.wireHot} step={3} phase={frame} />
      <Wire pts={[[XI.map + MAP + 3, LF], [XI.plus, LF], [XI.plus, MID + 8]]} fill={T.wireHot} step={3} phase={frame} />
      <Node cx={XI.plus} cy={MID} glyph="+" theme={T} hot />
      <Wire pts={[[XI.plus + 7, MID], [XI.sum - 3, MID]]} fill={T.wire} />
      <Thumb x={XI.sum} y={MID - 21} data={d.sum} n={14} px={3} theme={T} />
      <PText x={XI.sum} y={ROW_CAPM} text="c + f" fill={T.textDim} />
      <Wire pts={[[XI.sum + MAP + 2, MID], [XI.out - 3, MID]]} fill={T.wire} />
      <Stack x={XI.out} y={MID - 21} s={MAP} theme={T} />
      <Thumb x={XI.out} y={MID - 21} data={d.out} n={14} px={3} theme={T} />
      <PText x={XI.out} y={ROW_CAPM} text="BN, ReLU" fill={T.textDim} />

      {/* exhibit: one rpp 2 channel pair of free.weight, the conv's taps lit */}
      <BandSquare x={MX.x} y={MX.y} s={7} px={MX.px} theme={T} />
      <PText x={MX.lab} y={MX.y} text="rpp 2, one" fill={T.textDim} />
      <PText x={MX.lab} y={MX.y + 10} text="channel pair" fill={T.textDim} />
      <PText x={MX.lab} y={MX.y + 20} text="49×49" fill={T.textDim} />
      <rect x={MX.lab} y={MX.y + 41} width={4} height={4} fill={T.panel} />
      <Frame x={MX.lab - 1} y={MX.y + 40} w={6} h={6} fill={T.frame} />
      <PText x={MX.lab + 6} y={MX.y + 40} text="free" fill={T.text} />
      <PText x={530} y={MX.y + 40} text="2 401" fill={T.textDim} anchor="end" />
      <rect x={MX.lab} y={MX.y + 51} width={4} height={4} fill={T.accentHi} />
      <PText x={MX.lab + 6} y={MX.y + 50} text="conv" fill={T.text} />
      <PText x={530} y={MX.y + 50} text="361" fill={T.textDim} anchor="end" />
      <PText x={MX.lab} y={MX.y + 70} text="rpp 1: 1 600" fill={T.textDim} />
      <PText x={MX.lab} y={MX.y + 80} text="of 38 416" fill={T.textDim} />

      <Lit x={XI.x} y={ROW_WARN} text="no local rpp_classifier checkpoint: kernel, maps and scores are seeded init stand-ins" fill={T.loss} />

      <PText x={16} y={FOOT} text={`bell: prior N(0,σ²), σ 70.7 vs 7.07, shared axis   bar: loss term at init   1 bar = 8 ch   map: ${T.name === "paper" ? "ink = high" : "dark = low"}`} fill={T.textDim} />
    </g>
  );
}

// ————— card: the band inside the dense block + the two priors —————
export function RppCard({ theme }: { theme: Theme }) {
  const T = theme;
  const rows = [
    { y: 12, name: "conv", lam: "λ 1e-4", sw: T.accentHi, lambda: RPP_LAMBDA.conv },
    { y: 46, name: "free", lam: "λ 1e-2", sw: T.panel, lambda: RPP_LAMBDA.free },
  ];
  return (
    <g>
      <rect x={0} y={0} width={RPP_CARD_VIEW.w} height={RPP_CARD_VIEW.h} fill={T.ground} />
      <BandSquare x={6} y={6} s={7} px={2} theme={T} />
      {rows.map((r) => (
        <g key={r.name}>
          {r.name === "free" && <Frame x={111} y={r.y} w={6} h={6} fill={T.frame} />}
          <rect x={112} y={r.y + 1} width={4} height={4} fill={r.sw} />
          <PText x={118} y={r.y} text={r.name} fill={T.text} />
          <PText x={146} y={r.y} text={r.lam} fill={T.wireHot} />
          <Bell x={112} y={r.y + 11} w={74} h={14} lambda={r.lambda} range={100} peak={12} theme={T} />
        </g>
      ))}
      <PText x={112} y={90} text="361 / 2 401" fill={T.textDim} />
    </g>
  );
}

// ————— registry defs (structurally index.tsx's private DiagramDef) —————
interface RppDef {
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

export const RPP_DEFS: Record<string, RppDef> = {
  rpp_classifier: {
    view: RPP_VIEW,
    title: "rpp_classifier — a conv and a dense layer, summed; the loss prefers the conv",
    truth:
      "Drawn from the code: each block adds a 3×3 conv path and a dense path over the flattened map and applies one BN+ReLU to the sum (no gate, no skip); the training loss charges conv weights λ 1e-4 and dense weights λ 1e-2, Gaussian priors with σ 70.7 vs 7.07. Exact: every shape and parameter count, the avg-pooled MNIST test digit, the band the conv occupies inside the dense matrix (361 of 2 401 per rpp 2 channel pair) and the loss terms at init (seed 0), where the free prior (7.84) outweighs the CE. There is no local rpp_classifier checkpoint, so the kernel, maps and scores are seeded init stand-ins (a random dense layer scrambles space, which is why f looks like noise while c keeps the digit); eval loss is CE alone, nothing logged says which path wins, the .80 accuracy bar is provisional, and zero padding and pooling make the translation symmetry approximate.",
    render: ({ theme, still }) => <RppDiagram theme={theme} still={still} />,
    card: { view: RPP_CARD_VIEW, render: ({ theme }) => <RppCard theme={theme} /> },
    badge: "structure exact; init stand-ins",
  },
};
