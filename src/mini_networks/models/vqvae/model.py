"""VQ-VAE for 28x28 grayscale images: a discrete-latent autoencoder.

Where the `vae` mini's bottleneck is a continuous Gaussian z ~ N(mu, sigma),
VQ-VAE (van den Oord, Vinyals & Kavukcuoglu, 2017) makes the latent DISCRETE:
the encoder produces a grid of continuous vectors z_e, each is snapped to its
nearest neighbour in a learned codebook of K vectors (the "vector
quantization"), and the decoder reconstructs from those quantized codes z_q.

    encode:  [B,1,28,28] -> Conv s=2 (32) -> Conv s=2 (D) -> z_e [B,D,7,7]
    quantize: for each of the 7x7 spatial vectors, pick argmin_k ‖z_e - e_k‖²
              -> z_q [B,D,7,7] built from codebook rows (indices are the tokens)
    decode:  z_q -> ConvT s=2 (32) -> ConvT s=2 (1) -> Sigmoid -> [B,1,28,28]

The nearest-neighbour argmin has zero gradient, so training uses the
STRAIGHT-THROUGH ESTIMATOR: on the forward pass the decoder sees the quantized
z_q, but on the backward pass the gradient is copied straight through to the
continuous z_e as if quantization were the identity — `z_q = z_e + (z_q -
z_e).detach()` (the tensor-op form of VQGAN-CLIP's ReplaceGrad, generate.py
:245-278). The codebook itself is trained by two extra losses (see vqvae_loss):
a codebook loss that moves each code toward the encoder outputs assigned to it,
and a commitment loss that moves the encoder toward its chosen code.

Nearest-neighbour distance is expanded exactly as in VQGAN-CLIP's
`vector_quantize` (generate.py:274-278):
    ‖z - e‖² = ‖z‖² + ‖e‖² - 2 z·e

Deliberately simplified vs the paper: no PixelCNN prior over the discrete codes
(so sampling here means decoding random codes, not autoregressive generation),
a tiny 2-conv encoder/decoder, no EMA codebook updates (codebook trained by the
codebook-loss term instead), and MSE reconstruction on [0,1] pixels.
"""
from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F


class VectorQuantizer(nn.Module):
    """Snap each spatial vector of z_e to its nearest codebook entry.

    Holds the codebook as an [K, D] embedding table. forward() returns the
    quantized tensor (with the straight-through gradient wired in), the
    codebook + commitment loss terms, and the discrete code indices + how many
    codes were actually used (perplexity), which is the headline collapse
    metric for discrete latents.
    """

    def __init__(self, num_embeddings: int, embedding_dim: int, commitment_cost: float = 0.25):
        super().__init__()
        self.num_embeddings = num_embeddings
        self.embedding_dim = embedding_dim
        self.commitment_cost = commitment_cost
        self.codebook = nn.Embedding(num_embeddings, embedding_dim)
        # Uniform init over 1/K keeps codes near the encoder's initial scale so
        # every code has a chance of being selected early (paper convention).
        self.codebook.weight.data.uniform_(-1.0 / num_embeddings, 1.0 / num_embeddings)

    def forward(self, z_e: torch.Tensor):
        """z_e: [B, D, H, W] -> (z_q, vq_loss, indices, perplexity)."""
        B, D, H, W = z_e.shape
        # [B, D, H, W] -> [B*H*W, D]: one row per spatial location to quantize.
        flat = z_e.permute(0, 2, 3, 1).reshape(-1, D)

        # Squared distances to every code: ‖z‖² + ‖e‖² - 2 z·e
        # (VQGAN-CLIP generate.py:274-278).
        dist = (
            flat.pow(2).sum(dim=1, keepdim=True)
            + self.codebook.weight.pow(2).sum(dim=1)
            - 2 * flat @ self.codebook.weight.t()
        )
        indices = dist.argmin(dim=1)  # [B*H*W] — the discrete token per location
        z_q_flat = self.codebook(indices)  # [B*H*W, D]

        # Codebook loss: move the codes toward the encoder outputs assigned to
        # them (sg = stop-gradient on the encoder side).
        codebook_loss = F.mse_loss(z_q_flat, flat.detach())
        # Commitment loss: move the encoder toward its chosen code.
        commitment_loss = F.mse_loss(flat, z_q_flat.detach())
        vq_loss = codebook_loss + self.commitment_cost * commitment_loss

        z_q = z_q_flat.view(B, H, W, D).permute(0, 3, 1, 2).contiguous()
        # Straight-through estimator: forward uses z_q, backward copies the
        # gradient straight to z_e (quantization treated as identity).
        z_q = z_e + (z_q - z_e).detach()

        # Perplexity = exp(entropy of code usage): ~num_embeddings if all codes
        # are used, ~1 on codebook collapse.
        one_hot = F.one_hot(indices, self.num_embeddings).float()
        avg_probs = one_hot.mean(dim=0)
        perplexity = torch.exp(-(avg_probs * (avg_probs + 1e-10).log()).sum())

        return z_q, vq_loss, indices.view(B, H, W), perplexity


class VQVAE(nn.Module):
    def __init__(self, num_embeddings: int = 64, embedding_dim: int = 32, commitment_cost: float = 0.25):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Conv2d(1, 32, 3, stride=2, padding=1),   # 14x14
            nn.ReLU(),
            nn.Conv2d(32, embedding_dim, 3, stride=2, padding=1),  # 7x7, D channels
            nn.ReLU(),
        )
        self.quantizer = VectorQuantizer(num_embeddings, embedding_dim, commitment_cost)
        self.decoder = nn.Sequential(
            nn.ConvTranspose2d(embedding_dim, 32, 4, stride=2, padding=1),  # 14x14
            nn.ReLU(),
            nn.ConvTranspose2d(32, 1, 4, stride=2, padding=1),              # 28x28
            nn.Sigmoid(),
        )

    def encode(self, x: torch.Tensor) -> torch.Tensor:
        return self.encoder(x)

    def decode(self, z_q: torch.Tensor) -> torch.Tensor:
        return self.decoder(z_q)

    def forward(self, x: torch.Tensor):
        z_e = self.encode(x)
        z_q, vq_loss, indices, perplexity = self.quantizer(z_e)
        recon = self.decode(z_q)
        return recon, vq_loss, indices, perplexity


def vqvae_loss(recon: torch.Tensor, x: torch.Tensor, vq_loss: torch.Tensor):
    """Total loss = reconstruction (MSE) + codebook/commitment (vq_loss).

    The reparameterization+KL of the `vae` mini is replaced by the discrete
    vq_loss; there is no KL term because the prior over codes is uniform.
    """
    recon_loss = F.mse_loss(recon, x, reduction="mean")
    return recon_loss + vq_loss, recon_loss
