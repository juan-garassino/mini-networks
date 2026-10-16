"use client";

// Tabular family — rows of 4 standardized Iris features instead of images.
//   tabular_classifier  models/tabular/model.py → core/blocks/mlp.py
//                       MLP(4, 64, 3, layers=3): x [B,4] → Linear 4→64 → ReLU
//                       → Linear 64→64 → ReLU → h2 [B,64] → Linear 64→3 →
//                       logits. An atom: it introduces `mlp` (every input
//                       wired to every unit), so the dense fan is the hot mark.
//   tabular_diffusion   models/tabular_diffusion/model.py — the parent DDPM
//                       (diffusion.tsx) on a 4-number row: T=200, betas
//                       linspace(1e-4·5, 0.02·5), ε-MSE; the denoiser is a
//                       plain MLP 4→128→128→4 whose forward(x, t) IGNORES t
//                       (no time embedding). Introduces nothing: the hot mark
//                       is the composition seam — the real row riding the
//                       inherited chain into the t-blind MLP.
//
// REAL (data/tabular_*-champion.ts, local champions, CPU inference only):
//   TAB — 8 test rows (z-scores), the 64 units of h2 after ReLU (nibbles over
//         [0, TAB_HIDDEN_MAX]), softmax, argmax (test row 10 is a real miss),
//         test accuracy on all 30 test rows. CE here = mean −log p[y] over
//         these 8 rows, computed from TAB_PROBS.
//   TDIFF — the champion's own infer(): 8 seeded reverse trajectories, read
//         at the chain's own columns (TRAJ[t] sits at ᾱ[t−1] = abarT(ab, t)).
//         They diverge to |x| = 106 (TDIFF_DIVERGED) — drawn as evidence.
// EXACT (computed here): the forward chain of TDIFF_REAL[6] (test row 20) with
//   the real T=200 schedule and one seeded ε (math.ts gaussian, SEED 5).
// NOT EXPORTED (drawn as structure / left empty): h1, every weight, the
//   denoiser's ε̂ at any t, its eval MSE — the MSE diamond carries no value.
import { useEffect, useMemo, useState, type MutableRefObject, type PointerEvent, type ReactNode } from "react";
import { TAB_CLASS_NAMES, TAB_HIDDEN, TAB_HIDDEN_MAX, TAB_PRED, TAB_PROBS, TAB_TEST_ACC, TAB_X, TAB_Y } from "../data/tabular_classifier-champion";
import { TDIFF_DIVERGED, TDIFF_MAX_ABS, TDIFF_REAL, TDIFF_T, TDIFF_TRAJ } from "../data/tabular_diffusion-champion";
import { abarT, addNoise, alphaBar, gaussian, unNib } from "../math";
import { textWidth } from "../pixel-font";
import { Bars, Diamond, Frame, PText, Wire } from "../prims";
import { useTick } from "../tick";
import { heatIndex, rampIndex, type Theme } from "../themes";
import type { KeyHandler } from "./types";

export const TAB_VIEW = { w: 560, h: 316 };
export const TAB_CARD_VIEW = { w: 190, h: 94 }; // captions moved to card.caption

/** house number format: two decimals, leading zero dropped under 1 */
const fmt = (v: number) => (v >= 0.995 ? "1.00" : v.toFixed(2).replace(/^0/, ""));
const maxAbs = (a: ArrayLike<number>) => {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]));
  return m;
};

/**
 * A 4-number feature row as a glyph: 4 gapless cells in the data ramp
 * (z-score / 3 → −1..1), with the Thumb conventions — a 1-px frame ring
 * outside, the paper +2,+2 shadow. `vertical` stacks the cells (the row lifted
 * out as a [4] tensor); `empty` paints panel cells (a value not exported).
 */
function RowGlyph({ x, y, v, cw, ch, theme: T, vertical = false, empty = false }: {
  x: number; y: number; v: ArrayLike<number>; cw: number; ch: number; theme: Theme; vertical?: boolean; empty?: boolean;
}) {
  const n = v.length;
  const W = vertical ? cw : cw * n, H = vertical ? ch * n : ch;
  const cells: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    cells.push(
      <rect key={i} x={vertical ? x : x + i * cw} y={vertical ? y + i * ch : y} width={cw} height={ch}
        fill={empty ? T.panel : T.ramp[rampIndex(v[i] / 3)]} />,
    );
  }
  return (
    <g>
      {T.shadow && <rect x={x + 2} y={y + 2} width={W} height={H} fill={T.shadow} />}
      {cells}
      <path d={`M${x - 1} ${y - 1}h${W + 2}v${H + 2}h${-(W + 2)}z M${x} ${y}v${H}h${W}v${-H}z`} fill={T.frame} fillRule="evenodd" />
    </g>
  );
}

/** Append one row of heat cells (values 0..1) to 8 per-level path strings, runs merged. */
function heatRow(ds: string[], vals: ArrayLike<number>, x: number, y: number, cw: number, ch: number) {
  let c = 0;
  while (c < vals.length) {
    const lvl = heatIndex(vals[c]);
    let e = c + 1;
    while (e < vals.length && heatIndex(vals[e]) === lvl) e++;
    ds[lvl] += `M${x + c * cw} ${y}h${(e - c) * cw}v${ch}h${-(e - c) * cw}z`;
    c = e;
  }
}

