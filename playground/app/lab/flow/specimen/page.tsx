"use client";

// /lab/flow/specimen — the Kawaii DFD's signature element on its own: the router.
// Plain grey boxes, every builds_on edge routed orthogonally with one elbow radius,
// arrowheads at distinct input ports, inline labels in gaps — and the sheet's own
// audit (crossings / overlaps / box hits) on the SVG. ?mode=mobile shows the phone sheet.
import { useSyncExternalStore } from "react";
import { useWorld } from "@/hooks/use-world";
import { elbowD, type DfdMode } from "@/lib/world/dfd";
import { useDfd, useFlowFont } from "@/components/lab/flow/use-dfd";
import { INK, INK_SOFT, RULE, SHEET } from "@/components/lab/flow/palette";

export default function FlowSpecimen() {
  const mode = useSyncExternalStore<DfdMode | null>(
    () => () => {},
    () => (new URLSearchParams(window.location.search).get("mode") === "mobile" ? "mobile" : "desktop"),
    () => null,
  );
  const { taxonomy, family } = useWorld(true);
  const measure = useFlowFont();
  const l = useDfd(taxonomy, family, mode, measure);
  return (
    <div data-flow-root className="min-h-full w-full overflow-auto" style={{ background: SHEET, fontFamily: "var(--flow-body)" }}
      data-lab-ready={l ? "1" : undefined}>
      {!l && <p className="p-6 text-[15px]" style={{ color: INK_SOFT }}>Routing the sheet…</p>}
      {l && (
        <svg width={l.width} height={l.height} viewBox={`0 0 ${l.width} ${l.height}`} className="mx-auto block"
          data-crossings={l.audit.crossings} data-overlaps={l.audit.overlaps} data-box-hits={l.audit.boxHits} data-off-sheet={l.offSheet.length}>
          {l.lanes.map((ln) => <path key={ln.family} d={`M${ln.x} ${ln.y + 0.5} H${ln.x + ln.w}`} stroke={RULE} />)}
          {l.boxes.map((b) => <rect key={b.name} x={b.x} y={b.y} width={b.w} height={b.h} rx={7} fill="#EDECF1" stroke="#B9B5C6" />)}
          {l.boxes.map((b) => <text key={b.name} x={b.x + 8} y={b.y + 24} fontSize={12} fontWeight={700} fill={INK_SOFT}>{b.lines.join(" ")}</text>)}
          <g fill="none" stroke={INK} strokeWidth={1.5}>
            {l.edges.filter((e) => e.points.length > 1).map((e) => {
              const z = e.points[e.points.length - 1], y = e.points[e.points.length - 2];
              const ux = Math.sign(z.x - y.x), uy = Math.sign(z.y - y.y);
              return (
                <g key={`${e.from}->${e.to}`}>
                  <path d={elbowD(e.points, l.radius)} />
                  <path d={`M${z.x} ${z.y} l${-ux * 7 - uy * 3.6} ${-uy * 7 + ux * 3.6} l${uy * 7.2} ${-ux * 7.2} Z`} fill={INK} stroke="none" />
                </g>
              );
            })}
          </g>
          {l.labels.map((lb) => (
            <g key={`${lb.x}:${lb.y}`}>
              <rect x={lb.x} y={lb.y} width={lb.w} height={lb.h} fill={SHEET} />
              <text x={lb.x + lb.w / 2} y={lb.y + lb.h / 2 + 3.8} textAnchor="middle" fontSize={11} fontWeight={700} fill={INK_SOFT}>{lb.text}</text>
            </g>
          ))}
          <text x={l.width - 8} y={l.height - 6} textAnchor="end" fontSize={11} fill={INK_SOFT}>
            {`${l.edges.length} edges · crossings ${l.audit.crossings} · overlaps ${l.audit.overlaps} · box hits ${l.audit.boxHits} · off-sheet ${l.offSheet.length}`}
          </text>
        </svg>
      )}
    </div>
  );
}
