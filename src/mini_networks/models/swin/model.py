"""Mini Swin Transformer for 28x28 grayscale: windowed + shifted-window attention.

The `vit` mini attends globally: all 49 patch tokens see each other in one O(N²)
attention. Swin (Liu et al. 2021) instead partitions the token map into
non-overlapping M×M WINDOWS and attends only within each window — cost is linear
in the number of tokens. Locality alone would never mix information across window
boundaries, so every SECOND block first CYCLICALLY SHIFTS the map by M/2
(torch.roll), re-windows, and masks out the wrapped-around regions so tokens that
became artificial neighbours don't attend to each other. Alternating regular and
shifted blocks lets the receptive field grow across the image.

Three pieces, all from microsoft/Swin-Transformer models/swin_transformer.py:
  - window_partition / window_reverse (lines 45-74): pure view+permute reshapes.
  - WindowAttention (line 77): multi-head attention over one window, plus a
    learned RELATIVE POSITION BIAS added pre-softmax — a (2M-1)² table indexed by
    the pairwise coordinate differences within the window.
  - the shift + attention-mask construction (SwinTransformerBlock, lines 222-294).
  - PatchMerging (line 315): the conv-like hierarchy — 2x2 neighbourhoods
    concatenated (4C), LayerNorm, Linear(4C->2C): halves resolution, doubles width.

Deliberately simplified vs the paper: one stage on a 7x7 token map with a single
7x7 window (so this mini's headline is the WINDOW+SHIFT+relative-bias mechanics
and the mask, seen clearly at tiny scale), no DropPath, MNIST at 28x28.
"""
from __future__ import annotations

import torch
import torch.nn as nn


