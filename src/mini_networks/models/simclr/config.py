"""Config for SimCLR: projection size and InfoNCE temperature."""
from __future__ import annotations
from mini_networks.core.config import BaseConfig


class SimCLRConfig(BaseConfig):
    """Hyperparameters for :class:`SimCLREncoder`; ``temperature`` divides the cosine similarities in InfoNCE (lower = sharper)."""
    model_name: str = "simclr"
    proj_dim: int = 64
    temperature: float = 0.2
    dataset: str = "mnist"
