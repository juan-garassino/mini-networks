// Small architectural and natural details shared by the bigger assets:
// windows, doors, flags, merlons, grass tufts, flowers. All design units, all
// lit from the top-left.
import { Fragment } from "react";
import { P, R, type Ramp, LIT, MID, SHADE, DEEP, HI } from "./palette";
import { circ, poly, rrect } from "./geom";

const archD = (x: number, y: number, w: number, h: number) => {
  const r = w / 2;
  return `M${x} ${y + h}V${y + r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h}Z`;
};

/** An arched window: stone frame, dark glass (or lit), mullion, sill, glass glint. */
export function Win({ x, y, w = 6, h = 9, lit = false, frame = R.cream[HI], sill = true, mullion = true }: {
  x: number; y: number; w?: number; h?: number; lit?: boolean; frame?: string; sill?: boolean; mullion?: boolean;
}) {
  const f = Math.max(0.8, w * 0.16);
  return (
    <g>
      <path d={archD(x - f, y - f, w + f * 2, h + f)} fill={frame} />
      <path d={archD(x, y, w, h)} fill={lit ? P.windowLit : P.window} />
      {/* glass: the upper-left pane catches the sky */}
      {!lit && <path d={`M${x + w * 0.2} ${y + h * 0.75}V${y + w * 0.45}Q${x + w * 0.22} ${y + w * 0.2} ${x + w * 0.45} ${y + w * 0.14}`} fill="none" stroke="#9FB6E8" strokeOpacity={0.7} strokeWidth={Math.max(0.5, w * 0.1)} strokeLinecap="round" />}
      {mullion && w >= 5 && <path d={`M${x + w / 2} ${y + w * 0.1}V${y + h}M${x} ${y + h * 0.58}H${x + w}`} stroke={frame} strokeWidth={Math.max(0.5, w * 0.1)} />}
      {sill && <rect x={x - f * 1.4} y={y + h} width={w + f * 2.8} height={f * 1.1} fill={R.cream[MID]} />}
    </g>
  );
}

/** A square window with a shutter pair (houses). */
export function SquareWin({ x, y, w = 7, h = 7, shutter, lit = false }: { x: number; y: number; w?: number; h?: number; shutter?: string; lit?: boolean }) {
  const f = Math.max(0.7, w * 0.12);
  return (
    <g>
      {shutter && <rect x={x - w * 0.42 - f} y={y - f} width={w * 0.42} height={h + f * 2} fill={shutter} />}
      {shutter && <rect x={x + w + f} y={y - f} width={w * 0.42} height={h + f * 2} fill={shutter} />}
      <rect x={x - f} y={y - f} width={w + f * 2} height={h + f * 2} fill={P.die} />
      <rect x={x} y={y} width={w} height={h} fill={lit ? P.windowLit : P.window} />
      {!lit && <path d={`M${x + w * 0.2} ${y + h * 0.7}L${x + w * 0.55} ${y + h * 0.2}`} stroke="#9FB6E8" strokeOpacity={0.7} strokeWidth={Math.max(0.5, w * 0.1)} strokeLinecap="round" />}
      <path d={`M${x + w / 2} ${y}V${y + h}M${x} ${y + h / 2}H${x + w}`} stroke={P.die} strokeWidth={Math.max(0.4, w * 0.09)} />
    </g>
  );
}

/** An arched wooden door: planks, iron bands, a knob, a stone step. */
export function Door({ x, y, w = 10, h = 14, wood = R.wood, frame = R.cream[MID] }: { x: number; y: number; w?: number; h?: number; wood?: Ramp; frame?: string }) {
  const f = w * 0.14;
  return (
    <g>
      <path d={archD(x - f, y - f, w + f * 2, h + f)} fill={frame} />
      <path d={archD(x, y, w, h)} fill={wood[MID]} />
      <path d={archD(x, y, w * 0.5, h)} fill={wood[LIT]} opacity={0.55} />
      {[0.33, 0.66].map((k) => <path key={k} d={`M${x + w * k} ${y + w * 0.2}V${y + h}`} stroke={wood[DEEP]} strokeOpacity={0.55} strokeWidth={w * 0.05} />)}
      <path d={`M${x} ${y + h * 0.42}H${x + w}M${x} ${y + h * 0.78}H${x + w}`} stroke={R.rock[DEEP]} strokeWidth={w * 0.07} />
      <circle cx={x + w * 0.78} cy={y + h * 0.6} r={w * 0.07} fill={R.gold[LIT]} />
      <rect x={x - f * 2} y={y + h} width={w + f * 4} height={f * 1.3} fill={R.cream[SHADE]} />
    </g>
  );
}

