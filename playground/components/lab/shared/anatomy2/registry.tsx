// The diagram registry: one DiagramDef per model name — what to draw (full
// view + card), its viewBox, its interaction, and the words that travel with
// it (title, truth, badge). Adding a diagram = one entry here (or a *_DEFS
// object spread in from its diagrams/<family>.tsx). Rendering lives in
// mechanism.tsx; the public surface is index.tsx.
import type { MutableRefObject, ReactNode } from "react";
import type { Theme, ThemeName } from "./themes";
import { DIFFUSION_CARD_VIEW, DIFFUSION_VIEW, DiffusionCard, DiffusionDiagram } from "./diagrams/diffusion";
import { TRANSFORMER_CARD_VIEW, TRANSFORMER_VIEW, TransformerCard, TransformerDiagram } from "./diagrams/transformer";
import { CLASSIFIER_CARD_VIEW, CLASSIFIER_VIEW, ClassifierCard, ClassifierDiagram } from "./diagrams/classifier";
import { VAE_CARD_VIEW, VAE_VIEW, VAECard, VAEDiagram } from "./diagrams/vae";
import { GAN_CARD_VIEW, GAN_VIEW, GANCard, GANDiagram } from "./diagrams/gan";
import { CLIP_CARD_VIEW, CLIP_VIEW, CLIPCard, CLIPDiagram } from "./diagrams/clip";
import { VISION_CARD_VIEW, VISION_VIEW, VisionCard, VisionDiagram, type VisionName } from "./diagrams/vision";
import { RECUR_CARD_VIEW, RECUR_VIEW, RecurCard, RecurDiagram, type RecurName } from "./diagrams/recur";
import { LM_CARD_VIEW, LM_VIEW, LMCard, LMDiagram, type LMName } from "./diagrams/lm";
import { TWIN_CARD_VIEW, TWIN_VIEW, TwinCard, TwinDiagram, type TwinName } from "./diagrams/twins";
import { GNN_CARD_VIEW, GNN_VIEW, GNNCard, GNNDiagram } from "./diagrams/gnn";
import { UNET_CARD_VIEW, UNET_VIEW, UNetCard, UNetDiagram, type UNetName } from "./diagrams/unet";
import { AlphaZeroCard, AlphaZeroDiagram, MazeCard, MazeDiagram, RL_CARD_VIEW, RL_VIEW, type MazeName } from "./diagrams/rl";
import { TEXT_DEFS } from "./diagrams/text";
import { AUDIO_DEFS } from "./diagrams/audio";
import { TAB_DEFS } from "./diagrams/tabular";
import { ALIGNMENT_DEFS } from "./diagrams/alignment";
import { DETECT_DEFS } from "./diagrams/detect";
import { PIXELCNN_DEFS } from "./diagrams/pixelcnn";
import { NERF_DEFS } from "./diagrams/nerf";
import { ADAPT_DEFS } from "./diagrams/adapt";
import { RPP_DEFS } from "./diagrams/rpp";
import type { KeyHandler } from "./diagrams/types";

export interface DiagramDef {
  view: { w: number; h: number };
  /** does it take the t scrubber? */
  scrub?: boolean;
  /** has its own interaction (clicks / keys) when not still */
  interactive?: boolean;
  /** one-line hint for keyboard users */
  keysHint?: string;
  title: string;
  /** what is computed vs illustrative — one or two plain sentences */
  truth: string;
  render: (p: { theme: Theme; t: number; onT?: (t: number) => void; still: boolean; keys: MutableRefObject<KeyHandler | null> }) => ReactNode;
  /** the compact card composition */
  card: { view: { w: number; h: number }; render: (p: { theme: Theme; t: number }) => ReactNode };
  /** 2–4 words on how real the card is, shown under it */
  badge: string;
}

