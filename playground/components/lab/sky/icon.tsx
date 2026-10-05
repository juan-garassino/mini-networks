"use client";

// A sky sprite as a small UI image (legend rows, sign plaques, specimen):
// drawn into a canvas at art resolution and shown pixelated at a CSS scale.
import { useEffect, useRef } from "react";
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { hex } from "./tokens";
import { starSprite, type Sprite } from "./sprites";

export function SpriteIcon({ s, scale = 2, label, pad = 0 }: { s: Sprite; scale?: number; label?: string; pad?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const w = s.w + 2 * pad, h = s.h + 2 * pad;
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(w, h);
    s.rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === ".") return;
      const [r, g, b] = hex(s.ink[ch]);
      const i = ((y + pad) * w + x + pad) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }));
    ctx.putImageData(img, 0, 0);
  }, [s, w, h, pad]);
  return (
    <canvas ref={ref} width={w} height={h} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      style={{ width: w * scale, height: h * scale, imageRendering: "pixelated", flex: "none", display: "block" }} />
  );
}

/** The legend's swatch: the atom star and the derived star of one evidence state, side by side. */
export function StarPair({ state, scale = 2 }: { state: EvidenceState; scale?: number }) {
  return (
    <span className="flex w-12 flex-none items-center justify-center gap-1.5" aria-hidden>
      <SpriteIcon s={starSprite(state, true)} scale={scale} />
      <SpriteIcon s={starSprite(state, false)} scale={scale} />
    </span>
  );
}
