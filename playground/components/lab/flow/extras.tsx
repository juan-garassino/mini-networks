"use client";

// World flavour for the flow board, each mark tied to data (encoding.ts):
// harbour boats = compositions, the ferry = a selected composition's route,
// tensor trains = live training runs, the "?" lane = next-era models, the
// ruins lane = retired legacy/ projects. All drawn at screen size.
import { useEffect, useMemo, useState } from "react";
import { samplePolyline, type Pt } from "@/lib/world";
import { dipDepth, NEXT_ERA, NEXT_ERA_COPY, RUINS, GROKKING_EGG } from "@/components/lab/shared/eggs";
import { ACCENT, fam, INK, INK_SOFT, PAPER } from "./palette";
import { Creature } from "./creature";
import s from "./flow.module.css";

// ——— boats ———
export function Boat({ x, y, k = 1, sail = "#fff", angle = 0 }: { x: number; y: number; k?: number; sail?: string; angle?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${k})`}>
      <path d="M-9 1 H9 L6 6 H-6 Z" fill="#fff" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M0 0 V-12" stroke={INK} strokeWidth={1.4} />
      <path d="M1 -12 L8 -1 H1 Z" fill={sail} stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
    </g>
  );
}

/** A lane's harbour: up to three moored ferries (compositions touching the family) + how many more. */
export function Dock({ x, y, boats, more, all, sailing, onSail }: {
  x: number; y: number; boats: { name: string; label: string }[]; more: number; all: { name: string; label: string }[];
  sailing: string | null; onSail: (n: string) => void;
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
          {sailing !== b.name && <Boat x={x - w + 20 + i * step} y={y - 6} k={1.25} />}
        </g>
      ))}
      {more > 0 && (
        <g>
          <title>{all.slice(3).map((b) => b.label).join("\n")}</title>
          <circle cx={x - step / 2 - 4} cy={y - 12} r={11} fill="#fff" stroke={INK} strokeWidth={1.8} />
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

export function Ferry({ path, still, runKey, label }: { path: Pt[]; still: boolean; runKey: string; label: string }) {
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
        <Boat x={a.x} y={a.y} k={1.5} sail={ACCENT} />
      </g>
      <text x={a.x} y={a.y - 30} textAnchor="middle" fontSize={14} fontWeight={800} fill={INK} stroke={PAPER} strokeWidth={4} paintOrder="stroke">{label}</text>
    </g>
  );
}

// ——— the hidden "?" lane (next era) and the ruins lane (legacy) ———
export function NextEraLane({ x, y, w, h, sc }: { x: number; y: number; w: number; h: number; sc: number }) {
  const k = Math.max(0.5, Math.min(1.3, sc * 1.4));
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={26} fill="none" stroke={INK} strokeWidth={2} strokeDasharray="10 8" opacity={0.6} />
      <text x={x + 22} y={y + 38} className={s.display} fontSize={Math.max(15, 34 * sc)} fill={INK}>{NEXT_ERA_COPY.island}</text>
      <text x={x + 22 + Math.max(15, 34 * sc)} y={y + 36} fontSize={14} fontWeight={700} fill={INK_SOFT}>{NEXT_ERA_COPY.caption}</text>
      {NEXT_ERA.map((m, i) => {
        const cx = x + (w * (i + 0.5)) / NEXT_ERA.length;
        const cy = y + h * 0.55;
        return (
          <g key={m.id}>
            <title>{`${m.name} — would grow from ${m.buildsOn.replace(/_/g, " ")}. ${m.teaser}`}</title>
            <g transform={`translate(${cx} ${cy}) scale(${k})`} opacity={0.35}>
              <circle r={18} fill={INK} />
              <path d="M-4 -4 Q0 -10 4 -4 Q4 0 0 2 V5 M0 9 V9.5" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" />
            </g>
            <text x={cx} y={cy + 30 * k + 16} textAnchor="middle" className={s.display} fontSize={14} fill={INK}>{m.name}</text>
            <text x={cx} y={cy + 30 * k + 34} textAnchor="middle" fontSize={13} fontWeight={700} fill={INK_SOFT}>from {m.buildsOn.replace(/_/g, " ")}</text>
          </g>
        );
      })}
      {/* here be dragons: a sea-serpent at the edge of the chart */}
      <g transform={`translate(${x + w - 70} ${y + h - 30})`}>
        <path d="M-60 0 q10 -16 20 0 t20 0 t20 0 q6 -8 14 -10 l6 4 l-8 2" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <text x={-60} y={22} fontSize={14} fontStyle="italic" fontWeight={700} fill={INK}>{NEXT_ERA_COPY.warning}</text>
      </g>
    </g>
  );
}

export function RuinsLane({ x, y, w, h, sc }: { x: number; y: number; w: number; h: number; sc: number }) {
  const cols = 5;
  const rows = Math.ceil(RUINS.length / cols);
  const k = Math.max(0.45, Math.min(1.1, sc * 1.2));
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={26} fill="#ECE8F2" stroke="#8B80A8" strokeWidth={2} />
      <text x={x + 22} y={y + 36} className={s.display} fontSize={Math.max(15, 26 * sc)} fill={INK}>Ruins of the old zoo</text>
      <text x={x + 22} y={y + 58} fontSize={13} fontWeight={700} fill={INK_SOFT}>retired projects in legacy/, each with the model that replaced it</text>
      {RUINS.map((r, i) => {
        const cx = x + (w * ((i % cols) + 0.5)) / cols;
        const cy = y + 70 + ((h - 90) * (Math.floor(i / cols) + 0.45)) / rows;
        return (
          <g key={r.id}>
            <title>{`${r.name} (${r.path}): ${r.epitaph}${r.successor ? ` Lives on as ${r.successor.replace(/_/g, " ")}.` : ""}`}</title>
            <g transform={`translate(${cx} ${cy}) scale(${k})`}>
              <path d="M-16 14 V-8 Q-16 -18 0 -18 Q16 -18 16 -8 V14 Z" fill="#D9D3E3" stroke="#6E6590" strokeWidth={2} />
              <path d="M-4 -18 L1 -8 L-3 0 L3 8" fill="none" stroke="#6E6590" strokeWidth={1.6} />
              <path d="M-20 14 H20" stroke="#6E6590" strokeWidth={3} strokeLinecap="round" />
            </g>
            <text x={cx} y={cy + 22 * k + 14} textAnchor="middle" fontSize={13} fontWeight={800} fill={INK}>{r.name.length > 22 ? r.name.slice(0, 21) + "…" : r.name}</text>
          </g>
        );
      })}
    </g>
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
