"""Shared composition bases for the contrastive multimodal pipelines.

A *composition* wires zoo models into a pipeline that no single model can do
alone. Most compositions are bespoke classes with their own ``train`` /
``sample`` / ``compare`` methods; this module holds the two bases shared by
the four "pair text with another modality" compositions
(audio_text_contrastive, audio_text_dual_encoder, tabular_text_cross_attention,
tabular_text_dual_encoder).

ContrastiveCompositionBase is a template-method trainer. Subclasses decide
*what* to encode; the base owns the CLIP-style InfoNCE loop:

    tokens  = label_to_tokens(label)            # a random templated caption of the label
    emb_a, emb_b = _encode_pair(primary, tokens) # [B,D] each, L2-normalised
    logits  = emb_a @ emb_b.T / temperature     # [B,B] similarity matrix
    loss    = cross_entropy(logits, arange(B))  # row i must pick column i

When a subclass returns ONE fused embedding (the cross-attention variants),
the logits are its self-similarity ``emb @ emb.T``: the diagonal is trivially
the max, so the loss mainly pushes different pairs apart (an instance-
discrimination / uniformity objective) rather than aligning two towers.

Deliberately simplified vs CLIP: the "text" is a templated caption derived
from the class label (so captions are not unique per item), a one-directional
loss (no symmetric image->text + text->image average), a fixed rather than
learned temperature, and in-batch negatives only.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader

from mini_networks.core.config import BaseConfig
from mini_networks.core.logging.logger import Logger
from mini_networks.models.clip.data import label_to_tokens


class CompositionBase(ABC):
    """Base class for compositions with a unified infer signature."""

    @abstractmethod
    def infer(self, config: BaseConfig, inputs: dict[str, Any]) -> dict[str, Any]:
        """Run inference. Inputs must be a dict."""

    def _as_tensor(self, inputs: dict[str, Any], key: str, dtype=torch.float32) -> torch.Tensor:
        """Fetch ``inputs[key]`` as a tensor of ``dtype``; KeyError if absent."""
        if key not in inputs:
            raise KeyError(f"Missing required input key: {key}")
        return torch.as_tensor(inputs[key], dtype=dtype)


class ContrastiveCompositionBase(CompositionBase):
    """Template trainer for contrastive (modality, caption) compositions.

    Subclasses implement four hooks — ``_build_modules``, ``_get_dataloader``
    (yielding ``(primary, label)`` batches), ``_encode_pair`` and
    ``_infer_embeddings``; ``train`` / ``infer`` here do the rest. Config
    knobs read by the base: ``temperature`` (default 0.2; lower = sharper
    softmax over the batch), ``text_seq_len`` and ``vocab_size`` (caption
    tokenisation), ``learning_rate`` and the tier-aware ``effective_epochs``.
    """

    def __init__(self):
        """Start untrained; ``self.modules`` is filled by ``train``."""
        self.modules: dict[str, nn.Module] = {}

    @abstractmethod
    def _build_modules(self, config: BaseConfig) -> dict[str, nn.Module]:
        """Return a dict of modules to be trained."""

    @abstractmethod
    def _get_dataloader(self, config: BaseConfig) -> DataLoader:
        """Return a training dataloader."""

    @abstractmethod
    def _encode_pair(
        self,
        modules: dict[str, nn.Module],
        primary: torch.Tensor,
        tokens: torch.Tensor,
        config: BaseConfig,
    ) -> torch.Tensor | tuple[torch.Tensor, torch.Tensor]:
        """Return embeddings for contrastive loss."""

    @abstractmethod
    def _infer_embeddings(self, config: BaseConfig, inputs: dict[str, Any]) -> torch.Tensor:
        """Return embeddings for inference."""

    def _prepare_tokens(self, labels: torch.Tensor, config: BaseConfig) -> torch.Tensor:
        """Turn class labels [B] into caption token ids [B, text_seq_len].

        Each label draws a random caption from DIGIT_CAPTIONS, character-tokenised (``ord(c) % vocab_size``)
        and padded/truncated to ``text_seq_len``.
        """
        seq_len = getattr(config, "text_seq_len", 32)
        vocab_size = getattr(config, "vocab_size", 256)
        return torch.stack(
            [label_to_tokens(int(l), seq_len, vocab_size) for l in labels], dim=0
        )

    def _contrastive_logits(
        self,
        emb_a: torch.Tensor,
        emb_b: torch.Tensor | None,
        temperature: float,
    ) -> torch.Tensor:
        """Pairwise similarity logits [B, B] scaled by 1/temperature.

        With ``emb_b`` None this is the self-similarity of a single fused
        embedding (see the module docstring for what that objective does).
        """
        if emb_b is None:
            return (emb_a @ emb_a.T) / temperature
        return (emb_a @ emb_b.T) / temperature

    def _optimizer(self, modules: dict[str, nn.Module], config: BaseConfig):
        """One Adam over the parameters of every module (towers train jointly)."""
        params = []
        for module in modules.values():
            params.extend(list(module.parameters()))
        return torch.optim.Adam(params, lr=config.learning_rate)

    def train(self, config: BaseConfig, logger: Logger) -> None:
        """Train the modules with in-batch InfoNCE and save their weights.

        Logs the mean ``loss`` per epoch. Afterwards, best-effort, logs
        ``label_match_at_1`` / ``label_match_chance`` / ``retrieval_at_1`` and
        writes an ``alignment.png`` similarity heatmap (two-tower variants
        only). Checkpoints: ``model.pt`` for a single ``"model"`` module,
        otherwise one ``<name>.pt`` per module (e.g. ``audio.pt`` + ``text.pt``).
        """
        modules = self._build_modules(config)
        self.modules = modules
        opt = self._optimizer(modules, config)
        dl = self._get_dataloader(config)
        temperature = getattr(config, "temperature", 0.2)

        for epoch in range(config.effective_epochs):
            total = 0.0
            for primary, labels in dl:
                primary = primary.to(config.device)
                tokens = self._prepare_tokens(labels, config).to(config.device)
                out = self._encode_pair(modules, primary, tokens, config)
                if isinstance(out, tuple):
                    emb_a, emb_b = out
                else:
                    emb_a, emb_b = out, None
                logits = self._contrastive_logits(emb_a, emb_b, temperature)
                targets = torch.arange(logits.size(0), device=logits.device)
                loss = F.cross_entropy(logits, targets)
                opt.zero_grad()
                loss.backward()
                opt.step()
                total += loss.item()
            logger.log_metrics(epoch, {"loss": total / max(1, len(dl))})

        try:
            self._save_alignment_evidence(modules, dl, config, logger)
        except Exception:  # evidence is a bonus — never fail training over it
            pass

        # Save modules
        if "model" in modules and len(modules) == 1:
            torch.save(modules["model"].state_dict(), logger.artifact_path("model.pt"))
        else:
            for name, module in modules.items():
                torch.save(module.state_dict(), logger.artifact_path(f"{name}.pt"))

    @torch.no_grad()
    def _save_alignment_evidence(self, modules, dl, config: BaseConfig, logger: Logger,
                                 max_samples: int = 128) -> None:
        """Legible proof of cross-modal alignment: retrieval@1 (each modality-A
        item must pick its OWN modality-B partner out of the batch; chance =
        1/B) + a similarity-matrix heatmap artifact — a learned model shows a
        bright diagonal."""
        from torchvision.utils import save_image

        embs_a, embs_b, ys = [], [], []
        for primary, labels in dl:
            primary = primary.to(config.device)
            tokens = self._prepare_tokens(labels, config).to(config.device)
            out = self._encode_pair(modules, primary, tokens, config)
            if not isinstance(out, tuple):
                return  # single-embedding compositions: no pairwise retrieval
            embs_a.append(out[0].detach())
            embs_b.append(out[1].detach())
            ys.append(torch.as_tensor(labels).flatten())
            if sum(e.size(0) for e in embs_a) >= max_samples:
                break
        # Sort by label: captions are label-derived (all "seven" texts are
        # identical), so instance-level retrieval is impossible by
        # construction — the honest metric is LABEL match@1 (chance = 1/n
        # classes) and a label-sorted heatmap makes alignment visible as a
        # block diagonal.
        y = torch.cat(ys)[:max_samples]
        order = y.argsort()
        y = y[order].to(config.device)
        a = F.normalize(torch.cat(embs_a)[:max_samples][order], dim=-1)
        b = F.normalize(torch.cat(embs_b)[:max_samples][order], dim=-1)
        sim = a @ b.T
        idx = torch.arange(sim.size(0), device=sim.device)
        label_match = (y[sim.argmax(dim=1)] == y).float().mean().item()
        r_at_1 = (sim.argmax(dim=1) == idx).float().mean().item()
        logger.log_metrics(config.effective_epochs, {
            "label_match_at_1": label_match,
            "label_match_chance": 1.0 / max(1, len(torch.unique(y))),
            "retrieval_at_1": r_at_1,
        })
        heat = (sim - sim.min()) / (sim.max() - sim.min() + 1e-6)
        heat = torch.nn.functional.interpolate(
            heat.unsqueeze(0).unsqueeze(0), scale_factor=4, mode="nearest")[0]
        save_image(heat.cpu(), str(logger.artifact_path("alignment.png")))

    def infer(self, config: BaseConfig, inputs: dict[str, Any]) -> dict[str, Any]:
        """Embed ``inputs`` with the trained modules -> ``{"embeddings": [B, D]}`` (CPU).

        Raises RuntimeError if called before ``train``.
        """
        if not self.modules:
            raise RuntimeError("Train first.")
        emb = self._infer_embeddings(config, inputs)
        return {"embeddings": emb.cpu()}