// ———————————————————— tabular_classifier: full 560×316 ————————————————————
// The 8 rows run straight across: table → (selected row through the dense
// layers) → real h2 matrix → 3 softmax tracks → one CE diamond. Both Linears
// between x and h2 are the introduced mlp; the first (4→64) gets the room so
// every input-to-unit line can be followed.
const RY = [52, 74, 96, 134, 156, 178, 216, 238] as const; // row tops, 18 tall, pitch 22
const ROW_H = 18, CELL_W = 14;
const ROW_HEAD = 14, ROW_COL = 26, LABEL_Y = 204, ROW_KEY = 272;
const CY = 165;                                            // centre of the versicolor group = the lifted row's spine
const ROW_ARCH = 122;                                      // x / h1 / h2 names share the "versicolor" label row, just over the blocks
const X = {
  tab: 16, elbowIn: 80, vec: 88, h1: 152, h2: 186, elbowOut: 203, mat: 212,
  trk: [412, 430, 448], p: 467, miss: 482, bus: 506,
};
const MAT_W = 192;                                         // 64 units × 3 px
const TRK_W = 16;
const DIA = { cx: 530, cy: CY };
const VEC_TOP = CY - 32;                                   // 4 cells × 16 = 64 tall, centred on CY
const BAR_H = 64;
const TAB_DEFAULT = 3;                                     // test row 10 — the real miss
const ABBR = ["SL", "SW", "PL", "PW"];
const SHORT = ["set", "ver", "vir"];

function groups(): { cls: number; first: number; last: number }[] {
  const out: { cls: number; first: number; last: number }[] = [];
  TAB_Y.forEach((y, r) => {
    const g = out[out.length - 1];
    if (g && g.cls === y) g.last = r; else out.push({ cls: y, first: r, last: r });
  });
  return out;
}

