"use client";

// ONE interface for the painted map: a left sidebar on desktop (~300 px; the
// map fills the rest edge to edge) and a bottom sheet with a drag handle on
// phones. Top to bottom: title cartouche + search · minimap + zoom · the six
// lands (expand → models) · legend · map settings. Selecting a model SWAPS
// the sidebar to that model's card ("← All lands" returns). Pixel skin: the
// panel is cut from the map's own palette, Pixelify Sans, borders one art
// pixel thick at the current scale (the --ap CSS variable set by the skin).
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CamBox } from "@/components/lab/shared/camera";
import { displayName, type CardModel, type EvidenceState } from "@/components/lab/shared/card-model";
import { FAMILIES, type Family, type MapId } from "./anchors";
import { CardBody } from "./card";
import { EvidenceIcon, Swatch } from "./pixel-icon";
import { FAMILY_TITLE, type PaintedTheme } from "./theme";

export type Render = "true" | "clean" | "grid" | "baked";
export type Labels = "ours" | "baked";
export type Sheet = "peek" | "half" | "full";

export interface SidebarProps {
  theme: PaintedTheme;
  mobile: boolean;
  sheet: Sheet;
  setSheet: (s: Sheet) => void;
  // settings
  mapId: MapId;
  render: Render;
  labels: Labels;
  setOpts: (next: Partial<{ map: MapId; render: Render; labels: Labels }>) => void;
  online: boolean;
  // data
  counts: { models: number; pipelines: number; champions: number; lands: number };
  names: string[];
  family: Record<string, string> | null;
  atoms: Set<string>;
  states: Record<string, EvidenceState>;
  famCount: Record<string, number>;
  swatch: Partial<Record<Family, string>>;
  // navigation
  world: { w: number; h: number };
  box: CamBox;
  minimap: { canvas: HTMLCanvasElement | null; version: number } | { img: string; pixelated: boolean };
  canIn: boolean;
  canOut: boolean;
  onZoom: (dir: 1 | -1) => void;
  onFit: () => void;
  onCenter: (x: number, y: number) => void;
  // lands
  focusFam: Family | null;
  mapHoverFam: Family | null;
  onHoverLand: (f: Family | null) => void;
  onLand: (f: Family) => void;
  // selection
  card: CardModel | null;
  onPick: (n: string) => void;
  onBack: () => void;
  still: boolean;
}

// ——— pieces

function Panel({ theme, children, className = "", label }: { theme: PaintedTheme; children: ReactNode; className?: string; label?: string }) {
  const pixel = theme.crisp;
  return (
    <section aria-label={label} className={`p-3 ${className}`}
      style={pixel ? {
        background: theme.plateHi,
        border: `var(--ap) solid ${theme.border}`,
        // a subtle inset bevel: shade top-left inside, light bottom-right
        boxShadow: `inset var(--ap) var(--ap) 0 #e9deb0, inset calc(var(--ap) * -1) calc(var(--ap) * -1) 0 #fffedb, var(--ap) var(--ap) 0 #221316`,
      } : { background: theme.plateHi, border: `1.5px solid ${theme.border}`, borderRadius: 6 }}>
      {children}
    </section>
  );
}

function Btn({ theme, children, onClick, disabled, pressed, label, className = "", title }: {
  theme: PaintedTheme; children: ReactNode; onClick: () => void; disabled?: boolean; pressed?: boolean; label?: string; className?: string; title?: string;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={pressed} aria-label={label} title={title}
      className={`px-2 py-0.5 text-[14px] leading-6 focus-visible:outline-2 disabled:opacity-40 ${className}`}
      style={{
        background: pressed ? theme.loud : theme.plate, color: pressed ? theme.loudInk : theme.ink,
        border: `var(--ap, 2px) solid ${theme.border}`, borderRadius: theme.radius,
        boxShadow: theme.crisp && !pressed ? "inset var(--ap) var(--ap) 0 #fdf4c1" : undefined,
      }}>
      {children}
    </button>
  );
}

