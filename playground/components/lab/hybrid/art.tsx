"use client";

// Round 3: the diorama drawn with the paper skin's art library (read-only
// imports from components/lab/paper/art/**): one top-left key light, ramps
// [hi, lit, mid, shade, deep], printed surface patterns, stand-up cutouts with
// contact + cast shadows, glossy sticker level spots. Every prop still sits on
// a world-given position and encodes data (see ./encoding.ts).
import { memo, useMemo } from "react";
import type { Road, World, WorldNode } from "@/lib/world";
import { iconFor } from "@/lib/icons";
import { symbolFor } from "@/lib/blueprint";
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { ArtDefs, ContactShadow, Glint } from "@/components/lab/paper/art/materials";
import { R, P, HI, LIT, MID, SHADE, DEEP, type Ramp } from "@/components/lab/paper/art/palette";
import { octagon, octagonSide, frond } from "@/components/lab/paper/art/geom";
import { Tuft, Flower, Boulder } from "@/components/lab/paper/art/bits";
import { lineD, sampleEvery, starPts } from "./geometry.ts";
import s from "./hybrid.module.css";

const f1 = (n: number) => Math.round(n * 10) / 10;

/** family → ground surface (printed pattern) + its base colour + island edge ramp. */
export const GROUND: Record<string, { fill: string; base: string; ramp: Ramp; face: Ramp }> = {
  perception:     { fill: "url(#pa-grass)",  base: "#7DCB45", ramp: R.grass,  face: R.leaf },
  sequence:       { fill: "url(#pa-sand)",   base: "#F7D98A", ramp: R.sand,   face: R.orange },
  generative:     { fill: "url(#hy-heath)",  base: "#C9A9F2", ramp: R.violet, face: R.violet },
  representation: { fill: "url(#hy-frost)",  base: "#9AE6D6", ramp: R.teal,   face: R.teal },
  structure:      { fill: "url(#hy-quartz)", base: "#FFC7DE", ramp: R.pink,   face: R.pink },
  decision:       { fill: "url(#hy-savanna)", base: "#D8E77A", ramp: R.lime,  face: R.gold },
};
const FALLBACK = { fill: "#E2D0A8", base: "#E2D0A8", ramp: R.cream, face: R.cream };
export const groundOf = (f: string) => GROUND[f] ?? FALLBACK;

/** Striped ground patterns in the paper style for the families the art library has no surface for. */
function stripes(id: string, a: string, b: string, hi: string, rot = -35) {
  return (
    <pattern key={id} id={id} width={14} height={14} patternUnits="userSpaceOnUse" patternTransform={`rotate(${rot})`}>
      <rect width={14} height={14} fill={a} />
      <rect width={7} height={14} fill={b} />
      <rect x={6.4} width={0.9} height={14} fill={hi} fillOpacity={0.6} />
    </pattern>
  );
}

export const HybridDefs = memo(function HybridDefs() {
  return (
    <>
      <ArtDefs />
      <defs>
        {stripes("hy-heath", "#C9A9F2", "#BB98EA", R.violet[HI])}
        {stripes("hy-frost", "#9AE6D6", "#86DCC9", R.snow[HI], 35)}
        {stripes("hy-quartz", "#FFC7DE", "#FDB6D2", "#FFFFFF")}
        {stripes("hy-savanna", "#D8E77A", "#CBDD66", R.lime[HI], 35)}
      </defs>
    </>
  );
});

// ── roads: fat gold cobble with a darker orange-brown edge, slightly raised ──
type RoadStyle = "primary" | "path" | "long" | "lineage";
function roadStyle(r: Road, lifted: boolean): RoadStyle {
  if (lifted) return "lineage";
  if (r.kind === "bridge") return "long";
  return r.primary ? "primary" : "path";
}
const RW: Record<RoadStyle, { rim: number; edge: number; core: number; fill: string; op: number }> = {
  primary: { rim: 15, edge: 11, core: 7.5, fill: "url(#pa-cobble)", op: 1 },
  path: { rim: 9, edge: 6.5, core: 4, fill: R.gold[LIT], op: 0.95 },
  long: { rim: 6, edge: 4, core: 2.4, fill: R.gold[LIT], op: 0.6 },   // cross-family: quiet until focused
  lineage: { rim: 17, edge: 13, core: 9, fill: "url(#pa-cobble)", op: 1 },
};