function TabClassifierDiagram({ theme: T, still, keys: keysRef }: { theme: Theme; still: boolean; keys?: MutableRefObject<KeyHandler | null> }) {
  const [sel, setSel] = useState(TAB_DEFAULT);
  const s = still ? TAB_DEFAULT : sel;
  const frame = useTick(3, 3, still);
  const d = useMemo(() => {
    const hidden = TAB_HIDDEN.map((h) => Array.from(unNib(h, 0, TAB_HIDDEN_MAX), (v) => v / TAB_HIDDEN_MAX));
    const heat: string[] = Array(8).fill("");
    hidden.forEach((h, r) => heatRow(heat, h, X.mat, RY[r], 3, ROW_H));
    let ce = 0;
    for (let r = 0; r < TAB_Y.length; r++) ce += -Math.log(Math.max(1e-12, TAB_PROBS[r][TAB_Y[r]]));
    return { heat, ce: ce / TAB_Y.length, groups: groups() };
  }, []);

  useEffect(() => {
    if (!keysRef || still) return;
    keysRef.current = (e) => {
      if (e.key === "ArrowUp") { setSel((v) => Math.max(0, v - 1)); return true; }
      if (e.key === "ArrowDown") { setSel((v) => Math.min(RY.length - 1, v + 1)); return true; }
      return false;
    };
    return () => { keysRef.current = null; };
  }, [keysRef, still]);

  const ry = RY[s];
  const rc = ry + 9;                                       // a row's centre line
  // the 4 input cells' centres = the sources of both fans' lanes
  const lane = [0, 1, 2, 3].map((i) => VEC_TOP + 8 + i * 16);
  // fan 1: Linear(4→64) — 4 inputs × 6 anchors on h1, solid hot (the introduced mlp)
  const dst1 = Array.from({ length: 6 }, (_, j) => VEC_TOP + 7 + j * 10);
  const fan1 = { x0: X.vec + CELL_W + 2, x1: X.h1 - 3 };
  const fan2 = { x0: X.h1 + 10, x1: X.h2 - 3 };
  const accText = `test acc ${fmt(TAB_TEST_ACC)} = ${Math.round(TAB_TEST_ACC * 30)}/30 rows`;

  return (
    <g>
      <rect x={0} y={0} width={TAB_VIEW.w} height={TAB_VIEW.h} fill={T.ground} />

      {/* stage headers + column headers (one row each) */}
      <PText x={X.tab} y={ROW_HEAD} text="iris test rows" fill={T.textDim} />
      <PText x={X.vec} y={ROW_HEAD} text="fully connected" fill={T.wireHot} />
      <PText x={X.mat} y={ROW_HEAD} text="h2 after ReLU, real" fill={T.textDim} />
      <PText x={X.trk[0]} y={ROW_HEAD} text="softmax" fill={T.textDim} />
      {ABBR.map((a, f) => <PText key={a} x={X.tab + f * CELL_W + CELL_W / 2} y={ROW_COL} text={a} fill={T.textDim} anchor="middle" />)}
      <PText x={X.mat} y={ROW_COL} text="_{0}" fill={T.textDim} />
      <PText x={X.mat + MAT_W} y={ROW_COL} text="_{63}" fill={T.textDim} anchor="end" />
      {SHORT.map((c, k) => <PText key={c} x={X.trk[k] + TRK_W / 2} y={ROW_COL} text={c} fill={T.textDim} anchor="middle" />)}
      <PText x={X.p} y={ROW_COL} text="p" fill={T.textDim} />

      {/* class group labels + the h2 matrix panels (one per species) */}
      {d.groups.map((g) => {
        const top = RY[g.first], bot = RY[g.last] + ROW_H;
        return (
          <g key={g.cls}>
            <PText x={X.tab} y={top - 12} text={TAB_CLASS_NAMES[g.cls]} fill={T.textDim} />
            {T.shadow && <rect x={X.mat + 2} y={top + 2} width={MAT_W} height={bot - top} fill={T.shadow} />}
            <rect x={X.mat} y={top} width={MAT_W} height={bot - top} fill={T.panel} />
          </g>
        );
      })}
      {d.heat.map((p, i) => (p ? <path key={i} d={p} fill={T.heat[i]} /> : null))}
      {d.groups.map((g) => {
        const top = RY[g.first], bot = RY[g.last] + ROW_H;
        return <Frame key={`f${g.cls}`} x={X.mat - 1} y={top - 1} w={MAT_W + 2} h={bot - top + 2} fill={T.frame} />;
      })}

      {/* the 8 rows: input z-scores, matrix → 3 tracks, p, comb to the loss */}
      {RY.map((y, r) => {
        const p = TAB_PROBS[r];
        const pred = TAB_PRED[r];
        const miss = pred !== TAB_Y[r];
        const pTxt = fmt(p[pred]);
        const combFrom = miss ? X.miss + textWidth("miss") + 3 : X.p + textWidth(pTxt) + 3;
        return (
          <g key={r} onClick={still ? undefined : () => setSel(r)} style={still ? undefined : { cursor: "pointer" }}>
            <RowGlyph x={X.tab} y={y} v={TAB_X[r]} cw={CELL_W} ch={ROW_H} theme={T} />
            <Wire pts={[[X.mat + MAT_W + 2, y + 9], [X.trk[0] - 3, y + 9]]} fill={T.wire} />
            {[0, 1, 2].map((k) => (
              <g key={k}>
                <rect x={X.trk[k]} y={y + 7} width={TRK_W} height={4} fill={T.panel} />
                <rect x={X.trk[k]} y={y + 7} width={Math.max(1, Math.round(p[k] * TRK_W))} height={4} fill={k === pred ? T.accentHi : T.accent} />
              </g>
            ))}
            {/* argmax label: wireHot on the selected (drawn) row, textDim on the other seven */}
            <PText x={X.p} y={y + 6} text={pTxt} fill={r === s ? T.wireHot : T.textDim} />
            {miss && (
              <>
                <Frame x={X.trk[0] - 2} y={y + 5} w={X.trk[2] + TRK_W + 2 - (X.trk[0] - 2)} h={8} fill={T.loss} />
                <PText x={X.miss} y={y + 6} text="miss" fill={T.loss} />
              </>
            )}
            <Wire pts={[[combFrom, y + 9], [X.bus - 1, y + 9]]} fill={T.wire} />
          </g>
        );
      })}

      {/* the ONE hot frame: the selected row */}
      <Frame x={X.tab - 2} y={ry - 2} w={4 * CELL_W + 4} h={ROW_H + 4} fill={T.wireHot} />

      {/* the selected row lifted out as the [4] tensor */}
      <PText x={X.vec + CELL_W / 2} y={ROW_ARCH} text="x" fill={T.textDim} anchor="middle" />
      <PText x={X.h1 + 4} y={ROW_ARCH} text="h1" fill={T.textDim} anchor="middle" />
      <PText x={X.h2 + 4} y={ROW_ARCH} text="h2" fill={T.textDim} anchor="middle" />
      <RowGlyph x={X.vec} y={VEC_TOP} v={TAB_X[s]} cw={CELL_W} ch={16} theme={T} vertical />
      <Wire pts={[[X.tab + 4 * CELL_W + 3, rc], [X.elbowIn, rc], [X.elbowIn, CY], [X.vec - 3, CY]]} fill={T.wireHot} step={3} phase={frame} />

      {/* fan 1: Linear(4→64) — every input reaches every unit, the introduced mlp (solid hot) */}
      {lane.flatMap((sy, i) => dst1.map((dy, j) => (
        <Wire key={`a${i}-${j}`} pts={[[fan1.x0, sy], [fan1.x1, dy]]} fill={T.wireHot} step={1} />
      )))}
      <Bars x={X.h1} y={VEC_TOP} bars={2} h={BAR_H} theme={T} bw={3} gap={2} />
      {/* fan 2: Linear(64→64) — the same all-to-all, drawn quiet */}
      {lane.flatMap((sy, i) => lane.map((dy, j) => (
        <Wire key={`b${i}-${j}`} pts={[[fan2.x0, sy], [fan2.x1, dy]]} fill={T.wire} step={2} />
      )))}
      <Bars x={X.h2} y={VEC_TOP} bars={2} h={BAR_H} theme={T} bw={3} gap={2} />
      {/* h2 (structure) → its real values: the selected row of the matrix */}
      <Wire pts={[[X.h2 + 10, CY], [X.elbowOut, CY], [X.elbowOut, rc], [X.mat - 3, rc]]} fill={T.wireHot} step={3} phase={frame} />

      {/* channel subscripts on one row: 4 → 64 → 64 → 3 */}
      <PText x={X.vec + CELL_W / 2} y={LABEL_Y} text="_{4}" fill={T.textDim} anchor="middle" />
      <PText x={X.h1 + 4} y={LABEL_Y} text="_{64}" fill={T.textDim} anchor="middle" />
      <PText x={X.h2 + 4} y={LABEL_Y} text="_{64}" fill={T.textDim} anchor="middle" />
      <PText x={X.trk[1] + TRK_W / 2} y={LABEL_Y} text="_{3}" fill={T.textDim} anchor="middle" />
      <PText x={X.vec} y={RY[6] + 6} text="h1 not exported" fill={T.textDim} />

      {/* every row feeds the loss: comb → bus → CE */}
      <Wire pts={[[X.bus, RY[0] + 9], [X.bus, RY[RY.length - 1] + 9]]} fill={T.wire} step={1} />
      <Wire pts={[[X.bus + 1, CY], [DIA.cx - 8, CY]]} fill={T.wire} />
      <Diamond cx={DIA.cx} cy={DIA.cy} theme={T} />
      <PText x={DIA.cx + 1} y={DIA.cy + 10} text="CE" fill={T.loss} anchor="middle" />
      <PText x={DIA.cx + 1} y={DIA.cy + 20} text={fmt(d.ce)} fill={T.loss} anchor="middle" />
      <PText x={DIA.cx + 1} y={DIA.cy + 30} text={`${TAB_Y.length} rows`} fill={T.textDim} anchor="middle" />

      <PText x={X.tab} y={ROW_KEY} text="SL SW PL PW = sepal, petal length, width" fill={T.textDim} />
      <PText x={TAB_VIEW.w - 14} y={ROW_KEY} text={accText} fill={T.textDim} anchor="end" />
      <PText x={16} y={TAB_VIEW.h - 14} text={`cell: z-score −3 to +3   unit: ${T.name === "paper" ? "pale" : "dark"} = 0 after ReLU   1 bar = 32 channels   track = p`} fill={T.textDim} />
    </g>
  );
}

