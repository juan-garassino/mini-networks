"use client";

// The diorama: the world contract painted as stacked cardstock. Every
// cutout = cast shadow → card edge (thickness) → die-cut white rim → face.
// Positions come ONLY from lib/world; this file never invents a coordinate.
// Split into memoised layers so camera tweens don't re-render the land.
import { memo, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { T, roundedD, samplePolyline, type Pt, type Road, type World, type WorldNode } from "@/lib/world";
import { CRITTER } from "@/components/lab/shared/critter";
import { displayName, type EvidenceState } from "@/components/lab/shared/card-model";
import { symbolFor } from "@/lib/blueprint";
import { PAPER, familyInk } from "./palette.ts";
import s from "./hybrid.module.css";

const TILE = 16;
const RIM = 5;       // die-cut rim, px beyond the face
const EDGE = 4;      // card thickness, px
const CAST = 10;     // cast-shadow offset, px

// ── geometry helpers (pure) ────────────────────────────────────────────────

/** Row-run rectangles of a tile predicate, as one SVG path. */
function tilesPath(world: World, keep: (i: number) => boolean): string {
  let d = "";
  for (let y = 0; y < world.rows; y++) {
    let x = 0;
    while (x < world.cols) {
      if (!keep(y * world.cols + x)) { x++; continue; }
      let e = x + 1;
      while (e < world.cols && keep(y * world.cols + e)) e++;
      d += `M${x * TILE} ${y * TILE}h${(e - x) * TILE}v${TILE}h${-(e - x) * TILE}z`;
      x = e;
    }
  }
  return d;
}

const isWater = (t: number) => t === T.SEA || t === T.RIVER || t === T.BRIDGE;

export function landPaths(world: World): string[] {
  return world.regions.map((r) =>
    tilesPath(world, (i) => world.regionOf[i] === r.id && !isWater(world.terrain[i])));
}

function octagon(cx: number, cy: number, r: number): string {
  const k = r * 0.4142;
  return `M${cx - k} ${cy - r}H${cx + k}L${cx + r} ${cy - k}V${cy + k}L${cx + k} ${cy + r}H${cx - k}L${cx - r} ${cy + k}V${cy - k}Z`;
}

const pts = (p: Pt[]) => roundedD(p, 12);

// ── layers ────────────────────────────────────────────────────────────────

/** Sea card + fibre tile, generated once at runtime (no bitmap). */
function SeaDefs() {
  return (
    <defs>
      <pattern id="hy-fibre" width="64" height="64" patternUnits="userSpaceOnUse">
        <path d="M4 10q10-3 18 1M34 28q9 3 16-2M12 44q7-4 15 0M44 54q8 2 14-3M52 8q5 3 10 1M22 60q4-2 8 0"
          stroke={PAPER.seaDeep} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.35" />
      </pattern>
    </defs>
  );
}

export const Land = memo(function Land({ world }: { world: World }) {
  const paths = useMemo(() => landPaths(world), [world]);
  const river = useMemo(() => tilesPath(world, (i) => world.terrain[i] === T.RIVER || world.terrain[i] === T.BRIDGE), [world]);
  const W = world.cols * TILE, H = world.rows * TILE;
  const round = { strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  return (
    <g>
      <SeaDefs />
      <rect x={-W} y={-H} width={W * 3} height={H * 3} fill={PAPER.sea} />
      <rect x={-W} y={-H} width={W * 3} height={H * 3} fill="url(#hy-fibre)" />
      {/* 1 · cast shadow of every cutout onto the sea card */}
      <g opacity="0.28" transform={`translate(2 ${CAST})`}>
        {paths.map((d, i) => <path key={i} d={d} fill={PAPER.shadow} stroke={PAPER.shadow} strokeWidth={RIM * 2 + 4} {...round} />)}
      </g>
      {/* 2 · card thickness, in the family's edge colour */}
      <g transform={`translate(0 ${EDGE})`}>
        {world.regions.map((r, i) => {
          const ink = familyInk(r.family);
          return <path key={i} d={paths[i]} fill={ink.edge} stroke={ink.edge} strokeWidth={RIM * 2} {...round} />;
        })}
      </g>
      {/* 3 · rivers: the channel between two neighbouring families */}
      <path d={river} fill={PAPER.river} />
      {/* 4 · die-cut rims, then 5 · faces */}
      {paths.map((d, i) => <path key={`r${i}`} d={d} fill={PAPER.rim} stroke={PAPER.rim} strokeWidth={RIM * 2} {...round} />)}
      {world.regions.map((r, i) => {
        const ink = familyInk(r.family);
        return <path key={`f${i}`} d={paths[i]} fill={ink.card} stroke={ink.card} strokeWidth={2} {...round} />;
      })}
    </g>
  );
});

/** Decor props on world.decor cells — one silhouette per family (biome). */
export const Decor = memo(function Decor({ world }: { world: World }) {
  return (
    <g>
      {world.decor.map((d) => {
        const x = (d.tile % world.cols) * TILE + TILE / 2;
        const y = Math.floor(d.tile / world.cols) * TILE + TILE / 2;
        const ink = familyInk(d.region);
        return (
          <g key={d.tile} transform={`translate(${x} ${y}) scale(${d.scale})`}>
            <path d={PROP[d.region] ?? PROP.structure} transform="translate(0 2)" fill={ink.edge} opacity="0.55" />
            <path d={PROP[d.region] ?? PROP.structure} fill={ink.edge} stroke={PAPER.rim} strokeWidth={1.6} strokeLinejoin="round" />
          </g>
        );
      })}
    </g>
  );
});

// biome silhouettes, centred on (0,0), ~12px
const PROP: Record<string, string> = {
  perception: "M-6 3a6 6 0 0 1 3-8a5 5 0 0 1 7 0a5 5 0 0 1 2 8z",                  // bush
  sequence: "M-5 5l1-11l2 11zM-1 5l1-13l2 13zM3 5l1-10l2 10z",                        // reeds
  generative: "M0-6a3 3 0 0 1 3 3a3 3 0 0 1 0 6a3 3 0 0 1-6 0a3 3 0 0 1 0-6a3 3 0 0 1 3-3z", // flower
  representation: "M0-7l5 5l-2 7h-6l-2-7z",                                            // crystal
  decision: "M0-8l6 10h-4v3h-4v-3h-4z",                                               // pine
  structure: "M-6 4l1-6l4-3l5 1l2 5l-2 3z",                                           // rock
};

/** Width of a region sign (px), shared with the chrome's pointing hand. */
export const signWidth = (label: string) => Math.max(label.length * 9.2 + 20, 64);

/** Region sign on each set-piece box: family name + model count. */
export const Signs = memo(function Signs({ world, counts, grow = 1 }: {
  world: World; counts: Record<string, number>;
  /** counter-scale so sign lettering never prints under 13px on screen */
  grow?: number;
}) {
  return (
    <g style={{ fontFamily: "var(--font-hybrid-round), system-ui" }}>
      {world.regions.map((r) => {
        const sp = r.setPiece;
        if (!sp) return null;
        const ink = familyInk(r.family);
        const cx = (sp.x + sp.w / 2) * TILE, cy = (sp.y + sp.h / 2) * TILE;
        const name = ink.label;
        const w = signWidth(name), h = 40;
        return (
          <g key={r.id} transform={`translate(${cx} ${cy}) scale(${grow})`}>
            {/* post */}
            <rect x={-3} y={h / 2 - 4} width={6} height={14} fill={PAPER.plank} stroke={PAPER.rim} strokeWidth={1.5} />
            <rect x={-w / 2 + 2} y={-h / 2 + 5} width={w} height={h} rx={6} fill={PAPER.shadow} opacity={0.3} />
            <rect x={-w / 2} y={-h / 2 + EDGE - 1} width={w} height={h} rx={6} fill={ink.edge} />
            <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={6} fill={PAPER.rim} stroke={ink.edge} strokeWidth={2} />
            <text y={-4} textAnchor="middle" fontSize={16} fontWeight={600} fill={PAPER.ink}>{name}</text>
            <text y={13} textAnchor="middle" fontSize={13} fill={ink.edge} fontWeight={600}>
              {counts[r.family] ?? 0} models
            </text>
          </g>
        );
      })}
    </g>
  );
});

export const Roads = memo(function Roads({ roads }: { roads: Road[] }) {
  const sorted = useMemo(() => [...roads].sort((a, b) => Number(a.kind === "secondary") - Number(b.kind === "secondary")).reverse(), [roads]);
  const round = { fill: "none", strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  return (
    <g>
      {sorted.map((r) => {
        const thin = r.kind === "secondary";
        const d = pts(r.points);
        return (
          <g key={r.id}>
            <path d={d} {...round} stroke={PAPER.rim} strokeWidth={thin ? 8 : 12} />
            <path d={d} {...round} stroke={PAPER.roadCase} strokeWidth={thin ? 5 : 8} />
            <path d={d} {...round} stroke={PAPER.road} strokeWidth={thin ? 2.5 : 5} />
          </g>
        );
      })}
    </g>
  );
});

/** Plank bridges where a cross-family road crosses a river channel. */
export const Bridges = memo(function Bridges({ world }: { world: World }) {
  return (
    <g>
      {world.bridges.map((b) => {
        const xs = b.tiles.map((t) => (t % world.cols) * TILE), ys = b.tiles.map((t) => Math.floor(t / world.cols) * TILE);
        const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs) + TILE, y1 = Math.max(...ys) + TILE;
        const h = b.axis === "h";
        const bx = h ? x0 - 6 : x0 + 1, by = h ? y0 + 1 : y0 - 6;
        const bw = h ? x1 - x0 + 12 : TILE - 2, bh = h ? TILE - 2 : y1 - y0 + 12;
        const n = Math.max(2, Math.round((h ? bw : bh) / 5));
        return (
          <g key={b.roadId}>
            <rect x={bx} y={by + EDGE} width={bw} height={bh} rx={2} fill="#7d5130" />
            <rect x={bx} y={by} width={bw} height={bh} rx={2} fill={PAPER.plank} stroke={PAPER.rim} strokeWidth={1.5} />
            {Array.from({ length: n - 1 }, (_, i) => {
              const k = ((i + 1) / n) * (h ? bw : bh);
              return h
                ? <line key={i} x1={bx + k} y1={by + 1} x2={bx + k} y2={by + bh - 1} stroke="#7d5130" strokeWidth={1} />
                : <line key={i} x1={bx + 1} y1={by + k} x2={bx + bw - 1} y2={by + k} stroke="#7d5130" strokeWidth={1} />;
            })}
          </g>
        );
      })}
    </g>
  );
});

/** The focused model's walk home (pathToAtom), painted over its roads. */
export function WalkHome({ points }: { points: Pt[] }) {
  if (points.length < 2) return null;
  return (
    <path d={pts(points)} fill="none" stroke={PAPER.walk} strokeWidth={5} strokeLinecap="round"
      strokeLinejoin="round" strokeDasharray="1 9" />
  );
}

// ── nodes ────────────────────────────────────────────────────────────────

const FLAG: Record<EvidenceState, { fill: string; big: boolean } | null> = {
  champion: { fill: PAPER.flag, big: true },
  provisional: { fill: "#ffcd75", big: false },
  trained: { fill: PAPER.rim, big: false },
  untrained: null,
};

function Flag({ x, y, state }: { x: number; y: number; state: EvidenceState }) {
  const f = FLAG[state];
  if (!f) return null;
  const h = f.big ? 22 : 16, w = f.big ? 14 : 10;
  return (
    <g transform={`translate(${x} ${y})`}>
      <line x1={0} y1={0} x2={0} y2={-h} stroke={PAPER.ink} strokeWidth={2} strokeLinecap="round" />
      <path d={`M1 ${-h}l${w} ${w * 0.35}l${-w} ${w * 0.7}z`} fill={f.fill} stroke={PAPER.ink} strokeWidth={1.2} strokeLinejoin="round" />
    </g>
  );
}

export const Nodes = memo(function Nodes({
  nodes, states, focus, onOpen,
}: {
  nodes: WorldNode[];
  states: Record<string, EvidenceState>;
  focus: string | null;
  onOpen: (name: string) => void;
}) {
  const key = (name: string) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onOpen(name); }
  };
  // focused node last so it sits on top
  const ordered = useMemo(() => [...nodes].sort((a, b) => Number(a.name === focus) - Number(b.name === focus)), [nodes, focus]);
  return (
    <g>
      {ordered.map((n) => {
        const ink = familyInk(n.family);
        const { x, y } = n.center;
        const on = n.name === focus;
        const st = states[n.name] ?? "untrained";
        const lift = on ? -4 : 0;
        const label = `${displayName(n.name)}, ${n.atom ? "atom" : `generation ${n.depth + 1}`}`;
        if (n.atom) {
          const r = 27;
          return (
            <g key={n.name} data-node={n.name} className={s.node} tabIndex={0} role="button" aria-label={label}
              onClick={() => onOpen(n.name)} onKeyDown={key(n.name)}>
              <path d={octagon(x + 2, y + CAST, r + 2)} fill={PAPER.shadow} opacity={0.3} />
              <g transform={`translate(0 ${lift})`}>
                <path d={octagon(x, y + EDGE + 1, r)} fill={ink.edge} stroke={ink.edge} strokeWidth={6} strokeLinejoin="round" />
                <path className={s.ring} d={octagon(x, y, r)} fill={ink.swatch} stroke={on ? PAPER.walk : PAPER.rim} strokeWidth={on ? 6 : 5} strokeLinejoin="round" />
                <path d={octagon(x, y, r - 7)} fill="none" stroke={PAPER.rim} strokeWidth={1.5} opacity={0.8} />
                <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" fontSize={20} fontWeight={700}
                  fill={PAPER.ink} style={{ fontFamily: "var(--font-hybrid-round), system-ui" }}>{symbolFor(n.name)}</text>
                <Flag x={x + r - 4} y={y - r + 6} state={st} />
              </g>
              <title>{label}</title>
            </g>
          );
        }
        const r = 11;
        return (
          <g key={n.name} data-node={n.name} className={s.node} tabIndex={0} role="button" aria-label={label}
            onClick={() => onOpen(n.name)} onKeyDown={key(n.name)}>
            <circle cx={x + 2} cy={y + 7} r={r + 3} fill={PAPER.shadow} opacity={0.28} />
            <g transform={`translate(0 ${lift})`}>
              <circle cx={x} cy={y + 3} r={r + 2} fill={ink.edge} />
              <circle className={s.ring} cx={x} cy={y} r={r} fill={PAPER.rim} stroke={on ? PAPER.walk : ink.edge} strokeWidth={on ? 6 : 4} />
              <circle cx={x} cy={y} r={4} fill={ink.swatch} stroke={ink.edge} strokeWidth={1} />
              <Flag x={x + r - 2} y={y - r + 3} state={st} />
            </g>
            <title>{label}</title>
          </g>
        );
      })}
    </g>
  );
});

