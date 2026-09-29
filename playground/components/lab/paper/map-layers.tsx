// Static SVG layers of the paper map. Each is memoised on world data so the
// camera tween (which only changes the viewBox) does not re-render them.
import { memo, useMemo, type KeyboardEvent } from "react";
import { roundedD, type Pt, type World, type WorldNode } from "@/lib/world";
import { displayName, type EvidenceState } from "@/components/lab/shared/card-model";
import { iconFor } from "@/lib/icons";
import { familyName, inkOf, PAPER } from "./encoding";
import { borders, bridgeDeck, extruded, landOutline, lineD, octagon, pickRiver, pts, ribbon, type Border } from "./geometry";
import { pieceAnchor, PIECE_TOP } from "./set-pieces";
import styles from "./paper.module.css";

// ── defs: the two runtime patterns (waves, paper fibre) ─────────────────
export function PaperDefs({ fibre }: { fibre: string | null }) {
  return (
    <defs>
      <pattern id="paper-waves" width={28} height={14} patternUnits="userSpaceOnUse">
        <path d="M0 14 a7 7 0 0 1 14 0 a7 7 0 0 1 14 0" fill="none" stroke={PAPER.seaLight} strokeWidth={2.2} />
        <path d="M-7 7 a7 7 0 0 1 14 0 M7 7 a7 7 0 0 1 14 0 M21 7 a7 7 0 0 1 14 0" fill="none" stroke={PAPER.seaLight} strokeWidth={2.2} opacity={0.55} />
      </pattern>
      {/* felt/knit stitches for the set-pieces: rows of little Vs */}
      <pattern id="paper-knit" width={6} height={5} patternUnits="userSpaceOnUse">
        <path d="M0.5 0.5 L3 4 L5.5 0.5" fill="none" stroke="rgba(43,33,24,0.16)" strokeWidth={1.1} strokeLinecap="round" />
        <path d="M1 0 L3 3" fill="none" stroke="rgba(255,253,246,0.22)" strokeWidth={0.8} />
      </pattern>
      {fibre && (
        <pattern id="paper-fibre" width={160} height={160} patternUnits="userSpaceOnUse">
          <image href={fibre} width={160} height={160} />
        </pattern>
      )}
    </defs>
  );
}

export const SeaLayer = memo(function SeaLayer({ world }: { world: World }) {
  const { w, h } = world.camera.world;
  // extends past the world so panning never reveals an edge
  return (
    <g aria-hidden>
      <rect x={-w} y={-h} width={w * 3} height={h * 3} fill={PAPER.sea} />
      {/* 3-tone scalloped waves with white crests (art/ArtDefs pa-sea) */}
      <rect x={-w} y={-h} width={w * 3} height={h * 3} fill="url(#pa-sea)" />
    </g>
  );
});

// printed ground per family biome (art/ArtDefs patterns); others stay card stock
const GROUND: Record<string, string> = {
  perception: "url(#pa-grass)",        // striped meadow
  sequence: "url(#pa-sand)",           // dunes
};

/** Borders dressed in paper: one real river, every other shared edge a seam. */
export function borderDressing(world: World) {
  const bs = borders(world);
  const river = pickRiver(bs);
  const same = (b: Border) => river && ((b.a === river.pair[0] && b.b === river.pair[1]) || (b.a === river.pair[1] && b.b === river.pair[0]));
  const seams = bs.flatMap((b) => b.lines.filter((l) => !(same(b) && l === river!.line))
    .map((l) => ({ line: l, kind: (["generative", "structure"].includes(b.a) || ["generative", "structure"].includes(b.b) ? "wall" : "hedge") as "wall" | "hedge" })));
  // plank bridges exactly where a road crosses the river
  const crossings: { x: number; y: number; angle: number }[] = [];
  if (river) {
    const R = river.line;
    for (const road of world.roads) {
      const P = road.lanePoints.length ? road.lanePoints : road.points;
      for (let i = 1; i < P.length; i++) for (let j = 1; j < R.length; j++) {
        const hitPt = segHit(P[i - 1], P[i], R[j - 1], R[j]);
        if (hitPt && !crossings.some((c) => Math.hypot(c.x - hitPt.x, c.y - hitPt.y) < 24))
          crossings.push({ ...hitPt, angle: Math.atan2(P[i].y - P[i - 1].y, P[i].x - P[i - 1].x) });
      }
    }
  }
  return { river, seams, crossings };
}

