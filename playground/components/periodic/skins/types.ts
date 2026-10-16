// The skin contract: everything a periodic-table skin may change. One table
// structure (components/periodic/*), N token sets (one file per skin beside
// this one). Components never read a skin's literals; they read the CSS custom
// properties skinVars() derives from these tokens, plus `motion` + `masthead`.

export type FamilyId =
  | "perception" | "sequence" | "generative" | "representation" | "structure" | "decision";

/** A next/font CSS variable loaded in app/layout.tsx, e.g. "--font-vt". */
export type FontVar = `--font-${string}`;

export interface PeriodicSkin {
  id: string;
  /** Shown in the edition switch and the design gallery. */
  label: string;

  /** The app-wide colour tokens (globals.css names) — chrome reads them too. */
  color: {
    paper: string;      // the sheet
    paperDeep: string;  // fields, tile fill under-colour
    ink: string;        // primary text
    inkDim: string;     // annotation text
    line: string;       // atom borders, rules
    lineFaint: string;  // compound borders, hairlines, grid
    accent: string;     // hover, focus, reaction numbers, the live cursor
  };
  /** Per-family tile tint; null = a single-ink skin (no family colour). */
  family: Record<FamilyId, string> | null;

  type: {
    display: FontVar;   // masthead, symbols, family heads, chrome titles
    body: FontVar;      // numbers, the key
    /** The tile symbol's face: its l must never read as an I ("Ml", not "MI"). */
    symbol: FontVar;
    /** Tile names, set as words (≥ 11 px rendered; a narrow face keeps 12 letters on a line). */
    name: FontVar;
    /** Faces with one weight (Instrument Serif, VT323): never synthesise bold. */
    singleWeight: boolean;
    titleTracking: string;            // family heads, key title, f-block label, tabs
    size: {
      title: string;                  // masthead h1 at desktop
      symbolAtom: string;
      symbolCompound: string;
      symbolReaction: string;
      number: string;                 // atomic number / ✻n
      famhead: string;                // family head labels
      name: string;                   // the tile's model name (never below the 11-px floor)
      nameLeading: string;            // its line height (names wrap on words, never truncate)
      nameReaction: string;           // a reaction's name (up to three lines in the f-block row)
      small: string;                  // key, counts labels, subtitle, f-block note
    };
  };

  space: {
    row: string;         // table row height (one generation)
    reactionRow: string; // f-block row height
    stackCell: string;   // tile width in the narrow-screen family stack
    gap: string;         // between tiles
    tilePad: string;     // inside a tile
    tabs: string;        // the sheet tab row's height (Chart / Reactions / Observatory)
  };

  border: {
    atom: string;        // shorthand, e.g. "1.5px solid var(--line)"
    compound: string;
    reaction: string;
    famRule: string;     // under a family head; "0" for none
    famBand: string;     // family-colour band height under a head; "0px" for none
  };
  /** How a family head is set: where its hairline runs (a bracket under it, or a rule above) and
   * the air between neighbouring heads. Heads are family names, never numbered, in every
   * skin (a numeral marks a sequence, and the families are not one). */
  famhead: { rule: "below" | "above"; gap: string };
  /** How much of the tile tint a level prints, over `fillUnder`. */
  fill: { atom: string; compound: string; reaction: string; under: string };
  /** Compound symbols: dimmer than atoms in single-ink skins. */
  compoundSymbol: string;
  radius: { tile: string };
  shadow: { tile: string };

  /** Page backdrop behind the framed sheet. */
  backdrop: { image: string; size: string; grain: number };
  /** Hover/focus: "accent" recolours a tile; "inverse" = terminal inverse video. */
  interaction: "accent" | "inverse";
  /** Shared chrome adjustments for faces that run small (VT323): the spec-sheet
   * drawer's zoom, and the edition stamp's tilt. */
  chrome: { drawerZoom: number; stampTilt: string };

  /** The loading surface's one status line, in the skin's voice (lib/lab-contract.ts
   * LOADING): while the zoo's API is answering, and when it is not. */
  voice: { loading: string; offline: string };

  motion: {
    enter: number;          // s, one tile's fade-in
    rowStagger: number;     // s per generation row
    colStagger: number;     // s per column
    reactionStart: number;  // s before the f-block starts
    reactionStagger: number;
  };

  /** "title" = a drawing's masthead; "prompt" = a shell command + output. */
  masthead: "title" | "prompt";
}
