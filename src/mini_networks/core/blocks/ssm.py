"""Gated state-space (simplified Mamba) block, shared by `mamba` and the
transformer's ``block_type="mamba"`` FFN.

    h      = DWConv1d_causal(W_in · LN(x))          -> split into (u, g)
    s_t    = a ⊙ s_{t-1} + b ⊙ SiLU(u_t)            a = exp(-softplus(a_raw)) ∈ (0, 1)
    update = Drop(W_out · (σ(g) ⊙ s))

`mix(x)` returns the update alone; `forward(x)` adds the residual
(``x + update``). A host block that applies its own residual must call
`mix` — adding it twice counts the input twice.

Simplified vs Mamba (Gu & Dao, 2023): per-channel scalar decay instead of an
input-dependent (selective) A/B/C/Δ, no expanded state dimension (``d_state``
is accepted for API compatibility and unused), and a sequential Python scan
instead of the parallel hardware-aware scan.
"""
from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F


class MambaBlock(nn.Module):
    """Pre-norm gated SSM block on ``[B, T, C]``; ``forward`` includes the residual.

    Parameter names (``norm``, ``proj_in``, ``dwconv``, ``a``, ``b``,
    ``proj_out``) are part of trained checkpoints — keep them stable.
    """

    def __init__(self, d_model: int, d_state: int = 16, d_conv: int = 4,
                 dropout: float = 0.1):
        super().__init__()
        self.norm = nn.LayerNorm(d_model)
        self.proj_in = nn.Linear(d_model, 2 * d_model)
        self.dwconv = nn.Conv1d(
            2 * d_model, 2 * d_model,
            kernel_size=d_conv, padding=d_conv - 1,
            groups=2 * d_model,
        )
        self.act = nn.SiLU()
        self.a = nn.Parameter(torch.zeros(d_model))  # decay log-rate (per channel)
        self.b = nn.Parameter(torch.zeros(d_model))  # input scale (per channel)
        self.proj_out = nn.Linear(d_model, d_model)
        self.drop = nn.Dropout(dropout)

    def mix(self, x: torch.Tensor) -> torch.Tensor:
        """The block's update for ``x`` [B, T, C] -> [B, T, C], WITHOUT the residual."""
        B, T, C = x.shape
        h = self.proj_in(self.norm(x)).transpose(1, 2)   # [B, 2C, T]
        h = self.dwconv(h)[:, :, :T].transpose(1, 2)     # causal trim -> [B, T, 2C]
        u, g = h.chunk(2, dim=-1)                        # each [B, T, C]
        u, g = self.act(u), torch.sigmoid(g)

        a = torch.exp(-F.softplus(self.a))               # [C], decay in (0, 1)
        s = torch.zeros(B, C, device=x.device, dtype=x.dtype)
        ys = []
        for t in range(T):                               # sequential scan
            s = a * s + self.b * u[:, t, :]
            ys.append(s)
        y = g * torch.stack(ys, dim=1)                   # [B, T, C]
        return self.drop(self.proj_out(y))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """x [B, T, C] -> x + mix(x)."""
        return x + self.mix(x)
