"use client";

// Round 3: the hybrid map as a TILTED paper diorama, drawn with the paper
// art library (components/lab/paper/art, read-only). Ground layers (sea
// excepted) live inside scale(1, TILT); every stand-up prop is placed at its
// projected base point un-squashed and painted back-to-front by base y.
// Data marks (level spots) are painted AFTER the props so decoration can
// never hide a model. Every coordinate comes from lib/world.
import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import { samplePolyline, type Box, type Pt, type World, type WorldNode } from "@/lib/world";
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { NEXT_ERA, RUINS } from "@/components/lab/shared/eggs";
import {
  AtomSpot, BIOME, CapitalSpot, CritterArt, FogIsland, HOUSES, LevelSpot, Mountains, PaperBoat, PaperDragon,
  PaperTrain, Pier, Ruins, SET_PIECES, SteamBoat, CRITTER_WALK, P, R,
} from "@/components/lab/paper/art";
import { CRITTER } from "@/components/lab/shared/critter";
import { HybridDefs, PaperRoads, SPOT_R, groundOf, spotScale } from "./art.tsx";
import { islandD, lineD, regionOutlines, sampleEvery } from "./geometry.ts";
import s from "./hybrid.module.css";

export { SPOT_R, spotScale };

/** Ground tilt: matches the paper library's flat level spots (0.68). */
export const TILT = 0.68;
/** world px → projected px (the SVG's coordinate space). */
export const proj = (p: Pt): Pt => ({ x: p.x, y: p.y * TILT });
export const projBox = (b: Box): Box => ({ x: b.x, y: b.y * TILT, w: b.w, h: b.h * TILT });

const f1 = (n: number) => Math.round(n * 10) / 10;
const TG = `scale(1 ${TILT})`;

// ── ground: printed land, foam, rim, thickness ──────────────────────────────
const Ground = memo(function Ground({ world, outlines, showSecrets }: { world: World; outlines: string[]; showSecrets: boolean }) {
  const hidden = islandD(world.hiddenIsland.box, 1.7);
  const ruins = islandD(world.ruinsIsland.box, 4.1);
  const ids = [...world.regions.map((r) => `hy-r${r.id}`), ...(showSecrets ? ["hy-hidden", "hy-ruins"] : [])];
  const faces = [...world.regions.map((r) => groundOf(r.family).fill), "url(#pa-meadow)", "url(#pa-sand)"];
  const ds = [...outlines, hidden, ruins];
  return (
    <g aria-hidden transform={TG}>
      <defs>{ds.map((d, i) => <path key={i} id={i < outlines.length ? `hy-r${i}` : i === outlines.length ? "hy-hidden" : "hy-ruins"} d={d} />)}</defs>
      {/* foam: a wide soft band + a crisp white line where land meets sea */}
      <g fill="none" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={58} strokeLinejoin="round">{ids.map((id) => <use key={id} href={`#${id}`} />)}</g>
      <g fill="none" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={32} strokeLinejoin="round">{ids.map((id) => <use key={id} href={`#${id}`} />)}</g>
      {/* drop shadow onto the water, card thickness, die-cut rim, printed ground, fibre */}
      <g fill="#0F3A8A" opacity={0.35} transform="translate(10 30)">{ids.map((id) => <use key={id} href={`#${id}`} />)}</g>
      <g fill={P.dieShade} stroke={P.dieShade} strokeWidth={12} strokeLinejoin="round" transform="translate(0 18)">{ids.map((id) => <use key={id} href={`#${id}`} />)}</g>
      <g fill={P.die} stroke={P.die} strokeWidth={12} strokeLinejoin="round">{ids.map((id) => <use key={id} href={`#${id}`} />)}</g>
      {ids.map((id, i) => <use key={`f${id}`} href={`#${id}`} fill={faces[i]} />)}
      <g fill="url(#pa-fibre)">{ids.map((id) => <use key={`x${id}`} href={`#${id}`} />)}</g>
    </g>
  );
});

