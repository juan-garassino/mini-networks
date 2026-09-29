"use client";

// World flavour for the flow board, each mark tied to data (encoding.ts):
// harbour boats = compositions, the ferry = a selected composition's route,
// tensor trains = live training runs, the "?" lane = next-era models, the
// ruins lane = retired legacy/ projects. All drawn at screen size.
import { useEffect, useMemo, useState } from "react";
import { samplePolyline, type Pt } from "@/lib/world";
import { dipDepth, NEXT_ERA, NEXT_ERA_COPY, RUINS, GROKKING_EGG } from "@/components/lab/shared/eggs";
import { ACCENT, fam, INK, INK_SOFT } from "./palette";
import { Creature } from "./creature";
import s from "./flow.module.css";

// ——— boats ———
export function Boat({ x, y, k = 1, sail = "#fff", angle = 0, hull = [] }: {
  x: number; y: number; k?: number; sail?: string; angle?: number;
  /** member families of the composition, painted as hull stripes (fore → aft) */
  hull?: string[];
}) {
  // a glossy sticker ferry: white die-cut rim, lit hull striped by its members' families, sail, shine
  const hullD = "M-10 0 H10 Q9 6 5 7 H-5 Q-9 6 -10 0 Z";
  const sailD = "M1 -14 Q8 -8 9 -1 H1 Z";
  const jib = "M-1 -12 L-7 -1 H-1 Z";
  const cols = hull.length ? hull : ["#7C6AA8"];
  const id = `hull-${cols.join("-").replace(/#/g, "")}`;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${k})`}>
      <defs>
        <clipPath id={id}><path d={hullD} /></clipPath>
      </defs>
      <ellipse cx={1.5} cy={8.5} rx={10} ry={2} fill={INK} opacity={0.18} />
      <g stroke="#fff" strokeWidth={4.5} strokeLinejoin="round" fill="#fff">
        <path d={hullD} /><path d={sailD} /><path d={jib} /><path d="M0 0 V-15" />
      </g>
      <g clipPath={`url(#${id})`}>
        {cols.map((c, i) => <rect key={i} x={-10 + (20 * i) / cols.length} y={0} width={20 / cols.length + 0.3} height={8} fill={c} />)}
      </g>
      <path d={hullD} fill="none" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M-8 1.5 H8" stroke="#fff" strokeWidth={1.2} opacity={0.7} />
      {/* one porthole per member model */}
      {cols.slice(0, 4).map((_, i, a) => <circle key={i} cx={(i - (a.length - 1) / 2) * 4.2} cy={3.8} r={1.1} fill="#fff" stroke={INK} strokeWidth={0.6} />)}
      <path d="M0 0 V-15" stroke={INK} strokeWidth={1.4} />
      <path d={sailD} fill={sail} stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
      <path d={jib} fill="#fff" stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M3 -10 Q6 -6 6.5 -3" stroke="#fff" strokeWidth={1.3} fill="none" strokeLinecap="round" opacity={0.9} />
    </g>
  );
}

/** A lane's harbour: up to three moored ferries (compositions touching the family) + how many more. */
export interface DockBoat { name: string; label: string; hull: string[] }
export function Dock({ x, y, boats, more, sailing, onSail, onMore }: {
  x: number; y: number; boats: DockBoat[]; more: number;
  sailing: string | null; onSail: (n: string) => void; onMore: () => void;
}) {
  const step = 34;
  const w = boats.length * step + (more > 0 ? step : 0) + 12;
  return (
    <g>
      <path d={`M${x - w} ${y + 2} H${x}`} stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      {boats.map((b, i) => (
        <g key={b.name} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); onSail(b.name); }}>
          <title>{`${b.label} — click to sail`}</title>
          <rect x={x - w + 4 + i * step} y={y - 30} width={step} height={34} fill="transparent" />
          {sailing !== b.name && <Boat x={x - w + 20 + i * step} y={y - 6} k={1.15} hull={b.hull} />}
        </g>
      ))}
      {more > 0 && (
        <g className="cursor-pointer" role="button" tabIndex={0} aria-label={`${more} more pipelines — open the list`}
          onClick={(e) => { e.stopPropagation(); onMore(); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onMore(); } }}>
          <circle cx={x - step / 2 - 4} cy={y - 12} r={13} fill="#fff" stroke={INK} strokeWidth={1.8} />
          <text x={x - step / 2 - 4} y={y - 11.5} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={800} fill={INK}>+{more}</text>
        </g>
      )}
    </g>
  );
}

