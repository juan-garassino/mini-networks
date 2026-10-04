// Skin D · Kawaii DFD — tokens. A data-flow sheet: white paper, one ink for every
// line and word, colour only in the family header strips (soft pastels, never text)
// and in the one selection accent that lights a lineage.
export const SHEET = "#FCFCFA";      // the paper
export const INK = "#2E2742";        // every edge, outline and word
export const INK_SOFT = "#5D5672";   // secondary text (≥ 6:1 on SHEET)
export const RULE = "#E4E1EA";       // swim-lane rules
export const HEAD = "#8A84A0";       // column headers (Atoms / Gen n) — large enough to stay legible
export const ACCENT = "#2F5FD0";     // the one accent: selection, lit lineage, pipeline order
export const GOLD = "#E2A322";       // champion mark

// One family = a soft pastel strip, a slightly deeper creature fill and a deep tone
// (packets riding out of that family). Pastels are fills only, never text colours.
export const FAMILY: Record<string, { strip: string; body: string; deep: string; label: string; kind: string }> = {
  perception:     { strip: "#D5EEE1", body: "#A5DCC2", deep: "#3E9C78", label: "Perception",     kind: "eyeballs" },
  sequence:       { strip: "#DAE6F7", body: "#AECAEF", deep: "#4A7FC4", label: "Sequence",       kind: "caterpillars" },
  generative:     { strip: "#F8E2D3", body: "#F2BE9F", deep: "#CC6C3A", label: "Generative",     kind: "eggs" },
  representation: { strip: "#E7E0F7", body: "#C7B8EF", deep: "#7A62CF", label: "Representation", kind: "mirror twins" },
  structure:      { strip: "#F3EBC6", body: "#E8D488", deep: "#A9840F", label: "Structure",      kind: "crystals" },
  decision:       { strip: "#F6DCE7", body: "#EEB2CC", deep: "#C04F86", label: "Decision",       kind: "dice bots" },
};
export const UNKNOWN_FAMILY = { strip: "#ECE9F2", body: "#D2CDE0", deep: "#7D7896", label: "Other", kind: "newcomers" };
export const fam = (f: string) => FAMILY[f] ?? UNKNOWN_FAMILY;
