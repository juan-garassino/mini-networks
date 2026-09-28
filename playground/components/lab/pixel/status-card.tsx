"use client";

// The model card as a JRPG status screen: real stats only.
//   LV = generation depth · class = family · gate meter = best local metric
//   vs the M-tier bar (direction-aware) · equipped = champion version ·
//   skills = mechanisms the model introduces · party = parents / children.
import { useMemo } from "react";
import { displayName, EVIDENCE_COPY, type CardModel } from "@/components/lab/shared/card-model";
import { familyLabel } from "./palette";
import { sprite } from "./raster";
import { POINTER } from "./sprites";
import { castleFor, dotFor, type NodeLook } from "./terrain";
import { SpriteImg } from "./sprite-img";
import { PixelWindow } from "./window";
import styles from "./pixel.module.css";

const CELLS = 16;
const SPAN = 1.25; // meter spans 0…1.25× the bar, so the bar sits at 80%

export function gateMeter(card: CardModel) {
  const ev = card.evidence;
  if (!ev || ev.threshold_m == null || !ev.gate_metric) return null;
  const best = ev.best_metric;
  const ratio = best == null ? null
    : ev.higher_is_better ? best / ev.threshold_m
    : best > 0 ? ev.threshold_m / best : SPAN;
  return {
    metric: ev.gate_metric.replace(/_/g, " "),
    bar: ev.threshold_m,
    best,
    higher: ev.higher_is_better,
    ratio,
    filled: ratio == null ? 0 : Math.round(Math.min(ratio / SPAN, 1) * CELLS),
    passes: card.passesBar,
  };
}

const fmt = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 10 ? n.toFixed(1) : n.toPrecision(2).replace(/\.?0+$/, ""));

export function championTag(card: CardModel): string | null {
  const v = card.evidence?.champion_version?.match(/v\d+/)?.[0];
  return card.state === "champion" ? `Champion ${v ?? ""}`.trim() : null;
}

function PartyRow({ name, atom, look, onPick }: { name: string; atom: boolean; look: NodeLook; onPick: (n: string) => void }) {
  const pointer = useMemo(() => sprite(POINTER), []);
  const icon = useMemo(() => (atom ? castleFor(look) : dotFor(look)), [atom, look]);
  return (
    <li>
      <button type="button" className={styles.row} onClick={() => onPick(name)}>
        <span className={styles.cursor}><SpriteImg img={pointer} scale={2} /></span>
        <SpriteImg img={icon} scale={atom ? 1 : 1} />
        <span className="text-[17px] leading-tight">{displayName(name)}</span>
      </button>
    </li>
  );
}

