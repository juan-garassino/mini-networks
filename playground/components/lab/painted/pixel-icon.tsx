"use client";

// The map's own evidence sprites (atom banner, marker stone) as small UI
// icons: drawn into a canvas at art resolution by the same pixel-art code as
// the map, shown at an integer CSS scale so they match the map exactly.
import { useEffect, useRef } from "react";
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { Raster, drawBanner, drawDisc } from "./pixel-art";

export function EvidenceIcon({ state, atom: atom0, scale = 2, label }: { state: EvidenceState; atom: boolean; scale?: number; label?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  // an untrained atom flies no banner: on the map it is the plain grey stone
  // (drawBanner → drawDisc), so its icon is the stone too, not a stone drawn
  // at the foot of an empty banner canvas (that clipped to one dark pixel)
  const atom = atom0 && state !== "untrained";
  const w = atom ? 14 : 9, h = atom ? 20 : 9;
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const r = new Raster(w, h);
    if (atom) drawBanner(r, 1, h - 2, state);
    else drawDisc(r, 4, 4, state);
    ctx.clearRect(0, 0, w, h);
    ctx.putImageData(new ImageData(new Uint8ClampedArray(r.data), w, h), 0, 0);
  }, [state, atom, w, h]);
  return (
    <canvas ref={ref} width={w} height={h} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      style={{ width: w * scale, height: h * scale, imageRendering: "pixelated", flex: "none" }} />
  );
}

/** A flat pixel swatch (a land's own colour) with a 1-art-px outline. */
export function Swatch({ color, border, size = 14 }: { color: string; border: string; size?: number }) {
  return (
    <span aria-hidden className="inline-block flex-none"
      style={{ width: size, height: size, background: color, boxShadow: `inset 0 0 0 var(--ap, 2px) ${border}, inset calc(var(--ap, 2px) * 2) calc(var(--ap, 2px) * 2) 0 rgba(255,255,255,.25)` }} />
  );
}