/** A flag on a pole: waving cloth with a shaded fold and a lit leading edge. */
export function Pennant({ x, y, h = 20, ramp = R.red, w, emblem }: { x: number; y: number; h?: number; ramp?: Ramp; w?: number; emblem?: "star" | "dot" }) {
  const fw = w ?? h * 0.6, fh = fw * 0.62, top = y - h;
  const cloth = `M${x} ${top}C${x + fw * 0.35} ${top - fh * 0.18} ${x + fw * 0.6} ${top + fh * 0.18} ${x + fw} ${top + fh * 0.05}L${x + fw * 0.82} ${top + fh * 0.5}L${x + fw} ${top + fh}C${x + fw * 0.62} ${top + fh * 1.12} ${x + fw * 0.35} ${top + fh * 0.8} ${x} ${top + fh}Z`;
  const fold = `M${x + fw * 0.45} ${top + fh * 0.02}C${x + fw * 0.6} ${top + fh * 0.12} ${x + fw * 0.66} ${top + fh * 0.5} ${x + fw * 0.6} ${top + fh * 0.96}C${x + fw * 0.45} ${top + fh * 0.9} ${x + fw * 0.4} ${top + fh * 0.9} ${x + fw * 0.35} ${top + fh * 0.88}Z`;
  return (
    <g>
      <path d={cloth} fill={P.die} stroke={P.die} strokeWidth={h * 0.09} strokeLinejoin="round" />
      <path d={`M${x} ${y}V${top - h * 0.04}`} stroke={P.die} strokeWidth={h * 0.13} strokeLinecap="round" />
      <path d={`M${x} ${y}V${top - h * 0.04}`} stroke={R.wood[DEEP]} strokeWidth={h * 0.06} strokeLinecap="round" />
      <path d={cloth} fill={ramp[LIT]} />
      <path d={fold} fill={ramp[SHADE]} opacity={0.75} />
      <path d={`M${x + fw * 0.05} ${top + fh * 0.12}C${x + fw * 0.3} ${top - fh * 0.02} ${x + fw * 0.5} ${top + fh * 0.12} ${x + fw * 0.7} ${top + fh * 0.12}`} fill="none" stroke={ramp[HI]} strokeWidth={h * 0.035} strokeLinecap="round" />
      {emblem === "star" && <path d={starD(x + fw * 0.3, top + fh * 0.5, fh * 0.26)} fill={P.die} />}
      {emblem === "dot" && <circle cx={x + fw * 0.3} cy={top + fh * 0.5} r={fh * 0.16} fill={P.die} />}
      <circle cx={x} cy={top - h * 0.06} r={h * 0.06} fill={R.gold[LIT]} />
    </g>
  );
}
function starD(cx: number, cy: number, r: number) {
  const p: number[] = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r;
    p.push(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
  }
  return poly(...p);
}

/** Crenellations along a wall top: merlons with a lit top and a shaded right cheek. */
export function Merlons({ x0, x1, y, h = 6, w = 6, gap = 4, ramp = R.cream }: { x0: number; x1: number; y: number; h?: number; w?: number; gap?: number; ramp?: Ramp }) {
  const out = [];
  for (let x = x0; x + w <= x1 + 0.01; x += w + gap) {
    out.push(
      <Fragment key={x}>
        <rect x={x} y={y - h} width={w} height={h} fill={ramp[LIT]} />
        <rect x={x + w * 0.72} y={y - h} width={w * 0.28} height={h} fill={ramp[SHADE]} />
        <rect x={x} y={y - h} width={w} height={h * 0.18} fill={ramp[HI]} />
      </Fragment>,
    );
  }
  return <g>{out}</g>;
}
/** The silhouette of the merlon row (for a Cutout). */
export function merlonsD(x0: number, x1: number, y: number, h = 6, w = 6, gap = 4) {
  let d = "";
  for (let x = x0; x + w <= x1 + 0.01; x += w + gap) d += rrect(x, y - h, w, h + 1, 0.4);
  return d;
}

