"use client";

// Language-model family built on the transformer: moe / kimi / deepseek /
// grokking / text_diffusion. None of these has a LOCAL champion checkpoint,
// so every drawing here is structure read from the code + real data + exact
// maths; anything a trained network would decide (which expert, which
// compressed entry, unmasking order) is drawn as an ILLUSTRATION and says so
// on the page.
//   moe            models/transformer/model.py MoEFFN (block_type "moe"): shared
//                  path × learnable scale (0.3 init) + 4 experts, top-1 router,
//                  balance loss = KL(mean routing ‖ uniform)
//   kimi           models/kimi/model.py: [KDA, KDA, KDA, gated full] × 2 + a
//                  final global layer; layer 1 dense FFN, the rest Stable
//                  LatentMoE (2 shared + top-2 of 8 routed in a 64-d latent);
//                  KDA retention α ∈ (e^−5, 1); AttnRes over block outputs
//   deepseek       models/deepseek/model.py: 8 layers, every 4th HCA (1 entry
//                  / 16 tokens, dense) else CSA (1 entry / 4 tokens, top-8
//                  sparse) + a 16-token sliding window + sink; mHC mixes a 2×
//                  wide residual with a Sinkhorn (doubly-stochastic) matrix;
//                  DeepSeekMoE 1 shared + top-2 of 8, block 1 hash-routed
//   grokking       models/grokking + core/data/registry.py: a / b mod 97 as
//                  [a, ÷, b, =]; 2-layer causal transformer; the real 50/50
//                  split (seed 5) — the grokking CURVE is a labelled sketch
//   text_diffusion models/text_diffusion/model.py: the transformer with the
//                  causal mask removed; mask each char w.p. t, predict all
//                  masked chars; generate by unmasking max(1, masked // rounds
//                  left) per round, most confident first
import { useMemo, type ReactNode } from "react";
import { GROK_P, GROK_TRAIN_HEX, SHAKESPEARE_64 } from "../data/lm-data";
import { rng } from "../math";
import { Bars, Diamond, Frame, PText, Wire } from "../prims";
import { heatIndex, type Theme } from "../themes";

export const LM_VIEW = { w: 560, h: 316 };
export const LM_CARD_VIEW = { w: 190, h: 104 };
export type LMName = "moe" | "kimi" | "deepseek" | "grokking" | "text_diffusion";

const LINE = "Speak, speak.";
const show = (ch: string) => (ch === " " ? "·" : ch === "\n" ? "↵" : ch);
const modpow = (b: number, e: number, m: number) => { let r = 1; b %= m; while (e > 0) { if (e & 1) r = (r * b) % m; b = (b * b) % m; e >>= 1; } return r; };
const div97 = (a: number, b: number) => (a * modpow(b, GROK_P - 2, GROK_P)) % GROK_P;

interface Chip { attn: string; ffn: string; hot?: boolean }
const CHIPS: Record<LMName, Chip[]> = {
  moe: Array.from({ length: 4 }, () => ({ attn: "attn", ffn: "moe", hot: true })),
  kimi: [...Array.from({ length: 8 }, (_, i) => ({ attn: i % 4 < 3 ? "KDA" : "full", ffn: i === 0 ? "ffn" : "lat", hot: i % 4 === 3 })), { attn: "glob", ffn: "lat", hot: true }],
  deepseek: Array.from({ length: 8 }, (_, i) => ({ attn: (i + 1) % 4 === 0 ? "HCA" : "CSA", ffn: i === 0 ? "hash" : "moe", hot: (i + 1) % 4 === 0 })),
  grokking: Array.from({ length: 2 }, () => ({ attn: "attn", ffn: "ffn" })),
  text_diffusion: Array.from({ length: 4 }, () => ({ attn: "bi", ffn: "ffn", hot: true })),
};
const ARCH: Record<LMName, string> = {
  moe: "4 blocks: causal attention + a mixture-of-experts FFN (4 experts, top-1, shared path)",
  kimi: "9 layers: [KDA ×3, gated full] ×2 + global; layer 1 dense, then LatentMoE",
  deepseek: "8 layers: CSA ×3 then HCA, twice; mHC residuals; DeepSeekMoE",
  grokking: "2 causal layers, width 128, 4 heads; the answer is read from '='",
  text_diffusion: "4 bidirectional layers (the transformer minus its causal mask)",
};
const INSET: Record<LMName, string> = {
  moe: "the router sends each character to one expert",
  kimi: "KDA forgets at a learned rate; every 4th layer sees everything",
  deepseek: "compress the past: 4 chars → 1 entry (CSA), 16 → 1 (HCA)",
  grokking: "the whole task fits on one page: every a ÷ b mod 97",
  text_diffusion: "hide characters, predict them all at once, reveal a few",
};

