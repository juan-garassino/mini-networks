"use client";

// The model drawer: only when a model is selected. Desktop: a 440-px sheet
// sliding in from the right (the camera refits to the remaining width); phones:
// the peek / half / full bottom sheet with a drag handle. "Open full diagram"
// (or the map plate's Enlarge) takes over the whole stage with the mechanism
// diagram and a way back. diagramOn="map": the desktop card is text only, so
// the drawer narrows to DRAWER_W_MAP and the map gets the width back.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MechanismDiagram } from "@/components/lab/shared/anatomy2";
import { displayName, type CardModel } from "@/components/lab/shared/card-model";
import { CardBody, DiagramMat } from "./card";
import { Btn, sheetGround } from "./corners/plate";
import type { Material } from "./material";

export type Sheet = "peek" | "half" | "full";
export const DRAWER_W = 440;
/** diagramOn="map": the card is text only — 336 px keeps a ~290-px measure of
 * 16-px body text (≈ 40 characters a line) and hands 104 px back to the map */
export const DRAWER_W_MAP = 336;
/** the desktop drawer's width for where the diagram lives (camera + plate placement read this) */
export const drawerWidth = (diagramOn: "drawer" | "map" = "drawer") => (diagramOn === "map" ? DRAWER_W_MAP : DRAWER_W);

const SNAP: Record<Sheet, number> = { peek: 0.2, half: 0.5, full: 0.88 };
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
}

export function Drawer(p: DrawerProps) {
  const { m, card } = p;
  const dw = drawerWidth(p.diagramOn);
  const narrow = dw < DRAWER_W;
  const body = (
    <CardBody card={card} theme={m} still={p.still} onPick={p.onPick} stateOf={p.stateOf} isAtom={p.isAtom}
      diagramWidth={p.mobile ? Math.max(240, Math.min(380, p.stageW - 40)) : dw - 48}
      onOpenDiagram={() => p.setFullDiagram(true)}
      diagramOn={p.mobile ? "drawer" : p.diagramOn ?? "drawer"} onShowDiagram={p.onShowDiagram} />
  );
  const back = (
    <Btn m={m} onClick={p.onBack} label="Back to the map" style={{ fontSize: 14, minHeight: 26 }}>← Back to the map</Btn>
  );
  if (p.fullDiagram) {
    return (
      <div role="dialog" aria-label={`How ${displayName(card.name)} works`} className="absolute inset-0 z-30 overflow-auto"
        style={{ background: sheetGround(m), color: m.ink, fontFamily: m.bodyFont }}>
        <div className="flex items-center gap-3 px-5 pt-4">
          <Btn m={m} onClick={() => p.setFullDiagram(false)} label="Back to the map" style={{ fontSize: 14, minHeight: 26 }}>← Back to the map</Btn>
          <h2 className="leading-none" style={{ fontFamily: m.signFont, fontWeight: 700, fontSize: 24, color: m.crisp ? m.border : m.ink }}>
            How {displayName(card.name)} works
          </h2>
        </div>
        <div className="px-5 pb-8 pt-4">
          <DiagramMat m={m} className="mx-auto w-fit">
            <MechanismDiagram name={card.name} theme={m.diagram} variant="full" still={p.still} width={Math.min(1120, p.stageW - 64)} />
          </DiagramMat>
        </div>
      </div>
    );
  }
  if (!p.mobile) {
    return (
      <aside aria-label={`${displayName(card.name)} card`} className="absolute inset-y-0 right-0 z-20 flex flex-col overflow-y-auto"
        style={{ width: dw, background: sheetGround(m), color: m.ink, fontFamily: m.bodyFont,
          borderLeft: `var(--ap, 2px) solid ${m.border}`,
          boxShadow: m.crisp ? `inset var(--ap) 0 0 ${m.rule}, calc(var(--ap) * -1) 0 0 ${m.shadow}` : `-3px 0 0 ${m.card ? "rgba(58,38,22,.62)" : m.shadow}` }}>
        <div className={`flex-none ${narrow ? "px-5" : "px-6"} pt-4`}>{back}</div>
        <div className={`${narrow ? "px-5" : "px-6"} pb-8 pt-3`}>{body}</div>
      </aside>
    );
  }
  return <SheetShell {...p} header={back} body={body} />;
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
  return (
    <aside aria-label="Model card" className="absolute inset-x-0 bottom-0 z-20 flex flex-col"
      style={{ height: h, background: sheetGround(m), color: m.ink, borderTop: `var(--ap, 2px) solid ${m.border}`, boxShadow: `0 calc(var(--ap, 2px) * -1) 0 ${m.shadow}`, fontFamily: m.bodyFont,
        transition: drag == null && !p.still ? "height 220ms ease" : "none" }}>
      <button type="button" aria-label={p.sheet === "full" ? "Collapse the card" : "Expand the card"}
        className="flex h-6 w-full flex-none touch-none items-center justify-center"
        onClick={() => p.setSheet(p.sheet === "peek" ? "half" : p.sheet === "half" ? "full" : "peek")}
        onPointerDown={(e) => { start.current = { y: e.clientY, h }; (e.currentTarget as Element).setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (start.current) setDrag(Math.max(120, Math.min(vh * 0.92, start.current.h + start.current.y - e.clientY))); }}
        onPointerUp={release} onPointerCancel={release}>
        <span aria-hidden className="block h-1.5 w-12" style={{ background: m.border }} />
      </button>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {p.header}
        <div className="mt-3">{p.body}</div>
      </div>
    </aside>
  );
}
