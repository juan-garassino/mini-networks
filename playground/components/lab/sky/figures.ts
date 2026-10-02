// The constellation figures and the star glyphs of the Celestial Zoo.
//
// Each family's figure is a few engraving strokes in a UNIT box (0..1 × 0..1),
// mapped onto the family's region box by the skin. Lines only — the figure is
// drawn through the stars, the way an atlas threads a bear through Ursa Major.

export interface Figure {
  /** SVG path data in unit coordinates */
  strokes: string[];
  /** where the family's name sits, unit coordinates */
  label: { x: number; y: number };
}

export const FIGURES: Record<string, Figure> = {
  // an eye: the almond lid, the iris, the pupil, three lashes
  perception: {
    strokes: [
      "M0.08 0.5 Q0.5 0.08 0.92 0.5 Q0.5 0.92 0.08 0.5 Z",
      "M0.5 0.26 A0.24 0.24 0 1 0 0.5 0.74 A0.24 0.24 0 1 0 0.5 0.26 Z",
      "M0.5 0.4 A0.1 0.1 0 1 0 0.5 0.6 A0.1 0.1 0 1 0 0.5 0.4 Z",
      "M0.3 0.2 L0.24 0.08 M0.5 0.14 L0.5 0.02 M0.7 0.2 L0.76 0.08",
    ],
    label: { x: 0.5, y: 0.98 },
  },
  // a serpent: a long S through the land, a head with an open jaw, a forked tongue
  sequence: {
    strokes: [
      "M0.04 0.78 C0.2 0.3 0.4 0.3 0.5 0.55 C0.6 0.8 0.78 0.8 0.86 0.42",
      "M0.86 0.42 C0.9 0.3 0.98 0.3 0.98 0.4 C0.98 0.48 0.92 0.5 0.86 0.46",
      "M0.98 0.4 L1.04 0.36 M1.0 0.4 L1.05 0.42",
      "M0.2 0.5 C0.26 0.44 0.3 0.44 0.34 0.5 M0.56 0.68 C0.6 0.62 0.66 0.62 0.7 0.68",
    ],
    label: { x: 0.5, y: 0.98 },
  },
  // a phoenix-flame: three tongues of fire rising from a crucible
  generative: {
    strokes: [
      "M0.3 0.92 L0.7 0.92 L0.64 0.74 L0.36 0.74 Z",
      "M0.5 0.74 C0.3 0.6 0.36 0.4 0.5 0.1 C0.64 0.4 0.7 0.6 0.5 0.74 Z",
      "M0.42 0.72 C0.3 0.6 0.26 0.5 0.3 0.34 C0.36 0.48 0.4 0.56 0.42 0.72",
      "M0.58 0.72 C0.7 0.6 0.74 0.5 0.7 0.34 C0.64 0.48 0.6 0.56 0.58 0.72",
    ],
    label: { x: 0.5, y: 0.98 },
  },
  // twin mirrors: two facing arcs with a shared axis, like a reflected pair
  representation: {
    strokes: [
      "M0.46 0.1 C0.16 0.2 0.16 0.8 0.46 0.9",
      "M0.54 0.1 C0.84 0.2 0.84 0.8 0.54 0.9",
      "M0.5 0.06 L0.5 0.94",
      "M0.3 0.5 L0.42 0.5 M0.58 0.5 L0.7 0.5",
    ],
    label: { x: 0.5, y: 0.98 },
  },
  // a crystal lattice: a hexagon with its three diagonals
  structure: {
    strokes: [
      "M0.5 0.06 L0.9 0.28 L0.9 0.72 L0.5 0.94 L0.1 0.72 L0.1 0.28 Z",
      "M0.5 0.06 L0.5 0.94 M0.1 0.28 L0.9 0.72 M0.9 0.28 L0.1 0.72",
      "M0.5 0.5 m-0.08 0 a0.08 0.08 0 1 0 0.16 0 a0.08 0.08 0 1 0 -0.16 0",
    ],
    label: { x: 0.5, y: 0.98 },
  },
  // a bow and arrow: the drawn bow, its string, the arrow in flight
  decision: {
    strokes: [
      "M0.3 0.08 C0.84 0.3 0.84 0.7 0.3 0.92",
      "M0.3 0.08 L0.3 0.92",
      "M0.3 0.5 L0.9 0.5 M0.9 0.5 L0.82 0.44 M0.9 0.5 L0.82 0.56",
      "M0.3 0.5 L0.22 0.44 M0.3 0.5 L0.22 0.56",
    ],
    label: { x: 0.5, y: 0.98 },
  },
};

export const CONSTELLATION_NAME: Record<string, string> = {
  perception: "Oculus · the Eye",
  sequence: "Serpens · the Serpent",
  generative: "Fornax · the Furnace",
  representation: "Gemini · the Mirrors",
  structure: "Crystallus · the Lattice",
  decision: "Sagitta · the Arrow",
};

/** An n-ray star outline centred at 0,0 with outer radius r and inner radius r·k. */
export function starPath(n: number, r: number, k = 0.42): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI / n) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * k;
    pts.push(`${(Math.cos(a) * rr).toFixed(2)},${(Math.sin(a) * rr).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

/** Deterministic field stars (the faint background sky), unit coordinates. */
export function fieldStars(count: number, seed = 3): { x: number; y: number; r: number; a: number }[] {
  let s = seed >>> 0 || 1;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const out = [];
  for (let i = 0; i < count; i++) out.push({ x: rnd(), y: rnd(), r: 0.4 + rnd() * rnd() * 1.4, a: 0.25 + rnd() * 0.6 });
  return out;
}
