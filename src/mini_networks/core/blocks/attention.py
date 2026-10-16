"""Reusable attention blocks."""
from __future__ import annotations

import torch
import torch.nn as nn


class TransformerEncoderBlock(nn.Module):
    """One batch-first ``nn.TransformerEncoderLayer`` wrapped as a block.

    ``d_ff`` defaults to ``4 * d_model``. Input/output shape is
    ``(batch, seq, d_model)``. Currently has no consumers (see blocks/__init__).
    """

    def __init__(self, d_model: int, n_heads: int, d_ff: int | None = None, dropout: float = 0.1):
        super().__init__()
        if d_ff is None:
            d_ff = d_model * 4
        layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=n_heads,
            dim_feedforward=d_ff,
            dropout=dropout,
            batch_first=True,
        )
        self.enc = nn.TransformerEncoder(layer, num_layers=1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Apply the encoder layer; shape-preserving ``(B, T, d_model)``."""
        return self.enc(x)
