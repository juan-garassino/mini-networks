"use client";

// The one-eyed perceptron critter as a paper cutout, walking the roads from
// the focused model's root atom to it (pathToAtom reversed). Its own rAF, so
// the static map layers never re-render while it walks. Under still=1 it is
// parked on the focused spot.
import { useEffect, useMemo, useState } from "react";
import { samplePolyline, type Pt } from "@/lib/world";
import { CRITTER } from "@/components/lab/shared/critter";
import { CritterArt, CRITTER_WALK, type CritterPose } from "./art";

const HEIGHT = 44;                     // world px, antenna to feet

export function PaperCritter({ path, stop = 1, still, park, place, training = false }: {
  path: Pt[]; stop?: number; still: boolean; park: Pt;
  /** the critter-trains egg is running */
  training?: boolean;
  /** diorama: world point → screen base + scale (the critter stands up as a billboard) */
  place?: (p: Pt) => { x: number; y: number; k: number };
}) {
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
  const dir = !done && Math.cos(p.angle) < -0.2 ? -1 : 1;

  // the illustrator's cutout (art/critter): a 4-frame walk by distance travelled
  const pose: CritterPose = done ? (training ? "train" : "idle") : CRITTER_WALK[Math.floor(dist / 9) % 4];
  return (
    <g transform={place ? (() => { const q = place(p); return `translate(${q.x.toFixed(1)} ${q.y.toFixed(1)}) scale(${q.k.toFixed(4)})`; })() : `translate(${p.x} ${p.y})`}
      pointerEvents="none" aria-hidden>
      <CritterArt pose={pose} facing={dir as 1 | -1} size={HEIGHT} />
    </g>
  );
}
