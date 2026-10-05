"use client";

// One model on the sheet, in sheet coordinates. Three shapes (encoding.ts):
//   process — a derived model: a family-pastel header strip (lineage address + evidence mark)
//             over the creature and the name;
//   store   — an atom: a pastel index cell (its number) left of the creature and the name;
//   chip    — an island atom (no edges yet): a compact store on its lane's title row.
// Focusable and clickable; the board owns what selection means.
import { memo } from "react";
import type { DfdBox } from "@/lib/world/dfd";
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { Critter, EvidenceMark } from "./critter";
import { BOX, COLOR, fam, OPACITY, STROKE, TYPE } from "./tokens";
import s from "./flow.module.css";

const words = (n: string) => n.replace(/_/g, " ");

export interface BoxProps {
  b: DfdBox;
  state: EvidenceState;
  dim: boolean;
  selected: boolean;
  /** 1-based position in a shown pipeline (0 = not in it) */
  order: number;
  /** Konami forward pass: this box's hop delay (ms), or null */
  delay: number | null;
  waveKey: number;
  onPick: (n: string) => void;
  onHover: (n: string | null, on: boolean) => void;
}

export const Box = memo(function Box({ b, state, dim, selected, order, delay, waveKey, onPick, onHover }: BoxProps) {
  const f = fam(b.family);
  const { x, y, w, h } = b;
  const r = BOX.radius;
  const store = b.atom;
  const cs = b.chip ? 22 : BOX.critter(h);
  const bodyY = store ? y : y + BOX.strip;
  const bodyH = store ? h : h - BOX.strip;
  const critterX = (store ? x + BOX.cell : x) + BOX.pad.left;
  const nameX = critterX + cs + BOX.pad.gap;
  const mid = bodyY + bodyH / 2;
  const two = b.lines.length > 1;
  const base = two ? [mid - TYPE.nameLeading / 2 + 4.4, mid + TYPE.nameLeading / 2 + 4.4] : [mid + 4.6];
  const stroke = selected || order > 0 ? COLOR.accent : COLOR.ink;
  const kind = b.chip ? "atom, nothing builds on it yet" : store ? "atom" : `generation ${b.depth}`;
  return (
    <g role="button" tabIndex={0} aria-label={`${words(b.name)}, ${kind}, ${state}`}
      data-model={b.name} className={`${s.box} ${delay != null ? s.hop : ""}`} key={delay != null ? waveKey : undefined}
      style={{ opacity: dim ? OPACITY.dimBox : 1, ["--d" as string]: `${delay ?? 0}ms` }}
      onClick={() => onPick(b.name)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(b.name); } }}
      onMouseEnter={() => onHover(b.name, true)} onMouseLeave={() => onHover(b.name, false)}
      onFocus={() => onHover(b.name, true)} onBlur={() => onHover(b.name, false)}>
      {selected && (
        <rect x={x - BOX.halo} y={y - BOX.halo} width={w + 2 * BOX.halo} height={h + 2 * BOX.halo} rx={r + 3}
          fill="none" stroke={COLOR.accent} strokeOpacity={OPACITY.halo} strokeWidth={STROKE.halo} />
      )}
      <rect x={x} y={y} width={w} height={h} rx={r} fill={COLOR.card} />
      {store ? (
        <>
          <path d={`M${x + BOX.cell} ${y} H${x + r} Q${x} ${y} ${x} ${y + r} V${y + h - r} Q${x} ${y + h} ${x + r} ${y + h} H${x + BOX.cell} Z`} fill={f.strip} />
          <path d={`M${x + BOX.cell} ${y} V${y + h}`} stroke={COLOR.ink} strokeWidth={STROKE.strip} />
          <text x={x + BOX.cell / 2} y={y + h / 2 + 4.2} textAnchor="middle" className={s.addr} fontSize={TYPE.index} fill={COLOR.ink}>{b.address}</text>
          <EvidenceMark state={state} x={x + w - 9} y={y + 9} />
        </>
      ) : (
        <>
          <path d={`M${x} ${y + BOX.strip} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + BOX.strip} Z`} fill={f.strip} />
          <path d={`M${x} ${y + BOX.strip} H${x + w}`} stroke={COLOR.ink} strokeWidth={STROKE.strip} />
          <text x={x + 7} y={y + 9.3} className={s.addr} fontSize={TYPE.address} fill={COLOR.ink}>{b.address}</text>
          <EvidenceMark state={state} x={x + w - 9} y={y + 6} />
        </>
      )}
      <Critter family={b.family} state={state} x={critterX} y={bodyY + (bodyH - cs) / 2} size={cs} />
      <rect x={x} y={y} width={w} height={h} rx={r} fill="none" stroke={stroke}
        strokeWidth={selected ? STROKE.boxSelected : order > 0 ? STROKE.boxPipeline : STROKE.box} />
      <text className={s.name} fontSize={TYPE.name} fill={COLOR.ink}>
        {b.lines.map((l, i) => <tspan key={i} x={nameX} y={base[i]}>{l}</tspan>)}
      </text>
      {order > 0 && (
        <g transform={`translate(${x + w} ${y})`}>
          <circle r={8} fill={COLOR.accent} stroke={COLOR.card} strokeWidth={1.5} />
          <text y={3.6} textAnchor="middle" className={s.addr} fontSize={10} fill={COLOR.onAccent}>{order}</text>
        </g>
      )}
    </g>
  );
});
