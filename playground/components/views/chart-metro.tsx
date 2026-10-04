"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { TaxonomyResponse } from "@/lib/types";
import { symbolFor } from "@/lib/blueprint";
import { LINE_COLORS, LINE_NAMES, METRO_LEGEND, type MetroMark } from "@/components/metro/encoding";
import {
  CARTOUCHE, COLS, DISTRICTS, DISTRICT_PX, G, LABEL_PX, TRACK_W, buildMetro, labelOf, makeFamilyOf, trainPose,
  type MetroLayout, type MetroLine, type MetroStation,
} from "@/components/metro/layout";

// Edition 3: the zoo as ONE transit system (Beck / Vignelli). Families are
// lines; a line calls at its family's models and at every model built on one
// of them, so where families meet you change at an interchange ring. Stations
// and paths are drafted in components/metro/layout.ts (audited: no crossings,
// overlaps or touching labels); every mark is declared in encoding.ts and the
// key renders METRO_LEGEND.
const INK = "var(--ink)";
const PAPER = "var(--paper)";
const FONT = "var(--font-jost), sans-serif";
/** The knot (signature specimen): the blue arm's three interchanges with Perception. */
const SPECIMEN = { x: 4, y: 0.6, w: 42, h: 23 };
/** On a phone the map keeps a legible scale and pans inside its frame. */
const PHONE_MIN_W = 1180;
const TRAIN_SPEED = 46; // px per second
const TRAIN_STILL_T = 0.42; // where a frozen train stands along its path

