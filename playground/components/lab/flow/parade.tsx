"use client";

// The signature: when a creature is selected, tensor blobs leave every one of
// its ancestors and ride the builds_on pipes, generation by generation, into
// it. A blob is tinted with the family of the creature it left. One parade per
// selection, then `onLanded` (the happy bounce). still=1 parks three blobs
// mid-pipe on every lineage pipe so the frame shows the whole route.
import { useEffect, useMemo, useState } from "react";
import { samplePolyline, type Pt } from "@/lib/world";
import type { View } from "./camera";
import { fam, INK } from "./palette";

export interface ParadePipe {
  id: string;
  /** world-px polyline, parent creature centre → child creature centre. */
  points: Pt[];
  fromFamily: string;
  /** seconds after the parade starts that this pipe's first blob departs. */
  start: number;
}

export const STEP = 0.95;      // seconds a blob takes to ride one pipe
const GAP = 0.17;              // seconds between blobs on the same pipe
const BLOBS = 3;               // blobs per pipe
const STILL_T = [0.32, 0.5, 0.68];

export function paradeLength(pipes: ParadePipe[]) {
  return pipes.reduce((m, p) => Math.max(m, p.start + STEP + GAP * (BLOBS - 1)), 0);
}

export function Parade({ pipes, view, size, still, runKey, onLanded }: {
  pipes: ParadePipe[]; view: View; size: number; still: boolean; runKey: string; onLanded: () => void;
}) {
  const samplers = useMemo(() => pipes.map((p) => ({ p, s: samplePolyline(p.points) })), [pipes]);
  const total = useMemo(() => paradeLength(pipes), [pipes]);
  const [t, setT] = useState(still ? -1 : 0);

  useEffect(() => {
    if (still || samplers.length === 0) return;
    let raf = 0;
    const t0 = performance.now();
    let landed = false;
    const tick = (now: number) => {
      const el = (now - t0) / 1000;
      setT(el);
      if (el < total + 0.05) raf = requestAnimationFrame(tick);
      else if (!landed) { landed = true; onLanded(); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // runKey restarts the parade for each new selection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey, still, samplers, total]);

  const blobs: { key: string; x: number; y: number; fill: string; fam: string; k: number }[] = [];
  for (const { p, s } of samplers) {
    for (let i = 0; i < BLOBS; i++) {
      let u: number;
      if (still) u = STILL_T[i];
      else {
        u = (t - p.start - i * GAP) / STEP;
        if (u <= 0 || u >= 1) continue;
      }
      const a = s.at(u);
      // swell out of the parent, shrink into the child
      const k = still ? 1 : Math.min(1, u * 6, (1 - u) * 5);
      blobs.push({ key: `${p.id}:${i}`, x: a.x * view.sx + view.tx, y: a.y * view.sy + view.ty, fill: fam(p.fromFamily).fill, fam: p.fromFamily, k });
    }
  }
  const r = size / 2;
  return (
    <g pointerEvents="none" aria-hidden>
      {blobs.map((b) => (
        <g key={b.key} transform={`translate(${b.x} ${b.y}) scale(${b.k})`}>
          <circle r={r * 1.75} fill="#fff" opacity={0.5} />
          <ellipse cx={r * 0.25} cy={r * 1.05} rx={r * 1.1} ry={r * 0.35} fill={INK} opacity={0.18} />
          <rect x={-r} y={-r} width={size} height={size} rx={r * 0.6} fill="#fff" stroke="#fff" strokeWidth={4} />
          <rect x={-r} y={-r} width={size} height={size} rx={r * 0.6} fill={`url(#fg-${b.fam})`} stroke={INK} strokeWidth={1.8} fillOpacity={0.92} />
          <ellipse cx={-r * 0.3} cy={-r * 0.42} rx={r * 0.42} ry={r * 0.22} transform={`rotate(-25 ${-r * 0.3} ${-r * 0.42})`} fill="#fff" opacity={0.95} />
          <circle cx={r * 0.38} cy={r * 0.35} r={r * 0.12} fill="#fff" opacity={0.7} />
        </g>
      ))}
    </g>
  );
}
