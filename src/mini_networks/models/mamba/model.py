"""NanoMamba: a pure state-space language model — no attention anywhere.

Key idea: replace attention's all-pairs token mixing, which costs O(T^2) time and
memory, with a recurrent state that is updated once per step — O(T) time, O(1)
state. A depthwise causal convolution handles local mixing; a gated exponential-
decay scan carries information across arbitrary distances.

This implementation (defaults): token + learned positional embeddings into
d_model=128, then n_layers=4 MambaBlocks, LayerNorm, lm_head back to vocab.
Each MambaBlock: LayerNorm → Linear(128→256) → depthwise Conv1d (kernel d_conv=4,
causal via right-trim) → split into (u, gate) of 128 each → SiLU(u), sigmoid(gate)
→ per-channel scan → gate * state → Linear(128→128) → residual.

Key equations: s_t = a * s_{t-1} + b * u_t with a = exp(-softplus(a_log)) in (0,1)
and b learned, both per-channel [C]; output y_t = sigmoid(g_t) * s_t. forward()
returns (logits [B, T, V], aux_loss=0.0), mirroring TransformerLM so trainers are
drop-in interchangeable.

Deliberately simplified vs the Mamba paper (Gu & Dao 2023): a and b are constant
learned scalars per channel, not input-dependent functions — so there is no
"selectivity"; the state is a single scalar per channel (d_state is accepted but
the recurrence does not expand to a d_state-dim hidden); the scan is a sequential
Python loop, not the hardware-aware parallel scan; and we keep learned absolute
positions, which real Mamba omits entirely.
"""
from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F


# The block itself lives in core/blocks/ssm.py (shared with the transformer's
# block_type="mamba" FFN); re-exported here so this file still reads as the
# whole lesson and `from mini_networks.models.mamba.model import MambaBlock`
# keeps working.
from mini_networks.core.blocks.ssm import MambaBlock  # noqa: E402,F401


class NanoMamba(nn.Module):
    """
    Decoder-only language model built entirely from MambaBlocks (no attention).

    forward() returns (logits [B, T, V], aux_loss=0.0) — same API as
    TransformerLM so trainers and tests are drop-in compatible.
    """

    def __init__(
        self,
        vocab_size: int,
        d_model: int = 128,
        n_layers: int = 4,
        d_state: int = 16,
        d_conv: int = 4,
        seq_len: int = 128,
        dropout: float = 0.1,
    ):
        super().__init__()
        self.token_embed = nn.Embedding(vocab_size, d_model)
        self.pos_embed = nn.Embedding(seq_len, d_model)
        self.blocks = nn.ModuleList([
            MambaBlock(d_model=d_model, d_state=d_state, d_conv=d_conv, dropout=dropout)
            for _ in range(n_layers)
        ])
        self.norm = nn.LayerNorm(d_model)
        self.lm_head = nn.Linear(d_model, vocab_size)
        self.seq_len = seq_len

    def forward(self, tokens: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """Returns (logits [B, T, V], aux_loss=0.0)."""
        B, T = tokens.shape
        positions = torch.arange(T, device=tokens.device).unsqueeze(0)
        x = self.token_embed(tokens) + self.pos_embed(positions)
        for block in self.blocks:
            x = block(x)
        x = self.norm(x)
        return self.lm_head(x), torch.tensor(0.0, device=tokens.device)

    @torch.no_grad()
    def generate(
        self, prompt: torch.Tensor, max_new_tokens: int = 64, temperature: float = 1.0
    ) -> torch.Tensor:
        """Sample ``max_new_tokens`` tokens autoregressively from ``prompt`` [B,T0].

        Each step re-runs the whole model on the last ``seq_len`` tokens
        (the recurrent state is not carried between steps, unlike the RNN's
        generate). Returns [B, T0 + max_new_tokens] ids, prompt included.
        """
        self.eval()
        x = prompt
        for _ in range(max_new_tokens):
            x_cond = x[:, -self.seq_len:]
            logits, _ = self(x_cond)
            next_logits = logits[:, -1, :] / temperature
            probs = F.softmax(next_logits, dim=-1)
            next_token = torch.multinomial(probs, num_samples=1)
            x = torch.cat([x, next_token], dim=1)
        return x
