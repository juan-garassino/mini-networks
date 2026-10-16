"""WGAN trainer: n_critic clipped-critic steps per generator step, RMSProp.

This is the `gan` trainer with the three WGAN deltas made concrete:
  1. after each critic step, clamp every critic weight to [-clip, clip];
  2. run `n_critic` critic steps (more during warm-up) per generator step;
  3. RMSProp by default (Adam only behind config.use_adam).
The Wasserstein critic loss uses raw means (no BCE) and the critic emits a
score, not a probability.
"""
from __future__ import annotations

import logging
from typing import Any

import torch
import torch.optim as optim
from torch.utils.data import DataLoader

from mini_networks.core.blocks.ema import EMA
from mini_networks.core.config import BaseConfig
from mini_networks.core.data.registry import get_dataloader
from mini_networks.core.logging.logger import Logger
from mini_networks.core.runtime import BaseTrainer
from mini_networks.models.wgan.config import WGANConfig
from mini_networks.models.wgan.model import Critic, Generator, wgan_critic_loss, wgan_gen_loss

log = logging.getLogger(__name__)


class WGANTrainer(BaseTrainer):
    def __init__(self):
        self.generator: Generator | None = None
        self.critic: Critic | None = None

    def _build(self, config: WGANConfig) -> tuple[Generator, Critic]:
        G = Generator(
            latent_dim=config.latent_dim,
            image_size=config.image_size,
            in_channels=config.in_channels,
        ).to(config.device)
        C = Critic(
            image_size=config.image_size,
            in_channels=config.in_channels,
        ).to(config.device)
        return G, C

    def _n_critic(self, config: WGANConfig, gen_iterations: int) -> int:
        """Critic steps for this generator step (WassersteinGAN main.py:174-181):
        train the critic harder early so the Wasserstein estimate is accurate
        before G starts using it."""
        if gen_iterations < config.warmup_gen_iters:
            return config.n_critic_warmup
        return config.n_critic

    def train(self, config: BaseConfig, dataloader: DataLoader, logger: Logger) -> None:
        assert isinstance(config, WGANConfig)
        G, C = self._build(config)
        self.generator = G
        self.critic = C

        if config.use_adam:
            opt_g = optim.Adam(G.parameters(), lr=config.lr, betas=(0.5, 0.999))
            opt_c = optim.Adam(C.parameters(), lr=config.lr, betas=(0.5, 0.999))
        else:
            # RMSProp, not Adam: momentum destabilizes the clipped critic.
            opt_g = optim.RMSprop(G.parameters(), lr=config.lr)
            opt_c = optim.RMSprop(C.parameters(), lr=config.lr)
        g_ema = EMA(G, decay=0.999)
        logger.log_config(config.model_dump())

        gen_iterations = 0
        for epoch in range(config.effective_epochs):
            G.train(); C.train()
            total_c, total_g = 0.0, 0.0
            data_iter = iter(dataloader)
            batch_idx = 0
            n_batches = len(dataloader)

            while batch_idx < n_batches:
                # --- Critic steps: n_critic (or the warm-up count) per G step ---
                n_c = self._n_critic(config, gen_iterations)
                c_loss_val = 0.0
                j = 0
                while j < n_c and batch_idx < n_batches:
                    if config.max_train_batches is not None and batch_idx >= config.max_train_batches:
                        break
                    try:
                        batch = next(data_iter)
                    except StopIteration:
                        break
                    batch_idx += 1
                    j += 1
                    # Scale reals to [-1,1] to match the generator's Tanh output
                    # (same value-range fix as the `gan` mini).
                    real = (batch[0] if isinstance(batch, (list, tuple)) else batch).to(config.device) * 2.0 - 1.0
                    B = real.size(0)
                    z = torch.randn(B, config.latent_dim, device=config.device)
                    fake = G(z)

                    opt_c.zero_grad()
                    c_loss = wgan_critic_loss(C, real, fake)
                    c_loss.backward()
                    opt_c.step()
                    # Weight clipping: enforce the 1-Lipschitz constraint the
                    # Wasserstein dual needs (WassersteinGAN main.py:184-186).
                    with torch.no_grad():
                        for p in C.parameters():
                            p.clamp_(-config.clip_value, config.clip_value)
                    c_loss_val = c_loss.item()

                if config.max_train_batches is not None and batch_idx >= config.max_train_batches:
                    total_c += c_loss_val
                    break

                # --- Generator step ---
                z = torch.randn(config.effective_batch_size, config.latent_dim, device=config.device)
                fake = G(z)
                opt_g.zero_grad()
                g_loss = wgan_gen_loss(C, fake)
                g_loss.backward()
                opt_g.step()
                g_ema.update(G)
                gen_iterations += 1

                total_c += c_loss_val
                total_g += g_loss.item()

            n = max(1, gen_iterations if gen_iterations else 1)
            avg_c = total_c / max(1, n)
            avg_g = total_g / max(1, n)
            logger.log_metrics(epoch, {"c_loss": avg_c, "g_loss": avg_g, "epoch": epoch})
            log.info(f"  epoch {epoch}  c_loss {avg_c:.4f}  g_loss {avg_g:.4f}")

        # Persist the EMA generator (smoothed weights are what eval/infer sees).
        g_state = g_ema.state_dict()
        torch.save(g_state, logger.artifact_path("generator.pt"))
        torch.save(C.state_dict(), logger.artifact_path("critic.pt"))
        G.load_state_dict(g_state)

    def evaluate(self, config: BaseConfig, dataloader: DataLoader, logger: Logger) -> dict:
        """Returns the Wasserstein estimate E[f(real)] - E[f(fake)] (should grow then stabilize)."""
        assert isinstance(config, WGANConfig)
        if self.critic is None or self.generator is None:
            self.generator, self.critic = self._build(config)
        G, C = self.generator, self.critic
        G.eval(); C.eval()
        total = 0.0
        n = 0
        with torch.no_grad():
            for batch_idx, batch in enumerate(dataloader):
                if config.max_eval_batches is not None and batch_idx >= config.max_eval_batches:
                    break
                real = (batch[0] if isinstance(batch, (list, tuple)) else batch).to(config.device) * 2.0 - 1.0
                z = torch.randn(real.size(0), config.latent_dim, device=config.device)
                fake = G(z)
                total += (C(real).mean() - C(fake).mean()).item()
                n += 1
        return {"wasserstein_estimate": total / max(1, n)}

    def infer(self, config: BaseConfig, inputs: Any) -> Any:
        """Generate samples. inputs: {"n_samples": 8, "seed": 42}."""
        assert isinstance(config, WGANConfig)
        if self.generator is None:
            raise RuntimeError("Generator not loaded. Call train() first.")
        G = self.generator
        G.eval()
        n_samples = inputs.get("n_samples", 8) if isinstance(inputs, dict) else 8
        seed = inputs.get("seed") if isinstance(inputs, dict) else None
        if seed is not None:
            torch.manual_seed(seed)
        with torch.no_grad():
            z = torch.randn(n_samples, config.latent_dim, device=config.device)
            samples = G(z).cpu()
        # Scale from [-1, 1] (Tanh) to [0, 1]
        samples = (samples + 1) / 2
        return {"samples": samples}

    def load_checkpoint(self, config: BaseConfig, artifacts_dir) -> None:
        """Load generator.pt + critic.pt from artifacts_dir."""
        from pathlib import Path
        assert isinstance(config, WGANConfig)
        path = Path(artifacts_dir)
        G, C = self._build(config)
        G.load_state_dict(torch.load(path / "generator.pt", map_location=config.device, weights_only=True))
        C.load_state_dict(torch.load(path / "critic.pt", map_location=config.device, weights_only=True))
        G.eval()
        C.eval()
        self.generator = G
        self.critic = C


def make_wgan_dataloader(config: WGANConfig, split: str = "train") -> DataLoader:
    return get_dataloader(
        name=config.dataset,
        data_root=config.data_root,
        split=split,
        task="classification",
        fast_demo=config.effective_fast_demo,
        sample_limit=config.dataset_sample_limit,
        batch_size=config.effective_batch_size,
    )