export function PaperRoads({ roads, lifted }: { roads: Road[]; lifted: boolean }) {
  const ds = roads.map((r) => ({ r, d: lineD(r.lanePoints), st: roadStyle(r, lifted) }));
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {ds.map(({ r, d, st }) => <path key={`s${r.id}`} d={d} stroke={P.shadow} strokeOpacity={0.18 * RW[st].op} strokeWidth={RW[st].rim} transform="translate(2 3)" />)}
      {ds.map(({ r, d, st }) => <path key={`w${r.id}`} d={d} stroke={P.die} strokeWidth={RW[st].rim} opacity={RW[st].op} />)}
      {ds.map(({ r, d, st }) => <path key={`e${r.id}`} d={d} stroke={R.gold[SHADE]} strokeWidth={RW[st].edge} opacity={RW[st].op} />)}
      {ds.map(({ r, d, st }) => <path key={`c${r.id}`} d={d} stroke={RW[st].fill} strokeWidth={RW[st].core} opacity={RW[st].op} />)}
      {ds.map(({ r, st }) => st === "long" ? null : r.chevrons.map((c, i) => (
        <path key={`v${r.id}${i}`} d="M-2.4 -3L1.6 0L-2.4 3" transform={`translate(${f1(c.x)} ${f1(c.y)}) rotate(${f1((c.angle * 180) / Math.PI)})`}
          stroke={st === "lineage" ? R.red[DEEP] : R.gold[DEEP]} strokeWidth={st === "lineage" ? 2 : 1.4} opacity={st === "lineage" ? 1 : 0.75} />
      )))}
    </g>
  );
}

// ── mountains: stand-up rock cutouts, lit left face, shaded right, snow on the tall ones ──
export const PaperMountains = memo(function PaperMountains({ world }: { world: World }) {
  const peaks = useMemo(() => world.mountains.flatMap((line, li) =>
    sampleEvery(line, 30).map((p, i) => {
      const r = (i * 7 + li * 3) % 5;
      const side = i % 2 ? 1 : -1;
      return { x: p.x - Math.sin(p.angle) * side * 5, y: p.y + Math.cos(p.angle) * side * 5, h: 20 + r * 4, w: 13 + (r % 3) * 2, snow: r >= 3 };
    })).sort((a, b) => a.y - b.y), [world]);
  return (
    <g aria-hidden strokeLinejoin="round">
      {peaks.map((p, i) => {
        const { x, y, h, w } = p;
        const top = `${f1(x + w * 0.08)} ${f1(y - h)}`;
        return (
          <g key={i}>
            <ContactShadow rx={w * 0.9} cx={x + 2} cy={y + 2} />
            <path d={`M${f1(x - w - 2)} ${f1(y + 2)}L${top}L${f1(x + w + 2)} ${f1(y + 2)}Z`} fill={P.die} />
            <path d={`M${f1(x - w)} ${f1(y)}L${top}L${f1(x + w * 0.08)} ${f1(y)}Z`} fill={R.rock[LIT]} />
            <path d={`M${f1(x + w * 0.08)} ${f1(y)}L${top}L${f1(x + w)} ${f1(y)}Z`} fill={R.rock[SHADE]} />
            {p.snow && <path d={`M${f1(x - w * 0.34)} ${f1(y - h * 0.62)}L${top}L${f1(x + w * 0.4)} ${f1(y - h * 0.6)}L${f1(x + w * 0.1)} ${f1(y - h * 0.68)}Z`} fill={R.snow[HI]} />}
            <path d={`M${f1(x - w)} ${f1(y)}L${top}`} fill="none" stroke={R.rock[HI]} strokeWidth={1.1} />
          </g>
        );
      })}
    </g>
  );
});

