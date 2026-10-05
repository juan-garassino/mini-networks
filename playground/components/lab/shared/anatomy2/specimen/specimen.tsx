"use client";

// /lab/anatomy — the specimen page for the diagram kit. URL contract in
// view.ts. Wide screens: a shelved index column beside the plate drawn at ×2;
// narrow screens: a header + one select, the plate at the largest integer
// scale that fits (1× scrolls sideways below 560 px). Sets data-lab-ready="1"
// once the diagram has painted (scripts/shoot.mjs contract).
import { useEffect, useMemo, useState } from "react";
import { PixelLabel } from "../prims";
import { diagramFor } from "../registry";
import { ART, BORDER, PIXEL, SPACE, THEMES, TYPE, type ThemeName } from "../tokens";
import { CardSheet, sheetWidth } from "./card-sheet";
import { ModelIndex, ModelPicker, Segmented, Steps } from "./controls";
import { readingOrder, shelves } from "./groups";
import { Plate } from "./plate";
import { specimenCss } from "./styles";
import { parseView, viewSearch, type View } from "./view";

const THEME_OPTIONS = [{ value: "pixel", text: "pixel" }, { value: "paper", text: "paper" }] as const;
const SHEET_OPTIONS = [{ value: "one", text: "one drawing" }, { value: "cards", text: "every card" }] as const;
const DRAWING_W = ART.full.w * ART.scale;
const WIDE_MIN = SPACE.index + SPACE.xl + DRAWING_W + 2 * SPACE.gutter;

export function Specimen() {
  const [view, setView] = useState<View | null>(null);
  const [vw, setVw] = useState(1440);
  const [drawn, setDrawn] = useState(false);
  const groups = useMemo(() => shelves(), []);
  const order = useMemo(() => readingOrder(groups), [groups]);

  useEffect(() => {
    const sync = () => setView(parseView(window.location.search));
    const size = () => setVw(window.innerWidth);
    sync(); size();
    window.addEventListener("popstate", sync);
    window.addEventListener("resize", size);
    return () => { window.removeEventListener("popstate", sync); window.removeEventListener("resize", size); };
  }, []);

  useEffect(() => {
    if (!view) return;
    const id = requestAnimationFrame(() => setDrawn(true));
    const to = setTimeout(() => setDrawn(true), 250);
    return () => { cancelAnimationFrame(id); clearTimeout(to); };
  }, [view]);

  if (!view) return <div style={{ position: "absolute", inset: 0, background: THEMES.pixel.ground }} />;

  const th = THEMES[view.theme];
  const hrefFor = (m: string) => `${window.location.pathname}${viewSearch({ ...view, model: m, cards: false }, window.location.search, false)}`;
  const go = (next: Partial<View>, scrollTop = false) => {
    const merged = { ...view, ...next };
    window.history.replaceState(null, "", `${window.location.pathname}${viewSearch(merged, window.location.search, next.t !== undefined)}`);
    setView(merged);
    if (scrollTop) document.getElementById("anx-main")?.scrollTo({ top: 0 });
  };
  const pick = (m: string) => go({ model: m, cards: false }, true);

  const wide = !view.cards && vw >= WIDE_MIN;
  const base = diagramFor(view.model)?.view.w ?? ART.full.w;
  const avail = Math.min(vw - 2 * SPACE.gutter, DRAWING_W);
  const narrow = !wide && avail < base;
  const cardW = Math.min(SPACE.card, vw - 2 * SPACE.gutter);
  const width = wide ? DRAWING_W : narrow ? base : Math.floor(avail / base) * base;

  const switches = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.s }}>
      <Segmented label="Theme" options={THEME_OPTIONS} value={view.theme} onChange={(v: ThemeName) => go({ theme: v })} />
      <Segmented label="Show" options={SHEET_OPTIONS} value={view.cards ? "cards" : "one"} onChange={(v) => go({ cards: v === "cards" }, true)} />
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
      <Plate model={view.model} theme={view.theme} th={th} t={view.t} onT={(t) => go({ t })} still={view.still} width={width} narrow={narrow} />
      <footer style={{ marginTop: SPACE.xl, paddingTop: SPACE.m, borderTop: `${BORDER.hair}px solid ${th.frame}` }}>
        <Steps order={order} current={view.model} hrefFor={hrefFor} onPick={pick} />
      </footer>
    </>
  );

  return (
    <main id="anx-main" className="anx" data-lab-ready={drawn ? "1" : undefined}
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
        <div style={{ maxWidth: view.cards ? sheetWidth(vw - 2 * SPACE.gutter, cardW) : width, margin: "0 auto", padding: `${SPACE.l}px ${SPACE.gutter}px ${SPACE.xl * 2}px`, boxSizing: "content-box" }}>
          <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: SPACE.m, marginBottom: SPACE.l }}>
            {masthead}
            {switches}
          </header>
          {view.cards ? (
            <CardSheet groups={groups} theme={view.theme} th={th} still={view.still} cardWidth={cardW} />
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
