// Every mark the diagram kit draws, the primitive that draws it, the theme
// token it paints with, and what it means. STYLE.md §2 is the long form;
// this table is the contract a new diagram (for any system) is checked against.
import type { Theme } from "./themes";

export interface Mark { mark: string; prim: string; token: keyof Theme; means: string }

export const ENCODING: readonly Mark[] = [
  { mark: "dotted wire", prim: "Wire step=2", token: "wire", means: "data or routing moving between parts" },
  { mark: "solid wire", prim: "Wire step=1", token: "accentLo", means: "the spine between the system's own blocks" },
  { mark: "hot wire", prim: "Wire", token: "wireHot", means: "the live state, the selected path, or the one idea this system introduces" },
  { mark: "loss wire", prim: "Wire step=3", token: "loss", means: "the error signal flowing back" },
  { mark: "thumbnail", prim: "Thumb", token: "ramp", means: "an n×n field of values −1..1 (image, map, kernel)" },
  { mark: "heat thumbnail", prim: "Thumb heat", token: "heat", means: "a field of weights 0..1 (attention, similarity)" },
  { mark: "bar stack", prim: "Bars", token: "accent", means: "one layer: bar count = width, bar height = resolution" },
  { mark: "dim bar stack", prim: "Bars dim", token: "accentLo", means: "an inherited layer kept as context" },
  { mark: "outline", prim: "Frame", token: "frame", means: "a panel or group" },
  { mark: "hot outline", prim: "Frame", token: "wireHot", means: "the one selected item (one per drawing)" },
  { mark: "wrong outline", prim: "Frame", token: "loss", means: "a wrong pick" },
  { mark: "diamond", prim: "Diamond", token: "loss", means: "the objective, with its name and value under it" },
  { mark: "ring node", prim: "Node", token: "frame", means: "an operation joining two wires (− + z); hot when introduced" },
  { mark: "label", prim: "PText", token: "text", means: "the name of a thing" },
  { mark: "note", prim: "PText", token: "textDim", means: "explanation, provenance, legend" },
  { mark: "caveat", prim: "PText", token: "loss", means: "an honesty note that changes how to read the numbers" },
];
