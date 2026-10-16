"use client";

// Top-left corner: the map's title cartouche. Title, one live sentence about
// the zoo (or about the focused land, with a way back to the whole map), and
// the search field as its bottom row. On the paper map it sits exactly where
// the painter put the cartouche. quiet (focus mode: a land or a model open, or
// zoomed in): one row — the title, "Whole map" and a magnifier that unfolds
// the field — so the map plate and the drawer are the two things to read.
import type { Family } from "../anchors";
import { CORNER, FAMILY_TITLE, PAPER_SUBLINE, TYPE, type Material } from "../material";
import { Plate, Search } from "./plate";

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

export function Cartouche({ m, counts, names, focusFam, famCount, famProven, onPick, onWhole, compact, quiet = false, wholeLink = true, title = "The Model Zoo", noun = "lands" }: {
  m: Material;
  title?: string;
  /** what a family is called in the sentence: lands, constellations… */
  noun?: string;
  counts: { models: number; pipelines: number; champions: number; lands: number };
  names: string[];
  focusFam: Family | null;
  famCount: Record<string, number>;
  famProven: Record<string, number>;
  onPick: (n: string) => void;
  onWhole: () => void;
  compact: boolean;
  /** focus mode: condense to one row (title, Whole map, a search magnifier) */
  quiet?: boolean;
  /** quiet: show the "Whole map" link (phones leave it to the sheet's own) */
  wholeLink?: boolean;
}) {
  const lands = WORDS[counts.lands] ?? String(counts.lands);
  const sentence = focusFam
    ? `${FAMILY_TITLE[focusFam]}: ${famCount[focusFam] ?? 0} models, ${famProven[focusFam] ?? 0} proven.`
    : `${counts.models} models in ${lands} ${noun}, ${counts.champions} proven.`;
  const sub = focusFam && !m.crisp ? PAPER_SUBLINE[focusFam] : null;
  if (quiet) {
    return (
      <Plate m={m} as="header" label={title} style={{ padding: `${CORNER.padQuiet}px ${CORNER.padQuiet + 2}px`, width: "max-content", maxWidth: CORNER.w }}>
        <div className="flex items-center gap-3">
          <h1 className="whitespace-nowrap leading-none" style={{ fontFamily: m.signFont, fontWeight: 700, fontSize: compact ? TYPE.displayTiny : TYPE.displaySmall, color: m.crisp ? m.border : m.ink }}>
            {title}
          </h1>
          {wholeLink && (
            <button type="button" onClick={onWhole} title="Whole map (Esc)"
              className="whitespace-nowrap leading-none underline decoration-dotted underline-offset-4 focus-visible:outline-2"
              style={{ color: m.border, fontFamily: m.bodyFont, fontSize: TYPE.link }}>
              Whole map
            </button>
          )}
          <Search m={m} names={names} onPick={onPick} compact={compact} collapsed />
        </div>
      </Plate>
    );
  }
  return (
    <Plate m={m} as="header" label={title} className={compact ? "p-2.5" : undefined} style={{ width: compact ? CORNER.wPhone : CORNER.w, padding: compact ? undefined : CORNER.pad }}>
      <h1 className="leading-none" style={{ fontFamily: m.signFont, fontWeight: 700, fontSize: compact ? TYPE.displaySmall : TYPE.display, color: m.crisp ? m.border : m.ink }}>
        {title}
      </h1>
      {!compact && (
        <>
          <p className="mt-2 leading-snug" style={{ fontSize: TYPE.lead, color: m.ink, maxWidth: "56ch" }}>
            {sentence}{sub ? ` ${sub}.` : ""}
            {focusFam && (
              <>
                {" "}
                <button type="button" onClick={onWhole} className="underline decoration-dotted underline-offset-4 focus-visible:outline-2" style={{ color: m.border }}>
                  Whole map
                </button>
              </>
            )}
          </p>
          <div className="mt-3">
            <Search m={m} names={names} onPick={onPick} />
          </div>
        </>
      )}
      {compact && (
        <div className="mt-2">
          <Search m={m} names={names} onPick={onPick} compact />
        </div>
      )}
    </Plate>
  );
}
