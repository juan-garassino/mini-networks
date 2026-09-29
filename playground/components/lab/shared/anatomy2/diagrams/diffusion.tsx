"use client";

// DDPM anatomy, drawn from src/mini_networks/models/diffusion/{config,
// scheduler,model}.py. What is COMPUTED (exact, client-side):
//   · the forward chain q(x_t|x_0) = √ᾱ_t·x_0 + √(1−ᾱ_t)·ε on a real MNIST
//     test digit, ᾱ from the real linear schedule (T=1000, β 1e-4→0.02) and
//     one seeded ε (the closed-form jump, as scheduler.add_noise does);
//   · the x_t coefficients printed under x_t;
//   · the 128-d sinusoidal time embedding (get_time_embedding) at t, as a
//     waveform + cos/sin strips. Labels are paper-indexed (t=0 clean);
//     the network sees code index t−1.
// What is STRUCTURAL (from UNet.__init__): block order, resolutions
// 28→14→7→14→28 (height = 3 art px per image px), channels 32/64/128/128/
// 64/32/1 (1 bar = 32 channels; the 1-channel out_conv is a 1-px sliver),
// the two concat skips (e1→dec1, e2→dec2 — there is no e0 skip), self-
// attention over the 7×7 bottleneck, and the time wiring: t_emb feeds the
// six ResBlocks only (not enc0, attn or out_conv).
// What is the REAL NETWORK: ε̂ and its MSE come from the local champion
// (data/diffusion-champion.ts: mini-diffusion v1, raw weights, M-tier T=200,
// fed code index round(t/5)−1; exported every 25 steps + t=380, the nearest
// is shown and labelled when it differs from t).
import { useMemo, type PointerEvent } from "react";
import { MNIST_DIGITS, digitPixels } from "../data/mnist-digits";
import { abarT, addNoise, alphaBar, hexBytes, timeEmbedding, unNib } from "../math";
import { DIFF_EPS_HEX, DIFF_MSE, DIFF_PRED, DIFF_VERSION } from "../data/diffusion-champion";
import { Bars, Diamond, Frame, Node, PText, Thumb, Wire, barsWidth } from "../prims";
import type { Theme } from "../themes";

export const DIFFUSION_VIEW = { w: 560, h: 316 };
export const CHAIN_T = [0, 167, 333, 500, 667, 833, 1000];
const DIGIT = MNIST_DIGITS[2]; // test idx 1, a "2" — strokes survive long into the chain

// layout (art px)
const CH_Y = 10, TH = 56, CH_X0 = 16, CH_DX = 78;
const cx = (i: number) => CH_X0 + i * CH_DX + TH / 2;
const tx = (t: number) => cx(0) + (t / 1000) * (cx(6) - cx(0));
const BUS = 84, SUB = 97;
const XT = { x: 16, y: 130 };
const EH = { x: 440, y: 130 };    // ε̂ (prediction)
const EP = { x: 440, y: 226 };    // ε (true noise)
const DIA = { cx: 528, cy: 206 };
const TBUS = 296;
const LEVEL = [{ top: 116, h: 84 }, { top: 157, h: 42 }, { top: 186, h: 21 }]; // 28 / 14 / 7 px
const mid = (l: number) => LEVEL[l].top + Math.floor(LEVEL[l].h / 2);

