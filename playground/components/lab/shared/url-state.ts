"use client";

// URL-driven lab view: ?zoom=overview|region|node&focus=<model>&still=1.
// Screenshots (scripts/shoot.mjs) and shared links reproduce a view exactly.
// Read from window.location in an effect — static export has no server to
// resolve search params at build time.
import { useCallback, useEffect, useState } from "react";

export type Zoom = "overview" | "region" | "node";
export interface LabView { zoom: Zoom; focus: string | null; still: boolean }

const ZOOMS: Zoom[] = ["overview", "region", "node"];

export function parseLabView(search: string): LabView {
  const p = new URLSearchParams(search);
  const z = p.get("zoom") as Zoom | null;
  return {
    zoom: z && ZOOMS.includes(z) ? z : "overview",
    focus: p.get("focus"),
    still: p.get("still") === "1",
  };
}

export function useLabView() {
  const [view, setView] = useState<LabView | null>(null);

  useEffect(() => {
    const sync = () => setView(parseLabView(window.location.search));
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  // The URL is the source of truth: write it first (replaceState keeps links
  // shareable without growing history), then set state from it. Never touch
  // history inside a state updater — Next's router warns "Cannot update
  // Router while rendering".
  const update = useCallback((next: Partial<Omit<LabView, "still">>) => {
    const merged = { ...parseLabView(window.location.search), ...next };
    const p = new URLSearchParams(window.location.search);
    p.set("zoom", merged.zoom);
    if (merged.focus) p.set("focus", merged.focus); else p.delete("focus");
    window.history.replaceState(null, "", `${window.location.pathname}?${p}`);
    setView(merged);
  }, []);

  return { view, update };
}
