"use client";

// The lesson card as a JRPG status book, printed on card (the ONE window in
// node view). A spread, in order: portrait (pixel emblem) + name + one plain
// sentence → animated anatomy + the idea → lineage mini-map (the party,
// arrow-key navigable) → proof (gate, real curve, samples, Try it) →
// pipelines (select one = its boat sails). Body 16px, ≤60ch.
import { memo, useEffect, useState } from "react";
import type { CardModel } from "@/components/lab/shared/card-model";
import { displayName, EVIDENCE_COPY } from "@/components/lab/shared/card-model";
import { Anatomy } from "@/components/lab/shared/lesson/anatomy";
import { MechanismDiagram, hasDiagram } from "@/components/lab/shared/anatomy2";
import { Sparkline } from "@/components/lab/shared/lesson/sparkline";
import { TRY_COPY, tryAvailable, useTryIt } from "@/components/lab/shared/lesson/try-it";
import { DOUBLE_DESCENT_EGG } from "@/components/lab/shared/eggs";
import type { LessonData } from "@/hooks/use-lesson";
import { COMPOSITION_LESSONS } from "@/lib/lessons";
import { schematicFor } from "@/lib/schematics";
import type { ModelEvidence } from "@/lib/types";
import { PixelSprite, PixelWindow } from "./chrome.tsx";
import { PixelEmblem } from "./emblem.tsx";
import { CHECK } from "./pixel-art.ts";
import { PixelNum } from "./pixel-num.tsx";
import { chromeSwatch, familyLabel, UI } from "./palette.ts";
import s from "./hybrid.module.css";

export interface PartyMember { name: string; role: "parent" | "child"; family: string; depth: number }

function fmt(v: number): string {
  if (Math.abs(v) >= 100) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(1);
  return v.toFixed(Math.abs(v) < 1 ? 3 : 2).replace(/0+$/, "").replace(/\.$/, "");
}
const words = (m: string) => m.replace(/_/g, " ");

// The bar sits at a fixed 75% of the track; fill = progress TOWARD the bar
// (score/bar, or bar/score for losses): more fill always means closer to passing.
const BAR_AT = 75;

function GateMeter({ card, version }: { card: CardModel; version: string | null }) {
  const e = card.evidence;
  if (!e || e.gate_metric == null || e.threshold_m == null) {
    return <p className={`${s.t16} ${s.dim}`}>No quality gate for this model yet.</p>;
  }
  const thr = e.threshold_m;
  const champ = card.state === "champion";
  const best = e.best_metric != null && !(champ && card.passesBar === false) ? e.best_metric : null;
  const progress = best == null ? null : e.higher_is_better ? best / thr : best > 0 ? thr / best : 4 / 3;
  const pass = progress != null && progress >= 1;
  const fillPct = progress == null ? 0 : Math.min(progress, 4 / 3) * BAR_AT;
  return (
    <div>
      <p className={s.t16}>
        Quality bar: {words(e.gate_metric)} {e.higher_is_better ? "at least" : "at most"}{" "}
        <span className={s.gold}><PixelNum value={fmt(thr)} /></span>
      </p>
      {best != null ? (
        <div className={`${s.meter} mt-2`} role="img" aria-label={`M-tier score ${fmt(best)} against bar ${fmt(thr)}`}>
          {fillPct > 0 && <div className={s.meterFill} style={{ width: `calc(${fillPct}% - 4px)`, background: pass ? UI.good : UI.dim }} />}
          <div className={`${s.meterTick} ${champ ? s.meterTickGold : ""}`} style={{ left: `${BAR_AT}%` }} />
          {champ && <PixelSprite sprite={CHECK} scale={2} className={s.meterCheck} style={{ left: `calc(${BAR_AT}% + 6px)` }} />}
        </div>
      ) : (
        // no M-tier score on this machine: no empty track pretending to be data
        <p className={`${s.t14} mt-2 flex items-center gap-2`}>
          {champ && <PixelSprite sprite={CHECK} scale={2} />}
          <span className={s.dim}>No M-tier score recorded on this machine.</span>
        </p>
      )}
      <p className={`${s.t16} mt-2`}>
        {champ
          ? <span className={s.lime}>Passed the M-tier gate in the cloud sweep ({version ?? "champion"}).</span>
          : best == null
            ? <span className={s.dim}>No M-tier score locally.</span>
            : <>M-tier score <span className={pass ? s.lime : ""}><PixelNum value={fmt(best)} /></span>{pass ? ", clears the bar." : ", short of the bar."}</>}
      </p>
    </div>
  );
}

