"use client";

// Local shim for the shared useLabView().update (see .lab-shots/pixel/
// shared-requests.md): the shared version calls history.replaceState inside a
// React state updater, which Next's router turns into "Cannot update Router
// while rendering PixelWorld". Here the URL is written from the event handler
// and useLabView re-reads it through its own popstate listener.
import { useCallback } from "react";
import { parseLabView, type LabView } from "@/components/lab/shared/url-state";

export function useLabUpdate() {
  return useCallback((next: Partial<Omit<LabView, "still">>) => {
    const merged = { ...parseLabView(window.location.search), ...next };
    const p = new URLSearchParams(window.location.search);
    p.set("zoom", merged.zoom);
    if (merged.focus) p.set("focus", merged.focus); else p.delete("focus");
    window.history.replaceState(null, "", `${window.location.pathname}?${p}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, []);
}
