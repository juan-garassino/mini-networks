"""Config for the mini Vision Transformer: patch size and encoder dimensions."""
from __future__ import annotations
from mini_networks.core.config import BaseConfig


class ViTConfig(BaseConfig):
    """Hyperparameters for :class:`MiniViT`.

    ``patch_size`` must divide 28 (4 -> 7x7 = 49 patch tokens); ``mlp_dim`` is
    the feed-forward width inside each encoder layer.
    """
    model_name: str = "vit"
    patch_size: int = 4
    d_model: int = 64
    n_heads: int = 4
    n_layers: int = 4
    mlp_dim: int = 128
    num_classes: int = 10
    dataset: str = "mnist"