/** Screen polyline for a ferry: dock → members in order → back, arcing; double_descent dips twice. */
export function ferryPath(stops: Pt[], dips: boolean): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const bulge = Math.min(90, L * 0.22) * (i % 2 ? 1 : -1);
    const cx = mx + (-(b.y - a.y) / L) * bulge, cy = my + ((b.x - a.x) / L) * bulge;
    for (let j = i ? 1 : 0; j <= 20; j++) {
      const t = j / 20;
      out.push({ x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * cx + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * cy + t * t * b.y });
    }
  }
  if (!dips || out.length < 2) return out;
  const sp = samplePolyline(out);
  let acc = 0;
  return out.map((p, i) => {
    if (i) acc += Math.hypot(p.x - out[i - 1].x, p.y - out[i - 1].y);
    return { x: p.x, y: p.y + dipDepth(acc / (sp.length || 1)) * 46 };
  });
}

export function Ferry({ path, still, runKey, hull }: { path: Pt[]; still: boolean; runKey: string; hull: string[] }) {
  const sp = useMemo(() => samplePolyline(path), [path]);
  const [t, setT] = useState(still ? 0.55 : 0);
  useEffect(() => {
    if (still) { setT(0.55); return; }
    let raf = 0;
    const t0 = performance.now();
    const dur = Math.min(5200, 1600 + sp.length * 2.2);
    const tick = (now: number) => {
      const u = Math.min(1, (now - t0) / dur);
      setT(u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
      if (u < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [runKey, still, sp.length]);
  if (path.length < 2) return null;
  const d = path.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const a = sp.at(t);
  const deg = (Math.cos(a.angle) < 0 ? 180 : 0);
  return (
    <g pointerEvents="none">
      <path d={d} fill="none" stroke="#fff" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
      <path d={d} fill="none" stroke={ACCENT} strokeWidth={2.4} strokeDasharray="7 6" strokeLinecap="round" />
      <g transform={deg ? `translate(${a.x} ${a.y}) scale(-1 1) translate(${-a.x} ${-a.y})` : undefined}>
        <Boat x={a.x} y={a.y} k={1.5} sail={ACCENT} hull={hull} />
      </g>
    </g>
  );
}

// ——— the hidden "?" lane (next era) and the ruins lane (legacy) ———
// Constant-size screen panels (a list, one row each) anchored to their spot
// off the chart: legible at every zoom they are visible, never overprinted.
export function NextEraPanel({ x, y }: { x: number; y: number }) {
  return (
    <foreignObject x={x} y={y} width={300} height={250}>
      <div className="rounded-3xl border-2 border-dashed px-4 py-3" style={{ borderColor: INK, background: "rgba(255,255,255,0.86)", color: INK }}>
        <p className={`${s.display} text-[20px] leading-none`}>{NEXT_ERA_COPY.island}</p>
        <p className="mt-1 text-[13px] font-bold" style={{ color: INK_SOFT }}>{NEXT_ERA_COPY.caption}</p>
        <ul className="mt-2 space-y-1.5">
          {NEXT_ERA.map((m) => (
            <li key={m.id} className="flex items-baseline gap-2 text-[13px] leading-snug" title={m.teaser}>
              <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: INK, opacity: 0.35 }} />
              <span><b className={s.display}>{m.name}</b> <span style={{ color: INK_SOFT }}>from {m.buildsOn.replace(/_/g, " ")}</span></span>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex items-center gap-2 text-[13px] font-bold italic">
          <svg viewBox="-62 -14 84 22" className="h-4 w-14" aria-hidden>
            <path d="M-60 0 q10 -12 20 0 t20 0 t20 0 q6 -8 14 -10 l6 4 l-8 2" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {NEXT_ERA_COPY.warning}
        </p>
      </div>
    </foreignObject>
  );
}

export function RuinsPanel({ x, y }: { x: number; y: number }) {
  return (
    <foreignObject x={x} y={y} width={320} height={430}>
      <div className="rounded-3xl border-2 px-4 py-3" style={{ borderColor: "#8B80A8", background: "#ECE8F2", color: INK }}>
        <p className={`${s.display} text-[16px] leading-tight`}>Ruins of the old zoo</p>
        <p className="text-[13px] font-bold" style={{ color: INK_SOFT }}>retired projects in legacy/ and what replaced them</p>
        <ul className="mt-2 space-y-0.5">
          {RUINS.map((r) => (
            <li key={r.id} className="truncate text-[13px] leading-5" title={`${r.path}: ${r.epitaph}`}>
              <b>{r.name}</b>{r.successor ? <span style={{ color: INK_SOFT }}> → {r.successor.replace(/_/g, " ")}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </foreignObject>
  );
}

// ——— tensor trains: a live training run rides its model's incoming pipes ———
export function Trains({ routes, still, size }: { routes: { id: string; pts: Pt[] }[]; still: boolean; size: number }) {
  const samplers = useMemo(() => routes.map((r) => ({ id: r.id, s: samplePolyline(r.pts) })), [routes]);
  const [t, setT] = useState(0.5);
  useEffect(() => {
    if (still || samplers.length === 0) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => { setT(((now - t0) / 3200) % 1); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [still, samplers.length]);
  return (
    <g pointerEvents="none">
      {samplers.map(({ id, s: sp }) => [0, 1, 2].map((i) => {
        const u = Math.max(0, Math.min(1, t - i * 0.05));
        const a = sp.at(u);
        return (
          <g key={`${id}:${i}`} transform={`translate(${a.x} ${a.y}) rotate(${(a.angle * 180) / Math.PI})`}>
            <rect x={-size * 0.7} y={-size / 2} width={size * 1.4} height={size} rx={size * 0.3} fill={i ? "#fff" : ACCENT} stroke={INK} strokeWidth={1.6} />
            {i > 0 && <rect x={-size * 0.35} y={-size * 0.22} width={size * 0.7} height={size * 0.3} rx={1} fill={INK} opacity={0.6} />}
          </g>
        );
      }))}
    </g>
  );
}

// ——— grokking egg: a speech bubble that only "gets it" after a long hover ———
export function GrokBubble({ x, y, held }: { x: number; y: number; held: boolean }) {
  const w = held ? 320 : 250;
  const text = held ? GROKKING_EGG.after : GROKKING_EGG.before;
  const sk = GROKKING_EGG.sketch;
  const line = (pts: readonly (readonly [number, number])[]) => pts.map(([px, py], i) => `${i ? "L" : "M"}${(12 + px * (w - 24)).toFixed(1)} ${(110 - py * 100).toFixed(1)}`).join(" ");
  return (
    <foreignObject x={x - w / 2} y={y - (held ? 210 : 96)} width={w} height={held ? 200 : 88} pointerEvents="none">
      <div className="rounded-2xl border-2 bg-white px-3 py-2 text-[14px] font-bold leading-snug" style={{ borderColor: INK, color: INK, boxShadow: `0 3px 0 ${INK}` }}>
        {text}
        {held && (
          <>
            <p className="mt-1 text-[13px] font-medium leading-snug">{GROKKING_EGG.explain.split(". ")[0]}.</p>
            <svg viewBox={`0 0 ${w} 124`} width={w - 24} height={60} aria-label="illustration of train vs held-out accuracy">
              <path d={line(sk.train)} fill="none" stroke={INK} strokeWidth={2} />
              <path d={line(sk.val)} fill="none" stroke={ACCENT} strokeWidth={2.4} />
            </svg>
            <p className="text-[13px] font-medium" style={{ color: INK_SOFT }}>{sk.note}</p>
          </>
        )}
      </div>
    </foreignObject>
  );
}

// ——— the mascot (header): 7 clicks and it trains on a real loss curve ———
export function Mascot({ state }: { state: "idle" | "trained" }) {
  return (
    <svg viewBox="-24 -30 48 54" className="h-8 w-8" aria-hidden>
      <Creature family="perception" atom={false} state={state === "trained" ? "champion" : "trained"} />
    </svg>
  );
}

export { fam };
