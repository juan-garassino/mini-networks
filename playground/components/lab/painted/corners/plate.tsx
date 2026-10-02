"use client";

// The map's furniture primitives, one per material. A Plate is a sheet of the
// map's own paper: on the pixel map a parchment rectangle with a 1-art-px
// maroon border (the --ap variable set by the skin), a cream inner bevel and a
// hard dark shadow — the same construction as the map's ribbons; on the paper
// map a tan label with a dark rule and a thin inner rule, like the painter's.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { displayName } from "@/components/lab/shared/card-model";
import type { Material } from "../material";

export function plateStyle(m: Material, opts: { loud?: boolean; shadow?: boolean } = {}): CSSProperties {
  const { loud = false, shadow = true } = opts;
  if (m.crisp) {
    return {
      background: loud ? m.loud : m.plateHi,
      color: loud ? m.loudInk : m.ink,
      border: `var(--ap) solid ${m.border}`,
      boxShadow: [
        loud ? `inset var(--ap) var(--ap) 0 ${m.border}` : `inset var(--ap) var(--ap) 0 ${m.rule}`,
        shadow ? `var(--ap) var(--ap) 0 ${m.shadow}` : "",
      ].filter(Boolean).join(", "),
    };
  }
  return {
    background: loud ? m.loud : m.plateHi,
    color: loud ? m.loudInk : m.ink,
    border: `2px solid ${m.border}`,
    borderRadius: m.radius,
    boxShadow: [`inset 0 0 0 3px ${m.plateHi}`, `inset 0 0 0 4px ${m.rule}`, shadow ? `2px 3px 0 ${m.shadow}` : ""].filter(Boolean).join(", "),
  };
}

export function Plate({ m, children, className = "", style, label, as: Tag = "section" }: {
  m: Material; children: ReactNode; className?: string; style?: CSSProperties; label?: string; as?: "section" | "div" | "nav" | "header" | "aside";
}) {
  return (
    <Tag aria-label={label} className={className} style={{ ...plateStyle(m), fontFamily: m.bodyFont, ...style }}>
      {children}
    </Tag>
  );
}

export function Btn({ m, children, onClick, disabled, pressed, label, className = "", title, style }: {
  m: Material; children: ReactNode; onClick: () => void; disabled?: boolean; pressed?: boolean; label?: string; className?: string; title?: string; style?: CSSProperties;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={pressed} aria-label={label} title={title}
      className={`inline-flex items-center justify-center px-2 leading-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40 ${className}`}
      style={{
        ...plateStyle(m, { loud: pressed, shadow: !pressed }),
        fontFamily: m.bodyFont, fontSize: 16, minHeight: 28,
        transform: pressed ? "translate(var(--ap, 1px), var(--ap, 1px))" : undefined,
        ...style,
      }}>
      {children}
    </button>
  );
}

/** Find a model: the cartouche's bottom row. "/" focuses it from anywhere. */
export function Search({ m, names, onPick, compact = false }: { m: Material; names: string[]; onPick: (n: string) => void; compact?: boolean }) {
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
    <div className="relative">
      <label className="sr-only" htmlFor="painted-search">Find a model</label>
      <input id="painted-search" ref={ref} value={q} placeholder={compact ? "Find a model" : "Find a model, press /"} autoComplete="off"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) pick(hits[0]); if (e.key === "Escape") { setQ(""); ref.current?.blur(); } }}
        className="w-full px-2.5 py-1.5 outline-none focus-visible:ring-2"
        style={{ background: m.field, color: m.ink, fontFamily: m.bodyFont, fontSize: 16,
          border: `var(--ap, 2px) solid ${m.border}`, borderRadius: m.radius,
          boxShadow: m.crisp ? `inset var(--ap) var(--ap) 0 ${m.rule}` : `inset 0 1px 2px ${m.shadow}` }} />
      {open && hits.length > 0 && (
        <ul role="listbox" className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden" style={plateStyle(m)}>
          {hits.map((n) => (
            <li key={n}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(n)}
                className="block w-full px-2.5 py-1 text-left hover:brightness-95" style={{ color: m.ink, fontFamily: m.bodyFont, fontSize: 16 }}>
                {displayName(n)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
