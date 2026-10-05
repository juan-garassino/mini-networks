"use client";

// The lesson card's content, in the drawer: the SAME facts every skin shows
// (shared cardModel), read top to bottom as a reading panel:
//   where it is (its land, atom or generation) → its name, under its own map
//   sprite → its evidence stamp → what it does and the mechanism it
//   introduces → (the diagram, when it lives in the card) → its road: what it
//   is built on, itself, what leads on from it — drawn as the map draws a
//   lineage, signposts joined by a dotted road → the pipelines it is in → the
//   quality gate it is judged by.
// With diagramOn="map" (the painted maps on desktop) the diagram is a plate on
// the map instead (map-plate.tsx) and the card is text only.
// One rhythm: 8-px steps (a section every 28 px, a label 10 px above its
// content, chips 6 px apart). One face, the map's own: Pixelify Sans at three
// weights — 700 for the name and the section labels (the map's sign voice),
// 500 for anything you can press, 400 for reading.
import type { CSSProperties, ReactNode } from "react";
import { displayName, EVIDENCE_COPY, type CardModel, type EvidenceState } from "@/components/lab/shared/card-model";
import { MechanismDiagram } from "@/components/lab/shared/anatomy2";
import { THEMES } from "@/components/lab/shared/anatomy2/themes";
import { FAMILY_TITLE, type Material } from "./material";
import { EvidenceIcon } from "./pixel-icon";
import { plateStyle } from "./corners/plate";

const fmt = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 1 ? n.toFixed(2) : n.toFixed(3));
const SECTION = 28;   // px between sections
const LABEL_GAP = 10; // px from a section label to its content

/** The model's evidence as the map draws it: its banner (atom) or stone
 * (derived) sprite on the pixel maps, a filled dot on the paper map. */
function Glyph({ m, state, atom, big = false }: { m: Material; state: EvidenceState; atom: boolean; big?: boolean }) {
  if (m.crisp) return <EvidenceIcon state={state} atom={atom} scale={big ? (atom && state !== "untrained" ? 2 : 3) : (atom && state !== "untrained" ? 1 : 2)} />;
  const s = big ? 14 : 10;
  return <span aria-hidden className="inline-block flex-none rounded-full" style={{ width: s, height: s, background: m.evidence[state].fill, border: `1.5px solid ${m.evidence[state].stroke}` }} />;
}

/** A section label in the map's sign voice, with the count badge the land
 * signs carry when there is something to count. */
function Label({ m, children, count, id }: { m: Material; children: ReactNode; count?: number; id?: string }) {
  return (
    <h3 id={id} className="flex items-center gap-2 leading-none" style={{ fontFamily: m.signFont, fontWeight: 700, fontSize: 15, color: m.crisp ? m.border : m.ink, marginBottom: LABEL_GAP }}>
      {children}
      {count != null && (
        <span className="px-1.5 py-0.5 leading-none" style={{ background: m.crisp ? m.border : m.loud, color: m.loudInk, fontSize: 12, fontWeight: 700, borderRadius: m.crisp ? 0 : 3 }}>
          {count}
        </span>
      )}
    </h3>
  );
}

/** A neighbour on the road: a plate you press to travel there, with its
 * evidence sprite. */
function Signpost({ name, theme: m, onPick, state, atom }: { name: string; theme: Material; onPick: (n: string) => void; state: CardModel["state"]; atom: boolean }) {
  return (
    <button type="button" onClick={() => onPick(name)} title={`Go to ${displayName(name)}`}
      className="inline-flex min-h-[30px] items-center gap-1.5 px-2 py-1 leading-none hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ ...plateStyle(m), fontFamily: m.bodyFont, fontWeight: 500, fontSize: 15 }}>
      <Glyph m={m} state={state} atom={atom} />
      {displayName(name)}
    </button>
  );
}

/** A stretch of the road between the groups of signposts: the dashed ink of
 * the map's lineage roads, under the signposts' sprites. */
function Road({ m, h = 18 }: { m: Material; h?: number }) {
  const ink = m.crisp ? m.border : m.inkSoft;
  return <span aria-hidden className="block" style={{ height: h, width: 4, marginLeft: 14, background: `repeating-linear-gradient(180deg, ${ink} 0 4px, transparent 4px 7px)` }} />;
}