interface Block { id: string; x: number; bars: number; lvl: number; ch: number; temb: boolean; attn?: boolean; bw?: number }
const CH_PER_BAR = 16;
const BW = 3, GAP = 2;
const BLOCKS: Block[] = [
  { id: "enc0", x: 88, bars: 2, lvl: 0, ch: 32, temb: false },
  { id: "enc1", x: 106, bars: 4, lvl: 0, ch: 64, temb: true },
  { id: "enc2", x: 150, bars: 8, lvl: 1, ch: 128, temb: true },
  { id: "mid1", x: 208, bars: 8, lvl: 2, ch: 128, temb: true },
  { id: "attn", x: 252, bars: 8, lvl: 2, ch: 128, temb: false, attn: true },
  { id: "mid2", x: 296, bars: 8, lvl: 2, ch: 128, temb: true },
  { id: "dec2", x: 354, bars: 4, lvl: 1, ch: 64, temb: true },
  { id: "dec1", x: 398, bars: 2, lvl: 0, ch: 32, temb: true },
  { id: "out", x: 418, bars: 1, lvl: 0, ch: 1, temb: false, bw: 1 },
];
const bw = (b: Block) => (b.bw ? b.bw : barsWidth(b.bars, BW, GAP));
const bcx = (b: Block) => b.x + Math.floor(bw(b) / 2);
const byId = (id: string) => BLOCKS.find((b) => b.id === id)!;

const fmt = (v: number) => (v >= 0.995 ? "1.00" : v.toFixed(2).replace(/^0/, ""));

export { DIFF_VERSION };

