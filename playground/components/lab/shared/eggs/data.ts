// Easter-egg content (pure data). Every egg is grounded in real model
// behaviour or real repo history — see README.md for triggers and sources.

// ── grokking clicks late ─────────────────────────────────────────────────
// Power et al. (arXiv 2201.02177), as summarised in models/grokking/model.py:
// train accuracy hits 100% early; accuracy on held-out pairs sits at chance
// for far longer, then jumps. The egg makes the learner wait too.
export const GROKKING_EGG = {
  model: "grokking",
  /** hover / keyboard focus this long before it "clicks" (useLongFocus) */
  holdMs: 4000,
  before: "memorising… 100% on the practice pairs, still guessing on new ones",
  after: "oh — I get it now: it divides pairs it has never seen",
  explain:
    "Grokking: the network memorises its training examples quickly, but only generalises much later — suddenly, after long training with a pull toward small weights. You just waited for it, too.",
  /**
   * Shape of the two curves in the paper — an illustration, NOT a zoo run.
   * x: training progress 0..1 (log-like), y: accuracy 0..1.
   */
  sketch: {
    note: "illustrative shape from the grokking paper, not a measured run",
    train: [[0, 0.02], [0.08, 0.5], [0.16, 0.97], [0.3, 1], [0.6, 1], [0.8, 1], [1, 1]] as [number, number][],
    val: [[0, 0.01], [0.16, 0.02], [0.3, 0.02], [0.6, 0.04], [0.72, 0.35], [0.8, 0.95], [1, 1]] as [number, number][],
  },
} as const;

// ── the hidden "?" island: next-era models ───────────────────────────────
// From the repo's "remaining (next era)" list; each sits beside the species
// it would grow from. Not in the taxonomy yet — silhouettes only.
export interface NextEraModel {
  id: string;
  name: string;
  /** the zoo species it would build on (for placement near its parent family) */
  buildsOn: string;
  teaser: string;
}

export const NEXT_ERA: NextEraModel[] = [
  {
    id: "vq_vae",
    name: "VQ-VAE",
    buildsOn: "vae",
    teaser: "A VAE whose code is a handful of words from a learned codebook — pictures a transformer could write.",
  },
  {
    id: "flow_matching",
    name: "Flow matching",
    buildsOn: "diffusion",
    teaser: "Diffusion's straighter cousin: learn a velocity that carries noise to data along near-straight paths, in far fewer steps.",
  },
  {
    id: "gated_pixelcnn",
    name: "Gated PixelCNN",
    buildsOn: "pixelcnn",
    teaser: "PixelCNN with separate vertical and horizontal stacks to fix its blind spot, plus gates that choose what passes.",
  },
];

export const NEXT_ERA_COPY = {
  island: "?",
  warning: "here be dragons",
  caption: "Not yet charted — the next era of the zoo.",
} as const;

// ── ruins: retired models from legacy/ ───────────────────────────────────
// One entry per legacy/ project (the numbered 0NN-* folders are empty
// placeholders of the same lineage). Epitaphs are grounded in what each
// folder actually holds. `successor` = the living species that replaced it.
export interface Ruin {
  id: string;
  /** the retired package / script name */
  name: string;
  /** repo path */
  path: string;
  epitaph: string;
  successor: string | null;
}

