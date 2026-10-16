"use client";

// Skinnable forward-pass anatomy of one species (lib/schematics.ts), derived
// from components/network-flow.tsx: stages left→right, edges, residual skip
// arcs (above) and recurrence loops (below), a pulse that walks the stages in
// order. Every colour comes from `palette`, so each skin draws it in its own
// ink. Motion: only when `animate` AND the viewer allows motion (CSS
// prefers-reduced-motion); pass animate={!still} — still=1 renders a frame
// that never changes. `activeStage` highlights one stage statically (use it
// to drive the Konami wave or a step-through without CSS animation).
import { useId } from "react";
import type { Stage } from "@/lib/schematics";

export interface AnatomyPalette {
  /** node outlines (and "out" fills) */
  node: string;
  /** connections */
  edge: string;
  /** the pulse / highlighted stage */
  active: string;
  /** stage labels */
  text: string;
  /** latent / router nodes, skip + loop arcs (defaults to `active`) */
  accent?: string;
  /** node interiors (defaults to none) */
  fill?: string;
}

export interface AnatomyProps {
  stages: Stage[];
  palette: AnatomyPalette;
  animate: boolean;
  /** rendered width in px (the SVG scales; labels stay ≥ labelPx on screen) */
  size?: number;
  activeStage?: number | null;
  /** on-screen label size in px (min 13) */
  labelPx?: number;
  /** accessible name, e.g. "transformer — one forward pass" */
  title?: string;
  className?: string;
}

const W = 440;
const H = 150;
const PAD = 34;
const STEP_S = 0.35;          // pulse delay between stages