function segHit(a: Pt, b: Pt, c: Pt, d: Pt): Pt | null {
  const r = { x: b.x - a.x, y: b.y - a.y }, q = { x: d.x - c.x, y: d.y - c.y };
  const den = r.x * q.y - r.y * q.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * q.y - (c.y - a.y) * q.x) / den, u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: a.x + r.x * t, y: a.y + r.y * t } : null;
}

export const LandLayer = memo(function LandLayer({ world, outlines, fibre }: {
  world: World; outlines: string[]; fibre: boolean;
}) {
  const land = useMemo(() => landOutline(world), [world]);
  const dress = useMemo(() => borderDressing(world), [world]);
  const riverD = dress.river ? ribbon(dress.river.line, 22, 62, 30) : null;
  return (
    <g aria-hidden>
      {/* one card for all the land: cast shadow, foam, card edge, die-cut rim */}
      <path d={land} fill={PAPER.seaDeep} opacity={0.75} transform="translate(7 11)" />
      <path d={land} fill="none" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={40} strokeLinejoin="round" />
      <path d={land} fill="none" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={22} strokeLinejoin="round" />
      <path d={land} fill="#8C7650" stroke={PAPER.die} strokeWidth={7} strokeLinejoin="round" transform="translate(0 6)" />
      <path d={land} fill={PAPER.die} stroke={PAPER.die} strokeWidth={7} strokeLinejoin="round" />
      <path d={land} fill="#6E7B55" />
      {/* the families, printed side by side */}
      {world.regions.map((r) => <path key={`f${r.id}`} d={outlines[r.id]} fill={GROUND[r.family] ?? inkOf(r.family).face} />)}
      {fibre && <path d={land} fill="url(#paper-fibre)" />}
      {/* seams: a stitched hedge or a low stone wall along every other border */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {dress.seams.map((s, i) => {
          const d = lineD(s.line);
          return s.kind === "hedge" ? (
            <g key={i}>
              <path d={d} stroke="rgba(20,30,10,0.3)" strokeWidth={15} transform="translate(2 4)" />
              <path d={d} stroke={PAPER.die} strokeWidth={16} />
              <path d={d} stroke="#3E7F3A" strokeWidth={12} />
              <path d={d} stroke="#63A945" strokeWidth={8} strokeDasharray="0.1 9" />
              <path d={d} stroke="#9ED36A" strokeWidth={3.5} strokeDasharray="0.1 9" transform="translate(-1.5 -2)" />
            </g>
          ) : (
            <g key={i}>
              <path d={d} stroke="rgba(20,20,30,0.3)" strokeWidth={13} transform="translate(2 4)" />
              <path d={d} stroke={PAPER.die} strokeWidth={14} />
              <path d={d} stroke="#8A8F9E" strokeWidth={10} />
              <path d={d} stroke="#C9CDD6" strokeWidth={10} strokeDasharray="9 3" strokeLinecap="butt" />
              <path d={d} stroke="#E8EBF0" strokeWidth={2} strokeDasharray="9 3" strokeLinecap="butt" transform="translate(-1 -3)" />
            </g>
          );
        })}
      </g>
      {/* the one real river: foam banks, blue cut paper, waves, a light stripe */}
      {riverD && (
        <g>
          <path d={riverD} fill={PAPER.die} stroke={PAPER.die} strokeWidth={10} strokeLinejoin="round" />
          <path d={riverD} fill="#FFFFFF" opacity={0.6} stroke="#FFFFFF" strokeWidth={16} strokeOpacity={0.35} strokeLinejoin="round" />
          <path d={riverD} fill="#2E7FE8" />
          <path d={riverD} fill="url(#paper-waves)" opacity={0.8} />
          <path d={lineD(dress.river!.line)} fill="none" stroke="#8CC4FF" strokeWidth={3} strokeLinecap="round" strokeDasharray="14 10" transform="translate(-2 -2)" />
        </g>
      )}
      {dress.crossings.map((c, i) => (
        <g key={`b${i}`} transform={`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)}) rotate(${(c.angle * 180 / Math.PI).toFixed(1)})`}>
          <rect x={-30} y={-9} width={60} height={18} rx={3} fill={PAPER.shadow} transform="translate(2 4)" />
          <rect x={-30} y={-9} width={60} height={18} rx={3} fill={PAPER.plank} stroke={PAPER.die} strokeWidth={3} />
          <path d="M-22 -8v16M-12 -8v16M-2 -8v16M8 -8v16M18 -8v16" stroke={PAPER.plankDark} strokeWidth={1.6} />
        </g>
      ))}
    </g>
  );
});

const CHEVRON = "M-3.6 -4 L1.8 0 L-3.6 4";

/**
 * Roads on their lanes (lanePoints), parent → child chevrons on the trunks.
 *  - primary (the child's main parent): die-cut rim, dark edge, gold core
 *  - secondary parents: a thin solid footpath, lower value
 *  - cross-family ("bridge") roads: quiet footpaths until one of their ends is
 *    in `loud` (focused / hovered family tree), then full trunks
 *  - `lineage` ids get the dotted quest route (the critter's walk)
 */
export const RoadLayer = memo(function RoadLayer({ world, lineage, only, loud }: {
  world: World; lineage: string[]; only?: string[]; loud?: string[];
}) {
  const keep = only ? new Set(only) : null;
  const hot = new Set(loud ?? []);
  const ds = world.roads.filter((r) => !keep || keep.has(r.id)).map((r) => {
    const pts = r.lanePoints?.length ? r.lanePoints : r.points;
    const cross = r.kind === "bridge";
    const trunk = r.primary && (!cross || hot.has(r.from) || hot.has(r.to));
    const raised = cross && (hot.has(r.from) || hot.has(r.to));
    return { id: r.id, d: roundedD(pts, 10), trunk: trunk || raised, chevrons: r.chevrons ?? [] };
  });
  const trail = new Set(lineage);
  const trunks = ds.filter((r) => r.trunk);
  const paths = ds.filter((r) => !r.trunk);
  return (
    <g aria-hidden fill="none" strokeLinecap="round" strokeLinejoin="round">
      {paths.map((r) => <path key={`p${r.id}`} d={r.d} stroke={PAPER.footpath} strokeWidth={2.6} opacity={0.75} />)}
      {/* raised cobble road: cast shadow, die-cut rim, dark edge, gold, cobbles, lit crown */}
      {trunks.map((r) => <path key={`s${r.id}`} d={r.d} stroke="rgba(15,10,32,0.2)" strokeWidth={20} transform="translate(3 5)" />)}
      {trunks.map((r) => <path key={`r${r.id}`} d={r.d} stroke={PAPER.die} strokeWidth={20} />)}
      {trunks.map((r) => <path key={`e${r.id}`} d={r.d} stroke="#BA5530" strokeWidth={16} />)}
      {trunks.map((r) => <path key={`g${r.id}`} d={r.d} stroke="#FFCB2E" strokeWidth={11} />)}
      {trunks.map((r) => <path key={`gc${r.id}`} d={r.d} stroke="url(#pa-cobble)" strokeWidth={11} opacity={0.6} />)}
      {trunks.map((r) => <path key={`h${r.id}`} d={r.d} stroke="#FFEB94" strokeWidth={2.2} strokeDasharray="1 14" transform="translate(-2 -3)" />)}
      {trunks.map((r) => (
        <g key={`c${r.id}`}>
          {r.chevrons.map((c, i) => (
            <path key={i} d={CHEVRON} transform={`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)}) rotate(${(c.angle * 180 / Math.PI).toFixed(1)})`}
              stroke="#7E3528" strokeWidth={2} />
          ))}
        </g>
      ))}
      {/* the quest route: ink dots on a white under-dot, parent → child walk */}
      {ds.filter((r) => trail.has(r.id)).map((r) => (
        <g key={`t${r.id}`}>
          <path d={r.d} stroke={PAPER.die} strokeWidth={6.5} strokeDasharray="0.1 10" />
          <path d={r.d} stroke={PAPER.ink} strokeWidth={3.6} strokeDasharray="0.1 10" />
        </g>
      ))}
    </g>
  );
});

export const BridgeLayer = memo(function BridgeLayer({ world, only }: { world: World; only?: string[] }) {
  // plank decks belong to the river only (LandLayer); other borders are seams
  if (!only) return null;
  return (
    <g aria-hidden>
      {world.bridges.filter((b) => !only || only.includes(b.roadId)).map((b) => {
        const r = bridgeDeck(world, b.tiles, b.axis);
        const n = Math.floor((b.axis === "h" ? r.w : r.h) / 5);
        const lines: string[] = [];
        for (let i = 1; i < n; i++) {
          lines.push(b.axis === "h"
            ? `M${r.x + i * (r.w / n)} ${r.y + 1.5}v${r.h - 3}`
            : `M${r.x + 1.5} ${r.y + i * (r.h / n)}h${r.w - 3}`);
        }
        return (
          <g key={b.roadId}>
            <rect x={r.x + 2} y={r.y + 4} width={r.w} height={r.h} rx={3} fill={PAPER.shadow} />
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={3} fill={PAPER.plank} stroke={PAPER.die} strokeWidth={3} />
            <path d={lines.join("")} stroke={PAPER.plankDark} strokeWidth={1.6} />
          </g>
        );
      })}
    </g>
  );
});

// ── level spots ─────────────────────────────────────────────────────────
const STAR = (cx: number, cy: number, r: number) => {
  const p: string[] = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.45 : r;
    p.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return p.join(" ");
};

export function Flag({ x, y, h }: { x: number; y: number; h: number }) {
  const w = h * 0.62;
  const pennant = `M${x} ${y - h} L${x + w} ${y - h + w * 0.42} L${x} ${y - h + w * 0.84} Z`;
  return (
    <g>
      <path d={`M${x} ${y} V${y - h}`} stroke={PAPER.die} strokeWidth={5.5} strokeLinecap="round" />
      <path d={pennant} fill={PAPER.die} stroke={PAPER.die} strokeWidth={5} strokeLinejoin="round" />
      <path d={`M${x} ${y} V${y - h}`} stroke={PAPER.ink} strokeWidth={2.2} strokeLinecap="round" />
      <path d={pennant} fill={PAPER.flag} />
      <polygon points={STAR(x + w * 0.36, y - h + w * 0.42, w * 0.22)} fill={PAPER.die} />
    </g>
  );
}

interface SpotStyle { top: string; side: string; face: string; faceRing?: string; sketch: boolean; glyph: string }
function spotStyle(state: EvidenceState): SpotStyle {
  if (state === "provisional") return { top: PAPER.die, side: "#E6DBC2", face: PAPER.die, sketch: true, glyph: PAPER.pencil };
  if (state === "untrained") return { top: PAPER.gold, side: PAPER.goldSide, face: PAPER.die, faceRing: PAPER.face, sketch: false, glyph: PAPER.face };
  return { top: PAPER.gold, side: PAPER.goldSide, face: PAPER.face, sketch: false, glyph: PAPER.die };
}

function Tier({ cx, cy, r, t, st, faceK }: { cx: number; cy: number; r: number; t: number; st: SpotStyle; faceK: number }) {
  const body = pts(extruded(cx, cy, r, t));
  const top = pts(octagon(cx, cy, r));
  const face = pts(octagon(cx, cy, r * faceK));
  const sk = st.sketch ? { stroke: PAPER.pencil, strokeWidth: 2, strokeDasharray: "4 3", strokeLinejoin: "round" as const } : {};
  return (
    <>
      <polygon points={body} fill={st.side} {...sk} />
      <polygon points={top} fill={st.top} {...sk} />
      <polygon points={face} fill={st.face} stroke={st.faceRing ?? (st.sketch ? PAPER.pencil : undefined)}
        strokeWidth={st.faceRing ? 3 : st.sketch ? 1.8 : undefined} strokeDasharray={st.sketch ? "3 3" : undefined} />
    </>
  );
}

/** The model's species emblem (lib/icons) as a die-cut glyph on the face. */
export function Emblem({ name, cx, cy, size, color, rim = true }: { name: string; cx: number; cy: number; size: number; color: string; rim?: boolean }) {
  const Icon = iconFor(name);
  if (!Icon) return null;
  const k = 24 / size;               // icon units per world px
  return (
    <>
      {rim && <Icon x={cx - size / 2} y={cy - size / 2 + 0.8} width={size} height={size} color={PAPER.ink} strokeWidth={3.6 * k} opacity={0.3} aria-hidden />}
      <Icon x={cx - size / 2} y={cy - size / 2} width={size} height={size} color={color} strokeWidth={2 * k} aria-hidden />
    </>
  );
}

// Spot radii (world px). Round 2: the world is 2.4× roomier, so spots draw
// larger than their footprint (labels keep an 8px screen gap from it).
export const SPOT_R = { atom: 34, derived: 20 } as const;

export const Spot = memo(function Spot({ node, state, focused, onSelect, onHover, ghost = false, k = 1, flag = true, bare = false }: {
  /** the art is drawn elsewhere (diorama billboard): keep only the hit area, focus plinth and keyboard ring */
  bare?: boolean;
  node: WorldNode; state: EvidenceState; focused: boolean;
  /** false: the champion flag is drawn elsewhere (the diorama's stand-up billboard) */
  flag?: boolean;
  /** semantic zoom factor about the centre (atoms grow at the whole-map view, derived shrink to dots) */
  k?: number;
  onSelect: (name: string) => void; onHover?: (name: string | null) => void;
  /** a non-interactive copy drawn above the dimmed map */
  ghost?: boolean;
}) {
  const { x: cx, y: cy } = node.center;
  const st = spotStyle(state);
  const R = node.atom ? SPOT_R.atom : SPOT_R.derived;
  const T = node.atom ? 10 : 6;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(node.name); }
  };
  const label = `${displayName(node.name)}${node.atom ? ", atom" : ""}, ${state === "untrained" ? "not trained yet" : state}`;
  const faceY = node.atom ? cy - 8 : cy;
  const glyph = node.atom ? 24 : 17;
  // the focused spot is the loudest object: 1.3× on a die-cut plinth
  const f = (focused ? 1.3 : 1) * k;
  const zoom = f !== 1 ? `translate(${cx} ${cy}) scale(${f}) translate(${-cx} ${-cy})` : undefined;
  return (
    <g role={ghost ? undefined : "button"} tabIndex={ghost ? undefined : 0} aria-label={ghost ? undefined : label} aria-hidden={ghost || undefined}
      data-node={ghost ? undefined : node.name} className={ghost ? undefined : styles.spot} onKeyDown={ghost ? undefined : onKey}
      onPointerEnter={onHover ? () => onHover(node.name) : undefined} onPointerLeave={onHover ? () => onHover(null) : undefined}
      onFocus={onHover ? () => onHover(node.name) : undefined} onBlur={onHover ? () => onHover(null) : undefined}>
      <g transform={zoom}>
        {focused && (
          <>
            <polygon points={pts(extruded(cx + 4, cy + 7, R + 12, T + 4))} fill={PAPER.shadow} />
            <polygon points={pts(extruded(cx, cy, R + 12, T + 4))} fill={PAPER.die} stroke={PAPER.ink} strokeWidth={3} strokeLinejoin="round" />
          </>
        )}
        {!focused && !bare && <polygon points={pts(extruded(cx + 3, cy + 5, R, T))} fill={PAPER.shadow} />}
        {!ghost && <polygon className={styles.ring} points={pts(octagon(cx, cy, R + 8))} fill="none" stroke={PAPER.ink} strokeWidth={3.5} strokeDasharray="6 4" />}
        {bare && <polygon points={pts(octagon(cx, cy, R + 4))} fill="rgba(0,0,0,0)" />}
        {!bare && <g className={styles.lift}>
          <polygon points={pts(extruded(cx, cy, R, T))} fill={PAPER.die} stroke={PAPER.die} strokeWidth={5.5} strokeLinejoin="round" />
          <Tier cx={cx} cy={cy} r={R} t={T} st={st} faceK={node.atom ? 0.86 : 0.74} />
          {node.atom && <Tier cx={cx} cy={cy - 8} r={24} t={6} st={st} faceK={0.8} />}
          <Emblem name={node.name} cx={cx} cy={faceY} size={glyph} color={st.glyph} rim={st.glyph === PAPER.die} />
          {state === "champion" && (
            // champion seal: a gold star sticker on the rim, top-right
            <polygon points={STAR(cx + R * 0.74, cy - R * 0.66, node.atom ? 10 : 7.5)} fill={PAPER.gold}
              stroke={PAPER.die} strokeWidth={2.4} strokeLinejoin="round" paintOrder="stroke" />
          )}
          {flag && state === "champion" && (
            <g className={focused ? undefined : styles.hoverFlag}>
              <Flag x={cx + R * 0.74} y={cy - R * 0.5} h={node.atom ? 36 : 26} />
            </g>
          )}
        </g>}
      </g>
    </g>
  );
});

