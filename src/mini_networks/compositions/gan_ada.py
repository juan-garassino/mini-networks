"""GAN-ADA: Adaptive Discriminator Augmentation on top of the `gan` mini.

A minimal, faithful port of the load-bearing idea in StyleGAN2-ADA (Karras,
Aittala, Hellsten, Laine, Lehtinen & Aila, "Training Generative Adversarial
Networks with Limited Data", NeurIPS 2020 — NVlabs/stylegan2-ada-pytorch). The
paper's insight: when data is scarce the discriminator *overfits* — it memorises
the training set, its validation accuracy diverges from training, and the
gradient it feeds the generator stops being useful, so samples degrade. ADA
fixes this WITHOUT extra data by showing D augmented images with an adaptively
tuned probability p, and — crucially — keeping the augmentation
**non-leaking**: the same pipeline is applied to BOTH real and fake images
before D sees them, so D cannot win by detecting the augmentation itself, and G
never learns to reproduce augmented artefacts.

Two pieces carry the "ADA" name; both live below and are unit-tested in
isolation (tests/test_gan_ada.py):

  1. `AdaptiveAugment` — the augmentation pipeline, applied per-image with
     probability p to reals AND fakes. A deliberately MINIMAL subset of the
     paper's 18-transform "bg-c-t" pipeline: x-flip, integer (tensor)
     translation, optional 90° rotation and brightness. Enough to be a real,
     shape-preserving, differentiable-through augmentation; documented as a
     subset so the teaching point (adaptive p, non-leaking application) stays
     legible rather than drowning in transforms.

  2. `ada_update_p` — the E[sign(D_real)] heuristic controller (paper §3,
     Alg. 1; augment.py `Loss.accumulate_gradients` + train_loop's
     `augment_pipe.p` update). r_t = mean(sign(D(x_real))) over a window is the
     overfitting signal: r_t → 1 means D is perfectly confident on reals (it has
     memorised them), r_t ≈ 0 (or negative) means it is not. Each interval p is
     nudged toward a target (~0.6) by a step proportional to throughput
     (batch*interval / (ada_kimg*1000)), clamped to [0, 1]. Raise p when
     overfitting, lower it when not — the whole adaptivity in one line.

Deliberately simplified vs StyleGAN2-ADA: the base GAN is the `gan` mini's
mini-DCGAN on 28×28 MNIST (not a StyleGAN2 synthesis network), the augmentation
is a 4-transform subset (not the full 18), the controller runs on the batch-mean
sign of D (not an accumulated running window across many minibatches), and there
is no r1 regularisation or path-length term. The adaptive-p / non-leaking-aug
mechanism — the actual contribution of the paper — is reproduced faithfully.
Device-agnostic throughout: everything follows `config.device` like the sibling
GAN compositions; no hardcoded .cuda().
"""
from __future__ import annotations

import logging

import torch

from mini_networks.core.blocks.ema import EMA
from mini_networks.core.config import BaseConfig
from mini_networks.core.data.registry import get_dataloader
from mini_networks.core.logging.logger import Logger
from mini_networks.models.gan.model import (
    Discriminator,
    Generator,
    gan_d_loss,
    gan_g_loss,
)

log = logging.getLogger(__name__)


class GANADAConfig(BaseConfig):
    model_name: str = "gan_ada"
    latent_dim: int = 100
    dataset: str = "mnist"
    lr: float = 0.0002

    # --- Adaptive Discriminator Augmentation (StyleGAN2-ADA, NeurIPS 2020) ---
    # ada_target: the E[sign(D_real)] value the controller steers p toward. The
    # paper sweeps 0.4–0.8 and settles on 0.6 as the sweet spot for limited data
    # (train_loop.py `--target` default 0.6). Higher target => tolerate more
    # overfitting before augmenting; lower => augment more aggressively.
    ada_target: float = 0.6
    # ada_interval: adjust p every N generator steps (paper `ada_interval`,
    # default 4 minibatches). Batched so the sign estimate has enough samples
    # before p moves. Kept small so a nano CPU run still triggers an update.
    ada_interval: int = 4
    # ada_kimg: images (in thousands) over which p ramps the full [0,1] range —
    # the schedule's time-constant (train_loop.py `--target`/`ada_kimg`, paper
    # default 500). Smaller => p adapts faster. Tiny here so a mini run visibly
    # moves p; the real value is a training-length decision, not an accuracy one.
    ada_kimg: int = 100
    # ada_p_init: starting augmentation probability (paper starts at 0.0 and
    # lets the controller raise it — MN_ default matches).
    ada_p_init: float = 0.0
    # Augmentation subset toggles (a minimal slice of the paper's pipeline):
    # x-flip + integer translation are always-on primitives; rotation (90° k)
    # and brightness are extra shape-preserving transforms. All applied to reals
    # AND fakes (non-leaking) at probability p.
    ada_xflip: bool = True
    ada_translate: bool = True
    ada_rotate90: bool = True
    ada_brightness: bool = True
    # ada_translate_max: max integer pixel shift for the translation transform.
    ada_translate_max: int = 4


