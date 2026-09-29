"use client";

// The lesson card as a folded paper booklet: a stitched spine, stacked page
// edges, perforated sections. Order (crit round 2): emblem + name + one plain
// sentence → animated anatomy → lineage mini-map → proof (curve, samples,
// try it) → pipelines (select one = its boat sails on the map).
// Desktop: pinned right. Phone: a bottom sheet. Content: cardModel + useLesson.
import { memo, useEffect, useState } from "react";
import { motion } from "motion/react";
import { iconFor } from "@/lib/icons";
import { COMPOSITION_LESSONS } from "@/lib/lessons";
import { schematicFor } from "@/lib/schematics";
import type { ModelEvidence, RunSummary } from "@/lib/types";
import { useLesson } from "@/hooks/use-lesson";
import { displayName, EVIDENCE_COPY, type CardModel } from "@/components/lab/shared/card-model";
import { Anatomy } from "@/components/lab/shared/lesson/anatomy";
import { Sparkline } from "@/components/lab/shared/lesson/sparkline";
import { TRY_COPY, tryAvailable, useTryIt } from "@/components/lab/shared/lesson/try-it";
import { DOUBLE_DESCENT_EGG } from "@/components/lab/shared/eggs";
import { familyName, inkOf, PAPER } from "./encoding";
import styles from "./paper.module.css";

const fmt = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 1 ? n.toFixed(2) : n.toFixed(3));
const words = (m: string) => m.replace(/_/g, " ");

function Glyph({ name, size = 18, color = PAPER.ink }: { name: string; size?: number; color?: string }) {
  const Icon = iconFor(name);
  return Icon ? <Icon width={size} height={size} color={color} strokeWidth={2.2} aria-hidden /> : null;
}

function StateSticker({ card }: { card: CardModel }) {
  const v = card.evidence?.champion_version?.match(/v\d+/)?.[0];
  const look = {
    champion: { bg: PAPER.flag, fg: PAPER.die, text: v ? `Champion ${v}` : "Champion" },
    provisional: { bg: PAPER.die, fg: PAPER.inkSoft, text: "Bar not inked yet" },
    trained: { bg: PAPER.face, fg: PAPER.die, text: "Trained" },
    untrained: { bg: PAPER.die, fg: PAPER.faceDeep, text: "Not trained yet" },
  }[card.state];
  return (
    <span className={`${styles.sticker} inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[15px] font-semibold`}
      style={{ background: look.bg, color: look.fg, border: card.state === "provisional" ? `2px dashed ${PAPER.pencil}` : card.state === "untrained" ? `2px solid ${PAPER.face}` : undefined }}>
      {card.state === "champion" && <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden><polygon points="10,1 12.6,7 19,7.4 14,11.6 15.6,18 10,14.4 4.4,18 6,11.6 1,7.4 7.4,7" fill={PAPER.die} /></svg>}
      {look.text}
    </span>
  );
}

function Chip({ name, onPick }: { name: string; onPick: (n: string) => void }) {
  return (
    <button type="button" onClick={() => onPick(name)}
      className={`${styles.chip} inline-flex items-center gap-1.5 rounded-md border-2 border-[#2B2118] bg-[#FFFDF6] px-2 py-1 text-[15px] font-medium text-[#2B2118] hover:bg-[#FFF1C9]`}>
      <Glyph name={name} size={16} />{displayName(name)}
    </button>
  );
}

function Arrow() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden className="mx-auto my-1 block">
      <path d="M11 2 V18 M5 12 L11 18 L17 12" fill="none" stroke={PAPER.road} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={`${styles.perf} mt-5 pt-4`}>
      <h3 className={`${styles.display} mb-2 text-[19px] leading-none text-[#2B2118]`}>{title}</h3>
      {children}
    </section>
  );
}

