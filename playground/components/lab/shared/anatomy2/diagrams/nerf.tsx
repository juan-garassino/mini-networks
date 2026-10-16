"use client";

// NeRF anatomy (atom: introduces neural-field-rendering), drawn from
// src/mini_networks/models/nerf/{scene,model,trainer}.py:
//
//   camera on a 35° orbit (r 2.5) → 32×32 = 1024 rays from ONE pinhole →
//   S samples per ray on t ∈ [near 1, far 4] (S 25 / M 200, bin midpoints at
//   eval) → γ(x, y, z): 6 freqs × sin/cos × 3 = 36 (NO view direction) →
//   MLP 36 → 128 → 128 → 128 → 128 → 4 → σ = softplus, c = sigmoid →
//   α_i = 1 − exp(−σ_i dt_i), T_i = Π_{j<i}(1 − α_j), w_i = T_i α_i,
//   C = Σ w_i c_i → MSE against the training-view pixel.
//
// EXACT (data/nerf-scene.ts, numpy transcription of scene.py, no model): the
// scene (MNIST train #37542, a 6, ink > .3 extruded to 28×28×8, lying flat,
// z up), the ground-truth views (v = 2R + B − 1 is the whole view, since G = R),
// the camera / ray-fan geometry, the hot ray's TRUE-field σ / α / T / w / c at
// the 200 M samples (nerf-ray.ts, node-tested), and γ of its entry point. NOT
// SHOWN (no local nerf checkpoint): the MLP's weights, its σ̂/ĉ, the predicted
// view, the loss value. wireHot = only the introduced idea: the hot ray, its
// sample strip's weights (+ the σ>0 run bar and its Σw), the Σ compositing
// node and the one target pixel.
// The voxels feed ONLY the GT views — no wire runs from the slab to the model:
// the MLP's input point comes off the ray (p = o + t·d).
import { useMemo, type MutableRefObject, type ReactNode } from "react";
import {
  NERF_CFG, NERF_FAN_DEG, NERF_HOT, NERF_OCC, NERF_PE, NERF_REF, NERF_SECTION, NERF_SECTION_CARD, NERF_VIEWS,
} from "../data/nerf-scene";
import { unNib } from "../math";
import { Bars, Diamond, Frame, Node, PText, Thumb, Wire } from "../prims";
import { useTick } from "../tick";
import { heatIndex, rampIndex, type Theme } from "../themes";
import { layerV, RAY_S as S, rayProfile } from "./nerf-ray";
import type { KeyHandler } from "./types";

export const NERF_VIEW = { w: 560, h: 316 };
export const NERF_CARD_VIEW = { w: 190, h: 100 };

const fmt = (v: number) => v.toFixed(2).replace(/^0/, "");
const Z_HALF = NERF_CFG.layers / 28; // slab half-height (scene.py: depth_layers / 28)
const EYE_Z = NERF_HOT.eye[2];
const H_DIR = Math.hypot(NERF_HOT.dir[0], NERF_HOT.dir[1]); // horizontal part of the hot ray (.799)
const V_DIR = -NERF_HOT.dir[2]; // its descent (.602)
const FAN_T0 = 0.4; // fan rays start this far (world units) from the eye so the camera stays clear
// The fan is col-16 rows 0,4,…,28; row 16 (35.67°) lies within a pixel of the hot
// ray (row 17, 37.0°), so the hot ray stands in for it.
const FAN = NERF_FAN_DEG.filter((_, k) => k !== 4);

/** consecutive equal levels → one rect each (x offset, width, level) */
function runs(levels: number[]): { x: number; w: number; lvl: number }[] {
  const out: { x: number; w: number; lvl: number }[] = [];
  let s = 0;
  for (let i = 1; i <= levels.length; i++) {
    if (i === levels.length || levels[i] !== levels[s]) { out.push({ x: s, w: i - s, lvl: levels[s] }); s = i; }
  }
  return out;
}

/**
 * A col-16 ray (deg below horizontal, in the hot ray's vertical plane) in the
 * side view: from t0 to where it first meets ink (2 px short, so the wire
 * does not cover the voxel it hits), or to far / the clip x if it never does.
 */
