// How the specimen page shelves the registry: plain-word groups in reading
// order. This is navigation, not taxonomy — the source of truth for what a
// model builds on is core/taxonomy.py. Any registry name missing here lands
// in a trailing "more" group, so a new diagram is never hidden.
import { DIAGRAM_NAMES } from "../registry";

export interface Group { label: string; models: string[] }

const SHELVES: Group[] = [
  { label: "images", models: ["classifier", "resnet", "mobilenet", "convnext", "vit", "detection", "sam", "segmentation", "unet_ae"] },
  { label: "making new things", models: ["diffusion", "vae", "gan", "pixelcnn", "tabular_diffusion", "text_diffusion", "nerf"] },
  { label: "language", models: ["transformer", "rnn", "mamba", "moe", "kimi", "deepseek", "grokking", "text_token_classifier", "text_seq2seq", "lora", "rag"] },
  { label: "matching pairs", models: ["clip", "simclr", "dino", "vision_embed"] },
  { label: "sound", models: ["audio_classifier", "audio_spectrogram", "audio_melspectrogram", "audio_transformer"] },
  { label: "tables and graphs", models: ["tabular_classifier", "gnn", "rpp_classifier"] },
  { label: "agents and alignment", models: ["rl_maze", "reinforce", "alphazero", "rlhf", "grpo", "dpo"] },
];

export function shelves(names: readonly string[] = DIAGRAM_NAMES): Group[] {
  const known = new Set(names);
  const out = SHELVES.map((g) => ({ ...g, models: g.models.filter((m) => known.has(m)) })).filter((g) => g.models.length);
  const placed = new Set(out.flatMap((g) => g.models));
  const rest = names.filter((n) => !placed.has(n));
  return rest.length ? [...out, { label: "more", models: rest }] : out;
}

/** Every model in shelf order (prev / next walk this). */
export function readingOrder(groups: Group[]): string[] {
  return groups.flatMap((g) => g.models);
}