const noop = () => () => {};
/** Phone: the frame opens on the west side of the knot (vit / sam), not on blank margin. */
const PHONE_START_X = 3 * G;
function openOnTheKnot(el: HTMLDivElement | null) {
  if (el && el.scrollWidth > el.clientWidth + 1 && el.scrollLeft === 0) {
    el.scrollLeft = PHONE_START_X * (el.scrollWidth / (COLS * G));
  }
}
function useQueryFlag(name: string) {
  return useSyncExternalStore(noop, () => new URLSearchParams(window.location.search).get(name) === "1", () => false);
}
function usePrefersReducedMotion() {
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

export function ChartMetro({
  taxonomy, onSelect,
}: {
  taxonomy: TaxonomyResponse | null;
  onSelect: (name: string) => void;
}) {
  const layout = useMemo(() => (taxonomy ? buildMetro(taxonomy) : null), [taxonomy]);
  const familyOf = useMemo(() => (taxonomy ? makeFamilyOf(taxonomy) : null), [taxonomy]);
  const [lit, setLit] = useState<string[] | null>(null);
  const specimen = useQueryFlag("specimen");
  const still = useQueryFlag("still");
  const reduced = usePrefersReducedMotion();
  if (!taxonomy || !layout || !familyOf) return null;
  const live = !still && !reduced;
  const interchanges = layout.stations.filter((s) => s.kind === "interchange").length;

  if (specimen) {
    return (
      <div className="h-full overflow-auto p-4 sm:p-8">
        <MetroMap layout={layout} onSelect={onSelect} lit={null} live={live}
          view={SPECIMEN} interchanges={interchanges} className="w-full" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      <div className="mx-auto max-w-[1480px] px-4 pb-10 pt-3 sm:px-6">
        {/* phone: the cartouche sits in the map's far corner, so the title leads here */}
        <header className="pb-3 md:hidden">
          <h1 className="text-[22px] font-semibold leading-tight text-ink">mini_networks transit</h1>
          <p className="mt-1 text-[13px] leading-snug text-ink-dim">
            {layout.stations.length} stations on {layout.lines.length} lines. Change at a ring. Swipe the map sideways to ride east.
          </p>
        </header>

        <div ref={openOnTheKnot} className="metro-frame -mx-4 overflow-x-auto overflow-y-hidden px-4 md:mx-0 md:overflow-visible md:px-0">
          <MetroMap layout={layout} onSelect={onSelect} lit={lit} live={live} interchanges={interchanges}
            className="metro-map block h-auto w-full md:max-h-[calc(100dvh-112px)]" minWidth={PHONE_MIN_W} />
        </div>

        <PhoneKey layout={layout} />

        {layout.unplaced.length > 0 && (
          <p className="mt-4 text-[13px] text-ink-dim">
            Under construction (not on the drawing yet):{" "}
            {layout.unplaced.map((n) => (
              <button key={n} onClick={() => onSelect(n)} className="mr-2 text-ink underline decoration-line-faint underline-offset-2">{labelOf(n)}</button>
            ))}
          </p>
        )}

        <section className="mt-8">
          <div className="flex items-baseline justify-between gap-4 border-b-2 border-ink pb-2">
            <h2 className="text-[17px] font-semibold text-ink">Through services</h2>
            <span className="text-right text-[12px] text-ink-dim">
              {taxonomy.compositions.length} pipelines that ride several lines. Point at one to light its stops.
            </span>
          </div>
          <div className="grid sm:grid-cols-2 sm:gap-x-10 xl:grid-cols-3">
            {taxonomy.compositions.map((c) => (
              <button key={c.name} onClick={() => onSelect(c.name)}
                onMouseEnter={() => setLit(c.composes)} onMouseLeave={() => setLit(null)}
                onFocus={() => setLit(c.composes)} onBlur={() => setLit(null)}
                className="metro-service grid grid-cols-[1fr_auto] items-center gap-3 border-b border-line-faint py-2 text-left">
                <span className="truncate text-[13px] text-ink">{labelOf(c.name)}</span>
                <span className="flex gap-1">
                  {c.composes.map((n) => <Bullet key={n} name={n} family={familyOf(n)} />)}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MetroMap({
  layout, onSelect, lit, live, view, interchanges, className, minWidth,
}: {
  layout: MetroLayout;
  onSelect: (n: string) => void;
  lit: string[] | null;
  live: boolean;
  view?: { x: number; y: number; w: number; h: number };
  interchanges: number;
  className?: string;
  minWidth?: number;
}) {
  const { width, height, stations, lines, audit } = layout;
  const vb = view ? [view.x * G, view.y * G, view.w * G, view.h * G] : [0, 0, width, height];
  const litSet = lit ? new Set(lit) : null;
  return (
    <svg viewBox={vb.join(" ")} className={className} role="img"
      aria-label={`Transit map: ${stations.length} stations on ${lines.length} lines, ${interchanges} interchanges`}
      style={{ fontFamily: FONT, minWidth }}
      data-crossings={audit.crossings} data-overlaps={audit.overlaps} data-pass-through={audit.passThrough}
      data-label-collisions={audit.labelCollisions} data-off-grid={audit.offGrid}
      data-service-mismatch={audit.serviceMismatch.length} data-stations={stations.length} data-metro-ready="1">
      {DISTRICTS.map((d) => (
        <text key={d.family} x={d.x * G} y={d.y * G} textAnchor={d.anchor} fontSize={DISTRICT_PX}
          fill="var(--ink-dim)" opacity={0.75} letterSpacing="0.02em" className="select-none">
          {LINE_NAMES[d.family]}
        </text>
      ))}

      <g opacity={litSet ? 0.28 : 1} style={{ transition: "opacity 160ms ease" }}>
        {lines.map((l) => l.paths.map((p, i) => (
          <path key={`${l.family}-${i}`} d={p.d} fill="none" stroke={l.color} strokeWidth={TRACK_W}
            strokeLinecap="round" strokeLinejoin="round" />
        )))}
        {lines.map((l) => <Train key={l.family} line={l} live={live} />)}
      </g>

      {stations.map((s) => (
        <StationMark key={s.name} s={s} onSelect={onSelect} dim={!!litSet && !litSet.has(s.name)} />
      ))}

      {!view && <Cartouche layout={layout} interchanges={interchanges} />}
    </svg>
  );
}

function StationMark({ s, onSelect, dim }: { s: MetroStation; onSelect: (n: string) => void; dim: boolean }) {
  const color = LINE_COLORS[s.lines[0]] ?? "#888";
  const weight = s.kind === "tick" ? 400 : 600;
  return (
    <g className="metro-stop cursor-pointer outline-none" tabIndex={0} role="button"
      aria-label={`${s.label}${s.lines.length > 1 ? `, change for ${s.lines.map((f) => LINE_NAMES[f]).join(" and ")}` : ""}`}
      onClick={() => onSelect(s.name)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(s.name); } }}
      opacity={dim ? 0.3 : 1} style={{ transition: "opacity 160ms ease" }}>
      <title>{s.label}{s.parents.length ? `, built on ${s.parents.map(labelOf).join(", ")}` : ", an atom"}</title>
      <rect x={Math.min(s.box.x, s.x - 12) - 3} y={Math.min(s.box.y, s.y - 12) - 3}
        width={Math.max(s.box.x + s.box.w, s.x + 12) - Math.min(s.box.x, s.x - 12) + 6}
        height={Math.max(s.box.y + s.box.h, s.y + 12) - Math.min(s.box.y, s.y - 12) + 6} fill="transparent" />
      <Mark kind={s.kind} x={s.x} y={s.y} color={color} tick={s.tick} terminus={s.terminus} symbol={symbolFor(s.name)} />
      <text x={s.text.x} y={s.text.y} textAnchor={s.text.anchor} fontSize={LABEL_PX} fontWeight={weight} fill={INK}
        className="metro-label">{s.label}</text>
    </g>
  );
}

function Mark({ kind, x, y, color, tick = { x: 0, y: -1 }, terminus = false, symbol = "" }: {
  kind: MetroMark; x: number; y: number; color: string; tick?: { x: number; y: number }; terminus?: boolean; symbol?: string;
}) {
  switch (kind) {
    case "origin":
      return (
        <g>
          <circle cx={x} cy={y} r={10.5} fill={color} stroke={PAPER} strokeWidth={2.5} />
          <text x={x} y={y + 3.6} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff">{symbol}</text>
        </g>
      );
    case "tick":
      return (
        <g>
          {terminus
            ? <line x1={x - tick.x * 8.5} y1={y - tick.y * 8.5} x2={x + tick.x * 8.5} y2={y + tick.y * 8.5} stroke={color} strokeWidth={4.5} strokeLinecap="round" />
            : <line x1={x} y1={y} x2={x + tick.x * 8.5} y2={y + tick.y * 8.5} stroke={color} strokeWidth={4.5} />}
        </g>
      );
    case "terminus":
      return <Mark kind="tick" x={x} y={y} color={color} tick={{ x: 0, y: -1 }} terminus />;
    case "interchange":
      return (
        <g>
          <circle cx={x} cy={y} r={7.5} fill={PAPER} stroke={INK} strokeWidth={2.6} />
        </g>
      );
    case "train":
      return <TrainBody x={x} y={y} angle={0} color={color} />;
  }
}

function TrainBody({ x, y, angle, color }: { x: number; y: number; angle: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <rect x={-9} y={-4.5} width={18} height={9} rx={4.5} fill={PAPER} stroke={color} strokeWidth={2.2} />
      <rect x={2.5} y={-1.6} width={4} height={3.2} rx={1.2} fill={color} />
    </g>
  );
}

/** One train per line, riding its longest path outward from the origin. Live: SMIL along
 * the path, fading at each end; still / reduced motion: parked at a fixed pose. */
function Train({ line, live }: { line: MetroLine; live: boolean }) {
  const path = line.paths[line.trainPath];
  if (!path) return null;
  if (!live) {
    const p = trainPose(path, TRAIN_STILL_T);
    return <g className="metro-train"><TrainBody x={p.x} y={p.y} angle={(p.angle * 180) / Math.PI} color={line.color} /></g>;
  }
  const dur = Math.max(6, path.length / TRAIN_SPEED);
  return (
    <g className="metro-train" opacity={0}>
      <TrainBody x={0} y={0} angle={0} color={line.color} />
      <animateMotion dur={`${dur}s`} repeatCount="indefinite" rotate="auto" path={path.d} />
      <animate attributeName="opacity" dur={`${dur}s`} repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.05;0.93;1" />
    </g>
  );
}

/** The map's own cartouche: title, one sentence, lines with counts, symbols. */
function Cartouche({ layout, interchanges }: { layout: MetroLayout; interchanges: number }) {
  const x0 = CARTOUCHE.x * G, y0 = CARTOUCHE.y * G, w = CARTOUCHE.w * G, h = CARTOUCHE.h * G;
  const pad = 18;
  const colB = x0 + pad + 172;
  return (
    <g className="select-none">
      <rect x={x0} y={y0} width={w} height={h} fill={PAPER} stroke={INK} strokeWidth={1.5} rx={3} />
      <text x={x0 + pad} y={y0 + 32} fontSize={21} fontWeight={600} fill={INK}>mini_networks transit</text>
      <text x={x0 + pad} y={y0 + 54} fontSize={12} fill="var(--ink-dim)">
        {layout.stations.length} stations on {layout.lines.length} lines, {interchanges} interchanges, {layout.audit.crossings} crossings.
      </text>
      <text x={x0 + pad} y={y0 + 70} fontSize={12} fill="var(--ink-dim)">
        A line calls at its family and at every model built on it.
      </text>
      <line x1={x0 + pad} x2={x0 + w - pad} y1={y0 + 84} y2={y0 + 84} stroke="var(--line-faint)" strokeWidth={1} />
      {layout.lines.map((l, i) => {
        const y = y0 + 104 + i * 19;
        return (
          <g key={l.family}>
            <line x1={x0 + pad} x2={x0 + pad + 26} y1={y - 4} y2={y - 4} stroke={l.color} strokeWidth={TRACK_W} strokeLinecap="round" />
            <text x={x0 + pad + 36} y={y} fontSize={12.5} fill={INK}>{LINE_NAMES[l.family]}</text>
            <text x={x0 + pad + 146} y={y} fontSize={12.5} fill="var(--ink-dim)" textAnchor="end" style={{ fontVariantNumeric: "tabular-nums" }}>{l.stations.length}</text>
          </g>
        );
      })}
      {METRO_LEGEND.map(({ mark, label }, i) => {
        const y = y0 + 104 + i * 22;
        return (
          <g key={mark}>
            {mark === "terminus" && <line x1={colB} x2={colB + 15} y1={y - 4} y2={y - 4} stroke="#9a9d9f" strokeWidth={TRACK_W} strokeLinecap="round" />}
            {mark !== "train" && mark !== "origin" && mark !== "terminus" && <line x1={colB} x2={colB + 30} y1={y - 4} y2={y - 4} stroke="#9a9d9f" strokeWidth={TRACK_W} strokeLinecap="round" />}
            {mark === "origin" && <line x1={colB + 15} x2={colB + 30} y1={y - 4} y2={y - 4} stroke="#9a9d9f" strokeWidth={TRACK_W} strokeLinecap="round" />}
            {mark === "train" && <line x1={colB} x2={colB + 30} y1={y - 4} y2={y - 4} stroke="#9a9d9f" strokeWidth={TRACK_W} strokeLinecap="round" />}
            <Mark kind={mark} x={colB + 15} y={y - 4} color="#9a9d9f" symbol="At" tick={{ x: 0, y: -1 }} />
            <text x={colB + 42} y={y} fontSize={12.5} fill={INK}>{label}</text>
          </g>
        );
      })}
    </g>
  );
}

/** Phone only: the key below the map (the in-map cartouche is a long swipe away). */
function PhoneKey({ layout }: { layout: MetroLayout }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] text-ink md:hidden">
      {layout.lines.map((l) => (
        <div key={l.family} className="flex h-[20px] items-center gap-2">
          <span className="h-[6px] w-6 rounded-full" style={{ background: l.color }} />
          <span>{LINE_NAMES[l.family]}</span>
          <span className="ml-auto tabular-nums text-ink-dim">{l.stations.length}</span>
        </div>
      ))}
      <div className="col-span-2 mt-2 grid grid-cols-1 gap-1">
        {METRO_LEGEND.map(({ mark, label }) => (
          <div key={mark} className="flex items-center gap-2">
            <svg width={34} height={22} viewBox="0 0 34 22" aria-hidden className="shrink-0">
              <line x1={mark === "origin" ? 17 : 2} x2={mark === "terminus" ? 17 : 32} y1={11} y2={11} stroke="#9a9d9f" strokeWidth={TRACK_W} strokeLinecap="round" />
              <Mark kind={mark} x={17} y={11} color="#9a9d9f" symbol="At" tick={{ x: 0, y: -1 }} />
            </svg>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bullet({ name, family }: { name: string; family: string }) {
  return (
    <svg width={20} height={20} viewBox="-10 -10 20 20" aria-label={labelOf(name)} role="img">
      <title>{labelOf(name)}</title>
      <circle r={9} fill={LINE_COLORS[family] ?? "#888"} />
      <text y={3.2} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff"
        style={{ fontFamily: FONT }}>{symbolFor(name)}</text>
    </svg>
  );
}
