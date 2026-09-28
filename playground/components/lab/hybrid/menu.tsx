"use client";

// Left-hand chrome: the title plate and the region menu. In the overview the
// menu lists families (jump to a region); inside a region it lists that
// family's models, atoms first, so any model is two keypresses away.
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { displayName } from "@/components/lab/shared/card-model";
import { PixelSprite, PixelWindow } from "./chrome.tsx";
import { STAR } from "./pixel-art.ts";
import { PixelEmblem } from "./emblem.tsx";
import { UI } from "./palette.ts";
import { NumText } from "./pixel-num.tsx";
import { chromeSwatch } from "./palette.ts";
import s from "./hybrid.module.css";

export interface MenuRow {
  key: string;
  kind: "family" | "model" | "back";
  label: string;
  family: string;
  /** family rows: model count · model rows: generation */
  meta: string;
  atom?: boolean;
  state?: EvidenceState;
}

/**
 * The slim title: one pixel plate line — the zoo, its size, and a breadcrumb
 * (All families › Sequence › transformer) that doubles as navigation.
 */
export function SlimTitle({ models, families, crumbs, onMenu, menuOpen, toast }: {
  models: number; families: number;
  crumbs: { label: string; onClick?: () => void }[];
  onMenu?: () => void; menuOpen?: boolean;
  /** a transient line (the Konami wave) */
  toast?: string | null;
}) {
  return (
    <PixelWindow kind="plate" as="header" label="Title">
      <div className={s.titlebar}>
        <h1 className={`${s.t18} whitespace-nowrap`} style={{ fontWeight: 700 }}>The model zoo</h1>
        <span className={`${s.t14} ${s.gold} whitespace-nowrap`}><NumText text={`${models} models, ${families} families`} /></span>
        {crumbs.length > 0 && (
          <nav aria-label="You are here" className="flex min-w-0 items-center gap-1.5">
            {crumbs.map((c, i) => (
              <span key={i} className="flex min-w-0 items-center gap-1.5">
                <span className={s.crumbSep} aria-hidden>›</span>
                {c.onClick
                  ? <button type="button" className={s.crumb} onClick={c.onClick}>{c.label}</button>
                  : <span className={`${s.t16} truncate`}>{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        {toast && <span className={`${s.t14} ${s.gold} whitespace-nowrap`}>{toast}</span>}
        {onMenu && (
          <button type="button" className={`${s.btn} ml-auto`} onClick={onMenu} aria-expanded={menuOpen}>
            {menuOpen ? "Close" : "Families"}
          </button>
        )}
      </div>
    </PixelWindow>
  );
}

export function RegionMenu({ title, rows, cursor, onPick, onHover, className, touch, footer, style }: {
  title: string;
  rows: MenuRow[];
  cursor: number;
  onPick: (row: MenuRow) => void;
  onHover: (i: number) => void;
  className?: string;
  /** phone: 40px rows */
  touch?: boolean;
  /** one or two lines of help under the list (keyboard on desktop, map key on phone) */
  footer?: string;
  style?: React.CSSProperties;
}) {
  const hasAtoms = rows.some((r) => r.atom);
  return (
    <PixelWindow as="nav" label="Jump to" title={title} className={className} style={style} bodyClassName={`${s.scroll} min-h-0 flex-1`}>
      <ul className="py-1" role="menu">
        {rows.map((r, i) => {
          return (
            <li key={r.key} role="none">
              <button type="button" role="menuitem"
                className={`${s.row} ${touch ? s.rowTouch : ""} ${i === cursor ? s.rowHot : ""} ${r.kind === "family" ? s.t18 : s.t15}`}
                onClick={() => onPick(r)} onMouseEnter={() => onHover(i)} onFocus={() => onHover(i)}>
                {r.kind === "family" && <span className={s.swatch} style={{ background: chromeSwatch(r.family) }} />}
                {r.kind === "model" && <PixelEmblem name={r.key} scale={1} color={r.atom ? UI.gold : UI.text} />}
                <span className={`flex-1 min-w-0 break-words ${r.atom ? s.gold : ""} ${r.kind === "back" ? s.dim : ""}`}>
                  {r.kind === "model" ? displayName(r.label) : r.label}
                </span>
                {r.state === "champion" && <PixelSprite sprite={STAR} scale={2} className="flex-none" />}
                <span className={`${s.t13} ${s.dim} whitespace-nowrap`}><NumText text={r.meta} /></span>
              </button>
            </li>
          );
        })}
      </ul>
      {footer && <p className={`${s.t13} ${s.dim} px-2`}>{footer}</p>}
      {hasAtoms && (
        <p className={`${s.t13} ${s.dim} px-2 pb-1`}>
          <span className={s.gold}>Gold</span> names are atoms (<NumText text="LV 1" />), where the family starts.
        </p>
      )}
    </PixelWindow>
  );
}

export function Dialog({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <PixelWindow kind="dialog" as="div" label="Narrator" className={className}>
      <div className="px-2 py-1">{children}</div>
    </PixelWindow>
  );
}
