"""Diffusion distillation: compress a UNet noise-predictor into a tiny CNN.

Knowledge distillation (Hinton et al., 2015) applied to a DDPM denoiser:

    1. teacher: the zoo's diffusion UNet trained with the usual objective
       MSE(eps_teacher(x_t, t), eps) on MNIST in [-1,1]
    2. student: SmallDenoiser (three 3x3 convs, ~16 channels) trained to
       regress the frozen teacher's output: MSE(eps_student(x_t), eps_teacher(x_t, t))

The student learns from the teacher's *predictions* instead of the true
noise, a smoother target that carries the teacher's averaging over
possible clean images. Comparing ``teacher_loss`` and ``student_loss``
shows how much of the denoising function a ~2.6k-parameter net can mimic.

Deliberately simplified vs progressive distillation (Salimans & Ho, 2022)
or consistency models: this distils the per-step eps function only — the
student still needs the full chain of steps to sample, so it is faster per
step, not fewer steps. The student also IGNORES t (no time embedding), so it
must infer the noise level from x_t itself, and no sampler is provided.
"""
from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F

from mini_networks.core.config import BaseConfig
from mini_networks.core.data.registry import get_dataloader
from mini_networks.core.logging.logger import Logger
from mini_networks.models.diffusion.model import UNet
from mini_networks.models.diffusion.scheduler import NoiseScheduler


class DiffusionDistillationConfig(BaseConfig):
    """Knobs: ``base_channels`` (teacher UNet width) vs ``student_channels``
    (student width) set the compression ratio; ``timesteps``/``beta_*`` the
    linear DDPM schedule (tier-capped via ``effective_timesteps``)."""

    model_name: str = "diffusion_distillation"
    timesteps: int = 200
    beta_start: float = 1e-4
    beta_end: float = 0.02
    base_channels: int = 32
    student_channels: int = 16
    dataset: str = "mnist"


class SmallDenoiser(nn.Module):
    """Three-conv student denoiser: [B,C,28,28] -> [B,C,28,28] eps estimate."""

    def __init__(self, in_channels: int = 1, hidden: int = 16):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(in_channels, hidden, 3, padding=1),
            nn.ReLU(),
            nn.Conv2d(hidden, hidden, 3, padding=1),
            nn.ReLU(),
            nn.Conv2d(hidden, in_channels, 3, padding=1),
        )

    def forward(self, x: torch.Tensor, t: torch.Tensor) -> torch.Tensor:
        """x_t [B,C,H,W] -> predicted noise [B,C,H,W].

        ``t`` is accepted for API parity with the UNet but unused: the student
        has no time conditioning.
        """
        return self.net(x)


class DiffusionDistillation:
    """Teacher-then-student training of two eps-predictors on one schedule."""

    def __init__(self):
        self.teacher: UNet | None = None
        self.student: SmallDenoiser | None = None
        self.scheduler: NoiseScheduler | None = None

    def train(self, config: DiffusionDistillationConfig, logger: Logger) -> None:
        """Train the teacher, then distil the student from the frozen teacher.

        Both phases run ``effective_epochs`` over the same data and schedule.
        Logs ``teacher_loss`` then ``student_loss`` per epoch; saves
        ``teacher.pt`` and ``student.pt``.
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
        scheduler = NoiseScheduler(
            timesteps=config.effective_timesteps,
            beta_start=config.beta_start,
            beta_end=config.beta_end,
        ).to(torch.device(config.device))
        self.scheduler = scheduler

        teacher = UNet(in_channels=1, base_channels=config.base_channels).to(config.device)
        student = SmallDenoiser(in_channels=1, hidden=config.student_channels).to(config.device)
        self.teacher, self.student = teacher, student

        # Train teacher briefly
        opt_t = torch.optim.Adam(teacher.parameters(), lr=config.learning_rate)
        for epoch in range(config.effective_epochs):
            teacher.train()
            total = 0.0
            for images, _ in dl:
                images = images.to(config.device) * 2.0 - 1.0
                B = images.size(0)
                t = torch.randint(0, config.effective_timesteps, (B,), device=config.device)
                noise = torch.randn_like(images)
                xt = scheduler.add_noise(images, noise, t)
                pred = teacher(xt, t)
                loss = F.mse_loss(pred, noise)
                opt_t.zero_grad()
                loss.backward()
                opt_t.step()
                total += loss.item()
            logger.log_metrics(epoch, {"teacher_loss": total / max(1, len(dl))})

        # Distill student to match teacher
        opt_s = torch.optim.Adam(student.parameters(), lr=config.learning_rate)
        for epoch in range(config.effective_epochs):
            student.train()
            total = 0.0
            for images, _ in dl:
                images = images.to(config.device) * 2.0 - 1.0
                B = images.size(0)
                t = torch.randint(0, config.effective_timesteps, (B,), device=config.device)
                noise = torch.randn_like(images)
                xt = scheduler.add_noise(images, noise, t)
                with torch.no_grad():
                    target = teacher(xt, t)
                pred = student(xt, t)
                loss = F.mse_loss(pred, target)
                opt_s.zero_grad()
                loss.backward()
                opt_s.step()
                total += loss.item()
            logger.log_metrics(epoch, {"student_loss": total / max(1, len(dl))})

        torch.save(teacher.state_dict(), logger.artifact_path("teacher.pt"))
        torch.save(student.state_dict(), logger.artifact_path("student.pt"))