export const RUINS: Ruin[] = [
  {
    id: "minigan",
    name: "miniGan",
    path: "legacy/adversarial",
    epitaph: "The first forger of the zoo. Its README still politely asks to be documented.",
    successor: "gan",
  },
  {
    id: "minivisualinguist",
    name: "miniVisuaLinguist",
    path: "legacy/clip",
    epitaph: "Taught pictures and words to agree, back when they rarely did.",
    successor: "clip",
  },
  {
    id: "minidiffusion",
    name: "miniDiffusion",
    path: "legacy/diffusion",
    epitaph: "Returned to static. Its noise lives on, one step at a time.",
    successor: "diffusion",
  },
  {
    id: "miniguidediff",
    name: "miniGuideDiff",
    path: "legacy/guided-diffusion",
    epitaph: "Guided others through the noise; now a guide is just a composition away.",
    successor: "classifier_guided_diffusion",
  },
  {
    id: "minilora",
    name: "miniLora",
    path: "legacy/lora",
    epitaph: "Launched by a shell script, remembered as a small change with lasting effect.",
    successor: "lora",
  },
  {
    id: "minireinforcedmaze",
    name: "miniReinforcedMaze",
    path: "legacy/maze-rl",
    epitaph: "Left two animated mazes from August 2024. They are still moving.",
    successor: "rl_maze",
  },
  {
    id: "minisegmentation",
    name: "miniSegmentation",
    path: "legacy/segmentation",
    epitaph: "Drew the first masks and kept its raw data close. Retired with clean edges.",
    successor: "segmentation",
  },
  {
    id: "minisequencerememberer",
    name: "miniSequenceRememberer",
    path: "legacy/sequence-memory",
    epitaph: "It remembered sequences. We remember it.",
    successor: "rnn",
  },
  {
    id: "minitransformer",
    name: "miniTransformer",
    path: "legacy/transformer",
    epitaph: "Plotted its own attention weights. Attention, it turned out, was most of what we needed.",
    successor: "transformer",
  },
  {
    id: "minimoe",
    name: "miniMoE",
    path: "legacy/transformer-moe",
    epitaph: "Two drafts of a mixture of experts. The experts eventually agreed on one.",
    successor: "moe",
  },
  {
    id: "minimoerl",
    name: "miniMoERLHF & miniMoEGRPO",
    path: "legacy/transformer-gptrl",
    epitaph: "Where PPO and GRPO first shared a workbench, three scripts wide.",
    successor: "grpo",
  },
  {
    id: "miniautoregressivediffusion",
    name: "miniAutoregressiveDiffusion",
    path: "legacy/autoregressive-diff",
    epitaph: "Tried to denoise and to write in order at the same time. A bold idea, resting.",
    successor: "text_diffusion",
  },
  {
    id: "minirag",
    name: "miniRAG",
    path: "legacy/rag",
    epitaph: "Borrowed a pretrained voice to speak. Its heir builds its own search and its own voice.",
    successor: "rag",
  },
  {
    id: "nano-everything",
    name: "nano_moe_flashattention_mamba_bpe_grpo.py",
    path: "legacy/nano_moe_flashattention_mamba_bpe_grpo.py",
    epitaph: "Five ideas in one 773 KB file. The zoo gave each its own home.",
    successor: "mamba",
  },
  {
    id: "unet-to-yolo",
    name: "lecture_unet_to_yolo_byme.py",
    path: "legacy/lecture_unet_to_yolo_byme.py",
    epitaph: "A lecture's road from U-Net to YOLO, now two neighbouring species.",
    successor: "detection",
  },
  {
    id: "distil-clip-multimodal",
    name: "distilation_and_clip_and_multimodal.py",
    path: "legacy/distilation_and_clip_and_multimodal.py",
    epitaph: "Distillation, CLIP and multimodal in a single scroll — spelled with one l, remembered with two.",
    successor: "diffusion_distillation",
  },
];

// ── double_descent's ferry route dips twice ──────────────────────────────
// compositions/double_descent.py: sweep MLP width on label-noised MNIST —
// test error falls, RISES at the interpolation threshold (just enough
// capacity to memorise the noisy labels), then falls again.
export const DOUBLE_DESCENT_EGG = {
  composition: "double_descent",
  caption: "Test error falls, rises where the network can just memorise the noise, then falls again.",
  explain:
    "Double descent: the classic U-shaped curve is only the first half. Past the point where a model can exactly fit its noisy training labels, making it even bigger helps again.",
  /** where the bump (the interpolation threshold) sits along the route, 0..1 */
  peakAt: 0.5,
  /** illustrative test-error profile along the route (0..1 → 0..1); not a run */
  profile: [0.9, 0.55, 0.35, 0.55, 0.85, 0.6, 0.35, 0.22, 0.16] as number[],
} as const;

/**
 * How far below the straight course the double_descent boat dips at route
 * progress t ∈ [0,1]: two dips (0 = on course, 1 = deepest), a crest between
 * them at the interpolation threshold. Skins offset ferryRoute points
 * perpendicular to the course by dipDepth(t) × their own amplitude.
 */
export function dipDepth(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  const g = (m: number, s: number) => Math.exp(-((x - m) ** 2) / (2 * s * s));
  // first dip shallower than the second — the second descent goes lower
  return Math.min(1, 0.75 * g(0.28, 0.1) + 1.0 * g(0.72, 0.1));
}
