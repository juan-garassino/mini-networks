"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";

// Placeholder skin: proves the /lab contract (URL-driven view + ready flag).
// still=1 must render the final frame with no entry animation — Motion/WAAPI
// fades are flaky under headless virtual time (shots caught at opacity 0).
// Params come from window.location on mount: static export has no request,
// and useSearchParams would need a Suspense boundary to build.
type View = { still: string | null; zoom: string | null; focus: string | null };

const CELLS = Array.from({ length: 48 }, (_, i) => i);

export default function StubPage() {
  const [view, setView] = useState<View | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setView({ still: q.get("still"), zoom: q.get("zoom"), focus: q.get("focus") });
  }, []);

  return (
    <div data-lab-ready={view ? "1" : undefined} className="flex h-full flex-col items-center justify-center gap-6 p-4 font-mono text-[15px]">
      <p className="text-4xl font-bold">stub</p>
      {view && (
        <p className="text-neutral-600">
          zoom={view.zoom ?? "—"} · focus={view.focus ?? "—"} · still={view.still ?? "—"}
        </p>
      )}
      {view && <motion.div
        className="grid w-full max-w-3xl grid-cols-6 gap-2 sm:grid-cols-12"
        initial={view.still === "1" ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {CELLS.map((i) => (
          <div key={i} className="flex aspect-square items-center justify-center rounded text-[13px] text-white"
            style={{ background: `hsl(${(i * 37) % 360} 55% ${35 + (i % 4) * 8}%)` }}>
            {i}
          </div>
        ))}
      </motion.div>}
      <a href="/" className="text-neutral-500 underline">← classic playground</a>
    </div>
  );
}
