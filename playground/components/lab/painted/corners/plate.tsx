"use client";

// The map's furniture primitives, one per material. A Plate is a sheet of the
// map's own paper: on the pixel map a parchment rectangle with a 1-art-px
// maroon border (the --ap variable set by the skin), a cream inner bevel and a
// hard dark shadow — the same construction as the map's ribbons; on the paper
// map a tan label with a dark rule and a thin inner rule, like the painter's.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { displayName } from "@/components/lab/shared/card-model";
import { sign, TYPE, type Material } from "../material";

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
  if (m.card) {
    // paper: a cut sheet of cardstock — printed laid texture, a pressed inner
    // rule one hairline in from the edge, and a hard unblurred offset drop
    const base = loud ? m.loud : m.plateHi;
    return {
      background: loud ? base : `${m.card.grain}, ${base}`,
      color: loud ? m.loudInk : m.ink,
      border: `2px solid ${m.border}`,
      borderRadius: m.radius,
      boxShadow: [
        `inset 0 0 0 3px ${loud ? base : m.card.inset}`,
        `inset 0 0 0 4px ${loud ? m.loudInk : m.rule}`,
        shadow ? m.card.drop : "",
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

// The four corners share one system (material.ts CORNER): the same outer
// margin, the same inner padding, and one column width for the two side
// plates (cartouche top-left, legend / minimap bottom-right). The scale bar
// takes the width of its cells and stands on the bottom margin with the
// legend, so the two bottom plates share their bottom edge; the compass
// stands on the scale bar.
/** a plate's title in the map's sign voice: the one title treatment every
 * corner plate shares (the cartouche's is the large one) */
export function plateTitle(m: Material, size: number = TYPE.plateTitle): CSSProperties {
  return { fontFamily: m.signFont, fontWeight: 700, fontSize: sign(m, size), lineHeight: 1, color: m.crisp ? m.border : m.ink };
}

/** A large sheet's ground (drawer, sheet, full diagram): the cardstock print on paper, flat elsewhere. */
export const sheetGround = (m: Material) => (m.card ? `${m.card.sheet}, ${m.plateHi}` : m.plateHi);

export function Plate({ m, children, className = "", style, label, as: Tag = "section" }: {
  m: Material; children: ReactNode; className?: string; style?: CSSProperties; label?: string; as?: "section" | "div" | "nav" | "header" | "aside";
}) {
  return (
    <Tag aria-label={label} className={className} style={{ ...plateStyle(m), fontFamily: m.bodyFont, ...style }}>
      {children}
    </Tag>
  );
}

/** A control that cannot act right now (zoomed all the way out, say): sunk
 * flat into the page — no lift, the plate's own parchment, rim and glyph in
 * the soft ink. Still legible at a glance (half ink, not a ghost), clearly off. */
export function disabledStyle(m: Material): CSSProperties {
  return {
    background: m.plate,
    color: m.inkSoft,
    border: m.crisp ? `var(--ap) solid ${m.inkSoft}` : `2px solid ${m.inkSoft}`,
    borderRadius: m.crisp ? undefined : m.radius,
    boxShadow: m.crisp ? `inset var(--ap) var(--ap) 0 ${m.rule}` : "none",
  };
}

export function Btn({ m, children, onClick, disabled, pressed, label, className = "", title, style }: {
  m: Material; children: ReactNode; onClick: () => void; disabled?: boolean; pressed?: boolean; label?: string; className?: string; title?: string; style?: CSSProperties;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={pressed} aria-label={label} title={title}
      className={`inline-flex items-center justify-center px-2 leading-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default ${className}`}
      style={{
        ...(disabled ? disabledStyle(m) : plateStyle(m, { loud: pressed, shadow: !pressed })),
        fontFamily: m.bodyFont, fontSize: TYPE.lead, minHeight: 28,
        transform: pressed ? "translate(var(--ap, 1px), var(--ap, 1px))" : undefined,
        ...style,
      }}>
      {children}
    </button>
  );
}

/** A magnifier drawn on a 7-unit grid (crisp on the pixel map), in the plate's ink. */
export function MagnifierIcon({ m, size = 14 }: { m: Material; size?: number }) {
  const ink = m.crisp ? m.border : m.ink;
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 7 7" shapeRendering={m.crisp ? "crispEdges" : undefined} style={{ display: "block" }}>
      {m.crisp ? (
        <g fill={ink}>
          <rect x="1" y="0" width="3" height="1" /><rect x="0" y="1" width="1" height="3" /><rect x="4" y="1" width="1" height="3" />
          <rect x="1" y="4" width="3" height="1" /><rect x="4" y="4" width="1" height="1" /><rect x="5" y="5" width="1" height="1" /><rect x="6" y="6" width="1" height="1" />
        </g>
      ) : (
        <g fill="none" stroke={ink} strokeWidth={0.9} strokeLinecap="round"><circle cx="2.8" cy="2.8" r="2.1" /><path d="M4.4 4.4 6.4 6.4" /></g>
      )}
    </svg>
  );
}

/** Find a model: the cartouche's bottom row. "/" focuses it from anywhere.
 * collapsed (focus mode): a magnifier button until it is pressed (or "/"), then
 * the field unfolds in place and folds back when it is left empty. */
export function Search({ m, names, onPick, compact = false, collapsed = false, onFold, width }: {
  m: Material; names: string[]; onPick: (n: string) => void; compact?: boolean; collapsed?: boolean;
  /** collapsed: told when the field unfolds (true) and folds back (false), so a tight bar can make room */
  onFold?: (open: boolean) => void;
  /** collapsed: the unfolded field's width (default 150 compact / 196) */
  width?: number;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [unfolded, setUnfolded] = useState(false);
  const ref = useRef<HTMLInputElement | null>(null);
  const folded = collapsed && !unfolded && !q;
  useEffect(() => { if (collapsed) onFold?.(!folded); }, [collapsed, folded, onFold]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") { e.preventDefault(); setUnfolded(true); requestAnimationFrame(() => ref.current?.focus()); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/\s+/g, "_");
    if (!s) return [];
    return names.filter((n) => n.includes(s)).sort((a, b) => a.indexOf(s) - b.indexOf(s) || a.length - b.length).slice(0, 7);
  }, [q, names]);
  const pick = (n: string) => { onPick(n); setQ(""); setOpen(false); setUnfolded(false); ref.current?.blur(); };
  if (folded) {
    return (
      <button type="button" onClick={() => { setUnfolded(true); requestAnimationFrame(() => ref.current?.focus()); }}
        aria-label="Find a model (/)" title="Find a model (/)"
        className="inline-flex flex-none items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ width: 28, height: 28, background: m.field, border: `var(--ap, 2px) solid ${m.border}`, borderRadius: m.radius,
          boxShadow: m.crisp ? `inset var(--ap) var(--ap) 0 ${m.rule}` : `inset 0 1px 2px ${m.shadow}` }}>
        <MagnifierIcon m={m} />
      </button>
    );
  }
  return (
    <div className="relative" style={collapsed ? { width: width ?? (compact ? 150 : 196) } : undefined}>
      <label className="sr-only" htmlFor="painted-search">Find a model</label>
      <input id="painted-search" ref={ref} value={q} placeholder={compact || collapsed ? "Find a model" : "Find a model, press /"} autoComplete="off"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => { setOpen(false); setUnfolded(false); }, 150)}
        onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) pick(hits[0]); if (e.key === "Escape") { setQ(""); ref.current?.blur(); } }}
        className={`w-full ${collapsed ? "px-2 py-0.5" : "px-2.5 py-1.5"} outline-none focus-visible:ring-2`}
        style={{ background: m.field, color: m.ink, fontFamily: m.bodyFont, fontSize: collapsed ? TYPE.body : TYPE.lead,
          border: `var(--ap, 2px) solid ${m.border}`, borderRadius: m.radius,
          boxShadow: m.crisp ? `inset var(--ap) var(--ap) 0 ${m.rule}` : `inset 0 1px 2px ${m.shadow}` }} />
      {open && hits.length > 0 && (
        <ul role="listbox" className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden" style={plateStyle(m)}>
          {hits.map((n) => (
            <li key={n}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(n)}
                className="block w-full px-2.5 py-1 text-left hover:brightness-95" style={{ color: m.ink, fontFamily: m.bodyFont, fontSize: TYPE.lead }}>
                {displayName(n)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
