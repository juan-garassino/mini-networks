// The learner's avatar in every skin: the one-eyed perceptron blob (original
// character from the v1 paper edition — no third-party IP). Geometry only, in
// a 120×140 box; each skin draws it in its own medium (paper cutout, 16×16
// sprite, …) but keeps this silhouette so the cast stays one character.
export const CRITTER = {
  viewBox: "0 0 120 140",
  body: "M60 28 C89 26 103 50 101 78 C99 104 83 118 60 118 C37 118 21 104 19 78 C17 50 31 30 60 28 Z",
  antenna: "M60 30 C58 22 63 18 61 12",
  antennaTip: { cx: 62, cy: 11, r: 9 },          // wears Σ — the perceptron's sum
  eye: { cx: 60, cy: 72, r: 16 },
  pupil: { cx: 63, cy: 74, r: 6 },
  smile: "M52 96 Q60 102 68 96",
  feet: [{ cx: 46, cy: 122 }, { cx: 74, cy: 122 }],
  // Walk speed along a road, in world px per second (camera-independent).
  walkSpeed: 180,
} as const;
