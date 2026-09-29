"use client";

// VAE anatomy, from src/mini_networks/models/vae/{config,model}.py:
// encode [1,28,28] → Conv s2 (32) → Conv s2 (64) → [64,7,7] → flatten 3136 →
// fc_mu / fc_logvar (32 each); z = μ + σ·ε; decode Linear 32→3136 → [64,7,7]
// → ConvT s2 (32) → ConvT s2 (1) → sigmoid; loss = MSE + β·KL, β = 0.0015.
//
// REAL: the 10 input digits (MNIST test), the architecture, β.
// STAND-IN (labelled on the drawing): the local mini-vae champion is a stale,
// fully collapsed checkpoint (every μ≈0, σ≈1 — the pre-fix β=1 era), so the
// latent plane and decoder output use 2-component PCA of these ten digits,
// computed here — what a *linear* VAE converges to (probabilistic PCA). σ on
// the plane is a fixed illustrative radius.
import { useEffect, useMemo, useState, type MutableRefObject } from "react";
import { MNIST_DIGITS, digitPixels } from "../data/mnist-digits";
import { gaussian } from "../math";
import { Bars, Diamond, Frame, PText, Thumb, Wire } from "../prims";
import type { Theme } from "../themes";
import type { KeyHandler } from "./types";

export const VAE_VIEW = { w: 560, h: 316 };
const BETA = 0.0015; // VAEConfig.beta
const LATENT = 32;   // VAEConfig.latent_dim
const SIGMA = 0.35;  // illustrative posterior σ on the plane (in prior units)
const IN = { x: 16, y: 122 };
const PLANE = { x: 196, y: 70, s: 144 }; // square, centre = origin
const OUT = { x: 436, y: 122 };
const GEN = { x: 436, y: 232 };
const CY = IN.y + 28;

function pca2(X: Float32Array[]) {
  const n = X.length, d = X[0].length;
  const mean = new Float32Array(d);
  for (const x of X) for (let j = 0; j < d; j++) mean[j] += x[j] / n;
  const Xc = X.map((x) => x.map((v, j) => v - mean[j]));
  const G = Xc.map((a) => Xc.map((b) => a.reduce((s, v, j) => s + v * b[j], 0)));
  const comps: Float32Array[] = [];
  const Gd = G.map((r) => [...r]);
  for (let c = 0; c < 2; c++) {
    let v = Array.from({ length: n }, (_, i) => 1 + i * 0.01);
    for (let it = 0; it < 200; it++) {
      const w = Gd.map((r) => r.reduce((s, g, j) => s + g * v[j], 0));
      const nrm = Math.hypot(...w) || 1;
      v = w.map((x) => x / nrm);
    }
    const lam = Gd.reduce((s, r, i) => s + v[i] * r.reduce((t, g, j) => t + g * v[j], 0), 0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) Gd[i][j] -= lam * v[i] * v[j];
    const u = new Float32Array(d);
    for (let i = 0; i < n; i++) for (let j = 0; j < d; j++) u[j] += v[i] * Xc[i][j];
    const un = Math.hypot(...u) || 1;
    comps.push(u.map((x) => x / un));
  }
  const Z = Xc.map((x) => comps.map((u) => x.reduce((s, v, j) => s + v * u[j], 0)));
  const sd = [0, 1].map((k) => Math.sqrt(Z.reduce((s, z) => s + z[k] * z[k], 0) / n) || 1);
  const decode = (z: number[]) => mean.map((m, j) => m + z[0] * sd[0] * comps[0][j] + z[1] * sd[1] * comps[1][j]);
  return { Z: Z.map((z) => [z[0] / sd[0], z[1] / sd[1]]), decode };
}

/** pixel ellipse outline, radii rx, ry around (cx, cy) */
function ellipse(cx: number, cy: number, rx: number, ry: number, step = 1): string {
  let d = "";
  const seen = new Set<string>();
  const n = Math.max(24, Math.round((rx + ry) * 4));
  for (let k = 0; k < n; k += step) {
    const a = (k / n) * Math.PI * 2;
    const x = Math.round(cx + rx * Math.cos(a)), y = Math.round(cy + ry * Math.sin(a));
    const key = `${x},${y}`;
    if (!seen.has(key)) { seen.add(key); d += `M${x} ${y}h1v1h-1z`; }
  }
  return d;
}