// ── cities: stand-up houses around each atom (one per child), capitals get towers ──
export const PaperCities = memo(function PaperCities({ world }: { world: World }) {
  return (
    <g aria-hidden>
      {world.cities.flatMap((c) => c.blocks.map((b, i) => {
        const tower = c.capital && i % 3 === 0;
        const w = Math.max(9, b.w), h = tower ? w * 1.9 : w * 0.95;
        const x = b.x + b.w / 2, y = b.y + b.h;              // base centre
        const roof = tower ? R.orange : R.red;
        return (
          <g key={`${c.node}-${i}`}>
            <ContactShadow rx={w * 0.7} cx={x + 1} cy={y} />
            <rect x={x - w / 2 - 1.2} y={y - h - 1.2} width={w + 2.4} height={h + 1.2} fill={P.die} />
            <rect x={x - w / 2} y={y - h} width={w * 0.62} height={h} fill={R.cream[LIT]} />
            <rect x={x - w / 2 + w * 0.62} y={y - h} width={w * 0.38} height={h} fill={R.cream[SHADE]} />
            <rect x={x - w * 0.18} y={y - h * 0.62} width={w * 0.22} height={w * 0.26} fill={P.window} />
            {tower ? (
              <path d={`M${f1(x - w / 2 - 1)} ${f1(y - h)}h${f1(w + 2)}v-3h-2v2h-2v-2h-2v2h-2v-2h-2v2h-2v-2h${f1(-(w + 2 - 12))}Z`} fill={roof[MID]} />
            ) : (
              <>
                <path d={`M${f1(x - w / 2 - 2)} ${f1(y - h)}L${f1(x)} ${f1(y - h - w * 0.7)}L${f1(x)} ${f1(y - h)}Z`} fill={roof[LIT]} />
                <path d={`M${f1(x)} ${f1(y - h)}L${f1(x)} ${f1(y - h - w * 0.7)}L${f1(x + w / 2 + 2)} ${f1(y - h)}Z`} fill={roof[SHADE]} />
              </>
            )}
          </g>
        );
      }))}
    </g>
  );
});

// ── biome dressing on world.decor cells (encodes the family / biome) ──
export const PaperDressing = memo(function PaperDressing({ world }: { world: World }) {
  const items = useMemo(() => world.decor.filter((d) => d.variant % 2 === 0), [world]);
  return (
    <g aria-hidden>
      {items.map((d) => {
        const x = (d.tile % world.cols) * world.tile + 8, y = Math.floor(d.tile / world.cols) * world.tile + 12;
        const k = d.scale;
        let art: React.ReactNode = null;
        switch (d.region) {
          case "perception":        // round broadleaf trees
            art = (
              <g>
                <rect x={x - 1.5} y={y - 7 * k} width={3} height={7 * k} fill={R.wood[SHADE]} />
                <circle cx={x} cy={y - 12 * k} r={7.5 * k} fill={R.leaf[MID]} />
                <path d={`M${x - 7 * k} ${y - 12 * k}a${7.5 * k} ${7.5 * k} 0 0 1 ${10 * k} ${-6 * k}a6 6 0 0 0 ${-10 * k} ${6 * k}Z`} fill={R.leaf[LIT]} />
                <path d={`M${x + 1 * k} ${y - 5 * k}a${7.5 * k} ${7.5 * k} 0 0 0 ${6.3 * k} ${-6 * k}a5 5 0 0 1 ${-6.3 * k} ${6 * k}Z`} fill={R.leaf[SHADE]} />
              </g>
            );
            break;
          case "sequence":          // desert palms
            art = (
              <g>
                <path d={`M${x} ${y}q-2 ${-8 * k} 1 ${-16 * k}`} fill="none" stroke={R.wood[MID]} strokeWidth={2.4} strokeLinecap="round" />
                <path d={frond(x + 1, y - 16 * k, x - 9 * k, y - 11 * k, 3.2 * k)} fill={R.pine[LIT]} />
                <path d={frond(x + 1, y - 16 * k, x + 10 * k, y - 10 * k, 3.2 * k)} fill={R.pine[MID]} />
                <path d={frond(x + 1, y - 16 * k, x + 2 * k, y - 25 * k, 2.6 * k)} fill={R.pine[LIT]} />
              </g>
            );
            break;
          case "generative":        // volcanic boulders
            art = <Boulder x={x} y={y} r={6 * k} ramp={R.basalt} />;
            break;
          case "representation":    // frosted pines
            art = (
              <g>
                <path d={`M${x} ${y - 20 * k}L${x - 7 * k} ${y - 4 * k}H${x + 7 * k}Z`} fill={R.pine[MID]} />
                <path d={`M${x} ${y - 20 * k}L${x - 7 * k} ${y - 4 * k}H${x}Z`} fill={R.pine[LIT]} />
                <path d={`M${x} ${y - 20 * k}L${x - 3 * k} ${y - 13 * k}H${x + 3 * k}Z`} fill={R.snow[HI]} />
                <rect x={x - 1.2} y={y - 4 * k} width={2.4} height={4 * k} fill={R.wood[DEEP]} />
              </g>
            );
            break;
          case "structure":         // crystal shards
            art = (
              <g>
                <path d={`M${x} ${y}L${x - 4 * k} ${y - 7 * k}L${x} ${y - 16 * k}Z`} fill={R.pink[LIT]} />
                <path d={`M${x} ${y}L${x + 4 * k} ${y - 7 * k}L${x} ${y - 16 * k}Z`} fill={R.pink[SHADE]} />
              </g>
            );
            break;
          default:                  // decision: savanna grass + flowers
            art = d.tile % 3 === 0 ? <Flower x={x} y={y} r={3 * k} ramp={R.red} /> : <Tuft x={x} y={y} s={k} ramp={R.lime} />;
        }
        return (
          <g key={d.tile}>
            <ellipse cx={x + 1.5} cy={y + 0.5} rx={6 * k} ry={2 * k} fill={P.shadow} fillOpacity={0.18} />
            {art}
          </g>
        );
      })}
    </g>
  );
});

