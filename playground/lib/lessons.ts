// Lesson-card copy: one plain-language lesson per model in the taxonomy, in
// the learner's voice. Every skin renders the SAME words in its own medium.
//
// Sources (distilled, not invented): each src/mini_networks/models/*/model.py
// educational header ("Key idea" + "Deliberately simplified"), the taxonomy
// notes/mechanisms (core/taxonomy.py) and the docs/ chapters. Rules:
//   - what + why + idea (+ analogy) ≤ 60 words in total (lessons.test.ts)
//   - sentence case, plain words; a jargon term is either explained inline
//     ("a leash to the original model") or avoided
//   - where the mini version simplifies the paper, say so rather than
//     overclaim (moe, tabular_diffusion, dpo, unet_ae)
// Pure data — relative imports only so node --test can load it.

export interface Lesson {
  /** what it is, in one or two plain sentences */
  what: string;
  /** why it exists — the problem it answers */
  why: string;
  /** the one idea it adds to the zoo */
  idea: string;
  /** optional everyday picture of the idea */
  analogy?: string;
}

export const LESSONS: Record<string, Lesson> = {
  // ── atoms ──────────────────────────────────────────────────────────────
  classifier: {
    what: "Looks at a 28×28 picture of a handwritten digit and says which digit it is.",
    why: "Most vision models in the zoo start here.",
    idea: "Convolution: one small filter slides across the whole picture, so a stroke detector learned in one corner works everywhere — with very few numbers to learn.",
    analogy: "A small magnifying glass swept over the page.",
  },
  tabular_classifier: {
    what: "Sorts iris flowers into three species from four measurements, like petal length — a table of numbers, not a picture.",
    why: "On tables, a deep model has to beat a plain straight-line rule to earn its place.",
    idea: "A multi-layer perceptron: stacked layers of weighted sums, each followed by a simple bend, so the model can draw curved boundaries between classes.",
  },
  rnn: {
    what: "Reads Shakespeare one character at a time and guesses the next one.",
    why: "The classic way to handle sequences, from before attention.",
    idea: "Recurrence: the whole past is squeezed into one fixed-size memory (the hidden state), updated at every step — so each new character costs the same.",
    analogy: "Reading a book while keeping only a running summary in your head.",
  },
  transformer: {
    what: "A small language model that writes Shakespeare-style text, one character at a time.",
    why: "The zoo's biggest hub: more models build on it than on anything else.",
    idea: "Self-attention: each character looks back at all earlier ones and decides which matter most. A mask hides the future, so it only predicts forward.",
    analogy: "Rereading the sentence before choosing your next letter.",
  },
  mamba: {
    what: "A language model with no attention at all: it reads text as a stream.",
    why: "Attention compares every pair of characters, which gets slow as text grows; a stream costs the same per step.",
    idea: "A state-space scan: a small memory per channel fades a little each step and mixes in the new input — a leaky running total.",
  },
  gnn: {
    what: "Sorts the points of a network (a graph) into communities, from only five labelled examples per community.",
    why: "Some data is about connections, not pictures or text.",
    idea: "Message passing: each point averages its neighbours' features. One point alone is noisy, but ten neighbours that agree are not — the connections clean up the signal.",
    analogy: "Guessing someone's club by looking at their friends.",
  },
  vae: {
    what: "Squeezes a digit image into 32 numbers and rebuilds it — then draws brand-new digits from random numbers.",
    why: "A plain autoencoder can copy, but it cannot invent.",
    idea: "The squeezed code is a fuzzy cloud, not a single point, gently pulled toward a standard bell-curve shape — so any random point you pick decodes into a sensible digit.",
  },
  gan: {
    what: "Two networks play a game: a generator draws fake digits from noise; a discriminator tries to spot them.",
    why: "It can make a sharp image in a single step.",
    idea: "The adversarial game: each side trains against the other, so as the inspector gets sharper, the forger must get better.",
    analogy: "A forger and an inspector, both improving every round.",
  },
  diffusion: {
    what: "Makes new digits by starting from pure static and cleaning it up, step by step.",
    why: "It trains steadily, where a GAN can wobble or collapse onto a few digits.",
    idea: "Iterative denoising: add noise to real images and teach a network to predict it. To create, run that backwards from static.",
    analogy: "A photo developing in a darkroom tray.",
  },
  pixelcnn: {
    what: "Draws a digit one pixel at a time, left to right, top to bottom.",
    why: "It shows images can be generated like text: predict the next piece from everything before it.",
    idea: "Masked convolutions: the filters are blanked out so each pixel only sees pixels above and to its left — it can never peek at the answer.",
  },
  segmentation: {
    what: "Colours in exactly which pixels belong to the digit, producing a mask the size of the image.",
    why: "Sometimes you need where, not just what.",
    idea: "A U-shaped encoder–decoder: the image is shrunk to work out what it shows, then grown back, while skip shortcuts carry the fine details straight across.",
  },
  simclr: {
    what: "Learns to describe images without any labels.",
    why: "Labels are expensive; unlabelled images are everywhere.",
    idea: "Contrastive learning: make two random edits of the same picture and train their descriptions to match, while descriptions of different pictures are pushed apart.",
    analogy: "Recognising a friend in two very different photos.",
  },
  reinforce: {
    what: "An agent that learns to walk out of a maze by trial and error.",
    why: "It is the simplest way to learn from rewards instead of right answers.",
    idea: "Policy gradient: play a whole game, then make the moves that led to a high score more likely and the rest less likely. No teacher, only the outcome.",
  },
  rl_maze: {
    what: "Agents that solve the same maze by learning how good each move is from each square.",
    why: "Value-based learning is reinforcement learning's other big family, next to policy gradients.",
    idea: "Q-learning: keep a guess of \"future reward if I move this way\" and correct it using the reward you got plus your own guess for the next square.",
  },
  nerf: {
    what: "Learns a 3D block-built digit from flat pictures, then shows it from unseen angles.",
    why: "It stores a scene as a function, not a mesh.",
    idea: "A neural field: a small network answers \"how dense, and what colour, is this point?\". Rendering adds the answers up along each camera ray, so flat pictures are enough to train it.",
  },
  alphazero: {
    what: "Learns tic-tac-toe with no human games, only by playing against itself.",
    why: "It joins thinking ahead and learning into one loop.",
    idea: "Tree search plus self-play: looking a few moves ahead picks better moves than the network alone; the network is trained to copy those picks, which makes the next search stronger.",
  },

  // ── derived ────────────────────────────────────────────────────────────
  resnet: {
    what: "A deeper version of the classifier, with shortcut paths around its blocks.",
    why: "Stacking more layers used to make networks worse; shortcuts fixed that.",
    idea: "Residual connections: each block only learns a correction and adds it to its input, so the learning signal can flow straight back through the shortcut.",
    analogy: "Editing a draft instead of rewriting it from scratch.",
  },
  vit: {
    what: "Classifies digits with attention instead of convolution.",
    why: "It tests whether the transformer recipe from text also works for pictures.",
    idea: "Patch embedding: cut the image into a 7×7 grid of small squares and treat each square like a word; attention then relates every patch to every other.",
  },
  mobilenet: {
    what: "A lighter classifier, designed to run on small devices like phones.",
    why: "A normal convolution does a lot of arithmetic, and most of it can be skipped.",
    idea: "Depthwise separable convolution: filter each feature map on its own first, then mix them with a cheap 1×1 step — roughly eight times less work for nearly the same accuracy.",
  },
  convnext: {
    what: "A classic convolutional network, rebuilt with habits borrowed from transformers.",
    why: "It asks how much of the transformer's success comes from attention, and how much from everything around it.",
    idea: "A modern recipe: per-channel filters, a widen-then-narrow layer and newer normalisation. No attention at all.",
  },
  rpp_classifier: {
    what: "A classifier with two paths side by side: a convolution and a fully free layer.",
    why: "Convolution assumes a pattern means the same anywhere in the picture — usually, not always, true.",
    idea: "Soft priors: the free path is penalised more, so the model leans on convolution where that holds and pays a small price to break it where it doesn't.",
  },
  vision_embed: {
    what: "Turns each image into 64 numbers — a point in space — so similar images land close together.",
    why: "Search, retrieval and CLIP's image side all need this kind of map.",
    idea: "A metric embedding: every point is scaled to length one, so comparing two images is just measuring the angle between their arrows.",
  },
  dino: {
    what: "Learns to understand images with no labels, by teaching itself.",
    why: "It builds on SimCLR but needs no \"push apart\" examples.",
    idea: "Self-distillation: a student matches a teacher on another view of the same image. The teacher is just a slow moving average of the student, so the student chases a steadier version of itself.",
  },
  clip: {
    what: "Puts pictures of digits and short texts about them in one shared space, so an image and its caption land near each other.",
    why: "Once images and words share a space, you can search pictures with words.",
    idea: "Cross-modal contrastive learning: an image encoder and a text encoder train together, so matching pairs agree and mismatched pairs don't.",
  },
  lora: {
    what: "Adapts a digit classifier to recognise clothing by training only a tiny add-on.",
    why: "Retraining every weight is costly and overwrites what the model knew.",
    idea: "Low-rank adaptation: freeze the original weights and learn a small correction built from two thin tables of numbers. It starts at zero, so the model begins exactly as it was.",
  },
  detection: {
    what: "Finds a digit on a larger canvas, names it, and draws a box around it.",
    why: "Real images contain things somewhere: you need both what and where.",
    idea: "One pass, two heads: a shared feature extractor feeds two small output layers — one names the digit, one predicts the box's four coordinates — trained together.",
  },
  unet_ae: {
    what: "The segmentation U-Net, retrained to rebuild its own input image.",
    why: "It shows a trap: a network can reconstruct perfectly without learning a useful summary.",
    idea: "The skip shortcuts let every detail bypass the squeezed middle, so it copies rather than compresses. Compare the VAE, which has no shortcuts.",
  },
  audio_classifier: {
    what: "Recognises spoken digits, zero to nine, straight from the raw sound wave.",
    why: "It moves convolution from 2D pictures to 1D sound.",
    idea: "Waveform convolution: small filters slide along the wave over time, picking up little sound patterns the way image filters pick up strokes.",
  },
  audio_spectrogram: {
    what: "The same spoken-digit task, but the sound is first turned into a picture.",
    why: "In audio, how you represent the sound often matters more than the network.",
    idea: "A spectrogram is an image of time (across) against pitch (up) — an ordinary image classifier can then read it.",
  },
  audio_melspectrogram: {
    what: "Like the spectrogram model, but the pitch axis is stretched to match human hearing.",
    why: "We tell low notes apart far better than high ones.",
    idea: "The mel scale gives more rows to low pitches and fewer to high ones, so the picture emphasises what speech actually uses.",
  },
  audio_transformer: {
    what: "Reads a spectrogram as a sequence of time slices and names the spoken digit.",
    why: "It brings attention from text to sound.",
    idea: "Each time slice becomes a token and attention lets every moment look at every other. It averages them at the end, so here the order of slices isn't used.",
  },
  tabular_diffusion: {
    what: "Invents new rows of flower measurements that look like the real table.",
    why: "It shows diffusion is not an image trick — it works on any list of numbers.",
    idea: "The same noise-then-clean recipe, with a plain layered network instead of a U-Net. Honest catch: it isn't told how noisy each input is, which limits quality.",
  },
  text_diffusion: {
    what: "Writes text by filling in blanks all over the line at once, instead of left to right.",
    why: "Language models don't have to write in order.",
    idea: "Masked denoising: hide random characters and learn to fill them in. To write, start fully hidden and reveal the most confident guesses over several rounds. Same transformer, mask removed.",
  },
  text_seq2seq: {
    what: "Reads one piece of text, then writes another, like a translator.",
    why: "Continuing text and transforming text are different jobs.",
    idea: "Encoder–decoder with cross-attention: one part reads the whole source in both directions; the writing part looks back at that reading at every step.",
  },
  text_token_classifier: {
    what: "Labels every character of a text — here, vowel or not.",
    why: "Many language tasks, like spotting names, need a label per position rather than a next word.",
    idea: "Bidirectional encoding: with no mask hiding the future, each position sees the whole sentence, left and right.",
  },
  moe: {
    what: "The transformer language model with a team of expert sub-networks instead of one.",
    why: "More capacity without more work for every character.",
    idea: "Expert routing: a small router picks the expert for each character, and an extra loss spreads the work so no expert sits idle. This mini version still runs every expert, for clarity.",
  },
  kimi: {
    what: "A miniature of a 2026 frontier language model, Kimi K3, shrunk to Shakespeare size.",
    why: "It shows how today's big models combine several tricks at once.",
    idea: "Mostly fast linear attention — a running memory that can overwrite old facts — with an occasional full-attention layer, and experts that work in a compressed space.",
  },
  deepseek: {
    what: "A miniature of the DeepSeek V4 language-model design.",
    why: "On long texts, attention's memory grows huge; this design keeps it small.",
    idea: "Compressed attention: groups of characters are pooled into one memory entry, and the model reads only the most relevant entries. Experts and a \"predict two ahead\" side task come along too.",
  },
  grokking: {
    what: "A tiny transformer learning division in clock arithmetic, where numbers wrap around at 97.",
    why: "It shows a strange phenomenon, not a new architecture.",
    idea: "Delayed generalisation: it memorises the training pairs fast, then — much later, helped by a steady pull toward small weights — suddenly gets the unseen pairs right too.",
  },
  rag: {
    what: "A language model that looks things up before it writes.",
    why: "A model's knowledge is frozen at training time; a lookup brings in text it never memorised.",
    idea: "Retrieval-augmented generation: find the three most similar text chunks by word overlap (rare shared words count more), paste them in front of the question, then generate.",
  },
  rlhf: {
    what: "Fine-tunes the Shakespeare language model toward text that earns a higher reward.",
    why: "Likely text isn't always the text you want.",
    idea: "Sample text, score it — here, by counting old words like \"thou\" and \"hath\" — and take small, careful update steps toward high scores, with a leash to the original model so it can't game the score.",
  },
  grpo: {
    what: "The RLHF setup with one part removed: the extra network that predicts rewards.",
    why: "That network costs memory and fiddly tuning.",
    idea: "Group-relative advantage: write several answers to the same prompt and judge each only against its siblings — better than the group's average means push it up.",
  },
  dpo: {
    what: "Aligns the language model with preferences, with no reinforcement learning at all.",
    why: "RLHF's reward model and sampling loop are complicated and fragile.",
    idea: "Given a preferred and a rejected answer, raise the odds of the first and lower the second, relative to a frozen copy of the model — one ordinary loss. Here a simple score picks the preferred answer.",
  },
  sam: {
    what: "Cuts one digit out of an image that holds two — you choose which by clicking.",
    why: "One image has many valid masks; the user's intent should decide.",
    idea: "Promptable decoding: the click and the image attend to each other, back and forth. It proposes three masks and rates its own best.",
  },
};

