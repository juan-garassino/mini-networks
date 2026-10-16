"""Config for the single-digit detector (one MNIST digit on a 56x56 canvas)."""
from __future__ import annotations
from mini_networks.core.config import BaseConfig


class DetectionConfig(BaseConfig):
    """DigitDetector: classify + localise one digit pasted at a random spot."""

    model_name: str = "detection"
    canvas_size: int = 56          # square canvas side in px (digit is 28x28)
    num_classes: int = 10
    bbox_loss_weight: float = 1.0  # w in CE + w * MSE(bbox)
    dataset: str = "mnist"