function Search({ theme, names, onPick, autoFocusKey }: { theme: PaintedTheme; names: string[]; onPick: (n: string) => void; autoFocusKey: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!autoFocusKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") { e.preventDefault(); ref.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [autoFocusKey]);
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/\s+/g, "_");
    if (!s) return [];
    return names.filter((n) => n.includes(s)).sort((a, b) => a.indexOf(s) - b.indexOf(s) || a.length - b.length).slice(0, 7);
  }, [q, names]);
  const pick = (n: string) => { onPick(n); setQ(""); setOpen(false); ref.current?.blur(); };
  return (
    <div className="relative mt-2.5">
      <label className="sr-only" htmlFor="painted-search">Find a model</label>
      <input id="painted-search" ref={ref} value={q} placeholder="Find a model (press /)" autoComplete="off"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) pick(hits[0]); if (e.key === "Escape") { setQ(""); ref.current?.blur(); } }}
        className="w-full px-2.5 py-1.5 text-[15px] outline-none focus-visible:ring-2"
        style={{ background: theme.crisp ? "#fffedb" : theme.plate, color: theme.ink, fontFamily: theme.bodyFont,
          border: `var(--ap, 2px) solid ${theme.border}`, borderRadius: theme.radius,
          boxShadow: theme.crisp ? "inset var(--ap) var(--ap) 0 #e9deb0" : undefined }} />
      {open && hits.length > 0 && (
        <ul role="listbox" className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden"
          style={{ background: theme.plateHi, border: `var(--ap, 2px) solid ${theme.border}`, borderRadius: theme.radius, boxShadow: "var(--ap) var(--ap) 0 #221316" }}>
          {hits.map((n) => (
            <li key={n}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(n)}
                className="block w-full px-2.5 py-1 text-left text-[15px] hover:brightness-95" style={{ color: theme.ink, background: theme.plateHi }}>
                {displayName(n)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Minimap({ theme, world, box, source, onCenter }: {
  theme: PaintedTheme; world: { w: number; h: number }; box: CamBox; source: SidebarProps["minimap"]; onCenter: (x: number, y: number) => void;
}) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const cv = useRef<HTMLCanvasElement | null>(null);
  const dragging = useRef(false);
  const [mw, setMw] = useState(256);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setMw(Math.max(120, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const k = mw / world.w;
  const mh = Math.round(world.h * k);
  const srcCanvas = "canvas" in source ? source.canvas : null;
  const version = "canvas" in source ? source.version : 0;
  useEffect(() => {
    const ctx = cv.current?.getContext("2d");
    if (!ctx || !srcCanvas) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, mw, mh);
    ctx.drawImage(srcCanvas, 0, 0, mw, mh);
  }, [srcCanvas, version, mw, mh]);
  const centerAt = (cx: number, cy: number) => {
    const r = wrap.current?.getBoundingClientRect();
    if (r) onCenter((cx - r.left) / k, (cy - r.top) / k);
  };
  const vx = Math.max(0, box.x), vy = Math.max(0, box.y);
  const vw = Math.min(world.w, box.x + box.w) - vx, vh = Math.min(world.h, box.y + box.h) - vy;
  const whole = box.w >= world.w - 1 && box.h >= world.h - 1;
  return (
    <div ref={wrap} role="slider" tabIndex={-1} aria-label="Minimap: click or drag to move the view"
      aria-valuetext={whole ? "whole map in view" : "part of the map in view"}
      className="relative cursor-pointer select-none overflow-hidden"
      style={{ height: mh, border: `var(--ap, 2px) solid ${theme.border}`, boxSizing: "content-box", background: theme.sea }}
      onPointerDown={(e) => { dragging.current = true; (e.currentTarget as Element).setPointerCapture(e.pointerId); centerAt(e.clientX, e.clientY); }}
      onPointerMove={(e) => { if (dragging.current) centerAt(e.clientX, e.clientY); }}
      onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }}>
      {"canvas" in source
        ? <canvas ref={cv} width={mw} height={mh} className="block" style={{ width: mw, height: mh }} aria-hidden />
        // eslint-disable-next-line @next/next/no-img-element -- local owner-supplied painting, tiny preview
        : <img src={source.img} alt="" draggable={false} className="block" style={{ width: mw, height: mh, imageRendering: source.pixelated ? "pixelated" : "auto" }} />}
      {!whole && (
        <div className="pointer-events-none absolute"
          style={{ left: vx * k, top: vy * k, width: vw * k, height: vh * k, outline: `2px solid ${theme.crisp ? "#fdc771" : theme.loud}`, boxShadow: "0 0 0 999px rgba(34,19,22,.35)" }} />
      )}
    </div>
  );
}

const LEGEND: { s: EvidenceState; t: string }[] = [
  { s: "champion", t: "champion" },
  { s: "trained", t: "trained" },
  { s: "provisional", t: "new bar" },
  { s: "untrained", t: "untrained" },
];

function Lands(p: SidebarProps) {
  const { theme } = p;
  const [open, setOpen] = useState<Family | null>(null);
  useEffect(() => { if (p.focusFam) setOpen(p.focusFam); }, [p.focusFam]);
  return (
    <ul className="space-y-1">
      {FAMILIES.map((f) => {
        const models = p.names.filter((n) => p.family?.[n] === f)
          .sort((a, b) => Number(p.atoms.has(b)) - Number(p.atoms.has(a)) || a.localeCompare(b));
        const lit = p.focusFam === f || p.mapHoverFam === f;
        const expanded = open === f;
        return (
          <li key={f}>
            <button type="button" aria-expanded={expanded}
              onClick={() => { setOpen(expanded ? null : f); p.onLand(f); }}
              onPointerEnter={() => p.onHoverLand(f)} onPointerLeave={() => p.onHoverLand(null)}
              onFocus={() => p.onHoverLand(f)} onBlur={() => p.onHoverLand(null)}
              className="flex w-full items-center gap-2 px-1.5 py-1 text-left text-[15px] focus-visible:outline-2"
              style={{
                color: lit ? theme.loudInk : theme.ink, background: lit ? theme.loud : "transparent",
                border: `var(--ap, 2px) solid ${lit ? theme.border : "transparent"}`,
              }}>
              <Swatch color={p.swatch[f] ?? "#888"} border={theme.crisp ? "#221316" : theme.border} />
              <span className="flex-1">{FAMILY_TITLE[f]}</span>
              <span className="text-[13px] tabular-nums" style={{ color: lit ? theme.loudInk : theme.inkSoft }}>
                {p.famCount[f] ?? 0} model{(p.famCount[f] ?? 0) === 1 ? "" : "s"}
              </span>
              <span aria-hidden className="w-3 text-center">{expanded ? "▾" : "▸"}</span>
            </button>
            {expanded && (
              <ul className="mb-1 ml-3 mt-0.5 space-y-0.5 pl-2" style={{ borderLeft: `var(--ap, 2px) dotted ${theme.border}` }}>
                {models.map((n) => (
                  <li key={n}>
                    <button type="button" onClick={() => p.onPick(n)}
                      className="flex w-full items-center gap-2 px-1 py-0.5 text-left text-[14px] hover:brightness-95 focus-visible:outline-2"
                      style={{ color: theme.ink }}>
                      {theme.crisp
                        ? <span className="flex w-7 justify-center"><EvidenceIcon state={p.states[n] ?? "untrained"} atom={p.atoms.has(n)} scale={p.atoms.has(n) ? 1 : 2} /></span>
                        : <span aria-hidden className="inline-block h-3 w-3 rounded-full" style={{ background: theme.evidence[p.states[n] ?? "untrained"].fill, border: `1.5px solid ${theme.evidence[p.states[n] ?? "untrained"].stroke}` }} />}
                      <span>{displayName(n)}</span>
                      {p.atoms.has(n) && <span className="ml-auto text-[11px] uppercase" style={{ color: theme.inkSoft }}>atom</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Settings({ theme, mapId, render, labels, setOpts }: Pick<SidebarProps, "theme" | "mapId" | "render" | "labels" | "setOpts">) {
  const Row = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      <span className="w-14 text-[12px] uppercase tracking-wider" style={{ color: theme.inkSoft }}>{label}</span>
      {children}
    </div>
  );
  return (
    <details className="text-[14px]" style={{ color: theme.ink }}>
      <summary className="cursor-pointer select-none text-[13px] uppercase tracking-wider" style={{ color: theme.inkSoft }}>Map settings</summary>
      <Row label="Map">
        <Btn theme={theme} pressed={mapId === "pixel"} onClick={() => setOpts({ map: "pixel" })}>Pixel</Btn>
        <Btn theme={theme} pressed={mapId === "paper"} onClick={() => setOpts({ map: "paper" })}>Paper</Btn>
      </Row>
      {mapId === "pixel" && (
        <Row label="Image">
          {(["true", "clean", "grid", "baked"] as const).map((r) => (
            <Btn key={r} theme={theme} pressed={render === r} onClick={() => setOpts({ render: r, labels: r === "baked" ? "baked" : "ours" })}>
              {r === "true" ? "True pixels" : r[0].toUpperCase() + r.slice(1)}
            </Btn>
          ))}
        </Row>
      )}
      <Row label="Labels">
        <Btn theme={theme} pressed={labels === "ours"} onClick={() => setOpts({ labels: "ours" })}>Ours</Btn>
        <Btn theme={theme} pressed={labels === "baked"} onClick={() => setOpts({ labels: "baked" })}>Baked</Btn>
      </Row>
      <p className="mt-2 text-[12px]" style={{ color: theme.inkSoft }}>
        Drag the map to move. Wheel or + and − to zoom, 0 for the whole map, arrows to pan. <a href="/lab/" className="underline">All skins</a>
      </p>
    </details>
  );
}

// ——— the sidebar / sheet

export function Sidebar(p: SidebarProps) {
  const { theme } = p;
  const sentence = `${p.counts.models} models across ${p.counts.lands === 6 ? "six" : p.counts.lands} lands, with ${p.counts.pipelines} pipelines and ${p.counts.champions} champions.`;

  const body = p.card ? (
    <div className="space-y-3">
      <Btn theme={theme} onClick={p.onBack} className="w-full text-left">← All lands</Btn>
      <Panel theme={theme} label="Model card">
        <CardBody card={p.card} theme={theme} still={p.still} onPick={p.onPick}
          stateOf={(n) => p.states[n] ?? "untrained"} isAtom={(n) => p.atoms.has(n)} />
      </Panel>
    </div>
  ) : (
    <div className="space-y-3">
      <Panel theme={theme} label="Map">
        <Minimap theme={theme} world={p.world} box={p.box} source={p.minimap} onCenter={p.onCenter} />
        <div className="mt-2 flex items-center gap-1.5">
          <Btn theme={theme} onClick={() => p.onZoom(-1)} disabled={!p.canOut} label="Zoom out" title="Zoom out (−)" className="w-9">−</Btn>
          <Btn theme={theme} onClick={() => p.onZoom(1)} disabled={!p.canIn} label="Zoom in" title="Zoom in (+)" className="w-9">+</Btn>
          <Btn theme={theme} onClick={p.onFit} title="Whole map (0)" className="flex-1">Whole map</Btn>
        </div>
      </Panel>
      <Panel theme={theme} label="Lands">
        <h2 className="mb-1.5 text-[13px] uppercase tracking-wider" style={{ color: theme.inkSoft }}>Lands</h2>
        <Lands {...p} />
      </Panel>
      <Panel theme={theme} label="Legend">
        <h2 className="mb-1.5 text-[13px] uppercase tracking-wider" style={{ color: theme.inkSoft }}>Legend</h2>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[13px]" style={{ color: theme.ink }}>
          {LEGEND.map(({ s, t }) => (
            <span key={s} className="flex items-center gap-1.5">
              {theme.crisp
                ? <><EvidenceIcon state={s} atom scale={1} /><EvidenceIcon state={s} atom={false} scale={2} /></>
                : <span aria-hidden className="inline-block h-3 w-3 rounded-full" style={{ background: theme.evidence[s].fill, border: `1.5px solid ${theme.evidence[s].stroke}` }} />}
              {t}
            </span>
          ))}
        </div>
        {theme.crisp && <p className="mt-2 text-[12px]" style={{ color: theme.inkSoft }}>Banners fly over atoms; derived models are the stones on the roads.</p>}
        <div className="mt-3"><Settings {...p} /></div>
        {!p.online && <p className="mt-2 text-[12px]" style={{ color: theme.inkSoft }}>Waiting for the API…</p>}
      </Panel>
    </div>
  );

  const header = (
    <Panel theme={theme} label="The Model Zoo">
      <h1 className="text-[26px] leading-none" style={{ fontFamily: theme.signFont, fontWeight: 700, color: theme.crisp ? theme.border : theme.ink }}>The Model Zoo</h1>
      <p className="mt-1.5 text-[14px] leading-snug" style={{ color: theme.ink }}>{sentence}</p>
      <Search theme={theme} names={p.names} onPick={p.onPick} autoFocusKey />
    </Panel>
  );

  if (!p.mobile) {
    return (
      <aside aria-label="Model zoo sidebar" className="relative z-20 flex h-full w-[300px] flex-none flex-col overflow-y-auto p-3"
        style={{ background: theme.sea, borderRight: `var(--ap, 2px) solid ${theme.border}`, boxShadow: theme.crisp ? "var(--ap) 0 0 #221316" : undefined, fontFamily: theme.bodyFont }}>
        {header}
        <div className="mt-3">{body}</div>
      </aside>
    );
  }
  return <SheetShell {...p} header={header} body={body} />;
}

const SNAP: Record<Sheet, number> = { peek: 0.2, half: 0.5, full: 0.88 };

export function sheetHeight(s: Sheet, vh: number): number {
  return Math.round(Math.max(150, vh * SNAP[s]));
}

function SheetShell(p: SidebarProps & { header: ReactNode; body: ReactNode }) {
  const { theme } = p;
  const [vh, setVh] = useState(800);
  useEffect(() => {
    const on = () => setVh(window.innerHeight);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ y: number; h: number } | null>(null);
  const h = drag ?? sheetHeight(p.sheet, vh);
  const release = () => {
    if (drag == null) return;
    const frac = drag / vh;
    const best = (Object.keys(SNAP) as Sheet[]).reduce((a, b) => (Math.abs(SNAP[b] - frac) < Math.abs(SNAP[a] - frac) ? b : a));
    p.setSheet(best);
    setDrag(null);
    start.current = null;
  };
  return (
    <aside aria-label="Model zoo panel" className="absolute inset-x-0 bottom-0 z-20 flex flex-col"
      style={{ height: h, background: theme.sea, borderTop: `var(--ap, 2px) solid ${theme.border}`, boxShadow: "0 calc(var(--ap) * -1) 0 #221316", fontFamily: theme.bodyFont,
        transition: drag == null && !p.still ? "height 220ms ease" : "none" }}>
      <button type="button" aria-label={p.sheet === "full" ? "Collapse the panel" : "Expand the panel"}
        className="flex h-6 w-full flex-none touch-none items-center justify-center"
        onClick={() => p.setSheet(p.sheet === "peek" ? "half" : p.sheet === "half" ? "full" : "peek")}
        onPointerDown={(e) => { start.current = { y: e.clientY, h }; (e.currentTarget as Element).setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (start.current) setDrag(Math.max(120, Math.min(vh * 0.92, start.current.h + start.current.y - e.clientY))); }}
        onPointerUp={release} onPointerCancel={release}>
        <span aria-hidden className="block h-1.5 w-12" style={{ background: theme.border }} />
      </button>
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {p.card ? null : p.header}
        <div className={p.card ? "" : "mt-3"}>{p.body}</div>
      </div>
    </aside>
  );
}
