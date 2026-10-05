"use client";

// "How <model> works" as a plate ON the map: a vignette in the map's own
// plate material (parchment + maroon border + hard shadow on the pixel map,
// cardstock on the paper map) hung beside the selected castle by a leader
// line. The full mechanism diagram sits on its mat at a crisp scale (1 art px
// = 1 CSS px; ×1.5 or ×2 only when that is a whole number of device px AND the
// plate stays within half the visible map — painted-skin plateZoom), and it
// keeps its scrubber / keys; still=1 and reduced motion freeze it (the diagram
// and useTick handle both). Placement + camera: plate-place.ts. The skin
// positions the plate in screen px from the castle's live position, so it
// follows pans and zooms without ever scaling.
import { forwardRef, type CSSProperties } from "react";
import { MechanismDiagram, diagramFor } from "@/components/lab/shared/anatomy2";
import { THEMES } from "@/components/lab/shared/anatomy2/themes";
import { displayName } from "@/components/lab/shared/card-model";
import { Btn, plateStyle } from "./corners/plate";
import type { Material } from "./material";
import type { PlateSide } from "./plate-place";

export const ART_W = 560;
export const ART_H = 316;
// a compact frame: the drawing is the plate, the frame only holds it
const PAD = 8;       // plate padding
const MAT = 4;       // mat padding around the drawing
const HEAD = 28;     // title row (a 22-px button + air)
const FOOT = 20;     // caption row

/** The plate's size before it is measured (CSS px). `ap` = the border width. */
export function plateEstimate(name: string, zoom: number, ap: number): { w: number; h: number } {
  const def = diagramFor(name);
  const ctl = def && (def.scrub || def.interactive) ? (def.keysHint ? 22 : 0) + (def.scrub ? 30 : 0) : 0;
  const w = ART_W * zoom + 2 * (MAT + ap) + 2 * (PAD + ap);
  const h = HEAD + ART_H * zoom + 2 * (MAT + ap) + ctl + FOOT + 2 * (PAD + ap);
  return { w, h };
}

const sentence = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) + "." : "");

export const MapPlate = forwardRef<HTMLElement, {
  m: Material; name: string; still: boolean; zoom: number; style: CSSProperties;
  onEnlarge: () => void; onClose: () => void;
  /** data-* attributes (the placement, for screenshots and tests) */
  data?: Record<`data-${string}`, string>;
}>(function MapPlate({ m, name, still, zoom, style, onEnlarge, onClose, data }, ref) {
  const def = diagramFor(name);
  const th = THEMES[m.diagram];
  const title = `How ${displayName(name)} works`;
  // the drawer's and the full view's buttons: one size for every plate button
  const btn: CSSProperties = { fontSize: 13, minHeight: 22, padding: "0 6px", fontWeight: 500 };
  return (
    <section ref={ref} aria-label={title} data-map-plate {...data}
      // a tap on the plate is never a tap on the sea (the plate sits outside
      // the stage, but stop it anyway so no future parent counts it)
      onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute left-0 top-0"
      style={{ ...plateStyle(m), fontFamily: m.bodyFont, padding: PAD, width: "max-content", ...style }}>
      <header className="flex items-center justify-between gap-3" style={{ height: HEAD - 4, marginBottom: 4 }}>
        <h2 className="leading-none" style={{ fontFamily: m.signFont, fontWeight: 700, fontSize: m.crisp ? 15 : 18, color: m.crisp ? m.border : m.ink, whiteSpace: "nowrap" }}>
          {title}
        </h2>
        <div className="flex items-center gap-1.5">
          <Btn m={m} onClick={onEnlarge} label={`Enlarge: ${title}`} title="Enlarge" style={btn}>Enlarge</Btn>
          <Btn m={m} onClick={onClose} label="Close the diagram (Esc)" title="Close (Esc)" style={btn}>Close</Btn>
        </div>
      </header>
      <div style={{ background: th.ground, padding: MAT, border: `var(--ap, 2px) solid ${m.border}`, borderRadius: m.crisp ? 0 : Math.min(3, m.radius), lineHeight: 0 }}>
        <MechanismDiagram name={name} theme={m.diagram} variant="full" still={still} width={ART_W * zoom} fit={false} caption={false} />
      </div>
      <p className="truncate" title={def?.truth} style={{ height: FOOT, paddingTop: 6, fontSize: 12, lineHeight: 1.2, color: m.inkSoft, maxWidth: ART_W * zoom + 2 * MAT }}>
        {def ? sentence(def.badge) : "A generic sketch, not this model's own diagram."}
        {def && " Enlarge for what is computed and what is drawn."}
      </p>
    </section>
  );
});