// One sentence per composition (core/taxonomy.py COMPOSITION_TAXONOMY +
// each compositions/*.py docstring).
export const COMPOSITION_LESSONS: Record<string, string> = {
  clip_guided_diffusion: "CLIP reads your words and steers a diffusion model toward the digit you described, optionally working in a VAE's compressed space.",
  transformer_clip_diffusion: "A language model proposes prompts, CLIP picks the one that best matches a digit, and diffusion draws it.",
  gan_diffusion_comparison: "A GAN and a diffusion model train on the same digits, so you can weigh one-step speed against step-by-step stability.",
  clip_guided_gan: "The GAN's generator earns extra credit for images that CLIP thinks match the text.",
  classifier_guided_diffusion: "A trained classifier nudges every denoising step toward the digit you asked for.",
  rag_guided_generation: "Look up relevant text first, then let the transformer write with it in view.",
  lora_lm: "Teach the Shakespeare language model a new style by training only a small low-rank add-on.",
  segment_then_detect: "Colour in the digit's pixels first, then draw its box from that mask.",
  multitask_vision: "One shared image encoder feeds three outputs at once: name the digit, colour its pixels, and box it.",
  diffusion_distillation: "A slow, step-by-step diffusion teacher trains a smaller, faster student denoiser.",
  audio_text_contrastive: "Spoken digits and their written names are pulled into one shared space, with attention between the two.",
  tabular_text_cross_attention: "Flower measurements and text descriptions attend to each other, so matching pairs line up.",
  audio_text_dual_encoder: "Two separate encoders, one for sound and one for text, train so a spoken digit lands next to its name.",
  tabular_text_dual_encoder: "Two separate encoders map flower measurements and their descriptions into one space where matches sit together.",
  classifier_guided_gan: "A classifier tells the GAN's generator which digit it is drawing, pushing it toward the class you want.",
  rag_conditioned_diffusion: "Looked-up text becomes the prompt that steers a diffusion model's drawing.",
  image_captioning: "An image encoder and a text decoder team up to describe a digit in words, like \"a bold six\".",
  multimodal_fusion_baseline: "Image and text features are simply joined and classified — the plain baseline any cleverer fusion has to beat.",
  latent_diffusion: "A VAE squeezes images into a small code and diffusion works there, far cheaper than working on pixels.",
  mode_connect: "Two classifiers trained from different random starts turn out to be linked by a whole triangle of equally good networks.",
  double_descent: "As the network gets wider, test error falls, rises right where it can just memorise the noisy labels, then falls again.",
  vlm: "Image patches become tokens placed in front of the text, so a plain language model can answer questions about the picture.",
};

export function wordCount(l: Lesson): number {
  return [l.what, l.why, l.idea, l.analogy ?? ""]
    .join(" ")
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** The lesson for a model or composition name; null when unknown. */
export function lessonFor(name: string):
  | { kind: "model"; lesson: Lesson }
  | { kind: "composition"; line: string }
  | null {
  if (LESSONS[name]) return { kind: "model", lesson: LESSONS[name] };
  if (COMPOSITION_LESSONS[name]) return { kind: "composition", line: COMPOSITION_LESSONS[name] };
  return null;
}

/** Names in `taxonomy` that have no lesson — must be [] (lessons.test.ts). */
export function missingLessons(taxonomy: {
  models: { name: string }[];
  compositions: { name: string }[];
}): { models: string[]; compositions: string[] } {
  return {
    models: taxonomy.models.map((m) => m.name).filter((n) => !LESSONS[n]),
    compositions: taxonomy.compositions.map((c) => c.name).filter((n) => !COMPOSITION_LESSONS[n]),
  };
}
