// Pixel primitives shared by every mechanism diagram. Coordinates are in
// "art pixels" (the SVG viewBox unit); everything snaps to the integer grid
// and renders with shape-rendering="crispEdges", so nothing anti-aliases.
import type { CSSProperties, ReactNode } from "react";
import { FONT_H, textPath, textWidth } from "./pixel-font";
import { heatIndex, rampIndex, type Theme } from "./themes";

type Pt = readonly [number, number];

/** Every integer pixel on the segment a→b (Bresenham). */
function linePixels([x0, y0]: Pt, [x1, y1]: Pt): Pt[] {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const out: Pt[] = [];
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return out;
}

/**
 * Path data for a polyline drawn as pixels: every `step`-th pixel (1 = solid).
 * `phase` shifts which pixels are lit along the walk from pts[0] to the end, so
 * raising it by one per animation frame marches the dots in the direction of
 * flow (see tick.ts); it has no effect on a solid wire.
 */
export function pixelPolyline(pts: Pt[], step = 1, w = 1, phase = 0): string {
  let d = "";
  let k = 0;
  const seen = new Set<string>();
  const ph = ((Math.round(phase) % step) + step) % step;
  for (let i = 0; i + 1 < pts.length; i++) {
    for (const [x, y] of linePixels(pts[i], pts[i + 1])) {
      const key = `${x},${y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if ((k++ - ph + step) % step === 0) d += `M${x} ${y}h${w}v${w}h${-w}z`;
    }
  }
  return d;
}

export function Wire({ pts, fill, step = 2, w = 1, phase = 0 }: {
  pts: Pt[]; fill: string; step?: number; w?: number;
  /** animation: the frame from useTick — dots advance one pixel per unit, a→b */
  phase?: number;
}) {
  return <path d={pixelPolyline(pts, step, w, phase)} fill={fill} />;
}

export function PText({ x, y, text, fill, s = 1, anchor = "start" }: {
  x: number; y: number; text: string; fill: string; s?: number; anchor?: "start" | "middle" | "end";
}) {
  return <path d={textPath(text, x, y, s, anchor)} fill={fill} />;
}

/**
 * Pixel text as its own inline SVG, for page chrome around the diagrams
 * (headings, nav). `s` CSS px per font pixel (integer); paints currentColor so
 * CSS decides the colour. label="" marks it decorative. Underscores would read as subscripts, so names pass
 * through `displayName` first.
 */
export function PixelLabel({ text, s = 2, label = text, style }: {
  text: string; s?: number; label?: string; style?: CSSProperties;
}) {
  const w = textWidth(text) * s;
  const h = (FONT_H + 2) * s; // + 2 descender rows
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" role={label ? "img" : undefined}
      aria-label={label || undefined} aria-hidden={label ? undefined : true}
      style={{ display: "block", flex: "none", ...style }}>
      <path d={textPath(text, 0, 0, s)} fill="currentColor" />
    </svg>
  );
}

/** A model id as words for the pixel face: text_seq2seq → "text seq2seq". */
export { displayName } from "@/lib/copy"; // the library's one naming rule

/**
 * An n×n map (values −1..1, row-major) as a thumbnail with `px` art pixels per
 * cell, painted in the theme's 8-step ramp. One path per ramp step, runs merged.
 */
export function Thumb({ x, y, data, n = 28, px = 2, theme, opacity = 1, frame = true, heat = false }: {
  x: number; y: number; data: ArrayLike<number>; n?: number; px?: number; theme: Theme;
  opacity?: number; frame?: boolean; heat?: boolean;
}) {
  const ds: string[] = Array(8).fill("");
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      const lvl = heat ? heatIndex(data[r * n + c]) : rampIndex(data[r * n + c]);
      let e = c + 1;
      while (e < n && (heat ? heatIndex(data[r * n + e]) : rampIndex(data[r * n + e])) === lvl) e++;
      ds[lvl] += `M${x + c * px} ${y + r * px}h${(e - c) * px}v${px}h${-(e - c) * px}z`;
      c = e;
    }
  }
  const pal = heat ? theme.heat : theme.ramp;
  const S = n * px;
  return (
    <g opacity={opacity}>
      {theme.shadow && frame && <rect x={x + 2} y={y + 2} width={S} height={S} fill={theme.shadow} />}
      {ds.map((d, i) => (d ? <path key={i} d={d} fill={pal[i]} /> : null))}
      {frame && <path d={`M${x - 1} ${y - 1}h${S + 2}v${S + 2}h${-(S + 2)}z M${x} ${y}v${S}h${S}v${-S}z`} fill={theme.frame} fillRule="evenodd" />}
    </g>
  );
}

/** A 1-px outline rectangle (evenodd ring). */
export function Frame({ x, y, w, h, fill }: { x: number; y: number; w: number; h: number; fill: string }) {
  return <path d={`M${x} ${y}h${w}v${h}h${-w}z M${x + 1} ${y + 1}v${h - 2}h${w - 2}v${-(h - 2)}z`} fill={fill} fillRule="evenodd" />;
}

/**
 * A stack of vertical channel bars: `bars` bars of `bw`×`h`, `gap` apart,
 * shaded like a pixel sprite (lit left edge, dark right edge).
 */
export function Bars({ x, y, bars, h, theme, bw = 4, gap = 2, detail, dim = false }: {
  x: number; y: number; bars: number; h: number; theme: Theme; bw?: number; gap?: number;
  /** recede: shadow-tone bars without the lit edge (context, not focus) */
  dim?: boolean;
  /** optional per-bar pixel dots (decoder "features") */
  detail?: (bar: number) => number[];
}) {
  const out: ReactNode[] = [];
  for (let b = 0; b < bars; b++) {
    const bx = x + b * (bw + gap);
    if (theme.shadow) out.push(<rect key={`s${b}`} x={bx + 1} y={y + 1} width={bw} height={h} fill={theme.shadow} />);
    out.push(<rect key={`b${b}`} x={bx} y={y} width={bw} height={h} fill={dim ? theme.accentLo : theme.accent} />);
    if (bw >= 3 && !dim) {
      out.push(<rect key={`h${b}`} x={bx} y={y} width={1} height={h} fill={theme.accentHi} />);
      out.push(<rect key={`l${b}`} x={bx + bw - 1} y={y} width={1} height={h} fill={theme.accentLo} />);
      out.push(<rect key={`t${b}`} x={bx} y={y} width={bw} height={1} fill={theme.accentHi} />);
    }
    const ds = detail?.(b) ?? [];
    for (const dy of ds) out.push(<rect key={`d${b}-${dy}`} x={bx + Math.floor(bw / 2)} y={y + dy} width={1} height={1} fill={theme.accentHi} />);
  }
  return <g>{out}</g>;
}

export const barsWidth = (bars: number, bw = 4, gap = 2) => bars * bw + (bars - 1) * gap;

/** The loss diamond (pixel rhombus with a lit core), centred on (cx, cy). */
export function Diamond({ cx, cy, r = 6, theme }: { cx: number; cy: number; r?: number; theme: Theme }) {
  let outer = "", inner = "";
  for (let dy = -r; dy <= r; dy++) {
    const half = r - Math.abs(dy);
    outer += `M${cx - half} ${cy + dy}h${2 * half + 1}v1h${-(2 * half + 1)}z`;
    const ih = r - 3 - Math.abs(dy);
    if (ih >= 0) inner += `M${cx - ih} ${cy + dy}h${2 * ih + 1}v1h${-(2 * ih + 1)}z`;
  }
  return (
    <g>
      <path d={outer} fill={theme.loss} />
      <path d={inner} fill={theme.lossHi} />
      <rect x={cx} y={cy} width={1} height={1} fill={theme.spark} />
    </g>
  );
}

/** A small pixel ring node with a glyph (e.g. the "−" subtract node). */
export function Node({ cx, cy, glyph, theme, hot = false }: { cx: number; cy: number; glyph: string; theme: Theme; hot?: boolean }) {
  const c = hot ? theme.wireHot : theme.frame;
  // 11×11 pixel circle
  const rows = ["...xxxxx...", ".xx.....xx.", ".x.......x.", "x.........x", "x.........x", "x.........x", "x.........x", "x.........x", ".x.......x.", ".xx.....xx.", "...xxxxx..."];
  let d = "";
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === "x") d += `M${cx - 5 + x} ${cy - 5 + y}h1v1h-1z`; });
  return (
    <g>
      <path d={d} fill={c} />
      <PText x={cx + 1} y={cy - 3} text={glyph} fill={hot ? theme.wireHot : theme.text} anchor="middle" />
    </g>
  );
}
