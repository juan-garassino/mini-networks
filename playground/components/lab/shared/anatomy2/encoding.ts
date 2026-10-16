// Every mark the diagram kit draws, the primitive that draws it, the theme
// token it paints with, and what it means — in the library's one shape
// (lib/encoding.ts). STYLE.md §2 is the long form; this table is the contract
// a new diagram (for any system) is checked against.
import type { Theme } from "./themes";
import { defineEncoding, type MarkSpec } from "../../../../lib/encoding.ts";

/** A kit mark: always names its primitive and a real theme token. */
type KitMark = MarkSpec & { prim: string; token: keyof Theme };

export const ENCODING = defineEncoding({
  "dotted wire": { prim: "Wire step=2", token: "wire", encodes: "data or routing moving between parts" },
  "solid wire": { prim: "Wire step=1", token: "accentLo", encodes: "the spine between the system's own blocks" },
  "hot wire": { prim: "Wire", token: "wireHot", encodes: "the live state, the selected path, or the one idea this system introduces" },
  "loss wire": { prim: "Wire step=3", token: "loss", encodes: "the error signal flowing back" },
  thumbnail: { prim: "Thumb", token: "ramp", encodes: "an n×n field of values −1..1 (image, map, kernel)" },
  "heat thumbnail": { prim: "Thumb heat", token: "heat", encodes: "a field of weights 0..1 (attention, similarity)" },
  "bar stack": { prim: "Bars", token: "accent", encodes: "one layer: bar count = width, bar height = resolution" },
  "dim bar stack": { prim: "Bars dim", token: "accentLo", encodes: "an inherited layer kept as context" },
  outline: { prim: "Frame", token: "frame", encodes: "a panel or group" },
  "hot outline": { prim: "Frame", token: "wireHot", encodes: "the one selected item (one per drawing)", kind: "interaction" },
  "wrong outline": { prim: "Frame", token: "loss", encodes: "a wrong pick" },
  diamond: { prim: "Diamond", token: "loss", encodes: "the objective, with its name and value under it" },
  "ring node": { prim: "Node", token: "frame", encodes: "an operation joining two wires (− + z); hot when introduced" },
  label: { prim: "PText", token: "text", encodes: "the name of a thing" },
  note: { prim: "PText", token: "textDim", encodes: "explanation, provenance, legend", kind: "chrome" },
  caveat: { prim: "PText", token: "loss", encodes: "an honesty note that changes how to read the numbers", kind: "chrome" },
} satisfies Record<string, KitMark>);
