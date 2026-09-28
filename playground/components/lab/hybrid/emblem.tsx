"use client";

// A model's emblem (lib/icons.tsx species glyph) re-drawn as PIXEL ART for the
// chrome: the vector glyph is rasterised once to a 20×20 grid at runtime
// (canvas, alpha threshold) and printed as crisp 1×1 rects at an integer
// scale. Grids are cached per model for the page session. On the map the
// same glyph stays vector (paper medium) — one identity, two media.
import { useEffect, useRef, useState } from "react";
import { iconFor } from "@/lib/icons";

const N = 20;
const cache = new Map<string, boolean[]>();

function rasterise(svg: SVGSVGElement): Promise<boolean[]> {
  return new Promise((resolve) => {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(N));
    clone.setAttribute("height", String(N));
    clone.setAttribute("stroke", "#000");
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(clone.outerHTML)}`;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = N;
      const g = c.getContext("2d");
      if (!g) return resolve([]);
      g.drawImage(img, 0, 0, N, N);
      const d = g.getImageData(0, 0, N, N).data;
      const out: boolean[] = [];
      for (let i = 0; i < N * N; i++) out.push(d[i * 4 + 3] > 96);
      resolve(out);
    };
    img.onerror = () => resolve([]);
    img.src = url;
  });
}

export function PixelEmblem({ name, scale = 3, color, className }: {
  name: string; scale?: number; color: string; className?: string;
}) {
  const Icon = iconFor(name);
  const src = useRef<HTMLSpanElement | null>(null);
  const [grid, setGrid] = useState<boolean[] | null>(cache.get(name) ?? null);
  useEffect(() => {
    const hit = cache.get(name);
    if (hit) { setGrid(hit); return; }
    const svg = src.current?.querySelector("svg");
    if (!svg) return;
    let alive = true;
    rasterise(svg).then((g) => { cache.set(name, g); if (alive) setGrid(g); });
    return () => { alive = false; };
  }, [name]);
  const size = N * scale;
  return (
    <span className={className} style={{ display: "inline-block", width: size, height: size, position: "relative" }} aria-hidden>
      {!grid && Icon && (
        <span ref={src} style={{ position: "absolute", inset: 0, opacity: 0 }}>
          <Icon width={N} height={N} strokeWidth={2.6} />
        </span>
      )}
      {grid && (
        <svg width={size} height={size} viewBox={`0 0 ${N} ${N}`} shapeRendering="crispEdges">
          {grid.map((on, i) => (on ? <rect key={i} x={i % N} y={Math.floor(i / N)} width={1} height={1} fill={color} /> : null))}
        </svg>
      )}
    </span>
  );
}
