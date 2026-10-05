"use client";
// Page-level reads the map needs: URL flags (?still=1, ?specimen=1) and the OS
// reduced-motion setting (external stores, so SSR renders the still map), and
// the page title while the edition is on screen.
import { useEffect, useSyncExternalStore } from "react";

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

/** Name the page while `title` is set (the transit edition shares "/" with the
 * other editions, so its title cannot be route metadata). Next writes the
 * route's <title> after hydration, so a one-off assignment is overwritten: an
 * observer on <head> re-asserts it until the edition changes, then the
 * previous title comes back. */
export function usePageTitle(title: string | null) {
  useEffect(() => {
    if (!title) return;
    const prev = document.title;
    const apply = () => { if (document.title !== title) document.title = title; };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => { mo.disconnect(); document.title = prev; };
  }, [title]);
}