// ── boats: a little paper steamer ──
export function PaperBoat({ x, y, scale = 1, sel = false }: { x: number; y: number; scale?: number; sel?: boolean }) {
  const hull = sel ? R.gold : R.red;
  return (
    <g transform={`translate(${f1(x)} ${f1(y)}) scale(${scale})`}>
      <path d="M-11 0h22l-4 7h-14z" fill={P.shadow} fillOpacity={0.25} transform="translate(2 3)" />
      <path d="M-12 -1h24l-5 8h-14z" fill={P.die} />
      <path d="M-11 0h22l-4 6.5h-14z" fill={hull[MID]} />
      <path d="M-11 0h22l-.8 1.6h-20.4z" fill={P.die} />
      <rect x={-6} y={-7} width={10} height={7} fill={R.cream[LIT]} stroke={P.die} strokeWidth={1} />
      <rect x={-4.5} y={-5} width={2.4} height={2.4} fill={P.window} />
      <rect x={-0.5} y={-5} width={2.4} height={2.4} fill={P.window} />
      <rect x={4.5} y={-11} width={3} height={6} fill={hull[SHADE]} />
      <circle cx={8} cy={-15} r={2.2} fill="#FFFFFF" opacity={0.9} />
      <circle cx={11} cy={-18} r={1.6} fill="#FFFFFF" opacity={0.7} />
    </g>
  );
}

// ── level spots: glossy stickers ─────────────────────────────────────────────
export const SPOT_R = { atom: 30, town: 17 } as const;

/** Semantic zoom: atoms hold ~48px on screen at whole-map zoom; towns are dots below 11px radius. */
export function spotScale(atom: boolean, scale: number, atomPx = 24): { k: number; dot: boolean } {
  const Rr = atom ? SPOT_R.atom : SPOT_R.town;
  if (atom) return { k: Math.max(1, atomPx / (Rr * scale)), dot: false };
  return { k: 1, dot: Rr * scale < 11 };
}

