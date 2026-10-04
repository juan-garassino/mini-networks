"use client";

// Top-left corner: the map's title cartouche. Title, one live sentence about
// the zoo (or about the focused land, with a way back to the whole map), and
// the search field as its bottom row. On the paper map it sits exactly where
// the painter put the cartouche.
import type { Family } from "../anchors";
import { FAMILY_TITLE, PAPER_SUBLINE, type Material } from "../material";
import { Plate, Search } from "./plate";

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

export function Cartouche({ m, counts, names, focusFam, famCount, famProven, onPick, onWhole, compact, title = "The Model Zoo", noun = "lands" }: {
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
}) {
  const lands = WORDS[counts.lands] ?? String(counts.lands);
  const sentence = focusFam
    ? `${FAMILY_TITLE[focusFam]}: ${famCount[focusFam] ?? 0} models, ${famProven[focusFam] ?? 0} proven.`
    : `${counts.models} models in ${lands} ${noun}, ${counts.champions} proven.`;
  const sub = focusFam && !m.crisp ? PAPER_SUBLINE[focusFam] : null;
  return (
    <Plate m={m} as="header" label={title} className={compact ? "p-2.5" : "p-4 pt-3"} style={{ width: compact ? 168 : 324 }}>
      <h1 className="leading-none" style={{ fontFamily: m.signFont, fontWeight: 700, fontSize: compact ? 20 : 32, color: m.crisp ? m.border : m.ink }}>
        {title}
      </h1>
      {!compact && (
        <>
          <p className="mt-2 leading-snug" style={{ fontSize: 16, color: m.ink, maxWidth: "56ch" }}>
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