function TryIt({ name }: { name: string }) {
  const t = useTryIt(name);
  if (!t.preset) return null;
  return (
    <div className="mt-3">
      <button type="button" className={s.btn} onClick={() => t.run()} disabled={t.state === "running"}>
        {t.state === "running" ? "Asking…" : t.preset.label}
      </button>
      {t.state === "running" && <p className={`${s.t16} ${s.dim} mt-2`}>{t.slow ? TRY_COPY.warming : TRY_COPY.running}</p>}
      {t.state === "error" && <p className={`${s.t16} ${s.red} mt-2`}>{t.error}</p>}
      {t.state === "done" && t.output && (
        <div className={`${s.t16} mt-2`}>
          {t.output.kind === "text" && <p className={s.quote}>{t.output.text}</p>}
          {t.output.kind === "label" && <p>{t.output.label}{t.output.detail ? <span className={`${s.dim} block`}>{t.output.detail}</span> : null}</p>}
          {t.output.kind === "image" && (
            <div className="flex flex-wrap gap-1">
              {t.output.urls.slice(0, 8).map((u, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={u} alt="" width={40} height={40} style={{ imageRendering: "pixelated", boxShadow: `0 0 0 2px ${UI.ink}` }} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const LessonCard = memo(function LessonCard({
  card, lesson, evidence, party, partyCursor, onParty, onHover, onClose, still, mobile,
  compositions, sailing, onSail,
}: {
  card: CardModel;
  lesson: LessonData;
  evidence: ModelEvidence[];
  party: PartyMember[];
  partyCursor: number;
  onParty: (name: string) => void;
  onHover: (i: number) => void;
  onClose: () => void;
  still: boolean;
  mobile: boolean;
  compositions: { name: string; composes: string[] }[];
  sailing: string | null;
  onSail: (name: string | null) => void;
}) {
  const version = card.evidence?.champion_version?.match(/v\d+/)?.[0] ?? null;
  const L = lesson.lesson;
  // the anatomy plays its forward pass a few times when the card opens, then
  // rests (zero motion at rest); hovering the plate replays it
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    setPlaying(true);
    const id = setTimeout(() => setPlaying(false), 7000);
    return () => clearTimeout(id);
  }, [card.name]);
  const parents = party.filter((p) => p.role === "parent");
  const children = party.filter((p) => p.role === "child");
  const curve = lesson.curve?.[0] ?? null;
  const member = (p: PartyMember) => {
    const i = party.indexOf(p);
    return (
      <li key={`${p.role}-${p.name}`}>
        <button type="button" className={`${s.row} ${s.rowTight} ${mobile ? s.rowTouch : ""} ${i === partyCursor ? s.rowHot : ""} ${s.t16}`}
          onClick={() => onParty(p.name)} onMouseEnter={() => onHover(i)} onFocus={() => onHover(i)}>
          <PixelEmblem name={p.name} scale={1} color={UI.text} />
          <span className="min-w-0 flex-1 break-words">{displayName(p.name)}</span>
          <span className={s.swatch} style={{ background: chromeSwatch(p.family) }} />
        </button>
      </li>
    );
  };
  return (
    <PixelWindow as="aside" label={`${displayName(card.name)} lesson`} lifted
      ribbon={{ text: <>{familyLabel(card.family)}<span style={{ marginLeft: "auto" }}>LV <PixelNum value={card.depth + 1} /></span></>, color: chromeSwatch(card.family) }}
      className={mobile ? "absolute inset-x-2 bottom-2 z-20 flex max-h-[55%]" : "absolute right-4 top-4 z-20 flex w-[380px] max-h-[calc(100%-32px)]"}
      bodyClassName={`${s.scroll} min-h-0 flex-1`}>
      <div className={`${s.pad} flex flex-col gap-4`}>
        {/* 1 · portrait + name + one plain sentence */}
        <header className="flex items-start gap-3">
          <span className={s.portrait}><PixelEmblem name={card.name} scale={3} color={UI.gold} /></span>
          <div className="min-w-0 flex-1">
            <h2 className={`${s.t30} break-words`}>{displayName(card.name)}</h2>
            <p className={`${s.t14} ${card.state === "champion" ? s.lime : card.state === "provisional" ? s.gold : s.dim}`}>
              {EVIDENCE_COPY[card.state]}
            </p>
          </div>
          <button type="button" className={s.btn} onClick={onClose} aria-label="Close (Esc)">Close</button>
        </header>
        <p className={`${s.t16} ${s.measure}`}>{L?.what ?? card.description}</p>

        {/* 2 · pipelines (above the fold): each is a boat line; select one to sail it */}
        {compositions.length > 0 && (
          <section>
            <h3 className={s.h3}>Pipelines it sails in</h3>
            <ul className="mt-1">
              {compositions.map((c) => (
                <li key={c.name}>
                  <button type="button" aria-pressed={sailing === c.name}
                    className={`${s.row} ${s.rowTight} ${mobile ? s.rowTouch : ""} ${sailing === c.name ? s.rowSel : ""} ${s.t16}`}
                    onClick={() => onSail(sailing === c.name ? null : c.name)}>
                    <PixelEmblem name={c.name} scale={1} color={UI.cyan} />
                    <span className="min-w-0 flex-1 break-words">{words(c.name)}</span>
                  </button>
                  {sailing === c.name && (
                    <p className={`${s.t14} ${s.measure} px-2 pb-1`}>
                      {COMPOSITION_LESSONS[c.name] ?? `Joins ${c.composes.map(words).join(", ")}.`}
                      {c.name === DOUBLE_DESCENT_EGG.composition && <span className={`${s.gold} block mt-1`}>{DOUBLE_DESCENT_EGG.caption} Watch the boat dip twice.</span>}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        {/* 2 · anatomy + the one idea it adds */}
        <section>
          <h3 className={s.h3}>How it thinks</h3>
          <div className={s.plate} style={{ fontFamily: "var(--font-hybrid-round), system-ui" }} onPointerEnter={() => setPlaying(true)} onPointerLeave={() => setPlaying(false)}>
            {hasDiagram(card.name) ? (
              <MechanismDiagram name={card.name} theme="pixel" variant="card" still={still} width={mobile ? 320 : 324} />
            ) : (
              <Anatomy stages={schematicFor(card.name)} animate={!still && playing} size={mobile ? 320 : 324} labelPx={14}
                palette={{ node: UI.text, edge: UI.dim, active: UI.gold, text: UI.text, accent: UI.cyan, fill: UI.panel }}
                title={`${displayName(card.name)} — one forward pass`} />
            )}
          </div>
          {L?.idea && <p className={`${s.t16} ${s.measure} mt-2`}><span className={s.gold}>The idea:</span> {L.idea}</p>}
        </section>

        {/* 3 · lineage mini-map: parents → model → children (the party) */}
        <section aria-label="Lineage">
          <h3 className={s.h3}>Family line</h3>
          <div className={s.lineage}>
            <div>
              <p className={`${s.t14} ${s.dim}`}>Builds on</p>
              {parents.length ? <ul>{parents.map(member)}</ul> : <p className={`${s.t14} ${s.dim}`}>nothing, it is an atom</p>}
            </div>
            <div className={s.lineageSelf} aria-hidden>
              <span className={s.arrow}>›</span>
              <PixelEmblem name={card.name} scale={2} color={UI.gold} />
              <span className={s.arrow}>›</span>
            </div>
            <div>
              <p className={`${s.t14} ${s.dim}`}>Leads to</p>
              {children.length ? <ul>{children.map(member)}</ul> : <p className={`${s.t14} ${s.dim}`}>no models yet</p>}
            </div>
          </div>
          {!mobile && <p className={`${s.t14} ${s.dim} mt-1`}>Arrow keys pick, Enter travels, Esc closes.</p>}
        </section>

        {/* 4 · proof */}
        <section>
          <h3 className={s.h3}>Does it work?</h3>
          <GateMeter card={card} version={version} />
          {curve && curve.points.length > 1 && (
            <div className={`${s.plate} mt-3`}>
              <Sparkline points={curve.points} label={words(curve.key)} width={mobile ? 300 : 316} height={64} fontPx={13}
                palette={{ line: UI.gold, axis: UI.panelHi, text: UI.dim, dot: UI.gold }} />
              {lesson.curveRun && <p className={`${s.t14} ${s.dim}`}>real run {lesson.curveRun.id}</p>}
            </div>
          )}
          {lesson.samples.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {lesson.samples.slice(0, 4).map((u) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={u} src={u} alt="sample output" width={80} height={80} style={{ imageRendering: "pixelated", boxShadow: `0 0 0 2px ${UI.ink}` }} />
              ))}
            </div>
          )}
          {tryAvailable(card.name, evidence) && <TryIt name={card.name} />}
        </section>

      </div>
    </PixelWindow>
  );
});