export function VAEDiagram({ theme, still, keys }: { theme: Theme; still: boolean; keys?: MutableRefObject<KeyHandler | null> }) {
  const T = theme;
  const [focus, setFocus] = useState(3);
  const f = still ? 3 : focus;
  const model = useMemo(() => {
    const X = MNIST_DIGITS.map(digitPixels);
    const p = pca2(X);
    const e = gaussian(2, 5);
    const g = gaussian(2, 21);
    return { X, ...p, e, gen: p.decode([g[0], g[1]]), g };
  }, []);

  useEffect(() => {
    if (!keys || still) return;
    keys.current = (ev) => {
      if (ev.key === "ArrowRight") { setFocus((v) => (v + 1) % 10); return true; }
      if (ev.key === "ArrowLeft") { setFocus((v) => (v + 9) % 10); return true; }
      return false;
    };
    return () => { keys.current = null; };
  }, [keys, still]);

  // scale so every digit (plus its σ ring) and the 2σ prior ring fit
  const maxAbs = Math.max(2.2, ...model.Z.flat().map((v) => Math.abs(v) + SIGMA + 0.25));
  const R = (PLANE.s / 2 - 4) / maxAbs;
  const mu = model.Z[f];
  const z = [mu[0] + SIGMA * model.e[0], mu[1] + SIGMA * model.e[1]];
  const recon = model.decode(z);
  const px = (v: number) => Math.round(PLANE.x + PLANE.s / 2 + v * R);
  const py = (v: number) => Math.round(PLANE.y + PLANE.s / 2 - v * R);
  const o = { x: px(0), y: py(0) };

  return (
    <g>
      <rect x={0} y={0} width={VAE_VIEW.w} height={VAE_VIEW.h} fill={T.ground} />

      {/* ——— encoder: resolution 28 → 14 → 7, 1 bar = 16 channels ——— */}
      <PText x={IN.x} y={IN.y - 14} text="image" fill={T.textDim} />
      <PText x={84} y={IN.y - 14} text="encoder" fill={T.textDim} />
      <Thumb x={IN.x} y={IN.y} data={model.X[f]} theme={T} />
      <PText x={IN.x} y={IN.y + 61} text={`test, a ${f}`} fill={T.textDim} />
      <Wire pts={[[IN.x + 58, CY], [84, CY]]} fill={T.accentLo} step={1} />
      <Bars x={86} y={CY - 21} bars={2} h={42} theme={T} bw={3} gap={2} />
      <Wire pts={[[95, CY], [104, CY]]} fill={T.accentLo} step={1} />
      <Bars x={106} y={CY - 10} bars={4} h={21} theme={T} bw={3} gap={2} />
      <PText x={86} y={CY + 26} text="_{32}" fill={T.textDim} />
      <PText x={108} y={CY + 26} text="_{64}" fill={T.textDim} />
      <Wire pts={[[125, CY], [140, CY]]} fill={T.accentLo} step={1} />
      {/* μ and log σ² heads: 32 numbers each (drawn as 32 cells) */}
      {[0, 1].map((h) => (
        <g key={h}>
          {Array.from({ length: LATENT }, (_, k) => (
            <rect key={k} x={142 + h * 14} y={CY - 48 + k * 3} width={8} height={2}
              fill={k === 0 || k === 1 ? (h === 0 ? T.wireHot : T.accentHi) : h === 0 ? T.accent : T.accentLo} />
          ))}
          <PText x={146 + h * 14} y={h === 0 ? CY - 60 : CY - 70} text={h === 0 ? "μ" : "logσ²"} fill={T.text} anchor="middle" />
        </g>
      ))}
      <PText x={142} y={CY + 52} text="_{32}" fill={T.textDim} />
      <PText x={156} y={CY + 52} text="_{32}" fill={T.textDim} />
      <Wire pts={[[166, CY - 47], [PLANE.x - 4, CY - 47], [PLANE.x - 4, o.y], [PLANE.x, o.y]]} fill={T.wire} />

      {/* ——— the latent plane (2 of 32 dims) ——— */}
      <rect x={PLANE.x} y={PLANE.y} width={PLANE.s} height={PLANE.s} fill={T.panel} />
      <Frame x={PLANE.x - 1} y={PLANE.y - 1} w={PLANE.s + 2} h={PLANE.s + 2} fill={T.frame} />
      <Wire pts={[[PLANE.x, o.y], [PLANE.x + PLANE.s - 1, o.y]]} fill={T.frame} step={3} />
      <Wire pts={[[o.x, PLANE.y], [o.x, PLANE.y + PLANE.s - 1]]} fill={T.frame} step={3} />
      {/* the prior N(0, I): 1σ and 2σ rings */}
      <path d={ellipse(o.x, o.y, R, R, 2)} fill={T.textDim} />
      <path d={ellipse(o.x, o.y, 2 * R, 2 * R, 3)} fill={T.frame} />
      <PText x={o.x + Math.round(2 * R * 0.72) + 3} y={o.y - Math.round(2 * R * 0.72) - 8} text="N(0,I)" fill={T.textDim} />
      {model.Z.map((m, k) => (
        <g key={k} onClick={!still ? () => setFocus(k) : undefined} style={!still ? { cursor: "pointer" } : undefined}>
          <PText x={px(m[0]) + 1} y={py(m[1]) - 3} text={String(k)} fill={k === f ? T.wireHot : T.text} anchor="middle" />
        </g>
      ))}
      {/* q(z|x): μ ± σ, and the reparameterised draw z = μ + σ·ε */}
      <path d={ellipse(px(mu[0]), py(mu[1]), SIGMA * R, SIGMA * R)} fill={T.wireHot} />
      <Wire pts={[[px(mu[0]), py(mu[1])], [px(z[0]), py(z[1])]]} fill={T.loss} step={1} />
      <path d={`M${px(z[0]) - 2} ${py(z[1]) - 2}h1v1h-1z M${px(z[0]) + 2} ${py(z[1]) - 2}h1v1h-1z M${px(z[0]) - 1} ${py(z[1]) - 1}h3v3h-3z M${px(z[0]) - 2} ${py(z[1]) + 2}h1v1h-1z M${px(z[0]) + 2} ${py(z[1]) + 2}h1v1h-1z`} fill={T.loss} />
      <PText x={PLANE.x} y={PLANE.y - 22} text="latent, 2 of 32 dims" fill={T.textDim} />
      <PText x={PLANE.x} y={PLANE.y - 12} text="z = μ + σ·ε" fill={T.loss} />
      <PText x={PLANE.x} y={PLANE.y + PLANE.s + 5} text="stand-in: PCA of these 10 digits" fill={T.textDim} />
      <PText x={PLANE.x} y={PLANE.y + PLANE.s + 15} text="(a linear VAE learns exactly this)" fill={T.textDim} />

      {/* ——— decoder: 32 → 3136 → 7 → 14 → 28 ——— */}
      <PText x={356} y={IN.y - 14} text="decoder" fill={T.textDim} />
      <Wire pts={[[px(z[0]), py(z[1])], [PLANE.x + PLANE.s + 6, py(z[1])], [PLANE.x + PLANE.s + 6, CY], [354, CY]]} fill={T.wire} />
      <Bars x={356} y={CY - 10} bars={4} h={21} theme={T} bw={3} gap={2} />
      <Wire pts={[[375, CY], [384, CY]]} fill={T.accentLo} step={1} />
      <Bars x={386} y={CY - 21} bars={2} h={42} theme={T} bw={3} gap={2} />
      <Wire pts={[[395, CY], [410, CY]]} fill={T.accentLo} step={1} />
      <rect x={412} y={CY - 42} width={1} height={84} fill={T.accentHi} />
      <Wire pts={[[413, CY], [OUT.x - 2, CY]]} fill={T.accentLo} step={1} />
      <PText x={358} y={CY + 26} text="_{64}" fill={T.textDim} />
      <PText x={388} y={CY + 26} text="_{32}" fill={T.textDim} />
      <PText x={411} y={CY + 47} text="_{1}" fill={T.textDim} />

      <PText x={OUT.x} y={OUT.y - 12} text="reconstruction" fill={T.text} />
      <Thumb x={OUT.x} y={OUT.y} data={recon} theme={T} />
      <PText x={OUT.x} y={OUT.y + 61} text="stand-in" fill={T.textDim} />

      {/* loss */}
      <Wire pts={[[OUT.x + 58, CY], [524, CY], [524, CY + 40]]} fill={T.wire} />
      <Wire pts={[[IN.x + 28, IN.y + 70], [IN.x + 28, 300], [524, 300], [524, CY + 56]]} fill={T.wire} />
      <Diamond cx={524} cy={CY + 48} theme={T} />
      <PText x={522} y={CY + 60} text="MSE" fill={T.loss} anchor="end" />
      <PText x={522} y={CY + 70} text={`+${BETA}·KL`} fill={T.loss} anchor="end" />

      {/* a fresh z from the prior, decoded */}
      <Wire pts={[[o.x, o.y], [o.x, PLANE.y + PLANE.s + 26], [GEN.x - 6, PLANE.y + PLANE.s + 26], [GEN.x - 6, GEN.y + 28], [GEN.x - 2, GEN.y + 28]]} fill={T.wire} step={3} />
      <Thumb x={GEN.x} y={GEN.y} data={model.gen} theme={T} />
      <PText x={GEN.x + 60} y={GEN.y + 20} text="z ~ N(0,I)" fill={T.textDim} />
      <PText x={GEN.x + 60} y={GEN.y + 30} text="decoded" fill={T.textDim} />
    </g>
  );
}