export const DIAGRAMS: Record<string, DiagramDef> = {
  diffusion: {
    view: DIFFUSION_VIEW,
    scrub: true,
    title: "diffusion — noise a digit, learn to predict the noise",
    truth:
      "Computed live: the forward chain on a real MNIST test digit with the model's own schedule (1000 steps, β 1e-4→0.02, one fixed ε), the x_t mix, and the 128-d sinusoidal time embedding at t. The predicted noise and its MSE are the real network: the local mini-diffusion champion run on this exact x_t (trained at 200 steps, so t maps to t/5; exported every 25 steps). Drawn from the code: blocks, resolutions, channel counts, skips and where t enters.",
    render: ({ theme, t, onT }) => <DiffusionDiagram theme={theme} t={t} onT={onT} />,
    card: { view: DIFFUSION_CARD_VIEW, render: ({ theme, t }) => <DiffusionCard theme={theme} t={t} /> },
    badge: "real champion output",
  },
  transformer: {
    view: TRANSFORMER_VIEW,
    interactive: true,
    keysHint: "↑/↓ pick a character, ←/→ pick a head",
    title: "transformer — each character reads earlier ones, then guesses the next",
    truth:
      "All real: the Tiny Shakespeare line tokenised with the model's own 65-character vocabulary, then the local mini-transformer champion's attention for every block and head, its top guess for each next character (lit when right), and the cross-entropy. Drawn from the code: 4 blocks, 4 heads of 32 channels, d_model 128, feed-forward 256, causal mask.",
    render: ({ theme, still, keys }) => <TransformerDiagram theme={theme} still={still} keys={keys} />,
    card: { view: TRANSFORMER_CARD_VIEW, render: ({ theme }) => <TransformerCard theme={theme} /> },
    badge: "real champion attention",
  },
  classifier: {
    view: CLASSIFIER_VIEW,
    title: "classifier — small filters find strokes, pooling shrinks, ten scores decide",
    truth:
      "All real: a MNIST test 7 through the local mini-classifier champion — four of its 32 learned 3×3 kernels with their feature maps, four of the 64 second-layer maps, the max-pools of those maps, and the ten logits. Drawn from the code: two conv + BN + ReLU + pool stages, flatten 3136, a 64-unit layer, 10 outputs.",
    render: ({ theme }) => <ClassifierDiagram theme={theme} />,
    card: { view: CLASSIFIER_CARD_VIEW, render: ({ theme }) => <ClassifierCard theme={theme} /> },
    badge: "real champion maps",
  },
  vae: {
    view: VAE_VIEW,
    interactive: true,
    keysHint: "click a digit on the plane, or ←/→",
    title: "vae — squeeze an image to a fuzzy point, rebuild it from there",
    truth:
      "Real: the ten MNIST test digits, the encoder/decoder shapes (28→14→7, 32 and 64 channels, a 32-number latent) and β = 0.0015 from the config. Stand-in, and labelled so: the latent plane and the reconstructions use a 2-component PCA of these digits — what a linear VAE learns — because the local trained checkpoint has collapsed (every μ≈0, σ≈1). The σ ring is an illustrative radius.",
    render: ({ theme, still, keys }) => <VAEDiagram theme={theme} still={still} keys={keys} />,
    card: { view: VAE_CARD_VIEW, render: ({ theme }) => <VAECard theme={theme} /> },
    badge: "latent is a PCA stand-in",
  },
  gan: {
    view: GAN_VIEW,
    title: "gan — a forger and a judge train against each other",
    truth:
      "Real: the MNIST digits, and the samples, the judge's scores and both losses from the locally registered gan champion. Caveat: that champion predates today's convolutional code — its generator and judge are the older fully-connected versions — so the samples come from that network while the blocks show the current code (100 → 256×7×7 → 128×14×14 → 28×28; judge 64 → 128 → 1).",
    render: ({ theme }) => <GANDiagram theme={theme} />,
    card: { view: GAN_CARD_VIEW, render: ({ theme }) => <GANCard theme={theme} /> },
    badge: "early champion, MLP era",
  },
  clip: {
    view: CLIP_VIEW,
    title: "clip — two encoders learn one space where a digit and its caption meet",
    truth:
      "All real: six MNIST test digits and six of the model's own training captions through the local mini-clip champion — every cosine similarity, the learned scale, and the contrastive loss for this batch. The lit diagonal is where each image should match; a red frame marks a row that picked the wrong caption. Drawn from the code: a 3-conv image encoder and a 2-layer text transformer, both ending in 128 numbers of unit length.",
    render: ({ theme }) => <CLIPDiagram theme={theme} />,
    card: { view: CLIP_CARD_VIEW, render: ({ theme }) => <CLIPCard theme={theme} /> },
    badge: "real champion similarities",
  },
  ...TEXT_DEFS,
  ...AUDIO_DEFS,
  ...TAB_DEFS,
  ...ALIGNMENT_DEFS,
  ...DETECT_DEFS,
  ...PIXELCNN_DEFS,
  ...NERF_DEFS,
  ...ADAPT_DEFS,
  ...RPP_DEFS,
};
/** Link to the full specimen view; `from` (a same-site path) powers its back link. */
export function anatomyHref(name: string, theme: ThemeName = "pixel", from?: string): string {
  const p = new URLSearchParams({ model: name, theme });
  if (from && from.startsWith("/") && !from.startsWith("//")) p.set("from", from);
  return `/lab/anatomy/?${p}`;
}

