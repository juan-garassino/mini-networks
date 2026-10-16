"""ConvNeXt trainer: TinyConvNeXt on the shared image-classification loader."""
from __future__ import annotations

from mini_networks.core.data.registry import make_classification_dataloader
from mini_networks.core.runtime import SupervisedTrainer
from mini_networks.models.convnext.config import ConvNeXtConfig
from mini_networks.models.convnext.model import TinyConvNeXt


class ConvNeXtTrainer(SupervisedTrainer):
    """Cross-entropy training of TinyConvNeXt; only `_build` is model-specific.

    Inherits SupervisedTrainer's loop: `model.pt` checkpoint, evaluate ->
    {"eval_loss", "accuracy"}, infer -> {"predictions", "logits"}.
    """

    def __init__(self):
        self.model: TinyConvNeXt | None = None

    def _build(self, config: ConvNeXtConfig) -> TinyConvNeXt:
        return TinyConvNeXt(base_channels=config.base_channels, num_classes=config.num_classes).to(config.device)


# (images [B, 1, 28, 28], labels [B]) from config.dataset — see core/data/registry.py
make_convnext_dataloader = make_classification_dataloader
