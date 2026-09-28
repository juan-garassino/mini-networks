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

  const blobs: { key: string; x: number; y: number; fill: string; k: number }[] = [];
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
      blobs.push({ key: `${p.id}:${i}`, x: a.x * view.sx + view.tx, y: a.y * view.sy + view.ty, fill: fam(p.fromFamily).fill, k });
    }
  }
  const r = size / 2;
  return (
    <g pointerEvents="none" aria-hidden>
      {blobs.map((b) => (
        <g key={b.key} transform={`translate(${b.x} ${b.y}) scale(${b.k})`}>
          <circle r={r * 1.75} fill="#fff" opacity={0.55} />
          <circle r={r * 1.3} fill="#fff" opacity={0.8} />
          <rect x={-r} y={-r} width={size} height={size} rx={r * 0.55} fill={b.fill} stroke={INK} strokeWidth={1.8} />
          <rect x={-r * 0.6} y={-r * 0.62} width={r * 0.75} height={r * 0.38} rx={r * 0.19} fill="#fff" opacity={0.95} />
        </g>
      ))}
    </g>
  );
}
