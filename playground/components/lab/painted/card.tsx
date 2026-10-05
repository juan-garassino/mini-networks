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
// One rhythm (material.ts SPACE): a section every 24 px, a header 10 px
// above its content, chips 6 px apart. One face, the map's own: Pixelify Sans (its
// digits from clearer pixel faces, material.ts PIXEL_FONT: 5 never reads S) at three
// weights — 700 for the name and the section headers (the map's sign voice),
// 500 for anything you can press and the small labels, 400 for reading.
// One type scale (material.ts TYPE; the sign voice at the material's
// signScale): name 28, section header 14 (bold, border ink, ruled
// to the edge), body 15/1.4, notes 13/1.35, meta 12 — and running text keeps
// a measure of at most 38 characters. Three sections, one header each:
// Lineage (built on / leads to as its two sub-labels), Pipelines, Quality gate.
import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { displayName, EVIDENCE_COPY, type CardModel, type EvidenceState } from "@/components/lab/shared/card-model";
import { MechanismDiagram } from "@/components/lab/shared/anatomy2";
import { THEMES } from "@/components/lab/shared/anatomy2/themes";
import { DRAWER, FAMILY_TITLE, SPACE, TYPE, nameFace, sign, textFace, type Material } from "./material";
import { EvidenceIcon } from "./pixel-icon";
import { MarkIcon } from "./marker";
import { plateStyle } from "./corners/plate";

const fmt = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 1 ? n.toFixed(2) : n.toFixed(3));
/** The model's evidence as the map draws it: its banner (atom) or stone
 * (derived) sprite on the pixel maps, a filled dot on the paper map. */
/** A skin's own evidence glyph for the card (the name, the signposts, "you are
 * here"); unset, the painted maps' sprite or marker. */
export type CardGlyph = (state: EvidenceState, atom: boolean, big: boolean) => ReactNode;
const GlyphOverride = createContext<CardGlyph | null>(null);

function Glyph({ m, state, atom, big = false }: { m: Material; state: EvidenceState; atom: boolean; big?: boolean }) {
  const own = useContext(GlyphOverride);
  if (own) return <>{own(state, atom, big)}</>;
  if (m.crisp) return <EvidenceIcon state={state} atom={atom} scale={big ? (atom && state !== "untrained" ? 2 : 3) : (atom && state !== "untrained" ? 1 : 2)} />;
  // the map's own marker: disc, star for a champion, pip for trained
  return <MarkIcon m={m} state={state} size={big ? 22 : 14} />;
}

/** A section header in the map's sign voice, with the count badge the land
 * signs carry when there is something to count, ruled out to the edge so the
 * three sections read as three. */
function Label({ m, children, count, id }: { m: Material; children: ReactNode; count?: number; id?: string }) {
  return (
    <h3 id={id} className="flex items-center gap-2 leading-none" style={{ fontFamily: m.signFont, fontWeight: 700, fontSize: sign(m, TYPE.head), color: m.crisp ? m.border : m.ink, marginBottom: SPACE.label }}>
      {children}
      {count != null && (
        <span className="px-1.5 py-0.5 leading-none" style={{ background: m.crisp ? m.border : m.loud, color: m.loudInk, fontSize: TYPE.badge, fontWeight: 700, borderRadius: m.radius, fontVariantNumeric: "tabular-nums" }}>
          {count}
        </span>
      )}
      <span aria-hidden className="block flex-1" style={{ height: "var(--ap, 2px)", background: m.crisp ? m.rule : m.inkSoft, opacity: m.crisp ? 1 : 0.35 }} />
    </h3>
  );
}

/** The taxonomy's "introduces": a gold cog (a mechanism), drawn on a 7-unit
 * grid so it lands on art pixels on the pixel map — never an empty square
 * that reads as an unchecked box. */
function MechanismGlyph({ m, size = 14 }: { m: Material; size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 7 7" shapeRendering={m.crisp ? "crispEdges" : undefined} style={{ display: "block", flex: "none" }}>
      <g fill={m.border}>
        <rect x="3" y="0" width="1" height="7" /><rect x="0" y="3" width="7" height="1" />
        <rect x="1" y="1" width="5" height="5" />
      </g>
      <rect x="2" y="2" width="3" height="3" fill={m.road} />
      <rect x="3" y="3" width="1" height="1" fill={m.border} />
    </svg>
  );
}

