"""MobileNet trainer: TinyMobileNet on the shared image-classification loader."""
from __future__ import annotations

from mini_networks.core.data.registry import make_classification_dataloader
from mini_networks.core.runtime import SupervisedTrainer
from mini_networks.models.mobilenet.config import MobileNetConfig
from mini_networks.models.mobilenet.model import TinyMobileNet


class MobileNetTrainer(SupervisedTrainer):
    """Cross-entropy classifier training for :class:`TinyMobileNet`.

    Only ``_build`` lives here; the train/evaluate/infer loops come from
    ``SupervisedTrainer`` (evaluate returns ``eval_loss`` + ``accuracy``;
    infer returns ``predictions`` + ``logits``). Checkpoint: ``model.pt``.
    """
    def __init__(self):
        self.model: TinyMobileNet | None = None

    def _build(self, config: MobileNetConfig) -> TinyMobileNet:
        return TinyMobileNet(num_classes=config.num_classes, width_mult=config.width_mult).to(config.device)


make_mobilenet_dataloader = make_classification_dataloader
