"""ConvLSTM trainer: next-frame prediction on a self-generated Moving-MNIST toy.

Each clip is one MNIST digit placed on a `canvas_size` canvas and translated
linearly with wrap-around across `seq_len` frames. The model sees `input_frames`
context frames and predicts the rest; loss is MSE between predicted and true
future frames. Training uses Bernoulli SCHEDULED SAMPLING (conv-tt-lstm
convlstmnet.py:128-204): per rollout step, feed either the truth or the model's
own last prediction. Validation is always open-loop.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset

from mini_networks.core.config import BaseConfig
from mini_networks.core.data.registry import get_dataset
from mini_networks.core.logging.logger import Logger
from mini_networks.core.runtime import BaseTrainer
from mini_networks.models.convlstm.config import ConvLSTMConfig
from mini_networks.models.convlstm.model import ConvLSTMNet


class _MovingMNIST(Dataset):
    """Synthetic Moving-MNIST clips: one digit drifting across a canvas."""

    def __init__(self, base: Dataset, canvas: int, seq_len: int, n_clips: int, seed: int):
        self.base = base
        self.canvas = canvas
        self.seq_len = seq_len
        self.n_clips = min(n_clips, len(base))
        self.seed = seed

    def __len__(self) -> int:
        return self.n_clips

    def __getitem__(self, idx: int) -> torch.Tensor:
        g = torch.Generator().manual_seed(self.seed * 1_000_003 + idx)
        item = self.base[idx % len(self.base)]
        digit = (item[0] if isinstance(item, (list, tuple)) else item).squeeze(0)  # [28,28]
        d = digit.shape[-1]
        c = self.canvas
        # Random start position + constant velocity.
        pos = torch.tensor([int(torch.randint(0, c - d + 1, (1,), generator=g)),
                            int(torch.randint(0, c - d + 1, (1,), generator=g))], dtype=torch.float32)
        vel = torch.randn(2, generator=g)
        frames = torch.zeros(self.seq_len, 1, c, c)
        for t in range(self.seq_len):
            r = int(pos[0].item()) % (c - d + 1)
            col = int(pos[1].item()) % (c - d + 1)
            frames[t, 0, r:r + d, col:col + d] = digit
            pos = pos + vel * 2.0
        return frames  # [T, 1, c, c]


class ConvLSTMTrainer(BaseTrainer):
    def __init__(self):
        self.model: ConvLSTMNet | None = None

    def _build(self, config: ConvLSTMConfig) -> ConvLSTMNet:
        return ConvLSTMNet(
            in_channels=1,
            hidden_dim=config.hidden_dim,
            kernel_size=config.kernel_size,
            n_layers=config.n_layers,
        ).to(config.device)

    def train(self, config: BaseConfig, dataloader: DataLoader, logger: Logger) -> None:
        assert isinstance(config, ConvLSTMConfig)
        model = self._build(config)
        self.model = model
        optimizer = torch.optim.Adam(model.parameters(), lr=config.learning_rate)
        logger.log_config(config.model_dump())
        n_pred = config.seq_len - config.input_frames

        for epoch in range(config.effective_epochs):
            model.train()
            total, n = 0.0, 0
            for batch_idx, clips in enumerate(dataloader):
                if config.max_train_batches is not None and batch_idx >= config.max_train_batches:
                    break
                clips = clips.to(config.device)
                context = clips[:, :config.input_frames]
                future = clips[:, config.input_frames:]
                B = clips.size(0)
                # Bernoulli scheduled-sampling mask: 1 -> feed truth, 0 -> feed prediction.
                mask = (torch.rand(n_pred, B, device=config.device) < config.scheduled_sampling_prob).float()
                preds = model(context, n_pred, future_frames=future, sampling_mask=mask)
                loss = F.mse_loss(preds, future)
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
                total += loss.item(); n += 1
            logger.log_metrics(epoch, {"loss": total / max(1, n), "epoch": epoch})

        torch.save(model.state_dict(), logger.artifact_path("model.pt"))

    def evaluate(self, config: BaseConfig, dataloader: DataLoader, logger: Logger) -> dict:
        assert isinstance(config, ConvLSTMConfig)
        if self.model is None:
            self.model = self._build(config)
        model = self.model
        model.eval()
        n_pred = config.seq_len - config.input_frames
        total, n = 0.0, 0
        with torch.no_grad():
            for batch_idx, clips in enumerate(dataloader):
                if config.max_eval_batches is not None and batch_idx >= config.max_eval_batches:
                    break
                clips = clips.to(config.device)
                context = clips[:, :config.input_frames]
                future = clips[:, config.input_frames:]
                preds = model(context, n_pred)  # open-loop
                total += F.mse_loss(preds, future).item(); n += 1
        return {"eval_loss": total / max(1, n)}

    def infer(self, config: BaseConfig, inputs: Any) -> Any:
        """Roll out future frames. inputs: {"frames": [B, T_in, 1, H, W]}."""
        assert isinstance(config, ConvLSTMConfig)
        if self.model is None:
            raise RuntimeError("Model not loaded.")
        model = self.model
        model.eval()
        frames = inputs["frames"] if isinstance(inputs, dict) else inputs
        n_pred = inputs.get("n_predict", config.seq_len - config.input_frames) if isinstance(inputs, dict) else config.seq_len - config.input_frames
        with torch.no_grad():
            preds = model(frames.to(config.device), n_pred).cpu()
        return {"predictions": preds}


def make_convlstm_dataloader(config: ConvLSTMConfig, split: str = "train") -> DataLoader:
    base = get_dataset(config.dataset, config.data_root, split=split,
                       task="classification", fast_demo=config.effective_fast_demo)
    n_clips = 128 if config.effective_fast_demo else config.n_clips
    ds = _MovingMNIST(base, config.canvas_size, config.seq_len, n_clips,
                      seed=7 + (1000 if split != "train" else 0))
    return DataLoader(ds, batch_size=config.effective_batch_size,
                      shuffle=split == "train", num_workers=0, drop_last=False)