/* ————— spine ————— */
function Spine({ theme: T, name }: { theme: Theme; name: LMName }) {
  const chips = CHIPS[name];
  const toks: string[] = name === "grokking" ? ["23", "÷", "7", "="] : name === "text_diffusion" ? maskLine(0.5).map((m, i) => (m ? "■" : LINE[i])) : [...LINE];
  const pitch = name === "grokking" ? 24 : 16;
  const tw = name === "grokking" ? 20 : 14;
  const X0 = 250, CP = Math.min(28, Math.floor(250 / chips.length));
  const outX = X0 + chips.length * CP + 10;
  const ans = name === "grokking" ? String(div97(23, 7)) : name === "text_diffusion" ? "all" : "next";
  return (
    <g>
      <PText x={16} y={14} text={name === "grokking" ? "tokens" : "characters"} fill={T.textDim} />
      {toks.map((t, i) => (
        <g key={i}>
          <rect x={16 + i * pitch} y={28} width={tw} height={14} fill={t === "■" ? T.accentLo : T.panel} />
          <Frame x={16 + i * pitch} y={28} w={tw} h={14} fill={T.frame} />
          <PText x={16 + i * pitch + tw / 2} y={32} text={t === "■" ? "" : show(t)} fill={T.text} anchor="middle" />
        </g>
      ))}
      <Wire pts={[[16 + toks.length * pitch, 35], [X0 - 4, 35]]} fill={T.accentLo} step={1} />
      <PText x={X0} y={14} text="layers, from the config" fill={T.textDim} />
      {chips.map((c, i) => (
        <g key={i}>
          <rect x={X0 + i * CP} y={24} width={CP - 4} height={24} fill={c.hot ? T.accent : T.accentLo} />
          <rect x={X0 + i * CP} y={24} width={CP - 4} height={1} fill={T.accentHi} />
          <rect x={X0 + i * CP} y={50} width={CP - 4} height={10} fill={c.ffn === "ffn" ? T.panel : T.accentLo} />
          <PText x={X0 + i * CP + (CP - 4) / 2} y={62} text={c.attn} fill={c.hot ? T.text : T.textDim} anchor="middle" />
          <PText x={X0 + i * CP + (CP - 4) / 2} y={72} text={c.ffn} fill={T.textDim} anchor="middle" />
        </g>
      ))}
      <Wire pts={[[X0 + chips.length * CP - 2, 35], [outX, 35]]} fill={T.accentLo} step={1} />
      <rect x={outX + 2} y={28} width={Math.max(20, ans.length * 6 + 6)} height={14} fill={T.panel} />
      <Frame x={outX + 2} y={28} w={Math.max(20, ans.length * 6 + 6)} h={14} fill={T.wireHot} />
      <PText x={outX + 5} y={32} text={ans} fill={T.wireHot} />
      <PText x={16} y={90} text={ARCH[name]} fill={T.textDim} />
      {name === "grokking" && <PText x={16} y={50} text="23 ÷ 7 mod 97 = 23 × 7⁻¹" fill={T.textDim} />}
    </g>
  );
}

/** mask each character of the line with probability t (seeded; the real rule, an example draw) */
function maskLine(t: number, seed = 7): boolean[] {
  const r = rng(seed);
  return [...LINE].map(() => r() < t);
}

