// The models each screenshot state focuses — must match FOCUS in
// scripts/shoot.mjs. Chosen to stress the layout: transformer is the biggest
// hub (13 children), clip sits on a cross-family bridge, classifier's region
// is the densest (15 models).
export const SHOT_FOCUS = {
  region: "transformer",
  node: "clip",
  dense: "classifier",
} as const;
