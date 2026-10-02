"use client";

// Top-right corner: the two sheets of the atlas, Pixel and Paper, hang from
// the top edge as tabs. The open sheet's tab is lowered and inked. With
// ?dev=1 a third tab opens the render / labels tray (image variants + baked
// labels — the owner's comparison tools, not part of the learner's UI).
import type { MapId } from "../anchors";
import type { Material } from "../material";
import { Btn, plateStyle } from "./plate";

export type Render = "true" | "clean" | "grid" | "baked";
export type Labels = "ours" | "baked";

export function SheetTabs({ m, mapId, dev, render, labels, setOpts, devOpen, setDevOpen, compact = false, onHideUi }: {
  m: Material; mapId: MapId; dev: boolean; render: Render; labels: Labels; compact?: boolean; onHideUi: () => void;
  setOpts: (next: Partial<{ map: MapId; render: Render; labels: Labels }>) => void;
  devOpen: boolean; setDevOpen: (v: boolean) => void;
}) {
  const tab = (id: MapId, text: string) => {
    const on = mapId === id;
    return (
      <button key={id} type="button" role="tab" aria-selected={on} onClick={() => setOpts({ map: id })}
        className={`${compact ? "px-2.5 pb-1.5" : "px-4 pb-2"} leading-none focus-visible:outline-2 focus-visible:outline-offset-2`}
        style={{
          ...plateStyle(m, { loud: on, shadow: on }),
          borderTop: "none", paddingTop: on ? (compact ? 10 : 14) : (compact ? 6 : 8),
          fontFamily: m.signFont, fontWeight: 700, fontSize: compact ? 15 : 20,
          marginTop: 0,
        }}>
        {text}
      </button>
    );
  };
  return (
    <nav aria-label="Map sheets" className="flex flex-col items-end">
      <div role="tablist" className="flex items-start gap-1.5">
        {tab("pixel", "Pixel")}
        {tab("paper", "Paper")}
        <button type="button" onClick={onHideUi} aria-label="Map only: hide the UI (h)" title="Map only (h)"
          className={`${compact ? "px-2 pb-1.5 pt-1.5" : "px-3 pb-2 pt-2"} leading-none focus-visible:outline-2`}
          style={{ ...plateStyle(m, { shadow: true }), borderTop: "none", fontFamily: m.bodyFont, fontSize: compact ? 13 : 14 }}>
          map only
        </button>
        {dev && (
          <button type="button" aria-expanded={devOpen} onClick={() => setDevOpen(!devOpen)}
            className="px-3 pb-2 pt-2 leading-none focus-visible:outline-2"
            style={{ ...plateStyle(m, { loud: devOpen, shadow: true }), borderTop: "none", fontFamily: m.bodyFont, fontSize: 14 }}>
            dev
          </button>
        )}
      </div>
      {dev && devOpen && (
        <div className="mt-2 flex flex-col gap-2 p-3" style={{ ...plateStyle(m), fontFamily: m.bodyFont, fontSize: 14 }}>
          {mapId === "pixel" && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Image">
              <span className="w-12" style={{ color: m.inkSoft }}>image</span>
              {(["true", "clean", "grid", "baked"] as const).map((r) => (
                <Btn key={r} m={m} pressed={render === r} onClick={() => setOpts({ render: r, labels: r === "baked" ? "baked" : "ours" })} style={{ fontSize: 14, minHeight: 24 }}>
                  {r === "true" ? "true pixels" : r}
                </Btn>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Labels">
            <span className="w-12" style={{ color: m.inkSoft }}>labels</span>
            <Btn m={m} pressed={labels === "ours"} onClick={() => setOpts({ labels: "ours" })} style={{ fontSize: 14, minHeight: 24 }}>ours</Btn>
            <Btn m={m} pressed={labels === "baked"} onClick={() => setOpts({ labels: "baked" })} style={{ fontSize: 14, minHeight: 24 }}>baked</Btn>
          </div>
          <a href="/lab/" className="underline" style={{ color: m.inkSoft }}>All skins</a>
        </div>
      )}
    </nav>
  );
}
