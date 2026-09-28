"use client";

// The speech-bubble card a focused creature "says". Same facts as every skin
// (cardModel): plain description, lineage chips, mechanism, evidence line
// (metric vs bar) and the compositions it plays in.
import { motion } from "motion/react";
import { displayName, EVIDENCE_COPY, type CardModel } from "@/components/lab/shared/card-model";
import { fam, INK } from "./palette";
import { Creature } from "./creature";
import s from "./flow.module.css";

const words = (k: string) => k.replace(/_/g, " ");

function fmt(n: number) {
  return Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(Math.abs(n) < 1 ? 3 : 2).replace(/0+$/, "").replace(/\.$/, "");
}

function Chip({ name, family, onPick }: { name: string; family: string; onPick: (n: string) => void }) {
  return (
    <button type="button" onClick={() => onPick(name)}
      className={`${s.chip} rounded-full border-2 px-2.5 py-0.5 text-[14px] font-bold leading-6`}
      style={{ borderColor: INK, background: fam(family).fill }}>
      {displayName(name)}
    </button>
  );
}

function Evidence({ c }: { c: CardModel }) {
  const e = c.evidence;
  if (!e || !e.gate_metric || e.threshold_m == null) {
    return <p className="text-[15px]">{EVIDENCE_COPY[c.state]}. No quality bar is set for it yet.</p>;
  }
  const dir = e.higher_is_better ? "at least" : "at most";
  const version = e.champion_version?.match(/v\d+/)?.[0];
  const best = e.best_metric;
  const hi = Math.max(e.threshold_m, best ?? 0) * (e.higher_is_better ? 1.25 : 1.6) || 1;
  return (
    <div className="space-y-1.5 text-[15px] leading-snug">
      <p>
        Quality bar: <b>{words(e.gate_metric)} {dir} {fmt(e.threshold_m)}</b>
        {e.provisional && <span> (provisional — this bar is new)</span>}
      </p>
      {c.state === "champion" && (
        <p>Champion checkpoint {version ?? ""} cleared the bar in the cloud gate.</p>
      )}
      {best != null ? (
        <>
          <p>
            Best local run: <b>{fmt(best)}</b>, {c.passesBar ? "meets the bar" : "short of the bar"}
            {" "}({e.run_count} run{e.run_count === 1 ? "" : "s"})
          </p>
          <svg viewBox="0 0 200 22" className="h-[22px] w-full max-w-[260px]" aria-hidden>
            <rect x={1} y={6} width={198} height={10} rx={5} fill="#EDE8FF" stroke={INK} strokeWidth={1.5} />
            <rect x={1} y={6} width={Math.max(10, (best / hi) * 198)} height={10} rx={5} fill={c.passesBar ? "#8FE3C0" : "#FFB38A"} stroke={INK} strokeWidth={1.5} />
            <path d={`M${1 + (e.threshold_m / hi) * 198} 1 V21`} stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
          </svg>
        </>
      ) : (
        <p className="text-[#5E4F80]">
          {e.run_count > 0 ? `${e.run_count} local run${e.run_count === 1 ? "" : "s"}, none scored against the bar yet.` : "No local runs yet."}
        </p>
      )}
    </div>
  );
}

export function FlowCard({ c, mobile, still, runs, phase, familyOf, onPick, onClose }: {
  c: CardModel; mobile: boolean; still: boolean; runs: number; phase: number; familyOf: (n: string) => string;
  onPick: (n: string) => void; onClose: () => void;
}) {
  const f = fam(c.family);
  const initial = still ? false : mobile ? { y: 40, opacity: 0 } : { x: 24, opacity: 0 };
  return (
    <motion.aside
      key={c.name}
      initial={initial}
      animate={{ x: 0, y: 0, opacity: 1 }}
      transition={{ duration: 0.28, ease: [0.3, 0.7, 0.4, 1] }}
      className={`${s.card} absolute z-20 overflow-y-auto rounded-[26px] border-[2.5px] bg-white text-[#3B2E5A] ${
        mobile ? "inset-x-2 bottom-2 max-h-[46%] p-4" : "right-4 top-[76px] max-h-[calc(100%-92px)] w-[400px] p-5"
      }`}
      style={{ borderColor: INK, boxShadow: `0 6px 0 ${INK}` }}
      aria-label={`${displayName(c.name)} details`}
    >
      <div className="flex items-start gap-3">
        <svg viewBox="-30 -32 60 58" className="h-14 w-14 shrink-0" aria-hidden>
          <Creature family={c.family} atom={c.atom} depth={c.depth} children={c.children.length} state={c.state} runs={runs} phase={phase} still />
        </svg>
        <div className="min-w-0 flex-1 pt-1">
          <h2 className={`${s.display} break-words text-[24px] leading-tight`}>{displayName(c.name)}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-bold">
            <span className="rounded-full border-2 px-2 leading-5" style={{ background: f.fill, borderColor: INK }}>{f.label}</span>
            <span className="whitespace-nowrap">{c.atom ? "an atom, root of a lineage" : `generation ${c.depth}`}</span>
          </p>
        </div>
        <button type="button" onClick={onClose} className={`${s.btn} rounded-full border-2 px-3 py-1 text-[14px] font-bold`} style={{ borderColor: INK }}>
          Close
        </button>
      </div>

      <p className="mt-3 text-[16px] font-bold leading-snug">{EVIDENCE_COPY[c.state]}</p>
      <p className="mt-2 text-[16px] leading-relaxed">{c.description}.</p>
      {c.note && <p className="mt-1 text-[14px] leading-snug text-[#5E4F80]">{c.note}</p>}

      <section className="mt-4">
        <h3 className="text-[14px] font-extrabold">Lineage</h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[14px]">
          {c.parents.length ? (
            <>
              <span>Builds on</span>
              {c.parents.map((p) => <Chip key={p} name={p} family={familyOf(p)} onPick={onPick} />)}
            </>
          ) : (
            <span>Builds on nothing: it starts a lineage.</span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[14px]">
          {c.children.length ? (
            <>
              <span>Leads to</span>
              {c.children.map((p) => <Chip key={p} name={p} family={familyOf(p)} onPick={onPick} />)}
            </>
          ) : (
            <span>Nothing builds on it yet.</span>
          )}
        </div>
      </section>

      {c.introduces.length > 0 && (
        <section className="mt-4">
          <h3 className="text-[14px] font-extrabold">Introduces</h3>
          {c.introduces.map((m) => (
            <p key={m.key} className="mt-1 text-[15px] leading-snug"><b>{words(m.key)}</b>: {m.description}</p>
          ))}
        </section>
      )}

      <section className="mt-4">
        <h3 className="text-[14px] font-extrabold">Proof it works</h3>
        <div className="mt-1"><Evidence c={c} /></div>
        {c.sampleImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.sampleImage} alt={`Latest sample from ${displayName(c.name)}`} className="mt-2 max-h-40 rounded-xl border-2" style={{ borderColor: INK }} />
        )}
      </section>

      {c.compositions.length > 0 && (
        <section className="mt-4">
          <h3 className="text-[14px] font-extrabold">Plays a part in</h3>
          <ul className="mt-1 space-y-1">
            {c.compositions.map((k) => (
              <li key={k.name} className="text-[15px] leading-snug"><b>{displayName(k.name)}</b>: {k.description}</li>
            ))}
          </ul>
        </section>
      )}
    </motion.aside>
  );
}