// ———————— tabular_classifier: card 190×104 — three species fingerprints ————————
// One 64×1 strip per row (unit k at x = 32 + 2k on every row), so the units a
// species shares line up into vertical bands; 3 stacked probability tracks.
const CRY = [12, 21, 30, 42, 51, 60, 72, 81] as const;
const CSTRIP = 32, CUNIT = 2, CROW = 6;
const CTRK = { x: 164, w: 22 };

function TabClassifierCard({ theme: T }: { theme: Theme }) {
  const heat = useMemo(() => {
    const ds: string[] = Array(8).fill("");
    TAB_HIDDEN.forEach((h, r) => {
      const v = Array.from(unNib(h, 0, TAB_HIDDEN_MAX), (x) => x / TAB_HIDDEN_MAX);
      heatRow(ds, v, CSTRIP, CRY[r], CUNIT, CROW);
    });
    return ds;
  }, []);
  return (
    <g>
      <rect x={0} y={0} width={TAB_CARD_VIEW.w} height={TAB_CARD_VIEW.h} fill={T.ground} />
      <PText x={4} y={2} text="x" fill={T.textDim} />
      <PText x={CSTRIP} y={2} text="h2: 64 units" fill={T.textDim} />
      <PText x={CTRK.x} y={2} text="p" fill={T.textDim} />
      {CRY.map((y, r) => <rect key={`bg${r}`} x={CSTRIP} y={y} width={64 * CUNIT} height={CROW} fill={T.panel} />)}
      {heat.map((p, i) => (p ? <path key={i} d={p} fill={T.heat[i]} /> : null))}
      {CRY.map((y, r) => {
        const pred = TAB_PRED[r];
        return (
          <g key={r}>
            {[0, 1, 2, 3].map((f) => <rect key={f} x={4 + f * 6} y={y} width={5} height={CROW} fill={T.ramp[rampIndex(TAB_X[r][f] / 3)]} />)}
            {[0, 1, 2].map((k) => (
              <g key={k}>
                <rect x={CTRK.x} y={y + 2 * k} width={CTRK.w} height={2} fill={T.panel} />
                <rect x={CTRK.x} y={y + 2 * k} width={Math.max(1, Math.round(TAB_PROBS[r][k] * CTRK.w))} height={2} fill={k === pred ? T.accentHi : T.accent} />
              </g>
            ))}
            {pred !== TAB_Y[r] && <Frame x={CTRK.x - 2} y={y - 2} w={CTRK.w + 4} h={CROW + 4} fill={T.loss} />}
          </g>
        );
      })}
    </g>
  );
}