// ——— vision family: shared spine, per-model inset ———
const VISION_DEFS: Record<VisionName, { title: string; truth: string; badge: string }> = {
  resnet: {
    title: "resnet — each block learns a correction and adds it to what came in",
    truth: "All real: the MNIST test 7 through the local mini-resnet champion — one feature map per stage, the ten logits, and inside block 2 the real residual branch F(x), the 1×1 shortcut, their sum and the ReLU. Drawn from the code: stem 32, blocks of 32, 64 and 128 channels, global average pool.",
    badge: "real champion maps",
  },
  mobilenet: {
    title: "mobilenet — one filter per channel, then a 1×1 mix",
    truth: "All real: the local mini-mobilenet champion on the MNIST test 7 — stage maps, logits, and inside the first separable block four real depthwise kernels, their per-channel outputs, the real pointwise weights between them and three output channels. The weight counts come from the layer shapes in the code.",
    badge: "real champion maps",
  },
  convnext: {
    title: "convnext — a wide middle between two narrow ends, plus a skip",
    truth: "All real: the local mini-convnext champion on the MNIST test 7 — stage maps, logits, and inside stage 1 the depthwise map, four of the 128 expanded maps, the projection back to 32 channels and the sum with the skip. Drawn from the code: dw 3×3, LayerNorm, 1×1 ×4, GELU, 1×1.",
    badge: "real champion maps",
  },
  vit: {
    title: "vit — cut the image into patches and let them attend to each other",
    truth: "All real: the local mini-vit champion on the MNIST test 7 — the 49 patches, one patch-embedding channel, the logits, and where the CLS token attends in every layer and head (brightness = square root of the weight over the map's max, so small weights stay visible).",
    badge: "real champion attention",
  },
};
for (const n of Object.keys(VISION_DEFS) as VisionName[]) {
  DIAGRAMS[n] = {
    view: VISION_VIEW,
    title: VISION_DEFS[n].title,
    truth: VISION_DEFS[n].truth,
    badge: VISION_DEFS[n].badge,
    render: ({ theme }) => <VisionDiagram theme={theme} name={n} />,
    card: { view: VISION_CARD_VIEW, render: ({ theme }) => <VisionCard theme={theme} name={n} /> },
  };
}

// ——— recurrence family ———
const RECUR_DEFS: Record<RecurName, { title: string; truth: string; badge: string }> = {
  rnn: {
    title: "rnn — one cell, reused at every character, carrying its memory forward",
    truth: "All real: the local mini-rnn champion (an LSTM, 2 layers × 256) stepped one character at a time over the Tiny Shakespeare line — its cell state and hidden state at every step for the 24 channels that move most, its top guess for each next character, and the cross-entropy.",
    badge: "real champion states",
  },
  mamba: {
    title: "mamba — no attention: a decaying running sum carries the past",
    truth: "All real: the local mini-mamba champion's first block on the Tiny Shakespeare line — the input u, the gate and the scan state s = a·s + b·u at every step for the 16 channels whose state moves most, plus its next-character guesses. Honest note from the code: a and b are learned per channel but do not depend on the input, so this mini Mamba is not selective, and its decay stayed near 0.5.",
    badge: "real champion scan",
  },
};
for (const n of Object.keys(RECUR_DEFS) as RecurName[]) {
  DIAGRAMS[n] = {
    view: RECUR_VIEW, ...RECUR_DEFS[n],
    render: ({ theme }) => <RecurDiagram theme={theme} name={n} />,
    card: { view: RECUR_CARD_VIEW, render: ({ theme }) => <RecurCard theme={theme} name={n} /> },
  };
}

