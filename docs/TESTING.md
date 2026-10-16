# TESTING — how to run and verify every mini

The single "how do I check this works?" reference for the zoo. Everything here
runs on **CPU** at nano (`--fast_demo` / S-tier) scale in seconds. M/L training
runs on GCP (see `CLAUDE.md`); this doc is about local verification.

> Always run through `uv` so the project environment (torch, torchvision, rich,
> …) is on the path. `python main.py …` bare uses the system interpreter and
> will fail with `ModuleNotFoundError`.

## Quick reference

```bash
# List all 50 models + 23 compositions with their taxonomy (family / mechanism):
uv run python main.py list

# Train ONE mini for a single nano step on tiny random/cached data:
uv run python main.py train --model <name> --fast_demo --device cpu

# Run ALL forward-pass + train/eval smoke tests (every model in the registry):
uv run pytest tests/test_smoke_models.py

# Run ONE mini's dedicated test (forward-pass shape + gradient checks):
uv run pytest tests/test_smoke_models.py::test_<mini>_forward_and_<...>_smoke

# The sync gate: taxonomy covers the registry, EvalSpec covers every model,
# MODEL_NAMES order matches get_model_registry(), the DAG is acyclic:
uv run pytest tests/test_taxonomy.py tests/test_sweep_check.py

# The whole suite (deselects known pre-existing failures via test-ci in the Makefile):
uv run pytest tests/ -q
```

The registry-wide smoke test (`test_registry_train_eval_smoke`) needs the MNIST /
FashionMNIST cache. Point it at a writable cache dir once and it downloads:

```bash
MINI_TEST_DATA_ROOT=/tmp/mini_networks_test_data uv run pytest tests/test_smoke_models.py -q
```

## What "verify" means per model type

`train --fast_demo` writes a run under `runs/<model>/<timestamp>/` with
`metrics.jsonl`, `config.yaml`, and `artifacts/*.pt`. A mini "works" locally when:

1. `train --fast_demo` completes and prints `Done. Artifacts: …`.
2. Its smoke test passes (forward-pass shapes + a finite backward pass).
3. It appears in `main.py list` with the right family / mechanism.

The M/L **quality gate** (`sweep --check`) grades each model against its
`EVAL_SPECS` entry — that metric is the "how to verify it actually learned"
column below. At S tier the gate only checks that losses are finite and trend
down (or `s_mode=finite` for adversarial / RL losses).

## Colab notebooks

Optional GPU walkthroughs live in `colab/notebooks/` (open from a Colab kernel):

| Notebook | Covers |
|---|---|
| `00_sweep.ipynb` | Runs the quality gate (`sweep --check`) on a GPU kernel |
| `01_vision.ipynb` | Vision generative models: CLIP · Diffusion · GAN (+ the new vision minis train the same way) |
| `02_language.ipynb` | Language models: Transformer · Mamba · RNN · LoRA · RAG |
| `03_rl.ipynb` | RL: RL-Maze · RLHF · the RL+RLHF composition |
| `04_compositions.ipynb` | Multi-model composition pipelines |

Any model not explicitly demoed in a notebook still runs identically via
`uv run python main.py train --model <name> --fast_demo` and, on a GPU kernel,
`uv run python main.py sweep --check --models <name> --skip-compositions`.

---

## Per-model table (50 models)

Every model trains with `uv run python main.py train --model <name> --fast_demo`
(the "Train command" column shows just `<name>`). "Verify" is the gate metric
from `core/evalspec.py` — the number the M/L sweep grades. Family / mechanism
come from `core/taxonomy.py`.

