"use client";

// The docked drawer for the selected model (desktop: a full-height panel right of
// the sheet; phone: a bottom sheet ≤ 55% tall). Top to bottom: creature + name +
// one plain sentence → one forward pass → family line (parents ↓ me ↓ children) →
// proof it works (bar, real curve, samples, Try it) → the pipelines it plays in
// (each one can be shown on the sheet).
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { COMPOSITION_LESSONS } from "@/lib/lessons";
import { schematicFor } from "@/lib/schematics";
import type { ModelEvidence } from "@/lib/types";
import type { LessonData } from "@/hooks/use-lesson";
import { displayName, EVIDENCE_COPY, type CardModel } from "@/components/lab/shared/card-model";
import { Anatomy } from "@/components/lab/shared/lesson/anatomy";
import { MechanismDiagram, hasDiagram } from "@/components/lab/shared/anatomy2";
import { Sparkline } from "@/components/lab/shared/lesson/sparkline";
import { TRY_COPY, tryAvailable, useTryIt } from "@/components/lab/shared/lesson/try-it";
import { Critter, EvidenceMark } from "./critter";
import { COLOR, fam, MOTION, SHADOW, SPACE, STROKE } from "./tokens";
import s from "./flow.module.css";

const words = (k: string) => k.replace(/_/g, " ");
/** The shared evidence copy in this sheet's voice: a colon, never a spaced em dash. */
const evidenceLine = (st: CardModel["state"]) => EVIDENCE_COPY[st].replace(" — ", ": ");

