"use client";

// The hybrid diorama on layout v2 — this skin's own papercraft renderer (it
// no longer imports the paper skin). Every coordinate comes from lib/world;
// every mark is declared in ./encoding.ts. Static layers are memoised on the
// world so a camera tween only changes the viewBox.
import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import { samplePolyline, type Box, type Pt, type Road, type World, type WorldNode } from "@/lib/world";
import { CRITTER } from "@/components/lab/shared/critter";
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { NEXT_ERA, NEXT_ERA_COPY, RUINS } from "@/components/lab/shared/eggs";
import { iconFor } from "@/lib/icons";
import { symbolFor } from "@/lib/blueprint";
import { PAPER } from "./palette.ts";
import { HybridDefs, PaperBoat, PaperCities, PaperDressing, PaperMountains, PaperRoads, SPOT_R, StickerSpot, groundOf, spotScale } from "./art.tsx";
import { R, P } from "@/components/lab/paper/art/palette";
export { SPOT_R, spotScale };
import { islandD, lineD, octagonD, regionOutlines } from "./geometry.ts";
import s from "./hybrid.module.css";

const f1 = (n: number) => Math.round(n * 10) / 10;

// ── land ─────────────────────────────────────────────────────────────────
const Land = memo(function Land({ world, outlines }: { world: World; outlines: string[] }) {
  const A = world.camera.all;
  const hidden = islandD(world.hiddenIsland.box, 1.7);
  const ruins = islandD(world.ruinsIsland.box, 4.1);
  // each outline is defined ONCE and reused (<use>) by every paper layer
  const ids = [...world.regions.map((r) => `hy-r${r.id}`), "hy-hidden", "hy-ruins"];
  const faces = [...world.regions.map((r) => groundOf(r.family).fill), "url(#pa-sand)", "url(#pa-stone)"];
  const edges = [...world.regions.map((r) => groundOf(r.family).ramp[3]), R.sand[3], R.rock[3]];
  const ds = [...outlines, hidden, ruins];
  return (
    <g aria-hidden>
      <defs>{ds.map((d, i) => <path key={ids[i]} id={ids[i]} d={d} />)}</defs>
      <rect x={A.x - A.w} y={A.y - A.h} width={A.w * 3} height={A.h * 3} fill="url(#pa-sea)" />
      {/* foam band where land meets sea */}
      <g fill="none" stroke="#9CCBFF" strokeOpacity={0.7} strokeWidth={26} strokeLinejoin="round">{ids.map((id) => <use key={id} href={`#${id}`} />)}</g>
      <g fill="none" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={16} strokeLinejoin="round" strokeDasharray="2 10" strokeLinecap="round">{ids.map((id) => <use key={id} href={`#${id}`} />)}</g>
      {/* cast shadow → card thickness (ramp shade) → die-cut rim → printed ground → fibre */}
      <g fill={P.shadow} fillOpacity={0.35} transform="translate(7 11)">{ids.map((id) => <use key={id} href={`#${id}`} />)}</g>
      <g stroke={P.die} strokeWidth={8} strokeLinejoin="round" transform="translate(0 7)">
        {ids.map((id, i) => <use key={id} href={`#${id}`} fill={edges[i]} />)}
      </g>
      <g fill={P.die} stroke={P.die} strokeWidth={8} strokeLinejoin="round">{ids.map((id) => <use key={id} href={`#${id}`} />)}</g>
      {ids.map((id, i) => <use key={`f${id}`} href={`#${id}`} fill={faces[i]} />)}
      <g fill="url(#pa-fibre)">{ids.map((id) => <use key={`x${id}`} href={`#${id}`} />)}</g>
    </g>
  );
});