/* ————— moe ————— */
function routeOf(i: number) {
  // ILLUSTRATIVE top-1 routing (no local moe checkpoint): a fixed seeded draw
  const r = rng(40 + i);
  return Math.floor(r() * 4);
}
function MoeInset({ theme: T, x, y }: { theme: Theme; x: number; y: number }) {
  const routes = [...LINE].map((_, i) => routeOf(i));
  const load = [0, 1, 2, 3].map((e) => routes.filter((r) => r === e).length / routes.length);
  const kl = load.reduce((a, m) => a + (m > 0 ? m * Math.log(m / 0.25) : 0), 0);
  const ey = (e: number) => y + 6 + e * 30;
  return (
    <g>
      {[...LINE].map((ch, i) => (
        <g key={i}>
          <rect x={x} y={y + i * 10} width={10} height={9} fill={T.panel} />
          <PText x={x + 5} y={y + i * 10 + 1} text={show(ch)} fill={T.text} anchor="middle" />
          <Wire pts={[[x + 12, y + i * 10 + 4], [x + 60, y + i * 10 + 4]]} fill={T.wire} />
          <Wire pts={[[x + 70, y + i * 10 + 4], [x + 200, ey(routes[i]) + 10]]} fill={T.wireHot} step={2} />
        </g>
      ))}
      <Bars x={x + 60} y={y} bars={2} h={128} theme={T} bw={3} gap={2} />
      <PText x={x + 56} y={y - 12} text="router" fill={T.text} />
      {[0, 1, 2, 3].map((e) => (
        <g key={e}>
          <Bars x={x + 202} y={ey(e)} bars={8} h={20} theme={T} bw={3} gap={1} />
          <PText x={x + 236} y={ey(e) + 6} text={`expert ${e + 1}`} fill={T.text} />
          <rect x={x + 290} y={ey(e) + 8} width={60} height={3} fill={T.panel} />
          <rect x={x + 290} y={ey(e) + 8} width={Math.round(load[e] * 60)} height={3} fill={T.accentHi} />
          <rect x={x + 290 + 15} y={ey(e) + 6} width={1} height={7} fill={T.loss} />
        </g>
      ))}
      <PText x={x + 290} y={y - 12} text="share of chars" fill={T.textDim} />
      <PText x={x + 290} y={y + 126} text="red tick = fair share 1/4" fill={T.loss} />
      <PText x={x + 370} y={y + 10} text="+ a shared path every" fill={T.text} />
      <PText x={x + 370} y={y + 20} text="char takes, scaled by a" fill={T.text} />
      <PText x={x + 370} y={y + 30} text="learned 0.3" fill={T.text} />
      <PText x={x + 370} y={y + 50} text={`balance loss: KL to`} fill={T.textDim} />
      <PText x={x + 370} y={y + 60} text={`uniform = ${kl.toFixed(2)}`} fill={T.loss} />
      <PText x={x + 370} y={y + 84} text="routes shown are an" fill={T.textDim} />
      <PText x={x + 370} y={y + 94} text="illustration: no local" fill={T.textDim} />
      <PText x={x + 370} y={y + 104} text="moe checkpoint" fill={T.textDim} />
    </g>
  );
}

