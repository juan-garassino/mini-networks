"""Grokking trainer: step-based loop with strong weight decay."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader

from mini_networks.core.config import BaseConfig
from mini_networks.core.data.registry import get_dataloader
from mini_networks.core.logging.logger import Logger
from mini_networks.core.runtime import BaseTrainer
from mini_networks.models.grokking.config import GrokkingConfig
from mini_networks.models.grokking.model import GrokkingTransformer

import logging

log = logging.getLogger(__name__)


class GrokkingTrainer(BaseTrainer):
    """Step-based AdamW training (wd = config.weight_decay, betas 0.9/0.98) on a / b mod p.

    Every `log_every` steps logs loss, train_accuracy (current batch) and
    val_accuracy (full held-out pass) — together they draw the grokking
    curve. Budget: n_train_steps, capped at S 50 / M 20k steps.
    Checkpoint: `model.pt`. evaluate() -> {"accuracy", "val_accuracy"}
    (the same held-out number under both keys).
    """

    def __init__(self):
        self.model: GrokkingTransformer | None = None

    def _build(self, config: GrokkingConfig) -> GrokkingTransformer:
        return GrokkingTransformer(
            p=config.p,
            d_model=config.d_model,
            n_heads=config.n_heads,
            n_layers=config.n_layers,
            dropout=config.dropout,
        ).to(config.device)

    @torch.no_grad()
    def _accuracy(self, model: GrokkingTransformer, dl: DataLoader, device) -> float:
        # Leaves the model in train mode afterwards — it is called mid-training.
        model.eval()
        correct = total = 0
        for x, y in dl:
            pred = model(x.to(device)).argmax(dim=-1)
            correct += (pred == y.to(device)).sum().item()
            total += y.numel()
        model.train()
        return correct / max(1, total)

    def train(self, config: BaseConfig, dataloader: DataLoader, logger: Logger) -> None:
        """Cycle the train loader until the step budget is spent; save `model.pt`."""
        assert isinstance(config, GrokkingConfig)
        model = self._build(config)
        self.model = model
        # weight_decay ~ 1 is the ingredient that makes the val-accuracy jump
        # happen within a reachable step budget (paper section 3.2)
        optimizer = torch.optim.AdamW(
            model.parameters(), lr=config.learning_rate,
            weight_decay=config.weight_decay, betas=(0.9, 0.98),
        )
        val_dl = make_grokking_dataloader(config, split="val")
        n_steps = config.limit_steps(config.n_train_steps, s_cap=50, m_cap=20_000)
        logger.log_config(config.model_dump())

        step = 0
        model.train()
        while step < n_steps:
            for x, y in dataloader:
                if step >= n_steps:
                    break
                x, y = x.to(config.device), y.to(config.device)
                logits = model(x)
                loss = F.cross_entropy(logits, y)
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
                if step % config.log_every == 0 or step == n_steps - 1:
                    train_acc = (logits.argmax(dim=-1) == y).float().mean().item()
                    val_acc = self._accuracy(model, val_dl, config.device)
                    logger.log_metrics(step, {
                        "loss": loss.item(),
                        "train_accuracy": train_acc,
                        "val_accuracy": val_acc,
                    })
                    if step % (config.log_every * 20) == 0:
                        log.info(f"  step {step}  loss {loss.item():.4f}  "
                                 f"train {train_acc:.3f}  val {val_acc:.3f}")
                step += 1

        torch.save(model.state_dict(), logger.artifact_path("model.pt"))

    def evaluate(self, config: BaseConfig, dataloader: DataLoader, logger: Logger) -> dict:
        """Accuracy on the held-out ("val") pairs; the passed dataloader is not used."""
        assert isinstance(config, GrokkingConfig)
        if self.model is None:
            self.model = self._build(config)
        val_dl = make_grokking_dataloader(config, split="val")
        acc = self._accuracy(self.model, val_dl, config.device)
        return {"accuracy": acc, "val_accuracy": acc}

    def infer(self, config: BaseConfig, inputs: Any) -> Any:
        """Predict a / b (mod p) for one pair.

        inputs: {"a": int, "b": int} (defaults 12, 5; reduced mod p, b = 0
        becomes 1). Returns {"a", "b", "prediction", "expected"} where
        expected is the exact answer a * b^(p-2) mod p.
        """
        assert isinstance(config, GrokkingConfig)
        if self.model is None:
            raise RuntimeError("Model not loaded.")
        a = int(inputs.get("a", 12)) % config.p
        b = int(inputs.get("b", 5)) % config.p
        b = b or 1  # division needs b != 0
        tokens = torch.tensor(
            [[a, config.p, b, config.p + 1]], dtype=torch.long, device=config.device
        )
        self.model.eval()
        with torch.no_grad():
            pred = int(self.model(tokens).argmax(dim=-1).item())
        expected = (a * pow(b, config.p - 2, config.p)) % config.p
        return {"a": a, "b": b, "prediction": pred, "expected": expected}

    def load_checkpoint(self, config: BaseConfig, artifacts_dir) -> None:
        """Load `model.pt` into a freshly built GrokkingTransformer."""
        assert isinstance(config, GrokkingConfig)
        state = torch.load(
            Path(artifacts_dir) / "model.pt", map_location=config.device, weights_only=True
        )
        self.model = self._build(config)
        self.model.load_state_dict(state)
        self.model.eval()


def make_grokking_dataloader(config: GrokkingConfig, split: str = "train") -> DataLoader:
    """Modular division pairs: (tokens [B, 4] = [a, op, b, =], answers [B] in 0..p-1).

    All p*(p-1) pairs (b != 0) are shuffled with a fixed seed and split
    train_frac / rest, so "val" pairs never appear in training.
    """
    return get_dataloader(
        name=config.dataset,
        data_root=config.data_root,
        split=split,
        batch_size=config.effective_batch_size,
        fast_demo=config.effective_fast_demo,
        sample_limit=config.dataset_sample_limit,
        p=config.p,
        train_frac=config.train_frac,
    )