export function StickerSpot({
  n, state, focused, stations, scale, atomPx, onHover,
}: {
  n: WorldNode; state: EvidenceState; focused: boolean; stations: number; scale: number; atomPx: number;
  onHover: (name: string | null) => void;
}) {
  const g = groundOf(n.family);
  const Rr = n.atom ? SPOT_R.atom : SPOT_R.town;
  const tilt = 0.86;                                  // the diorama's gentle tilt on flat stickers
  const Th = n.atom ? 8 : 5;
  const sz = spotScale(n.atom, scale, atomPx);
  const k = (focused ? 1.3 : 1) * sz.k;
  const Icon = iconFor(n.name);
  const untrained = state === "untrained";
  const face: Ramp = untrained ? R.cream : g.face;
  const label = `${n.name.replace(/_/g, " ")}${n.atom ? ", atom" : ""}, ${untrained ? "not trained yet" : state}`;
  const common = {
    "data-node": n.name, className: s.node, role: "button", tabIndex: 0, "aria-label": label,
    onPointerEnter: () => onHover(n.name), onPointerLeave: () => onHover(null),
    onFocus: () => onHover(n.name), onBlur: () => onHover(null),
  } as const;
  if (sz.dot && !focused) {
    return (
      <g {...common} transform={`translate(${f1(n.center.x)} ${f1(n.center.y)})`}>
        <circle cx={1.5} cy={2.5} r={Rr * 0.62 + 3} fill={P.shadow} fillOpacity={0.25} />
        <circle r={Rr * 0.62 + 3} fill={P.die} />
        <circle r={Rr * 0.62} fill={face[MID]} stroke={R.gold[MID]} strokeWidth={3} className={s.ring} />
        {state === "champion" && <polygon points={starPts(Rr * 0.62, -Rr * 0.62, 8)} fill={R.gold[LIT]} stroke={P.die} strokeWidth={2} strokeLinejoin="round" />}
        <title>{label}</title>
      </g>
    );
  }
  const topD = n.atom ? octagon(0, 0, Rr, tilt) : `M${-Rr} 0a${Rr} ${Rr * tilt} 0 1 0 ${Rr * 2} 0a${Rr} ${Rr * tilt} 0 1 0 ${-Rr * 2} 0Z`;
  const sideD = n.atom ? octagonSide(0, 0, Rr, tilt, Th) : `M${-Rr} 0a${Rr} ${Rr * tilt} 0 0 0 ${Rr * 2} 0v${Th}a${Rr} ${Rr * tilt} 0 0 1 ${-Rr * 2} 0Z`;
  const inner = Rr * 0.74;
  const faceD = n.atom ? octagon(0, 0, inner, tilt) : `M${-inner} 0a${inner} ${inner * tilt} 0 1 0 ${inner * 2} 0a${inner} ${inner * tilt} 0 1 0 ${-inner * 2} 0Z`;
  const em = Rr * 1.0;
  return (
    <g {...common} transform={`translate(${f1(n.center.x)} ${f1(n.center.y - (focused ? 5 : 0))}) scale(${f1(k * 100) / 100})`}>
      <ContactShadow rx={Rr * 1.05} cy={Th + 2} />
      {focused && <path d={n.atom ? octagon(0, 0, Rr + 11, tilt) : `M${-Rr - 11} 0a${Rr + 11} ${(Rr + 11) * tilt} 0 1 0 ${(Rr + 11) * 2} 0a${Rr + 11} ${(Rr + 11) * tilt} 0 1 0 ${-(Rr + 11) * 2} 0Z`}
        fill="none" stroke={R.red[MID]} strokeWidth={5} strokeDasharray="10 6" />}
      {/* die-cut white rim around the whole sticker (top + thickness) */}
      <path d={sideD} fill={P.die} stroke={P.die} strokeWidth={6} strokeLinejoin="round" />
      <path d={topD} fill={P.die} stroke={P.die} strokeWidth={6} strokeLinejoin="round" />
      {/* gold rim with depth, then the glossy face */}
      <path d={sideD} fill={untrained ? R.cream[SHADE] : R.gold[DEEP]} />
      <path d={topD} fill={untrained ? R.cream[MID] : R.gold[LIT]} className={s.ring} />
      <path d={faceD} fill={face[untrained ? LIT : MID]} />
      <path d={faceD} fill="url(#pa-gloss)" />
      {state === "provisional" && <path d={faceD} fill="none" stroke={P.pencil} strokeWidth={2} strokeDasharray="4 3" />}
      {Icon ? (
        <Icon x={-em / 2} y={-em / 2 - 1} width={em} height={em} strokeWidth={n.atom ? 2.4 : 2.8}
          color={untrained ? P.pencil : "#FFFFFF"} aria-hidden />
      ) : (
        <text y={0} textAnchor="middle" dominantBaseline="central" fontSize={Rr * 0.7} fontWeight={700} fill="#FFFFFF">{symbolFor(n.name)}</text>
      )}
      <Glint x={-inner * 0.45} y={-inner * 0.3} r={Rr * 0.12} streak={n.atom} />
      {state === "champion" && (
        <g>
          <polygon points={starPts(Rr * 0.82, -Rr * 0.72, n.atom ? 11 : 9)} fill={P.die} stroke={P.die} strokeWidth={4} strokeLinejoin="round" />
          <polygon points={starPts(Rr * 0.82, -Rr * 0.72, n.atom ? 11 : 9)} fill={R.gold[LIT]} stroke={R.gold[DEEP]} strokeWidth={1.2} strokeLinejoin="round" />
        </g>
      )}
      {stations > 0 && (
        <g transform={`translate(0 ${Rr * tilt + Th + 8})`}>
          <rect x={-3.5 * Math.min(6, stations) - 3} y={-3} width={7 * Math.min(6, stations) + 6} height={7} rx={2} fill={P.die} />
          {Array.from({ length: Math.min(6, stations) }, (_, i) => (
            <rect key={i} x={-3.5 * Math.min(6, stations) + i * 7} y={-1.5} width={4} height={4} fill={g.face[SHADE]} />
          ))}
        </g>
      )}
      <title>{label}</title>
    </g>
  );
}
