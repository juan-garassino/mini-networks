"use client";

// The model card as a JRPG status window. Every line is a field of
// cardModel(): LV = generation (depth + 1), class = family, the gate meter
// = best local run vs the M bar, equipped = the champion checkpoint version,
// skills = mechanisms it introduces, and the party = parents / children.
import type { CardModel } from "@/components/lab/shared/card-model";
import { displayName, EVIDENCE_COPY } from "@/components/lab/shared/card-model";
import { PixelWindow, Typewriter } from "./chrome.tsx";
import { PixelNum, spell } from "./pixel-num.tsx";
import { chromeSwatch, familyLabel, SW } from "./palette.ts";
import s from "./hybrid.module.css";

export interface PartyMember { name: string; role: "parent" | "child"; family: string; depth: number }

function fmt(v: number): string {
  if (Math.abs(v) >= 100) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(1);
  return v.toFixed(Math.abs(v) < 1 ? 3 : 2).replace(/0+$/, "").replace(/\.$/, "");
}

const metricWords = (m: string) => m.replace(/_/g, " ");

function GateMeter({ card }: { card: CardModel }) {
  const e = card.evidence;
  if (!e || e.gate_metric == null || e.threshold_m == null) {
    return <p className={`${s.t13} ${s.dim}`}>No quality gate for this model yet.</p>;
  }
  const thr = e.threshold_m, best = e.best_metric;
  // Axis: 0 … a max that keeps the bar near the middle for losses and the
  // natural 0–1 range for scores.
  const max = e.higher_is_better
    ? Math.max(thr <= 1 ? 1 : thr * 1.5, best ?? 0)
    : Math.max(thr * 2, (best ?? 0) * 1.1);
  const pct = (v: number) => `calc(${Math.min(100, (v / max) * 100)}% - 4px)`;
  const pass = card.passesBar;
  const fill = pass ? SW.green : SW.orange;
  return (
    <div>
      <div className={`${s.t13} flex justify-between gap-2`}>
        <span>{metricWords(e.gate_metric)} {e.higher_is_better ? "at least" : "at most"} <span className={s.gold}><PixelNum value={fmt(thr)} /></span></span>
        <span className={s.dim}>{e.higher_is_better ? "higher is better" : "lower is better"}</span>
      </div>
      <div className={`${s.meter} mt-2`} role="img"
        aria-label={best == null ? `Bar ${fmt(thr)}; no local score` : `Best local run ${fmt(best)} against bar ${fmt(thr)}`}>
        {best != null && <div className={s.meterFill} style={{ width: pct(best), background: fill }} />}
        <div className={s.meterTick} style={{ left: `${Math.min(100, (thr / max) * 100)}%` }} />
      </div>
      <p className={`${s.t13} mt-1.5`}>
        {best == null
          ? <span className={s.dim}>No local score yet — train it to fill this bar.</span>
          : <>Best local run <span className={pass ? s.lime : s.red}><PixelNum value={fmt(best)} /></span>{pass ? ", clears the bar" : ", short of the bar"}</>}
      </p>
    </div>
  );
}

