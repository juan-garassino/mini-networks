"""Config for the tiny ConvNeXt image classifier (MNIST by default)."""
from __future__ import annotations
from mini_networks.core.config import BaseConfig


class ConvNeXtConfig(BaseConfig):
    """TinyConvNeXt on 28x28 grayscale images; channels double per stage."""

    model_name: str = "convnext"
    base_channels: int = 32  # stage widths c, 2c, 4c (32/64/128 by default)
    num_classes: int = 10
    dataset: str = "mnist"
