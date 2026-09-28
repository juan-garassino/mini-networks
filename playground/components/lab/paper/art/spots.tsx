// Level spots: the glossy octagon stickers the roads join at (ref-paper.md:
// "octagons with a thick gold rim, a bright blue glossy face, a white highlight
// glint, and visible depth"). FLAT assets: (x, y) is the centre of the top
// face on the ground, not a base line; `r` is the radius in world px.
//
//   LevelSpot    a derived model; state = champion | trained | provisional | untrained
//   AtomSpot     an atom: a two-tier spot with a little castle standing behind it
//   CapitalSpot  a hub atom: bigger, with a city of houses and a spire behind it
//   Emblem       the model's species glyph (lib/icons iconFor) printed on the face, crisp
//   StarSeal     the champion's gold star sticker
import { createElement, memo } from "react";
import { iconFor } from "@/lib/icons";
import { Glint, SoftShadow } from "./materials";
import { familyRamp, P, R, HI, LIT, MID, SHADE, DEEP, type Ramp } from "./palette";
import { octagon, octagonPts, poly, rect, star } from "./geom";
import { Cottage, RoundHouse, Townhouse, Shop } from "./buildings";
import { Pennant } from "./bits";

export type SpotState = "champion" | "trained" | "provisional" | "untrained";
const TILT = 0.68;

/** The side band of an octagon disc, one facet per visible edge, shaded by
 *  how much that edge faces the key light (left = lit, right = shade). */
function DiscSide({ cx, cy, r, tilt, t, ramp, sketch }: { cx: number; cy: number; r: number; tilt: number; t: number; ramp: Ramp; sketch?: boolean }) {
  const p = octagonPts(cx, cy, r, tilt);
  const order = [7, 0, 1, 2, 3, 4];
  const faces = [];
  for (let i = 0; i < order.length - 1; i++) {
    const a = order[i], b = order[i + 1];
    const ax = p[a * 2], ay = p[a * 2 + 1], bx = p[b * 2], by = p[b * 2 + 1];
    const mx = (ax + bx) / 2 - cx;                   // edge midpoint: <0 faces left (lit)
    const tone = sketch ? P.die : mx < -r * 0.5 ? ramp[MID] : mx < -r * 0.1 ? ramp[MID] : mx < r * 0.5 ? ramp[SHADE] : ramp[DEEP];
    faces.push(<path key={i} d={poly(ax, ay, bx, by, bx, by + t, ax, ay + t)} fill={tone} />);
  }
  return <g>{faces}</g>;
}

/** A tilted octagon disc: soft drop shadow, die-cut rim, faceted side band,
 *  top in `top`, with a lit top-left edge. Returns the pieces for layering. */
function Disc({ cx, cy, r, tilt = TILT, t, ramp, top, rim = 3, sketch = false, shadow = true }: {
  cx: number; cy: number; r: number; tilt?: number; t: number; ramp: Ramp; top: string; rim?: number; sketch?: boolean; shadow?: boolean;
}) {
  const topD = octagon(cx, cy, r, tilt);
  const body = octagon(cx, cy + t / 2, r, tilt) + octagon(cx, cy + t, r, tilt) + topD;
  const pencil = { stroke: P.pencil, strokeWidth: 1.2, strokeDasharray: "3.5 2.2", fill: "none", strokeLinejoin: "round" as const };
  return (
    <g>
      {shadow && !sketch && <SoftShadow d={[octagon(cx, cy + t, r, tilt), topD]} transform={`translate(${r * 0.12} ${r * 0.16 + 1})`} spread={rim} />}
      {!sketch && <path d={body} fill={P.die} stroke="url(#pa-rim)" strokeWidth={rim * 2} strokeLinejoin="round" />}
      {!sketch && <path d={octagon(cx, cy + t, r, tilt)} fill={P.dieShade} stroke={P.dieShade} strokeWidth={rim * 2} strokeLinejoin="round" transform={`translate(0.6 ${rim * 0.5})`} opacity={0.9} />}
      {!sketch && <path d={body} fill={P.die} stroke={P.die} strokeWidth={rim * 1.6} strokeLinejoin="round" />}
      <DiscSide cx={cx} cy={cy} r={r} tilt={tilt} t={t} ramp={ramp} sketch={sketch} />
      <path d={topD} fill={top} />
      {sketch && <path d={octagonSideOutline(cx, cy, r, tilt, t)} {...pencil} />}
      {sketch && <path d={topD} {...pencil} />}
      {sketch && <path d={octagon(cx + 0.8, cy - 0.6, r * 1.02, tilt)} {...pencil} strokeOpacity={0.45} strokeDasharray="6 5" />}
      {sketch && <path d={octagonSideOutline(cx, cy, r, tilt, t)} fill="url(#pa-hatch)" />}
    </g>
  );
}
function octagonSideOutline(cx: number, cy: number, r: number, tilt: number, t: number) {
  const p = octagonPts(cx, cy, r, tilt);
  const idx = [7, 0, 1, 2, 3, 4];
  const top = idx.map((i) => [p[i * 2], p[i * 2 + 1]]);
  const bot = [...top].reverse().map(([x, y]) => [x, y + t]);
  return poly(...top.flat(), ...bot.flat());
}