function fanRay(deg: number, sec: string, ex: number, ey: number, k: number, top: number, vox: number, xMax: number, t0 = FAN_T0): [number, number][] {
  const r = (deg * Math.PI) / 180;
  const at = (t: number): [number, number] => [ex + Math.round(t * Math.cos(r) * k), ey + Math.round(t * Math.sin(r) * k)];
  const dt = 0.5 / k;
  let end: number = NERF_CFG.far;
  for (let t = t0; t <= NERF_CFG.far; t += dt) {
    const [x, y] = at(t);
    if (x > xMax) { end = t - dt; break; }
    if (y >= top && y < top + NERF_CFG.layers * vox && sec[x - ex] === "1") { end = Math.max(t0, t - 2 / k); break; }
  }
  return [at(t0), at(end)];
}

/** the voxel slab cut along the hot ray's ground track: ink columns, layers stacked */
function SlabSection({ theme: T, sec, x0, top, vox }: { theme: Theme; sec: string; x0: number; top: number; vox: number }) {
  const L = NERF_CFG.layers;
  const ds: string[] = Array(8).fill("");
  for (let i = 0; i < sec.length; i++) {
    if (sec[i] !== "1") continue;
    for (let l = 0; l < L; l++) ds[rampIndex(layerV(l))] += `M${x0 + i} ${top + (L - 1 - l) * vox}h1v${vox}h-1z`;
  }
  const first = sec.search(/[01]/); // the slab's edges along the ground track
  const last = Math.max(sec.lastIndexOf("0"), sec.lastIndexOf("1"));
  const xa = x0 + first - 1, xb = x0 + last + 1, ya = top - 1, yb = top + L * vox;
  return (
    <g>
      <Wire pts={[[xa, ya], [xb, ya], [xb, yb], [xa, yb], [xa, ya]]} fill={T.frame} step={2} />
      {ds.map((d, i) => (d ? <path key={i} d={d} fill={T.ramp[i]} /> : null))}
    </g>
  );
}

// ————— full view: side view → the ray straightened → Σ → pixel vs GT; MLP lane; gate —————
// side view: K art px per world unit (a voxel is exactly 3 px), eye at (EX, EY)
const EX = 26, EY = 34, K = 42, VOX = 3;
const SLAB_TOP = EY + Math.round((EYE_Z - Z_HALF) * K); // 82
const SLAB_BOT = SLAB_TOP + NERF_CFG.layers * VOX; // 106
const sxT = (t: number) => EX + Math.round(t * H_DIR * K);
const syT = (t: number) => EY + Math.round(t * V_DIR * K);
// strip: sample i at x = SX + i (1 px = 1 of the 200 M samples)
const SX = 232, LBL_X = 222;
const ROW = { head: 10, axis: 20, tick: 29, ray: 34, wTop: 38, wBase: 61, run: 63, tTop: 66, tBot: 79, a: 84, s: 94, c: 104, note: 112 };
const LANE = 6;
const XE = SX + NERF_HOT.entry; // 319: the entry sample's column — the point p leaves the strip here
const P_RUN_Y = 142; // p = o + t·d runs left along this row to the MLP's input cells
// right: Σ, C, the GT view, the loss
const SIG = { x: 445, y: 50 };
const C_CELL = 11; // the payoff pixel: as big as Σ, so Σ → C reads as the result
const CC = { x: 456, y: SIG.y - (C_CELL - 1) / 2 }; // centred on Σ's row
const VIEW = { x: 472, y: 32 };
const DIA = { x: VIEW.x + 32, y: 112 }; // under the view's centre
const RAIL_X = 542, RAIL_Y = 236;
// MLP lane
const PT_X = 98, GAM_X = 118, CY2 = 200, LABEL_Y = 228;
const PT_ROWS = [180, 194, 208];
const GAM_H = 8, GAM_DY = (12 - GAM_H) / 2; // γ cells: 5×8, centred on the 12-px point cells' rows
const PT_CX = PT_X + 6; // 104: centre of the point cells
const GROUPS = [196, 222, 248, 274];
const BAR_H = 36; // an MLP has no resolution: one constant height, quieter than the renderer
const HEAD_X = 300, OUT_X = 320, OUT_Y = 183;
const FEED_X = OUT_X + 3; // 323: σ̂, ĉ rise back into the sample's column (next to p going down)
// gate band
const RING = { x: 50, y: 264, orbit: 29, ticks: 33 };
const GATE_X = 94;
const THUMBS = [{ az: 18, x: 300, role: "train" }, { az: 27, x: 336, role: "test" }, { az: 36, x: 372, role: "train" }] as const;
const TH_Y = 254;

