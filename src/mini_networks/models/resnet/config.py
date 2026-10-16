"""Config for the mini ResNet: stem width and class count."""
from __future__ import annotations
from mini_networks.core.config import BaseConfig


class ResNetConfig(BaseConfig):
    """Hyperparameters for :class:`MiniResNet`; ``base_channels`` is the stem width,
    doubled by each stride-2 block.
    """
    model_name: str = "resnet"
    base_channels: int = 32
    num_classes: int = 10
    dataset: str = "mnist"
