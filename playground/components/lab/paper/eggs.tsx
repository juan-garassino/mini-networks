"use client";

// Paper renderings of the shared teaching eggs (components/lab/shared/eggs):
// speech-note bubbles in the HTML overlay, positioned over their world point.
import { useEffect, useState } from "react";
import type { Pt } from "@/lib/world";
import { GROKKING_EGG, RUINS, type RealLossCurve } from "@/components/lab/shared/eggs";
import { Sparkline } from "@/components/lab/shared/lesson/sparkline";
import { displayName } from "@/components/lab/shared/card-model";
import { PAPER } from "./encoding";
import styles from "./paper.module.css";

/** A cut-paper speech note whose tail points at `at` (screen px). */
export function Note({ at, width = 280, children, below = false }: { at: Pt; width?: number; children: React.ReactNode; below?: boolean }) {
  const left = Math.max(12, Math.min(at.x - width / 2, (typeof window !== "undefined" ? window.innerWidth : 1440) - width - 12));
  return (
    <div className={`${styles.card} pointer-events-none absolute z-[15] rounded-xl px-3.5 py-2.5 text-[15px] leading-snug`}
      style={{ left, top: below ? at.y + 18 : undefined, bottom: below ? undefined : `calc(100% - ${at.y - 16}px)`, width }}>
      {children}
      <span aria-hidden className="absolute h-3.5 w-3.5 rotate-45 bg-[#FFFDF6]"
        style={{ left: Math.max(14, Math.min(width - 28, at.x - left - 7)), [below ? "top" : "bottom"]: -7 }} />
    </div>
  );
}

/** Grokking clicks late: "memorising…" while held, the insight after 4 s. */
export function GrokkingNote({ at, clicked }: { at: Pt; clicked: boolean }) {
  return (
    <Note at={at} width={clicked ? 320 : 260}>
      {!clicked ? (
        <p className="italic text-[#5A4B3C]">{GROKKING_EGG.before}…</p>
      ) : (
        <>
          <p className="font-semibold">{GROKKING_EGG.after}</p>
          <p className="mt-1 text-[14px]">{GROKKING_EGG.explain}</p>
          <Sparkline points={GROKKING_EGG.sketch.val as unknown as [number, number][]} label="held-out accuracy" width={290} height={56}
            showValues={false} palette={{ line: PAPER.faceDeep, axis: "#CDBFA3", text: PAPER.inkSoft }} />
          <p className="text-[13px] text-[#5A4B3C]">Illustration of the paper&apos;s curve, not a zoo run.</p>
        </>
      )}
    </Note>
  );
}

/** Critter trains: a REAL loss series drawn live over ~3 s (hidden if none). */
export function CritterTraining({ at, curve, loading, still }: { at: Pt; curve: RealLossCurve | null; loading: boolean; still: boolean }) {
  const [p, setP] = useState(still ? 1 : 0);
  useEffect(() => {
    if (!curve || still) { setP(1); return; }
    setP(0);
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => { const k = Math.min(1, (now - t0) / 2800); setP(k); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [curve, still]);
  if (!curve && !loading) return null;
  return (
    <Note at={at} width={250}>
      {!curve ? <p className="italic text-[#5A4B3C]">Finding a real run to train on…</p> : (
        <>
          <p className="font-semibold">{p < 1 ? "Training…" : "Trained! Loss went down."}</p>
          <Sparkline points={curve.points} label={curve.key.replace(/_/g, " ")} width={222} height={60} progress={p}
            palette={{ line: PAPER.faceDeep, axis: "#CDBFA3", text: PAPER.inkSoft, fill: "rgba(47,116,224,0.12)" }} />
          <p className="text-[13px] text-[#5A4B3C]">A real curve: {displayName(curve.model)}, run {curve.runId.split("/").pop()}</p>
        </>
      )}
    </Note>
  );
}

/** A retired model's epitaph, from the ruins islet. */
export function RuinNote({ at, id }: { at: Pt; id: string }) {
  const r = RUINS.find((x) => x.id === id);
  if (!r) return null;
  return (
    <Note at={at} width={300}>
      <p className="font-semibold">{r.name}</p>
      <p className="mt-1 text-[14px]">{r.epitaph}</p>
      {r.successor && <p className="mt-1 text-[14px] text-[#5A4B3C]">Lives on as {displayName(r.successor)}.</p>}
    </Note>
  );
}
