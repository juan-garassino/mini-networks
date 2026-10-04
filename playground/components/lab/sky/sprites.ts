// The Night Map's hand-authored pixel sprites: the four evidence stars (in an
// atom size and a derived size), the six family emblems for the sign plaques,
// and the broken selection ring. Letters index a ramp in palette.ts; "." is
// transparent. Pure data + tiny pure helpers (node tests import this).
import type { EvidenceState } from "@/components/lab/shared/card-model";
import { FAMILY_INK, GOLD, GREY, INK, LILAC, MINT } from "./palette.ts";

export interface Sprite {
  w: number;
  h: number;
  /** row-major letters, "." = transparent */
  rows: string[];
  /** letter → colour */
  ink: Record<string, string>;
}

const sprite = (rows: string[], ink: Record<string, string>): Sprite => ({ w: rows[0].length, h: rows.length, rows, ink });

// ——— the evidence stars. Shape carries the state (so it survives colour
// blindness): a sparkle with rays is a champion, a cut gem is trained, a
// broken ring is a bar still provisional, a dim point is not trained yet.
// Atoms take the large size.
const CHAMPION_ATOM = sprite([
  ".....1.....",
  ".....2.....",
  "..1..3..1..",
  "...2.3.2...",
  "....343....",
  "12334w43321",
  "....343....",
  "...2.3.2...",
  "..1..3..1..",
  ".....2.....",
  ".....1.....",
], GOLD);
const CHAMPION = sprite([
  "...2...",
  "...3...",
  "..343..",
  "234w432",
  "..343..",
  "...3...",
  "...2...",
], GOLD);
const TRAINED_ATOM = sprite([
  "...3...",
  "..343..",
  ".34432.",
  "3443221",
  ".34221.",
  "..221..",
  "...1...",
], MINT);
const TRAINED = sprite([
  "..3..",
  ".342.",
  "34321",
  ".221.",
  "..1..",
], MINT);
const PROVISIONAL_ATOM = sprite([
  "...232...",
  ".1.....1.",
  ".........",
  "2.......2",
  "3...1...3",
  "2.......2",
  ".........",
  ".1.....1.",
  "...232...",
], LILAC);
const PROVISIONAL = sprite([
  "..232..",
  ".......",
  "2.....2",
  "3..1..3",
  "2.....2",
  ".......",
  "..232..",
], LILAC);
const UNTRAINED_ATOM = sprite([
  "..1..",
  ".121.",
  "12221",
  ".121.",
  "..1..",
], GREY);
const UNTRAINED = sprite([
  ".1.",
  "121",
  ".1.",
], GREY);

export const STAR_SPRITES: Record<EvidenceState, { atom: Sprite; derived: Sprite }> = {
  champion: { atom: CHAMPION_ATOM, derived: CHAMPION },
  trained: { atom: TRAINED_ATOM, derived: TRAINED },
  provisional: { atom: PROVISIONAL_ATOM, derived: PROVISIONAL },
  untrained: { atom: UNTRAINED_ATOM, derived: UNTRAINED },
};

export const starSprite = (state: EvidenceState, atom: boolean): Sprite => STAR_SPRITES[state][atom ? "atom" : "derived"];
/** Half the sprite's extent in art px: lines stop this far (+ a gap) from a star. */
export const starRadius = (state: EvidenceState, atom: boolean): number => (starSprite(state, atom).w - 1) / 2;