/** Paper name tags at world.labels boxes. Hidden when < 13px on screen. */
export const Labels = memo(function Labels({ world, minFont, focus }: { world: World; minFont: number; focus: string | null }) {
  return (
    <g style={{ fontFamily: "var(--font-hybrid-round), system-ui" }} pointerEvents="none">
      {world.labels.map((l) => {
        if (l.font < minFont && l.node !== focus) return null;
        const on = l.node === focus;
        return (
          <g key={l.node}>
            <rect x={l.box.x + 1} y={l.box.y + 3} width={l.box.w} height={l.box.h} rx={5} fill={PAPER.shadow} opacity={0.22} />
            <rect x={l.box.x} y={l.box.y} width={l.box.w} height={l.box.h} rx={5}
              fill={on ? PAPER.walk : PAPER.rim} />
            <text x={l.box.x + l.box.w / 2} y={l.box.y + l.box.h / 2 + 0.5} fontSize={l.font}
              fontWeight={l.font === 15 || on ? 600 : 500} textAnchor="middle" dominantBaseline="central" fill={PAPER.ink}>
              {displayName(l.text)}
            </text>
          </g>
        );
      })}
    </g>
  );
});

// ── the critter (paper cutout of the shared silhouette) ───────────────────

/**
 * Walks `path` (atom → focused node) once at CRITTER.walkSpeed, then parks.
 * Under still it is drawn parked at the end, no animation at all.
 */
