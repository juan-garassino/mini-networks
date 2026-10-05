"use client";

// The model drawer: only when a model is selected. Desktop: a 440-px sheet
// sliding in from the right (the camera refits to the remaining width); phones:
// the peek / half / full bottom sheet with a drag handle. "Open full diagram"
// (or the map plate's Enlarge) takes over the whole stage with the mechanism
// diagram and a way back. diagramOn="map": the desktop card is text only, so
// the drawer narrows to DRAWER_W_MAP and the map gets the width back.
// The way back stays put while the card scrolls (a sticky bar on desktop; on
// phones it shares the drag handle's row), and a stepped fade at the foot says
// there is more below until the end is reached.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MechanismDiagram } from "@/components/lab/shared/anatomy2";
import { displayName, type CardModel } from "@/components/lab/shared/card-model";
import { CardBody, DiagramMat, type CardGlyph } from "./card";
import { Btn, sheetGround } from "./corners/plate";
import { DRAWER, MOTION, TYPE, howItWorks, type Material } from "./material";

export type Sheet = "peek" | "half" | "full";
export const DRAWER_W = DRAWER.w;
/** diagramOn="map": the card is text only (material.ts DRAWER.wMap) and hands 104 px back to the map */
export const DRAWER_W_MAP = DRAWER.wMap;
/** the desktop drawer's width for where the diagram lives (camera + plate placement read this) */
export const drawerWidth = (diagramOn: "drawer" | "map" = "drawer") => (diagramOn === "map" ? DRAWER_W_MAP : DRAWER_W);

const SNAP: Record<Sheet, number> = DRAWER.snap;
export function sheetHeight(s: Sheet, vh: number): number {
  return Math.round(Math.max(150, vh * SNAP[s]));
}

export interface DrawerProps {
  m: Material;
  mobile: boolean;
  sheet: Sheet;
  setSheet: (s: Sheet) => void;
  card: CardModel;
  still: boolean;
  onPick: (n: string) => void;
  onBack: () => void;
  stateOf: (n: string) => CardModel["state"];
  isAtom: (n: string) => boolean;
  fullDiagram: boolean;
  setFullDiagram: (v: boolean) => void;
  stageW: number;
  /** where the diagram lives on desktop: in the card (default) or on the map
   * as a plate (painted); phones always keep it in the sheet */
  diagramOn?: "drawer" | "map";
  /** diagramOn "map" and the plate is closed: reopen it */
  onShowDiagram?: () => void;
  /** the card's evidence glyph (default: the painted maps' banner / stone, or marker) */
  glyph?: CardGlyph;
}

export function Drawer(p: DrawerProps) {
  const { m, card } = p;
  const dw = drawerWidth(p.diagramOn);
  const narrow = dw < DRAWER_W;
  const body = (
    <CardBody card={card} theme={m} still={p.still} onPick={p.onPick} stateOf={p.stateOf} isAtom={p.isAtom}
      diagramWidth={p.mobile ? Math.max(240, Math.min(380, p.stageW - 40)) : dw - 48}
      onOpenDiagram={() => p.setFullDiagram(true)}
      diagramOn={p.mobile ? "drawer" : p.diagramOn ?? "drawer"} onShowDiagram={p.onShowDiagram} glyph={p.glyph} />
  );
  const back = (
    // the same words as the cartouche's link and the compass hub: it closes the
    // card and returns to the whole map
    <Btn m={m} onClick={p.onBack} label="Close the card: whole map" title="Whole map (Esc)" style={{ fontSize: TYPE.button, minHeight: 26, fontWeight: 500 }}>← Whole map</Btn>
  );
  if (p.fullDiagram) {
    return (
      <div role="dialog" aria-label={`How ${displayName(card.name)} works`} className="absolute inset-0 z-30 overflow-auto"
        style={{ background: sheetGround(m), color: m.ink, fontFamily: m.bodyFont }}>
        {/* the map plate's title bar, at stage size: title left, the way back right */}
        <div className="mx-auto flex items-center justify-between gap-4 px-5 pt-5" style={{ maxWidth: Math.min(1120, p.stageW - 64) + 40 }}>
          <h2 className="leading-none" style={{ fontFamily: m.signFont, fontWeight: 700, fontSize: TYPE.sheetTitle, color: m.crisp ? m.border : m.ink }}>
            {howItWorks(m, displayName(card.name))}
          </h2>
          <Btn m={m} onClick={() => p.setFullDiagram(false)} label="Back to the map (Esc)" title="Back to the map (Esc)" style={{ fontSize: TYPE.link, minHeight: 28, fontWeight: 500 }}>Back to the map</Btn>
        </div>
        <div className="px-5 pb-8 pt-4">
          <DiagramMat m={m} className="mx-auto w-fit">
            <MechanismDiagram name={card.name} theme={m.diagram} variant="full" still={p.still} width={Math.min(1120, p.stageW - 64)} />
          </DiagramMat>
        </div>
      </div>
    );
  }
  if (!p.mobile) return <DeskSheet {...p} dw={dw} narrow={narrow} back={back} body={body} />;
  return <SheetShell {...p} header={back} body={body} />;
}

