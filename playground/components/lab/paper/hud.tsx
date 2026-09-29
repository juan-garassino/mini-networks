"use client";

// Screen-space chrome: where-am-I sign + search (top-left) and the map key
// (bottom-left). All cut-card pieces with the same die-cut rim as the map.
import { useState } from "react";
import { displayName } from "@/components/lab/shared/card-model";
import { FAMILY_COPY, familyName, inkOf, PAPER } from "./encoding";
import { STORY_FONT } from "./art";
import styles from "./paper.module.css";

export function PaperHud({ hudRef, storybook = false, zoom, family, focus, models, families, onWorld, onRegion, onFamily, onFind }: {
  hudRef?: React.Ref<HTMLDivElement>;
  /** the storybook map: the title is the map's parchment cartouche */
  storybook?: boolean;
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
  const link = "rounded px-0.5 font-semibold text-[#1F55AE] underline decoration-2 underline-offset-2 focus-visible:outline-2";
  const over = zoom === "overview" || !family;
  const title = over ? (storybook ? "The Model Zoo" : "The model zoo") : zoom === "node" && focus ? displayName(focus) : familyName(family);
  const line = over
    ? (storybook ? "Neural networks across six lands. Explore, connect and see how they relate." : "Islands are families; castles are their first models.")
    : zoom === "region" ? FAMILY_COPY[family]?.line : null;
  const cart = storybook && over;
  return (
    <div ref={hudRef} className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[calc(100%-24px)] flex-col items-start gap-2 sm:left-5 sm:top-4 sm:max-w-[420px]">
      <nav aria-label="Map level" className={cart ? "pointer-events-auto w-full px-4 py-3" : `${styles.card} pointer-events-auto w-full rounded-xl px-3.5 py-2.5`}
        style={cart ? { background: "#F2E2C0", border: "2px solid #6A4127", outline: "1px solid rgba(59,42,32,0.6)", outlineOffset: -7,
          boxShadow: "3px 5px 0 rgba(42,27,20,0.3)", fontFamily: STORY_FONT, color: "#3B2A20" } : undefined}>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {zoom !== "overview" && family && (
            <span className="flex items-center gap-1 text-[14px]">
              <button type="button" onClick={onWorld} className={link}>Map</button>
              <span aria-hidden className="text-[#5A4B3C]">/</span>
              {zoom === "node" && (
                <>
                  <button type="button" onClick={onRegion} className={link}>{familyName(family)}</button>
                  <span aria-hidden className="text-[#5A4B3C]">/</span>
                </>
              )}
            </span>
          )}
          <h1 className={`${cart ? "" : styles.display} flex items-center gap-1.5 leading-none ${cart ? "text-[34px] font-extrabold" : "text-[23px]"}`}
            style={{ color: ink ? ink.edge : cart ? "#3B2A20" : PAPER.ink, fontFamily: cart ? STORY_FONT : undefined }}>
            {ink && <span aria-hidden className={`${styles.sticker} inline-block h-3.5 w-3.5 rounded-full`} style={{ background: ink.face }} />}
            {title}
          </h1>
        </div>
        {line && <p className={`mt-1 hidden text-[#5A4B3C] sm:block ${cart ? "max-w-[300px] text-[16px] leading-snug" : "truncate text-[14px] leading-snug"}`}
          style={cart ? { fontFamily: STORY_FONT, color: "#3B2A20" } : undefined}>{line}</p>}
        <form role="search" className="mt-2" onSubmit={(e) => { e.preventDefault(); tryFind(q); }}>
          <label className="flex items-center gap-2 rounded-lg border-2 border-[#E3D6B8] bg-white/60 px-2.5 py-1">
            <svg width="15" height="15" viewBox="0 0 20 20" aria-hidden><circle cx="8.5" cy="8.5" r="6" fill="none" stroke={PAPER.ink} strokeWidth="2.6" /><path d="M13 13l5 5" stroke={PAPER.ink} strokeWidth="2.6" strokeLinecap="round" /></svg>
            <span className="sr-only">Find a model</span>
            <input
              list="paper-models" value={q} placeholder="Find a model"
              onChange={(e) => { setQ(e.target.value); tryFind(e.target.value); }}
              className="w-full min-w-0 bg-transparent text-[15px] text-[#2B2118] placeholder:text-[#8A7B6A] focus:outline-none"
            />
            <datalist id="paper-models">
              {models.map((m) => <option key={m} value={displayName(m)} />)}
            </datalist>
          </label>
        </form>
      </nav>
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
  { icon: <Oct fill={PAPER.face} big />, text: "Castle: a first model, with its town" },
  { icon: <Oct fill={PAPER.face} />, text: "Spot: built from others; its sign is the species" },
  { icon: <Oct fill={PAPER.die} />, text: "Hollow: not trained yet" },
  { icon: <Oct fill={PAPER.die} rim={PAPER.die} dashed />, text: "Pencil: quality bar not final" },
  {
    icon: <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden><polygon points="12,2 14.9,8.6 22,9.2 16.6,13.8 18.2,21 12,17.2 5.8,21 7.4,13.8 2,9.2 9.1,8.6" fill={PAPER.gold} stroke={PAPER.goldEdge} strokeWidth="1.4" strokeLinejoin="round" /></svg>,
    text: "Gold star: champion",
  },
  {
    icon: <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden><path d="M2 16C8 16 12 8 22 8" stroke={PAPER.road} strokeWidth="7" fill="none" strokeLinecap="round" /><path d="M2 16C8 16 12 8 22 8" stroke={PAPER.gold} strokeWidth="4" fill="none" strokeLinecap="round" /><path d="M10 10.5 l3 1.5 l-2 2.6" stroke={PAPER.road} strokeWidth="1.4" fill="none" /></svg>,
    text: "Road: main parent, arrows point to the child",
  },
  {
    icon: <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden><path d="M2 16C8 16 12 8 22 8" stroke={PAPER.footpath} strokeWidth="2.4" fill="none" /></svg>,
    text: "Footpath: another parent",
  },
  {
    icon: <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden><path d="M2 16C8 16 12 8 22 8" stroke={PAPER.ink} strokeWidth="3.4" strokeDasharray="0.1 5.5" strokeLinecap="round" fill="none" /></svg>,
    text: "Dotted route: the way back to its atom",
  },
  {
    icon: <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden><path d="M3 15 L21 15 L18 20 L6 20 Z" fill={PAPER.plank} /><path d="M12 14 L12 4 L19 13 Z" fill={PAPER.die} stroke={PAPER.inkSoft} strokeWidth="1.2" /></svg>,
    text: "Boat: a pipeline that uses this family",
  },
  {
    icon: <span className="grid h-5 min-w-5 place-items-center rounded-sm px-1 text-[12px] font-semibold" style={{ background: PAPER.face, color: PAPER.die }}>3</span>,
    text: "Ticket on a name: runs so far",
  },
];

export function PaperKey({ hideOnMobile, startOpen }: { hideOnMobile: boolean; startOpen: boolean }) {
  // Folded to a button everywhere (it covered the map); one tap opens it.
  const [open, setOpen] = useState(false);   // phone: always asked for (it would cover the islands)
  const [deskOpen, setDeskOpen] = useState(false);
  const [was, setWas] = useState(startOpen);
  if (was !== startOpen) { setWas(startOpen); setDeskOpen(false); setOpen(false); }
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
