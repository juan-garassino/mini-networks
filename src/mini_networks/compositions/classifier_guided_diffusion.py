"""Classifier-guided diffusion: steer an unconditional DDPM with a classifier.

Composes two zoo atoms that never train together:

    classifier  SmallCNN   [B,1,28,28] in [0,1] -> [B,10] logits
    diffusion   UNet + NoiseScheduler, an unconditional MNIST DDPM in [-1,1]

At sampling time each reverse step nudges the predicted noise along the
classifier's gradient (Dhariwal & Nichol, 2021, "Diffusion Models Beat GANs"):

    eps_hat = eps_theta(x_t, t) - s * grad_x log p(y = target | x_t)

Subtracting the gradient from eps moves the denoised estimate *toward*
images the classifier calls ``target_class``; ``guide_scale`` s trades
diversity for class fidelity. The point: an unconditional generator becomes
conditional with no retraining — guidance is a plug-in at inference.

Deliberately simplified vs the paper: the classifier is trained on CLEAN
images only (the paper trains a noise-aware classifier p(y | x_t, t)), so
its gradient is least reliable at high t; the sqrt(1 - alpha_bar_t) factor
on the gradient is dropped (s absorbs it); and guidance is applied to eps
at every step via the shared ``sample_loop`` hook.
"""
from __future__ import annotations

from typing import Optional

import torch
import torch.nn.functional as F

from mini_networks.core.config import BaseConfig
from mini_networks.core.data.registry import get_dataloader
from mini_networks.core.logging.logger import Logger
from mini_networks.models.classifier.model import SmallCNN
from mini_networks.models.diffusion.model import UNet
from mini_networks.models.diffusion.scheduler import NoiseScheduler
from mini_networks.core.diffusion.sampling import sample_loop


class ClassifierGuidedDiffusionConfig(BaseConfig):
    """Knobs that matter: ``guide_scale`` (0 = unguided; larger = more
    on-class, less diverse), ``target_class`` (digit to steer toward),
    ``timesteps``/``beta_*`` (linear DDPM schedule; tier-capped via
    ``effective_timesteps``), ``classifier_epochs`` (tier-scaled, M caps at 2)."""

    model_name: str = "classifier_guided_diffusion"

    # Diffusion
    timesteps: int = 200
    beta_start: float = 1e-4
    beta_end: float = 0.02
    base_channels: int = 32

    # Classifier
    cls_hidden: int = 64
    num_classes: int = 10
    classifier_epochs: int = 2

    # Guidance
    guide_scale: float = 2.0
    target_class: int = 0

    # Data
    dataset: str = "mnist"