// ———————————————————— tabular_diffusion: full 560×316 ————————————————————
// The parent's 7-column chain grid is shared by the forward chain on top and a
// log-|x| plot at the bottom: column t holds the real row's x_t AND the
// champion's reverse samples at exactly that noise level.
const COLS_T: readonly number[] = [0, 10, 25, 50, 100, 150, 200];
const CH = { y: 10, gw: 56, gh: 14, x0: 16, dx: 78 };
const dcx = (i: number) => CH.x0 + i * CH.dx + CH.gw / 2;   // 44 + 78i
const BUS = 46;
const XT = { x: 16, y: 76 };
const BAR_X = [90, 126], SLIVER = 162, BTOP = 62, BH = 42, SPINE = 82;
const EH = { x: 180, y: 64 }, EP = { x: 180, y: 96 };
const LOSS_X = 254;
const DDIA = { cx: 268, cy: 86 };
const DLABEL_Y = 108;
const NOTE_X = 300;
const STUB_X = 81, STUB_TOP = 112;   // t stub between x_t and the first bar, clear of the _{128} row
const PB = 282, OCT = 14, BAND_X = 36, BAND_R = 540;
const BRK_X = BAND_X + 3;   // real-row bracket: inside the band, clear of the axis ticks and the t = 0 dots
const ly = (v: number) => PB - Math.round((Math.log2(Math.max(v, 0.5)) + 1) * OCT);
const SEED = 5;            // gaussian(4, 5): the one fixed ε for the forward chain
const X0_ROW = 6;          // TDIFF_REAL[6] = Iris test row 20 (virginica)
// max |z| over the standardized Iris test split (field check, 2026-10-04); the
// 8 rows drawn as rings reach 2.2
const IRIS_ZMAX = 3.1;

/** paper-indexed t (0..200) → x on the shared grid, piecewise between columns */
function tToX(tt: number): number {
  for (let i = 0; i < COLS_T.length - 1; i++) {
    if (tt <= COLS_T[i + 1]) return Math.round(dcx(i) + ((tt - COLS_T[i]) / (COLS_T[i + 1] - COLS_T[i])) * CH.dx);
  }
  return dcx(COLS_T.length - 1);
}
function xToT(x: number): number {
  if (x <= dcx(0)) return 0;
  for (let i = 0; i < COLS_T.length - 1; i++) {
    if (x <= dcx(i + 1)) return COLS_T[i] + ((x - dcx(i)) / CH.dx) * (COLS_T[i + 1] - COLS_T[i]);
  }
  return COLS_T[COLS_T.length - 1];
}
const trajAt = (ct: number) => TDIFF_TRAJ[String(ct) as keyof typeof TDIFF_TRAJ];

