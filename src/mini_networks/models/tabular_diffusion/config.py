"""Config for DDPM over tabular rows: noise schedule and denoiser width."""
from __future__ import annotations
from mini_networks.core.config import BaseConfig


class TabularDiffusionConfig(BaseConfig):
    """Hyperparameters for :class:`TabularDenoiser` and its noise schedule.

    ``timesteps`` is the chain length before tier capping (use
    ``config.effective_timesteps``); ``beta_start``/``beta_end`` are the
    linear schedule endpoints, calibrated for T=1000 and rescaled by
    :class:`TabularNoiseScheduler`.
    """
    model_name: str = "tabular_diffusion"
    n_features: int = 4
    timesteps: int = 200
    beta_start: float = 1e-4
    beta_end: float = 0.02
    hidden_dim: int = 128
    dataset: str = "iris"
    require_downloads: bool = True