function fmt(n: number) {
  return Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(Math.abs(n) < 1 ? 3 : 2).replace(/0+$/, "").replace(/\.$/, "");
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 border-t pt-3" style={{ borderColor: COLOR.rule }}>
      <h3 className={`${s.tBody} font-extrabold`}>{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Chip({ name, family, address, me, onPick }: { name: string; family: string; address?: string; me?: boolean; onPick: (n: string) => void }) {
  return (
    <button type="button" onClick={() => !me && onPick(name)} aria-current={me || undefined}
      className={`${s.btn} inline-flex items-center gap-1.5 ${s.rUi} border py-0.5 pl-1 pr-2.5 ${s.tProse} font-bold leading-6`}
      style={{ borderColor: me ? COLOR.accent : COLOR.ink, borderWidth: me ? STROKE.boxPipeline : STROKE.box, background: COLOR.card, color: COLOR.ink }}>
      <span className={`${s.rChip} px-1 ${s.tLabel} font-extrabold tabular-nums leading-5`} style={{ background: fam(family).strip }}>{address}</span>
      {displayName(name)}
    </button>
  );
}

const Down = () => (
  <svg viewBox="0 0 20 22" className="mx-auto my-1 h-5 w-5" aria-hidden>
    <path d="M10 2 V15" fill="none" stroke={COLOR.ink} strokeWidth={STROKE.edge} strokeLinecap="round" />
    <path d="M10 20 L6 13 H14 Z" fill={COLOR.ink} />
  </svg>
);

function Evidence({ c }: { c: CardModel }) {
  const e = c.evidence;
  if (!e || !e.gate_metric || e.threshold_m == null) return <p className={`${s.tBody}`}>No quality bar is set for it yet.</p>;
  const dir = e.higher_is_better ? "at least" : "at most";
  const version = e.champion_version?.match(/v\d+/)?.[0];
  const best = e.best_metric;
  const hi = Math.max(e.threshold_m, best ?? 0) * (e.higher_is_better ? 1.25 : 1.6) || 1;
  return (
    <div className={`space-y-1.5 ${s.tBody} leading-relaxed`}>
      <p>Its bar: <b>{words(e.gate_metric)} {dir} {fmt(e.threshold_m)}</b>{e.provisional && <>, a provisional bar still being calibrated</>}.</p>
      {c.state === "champion" && <p>Champion checkpoint {version ?? ""} cleared it in the cloud gate.</p>}
      <p>
        {best != null
          ? <>Best local run: <b>{fmt(best)}</b>, {c.passesBar ? "meets the bar" : "short of the bar"}.</>
          : <>No local score yet{e.run_count > 0 ? ` (${e.run_count} local run${e.run_count === 1 ? "" : "s"} logged)` : ""}.</>}
      </p>
      <svg viewBox="0 0 200 18" className="h-[18px] w-full max-w-[280px]" role="img"
        aria-label={best != null ? `best ${fmt(best)} against a bar of ${fmt(e.threshold_m)}` : `bar at ${fmt(e.threshold_m)}, no local score yet`}>
        <rect x={1} y={5} width={198} height={8} rx={4} fill={COLOR.meterTrack} stroke={COLOR.ink} strokeWidth={1} strokeDasharray={best == null ? "3 3" : undefined} />
        {best != null && <rect x={1} y={5} width={Math.max(8, Math.min(1, best / hi) * 198)} height={8} rx={4} fill={c.passesBar ? COLOR.meterPass : COLOR.meterShort} stroke={COLOR.ink} strokeWidth={1} />}
        <path d={`M${1 + (e.threshold_m / hi) * 198} 1 V17`} stroke={COLOR.ink} strokeWidth={2} strokeLinecap="round" />
      </svg>
    </div>
  );
}

function TryIt({ name, evidence }: { name: string; evidence: ModelEvidence[] }) {
  const t = useTryIt(tryAvailable(name, evidence) ? name : null);
  if (!t.preset) return null;
  const o = t.output;
  return (
    <div className={`mt-3 ${s.rUi} border p-3`} style={{ borderColor: COLOR.ink }}>
      <button type="button" onClick={t.run} disabled={t.state === "running"}
        className={`${s.btn} ${s.rUi} px-3 py-1 ${s.tProse} font-bold`} style={{ background: COLOR.accent, color: COLOR.onAccent }}>
        {t.preset.label}
      </button>
      {t.state === "running" && <p className={`mt-2 ${s.tProse}`}>{t.slow ? TRY_COPY.warming : TRY_COPY.running}</p>}
      {t.state === "error" && <p className={`mt-2 ${s.tProse}`}>{t.error}</p>}
      {o?.kind === "text" && <p className={`mt-2 whitespace-pre-wrap ${s.tProse} leading-snug`}>{o.text}</p>}
      {o?.kind === "label" && <p className={`mt-2 ${s.tBody}`}>It says <b>{o.label}</b>{o.detail ? ` (${o.detail})` : ""}.</p>}
      {o?.kind === "image" && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {o.urls.slice(0, 8).map((u, i) => <img key={i} src={u} alt="generated sample" className="h-12 w-12 rounded border" style={{ imageRendering: "pixelated", borderColor: COLOR.ink }} />)}
        </div>
      )}
      {o?.kind === "json" && <pre className={`mt-2 max-h-32 overflow-auto ${s.tSmall}`}>{JSON.stringify(o.json).slice(0, 400)}</pre>}
      {o?.note && <p className={`mt-1 ${s.tUi}`} style={{ color: COLOR.inkSoft }}>{o.note}</p>}
    </div>
  );
}

export function FlowDrawer({ c, address, lesson, mobile, still, evidence, familyOf, addressOf, onPick, onClose, onShowPipeline, pipeline }: {
  c: CardModel; address: string; lesson: LessonData; mobile: boolean; still: boolean; evidence: ModelEvidence[];
  familyOf: (n: string) => string; addressOf: (n: string) => string; onPick: (n: string) => void; onClose: () => void;
  onShowPipeline: (composition: string) => void; pipeline: string | null;
}) {
  const f = fam(c.family);
  const l = lesson.lesson;
  const curve = lesson.curve?.[0];
  const kids = c.children.slice(0, 12);
  // header first; the heavy body (anatomy, curve, try-it) mounts on the next idle frame
  const [fullFor, setFullFor] = useState<string | null>(null);
  const full = still || fullFor === c.name;
  useEffect(() => {
    if (still) return;
    const name = c.name;
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setFullFor(name), { timeout: 400 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(() => setFullFor(name), 60);
    return () => clearTimeout(t);
  }, [c.name, still]);
  const diagramW = mobile ? 330 : SPACE.drawerW - 48;
  return (
    <motion.aside
      key={c.name}
      initial={still ? false : mobile ? { y: 32, opacity: 0 } : { x: 28, opacity: 0 }}
      animate={{ x: 0, y: 0, opacity: 1 }}
      transition={{ duration: MOTION.drawer / 1000, ease: MOTION.ease }}
      data-drawer
      className={`absolute z-30 overflow-y-auto ${mobile ? `inset-x-0 bottom-0 ${s.rSheetTop} border-t px-4 pb-6 pt-3` : "bottom-0 right-0 top-0 border-l px-6 pb-8 pt-5"}`}
      style={{ borderColor: COLOR.ink, background: COLOR.card, width: mobile ? undefined : SPACE.drawerW, maxHeight: mobile ? SPACE.sheetMaxH : undefined, boxShadow: mobile ? SHADOW.sheet : SHADOW.drawer }}
      aria-label={`${displayName(c.name)} details`}
    >
      {mobile && <div className="mx-auto mb-2 h-1 w-10 rounded-full" style={{ background: COLOR.rule }} aria-hidden />}
      <div className="flex items-start gap-3">
        <svg viewBox="0 0 24 24" className="h-14 w-14 shrink-0" aria-hidden><Critter family={c.family} state={c.state} /></svg>
        <div className="min-w-0 flex-1">
          <p className={`flex items-center gap-2 ${s.tUi} font-bold`} style={{ color: COLOR.inkSoft }}>
            <span className={`${s.rChip} px-1.5 ${s.tSmall} font-extrabold tabular-nums leading-5`} style={{ background: f.strip, color: COLOR.ink }}>{address}</span>
            {f.label}, {c.atom ? "an atom (it starts a lineage)" : `generation ${c.depth}`}
          </p>
          <h2 className={`mt-0.5 break-words ${s.tTitle} font-extrabold leading-tight`}>{displayName(c.name)}</h2>
        </div>
        <button type="button" onClick={onClose} className={`${s.btn} ${s.rUi} border px-2.5 py-1 ${s.tUi} font-bold`} style={{ borderColor: COLOR.ink }}>
          Close
        </button>
      </div>

      <p className={`mt-3 max-w-[60ch] ${s.tLede} font-medium leading-snug`}>{l?.what ?? `${c.description}.`}</p>
      {l && (
        <p className={`mt-2 max-w-[60ch] ${s.tBody} leading-relaxed`}>
          <b>The idea: </b>{l.idea}
          {l.analogy && <span className="mt-1 block" style={{ color: COLOR.inkSoft }}>Picture it: {l.analogy}</span>}
        </p>
      )}
      <p className={`mt-2 flex items-center gap-2 ${s.tProse} font-bold`}>
        <svg viewBox="-6 -6 12 12" className="h-3.5 w-3.5 shrink-0" aria-hidden><EvidenceMark state={c.state} /></svg>
        {evidenceLine(c.state)}
      </p>

      {full && (<>
        <Section title="One forward pass">
          {hasDiagram(c.name) ? (
            <MechanismDiagram name={c.name} theme="paper" variant="card" still={still} width={diagramW} />
          ) : (
            <Anatomy stages={schematicFor(c.name)} animate={!still} size={diagramW} labelPx={13}
              palette={{ node: COLOR.ink, edge: COLOR.inkSoft, active: COLOR.accent, text: COLOR.ink, accent: f.deep, fill: COLOR.card }}
              title={`${displayName(c.name)}, one forward pass`} />
          )}
          {c.introduces.map((m) => (
            <p key={m.key} className={`mt-1 ${s.tProse} leading-snug`}><b>Adds {words(m.key)}</b>: {m.description}</p>
          ))}
        </Section>

        <Section title="Family line">
          <div className="text-center">
            {c.parents.length ? (
              <div className="flex flex-wrap justify-center gap-1.5">
                {c.parents.map((p) => <Chip key={p} name={p} family={familyOf(p)} address={addressOf(p)} onPick={onPick} />)}
              </div>
            ) : <p className={`${s.tProse}`}>It starts a lineage: nothing comes before it.</p>}
            <Down />
            <Chip name={c.name} family={c.family} address={address} me onPick={onPick} />
            {kids.length > 0 && <Down />}
            {kids.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5">
                {kids.map((p) => <Chip key={p} name={p} family={familyOf(p)} address={addressOf(p)} onPick={onPick} />)}
                {c.children.length > kids.length && <span className={`self-center ${s.tUi} font-bold`}>and {c.children.length - kids.length} more</span>}
              </div>
            )}
            {kids.length === 0 && <p className={`mt-2 ${s.tProse}`}>Nothing builds on it yet.</p>}
          </div>
        </Section>

        <Section title="Proof it works">
          <Evidence c={c} />
          {curve && curve.points.length > 1 && (
            <div className="mt-2">
              <Sparkline points={curve.points} label={words(curve.key)} width={mobile ? 300 : SPACE.drawerW - 60} height={64} fontPx={13}
                palette={{ line: COLOR.ink, axis: COLOR.axis, text: COLOR.ink, fill: COLOR.accentWash, dot: COLOR.accent }}
                title={`${words(curve.key)} over training`} />
              {lesson.curveRun && <p className={`${s.tSmall}`} style={{ color: COLOR.inkSoft }}>from run {lesson.curveRun.id}</p>}
            </div>
          )}
          {lesson.samples.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {lesson.samples.slice(0, 4).map((u) => <img key={u} src={u} alt="sample from a run" className="h-16 w-16 rounded border object-cover" style={{ borderColor: COLOR.ink }} />)}
            </div>
          )}
          <TryIt name={c.name} evidence={evidence} />
        </Section>

        {c.compositions.length > 0 && (
          <Section title="Pipelines it plays in">
            <ul className="space-y-2">
              {c.compositions.map((k) => {
                const on = pipeline === k.name;
                return (
                  <li key={k.name} className="flex items-start gap-2">
                    <button type="button" onClick={() => onShowPipeline(k.name)} aria-pressed={on}
                      className={`${s.btn} mt-0.5 shrink-0 ${s.rUi} border px-2 py-0.5 ${s.tUi} font-bold`}
                      style={{ borderColor: on ? COLOR.accent : COLOR.ink, background: on ? COLOR.accent : COLOR.card, color: on ? COLOR.onAccent : COLOR.ink }}>
                      {on ? "Shown" : "Show"}
                    </button>
                    <p className={`${s.tProse} leading-snug`}><b>{displayName(k.name)}</b>: {COMPOSITION_LESSONS[k.name] ?? k.description}</p>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}
      </>)}
    </motion.aside>
  );
}
