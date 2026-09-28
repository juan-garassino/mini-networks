// Step 7 — decor (only in genuinely free land cells) and sea slots (the
// largest empty sea squares, for map furniture).
import type { Box, Decor, Label } from "./types.ts";
import { T } from "./types.ts";
import type { RegionGrid } from "./regions.ts";
import {
  DECOR_KEEP_P, DECOR_SCALE_MAX, DECOR_SCALE_MIN, DECOR_VARIANTS, SEA_SLOTS, TILE,
} from "./constants.ts";
import { fnv1a, mulberry32, shuffle } from "./rng.ts";

/** Tiles any label box touches. */
export function labelTiles(cols: number, rows: number, labels: Label[]): Uint8Array {
  const m = new Uint8Array(cols * rows);
  for (const l of labels) {
    const { x, y, w, h } = l.box;
    const tx0 = Math.max(0, Math.floor(x / TILE));
    const ty0 = Math.max(0, Math.floor(y / TILE));
    const tx1 = Math.min(cols - 1, Math.floor((x + w - 1e-6) / TILE));
    const ty1 = Math.min(rows - 1, Math.floor((y + h - 1e-6) / TILE));
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) m[ty * cols + tx] = 1;
  }
  return m;
}

export function placeDecor(rg: RegionGrid, labelMask: Uint8Array): Decor[] {
  const { cols, rows, terrain, regionOf } = rg;
  const n = cols * rows;
  const busy = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const t = terrain[i];
    if (t === T.FOOT || t === T.SETPIECE || t === T.ROAD || t === T.BRIDGE || t === T.RIVER || labelMask[i]) busy[i] = 1;
  }
  const excluded = dilate(busy, cols, rows);
  const has = new Uint8Array(n);
  const decor: Decor[] = [];
  for (const reg of rg.regions) {
    const cand: number[] = [];
    for (let i = 0; i < n; i++) {
      if (regionOf[i] === reg.id && !excluded[i] && (terrain[i] === T.LAND || terrain[i] === T.COAST)) cand.push(i);
    }
    const rnd = mulberry32(fnv1a(reg.family));
    shuffle(cand, rnd);
    for (const i of cand) {
      const x = i % cols;
      const y = (i - x) / cols;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < cols && yy < rows && has[yy * cols + xx]) { near = true; break; }
        }
      }
      const keep = rnd() < DECOR_KEEP_P;
      if (near || !keep) continue;
      has[i] = 1;
      decor.push({
        tile: i, region: reg.family,
        variant: Math.floor(rnd() * DECOR_VARIANTS),
        scale: Math.round((DECOR_SCALE_MIN + rnd() * (DECOR_SCALE_MAX - DECOR_SCALE_MIN)) * 100) / 100,
      });
    }
  }
  decor.sort((a, b) => a.tile - b.tile);
  return decor;
}

function dilate(m: Uint8Array, cols: number, rows: number): Uint8Array {
  const out = new Uint8Array(m.length);
  for (let i = 0; i < m.length; i++) {
    if (!m[i]) continue;
    const x = i % cols;
    const y = (i - x) / cols;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < cols && yy < rows) out[yy * cols + xx] = 1;
      }
    }
  }
  return out;
}

/** The SEA_SLOTS largest empty sea squares (px boxes), greedily, 1-tile apart. */
export function seaSlots(rg: RegionGrid, labelMask: Uint8Array): Box[] {
  const { cols, rows, terrain } = rg;
  const free = new Uint8Array(cols * rows);
  for (let i = 0; i < free.length; i++) free[i] = terrain[i] === T.SEA && !labelMask[i] ? 1 : 0;
  const out: Box[] = [];
  const dp = new Int16Array(cols * rows);
  for (let k = 0; k < SEA_SLOTS; k++) {
    let best = 0;
    let bi = -1;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        if (!free[i]) { dp[i] = 0; continue; }
        dp[i] = x && y ? 1 + Math.min(dp[i - 1], dp[i - cols], dp[i - cols - 1]) : 1;
        if (dp[i] > best) { best = dp[i]; bi = i; }
      }
    }
    if (best < 2) break;
    const x1 = bi % cols;
    const y1 = (bi - x1) / cols;
    const x0 = x1 - best + 1;
    const y0 = y1 - best + 1;
    out.push({ x: x0 * TILE, y: y0 * TILE, w: best * TILE, h: best * TILE });
    for (let y = y0 - 1; y <= y1 + 1; y++) {
      for (let x = x0 - 1; x <= x1 + 1; x++) if (x >= 0 && y >= 0 && x < cols && y < rows) free[y * cols + x] = 0;
    }
  }
  return out;
}