function TabDiffusionDiagram({ theme: T, t, onT, still }: { theme: Theme; t: number; onT?: (t: number) => void; still: boolean }) {
  const frame = useTick(3, 3, still);
  const base = useMemo(() => {
    const x0 = Float32Array.from(TDIFF_REAL[X0_ROW]);
    const eps = gaussian(4, SEED);
    const ab = alphaBar(TDIFF_T);
    const chain = COLS_T.map((ct) => addNoise(x0, eps, abarT(ab, ct)));
    const rev = TDIFF_REAL.map((_, s) => COLS_T.map((ct) => maxAbs(trajAt(ct)[s])));
    const fwd = chain.map(maxAbs);
    const real = TDIFF_REAL.map(maxAbs);
    return { x0, eps, ab, chain, rev, fwd, real };
  }, []);
  const tt = Math.max(0, Math.min(TDIFF_T, Math.round(t / 5)));
  const abar = abarT(base.ab, tt);
  const xt = useMemo(() => addNoise(base.x0, base.eps, abar), [base, abar]);
  const nearest = COLS_T.reduce((b, v, i) => (Math.abs(v - tt) < Math.abs(COLS_T[b] - tt) ? i : b), 0);
  const xT = tToX(tt);
  const betaHi = TDIFF_T > 0 ? 1000 / TDIFF_T : 1;

  const scrub = (ev: PointerEvent<SVGRectElement>) => {
    const svg = ev.currentTarget.ownerSVGElement;
    const m = svg?.getScreenCTM();
    if (!svg || !m || !onT) return;
    onT(Math.max(1, xToT((ev.clientX - m.e) / m.a) * 5));
  };
  const headW = textWidth(`T ${tt}`) * 2;
  const bandTop = ly(IRIS_ZMAX);

  return (
    <g>
      <rect x={0} y={0} width={TAB_VIEW.w} height={TAB_VIEW.h} fill={T.ground} />

      {/* ——— forward chain q(x_t | x_0) on a real iris row ——— */}
      {COLS_T.map((ct, i) => {
        const x = CH.x0 + i * CH.dx;
        const g = Math.round(CH.gw * Math.sqrt(abarT(base.ab, ct)));
        return (
          <g key={ct} onClick={onT ? () => onT(Math.max(1, ct * 5)) : undefined} style={onT ? { cursor: "pointer" } : undefined}>
            <RowGlyph x={x} y={CH.y} v={base.chain[i]} cw={14} ch={CH.gh} theme={T} />
            {i === nearest && <Frame x={x - 2} y={CH.y - 2} w={CH.gw + 4} h={CH.gh + 4} fill={T.wireHot} />}
            <rect x={x} y={CH.y + CH.gh + 3} width={CH.gw} height={2} fill={T.panel} />
            {g > 0 && <rect x={x} y={CH.y + CH.gh + 3} width={g} height={2} fill={T.accent} />}
            <PText x={dcx(i)} y={31} text={String(ct)} fill={i === nearest ? T.wireHot : T.text} anchor="middle" />
            <Wire pts={[[dcx(i), 40], [dcx(i), BUS]]} fill={T.wire} />
            {i < COLS_T.length - 1 && <PText x={x + CH.gw + 11} y={CH.y + 3} text="→" fill={T.wire} anchor="middle" />}
          </g>
        );
      })}
      <Wire pts={[[dcx(0), BUS], [dcx(COLS_T.length - 1), BUS]]} fill={T.wire} />
      {/* the composition seam: the real row at level t rides the bus into the denoiser */}
      <Wire pts={[[xT, BUS], [dcx(0), BUS], [dcx(0), XT.y - 3]]} fill={T.wireHot} step={3} phase={frame} />
      <rect x={xT - 2} y={BUS - 2} width={5} height={5} fill={T.wireHot} />
      <rect x={xT} y={BUS} width={1} height={1} fill={T.ground} />
      {onT && (
        <rect
          x={dcx(0) - 6} y={BUS - 8} width={dcx(COLS_T.length - 1) - dcx(0) + 12} height={16} fill="transparent"
          style={{ cursor: "ew-resize", touchAction: "none" }}
          onPointerDown={(ev) => { ev.currentTarget.setPointerCapture(ev.pointerId); scrub(ev); }}
          onPointerMove={(ev) => { if (ev.buttons & 1) scrub(ev); }}
        />
      )}

      {/* ——— x_t → t-blind MLP 4→128→128→4 → ε̂ ——— */}
      <RowGlyph x={XT.x} y={XT.y} v={xt} cw={14} ch={CH.gh} theme={T} />
      <PText x={XT.x} y={94} text={`x_t=${fmt(Math.sqrt(abar))}x_0`} fill={T.text} />
      <PText x={XT.x} y={104} text={`+${fmt(Math.sqrt(1 - abar))}ε`} fill={T.text} />
      <Wire pts={[[XT.x + CH.gw + 2, SPINE], [BAR_X[0] - 2, SPINE]]} fill={T.accentLo} step={1} />
      <Bars x={BAR_X[0]} y={BTOP} bars={4} h={BH} theme={T} bw={3} gap={2} />
      <Wire pts={[[BAR_X[0] + 19, SPINE], [BAR_X[1] - 2, SPINE]]} fill={T.accentLo} step={1} />
      <Bars x={BAR_X[1]} y={BTOP} bars={4} h={BH} theme={T} bw={3} gap={2} />
      <Wire pts={[[BAR_X[1] + 19, SPINE], [SLIVER - 2, SPINE]]} fill={T.accentLo} step={1} />
      <rect x={SLIVER} y={BTOP} width={1} height={BH} fill={T.accentHi} />
      <Wire pts={[[SLIVER + 2, SPINE], [171, SPINE], [171, EH.y + 6], [EH.x - 3, EH.y + 6]]} fill={T.accentLo} step={1} />
      <PText x={BAR_X[0] + 9} y={DLABEL_Y} text="_{128}" fill={T.textDim} anchor="middle" />
      <PText x={BAR_X[1] + 9} y={DLABEL_Y} text="_{128}" fill={T.textDim} anchor="middle" />
      <PText x={SLIVER + 1} y={DLABEL_Y} text="_{4}" fill={T.textDim} anchor="middle" />

      {/* t is handed in and dropped: a stub that stops short of the spine, cut */}
      <rect x={STUB_X - 3} y={STUB_TOP} width={7} height={1} fill={T.wire} />
      <Wire pts={[[STUB_X, STUB_TOP + 2], [STUB_X, 124]]} fill={T.wire} step={1} />
      <PText x={STUB_X + 1} y={126} text="t" fill={T.text} anchor="middle" />
      <PText x={BAR_X[0]} y={126} text="ignored: no time embedding" fill={T.textDim} />

      {/* ε̂ (not exported) vs ε → MSE */}
      <RowGlyph x={EH.x} y={EH.y} v={[0, 0, 0, 0]} cw={14} ch={CH.gh} theme={T} empty />
      <PText x={EH.x} y={80} text="Ɛ" fill={T.text} />
      <PText x={EH.x + 10} y={80} text="not exported" fill={T.textDim} />
      <RowGlyph x={EP.x} y={EP.y} v={base.eps} cw={14} ch={CH.gh} theme={T} />
      <PText x={EP.x} y={112} text="ε ~ N(0,I)" fill={T.text} />
      <Wire pts={[[EH.x + CH.gw + 2, EH.y + 6], [LOSS_X, EH.y + 6], [LOSS_X, DDIA.cy], [DDIA.cx - 8, DDIA.cy]]} fill={T.wire} />
      <Wire pts={[[EP.x + CH.gw + 2, EP.y + 6], [LOSS_X, EP.y + 6], [LOSS_X, DDIA.cy + 1]]} fill={T.wire} />
      <Diamond cx={DDIA.cx} cy={DDIA.cy} theme={T} />
      <PText x={DDIA.cx + 1} y={DDIA.cy + 10} text="MSE" fill={T.loss} anchor="middle" />

      {/* the gate scores that one step, never a sample */}
      <PText x={NOTE_X} y={62} text="gate never samples:" fill={T.loss} />
      <PText x={NOTE_X} y={72} text="one-step noise MSE only" fill={T.loss} />
      <PText x={NOTE_X} y={82} text="M bar 1.0 = guess Ɛ = 0" fill={T.textDim} />
      <PText x={NOTE_X} y={98} text={`T ${tt}`} fill={T.wireHot} s={2} />
      <PText x={NOTE_X + headW + 6} y={105} text={`of ${TDIFF_T} steps, β ×${betaHi}`} fill={T.textDim} />

      {/* ——— the champion's own reverse chain, on the same columns ——— */}
      <PText x={16} y={140} text={`reverse ←: the champion's own infer() from t=${TDIFF_T}, ${TDIFF_REAL.length} seeded samples`} fill={T.textDim} />
      {TDIFF_DIVERGED && (
        <PText x={16} y={150} text={`chain diverges: |x| reaches ${Math.round(TDIFF_MAX_ABS)}, real iris rows stay under ${IRIS_ZMAX}`} fill={T.loss} />
      )}
      <rect x={BAND_X} y={bandTop} width={BAND_R - BAND_X} height={PB - bandTop + 1} fill={T.panel} />
      <rect x={BAND_X} y={PB + 1} width={BAND_R - BAND_X} height={1} fill={T.frame} />
      {[1, 10, 100].map((v) => (
        <g key={v}>
          <rect x={BAND_X - 3} y={ly(v)} width={2} height={1} fill={T.frame} />
          <PText x={BAND_X - 5} y={ly(v) - 3} text={String(v)} fill={T.textDim} anchor="end" />
        </g>
      ))}
      {COLS_T.map((ct, i) => (
        <g key={`ax${ct}`}>
          <rect x={dcx(i)} y={PB + 2} width={1} height={2} fill={T.frame} />
          <PText x={dcx(i) + 1} y={PB + 2} text={`_{${ct}}`} fill={i === nearest ? T.wireHot : T.textDim} anchor="middle" />
        </g>
      ))}
      {base.rev.map((line, s) => (
        <g key={`r${s}`}>
          <Wire pts={line.map((v, i) => [dcx(i), ly(v)] as const)} fill={T.ramp[6]} step={1} />
          {line.map((v, i) => <rect key={i} x={dcx(i) - 1} y={ly(v) - 1} width={3} height={3} fill={T.ramp[6]} />)}
        </g>
      ))}
      <Wire pts={base.fwd.map((v, i) => [dcx(i), ly(v)] as const)} fill={T.wireHot} step={1} />
      {base.fwd.map((v, i) => <rect key={`h${i}`} x={dcx(i) - 1} y={ly(v) - 1} width={3} height={3} fill={T.wireHot} />)}
      {/* bracket: the |x| range of the 8 real rows, inside the band beside t = 0 where samples should land */}
      <rect x={BRK_X} y={ly(Math.max(...base.real))} width={1} height={ly(Math.min(...base.real)) - ly(Math.max(...base.real)) + 1} fill={T.text} />
      <rect x={BRK_X} y={ly(Math.max(...base.real))} width={3} height={1} fill={T.text} />
      <rect x={BRK_X} y={ly(Math.min(...base.real))} width={3} height={1} fill={T.text} />
      <PText x={dcx(0)} y={ly(TDIFF_MAX_ABS) - 10} text={String(Math.round(TDIFF_MAX_ABS))} fill={T.loss} anchor="middle" />

      <PText x={16} y={TAB_VIEW.h - 14} text={`gauge = √ᾱ   line = max|x|, log   band = |z| ≤ ${IRIS_ZMAX} on the test split   bracket = ${TDIFF_REAL.length} real rows   1 bar = 32 channels`} fill={T.textDim} />
    </g>
  );
}

