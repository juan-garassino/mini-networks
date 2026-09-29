// The two secret islands (world.hiddenIsland / world.ruinsIsland) lie OUTSIDE
// the tile grid, so they are painted here on their own canvases, in the same
// palette-index pipeline and with the same shore bands as the main coast
// (ink line, foam, shallows). Found by panning or zooming out past the sea.
import type { SecretIsland } from "@/lib/world";
import { blank, blit, downsample, sprite, toCanvas, type IndexImage } from "./raster";
import { DRAGON, QSTONE, RUIN } from "./sprites";

export interface IslandLayer {
  /** px origin of the canvases in world space */
  x: number;
  y: number;
  full: HTMLCanvasElement;  // 1 art px = 1 world px
  mid: HTMLCanvasElement;   // ÷2
  far: HTMLCanvasElement;   // ÷4
}

function paint(island: SecretIsland, kind: "hidden" | "ruins"): { img: IndexImage; x: number; y: number } {
  const pad = 72;
  const x0 = Math.floor(Math.min(island.box.x, island.dragons.x) - pad);
  const y0 = Math.floor(Math.min(island.box.y, island.dragons.y) - pad);
  const x1 = Math.ceil(Math.max(island.box.x + island.box.w, island.dragons.x) + pad);
  const y1 = Math.ceil(Math.max(island.box.y + island.box.h, island.dragons.y) + pad);
  const w = (x1 - x0) & ~3, h = (y1 - y0) & ~3;
  const img = blank(w, h);
  const cx = island.box.x + island.box.w / 2 - x0, cy = island.box.y + island.box.h / 2 - y0;
  const rx = island.box.w / 2, ry = island.box.h / 2;
  // superellipse "distance": 1 on the coast, <1 inside
  const f = (x: number, y: number) => (Math.abs((x - cx) / rx) ** 2.6 + Math.abs((y - cy) / ry) ** 2.6) ** (1 / 2.6);
  const land = kind === "hidden" ? { base: 15, light: 14, shade: 0 } : { base: 13, light: 12, shade: 14 };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = f(x + 0.5, y + 0.5);
    const px = (d - 1) * Math.min(rx, ry);               // ~px outside the coast (+) / inside (−)
    let v: number;
    if (px <= -2) v = (x * 7 + y * 3) % 23 === 0 ? land.shade : land.base;
    else if (px <= 0) v = land.light;
    else if (px <= 1.2) v = 15;
    else if (px <= 2.5) v = kind === "hidden" ? 14 : 11;
    else if (px <= 7) v = kind === "hidden" ? 8 : 10;
    else v = kind === "hidden" && ((x + y) & 1) === 0 ? 0 : 8; // storm-dark water round the "?" island
    img.data[y * w + x] = v;
  }
  const stone = sprite(kind === "hidden" ? QSTONE : RUIN);
  for (const s of island.slots) blit(img, stone, Math.round(s.x - x0 - stone.w), Math.round(s.y - y0 - stone.h * 2 + 6), 2);
  if (kind === "hidden") {
    const dragon = sprite(DRAGON);
    blit(img, dragon, Math.round(island.dragons.x - x0 - dragon.w), Math.round(island.dragons.y - y0 - dragon.h), 2);
  }
  return { img, x: x0, y: y0 };
}

export function buildIsland(island: SecretIsland, kind: "hidden" | "ruins"): IslandLayer {
  const { img, x, y } = paint(island, kind);
  return {
    x, y,
    full: toCanvas(img),
    mid: toCanvas(downsample(img, 2, (v) => (v === 0 ? 0.6 : 1))),
    far: toCanvas(downsample(img, 4, (v) => (v === 0 ? 0.6 : 1))),
  };
}