/** The leader: one straight line from the castle to the plate's near edge,
 * read at a glance on any terrain — a 2-art-px maroon core in a 1-art-px cream
 * halo (the map's ribbon casing, so it holds over dark roofs and lava as well
 * as over the parchment sea), a dot at the model's spot and a small stepped
 * notch where it docks into the plate's border (drawn over the plate's hard
 * shadow, so the skin paints the leader after the plate). Screen px; `t` = one
 * art px; `edge` = the plate's outer border edge facing the castle. */
export function Leader({ m, side, castle, edge, t }: { m: Material; side: PlateSide; castle: { x: number; y: number }; edge: number; t: number }) {
  const horiz = side === "right" || side === "left";
  // +1 when the plate lies toward larger x / y
  const dir = side === "right" || side === "below" ? 1 : -1;
  const ink = m.crisp ? m.border : m.loud;
  const halo = m.plateHi;
  // pixel: everything in whole art px (t); paper: a pen line at ~2.5 px
  const u = m.crisp ? t : 1.25;
  const a = horiz ? castle.x : castle.y;          // the castle end, along the line
  const c = horiz ? castle.y : castle.x;          // the line's centre, across it
  // a run along the line from `from` to `to`, `half` either side of the centre
  const run = (from: number, to: number, half: number) => {
    const lo = Math.min(from, to), len = Math.abs(to - from);
    return horiz ? { x: lo, y: c - half, w: len, h: 2 * half } : { x: c - half, y: lo, w: 2 * half, h: len };
  };
  const dot = (half: number) => ({ x: castle.x - half, y: castle.y - half, w: 2 * half, h: 2 * half });
  // the core and its pieces: the line, the notch's two steps at the plate's
  // edge (3 then 2 art px either side), the dot (4 art px) at the castle
  const core = [
    run(a, edge, u),
    run(edge - dir * u, edge, 3 * u),
    run(edge - dir * 2 * u, edge - dir * u, 2 * u),
  ];
  const dotHalf = m.crisp ? 2 * u : 4.5;
  type R = { x: number; y: number; w: number; h: number };
  const rects = (list: R[], fill: string, grow: number) =>
    list.map((r, i) => <rect key={i} x={r.x - grow} y={r.y - grow} width={r.w + 2 * grow} height={r.h + 2 * grow} fill={fill} />);
  // the halo grows round the core, except into the plate (its border stays whole)
  const haloOf = (r: R): R => {
    const g = { x: r.x - u, y: r.y - u, w: r.w + 2 * u, h: r.h + 2 * u };
    if (side === "right") { g.w -= u; }                 // plate to the right: no growth at the right end
    else if (side === "left") { g.x += u; g.w -= u; }
    else if (side === "below") { g.h -= u; }
    else { g.y += u; g.h -= u; }
    return g;
  };
  return (
    <svg aria-hidden data-leader className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" shapeRendering={m.crisp ? "crispEdges" : undefined}>
      {/* halo pass under the core pass, so the cream never cuts the ink */}
      {rects(core.map(haloOf), halo, 0)}
      {m.crisp ? rects([dot(dotHalf)], halo, u) : <circle cx={castle.x} cy={castle.y} r={dotHalf + 2} fill={halo} />}
      {rects(core, ink, 0)}
      {m.crisp ? rects([dot(dotHalf)], ink, 0) : <circle cx={castle.x} cy={castle.y} r={dotHalf} fill={ink} />}
      {/* the dot's bright pip: the model's spot, not just the line's end */}
      {m.crisp ? rects([dot(u / 2)], halo, 0) : <circle cx={castle.x} cy={castle.y} r={1.6} fill={halo} />}
    </svg>
  );
}
