// Building blocks for the atom landmarks: shafts, cones, 3/4 boxes, ground
// mounds and the glossy emblem plaque. All lit from the top-left, design
// units, base at y = 0 unless a `y` is given.
import { createElement, type ReactNode } from "react";
import { iconFor } from "@/lib/icons";
import { Glint, LitEdge } from "./materials";
import { P, R, HI, LIT, MID, SHADE, DEEP, type Ramp } from "./palette";
import { poly, rect, rrect } from "./geom";
import { StarSeal, type SpotState } from "./spots";

/** A tower shaft: lit face, shaded right band (or a cylinder turn), pattern, ground occlusion. */
export function Shaft({ x, y = 0, w, h, ramp = R.cream, pattern = "pa-stone", round = false, edge = true }: {
  x: number; y?: number; w: number; h: number; ramp?: Ramp; pattern?: string | null; round?: boolean; edge?: boolean;
}) {
  const d = rect(x - w / 2, y - h, w, h);
  return (
    <g>
      <path d={d} fill={ramp[LIT]} />
      {!round && <path d={rect(x + w * 0.2, y - h, w * 0.3, h)} fill={ramp[SHADE]} />}
      {pattern && <path d={d} fill={`url(#${pattern})`} />}
      {round && <path d={d} fill="url(#pa-turn)" />}
      <path d={d} fill="url(#pa-occl)" />
      {edge && <LitEdge d={`M${x - w / 2 + 0.5} ${y - 1} V${y - h + 1}`} w={1.2} />}
    </g>
  );
}
export const shaftD = (x: number, w: number, h: number, y = 0) => rect(x - w / 2, y - h, w, h);

/** A cone / pyramid roof: lit left facet, shaded right facet, shingles, eave band. */
export function Cone({ x, y, w, h, ramp, pattern = "pa-shingle", eave = true }: { x: number; y: number; w: number; h: number; ramp: Ramp; pattern?: string | null; eave?: boolean }) {
  return (
    <g>
      <path d={poly(x - w / 2, y, x, y - h, x, y)} fill={ramp[LIT]} />
      <path d={poly(x, y, x, y - h, x + w / 2, y)} fill={ramp[SHADE]} />
      {pattern && <path d={poly(x - w / 2, y, x, y - h, x + w / 2, y)} fill={`url(#${pattern})`} />}
      <LitEdge d={`M${x - w / 2 + 1} ${y - 0.5} L${x - 0.5} ${y - h + 1.5}`} w={1.1} />
      {eave && <path d={`M${x - w / 2} ${y} Q${x} ${y + 3} ${x + w / 2} ${y}`} stroke={ramp[DEEP]} strokeWidth={2} fill="none" strokeLinecap="round" />}
    </g>
  );
}
export const coneD = (x: number, y: number, w: number, h: number) => poly(x - w / 2, y + 1, x, y - h, x + w / 2, y + 1);

/** A 3/4 box: lit front face and a side face receding up-right. */
export function Box3({ x, y = 0, w, h, d = 10, ramp, pattern = "pa-stone", top = false }: {
  x: number; y?: number; w: number; h: number; d?: number; ramp: Ramp; pattern?: string | null; top?: boolean;
}) {
  const front = rect(x - w / 2, y - h, w, h);
  const side = poly(x + w / 2, y, x + w / 2 + d, y - d * 0.45, x + w / 2 + d, y - h - d * 0.45, x + w / 2, y - h);
  const lid = poly(x - w / 2, y - h, x + w / 2, y - h, x + w / 2 + d, y - h - d * 0.45, x - w / 2 + d, y - h - d * 0.45);
  return (
    <g>
      <path d={front} fill={ramp[LIT]} />
      <path d={side} fill={ramp[SHADE]} />
      {top && <path d={lid} fill={ramp[HI]} />}
      {pattern && <path d={front + side} fill={`url(#${pattern})`} />}
      <path d={front} fill="url(#pa-occl)" />
      <LitEdge d={`M${x - w / 2 + 0.5} ${y - 1} V${y - h + 1}`} w={1.1} />
    </g>
  );
}
export const box3D = (x: number, w: number, h: number, d = 10, y = 0) => [
  rect(x - w / 2, y - h, w, h),
  poly(x + w / 2, y, x + w / 2 + d, y - d * 0.45, x + w / 2 + d, y - h - d * 0.45, x + w / 2, y - h),
  poly(x - w / 2, y - h, x + w / 2, y - h, x + w / 2 + d, y - h - d * 0.45, x - w / 2 + d, y - h - d * 0.45),
];

