"use client";

// Round-2 world flavour in paper (spec R2-E). Every piece encodes data:
//   cities    = atoms; houses ∝ direct children, capitals get a keep (world.cities)
//   mountains = inked ranges on family borders no road crosses (world.mountains)
//   harbours  = one docked paper boat per composition touching the family
//   ferry     = the selected composition's ferryRoute, a boat sails it once
//   trains    = a live `running` run: a paper train loops its model's lineage line
//   islands   = the hidden "?" island (next era, pencil only) and the ruins
// All positions come from lib/world. Static layers are memoised.
import { memo, useEffect, useMemo, useState } from "react";
import { samplePolyline, type Pt, type World } from "@/lib/world";
import { dipDepth, NEXT_ERA, RUINS } from "@/components/lab/shared/eggs";
import { inkOf, PAPER } from "./encoding";

// ── cities ───────────────────────────────────────────────────────────────
export const CityLayer = memo(function CityLayer({ world, k = 1 }: { world: World; k?: number }) {
  const fam = new Map(world.nodes.map((n) => [n.name, n.family]));
  return (
    <g aria-hidden>
      {world.cities.map((c) => {
        const ink = inkOf(fam.get(c.node) ?? "");
        // the capital's keep stands on its first block
        return c.blocks.map((b, i) => {
          const keep = c.capital && i === 0;
          // drawn ~1.6× the block so a town reads at region zoom
          const w = 16 * k, h = (keep ? 30 : 13) * k;
          const x = b.x + (b.w - w) / 2, base = b.y + b.h;
          const roof = keep
            ? `M${x - 1.5} ${base - h} h${w + 3} l-2 -3 h-${w - 1} Z`
            : `M${x - 2} ${base - h} L${x + w / 2} ${base - h - 9 * k} L${x + w + 2} ${base - h} Z`;
          return (
            <g key={`${c.node}${i}`}>
              <rect x={x + 1.5} y={base - h + 2} width={w} height={h} fill={PAPER.shadow} />
              <rect x={x} y={base - h} width={w} height={h} fill={PAPER.die} stroke={PAPER.die} strokeWidth={2} strokeLinejoin="round" />
              <path d={roof} fill={ink.dark} stroke={PAPER.die} strokeWidth={1.6} strokeLinejoin="round" />
              <rect x={x + w / 2 - 2} y={base - 6} width={4} height={6} fill={PAPER.ink} opacity={0.7} />
              {keep && <path d={`M${x + 2} ${base - h - 3} v-3 h2 v3 M${x + w - 4} ${base - h - 3} v-3 h2 v3`} stroke={ink.dark} strokeWidth={2} />}
            </g>
          );
        });
      })}
    </g>
  );
});

// ── mountains ────────────────────────────────────────────────────────────
export const MountainLayer = memo(function MountainLayer({ world, k = 1 }: { world: World; k?: number }) {
  const peaks: { x: number; y: number; h: number }[] = [];
  for (const line of world.mountains) {
    const s = samplePolyline(line);
    const n = Math.max(1, Math.floor(s.length / (34 * k)));
    for (let i = 0; i <= n; i++) {
      const p = s.at(i / n);
      peaks.push({ x: p.x, y: p.y + 10 * k, h: [30, 40, 34][i % 3] * k });  // fixed rhythm, not data
    }
  }
  peaks.sort((a, b) => a.y - b.y);
  return (
    <g aria-hidden strokeLinejoin="round">
      {peaks.map((p, i) => {
        const w = p.h * 0.8;
        const left = `M${p.x - w} ${p.y} L${p.x} ${p.y - p.h} L${p.x} ${p.y} Z`;
        const right = `M${p.x} ${p.y} L${p.x} ${p.y - p.h} L${p.x + w} ${p.y} Z`;
        const snow = `M${p.x - w * 0.28} ${p.y - p.h * 0.65} L${p.x} ${p.y - p.h} L${p.x + w * 0.28} ${p.y - p.h * 0.65} L${p.x} ${p.y - p.h * 0.58} Z`;
        return (
          <g key={i}>
            <path d={`M${p.x - w + 3} ${p.y + 3} L${p.x + 3} ${p.y - p.h + 3} L${p.x + w + 3} ${p.y + 3} Z`} fill={PAPER.shadow} />
            <path d={`M${p.x - w} ${p.y} L${p.x} ${p.y - p.h} L${p.x + w} ${p.y} Z`} fill={PAPER.die} stroke={PAPER.die} strokeWidth={4} />
            <path d={left} fill={PAPER.stone} />
            <path d={right} fill={PAPER.stoneDark} />
            <path d={snow} fill={PAPER.die} />
            <path d={`M${p.x - w} ${p.y} L${p.x} ${p.y - p.h} L${p.x + w} ${p.y}`} fill="none" stroke={PAPER.ink} strokeWidth={1.4} opacity={0.55} />
          </g>
        );
      })}
    </g>
  );
});

