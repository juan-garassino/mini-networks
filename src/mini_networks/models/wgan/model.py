"""WGAN for MNIST: the minimal fix to the `gan` mini's on-purpose mode collapse.

The vanilla GAN (`models/gan`) plays the original minimax game on the JS
divergence; when D wins, its gradient to G vanishes and G collapses onto a few
modes. WGAN (Arjovsky, Chintala & Bottou, 2017) replaces the game with the
Wasserstein-1 (earth-mover) distance, whose Kantorovich-Rubinstein dual is

    W(P_r, P_g) = sup_{‖f‖_L ≤ 1}  E_{x~P_r}[f(x)] - E_{x~P_g}[f(x)]

so the discriminator becomes a *critic* f that outputs a raw score (no Sigmoid,
no BCE) and G minimises the gap between the critic's mean score on reals and on
fakes. W is continuous and differentiable almost everywhere in G's parameters,
so the critic gives usable gradients even when it is far ahead — which is what
kills the collapse.

The whole WGAN delta vs the `gan` mini is three lines, all in the trainer:
  1. Weight clipping — clamp every critic weight to [-c, c] after each critic
     step (WassersteinGAN main.py:184-186). A blunt way to keep f roughly
     1-Lipschitz, which the dual above requires.
  2. n_critic schedule — train the critic several steps per generator step so
     the Wasserstein estimate is accurate before G uses it (main.py:174-181).
  3. RMSProp, not Adam — the paper reports momentum destabilises the clipped
     critic (main.py:156-162).

The nets themselves reuse the `gan` mini's mini-DCGAN, with ONE change: the
Critic drops the final Sigmoid and emits a scalar score, not a probability.

Deliberately simplified vs Arjovsky 2017: weight clipping rather than the later
gradient penalty (WGAN-GP), fully-connected-free but tiny 2-conv nets, MNIST at
28x28, and a shortened n_critic warm-up so a CPU mini run stays cheap.
"""
from __future__ import annotations

import torch
import torch.nn as nn


class Generator(nn.Module):
    """Mini-DCGAN generator: latent -> 7x7 map -> two stride-2 transposed convs -> 28x28 Tanh.

    Identical to the `gan` mini's generator — WGAN changes the *objective and
    optimiser*, not the generator architecture.
    """

    def __init__(self, latent_dim: int = 100, image_size: int = 28, in_channels: int = 1):
        super().__init__()
        assert image_size == 28, "mini-DCGAN generator is wired for 28x28"
        self.project = nn.Linear(latent_dim, 256 * 7 * 7)
        self.net = nn.Sequential(
            nn.BatchNorm2d(256), nn.ReLU(),
            nn.ConvTranspose2d(256, 128, 4, stride=2, padding=1),  # 14x14
            nn.BatchNorm2d(128), nn.ReLU(),
            nn.ConvTranspose2d(128, in_channels, 4, stride=2, padding=1),  # 28x28
            nn.Tanh(),
        )
        self.image_size = image_size
        self.in_channels = in_channels

    def forward(self, z: torch.Tensor) -> torch.Tensor:
        """z: [B, latent_dim] -> [B, C, H, W]."""
        x = self.project(z).view(z.size(0), 256, 7, 7)
        return self.net(x)


class Critic(nn.Module):
    """Mini-DCGAN critic: two stride-2 convs -> a scalar score [B, 1].

    The one architectural change vs the `gan` Discriminator: NO final Sigmoid.
    The Wasserstein critic outputs an unbounded real score, not a probability —
    its job is to maximise (mean score on reals - mean score on fakes), i.e.
    estimate the earth-mover distance, not classify. No BatchNorm either: BN's
    per-batch statistics couple samples and muddy the per-sample Lipschitz
    bound that weight clipping is trying to enforce.
    """

    def __init__(self, image_size: int = 28, in_channels: int = 1):
        super().__init__()
        assert image_size == 28, "mini-DCGAN critic is wired for 28x28"
        self.net = nn.Sequential(
            nn.Conv2d(in_channels, 64, 4, stride=2, padding=1),   # 14x14
            nn.LeakyReLU(0.2),
            nn.Conv2d(64, 128, 4, stride=2, padding=1),           # 7x7
            nn.LeakyReLU(0.2),
            nn.Flatten(),
            nn.Linear(128 * 7 * 7, 1),  # raw score — no Sigmoid
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """x: [B, C, H, W] -> [B, 1] raw critic score (higher = more real)."""
        return self.net(x)


def wgan_critic_loss(critic: Critic, real: torch.Tensor, fake: torch.Tensor) -> torch.Tensor:
    """Critic loss = -(E[f(real)] - E[f(fake)]).

    Maximising E[f(real)] - E[f(fake)] estimates the Wasserstein distance, so
    the critic MINIMISES its negation. `fake` is detached upstream so this step
    never touches G (matching the `gan` mini's convention). Raw means, no BCE
    (WassersteinGAN main.py:200-211).
    """
    return -(critic(real).mean() - critic(fake.detach()).mean())


def wgan_gen_loss(critic: Critic, fake: torch.Tensor) -> torch.Tensor:
    """Generator loss = -E[f(fake)]: push the critic's score on fakes up."""
    return -critic(fake).mean()