/** The evidence stamp: the state in the colours the map paints it, the
 * champion's registry version beside it. */
function Stamp({ m, state, version }: { m: Material; state: EvidenceState; version?: string }) {
  const [head] = EVIDENCE_COPY[state].split(" — ");
  const ev = m.evidence[state];
  // whichever of the material's two inks reads better on the stamp's fill
  const lum = (hx: string) => { const n = parseInt(hx.slice(1, 7), 16); return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255); };
  const fill = ev.fill.startsWith("#") ? lum(ev.fill) : 128;
  const ink = Math.abs(lum(m.ink) - fill) >= Math.abs(lum(m.loudInk) - fill) ? m.ink : m.loudInk;
  const style: CSSProperties = state === "provisional"
    ? { background: m.plateHi, color: m.border, border: `var(--ap, 2px) dashed ${m.border}` }
    : { background: ev.fill, color: ink, border: `var(--ap, 2px) solid ${m.crisp ? m.border : ev.stroke}` };
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 leading-none" style={{ ...style, fontFamily: m.signFont, fontWeight: 700, fontSize: 14, borderRadius: m.crisp ? 0 : 3 }}>
      {head}{version ? ` ${version}` : ""}
    </span>
  );
}

/** The diagram is drawn on its own dusk ground with captions in that palette;
 * set straight on the cream drawer the ground floated and the caption + "Open
 * full diagram" link vanished. A mat cut from the diagram's ground, framed
 * like every other plate, holds picture and caption together as one object. */
export const MAT_PAD = 10;
export function DiagramMat({ m, children, className = "" }: { m: Material; children: React.ReactNode; className?: string }) {
  return (
    <div className={className} style={{
      background: THEMES[m.diagram].ground, padding: `${MAT_PAD}px ${MAT_PAD}px ${MAT_PAD - 2}px`,
      border: `var(--ap, 2px) solid ${m.border}`,
      boxShadow: m.crisp ? `var(--ap) var(--ap) 0 ${m.shadow}` : m.card ? m.card.drop : `2px 3px 0 ${m.shadow}`,
      borderRadius: m.radius,
    }}>
      {children}
    </div>
  );
}

