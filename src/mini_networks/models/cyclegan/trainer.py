"""CycleGAN trainer: the 6-term generator loss + PatchGAN D + image-history pool.

One training step (junyanz cycle_gan_model.py:114-180):
  1. forward the 4-way cycle: fake_B=G(a), rec_A=F(fake_B), fake_A=F(b), rec_B=G(fake_A)
  2. update BOTH generators from a single combined loss:
        adversarial   (G fools D_B, F fools D_A)
      + cycle L1 ×λ    (‖rec_A - a‖ + ‖rec_B - b‖)
      + identity L1 ×λ·0.5 (‖G(b) - b‖ + ‖F(a) - a‖)
  3. update each discriminator against a real image + a POOLED past fake.

The image pool (util/image_pool.py) keeps a buffer of previously generated fakes
and, with p=0.5, feeds D an OLD fake instead of the current one — so D trains
against the generator's history, not just its latest batch. Cheap, and it visibly
steadies the adversarial game.
"""
from __future__ import annotations

import random
from pathlib import Path
from typing import Any

import torch
import torch.nn.functional as F
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset

from mini_networks.core.config import BaseConfig
from mini_networks.core.data.registry import get_dataset
from mini_networks.core.logging.logger import Logger
from mini_networks.core.runtime import BaseTrainer
from mini_networks.models.cyclegan.config import CycleGANConfig
from mini_networks.models.cyclegan.model import (
    PatchDiscriminator,
    ResnetGenerator,
    lsgan_d_loss,
    lsgan_g_loss,
)


class ImagePool:
    """History buffer of past fakes (junyanz util/image_pool.py:23-54).

    query(images): for each image, with p=0.5 return a random PAST fake (and
    store the current one in its place), else return the current image. Stabilizes
    D by not letting it chase only the newest generator output.
    """

    def __init__(self, pool_size: int = 50):
        self.pool_size = pool_size
        self.images: list[torch.Tensor] = []

    def query(self, images: torch.Tensor) -> torch.Tensor:
        if self.pool_size == 0:
            return images
        out = []
        for img in images:
            img = img.unsqueeze(0)
            if len(self.images) < self.pool_size:
                self.images.append(img)
                out.append(img)
            elif random.random() > 0.5:
                idx = random.randint(0, self.pool_size - 1)
                tmp = self.images[idx].clone()
                self.images[idx] = img
                out.append(tmp)
            else:
                out.append(img)
        return torch.cat(out, dim=0)


class _UnpairedDataset(Dataset):
    """Yield (a, b): image a from domain A, image b from domain B, no alignment.

    Length is min(len(A), len(B)); b is drawn at a shuffled offset so the pairing
    is arbitrary — the whole point of *unpaired* translation.
    """

    def __init__(self, ds_a: Dataset, ds_b: Dataset):
        self.ds_a = ds_a
        self.ds_b = ds_b
        self.n = min(len(ds_a), len(ds_b))

    def __len__(self) -> int:
        return self.n

    def __getitem__(self, idx: int):
        a = self.ds_a[idx]
        b = self.ds_b[(idx * 7 + 3) % len(self.ds_b)]  # arbitrary unpaired offset
        a_img = a[0] if isinstance(a, (list, tuple)) else a
        b_img = b[0] if isinstance(b, (list, tuple)) else b
        return a_img, b_img


