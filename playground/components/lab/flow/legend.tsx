"use client";

// The key: every mark on the sheet, drawn as it is drawn there (encoding.ts is the full table).
// Desktop: one row in the top bar. Phone: a column behind "Key", with the faces as well.
import { tagD } from "@/lib/world/dfd";
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { Critter, EvidenceMark } from "./critter";
import { COLOR, fam, STROKE, TYPE } from "./tokens";

const STATES: EvidenceState[] = ["champion", "trained", "provisional", "untrained"];

export function Legend({ column }: { column?: boolean }) {
  const item = "flex items-center gap-1.5 whitespace-nowrap";
  const strip = fam("sequence").strip;
  return (
    <div className={`flex ${column ? "flex-col items-start gap-2" : "items-center gap-3"} font-bold`} style={{ color: COLOR.ink, fontSize: TYPE.ui }}>
      <span className={item}>
        <svg width="30" height="16" viewBox="0 0 30 16" aria-hidden><rect x="0.6" y="0.6" width="28.8" height="14.8" rx="4" fill={COLOR.card} stroke={COLOR.ink} strokeWidth="1.2" /><path d="M0.6 4.6 Q0.6 0.6 4.6 0.6 H9 V15.4 H4.6 Q0.6 15.4 0.6 11.4 Z" fill={strip} /><path d="M9 0.6 V15.4" stroke={COLOR.ink} /></svg>
        {column ? "atom (its number starts a lineage; small = nothing builds on it yet)" : "atom"}
      </span>
      <span className={item}>
        <svg width="30" height="16" viewBox="0 0 30 16" aria-hidden><path d="M0.6 5 V4.6 Q0.6 0.6 4.6 0.6 H25.4 Q29.4 0.6 29.4 4.6 V5 Z" fill={strip} /><path d="M0.6 5 H29.4" stroke={COLOR.ink} /><rect x="0.6" y="0.6" width="28.8" height="14.8" rx="4" fill="none" stroke={COLOR.ink} strokeWidth="1.2" /></svg>
        {column ? "derived (4.1 = first heir of atom 4)" : "derived"}
      </span>
      <span className={item}>
        <svg width="30" height="12" viewBox="0 0 30 12" aria-hidden><path d="M1 6 H23" stroke={COLOR.ink} strokeWidth={STROKE.edge} /><path d="M29 6 L22 2.4 V9.6 Z" fill={COLOR.ink} /></svg>
        builds on
      </span>
      <span className={item}>
        <svg width="40" height="12" viewBox="0 0 40 12" aria-hidden><path d="M1 6 H8 M32 6 H39" stroke={COLOR.ink} strokeWidth={STROKE.edge} /><text x="20" y="9.5" textAnchor="middle" fontSize="9" fontWeight="700" fill={COLOR.inkSoft}>4 tra</text></svg>
        {column ? "parent in another family" : "other family"}
      </span>
      <span className={item}>
        <svg width="34" height="14" viewBox="0 0 34 14" aria-hidden><path d="M1 7 H8" stroke={COLOR.ink} strokeWidth={STROKE.edge} /><path d={tagD({ x: 8.5, y: 1.5, w: 24, h: 11, tip: "right" }, 5)} fill={strip} stroke={COLOR.ink} strokeWidth={STROKE.tag} /></svg>
        {column ? "line continues at the tag's address (it would take the long way round)" : "continues at"}
      </span>
      <span className={`${column ? "flex flex-col items-start gap-1.5" : `${item} gap-2.5`}`}>
        {STATES.map((st) => (
          <span key={st} className="flex items-center gap-1">
            {column && <svg viewBox="-12 -12 24 24" width="18" height="18" aria-hidden><g transform="translate(-12 -12)"><Critter family="perception" state={st} /></g></svg>}
            <svg viewBox="-5 -5 10 10" width="9" height="9" aria-hidden><EvidenceMark state={st} /></svg>
            {st}
          </span>
        ))}
      </span>
    </div>
  );
}