const BaseRoads = memo(function BaseRoads({ world, skip }: { world: World; skip: string }) {
  const keep = useMemo(() => {
    const out = new Set(skip ? skip.split("|") : []);
    return world.roads.filter((r) => !out.has(r.id));
  }, [world, skip]);
  return <g transform={TG}><PaperRoads roads={keep} lifted={false} /></g>;
});

const Bridges = memo(function Bridges({ world }: { world: World }) {
  return (
    <g aria-hidden transform={TG}>
      {world.bridges.map((b) => {
        const xs = b.tiles.map((i) => i % world.cols), ys = b.tiles.map((i) => Math.floor(i / world.cols));
        const T = world.tile;
        const x0 = Math.min(...xs) * T, x1 = (Math.max(...xs) + 1) * T, y0 = Math.min(...ys) * T, y1 = (Math.max(...ys) + 1) * T;
        const r = b.axis === "h" ? { x: x0 - 6, y: y0 + 1, w: x1 - x0 + 12, h: y1 - y0 - 2 } : { x: x0 + 1, y: y0 - 6, w: x1 - x0 - 2, h: y1 - y0 + 12 };
        return (
          <g key={b.roadId}>
            <rect x={r.x + 3} y={r.y + 6} width={r.w} height={r.h} rx={2} fill={P.shadow} opacity={0.3} />
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={2} fill={R.wood[1]} stroke={P.die} strokeWidth={3} />
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={2} fill="url(#pa-planks)" />
          </g>
        );
      })}
    </g>
  );
});

// ── stand-up props: set-pieces, biome dressing, houses, mountains, harbours ──
interface Prop { y: number; key: string; node: ReactNode }

function buildProps(world: World, showSecrets: boolean, sailing: string[]): Prop[] {
  const out: Prop[] = [];
  const put = (key: string, w: Pt, f: (x: number, y: number) => ReactNode) => {
    const p = proj(w);
    out.push({ y: p.y, key, node: f(f1(p.x), f1(p.y)) });
  };
  const T = world.tile;
  // set-pieces: the family's signature mechanism, standing on its box
  for (const r of world.regions) {
    const sp = r.setPiece, C = SET_PIECES[r.family]?.C;
    if (!sp || !C) continue;
    put(`sp-${r.id}`, { x: (sp.x + sp.w / 2) * T, y: (sp.y + sp.h) * T - 6 }, (x, y) => <C x={x} y={y} size={112} />);
  }
  // biome dressing on decor cells (thinned: one in five, stable by tile)
  world.decor.forEach((d) => {
    if (d.tile % 5 !== 0) return;
    const kit = BIOME[d.region];
    if (!kit) return;
    const b = kit[d.variant % kit.length];
    const x = (d.tile % world.cols) * T + T / 2, y = Math.floor(d.tile / world.cols) * T + T;
    put(`d-${d.tile}`, { x, y }, (px, py) => <b.C x={px} y={py} size={Math.round(b.H * 0.5 * d.scale)} />);
  });
  // cities: one house per model built on the atom
  for (const c of world.cities) c.blocks.forEach((b, i) => {
    const h = HOUSES[(i + c.node.length) % HOUSES.length];
    put(`h-${c.node}-${i}`, { x: b.x + b.w / 2, y: b.y + b.h }, (x, y) => <h.C x={x} y={y} size={Math.round(h.H * 0.42)} />);
  });
  // mountain ranges along borders no road crosses
  world.mountains.forEach((line, li) => sampleEvery(line, 76).forEach((p, i) => {
    put(`m-${li}-${i}`, p, (x, y) => <Mountains x={x} y={y + 6} size={42 + ((i + li) % 3) * 6} snow={(i + li) % 2 === 0} />);
  }));
  // harbours: a pier + up to 3 moored boats + a count badge (all compositions touching the family)
  world.harbours.forEach((h, hi) => {
    const n = Math.max(0, h.boats - (sailing.includes(h.family) ? 1 : 0));
    put(`p-${hi}`, h.pt, (x, y) => <Pier x={x - 6} y={y} size={16} length={70} />);
    for (let i = 0; i < Math.min(3, n); i++) {
      put(`b-${hi}-${i}`, { x: h.pt.x + 28 + i * 34, y: h.pt.y + 34 + (i % 2) * 18 }, (x, y) => <PaperBoat x={x} y={y} size={34} />);
    }
    if (n > 0) {
      put(`bn-${hi}`, { x: h.pt.x + 28 + Math.min(3, n) * 34, y: h.pt.y + 20 }, (x, y) => (
        <g transform={`translate(${x} ${y - 10})`}>
          <circle r={11} fill={P.die} stroke={P.ink} strokeWidth={1.6} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700} fill={P.ink}>{n}</text>
        </g>
      ));
    }
  });
  // secrets (only once the learner pans or zooms away from the framed view)
  if (showSecrets) {
    const H = world.hiddenIsland, Ru = world.ruinsIsland;
    put("fog", { x: H.box.x + H.box.w / 2, y: H.box.y + H.box.h * 0.75 }, (x, y) => <FogIsland x={x} y={y} size={86} />);
    put("dragon", H.dragons, (x, y) => <PaperDragon x={x} y={y} size={46} silhouette />);
    Ru.names.forEach((id, i) => {
      const p = Ru.slots[i];
      const r = RUINS.find((q) => q.id === id);
      if (!p || !r) return;
      put(`ru-${id}`, p, (x, y) => (
        <g data-secret={`ruin:${id}`} className={s.node} role="button" tabIndex={0} aria-label={`Ruin: ${r.name}`}>
          <Ruins x={x} y={y} size={34} />
          <title>{`${r.name} — ${r.epitaph}`}</title>
        </g>
      ));
    });
    H.names.forEach((id, i) => {
      const p = H.slots[i];
      const m = NEXT_ERA.find((q) => q.id === id);
      if (!p) return;
      put(`era-${id}`, p, (x, y) => (
        <g data-secret={`era:${id}`} className={s.node} role="button" tabIndex={0} aria-label={`Uncharted: ${m?.name ?? id}`}>
          <LevelSpot x={x} y={y} r={16} state="provisional" />
          <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" fontSize={16} fontWeight={700} fill={P.pencil}>?</text>
        </g>
      ));
    });
  }
  return out.sort((a, b) => a.y - b.y);
}