/* ————— kimi ————— */
function KimiInset({ theme: T, x, y }: { theme: Theme; x: number; y: number }) {
  const alphas = [{ l: "α=e^-5", a: Math.exp(-5) }, { l: "α=e^-1", a: Math.exp(-1) }, { l: "α=e^-.25", a: Math.exp(-0.25) }, { l: "α=.95", a: 0.95 }];
  const cells: ReactNode[] = [];
  alphas.forEach((r, k) => {
    for (let d = 0; d < 13; d++) {
      const v = Math.pow(r.a, d);
      cells.push(<rect key={`${k}-${d}`} x={x + 54 + d * 11} y={y + 8 + k * 14} width={10} height={12} fill={T.heat[heatIndex(v)]} />);
    }
  });
  for (let d = 0; d < 13; d++) cells.push(<rect key={`f${d}`} x={x + 54 + d * 11} y={y + 8 + 4 * 14 + 8} width={10} height={12} fill={T.heat[6]} />);
  return (
    <g>
      <PText x={x} y={y - 4} text="how much of a char k steps back is kept" fill={T.textDim} />
      {alphas.map((r, k) => <PText key={k} x={x} y={y + 10 + k * 14} text={r.l} fill={T.text} />)}
      <PText x={x} y={y + 10 + 4 * 14 + 8} text="full attn" fill={T.wireHot} />
      {cells}
      {Array.from({ length: 13 }, (_, d) => (d % 3 === 0 ? <PText key={d} x={x + 59 + d * 11} y={y + 100} text={`_{${d}}`} fill={T.textDim} anchor="middle" /> : null))}
      <PText x={x + 54} y={y + 114} text="steps back: KDA retention αᵏ (exact)" fill={T.textDim} />
      {/* latent MoE */}
      <PText x={x + 230} y={y - 4} text="Stable LatentMoE (layers 2-9)" fill={T.textDim} />
      <Bars x={x + 230} y={y + 12} bars={4} h={40} theme={T} bw={3} gap={2} />
      <PText x={x + 230} y={y + 56} text="_{128}" fill={T.textDim} />
      <Wire pts={[[x + 250, y + 32], [x + 258, y + 32]]} fill={T.accentLo} step={1} />
      <Bars x={x + 260} y={y + 22} bars={2} h={20} theme={T} bw={3} gap={2} />
      <PText x={x + 260} y={y + 46} text="_{64}" fill={T.textDim} />
      {Array.from({ length: 8 }, (_, e) => (
        <rect key={e} x={x + 280 + e * 12} y={y + 22} width={10} height={20} fill={e === 2 || e === 5 ? T.accent : T.accentLo} />
      ))}
      <PText x={x + 280} y={y + 12} text="8 routed, top-2 lit" fill={T.text} />
      <rect x={x + 280} y={y + 50} width={46} height={10} fill={T.accent} />
      <PText x={x + 330} y={y + 51} text="2 shared" fill={T.text} />
      <PText x={x + 230} y={y + 72} text="experts work in a 64-d latent;" fill={T.textDim} />
      <PText x={x + 230} y={y + 82} text="which 2 fire is illustrative" fill={T.textDim} />
      <PText x={x + 230} y={y + 98} text="AttnRes: each block attends over" fill={T.textDim} />
      <PText x={x + 230} y={y + 108} text="earlier block outputs, not one sum" fill={T.textDim} />
    </g>
  );
}

/* ————— deepseek ————— */
function sinkhorn(m: number[][], it: number) {
  let a = m.map((r) => [...r]);
  for (let k = 0; k < it; k++) {
    a = a.map((r) => { const s = r.reduce((p, q) => p + q, 0); return r.map((v) => v / s); });
    const cs = a[0].map((_, j) => a.reduce((p, r) => p + r[j], 0));
    a = a.map((r) => r.map((v, j) => v / cs[j]));
  }
  return a;
}
function DeepseekInset({ theme: T, x, y }: { theme: Theme; x: number; y: number }) {
  const txt = SHAKESPEARE_64;
  const q = txt.length - 1;
  const pick = useMemo(() => { const r = rng(9); const s = new Set<number>(); while (s.size < 8) s.add(Math.floor(r() * 15)); return s; }, []);
  const W = 6;
  const r0 = useMemo(() => { const r = rng(3); return [[r() + 0.2, r() + 0.2], [r() + 0.2, r() + 0.2]]; }, []);
  const r1 = sinkhorn(r0, 10);
  return (
    <g>
      <PText x={x} y={y - 4} text="raw" fill={T.textDim} />
      {[...txt].map((ch, i) => (
        <g key={i}>
          <rect x={x + 30 + i * W} y={y + 6} width={W - 1} height={10} fill={i >= q - 15 ? T.accent : T.panel} />
          <PText x={x + 30 + i * W + 2} y={y + 7} text={ch === "\n" ? "" : ch === " " ? "" : ch} fill={i >= q - 15 ? T.panel : T.textDim} anchor="middle" s={1} />
        </g>
      ))}
      <PText x={x + 30 + (q - 15) * W} y={y - 4} text="window: last 16 raw" fill={T.wireHot} />
      <PText x={x} y={y + 22} text="CSA" fill={T.text} />
      {Array.from({ length: 16 }, (_, e) => (
        <rect key={e} x={x + 30 + e * 4 * W} y={y + 22} width={4 * W - 2} height={10} fill={e === 15 ? T.frame : pick.has(e) ? T.accentHi : T.accentLo} />
      ))}
      <PText x={x + 30 + 64 * W + 6} y={y + 23} text="1 per 4, top-8" fill={T.textDim} />
      <PText x={x} y={y + 38} text="HCA" fill={T.text} />
      {Array.from({ length: 4 }, (_, e) => (
        <rect key={e} x={x + 30 + e * 16 * W} y={y + 38} width={16 * W - 2} height={10} fill={e === 3 ? T.frame : T.accent} />
      ))}
      <PText x={x + 30 + 64 * W + 6} y={y + 39} text="1 per 16, all" fill={T.textDim} />
      <PText x={x} y={y + 56} text="the query is the last char; its current block is not yet compressed (grey);" fill={T.textDim} />
      <PText x={x} y={y + 66} text="which 8 CSA entries win is illustrative (the learned indexer picks them)" fill={T.textDim} />
      {/* mHC */}
      <PText x={x} y={y + 84} text="mHC mixes a 2-wide residual with a doubly-stochastic B (Sinkhorn, 10 steps):" fill={T.textDim} />
      {[r0, r1].map((m, k) => (
        <g key={k}>
          {m.map((row, i) => row.map((v, j) => (
            <g key={`${i}${j}`}>
              <rect x={x + 30 + k * 150 + j * 34} y={y + 96 + i * 16} width={32} height={14} fill={T.heat[heatIndex(v / 1.3)]} />
              <PText x={x + 46 + k * 150 + j * 34} y={y + 99 + i * 16} text={v.toFixed(2)} fill={v > 0.7 ? T.ground : T.text} anchor="middle" />
            </g>
          )))}
          <PText x={x + 104 + k * 150} y={y + 99} text={`Σrow ${(m[0][0] + m[0][1]).toFixed(2)}`} fill={T.textDim} />
          <PText x={x + 104 + k * 150} y={y + 115} text={`Σcol ${(m[0][0] + m[1][0]).toFixed(2)}`} fill={T.textDim} />
        </g>
      ))}
      <PText x={x + 330} y={y + 99} text="random B → rows and cols" fill={T.textDim} />
      <PText x={x + 330} y={y + 109} text="sum to 1 (exact)" fill={T.textDim} />
    </g>
  );
}

