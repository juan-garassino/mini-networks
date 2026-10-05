"use client";
// Page-level reads the map needs: URL flags (?still=1, ?specimen=1) and the OS
// reduced-motion setting. Both are external stores, so SSR renders the still map.
import { useSyncExternalStore } from "react";

const noop = () => () => {};

export function useQueryFlag(name: string) {
  return useSyncExternalStore(noop, () => new URLSearchParams(window.location.search).get(name) === "1", () => false);
}

export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
}
