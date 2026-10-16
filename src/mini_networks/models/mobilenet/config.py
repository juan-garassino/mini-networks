"""Config for the tiny MobileNet: width multiplier and class count."""
from __future__ import annotations
from mini_networks.core.config import BaseConfig


class MobileNetConfig(BaseConfig):
    """Hyperparameters for :class:`TinyMobileNet`; ``width_mult`` scales every channel
    count (stem = int(32 * width_mult)).
    """
    model_name: str = "mobilenet"
    width_mult: float = 1.0
    num_classes: int = 10
    dataset: str = "mnist"