/** The lit top-left run of an octagon's edge (vertices 4 → 5 → half of 5–6),
 *  inset to radius r so it always sits inside the shape. */
function litRim(cx: number, cy: number, r: number, reach = 1) {
  const p = octagonPts(cx, cy, r, TILT);
  const v = (i: number) => [p[i * 2], p[i * 2 + 1]] as const;
  const [ax, ay] = v(4), [bx, by] = v(5), [c6x, c6y] = v(6);
  const ex = bx + (c6x - bx) * 0.5 * reach, ey = by + (c6y - by) * 0.5 * reach;
  const sx = ax + (bx - ax) * (1 - reach) * 0.6, sy = ay + (by - ay) * (1 - reach) * 0.6;
  return `M${sx} ${sy}L${bx} ${by}L${ex} ${ey}`;
}

/** The species glyph, printed crisp and un-squashed on a spot face. */
export function Emblem({ name, cx, cy, size, color, shadow }: { name: string; cx: number; cy: number; size: number; color: string; shadow?: string }) {
  const icon = iconFor(name);
  if (!icon) return null;
  const sw = (2.3 * 24) / size;
  const at = (dx: number, dy: number, c: string, w: number) =>
    createElement(icon, { x: cx - size / 2 + dx, y: cy - size / 2 + dy, width: size, height: size, color: c, strokeWidth: w, "aria-hidden": true });
  return (
    <g pointerEvents="none">
      {shadow && at(size * 0.04, size * 0.06, shadow, sw * 1.25)}
      {at(0, 0, color, sw)}
    </g>
  );
}