// ————— card: digit → encoder → latent plane → decoder → reconstruction —————
export const VAE_CARD_VIEW = { w: 190, h: 100 };

export function VAECard({ theme }: { theme: Theme }) {
  const T = theme;
  const m = useMemo(() => {
    const X = MNIST_DIGITS.map(digitPixels);
    const p = pca2(X);
    return { X, ...p };
  }, []);
  const f = 3;
  const P = { x: 62, y: 14, s: 66 };
  const maxAbs = Math.max(2.2, ...m.Z.flat().map((v) => Math.abs(v) + SIGMA + 0.25));
  const r = (P.s / 2 - 3) / maxAbs;
  const px = (v: number) => Math.round(P.x + P.s / 2 + v * r);
  const py = (v: number) => Math.round(P.y + P.s / 2 - v * r);
  const mu = m.Z[f];
  return (
    <g>
      <rect x={0} y={0} width={VAE_CARD_VIEW.w} height={VAE_CARD_VIEW.h} fill={T.ground} />
      <Thumb x={4} y={33} data={m.X[f]} px={1} theme={T} />
      <Bars x={38} y={37} bars={2} h={14} theme={T} bw={1} gap={1} />
      <Bars x={44} y={44} bars={4} h={7} theme={T} bw={1} gap={1} />
      <Wire pts={[[52, 47], [P.x - 2, 47]]} fill={T.wire} />
      <rect x={P.x} y={P.y} width={P.s} height={P.s} fill={T.panel} />
      <path d={ellipse(px(0), py(0), r, r, 2)} fill={T.textDim} />
      {m.Z.map((z, k) => <PText key={k} x={px(z[0]) + 1} y={py(z[1]) - 3} text={`_{${k}}`} fill={k === f ? T.wireHot : T.text} anchor="middle" />)}
      <path d={ellipse(px(mu[0]), py(mu[1]), SIGMA * r + 1, SIGMA * r + 1)} fill={T.wireHot} />
      <Wire pts={[[P.x + P.s + 2, 47], [134, 47]]} fill={T.wire} />
      <Bars x={136} y={44} bars={4} h={7} theme={T} bw={1} gap={1} />
      <Bars x={145} y={37} bars={2} h={14} theme={T} bw={1} gap={1} />
      <Thumb x={156} y={33} data={m.decode(mu)} px={1} theme={T} />
      <PText x={P.x} y={P.y + P.s + 4} text="latent: PCA stand-in" fill={T.textDim} />
      <PText x={4} y={4} text="image" fill={T.textDim} />
      <PText x={186} y={4} text="rebuilt" fill={T.textDim} anchor="end" />
    </g>
  );
}
