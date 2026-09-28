"use client";

// JRPG window: a 9-slice border painted procedurally (24×24 index image →
// data URL at runtime, no image files) and applied with CSS border-image at
// ×2, so the frame stays pixel-exact at any window size.
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { blank, toCanvas } from "./raster";
import styles from "./pixel.module.css";

const N = 24;      // skin size
const SLICE = 8;   // corner size in art px

// ink rim, two white bevel rows, slate inner line, navy fill; rounded corners.
function paintSkin(fill: number) {
  const img = blank(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const e = Math.min(x, y, N - 1 - x, N - 1 - y);
    const cx = Math.min(x, N - 1 - x), cy = Math.min(y, N - 1 - y);
    // round the corners: cut the 3 outermost pixels, ink the next ring
    if (cx + cy < 2) continue;
    img.data[y * N + x] = e === 0 || cx + cy === 2 ? 0 : e <= 2 ? 12 : e === 3 ? 14 : fill;
  }
  return toCanvas(img).toDataURL();
}

const cache = new Map<number, string>();
function useSkin(fill: number) {
  const [url, setUrl] = useState<string | null>(() => cache.get(fill) ?? null);
  useEffect(() => {
    if (url) return;
    const u = paintSkin(fill);
    cache.set(fill, u);
    setUrl(u);
  }, [fill, url]);
  return url;
}

export function PixelWindow({ children, className = "", fill = 8, style, as = "div", ...rest }: {
  children: ReactNode;
  className?: string;
  /** Sweetie-16 index of the window body (8 navy default). */
  fill?: number;
  style?: CSSProperties;
  as?: "div" | "section" | "aside" | "nav" | "header";
} & Record<string, unknown>) {
  const url = useSkin(fill);
  const Tag = as as "div";
  return (
    <Tag
      {...rest}
      className={`${styles.win} ${className}`}
      style={{
        ...style,
        borderImageSource: url ? `url(${url})` : undefined,
        borderImageSlice: `${SLICE} fill`,
      }}
    >
      {children}
    </Tag>
  );
}
