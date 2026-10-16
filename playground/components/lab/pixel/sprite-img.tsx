"use client";

// A sprite from the sheet as a crisp DOM element: painted once into a canvas
// at its native size and scaled by an integer with `image-rendering:
// pixelated` (card portraits, legend icons, menu cursors).
import { useEffect, useRef } from "react";
import { SWEETIE } from "./palette";
import { CLEAR, type IndexImage } from "./raster";

export function SpriteImg({ img, scale = 2, className, label }: {
  img: IndexImage;
  scale?: number;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = img.w; c.height = img.h;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, img.w, img.h);
    for (let i = 0; i < img.data.length; i++) {
      const v = img.data[i];
      if (v === CLEAR) continue;
      ctx.fillStyle = SWEETIE[v];
      ctx.fillRect(i % img.w, Math.floor(i / img.w), 1, 1);
    }
  }, [img]);
  return (
    <canvas
      ref={ref}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ width: img.w * scale, height: img.h * scale, imageRendering: "pixelated", flex: "none" }}
    />
  );
}
