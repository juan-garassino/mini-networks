"""VQ-VAE trainer: reconstruction + codebook/commitment loss, tracks perplexity."""
from __future__ import annotations

from typing import Any

import torch
from torch.utils.data import DataLoader

from mini_networks.core.config import BaseConfig
from mini_networks.core.data.registry import get_dataloader
from mini_networks.core.logging.logger import Logger
from mini_networks.core.runtime import BaseTrainer
from mini_networks.models.vqvae.config import VQVAEConfig
from mini_networks.models.vqvae.model import VQVAE, vqvae_loss


class VQVAETrainer(BaseTrainer):
    def __init__(self):
        self.model: VQVAE | None = None

    def _build(self, config: VQVAEConfig) -> VQVAE:
        return VQVAE(
            num_embeddings=config.num_embeddings,
            embedding_dim=config.embedding_dim,
            commitment_cost=config.commitment_cost,
        ).to(config.device)

    def train(self, config: BaseConfig, dataloader: DataLoader, logger: Logger) -> None:
        assert isinstance(config, VQVAEConfig)
        model = self._build(config)
        self.model = model
        optimizer = torch.optim.Adam(model.parameters(), lr=config.learning_rate)
        logger.log_config(config.model_dump())

        for epoch in range(config.effective_epochs):
            model.train()
            total = 0.0
            recon_total = 0.0
            perp_total = 0.0
            for images, _ in dataloader:
                images = images.to(config.device)
                recon, vq_loss, _, perplexity = model(images)
                loss, recon_loss = vqvae_loss(recon, images, vq_loss)
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
                total += loss.item()
                recon_total += recon_loss.item()
                perp_total += perplexity.item()
            n = max(1, len(dataloader))
            logger.log_metrics(epoch, {
                "loss": total / n,
                "recon": recon_total / n,
                "perplexity": perp_total / n,
                "epoch": epoch,
            })

        torch.save(model.state_dict(), logger.artifact_path("model.pt"))

    def evaluate(self, config: BaseConfig, dataloader: DataLoader, logger: Logger) -> dict:
        assert isinstance(config, VQVAEConfig)
        if self.model is None:
            self.model = self._build(config)
        model = self.model
        model.eval()
        total = 0.0
        perp_total = 0.0
        n = 0
        with torch.no_grad():
            for images, _ in dataloader:
                images = images.to(config.device)
                recon, vq_loss, _, perplexity = model(images)
                loss, _ = vqvae_loss(recon, images, vq_loss)
                total += loss.item()
                perp_total += perplexity.item()
                n += 1
        return {"eval_loss": total / max(1, n), "perplexity": perp_total / max(1, n)}

    def infer(self, config: BaseConfig, inputs: Any) -> Any:
        assert isinstance(config, VQVAEConfig)
        if self.model is None:
            raise RuntimeError("Model not loaded.")
        model = self.model
        model.eval()
        with torch.no_grad():
            if isinstance(inputs, dict) and "sample" in inputs:
                # No learned prior over codes in this mini — "sampling" means
                # decoding a grid of RANDOM codebook indices (7x7 latent grid).
                n = int(inputs.get("sample", 1))
                idx = torch.randint(0, config.num_embeddings, (n, 7, 7), device=config.device)
                z_q = model.quantizer.codebook(idx).permute(0, 3, 1, 2).contiguous()
                samples = model.decode(z_q).cpu()
                return {"samples": samples}
            images = inputs if not isinstance(inputs, dict) else inputs.get("images")
            images = images.to(config.device)
            recon, _, indices, _ = model(images)
            return {"recon": recon.cpu(), "codes": indices.cpu()}


def make_vqvae_dataloader(config: VQVAEConfig, split: str = "train") -> DataLoader:
    return get_dataloader(
        name=config.dataset,
        data_root=config.data_root,
        split=split,
        task="classification",
        batch_size=config.effective_batch_size,
        fast_demo=config.effective_fast_demo,
        sample_limit=config.dataset_sample_limit,
    )