// ── paper boats ──────────────────────────────────────────────────────────
export function Boat({ x, y, angle = 0, size = 1, sail = PAPER.die }: { x: number; y: number; angle?: number; size?: number; sail?: string }) {
  const flip = Math.cos(angle) < 0 ? -1 : 1;
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${flip * size} ${size})`}>
      <ellipse cx={1} cy={3} rx={9} ry={2.6} fill="rgba(10,40,100,0.35)" />
      <path d="M-9 -2 L9 -2 L6 3 L-6 3 Z" fill={PAPER.die} stroke={PAPER.die} strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M-9 -2 L9 -2 L6 3 L-6 3 Z" fill={PAPER.plank} />
      <path d="M0 -3 L0 -15 L8 -4 Z" fill={sail} stroke={PAPER.die} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M-1 -3 L-1 -12 L-7 -4 Z" fill={PAPER.die} stroke={PAPER.die} strokeWidth={1.2} strokeLinejoin="round" />
    </g>
  );
}

export const HarbourLayer = memo(function HarbourLayer({ world, k = 1 }: { world: World; k?: number }) {
  // one boat per composition touching the family; at most three are drawn,
  // the rest are counted on a badge at the pier
  return (
    <g aria-hidden>
      {world.harbours.filter((h) => h.boats > 0).map((h) => {
        const ink = inkOf(h.family);
        const shown = Math.min(3, h.boats);
        const x0 = h.pt.x, y0 = h.pt.y;
        return (
          <g key={h.tile} transform={`translate(${x0} ${y0}) scale(${k}) translate(${-x0} ${-y0})`}>
            <rect x={x0 - 4} y={y0 - 16} width={8} height={36} rx={2} fill={PAPER.plank} stroke={PAPER.die} strokeWidth={2.5} />
            <path d={`M${x0 - 4} ${y0 - 6} h8 M${x0 - 4} ${y0 + 4} h8 M${x0 - 4} ${y0 + 14} h8`} stroke={PAPER.plankDark} strokeWidth={1.4} />
            {Array.from({ length: shown }, (_, i) => (
              <Boat key={i} x={x0 + 26 + (i % 2) * 8} y={y0 - 14 + i * 26} sail={ink.light} size={1.8} />
            ))}
            {h.boats > shown && (
              <g>
                <circle cx={x0 + 52} cy={y0 - 20} r={10} fill={PAPER.die} stroke={PAPER.ink} strokeWidth={2} />
                <text x={x0 + 52} y={y0 - 19.5} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600} fill={PAPER.ink}>{h.boats}</text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
});

/** Harbour piers only (flat on the ground); the boats stand up as billboards. */
export const HarbourPiers = memo(function HarbourPiers({ world, k = 1 }: { world: World; k?: number }) {
  return (
    <g aria-hidden>
      {world.harbours.filter((h) => h.boats > 0).map((h) => {
        const x0 = h.pt.x, y0 = h.pt.y;
        return (
          <g key={h.tile} transform={`translate(${x0} ${y0}) scale(${k}) translate(${-x0} ${-y0})`}>
            <rect x={x0 - 4} y={y0 - 16} width={8} height={70} rx={2} fill={PAPER.plank} stroke={PAPER.die} strokeWidth={2.5} />
            <path d={`M${x0 - 4} ${y0 - 4} h8 M${x0 - 4} ${y0 + 12} h8 M${x0 - 4} ${y0 + 28} h8 M${x0 - 4} ${y0 + 44} h8`} stroke={PAPER.plankDark} strokeWidth={1.4} />
            {h.boats > 3 && (
              <g>
                <circle cx={x0} cy={y0 - 26} r={11} fill={PAPER.die} stroke={PAPER.ink} strokeWidth={2} />
                <text x={x0} y={y0 - 25.5} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={600} fill={PAPER.ink}>{h.boats}</text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
});

/** The selected composition's route + a boat sailing it once (parked at the
 *  far harbour under still). double_descent's course dips twice (egg). */
export function FerryVoyage({ route, dips, still, family, place }: {
  route: Pt[]; dips: boolean; still: boolean; family: string;
  place?: (p: Pt) => { x: number; y: number; k: number };
}) {
  const course = useMemo(() => {
    if (!dips || route.length < 2) return route;
    const s = samplePolyline(route);
    const n = Math.max(40, Math.floor(s.length / 12));
    const out: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const p = s.at(i / n);
      const d = dipDepth(i / n) * 46;           // perpendicular (to the right of travel = "down")
      out.push({ x: p.x - Math.sin(p.angle) * d, y: p.y + Math.cos(p.angle) * d });
    }
    return out;
  }, [route, dips]);
  const s = useMemo(() => samplePolyline(course), [course]);
  const [t, setT] = useState(still ? 1 : 0);
  useEffect(() => {
    if (still || s.length < 1) { setT(1); return; }
    setT(0);
    const dur = Math.min(6000, Math.max(2200, s.length * 4));
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      setT(k);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [s, still]);
  if (course.length < 2) return null;
  const P = place ?? ((q: Pt) => ({ x: q.x, y: q.y, k: 1 }));
  const d = course.map((q, i) => { const r = P(q); return `${i ? "L" : "M"}${r.x.toFixed(1)} ${r.y.toFixed(1)}`; }).join("");
  const p = s.at(t);
  const b = P(p);
  return (
    <g aria-hidden pointerEvents="none">
      <path d={d} fill="none" stroke={PAPER.die} strokeWidth={5} strokeDasharray="10 8" strokeLinecap="round" opacity={0.9} />
      <path d={d} fill="none" stroke={PAPER.ink} strokeWidth={2} strokeDasharray="10 8" strokeLinecap="round" />
      <g transform={`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) scale(${b.k.toFixed(4)})`}>
        <Boat x={0} y={0} angle={p.angle} size={2.2} sail={inkOf(family).edge} />
      </g>
    </g>
  );
}

// ── trains = live training ───────────────────────────────────────────────
export function Train({ line, still, place }: {
  line: Pt[]; still: boolean; place?: (p: Pt) => { x: number; y: number; k: number };
}) {
  const s = useMemo(() => samplePolyline(line), [line]);
  const [t, setT] = useState(0.6);
  useEffect(() => {
    if (still || s.length < 1) return;
    const period = Math.max(3000, s.length * 12);
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => { setT(((now - t0) % period) / period); raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [s, still]);
  if (s.length < 1) return null;
  const cars = [0, 16, 30].map((back, i) => {
    const p = s.at(Math.max(0, t - back / s.length));
    const q = place ? place(p) : { x: p.x, y: p.y, k: 1 };
    return (
      <g key={i} transform={`translate(${q.x.toFixed(1)} ${q.y.toFixed(1)}) scale(${q.k.toFixed(4)}) rotate(${(p.angle * 180 / Math.PI).toFixed(1)})`}>
        <rect x={-7} y={-5} width={14} height={10} rx={2} fill={i === 0 ? PAPER.face : PAPER.die} stroke={PAPER.ink} strokeWidth={1.6} />
        {i === 0 && <rect x={3} y={-3} width={3} height={6} fill={PAPER.die} />}
      </g>
    );
  });
  return <g aria-hidden pointerEvents="none">{cars.reverse()}</g>;
}

// ── secret islands (outside the overview; reach them by panning / zooming out) ──
function islandPath(b: { x: number; y: number; w: number; h: number }): string {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, rx = b.w / 2 + 26, ry = b.h / 2 + 22;
  const n = 18;
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + 0.07 * Math.sin(i * 2.3) ;       // scissor-cut wobble (fixed)
    pts.push(`${(cx + Math.cos(a) * rx * k).toFixed(1)},${(cy + Math.sin(a) * ry * k).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
}

