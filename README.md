# mini_networks

An educational ML playground that unifies vision, language, RL, and multimodal experiments into a single, Colab-friendly product. The focus is on consistency: one runtime contract, one data registry, one logging format, and clear compositions that show how models can interoperate.

**Quick Start**

Commands run through `uv run` so the project environment is used (bare
`python main.py …` uses the system interpreter and fails on missing torch).
1. Install dependencies.
```
uv sync --dev
```
2. List the 50 models and 23 compositions with their taxonomy.
```
uv run python main.py list
```
3. Train a model (fast demo).
```
uv run python main.py train --model diffusion --fast_demo
```
4. Evaluate from a checkpoint.
```
uv run python main.py evaluate --model diffusion --checkpoint runs/diffusion/<timestamp>/artifacts
```
5. Run a composition.
```
uv run python main.py compose --composition clip_guided_diffusion --fast_demo
```
6. Run the quality gate (trains everything, checks thresholds + checkpoints, writes a report).
```
uv run python main.py sweep --check --training_tier S --device cpu
```

**Training tiers** — every config honors `--training_tier`:
- `S` — nano smoke run (1 epoch, 1 minibatch, 25 diffusion steps); what CI runs. `--fast_demo` forces S.
- `M` — the "actually learns" bar (≤5 epochs, ≤100 batches/epoch, batch ≤64); EvalSpec thresholds gate here. Runs on a GPU (the GCP L4 sweep job, or a Colab GPU kernel) — not meant for a laptop CPU.
- `L` — full budget.

The gate report lands in `runs/sweep/<timestamp>/report.{md,json}`. Per-model
thresholds live in `src/mini_networks/core/evalspec.py`. Rerun one item:
`python main.py sweep --check --models gan --skip-compositions`.

**Colab workflow** — the notebooks in `colab/notebooks/` are optional. Their
first cell clones this repo into `/content/mini-networks` and `pip install -e`s
it on Colab (or locates the repo root in a local checkout), so each notebook
opens standalone. `00_sweep.ipynb` runs the quality gate (M on a GPU kernel,
S on CPU); `01`–`04` train nano (S-tier) runs of vision, language, RL and
composition models and plot/sample them (uses matplotlib, preinstalled on
Colab). See `docs/TESTING.md` § Colab notebooks.

**What’s Inside**
- `src/mini_networks/` contains the unified runtime, data registry, and model implementations.
- `legacy/` is reference-only and will be removed or archived later.
- `runs/` stores all outputs in a consistent structure.

**Refactor Notes**
- Trainer logic is centralized in shared base classes (`SupervisedTrainer`, `ContrastiveTrainer`, etc.).
- Diffusion sampling uses a single driver to keep guidance + logging consistent.
- Multimodal contrastive compositions share a base and expose `infer(config, inputs)` with standard keys.

**Models**
Vision:
- `classifier` Small CNN classifier for MNIST/FashionMNIST.
- `mobilenet` Tiny MobileNet-like CNN baseline.
- `convnext` Tiny ConvNeXt-like CNN baseline.
- `resnet` Mini ResNet baseline.
- `vit` Mini ViT baseline.
- `segmentation` UNet binary or multiclass segmentation.
- `detection` YOLO-style digit localization on 56×56 canvas.
- `vision_embed` Contrastive vision embedding encoder.
- `simclr` SimCLR-lite self-supervised pretraining.
- `dino` DINO self-distillation ViT (EMA teacher, no labels).
- `swin` Swin Transformer: windowed + shifted-window attention hierarchy.
- `rpp_classifier` Residual Pathway Priors: equivariance as a soft prior.
- `sam` Mini SAM: promptable segmentation (clicks choose which digit).
- `nerf` Mini NeRF: voxel-digit scene as a continuous field, novel-view PSNR.
- `convlstm` ConvLSTM next-frame prediction on Moving-MNIST.

Generative vision:
- `gan` MLP GAN baseline for MNIST.
- `diffusion` DDPM denoising with EMA + curriculum options.
- `pixelcnn` PixelCNN-lite autoregressive model.
- `vae` Convolutional VAE reconstruction.
- `unet_ae` UNet autoencoder reconstruction.
- `vqvae` VQ-VAE: discrete codebook + straight-through estimator.
- `wgan` WGAN: Wasserstein critic + weight clipping.
- `cyclegan` Unpaired MNIST↔Fashion translation (cycle-consistency + PatchGAN).

Audio:
- `audio_classifier` 1D CNN classifier on speech digits.
- `audio_spectrogram` 2D CNN over STFT magnitude.
- `audio_transformer` Transformer over spectrogram frames.
- `audio_melspectrogram` 2D CNN over mel-spectrograms.

Tabular:
- `tabular_classifier` MLP/linear/transformer classifier (Iris).
- `tabular_diffusion` Diffusion model for tabular synthesis.

Language:
- `transformer` Character-level TransformerLM on Tiny Shakespeare.
- `moe` Mixture-of-Experts LM (router + top-1 experts + balance loss).
- `mamba` NanoMamba state-space model.
- `kimi` Mini Kimi K3 (KDA linear-attention hybrid + AttnRes + LatentMoE).
- `deepseek` Mini DeepSeek V4 (compressed attention + mHC + MTP).
- `text_diffusion` LLaDA-mini masked-diffusion char-LM.
- `rnn` RNN / LSTM / GRU language model.
- `text_seq2seq` Transformer encoder-decoder.
- `text_token_classifier` Token classifier (vowel vs other).
- `rag` TF‑IDF retrieval + TransformerLM generation.
- `rlhf` PPO fine‑tuning with heuristic Shakespearean reward.
- `grpo` GRPO: group-relative advantages, no value net.
- `dpo` DPO: preference pairs, implicit KL via a reference model.
- `lora` LoRA adapter fine‑tuning (MNIST → FashionMNIST).

