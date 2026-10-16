"""Multimodal fusion baseline: image + caption -> digit class.

Wraps the zoo's MultiModalEncoder with a linear classification head and
trains it end to end with cross-entropy:

    image  [B,1,28,28] -> vision encoder ─┐
    caption tokens [B,32] -> TextEncoder ─┴─ fusion -> [B,D] -> Linear -> [B,10]

``fusion`` picks how the two streams meet: ``"concat"`` (pooled vectors
concatenated and projected — the default late fusion), ``"gated"`` (learned
per-dimension convex blend) or ``"cross_attention"`` (text tokens attend to
image patch tokens). Swapping that one string is the experiment.

Deliberately simplified — read the accuracy with care: the caption is a
template of the TRUE label, so the text stream alone already contains the
answer. This is a plumbing baseline for the fusion operators, not evidence
that the model fuses two informative signals; an honest multimodal test
would corrupt or withhold the caption.
"""
from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F

from mini_networks.core.config import BaseConfig
from mini_networks.core.data.registry import get_dataloader
from mini_networks.core.logging.logger import Logger
from mini_networks.models.multimodal.blocks import MultiModalEncoder
from mini_networks.models.clip.data import label_to_tokens


class MultimodalFusionConfig(BaseConfig):
    """Knobs: ``fusion`` (``"concat"`` | ``"gated"`` | ``"cross_attention"``),
    ``d_model`` (shared width), ``text_seq_len`` / ``vocab_size`` (caption
    tokenisation), ``num_classes``."""

    model_name: str = "multimodal_fusion_baseline"
    d_model: int = 64
    vocab_size: int = 256
    text_seq_len: int = 32
    num_classes: int = 10
    fusion: str = "concat"
    dataset: str = "mnist"


class FusionClassifier(nn.Module):
    """MultiModalEncoder + Linear head."""

    def __init__(self, d_model: int, vocab_size: int, fusion: str, num_classes: int):
        super().__init__()
        self.encoder = MultiModalEncoder(d_model=d_model, vocab_size=vocab_size, fusion=fusion)
        self.head = nn.Linear(d_model, num_classes)

    def forward(self, images: torch.Tensor, tokens: torch.Tensor) -> torch.Tensor:
        """(images [B,1,28,28], tokens [B,L]) -> [B,num_classes] logits."""
        emb = self.encoder(images, tokens)
        return self.head(emb)


class MultimodalFusionBaseline:
    """Trains a FusionClassifier on (MNIST image, label caption) -> label."""

    def __init__(self):
        self.model: FusionClassifier | None = None

    def train(self, config: MultimodalFusionConfig, logger: Logger) -> None:
        """Cross-entropy training; logs ``loss`` per epoch and saves ``model.pt``."""
        dl = get_dataloader(
            name=config.dataset,
            data_root=config.data_root,
            split="train",
            task="classification",
            batch_size=config.effective_batch_size,
            fast_demo=config.effective_fast_demo,
            sample_limit=config.dataset_sample_limit,
        )
        model = FusionClassifier(
            d_model=config.d_model,
            vocab_size=config.vocab_size,
            fusion=config.fusion,
            num_classes=config.num_classes,
        ).to(config.device)
        self.model = model
        opt = torch.optim.Adam(model.parameters(), lr=config.learning_rate)

        for epoch in range(config.effective_epochs):
            total = 0.0
            for images, labels in dl:
                images = images.to(config.device)
                labels = labels.to(config.device)
                tokens = torch.stack([
                    label_to_tokens(int(l), config.text_seq_len, config.vocab_size)
                    for l in labels
                ], dim=0).to(config.device)
                logits = model(images, tokens)
                loss = F.cross_entropy(logits, labels)
                opt.zero_grad()
                loss.backward()
                opt.step()
                total += loss.item()
            logger.log_metrics(epoch, {"loss": total / max(1, len(dl))})

        torch.save(model.state_dict(), logger.artifact_path("model.pt"))
