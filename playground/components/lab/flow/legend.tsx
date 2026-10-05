"use client";

// The key: every mark on the sheet, drawn as it is drawn there (encoding.ts is the full table).
// One column behind the top bar's "Key" button (desktop and phone alike), so the title bar stays
// quiet and the sheet speaks. The cross-family sample is a real label from the sheet, whole.
import { tagD } from "@/lib/world/dfd";
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { Critter, EvidenceMark } from "./critter";
import { COLOR, fam, STROKE, TYPE } from "./tokens";
import s from "./flow.module.css";

const STATES: EvidenceState[] = ["champion", "trained", "provisional", "untrained"];
/** Rough advance of the label face per character (the sample only needs room, not a fit). */
const LABEL_EM = 0.6;

export function Legend({ sample }: { sample: string }) {
  const item = "flex items-center gap-2";
  const strip = fam("sequence").strip;
  const gap = Math.ceil(sample.length * TYPE.label * LABEL_EM) + 8;
  const lw = gap + 2 * 14;
  return (
    <div className="flex flex-col items-start gap-2 font-bold" style={{ color: COLOR.ink, fontSize: TYPE.ui }}>
      <span className={item}>
        <svg width="30" height="16" viewBox="0 0 30 16" className="shrink-0" aria-hidden><rect x="0.6" y="0.6" width="28.8" height="14.8" rx="4" fill={COLOR.card} stroke={COLOR.ink} strokeWidth={STROKE.box} /><path d="M0.6 4.6 Q0.6 0.6 4.6 0.6 H9 V15.4 H4.6 Q0.6 15.4 0.6 11.4 Z" fill={strip} /><path d="M9 0.6 V15.4" stroke={COLOR.ink} /></svg>
        atom: its number starts a lineage (a small chip: nothing builds on it yet)
      </span>
      <span className={item}>
        <svg width="30" height="16" viewBox="0 0 30 16" className="shrink-0" aria-hidden><path d="M0.6 5 V4.6 Q0.6 0.6 4.6 0.6 H25.4 Q29.4 0.6 29.4 4.6 V5 Z" fill={strip} /><path d="M0.6 5 H29.4" stroke={COLOR.ink} /><rect x="0.6" y="0.6" width="28.8" height="14.8" rx="4" fill="none" stroke={COLOR.ink} strokeWidth={STROKE.box} /></svg>
        derived: 4.1 is the first heir of atom 4; addresses count down the page
      </span>
      <span className={item}>
        <svg width="30" height="12" viewBox="0 0 30 12" className="shrink-0" aria-hidden><path d="M1 6 H23" stroke={COLOR.ink} strokeWidth={STROKE.edge} /><path d="M29 6 L22 2.4 V9.6 Z" fill={COLOR.ink} /></svg>
        builds on
      </span>
      <span className={item}>
        <svg width={lw} height="14" viewBox={`0 0 ${lw} 14`} className="shrink-0" aria-hidden>
          <path d={`M1 7 H12 M${lw - 12} 7 H${lw - 1}`} stroke={COLOR.ink} strokeWidth={STROKE.edge} />
          <text x={lw / 2} y="10.8" textAnchor="middle" className={s.label} fontSize={TYPE.label} fill={COLOR.inkSoft}>{sample}</text>
        </svg>
        parent in another family
      </span>
      <span className={item}>
        <svg width="34" height="14" viewBox="0 0 34 14" className="shrink-0" aria-hidden><path d="M1 7 H8" stroke={COLOR.ink} strokeWidth={STROKE.edge} /><path d={tagD({ x: 8.5, y: 1.5, w: 24, h: 11, tip: "right" }, 5)} fill={strip} stroke={COLOR.ink} strokeWidth={STROKE.tag} /></svg>
        jumps to the box on the tag (drawn whole, the line would take the long way round)
      </span>
      <span className="flex flex-col items-start gap-1.5">
        {STATES.map((st) => (
          <span key={st} className="flex items-center gap-1.5">
            <svg viewBox="-12 -12 24 24" width="18" height="18" aria-hidden><g transform="translate(-12 -12)"><Critter family="perception" state={st} /></g></svg>
            <svg viewBox="-5 -5 10 10" width="9" height="9" aria-hidden><EvidenceMark state={st} /></svg>
            {st}
          </span>
        ))}
      </span>
    </div>
  );
}