export function DiffusionDiagram({ theme, t, onT }: { theme: Theme; t: number; onT?: (t: number) => void }) {
  const base = useMemo(() => {
    const x0 = digitPixels(DIGIT);
    // ε: numpy RandomState(7).randn(784), stored as bytes (ε = (b − 128)/32) so
    // the browser and the champion export see the identical noise
    const eps = Float32Array.from(hexBytes(DIFF_EPS_HEX), (b) => (b - 128) / 32);
    const ab = alphaBar();
    const chain = CHAIN_T.map((ct) => addNoise(x0, eps, abarT(ab, ct)));
    return { x0, eps, ab, chain };
  }, []);
  const tt = Math.max(1, Math.min(1000, Math.round(t)));
  const abar = abarT(base.ab, tt);
  const xt = useMemo(() => addNoise(base.x0, base.eps, abar), [base, abar]);
  const emb = useMemo(() => timeEmbedding(tt - 1), [tt]);
  // champion ε̂: exported at t = 25, 50, … 1000 and 380; show the nearest
  const predT = tt === 380 ? 380 : Math.max(25, Math.min(1000, Math.round(tt / 25) * 25));
  const pred = useMemo(() => unNib(DIFF_PRED[String(predT) as keyof typeof DIFF_PRED]), [predT]);
  const mse = DIFF_MSE[String(predT) as keyof typeof DIFF_MSE];

  const T = theme;
  const xT = Math.round(tx(tt));
  const nearest = CHAIN_T.reduce((b, v, i) => (Math.abs(v - tt) < Math.abs(CHAIN_T[b] - tt) ? i : b), 0);

  // waveform + strips of the 128-d embedding (64 cos + 64 sin)
  const PX = 15, PY = 232;
  let cosD = "", sinD = "";
  const stripC: string[] = Array(8).fill(""), stripS: string[] = Array(8).fill("");
  for (let k = 0; k < 64; k++) {
    const yc = PY + 2 + Math.round(((1 - emb.cos[k]) / 2) * 12);
    const ys = PY + 2 + Math.round(((1 - emb.sin[k]) / 2) * 12);
    cosD += `M${PX + 1 + k} ${yc}h1v1h-1z`;
    sinD += `M${PX + 1 + k} ${ys}h1v1h-1z`;
    const lc = Math.max(0, Math.min(7, Math.floor(((emb.cos[k] + 1) / 2) * 8)));
    const ls = Math.max(0, Math.min(7, Math.floor(((emb.sin[k] + 1) / 2) * 8)));
    stripC[lc] += `M${PX + 1 + k} ${PY + 17}h1v3h-1z`;
    stripS[ls] += `M${PX + 1 + k} ${PY + 21}h1v3h-1z`;
  }

  const links: [number, number][][] = [];
  const L = (a: [number, number], b: [number, number]) => links.push([a, b]);
  const e = (id: string) => byId(id);
  L([XT.x + TH, mid(0)], [e("enc0").x - 1, mid(0)]);
  L([e("enc0").x + bw(e("enc0")), mid(0)], [e("enc1").x - 1, mid(0)]);
  L([e("enc1").x + bw(e("enc1")), mid(0)], [e("enc2").x - 1, mid(1)]);
  L([e("enc2").x + bw(e("enc2")), mid(1)], [e("mid1").x - 1, mid(2)]);
  L([e("mid1").x + bw(e("mid1")), mid(2)], [e("attn").x - 1, mid(2)]);
  L([e("attn").x + bw(e("attn")), mid(2)], [e("mid2").x - 1, mid(2)]);
  L([e("mid2").x + bw(e("mid2")), mid(2)], [e("dec2").x - 1, mid(1)]);
  L([e("dec2").x + bw(e("dec2")), mid(1)], [e("dec1").x - 1, mid(0)]);
  L([e("dec1").x + bw(e("dec1")), mid(0)], [e("out").x - 1, mid(0)]);
  L([e("out").x + 1, mid(0)], [EH.x - 2, mid(0)]);

  const scrub = (ev: PointerEvent<SVGRectElement>) => {
    const svg = ev.currentTarget.ownerSVGElement;
    const m = svg?.getScreenCTM();
    if (!svg || !m || !onT) return;
    const x = (ev.clientX - m.e) / m.a;
    onT(((x - cx(0)) / (cx(6) - cx(0))) * 1000);
  };

  const labelY = (b: Block) => LEVEL[b.lvl].top + LEVEL[b.lvl].h + 3;

  return (
    <g>
      <rect x={0} y={0} width={DIFFUSION_VIEW.w} height={DIFFUSION_VIEW.h} fill={T.ground} />

      {/* ——— forward chain q(x_t | x_0) ——— */}
      {CHAIN_T.map((ct, i) => {
        const x = CH_X0 + i * CH_DX;
        return (
          <g key={ct} onClick={onT ? () => onT(Math.max(1, ct)) : undefined} style={onT ? { cursor: "pointer" } : undefined}>
            <Thumb x={x} y={CH_Y} data={base.chain[i]} theme={T} />
            {i === nearest && <Frame x={x - 2} y={CH_Y - 2} w={TH + 4} h={TH + 4} fill={T.wireHot} />}
            {/* signal gauge: √ᾱ_t of the clean digit left in this frame */}
            <rect x={x} y={CH_Y + TH + 2} width={TH} height={2} fill={T.panel} />
            <rect x={x} y={CH_Y + TH + 2} width={Math.max(1, Math.round(TH * Math.sqrt(abarT(base.ab, ct))))} height={2} fill={T.accent} />
            <PText x={cx(i)} y={CH_Y + TH + 6} text={String(ct)} fill={i === nearest ? T.wireHot : T.text} anchor="middle" />
            <Wire pts={[[cx(i), CH_Y + TH + 15], [cx(i), BUS]]} fill={T.wire} />
            {i < 6 && (
              <>
                <PText x={x + TH + 11} y={CH_Y + 15} text="→" fill={T.wire} anchor="middle" />
                <PText x={x + TH + 11} y={CH_Y + 32} text="←" fill={T.wire} anchor="middle" />
              </>
            )}
          </g>
        );
      })}
      {/* bus under the chain; the live segment carries x_t down to the network */}
      <Wire pts={[[cx(0), BUS], [cx(6), BUS]]} fill={T.wire} />
      <Wire pts={[[xT, BUS], [cx(0), BUS], [cx(0), XT.y - 3]]} fill={T.wireHot} />
      <rect x={xT - 2} y={BUS - 2} width={5} height={5} fill={T.wireHot} />
      <rect x={xT} y={BUS} width={1} height={1} fill={T.ground} />
      {onT && (
        // drag along the bus to scrub t (keyboard ←/→ lives on the wrapper)
        <rect
          x={cx(0) - 6} y={BUS - 8} width={cx(6) - cx(0) + 12} height={16} fill="transparent"
          style={{ cursor: "ew-resize", touchAction: "none" }}
          onPointerDown={(ev) => { ev.currentTarget.setPointerCapture(ev.pointerId); scrub(ev); }}
          onPointerMove={(ev) => { if (ev.buttons & 1) scrub(ev); }}
        />
      )}

      {/* ——— reverse step: x_{t−1} = (x_t − β_t/√(1−ᾱ_t)·ε̂)/√α_t + σz ——— */}
      <Wire pts={[[XT.x + 6, XT.y - 3], [XT.x + 6, SUB], [272, SUB]]} fill={T.wire} />
      <Wire pts={[[EH.x + TH / 2, EH.y - 3], [EH.x + TH / 2, SUB], [284, SUB]]} fill={T.wire} />
      <Wire pts={[[278, SUB - 6], [278, BUS + 1]]} fill={T.wire} />
      <Node cx={278} cy={SUB} glyph="−" theme={T} />
      <PText x={286} y={BUS + 2} text="x_{t-1}" fill={T.textDim} />

      {/* ——— U-Net ε_θ(x_t, t) ——— */}
      {links.map((pts, i) => <Wire key={i} pts={pts} fill={T.accentLo} step={1} />)}
      {/* concat skips (enc1 → dec1, enc2 → dec2) */}
      <Wire pts={[[bcx(e("enc1")), LEVEL[0].top - 2], [bcx(e("enc1")), 106], [bcx(e("dec1")), 106], [bcx(e("dec1")), LEVEL[0].top - 2]]} fill={T.wire} />
      <Wire pts={[[bcx(e("enc2")), LEVEL[1].top - 2], [bcx(e("enc2")), 140], [bcx(e("dec2")), 140], [bcx(e("dec2")), LEVEL[1].top - 2]]} fill={T.wire} />
      <PText x={bcx(e("attn"))} y={130} text="skip = concat" fill={T.textDim} anchor="middle" />

      {BLOCKS.map((b) => {
        const { top, h } = LEVEL[b.lvl];
        if (b.attn) {
          const w = bw(b);
          let d = "";
          for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < 7; gx++) d += `M${b.x + 4 + gx * 5} ${top + 2 + gy * 3}h1v1h-1z`;
          return (
            <g key={b.id}>
              <Frame x={b.x} y={top} w={w} h={h} fill={T.accent} />
              <path d={d} fill={T.accentHi} />
            </g>
          );
        }
        // decoder bars carry a few lit pixels: the features the skip handed back
        const detail = b.id.startsWith("dec") ? (bar: number) => Array.from({ length: Math.floor(h / 9) }, (_, k) => 4 + k * 9 + ((bar * 5) % 7)) : undefined;
        return <Bars key={b.id} x={b.x} y={top} bars={b.bars} h={h} theme={T} bw={b.bw ?? BW} gap={GAP} detail={detail} />;
      })}
      {BLOCKS.map((b) => (
        <PText key={`c${b.id}`} x={bcx(b) + (b.bw === 1 ? 1 : 0)} y={labelY(b)} text={b.attn ? "attn" : `_{${b.ch}}`} fill={T.textDim} anchor="middle" />
      ))}

      {/* x_t with its real coefficients */}
      <Thumb x={XT.x} y={XT.y} data={xt} theme={T} />
      <Frame x={XT.x - 2} y={XT.y - 2} w={TH + 4} h={TH + 4} fill={T.wireHot} />
      <PText x={XT.x} y={XT.y + TH + 5} text={`x_t=${fmt(Math.sqrt(abar))}x_0`} fill={T.text} />
      <PText x={XT.x} y={XT.y + TH + 16} text={`+${fmt(Math.sqrt(1 - abar))}ε`} fill={T.text} />

      {/* ——— timestep embedding (real sinusoid at t) → MLP → every ResBlock ——— */}
      <rect x={PX} y={PY} width={66} height={27} fill={T.panel} />
      <Frame x={PX} y={PY} w={66} h={27} fill={T.frame} />
      <path d={sinD} fill={T.textDim} />
      <path d={cosD} fill={T.accentHi} />
      {stripC.map((d, i) => (d ? <path key={`c${i}`} d={d} fill={T.ramp[i]} /> : null))}
      {stripS.map((d, i) => (d ? <path key={`s${i}`} d={d} fill={T.ramp[i]} /> : null))}
      <PText x={PX} y={PY + 32} text={`T ${tt}`} fill={T.wireHot} s={2} />

      <Wire pts={[[PX + 67, PY + 13], [92, PY + 13]]} fill={T.wire} />
      <rect x={92} y={PY + 7} width={21} height={13} fill={T.panel} />
      <Frame x={92} y={PY + 7} w={21} h={13} fill={T.frame} />
      <PText x={103} y={PY + 10} text="mlp" fill={T.text} anchor="middle" />
      <Wire pts={[[102, PY + 21], [102, TBUS], [bcx(e("dec1")), TBUS]]} fill={T.wire} />
      {BLOCKS.filter((b) => b.temb).map((b) => (
        <Wire key={`t${b.id}`} pts={[[bcx(b), TBUS], [bcx(b), labelY(b) + 8]]} fill={T.wire} />
      ))}

      {/* ——— prediction vs truth → loss ——— */}
      <Thumb x={EH.x} y={EH.y} data={pred} theme={T} />
      <PText x={EH.x} y={EH.y + TH + 5} text="Ɛ_θ(x_t,t)" fill={T.text} />
      <PText x={EH.x} y={EH.y + TH + 16} text={predT === tt ? "champion" : `champion t${predT}`} fill={T.textDim} />
      <Thumb x={EP.x} y={EP.y} data={base.eps} theme={T} />
      <PText x={EP.x} y={EP.y + TH + 5} text="ε ~ N(0,I)" fill={T.text} />
      <Wire pts={[[EH.x + TH + 2, EH.y + TH - 6], [DIA.cx - 6, DIA.cy - 1]]} fill={T.wire} />
      <Wire pts={[[EP.x + TH + 2, EP.y + 12], [DIA.cx - 6, DIA.cy + 1]]} fill={T.wire} />
      <Diamond cx={DIA.cx} cy={DIA.cy} theme={T} />
      <PText x={DIA.cx + 1} y={DIA.cy + 10} text="MSE" fill={T.loss} anchor="middle" />
      <PText x={DIA.cx + 1} y={DIA.cy + 20} text={mse.toFixed(2).replace(/^0/, "")} fill={T.loss} anchor="middle" />

      <rect x={14} y={TBUS + 8} width={12} height={2} fill={T.accent} />
      <PText x={30} y={TBUS + 6} text="gauge = √ᾱ_t, signal left" fill={T.textDim} />
      <PText x={DIFFUSION_VIEW.w - 14} y={TBUS + 6} text={`1 bar = ${CH_PER_BAR} channels   height = 28, 14, 7 px`} fill={T.textDim} anchor="end" />
    </g>
  );
}