export function StatusCard({ card, looks, atoms, onPick, onClose }: {
  card: CardModel;
  looks: Map<string, NodeLook>;
  atoms: Set<string>;
  onPick: (name: string) => void;
  onClose: () => void;
}) {
  const look = looks.get(card.name) ?? { state: card.state, filled: false };
  const portrait = useMemo(() => (card.atom ? castleFor(look) : dotFor(look)), [card.atom, look]);
  const meter = gateMeter(card);
  const equipped = championTag(card);
  const runs = card.evidence?.run_count ?? 0;
  const lookOf = (n: string) => looks.get(n) ?? { state: "untrained" as const, filled: false };

  return (
    <PixelWindow
      as="aside"
      aria-label={`Status of ${displayName(card.name)}`}
      className={`${styles.scroll} pointer-events-auto absolute inset-x-2 bottom-2 max-h-[52%] sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-4 sm:max-h-[calc(100%-32px)] sm:w-[380px]`}
    >
      <div className="px-2 pb-2 pt-1">
        <header className="flex items-start gap-3">
          <div className="grid h-[72px] w-[72px] flex-none place-items-center bg-[#1a1c2c] outline outline-2 outline-[#566c86]">
            <SpriteImg img={portrait} scale={card.atom ? 2 : 3} label={card.atom ? "Castle: an atom" : "Level dot: a derived model"} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[28px] font-bold leading-none text-[#f4f4f4]">{displayName(card.name)}</h2>
            <p className="mt-2 text-[20px] font-bold leading-tight text-[#ffcd75]">LV {card.depth}</p>
          </div>
          <button type="button" className={styles.btn} onClick={onClose} aria-label="Close status (Esc)">Close</button>
        </header>

        <p className="mt-3 text-[16px] leading-snug">{card.description}</p>
        {card.note && <p className={`${styles.muted} mt-1 text-[14px] leading-snug`}>{card.note}</p>}

        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[16px] leading-tight">
          <dt className={styles.muted}>Class</dt>
          <dd>{familyLabel(card.family)}, {card.atom ? "atom" : "derived model"}</dd>
          <dt className={styles.muted}>Equipped</dt>
          <dd className={equipped ? styles.gold : ""}>{equipped ?? "No champion"}</dd>
          <dt className={styles.muted}>Status</dt>
          <dd>{EVIDENCE_COPY[card.state]}</dd>
          <dt className={styles.muted}>Runs</dt>
          <dd>{runs === 0 ? "None logged here" : `${runs} logged`}</dd>
        </dl>

        {meter && (
          <section className="mt-4" aria-label="Quality gate">
            <div className="flex items-baseline justify-between gap-2 text-[16px] leading-tight">
              <span className={styles.muted}>Gate</span>
              <span>{meter.metric}</span>
            </div>
            <div className={`${styles.meter} mt-2`} role="meter" aria-valuemin={0} aria-valuemax={SPAN} aria-valuenow={meter.ratio ?? 0}
              aria-label={`best ${meter.metric} relative to the bar`}>
              {Array.from({ length: CELLS }, (_, i) => (
                <span key={i} className={styles.cell}
                  style={i < meter.filled ? { background: meter.passes ? "#a7f070" : "#ef7d57" } : undefined} />
              ))}
              <span className={styles.tick} style={{ left: `${(1 / SPAN) * 100}%` }} aria-hidden />
            </div>
            <p className="mt-2 text-[15px] leading-snug">
              Bar: {fmt(meter.bar)} {meter.higher ? "or more" : "or less"}.{" "}
              {meter.best == null
                ? <span className={styles.muted}>No local run has logged it yet.</span>
                : <span className={meter.passes ? styles.good : styles.warn}>
                    Best local run: {fmt(meter.best)}, {meter.passes ? "passes" : "below the bar"}.
                  </span>}
            </p>
            {card.state === "champion" && <p className={`${styles.muted} text-[14px] leading-snug`}>The champion passed this bar in the cloud sweep.</p>}
          </section>
        )}

        {card.introduces.length > 0 && (
          <section className="mt-4">
            <h3 className={`${styles.muted} text-[16px]`}>Skills learned</h3>
            <ul className="mt-1 space-y-1">
              {card.introduces.map((m) => (
                <li key={m.key} className="text-[16px] leading-snug">
                  <span className={styles.cyan}>{m.key.replace(/_/g, " ")}</span>
                  {m.description && <span className={styles.muted}>: {m.description}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-4">
          <h3 className={`${styles.muted} text-[16px]`}>Party</h3>
          <p className="mt-1 text-[14px] text-[#94b0c2]">Builds on</p>
          {card.parents.length ? (
            <ul>{card.parents.map((p) => <PartyRow key={p} name={p} atom={atoms.has(p)} look={lookOf(p)} onPick={onPick} />)}</ul>
          ) : <p className="text-[16px]">Nothing: it is an atom.</p>}
          <p className="mt-2 text-[14px] text-[#94b0c2]">Leads to</p>
          {card.children.length ? (
            <ul>{card.children.map((c) => <PartyRow key={c} name={c} atom={atoms.has(c)} look={lookOf(c)} onPick={onPick} />)}</ul>
          ) : <p className="text-[16px]">No models build on it yet.</p>}
        </section>

        {card.compositions.length > 0 && (
          <section className="mt-4">
            <h3 className={`${styles.muted} text-[16px]`}>Appears in</h3>
            <ul className="mt-1 space-y-1">
              {card.compositions.map((c) => (
                <li key={c.name} className="text-[16px] leading-snug">
                  {displayName(c.name)}
                  <span className={styles.muted}> with {c.composes.filter((n) => n !== card.name).map(displayName).join(", ")}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </PixelWindow>
  );
}
