"""ConvLSTM for spatio-temporal sequence prediction (next-frame video prediction).

The `rnn` mini carries a hidden VECTOR through time with fully-connected LSTM
gates. ConvLSTM (Shi et al. 2015) keeps the exact LSTM gate equations but swaps
every matmul for a 2D CONVOLUTION, so the hidden state h and cell state c are
spatial feature MAPS of shape [B, hidden, H, W]. That single change lets an LSTM
model where things are and how they move — it predicts the next FRAME of a video.

    i, f, o = sigmoid(convs over [x_t ; h_{t-1}])   # input / forget / output gates
    g       = tanh(   conv  over [x_t ; h_{t-1}])   # candidate cell
    c_t     = f * c_{t-1} + i * g
    h_t     = o * tanh(c_t)

Following NVlabs/conv-tt-lstm code/convlstmcell.py (ConvLSTMCell, lines 162-250),
all four gate convs are computed by ONE Conv2d producing 4*hidden channels, then
split. The net (code/convlstmnet.py) encodes the context frames, then rolls out
future frames one at a time, feeding each prediction back in (open-loop) — with
scheduled sampling during training (handled in the trainer).

Deliberately simplified vs conv-tt-lstm: the plain ConvLSTM cell only (the paper's
conv tensor-train decomposition is a stretch flag, not this mini), 1 layer, a tiny
hidden width, single-channel frames on a self-generated Moving-MNIST toy.
"""
from __future__ import annotations

import torch
import torch.nn as nn


class ConvLSTMCell(nn.Module):
    """One ConvLSTM step: a single Conv2d over cat([input, hidden]) -> i/f/o/g gates."""

    def __init__(self, in_channels: int, hidden_dim: int, kernel_size: int = 3):
        super().__init__()
        self.hidden_dim = hidden_dim
        padding = kernel_size // 2
        # One conv emits all four gates (4*hidden channels), then we split.
        self.conv = nn.Conv2d(in_channels + hidden_dim, 4 * hidden_dim, kernel_size, padding=padding)

    def forward(self, x: torch.Tensor, state):
        """x: [B, C, H, W]; state: (h, c). Returns (h_new, c_new)."""
        h, c = state
        combined = torch.cat([x, h], dim=1)
        i, f, o, g = torch.split(self.conv(combined), self.hidden_dim, dim=1)
        i, f, o = torch.sigmoid(i), torch.sigmoid(f), torch.sigmoid(o)
        g = torch.tanh(g)
        c_new = f * c + i * g
        h_new = o * torch.tanh(c_new)
        return h_new, c_new

    def init_state(self, batch: int, spatial: tuple[int, int], device) -> tuple[torch.Tensor, torch.Tensor]:
        H, W = spatial
        z = torch.zeros(batch, self.hidden_dim, H, W, device=device)
        return z, z.clone()


class ConvLSTMNet(nn.Module):
    """Stack of ConvLSTM cells + a 1x1 read-out conv predicting the next frame.

    forward(frames, n_predict, sampling_mask) encodes the given frames then rolls
    out n_predict future frames. During training the trainer passes a per-step
    Bernoulli `sampling_mask` selecting, for each rollout step, whether to feed the
    ground-truth frame or the model's own last prediction (scheduled sampling).
    """

    def __init__(self, in_channels: int = 1, hidden_dim: int = 16,
                 kernel_size: int = 3, n_layers: int = 1):
        super().__init__()
        self.n_layers = n_layers
        cells = []
        for layer in range(n_layers):
            cin = in_channels if layer == 0 else hidden_dim
            cells.append(ConvLSTMCell(cin, hidden_dim, kernel_size))
        self.cells = nn.ModuleList(cells)
        self.readout = nn.Conv2d(hidden_dim, in_channels, 1)

    def _step(self, x: torch.Tensor, states: list) -> tuple[torch.Tensor, list]:
        inp = x
        for i, cell in enumerate(self.cells):
            h, c = cell(inp, states[i])
            states[i] = (h, c)
            inp = h
        return torch.sigmoid(self.readout(inp)), states

    def forward(self, frames: torch.Tensor, n_predict: int,
                future_frames: torch.Tensor | None = None,
                sampling_mask: torch.Tensor | None = None) -> torch.Tensor:
        """frames: [B, T_in, C, H, W]; returns predictions [B, n_predict, C, H, W].

        If future_frames + sampling_mask are given (training), each rollout step
        feeds truth or the last prediction per the Bernoulli mask; otherwise the
        rollout is fully open-loop (feed the prediction back — validation).
        """
        B, T_in, C, H, W = frames.shape
        device = frames.device
        states = [cell.init_state(B, (H, W), device) for cell in self.cells]

        pred = None
        for t in range(T_in):  # encode context
            pred, states = self._step(frames[:, t], states)

        outputs = []
        for k in range(n_predict):
            outputs.append(pred)
            if k == n_predict - 1:
                break
            if future_frames is not None and sampling_mask is not None:
                # Scheduled sampling: truth vs own prediction, per the mask.
                use_truth = sampling_mask[k].view(B, 1, 1, 1)
                nxt = use_truth * future_frames[:, k] + (1 - use_truth) * pred
            else:
                nxt = pred  # open-loop
            pred, states = self._step(nxt, states)
        return torch.stack(outputs, dim=1)
