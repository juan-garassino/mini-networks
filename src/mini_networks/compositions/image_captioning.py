"""Image captioning: a patch encoder feeding a causal Transformer decoder.

The encoder-decoder pattern of Show-Attend-Tell / the original Transformer,
applied to MNIST digits and templated captions of their label:

    image  [B,1,28,28] -> VisionPatchEncoder (4x4 patches) -> memory [B,49,D]
    tokens [B,T] -> token + learned position embeddings -> causal
        TransformerDecoder (self-attn over the caption so far, cross-attn
        into the 49 patch tokens) -> Linear -> next-char logits [B,T,vocab]

Training is teacher forcing: the decoder reads ``[BOS, c_0 .. c_{T-2}]``
and must predict ``[c_0 .. c_{T-1}]``; ``Captioner.generate`` decodes
greedily from BOS. What it demonstrates: cross-attention is how a language
decoder "looks at" another modality at every step.

Deliberately simplified: captions are templates of the class label (so the
task is "classify, then spell it out"), character-level tokens
(``ord(c) % vocab_size``) with 0 doubling as BOS and PAD, padding positions
are NOT masked out of the loss (the model also learns to emit trailing 0s),
and decoding is greedy with no beam search or EOS stop.
"""
from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F

from mini_networks.core.logging.logger import Logger
from mini_networks.core.config import BaseConfig
from mini_networks.core.data.registry import get_dataloader
from mini_networks.models.clip.data import label_to_tokens
from mini_networks.models.multimodal.encoders import VisionPatchEncoder


class ImageCaptioningConfig(BaseConfig):
    """Knobs: ``d_model`` / ``n_heads`` / ``n_layers`` (decoder size),
    ``text_seq_len`` (caption length incl. padding), ``vocab_size``
    (character ids modulo this)."""

    model_name: str = "image_captioning"
    d_model: int = 64
    n_heads: int = 2
    n_layers: int = 2
    vocab_size: int = 256
    text_seq_len: int = 32
    dataset: str = "mnist"


class Captioner(nn.Module):
    """Patch-token image encoder + causal Transformer decoder over characters."""

    def __init__(self, d_model: int, n_heads: int, n_layers: int, vocab_size: int, seq_len: int):
        super().__init__()
        self.vision = VisionPatchEncoder(d_model=d_model)
        self.token = nn.Embedding(vocab_size, d_model)
        self.pos = nn.Embedding(seq_len, d_model)
        decoder_layer = nn.TransformerDecoderLayer(
            d_model=d_model,
            nhead=n_heads,
            dim_feedforward=d_model * 4,
            dropout=0.1,
            batch_first=True,
        )
        self.decoder = nn.TransformerDecoder(decoder_layer, num_layers=n_layers)
        self.head = nn.Linear(d_model, vocab_size)

    def forward(self, images: torch.Tensor, tokens: torch.Tensor) -> torch.Tensor:
        """(images [B,1,28,28], tokens [B,T]) -> next-token logits [B,T,vocab_size].

        ``T`` must be <= ``seq_len`` (the size of the position table).
        """
        mem = self.vision(images)
        B, T = tokens.shape
        pos = torch.arange(T, device=tokens.device).unsqueeze(0)
        tgt = self.token(tokens) + self.pos(pos)
        # Causal mask is load-bearing: without it the decoder attends to the
        # full target and the training loss is solvable by COPYING the input
        # tokens — the model never learned to caption (2026-07-11 audit).
        causal = nn.Transformer.generate_square_subsequent_mask(T, device=tokens.device)
        out = self.decoder(tgt, mem, tgt_mask=causal)
        return self.head(out)

    @torch.no_grad()
    def generate(self, images: torch.Tensor, max_len: int = 32) -> torch.Tensor:
        """Greedy caption generation seeded with BOS(=0). Returns [B, max_len]."""
        B = images.size(0)
        dev = images.device
        tokens = torch.zeros(B, 1, dtype=torch.long, device=dev)
        for _ in range(max_len - 1):
            logits = self.forward(images, tokens)
            tokens = torch.cat([tokens, logits[:, -1:].argmax(dim=-1)], dim=1)
        return tokens[:, 1:]


class ImageCaptioning:
    """Trains a Captioner on (MNIST image, label caption) pairs."""

    def __init__(self):
        self.model: Captioner | None = None

    def train(self, config: ImageCaptioningConfig, logger: Logger) -> None:
        """Teacher-forced next-character cross-entropy over whole captions.

        Logs ``loss`` per epoch; saves ``model.pt``. Batch size is the raw
        ``batch_size`` (capped at 16 under ``fast_demo``), not the tier's
        ``effective_batch_size``.
        """
        dl = get_dataloader(
            name=config.dataset,
            data_root=config.data_root,
            split="train",
            task="classification",
            batch_size=min(config.batch_size, 16) if config.fast_demo else config.batch_size,
            fast_demo=config.effective_fast_demo,
            sample_limit=config.dataset_sample_limit,
        )
        model = Captioner(
            d_model=config.d_model,
            n_heads=config.n_heads,
            n_layers=config.n_layers,
            vocab_size=config.vocab_size,
            seq_len=config.text_seq_len,
        ).to(config.device)
        self.model = model
        opt = torch.optim.Adam(model.parameters(), lr=config.learning_rate)

        for epoch in range(config.effective_epochs):
            total = 0.0
            for images, labels in dl:
                images = images.to(config.device)
                tokens = torch.stack([
                    label_to_tokens(int(l), config.text_seq_len, config.vocab_size)
                    for l in labels
                ], dim=0).to(config.device)
                # BOS(=0)-shifted teacher forcing: read [BOS, tok_<T]], predict tok.
                # Captions never start with PAD(0), so 0 doubles as BOS safely.
                bos = torch.zeros(tokens.size(0), 1, dtype=torch.long, device=config.device)
                inp = torch.cat([bos, tokens[:, :-1]], dim=1)
                logits = model(images, inp)
                loss = F.cross_entropy(logits.view(-1, config.vocab_size), tokens.view(-1))
                opt.zero_grad()
                loss.backward()
                opt.step()
                total += loss.item()
            logger.log_metrics(epoch, {"loss": total / max(1, len(dl))})

        torch.save(model.state_dict(), logger.artifact_path("model.pt"))
