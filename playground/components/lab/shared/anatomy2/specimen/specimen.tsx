"use client";

// /lab/anatomy — the specimen page for the diagram kit. URL contract in
// view.ts. Wide screens: a shelved index column beside the plate drawn at ×2;
// narrower screens: a header + one select, the plate at the largest crisp
// zoom whose labels stay ≥ 10 px (legible.ts fitZoom) — or, with no room for
// one, the card with the full drawing a tap away. Until the URL is read it
// draws its own loading plate (loading.tsx); then data-lab-ready="1" once
// painted (lib/lab-contract.ts).
import { useEffect, useMemo, useRef, useState } from "react";
import { useLabReady } from "@/lib/lab-contract";
import { fitZoom, legibleZooms } from "../legible";
import { PixelLabel } from "../prims";
import { diagramFor } from "../registry";
import { ART, BORDER, LEGIBLE, PIXEL, SPACE, THEMES, TYPE, WIDE_MIN, type ThemeName } from "../tokens";
import { CardSheet, sheetCols, sheetWidth } from "./card-sheet";
import { ModelIndex, ModelPicker, Segmented, Steps } from "./controls";
import { readingOrder, shelves } from "./groups";
import { SpecimenLoading } from "./loading";
import { Plate, type PlateFit } from "./plate";
import { specimenCss } from "./styles";
import { parseView, viewSearch, type View } from "./view";

const THEME_OPTIONS = [{ value: "pixel", text: "pixel" }, { value: "paper", text: "paper" }] as const;
const SHEET_OPTIONS = [{ value: "one", text: "one drawing" }, { value: "cards", text: "every card" }] as const;
const DRAWING_W = ART.full.w * ART.scale;

/** Card width for `avail` CSS px: the largest crisp legible zoom that fits;
 * failing that (a dpr-1 phone) the card zoom, shrunk to fit — legible beats crisp. */
function cardWidthFor(avail: number, dpr: number): number {
  const z = fitZoom(Math.min(avail, ART.cardW * LEGIBLE.cardZoom), ART.cardW, dpr);
  return z ? z * ART.cardW : Math.min(avail, ART.cardW * LEGIBLE.cardZoom);
}

export function Specimen() {
  const [view, setView] = useState<View | null>(null);
  const [vw, setVw] = useState(1440);
  const [dpr, setDpr] = useState(2);
  const mainRef = useRef<HTMLElement>(null);
  const groups = useMemo(() => shelves(), []);
  const order = useMemo(() => readingOrder(groups), [groups]);

  useEffect(() => {
    const sync = () => setView(parseView(window.location.search));
    const size = () => { setVw(window.innerWidth); setDpr(window.devicePixelRatio || 1); };
    sync(); size();
    window.addEventListener("popstate", sync);
    window.addEventListener("resize", size);
    return () => { window.removeEventListener("popstate", sync); window.removeEventListener("resize", size); };
  }, []);

  const labReady = useLabReady(view !== null, mainRef);

  if (!view) return <SpecimenLoading count={order.length} />;

  const th = THEMES[view.theme];
  const hrefFor = (m: string) => `${window.location.pathname}${viewSearch({ ...view, model: m, cards: false, full: false }, window.location.search, false)}`;
  const go = (next: Partial<View>, scrollTop = false) => {
    const merged = { ...view, ...next };
    window.history.replaceState(null, "", `${window.location.pathname}${viewSearch(merged, window.location.search, next.t !== undefined)}`);
    setView(merged);
    if (scrollTop) document.getElementById("anx-main")?.scrollTo({ top: 0 });
  };
  const pick = (m: string) => go({ model: m, cards: false, full: false }, true);

  const wide = !view.cards && vw >= WIDE_MIN;
  const base = diagramFor(view.model)?.view.w ?? ART.full.w;
  const avail = vw - 2 * SPACE.gutter;
  const cardW = cardWidthFor(avail, dpr);
  const zoom = wide ? ART.scale : fitZoom(avail, base, dpr);
  const plateFit: PlateFit = zoom
    ? { kind: "full", width: zoom * base }
    : { kind: "card", cardWidth: cardW, fullWidth: (legibleZooms(dpr)[0] ?? ART.scale) * base }; // opened: the smallest legible zoom, scrolling
  const columnW = view.cards ? sheetWidth(avail, cardW) : plateFit.kind === "full" ? plateFit.width : avail;

  const switches = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.s }}>
      <Segmented label="Theme" options={THEME_OPTIONS} value={view.theme} onChange={(v: ThemeName) => go({ theme: v })} />
      <Segmented label="Show" options={SHEET_OPTIONS} value={view.cards ? "cards" : "one"} onChange={(v) => go({ cards: v === "cards", full: false }, true)} />
    </div>
  );
  const masthead = (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.s + 2 }}>
      {view.from && <a href={view.from} className="anx-back">Back to the map</a>}
      <PixelLabel text="how it works" s={PIXEL.wordmark} style={{ color: th.text }} />
      <p style={{ margin: 0, color: th.textDim, fontSize: TYPE.hint.size, lineHeight: TYPE.hint.line }}>
        {order.length} models, each drawn from its own code and run.
      </p>
    </div>
  );
  const plate = (
    <>
      <Plate model={view.model} theme={view.theme} th={th} t={view.t} onT={(t) => go({ t })} still={view.still}
        fit={plateFit} full={view.full} onFull={(full) => go({ full })} />
      <footer style={{ marginTop: SPACE.xl, paddingTop: SPACE.m, borderTop: `${BORDER.hair}px solid ${th.frame}` }}>
        <Steps order={order} current={view.model} hrefFor={hrefFor} onPick={pick} />
      </footer>
    </>
  );

  return (
    <main ref={mainRef} id="anx-main" className="anx" data-lab-ready={labReady}
      style={{ position: "absolute", inset: 0, overflow: "auto", background: th.ground, color: th.text, fontFamily: TYPE.prose }}>
      <style>{specimenCss(th)}</style>
      {wide ? (
        <div style={{ display: "grid", gridTemplateColumns: `${SPACE.index}px ${DRAWING_W}px`, gap: SPACE.xl, justifyContent: "center", padding: `0 ${SPACE.gutter}px` }}>
          <aside style={{ position: "sticky", top: 0, alignSelf: "start", maxHeight: "100vh", overflowY: "auto", padding: `${SPACE.xl}px 0 ${SPACE.xl}px`, scrollbarWidth: "thin" }}>
            {masthead}
            <div style={{ marginTop: SPACE.l }}>{switches}</div>
            <ModelIndex groups={groups} current={view.model} hrefFor={hrefFor} onPick={pick} />
          </aside>
          <div style={{ padding: `${SPACE.xl}px 0 ${SPACE.xl * 2}px`, minWidth: 0 }}>{plate}</div>
        </div>
      ) : (
        <div style={{ maxWidth: columnW, margin: "0 auto", padding: `${SPACE.l}px ${SPACE.gutter}px ${SPACE.xl * 2}px`, boxSizing: "content-box" }}>
          <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: SPACE.m, marginBottom: SPACE.l }}>
            {masthead}
            {switches}
          </header>
          {view.cards ? (
            <CardSheet groups={groups} theme={view.theme} th={th} still={view.still} cardWidth={cardW} cols={sheetCols(avail, cardW)} hrefFor={hrefFor} onPick={pick} />
          ) : (
            <>
              <div style={{ marginBottom: SPACE.l }}><ModelPicker groups={groups} current={view.model} onPick={pick} /></div>
              {plate}
            </>
          )}
        </div>
      )}
    </main>
  );
}
