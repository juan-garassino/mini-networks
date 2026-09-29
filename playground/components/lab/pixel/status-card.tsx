"use client";

// The model card as a JRPG status screen with pages (tabs, ↑/↓ inside the
// window), in the order a learner needs them:
//   Lesson    emblem portrait + name + LV + class + the plain lesson + stat bars
//   Anatomy   the species' forward pass (shared Anatomy, animated unless still)
//   Lineage   mini-map: parents → this model → children (clickable)
//   Proof     gate bar, real metric curve, samples, Try it (only when served)
//   Pipelines compositions — pick one and its boat sails the ferry route
// Every number is a 5×7 pixel digit (pixel-num.tsx). Body text ≥16px.
import { useEffect, useMemo, useRef, useState } from "react";
import { displayName, EVIDENCE_COPY, type CardModel } from "@/components/lab/shared/card-model";
import { Anatomy } from "@/components/lab/shared/lesson/anatomy";
import { Sparkline } from "@/components/lab/shared/lesson/sparkline";
import { TRY_COPY, tryAvailable, useTryIt } from "@/components/lab/shared/lesson/try-it";
import type { LessonData } from "@/hooks/use-lesson";
import { lessonFor } from "@/lib/lessons";
import { schematicFor } from "@/lib/schematics";
import type { ModelEvidence } from "@/lib/types";
import { familyLabel } from "./palette";
import { sprite } from "./raster";
import { POINTER, STAR } from "./sprites";
import type { NodeLook } from "./terrain";
import { SpriteImg } from "./sprite-img";
import { ArtImg } from "./art-img";
import { nodeSprite, type ArtEmblems } from "./world-art";
import { biomeOf as artBiome, PALETTE, RAMPS } from "./art";

type Emblems = ArtEmblems;
import { PixelWindow } from "./window";
import { PixelNum } from "./pixel-num";
import styles from "./pixel.module.css";

const CELLS = 16;
const SPAN = 1.25; // gate meter spans 0…1.25× the bar, so the bar sits at 80%
export const PAGES = ["Lesson", "Anatomy", "Lineage", "Proof", "Pipelines"] as const;
export type Page = (typeof PAGES)[number];

export function gateMeter(card: CardModel) {
  const ev = card.evidence;
  if (!ev || ev.threshold_m == null || !ev.gate_metric) return null;
  const best = ev.best_metric;
  const ratio = best == null ? null
    : ev.higher_is_better ? best / ev.threshold_m
    : best > 0 ? ev.threshold_m / best : SPAN;
  return {
    metric: ev.gate_metric.replace(/_/g, " "),
    bar: ev.threshold_m, best, higher: ev.higher_is_better, ratio,
    filled: ratio == null ? 0 : Math.round(Math.min(ratio / SPAN, 1) * CELLS),
    passes: card.passesBar,
  };
}

const fmt = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 10 ? n.toFixed(1) : n.toPrecision(2).replace(/\.?0+$/, ""));

export function championTag(card: CardModel): string | null {
  const v = card.evidence?.champion_version?.match(/v\d+/)?.[0];
  return card.state === "champion" ? `Champion ${v ?? ""}`.trim() : null;
}

/** JRPG stat bar: label, 12 cells filled by value/max, the number in pixel digits. */
function StatBar({ label, value, max, tone, note }: { label: string; value: number; max: number; tone: string; note: string }) {
  const n = 12, filled = max > 0 ? Math.round(Math.min(value / max, 1) * n) : 0;
  return (
    <div className="grid grid-cols-[88px_1fr_40px] items-center gap-2" title={note}>
      <span className={`${styles.muted} text-[16px]`}>{label}</span>
      <span className={styles.meter} aria-hidden>
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className={styles.cell} style={i < filled ? { background: tone } : undefined} />
        ))}
      </span>
      <span className="text-right text-[16px]"><PixelNum value={value} /></span>
      <span className="sr-only">{note}</span>
    </div>
  );
}

/** The model's own map sprite (castle per mechanism, or evidence marker with its emblem). */
function Emblem({ name, emblems, look, atom, scale = 1 }: {
  name: string; emblems: Emblems; look: NodeLook; atom: boolean; scale?: number;
}) {
  const img = useMemo(() => nodeSprite({ name, atom }, look, emblems).img, [name, emblems, look, atom]);
  return <ArtImg img={img} scale={scale} />;
}

