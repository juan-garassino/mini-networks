"use client";

import { createElement, type CSSProperties } from "react";
import { motion } from "motion/react";
import { familyOf, symbolFor } from "@/lib/blueprint";
import { iconFor } from "@/lib/icons";
import type { TileLevel } from "./encoding";

// One element tile — the table, the key's sample and the spec-sheet drawer
// all draw this. Looks come from periodic.css (--pt-* vars set by the skin);
// what each mark means is in encoding.ts.

/** A word longer than this may not fit a tile line even in a narrow face: only it may hyphenate. */
const LONG_WORD = 12;

/** A name as words (the underscore drawn as a space), so lines break between words; only an
 * over-long word ("melspectrogram") is allowed to hyphenate. */
function Words({ name }: { name: string }) {
  const ws = name.split("_");
  return (
    <>
      {ws.map((w, i) => (
        <span key={i} className={w.length > LONG_WORD ? "pt-long" : undefined}>{w}{i < ws.length - 1 ? " " : ""}</span>
      ))}
    </>
  );
}

export interface ElementTileProps {
  name: string;
  /** Atomic number, or "✻n" for a reaction. */
  number: number | string;
  /** The printed symbol (a reaction's comes from the ✻ order: placed.ts); default symbolFor(name). */
  symbol?: string;
  level: TileLevel;
  /** "spec" = the large tile heading the spec-sheet drawer. */
  size?: "table" | "spec";
  /** Absent = a static sample (the key, the drawer). */
  onSelect?: (name: string) => void;
  /** Tooltip: what the model introduces / what a reaction composes. */
  title?: string;
  /** Entry timing in seconds (from the skin's motion tokens). */
  enter?: { delay: number; duration: number };
  /** Grid cell (1-based) when the parent is a CSS grid. */
  cell?: { col: number; row: number };
}

export function ElementTile({
  name, number, symbol, level, size = "table", onSelect, title, enter, cell,
}: ElementTileProps) {
  const Icon = iconFor(name);
  const family = level === "reaction" ? undefined : familyOf(name);
  const body = (
    <>
      <span className="pt-head">
        <span className="pt-z">{number}</span>
        {Icon && createElement(Icon, { strokeWidth: 1.5, className: "pt-icon", "aria-hidden": true })}
      </span>
      <span className="pt-sym">{symbol ?? symbolFor(name)}</span>
      <span className="pt-name" lang="en"><Words name={name} /></span>
    </>
  );
  const props = {
    className: "pt-tile",
    "data-level": level,
    "data-size": size,
    "data-family": family,
    style: {
      ...(family && { "--fam": `var(--pt-fam-${family})` }),
      ...(cell && { gridColumn: cell.col, gridRow: cell.row }),
    } as CSSProperties,
  };
  if (!onSelect) return <div {...props}>{body}</div>;
  return (
    <motion.button
      {...props}
      type="button"
      onClick={() => onSelect(name)}
      title={title}
      // no `enter` (still=1, reduced motion): the tile is drawn in its final state
      initial={enter ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={enter}
    >
      {body}
    </motion.button>
  );
}
