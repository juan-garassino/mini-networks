// The Transit diagram's drafting of THIS zoo, and its adapter to the generic
// engine (system.ts). Families are lines; a line is a family's *service*: it
// calls at every model of the family and at every model built on one of them,
// so a model built on two families is an interchange of two lines. Like the
// periodic table's PLACEMENT (lib/blueprint.ts) the drawing is authored, not
// computed: station cells and line paths are drafted by hand on one grid, the
// districts sit where the painted maps put each family's land (Perception west,
// Representation north, Structure an island north-east, Sequence centre,
// Decision east, Generative south), so the maps' roads can borrow this topology.
//
// A model the drafting does not know yet is placed by the engine's fallback (a
// dashed spur off its line); only what even that cannot place is `unplaced`.
// To map another graph, replace this file: build a SystemSpec (DESIGN.md).
import type { TaxonomyResponse } from "../../lib/types.ts";
import { ATOMS, familyOf as blueprintFamily, symbolFor } from "../../lib/blueprint.ts";
import { LINE_NAMES, LINE_ORDER } from "./encoding.ts";
import { GRID, LINE_COLORS, SHEET } from "./tokens.ts";
import { buildSystem, type PathEntry, type Side, type SpecStation, type SystemLayout, type SystemSpec } from "./system.ts";

export const G = GRID.pitch;
/** Map extent in cells (the drafting sheet). */
export const COLS = 69;
export const ROWS = 40;

/** Authored station cells + label side (always the outside of the track). */
export const STATIONS: Record<string, { x: number; y: number; side: Side }> = {
  // Perception, the west side: one north–south trunk through classifier
  dino: { x: 10, y: 5, side: "w" },
  vit: { x: 10, y: 11, side: "w" },
  classifier: { x: 10, y: 17, side: "w" },
  mobilenet: { x: 10, y: 21, side: "w" },
  resnet: { x: 10, y: 25, side: "w" },
  convnext: { x: 10, y: 29, side: "w" },
  lora: { x: 13, y: 20, side: "ne" },
  detection: { x: 16, y: 23, side: "ne" },
  rpp_classifier: { x: 19, y: 26, side: "ne" },
  tabular_classifier: { x: 22, y: 29, side: "e" },
  segmentation: { x: 19, y: 17, side: "ne" },
  sam: { x: 19, y: 11, side: "n" },
  unet_ae: { x: 19, y: 21, side: "e" },
  audio_classifier: { x: 25, y: 17, side: "s" },
  audio_spectrogram: { x: 29, y: 17, side: "e" },
  audio_melspectrogram: { x: 29, y: 21, side: "e" },
  audio_transformer: { x: 29, y: 11, side: "n" },
  // Representation, the north rim
  simclr: { x: 22, y: 5, side: "s" },
  vision_embed: { x: 22, y: 2, side: "e" },
  clip: { x: 40, y: 5, side: "e" },
  // Sequence, the centre: transformer is the hub of the system
  transformer: { x: 40, y: 11, side: "ne" },
  rnn: { x: 37, y: 8, side: "w" },
  moe: { x: 46, y: 11, side: "s" },
  deepseek: { x: 52, y: 11, side: "s" },
  kimi: { x: 58, y: 11, side: "s" },
  mamba: { x: 64, y: 11, side: "s" },
  text_token_classifier: { x: 40, y: 15, side: "w" },
  text_seq2seq: { x: 40, y: 19, side: "w" },
  rag: { x: 40, y: 23, side: "w" },
  grokking: { x: 40, y: 27, side: "w" },
  text_diffusion: { x: 40, y: 33, side: "e" },
  // Decision, the east
  rlhf: { x: 56, y: 16, side: "n" },
  reinforce: { x: 62, y: 16, side: "e" },
  grpo: { x: 56, y: 20, side: "w" },
  dpo: { x: 56, y: 24, side: "w" },
  rl_maze: { x: 62, y: 20, side: "e" },
  alphazero: { x: 62, y: 24, side: "e" },
  // Structure, an island shuttle in the north-east (no cross-family edge)
  gnn: { x: 50, y: 4, side: "n" },
  nerf: { x: 58, y: 4, side: "n" },
  // Generative, the south
  tabular_diffusion: { x: 22, y: 33, side: "w" },
  vae: { x: 19, y: 37, side: "s" },
  gan: { x: 25, y: 37, side: "s" },
  diffusion: { x: 31, y: 37, side: "s" },
  pixelcnn: { x: 37, y: 37, side: "s" },
};

