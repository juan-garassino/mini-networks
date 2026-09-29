// Skin D tokens. Text is always plum on light — pastels are fills only.
export const INK = "#3B2E5A";        // plum ink: every outline and every word
export const INK_SOFT = "#5E4F80";   // secondary text (≥5:1 on PAPER)
export const PAPER = "#F3F0FF";      // lilac grid paper
export const DOT = "#D6CCF4";        // grid dots (one per half row pitch)
export const CARD = "#FFFFFF";
export const GOLD = "#F6BE3B";       // champion medal
export const SWEAT = "#7FB7FF";      // provisional sweat drop

// One pastel per family (brief palette, unchanged: all pass as fills under
// plum text/outlines; none is ever used as a text colour).
export const FAMILY: Record<string, { fill: string; deep: string; label: string; kind: string }> = {
  perception:     { fill: "#8FE3C0", deep: "#3E9C78", label: "Perception",     kind: "eyeballs" },
  sequence:       { fill: "#9CC9FF", deep: "#4A83C9", label: "Sequence",       kind: "token caterpillars" },
  generative:     { fill: "#FFB38A", deep: "#D06E3B", label: "Generative",     kind: "egg clouds" },
  representation: { fill: "#C6B2FF", deep: "#7D62D6", label: "Representation", kind: "mirror twins" },
  structure:      { fill: "#FFE27A", deep: "#C29A12", label: "Structure",      kind: "crystals" },
  decision:       { fill: "#FF9CCB", deep: "#CC4F8C", label: "Decision",       kind: "dice bots" },
};
export const UNKNOWN_FAMILY = { fill: "#E4DEF7", deep: "#8B80A8", label: "Other", kind: "newcomers" };
export const fam = (f: string) => FAMILY[f] ?? UNKNOWN_FAMILY;

// The one accent: focus, the lineage route, the ferry sail, Try it.
export const ACCENT = "#D6336C";

/** Opaque mix of two #rrggbb colours (t = 0 → a, 1 → b). */
export function hexMix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const x = p(a), y = p(b);
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}
