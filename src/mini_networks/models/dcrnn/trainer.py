"""DCRNN trainer: forecast a synthetic diffusion process on a random sensor graph.

Data (no download): `n_nodes` sensors at random 2D positions; the adjacency is a
Gaussian kernel of pairwise distance, thresholded and NOT symmetrized
(gen_adj_mx.py:11-42). A signal diffuses over this graph across time; each example
is (`seq_len` past steps -> `horizon` future steps). The dual random-walk supports
D⁻¹A (forward) and D⁻¹Aᵀ (reverse) are built once and reused.

Training uses INVERSE-SIGMOID scheduled sampling (dcrnn_model.py:84-92):
    teacher_prob(step) = k / (k + exp(step / k))
which decays from ~1 toward 0 as the global step count grows, so the decoder is
weaned off ground truth onto its own predictions. Contrast with the convlstm
mini's Bernoulli soft-mix — same goal, different schedule.
"""
from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset, TensorDataset

from mini_networks.core.config import BaseConfig
from mini_networks.core.logging.logger import Logger
from mini_networks.core.runtime import BaseTrainer
from mini_networks.models.dcrnn.config import DCRNNConfig
from mini_networks.models.dcrnn.model import DCRNN


def _build_graph(n_nodes: int, seed: int = 11):
    """Random sensor positions -> Gaussian-kernel adjacency (directed) -> dual supports."""
    g = torch.Generator().manual_seed(seed)
    pos = torch.rand(n_nodes, 2, generator=g)
    dist = torch.cdist(pos, pos)
    sigma = dist[dist > 0].std()
    adj = torch.exp(-(dist / (sigma + 1e-8)) ** 2)
    adj = adj * (adj >= 0.1)  # threshold-sparsify (gen_adj_mx.py); keep asymmetry
    adj.fill_diagonal_(1.0)
    # Directed random-walk supports: forward D⁻¹A and reverse D⁻¹Aᵀ.
    fwd = adj / adj.sum(dim=1, keepdim=True).clamp_min(1e-8)
    adj_t = adj.t()
    rev = adj_t / adj_t.sum(dim=1, keepdim=True).clamp_min(1e-8)
    return [fwd, rev], adj


def _make_sequences(supports, n_nodes, seq_len, horizon, n_samples, seed):
    """Simulate a diffusion process on the graph; slice into (past, future) pairs."""
    fwd = supports[0]
    g = torch.Generator().manual_seed(seed)
    total = seq_len + horizon
    X = torch.zeros(n_samples, total, n_nodes, 1)
    for i in range(n_samples):
        state = torch.randn(n_nodes, 1, generator=g)
        traj = []
        for _ in range(total):
            # One diffusion step + mild noise: state <- 0.8·(P·state) + 0.2·state + eps.
            state = 0.8 * (fwd @ state) + 0.2 * state + 0.05 * torch.randn(n_nodes, 1, generator=g)
            traj.append(state.clone())
        X[i] = torch.stack(traj, dim=0)
    return X[:, :seq_len], X[:, seq_len:]


class DCRNNTrainer(BaseTrainer):
    def __init__(self):
        self.model: DCRNN | None = None
        self.supports: list[torch.Tensor] | None = None
        self._global_step = 0

    def _build(self, config: DCRNNConfig) -> DCRNN:
        return DCRNN(
            node_dim=1,
            hidden_dim=config.hidden_dim,
            n_supports=2,
            max_diffusion_step=config.max_diffusion_step,
        ).to(config.device)

    def _teacher_prob(self, config: DCRNNConfig) -> float:
        k = config.cl_decay_steps
        return k / (k + math.exp(self._global_step / k))

    def train(self, config: BaseConfig, dataloader: DataLoader, logger: Logger) -> None:
        assert isinstance(config, DCRNNConfig)
        model = self._build(config)
        self.model = model
        if self.supports is None:
            self.supports, _ = _build_graph(config.n_nodes)
        supports = [s.to(config.device) for s in self.supports]
        optimizer = torch.optim.Adam(model.parameters(), lr=config.learning_rate)
        logger.log_config(config.model_dump())

        for epoch in range(config.effective_epochs):
            model.train()
            total, n = 0.0, 0
            for batch_idx, (past, future) in enumerate(dataloader):
                if config.max_train_batches is not None and batch_idx >= config.max_train_batches:
                    break
                past, future = past.to(config.device), future.to(config.device)
                tp = self._teacher_prob(config)
                preds = model(past, supports, config.horizon, targets=future, teacher_prob=tp)
                loss = F.mse_loss(preds, future)
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
                self._global_step += 1
                total += loss.item(); n += 1
            logger.log_metrics(epoch, {"loss": total / max(1, n),
                                       "teacher_prob": self._teacher_prob(config), "epoch": epoch})

        torch.save(model.state_dict(), logger.artifact_path("model.pt"))

    def evaluate(self, config: BaseConfig, dataloader: DataLoader, logger: Logger) -> dict:
        assert isinstance(config, DCRNNConfig)
        if self.model is None:
            self.model = self._build(config)
        if self.supports is None:
            self.supports, _ = _build_graph(config.n_nodes)
        supports = [s.to(config.device) for s in self.supports]
        model = self.model
        model.eval()
        total, n = 0.0, 0
        with torch.no_grad():
            for batch_idx, (past, future) in enumerate(dataloader):
                if config.max_eval_batches is not None and batch_idx >= config.max_eval_batches:
                    break
                past, future = past.to(config.device), future.to(config.device)
                preds = model(past, supports, config.horizon)  # fully autoregressive
                total += F.mse_loss(preds, future).item(); n += 1
        return {"eval_loss": total / max(1, n)}

    def infer(self, config: BaseConfig, inputs: Any) -> Any:
        """Forecast. inputs: {"past": [B, seq_len, N, 1]}."""
        assert isinstance(config, DCRNNConfig)
        if self.model is None:
            raise RuntimeError("Model not loaded.")
        if self.supports is None:
            self.supports, _ = _build_graph(config.n_nodes)
        supports = [s.to(config.device) for s in self.supports]
        past = inputs["past"] if isinstance(inputs, dict) else inputs
        with torch.no_grad():
            preds = self.model(past.to(config.device), supports, config.horizon).cpu()
        return {"forecast": preds}


def make_dcrnn_dataloader(config: DCRNNConfig, split: str = "train") -> DataLoader:
    supports, _ = _build_graph(config.n_nodes)
    n = 128 if config.effective_fast_demo else config.n_samples
    seed = 3 + (1000 if split != "train" else 0)
    past, future = _make_sequences(supports, config.n_nodes, config.seq_len,
                                   config.horizon, n, seed)
    ds = TensorDataset(past, future)
    return DataLoader(ds, batch_size=config.effective_batch_size,
                      shuffle=split == "train", num_workers=0, drop_last=False)
