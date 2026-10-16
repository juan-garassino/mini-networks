"""Config for the segmentation UNet: binary vs multiclass task and output width."""
from __future__ import annotations
from typing import Literal
from mini_networks.core.config import BaseConfig


class SegmentationConfig(BaseConfig):
    """Hyperparameters for :class:`SegUNet` segmentation.

    ``task_mode="binary"`` predicts a foreground mask (1 sigmoid channel);
    ``"multiclass"`` predicts per-pixel classes over the two-digit overlay
    dataset, which has 12 classes (digits 0-9, 10 = background, 11 =
    overlap), so set ``num_classes=12`` for that mode. ``input_size`` is
    informational; the UNet is built for 28x28.
    """
    model_name: str = "segmentation"
    task_mode: Literal["binary", "multiclass"] = "binary"
    num_classes: int = 1
    input_size: int = 28
    base_channels: int = 32
    dataset: str = "mnist"

    @property
    def out_channels(self) -> int:
        """UNet output channels: 1 for binary, ``num_classes`` for multiclass."""
        return 1 if self.task_mode == "binary" else self.num_classes