const Props = memo(function Props({ world, showSecrets, sailing }: { world: World; showSecrets: boolean; sailing: string }) {
  const items = useMemo(() => buildProps(world, showSecrets, sailing ? sailing.split("|") : []), [world, showSecrets, sailing]);
  return <g>{items.map((it) => <g key={it.key}>{it.node}</g>)}</g>;
});

// ── level spots (data) ──────────────────────────────────────────────────────
const Spot = memo(function Spot({ n, state, focused, capital, stations, scale, atomPx, onHover }: {
  n: WorldNode; state: EvidenceState; focused: boolean; capital: boolean; stations: number; scale: number; atomPx: number;
  onHover: (name: string | null) => void;
}) {
  const r = n.atom ? SPOT_R.atom : SPOT_R.town;
  const sz = spotScale(n.atom, scale, atomPx);
  const k = (focused ? 1.3 : 1) * sz.k;
  const c = proj(n.center);
  const label = `${n.name.replace(/_/g, " ")}${n.atom ? ", atom" : ""}, ${state === "untrained" ? "not trained yet" : state}`;
  const common = {
    "data-node": n.name, className: s.node, role: "button", tabIndex: 0, "aria-label": label,
    onPointerEnter: () => onHover(n.name), onPointerLeave: () => onHover(null),
    onFocus: () => onHover(n.name), onBlur: () => onHover(null),
  } as const;
  const fam = groundOf(n.family);
  if (sz.dot && !focused) {
    return (
      <g {...common} transform={`translate(${f1(c.x)} ${f1(c.y)})`}>
        <ellipse cx={1.5} cy={3} rx={r * 0.62 + 3} ry={(r * 0.62 + 3) * TILT} fill={P.shadow} fillOpacity={0.3} />
        <ellipse rx={r * 0.62 + 3} ry={(r * 0.62 + 3) * TILT} fill={P.die} />
        <ellipse rx={r * 0.62} ry={r * 0.62 * TILT} fill={state === "untrained" ? P.die : fam.face[2]} stroke={R.gold[2]} strokeWidth={3} className={s.ring} />
        {state === "champion" && <circle cx={r * 0.55} cy={-r * 0.5} r={4} fill={R.gold[1]} stroke={P.die} strokeWidth={1.5} />}
        <title>{label}</title>
      </g>
    );
  }
  return (
    <g {...common} transform={`translate(${f1(c.x)} ${f1(c.y - (focused ? 6 : 0))}) scale(${f1(k * 100) / 100})`}>
      {focused && (
        <ellipse rx={r + 14} ry={(r + 14) * TILT} fill="none" stroke={R.red[2]} strokeWidth={5} strokeDasharray="10 7" className={s.ring} />
      )}
      {n.atom
        ? capital
          ? <CapitalSpot name={n.name} state={state} r={r} family={n.family} />
          : <AtomSpot name={n.name} state={state} r={r} family={n.family} />
        : <LevelSpot name={n.name} state={state} r={r} />}
      {stations > 0 && (
        // station notches: one per recorded run (max 6)
        <g transform={`translate(0 ${r * TILT + 12})`}>
          <rect x={-3.5 * Math.min(6, stations) - 3} y={-3} width={7 * Math.min(6, stations) + 6} height={7} rx={2} fill={P.die} />
          {Array.from({ length: Math.min(6, stations) }, (_, i) => (
            <rect key={i} x={-3.5 * Math.min(6, stations) + i * 7} y={-1.5} width={4} height={4} fill={fam.face[3]} />
          ))}
        </g>
      )}
      <title>{label}</title>
    </g>
  );
});

