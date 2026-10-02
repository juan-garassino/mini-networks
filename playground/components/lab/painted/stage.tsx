"use client";

// The sea beyond the map's edge. A viewport-sized canvas under the map paints
// the furniture lifted from the map's own open sea (sea-furniture.ts) at the
// map's live scale and offset, so the parchment runs to every corner of the
// screen and the image's rectangle is never seen.
import { memo, useEffect, useMemo, useRef } from "react";
import type { PixelMap } from "./pixelmap";
import { extractSprites, placeFurniture, type Placed, type SeaSprite } from "./sea-furniture";

export const SEA_PAD_X = 1100;
export const SEA_PAD_Y = 800;

export function useSeaFurniture(pm: PixelMap | null, sea: Uint8Array | null, lands: Int8Array | null) {
  return useMemo(() => {
    if (!pm || !sea || !lands) return null;
    const sprites = extractSprites(pm.idx, sea, lands, pm.w, pm.h);
    const placed = placeFurniture(sprites, pm.w, pm.h, { padX: SEA_PAD_X, padY: SEA_PAD_Y, cell: 84, density: 0.42, seed: 11 });
    return { sprites, placed };
  }, [pm, sea, lands]);
}

function spriteCanvas(pm: PixelMap, s: SeaSprite): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = s.w; cv.height = s.h;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(s.w, s.h);
  for (let i = 0; i < s.px.length; i++) {
    const k = s.px[i];
    if (k < 0) continue;
    img.data[i * 4] = pm.palette[k * 3]; img.data[i * 4 + 1] = pm.palette[k * 3 + 1]; img.data[i * 4 + 2] = pm.palette[k * 3 + 2]; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

export const SeaCanvas = memo(function SeaCanvas({ pm, furniture, scale, ox, oy, vw, vh, dpr, mapW, mapH }: {
  pm: PixelMap;
  furniture: { sprites: SeaSprite[]; placed: Placed[] };
  scale: number; ox: number; oy: number; vw: number; vh: number; dpr: number; mapW: number; mapH: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const cache = useRef<HTMLCanvasElement[] | null>(null);
  useEffect(() => { cache.current = null; }, [pm, furniture]);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || vw <= 1) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    if (!cache.current) cache.current = furniture.sprites.map((s) => spriteCanvas(pm, s));
    const W = Math.round(vw * dpr), H = Math.round(vh * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    const k = scale * dpr;
    for (const p of furniture.placed) {
      const s = furniture.sprites[p.sprite];
      const x = Math.round((ox + p.x * scale) * dpr), y = Math.round((oy + p.y * scale) * dpr);
      const w = Math.round(s.w * k), h = Math.round(s.h * k);
      if (x + w < 0 || y + h < 0 || x > W || y > H) continue;
      // the ring never overlaps the map rect, but a zoomed camera may clamp inside it
      if (x + w > ox * dpr && x < (ox + mapW * scale) * dpr && y + h > oy * dpr && y < (oy + mapH * scale) * dpr) continue;
      const src = cache.current[p.sprite];
      if (p.flip) { ctx.save(); ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(src, 0, 0, w, h); ctx.restore(); }
      else ctx.drawImage(src, x, y, w, h);
    }
  }, [pm, furniture, scale, ox, oy, vw, vh, dpr, mapW, mapH]);
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 block" style={{ width: vw, height: vh, imageRendering: "pixelated" }} />;
});