def ada_update_p(
    p: float,
    r_t: float,
    target: float,
    batch_size: int,
    interval: int,
    ada_kimg: int,
) -> float:
    """The ADA heuristic controller: nudge p toward keeping r_t at `target`.

    r_t = E[sign(D(x_real))] is the overfitting signal (1 = D perfectly
    confident on reals = memorising; ≤0 = not overfitting). The step size is the
    paper's throughput-scaled increment: (batch*interval) / (ada_kimg*1000) —
    how far p can move given how many images passed since the last adjustment
    (train_loop.py: `adjust = sign(r_t - target) * (batch*interval)/(kimg*1000)`).
    Raise p when r_t > target (overfitting → augment harder); lower it when
    r_t < target; clamp to [0, 1]. r_t == target => zero step.
    """
    # sign(r_t - target): +1 overfitting, -1 not, 0 exactly at target.
    direction = float((r_t > target)) - float((r_t < target))
    step = (batch_size * interval) / (max(1, ada_kimg) * 1000.0)
    p_new = p + direction * step
    return float(min(1.0, max(0.0, p_new)))


class AdaptiveAugment:
    """The ADA augmentation pipeline — a minimal, non-leaking subset.

    Applied per-image with probability `p` to BOTH real and fake images. Every
    transform is shape-preserving and device-agnostic (it operates on the input
    tensor's own device). `p` is a mutable attribute so the controller can
    retune it during training. A `seed` makes the per-image coin flips
    reproducible for tests; leave it None in training for fresh randomness.
    """

    def __init__(
        self,
        p: float = 0.0,
        *,
        xflip: bool = True,
        translate: bool = True,
        rotate90: bool = True,
        brightness: bool = True,
        translate_max: int = 4,
        seed: int | None = None,
    ):
        self.p = p
        self.xflip = xflip
        self.translate = translate
        self.rotate90 = rotate90
        self.brightness = brightness
        self.translate_max = translate_max
        self._gen: torch.Generator | None = None
        if seed is not None:
            self._gen = torch.Generator().manual_seed(seed)

    def _rand(self, shape, device) -> torch.Tensor:
        # Draw on CPU with the (optional) seeded generator, then move to the
        # input's device — torch.Generator is device-bound, so keeping the
        # generator on CPU is what makes this device-agnostic AND seedable.
        return torch.rand(shape, generator=self._gen).to(device)

    def _randint(self, low, high, shape, device) -> torch.Tensor:
        return torch.randint(low, high, shape, generator=self._gen).to(device)

    def __call__(self, x: torch.Tensor) -> torch.Tensor:
        """x: [B, C, H, W] -> augmented [B, C, H, W] (same shape/dtype/device).

        A per-image Bernoulli(p) mask decides which images are augmented; the
        unaugmented ones pass through untouched (so p=0 is exact identity, which
        the tests pin). Each transform then applies to the whole batch and is
        blended back only where the mask fired — this keeps the empirical
        augmentation rate equal to p while letting the transforms be batched.
        """
        if self.p <= 0.0:
            return x
        B = x.size(0)
        dev = x.device
        fire = (self._rand((B,), dev) < self.p)  # [B] which images get augmented
        if not bool(fire.any()):
            return x.clone()

        out = x.clone()
        aug = x.clone()

        if self.xflip:
            do = fire & (self._rand((B,), dev) < 0.5)
            aug = torch.where(do.view(-1, 1, 1, 1), torch.flip(aug, dims=[3]), aug)

        if self.translate and self.translate_max > 0:
            # Integer pixel shift via roll (wrap-around) — the "integer
            # translation" primitive; a real, invertible, shape-preserving move.
            m = self.translate_max
            shifts = self._randint(-m, m + 1, (2,), dev)
            rolled = torch.roll(aug, shifts=(int(shifts[0]), int(shifts[1])), dims=(2, 3))
            do = fire & (self._rand((B,), dev) < 0.5)
            aug = torch.where(do.view(-1, 1, 1, 1), rolled, aug)

        if self.rotate90:
            k = int(self._randint(0, 4, (1,), dev)[0])  # 0..3 quarter turns
            if k:
                rotated = torch.rot90(aug, k=k, dims=(2, 3))
                do = fire & (self._rand((B,), dev) < 0.5)
                aug = torch.where(do.view(-1, 1, 1, 1), rotated, aug)

        if self.brightness:
            # Additive brightness in [-0.25, 0.25] on the [-1,1] Tanh range,
            # clamped back to the valid range.
            delta = (self._rand((B, 1, 1, 1), dev) - 0.5) * 0.5
            bright = torch.clamp(aug + delta, -1.0, 1.0)
            do = fire & (self._rand((B,), dev) < 0.5)
            aug = torch.where(do.view(-1, 1, 1, 1), bright, aug)

        # Blend augmented images back only where the per-image mask fired.
        out = torch.where(fire.view(-1, 1, 1, 1), aug, out)
        return out


