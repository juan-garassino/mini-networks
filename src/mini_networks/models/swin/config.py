from __future__ import annotations
from mini_networks.core.config import BaseConfig


class SwinConfig(BaseConfig):
    model_name: str = "swin"
    image_size: int = 28
    in_channels: int = 1
    num_classes: int = 10
    # The `vit` mini runs GLOBAL attention over all 49 patch tokens — O(N²) in the
    # token count. Swin (Liu et al. 2021) makes attention LOCAL: it partitions the
    # feature map into non-overlapping windows and attends only WITHIN each window,
    # so cost is linear in image area. Cross-window information flows because every
    # other block SHIFTS the window grid by half a window (cyclic torch.roll), and
    # a hierarchy of PatchMerging layers halves resolution / doubles channels like
    # a conv net's stride-2 stages. Source: microsoft/Swin-Transformer
    # models/swin_transformer.py.
    patch_size: int = 4          # 28x28 -> 7x7 tokens after patch embedding
    window_size: int = 7         # attend within 7x7 windows (one window covers 7x7 here)
    embed_dim: int = 32          # token width at the first stage (tiny/CPU)
    depths: tuple[int, ...] = (2,)  # blocks per stage; block i shifts iff i is odd
    num_heads: int = 4
    mlp_ratio: float = 2.0
    dataset: str = "mnist"