function Row({ name, emblems, look, atom, onPick, trailing }: {
  name: string; emblems: Emblems; look: NodeLook; atom: boolean; onPick: (n: string) => void; trailing?: React.ReactNode;
}) {
  const pointer = useMemo(() => sprite(POINTER), []);
  return (
    <li>
      <button type="button" className={styles.row} onClick={() => onPick(name)}>
        <span className={styles.cursor}><SpriteImg img={pointer} scale={2} /></span>
        <Emblem name={name} emblems={emblems} look={look} atom={atom} />
        <span className="text-[17px] leading-tight">{displayName(name)}</span>
        {trailing}
      </button>
    </li>
  );
}

export function StatusCard({
  card, looks, atoms, emblems, lesson, evidence, still, descendants, maxDescendants, maxRuns,
  sailing, onSail, onPick, onClose,
}: {
  card: CardModel;
  looks: Map<string, NodeLook>;
  atoms: Set<string>;
  emblems: Emblems;
  lesson: LessonData;
  evidence: ModelEvidence[];
  still: boolean;
  descendants: number;
  maxDescendants: number;
  maxRuns: number;
  sailing: string | null;
  onSail: (composition: string | null) => void;
  onPick: (name: string) => void;
  onClose: () => void;
}) {
  const [page, setPage] = useState<Page>("Lesson");
  const [shownFor, setShownFor] = useState(card.name);
  if (shownFor !== card.name) { setShownFor(card.name); setPage("Lesson"); }
  const look = looks.get(card.name) ?? { state: card.state, filled: false };
  const lookOf = (n: string) => looks.get(n) ?? { state: "untrained" as const, filled: false };
  const portrait = useMemo(() => nodeSprite({ name: card.name, atom: card.atom }, look, emblems).img, [card.atom, look, emblems, card.name]);
  const ground = PALETTE[RAMPS[artBiome(card.family).mid][Math.min(3, RAMPS[artBiome(card.family).mid].length - 1)]];
  const star = useMemo(() => sprite(STAR), []);
  const meter = gateMeter(card);
  const equipped = championTag(card);
  const runs = card.evidence?.run_count ?? 0;
  const L = lesson.lesson;
  const tryIt = useTryIt(tryAvailable(card.name, evidence) ? card.name : null);
  const tabs = useRef<HTMLDivElement | null>(null);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    const i = PAGES.indexOf(page);
    const next = PAGES[(i + (e.key === "ArrowDown" ? 1 : PAGES.length - 1)) % PAGES.length];
    e.preventDefault();
    setPage(next);
  };
  useEffect(() => { tabs.current?.querySelector<HTMLButtonElement>(`[data-page="${page}"]`)?.scrollIntoView?.({ block: "nearest" }); }, [page]);

  return (
    <PixelWindow
      as="aside"
      aria-label={`Status of ${displayName(card.name)}`}
      onKeyDown={onKey}
      className={`${styles.scroll} pointer-events-auto absolute inset-x-2 bottom-2 max-h-[52%] sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-4 sm:max-h-[calc(100%-32px)] sm:w-[400px]`}
    >
      <div className="px-2 pb-2 pt-1">
        <header className="flex items-start gap-3">
          <div className="grid h-[104px] w-[96px] flex-none place-items-center border-2 border-[#1e1f4e] shadow-[inset_0_2px_0_rgba(255,246,224,0.35)]" style={{ background: ground }}>
            <ArtImg img={portrait} scale={card.atom ? 2 : 3}
              label={`${displayName(card.name)} as it stands on the map`} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[28px] font-bold leading-none text-[#fff6e0]">{displayName(card.name)}</h2>
            <p className="mt-2 text-[18px] font-bold leading-tight text-[#f5c24a]">LV <PixelNum value={card.depth} /></p>
            <p className="mt-1 text-[16px] leading-tight">{familyLabel(card.family)} {card.atom ? "atom" : "model"}</p>
          </div>
          <button type="button" className={styles.btn} onClick={onClose} aria-label="Close status (Esc)">Close</button>
        </header>

        <div ref={tabs} role="tablist" aria-label="Status pages (arrow up / down)" className="mt-3 flex flex-wrap gap-1">
          {PAGES.map((p) => (
            <button key={p} type="button" role="tab" data-page={p} aria-selected={page === p}
              className={page === p ? styles.tabOn : styles.tab} onClick={() => setPage(p)}>{p}</button>
          ))}
        </div>

        <div role="tabpanel" className="mt-3 min-h-[280px] max-w-[60ch]">
          {page === "Lesson" && (
            <>
              {L ? (
                <>
                  <p className="text-[17px] leading-[1.45]">{L.what}</p>
                  <p className={`${styles.muted} mt-2 text-[16px] leading-[1.45]`}>{L.why}</p>
                  <p className="mt-2 text-[16px] leading-[1.45]"><span className={styles.gold}>The idea: </span>{L.idea}</p>
                  {L.analogy && <p className={`${styles.muted} mt-2 text-[16px] leading-[1.45]`}>{L.analogy}</p>}
                </>
              ) : <p className="text-[17px] leading-[1.45]">{card.description}</p>}
              <div className="mt-4 space-y-2" aria-label="Stats">
                <StatBar label="Lineage" value={descendants} max={maxDescendants} tone="#62dcf2"
                  note={`${descendants} models build on it, directly or further down`} />
                <StatBar label="Runs" value={runs} max={maxRuns} tone="#cbea5e" note={`${runs} logged runs (local S-tier smoke tests)`} />
              </div>
              <p className="mt-3 text-[16px] leading-snug">
                <span className={styles.muted}>Equipped </span>
                {equipped ? <span className={styles.gold}>Champion v<PixelNum value={equipped.match(/\d+/)?.[0] ?? "1"} /></span> : "no champion yet"}
              </p>
            </>
          )}

          {page === "Anatomy" && (
            <div>
              <p className={`${styles.muted} mb-2 text-[16px]`}>One forward pass, left to right.</p>
              <div className="bg-[#1e1f4e] p-2 outline outline-2 outline-[#4a60b6]">
                <Anatomy stages={schematicFor(card.name)} animate={!still} size={340} labelPx={14}
                  title={`${displayName(card.name)}: one forward pass`}
                  palette={{ node: "#bccbe8", edge: "#4a60b6", active: "#f5c24a", text: "#fff6e0", accent: "#62dcf2", fill: "#2a2f6c" }} />
              </div>
              {card.introduces.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {card.introduces.map((m) => (
                    <li key={m.key} className="text-[16px] leading-snug">
                      <span className={styles.cyan}>{m.key.replace(/-/g, " ")}</span>
                      {m.description && <span className={styles.muted}>: {m.description}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {page === "Lineage" && (
            <div>
              <p className={`${styles.muted} text-[16px]`}>Builds on</p>
              {card.parents.length ? (
                <ul>{card.parents.map((p) => <Row key={p} name={p} emblems={emblems} look={lookOf(p)} atom={atoms.has(p)} onPick={onPick} />)}</ul>
              ) : <p className="text-[16px]">Nothing: it is an atom, a root of the map.</p>}
              <div className="my-2 flex items-center gap-2 pl-6" aria-hidden>
                <span className="h-[18px] w-[4px] bg-[#f5c24a]" />
                <Emblem name={card.name} emblems={emblems} look={look} atom={card.atom} scale={1} />
                <span className="text-[18px] font-bold text-[#f5c24a]">{displayName(card.name)}</span>
              </div>
              <p className={`${styles.muted} text-[16px]`}>Leads to</p>
              {card.children.length ? (
                <ul>{card.children.map((c) => <Row key={c} name={c} emblems={emblems} look={lookOf(c)} atom={atoms.has(c)} onPick={onPick} />)}</ul>
              ) : <p className="text-[16px]">No models build on it yet.</p>}
            </div>
          )}

          {page === "Proof" && (
            <div>
              <p className="text-[16px] leading-snug">{EVIDENCE_COPY[card.state]}.</p>
              {meter && (
                <section className="mt-3" aria-label="Quality gate">
                  <div className="flex items-baseline justify-between gap-2 text-[16px]">
                    <span className={styles.muted}>Gate</span><span>{meter.metric}</span>
                  </div>
                  <div className={`${styles.meter} mt-7`} role="meter" aria-valuemin={0} aria-valuemax={SPAN} aria-valuenow={meter.ratio ?? 0}
                    aria-label={meter.best == null ? "no M-tier score yet" : `best M-tier ${meter.metric} relative to the bar`}>
                    {Array.from({ length: CELLS }, (_, i) => (
                      <span key={i} className={meter.best == null ? styles.cellHollow : styles.cell}
                        style={i < meter.filled ? { background: meter.passes ? "#cbea5e" : "#ff8f2e" } : undefined} />
                    ))}
                    <span className={styles.tick} style={{ left: `${(1 / SPAN) * 100}%` }} aria-hidden />
                    {card.state === "champion" && (
                      <span className="absolute -top-[22px] -translate-x-1/2" style={{ left: `${(1 / SPAN) * 100}%` }} aria-hidden>
                        <SpriteImg img={star} scale={1} />
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[16px] leading-snug">
                    Bar: <PixelNum value={fmt(meter.bar)} /> {meter.higher ? "or more" : "or less"}.{" "}
                    {meter.best == null
                      ? <span className={styles.muted}>No M-tier score yet.{runs > 0 && <> The <PixelNum value={runs} /> local {runs === 1 ? "run is an S-tier smoke test" : "runs are S-tier smoke tests"}.</>}</span>
                      : <span className={meter.passes ? styles.good : styles.warn}>Best M-tier score: <PixelNum value={fmt(meter.best)} />, {meter.passes ? "passes" : "below the bar"}.</span>}
                  </p>
                  {card.state === "champion" && <p className={`${styles.gold} mt-1 text-[16px]`}>Cleared: the champion passed this bar in the cloud sweep.</p>}
                </section>
              )}
              <section className="mt-4" aria-label="Training curve">
                <p className={`${styles.muted} text-[16px]`}>Training curve</p>
                {lesson.curve?.[0] ? (
                  <div className="mt-1 bg-[#1e1f4e] p-2 outline outline-2 outline-[#4a60b6]">
                    <Sparkline points={lesson.curve[0].points} label={lesson.curve[0].key.replace(/_/g, " ")} width={320} height={72} fontPx={14}
                      palette={{ line: "#f5c24a", axis: "#4a60b6", text: "#bccbe8", dot: "#fff6e0" }}
                      title={`${lesson.curve[0].key} over training`} />
                    {lesson.curveRun && <p className={`${styles.muted} mt-1 text-[14px]`}>from run {lesson.curveRun.id.slice(0, 22)}</p>}
                  </div>
                ) : <p className="text-[16px]">{lesson.loading ? "Reading the run log…" : "No logged curve for this model here yet."}</p>}
              </section>
              {lesson.samples.length > 0 && (
                <section className="mt-3" aria-label="Samples">
                  <p className={`${styles.muted} text-[16px]`}>Samples</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {lesson.samples.slice(0, 4).map((u) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={u} src={u} alt="a sample from a logged run" width={72} height={72}
                        className="bg-[#1e1f4e] object-contain outline outline-2 outline-[#4a60b6]" style={{ imageRendering: "pixelated" }} />
                    ))}
                  </div>
                </section>
              )}
              {tryIt.preset && (
                <section className="mt-4" aria-label="Try it">
                  <button type="button" className={styles.btn} onClick={() => tryIt.run()} disabled={tryIt.state === "running"}>
                    {tryIt.preset.label}
                  </button>
                  {tryIt.state === "running" && <p className={`${styles.muted} mt-2 text-[16px]`}>{tryIt.slow ? TRY_COPY.warming : TRY_COPY.running}</p>}
                  {tryIt.error && <p className={`${styles.warn} mt-2 text-[16px]`}>{tryIt.error}</p>}
                  {tryIt.output?.kind === "text" && <pre className="mt-2 whitespace-pre-wrap bg-[#1e1f4e] p-2 text-[15px]">{tryIt.output.text}</pre>}
                  {tryIt.output?.kind === "label" && <p className="mt-2 text-[17px]">{tryIt.output.label} <span className={styles.muted}>{tryIt.output.detail}</span></p>}
                  {tryIt.output?.kind === "image" && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {tryIt.output.urls.map((u, i) => <img key={i} src={u} alt="generated sample" width={56} height={56} style={{ imageRendering: "pixelated" }} />)}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}

          {page === "Pipelines" && (
            <div>
              {card.compositions.length ? (
                <>
                  <p className={`${styles.muted} text-[16px]`}>Pick a pipeline and its boat sails between the lands it joins.</p>
                  <ul className="mt-2 space-y-1">
                    {card.compositions.map((c) => {
                      const on = sailing === c.name;
                      const line = lessonFor(c.name);
                      return (
                        <li key={c.name}>
                          <button type="button" className={`${styles.row} ${on ? styles.rowOn : ""}`} aria-pressed={on}
                            onClick={() => onSail(on ? null : c.name)}>
                            <span className="text-[17px] leading-tight">{displayName(c.name)}</span>
                          </button>
                          <p className={`${styles.muted} pl-1 text-[15px] leading-snug`}>
                            with {c.composes.filter((n) => n !== card.name).map(displayName).join(", ")}
                            {line?.kind === "composition" && on ? `. ${line.line}` : ""}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : <p className="text-[16px]">This model is not part of any pipeline yet.</p>}
            </div>
          )}
        </div>
      </div>
    </PixelWindow>
  );
}
