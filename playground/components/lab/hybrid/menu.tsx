"use client";

// Left-hand chrome: the title plate and the region menu. In the overview the
// menu lists families (jump to a region); inside a region it lists that
// family's models, atoms first, so any model is two keypresses away.
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { displayName } from "@/components/lab/shared/card-model";
import { PixelWindow } from "./chrome.tsx";
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
          {!compact && <p className={`${s.t13} ${s.gold}`}><NumText text={`${models} models in ${families} families`} /></p>}
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

export function RegionMenu({ title, rows, cursor, onPick, onHover, className, touch }: {
  title: string;
  rows: MenuRow[];
  cursor: number;
  onPick: (row: MenuRow) => void;
  onHover: (i: number) => void;
  className?: string;
  /** phone: 40px rows */
  touch?: boolean;
}) {
  const hasAtoms = rows.some((r) => r.atom);
  return (
    <PixelWindow as="nav" label="Jump to" title={title} className={className} bodyClassName={`${s.scroll} min-h-0 flex-1`}>
      <ul className="py-1" role="menu">
        {rows.map((r, i) => {
          return (
            <li key={r.key} role="none">
              <button type="button" role="menuitem"
                className={`${s.row} ${touch ? s.rowTouch : ""} ${i === cursor ? s.rowHot : ""} ${r.kind === "family" ? s.t18 : s.t15}`}
                onClick={() => onPick(r)} onMouseEnter={() => onHover(i)} onFocus={() => onHover(i)}>
                {r.kind !== "back" && <span className={s.swatch} style={{ background: chromeSwatch(r.family) }} />}
                <span className={`flex-1 truncate ${r.atom ? s.gold : ""} ${r.kind === "back" ? s.dim : ""}`}>
                  {r.kind === "model" ? displayName(r.label) : r.label}
                </span>
                {r.state === "champion" && <ChampionPip />}
                <span className={`${s.t13} ${s.dim} whitespace-nowrap`}><NumText text={r.meta} /></span>
              </button>
            </li>
          );
        })}
      </ul>
      {hasAtoms && (
        <p className={`${s.t13} ${s.dim} px-2 pb-1`}>
          <span className={s.gold}>Gold</span> names are atoms (<NumText text="LV 1" />), where the family starts.
        </p>
      )}
    </PixelWindow>
  );
}

/** Tiny pixel flag = has a champion checkpoint (same meaning as the map's red flag). */
function ChampionPip() {
  return (
    <svg aria-label="champion" width={10} height={12} viewBox="0 0 5 6" shapeRendering="crispEdges">
      <rect x={0} y={0} width={1} height={6} fill="#f4f4f4" />
      <rect x={1} y={0} width={4} height={1} fill="#e43b44" />
      <rect x={1} y={1} width={3} height={1} fill="#e43b44" />
      <rect x={1} y={2} width={2} height={1} fill="#e43b44" />
    </svg>
  );
}

export function Dialog({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <PixelWindow kind="dialog" as="div" label="Narrator" className={className}>
      <div className="px-2 py-1">{children}</div>
    </PixelWindow>
  );
}
