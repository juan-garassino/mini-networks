"use client";

// The lesson card's content: the SAME facts every skin shows (shared
// cardModel) plus the shared mechanism diagram (card variant) in the map's
// theme. It lives INSIDE the sidebar (desktop) or the bottom sheet (mobile):
// the sidebar swaps to it when a model is selected.
import { displayName, EVIDENCE_COPY, type CardModel } from "@/components/lab/shared/card-model";
import { MechanismDiagram } from "@/components/lab/shared/anatomy2";
import { FAMILY_TITLE, type PaintedTheme } from "./theme";
import { EvidenceIcon } from "./pixel-icon";

const fmt = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 1 ? n.toFixed(2) : n.toFixed(3));

function Chip({ name, theme, onPick, state, atom }: { name: string; theme: PaintedTheme; onPick: (n: string) => void; state: CardModel["state"]; atom: boolean }) {
  return (
    <button type="button" onClick={() => onPick(name)}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[14px] leading-6 hover:brightness-105 focus-visible:outline-2"
      style={{ background: theme.plateHi, color: theme.ink, border: `var(--ap, 2px) solid ${theme.border}`, borderRadius: theme.radius, fontFamily: theme.tagFont }}>
      {theme.crisp && <EvidenceIcon state={state} atom={atom} />}
      {displayName(name)}
    </button>
  );
}

export function CardBody({ card, theme, still, onPick, stateOf, isAtom }: {
  card: CardModel; theme: PaintedTheme; still: boolean; onPick: (n: string) => void;
  stateOf: (n: string) => CardModel["state"]; isAtom: (n: string) => boolean;
}) {
  const ev = card.evidence;
  const h3 = "mt-4 mb-1.5 text-[13px] uppercase tracking-wider";
  const version = ev?.champion_version?.match(/v\d+/)?.[0];
  return (
    <section aria-label={`${displayName(card.name)} lesson card`} style={{ color: theme.ink, fontFamily: theme.bodyFont }}>
      <p className="text-[12px] uppercase tracking-widest" style={{ color: theme.inkSoft }}>
        {FAMILY_TITLE[card.family] ?? card.family}, {card.atom ? "an atom" : `generation ${card.depth}`}, symbol {card.symbol}
      </p>
      <h2 className="mt-0.5 flex items-center gap-2 text-[26px] leading-tight" style={{ fontFamily: theme.signFont, fontWeight: 700, color: theme.crisp ? theme.border : theme.ink }}>
        {theme.crisp && <EvidenceIcon state={card.state} atom={card.atom} scale={3} />}
        {displayName(card.name)}
      </h2>
      <p className="mt-2 text-[14px]">
        {EVIDENCE_COPY[card.state]}{version ? ` (${version})` : ""}.
      </p>
      {ev?.best_metric != null && ev.gate_metric && (
        <p className="mt-1 text-[13px]" style={{ color: theme.inkSoft }}>
          Best {ev.gate_metric} {fmt(ev.best_metric)}
          {ev.threshold_m != null && <> against a bar of {ev.higher_is_better ? "≥" : "≤"} {fmt(ev.threshold_m)}, {card.passesBar ? "which it passes" : "which it does not pass yet"}</>}
          , over {ev.run_count} run{ev.run_count === 1 ? "" : "s"}.
        </p>
      )}
      <p className="mt-3 text-[16px] leading-snug">{card.description}</p>
      {card.introduces.length > 0 && (
        <>
          <h3 className={h3} style={{ color: theme.inkSoft }}>Introduces</h3>
          <ul className="space-y-1 text-[14px] leading-snug">
            {card.introduces.map((m) => <li key={m.key}><b>{displayName(m.key)}</b>{m.description ? `: ${m.description}` : ""}</li>)}
          </ul>
        </>
      )}
      <h3 className={h3} style={{ color: theme.inkSoft }}>How it works</h3>
      <MechanismDiagram name={card.name} theme={theme.id} variant="card" still={still} width={256} />
      <h3 className={h3} style={{ color: theme.inkSoft }}>Builds on</h3>
      <div className="flex flex-wrap gap-1.5">
        {card.parents.length
          ? card.parents.map((p) => <Chip key={p} name={p} theme={theme} onPick={onPick} state={stateOf(p)} atom={isAtom(p)} />)
          : <span className="text-[14px]">Nothing: it is an atom, a root of the map.</span>}
      </div>
      <h3 className={h3} style={{ color: theme.inkSoft }}>Leads to</h3>
      <div className="flex flex-wrap gap-1.5">
        {card.children.length
          ? card.children.map((c) => <Chip key={c} name={c} theme={theme} onPick={onPick} state={stateOf(c)} atom={isAtom(c)} />)
          : <span className="text-[14px]">Nothing yet.</span>}
      </div>
      {card.compositions.length > 0 && (
        <>
          <h3 className={h3} style={{ color: theme.inkSoft }}>In {card.compositions.length} pipeline{card.compositions.length === 1 ? "" : "s"}</h3>
          <ul className="space-y-1 text-[14px] leading-snug">
            {card.compositions.slice(0, 5).map((c) => <li key={c.name}><b>{displayName(c.name)}</b>: {c.composes.map(displayName).join(" + ")}</li>)}
          </ul>
        </>
      )}
    </section>
  );
}
