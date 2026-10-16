"use client";

// Egg hooks (headless). Each skin renders the look; see README.md.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { RunSummary } from "@/lib/types";
import { KONAMI, advanceKonami } from "./konami";
import { liveTrainingModels } from "./trains";
import { bestDecreasing, better, lossCandidates, type RealLossCurve } from "../lesson/curve";
import { cachedMetrics } from "../lesson/metrics-cache";

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
}

/**
 * ↑↑↓↓←→←→BA on the keyboard → onUnlock() (then the matcher resets, so it can
 * be replayed). Ignores keys typed into inputs/textareas/selects/contenteditable
 * and any chord with Ctrl/Meta/Alt. Returns how many keys are matched so far
 * (0..10) for skins that want a subtle progress hint.
 */
export function useKonami(onUnlock: () => void, enabled = true): number {
  const [progress, setProgress] = useState(0);
  const pos = useRef(0);
  const cb = useRef(onUnlock);
  useEffect(() => { cb.current = onUnlock; }, [onUnlock]);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      const next = advanceKonami(pos.current, e.key);
      if (next === KONAMI.length) {
        pos.current = 0;
        setProgress(0);
        cb.current();
      } else if (next !== pos.current) {
        pos.current = next;
        setProgress(next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  return progress;
}

/**
 * true once the target has been held for `ms` — grokking's delayed "click".
 *  - a ref: hover (pointerenter/leave) OR keyboard focus (focusin/out) on that
 *    element counts; leaving both resets.
 *  - a string: the name the skin currently has hovered/focused (null = none);
 *    the same non-null value held for `ms` → true; any change resets.
 * Skins pass `null` in still mode so screenshots never flip mid-shot.
 */
export function useLongFocus(target: RefObject<Element | null> | string | null, ms = 4000): boolean {
  const [held, setHeld] = useState(false);           // ref form
  const [heldName, setHeldName] = useState<string | null>(null); // string form
  const isRef = target !== null && typeof target === "object";
  const name = isRef ? null : (target as string | null);
  const ref = isRef ? (target as RefObject<Element | null>) : null;

  // string form: remember WHICH name completed the hold, so a change of
  // name reads as "not held" immediately without a synchronous reset
  useEffect(() => {
    if (name == null) return;
    const id = setTimeout(() => setHeldName(name), ms);
    // leaving resets: the next hover of the same name waits the full hold again
    return () => { clearTimeout(id); setHeldName(null); };
  }, [name, ms]);

  // ref form
  useEffect(() => {
    const el = ref?.current;
    if (!el) return;
    let hover = false;
    let focus = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      if (hover || focus) {
        if (!timer) timer = setTimeout(() => setHeld(true), ms);
      } else {
        clearTimeout(timer);
        timer = undefined;
        setHeld(false);
      }
    };
    const on = (kind: "hover" | "focus", v: boolean) => () => {
      if (kind === "hover") hover = v; else focus = v;
      sync();
    };
    const enter = on("hover", true), leave = on("hover", false);
    const fin = on("focus", true), fout = on("focus", false);
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("focusin", fin);
    el.addEventListener("focusout", fout);
    return () => {
      clearTimeout(timer);
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("focusin", fin);
      el.removeEventListener("focusout", fout);
    };
  }, [ref, ms]);

  return isRef ? held : name != null && heldName === name;
}

/**
 * Click the critter `n` times (each click within `gapMs` of the last) and it
 * unlocks — it stays unlocked until reset(). Wire `click` to the critter's
 * onClick AND its keyboard activation (Enter/Space) so the egg is reachable
 * without a mouse.
 */
export function useCritterClicks(n = 7, gapMs = 2500) {
  const [count, setCount] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const last = useRef(0);
  const click = useCallback(() => {
    const now = Date.now();
    const next = now - last.current <= gapMs ? count + 1 : 1;
    last.current = now;
    setCount(next);
    if (next >= n) setUnlocked(true);
  }, [count, gapMs, n]);
  const reset = useCallback(() => { setCount(0); setUnlocked(false); last.current = 0; }, []);
  return { count, unlocked, click, reset, needed: n };
}

// one search per page session — the answer doesn't change while you look
let realCurve: Promise<RealLossCurve | null> | null = null;

async function findRealCurve(runs: RunSummary[]): Promise<RealLossCurve | null> {
  let best: RealLossCurve | null = null;
  for (const r of lossCandidates(runs)) {
    try {
      const m = await cachedMetrics(r);
      const c = bestDecreasing(r.id, r.model, m.series);
      if (c && (!best || better(c, best))) best = c;
      if (best && best.points.length >= 10) break;
    } catch {
      /* skip unreadable runs */
    }
  }
  return best;
}

/**
 * A REAL clearly-decreasing loss curve from /web/runs (+ metrics) for the
 * critter to "train" on: prefers a done run with ≥10 points, else the best
 * ≥3-point one. Fetches only when `enabled` (i.e. after the egg unlocks) and
 * at most once per page session. null → no run qualifies: keep the egg hidden.
 */
export function useRealLossCurve(runs: RunSummary[], enabled = true): {
  curve: RealLossCurve | null;
  loading: boolean;
} {
  const [curve, setCurve] = useState<RealLossCurve | null>(null);
  const [settled, setSettled] = useState(false);
  const hasRuns = runs.length > 0;
  const runsRef = useRef(runs);
  useEffect(() => { runsRef.current = runs; }, [runs]);

  useEffect(() => {
    if (!enabled || !hasRuns) return;
    let alive = true;
    realCurve ??= findRealCurve(runsRef.current);
    realCurve
      .then((c) => { if (alive) setCurve(c); })
      .finally(() => { if (alive) setSettled(true); });
    return () => { alive = false; };
  }, [enabled, hasRuns]);

  return { curve, loading: enabled && hasRuns && !settled };
}

/** Models with a live `running` run — the trains on the rails. */
export function useLiveTraining(runs: RunSummary[]): string[] {
  const key = runs.filter((r) => r.status === "running").map((r) => r.model).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => liveTrainingModels(runs), [key]);
}