export function Critter({ path, still, walkKey, stopShort, park }: {
  path: Pt[]; still: boolean; walkKey: string;
  /** px before the path end where it stops (the node's radius + a step) */
  stopShort: number;
  /** offset used when the walk is too short to stop on the road (atoms) */
  park: Pt;
}) {
  const line = useMemo(() => samplePolyline(path), [path]);
  const [t, setT] = useState(1);
  useEffect(() => {
    if (still || line.length < 1) { setT(1); return; }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setT(1); return; }
    const dur = Math.max(450, (line.length / CRITTER.walkSpeed) * 1000);
    const t0 = performance.now();
    let raf = 0;
    setT(0);
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      setT(k);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [line, still, walkKey]);

  if (!path.length) return null;
  const onRoad = line.length > stopShort + 8;
  const end = onRoad ? 1 - stopShort / line.length : 1;
  const p = line.at(t * end);
  const walking = t < 1;
  const bob = walking ? -Math.abs(Math.sin((t * line.length) / 9)) * 4 : 0;
  const face = walking && Math.cos(p.angle) < 0 ? -1 : 1;
  const k = 0.3; // 120×140 → 36×42 px
  // parked on its road just short of the stop; atoms (no road) step aside
  const off = walking || onRoad ? { x: 0, y: 0 } : park;
  return (
    <g transform={`translate(${p.x + off.x} ${p.y + off.y + bob})`} pointerEvents="none">
      <ellipse cx={0} cy={2} rx={13} ry={4} fill={PAPER.shadow} opacity={0.3} />
      <g transform={`scale(${k * face} ${k}) translate(-60 -124)`}>
        <path d={CRITTER.body} fill={PAPER.rim} stroke={PAPER.rim} strokeWidth={18} strokeLinejoin="round" />
        <path d={CRITTER.antenna} stroke={PAPER.rim} strokeWidth={16} strokeLinecap="round" fill="none" />
        {CRITTER.feet.map((f, i) => <ellipse key={i} cx={f.cx} cy={f.cy} rx={14} ry={9} fill={PAPER.ink} />)}
        <path d={CRITTER.body} fill="#f7f1e2" stroke={PAPER.ink} strokeWidth={6} />
        <path d={CRITTER.antenna} stroke={PAPER.ink} strokeWidth={5} strokeLinecap="round" fill="none" />
        <circle {...CRITTER.antennaTip} fill="#ef7d57" stroke={PAPER.ink} strokeWidth={4} />
        <circle {...CRITTER.eye} fill="#fff" stroke={PAPER.ink} strokeWidth={5} />
        <circle {...CRITTER.pupil} fill={PAPER.ink} />
        <path d={CRITTER.smile} stroke={PAPER.ink} strokeWidth={5} strokeLinecap="round" fill="none" />
      </g>
    </g>
  );
}
