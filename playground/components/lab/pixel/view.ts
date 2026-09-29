// Integer-only zoom for pixel art. The shared camera tweens a continuous box;
// the pixel skin snaps it to the nearest allowed on-screen tile size so every
// art pixel lands on whole device pixels:
//   16·n px tiles  → the 16px tileset at ×n
//   8 / 4 px tiles → pre-downsampled far-zoom layers (terrain.ts mid / far)
import type { CamBox } from "@/components/lab/shared/camera";

// art is 8 px per tile (art/ ART_PER_TILE): 1 art px on screen = tile/8 → integer for 8·n
export const TILE_STEPS = [4, 8, 16, 24, 32, 40, 48] as const;
export type TileStep = (typeof TILE_STEPS)[number];

/** On-screen px per 16px world tile for camera scale k (screen px / world px). */
export function snapTile(k: number, tolerance = 1.12, max = 48): TileStep {
  const want = Math.min(k * 16 * tolerance, max);
  let s: TileStep = 4;
  for (const z of TILE_STEPS) if (z <= want) s = z;
  return s;
}

export interface Stage { x: number; y: number; w: number; h: number }

export interface Xform {
  tile: TileStep;
  /** screen px per world px (tile / 16) */
  k: number;
  /** integer screen offsets: screen = world·k + off */
  ox: number;
  oy: number;
}

export function xformFor(box: CamBox, stage: Stage, maxTile = 48): Xform {
  if (![box.x, box.y, box.w, box.h].every(Number.isFinite) || stage.w <= 1 || stage.h <= 1) {
    return { tile: 16, k: 1, ox: 0, oy: 0 };
  }
  // max of both axes: while the camera re-fits to a new stage aspect (card opening)
  // the zoom must not drop a whole snap step for one frame
  const k0 = Math.max(stage.w / Math.max(box.w, 1), stage.h / Math.max(box.h, 1));
  const tile = snapTile(k0, 1.12, maxTile);
  const k = tile / 16;
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  return {
    tile, k,
    ox: Math.round(stage.x + stage.w / 2 - cx * k),
    oy: Math.round(stage.y + stage.h / 2 - cy * k),
  };
}

export const toScreen = (x: Xform, p: { x: number; y: number }) => ({ x: p.x * x.k + x.ox, y: p.y * x.k + x.oy });
