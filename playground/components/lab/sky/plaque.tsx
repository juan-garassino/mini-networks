"use client";

// A family's night sign: its pixel emblem, its name and model count, and (at
// region zoom) the Latin constellation line. Bordered in the family's pastel;
// set in sentence case so the long names stay short and readable.
import type { CSSProperties } from "react";
import { plateStyle } from "@/components/lab/painted/corners/plate";
import { FAMILY_TITLE } from "@/components/lab/painted/material";
import { FAMILY_INK, SKY_MATERIAL as m, SPACE, TYPE } from "./tokens";
import { CONSTELLATION, emblem } from "./sprites";
import { SpriteIcon } from "./icon";

/** The plaque's width in CSS px, before it is drawn (layout.ts places it with this). */
export function plaqueWidth(family: string, count: number, { compact, latin }: { compact: boolean; latin: boolean }): number {
  const fs = TYPE.plaque[compact ? 1 : 0], sub = TYPE.plaqueSub[compact ? 1 : 0];
  const c = CONSTELLATION[family];
  const title = `${FAMILY_TITLE[family] ?? family} ${count}`.length * fs * TYPE.em;
  const line2 = latin && c ? `${c.latin}, ${c.gloss}`.length * sub * TYPE.em : 0;
  const emblemW = 16 * (compact ? 1 : 1.5);
  return Math.ceil(Math.max(title, line2) + emblemW + SPACE.plaqueGap[compact ? 1 : 0] + (compact ? 14 : 18));
}

export function Plaque({ family, count, latin = false, compact = false, style, onClick, dimmed = false }: {
  family: string; count: number; latin?: boolean; compact?: boolean; style?: CSSProperties; onClick?: () => void; dimmed?: boolean;
}) {
  const ink = FAMILY_INK[family];
  const c = CONSTELLATION[family];
  const k = compact ? 1 : 0;
  const title = FAMILY_TITLE[family] ?? family;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} aria-label={onClick ? `${title}, ${count} models: open the constellation` : undefined}
      className="flex items-center text-left leading-none focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        ...plateStyle(m, { shadow: true }), border: `var(--ap) solid ${ink.tint[0]}`,
        padding: SPACE.plaquePad[k], gap: SPACE.plaqueGap[k], whiteSpace: "nowrap",
        opacity: dimmed ? 0.55 : 1, ...style,
      }}>
      <SpriteIcon s={emblem(family)!} scale={compact ? 1 : 1.5} />
      <span className="flex flex-col" style={{ gap: 3 }}>
        <span style={{ fontSize: TYPE.plaque[k], fontWeight: 700, color: m.ink }}>
          {title} <span style={{ color: ink.tint[1] }}>{count}</span>
        </span>
        {latin && c && <span style={{ fontSize: TYPE.plaqueSub[k], color: m.inkSoft }}>{c.latin}, {c.gloss}</span>}
      </span>
    </Tag>
  );
}
