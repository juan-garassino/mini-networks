"""RPP classifier trainer — SupervisedTrainer + per-pathway prior penalty."""
from __future__ import annotations

import torch

from mini_networks.core.data.registry import make_classification_dataloader
from mini_networks.core.runtime import SupervisedTrainer
from mini_networks.models.rpp_classifier.config import RPPClassifierConfig
from mini_networks.models.rpp_classifier.model import RPPClassifier


class RPPClassifierTrainer(SupervisedTrainer):
    """Cross-entropy training for :class:`RPPClassifier` plus the per-pathway prior penalty.

    The penalty ``prior_conv * ||W_conv||^2 + prior_mlp * ||W_free||^2`` is
    added only in training mode, so ``eval_loss`` stays plain CE. Loops,
    ``evaluate`` (``eval_loss`` + ``accuracy``) and the ``model.pt``
    checkpoint come from ``SupervisedTrainer``.
    """
    def __init__(self):
        self.model: RPPClassifier | None = None
        self._config: RPPClassifierConfig | None = None

    def _build(self, config: RPPClassifierConfig) -> RPPClassifier:
        self._config = config
        return RPPClassifier(
            hidden_dim=config.hidden_dim, num_classes=config.num_classes
        ).to(config.device)

    def _loss(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        ce = super()._loss(logits, targets)
        # The RPP prior is an explicit L2 term in the objective (MAP under
        # Gaussian priors) — applied only while training so eval_loss stays CE.
        if self.model is not None and self.model.training and self._config is not None:
            ce = ce + self.model.prior_penalty(
                self._config.prior_conv, self._config.prior_mlp
            )
        return ce


make_rpp_classifier_dataloader = make_classification_dataloader
