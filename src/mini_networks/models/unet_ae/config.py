"""Config for the UNet autoencoder (width of the inherited SegUNet)."""
from __future__ import annotations
from mini_networks.core.config import BaseConfig


class UNetAEConfig(BaseConfig):
    """Hyperparameters for :class:`UNetAutoencoder`; ``base_channels`` is the first encoder stage width (doubles per stage)."""
    model_name: str = "unet_ae"
    base_channels: int = 32
    dataset: str = "mnist"
