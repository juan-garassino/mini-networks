"use client";

// Alignment family: one LM, one prompt, three ways to turn a preference into
// a gradient. Storyboard "one ledger, three verdicts" (dossier/alignment.md):
// the TOP band (policy bars + word scorer) is pixel-identical in all three;
// the middle band holds the samples and each model's preference → signal
// logic; the bottom band holds the frozen π_ref twin, the update, the Diamond.
//   rlhf  models/rlhf/{config,model,trainer}.py: RLHFConfig TransformerLM
//         (V 65, d_model 64, 2 heads × 32, 2 post-LN blocks, d_ff 128; 79,553
//         params), CE-pretrained from scratch; rollouts scored by the
//         shakespearean_score WORD HEURISTIC (RewardModel exists, never
//         called); A = r − 0.5 broadcast over all T−1 log-probs (prompt too);
//         ρ = exp(log π − log π_ref) vs the FROZEN ref, clipped [.8, 1.2];
//         loss = −mean min(ρA, clip(ρ)A) + 0.1·mean(log π_ref − log π) (the
//         code's sign: that term is −KL, its gradient raises log π). No value head.
//   grpo  models/grpo: rlhf's loop, but ONE prompt per iteration, G = 4
//         (S: 2) samples, A_i = (r_i − mean)/(std_unbiased + 1e−6); the clip
//         and the 0.1 term unchanged. No local checkpoint.
//   dpo   models/dpo: two on-policy samples per prompt, the heuristic only
//         SORTS them (ties skipped); m = (lp⁺ − lr⁺) − (lp⁻ − lr⁻) with SUMMED
//         log-probs; loss −log σ(0.1·m) = ln 2 while π = π_ref. No local
//         checkpoint.
// REAL (data/rlhf-champion.ts): the champion's 64-char sample after
// "Thou art " — 4 newlines its decode dropped (id 0 = PAD = '\n') are put
// back at steps 14, 31, 32, 33 so every char lines up with RLHF_P_CHOSEN —
// the per-char p, the word bands, r = .025, A = −.475, clip and kl constants.
// STAND-IN (same file, exporter `_rlhf_stand_in`): the rlhf champion run
// through grpo's and dpo's rollout code on the trainers' first prompt — the
// 4-sample group with its scores and exact advantages, the dpo pair with its
// scores, tie count and summed log-probs. ILLUSTRATIVE (labelled on the page):
// every ρ dot (π_ref is not saved). EXACT maths: the ≥ .38 clip bound (A < 0),
// the −log σ(.1m) curve, ln 2.
import { useMemo, type MutableRefObject, type ReactNode } from "react";
import {
  RLHF_GENERATED, RLHF_GROUP, RLHF_GROUP_ADV, RLHF_GROUP_REWARDS, RLHF_KL_COEF, RLHF_PAIR, RLHF_PAIR_LOGP,
  RLHF_PAIR_REWARDS, RLHF_PAIR_TIED, RLHF_P_CHOSEN, RLHF_PPO_CLIP, RLHF_PROMPT, RLHF_REWARD, RLHF_REWARD_PARTS,
  RLHF_STANDIN_PROMPT, RLHF_WORDS,
} from "../data/rlhf-champion";
import { gaussian } from "../math";
import { textWidth } from "../pixel-font";
import { Bars, Diamond, Frame, Node, PText, Wire } from "../prims";
import { useTick } from "../tick";
import type { Theme } from "../themes";
import type { KeyHandler } from "./types";

export const ALIGN_VIEW = { w: 560, h: 316 };
export const ALIGN_CARD_VIEW = { w: 190, h: 104 };
export type AlignName = "rlhf" | "grpo" | "dpo";

type Pt = [number, number];
const show = (ch: string) => (ch === " " ? "·" : ch === "\n" ? "↵" : ch);
/** house format: leading zero dropped under 1, a real minus sign */
const fmt = (v: number, d = 2) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(d).replace(/^0(?=\.)/, "");
const r2 = (v: number) => (v === 0 ? "0" : fmt(v));

// ————— the shared grid (dossier "Shared grid"; every mark sits on these) —————
const ROW_HDR = 12, LM_Y = 26, LM_H = 24, LM_CY = 38;
/** channel subscripts under the policy bars (mini face sits 4 px below y) */
const ROW_MINI = LM_Y + LM_H;
/** emb 64 · attn 2×32 · ffn 128 · attn · ffn · lm 64→65, at 1 bar = 32 channels */
const LM_BARS: readonly { x: number; n: number; sub?: string }[] = [
  { x: 16, n: 2, sub: "64" }, { x: 30, n: 2 }, { x: 41, n: 4, sub: "128" }, { x: 65, n: 2 }, { x: 76, n: 4, sub: "128" }, { x: 100, n: 2, sub: "65" },
];
const LM_SPINE: readonly (readonly [number, number])[] = [[25, 28], [60, 63], [95, 98]];
const DROP_X = 114, WORDS_X = 198, R_X = 290;
/** the scorer spans the whole top band; x ≥ SC_RX is its per-model readout column */
const SC = { x: 136, y: 22, w: 408, h: 44 };
const SC_DIV = 406, SC_RX = 412;
const BAND_Y = [26, 36, 46] as const;
const BAND = { label: 140, value: 262, track: 268, trackW: 48, weight: 322, contrib: 398 };
const R_ROW_Y = 56;
const LINE_Y = [76, 108] as const;            // rlhf's two sample lines, dpo's pair
const ROW_Y4 = [76, 92, 108, 124] as const;   // grpo's group of 4
const PITCH = 6, COLS = 37;
const colX = (c: number) => 16 + PITCH * c;
const LOGIC_X = 252;                          // the middle band's logic column
const NOTE_Y = 140, LB_HDR = 156;
const TWIN = { x: 13, y: 170, w: 98, h: 32 };
const TRACK = { x: 124, w: 288, hi: 178, mid: 186, lo: 194 };
const DIA = { cx: 528, cy: 186 };
const ILLU_Y = 204;
const ROWS = [222, 232, 242, 252] as const;
const LINEAGE_Y = 272;
const FOOTER_Y = ALIGN_VIEW.h - 14;

