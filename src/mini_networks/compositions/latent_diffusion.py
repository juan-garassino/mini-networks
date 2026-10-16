"""Latent diffusion: a VAE compresses images, a DDPM learns the latents.

The Stable Diffusion recipe (Rombach et al., 2022) at MNIST scale, built
from two zoo parts trained in sequence:

    1. VAE  [B,1,28,28] in [-1,1] -> latent [B,4,7,7] -> reconstruction
       trained on MSE + 1e-3 * KL (vae_loss default weight)
    2. VAE frozen (eval: encode returns the posterior mean), UNet trained on
       the DDPM objective MSE(eps_theta(z_t, t), eps) over those latents
    sample: z_T ~ N(0,I) [n,4,7,7] -> reverse chain -> VAE.decode -> image

Why: 4x7x7 = 196 numbers instead of 784 pixels — the diffusion model spends
its capacity on content while the VAE handles pixel detail, which is what
makes high-resolution diffusion affordable.

Deliberately simplified: no latent scale factor (SD rescales latents to unit
variance; here a small KL weight leaves their scale to chance), no
perceptual/adversarial VAE loss, an unconditional UNet, and the VAE is
trained for the same epoch budget as the UNet rather than pretrained to
convergence.
"""
from __future__ import annotations

import torch
import torch.nn.functional as F

from mini_networks.core.logging.logger import Logger
from mini_networks.core.data.registry import get_dataloader
from mini_networks.models.diffusion.vae import VAE, vae_loss
from mini_networks.models.diffusion.model import UNet
from mini_networks.models.diffusion.scheduler import NoiseScheduler
from mini_networks.core.config import BaseConfig
from mini_networks.core.diffusion.sampling import sample_loop


class LatentDiffusionConfig(BaseConfig):
    """Knobs: ``latent_channels`` (C of the [C,7,7] latent; capacity of the
    compression), ``timesteps``/``beta_*`` (linear DDPM schedule over latents,
    tier-capped via ``effective_timesteps``)."""

    model_name: str = "latent_diffusion"
    latent_channels: int = 4
    timesteps: int = 200
    beta_start: float = 1e-4
    beta_end: float = 0.02
    dataset: str = "mnist"


class LatentDiffusion:
    """VAE then latent-space UNet, with a sampler that decodes back to pixels."""

    def __init__(self):
        self.vae: VAE | None = None
        self.unet: UNet | None = None
        self.scheduler: NoiseScheduler | None = None

    def train(self, config: LatentDiffusionConfig, logger: Logger) -> None:
        """Train the VAE, freeze it, then train the UNet on its latents.

        Logs ``vae_loss`` then ``latent_loss`` per epoch; saves ``vae.pt`` and
        ``unet.pt``.
        """
        dl = get_dataloader(
            name=config.dataset,
            data_root=config.data_root,
            split="train",
            task="classification",
            batch_size=config.effective_batch_size,
            fast_demo=config.effective_fast_demo,
            sample_limit=config.dataset_sample_limit,
        )
        vae = VAE(latent_channels=config.latent_channels).to(config.device)
        unet = UNet(in_channels=config.latent_channels, base_channels=32).to(config.device)
        scheduler = NoiseScheduler(
            timesteps=config.effective_timesteps,
            beta_start=config.beta_start,
            beta_end=config.beta_end,
        ).to(torch.device(config.device))
        self.vae, self.unet, self.scheduler = vae, unet, scheduler

        opt_vae = torch.optim.Adam(vae.parameters(), lr=config.learning_rate)
        opt_unet = torch.optim.Adam(unet.parameters(), lr=config.learning_rate)

        # Train VAE briefly
        for epoch in range(config.effective_epochs):
            vae.train()
            total = 0.0
            for images, _ in dl:
                images = images.to(config.device) * 2.0 - 1.0
                recon, mu, logvar = vae(images)
                loss = vae_loss(recon, images, mu, logvar)
                opt_vae.zero_grad()
                loss.backward()
                opt_vae.step()
                total += loss.item()
            logger.log_metrics(epoch, {"vae_loss": total / max(1, len(dl))})

        # Train UNet in latent space — VAE must be frozen in eval mode so its
        # BatchNorm stats and reparameterisation noise don't shift the latents
        vae.eval()
        for epoch in range(config.effective_epochs):
            unet.train()
            total = 0.0
            for images, _ in dl:
                images = images.to(config.device) * 2.0 - 1.0
                with torch.no_grad():
                    mu, logvar = vae.encode(images)
                    z = vae.reparameterise(mu, logvar)
                B = z.size(0)
                t = torch.randint(0, config.effective_timesteps, (B,), device=config.device)
                noise = torch.randn_like(z)
                zt = scheduler.add_noise(z, noise, t)
                pred = unet(zt, t)
                loss = F.mse_loss(pred, noise)
                opt_unet.zero_grad()
                loss.backward()
                opt_unet.step()
                total += loss.item()
            logger.log_metrics(epoch, {"latent_loss": total / max(1, len(dl))})

        torch.save(vae.state_dict(), logger.artifact_path("vae.pt"))
        torch.save(unet.state_dict(), logger.artifact_path("unet.pt"))

    @torch.no_grad()
    def sample(self, config: LatentDiffusionConfig, n: int = 4):
        """Denoise ``n`` latents [n,C,7,7] and decode -> [n,1,28,28] in [0,1].

        The VAE decoder ends in Tanh, so ``(x + 1) / 2`` lands in [0,1].
        """
        if self.vae is None or self.unet is None or self.scheduler is None:
            raise RuntimeError("Train first.")
        self.vae.eval()
        self.unet.eval()
        z = sample_loop(
            scheduler=self.scheduler,
            predict_noise=lambda z, t_batch, t, _: self.unet(z, t_batch),
            shape=(n, config.latent_channels, 7, 7),
            device=config.device,
            timesteps=config.effective_timesteps,
        )
        images = self.vae.decode(z)
        return (images + 1.0) / 2.0