export function NerfDiagram({ theme, still }: { theme: Theme; still: boolean }) {
  const T = theme;
  const frame = useTick(3, 3, still);
  const d = useMemo(() => {
    const ray = rayProfile();
    const views = { 18: unNib(NERF_VIEWS[18]), 27: unNib(NERF_VIEWS[27]), 36: unNib(NERF_VIEWS[36]) };
    const plan = Float32Array.from(NERF_OCC.join(""), (ch) => (ch === "1" ? 1 : -1)); // the slab from straight above
    return { ray, views, plan };
  }, []);
  const { ray } = d;
  const near = { x: sxT(NERF_CFG.near), y: syT(NERF_CFG.near) };
  const far = { x: sxT(NERF_CFG.far), y: syT(NERF_CFG.far) };
  const ent = { x: sxT(NERF_HOT.tEntry), y: syT(NERF_HOT.tEntry) };
  const wPath = ray.w.map((w, i) => { const h = Math.round(w * 60); return h ? `M${SX + i} ${ROW.wBase - h}h1v${h}h-1z` : ""; }).join("");
  const tPath = ray.trans.map((tr, i) => `M${SX + i} ${ROW.tBot - Math.round(tr * 13)}h1v1h-1z`).join("");
  const aRuns = runs(ray.alpha.map((a) => heatIndex(a)));
  const sRuns = runs(ray.sigma.map((s) => (s > 0 ? 5 : 0)));
  const cRuns = runs(ray.layer.map((l) => (l < 0 ? -1 : rampIndex(layerV(l)))));
  // the σ>0 run: every sample that carries weight (87–123 on the hot ray), and how much it carries
  const run0 = ray.sigma.findIndex((s) => s > 0);
  const run1 = ray.sigma.length - 1 - [...ray.sigma].reverse().findIndex((s) => s > 0);
  const runW = ray.w.slice(run0, run1 + 1).reduce((a, b) => a + b, 0);
  const eyeP = { x: RING.x + Math.round(RING.orbit * Math.cos((NERF_HOT.az * Math.PI) / 180)), y: RING.y - Math.round(RING.orbit * Math.sin((NERF_HOT.az * Math.PI) / 180)) };
  const entP = { x: RING.x + Math.round(NERF_HOT.p[0] * 14), y: RING.y - Math.round(NERF_HOT.p[1] * 14) };
  const orbitD = Array.from({ length: 60 }, (_, k) => {
    const a = (k * 6 * Math.PI) / 180;
    return `M${RING.x + Math.round(RING.orbit * Math.cos(a))} ${RING.y - Math.round(RING.orbit * Math.sin(a))}h1v1h-1z`;
  }).join("");
  const px = { x: VIEW.x + NERF_HOT.col * 2, y: VIEW.y + NERF_HOT.row * 2 };
  const t0 = { x: sxT(FAN_T0), y: syT(FAN_T0) };

  return (
    <g>
      <rect x={0} y={0} width={NERF_VIEW.w} height={NERF_VIEW.h} fill={T.ground} />

      {/* ——— side view: one pinhole, a fan of rays, the 6 lying flat ——— */}
      <PText x={16} y={ROW.head} text="camera az 36, el 35" fill={T.textDim} />
      <PText x={16} y={ROW.axis} text="1024 rays, one origin" fill={T.textDim} />
      {FAN.map((deg) => (
        <Wire key={deg} pts={fanRay(deg, NERF_SECTION, EX, EY, K, SLAB_TOP, VOX, LBL_X - 12)} fill={T.wire} step={3} />
      ))}
      <SlabSection theme={T} sec={NERF_SECTION} x0={EX} top={SLAB_TOP} vox={VOX} />
      <Frame x={16} y={EY - 4} w={8} h={8} fill={T.text} />
      <rect x={EX} y={EY} width={1} height={1} fill={T.text} />
      <Wire pts={[[t0.x, t0.y], [near.x, near.y]]} fill={T.wire} step={2} />
      <Wire pts={[[near.x, near.y], [far.x, far.y]]} fill={T.wireHot} step={3} phase={frame} />
      <rect x={ent.x - 1} y={ent.y - 1} width={3} height={3} fill={T.wireHot} />
      {/* the entry's t, the same label as the strip's — one ray drawn twice */}
      <PText x={ent.x + 16} y={SLAB_BOT + 3} text={NERF_HOT.tEntry.toFixed(2)} fill={T.wireHot} anchor="end" />
      <PText x={far.x + 3} y={far.y - 3} text="_{4}" fill={T.textDim} />
      <PText x={16} y={ROW.note} text="the 6, flat" fill={T.textDim} />
      <PText x={16} y={ROW.note + 10} text="z up, 28×28×8" fill={T.textDim} />
      <PText x={16} y={ROW.note + 20} text="voxels: GT views only" fill={T.textDim} />

      {/* ——— the same ray, straightened: 1 px = 1 sample ——— */}
      <PText x={SX} y={ROW.head} text="the ray straightened: M 200, S 25" fill={T.textDim} />
      <PText x={SX} y={ROW.axis} text="near 1" fill={T.textDim} />
      <PText x={XE} y={ROW.axis} text={NERF_HOT.tEntry.toFixed(2)} fill={T.wireHot} anchor="middle" />
      <PText x={SX + S - 1} y={ROW.axis} text="far 4" fill={T.textDim} anchor="end" />
      {Array.from({ length: 25 }, (_, j) => <rect key={j} x={SX + 4 + 8 * j} y={ROW.tick} width={1} height={3} fill={T.textDim} />)}
      <Wire pts={[[SX, ROW.ray], [SX + S - 1, ROW.ray]]} fill={T.wireHot} step={3} phase={frame} />
      {/* w = T·α (hot): where the ray's colour comes from — its own track, drained by Σ */}
      <rect x={SX} y={ROW.wTop} width={S} height={ROW.wBase - ROW.wTop + 1} fill={T.panel} />
      <path d={wPath} fill={T.wireHot} />
      {/* the run bar: all of w lives in the σ>0 samples — Σw is the whole pixel */}
      <rect x={SX + run0} y={ROW.run} width={run1 - run0 + 1} height={1} fill={T.wireHot} />
      {/* its caption sits just past the bar's end, bottom row on the track's base, clear of the →Σ wire */}
      <PText x={SX + run1 + 5} y={ROW.wBase - 16} text={`Σw ${runW.toFixed(2)}`} fill={T.wireHot} />
      <PText x={SX + run1 + 5} y={ROW.wBase - 6} text={`in ${run1 - run0 + 1} samples`} fill={T.wireHot} />
      {/* T: what is left of the ray */}
      <rect x={SX} y={ROW.tTop} width={S} height={ROW.tBot - ROW.tTop + 1} fill={T.panel} />
      <path d={tPath} fill={T.heat[5]} />
      {aRuns.map((r) => <rect key={`a${r.x}`} x={SX + r.x} y={ROW.a} width={r.w} height={LANE} fill={T.heat[r.lvl]} />)}
      {sRuns.map((r) => <rect key={`s${r.x}`} x={SX + r.x} y={ROW.s} width={r.w} height={LANE} fill={T.heat[r.lvl]} />)}
      {cRuns.map((r) => <rect key={`c${r.x}`} x={SX + r.x} y={ROW.c} width={r.w} height={LANE} fill={r.lvl < 0 ? T.panel : T.ramp[r.lvl]} />)}
      {([["S", ROW.tick - 2], ["T", 69], ["α", ROW.a], ["σ", ROW.s], ["c", ROW.c]] as const).map(([s, y]) => (
        <PText key={s} x={LBL_X} y={y} text={s} fill={T.textDim} />
      ))}
      <PText x={LBL_X} y={46} text="w" fill={T.wireHot} />
      <PText x={SX} y={ROW.note} text="α=1−exp(−σ·dt)" fill={T.textDim} />
      <PText x={SX} y={ROW.note + 10} text="w=T·α, C=Σw·c" fill={T.textDim} />
      <PText x={SX} y={ROW.note + 20} text="p = o + t·d" fill={T.textDim} />
      <PText x={FEED_X + 7} y={ROW.note} text="σ, c: the true scene" fill={T.loss} />
      <PText x={FEED_X + 7} y={ROW.note + 10} text="no nerf checkpoint" fill={T.loss} />

      {/* ——— compositing: Σ w·c → one pixel ——— */}
      <Wire pts={[[SX + S + 1, SIG.y], [SIG.x - 7, SIG.y]]} fill={T.wireHot} step={2} />
      <Wire pts={[[SX + S + 1, ROW.c + 2], [SIG.x, ROW.c + 2], [SIG.x, SIG.y + 8]]} fill={T.wire} step={2} />
      <Node cx={SIG.x} cy={SIG.y} glyph="Σ" theme={T} hot />
      <Wire pts={[[SIG.x + 7, SIG.y], [CC.x - 2, SIG.y]]} fill={T.wireHot} step={1} />
      <Frame x={CC.x - 1} y={CC.y - 1} w={C_CELL + 2} h={C_CELL + 2} fill={T.frame} />
      <rect x={CC.x} y={CC.y} width={C_CELL} height={C_CELL} fill={T.ramp[rampIndex(ray.v)]} />
      <PText x={CC.x + (C_CELL - 1) / 2 + 1} y={CC.y - 10} text="C" fill={T.text} anchor="middle" />

      <PText x={VIEW.x} y={ROW.head} text="view az 36" fill={T.textDim} />
      <PText x={VIEW.x} y={ROW.axis} text="train, GT" fill={T.textDim} />
      <Thumb x={VIEW.x} y={VIEW.y} data={d.views[36]} n={32} px={2} theme={T} />
      {/* a ground-coloured halo keeps the one hot frame legible on the dark top face (paper) */}
      <Frame x={px.x - 2} y={px.y - 2} w={6} h={6} fill={T.ground} />
      <Frame x={px.x - 1} y={px.y - 1} w={4} h={4} fill={T.wireHot} />

      {/* ——— MSE: rendered pixel vs the training view's pixel ——— */}
      <Wire pts={[[CC.x + (C_CELL - 1) / 2, CC.y + C_CELL + 2], [CC.x + (C_CELL - 1) / 2, DIA.y], [DIA.x - 8, DIA.y]]} fill={T.wire} />
      <Wire pts={[[DIA.x, VIEW.y + 67], [DIA.x, DIA.y - 9]]} fill={T.wire} />
      <Diamond cx={DIA.x} cy={DIA.y} theme={T} />
      <PText x={DIA.x + 1} y={DIA.y + 10} text="MSE" fill={T.loss} anchor="middle" />
      <PText x={DIA.x + 1} y={DIA.y + 20} text="1024 rays" fill={T.textDim} anchor="middle" />
      {/* the gradient flows back through Σ into the MLP's outputs (never into the voxels) */}
      <Wire pts={[[DIA.x + 8, DIA.y], [RAIL_X, DIA.y], [RAIL_X, RAIL_Y], [FEED_X, RAIL_Y], [FEED_X, OUT_Y + 38]]} fill={T.loss} step={3} />
      <PText x={FEED_X + 7} y={RAIL_Y - 10} text="gradient, back through Σ" fill={T.textDim} />

      {/* ——— the MLP, queried once per sample point: p comes off the RAY, not the voxels ——— */}
      <Wire pts={[[XE, ROW.c + LANE + 2], [XE, P_RUN_Y], [PT_CX, P_RUN_Y], [PT_CX, PT_ROWS[0] - 3]]} fill={T.wire} />
      <PText x={GAM_X} y={146} text={`MLP per point: ${(1024 * S).toLocaleString("en-US")} a step`} fill={T.textDim} />
      <PText x={GAM_X} y={156} text="x, y, z only: no view dir" fill={T.textDim} />
      <PText x={GAM_X} y={166} text="γ sin×6 cos×6" fill={T.textDim} />
      {PT_ROWS.map((y, k) => (
        <g key={y}>
          <Frame x={PT_X - 1} y={y - 1} w={14} h={14} fill={T.frame} />
          <rect x={PT_X} y={y} width={12} height={12} fill={T.ramp[rampIndex(NERF_HOT.p[k])]} />
          <PText x={GATE_X} y={y + 3} text={`${"xyz"[k]} ${fmt(NERF_HOT.p[k])}`} fill={T.textDim} anchor="end" />
          <Wire pts={[[PT_X + 14, y + 6], [GAM_X - 3, y + 6]]} fill={T.wire} />
          {Array.from({ length: 12 }, (_, j) => (
            <rect key={j} x={GAM_X + 6 * j} y={y + GAM_DY} width={5} height={GAM_H} fill={T.ramp[rampIndex(NERF_PE[k * 12 + j])]} />
          ))}
        </g>
      ))}
      <PText x={GAM_X} y={LABEL_Y} text="_{36}" fill={T.textDim} />
      <Wire pts={[[GAM_X + 74, CY2], [GROUPS[0] - 2, CY2]]} fill={T.accentLo} step={1} />
      {GROUPS.map((x, g) => (
        <g key={x}>
          <Bars x={x} y={CY2 - BAR_H / 2} bars={4} h={BAR_H} theme={T} bw={3} gap={2} />
          <PText x={x} y={LABEL_Y} text="_{128}" fill={T.textDim} />
          <Wire pts={[[x + 20, CY2], [g < 3 ? GROUPS[g + 1] - 2 : HEAD_X - 2, CY2]]} fill={T.accentLo} step={1} />
        </g>
      ))}
      <rect x={HEAD_X} y={CY2 - BAR_H / 2} width={1} height={BAR_H} fill={T.accentHi} />
      <PText x={HEAD_X} y={LABEL_Y} text="_{4}" fill={T.textDim} />
      <Wire pts={[[HEAD_X + 2, CY2], [OUT_X - 3, CY2]]} fill={T.accentLo} step={1} />
      {[0, 1, 2, 3].map((k) => (
        <g key={k}>
          <Frame x={OUT_X - 1} y={OUT_Y + 9 * k - 1} w={9} h={9} fill={T.frame} />
          <rect x={OUT_X} y={OUT_Y + 9 * k} width={7} height={7} fill={T.panel} />
        </g>
      ))}
      <Wire pts={[[FEED_X, OUT_Y - 3], [FEED_X, ROW.c + LANE + 2]]} fill={T.wire} />
      <PText x={OUT_X + 12} y={OUT_Y} text="σ softplus" fill={T.textDim} />
      <PText x={OUT_X + 12} y={OUT_Y + 10} text="c sigmoid" fill={T.textDim} />
      <PText x={OUT_X + 12} y={OUT_Y + 20} text="outputs not shown" fill={T.textDim} />

      {/* ——— the gate: held-out azimuths on the same orbit ——— */}
      <path d={orbitD} fill={T.wire} />
      <Thumb x={RING.x - 14} y={RING.y - 14} data={d.plan} n={28} px={1} theme={T} />
      {Array.from({ length: NERF_CFG.nAz }, (_, i) => {
        const az = (360 * i) / NERF_CFG.nAz;
        const a = (az * Math.PI) / 180;
        const x = RING.x + Math.round(RING.ticks * Math.cos(a));
        const y = RING.y - Math.round(RING.ticks * Math.sin(a));
        const test = i % NERF_CFG.testEvery === NERF_CFG.testEvery - 1;
        if (az === NERF_HOT.az) return <rect key={i} x={x - 1} y={y - 1} width={3} height={3} fill={T.wireHot} />;
        return test ? <rect key={i} x={x - 1} y={y - 1} width={3} height={3} fill={T.text} /> : <rect key={i} x={x} y={y} width={1} height={1} fill={T.textDim} />;
      })}
      <Wire pts={[[eyeP.x, eyeP.y], [entP.x, entP.y]]} fill={T.wireHot} step={2} />
      <PText x={GATE_X} y={250} text="gate: PSNR on 10 held-out views" fill={T.textDim} />
      <PText x={GATE_X} y={260} text={`M bar ${NERF_REF.barM} dB, L ${NERF_REF.barL} dB`} fill={T.text} />
      <PText x={GATE_X} y={270} text={`untrained ${NERF_REF.untrainedDb} dB, black ${NERF_REF.blackDb}`} fill={T.textDim} />
      <PText x={GATE_X} y={280} text="bars provisional: no M sweep yet" fill={T.loss} />
      {THUMBS.map((v) => (
        <g key={v.az}>
          <PText x={v.x} y={TH_Y - 10} text={v.role} fill={v.role === "test" ? T.text : T.textDim} />
          <Thumb x={v.x} y={TH_Y} data={d.views[v.az]} n={32} px={1} theme={T} />
          <PText x={v.x} y={TH_Y + 36} text={`az ${v.az}`} fill={v.role === "test" ? T.text : T.textDim} />
        </g>
      ))}

      <PText x={16} y={NERF_VIEW.h - 14} text="view, c: v = 2R+B−1 (−1 empty, +1 top)   σ α T: heat 0-1   1 bar = 32 ch   strip 1 px = 1 sample   big tick: held out" fill={T.textDim} />
    </g>
  );
}

