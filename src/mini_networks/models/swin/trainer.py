"""Swin trainer: a standard supervised classifier over the windowed-attention net."""
from __future__ import annotations

from mini_networks.core.data.registry import make_classification_dataloader
from mini_networks.core.runtime import SupervisedTrainer
from mini_networks.models.swin.config import SwinConfig
from mini_networks.models.swin.model import MiniSwin


class SwinTrainer(SupervisedTrainer):
    def __init__(self):
        self.model: MiniSwin | None = None

    def _build(self, config: SwinConfig) -> MiniSwin:
        return MiniSwin(
            patch_size=config.patch_size,
            window_size=config.window_size,
            embed_dim=config.embed_dim,
            depths=tuple(config.depths),
            num_heads=config.num_heads,
            mlp_ratio=config.mlp_ratio,
            num_classes=config.num_classes,
            image_size=config.image_size,
            in_channels=config.in_channels,
        ).to(config.device)


make_swin_dataloader = make_classification_dataloader
