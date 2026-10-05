"use client";

// /lab/flow/specimen — the Kawaii DFD's signature element on its own: the router. Plain grey
// boxes, every builds_on edge routed orthogonally with one elbow radius, arrowheads at
// distinct input ports, inline labels in gaps, connector pairs where a line would detour —
// drawn with the skin's own line-work components — and the sheet's audit on the SVG.
// ?mode=mobile shows the phone sheet.
import { useSyncExternalStore } from "react";
import { useWorld } from "@/hooks/use-world";
import type { DfdMode } from "@/lib/world/dfd";
import { Connectors, Edges, Labels } from "@/components/lab/flow";
import { useDfd, useFlowFont } from "@/components/lab/flow/use-dfd";
import { COLOR, FLOW_CSS_VARS, TYPE } from "@/components/lab/flow/tokens";

const NONE = { loud: () => false, dim: () => false };

export default function FlowSpecimen() {
  const mode = useSyncExternalStore<DfdMode | null>(
    () => () => {},
    () => (new URLSearchParams(window.location.search).get("mode") === "mobile" ? "mobile" : "desktop"),
    () => null,
  );
  const { taxonomy, family } = useWorld(true);
  const measure = useFlowFont();
  const l = useDfd(taxonomy, family, mode, measure);
  const familyOf = (n: string) => l?.boxes.find((b) => b.name === n)?.family ?? "";
  return (
    <div data-flow-root className="min-h-full w-full overflow-auto" style={{ ...FLOW_CSS_VARS, background: COLOR.sheet, fontFamily: "var(--flow-body)" }}
      data-lab-ready={l ? "1" : undefined}>
      {!l && <p className="p-6" style={{ color: COLOR.inkSoft, fontSize: TYPE.body }}>Routing the sheet…</p>}
      {l && (
        <svg width={l.width} height={l.height} viewBox={`0 0 ${l.width} ${l.height}`} className="mx-auto block"
          data-crossings={l.audit.crossings} data-overlaps={l.audit.overlaps} data-box-hits={l.audit.boxHits} data-detours={l.audit.detours} data-off-sheet={l.offSheet.length}>
          {l.lanes.map((ln) => <path key={ln.family} d={`M${ln.x} ${ln.y + 0.5} H${ln.x + ln.w}`} stroke={COLOR.rule} />)}
          {l.boxes.map((b) => (
            <g key={b.name}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={7} fill={COLOR.meterTrack} stroke={COLOR.axis} />
              <text x={b.x + 8} y={b.y + b.h / 2 + 4} fontSize={TYPE.small} fontWeight={700} fill={COLOR.inkSoft}>{b.lines.join(" ")}</text>
            </g>
          ))}
          <Edges layout={l} light={NONE} />
          <Labels labels={l.labels} light={null} />
          <Connectors pairs={l.offSheet} familyOf={familyOf} light={NONE} dimBox={() => false} radius={l.radius} />
          <text x={l.width - 8} y={l.height - 6} textAnchor="end" fontSize={TYPE.label} fill={COLOR.inkSoft}>
            {`${l.edges.length} edges · crossings ${l.audit.crossings} · overlaps ${l.audit.overlaps} · box hits ${l.audit.boxHits} · detours ${l.audit.detours} · off-sheet ${l.offSheet.length}`}
          </text>
        </svg>
      )}
    </div>
  );
}
