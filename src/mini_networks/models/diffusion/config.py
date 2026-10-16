"""Config for the pixel-space DDPM on MNIST (unconditional UNet).

Notable defaults: a 1000-step linear beta chain (tier-capped via
`effective_timesteps`, which must drive BOTH the scheduler and sampling),
base_channels=32, and EMA decay 0.995 (see the comment below for why not
the paper's 0.9999).
"""
from __future__ import annotations
from typing import Literal
from mini_networks.core.config import BaseConfig


class DiffusionConfig(BaseConfig):
    """DDPM: UNet noise predictor + NoiseScheduler + optional EMA/curriculum/warmup."""

    model_name: str = "diffusion"
    timesteps: int = 1000      # chain length T at L; read via config.effective_timesteps
    schedule: Literal["linear", "cosine"] = "linear"
    beta_start: float = 1e-4   # linear schedule endpoints, calibrated for T=1000
    beta_end: float = 0.02     # (NoiseScheduler rescales them for shorter chains)
    image_size: int = 28
    in_channels: int = 1
    base_channels: int = 32    # UNet widths c, 2c, 4c
    dataset: str = "mnist"

    # EMA (Exponential Moving Average) of model weights — improves sample quality.
    # 0.995, NOT the paper's 0.9999: with M-tier's ~1000 steps, 0.9999 leaves
    # the EMA ≈90% initial random weights (0.9999^1000≈0.905) and
    # load_checkpoint PREFERS model_ema.pt — the gate was scoring a
    # near-random model (noise samples, 2026-07-11 audit). 0.995 converges in
    # a few hundred steps.
    ema_decay: float = 0.995    # set to 0.0 to disable EMA

    # Curriculum learning — train on harder (higher-variance) images first
    curriculum: bool = False    # if True, sort batches by image complexity

    # LR warmup — ramp learning rate from 0 to lr over warmup_steps
    warmup_steps: int = 0       # set > 0 to enable warmup
