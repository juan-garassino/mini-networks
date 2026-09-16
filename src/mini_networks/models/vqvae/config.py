from __future__ import annotations
from mini_networks.core.config import BaseConfig


class VQVAEConfig(BaseConfig):
    model_name: str = "vqvae"
    # The `vae` mini has a CONTINUOUS Gaussian latent; VQ-VAE (van den Oord et
    # al. 2017) swaps it for a DISCRETE one: the encoder output is snapped to
    # the nearest of `num_embeddings` learned codebook vectors. That argmin is
    # non-differentiable, so gradients are passed through with the
    # straight-through estimator (VQGAN-CLIP generate.py:274-278) — the atom
    # under VQGAN, DALL-E-style tokenizers and neural audio codecs.
    num_embeddings: int = 64  # codebook size K (how many discrete codes)
    embedding_dim: int = 32   # code / latent-channel width D
    # commitment_cost (beta): weight on the commitment loss ‖z_e - sg[e]‖²,
    # which pulls the encoder output toward its chosen code so the encoder
    # "commits" instead of drifting between codes. 0.25 is the paper default.
    commitment_cost: float = 0.25
    dataset: str = "mnist"
