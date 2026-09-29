"use client";

// Fixed chrome: the map/image/labels toggle + evidence legend (bottom-left)
// and a real model search (top-right; "/" focuses it).
import { useEffect, useMemo, useRef, useState } from "react";
import { displayName, type EvidenceState } from "@/components/lab/shared/card-model";
import type { MapId } from "./anchors";
import type { PaintedTheme } from "./theme";

export type Render = "grid" | "clean" | "baked";
export type Labels = "ours" | "baked";

function Seg<T extends string>({ label, value, options, onChange, theme }: {
  label: string; value: T; options: { v: T; t: string }[]; onChange: (v: T) => void; theme: PaintedTheme;
}) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={label}>
      <span className="w-12 text-[12px] uppercase tracking-wider" style={{ color: theme.inkSoft }}>{label}</span>
      {options.map((o) => (
        <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}
          className="px-2 py-0.5 text-[13px] focus-visible:outline-2"
          style={{
            background: value === o.v ? theme.loud : theme.plateHi, color: value === o.v ? theme.loudInk : theme.ink,
            border: `${theme.crisp ? 2 : 1.5}px solid ${theme.border}`, borderRadius: theme.radius,
          }}>
          {o.t}
        </button>
      ))}
    </div>
  );
}

const LEGEND: { s: EvidenceState; t: string }[] = [
  { s: "champion", t: "champion" },
  { s: "trained", t: "trained" },
  { s: "provisional", t: "new bar" },
  { s: "untrained", t: "untrained" },
];

export function Controls({ theme, map, render, labels, set, online }: {
  theme: PaintedTheme; map: MapId; render: Render; labels: Labels; online: boolean;
  set: (next: Partial<{ map: MapId; render: Render; labels: Labels }>) => void;
}) {
  // phones: folded to one button so the map (and the card) keep the screen
  const [open, setOpen] = useState(true);
  useEffect(() => { if (window.innerWidth < 640) setOpen(false); }, []);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-expanded={false}
        className="absolute left-3 top-14 z-10 px-2.5 py-1 text-[13px] sm:bottom-3 sm:top-auto"
        style={{ background: theme.plate, color: theme.ink, fontFamily: theme.bodyFont, border: `${theme.crisp ? 2 : 1.5}px solid ${theme.border}`, borderRadius: theme.radius }}>
        Map options
      </button>
    );
  }
  return (
    <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1.5 p-2.5 text-[13px] max-sm:bottom-auto max-sm:top-14"
      style={{ background: theme.plate, color: theme.ink, fontFamily: theme.bodyFont, border: `${theme.crisp ? 2 : 1.5}px solid ${theme.border}`, borderRadius: theme.crisp ? 0 : 6, boxShadow: theme.crisp ? "3px 3px 0 rgba(59,26,16,.3)" : "0 4px 14px rgba(0,0,0,.2)" }}>
      <Seg label="Map" value={map} theme={theme} onChange={(v) => set({ map: v })} options={[{ v: "pixel", t: "Pixel" }, { v: "paper", t: "Paper" }]} />
      {map === "pixel" && (
        <Seg label="Image" value={render} theme={theme} onChange={(v) => set({ render: v, labels: v === "baked" ? "baked" : "ours" })}
          options={[{ v: "clean", t: "Clean" }, { v: "grid", t: "Grid" }, { v: "baked", t: "Baked" }]} />
      )}
      <Seg label="Labels" value={labels} theme={theme} onChange={(v) => set({ labels: v })} options={[{ v: "ours", t: "Ours" }, { v: "baked", t: "Baked" }]} />
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1" aria-label="Marker legend">
        {LEGEND.map(({ s, t }) => {
          const e = theme.evidence[s];
          return (
            <span key={s} className="inline-flex items-center gap-1 text-[12px]">
              <span aria-hidden className="inline-block h-3 w-3" style={{ background: e.fill, border: `2px ${e.dash ? "dashed" : "solid"} ${e.stroke}`, borderRadius: theme.crisp ? 0 : 99 }} />
              {t}
            </span>
          );
        })}
      </div>
      <div className="flex justify-between gap-3 text-[12px]" style={{ color: theme.inkSoft }}>
        <a href="/lab/" className="underline">All skins</a>
        <button type="button" className="underline sm:hidden" onClick={() => setOpen(false)}>fold</button>
        {!online && <span>waiting for the API…</span>}
      </div>
    </div>
  );
}

export function Search({ theme, names, onPick }: { theme: PaintedTheme; names: string[]; onPick: (n: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") { e.preventDefault(); ref.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/\s+/g, "_");
    if (!s) return [];
    return names.filter((n) => n.includes(s)).sort((a, b) => a.indexOf(s) - b.indexOf(s) || a.length - b.length).slice(0, 7);
  }, [q, names]);
  const pick = (n: string) => { onPick(n); setQ(""); setOpen(false); ref.current?.blur(); };
  return (
    <div className="absolute right-3 top-3 z-30 w-[min(300px,calc(100%-1.5rem))]" style={{ fontFamily: theme.bodyFont }}>
      <label className="sr-only" htmlFor="painted-search">Find a model</label>
      <input id="painted-search" ref={ref} value={q} placeholder="Find a model (press /)" autoComplete="off"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) pick(hits[0]); if (e.key === "Escape") { setQ(""); ref.current?.blur(); } }}
        className="w-full px-3 py-1.5 text-[15px] outline-none focus-visible:ring-2"
        style={{ background: theme.plate, color: theme.ink, border: `${theme.crisp ? 2 : 1.5}px solid ${theme.border}`, borderRadius: theme.radius, boxShadow: theme.crisp ? "3px 3px 0 rgba(59,26,16,.3)" : "0 4px 14px rgba(0,0,0,.2)" }} />
      {open && hits.length > 0 && (
        <ul role="listbox" className="mt-1 overflow-hidden" style={{ background: theme.plate, border: `${theme.crisp ? 2 : 1.5}px solid ${theme.border}`, borderRadius: theme.radius }}>
          {hits.map((n) => (
            <li key={n}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(n)}
                className="block w-full px-3 py-1 text-left text-[15px] hover:brightness-95" style={{ color: theme.ink, background: theme.plate }}>
                {displayName(n)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