/** A sub-label inside a section (the lineage's "Built on" / "Leads to"). */
function SubLabel({ m, children }: { m: Material; children: ReactNode }) {
  return <p className="leading-none" style={{ fontSize: TYPE.meta, fontWeight: 500, color: m.inkSoft, marginBottom: SPACE.sub }}>{children}</p>;
}

/** A neighbour on the road: a plate you press to travel there, with its
 * evidence sprite. */
function Signpost({ name, theme: m, onPick, state, atom }: { name: string; theme: Material; onPick: (n: string) => void; state: CardModel["state"]; atom: boolean }) {
  return (
    <button type="button" onClick={() => onPick(name)} title={`Go to ${displayName(name)}`}
      className="inline-flex min-h-[28px] items-center gap-1.5 px-2 py-1 leading-none hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ ...plateStyle(m), fontFamily: m.bodyFont, fontWeight: 500, fontSize: TYPE.chip }}>
      <Glyph m={m} state={state} atom={atom} />
      {displayName(name)}
    </button>
  );
}

/** A stretch of the road between the groups of signposts: the dashed ink of
 * the map's lineage roads, under the signposts' sprites. */
function Road({ m, h = 14 }: { m: Material; h?: number }) {
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
    <span className="inline-flex flex-none items-center gap-1.5 px-2 py-1 leading-none" style={{ ...style, fontFamily: m.signFont, fontWeight: 700, fontSize: sign(m, TYPE.stamp), borderRadius: m.radius }}>
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

export function CardBody({ glyph, ...p }: Parameters<typeof CardBodyInner>[0] & { glyph?: CardGlyph }) {
  return <GlyphOverride.Provider value={glyph ?? null}><CardBodyInner {...p} /></GlyphOverride.Provider>;
}

function CardBodyInner({ card, theme: m, still, onPick, stateOf, isAtom, diagramWidth, onOpenDiagram, diagramOn = "drawer", onShowDiagram }: {
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
  const section: CSSProperties = { marginTop: SPACE.section };
  const pipes = card.compositions;
  // sentences in the reading face; names, chips, headings stay in the map's voice
  const prose = textFace(m);
  const text: CSSProperties = { maxWidth: DRAWER.measure, fontFamily: prose };
  const note: CSSProperties = { fontSize: TYPE.note, lineHeight: 1.35, color: m.inkSoft, maxWidth: DRAWER.measure, fontFamily: prose };
  return (
    <section aria-label={`${name} lesson card`} style={{ color: m.ink, fontFamily: m.bodyFont, fontSize: TYPE.body, lineHeight: 1.4 }}>
      {/* where it is, then who, then how far it has got */}
      <p className="leading-none" style={{ fontSize: TYPE.meta, fontWeight: 500, color: m.inkSoft }}>{where}</p>
      <h2 className="mt-2 flex items-end gap-2.5 leading-none" style={{ fontFamily: nameFace(m), fontWeight: 700, fontSize: m.nameFont ? TYPE.name : sign(m, TYPE.name), color: head }}>
        <Glyph m={m} state={card.state} atom={card.atom} big />
        <span style={{ overflowWrap: "anywhere" }}>{name}</span>
      </h2>
      <div className="mt-3 flex items-center gap-2.5">
        <Stamp m={m} state={card.state} version={version} />
        {gloss && <p style={{ ...note, lineHeight: 1.25 }}>{gloss[0].toUpperCase() + gloss.slice(1)}.</p>}
      </div>

      {/* what it does, and the one idea it adds to the zoo */}
      {card.description && <p style={{ ...text, marginTop: SPACE.lede }}>{card.description}</p>}
      {card.introduces.map((i) => (
        // pixel: a recessed panel in the plate's bevel; paper: a sheet of the cardstock laid flat (no drop)
        <div key={i.key} className="mt-3 px-2.5 py-2" style={m.card ? plateStyle(m, { shadow: false })
          : { background: m.plate, border: `var(--ap, 2px) solid ${m.crisp ? m.rule : m.border}`, borderRadius: m.radius, boxShadow: m.crisp ? `inset 0 0 0 1px ${m.rule}` : undefined }}>
          <p className="flex items-center gap-2 leading-none" style={{ fontSize: TYPE.meta, fontWeight: 500, color: m.inkSoft }}>
            <MechanismGlyph m={m} />
            Introduces
          </p>
          <p className="mt-1.5" style={{ fontSize: TYPE.chip, lineHeight: 1.35, maxWidth: DRAWER.measure }}>
            <b style={{ fontWeight: 700, color: head }}>{displayName(i.key)}</b>
            {i.description ? <span style={{ fontFamily: prose }}>: {i.description}</span> : null}
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
          className="mt-4 inline-flex min-h-[28px] items-center gap-2 px-2.5 py-1 leading-none hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ ...plateStyle(m), fontFamily: m.bodyFont, fontWeight: 500, fontSize: TYPE.chip }}>
          Show how {name} works on the map
        </button>
      ) : null}

      {/* its road: built on → itself → leads to, as the map draws a lineage */}
      <nav aria-label={`${name}'s road`} style={section}>
        <Label m={m}>Lineage</Label>
        <SubLabel m={m}>Built on</SubLabel>
        {card.parents.length ? (
          <div className="flex flex-wrap gap-1.5">
            {card.parents.map((p) => <Signpost key={p} name={p} theme={m} onPick={onPick} state={stateOf(p)} atom={isAtom(p)} />)}
          </div>
        ) : (
          <p style={{ ...note, marginBottom: 8 }}>Nothing: {name} is an atom, where its roads begin.</p>
        )}
        {/* an atom is where the road begins: no road runs into it */}
        {card.parents.length > 0 && <Road m={m} />}
        <div className="flex items-center gap-2">
          <span className="inline-flex min-h-[28px] items-center gap-1.5 px-2 py-1 leading-none" aria-current="true"
            style={{ ...plateStyle(m, { loud: true, shadow: false }), fontFamily: m.bodyFont, fontWeight: 700, fontSize: TYPE.chip }}>
            <Glyph m={m} state={card.state} atom={card.atom} />
            {name}
          </span>
          <span style={{ fontSize: TYPE.meta, color: m.inkSoft }}>you are here</span>
        </div>
        <Road m={m} />
        <SubLabel m={m}>Leads to</SubLabel>
        {card.children.length ? (
          <div className="flex flex-wrap gap-1.5">
            {card.children.map((c) => <Signpost key={c} name={c} theme={m} onPick={onPick} state={stateOf(c)} atom={isAtom(c)} />)}
          </div>
        ) : (
          // the road's end, drawn as a signpost with nothing on it yet
          <p className="inline-flex px-2 py-1" style={{ ...note, border: `var(--ap, 2px) dashed ${m.crisp ? m.border : m.inkSoft}`, borderRadius: m.radius }}>
            The road ends here: no model builds on {name} yet.
          </p>
        )}
      </nav>

      {pipes.length > 0 && (
        <div style={section}>
          <Label m={m} count={pipes.length}>{pipes.length === 1 ? "Pipeline" : "Pipelines"}</Label>
          <ul className="space-y-2">
            {pipes.slice(0, 6).map((c) => (
              <li key={c.name} style={{ lineHeight: 1.3, maxWidth: DRAWER.measure }}>
                <span className="block" style={{ fontWeight: 700, fontSize: TYPE.chip }}>{displayName(c.name)}</span>
                <span className="block" style={{ fontSize: TYPE.note, color: m.inkSoft }}>
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
          {pipes.length > 6 && <p className="mt-2" style={note}>And {pipes.length - 6} more.</p>}
        </div>
      )}

      {ev?.gate_metric && (
        <div style={section}>
          <Label m={m}>Quality gate</Label>
          {ev.best_metric != null && (
            <div className="mb-2.5">
              <MetricBar m={m} metric={ev.gate_metric} best={ev.best_metric} bar={ev.threshold_m ?? null} higher={Boolean(ev.higher_is_better)} passes={card.passesBar} />
            </div>
          )}
          {/* tabular figures: the bar and the best score stack in one column, digit over digit */}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1" style={{ fontSize: TYPE.note, lineHeight: 1.35, fontVariantNumeric: "tabular-nums", fontFamily: prose }}>
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