export const LabelLayer = memo(function LabelLayer({ world, minFont, focus, only }: {
  world: World; minFont: number; focus: string | null; only?: string[];
}) {
  const keep = only ? new Set(only) : null;
  const shown = world.labels.filter((l) => (l.font >= minFont || l.node === focus) && (!keep || keep.has(l.node)));
  return (
    <g aria-hidden pointerEvents="none">
      {shown.map((l) => {
        const atom = l.font === 15;
        const hot = l.node === focus;
        return (
          <g key={l.node}>
            <rect x={l.box.x + 1} y={l.box.y + 2.5} width={l.box.w} height={l.box.h} rx={6} fill={PAPER.shadow} />
            <rect x={l.box.x} y={l.box.y} width={l.box.w} height={l.box.h} rx={6}
              fill={hot ? PAPER.ink : PAPER.die} />
            <text x={l.box.x + l.box.w / 2} y={l.box.y + l.box.h / 2 + 0.5} textAnchor="middle" dominantBaseline="central"
              fontSize={l.font} fontWeight={atom ? 600 : 500} fill={hot ? PAPER.die : PAPER.ink}>
              {displayName(l.text)}
            </text>
          </g>
        );
      })}
    </g>
  );
});

/** Region signs staked beside each set-piece; sized in screen px. The sign
 *  takes the first place (right, left, below, above the piece) that covers no
 *  set-piece, visible name tag or level spot. */
