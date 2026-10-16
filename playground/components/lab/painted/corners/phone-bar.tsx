"use client";

// Phones: the top two corners become ONE bar (390 px has no room for a
// cartouche and hanging tabs side by side — they met over the magnifier).
// Left: the title and the find-a-model magnifier; right: the two sheets as a
// pressed / raised pair and "map only" as a framed-corners icon. One row in
// every view, so the map below never jumps; the search unfolds over the
// sheet pair (they step aside while it is open).
import { useState } from "react";
import type { MapId } from "../anchors";
import { CORNER, PHONE, TYPE, type Material } from "../material";
import { plateStyle, Search } from "./plate";

/** "map only": four framing corners on a 7-unit grid (crisp on the pixel map). */
function FrameIcon({ m, size = 14 }: { m: Material; size?: number }) {
  const ink = m.crisp ? m.border : m.ink;
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 7 7" shapeRendering={m.crisp ? "crispEdges" : undefined} style={{ display: "block" }}>
      <g fill={ink}>
        <rect x="0" y="0" width="3" height="1" /><rect x="0" y="0" width="1" height="3" />
        <rect x="4" y="0" width="3" height="1" /><rect x="6" y="0" width="1" height="3" />
        <rect x="0" y="6" width="3" height="1" /><rect x="0" y="4" width="1" height="3" />
        <rect x="4" y="6" width="3" height="1" /><rect x="6" y="4" width="1" height="3" />
      </g>
    </svg>
  );
}

export function PhoneBar({ m, title = "The Model Zoo", mapId, names, onPick, onMap, onHideUi }: {
  m: Material;
  title?: string;
  mapId: MapId;
  names: string[];
  onPick: (n: string) => void;
  onMap: (id: MapId) => void;
  onHideUi: () => void;
}) {
  const [searching, setSearching] = useState(false);
  const sheet = (id: MapId, text: string) => {
    const on = mapId === id;
    return (
      <button key={id} type="button" role="tab" aria-selected={on} onClick={() => onMap(id)}
        className="px-2 leading-none focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ ...plateStyle(m, { loud: on, shadow: !on }), height: PHONE.control, fontFamily: m.signFont, fontWeight: 700, fontSize: TYPE.tabSmall,
          transform: on ? "translate(var(--ap, 1px), var(--ap, 1px))" : undefined }}>
        {text}
      </button>
    );
  };
  return (
    <header aria-label={title} className="flex items-center gap-2"
      style={{ ...plateStyle(m), fontFamily: m.bodyFont, padding: `${CORNER.padQuiet}px ${CORNER.padQuiet + 2}px`, height: PHONE.bar }}>
      {!searching && (
        <h1 className="whitespace-nowrap leading-none" style={{ fontFamily: m.signFont, fontWeight: 700, fontSize: TYPE.displayTiny, color: m.crisp ? m.border : m.ink }}>
          {title}
        </h1>
      )}
      <Search m={m} names={names} onPick={onPick} compact collapsed onFold={setSearching} width={PHONE.searchW} />
      {!searching && (
        <nav aria-label="Map sheets" className="ml-auto flex items-center gap-1">
          <div role="tablist" className="flex items-center gap-1">
            {sheet("pixel", "Pixel")}
            {sheet("paper", "Paper")}
          </div>
          <button type="button" onClick={onHideUi} aria-label="Map only: hide the panels" title="Map only"
            className="ml-1 inline-flex flex-none items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ ...plateStyle(m), width: PHONE.control, height: PHONE.control }}>
            <FrameIcon m={m} />
          </button>
        </nav>
      )}
    </header>
  );
}