| Model | What it demonstrates | Train (`--model`) | Verify (gate metric) |
|---|---|---|---|
| clip | Contrastive image–text matching on MNIST | `clip` | eval_loss |
| diffusion | DDPM denoising with EMA + curriculum learning | `diffusion` | judge_score |
| segmentation | UNet binary / multiclass segmentation on MNIST | `segmentation` | eval_iou |
| detection | YOLO-style digit localisation on 56×56 canvas | `detection` | eval_accuracy |
| classifier | Small CNN classifier baseline on MNIST/Fashion | `classifier` | accuracy |
| resnet | Mini ResNet baseline on MNIST/Fashion | `resnet` | accuracy |
| vit | Mini ViT baseline on MNIST/Fashion | `vit` | accuracy |
| vae | Conv VAE reconstruction on MNIST/Fashion | `vae` | eval_loss |
| unet_ae | UNet autoencoder reconstruction | `unet_ae` | eval_loss |
| simclr | SimCLR-lite contrastive vision pretraining | `simclr` | eval_loss |
| dino | DINO self-distillation ViT (EMA teacher, no labels) | `dino` | eval_loss |
| transformer | Character-level TransformerLM on Shakespeare | `transformer` | eval_loss |
| moe | Mixture-of-Experts LM: router + top-1 experts + balance loss | `moe` | eval_loss |
| mamba | NanoMamba state-space sequence model | `mamba` | eval_loss |
| kimi | Mini Kimi K3: KDA linear-attention hybrid + AttnRes + LatentMoE | `kimi` | eval_loss |
| deepseek | Mini DeepSeek V4: CSA/HCA compressed attention + mHC + MTP | `deepseek` | eval_loss |
| grokking | Delayed generalization on modular division (a/b mod 97) | `grokking` | accuracy |
| text_diffusion | LLaDA-mini: masked-diffusion char-LM, iterative unmasking | `text_diffusion` | eval_loss |
| rpp_classifier | Residual Pathway Priors: equivariance as a soft prior | `rpp_classifier` | accuracy |
| gnn | Graph convolutional network: node classification on an SBM | `gnn` | accuracy |
| sam | Mini SAM: promptable segmentation — clicks choose which digit | `sam` | eval_iou |
| nerf | Mini NeRF: voxel-digit scene as a continuous field, novel-view PSNR | `nerf` | psnr |
| alphazero | Mini AlphaZero: MCTS self-play on tic-tac-toe → policy net | `alphazero` | success_rate |
| gan | Generator + Discriminator on MNIST (mode collapse observable) | `gan` | judge_score |
| rnn | RNN / LSTM / GRU recurrent language model | `rnn` | eval_loss |
| lora | Low-rank fine-tuning: MNIST → FashionMNIST | `lora` | accuracy |
| rag | TF-IDF retrieval + TransformerLM generation | `rag` | eval_loss |
| rl_maze | Q / DQN / PPO agents on a procedural maze | `rl_maze` | success_rate |
| rlhf | PPO fine-tuning with Shakespearean reward | `rlhf` | eval_loss |
| grpo | GRPO: group-relative advantages, no value net | `grpo` | eval_loss |
| dpo | DPO: preference pairs, no RL — implicit KL via reference | `dpo` | eval_loss |
| reinforce | REINFORCE policy gradient on a procedural maze | `reinforce` | success_rate |
| audio_classifier | 1D CNN classifier on speech digits (raw waveform) | `audio_classifier` | accuracy |
| audio_spectrogram | 2D CNN on audio spectrograms | `audio_spectrogram` | accuracy |
| audio_transformer | Transformer over spectrogram frames | `audio_transformer` | accuracy |
| audio_melspectrogram | 2D CNN on mel-spectrograms | `audio_melspectrogram` | accuracy |
| tabular_classifier | MLP classifier on Iris (tabular) | `tabular_classifier` | accuracy |
| mobilenet | Tiny MobileNet-like CNN baseline (depthwise-separable) | `mobilenet` | accuracy |
| convnext | Tiny ConvNeXt-like CNN baseline (modern conv recipe) | `convnext` | accuracy |
| vision_embed | Vision embedding encoder (contrastive retrieval) | `vision_embed` | eval_loss |
| text_seq2seq | Transformer encoder-decoder (seq2seq) | `text_seq2seq` | eval_loss |
| text_token_classifier | Token classifier (vowel vs other, bidirectional) | `text_token_classifier` | eval_loss |
| pixelcnn | PixelCNN-lite autoregressive image model | `pixelcnn` | judge_score |
| tabular_diffusion | Diffusion for tabular data synthesis | `tabular_diffusion` | eval_loss |
| wgan | WGAN: Wasserstein critic + weight clipping fixes GAN mode collapse | `wgan` | judge_score |
| vqvae | VQ-VAE: discrete codebook latent + straight-through estimator | `vqvae` | eval_loss |
| **cyclegan** | Unpaired MNIST↔Fashion translation: cycle-consistency + PatchGAN + image pool | `cyclegan` | eval_loss (cycle error) |
| **swin** | Swin Transformer: windowed + shifted-window attention hierarchy | `swin` | accuracy |
| **convlstm** | ConvLSTM: spatio-temporal next-frame prediction on Moving-MNIST | `convlstm` | eval_loss (MSE) |
| **dcrnn** | DCRNN: graph diffusion convolution + GRU for sensor-graph forecasting | `dcrnn` | eval_loss (MSE) |

Plus **23 compositions** (multi-model pipelines) — list them with
`uv run python main.py list` and gate them with
`uv run python main.py sweep --check --models <name>`. The newest is
**gan_ada** (Adaptive Discriminator Augmentation on the `gan` mini: a
non-leaking augmentation pipeline applied to reals + fakes at an adaptively
tuned probability p, steered by the E[sign(D_real)] controller — StyleGAN2-ADA).

## Dedicated smoke tests

Every model is exercised by `test_registry_train_eval_smoke` (train + eval on
nano data). Several minis also have a focused forward-pass test asserting exact
tensor shapes and a finite backward pass:

| Test | Asserts |
|---|---|
| `test_wgan_forward_and_clipping_smoke` | critic emits a raw score; weight clipping bounds params |
| `test_vqvae_forward_and_ste_smoke` | reconstruction + gradient reaches the encoder via STE |
| `test_cyclegan_forward_and_cycle_smoke` | A→B→A round-trip; PatchGAN outputs a 7×7 logit map; image pool recycles |
| `test_swin_forward_and_shift_mask_smoke` | classifies 28×28; window partition/reverse are exact inverses; shifted block builds a −100 mask |
| `test_convlstm_forward_and_rollout_smoke` | ConvLSTM cell carries a spatial state; net rolls out future frames (teacher-forced + open-loop) |
| `test_dcrnn_forward_and_diffusion_smoke` | diffusion conv over dual random-walk supports; encoder-decoder forecasts a horizon |
| `tests/test_gan_ada.py` (`TestADAController` · `TestAdaptiveAugment` · `TestGANADAIntegration`) | ADA controller raises p on high r_t / lowers on low, clamps [0,1]; augmentation fires at ≈rate p and is shape-preserving; one CPU train step updates p with no NaN |

Run any one with:

```bash
uv run pytest tests/test_smoke_models.py::test_cyclegan_forward_and_cycle_smoke -q
```
