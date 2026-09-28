// Static SVG layers of the paper map. Each is memoised on world data so the
// camera tween (which only changes the viewBox) does not re-render them.
import { memo, type KeyboardEvent } from "react";
import { roundedD, type World, type WorldNode } from "@/lib/world";
import { symbolFor } from "@/lib/blueprint";
import { displayName, type EvidenceState } from "@/components/lab/shared/card-model";
import { familyName, inkOf, PAPER } from "./encoding";
import { bridgeDeck, extruded, octagon, pts } from "./geometry";
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
      <rect x={-w} y={-h} width={w * 3} height={h * 3} fill="url(#paper-waves)" />
    </g>
  );
});

export const LandLayer = memo(function LandLayer({ world, outlines, fibre }: {
  world: World; outlines: string[]; fibre: boolean;
}) {
  return (
    <g aria-hidden>
      {/* cast shadow on the sea, card edge, die-cut rim, face, fibre */}
      {world.regions.map((r) => <path key={`s${r.id}`} d={outlines[r.id]} fill={PAPER.seaDeep} opacity={0.75} transform="translate(7 11)" />)}
      {world.regions.map((r) => <path key={`e${r.id}`} d={outlines[r.id]} fill={inkOf(r.family).edge} stroke={PAPER.die} strokeWidth={7} strokeLinejoin="round" transform="translate(0 6)" />)}
      {world.regions.map((r) => <path key={`r${r.id}`} d={outlines[r.id]} fill={PAPER.die} stroke={PAPER.die} strokeWidth={7} strokeLinejoin="round" />)}
      {world.regions.map((r) => <path key={`f${r.id}`} d={outlines[r.id]} fill={inkOf(r.family).face} />)}
      {fibre && <path d={outlines.join("")} fill="url(#paper-fibre)" />}
    </g>
  );
});

export const RoadLayer = memo(function RoadLayer({ world, lineage, only }: { world: World; lineage: string[]; only?: string[] }) {
  const keep = only ? new Set(only) : null;
  const ds = world.roads.filter((r) => !keep || keep.has(r.id)).map((r) => ({ id: r.id, d: roundedD(r.points, 10), primary: r.primary }));
  const trail = new Set(lineage);
  return (
    <g aria-hidden fill="none" strokeLinecap="round" strokeLinejoin="round">
      {ds.map((r) => <path key={`s${r.id}`} d={r.d} stroke={PAPER.shadow} strokeWidth={r.primary ? 15 : 10} transform="translate(2 4)" />)}
      {ds.map((r) => <path key={`e${r.id}`} d={r.d} stroke={PAPER.goldEdge} strokeWidth={r.primary ? 14 : 9} />)}
      {ds.map((r) => <path key={`g${r.id}`} d={r.d} stroke={PAPER.gold} strokeWidth={r.primary ? 9 : 5} />)}
      {ds.filter((r) => trail.has(r.id)).map((r) => (
        <path key={`t${r.id}`} d={r.d} stroke={PAPER.flag} strokeWidth={3.2} strokeDasharray="7 6" />
      ))}
    </g>
  );
});

export const BridgeLayer = memo(function BridgeLayer({ world, only }: { world: World; only?: string[] }) {
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

function Flag({ x, y, h }: { x: number; y: number; h: number }) {
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

interface SpotStyle { top: string; side: string; face: string; faceRing?: string; sketch: boolean }
function spotStyle(state: EvidenceState): SpotStyle {
  if (state === "provisional") return { top: PAPER.die, side: "#E6DBC2", face: PAPER.die, sketch: true };
  if (state === "untrained") return { top: PAPER.gold, side: PAPER.goldSide, face: PAPER.die, faceRing: PAPER.face, sketch: false };
  return { top: PAPER.gold, side: PAPER.goldSide, face: PAPER.face, sketch: false };
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

export const Spot = memo(function Spot({ node, state, focused, onSelect }: {
  node: WorldNode; state: EvidenceState; focused: boolean; onSelect: (name: string) => void;
}) {
  const { x: cx, y: cy } = node.center;
  const st = spotStyle(state);
  const R = node.atom ? 29 : 14.5;
  const T = node.atom ? 9 : 5;
  const lift = focused ? -4 : 0;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(node.name); }
  };
  const label = `${displayName(node.name)}${node.atom ? ", atom" : ""}, ${state === "untrained" ? "not trained yet" : state}`;
  return (
    <g role="button" tabIndex={0} aria-label={label} data-node={node.name} className={styles.spot} onKeyDown={onKey}>
      {/* cast shadow + die-cut rim of the whole thick spot */}
      <polygon points={pts(extruded(cx + 3, cy + 5, R, T))} fill={PAPER.shadow} />
      {focused && <polygon points={pts(extruded(cx, cy + lift, R + 9, T))} fill={PAPER.die} stroke={PAPER.ink} strokeWidth={3.5} strokeLinejoin="round" />}
      <polygon className={styles.ring} points={pts(octagon(cx, cy + lift, R + 8))} fill="none" stroke={PAPER.flag} strokeWidth={3.5} />
      <g className={styles.lift}>
        <polygon points={pts(extruded(cx, cy + lift, R, T))} fill={PAPER.die} stroke={PAPER.die} strokeWidth={5.5} strokeLinejoin="round" />
        <Tier cx={cx} cy={cy + lift} r={R} t={T} st={st} faceK={node.atom ? 0.86 : 0.64} />
        {node.atom && (
          <>
            <Tier cx={cx} cy={cy + lift - 7} r={19} t={6} st={st} faceK={0.7} />
            <text x={cx} y={cy + lift - 6.5} textAnchor="middle" dominantBaseline="central" fontSize={13}
              className={styles.display} fill={st.face === PAPER.face ? PAPER.die : st.sketch ? PAPER.pencil : PAPER.face}>
              {symbolFor(node.name)}
            </text>
          </>
        )}
        {state === "champion" && <Flag x={cx + R * 0.62} y={cy + lift - (node.atom ? 8 : 3)} h={node.atom ? 34 : 24} />}
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

/** Region signs staked at each set-piece; sized in screen px. The sign takes
 *  the first spot (below the piece, at its foot, on its face, above it) that
 *  covers no visible name tag or level spot. */
export function SignLayer({ world, scale, minFont }: { world: World; scale: number; minFont: number }) {
  const px = 18 / Math.max(scale, 0.05);
  const blocks = [
    ...world.labels.filter((l) => l.font >= minFont).map((l) => l.box),
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
        const ys = [a.y + 6, a.y - h * 0.35, a.y - tall / 2 - h / 2, a.y - tall - h - 4];
        let y = ys[0], best = Infinity;
        for (const cand of ys) {
          const o = overlap({ x: a.x - w / 2, y: cand, w, h });
          if (o < best - 1) { best = o; y = cand; }
          if (o === 0) break;
        }
        return (
          <g key={r.id}>
            <rect x={a.x - w / 2 + px * 0.12} y={y + px * 0.22} width={w} height={h} rx={px * 0.35} fill={PAPER.shadow} />
            <rect x={a.x - w / 2} y={y} width={w} height={h} rx={px * 0.35} fill={inkOf(r.family).edge}
              stroke={PAPER.die} strokeWidth={px * 0.22} />
            <text x={a.x} y={y + h / 2 + px * 0.05} textAnchor="middle" dominantBaseline="central" fontSize={px}
              className={styles.display} fill={PAPER.die}>{text}</text>
          </g>
        );
      })}
    </g>
  );
}
