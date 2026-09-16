"""CycleGAN for 28x28 grayscale: unpaired translation between two domains.

The `gan` mini learns ONE generator that turns noise into samples of a single
distribution. CycleGAN (Zhu, Park, Isola & Efros, 2017) learns to TRANSLATE
between two image domains A and B when no aligned (a, b) pairs exist — the only
supervision is "this is a pile of A images, that is a pile of B images".

Two generators and two discriminators:

    G : A -> B      D_B : is this a real B?      (both PatchGANs)
    F : B -> A      D_A : is this a real A?

An adversarial loss alone is under-determined: G could map every a to the same
convincing B and D_B would be happy (target-domain mode collapse). The fix is
CYCLE CONSISTENCY — translating there and back must return the original:

    F(G(a)) ≈ a        and        G(F(b)) ≈ b

That L1 penalty (weighted by λ_cycle=10) is what forces G and F to preserve
content and be near-inverses. An optional IDENTITY loss ‖G(b) - b‖ says "a real
B fed to the A->B generator should come back unchanged", which stabilizes tone.

This mini re-implements junyanz's `cycle_gan_model.py::backward_G` (the 6-term
generator loss, lines 153-180) and the PatchGAN `NLayerDiscriminator`
(networks.py:518-555) at 28x28 toy scale: tiny 2-block ResNet generators over a
7x7 feature map, a 3-layer PatchGAN emitting a 7x7 logit MAP (not one scalar),
and an LSGAN (MSE) objective. The image-history buffer lives in trainer.py.

Deliberately simplified vs Zhu 2017: no instance norm (BatchNorm), 2 resnet
blocks instead of 6-9, no learning-rate schedule, MNIST<->FashionMNIST toy
domains at 28x28 rather than 256x256 photographs.
"""
from __future__ import annotations

import torch
import torch.nn as nn


class ResnetBlock(nn.Module):
    """A residual block: two 3x3 convs with a skip connection (junyanz networks.py)."""

    def __init__(self, dim: int):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(dim, dim, 3, padding=1),
            nn.BatchNorm2d(dim),
            nn.ReLU(inplace=True),
            nn.Conv2d(dim, dim, 3, padding=1),
            nn.BatchNorm2d(dim),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x + self.block(x)


class ResnetGenerator(nn.Module):
    """Tiny ResNet translator: downsample -> N resnet blocks -> upsample -> Tanh.

    Same shape as junyanz's ResnetGenerator, shrunk for 28x28: one stride-2
    downsample to 14x14, N residual blocks, one transposed-conv upsample back to
    28x28, Tanh output (pixels in [-1, 1], matching the trainer's real scaling).
    """

    def __init__(self, in_channels: int = 1, ngf: int = 16, n_blocks: int = 2):
        super().__init__()
        self.down = nn.Sequential(
            nn.Conv2d(in_channels, ngf, 3, padding=1),
            nn.BatchNorm2d(ngf),
            nn.ReLU(inplace=True),
            nn.Conv2d(ngf, ngf * 2, 3, stride=2, padding=1),  # 14x14
            nn.BatchNorm2d(ngf * 2),
            nn.ReLU(inplace=True),
        )
        self.blocks = nn.Sequential(*[ResnetBlock(ngf * 2) for _ in range(n_blocks)])
        self.up = nn.Sequential(
            nn.ConvTranspose2d(ngf * 2, ngf, 4, stride=2, padding=1),  # 28x28
            nn.BatchNorm2d(ngf),
            nn.ReLU(inplace=True),
            nn.Conv2d(ngf, in_channels, 3, padding=1),
            nn.Tanh(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """x: [B, C, 28, 28] -> translated [B, C, 28, 28] in [-1, 1]."""
        return self.up(self.blocks(self.down(x)))


class PatchDiscriminator(nn.Module):
    """PatchGAN: classifies each ~receptive-field patch as real/fake.

    The one idea vs the `gan` Discriminator: the final conv outputs an N×N logit
    MAP, not a single scalar (junyanz NLayerDiscriminator, networks.py:518-555).
    Each output cell judges one overlapping image patch, so the loss is averaged
    over the map — cheaper, translation-equivariant, and it grades local texture
    rather than a global real/fake verdict. No Sigmoid: paired with the LSGAN
    (MSE) objective in the trainer.
    """

    def __init__(self, in_channels: int = 1, ndf: int = 16):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(in_channels, ndf, 4, stride=2, padding=1),  # 14x14
            nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(ndf, ndf * 2, 4, stride=2, padding=1),      # 7x7
            nn.BatchNorm2d(ndf * 2),
            nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(ndf * 2, 1, 3, padding=1),  # 7x7 logit MAP (one per patch)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """x: [B, C, 28, 28] -> [B, 1, 7, 7] per-patch real/fake logits."""
        return self.net(x)


def lsgan_d_loss(disc: PatchDiscriminator, real: torch.Tensor, fake: torch.Tensor) -> torch.Tensor:
    """LSGAN discriminator loss: push real patches to 1, fake patches to 0 (MSE).

    Least-squares GAN (Mao et al. 2017) — the objective junyanz uses by default.
    `fake` is detached upstream so the D step never touches the generators.
    """
    real_logits = disc(real)
    fake_logits = disc(fake.detach())
    loss_real = ((real_logits - 1.0) ** 2).mean()
    loss_fake = (fake_logits ** 2).mean()
    return 0.5 * (loss_real + loss_fake)


def lsgan_g_loss(disc: PatchDiscriminator, fake: torch.Tensor) -> torch.Tensor:
    """LSGAN generator loss: the fake patches should be judged real (target 1)."""
    return ((disc(fake) - 1.0) ** 2).mean()
