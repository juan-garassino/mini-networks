"""Tabular-text dual-encoder: CLIP-style alignment of table rows and captions.

The tabular sibling of audio_text_dual_encoder. Two independent towers map an
Iris row and a caption of its class into one shared space:

    features [B,4] -> TabularFeatureEncoder -> [B,4,D]  -> mean pool -> L2 -> f [B,D]
    caption  [B,32] -> TextEncoder          -> [B,32,D] -> mean pool -> L2 -> t [B,D]
    loss = cross_entropy(f @ t.T / temperature, arange(B))

Each tower embeds its modality alone, so rows can be retrieved by a text
query with one dot product. After training the base logs label-match@1 and
writes an ``alignment.png`` similarity heatmap.

Deliberately simplified: captions reuse the digit caption templates for the
class index (only 3 distinct classes, so in-batch "negatives" often share
the positive's label), no feature normalisation, and a fixed temperature.
"""
from __future__ import annotations

from typing import Any

import torch
import torch.nn.functional as F

from mini_networks.core.config import BaseConfig
from mini_networks.core.data.registry import get_dataloader
from mini_networks.models.multimodal.encoders import TabularFeatureEncoder, TextEncoder, pool_sequence
from mini_networks.compositions.base import ContrastiveCompositionBase


class TabularTextDualEncoderConfig(BaseConfig):
    """Knobs: ``d_model`` (shared embedding width), ``temperature`` (InfoNCE
    sharpness), ``n_features`` (dataset column count — 4 for Iris)."""

    model_name: str = "tabular_text_dual_encoder"
    d_model: int = 64
    vocab_size: int = 256
    text_seq_len: int = 32
    n_features: int = 4
    temperature: float = 0.2
    dataset: str = "iris"
    require_downloads: bool = True


class TabularTextDualEncoder(ContrastiveCompositionBase):
    """Separate tabular and text towers aligned by in-batch InfoNCE."""

    def __init__(self):
        super().__init__()

    def _build_modules(self, config: TabularTextDualEncoderConfig) -> dict[str, torch.nn.Module]:
        """The two towers, saved as ``tab.pt`` and ``text.pt``."""
        return {
            "tab": TabularFeatureEncoder(n_features=config.n_features, d_model=config.d_model).to(config.device),
            "text": TextEncoder(vocab_size=config.vocab_size, d_model=config.d_model).to(config.device),
        }

    def _get_dataloader(self, config: TabularTextDualEncoderConfig):
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

    def _encode_pair(self, modules, primary, tokens, config: TabularTextDualEncoderConfig):
        """(features [B,F], tokens [B,L]) -> (row emb [B,D], text emb [B,D]), unit norm."""
        f_tokens = modules["tab"](primary)
        t_tokens = modules["text"](tokens)
        f = F.normalize(pool_sequence(f_tokens, "mean"), dim=-1)
        t = F.normalize(pool_sequence(t_tokens, "mean"), dim=-1)
        return f, t

    def _infer_embeddings(self, config: TabularTextDualEncoderConfig, inputs: dict[str, Any]) -> torch.Tensor:
        """Joint embedding [B,D]: the mean of the unit row and text embeddings.

        Inputs: ``"features"`` [B,F] and ``"labels"`` [B] (captioned on the fly).
        """
        tab = self.modules["tab"]
        text = self.modules["text"]
        tab.eval()
        text.eval()
        feats = self._as_tensor(inputs, "features").to(config.device)
        labels = self._as_tensor(inputs, "labels", dtype=torch.long)
        tokens = self._prepare_tokens(labels, config).to(config.device)
        with torch.no_grad():
            f_tokens = tab(feats)
            t_tokens = text(tokens)
            f = F.normalize(pool_sequence(f_tokens, "mean"), dim=-1)
            t = F.normalize(pool_sequence(t_tokens, "mean"), dim=-1)
            return (f + t) / 2