function TryIt({ name, evidence }: { name: string; evidence: ModelEvidence[] }) {
  const t = useTryIt(name);
  if (!t.preset || !tryAvailable(name, evidence)) return null;
  const o = t.output;
  return (
    <div className="mt-3 rounded-lg bg-[#F6EFDF] p-3">
      <button type="button" onClick={() => t.run()} disabled={t.state === "running"}
        className={`${styles.btn} rounded-lg border-2 border-[#2B2118] bg-[#F2B632] px-3 py-1.5 text-[15px] font-semibold text-[#2B2118] disabled:opacity-60`}>
        {t.state === "running" ? TRY_COPY.running : `Try it: ${t.preset.label.toLowerCase()}`}
      </button>
      {t.slow && <p className="mt-2 text-[14px] text-[#5A4B3C]">{TRY_COPY.warming}</p>}
      {t.error && <p className="mt-2 text-[15px] text-[#8A2B1E]">{t.error}</p>}
      {o?.kind === "text" && <p className="mt-2 whitespace-pre-wrap rounded bg-[#FFFDF6] p-2 text-[15px] leading-snug">{o.text}</p>}
      {o?.kind === "label" && <p className="mt-2 text-[16px]"><b>{o.label}</b>{o.detail ? ` — ${o.detail}` : ""}</p>}
      {o?.kind === "image" && (
        <div className="mt-2 flex gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {o.urls.map((u, i) => <img key={i} src={u} alt={`generated sample ${i + 1}`} className="h-14 w-14 rounded border-2 border-[#FFFDF6] [image-rendering:pixelated]" />)}
        </div>
      )}
      {o?.note && <p className="mt-1 text-[14px] text-[#5A4B3C]">{o.note}</p>}
    </div>
  );
}

export const PaperCard = memo(function PaperCard({ card, still, onPick, onClose, runs = [], evidence = [], comp = null, onComp }: {
  card: CardModel; still: boolean; onPick: (n: string) => void; onClose: () => void;
  runs?: RunSummary[]; evidence?: ModelEvidence[];
  /** the composition whose boat is sailing, and a setter (null = none) */
  comp?: string | null; onComp?: (name: string | null) => void;
}) {
  const ink = inkOf(card.family);
  const lesson = useLesson(card.name, { runs, evidence, still });
  const ev = card.evidence;
  const bar = ev && ev.threshold_m != null && ev.gate_metric
    ? `${words(ev.gate_metric)} ${ev.higher_is_better ? "at least" : "at most"} ${fmt(ev.threshold_m)}`
    : null;
  const kind = card.atom ? `An atom: a first model of ${familyName(card.family)}` : `Generation ${card.depth} of ${familyName(card.family)}`;
  const curve = lesson.curve?.[0];
  // the anatomy plays its forward pass for a few cycles when the page opens,
  // then rests (no idle motion)
  const [anim, setAnim] = useState(!still);
  useEffect(() => {
    if (still) { setAnim(false); return; }
    setAnim(true);
    const id = setTimeout(() => setAnim(false), 6000);
    return () => clearTimeout(id);
  }, [card.name, still]);

  return (
    <motion.aside
      key={card.name}
      initial={still ? false : { y: 26, rotate: 1.2, opacity: 0 }}
      animate={{ y: 0, rotate: -0.5, opacity: 1 }}
      transition={{ type: "spring", stiffness: 360, damping: 30 }}
      aria-label={`${displayName(card.name)} lesson`}
      className={`${styles.booklet} absolute inset-x-2 bottom-2 z-20 max-h-[45%] overflow-y-auto rounded-t-2xl pb-6 pl-9 pr-5 pt-4
        sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-5 sm:max-h-none sm:w-[430px] sm:rounded-lg`}
    >
      <span className={styles.fold} aria-hidden />
      <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-[#E3D6B8] sm:hidden" aria-hidden />

      {/* 1 · who */}
      <div className="flex items-start gap-3">
        <span className={`${styles.sticker} mt-1 grid h-14 w-14 shrink-0 place-items-center rounded-xl`} style={{ background: PAPER.face }}>
          <Glyph name={card.name} size={30} color={PAPER.die} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full px-2.5 py-0.5 text-[14px] font-semibold text-[#FFFDF6]" style={{ background: ink.edge }}>
              {familyName(card.family)}
            </span>
            <button type="button" onClick={onClose} aria-label="Close the lesson"
              className={`${styles.btn} mr-5 rounded-md border-2 border-[#2B2118] bg-[#FFFDF6] px-2 text-[14px] font-semibold leading-6`}>
              Close
            </button>
          </div>
          <h2 className={`${styles.display} mt-1.5 text-[34px] leading-[1.02] text-[#2B2118]`}>{displayName(card.name)}</h2>
          <p className="text-[14px] text-[#5A4B3C]">{kind}</p>
        </div>
      </div>
      <p className="mt-3 max-w-[60ch] text-[17px] leading-[1.55] text-[#2B2118]">{lesson.lesson?.what ?? card.description}</p>

      {/* 2 · how */}
      <Section title="How it works">
        <div className="rounded-lg bg-[#F6EFDF] px-2 py-1">
          <Anatomy stages={schematicFor(card.name)} animate={anim} size={370} labelPx={13}
            title={`${displayName(card.name)}, one forward pass`}
            palette={{ node: PAPER.ink, edge: "#8A7B6A", active: PAPER.face, text: PAPER.inkSoft, accent: PAPER.faceDeep, fill: PAPER.die }} />
        </div>
        {lesson.lesson && (
          <p className="mt-2 max-w-[60ch] text-[16px] leading-[1.55]"><b>The idea:</b> {lesson.lesson.idea}</p>
        )}
        {lesson.lesson?.analogy && <p className="mt-1 text-[16px] italic leading-[1.5] text-[#5A4B3C]">{lesson.lesson.analogy}</p>}
      </Section>

      {/* 3 · lineage */}
      <Section title="Family line">
        <div className="text-center">
          {card.parents.length
            ? <div className="flex flex-wrap justify-center gap-2">{card.parents.map((p) => <Chip key={p} name={p} onPick={onPick} />)}</div>
            : <p className="text-[15px] text-[#5A4B3C]">Nothing before it: it starts its family.</p>}
          <Arrow />
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[#2B2118] px-2.5 py-1 text-[15px] font-semibold text-[#FFFDF6]">
            <Glyph name={card.name} size={16} color={PAPER.die} />{displayName(card.name)}
          </span>
          {card.children.length > 0 && <Arrow />}
          {card.children.length
            ? <div className="flex flex-wrap justify-center gap-2">{card.children.map((c) => <Chip key={c} name={c} onPick={onPick} />)}</div>
            : <p className="mt-2 text-[15px] text-[#5A4B3C]">No model builds on it yet.</p>}
        </div>
        {lesson.lesson?.why && <p className="mt-3 max-w-[60ch] text-[16px] leading-[1.55]"><b>Why it exists:</b> {lesson.lesson.why}</p>}
      </Section>

      {/* 4 · proof */}
      <Section title="Proof it works">
        <StateSticker card={card} />
        <p className="mt-2 text-[16px] leading-snug">{EVIDENCE_COPY[card.state]}.</p>
        {bar && <p className="mt-1 text-[15px] leading-snug text-[#5A4B3C]">Quality bar: {bar}.{ev?.best_metric != null ? ` Best local score ${fmt(ev.best_metric)}${card.passesBar ? ", which clears it." : card.passesBar === false ? ", below the bar so far." : "."}` : ""}</p>}
        {curve && (
          <div className="mt-3">
            <Sparkline points={curve.points} label={words(curve.key)} width={360} height={70} fontPx={13}
              palette={{ line: PAPER.faceDeep, axis: "#CDBFA3", text: PAPER.inkSoft, fill: "rgba(47,116,224,0.12)" }} />
            {lesson.curveRun && <p className="text-[13px] text-[#5A4B3C]">From run {lesson.curveRun.id}</p>}
          </div>
        )}
        {!curve && lesson.loading && <p className="mt-2 text-[14px] text-[#5A4B3C]">Reading its training curve…</p>}
        {lesson.samples.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {lesson.samples.slice(0, 4).map((u) => <img key={u} src={u} alt={`A sample from ${displayName(card.name)}`} className="h-20 w-20 rounded border-4 border-[#FFFDF6] object-cover shadow-[0_3px_0_rgba(43,33,24,0.25)]" />)}
          </div>
        )}
        <TryIt name={card.name} evidence={evidence} />
      </Section>

      {/* 5 · pipelines */}
      {card.compositions.length > 0 && (
        <Section title="Sails with">
          <p className="mb-2 text-[15px] text-[#5A4B3C]">Pipelines that use it. Pick one to sail its boat between the islands.</p>
          <ul className="space-y-1.5">
            {card.compositions.map((c) => {
              const on = comp === c.name;
              return (
                <li key={c.name}>
                  <button type="button" aria-pressed={on} onClick={() => onComp?.(on ? null : c.name)}
                    className={`${styles.chip} flex w-full items-start gap-2 rounded-lg border-2 px-2.5 py-1.5 text-left text-[15px]`}
                    style={{ borderColor: on ? PAPER.ink : "#E3D6B8", background: on ? "#FFF1C9" : PAPER.die }}>
                    <span className="mt-0.5"><Glyph name={c.name} size={17} /></span>
                    <span>
                      <b>{displayName(c.name)}</b>
                      <span className="text-[#5A4B3C]"> with {c.composes.filter((x) => x !== card.name).map(displayName).join(", ")}</span>
                      {on && <span className="mt-1 block leading-snug">{COMPOSITION_LESSONS[c.name] ?? c.description}</span>}
                      {on && c.name === DOUBLE_DESCENT_EGG.composition && <span className="mt-1 block italic leading-snug text-[#5A4B3C]">Watch the boat: its course dips twice. {DOUBLE_DESCENT_EGG.explain}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </motion.aside>
  );
});
