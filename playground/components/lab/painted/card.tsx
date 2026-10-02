"use client";

// The lesson card's content, in the drawer: the SAME facts every skin shows
// (shared cardModel). Order: who it is and whether it is proven → how it
// works (the diagram, full width) → what it does and introduces → its roads
// (built on / leads to) → the pipelines it is in → the numbers.
import { displayName, EVIDENCE_COPY, type CardModel } from "@/components/lab/shared/card-model";
import { MechanismDiagram } from "@/components/lab/shared/anatomy2";
import { FAMILY_TITLE, type Material } from "./material";
import { EvidenceIcon } from "./pixel-icon";
import { plateStyle } from "./corners/plate";

const fmt = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 1 ? n.toFixed(2) : n.toFixed(3));

function Signpost({ name, theme: m, onPick, state, atom }: { name: string; theme: Material; onPick: (n: string) => void; state: CardModel["state"]; atom: boolean }) {
  return (
    <button type="button" onClick={() => onPick(name)}
      className="inline-flex items-center gap-1.5 px-2 py-1 leading-none hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ ...plateStyle(m), fontFamily: m.bodyFont, fontSize: 16 }}>
      {m.crisp
        ? <EvidenceIcon state={state} atom={atom} scale={atom ? 1 : 2} />
        : <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: m.evidence[state].fill, border: `1.5px solid ${m.evidence[state].stroke}` }} />}
      {displayName(name)}
    </button>
  );
}

function H3({ m, children }: { m: Material; children: React.ReactNode }) {
  return (
    <h3 className="mb-2 mt-6 flex items-center gap-3 leading-none" style={{ fontFamily: m.signFont, fontWeight: 700, fontSize: 20, color: m.crisp ? m.border : m.ink }}>
      <span className="flex-none">{children}</span>
      <span aria-hidden className="h-0 flex-1" style={{ borderTop: `var(--ap, 2px) dotted ${m.border}` }} />
    </h3>
  );
}

export function CardBody({ card, theme: m, still, onPick, stateOf, isAtom, diagramWidth, onOpenDiagram }: {
  card: CardModel; theme: Material; still: boolean; onPick: (n: string) => void;
  stateOf: (n: string) => CardModel["state"]; isAtom: (n: string) => boolean;
  diagramWidth: number; onOpenDiagram: () => void;
}) {
  const ev = card.evidence;
  const version = ev?.champion_version?.match(/v\d+/)?.[0];
  const where = `${FAMILY_TITLE[card.family] ?? card.family}, ${card.atom ? "an atom" : `generation ${card.depth}`}`;
  return (
    <section aria-label={`${displayName(card.name)} lesson card`} style={{ color: m.ink, fontFamily: m.bodyFont, fontSize: 16, lineHeight: 1.45 }}>
      <p className="leading-none" style={{ fontSize: 14, color: m.inkSoft }}>{where}</p>
      <h2 className="mt-1.5 flex items-center gap-3 leading-none" style={{ fontFamily: m.signFont, fontWeight: 700, fontSize: 28, color: m.crisp ? m.border : m.ink }}>
        {m.crisp && <EvidenceIcon state={card.state} atom={card.atom} scale={card.atom ? 2 : 3} />}
        {displayName(card.name)}
      </h2>
      <p className="mt-2">{EVIDENCE_COPY[card.state]}{version ? ` (${version})` : ""}.</p>

      <H3 m={m}>How it works</H3>
      <MechanismDiagram name={card.name} theme={m.diagram} variant="card" still={still} width={diagramWidth}
        onOpen={() => { onOpenDiagram(); return true; }} />

      <p className="mt-5" style={{ fontSize: 17 }}>{card.description}</p>
      {card.introduces.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {card.introduces.map((i) => (
            <li key={i.key} className="flex gap-2">
              <span aria-hidden className="mt-2 inline-block h-2 w-2 flex-none" style={{ background: m.road, boxShadow: `0 0 0 1px ${m.border}` }} />
              <span>Introduces <b>{displayName(i.key)}</b>{i.description ? `: ${i.description}` : ""}</span>
            </li>
          ))}
        </ul>
      )}

      <H3 m={m}>Built on</H3>
      <div className="flex flex-wrap gap-2">
        {card.parents.length
          ? card.parents.map((p) => <Signpost key={p} name={p} theme={m} onPick={onPick} state={stateOf(p)} atom={isAtom(p)} />)
          : <span>Nothing. It is an atom, a root of the map.</span>}
      </div>
      <H3 m={m}>Leads to</H3>
      <div className="flex flex-wrap gap-2">
        {card.children.length
          ? card.children.map((c) => <Signpost key={c} name={c} theme={m} onPick={onPick} state={stateOf(c)} atom={isAtom(c)} />)
          : <span>Nothing yet.</span>}
      </div>
      {card.compositions.length > 0 && (
        <>
          <H3 m={m}>In {card.compositions.length} pipeline{card.compositions.length === 1 ? "" : "s"}</H3>
          <ul className="space-y-1.5">
            {card.compositions.slice(0, 6).map((c) => <li key={c.name}><b>{displayName(c.name)}</b>: {c.composes.map(displayName).join(" + ")}</li>)}
          </ul>
        </>
      )}
      {ev?.best_metric != null && ev.gate_metric && (
        <>
          <H3 m={m}>The numbers</H3>
          <MetricBar m={m} metric={ev.gate_metric} best={ev.best_metric} bar={ev.threshold_m ?? null} higher={Boolean(ev.higher_is_better)} passes={card.passesBar} runs={ev.run_count} />
        </>
      )}
    </section>
  );
}

/** Best metric against the M bar as a small drawn bar: the bar's position is
 * the threshold, the fill is where the champion got to. */
function MetricBar({ m, metric, best, bar, higher, passes, runs }: { m: Material; metric: string; best: number; bar: number | null; higher: boolean; passes: boolean | null; runs: number }) {
  const hi = Math.max(Math.abs(best), Math.abs(bar ?? 0), 1e-9) * 1.25;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (Math.abs(v) / hi) * 100))}%`;
  return (
    <div>
      <div className="relative h-4 w-full" style={{ background: m.field, boxShadow: `inset 0 0 0 var(--ap, 2px) ${m.border}` }} role="img"
        aria-label={`${metric} ${fmt(best)}${bar != null ? `, bar ${higher ? "at least" : "at most"} ${fmt(bar)}` : ""}`}>
        <div className="absolute inset-y-0 left-0" style={{ width: pct(best), background: passes ? m.evidence.champion.fill : m.evidence.untrained.fill, boxShadow: `inset 0 0 0 var(--ap, 2px) ${m.border}` }} />
        {bar != null && <div className="absolute inset-y-[-3px]" style={{ left: pct(bar), width: "var(--ap, 2px)", background: m.ring }} />}
      </div>
      <p className="mt-1.5" style={{ fontSize: 14, color: m.inkSoft }}>
        Best {metric} {fmt(best)}
        {bar != null && <> against a bar of {higher ? "at least" : "at most"} {fmt(bar)}, {passes ? "which it passes" : "not passed yet"}</>}
        , over {runs} run{runs === 1 ? "" : "s"}.
      </p>
    </div>
  );
}