// ————— real champion sample (data/rlhf-champion.ts) —————
/** steps where decode dropped '\n' (id 0 doubles as PAD) */
const NL = [14, 31, 32, 33];
const P0 = RLHF_PROMPT.length; // 9 prompt chars before the 64 sampled ones
type Band = "archaic" | "suffix" | "common" | "none";

function decodeSample() {
  let j = 0;
  const raw = Array.from({ length: RLHF_P_CHOSEN.length }, (_, i) => (NL.includes(i) ? "\n" : RLHF_GENERATED[j++] ?? ""));
  const spans: { a: number; b: number; band: Band }[] = [];
  let k = 0;
  for (const m of raw.join("").matchAll(/[A-Za-z']+/g)) {
    const a = m.index ?? 0;
    spans.push({ a, b: a + m[0].length - 1, band: (RLHF_WORDS[k]?.[1] ?? "none") as Band });
    k++;
  }
  return { raw, spans, seq: [...RLHF_PROMPT, ...raw] };
}

/** sample position → (line, column) on the 37-column grid */
const at = (pos: number) => ({ line: Math.floor(pos / COLS), col: pos % COLS });
const bandFill = (T: Theme, b: Band) => (b === "archaic" ? T.ramp[7] : b === "suffix" ? T.ramp[5] : b === "common" ? T.ramp[6] : T.frame);
const BANDS: readonly { label: string; weight: string; band: Band }[] = [
  { label: "real words", weight: "×.25", band: "common" },
  { label: "-eth -est 'st 'd", weight: "×4×.25", band: "suffix" },
  { label: "archaic", weight: "×5×.5", band: "archaic" },
];
/** shakespearean_score's three terms: saturation in [0,1] and contribution */
function rewardTerms() {
  const p = RLHF_REWARD_PARTS;
  const sat = [p.realFrac, Math.min(1, 4 * p.suffixFrac), Math.min(1, 5 * p.archaic)];
  const w = [0.25, 0.25, 0.5];
  return { frac: [p.realFrac, p.suffixFrac, p.archaic], sat, contrib: sat.map((s, i) => s * w[i]) };
}

const A_RLHF = RLHF_REWARD - 0.5;                                  // −.475, exact
const CLIP_FLOOR = (1 - RLHF_PPO_CLIP) * Math.abs(A_RLHF);         // ≥ .38 since A < 0
/** illustrative ratios: π_ref is not saved (seed 26 → 5 tokens under .8) */
const RHO_SEED = 26;
/** grpo stand-in: r tracks are 40 px = .25 (the scores are small) */
const R_TRACK = { w: 40, full: 0.25 };
const rTrack = (r: number) => (r > 0 ? Math.max(1, Math.round((r / R_TRACK.full) * R_TRACK.w)) : 0);
const A_PX = 20;                                                    // 20 px = 1 advantage unit
const softplus = (z: number) => Math.log1p(Math.exp(z));            // −log σ(x) = softplus(−x)
const DPO_BETA = 0.1;
const minus = (v: number) => (v < 0 ? "−" : "") + Math.abs(Math.round(v));

// ————— top band: identical pixels in all three —————
function TopBand({ T, name }: { T: Theme; name: AlignName }) {
  const terms = useMemo(() => rewardTerms(), []);
  const header = name === "rlhf" ? "reward r: a word score, not a model"
    : name === "grpo" ? "reward r_i: the same word score, once per response"
    : "reward: the same word score, used only to sort";
  const realWords = RLHF_WORDS.filter((w) => w[1] !== "none").map((w) => w[0]);
  return (
    <g>
      <PText x={16} y={ROW_HDR} text="policy π, CE-pretrained" fill={T.text} />
      {LM_BARS.map((b, i) => <Bars key={i} x={b.x} y={LM_Y} bars={b.n} h={LM_H} theme={T} bw={3} gap={2} />)}
      {LM_SPINE.map(([a, b], i) => <Wire key={i} pts={[[a, LM_CY], [b, LM_CY]]} fill={T.accentLo} step={1} />)}
      {LM_BARS.map((b, i) => b.sub && <PText key={`s${i}`} x={b.x} y={ROW_MINI} text={`_{${b.sub}}`} fill={T.textDim} />)}
      <Wire pts={[[109, LM_CY], [DROP_X, LM_CY], [DROP_X, 73]]} fill={T.wire} />

      <PText x={SC.x} y={ROW_HDR} text={header} fill={T.text} />
      <rect x={SC.x} y={SC.y} width={SC.w} height={SC.h} fill={T.panel} />
      <Frame x={SC.x} y={SC.y} w={SC.w} h={SC.h} fill={T.frame} />
      <rect x={SC_DIV} y={SC.y + 3} width={1} height={SC.h - 6} fill={T.frame} />
      {BANDS.map((b, i) => {
        const y = BAND_Y[i];
        const lit = name === "rlhf";
        const fill = lit ? Math.round(terms.sat[i] * BAND.trackW) : 0;
        return (
          <g key={i}>
            <PText x={BAND.label} y={y} text={b.label} fill={T.textDim} />
            {lit && <PText x={BAND.value} y={y} text={fmt(terms.frac[i])} fill={T.text} anchor="end" />}
            <rect x={BAND.track} y={y + 2} width={BAND.trackW} height={3} fill={T.ground} />
            {fill > 0 && <rect x={BAND.track} y={y + 2} width={fill} height={3} fill={bandFill(T, b.band)} />}
            <PText x={BAND.weight} y={y} text={b.weight} fill={T.textDim} />
            {lit && <PText x={BAND.contrib} y={y} text={terms.contrib[i] === 0 ? "0" : fmt(terms.contrib[i], 3)} fill={T.text} anchor="end" />}
          </g>
        );
      })}
      {name === "rlhf" && <PText x={BAND.weight} y={R_ROW_Y} text={`r = ${fmt(RLHF_REWARD, 3)}`} fill={T.text} />}
      {name === "grpo" && <PText x={BAND.weight} y={R_ROW_Y} text="one r_i each" fill={T.textDim} />}
      {name === "dpo" && <PText x={BAND.weight} y={R_ROW_Y} text="a rank only" fill={T.textDim} />}

      {/* readout column: what the scorer saw (real sample / stand-in group / stand-in pair) */}
      {name === "rlhf" && (
        <g>
          <PText x={SC_RX} y={BAND_Y[0]} text={`${RLHF_WORDS.length} words`} fill={T.text} />
          <PText x={SC_RX} y={BAND_Y[1]} text={`${realWords.length} real: `} fill={T.textDim} />
          <PText x={SC_RX + textWidth(`${realWords.length} real: `) + 1} y={BAND_Y[1]} text={realWords.join(" ")} fill={bandFill(T, "common")} />
          <PText x={SC_RX} y={BAND_Y[2]} text={`${RLHF_WORDS.length - realWords.length} others`} fill={T.textDim} />
        </g>
      )}
      {name === "grpo" && (
        <g>
          <PText x={SC_RX} y={BAND_Y[0]} text={`G = ${RLHF_GROUP.length} samples`} fill={T.text} />
          <PText x={SC_RX} y={BAND_Y[1]} text="of 1 prompt" fill={T.textDim} />
          <PText x={SC_RX} y={BAND_Y[2]} text="S: G = 2" fill={T.textDim} />
        </g>
      )}
      {name === "dpo" && (
        <g>
          <PText x={SC_RX} y={BAND_Y[0]} text={`▲ ${r2(RLHF_PAIR_REWARDS[0])} chosen`} fill={T.text} />
          <PText x={SC_RX} y={BAND_Y[1]} text={`▼ ${r2(RLHF_PAIR_REWARDS[1])} rejected`} fill={T.text} />
          <PText x={SC_RX} y={BAND_Y[2]} text={`${RLHF_PAIR_TIED} ties skipped`} fill={T.textDim} />
        </g>
      )}
      <Wire pts={[[WORDS_X, 73], [WORDS_X, SC.y + SC.h + 2]]} fill={T.wire} />
      <Wire pts={[[R_X, SC.y + SC.h + 1], [R_X, name === "dpo" ? 88 : 73]]} fill={T.wire} />
    </g>
  );
}

/** the frozen reference: the same bars, dim, in a frame */
function Twin({ T }: { T: Theme }) {
  return (
    <g>
      <PText x={16} y={LB_HDR} text="π_{ref}, frozen copy" fill={T.text} />
      <Frame x={TWIN.x} y={TWIN.y} w={TWIN.w} h={TWIN.h} fill={T.frame} />
      {LM_BARS.map((b, i) => <Bars key={i} x={b.x} y={TWIN.y + 4} bars={b.n} h={TWIN.h - 8} theme={T} bw={3} gap={2} dim />)}
      {LM_SPINE.map(([a, b], i) => <Wire key={i} pts={[[a, TRACK.mid], [b, TRACK.mid]]} fill={T.accentLo} step={1} />)}
      <Wire pts={[[TWIN.x + TWIN.w + 1, TRACK.mid], [121, TRACK.mid]]} fill={T.wire} />
    </g>
  );
}

/** the clip band ρ ∈ [.8, 1.2] around the frozen ref, with per-token dots */
function RhoTrack({ T, hot, n, pitch }: { T: Theme; hot: boolean; n: number; pitch: number }) {
  const rho = useMemo(() => Array.from(gaussian(72, RHO_SEED), (g) => Math.exp(0.12 * g)), []);
  const lo = 1 - RLHF_PPO_CLIP, hi = 1 + RLHF_PPO_CLIP;
  const yOf = (r: number) => Math.max(TRACK.hi - 8, Math.min(TRACK.lo + 8, TRACK.mid - Math.round((r - 1) * 40)));
  const edge = hot ? T.wireHot : T.accentLo;
  return (
    <g>
      <rect x={TRACK.x} y={TRACK.hi} width={TRACK.w} height={TRACK.lo - TRACK.hi + 1} fill={T.panel} />
      <rect x={TRACK.x} y={TRACK.hi} width={TRACK.w} height={1} fill={edge} />
      <rect x={TRACK.x} y={TRACK.lo} width={TRACK.w} height={1} fill={edge} />
      <Wire pts={[[TRACK.x, TRACK.mid], [TRACK.x + TRACK.w - 1, TRACK.mid]]} fill={T.frame} />
      {rho.slice(0, n).map((r, k) => (
        <rect key={k} x={TRACK.x + pitch * k} y={yOf(r) - 1} width={2} height={2} fill={!hot ? T.textDim : r < lo ? T.textDim : T.accent} />
      ))}
      <PText x={416} y={TRACK.hi - 3} text={fmt(hi, 1)} fill={T.textDim} />
      <PText x={416} y={TRACK.lo - 3} text={fmt(lo, 1)} fill={T.textDim} />
      <Wire pts={[[430, DIA.cy], [DIA.cx - 8, DIA.cy]]} fill={T.wire} />
    </g>
  );
}

function Objective({ T, name, value }: { T: Theme; name: string; value: string }) {
  return (
    <g>
      <Diamond cx={DIA.cx} cy={DIA.cy} r={6} theme={T} />
      <PText x={DIA.cx} y={DIA.cy + 10} text={name} fill={T.loss} anchor="middle" />
      <PText x={DIA.cx} y={DIA.cy + 20} text={value} fill={T.loss} anchor="middle" />
    </g>
  );
}

/** a stand-in row: the trainers' first 16-char corpus window, then the 16 chars the rlhf champion sampled */
function StandInRow({ T, y, resp }: { T: Theme; y: number; resp: string }) {
  return (
    <g>
      {[...RLHF_STANDIN_PROMPT].map((ch, c) => <PText key={c} x={colX(c) + 3} y={y} text={show(ch)} fill={T.textDim} anchor="middle" />)}
      {[...resp].map((ch, j) => <PText key={`s${j}`} x={colX(16 + j) + 3} y={y} text={show(ch)} fill={ch === "\n" ? T.textDim : T.text} anchor="middle" />)}
    </g>
  );
}

// ————— rlhf —————
/** r on [0, 1]: where the one reward sits against the constant .5 baseline */
const RLINE = { x: 344, w: 200, y: 92 };
const rlx = (r: number) => RLINE.x + Math.round(r * RLINE.w);
function RLHFBody({ T, frame }: { T: Theme; frame: number }) {
  const { seq, spans } = useMemo(() => decodeSample(), []);
  const underlines = useMemo(() => {
    const out: { line: number; x0: number; x1: number; band: Band }[] = [];
    for (const s of spans) {
      if (s.band === "none") continue;
      let cur: { line: number; x0: number; x1: number; band: Band } | null = null;
      for (let r = s.a; r <= s.b; r++) {
        const { line, col } = at(P0 + r);
        if (cur && cur.line === line) cur.x1 = colX(col) + 5;
        else { if (cur) out.push(cur); cur = { line, x0: colX(col), x1: colX(col) + 5, band: s.band }; }
      }
      if (cur) out.push(cur);
    }
    return out;
  }, [spans]);
  const last = at(seq.length - 1);
  const aBars = [
    { x0: colX(1), x1: colX(COLS - 1) + 5, y: LINE_Y[0] + 25 },   // pos 0 has no log-prob term
    { x0: colX(0), x1: colX(last.col) + 5, y: LINE_Y[1] + 25 },
  ];
  const xR = rlx(RLHF_REWARD), xBase = rlx(0.5);
  return (
    <g>
      {seq.map((ch, pos) => {
        const { line, col } = at(pos);
        const g = pos - P0;
        const x = colX(col), y = LINE_Y[line];
        const dim = g < 0 || ch === "\n";
        const h = g >= 0 ? Math.round(RLHF_P_CHOSEN[g] * 14) : 0;
        return (
          <g key={pos}>
            <PText x={x + 3} y={y} text={show(ch)} fill={dim ? T.textDim : T.text} anchor="middle" />
            {h > 0 && <rect x={x + 1} y={y + 21 - h} width={3} height={h} fill={T.accentHi} />}
          </g>
        );
      })}
      {underlines.map((u, i) => <rect key={`u${i}`} x={u.x0} y={LINE_Y[u.line] + 22} width={u.x1 - u.x0} height={2} fill={bandFill(T, u.band)} />)}
      {aBars.map((b, i) => <rect key={`a${i}`} x={b.x0} y={b.y} width={b.x1 - b.x0} height={3} fill={T.loss} />)}

      {/* the one advantage, broadcast to every position (the prompt's too): down the right edge, a tick into each A bar */}
      <Frame x={LOGIC_X} y={76} w={76} h={24} fill={T.wireHot} />
      <PText x={LOGIC_X + 4} y={80} text="A = r − .5" fill={T.wireHot} />
      <PText x={LOGIC_X + 4} y={90} text={`= ${fmt(A_RLHF, 3)}`} fill={T.wireHot} />
      <Wire pts={[[249, 88], [244, 88], [244, aBars[0].y + 1], [aBars[0].x1 + 3, aBars[0].y + 1]]} fill={T.wireHot} step={3} phase={frame} />
      <Wire pts={[[244, aBars[0].y + 2], [244, aBars[1].y + 1], [aBars[1].x1 + 3, aBars[1].y + 1]]} fill={T.wireHot} step={3} phase={frame} />

      {/* r against the constant baseline: why A is negative */}
      <PText x={xR} y={LINE_Y[0]} text={`r ${fmt(RLHF_REWARD, 3)}`} fill={T.textDim} />
      <PText x={xBase} y={LINE_Y[0]} text="baseline .5" fill={T.textDim} anchor="middle" />
      <rect x={xR + 2} y={RLINE.y - 5} width={xBase - xR - 2} height={2} fill={T.loss} />
      <rect x={xBase} y={RLINE.y - 6} width={1} height={8} fill={T.frame} />
      <rect x={RLINE.x} y={RLINE.y} width={RLINE.w + 1} height={1} fill={T.frame} />
      <rect x={RLINE.x} y={RLINE.y + 1} width={1} height={2} fill={T.frame} />
      <rect x={RLINE.x + RLINE.w} y={RLINE.y + 1} width={1} height={2} fill={T.frame} />
      <rect x={xR - 1} y={RLINE.y - 1} width={3} height={3} fill={bandFill(T, "common")} />
      <PText x={RLINE.x} y={RLINE.y + 5} text="0" fill={T.textDim} anchor="middle" />
      <PText x={RLINE.x + RLINE.w} y={RLINE.y + 5} text="1" fill={T.textDim} anchor="middle" />
      <PText x={RLINE.x} y={112} text={`one A for all ${seq.length - 1} log-probs,`} fill={T.textDim} />
      <PText x={RLINE.x} y={122} text="the prompt's too" fill={T.textDim} />

      <Twin T={T} />
      <PText x={TRACK.x} y={LB_HDR} text="ρ = π / π_{ref} per token, clipped to [.8, 1.2]" fill={T.text} />
      <RhoTrack T={T} hot n={seq.length - 1} pitch={4} />
      <PText x={TRACK.x} y={ILLU_Y} text="π_{ref} not saved: dots illustrative" fill={T.textDim} />
      <Objective T={T} name="clip" value={`≥ ${fmt(CLIP_FLOOR)}`} />

      <PText x={16} y={ROWS[0]} text={`loss = −mean min(ρA, clip(ρ, .8, 1.2)A) + ${RLHF_KL_COEF}·mean(log π_{ref} − log π)`} fill={T.text} />
      <PText x={16} y={ROWS[1]} text={`code sign: that ${RLHF_KL_COEF} term is −KL, it raises log π; only the clip ties π to π_{ref}`} fill={T.loss} />
      <PText x={16} y={ROWS[2]} text="A < 0: below .8 the clip term gives no gradient; baseline .5, no value head" fill={T.textDim} />
      <PText x={16} y={ROWS[3]} text="gate: next-char CE of the final policy, eval loss ≤ 3.0 at M, not the reward" fill={T.loss} />
      <PText x={16} y={LINEAGE_Y} text="from reinforce: ∇ log π · G becomes ∇ log π · A, clipped against π_{ref}" fill={T.textDim} />
      <PText x={ALIGN_VIEW.w - 16} y={FOOTER_Y} text="column = p(char), rose = A, line = word band" fill={T.textDim} anchor="end" />
    </g>
  );
}

// ————— grpo —————
const MU = { cx: 338, cy: 103 };
const A_FRAME = { x: 386, y: 72, w: 50, h: 60 };
const A_ZERO = A_FRAME.x + A_FRAME.w / 2;        // 411: the zero line centred in the hot frame
function GRPOBody({ T, frame }: { T: Theme; frame: number }) {
  const yc = ROW_Y4.map((y) => y + 3);
  const inBus = 324, outBus = 356;
  return (
    <g>
      {ROW_Y4.map((y, i) => (
        <g key={i}>
          <StandInRow T={T} y={y} resp={RLHF_GROUP[i]} />
          <PText x={264} y={y} text={r2(RLHF_GROUP_REWARDS[i])} fill={T.text} anchor="end" />
          <rect x={270} y={y + 2} width={R_TRACK.w} height={3} fill={T.panel} />
          {rTrack(RLHF_GROUP_REWARDS[i]) > 0 && <rect x={270} y={y + 2} width={rTrack(RLHF_GROUP_REWARDS[i])} height={3} fill={bandFill(T, "common")} />}
        </g>
      ))}
      <PText x={MU.cx + 2} y={MU.cy + 9} text="mean" fill={T.textDim} anchor="middle" />
      <PText x={MU.cx + 2} y={MU.cy + 19} text="std" fill={T.textDim} anchor="middle" />

      {/* the group's rewards → its own mean and std → zero-sum advantages (moving) */}
      {yc.map((y, i) => <Wire key={`i${i}`} pts={[[312, y], [inBus - 1, y]]} fill={T.wireHot} step={3} phase={frame} />)}
      <Wire pts={[[inBus, yc[0]], [inBus, MU.cy], [MU.cx - 8, MU.cy]]} fill={T.wireHot} step={3} phase={frame} />
      <Wire pts={[[inBus, yc[3]], [inBus, MU.cy + 1]]} fill={T.wireHot} step={3} phase={frame} />
      <Node cx={MU.cx} cy={MU.cy} glyph="μ" theme={T} hot />
      <Wire pts={[[MU.cx + 8, MU.cy], [outBus - 1, MU.cy]]} fill={T.wireHot} step={3} phase={frame} />
      <Wire pts={[[outBus, MU.cy], [outBus, yc[0]], [A_FRAME.x - 3, yc[0]]]} fill={T.wireHot} step={3} phase={frame} />
      <Wire pts={[[outBus, MU.cy + 1], [outBus, yc[3]], [A_FRAME.x - 3, yc[3]]]} fill={T.wireHot} step={3} phase={frame} />
      <Wire pts={[[outBus + 1, yc[1]], [A_FRAME.x - 3, yc[1]]]} fill={T.wireHot} step={3} phase={frame} />
      <Wire pts={[[outBus + 1, yc[2]], [A_FRAME.x - 3, yc[2]]]} fill={T.wireHot} step={3} phase={frame} />

      <Frame x={A_FRAME.x} y={A_FRAME.y} w={A_FRAME.w} h={A_FRAME.h} fill={T.wireHot} />
      <rect x={A_ZERO} y={A_FRAME.y + 2} width={1} height={A_FRAME.h - 4} fill={T.wireHot} />
      {ROW_Y4.map((y, i) => {
        const a = RLHF_GROUP_ADV[i];
        const L = Math.round(Math.abs(a) * A_PX);
        return (
          <g key={`a${i}`}>
            {L > 0 && <rect x={a >= 0 ? A_ZERO + 1 : A_ZERO - L} y={y + 1} width={L} height={5} fill={a >= 0 ? T.accentHi : T.loss} />}
            <PText x={470} y={y} text={r2(a)} fill={T.text} anchor="end" />
          </g>
        );
      })}
      <PText x={LOGIC_X} y={NOTE_Y} text="no local grpo checkpoint; rlhf champion stands in" fill={T.textDim} />

      <Twin T={T} />
      <PText x={TRACK.x} y={LB_HDR} text="ρ = π / π_{ref}, clipped to [.8, 1.2]: rlhf's, unchanged" fill={T.textDim} />
      <RhoTrack T={T} hot={false} n={31} pitch={9} />
      <PText x={TRACK.x} y={ILLU_Y} text="31 log-probs per response at M; dots illustrative" fill={T.textDim} />
      <Objective T={T} name="GRPO" value="any sign" />

      <PText x={16} y={ROWS[0]} text="A_i = (r_i − mean r) / (std r + 1e−6), unbiased std" fill={T.wireHot} />
      <PText x={16} y={ROWS[1]} text={`ΣA_i = 0; all rewards equal → every A_i = 0: only the ${RLHF_KL_COEF} term still pushes`} fill={T.textDim} />
      <PText x={16} y={ROWS[2]} text={`per response, rlhf's clipped ρ loss and the same ${RLHF_KL_COEF} term (same sign)`} fill={T.textDim} />
      <PText x={16} y={ROWS[3]} text="gate: next-char CE of the final policy, eval loss ≤ 3.0 at M, not the reward" fill={T.loss} />
      <PText x={16} y={LINEAGE_Y} text="from rlhf: the constant .5 baseline becomes the group's own mean and std" fill={T.textDim} />
      <PText x={ALIGN_VIEW.w - 16} y={FOOTER_Y} text="r: 40 px = .25  A_i: 20 px = 1, blue +, rose −" fill={T.textDim} anchor="end" />
    </g>
  );
}

// ————— dpo —————
const M_NODE = { cx: 276, cy: 188 };
const PLOT = { x0: 304, x1: 464, base: 202, mid: 384 };
const GRID = { x: 121, y: 169, w: 126, h: 38 };
function DPOBody({ T, frame }: { T: Theme; frame: number }) {
  const curve = useMemo(() => {
    const pts: Pt[] = [];
    for (let x = PLOT.x0; x <= PLOT.x1; x++) {
      const m = (x - PLOT.mid) / 2;
      pts.push([x, PLOT.base - Math.round(8 * softplus(-DPO_BETA * m))]);
    }
    return pts;
  }, []);
  const yLn2 = PLOT.base - Math.round(8 * Math.LN2);
  // stand-in Σ log π of each response (eval mode); at the first step π_ref is the same net, so lr = lp
  const [lpC, lpR] = RLHF_PAIR_LOGP;
  const cells: { x: number; y: number; sign: string; label: string; v: number }[] = [
    { x: 124, y: GRID.y + 3, sign: "+", label: "lp⁺", v: lpC }, { x: 188, y: GRID.y + 3, sign: "−", label: "lr⁺", v: lpC },
    { x: 124, y: GRID.y + 21, sign: "−", label: "lp⁻", v: lpR }, { x: 188, y: GRID.y + 21, sign: "+", label: "lr⁻", v: lpR },
  ];
  const wy = [GRID.y + 10, GRID.y + 28];
  return (
    <g>
      {LINE_Y.map((y, i) => (
        <g key={i}>
          <StandInRow T={T} y={y} resp={RLHF_PAIR[i]} />
          <PText x={212} y={y} text={i === 0 ? "▲" : "▼"} fill={T.text} />
          <PText x={220} y={y} text={i === 0 ? "chosen" : "rejected"} fill={T.textDim} />
        </g>
      ))}
      {/* the score only sorts: its legs stop at the tags, nothing runs on to the loss */}
      <Node cx={R_X} cy={96} glyph=">" theme={T} />
      <Wire pts={[[R_X - 6, 96], [276, 96], [276, LINE_Y[0] + 3], [260, LINE_Y[0] + 3]]} fill={T.wire} />
      <Wire pts={[[276, 97], [276, LINE_Y[1] + 3], [260, LINE_Y[1] + 3]]} fill={T.wire} />
      <PText x={300} y={92} text="scores only sort the pair;" fill={T.textDim} />
      <PText x={300} y={102} text="ties skipped, values dropped" fill={T.textDim} />
      <Wire pts={[[160, LINE_Y[1] + 10], [160, GRID.y - 2]]} fill={T.wire} />
      <PText x={LOGIC_X} y={NOTE_Y} text="no local dpo checkpoint; rlhf champion stands in" fill={T.textDim} />

      <Twin T={T} />
      <PText x={166} y={LB_HDR} text="lp = Σ log π(y),  lr = Σ log π_{ref}(y)" fill={T.text} />
      <Frame x={GRID.x} y={GRID.y} w={GRID.w} h={GRID.h} fill={T.wireHot} />
      {cells.map((c, i) => (
        <g key={i}>
          <rect x={c.x} y={c.y} width={56} height={14} fill={T.panel} />
          <PText x={c.x + 4} y={c.y + 4} text={c.sign} fill={T.wireHot} />
          <PText x={c.x + 13} y={c.y + 4} text={c.label} fill={T.text} />
          <PText x={c.x + 53} y={c.y + 4} text={minus(c.v)} fill={T.textDim} anchor="end" />
        </g>
      ))}
      {/* four sequence sums collapse into one margin (moving) */}
      <Wire pts={[[GRID.x + GRID.w + 1, wy[0]], [M_NODE.cx, wy[0]], [M_NODE.cx, M_NODE.cy - 7]]} fill={T.wireHot} step={3} phase={frame} />
      <Wire pts={[[GRID.x + GRID.w + 1, wy[1]], [M_NODE.cx, wy[1]], [M_NODE.cx, M_NODE.cy + 7]]} fill={T.wireHot} step={3} phase={frame} />
      <Node cx={M_NODE.cx} cy={M_NODE.cy} glyph="m" theme={T} hot />
      <Wire pts={[[M_NODE.cx + 7, M_NODE.cy], [PLOT.x0 - 3, M_NODE.cy]]} fill={T.wireHot} step={3} phase={frame} />

      <rect x={PLOT.x0} y={PLOT.base} width={PLOT.x1 - PLOT.x0 + 1} height={1} fill={T.frame} />
      <Wire pts={curve} fill={T.loss} step={1} />
      <rect x={PLOT.mid - 1} y={yLn2 - 1} width={3} height={3} fill={T.wireHot} />
      <PText x={PLOT.x1 - 2} y={LB_HDR + 12} text="−log σ(.1·m)" fill={T.loss} anchor="end" />
      <PText x={PLOT.x0} y={PLOT.base + 4} text="−40" fill={T.textDim} />
      <PText x={PLOT.mid} y={PLOT.base + 4} text="m = 0" fill={T.textDim} anchor="middle" />
      <PText x={PLOT.x1} y={PLOT.base + 4} text="40" fill={T.textDim} anchor="end" />
      <Wire pts={[[PLOT.x1 + 4, DIA.cy], [DIA.cx - 8, DIA.cy]]} fill={T.wire} />
      <Objective T={T} name="DPO" value={fmt(Math.LN2)} />

      <PText x={16} y={ROWS[0]} text="m = (lp⁺ − lr⁺) − (lp⁻ − lr⁻)    loss = −log σ(0.1·m) = ln 2 = .69 when π = π_{ref}" fill={T.text} />
      <PText x={16} y={ROWS[1]} text="sums over 31 log-probs, not means; the 15 shared prompt terms cancel (π: dropout aside)" fill={T.textDim} />
      <PText x={16} y={ROWS[2]} text="no advantage, no clip, no kl term; π_{ref} still needed; pairs re-sampled" fill={T.textDim} />
      <PText x={16} y={ROWS[3]} text="gate: next-char CE of the final policy, eval loss ≤ 3.0 at M, not the reward" fill={T.loss} />
      <PText x={16} y={LINEAGE_Y} text="from rlhf: no reward in the loss, no RL loop; a σ on the log-ratio margin" fill={T.textDim} />
      <PText x={ALIGN_VIEW.w - 16} y={FOOTER_Y} text="curve: m from −40 to 40" fill={T.textDim} anchor="end" />
    </g>
  );
}

export function AlignDiagram({ theme, name, still }: { theme: Theme; name: AlignName; still: boolean }) {
  const T = theme;
  const frame = useTick(3, 3, still);
  return (
    <g>
      <rect x={0} y={0} width={ALIGN_VIEW.w} height={ALIGN_VIEW.h} fill={T.ground} />
      <TopBand T={T} name={name} />
      {name === "rlhf" && <RLHFBody T={T} frame={frame} />}
      {name === "grpo" && <GRPOBody T={T} frame={frame} />}
      {name === "dpo" && <DPOBody T={T} frame={frame} />}
      <PText x={16} y={FOOTER_Y} text="1 bar = 32 channels   2 blocks, 2 heads, width 64, ffn 128, 65 chars" fill={T.textDim} />
    </g>
  );
}

// ————— cards (never tick) —————
function RLHFCard({ T }: { T: Theme }) {
  const { raw, spans } = useMemo(() => decodeSample(), []);
  const LINES = [6, 26, 46], PER = 22;
  const pos = (r: number) => ({ x: 4 + 6 * (r % PER), y: LINES[Math.floor(r / PER)] });
  const terms = useMemo(() => rewardTerms(), []);
  return (
    <g>
      {raw.map((ch, r) => {
        const { x, y } = pos(r);
        const h = Math.round(RLHF_P_CHOSEN[r] * 8);
        return (
          <g key={r}>
            <PText x={x + 3} y={y} text={show(ch)} fill={ch === "\n" ? T.textDim : T.text} anchor="middle" />
            {h > 0 && <rect x={x + 2} y={y + 16 - h} width={1} height={h} fill={T.accentHi} />}
          </g>
        );
      })}
      {spans.filter((s) => s.band !== "none").flatMap((s) => {
        const out: ReactNode[] = [];
        for (let r = s.a; r <= s.b; r++) {
          const { x, y } = pos(r);
          out.push(<rect key={`u${r}`} x={x} y={y + 17} width={r === s.b || (r + 1) % PER === 0 ? 5 : 6} height={2} fill={bandFill(T, s.band)} />);
        }
        return out;
      })}
      <rect x={4} y={66} width={132} height={4} fill={T.loss} />
      <PText x={142} y={6} text={`r ${fmt(RLHF_REWARD, 3)}`} fill={T.text} />
      {BANDS.map((b, i) => (
        <g key={i}>
          <rect x={142} y={18 + 6 * i} width={40} height={3} fill={T.panel} />
          {terms.sat[i] > 0 && <rect x={142} y={18 + 6 * i} width={Math.max(1, Math.round(terms.sat[i] * 40))} height={3} fill={bandFill(T, b.band)} />}
        </g>
      ))}
      <PText x={142} y={65} text={`A ${fmt(A_RLHF, 3)}`} fill={T.wireHot} />
      <PText x={4} y={82} text="one A on every char" fill={T.textDim} />
    </g>
  );
}

function GRPOCard({ T }: { T: Theme }) {
  const RY = [12, 32, 52, 72];
  const yc = RY.map((y) => y + 3);
  const NODE = { cx: 63, cy: 45 }, ZERO = 112;
  return (
    <g>
      {RY.map((y, i) => {
        const r = RLHF_GROUP_REWARDS[i], a = RLHF_GROUP_ADV[i];
        const L = Math.round(Math.abs(a) * A_PX);
        const fill = r > 0 ? Math.max(1, Math.round((r / R_TRACK.full) * 24)) : 0;
        return (
          <g key={i}>
            <PText x={22} y={y} text={r2(r)} fill={T.textDim} anchor="end" />
            <rect x={26} y={y + 2} width={24} height={3} fill={T.panel} />
            {fill > 0 && <rect x={26} y={y + 2} width={fill} height={3} fill={bandFill(T, "common")} />}
            <Wire pts={[[52, yc[i]], [53, yc[i]]]} fill={T.wireHot} />
            <Wire pts={[[i === 0 || i === 3 ? 76 : 77, yc[i]], [a >= 0 ? ZERO - 3 : ZERO - L - 3, yc[i]]]} fill={T.wireHot} />
            {L > 0 && <rect x={a >= 0 ? ZERO + 1 : ZERO - L} y={y + 1} width={L} height={5} fill={a >= 0 ? T.accentHi : T.loss} />}
            <PText x={148} y={y} text={r2(a)} fill={T.text} />
          </g>
        );
      })}
      <Wire pts={[[54, yc[0]], [54, yc[3]]]} fill={T.wireHot} />
      <Wire pts={[[54, NODE.cy], [NODE.cx - 7, NODE.cy]]} fill={T.wireHot} />
      <Node cx={NODE.cx} cy={NODE.cy} glyph="μ" theme={T} hot />
      <Wire pts={[[NODE.cx + 7, NODE.cy], [76, NODE.cy]]} fill={T.wireHot} />
      <Wire pts={[[76, yc[0]], [76, yc[3]]]} fill={T.wireHot} />
      <rect x={ZERO} y={8} width={1} height={73} fill={T.wireHot} />
      <PText x={4} y={90} text="ΣA = 0 in one group" fill={T.textDim} />
    </g>
  );
}

function DPOCard({ T }: { T: Theme }) {
  const P = { x0: 70, x1: 186, base: 70, mid: 128 };
  const curve = useMemo(() => {
    const pts: Pt[] = [];
    for (let x = P.x0; x <= P.x1; x++) pts.push([x, P.base - Math.round(14 * softplus((-DPO_BETA * (x - P.mid)) / 1.45))]);
    return pts;
  }, [P.x0, P.x1, P.base, P.mid]);
  const NODE = { cx: 58, cy: 25 };
  const yLn2 = P.base - Math.round(14 * Math.LN2);
  return (
    <g>
      <PText x={4} y={10} text="▲" fill={T.text} />
      <PText x={12} y={10} text="chosen" fill={T.textDim} />
      <PText x={4} y={34} text="▼" fill={T.text} />
      <PText x={12} y={34} text="rejected" fill={T.textDim} />
      <Wire pts={[[51, 13], [NODE.cx, 13], [NODE.cx, NODE.cy - 7]]} fill={T.wireHot} />
      <Wire pts={[[51, 37], [NODE.cx, 37], [NODE.cx, NODE.cy + 7]]} fill={T.wireHot} />
      <Node cx={NODE.cx} cy={NODE.cy} glyph="m" theme={T} hot />
      <Wire pts={[[NODE.cx + 7, NODE.cy], [P.x0 - 3, NODE.cy]]} fill={T.wireHot} />
      <rect x={P.x0} y={P.base} width={P.x1 - P.x0 + 1} height={1} fill={T.frame} />
      <Wire pts={curve} fill={T.loss} step={1} />
      <rect x={P.mid - 1} y={yLn2 - 1} width={3} height={3} fill={T.wireHot} />
      <PText x={4} y={84} text="ln 2 = .69 at m = 0" fill={T.loss} />
    </g>
  );
}

export function AlignCard({ theme, name }: { theme: Theme; name: AlignName }) {
  const T = theme;
  return (
    <g>
      <rect x={0} y={0} width={ALIGN_CARD_VIEW.w} height={ALIGN_CARD_VIEW.h} fill={T.ground} />
      {name === "rlhf" && <RLHFCard T={T} />}
      {name === "grpo" && <GRPOCard T={T} />}
      {name === "dpo" && <DPOCard T={T} />}
    </g>
  );
}

// Structurally the registry's DiagramDef (index.tsx keeps that interface private).
interface AlignDef {
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

const ALIGN_TEXT: Record<AlignName, { title: string; truth: string; badge: string }> = {
  rlhf: {
    title: "rlhf — score the sample, push every char by one advantage, stay near the frozen copy",
    truth: "Real: the local mini-rlhf champion's 64-char sample after 'Thou art ' (the 4 newlines its decode dropped are put back as ↵), every char's probability, the word-score bands and r = .025, so A = r − .5 = −.475 on every position, the prompt's included. Training rollouts at M are shorter: a 16-char corpus prompt + 16 new chars, 31 log-probs; this 9 + 64-char export is for legibility. The reward is a word heuristic, not the unused RewardModel, and there is no value head. π_ref is not saved, so the ratio dots are illustrative; the clip term is still ≥ .38 exactly because A < 0. The 0.1 term is drawn as the code computes it, mean(log π_ref − log π): the negative of the usual KL estimate, so its gradient raises log π. The gate scores next-char cross-entropy, not reward.",
    badge: "real champion sample",
  },
  grpo: {
    title: "grpo — let a group of answers be its own baseline",
    truth: "No local grpo checkpoint: structure from the code and exact maths, with the rlhf champion standing in as the policy. One prompt per iteration (the first is the corpus window 'First Citizen:↵B') and G = 4 responses of 16 chars (2 at S): the four shown are the stand-in's real samples, their real word scores 0, 0, .08, .08, and exactly GRPO's advantages −.87, −.87, .87, .87 (unbiased std). When every score is equal, every A_i is 0 and only the 0.1 term still moves the policy. The clipped ratio against π_ref and the 0.1 term are rlhf's, unchanged; the ratio dots are illustrative. A grpo run pretrains its own LM from scratch.",
    badge: "structure; rlhf champion as stand-in",
  },
  dpo: {
    title: "dpo — no reward in the loss: prefer the better of two samples directly",
    truth: "No local dpo checkpoint: structure from the code and exact maths, with the rlhf champion standing in as the policy. Two 16-char samples per prompt from the current policy; the word score (.08 vs 0, after 2 tied pairs were skipped) only sorts them and never reaches the loss. lp and lr are the stand-in's summed log-probs over 31 terms (eval mode); at the first step π_ref is the same net, so lr = lp, m = 0 and the loss is ln 2 = .69 (for π, dropout aside). The 15 shared prompt terms cancel exactly for π_ref and, dropout aside, for π. The −log σ(0.1·m) curve is exact.",
    badge: "structure; rlhf champion as stand-in",
  },
};

export const ALIGNMENT_DEFS: Record<string, AlignDef> = {};
for (const n of Object.keys(ALIGN_TEXT) as AlignName[]) {
  ALIGNMENT_DEFS[n] = {
    view: ALIGN_VIEW,
    ...ALIGN_TEXT[n],
    render: ({ theme, still }) => <AlignDiagram theme={theme} name={n} still={still} />,
    card: { view: ALIGN_CARD_VIEW, render: ({ theme }) => <AlignCard theme={theme} name={n} /> },
  };
}
