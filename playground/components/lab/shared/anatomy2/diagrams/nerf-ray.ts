// The nerf diagram's hot ray, composited through the TRUE scene exactly as
// models/nerf/model.py::composite does (no model, no checkpoint). Pure TS so
// node --test can check it (nerf-ray.test.ts) against the exporter's numbers.
import { NERF_CFG, NERF_HOT, NERF_RAY_LAYER, NERF_RAY_SIGMA } from "../data/nerf-scene.ts";

/** M-tier samples on the hot ray (effective_timesteps at M) */
export const RAY_S = NERF_HOT.S;

/** a layer's colour as the view encodes it: an opaque voxel of layer L has v = z = L/7 */
export const layerV = (L: number) => L / (NERF_CFG.layers - 1);

export interface RayProfile {
  /** bin midpoints t_i (render_rays at eval) */
  t: number[];
  sigma: number[];
  /** voxel layer hit at sample i, −1 = empty */
  layer: number[];
  alpha: number[];
  trans: number[];
  w: number[];
  /** Σ w·c, rgb */
  C: number[];
  /** the view encoding of C: v = 2R + B − 1 */
  v: number;
}

/**
 * α_i = 1 − exp(−σ_i dt_i), T_i = Π_{j<i}(1 − α_j + 1e−10), w_i = T_i α_i,
 * C = Σ w_i c_i with c = (z, z, 1 − z) — dt_i = t_{i+1} − t_i, last 0.01.
 */
export function rayProfile(): RayProfile {
  const { near, far, sigmaScale } = NERF_CFG;
  const t = Array.from({ length: RAY_S }, (_, i) => near + ((far - near) * (i + 0.5)) / RAY_S);
  const sigma = Array.from(NERF_RAY_SIGMA, (ch) => (ch === "1" ? sigmaScale : 0));
  const layer = Array.from(NERF_RAY_LAYER, (ch) => (ch === "." ? -1 : Number(ch)));
  const alpha: number[] = [], trans: number[] = [], w: number[] = [];
  let T = 1;
  const C = [0, 0, 0];
  for (let i = 0; i < RAY_S; i++) {
    const dt = i < RAY_S - 1 ? t[i + 1] - t[i] : 1e-2;
    const a = 1 - Math.exp(-sigma[i] * dt);
    alpha.push(a);
    trans.push(T);
    w.push(T * a);
    if (layer[i] >= 0) {
      const z = layerV(layer[i]);
      C[0] += T * a * z; C[1] += T * a * z; C[2] += T * a * (1 - z);
    }
    T *= 1 - a + 1e-10;
  }
  return { t, sigma, layer, alpha, trans, w, C, v: 2 * C[0] + C[2] - 1 };
}
