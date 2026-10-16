"""Classifier trainer: SmallCNN on the shared image-classification loader."""
from __future__ import annotations

from mini_networks.core.data.registry import make_classification_dataloader
from mini_networks.core.runtime import SupervisedTrainer
from mini_networks.models.classifier.config import ClassifierConfig
from mini_networks.models.classifier.model import SmallCNN


class ClassifierTrainer(SupervisedTrainer):
    """Cross-entropy training of SmallCNN; everything but `_build` is inherited.

    SupervisedTrainer supplies the loop: Adam, per-epoch loss/accuracy,
    resumable training state, `model.pt` checkpoint, evaluate ->
    {"eval_loss", "accuracy"}, infer -> {"predictions", "logits"}.
    """

    def __init__(self):
        self.model: SmallCNN | None = None

    def _build(self, config: ClassifierConfig) -> SmallCNN:
        return SmallCNN(hidden_dim=config.hidden_dim, num_classes=config.num_classes).to(config.device)


# (images [B, 1, 28, 28], labels [B]) from config.dataset — see core/data/registry.py
make_classifier_dataloader = make_classification_dataloader
