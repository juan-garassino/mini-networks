"use client";

// The DFD sheet, in sheet coordinates (lib/world/dfd.ts): the shelf of standalone atoms (a tray
// above the column headers), swim-lane rules and names, the column header row, the line work
// (edges.tsx), and the boxes (box.tsx). Pure render: the board owns the camera, the selection
// and the motion; this decides only what is lit.
import { memo, useMemo } from "react";
import { DFD_SHELF_TEXT, DFD_SHELF_TITLE, type DfdLayout } from "@/lib/world/dfd";
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { Box } from "./box";
import { Connectors, edgeKey, Edges, Labels, type EdgeLight } from "./edges";
import { COLOR, fam, RADIUS, STROKE, TYPE } from "./tokens";
import s from "./flow.module.css";

export { edgeKey };

export interface SheetState {
  states: Map<string, EvidenceState>;
  /** models lit by hover / focus / selection (null = nothing lit) */
  lit: Set<string> | null;
  litEdges: Set<string> | null;
  selected: string | null;
  /** a pipeline being shown: its members in order */
  pipeline: string[] | null;
  /** Konami forward pass: per-model delay (ms) and the run key */
  wave: { key: number; delay: Record<string, number> } | null;
}

export const Sheet = memo(function Sheet({ layout, st, onPick, onHover }: {
  layout: DfdLayout; st: SheetState; onPick: (n: string) => void; onHover: (n: string | null, on: boolean) => void;
}) {
  const { lit, litEdges, selected, pipeline, wave } = st;
  const inPipe = useMemo(() => (pipeline ? new Map(pipeline.map((n, i) => [n, i + 1])) : null), [pipeline]);
  const familyOf = useMemo(() => { const m = new Map(layout.boxes.map((b) => [b.name, b.family])); return (n: string) => m.get(n) ?? ""; }, [layout]);
  const light: EdgeLight = useMemo(() => {
    const edges = new Map(layout.edges.map((e) => [edgeKey(e), e]));
    // a pipeline lights each hop between consecutive members
    const pipeHop = (k: string) => {
      const e = edges.get(k);
      return !!inPipe && !!e && inPipe.has(e.from) && inPipe.get(e.to) === inPipe.get(e.from)! + 1;
    };
    return {
      loud: (k) => (litEdges ? litEdges.has(k) : pipeHop(k)),
      dim: (k) => (litEdges ? !litEdges.has(k) : inPipe ? !pipeHop(k) : false),
    };
  }, [layout, litEdges, inPipe]);
  const dimBox = (n: string) => (lit ? !lit.has(n) : inPipe ? !inPipe.has(n) : false);
  const anyLight = !!(litEdges || inPipe);
  const shelf = layout.shelf;
  return (
    <g>
      {/* the shelf: atoms with no lines, on a tray of their own above the column headers */}
      {shelf && (
        <g>
          <rect x={shelf.x} y={shelf.y} width={shelf.w} height={shelf.h} rx={RADIUS.shelf} fill={COLOR.shelf} />
          <text x={shelf.title.x} y={shelf.title.y + 12} className={s.lane} fontSize={TYPE.lane} fill={COLOR.ink}>{DFD_SHELF_TITLE}</text>
          <text x={shelf.caption.x} y={shelf.caption.y + 11} className={s.head} fontSize={TYPE.shelf} fill={COLOR.inkSoft}>{DFD_SHELF_TEXT}</text>
        </g>
      )}
      {/* swim lanes: a thin rule and the family's name + count */}
      {layout.lanes.map((l) => (
        <g key={l.family}>
          <path d={`M${l.x} ${l.y + 0.5} H${l.x + l.w}`} stroke={COLOR.rule} strokeWidth={STROKE.rule} />
          <text x={l.label.x} y={l.label.y + 12} className={s.lane} fontSize={TYPE.lane} fill={COLOR.ink}>
            {fam(l.family).label}<tspan className={s.count} fill={COLOR.inkSoft} dx={5}>{l.count}</tspan>
          </text>
        </g>
      ))}
      {layout.mode === "desktop" && layout.headers.map((h) => (
        <text key={`${h.stack}:${h.depth}`} x={h.x} y={h.y + 10} className={s.head} fontSize={TYPE.head} fill={COLOR.head}>{h.text}</text>
      ))}
      <Edges layout={layout} light={light} />
      <Labels labels={layout.labels} light={anyLight ? light : null} />
      {layout.boxes.map((b) => (
        <Box key={b.name} b={b} state={st.states.get(b.name) ?? "untrained"} dim={dimBox(b.name)} selected={b.name === selected}
          order={inPipe?.get(b.name) ?? 0} delay={wave ? wave.delay[b.name] ?? null : null} waveKey={wave?.key ?? 0}
          onPick={onPick} onHover={onHover} />
      ))}
      <Connectors pairs={layout.offSheet} familyOf={familyOf} light={light} dimBox={dimBox} radius={layout.radius} />
    </g>
  );
});
