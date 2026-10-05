"use client";
// The transit edition's sheet row, in place of the classic blueprint title
// block (which named the wrong product in tracked caps): one Jost tab row —
// Map / Reactions / Observatory on the left, the edition picker on the right.
// The active tab carries a track-weight ink bar along its top edge, the way
// the map draws a line. Colours come from the sheet vars (tokens.ts SHEET_VARS).
import type { EditionId, SheetId } from "@/components/title-block";
import { GRID, SPACE, TYPE } from "./tokens";

const SHEETS: { id: SheetId; label: string }[] = [
  { id: "chart", label: "Map" },
  { id: "reactions", label: "Reactions" },
  { id: "observatory", label: "Observatory" },
];

const EDITION_LABEL: Record<EditionId, string> = {
  blueprint: "Blueprint", wallchart: "Wall chart", terminal: "Terminal",
  metro: "Transit", atlas: "Atlas", paper: "Paper",
};

export function MetroTabs({ sheet, setSheet, editions, edition, setEdition }: {
  sheet: SheetId;
  setSheet: (s: SheetId) => void;
  editions: EditionId[];
  edition: EditionId;
  setEdition: (e: EditionId) => void;
}) {
  return (
    <nav aria-label="Sheets" className="flex items-stretch justify-between border-t border-line-faint bg-paper text-ink"
      style={{ fontFamily: TYPE.family, height: SPACE.tabsH }}>
      <div role="tablist" className="flex items-stretch">
        {SHEETS.map((s) => {
          const on = s.id === sheet;
          return (
            <button key={s.id} type="button" role="tab" aria-selected={on} onClick={() => setSheet(s.id)}
              className={`px-3 text-[13px] focus-visible:outline-2 focus-visible:-outline-offset-2 sm:px-4 ${on ? "font-semibold text-ink" : "text-ink-dim hover:text-ink"}`}
              style={{ boxShadow: on ? `inset 0 ${GRID.track / 2}px 0 var(--ink)` : undefined }}>
              {s.label}
            </button>
          );
        })}
      </div>
      <label className="flex items-center gap-2 px-3 text-[13px] text-ink-dim sm:px-4">
        Edition
        <select value={edition} onChange={(e) => setEdition(e.target.value as EditionId)}
          className="cursor-pointer border-b border-line-faint bg-transparent py-0.5 text-ink focus-visible:outline-2">
          {editions.map((id) => <option key={id} value={id}>{EDITION_LABEL[id]}</option>)}
        </select>
      </label>
    </nav>
  );
}
