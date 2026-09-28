// Paper art — colour ramps and the key light.
//
// Every material is a 5-step ramp [hi, lit, mid, shade, deep]. Ramps are
// hue-shifted: highlights lean warm (toward yellow), shades lean cool (toward
// violet/blue), so a lit face and its shaded twin never read as "same colour,
// darker". Saturated primaries + warm sand, not pastel (ref-paper.md).
//
// ONE key light for every asset: top-left. So
//   - faces turned left / up  → `lit` (the hi step on the very edge)
//   - faces turned right      → `shade`
//   - undersides / creases    → `deep`
//   - cast shadows fall DOWN-RIGHT, contact shadows sit under the base.

export type Ramp = readonly [hi: string, lit: string, mid: string, shade: string, deep: string];

export const R = {
  red:    ["#FF9B78", "#F4573F", "#D93D33", "#A82B3E", "#6E1F37"],
  orange: ["#FFCB85", "#FF9E3D", "#EC7B28", "#BA5530", "#7E3528"],
  gold:   ["#FFEB94", "#FFCB2E", "#F2A51A", "#C27716", "#834C17"],
  sand:   ["#FFF0B8", "#F7D98A", "#E8BF62", "#C79450", "#92653F"],
  grass:  ["#C4EE72", "#86D04A", "#5CB33C", "#3B8C40", "#23623D"],
  leaf:   ["#96E063", "#52B84A", "#35983F", "#237545", "#164F40"],
  pine:   ["#6CC98A", "#2E9E6A", "#1F7F5C", "#175F55", "#10404A"],
  teal:   ["#9AF2DD", "#42D2B6", "#22AE9B", "#198284", "#135A68"],
  blue:   ["#A6D6FF", "#5CAAFF", "#2F80EA", "#1F5EC6", "#1B3F90"],
  sea:    ["#5AA8F4", "#2E7FE8", "#1E62D9", "#1749B2", "#133684"],
  violet: ["#DCC2FF", "#AE82F4", "#8C5ADB", "#6A3DB4", "#462A82"],
  pink:   ["#FFC7DE", "#FF8BBA", "#EF5C9B", "#C2407E", "#852F62"],
  lime:   ["#EEF78E", "#CBE35A", "#A7C83C", "#7C9E31", "#52702C"],
  cream:  ["#FFFBEF", "#F5EAD0", "#E2D0A8", "#BBA37D", "#85715A"],
  rock:   ["#D2D7E0", "#A9AFBD", "#838A9B", "#5E6478", "#3D4156"],
  basalt: ["#8B8C9E", "#63647A", "#4A4B61", "#35354B", "#232336"],
  wood:   ["#E8B372", "#CB8546", "#A66531", "#7C4527", "#52301F"],
  snow:   ["#FFFFFF", "#F5FAFF", "#DCE9F7", "#B7CAE3", "#8EA3C4"],
  lava:   ["#FFF3A0", "#FFC23B", "#FF7A2A", "#E0452C", "#A52A2E"],
  knit:   ["#FFB0A0", "#F57A6C", "#DD5A55", "#B04150", "#7A2E45"],
} as const satisfies Record<string, Ramp>;

export type RampName = keyof typeof R;
export const HI = 0, LIT = 1, MID = 2, SHADE = 3, DEEP = 4;

/** Neutral paper materials shared by every asset. */
export const P = {
  die: "#FFFDF7",          // die-cut rim, lit
  dieShade: "#E7DDC9",     // rim on the shaded (bottom-right) side
  card: "#D9C39A",         // cardboard side face
  cardDeep: "#B49A6E",     // corrugation valleys
  ink: "#2B2118",
  inkSoft: "#5A4B3C",
  window: "#2E3560",       // dark window glass
  windowLit: "#FFE27A",    // a lit window / lamp
  shadow: "#2A1F3D",       // cast-shadow tint (cool violet-brown, used translucent)
  pencil: "#7A6E62",
  paper: "#F3EEE3",        // specimen ground
} as const;

/** Family → signature ramp (set-pieces, biome accents, sign boards). The map's
 *  low-chroma land stays the builder's; these are the saturated art accents. */
export const FAMILY_RAMP: Record<string, RampName> = {
  perception: "red",        // lighthouse: red/cream bands
  sequence: "orange",       // clock tower: brick + gold clock
  generative: "violet",     // kiln volcano: violet sample puffs
  representation: "teal",   // twin mirror towers
  structure: "pink",        // crystal lattice
  decision: "lime",         // dice keep banners
};
export const familyRamp = (f: string): Ramp => R[FAMILY_RAMP[f] ?? "cream"];

/** Key light: unit vector pointing FROM the light (top-left) toward the scene. */
export const LIGHT = { x: 0.62, y: 0.78 } as const;

/** Ground cast shadow: a stand-up's silhouette (base at y = 0, up negative)
 *  laid on the ground, falling down-right. x' = x − 0.5·y, y' = −0.18·y. */
export const CAST = "matrix(1 0 -0.5 -0.18 0 0)";
