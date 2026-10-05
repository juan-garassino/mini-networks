"use client";

// The top bar: back link, the keeper (an easter egg), the title, the key (desktop: inline;
// phone: behind "Key"), the pipelines toggle and the model finder.
import Link from "next/link";
import { displayName } from "@/components/lab/shared/card-model";
import { Critter } from "./critter";
import { Legend } from "./legend";
import { COLOR, RADIUS, SPACE, TYPE } from "./tokens";
import s from "./flow.module.css";

export function TopBar({ mobile, keeperHappy, onKeeper, pipeCount, pipeShown, pipesOpen, onPipes, keyOpen, onKey, models, onFind }: {
  mobile: boolean; keeperHappy: boolean; onKeeper: () => void;
  pipeCount: number; pipeShown: boolean; pipesOpen: boolean; onPipes: () => void;
  keyOpen: boolean; onKey: () => void;
  models: string[]; onFind: (name: string) => boolean;
}) {
  const button = `${s.btn} shrink-0 border px-2 py-1 font-bold`;
  const ui = { borderColor: COLOR.ink, borderRadius: RADIUS.ui, fontSize: TYPE.ui } as const;
  return (
    <header className={`z-40 flex items-center ${mobile ? "gap-2 px-2" : "gap-3 px-3"} border-b`}
      style={{ height: mobile ? SPACE.barMobile : SPACE.barDesktop, borderColor: COLOR.rule, background: COLOR.card }}>
      {!mobile && <Link href="/lab/designs/" className="shrink-0 whitespace-nowrap font-bold underline" style={{ color: COLOR.inkSoft, fontSize: TYPE.ui }}>All designs</Link>}
      <button type="button" onClick={onKeeper} aria-label="the keeper (poke it)" className={`${s.btn} shrink-0`}>
        <svg viewBox="0 0 24 24" width={26} height={26} aria-hidden><Critter family="perception" state={keeperHappy ? "champion" : "trained"} /></svg>
      </button>
      <h1 className={`${s.title} shrink-0 whitespace-nowrap leading-none`} style={{ fontSize: mobile ? TYPE.titleMobile : TYPE.title }}>Zoo flow</h1>
      <div className="min-w-0 flex-1" />
      {!mobile && <Legend />}
      {mobile && <button type="button" onClick={onKey} aria-expanded={keyOpen} className={button} style={ui}>Key</button>}
      <button type="button" onClick={onPipes} aria-expanded={pipesOpen} className={button}
        style={{ ...ui, background: pipeShown ? COLOR.accent : COLOR.card, color: pipeShown ? COLOR.onAccent : COLOR.ink }}>
        {mobile ? "Pipelines" : `Pipelines ${pipeCount}`}
      </button>
      <input list="flow-models" placeholder={mobile ? "Find" : "Find a model"} aria-label="Find a model"
        className={`${mobile ? "w-[84px] min-w-0" : "w-[124px]"} border px-2 py-1 font-bold outline-none focus:ring-2`}
        style={{ ...ui, color: COLOR.ink }}
        onChange={(e) => { if (onFind(e.target.value.trim().replace(/ /g, "_"))) { e.target.value = ""; e.target.blur(); } }} />
      <datalist id="flow-models">{models.map((m) => <option key={m} value={displayName(m)} />)}</datalist>
    </header>
  );
}
