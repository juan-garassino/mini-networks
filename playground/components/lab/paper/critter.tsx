"use client";

// The one-eyed perceptron critter as a paper cutout, walking the roads from
// the focused model's root atom to it (pathToAtom reversed). Its own rAF, so
// the static map layers never re-render while it walks. Under still=1 it is
// parked on the focused spot.
import { useEffect, useMemo, useState } from "react";
import { samplePolyline, type Pt } from "@/lib/world";
import { CRITTER } from "@/components/lab/shared/critter";
import { PAPER } from "./encoding";

const HEIGHT = 44;                     // world px, antenna to feet
const K = HEIGHT / 140;

export function PaperCritter({ path, stop = 1, still, park }: { path: Pt[]; stop?: number; still: boolean; park: Pt }) {
  const walk = useMemo(() => samplePolyline(path), [path]);
  const [t, setT] = useState(still ? 1 : 0);

  useEffect(() => {
    if (still || walk.length < 1) { setT(1); return; }
    setT(0);
    const dur = ((walk.length * stop) / CRITTER.walkSpeed) * 1000;
    const t0 = performance.now() + 250;   // let the camera start first
    let raf = 0;
    const step = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - t0) / dur));
      setT(k);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [walk, still, stop]);

  const done = t >= 1 || walk.length < 1;
  const p = done ? { x: park.x, y: park.y, angle: 0 } : walk.at(t * stop);
  const dist = t * stop * walk.length;
  const hop = done ? 0 : -Math.abs(Math.sin(dist / 10)) * 5;
  const dir = !done && Math.cos(p.angle) < -0.2 ? -1 : 1;
  const step = done ? 0 : Math.sin(dist / 10) * 4;

  return (
    <g transform={`translate(${p.x} ${p.y})`} pointerEvents="none" aria-hidden>
      <ellipse cx={2} cy={2} rx={11} ry={4} fill={PAPER.shadow} />
      <g transform={`translate(0 ${hop}) scale(${dir * K} ${K}) translate(-60 -126)`}>
        {/* die-cut rim around the whole silhouette */}
        <g stroke={PAPER.die} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" fill={PAPER.die}>
          <path d={CRITTER.body} />
          <path d={CRITTER.antenna} fill="none" />
          <circle {...CRITTER.antennaTip} />
          {CRITTER.feet.map((f, i) => <ellipse key={i} cx={f.cx + (i ? step : -step)} cy={f.cy} rx={11} ry={7} />)}
        </g>
        {CRITTER.feet.map((f, i) => (
          <ellipse key={i} cx={f.cx + (i ? step : -step)} cy={f.cy} rx={11} ry={7} fill={PAPER.ink} />
        ))}
        <path d={CRITTER.body} fill="#FFD84D" stroke={PAPER.ink} strokeWidth={7} />
        <path d="M60 28 C89 26 103 50 101 78 C99 104 83 118 60 118 Z" fill="#F2B632" opacity={0.55} />
        <path d={CRITTER.antenna} fill="none" stroke={PAPER.ink} strokeWidth={7} strokeLinecap="round" />
        <circle {...CRITTER.antennaTip} fill={PAPER.flag} stroke={PAPER.ink} strokeWidth={5} />
        <circle {...CRITTER.eye} fill={PAPER.die} stroke={PAPER.ink} strokeWidth={6} />
        <circle {...CRITTER.pupil} fill={PAPER.ink} />
        <circle cx={CRITTER.pupil.cx + 2.5} cy={CRITTER.pupil.cy - 2.5} r={2} fill={PAPER.die} />
        <path d={CRITTER.smile} fill="none" stroke={PAPER.ink} strokeWidth={6} strokeLinecap="round" />
      </g>
    </g>
  );
}
