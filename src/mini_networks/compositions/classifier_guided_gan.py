"""Classifier-guided GAN: add a classifier's opinion to the generator loss.

Composes the zoo's GAN (mini-DCGAN Generator: z [B,100] -> [B,1,28,28] Tanh;
Discriminator: image -> [B,1] real-probability) with a SmallCNN classifier,
all three trained together, one step each per batch:

    1. C:  cross-entropy on the real batch (images rescaled to [0,1])
    2. D:  standard BCE GAN loss, real vs G(z)
    3. G:  gan_g_loss(D, G(z)) + cls_weight * CE(C(G(z)), labels)

The idea it demonstrates: any differentiable critic can be bolted onto a
GAN's generator objective as an auxiliary loss (as in AC-GAN, but with an
external classifier instead of a shared discriminator head).

Deliberately simplified — and worth noticing: the generator is
UNCONDITIONAL, yet its auxiliary target is the label of the *real* batch
row it happens to share an index with. Since z carries no label, G cannot
match those targets; the expected cross-entropy is minimised when C
predicts the batch's label *distribution* for every fake, so the term pulls
toward class-ambiguous images rather than any chosen digit. A faithful
AC-GAN would feed the label to G. No sample() method is provided; inspect ``generator.pt`` instead.
"""
from __future__ import annotations

import torch
import torch.nn.functional as F

from mini_networks.core.config import BaseConfig
from mini_networks.core.data.registry import get_dataloader
from mini_networks.core.logging.logger import Logger
from mini_networks.models.classifier.model import SmallCNN
from mini_networks.models.gan.model import Generator, Discriminator, gan_d_loss, gan_g_loss


class ClassifierGuidedGANConfig(BaseConfig):
    """Knobs: ``cls_weight`` (strength of the classifier term in G's loss;
    0 = plain GAN), ``latent_dim`` (z size), ``cls_hidden`` (SmallCNN width)."""

    model_name: str = "classifier_guided_gan"
    latent_dim: int = 100
    num_classes: int = 10
    cls_hidden: int = 64
    cls_weight: float = 1.0
    dataset: str = "mnist"


class ClassifierGuidedGAN:
    """Generator, discriminator and classifier trained jointly per batch."""

    def __init__(self):
        self.G: Generator | None = None
        self.D: Discriminator | None = None
        self.C: SmallCNN | None = None

    def _build_classifier(self, config: ClassifierGuidedGANConfig) -> SmallCNN:
        """SmallCNN: [B,1,28,28] in [0,1] -> [B,num_classes] logits."""
        return SmallCNN(hidden_dim=config.cls_hidden, num_classes=config.num_classes).to(config.device)

    def train(self, config: ClassifierGuidedGANConfig, logger: Logger) -> None:
        """Alternate C, D, G updates every batch.

        Logs ``g_loss`` (adversarial part only), ``d_loss`` and ``c_loss`` per
        epoch; saves ``generator.pt``, ``discriminator.pt``, ``classifier.pt``.
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

        G = Generator(latent_dim=config.latent_dim).to(config.device)
        D = Discriminator().to(config.device)
        C = self._build_classifier(config)
        self.G, self.D, self.C = G, D, C

        opt_g = torch.optim.Adam(G.parameters(), lr=config.learning_rate)
        opt_d = torch.optim.Adam(D.parameters(), lr=config.learning_rate)
        opt_c = torch.optim.Adam(C.parameters(), lr=config.learning_rate)
        bce = torch.nn.BCELoss()

        for epoch in range(config.effective_epochs):
            total_g = 0.0
            total_d = 0.0
            total_c = 0.0
            for images, labels in dl:
                images, labels = images.to(config.device), labels.to(config.device)
                images = images * 2.0 - 1.0
                B = images.size(0)

                # Train classifier on real images
                logits = C((images + 1.0) / 2.0)
                c_loss = F.cross_entropy(logits, labels)
                opt_c.zero_grad()
                c_loss.backward()
                opt_c.step()
                total_c += c_loss.item()

                # Train D
                z = torch.randn(B, config.latent_dim, device=config.device)
                fake = G(z)
                d_loss = gan_d_loss(D, images, fake, bce)
                opt_d.zero_grad()
                d_loss.backward()
                opt_d.step()
                total_d += d_loss.item()

                # Train G with classifier guidance
                z = torch.randn(B, config.latent_dim, device=config.device)
                fake = G(z)
                g_loss = gan_g_loss(D, fake, bce)
                cls_logits = C((fake + 1.0) / 2.0)
                cls_loss = F.cross_entropy(cls_logits, labels)
                loss = g_loss + config.cls_weight * cls_loss
                opt_g.zero_grad()
                loss.backward()
                opt_g.step()
                total_g += g_loss.item()

            n = max(1, len(dl))
            logger.log_metrics(epoch, {
                "g_loss": total_g / n,
                "d_loss": total_d / n,
                "c_loss": total_c / n,
            })

        torch.save(G.state_dict(), logger.artifact_path("generator.pt"))
        torch.save(D.state_dict(), logger.artifact_path("discriminator.pt"))
        torch.save(C.state_dict(), logger.artifact_path("classifier.pt"))
