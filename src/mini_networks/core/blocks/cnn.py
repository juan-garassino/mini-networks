"""Reusable CNN blocks."""
from __future__ import annotations

import torch
import torch.nn as nn


class ConvBNReLU(nn.Module):
    """Conv2d (no bias) -> BatchNorm2d -> ReLU.

    Padding defaults to ``k // 2`` ("same" spatial size at stride 1). The conv
    has no bias because the following BatchNorm's shift makes it redundant.
    """

    def __init__(self, in_ch: int, out_ch: int, k: int = 3, s: int = 1, p: int | None = None):
        super().__init__()
        if p is None:
            p = k // 2
        self.net = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, k, stride=s, padding=p, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Map ``(B, in_ch, H, W)`` to ``(B, out_ch, H/s, W/s)``."""
        return self.net(x)


class DepthwiseSeparable(nn.Module):
    """MobileNet-style depthwise 3x3 conv, then pointwise 1x1, BatchNorm, ReLU.

    Factorising a full 3x3 conv this way cuts parameters/FLOPs roughly by a
    factor of ``out_ch``; ``stride`` is applied by the depthwise conv.
    """

    def __init__(self, in_ch: int, out_ch: int, stride: int = 1):
        super().__init__()
        self.dw = nn.Conv2d(in_ch, in_ch, 3, stride=stride, padding=1, groups=in_ch, bias=False)
        self.pw = nn.Conv2d(in_ch, out_ch, 1, bias=False)
        self.bn = nn.BatchNorm2d(out_ch)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Map ``(B, in_ch, H, W)`` to ``(B, out_ch, H/stride, W/stride)``."""
        x = self.dw(x)
        x = self.pw(x)
        return torch.relu(self.bn(x))
