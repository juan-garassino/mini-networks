"use client";

// The one animation primitive for the mechanism diagrams (see STYLE.md
// § Animation). A diagram asks for a frame counter:
//
//   const frame = useTick(3, 3, still);   // 3 fps, frames 0,1,2, then wraps
//   <Wire pts={…} fill={T.wireHot} step={3} phase={frame} />   // dots march a→b
//
// Rules the hook enforces so authors cannot forget them:
//   · frame is 0 while `still` (screenshots), under the lab contract's still
//     (?still=1 or reduced motion, lib/lab-contract.ts useStill), and when
//     frames ≤ 1 — frame 0 must therefore be the complete, canonical drawing;
//   · the loop is driven by requestAnimationFrame and PAUSES while the tab is
//     hidden (no work, no drift), resuming on the frame it stopped at;
//   · fps is clamped to MAX_FPS = 6: the diagrams step like a flip-book, they
//     never glide.
import { useEffect, useState } from "react";
import { useStill } from "@/lib/lab-contract";

export const MAX_FPS = 6;

export function useTick(fps: number, frames: number, still: boolean): number {
  const [frame, setFrame] = useState(0);
  const period = 1000 / Math.max(0.1, Math.min(MAX_FPS, fps));
  const n = Math.max(1, Math.floor(frames));
  const frozen = useStill();
  const active = !still && !frozen && n > 1 && fps > 0;

  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    let raf = 0;
    let last = 0;
    let acc = 0;

    const loop = (now: number) => {
      acc += now - last;
      last = now;
      if (acc >= period) {
        const k = Math.floor(acc / period);
        acc -= k * period;
        setFrame((f) => (f + k) % n);
      }
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (raf || document.hidden) return;
      last = performance.now();
      acc = 0;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    document.addEventListener("visibilitychange", onVisibility);
    start();
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, period, n]);

  return active ? frame % n : 0;
}
