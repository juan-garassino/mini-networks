"""CLIP trainer: ContrastiveTrainer loop with CLIP's own symmetric InfoNCE."""
from __future__ import annotations

from typing import Any

import torch
from torch.utils.data import DataLoader

from mini_networks.core.config import BaseConfig
from mini_networks.core.runtime import ContrastiveTrainer
from mini_networks.models.clip.config import CLIPConfig
from mini_networks.core.data.registry import get_dataloader
from mini_networks.models.clip.model import CLIPModel


class CLIPTrainer(ContrastiveTrainer):
    """Train CLIPModel on (image, caption tokens, label) MNIST batches.

    The ContrastiveTrainer loop is reused with AdamW and `_loss` delegated to
    `CLIPModel.contrastive_loss` (learned temperature; the base class's fixed
    `temperature` argument is ignored). The label is unused in training.
    Checkpoint: `model.pt`. evaluate() -> {"eval_loss"} (mean InfoNCE).
    """

    def __init__(self):
        self.model: CLIPModel | None = None

    def _build(self, config: CLIPConfig) -> CLIPModel:
        return CLIPModel(
            embed_dim=config.embed_dim,
            vocab_size=config.vocab_size,
            text_d_model=config.text_d_model,
            text_n_heads=config.text_n_heads,
            text_n_layers=config.text_n_layers,
            text_seq_len=config.text_seq_len,
            temperature=config.temperature,
        ).to(config.device)

    def _optimizer(self, model: CLIPModel, config: CLIPConfig):
        return torch.optim.AdamW(model.parameters(), lr=config.learning_rate)

    def _forward(self, model: CLIPModel, batch, config: CLIPConfig):
        images, tokens, _ = batch
        images = images.to(config.device)
        tokens = tokens.to(config.device)
        return model(images, tokens)

    def _loss(self, emb_a: torch.Tensor, emb_b: torch.Tensor, temperature: float = 0.2) -> torch.Tensor:
        if self.model is None:
            raise RuntimeError("Model not initialized.")
        return self.model.contrastive_loss(emb_a, emb_b)

    def infer(self, config: BaseConfig, inputs: Any) -> Any:
        """Embed ONE modality per call.

        inputs {"images": [B, 1, 28, 28]} -> {"image_embeds": [B, D]}, or
        {"tokens": [B, seq_len]} -> {"text_embeds": [B, D]} (unit-norm, CPU).
        Images win if both are given; anything else returns {}. Zero-shot
        classification = argmax of image_embeds @ text_embeds.T.
        """
        assert isinstance(config, CLIPConfig)
        if self.model is None:
            raise RuntimeError("Model not loaded. Call train() first or load a checkpoint.")
        self.model.eval()
        with torch.no_grad():
            if isinstance(inputs, dict):
                if "images" in inputs:
                    images = inputs["images"].to(config.device)
                    return {"image_embeds": self.model.encode_image(images).cpu()}
                if "tokens" in inputs:
                    tokens = inputs["tokens"].to(config.device)
                    return {"text_embeds": self.model.encode_text(tokens).cpu()}
        return {}


def make_clip_dataloader(config: CLIPConfig, split: str = "train") -> DataLoader:
    """MNIST image-text pairs: (images [B, 1, 28, 28], tokens [B, seq_len], labels [B]).

    Each item draws a random caption for its digit, so the same image gets
    different text across epochs.
    """
    return get_dataloader(
        name="mnist",
        data_root=config.data_root,
        split=split,
        task="clip",
        batch_size=config.effective_batch_size,
        fast_demo=config.effective_fast_demo,
        sample_limit=config.dataset_sample_limit,
        seq_len=config.text_seq_len,
        vocab_size=config.vocab_size,
    )
