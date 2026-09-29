"use client";

// An art/ sprite (palette-index image) as a crisp DOM image at an integer scale.
import { useMemo } from "react";
import { artToCanvas, type ArtImage } from "./art";

export function ArtImg({ img, scale = 2, label, className }: { img: ArtImage; scale?: number; label?: string; className?: string }) {
  // rasterised synchronously (client component): the first paint is never blank
  const src = useMemo(() => (typeof document === "undefined" ? null : artToCanvas(img).toDataURL()), [img]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src ?? undefined} alt={label ?? ""} aria-hidden={label ? undefined : true} className={className}
      width={img.w * scale} height={img.h * scale}
      style={{ imageRendering: "pixelated", flex: "none", visibility: src ? "visible" : "hidden" }} />
  );
}