export function SignLayer({ world, scale, minFont }: { world: World; scale: number; minFont: number }) {
  const px = 18 / Math.max(scale, 0.05);
  const blocks = [
    ...world.labels.filter((l) => l.font >= minFont).map((l) => l.box),
    ...world.regions.filter((r) => r.setPiece).map((r) => {
      const p = pieceAnchor(world, r);
      const t = (PIECE_TOP[r.family] ?? 100) * p.s;
      return { x: p.x - 50 * p.sx, y: p.y - t, w: 100 * p.sx, h: t };
    }),
    ...world.nodes.map((n) => ({ x: n.foot.x * world.tile - 4, y: n.foot.y * world.tile - 10, w: n.foot.w * world.tile + 8, h: n.foot.h * world.tile + 14 })),
  ];
  const overlap = (a: { x: number; y: number; w: number; h: number }) =>
    blocks.reduce((sum, b) => {
      const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      return sum + (w > 0 && h > 0 ? w * h : 0);
    }, 0);
  return (
    <g aria-hidden pointerEvents="none">
      {world.regions.filter((r) => r.setPiece).map((r) => {
        const a = pieceAnchor(world, r);
        const text = familyName(r.family);
        const w = text.length * px * 0.56 + px * 1.3;
        const h = px * 1.55;
        const tall = (PIECE_TOP[r.family] ?? 100) * a.s;
        const half = 50 * a.sx;
        const midY = a.y - tall / 2 - h / 2;
        // beside the piece (right, left), then below, then above — never on it
        const spots = [
          { x: a.x + half + 8 + w / 2, y: midY },
          { x: a.x - half - 8 - w / 2, y: midY },
          { x: a.x, y: a.y + 8 },
          { x: a.x, y: a.y - tall - h - 6 },
        ];
        let pick = spots[0], best = Infinity;
        for (const c of spots) {
          const o = overlap({ x: c.x - w / 2, y: c.y, w, h });
          if (o < best - 1) { best = o; pick = c; }
          if (o === 0) break;
        }
        const x = pick.x, y = pick.y;
        return (
          <g key={r.id}>
            <rect x={x - w / 2 + px * 0.12} y={y + px * 0.22} width={w} height={h} rx={px * 0.35} fill={PAPER.shadow} />
            <rect x={x - w / 2} y={y} width={w} height={h} rx={px * 0.35} fill={inkOf(r.family).edge}
              stroke={PAPER.die} strokeWidth={px * 0.22} />
            <text x={x} y={y + h / 2 + px * 0.05} textAnchor="middle" dominantBaseline="central" fontSize={px}
              className={styles.display} fill={PAPER.die}>{text}</text>
          </g>
        );
      })}
    </g>
  );
}