class CycleGANTrainer(BaseTrainer):
    def __init__(self):
        self.G: ResnetGenerator | None = None  # A -> B
        self.F: ResnetGenerator | None = None  # B -> A
        self.D_A: PatchDiscriminator | None = None
        self.D_B: PatchDiscriminator | None = None

    def _build(self, config: CycleGANConfig):
        G = ResnetGenerator(config.in_channels, config.ngf, config.n_resnet_blocks).to(config.device)
        Fnet = ResnetGenerator(config.in_channels, config.ngf, config.n_resnet_blocks).to(config.device)
        D_A = PatchDiscriminator(config.in_channels, config.ndf).to(config.device)
        D_B = PatchDiscriminator(config.in_channels, config.ndf).to(config.device)
        return G, Fnet, D_A, D_B

    def train(self, config: BaseConfig, dataloader: DataLoader, logger: Logger) -> None:
        assert isinstance(config, CycleGANConfig)
        G, Fnet, D_A, D_B = self._build(config)
        self.G, self.F, self.D_A, self.D_B = G, Fnet, D_A, D_B

        opt_g = optim.Adam(list(G.parameters()) + list(Fnet.parameters()), lr=config.lr, betas=(0.5, 0.999))
        opt_d = optim.Adam(list(D_A.parameters()) + list(D_B.parameters()), lr=config.lr, betas=(0.5, 0.999))
        pool_a, pool_b = ImagePool(config.image_pool_size), ImagePool(config.image_pool_size)
        lam = config.lambda_cycle
        lam_id = config.lambda_cycle * config.lambda_identity
        logger.log_config(config.model_dump())

        for epoch in range(config.effective_epochs):
            G.train(); Fnet.train(); D_A.train(); D_B.train()
            tot_g, tot_d, tot_cyc = 0.0, 0.0, 0.0
            n = 0
            for batch_idx, (a, b) in enumerate(dataloader):
                if config.max_train_batches is not None and batch_idx >= config.max_train_batches:
                    break
                a = a.to(config.device) * 2.0 - 1.0  # -> [-1, 1] to match Tanh
                b = b.to(config.device) * 2.0 - 1.0

                # --- 4-way cycle forward ---
                fake_b = G(a)          # A -> B
                rec_a = Fnet(fake_b)   # B -> A (should recover a)
                fake_a = Fnet(b)       # B -> A
                rec_b = G(fake_a)      # A -> B (should recover b)

                # --- Generators: adversarial + cycle + identity (one combined step) ---
                opt_g.zero_grad()
                loss_adv = lsgan_g_loss(D_B, fake_b) + lsgan_g_loss(D_A, fake_a)
                loss_cyc = F.l1_loss(rec_a, a) + F.l1_loss(rec_b, b)
                loss_id = F.l1_loss(G(b), b) + F.l1_loss(Fnet(a), a)
                loss_g = loss_adv + lam * loss_cyc + lam_id * loss_id
                loss_g.backward()
                opt_g.step()

                # --- Discriminators against real + a POOLED past fake ---
                opt_d.zero_grad()
                loss_d = (
                    lsgan_d_loss(D_A, a, pool_a.query(fake_a.detach()))
                    + lsgan_d_loss(D_B, b, pool_b.query(fake_b.detach()))
                )
                loss_d.backward()
                opt_d.step()

                tot_g += loss_g.item(); tot_d += loss_d.item(); tot_cyc += loss_cyc.item()
                n += 1

            n = max(1, n)
            logger.log_metrics(epoch, {
                "g_loss": tot_g / n, "d_loss": tot_d / n, "cycle_loss": tot_cyc / n, "epoch": epoch,
            })

        torch.save(G.state_dict(), logger.artifact_path("gen_ab.pt"))
        torch.save(Fnet.state_dict(), logger.artifact_path("gen_ba.pt"))
        torch.save(D_A.state_dict(), logger.artifact_path("disc_a.pt"))
        torch.save(D_B.state_dict(), logger.artifact_path("disc_b.pt"))

    def evaluate(self, config: BaseConfig, dataloader: DataLoader, logger: Logger) -> dict:
        """Cycle-consistency error ‖F(G(a)) - a‖ + ‖G(F(b)) - b‖ (lower = better)."""
        assert isinstance(config, CycleGANConfig)
        if self.G is None:
            self.G, self.F, self.D_A, self.D_B = self._build(config)
        self.G.eval(); self.F.eval()
        total, n = 0.0, 0
        with torch.no_grad():
            for batch_idx, (a, b) in enumerate(dataloader):
                if config.max_eval_batches is not None and batch_idx >= config.max_eval_batches:
                    break
                a = a.to(config.device) * 2.0 - 1.0
                b = b.to(config.device) * 2.0 - 1.0
                rec_a = self.F(self.G(a))
                rec_b = self.G(self.F(b))
                total += (F.l1_loss(rec_a, a) + F.l1_loss(rec_b, b)).item()
                n += 1
        return {"eval_loss": total / max(1, n), "cycle_error": total / max(1, n)}

    def infer(self, config: BaseConfig, inputs: Any) -> Any:
        """Translate. inputs: {"images": tensor, "direction": "ab"|"ba"}."""
        assert isinstance(config, CycleGANConfig)
        if self.G is None:
            raise RuntimeError("Model not loaded. Call train() first.")
        self.G.eval(); self.F.eval()
        images = inputs["images"] if isinstance(inputs, dict) else inputs
        direction = inputs.get("direction", "ab") if isinstance(inputs, dict) else "ab"
        images = images.to(config.device) * 2.0 - 1.0
        net = self.G if direction == "ab" else self.F
        with torch.no_grad():
            out = net(images).cpu()
        return {"translated": (out + 1) / 2}

    def load_checkpoint(self, config: BaseConfig, artifacts_dir) -> None:
        assert isinstance(config, CycleGANConfig)
        path = Path(artifacts_dir)
        G, Fnet, D_A, D_B = self._build(config)
        G.load_state_dict(torch.load(path / "gen_ab.pt", map_location=config.device, weights_only=True))
        Fnet.load_state_dict(torch.load(path / "gen_ba.pt", map_location=config.device, weights_only=True))
        D_A.load_state_dict(torch.load(path / "disc_a.pt", map_location=config.device, weights_only=True))
        D_B.load_state_dict(torch.load(path / "disc_b.pt", map_location=config.device, weights_only=True))
        for m in (G, Fnet, D_A, D_B):
            m.eval()
        self.G, self.F, self.D_A, self.D_B = G, Fnet, D_A, D_B


def make_cyclegan_dataloader(config: CycleGANConfig, split: str = "train") -> DataLoader:
    ds_a = get_dataset(config.dataset_a, config.data_root, split=split,
                       task="classification", fast_demo=config.effective_fast_demo)
    ds_b = get_dataset(config.dataset_b, config.data_root, split=split,
                       task="classification", fast_demo=config.effective_fast_demo)
    ds = _UnpairedDataset(ds_a, ds_b)
    return DataLoader(ds, batch_size=config.effective_batch_size,
                      shuffle=split == "train", num_workers=0, drop_last=False)