// ————— card: the same truths at 190 art px (fits a ~380px card at ×2) —————
export const DIFFUSION_CARD_VIEW = { w: 190, h: 112 };
const CARD_T = [0, 250, 500, 750, 1000];
// U-Net at 1 bar = 32 channels, 1-px bars, height = resolution (28/14/7)
const CARD_BLOCKS: { x: number; bars: number; lvl: number }[] = [
  { x: 42, bars: 1, lvl: 0 }, { x: 47, bars: 2, lvl: 0 }, { x: 58, bars: 4, lvl: 1 },
  { x: 72, bars: 4, lvl: 2 }, { x: 82, bars: 4, lvl: 2 }, { x: 92, bars: 4, lvl: 2 },
  { x: 106, bars: 2, lvl: 1 }, { x: 116, bars: 1, lvl: 0 },
];

export function DiffusionCard({ theme, t }: { theme: Theme; t: number }) {
  const T = theme;
  const base = useMemo(() => {
    const x0 = digitPixels(DIGIT);
    const eps = Float32Array.from(hexBytes(DIFF_EPS_HEX), (b) => (b - 128) / 32);
    const ab = alphaBar();
    return { x0, eps, ab, chain: CARD_T.map((ct) => addNoise(x0, eps, abarT(ab, ct))) };
  }, []);
  const tt = Math.max(1, Math.min(1000, Math.round(t)));
  const xt = addNoise(base.x0, base.eps, abarT(base.ab, tt));
  const predT = tt === 380 ? 380 : Math.max(25, Math.min(1000, Math.round(tt / 25) * 25));
  const pred = unNib(DIFF_PRED[String(predT) as keyof typeof DIFF_PRED]);
  const mse = DIFF_MSE[String(predT) as keyof typeof DIFF_MSE];
  const top = [62, 69, 72], hh = [28, 14, 7];
  const cy = (l: number) => top[l] + Math.floor(hh[l] / 2);
  const bwid = (n: number) => n * 2 - 1;
  return (
    <g>
      <rect x={0} y={0} width={DIFFUSION_CARD_VIEW.w} height={DIFFUSION_CARD_VIEW.h} fill={T.ground} />
      {CARD_T.map((ct, i) => (
        <g key={ct}>
          <Thumb x={6 + i * 37} y={6} data={base.chain[i]} px={1} theme={T} />
          <PText x={20 + i * 37} y={38} text={`_{${ct}}`} fill={T.textDim} anchor="middle" />
          {i < 4 && <PText x={37 + i * 37} y={14} text="→" fill={T.wire} anchor="middle" />}
        </g>
      ))}
      <Wire pts={[[20 + (tt / 1000) * 148, 50], [20, 50], [20, 58]]} fill={T.wireHot} />
      <rect x={Math.round(19 + (tt / 1000) * 148)} y={49} width={3} height={3} fill={T.wireHot} />
      <Thumb x={6} y={62} data={xt} px={1} theme={T} />
      <Frame x={4} y={60} w={32} h={32} fill={T.wireHot} />
      <PText x={6} y={96} text={`T ${tt}`} fill={T.wireHot} />
      {/* skips e1→dec1, e2→dec2 */}
      <Wire pts={[[48, 60], [48, 55], [116, 55], [116, 60]]} fill={T.wire} />
      <Wire pts={[[61, 67], [61, 64], [107, 64], [107, 67]]} fill={T.wire} />
      {CARD_BLOCKS.map((b, i) => {
        const nx = CARD_BLOCKS[i + 1];
        return (
          <g key={i}>
            {nx && <Wire pts={[[b.x + bwid(b.bars), cy(b.lvl)], [nx.x - 1, cy(nx.lvl)]]} fill={T.accentLo} step={1} />}
            {Array.from({ length: b.bars }, (_, k) => (
              <rect key={k} x={b.x + k * 2} y={top[b.lvl]} width={1} height={hh[b.lvl]} fill={i === 4 ? T.accentHi : T.accent} />
            ))}
          </g>
        );
      })}
      <Wire pts={[[37, cy(0)], [41, cy(0)]]} fill={T.accentLo} step={1} />
      <Wire pts={[[117, cy(0)], [125, cy(0)]]} fill={T.accentLo} step={1} />
      <Thumb x={126} y={62} data={pred} px={1} theme={T} />
      <PText x={126} y={96} text="Ɛ_θ" fill={T.text} />
      <Wire pts={[[155, 76], [168, 76]]} fill={T.wire} />
      <Diamond cx={175} cy={76} r={5} theme={T} />
      <PText x={176} y={85} text={mse.toFixed(2).replace(/^0/, "")} fill={T.loss} anchor="middle" />
      <PText x={176} y={95} text="vs ε" fill={T.textDim} anchor="middle" />
    </g>
  );
}