/** Harbours: a dock + one moored boat per composition touching the family. */
const Harbours = memo(function Harbours({ world, sailing, scale }: { world: World; sailing: string[]; scale: number }) {
  const fs = 13 / Math.min(1, Math.max(scale, 0.3));
  return (
    <g aria-hidden>
      {world.harbours.map((h, hi) => {
        const cx = (h.tile % world.cols) * world.tile + world.tile / 2;
        const cy = Math.floor(h.tile / world.cols) * world.tile + world.tile / 2;
        let dx = h.pt.x - cx, dy = h.pt.y - cy;
        const L = Math.hypot(dx, dy) || 1;
        dx /= L; dy /= L;
        const px = -dy, py = dx;
        const n = Math.max(0, h.boats - (sailing.includes(h.family) ? 1 : 0));
        const shown = Math.min(3, n);
        return (
          <g key={hi}>
            <line x1={cx} y1={cy} x2={h.pt.x + dx * 18} y2={h.pt.y + dy * 18} stroke={PAPER.rim} strokeWidth={11} strokeLinecap="round" />
            <line x1={cx} y1={cy} x2={h.pt.x + dx * 18} y2={h.pt.y + dy * 18} stroke={PAPER.plank} strokeWidth={7} strokeLinecap="round" />
            {Array.from({ length: shown }, (_, i) => {
              const k = (i - (shown - 1) / 2) * 46;
              return <PaperBoat key={i} x={h.pt.x + dx * 40 + px * k} y={h.pt.y + dy * 40 + py * k} scale={1.7} />;
            })}
            {n > 0 && (
              // how many pipelines dock here (boats beyond three are counted, not drawn)
              <g transform={`translate(${f1(h.pt.x + dx * 40 + px * ((shown - 1) / 2 * 46 + 36))} ${f1(h.pt.y + dy * 40 + py * ((shown - 1) / 2 * 46 + 36) - 14)})`}>
                <circle r={fs * 0.85} fill={PAPER.rim} stroke={PAPER.ink} strokeWidth={1.5} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight={700} fill={PAPER.ink}>{n}</text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
});

const BaseRoads = memo(function BaseRoads({ world, skip }: { world: World; skip: string }) {
  const keep = useMemo(() => {
    const out = new Set(skip ? skip.split("|") : []);
    return world.roads.filter((r) => !out.has(r.id));
  }, [world, skip]);
  return <PaperRoads roads={keep} lifted={false} />;
});

const Bridges = memo(function Bridges({ world }: { world: World }) {
  return (
    <g aria-hidden>
      {world.bridges.map((b) => {
        const xs = b.tiles.map((i) => i % world.cols), ys = b.tiles.map((i) => Math.floor(i / world.cols));
        const T = world.tile;
        const x0 = Math.min(...xs) * T, x1 = (Math.max(...xs) + 1) * T, y0 = Math.min(...ys) * T, y1 = (Math.max(...ys) + 1) * T;
        const r = b.axis === "h" ? { x: x0 - 5, y: y0 + 3, w: x1 - x0 + 10, h: y1 - y0 - 6 } : { x: x0 + 3, y: y0 - 5, w: x1 - x0 - 6, h: y1 - y0 + 10 };
        return (
          <g key={b.roadId}>
            <rect x={r.x + 2} y={r.y + 4} width={r.w} height={r.h} rx={2} fill={PAPER.shadow} opacity={0.3} />
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={2} fill={PAPER.plank} stroke={PAPER.rim} strokeWidth={2} />
          </g>
        );
      })}
    </g>
  );
});

/** Konami forward pass: a gold ring expands from each spot at its delay. */
function Pulses({ world, t, schedule }: { world: World; t: number; schedule: Record<string, number> }) {
  return (
    <g aria-hidden pointerEvents="none">
      {world.nodes.map((n) => {
        const u = (t - (schedule[n.name] ?? 1e9)) / 700;
        if (u < 0 || u > 1) return null;
        const R = (n.atom ? SPOT_R.atom : SPOT_R.town) + 6 + u * 26;
        return <circle key={n.name} cx={n.center.x} cy={n.center.y} r={R} fill="none" stroke={PAPER.gold} strokeWidth={5 * (1 - u) + 1} opacity={1 - u} />;
      })}
    </g>
  );
}

// ── secret islands ──────────────────────────────────────────────────────
function Secrets({ world, scale }: { world: World; scale: number }) {
  const px = (v: number) => v / Math.max(scale, 0.05);          // screen-constant sizes
  const H = world.hiddenIsland, R = world.ruinsIsland;
  const eraById = new Map(NEXT_ERA.map((m) => [m.id, m]));
  const ruinById = new Map(RUINS.map((r) => [r.id, r]));
  const legible = scale >= 0.45;
  return (
    <g style={{ fontFamily: "var(--font-hybrid-round), system-ui" }}>
      {H.names.map((id, i) => {
        const p = H.slots[i];
        if (!p) return null;
        const m = eraById.get(id);
        return (
          <g key={id} data-secret={`era:${id}`} className={s.node} role="button" tabIndex={0} aria-label={`Uncharted: ${m?.name ?? id}`}>
            <path d={octagonD(p.x, p.y, 22)} fill={PAPER.rim} stroke={PAPER.pencil} strokeWidth={2} strokeDasharray="5 4" />
            <text x={p.x} y={p.y + 1} textAnchor="middle" dominantBaseline="central" fontSize={24} fontWeight={700} fill={PAPER.pencil}>?</text>
            {legible && (
              <text x={p.x} y={p.y + 38} textAnchor="middle" fontSize={px(13)} fontWeight={600} fill={PAPER.ink}>{m?.name ?? id}</text>
            )}
          </g>
        );
      })}
      {/* here be dragons: a paper sea-serpent off the uncharted island */}
      <g transform={`translate(${H.dragons.x} ${H.dragons.y})`} aria-hidden>
        <path d="M-40 10q8-18 16 0t16 0t16 0" fill="none" stroke={PAPER.rim} strokeWidth={9} strokeLinecap="round" />
        <path d="M-40 10q8-18 16 0t16 0t16 0" fill="none" stroke="#5f7f6a" strokeWidth={5} strokeLinecap="round" />
        <path d="M8 10q6-2 10-12l8 4l-6 8z" fill="#5f7f6a" stroke={PAPER.rim} strokeWidth={2} strokeLinejoin="round" />
        <text x={-16} y={36} textAnchor="middle" fontSize={px(13)} fontStyle="italic" fill={PAPER.rim}>{NEXT_ERA_COPY.warning}</text>
      </g>
      {R.names.map((id, i) => {
        const p = R.slots[i];
        const r = ruinById.get(id);
        if (!p || !r) return null;
        return (
          <g key={id} data-secret={`ruin:${id}`} className={s.node} role="button" tabIndex={0} aria-label={`Ruin: ${r.name}`}>
            {/* a broken column: shaft + tilted capital fallen beside it */}
            <rect x={p.x - 6} y={p.y - 16} width={12} height={20} fill={PAPER.rim} stroke={PAPER.ink} strokeWidth={1.2} />
            <path d={`M${p.x - 6} ${p.y - 16}l4 -5l4 4l4 -3v4z`} fill={PAPER.rim} stroke={PAPER.ink} strokeWidth={1.2} strokeLinejoin="round" />
            <rect x={p.x + 8} y={p.y} width={10} height={5} fill={PAPER.rim} stroke={PAPER.ink} strokeWidth={1} transform={`rotate(18 ${p.x + 13} ${p.y + 2})`} />
            <title>{`${r.name} — ${r.epitaph}`}</title>
          </g>
        );
      })}
    </g>
  );
}

// ── critter (paper cutout) ──────────────────────────────────────────────
export function Critter({ path, still, walkKey, training }: { path: Pt[]; still: boolean; walkKey: string; training: boolean }) {
  const line = useMemo(() => samplePolyline(path), [path]);
  const [t, setT] = useState(1);
  useEffect(() => {
    if (still || line.length < 1) { setT(1); return; }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setT(1); return; }
    const dur = Math.max(500, (line.length / CRITTER.walkSpeed) * 1000);
    const t0 = performance.now() + 200;
    let raf = 0;
    setT(0);
    const step = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - t0) / dur));
      setT(k);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [line, still, walkKey]);
  if (!path.length) return null;
  const p = line.at(t);
  const walking = t < 1;
  const hop = walking ? -Math.abs(Math.sin((t * line.length) / 10)) * 5 : 0;
  const dir = walking && Math.cos(p.angle) < -0.2 ? -1 : 1;
  const K = 38 / 140;
  return (
    <g data-critter="1" className={s.node} role="button" tabIndex={0} aria-label="The critter (you)"
      transform={`translate(${f1(p.x)} ${f1(p.y)})`}>
      <ellipse cx={2} cy={2} rx={12} ry={4} fill={PAPER.shadow} opacity={0.3} />
      <g transform={`translate(0 ${hop}) scale(${dir * K} ${K}) translate(-60 -126)`}>
        <g stroke={PAPER.rim} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" fill={PAPER.rim}>
          <path d={CRITTER.body} />
          <path d={CRITTER.antenna} fill="none" />
          <circle {...CRITTER.antennaTip} />
        </g>
        {CRITTER.feet.map((ft, i) => <ellipse key={i} cx={ft.cx} cy={ft.cy} rx={12} ry={8} fill={PAPER.ink} />)}
        <path d={CRITTER.body} fill={training ? PAPER.gold : "#f1e7cf"} stroke={PAPER.ink} strokeWidth={7} />
        <path d={CRITTER.antenna} fill="none" stroke={PAPER.ink} strokeWidth={7} strokeLinecap="round" />
        <circle {...CRITTER.antennaTip} fill={PAPER.gold} stroke={PAPER.ink} strokeWidth={5} />
        <circle {...CRITTER.eye} fill="#fff" stroke={PAPER.ink} strokeWidth={6} />
        <circle {...CRITTER.pupil} fill={PAPER.ink} />
        <path d={CRITTER.smile} fill="none" stroke={PAPER.ink} strokeWidth={6} strokeLinecap="round" />
      </g>
      <title>The critter — that is you</title>
    </g>
  );
}

// ── the whole diorama ─────────────────────────────────────────────────────
export interface DioramaProps {
  world: World;
  states: Record<string, EvidenceState>;
  stations: Record<string, number>;
  focus: WorldNode | null;
  zoom: "overview" | "region" | "node";
  /** names + roads lifted above the value step-back (node view) */
  lineageNames: Set<string>;
  lineageRoads: Set<string>;
  /** quest route: root atom → parking spot */
  quest: Pt[];
  scale: number;
  still: boolean;
  critter: { training: boolean } | null;
  /** selected composition's ferry (points already bent for double descent) + boat progress 0..1 */
  ferry: { points: Pt[]; t: number; families: string[] } | null;
  trains: { points: Pt[]; t: number }[];
  konami: { t: number; schedule: Record<string, number> } | null;
  /** semantic zoom: atoms never smaller than this screen radius */
  atomPx: number;
  onHover: (name: string | null) => void;
  children?: ReactNode;
}

export function Diorama(p: DioramaProps) {
  const { world, states, stations, focus, zoom, lineageNames, lineageRoads, quest, scale, still } = p;
  const outlines = useMemo(() => regionOutlines(world), [world]);
  const nodeView = zoom === "node" && focus;
  const regionView = zoom === "region" && focus;
  const liftKey = nodeView ? [...lineageRoads].sort().join("|") : "";
  const liftedRoads = useMemo(() => world.roads.filter((r) => liftKey.split("|").includes(r.id)), [world, liftKey]);
  const ordered = useMemo(() => [...world.nodes].sort((a, b) => a.center.y - b.center.y), [world]);
  const A = world.camera.all;
  const spot = (n: WorldNode) => (
    <StickerSpot key={n.name} n={n} state={states[n.name] ?? "untrained"} focused={focus?.name === n.name && zoom !== "overview"}
      stations={zoom === "overview" ? 0 : stations[n.name] ?? 0} scale={scale} atomPx={p.atomPx} onHover={p.onHover} />
  );
  const liftedNode = (n: WorldNode) => Boolean(nodeView && lineageNames.has(n.name));
  return (
    <>
      <HybridDefs />
      <Land world={world} outlines={outlines} />
      {/* semantic zoom: biome dressing only once props are big enough to read (the printed ground carries the biome below that) */}
      {scale >= 0.6 && <PaperDressing world={world} />}
      <PaperMountains world={world} />
      <Harbours world={world} sailing={p.ferry ? p.ferry.families : []} scale={Math.round(scale * 20) / 20} />
      <BaseRoads world={world} skip={liftKey} />
      <Bridges world={world} />
      <PaperCities world={world} />
      <Secrets world={world} scale={scale} />
      <g>{ordered.filter((n) => !liftedNode(n) && n.name !== focus?.name).map(spot)}</g>
      {/* value step-back: darken what is out of focus (never a milky veil) */}
      {regionView && (
        <g fill={PAPER.dim} stroke={PAPER.dim} strokeWidth={8} opacity={0.26}>
          {world.regions.filter((r) => r.family !== focus.family).map((r) => <use key={`d${r.id}`} href={`#hy-r${r.id}`} />)}
        </g>
      )}
      {nodeView && <rect x={A.x - A.w} y={A.y - A.h} width={A.w * 3} height={A.h * 3} fill={PAPER.dim} opacity={0.3} />}
      {nodeView && <PaperRoads roads={liftedRoads} lifted />}
      {quest.length > 1 && focus && zoom !== "overview" && (
        // the quest route: the critter's walk from the root atom, dotted in gold ink
        <path d={lineD(quest)} fill="none" stroke={R.red[2]} strokeWidth={4} strokeDasharray="0.1 10" strokeLinecap="round" />
      )}
      <g>{ordered.filter((n) => liftedNode(n) && n.name !== focus?.name).map(spot)}</g>
      {focus && ordered.filter((n) => n.name === focus.name).map(spot)}
      {p.ferry && p.ferry.points.length > 1 && (
        <g>
          <path d={lineD(p.ferry.points)} fill="none" stroke={PAPER.rim} strokeWidth={3} strokeDasharray="7 7" strokeLinecap="round" />
          {(() => { const q = samplePolyline(p.ferry.points).at(p.ferry.t); return <PaperBoat x={q.x} y={q.y} scale={2} sel />; })()}
        </g>
      )}
      {p.trains.map((tr, i) => {
        const q = samplePolyline(tr.points).at(tr.t);
        return (
          <g key={i} transform={`translate(${f1(q.x)} ${f1(q.y)}) rotate(${f1((q.angle * 180) / Math.PI)})`} aria-hidden>
            {[0, -13, -26].map((dx, j) => (
              <rect key={j} x={dx - 6} y={-4.5} width={11} height={9} rx={2} fill={j === 0 ? PAPER.gold : PAPER.rim} stroke={PAPER.ink} strokeWidth={1.2} />
            ))}
          </g>
        );
      })}
      {p.konami && <Pulses world={world} t={p.konami.t} schedule={p.konami.schedule} />}
      {p.critter && focus && zoom !== "overview" && quest.length > 0 && (
        <Critter path={quest} still={still} walkKey={focus.name} training={p.critter.training} />
      )}
      {p.children}
    </>
  );
}

export function boxOfPoints(pts: Pt[], pad: number): Box {
  const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y);
  const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
  return { x: x0, y: y0, w: Math.max(...xs) + pad - x0, h: Math.max(...ys) + pad - y0 };
}
