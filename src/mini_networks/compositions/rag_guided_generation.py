"""RAG-guided generation: TF-IDF retrieval prepended to a char-level LM prompt.

Composes the zoo's NanoRAG retriever with a TransformerLM:

    train:    next-character LM on a text file (Tiny Shakespeare when
              ``text_file`` is empty); then chunk the same corpus into
              ``chunk_size``-char pieces and build a TF-IDF index over them
    generate: top_k chunks by cosine(TF-IDF(query), TF-IDF(chunk))
              -> prompt "[Context: c1 | c2 | c3] <query>"
              -> LM samples ``max_new_tokens`` characters after it

What it demonstrates: retrieval-augmented generation (Lewis et al., 2020) as
pure prompting — the generator is never told it is being "augmented"; the
retriever just puts relevant text in front of it.

Deliberately simplified: lexical TF-IDF, not a learned dense retriever; the
retriever and LM are trained independently and the LM is never trained to
*use* context; the index is built from the LM's own training corpus. Note
also that TransformerLM.generate conditions on only the last ``seq_len``
(64) tokens, so of a ~600-character retrieved context the LM sees just the
tail (mostly the query and the end of the last chunk).
"""
from __future__ import annotations

import torch
import torch.nn.functional as F

from mini_networks.core.config import BaseConfig
from mini_networks.core.data.registry import get_dataloader
from mini_networks.core.logging.logger import Logger
from mini_networks.models.rag.model import NanoRAG
from mini_networks.models.transformer.model import TransformerLM
from mini_networks.models.transformer.tokenizer import CharTokenizer


class RAGGuidedGenerationConfig(BaseConfig):
    """Knobs: retrieval (``top_k`` chunks, ``chunk_size`` chars per chunk),
    LM size (``d_model``, ``n_layers``, ``n_heads``, ``d_ff``, ``seq_len`` =
    context window), and ``text_file`` (corpus; empty = Tiny Shakespeare)."""

    model_name: str = "rag_guided_generation"
    d_model: int = 64
    n_layers: int = 2
    n_heads: int = 2
    d_ff: int = 128
    seq_len: int = 64
    dropout: float = 0.1
    top_k: int = 3
    chunk_size: int = 200
    dataset: str = "text_file"
    text_file: str = ""


class RAGGuidedGeneration:
    """Trains a char LM, indexes its corpus, and generates from retrieved prompts."""

    def __init__(self):
        self.model: TransformerLM | None = None
        self.tokenizer: CharTokenizer | None = None
        self.rag: NanoRAG | None = None

    def _build_lm(self, config: RAGGuidedGenerationConfig, vocab_size: int) -> TransformerLM:
        """Decoder-only TransformerLM: tokens [B,T] -> logits [B,T,vocab_size]."""
        return TransformerLM(
            vocab_size=vocab_size,
            d_model=config.d_model,
            n_heads=config.n_heads,
            n_layers=config.n_layers,
            d_ff=config.d_ff,
            seq_len=config.seq_len,
            dropout=config.dropout,
        ).to(config.device)

    def train(self, config: RAGGuidedGenerationConfig, logger: Logger) -> None:
        """Train the LM (AdamW, next-char CE), then build the TF-IDF index.

        Logs ``loss`` per epoch; saves ``model.pt`` and ``tokenizer.json``.
        The index lives in memory only (``self.rag``).
        """
        dl = get_dataloader(
            name=config.dataset,
            data_root=config.data_root,
            split="train",
            batch_size=config.effective_batch_size,
            fast_demo=config.effective_fast_demo,
            sample_limit=config.dataset_sample_limit,
            file_path=config.text_file,
            seq_len=config.seq_len,
        )
        ds = dl.dataset
        vocab_size = ds.vocab_size
        self.tokenizer = ds.tokenizer

        model = self._build_lm(config, vocab_size)
        self.model = model
        optimizer = torch.optim.AdamW(model.parameters(), lr=config.learning_rate)

        for epoch in range(config.effective_epochs):
            model.train()
            total = 0.0
            for x, y in dl:
                x, y = x.to(config.device), y.to(config.device)
                logits, _ = model(x)
                loss = F.cross_entropy(logits.view(-1, vocab_size), y.view(-1))
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
                total += loss.item()
            logger.log_metrics(epoch, {"loss": total / max(1, len(dl))})

        torch.save(model.state_dict(), logger.artifact_path("model.pt"))
        self.tokenizer.save(str(logger.artifact_path("tokenizer.json")))

        corpus = getattr(ds, "text", "")
        self.rag = NanoRAG(top_k=config.top_k, chunk_size=config.chunk_size)
        self.rag.add_documents([corpus])

    def generate(self, config: RAGGuidedGenerationConfig, query: str, max_new_tokens: int = 64) -> str:
        """Retrieve context for ``query`` and sample a continuation.

        Returns the decoded full sequence: the augmented prompt
        (``"[Context: ...] <query>"``) followed by the generated characters.
        Prompt characters missing from the corpus vocabulary encode to PAD
        and vanish on decode.
        """
        if self.model is None or self.rag is None or self.tokenizer is None:
            raise RuntimeError("Train first.")
        prompt = self.rag.build_prompt(query)
        ids = self.tokenizer.encode(prompt)
        prompt_ids = torch.tensor([ids], dtype=torch.long, device=config.device)
        out = self.model.generate(prompt_ids, max_new_tokens=max_new_tokens)
        return self.tokenizer.decode(out[0].tolist())
