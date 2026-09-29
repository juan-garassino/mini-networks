"use client";

// The lesson card: the SAME facts every skin shows (shared cardModel), on a
// parchment plate that matches the map — square Pixelify plate with a maroon
// border on the pixel map, a softer painted plate on the paper map — plus the
// shared mechanism diagram (card variant) in the matching theme.
import { displayName, EVIDENCE_COPY, type CardModel } from "@/components/lab/shared/card-model";
import { MechanismDiagram } from "@/components/lab/shared/anatomy2";
import { FAMILY_TITLE, type PaintedTheme } from "./theme";

const fmt = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 1 ? n.toFixed(2) : n.toFixed(3));

function Chip({ name, theme, onPick }: { name: string; theme: PaintedTheme; onPick: (n: string) => void }) {
  return (
    <button type="button" onClick={() => onPick(name)}
      className="px-2 py-0.5 text-[14px] leading-6 hover:brightness-105 focus-visible:outline-2"
      style={{ background: theme.plateHi, color: theme.ink, border: `${theme.crisp ? 2 : 1.5}px solid ${theme.border}`, borderRadius: theme.radius, fontFamily: theme.tagFont }}>
      {displayName(name)}
    </button>
  );
}

export function PaintedCard({ card, theme, still, onPick, onClose }: {
  card: CardModel; theme: PaintedTheme; still: boolean; onPick: (n: string) => void; onClose: () => void;
}) {
  const ev = card.evidence;
  const stateColor = theme.evidence[card.state];
  const h3 = "mt-4 mb-1.5 text-[13px] uppercase tracking-wider";
  return (
    <aside
      aria-label={`${displayName(card.name)} lesson card`}
      className="absolute inset-x-0 bottom-0 z-20 max-h-[56%] overflow-y-auto p-4 sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-16 sm:max-h-[calc(100%-5.5rem)] sm:w-[360px]"
      style={{
        background: theme.plate, color: theme.ink, fontFamily: theme.bodyFont,
        border: `${theme.crisp ? 3 : 2}px solid ${theme.border}`, borderRadius: theme.crisp ? 0 : 8,
        boxShadow: theme.crisp ? `4px 4px 0 rgba(59,26,16,.35)` : "0 10px 30px rgba(43,29,18,.35)",
      }}
    >
      <button type="button" onClick={onClose} aria-label="Close card"
        className="float-right -mt-1 px-2 text-[15px] underline-offset-2 hover:underline" style={{ color: theme.inkSoft }}>
        close ✕
      </button>
      <p className="text-[12px] uppercase tracking-widest" style={{ color: theme.inkSoft }}>
        {FAMILY_TITLE[card.family] ?? card.family} · {card.atom ? "atom" : `generation ${card.depth}`} · {card.symbol}
      </p>
      <h2 className="mt-0.5 text-[26px] leading-tight" style={{ fontFamily: theme.signFont, fontWeight: 700 }}>{displayName(card.name)}</h2>
      <p className="mt-2 flex items-center gap-2 text-[14px]">
        <span aria-hidden className="inline-block h-3.5 w-3.5 shrink-0"
          style={{ background: stateColor.fill, border: `2px ${stateColor.dash ? "dashed" : "solid"} ${stateColor.stroke}`, borderRadius: theme.crisp ? 0 : 99 }} />
        {EVIDENCE_COPY[card.state]}
        {ev?.champion_version?.match(/v\d+/) ? ` (${ev.champion_version.match(/v\d+/)![0]})` : ""}
      </p>
      {ev?.best_metric != null && ev.gate_metric && (
        <p className="mt-1 text-[13px]" style={{ color: theme.inkSoft }}>
          best {ev.gate_metric} {fmt(ev.best_metric)}
          {ev.threshold_m != null && <> vs bar {ev.higher_is_better ? "≥" : "≤"} {fmt(ev.threshold_m)} {card.passesBar ? "· passes" : "· below the bar"}</>}
          {" · "}{ev.run_count} run{ev.run_count === 1 ? "" : "s"}
        </p>
      )}
      <p className="mt-3 text-[16px] leading-snug">{card.description}</p>
      {card.introduces.length > 0 && (
        <>
          <h3 className={h3} style={{ color: theme.inkSoft }}>Introduces</h3>
          <ul className="space-y-1 text-[14px] leading-snug">
            {card.introduces.map((m) => <li key={m.key}><b>{displayName(m.key)}</b>{m.description ? ` — ${m.description}` : ""}</li>)}
          </ul>
        </>
      )}
      <h3 className={h3} style={{ color: theme.inkSoft }}>How it works</h3>
      <MechanismDiagram name={card.name} theme={theme.id} variant="card" still={still} width={320} />
      <h3 className={h3} style={{ color: theme.inkSoft }}>Builds on</h3>
      <div className="flex flex-wrap gap-1.5">
        {card.parents.length ? card.parents.map((p) => <Chip key={p} name={p} theme={theme} onPick={onPick} />) : <span className="text-[14px]">nothing: it is an atom, a root of the map</span>}
      </div>
      <h3 className={h3} style={{ color: theme.inkSoft }}>Leads to</h3>
      <div className="flex flex-wrap gap-1.5">
        {card.children.length ? card.children.map((c) => <Chip key={c} name={c} theme={theme} onPick={onPick} />) : <span className="text-[14px]">nothing yet</span>}
      </div>
      {card.compositions.length > 0 && (
        <>
          <h3 className={h3} style={{ color: theme.inkSoft }}>In {card.compositions.length} pipeline{card.compositions.length === 1 ? "" : "s"}</h3>
          <ul className="space-y-1 text-[14px] leading-snug">
            {card.compositions.slice(0, 5).map((c) => <li key={c.name}><b>{displayName(c.name)}</b>: {c.composes.map(displayName).join(" + ")}</li>)}
          </ul>
        </>
      )}
    </aside>
  );
}
