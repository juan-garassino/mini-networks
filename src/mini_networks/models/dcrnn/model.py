"""DCRNN: a GRU whose every matmul is a graph diffusion convolution.

DCRNN (Li, Yu, Shahabi & Liu, 2018) forecasts a signal that lives on a GRAPH and
evolves over TIME (their case: traffic speed at road sensors). It fuses two atoms
already in the zoo: the `gnn` mini's message passing (aggregate over graph
neighbours) and the `rnn` mini's recurrence (carry a state through time).

The DIFFUSION CONVOLUTION spreads a node signal along the graph by a truncated
random walk. Using the transition matrix P = D⁻¹A (row-normalized adjacency), a
K-step diffusion of features X is the Chebyshev-style sum

    Z = Σ_{k=0}^{K}  Pᵏ X W_k

computed by the recurrence  x⁰ = X,  x¹ = P·X,  xᵏ = P·xᵏ⁻¹  (dcrnn_cell.py
_gconv, lines 133-184). For a DIRECTED graph two supports are stacked — the
forward walk D⁻¹A and the reverse D⁻¹Aᵀ — so information flows both up- and
downstream. The DCGRU is then just a GRU with each gate's dense layer replaced by
this `_gconv` (dcrnn_cell.py __call__, lines 77-110):

    r = sigmoid(gconv([X ; h]))          # reset gate
    u = sigmoid(gconv([X ; h]))          # update gate
    c = tanh(   gconv([X ; r * h]))      # candidate state
    h' = u * h + (1 - u) * c

Deliberately simplified vs the paper: one DCGRU layer per encoder/decoder, a tiny
hidden width, a synthetic sensor graph + diffusion process (no METR-LA download),
and 1-D node features. Inverse-sigmoid scheduled sampling lives in the trainer.
"""
from __future__ import annotations

import torch
import torch.nn as nn


class DiffusionConv(nn.Module):
    """K-step dual-random-walk diffusion convolution over given supports.

    supports: list of [N, N] transition matrices (forward D⁻¹A and reverse D⁻¹Aᵀ).
    Maps node features [B, N, in_dim] -> [B, N, out_dim] by diffusing K steps over
    every support and learning one weight per (support, step) term.
    """

    def __init__(self, in_dim: int, out_dim: int, n_supports: int, max_diffusion_step: int):
        super().__init__()
        self.max_step = max_diffusion_step
        self.n_supports = n_supports
        # Terms: identity (k=0) + K steps per support.
        num_matrices = n_supports * max_diffusion_step + 1
        self.weight = nn.Linear(in_dim * num_matrices, out_dim)

    def forward(self, x: torch.Tensor, supports: list[torch.Tensor]) -> torch.Tensor:
        B, N, in_dim = x.shape
        outputs = [x]  # k=0 term (identity)
        for support in supports:
            x0 = x
            x1 = torch.einsum("nm,bmd->bnd", support, x0)  # P · X  (1-hop)
            outputs.append(x1)
            for _ in range(2, self.max_step + 1):
                x2 = torch.einsum("nm,bmd->bnd", support, x1)  # Chebyshev recurrence
                outputs.append(x2)
                x1 = x2
        stacked = torch.cat(outputs, dim=-1)  # [B, N, in_dim * num_matrices]
        return self.weight(stacked)


class DCGRUCell(nn.Module):
    """A GRU cell with every gate matmul replaced by a diffusion convolution."""

    def __init__(self, in_dim: int, hidden_dim: int, n_supports: int, max_diffusion_step: int):
        super().__init__()
        self.hidden_dim = hidden_dim
        cat_dim = in_dim + hidden_dim
        self.gconv_gates = DiffusionConv(cat_dim, 2 * hidden_dim, n_supports, max_diffusion_step)
        self.gconv_cand = DiffusionConv(cat_dim, hidden_dim, n_supports, max_diffusion_step)

    def forward(self, x: torch.Tensor, h: torch.Tensor, supports: list[torch.Tensor]) -> torch.Tensor:
        """x: [B, N, in_dim]; h: [B, N, hidden]. Returns h' [B, N, hidden]."""
        ru = torch.sigmoid(self.gconv_gates(torch.cat([x, h], dim=-1), supports))
        r, u = torch.split(ru, self.hidden_dim, dim=-1)
        c = torch.tanh(self.gconv_cand(torch.cat([x, r * h], dim=-1), supports))
        return u * h + (1 - u) * c


class DCRNN(nn.Module):
    """Encoder-decoder DCRNN: encode `seq_len` steps, decode `horizon` steps.

    The encoder runs a DCGRU over the input sequence to summarize graph history
    into a hidden state; the decoder rolls that state forward `horizon` steps,
    projecting each hidden state to a 1-D node value. Supports (the diffusion
    matrices) are passed in from the trainer — they're a property of the graph,
    not learned.
    """

    def __init__(self, node_dim: int = 1, hidden_dim: int = 16,
                 n_supports: int = 2, max_diffusion_step: int = 2):
        super().__init__()
        self.hidden_dim = hidden_dim
        self.encoder = DCGRUCell(node_dim, hidden_dim, n_supports, max_diffusion_step)
        self.decoder = DCGRUCell(node_dim, hidden_dim, n_supports, max_diffusion_step)
        self.proj = nn.Linear(hidden_dim, node_dim)

    def forward(self, x_seq: torch.Tensor, supports: list[torch.Tensor], horizon: int,
                targets: torch.Tensor | None = None, teacher_prob: float = 0.0) -> torch.Tensor:
        """x_seq: [B, T, N, node_dim]; returns forecasts [B, horizon, N, node_dim].

        During training, `targets` + `teacher_prob` enable scheduled sampling: at
        each decoder step, feed the ground-truth previous value with probability
        `teacher_prob`, else the model's own last prediction.
        """
        B, T, N, node_dim = x_seq.shape
        h = torch.zeros(B, N, self.hidden_dim, device=x_seq.device)
        for t in range(T):  # encode
            h = self.encoder(x_seq[:, t], h, supports)

        outputs = []
        prev = torch.zeros(B, N, node_dim, device=x_seq.device)  # GO symbol
        for k in range(horizon):
            h = self.decoder(prev, h, supports)
            out = self.proj(h)
            outputs.append(out)
            if targets is not None and torch.rand(()) < teacher_prob:
                prev = targets[:, k]  # teacher forcing
            else:
                prev = out  # autoregressive
        return torch.stack(outputs, dim=1)
