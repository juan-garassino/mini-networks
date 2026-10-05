"use client";

// "How <model> works" as a plate ON the map: a vignette in the map's own
// plate material (parchment + maroon border + hard shadow on the pixel map,
// cardstock on the paper map) hung beside the selected castle by a leader
// line. The plate keeps the diagram kit's legibility floor
// (anatomy2/legible.ts): the full drawing at the smallest crisp zoom whose
// labels read (×1.5 on a retina screen = 3 device px per art px, 10.5-px
// caps), or — when the castle and that plate fit nowhere together — the card
// composition at ×2 with the full drawing one click away (Enlarge, or a tap
// on the card). Never the full drawing at ×1 (7-px caps). The skin picks the
// fit (painted-skin plateFits); the full drawing keeps its scrubber / keys;
// still=1 and reduced motion freeze it (the diagram and useTick handle both).
// The frame is one row: title, the real-vs-illustrative badge, Enlarge,
// Close — the drawer beside it holds the prose. Placement + camera:
// plate-place.ts. The skin positions the plate in screen px from the
// castle's live position, so it follows pans and zooms without ever scaling.
import { forwardRef, type CSSProperties } from "react";
import { MechanismDiagram, diagramFor } from "@/components/lab/shared/anatomy2";
import { THEMES } from "@/components/lab/shared/anatomy2/themes";
import { displayName } from "@/components/lab/shared/card-model";
import { Btn, plateStyle } from "./corners/plate";
import { TYPE, howItWorks, sign, textFace, type Material } from "./material";
import type { PlateSide } from "./plate-place";

export const ART_W = 560;
export const ART_H = 316;
// a compact frame: the drawing is the plate, the frame only holds it
const PAD = 6;       // plate padding
const MAT = 4;       // mat padding around the drawing
const HEAD = 28;     // the one chrome row (a 22-px button + air)

/** What the plate shows: the full drawing or the card, at a zoom (CSS px per art px). */
export interface PlateFit { variant: "full" | "card"; zoom: number }

/** The drawing's art size for a fit (the card's height is per diagram). */
function artOf(name: string, variant: PlateFit["variant"]): { w: number; h: number } {
  const def = diagramFor(name);
  return variant === "card" && def ? def.card.view : { w: ART_W, h: ART_H };
}

/** The plate's size before it is measured (CSS px). `ap` = the border width. */
export function plateEstimate(name: string, fit: PlateFit, ap: number): { w: number; h: number } {
  const def = diagramFor(name);
  const art = artOf(name, fit.variant);
  const ctl = fit.variant === "full" && def && (def.scrub || def.interactive) ? (def.keysHint ? 27 : 0) + (def.scrub ? 32 : 0) : 0;
  const w = art.w * fit.zoom + 2 * (MAT + ap) + 2 * (PAD + ap);
  const h = HEAD + art.h * fit.zoom + 2 * (MAT + ap) + ctl + 2 * (PAD + ap);
  return { w: Math.ceil(w), h: Math.ceil(h) };
}

export const MapPlate = forwardRef<HTMLElement, {
  m: Material; name: string; still: boolean; fit: PlateFit; style: CSSProperties;
  onEnlarge: () => void; onClose: () => void;
  /** data-* attributes (the placement, for screenshots and tests) */
  data?: Record<`data-${string}`, string>;
}>(function MapPlate({ m, name, still, fit, style, onEnlarge, onClose, data }, ref) {
  const def = diagramFor(name);
  const th = THEMES[m.diagram];
  const title = `How ${displayName(name)} works`;
  const art = artOf(name, fit.variant);
  const drawW = art.w * fit.zoom;
  // the drawer's and the full view's buttons: one size for every plate button
  const btn: CSSProperties = { fontSize: TYPE.button, minHeight: 22, padding: "0 6px", fontWeight: 500 };
  const badge = def ? def.badge : "a generic sketch";
  return (
    <section ref={ref} aria-label={title} data-map-plate data-plate-variant={fit.variant} data-plate-zoom={String(fit.zoom)} {...data}
      // a tap on the plate is never a tap on the sea (the plate sits outside
      // the stage, but stop it anyway so no future parent counts it)
      onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute left-0 top-0"
      // the frame is exactly the drawing's width: the chrome row never widens it
      style={{ ...plateStyle(m), fontFamily: m.bodyFont, padding: PAD, width: `calc(${drawW + 2 * (MAT + PAD)}px + 4 * var(--ap, 2px))`, ...style }}>
      <header className="flex items-center gap-2" style={{ height: HEAD - 4, marginBottom: 4 }}>
        <h2 className="min-w-0 shrink truncate leading-none" style={{ fontFamily: m.signFont, fontWeight: 700, fontSize: sign(m, TYPE.plateTitle), color: m.crisp ? m.border : m.ink, whiteSpace: "nowrap" }}>
          {howItWorks(m, displayName(name))}
        </h2>
        {/* what is real vs illustrative: the badge travels with the drawing */}
        <p className="min-w-0 flex-1 truncate" title={def?.truth} style={{ fontFamily: textFace(m), fontSize: TYPE.caption, lineHeight: 1.2, color: m.inkSoft }}>
          {badge}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <Btn m={m} onClick={onEnlarge} label={`Enlarge: ${title}`} title="Enlarge: the whole drawing, what is computed and what is drawn" style={btn}>Enlarge</Btn>
          <Btn m={m} onClick={onClose} label="Close the diagram (Esc)" title="Close (Esc)" style={btn}>Close</Btn>
        </div>
      </header>
      <div style={{ background: th.ground, padding: MAT, border: `var(--ap, 2px) solid ${m.border}`, borderRadius: m.radius, lineHeight: 0 }}>
        {fit.variant === "full"
          ? <MechanismDiagram name={name} theme={m.diagram} variant="full" still={still} width={drawW} fit={false} caption={false} />
          // below the floor: the card, its tap = Enlarge (the full drawing)
          : <MechanismDiagram name={name} theme={m.diagram} variant="card" still={still} width={drawW} caption={false} onOpen={() => { onEnlarge(); return true; }} />}
      </div>
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