// ———————————— tabular_diffusion: card 190×104 — the escape ————————————
const CARD_T: readonly number[] = [0, 50, 100, 150, 200];
const ccx = (i: number) => 16 + i * 37;
const CPB = 88;
const cly = (v: number) => CPB - Math.round((Math.log2(Math.max(v, 0.5)) + 1) * 8);

function TabDiffusionCard({ theme: T, t }: { theme: Theme; t: number }) {
  const base = useMemo(() => {
    const x0 = Float32Array.from(TDIFF_REAL[X0_ROW]);
    const eps = gaussian(4, SEED);
    const ab = alphaBar(TDIFF_T);
    const chain = CARD_T.map((ct) => addNoise(x0, eps, abarT(ab, ct)));
    return {
      chain,
      fwd: chain.map(maxAbs),
      rev: TDIFF_REAL.map((_, s) => CARD_T.map((ct) => maxAbs(trajAt(ct)[s]))),
    };
  }, []);
  const tt = Math.max(0, Math.min(TDIFF_T, Math.round(t / 5)));
  const nearest = CARD_T.reduce((b, v, i) => (Math.abs(v - tt) < Math.abs(CARD_T[b] - tt) ? i : b), 0);
  const bandTop = cly(IRIS_ZMAX);
  return (
    <g>
      <rect x={0} y={0} width={TAB_CARD_VIEW.w} height={TAB_CARD_VIEW.h} fill={T.ground} />
      {CARD_T.map((ct, i) => {
        const x = 6 + i * 37;
        return (
          <g key={ct}>
            <RowGlyph x={x} y={6} v={base.chain[i]} cw={5} ch={5} theme={T} />
            {i === nearest && <Frame x={x - 2} y={4} w={24} h={9} fill={T.wireHot} />}
            <PText x={ccx(i)} y={14} text={`_{${ct}}`} fill={i === nearest ? T.wireHot : T.textDim} anchor="middle" />
            {i < CARD_T.length - 1 && <PText x={x + 28} y={5} text="→" fill={T.wire} anchor="middle" />}
          </g>
        );
      })}
      <rect x={4} y={bandTop} width={182} height={CPB - bandTop + 1} fill={T.panel} />
      {base.rev.map((line, s) => (
        <g key={s}>
          <Wire pts={line.map((v, i) => [ccx(i), cly(v)] as const)} fill={T.ramp[6]} step={1} />
          {line.map((v, i) => <rect key={i} x={ccx(i) - 1} y={cly(v) - 1} width={3} height={3} fill={T.ramp[6]} />)}
        </g>
      ))}
      <Wire pts={base.fwd.map((v, i) => [ccx(i), cly(v)] as const)} fill={T.wireHot} step={1} />
      {base.fwd.map((v, i) => <rect key={`h${i}`} x={ccx(i) - 1} y={cly(v) - 1} width={3} height={3} fill={T.wireHot} />)}
      <PText x={186} y={27} text={`max ${Math.round(TDIFF_MAX_ABS)}`} fill={T.loss} anchor="end" />
    </g>
  );
}