/** The champion's gold star seal: a die-cut star sticker with thickness + gloss. */
export function StarSeal({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const s = star(cx, cy, r, 0.5);
  return (
    <g>
      <path d={star(cx + r * 0.1, cy + r * 0.22, r, 0.5)} fill={P.shadow} opacity={0.25} stroke={P.shadow} strokeWidth={r * 0.3} strokeLinejoin="round" />
      <path d={`M${cx - r * 0.5} ${cy + r * 0.4} L${cx - r * 0.75} ${cy + r * 1.35} L${cx - r * 0.35} ${cy + r * 1.1} L${cx - r * 0.1} ${cy + r * 1.4} L${cx} ${cy + r * 0.5}Z`} fill={R.red[MID]} stroke={P.die} strokeWidth={r * 0.14} strokeLinejoin="round" />
      <path d={s} fill={P.die} stroke={P.die} strokeWidth={r * 0.34} strokeLinejoin="round" />
      <path d={star(cx + r * 0.06, cy + r * 0.1, r, 0.5)} fill={R.gold[DEEP]} />
      <path d={s} fill={R.gold[LIT]} />
      <path d={poly(cx, cy - r, cx, cy, cx + r * 0.95, cy - r * 0.31)} fill={R.gold[MID]} opacity={0.7} />
      <path d={poly(cx, cy, cx + r * 0.59, cy + r * 0.81, cx + r * 0.95, cy - r * 0.31)} fill={R.gold[SHADE]} opacity={0.6} />
      <path d={poly(cx, cy - r, cx - r * 0.95, cy - r * 0.31, cx, cy)} fill={R.gold[HI]} opacity={0.8} />
      <Glint x={cx - r * 0.2} y={cy - r * 0.3} r={r * 0.22} streak={false} />
    </g>
  );
}

/** The face of a spot (inside the gold rim) in its evidence state. */
function Face({ cx, cy, r, state, name, glyph }: { cx: number; cy: number; r: number; state: SpotState; name?: string; glyph: number }) {
  const inner = octagon(cx, cy, r, TILT);
  if (state === "provisional") {
    return (
      <g>
        <path d={inner} fill="none" stroke={P.pencil} strokeWidth={1} strokeDasharray="2.5 2" />
        {name && <Emblem name={name} cx={cx} cy={cy - 1} size={glyph} color={P.pencil} />}
      </g>
    );
  }
  if (state === "untrained") {
    return (
      <g>
        <path d={inner} fill={R.cream[MID]} />
        <path d={octagon(cx + r * 0.05, cy + r * 0.08, r * 0.95, TILT)} fill={R.cream[HI]} />
        <path d={octagon(cx, cy, r * 0.8, TILT)} fill="none" stroke={R.blue[MID]} strokeWidth={1.3} strokeDasharray="3 2.4" />
        {name && <Emblem name={name} cx={cx} cy={cy - 1} size={glyph} color={R.blue[MID]} />}
      </g>
    );
  }
  // trained / champion: recessed glossy blue
  return (
    <g>
      <path d={inner} fill={R.blue[DEEP]} />
      <path d={octagon(cx + r * 0.05, cy + r * 0.09, r * 0.96, TILT)} fill={R.blue[MID]} />
      <path d={octagon(cx - r * 0.1, cy - r * 0.12, r * 0.62, TILT)} fill={R.blue[LIT]} opacity={0.55} />
      <path d={inner} fill="url(#pa-gloss)" />
      {name && <Emblem name={name} cx={cx} cy={cy - 0.5} size={glyph} color="#FFFFFF" shadow={R.blue[DEEP]} />}
      <path d={litRim(cx, cy, r * 0.8, 0.5)} fill="none" stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={r * 0.09} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

export interface SpotProps {
  /** model name: the emblem comes from lib/icons iconFor(name) */
  name?: string;
  state: SpotState;
  /** centre of the top face */
  x?: number;
  y?: number;
  /** radius in world px (derived 20, atom 30, capital 36 on today's map) */
  r?: number;
}

export const LevelSpot = memo(function LevelSpot({ name, state, x = 0, y = 0, r = 20 }: SpotProps) {
  const sketch = state === "provisional";
  const t = r * 0.34;
  return (
    <g>
      <Disc cx={x} cy={y} r={r} t={t} ramp={R.gold} top={sketch ? P.die : R.gold[LIT]} sketch={sketch} rim={Math.max(2, r * 0.14)} />
      {!sketch && <path d={litRim(x, y, r * 0.9)} fill="none" stroke={R.gold[HI]} strokeWidth={r * 0.07} strokeLinecap="round" strokeLinejoin="round" />}
      <Face cx={x} cy={y} r={r * 0.76} state={state} name={name} glyph={r * 0.92} />
      {state === "champion" && <StarSeal cx={x + r * 0.78} cy={y - r * 0.58} r={r * 0.36} />}
      {!sketch && state !== "untrained" && <Glint x={x - r * 0.42} y={y - r * 0.3} r={r * 0.12} streak={false} />}
    </g>
  );
});

/** A little castle that stands behind an atom's spot: curtain wall with a
 *  gate and merlons, a keep, two round towers — roofs in the family ramp.
 *  Drawn in a 40-wide design box scaled by s/40; base at (x, y). */
function Castle({ x, y, s, roof }: { x: number; y: number; s: number; roof: Ramp }) {
  const k = s / 40;
  const wall = rect(-20, -24, 40, 24);
  const keep = rect(-8, -40, 16, 17);
  const tower = (tx: number, h: number) => ({ tx, h, body: rect(tx - 7, -h, 14, h), cap: rect(tx - 8.6, -h - 4, 17.2, 4.4), cone: poly(tx - 9.4, -h - 3.6, tx, -h - 21, tx + 9.4, -h - 3.6) });
  const towers = [tower(-19, 36), tower(19, 31)];
  const merl = (x0: number, x1: number, yy: number) => {
    let d = "";
    for (let xx = x0; xx < x1 - 1; xx += 5) d += rect(xx, yy - 3.4, 3, 3.6);
    return d;
  };
  const sil = [wall, keep, merl(-19, 20, -24), merl(-8, 9, -40), ...towers.flatMap((t) => [t.body, t.cap, t.cone])];
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <SoftShadow d={sil} transform="translate(3 2)" spread={2} opacity={0.7} />
      {sil.map((d, i) => <path key={i} d={d} fill={P.die} stroke="url(#pa-rim)" strokeWidth={4.4} strokeLinejoin="round" />)}
      {/* keep behind the wall */}
      <path d={keep} fill={R.cream[MID]} />
      <path d={rect(3, -40, 5, 17)} fill={R.cream[SHADE]} />
      <path d={merl(-8, 9, -40)} fill={R.cream[MID]} />
      <path d="M-2 -35 v-2.6 a2 2 0 0 1 4 0 v2.6Z" fill={P.windowLit} />
      {/* curtain wall: lit face, shaded right third, stone courses, gate */}
      <path d={wall} fill={R.cream[LIT]} />
      <path d={rect(8, -24, 12, 24)} fill={R.cream[SHADE]} />
      <path d={merl(-19, 20, -24)} fill={R.cream[LIT]} />
      <path d={wall} fill="url(#pa-stone)" />
      <path d={wall} fill="url(#pa-occl)" />
      <path d="M-6 0 V-9 A6 6 0 0 1 6 -9 V0Z" fill={R.cream[MID]} />
      <path d="M-4.2 0 V-8.6 A4.2 4.2 0 0 1 4.2 -8.6 V0Z" fill="#2E2238" />
      <path d="M-2.2 0 V-12 M0 0 V-12.8 M2.2 0 V-12 M-4 -4 H4 M-4 -8 H4" stroke={R.rock[LIT]} strokeWidth={0.6} />
      {/* round towers */}
      {towers.map((t, i) => (
        <g key={i}>
          <path d={t.body} fill={i ? R.cream[MID] : R.cream[LIT]} />
          <path d={t.body} fill="url(#pa-turn)" />
          <path d={t.body} fill="url(#pa-stone)" />
          <path d={t.cap} fill={R.cream[HI]} />
          <path d={rect(t.tx + 4, -t.h - 4, 4.6, 4.4)} fill={R.cream[SHADE]} />
          <path d={poly(t.tx - 9.4, -t.h - 3.6, t.tx, -t.h - 21, t.tx, -t.h - 3.6)} fill={roof[LIT]} />
          <path d={poly(t.tx, -t.h - 3.6, t.tx, -t.h - 21, t.tx + 9.4, -t.h - 3.6)} fill={roof[SHADE]} />
          <path d={t.cone} fill="url(#pa-shingle)" />
          <path d={`M${t.tx - 8.6} ${-t.h - 4.4} L${t.tx - 0.6} ${-t.h - 19.6}`} stroke={roof[HI]} strokeWidth={0.9} strokeLinecap="round" />
          <path d={`M${t.tx - 1.8} ${-t.h + 12} v-3 a1.8 1.8 0 0 1 3.6 0 v3Z`} fill={P.window} />
        </g>
      ))}
    </g>
  );
}

/** An atom: two-tier spot, emblem on the upper tier, a little castle behind. */
export const AtomSpot = memo(function AtomSpot({ name, state, x = 0, y = 0, r = 30, family = "perception", castle = true }: SpotProps & { family?: string; castle?: boolean }) {
  const sketch = state === "provisional";
  const roof = familyRamp(family);
  const t = r * 0.26, r2 = r * 0.7, lift = r * 0.24;
  return (
    <g>
      {castle && !sketch && <Castle x={x} y={y - r * TILT * 0.5} s={r * 1.5} roof={roof} />}
      {castle && !sketch && <Pennant x={x} y={y - r * TILT * 0.5 - r * 1.5 * 1.02} h={r * 0.4} ramp={roof} />}
      <Disc cx={x} cy={y} r={r} t={t} ramp={R.gold} top={sketch ? P.die : R.gold[MID]} sketch={sketch} rim={Math.max(2.4, r * 0.1)} />
      {!sketch && <path d={litRim(x, y, r * 0.93)} fill="none" stroke={R.gold[HI]} strokeWidth={r * 0.05} strokeLinecap="round" strokeLinejoin="round" />}
      <Disc cx={x} cy={y - lift} r={r2} t={lift} ramp={R.gold} top={sketch ? P.die : R.gold[LIT]} sketch={sketch} rim={0} shadow={false} />
      {!sketch && <path d={litRim(x, y - lift, r2 * 0.9)} fill="none" stroke={R.gold[HI]} strokeWidth={r * 0.05} strokeLinecap="round" strokeLinejoin="round" />}
      <Face cx={x} cy={y - lift} r={r2 * 0.78} state={state} name={name} glyph={r2 * 0.95} />
      {state === "champion" && <StarSeal cx={x + r * 0.78} cy={y - r * 0.5} r={r * 0.26} />}
      {!sketch && state !== "untrained" && <Glint x={x - r2 * 0.45} y={y - lift - r2 * 0.3} r={r2 * 0.12} streak={false} />}
    </g>
  );
});

/** A capital (hub atom): a bigger two-tier spot with a city behind it. */
export const CapitalSpot = memo(function CapitalSpot({ name, state, x = 0, y = 0, r = 36, family = "perception" }: SpotProps & { family?: string }) {
  const roof = familyRamp(family);
  const by = y - r * TILT * 0.5;
  const k = r / 36;
  return (
    <g>
      {/* skyline behind the spot: back row lifted, a family spire in the middle */}
      <Townhouse x={x - 30 * k} y={by - 4 * k} size={52 * k} roof={roof} />
      <RoundHouse x={x + 30 * k} y={by - 4 * k} size={50 * k} roof={roof} />
      <Spire x={x + 2 * k} y={by - 8 * k} h={76 * k} roof={roof} />
      <Cottage x={x - 46 * k} y={by + 10 * k} size={36 * k} flag={false} />
      <Shop x={x + 46 * k} y={by + 10 * k} size={26 * k} />
      <AtomSpot name={name} state={state} x={x} y={y} r={r} family={family} castle={false} />
    </g>
  );
});

/** A slim spire tower (capital centrepiece). */
function Spire({ x, y, h, roof }: { x: number; y: number; h: number; roof: Ramp }) {
  const w = h * 0.12;
  const body = `M${x - w} ${y} V${y - h * 0.62} H${x + w} V${y}Z`;
  const cone = poly(x - w * 1.5, y - h * 0.6, x, y - h, x + w * 1.5, y - h * 0.6);
  return (
    <g>
      <path d={body + cone} fill={P.die} stroke="url(#pa-rim)" strokeWidth={4} strokeLinejoin="round" />
      <path d={body} fill={R.cream[LIT]} />
      <path d={`M${x + w * 0.2} ${y} V${y - h * 0.62} H${x + w} V${y}Z`} fill={R.cream[SHADE]} />
      <path d={body} fill="url(#pa-stone)" />
      <path d={poly(x - w * 1.5, y - h * 0.6, x, y - h, x, y - h * 0.6)} fill={roof[LIT]} />
      <path d={poly(x, y - h * 0.6, x, y - h, x + w * 1.5, y - h * 0.6)} fill={roof[SHADE]} />
      <rect x={x - w * 0.45} y={y - h * 0.5} width={w * 0.9} height={h * 0.1} rx={w * 0.45} fill={P.window} />
      <rect x={x - w * 0.45} y={y - h * 0.3} width={w * 0.9} height={h * 0.1} rx={w * 0.45} fill={P.windowLit} />
      <circle cx={x} cy={y - h - 2} r={w * 0.4} fill={R.gold[LIT]} />
    </g>
  );
}