// ——— the family emblems (16×16), one per sign plaque. k = night outline,
// m / l / p = the family's pastel tints, mid → pale.
const EMBLEM_ROWS: Record<string, string[]> = {
  // Oculus, the Eye: the perception family sees
  perception: [
    "................",
    "................",
    "................",
    ".....kkkkkk.....",
    "...kkllllllkk...",
    "..klllmmmmlllk..",
    ".kllmmkkkkmmllk.",
    "klllmmkpkkmmlllk",
    "klllmmkkkkmmlllk",
    ".kllmmkkkkmmllk.",
    "..klllmmmmlllk..",
    "...kkllllllkk...",
    ".....kkkkkk.....",
    "................",
    "................",
    "................",
  ],
  // Serpens, the Serpent: a sequence winds on, one step after another
  sequence: [
    "................",
    "................",
    "................",
    "...........kkk..",
    "..........kllpk.",
    "..........klkllk",
    "....kk....kmllk.",
    "...kllk...kmmk..",
    "..klmmlk.klmk...",
    ".klmkkmlkklmk...",
    "klmk..kmllmk....",
    "kmk....kmmk.....",
    ".k......kk......",
    "................",
    "................",
    "................",
  ],
  // Fornax, the Furnace: generative models make new things
  generative: [
    "................",
    "........k.......",
    ".......kmk......",
    "......kmmk......",
    "......kmmmk.....",
    ".....kmmlmk.k...",
    "....kmmllmkkmk..",
    "....kmlllmmmk...",
    "...kmmlplllmk...",
    "...kmlpppllmk...",
    "...kmlppplmmk...",
    "...kmmlpplmk....",
    "....kmmllmmk....",
    ".....kmmmmk.....",
    "......kkkk......",
    "................",
  ],
  // Gemini, the Mirrors: two views of one thing (representation learning)
  representation: [
    "................",
    "................",
    "...k........k...",
    "..kpk......kpk..",
    "..kpk......kpk..",
    ".kplmk....kmlpk.",
    ".kplmk....kmlpk.",
    "kpplmmk..kmmlppk",
    ".kplmk....kmlpk.",
    ".kllmk....kmllk.",
    "..klk......klk..",
    "..kmk......kmk..",
    "...k........k...",
    "................",
    "................",
    "................",
  ],
  // Crystallus, the Lattice: structure (graphs, scenes) as a crystal block
  structure: [
    "................",
    ".......kk.......",
    ".....kkppkk.....",
    "...kkppppppkk...",
    ".kkppppppppppkk.",
    ".kmkkppppppkklk.",
    ".kmmmkkppkklllk.",
    ".kmmmmmkklllllk.",
    ".kmmmmmkklllllk.",
    ".kmmmmmkklllllk.",
    ".kmmmmmkklllllk.",
    ".kkmmmmkkllllkk.",
    "...kkmmkkllkk...",
    ".....kkkkkk.....",
    "................",
    "................",
  ],
  // Sagitta, the Arrow: decision — an agent aims and acts
  decision: [
    "................",
    "..........kkkkk.",
    "..........kpplk.",
    "...........kplk.",
    "..........kplmk.",
    ".........kplkmk.",
    "........kplk.k..",
    ".......kplk.....",
    "......kplk......",
    ".....kplk.......",
    ".k..kplk........",
    "kmkkplk.........",
    ".kmplk..........",
    "kmlmk...........",
    ".kmk............",
    "................",
  ],
};

export function emblem(family: string): Sprite | null {
  const rows = EMBLEM_ROWS[family];
  const ink = FAMILY_INK[family];
  if (!rows || !ink) return null;
  return sprite(rows, { k: INK.outline, m: ink.tint[0], l: ink.tint[1], p: ink.tint[2] });
}

/** Latin name + English gloss per family (the plaque's second line at region zoom). */
export const CONSTELLATION: Record<string, { latin: string; gloss: string }> = {
  perception: { latin: "Oculus", gloss: "the Eye" },
  sequence: { latin: "Serpens", gloss: "the Serpent" },
  generative: { latin: "Fornax", gloss: "the Furnace" },
  representation: { latin: "Gemini", gloss: "the Mirrors" },
  structure: { latin: "Crystallus", gloss: "the Lattice" },
  decision: { latin: "Sagitta", gloss: "the Arrow" },
};

/** A broken ring of radius r (art px) as offsets: four arcs, cut at the
 * diagonals (the selection mark), or every other pixel (dotted: hover). */
export function ringOffsets(r: number, style: "broken" | "dotted"): [number, number][] {
  const out: [number, number][] = [];
  const seen = new Set<string>();
  // midpoint circle, one octant mirrored eight ways
  let x = r, y = 0, err = 1 - r;
  const oct: [number, number][] = [];
  while (x >= y) {
    oct.push([x, y]);
    y++;
    if (err < 0) err += 2 * y + 1;
    else { x--; err += 2 * (y - x) + 1; }
  }
  for (const [a, b] of oct) {
    for (const [px, py] of [[a, b], [b, a], [-a, b], [-b, a], [a, -b], [b, -a], [-a, -b], [-b, -a]] as [number, number][]) {
      const k = `${px},${py}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const ang = Math.atan2(py, px);
      // distance (radians) to the nearest diagonal
      const toDiag = Math.abs(((ang - Math.PI / 4) % (Math.PI / 2) + Math.PI / 2) % (Math.PI / 2) - Math.PI / 4);
      if (style === "broken" && toDiag > Math.PI / 4 - 0.3) continue;
      out.push([px, py]);
    }
  }
  out.sort((p, q) => Math.atan2(p[1], p[0]) - Math.atan2(q[1], q[0]));
  return style === "dotted" ? out.filter((_, i) => i % 2 === 0) : out;
}
