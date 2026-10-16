"""Tabular-text contrastive composition with ONE cross-attention encoder.

The tabular sibling of audio_text_contrastive. Each row of Iris (4 numeric
features, 3 classes) is paired with a templated caption of its class index,
and the zoo's CrossModalEncoder (``modality="tabular"``) fuses them:

    features [B,4] -> TabularFeatureEncoder (Linear(1->D) per feature) -> [B,4,D]
    caption  [B,32] -> TextEncoder                                     -> [B,32,D]
    text tokens attend to feature tokens -> mean pool -> L2-normalise -> [B,D]

Treating every feature as its own token is what lets attention pick which
columns matter for a given caption. As with every single-embedding
composition, ContrastiveCompositionBase trains it on self-similarity logits
``emb @ emb.T / tau`` (instance discrimination), not two-tower alignment.

Deliberately simplified: captions reuse the digit caption templates for the
class index, no feature normalisation or column-type embeddings, and a
single cross-attention block. ``temperature`` is not a field here, so the
base's default of 0.2 applies.
"""
from __future__ import annotations

from typing import Any

import torch
import torch.nn.functional as F

from mini_networks.core.config import BaseConfig
from mini_networks.core.data.registry import get_dataloader
from mini_networks.models.multimodal.blocks import CrossModalEncoder
from mini_networks.compositions.base import ContrastiveCompositionBase


class TabularTextCrossAttentionConfig(BaseConfig):
    """Knobs: ``d_model`` (fused width), ``n_features`` (must match the
    dataset's column count — 4 for Iris), ``text_seq_len`` / ``vocab_size``."""

    model_name: str = "tabular_text_cross_attention"
    d_model: int = 64
    vocab_size: int = 256
    text_seq_len: int = 32
    n_features: int = 4
    dataset: str = "iris"
    require_downloads: bool = True


class TabularTextCrossAttention(ContrastiveCompositionBase):
    """Early-fusion tabular+caption encoder trained with self-similarity InfoNCE."""

    def __init__(self):
        super().__init__()

    def _build(self, config: TabularTextCrossAttentionConfig) -> CrossModalEncoder:
        """The fused encoder: text queries cross-attend to one token per feature."""
        return CrossModalEncoder(
            modality="tabular",
            d_model=config.d_model,
            vocab_size=config.vocab_size,
            fusion="cross_attention",
            n_features=config.n_features,
        ).to(config.device)

    def _build_modules(self, config: TabularTextCrossAttentionConfig) -> dict[str, torch.nn.Module]:
        """A single ``"model"`` module, so the base saves it as ``model.pt``."""
        return {"model": self._build(config)}

    def _get_dataloader(self, config: TabularTextCrossAttentionConfig):
        """Train split of ``config.dataset`` yielding ``(features [B,F], label [B])``."""
        return get_dataloader(
            name=config.dataset,
            data_root=config.data_root,
            split="train",
            batch_size=config.effective_batch_size,
            fast_demo=config.effective_fast_demo,
            sample_limit=config.dataset_sample_limit,
            n_features=config.n_features,
            require_downloads=config.require_downloads,
        )

    def _encode_pair(self, modules, primary, tokens, config: TabularTextCrossAttentionConfig):
        """(features [B,F], tokens [B,L]) -> one fused unit embedding [B,D]."""
        model = modules["model"]
        emb = model(primary, tokens)
        return F.normalize(emb, dim=-1)

    def _infer_embeddings(self, config: TabularTextCrossAttentionConfig, inputs: dict[str, Any]) -> torch.Tensor:
        """Fused embedding [B,D] for ``inputs["features"]`` + captions of ``inputs["labels"]``.

        Note: returned un-normalised (training normalises before the loss).
        """
        model = self.modules["model"]
        model.eval()
        feats = self._as_tensor(inputs, "features").to(config.device)
        labels = self._as_tensor(inputs, "labels", dtype=torch.long)
        tokens = self._prepare_tokens(labels, config).to(config.device)
        with torch.no_grad():
            emb = model(feats, tokens)
        return emb
