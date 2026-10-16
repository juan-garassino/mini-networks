"""Seq2seq trainer: split text windows into (src, tgt) halves, shifted teacher forcing."""
from __future__ import annotations

from typing import Any

import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset

from mini_networks.core.config import BaseConfig
from mini_networks.core.data.registry import get_dataloader
from mini_networks.core.data.text import split_seq_halves
from mini_networks.core.logging.logger import Logger
from mini_networks.core.runtime import BaseTrainer
from mini_networks.models.text_seq2seq.config import TextSeq2SeqConfig
from mini_networks.models.text_seq2seq.model import Seq2SeqTransformer


class Seq2SeqDataset(Dataset):
    """Split each sequence into src/tgt halves."""

    def __init__(self, base_ds: Dataset):
        self.base = base_ds

    def __len__(self) -> int:
        return len(self.base)

    def __getitem__(self, idx: int):
        x, y = self.base[idx]
        src, tgt = split_seq_halves(x)
        return src, tgt


class TextSeq2SeqTrainer(BaseTrainer):
    """Train :class:`Seq2SeqTransformer` to map a text window's first half to its second.

    Loss: shifted teacher-forcing cross-entropy (decoder reads tgt[:-1],
    predicts tgt[1:]). Checkpoint: ``model.pt`` (no tokenizer is saved; the
    API works in token ids).
    """
    def __init__(self):
        self.model: Seq2SeqTransformer | None = None

    def _build(self, config: TextSeq2SeqConfig, vocab_size: int) -> Seq2SeqTransformer:
        return Seq2SeqTransformer(
            vocab_size=vocab_size,
            d_model=config.d_model,
            n_heads=config.n_heads,
            n_layers=config.n_layers,
            d_ff=config.d_ff,
            seq_len=config.seq_len,
        ).to(config.device)

    def train(self, config: BaseConfig, dataloader: DataLoader, logger: Logger) -> None:
        """Wrap the loader's dataset in :class:`Seq2SeqDataset`, fit with AdamW, and save
        ``model.pt``.
        """
        assert isinstance(config, TextSeq2SeqConfig)
        base_ds = dataloader.dataset
        vocab_size = base_ds.vocab_size if hasattr(base_ds, "vocab_size") else config.vocab_size
        model = self._build(config, vocab_size)
        self.model = model
        optimizer = torch.optim.AdamW(model.parameters(), lr=config.learning_rate)
        logger.log_config(config.model_dump())

        ds = Seq2SeqDataset(base_ds)
        dl = DataLoader(ds, batch_size=config.effective_batch_size, shuffle=True, num_workers=0)

        for epoch in range(config.effective_epochs):
            model.train()
            total = 0.0
            for src, tgt in dl:
                src, tgt = src.to(config.device), tgt.to(config.device)
                # Shifted teacher forcing: decoder reads tgt[:, :-1] (causally
                # masked in model.forward) and predicts tgt[:, 1:].
                logits = model(src, tgt[:, :-1])
                loss = F.cross_entropy(logits.reshape(-1, vocab_size), tgt[:, 1:].reshape(-1))
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
                total += loss.item()
            logger.log_metrics(epoch, {"loss": total / max(1, len(dl))})

        torch.save(model.state_dict(), logger.artifact_path("model.pt"))

    def evaluate(self, config: BaseConfig, dataloader: DataLoader, logger: Logger) -> dict:
        """Return ``{"eval_loss"}``: mean teacher-forced cross-entropy over batches of 4
        (src, tgt) pairs.
        """
        assert isinstance(config, TextSeq2SeqConfig)
        if self.model is None:
            base_ds = dataloader.dataset
            vocab_size = base_ds.vocab_size if hasattr(base_ds, "vocab_size") else config.vocab_size
            self.model = self._build(config, vocab_size)
        model = self.model
        model.eval()
        total = 0.0
        n_batches = 0
        with torch.no_grad():
            for src, tgt in DataLoader(Seq2SeqDataset(dataloader.dataset), batch_size=4):
                src, tgt = src.to(config.device), tgt.to(config.device)
                logits = model(src, tgt[:, :-1])
                total += F.cross_entropy(logits.reshape(-1, logits.size(-1)), tgt[:, 1:].reshape(-1)).item()
                n_batches += 1
        # Divide by the batches actually iterated — dividing by the caller's
        # differently-sized dataloader inflated eval_loss ~4x pre-fix.
        return {"eval_loss": total / max(1, n_batches)}

    def load_checkpoint(self, config: BaseConfig, artifacts_dir) -> None:
        """Load ``model.pt``, reading the vocab size from the source embedding."""
        from pathlib import Path
        assert isinstance(config, TextSeq2SeqConfig)
        state = torch.load(Path(artifacts_dir) / "model.pt",
                           map_location=config.device, weights_only=True)
        vocab_size = state["src_embed.weight"].shape[0]
        self.model = self._build(config, vocab_size)
        self.model.load_state_dict(state)
        self.model.eval()

    def infer(self, config: BaseConfig, inputs: Any) -> Any:
        """Continue a source sequence of token ids.

        ``inputs``: ``{"src": [ids], "temperature": float (0.8)}`` or a bare id
        list. Decoding is seeded with the last source token and samples
        min(len(src), 32) tokens. Returns ``{"predictions": [[ids]]}`` (seed
        token excluded).
        """
        assert isinstance(config, TextSeq2SeqConfig)
        if self.model is None:
            raise RuntimeError("Model not loaded.")
        src = inputs.get("src") if isinstance(inputs, dict) else inputs
        temperature = float(inputs.get("temperature", 0.8)) if isinstance(inputs, dict) else 0.8
        src = torch.as_tensor(src, dtype=torch.long).unsqueeze(0).to(config.device)
        # Sampled decode, seeded with the last source token (no BOS in the
        # vocab; tgt continues src). Greedy argmax on a small char model
        # collapses into unigram loops (" the the the" — audit); temperature
        # sampling keeps continuations alive.
        max_new = min(src.size(1), 32)
        decoded = src[:, -1:]
        with torch.no_grad():
            for _ in range(max_new):
                logits = self.model(src, decoded)[:, -1, :] / max(temperature, 1e-4)
                nxt = torch.multinomial(torch.softmax(logits, dim=-1), 1)
                decoded = torch.cat([decoded, nxt], dim=1)
        return {"predictions": decoded[:, 1:].cpu().tolist()}


def make_text_seq2seq_dataloader(config: TextSeq2SeqConfig, split: str = "train") -> DataLoader:
    """Text loader for ``config.dataset``: batches of (x [B,seq_len], y [B,seq_len]) char ids.

    The trainer re-wraps ``dataloader.dataset`` into (src, tgt) halves, so only the dataset
    (and its ``vocab_size``) is used from this loader.
    """
    return get_dataloader(
        name=config.dataset,
        data_root=config.data_root,
        split=split,
        batch_size=config.effective_batch_size,
        fast_demo=config.effective_fast_demo,
        sample_limit=config.dataset_sample_limit,
        file_path=config.text_file,
        seq_len=config.seq_len,
    )