// ————— card: ray → strip → pixel —————
// side view at 28 px per world unit (2 px per voxel); the strip below it shares
// its x scale: sample i sits under the side-view point it was taken at.
const CEX = 10, CEY = 8, CK = 28, CVOX = 2;
const C_SLAB_TOP = CEY + Math.round((EYE_Z - Z_HALF) * CK); // 40
const C_SLAB_BOT = C_SLAB_TOP + NERF_CFG.layers * CVOX; // 56
const cxT = (t: number) => CEX + Math.round(t * H_DIR * CK);
const cyT = (t: number) => CEY + Math.round(t * V_DIR * CK);
const C_ROW = { ray: 60, wTop: 62, wBase: 83, s: 86, c: 91 };
const C_SIG = { x: 118, y: 72 };
const C_VIEW = { x: 142, y: C_SIG.y - NERF_HOT.row }; // the hot pixel lands on Σ's row
const C_XMAX = 101; // fan rays stop at the slab's far edge
const C_T0 = 0.15; // at card scale the fan must visibly leave the camera

export function NerfCard({ theme }: { theme: Theme }) {
  const T = theme;
  const d = useMemo(() => {
    const ray = rayProfile();
    // fold the 200 samples into side-view columns: w summed, σ any, c = first layer hit
    const cols = new Map<number, { w: number; layer: number }>();
    ray.t.forEach((t, i) => {
      const x = cxT(t);
      const c = cols.get(x) ?? { w: 0, layer: -1 };
      c.w += ray.w[i];
      if (c.layer < 0 && ray.layer[i] >= 0) c.layer = ray.layer[i];
      cols.set(x, c);
    });
    return { cols: [...cols.entries()].sort((a, b) => a[0] - b[0]), view: unNib(NERF_VIEWS[36]) };
  }, []);
  const xa = cxT(NERF_CFG.near), xb = cxT(NERF_CFG.far);
  const tExit = (C_SLAB_BOT - CEY) / (V_DIR * CK); // the hot ray leaves the slab's underside
  const wPath = d.cols.map(([x, c]) => { const h = Math.min(C_ROW.wBase - C_ROW.wTop, Math.round(c.w * 28)); return h ? `M${x} ${C_ROW.wBase - h}h1v${h}h-1z` : ""; }).join("");
  const pix = { x: C_VIEW.x + NERF_HOT.col, y: C_VIEW.y + NERF_HOT.row };
  return (
    <g>
      <rect x={0} y={0} width={NERF_CARD_VIEW.w} height={NERF_CARD_VIEW.h} fill={T.ground} />
      {[1, 3, 5, 7].map((k) => (
        <Wire key={k} pts={fanRay(NERF_FAN_DEG[k], NERF_SECTION_CARD, CEX, CEY, CK, C_SLAB_TOP, CVOX, C_XMAX, C_T0)} fill={T.wire} step={2} />
      ))}
      <SlabSection theme={T} sec={NERF_SECTION_CARD} x0={CEX} top={C_SLAB_TOP} vox={CVOX} />
      <Frame x={3} y={CEY - 2} w={5} h={5} fill={T.text} />
      <rect x={CEX} y={CEY} width={1} height={1} fill={T.text} />
      <Wire pts={[[cxT(C_T0), cyT(C_T0)], [xa, cyT(1)]]} fill={T.wire} step={2} />
      <Wire pts={[[xa, cyT(1)], [cxT(tExit), cyT(tExit)]]} fill={T.wireHot} step={2} />

      {/* the ray straightened under itself */}
      <Wire pts={[[xa, C_ROW.ray], [xb, C_ROW.ray]]} fill={T.wireHot} step={2} />
      <rect x={xa} y={C_ROW.wTop} width={xb - xa + 1} height={C_ROW.wBase - C_ROW.wTop + 1} fill={T.panel} />
      <path d={wPath} fill={T.wireHot} />
      <rect x={xa} y={C_ROW.s} width={xb - xa + 1} height={3} fill={T.panel} />
      <rect x={xa} y={C_ROW.c} width={xb - xa + 1} height={3} fill={T.panel} />
      {d.cols.map(([x, c]) => (c.layer < 0 ? null : (
        <g key={x}>
          <rect x={x} y={C_ROW.s} width={1} height={3} fill={T.heat[5]} />
          <rect x={x} y={C_ROW.c} width={1} height={3} fill={T.ramp[rampIndex(layerV(c.layer))]} />
        </g>
      )))}

      <Wire pts={[[xb + 2, C_SIG.y], [C_SIG.x - 7, C_SIG.y]]} fill={T.wireHot} step={2} />
      <Wire pts={[[xb + 2, C_ROW.c + 1], [C_SIG.x, C_ROW.c + 1], [C_SIG.x, C_SIG.y + 8]]} fill={T.wire} step={2} />
      <Node cx={C_SIG.x} cy={C_SIG.y} glyph="Σ" theme={T} hot />
      <Wire pts={[[C_SIG.x + 7, C_SIG.y], [C_VIEW.x - 3, C_SIG.y]]} fill={T.wireHot} step={2} />
      <Thumb x={C_VIEW.x} y={C_VIEW.y} data={d.view} n={32} px={1} theme={T} />
      <Frame x={pix.x - 2} y={pix.y - 2} w={5} h={5} fill={T.ground} />
      <Frame x={pix.x - 1} y={pix.y - 1} w={3} h={3} fill={T.wireHot} />

      <PText x={106} y={42} text="Σ w·c → one pixel" fill={T.textDim} />
    </g>
  );
}

// Structurally the registry's DiagramDef (index.tsx keeps that interface private).
interface NerfDef {
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

export const NERF_DEFS: Record<string, NerfDef> = {
  nerf: {
    view: NERF_VIEW,
    title: "nerf — a pixel is a weighted sum along its ray",
    truth:
      "Exact, no model: the scene (MNIST train #37542, a 6, voxelised 28×28×8 and lying flat), its ground-truth views, the hot ray's σ, α, T, w and c through the true scene at the 200 M samples, and γ of its entry point; the MLP sees only (x, y, z), never the voxels. There is no local nerf checkpoint, so the MLP's weights, its σ̂/ĉ, the predicted view and the loss value are not shown, and the 20 / 26 dB bars are provisional.",
    badge: "structure; scene exact",
    render: ({ theme, still }) => <NerfDiagram theme={theme} still={still} />,
    card: { view: NERF_CARD_VIEW, render: ({ theme }) => <NerfCard theme={theme} /> },
  },
};
