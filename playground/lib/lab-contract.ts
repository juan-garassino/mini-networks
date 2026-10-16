"use client";

// THE LAB CONTRACT — the one readiness and stillness rule every design in the
// library obeys (DESIGN-LIBRARY.md § Contract). Screenshots, shared links and
// the shoot harness (scripts/shoot.mjs) depend on it.
//
//   still  ?still=1 OR prefers-reduced-motion. Still means FRAME 0: every loop
//          holds its first frame, nothing enters (no fade, stagger or slide),
//          the camera jumps instead of flying — and the page is ready as soon
//          as it is painted. ?still=1 alone (useStillParam) additionally hides
//          the lab's own furniture and stops data polling: a screenshot, not a
//          visitor, is looking.
//   ready  data-lab-ready="1" on the design's root, set ONCE per load, only
//          after the design says it has SETTLED (data loaded, layout computed,
//          camera landed, entrance finished — the design knows which apply),
//          the web fonts are in, no ancestor is mid-fade (opacity < 1), and two
//          frames have painted the result.
//   hook   window.__lab = { select(name), view({ zoom, focus }) , …}: the test
//          hook onto the real interaction paths, installed once ready.
//   load   before ready, the design's own loading surface (labLoading, below).
//
// URL views (?zoom=overview|region|node&focus=<model>) live in
// components/lab/shared/url-state.ts; Motion's global freeze in
// components/lab/shared/still.tsx (LabMotion). Both are re-exported here so a
// new design imports the whole contract from one place.
import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";

export { useLabView, parseLabView, type LabView, type Zoom } from "@/components/lab/shared/url-state";
export { LabMotion } from "@/components/lab/shared/still";

const REDUCED = "(prefers-reduced-motion: reduce)";

const readParam = () => new URLSearchParams(window.location.search).get("still") === "1";
const readReduced = () => window.matchMedia?.(REDUCED).matches ?? false;

function subscribe(cb: () => void) {
  const mq = window.matchMedia?.(REDUCED) ?? null;
  mq?.addEventListener("change", cb);
  window.addEventListener("popstate", cb);
  return () => { mq?.removeEventListener("change", cb); window.removeEventListener("popstate", cb); };
}

/** Still = ?still=1 or prefers-reduced-motion: frame 0, no entrance, no
 * camera flight. The server render (static export) is still, so nothing
 * starts moving before the client knows. */
export function useStill(): boolean {
  return useSyncExternalStore(subscribe, () => readParam() || readReduced(), () => true);
}

/** ?still=1 alone — the screenshot flag (hide lab furniture, stop polling).
 * Use useStill() for anything that moves. */
export function useStillParam(): boolean {
  return useSyncExternalStore(subscribe, readParam, () => false);
}

/** No element in the chain from `el` to <html> is mid-fade. */
function opaque(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) if (getComputedStyle(e).opacity !== "1") return false;
  return true;
}

/**
 * The value for the root's data-lab-ready attribute: "1" once `settled` is
 * true AND (after `afterMs`, e.g. an entrance's length) the fonts are loaded,
 * `ref`'s ancestors are opaque, and two frames have painted. Latches: a later
 * camera flight or reselection never takes it back.
 *
 *   <div ref={ref} data-lab-ready={useLabReady(drawn && landed, ref)}>
 */
export function useLabReady(settled: boolean, ref?: RefObject<Element | null>, afterMs = 0): "1" | undefined {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!settled || ready) return;
    let alive = true, raf = 0;
    const t0 = performance.now();
    const tick = () => {
      if (!alive) return;
      if (performance.now() - t0 >= afterMs && opaque(ref?.current ?? null)) {
        // the frame after the next: the settled state has been painted
        raf = requestAnimationFrame(() => { raf = requestAnimationFrame(() => { if (alive) setReady(true); }); });
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    document.fonts.ready.then(tick);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [settled, ready, ref, afterMs]);
  return ready ? "1" : undefined;
}

// LOADING — one convention, every design its own look (DESIGN-LIBRARY.md
// § Loading). Until its data is in and laid out, a design draws its OWN
// loading surface from its OWN tokens, at first paint: its ground, the chrome
// it already knows (title, tabs, corners) where they will stay, and one quiet
// status line in its own voice where the content will land. Never a
// neighbour's loader, never a spinner, never data-lab-ready. The phases:
//   api      waiting for the zoo's API (/web/*)
//   offline  the API refused; the design is retrying (say how to start it)
//   layout   data in, being laid out (routing, camera fit, painting)

export type LoadPhase = "api" | "offline" | "layout";

/** The phase to show, or null once the design can draw itself. */
export function loadPhase(data: unknown, { offline = false, laidOut = true } = {}): LoadPhase | null {
  if (!data) return offline ? "offline" : "api";
  return laidOut ? null : "layout";
}

/** Spread on the loading surface's root: a polite live status the shooter and
 * screen readers can find (`[data-lab-loading]`), naming its phase.
 *   <div {...labLoading(phase)} className="…own tokens…">Routing the sheet…</div> */
export function labLoading(phase: LoadPhase) {
  return { role: "status", "aria-live": "polite", "data-lab-loading": phase } as const;
}

/** The window.__lab test hook (scripts/README-shoot.md). */
export interface LabHook {
  select?: (name: string) => void;
  view?: (v: { zoom: "overview" | "region" | "node"; focus?: string }) => void;
  [extra: string]: unknown;
}

/** Install `hook` as window.__lab; returns the uninstaller (an effect's cleanup):
 *   useEffect(() => (ready ? installLabHook({ select, view }) : undefined), [ready, …]); */
export function installLabHook(hook: LabHook): () => void {
  const w = window as unknown as { __lab?: LabHook };
  w.__lab = hook;
  return () => { if (w.__lab === hook) delete w.__lab; };
}
