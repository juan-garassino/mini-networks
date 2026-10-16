"""LoRA on the zoo's TransformerLM: train a low-rank adapter, freeze the rest.

LoRA (Hu et al., 2021) adapts a frozen weight W by adding a trainable
low-rank update:

    y = W x + (alpha / r) * B(A(x)),   A: d_in -> r,  B: r -> d_out,  B init 0

Because B starts at zero the adapted model is exactly the base model at step
0, and only r * (d_in + d_out) numbers train instead of d_in * d_out.

Pipeline here: build a char-level TransformerLM, wrap its ``lm_head`` in a
LoRALinear (rank 4, alpha 8), freeze every other parameter, and train only
A and B with next-character cross-entropy on a text file (Tiny Shakespeare
when ``text_file`` is empty). ``generate`` samples from the adapted model.

Deliberately simplified — and important to read correctly: the base LM is
freshly *randomly initialised*, not pretrained, so this shows the LoRA
mechanics (zero-init update, frozen base, tiny trainable set) rather than
real fine-tuning of learned knowledge. Only the output head is adapted (LoRA
usually targets the attention q/v projections), and the adapter is not
merged into W after training.
"""
from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F

from mini_networks.core.config import BaseConfig
from mini_networks.core.data.registry import get_dataloader
from mini_networks.core.logging.logger import Logger
from mini_networks.models.transformer.model import TransformerLM
from mini_networks.models.transformer.tokenizer import CharTokenizer


class LoRALMConfig(BaseConfig):
    """Knobs: ``rank`` r (adapter bottleneck; trainable params scale with it),
    ``alpha`` (update scale is alpha / r, so changing r alone keeps the update
    magnitude comparable), the TransformerLM sizes (``d_model``, ``n_layers``,
    ``n_heads``, ``d_ff``, ``seq_len``), and ``text_file`` (corpus path; empty
    = Tiny Shakespeare)."""

    model_name: str = "lora_lm"
    d_model: int = 64
    n_layers: int = 2
    n_heads: int = 2
    d_ff: int = 128
    seq_len: int = 64
    dropout: float = 0.1
    rank: int = 4
    alpha: float = 8.0
    dataset: str = "text_file"
    text_file: str = ""


class LoRALinear(nn.Module):
    """Wrap an nn.Linear with a zero-initialised low-rank residual update.

    Computes ``base(x) + (alpha / rank) * B(A(x))``; A gets PyTorch's default
    init, B is zeroed so the wrapper starts as an exact copy of ``base``.
    Freezing ``base`` is the caller's job (see ``LoRALM.train``).
    """

    def __init__(self, base: nn.Linear, rank: int = 4, alpha: float = 8.0):
        super().__init__()
        self.base = base
        self.rank = rank
        self.alpha = alpha
        self.A = nn.Linear(base.in_features, rank, bias=False)
        self.B = nn.Linear(rank, base.out_features, bias=False)
        nn.init.zeros_(self.B.weight)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """[..., in_features] -> [..., out_features]."""
        return self.base(x) + self.B(self.A(x)) * (self.alpha / self.rank)

    @property
    def lora_params(self):
        """The trainable adapter parameters (A and B weights only)."""
        return list(self.A.parameters()) + list(self.B.parameters())


class LoRALM:
    """Builds a TransformerLM, swaps in a LoRA head, trains only the adapter."""

    def __init__(self):
        self.model: TransformerLM | None = None
        self.tokenizer: CharTokenizer | None = None

    def _build(self, config: LoRALMConfig, vocab_size: int) -> TransformerLM:
        """A fresh (random-init) TransformerLM sized by the config."""
        return TransformerLM(
            vocab_size=vocab_size,
            d_model=config.d_model,
            n_heads=config.n_heads,
            n_layers=config.n_layers,
            d_ff=config.d_ff,
            seq_len=config.seq_len,
            dropout=config.dropout,
        ).to(config.device)

    def train(self, config: LoRALMConfig, logger: Logger) -> None:
        """Train the LoRA adapter on next-character prediction.

        Logs ``loss`` per epoch; saves ``model.pt`` (full state dict,
        including ``lm_head.base`` / ``lm_head.A`` / ``lm_head.B``) and
        ``tokenizer.json``.
        """
        dl = get_dataloader(
            name=config.dataset,
            data_root=config.data_root,
            split="train",
            batch_size=config.effective_batch_size,
            fast_demo=config.effective_fast_demo,
            sample_limit=config.dataset_sample_limit,
            file_path=config.text_file,
            seq_len=config.seq_len,
        )
        ds = dl.dataset
        vocab_size = ds.vocab_size
        self.tokenizer = ds.tokenizer

        model = self._build(config, vocab_size)
        # Replace lm_head with LoRA adapter
        # .to(device): the adapter's A/B layers are fresh CPU modules while the
        # wrapped base head already sits on config.device.
        model.lm_head = LoRALinear(model.lm_head, rank=config.rank, alpha=config.alpha).to(config.device)
        self.model = model

        # Freeze base model weights
        for p in model.parameters():
            p.requires_grad_(False)
        for p in model.lm_head.lora_params:
            p.requires_grad_(True)

        optimizer = torch.optim.Adam(model.lm_head.lora_params, lr=config.learning_rate)

        for epoch in range(config.effective_epochs):
            model.train()
            total = 0.0
            for x, y in dl:
                x, y = x.to(config.device), y.to(config.device)
                logits, _ = model(x)
                loss = F.cross_entropy(logits.view(-1, vocab_size), y.view(-1))
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
                total += loss.item()
            logger.log_metrics(epoch, {"loss": total / max(1, len(dl))})

        torch.save(model.state_dict(), logger.artifact_path("model.pt"))
        self.tokenizer.save(str(logger.artifact_path("tokenizer.json")))

    def generate(self, config: LoRALMConfig, prompt: str, max_new_tokens: int = 64) -> str:
        """Sample ``max_new_tokens`` characters after ``prompt``; returns prompt + continuation.

        Uses TransformerLM.generate (multinomial sampling, temperature 1).
        """
        if self.model is None or self.tokenizer is None:
            raise RuntimeError("Train first.")
        ids = self.tokenizer.encode(prompt)
        x = torch.tensor([ids], dtype=torch.long, device=config.device)
        out = self.model.generate(x, max_new_tokens=max_new_tokens)
        return self.tokenizer.decode(out[0].tolist())
