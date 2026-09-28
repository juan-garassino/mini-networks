"use client";

// Screen-space chrome: where-am-I sign + search (top-left) and the map key
// (bottom-left). All cut-card pieces with the same die-cut rim as the map.
import { useState } from "react";
import { displayName } from "@/components/lab/shared/card-model";
import { FAMILY_COPY, familyName, inkOf, PAPER } from "./encoding";
import styles from "./paper.module.css";

export function PaperHud({ zoom, family, focus, models, families, onWorld, onRegion, onFamily, onFind }: {
  zoom: "overview" | "region" | "node";
  family: string | null;
  focus: string | null;
  models: string[];
  families: string[];
  onWorld: () => void;
  onRegion: () => void;
  onFamily: (family: string) => void;
  onFind: (name: string) => void;
}) {
  const [q, setQ] = useState("");
  const ink = family ? inkOf(family) : null;
  const tryFind = (v: string) => {
    const hit = models.find((m) => m === v || displayName(m) === v.trim().toLowerCase());
    if (hit) { onFind(hit); setQ(""); }
  };
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[calc(100%-24px)] flex-col items-start gap-2 sm:left-5 sm:top-5 sm:max-w-[360px]">
      <nav aria-label="Map level" className={`${styles.card} pointer-events-auto rounded-xl px-4 py-3`}>
        {zoom === "overview" || !family ? (
          <>
            <h1 className={`${styles.display} text-[26px] leading-none text-[#2B2118]`}>The model zoo</h1>
            <p className="mt-1 hidden text-[14px] leading-snug text-[#5A4B3C] sm:block">
              Each island is a family. Castles are the first models; roads show what builds on what. Tap an island to go closer.
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1 text-[14px]">
              <button type="button" onClick={onWorld} className="rounded px-1 font-semibold text-[#1F55AE] underline decoration-2 underline-offset-2 focus-visible:outline-2">
                Whole map
              </button>
              {zoom === "node" && (
                <>
                  <span aria-hidden className="text-[#5A4B3C]">/</span>
                  <button type="button" onClick={onRegion} className="rounded px-1 font-semibold text-[#1F55AE] underline decoration-2 underline-offset-2 focus-visible:outline-2">
                    {familyName(family)}
                  </button>
                </>
              )}
            </div>
            <h1 className={`${styles.display} mt-1 flex items-center gap-2 text-[26px] leading-none`} style={{ color: ink!.edge }}>
              <span aria-hidden className={`${styles.sticker} inline-block h-4 w-4 rounded-full`} style={{ background: ink!.face }} />
              {zoom === "node" && focus ? displayName(focus) : familyName(family)}
            </h1>
            {zoom === "region" && (
              <p className="mt-1 hidden text-[14px] leading-snug text-[#5A4B3C] sm:block">{FAMILY_COPY[family]?.line}</p>
            )}
          </>
        )}
      </nav>
      <form className="pointer-events-auto" role="search" onSubmit={(e) => { e.preventDefault(); tryFind(q); }}>
        <label className={`${styles.card} flex items-center gap-2 rounded-xl px-3 py-1.5`}>
          <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden><circle cx="8.5" cy="8.5" r="6" fill="none" stroke={PAPER.ink} strokeWidth="2.6" /><path d="M13 13l5 5" stroke={PAPER.ink} strokeWidth="2.6" strokeLinecap="round" /></svg>
          <span className="sr-only">Find a model</span>
          <input
            list="paper-models" value={q} placeholder="Find a model"
            onChange={(e) => { setQ(e.target.value); tryFind(e.target.value); }}
            className="w-40 bg-transparent text-[15px] text-[#2B2118] placeholder:text-[#8A7B6A] focus:outline-none sm:w-52"
          />
          <datalist id="paper-models">
            {models.map((m) => <option key={m} value={displayName(m)} />)}
          </datalist>
        </label>
      </form>
      {zoom === "overview" && (
        <ul aria-label="Families" className="pointer-events-auto flex flex-wrap gap-2 sm:hidden">
          {families.map((f) => (
            <li key={f}>
              <button type="button" onClick={() => onFamily(f)}
                className={`${styles.sticker} rounded-lg px-3 py-1 text-[15px] font-semibold text-[#FFFDF6]`}
                style={{ background: inkOf(f).edge }}>
                {familyName(f)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── map key ─────────────────────────────────────────────────────────────
function Oct({ fill, rim = PAPER.gold, dashed = false, big = false }: { fill: string; rim?: string; dashed?: boolean; big?: boolean }) {
  const r = big ? 10 : 7, c = 12;
  const p = (rr: number, dy = 0) => Array.from({ length: 8 }, (_, k) => {
    const a = Math.PI / 8 + (k * Math.PI) / 4;
    return `${(c + rr * Math.cos(a)).toFixed(1)},${(c + dy + rr * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  return (
    <svg width="24" height="24" viewBox="0 0 24 26" aria-hidden>
      <polygon points={p(r, 2.5)} fill={dashed ? "#E6DBC2" : PAPER.goldSide} />
      <polygon points={p(r)} fill={rim} stroke={dashed ? PAPER.pencil : undefined} strokeDasharray={dashed ? "2 2" : undefined} strokeWidth={1.5} />
      <polygon points={p(r * 0.64)} fill={fill} stroke={fill === PAPER.die && !dashed ? PAPER.face : undefined} strokeWidth={2} />
    </svg>
  );
}

const KEY: { icon: React.ReactNode; text: string }[] = [
  { icon: <Oct fill={PAPER.face} big />, text: "Castle: first model of a family" },
  { icon: <Oct fill={PAPER.face} />, text: "Spot: built from others" },
  { icon: <Oct fill={PAPER.die} />, text: "Hollow: not trained yet" },
  { icon: <Oct fill={PAPER.die} rim={PAPER.die} dashed />, text: "Pencil: quality bar not final" },
  {
    icon: <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden><path d="M7 22V3" stroke={PAPER.ink} strokeWidth="2.2" strokeLinecap="round" /><path d="M7 3l13 5-13 5z" fill={PAPER.flag} /></svg>,
    text: "Red flag: champion",
  },
  {
    icon: <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden><path d="M2 16C8 16 12 8 22 8" stroke={PAPER.goldEdge} strokeWidth="8" fill="none" strokeLinecap="round" /><path d="M2 16C8 16 12 8 22 8" stroke={PAPER.gold} strokeWidth="4.5" fill="none" strokeLinecap="round" /></svg>,
    text: "Road: builds on",
  },
  {
    icon: <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden><rect x="2" y="8" width="20" height="9" rx="2" fill={PAPER.plank} /><path d="M7 8v9M12 8v9M17 8v9" stroke={PAPER.plankDark} strokeWidth="1.6" /></svg>,
    text: "Bridge: crosses families",
  },
  {
    icon: <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden><path d="M2 16C8 16 12 8 22 8" stroke={PAPER.gold} strokeWidth="7" fill="none" strokeLinecap="round" /><path d="M2 16C8 16 12 8 22 8" stroke={PAPER.flag} strokeWidth="2.4" strokeDasharray="4 3" fill="none" /></svg>,
    text: "Stitches: way back to its atom",
  },
];

export function PaperKey({ hideOnMobile, startOpen }: { hideOnMobile: boolean; startOpen: boolean }) {
  // Open on the whole map (the phone has empty sea below the islands there),
  // folded away once the camera is close (it would cover the region).
  const [open, setOpen] = useState(startOpen);
  const [deskOpen, setDeskOpen] = useState(startOpen);
  const [was, setWas] = useState(startOpen);
  if (was !== startOpen) { setWas(startOpen); setDeskOpen(startOpen); setOpen(startOpen); }
  return (
    <div className={`absolute bottom-3 left-3 z-10 sm:bottom-5 sm:left-5 ${hideOnMobile ? "hidden sm:block" : ""}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={`${styles.btn} rounded-xl border-2 border-[#2B2118] bg-[#FFFDF6] px-3 py-1.5 text-[15px] font-semibold sm:hidden`}>
        {open ? "Hide map key" : "Map key"}
      </button>
      {!deskOpen && (
        <button type="button" onClick={() => setDeskOpen(true)} aria-expanded={false}
          className={`${styles.btn} hidden rounded-xl border-2 border-[#2B2118] bg-[#FFFDF6] px-3 py-1.5 text-[15px] font-semibold sm:block`}>
          Map key
        </button>
      )}
      <section aria-label="Map key" className={`${styles.card} mt-2 w-[calc(100vw-24px)] max-w-[440px] rounded-xl px-4 py-3 ${open ? "block" : "hidden"} sm:mt-0 ${deskOpen ? "sm:block" : "sm:hidden"}`}>
        <div className="flex items-center justify-between">
          <h2 className={`${styles.display} text-[18px] leading-none`}>Map key</h2>
          <button type="button" onClick={() => setDeskOpen(false)} className="hidden rounded px-1 text-[14px] font-semibold text-[#1F55AE] underline sm:block">Fold away</button>
        </div>
        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
          {KEY.map((k) => (
            <li key={k.text} className="flex items-center gap-2.5 text-[13px] leading-tight">
              <span className="shrink-0">{k.icon}</span>{k.text}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