class ClassifierGuidedDiffusion:
    """Train a classifier and a DDPM separately, then sample with guidance."""

    def __init__(self):
        self.unet: UNet | None = None
        self.classifier: SmallCNN | None = None
        self.scheduler: NoiseScheduler | None = None

    def _build_unet(self, config: ClassifierGuidedDiffusionConfig) -> UNet:
        """Unconditional eps-predicting UNet: ([B,1,28,28], t [B]) -> [B,1,28,28]."""
        return UNet(in_channels=1, base_channels=config.base_channels).to(config.device)

    def _build_classifier(self, config: ClassifierGuidedDiffusionConfig) -> SmallCNN:
        """Guidance classifier: [B,1,28,28] in [0,1] -> [B,num_classes] logits."""
        return SmallCNN(hidden_dim=config.cls_hidden, num_classes=config.num_classes).to(config.device)

    def train_classifier(self, config: ClassifierGuidedDiffusionConfig, logger: Logger) -> None:
        """Train the SmallCNN with cross-entropy on clean images.

        Logs ``cls_loss`` per epoch; saves ``classifier.pt``.
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
        clf = self._build_classifier(config)
        opt = torch.optim.Adam(clf.parameters(), lr=config.learning_rate)
        epochs = config.tier_epochs(config.classifier_epochs, medium_cap=2)
        for epoch in range(epochs):
            clf.train()
            total = 0.0
            for images, labels in dl:
                images, labels = images.to(config.device), labels.to(config.device)
                logits = clf(images)
                loss = F.cross_entropy(logits, labels)
                opt.zero_grad()
                loss.backward()
                opt.step()
                total += loss.item()
            logger.log_metrics(epoch, {"cls_loss": total / max(1, len(dl))})
        self.classifier = clf
        torch.save(clf.state_dict(), logger.artifact_path("classifier.pt"))

    def train_diffusion(self, config: ClassifierGuidedDiffusionConfig, logger: Logger) -> None:
        """Train the UNet with the DDPM noise-prediction loss (labels unused).

        Images are rescaled to [-1,1]; loss = MSE(eps_theta(x_t, t), eps) at a
        uniform random t. Logs ``diff_loss`` per epoch; saves ``unet.pt``.
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
        unet = self._build_unet(config)
        scheduler = NoiseScheduler(
            timesteps=config.effective_timesteps,
            beta_start=config.beta_start,
            beta_end=config.beta_end,
        ).to(torch.device(config.device))
        opt = torch.optim.Adam(unet.parameters(), lr=config.learning_rate)
        epochs = config.effective_epochs
        for epoch in range(epochs):
            unet.train()
            total = 0.0
            for images, _ in dl:
                images = images.to(config.device) * 2.0 - 1.0
                B = images.shape[0]
                t = torch.randint(0, config.effective_timesteps, (B,), device=config.device)
                noise = torch.randn_like(images)
                xt = scheduler.add_noise(images, noise, t)
                pred = unet(xt, t)
                loss = F.mse_loss(pred, noise)
                opt.zero_grad()
                loss.backward()
                opt.step()
                total += loss.item()
            logger.log_metrics(epoch, {"diff_loss": total / max(1, len(dl))})
        self.unet = unet
        self.scheduler = scheduler
        torch.save(unet.state_dict(), logger.artifact_path("unet.pt"))

    def sample(self, config: ClassifierGuidedDiffusionConfig, n: int = 4) -> torch.Tensor:
        """Draw ``n`` guided samples of ``config.target_class`` -> [n,1,28,28] in [0,1].

        Requires both ``train_classifier`` and ``train_diffusion`` first.
        """
        if self.unet is None or self.classifier is None or self.scheduler is None:
            raise RuntimeError("Train classifier and diffusion before sampling.")
        unet = self.unet
        clf = self.classifier
        sched = self.scheduler
        unet.eval()
        clf.eval()

        target = torch.full((n,), int(config.target_class), device=config.device, dtype=torch.long)

        def predict_noise(x, t_batch, t, _):
            """Unconditional eps prediction for the current x_t."""
            return unet(x, t_batch)

        def guidance(x, t_batch, t, eps, _):
            """eps - s * grad_x log p(target | x): pushes x_{t-1} toward the class."""
            # The classifier was trained on [0,1] images, the chain lives in
            # [-1,1]: rescale before scoring. Summing log-probs over the batch
            # gives each sample its own gradient in one backward pass.
            x_in = x.detach().requires_grad_(True)
            logits = clf((x_in + 1.0) / 2.0)
            logp = F.log_softmax(logits, dim=-1)
            score = logp[torch.arange(x_in.size(0), device=config.device), target].sum()
            grad = torch.autograd.grad(score, x_in)[0]
            return eps - config.guide_scale * grad

        x = sample_loop(
            scheduler=sched,
            predict_noise=predict_noise,
            guidance_fn=guidance,
            shape=(n, 1, 28, 28),
            device=config.device,
            timesteps=config.effective_timesteps,
        )

        return (x + 1.0) / 2.0

    def run(self, config: ClassifierGuidedDiffusionConfig, logger: Logger) -> None:
        """Train classifier then diffusion; artifacts ``classifier.pt`` + ``unet.pt``."""
        self.train_classifier(config, logger)
        self.train_diffusion(config, logger)
