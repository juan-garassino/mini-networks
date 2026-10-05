"use client";

// The table's one entrance and its readiness contract (review 1, cross-design #1):
//   - still=1 or prefers-reduced-motion: NO entrance at all, every tile drawn final;
//   - otherwise tiles fade in row by row, then the f-block (the skin's motion tokens);
//   - data-lab-ready fires only once the last tile has landed AND every ancestor is
//     fully opaque (the page's own sheet transition included), on a painted frame.
import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";
import type { PeriodicSkin } from "./skins";

const noSubscribe = () => () => {};
const readFrozen = () =>
  new URLSearchParams(window.location.search).get("still") === "1"
  || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** true under ?still=1 or reduced motion (false on the server: the table renders after data loads). */
export function useFrozen(): boolean {
  return useSyncExternalStore(noSubscribe, readFrozen, () => false);
}

/** Seconds until the last tile of the entrance has landed. */
export function entranceEnd(m: PeriodicSkin["motion"], maxRow: number, maxCol: number, reactions: number): number {
  const table = (maxRow - 1) * m.rowStagger + maxCol * m.colStagger + m.enter;
  const fblock = m.reactionStart + Math.max(0, reactions - 1) * m.reactionStagger + m.enter;
  return Math.max(table, fblock);
}

const opaque = (el: Element | null) => {
  for (let e = el; e; e = e.parentElement) if (getComputedStyle(e).opacity !== "1") return false;
  return true;
};

/** Ready once `afterS` has passed and the sheet and all its ancestors are opaque. */
export function useReady(ref: RefObject<HTMLElement | null>, afterS: number, active: boolean): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!active) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      if (performance.now() - t0 >= afterS * 1000 && opaque(ref.current)) {
        raf = requestAnimationFrame(() => setReady(true)); // the frame after: painted
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ref, afterS, active]);
  return ready;
}