export function StatusWindow({
  card, party, partyCursor, onParty, onHover, onClose, still, mobile,
}: {
  card: CardModel;
  party: PartyMember[];
  partyCursor: number;
  onParty: (name: string) => void;
  onHover: (i: number) => void;
  onClose: () => void;
  still: boolean;
  mobile: boolean;
}) {
  const version = card.evidence?.champion_version?.match(/v\d+/)?.[0] ?? null;
  const parents = party.filter((p) => p.role === "parent");
  const children = party.filter((p) => p.role === "child");
  const row = (p: PartyMember) => {
    const i = party.indexOf(p);
    return (
      <li key={`${p.role}-${p.name}`}>
        <button type="button" className={`${s.row} ${mobile ? s.rowTouch : ""} ${i === partyCursor ? s.rowHot : ""} ${s.t15}`}
          onClick={() => onParty(p.name)} onMouseEnter={() => onHover(i)} onFocus={() => onHover(i)}>
          <span className={s.swatch} style={{ background: chromeSwatch(p.family) }} />
          <span className="flex-1 truncate">{displayName(p.name)}</span>
          <span className={`${s.t13} ${s.dim} whitespace-nowrap`}>LV <PixelNum value={p.depth + 1} /></span>
        </button>
      </li>
    );
  };

  return (
    <PixelWindow as="aside" label={`${displayName(card.name)} status`} lifted
      className={mobile
        ? "absolute inset-x-2 bottom-2 z-20 max-h-[52%] flex"
        : "absolute right-4 top-4 z-20 w-[392px] max-h-[calc(100%-32px)] flex"}
      bodyClassName={`${s.scroll} flex-1 min-h-0`}>
      <div className={`${s.pad} flex flex-col gap-3`}>
        <header className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className={`${s.t30} break-words`}>{displayName(card.name)}</h2>
            <p className={`${s.t13} ${card.state === "champion" ? s.lime : card.state === "provisional" ? s.gold : s.dim}`}>
              {EVIDENCE_COPY[card.state]}
            </p>
          </div>
          <button type="button" className={s.btn} onClick={onClose} aria-label="Close status (Esc)">Close</button>
        </header>

        <Typewriter text={card.description || card.note || "No description yet."} still={still} className={`${s.t15}`} />

        <dl className={`${s.t15} grid grid-cols-[auto_1fr] gap-x-4 gap-y-1`}>
          <dt className={s.dim}>LV</dt>
          <dd className="flex items-baseline gap-2"><span className={s.gold}><PixelNum value={card.depth + 1} /></span>
            <span className={`${s.t13} ${s.dim}`}>{card.atom ? "an atom, where a family starts" : `${spell(card.depth)} step${card.depth > 1 ? "s" : ""} from its atom`}</span></dd>
          <dt className={s.dim}>Class</dt>
          <dd className="flex items-center gap-2"><span className={s.swatch} style={{ background: chromeSwatch(card.family) }} />{familyLabel(card.family)}</dd>
          <dt className={s.dim}>Equipped</dt>
          <dd>{card.state === "champion"
            ? <>Champion checkpoint <span className={s.gold}>v{version ? <PixelNum value={version.slice(1)} /> : "?"}</span></>
            : <span className={s.dim}>No champion yet</span>}</dd>
        </dl>

        <div className={s.rule} aria-hidden />
        <section>
          <h3 className={`${s.t15} ${s.gold}`}>Quality gate</h3>
          <div className="mt-1"><GateMeter card={card} /></div>
        </section>

        <section>
          <h3 className={`${s.t15} ${s.gold}`}>Skills it introduces</h3>
          {card.introduces.length ? (
            <ul className="mt-1 flex flex-col gap-1">
              {card.introduces.map((m) => (
                <li key={m.key} className={s.t15}>
                  <span className={s.cyan}>{metricWords(m.key)}</span>
                  {m.description && <span className={`${s.t13} ${s.dim} block`}>{m.description}</span>}
                </li>
              ))}
            </ul>
          ) : <p className={`${s.t13} ${s.dim} mt-1`}>Nothing new — it recombines what its parents know.</p>}
        </section>

        <div className={s.rule} aria-hidden />
        <section aria-label="Lineage">
          <h3 className={`${s.t15} ${s.gold}`}>Builds on</h3>
          {parents.length
            ? <ul className="mt-1">{parents.map(row)}</ul>
            : <p className={`${s.t13} ${s.dim} mt-1`}>Nothing — it is an atom.</p>}
          <h3 className={`${s.t15} ${s.gold} mt-2`}>Leads to</h3>
          {children.length
            ? <ul className="mt-1">{children.map(row)}</ul>
            : <p className={`${s.t13} ${s.dim} mt-1`}>No models build on it yet.</p>}
          <p className={`${s.t13} ${s.dim} mt-1`}>Arrow keys pick, Enter travels, Esc closes.</p>
        </section>

        {card.compositions.length > 0 && (
          <section>
            <h3 className={`${s.t15} ${s.gold}`}>Used in combos</h3>
            <p className={`${s.t13} mt-1`}>{card.compositions.map((c) => displayName(c.name)).join(", ")}</p>
          </section>
        )}

        {card.sampleImage && (
          <section>
            <h3 className={`${s.t15} ${s.gold}`}>Latest sample</h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={card.sampleImage} alt={`Sample output of ${displayName(card.name)}`}
              className="mt-1 w-full" style={{ imageRendering: "pixelated", boxShadow: `0 0 0 2px ${SW.night}` }} />
          </section>
        )}
      </div>
    </PixelWindow>
  );
}
