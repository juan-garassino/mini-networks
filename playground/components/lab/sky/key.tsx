"use client";

// The star key: the sky's own legend plate (bottom-right on desktop; on a
// phone a Key button in the same corner unfolds it). It reads the evidence
// vocabulary from encoding.ts KEY and draws each row with the sky's real
// sprites (StarPair), so the key cannot drift from the marks. Built on the
// painted kit's plate (plateStyle / plateTitle) in the night material.
import { useState } from "react";
import { plateStyle, plateTitle } from "@/components/lab/painted/corners/plate";
import { KEY } from "./encoding";
import { StarPair } from "./icon";
import { SKY_MATERIAL as m, SPACE, TYPE } from "./tokens";

export function StarKey({ compact = false }: { compact?: boolean }) {
  const k = compact ? 1 : 0;
  return (
    <aside aria-label={KEY.title} style={{ ...plateStyle(m), width: SPACE.keyW[k], padding: SPACE.keyPad[k], fontFamily: m.bodyFont, color: m.ink }}>
      <h2 className="mb-2.5" style={plateTitle(m, TYPE.keyTitle)}>{KEY.title}</h2>
      <ul className="space-y-1.5" style={{ fontSize: TYPE.keyRow }}>
        {KEY.rows.map(({ sample: state, label }) => (
          <li key={state} className="flex items-center gap-2">
            <StarPair state={state} />
            <span>{label}</span>
          </li>
        ))}
        {KEY.notes?.map((t) => (
          <li key={t} className="pt-1 leading-snug" style={{ color: m.inkSoft, fontSize: TYPE.keyNote }}>{t}</li>
        ))}
      </ul>
    </aside>
  );
}

/** Phone: the key folds behind one button in the bottom-right corner. */
export function PhoneStarKey() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-end gap-2">
      {open && <StarKey compact />}
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="px-3 py-2 leading-none focus-visible:outline-2"
        style={{ ...plateStyle(m, { loud: open, shadow: true }), fontFamily: m.signFont, fontWeight: 700, fontSize: TYPE.button[1] }}>
        {open ? "Close key" : "Key"}
      </button>
    </div>
  );
}
