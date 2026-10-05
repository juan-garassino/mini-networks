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
    body: FontVar;      // numbers, names, the key
    /** Faces with one weight (Instrument Serif, VT323): never synthesise bold. */
    singleWeight: boolean;
    /** Symbols, masthead, family heads: "uppercase" = drafting caps (CV); "none" = as written (Cv). */
    textCase: "uppercase" | "none";
    titleTracking: string;            // .bp-title letter-spacing
    size: {
      title: string;                  // masthead h1 at desktop
      symbolAtom: string;
      symbolCompound: string;
      symbolReaction: string;
      number: string;                 // atomic number / ✻n
      famhead: string;                // family head labels
      name: string;                   // cap on the tile's model name
      /** Name fit: 100 / (glyph advance in em × 12 letters), so a 12-letter
       * word fits one tile line (Martian Mono ≈ 12cqi, VT323 ≈ 17cqi). */
      nameFit: string;
      small: string;                  // key, counts labels, subtitle, f-block note
    };
  };

  space: {
    row: string;         // table row height (one generation)
    reactionRow: string; // f-block row height
    stackCell: string;   // tile width in the narrow-screen family stack
    gap: string;         // between tiles
    tilePad: string;     // inside a tile
  };

  border: {
    atom: string;        // shorthand, e.g. "1.5px solid var(--line)"
    compound: string;
    reaction: string;
    famRule: string;     // under a family head; "0" for none
    famBand: string;     // family-colour band height under a head; "0px" for none
  };
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
  /** Shared chrome adjustments for faces that run small (VT323). */
  chrome: { zoom: number; drawerZoom: number; stampTilt: string };

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
