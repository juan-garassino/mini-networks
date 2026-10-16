"use client";

// Easter egg: poke the keeper in the top bar 7 times and it trains — a REAL loss curve from a
// local run, drawn in over MOTION.keeper ms (complete at once when frozen).
import { useEffect, useState } from "react";
import type { RealLossCurve } from "@/components/lab/shared/eggs";
import { Sparkline } from "@/components/lab/shared/lesson/sparkline";
import { displayName } from "@/lib/copy";
import { COLOR, MOTION, RADIUS, SHADOW, SPACE, TYPE } from "./tokens";
import s from "./flow.module.css";

export function KeeperTrains({ curve, still, onClose }: { curve: RealLossCurve; still: boolean; onClose: () => void }) {
  const [p, setP] = useState(still ? 1 : 0);
  useEffect(() => {
    if (still) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => { const k = Math.min(1, (now - t0) / MOTION.keeper); setP(k); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [curve, still]);
  return (
    <div className="absolute left-3 z-40 w-[300px] border p-3"
      style={{ top: SPACE.barDesktop + 8, borderColor: COLOR.ink, borderRadius: RADIUS.panel, background: COLOR.card, boxShadow: SHADOW.panel }}>
      <div className="flex items-center justify-between">
        <p className="font-extrabold" style={{ fontSize: TYPE.body }}>Fine, I&apos;ll train.</p>
        <button type="button" onClick={onClose} className={`${s.btn} font-bold underline`} style={{ fontSize: TYPE.ui }}>Close</button>
      </div>
      <Sparkline points={curve.points} progress={p} label={displayName(curve.key)} width={272} height={70}
        palette={{ line: COLOR.accent, axis: COLOR.axis, text: COLOR.ink, fill: COLOR.accentWash }} title="a real loss curve" />
      <p className="mt-1 font-bold" style={{ color: COLOR.inkSoft, fontSize: TYPE.ui }}>a real run: {displayName(curve.model)}, {curve.runId}</p>
    </div>
  );
}