/* ————— grokking ————— */
function GrokInset({ theme: T, x, y }: { theme: Theme; x: number; y: number }) {
  const paths = useMemo(() => {
    const bits: number[] = [];
    for (const h of GROK_TRAIN_HEX) { const v = parseInt(h, 16); bits.push((v >> 3) & 1, (v >> 2) & 1, (v >> 1) & 1, v & 1); }
    const ans: string[] = Array(8).fill("");
    let tr = "", va = "";
    let k = 0;
    for (let a = 0; a < GROK_P; a++) for (let b = 1; b < GROK_P; b++) {
      const q = Math.min(7, Math.floor((div97(a, b) / GROK_P) * 8));
      ans[q] += `M${x + a} ${y + 8 + b}h1v1h-1z`;
      if (bits[k]) tr += `M${x + 120 + a} ${y + 8 + b}h1v1h-1z`; else va += `M${x + 120 + a} ${y + 8 + b}h1v1h-1z`;
      k++;
    }
    return { ans, tr, va };
  }, [x, y]);
  // SKETCH of the published shape (Power et al. 2022, Fig. 1) — log steps 10^1..10^5
  const gx = x + 260, gy = y + 10, gw = 240, gh = 90;
  const lx = (e: number) => gx + ((e - 1) / 4) * gw;
  const sig = (e: number, c: number, s: number) => 1 / (1 + Math.exp(-(e - c) * s));
  const train: [number, number][] = [], val: [number, number][] = [];
  for (let i = 0; i <= 80; i++) {
    const e = 1 + (i / 80) * 4;
    train.push([Math.round(lx(e)), Math.round(gy + gh - (0.01 + 0.99 * sig(e, 2.6, 6)) * gh)]);
    val.push([Math.round(lx(e)), Math.round(gy + gh - (0.01 + 0.99 * sig(e, 4.4, 9)) * gh)]);
  }
  return (
    <g>
      <PText x={x} y={y - 4} text="a ÷ b mod 97" fill={T.textDim} />
      {paths.ans.map((d, i) => (d ? <path key={i} d={d} fill={T.ramp[i]} /> : null))}
      <PText x={x} y={y + 108} text="a →, b ↓, colour = a÷b" fill={T.textDim} />
      <PText x={x + 120} y={y - 4} text="the real 50/50 split" fill={T.textDim} />
      <path d={paths.tr} fill={T.accent} />
      <path d={paths.va} fill={T.panel} />
      <Frame x={x + 119} y={y + 8} w={99} h={98} fill={T.frame} />
      <PText x={x + 120} y={y + 108} text="blue train, dark held out" fill={T.textDim} />
      {/* curve sketch */}
      <Frame x={gx - 1} y={gy - 1} w={gw + 2} h={gh + 2} fill={T.frame} />
      <path d={val.map(([a, b], i) => (i ? `L${a} ${b}` : `M${a} ${b}`)).join("")} fill="none" stroke={T.loss} strokeWidth={1} />
      <path d={train.map(([a, b], i) => (i ? `L${a} ${b}` : `M${a} ${b}`)).join("")} fill="none" stroke={T.accentHi} strokeWidth={1} />
      {[1, 2, 3, 4, 5].map((e) => <PText key={e} x={lx(e)} y={gy + gh + 4} text={["10", "100", "1k", "10k", "100k"][e - 1]} fill={T.textDim} anchor="middle" />)}
      <PText x={gx + 4} y={gy + 4} text="train acc" fill={T.accentHi} />
      <PText x={gx + gw - 4} y={gy + gh - 22} text="val acc" fill={T.loss} anchor="end" />
      <PText x={gx} y={gy + gh + 14} text="steps. A sketch of the paper's result," fill={T.textDim} />
      <PText x={gx} y={gy + gh + 24} text="not a run (weight decay 1.0 drives it)" fill={T.textDim} />
    </g>
  );
}

