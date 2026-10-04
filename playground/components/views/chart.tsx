"use client";

import { Fragment, createElement } from "react";
import { motion } from "motion/react";
import type { TaxonomyResponse } from "@/lib/types";
import {
  ATOMS, FAMILY_BLOCKS, PLACEMENT, TABLE_COLS, TABLE_ROWS,
  atomicNumbers, familyOf, symbolFor,
} from "@/lib/blueprint";
import { iconFor } from "@/lib/icons";

// The periodic table sheet, shared by the blueprint and wall-chart editions
// (the wall chart tints tiles by family through .pt-fam[data-family] in
// blueprint.css; the blueprint stays single-ink cyanotype).
//
// Marks, all data: tile border weight = level (atom 1.5px solid, compound 1px,
// reaction dashed); top-left number = atomic number (atoms 1-16, compounds in
// reading order, reactions ✻n); top-right glyph = mechanism icon; symbol =
// chart symbol in chemistry case; bottom = model name; column block = family;
// row = generation (each period builds on the rows above).

const COLS = `repeat(${TABLE_COLS}, minmax(0, 1fr))`;
// the empty bay under the generative block is where a real table keeps its key
const KEY_AREA = { cols: [7, 10], rows: [3, 5] } as const;

/** Break long snake_case names only at underscores. */
function Name({ name }: { name: string }) {
  const parts = name.split("_");
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {p}
          {i < parts.length - 1 && <>_<wbr /></>}
        </Fragment>
      ))}
    </>
  );
}

function Tile({
  name, z, atom, onSelect, delay, title, sample = false,
}: {
  name: string;
  title?: string;
  z: number | string;
  atom: boolean;
  onSelect?: (name: string) => void;
  delay?: number;
  sample?: boolean;
}) {
  const Icon = iconFor(name);
  const body = (
    <>
      <span className="flex items-start justify-between leading-none">
        <span className="pt-z tabular-nums text-ink-dim">{z}</span>
        {Icon && createElement(Icon, {
          strokeWidth: 1.5,
          className: "pt-icon text-ink-dim transition-colors group-hover:text-redline",
        })}
      </span>
      <span
        className={`pt-sym bp-title text-center leading-none tracking-[0.02em] group-hover:text-redline ${
          atom ? "font-extrabold text-ink" : "font-bold text-ink-dim"
        }`}
      >
        {symbolFor(name)}
      </span>
      <span className="pt-name line-clamp-2 text-center text-ink-dim group-hover:text-ink">
        <Name name={name} />
      </span>
    </>
  );
  const cls = `pt-tile pt-fam group grid grid-rows-[auto_1fr_auto] items-center text-left transition-colors ${
    atom ? "border-[1.5px] border-line bg-paper-deep/80" : "border border-line-faint bg-paper-deep/40"
  } ${sample ? "pt-sample" : "hover:border-redline focus-visible:border-redline focus-visible:outline-none"}`;
  const data = { "data-family": familyOf(name), "data-level": atom ? "atom" : "compound" };
  if (sample) return <div className={cls} {...data}>{body}</div>;
  return (
    <motion.button
      onClick={() => onSelect?.(name)}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.3 }}
      className={cls}
      title={title}
      {...data}
    >
      {body}
    </motion.button>
  );
}

