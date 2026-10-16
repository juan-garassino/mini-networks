"use client";

import { EDITION_LABEL, type EditionId, type SheetId } from "@/lib/editions";

// The table's sheet row, in place of the classic title block (tracked caps,
// "SHT 01", run/api/rev meta): the sheets on the left, the edition on the
// right, in the skin's own face and rules (periodic.css .pt-tabs). The only
// status it carries is the one that needs action: the API being offline.
const SHEETS: { id: SheetId; label: string }[] = [
  { id: "chart", label: "Chart" },
  { id: "reactions", label: "Reactions" },
  { id: "observatory", label: "Observatory" },
];

export function SheetTabs({ sheet, setSheet, editions, edition, setEdition, offline }: {
  sheet: SheetId;
  setSheet: (s: SheetId) => void;
  editions: EditionId[];
  edition: EditionId;
  setEdition: (e: EditionId) => void;
  offline: boolean;
}) {
  return (
    <nav aria-label="Sheets" className="pt-tabs">
      <div role="tablist">
        {SHEETS.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={s.id === sheet} onClick={() => setSheet(s.id)} className="pt-tab">
            {s.label}
          </button>
        ))}
      </div>
      <div className="pt-tabs-end">
        {offline && (
          <span role="status" aria-label="API offline" title="The zoo's API is not answering" className="pt-offline">
            <span className="pt-offline-label">API offline</span>
          </span>
        )}
        <label className="pt-edition">
          <span className="pt-edition-label">Edition</span>
          <select value={edition} onChange={(e) => setEdition(e.target.value as EditionId)}>
            {editions.map((id) => <option key={id} value={id}>{EDITION_LABEL[id]}</option>)}
          </select>
        </label>
      </div>
    </nav>
  );
}