/** A spiky grass tuft: three blades, lit left blade, shaded right blade. */
export function Tuft({ x, y, s = 1, ramp = R.grass }: { x: number; y: number; s?: number; ramp?: Ramp }) {
  const b = (dx: number, h: number, lean: number) => `M${x + (dx - 1.4) * s} ${y}Q${x + (dx + lean * 0.4) * s} ${y - h * 0.6 * s} ${x + (dx + lean) * s} ${y - h * s}Q${x + (dx + lean * 0.3 + 0.6) * s} ${y - h * 0.5 * s} ${x + (dx + 1.4) * s} ${y}Z`;
  return (
    <g>
      <path d={b(-2.4, 7, -3)} fill={ramp[LIT]} />
      <path d={b(2.4, 7.5, 3)} fill={ramp[SHADE]} />
      <path d={b(0, 10, 0.6)} fill={ramp[MID]} />
    </g>
  );
}

/** A small paper flower: 5 petals (lit upper-left ones lighter), a gold centre. */
export function Flower({ x, y, r = 3, ramp = R.pink, stem = 6 }: { x: number; y: number; r?: number; ramp?: Ramp; stem?: number }) {
  const cy = y - stem;
  const petals = [0, 1, 2, 3, 4].map((k) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
    return { x: x + Math.cos(a) * r * 0.62, y: cy + Math.sin(a) * r * 0.62, lit: Math.cos(a) + Math.sin(a) < 0 };
  });
  return (
    <g>
      <path d={`M${x} ${y}Q${x - 0.6} ${y - stem * 0.5} ${x} ${cy}`} fill="none" stroke={R.leaf[SHADE]} strokeWidth={r * 0.28} strokeLinecap="round" />
      <path d={`M${x} ${y - stem * 0.35}q${r * 0.9} ${-r * 0.2} ${r * 1.1} ${-r * 0.9}q${-r * 0.8} ${0} ${-r * 1.1} ${r * 0.9}Z`} fill={R.leaf[LIT]} />
      {petals.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={r * 0.52} fill={p.lit ? ramp[LIT] : ramp[MID]} />)}
      <circle cx={x} cy={cy} r={r * 0.36} fill={R.gold[LIT]} />
      <circle cx={x - r * 0.1} cy={cy - r * 0.12} r={r * 0.14} fill={R.gold[HI]} />
    </g>
  );
}

/** A little heap of rocks (for set-piece bases): three lit/shade boulders. */
export function Boulder({ x, y, r = 6, ramp = R.rock }: { x: number; y: number; r?: number; ramp?: Ramp }) {
  return (
    <g>
      <path d={`M${x - r} ${y}Q${x - r * 1.05} ${y - r * 0.9} ${x - r * 0.1} ${y - r}Q${x + r * 0.9} ${y - r * 0.95} ${x + r} ${y}Z`} fill={ramp[MID]} />
      <path d={`M${x - r} ${y}Q${x - r * 1.05} ${y - r * 0.9} ${x - r * 0.1} ${y - r}Q${x - r * 0.3} ${y - r * 0.4} ${x - r * 0.2} ${y}Z`} fill={ramp[LIT]} />
      <path d={`M${x + r * 0.35} ${y}Q${x + r * 0.55} ${y - r * 0.55} ${x + r * 0.3} ${y - r * 0.92}Q${x + r * 0.9} ${y - r * 0.8} ${x + r} ${y}Z`} fill={ramp[SHADE]} />
      <path d={`M${x - r * 0.75} ${y - r * 0.55}Q${x - r * 0.55} ${y - r * 0.9} ${x - r * 0.1} ${y - r * 0.92}`} fill="none" stroke={ramp[HI]} strokeWidth={r * 0.14} strokeLinecap="round" />
    </g>
  );
}

export const dot = (x: number, y: number, r: number) => circ(x, y, r);
