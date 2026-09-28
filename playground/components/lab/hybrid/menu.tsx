"use client";

// Left-hand chrome: the title plate and the region menu. In the overview the
// menu lists families (jump to a region); inside a region it lists that
// family's models, atoms first, so any model is two keypresses away.
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { displayName } from "@/components/lab/shared/card-model";
import { PixelSprite, PixelWindow } from "./chrome.tsx";
import { STAR } from "./pixel-art.ts";
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

export function TitlePlate({ models, families, compact, onMenu, menuOpen }: {
  models: number; families: number; compact: boolean; onMenu?: () => void; menuOpen?: boolean;
}) {
  return (
    <PixelWindow kind="plate" as="header" label="Title">
      <div className="flex items-center gap-3 px-2 pb-0.5">
        <div className="flex-1">
          <h1 className={compact ? s.t18 : s.t24}>The model zoo</h1>
          <p className={`${s.t13} ${s.gold}`}><NumText text={`${models} models in ${families} families`} /></p>
        </div>
        {onMenu && (
          <button type="button" className={s.btn} onClick={onMenu} aria-expanded={menuOpen}>
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
                {r.kind !== "back" && <span className={s.swatch} style={{ background: chromeSwatch(r.family) }} />}
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