// ── critter: the library cutout, walking the quest route ──────────────────
function Critter({ path, still, walkKey, training }: { path: Pt[]; still: boolean; walkKey: string; training: boolean }) {
  const line = useMemo(() => samplePolyline(path), [path]);
  const [t, setT] = useState(1);
  useEffect(() => {
    if (still || line.length < 1 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setT(1); return; }
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
  const c = proj(p);
  const pose = training ? "train" : walking ? CRITTER_WALK[Math.floor((t * line.length) / 14) % 4] : "idle";
  const facing = walking && Math.cos(p.angle) < -0.2 ? -1 : 1;
  return (
    <g data-critter="1" className={s.node} role="button" tabIndex={0} aria-label="The critter (you)">
      <CritterArt x={f1(c.x)} y={f1(c.y)} size={42} pose={pose} facing={facing} />
      <title>The critter — that is you</title>
    </g>
  );
}

// ── the whole diorama ───────────────────────────────────────────────────
export interface DioramaProps {
  world: World;
  states: Record<string, EvidenceState>;
  stations: Record<string, number>;
  focus: WorldNode | null;
  zoom: "overview" | "region" | "node";
  lineageNames: Set<string>;
  lineageRoads: Set<string>;
  /** quest route (world px): root atom → parking spot */
  quest: Pt[];
  scale: number;
  still: boolean;
  critter: { training: boolean } | null;
  ferry: { points: Pt[]; t: number; families: string[] } | null;
  trains: { points: Pt[]; t: number }[];
  /** Konami wave: start stamp + per-model delay (ms); rings run on CSS, no per-frame React */
  konami: { t0: number; schedule: Record<string, number> } | null;
  atomPx: number;
  /** show the secret islands (the learner panned / zoomed away from the framed view) */
  showSecrets: boolean;
  onHover: (name: string | null) => void;
}

export const Diorama = memo(function Diorama(p: DioramaProps) {
  const { world, states, stations, focus, zoom, lineageNames, lineageRoads, quest, scale, still } = p;
  const outlines = useMemo(() => regionOutlines(world), [world]);
  const capitals = useMemo(() => new Set(world.cities.filter((c) => c.capital).map((c) => c.node)), [world]);
  const nodeView = zoom === "node" && focus;
  const regionView = zoom === "region" && focus;
  const liftKey = nodeView ? [...lineageRoads].sort().join("|") : "";
  const liftedRoads = useMemo(() => world.roads.filter((r) => liftKey.split("|").includes(r.id)), [world, liftKey]);
  const ordered = useMemo(() => [...world.nodes].sort((a, b) => a.center.y - b.center.y), [world]);
  const A = world.camera.all;
  const spot = (n: WorldNode) => (
    <Spot key={n.name} n={n} state={states[n.name] ?? "untrained"} focused={focus?.name === n.name && zoom !== "overview"}
      capital={capitals.has(n.name)} stations={zoom === "overview" ? 0 : stations[n.name] ?? 0} scale={scale} atomPx={p.atomPx} onHover={p.onHover} />
  );
  const lifted = (n: WorldNode) => Boolean(nodeView && lineageNames.has(n.name));
  const sailing = p.ferry ? p.ferry.families.join("|") : "";
  return (
    <>
      <HybridDefs />
      <rect x={A.x - A.w} y={A.y * TILT - A.h} width={A.w * 3} height={A.h * 3} fill="url(#pa-sea)" />
      <Ground world={world} outlines={outlines} showSecrets={p.showSecrets} />
      <BaseRoads world={world} skip={liftKey} />
      <Bridges world={world} />
      <Props world={world} showSecrets={p.showSecrets} sailing={sailing} />
      <g>{ordered.filter((n) => !lifted(n) && n.name !== focus?.name).map(spot)}</g>
      {/* value step-back: darken what is out of focus (never a milky veil) */}
      {regionView && (
        <g transform={TG} fill={P.shadow} stroke={P.shadow} strokeWidth={10} opacity={0.3}>
          {world.regions.filter((r) => r.family !== focus.family).map((r) => <use key={`d${r.id}`} href={`#hy-r${r.id}`} />)}
        </g>
      )}
      {nodeView && <rect x={A.x - A.w} y={A.y * TILT - A.h} width={A.w * 3} height={A.h * 3} fill={P.shadow} opacity={0.32} />}
      <g transform={TG}>
        {nodeView && <PaperRoads roads={liftedRoads} lifted />}
        {quest.length > 1 && focus && zoom !== "overview" && (
          // the quest route: the critter's walk from the root atom, dotted in red ink
          <path d={lineD(quest)} fill="none" stroke={R.red[2]} strokeWidth={5} strokeDasharray="0.1 11" strokeLinecap="round" />
        )}
        {p.ferry && p.ferry.points.length > 1 && (
          <path d={lineD(p.ferry.points)} fill="none" stroke="#FFFFFF" strokeWidth={4} strokeDasharray="8 8" strokeLinecap="round" />
        )}
      </g>
      <g>{ordered.filter((n) => lifted(n) && n.name !== focus?.name).map(spot)}</g>
      {focus && ordered.filter((n) => n.name === focus.name).map(spot)}
      {p.ferry && p.ferry.points.length > 1 && (() => {
        const q = proj(samplePolyline(p.ferry.points).at(p.ferry.t));
        return <SteamBoat x={f1(q.x)} y={f1(q.y)} size={56} />;
      })()}
      {p.trains.map((tr, i) => {
        const q = samplePolyline(tr.points).at(tr.t);
        const c = proj(q);
        return <g key={i} aria-hidden><PaperTrain x={f1(c.x)} y={f1(c.y)} size={26} smoke={!still} /></g>;
      })}
      {p.konami && (
        <g key={p.konami.t0} aria-hidden pointerEvents="none">
          {world.nodes.map((n) => {
            const c = proj(n.center);
            const rr = (n.atom ? SPOT_R.atom : SPOT_R.town) + 8;
            return <ellipse key={n.name} cx={c.x} cy={c.y} rx={rr} ry={rr * TILT} fill="none" stroke={R.gold[1]} strokeWidth={6}
              className={s.pulse} style={{ animationDelay: `${p.konami!.schedule[n.name] ?? 0}ms` }} />;
          })}
        </g>
      )}
      {p.critter && focus && zoom !== "overview" && quest.length > 0 && (
        <Critter path={quest} still={still} walkKey={focus.name} training={p.critter.training} />
      )}
    </>
  );
});

export function boxOfPoints(pts: Pt[], pad: number): Box {
  const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y);
  const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
  return { x: x0, y: y0, w: Math.max(...xs) + pad - x0, h: Math.max(...ys) + pad - y0 };
}