def window_partition(x: torch.Tensor, window_size: int) -> torch.Tensor:
    """[B, H, W, C] -> [num_windows*B, window_size, window_size, C] (swin L45-56)."""
    B, H, W, C = x.shape
    x = x.view(B, H // window_size, window_size, W // window_size, window_size, C)
    windows = x.permute(0, 1, 3, 2, 4, 5).contiguous().view(-1, window_size, window_size, C)
    return windows


def window_reverse(windows: torch.Tensor, window_size: int, H: int, W: int) -> torch.Tensor:
    """Inverse of window_partition (swin L59-74)."""
    B = int(windows.shape[0] / (H * W / window_size / window_size))
    x = windows.view(B, H // window_size, W // window_size, window_size, window_size, -1)
    x = x.permute(0, 1, 3, 2, 4, 5).contiguous().view(B, H, W, -1)
    return x


class WindowAttention(nn.Module):
    """Multi-head self-attention within a window + a relative-position-bias table.

    The bias table has (2M-1)² rows (one per possible coordinate offset within an
    M×M window) × n_heads; a precomputed index gathers a [M²,M²,heads] bias that
    is added to the attention logits before softmax (swin WindowAttention L100-141).
    An optional additive `mask` implements the shifted-window masking.
    """

    def __init__(self, dim: int, window_size: int, num_heads: int):
        super().__init__()
        self.dim = dim
        self.window_size = window_size
        self.num_heads = num_heads
        self.scale = (dim // num_heads) ** -0.5

        # (2M-1)² relative positions per head.
        self.relative_position_bias_table = nn.Parameter(
            torch.zeros((2 * window_size - 1) ** 2, num_heads)
        )
        nn.init.trunc_normal_(self.relative_position_bias_table, std=0.02)

        # Precompute the flattened relative-position index (swin L103-114) — the
        # meshgrid + offset-shift trick that maps each (i, j) token pair to a row
        # in the bias table.
        coords = torch.stack(torch.meshgrid(
            torch.arange(window_size), torch.arange(window_size), indexing="ij"))  # [2,M,M]
        coords_flat = torch.flatten(coords, 1)  # [2, M²]
        rel = coords_flat[:, :, None] - coords_flat[:, None, :]  # [2, M², M²]
        rel = rel.permute(1, 2, 0).contiguous()  # [M², M², 2]
        rel[:, :, 0] += window_size - 1
        rel[:, :, 1] += window_size - 1
        rel[:, :, 0] *= 2 * window_size - 1
        self.register_buffer("relative_position_index", rel.sum(-1))  # [M², M²]

        self.qkv = nn.Linear(dim, dim * 3, bias=True)
        self.proj = nn.Linear(dim, dim)

    def forward(self, x: torch.Tensor, mask: torch.Tensor | None = None) -> torch.Tensor:
        """x: [num_windows*B, M², C]; mask: [num_windows, M², M²] or None."""
        B_, N, C = x.shape
        qkv = self.qkv(x).reshape(B_, N, 3, self.num_heads, C // self.num_heads).permute(2, 0, 3, 1, 4)
        q, k, v = qkv[0], qkv[1], qkv[2]
        attn = (q * self.scale) @ k.transpose(-2, -1)  # [B_, heads, N, N]

        bias = self.relative_position_bias_table[self.relative_position_index.view(-1)]
        bias = bias.view(N, N, -1).permute(2, 0, 1)  # [heads, N, N]
        attn = attn + bias.unsqueeze(0)

        if mask is not None:
            nW = mask.shape[0]
            attn = attn.view(B_ // nW, nW, self.num_heads, N, N) + mask.unsqueeze(1).unsqueeze(0)
            attn = attn.view(-1, self.num_heads, N, N)

        attn = attn.softmax(dim=-1)
        out = (attn @ v).transpose(1, 2).reshape(B_, N, C)
        return self.proj(out)


class SwinBlock(nn.Module):
    """One Swin block: (optionally shifted) window attention + MLP, both residual."""

    def __init__(self, dim: int, input_resolution: int, num_heads: int,
                 window_size: int, shift_size: int, mlp_ratio: float):
        super().__init__()
        self.input_resolution = input_resolution
        self.window_size = window_size
        self.shift_size = shift_size
        self.norm1 = nn.LayerNorm(dim)
        self.attn = WindowAttention(dim, window_size, num_heads)
        self.norm2 = nn.LayerNorm(dim)
        hidden = int(dim * mlp_ratio)
        self.mlp = nn.Sequential(nn.Linear(dim, hidden), nn.GELU(), nn.Linear(hidden, dim))

        # Precompute the attention mask for shifted blocks (swin L222-245): a
        # 9-region image mask -> per-window pairwise "same region?" test ->
        # fill -100 where two tokens belong to different (wrapped) regions.
        attn_mask = None
        if shift_size > 0:
            H = W = input_resolution
            img_mask = torch.zeros(1, H, W, 1)
            slices = (slice(0, -window_size), slice(-window_size, -shift_size), slice(-shift_size, None))
            cnt = 0
            for hs in slices:
                for ws in slices:
                    img_mask[:, hs, ws, :] = cnt
                    cnt += 1
            mask_windows = window_partition(img_mask, window_size).view(-1, window_size * window_size)
            attn_mask = mask_windows.unsqueeze(1) - mask_windows.unsqueeze(2)
            attn_mask = attn_mask.masked_fill(attn_mask != 0, -100.0).masked_fill(attn_mask == 0, 0.0)
        self.register_buffer("attn_mask", attn_mask)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """x: [B, H*W, C]."""
        H = W = self.input_resolution
        B, L, C = x.shape
        shortcut = x
        x = self.norm1(x).view(B, H, W, C)

        if self.shift_size > 0:
            x = torch.roll(x, shifts=(-self.shift_size, -self.shift_size), dims=(1, 2))

        windows = window_partition(x, self.window_size).view(-1, self.window_size * self.window_size, C)
        attn_windows = self.attn(windows, mask=self.attn_mask)
        attn_windows = attn_windows.view(-1, self.window_size, self.window_size, C)
        x = window_reverse(attn_windows, self.window_size, H, W)

        if self.shift_size > 0:
            x = torch.roll(x, shifts=(self.shift_size, self.shift_size), dims=(1, 2))

        x = shortcut + x.view(B, H * W, C)
        x = x + self.mlp(self.norm2(x))
        return x


class PatchMerging(nn.Module):
    """Downsample: concat 2x2 neighbours (4C) -> LayerNorm -> Linear(4C->2C) (swin L315)."""

    def __init__(self, input_resolution: int, dim: int):
        super().__init__()
        self.input_resolution = input_resolution
        self.norm = nn.LayerNorm(4 * dim)
        self.reduction = nn.Linear(4 * dim, 2 * dim, bias=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        H = W = self.input_resolution
        B, L, C = x.shape
        x = x.view(B, H, W, C)
        x0 = x[:, 0::2, 0::2, :]
        x1 = x[:, 1::2, 0::2, :]
        x2 = x[:, 0::2, 1::2, :]
        x3 = x[:, 1::2, 1::2, :]
        x = torch.cat([x0, x1, x2, x3], dim=-1).view(B, -1, 4 * C)
        return self.reduction(self.norm(x))


class MiniSwin(nn.Module):
    def __init__(self, patch_size: int = 4, window_size: int = 7, embed_dim: int = 32,
                 depths: tuple[int, ...] = (2,), num_heads: int = 4, mlp_ratio: float = 2.0,
                 num_classes: int = 10, image_size: int = 28, in_channels: int = 1):
        super().__init__()
        self.patch_embed = nn.Conv2d(in_channels, embed_dim, kernel_size=patch_size, stride=patch_size)
        self.norm_embed = nn.LayerNorm(embed_dim)
        resolution = image_size // patch_size  # 7 tokens per side

        blocks: list[nn.Module] = []
        dim = embed_dim
        res = resolution
        for stage_i, depth in enumerate(depths):
            for i in range(depth):
                shift = 0 if i % 2 == 0 else window_size // 2  # every odd block shifts
                blocks.append(SwinBlock(dim, res, num_heads, window_size, shift, mlp_ratio))
            if stage_i < len(depths) - 1:  # merge between stages
                blocks.append(PatchMerging(res, dim))
                dim *= 2
                res //= 2
        self.blocks = nn.ModuleList(blocks)
        self.norm = nn.LayerNorm(dim)
        self.head = nn.Linear(dim, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.patch_embed(x)  # [B, C, H', W']
        x = x.flatten(2).transpose(1, 2)  # [B, H'*W', C]
        x = self.norm_embed(x)
        for blk in self.blocks:
            x = blk(x)
        x = self.norm(x).mean(dim=1)  # global average pool over tokens
        return self.head(x)
