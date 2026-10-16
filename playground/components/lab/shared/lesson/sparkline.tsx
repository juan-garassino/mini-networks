"use client";

// Tiny skinnable metric curve for a lesson card (useLesson().curve[i]) or the
// critter egg (useRealLossCurve().curve). Minimal axes: one baseline. Text is
// ≥13px on screen (the viewBox is 1:1 with width/height). `progress` (0..1)
// draws only the first part of the curve — animate it to "train" live.
import type { ReactNode } from "react";

export interface SparklinePalette {
  line: string;
  axis: string;
  text: string;
  /** optional area fill under the line */
  fill?: string;
  /** end-point dot (defaults to `line`) */
  dot?: string;
}

export interface SparklineProps {
  points: [number, number][];
  palette: SparklinePalette;
  width?: number;
  height?: number;
  /** metric name, top-left (e.g. "loss") */
  label?: string;
  /** 0..1 — how much of the curve is drawn (default 1) */
  progress?: number;
  /** show "first → last" top-right (default true) */
  showValues?: boolean;
  fontPx?: number;
  format?: (v: number) => string;
  title?: string;
  className?: string;
}

export function fmtMetric(v: number): string {
  const a = Math.abs(v);
  if (a !== 0 && (a < 0.01 || a >= 10000)) return v.toExponential(1);
  return a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export function Sparkline({
  points, palette, width = 180, height = 56, label, progress = 1, showValues = true,
  fontPx = 13, format = fmtMetric, title, className,
}: SparklineProps) {
  const fs = Math.max(13, fontPx);
  const top = label || showValues ? fs + 6 : 3;
  const bottom = height - 3;
  const pad = 3;
  const pts = points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (pts.length < 2) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={className} role="img"
        aria-label={title ?? "no curve yet"}>
        <line x1={0} x2={width} y1={bottom} y2={bottom} stroke={palette.axis} strokeWidth={1} />
        <text x={0} y={fs} fontSize={fs} fill={palette.text}>{label ? `${label} — ` : ""}no curve yet</text>
      </svg>
    );
  }
  const xs = pts.map(([x]) => x), ys = pts.map(([, y]) => y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  const m = (y1 - y0) * 0.08; y0 -= m; y1 += m;
  const X = (x: number) => pad + ((x - x0) / Math.max(1e-12, x1 - x0)) * (width - 2 * pad);
  const Y = (y: number) => bottom - 2 - ((y - y0) / (y1 - y0)) * (bottom - 2 - top);

  // partial curve up to `progress`, interpolating the last segment
  const p = Math.min(1, Math.max(0, progress));
  const upto = p * (pts.length - 1);
  const whole = Math.floor(upto);
  const drawn: [number, number][] = pts.slice(0, whole + 1).map(([x, y]) => [X(x), Y(y)]);
  if (whole < pts.length - 1 && upto > whole) {
    const [ax, ay] = pts[whole], [bx, by] = pts[whole + 1], f = upto - whole;
    drawn.push([X(ax + (bx - ax) * f), Y(ay + (by - ay) * f)]);
  }
  const d = drawn.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const end = drawn[drawn.length - 1];
  const lastShown = pts[Math.min(pts.length - 1, Math.round(upto))][1];

  let area: ReactNode = null;
  if (palette.fill && drawn.length > 1)
    area = <path d={`${d} L${end[0].toFixed(1)} ${bottom} L${drawn[0][0].toFixed(1)} ${bottom} Z`} fill={palette.fill} stroke="none" />;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={className} role="img"
      aria-label={title ?? `${label ?? "metric"}: ${format(pts[0][1])} to ${format(pts[pts.length - 1][1])} over ${pts.length} points`}>
      <line x1={0} x2={width} y1={bottom} y2={bottom} stroke={palette.axis} strokeWidth={1} />
      {area}
      <path d={d} fill="none" stroke={palette.line} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={end[0]} cy={end[1]} r={2.6} fill={palette.dot ?? palette.line} />
      {label && <text x={0} y={fs} fontSize={fs} fill={palette.text}>{label}</text>}
      {showValues && (
        <text x={width} y={fs} fontSize={fs} fill={palette.text} textAnchor="end">
          {format(pts[0][1])} → {format(lastShown)}
        </text>
      )}
    </svg>
  );
}
