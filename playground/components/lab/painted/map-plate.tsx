"use client";

// "How <model> works" as a plate ON the map: a vignette in the map's own
// plate material (parchment + maroon border + hard shadow on the pixel map,
// cardstock on the paper map) hung beside the selected castle by a leader
// line. The full mechanism diagram sits on its mat at an integer scale (1 art
// px = 1 CSS px, ×2 when the screen has room) so its pixels stay crisp, and it
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
const PAD = 8;       // plate padding
const MAT = 6;       // mat padding around the drawing
const HEAD = 30;     // title row
const FOOT = 24;     // caption row

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
  const btn: CSSProperties = { fontSize: 13, minHeight: 22, padding: "0 7px" };
  return (
    <section ref={ref} aria-label={title} data-map-plate {...data}
      // a tap on the plate is never a tap on the sea (the plate sits outside
      // the stage, but stop it anyway so no future parent counts it)
      onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute left-0 top-0"
      style={{ ...plateStyle(m), fontFamily: m.bodyFont, padding: PAD, width: "max-content", ...style }}>
      <header className="flex items-center justify-between gap-3" style={{ height: HEAD - 6, marginBottom: 6 }}>
        <h2 className="leading-none" style={{ fontFamily: m.signFont, fontWeight: 700, fontSize: m.crisp ? 18 : 21, color: m.crisp ? m.border : m.ink, whiteSpace: "nowrap" }}>
          {title}
        </h2>
        <div className="flex items-center gap-2">
          <Btn m={m} onClick={onEnlarge} label={`Enlarge: ${title}`} title="Enlarge" style={btn}>Enlarge</Btn>
          <Btn m={m} onClick={onClose} label="Close the diagram (Esc)" title="Close (Esc)" style={btn}>Close</Btn>
        </div>
      </header>
      <div style={{ background: th.ground, padding: MAT, border: `var(--ap, 2px) solid ${m.border}`, borderRadius: m.crisp ? 0 : Math.min(3, m.radius), lineHeight: 0 }}>
        <MechanismDiagram name={name} theme={m.diagram} variant="full" still={still} width={ART_W * zoom} fit={false} caption={false} />
      </div>
      <p className="truncate" title={def?.truth} style={{ height: FOOT, paddingTop: 7, fontSize: 13, lineHeight: 1.2, color: m.inkSoft, maxWidth: ART_W * zoom + 2 * MAT }}>
        {def ? sentence(def.badge) : "A generic sketch, not this model's own diagram."}
        {def && " Enlarge for what is computed and what is drawn."}
      </p>
    </section>
  );
});

/** The leader: one straight line of map ink from the castle to the plate's
 * near edge, with a small dot at the castle end. Screen px; `t` = thickness. */
export function Leader({ m, side, castle, edge, t }: { m: Material; side: PlateSide; castle: { x: number; y: number }; edge: number; t: number }) {
  const horiz = side === "right" || side === "left";
  const a = horiz ? castle.x : castle.y;
  const lo = Math.min(a, edge), len = Math.abs(edge - a);
  const dot = m.crisp ? 3 * t : 7;
  const line: CSSProperties = horiz
    ? { left: lo, top: castle.y - t / 2, width: len, height: t }
    : { left: castle.x - t / 2, top: lo, width: t, height: len };
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {/* a cream casing either side, like the map's ribbons, so the ink line
          reads over dark roofs and lava as well as over the sea */}
      <div className="absolute" style={{ ...line, background: m.border, boxShadow: `0 0 0 ${m.crisp ? t / 2 : 1}px ${m.plateHi}` }} />
      <div className="absolute" style={{
        left: castle.x - dot / 2, top: castle.y - dot / 2, width: dot, height: dot,
        background: m.border, borderRadius: m.crisp ? 0 : "50%",
        boxShadow: m.crisp ? `0 0 0 ${t}px ${m.plateHi}` : `0 0 0 1.5px ${m.plateHi}`,
      }} />
    </div>
  );
}