// ——— transformer-derived LMs (no local checkpoints: structure + real data + exact maths) ———
const LM_DEFS: Record<LMName, { title: string; truth: string; badge: string }> = {
  moe: {
    title: "moe — a router sends each character to one of four expert networks",
    truth: "Drawn from the code: 4 blocks of causal attention whose feed-forward is a mixture of 4 experts with top-1 routing, a shared path scaled by a learned 0.3, and a balance loss (KL to uniform). There is no local moe checkpoint, so the routes are an illustration; the balance loss is computed exactly from them.",
    badge: "structure; routes illustrative",
  },
  kimi: {
    title: "kimi — three forgetful linear layers, then one that sees everything",
    truth: "Drawn from the code: 9 layers — Kimi Delta Attention ×3 then gated full attention, twice, plus a final global layer; a dense first FFN, then LatentMoE (2 shared + top-2 of 8 routed experts in a 64-d latent). The retention curves are exact for the config's bound α ∈ (e⁻⁵, 1). No local checkpoint: which experts fire is illustrative.",
    badge: "structure; experts illustrative",
  },
  deepseek: {
    title: "deepseek — compress the past so a query reads a short summary",
    truth: "Drawn from the code on the first 64 characters of Tiny Shakespeare: CSA keeps 1 entry per 4 characters and reads the top 8, HCA keeps 1 per 16 and reads all, plus a 16-character raw window. The Sinkhorn projection used by mHC is computed exactly on a random matrix. No local checkpoint: which 8 CSA entries win is illustrative.",
    badge: "structure; picks illustrative",
  },
  grokking: {
    title: "grokking — memorise first, understand (much) later",
    truth: "Real: the whole task — every a ÷ b mod 97 — and the exact 50/50 train/held-out split the code draws (seed 5), plus the 2-layer model from the config. The accuracy curve is a labelled sketch of the published result; there is no local run to plot.",
    badge: "real task and split; curve sketched",
  },
  text_diffusion: {
    title: "text diffusion — hide characters, predict them all, reveal a few at a time",
    truth: "Drawn from the code: the transformer with its causal mask removed; each character is hidden with probability t and the loss asks for every hidden one; generation reveals max(1, hidden ÷ rounds left) per round. The mask is a real draw of that rule on the line; the reveal order is illustrative (no local checkpoint).",
    badge: "structure; order illustrative",
  },
};
for (const n of Object.keys(LM_DEFS) as LMName[]) {
  DIAGRAMS[n] = {
    view: LM_VIEW, ...LM_DEFS[n],
    render: ({ theme }) => <LMDiagram theme={theme} name={n} />,
    card: { view: LM_CARD_VIEW, render: ({ theme }) => <LMCard theme={theme} name={n} /> },
  };
}

// ——— twin-view family ———
const TWIN_DEFS: Record<TwinName, { title: string; truth: string; badge: string }> = {
  simclr: {
    title: "simclr — two views of one digit should land together",
    truth: "All real: two augmented views of six MNIST test digits made with the code's own crop-and-rotate transform, the local mini-simclr champion's similarity between all 12, its InfoNCE loss at T = 0.2, and a 2-D PCA of the embeddings (the two views of a digit sit close).",
    badge: "real champion embeddings",
  },
  dino: {
    title: "dino — a student learns to match a slowly-moving copy of itself",
    truth: "All real: the same augmented views through the local mini-dino champion — student prototype probabilities on one view against the centred, sharpened teacher on the other, the loss, and a PCA of the teacher's features. Honest note: this checkpoint's targets are nearly flat (max ≈ 0.05 over 64 prototypes), so its loss sits near ln 64.",
    badge: "real champion, flat targets",
  },
  vision_embed: {
    title: "vision embed — images become points on a sphere; near means similar",
    truth: "All real: 64-number unit embeddings from the local vision_embed champion for the ten MNIST test digits (cosine between each pair, each digit's nearest other digit), plus the same augmented views and a 2-D PCA of every embedding.",
    badge: "real champion embeddings",
  },
};
for (const n of Object.keys(TWIN_DEFS) as TwinName[]) {
  DIAGRAMS[n] = {
    view: TWIN_VIEW, ...TWIN_DEFS[n],
    render: ({ theme }) => <TwinDiagram theme={theme} name={n} />,
    card: { view: TWIN_CARD_VIEW, render: ({ theme }) => <TwinCard theme={theme} name={n} /> },
  };
}