/** The ground mound every landmark stands on (biome ramp). */
export const moundD = (w: number) => `M${-w} 0 Q${-w * 0.92} ${-9} ${-w * 0.6} ${-11} L${w * 0.6} ${-11} Q${w * 0.92} ${-9} ${w} 0Z`;
export function Mound({ w, ramp = R.grass }: { w: number; ramp?: Ramp }) {
  return (
    <g>
      <path d={moundD(w)} fill={ramp[MID]} />
      <path d={`M${-w} 0 Q${-w * 0.92} ${-9} ${-w * 0.6} ${-11} L${-w * 0.1} ${-11} Q${-w * 0.4} ${-6} ${-w * 0.45} 0Z`} fill={ramp[LIT]} />
      <path d={`M${w * 0.45} 0 Q${w * 0.55} ${-7} ${w * 0.6} ${-11} Q${w * 0.92} ${-9} ${w} 0Z`} fill={ramp[SHADE]} />
      <path d={moundD(w)} fill="url(#pa-fibre)" />
    </g>
  );
}

/** Crenellation silhouette + drawing helper along a top edge. */
export function crenelD(x0: number, x1: number, y: number, h = 5, w = 5, gap = 3.5) {
  let d = "";
  for (let x = x0; x + w <= x1 + 0.01; x += w + gap) d += rect(x, y - h, w, h + 0.6);
  return d;
}

/** The glossy emblem plaque: a gold-framed sticker whose face shows the
 *  evidence state, with iconFor(name) printed on it. `s` = face size. */
export function Plaque({ name, x, y, s, state }: { name: string; x: number; y: number; s: number; state: SpotState }) {
  const icon = iconFor(name);
  const f = s * 0.16;
  const frame = rrect(x - s / 2 - f, y - s / 2 - f, s + f * 2, s + f * 2, s * 0.28);
  const face = rrect(x - s / 2, y - s / 2, s, s, s * 0.2);
  const glyph = (color: string, sw: number, dx = 0, dy = 0): ReactNode =>
    icon ? createElement(icon, { x: x - s * 0.34 + dx, y: y - s * 0.34 + dy, width: s * 0.68, height: s * 0.68, color, strokeWidth: sw, "aria-hidden": true }) : null;
  const sw = (2.4 * 24) / (s * 0.68);
  if (state === "provisional") {
    return (
      <g pointerEvents="none">
        <path d={frame} fill={P.die} stroke={P.pencil} strokeWidth={1} strokeDasharray="3 2" />
        <path d={face} fill="none" stroke={P.pencil} strokeWidth={0.8} strokeDasharray="2 2" />
        {glyph(P.pencil, sw)}
      </g>
    );
  }
  return (
    <g pointerEvents="none">
      <path d={frame} fill={P.shadow} opacity={0.22} transform={`translate(${s * 0.08} ${s * 0.12})`} />
      <path d={frame} fill={P.die} stroke={P.die} strokeWidth={s * 0.14} strokeLinejoin="round" />
      <path d={frame} fill={R.gold[SHADE]} transform={`translate(${s * 0.03} ${s * 0.06})`} />
      <path d={frame} fill={R.gold[LIT]} />
      <path d={rrect(x - s / 2 - f * 0.6, y - s / 2 - f * 0.6, s + f * 1.2, s * 0.5, s * 0.22)} fill={R.gold[HI]} opacity={0.55} />
      {state === "untrained" ? (
        <>
          <path d={face} fill={R.cream[HI]} />
          <path d={rrect(x - s * 0.4, y - s * 0.4, s * 0.8, s * 0.8, s * 0.16)} fill="none" stroke={R.blue[MID]} strokeWidth={s * 0.04} strokeDasharray={`${s * 0.1} ${s * 0.07}`} />
          {glyph(R.blue[MID], sw)}
        </>
      ) : (
        <>
          <path d={face} fill={R.blue[DEEP]} />
          <path d={rrect(x - s / 2 + s * 0.04, y - s / 2 + s * 0.06, s * 0.96, s * 0.94, s * 0.18)} fill={R.blue[MID]} />
          <path d={face} fill="url(#pa-gloss)" />
          {glyph(R.blue[DEEP], sw * 1.2, s * 0.03, s * 0.05)}
          {glyph("#FFFFFF", sw)}
          <Glint x={x - s * 0.28} y={y - s * 0.22} r={s * 0.1} streak={false} />
        </>
      )}
      {state === "champion" && <StarSeal cx={x + s * 0.55} cy={y - s * 0.55} r={s * 0.34} />}
    </g>
  );
}