export const SecretIslands = memo(function SecretIslands({ world }: { world: World }) {
  const hidden = world.hiddenIsland, ruins = world.ruinsIsland;
  const hd = islandPath(hidden.box), rd = islandPath(ruins.box);
  return (
    <g aria-hidden>
      {/* the "?" island and its dragon stand up as billboards (art/FogIsland) */}
      {/* the ruins islet: retired legacy/ models as broken columns */}
      <path d={rd} fill={PAPER.stone} stroke={PAPER.die} strokeWidth={6} strokeLinejoin="round" />
      <path d={rd} fill="url(#paper-fibre)" />
      {ruins.slots.map((p, i) => (
        <g key={i}>
          <rect x={p.x - 6} y={p.y - 22} width={12} height={22} fill={PAPER.die} stroke={PAPER.stoneDark} strokeWidth={1.6} />
          <path d={`M${p.x - 6} ${p.y - 22} l4 -5 l3 4 l5 -3 V${p.y - 22}`} fill={PAPER.die} stroke={PAPER.stoneDark} strokeWidth={1.6} strokeLinejoin="round" />
          <rect x={p.x - 9} y={p.y} width={18} height={4} fill={PAPER.stoneDark} />
        </g>
      ))}
    </g>
  );
});

function octPts(cx: number, cy: number, r: number) {
  return Array.from({ length: 8 }, (_, k) => {
    const a = Math.PI / 8 + (k * Math.PI) / 4;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

/** Screen-space captions for the secret islands (names, dragons, ruins). */
export function secretCaptions(world: World): { key: string; at: Pt; text: string; kind: "next" | "dragons" | "ruin" }[] {
  const out: { key: string; at: Pt; text: string; kind: "next" | "dragons" | "ruin" }[] = [];
  world.hiddenIsland.slots.forEach((p, i) => {
    const m = NEXT_ERA.find((x) => x.id === world.hiddenIsland.names[i]);
    if (m) out.push({ key: `n${i}`, at: { x: p.x, y: p.y + 26 }, text: m.name, kind: "next" });
  });
  out.push({ key: "dragons", at: { x: world.hiddenIsland.dragons.x + 6, y: world.hiddenIsland.dragons.y + 20 }, text: "here be dragons", kind: "dragons" });
  world.ruinsIsland.slots.forEach((p, i) => {
    const r = RUINS.find((x) => x.id === world.ruinsIsland.names[i]);
    if (r) out.push({ key: `r${i}`, at: { x: p.x, y: p.y + 12 }, text: r.name, kind: "ruin" });
  });
  return out;
}
