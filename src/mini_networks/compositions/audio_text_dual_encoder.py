"""Audio-text dual-encoder: CLIP-style alignment of speech and captions.

Two independent towers, one per modality, trained so a spoken digit and a
caption of the same digit land close together in a shared space:

    wave    [B,1,4000] -> AudioConvEncoder -> [B,1000,D] -> mean pool -> L2 -> a [B,D]
    caption [B,32]     -> TextEncoder      -> [B,32,D]   -> mean pool -> L2 -> t [B,D]
    loss = cross_entropy(a @ t.T / temperature, arange(B))

Because the towers never see each other's input, each can embed its modality
alone — the property that makes dual encoders usable for retrieval (embed a
library once, compare by dot product). Compare audio_text_contrastive, which
fuses both inputs into one vector. After training the base logs label-match
@1 and writes an ``alignment.png`` similarity heatmap (block-diagonal when
aligned).

Deliberately simplified: label-derived captions (several items share one
caption, so instance retrieval is ill-posed — label match is the honest
metric), raw waveforms, one-directional loss and a fixed temperature.
"""
from __future__ import annotations

from typing import Any

import torch
import torch.nn.functional as F

from mini_networks.core.config import BaseConfig
from mini_networks.core.data.registry import get_dataloader
from mini_networks.models.multimodal.encoders import AudioConvEncoder, TextEncoder, pool_sequence
from mini_networks.compositions.base import ContrastiveCompositionBase


class AudioTextDualEncoderConfig(BaseConfig):
    """Knobs: ``d_model`` (shared embedding width), ``temperature`` (InfoNCE
    sharpness), ``sample_len`` (waveform samples per clip), ``text_seq_len`` /
    ``vocab_size`` (caption tokenisation)."""

    model_name: str = "audio_text_dual_encoder"
    d_model: int = 64
    vocab_size: int = 256
    text_seq_len: int = 32
    temperature: float = 0.2
    dataset: str = "speech_digits"
    sample_len: int = 4000
    require_downloads: bool = True


class AudioTextDualEncoder(ContrastiveCompositionBase):
    """Separate audio and text towers aligned by in-batch InfoNCE."""

    def __init__(self):
        super().__init__()

    def _build_modules(self, config: AudioTextDualEncoderConfig) -> dict[str, torch.nn.Module]:
        """The two towers, saved as ``audio.pt`` and ``text.pt``."""
        return {
            "audio": AudioConvEncoder(d_model=config.d_model).to(config.device),
            "text": TextEncoder(vocab_size=config.vocab_size, d_model=config.d_model).to(config.device),
        }

    def _get_dataloader(self, config: AudioTextDualEncoderConfig):
        """Train split of ``config.dataset`` yielding ``(wave [B,1,T], label [B])``."""
        return get_dataloader(
            name=config.dataset,
            data_root=config.data_root,
            split="train",
            batch_size=config.effective_batch_size,
            fast_demo=config.effective_fast_demo,
            sample_limit=config.dataset_sample_limit,
            sample_len=config.sample_len,
            require_downloads=config.require_downloads,
        )

    def _encode_pair(self, modules, primary, tokens, config: AudioTextDualEncoderConfig):
        """(wave [B,1,T], tokens [B,L]) -> (audio emb [B,D], text emb [B,D]), unit norm."""
        a_tokens = modules["audio"](primary)
        t_tokens = modules["text"](tokens)
        a = F.normalize(pool_sequence(a_tokens, "mean"), dim=-1)
        t = F.normalize(pool_sequence(t_tokens, "mean"), dim=-1)
        return a, t

    def _infer_embeddings(self, config: AudioTextDualEncoderConfig, inputs: dict[str, Any]) -> torch.Tensor:
        """Joint embedding [B,D]: the mean of the unit audio and text embeddings.

        Inputs: ``"waves"`` [B,1,T] and ``"labels"`` [B] (captioned on the fly).
        """
        audio = self.modules["audio"]
        text = self.modules["text"]
        audio.eval()
        text.eval()
        waves = self._as_tensor(inputs, "waves").to(config.device)
        labels = self._as_tensor(inputs, "labels", dtype=torch.long)
        tokens = self._prepare_tokens(labels, config).to(config.device)
        with torch.no_grad():
            a_tokens = audio(waves)
            t_tokens = text(tokens)
            a = F.normalize(pool_sequence(a_tokens, "mean"), dim=-1)
            t = F.normalize(pool_sequence(t_tokens, "mean"), dim=-1)
            return (a + t) / 2