export function Chart({
  taxonomy, onSelect,
}: {
  taxonomy: TaxonomyResponse | null;
  onSelect: (name: string) => void;
}) {
  if (!taxonomy) {
    return (
      <div className="flex h-full items-center justify-center text-ink-dim">
        <span className="bp-title text-sm tracking-[0.3em]">surveying the specimens…</span>
      </div>
    );
  }
  const byName = Object.fromEntries(taxonomy.models.map((m) => [m.name, m]));
  const z = atomicNumbers();
  const nAtoms = taxonomy.models.filter((m) => m.level === "elementary").length;

  // the key takes the empty bay only when no placed model sits in it
  const keyFits = !Object.values(PLACEMENT).some(
    (p) => p.col >= KEY_AREA.cols[0] && p.col <= KEY_AREA.cols[1]
      && p.row >= KEY_AREA.rows[0] && p.row <= KEY_AREA.rows[1],
  );
  const reactionRows = Math.ceil(taxonomy.compositions.length / 11);

  return (
    <div className="pt-sheet h-full overflow-auto px-5 py-6 sm:px-10">
      {/* masthead */}
      <motion.header
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b-[1.5px] border-line pb-4"
      >
        <div>
          <div className="text-[10px] tracking-[0.35em] text-ink-dim">DWG Nº MN-00{taxonomy.models.length} · SHEET 01</div>
          <h1 className="bp-title mt-1 text-3xl font-extrabold leading-none text-ink sm:text-5xl">
            The Periodic Table<span className="text-redline"> of Neural Networks</span>
          </h1>
        </div>
        <div className="bp-stamp px-3 py-1 text-[10px]">
          {taxonomy.models.length} species · {nAtoms} elementary · {taxonomy.compositions.length} reactions
        </div>
      </motion.header>

      <div className="min-w-[1080px]">
        {/* family group labels — each rule spans exactly its block of columns */}
        <div className="grid gap-1" style={{ gridTemplateColumns: COLS }}>
          {FAMILY_BLOCKS.map((b) => (
            <div
              key={b.family}
              className="pt-fam pt-famhead flex items-end"
              data-family={b.family}
              style={{ gridColumn: `${b.cols[0]} / ${b.cols[1] + 1}` }}
            >
              <span className="bp-title truncate pb-1 text-[10px] tracking-[0.18em] text-ink-dim">{b.label}</span>
            </div>
          ))}
        </div>

        {/* the main table */}
        <div
          className="mt-1.5 grid gap-1"
          style={{ gridTemplateColumns: COLS, gridTemplateRows: `repeat(${TABLE_ROWS}, 5.25rem)` }}
        >
          {Object.entries(PLACEMENT).map(([name, pos]) => {
            const taxon = byName[name];
            return (
              <div
                key={name}
                style={{ gridColumn: pos.col, gridRow: pos.row }}
                className="grid"
              >
                <Tile
                  name={name}
                  z={z[name]}
                  atom={!!ATOMS[name]}
                  onSelect={onSelect}
                  title={`${name} — ${taxon?.introduces.join(", ") || taxon?.note || ""}`}
                  delay={0.1 + (pos.row - 1) * 0.07 + pos.col * 0.015}
                />
              </div>
            );
          })}

          {keyFits && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.4 }}
              className="pt-key flex flex-col justify-center gap-3 px-3"
              style={{
                gridColumn: `${KEY_AREA.cols[0]} / ${KEY_AREA.cols[1] + 1}`,
                gridRow: `${KEY_AREA.rows[0]} / ${KEY_AREA.rows[1] + 1}`,
              }}
            >
              <ChartKey sampleZ={z.transformer} />
            </motion.div>
          )}
        </div>

        {/* f-block: reactions (the lanthanides of the zoo) */}
        <div
          className="mt-6 grid gap-1"
          style={{ gridTemplateColumns: COLS, gridTemplateRows: `repeat(${reactionRows}, 4.5rem)` }}
        >
          <div
            className="flex flex-col justify-center gap-1 pr-3 text-right"
            style={{ gridColumn: "1 / 3", gridRow: `1 / ${reactionRows + 1}` }}
          >
            <span className="bp-title text-[11px] tracking-[0.2em] text-ink">✻ Reactions</span>
            <span className="text-[9px] leading-snug text-ink-dim">
              whole models wired into pipelines · sheet 02
            </span>
          </div>
          {taxonomy.compositions.map((c, i) => {
            const RIcon = iconFor(c.name);
            return (
              <motion.button
                key={c.name}
                onClick={() => onSelect(c.name)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 + i * 0.02, duration: 0.3 }}
                style={{ gridColumn: 3 + (i % 11), gridRow: Math.floor(i / 11) + 1 }}
                className="pt-tile pt-reaction group grid grid-rows-[auto_1fr_auto] items-center border border-dashed border-line-faint bg-paper-deep/30 text-left transition-colors hover:border-redline focus-visible:border-redline focus-visible:outline-none"
                title={`${c.name} = ${c.composes.join(" + ")}`}
              >
                <span className="flex items-start justify-between leading-none">
                  <span className="pt-z tabular-nums text-redline/80">✻{i + 1}</span>
                  {RIcon && (
                    <RIcon strokeWidth={1.5}
                      className="pt-icon text-ink-dim transition-colors group-hover:text-redline" />
                  )}
                </span>
                <span className="pt-sym bp-title text-center font-bold leading-none text-ink-dim group-hover:text-redline">
                  {symbolFor(c.name)}
                </span>
                <span className="pt-name line-clamp-2 text-center text-ink-dim group-hover:text-ink">
                  <Name name={c.name} />
                </span>
              </motion.button>
            );
          })}
        </div>

        {!keyFits && (
          <div className="pt-key mt-6 flex max-w-md flex-col gap-3">
            <ChartKey sampleZ={z.transformer} />
          </div>
        )}
      </div>
    </div>
  );
}

/** The chart's key: one annotated sample tile + the three kinds of tile. */
function ChartKey({ sampleZ }: { sampleZ: number }) {
  return (
    <>
      <div className="bp-title text-[10px] tracking-[0.25em] text-ink">Key</div>
      <div className="grid grid-cols-[5.25rem_1.5rem_1fr] grid-rows-[1.1rem_1fr_1.6rem] gap-y-0 text-[9.5px] leading-tight text-ink-dim">
        <div className="row-span-3 grid h-[5.25rem]">
          <Tile name="transformer" z={sampleZ} atom sample />
        </div>
        <span className="self-center border-t border-dashed border-line-faint" />
        <span className="self-center">number · mechanism glyph</span>
        <span className="self-center border-t border-dashed border-line-faint" />
        <span className="self-center">symbol</span>
        <span className="self-center border-t border-dashed border-line-faint" />
        <span className="self-center">model</span>
      </div>
      <div className="grid grid-cols-[0.75rem_1fr] items-center gap-x-2 gap-y-1.5 text-[9.5px] leading-tight text-ink-dim">
        <span className="pt-fam h-3 w-3 border-[1.5px] border-line bg-paper-deep/80" />
        <span>elementary atom: introduces one mechanism</span>
        <span className="h-3 w-3 border border-line-faint bg-paper-deep/40" />
        <span>derived compound: built from atoms</span>
        <span className="h-3 w-3 border border-dashed border-line-faint" />
        <span>reaction ✻: whole models in one pipeline</span>
      </div>
      <div className="text-[9.5px] leading-tight text-ink-dim">
        Rows read as generations: each builds on the rows above it.
      </div>
    </>
  );
}