export function CardBody({ card, theme: m, still, onPick, stateOf, isAtom, diagramWidth, onOpenDiagram, diagramOn = "drawer", onShowDiagram }: {
  card: CardModel; theme: Material; still: boolean; onPick: (n: string) => void;
  stateOf: (n: string) => CardModel["state"]; isAtom: (n: string) => boolean;
  diagramWidth: number; onOpenDiagram: () => void;
  /** "map": the diagram hangs on the map as a plate (painted, desktop), so the
   * card keeps only the text; "drawer" (default): the diagram is in the card */
  diagramOn?: "drawer" | "map";
  /** diagramOn "map" with the plate closed: a button that reopens it */
  onShowDiagram?: () => void;
}) {
  const ev = card.evidence;
  const version = ev?.champion_version?.match(/v\d+/)?.[0];
  const name = displayName(card.name);
  const land = FAMILY_TITLE[card.family] ?? card.family;
  const where = card.atom ? `${land}, an atom` : `${land}, generation ${card.depth}`;
  const [, gloss] = EVIDENCE_COPY[card.state].split(" — ");
  const head = m.crisp ? m.border : m.ink;
  const section: CSSProperties = { marginTop: SECTION };
  const pipes = card.compositions;
  return (
    <section aria-label={`${name} lesson card`} style={{ color: m.ink, fontFamily: m.bodyFont, fontSize: 16, lineHeight: 1.5 }}>
      {/* where it is, then who */}
      <p className="leading-none" style={{ fontSize: 13, fontWeight: 500, color: m.inkSoft }}>{where}</p>
      <h2 className="mt-2.5 flex items-end gap-2.5 leading-none" style={{ fontFamily: m.signFont, fontWeight: 700, fontSize: 30, color: head }}>
        <Glyph m={m} state={card.state} atom={card.atom} big />
        <span style={{ overflowWrap: "anywhere" }}>{name}</span>
      </h2>
      <div className="mt-3"><Stamp m={m} state={card.state} version={version} /></div>
      {gloss && <p className="mt-2 leading-snug" style={{ fontSize: 14, color: m.inkSoft }}>{gloss[0].toUpperCase() + gloss.slice(1)}.</p>}

      {/* what it does, and the one idea it adds to the zoo */}
      {card.description && <p style={{ marginTop: 20 }}>{card.description}</p>}
      {card.introduces.map((i) => (
        <div key={i.key} className="mt-3 px-3 py-2.5" style={{ background: m.crisp ? m.plate : `${m.plate}`, border: `var(--ap, 2px) solid ${m.crisp ? m.rule : m.border}`, borderRadius: m.crisp ? 0 : 3, boxShadow: m.crisp ? `inset 0 0 0 1px ${m.rule}` : undefined }}>
          <p className="flex items-center gap-2 leading-none" style={{ fontSize: 13, fontWeight: 500, color: m.inkSoft }}>
            <span aria-hidden className="inline-block h-2 w-2 flex-none" style={{ background: m.road, boxShadow: `0 0 0 1px ${m.border}` }} />
            Introduces
          </p>
          <p className="mt-1.5" style={{ lineHeight: 1.4 }}>
            <b style={{ fontWeight: 700, color: head }}>{displayName(i.key)}</b>
            {i.description ? <span>: {i.description}</span> : null}
          </p>
        </div>
      ))}

      {diagramOn === "drawer" ? (
        <div style={section}>
          <Label m={m}>How it works</Label>
          <DiagramMat m={m}>
            <MechanismDiagram name={card.name} theme={m.diagram} variant="card" still={still} width={diagramWidth - 2 * MAT_PAD - 6}
              onOpen={() => { onOpenDiagram(); return true; }} />
          </DiagramMat>
        </div>
      ) : onShowDiagram ? (
        <button type="button" onClick={onShowDiagram}
          className="mt-4 inline-flex min-h-[30px] items-center gap-2 px-2.5 py-1 leading-none hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ ...plateStyle(m), fontFamily: m.bodyFont, fontWeight: 500, fontSize: 15 }}>
          Show how {name} works on the map
        </button>
      ) : null}

      {/* its road: built on → itself → leads to, as the map draws a lineage */}
      <nav aria-label={`${name}'s road`} style={section}>
        {card.parents.length ? (
          <>
            <Label m={m} count={card.parents.length}>Built on</Label>
            <div className="flex flex-wrap gap-1.5">
              {card.parents.map((p) => <Signpost key={p} name={p} theme={m} onPick={onPick} state={stateOf(p)} atom={isAtom(p)} />)}
            </div>
          </>
        ) : (
          <>
            <Label m={m}>Built on</Label>
            <p className="leading-snug" style={{ fontSize: 14, color: m.inkSoft, marginBottom: 10 }}>Nothing: {name} is an atom, where its roads begin.</p>
          </>
        )}
        {/* an atom is where the road begins: no road runs into it */}
        {card.parents.length > 0 && <Road m={m} />}
        <div className="flex items-center gap-2">
          <span className="inline-flex min-h-[30px] items-center gap-1.5 px-2 py-1 leading-none" aria-current="true"
            style={{ ...plateStyle(m, { loud: true, shadow: false }), fontFamily: m.bodyFont, fontWeight: 700, fontSize: 15 }}>
            <Glyph m={m} state={card.state} atom={card.atom} />
            {name}
          </span>
          <span style={{ fontSize: 13, color: m.inkSoft }}>you are here</span>
        </div>
        <Road m={m} />
        {card.children.length ? (
          <>
            <Label m={m} count={card.children.length}>Leads to</Label>
            <div className="flex flex-wrap gap-1.5">
              {card.children.map((c) => <Signpost key={c} name={c} theme={m} onPick={onPick} state={stateOf(c)} atom={isAtom(c)} />)}
            </div>
          </>
        ) : (
          <>
            <Label m={m}>Leads to</Label>
            {/* the road's end, drawn as a signpost with nothing on it yet */}
            <p className="inline-flex px-2 py-1 leading-snug" style={{ fontSize: 14, color: m.inkSoft, border: `var(--ap, 2px) dashed ${m.crisp ? m.border : m.inkSoft}`, borderRadius: m.crisp ? 0 : 3 }}>
              The road ends here: no model builds on {name} yet.
            </p>
          </>
        )}
      </nav>

      {pipes.length > 0 && (
        <div style={section}>
          <Label m={m} count={pipes.length}>{pipes.length === 1 ? "In a pipeline" : "In pipelines"}</Label>
          <ul className="space-y-2.5">
            {pipes.slice(0, 6).map((c) => (
              <li key={c.name} className="leading-snug">
                <span className="block" style={{ fontWeight: 700, fontSize: 15 }}>{displayName(c.name)}</span>
                <span className="block" style={{ fontSize: 14, color: m.inkSoft }}>
                  {c.composes.map((n, i) => (
                    <span key={n}>
                      {i > 0 && " + "}
                      {n === card.name
                        ? <b style={{ fontWeight: 700, color: head }}>{displayName(n)}</b>
                        : <button type="button" onClick={() => onPick(n)} className="underline decoration-dotted underline-offset-4 hover:brightness-110 focus-visible:outline-2"
                            style={{ color: m.ink, fontFamily: m.bodyFont }}>{displayName(n)}</button>}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          {pipes.length > 6 && <p className="mt-2" style={{ fontSize: 14, color: m.inkSoft }}>And {pipes.length - 6} more.</p>}
        </div>
      )}

      {ev?.gate_metric && (
        <div style={section}>
          <Label m={m}>The quality gate</Label>
          {ev.best_metric != null && (
            <div className="mb-3">
              <MetricBar m={m} metric={ev.gate_metric} best={ev.best_metric} bar={ev.threshold_m ?? null} higher={Boolean(ev.higher_is_better)} passes={card.passesBar} />
            </div>
          )}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 leading-snug" style={{ fontSize: 14 }}>
            <dt style={{ color: m.inkSoft }}>Judged on</dt>
            <dd>{displayName(ev.gate_metric)}, {ev.higher_is_better ? "higher is better" : "lower is better"}</dd>
            {ev.threshold_m != null && (
              <>
                <dt style={{ color: m.inkSoft }}>Bar (tier M)</dt>
                <dd>{ev.higher_is_better ? "at least" : "at most"} {fmt(ev.threshold_m)}{ev.provisional ? ", still provisional" : ""}</dd>
              </>
            )}
            {ev.best_metric != null && (
              <>
                <dt style={{ color: m.inkSoft }}>Best so far</dt>
                <dd>{fmt(ev.best_metric)}{card.passesBar != null ? (card.passesBar ? ", passes" : ", not passed yet") : ""}</dd>
              </>
            )}
            <dt style={{ color: m.inkSoft }}>Runs logged</dt>
            <dd>{ev.run_count === 0 ? "none yet" : ev.run_count}</dd>
          </dl>
        </div>
      )}
    </section>
  );
}

/** Best metric against the M bar as a small drawn bar: the bar's position is
 * the threshold, the fill is where the champion got to. */
function MetricBar({ m, metric, best, bar, higher, passes }: { m: Material; metric: string; best: number; bar: number | null; higher: boolean; passes: boolean | null }) {
  const hi = Math.max(Math.abs(best), Math.abs(bar ?? 0), 1e-9) * 1.25;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (Math.abs(v) / hi) * 100))}%`;
  return (
    <div className="relative h-4 w-full" style={{ background: m.field, boxShadow: `inset 0 0 0 var(--ap, 2px) ${m.border}` }} role="img"
      aria-label={`${metric} ${fmt(best)}${bar != null ? `, bar ${higher ? "at least" : "at most"} ${fmt(bar)}` : ""}`}>
      <div className="absolute inset-y-0 left-0" style={{ width: pct(best), background: passes ? m.evidence.champion.fill : m.evidence.untrained.fill, boxShadow: `inset 0 0 0 var(--ap, 2px) ${m.border}` }} />
      {bar != null && <div className="absolute inset-y-[-3px]" style={{ left: pct(bar), width: "var(--ap, 2px)", background: m.ring }} />}
    </div>
  );
}
