"use client";

// The speech bubble a focused creature "says" — a designed spread, top to
// bottom: emblem + name + one plain sentence → the idea → one forward pass
// (animated anatomy) → family line (parents ↓ me ↓ children) → proof it
// works (quality bar, real curve, samples, Try it) → pipelines it plays in
// (each one sails its ferry across the board).
import { motion } from "motion/react";
import { COMPOSITION_LESSONS } from "@/lib/lessons";
import { iconFor } from "@/lib/icons";
import { schematicFor } from "@/lib/schematics";
import type { ModelEvidence } from "@/lib/types";
import type { LessonData } from "@/hooks/use-lesson";
import { displayName, EVIDENCE_COPY, type CardModel } from "@/components/lab/shared/card-model";
import { Anatomy } from "@/components/lab/shared/lesson/anatomy";
import { Sparkline } from "@/components/lab/shared/lesson/sparkline";
import { TRY_COPY, tryAvailable, useTryIt } from "@/components/lab/shared/lesson/try-it";
import { ACCENT, fam, INK, INK_SOFT } from "./palette";
import { Creature, EvidenceGlyph } from "./creature";
import s from "./flow.module.css";

const words = (k: string) => k.replace(/_/g, " ");

function fmt(n: number) {
  return Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(Math.abs(n) < 1 ? 3 : 2).replace(/0+$/, "").replace(/\.$/, "");
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 border-t-2 border-dashed pt-3" style={{ borderColor: "#DCD3F5" }}>
      <h3 className={`${s.display} text-[15px]`}>{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Chip({ name, family, state, onPick }: { name: string; family: string; state?: "me"; onPick: (n: string) => void }) {
  const Icon = iconFor(name);
  const me = state === "me";
  return (
    <button type="button" onClick={() => !me && onPick(name)} aria-current={me || undefined}
      className={`${s.chip} inline-flex items-center gap-1.5 rounded-full border-2 py-0.5 pl-1 pr-3 text-[15px] font-bold leading-6`}
      style={{ borderColor: INK, background: me ? INK : fam(family).fill, color: me ? "#fff" : INK }}>
      <span className="grid h-6 w-6 place-items-center rounded-full bg-white" style={{ border: `1.5px solid ${INK}` }}>
        {Icon && <Icon size={14} strokeWidth={2.4} color={INK} />}
      </span>
      {displayName(name)}
    </button>
  );
}

const Down = () => (
  <svg viewBox="0 0 20 22" className="mx-auto my-1 h-5 w-5" aria-hidden>
    <path d="M10 2 V17 M4 12 L10 18 L16 12" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Evidence({ c }: { c: CardModel }) {
  const e = c.evidence;
  if (!e || !e.gate_metric || e.threshold_m == null) {
    return <p className="text-[16px]">No quality bar is set for it yet.</p>;
  }
  const dir = e.higher_is_better ? "at least" : "at most";
  const version = e.champion_version?.match(/v\d+/)?.[0];
  const best = e.best_metric;
  const hi = Math.max(e.threshold_m, best ?? 0) * (e.higher_is_better ? 1.25 : 1.6) || 1;
  return (
    <div className="space-y-1.5 text-[16px] leading-relaxed">
      <p>
        Its bar: <b>{words(e.gate_metric)} {dir} {fmt(e.threshold_m)}</b>
        {e.provisional && <> — a provisional bar, still being calibrated</>}.
      </p>
      {c.state === "champion" && <p>Champion checkpoint {version ?? ""} cleared it in the cloud gate.</p>}
      <p>
        {best != null
          ? <>Best local run: <b>{fmt(best)}</b>, {c.passesBar ? "meets the bar" : "short of the bar"}.</>
          : <>No local score yet{e.run_count > 0 ? ` (${e.run_count} local run${e.run_count === 1 ? "" : "s"} logged)` : ""}.</>}
      </p>
      <svg viewBox="0 0 200 22" className="h-[22px] w-full max-w-[280px]" role="img"
        aria-label={best != null ? `best ${fmt(best)} against a bar of ${fmt(e.threshold_m)}` : `bar at ${fmt(e.threshold_m)}, no local score yet`}>
        <rect x={1} y={6} width={198} height={10} rx={5} fill="#EDE8FF" stroke={INK} strokeWidth={1.5} strokeDasharray={best == null ? "4 3" : undefined} />
        {best != null && (
          <rect x={1} y={6} width={Math.max(10, Math.min(1, best / hi) * 198)} height={10} rx={5} fill={c.passesBar ? "#8FE3C0" : "#FFB38A"} stroke={INK} strokeWidth={1.5} />
        )}
        <path d={`M${1 + (e.threshold_m / hi) * 198} 1 V21`} stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
      </svg>
    </div>
  );
}

function TryIt({ name, evidence }: { name: string; evidence: ModelEvidence[] }) {
  const t = useTryIt(tryAvailable(name, evidence) ? name : null);
  if (!t.preset) return null;
  const o = t.output;
  return (
    <div className="mt-3 rounded-2xl border-2 p-3" style={{ borderColor: INK, background: "#FBFAFF" }}>
      <button type="button" onClick={t.run} disabled={t.state === "running"}
        className={`${s.btn} rounded-full border-2 px-3 py-1 text-[15px] font-bold`} style={{ borderColor: INK, background: ACCENT, color: "#fff" }}>
        {t.preset.label}
      </button>
      {t.state === "running" && <p className="mt-2 text-[15px]">{t.slow ? TRY_COPY.warming : TRY_COPY.running}</p>}
      {t.state === "error" && <p className="mt-2 text-[15px]">{t.error}</p>}
      {o?.kind === "text" && <p className="mt-2 whitespace-pre-wrap font-mono text-[14px] leading-snug">{o.text}</p>}
      {o?.kind === "label" && <p className="mt-2 text-[16px]">It says <b>{o.label}</b>{o.detail ? ` (${o.detail})` : ""}.</p>}
      {o?.kind === "image" && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {o.urls.slice(0, 8).map((u, i) => <img key={i} src={u} alt="generated sample" className="h-12 w-12 rounded-md border" style={{ imageRendering: "pixelated", borderColor: INK }} />)}
        </div>
      )}
      {o?.kind === "json" && <pre className="mt-2 max-h-32 overflow-auto text-[13px]">{JSON.stringify(o.json).slice(0, 400)}</pre>}
      {o?.note && <p className="mt-1 text-[14px]" style={{ color: INK_SOFT }}>{o.note}</p>}
    </div>
  );
}

export function FlowCard({ c, lesson, mobile, still, evidence, familyOf, onPick, onClose, onSail, sailing }: {
  c: CardModel; lesson: LessonData; mobile: boolean; still: boolean; evidence: ModelEvidence[];
  familyOf: (n: string) => string; onPick: (n: string) => void; onClose: () => void;
  onSail: (composition: string) => void; sailing: string | null;
}) {
  const f = fam(c.family);
  const Icon = iconFor(c.name);
  const l = lesson.lesson;
  const initial = still ? false : mobile ? { y: 40, opacity: 0 } : { x: 24, opacity: 0 };
  const curve = lesson.curve?.[0];
  const kids = c.children.slice(0, 10);
  return (
    <motion.aside
      key={c.name}
      initial={initial}
      animate={{ x: 0, y: 0, opacity: 1 }}
      transition={{ duration: 0.28, ease: [0.3, 0.7, 0.4, 1] }}
      className={`${s.card} absolute z-20 overflow-y-auto rounded-[28px] border-[2.5px] bg-white text-[#3B2E5A] ${
        mobile ? "inset-x-2 bottom-2 max-h-[46%] px-4 pb-5 pt-4" : "right-4 top-[80px] max-h-[calc(100%-96px)] w-[440px] px-6 pb-6 pt-5"
      }`}
      style={{ borderColor: INK, boxShadow: `0 6px 0 ${INK}` }}
      aria-label={`${displayName(c.name)} details`}
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <svg viewBox="-30 -36 60 62" className="h-16 w-16" aria-hidden>
            <Creature family={c.family} atom={c.atom} state={c.state} emblem={Icon} />
          </svg>
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <h2 className={`${s.display} break-words text-[26px] leading-tight`}>{displayName(c.name)}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-bold">
            <span className="rounded-full border-2 px-2 leading-5" style={{ background: f.fill, borderColor: INK }}>{f.label}</span>
            <span className="whitespace-nowrap">{c.atom ? "an atom, root of a lineage" : `generation ${c.depth}`}</span>
          </p>
        </div>
        <button type="button" onClick={onClose} className={`${s.btn} rounded-full border-2 px-3 py-1 text-[14px] font-bold`} style={{ borderColor: INK }}>
          Close
        </button>
      </div>

      <p className="mt-4 max-w-[60ch] text-[18px] font-bold leading-snug">{l?.what ?? `${c.description}.`}</p>
      {l && (
        <p className="mt-2 max-w-[60ch] text-[16px] leading-relaxed">
          <span className={s.display}>The idea: </span>{l.idea}
          {l.analogy && <span className="mt-1 block" style={{ color: INK_SOFT }}>Picture it: {l.analogy}</span>}
        </p>
      )}
      <p className="mt-2 flex items-center gap-2 text-[15px] font-bold">
        <svg viewBox="-8 -8 16 16" className="h-4 w-4 shrink-0" aria-hidden><EvidenceGlyph state={c.state} /></svg>
        {EVIDENCE_COPY[c.state]}
      </p>

      <Section title="One forward pass">
        <Anatomy stages={schematicFor(c.name)} animate={!still} size={mobile ? 330 : 380} labelPx={13}
          palette={{ node: INK, edge: "#5E4F80", active: ACCENT, text: INK, accent: f.deep, fill: "#fff" }}
          title={`${displayName(c.name)} — one forward pass`} />
        {c.introduces.map((m) => (
          <p key={m.key} className="mt-1 text-[15px] leading-snug"><b>Adds {words(m.key)}</b>: {m.description}</p>
        ))}
      </Section>

      <Section title="Family line">
        <div className="text-center">
          {c.parents.length ? (
            <div className="flex flex-wrap justify-center gap-1.5">
              {c.parents.map((p) => <Chip key={p} name={p} family={familyOf(p)} onPick={onPick} />)}
            </div>
          ) : (
            <p className="text-[15px]">It starts a lineage: nothing comes before it.</p>
          )}
          <Down />
          <Chip name={c.name} family={c.family} state="me" onPick={onPick} />
          {kids.length > 0 && <Down />}
          {kids.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {kids.map((p) => <Chip key={p} name={p} family={familyOf(p)} onPick={onPick} />)}
              {c.children.length > kids.length && <span className="self-center text-[14px] font-bold">and {c.children.length - kids.length} more</span>}
            </div>
          )}
          {kids.length === 0 && <p className="mt-2 text-[15px]">Nothing builds on it yet.</p>}
        </div>
      </Section>

      <Section title="Proof it works">
        <Evidence c={c} />
        {curve && curve.points.length > 1 && (
          <div className="mt-2">
            <Sparkline points={curve.points} label={words(curve.key)} width={mobile ? 300 : 360} height={64} fontPx={13}
              palette={{ line: INK, axis: "#C9BFE8", text: INK, fill: "rgba(198,178,255,0.35)", dot: ACCENT }}
              title={`${words(curve.key)} over training`} />
            {lesson.curveRun && <p className="text-[13px]" style={{ color: INK_SOFT }}>from run {lesson.curveRun.id}</p>}
          </div>
        )}
        {lesson.samples.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {lesson.samples.slice(0, 4).map((u) => <img key={u} src={u} alt="sample from a run" className="h-16 w-16 rounded-lg border-2 object-cover" style={{ borderColor: INK }} />)}
          </div>
        )}
        <TryIt name={c.name} evidence={evidence} />
      </Section>

      {c.compositions.length > 0 && (
        <Section title="Plays a part in">
          <ul className="space-y-2">
            {c.compositions.map((k) => {
              const on = sailing === k.name;
              return (
                <li key={k.name} className="flex items-start gap-2">
                  <button type="button" onClick={() => onSail(k.name)} aria-pressed={on}
                    className={`${s.btn} mt-0.5 shrink-0 rounded-full border-2 px-2.5 py-0.5 text-[14px] font-bold`}
                    style={{ borderColor: INK, background: on ? INK : "#fff", color: on ? "#fff" : INK }}>
                    {on ? "Sailing" : "Sail"}
                  </button>
                  <p className="text-[15px] leading-snug"><b>{displayName(k.name)}</b>: {COMPOSITION_LESSONS[k.name] ?? k.description}</p>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </motion.aside>
  );
}