DIAGRAMS.gnn = {
  view: GNN_VIEW,
  title: "gnn — to classify a node, average its neighbours",
  truth: "Real: the exact 200-node community graph the code trains on (seed 11), its 20 labelled nodes, and what averaging over neighbours alone does to the weak node features — 35% right from features, 55% after one hop, 74% after two, with no weights at all. Drawn from the code: two GCN layers, 8 → 32 → 4. No local gnn checkpoint, so the trained weights are not shown.",
  badge: "real graph, exact averaging",
  render: ({ theme }) => <GNNDiagram theme={theme} />,
  card: { view: GNN_CARD_VIEW, render: ({ theme }) => <GNNCard theme={theme} /> },
};

// ——— encoder–decoder with skip bridges ———
const UNET_DEFS: Record<UNetName, { title: string; truth: string; badge: string }> = {
  segmentation: {
    title: "segmentation — shrink to understand, grow back to point at every pixel",
    truth: "All real: four MNIST test digits through the local mini-segmentation champion — one feature map per level, its stroke-or-background mask, the true mask (every pixel above 0, the dataset's own rule) and the IoU of each. Drawn from the code: 32 → 64 → 128 channels at 28 → 14 → 7 px and back, with two copy-and-concatenate skips.",
    badge: "real champion masks",
  },
  unet_ae: {
    title: "unet autoencoder — rebuild the input; the skips make it almost too easy",
    truth: "All real: the same four digits through the local mini-unet_ae champion (the segmentation network, retargeted to reproduce its input) — feature maps, reconstructions and per-image error. The skips hand detail straight past the 7×7 bottleneck, which is why the error is tiny and the code is not a useful summary.",
    badge: "real champion rebuilds",
  },
};
for (const n of Object.keys(UNET_DEFS) as UNetName[]) {
  DIAGRAMS[n] = {
    view: UNET_VIEW, ...UNET_DEFS[n],
    render: ({ theme }) => <UNetDiagram theme={theme} name={n} />,
    card: { view: UNET_CARD_VIEW, render: ({ theme }) => <UNetCard theme={theme} name={n} /> },
  };
}

// ——— agent–environment ———
const MAZE_DEFS: Record<MazeName, { title: string; truth: string; badge: string }> = {
  rl_maze: {
    title: "rl maze — learn how good each move is, then take the best one",
    truth: "All real: the fixed 8×8 maze the code trains on (seed 42), the local DQN champion's best action and Q value for every open square, its greedy 14-step path to the goal, the rewards along it (including the distance-shaping bonus) and the discounted returns. Drawn from the code: state = 5×5 view + position, Q network 27 → 64 → 64 → 4.",
    badge: "real champion path",
  },
  reinforce: {
    title: "reinforce — make the moves that led to reward more likely",
    truth: "All real: the same fixed maze, the local REINFORCE champion's likeliest action and its probability on every open square, its greedy path, the rewards and returns G_t that scale each move's gradient. Drawn from the code: policy 27 → 64 → 4.",
    badge: "real champion path",
  },
};
for (const n of Object.keys(MAZE_DEFS) as MazeName[]) {
  DIAGRAMS[n] = {
    view: RL_VIEW, ...MAZE_DEFS[n],
    render: ({ theme }) => <MazeDiagram theme={theme} name={n} />,
    card: { view: RL_CARD_VIEW, render: ({ theme }) => <MazeCard theme={theme} name={n} /> },
  };
}
DIAGRAMS.alphazero = {
  view: RL_VIEW,
  title: "alphazero — search improves the policy, the network learns the improvement",
  truth: "Drawn from the code: tic-tac-toe, a two-plane board encoding into a small MLP with a move head and a value head, PUCT search with 64 simulations, root noise in self-play, and a loss that copies the search's visit counts and predicts the result. The board values are exact minimax, computed here — what search converges to. There is no local alphazero checkpoint, so the network's own guesses are not shown.",
  badge: "structure; values exact",
  render: ({ theme }) => <AlphaZeroDiagram theme={theme} />,
  card: { view: RL_CARD_VIEW, render: ({ theme }) => <AlphaZeroCard theme={theme} /> },
};

export function hasDiagram(name: string): boolean {
  return name in DIAGRAMS;
}

export const DIAGRAM_NAMES = Object.keys(DIAGRAMS); // (evaluated after the family loops above)

export function diagramFor(name: string): DiagramDef | null {
  return DIAGRAMS[name] ?? null;
}
