"use client";

// Species emblems as 1-bit masks for the art system: each lib/icons glyph is
// rendered once (detached React root → SVG markup → image), drawn 4× over-
// sampled and reduced by coverage so strokes stay 1 px and unbroken. Same
// {size, bits} shape as components/lab/pixel/emblems.ts, so either set can be
// stamped into a sprite slot (stampInto / Painter.mask).
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { iconFor } from "@/lib/icons";

export interface EmblemMask { size: number; bits: Uint8Array }

const OVERSAMPLE = 4;
const COVER = 0.4;

async function markups(names: string[]): Promise<Map<string, string>> {
  await new Promise((r) => setTimeout(r, 0)); // never flush inside a React render
  const icons = names.map((n) => [n, iconFor(n)] as const).filter(([, I]) => I);
  const host = document.createElement("div");
  const root = createRoot(host);
  flushSync(() => root.render(createElement("div", null, ...icons.map(([n, I]) =>
    createElement("span", { key: n, "data-n": n }, createElement(I!, { size: 24, strokeWidth: 2.3, color: "#000" }))))));
  const out = new Map<string, string>();
  host.querySelectorAll<HTMLElement>("span[data-n]").forEach((el) => { if (el.innerHTML.includes("<svg")) out.set(el.dataset.n!, el.innerHTML); });
  setTimeout(() => root.unmount(), 0);
  return out;
}

function decode(svg: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    const x = svg.includes("xmlns=") ? svg : svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(x)}`;
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
    for (let dy = 0; dy < OVERSAMPLE; dy++) for (let dx = 0; dx < OVERSAMPLE; dx++) cov += a[((y * OVERSAMPLE + dy) * big + x * OVERSAMPLE + dx) * 4 + 3];
    bits[y * size + x] = cov / (255 * OVERSAMPLE * OVERSAMPLE) >= COVER ? 1 : 0;
  }
  return { size, bits };
}

/** name → size → mask. Castle banners use 9, derived markers 7. */
export async function emblemMasks(names: string[], sizes: number[] = [7, 9]): Promise<Map<string, Map<number, EmblemMask>>> {
  const out = new Map<string, Map<number, EmblemMask>>();
  for (const [name, svg] of await markups(names)) {
    try {
      const img = await decode(svg);
      out.set(name, new Map(sizes.map((s) => [s, toMask(img, s)])));
    } catch { /* a glyph that fails to decode just has no emblem */ }
  }
  return out;
}