class GANADA:
    """Adaptive-Discriminator-Augmentation GAN composition.

    The `gan` mini's DCGAN generator/discriminator, wrapped so that every image
    D sees — real or fake — first passes through `AdaptiveAugment` at the
    current probability p, and p is retuned each `ada_interval` steps by the
    E[sign(D_real)] controller. `self.augment.p` and `self.p_history` expose p
    for logging and tests.
    """

    def __init__(self):
        self.G: Generator | None = None
        self.D: Discriminator | None = None
        self.augment: AdaptiveAugment | None = None
        self.p_history: list[float] = []

    def train(self, config: GANADAConfig, logger: Logger) -> None:
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
        augment = AdaptiveAugment(
            p=config.ada_p_init,
            xflip=config.ada_xflip,
            translate=config.ada_translate,
            rotate90=config.ada_rotate90,
            brightness=config.ada_brightness,
            translate_max=config.ada_translate_max,
        )
        self.G, self.D, self.augment = G, D, augment

        opt_g = torch.optim.Adam(G.parameters(), lr=config.lr, betas=(0.5, 0.999))
        opt_d = torch.optim.Adam(D.parameters(), lr=config.lr, betas=(0.5, 0.999))
        g_ema = EMA(G, decay=0.999)
        bce = torch.nn.BCELoss()
        logger.log_config(config.model_dump())

        step = 0
        sign_accum = 0.0        # running sum of sign(D_real) since last p update
        sign_count = 0          # number of batches accumulated
        for epoch in range(config.effective_epochs):
            G.train()
            D.train()
            total_g = total_d = 0.0
            n_batches = 0
            for batch in dl:
                if (config.max_train_batches is not None
                        and n_batches >= config.max_train_batches):
                    break
                images = (batch[0] if isinstance(batch, (list, tuple)) else batch)
                images = images.to(config.device) * 2.0 - 1.0  # -> Tanh [-1,1]
                B = images.size(0)

                # --- Discriminator step (augment reals AND fakes: non-leaking) ---
                z = torch.randn(B, config.latent_dim, device=config.device)
                fake = G(z)
                real_aug = augment(images)
                fake_aug = augment(fake)
                d_loss = gan_d_loss(D, real_aug, fake_aug, bce)
                opt_d.zero_grad()
                d_loss.backward()
                opt_d.step()
                total_d += d_loss.item()

                # Overfitting signal: mean sign of D's RAW output on reals.
                # D(x) is a probability in (0,1) after Sigmoid; center at 0.5 so
                # sign() reads "D thinks this is real (>0.5)" as +1 — the
                # discrete analogue of the paper's raw-logit sign on reals.
                with torch.no_grad():
                    d_real = D(augment(images))
                    sign_accum += torch.sign(d_real - 0.5).mean().item()
                    sign_count += 1

                # --- Generator step (augment the fake D scores it) ---
                z = torch.randn(B, config.latent_dim, device=config.device)
                fake = G(z)
                g_loss = gan_g_loss(D, augment(fake), bce)
                opt_g.zero_grad()
                g_loss.backward()
                opt_g.step()
                g_ema.update(G)
                total_g += g_loss.item()

                step += 1
                n_batches += 1

                # --- ADA controller: retune p every ada_interval steps ---
                if step % max(1, config.ada_interval) == 0 and sign_count:
                    r_t = sign_accum / sign_count
                    augment.p = ada_update_p(
                        p=augment.p,
                        r_t=r_t,
                        target=config.ada_target,
                        batch_size=config.effective_batch_size,
                        interval=config.ada_interval,
                        ada_kimg=config.ada_kimg,
                    )
                    self.p_history.append(augment.p)
                    sign_accum = 0.0
                    sign_count = 0

            # Guarantee at least one p update per epoch even when the tier caps
            # the loop below ada_interval steps (nano S-tier runs one batch) —
            # so p tracking is never empty and the controller is always exercised.
            if sign_count:
                r_t = sign_accum / sign_count
                augment.p = ada_update_p(
                    p=augment.p,
                    r_t=r_t,
                    target=config.ada_target,
                    batch_size=config.effective_batch_size,
                    interval=config.ada_interval,
                    ada_kimg=config.ada_kimg,
                )
                self.p_history.append(augment.p)
                sign_accum = 0.0
                sign_count = 0

            n = max(1, n_batches)
            logger.log_metrics(epoch, {
                "g_loss": total_g / n,
                "d_loss": total_d / n,
                "ada_p": augment.p,
            })
            log.info(
                f"  epoch {epoch}  g_loss {total_g / n:.4f}  "
                f"d_loss {total_d / n:.4f}  ada_p {augment.p:.4f}"
            )

        # Persist the EMA generator (smoothed weights are what sampling sees).
        g_state = g_ema.state_dict()
        torch.save(g_state, logger.artifact_path("generator.pt"))
        torch.save(D.state_dict(), logger.artifact_path("discriminator.pt"))
        G.load_state_dict(g_state)

    @torch.no_grad()
    def sample(self, config: GANADAConfig, n: int = 4) -> torch.Tensor:
        """Generate n samples in [0, 1]. Augmentation is train-only — samples
        are the raw generator output, never augmented."""
        if self.G is None:
            raise RuntimeError("Train the model first.")
        self.G.eval()
        z = torch.randn(n, config.latent_dim, device=config.device)
        return (self.G(z) + 1.0) / 2.0
