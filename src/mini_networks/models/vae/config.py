"""Config for the convolutional VAE: latent size and the KL weight ``beta``."""
from __future__ import annotations
from mini_networks.core.config import BaseConfig


class VAEConfig(BaseConfig):
    """Hyperparameters for :class:`~mini_networks.models.vae.model.ConvVAE`.

    ``latent_dim`` is the size of z (default 32). ``beta`` weights the KL term
    in :func:`vae_loss`; its small default is explained next to the field.
    ``hidden_dim`` is passed to the model but the current ConvVAE does not use
    it (the conv encoder width is fixed).
    """
    model_name: str = "vae"
    latent_dim: int = 32
    hidden_dim: int = 128
    # 0.0015 ≈ 1/784, NOT 1.0: recon is per-PIXEL mean (~0.05) while KL is
    # per-DIM mean (~O(1)), so beta=1 let KL dominate ~20x — the encoder
    # collapsed to the prior and every input reconstructed to the same mean
    # blob (m-vision-7 recon_pairs). Balancing beta to the unit mismatch
    # restores per-sample information; raise it deliberately for the
    # beta-VAE blur-vs-regularity lesson.
    beta: float = 0.0015
    dataset: str = "mnist"