export function Anatomy({
  stages, palette, animate, size = W, activeStage = null, labelPx = 13, title, className,
}: AnatomyProps) {
  const uid = "an" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const cols = stages.length;
  const accent = palette.accent ?? palette.active;
  const fill = palette.fill ?? "none";
  const k = W / Math.max(120, size);                 // viewBox units per screen px
  const fs = Math.max(13, labelPx) * k;
  const colX = (i: number) => PAD + (i * (W - 2 * PAD)) / Math.max(1, cols - 1);
  const nodeYs = (n: number) =>
    Array.from({ length: n }, (_, j) => H / 2 + (j - (n - 1) / 2) * Math.min(26, 90 / n + 12));

  // stagger labels onto two rows when neighbours would collide
  const spacing = cols > 1 ? (W - 2 * PAD) / (cols - 1) : W;
  const widest = Math.max(0, ...stages.map((s) => (s.l ?? "").length)) * 0.6 * fs;
  const stagger = widest > spacing * 0.95;
  const band = fs * (stagger ? 2.9 : 1.7);
  const cycle = Math.max(2.4, cols * STEP_S + 1.2);

  const isActive = (i: number) => activeStage === i;
  const cls = (base: string) => (animate ? `${uid}-${base}` : undefined);

  const shape = (s: Stage, i: number, x: number, y: number, key: string) => {
    const hot = isActive(i);
    const stroke = hot ? palette.active : s.k === "latent" || s.k === "router" ? accent : palette.node;
    const sw = hot ? 2.4 : 1.5;
    const style = animate ? { animationDelay: `${i * STEP_S}s` } : undefined;
    switch (s.k) {
      case "in":
      case "noise":
        return <rect key={key} x={x - 5} y={y - 5} width={10} height={10} fill={fill} stroke={stroke}
          strokeWidth={sw} strokeDasharray={s.k === "noise" ? "2 2" : undefined} className={cls("node")} style={style} />;
      case "latent":
        return <rect key={key} x={x - 5} y={y - 5} width={10} height={10} transform={`rotate(45 ${x} ${y})`}
          fill={fill} stroke={stroke} strokeWidth={sw} className={cls("node")} style={style} />;
      case "out":
        return <rect key={key} x={x - 6} y={y - 4} width={12} height={8} fill={hot ? palette.active : palette.node}
          stroke={stroke} strokeWidth={1} className={cls("node")} style={style} />;
      default:
        return <circle key={key} cx={x} cy={y} r={5} fill={fill} stroke={stroke} strokeWidth={sw}
          className={cls("node")} style={style} />;
    }
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H + band}`}
      width={size}
      className={className}
      role="img"
      aria-label={title ?? `forward pass: ${stages.map((s) => s.l ?? s.k).join(" → ")}`}
    >
      {animate && (
        <style>{`
@media (prefers-reduced-motion: no-preference) {
  .${uid}-edge { stroke-dasharray: 3 5; animation: ${uid}-flow ${cycle}s linear infinite; }
  .${uid}-node { animation: ${uid}-pulse ${cycle}s ease-out infinite; }
  @keyframes ${uid}-flow { to { stroke-dashoffset: -32; } }
  @keyframes ${uid}-pulse {
    0% { stroke: ${palette.active}; stroke-width: 2.6; }
    ${Math.round((100 * STEP_S * 1.6) / cycle)}%, 100% { stroke-width: 1.5; }
  }
}`}</style>
      )}

      {/* edges */}
      {stages.slice(0, -1).map((s, i) => {
        const next = stages[i + 1];
        const ys1 = nodeYs(s.n ?? 3);
        const ys2 = nodeYs(next.n ?? 3);
        const dense = next.k === "attn" || s.k === "attn";
        const hot = isActive(i + 1);
        return ys1.map((y1, a) =>
          ys2
            .map((y2, b) => ({ y2, b }))
            .filter(({ b }) => dense || Math.abs(a - b) <= 1)
            .map(({ y2, b }) => (
              <line key={`e-${i}-${a}-${b}`} x1={colX(i)} y1={y1} x2={colX(i + 1)} y2={y2}
                stroke={hot ? palette.active : s.k === "router" ? accent : palette.edge}
                strokeWidth={hot ? 1.3 : 0.9} opacity={dense ? 0.45 : 0.7}
                className={cls("edge")} style={animate ? { animationDelay: `${i * STEP_S}s` } : undefined} />
            )),
        );
      })}

      {/* residual skip (above) + recurrence loop (below) */}
      {stages.map((s, i) => {
        const arcs: React.ReactNode[] = [];
        if (s.skip && i + 2 < cols)
          arcs.push(
            <path key={`skip-${i}`} fill="none" stroke={accent} strokeWidth={1.3}
              d={`M ${colX(i)} ${H / 2 - 52} C ${colX(i + 1)} ${H / 2 - 78}, ${colX(i + 1)} ${H / 2 - 78}, ${colX(i + 2)} ${H / 2 - 52}`}
              className={cls("edge")} style={animate ? { animationDelay: `${i * STEP_S}s` } : undefined} />,
          );
        if (s.loop)
          arcs.push(
            <path key={`loop-${i}`} fill="none" stroke={accent} strokeWidth={1.3}
              d={`M ${colX(i) + 10} ${H / 2 + 52} C ${colX(i) + 34} ${H / 2 + 74}, ${colX(i) - 34} ${H / 2 + 74}, ${colX(i) - 10} ${H / 2 + 52}`}
              className={cls("edge")} style={animate ? { animationDelay: `${i * STEP_S}s` } : undefined} />,
          );
        return arcs;
      })}

      {/* nodes */}
      {stages.map((s, i) => nodeYs(s.n ?? 3).map((y, j) => shape(s, i, colX(i), y, `n-${i}-${j}`)))}

      {/* labels */}
      {stages.map((s, i) => (
        <text key={`l-${i}`} x={colX(i)} y={H + fs * 1.15 + (stagger && i % 2 ? fs * 1.2 : 0)}
          textAnchor={i === 0 ? "start" : i === cols - 1 ? "end" : "middle"}
          dx={i === 0 ? -PAD / 2 : i === cols - 1 ? PAD / 2 : 0}
          fontSize={fs} fill={isActive(i) ? palette.active : palette.text}>
          {s.l ?? ""}
        </text>
      ))}
    </svg>
  );
}