/* ————— text diffusion ————— */
function TDInset({ theme: T, x, y }: { theme: Theme; x: number; y: number }) {
  const mask = maskLine(0.5);
  const masked = mask.map((m, i) => (m ? i : -1)).filter((i) => i >= 0);
  // unmasking order: ILLUSTRATIVE (the model reveals its most confident guess first)
  const order = useMemo(() => { const r = rng(12); return [...masked].sort(() => r() - 0.5); }, [masked.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const K = 64;
  const rounds: number[][] = [];
  let left = [...order];
  for (let s = 0; s < K && left.length; s++) {
    const k = Math.max(1, Math.floor(left.length / (K - s)));
    rounds.push(left.slice(0, k));
    left = left.slice(k);
  }
  const shown = (r: number) => new Set(rounds.slice(0, r).flat());
  return (
    <g>
      <PText x={x} y={y - 4} text="train: hide each char w.p. t = 0.5" fill={T.textDim} />
      {[...LINE].map((ch, i) => (
        <g key={i}>
          <rect x={x + i * 12} y={y + 6} width={11} height={11} fill={mask[i] ? T.accentLo : T.panel} />
          <PText x={x + i * 12 + 5} y={y + 8} text={mask[i] ? "" : show(ch)} fill={T.text} anchor="middle" />
          {mask[i] && <PText x={x + i * 12 + 5} y={y + 20} text={show(ch)} fill={T.loss} anchor="middle" />}
        </g>
      ))}
      <PText x={x} y={y + 30} text="red = what the loss asks for" fill={T.loss} />
      {/* attention: bidirectional vs causal */}
      <PText x={x} y={y + 46} text="who can see whom" fill={T.textDim} />
      {Array.from({ length: 13 }, (_, i) => Array.from({ length: 13 }, (_, j) => (
        <rect key={`${i}${j}`} x={x + j * 4} y={y + 58 + i * 4} width={3} height={3} fill={T.heat[5]} />
      )))}
      {Array.from({ length: 13 }, (_, i) => Array.from({ length: 13 }, (_, j) => (
        <rect key={`c${i}${j}`} x={x + 64 + j * 4} y={y + 58 + i * 4} width={3} height={3} fill={j <= i ? T.heat[5] : T.panel} />
      )))}
      <PText x={x} y={y + 112} text="this model" fill={T.wireHot} />
      <PText x={x + 64} y={y + 112} text="transformer" fill={T.textDim} />
      {/* generation ladder */}
      <PText x={x + 190} y={y - 4} text={`generate: ${K} rounds, each reveals`} fill={T.textDim} />
      {Array.from({ length: Math.min(rounds.length + 1, 10) }, (_, r) => {
        const rr = r === Math.min(rounds.length, 9) ? rounds.length : r;
        const sh = shown(rr);
        return (
          <g key={r}>
            <PText x={x + 190} y={y + 8 + r * 11} text={`_{${rr}}`} fill={T.textDim} />
            {[...LINE].map((ch, i) => {
              const vis = !mask[i] || sh.has(i);
              const fresh = rr > 0 && rounds[rr - 1]?.includes(i);
              return (
                <g key={i}>
                  <rect x={x + 204 + i * 10} y={y + 7 + r * 11} width={9} height={9} fill={vis ? (fresh ? T.accent : T.panel) : T.accentLo} />
                  {vis && <PText x={x + 204 + i * 10 + 4} y={y + 8 + r * 11} text={show(ch)} fill={fresh ? T.panel : T.text} anchor="middle" />}
                </g>
              );
            })}
          </g>
        );
      })}
      <PText x={x + 340} y={y + 6} text="max(1, hidden ÷ rounds left)" fill={T.text} />
      <PText x={x + 340} y={y + 20} text="the prompt's visible chars" fill={T.textDim} />
      <PText x={x + 340} y={y + 30} text="stay; one masked char is" fill={T.textDim} />
      <PText x={x + 340} y={y + 40} text="revealed per round here" fill={T.textDim} />
      <PText x={x + 340} y={y + 56} text="order shown is illustrative" fill={T.textDim} />
      <PText x={x + 340} y={y + 66} text="(no local checkpoint): the" fill={T.textDim} />
      <PText x={x + 340} y={y + 76} text="model reveals its most" fill={T.textDim} />
      <PText x={x + 340} y={y + 86} text="confident guess first" fill={T.textDim} />
    </g>
  );
}

const INSETS: Record<LMName, (p: { theme: Theme; x: number; y: number }) => ReactNode> = {
  moe: MoeInset, kimi: KimiInset, deepseek: DeepseekInset, grokking: GrokInset, text_diffusion: TDInset,
};

export function LMDiagram({ theme, name }: { theme: Theme; name: LMName }) {
  const T = theme;
  const Inset = INSETS[name];
  return (
    <g>
      <rect x={0} y={0} width={LM_VIEW.w} height={LM_VIEW.h} fill={T.ground} />
      <Spine theme={T} name={name} />
      <rect x={10} y={112} width={540} height={194} fill={T.panel} />
      <Frame x={10} y={112} w={540} h={194} fill={T.frame} />
      <PText x={20} y={120} text={INSET[name]} fill={T.wireHot} />
      <Inset theme={T} x={24} y={158} />
    </g>
  );
}

/* ————— cards: the inset's one key view ————— */
const CARD_CHIPS: Record<LMName, string> = {
  moe: "4 × (attention + experts)", kimi: "KDA ×3, full; twice; + global",
  deepseek: "CSA ×3, HCA; twice", grokking: "2 causal layers", text_diffusion: "4 bidirectional layers",
};
export function LMCard({ theme, name }: { theme: Theme; name: LMName }) {
  const T = theme;
  const chips = CHIPS[name];
  const cp = Math.min(20, Math.floor(180 / chips.length));
  return (
    <g>
      <rect x={0} y={0} width={LM_CARD_VIEW.w} height={LM_CARD_VIEW.h} fill={T.ground} />
      {chips.map((c, i) => (
        <g key={i}>
          <rect x={4 + i * cp} y={4} width={cp - 2} height={14} fill={c.hot ? T.accent : T.accentLo} />
        </g>
      ))}
      <PText x={4} y={20} text={CARD_CHIPS[name]} fill={T.textDim} />
      <g transform="translate(0 0)">
        {name === "grokking" && <GrokCard theme={T} />}
        {name === "text_diffusion" && <TDCard theme={T} />}
        {name === "deepseek" && <DSCard theme={T} />}
        {name === "kimi" && <KimiCard theme={T} />}
        {name === "moe" && <MoeCard theme={T} />}
      </g>
    </g>
  );
}
function GrokCard({ theme: T }: { theme: Theme }) {
  const d = useMemo(() => {
    const bits: number[] = [];
    for (const h of GROK_TRAIN_HEX) { const v = parseInt(h, 16); bits.push((v >> 3) & 1, (v >> 2) & 1, (v >> 1) & 1, v & 1); }
    let tr = "", k = 0;
    for (let a = 0; a < GROK_P; a++) for (let b = 1; b < GROK_P; b++) { if (bits[k++]) tr += `M${4 + a * 0.75} ${32 + b * 0.6}h.75v.6h-.75z`; }
    return tr;
  }, []);
  return (
    <g>
      <rect x={4} y={32} width={73} height={58} fill={T.panel} />
      <path d={d} fill={T.accent} />
      <PText x={4} y={94} text="train / held out" fill={T.textDim} />
      <PText x={90} y={34} text="a ÷ b mod 97" fill={T.text} />
      <PText x={90} y={46} text="train acc → 1" fill={T.accentHi} />
      <PText x={90} y={56} text="fast; val acc" fill={T.loss} />
      <PText x={90} y={66} text="jumps much" fill={T.loss} />
      <PText x={90} y={76} text="later (paper)" fill={T.loss} />
    </g>
  );
}
function TDCard({ theme: T }: { theme: Theme }) {
  const mask = maskLine(0.5);
  const masked = mask.map((m, i) => (m ? i : -1)).filter((i) => i >= 0);
  return (
    <g>
      {[0, 2, 4, masked.length].map((r, row) => (
        <g key={row}>
          {[...LINE].map((ch, i) => {
            const vis = !mask[i] || masked.indexOf(i) < r;
            return (
              <g key={i}>
                <rect x={10 + i * 13} y={32 + row * 16} width={12} height={12} fill={vis ? T.panel : T.accentLo} />
                {vis && <PText x={10 + i * 13 + 6} y={34 + row * 16} text={show(ch)} fill={T.text} anchor="middle" />}
              </g>
            );
          })}
        </g>
      ))}
      <PText x={10} y={96} text="unmask a few per round" fill={T.textDim} />
    </g>
  );
}
function DSCard({ theme: T }: { theme: Theme }) {
  const txt = SHAKESPEARE_64.slice(0, 32);
  return (
    <g>
      {[...txt].map((_, i) => <rect key={i} x={4 + i * 5.5} y={34} width={4.5} height={10} fill={i >= 16 ? T.accent : T.panel} />)}
      {Array.from({ length: 8 }, (_, e) => <rect key={e} x={4 + e * 22} y={50} width={20} height={10} fill={T.accentLo} />)}
      {Array.from({ length: 2 }, (_, e) => <rect key={e} x={4 + e * 88} y={66} width={86} height={10} fill={T.accent} />)}
      <PText x={4} y={82} text="raw, 4→1 (CSA), 16→1 (HCA)" fill={T.textDim} />
    </g>
  );
}
function KimiCard({ theme: T }: { theme: Theme }) {
  const al = [Math.exp(-5), Math.exp(-1), Math.exp(-0.25), 0.95];
  return (
    <g>
      {al.map((a, k) => Array.from({ length: 13 }, (_, d) => (
        <rect key={`${k}${d}`} x={60 + d * 9} y={32 + k * 11} width={8} height={9} fill={T.heat[heatIndex(Math.pow(a, d))]} />
      )))}
      {Array.from({ length: 13 }, (_, d) => <rect key={d} x={60 + d * 9} y={80} width={8} height={9} fill={T.heat[6]} />)}
      <PText x={4} y={34} text="KDA" fill={T.text} />
      <PText x={4} y={44} text="forgets" fill={T.textDim} />
      <PText x={4} y={81} text="full attn" fill={T.wireHot} />
      <PText x={60} y={93} text="steps back →" fill={T.textDim} />
    </g>
  );
}
function MoeCard({ theme: T }: { theme: Theme }) {
  return (
    <g>
      {[...LINE].map((ch, i) => (
        <g key={i}>
          <PText x={10 + i * 13} y={30} text={show(ch)} fill={T.text} anchor="middle" />
          <Wire pts={[[10 + i * 13, 40], [30 + routeOf(i) * 40, 70]]} fill={T.wireHot} step={2} />
        </g>
      ))}
      {[0, 1, 2, 3].map((e) => <Bars key={e} x={20 + e * 40} y={72} bars={6} h={12} theme={T} bw={2} gap={1} />)}
      <PText x={4} y={92} text="4 experts, top-1 (illustrative)" fill={T.textDim} />
    </g>
  );
}
void Diamond;
