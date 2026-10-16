"use client";

// Top-right corner: the two sheets of the atlas, Pixel and Paper, hang from
// the top edge as tabs, all one height (CORNER.tab); the open sheet's tab is
// inked and pressed in (its fill and a 1-art-px offset, as the phone bar's
// pair), never longer than the others. With
// ?dev=1 a third tab opens the render / labels tray (image variants + baked
// labels — the owner's comparison tools, not part of the learner's UI).
import type { MapId } from "../anchors";
import { CORNER, TYPE, type Material } from "../material";
import { Btn, plateStyle } from "./plate";

export type Render = "true" | "clean" | "grid" | "baked";
export type Labels = "ours" | "baked";

export function SheetTabs({ m, mapId, dev, render, labels, setOpts, devOpen, setDevOpen, compact = false, onHideUi, mapOnly = true }: {
  m: Material; mapId: MapId; dev: boolean; render: Render; labels: Labels; compact?: boolean; onHideUi: () => void;
  /** show the "map only" tab (a phone with a model open leaves it out: the sheet is what matters) */
  mapOnly?: boolean;
  setOpts: (next: Partial<{ map: MapId; render: Render; labels: Labels }>) => void;
  devOpen: boolean; setDevOpen: (v: boolean) => void;
}) {
  // every tab hangs to one height and sets its words on one bottom line
  const H = compact ? CORNER.tabQuiet : CORNER.tab;
  const hang = () => ({ height: H, display: "inline-flex", alignItems: "flex-end", borderTop: "none" } as const);
  const tab = (id: MapId, text: string) => {
    const on = mapId === id;
    return (
      <button key={id} type="button" role="tab" aria-selected={on} onClick={() => setOpts({ map: id })}
        className={`${compact ? "px-2 pb-1.5" : "px-4 pb-2"} leading-none focus-visible:outline-2 focus-visible:outline-offset-2`}
        style={{
          ...plateStyle(m, { loud: on, shadow: !on }), ...hang(),
          transform: on ? "translate(var(--ap, 1px), var(--ap, 1px))" : undefined,
          fontFamily: m.signFont, fontWeight: 700, fontSize: compact ? TYPE.tabSmall : TYPE.tab,
        }}>
        {text}
      </button>
    );
  };
  return (
    <nav aria-label="Map sheets" className="flex flex-col items-end">
      <div role="tablist" className={`flex items-start ${compact ? "gap-1" : "gap-1.5"}`}>
        {tab("pixel", "Pixel")}
        {tab("paper", "Paper")}
        {mapOnly && <button type="button" onClick={onHideUi} aria-label="Map only: hide the UI (h)" title="Map only (h)"
          className={`${compact ? "px-1.5 pb-1.5" : "px-3 pb-2"} leading-none focus-visible:outline-2`}
          style={{ ...plateStyle(m, { shadow: true }), ...hang(), fontFamily: m.bodyFont, fontSize: compact ? TYPE.asideSmall : TYPE.aside }}>
          map only
        </button>}
        {dev && (
          <button type="button" aria-expanded={devOpen} onClick={() => setDevOpen(!devOpen)}
            className="px-3 pb-2 leading-none focus-visible:outline-2"
            style={{ ...plateStyle(m, { loud: devOpen, shadow: true }), ...hang(), fontFamily: m.bodyFont, fontSize: TYPE.aside }}>
            dev
          </button>
        )}
      </div>
      {dev && devOpen && (
        <div className="mt-2 flex flex-col gap-2 p-3" style={{ ...plateStyle(m), fontFamily: m.bodyFont, fontSize: TYPE.aside }}>
          {mapId === "pixel" && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Image">
              <span className="w-12" style={{ color: m.inkSoft }}>image</span>
              {(["true", "clean", "grid", "baked"] as const).map((r) => (
                <Btn key={r} m={m} pressed={render === r} onClick={() => setOpts({ render: r, labels: r === "baked" ? "baked" : "ours" })} style={{ fontSize: TYPE.aside, minHeight: 24 }}>
                  {r === "true" ? "true pixels" : r}
                </Btn>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Labels">
            <span className="w-12" style={{ color: m.inkSoft }}>labels</span>
            <Btn m={m} pressed={labels === "ours"} onClick={() => setOpts({ labels: "ours" })} style={{ fontSize: TYPE.aside, minHeight: 24 }}>ours</Btn>
            <Btn m={m} pressed={labels === "baked"} onClick={() => setOpts({ labels: "baked" })} style={{ fontSize: TYPE.aside, minHeight: 24 }}>baked</Btn>
          </div>
          <a href="/lab/" className="underline" style={{ color: m.inkSoft }}>All skins</a>
        </div>
      )}
    </nav>
  );
}