Multimodal:
- `clip` Contrastive image–text matching on MNIST.

Reinforcement learning:
- `rl_maze` Q / DQN / PPO agents on a procedural maze.
- `reinforce` REINFORCE policy gradient on a procedural maze.
- `alphazero` Mini AlphaZero: MCTS self-play on tic-tac-toe.

Graphs and studies:
- `gnn` Graph convolutional network: node classification on an SBM.
- `dcrnn` Diffusion-convolution GRU for sensor-graph forecasting.
- `grokking` Delayed generalization on modular division (a/b mod 97).

**Compositions**
- `clip_guided_diffusion` CLIP similarity guides diffusion sampling.
- `transformer_clip_diffusion` LM → CLIP → diffusion pipeline.
- `gan_diffusion_comparison` side‑by‑side visual comparison.
- `clip_guided_gan` CLIP similarity in GAN training.
- `classifier_guided_diffusion` classifier gradient guidance for diffusion.
- `rag_guided_generation` retrieve context then generate.
- `lora_lm` LoRA adapter fine‑tuning for TransformerLM.
- `segment_then_detect` segmentation → bbox.
- `multitask_vision` shared encoder with multiple heads.
- `diffusion_distillation` teacher/student diffusion distillation.
- `audio_text_contrastive` audio-text contrastive alignment.
- `tabular_text_cross_attention` tabular-text cross-attention alignment.
- `audio_text_dual_encoder` audio-text dual-encoder.
- `tabular_text_dual_encoder` tabular-text dual-encoder.
- `classifier_guided_gan` classifier-guided GAN.
- `rag_conditioned_diffusion` RAG-conditioned diffusion.
- `image_captioning` image captioning from MNIST digits.
- `multimodal_fusion_baseline` image+text fusion baseline.
- `latent_diffusion` latent diffusion (VAE + UNet).
- `mode_connect` loss-surface simplex between two classifiers + simplex ensemble.
- `double_descent` width sweep on label-noised MNIST.
- `vlm` vision patch prefix + causal LM answering templated MNIST questions.
- `gan_ada` GAN + Adaptive Discriminator Augmentation (StyleGAN2-ADA controller).

**Data Registry**
The shared registry lives in `src/mini_networks/core/data/registry.py`.
- Vision datasets: `mnist`, `fashion_mnist`.
- Vision task modes: `classification`, `binary_segmentation`, `multiclass_segmentation`, `detection`, `clip`, `contrastive`.
- Text datasets: `text_file`, `tiny_shakespeare`.

**Logging and Outputs**
Every run writes to:
- `runs/<project>/<timestamp>/metrics.jsonl`
- `runs/<project>/<timestamp>/config.yaml`
- `runs/<project>/<timestamp>/artifacts/`

**Colab**
Use the launcher for a guided workflow:
```
from mini_networks.colab.launcher import interactive_menu
interactive_menu()
```

**API Server & Playground**
```
python main.py serve --host 0.0.0.0 --port 8000
```
- **Playground** at `/` — a Next.js static export (`playground/`, build it
  with `make playground`; `playground/out` is gitignored) that reads the run
  contract via `/web`: models/taxonomy, runs, loss curves, artifacts. It's a
  pure reader; training is unchanged.
- API docs at `/docs`. Read-layer endpoints under `/web` (`/web/runs`,
  `/web/runs/{id}/metrics`, `/web/models`, …).

Composition endpoints:
- `POST /compose/{composition_name}` starts training in the background.
- `POST /compose/{composition_name}/infer` runs inference for a composition.

**GCP ephemeral training (M/L)**
M/L training runs on GCP Cloud Run Jobs and logs runs + registered models to
the global `garassino-mlflow` tracker (Cloud Run + Cloud SQL). Two shapes,
nothing runs at rest:
- single train: a Pub/Sub message launches one ephemeral job (`MODE=train`);
- full sweep: `make -C infra/gcp sweep TIER=M` executes ONE parallel L4 job
  where every model + composition is its own task running the quality gate;
  `make -C infra/gcp sweep-report SWEEP=<id>` merges the per-item shards into
  one report. Gate-passing M/L checkpoints become `mini-<model>` registry
  versions with champion/challenger promotion.

The playground reads MLflow with `MN_RUN_SOURCE=mlflow`. Build/validate
without touching the cloud:
```
make -C infra/gcp validate       # terraform fmt-check + validate
make -C infra/gcp dry-run        # train image vs a local sqlite MLflow
make -C infra/gcp dry-run-sweep  # one sweep-task shard, local only
```
Provisioning + the env-var contract are documented in `infra/gcp/README.md`.

**Docs**
Start here:
- `docs/README.md` — the ordered curriculum index
- `docs/01-data.md` — dataset registry, task modes, text/audio/tabular sets
- `docs/09-clip-multimodal.md` — contrastive dual encoders + fusion blocks
- `docs/11-compositions.md` — multi-model pipelines and the runner contract
- `docs/TESTING.md` — how to run any mini, the smoke tests, and the per-model gate table

**Tests**
```
make test                    # fast suite (slow marker deselected)
make validate-s DEVICE=cpu   # full S-tier quality gate, what CI runs
```
Smoke tests are in `tests/test_smoke_models.py` and `tests/test_smoke_registry.py`;
`tests/test_colab_notebooks.py` statically checks the Colab notebooks against
the current API.
