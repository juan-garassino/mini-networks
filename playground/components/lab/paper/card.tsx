"use client";

// The model card as a folded paper note with stickers: what it is, proof it
// works, where it comes from and where it leads. Desktop: pinned to the right.
// Mobile: a bottom sheet. Content comes only from cardModel().
import { motion } from "motion/react";
import { displayName, EVIDENCE_COPY, type CardModel } from "@/components/lab/shared/card-model";
import { familyName, inkOf, PAPER } from "./encoding";
import styles from "./paper.module.css";

const fmt = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 1 ? n.toFixed(2) : n.toFixed(3));
const metricWords = (m: string) => m.replace(/_/g, " ");

function StateSticker({ card }: { card: CardModel }) {
  const v = card.evidence?.champion_version?.match(/v\d+/)?.[0];
  const look = {
    champion: { bg: PAPER.flag, fg: PAPER.die, text: v ? `Champion ${v}` : "Champion" },
    provisional: { bg: PAPER.die, fg: PAPER.inkSoft, text: "Bar not inked yet" },
    trained: { bg: PAPER.face, fg: PAPER.die, text: "Trained" },
    untrained: { bg: PAPER.die, fg: PAPER.face, text: "Not trained yet" },
  }[card.state];
  return (
    <span className={`${styles.sticker} inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[14px] font-semibold`}
      style={{ background: look.bg, color: look.fg, border: card.state === "provisional" ? `2px dashed ${PAPER.pencil}` : card.state === "untrained" ? `2px solid ${PAPER.face}` : undefined }}>
      {card.state === "champion" && <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden><polygon points="10,1 12.6,7 19,7.4 14,11.6 15.6,18 10,14.4 4.4,18 6,11.6 1,7.4 7.4,7" fill={PAPER.die} /></svg>}
      {look.text}
    </span>
  );
}

function Chips({ names, onPick, empty }: { names: string[]; onPick: (n: string) => void; empty: string }) {
  if (!names.length) return <p className="text-[14px] text-[#5A4B3C]">{empty}</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {names.map((n) => (
        <li key={n}>
          <button type="button" onClick={() => onPick(n)}
            className={`${styles.chip} rounded-md border-2 border-[#2B2118] bg-[#F2B632] px-2 py-0.5 text-[14px] font-medium text-[#2B2118] hover:bg-[#FFD066]`}>
            {displayName(n)}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function PaperCard({ card, still, onPick, onClose }: {
  card: CardModel; still: boolean; onPick: (n: string) => void; onClose: () => void;
}) {
  const ink = inkOf(card.family);
  const ev = card.evidence;
  const bar = ev && ev.threshold_m != null && ev.gate_metric
    ? `${metricWords(ev.gate_metric)} ${ev.higher_is_better ? "at least" : "at most"} ${fmt(ev.threshold_m)}`
    : null;
  const kind = card.atom
    ? `An atom: the root of ${familyName(card.family)}`
    : `Generation ${card.depth} in ${familyName(card.family)}`;

  return (
    <motion.aside
      key={card.name}
      initial={still ? false : { y: 24, rotate: 0 }}
      animate={{ y: 0, rotate: -0.6 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      aria-label={`${displayName(card.name)} model card`}
      className={`${styles.note} absolute inset-x-2 bottom-2 z-20 max-h-[50%] overflow-y-auto rounded-t-2xl px-5 pb-5 pt-4
        sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-5 sm:max-h-[calc(100%-40px)] sm:w-[372px] sm:rounded-lg`}
    >
      <span className={styles.fold} aria-hidden />
      <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-[#E3D6B8] sm:hidden" aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <span className={`${styles.sticker} rounded-full px-2.5 py-0.5 text-[13px] font-semibold text-[#FFFDF6]`} style={{ background: ink.edge }}>
          {familyName(card.family)}
        </span>
        <button type="button" onClick={onClose} aria-label="Close the card"
          className={`${styles.btn} mr-4 rounded-md border-2 border-[#2B2118] bg-[#FFFDF6] px-2 text-[14px] font-semibold leading-6`}>
          Close
        </button>
      </div>
      <h2 className={`${styles.display} mt-2 text-[34px] leading-[1.05] text-[#2B2118]`}>{displayName(card.name)}</h2>
      <p className="mt-1 text-[14px] text-[#5A4B3C]">{kind}</p>

      <section className="mt-4 rounded-lg border-2 border-dashed border-[#E3D6B8] p-3">
        <h3 className="text-[13px] font-semibold text-[#5A4B3C]">Proof it works</h3>
        <div className="mt-2"><StateSticker card={card} /></div>
        <p className="mt-2 text-[14px] leading-snug">{EVIDENCE_COPY[card.state]}.</p>
        {bar && (
          <p className="mt-1 text-[14px] leading-snug text-[#5A4B3C]">
            Quality bar: {bar}.{" "}
            {ev?.best_metric != null
              ? <>Best local score {fmt(ev.best_metric)}{card.passesBar === true ? ", which clears it." : card.passesBar === false ? ", below the bar so far." : "."}</>
              : "No local score recorded yet."}
          </p>
        )}
        {card.sampleImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.sampleImage} alt={`A sample from ${displayName(card.name)}`}
            className="mt-3 max-h-40 w-full rounded border-4 border-[#FFFDF6] object-contain shadow-[0_3px_0_rgba(43,33,24,0.25)]" />
        )}
      </section>

      <p className="mt-4 text-[15px] leading-relaxed">{card.description}</p>

      {card.introduces.length > 0 && (
        <section className="mt-4">
          <h3 className="text-[13px] font-semibold text-[#5A4B3C]">What it adds</h3>
          <ul className="mt-1 space-y-1">
            {card.introduces.map((m) => (
              <li key={m.key} className="text-[14px] leading-snug">
                <span className="font-semibold">{m.key.replace(/_/g, " ")}</span>{m.description ? `: ${m.description}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-4 space-y-3">
        <div>
          <h3 className="mb-1.5 text-[13px] font-semibold text-[#5A4B3C]">Builds on</h3>
          <Chips names={card.parents} onPick={onPick} empty="Nothing: it starts its family." />
        </div>
        <div>
          <h3 className="mb-1.5 text-[13px] font-semibold text-[#5A4B3C]">Leads to</h3>
          <Chips names={card.children} onPick={onPick} empty="No models build on it yet." />
        </div>
      </section>

      {card.compositions.length > 0 && (
        <section className="mt-4">
          <h3 className="text-[13px] font-semibold text-[#5A4B3C]">Used in pipelines</h3>
          <ul className="mt-1 space-y-1">
            {card.compositions.map((c) => (
              <li key={c.name} className="text-[14px] leading-snug">
                <span className="font-semibold">{displayName(c.name)}</span>
                {" "}with {c.composes.filter((x) => x !== card.name).map(displayName).join(", ")}
              </li>
            ))}
          </ul>
        </section>
      )}

      <button type="button" onClick={onClose}
        className={`${styles.btn} mt-5 w-full rounded-lg border-2 border-[#2B2118] bg-[#FFFDF6] px-3 py-2 text-[15px] font-semibold`}>
        Back to {familyName(card.family)}
      </button>
    </motion.aside>
  );
}