/** true while the scroller has more below its fold (re-checked on scroll + resize) */
function useMoreBelow(key: unknown) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // more than the sheet's own foot padding still below the fold
    const on = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 24);
    on();
    el.addEventListener("scroll", on, { passive: true });
    const ro = new ResizeObserver(on);
    ro.observe(el);
    for (const c of el.children) ro.observe(c);
    return () => { el.removeEventListener("scroll", on); ro.disconnect(); };
  }, [key]);
  return { ref, more };
}

/** the foot of a scrolling sheet while there is more below: the ground
 * fading up over the last lines */
function MoreFade({ m, more }: { m: Material; more: boolean }) {
  const g = m.plateHi; // #rrggbb (material.ts): the fade appends alpha
  return (
    <div aria-hidden className="pointer-events-none sticky bottom-0 -mt-8 h-8 flex-none"
      style={{ opacity: more ? 1 : 0, background: `linear-gradient(180deg, ${g}00, ${g}e6 70%, ${g})`}} />
  );
}

function DeskSheet(p: DrawerProps & { dw: number; narrow: boolean; back: ReactNode; body: ReactNode }) {
  const { m, card } = p;
  const { ref, more } = useMoreBelow(card.name);
  const pad = p.narrow ? "px-5" : "px-6";
  // a new model starts at the top of its card
  useEffect(() => { ref.current?.scrollTo({ top: 0 }); }, [card.name, ref]);
  return (
    <aside ref={ref} aria-label={`${displayName(card.name)} card`} className="absolute inset-y-0 right-0 z-20 flex flex-col overflow-y-auto"
      style={{ width: p.dw, background: sheetGround(m), color: m.ink, fontFamily: m.bodyFont,
        borderLeft: `var(--ap, 2px) solid ${m.border}`,
        boxShadow: m.crisp ? `inset var(--ap) 0 0 ${m.rule}, calc(var(--ap) * -1) 0 0 ${m.shadow}` : m.card ? m.card.dropLeft : `-3px 0 0 ${m.shadow}` }}>
      <div className={`sticky top-0 z-10 flex-none ${pad} pb-3 pt-4`} style={{ background: sheetGround(m) }}>{p.back}</div>
      <div className={`${pad} pb-8 pt-1`}>{p.body}</div>
      <MoreFade m={m} more={more} />
    </aside>
  );
}

function SheetShell(p: DrawerProps & { header: ReactNode; body: ReactNode }) {
  const { m } = p;
  const [vh, setVh] = useState(800);
  useEffect(() => {
    const on = () => setVh(window.innerHeight);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ y: number; h: number } | null>(null);
  const h = drag ?? sheetHeight(p.sheet, vh);
  const release = () => {
    if (drag == null) return;
    const frac = drag / vh;
    const best = (Object.keys(SNAP) as Sheet[]).reduce((a, b) => (Math.abs(SNAP[b] - frac) < Math.abs(SNAP[a] - frac) ? b : a));
    p.setSheet(best);
    setDrag(null);
    start.current = null;
  };
  const { ref, more } = useMoreBelow(p.card.name);
  return (
    <aside aria-label="Model card" className="absolute inset-x-0 bottom-0 z-20 flex flex-col"
      style={{ height: h, background: sheetGround(m), color: m.ink, borderTop: `var(--ap, 2px) solid ${m.border}`, boxShadow: `0 calc(var(--ap, 2px) * -1) 0 ${m.shadow}`, fontFamily: m.bodyFont,
        transition: drag == null && !p.still ? `height ${MOTION.sheet}` : "none" }}>
      {/* one row: the drag handle across it, the way back on its left */}
      <div className="relative flex h-11 flex-none items-center px-4">
        <button type="button" aria-label={p.sheet === "full" ? "Collapse the card" : "Expand the card"}
          className="absolute inset-0 flex touch-none items-center justify-center"
          onClick={() => p.setSheet(p.sheet === "peek" ? "half" : p.sheet === "half" ? "full" : "peek")}
          onPointerDown={(e) => { start.current = { y: e.clientY, h }; (e.currentTarget as Element).setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (start.current) setDrag(Math.max(120, Math.min(vh * 0.92, start.current.h + start.current.y - e.clientY))); }}
          onPointerUp={release} onPointerCancel={release}>
          <span aria-hidden className="block h-1.5 w-12" style={{ background: m.border }} />
        </button>
        <div className="relative">{p.header}</div>
      </div>
      <div ref={ref} className="flex flex-1 flex-col overflow-y-auto px-4 pb-4">
        <div className="pt-1">{p.body}</div>
        <MoreFade m={m} more={more} />
      </div>
    </aside>
  );
}
