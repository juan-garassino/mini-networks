"use client";

// Model identity in 16-bit: every species' glyph (lib/icons.tsx, one Lucide
// icon per model) rasterised ONCE at runtime into a 1-bit pixel mask at the
// sizes the map needs, then painted as palette pixels like any other sprite.
// Rendered at 4× and reduced by coverage so strokes stay 1px and unbroken.
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { iconFor } from "@/lib/icons";
import { blank, CLEAR, type IndexImage } from "./raster";

export type EmblemMask = { size: number; bits: Uint8Array };
export type EmblemSet = Map<string, Map<number, EmblemMask>>; // name → size → mask

const OVERSAMPLE = 4;
const COVER = 0.3;

/** Render every icon once into a detached root (outside React's commit phase) and read the SVG markup. */
async function svgMarkups(names: string[]): Promise<Map<string, string>> {
  await new Promise((r) => setTimeout(r, 0)); // never flush while React is rendering
  const icons = names.map((n) => [n, iconFor(n)] as const).filter(([, I]) => I);
  const host = document.createElement("div");
  const root = createRoot(host);
  flushSync(() => root.render(createElement("div", null, ...icons.map(([n, I]) =>
    createElement("span", { key: n, "data-n": n }, createElement(I!, { size: 24, strokeWidth: 2.4, color: "#000" }))))));
  const out = new Map<string, string>();
  host.querySelectorAll<HTMLElement>("span[data-n]").forEach((el) => { if (el.innerHTML.includes("<svg")) out.set(el.dataset.n!, el.innerHTML); });
  setTimeout(() => root.unmount(), 0);
  return out;
}

function loadImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.includes("xmlns=") ? svg : svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"'))}`;
  });
}

function toMask(img: HTMLImageElement, size: number): EmblemMask {
  const big = size * OVERSAMPLE;
  const c = document.createElement("canvas");
  c.width = c.height = big;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, big, big);
  const a = ctx.getImageData(0, 0, big, big).data;
  const bits = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let cov = 0;
    for (let dy = 0; dy < OVERSAMPLE; dy++) for (let dx = 0; dx < OVERSAMPLE; dx++) {
      cov += a[((y * OVERSAMPLE + dy) * big + x * OVERSAMPLE + dx) * 4 + 3];
    }
    bits[y * size + x] = cov / (255 * OVERSAMPLE * OVERSAMPLE) >= COVER ? 1 : 0;
  }
  return { size, bits };
}

/** Rasterise every named species at each size (async: SVG → image decode). */
export async function rasterEmblems(names: string[], sizes: number[]): Promise<EmblemSet> {
  const out: EmblemSet = new Map();
  const svgs = await svgMarkups(names);
  for (const [name, svg] of svgs) {
    try {
      const img = await loadImage(svg);
      out.set(name, new Map(sizes.map((s) => [s, toMask(img, s)])));
    } catch {
      /* a glyph that fails to decode just has no emblem */
    }
  }
  return out;
}

/** Mask → sprite in one palette colour (optionally with a 1px outline colour). */
export function emblemSprite(mask: EmblemMask, ink: number, outline?: number): IndexImage {
  const pad = outline === undefined ? 0 : 1;
  const n = mask.size + 2 * pad;
  const img = blank(n, n);
  for (let y = 0; y < mask.size; y++) for (let x = 0; x < mask.size; x++) {
    if (mask.bits[y * mask.size + x]) img.data[(y + pad) * n + x + pad] = ink;
  }
  if (outline !== undefined) {
    const src = new Uint8Array(img.data);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (src[y * n + x] !== CLEAR) continue;
      const nb = [src[(y - 1) * n + x], src[(y + 1) * n + x], x > 0 ? src[y * n + x - 1] : CLEAR, x < n - 1 ? src[y * n + x + 1] : CLEAR];
      if (nb.some((v) => v === ink)) img.data[y * n + x] = outline;
    }
  }
  return img;
}