/** A line path: stations (by name) and bare corner cells, in riding order.
 * Every path starts at an origin (atom) or at a station nearer one, so a
 * train riding it travels the way models build on each other. */
export const ROUTES: Record<string, PathEntry[][]> = {
  perception: [
    ["classifier", "vit", "dino"],
    ["classifier", "mobilenet", "resnet", "convnext"],
    ["classifier", "segmentation", "audio_classifier", "audio_spectrogram"],
    ["segmentation", "sam"],
    ["segmentation", "unet_ae"],
    ["audio_spectrogram", "audio_transformer"],
    ["audio_spectrogram", "audio_melspectrogram"],
    ["classifier", "lora", "detection", "rpp_classifier", "tabular_classifier", "tabular_diffusion"],
  ],
  sequence: [
    ["transformer", "audio_transformer", "sam", "vit"],
    ["transformer", "moe", "deepseek", "kimi", "mamba"],
    ["transformer", "text_token_classifier", "text_seq2seq", "rag", "grokking", "text_diffusion"],
    ["transformer", "clip"],
    ["transformer", "rnn"],
    ["transformer", [45, 16], "rlhf"],
  ],
  representation: [
    ["simclr", "dino"],
    ["simclr", "clip"],
    ["simclr", "vision_embed"],
  ],
  structure: [["gnn", "nerf"]],
  decision: [
    ["reinforce", "rlhf", "grpo", "dpo"],
    ["reinforce", "rl_maze", "alphazero"],
  ],
  generative: [
    ["vae", "gan", "diffusion", "pixelcnn"],
    ["diffusion", [27, 33], "tabular_diffusion"],
    ["diffusion", [35, 33], "text_diffusion"],
  ],
};

/** Quiet area names: each district's name sits in its own land. */
export const DISTRICTS: { family: string; x: number; y: number; anchor: "start" | "middle" | "end" }[] = [
  { family: "perception", x: 10, y: 33.2, anchor: "middle" },
  { family: "representation", x: 31, y: 2.4, anchor: "middle" },
  { family: "structure", x: 54, y: 6.9, anchor: "middle" },
  { family: "sequence", x: 48, y: 22, anchor: "middle" },
  { family: "decision", x: 59, y: 27, anchor: "middle" },
  { family: "generative", x: 28, y: 39.6, anchor: "middle" },
];

/** The map's own cartouche (title + key), in the empty south-east (cells). */
export const CARTOUCHE = { x: 46, y: 28.5, w: 22.5, h: 11 };

export const labelOf = (name: string) => name.replace(/_/g, " ");

/** Family of any model: the blueprint placement, else its first parent's. */
export function makeFamilyOf(tax: TaxonomyResponse) {
  const byName = new Map(tax.models.map((m) => [m.name, m]));
  const memo = new Map<string, string>();
  const of = (name: string, seen: Set<string> = new Set()): string => {
    const hit = memo.get(name);
    if (hit) return hit;
    let f = blueprintFamily(name);
    if (!f) {
      const first = byName.get(name)?.builds_on[0];
      f = first && !seen.has(first) ? of(first, new Set([...seen, name])) : "structure";
    }
    memo.set(name, f);
    return f;
  };
  return of;
}

/** The zoo as a SystemSpec: lines = families, served lines from builds_on. */
export function zooSpec(tax: TaxonomyResponse): SystemSpec {
  const familyOf = makeFamilyOf(tax);
  const models = [...tax.models].sort((a, b) => a.name.localeCompare(b.name));
  const stations: SpecStation[] = models.map((m) => ({
    id: m.name,
    label: labelOf(m.name),
    lines: [...new Set([familyOf(m.name), ...m.builds_on.map((p) => familyOf(p))])],
    origin: !!ATOMS[m.name] || m.level === "elementary",
    symbol: symbolFor(m.name),
    parents: m.builds_on,
    at: STATIONS[m.name],
  }));
  return {
    cols: COLS, rows: ROWS,
    lines: LINE_ORDER.map((id) => ({ id, name: LINE_NAMES[id], color: LINE_COLORS[id] ?? SHEET.unknownLine })),
    stations, routes: ROUTES,
    areas: DISTRICTS.map((d) => ({ id: d.family, name: LINE_NAMES[d.family], x: d.x, y: d.y, anchor: d.anchor })),
    reserved: [{ id: "cartouche", ...CARTOUCHE }],
  };
}

export const buildMetro = (tax: TaxonomyResponse): SystemLayout => buildSystem(zooSpec(tax));