// Structurally the registry's DiagramDef (index.tsx keeps that interface private).
interface TabDef {
  view: { w: number; h: number };
  scrub?: boolean;
  interactive?: boolean;
  keysHint?: string;
  title: string;
  truth: string;
  render: (p: { theme: Theme; t: number; onT?: (t: number) => void; still: boolean; keys: MutableRefObject<KeyHandler | null> }) => ReactNode;
  card: { view: { w: number; h: number }; render: (p: { theme: Theme; t: number }) => ReactNode; caption?: string };
  badge: string;
}

export const TAB_DEFS: Record<string, TabDef> = {
  tabular_classifier: {
    view: TAB_VIEW,
    interactive: true,
    keysHint: "↑/↓ pick a row, or click one",
    title: "tabular_classifier — four measurements, every one wired to every unit",
    truth: "All real: 8 Iris test rows (test rows 0, 1, 2, 10, 11, 12, 20, 21; each feature is a z-score, standardized with the test split's own mean and std) through the local mini-tabular_classifier champion — the 64 units of its second hidden layer after ReLU (they cluster by species; 13 stay at 0 on all 8 rows), the softmax over the 3 species, and the cross-entropy .47 averaged over these 8 rows. Test row 10, a versicolor, is a real miss: it says virginica at .51. Test accuracy is .90 = 27 of the 30 test rows. Drawn from the code: 4 → 64 → ReLU → 64 → ReLU → 3, every input wired to every unit (4,675 parameters). The first hidden layer and the weights are not exported, so h1 and the fans are structure only.",
    badge: "real champion, acc .90",
    render: ({ theme, still, keys }) => <TabClassifierDiagram theme={theme} still={still} keys={keys} />,
    card: { view: TAB_CARD_VIEW, render: ({ theme }) => <TabClassifierCard theme={theme} />, caption: "one code per species" },
  },
  tabular_diffusion: {
    view: TAB_VIEW,
    scrub: true,
    title: "tabular_diffusion — the diffusion chain on a row of four numbers",
    truth: "Computed exactly here: the forward chain on a real Iris test row (test row 20, a virginica) with the model's own schedule — 200 steps, β 5e-4 → 0.1 (the 1e-4 → 0.02 range scaled by 1000/200) — one seeded ε, and the x_t mix. Real champion output: 8 seeded samples from the local mini-tabular_diffusion champion's own infer(), plotted as max |x| at the same noise levels as the chain columns. They leave the data band and reach |x| = 106, while real (standardized) iris rows stay under 3.1. Drawn from the code: the denoiser is a plain MLP 4 → 128 → 128 → 4 that is handed t and ignores it — there is no time embedding, so one function has to serve every noise level, and it under-predicts the noise. Its predicted noise and eval MSE are not exported, so ε̂ is drawn empty and the MSE diamond has no value. The quality gate scores that one-step noise MSE (pass under 1.0, the score of predicting ε̂ = 0) and never draws a sample, so it passes while sampling diverges.",
    badge: "real champion chain, diverges",
    render: ({ theme, t, onT, still }) => <TabDiffusionDiagram theme={theme} t={t} onT={onT} still={still} />,
    card: { view: TAB_CARD_VIEW, render: ({ theme, t }) => <TabDiffusionCard theme={theme} t={t} />, caption: "samples leave the data band" },
  },
};
